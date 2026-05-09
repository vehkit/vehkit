import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteVehicle } from '@/app/actions/vehicles'
import { deleteServiceRecord, confirmServiceRecord } from '@/app/actions/services'
import { snoozeReminder, completeReminder } from '@/app/actions/reminders'
import { HeroPhotoUpload } from '@/components/HeroPhotoUpload'
import { ShareSheet } from '@/components/ShareSheet'
import { WorkshopCodeSheet } from '@/components/WorkshopCodeSheet'
import { FamilyShareSheet } from '@/components/FamilyShareSheet'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { ReviewForm } from '@/components/ReviewForm'
import { StarRating } from '@/components/StarRating'
import { VehicleScoreChip } from '@/components/VehicleScore'
import {
  reminderStatus,
  reminderLabel,
  humanizeReminderType,
  type ReminderRow,
} from '@/lib/reminders'

export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ review?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const autoReviewRecordId = sp.review ?? null
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallelize all three reads — saves 2 round trips
  const [vehicleRes, recordsRes, remindersRes, scoreRes] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', id).single(),
    supabase
      .from('service_records')
      .select('*, service_files(storage_path), workshop_reviews(id, rating, comment, created_by, quality_rating, value_rating, timeliness_rating)')
      .eq('vehicle_id', id)
      .order('service_date', { ascending: false }),
    supabase
      .from('reminders')
      .select('*')
      .eq('vehicle_id', id)
      .eq('status', 'open')
      .order('due_date', { ascending: true, nullsFirst: false }),
    supabase.rpc('compute_vehicle_score', { p_vehicle_id: id }),
  ])

  const vehicle = vehicleRes.data
  if (vehicleRes.error || !vehicle) notFound()
  const scoreData = scoreRes.data as Parameters<typeof VehicleScoreChip>[0]['data']

  const records = recordsRes.data
  const reminders = remindersRes.data

  const dueReminders = (reminders ?? []).filter((r: ReminderRow) => {
    const s = reminderStatus(r, vehicle.current_odometer)
    return s === 'overdue' || s === 'due_soon'
  })

  // Compute base URL for share links
  const h = await headers()
  const host = h.get('host') ?? 'vehkit.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <Link href="/mycars" className="nav-pill hover:text-chalk transition-colors">
          ← My Cars
        </Link>

        {/* Hero card — photo + overlaid title/odometer (matches /mycars language) */}
        <div className="mt-4">
          <HeroPhotoUpload vehicleId={id} currentUrl={vehicle.hero_image_url}>
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  {(vehicle.year || vehicle.color) && (
                    <p className="text-[10px] tracking-widest uppercase text-chalk/70">
                      {[vehicle.year, vehicle.color].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <VehicleScoreChip data={scoreData} />
                </div>
                <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter truncate drop-shadow-sm">
                  {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
                </h1>
                <p className="text-xs text-chalk/70 mt-1 truncate">
                  {[
                    `${vehicle.make} ${vehicle.model}`,
                    vehicle.plate_emirate && vehicle.plate_number
                      ? `${vehicle.plate_emirate} · ${vehicle.plate_number}`
                      : vehicle.plate_number,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono text-xl md:text-2xl font-semibold text-chalk tabular-nums tracking-tight drop-shadow-sm">
                  {vehicle.current_odometer?.toLocaleString() ?? '—'}
                </p>
                <p className="text-[10px] tracking-widest uppercase text-chalk/60 mt-0.5">km</p>
              </div>
            </div>
          </HeroPhotoUpload>
        </div>

        {/* Action strip — compact horizontal row, single line, scrollable on mobile */}
        <div className="mt-4 -mx-6 px-6 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <ShareSheet vehicleId={id} baseUrl={baseUrl} />
            <WorkshopCodeSheet vehicleId={id} />
            <FamilyShareSheet vehicleId={id} baseUrl={baseUrl} />
            <Link href={`/vehicles/${id}/edit`} className="pill-outline text-sm whitespace-nowrap">
              Edit
            </Link>
          </div>
        </div>

        {vehicle.vin && (
          <p className="text-[10px] tracking-widest uppercase text-ash/60 mt-3 font-mono">
            VIN <span className="text-ash">{vehicle.vin}</span>
          </p>
        )}

        {/* Reminders banner */}
        {dueReminders.length > 0 && (
          <section className="mt-6 space-y-2">
            {dueReminders.map((r: ReminderRow) => {
              const status = reminderStatus(r, vehicle.current_odometer)
              const isOverdue = status === 'overdue'
              return (
                <div
                  key={r.id}
                  className={`card p-4 border-l-4 ${
                    isOverdue ? 'border-l-signal' : 'border-l-wallet'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs tracking-widest uppercase text-ash">
                        {isOverdue ? 'Overdue' : 'Due soon'}
                      </p>
                      <p className="font-medium text-chalk mt-0.5">
                        {humanizeReminderType(r.reminder_type)}
                      </p>
                      <p className="text-sm text-ash mt-0.5">
                        {reminderLabel(r, vehicle.current_odometer)}
                      </p>
                    </div>
                    <Link
                      href={`/vehicles/${id}/service/new`}
                      className={`text-xs tracking-widest uppercase font-medium shrink-0 ${
                        isOverdue ? 'text-signal' : 'text-wallet'
                      } hover:underline`}
                    >
                      Log →
                    </Link>
                  </div>
                  <div className="flex gap-3 mt-3 pt-3 border-t border-seam">
                    <form action={snoozeReminder} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="vehicle_id" value={id} />
                      <input type="hidden" name="snooze_days" value="7" />
                      <button
                        type="submit"
                        className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                      >
                        Snooze 7d
                      </button>
                    </form>
                    <form action={completeReminder} className="inline">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="vehicle_id" value={id} />
                      <button
                        type="submit"
                        className="text-xs tracking-widest uppercase text-ash hover:text-volt transition-colors"
                      >
                        Mark done
                      </button>
                    </form>
                  </div>
                </div>
              )
            })}
            <div className="pt-2 text-right">
              <Link
                href={`/vehicles/${id}/reminders/new`}
                className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                + Add custom reminder
              </Link>
            </div>
          </section>
        )}

        {/* Feed */}
        <section className="mt-8">
          {/* Tab-bar divider — Instagram profile section style */}
          <div className="border-t border-seam">
            <div className="flex justify-center">
              <div className="px-4 py-3 -mt-px border-t-2 border-chalk text-xs tracking-widest uppercase text-chalk font-medium">
                Service feed{records && records.length > 0 && ` · ${records.length}`}
              </div>
            </div>
          </div>

          {records && records.length > 0 ? (
            <ol className="space-y-5">
              {records.map((r) => {
                const photos = (r.service_files ?? [])
                  .map((f: { storage_path: string }) => f.storage_path)
                  .filter(Boolean)
                const ageMs = Date.now() - new Date(r.created_at).getTime()
                const isConfirmed = !!r.confirmed_at
                const isPending =
                  r.attestation === 'workshop' &&
                  !isConfirmed &&
                  ageMs < 24 * 60 * 60 * 1000
                const hoursLeft = isPending
                  ? Math.max(1, Math.ceil((24 * 60 * 60 * 1000 - ageMs) / (60 * 60 * 1000)))
                  : 0
                const autoOpenReview = autoReviewRecordId === r.id
                const review = r.workshop_reviews?.[0]
                const workshopName = r.workshop_name_freetext || 'Owner-logged'
                const initials = workshopName
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w: string) => w.charAt(0).toUpperCase())
                  .join('') || '·'
                return (
                  <li key={r.id} className="card overflow-hidden">
                    {/* Post header — workshop avatar + name + status */}
                    <div className="px-4 pt-3 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className={`w-10 h-10 rounded-pill flex items-center justify-center shrink-0 font-mono text-xs font-semibold ${
                            r.attestation === 'workshop'
                              ? isPending
                                ? 'bg-wallet/20 text-wallet'
                                : 'bg-volt/20 text-volt'
                              : 'bg-iron text-ash'
                          }`}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-chalk truncate">
                            {workshopName}
                          </p>
                          <p className="text-xs text-ash">
                            {relativeDate(r.service_date)}
                          </p>
                        </div>
                      </div>
                      {r.attestation === 'workshop' && isPending && (
                        <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-1 rounded-pill font-medium shrink-0">
                          Pending · {hoursLeft}h
                        </span>
                      )}
                      {r.attestation === 'workshop' && !isPending && (
                        <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-1 rounded-pill font-medium shrink-0">
                          ✓ Verified
                        </span>
                      )}
                      {r.attestation === 'receipt' && (
                        <span className="text-[10px] tracking-wider uppercase bg-iron text-ash px-2 py-1 rounded-pill font-medium shrink-0">
                          Receipt
                        </span>
                      )}
                    </div>

                    {/* Photos full-bleed (Instagram style) */}
                    {photos.length > 0 && <PhotoLightbox photos={photos} />}

                    {/* Caption body */}
                    <div className="px-4 pt-3 pb-4 space-y-3">
                      <div>
                        <p className="text-base text-chalk leading-snug">
                          <span className="font-semibold">{humanize(r.service_type)}</span>
                          {r.cost_aed != null && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums">
                                AED {Number(r.cost_aed).toLocaleString()}
                              </span>
                            </>
                          )}
                          {r.odometer != null && (
                            <>
                              {' · '}
                              <span className="font-mono tabular-nums text-ash">
                                {r.odometer.toLocaleString()} km
                              </span>
                            </>
                          )}
                        </p>
                      </div>

                      {/* Notes */}
                      {r.notes && (
                        <p className="text-sm text-chalk/85 leading-relaxed whitespace-pre-wrap">
                          {r.notes}
                        </p>
                      )}

                      {/* Existing review */}
                      {review && (
                        <div className="pt-3 border-t border-seam flex items-start gap-3 flex-wrap">
                          <StarRating rating={review.rating} />
                          {review.comment && (
                            <span className="text-sm text-ash italic flex-1 min-w-0">
                              "{review.comment}"
                            </span>
                          )}
                        </div>
                      )}

                      {/* Action footer */}
                      <div className="pt-3 border-t border-seam flex gap-4 flex-wrap">
                        {r.attestation !== 'workshop' && (
                          <Link
                            href={`/vehicles/${id}/service/${r.id}/edit`}
                            className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                          >
                            Edit
                          </Link>
                        )}
                        {isPending && (
                          <form action={confirmServiceRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="vehicle_id" value={id} />
                            <button
                              type="submit"
                              className="text-xs tracking-widest uppercase font-medium text-volt hover:text-volt/80 transition-colors"
                              formNoValidate
                            >
                              ✓ Confirm
                            </button>
                          </form>
                        )}
                        {(r.attestation !== 'workshop' || isPending) && (
                          <form action={deleteServiceRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="vehicle_id" value={id} />
                            <button
                              type="submit"
                              className={`text-xs tracking-widest uppercase transition-colors ${
                                isPending
                                  ? 'text-wallet hover:text-wallet/80'
                                  : 'text-ash hover:text-signal'
                              }`}
                              formNoValidate
                            >
                              {isPending ? 'Retract' : 'Delete'}
                            </button>
                          </form>
                        )}
                        {r.attestation === 'workshop' && !isPending && (
                          <ReviewForm
                            recordId={r.id}
                            vehicleId={id}
                            existingRating={review?.rating ?? null}
                            existingComment={review?.comment ?? null}
                            existingQuality={review?.quality_rating ?? null}
                            existingValue={review?.value_rating ?? null}
                            existingTimeliness={review?.timeliness_rating ?? null}
                            autoOpen={autoOpenReview}
                          />
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          ) : (
            <div className="py-16 text-center">
              <div className="w-14 h-14 mx-auto rounded-pill border border-seam flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="text-ash"
                  aria-hidden
                >
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <h3 className="text-base font-semibold text-chalk mt-4">No services yet</h3>
              <p className="text-sm text-ash mt-1 mb-6">
                Log your first service to start the timeline.
              </p>
              <Link
                href={`/vehicles/${id}/service/new`}
                className="text-sm tracking-wide text-volt font-medium hover:underline"
              >
                Add service record →
              </Link>
            </div>
          )}
        </section>

        {/* Footer actions */}
        <section className="mt-16 pt-6 border-t border-seam flex items-center justify-between">
          <a
            href={`/vehicles/${id}/export`}
            className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
            download
          >
            Export CSV
          </a>
          <form action={deleteVehicle}>
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="text-xs tracking-widest uppercase text-signal hover:underline"
              formNoValidate
            >
              Delete this vehicle
            </button>
          </form>
        </section>
      </div>

      {/* Sticky bottom action */}
      {records && records.length > 0 && (
        <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
          <div className="max-w-3xl mx-auto">
            <Link
              href={`/vehicles/${id}/service/new`}
              className="pill-primary block text-center max-w-md mx-auto"
            >
              + Add service
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7)
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`
  }
  if (diffDays < 365) {
    const m = Math.floor(diffDays / 30)
    return `${m} ${m === 1 ? 'month' : 'months'} ago`
  }
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
