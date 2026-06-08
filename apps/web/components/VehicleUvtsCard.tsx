/**
 * UVTS hero card — the primary vehicle trust score surface.
 *
 * Server component. Receives a precomputed UvtsResult; never computes
 * itself. Two variants:
 *   - "hero" (default): full card with score ring, grade, confidence,
 *     category bars, strengths / warnings / red flags
 *   - "compact": small badge for use in lists and the owner dashboard
 *
 * Honest by default: when result is null (no docs uploaded yet), the
 * component renders a "unlock your score" hint instead of a fake number.
 */
import type { UvtsResult } from '@/lib/uvts'

const GRADE_COLOR: Record<string, string> = {
  'A+': 'text-leaf',
  A: 'text-leaf',
  'A-': 'text-leaf',
  'B+': 'text-leaf',
  B: 'text-leaf',
  'B-': 'text-wallet',
  'C+': 'text-wallet',
  C: 'text-wallet',
  'C-': 'text-wallet',
  D: 'text-signal',
  F: 'text-signal',
}

export function VehicleUvtsCard({
  result,
  variant = 'hero',
}: {
  result: UvtsResult | null
  variant?: 'hero' | 'compact'
}) {
  if (!result) return <EmptyState variant={variant} />

  if (variant === 'compact') {
    return <CompactBadge result={result} />
  }

  return <HeroCard result={result} />
}

// ─── Empty state ────────────────────────────────────────────────────

function EmptyState({ variant }: { variant: 'hero' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-ash">
        <span className="w-2 h-2 rounded-pill bg-seam" />
        Score not yet calculated
      </span>
    )
  }
  return (
    <div className="border border-seam rounded-DEFAULT p-5">
      <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
        Vehicle Trust Score
      </p>
      <h2 className="text-xl font-semibold tracking-tighter text-chalk mt-2">
        Upload a document to unlock your score
      </h2>
      <p className="text-sm text-ash mt-2 leading-relaxed">
        Your mulkiya, insurance, or RTA passing certificate gets you to a
        first score in under a minute. Service records lift it from there.
      </p>
    </div>
  )
}

// ─── Compact badge ──────────────────────────────────────────────────

function CompactBadge({ result }: { result: UvtsResult }) {
  const gradeClass = GRADE_COLOR[result.grade] ?? 'text-chalk'
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-[10px] tracking-widest uppercase text-ash">
        Trust
      </span>
      <span className={`font-mono tabular-nums font-semibold text-chalk`}>
        {result.overallScore}
      </span>
      <span className={`font-semibold ${gradeClass}`}>{result.grade}</span>
      <span className="text-ash/60 text-[10px]">
        · conf {result.confidence}
      </span>
    </span>
  )
}

// ─── Hero card ──────────────────────────────────────────────────────

