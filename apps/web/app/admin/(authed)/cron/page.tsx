import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Reminder = {
  id: string
  reminder_type: string
  status: string
  due_date: string | null
  due_at_km: number | null
  notified_at: string | null
  created_at: string
  vehicle_id: string
}

async function triggerDigest() {
  'use server'
  const url = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const secret = process.env.CRON_SECRET ?? ''
  if (!url || !secret) return

  try {
    await fetch(`${url}/api/cron/reminder-digest`, {
      headers: { Authorization: `Bearer ${secret}` },
      cache: 'no-store',
    })
  } catch {
    // swallow — admin will see updated stats on next load
  }
  revalidatePath('/admin/cron')
}

export default async function AdminCronPage() {
  const supabase = createAdminClient()

  // Reminder pipeline stats
  const [{ count: openCount }, { count: doneCount }, { count: notifiedCount }] =
    await Promise.all([
      supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'open'),
      supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'done'),
      supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .not('notified_at', 'is', null),
    ])

  // Recently notified (last 14 days)
  const fourteenDaysAgo = new Date()
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const { data: recentNotified } = await supabase
    .from('reminders')
    .select('id, reminder_type, status, due_date, due_at_km, notified_at, created_at, vehicle_id')
    .gte('notified_at', fourteenDaysAgo.toISOString())
    .order('notified_at', { ascending: false })
    .limit(20)

  // Due soon (open, due within 14 days OR no notified_at and due_date in past)
  const today = new Date()
  const fourteenDaysAhead = new Date()
  fourteenDaysAhead.setDate(today.getDate() + 14)

  const { data: dueSoon } = await supabase
    .from('reminders')
    .select('id, reminder_type, status, due_date, due_at_km, notified_at, created_at, vehicle_id')
    .eq('status', 'open')
    .lte('due_date', fourteenDaysAhead.toISOString().slice(0, 10))
    .order('due_date', { ascending: true })
    .limit(20)

  const recent = (recentNotified ?? []) as Reminder[]
  const due = (dueSoon ?? []) as Reminder[]

  // Vehicle name resolution
  const vIds = [...new Set([...recent, ...due].map((r) => r.vehicle_id))]
  const { data: vehicles } =
    vIds.length > 0
      ? await supabase.from('vehicles').select('id, make, model, nickname, plate_number').in('id', vIds)
      : { data: [] }
  const vMap = new Map<string, string>()
  for (const v of vehicles ?? []) {
    vMap.set(v.id, v.nickname || `${v.make} ${v.model}` || v.plate_number || v.id.slice(0, 6))
  }

  // Audit log activity (last 50)
  const { data: audit } = await supabase
    .from('audit_log')
    .select('id, action, resource_type, created_at, actor_id, resource_id')
    .order('created_at', { ascending: false })
    .limit(50)

  // Workshop attempts in last 24h (rate limiting / abuse signal)
  const dayAgo = new Date()
  dayAgo.setDate(dayAgo.getDate() - 1)

  const { count: shopAttempts24h } = await supabase
    .from('shop_attempts')
    .select('*', { count: 'exact', head: true })
    .gte('attempted_at', dayAgo.toISOString())

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Cron + jobs
          </h1>
          <p className="text-sm text-ash mt-1">
            Daily reminder digest · 04:00 UTC · 08:00 GST
          </p>
        </div>
        <form action={triggerDigest}>
          <button
            type="submit"
            className="text-xs tracking-widest uppercase border border-seam hover:border-volt hover:text-volt transition-colors px-4 py-2 rounded-DEFAULT"
          >
            Trigger digest now
          </button>
        </form>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Open reminders" value={String(openCount ?? 0)} />
        <Stat label="Completed" value={String(doneCount ?? 0)} />
        <Stat label="Ever notified" value={String(notifiedCount ?? 0)} />
        <Stat label="Shop attempts · 24h" value={String(shopAttempts24h ?? 0)} />
      </div>

      <section className="grid md:grid-cols-2 gap-4 mb-8">
        <div className="card p-5">
          <h2 className="text-sm tracking-widest uppercase text-ash mb-4">
            Due in next 14 days
          </h2>
          {due.length === 0 ? (
            <p className="text-sm text-ash">Nothing due soon.</p>
          ) : (
            <ul className="space-y-2">
              {due.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 text-sm border-b border-seam/50 last:border-0 pb-2 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-chalk truncate">{humanize(r.reminder_type)}</p>
                    <p className="text-xs text-ash truncate">
                      {vMap.get(r.vehicle_id) ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-chalk">
                      {r.due_date
                        ? new Date(r.due_date).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                          })
                        : `${r.due_at_km?.toLocaleString() ?? '—'} km`}
                    </p>
                    {r.notified_at && (
                      <p className="text-[10px] text-volt tracking-widest uppercase mt-0.5">
                        sent
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card p-5">
          <h2 className="text-sm tracking-widest uppercase text-ash mb-4">
            Recently notified · 14d
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-ash">No notifications sent in the last 14 days.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((r) => (
                <li
                  key={r.id}
                  className="flex items-start justify-between gap-3 text-sm border-b border-seam/50 last:border-0 pb-2 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-chalk truncate">{humanize(r.reminder_type)}</p>
                    <p className="text-xs text-ash truncate">
                      {vMap.get(r.vehicle_id) ?? '—'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-ash font-mono">
                      {r.notified_at
                        ? new Date(r.notified_at).toLocaleString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="card p-5">
        <h2 className="text-sm tracking-widest uppercase text-ash mb-4">
          Audit log · last 50
        </h2>
        {(audit ?? []).length === 0 ? (
          <p className="text-sm text-ash">No audit activity.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs tracking-widest uppercase text-ash">
                  <th className="px-2 py-2 font-normal">When</th>
                  <th className="px-2 py-2 font-normal">Action</th>
                  <th className="px-2 py-2 font-normal">Resource</th>
                  <th className="px-2 py-2 font-normal">Actor</th>
                </tr>
              </thead>
              <tbody>
                {(audit ?? []).map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-seam/50 hover:bg-iron/30 transition-colors"
                  >
                    <td className="px-2 py-2 text-xs text-ash font-mono whitespace-nowrap">
                      {new Date(a.created_at).toLocaleString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-2 py-2 text-chalk">{a.action}</td>
                    <td className="px-2 py-2 text-ash">{a.resource_type}</td>
                    <td className="px-2 py-2 text-xs text-ash font-mono">
                      {a.actor_id ? a.actor_id.slice(0, 8) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs tracking-widest uppercase text-ash">{label}</p>
      <p className="text-2xl font-semibold text-chalk mt-1 font-mono tabular-nums">
        {value}
      </p>
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
