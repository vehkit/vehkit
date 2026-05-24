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
  avg_rating: number
  review_count: number
}

/**
 * Landing page — restored from the canonical Claude-designed mock
 * (uploads/index.html). Light-theme editorial layout with paper/ink/leaf
 * palette and dark inset panels for Score and Final CTA.
 *
 * Wrapped in `<main className="light">` so the page renders in light theme
 * regardless of the user's app-wide theme preference. All colours come
 * through the brand tokens (paper, ink, mute, leaf, leaf-50, volt, wallet,
 * signal, seam) — zero hardcoded hex.
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
  const stripWorkshops = directory.slice(0, 5)
  const gridWorkshops = directory.slice(0, 4)
  const ctaPrimaryHref = user ? '/vehicles/new' : '/login?next=/vehicles/new'

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
            <Link href="#how" className="hover:text-leaf-dk transition-colors">
              How it works
            </Link>
            <Link href="#score" className="hover:text-leaf-dk transition-colors">
              The score
            </Link>
            <Link href="#workshops" className="hover:text-leaf-dk transition-colors">
              Workshops
            </Link>
            <Link href="#who" className="hover:text-leaf-dk transition-colors">
              Who it&apos;s for
            </Link>
          </nav>
          <span className="flex-1" />
          <Link
            href="/workshop/start"
            className="hidden lg:inline-flex text-[11px] font-bold uppercase whitespace-nowrap text-mute hover:text-ink transition-colors"
            style={{ letterSpacing: '0.18em' }}
          >
            For workshops
          </Link>
          <Link
            href="/agent/start"
            className="hidden lg:inline-flex text-[11px] font-bold uppercase whitespace-nowrap text-mute hover:text-ink transition-colors"
            style={{ letterSpacing: '0.18em' }}
          >
            For agents
          </Link>
          <Link
            href={user ? '/mycars' : '/login'}
            className="hidden sm:inline-flex items-center h-[42px] px-[18px] rounded-pill font-bold text-sm whitespace-nowrap border border-seam text-ink hover:bg-iron transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            {user ? 'My cars' : 'Sign in'}
          </Link>
          <Link
            href={ctaPrimaryHref}
            className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm whitespace-nowrap bg-leaf text-white hover:bg-leaf-dk transition-colors"
            style={{ letterSpacing: '-0.01em' }}
          >
            Start your first car <span aria-hidden>→</span>
          </Link>
        </div>
      </header>

      {/* ─── Hero ─── */}
      <section className="py-16 md:py-24 overflow-hidden">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10 grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p
              className="text-[11px] font-bold uppercase text-mute"
              style={{ letterSpacing: '0.32em' }}
            >
              For UAE car owners · free
            </p>
            <h1
              className="font-black mt-4 mb-7 text-ink"
              style={{
                fontSize: 'clamp(56px,8vw,128px)',
                lineHeight: 0.92,
                letterSpacing: '-0.045em',
              }}
            >
              Every car
              <br />
              deserves
              <br />
              a&nbsp;
              <span className="relative inline-block text-leaf">
                passport.
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
              </span>
            </h1>
            <p
              className="text-[19px] leading-[1.5] font-medium mb-9 max-w-[560px] text-mute"
            >
              Keep every service receipt, mulkiya and insurance doc in one
              place.{' '}
              <b className="text-ink font-bold">
                We&apos;ll remind you before anything expires.
              </b>{' '}
              When you sell, the buyer sees the full history.
            </p>
            <div className="flex gap-3 items-center flex-wrap">
              <Link
                href={ctaPrimaryHref}
                className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm bg-leaf text-white hover:bg-leaf-dk transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                Add your first car — free <span aria-hidden>→</span>
              </Link>
              <Link
                href="#how"
                className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm border border-seam text-ink hover:bg-iron transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                See how it works <span aria-hidden>↓</span>
              </Link>
            </div>
            <div className="mt-9 flex gap-9 items-center flex-wrap">
              <Stat n="2 min" l="To set up" />
              <span className="hidden sm:inline-block w-px h-9 bg-seam" />
              <Stat n="Auto" l="Renewal reminders" />
              <span className="hidden sm:inline-block w-px h-9 bg-seam" />
              <Stat n="Free" l="1 car, forever" />
            </div>
          </div>

          <PassportMockup />
        </div>
      </section>

      {/* ─── Logo strip ─── */}
      {stripWorkshops.length > 0 && (
        <section className="py-9 bg-carbon border-t border-b border-seam">
          <div className="max-w-[1240px] mx-auto px-6 md:px-10 flex items-center gap-12 flex-wrap justify-between">
            <span
              className="text-[11px] font-bold uppercase text-mute"
              style={{ letterSpacing: '0.22em' }}
            >
              Workshop network · {directory.length}+ verified
            </span>
            <div
              className="flex gap-12 items-center flex-wrap text-lg font-extrabold text-mute"
              style={{ letterSpacing: '-0.02em' }}
            >
              {stripWorkshops.map((w) => (
                <span key={w.id} className="flex items-center gap-2">
                  <span className="inline-block w-1.5 h-1.5 rounded-pill bg-leaf" />
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── How it works (3 steps) ─── */}
      <section id="how" className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <SectionHead
            eyebrow="How it works"
            title={
              <>
                Three steps. About{' '}
                <em className="not-italic whitespace-nowrap text-leaf">
                  five minutes.
                </em>
              </>
            }
            right="No app to download. No credit card. Add your car once, then we do the remembering."
          />

          <div className="grid md:grid-cols-3 gap-6">
            <Step
              n="01"
              title="Add your car"
              body="Make, model, plate, current kilometres. About two minutes. We accept any UAE-registered vehicle — petrol, diesel, hybrid, electric."
            />
            <Step
              n="02"
              title="Add your stuff"
              body="Upload your mulkiya, insurance, and any service receipts you have. Or hand your workshop a six-digit code and let them log services for you."
            />
            <Step
              n="03"
              title="We do the rest"
              body="One morning email a month with what's expiring, what's due for service, and what kilometres you should be at. Selling? Share one link — the buyer sees everything."
            />
          </div>
        </div>
      </section>

      {/* ─── Problem ─── */}
      <section id="problem" className="py-24 md:py-[120px] bg-iron">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <SectionHead
            eyebrow="The problem"
            title={
              <>
                A used car is sold on trust — but trust{' '}
                <em className="not-italic whitespace-nowrap text-leaf">
                  isn&apos;t recorded.
                </em>
              </>
            }
            right="Service histories live in glove compartments, on workshop stickers, in WhatsApp threads. When a buyer asks what's been done, the seller hands over a folder, or a story."
          />

          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <ReceiptMockup />
            <div>
              <h3
                className="font-black text-3xl mb-4 text-ink"
                style={{ letterSpacing: '-0.03em', lineHeight: 1.15 }}
              >
                Folders fade. Stickers peel. Stories drift.
              </h3>
              <p
                className="text-[17px] leading-[1.6] font-medium text-mute"
              >
                The car you&apos;re about to buy might have a perfect record. It
                might have nothing. The handwritten receipt and the workshop
                sticker tell you nothing you can verify, and nothing that
                travels with the car.
              </p>
              <div
                className="mt-8 p-6 rounded-2xl flex gap-4 items-start bg-leaf-50 border border-leaf/15"
              >
                <VehkitMark size={36} />
                <div className="text-[15px] font-semibold leading-relaxed text-ink">
                  Vehkit is the alternative. Every service is logged once,
                  attested by the workshop that did the work, and locked into a
                  permanent record that follows the car from owner to owner.{' '}
                  <b className="text-leaf-dk">
                    No sticker. No folder. No story.
                  </b>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Principles ─── */}
      <section id="principles" className="py-24 md:py-[120px]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <SectionHead
            eyebrow="Principles"
            title={
              <>
                Four lines we{' '}
                <em className="not-italic whitespace-nowrap text-leaf">
                  don&apos;t cross.
                </em>
              </>
            }
            right="Trust is what we sell. These four constraints are how we earn it — and what we'll never trade away for growth, partnerships, or a bigger directory."
          />

          <div
            className="grid sm:grid-cols-2 gap-px rounded-3xl overflow-hidden bg-seam border border-seam"
          >
            <Principle
              num="01 · OWNER-CONTROLLED"
              icon="user"
              title="Your record. Your codes. Your share links."
              body="Workshops can attest entries; only you can publish, share, or revoke. No data leaves your account without an action you took."
            />
            <Principle
              num="02 · IMMUTABLE AFTER 24H"
              icon="lock"
              title="The record is what it was."
              body="Workshop entries lock after a one-day retract window. After that, neither you, nor the workshop, nor Vehkit can edit them. That's what makes it worth something at resale."
            />
            <Principle
              num="03 · VERIFIED BY TRADE LICENCE"
              icon="shield"
              title="The directory is curated, not pay-to-play."
              body="Silver requires a UAE trade licence and ten verified entries. Gold requires a hundred entries, a 4.5-star rating across at least five reviews, and the licence."
            />
            <Principle
              num="04 · PRIVACY AS DEFAULT"
              icon="globe"
              title="Workshops don't see your details."
              body="Email, phone, full name — never shared unless you explicitly enable workshop outreach. Buyers see only what your share link permits. We don't sell data. We don't run ads."
            />
          </div>
        </div>
      </section>

      {/* ─── Score (dark) ─── */}
      <section
        id="score"
        className="dark py-24 md:py-[120px] bg-noir text-chalk"
      >
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="mb-14 max-w-3xl">
            <p
              className="text-[11px] font-bold uppercase text-chalk/55"
              style={{ letterSpacing: '0.32em' }}
            >
              The vehkit score
            </p>
            <h2
              className="font-black mt-3.5 text-chalk"
              style={{
                fontSize: 'clamp(40px,5.4vw,76px)',
                lineHeight: 0.96,
                letterSpacing: '-0.04em',
                maxWidth: '24ch',
              }}
            >
              A number worth more than the{' '}
              <em className="not-italic text-leaf">photos.</em>
            </h2>
            <p
              className="text-[19px] leading-[1.55] font-medium mt-6 text-chalk/70"
              style={{ maxWidth: '62ch' }}
            >
              Think of it as a credit score — for your car. Every Vehkit car
              gets a 0–100 number that summarises how well it&apos;s been
              looked after. Verified service, on-time compliance, history
              continuity, and recency.
            </p>
          </div>

          <div className="grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-[72px] items-center">
            <ScoreVisualization />
            <div>
              <div
                className="grid grid-cols-[auto_1fr] gap-x-[22px] gap-y-[18px] text-[15px]"
                style={{ lineHeight: 1.55 }}
              >
                <ScoreRow
                  k="verification"
                  v="Each entry attested by a verified workshop counts. Owner-only entries count less."
                />
                <ScoreRow
                  k="compliance"
                  v="Service intervals met on time — kilometres or months, whichever comes first."
                />
                <ScoreRow
                  k="consistency"
                  v="No suspicious gaps, no missing odometer jumps, plausible workshop diversity."
                />
                <ScoreRow
                  k="recency"
                  v="A verified service in the last six months keeps the score live; older records decay."
                />
              </div>
              <Link
                href="/score"
                className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm text-white mt-8 bg-leaf hover:bg-leaf-dk transition-colors"
              >
                The methodology in detail <span aria-hidden>→</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Workshops ─── */}
      {gridWorkshops.length > 0 && (
        <section id="workshops" className="py-24 md:py-[120px]">
          <div className="max-w-[1240px] mx-auto px-6 md:px-10">
            <SectionHead
              eyebrow="Verified workshops on vehkit"
              title={
                <>
                  Real shops. Real{' '}
                  <em className="not-italic whitespace-nowrap text-leaf">
                    histories.
                  </em>
                </>
              }
              rightAction={
                <Link
                  href="/workshops"
                  className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm border border-seam text-ink hover:bg-iron transition-colors"
                >
                  Full directory <span aria-hidden>→</span>
                </Link>
              }
            />

            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-[18px]">
              {gridWorkshops.map((w) => (
                <WorkshopCard key={w.id} w={w} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── Audience ─── */}
      <section id="who" className="py-24 md:py-[120px] bg-iron">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <SectionHead
            eyebrow="Who vehkit is for"
            title={
              <>
                Three roles. One{' '}
                <em className="not-italic whitespace-nowrap text-leaf">
                  record.
                </em>
              </>
            }
            right="Every car has three lives — the person who drives it, the people who fix it, and whoever buys it next. Vehkit serves all three from the same passport."
          />

          <div className="grid md:grid-cols-3 gap-6">
            <AudienceCard
              variant="drive"
              who="If you drive"
              title="Track every wrench turn."
              body="Add a car, log a service, share the passport when it's time to sell. Workshops attest the entries you generate codes for. Reminders fire when you've earned a check-up. The record is yours forever."
              cta="Start your first car"
              href={user ? '/mycars' : '/login?next=/mycars'}
            />
            <AudienceCard
              variant="fix"
              who="If you fix"
              title="Build a verified portfolio."
              body="Customer hands you a six-digit code. Enter it. Log the service. Done. Every entry on the customer's record carries your name forever. Verified workshops climb the directory and earn Silver / Gold."
              cta="For workshops"
              href="/workshop/start"
            />
            <AudienceCard
              variant="buy"
              who="If you buy"
              title="See the truth before you sign."
              body="Sellers send you a passport link. You see every verified service, every workshop, every kilometre. A score from zero to a hundred summarises the history at a glance. No edits, no deletions, no story."
              cta="For buyers"
              href="/buyers"
            />
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="pb-24 md:pb-[120px] pt-12 md:pt-16">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div
            className="dark rounded-[36px] py-[72px] md:py-[88px] px-8 md:px-16 grid md:grid-cols-[1.4fr_1fr] gap-12 items-end relative overflow-hidden bg-noir text-chalk"
          >
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
                Get started — free
              </p>
              <h2
                className="font-black mt-3.5 text-chalk"
                style={{
                  fontSize: 'clamp(40px,5.6vw,80px)',
                  lineHeight: 0.96,
                  letterSpacing: '-0.04em',
                  maxWidth: '14ch',
                }}
              >
                Two minutes. One car.{' '}
                <em className="not-italic text-leaf">Forever record.</em>
              </h2>
            </div>
            <div className="relative flex flex-col gap-3.5 md:items-end">
              <Link
                href={ctaPrimaryHref}
                className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm text-white bg-leaf hover:bg-leaf-dk transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                Sign up — it&apos;s free <span aria-hidden>→</span>
              </Link>
              <Link
                href="/workshop/start"
                className="inline-flex items-center gap-2 h-[42px] px-[18px] rounded-pill font-bold text-sm text-chalk border border-chalk/20 hover:bg-chalk/5 transition-colors"
                style={{ letterSpacing: '-0.01em' }}
              >
                I run a workshop <span aria-hidden>→</span>
              </Link>
              <span
                className="text-xs font-bold uppercase text-chalk/55"
                style={{ letterSpacing: '0.18em' }}
              >
                No credit card · 1 free vehicle
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="pt-20 pb-10 bg-paper border-t border-seam">
        <div className="max-w-[1240px] mx-auto px-6 md:px-10">
          <div className="grid md:grid-cols-[1.4fr_repeat(4,1fr)] gap-12 mb-14">
            <div className="flex flex-col gap-4">
              <div
                className="flex items-center gap-2.5 font-black text-[32px] text-leaf"
                style={{ letterSpacing: '-0.04em' }}
              >
                <VehkitMark size={42} />
                <span>vehkit</span>
              </div>
              <p
                className="text-[15px] font-medium leading-[1.5] max-w-[30ch] text-mute"
              >
                Verified vehicle records. Built for the UAE.
              </p>
            </div>
            <FooterCol
              heading="Owners"
              links={[
                { label: 'Sign in / sign up', href: '/login' },
                { label: 'My cars', href: '/mycars' },
                { label: 'The score', href: '/score' },
              ]}
            />
            <FooterCol
              heading="Workshops"
              links={[
                { label: 'Why vehkit', href: '/workshop/start' },
                { label: 'Claim a workshop', href: '/workshop/claim' },
                { label: 'Directory', href: '/workshops' },
              ]}
            />
            <FooterCol
              heading="Agents"
              links={[
                { label: 'Why vehkit', href: '/agent/start' },
                { label: 'Sign in', href: '/login?next=/agent' },
                { label: 'For buyers', href: '/buyers' },
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
            className="flex justify-between pt-8 text-xs font-bold uppercase flex-wrap gap-2 border-t border-seam text-mute"
            style={{ letterSpacing: '0.18em' }}
          >
            <span>© {new Date().getFullYear()} Vehkit</span>
            <span>Every car deserves a passport.</span>
          </div>
        </div>
      </footer>
    </main>
  )
}

// ===========================================================================
// Subcomponents — all use brand tokens, no inline hex.
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
  rightAction,
}: {
  eyebrow: string
  title: React.ReactNode
  right?: string
  rightAction?: React.ReactNode
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
            fontSize: 'clamp(40px,5.4vw,76px)',
            lineHeight: 0.96,
            letterSpacing: '-0.04em',
            maxWidth: '18ch',
          }}
        >
          {title}
        </h2>
      </div>
      {(right || rightAction) && (
        <div className="text-[15px] leading-[1.6] font-medium text-mute">
          {right && <p>{right}</p>}
          {rightAction && <div className="text-right">{rightAction}</div>}
        </div>
      )}
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div
      className="p-9 rounded-3xl flex flex-col gap-4 bg-carbon border border-seam"
      style={{ minHeight: 260 }}
    >
      <div
        className="w-14 h-14 rounded-2xl grid place-items-center font-black text-2xl bg-leaf-50 text-leaf-dk"
        style={{ letterSpacing: '-0.04em' }}
      >
        {n}
      </div>
      <h3
        className="font-black text-[26px] leading-[1.1] m-0 text-ink"
        style={{ letterSpacing: '-0.03em' }}
      >
        {title}
      </h3>
      <p
        className="text-[15px] leading-[1.55] font-medium m-0 text-mute"
      >
        {body}
      </p>
    </div>
  )
}

function Principle({
  num,
  icon,
  title,
  body,
}: {
  num: string
  icon: 'user' | 'lock' | 'shield' | 'globe'
  title: string
  body: string
}) {
  return (
    <div
      className="p-11 flex flex-col gap-3.5 bg-paper"
      style={{ minHeight: 280 }}
    >
      <div className="w-11 h-11 rounded-2xl grid place-items-center mb-2 bg-noir text-leaf">
        <PrincipleIcon name={icon} />
      </div>
      <div
        className="text-[13px] font-bold font-mono text-leaf-dk"
        style={{ letterSpacing: '0.04em' }}
      >
        {num}
      </div>
      <h3
        className="font-black text-3xl m-0 text-ink"
        style={{
          letterSpacing: '-0.03em',
          lineHeight: 1.1,
          maxWidth: '14ch',
        }}
      >
        {title}
      </h3>
      <p
        className="text-[15px] leading-[1.55] font-medium m-0 text-mute"
        style={{ maxWidth: '42ch' }}
      >
        {body}
      </p>
    </div>
  )
}

function PrincipleIcon({ name }: { name: 'user' | 'lock' | 'shield' | 'globe' }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (name === 'user')
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 22a8 8 0 0 1 16 0" />
      </svg>
    )
  if (name === 'lock')
    return (
      <svg {...common}>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    )
  if (name === 'shield')
    return (
      <svg {...common}>
        <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M2 12h20M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
  )
}

function ScoreVisualization() {
  return (
    <div
      className="rounded-[36px] p-12 relative overflow-hidden border border-chalk/10"
      style={{ background: 'rgb(17 17 20)' }}
    >
      <div
        aria-hidden
        className="absolute pointer-events-none"
        style={{
          inset: '-40%',
          background:
            'radial-gradient(circle at 30% 30%, rgb(var(--leaf) / 0.18), transparent 50%)',
        }}
      />
      <div
        className="font-black relative text-leaf"
        style={{
          fontSize: 200,
          letterSpacing: '-0.06em',
          lineHeight: 0.85,
        }}
      >
        87
        <sup
          className="ml-2 text-chalk/40"
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: '-0.02em',
          }}
        >
          /100
        </sup>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mt-8 relative">
        <ScoreBar label="Verification" value={94} />
        <ScoreBar label="Compliance" value={81} />
        <ScoreBar label="Consistency" value={88} />
        <ScoreBar label="Recency" value={85} />
      </div>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg p-3.5 bg-chalk/[0.06] border border-chalk/[0.06]">
      <div
        className="text-[10px] font-bold uppercase mb-2 text-chalk/50"
        style={{ letterSpacing: '0.2em' }}
      >
        {label}
      </div>
      <div
        className="font-extrabold text-[22px] text-chalk"
        style={{ letterSpacing: '-0.02em' }}
      >
        {value}%
      </div>
      <div className="h-1 rounded mt-2.5 overflow-hidden bg-chalk/10">
        <div className="h-full rounded bg-leaf" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function ScoreRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div className="font-mono text-leaf font-bold">→ {k}</div>
      <div className="text-chalk/[0.78] font-medium">{v}</div>
    </>
  )
}

