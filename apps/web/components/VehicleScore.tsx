type ScoreData = {
  score: number | null
  verification_pts: number
  compliance_pts: number
  consistency_pts: number
  recency_pts: number
  total_records: number
  workshop_verified: number
  distinct_workshops: number
  silver_gold_count: number
  completed_reminders: number
  missed_reminders: number
  open_overdue: number
  last_service_date: string | null
  vehicle_age_days: number
  message?: string
}

function tone(score: number | null): {
  bg: string
  text: string
  ring: string
  label: string
} {
  if (score == null)
    return {
      bg: 'bg-iron',
      text: 'text-ash',
      ring: 'ring-seam',
      label: 'New',
    }
  if (score >= 80)
    return {
      bg: 'bg-volt/15',
      text: 'text-volt',
      ring: 'ring-volt/40',
      label: 'Excellent',
    }
  if (score >= 65)
    return {
      bg: 'bg-volt/10',
      text: 'text-volt',
      ring: 'ring-volt/25',
      label: 'Good',
    }
  if (score >= 50)
    return {
      bg: 'bg-wallet/15',
      text: 'text-wallet',
      ring: 'ring-wallet/40',
      label: 'Fair',
    }
  return {
    bg: 'bg-signal/15',
    text: 'text-signal',
    ring: 'ring-signal/40',
    label: 'Needs work',
  }
}

/**
 * Compact score chip — meant to live in a vehicle hero card overlay.
 * Discreet, single-line.
 */
export function VehicleScoreChip({ data }: { data: ScoreData | null }) {
  if (!data) return null
  const { bg, text } = tone(data.score)
  if (data.score == null) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 ${bg} ${text} px-2 py-1 rounded-pill text-[10px] tracking-widest uppercase font-medium`}
        title="Score begins after first verified entry"
      >
        <span className="font-mono">— /100</span>
      </span>
    )
  }
  return (
    <span
      className={`inline-flex items-baseline gap-1 ${bg} ${text} px-2.5 py-1 rounded-pill font-mono tabular-nums font-semibold`}
      title="Vehkit passport score"
    >
      <span className="text-sm">{data.score}</span>
      <span className="text-[9px] tracking-widest uppercase opacity-70">/100</span>
    </span>
  )
}

/**
 * Large score panel — for the public passport page (/r/[token]).
 * Shows the headline number, label, and component breakdown.
 */
export function VehicleScorePanel({ data }: { data: ScoreData | null }) {
  if (!data) return null

  const t = tone(data.score)

  if (data.score == null) {
    return (
      <div className="card p-6 text-center">
        <p className="text-[10px] tracking-widest uppercase text-ash">Vehkit score</p>
        <p className="font-mono text-4xl md:text-5xl font-semibold text-ash tabular-nums tracking-tighter mt-2">
          —
        </p>
        <p className="text-xs text-ash mt-3 leading-relaxed">
          {data.message ?? 'Not enough data yet.'}
        </p>
      </div>
    )
  }

  const components: { label: string; value: number; max: number }[] = [
    { label: 'Verification', value: data.verification_pts, max: 40 },
    { label: 'Compliance', value: data.compliance_pts, max: 30 },
    { label: 'Consistency', value: data.consistency_pts, max: 20 },
    { label: 'Recency', value: data.recency_pts, max: 10 },
  ]

  return (
    <div className={`card p-6 ring-1 ${t.ring}`}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-ash">Vehkit score</p>
          <p
            className={`font-mono text-5xl md:text-6xl font-semibold tabular-nums tracking-tighter mt-1 ${t.text}`}
          >
            {data.score}
            <span className="text-ash text-lg font-normal ml-1">/100</span>
          </p>
        </div>
        <div className="text-right">
          <p
            className={`text-xs tracking-widest uppercase font-medium ${t.text}`}
          >
            {t.label}
          </p>
          <p className="text-[10px] text-ash mt-1">
            {data.workshop_verified} verified · {data.distinct_workshops} workshop
            {data.distinct_workshops === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-2">
        {components.map((c) => {
          const pct = Math.min(100, Math.round((c.value / c.max) * 100))
          return (
            <div key={c.label}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ash tracking-wide">{c.label}</span>
                <span className="font-mono tabular-nums text-chalk">
                  {c.value} <span className="text-ash">/ {c.max}</span>
                </span>
              </div>
              <div className="h-1 bg-iron rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full ${
                    c.value >= c.max * 0.66
                      ? 'bg-volt'
                      : c.value >= c.max * 0.33
                        ? 'bg-wallet'
                        : 'bg-signal/70'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] text-ash/80 mt-5 leading-relaxed">
        Score reflects verified service entries, on-time reminder compliance, service density
        over the vehicle's age, and recency of the last service. Higher score = stronger
        passport at resale.
      </p>
    </div>
  )
}
