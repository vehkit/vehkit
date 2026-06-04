import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createBookingRequest } from '@/app/actions/bookings'

/**
 * Customer-facing booking form for a specific workshop.
 *
 * Path: /w/[slug]/book
 *
 * If unauthenticated, the action redirects to /login with `next` set
 * back here. After auth, customer fills service + date + note, submits.
 * Workshop sees the booking in their dashboard's pending pile.
 */

const SERVICE_CATEGORIES = [
  'Oil change & filter',
  'Brakes',
  'Tyres & alignment',
  'AC / cooling',
  'Battery & electrical',
  'Suspension',
  'Bodywork & paint',
  'Engine diagnostic',
  'Pre-purchase inspection',
  'Major service',
  'Other',
] as const

export default async function WorkshopBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { slug } = await params
  const sp = await searchParams
  const errorMsg = sp.error ? decodeURIComponent(sp.error) : null

  const supabase = await createClient()

  const { data: w } = await supabase
    .from('workshops')
    .select('id, name, slug, emirate, verification_tier')
    .eq('slug', slug)
    .maybeSingle()
  if (!w) notFound()

  // If unauthenticated, bounce to login first — the customer needs an
  // account so we can attach the booking to them + later notify them.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/w/${slug}/book`)}`)
  }

  // Load this customer's vehicles so the form can pre-fill which car
  // the booking is for. Optional — they can book without a vehicle id.
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, nickname, make, model, plate_number')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  // Default the date to tomorrow
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const minDate = tomorrow.toISOString().slice(0, 10)

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-8 md:pt-10">
        <Link
          href={`/w/${slug}`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← Back to {w.name}
        </Link>

        <p className="nav-pill mt-4">Book a visit</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          {w.name}
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Pick a service, a date that works for you, and they&apos;ll confirm
          (usually same day). No payment now — pay them directly after the work.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {errorMsg}
          </div>
        )}

        <form
          action={createBookingRequest}
          className="mt-8 space-y-4"
          id="booking-form"
        >
          <input type="hidden" name="workshop_slug" value={slug} />

          <div>
            <label htmlFor="service_category" className="label">
              What needs doing? <span className="text-signal">*</span>
            </label>
            <select
              id="service_category"
              name="service_category"
              required
              defaultValue=""
              className="field"
            >
              <option value="" disabled>
                Pick a service…
              </option>
              {SERVICE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="preferred_date" className="label">
              Preferred date{' '}
              <span className="text-ash/70">(approximate)</span>
            </label>
            <input
              id="preferred_date"
              name="preferred_date"
              type="date"
              min={minDate}
              className="field"
            />
            <p className="text-xs text-ash mt-1.5">
              They&apos;ll confirm the exact slot — this is your best window.
            </p>
          </div>

          {vehicles && vehicles.length > 0 && (
            <div>
              <label htmlFor="vehicle_id" className="label">
                Which car? <span className="text-ash/70">(optional)</span>
              </label>
              <select
                id="vehicle_id"
                name="vehicle_id"
                defaultValue=""
                className="field"
              >
                <option value="">— Not specified</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.nickname ?? `${v.make} ${v.model}`}
                    {v.plate_number ? ` · ${v.plate_number}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="contact_phone" className="label">
              Your phone <span className="text-ash/70">(optional)</span>
            </label>
            <input
              id="contact_phone"
              name="contact_phone"
              type="tel"
              inputMode="tel"
              placeholder="+971 5X XXX XXXX"
              className="field"
            />
            <p className="text-xs text-ash mt-1.5">
              So they can reach you to confirm. Stays between you and this
              workshop.
            </p>
          </div>

          <div>
            <label htmlFor="message" className="label">
              Any details? <span className="text-ash/70">(optional)</span>
            </label>
            <textarea
              id="message"
              name="message"
              rows={3}
              placeholder="e.g. Knocking sound when braking. Need it back same day if possible."
              className="field resize-none"
            />
          </div>
        </form>
      </div>

      {/* Sticky submit bar */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link
            href={`/w/${slug}`}
            className="pill-ghost flex-1 text-center"
          >
            Cancel
          </Link>
          <button
            type="submit"
            form="booking-form"
            className="pill-primary flex-[2] text-center"
          >
            Send booking
          </button>
        </div>
      </div>
    </main>
  )
}
