import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { TradeLicenseUpload } from '@/components/TradeLicenseUpload'
import { StarRating } from '@/components/StarRating'

export const dynamic = 'force-dynamic'

type FullStats = {
  tier: string
  emirate: string | null
  total_entries: number
  unique_cars: number
  repeat_cars: number
  repeat_rate_pct: number
  total_revenue: number
  avg_ticket: number
  entries_last_30: number
  entries_prev_30: number
  entries_30d_delta_pct: number
  revenue_last_30: number
  revenue_prev_30: number
  revenue_30d_delta_pct: number
  entries_last_7: number
  pending_count: number
  upcoming_30: number
  overdue_on_serviced: number
  review_count: number
  avg_rating: number
  quality_avg: number | null
  value_avg: number | null
  timeliness_avg: number | null
  directory_rank: number | null
  directory_total: number | null
  silver_progress_pct: number
  gold_progress_pct: number
}

type WeeklyRow = {
  week_start: string
  entries_count: number
  revenue: number
  unique_cars: number
}

type ServiceTypeRow = {
  service_type: string
  count: number
  revenue: number
  avg_cost: number
}

type TopCustomerRow = {
  vehicle_id: string
  make: string
  model: string
  nickname: string | null
  plate_number: string | null
  plate_emirate: string | null
  visit_count: number
  total_spent: number
  last_visit: string
}

type ReviewRow = {
  id: string
  rating: number
  quality_rating: number | null
  value_rating: number | null
  timeliness_rating: number | null
  comment: string | null
  created_at: string
}

type PendingRow = {
  record_id: string
  vehicle_id: string
  make: string
  model: string
  nickname: string | null
  plate_number: string | null
  service_type: string
  cost_aed: number | null
  hours_left: number
}

