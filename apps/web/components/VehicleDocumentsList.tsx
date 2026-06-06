import Link from 'next/link'
import { archiveVehicleDocument } from '@/app/actions/documents'
import { ExtractionStatusPing } from '@/components/ExtractionStatusPing'

export type VehicleDocumentFile = {
  id: string
  storage_path: string
  file_type: string | null
  position: number
}

export type VehicleDocumentRow = {
  id: string
  doc_type: string
  label: string | null
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  issued_date: string | null
  expires_at: string | null
  extracted_data?: Record<string, unknown> | null
  extraction_status?: 'pending' | 'ready' | 'applied' | 'failed' | null
  extraction_error?: string | null
  created_at: string
  /** Child files embedded by the supabase query. May be empty for legacy docs. */
  files?: VehicleDocumentFile[] | null
}

const TYPE_LABELS: Record<string, string> = {
  mulkiya: 'Mulkiya',
  insurance_policy: 'Insurance',
  driving_licence: 'Driving licence',
  noc: 'NOC',
  pollution_test: 'Pollution test',
  service_history: 'Service history',
  other: 'Document',
}

function expiryState(dateStr: string | null): {
  label: string
  tone: 'volt' | 'wallet' | 'signal' | 'ash'
} | null {
  if (!dateStr) return null
  const expiry = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor(
    (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (days < 0) return { label: 'Expired', tone: 'signal' }
  if (days === 0) return { label: 'Expires today', tone: 'signal' }
  if (days <= 30) return { label: `Expires in ${days}d`, tone: 'wallet' }
  if (days <= 90)
    return {
      label: `Expires in ${Math.ceil(days / 30)} mo`,
      tone: 'wallet',
    }
  return {
    label: `Valid . ${expiry.toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    })}`,
    tone: 'volt',
  }
}

/**
 * Extracted-data summary line. Pulls the highest-value fields the
 * parser knows about, formatted as a short pipe-separated string.
 */
function extractedSummary(
  data: Record<string, unknown> | null | undefined,
): string | null {
  if (!data) return null
  const parts: string[] = []
  const make = data.vehicle_make as string | undefined
  const model = data.vehicle_model as string | undefined
  const year = data.year as number | undefined
  if (year || make || model) {
    parts.push([year, make, model].filter(Boolean).join(' '))
  }
  const plate = data.plate_number as string | undefined
  const emirate = data.plate_emirate as string | undefined
  if (plate) parts.push(emirate ? `${emirate} . ${plate}` : plate)
  const vin = data.vin as string | undefined
  if (vin) parts.push(`VIN ${vin}`)
  const insurer = data.insurance_company as string | undefined
  if (insurer) parts.push(insurer)
  const policy = data.insurance_policy_number as string | undefined
  if (policy) parts.push(`Policy ${policy}`)
  return parts.length > 0 ? parts.join(' . ') : null
}

export function VehicleDocumentsList({
  vehicleId,
  documents,
  isOwner,
}: {
  vehicleId: string
  documents: VehicleDocumentRow[]
  isOwner: boolean
}) {
  if (documents.length === 0) {
    return (
      <div className="card p-6 text-center">
        <p className="text-sm text-chalk font-medium">Your glovebox is empty</p>
        <p className="text-xs text-ash mt-2 leading-relaxed">
          Mulkiya, insurance, NOC. Store them once, find them in seconds.
          We will remind you before anything expires.
        </p>
      </div>
    )
  }

  const anyPending = documents.some((d) => d.extraction_status === 'pending')

  return (
    <>
      <ExtractionStatusPing enabled={anyPending} />
      <ul className="space-y-3">
        {documents.map((d) => {
          const typeLabel = TYPE_LABELS[d.doc_type] ?? 'Document'
          const expiry = expiryState(d.expires_at)
          const expiryToneClass =
            expiry?.tone === 'signal'
              ? 'bg-signal/15 text-signal'
              : expiry?.tone === 'wallet'
                ? 'bg-wallet/15 text-wallet'
                : expiry?.tone === 'volt'
                  ? 'bg-volt/10 text-volt'
                  : 'bg-iron text-ash'

          const summary = extractedSummary(d.extracted_data)
          const status = d.extraction_status ?? null

          return (
            <li
              key={d.id}
              className={
                status === 'failed'
                  ? 'relative bg-iron/30 p-4 rounded-DEFAULT ring-1 ring-signal/40'
                  : 'relative bg-iron/30 p-4 rounded-DEFAULT'
              }
            >
              {/* Failed badge — small red dot top-right corner. Catches
                  the eye without being loud. */}
              {status === 'failed' && (
                <span
                  className="absolute -top-1 -right-1 w-3 h-3 rounded-pill bg-signal ring-2 ring-noir"
                  aria-hidden
                />
              )}

              <div className="flex items-center gap-3">
                <span
                  className="shrink-0 w-10 h-10 rounded-pill bg-iron text-ash flex items-center justify-center"
                  aria-hidden
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm md:text-base font-semibold text-chalk truncate leading-snug">
                      {d.label ?? typeLabel}
                    </p>
                    {expiry && (
                      <span
                        className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-pill font-medium shrink-0 ${expiryToneClass}`}
                      >
                        {expiry.label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ash mt-0.5 truncate">
                    <span className="text-chalk/90">{typeLabel}</span>
                    {(d.files?.length ?? 0) > 1 && (
                      <>
                        {' . '}
                        <span className="text-chalk/90 font-medium">
                          {d.files!.length} files
                        </span>
                      </>
                    )}
                  </p>

                  {/* Status line for extraction. Only shows for mulkiya-style
                      documents that have a status. Three tones:
                        pending  → animated dot, "Reading…"
                        applied  → green check, summary of what we got
                        ready    → same as applied (we now auto-apply)
                        failed   → red dot, error hint, reupload link */}
                  {status === 'pending' && (
                    <p className="text-[11px] text-mute mt-1.5 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-pill bg-leaf animate-pulse" />
                      Reading the document…
                    </p>
                  )}
                  {(status === 'ready' || status === 'applied') && summary && (
                    <p className="text-[11px] text-mute mt-1.5 line-clamp-1">
                      <span className="text-leaf-dk font-semibold">Read.</span>{' '}
                      {summary}
                    </p>
                  )}
                  {(status === 'ready' || status === 'applied') && !summary && (
                    <p className="text-[11px] text-mute mt-1.5">
                      <span className="text-leaf-dk font-semibold">Read.</span>{' '}
                      Stored.
                    </p>
                  )}
                  {status === 'failed' && (
                    <p className="text-[11px] text-signal mt-1.5 flex items-center gap-1.5 flex-wrap">
                      <span>
                        Could not read.
                        {d.extraction_error
                          ? ` ${d.extraction_error}`
                          : ' Try a clearer photo.'}
                      </span>
                      {isOwner && (
                        <Link
                          href={`/vehicles/${vehicleId}/documents/new?retry=${d.id}`}
                          className="text-leaf font-semibold underline-offset-2 hover:underline"
                        >
                          Reupload
                        </Link>
                      )}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <Link
                    href={`/vehicles/${vehicleId}/documents/${d.id}/view`}
                    aria-label="View document"
                    title="View document"
                    className="w-9 h-9 inline-flex items-center justify-center rounded-pill bg-iron text-ash hover:bg-iron/70 transition-colors"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </Link>

                  {isOwner && (
                    <form action={archiveVehicleDocument}>
                      <input type="hidden" name="id" value={d.id} />
                      <input type="hidden" name="vehicle_id" value={vehicleId} />
                      <button
                        type="submit"
                        aria-label="Archive document"
                        title="Archive document"
                        className="w-9 h-9 inline-flex items-center justify-center rounded-pill bg-iron text-ash hover:bg-iron/70 transition-colors"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                          <path d="M10 11v6" />
                          <path d="M14 11v6" />
                        </svg>
                      </button>
                    </form>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
