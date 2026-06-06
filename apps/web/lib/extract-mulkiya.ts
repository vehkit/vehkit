/**
 * Mulkiya field extraction.
 *
 * Pipeline (chooses one at runtime):
 *   1. If OPENAI_API_KEY is set: send the image straight to GPT-4o
 *      vision. Skips OCR entirely. Best accuracy on UAE registration +
 *      insurance bundles. ~$0.003/doc.
 *   2. Otherwise: OCR.space (free) for text + regex parsing.
 *
 * Validators (cleanColor, cleanInsurer, cleanVin, ...) sit at the end
 * of both paths to null out any value that looks like a label or
 * fails a basic shape check.
 *
 * Public surface: documents.ts calls extractMulkiyaFromImage with an
 * array of { base64, mimeType } images so the vision call can see both
 * sides of a Dubai mulkiya (front carries vehicle identity, back carries
 * owner + technical specs).
 */

import sharp from 'sharp'
import { MAKES, MODELS_BY_MAKE } from '@/lib/car-data'

const OCR_SPACE_URL = 'https://api.ocr.space/parse/image'
const REQUEST_TIMEOUT_MS = 30_000
const RETRY_ATTEMPTS = 2
const TARGET_MAX_BYTES = 950_000 // OCR.space free-key cap
const VISION_MAX_WIDTH = 2000 // resize down for token cost
const VISION_TARGET_MAX_BYTES = 4_000_000 // ~4 MB ceiling for vision input

const EMIRATES = [
  'Dubai',
  'Abu Dhabi',
  'Sharjah',
  'Ajman',
  'Ras Al Khaimah',
  'Fujairah',
  'Umm Al Quwain',
] as const

// The detected document type the model returns. Keep this list close
// to the human-facing categories the UI will eventually surface; new
// types should be appended, never reordered, so DB rows stay readable.
export type DetectedDocType =
  | 'mulkiya'
  | 'insurance_certificate'
  | 'insurance_policy_schedule'
  | 'driving_licence'
  | 'noc'
  | 'pollution_test'
  | 'rta_passing_certificate'
  | 'service_invoice'
  | 'service_history'
  | 'salik_statement'
  | 'fine_receipt'
  | 'other'

export type ExtractedMulkiya = {
  // ── document classification ──
  detected_doc_type: DetectedDocType | null
  detected_doc_confidence: number | null // 0–1
  document_number: string | null // any official ref number on the doc

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

export type MulkiyaImageInput = { base64: string; mimeType: string }

/**
 * Accepts ONE OR MANY images for a single logical document. Dubai mulkiya
 * is two-sided — front (vehicle + reg) and back (owner + tech specs). To
 * fill all fields we send both sides to vision in one call so it can
 * correlate them. Single-image callers can still pass a one-element array.
 */
export async function extractMulkiyaFromImage(
  images: MulkiyaImageInput[],
): Promise<ExtractedMulkiya | null> {
  if (process.env.EXTRACTION_ENABLED === 'false') {
    console.log('[extract-mulkiya] EXTRACTION_ENABLED=false; skipping')
    return null
  }
  if (images.length === 0) {
    console.error('[extract-mulkiya] no images supplied')
    return null
  }

  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    console.error(
      '[extract-mulkiya] vision path entered; image count=',
      images.length,
      'first mime=',
      images[0]?.mimeType,
    )
    try {
      const llm = await parseImagesWithVision(images, openaiKey)
      if (llm) {
        const populated = Object.entries(llm).filter(([, v]) => v != null)
        console.error(
          '[extract-mulkiya] vision parse ok; populated count=',
          populated.length,
          'fields=',
          populated.map(([k]) => k).join(','),
        )
        const validated = validate(llm)
        const survived = Object.entries(validated).filter(([, v]) => v != null)
        console.error(
          '[extract-mulkiya] post-validate populated=',
          survived.length,
          'fields=',
          survived.map(([k]) => k).join(','),
        )
        return validated
      }
      console.error('[extract-mulkiya] vision returned null; falling back to OCR')
    } catch (err) {
      console.error(
        '[extract-mulkiya] vision threw; falling back to OCR. message=',
        (err as Error)?.message ?? err,
        'stack=',
        (err as Error)?.stack ?? 'n/a',
      )
    }
  } else {
    console.error('[extract-mulkiya] OPENAI_API_KEY missing; using OCR path')
  }

  // OCR fallback. Only the primary image — OCR.space doesn't accept
  // multi-image input, and the front of the mulkiya carries enough for
  // a salvage-grade extraction when vision is unavailable.
  const primary = images[0]!
  return extractViaOcr(primary.base64, primary.mimeType)
}

