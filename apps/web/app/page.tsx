import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type DirectoryRow = {
  id: string
  name: string
  slug: string
  emirate: string | null
  verification_tier: string
  total_entries: number
  avg_rating: number
  review_count: number
}

export default async function Home() {
  const supabase = await createClient()

  const [{ data: { user } }, { data: directoryRaw }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('public_workshop_directory', { p_limit: 4, p_offset: 0 }),
  ])

  const featured = ((directoryRaw as DirectoryRow[]) ?? []).filter(
    (w) => w.verification_tier === 'gold' || w.verification_tier === 'silver'
  )

  return (
    <main className="min-h-[100svh] flex flex-col">
      {/* Header — minimal */}
      <header className="px-6 md:px-10 pt-6 md:pt-8">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tightest text-chalk"
          >
            vehkit
          </Link>
          <nav className="flex items-center gap-1">
            <Link
              href="/workshops"
              className="hidden sm:block text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors px-3 py-1.5"
            >
              Directory
            </Link>
            {user ? (
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

      {/* Hero — the whole pitch in one screen */}
      <section className="flex-1 flex items-center px-6 md:px-10 py-16 md:py-24">
        <div className="max-w-6xl mx-auto w-full grid md:grid-cols-2 gap-12 md:gap-16 items-center">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
              Verified vehicle records
            </p>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
              Every car<br />
              deserves<br />
              a passport.
            </h1>
            <p className="text-base md:text-lg text-ash mt-8 leading-relaxed max-w-md">
              An owner-controlled service record, attested by verified workshops,
              immutable after twenty-four hours. Built for resale. Built for the UAE.
            </p>
            <div className="mt-12 flex items-center gap-6">
              {user ? (
                <Link href="/mycars" className="pill-primary inline-flex items-center">
                  Open my cars
                </Link>
              ) : (
                <Link href="/login" className="pill-primary inline-flex items-center">
                  Start your first car
                </Link>
              )}
              <Link
                href="/workshops"
                className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                Browse workshops →
              </Link>
            </div>
          </div>

          {/* Visual — sample passport card */}
          <div className="md:flex md:justify-end">
            <SamplePassport />
          </div>
        </div>
      </section>

      {/* Featured workshops — only Gold/Silver, only when they exist */}
      {featured.length > 0 && (
        <section className="px-6 md:px-10 pb-16 md:pb-20 border-t border-seam pt-12 md:pt-16">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4 mb-8 flex-wrap">
              <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
                Verified workshops on Vehkit
              </p>
              <Link
                href="/workshops"
                className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                Full directory →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-seam rounded-DEFAULT overflow-hidden">
              {featured.slice(0, 4).map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.slug}`}
                  className="bg-noir px-5 py-6 hover:bg-carbon transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {w.verification_tier === 'gold' && (
                      <span className="text-[9px] tracking-widest uppercase text-wallet font-medium">
                        ✓ Gold
                      </span>
                    )}
                    {w.verification_tier === 'silver' && (
                      <span className="text-[9px] tracking-widest uppercase text-volt font-medium">
                        ✓ Silver
                      </span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-chalk group-hover:text-volt transition-colors leading-tight">
                    {w.name}
                  </p>
                  <p className="text-xs text-ash mt-1">{w.emirate ?? 'UAE'}</p>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-chalk tabular-nums tracking-tighter">
                      {w.total_entries}
                    </span>
                    <span className="text-[10px] text-ash tracking-widest uppercase">
                      entries
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer — minimal, no marketing */}
      <footer className="px-6 md:px-10 py-8 border-t border-seam">
        <div className="max-w-6xl mx-auto flex items-center justify-between flex-wrap gap-4">
          <p className="text-[10px] tracking-widest uppercase text-ash/60">
            © {new Date().getFullYear()} Vehkit · Made in Dubai
          </p>
          <div className="flex items-center gap-5 text-[10px] tracking-widest uppercase text-ash/60">
            <Link href="/workshop/start" className="hover:text-chalk transition-colors">
              For workshops
            </Link>
            <Link href="/privacy" className="hover:text-chalk transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-chalk transition-colors">
              Terms
            </Link>
            <a
              href="mailto:hello@vehkit.com"
              className="hover:text-chalk transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </footer>
    </main>
  )
}

/**
 * Hero visual — a clean composition mimicking a real passport card.
 * No screenshot, no skeuomorphism — just typography on a card.
 */
function SamplePassport() {
  return (
    <div className="card p-6 md:p-7 max-w-sm w-full">
      {/* Card top — workshop attestation */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b border-seam">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-pill bg-volt/15 text-volt flex items-center justify-center font-mono text-[11px] font-semibold">
            AS
          </div>
          <div>
            <p className="text-xs font-semibold text-chalk leading-tight">
              ASM German Auto Garage
            </p>
            <p className="text-[10px] text-ash leading-tight">Dubai · Gold</p>
          </div>
        </div>
        <span className="text-[9px] tracking-widest uppercase text-volt">
          ✓ Verified
        </span>
      </div>

      {/* Service entry */}
      <div className="py-5 border-b border-seam">
        <p className="text-[10px] tracking-widest uppercase text-ash">
          Latest entry
        </p>
        <p className="text-base font-semibold text-chalk mt-1">Major service</p>
        <div className="flex items-baseline gap-3 mt-2 text-xs text-ash">
          <span className="font-mono">38,500 km</span>
          <span className="text-seam">·</span>
          <span className="font-mono">AED 2,840</span>
          <span className="text-seam">·</span>
          <span>9 May</span>
        </div>
      </div>

      {/* Score */}
      <div className="pt-5">
        <div className="flex items-end justify-between mb-3">
          <p className="text-[10px] tracking-widest uppercase text-ash">
            Vehkit score
          </p>
          <p className="font-mono text-3xl font-semibold text-volt tabular-nums tracking-tighter leading-none">
            87
            <span className="text-ash text-xs font-normal ml-1">/100</span>
          </p>
        </div>
        {/* Component bars — sparse */}
        <div className="space-y-1.5">
          <ScoreSparkBar label="Verification" filled={36} max={40} />
          <ScoreSparkBar label="Compliance" filled={28} max={30} />
          <ScoreSparkBar label="Consistency" filled={16} max={20} />
          <ScoreSparkBar label="Recency" filled={7} max={10} />
        </div>
      </div>
    </div>
  )
}

function ScoreSparkBar({
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
