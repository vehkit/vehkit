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
  /** All doc types detected across a multi-file bundle. Set by
   *  mergeExtractions; single-file extractions may omit it. This is
   *  what lets a 5-file upload credit mulkiya AND insurance AND
   *  passing instead of just whichever file happened to be first. */
  detected_doc_types?: DetectedDocType[]
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

// Field-level allowlist: when the user uploads a bundle (e.g. mulkiya
// + insurance + passing), each document is authoritative for different
// fields. For each field we list the doc types that are CREDIBLE
// sources of that value, in priority order. Anything not on the list
// is rejected — even if a stray vision call returns a value, we don't
// trust it.
//
// This prevents the classic failure where an insurance schedule's
// barcode "784-1994-3284753-3" gets parsed as plate_number=784, or
// "1984.5" (the premium amount inside a chassis-no concatenation) gets
// parsed as year=1984. Identity fields ONLY come from documents that
// physically carry that identity.
const FIELD_PRIORITY: Partial<
  Record<keyof ExtractedMulkiya, ReadonlyArray<DetectedDocType>>
> = {
  // Vehicle identity — mulkiya is the source of truth. Passing report
  // is RTA-issued and carries the same data. Insurance certificates
  // are derived (and often badly transcribed); we don't trust them
  // for identity but they're allowed as a last resort.
  vehicle_make: ['mulkiya', 'rta_passing_certificate', 'insurance_certificate', 'insurance_policy_schedule'],
  vehicle_model: ['mulkiya', 'rta_passing_certificate', 'insurance_certificate', 'insurance_policy_schedule'],
  // Year priority: insurance certificate FIRST. The QIC-style cert has
  // a clean "Year of Manufacture" field that the model reads reliably.
  // Passing reports also have year but are easily confused with test
  // date (e.g. "27 NOV 2024" → year=2024). Mulkiya is excluded — it
  // shows Reg Date, not Year of Manufacture, and the model hallucinates
  // years when forced to extract one (2024+2 = 2026, etc.). Policy
  // schedule is excluded because of barcode noise ("...-113000-1984.5").
  year: ['insurance_certificate', 'rta_passing_certificate'],
  vin: ['mulkiya', 'rta_passing_certificate', 'insurance_certificate'],
  engine_number: ['mulkiya', 'rta_passing_certificate', 'insurance_certificate'],

  // Technical specs — RTA passing report is the gold standard. Mulkiya
  // back has these too. Insurance schedules sometimes have garbled
  // versions; we don't include them.
  color: ['rta_passing_certificate', 'mulkiya'],
  body_type: ['rta_passing_certificate', 'mulkiya', 'insurance_certificate'],
  cylinders: ['rta_passing_certificate', 'mulkiya'],
  doors: ['rta_passing_certificate', 'mulkiya'],
  seats: ['mulkiya', 'insurance_certificate', 'rta_passing_certificate'],
  fuel_type: ['rta_passing_certificate', 'mulkiya'],
  country_of_origin: ['mulkiya'],
  category: ['mulkiya'],
  gross_weight_kg: ['mulkiya', 'rta_passing_certificate'],
  empty_weight_kg: ['mulkiya', 'rta_passing_certificate'],
  use_of_vehicle: ['mulkiya', 'rta_passing_certificate'],

  // Registration — only the mulkiya / passing carry this. We REFUSE
  // to read plate_number from an insurance certificate barcode.
  plate_number: ['mulkiya', 'rta_passing_certificate'],
  plate_emirate: ['mulkiya', 'rta_passing_certificate'],
  plate_type: ['mulkiya', 'rta_passing_certificate'],
  registration_date: ['mulkiya'],
  registration_authority: ['mulkiya'],
  mortgage_by: ['mulkiya', 'insurance_certificate'],
  expires_at: ['mulkiya'],

  // Owner — mulkiya is the legal owner record. Insurance carries the
  // insured name which may match but is rejected as a primary source
  // (a leaseholder is not always the owner).
  owner_name: ['mulkiya', 'insurance_certificate'],
  owner_nationality: ['mulkiya'],
  traffic_code_no: ['mulkiya'],

  // Insurance — the policy schedule is the definitive source. The
  // certificate is a summary; the schedule has full premium + cover.
  insurance_company: ['insurance_policy_schedule', 'insurance_certificate', 'mulkiya'],
  insurance_policy_number: ['insurance_policy_schedule', 'insurance_certificate', 'mulkiya'],
  insurance_cover_type: ['insurance_policy_schedule', 'insurance_certificate'],
  insurance_cover_plan: ['insurance_policy_schedule', 'insurance_certificate'],
  insurance_commencement_at: ['insurance_policy_schedule', 'insurance_certificate'],
  insurance_expires_at: ['insurance_policy_schedule', 'insurance_certificate', 'mulkiya'],
  insurance_premium_aed: ['insurance_policy_schedule', 'insurance_certificate'],
  insurance_insured_value_aed: ['insurance_policy_schedule', 'insurance_certificate'],
}

