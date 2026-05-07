import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Dark-first palette — premium Gen Z mobile
        noir: '#0A0B0F', // page background
        carbon: '#16181D', // card / surface
        iron: '#1F2127', // elevated surface
        seam: '#2A2D33', // borders
        chalk: '#F4F4F2', // primary text
        ash: '#8B8E96', // muted text
        volt: '#19E68C', // primary accent / verified
        wallet: '#E5C158', // premium accent
        signal: '#FF5A5F', // alert / overdue

        // Legacy tokens — still referenced; left in place
        ink: '#0E1726',
        verified: '#19E68C',
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
        card: '0 1px 0 0 rgb(255 255 255 / 0.04) inset, 0 8px 24px -8px rgb(0 0 0 / 0.5)',
      },
    },
  },
  plugins: [],
}

export default config