function WorkshopCard({ w }: { w: DirectoryRow }) {
  const tier = w.verification_tier
  const tierClass =
    tier === 'gold'
      ? 'bg-wallet/[0.18] text-wallet'
      : 'bg-mute/[0.12] text-mute'
  return (
    <Link
      href={`/w/${w.slug}`}
      className="rounded-2xl p-6 flex flex-col gap-3.5 transition-all hover:-translate-y-[3px] bg-carbon border border-seam"
      style={{ minHeight: 200 }}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-pill text-[10px] font-extrabold uppercase whitespace-nowrap w-max ${tierClass}`}
        style={{ letterSpacing: '0.16em' }}
      >
        {tier === 'gold' ? '✓ Gold' : '✓ Silver'}
      </span>
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
        <span>Entries</span>
        <b
          className="text-ink"
          style={{
            fontWeight: 800,
            letterSpacing: '-0.01em',
            textTransform: 'none',
            fontSize: 13,
          }}
        >
          {w.total_entries}
        </b>
      </div>
    </Link>
  )
}

function AudienceCard({
  variant,
  who,
  title,
  body,
  cta,
  href,
}: {
  variant: 'drive' | 'fix' | 'buy'
  who: string
  title: string
  body: string
  cta: string
  href: string
}) {
  // Three editorial card styles from the canonical mock:
  //  drive = leaf green card with white text
  //  fix   = noir card with chalk text + leaf accent on the kicker
  //  buy   = white card with ink text + leaf accent
  const styles = (() => {
    if (variant === 'drive')
      return {
        wrap: 'bg-leaf text-white',
        body: 'text-white/85',
        who: 'text-white/85',
        ic: 'bg-white/[0.18] text-white',
      }
    if (variant === 'fix')
      return {
        wrap: 'dark bg-noir text-chalk',
        body: 'text-chalk/70',
        who: 'text-leaf',
        ic: 'bg-chalk/[0.08] text-leaf',
      }
    return {
      wrap: 'bg-carbon text-ink border border-seam',
      body: 'text-mute',
      who: 'text-leaf-dk',
      ic: 'bg-leaf-50 text-leaf-dk',
    }
  })()
  return (
    <Link
      href={href as Parameters<typeof Link>[0]['href']}
      className={`rounded-[36px] p-9 flex flex-col gap-[18px] relative overflow-hidden transition-transform hover:-translate-y-1 ${styles.wrap}`}
      style={{ minHeight: 380 }}
    >
      <div
        className={`w-12 h-12 rounded-2xl grid place-items-center ${styles.ic}`}
      >
        <AudienceIcon variant={variant} />
      </div>
      <div
        className={`text-[11px] font-extrabold uppercase ${styles.who}`}
        style={{ letterSpacing: '0.22em' }}
      >
        {who}
      </div>
      <h3
        className="font-black text-[34px] leading-[1.05] m-0"
        style={{ letterSpacing: '-0.035em', maxWidth: '14ch' }}
      >
        {title}
      </h3>
      <p
        className={`text-[15px] leading-[1.55] font-medium m-0 ${styles.body}`}
      >
        {body}
      </p>
      <span
        className="mt-auto inline-flex items-center gap-2 font-extrabold text-sm"
        style={{ letterSpacing: '-0.01em' }}
      >
        {cta} <span aria-hidden>→</span>
      </span>
    </Link>
  )
}

function AudienceIcon({ variant }: { variant: 'drive' | 'fix' | 'buy' }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 2.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  if (variant === 'drive')
    return (
      <svg {...common}>
        <path d="M3 12l2-6h14l2 6" />
        <path d="M3 12v6h2v-2h14v2h2v-6" />
        <circle cx="7" cy="14" r="1.2" fill="currentColor" />
        <circle cx="17" cy="14" r="1.2" fill="currentColor" />
      </svg>
    )
  if (variant === 'fix')
    return (
      <svg {...common}>
        <path d="M14.7 6.3a4 4 0 1 1-5 5L4 17l3 3 5.7-5.7a4 4 0 0 1 5-5z" />
      </svg>
    )
  return (
    <svg {...common}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </svg>
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
        className="text-[11px] font-extrabold uppercase mb-4 m-0 text-mute"
        style={{ letterSpacing: '0.22em' }}
      >
        {heading}
      </h5>
      <ul className="list-none p-0 m-0 flex flex-col gap-2.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-[15px] font-semibold text-ink hover:text-leaf-dk transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ReceiptMockup() {
  return (
    <div className="relative" style={{ maxWidth: 520 }}>
      <div
        className="relative p-8 rounded-2xl bg-carbon border border-seam"
        style={{
          boxShadow: '0 20px 60px -30px rgb(10 10 11 / 0.18)',
          transform: 'rotate(-1.5deg)',
        }}
      >
        <div
          aria-hidden
          className="absolute rounded-pill bg-wallet/[0.18]"
          style={{
            width: 90,
            height: 90,
            right: -20,
            top: '48%',
          }}
        />
        <h4
          className="m-0 mb-1 font-extrabold text-[15px] text-ink"
          style={{ letterSpacing: '-0.02em' }}
        >
          Al Karama Garage
        </h4>
        <div
          className="text-[11px] font-bold uppercase mb-6 text-mute"
          style={{ letterSpacing: '0.22em' }}
        >
          Receipt · 14 NOV 2024
        </div>
        <ul className="list-none p-0 m-0 text-sm">
          {[
            ['Oil change', 'AED 240'],
            ['Filter', 'AED 90'],
            ['"Other"', 'AED 380'],
            ['Labour', 'AED 150'],
          ].map(([k, v], i, arr) => (
            <li
              key={String(k)}
              className="flex justify-between py-2.5 font-mono"
              style={{
                borderBottom:
                  i < arr.length - 1
                    ? '1px dashed rgb(var(--seam))'
                    : 'none',
                fontWeight: 600,
                letterSpacing: '-0.01em',
              }}
            >
              <span className="text-mute font-medium">{k}</span>
              <span className="text-ink">{v}</span>
            </li>
          ))}
        </ul>
        <div
          className="text-center mt-4 font-extrabold text-lg text-signal"
          style={{
            transform: 'rotate(-3deg)',
          }}
        >
          — check brakes next time?
        </div>
      </div>
    </div>
  )
}

function PassportMockup() {
  return (
    <div className="relative">
      {/* Floating service entry chips */}
      <PassportChip
        label="Major service"
        meta="38,500 km · AED 2,840 · 9 May"
        position={{ top: -12, left: -30 }}
        rotate={-3}
      />
      <PassportChip
        label="Brake fluid"
        meta="31,000 km · 14 Mar"
        position={{ bottom: 60, left: -44 }}
        rotate={2}
      />
      <PassportChip
        label="Tyres rotated"
        meta="28,400 km · 02 Feb"
        position={{ top: '36%', right: -32 }}
        rotate={4}
      />

      {/* The passport card itself — always renders dark, regardless of theme */}
      <div
        className="dark relative p-7 flex flex-col gap-[18px] overflow-hidden bg-noir text-chalk"
        style={{
          borderRadius: 36,
          aspectRatio: '5/7',
          boxShadow:
            '0 30px 80px -20px rgb(10 10 11 / 0.35), 0 4px 16px rgb(10 10 11 / 0.10)',
          transform: 'rotate(2.5deg)',
        }}
      >
        <div
          aria-hidden
          className="absolute pointer-events-none border border-chalk/10"
          style={{
            inset: 14,
            borderRadius: 22,
          }}
        />

        {/* Top: brand + verified stamp */}
        <div className="flex justify-between items-start relative z-10">
          <div className="flex gap-2.5 items-center">
            <VehkitMark size={36} />
            <div
              className="font-extrabold text-[18px] text-leaf"
              style={{ letterSpacing: '-0.03em' }}
            >
              vehkit
              <small
                className="block text-[9px] font-bold uppercase mt-0.5 text-chalk/55"
                style={{ letterSpacing: '0.22em' }}
              >
                passport
              </small>
            </div>
          </div>
          <div
            className="grid place-items-center text-center font-extrabold p-1.5 text-volt border border-dashed border-volt/60"
            style={{
              width: 78,
              height: 78,
              borderRadius: '50%',
              fontSize: 9,
              letterSpacing: '0.18em',
              transform: 'rotate(-12deg)',
              lineHeight: 1.15,
            }}
          >
            VERIFIED
            <br />·<br />
            UAE
          </div>
        </div>

        {/* Middle: vehicle info + score */}
        <div className="flex-1 flex flex-col justify-center gap-1.5 relative z-10">
          <div
            className="text-[11px] font-mono text-chalk/55"
            style={{ letterSpacing: '0.16em' }}
          >
            VIN · WBA8E5C58JK 391 022
          </div>
          <div
            className="font-black text-[34px] leading-none text-chalk"
            style={{ letterSpacing: '-0.035em' }}
          >
            Toyota Land Cruiser
          </div>
          <div className="text-sm font-semibold text-chalk/70">
            2021 · Petrol · 38,500 km · Dubai-issued
          </div>
          <div
            className="flex justify-between items-end gap-[18px] mt-[18px] pt-[18px] border-t border-chalk/12"
          >
            <div>
              <div
                className="font-black text-leaf"
                style={{
                  fontSize: 64,
                  letterSpacing: '-0.045em',
                  lineHeight: 1,
                }}
              >
                87
                <sup
                  className="text-lg font-bold ml-1 text-chalk/45"
                  style={{ letterSpacing: '-0.02em' }}
                >
                  /100
                </sup>
              </div>
              <div
                className="text-[10px] font-bold uppercase text-chalk/55"
                style={{ letterSpacing: '0.2em' }}
              >
                Vehkit score
              </div>
            </div>
            <div className="flex gap-1 items-end h-9" aria-hidden>
              {[80, 90, 60, 100, 55, 75, 85, 65, 40, 30].map((h, i) => (
                <div
                  key={i}
                  className={`w-2.5 rounded ${
                    i === 5
                      ? 'bg-volt'
                      : h >= 50
                        ? 'bg-leaf'
                        : 'bg-chalk/[0.16]'
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Foot */}
        <div
          className="flex justify-between items-center text-[10px] font-bold uppercase relative z-10 text-chalk/45"
          style={{ letterSpacing: '0.2em' }}
        >
          <span>N° AE · 25 / 00001</span>
          <span>EST MMXXVI</span>
        </div>
      </div>
    </div>
  )
}

function PassportChip({
  label,
  meta,
  position,
  rotate,
}: {
  label: string
  meta: string
  position: React.CSSProperties
  rotate: number
}) {
  return (
    <div
      className="absolute flex gap-2.5 items-center px-3.5 py-2.5 z-20 bg-carbon border border-seam"
      style={{
        borderRadius: 14,
        boxShadow: '0 14px 40px -12px rgb(10 10 11 / 0.18)',
        transform: `rotate(${rotate}deg)`,
        ...position,
      }}
    >
      <div
        className="grid place-items-center bg-leaf-50 text-leaf-dk"
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="4 12 10 18 20 6" />
        </svg>
      </div>
      <div>
        <div className="text-[13px] font-semibold text-ink">{label}</div>
        <div className="text-[11px] font-semibold text-mute">{meta}</div>
      </div>
    </div>
  )
}