// Fields where cross-doc contamination is so common that we refuse to
// accept values from outside the priority list. These are the values
// most likely to leak in from barcodes or table-header misreads.
const STRICT_FIELDS: ReadonlySet<keyof ExtractedMulkiya> = new Set([
  'plate_number',
  'plate_emirate',
  'plate_type',
  'color',
  'year',
  // Expiry dates must come from their authoritative doc ONLY. Without
  // this, an unclassified bundle lets the insurance policy's expiry
  // become the registration expiry ("Mulkiya expires Feb 2027" when
  // the mulkiya actually expires Jan 2027) — exactly the kind of
  // wrong-by-one-month error that gets a user fined.
  'expires_at',
  'insurance_expires_at',
  'registration_date',
])

/**
 * Heuristic classifier. Runs after the model returns, before the merge.
 * If the model didn't classify (detected_doc_type=null) — which happens
 * when it's uncertain — we infer the type from the shape of the
 * extracted fields. This restores the priority allowlist's gatekeeping
 * power even on bundles where the model went conservative.
 */
export function inferDocTypeFromShape(
  e: ExtractedMulkiya,
): DetectedDocType | null {
  if (e.detected_doc_type) return e.detected_doc_type

  // Mulkiya markers: legal owner fields, traffic code, mortgage. The
  // only doc that carries these together.
  if (e.owner_name || e.owner_nationality || e.traffic_code_no || e.mortgage_by) {
    return 'mulkiya'
  }

  // Insurance schedule: full vehicle spec table (cylinders + use_of_vehicle)
  // AND insurance amounts. The schedule is the only doc with both.
  if (
    (e.insurance_premium_aed || e.insurance_insured_value_aed) &&
    (e.cylinders || e.use_of_vehicle)
  ) {
    return 'insurance_policy_schedule'
  }

  // Insurance certificate: insurance fields but no full spec table.
  if (e.insurance_company || e.insurance_policy_number || e.insurance_expires_at) {
    return 'insurance_certificate'
  }

  // RTA passing: vehicle specs (cylinders/fuel/use) but no insurance,
  // no owner.
  if (e.cylinders || e.fuel_type || e.use_of_vehicle) {
    return 'rta_passing_certificate'
  }

  return null
}

/**
 * Merge N per-file extraction results into a single consolidated record.
 *
 * Two-pass algorithm:
 *   1. STRICT pass — every field that has a priority list pulls only
 *      from documents whose detected_doc_type is on that list. This
 *      catches the easy wins (mulkiya plate, passing color, etc.).
 *   2. PERMISSIVE pass — for fields still null after pass 1, accept
 *      a value from ANY extraction (validators have already run, so
 *      bad shapes are already nulled). Skipped for STRICT_FIELDS —
 *      those stay null rather than risk pulling a barcode fragment
 *      from an insurance certificate.
 *
 * detected_doc_type / detected_doc_confidence on the merged record
 * inherit from the first extraction — those describe individual docs,
 * not a bundle, so they're informational only.
 */