// ─── vision path ────────────────────────────────────────────────────

async function compressOneForVision(imageBase64: string): Promise<Buffer | null> {
  try {
    const raw = Buffer.from(imageBase64, 'base64')
    let bytes = await sharp(raw, { failOn: 'none' })
      .rotate()
      .resize({ width: VISION_MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: 85, mozjpeg: true })
      .toBuffer()
    if (bytes.byteLength > VISION_TARGET_MAX_BYTES) {
      bytes = await sharp(raw, { failOn: 'none' })
        .rotate()
        .resize({ width: 1600, withoutEnlargement: true })
        .jpeg({ quality: 75, mozjpeg: true })
        .toBuffer()
    }
    return bytes
  } catch (err) {
    console.error(
      '[extract-mulkiya] compressOneForVision failed. message=',
      (err as Error)?.message ?? err,
    )
    return null
  }
}

async function parseImagesWithVision(
  images: MulkiyaImageInput[],
  apiKey: string,
): Promise<ExtractedMulkiya | null> {
  console.error(
    '[extract-mulkiya] parseImagesWithVision: enter; image count=',
    images.length,
  )

  // Compress each image in parallel. Drop any that fail compression
  // rather than aborting — better to extract from 1 page than 0.
  const compressed = await Promise.all(
    images.map((img) => compressOneForVision(img.base64)),
  )
  const dataUrls: string[] = []
  for (let i = 0; i < compressed.length; i++) {
    const buf = compressed[i]
    if (!buf) {
      console.error('[extract-mulkiya] image', i, 'failed to compress; skipping')
      continue
    }
    console.error(
      '[extract-mulkiya] image',
      i,
      'compressed bytes=',
      buf.byteLength,
    )
    dataUrls.push(`data:image/jpeg;base64,${buf.toString('base64')}`)
  }
  if (dataUrls.length === 0) {
    console.error('[extract-mulkiya] no images survived compression')
    return null
  }

  const model = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o'
  console.error(
    '[extract-mulkiya] vision model=',
    model,
    'images going to vision=',
    dataUrls.length,
  )

  const schema = `{
  "detected_doc_type": "one of: mulkiya | insurance_certificate | insurance_policy_schedule | driving_licence | noc | pollution_test | rta_passing_certificate | service_invoice | service_history | salik_statement | fine_receipt | other",
  "detected_doc_confidence": "number between 0 and 1",
  "document_number": "string | null (any official reference / certificate number printed on the doc)",
  "vehicle_make": "string | null",
  "vehicle_model": "string | null",
  "year": "integer | null",
  "color": "string | null",
  "body_type": "string | null",
  "country_of_origin": "string | null",
  "category": "string | null",
  "fuel_type": "string | null",
  "doors": "integer | null",
  "seats": "integer | null",
  "cylinders": "integer | null",
  "engine_number": "string | null",
  "vin": "string | null (17 chars; no I, O, Q)",
  "gross_weight_kg": "integer | null",
  "empty_weight_kg": "integer | null",
  "use_of_vehicle": "string | null",
  "plate_number": "string | null (digits only)",
  "plate_emirate": "one of Dubai/Abu Dhabi/Sharjah/Ajman/Ras Al Khaimah/Fujairah/Umm Al Quwain or null",
  "plate_type": "string | null",
  "registration_date": "ISO YYYY-MM-DD | null",
  "registration_authority": "string | null",
  "mortgage_by": "string | null (bank or finance company that holds the mortgage)",
  "expires_at": "ISO YYYY-MM-DD | null (MULKIYA / REGISTRATION expiry, NOT insurance)",
  "owner_name": "string | null",
  "owner_nationality": "string | null",
  "traffic_code_no": "string | null",
  "insurance_company": "string | null (insurer name e.g. 'Qatar Insurance Company')",
  "insurance_policy_number": "string | null",
  "insurance_cover_type": "string | null (e.g. 'Comprehensive')",
  "insurance_cover_plan": "string | null (e.g. 'Prestige Plus')",
  "insurance_commencement_at": "ISO YYYY-MM-DD | null (insurance START date)",
  "insurance_expires_at": "ISO YYYY-MM-DD | null (insurance EXPIRY date)",
  "insurance_premium_aed": "number | null",
  "insurance_insured_value_aed": "number | null"
}`

  const system = `You read UAE vehicle documents and extract structured fields.

FIRST: classify what you are looking at. Possible types include the Mulkiya / RTA Vehicle Possession Certificate, Motor Vehicle Insurance Certificate, Insurance Policy Schedule, Driving Licence, NOC, Pollution Test, RTA Passing Certificate, Service Invoice, Service History PDF, Salik Statement, Fine Receipt, or other. Set detected_doc_type to the best match. Use 'other' only as a last resort. Express your confidence as detected_doc_confidence between 0 and 1.

THEN: extract every field from the schema that the document(s) contain. Not every field is relevant to every document type — fill what you can read, return null for the rest. NEVER invent a value.

You will be given ONE OR MORE images that together form a single logical document. Dubai mulkiya is two-sided: the front shows vehicle identity + registration; the back shows owner + technical specs (body type, color, cylinders, doors, seats, engine no.). Read every image carefully and merge fields across them.

The document is laid out in sections. Match each field to the value in its correct section. Do not guess.

Critical rules:
- expires_at is the MULKIYA / REGISTRATION expiry only. If the document is purely an insurance certificate without a registration expiry, leave it null.
- insurance_commencement_at is the policy START date.
- insurance_expires_at is the policy EXPIRY date. Never swap with commencement.
- registration_date is when the vehicle was first registered, not insurance dates.
- mortgage_by is a bank or finance company name (e.g. "Emirates NBD Bank").
- owner_name is the full name printed next to "Owner" or "Name" — not a transliteration of the issuing authority.
- color and body_type usually appear on the BACK of the mulkiya. Look across all images.
- document_number is any printed reference / certificate / policy number on the doc.
- For any field where you cannot read the value clearly, return null. Do NOT use a section heading or label like "Type Of Cover", "Seating Capacity", "Motor Vehicle Insurance Certificate" as a value.

Return ONLY a JSON object matching the schema. No prose, no markdown fences.`

  const user = `Extract these fields from the document. Use information from ALL attached images. If a field appears on one image, use it; if it appears on multiple, prefer the clearer reading.

SCHEMA:
${schema}`

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS)

  try {
    console.error('[extract-mulkiya] calling OpenAI chat completions...')
    const t0 = Date.now()
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: user },
              ...dataUrls.map((url) => ({
                type: 'image_url' as const,
                image_url: { url, detail: 'high' as const },
              })),
            ],
          },
        ],
      }),
    })
    console.error(
      '[extract-mulkiya] OpenAI responded in',
      Date.now() - t0,
      'ms; status=',
      res.status,
    )

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      console.error('[extract-mulkiya] vision http error', res.status, body)
      return null
    }
    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>
      usage?: { prompt_tokens?: number; completion_tokens?: number }
      model?: string
    }
    if (json.usage) {
      console.error(
        '[extract-mulkiya] vision tokens in/out=',
        json.usage.prompt_tokens,
        '/',
        json.usage.completion_tokens,
        'reported model=',
        json.model,
      )
    }
    const out = json.choices?.[0]?.message?.content ?? ''
    console.error(
      '[extract-mulkiya] vision raw content (first 800 chars)=',
      out.slice(0, 800),
    )
    if (!out.trim()) {
      console.error('[extract-mulkiya] vision returned empty content')
      return null
    }
    try {
      return JSON.parse(out) as ExtractedMulkiya
    } catch (err) {
      console.error('[extract-mulkiya] vision JSON parse failed', err, out)
      return null
    }
  } finally {
    clearTimeout(timer)
  }
}

