/**
 * Mulkiya field extraction via OCR.space (free tier).
 *
 * Pipeline:
 *   1. Compress the image down to under 1 MB and resize to a max
 *      width of 1600 px. OCR.space free tier rejects files larger
 *      than 1 MB with a TCP reset, not a clean HTTP error, so this
 *      step is non-optional.
 *   2. POST the compressed image as multipart/form-data. Base64
 *      bloats the payload by 33 percent, which makes the size cap
 *      even tighter, so we send raw bytes.
 *   3. Parse the returned plain text with regex for the structured
 *      fields the consumer cares about (plate, VIN, year, expiry,
 *      emirate, make, model).
 *
 * Trade-offs:
 *   + Zero recurring spend at our scale.
 *   + Survives the OCR.space 1 MB cap on free keys.
 *   + Single retry on transient TCP resets.
 *   - Lower accuracy than Claude vision on creased or shadowed
 *     photos. Unparsed fields stay null so the user types them in.
 *
 * Public surface unchanged. documents.ts still calls
 * extractMulkiyaFromImage(b64, mimeType).
 */

import sharp from 'sharp'
import { MAKES, MODELS_BY_MAKE } from '@/lib/car-data'

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image'
const REQUEST_TIMEOUT_MS = 25_000
const RETRY_ATTEMPTS = 2 // initial plus one retry on TCP reset / timeout
const TARGET_MAX_BYTES = 950_000 // sit a touch under OCR.space's 1 MB cap

const EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
] as const

export type ExtractedMulkiya = {
  vehicle_make: string | null
  vehicle_model: string | null
  year: number | null
  plate_number: string | null
  plate_emirate: (typeof EMIRATES)[number] | null
  vin: string | null
  expires_at: string | null
  // Added per user request, June 2026:
  insurance_expires_at: string | null
  engine_number: string | null
  cylinders: number | null
}

export async function extractMulkiyaFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedMulkiya | null> {
  if (process.env.EXTRACTION_ENABLED === 'false') {
    console.log('[extract-mulkiya] EXTRACTION_ENABLED=false; skipping')
    return null
  }
  const apiKey = process.env.OCR_SPACE_API_KEY ?? 'helloworld'

  // Decode the base64 the action handed us and recompress before
  // sending. Sharp pre-bundled with Next.js for next/image, no
  // extra runtime cost on Vercel.
  let compressed: Buffer
  try {
    const raw = Buffer.from(imageBase64, 'base64')
    compressed = await compressForOcr(raw, mimeType)
  } catch (err) {
    console.error('[extract-mulkiya] compression failed', err)
    return null
  }
  console.log(
    '[extract-mulkiya] compressed bytes',
    compressed.byteLength,
    'mime',
    mimeType,
  )

  const text = await postToOcrSpaceWithRetry(compressed, apiKey)
  if (!text) return null

  return parseMulkiyaText(text)
}

// ─── network ────────────────────────────────────────────────────────

async function postToOcrSpaceWithRetry(
  bytes: Buffer,
  apiKey: string,
): Promise<string | null> {
  let lastErr: unknown = null
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const text = await postToOcrSpace(bytes, apiKey)
      if (text != null) return text
    } catch (err) {
      lastErr = err
      console.warn(
        '[extract-mulkiya] attempt',
        attempt,
        'failed',
        (err as Error)?.message ?? err,
      )
      // Don't sleep between attempts; OCR.space resets are usually
      // a transient TLS handshake issue and a fresh connection
      // immediately works. Sleeping wastes our 25s budget.
    }
  }
  console.error('[extract-mulkiya] all attempts failed', lastErr)
  return null
}

