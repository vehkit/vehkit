'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { createVehicleDocument } from '@/app/actions/documents'

export type FabVehicle = {
  id: string
  nickname: string | null
  make: string | null
  model: string | null
  plate: string | null
}

type ActionKey = 'car' | 'service' | 'reminder' | 'document' | 'fuel'

const DOC_TYPES: Array<{ value: string; label: string }> = [
  { value: 'mulkiya', label: 'Mulkiya (registration)' },
  { value: 'insurance_policy', label: 'Insurance policy' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'noc', label: 'No-objection certificate' },
  { value: 'pollution_test', label: 'Pollution test' },
  { value: 'service_history', label: 'Service history PDF' },
  { value: 'other', label: 'Other' },
]

type Action = {
  key: ActionKey
  label: string
  hint: string
  icon: 'car' | 'wrench' | 'bell' | 'doc' | 'fuel'
  /** Path to navigate to when action is fired with a vehicle id. */
  pathFor: (vehicleId: string) => string
  /** True when this action does NOT need a vehicle (i.e. add-car). */
  global?: boolean
}

/**
 * Two primary actions only — Add car and Add service.
 *
 * The other sub-actions (fuel, reminder, document) live INSIDE the
 * vehicle profile where they're contextual. Tucked away from the global
 * FAB so the empty/new user isn't drowning in 5 choices on their first
 * tap. Power-users find them once they open a car.
 */
const ACTIONS: Action[] = [
  {
    key: 'car',
    label: 'Add a car',
    hint: 'Make, model, plate. Under a minute.',
    icon: 'car',
    pathFor: () => '/vehicles/new',
    global: true,
  },
  {
    key: 'document',
    label: 'Upload a document',
    hint: 'Mulkiya, insurance, NOC. We read the details for you.',
    icon: 'doc',
    pathFor: (id) => `/vehicles/${id}/documents/new`,
  },
  {
    key: 'service',
    label: 'Log a service',
    hint: 'Oil change, tyre, brakes, anything.',
    icon: 'wrench',
    pathFor: (id) => `/vehicles/${id}/service/new`,
  },
]

function vehicleLabel(v: FabVehicle): string {
  if (v.nickname) return v.nickname
  const mm = [v.make, v.model].filter(Boolean).join(' ')
  return mm || v.plate || 'Vehicle'
}

/**
 * Floating quick-add. Sits in the bottom-right.
 *
 * Smart context:
 *  - If we're on /vehicles/[id]/..., that vehicle is the default for any
 *    vehicle-scoped action — skips the picker entirely.
 *  - If the user has exactly one vehicle, that's the default. Skip picker.
 *  - Otherwise we render a vehicle picker step inside the same sheet.
 *
 * The FAB hides itself for the "no vehicles + only car action makes sense"
 * case → we still show it, but it auto-routes to /vehicles/new on tap so
 * the empty-state user gets one less click.
 */
