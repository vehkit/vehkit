'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AvatarDisplay } from './AvatarUpload'
import { getInitials } from '@/lib/initials'

type Tab = {
  href: '/mycars' | '/notifications' | '/workshops' | '/profile'
  label: string
  icon: 'garage' | 'bell' | 'search' | 'user'
}

const TABS: Tab[] = [
  { href: '/mycars', label: 'My Cars', icon: 'garage' },
  { href: '/notifications', label: 'Inbox', icon: 'bell' },
  { href: '/workshops', label: 'Workshops', icon: 'search' },
  { href: '/profile', label: 'You', icon: 'user' },
]

function isPathActive(pathname: string, href: string): boolean {
  if (href === '/mycars') {
    return (
      pathname.startsWith('/mycars') ||
      pathname.startsWith('/garage') ||
      pathname.startsWith('/vehicles')
    )
  }
  if (href === '/notifications') {
    return pathname.startsWith('/notifications') || pathname.startsWith('/reminders')
  }
  if (href === '/workshops') {
    return (
      pathname.startsWith('/workshops') ||
      pathname.startsWith('/w/') ||
      pathname.startsWith('/workshop')
    )
  }
  if (href === '/profile') {
    return pathname.startsWith('/profile') || pathname.startsWith('/fleet')
  }
  return pathname.startsWith(href)
}

export function AppNavClient({
  avatarUrl,
  fullName,
  email,
  notificationCount,
}: {
  avatarUrl: string | null
  fullName: string | null
  email: string
  notificationCount: number
}) {
  const pathname = usePathname() ?? ''
  const initials = getInitials(fullName, email)

  // Workshop portal has its own nav. Hide consumer nav on /workshop/* routes.
  // Note: /workshops (plural) is the consumer-facing public directory and KEEPS this nav.
  if (pathname === '/workshop' || pathname.startsWith('/workshop/')) {
    return null
  }
  // Agent portal — own nav. /agent/* covers dashboard, settings, grant
  // detail, and the redemption form at /agent/redeem.
  // /a (legacy redirect to /agent/redeem) and /a/[token] (family invite —
  // consumer flow) are NOT excluded here.
  if (pathname === '/agent' || pathname.startsWith('/agent/')) {
    return null
  }
  // Admin portal also has its own nav.
  if (pathname.startsWith('/admin')) {
    return null
  }
  // Marketing pages have their own header.
  if (
    pathname === '/' ||
    pathname === '/score' ||
    pathname === '/buyers' ||
    pathname === '/workshop/start'
  ) {
    return null
  }
  // Public anonymous flows (shop redemption, share/passport, invite accept) have
  // their own minimal chrome and don't need the consumer tabs.
  if (
    pathname === '/shop' ||
    pathname.startsWith('/shop/') ||
    pathname.startsWith('/r/') ||
    pathname.startsWith('/a/') ||
    pathname.startsWith('/f/') ||
    pathname === '/privacy' ||
    pathname === '/terms'
  ) {
    return null
  }

  return (
    <>
      {/* Desktop top nav */}
      <header className="hidden md:block sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link
            href="/mycars"
            className="text-sm font-semibold tracking-tightest text-chalk hover:text-volt transition-colors"
          >
            vehkit
          </Link>
          <nav className="flex items-center gap-1 h-full">
            {TABS.slice(0, 3).map((t) => {
              const active = isPathActive(pathname, t.href)
              return (
                <Link
                  key={t.href}
                  href={t.href}
                  className={`relative text-sm px-4 h-full inline-flex items-center gap-2 transition-colors ${
                    active
                      ? 'text-chalk after:content-[""] after:absolute after:left-3 after:right-3 after:bottom-0 after:h-[2px] after:bg-volt after:rounded-full'
                      : 'text-ash hover:text-chalk'
                  }`}
                >
                  <NavIcon
                    name={t.icon}
                    avatarUrl={null}
                    initials=""
                    active={active}
                    size={16}
                  />
                  {t.label}
                  {t.href === '/notifications' && notificationCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-signal text-noir text-[10px] font-mono font-bold rounded-pill">
                      {notificationCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
          <Link
            href="/profile"
            aria-label="Profile"
            className={`block rounded-pill transition-shadow ${
              isPathActive(pathname, '/profile')
                ? 'ring-2 ring-volt ring-offset-1 ring-offset-noir'
                : 'hover:ring-1 hover:ring-seam hover:ring-offset-1 hover:ring-offset-noir'
            }`}
          >
            <AvatarDisplay url={avatarUrl} initials={initials} size="md" />
          </Link>
        </div>
      </header>

      {/* Mobile bottom tabs */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-noir/95 backdrop-blur border-t border-seam">
        <div className="grid grid-cols-4 h-16 max-w-md mx-auto">
          {TABS.map((t) => {
            const active = isPathActive(pathname, t.href)
            const showBadge = t.href === '/notifications' && notificationCount > 0
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`flex flex-col items-center justify-center gap-1 transition-colors relative ${
                  active ? 'text-chalk' : 'text-ash'
                }`}
              >
                {/* Top indicator strip — PF/Instagram active rhythm */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-volt rounded-full"
                  />
                )}
                <NavIcon
                  name={t.icon}
                  avatarUrl={avatarUrl}
                  initials={initials}
                  active={active}
                />
                <span className="text-[10px] tracking-widest uppercase">{t.label}</span>
                {showBadge && (
                  <span className="absolute top-2 right-1/4 min-w-[16px] h-[16px] px-1 flex items-center justify-center bg-signal text-noir text-[9px] font-mono font-bold rounded-pill">
                    {notificationCount}
                  </span>
                )}
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}

function NavIcon({
  name,
  avatarUrl,
  initials,
  active,
  size = 22,
}: {
  name: 'garage' | 'bell' | 'search' | 'user'
  avatarUrl: string | null
  initials: string
  active: boolean
  size?: number
}) {
  if (name === 'user') {
    return (
      <span
        className={`block rounded-pill ${active ? 'ring-2 ring-volt ring-offset-1 ring-offset-noir' : ''}`}
      >
        <AvatarDisplay url={avatarUrl} initials={initials} size="md" />
      </span>
    )
  }

  const paths: Record<'garage' | 'bell' | 'search', string> = {
    garage: 'M3 12l9-9 9 9v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2v-9z',
    bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  )
}
