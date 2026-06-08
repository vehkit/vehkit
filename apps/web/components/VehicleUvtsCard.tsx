/**
 * Vehicle Trust XP card — doc-centric presentation.
 *
 * User-tested insight: people think in physical documents ("my mulkiya",
 * "my insurance"), NOT abstract sub-scores. So the card lists doc-shaped
 * rows. Each row tells the user three things:
 *
 *   1. Did I upload this?           (✓ green tick / + leaf plus)
 *   2. What did it give me?         (concrete extracted values when
 *                                    uploaded; field promises when not)
 *   3. How much XP did/will it add? (right-aligned per row)
 *
 * No abstract categories. No checklists. The score is just the sum of
 * what each doc contributed, and you can see exactly which doc gave
 * which fact.
 */
import Link from 'next/link'
import type { UvtsResult, DocXpView, DocXpRow } from '@/lib/uvts'

export function VehicleUvtsCard({
  result,
  docView,
  variant = 'hero',
}: {
  result: UvtsResult | null
  /** Required for the hero variant — computed by the page from the
   *  same inputs the score uses, so totals stay consistent. */
  docView?: DocXpView
  variant?: 'hero' | 'compact'
}) {
  if (!result) return <EmptyState variant={variant} />
  if (variant === 'compact') return <CompactBadge result={result} />
  if (!docView) {
    // Defensive — if a caller forgets to pass docView for the hero
    // variant, render just the score block so we never crash.
    return <ScoreBlock result={result} />
  }
  return <HeroCard result={result} docView={docView} />
}

// ─── Empty state ────────────────────────────────────────────────────

function EmptyState({ variant }: { variant: 'hero' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <span className="inline-flex items-center gap-2 text-xs text-ash">
        <span className="w-2 h-2 rounded-pill bg-seam" />0 XP
      </span>
    )
  }
  return (
    <div>
      <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
        Vehicle Trust XP
      </p>
      <h2 className="text-2xl font-semibold tracking-tighter text-chalk mt-3">
        Upload a document to start earning XP
      </h2>
      <p className="text-sm text-ash mt-2 leading-relaxed">
        Mulkiya unlocks ~16 XP. Insurance certificate adds ~10. RTA
        passing report adds ~8. Service records keep stacking from there.
      </p>
    </div>
  )
}

// ─── Compact badge ──────────────────────────────────────────────────

function CompactBadge({ result }: { result: UvtsResult }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs">
      <span className="text-[10px] tracking-widest uppercase text-ash">
        Trust XP
      </span>
      <span className="font-mono tabular-nums font-semibold text-chalk">
        {result.overallScore}
      </span>
      <span className="text-ash/60 text-[10px]">/ 100</span>
    </span>
  )
}

// ─── Score-only block ───────────────────────────────────────────────

function ScoreBlock({ result }: { result: UvtsResult }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold mb-4">
        Vehicle Trust XP
      </p>
      <p className="text-5xl md:text-6xl font-semibold tracking-tighter text-chalk leading-none tabular-nums">
        {result.overallScore}
        <span className="text-2xl text-ash ml-2 font-normal">/ 100 XP</span>
      </p>
      <div className="h-1.5 bg-seam rounded-pill overflow-hidden mt-4">
        <div
          className="h-full bg-leaf rounded-pill"
          style={{ width: `${clamp(result.overallScore, 0, 100)}%` }}
        />
      </div>
    </div>
  )
}

// ─── Hero card ──────────────────────────────────────────────────────

function HeroCard({
  result,
  docView,
}: {
  result: UvtsResult
  docView: DocXpView
}) {
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
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-4">
        <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
          Vehicle Trust XP
        </p>
        <p className="text-[10px] tracking-wider uppercase text-ash">
          Phase {result.phase} of 3
        </p>
      </div>

      {/* Score block */}
      <p className="text-5xl md:text-6xl font-semibold tracking-tighter text-chalk leading-none tabular-nums">
        {result.overallScore}
        <span className="text-2xl text-ash ml-2 font-normal">/ 100 XP</span>
      </p>
      <p className={`text-sm font-semibold mt-3 ${buyTone}`}>
        {result.recommendation.buy}
      </p>

      {/* Progress */}
      <div className="h-1.5 bg-seam rounded-pill overflow-hidden mt-4 mb-3">
        <div
          className="h-full bg-leaf rounded-pill transition-[width] duration-500"
          style={{ width: `${clamp(result.overallScore, 0, 100)}%` }}
        />
      </div>

      <p className="text-xs text-ash">
        Confidence{' '}
        <span className="text-chalk font-mono tabular-nums">
          {result.confidence}
        </span>{' '}
        · Resale{' '}
        <span className="text-chalk">{result.recommendation.resale}</span>
      </p>

      {/* Doc rows — the heart of the new design */}
      <section className="mt-8 space-y-1">
        <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold mb-3">
          Where your XP comes from
        </p>
        {docView.rows.map((row) => (
          <DocRow key={row.id} row={row} />
        ))}
      </section>

      {/* Explanation */}
      <p className="text-[11px] text-ash/60 mt-6 leading-relaxed">
        XP measures trust based on the documents you upload. Each row
        shows what you've given us and what it contributed. A physical
        inspection and OBD scan are still advised before any purchase.
      </p>
    </div>
  )
}

// ─── Doc row ────────────────────────────────────────────────────────

function DocRow({ row }: { row: DocXpRow }) {
  return (
    <div
      className={`py-3 border-b border-seam/40 last:border-b-0 ${
        row.locked ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          {row.uploaded ? <UploadedIcon /> : <PendingIcon locked={!!row.locked} />}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-chalk leading-tight">
              {row.label}
            </p>
            {row.fields.length > 0 && (
              <p className="text-xs text-ash/80 mt-1.5 leading-relaxed">
                {row.fields.join(' · ')}
              </p>
            )}
            {row.cta && (
              <Link
                href={row.cta.href}
                className="inline-block mt-2 text-[11px] tracking-wider uppercase font-semibold text-leaf hover:text-leaf-dk"
              >
                {row.cta.label} →
              </Link>
            )}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-mono tabular-nums text-sm font-semibold ${
              row.uploaded ? 'text-leaf' : 'text-ash'
            }`}
          >
            {row.uploaded ? '+' : ''}
            {row.uploaded ? row.earned : row.potential} XP
          </p>
          {!row.uploaded && !row.locked && (
            <p className="text-[10px] text-ash/60 mt-0.5">available</p>
          )}
        </div>
      </div>
    </div>
  )
}

function UploadedIcon() {
  return (
    <span className="shrink-0 w-5 h-5 rounded-pill bg-leaf/15 text-leaf flex items-center justify-center mt-0.5">
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </span>
  )
}

function PendingIcon({ locked }: { locked: boolean }) {
  return (
    <span
      className={`shrink-0 w-5 h-5 rounded-pill border flex items-center justify-center mt-0.5 ${
        locked ? 'border-seam text-ash' : 'border-seam text-ash'
      }`}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        {locked ? (
          <>
            <rect x="5" y="11" width="14" height="10" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </>
        ) : (
          <>
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </>
        )}
      </svg>
    </span>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
