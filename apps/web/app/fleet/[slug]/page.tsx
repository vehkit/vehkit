import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { assignVehicleToFleet, removeVehicleFromFleet } from '@/app/actions/fleet'
import { FleetInviteSheet } from '@/components/FleetInviteSheet'

export const dynamic = 'force-dynamic'

type FleetStats = {
  vehicle_count: number
  member_count: number
  total_km: number
}

export default async function FleetOrgPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const errorMsg = sp.error

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/fleet/${slug}`)

  const { data: org } = await supabase
    .from('fleet_orgs')
    .select('id, name, slug, emirate, created_by, created_at')
    .eq('slug', slug)
    .maybeSingle()

  if (!org) notFound()

  // Stats via SECURITY DEFINER RPC (also acts as membership check)
  const { data: statsRaw } = await supabase.rpc('fleet_org_stats', { p_org_id: org.id })
  const stats =
    (statsRaw as FleetStats) ?? { vehicle_count: 0, member_count: 0, total_km: 0 }

  if (statsRaw === null) {
    // Not a member
    redirect('/fleet?error=Not+a+member+of+this+fleet')
  }

  // Fleet vehicles
  const { data: fleetVehicles } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname, plate_number, current_odometer, owner_id')
    .eq('fleet_org_id', org.id)
    .order('created_at', { ascending: false })

  // Vehicles user owns that aren't in any fleet (candidates to add)
  const { data: candidates } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname, plate_number')
    .eq('owner_id', user.id)
    .is('fleet_org_id', null)
    .order('created_at', { ascending: false })

  // Members (with their roles)
  const { data: members } = await supabase
    .from('fleet_members')
    .select('user_id, role, created_at')
    .eq('org_id', org.id)
    .order('created_at', { ascending: true })

  const myMembership = members?.find((m) => m.user_id === user.id)
  const isAdmin = myMembership?.role === 'admin'

  // Base URL for share links
  const h = await headers()
  const host = h.get('host') ?? 'vehkit.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <Link href="/fleet" className="nav-pill hover:text-chalk transition-colors">
          ← Your fleets
        </Link>

        {/* Header */}
        <header className="card p-6 md:p-8 mt-4">
          <p className="nav-pill text-[10px]">Fleet</p>
          <h1 className="text-3xl md:text-5xl font-semibold text-chalk tracking-tightest mt-2">
            {org.name}
          </h1>
          {org.emirate && <p className="text-ash mt-1">{org.emirate}</p>}
        </header>

        {errorMsg && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* Stats */}
        <section className="grid grid-cols-3 gap-3 mt-6">
          <Stat label="Vehicles" value={stats.vehicle_count.toString()} />
          <Stat label="Members" value={stats.member_count.toString()} />
          <Stat
            label="Total km"
            value={Number(stats.total_km).toLocaleString()}
            small
          />
        </section>

        {/* Fleet vehicles */}
        <section className="mt-10">
          <h2 className="nav-pill mb-3">Vehicles in this fleet</h2>
          {fleetVehicles && fleetVehicles.length > 0 ? (
            <div className="space-y-2">
              {fleetVehicles.map((v) => (
                <div key={v.id} className="card p-4 flex items-center justify-between gap-3">
                  <Link
                    href={`/vehicles/${v.id}`}
                    className="flex-1 min-w-0 hover:text-volt transition-colors"
                  >
                    <p className="font-medium text-chalk truncate">
                      {v.nickname ?? `${v.make} ${v.model}`}
                    </p>
                    <p className="text-xs text-ash mt-0.5 font-mono truncate">
                      {v.plate_number ?? '—'} ·{' '}
                      {v.current_odometer?.toLocaleString() ?? '—'} km
                    </p>
                  </Link>
                  {v.owner_id === user.id && (
                    <form action={removeVehicleFromFleet}>
                      <input type="hidden" name="vehicle_id" value={v.id} />
                      <input type="hidden" name="org_slug" value={slug} />
                      <button
                        type="submit"
                        className="text-xs tracking-widest uppercase text-ash hover:text-signal transition-colors"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-sm text-ash">
                No vehicles assigned to this fleet yet.
              </p>
            </div>
          )}
        </section>

        {/* Add vehicles */}
        {candidates && candidates.length > 0 && (
          <section className="mt-10">
            <h2 className="nav-pill mb-3">Add one of your vehicles</h2>
            <div className="space-y-2">
              {candidates.map((v) => (
                <form
                  action={assignVehicleToFleet}
                  key={v.id}
                  className="card p-4 flex items-center justify-between gap-3"
                >
                  <input type="hidden" name="vehicle_id" value={v.id} />
                  <input type="hidden" name="org_id" value={org.id} />
                  <input type="hidden" name="org_slug" value={slug} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-chalk truncate">
                      {v.nickname ?? `${v.make} ${v.model}`}
                    </p>
                    <p className="text-xs text-ash mt-0.5 font-mono truncate">
                      {v.plate_number ?? '—'}
                    </p>
                  </div>
                  <button
                    type="submit"
                    className="text-xs tracking-widest uppercase text-volt hover:text-volt/80 transition-colors"
                  >
                    + Add to fleet
                  </button>
                </form>
              ))}
            </div>
          </section>
        )}

        {/* Members */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="nav-pill">Members · {members?.length ?? 0}</h2>
            {isAdmin && <FleetInviteSheet orgId={org.id} baseUrl={baseUrl} />}
          </div>
          {members && members.length > 0 ? (
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.user_id} className="card p-4 flex items-center justify-between">
                  <p className="text-sm text-chalk font-mono">
                    {m.user_id === user.id ? 'You' : m.user_id.slice(0, 8) + '…'}
                  </p>
                  <span className="text-[10px] tracking-widest uppercase text-ash">
                    {m.role}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}

function Stat({
  label,
  value,
  small,
}: {
  label: string
  value: string
  small?: boolean
}) {
  return (
    <div className="card p-4 text-center">
      <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
      <p
        className={`font-mono font-semibold tabular-nums tracking-tighter mt-1 text-chalk ${
          small ? 'text-xl' : 'text-2xl md:text-3xl'
        }`}
      >
        {value}
      </p>
    </div>
  )
}
