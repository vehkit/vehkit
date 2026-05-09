import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { MyCarsList, type VehicleSummary } from '@/components/MyCarsList'

export default async function MyCarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Parallelize: vehicles + per-vehicle pending count + per-vehicle history.
  const [vehiclesRes, pendingRes, historyRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select('vehicle_id')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo)
      .is('confirmed_at', null)
      .is('rejected_at', null),
    // Lightweight per-vehicle service summary — non-rejected only.
    // Sorted desc so the first row per vehicle = the most recent service.
    supabase
      .from('service_records')
      .select('vehicle_id, service_date, workshop_name_freetext, cost_aed')
      .is('rejected_at', null)
      .order('service_date', { ascending: false }),
  ])

  const vehicles = vehiclesRes.data
  const pendingEntries = pendingRes.data
  const historyRows = historyRes.data ?? []

  const pendingByVehicle = new Map<string, number>()
  for (const p of pendingEntries ?? []) {
    pendingByVehicle.set(p.vehicle_id, (pendingByVehicle.get(p.vehicle_id) ?? 0) + 1)
  }

  // Aggregate per-vehicle: last service date + workshop, total count, total spend.
  // Rows are pre-sorted desc by service_date, so the first row per vehicle is
  // the most recent — `lastService` only gets set on first encounter.
  const summaryByVehicle = new Map<string, VehicleSummary>()
  for (const row of historyRows) {
    const vid = row.vehicle_id as string
    if (!vid) continue
    const existing = summaryByVehicle.get(vid)
    if (!existing) {
      summaryByVehicle.set(vid, {
        serviceCount: 1,
        totalSpend: Number(row.cost_aed ?? 0),
        lastServiceDate: row.service_date as string | null,
        lastWorkshop: (row.workshop_name_freetext as string | null) ?? null,
      })
    } else {
      existing.serviceCount += 1
      existing.totalSpend += Number(row.cost_aed ?? 0)
    }
  }

  // Garage-wide stats for the editorial header
  const totalVehicles = vehicles?.length ?? 0
  const totalKmTracked = (vehicles ?? []).reduce(
    (sum, v) => sum + (v.current_odometer ?? 0),
    0,
  )
  const totalPending = pendingEntries?.length ?? 0
  const totalServices = historyRows.length

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      {/* Top bar — mobile only; desktop uses AppNav */}
      <header className="px-6 pt-6 pb-2 md:hidden max-w-3xl mx-auto">
        <p className="nav-pill">vehkit</p>
      </header>

      {/* Editorial header — PF rhythm: title + supporting stat strip.
          Compact: title and stats share a row on desktop, stack on mobile. */}
      <div className="px-6 pt-2 md:pt-5 pb-3 max-w-3xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none">
            Your garage
          </h1>
          {totalVehicles > 0 && (
            <div className="flex items-stretch gap-3">
              <Stat
                value={totalVehicles.toString()}
                label={totalVehicles === 1 ? 'vehicle' : 'vehicles'}
              />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat
                value={totalKmTracked.toLocaleString()}
                label="km tracked"
                mono
              />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat
                value={totalServices.toString()}
                label={totalServices === 1 ? 'service' : 'services'}
              />
              {totalPending > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={totalPending.toString()}
                    label="pending"
                    tone="wallet"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="px-6 max-w-3xl mx-auto">
        {vehicles && vehicles.length > 0 ? (
          <MyCarsList
            vehicles={vehicles}
            currentUserId={user.id}
            pendingByVehicle={Object.fromEntries(pendingByVehicle)}
            summaryByVehicle={Object.fromEntries(summaryByVehicle)}
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

      {/* Floating add button — anchored bottom-right on desktop, bottom-center
          on mobile (above the tab bar). Slim PF pill, not a full-width slab. */}
      {vehicles && vehicles.length > 0 && (
        <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-20">
          <Link
            href="/vehicles/new"
            className="inline-flex items-center gap-2 bg-volt text-noir font-semibold text-sm px-5 h-11 rounded-pill shadow-lg shadow-noir/40 hover:bg-volt/90 transition-colors"
            aria-label="Add a vehicle"
          >
            <svg
              width="16"
              height="16"
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
            <span className="hidden md:inline">Add a vehicle</span>
            <span className="md:hidden">Add</span>
          </Link>
        </div>
      )}
    </main>
  )
}

function Stat({
  value,
  label,
  mono,
  tone,
}: {
  value: string
  label: string
  mono?: boolean
  tone?: 'wallet'
}) {
  const valueColor = tone === 'wallet' ? 'text-wallet' : 'text-chalk'
  return (
    <div className="min-w-0">
      <p
        className={`text-sm md:text-base font-semibold ${valueColor} ${
          mono ? 'font-mono tabular-nums tracking-tight' : 'tracking-tight'
        } leading-none`}
      >
        {value}
      </p>
      <p className="text-[9px] md:text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
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
