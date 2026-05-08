import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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

type ReminderWithVehicle = ReminderRow & {
  vehicles: VehicleLite | null
}

export default async function RemindersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: reminders } = await supabase
    .from('reminders')
    .select(
      'id, vehicle_id, reminder_type, due_date, due_at_km, status, notes, vehicles(id, make, model, nickname, current_odometer)'
    )
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })
    .returns<ReminderWithVehicle[]>()

  const open = reminders ?? []

  const overdue = open.filter(
    (r) => reminderStatus(r, r.vehicles?.current_odometer ?? null) === 'overdue'
  )
  const dueSoon = open.filter(
    (r) => reminderStatus(r, r.vehicles?.current_odometer ?? null) === 'due_soon'
  )
  const upcoming = open.filter(
    (r) => reminderStatus(r, r.vehicles?.current_odometer ?? null) === 'ok'
  )

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6">
        <header className="pt-10 pb-6">
          <Link href="/garage" className="nav-pill hover:text-chalk transition-colors">
            ← Garage
          </Link>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-3">
            Reminders
          </h1>
          <p className="text-ash mt-1 text-sm">
            {open.length} {open.length === 1 ? 'open reminder' : 'open reminders'} across your garage
          </p>
        </header>

        <div className="space-y-10">
        {open.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-chalk font-medium">All caught up.</p>
            <p className="text-sm text-ash mt-2">
              Reminders appear here when a service is due. Add a service entry on a vehicle and we'll auto-schedule the next one.
            </p>
          </div>
        )}

        {overdue.length > 0 && (
          <Section title="Overdue" tone="signal">
            {overdue.map((r) => (
              <ReminderCard key={r.id} reminder={r} tone="signal" />
            ))}
          </Section>
        )}

        {dueSoon.length > 0 && (
          <Section title="Due soon" tone="wallet">
            {dueSoon.map((r) => (
              <ReminderCard key={r.id} reminder={r} tone="wallet" />
            ))}
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section title="Upcoming" tone="ash">
            {upcoming.map((r) => (
              <ReminderCard key={r.id} reminder={r} tone="ash" />
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
  tone: 'signal' | 'wallet' | 'ash'
  children: React.ReactNode
}) {
  const colorClass =
    tone === 'signal' ? 'text-signal' : tone === 'wallet' ? 'text-wallet' : 'text-ash'
  return (
    <section>
      <h2 className={`text-xs tracking-widest uppercase font-medium mb-3 ${colorClass}`}>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function ReminderCard({
  reminder,
  tone,
}: {
  reminder: ReminderWithVehicle
  tone: 'signal' | 'wallet' | 'ash'
}) {
  const v = reminder.vehicles
  const borderClass =
    tone === 'signal'
      ? 'border-l-signal'
      : tone === 'wallet'
        ? 'border-l-wallet'
        : 'border-l-seam'

  return (
    <Link
      href={v ? `/vehicles/${v.id}/service/new` : '/garage'}
      className={`card block p-4 border-l-4 ${borderClass} hover:border-volt/30 transition-colors`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-chalk">
            {humanizeReminderType(reminder.reminder_type)}
          </p>
          {v && (
            <p className="text-sm text-ash mt-0.5 truncate">
              {v.nickname ?? `${v.make} ${v.model}`}
            </p>
          )}
          <p className="text-xs text-ash mt-1 font-mono">
            {reminderLabel(reminder, v?.current_odometer ?? null)}
          </p>
        </div>
        <span className="text-xs tracking-widest uppercase text-ash">Log →</span>
      </div>
    </Link>
  )
}
