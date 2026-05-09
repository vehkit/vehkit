'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { adminLogout } from '../_actions/auth'

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/vehicles', label: 'Vehicles' },
  { href: '/admin/workshops', label: 'Workshops' },
  { href: '/admin/services', label: 'Service records' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/agents', label: 'Agents' },
  { href: '/admin/agent-grants', label: 'Agent grants' },
  { href: '/admin/documents', label: 'Documents' },
  { href: '/admin/cron', label: 'Cron + jobs' },
  { href: '/admin/diagnostics', label: 'Diagnostics' },
] as const

export function AdminSidebar() {
  const pathname = usePathname() ?? ''

  return (
    <aside className="md:w-56 md:min-h-[100svh] md:flex md:flex-col border-b md:border-b-0 md:border-r border-seam bg-carbon">
      <div className="px-5 py-5 border-b border-seam">
        <p className="text-xs tracking-[0.25em] uppercase text-ash">Vehkit</p>
        <p className="text-base font-semibold text-chalk mt-0.5">Admin</p>
      </div>

      <nav className="flex md:flex-col gap-1 px-3 py-3 overflow-x-auto md:overflow-x-visible flex-1">
        {NAV.map((item) => {
          const active =
            item.href === '/admin'
              ? pathname === '/admin'
              : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm px-3 py-2 rounded-DEFAULT transition-colors whitespace-nowrap ${
                active ? 'bg-iron text-chalk' : 'text-ash hover:text-chalk'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-3 pb-4 mt-auto">
        <form action={adminLogout}>
          <button
            type="submit"
            className="w-full text-left text-xs tracking-widest uppercase text-ash hover:text-signal transition-colors px-3 py-2"
          >
            Sign out
          </button>
        </form>
      </div>
    </aside>
  )
}