export function QuickAddFab({ vehicles }: { vehicles: FabVehicle[] }) {
  const pathname = usePathname() ?? ''
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pendingAction, setPendingAction] = useState<Action | null>(null)
  // When the document action is fired with a resolved vehicle, we don't
  // navigate. We open an inline upload form inside the same sheet. This
  // state holds the vehicle id we're uploading against, or null.
  const [docUploadVehicleId, setDocUploadVehicleId] = useState<string | null>(
    null,
  )

  // Resolve vehicle context from pathname: /vehicles/{uuid}/...
  const contextVehicleId = useMemo(() => {
    const m = pathname.match(/^\/vehicles\/([0-9a-f-]{36})(?:\/|$)/i)
    return m ? m[1] : null
  }, [pathname])

  // Lock body scroll when open (mobile sheet UX)
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = prev
      }
    }
  }, [open])

  // Esc to close
  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        setPendingAction(null)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open])

  function close() {
    setOpen(false)
    setPendingAction(null)
    setDocUploadVehicleId(null)
  }

  // Document action stays inline (renders the upload form inside the
  // sheet). Every other action navigates to its dedicated page.
  function resolveVehicleId(): string | null {
    if (contextVehicleId && vehicles.some((v) => v.id === contextVehicleId)) {
      return contextVehicleId
    }
    if (vehicles.length === 1) return vehicles[0]!.id
    return null
  }

  function fire(action: Action) {
    if (action.global) {
      router.push(action.pathFor(''))
      close()
      return
    }
    if (vehicles.length === 0) {
      router.push('/vehicles/new')
      close()
      return
    }

    const resolvedId = resolveVehicleId()

    if (action.key === 'document') {
      if (resolvedId) {
        setDocUploadVehicleId(resolvedId)
        return
      }
      // Multiple cars and no context. Pick the car, then come back to
      // the inline upload (handled in pickVehicle).
      setPendingAction(action)
      return
    }

    if (resolvedId) {
      router.push(action.pathFor(resolvedId))
      close()
      return
    }
    setPendingAction(action)
  }

  function pickVehicle(id: string) {
    if (!pendingAction) return
    if (pendingAction.key === 'document') {
      setDocUploadVehicleId(id)
      setPendingAction(null)
      return
    }
    router.push(pendingAction.pathFor(id))
    close()
  }

  return (
    <>
      {/* The button — anchored to the right edge of the centered content
          column, not the viewport edge. The page content uses `max-w-3xl
          mx-auto`; we mirror that here so the FAB sits where the eye is,
          not in the empty desktop gutter.
          Mobile: bottom-20 (clears the 4-tab bottom nav: 64px + 16px gap).
          Desktop: bottom-6. */}
      <div
        className="fixed inset-x-0 bottom-20 md:bottom-6 z-40 pointer-events-none"
      >
        <div className="relative max-w-3xl mx-auto px-4 md:px-6 h-14">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Quick add"
            aria-expanded={open}
            className="absolute right-4 md:right-6 w-14 h-14 rounded-pill bg-leaf hover:bg-leaf-dk text-white flex items-center justify-center transition-transform active:scale-95 pointer-events-auto"
            style={{
              boxShadow:
                '0 10px 30px -8px rgba(33,192,122,0.55), 0 4px 8px -2px rgba(0,0,0,0.25)',
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Sheet */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-noir/70 backdrop-blur-sm flex items-end md:items-center justify-center"
          onClick={close}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="w-full md:max-w-md bg-carbon border-t md:border border-seam md:rounded-DEFAULT rounded-t-[28px] p-5 pb-8 md:pb-6 max-h-[85svh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile drag handle */}
            <div
              className="md:hidden mx-auto w-10 h-1 rounded-pill bg-seam mb-4"
              aria-hidden
            />

            {docUploadVehicleId ? (
              <DocUploadInline
                vehicleId={docUploadVehicleId}
                onCancel={() => setDocUploadVehicleId(null)}
              />
            ) : !pendingAction ? (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-chalk">
                    What would you like to add?
                  </h3>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="text-ash hover:text-chalk text-2xl leading-none px-2"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-ash mb-4">
                  Pick one — we&apos;ll fill in the rest.
                </p>

                <ul className="space-y-2">
                  {ACTIONS.map((a) => (
                    <li key={a.key}>
                      <button
                        type="button"
                        onClick={() => fire(a)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 rounded-DEFAULT bg-iron/40 hover:bg-iron border border-seam transition-colors text-left"
                      >
                        <span
                          className="shrink-0 w-10 h-10 rounded-pill bg-leaf/15 text-leaf flex items-center justify-center"
                          aria-hidden
                        >
                          <ActionIcon name={a.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-chalk leading-tight">
                            {a.label}
                          </span>
                          <span className="block text-[11px] text-ash mt-0.5 leading-snug">
                            {a.hint}
                          </span>
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-ash shrink-0"
                          aria-hidden
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-base font-semibold text-chalk">
                    {pendingAction.label} — for which car?
                  </h3>
                  <button
                    onClick={close}
                    aria-label="Close"
                    className="text-ash hover:text-chalk text-2xl leading-none px-2"
                  >
                    ×
                  </button>
                </div>
                <p className="text-xs text-ash mb-4">
                  Pick the vehicle. We&apos;ll skip this next time if you&apos;re on
                  a car&apos;s page.
                </p>

                <ul className="space-y-2">
                  {vehicles.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => pickVehicle(v.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-DEFAULT bg-iron/40 hover:bg-iron border border-seam transition-colors text-left"
                      >
                        <span
                          className="shrink-0 w-9 h-9 rounded-pill bg-leaf/15 text-leaf flex items-center justify-center"
                          aria-hidden
                        >
                          <ActionIcon name="car" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold text-chalk leading-tight truncate">
                            {vehicleLabel(v)}
                          </span>
                          {v.plate && (
                            <span className="block text-[11px] font-mono text-ash mt-0.5">
                              {v.plate}
                            </span>
                          )}
                        </span>
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="text-ash shrink-0"
                          aria-hidden
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => setPendingAction(null)}
                  className="mt-3 text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                >
                  ← Back
                </button>
              </>
            )}

            {/* Empty-state hint when there are no vehicles */}
            {!pendingAction && vehicles.length === 0 && (
              <p className="text-[11px] text-ash/70 mt-4 text-center leading-relaxed">
                Heads up — most actions need a car first. Tap{' '}
                <span className="text-chalk">Add a car</span> above.
              </p>
            )}
          </div>
        </div>
      )}

    </>
  )
}

// ─── DocUploadInline ────────────────────────────────────────────────
// Lives inside the FAB sheet. Skips the dedicated /documents/new page
// for one less screen between the user and the upload. File picker is
// the dominant control. Once the user picks a file, the type select
// and (optional) name field show; submit kicks the server action, which
// uploads to storage + queues extraction. Extraction now auto-applies
// to the vehicle row (no Apply button), so the data shows up on the
// vehicle page on the next render without any extra tap.
function DocUploadInline({
  vehicleId,
  onCancel,
}: {
  vehicleId: string
  onCancel: () => void
}) {
  const [filesPicked, setFilesPicked] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  return (
    <>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-chalk">Upload a document</h3>
        <button
          onClick={onCancel}
          aria-label="Back"
          className="text-ash hover:text-chalk text-2xl leading-none px-2"
        >
          ×
        </button>
      </div>
      <p className="text-xs text-ash mb-4">
        Pick the file. We will read the details for you.
      </p>

      <form
        action={createVehicleDocument}
        encType="multipart/form-data"
        onSubmit={() => setSubmitting(true)}
        className="space-y-4"
      >
        <input type="hidden" name="vehicle_id" value={vehicleId} />

        <div>
          <label htmlFor="fab-file" className="label">
            File <span className="text-signal">*</span>
          </label>
          <input
            id="fab-file"
            name="file"
            type="file"
            accept="application/pdf,image/*"
            multiple
            required
            autoFocus
            onChange={(e) =>
              setFilesPicked((e.target.files?.length ?? 0) > 0)
            }
            className="field file:mr-3 file:py-1.5 file:px-3 file:rounded-pill file:border-0 file:bg-iron file:text-chalk file:text-xs file:tracking-widest file:uppercase file:font-medium hover:file:bg-iron/70 file:cursor-pointer"
          />
          <p className="text-[11px] text-ash/70 mt-1.5">
            PDF or image. Multiple files OK.
          </p>
        </div>

        <div className={filesPicked ? '' : 'opacity-60'}>
          <label htmlFor="fab-doc-type" className="label">
            What is it? <span className="text-signal">*</span>
          </label>
          <select
            id="fab-doc-type"
            name="doc_type"
            required
            defaultValue=""
            className="field"
          >
            <option value="" disabled>
              Pick one…
            </option>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="fab-label" className="label">
            Name <span className="text-ash/70">(optional)</span>
          </label>
          <input
            id="fab-label"
            name="label"
            type="text"
            maxLength={120}
            placeholder="If you picked Other, name it here"
            className="field"
          />
        </div>

        <div>
          <label htmlFor="fab-expires" className="label">
            Expires <span className="text-ash/70">(optional)</span>
          </label>
          <input
            id="fab-expires"
            name="expires_at"
            type="date"
            className="field"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="pill-primary block w-full text-center"
        >
          {submitting ? 'Uploading…' : 'Save document'}
        </button>
      </form>
    </>
  )
}

function ActionIcon({
  name,
}: {
  name: 'car' | 'wrench' | 'bell' | 'doc' | 'fuel'
}) {
  const common = {
    width: 18,
    height: 18,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'car') {
    return (
      <svg {...common}>
        <path d="M5 17H3v-5l2-5h14l2 5v5h-2" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
      </svg>
    )
  }
  if (name === 'wrench') {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    )
  }
  if (name === 'bell') {
    return (
      <svg {...common}>
        <path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 01-3.46 0" />
      </svg>
    )
  }
  if (name === 'doc') {
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    )
  }
  // fuel
  return (
    <svg {...common}>
      <line x1="3" y1="22" x2="15" y2="22" />
      <line x1="4" y1="9" x2="14" y2="9" />
      <path d="M14 22V4a2 2 0 00-2-2H6a2 2 0 00-2 2v18" />
      <path d="M14 13h2a2 2 0 012 2v2a2 2 0 002 2 2 2 0 002-2V9l-3-3" />
    </svg>
  )
}
