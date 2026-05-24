/**
 * SINGLE SOURCE OF TRUTH for raw hex values of the Vehkit B04 palette.
 *
 * In 99% of cases, components MUST NOT import from this file. Use the
 * Tailwind token classes instead: `text-chalk`, `bg-noir`, `border-seam`,
 * `text-leaf`, `text-volt`, `text-ash`, etc. Those classes consume CSS
 * variables defined in globals.css and adapt to light/dark theme.
 *
 * The only legitimate consumers of this file:
 *   1. `<meta name="theme-color">` — browser reads this before CSS loads,
 *      so it cannot use `var(--noir)`. Must be a raw hex.
 *   2. Server-rendered email templates — Resend's HTML compositor and most
 *      email clients (Outlook in particular) don't honour CSS variables.
 *   3. PWA / web-manifest JSON — same reason as theme-color.
 *
 * If you find yourself reaching for this file from a component .tsx file,
 * stop and use a Tailwind brand token instead. If a token doesn't exist for
 * what you need, the right move is to add it to globals.css + tailwind.config,
 * not to import a hex.
 *
 * Values mirror the dark-theme CSS variables in globals.css. Keep these
 * two files in sync — when the palette ships a v2, edit both atomically.
 */

// Brand palette — match values in apps/web/app/globals.css `:root.dark`.
export const BRAND_HEX = {
  noir: '#0A0A0B',
  chalk: '#F5F5F0',
  leaf: '#21C07A',
  leafDk: '#1AA365',
  volt: '#D4FF00', // legacy electric lime — kept for accent contrast
  ash: '#8B8E96',
  iron: '#1F2127',
  seam: '#2A2D33',
  carbon: '#16181D',
  wallet: '#C9A961',
  signal: '#FF5A5F',
} as const

export type BrandToken = keyof typeof BRAND_HEX

/**
 * Theme-color values for `<meta name="theme-color">`. The browser uses
 * these to colour the browser chrome (URL bar on Android, status bar on
 * iOS PWA, taskbar on Windows). Must be raw hex — read before CSS loads.
 */
export const THEME_COLORS = {
  dark: BRAND_HEX.noir,
  light: BRAND_HEX.chalk,
} as const
