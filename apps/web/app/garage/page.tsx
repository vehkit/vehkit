import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { MyCarsList } from '@/components/MyCarsList'

export default async function GaragePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Parallelize: vehicles + per-vehicle pending count.
  // Reminder/inbox count lives in AppNav now.
  const [vehiclesRes, pendingRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select('vehicle_id')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo),
  ])

  const vehicles = vehiclesRes.data
  const pendingEntries = pendingRes.data

  const pendingByVehicle = new Map<string, number>()
  for (const p of pendingEntries ?? []) {
    pendingByVehicle.set(p.vehicle_id, (pendingByVehicle.get(p.vehicle_id) ?? 0) + 1)
  }

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      {/* Top bar — header on mobile only; desktop uses AppNav */}
      <header className="px-6 pt-6 pb-2 md:hidden max-w-3xl mx-auto">
        <p className="nav-pill">vehkit</p>
      </header>

      {/* Heading */}
      <div className="px-6 pt-2 md:pt-8 pb-3 max-w-3xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter">
          My Cars
        </h1>
      </div>

      <section className="px-6 max-w-3xl mx-auto">
        {vehicles && vehicles.length > 0 ? (
          <MyCarsList
            vehicles={vehicles}
            currentUserId={user.id}
            pendingByVehicle={Object.fromEntries(pendingByVehicle)}
          />
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

      {/* Sticky bottom add button (mobile-first) — sits above bottom tab bar */}
      {vehicles && vehicles.length > 0 && (
        <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 pointer-events-none z-20">
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
