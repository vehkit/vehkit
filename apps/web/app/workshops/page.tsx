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
  logo_url: string | null
  hero_image_url: string | null
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

  // Garage-wide stats for the editorial header
  const totalWorkshops = workshops.length
  const goldCount = workshops.filter(
    (w) => w.verification_tier === 'gold',
  ).length
  const silverCount = workshops.filter(
    (w) => w.verification_tier === 'silver',
  ).length
  const totalEntries = workshops.reduce(
    (s, w) => s + Number(w.total_entries ?? 0),
    0,
  )

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 pt-6 md:pt-8">
        <Link
          href="/"
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← vehkit
        </Link>

        {/* Editorial header */}
        <p className="nav-pill mt-3">vehkit · directory</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight">
              Find a verified workshop
            </h1>
            <p className="text-sm text-ash mt-2 leading-relaxed max-w-md">
              Workshops on Vehkit who've logged verified service entries. Gold
              tier first, then Silver, then everyone else.
            </p>
          </div>
          {totalWorkshops > 0 && (
            <div className="flex items-stretch gap-3">
              <Stat
                value={totalWorkshops.toString()}
                label={totalWorkshops === 1 ? 'workshop' : 'workshops'}
              />
              {goldCount > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={goldCount.toString()}
                    label="gold"
                    tone="wallet"
                  />
                </>
              )}
              {silverCount > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={silverCount.toString()}
                    label="silver"
                    tone="volt"
                  />
                </>
              )}
              {totalEntries > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={totalEntries.toLocaleString()}
                    label="entries"
                    mono
                  />
                </>
              )}
            </div>
          )}
        </div>

        {/* Emirate filter chips */}
        <form className="mt-6 mb-4 flex gap-2 flex-wrap">
          <FilterPill
            href="/workshops"
            label="All"
            active={emirate === null}
          />
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
          <ul className="space-y-3">
            {workshops.map((w) => (
              <li key={w.id}>
                <DirectoryRow w={w} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="card p-10 text-center">
            <p className="text-chalk font-medium">
              {emirate
                ? `No verified workshops in ${emirate} yet`
                : 'No workshops yet'}
            </p>
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

/**
 * Deterministic placeholder hero photo per workshop. We use Picsum
 * because (a) it always returns a valid image — no 404s, (b) the
 * `seed` segment makes the same workshop always show the same photo
 * across requests, and (c) it doesn't depend on us cherry-picking
 * Unsplash IDs that may rot.
 *
 * Once the workshop uploads via `WorkshopHeroUpload`, that takes
 * precedence — see DirectoryRow's preference chain.
 */
function pickStockPhoto(id: string): string {
  // Use the workshop's UUID as the seed — same shop, same photo, every time
  const seed = id.replace(/-/g, '').slice(0, 12)
  return `https://picsum.photos/seed/${seed}/800/600`
}

function DirectoryRow({ w }: { w: DirectoryRow }) {
  // Preference order: workshop-uploaded hero → logo (fallback) → curated stock
  const heroPhoto =
    w.hero_image_url ?? w.logo_url ?? pickStockPhoto(w.id)

  return (
    <Link
      href={`/w/${w.slug}`}
      className="card block overflow-hidden hover:border-volt/30 transition-colors group"
    >
      <div className="flex items-stretch">
        {/* Photo — left, square-ish on mobile, slightly wider on desktop.
            Mirrors the MyCarsList rhythm so consumers + buyers see a
            consistent listing format across the product. */}
        <div className="relative w-28 sm:w-36 md:w-44 shrink-0 bg-iron overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroPhoto}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          />
        </div>

        {/* Content — right side, PF list-card rhythm */}
        <div className="flex-1 min-w-0 p-4 md:p-5 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base md:text-lg font-semibold text-chalk truncate leading-snug">
                  {w.name}
                </h2>
                <TierBadge tier={w.verification_tier} />
              </div>
              {/* Intelligence line — emirate · rating · review count */}
              <p className="text-xs text-ash mt-1 truncate">
                {w.emirate && <span className="text-chalk/90">{w.emirate}</span>}
                {w.review_count > 0 && (
                  <>
                    {w.emirate && ' · '}
                    <span className="font-mono tabular-nums">
                      {w.avg_rating.toFixed(1)}★
                    </span>
                    <span> · </span>
                    <span>
                      {w.review_count}{' '}
                      {w.review_count === 1 ? 'review' : 'reviews'}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Bottom row — entries volume right-aligned, star bar left */}
          <div className="mt-auto pt-3 flex items-end justify-between gap-3">
            {w.review_count > 0 ? (
              <StarRating rating={w.avg_rating} size="sm" />
            ) : (
              <span className="text-[10px] tracking-widest uppercase text-ash">
                No reviews yet
              </span>
            )}
            <div className="text-right shrink-0">
              <span className="font-mono text-base md:text-lg font-semibold text-chalk tabular-nums tracking-tight">
                {w.total_entries.toLocaleString()}
              </span>
              <span className="text-[10px] tracking-widest uppercase text-ash ml-1">
                entries
              </span>
            </div>
          </div>
        </div>
      </div>
    </Link>
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
      className={`text-xs tracking-widest uppercase px-3 py-1.5 rounded-pill border transition-colors ${
        active
          ? 'bg-volt/15 text-volt border-volt/40'
          : 'bg-iron/40 text-ash border-seam hover:text-chalk hover:border-iron'
      }`}
    >
      {label}
    </Link>
  )
}

function TierBadge({ tier }: { tier: string }) {
  if (tier === 'gold') {
    return (
      <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium shrink-0">
        ★ Gold
      </span>
    )
  }
  if (tier === 'silver') {
    return (
      <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium shrink-0">
        ✓ Silver
      </span>
    )
  }
  return null
}

function Stat({
  value,
  label,
  mono,
  tone,
}: {
  value: string
  label: string
  mono?: boolean
  tone?: 'wallet' | 'volt'
}) {
  const valueColor =
    tone === 'wallet'
      ? 'text-wallet'
      : tone === 'volt'
        ? 'text-volt'
        : 'text-chalk'
  return (
    <div className="min-w-0">
      <p
        className={`text-sm md:text-base font-semibold ${valueColor} tracking-tight leading-none ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}
