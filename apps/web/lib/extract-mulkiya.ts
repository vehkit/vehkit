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
  // ── vehicle identity ──
  vehicle_make: string | null
  vehicle_model: string | null
  year: number | null
  color: string | null
  body_type: string | null
  country_of_origin: string | null
  category: string | null
  fuel_type: string | null
  doors: number | null
  seats: number | null
  cylinders: number | null
  engine_number: string | null
  vin: string | null
  gross_weight_kg: number | null
  empty_weight_kg: number | null
  use_of_vehicle: string | null

  // ── registration ──
  plate_number: string | null
  plate_emirate: (typeof EMIRATES)[number] | null
  plate_type: string | null
  registration_date: string | null
  registration_authority: string | null
  mortgage_by: string | null
  expires_at: string | null

  // ── owner ──
  owner_name: string | null
  owner_nationality: string | null
  traffic_code_no: string | null

  // ── insurance ──
  insurance_company: string | null
  insurance_policy_number: string | null
  insurance_cover_type: string | null
  insurance_cover_plan: string | null
  insurance_commencement_at: string | null
  insurance_expires_at: string | null
  insurance_premium_aed: number | null
  insurance_insured_value_aed: number | null
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

  // Prefer OpenAI for structured parsing when a key is set. Reads the
  // document semantics rather than matching by adjacency.
  const openaiKey = process.env.OPENAI_API_KEY
  console.log(
    '[extract-mulkiya] openai key present?',
    !!openaiKey,
    'len',
    openaiKey?.length ?? 0,
  )
  if (openaiKey) {
    console.log('[extract-mulkiya] calling openai…')
    try {
      const llm = await parseWithOpenAI(text, openaiKey)
      if (llm) {
        console.log(
          '[extract-mulkiya] openai parse ok; fields populated:',
          Object.entries(llm).filter(([, v]) => v != null).length,
        )
        return validate(llm)
      }
      console.warn('[extract-mulkiya] openai returned null; falling back')
    } catch (err) {
      console.warn(
        '[extract-mulkiya] openai parse threw; falling back',
        (err as Error)?.message ?? err,
      )
    }
  } else {
    console.warn('[extract-mulkiya] no OPENAI_API_KEY in env; using regex')
  }
  return validate(parseMulkiyaText(text))
}

// ─── OpenAI structured parser ───────────────────────────────────────
// Sends the OCR plain text to gpt-4o-mini with response_format
// json_object. Cheap, accurate enough for UAE registration + insurance
// bundles, and survives the OCR reordering that breaks the regex
// parser.
async function parseWithOpenAI(
  text: string,
  apiKey: string,
): Promise<ExtractedMulkiya | null> {
  const model = process.env.OPENAI_EXTRACTION_MODEL ?? 'gpt-4o-mini'
  const schema = `{
    "vehicle_make": "string or null",
    "vehicle_model": "string or null",
    "year": "integer or null",
    "color": "string or null",
    "body_type": "string or null",
    "country_of_origin": "string or null",
    "category": "string or null",
    "fuel_type": "string or null",
    "doors": "integer or null",
    "seats": "integer or null",
    "cylinders": "integer or null",
    "engine_number": "string or null",
    "vin": "string or null (17 chars, no I/O/Q)",
    "gross_weight_kg": "integer or null",
    "empty_weight_kg": "integer or null",
    "use_of_vehicle": "string or null",
    "plate_number": "string or null (digits only)",
    "plate_emirate": "one of Dubai/Abu Dhabi/Sharjah/Ajman/Ras Al Khaimah/Fujairah/Umm Al Quwain, or null",
    "plate_type": "string or null",
    "registration_date": "ISO YYYY-MM-DD or null",
    "registration_authority": "string or null",
    "mortgage_by": "string or null (bank or finance company name)",
    "expires_at": "ISO YYYY-MM-DD or null (mulkiya/registration expiry)",
    "owner_name": "string or null",
    "owner_nationality": "string or null",
    "traffic_code_no": "string or null",
    "insurance_company": "string or null (insurer name)",
    "insurance_policy_number": "string or null",
    "insurance_cover_type": "string or null",
    "insurance_cover_plan": "string or null",
    "insurance_commencement_at": "ISO YYYY-MM-DD or null",
    "insurance_expires_at": "ISO YYYY-MM-DD or null",
    "insurance_premium_aed": "number or null",
    "insurance_insured_value_aed": "number or null"
  }`

  const system =
    'You extract structured fields from UAE Mulkiya / vehicle registration / insurance documents. Reply with ONLY a JSON object matching the requested schema. If a field is missing or uncertain, set null. Never put a header label like "Type Of Cover" or "Seating Capacity" as a value.'

  const user = `SCHEMA:\n${schema}\n\nDOCUMENT TEXT:\n"""\n${text}\n"""\n\nReturn the JSON object only.`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    console.error('[extract-mulkiya] openai http error', res.status, body)
    return null
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  const out = json.choices?.[0]?.message?.content ?? ''
  if (!out.trim()) {
    console.error('[extract-mulkiya] openai returned empty content')
    return null
  }
  try {
    return JSON.parse(out) as ExtractedMulkiya
  } catch (err) {
    console.error('[extract-mulkiya] openai JSON parse failed', err, out)
    return null
  }
}