async function postToOcrSpace(
  bytes: Buffer,
  apiKey: string,
): Promise<string | null> {
  const form = new FormData()
  form.append('apikey', apiKey)
  form.append('language', 'eng')
  form.append('isOverlayRequired', 'false')
  form.append('detectOrientation', 'true')
  form.append('scale', 'true')
  // Engine 2 has better mixed Arabic/English accuracy than engine 1
  // and a higher per-call budget on the free plan.
  form.append('OCREngine', '2')
  form.append(
    'file',
    new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' }),
    'mulkiya.jpg',
  )

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)

  try {
    const res = await fetch(OCR_SPACE_URL, {
      method: 'POST',
      body: form,
      signal: ctrl.signal,
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[extract-mulkiya] ocr.space http error', res.status, body)
      return null
    }
    const json = (await res.json()) as {
      ParsedResults?: Array<{ ParsedText?: string; ErrorMessage?: string }>
      IsErroredOnProcessing?: boolean
      ErrorMessage?: string | string[]
    }
    if (json.IsErroredOnProcessing) {
      console.error('[extract-mulkiya] ocr.space error', json.ErrorMessage)
      return null
    }
    const text = json.ParsedResults?.[0]?.ParsedText ?? ''
    if (!text.trim()) {
      console.warn('[extract-mulkiya] ocr.space returned empty text')
      return null
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}

// ─── compression ────────────────────────────────────────────────────

async function compressForOcr(raw: Buffer, mimeType: string): Promise<Buffer> {
  // Step down through progressively smaller widths until the JPEG
  // lands under the OCR.space 1 MB cap. Most phone photos hit the
  // cap on the first pass (1600 px at quality 78).
  const widths = [1600, 1400, 1200, 1000]
  for (const width of widths) {
    const out = await sharp(raw, { failOn: 'none' })
      .rotate() // honour EXIF orientation; mulkiya is often rotated
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
    if (out.byteLength <= TARGET_MAX_BYTES) return out
  }
  // Last resort: drop quality. Below 60 OCR starts losing characters.
  const last = await sharp(raw, { failOn: 'none' })
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 60, mozjpeg: true })
    .toBuffer()
  return last
}

// ─── parsers ────────────────────────────────────────────────────────

export function parseMulkiyaText(text: string): ExtractedMulkiya {
  const norm = text.replace(/ /g, ' ').replace(/\r/g, '')
  const upper = norm.toUpperCase()

  return {
    vehicle_make: findMake(norm),
    vehicle_model: findModel(norm),
    year: findYear(norm),
    plate_number: findPlateNumber(upper),
    plate_emirate: findEmirate(norm),
    vin: findVin(upper),
    expires_at: findExpiry(upper),
    insurance_expires_at: findInsuranceExpiry(upper),
    engine_number: findEngineNumber(upper),
    cylinders: findCylinders(upper),
  }
}

function findVin(upper: string): string | null {
  const m = upper.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)
  return m ? m[0] : null
}

function findYear(text: string): number | null {
  const nextYear = new Date().getFullYear() + 1
  const matches = text.match(/\b(19[89]\d|20\d{2})\b/g) ?? []
  for (const m of matches) {
    const n = Number(m)
    if (n >= 1980 && n <= nextYear) return n
  }
  return null
}

function findPlateNumber(upper: string): string | null {
  const contextual = upper.match(
    /\b(?:PLATE(?:\s+NO)?|PLATE\s+NUMBER|TRAFFIC\s+PLATE)[^\d]{0,12}(\d{3,5})/,
  )
  if (contextual && contextual[1]) return contextual[1]

  const yearLike = new Set(
    (upper.match(/\b(19\d{2}|20\d{2})\b/g) ?? []).map((s) => s),
  )
  const candidates = (upper.match(/\b\d{3,5}\b/g) ?? []).filter(
    (n) => !yearLike.has(n),
  )
  if (candidates.length === 0) return null
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0] ?? null
}

function findEmirate(text: string): (typeof EMIRATES)[number] | null {
  const lower = text.toLowerCase()
  const order: Array<[RegExp, (typeof EMIRATES)[number]]> = [
    [/\b(abu\s*dhabi|abudhabi|auh)\b/, 'Abu Dhabi'],
    [/\b(ras\s*al\s*khaimah|rak)\b/, 'Ras Al Khaimah'],
    [/\b(umm\s*al\s*quwain|uaq)\b/, 'Umm Al Quwain'],
    [/\bdubai|dxb\b/, 'Dubai'],
    [/\bsharjah|shj\b/, 'Sharjah'],
    [/\bajman|ajm\b/, 'Ajman'],
    [/\bfujairah|fuj\b/, 'Fujairah'],
  ]
  for (const [pattern, emirate] of order) {
    if (pattern.test(lower)) return emirate
  }
  return null
}

