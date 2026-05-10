import Link from 'next/link'
import { VehkitLockup } from './VehkitMark'

const NAV = [
  { href: '/score', label: 'Score' },
  { href: '/workshop/start', label: 'For workshops' },
  { href: '/buyers', label: 'For buyers' },
  { href: '/workshops', label: 'Directory' },
] as const

export function MarketingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="px-6 md:px-10 pt-6 md:pt-8">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <Link
          href="/"
          className="hover:opacity-80 transition-opacity"
          aria-label="Vehkit home"
        >
          <VehkitLockup height={24} />
        </Link>
        <nav className="flex items-center gap-1 md:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="hidden md:inline-block text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors px-2.5 py-1.5"
            >
              {item.label}
            </Link>
          ))}
          {signedIn ? (
            <Link
              href="/mycars"
              className="text-xs tracking-widest uppercase text-chalk hover:text-volt transition-colors px-3 py-1.5"
            >
              My cars →
            </Link>
          ) : (
            <Link
              href="/login"
              className="text-xs tracking-widest uppercase text-chalk hover:text-volt transition-colors px-3 py-1.5"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  )
}

export function MarketingFooter() {
  return (
    <footer className="px-6 md:px-10 py-10 border-t border-seam mt-20">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <p className="text-sm font-semibold text-chalk">vehkit</p>
            <p className="text-[11px] text-ash mt-2 leading-relaxed max-w-[200px]">
              Verified vehicle records.
              <br />
              Built for the UAE.
            </p>
          </div>
          <FooterCol
            title="Owners"
            links={[
              { href: '/login', label: 'Sign in / Sign up' },
              { href: '/mycars', label: 'My cars' },
              { href: '/score', label: 'The score' },
            ]}
          />
          <FooterCol
            title="Workshops"
            links={[
              { href: '/workshop/start', label: 'Why Vehkit' },
              { href: '/workshop/claim', label: 'Claim a workshop' },
              { href: '/workshops', label: 'Directory' },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: '/buyers', label: 'For buyers' },
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
              { href: 'mailto:hello@vehkit.com', label: 'Contact' },
            ]}
          />
        </div>
        <div className="pt-6 border-t border-seam flex items-center justify-between flex-wrap gap-3">
          <p className="text-[10px] tracking-widest uppercase text-ash/60">
            © {new Date().getFullYear()} Vehkit · Made in Dubai
          </p>
          <p className="text-[10px] tracking-widest uppercase text-ash/60">
            Every car deserves a passport.
          </p>
        </div>
      </div>
    </footer>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-ash/70 mb-3">
        {title}
      </p>
      <ul className="space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-chalk hover:text-volt transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * Editorial-style sample passport — used in hero + /score + /buyers.
 * Pure typography composition; no images.
 */
export function SamplePassport({
  workshop = 'ASM German Auto Garage',
  workshopMeta = 'Dubai · Gold',
  service = 'Major service',
  km = '38,500',
  cost = 'AED 2,840',
  date = '9 May',
  score = 87,
}: {
  workshop?: string
  workshopMeta?: string
  service?: string
  km?: string
  cost?: string
  date?: string
  score?: number
}) {
  return (
    <div className="card p-6 md:p-7 max-w-sm w-full">
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-seam">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-pill bg-volt/15 text-volt flex items-center justify-center font-mono text-[11px] font-semibold">
            {workshop
              .split(' ')
              .filter(Boolean)
              .slice(0, 2)
              .map((s) => s.charAt(0).toUpperCase())
              .join('')}
          </div>
          <div>
            <p className="text-xs font-semibold text-chalk leading-tight">
              {workshop}
            </p>
            <p className="text-[10px] text-ash leading-tight">{workshopMeta}</p>
          </div>
        </div>
        <span className="text-[9px] tracking-widest uppercase text-volt">
          ✓ Verified
        </span>
      </div>

      <div className="py-5 border-b border-seam">
        <p className="text-[10px] tracking-widest uppercase text-ash">
          Latest entry
        </p>
        <p className="text-base font-semibold text-chalk mt-1">{service}</p>
        <div className="flex items-baseline gap-3 mt-2 text-xs text-ash">
          <span className="font-mono">{km} km</span>
          <span className="text-seam">·</span>
          <span className="font-mono">{cost}</span>
          <span className="text-seam">·</span>
          <span>{date}</span>
        </div>
      </div>

      <div className="pt-5">
        <div className="flex items-end justify-between mb-3">
          <p className="text-[10px] tracking-widest uppercase text-ash">
            Vehkit score
          </p>
          <p className="font-mono text-3xl font-semibold text-volt tabular-nums tracking-tighter leading-none">
            {score}
            <span className="text-ash text-xs font-normal ml-1">/100</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <SparkBar label="Verification" filled={36} max={40} />
          <SparkBar label="Compliance" filled={28} max={30} />
          <SparkBar label="Consistency" filled={16} max={20} />
          <SparkBar label="Recency" filled={7} max={10} />
        </div>
      </div>
    </div>
  )
}

function SparkBar({
  label,
  filled,
  max,
}: {
  label: string
  filled: number
  max: number
}) {
  const pct = Math.min(100, (filled / max) * 100)
  return (
    <div className="flex items-center gap-3">
      <span className="text-[10px] text-ash tracking-wide w-20 shrink-0">
        {label}
      </span>
      <div className="h-0.5 bg-iron rounded-full flex-1 overflow-hidden">
        <div className="h-full bg-volt" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