// ─── value validators ───────────────────────────────────────────────
// Last-line defense. Any value that looks like a label (all-caps,
// contains the word OF / TYPE / NUMBER / NO / NAME) gets nulled out
// rather than displayed as a wrong autofill. Same for VIN, year,
// premium ranges, etc.
function validate(e: ExtractedMulkiya): ExtractedMulkiya {
  return {
    ...e,
    vehicle_make: cleanText(e.vehicle_make),
    vehicle_model: cleanText(e.vehicle_model),
    year: validYear(e.year),
    color: cleanColor(e.color),
    body_type: cleanText(e.body_type),
    country_of_origin: cleanText(e.country_of_origin),
    category: cleanText(e.category),
    fuel_type: cleanText(e.fuel_type),
    doors: clampInt(e.doors, 2, 6),
    seats: clampInt(e.seats, 1, 30),
    cylinders: clampInt(e.cylinders, 2, 16),
    engine_number: cleanCode(e.engine_number, 4, 25),
    vin: cleanVin(e.vin),
    gross_weight_kg: clampInt(e.gross_weight_kg, 200, 50_000),
    empty_weight_kg: clampInt(e.empty_weight_kg, 200, 50_000),
    use_of_vehicle: cleanText(e.use_of_vehicle),
    plate_number: cleanCode(e.plate_number, 1, 6),
    plate_type: cleanText(e.plate_type),
    registration_date: validIsoDate(e.registration_date),
    registration_authority: cleanText(e.registration_authority),
    mortgage_by: cleanText(e.mortgage_by),
    expires_at: validIsoDate(e.expires_at),
    owner_name: cleanText(e.owner_name),
    owner_nationality: cleanText(e.owner_nationality),
    traffic_code_no: cleanCode(e.traffic_code_no, 4, 12),
    insurance_company: cleanInsurer(e.insurance_company),
    insurance_policy_number: cleanCode(e.insurance_policy_number, 4, 25),
    insurance_cover_type: cleanText(e.insurance_cover_type),
    insurance_cover_plan: cleanText(e.insurance_cover_plan),
    insurance_commencement_at: validIsoDate(e.insurance_commencement_at),
    insurance_expires_at: validIsoDate(e.insurance_expires_at),
    insurance_premium_aed: clampNumber(e.insurance_premium_aed, 1, 1_000_000),
    insurance_insured_value_aed: clampNumber(
      e.insurance_insured_value_aed,
      1,
      100_000_000,
    ),
  }
}