// ─── OCR fallback path ──────────────────────────────────────────────

async function extractViaOcr(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedMulkiya | null> {
  const apiKey = process.env.OCR_SPACE_API_KEY ?? 'helloworld'

  let compressed: Buffer
  try {
    const raw = Buffer.from(imageBase64, 'base64')
    compressed = await compressForOcr(raw, mimeType)
  } catch (err) {
    console.error('[extract-mulkiya] OCR compression failed', err)
    return null
  }
  console.log('[extract-mulkiya] OCR compressed bytes', compressed.byteLength)

  const text = await postToOcrSpaceWithRetry(compressed, apiKey)
  if (!text) return null
  console.log(
    '[extract-mulkiya] OCR text length',
    text.length,
    'preview:',
    text.slice(0, 600).replace(/\s+/g, ' '),
  )

  return validate(parseMulkiyaText(text))
}

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
        '[extract-mulkiya] OCR attempt',
        attempt,
        'failed',
        (err as Error)?.message ?? err,
      )
    }
  }
  console.error('[extract-mulkiya] OCR all attempts failed', lastErr)
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
      console.error('[extract-mulkiya] OCR http error', res.status, body)
      return null
    }
    const json = (await res.json()) as {
      ParsedResults?: Array<{ ParsedText?: string; ErrorMessage?: string }>
      IsErroredOnProcessing?: boolean
      ErrorMessage?: string | string[]
    }
    if (json.IsErroredOnProcessing) {
      console.error('[extract-mulkiya] OCR error', json.ErrorMessage)
      return null
    }
    const text = json.ParsedResults?.[0]?.ParsedText ?? ''
    if (!text.trim()) {
      console.warn('[extract-mulkiya] OCR returned empty text')
      return null
    }
    return text
  } finally {
    clearTimeout(timer)
  }
}

