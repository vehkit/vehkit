/**
 * Mulkiya field extraction via Claude vision.
 *
 * Given the bytes of a UAE Mulkiya photo, returns a structured set of
 * fields suitable for auto-filling the vehicle record. Uses Claude
 * Sonnet's vision capability — it's strong at reading semi-structured
 * documents with mixed Arabic/English text like the mulkiya.
 *
 * Returns null when extraction fails or the response can't be parsed —
 * the caller treats that as a "ready: false" state, not a crash.
 */

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Model is configurable via env. Default is Haiku — cheapest credible
 * option, ~3x lighter on tokens than Sonnet. Mulkiyas are standardised
 * forms; Haiku handles them fine. Override to `claude-sonnet-4-5` only
 * if you start seeing extraction failures on real docs.
 *
 * Cost guidance (Haiku 4.5 list price):
 *   input  $1/M tokens · output $5/M tokens
 *   typical mulkiya: ~1,200 input + ~150 output = ~$0.002 per doc
 */
const ANTHROPIC_MODEL = process.env.ANTHROPIC_EXTRACTION_MODEL ?? 'claude-haiku-4-5'

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

const EXTRACTION_PROMPT = `You are extracting structured data from a UAE Mulkiya (vehicle registration card).
Look at the image carefully. The card contains text in both Arabic and English.

Return ONLY a JSON object (no markdown fences, no commentary) with these fields:
- vehicle_make: car brand as English text (e.g. "Toyota", "Nissan", "Mercedes-Benz")
- vehicle_model: model as English text (e.g. "Land Cruiser", "Patrol", "C 200")
- year: 4-digit integer model year
- plate_number: the plate number as it appears on the card (digits only, no letter)
- plate_emirate: ONE of exactly: ${EMIRATES.map((e) => `"${e}"`).join(', ')}
- vin: 17-character alphanumeric VIN / chassis number
- expires_at: registration expiry date as ISO YYYY-MM-DD

If any field is not clearly legible, set it to null. Do not guess.
Return ONLY the JSON, starting with { and ending with }.`

/**
 * Send an image to Claude vision and parse the structured response.
 * @param imageBase64 base64 string of the image WITHOUT the data: prefix
 * @param mimeType e.g. "image/jpeg", "image/png", "image/webp"
 */
export async function extractMulkiyaFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedMulkiya | null> {
  // Hard kill-switch — set EXTRACTION_ENABLED=false to skip the API call
  // entirely (zero spend). Used when running local dev, in test suites,
  // or pre-launch when we don't want to pay for half-tested uploads.
  if (process.env.EXTRACTION_ENABLED === 'false') {
    console.log('[extract-mulkiya] EXTRACTION_ENABLED=false; skipping')
    return null
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('[extract-mulkiya] ANTHROPIC_API_KEY not set; skipping')
    return null
  }

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mimeType,
                  data: imageBase64,
                },
              },
              { type: 'text', text: EXTRACTION_PROMPT },
            ],
          },
        ],
      }),
    })

    if (!res.ok) {
      const errBody = await res.text().catch(() => '')
      console.error('[extract-mulkiya] API error', res.status, errBody)
      return null
    }

    const json = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
    }
    const text = json.content?.find((c) => c.type === 'text')?.text ?? ''

    // Find the JSON in the response. Be defensive — sometimes models
    // wrap with explanation despite instructions.
    const start = text.indexOf('{')
    const end = text.lastIndexOf('}')
    if (start === -1 || end === -1) {
      console.error('[extract-mulkiya] no JSON found in response')
      return null
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<ExtractedMulkiya>

    return normalize(parsed)
  } catch (err) {
    console.error('[extract-mulkiya] fetch/parse failed', err)
    return null
  }
}

function normalize(p: Partial<ExtractedMulkiya>): ExtractedMulkiya {
  // Trust but verify — coerce types defensively.
  const emirateRaw = typeof p.plate_emirate === 'string' ? p.plate_emirate : null
  const plate_emirate =
    emirateRaw && (EMIRATES as readonly string[]).includes(emirateRaw)
      ? (emirateRaw as (typeof EMIRATES)[number])
      : null

  const yearRaw = p.year
  const year =
    typeof yearRaw === 'number' && yearRaw >= 1950 && yearRaw <= 2099
      ? Math.trunc(yearRaw)
      : null

  const expiresRaw =
    typeof p.expires_at === 'string' ? p.expires_at.trim() : null
  const expires_at =
    expiresRaw && /^\d{4}-\d{2}-\d{2}$/.test(expiresRaw) ? expiresRaw : null

  return {
    vehicle_make: stringOrNull(p.vehicle_make),
    vehicle_model: stringOrNull(p.vehicle_model),
    year,
    plate_number: stringOrNull(p.plate_number),
    plate_emirate,
    vin: stringOrNull(p.vin),
    expires_at,
  }
}

function stringOrNull(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s.length === 0 ? null : s
}
