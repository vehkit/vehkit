import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { reminderStatus, type ReminderRow } from '@/lib/reminders'

export default async function GaragePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Parallelize three queries
  const [vehiclesRes, remindersRes, pendingRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select('*')
      .order('created_at', { ascending: false }),
    supabase
      .from('reminders')
      .select('id, vehicle_id, reminder_type, due_date, due_at_km, status, notes')
      .eq('status', 'open'),
    supabase
      .from('service_records')
      .select('vehicle_id, created_at')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo),
  ])

  const vehicles = vehiclesRes.data
  const openReminders = remindersRes.data
  const pendingEntries = pendingRes.data

  const reminderCount = (openReminders ?? []).filter((r: ReminderRow) => {
    const v = vehicles?.find((x) => x.id === r.vehicle_id)
    const s = reminderStatus(r, v?.current_odometer ?? null)
    return s === 'overdue' || s === 'due_soon'
  }).length

  const pendingByVehicle = new Map<string, number>()
  for (const p of pendingEntries ?? []) {
    pendingByVehicle.set(p.vehicle_id, (pendingByVehicle.get(p.vehicle_id) ?? 0) + 1)
  }
  const totalPending = pendingEntries?.length ?? 0
  const notificationCount = reminderCount + totalPending

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
            href="/notifications"
            className="relative text-sm text-ash hover:text-chalk transition-colors"
          >
            Inbox
            {notificationCount > 0 && (
              <span className="absolute -top-1 -right-3 bg-signal text-noir text-[10px] font-mono font-bold px-1.5 py-px rounded-pill">
                {notificationCount}
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
          vehicles.map((v) => {
            const isShared = v.owner_id !== user.id
            const pendingForThis = pendingByVehicle.get(v.id) ?? 0
            return (
              <Link
                key={v.id}
                href={`/vehicles/${v.id}`}
                className={`card block p-5 hover:border-volt/30 transition-colors group ${
                  pendingForThis > 0 ? 'border-l-4 border-l-wallet' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {(v.year || v.color) && (
                        <p className="nav-pill text-[10px]">
                          {[v.year, v.color].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {isShared && (
                        <span className="text-[10px] tracking-wider uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium">
                          Shared
                        </span>
                      )}
                      {pendingForThis > 0 && (
                        <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium">
                          {pendingForThis} pending
                        </span>
                      )}
                    </div>
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
            )
          })
        ) : (
          <div className="space-y-6">
            <div className="card p-8">
              <p className="nav-pill text-[10px]">Welcome to Vehkit</p>
              <h2 className="text-2xl font-semibold text-chalk tracking-tighter mt-3">
                Every car deserves a passport.
              </h2>
              <p className="text-ash mt-3 leading-relaxed text-sm">
                Track every service, repair, and reminder for every car you own. Workshops verify
                their work with a 6-digit code. The full record stays with the car — even when
                you sell it.
              </p>
              <div className="mt-6 grid grid-cols-3 gap-3 text-center">
                <Bullet n="1" label="Add your car" />
                <Bullet n="2" label="Log services" />
                <Bullet n="3" label="Share record" />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Link
                href="/vehicles/new"
                className="card p-6 hover:border-volt/30 transition-colors block"
              >
                <p className="nav-pill text-[10px]">Get started</p>
                <p className="text-lg font-semibold text-chalk mt-2">Add your car</p>
                <p className="text-sm text-ash mt-1">
                  Make, model, plate — under a minute.
                </p>
                <p className="text-volt text-sm mt-4 font-medium">+ New vehicle →</p>
              </Link>

              <form action={createSampleVehicle}>
                <button
                  type="submit"
                  className="card p-6 hover:border-volt/30 transition-colors text-left w-full"
                >
                  <p className="nav-pill text-[10px]">Just exploring?</p>
                  <p className="text-lg font-semibold text-chalk mt-2">Try with a sample car</p>
                  <p className="text-sm text-ash mt-1">
                    A demo Toyota Corolla with 3 service entries.
                  </p>
                  <p className="text-volt text-sm mt-4 font-medium">+ Sample car →</p>
                </button>
              </form>
            </div>
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

function Bullet({ n, label }: { n: string; label: string }) {
  return (
    <div>
      <div className="w-8 h-8 rounded-pill bg-iron border border-seam flex items-center justify-center mx-auto">
        <span className="font-mono text-sm text-volt font-semibold">{n}</span>
      </div>
      <p className="text-xs text-ash mt-2">{label}</p>
    </div>
  )
}
