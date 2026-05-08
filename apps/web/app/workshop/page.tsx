import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TradeLicenseUpload } from '@/components/TradeLicenseUpload'

type WorkshopStats = {
  total_entries: number
  unique_vehicles: number
  total_revenue_aed: number
  workshop_name: string
}

export default async function WorkshopDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/workshop')

  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership || !membership.workshop_id) {
    redirect('/workshop/claim')
  }

  const workshopId = membership.workshop_id

  const { data: workshop } = await supabase
    .from('workshops')
    .select('id, name, slug, emirate, verification_tier, phone, email, trade_license_url')
    .eq('id', workshopId)
    .single()

  if (!workshop) redirect('/workshop/claim')

  // Stats via RPC
  const { data: statsRaw } = await supabase.rpc('workshop_stats', {
    p_workshop_id: workshopId,
  })
  const stats = (statsRaw as WorkshopStats) ?? {
    total_entries: 0,
    unique_vehicles: 0,
    total_revenue_aed: 0,
    workshop_name: workshop.name,
  }

  // Recent entries (only those with workshop_id set — RLS now allows workshop members to read)
  const { data: recent } = await supabase
    .from('service_records')
    .select('id, service_type, service_date, odometer, cost_aed, vehicle_id, attestation')
    .eq('workshop_id', workshopId)
    .order('service_date', { ascending: false })
    .limit(10)

  const tierLabel =
    workshop.verification_tier === 'gold'
      ? 'Gold'
      : workshop.verification_tier === 'silver'
        ? 'Silver'
        : 'Unverified'
  const tierColor =
    workshop.verification_tier === 'gold'
      ? 'text-wallet'
      : workshop.verification_tier === 'silver'
        ? 'text-chalk'
        : 'text-ash'

  return (
    <main className="min-h-[100svh] pb-24">
      <header className="px-6 pt-10 pb-6 flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="nav-pill">Workshop</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-1 truncate">
            {workshop.name}
          </h1>
          <p className="text-sm mt-1">
            <span className={`uppercase tracking-wider text-xs ${tierColor}`}>
              {tierLabel}
            </span>
            {workshop.emirate && <span className="text-ash"> · {workshop.emirate}</span>}
          </p>
        </div>
        <form action="/auth/signout" method="post">
          <button className="text-sm text-ash hover:text-chalk transition-colors">
            Sign out
          </button>
        </form>
      </header>

      <div className="max-w-3xl mx-auto px-6">
        {/* Stats grid */}
        <section className="grid grid-cols-3 gap-3">
          <Stat label="Verified entries" value={stats.total_entries.toString()} />
          <Stat label="Unique cars" value={stats.unique_vehicles.toString()} />
          <Stat
            label="Revenue (AED)"
            value={Number(stats.total_revenue_aed).toLocaleString()}
            small
          />
        </section>

        {/* Verification panel */}
        <section className="mt-6">
          <TradeLicenseUpload
            workshopId={workshop.id}
            hasLicense={!!workshop.trade_license_url}
            currentTier={workshop.verification_tier}
          />
        </section>

        {/* Public profile link */}
        <section className="mt-6">
          <Link
            href={`/w/${workshop.slug}`}
            className="card block p-4 hover:border-volt/30 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="nav-pill text-[10px]">Your public profile</p>
                <p className="text-sm font-mono text-volt mt-1">vehkit.com/w/{workshop.slug}</p>
              </div>
              <span className="text-xs tracking-widest uppercase text-ash">View →</span>
            </div>
          </Link>
        </section>

        {/* Recent entries */}
        <section className="mt-10">
          <h2 className="nav-pill mb-4">Recent verified entries</h2>
          {recent && recent.length > 0 ? (
            <ol className="space-y-3">
              {recent.map((r) => (
                <li key={r.id} className="card p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium text-chalk text-sm">
                      {humanize(r.service_type)}
                    </p>
                    <p className="text-xs text-ash mt-0.5">
                      {new Date(r.service_date).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                      {r.odometer && (
                        <>
                          {' · '}
                          <span className="font-mono">{r.odometer.toLocaleString()} km</span>
                        </>
                      )}
                    </p>
                  </div>
                  {r.cost_aed != null && (
                    <p className="text-sm text-chalk font-mono whitespace-nowrap">
                      AED {Number(r.cost_aed).toLocaleString()}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <div className="card p-8 text-center">
              <p className="text-chalk font-medium">No entries yet.</p>
              <p className="text-sm text-ash mt-2 leading-relaxed">
                When customers give you a 6-digit Vehkit code at checkout, log the service at{' '}
                <Link href="/shop" className="text-volt underline">
                  vehkit.com/shop
                </Link>{' '}
                — it will appear here.
              </p>
            </div>
          )}
        </section>

        {/* How it works refresher */}
        <section className="card p-5 mt-10">
          <p className="nav-pill text-[10px]">How customers find you</p>
          <p className="text-sm text-chalk mt-2 leading-relaxed">
            Workshop URL:{' '}
            <span className="font-mono text-volt">vehkit.com/shop</span>
          </p>
          <p className="text-xs text-ash mt-3 leading-relaxed">
            Add a sign at the front desk: "We log your service to Vehkit. Ask for a code." Pin
            this URL to your phone home screen for quick access.
          </p>
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
        className={`font-mono font-semibold tabular-nums tracking-tighter mt-1 text-chalk ${small ? 'text-xl' : 'text-2xl md:text-3xl'}`}
      >
        {value}
      </p>
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
