'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = {
  href: string
  label: string
  shortLabel?: string
  icon: 'home' | 'users' | 'plus' | 'star' | 'gear'
}

const TABS: Tab[] = [
  { href: '/workshop', label: 'Dashboard', shortLabel: 'Home', icon: 'home' },
  { href: '/workshop/customers', label: 'Customers', icon: 'users' },
  { href: '/workshop/log', label: 'New entry', shortLabel: 'New', icon: 'plus' },
  { href: '/workshop/reviews', label: 'Reviews', icon: 'star' },
  { href: '/workshop/settings', label: 'Settings', shortLabel: 'Settings', icon: 'gear' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/workshop') return pathname === '/workshop'
  if (href === '/workshop/log') {
    return pathname === '/workshop/log' || pathname.startsWith('/shop')
  }
  return pathname.startsWith(href)
}

function Icon({ name, active }: { name: Tab['icon']; active: boolean }) {
  const stroke = active ? 'currentColor' : 'currentColor'
  const opacity = active ? 1 : 0.7
  const common = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke,
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    style: { opacity },
    'aria-hidden': true,
  }
  if (name === 'home')
    return (
      <svg {...common}>
        <path d="M3 12L12 4l9 8" />
        <path d="M5 10v10h14V10" />
      </svg>
    )
  if (name === 'users')
    return (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 00-3-3.87" />
        <path d="M16 3.13a4 4 0 010 7.75" />
      </svg>
    )
  if (name === 'plus')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
      </svg>
    )
  if (name === 'star')
    return (
      <svg {...common}>
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    )
  // gear
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

export function WorkshopNav({
  workshopName,
  pendingCount,
  upcomingOverdue,
}: {
  workshopName: string
  pendingCount: number
  upcomingOverdue: number
}) {
  const pathname = usePathname() ?? ''

  return (
    <>
      {/* Desktop top nav */}
      <header className="hidden md:block sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/workshop"
            className="flex items-center gap-2 hover:text-volt transition-colors"
          >
            <span className="text-sm font-semibold tracking-tightest text-chalk">vehkit</span>
            <span className="text-[10px] tracking-[0.25em] uppercase text-volt border border-volt/40 px-1.5 py-0.5 rounded-pill">
              Workshop
            </span>
          </Link>

          <nav className="flex items-center gap-1">
            {TABS.map((t) => {
              const active = isActive(pathname, t.href)
              const badge =
                t.href === '/workshop' && pendingCount > 0
                  ? pendingCount
                  : t.href === '/workshop/customers' && upcomingOverdue > 0
                    ? upcomingOverdue
                    : 0
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative inline-flex items-center gap-2 px-3 py-2 rounded-pill text-sm transition-colors ${
                    active ? 'bg-iron text-chalk' : 'text-ash hover:text-chalk'
                  }`}
                >
                  <Icon name={t.icon} active={active} />
                  <span>{t.label}</span>
                  {badge > 0 && (
                    <span className="bg-signal text-noir text-[10px] font-semibold tracking-wide px-1.5 py-0 rounded-pill min-w-[18px] inline-flex items-center justify-center">
                      {badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="text-right max-w-[180px] truncate">
            <p className="text-[10px] tracking-widest uppercase text-ash">Workshop</p>
            <p className="text-xs text-chalk truncate">{workshopName}</p>
          </div>
        </div>
      </header>

      {/* Mobile top brand strip */}
      <header className="md:hidden sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="px-5 h-14 flex items-center justify-between">
          <Link href="/workshop" className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tightest text-chalk">vehkit</span>
            <span className="text-[9px] tracking-[0.25em] uppercase text-volt border border-volt/40 px-1.5 py-0.5 rounded-pill">
              Workshop
            </span>
          </Link>
          <p className="text-xs text-ash truncate max-w-[140px]">{workshopName}</p>
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-noir/95 backdrop-blur border-t border-seam">
        <div className="flex items-stretch h-16">
          {TABS.map((t) => {
            const active = isActive(pathname, t.href)
            const badge =
              t.href === '/workshop' && pendingCount > 0
                ? pendingCount
                : t.href === '/workshop/customers' && upcomingOverdue > 0
                  ? upcomingOverdue
                  : 0
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors relative ${
                  active ? 'text-chalk' : 'text-ash'
                }`}
              >
                <div className="relative">
                  <Icon name={t.icon} active={active} />
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-2 bg-signal text-noir text-[9px] font-semibold rounded-pill min-w-[16px] h-4 inline-flex items-center justify-center px-1">
                      {badge}
                    </span>
                  )}
                </div>
                <span className="text-[10px] tracking-wide">
                  {t.shortLabel ?? t.label}
                </span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
