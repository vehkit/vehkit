import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { StarRating } from '@/components/StarRating'

export const dynamic = 'force-dynamic'

type WorkshopProfile = {
  id: string
  name: string
  slug: string
  emirate: string | null
  phone: string | null
  email: string | null
  verification_tier: string
  logo_url: string | null
  member_since: string
  total_entries: number
  unique_vehicles: number
  avg_rating: number
  review_count: number
  quality_avg: number | null
  value_avg: number | null
  timeliness_avg: number | null
}

type Review = {
  rating: number
  comment: string | null
  created_at: string
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const { data } = await supabase.rpc('public_workshop_profile', { p_slug: slug })
  const w = data as WorkshopProfile | null
  if (!w) return { title: 'Vehkit · Workshop' }
  return {
    title: `${w.name} · Vehkit`,
    description: `Verified workshop on Vehkit · ${w.total_entries} verified service entries${w.emirate ? ` · ${w.emirate}` : ''}`,
  }
}

export default async function WorkshopPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data } = await supabase.rpc('public_workshop_profile', { p_slug: slug })
  const w = data as WorkshopProfile | null

  if (!w) notFound()

  const { data: reviewsData } = await supabase.rpc('public_workshop_reviews', {
    p_slug: slug,
    p_limit: 20,
  })
  const reviews = (reviewsData ?? []) as Review[]

  const tierLabel =
    w.verification_tier === 'gold'
      ? 'Gold Verified'
      : w.verification_tier === 'silver'
        ? 'Silver Verified'
        : 'Member'

  const tierColor =
    w.verification_tier === 'gold'
      ? 'text-wallet'
      : w.verification_tier === 'silver'
        ? 'text-volt'
        : 'text-ash'

  const memberSince = new Date(w.member_since).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  })

  // Workshop initials for avatar
  const initials = w.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('')

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 pt-6">
        <Link
          href="/workshops"
          className="nav-pill hover:text-chalk transition-colors"
        >
          ← Directory
        </Link>

        {/* Profile header — Instagram-style: avatar + stats inline */}
        <header className="mt-6">
          <div className="flex items-center gap-5 md:gap-8">
            <div
              className={`w-20 h-20 md:w-28 md:h-28 rounded-pill flex items-center justify-center shrink-0 font-mono text-xl md:text-3xl font-semibold tracking-tighter ${
                w.verification_tier === 'gold'
                  ? 'bg-wallet/15 text-wallet ring-2 ring-wallet'
                  : w.verification_tier === 'silver'
                    ? 'bg-volt/15 text-volt ring-2 ring-volt'
                    : 'bg-iron text-ash'
              }`}
            >
              {initials || '·'}
            </div>

            {/* Inline stats — Instagram profile style */}
            <div className="flex-1 grid grid-cols-3 gap-2 md:gap-6 text-center">
              <InlineStat
                value={w.total_entries.toLocaleString()}
                label="entries"
              />
              <InlineStat
                value={w.unique_vehicles.toLocaleString()}
                label="cars"
              />
              <InlineStat
                value={
                  w.review_count > 0 ? Number(w.avg_rating).toFixed(1) : '—'
                }
                label={w.review_count > 0 ? `${w.review_count} reviews` : 'no reviews'}
              />
            </div>
          </div>

          {/* Bio */}
          <div className="mt-5">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-semibold text-chalk tracking-tight">
                {w.name}
              </h1>
              {w.verification_tier !== 'unverified' && (
                <span
                  className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-pill font-medium ${
                    w.verification_tier === 'gold'
                      ? 'bg-wallet/20 text-wallet'
                      : 'bg-volt/20 text-volt'
                  }`}
                >
                  ✓ {tierLabel}
                </span>
              )}
              {w.verification_tier === 'unverified' && (
                <span className={`text-[10px] tracking-widest uppercase ${tierColor}`}>
                  {tierLabel}
                </span>
              )}
            </div>
            {w.emirate && (
              <p className="text-sm text-ash mt-1">{w.emirate}</p>
            )}
            <p className="text-xs text-ash/70 mt-1">Member since {memberSince}</p>
          </div>

          {/* Contact pills */}
          {(w.phone || w.email) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {w.phone && (
                <a
                  href={`tel:${w.phone}`}
                  className="pill-outline text-xs flex items-center gap-2"
                >
                  <span className="text-ash">📞</span>
                  <span className="font-mono">{w.phone}</span>
                </a>
              )}
              {w.email && (
                <a
                  href={`mailto:${w.email}`}
                  className="pill-outline text-xs flex items-center gap-2"
                >
                  <span className="text-ash">✉</span>
                  <span className="font-mono">{w.email}</span>
                </a>
              )}
            </div>
          )}
        </header>

        {/* Multi-axis rating breakdown (only shown when at least one axis has data) */}
        {(w.quality_avg != null || w.value_avg != null || w.timeliness_avg != null) && (
          <section className="mt-6 grid grid-cols-3 gap-2">
            <AxisStat label="Quality" value={w.quality_avg} />
            <AxisStat label="Value" value={w.value_avg} />
            <AxisStat label="Timeliness" value={w.timeliness_avg} />
          </section>
        )}

        {/* Tabs (decorative — only Reviews tab populated for now) */}
        <div className="mt-8 border-t border-seam">
          <div className="flex justify-center gap-12">
            <div className="px-4 py-3 -mt-px border-t-2 border-chalk text-xs tracking-widest uppercase text-chalk font-medium">
              Reviews · {reviews.length}
            </div>
          </div>
        </div>

        {/* Reviews grid — Instagram explore style: 2 cols mobile, 3 cols desktop */}
        {reviews.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-1 md:gap-2 mt-2">
            {reviews.map((r, i) => (
              <article
                key={i}
                className="card p-4 aspect-square flex flex-col justify-between hover:border-volt/30 transition-colors"
              >
                <div>
                  <StarRating rating={r.rating} size="sm" />
                  {r.comment && (
                    <p className="text-xs text-chalk/90 mt-3 leading-relaxed line-clamp-5 italic">
                      "{r.comment}"
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-ash mt-3 tracking-widest uppercase">
                  {new Date(r.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="card p-10 text-center mt-2">
            <p className="text-sm text-chalk font-medium">No reviews yet</p>
            <p className="text-xs text-ash mt-2 leading-relaxed">
              Reviews appear here once owners rate verified entries.
            </p>
          </div>
        )}

        {/* About verification — quieter, at bottom */}
        <section className="mt-10 pt-6 border-t border-seam">
          <p className="text-[10px] tracking-widest uppercase text-ash mb-2">
            About verification
          </p>
          <p className="text-xs text-ash/80 leading-relaxed">
            Every entry on this profile was confirmed by the customer at time of service via a
            one-time code. <span className="text-volt">Silver</span> tier requires 10+ verified
            entries + trade license. <span className="text-wallet">Gold</span> requires 100+
            entries + 4.5★ rating.
          </p>
        </section>
      </div>
    </main>
  )
}

function InlineStat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="font-mono text-xl md:text-2xl font-semibold text-chalk tabular-nums tracking-tighter">
        {value}
      </p>
      <p className="text-[10px] md:text-xs text-ash mt-0.5 tracking-wide">{label}</p>
    </div>
  )
}

function AxisStat({ label, value }: { label: string; value: number | null }) {
  if (value == null) {
    return (
      <div className="card p-3 text-center opacity-60">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p className="text-sm text-ash mt-1">—</p>
      </div>
    )
  }
  const pct = Math.min(100, (Number(value) / 5) * 100)
  return (
    <div className="card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p className="font-mono text-sm font-semibold text-chalk tabular-nums">
          {Number(value).toFixed(1)}
          <span className="text-ash text-[10px] ml-0.5">★</span>
        </p>
      </div>
      <div className="h-1 bg-iron rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full ${
            Number(value) >= 4 ? 'bg-volt' : Number(value) >= 3 ? 'bg-wallet' : 'bg-signal/70'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
