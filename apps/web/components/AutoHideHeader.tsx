'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Auto-hiding sticky header.
 *
 * - Visible at the top of the page (scrollY < 80).
 * - Slides up out of view when the user scrolls DOWN past 80px.
 * - Slides back in immediately when the user scrolls UP.
 *
 * Inspired by Linear, Kendal.ai, Vercel marketing — gives more reading
 * room mid-scroll without forcing the user to scroll all the way to the
 * top to reach the nav.
 */
export function AutoHideHeader({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false)
  const lastY = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY

    function onScroll() {
      const y = window.scrollY
      const diff = y - lastY.current

      if (y < 80) {
        setHidden(false)
      } else if (diff > 6) {
        setHidden(true)
      } else if (diff < -6) {
        setHidden(false)
      }

      lastY.current = y
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`sticky top-0 z-50 backdrop-blur bg-paper/80 border-b border-seam will-change-transform transition-transform duration-300 ease-out ${
        hidden ? '-translate-y-full' : 'translate-y-0'
      }`}
    >
      {children}
    </header>
  )
}