export function mergeExtractions(
  results: ExtractedMulkiya[],
): ExtractedMulkiya | null {
  if (results.length === 0) return null

  // Backfill detected_doc_type from field shape for any extraction
  // where the model returned null. The priority allowlist depends on
  // this — without it, every STRICT field stays empty.
  const inferred: ExtractedMulkiya[] = results.map((r) => ({
    ...r,
    detected_doc_type: r.detected_doc_type ?? inferDocTypeFromShape(r),
  }))
  const out = { ...inferred[0]! }

  // Preserve EVERY per-file classification on the merged record. The
  // single detected_doc_type only describes the first file; without
  // this list, a bundle containing mulkiya + insurance + passing
  // credits exactly one of them downstream (UVTS, labels, reminders).
  out.detected_doc_types = Array.from(
    new Set(
      inferred
        .map((r) => r.detected_doc_type)
        .filter((t): t is DetectedDocType => t != null && t !== 'other'),
    ),
  )

  for (const field of Object.keys(out) as Array<keyof ExtractedMulkiya>) {
    if (
      field === 'detected_doc_type' ||
      field === 'detected_doc_confidence' ||
      field === 'detected_doc_types'
    ) {
      continue
    }
    const allowed = FIELD_PRIORITY[field]

    // Pass 1: strict — priority-listed doc types only.
    let resolved: unknown = null
    if (allowed) {
      for (const wantedType of allowed) {
        const candidate = inferred.find(
          (r) => r.detected_doc_type === wantedType && r[field] != null,
        )
        if (candidate) {
          resolved = candidate[field]
          break
        }
      }
    }

    // Pass 2: permissive — first non-null from any doc, BUT only for
    // fields where contamination is unlikely. STRICT_FIELDS stay null
    // if the priority pass didn't find them.
    if (resolved == null && !STRICT_FIELDS.has(field)) {
      const found = inferred.find((r) => r[field] != null)
      if (found) resolved = found[field]
    }

    ;(out as Record<string, unknown>)[field] = resolved
  }
  return out
}

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
  "detected_doc_type": "REQUIRED. NEVER null. MUST be exactly one of these snake_case strings: mulkiya, insurance_certificate, insurance_policy_schedule, driving_licence, noc, pollution_test, rta_passing_certificate, service_invoice, service_history, salik_statement, fine_receipt, other. If you cannot tell, return 'other'.",
  "detected_doc_confidence": "REQUIRED. Number between 0 and 1. Use 0.9+ if you are certain, 0.5-0.7 if reasonably sure, 0.0-0.3 if guessing.",
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
- UAE documents use DD/MM/YYYY format. "04/01/2026" means 4 January 2026 (ISO: 2026-01-04), NOT 1 April 2026. "03/02/2027" means 3 February 2027 (ISO: 2027-02-03).
- expires_at is the MULKIYA / REGISTRATION expiry ONLY. It is the "Exp. Date" / "تاريخ الانتهاء" on a Vehicle License card. If the document is an insurance certificate, expires_at MUST be null — the insurance certificate has NO mulkiya expiry; do not borrow the insurance expiry into this field.
- On a UAE Vehicle License card, "Ins. Exp" / "إنتهاء التأمين" is the INSURANCE expiry (goes in insurance_expires_at), NOT the registration expiry. The registration expiry is on a different line labelled "Exp. Date" / "تاريخ الانتهاء". If the card only shows "Ins. Exp" and not a clearly labelled "Exp. Date", set expires_at to null — do NOT copy the Ins. Exp value into expires_at.
- On a mulkiya, do NOT extract year of manufacture. Mulkiyas show "Reg. Date" (when the car was first registered) but they do NOT show the model year directly. If you only see a mulkiya, return year=null. Year of manufacture comes from insurance certificates and RTA passing reports only.
- INSURANCE DATES — READ BOTH. Every UAE insurance certificate has exactly TWO date fields, listed on separate lines, and YOU MUST EXTRACT BOTH:
    FIELD ONE: "Commencement date of Insurance" (or "Period of Insurance From", or "Policy Start Date") → put in insurance_commencement_at.
    FIELD TWO: "Expiry Date Of Insurance" (or "Period of Insurance To", or "Policy End Date") → put in insurance_expires_at.
  If you only see one date line, look harder — both ALWAYS appear together on a UAE certificate. The expiry is roughly 12 months after the commencement. If you find one but not the other after careful re-reading, set both to null rather than guess.
