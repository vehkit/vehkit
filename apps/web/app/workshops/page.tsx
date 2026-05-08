import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { StarRating } from '@/components/StarRating'
import { EMIRATES } from '@vehkit/types'

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

export const dynamic = 'force-dynamic'

export default async function WorkshopDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ emirate?: string }>
}) {
  const sp = await searchParams
  const emirate = sp.emirate ?? null

  const supabase = await createClient()
  const { data: rows } = await supabase.rpc('public_workshop_directory', {
    p_emirate: emirate,
    p_limit: 100,
    p_offset: 0,
  })

  const workshops = (rows ?? []) as DirectoryRow[]

  return (
    <main className="min-h-[100svh] pb-24">
      <header className="px-6 pt-10 pb-6">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>
        <p className="nav-pill mt-3">Workshop directory</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
          Find a verified workshop
        </h1>
        <p className="text-ash mt-2 text-sm">
          Workshops on Vehkit who've logged verified service entries. Sorted by tier.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-6">
        {/* Emirate filter */}
        <form className="mb-6 flex gap-2 flex-wrap">
          <FilterPill href="/workshops" label="All" active={emirate === null} />
          {EMIRATES.map((e) => (
            <FilterPill
              key={e}
              href={`/workshops?emirate=${encodeURIComponent(e)}`}
              label={e}
              active={emirate === e}
            />
          ))}
        </form>

        {workshops.length > 0 ? (
          <div className="space-y-3">
            {workshops.map((w) => (
              <Link
                key={w.id}
                href={`/w/${w.slug}`}
                className="card block p-5 hover:border-volt/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-lg font-semibold text-chalk truncate">{w.name}</h2>
                      <TierBadge tier={w.verification_tier} />
                    </div>
                    {w.emirate && (
                      <p className="text-sm text-ash mt-0.5">{w.emirate}</p>
                    )}
                    {w.review_count > 0 && (
                      <div className="flex items-center gap-2 mt-2">
                        <StarRating rating={w.avg_rating} size="sm" />
                        <span className="text-xs text-ash">
                          {w.avg_rating.toFixed(1)} · {w.review_count}{' '}
                          {w.review_count === 1 ? 'review' : 'reviews'}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-2xl font-semibold text-chalk tabular-nums">
                      {w.total_entries.toLocaleString()}
                    </p>
                    <p className="text-[10px] tracking-widest uppercase text-ash mt-0.5">
                      entries
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center">
            <p className="text-chalk font-medium">No workshops yet.</p>
            <p className="text-sm text-ash mt-2 leading-relaxed">
              The directory is just starting up. Run a workshop?{' '}
              <Link href="/workshop/start" className="text-volt underline">
                Sign up free
              </Link>
              .
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active: boolean
}) {
  return (
    <Link
      href={href}
      className={`text-xs tracking-widest uppercase px-3 py-1.5 rounded-pill transition-colors ${
        active
          ? 'bg-volt text-noir font-medium'
          : 'bg-iron text-ash hover:text-chalk hover:bg-iron/70'
      }`}
    >
      {label}
    </Link>
  )
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === 'gold') {
    return (
      <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium">
        ★ Gold
      </span>
    )
  }
  if (tier === 'silver') {
    return (
      <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium">
        ✓ Silver
      </span>
    )
  }
  return null
}
