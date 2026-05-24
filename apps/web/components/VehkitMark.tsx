/**
 * Vehkit brand mark + lockup, inlined as React components.
 *
 * Why inline (not <img src="/brand/...svg" />):
 *   1. Zero HTTP round-trip — paints on first contentful render.
 *   2. Colours track CSS variables — `rgb(var(--leaf))` etc. — so the mark
 *      automatically adapts to the active light/dark theme without props.
 *   3. The provided lockup SVG ships with a hardcoded noir background
 *      rect; we drop that here so it lays cleanly over any surface.
 *
 * Brand spec lives in apps/web/public/brand/ + BRAND_PATTERNS.md.
 *
 * NO HARDCODED HEX. All colours come from CSS variables. To change a
 * brand colour, edit apps/web/app/globals.css.
 */

// CSS-variable references — kept in one place at the top so the
// component body stays declarative.
const LEAF = 'rgb(var(--leaf))'
const CHALK = 'rgb(var(--chalk))'
const NOIR = 'rgb(var(--noir))'

export function VehkitMark({
  className = '',
  size = 24,
  variant = 'colour',
}: {
  className?: string
  size?: number
  /**
   * - `colour`     : leaf circle + chalk check (default)
   * - `mono-noir`  : noir circle + chalk check (use on chalk surfaces)
   * - `mono-chalk` : chalk circle + noir check (use on noir surfaces)
   */
  variant?: 'colour' | 'mono-noir' | 'mono-chalk'
}) {
  const fill =
    variant === 'mono-noir' ? NOIR : variant === 'mono-chalk' ? CHALK : LEAF
  const stroke = variant === 'mono-chalk' ? NOIR : CHALK

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
      <circle cx="100" cy="100" r="92" style={{ fill }} />
      <path
        d="M 60 104 L 90 132 L 144 76"
        fill="none"
        style={{ stroke }}
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Mark + "vehkit" wordmark side-by-side. Theme-aware via CSS variables —
 * the wordmark always uses --chalk, which is light-on-noir in dark theme
 * and dark-on-chalk in light theme, so it tracks legibility automatically.
 */
export function VehkitLockup({
  className = '',
  height = 24,
}: {
  className?: string
  height?: number
}) {
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
      <circle cx="100" cy="100" r="92" style={{ fill: LEAF }} />
      <path
        d="M 60 104 L 90 132 L 144 76"
        fill="none"
        style={{ stroke: CHALK }}
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
        style={{ fill: CHALK }}
      >
        vehkit
      </text>
    </svg>
  )
}
