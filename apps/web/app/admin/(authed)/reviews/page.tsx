import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Review = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  workshop_id: string
  service_record_id: string
}

async function deleteReview(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = createAdminClient()
  await supabase.from('workshop_reviews').delete().eq('id', id)
  revalidatePath('/admin/reviews')
}

export default async function AdminReviewsPage() {
  const supabase = createAdminClient()

  const { data: reviews, error: reviewsError } = await supabase
    .from('workshop_reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  const list = (reviews ?? []) as Review[]

  const workshopIds = [...new Set(list.map((r) => r.workshop_id))]
  const { data: workshops, error: workshopsError } =
    workshopIds.length > 0
      ? await supabase.from('workshops').select('id, name, slug').in('id', workshopIds)
      : { data: [], error: null }
  const wMap = new Map<string, { name: string; slug: string }>()
  for (const w of workshops ?? []) {
    wMap.set(w.id, { name: w.name, slug: w.slug })
  }

  // Aggregate avg rating
  const totalRating = list.reduce((s, r) => s + r.rating, 0)
  const avgRating = list.length > 0 ? (totalRating / list.length).toFixed(2) : '0'

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Reviews · {list.length}
          </h1>
          <p className="text-sm text-ash mt-1">
            Average rating: <span className="font-mono text-chalk">{avgRating}★</span>
          </p>
        </div>
      </header>

      {(reviewsError || workshopsError) && (
        <div className="mb-4 bg-signal/10 border border-signal/30 text-signal text-xs px-4 py-3 rounded-DEFAULT font-mono">
          {reviewsError && <div>workshop_reviews: {reviewsError.message} · {reviewsError.code}</div>}
          {workshopsError && <div>workshops: {workshopsError.message} · {workshopsError.code}</div>}
        </div>
      )}

      <div className="space-y-3">
        {list.map((r) => {
          const w = wMap.get(r.workshop_id)
          return (
            <article key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-base text-wallet">
                    {'★'.repeat(r.rating)}
                    <span className="text-seam">{'★'.repeat(5 - r.rating)}</span>
                  </p>
                  <p className="text-xs text-ash mt-1">
                    {w ? `for ${w.name}` : 'Unknown workshop'} ·{' '}
                    {new Date(r.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                  {r.comment && (
                    <p className="text-sm text-chalk mt-2 leading-relaxed italic">
                      "{r.comment}"
                    </p>
                  )}
                </div>
                <form action={deleteReview}>
                  <input type="hidden" name="id" value={r.id} />
                  <button
                    type="submit"
                    className="text-xs tracking-widest uppercase text-ash hover:text-signal transition-colors"
                  >
                    Delete
                  </button>
                </form>
              </div>
            </article>
          )
        })}
        {list.length === 0 && (
          <div className="card p-10 text-center text-ash">No reviews yet</div>
        )}
      </div>
    </div>
  )
}
