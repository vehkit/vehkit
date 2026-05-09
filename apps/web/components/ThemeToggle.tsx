'use client'

import { useEffect, useState, useTransition } from 'react'
import { setTheme } from '@/app/actions/theme'

type Theme = 'light' | 'dark'

export function ThemeToggle({ initialTheme }: { initialTheme: Theme }) {
  const [theme, setLocalTheme] = useState<Theme>(initialTheme)
  const [, startTransition] = useTransition()

  // Keep state in sync if another tab changes it
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === 'vehkit-theme' && (e.newValue === 'light' || e.newValue === 'dark')) {
        setLocalTheme(e.newValue)
        applyClass(e.newValue)
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  function applyClass(next: Theme) {
    const html = document.documentElement
    html.classList.remove('light', 'dark')
    html.classList.add(next)
  }

  function choose(next: Theme) {
    if (next === theme) return
    setLocalTheme(next)
    applyClass(next)
    try {
      localStorage.setItem('vehkit-theme', next)
    } catch {}
    startTransition(async () => {
      await setTheme(next)
    })
  }

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className="inline-flex items-center bg-iron border border-seam rounded-pill p-0.5"
    >
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'light'}
        onClick={() => choose('light')}
        className={`px-3 py-1.5 rounded-pill text-xs tracking-widest uppercase font-medium transition-colors ${
          theme === 'light'
            ? 'bg-carbon text-chalk shadow-card'
            : 'text-ash hover:text-chalk'
        }`}
      >
        Light
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={theme === 'dark'}
        onClick={() => choose('dark')}
        className={`px-3 py-1.5 rounded-pill text-xs tracking-widest uppercase font-medium transition-colors ${
          theme === 'dark'
            ? 'bg-carbon text-chalk shadow-card'
            : 'text-ash hover:text-chalk'
        }`}
      >
        Dark
      </button>
    </div>
  )
}
