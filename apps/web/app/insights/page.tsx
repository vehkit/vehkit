import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { GaragePulse, type FuelLogRow, type ActivityEvent } from '@/components/GaragePulse'

/**
 * /insights — the analytics deep dive that used to live on /mycars.
 *
 * Cost-per-km, per-car efficiency, service spend, recent activity. This
 * is the power-user surface. /mycars is now a clean list; users find this
 * via a small "Garage insights →" link at the bottom of the garage.
 *
 * If a user has no logged activity yet, we send them back to /mycars —
 * insights don't mean anything without data.
 */
export default async function InsightsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Full query set — same data /mycars used to fetch, now isolated here.
  const [vehiclesRes, historyRes, docsRes, fuelRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select('vehicle_id, service_date, workshop_name_freetext, cost_aed, created_at, id')
      .is('rejected_at', null)
      .order('service_date', { ascending: false }),
    supabase
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, label, expires_at, created_at')
      .is('archived_at', null),
    supabase
      .from('fuel_logs')
      .select(
        'id, vehicle_id, logged_at, odometer_km, liters, total_aed, fuel_grade, station_name',
      )
      .order('logged_at', { ascending: false }),
  ])

  const vehicles = vehiclesRes.data ?? []
  const historyRows = historyRes.data ?? []
  const documents = (docsRes.data ?? []) as Array<{
    id: string
    vehicle_id: string
    doc_type: string
    label: string | null
    expires_at: string | null
    created_at: string
  }>
  const fuelLogs = (fuelRes.data ?? []) as FuelLogRow[]

  // Bounce back to /mycars if nothing to show yet
  if (vehicles.length === 0 || (historyRows.length === 0 && fuelLogs.length === 0)) {
    redirect('/mycars')
  }

  // Per-vehicle summary — same shape GaragePulse expects
  const summaryByVehicle = new Map<
    string,
    {
      serviceCount: number
      totalSpend: number
      lastServiceDate: string | null
      lastWorkshop: string | null
    }
  >()
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

  // Recent activity timeline — services + fuel + docs mixed
  const vehiclesById = new Map(
    vehicles.map((v) => [v.id, v.nickname ?? `${v.make} ${v.model}`]),
  )
  const events: ActivityEvent[] = []
  for (const r of historyRows.slice(0, 8)) {
    events.push({
      kind: 'service',
      at:
        (r as { service_date?: string | null }).service_date ??
        (r as { created_at?: string }).created_at ??
        '',
      vehicleId: r.vehicle_id as string,
      vehicleLabel: vehiclesById.get(r.vehicle_id as string) ?? 'Vehicle',
      label:
        (r as { workshop_name_freetext?: string | null })
          .workshop_name_freetext ?? 'Service entry',
      meta:
        (r as { cost_aed?: number | null }).cost_aed != null
          ? `AED ${Number((r as { cost_aed?: number }).cost_aed).toLocaleString()}`
          : null,
    })
  }
  for (const f of fuelLogs.slice(0, 8)) {
    events.push({
      kind: 'fuel',
      at: f.logged_at,
      vehicleId: f.vehicle_id,
      vehicleLabel: vehiclesById.get(f.vehicle_id) ?? 'Vehicle',
      label: f.station_name ?? 'Fill-up',
      meta:
        f.total_aed != null
          ? `${Number(f.liters).toFixed(1)} L · AED ${Number(
              f.total_aed,
            ).toLocaleString()}`
          : `${Number(f.liters).toFixed(1)} L`,
    })
  }
  for (const d of documents.slice(0, 4)) {
    events.push({
      kind: 'doc',
      at: d.created_at,
      vehicleId: d.vehicle_id,
      vehicleLabel: vehiclesById.get(d.vehicle_id) ?? 'Vehicle',
      label: d.label ?? d.doc_type.replace(/_/g, ' '),
      meta: d.expires_at ? `Expires ${d.expires_at}` : null,
    })
  }
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const recentActivity = events.slice(0, 6)

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      {/* Top bar — mobile */}
      <header className="px-6 md:px-10 pt-6 pb-2 md:hidden max-w-[1240px] mx-auto">
        <p className="nav-pill">vehkit · insights</p>
      </header>

      <div className="px-6 md:px-10 pt-4 md:pt-8 pb-6 max-w-[1240px] mx-auto">
        <Link
          href="/mycars"
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← My cars
        </Link>
        <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight mt-3">
          Garage insights
        </h1>
        <p className="text-sm md:text-base text-ash mt-2 leading-relaxed max-w-2xl">
          What your fleet actually costs to keep on the road, how it&apos;s
          tracking against itself over time, and what you&apos;ve been up to
          lately.
        </p>
      </div>

      <section className="px-6 md:px-10 max-w-[1240px] mx-auto">
        <GaragePulse
          vehicles={vehicles.map((v) => ({
            id: v.id,
            label: v.nickname ?? `${v.make} ${v.model}`,
            currentOdometer: v.current_odometer ?? null,
          }))}
          fuelLogs={fuelLogs}
          summaryByVehicle={Object.fromEntries(summaryByVehicle)}
          documentsCount={documents.length}
          activity={recentActivity}
        />
      </section>
    </main>
  )
}
