'use client'

import { useEffect, useState } from 'react'

/**
 * Sticky in-page anchor nav with scroll-spy.
 *
 * Research-backed choice: one long page + sticky section anchors beats
 * real tabs (hidden panels get overlooked; Baymard). The bar highlights
 * the section currently in view and stays reachable while scrolling.
 *
 * Sits below the mobile ScrollAwareHeader (h-14) and at the top on
 * desktop. Sections need `scroll-mt-*` to land below the bar.
 */
export function VehicleSectionNav({
  sections,
}: {
  sections: Array<{ id: string; label: string }>
}) {
  const [active, setActive] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) => a.boundingClientRect.top - b.boundingClientRect.top,
          )[0]
        if (visible) setActive(visible.target.id)
      },
      // Active = section occupying the upper-middle band of the viewport.
      { rootMargin: '-15% 0px -65% 0px' },
    )
    for (const s of sections) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
    // Serialize so a structurally-equal array doesn't re-run the effect.
  }, [JSON.stringify(sections)]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <nav
      aria-label="Page sections"
      className="sticky top-14 md:top-0 z-20 -mx-5 px-5 md:-mx-2 md:px-2 bg-noir/85 backdrop-blur-md border-b border-seam/60"
    >
      <div className="flex items-center gap-1.5 py-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sections.map((s) => {
          const isActive = active === s.id
          return (
            <a
              key={s.id}
              href={`#${s.id}`}
              aria-current={isActive ? 'true' : undefined}
              className={`shrink-0 rounded-pill px-3.5 py-1.5 text-xs font-medium tracking-wide transition-colors ${
                isActive
                  ? 'bg-chalk text-noir'
                  : 'text-ash hover:text-chalk hover:bg-iron/60'
              }`}
            >
              {s.label}
            </a>
          )
        })}
      </div>
    </nav>
  )
}
