import Link from 'next/link'
import { archiveVehicleDocument } from '@/app/actions/documents'

export type VehicleDocumentRow = {
  id: string
  doc_type: string
  label: string | null
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  issued_date: string | null
  expires_at: string | null
  created_at: string
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

const TYPE_TONE: Record<string, string> = {
  mulkiya: 'bg-volt/15 text-volt border-volt/30',
  insurance_policy: 'bg-wallet/15 text-wallet border-wallet/30',
  driving_licence: 'bg-iron text-chalk border-seam',
  noc: 'bg-iron text-ash border-seam',
  pollution_test: 'bg-iron text-ash border-seam',
  service_history: 'bg-iron text-ash border-seam',
  other: 'bg-iron text-ash border-seam',
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
  if (days <= 90) return { label: `Expires in ${Math.ceil(days / 30)} mo`, tone: 'wallet' }
  return {
    label: `Valid · ${expiry.toLocaleDateString('en-GB', {
      month: 'short',
      year: 'numeric',
    })}`,
    tone: 'volt',
  }
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
          Mulkiya, registration, insurance, NOC, service contracts — store them once, find them in seconds. We&apos;ll remind you before anything expires.
        </p>
        {isOwner && (
          <Link
            href={`/vehicles/${vehicleId}/documents/new`}
            className="text-xs tracking-widest uppercase text-volt mt-4 inline-block hover:underline"
          >
            + Add a document
          </Link>
        )}
      </div>
    )
  }

  return (
    <ul className="space-y-3">
      {documents.map((d) => {
        const typeLabel = TYPE_LABELS[d.doc_type] ?? 'Document'
        const tone = TYPE_TONE[d.doc_type] ?? TYPE_TONE.other
        const expiry = expiryState(d.expires_at)
        const expiryToneClass =
          expiry?.tone === 'signal'
            ? 'bg-signal/15 text-signal'
            : expiry?.tone === 'wallet'
              ? 'bg-wallet/15 text-wallet'
              : expiry?.tone === 'volt'
                ? 'bg-volt/10 text-volt'
                : 'bg-iron text-ash'
        return (
          <li key={d.id} className="card p-4">
            <div className="flex items-center gap-3">
              <span
                className={`shrink-0 w-10 h-10 rounded-pill border flex items-center justify-center ${tone}`}
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
                <div className="flex items-center gap-2">
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
                  {d.issued_date && (
                    <>
                      {' · '}
                      <span>
                        Issued{' '}
                        {new Date(d.issued_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </>
                  )}
                  {d.file_size_bytes != null && (
                    <>
                      {' · '}
                      <span className="font-mono tabular-nums">
                        {(d.file_size_bytes / 1024).toFixed(0)} KB
                      </span>
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {/* View — anyone with SELECT on this row can hit the signed-URL
                    route. RLS enforces row visibility; this just produces a
                    short-lived URL for the storage object. */}
                <Link
                  href={`/vehicles/${vehicleId}/documents/${d.id}/view`}
                  aria-label="View document"
                  title="View document"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-pill bg-iron text-ash hover:bg-iron/70 border border-seam transition-colors"
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
                      className="w-9 h-9 inline-flex items-center justify-center rounded-pill bg-iron text-ash hover:bg-iron/70 border border-seam transition-colors"
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
  )
}