function HeroCard({ result }: { result: UvtsResult }) {
  const gradeClass = GRADE_COLOR[result.grade] ?? 'text-chalk'
  const buyTone =
    result.recommendation.riskLevel === 'low'
      ? 'text-leaf'
      : result.recommendation.riskLevel === 'medium'
        ? 'text-chalk'
        : result.recommendation.riskLevel === 'elevated'
          ? 'text-wallet'
          : result.recommendation.riskLevel === 'high'
            ? 'text-signal'
            : 'text-ash'

  return (
    <div className="border border-seam rounded-DEFAULT overflow-hidden">
      {/* Header strip */}
      <div className="px-5 pt-4 pb-3 border-b border-seam">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
            Vehicle Trust Score
          </p>
          <p className="text-[10px] tracking-wider uppercase text-ash">
            Phase {result.phase} of 3
          </p>
        </div>
      </div>

      {/* Score block */}
      <div className="px-5 py-6 grid grid-cols-[auto_1fr] gap-5 items-center">
        <ScoreRing score={result.overallScore} grade={result.grade} />
        <div className="min-w-0">
          <p
            className={`text-3xl md:text-4xl font-semibold tracking-tighter ${gradeClass}`}
          >
            {result.grade}
          </p>
          <p
            className={`text-sm font-semibold mt-1 ${buyTone}`}
          >
            {result.recommendation.buy}
          </p>
          <div className="mt-3 flex items-center gap-3 text-xs text-ash">
            <span>
              Confidence{' '}
              <span className="text-chalk font-mono tabular-nums">
                {result.confidence}
              </span>
            </span>
            <span className="w-px h-3 bg-seam" />
            <span>
              Resale{' '}
              <span className="text-chalk">{result.recommendation.resale}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Category bars. Damage shows its default (18/20 — "no damage
          reported") so the visible numbers add up to the overall score.
          Market still surfaces "Coming soon" because in Phase 1 it
          contributes 0 — showing 0/20 visually as a maxed-out bar would
          mislead. */}
      <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-5 gap-3">
        <CategoryBar label="Identity" value={result.categories.identity} />
        <CategoryBar label="Usage" value={result.categories.usage} />
        <CategoryBar
          label="Maintenance"
          value={result.categories.maintenance}
        />
        <CategoryBar
          label="Damage"
          value={result.categories.damage}
          note="No damage reported"
        />
        <CategoryBar
          label="Market"
          value={result.categories.market}
          pending="Coming soon"
        />
      </div>

      {/* Red flags */}
      {result.redFlags.length > 0 && (
        <div className="px-5 pb-4 border-t border-seam pt-4">
          <p className="text-[10px] tracking-widest uppercase text-signal font-bold mb-2">
            Red flags
          </p>
          <ul className="space-y-1">
            {result.redFlags.map((f) => (
              <li key={f} className="text-sm text-signal flex items-start gap-2">
                <span aria-hidden>·</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Warnings + Strengths grid */}
      {(result.warnings.length > 0 || result.strengths.length > 0) && (
        <div className="px-5 pb-5 border-t border-seam pt-4 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {result.strengths.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-leaf font-bold mb-2">
                Strengths
              </p>
              <ul className="space-y-1">
                {result.strengths.map((s) => (
                  <li
                    key={s}
                    className="text-sm text-chalk/85 flex items-start gap-2"
                  >
                    <span aria-hidden className="text-leaf">·</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-wallet font-bold mb-2">
                Watch-outs
              </p>
              <ul className="space-y-1">
                {result.warnings.map((w) => (
                  <li
                    key={w}
                    className="text-sm text-chalk/85 flex items-start gap-2"
                  >
                    <span aria-hidden className="text-wallet">·</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Explanation */}
      <div className="px-5 pb-5 border-t border-seam pt-4">
        <p className="text-xs text-ash leading-relaxed">{result.explanation}</p>
        <p className="text-[10px] text-ash/60 mt-2 leading-relaxed">
          UVTS measures trust and risk based on uploaded records. It does
          not replace a physical inspection or OBD diagnostic scan.
        </p>
      </div>
    </div>
  )
}

// ─── Score ring (SVG) ───────────────────────────────────────────────

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const radius = 38
  const stroke = 6
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamp(score, 0, 100) / 100) * circumference
  const ringColor =
    score >= 80
      ? 'var(--color-leaf, #21c07a)'
      : score >= 60
        ? 'var(--color-wallet, #f2b035)'
        : 'var(--color-signal, #ef4444)'

  return (
    <div className="relative w-[96px] h-[96px] shrink-0">
      <svg width="96" height="96" viewBox="0 0 96 96" aria-hidden>
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="var(--color-seam, #2a2d32)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={ringColor}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-semibold text-chalk tabular-nums leading-none">
          {score}
        </span>
        <span className="text-[10px] tracking-widest uppercase text-ash mt-1">
          out of 100
        </span>
      </div>
      {/* Hidden text so screen readers get the grade too */}
      <span className="sr-only">Grade {grade}</span>
    </div>
  )
}

// ─── Category bar ───────────────────────────────────────────────────

function CategoryBar({
  label,
  value,
  pending,
  note,
}: {
  label: string
  value: { score: number; max: number }
  pending?: string
  note?: string
}) {
  const pct = value.max > 0 ? (value.score / value.max) * 100 : 0
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between mb-1.5">
        <p className="text-[10px] tracking-widest uppercase text-ash">
          {label}
        </p>
        <p className="text-xs font-mono tabular-nums text-chalk">
          {pending ? '—' : `${value.score}/${value.max}`}
        </p>
      </div>
      <div className="h-1 bg-seam rounded-pill overflow-hidden">
        {!pending && (
          <div
            className="h-full bg-leaf rounded-pill"
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
      {(pending || note) && (
        <p className="text-[10px] text-ash/60 mt-1">{pending ?? note}</p>
      )}
    </div>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
