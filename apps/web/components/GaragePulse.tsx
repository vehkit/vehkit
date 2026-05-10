import Link from 'next/link'

export type FuelLogRow = {
  id: string
  vehicle_id: string
  logged_at: string
  odometer_km: number | null
  liters: number
  total_aed: number | null
  fuel_grade: string | null
  station_name: string | null
}

export type ActivityEvent = {
  kind: 'service' | 'fuel' | 'doc'
  at: string
  vehicleId: string
  vehicleLabel: string
  label: string
  meta: string | null
}

type VehicleLite = {
  id: string
  label: string
  currentOdometer: number | null
}

type VehicleSummary = {
  serviceCount: number
  totalSpend: number
  lastServiceDate: string | null
  lastWorkshop: string | null
}

/**
 * Sits between MyCarsList and the "What's next" suggestions on /mycars.
 * Surfaces three layers of intelligence on user-logged data:
 *
 *   1. STAT STRIP — garage-wide numbers (PF rhythm: kicker + value + label,
 *      vertical-divider separated).
 *   2. FUEL CARDS — per-vehicle efficiency + 30d spend + last fill (only
 *      when at least one fuel log exists for that vehicle).
 *   3. ACTIVITY — last 6 events across services, fills, documents — a
 *      mixed timeline so the page rewards the user for logging.
 *
 * The whole section renders nothing if the user has just a single car
 * with zero logged activity — that case is better served by the
 * suggestions section directly below.
 */
