import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Semantic tokens — values come from CSS variables in globals.css.
        // These keep the same name in light/dark; only the literal RGB shifts.
        noir: 'rgb(var(--noir) / <alpha-value>)', // page background
        carbon: 'rgb(var(--carbon) / <alpha-value>)', // card surface
        iron: 'rgb(var(--iron) / <alpha-value>)', // elevated surface
        seam: 'rgb(var(--seam) / <alpha-value>)', // borders
        chalk: 'rgb(var(--chalk) / <alpha-value>)', // primary text
        ash: 'rgb(var(--ash) / <alpha-value>)', // muted text

        // Brand — leaf is the primary identity (used on the mark + wordmark
        // + verified states). Volt stays as the electric accent for one
        // decisive flourish at a time, never the primary surface.
        leaf: 'rgb(var(--leaf) / <alpha-value>)',
        'leaf-dk': 'rgb(var(--leaf-dk) / <alpha-value>)',
        volt: 'rgb(var(--volt) / <alpha-value>)',
        wallet: 'rgb(var(--wallet) / <alpha-value>)', // premium accent
        signal: 'rgb(var(--signal) / <alpha-value>)', // alert / overdue

        // Legacy tokens — kept stable across themes (only used in a couple places)
        ink: '#0E1726',
        verified: 'rgb(var(--leaf) / <alpha-value>)',
        cream: '#FAF7F2',
        mist: '#E8EAEE',
        steel: '#5B6573',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['"Source Serif Pro"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      letterSpacing: {
        tightest: '-0.04em',
        tighter: '-0.02em',
      },
      fontSize: {
        hero: ['3rem', { lineHeight: '1.05', letterSpacing: '-0.04em' }],
        'hero-lg': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.04em' }],
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        pill: '999px',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
      },
    },
  },
  plugins: [],
}

export default config
