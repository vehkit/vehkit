import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { snoozeReminder, completeReminder } from '@/app/actions/reminders'
import {
  reminderStatus,
  reminderLabel,
  humanizeReminderType,
  type ReminderRow,
} from '@/lib/reminders'

type VehicleLite = {
  id: string
  make: string
  model: string
  nickname: string | null
  current_odometer: number | null
}

export const dynamic = 'force-dynamic'

type FeedItem =
  | {
      kind: 'workshop_entry'
      id: string
      ts: number
      vehicleId: string
      title: string
      subtitle: string
      hoursLeft: number
    }
  | {
      kind: 'reminder'
      id: string
      ts: number
      vehicleId: string
      title: string
      subtitle: string
      meta: string
      tone: 'signal' | 'wallet'
    }
  | {
      kind: 'review'
      id: string
      ts: number
      title: string
      subtitle: string
      rating: number
    }

function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 0) {
    const future = Math.abs(diff)
    const days = Math.round(future / (24 * 60 * 60 * 1000))
    if (days < 1) return 'today'
    if (days === 1) return 'tomorrow'
    if (days < 7) return `in ${days}d`
    if (days < 30) return `in ${Math.round(days / 7)}w`
    return `in ${Math.round(days / 30)}mo`
  }
  const minutes = Math.floor(diff / (60 * 1000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  if (days < 30) return `${Math.floor(days / 7)}w`
  return `${Math.floor(days / 30)}mo`
}

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/notifications')

  // 1. Pending workshop entries (last 24h)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: pending } = await supabase
    .from('service_records')
    .select(
      'id, vehicle_id, service_type, workshop_name_freetext, created_at, attestation'
    )
    .eq('attestation', 'workshop')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })

  // 2. Open reminders
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, vehicle_id, reminder_type, due_date, due_at_km, status, notes')
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname, current_odometer')

  const vMap = new Map<string, VehicleLite>(
    (vehicles ?? []).map((v) => [
      v.id,
      {
        id: v.id,
        make: v.make,
        model: v.model,
        nickname: v.nickname,
        current_odometer: v.current_odometer,
      },
    ])
  )

  // 3. Workshop reviews
  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let workshopReviews:
    | { id: string; rating: number; comment: string | null; created_at: string }[]
    | null = null
  if (membership?.workshop_id) {
    const { data } = await supabase
      .from('workshop_reviews')
      .select('id, rating, comment, created_at')
      .eq('workshop_id', membership.workshop_id)
      .order('created_at', { ascending: false })
      .limit(10)
    workshopReviews = data
  }

  // Merge into one feed sorted by recency
  const feed: FeedItem[] = []

  for (const p of pending ?? []) {
    const v = vMap.get(p.vehicle_id)
    const vehicleName = v ? v.nickname ?? `${v.make} ${v.model}` : 'your car'
    const ageMs = Date.now() - new Date(p.created_at).getTime()
    const hoursLeft = Math.max(
      1,
      Math.ceil((24 * 60 * 60 * 1000 - ageMs) / (60 * 60 * 1000))
    )
    const workshopName = p.workshop_name_freetext ?? 'A workshop'
    feed.push({
      kind: 'workshop_entry',
      id: p.id,
      ts: new Date(p.created_at).getTime(),
      vehicleId: p.vehicle_id,
      title: `${workshopName} logged ${humanize(p.service_type)}`,
      subtitle: `${vehicleName} · pending ${hoursLeft}h to retract`,
      hoursLeft,
    })
  }

  for (const r of (reminders ?? []) as ReminderRow[]) {
    const v = vMap.get(r.vehicle_id)
    const vehicleName = v ? v.nickname ?? `${v.make} ${v.model}` : 'your car'
    const status = reminderStatus(r, v?.current_odometer ?? null)
    if (status !== 'overdue' && status !== 'due_soon') continue
    const tone: 'signal' | 'wallet' = status === 'overdue' ? 'signal' : 'wallet'
    const ts = r.due_date ? new Date(r.due_date).getTime() : Date.now()
    feed.push({
      kind: 'reminder',
      id: r.id,
      ts,
      vehicleId: r.vehicle_id,
      title:
        status === 'overdue'
          ? `Overdue: ${humanizeReminderType(r.reminder_type)}`
          : `${humanizeReminderType(r.reminder_type)} due soon`,
      subtitle: vehicleName,
      meta: reminderLabel(r, v?.current_odometer ?? null),
      tone,
    })
  }

  for (const rev of workshopReviews ?? []) {
    feed.push({
      kind: 'review',
      id: rev.id,
      ts: new Date(rev.created_at).getTime(),
      title: `${rev.rating}★ review on your workshop`,
      subtitle: rev.comment ? `"${rev.comment}"` : 'No comment',
      rating: rev.rating,
    })
  }

  // Sort: overdue first (negative ts diff = past), then by recency
  feed.sort((a, b) => {
    if (a.kind === 'reminder' && a.tone === 'signal' && (b.kind !== 'reminder' || b.tone !== 'signal')) return -1
    if (b.kind === 'reminder' && b.tone === 'signal' && (a.kind !== 'reminder' || a.tone !== 'signal')) return 1
    return b.ts - a.ts
  })

  // Compute split counts for stat strip
  const overdueCount = feed.filter(
    (i) => i.kind === 'reminder' && i.tone === 'signal',
  ).length
  const pendingCount = feed.filter((i) => i.kind === 'workshop_entry').length
  const reviewCount = feed.filter((i) => i.kind === 'review').length

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-6 md:pt-8">
        {/* Editorial header */}
        <p className="nav-pill">vehkit · inbox</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mt-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none">
              Activity
            </h1>
            <p className="text-sm text-ash mt-2 leading-relaxed">
              Workshop entries waiting on you, reminders that are due, and
              reviews on shops you run — in one place.
            </p>
          </div>
          {feed.length > 0 && (
            <div className="flex items-stretch gap-3">
              <Stat
                value={feed.length.toString()}
                label={feed.length === 1 ? 'item' : 'items'}
              />
              {overdueCount > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={overdueCount.toString()}
                    label="overdue"
                    tone="signal"
                  />
                </>
              )}
              {pendingCount > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={pendingCount.toString()}
                    label="pending"
                    tone="wallet"
                  />
                </>
              )}
              {reviewCount > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat value={reviewCount.toString()} label="reviews" />
                </>
              )}
            </div>
          )}
        </div>

        {feed.length === 0 ? (
          <div className="card p-10 text-center mt-8">
            <p className="text-chalk font-medium">You're all caught up</p>
            <p className="text-sm text-ash mt-2 leading-relaxed">
              No pending workshop entries, no overdue reminders, no new reviews.
              Check back when something needs your eyes.
            </p>
            <Link
              href="/mycars"
              className="text-xs tracking-widest uppercase text-volt mt-4 inline-block hover:underline"
            >
              Open your garage →
            </Link>
          </div>
        ) : (
          <ul className="mt-6 card divide-y divide-seam">
            {feed.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <FeedRow item={item} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: 'signal' | 'wallet'
}) {
  const valueColor =
    tone === 'signal'
      ? 'text-signal'
      : tone === 'wallet'
        ? 'text-wallet'
        : 'text-chalk'
  return (
    <div className="min-w-0">
      <p
        className={`text-sm md:text-base font-semibold ${valueColor} font-mono tabular-nums tracking-tight leading-none`}
      >
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}

function FeedRow({ item }: { item: FeedItem }) {
  const ts = relativeTime(item.ts)

  if (item.kind === 'reminder') {
    const iconBg = item.tone === 'signal' ? 'bg-signal/15 text-signal' : 'bg-wallet/15 text-wallet'
    return (
      <div className="flex items-start gap-3 px-4 py-3">
        <div
          className={`w-10 h-10 rounded-pill flex items-center justify-center shrink-0 ${iconBg}`}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <Link href={`/vehicles/${item.vehicleId}/service/new`} className="block">
            <p className="text-sm text-chalk leading-snug">
              <span className="font-semibold">{item.title}</span>
              <span className="text-ash"> · {item.subtitle}</span>
            </p>
            <p className="text-xs text-ash mt-0.5 font-mono">{item.meta}</p>
          </Link>
          <div className="flex gap-4 mt-2">
            <form action={snoozeReminder}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="vehicle_id" value={item.vehicleId} />
              <input type="hidden" name="snooze_days" value="7" />
              <button
                type="submit"
                className="text-[11px] tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                Snooze 7d
              </button>
            </form>
            <form action={completeReminder}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="vehicle_id" value={item.vehicleId} />
              <button
                type="submit"
                className="text-[11px] tracking-widest uppercase text-ash hover:text-volt transition-colors"
              >
                Mark done
              </button>
            </form>
          </div>
        </div>
        <span className="text-xs text-ash shrink-0 mt-1">{ts}</span>
      </div>
    )
  }

  if (item.kind === 'workshop_entry') {
    return (
      <Link
        href={`/vehicles/${item.vehicleId}`}
        className="flex items-start gap-3 px-4 py-3 hover:bg-iron/30 transition-colors"
      >
        <div className="w-10 h-10 rounded-pill bg-volt/15 text-volt flex items-center justify-center shrink-0">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M9 12l2 2 4-4" />
            <circle cx="12" cy="12" r="10" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-chalk leading-snug">
            <span className="font-semibold">{item.title}</span>
          </p>
          <p className="text-xs text-ash mt-0.5 truncate">{item.subtitle}</p>
        </div>
        <span className="text-xs text-ash shrink-0 mt-1">{ts}</span>
      </Link>
    )
  }

  // Review
  return (
    <Link
      href="/workshop"
      className="flex items-start gap-3 px-4 py-3 hover:bg-iron/30 transition-colors"
    >
      <div className="w-10 h-10 rounded-pill bg-wallet/15 text-wallet flex items-center justify-center shrink-0 font-mono text-sm font-semibold">
        {item.rating}★
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-chalk leading-snug font-semibold">{item.title}</p>
        <p className="text-xs text-ash mt-0.5 italic line-clamp-2">{item.subtitle}</p>
      </div>
      <span className="text-xs text-ash shrink-0 mt-1">{ts}</span>
    </Link>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
