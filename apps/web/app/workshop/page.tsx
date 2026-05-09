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

  const { data: membership, error: membershipError } = await supabase
    .from('workshop_members')
    .select('workshop_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    redirect(
      `/workshop/claim?error=${encodeURIComponent(`membership lookup failed: ${membershipError.message}`)}`
    )
  }

  if (!membership) {
    redirect('/workshop/claim')
  }

  const workshopId = membership.workshop_id

  const { data: workshop, error: workshopError } = await supabase
    .from('workshops')
    .select('id, name, slug, emirate, verification_tier, phone, email, trade_license_url')
    .eq('id', workshopId)
    .single()

  if (workshopError || !workshop) {
    redirect(
      `/workshop/claim?error=${encodeURIComponent(`workshop fetch failed: ${workshopError?.message ?? 'not found'}`)}`
    )
  }

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

  // Pending entries (within 24h retract window)
  const { data: pendingRaw } = await supabase.rpc('workshop_pending_entries', {
    p_workshop_id: workshopId,
  })
  const pending = (pendingRaw ?? []) as Array<{
    record_id: string
    vehicle_id: string
    make: string
    model: string
    nickname: string | null
    plate_number: string | null
    service_type: string
    cost_aed: number | null
    hours_left: number
  }>

  // Upcoming visits (next 30d on cars we've serviced)
  const { data: upcomingRaw } = await supabase.rpc('workshop_upcoming_visits', {
    p_workshop_id: workshopId,
    p_days_ahead: 30,
  })
  const upcoming = (upcomingRaw ?? []) as Array<{
    reminder_id: string
    vehicle_id: string
    make: string
    model: string
    nickname: string | null
    plate_number: string | null
    reminder_type: string
    due_date: string | null
    due_at_km: number | null
    km_remaining: number | null
    days_remaining: number | null
    is_overdue: boolean
    allow_outreach: boolean
    suggested_by_us: boolean
  }>

  // Customer count for the link badge
  const { data: customerCountRaw } = await supabase.rpc('workshop_customer_vehicles', {
    p_workshop_id: workshopId,
  })
  const customerCount = (customerCountRaw ?? []).length

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
      <div className="max-w-3xl mx-auto px-6">
        <header className="pt-10 pb-6 flex items-center justify-between gap-4">
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

        {/* Quick links */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
          <Link
            href="/workshop/customers"
            className="card px-4 py-3 hover:border-volt/30 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] tracking-widest uppercase text-ash">Customers</p>
              <p className="text-sm text-chalk font-medium mt-0.5">
                {customerCount} {customerCount === 1 ? 'vehicle' : 'vehicles'}
              </p>
            </div>
            <span className="text-ash text-xs">→</span>
          </Link>
          <Link
            href="/shop"
            className="card px-4 py-3 hover:border-volt/30 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] tracking-widest uppercase text-ash">Log entry</p>
              <p className="text-sm text-chalk font-medium mt-0.5">Enter code</p>
            </div>
            <span className="text-ash text-xs">→</span>
          </Link>
          <Link
            href={`/w/${workshop.slug}`}
            className="card px-4 py-3 hover:border-volt/30 transition-colors flex items-center justify-between"
          >
            <div>
              <p className="text-[10px] tracking-widest uppercase text-ash">Public profile</p>
              <p className="text-sm text-chalk font-medium mt-0.5 font-mono truncate">
                /w/{workshop.slug}
              </p>
            </div>
            <span className="text-ash text-xs">→</span>
          </Link>
        </section>

        {/* Pending — within 24h retract window */}
        {pending.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs tracking-widest uppercase text-wallet font-medium">
                Awaiting confirmation · {pending.length}
              </h2>
              <p className="text-[10px] text-ash tracking-wide">24h retract window</p>
            </div>
            <ul className="card divide-y divide-seam">
              {pending.map((p) => {
                const title = p.nickname ?? `${p.make} ${p.model}`
                return (
                  <li key={p.record_id} className="px-4 py-3 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-wallet shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-chalk truncate">
                        <span className="font-semibold">{humanize(p.service_type)}</span>
                        <span className="text-ash"> · {title}</span>
                        {p.plate_number && (
                          <span className="text-ash font-mono"> · {p.plate_number}</span>
                        )}
                      </p>
                      {p.cost_aed != null && (
                        <p className="text-xs text-ash font-mono mt-0.5">
                          AED {Number(p.cost_aed).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] tracking-widest uppercase text-wallet shrink-0">
                      {p.hours_left}h left
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>
        )}

        {/* Upcoming — next 30d on cars we've serviced */}
        {upcoming.length > 0 && (
          <section className="mt-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs tracking-widest uppercase text-volt font-medium">
                Upcoming · next 30 days · {upcoming.length}
              </h2>
            </div>
            <ul className="card divide-y divide-seam">
              {upcoming.slice(0, 8).map((u) => {
                const title = u.nickname ?? `${u.make} ${u.model}`
                const dueText = u.is_overdue
                  ? 'Overdue'
                  : u.days_remaining != null
                    ? `in ${u.days_remaining}d`
                    : u.km_remaining != null
                      ? `in ${u.km_remaining.toLocaleString()} km`
                      : 'soon'
                return (
                  <li key={u.reminder_id} className="px-4 py-3 flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        u.is_overdue ? 'bg-signal' : 'bg-volt'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-chalk truncate">
                        <span className="font-semibold">{humanize(u.reminder_type)}</span>
                        <span className="text-ash"> · {title}</span>
                        {u.plate_number && (
                          <span className="text-ash font-mono"> · {u.plate_number}</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {u.suggested_by_us && (
                          <span className="text-[10px] tracking-widest uppercase text-ash">
                            ↳ suggested by you
                          </span>
                        )}
                        {!u.allow_outreach && (
                          <span className="text-[10px] text-ash/60">no outreach</span>
                        )}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] tracking-widest uppercase shrink-0 font-medium ${
                        u.is_overdue ? 'text-signal' : 'text-volt'
                      }`}
                    >
                      {dueText}
                    </span>
                  </li>
                )
              })}
            </ul>
            {upcoming.length > 8 && (
              <p className="text-[11px] text-ash mt-2 text-right">
                +{upcoming.length - 8} more on the customer roster
              </p>
            )}
          </section>
        )}

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