async function compressForOcr(raw: Buffer, _mimeType: string): Promise<Buffer> {
  const widths = [1600, 1400, 1200, 1000]
  for (const width of widths) {
    const out = await sharp(raw, { failOn: 'none' })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer()
    if (out.byteLength <= TARGET_MAX_BYTES) return out
  }
  return sharp(raw, { failOn: 'none' })
    .rotate()
    .resize({ width: 900, withoutEnlargement: true })
    .jpeg({ quality: 60, mozjpeg: true })
    .toBuffer()
}

// ─── regex parser (legacy fallback when no LLM key) ─────────────────

export function parseMulkiyaText(text: string): ExtractedMulkiya {
  const norm = text.replace(/ /g, ' ').replace(/\r/g, '')
  const upper = norm.toUpperCase()

  return {
    // The regex fallback can't reliably tell what kind of doc this is —
    // it sees a stream of UPPERCASE tokens. Leave classification to the
    // vision path; here we just emit nulls.
    detected_doc_type: null,
    detected_doc_confidence: null,
    document_number: null,
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
    plate_number: findPlateNumber(upper),
    plate_emirate: findEmirate(norm),
    plate_type: labelText(upper, ['PLATE\\s*TYPE'], '[A-Z][A-Z \\-]{2,30}'),
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
    owner_name: labelText(upper, ['OWNER\\s*NAME'], '[A-Z][A-Z .\\-]{4,80}'),
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

// ─── generic label-keyed extractors ────────────────────────────────

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
  const iso = normaliseDate(raw)
  if (iso) return iso
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
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase())
}

