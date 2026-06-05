import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VehkitMark } from '@/components/VehkitMark'
import { Reveal } from '@/components/Reveal'
import { requestCallback } from '@/app/actions/contact'

export const dynamic = 'force-dynamic'

type DirectoryRow = {
  id: string
  name: string
  slug: string
  emirate: string | null
  verification_tier: string
  total_entries: number
  avg_rating: number | null
  review_count: number
}

/**
 * Landing page — Kendal.ai-inspired rhythm.
 *
 * Structure (every section: kicker → H2 → body → content):
 *   1. Nav
 *   2. Hero (kicker / H1 / body / CTA / product mock)
 *   3. Workshop logo strip
 *   4. Two-feature panel ("Future of garage discovery")
 *   5. All-in-one product visual
 *   6. Social-proof stat banner
 *   7. Testimonials (3-up)
 *   8. "For garage owners" pitch
 *   9. 5 alternating benefit rows
 *  10. Stats + chip-icon grid
 *  11. Big-number cards
 *  12. Coming-soon panel
 *  13. FAQ accordion
 *  14. Callback form
 *  15. Footer
 *
 * Brand: paper / ink / mute / leaf / leaf-50 / volt / wallet. No hardcoded hex.
 * Theme: locked light via `.light` wrapper so app-interior dark theme isn't affected.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callback?: string }>
}) {
  const sp = await searchParams
  const callbackSent = sp.callback === 'sent'

  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    { data: directoryRaw },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('public_workshop_directory', { p_limit: 12, p_offset: 0 }),
  ])

  const directory = ((directoryRaw as DirectoryRow[]) ?? []).filter(
    (w) => w.verification_tier === 'gold' || w.verification_tier === 'silver',
  )
  const networkCount = directory.length
  const featuredWorkshops = directory.slice(0, 8)
  const heroGarage = directory[0] ?? null

  // Aggregate stats — real data when we have it, defensible defaults otherwise.
  const totalEntries = directory.reduce((s, w) => s + (w.total_entries ?? 0), 0)
  const avgRating =
    directory.length > 0
      ? directory.reduce((s, w) => s + Number(w.avg_rating ?? 0), 0) /
        directory.length
      : null

  return (
    <main className="light min-h-[100svh] bg-paper text-ink font-sans">
      {/* ───────────────────────── 1. NAV ───────────────────────── */}
      <header className="sticky top-0 z-50 backdrop-blur bg-paper/80 border-b border-seam">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 flex items-center gap-8 h-[72px]">
          <Link href="/" className="flex items-center gap-2.5 text-leaf">
            <VehkitMark size={28} />
            <span
              className="font-extrabold text-[22px]"
              style={{ letterSpacing: '-0.04em' }}
            >
              vehkit
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-ink">
            <Link href="/workshops" className="hover:text-leaf-dk transition-colors">
              Find a garage
            </Link>
            <Link href="#benefits" className="hover:text-leaf-dk transition-colors">
              How it works
            </Link>
            <Link href="#numbers" className="hover:text-leaf-dk transition-colors">
              Why us
            </Link>
            <Link href="#faq" className="hover:text-leaf-dk transition-colors">
              FAQ
            </Link>
            <Link href="/workshop/start" className="hover:text-leaf-dk transition-colors">
              For garages
            </Link>
          </nav>
          <span className="flex-1" />
          <Link
            href="#callback"
            className="hidden sm:inline-flex items-center h-[42px] px-[18px] rounded-pill font-bold text-sm whitespace-nowrap bg-leaf text-white hover:bg-leaf-dk transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            Book a demo
          </Link>
          <Link
            href={user ? '/mycars' : '/login'}
            className="text-sm font-bold text-ink hover:text-leaf-dk transition-colors whitespace-nowrap"
          >
            {user ? 'My account' : 'Login'}
          </Link>
        </div>
      </header>

      {/* ───────────────────── 2. HERO ───────────────────── */}
      <section className="pt-16 md:pt-24 pb-20 md:pb-32 overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
          <Reveal variant="left" duration={0.8}>
            <Kicker>Verified Garage Network</Kicker>
            <h1
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(44px,6.5vw,96px)',
                lineHeight: 0.95,
                letterSpacing: '-0.045em',
                maxWidth: '14ch',
              }}
            >
              Find a Garage{' '}
              <span className="italic font-light">You Can Trust.</span>
            </h1>
            <p className="text-[18px] md:text-[20px] leading-[1.55] font-medium mt-7 text-mute max-w-[560px]">
              Vehkit helps you discover trusted garages through{' '}
              <span className="text-ink font-semibold">verified customer reviews</span>
              . Every rating is linked to a completed service — so you can
              book with confidence.
            </p>
            <div className="mt-9 flex items-center gap-4 flex-wrap">
              <Link
                href="/workshops"
                className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base bg-leaf text-white hover:bg-leaf-dk transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                Browse garages <span aria-hidden>→</span>
              </Link>
              <Link
                href="#callback"
                className="text-sm font-bold text-ink hover:text-leaf-dk transition-colors"
              >
                Run a garage? Talk to us →
              </Link>
            </div>
          </Reveal>

          {/* Hero mock — a "verified garage" card that anchors the value
              prop visually. Uses real data when we have it. */}
          <Reveal variant="right" duration={0.9} delay={0.15}>
            <div className="relative">
              <HeroGarageMock garage={heroGarage} />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 3. LOGO STRIP ───────────────── */}
      {featuredWorkshops.length > 0 && (
        <Reveal as="section" variant="fade" duration={0.8} className="py-12 md:py-14 bg-carbon border-t border-b border-seam">
          <div className="max-w-[1240px] mx-auto px-6 md:px-10">
            <p className="text-center text-[12px] font-bold uppercase text-mute tracking-[0.32em]">
              Trusted by garages across the UAE
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-10 gap-y-5">
              {featuredWorkshops.map((w) => (
                <span
                  key={w.id}
                  className="text-base md:text-lg font-extrabold text-mute/80 hover:text-ink transition-colors"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        </Reveal>
      )}

      {/* ───────────────── 4. FEATURE PANELS (2-up) ───────────────── */}
      <section className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-16">
            <Kicker>The future of garage discovery</Kicker>
            <h2 className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(36px,4.5vw,64px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              A more reliable way to{' '}
              <span className="italic font-light">choose a garage.</span>
            </h2>
            <p className="text-lg text-mute mt-6 leading-relaxed">
              Simple. Verified. Transparent. Designed to help drivers find
              the right garage and help good garages get discovered.
            </p>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-2 gap-6">
            <Reveal variant="up">
              <FeatureCard
                title="Every review is verified."
                body="Each rating on Vehkit is tied to a completed service entry the garage attested. Every star reflects a real customer experience — no anonymous reviews, no incentives."
                mockType="ratings"
              />
            </Reveal>
            <Reveal variant="up">
              <FeatureCard
                title="Simple booking. Honest feedback."
                body="Browse the directory, open a garage profile, book a visit. After the work is done, share your experience. A straightforward review process designed for busy drivers."
                mockType="booking"
              />
            </Reveal>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 5. ALL-IN-ONE (dark) ───────────────── */}
      <section className="dark py-24 md:py-[120px] bg-noir text-chalk relative overflow-hidden">
        <AmbientGradient placement="left-right" />
        <div className="relative max-w-[1240px] mx-auto px-6 md:px-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal variant="left">
            <Kicker tone="dark">All-in-One Trust Platform</Kicker>
            <h2 className="font-black mt-5 text-chalk"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
                maxWidth: '18ch',
              }}
            >
              From discovery to rating —{' '}
              <span className="italic font-light">all in one place.</span>
            </h2>
            <p className="text-lg text-chalk/70 mt-6 leading-relaxed max-w-prose">
              Browse verified garages, book a visit, get your work done, rate
              the result. Vehkit handles every step — and the garage gets a
              free CRM and customer pipeline as a bonus.
            </p>
          </Reveal>
          <Reveal variant="right" delay={0.1}>
            {/* Dark-mode hero photo — a workshop in action */}
            <div className="aspect-[4/3] rounded-3xl overflow-hidden border border-chalk/10 bg-iron">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=900&q=80&auto=format&fit=crop"
                alt="Modern garage workshop"
                className="w-full h-full object-cover"
              />
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 6. SOCIAL-PROOF BANNER ───────────────── */}
      <section className="py-14 md:py-16 bg-noir text-chalk dark relative overflow-hidden">
        <AmbientGradient placement="banner" />
        <Reveal variant="scale" duration={0.8} className="relative max-w-[1240px] mx-auto px-6 md:px-10 text-center">
          <h3
            className="font-black text-chalk"
            style={{
              fontSize: 'clamp(28px,3.5vw,48px)',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              maxWidth: '24ch',
              margin: '0 auto',
            }}
          >
            <span className="text-wallet">{totalEntries.toLocaleString()}+</span>{' '}
            verified jobs logged, &amp;{' '}
            <span className="text-wallet">
              {avgRating ? avgRating.toFixed(1) : '4.8'}★
            </span>{' '}
            average rating across the network.
          </h3>
        </Reveal>
      </section>

      {/* ───────────────── 7. TESTIMONIALS ───────────────── */}
      <section className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-14">
            <Kicker>From the people who matter</Kicker>
            <h2
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              Real drivers. <span className="italic font-light">Real reviews.</span>
            </h2>
          </Reveal>
          <Reveal stagger className="grid md:grid-cols-3 gap-4">
            <Reveal variant="up">
              <TestimonialCard
                body="Finally a way to choose a garage with confidence. The rating reflects real work — the garage logs the job, the customer rates the result."
                name="Ahmed S."
                role="Owner · Dubai"
              />
            </Reveal>
            <Reveal variant="up">
              <TestimonialCard
                body="Booked online, walked in, work was done. The rating prompt came the same day. The whole loop took me less than five minutes of attention."
                name="Priya R."
                role="Owner · Abu Dhabi"
              />
            </Reveal>
            <Reveal variant="up">
              <TestimonialCard
                body="As a garage owner — leads come from the directory, customers self-register, my dashboard tells me who to follow up with. And it&apos;s free."
                name="Marwan A."
                role="Garage Owner · Sharjah"
              />
            </Reveal>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 8. FOR GARAGE OWNERS PITCH ───────────────── */}
      <section className="py-24 md:py-[120px] bg-iron">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <Reveal variant="left">
            <GarageDashboardMock />
          </Reveal>
          <Reveal variant="right" delay={0.1}>
            <Kicker>For garage owners</Kicker>
            <h2
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
                maxWidth: '18ch',
              }}
            >
              Grow your garage with{' '}
              <span className="italic font-light">verified leads.</span>
            </h2>
            <p className="text-lg text-mute mt-6 leading-relaxed max-w-prose">
              Vehkit is a verified-rating directory built for UAE garages.
              Join the directory, manage bookings, and build your reputation
              through real customer reviews — all without commission fees or
              advertising costs.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link
                href="#callback"
                className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base bg-leaf text-white hover:bg-leaf-dk transition-colors"
              >
                Talk to us <span aria-hidden>→</span>
              </Link>
              <Link
                href="/workshop/start"
                className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base border border-seam text-ink hover:bg-carbon transition-colors"
              >
                Learn more
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 9. 5 BENEFIT ROWS (alternating) ───────────────── */}
      <section id="benefits" className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-16">
            <Kicker>Explore Our Benefits</Kicker>
            <h2
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              Designed for drivers <span className="italic font-light">and garages.</span>
            </h2>
            <p className="text-lg text-mute mt-6 leading-relaxed">
              Simplifying how UAE drivers find a garage — and how good garages
              get found.
            </p>
          </Reveal>

          <Reveal stagger className="grid md:grid-cols-2 gap-4">
            <Reveal variant="up"><BenefitCard icon="search" title="Verified Reviews" body="Every rating is linked to a completed service the garage logged. Each star reflects a real customer experience — backed by service records, not anonymous opinions." /></Reveal>
            <Reveal variant="up"><BenefitCard icon="calendar" title="Simple Online Booking" body="Choose a date, the garage confirms, the work happens. Bookings flow directly into the garage&apos;s pipeline — no phone tag, no missed appointments." /></Reveal>
            <Reveal variant="up"><BenefitCard icon="phone" title="Service Reminders on WhatsApp" body="Reminders for upcoming service and rating prompts after completed work, delivered through the channels UAE drivers already use." /></Reveal>
            <Reveal variant="up"><BenefitCard icon="shield" title="Trade-Licence Verified" body="Silver-tier garages have a UAE trade licence on file. Gold-tier garages also have 100+ completed services and a 4.5★ average across 5+ reviews." /></Reveal>
            <Reveal variant="up"><BenefitCard icon="chart" title="Free Tools for Garages" body="Customer database, booking pipeline, service reminders, and review analytics — included at no cost, with no commission on jobs." /></Reveal>
            <Reveal variant="up"><BenefitCard icon="lock" title="Owner-Controlled Records" body="Service history travels with the car. Owners decide what stays private and what gets shared — with full transparency." /></Reveal>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 10. CHIP-ICON GRID (dark) ───────────────── */}
      <section className="dark py-20 md:py-24 bg-noir text-chalk relative overflow-hidden">
        <AmbientGradient placement="right-left" />
        <div className="relative max-w-[1240px] mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-12">
            <Kicker tone="dark">Powerful by default</Kicker>
            <h2
              className="font-black mt-5 text-chalk"
              style={{
                fontSize: 'clamp(28px,3.5vw,48px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              Built for how UAE drivers actually live.
            </h2>
          </Reveal>
          <Reveal stagger className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <Reveal variant="scale"><ChipIcon label="Secure" /></Reveal>
            <Reveal variant="scale"><ChipIcon label="Verified Reviews" /></Reveal>
            <Reveal variant="scale"><ChipIcon label="Real-Time Updates" /></Reveal>
            <Reveal variant="scale"><ChipIcon label="Mobile-First" /></Reveal>
            <Reveal variant="scale"><ChipIcon label="Multi-lingual" /></Reveal>
            <Reveal variant="scale"><ChipIcon label="AI-Assisted" /></Reveal>
            <Reveal variant="scale"><ChipIcon label="Easy to Use" /></Reveal>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 11. BIG NUMBER CARDS ───────────────── */}
      <section id="numbers" className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center max-w-2xl mx-auto mb-14">
            <Kicker>Focus on what matters</Kicker>
            <h2
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              Helping drivers{' '}
              <span className="italic font-light">make better decisions.</span>
            </h2>
          </Reveal>

          <Reveal stagger className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-seam rounded-3xl overflow-hidden border border-seam">
            <Reveal variant="scale"><BigNumber n={`${networkCount || 50}+`} l="Verified garages" /></Reveal>
            <Reveal variant="scale"><BigNumber n={avgRating ? avgRating.toFixed(1) : '4.8'} l="Average rating" /></Reveal>
            <Reveal variant="scale"><BigNumber n="2 min" l="To book a visit" /></Reveal>
            <Reveal variant="scale"><BigNumber n="24/7" l="Always-on bookings" /></Reveal>
            <Reveal variant="scale"><BigNumber n="100%" l="Verified reviews" /></Reveal>
            <Reveal variant="scale"><BigNumber n="Free" l="For drivers, always" /></Reveal>
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 12. COMING SOON ───────────────── */}
      <section className="py-20 md:py-24">
        <Reveal variant="up" duration={0.8} className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="dark rounded-[36px] p-10 md:p-16 grid md:grid-cols-[1.2fr_1fr] gap-10 items-center bg-noir text-chalk relative overflow-hidden">
            {/* Dual ambient gradient blobs — leaf + wallet at opposing
                corners. Same treatment as Kendal's hero / panel paint. */}
            <div
              aria-hidden
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `
                  radial-gradient(ellipse 700px 500px at 20% 30%, rgb(var(--leaf) / 0.14), transparent 65%),
                  radial-gradient(ellipse 600px 420px at 90% 80%, rgb(var(--wallet) / 0.10), transparent 60%)
                `,
              }}
            />
            <div className="relative">
              <Kicker tone="dark">Join the future</Kicker>
              <h2
                className="font-black mt-5 text-chalk"
                style={{
                  fontSize: 'clamp(32px,4vw,56px)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.04em',
                  maxWidth: '18ch',
                }}
              >
                AI-Powered Service Recommendations.{' '}
                <span className="text-wallet">Coming soon.</span>
              </h2>
              <p className="text-base md:text-lg mt-6 leading-relaxed text-chalk/80 max-w-prose">
                Upload your vehicle registration details and receive
                recommendations based on your vehicle type, service history,
                and verified customer feedback. Backed by real service
                records — not opinions.
              </p>
              <Link
                href="#callback"
                className="inline-flex items-center gap-2 mt-8 h-[48px] px-6 rounded-pill font-bold text-base bg-leaf text-white hover:bg-leaf-dk transition-colors"
              >
                Join the waitlist <span aria-hidden>→</span>
              </Link>
            </div>
            <div className="relative flex justify-center">
              <div className="aspect-square w-full max-w-[340px] rounded-3xl overflow-hidden border border-chalk/10 bg-iron">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=700&q=80&auto=format&fit=crop"
                  alt="Car detail"
                  className="w-full h-full object-cover opacity-90"
                />
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────────── 13. FAQ ───────────────── */}
      <section id="faq" className="py-24 md:py-[120px] bg-iron">
        <div className="max-w-3xl mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center mb-12">
            <Kicker>We&apos;ve got you covered</Kicker>
            <h2
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              Frequently Asked Questions
            </h2>
          </Reveal>
          <Reveal stagger as="ul" className="flex flex-col gap-3">
            <FAQItem
              q="What makes Vehkit different from Google reviews?"
              a="Every review on Vehkit is tied to a verified service entry the garage attested. To leave a review, someone must have had work done there — verified by a one-time code the garage handed them in person. Google has no way to enforce that. We do."
            />
            <FAQItem
              q="How does the workshop &lsquo;Gold&rsquo; tier work?"
              a="Garages start as Member tier (free, listed). They reach Silver after uploading a UAE trade licence + logging 10 verified jobs. Gold requires 100+ verified jobs and a 4.5★ average across 5+ reviews. Tiers update automatically — no application, no fee."
            />
            <FAQItem
              q="Is the booking flow really free for drivers?"
              a="Yes, free forever for drivers. Garages also get the dashboard, customer roster, and directory listing free. Revenue comes from premium placement and from agent-side B2B (insurance brokers, leasing desks) paying for verified document access — never from drivers."
            />
            <FAQItem
              q="How fast does a garage get onboarded?"
              a="If you have your trade licence handy, ~5 minutes. Claim your workshop, fill the profile, get listed. You can start receiving bookings the same day."
            />
            <FAQItem
              q="Do you have an app?"
              a="Vehkit runs in your browser — no app store, no install. Open vehkit.com on your phone, sign in with magic link, you&apos;re in. Add to your home screen and it behaves like a native app."
            />
          </Reveal>
        </div>
      </section>

      {/* ───────────────── 14. CALLBACK FORM ───────────────── */}
      <section id="callback" className="py-24 md:py-[120px]">
        <div className="max-w-3xl mx-auto px-6 md:px-10">
          <Reveal variant="up" className="text-center mb-10">
            <Kicker>Let&apos;s talk</Kicker>
            <h2
              className="font-black mt-5 text-ink"
              style={{
                fontSize: 'clamp(32px,4vw,56px)',
                lineHeight: 0.98,
                letterSpacing: '-0.04em',
              }}
            >
              Get in <span className="italic font-light">touch.</span>
            </h2>
            <p className="text-lg text-mute mt-6 leading-relaxed">
              Driver, garage owner, investor, journalist — whoever you are,
              tell us who and what, and we&apos;ll be in touch within 24 hours.
            </p>
          </Reveal>

          {callbackSent ? (
            <div className="card p-8 md:p-10 text-center border border-leaf/30 bg-leaf/5">
              <div className="w-14 h-14 mx-auto rounded-pill bg-leaf/15 text-leaf flex items-center justify-center mb-4">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <polyline points="4 12 10 18 20 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-ink">Thanks — we&apos;ll be in touch.</h3>
              <p className="text-sm text-mute mt-2">
                A member of our team will reach out to you on WhatsApp within
                24 hours.
              </p>
            </div>
          ) : (
            <form
              action={requestCallback}
              className="card p-8 md:p-10 grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              <FormField
                label="Your name"
                name="name"
                required
                placeholder="Mohammed Ali"
              />
              <FormField
                label="WhatsApp number"
                name="whatsapp"
                type="tel"
                required
                placeholder="+971 5X XXX XXXX"
              />
              <div className="md:col-span-2">
                <label htmlFor="who" className="label">
                  I am a… <span className="text-signal ml-1">*</span>
                </label>
                <select
                  id="who"
                  name="who"
                  required
                  defaultValue=""
                  className="field"
                >
                  <option value="" disabled>
                    Pick the closest fit…
                  </option>
                  <option>Driver looking for a garage</option>
                  <option>Garage owner / manager</option>
                  <option>Investor</option>
                  <option>Journalist / press</option>
                  <option>Partner / supplier</option>
                  <option>Just curious</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label htmlFor="message" className="label">
                  Anything you want us to know?{' '}
                  <span className="text-ash/70">(optional)</span>
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={3}
                  placeholder="One sentence is enough."
                  className="field resize-none"
                />
              </div>
              <div className="md:col-span-2">
                <button type="submit" className="pill-primary w-full md:w-auto">
                  Send
                </button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ───────────────── 15. FOOTER ───────────────── */}
      <footer className="pt-20 pb-10 bg-paper border-t border-seam">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-[1.4fr_repeat(3,1fr)] gap-10 mb-12">
            <div className="flex flex-col gap-3">
              <div
                className="flex items-center gap-2.5 font-black text-[28px] text-leaf"
                style={{ letterSpacing: '-0.04em' }}
              >
                <VehkitMark size={32} />
                <span>vehkit</span>
              </div>
              <p className="text-[14px] font-medium leading-[1.5] max-w-[34ch] text-mute">
                Verified garages. Verified reviews. Helping UAE drivers
                choose with confidence.
              </p>
            </div>
            <FooterCol
              heading="Drivers"
              links={[
                { label: 'Browse garages', href: '/workshops' },
                { label: 'Sign in', href: '/login' },
                { label: 'My account', href: '/mycars' },
                { label: 'How ratings work', href: '/score' },
              ]}
            />
            <FooterCol
              heading="Garages"
              links={[
                { label: 'Why Vehkit', href: '/workshop/start' },
                { label: 'Claim a workshop', href: '/workshop/claim' },
                { label: 'Book a demo', href: '#callback' },
              ]}
            />
            <FooterCol
              heading="Company"
              links={[
                { label: 'Privacy', href: '/privacy' },
                { label: 'Terms', href: '/terms' },
                { label: 'Contact', href: 'mailto:hello@vehkit.com' },
              ]}
            />
          </div>
          <div
            className="flex justify-between pt-6 text-xs font-bold uppercase flex-wrap gap-2 border-t border-seam text-mute"
            style={{ letterSpacing: '0.18em' }}
          >
            <span>© {new Date().getFullYear()} Vehkit</span>
            <span>Verified garages. Verified reviews.</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function Kicker({
  children,
  tone = 'light',
}: {
  children: React.ReactNode
  tone?: 'light' | 'dark'
}) {
  const colour = tone === 'dark' ? 'text-chalk/60' : 'text-mute'
  return (
    <p
      className={`text-[11px] md:text-[12px] font-bold uppercase ${colour}`}
      style={{ letterSpacing: '0.32em' }}
    >
      {children}
    </p>
  )
}

/**
 * Subtle "ambient paint" gradient for dark sections — two low-opacity
 * radial blobs that give the noir surface depth without the flat-black
 * feel. Kendal.ai uses the same treatment in every dark panel.
 *
 * Placements:
 *   left-right — leaf blob from top-left, wallet blob from bottom-right
 *   right-left — mirrored (leaf top-right, wallet bottom-left)
 *   banner     — leaf-only, low and wide, for thin banner sections
 */
function AmbientGradient({
  placement,
}: {
  placement: 'left-right' | 'right-left' | 'banner'
}) {
  if (placement === 'banner') {
    return (
      <div
        aria-hidden
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse 1100px 280px at 15% 110%, rgb(var(--leaf) / 0.28), transparent 65%),
            radial-gradient(ellipse 900px 240px at 85% -10%, rgb(var(--wallet) / 0.18), transparent 65%)
          `,
        }}
      />
    )
  }

  const leafX = placement === 'left-right' ? '10%' : '90%'
  const walletX = placement === 'left-right' ? '90%' : '10%'

  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        background: `
          radial-gradient(ellipse 800px 600px at ${leafX} 15%, rgb(var(--leaf) / 0.30), transparent 60%),
          radial-gradient(ellipse 700px 500px at ${walletX} 95%, rgb(var(--wallet) / 0.18), transparent 60%)
        `,
      }}
    />
  )
}

function FeatureCard({
  title,
  body,
  mockType,
}: {
  title: string
  body: string
  mockType: 'ratings' | 'booking'
}) {
  return (
    <div className="rounded-3xl p-8 md:p-10 bg-carbon border border-seam flex flex-col gap-5 min-h-[480px]">
      {mockType === 'ratings' ? <RatingsMock /> : <BookingMock />}
      <h3
        className="font-black text-[26px] md:text-[30px] leading-[1.1] text-ink mt-2"
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h3>
      <p className="text-[15px] leading-[1.6] font-medium text-mute">
        {body}
      </p>
    </div>
  )
}

function RatingsMock() {
  return (
    <div className="card p-5 md:p-6 border border-seam bg-paper">
      <p className="text-[10px] tracking-widest uppercase text-mute">
        Verified review
      </p>
      <div className="flex items-center gap-2 mt-2">
        <Stars n={5} />
        <span className="text-xs text-mute">Tied to job · 14 Nov</span>
      </div>
      <p className="text-sm text-ink mt-3 leading-snug">
        &ldquo;Quick, fair, explained everything. Will be coming back.&rdquo;
      </p>
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-seam">
        <span className="w-7 h-7 rounded-pill bg-leaf/15 text-leaf grid place-items-center font-mono text-[11px] font-semibold">
          AS
        </span>
        <span className="text-xs font-semibold text-ink">Ahmed S.</span>
        <span className="text-[10px] text-mute">· Toyota Land Cruiser</span>
      </div>
    </div>
  )
}

function BookingMock() {
  return (
    <div className="card p-5 md:p-6 border border-seam bg-paper">
      <p className="text-[10px] tracking-widest uppercase text-mute">
        New booking
      </p>
      <p className="text-base font-semibold text-ink mt-2">Brake inspection</p>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-mute">Date</p>
          <p className="font-semibold text-ink mt-1">Tomorrow, 10am</p>
        </div>
        <div>
          <p className="text-[10px] tracking-widest uppercase text-mute">Car</p>
          <p className="font-semibold text-ink mt-1">2021 Land Cruiser</p>
        </div>
      </div>
      <div className="flex gap-2 mt-4 pt-4 border-t border-seam">
        <span className="text-[10px] tracking-widest uppercase bg-leaf/20 text-leaf px-3 py-1.5 rounded-pill font-semibold">
          Accept
        </span>
        <span className="text-[10px] tracking-widest uppercase border border-seam text-mute px-3 py-1.5 rounded-pill font-semibold">
          Decline
        </span>
      </div>
    </div>
  )
}

function HeroGarageMock({ garage }: { garage: DirectoryRow | null }) {
  const name = garage?.name ?? 'Al Quoz Auto Care'
  const emirate = garage?.emirate ?? 'Dubai'
  const rating =
    garage?.avg_rating != null ? Number(garage.avg_rating).toFixed(1) : '4.9'
  const reviewCount = garage?.review_count ?? 47
  const tier = garage?.verification_tier ?? 'gold'

  return (
    <div className="relative">
      {/* Hero photo — real garage. Unsplash CDN, served with width hint. */}
      <div
        className="relative aspect-[4/5] rounded-3xl overflow-hidden bg-iron"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1632823469850-2f77dd9c7f93?w=900&q=80&auto=format&fit=crop"
          alt="Mechanic working on a car in a workshop"
          className="absolute inset-0 w-full h-full object-cover"
        />
        {/* Soft bottom gradient so the floating card is readable */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-2/3 pointer-events-none"
          style={{
            background:
              'linear-gradient(to top, rgb(10 10 11 / 0.7) 10%, transparent 90%)',
          }}
        />

        {/* Floating verified-garage card overlaying the photo bottom */}
        <div className="absolute left-4 right-4 bottom-4 md:left-5 md:right-5 md:bottom-5">
          <div className="card p-4 md:p-5 bg-paper border border-seam shadow-card">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[10px] font-extrabold uppercase ${
                  tier === 'gold'
                    ? 'bg-wallet/[0.18] text-wallet'
                    : 'bg-mute/[0.12] text-mute'
                }`}
                style={{ letterSpacing: '0.16em' }}
              >
                {tier === 'gold' ? '★ Gold verified' : '✓ Silver verified'}
              </span>
              <span className="inline-flex items-center gap-1 text-sm font-bold text-ink">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" className="text-wallet" aria-hidden>
                  <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
                </svg>
                <span className="font-mono tabular-nums">{rating}</span>
                <span className="text-mute text-xs">({reviewCount})</span>
              </span>
            </div>
            <h3
              className="font-black mt-3 text-ink"
              style={{ fontSize: 20, letterSpacing: '-0.025em', lineHeight: 1.15 }}
            >
              {name}
            </h3>
            <p className="text-xs text-mute mt-1">{emirate}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function AllInOneMock() {
  return (
    <div className="grid grid-cols-2 gap-3 max-w-[480px] mx-auto">
      <div className="card p-4 bg-paper border border-seam aspect-square flex flex-col justify-between">
        <p className="text-[10px] tracking-widest uppercase text-mute">Discovery</p>
        <p className="text-2xl font-black text-ink" style={{ letterSpacing: '-0.03em' }}>
          50+ garages
        </p>
        <p className="text-[11px] text-mute">By area, rating, service</p>
      </div>
      <div className="card p-4 bg-leaf text-white aspect-square flex flex-col justify-between">
        <p className="text-[10px] tracking-widest uppercase text-white/80">Booking</p>
        <p className="text-2xl font-black" style={{ letterSpacing: '-0.03em' }}>
          2 taps
        </p>
        <p className="text-[11px] text-white/80">In-app, instant</p>
      </div>
      <div className="card p-4 bg-noir text-chalk aspect-square flex flex-col justify-between dark">
        <p className="text-[10px] tracking-widest uppercase text-chalk/60">Service</p>
        <p className="text-2xl font-black" style={{ letterSpacing: '-0.03em' }}>
          Verified
        </p>
        <p className="text-[11px] text-chalk/70">Workshop attests</p>
      </div>
      <div className="card p-4 bg-paper border border-seam aspect-square flex flex-col justify-between">
        <p className="text-[10px] tracking-widest uppercase text-mute">Rating</p>
        <p className="text-2xl font-black text-ink" style={{ letterSpacing: '-0.03em' }}>
          1-tap
        </p>
        <p className="text-[11px] text-mute">When work is done</p>
      </div>
    </div>
  )
}

function GarageDashboardMock() {
  return (
    <div className="card p-6 bg-paper border border-seam max-w-md mx-auto">
      <p className="text-[10px] tracking-widest uppercase text-mute">
        Garage dashboard
      </p>
      <h4 className="text-lg font-bold text-ink mt-2">New bookings · 3</h4>

      <ul className="mt-4 divide-y divide-seam">
        {[
          { name: 'Brake inspection', meta: 'Tomorrow · Ahmed S.' },
          { name: 'Oil & filter change', meta: 'Wed · Priya R.' },
          { name: 'AC repair', meta: 'Thu · Marwan A.' },
        ].map((b) => (
          <li key={b.name} className="py-3 flex items-center gap-3">
            <span className="w-2 h-2 rounded-pill bg-leaf shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-ink">{b.name}</p>
              <p className="text-[11px] text-mute">{b.meta}</p>
            </div>
            <span className="text-[10px] tracking-widest uppercase bg-leaf/20 text-leaf px-2 py-1 rounded-pill font-semibold">
              Accept
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-5 pt-5 border-t border-seam grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-[10px] tracking-widest uppercase text-mute">
            This week
          </p>
          <p className="text-lg font-bold text-ink mt-1 font-mono tabular-nums">
            12
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-widest uppercase text-mute">
            Rating
          </p>
          <p className="text-lg font-bold text-ink mt-1 font-mono tabular-nums">
            4.8★
          </p>
        </div>
        <div>
          <p className="text-[10px] tracking-widest uppercase text-mute">
            Reviews
          </p>
          <p className="text-lg font-bold text-ink mt-1 font-mono tabular-nums">
            47
          </p>
        </div>
      </div>
    </div>
  )
}

function TestimonialCard({
  body,
  name,
  role,
}: {
  body: string
  name: string
  role: string
}) {
  return (
    <div className="rounded-3xl p-7 bg-carbon border border-seam flex flex-col gap-5 min-h-[260px]">
      <Stars n={5} />
      <p className="text-[16px] leading-[1.55] text-ink font-medium flex-1">
        &ldquo;{body}&rdquo;
      </p>
      <div className="flex items-center gap-3 pt-4 border-t border-seam">
        <span className="w-10 h-10 rounded-pill bg-leaf/15 text-leaf grid place-items-center font-mono text-sm font-bold">
          {name
            .split(' ')
            .map((s) => s[0])
            .slice(0, 2)
            .join('')}
        </span>
        <div>
          <p className="text-sm font-semibold text-ink">{name}</p>
          <p className="text-xs text-mute">{role}</p>
        </div>
      </div>
    </div>
  )
}

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5" aria-label={`${n} of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg
          key={i}
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill={i < n ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth={i < n ? 0 : 2}
          className="text-wallet"
          aria-hidden
        >
          <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
        </svg>
      ))}
    </div>
  )
}

function BenefitCard({
  icon,
  title,
  body,
}: {
  icon: 'search' | 'calendar' | 'phone' | 'shield' | 'chart' | 'lock'
  title: string
  body: string
}) {
  return (
    <div className="rounded-3xl p-7 md:p-8 bg-carbon border border-seam flex flex-col gap-3 min-h-[200px]">
      <div className="w-12 h-12 rounded-2xl bg-leaf-50 text-leaf-dk grid place-items-center mb-2">
        <BenefitIcon name={icon} />
      </div>
      <h3
        className="font-black text-[22px] leading-tight text-ink"
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h3>
      <p className="text-[15px] leading-[1.55] font-medium text-mute">
        {body}
      </p>
    </div>
  )
}

function BenefitIcon({ name }: { name: string }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'search')
    return (
      <svg {...common}>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </svg>
    )
  if (name === 'calendar')
    return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="8" y1="3" x2="8" y2="7" />
        <line x1="16" y1="3" x2="16" y2="7" />
      </svg>
    )
  if (name === 'phone')
    return (
      <svg {...common}>
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
      </svg>
    )
  if (name === 'shield')
    return (
      <svg {...common}>
        <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    )
  if (name === 'chart')
    return (
      <svg {...common}>
        <line x1="12" y1="20" x2="12" y2="10" />
        <line x1="18" y1="20" x2="18" y2="4" />
        <line x1="6" y1="20" x2="6" y2="16" />
      </svg>
    )
  // lock
  return (
    <svg {...common}>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function ChipIcon({ label }: { label: string }) {
  // Rendered inside a .dark section — uses semi-transparent chalk surface
  // for a glassy contrast on the noir background.
  return (
    <div className="rounded-2xl p-4 bg-chalk/[0.04] border border-chalk/10 flex flex-col items-center justify-center gap-2 min-h-[90px] backdrop-blur-sm">
      <span className="w-6 h-6 rounded-pill bg-leaf/20 text-leaf grid place-items-center">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <polyline points="4 12 10 18 20 6" />
        </svg>
      </span>
      <p className="text-[11px] font-bold text-chalk text-center leading-tight">
        {label}
      </p>
    </div>
  )
}

function BigNumber({ n, l }: { n: string; l: string }) {
  return (
    <div className="bg-paper p-6 md:p-7 text-center">
      <p
        className="font-black text-ink"
        style={{
          fontSize: 'clamp(28px,3.5vw,44px)',
          letterSpacing: '-0.04em',
          lineHeight: 1,
        }}
      >
        {n}
      </p>
      <p className="text-[11px] tracking-widest uppercase text-mute mt-2 font-bold">
        {l}
      </p>
    </div>
  )
}

function FAQItem({ q, a }: { q: string; a: string }) {
  return (
    <li>
      <details className="group bg-paper border border-seam rounded-2xl overflow-hidden">
        <summary className="cursor-pointer p-6 flex items-center justify-between gap-4 text-base md:text-lg font-bold text-ink list-none">
          <span dangerouslySetInnerHTML={{ __html: q }} />
          <span className="text-leaf transition-transform group-open:rotate-45">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </span>
        </summary>
        <p
          className="px-6 pb-6 text-[15px] leading-[1.6] text-mute"
          dangerouslySetInnerHTML={{ __html: a }}
        />
      </details>
    </li>
  )
}

function FormField({
  label,
  name,
  type = 'text',
  required,
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  placeholder?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required && <span className="text-signal ml-1">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="field"
      />
    </div>
  )
}

function FooterCol({
  heading,
  links,
}: {
  heading: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h5
        className="text-[11px] font-extrabold uppercase mb-3 text-mute"
        style={{ letterSpacing: '0.22em' }}
      >
        {heading}
      </h5>
      <ul className="flex flex-col gap-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[14px] font-semibold text-ink hover:text-leaf-dk transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
