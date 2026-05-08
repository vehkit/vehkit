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

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <Link
          href="/workshops"
          className="nav-pill hover:text-chalk transition-colors"
        >
          ← Directory
        </Link>

        {/* Hero card */}
        <header className="card p-6 md:p-8 mt-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className={`nav-pill text-[10px] ${tierColor}`}>{tierLabel}</p>
              <h1 className="text-3xl md:text-5xl font-semibold text-chalk tracking-tightest mt-2">
                {w.name}
              </h1>
              {w.emirate && <p className="text-ash mt-1">{w.emirate}</p>}
              <p className="text-xs text-ash/70 mt-3">Member since {memberSince}</p>
            </div>
            {w.verification_tier !== 'unverified' && (
              <div className="w-14 h-14 rounded-pill bg-volt/15 border border-volt flex items-center justify-center shrink-0">
                <span className="text-volt text-2xl">✓</span>
              </div>
            )}
          </div>
        </header>

        {/* Stats */}
        <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          <Stat label="Verified entries" value={w.total_entries.toLocaleString()} />
          <Stat label="Cars served" value={w.unique_vehicles.toLocaleString()} />
          {w.review_count > 0 ? (
            <div className="card p-5 text-center">
              <p className="text-[10px] tracking-widest uppercase text-ash">Rating</p>
              <p className="font-mono text-3xl font-semibold text-chalk tabular-nums tracking-tighter mt-1">
                {Number(w.avg_rating).toFixed(1)}
              </p>
              <div className="mt-1 flex justify-center">
                <StarRating rating={Number(w.avg_rating)} size="sm" />
              </div>
              <p className="text-[10px] text-ash mt-1">
                {w.review_count} {w.review_count === 1 ? 'review' : 'reviews'}
              </p>
            </div>
          ) : (
            <div className="card p-5 text-center opacity-60">
              <p className="text-[10px] tracking-widest uppercase text-ash">Rating</p>
              <p className="text-sm text-ash mt-2">No reviews yet</p>
            </div>
          )}
        </section>

        {/* Contact */}
        {(w.phone || w.email) && (
          <section className="card p-5 mt-6">
            <p className="nav-pill text-[10px] mb-3">Contact</p>
            <div className="space-y-2">
              {w.phone && (
                <a
                  href={`tel:${w.phone}`}
                  className="flex items-center gap-3 text-sm text-chalk hover:text-volt transition-colors"
                >
                  <span className="text-ash">Phone</span>
                  <span className="font-mono">{w.phone}</span>
                </a>
              )}
              {w.email && (
                <a
                  href={`mailto:${w.email}`}
                  className="flex items-center gap-3 text-sm text-chalk hover:text-volt transition-colors"
                >
                  <span className="text-ash">Email</span>
                  <span className="font-mono">{w.email}</span>
                </a>
              )}
            </div>
          </section>
        )}

        {/* About verification */}
        <section className="card p-5 mt-6">
          <p className="nav-pill text-[10px] mb-2">What "verified" means</p>
          <p className="text-sm text-ash leading-relaxed">
            Every entry this workshop has logged on Vehkit was confirmed by the customer at the
            time of service via a one-time code. Workshops with 10+ verified entries can apply
            for the <span className="text-volt">Silver</span> tier (trade license verified). Gold
            tier requires{' '}
            <span className="text-wallet">100+ verified entries and a 4.5+ rating</span>.
          </p>
        </section>

        {/* Reviews */}
        <section className="mt-10">
          <h2 className="nav-pill mb-4">
            Reviews{' '}
            {reviews.length > 0 && (
              <span className="text-[10px] text-ash">· {reviews.length}</span>
            )}
          </h2>
          {reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.map((r, i) => (
                <article key={i} className="card p-4">
                  <div className="flex items-center justify-between gap-3">
                    <StarRating rating={r.rating} size="sm" />
                    <p className="text-xs text-ash">
                      {new Date(r.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </div>
                  {r.comment && (
                    <p className="text-sm text-chalk/90 mt-2 leading-relaxed">{r.comment}</p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="card p-6 text-center">
              <p className="text-sm text-ash">
                No reviews yet. Reviews appear here once owners rate verified entries.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-5 text-center">
      <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
      <p className="font-mono text-3xl font-semibold text-chalk tabular-nums tracking-tighter mt-1">
        {value}
      </p>
    </div>
  )
}
