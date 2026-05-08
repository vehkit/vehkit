'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AvatarDisplay } from './AvatarUpload'
import { getInitials } from '@/lib/initials'

type Tab = {
  href: '/garage' | '/notifications' | '/workshops' | '/profile'
  label: string
  icon: 'garage' | 'bell' | 'search' | 'user'
}

const TABS: Tab[] = [
  { href: '/garage', label: 'Garage', icon: 'garage' },
  { href: '/notifications', label: 'Inbox', icon: 'bell' },
  { href: '/workshops', label: 'Discover', icon: 'search' },
  { href: '/profile', label: 'You', icon: 'user' },
]

function isPathActive(pathname: string, href: string): boolean {
  if (href === '/garage') {
    return pathname.startsWith('/garage') || pathname.startsWith('/vehicles')
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

  return (
    <>
      {/* Desktop top nav */}
      <header className="hidden md:block sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/garage"
            className="text-sm font-semibold tracking-tightest text-chalk hover:text-volt transition-colors"
          >
            vehkit
          </Link>
          <nav className="flex items-center gap-1">
            {TABS.slice(0, 3).map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`relative text-sm px-3 py-1.5 rounded-pill transition-colors ${
                  isPathActive(pathname, t.href)
                    ? 'text-chalk bg-iron'
                    : 'text-ash hover:text-chalk'
                }`}
              >
                {t.label}
                {t.href === '/notifications' && notificationCount > 0 && (
                  <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-signal text-noir text-[10px] font-mono font-bold rounded-pill align-middle">
                    {notificationCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <Link
            href="/profile"
            aria-label="Profile"
            className={`block rounded-pill ${
              isPathActive(pathname, '/profile') ? 'ring-2 ring-volt ring-offset-2 ring-offset-noir' : ''
            }`}
          >
            <AvatarDisplay url={avatarUrl} initials={initials} size="sm" />
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
                  active ? 'text-volt' : 'text-ash'
                }`}
              >
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
}: {
  name: 'garage' | 'bell' | 'search' | 'user'
  avatarUrl: string | null
  initials: string
  active: boolean
}) {
  if (name === 'user') {
    return (
      <span
        className={`block rounded-pill ${active ? 'ring-2 ring-volt ring-offset-1 ring-offset-noir' : ''}`}
      >
        <AvatarDisplay url={avatarUrl} initials={initials} size="sm" />
      </span>
    )
  }

  const paths: Record<typeof name, string> = {
    garage:
      'M3 12l9-9 9 9v9a2 2 0 01-2 2h-4v-7H9v7H5a2 2 0 01-2-2v-9z',
    bell:
      'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
    search: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    user: '',
  }

  return (
    <svg
      width="22"
      height="22"
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