const LABEL_TRAPS = [
  /^seating\s*capacity$/i,
  /^type\s*of\s*cover$/i,
  /^value\s*of\s*insured\s*vehicle$/i,
  /^motor\s*vehicle\s*insurance\s*certificate$/i,
  /^policy\s*(no|number)\.?$/i,
  /^document\s*number$/i,
  /^plate\s*number$/i,
  /^plate\s*type$/i,
  /^chassis\s*number$/i,
  /^engine\s*number$/i,
  /^body\s*type$/i,
  /^model\s*year$/i,
  /^country\s*of\s*origin$/i,
  /^number\s*of\s*passengers$/i,
  /^use\s*of\s*vehicle$/i,
  /^vehicle\s*registration$/i,
  /^vehicle\s*information$/i,
  /^owner\s*information$/i,
  /^insurance\s*plan\s*details$/i,
  /^tax\s*invoice$/i,
  /^cover\s*plan$/i,
  /^cover\s*type$/i,
  /^expiry\s*date$/i,
  /^commencement\s*date$/i,
  /^registration\s*date$/i,
  /^mortgage\s*by$/i,
  /^nationality$/i,
  /^address$/i,
]
function isLabelTrap(s: string): boolean {
  const trimmed = s.trim()
  if (!trimmed) return true
  return LABEL_TRAPS.some((re) => re.test(trimmed))
}
function cleanText(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.toString().trim().replace(/\s{2,}/g, ' ')
  if (!t) return null
  if (isLabelTrap(t)) return null
  return t
}
function cleanColor(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  const KNOWN = [
    'white', 'black', 'silver', 'grey', 'gray', 'beige', 'brown',
    'red', 'blue', 'green', 'gold', 'yellow', 'orange', 'maroon',
    'champagne', 'pearl', 'graphite',
  ]
  const lower = t.toLowerCase()
  return KNOWN.some((c) => lower.includes(c)) ? t : null
}
function cleanInsurer(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  // Reject if it looks like a doc title rather than a company name.
  if (/certificate|policy|document|invoice/i.test(t)) return null
  return t
}
function cleanCode(
  s: string | null | undefined,
  minLen: number,
  maxLen: number,
): string | null {
  const t = cleanText(s)
  if (!t) return null
  // Codes should be a single token of digits or alphanumerics.
  if (/\s/.test(t)) return null
  if (t.length < minLen || t.length > maxLen) return null
  return t
}
function cleanVin(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  if (!/^[A-HJ-NPR-Z0-9]{17}$/i.test(t)) return null
  return t.toUpperCase()
}
function validYear(n: number | null | undefined): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  const next = new Date().getFullYear() + 1
  if (n < 1980 || n > next) return null
  return Math.trunc(n)
}
function clampInt(
  n: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n < min || n > max) return null
  return Math.trunc(n)
}
function clampNumber(
  n: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (typeof n !== 'number' || !Number.isFinite(n)) return null
  if (n < min || n > max) return null
  return n
}
function validIsoDate(s: string | null | undefined): string | null {
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return s
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
    // vehicle
    vehicle_make: findMake(norm),
    vehicle_model: findModel(norm),
    year: findYear(norm),
    color: labelText(upper, ['COLOR', 'COLOUR'], '[A-Z][A-Z \\-]{2,20}'),
    body_type: labelText(upper, ['BODY\\s*TYPE'], '[A-Z0-9][A-Z0-9 \\-/]{1,30}'),
    country_of_origin: labelText(
      upper,
      ['COUNTRY\\s*OF\\s*ORIGIN', 'ORIGIN'],
      '[A-Z][A-Z \\-]{2,30}',
    ),
    category: labelText(upper, ['CATEGORY'], '[A-Z][A-Z \\-]{2,30}'),
    fuel_type: labelText(
      upper,
      ['FUEL\\s*TYPE', 'FUEL'],
      '[A-Z][A-Z \\-()]{2,30}',
    ),
    doors: labelNumber(upper, ['DOORS'], 2, 6),
    seats: labelNumber(upper, ['SEATS'], 1, 30),
    cylinders: findCylinders(upper),
    engine_number: findEngineNumber(upper),
    vin: findVin(upper),
    gross_weight_kg: labelNumber(
      upper,
      ['GROSS\\s*VEHICLE\\s*WEIGHT', 'GVW', 'GROSS\\s*WEIGHT'],
      200,
      50000,
    ),
    empty_weight_kg: labelNumber(
      upper,
      ['EMPTY\\s*WEIGHT', 'KERB\\s*WEIGHT', 'CURB\\s*WEIGHT', 'TARE\\s*WEIGHT'],
      200,
      50000,
    ),
    use_of_vehicle: labelText(
      upper,
      ['USE\\s*OF\\s*VEHICLE', 'VEHICLE\\s*USE'],
      '[A-Z][A-Z \\-]{2,30}',
    ),

    // registration
    plate_number: findPlateNumber(upper),
    plate_emirate: findEmirate(norm),
    plate_type: labelText(
      upper,
      ['PLATE\\s*TYPE'],
      '[A-Z][A-Z \\-]{2,30}',
    ),
    registration_date: labelDate(upper, [
      'REGISTRATION\\s*DATE',
      'REG(?:ISTRATION)?\\s*DT',
    ]),
    registration_authority: labelText(
      upper,
      ['REGISTRATION\\s*AUTHORITY', 'AUTHORITY'],
      '[A-Z][A-Z \\-]{2,40}',
    ),
    mortgage_by: labelText(
      upper,
      ['MORTGAGE\\s*BY', 'MORTGAGED\\s*BY', 'MORTGAGE'],
      '[A-Z0-9][A-Z0-9 .,&\\-]{2,60}',
    ),
    expires_at: findExpiry(upper),

    // owner
    owner_name: labelText(
      upper,
      ['OWNER\\s*NAME'],
      '[A-Z][A-Z .\\-]{4,80}',
    ),
    owner_nationality: labelText(
      upper,
      ['NATIONALITY'],
      '[A-Z][A-Z \\-]{2,30}',
    ),
    traffic_code_no: labelText(
      upper,
      ['TRAFFIC\\s*CODE(?:\\s*NO\\.?|\\s*NUMBER)?'],
      '[0-9]{4,12}',
    ),

    // insurance
    insurance_company: labelText(
      upper,
      ['INSURANCE\\s*COMPANY', 'INSURER'],
      '[A-Z0-9][A-Z0-9 .,()&\\-]{2,80}',
    ),
    insurance_policy_number: labelText(
      upper,
      ['POLICY\\s*NUMBER', 'POLICY\\s*NO\\.?'],
      '[A-Z0-9][A-Z0-9 \\-/]{3,30}',
    ),
    insurance_cover_type: labelText(
      upper,
      ['COVER\\s*TYPE'],
      '[A-Z][A-Z \\-]{2,40}',
    ),
    insurance_cover_plan: labelText(
      upper,
      ['COVER\\s*PLAN'],
      '[A-Z][A-Z 0-9()\\-]{2,60}',
    ),
    insurance_commencement_at: labelDate(upper, [
      'COMMENCEMENT\\s*DATE',
      'POLICY\\s*START',
      'START\\s*DATE',
    ]),
    insurance_expires_at: findInsuranceExpiry(upper),
    insurance_premium_aed: labelAed(upper, [
      'TOTAL\\s*PAID',
      'TOTAL\\s*PREMIUM',
      'PREMIUM',
    ]),
    insurance_insured_value_aed: labelAed(upper, [
      'INSURED\\s*VALUE',
      'VEHICLE\\s*INSURED\\s*VALUE',
      'SUM\\s*INSURED',
    ]),
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

// ─── generic label-keyed extractors ────────────────────────────────
// UAE registration + insurance documents are highly structured. Every
// field has a clear label like "OWNER NAME:" followed by the value.
// These three helpers pick a value by label keyword.

function labelText(
  upper: string,
  labels: string[],
  valuePattern: string,
): string | null {
  const re = new RegExp(
    `(?:${labels.join('|')})\\s*[:.\\-]*\\s*(${valuePattern})`,
    'i',
  )
  const m = upper.match(re)
  const raw = m?.[1]
  if (!raw) return null
  return titleCase(raw.trim().replace(/\s{2,}/g, ' '))
}

function labelNumber(
  upper: string,
  labels: string[],
  min: number,
  max: number,
): number | null {
  const re = new RegExp(
    `(?:${labels.join('|')})\\s*[:.\\-]*\\s*(\\d{1,7})`,
    'i',
  )
  const m = upper.match(re)
  if (!m?.[1]) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < min || n > max) return null
  return n
}

