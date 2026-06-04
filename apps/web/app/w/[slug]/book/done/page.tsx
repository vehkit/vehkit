import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Booking confirmation — shown right after createBookingRequest succeeds.
 *
 * Tells the customer what happens next, gives them a way back to the
 * workshop profile, and surfaces a sign-in nudge to /mycars if they
 * want to track the booking later.
 */
export default async function BookingDonePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const { data: w } = await supabase
    .from('workshops')
    .select('name, slug')
    .eq('slug', slug)
    .maybeSingle()
  if (!w) notFound()

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 mx-auto rounded-pill bg-leaf/15 text-leaf flex items-center justify-center">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <polyline points="4 12 10 18 20 6" />
          </svg>
        </div>

        <p className="nav-pill mt-6">Booking sent</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-3 leading-tight">
          {w.name} has your request.
        </h1>
        <p className="text-sm text-ash mt-3 leading-relaxed">
          They&apos;ll confirm in their dashboard, usually within a few hours.
          You&apos;ll see updates in your account &mdash; no need to call.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            href="/mycars"
            className="pill-primary inline-flex items-center justify-center"
          >
            See my bookings
          </Link>
          <Link
            href="/workshops"
            className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
          >
            Browse more workshops
          </Link>
        </div>
      </div>
    </main>
  )
}
