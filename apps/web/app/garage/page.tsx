import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { reminderStatus, type ReminderRow } from '@/lib/reminders'

export default async function GaragePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  // Count due/overdue reminders across all vehicles
  const { data: openReminders } = await supabase
    .from('reminders')
    .select('id, vehicle_id, reminder_type, due_date, due_at_km, status, notes')
    .eq('status', 'open')

  const reminderCount = (openReminders ?? []).filter((r: ReminderRow) => {
    const v = vehicles?.find((x) => x.id === r.vehicle_id)
    const s = reminderStatus(r, v?.current_odometer ?? null)
    return s === 'overdue' || s === 'due_soon'
  }).length

  return (
    <main className="min-h-[100svh] pb-24">
      <header className="px-6 pt-10 pb-6 flex items-center justify-between">
        <div>
          <p className="nav-pill">vehkit</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-1">
            Garage
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="/reminders"
            className="relative text-sm text-ash hover:text-chalk transition-colors"
          >
            Reminders
            {reminderCount > 0 && (
              <span className="absolute -top-1 -right-3 bg-signal text-noir text-[10px] font-mono font-bold px-1.5 py-px rounded-pill">
                {reminderCount}
              </span>
            )}
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-ash hover:text-chalk transition-colors">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="px-6">
        <p className="text-xs text-ash">
          <span className="font-mono">{user.email}</span>
        </p>
      </div>

      <section className="px-6 mt-8 space-y-3">
        {vehicles && vehicles.length > 0 ? (
          vehicles.map((v) => (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className="card block p-5 hover:border-volt/30 transition-colors group"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {(v.year || v.color) && (
                    <p className="nav-pill text-[10px]">
                      {[v.year, v.color].filter(Boolean).join(' · ')}
                    </p>
                  )}
                  <h2 className="text-xl font-semibold text-chalk mt-1 truncate">
                    {v.nickname ?? `${v.make} ${v.model}`}
                  </h2>
                  <p className="text-sm text-ash mt-0.5 truncate">
                    {v.make} {v.model}
                    {v.plate_number && (
                      <>
                        {' · '}
                        <span className="font-mono">{v.plate_number}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-2xl font-semibold text-chalk tabular-nums">
                    {v.current_odometer?.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-[10px] tracking-widest uppercase text-ash mt-0.5">km</p>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="card p-10 text-center">
            <p className="text-chalk font-medium">No vehicles yet.</p>
            <p className="text-sm text-ash mt-2 mb-6">
              Add your first car to start its passport.
            </p>
            <Link href="/vehicles/new" className="pill-primary inline-flex items-center">
              Add a vehicle
            </Link>
          </div>
        )}
      </section>

      {/* Sticky bottom add button (mobile-first) */}
      {vehicles && vehicles.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 pointer-events-none">
          <Link
            href="/vehicles/new"
            className="pill-primary block text-center pointer-events-auto max-w-md mx-auto"
          >
            + Add a vehicle
          </Link>
        </div>
      )}
    </main>
  )
}
