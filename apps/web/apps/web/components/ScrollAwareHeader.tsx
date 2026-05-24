'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

/**
 * Sticky condensed header that appears once the user has scrolled past the
 * hero photo. Backdrop-blurred so it sits cleanly over the content sheet.
 */
export function ScrollAwareHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  threshold = 320,
}: {
  title: string
  subtitle?: string
  backHref: string
  backLabel: string
  threshold?: number
}) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let raf = 0
    function onScroll() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        setShow(window.scrollY > threshold)
      })
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [threshold])

  return (
    <header
      className={`fixed top-0 inset-x-0 z-30 bg-noir/85 backdrop-blur-md border-b border-seam transition-opacity duration-200 ${
        show ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
    >
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
        <Link
          href={backHref}
          aria-label={backLabel}
          title={backLabel}
          className="w-9 h-9 inline-flex items-center justify-center rounded-pill bg-iron/60 text-chalk hover:bg-iron transition-colors shrink-0"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <div className="flex-1 min-w-0 text-center">
          <p className="text-sm font-semibold text-chalk truncate tracking-tight">
            {title}
          </p>
          {subtitle && (
            <p className="text-[10px] text-ash/80 truncate -mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="w-9 shrink-0" />
      </div>
    </header>
  )
}
