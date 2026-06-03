import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { MyCarsList, type VehicleSummary } from '@/components/MyCarsList'

/**
 * /mycars — ONE verb: "show me my cars."
 *
 * Everything else (analytics, suggestions, activity timeline) lives on
 * /insights. The garage list is the front door — vehicle cards are the
 * primary surface, with a compact stat strip in the header for context.
 *
 * Empty state is a single big CTA. No competing actions, no preview
 * cards, no journey scaffold. Trust the user to figure out step 2.
 */
export default async function MyCarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  // Lightweight query set — vehicles, pending workshop entries (for
  // per-card badge), service history (just enough for the "last service"
  // line on the card). Nothing else fetched on this page anymore.
  const [vehiclesRes, pendingRes, historyRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select('vehicle_id')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo)
      .is('confirmed_at', null)
      .is('rejected_at', null),
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

  // Per-vehicle summary — first row per vehicle = last service (rows are
  // pre-sorted desc by service_date).
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

  const totalVehicles = vehicles?.length ?? 0
  const totalKmTracked = (vehicles ?? []).reduce(
    (sum, v) => sum + (v.current_odometer ?? 0),
    0,
  )
  const totalPending = pendingEntries?.length ?? 0
  const totalServices = historyRows.length
  const hasInsights = totalServices > 0

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      {/* Top bar — mobile only; desktop uses AppNav */}
      <header className="px-6 md:px-10 pt-6 pb-2 md:hidden max-w-[1240px] mx-auto">
        <p className="nav-pill">vehkit</p>
      </header>

      {/* Editorial header — Bayut list-page rhythm: big title + supporting
          stat strip. The stat strip is the only intelligence on this page;
          everything else is the vehicle list itself. */}
      <div className="px-6 md:px-10 pt-4 md:pt-8 pb-6 md:pb-8 max-w-[1240px] mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight">
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

      <section className="px-6 md:px-10 max-w-[1240px] mx-auto">
        {vehicles && vehicles.length > 0 ? (
          <>
            <MyCarsList
              vehicles={vehicles}
              currentUserId={user.id}
              pendingByVehicle={Object.fromEntries(pendingByVehicle)}
              summaryByVehicle={Object.fromEntries(summaryByVehicle)}
            />

            {/* Power-user escape — small text link to the analytics page.
                Lives only when there's something useful to see there. */}
            {hasInsights && (
              <div className="mt-10 pt-6 border-t border-seam flex items-center justify-between">
                <p className="text-xs tracking-widest uppercase text-ash">
                  Want more detail?
                </p>
                <Link
                  href="/insights"
                  className="text-sm font-medium text-leaf hover:text-leaf-dk transition-colors inline-flex items-center gap-1.5"
                >
                  Garage insights
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <line x1="5" y1="12" x2="19" y2="12" />
                    <polyline points="12 5 19 12 12 19" />
                  </svg>
                </Link>
              </div>
            )}
          </>
        ) : (
          /* Empty state — ONE primary action. Period. */
          <div className="card p-8 md:p-10 max-w-2xl">
            <p className="nav-pill text-[10px]">Welcome</p>
            <h2 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-3 leading-tight">
              Add your first car.
            </h2>
            <p className="text-ash mt-3 leading-relaxed text-sm md:text-base max-w-md">
              Two minutes. We&apos;ll remind you when anything&apos;s due,
              hold your documents, and build your car&apos;s passport as you
              go.
            </p>

            <Link
              href="/vehicles/new"
              className="pill-primary mt-6 inline-flex items-center gap-2"
            >
              Add your car <span aria-hidden>→</span>
            </Link>

            <form action={createSampleVehicle} className="mt-3">
              <button
                type="submit"
                className="text-sm text-ash hover:text-chalk transition-colors underline-offset-4 hover:underline"
              >
                or try with a sample car
              </button>
            </form>
          </div>
        )}
      </section>
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
