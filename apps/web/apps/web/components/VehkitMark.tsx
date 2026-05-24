/**
 * Vehkit brand mark + lockup, inlined as React components.
 *
 * Why inline (not <img src="/brand/...svg" />):
 *   1. Zero HTTP round-trip — paints on first contentful render.
 *   2. Currents inherit Tailwind tone classes — `text-leaf` on the wrapper
 *      flips the mark to chalk-on-leaf, etc.
 *   3. The provided lockup SVG ships with a hardcoded noir background
 *      rect; we drop that here so it lays cleanly over any surface.
 *
 * Brand spec lives in apps/web/public/brand/ + BRAND_PATTERNS.md.
 */

const LEAF = '#21C07A'
const CHALK = '#F5F5F0'

export function VehkitMark({
  className = '',
  size = 24,
  variant = 'colour',
}: {
  className?: string
  size?: number
  /**
   * - `colour`  : leaf circle + chalk check (default)
   * - `mono-noir`: noir circle + chalk check (use on chalk surfaces)
   * - `mono-chalk`: chalk circle + noir check (use on noir surfaces)
   */
  variant?: 'colour' | 'mono-noir' | 'mono-chalk'
}) {
  const fill =
    variant === 'mono-noir' ? '#0A0A0B' : variant === 'mono-chalk' ? CHALK : LEAF
  const stroke =
    variant === 'mono-chalk' ? '#0A0A0B' : CHALK

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 200"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Vehkit"
    >
      <circle cx="100" cy="100" r="92" fill={fill} />
      <path
        d="M 60 104 L 90 132 L 144 76"
        fill="none"
        stroke={stroke}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Mark + "vehkit" wordmark side-by-side. Theme-aware via the `tone` prop.
 * Default is the dark-theme rendering (chalk wordmark on noir bg).
 */
export function VehkitLockup({
  className = '',
  height = 24,
  tone = 'dark',
}: {
  className?: string
  height?: number
  tone?: 'dark' | 'light'
}) {
  // viewBox tuned to the brand pack lockup, but with no background rect
  // and the wordmark colour matching the surface tone.
  const wordmarkColour = tone === 'dark' ? CHALK : '#0A0A0B'
  // Width derived from height keeping the original 720:200 ratio
  const width = Math.round((height * 720) / 200)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 720 200"
      width={width}
      height={height}
      className={className}
      role="img"
      aria-label="Vehkit"
    >
      <circle cx="100" cy="100" r="92" fill={LEAF} />
      <path
        d="M 60 104 L 90 132 L 144 76"
        fill="none"
        stroke={CHALK}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <text
        x="240"
        y="138"
        fontFamily="Nunito, 'Mulish', system-ui, sans-serif"
        fontWeight="800"
        fontSize="124"
        letterSpacing="-5"
        fill={wordmarkColour}
      >
        vehkit
      </text>
    </svg>
  )
}
