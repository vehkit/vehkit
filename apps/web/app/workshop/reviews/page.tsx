import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { StarRating } from '@/components/StarRating'

export const dynamic = 'force-dynamic'

type Review = {
  id: string
  rating: number
  quality_rating: number | null
  value_rating: number | null
  timeliness_rating: number | null
  comment: string | null
  created_at: string
}

type Score = {
  overall: number
  quality: number | null
  value: number | null
  timeliness: number | null
  total_reviews: number
  with_quality: number
  with_value: number
  with_timeliness: number
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  if (days < 365) return `${Math.floor(days / 30)}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

export default async function WorkshopReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; min?: string }>
}) {
  const sp = await searchParams
  const sort = sp.sort ?? 'recent'
  const minRating = Number(sp.min ?? 0)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/workshop/reviews')

  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership?.workshop_id) redirect('/workshop/claim')

  const [{ data: scoreRaw }, { data: reviewsRaw }] = await Promise.all([
    supabase.rpc('compute_workshop_score', { p_workshop_id: membership.workshop_id }),
    supabase
      .from('workshop_reviews')
      .select('id, rating, quality_rating, value_rating, timeliness_rating, comment, created_at')
      .eq('workshop_id', membership.workshop_id)
      .order('created_at', { ascending: false })
      .limit(200),
  ])

  const score = (scoreRaw as Score) ?? null
  let reviews = (reviewsRaw ?? []) as Review[]

  // Client-side filters/sorts (small dataset)
  if (minRating > 0) {
    reviews = reviews.filter((r) => r.rating >= minRating)
  }
  if (sort === 'highest') {
    reviews = [...reviews].sort((a, b) => b.rating - a.rating)
  } else if (sort === 'lowest') {
    reviews = [...reviews].sort((a, b) => a.rating - b.rating)
  }

  return (
    <main className="max-w-[1240px] mx-auto px-6 md:px-10 pt-6 pb-12">
      <header className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-ash">Workshop · Reviews</p>
          <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter mt-1">
            Reviews
          </h1>
          <p className="text-sm text-ash mt-0.5">
            {score?.total_reviews ?? 0} total
            {score?.total_reviews
              ? ` · ${Number(score.overall).toFixed(2)}★ overall`
              : ''}
          </p>
        </div>
      </header>

      {/* Multi-axis breakdown */}
      {score && score.total_reviews > 0 && (
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6">
          <AxisCard label="Overall" value={score.overall} count={score.total_reviews} />
          <AxisCard label="Quality" value={score.quality} count={score.with_quality} />
          <AxisCard label="Value" value={score.value} count={score.with_value} />
          <AxisCard label="Timeliness" value={score.timeliness} count={score.with_timeliness} />
        </section>
      )}

      {/* Filters */}
      {(score?.total_reviews ?? 0) > 0 && (
        <form className="mt-6 flex items-center gap-2 flex-wrap">
          <span className="text-[10px] tracking-widest uppercase text-ash">Sort</span>
          <FilterPill href="/workshop/reviews" label="Recent" active={sort === 'recent'} />
          <FilterPill
            href="/workshop/reviews?sort=highest"
            label="Highest"
            active={sort === 'highest'}
          />
          <FilterPill
            href="/workshop/reviews?sort=lowest"
            label="Lowest"
            active={sort === 'lowest'}
          />
          <span className="text-[10px] tracking-widest uppercase text-ash ml-3">Min</span>
          {[0, 3, 4, 5].map((r) => (
            <FilterPill
              key={r}
              href={`/workshop/reviews?sort=${sort}${r ? `&min=${r}` : ''}`}
              label={r === 0 ? 'All' : `${r}★+`}
              active={minRating === r}
            />
          ))}
        </form>
      )}

      {/* Reviews list */}
      {reviews.length > 0 ? (
        <ul className="card divide-y divide-seam mt-6">
          {reviews.map((r) => (
            <li key={r.id} className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <StarRating rating={r.rating} size="md" />
                <p className="text-[10px] tracking-widest uppercase text-ash">
                  {relativeDate(r.created_at)}
                </p>
              </div>
              {r.comment && (
                <p className="text-sm text-chalk mt-2 leading-relaxed italic">
                  "{r.comment}"
                </p>
              )}
              {(r.quality_rating || r.value_rating || r.timeliness_rating) && (
                <div className="flex items-center gap-4 mt-3 text-[11px] flex-wrap">
                  {r.quality_rating && (
                    <span className="text-ash">
                      Quality{' '}
                      <span className="text-chalk font-mono">{r.quality_rating}★</span>
                    </span>
                  )}
                  {r.value_rating && (
                    <span className="text-ash">
                      Value{' '}
                      <span className="text-chalk font-mono">{r.value_rating}★</span>
                    </span>
                  )}
                  {r.timeliness_rating && (
                    <span className="text-ash">
                      Timeliness{' '}
                      <span className="text-chalk font-mono">{r.timeliness_rating}★</span>
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="py-16 text-center mt-6">
          <div className="w-14 h-14 mx-auto rounded-pill border border-seam flex items-center justify-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-ash"
              aria-hidden
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-chalk mt-4">No reviews yet</h3>
          <p className="text-sm text-ash mt-1 leading-relaxed max-w-sm mx-auto">
            Reviews appear here when customers rate verified entries on their car. The more
            verified entries you log, the more reviews you'll receive.
          </p>
        </div>
      )}

      <p className="text-[11px] text-ash/70 leading-relaxed mt-8">
        Reviews are owner-submitted on confirmed entries. They cannot be deleted by the
        workshop. If you believe a review violates the community standards, contact support.
      </p>
    </main>
  )
}

function AxisCard({
  label,
  value,
  count,
}: {
  label: string
  value: number | null
  count: number
}) {
  if (value == null || count === 0) {
    return (
      <div className="card p-4 opacity-60">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p className="text-sm text-ash mt-2">No data</p>
      </div>
    )
  }
  const pct = Math.min(100, (Number(value) / 5) * 100)
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
        <p className="font-mono text-base font-semibold text-chalk tabular-nums">
          {Number(value).toFixed(2)}
          <span className="text-ash text-[10px] ml-0.5">★</span>
        </p>
      </div>
      <div className="h-1 bg-iron rounded-full mt-3 overflow-hidden">
        <div
          className={`h-full ${
            Number(value) >= 4 ? 'bg-volt' : Number(value) >= 3 ? 'bg-wallet' : 'bg-signal/70'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-ash mt-2">{count} rated</p>
    </div>
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
      className={`text-[11px] tracking-wider uppercase px-3 py-1 rounded-pill border transition-colors ${
        active
          ? 'border-chalk text-chalk bg-iron'
          : 'border-seam text-ash hover:text-chalk'
      }`}
    >
      {label}
    </Link>
  )
}