export function GaragePulse({
  vehicles,
  fuelLogs,
  summaryByVehicle,
  documentsCount,
  activity,
}: {
  vehicles: VehicleLite[]
  fuelLogs: FuelLogRow[]
  summaryByVehicle: Record<string, VehicleSummary>
  documentsCount: number
  activity: ActivityEvent[]
}) {
  if (vehicles.length === 0) return null

  // ===== Aggregates =====
  const now = Date.now()
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
  const ninetyDaysAgo = new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()

  const fuelLast30 = fuelLogs.filter((f) => f.logged_at >= thirtyDaysAgo)
  const fuelLast90 = fuelLogs.filter((f) => f.logged_at >= ninetyDaysAgo)

  const spend30 = fuelLast30.reduce(
    (s, f) => s + Number(f.total_aed ?? 0),
    0,
  )
  const totalFuelSpend = fuelLogs.reduce(
    (s, f) => s + Number(f.total_aed ?? 0),
    0,
  )
  const totalFills = fuelLogs.length

  const totalServices = Object.values(summaryByVehicle).reduce(
    (s, v) => s + v.serviceCount,
    0,
  )
  const totalServiceSpend = Object.values(summaryByVehicle).reduce(
    (s, v) => s + v.totalSpend,
    0,
  )

  const totalKmTracked = vehicles.reduce(
    (s, v) => s + (v.currentOdometer ?? 0),
    0,
  )

  // ===== Cost-per-km — the headline number =====
  // Combines fuel + service spend over total kilometres tracked. We only
  // surface this when we have BOTH spend and km — otherwise it'd be
  // either zero or infinity, and the card would look broken.
  const totalSpend = totalFuelSpend + totalServiceSpend
  const showCostPerKm = totalSpend > 0 && totalKmTracked > 0
  const costPerKm = showCostPerKm ? totalSpend / totalKmTracked : null

  // ===== Per-vehicle fuel insights =====
  const perVehicleFuel = vehicles
    .map((v) => buildVehicleFuelInsight(v, fuelLogs, fuelLast90))
    .filter((x): x is VehicleFuelInsight => x !== null)

  // ===== Render gate =====
  // Don't render if there's literally nothing meaningful yet. Only show
  // when we have at least 1 fuel log OR at least 1 service entry.
  if (fuelLogs.length === 0 && totalServices === 0) return null

  return (
    <section className="mt-10">
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[10px] tracking-widest uppercase text-ash">
          Garage pulse
        </h2>
        <p className="text-[10px] tracking-widest uppercase text-ash/60">
          By the numbers
        </p>
      </div>

      {/* Hero — cost per kilometre. The single most useful number once
          a user has logged a few fills + services. Combines fuel +
          service spend over distance. */}
      {showCostPerKm && costPerKm != null && (
        <div className="card p-5 md:p-6 mb-3 bg-gradient-to-br from-leaf/10 via-iron/30 to-noir border-leaf/30">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] tracking-widest uppercase text-leaf">
                Cost per kilometre
              </p>
              <p className="mt-2 leading-none">
                <span className="text-[10px] tracking-widest uppercase text-ash align-top mr-1">
                  AED
                </span>
                <span className="text-4xl md:text-5xl font-semibold text-chalk tracking-tight font-mono tabular-nums">
                  {costPerKm.toFixed(2)}
                </span>
                <span className="text-sm tracking-widest uppercase text-ash ml-2">
                  / km
                </span>
              </p>
              <p className="text-xs text-ash mt-2 leading-relaxed max-w-md">
                What it actually costs to keep your{' '}
                {vehicles.length === 1 ? 'car' : `${vehicles.length} cars`} on
                the road — fuel and service combined, across every kilometre
                you&apos;ve logged.
              </p>
            </div>
            <div className="text-right shrink-0">
              <CostBreakdown
                label="Fuel"
                value={totalFuelSpend}
                of={totalSpend}
              />
              <CostBreakdown
                label="Service"
                value={totalServiceSpend}
                of={totalSpend}
              />
              <p className="text-[10px] tracking-widest uppercase text-ash mt-2">
                Across {totalKmTracked.toLocaleString()} km
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Top stat strip — 2x2 grid on mobile (no dividers, padding-based
          rhythm), 4-up row on md+ with vertical dividers between items. */}
      <div className="card p-4 md:p-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-0 md:divide-x md:divide-seam">
          <PulseStat
            value={totalKmTracked.toLocaleString()}
            unit="km"
            label="Garage odometer"
          />
          <PulseStat
            value={spend30 > 0 ? `AED ${Math.round(spend30).toLocaleString()}` : '—'}
            label="Fuel · last 30 days"
            tone={spend30 > 0 ? 'leaf' : 'ash'}
          />
          <PulseStat
            value={totalServices.toString()}
            label={totalServices === 1 ? 'Service logged' : 'Services logged'}
          />
          <PulseStat
            value={totalFills.toString()}
            label={totalFills === 1 ? 'Fill-up' : 'Fill-ups'}
          />
        </div>
      </div>

      {/* Per-vehicle fuel insights */}
      {perVehicleFuel.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] tracking-widest uppercase text-ash mb-2">
            Fuel by vehicle
          </p>
          <ul className="space-y-3">
            {perVehicleFuel.map((p) => (
              <li key={p.vehicleId}>
                <FuelInsightCard p={p} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Service spend roll-up (small) — only when service data exists */}
      {totalServices > 0 && totalServiceSpend > 0 && (
        <div className="mt-4 card p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] tracking-widest uppercase text-ash">
              Service spend
            </p>
            <p className="text-base md:text-lg font-semibold text-chalk mt-1 leading-none">
              AED {Math.round(totalServiceSpend).toLocaleString()}
            </p>
            <p className="text-[11px] text-ash mt-1.5">
              Across {totalServices}{' '}
              {totalServices === 1 ? 'entry' : 'entries'} ·{' '}
              {documentsCount}{' '}
              {documentsCount === 1 ? 'document' : 'documents'} on file
            </p>
          </div>
          <Link
            href={`/vehicles/${vehicles[0]?.id ?? ''}#service`}
            className="text-[11px] tracking-widest uppercase text-leaf shrink-0 hover:underline"
          >
            View →
          </Link>
        </div>
      )}

      {/* Recent activity timeline */}
      {activity.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] tracking-widest uppercase text-ash mb-2">
            Recent activity
          </p>
          <ul className="card divide-y divide-seam overflow-hidden">
            {activity.map((e, i) => (
              <li key={`${e.kind}-${i}-${e.at}`}>
                <ActivityRow e={e} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Encourage-more nudge when fuel data is sparse */}
      {fuelLogs.length > 0 && fuelLogs.length < 3 && (
        <p className="text-[11px] text-ash/70 mt-3 leading-relaxed">
          Log another fill-up or two and we&apos;ll start showing kilometres
          per litre — your real cost-per-km of motoring.
        </p>
      )}
    </section>
  )
}

// ===========================================================================
// Per-vehicle fuel computation
// ===========================================================================

type VehicleFuelInsight = {
  vehicleId: string
  vehicleLabel: string
  fillsCount: number
  totalLitres: number
  totalSpend: number
  spendLast30: number
  kmPerL: number | null // null if not enough data
  lastFillDate: string | null
  lastStation: string | null
}

function buildVehicleFuelInsight(
  v: VehicleLite,
  allLogs: FuelLogRow[],
  last90: FuelLogRow[],
): VehicleFuelInsight | null {
  const logs = allLogs.filter((f) => f.vehicle_id === v.id)
  if (logs.length === 0) return null

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const totalLitres = logs.reduce((s, f) => s + Number(f.liters), 0)
  const totalSpend = logs.reduce((s, f) => s + Number(f.total_aed ?? 0), 0)
  const spendLast30 = logs
    .filter((f) => f.logged_at >= thirtyDaysAgo)
    .reduce((s, f) => s + Number(f.total_aed ?? 0), 0)

  // km/L — needs at least 2 logs with odometer reading, in the same vehicle.
  // Logs come pre-sorted DESC by logged_at; we walk pairs.
  const odoLogs = logs
    .filter((f) => f.odometer_km != null)
    .sort((a, b) =>
      a.logged_at < b.logged_at ? -1 : a.logged_at > b.logged_at ? 1 : 0,
    )
  let kmPerL: number | null = null
  if (odoLogs.length >= 2) {
    // For each interval [i-1 → i], distance = odo[i] - odo[i-1], consumed
    // = liters[i] (the fuel put in at i covered the distance just driven).
    let totalDist = 0
    let totalConsumed = 0
    for (let i = 1; i < odoLogs.length; i++) {
      const a = odoLogs[i - 1]!
      const b = odoLogs[i]!
      const dist = (b.odometer_km ?? 0) - (a.odometer_km ?? 0)
      if (dist > 0) {
        totalDist += dist
        totalConsumed += Number(b.liters)
      }
    }
    if (totalConsumed > 0) {
      kmPerL = totalDist / totalConsumed
    }
  }

  const last = logs[0]! // sorted desc
  void last90 // currently unused in per-vehicle but keeping signature stable

  return {
    vehicleId: v.id,
    vehicleLabel: v.label,
    fillsCount: logs.length,
    totalLitres,
    totalSpend,
    spendLast30,
    kmPerL,
    lastFillDate: last.logged_at,
    lastStation: last.station_name,
  }
}

// ===========================================================================
// Subcomponents
// ===========================================================================

function CostBreakdown({
  label,
  value,
  of,
}: {
  label: string
  value: number
  of: number
}) {
  const pct = of > 0 ? Math.round((value / of) * 100) : 0
  return (
    <p className="text-[11px] text-ash leading-snug">
      <span className="uppercase tracking-widest text-[9px] mr-2">{label}</span>
      <span className="font-mono tabular-nums text-chalk">
        AED {Math.round(value).toLocaleString()}
      </span>
      <span className="text-ash/70 ml-1">· {pct}%</span>
    </p>
  )
}

function PulseStat({
  value,
  unit,
  label,
  tone,
}: {
  value: string
  unit?: string
  label: string
  tone?: 'leaf' | 'ash'
}) {
  const valueColor =
    tone === 'leaf' ? 'text-leaf' : tone === 'ash' ? 'text-ash' : 'text-chalk'
  return (
    <div className="px-3 first:pl-0 last:pr-0 md:px-4 py-1">
      <p
        className={`text-base md:text-lg font-semibold ${valueColor} tracking-tight leading-none font-mono tabular-nums`}
      >
        {value}
        {unit && (
          <span className="text-[10px] tracking-widest uppercase text-ash font-sans font-medium ml-1.5">
            {unit}
          </span>
        )}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1.5">
        {label}
      </p>
    </div>
  )
}

function FuelInsightCard({ p }: { p: VehicleFuelInsight }) {
  const ago = relativeAgo(p.lastFillDate)
  return (
    <Link
      href={`/vehicles/${p.vehicleId}`}
      className="card p-4 flex items-start gap-3 hover:border-leaf/30 transition-colors"
    >
      <span
        className="shrink-0 w-10 h-10 rounded-pill bg-leaf/15 text-leaf flex items-center justify-center"
        aria-hidden
      >
        <FuelPumpIcon />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold text-chalk truncate leading-tight">
            {p.vehicleLabel}
          </p>
          {ago && (
            <p className="text-[10px] tracking-widest uppercase text-ash/70 shrink-0">
              {ago}
            </p>
          )}
        </div>

        <div className="mt-2 grid grid-cols-3 gap-3 divide-x divide-seam">
          <MicroStat
            value={p.kmPerL != null ? p.kmPerL.toFixed(1) : '—'}
            unit={p.kmPerL != null ? 'km/L' : ''}
            label="Efficiency"
          />
          <MicroStat
            value={
              p.spendLast30 > 0
                ? `AED ${Math.round(p.spendLast30).toLocaleString()}`
                : '—'
            }
            label="Spend · 30d"
          />
          <MicroStat
            value={`${Math.round(p.totalLitres).toLocaleString()} L`}
            label={
              p.fillsCount === 1
                ? '1 fill · total'
                : `${p.fillsCount} fills · total`
            }
          />
        </div>
      </div>
    </Link>
  )
}

function MicroStat({
  value,
  unit,
  label,
}: {
  value: string
  unit?: string
  label: string
}) {
  return (
    <div className="px-2 first:pl-0">
      <p className="text-sm font-semibold text-chalk leading-none font-mono tabular-nums">
        {value}
        {unit && (
          <span className="text-[9px] tracking-widest uppercase text-ash font-sans font-medium ml-1">
            {unit}
          </span>
        )}
      </p>
      <p className="text-[9px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}

function ActivityRow({ e }: { e: ActivityEvent }) {
  const tone =
    e.kind === 'fuel'
      ? 'text-leaf bg-leaf/15'
      : e.kind === 'service'
        ? 'text-volt bg-volt/15'
        : 'text-ash bg-iron'
  const kindLabel =
    e.kind === 'fuel' ? 'Fuel' : e.kind === 'service' ? 'Service' : 'Document'
  const ago = relativeAgo(e.at)

  return (
    <Link
      href={`/vehicles/${e.vehicleId}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-iron/40 transition-colors"
    >
      <span
        className={`shrink-0 w-8 h-8 rounded-pill flex items-center justify-center ${tone}`}
        aria-hidden
      >
        <ActivityIcon kind={e.kind} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-chalk truncate leading-tight">
          <span className="font-semibold">{e.label}</span>
          <span className="text-ash/80"> · {e.vehicleLabel}</span>
        </p>
        <p className="text-[11px] text-ash mt-0.5">
          <span className="uppercase tracking-widest text-[9px]">
            {kindLabel}
          </span>
          {e.meta && (
            <>
              {' · '}
              <span className="font-mono tabular-nums">{e.meta}</span>
            </>
          )}
          {ago && (
            <>
              {' · '}
              <span>{ago}</span>
            </>
          )}
        </p>
      </div>
    </Link>
  )
}

// ===========================================================================
// Icons + helpers
// ===========================================================================

function FuelPumpIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="3" y1="22" x2="15" y2="22" />
      <line x1="4" y1="9" x2="14" y2="9" />
      <path d="M14 22V4a2 2 0 00-2-2H6a2 2 0 00-2 2v18" />
      <path d="M14 13h2a2 2 0 012 2v2a2 2 0 002 2 2 2 0 002-2V9l-3-3" />
    </svg>
  )
}

function ActivityIcon({ kind }: { kind: 'service' | 'fuel' | 'doc' }) {
  const common = {
    width: 14,
    height: 14,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (kind === 'fuel') {
    return (
      <svg {...common}>
        <line x1="3" y1="22" x2="15" y2="22" />
        <line x1="4" y1="9" x2="14" y2="9" />
        <path d="M14 22V4a2 2 0 00-2-2H6a2 2 0 00-2 2v18" />
        <path d="M14 13h2a2 2 0 012 2v2a2 2 0 002 2 2 2 0 002-2V9l-3-3" />
      </svg>
    )
  }
  if (kind === 'service') {
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function relativeAgo(iso: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const diff = Date.now() - t
  if (diff < 0) return null
  const day = 24 * 60 * 60 * 1000
  const days = Math.floor(diff / day)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}
