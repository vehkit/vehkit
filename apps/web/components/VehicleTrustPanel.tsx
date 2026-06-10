import Link from 'next/link'
import type { UvtsResult, DocXpView, DocXpRow } from '@/lib/uvts'

/**
 * Vehicle Trust panel — the page's value story, redesigned.
 *
 * Principles (from the redesign research pass):
 *  - Score reads as a flat arc + number + plain-language verdict.
 *    Users misread bare gauges; the one-line verdict carries meaning.
 *  - The factor breakdown ("where XP comes from") collapses behind a
 *    native <details> — depth on demand, zero clutter on first paint.
 *  - No skeuomorphic speedometer kitsch. One arc, one accent.
 */
export function VehicleTrustPanel({
  result,
  docView,
}: {
  result: UvtsResult | null
  docView?: DocXpView
}) {
  if (!result) return <EmptyState />

  const risk = result.recommendation.riskLevel
  const verdictTone =
    risk === 'low'
      ? 'text-leaf'
      : risk === 'medium'
        ? 'text-chalk'
        : risk === 'elevated'
          ? 'text-wallet'
          : risk === 'high'
            ? 'text-signal'
            : 'text-ash'
  const arcTone =
    risk === 'high'
      ? 'rgb(var(--signal))'
      : risk === 'elevated'
        ? 'rgb(var(--wallet))'
        : 'rgb(var(--leaf))'

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
          Vehicle Trust XP
        </p>
        <p className="text-[10px] tracking-wider uppercase text-ash">
          Phase {result.phase} of 3
        </p>
      </div>

      {/* Arc + verdict */}
      <div className="mt-5 flex items-center gap-6">
        <ScoreArc score={result.overallScore} color={arcTone} />
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-semibold leading-snug ${verdictTone}`}>
            {result.recommendation.buy}
          </p>
          <p className="text-xs text-ash mt-2 leading-relaxed">
            Confidence{' '}
            <span className="text-chalk font-mono tabular-nums">
              {result.confidence}
            </span>
            {' · '}Resale{' '}
            <span className="text-chalk">
              {result.recommendation.resale}
            </span>
          </p>
        </div>
      </div>

      {/* Breakdown — collapsed by default, depth on demand */}
      {docView && docView.rows.length > 0 && (
        <details className="group mt-5 border-t border-seam/50 pt-4">
          <summary className="flex items-center justify-between cursor-pointer list-none select-none">
            <span className="text-xs font-semibold text-chalk tracking-tight">
              Where your XP comes from
            </span>
            <span className="flex items-center gap-3 text-[10px] tracking-wider uppercase text-ash">
              <span className="font-mono tabular-nums">
                {docView.totalEarned}/{docView.totalPotential}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-open:rotate-180"
                aria-hidden
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </summary>
          <div className="mt-2">
            {docView.rows.map((row) => (
              <DocRow key={row.id} row={row} />
            ))}
          </div>
          <p className="text-[11px] text-ash/60 mt-4 leading-relaxed">
            XP measures trust based on the documents on file. A physical
            inspection and OBD scan are still advised before any purchase.
          </p>
        </details>
      )}
    </div>
  )
}

// ─── Score arc ──────────────────────────────────────────────────────

const ARC_LEN = Math.PI * 50 // semicircle, r=50

function ScoreArc({ score, color }: { score: number; color: string }) {
  const pct = Math.max(0, Math.min(100, score))
  return (
    <div className="relative shrink-0 w-[132px]">
      <svg viewBox="0 0 120 66" className="w-full" aria-hidden>
        <path
          d="M10 60 A50 50 0 0 1 110 60"
          fill="none"
          stroke="rgb(var(--seam))"
          strokeWidth="7"
          strokeLinecap="round"
        />
        <path
          d="M10 60 A50 50 0 0 1 110 60"
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * ARC_LEN} ${ARC_LEN}`}
        />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center">
        <span className="font-mono text-3xl font-semibold text-chalk tabular-nums tracking-tight leading-none">
          {pct}
        </span>
        <span className="block text-[9px] tracking-[0.22em] uppercase text-ash mt-0.5">
          of 100 XP
        </span>
      </div>
    </div>
  )
}

// ─── Doc rows (carried over from the doc-centric card) ─────────────

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
    <span className="shrink-0 w-5 h-5 rounded-pill border border-seam text-ash flex items-center justify-center mt-0.5">
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

// ─── Empty state ────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="card p-6">
      <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
        Vehicle Trust XP
      </p>
      <h2 className="text-xl font-semibold tracking-tighter text-chalk mt-3">
        Upload a document to start earning XP
      </h2>
      <p className="text-sm text-ash mt-2 leading-relaxed">
        Mulkiya unlocks ~16 XP. Insurance certificate adds ~10. RTA passing
        report adds ~8. Service records keep stacking from there.
      </p>
    </div>
  )
}
