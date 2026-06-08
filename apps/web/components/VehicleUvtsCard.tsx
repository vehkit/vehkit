/**
 * Vehicle Trust XP card — the gamified UVTS surface.
 *
 * Server component. Takes a precomputed UvtsResult and an optional
 * vehicleId for routing the "Earn more XP" chips. Renders:
 *
 *   - Big XP number / 100 + progress bar
 *   - Buy recommendation + confidence band
 *   - Earned XP list (compact, leaf-coloured ticks)
 *   - Earn more XP chips — each tappable to the right upload/log flow
 *   - Locked slots (Phase 2/3) shown as a quiet footer
 *
 * Empty state when result is null: "Upload a document to start earning XP".
 */
import Link from 'next/link'
import type { UvtsResult, XpSlot } from '@/lib/uvts'
import { deriveXpView } from '@/lib/uvts'

export function VehicleUvtsCard({
  result,
  vehicleId,
  variant = 'hero',
  showEarnMore = true,
}: {
  result: UvtsResult | null
  vehicleId?: string
  variant?: 'hero' | 'compact'
  /** When false (e.g. share view for buyers) the "Earn more XP"
   *  chips and locked footer are hidden — buyers don't need owner-CTAs. */
  showEarnMore?: boolean
}) {
  if (!result) return <EmptyState variant={variant} />
  if (variant === 'compact') return <CompactBadge result={result} />
  return (
    <HeroCard
      result={result}
      vehicleId={vehicleId ?? ''}
      showEarnMore={showEarnMore}
    />
  )
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

// ─── Hero card ──────────────────────────────────────────────────────

function HeroCard({
  result,
  vehicleId,
  showEarnMore,
}: {
  result: UvtsResult
  vehicleId: string
  showEarnMore: boolean
}) {
  const xp = deriveXpView(result, vehicleId)
  const totalAvailable = xp.earnMore.reduce(
    (acc, s) => acc + (s.max - s.xp),
    0,
  )
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
      <div className="flex items-end justify-between gap-6 mb-3">
        <div className="min-w-0">
          <p className="text-5xl md:text-6xl font-semibold tracking-tighter text-chalk leading-none tabular-nums">
            {result.overallScore}
            <span className="text-2xl text-ash ml-2 font-normal">
              / 100 XP
            </span>
          </p>
          <p className={`text-sm font-semibold mt-3 ${buyTone}`}>
            {result.recommendation.buy}
          </p>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-seam rounded-pill overflow-hidden mb-3">
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
        {totalAvailable > 0 && (
          <>
            {' '}
            ·{' '}
            <span className="text-leaf">
              +{totalAvailable} XP available
            </span>
          </>
        )}
      </p>

      {/* Earned */}
      {xp.earned.length > 0 && (
        <section className="mt-8">
          <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold mb-3">
            Earned
          </p>
          <ul className="space-y-1.5">
            {xp.earned.map((slot) => (
              <li
                key={slot.label}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <CheckIcon />
                  <span className="text-chalk truncate">{slot.label}</span>
                </span>
                <span className="font-mono tabular-nums text-leaf text-xs shrink-0">
                  +{slot.xp} XP
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Earn more — owner only. Buyers on /r/[token] don't need
          upload CTAs; they just want to see the data the car has. */}
      {showEarnMore && xp.earnMore.length > 0 && (
        <section className="mt-8">
          <p className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold mb-3">
            Earn more XP
          </p>
          <ul className="space-y-2">
            {dedupeByAction(xp.earnMore).map(({ slot, totalGain }) => (
              <li key={slot.unlock?.action ?? slot.label}>
                <ChipLink slot={slot} totalGain={totalGain} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Locked footer — owner only too, same reasoning. */}
      {showEarnMore && xp.locked.length > 0 && (
        <section className="mt-8 pt-4 border-t border-seam/50">
          <p className="text-[10px] tracking-[0.28em] uppercase text-ash font-bold mb-2">
            Locked · coming soon
          </p>
          <p className="text-xs text-ash/70 leading-relaxed">
            {xp.locked
              .map((s) => `${s.label} (+${s.max - s.xp} XP)`)
              .join(' · ')}
          </p>
        </section>
      )}

      {/* Explanation */}
      <p className="text-[11px] text-ash/60 mt-8 leading-relaxed">
        XP measures trust based on uploaded records. A physical
        inspection and OBD scan are still advised before any purchase.
      </p>
    </div>
  )
}

// ─── Chip + helpers ────────────────────────────────────────────────

function ChipLink({
  slot,
  totalGain,
}: {
  slot: XpSlot
  totalGain: number
}) {
  const href = slot.unlock?.href
  const body = (
    <span className="group flex items-center justify-between gap-3 py-3 px-4 -mx-1 rounded-DEFAULT border border-seam hover:border-leaf hover:bg-leaf/5 transition-colors">
      <span className="flex items-center gap-3 min-w-0">
        <span className="w-7 h-7 rounded-pill bg-leaf/15 text-leaf flex items-center justify-center text-xs font-bold shrink-0 group-hover:bg-leaf group-hover:text-white transition-colors">
          +
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-chalk truncate">
            {slot.unlock?.action ?? slot.label}
          </span>
        </span>
      </span>
      <span className="font-mono tabular-nums text-sm font-semibold text-leaf shrink-0">
        +{totalGain} XP
      </span>
    </span>
  )
  if (!href) return body
  if (href.startsWith('#')) {
    // Anchor link triggers the FAB upload from anywhere on the page.
    return <a href={href}>{body}</a>
  }
  return <Link href={href}>{body}</Link>
}

/**
 * Multiple slots can unlock via the same action (e.g. uploading a
 * mulkiya fills VIN + engine + ownership + plate). Collapse them into
 * a single chip whose +XP total is the sum of remaining gains for that
 * action. Keeps the list short and the user motivated by big numbers.
 */
function dedupeByAction(
  slots: XpSlot[],
): Array<{ slot: XpSlot; totalGain: number }> {
  const map = new Map<string, { slot: XpSlot; totalGain: number }>()
  for (const slot of slots) {
    const key = slot.unlock?.action ?? slot.label
    const gain = slot.max - slot.xp
    const existing = map.get(key)
    if (existing) {
      existing.totalGain += gain
    } else {
      map.set(key, { slot, totalGain: gain })
    }
  }
  // Sort by total gain descending — biggest wins first.
  return [...map.values()].sort((a, b) => b.totalGain - a.totalGain)
}

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-leaf shrink-0"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}
