import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StarRating } from '@/components/StarRating'
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

export default async function NotificationsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/notifications')

  // 1. Pending workshop entries (last 24h) on vehicles you can see
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: pending } = await supabase
    .from('service_records')
    .select(
      'id, vehicle_id, service_type, workshop_name_freetext, created_at, attestation'
    )
    .eq('attestation', 'workshop')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false })

  // 2. Open reminders across all your vehicles
  const { data: reminders } = await supabase
    .from('reminders')
    .select('id, vehicle_id, reminder_type, due_date, due_at_km, status, notes')
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })

  // Vehicles for context
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

  // 3. Reviews on workshops you're a member of
  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  let workshopReviews:
    | {
        id: string
        rating: number
        comment: string | null
        created_at: string
      }[]
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

  const overdue = (reminders ?? []).filter(
    (r: ReminderRow) =>
      reminderStatus(r, vMap.get(r.vehicle_id)?.current_odometer ?? null) === 'overdue'
  )
  const dueSoon = (reminders ?? []).filter(
    (r: ReminderRow) =>
      reminderStatus(r, vMap.get(r.vehicle_id)?.current_odometer ?? null) === 'due_soon'
  )

  const totalCount =
    (pending?.length ?? 0) +
    overdue.length +
    dueSoon.length +
    (workshopReviews?.length ?? 0)

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6">
        <header className="pt-10 pb-6">
          <Link href="/garage" className="nav-pill hover:text-chalk transition-colors">
            ← Garage
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-3">
            Notifications
          </h1>
          <p className="text-ash mt-1 text-sm">
            {totalCount === 0
              ? 'All caught up.'
              : `${totalCount} ${totalCount === 1 ? 'item' : 'items'} need attention`}
          </p>
        </header>

        <div className="space-y-10">
        {totalCount === 0 && (
          <div className="card p-10 text-center">
            <p className="text-chalk font-medium">All clear.</p>
            <p className="text-sm text-ash mt-2 leading-relaxed">
              No pending workshop entries, no overdue reminders, no new reviews. We'll surface
              things here when they need your attention.
            </p>
          </div>
        )}

        {/* Pending workshop entries */}
        {pending && pending.length > 0 && (
          <Section title="Workshop entries · last 24h" tone="wallet">
            {pending.map((p) => {
              const v = vMap.get(p.vehicle_id)
              const ageMs = Date.now() - new Date(p.created_at).getTime()
              const hoursLeft = Math.max(
                1,
                Math.ceil((24 * 60 * 60 * 1000 - ageMs) / (60 * 60 * 1000))
              )
              return (
                <Link
                  key={p.id}
                  href={`/vehicles/${p.vehicle_id}`}
                  className="card block p-4 border-l-4 border-l-wallet hover:border-volt/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-chalk">
                        {humanize(p.service_type)}
                        {p.workshop_name_freetext && (
                          <span className="text-ash font-normal">
                            {' '}
                            @ {p.workshop_name_freetext}
                          </span>
                        )}
                      </p>
                      {v && (
                        <p className="text-sm text-ash mt-0.5 truncate">
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </p>
                      )}
                      <p className="text-xs text-wallet mt-1">
                        Pending · {hoursLeft}h to retract if needed
                      </p>
                    </div>
                    <span className="text-xs tracking-widest uppercase text-ash">Review →</span>
                  </div>
                </Link>
              )
            })}
          </Section>
        )}

        {/* Overdue reminders */}
        {overdue.length > 0 && (
          <Section title="Overdue" tone="signal">
            {overdue.map((r) => {
              const v = vMap.get(r.vehicle_id)
              return (
                <Link
                  key={r.id}
                  href={`/vehicles/${r.vehicle_id}/service/new`}
                  className="card block p-4 border-l-4 border-l-signal hover:border-volt/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-chalk">
                        {humanizeReminderType(r.reminder_type)}
                      </p>
                      {v && (
                        <p className="text-sm text-ash mt-0.5 truncate">
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </p>
                      )}
                      <p className="text-xs text-ash mt-1 font-mono">
                        {reminderLabel(r, v?.current_odometer ?? null)}
                      </p>
                    </div>
                    <span className="text-xs tracking-widest uppercase text-signal">Log →</span>
                  </div>
                </Link>
              )
            })}
          </Section>
        )}

        {/* Due soon reminders */}
        {dueSoon.length > 0 && (
          <Section title="Due soon" tone="wallet">
            {dueSoon.map((r) => {
              const v = vMap.get(r.vehicle_id)
              return (
                <Link
                  key={r.id}
                  href={`/vehicles/${r.vehicle_id}/service/new`}
                  className="card block p-4 border-l-4 border-l-wallet hover:border-volt/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-chalk">
                        {humanizeReminderType(r.reminder_type)}
                      </p>
                      {v && (
                        <p className="text-sm text-ash mt-0.5 truncate">
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </p>
                      )}
                      <p className="text-xs text-ash mt-1 font-mono">
                        {reminderLabel(r, v?.current_odometer ?? null)}
                      </p>
                    </div>
                    <span className="text-xs tracking-widest uppercase text-wallet">Log →</span>
                  </div>
                </Link>
              )
            })}
          </Section>
        )}

        {/* Workshop reviews (if you run a workshop) */}
        {workshopReviews && workshopReviews.length > 0 && (
          <Section title="Recent reviews on your workshop" tone="volt">
            {workshopReviews.map((rev) => (
              <Link
                key={rev.id}
                href="/workshop"
                className="card block p-4 border-l-4 border-l-volt hover:border-volt/30 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <StarRating rating={rev.rating} size="sm" />
                  <p className="text-xs text-ash">
                    {new Date(rev.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                {rev.comment && (
                  <p className="text-sm text-chalk/90 mt-2 leading-relaxed">"{rev.comment}"</p>
                )}
              </Link>
            ))}
          </Section>
        )}
        </div>
      </div>
    </main>
  )
}

function Section({
  title,
  tone,
  children,
}: {
  title: string
  tone: 'signal' | 'wallet' | 'volt' | 'ash'
  children: React.ReactNode
}) {
  const colorClass =
    tone === 'signal'
      ? 'text-signal'
      : tone === 'wallet'
        ? 'text-wallet'
        : tone === 'volt'
          ? 'text-volt'
          : 'text-ash'
  return (
    <section>
      <h2 className={`text-xs tracking-widest uppercase font-medium mb-3 ${colorClass}`}>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
