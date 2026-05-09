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
  const [{ data: { user } }, { data: directoryRaw }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.rpc('public_workshop_directory', { p_limit: 6, p_offset: 0 }),
  ])

  const featured = ((directoryRaw as DirectoryRow[]) ?? []).filter(
    (w) => w.verification_tier === 'gold' || w.verification_tier === 'silver'
  )

  return (
    <main className="min-h-[100svh] flex flex-col">
      <MarketingHeader signedIn={!!user} />

      {/* HERO — editorial split */}
      <section className="px-6 md:px-10 pt-16 md:pt-24 pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto grid md:grid-cols-2 gap-12 md:gap-20 items-center">
          <div>
            <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
              Verified vehicle records
            </p>
            <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
              Every car
              <br />
              deserves
              <br />
              a passport.
            </h1>
            <p className="text-base md:text-lg text-ash mt-8 leading-relaxed max-w-md">
              An owner-controlled service record, attested by verified
              workshops, immutable after twenty-four hours. Built for resale.
              Built for the UAE.
            </p>
            <div className="mt-12 flex items-center gap-6">
              {user ? (
                <Link href="/mycars" className="pill-primary inline-flex items-center">
                  Open my cars
                </Link>
              ) : (
                <Link href="/login" className="pill-primary inline-flex items-center">
                  Start your first car
                </Link>
              )}
              <Link
                href="/score"
                className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                How the score works →
              </Link>
            </div>
          </div>

          <div className="md:flex md:justify-end">
            <SamplePassport />
          </div>
        </div>
      </section>

      {/* THE PROBLEM — long-form pull, single column, no card */}
      <section className="px-6 md:px-10 py-20 md:py-28 border-t border-seam">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            The problem
          </p>
          <p className="text-2xl md:text-3xl text-chalk mt-6 leading-relaxed tracking-tight">
            A used car in the UAE is sold on trust — but trust isn't recorded.
            Service histories live in glove compartments, on workshop
            stickers, in WhatsApp threads. When a buyer asks{' '}
            <em className="text-ash not-italic">what's been done</em>, the
            seller hands over a folder, or a story.
          </p>
          <p className="text-base text-ash mt-8 leading-relaxed">
            Vehkit is the alternative. Every service is logged once,
            attested by the workshop that did the work, and locked into a
            permanent record that follows the car from owner to owner. No
            sticker. No folder. No story.
          </p>
        </div>
      </section>

      {/* PRINCIPLES — editorial numbered list, not card grid */}
      <section className="px-6 md:px-10 py-20 md:py-28 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            Principles
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 max-w-3xl leading-[1.05]">
            Four lines we don't cross.
          </h2>

          <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-12">
            <Principle
              n="01"
              title="Owner-controlled"
              body="Your record. Your codes. Your share links. Workshops can attest entries; only you can publish, share, or revoke. No data leaves your account without an action you took."
            />
            <Principle
              n="02"
              title="Immutable after twenty-four hours"
              body="Workshop entries lock after a one-day retract window. After that, neither you, nor the workshop, nor Vehkit can edit them. The record is what it was — that's what makes it worth something at resale."
            />
            <Principle
              n="03"
              title="Verified by trade license"
              body="Silver tier requires a uploaded UAE trade license plus ten verified entries. Gold tier requires a hundred entries, a 4.5-star rating across at least five reviews, and the license. The directory is curated, not pay-to-play."
            />
            <Principle
              n="04"
              title="Privacy as default"
              body="Workshops never see your email, phone, or full name unless you explicitly enable workshop outreach for that vehicle. Buyers see only what your share link permits. We don't sell data, don't run advertising, don't will."
            />
          </div>
        </div>
      </section>

      {/* THE SCORE — full-width quiet section */}
      <section className="px-6 md:px-10 py-20 md:py-28 border-t border-seam">
        <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
              The Vehkit score
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
              A number worth more
              <br />
              than the photos.
            </h2>
            <p className="text-base md:text-lg text-ash mt-8 leading-relaxed max-w-md">
              Every car gets a passport score from zero to a hundred. It
              rewards verified service, on-time reminder compliance, history
              continuity, and recency. Workshop diversity bonuses keep any
              single shop from gaming the number.
            </p>
            <Link
              href="/score"
              className="inline-flex items-center text-xs tracking-widest uppercase text-volt hover:underline mt-8 font-medium"
            >
              The methodology in detail →
            </Link>
          </div>

          <div className="md:col-span-5 md:flex md:justify-end">
            <SamplePassport />
          </div>
        </div>
      </section>

      {/* WORKSHOPS — sparse strip if there are verified ones */}
      {featured.length > 0 && (
        <section className="px-6 md:px-10 py-20 md:py-28 border-t border-seam">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4 flex-wrap mb-12">
              <div>
                <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
                  Verified workshops on Vehkit
                </p>
                <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter text-chalk mt-3 leading-tight">
                  Real shops. Real histories.
                </h2>
              </div>
              <Link
                href="/workshops"
                className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
              >
                Full directory →
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-seam rounded-DEFAULT overflow-hidden">
              {featured.slice(0, 4).map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.slug}`}
                  className="bg-noir px-5 py-7 hover:bg-carbon transition-colors group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    {w.verification_tier === 'gold' && (
                      <span className="text-[9px] tracking-widest uppercase text-wallet font-medium">
                        ✓ Gold
                      </span>
                    )}
                    {w.verification_tier === 'silver' && (
                      <span className="text-[9px] tracking-widest uppercase text-volt font-medium">
                        ✓ Silver
                      </span>
                    )}
                  </div>
                  <p className="text-base font-semibold text-chalk group-hover:text-volt transition-colors leading-tight">
                    {w.name}
                  </p>
                  <p className="text-xs text-ash mt-1">{w.emirate ?? 'UAE'}</p>
                  <div className="mt-6 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-semibold text-chalk tabular-nums tracking-tighter">
                      {w.total_entries}
                    </span>
                    <span className="text-[10px] text-ash tracking-widest uppercase">
                      entries
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* AUDIENCE HANDOFF — three columns of editorial copy */}
      <section className="px-6 md:px-10 py-20 md:py-28 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            Who Vehkit is for
          </p>
          <div className="grid md:grid-cols-3 gap-12 mt-12">
            <AudienceColumn
              kicker="If you drive"
              title="Track every wrench turn."
              body="Add a car, log a service, share the passport when it's time to sell. Workshops attest the entries you generate codes for. Reminders fire when you've earned a check-up. The record is yours forever."
              cta={{ href: '/login', label: 'Start your first car →' }}
            />
            <AudienceColumn
              kicker="If you fix"
              title="Build a verified portfolio."
              body="Customer hands you a six-digit code. Enter it. Log the service. Done. Every entry on the customer's record carries your name forever. Verified workshops climb the directory and earn Silver / Gold."
              cta={{ href: '/workshop/start', label: 'For workshops →' }}
            />
            <AudienceColumn
              kicker="If you buy"
              title="See the truth before you sign."
              body="Sellers send you a passport link. You see every verified service, every workshop, every kilometer. A score from zero to a hundred summarizes the history at a glance. No edits, no deletions, no story."
              cta={{ href: '/buyers', label: 'For buyers →' }}
            />
          </div>
        </div>
      </section>

      {/* CLOSING — single restrained line */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tightest text-chalk leading-[1.05]">
            Two minutes. One car.
            <br />
            Forever record.
          </h2>
          <div className="mt-12 flex items-center justify-center gap-6">
            {user ? (
              <Link href="/mycars" className="pill-primary inline-flex items-center">
                Open my cars
              </Link>
            ) : (
              <Link href="/login" className="pill-primary inline-flex items-center">
                Sign up — it's free
              </Link>
            )}
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

function Principle({
  n,
  title,
  body,
}: {
  n: string
  title: string
  body: string
}) {
  return (
    <div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-xs text-volt tabular-nums">{n}.</span>
        <h3 className="text-lg font-semibold text-chalk tracking-tight">
          {title}
        </h3>
      </div>
      <p className="text-base text-ash mt-3 leading-relaxed">{body}</p>
    </div>
  )
}

function AudienceColumn({
  kicker,
  title,
  body,
  cta,
}: {
  kicker: string
  title: string
  body: string
  cta: { href: string; label: string }
}) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.25em] uppercase text-volt">
        {kicker}
      </p>
      <h3 className="text-2xl font-semibold tracking-tighter text-chalk mt-3 leading-tight">
        {title}
      </h3>
      <p className="text-sm text-ash mt-4 leading-relaxed">{body}</p>
      <Link
        href={cta.href}
        className="text-xs tracking-widest uppercase text-volt hover:underline mt-5 inline-block font-medium"
      >
        {cta.label}
      </Link>
    </div>
  )
}