function findExpiry(upper: string): string | null {
  const contextual = upper.match(
    /(?:EXP(?:IRY)?(?:\s+DATE)?|VALID(?:\s+UNTIL)?|REG(?:ISTRATION)?\s+EXPIRES?)[^\d]{0,20}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  )
  const raw = contextual?.[1]
  if (!raw) return null
  return normaliseDate(raw)
}

function normaliseDate(raw: string): string | null {
  const m = raw.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/)
  if (!m) return null
  const a = m[1]!
  const b = m[2]!
  const c = m[3]!
  let yyyy: number
  let mm: number
  let dd: number
  if (a.length === 4) {
    yyyy = Number(a)
    mm = Number(b)
    dd = Number(c)
  } else {
    dd = Number(a)
    mm = Number(b)
    yyyy = c.length === 2 ? 2000 + Number(c) : Number(c)
  }
  if (
    !Number.isFinite(yyyy) ||
    !Number.isFinite(mm) ||
    !Number.isFinite(dd) ||
    mm < 1 ||
    mm > 12 ||
    dd < 1 ||
    dd > 31 ||
    yyyy < 1980 ||
    yyyy > 2099
  ) {
    return null
  }
  return `${yyyy.toString().padStart(4, '0')}-${mm
    .toString()
    .padStart(2, '0')}-${dd.toString().padStart(2, '0')}`
}

// Insurance expiry. UAE mulkiya prints it as "INS EXP" or
// "INSURANCE EXP" near a date. Normalised to ISO yyyy-mm-dd.
function findInsuranceExpiry(upper: string): string | null {
  const m = upper.match(
    /(?:INS(?:URANCE)?(?:\s+EXP(?:IRY)?)?(?:\s+DATE)?|POLICY\s+EXP(?:IRY)?)[^\d]{0,20}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  )
  const raw = m?.[1]
  if (!raw) return null
  return normaliseDate(raw)
}

// Engine number. Alphanumeric run 6 to 20 chars near "ENGINE NO"
// or "ENGINE NUMBER" or "MOTOR NO". Stays defensive about false
// positives by requiring the label context (no anywhere-in-text
// fallback like VIN).
function findEngineNumber(upper: string): string | null {
  const m = upper.match(
    /(?:ENGINE\s*(?:NO|NUMBER|#)|MOTOR\s*NO)[^A-Z0-9]{0,8}([A-Z0-9]{6,20})/,
  )
  return m?.[1] ?? null
}

// Cylinder count. Petrol/diesel passenger cars in the UAE are 3,
// 4, 6, 8, 10, or 12 cylinders. Look for a 1-2 digit number near
// "CYLINDERS", "CYL", or "NO OF CYL".
function findCylinders(upper: string): number | null {
  const m = upper.match(
    /(?:NO\.?\s*OF\s*)?CYL(?:INDERS)?[^\d]{0,10}(\d{1,2})/,
  )
  if (!m || !m[1]) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 2 || n > 16) return null
  return n
}

function findMake(text: string): string | null {
  const haystack = ' ' + text.toUpperCase() + ' '
  let best: { name: string; length: number } | null = null
  for (const make of MAKES) {
    const m = make.toUpperCase()
    if (haystack.includes(' ' + m + ' ')) {
      if (!best || m.length > best.length) best = { name: make, length: m.length }
    }
  }
  return best?.name ?? null
}

function findModel(text: string): string | null {
  const make = findMake(text)
  if (!make) return null
  const models = MODELS_BY_MAKE[make] ?? []
  const haystack = ' ' + text.toUpperCase() + ' '
  let best: { name: string; length: number } | null = null
  for (const model of models) {
    const m = model.toUpperCase()
    if (haystack.includes(' ' + m + ' ')) {
      if (!best || m.length > best.length) best = { name: model, length: m.length }
    }
  }
  return best?.name ?? null
}
