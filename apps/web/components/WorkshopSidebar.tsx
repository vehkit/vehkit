'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

type Tab = {
  href: string
  label: string
  badgeKind?: 'pending' | 'overdue'
}

const NAV: Tab[] = [
  { href: '/workshop', label: 'Dashboard', badgeKind: 'pending' },
  { href: '/workshop/customers', label: 'Customers', badgeKind: 'overdue' },
  { href: '/workshop/log', label: 'New entry' },
  { href: '/workshop/reviews', label: 'Reviews' },
  { href: '/workshop/settings', label: 'Settings' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/workshop') return pathname === '/workshop'
  if (href === '/workshop/log') {
    return pathname === '/workshop/log' || pathname.startsWith('/shop')
  }
  return pathname.startsWith(href)
}

export function WorkshopSidebar({
  workshopName,
  tier,
  pendingCount,
  upcomingOverdue,
}: {
  workshopName: string
  tier: 'gold' | 'silver' | 'unverified' | string
  pendingCount: number
  upcomingOverdue: number
}) {
  const pathname = usePathname() ?? ''

  const tierLabel =
    tier === 'gold' ? 'Gold' : tier === 'silver' ? 'Silver' : 'Unverified'
  const tierTone =
    tier === 'gold'
      ? 'text-wallet'
      : tier === 'silver'
        ? 'text-volt'
        : 'text-ash'

  return (
    <aside className="md:w-60 md:min-h-[100svh] md:flex md:flex-col border-b md:border-b-0 md:border-r border-seam bg-carbon">
      {/* Brand block */}
      <div className="px-5 py-5 border-b border-seam">
        <div className="flex items-center gap-2">
          <p className="text-xs tracking-[0.25em] uppercase text-ash">Vehkit</p>
          <span className="text-[9px] tracking-[0.25em] uppercase text-volt border border-volt/40 px-1.5 py-0.5 rounded-pill">
            Workshop
          </span>
        </div>
        <p className="text-base font-semibold text-chalk mt-1.5 truncate" title={workshopName}>
          {workshopName}
        </p>
        <p className={`text-[10px] tracking-widest uppercase mt-1 ${tierTone}`}>
          {tierLabel}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex md:flex-col gap-1 px-3 py-3 overflow-x-auto md:overflow-x-visible flex-1">
        {NAV.map((item) => {
          const active = isActive(pathname, item.href)
          const badge =
            item.badgeKind === 'pending' && pendingCount > 0
              ? pendingCount
              : item.badgeKind === 'overdue' && upcomingOverdue > 0
                ? upcomingOverdue
                : 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center justify-between gap-2 text-sm px-3 py-2 rounded-DEFAULT transition-colors whitespace-nowrap ${
                active ? 'bg-iron text-chalk' : 'text-ash hover:text-chalk'
              }`}
            >
              <span>{item.label}</span>
              {badge > 0 && (
                <span
                  className={`text-[10px] font-semibold tracking-wide px-1.5 rounded-pill min-w-[18px] inline-flex items-center justify-center ${
                    item.badgeKind === 'overdue'
                      ? 'bg-signal text-noir'
                      : 'bg-wallet text-noir'
                  }`}
                >
                  {badge}
                </span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="px-3 pb-4 mt-auto md:block hidden">
        <Link
          href="/"
          className="block text-[10px] tracking-widest uppercase text-ash hover:text-chalk transition-colors px-3 py-2"
        >
          ← Back to vehkit
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="w-full text-left text-[10px] tracking-widest uppercase text-ash hover:text-signal transition-colors px-3 py-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
