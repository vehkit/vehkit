import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteVehicle } from '@/app/actions/vehicles'
import { snoozeReminder, completeReminder } from '@/app/actions/reminders'
import { ShareSheet } from '@/components/ShareSheet'
import { WorkshopCodeSheet } from '@/components/WorkshopCodeSheet'
import { FamilyShareSheet } from '@/components/FamilyShareSheet'
import { VehicleScoreChip } from '@/components/VehicleScore'
import { ScrollAwareHeader } from '@/components/ScrollAwareHeader'
import { VehicleHero } from '@/components/VehicleHero'
import { ServiceRecordRow } from '@/components/ServiceRecordRow'
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
  searchParams: Promise<{ review?: string; error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const autoReviewRecordId = sp.review ?? null
  const errorMsg = sp.error
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
      .order('service_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false }),
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

  // Only the actual vehicle owner can confirm/retract entries.
  // Workshop members viewing serviced cars get read-only access.
  const isOwner = vehicle.owner_id === user.id

  const dueReminders = (reminders ?? []).filter((r: ReminderRow) => {
    const s = reminderStatus(r, vehicle.current_odometer)
    return s === 'overdue' || s === 'due_soon'
  })

  // Compute base URL for share links
  const h = await headers()
  const host = h.get('host') ?? 'vehkit.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  const vehicleTitle =
    vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`
  const vehicleSubline = [
    `${vehicle.make} ${vehicle.model}`,
    vehicle.plate_emirate && vehicle.plate_number
      ? `${vehicle.plate_emirate} · ${vehicle.plate_number}`
      : vehicle.plate_number,
  ]
    .filter(Boolean)
    .join(' · ')

  // Aggregate stats from records — drive the stats row + insights
  const totalRecords = (records ?? []).length
  const verifiedRecords = (records ?? []).filter(
    (r) => r.attestation === 'workshop'
  ).length
  const distinctWorkshops = new Set(
    (records ?? [])
      .map((r) => r.workshop_id)
      .filter(Boolean)
  ).size
  const totalSpent = (records ?? []).reduce(
    (sum, r) => sum + (r.cost_aed ? Number(r.cost_aed) : 0),
    0
  )
  const pendingCount = (records ?? []).filter((r) => {
    const ageMs = Date.now() - new Date(r.created_at).getTime()
    return (
      r.attestation === 'workshop' &&
      !r.confirmed_at &&
      ageMs < 24 * 60 * 60 * 1000
    )
  }).length

  // Top workshop by visit count (for the "Provider" card)
  const workshopVisits: Record<string, { count: number; name: string }> = {}
  for (const r of records ?? []) {
    if (!r.workshop_id) continue
    const key = r.workshop_id
    workshopVisits[key] = workshopVisits[key] ?? {
      count: 0,
      name: r.workshop_name_freetext ?? 'Workshop',
    }
    workshopVisits[key].count += 1
  }
  const topWorkshopEntry = Object.entries(workshopVisits).sort(
    (a, b) => b[1].count - a[1].count
  )[0]

  // Hero badges
  const heroBadges: Array<{
    label: string
    tone: 'volt' | 'wallet' | 'signal' | 'iron'
  }> = []
  if (pendingCount > 0) {
    heroBadges.push({ label: `${pendingCount} pending`, tone: 'wallet' })
  }
  if (verifiedRecords >= 10) {
    heroBadges.push({ label: 'Well-serviced', tone: 'volt' })
  } else if (verifiedRecords >= 1) {
    heroBadges.push({ label: 'Verified', tone: 'volt' })
  }

  const ownerSinceLabel = vehicle.created_at
    ? new Date(vehicle.created_at).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <main className="min-h-[100svh] pb-32 bg-noir">
      {/* Sticky condensed header — mobile only */}
      <div className="md:hidden">
        <ScrollAwareHeader
          title={vehicleTitle}
          subtitle={vehicleSubline}
          backHref="/mycars"
          backLabel="My cars"
        />
      </div>

      {/* Desktop "← My cars" — top of column */}
      <div className="hidden md:block max-w-3xl mx-auto px-6 pt-6">
        <Link
          href="/mycars"
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← My cars
        </Link>
      </div>

      {/* HERO — edge to edge mobile, column-bound desktop */}
      <div className="md:max-w-3xl md:mx-auto md:mt-4 md:px-6">
        <VehicleHero
          vehicleId={id}
          currentUrl={vehicle.hero_image_url}
          badges={heroBadges}
          isOwner={isOwner}
          backHref="/mycars"
          backLabel="My cars"
        />
      </div>

      {/* Content container — padded on mobile, column-bound on desktop */}
      <div className="max-w-3xl mx-auto px-5 md:px-6">

        {/* HEADLINE STRIP — score big number + odometer + plate */}
        <section className="mt-6">
          <div className="flex items-baseline gap-3 flex-wrap">
            {scoreData?.score != null ? (
              <p className="font-mono text-5xl md:text-6xl font-semibold text-volt tabular-nums tracking-tightest leading-none">
                {scoreData.score}
                <span className="text-ash text-lg font-normal ml-1">/100</span>
              </p>
            ) : (
              <p className="font-mono text-5xl md:text-6xl font-semibold text-ash tabular-nums tracking-tightest leading-none">
                —<span className="text-ash text-lg font-normal ml-1">/100</span>
              </p>
            )}
            <p className="text-[10px] tracking-[0.3em] uppercase text-ash">
              Vehkit score
            </p>
          </div>

          <div className="mt-4">
            <p className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter leading-tight">
              {vehicleTitle}
            </p>
            <p className="text-sm text-ash mt-1">
              {[
                vehicle.year && String(vehicle.year),
                vehicle.color,
                `${vehicle.make} ${vehicle.model}`,
                vehicle.plate_emirate && vehicle.plate_number
                  ? `${vehicle.plate_emirate} · ${vehicle.plate_number}`
                  : vehicle.plate_number,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          </div>
        </section>

        {/* QUICK STATS ROW — PropertyFinder-style separator-divided */}
        <section className="mt-6 grid grid-cols-4 divide-x divide-seam border-y border-seam">
          <QuickStat
            value={vehicle.current_odometer?.toLocaleString() ?? '—'}
            label="km"
          />
          <QuickStat value={String(verifiedRecords)} label="Verified" />
          <QuickStat
            value={String(distinctWorkshops)}
            label={distinctWorkshops === 1 ? 'Workshop' : 'Workshops'}
          />
          <QuickStat
            value={totalSpent > 0 ? `${(totalSpent / 1000).toFixed(1)}k` : '—'}
            label="AED logged"
          />
        </section>

        {/* ACTION ROW */}
        {isOwner && (
          <section className="mt-6 -mx-5 md:-mx-6 px-5 md:px-6 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              <ShareSheet vehicleId={id} baseUrl={baseUrl} />
              <WorkshopCodeSheet vehicleId={id} />
              <FamilyShareSheet vehicleId={id} baseUrl={baseUrl} />
              <Link
                href={`/vehicles/${id}/edit`}
                className="pill-outline text-sm whitespace-nowrap"
              >
                Edit
              </Link>
            </div>
          </section>
        )}

        {/* META — VIN + owner since */}
        {(vehicle.vin || ownerSinceLabel) && (
          <section className="mt-5 flex items-center gap-4 text-[11px] text-ash/70 flex-wrap">
            {vehicle.vin && (
              <span className="font-mono">
                VIN <span className="text-ash">{vehicle.vin}</span>
              </span>
            )}
            {ownerSinceLabel && (
              <span className="tracking-widest uppercase">
                On Vehkit since {ownerSinceLabel}
              </span>
            )}
          </section>
        )}

        {errorMsg && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* SCORE BREAKDOWN — only when there's a score */}
        {scoreData?.score != null && (
          <section className="mt-10">
            <SectionHeader
              title="Score breakdown"
              hint="What the number is made of"
            />
            <div className="card p-5 space-y-3">
              <ScoreLine
                label="Verification"
                value={Number(scoreData.verification_pts) ?? 0}
                max={40}
              />
              <ScoreLine
                label="Compliance"
                value={Number(scoreData.compliance_pts) ?? 0}
                max={30}
              />
              <ScoreLine
                label="Consistency"
                value={Number(scoreData.consistency_pts) ?? 0}
                max={20}
              />
              <ScoreLine
                label="Recency"
                value={Number(scoreData.recency_pts) ?? 0}
                max={10}
              />
              <p className="text-[11px] text-ash/70 leading-relaxed pt-3 border-t border-seam">
                Higher score = stronger passport at resale. Verified entries by
                multiple workshops, on-time reminder compliance, and recent
                service all contribute.
              </p>
            </div>
          </section>
        )}

        {/* TOP WORKSHOP — PF insight-card visual language */}
        {topWorkshopEntry && (
          <section className="mt-10">
            <SectionHeader title="Most-frequent workshop" />
            <TopWorkshopCard
              workshopId={topWorkshopEntry[0]}
              workshopName={topWorkshopEntry[1].name}
              visitCount={topWorkshopEntry[1].count}
              totalVerified={verifiedRecords}
              records={records ?? []}
            />
          </section>
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

        {/* SERVICE HISTORY */}
        <section className="mt-10">
          <SectionHeader
            title="Service history"
            hint={
              records && records.length > 0
                ? `${records.length} ${records.length === 1 ? 'entry' : 'entries'}`
                : 'Empty'
            }
          />

          {records && records.length > 0 ? (
            <ol className="space-y-5">
              {records.map((r) => (
                <ServiceRecordRow
                  key={r.id}
                  record={r}
                  vehicleId={id}
                  isOwner={isOwner}
                  autoOpenReview={autoReviewRecordId === r.id}
                />
              ))}
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

/**
 * PropertyFinder-style insight card with valence icon.
 * Bold headline + supporting line + thumbs up / neutral / down on the right.
 */
function InsightCard({
  headline,
  detail,
  tone,
}: {
  headline: string
  detail: string
  tone: 'good' | 'bad' | 'neutral'
}) {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-base md:text-lg font-semibold text-chalk leading-snug">
          {headline}
        </p>
        <p className="text-xs text-ash mt-1.5 leading-relaxed">{detail}</p>
      </div>
      <div className="shrink-0">
        <ValenceIcon tone={tone} />
      </div>
    </div>
  )
}

function ValenceIcon({ tone }: { tone: 'good' | 'bad' | 'neutral' }) {
  if (tone === 'good') {
    return (
      <div className="flex items-center gap-0.5">
        <span className="w-1.5 h-7 bg-volt rounded-pill" />
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-volt"
          aria-hidden
        >
          <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
        </svg>
      </div>
    )
  }
  if (tone === 'bad') {
    return (
      <div className="flex items-center gap-0.5">
        <span className="w-1.5 h-7 bg-signal rounded-pill" />
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-signal"
          aria-hidden
        >
          <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
        </svg>
      </div>
    )
  }
  // neutral — softer, ash thumbs sideways
  return (
    <div className="flex items-center gap-0.5">
      <span className="w-1.5 h-7 bg-wallet rounded-pill" />
      <svg
        width="36"
        height="36"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-wallet"
        aria-hidden
      >
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </svg>
    </div>
  )
}

/**
 * PropertyFinder insight-card pattern: bold headline left, supporting line
 * below, mark on the right. No grids, no chrome. Punchy and scannable.
 */
function TopWorkshopCard({
  workshopId,
  workshopName,
  visitCount,
  totalVerified,
  records,
}: {
  workshopId: string
  workshopName: string
  visitCount: number
  totalVerified: number
  records: Array<{
    workshop_id?: string | null
    cost_aed: number | null | string
    service_date: string
  }>
}) {
  const myRecords = records.filter((r) => r.workshop_id === workshopId)
  const totalSpent = myRecords.reduce(
    (s, r) => s + (r.cost_aed ? Number(r.cost_aed) : 0),
    0
  )
  const lastVisit = myRecords
    .map((r) => new Date(r.service_date).getTime())
    .sort((a, b) => b - a)[0]
  const lastVisitLabel = lastVisit
    ? new Date(lastVisit).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : null

  const sharePct =
    totalVerified > 0 ? Math.round((visitCount / totalVerified) * 100) : 0

  const sub = [
    `${sharePct}% of verified history`,
    totalSpent > 0 ? `AED ${totalSpent.toLocaleString()} total` : null,
    lastVisitLabel ? `last visit ${lastVisitLabel}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="card p-5 flex items-start gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-base md:text-lg font-semibold text-chalk leading-snug">
          {workshopName}
        </p>
        <p className="text-xs text-ash mt-1.5 leading-relaxed">{sub}</p>
      </div>
      <div className="shrink-0">
        <svg
          width="40"
          height="40"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-volt"
          aria-hidden
        >
          <path d="M14.7 6.3a1 1 0 010 1.4l-1.5 1.5a1 1 0 01-1.4 0L9 6.3a1 1 0 010-1.4l1.5-1.5a1 1 0 011.4 0zM6 8l-3 3 6 6 3-3-6-6zm9 9l3-3 3 3-3 3-3-3z" />
        </svg>
      </div>
    </div>
  )
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h2 className="text-base font-semibold text-chalk tracking-tight">
        {title}
      </h2>
      {hint && (
        <p className="text-[10px] tracking-widest uppercase text-ash">{hint}</p>
      )}
    </div>
  )
}

function QuickStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center py-4 px-2">
      <p className="font-mono text-xl md:text-2xl font-semibold text-chalk tabular-nums tracking-tight leading-none">
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1.5 truncate">
        {label}
      </p>
    </div>
  )
}

function ScoreLine({
  label,
  value,
  max,
}: {
  label: string
  value: number
  max: number
}) {
  const pct = Math.min(100, (value / max) * 100)
  const color =
    value >= max * 0.66
      ? 'bg-volt'
      : value >= max * 0.33
        ? 'bg-wallet'
        : 'bg-signal/70'
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ash tracking-wide">{label}</span>
        <span className="font-mono tabular-nums text-chalk">
          {value}
          <span className="text-ash"> / {max}</span>
        </span>
      </div>
      <div className="h-1 bg-iron rounded-full mt-1 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

