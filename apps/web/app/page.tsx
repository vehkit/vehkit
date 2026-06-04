import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { VehkitMark } from '@/components/VehkitMark'

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
 * Landing page — garage-discovery first.
 *
 * Hero: "Find a great garage." Primary CTA leads to /workshops directory.
 * Live verified-workshop grid right under the hero proves it's real.
 * Three customer steps (find → book/visit → rate) explains the loop.
 * Trust section explains why ratings are honest (anchored to real work).
 * Workshop CTA at the bottom for the b2b side.
 *
 * Same brand tokens (paper / ink / leaf / volt / wallet) — no hardcoded
 * hex. Light theme via `.light` wrapper so AppNav-dark stays dark.
 */
export default async function Home() {
  const supabase = await createClient()
  const [
    {
      data: { user },
    },
    { data: directoryRaw },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('public_workshop_directory', { p_limit: 8, p_offset: 0 }),
  ])

  const directory = ((directoryRaw as DirectoryRow[]) ?? []).filter(
    (w) => w.verification_tier === 'gold' || w.verification_tier === 'silver',
  )
  const gridWorkshops = directory.slice(0, 6)
  const networkCount = directory.length

  return (
    <main className="light min-h-[100svh] bg-paper text-ink font-sans">
      {/* ─── Top nav ─── */}
      <header
        className="sticky top-0 z-50 backdrop-blur border-b border-seam"
        style={{ background: 'rgb(var(--noir) / 0.85)' }}
      >
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 flex items-center gap-8 h-[72px]">
          <Link
            href="/"
            className="flex items-center gap-2.5 font-extrabold text-[22px] text-leaf"
            style={{ letterSpacing: '-0.04em' }}
          >
            <VehkitMark size={30} />
            <span>vehkit</span>
          </Link>
          <nav className="hidden md:flex gap-7 text-sm font-semibold text-ink">
            <Link href="/workshops" className="hover:text-leaf-dk transition-colors">
              Find a garage
            </Link>
            <Link href="#how" className="hover:text-leaf-dk transition-colors">
              How it works
            </Link>
            <Link href="#trust" className="hover:text-leaf-dk transition-colors">
              Our rating
            </Link>
            <Link href="/workshop/start" className="hover:text-leaf-dk transition-colors">
              For garages
            </Link>
          </nav>
          <span className="flex-1" />
          <Link
            href={user ? '/mycars' : '/login'}
            className="hidden sm:inline-flex items-center h-[42px] px-[18px] rounded-pill font-bold text-sm whitespace-nowrap border border-seam text-ink hover:bg-iron transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            {user ? 'My account' : 'Sign in'}
          </Link>
          <Link
            href="/workshops"
            className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm whitespace-nowrap bg-leaf text-white hover:bg-leaf-dk transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            Browse garages <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="py-16 md:py-24 overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <p
            className="text-[11px] font-bold uppercase text-mute"
            style={{ letterSpacing: '0.32em' }}
          >
            For UAE drivers · free
          </p>
          <h1
            className="font-black mt-4 mb-7 text-ink max-w-[14ch]"
            style={{
              fontSize: 'clamp(56px,8vw,128px)',
              lineHeight: 0.92,
              letterSpacing: '-0.045em',
            }}
          >
            Find a{' '}
            <span className="relative inline-block text-leaf">
              great
              <span
                aria-hidden
                className="absolute bg-leaf-50 -z-10"
                style={{
                  left: '-2%',
                  right: '-2%',
                  bottom: '0.04em',
                  height: '0.42em',
                  borderRadius: 6,
                }}
              />
            </span>{' '}
            garage.
          </h1>
          <p
            className="text-[19px] md:text-[22px] leading-[1.5] font-medium mb-3 max-w-[700px] text-ink"
          >
            Real customers. Real ratings.
          </p>
          <p className="text-[17px] leading-[1.55] font-medium mb-9 max-w-[640px] text-mute">
            Every star comes from a real job done at the garage — no
            anonymous reviews, no fake five-stars. Search verified UAE
            workshops by rating, area, and what you need fixed.
          </p>
          <div className="flex gap-3 items-center flex-wrap">
            <Link
              href="/workshops"
              className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base bg-leaf text-white hover:bg-leaf-dk transition-colors"
              style={{ letterSpacing: '-0.01em' }}
            >
              Browse verified garages <span aria-hidden>→</span>
            </Link>
            <Link
              href="#how"
              className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base border border-seam text-ink hover:bg-iron transition-colors"
              style={{ letterSpacing: '-0.01em' }}
            >
              How it works <span aria-hidden>↓</span>
            </Link>
          </div>
          <div className="mt-10 flex gap-9 items-center flex-wrap">
            <Stat n={networkCount.toString()} l="Verified workshops" />
            <span className="hidden sm:inline-block w-px h-9 bg-seam" />
            <Stat n="100%" l="Real-job ratings" />
            <span className="hidden sm:inline-block w-px h-9 bg-seam" />
            <Stat n="7" l="UAE emirates covered" />
          </div>
        </div>
      </section>

      {/* ─── Live workshop grid — proof it's real ─── */}
      {gridWorkshops.length > 0 && (
        <section className="py-16 md:py-20 bg-carbon border-t border-b border-seam">
          <div className="max-w-[1240px] mx-auto px-6 md:px-10">
            <div className="flex items-end justify-between gap-6 mb-10 flex-wrap">
              <div>
                <p
                  className="text-[11px] font-bold uppercase text-mute"
                  style={{ letterSpacing: '0.32em' }}
                >
                  Featured this week
                </p>
                <h2
                  className="font-black mt-3 text-ink"
                  style={{
                    fontSize: 'clamp(32px,4.5vw,56px)',
                    lineHeight: 0.96,
                    letterSpacing: '-0.04em',
                  }}
                >
                  Top-rated garages on Vehkit
                </h2>
              </div>
              <Link
                href="/workshops"
                className="text-sm font-bold text-leaf-dk hover:text-leaf transition-colors inline-flex items-center gap-1.5"
              >
                See all {networkCount} workshops →
              </Link>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {gridWorkshops.map((w) => (
                <WorkshopCard key={w.id} w={w} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── How it works (3 steps, customer POV) ─── */}
      <section id="how" className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <SectionHead
            eyebrow="How it works"
            title={
              <>
                Three steps. From <em className="not-italic text-leaf">stranger to regular.</em>
              </>
            }
            right="Whether you're looking for a new garage or want your usual mechanic to count — the loop is the same."
          />

          <div className="grid md:grid-cols-3 gap-6">
            <Step
              n="01"
              title="Find a garage"
              body="Browse verified workshops by area, rating, and what you need fixed. Open a profile to see real reviews from real jobs done."
            />
            <Step
              n="02"
              title="Visit or book"
              body="Book a visit through the app — the workshop confirms. Or just walk in. Either way, they give you a 6-digit code that registers the job to your account."
            />
            <Step
              n="03"
              title="Rate when done"
              body="When the workshop marks the job complete, you get a one-tap rating. Your star counts toward their public score, anchored to the real work they did for you."
            />
          </div>
        </div>
      </section>

      {/* ─── Trust angle (replaces "problem") ─── */}
      <section id="trust" className="py-24 md:py-[120px] bg-iron">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <SectionHead
            eyebrow="Why our ratings are different"
            title={
              <>
                No fake stars. <em className="not-italic text-leaf">No bought reviews.</em>
              </>
            }
            right="Every review on Vehkit is tied to a verified service entry the workshop attested. To leave a fake review, someone would need a fake job — and the garage has to confirm it. That's the moat."
          />

          <div className="grid md:grid-cols-3 gap-4">
            <TrustCard
              num="01"
              title="Real customers only"
              body="To rate a garage, you must have had work done there — verified by a one-time 6-digit code the garage hands you in person."
            />
            <TrustCard
              num="02"
              title="Real work only"
              body="The job is logged with date, kilometres, service type, and (optionally) cost. Reviews live alongside the receipt, not in a vacuum."
            />
            <TrustCard
              num="03"
              title="Locked in 24 hours"
              body="Workshop entries become immutable after a one-day retract window. Garages can't erase a bad review or sanitise their history."
            />
          </div>
        </div>
      </section>

      {/* ─── For garages (b2b CTA) ─── */}
      <section className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="dark rounded-[36px] p-10 md:p-16 grid md:grid-cols-[1.4fr_1fr] gap-10 items-center bg-noir text-chalk relative overflow-hidden">
            <div
              aria-hidden
              className="absolute pointer-events-none"
              style={{
                right: -160,
                top: -160,
                width: 520,
                height: 520,
                borderRadius: '50%',
                background:
                  'radial-gradient(circle at center, rgb(var(--leaf) / 0.22), transparent 65%)',
              }}
            />
            <div className="relative">
              <p
                className="text-[11px] font-bold uppercase text-chalk/55"
                style={{ letterSpacing: '0.32em' }}
              >
                Run a garage?
              </p>
              <h2
                className="font-black mt-3.5 text-chalk"
                style={{
                  fontSize: 'clamp(36px,5vw,72px)',
                  lineHeight: 0.96,
                  letterSpacing: '-0.04em',
                  maxWidth: '18ch',
                }}
              >
                Free leads. Free CRM. <em className="not-italic text-leaf">Free for life.</em>
              </h2>
              <p
                className="text-[17px] mt-6 leading-relaxed text-chalk/80 max-w-[48ch]"
              >
                Claim your shop. Get found by new customers via verified
                ratings. Track your pipeline. Send service reminders. We
                don't take a cut of your jobs, we don't sell ads to your
                competitors, and we don't charge you for the dashboard.
              </p>
            </div>
            <div className="relative flex flex-col gap-3.5 md:items-end">
              <Link
                href="/workshop/start"
                className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base bg-leaf text-white hover:bg-leaf-dk transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                Claim your garage <span aria-hidden>→</span>
              </Link>
              <Link
                href="/workshops"
                className="text-sm tracking-wide text-chalk/70 hover:text-chalk transition-colors"
              >
                Browse the directory first
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="pb-24 md:pb-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 text-center">
          <p
            className="text-[11px] font-bold uppercase text-mute"
            style={{ letterSpacing: '0.32em' }}
          >
            Ready when you are
          </p>
          <h2
            className="font-black mt-3.5 text-ink mx-auto"
            style={{
              fontSize: 'clamp(36px,5vw,72px)',
              lineHeight: 0.96,
              letterSpacing: '-0.04em',
              maxWidth: '18ch',
            }}
          >
            Stop guessing. <em className="not-italic text-leaf">Start with a great garage.</em>
          </h2>
          <p className="text-base text-mute mt-6 leading-relaxed max-w-md mx-auto">
            Browse the directory free. No signup needed to look.
          </p>
          <div className="mt-10">
            <Link
              href="/workshops"
              className="inline-flex items-center gap-2 h-[48px] px-6 rounded-pill font-bold text-base bg-leaf text-white hover:bg-leaf-dk transition-colors"
              style={{ letterSpacing: '-0.01em' }}
            >
              Browse verified garages <span aria-hidden>→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="pt-16 pb-10 bg-paper border-t border-seam">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-[1.4fr_repeat(3,1fr)] gap-10 mb-10">
            <div className="flex flex-col gap-3">
              <div
                className="flex items-center gap-2.5 font-black text-[28px] text-leaf"
                style={{ letterSpacing: '-0.04em' }}
              >
                <VehkitMark size={36} />
                <span>vehkit</span>
              </div>
              <p
                className="text-[14px] font-medium leading-[1.5] max-w-[30ch] text-mute"
              >
                Find a great garage. Real customers. Real ratings.
              </p>
            </div>
            <FooterCol
              heading="Customers"
              links={[
                { label: 'Browse garages', href: '/workshops' },
                { label: 'Sign in / sign up', href: '/login' },
                { label: 'My account', href: '/mycars' },
              ]}
            />
            <FooterCol
              heading="Garages"
              links={[
                { label: 'Why Vehkit', href: '/workshop/start' },
                { label: 'Claim a workshop', href: '/workshop/claim' },
                { label: 'Sign in', href: '/login?next=/workshop' },
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
            <span>Real customers. Real ratings.</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

// ===========================================================================
// Subcomponents
// ===========================================================================

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <div>
      <div
        className="font-black text-[30px] text-ink"
        style={{ letterSpacing: '-0.03em' }}
      >
        {n}
      </div>
      <div
        className="text-[11px] font-bold uppercase mt-0.5 text-mute"
        style={{ letterSpacing: '0.22em' }}
      >
        {l}
      </div>
    </div>
  )
}

function SectionHead({
  eyebrow,
  title,
  right,
}: {
  eyebrow: string
  title: React.ReactNode
  right?: string
}) {
  return (
    <div className="mb-14 grid lg:grid-cols-2 gap-8 lg:gap-12 items-end">
      <div>
        <p
          className="text-[11px] font-bold uppercase text-mute"
          style={{ letterSpacing: '0.32em' }}
        >
          {eyebrow}
        </p>
        <h2
          className="font-black mt-3.5 text-ink"
          style={{
            fontSize: 'clamp(36px,5vw,68px)',
            lineHeight: 0.98,
            letterSpacing: '-0.04em',
            maxWidth: '20ch',
          }}
        >
          {title}
        </h2>
      </div>
      {right && (
        <div className="text-[15px] leading-[1.6] font-medium text-mute">
          <p>{right}</p>
        </div>
      )}
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div
      className="p-9 rounded-3xl flex flex-col gap-4 bg-carbon border border-seam"
      style={{ minHeight: 240 }}
    >
      <div
        className="w-14 h-14 rounded-2xl grid place-items-center font-black text-2xl bg-leaf-50 text-leaf-dk"
        style={{ letterSpacing: '-0.04em' }}
      >
        {n}
      </div>
      <h3
        className="font-black text-[24px] leading-[1.1] m-0 text-ink"
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h3>
      <p className="text-[15px] leading-[1.55] font-medium m-0 text-mute">
        {body}
      </p>
    </div>
  )
}

function TrustCard({
  num,
  title,
  body,
}: {
  num: string
  title: string
  body: string
}) {
  return (
    <div className="p-7 md:p-8 rounded-3xl bg-paper border border-seam flex flex-col gap-3">
      <p className="font-mono text-[11px] text-leaf-dk tracking-[0.04em] font-bold">
        {num}
      </p>
      <h3
        className="font-black text-[22px] leading-tight m-0 text-ink"
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h3>
      <p className="text-[15px] leading-[1.55] font-medium m-0 text-mute">
        {body}
      </p>
    </div>
  )
}

function WorkshopCard({ w }: { w: DirectoryRow }) {
  const tier = w.verification_tier
  const tierClass =
    tier === 'gold'
      ? 'bg-wallet/[0.18] text-wallet'
      : 'bg-mute/[0.12] text-mute'
  const rating = w.avg_rating != null ? Number(w.avg_rating).toFixed(1) : null
  return (
    <Link
      href={`/w/${w.slug}`}
      className="rounded-2xl p-6 flex flex-col gap-3.5 transition-all hover:-translate-y-[3px] bg-carbon border border-seam"
      style={{ minHeight: 200 }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[10px] font-extrabold uppercase whitespace-nowrap ${tierClass}`}
          style={{ letterSpacing: '0.16em' }}
        >
          {tier === 'gold' ? '✓ Gold' : '✓ Silver'}
        </span>
        {rating && (
          <span className="inline-flex items-center gap-1 text-sm font-bold text-ink">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-wallet"
              aria-hidden
            >
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
            </svg>
            <span className="font-mono tabular-nums">{rating}</span>
            <span className="text-mute text-xs">
              ({w.review_count})
            </span>
          </span>
        )}
      </div>
      <h4
        className="font-extrabold text-[18px] leading-tight m-0 text-ink"
        style={{ letterSpacing: '-0.02em' }}
      >
        {w.name}
      </h4>
      <span className="text-[13px] font-semibold text-mute">
        {w.emirate ?? 'UAE'}
      </span>
      <div
        className="mt-auto flex justify-between items-center pt-3 text-[11px] font-bold uppercase border-t border-seam text-mute"
        style={{ letterSpacing: '0.18em' }}
      >
        <span>Verified jobs</span>
        <b
          className="text-ink"
          style={{ fontWeight: 800, letterSpacing: '-0.01em', textTransform: 'none', fontSize: 13 }}
        >
          {w.total_entries}
        </b>
      </div>
    </Link>
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
        className="text-[11px] font-extrabold uppercase mb-3 m-0 text-mute"
        style={{ letterSpacing: '0.22em' }}
      >
        {heading}
      </h5>
      <ul className="list-none p-0 m-0 flex flex-col gap-2">
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
