import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import {
  MarketingHeader,
  MarketingFooter,
  SamplePassport,
} from '@/components/MarketingChrome'

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
    <main className="min-h-[100svh] flex flex-col">
      <MarketingHeader signedIn={!!user} />

      {/* ─── HERO ─── */}
      <section className="px-6 md:px-10 pt-10 md:pt-16 pb-16 md:pb-20">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-[1.15fr_1fr] gap-12 lg:gap-16 items-center">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
              For UAE car owners · free
            </p>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
              Every car
              <br />
              deserves
              <br />
              a <span className="text-volt">passport.</span>
            </h1>
            <p className="text-lg md:text-xl text-chalk mt-8 leading-relaxed max-w-2xl font-medium">
              Keep every service receipt, mulkiya and insurance doc in one
              place.{' '}
              <span className="text-ash font-normal">
                We&apos;ll remind you before anything expires. When you sell,
                the buyer sees the full history.
              </span>
            </p>
            <div className="mt-10 flex items-center gap-6 flex-wrap">
              <Link
                href={ctaPrimaryHref}
                className="pill-primary inline-flex items-center"
              >
                Add your first car — free
              </Link>
              <Link
                href="#how"
                className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                See how it works ↓
              </Link>
            </div>

            {/* Stat strip — vertical dividers, brand pattern */}
            <div className="mt-10 flex items-stretch gap-5 flex-wrap">
              <Stat value="2 min" label="To set up" />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat value="Auto" label="Renewal reminders" />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat value="Free" label="1 car, forever" />
            </div>
          </div>

          <div className="flex lg:justify-end">
            <SamplePassport />
          </div>
        </div>
      </section>

      {/* ─── LOGO STRIP — verified workshop network ─── */}
      {stripWorkshops.length > 0 && (
        <section className="px-6 md:px-10 py-8 border-t border-b border-seam">
          <div className="max-w-6xl mx-auto flex items-center gap-8 flex-wrap justify-between">
            <p className="text-[10px] tracking-[0.22em] uppercase text-ash">
              Workshop network · {directory.length}+ verified
            </p>
            <div className="flex gap-8 items-center flex-wrap">
              {stripWorkshops.map((w) => (
                <span
                  key={w.id}
                  className="text-sm font-semibold text-ash flex items-center gap-2"
                >
                  <span
                    className="inline-block w-1.5 h-1.5 rounded-pill bg-volt"
                    aria-hidden
                  />
                  {w.name}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── HOW IT WORKS (3 steps) ─── */}
      <section id="how" className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="How it works"
            title={
              <>
                Three steps. About{' '}
                <span className="text-volt">five minutes.</span>
              </>
            }
            sub="No app to download. No credit card. Add your car once, then we do the remembering."
          />

          <div className="mt-14 grid md:grid-cols-3 gap-4">
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
              body="One morning email a month with what's expiring, what's due for service, what kilometres you should be at. Selling? Share one link — the buyer sees everything."
            />
          </div>
        </div>
      </section>

      {/* ─── PROBLEM ─── */}
      <section id="problem" className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="The problem"
            title={
              <>
                A used car is sold on trust — but trust{' '}
                <span className="text-volt">isn&apos;t recorded.</span>
              </>
            }
            sub="Service histories live in glove compartments, on workshop stickers, in WhatsApp threads. When a buyer asks what's been done, the seller hands over a folder, or a story."
          />

          <div className="mt-14 grid lg:grid-cols-2 gap-10 lg:gap-16 items-start">
            <div className="card p-8 md:p-10">
              <p className="text-[10px] tracking-[0.22em] uppercase text-ash">
                Al Karama Garage · Receipt
              </p>
              <p className="text-xs text-ash mt-1">14 NOV 2024</p>
              <ul className="mt-6 space-y-3 font-mono text-sm tabular-nums">
                <li className="flex justify-between border-b border-seam pb-2.5">
                  <span className="text-ash">Oil change</span>
                  <span className="text-chalk">AED 240</span>
                </li>
                <li className="flex justify-between border-b border-seam pb-2.5">
                  <span className="text-ash">Filter</span>
                  <span className="text-chalk">AED 90</span>
                </li>
                <li className="flex justify-between border-b border-seam pb-2.5">
                  <span className="text-ash">&quot;Other&quot;</span>
                  <span className="text-chalk">AED 380</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-ash">Labour</span>
                  <span className="text-chalk">AED 150</span>
                </li>
              </ul>
              <p className="mt-6 pt-4 border-t border-seam text-sm text-signal italic">
                — check brakes next time?
              </p>
            </div>

            <div>
              <h3 className="text-2xl md:text-3xl font-semibold tracking-tighter text-chalk leading-tight">
                Folders fade. Stickers peel. Stories drift.
              </h3>
              <p className="text-base text-ash mt-5 leading-relaxed">
                The car you&apos;re about to buy might have a perfect record. It
                might have nothing. The handwritten receipt and the workshop
                sticker tell you nothing you can verify, and nothing that
                travels with the car.
              </p>
              <div className="mt-8 card p-6 border-volt/30 bg-volt/5">
                <p className="text-sm leading-relaxed text-chalk">
                  Vehkit is the alternative. Every service is logged once,
                  attested by the workshop that did the work, and locked into
                  a permanent record that follows the car from owner to owner.{' '}
                  <span className="text-volt font-semibold">
                    No sticker. No folder. No story.
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── PRINCIPLES ─── */}
      <section id="principles" className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="Principles"
            title={
              <>
                Four lines we{' '}
                <span className="text-volt">don&apos;t cross.</span>
              </>
            }
            sub="Trust is what we sell. These four constraints are how we earn it — and what we'll never trade away for growth, partnerships, or a bigger directory."
          />

          <div className="mt-14 grid sm:grid-cols-2 gap-4">
            <Principle
              num="01 · OWNER-CONTROLLED"
              title="Your record. Your codes. Your share links."
              body="Workshops can attest entries; only you can publish, share, or revoke. No data leaves your account without an action you took."
            />
            <Principle
              num="02 · IMMUTABLE AFTER 24H"
              title="The record is what it was."
              body="Workshop entries lock after a one-day retract window. After that, neither you, nor the workshop, nor Vehkit can edit them. That's what makes it worth something at resale."
            />
            <Principle
              num="03 · VERIFIED BY TRADE LICENCE"
              title="The directory is curated, not pay-to-play."
              body="Silver requires a UAE trade licence and ten verified entries. Gold requires a hundred entries, a 4.5-star rating across at least five reviews, and the licence."
            />
            <Principle
              num="04 · PRIVACY AS DEFAULT"
              title="Workshops don't see your details."
              body="Email, phone, full name — never shared unless you explicitly enable workshop outreach. Buyers see only what your share link permits. We don't sell data. We don't run ads."
            />
          </div>
        </div>
      </section>

      {/* ─── SCORE ─── */}
      <section id="score" className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="The vehkit score"
            title={
              <>
                A number worth more than the{' '}
                <span className="text-volt">photos.</span>
              </>
            }
            sub="Think of it as a credit score — for your car. Every Vehkit car gets a 0–100 number that summarises how well it's been looked after. Verified service, on-time compliance, history continuity, recency."
          />

          <div className="mt-14 grid lg:grid-cols-[1fr_1.2fr] gap-10 lg:gap-16 items-center">
            <div className="card p-10 md:p-12">
              <p className="font-mono text-7xl md:text-8xl font-semibold text-volt tabular-nums tracking-tightest leading-none">
                87
                <span className="text-ash text-2xl md:text-3xl font-normal ml-2">
                  /100
                </span>
              </p>
              <div className="mt-8 space-y-2.5">
                <ScoreBar label="Verification" value={94} />
                <ScoreBar label="Compliance" value={81} />
                <ScoreBar label="Consistency" value={88} />
                <ScoreBar label="Recency" value={85} />
              </div>
            </div>

            <div>
              <ul className="space-y-5">
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
              </ul>
              <Link
                href="/score"
                className="pill-primary inline-flex items-center mt-8"
              >
                The methodology in detail →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WORKSHOPS ─── */}
      {gridWorkshops.length > 0 && (
        <section
          id="workshops"
          className="px-6 md:px-10 py-20 md:py-24 border-t border-seam"
        >
          <div className="max-w-6xl mx-auto">
            <SectionHead
              eyebrow="Verified workshops on vehkit"
              title={
                <>
                  Real shops. Real{' '}
                  <span className="text-volt">histories.</span>
                </>
              }
              rightAction={
                <Link
                  href="/workshops"
                  className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                >
                  Full directory →
                </Link>
              }
            />

            <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {gridWorkshops.map((w) => (
                <WorkshopCard key={w.id} w={w} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ─── AUDIENCE ─── */}
      <section id="who" className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <SectionHead
            eyebrow="Who vehkit is for"
            title={
              <>
                Three roles. One{' '}
                <span className="text-volt">record.</span>
              </>
            }
            sub="Every car has three lives — the person who drives it, the people who fix it, and whoever buys it next. Vehkit serves all three from the same passport."
          />

          <div className="mt-14 grid md:grid-cols-3 gap-4">
            <AudienceCard
              who="If you drive"
              title="Track every wrench turn."
              body="Add a car, log a service, share the passport when it's time to sell. Workshops attest the entries you generate codes for. Reminders fire when you've earned a check-up. The record is yours forever."
              cta="Start your first car"
              href={user ? '/mycars' : '/login?next=/mycars'}
            />
            <AudienceCard
              who="If you fix"
              title="Build a verified portfolio."
              body="Customer hands you a six-digit code. Enter it. Log the service. Done. Every entry on the customer's record carries your name forever. Verified workshops climb the directory and earn Silver / Gold."
              cta="For workshops"
              href="/workshop/start"
            />
            <AudienceCard
              who="If you buy"
              title="See the truth before you sign."
              body="Sellers send you a passport link. You see every verified service, every workshop, every kilometre. A score from zero to a hundred summarises the history at a glance. No edits, no deletions, no story."
              cta="For buyers"
              href="/buyers"
            />
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ─── */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Get started — free
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tightest text-chalk mt-4 leading-[1.05]">
            Two minutes. One car.
            <br />
            <span className="text-volt">Forever record.</span>
          </h2>
          <p className="text-base text-ash mt-6 leading-relaxed max-w-md mx-auto">
            No credit card. One car free, forever. Add another anytime.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6 flex-wrap">
            <Link
              href={ctaPrimaryHref}
              className="pill-primary inline-flex items-center"
            >
              Sign up — it&apos;s free
            </Link>
            <Link
              href="/workshop/start"
              className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
            >
              I run a workshop →
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}

// ===========================================================================
// Subcomponents — all on-brand tokens, no inline hex.
// ===========================================================================

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-base md:text-lg font-semibold text-chalk tracking-tight leading-none">
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1.5">
        {label}
      </p>
    </div>
  )
}

function SectionHead({
  eyebrow,
  title,
  sub,
  rightAction,
}: {
  eyebrow: string
  title: React.ReactNode
  sub?: string
  rightAction?: React.ReactNode
}) {
  return (
    <div className="grid lg:grid-cols-2 gap-6 lg:gap-12 items-end">
      <div>
        <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
          {eyebrow}
        </p>
        <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05] max-w-3xl">
          {title}
        </h2>
      </div>
      {(sub || rightAction) && (
        <div>
          {sub && (
            <p className="text-base text-ash leading-relaxed">{sub}</p>
          )}
          {rightAction && (
            <div className="mt-4 lg:mt-0 lg:text-right">{rightAction}</div>
          )}
        </div>
      )}
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-6 md:p-7">
      <div className="w-12 h-12 rounded-pill bg-volt/15 text-volt flex items-center justify-center font-mono text-base font-semibold tabular-nums">
        {n}
      </div>
      <h3 className="text-xl font-semibold text-chalk tracking-tight mt-5 leading-snug">
        {title}
      </h3>
      <p className="text-sm text-ash mt-3 leading-relaxed">{body}</p>
    </div>
  )
}

function Principle({
  num,
  title,
  body,
}: {
  num: string
  title: string
  body: string
}) {
  return (
    <div className="card p-7 md:p-8 flex flex-col gap-3">
      <p className="font-mono text-[10px] tracking-[0.22em] text-volt">
        {num}
      </p>
      <h3 className="text-xl md:text-2xl font-semibold text-chalk tracking-tight leading-tight">
        {title}
      </h3>
      <p className="text-sm text-ash leading-relaxed">{body}</p>
    </div>
  )
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-ash">
          {label}
        </span>
        <span className="font-mono text-xs text-chalk tabular-nums">
          {value}%
        </span>
      </div>
      <div className="mt-1.5 h-0.5 bg-iron rounded-full overflow-hidden">
        <div className="h-full bg-volt" style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function ScoreRow({ k, v }: { k: string; v: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-5 items-start">
      <span className="font-mono text-xs text-volt tracking-wider mt-0.5">
        → {k}
      </span>
      <p className="text-sm text-ash leading-relaxed">{v}</p>
    </li>
  )
}

function WorkshopCard({ w }: { w: DirectoryRow }) {
  const tier = w.verification_tier
  const tierClass =
    tier === 'gold'
      ? 'bg-wallet/15 text-wallet'
      : 'bg-ash/15 text-ash'
  const tierLabel = tier === 'gold' ? '✓ Gold' : '✓ Silver'
  return (
    <Link
      href={`/w/${w.slug}`}
      className="card p-6 flex flex-col gap-3 transition-colors hover:border-volt/30"
    >
      <span
        className={`inline-flex items-center self-start px-2 py-1 rounded-pill text-[10px] tracking-widest uppercase font-semibold ${tierClass}`}
      >
        {tierLabel}
      </span>
      <h4 className="text-base font-semibold text-chalk tracking-tight leading-snug">
        {w.name}
      </h4>
      <p className="text-xs text-ash">{w.emirate ?? 'UAE'}</p>
      <div className="mt-auto pt-3 border-t border-seam flex items-center justify-between">
        <span className="text-[10px] tracking-widest uppercase text-ash">
          Entries
        </span>
        <span className="font-mono text-sm text-chalk tabular-nums font-semibold">
          {w.total_entries}
        </span>
      </div>
    </Link>
  )
}

function AudienceCard({
  who,
  title,
  body,
  cta,
  href,
}: {
  who: string
  title: string
  body: string
  cta: string
  href: string
}) {
  return (
    <Link
      href={href as Parameters<typeof Link>[0]['href']}
      className="card p-8 flex flex-col gap-4 transition-colors hover:border-volt/30 h-full"
    >
      <p className="text-[10px] tracking-[0.22em] uppercase text-volt">
        {who}
      </p>
      <h3 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter leading-tight">
        {title}
      </h3>
      <p className="text-sm text-ash leading-relaxed">{body}</p>
      <span className="mt-auto text-xs tracking-widest uppercase text-volt font-medium">
        {cta} →
      </span>
    </Link>
  )
}
