/**
 * Vehkit design tokens — single source of truth.
 * Consumed by Tailwind (web) and Tamagui (mobile).
 *
 * Update here, regenerate downstream configs.
 */

export const colors = {
  // Primary surface + text
  ink: '#0E1726',
  cream: '#FAF7F2',

  // Accent — verified state, primary CTAs
  verified: '#00A86B',

  // Neutrals
  mist: '#E8EAEE',
  steel: '#5B6573',

  // Semantic
  signal: '#D9534F', // overdue, fraud, errors
  wallet: '#C9A24B', // premium tier, resale report covers, Wallet pass

  white: '#FFFFFF',
  black: '#000000',
} as const

export const typography = {
  fontFamily: {
    sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
    serif: ['Source Serif Pro', 'Georgia', 'serif'],
    mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
    arabic: ['IBM Plex Arabic', 'system-ui', 'sans-serif'],
  },
  fontSize: {
    xs: '0.75rem',
    sm: '0.875rem',
    base: '1rem',
    lg: '1.125rem',
    xl: '1.25rem',
    '2xl': '1.5rem',
    '3xl': '1.875rem',
    '4xl': '2.25rem',
    '5xl': '3rem',
    '6xl': '3.75rem',
  },
  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  letterSpacing: {
    tightest: '-0.02em',
    tight: '-0.01em',
    normal: '0',
    wide: '0.025em',
    widest: '0.1em',
  },
} as const

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
  20: '5rem',
  24: '6rem',
} as const

export const radii = {
  none: '0',
  sm: '0.25rem',
  DEFAULT: '0.5rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
} as const

export const tokens = { colors, typography, spacing, radii } as const
export type Tokens = typeof tokens
