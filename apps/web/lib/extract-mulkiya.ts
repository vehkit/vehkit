/**
 * Mulkiya field extraction via OCR.space (free tier).
 *
 * Replaced the paid Claude vision path with a free OCR pipeline:
 *   1. POST the image to OCR.space (25,000 free pages/month, no
 *      tokens, no per-request cost).
 *   2. Parse the returned raw text with regex to pull the structured
 *      fields the consumer cares about (plate, VIN, year, expiry,
 *      emirate, make, model).
 *
 * Trade-off vs Claude vision:
 *   - Zero recurring cost. Good enough for early users.
 *   - Lower accuracy on creased / shadowed photos. We default to
 *     null on any field we cannot confidently parse so the user
 *     just types those instead of getting a wrong autofill.
 *   - No bundle weight server-side (vs Tesseract.js which needs
 *     ~30 MB of language data per cold start).
 *
 * Public surface is unchanged: documents.ts still calls
 * extractMulkiyaFromImage(b64, mimeType). The whole swap is a
 * drop-in replacement.
 */

import { MAKES, MODELS_BY_MAKE } from '@/lib/car-data'

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image'

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
}

/**
 * Extract structured mulkiya fields from an image.
 * Signature kept identical to the old Claude version so callers in
 * actions/documents.ts do not need to change.
 *
 * @param imageBase64 base64-encoded image bytes (no data: prefix)
 * @param mimeType e.g. "image/jpeg", "image/png", "image/webp"
 */
export async function extractMulkiyaFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedMulkiya | null> {
  if (process.env.EXTRACTION_ENABLED === 'false') {
    console.log('[extract-mulkiya] EXTRACTION_ENABLED=false; skipping')
    return null
  }

  // OCR.space accepts a public anonymous key for very small use,
  // but it is heavily throttled. Sign up for a free key at
  // ocr.space/ocrapi to get the 25k/month allowance and set
  // OCR_SPACE_API_KEY in env. Falls back to "helloworld" when
  // unset so dev still works.
  const apiKey = process.env.OCR_SPACE_API_KEY ?? 'helloworld'

  let text = ''
  try {
    const form = new FormData()
    form.append('apikey', apiKey)
    form.append('language', 'eng')
    form.append('isOverlayRequired', 'false')
    form.append('detectOrientation', 'true')
    form.append('scale', 'true')
    // OCR engine 2 has better accuracy on mixed Arabic-English
    // structured docs like the mulkiya.
    form.append('OCREngine', '2')
    form.append('base64Image', `data:${mimeType};base64,${imageBase64}`)

    const res = await fetch(OCR_SPACE_URL, { method: 'POST', body: form })
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
    text = json.ParsedResults?.[0]?.ParsedText ?? ''
    if (!text.trim()) {
      console.warn('[extract-mulkiya] ocr.space returned empty text')
      return null
    }
  } catch (err) {
    console.error('[extract-mulkiya] ocr.space fetch failed', err)
    return null
  }

  return parseMulkiyaText(text)
}

// ─── parsers ────────────────────────────────────────────────────────

export function parseMulkiyaText(text: string): ExtractedMulkiya {
  const norm = text.replace(/ /g, ' ').replace(/\r/g, '')
  const upper = norm.toUpperCase()

  return {
    vehicle_make: findMake(norm),
    vehicle_model: findModel(norm),
    year: findYear(norm),
    plate_number: findPlateNumber(upper),
    plate_emirate: findEmirate(norm),
    vin: findVin(upper),
    expires_at: findExpiry(upper),
  }
}

// VIN: 17 alphanumeric chars, never I/O/Q (per ISO 3779). Search the
// full text for any 17-char run that looks like a VIN. False-positives
// are rare because the I/O/Q exclusion is hard for plate or random
// strings to satisfy.
function findVin(upper: string): string | null {
  const m = upper.match(/\b[A-HJ-NPR-Z0-9]{17}\b/)
  return m ? m[0] : null
}

// Year of manufacture. Mulkiya prints "Year" or "Model Year" in
// English near a 4-digit number 1980 to next-year. Pick the first
// plausible value.
function findYear(text: string): number | null {
  const nextYear = new Date().getFullYear() + 1
  const matches = text.match(/\b(19[89]\d|20\d{2})\b/g) ?? []
  for (const m of matches) {
    const n = Number(m)
    if (n >= 1980 && n <= nextYear) return n
  }
  return null
}

// Plate number: a 3 to 5 digit number near the words PLATE or LOUVRE
// or NO. Returns the digits only. If we cannot find a contextual
// match, fall back to the largest 3-5 digit number in the document
// that is not also a year.
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
  // Pick the longest run as the most likely plate.
  candidates.sort((a, b) => b.length - a.length)
  return candidates[0] ?? null
}

// Emirate: scan for any of the 7 emirate names, allowing common
// abbreviations and partial matches.
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

// Expiry date. Mulkiya prints expiry next to "EXP" or "VALID UNTIL"
// or sometimes just "EXPIRY DATE". Accept dd/mm/yyyy or dd-mm-yyyy
// or yyyy-mm-dd and normalise to ISO yyyy-mm-dd.
function findExpiry(upper: string): string | null {
  const contextual = upper.match(
    /(?:EXP(?:IRY)?(?:\s+DATE)?|VALID(?:\s+UNTIL)?|REG(?:ISTRATION)?\s+EXPIRES?)[^\d]{0,20}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  )
  const raw = contextual?.[1]
  if (!raw) return null
  return normaliseDate(raw)
}

function normaliseDate(raw: string): string | null {
  const m = raw.match(
    /^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/,
  )
  if (!m) return null
  const a = m[1]!
  const b = m[2]!
  const c = m[3]!
  // If first part is 4 digits, treat as yyyy-mm-dd; otherwise dd-mm-yyyy.
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

// Make: scan the OCR text for any curated make from car-data.ts.
// Return the canonical name (so "TOYOTA" or "toyota" both resolve to
// "Toyota"). Picks the longest match so "Land Rover" beats "Land".
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

// Model: only attempt once we have a make. Scan for any of the
// curated models under that make. Same longest-match priority.
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
