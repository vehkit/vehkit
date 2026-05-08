import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Overview = {
  total_users: number
  total_vehicles: number
  total_service_records: number
  workshop_attested_records: number
  total_workshops: number
  verified_workshops: number
  gold_workshops: number
  silver_workshops: number
  total_reviews: number
  avg_rating: number
  open_reminders: number
  fleet_orgs: number
  workshop_codes_today: number
  total_revenue_logged_aed: number
  signups_last_7d: number
  signups_last_30d: number
  records_last_7d: number
  records_last_30d: number
}

type DailyRow = { day: string; count: number }
type ServiceTypeRow = { service_type: string; count: number }
type EmirateRow = { emirate: string; count: number }

export default async function AdminOverviewPage() {
  const supabase = createAdminClient()

  const [overviewRes, signupsRes, recordsRes, typesRes, emiratesRes] = await Promise.all([
    supabase.rpc('admin_overview_stats'),
    supabase.rpc('admin_daily_signups'),
    supabase.rpc('admin_daily_records'),
    supabase.rpc('admin_service_type_breakdown'),
    supabase.rpc('admin_workshops_by_emirate'),
  ])

  const stats = (overviewRes.data as Overview) ?? ({} as Overview)
  const signupSeries = ((signupsRes.data as DailyRow[]) ?? []).map((r) => ({
    day: r.day,
    count: Number(r.count),
  }))
  const recordSeries = ((recordsRes.data as DailyRow[]) ?? []).map((r) => ({
    day: r.day,
    count: Number(r.count),
  }))
  const typeBreakdown = ((typesRes.data as ServiceTypeRow[]) ?? []).map((r) => ({
    service_type: r.service_type,
    count: Number(r.count),
  }))
  const emirateBreakdown = ((emiratesRes.data as EmirateRow[]) ?? []).map((r) => ({
    emirate: r.emirate,
    count: Number(r.count),
  }))

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-8">
        <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">Overview</h1>
      </header>

      {/* Top row stats */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Users" value={stats.total_users} delta={`+${stats.signups_last_7d ?? 0}/7d`} />
        <Stat label="Vehicles" value={stats.total_vehicles} />
        <Stat
          label="Service records"
          value={stats.total_service_records}
          delta={`+${stats.records_last_7d ?? 0}/7d`}
        />
        <Stat label="Workshops" value={stats.total_workshops} />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
        <Stat
          label="Verified workshops"
          value={stats.verified_workshops}
          tone="volt"
          sub={`${stats.gold_workshops} gold · ${stats.silver_workshops} silver`}
        />
        <Stat label="Reviews" value={stats.total_reviews} sub={`avg ${Number(stats.avg_rating).toFixed(2)}★`} />
        <Stat label="Open reminders" value={stats.open_reminders} tone="wallet" />
        <Stat
          label="Codes today"
          value={stats.workshop_codes_today}
          sub="workshop codes generated"
        />
      </section>

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
        <Stat label="Fleet orgs" value={stats.fleet_orgs} />
        <Stat
          label="Workshop attested"
          value={stats.workshop_attested_records}
          sub={`of ${stats.total_service_records} records`}
        />
        <Stat
          label="Logged revenue"
          value={`AED ${Number(stats.total_revenue_logged_aed ?? 0).toLocaleString()}`}
          sub="all time, owner-reported"
        />
      </section>

      {/* Charts */}
      <section className="mt-10">
        <h2 className="text-xs tracking-widest uppercase text-ash mb-3">Signups · last 30 days</h2>
        <BarChart data={signupSeries.map((r) => ({ label: shortDate(r.day), value: r.count }))} accent="volt" />
      </section>

      <section className="mt-10">
        <h2 className="text-xs tracking-widest uppercase text-ash mb-3">Service records · last 30 days</h2>
        <BarChart data={recordSeries.map((r) => ({ label: shortDate(r.day), value: r.count }))} accent="wallet" />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-10">
        <div>
          <h2 className="text-xs tracking-widest uppercase text-ash mb-3">Top service types</h2>
          <RankedList
            items={typeBreakdown.map((t) => ({
              label: humanize(t.service_type),
              value: t.count,
            }))}
          />
        </div>
        <div>
          <h2 className="text-xs tracking-widest uppercase text-ash mb-3">Workshops by emirate</h2>
          <RankedList
            items={emirateBreakdown.map((e) => ({ label: e.emirate, value: e.count }))}
          />
        </div>
      </section>
    </div>
  )
}

function Stat({
  label,
  value,
  delta,
  sub,
  tone,
}: {
  label: string
  value: number | string
  delta?: string
  sub?: string
  tone?: 'volt' | 'wallet' | 'signal'
}) {
  const accent = tone === 'volt' ? 'text-volt' : tone === 'wallet' ? 'text-wallet' : tone === 'signal' ? 'text-signal' : 'text-chalk'
  return (
    <div className="card p-4">
      <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
      <p className={`font-mono text-2xl md:text-3xl font-semibold tabular-nums tracking-tighter mt-1 ${accent}`}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      {delta && <p className="text-[10px] text-volt mt-1 font-mono">{delta}</p>}
      {sub && <p className="text-[10px] text-ash mt-1">{sub}</p>}
    </div>
  )
}

function BarChart({
  data,
  accent,
}: {
  data: { label: string; value: number }[]
  accent: 'volt' | 'wallet'
}) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const fill = accent === 'volt' ? 'fill-volt' : 'fill-wallet'

  if (data.length === 0) {
    return (
      <div className="card p-6 text-center text-sm text-ash">No data yet</div>
    )
  }

  return (
    <div className="card p-5">
      <div className="flex items-end gap-px h-32">
        {data.map((d, i) => {
          const h = Math.max(2, (d.value / max) * 100)
          return (
            <div
              key={i}
              className="flex-1 relative group"
              title={`${d.label} · ${d.value}`}
            >
              <svg
                className="w-full h-full"
                viewBox={`0 0 100 100`}
                preserveAspectRatio="none"
              >
                <rect
                  x="10"
                  y={100 - h}
                  width="80"
                  height={h}
                  className={fill}
                  rx="1"
                />
              </svg>
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

function RankedList({ items }: { items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value))

  if (items.length === 0) {
    return <div className="card p-6 text-center text-sm text-ash">No data</div>
  }

  return (
    <div className="card p-4 space-y-2">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm">
            <span className="text-chalk truncate">{item.label}</span>
            <span className="font-mono tabular-nums text-ash">{item.value.toLocaleString()}</span>
          </div>
          <div className="h-1 bg-iron rounded-full mt-1 overflow-hidden">
            <div
              className="h-full bg-volt"
              style={{ width: `${(item.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function shortDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