function labelDate(upper: string, labels: string[]): string | null {
  const re = new RegExp(
    `(?:${labels.join('|')})\\s*[:.\\-]*\\s*(\\d{1,2}[\\/\\-\\.A-Z]{1,5}\\d{1,2}[\\/\\-\\.A-Z]{1,5}\\d{2,4}|\\d{4}[\\/\\-\\.]\\d{1,2}[\\/\\-\\.]\\d{1,2})`,
    'i',
  )
  const m = upper.match(re)
  const raw = m?.[1]
  if (!raw) return null
  // Try ISO format first.
  const iso = normaliseDate(raw)
  if (iso) return iso
  // Try DD-Mon-YYYY (e.g. "06-DEC-2024").
  const monthMatch = raw.match(
    /^(\d{1,2})[\\-\\.\\/](JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)[\\-\\.\\/](\d{2,4})$/i,
  )
  if (monthMatch) {
    const dd = Number(monthMatch[1])
    const mm = MONTH_MAP[monthMatch[2]!.toUpperCase()]
    let yyyy = Number(monthMatch[3])
    if (yyyy < 100) yyyy += 2000
    if (mm && dd >= 1 && dd <= 31 && yyyy >= 1980 && yyyy <= 2099) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
  }
  return null
}

function labelAed(upper: string, labels: string[]): number | null {
  // Match AED amounts like "AED 1,984.50" or "1,984.50 AED" near a label.
  const re = new RegExp(
    `(?:${labels.join('|')})\\s*[:.\\-]*\\s*(?:AED\\s*)?([0-9][0-9,]{0,10}(?:\\.[0-9]{1,2})?)`,
    'i',
  )
  const m = upper.match(re)
  if (!m?.[1]) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return null
  return n
}

function titleCase(s: string): string {
  // Convert SHOUTY label values to Title Case for nicer display.
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

const MONTH_MAP: Record<string, number> = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12,
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