const MONTH_MAP: Record<string, number> = {
  JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
  JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12,
}

function findInsuranceExpiry(upper: string): string | null {
  const m = upper.match(
    /(?:INS(?:URANCE)?(?:\s+EXP(?:IRY)?)?(?:\s+DATE)?|POLICY\s+EXP(?:IRY)?)[^\d]{0,20}(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2})/,
  )
  const raw = m?.[1]
  if (!raw) return null
  return normaliseDate(raw)
}

function findEngineNumber(upper: string): string | null {
  const m = upper.match(
    /(?:ENGINE\s*(?:NO|NUMBER|#)|MOTOR\s*NO)[^A-Z0-9]{0,8}([A-Z0-9]{6,20})/,
  )
  return m?.[1] ?? null
}

function findCylinders(upper: string): number | null {
  const m = upper.match(
    /(?:NO\.?\s*OF\s*)?CYL(?:INDERS)?[^\d]{0,10}(\d{1,2})/,
  )
  if (!m || !m[1]) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 2 || n > 16) return null
  return n
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

// ─── value validators ───────────────────────────────────────────────

function validate(e: ExtractedMulkiya): ExtractedMulkiya {
  // Sanity: a real insurance policy has commencement < expiry. If both
  // are the same or commencement > expiry, the reader confused them — drop
  // commencement (we'd rather show nothing than mislead the user about
  // their cover window).
  let commencement = e.insurance_commencement_at
  let expires = e.insurance_expires_at
  if (commencement && expires) {
    const c = new Date(commencement).getTime()
    const x = new Date(expires).getTime()
    if (!Number.isFinite(c) || !Number.isFinite(x) || c >= x) {
      console.error(
        '[extract-mulkiya] insurance dates invalid (commencement >= expires); nulling commencement. c=',
        commencement,
        'x=',
        expires,
      )
      commencement = null
    }
  }
  return {
    ...e,
    detected_doc_type: cleanDocType(e.detected_doc_type),
    detected_doc_confidence: clampNumber(e.detected_doc_confidence, 0, 1),
    document_number: cleanCode(e.document_number, 3, 40),
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
    insurance_commencement_at: validIsoDate(commencement),
    insurance_expires_at: validIsoDate(expires),
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
const ALLOWED_DETECTED_DOC_TYPES: ReadonlySet<DetectedDocType> = new Set<
  DetectedDocType
>([
  'mulkiya',
  'insurance_certificate',
  'insurance_policy_schedule',
  'driving_licence',
  'noc',
  'pollution_test',
  'rta_passing_certificate',
  'service_invoice',
  'service_history',
  'salik_statement',
  'fine_receipt',
  'other',
])
function cleanDocType(
  s: DetectedDocType | string | null | undefined,
): DetectedDocType | null {
  if (!s) return null
  const t = s.toString().trim().toLowerCase() as DetectedDocType
  if (!ALLOWED_DETECTED_DOC_TYPES.has(t)) return null
  return t
}
function cleanText(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.toString().trim().replace(/\s{2,}/g, ' ')
  if (!t) return null
  if (isLabelTrap(t)) return null
  return t
}
function cleanColor(s: string | null | undefined): string | null {
  return cleanText(s)
}
function cleanInsurer(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  if (/^(motor\s+vehicle\s+)?insurance\s+certificate$/i.test(t)) return null
  return t
}
function cleanCode(
  s: string | null | undefined,
  minLen: number,
  maxLen: number,
): string | null {
  const t = cleanText(s)
  if (!t) return null
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