- Time stamps after the date (e.g. "04/01/2026 13:33:00", "03/02/2027 23:59:59") are part of the date. Ignore the time, keep the date as ISO YYYY-MM-DD.
- Worked example for a QIC Motor Vehicle Insurance Certificate that shows "Commencement date of Insurance: 04/01/2026 13:33:00" and "Expiry Date Of Insurance: 03/02/2027 23:59:59":
    insurance_commencement_at = "2026-01-04"
    insurance_expires_at = "2027-02-03"
    expires_at = null (the insurance cert has no mulkiya expiry)
  Both insurance fields are non-null. The mulkiya field is null. Three different values, never collapsed into one.
- registration_date is when the vehicle was first registered, not insurance dates.
- mortgage_by is a bank or finance company name (e.g. "Emirates NBD Bank").
- owner_name is the full name printed next to "Owner" or "Name" — not a transliteration of the issuing authority.
- color is the LAST cell labelled "Colour" / "Color" / "Vehicle Color" / "اللون". If that cell is blank, return null. NEVER copy the value from the adjacent "Make and Model" column as the colour.
- body_type usually appears on the BACK of the mulkiya. Look across all images.
- plate_number is the digits next to "Traffic Plate No.", "Plate No.", or "رقم اللوحة" (UAE plates are 3-5 digits). DO NOT read barcodes or QR codes as plate numbers. DO NOT pull digits from concatenated strings like "784-1994-3284753-3" — that is a barcode, not a plate.
- year is the 4-digit "Year of Manufacture" or "سنة الصنع". DO NOT mistake premium amounts like "1984.5" (the trailing ".5" gives it away as currency) or chassis-no fragments for years. Years for a UAE-registered car are typically 2000-current.
- vin / chassis is a 17-character alphanumeric code (no I, O, Q).
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
  // Sanity for insurance dates. We deal with three common model mistakes:
  //   (a) expires < commencement → they're swapped. Swap back.
  //   (b) expires == commencement → only one date read; commencement
  //       is the safer guess (the model's "expires" was likely the
  //       commencement that got mislabeled). Null expiry.
  //   (c) only expires is set and it's the same as a date that should
  //       have been commencement — handled by (a) once the prompt makes
  //       the model fill both.
  let commencement = e.insurance_commencement_at
  let expires = e.insurance_expires_at
  if (commencement && expires) {
    const c = new Date(commencement).getTime()
    const x = new Date(expires).getTime()
    if (Number.isFinite(c) && Number.isFinite(x)) {
      if (c > x) {
        console.error(
          '[extract-mulkiya] insurance dates swapped; correcting. before c=',
          commencement,
          'x=',
          expires,
        )
        const tmp = commencement
        commencement = expires
        expires = tmp
      } else if (c === x) {
        console.error(
          '[extract-mulkiya] insurance dates identical; nulling expiry.',
        )
        expires = null
      }
    }
  }
  // Backstop: model frequently extracts only the commencement and
  // skips the expiry. UAE motor policies are essentially always 12
  // months — if commencement is known and expiry isn't, derive expiry
  // = commencement + 365 days. Slightly inaccurate when a policy is
  // 6 or 13 months but those are <2% of the population. Loud log so
  // we can measure drift after a month of data.
  if (commencement && !expires) {
    const c = new Date(commencement)
    if (Number.isFinite(c.getTime())) {
      const derived = new Date(c.getTime() + 365 * 86_400_000)
      const yyyy = derived.getUTCFullYear()
      const mm = String(derived.getUTCMonth() + 1).padStart(2, '0')
      const dd = String(derived.getUTCDate()).padStart(2, '0')
      expires = `${yyyy}-${mm}-${dd}`
      console.error(
        '[extract-mulkiya] insurance expiry missing; derived from commencement +365d. c=',
        commencement,
        'derived expires=',
        expires,
      )
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
    plate_number: cleanPlate(e.plate_number),
    plate_type: cleanText(e.plate_type),
    registration_date: validIsoDate(e.registration_date),
    registration_authority: cleanText(e.registration_authority),
    mortgage_by: cleanMortgageBy(e.mortgage_by),
    expires_at: validIsoDate(e.expires_at),
    owner_name: cleanText(e.owner_name),
    owner_nationality: cleanNationality(e.owner_nationality),
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
  /^plate\s*code$/i,
  /^chassis\s*number$/i,
  /^chassis$/i,
  /^engine\s*number$/i,
  /^body\s*type$/i,
  /^model\s*year$/i,
  /^country\s*of\s*origin$/i,
  /^number\s*of\s*passengers$/i,
  /^use\s*of\s*vehicle$/i,
  /^vehicle\s*registration$/i,
  /^vehicle\s*information$/i,
  /^vehicle\s*category$/i,
  /^vehicle\s*color$/i,
  /^vehicle\s*colour$/i,
  /^vehicle\s*year\s*model$/i,
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
  /^period\s*of\s*insurance\s*from$/i,
  /^period\s*of\s*insurance$/i,
  /^gcc$/i, // GCC is a spec column header, never a fuel type
  /^un\s*laden\s*weight$/i,
  /^laden\s*weight$/i,
  /^number\s*of\s*axles$/i,
  /^number\s*of\s*doors$/i,
  /^number\s*of\s*seats$/i,
  /^number\s*of\s*cylinders$/i,
  /^fuel\s*type$/i,
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
// Map noisy / human-readable doc-type strings to our canonical enum.
// gpt-4o returns variants like "Mulkiya", "Insurance Policy Schedule",
// "RTA Passing Certificate" — all of which were previously rejected by
// strict equality, leaving detected_doc_type null and breaking the
// entire priority allowlist downstream. We now normalise (lowercase,
// collapse separators) and run a keyword search.
function cleanDocType(
  s: DetectedDocType | string | null | undefined,
): DetectedDocType | null {
  if (!s) return null
  // Normalise: lowercase, replace any run of non-alphanumerics with
  // a single underscore. "Insurance Policy Schedule" → "insurance_policy_schedule".
  const norm = s
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') as DetectedDocType
  if (ALLOWED_DETECTED_DOC_TYPES.has(norm)) return norm

  // Fuzzy fallback — keyword search. Catches "vehicle license",
  // "registration card", "motor insurance certificate", etc.
  const hay = norm
  if (/mulkiya|vehicle_license|registration_card|possession_certificate|rta_vehicle/.test(hay)) {
    return 'mulkiya'
  }
  if (/policy_schedule|insurance_schedule|motor_policy/.test(hay)) {
    return 'insurance_policy_schedule'
  }
  if (/insurance_certificate|motor_vehicle_insurance|insurance_cert/.test(hay)) {
    return 'insurance_certificate'
  }
  if (/passing|tasjeel|inspection|fitness|emission/.test(hay)) {
    return 'rta_passing_certificate'
  }
  if (/pollution|emission_test/.test(hay)) return 'pollution_test'
  if (/driving_licence|driving_license|driver_license/.test(hay)) {
    return 'driving_licence'
  }
  if (/^noc$|no_objection/.test(hay)) return 'noc'
  if (/service_invoice|workshop_invoice|repair_invoice/.test(hay)) {
    return 'service_invoice'
  }
  if (/service_history|service_record/.test(hay)) return 'service_history'
  if (/salik/.test(hay)) return 'salik_statement'
  if (/fine_receipt|traffic_fine/.test(hay)) return 'fine_receipt'
  if (/insurance/.test(hay)) return 'insurance_certificate' // catch-all for insurance
  return null
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
  // Reject obvious make/model contamination — colour fields on the
  // policy schedule are often blank, and the model can confuse the
  // adjacent Make-and-Model column header with the colour cell.
  if (/toyota|honda|nissan|ford|hyundai|kia|mitsubishi|mercedes|bmw|audi|lexus|land\s*cruiser|prado|corolla|camry|accord|civic/i.test(t)) {
    return null
  }
  // Reject anything with a hyphen and brand-looking words (e.g.
  // "Toyota - Land Cruiser"). Real colour values are 1-2 words.
  if (/\s-\s/.test(t) && t.split(/\s+/).length > 3) return null
  return t
}

/**
 * UAE plate numbers are 3–5 numeric digits. The text may arrive with a
 * code prefix like "CC / 52243" or "C 52243" — strip those, keep only
 * the digit run. Reject anything that doesn't end up as a 3-5 digit
 * number (this catches insurance barcode fragments like "784" parsed
 * from "784-1994-3284753-3").
 */
function cleanPlate(s: string | null | undefined): string | null {
  if (!s) return null
  const t = s.toString().trim()
  if (!t) return null
  // Extract the longest numeric run.
  const matches = t.match(/\d+/g)
  if (!matches || matches.length === 0) return null
  const digits = matches.reduce((a, b) => (b.length > a.length ? b : a), '')
  if (digits.length < 3 || digits.length > 5) return null
  return digits
}
// Owner nationality — UAE residents are predominantly from a known
// list of countries. Whitelist match prevents the model from reading
// a surname or address fragment into the nationality field.
const KNOWN_NATIONALITIES: ReadonlySet<string> = new Set([
  'india', 'indian',
  'pakistan', 'pakistani',
  'bangladesh', 'bangladeshi',
  'philippines', 'filipino', 'philippine',
  'nepal', 'nepali', 'nepalese',
  'sri lanka', 'sri lankan', 'srilankan',
  'egypt', 'egyptian',
  'syria', 'syrian',
  'jordan', 'jordanian',
  'lebanon', 'lebanese',
  'palestine', 'palestinian',
  'iraq', 'iraqi',
  'iran', 'iranian',
  'yemen', 'yemeni',
  'sudan', 'sudanese',
  'morocco', 'moroccan',
  'tunisia', 'tunisian',
  'algeria', 'algerian',
  'saudi arabia', 'saudi', 'saudi arabian',
  'kuwait', 'kuwaiti',
  'bahrain', 'bahraini',
  'qatar', 'qatari',
  'oman', 'omani',
  'uae', 'emirati', 'united arab emirates',
  'china', 'chinese',
  'japan', 'japanese',
  'korea', 'korean', 'south korea', 'south korean',
  'indonesia', 'indonesian',
  'thailand', 'thai',
  'vietnam', 'vietnamese',
  'malaysia', 'malaysian',
  'singapore', 'singaporean',
  'turkey', 'turkish',
  'russia', 'russian',
  'ukraine', 'ukrainian',
  'germany', 'german',
  'france', 'french',
  'italy', 'italian',
  'spain', 'spanish',
  'portugal', 'portuguese',
  'netherlands', 'dutch',
  'belgium', 'belgian',
  'switzerland', 'swiss',
  'uk', 'united kingdom', 'british', 'english', 'irish', 'ireland', 'scottish',
  'usa', 'us', 'united states', 'american',
  'canada', 'canadian',
  'australia', 'australian',
  'new zealand', 'kiwi',
  'south africa', 'south african',
  'kenya', 'kenyan',
  'nigeria', 'nigerian',
  'ethiopia', 'ethiopian',
  'somalia', 'somali',
  'eritrea', 'eritrean',
  'afghanistan', 'afghan',
  'stateless',
])
function cleanNationality(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  if (KNOWN_NATIONALITIES.has(t.toLowerCase())) return t
  return null
}

function cleanInsurer(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  if (/^(motor\s+vehicle\s+)?insurance\s+certificate$/i.test(t)) return null
  // Reject barcode-shape strings like "784-1994-3284753-3".
  if (/^[\d-]+$/.test(t)) return null
  // Reject pure digit blobs.
  if (/^\d+$/.test(t)) return null
  // A real insurer name has at least one letter.
  if (!/[a-z]/i.test(t)) return null
  return t
}

/**
 * Mortgage-by should be a bank or finance company name. Reject pure
 * numeric strings (model occasionally reads a policy number into this
 * field) and barcode-shaped tokens.
 */
function cleanMortgageBy(s: string | null | undefined): string | null {
  const t = cleanText(s)
  if (!t) return null
  if (/^[\d\s.,-]+$/.test(t)) return null // digits + separators only
  if (!/[a-z]/i.test(t)) return null
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
  // Reject ISO-date-shaped strings (the model sometimes reads an
  // insurance expiry "2027-02-03" into the policy_number field).
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return null
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
  // UAE pilot scope: cars on the road in 2026 are realistically 2000+.
  // Older vintage cars are rare enough that we prefer a missing year
  // over the classic barcode-misread "1984" / "1994" failure mode.
  if (n < 2000 || n > next) return null
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