type UpcomingRow = {
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
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
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

  if (!membership) redirect('/workshop/claim')
  const workshopId = membership.workshop_id

  const { data: workshop } = await supabase
    .from('workshops')
    .select('id, name, slug, emirate, verification_tier, phone, email, trade_license_url')
    .eq('id', workshopId)
    .single()
  if (!workshop) redirect('/workshop/claim')

  // Parallelize all dashboard data fetches
  const [
    statsRes,
    weeklyRes,
    breakdownRes,
    customersRes,
    reviewsRes,
    pendingRes,
    upcomingRes,
  ] = await Promise.all([
    supabase.rpc('workshop_full_stats', { p_workshop_id: workshopId }),
    supabase.rpc('workshop_weekly_series', { p_workshop_id: workshopId, p_weeks: 12 }),
    supabase.rpc('workshop_service_breakdown', { p_workshop_id: workshopId }),
    supabase.rpc('workshop_top_customers', { p_workshop_id: workshopId, p_limit: 5 }),
    supabase.rpc('workshop_recent_reviews', { p_workshop_id: workshopId, p_limit: 5 }),
    supabase.rpc('workshop_pending_entries', { p_workshop_id: workshopId }),
    supabase.rpc('workshop_upcoming_visits', { p_workshop_id: workshopId, p_days_ahead: 30 }),
  ])

  const stats = (statsRes.data as FullStats) ?? null
  const weekly = (weeklyRes.data as WeeklyRow[]) ?? []
  const breakdown = (breakdownRes.data as ServiceTypeRow[]) ?? []
  const customers = (customersRes.data as TopCustomerRow[]) ?? []
  const reviews = (reviewsRes.data as ReviewRow[]) ?? []
  const pending = (pendingRes.data as PendingRow[]) ?? []
  const upcoming = (upcomingRes.data as UpcomingRow[]) ?? []

  const tierLabel =
    workshop.verification_tier === 'gold'
      ? 'Gold'
      : workshop.verification_tier === 'silver'
        ? 'Silver'
        : 'Unverified'
  const tierTone =
    workshop.verification_tier === 'gold'
      ? 'text-wallet'
      : workshop.verification_tier === 'silver'
        ? 'text-volt'
        : 'text-ash'

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-5xl mx-auto px-6">
        <header className="pt-8 pb-6 flex items-end justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest uppercase text-ash">Workshop</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-1 truncate">
              {workshop.name}
            </h1>
            <p className="text-sm mt-1 flex items-center gap-2 flex-wrap">
              <span className={`uppercase tracking-wider text-xs font-medium ${tierTone}`}>
                {tierLabel}
              </span>
              {workshop.emirate && <span className="text-ash">· {workshop.emirate}</span>}
              {stats?.directory_rank && stats.directory_total && (
                <span className="text-ash">
                  · #{stats.directory_rank}/{stats.directory_total} in {workshop.emirate}
                </span>
              )}
            </p>
          </div>
          <form action="/auth/signout" method="post">
            <button className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors">
              Sign out
            </button>
          </form>
        </header>

        {/* Top KPIs — 4 columns */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat
            label="Verified entries"
            value={stats?.total_entries ?? 0}
            delta={stats?.entries_30d_delta_pct ?? 0}
            sub={`${stats?.entries_last_30 ?? 0} in last 30d`}
          />
          <Stat label="Unique cars" value={stats?.unique_cars ?? 0} />
          <Stat
            label="Revenue"
            value={`AED ${Number(stats?.total_revenue ?? 0).toLocaleString()}`}
            delta={stats?.revenue_30d_delta_pct ?? 0}
            sub={`AED ${Number(stats?.revenue_last_30 ?? 0).toLocaleString()} last 30d`}
            isLong
          />
          <Stat
            label="Rating"
            value={
              stats && stats.review_count > 0
                ? Number(stats.avg_rating).toFixed(2)
                : '—'
            }
            sub={
              stats?.review_count
                ? `${stats.review_count} review${stats.review_count === 1 ? '' : 's'}`
                : 'No reviews yet'
            }
          />
        </section>

        {/* Secondary KPIs */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Stat
            label="Avg ticket"
            value={`AED ${Number(stats?.avg_ticket ?? 0).toLocaleString()}`}
          />
          <Stat
            label="Repeat rate"
            value={`${stats?.repeat_rate_pct ?? 0}%`}
            sub={`${stats?.repeat_cars ?? 0} of ${stats?.unique_cars ?? 0} cars`}
          />
          <Stat
            label="This week"
            value={stats?.entries_last_7 ?? 0}
            sub="entries logged"
          />
          <Stat
            label="Upcoming · 30d"
            value={stats?.upcoming_30 ?? 0}
            sub={
              stats?.overdue_on_serviced
                ? `${stats.overdue_on_serviced} overdue`
                : 'on serviced cars'
            }
          />
        </section>

        {/* Quick links */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-4">
          <QuickLink href="/workshop/customers" label="Customers" hint={`${stats?.unique_cars ?? 0} vehicles`} />
          <QuickLink href="/shop" label="Log entry" hint="Enter code" />
          <QuickLink
            href={`/w/${workshop.slug}`}
            label="Public profile"
            hint={`/w/${workshop.slug}`}
            mono
          />
        </section>

        {/* Pending — within 24h retract window */}
        {pending.length > 0 && (
          <section className="mt-8">
            <SectionHeader
              title={`Awaiting confirmation · ${pending.length}`}
              hint="24h retract window"
              tone="wallet"
            />
            <ul className="card divide-y divide-seam">
              {pending.map((p) => (
                <li key={p.record_id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-wallet shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk truncate">
                      <span className="font-semibold">{humanize(p.service_type)}</span>
                      <span className="text-ash">
                        {' · '}
                        {p.nickname ?? `${p.make} ${p.model}`}
                      </span>
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
              ))}
            </ul>
          </section>
        )}

        {/* Trends — entries + revenue 12 weeks */}
        {weekly.length > 0 && stats?.total_entries ? (
          <section className="mt-8 grid md:grid-cols-2 gap-3">
            <BarChart
              title="Entries · last 12 weeks"
              data={weekly.map((w) => ({
                label: shortDate(w.week_start),
                value: w.entries_count,
              }))}
              accent="volt"
            />
            <BarChart
              title="Revenue · last 12 weeks"
              data={weekly.map((w) => ({
                label: shortDate(w.week_start),
                value: Number(w.revenue),
              }))}
              accent="wallet"
              prefix="AED "
            />
          </section>
        ) : null}

        {/* Two-column: service breakdown + top customers */}
        <section className="mt-8 grid md:grid-cols-2 gap-3">
          <div>
            <SectionHeader title="Service breakdown" />
            {breakdown.length > 0 ? (
              <ul className="card divide-y divide-seam">
                {breakdown.map((b) => {
                  const max = Math.max(1, ...breakdown.map((x) => x.count))
                  const pct = (b.count / max) * 100
                  return (
                    <li key={b.service_type} className="px-4 py-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-chalk truncate">
                          {humanize(b.service_type)}
                        </span>
                        <span className="font-mono tabular-nums text-chalk shrink-0">
                          {b.count}
                          <span className="text-ash text-[10px] ml-1">
                            · AED {Number(b.revenue).toLocaleString()}
                          </span>
                        </span>
                      </div>
                      <div className="h-1 bg-iron rounded-full mt-1.5 overflow-hidden">
                        <div className="h-full bg-volt" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="card p-6 text-center text-sm text-ash">No services yet</div>
            )}
          </div>

          <div>
            <SectionHeader title="Top customers" hint="by visits" />
            {customers.length > 0 ? (
              <ul className="card divide-y divide-seam">
                {customers.map((c, i) => {
                  const title = c.nickname ?? `${c.make} ${c.model}`
                  return (
                    <li key={c.vehicle_id} className="px-4 py-3 flex items-center gap-3">
                      <span className="font-mono text-[10px] text-ash w-4 shrink-0">
                        #{i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-chalk truncate">{title}</p>
                        <p className="text-[11px] text-ash truncate">
                          {c.plate_number && `${c.plate_emirate ?? ''} ${c.plate_number}`}
                          {c.plate_number && ' · '}
                          {c.visit_count} visit{c.visit_count === 1 ? '' : 's'}
                        </p>
                      </div>
                      <span className="font-mono text-xs text-chalk tabular-nums shrink-0">
                        AED {Number(c.total_spent).toLocaleString()}
                      </span>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="card p-6 text-center text-sm text-ash">No customers yet</div>
            )}
          </div>
        </section>

        {/* Reputation — multi-axis + recent reviews */}
        <section className="mt-8">
          <SectionHeader
            title="Reputation"
            hint={`${stats?.review_count ?? 0} reviews`}
          />
          <div className="grid md:grid-cols-3 gap-3">
            <AxisCard label="Quality" value={stats?.quality_avg ?? null} />
            <AxisCard label="Value" value={stats?.value_avg ?? null} />
            <AxisCard label="Timeliness" value={stats?.timeliness_avg ?? null} />
          </div>

          {reviews.length > 0 && (
            <ul className="card divide-y divide-seam mt-3">
              {reviews.map((r) => (
                <li key={r.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <StarRating rating={r.rating} size="sm" />
                    <p className="text-[10px] text-ash">
                      {new Date(r.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-chalk/90 mt-1.5 leading-relaxed line-clamp-2">
                      "{r.comment}"
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Upcoming — next 30d on cars we've serviced */}
        {upcoming.length > 0 && (
          <section className="mt-8">
            <SectionHeader
              title={`Upcoming · ${upcoming.length}`}
              hint="next 30 days"
              tone="volt"
            />
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

        {/* Tier progress */}
        <section className="mt-8 card p-5">
          <SectionHeader
            title="Verification progress"
            hint={tierLabel}
            tone={tierTone === 'text-wallet' ? 'wallet' : tierTone === 'text-volt' ? 'volt' : 'ash'}
          />
          <div className="space-y-3">
            <ProgressRow
              label="Silver"
              pct={stats?.silver_progress_pct ?? 0}
              hint="10+ entries + trade license"
              accent="volt"
              achieved={
                workshop.verification_tier === 'silver' ||
                workshop.verification_tier === 'gold'
              }
            />
            <ProgressRow
              label="Gold"
              pct={stats?.gold_progress_pct ?? 0}
              hint="100+ entries · 4.5+ rating · 5+ reviews"
              accent="wallet"
              achieved={workshop.verification_tier === 'gold'}
            />
          </div>
        </section>

        {/* Trade license panel */}
        <section className="mt-6">
          <TradeLicenseUpload
            workshopId={workshop.id}
            hasLicense={!!workshop.trade_license_url}
            currentTier={workshop.verification_tier}
          />
        </section>
      </div>
    </main>
  )
}

// ===========================================================================
// Subcomponents
// ===========================================================================

function Stat({
  label,
  value,
  delta,
  sub,
  isLong,
}: {
  label: string
  value: string | number
  delta?: number
  sub?: string
  isLong?: boolean
}) {
  const deltaTone =
    delta == null
      ? ''
      : delta > 0
        ? 'text-volt'
        : delta < 0
          ? 'text-signal'
          : 'text-ash'
  const deltaSign = delta == null ? '' : delta > 0 ? '+' : ''
  return (
    <div className="card p-4">
      <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
      <p
        className={`font-mono font-semibold tabular-nums tracking-tighter mt-1 text-chalk ${
          isLong ? 'text-base md:text-lg' : 'text-xl md:text-2xl'
        }`}
      >
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {(sub || delta != null) && (
        <p className="text-[10px] text-ash mt-1 leading-tight">
          {delta != null && delta !== 0 && (
            <span className={`font-mono ${deltaTone} mr-1`}>
              {deltaSign}
              {delta.toFixed(1)}%
            </span>
          )}
          {sub}
        </p>
      )}
    </div>
  )
}

function QuickLink({
  href,
  label,
  hint,
  mono,
}: {
  href: string
  label: string
  hint: string
  mono?: boolean
}) {
  return (
    <Link
      href={href}
      className="card px-4 py-3 hover:border-volt/30 transition-colors flex items-center justify-between"
    >
      <div className="min-w-0">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p
          className={`text-sm text-chalk font-medium mt-0.5 truncate ${mono ? 'font-mono' : ''}`}
        >
          {hint}
        </p>
      </div>
      <span className="text-ash text-xs ml-2">→</span>
    </Link>
  )
}

function SectionHeader({
  title,
  hint,
  tone = 'ash',
}: {
  title: string
  hint?: string
  tone?: 'ash' | 'volt' | 'wallet' | 'signal'
}) {
  const c =
    tone === 'volt'
      ? 'text-volt'
      : tone === 'wallet'
        ? 'text-wallet'
        : tone === 'signal'
          ? 'text-signal'
          : 'text-ash'
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className={`text-xs tracking-widest uppercase font-medium ${c}`}>{title}</h2>
      {hint && <p className="text-[10px] text-ash">{hint}</p>}
    </div>
  )
}

function AxisCard({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <div className="card p-4 opacity-60">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p className="text-sm text-ash mt-2">No ratings yet</p>
      </div>
    )
  }
  const pct = Math.min(100, (Number(value) / 5) * 100)
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p className="font-mono text-base font-semibold text-chalk tabular-nums">
          {Number(value).toFixed(2)}
          <span className="text-ash text-[10px] ml-0.5">★</span>
        </p>
      </div>
      <div className="h-1 bg-iron rounded-full mt-3 overflow-hidden">
        <div
          className={`h-full ${
            Number(value) >= 4 ? 'bg-volt' : Number(value) >= 3 ? 'bg-wallet' : 'bg-signal/70'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function ProgressRow({
  label,
  pct,
  hint,
  accent,
  achieved,
}: {
  label: string
  pct: number
  hint: string
  accent: 'volt' | 'wallet'
  achieved?: boolean
}) {
  const bar = accent === 'volt' ? 'bg-volt' : 'bg-wallet'
  const text = accent === 'volt' ? 'text-volt' : 'text-wallet'
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className={`font-medium ${achieved ? text : 'text-chalk'}`}>
          {achieved ? `✓ ${label}` : label}
        </span>
        <span className="font-mono text-xs text-ash tabular-nums">{Math.round(pct)}%</span>
      </div>
      <div className="h-1 bg-iron rounded-full mt-1 overflow-hidden">
        <div className={`h-full ${bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-ash mt-1">{hint}</p>
    </div>
  )
}

function BarChart({
  title,
  data,
  accent,
  prefix,
}: {
  title: string
  data: { label: string; value: number }[]
  accent: 'volt' | 'wallet'
  prefix?: string
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const total = data.reduce((s, d) => s + d.value, 0)
  const barColor = accent === 'volt' ? 'bg-volt' : 'bg-wallet'
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[10px] tracking-widest uppercase text-ash">{title}</h3>
        <span className="text-[10px] text-ash font-mono">
          Σ {prefix ?? ''}
          {total.toLocaleString()}
        </span>
      </div>
      <div className="flex items-end gap-px h-24">
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * 100)
          return (
            <div
              key={i}
              className="flex-1 flex items-end h-full"
              title={`${d.label} · ${prefix ?? ''}${d.value.toLocaleString()}`}
            >
              <div
                className={`w-full ${barColor} rounded-sm`}
                style={{ height: `${h}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[9px] text-ash/70 font-mono mt-2">
        <span>{data[0]?.label}</span>
        {data.length > 2 && <span>{data[Math.floor(data.length / 2)]?.label}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
