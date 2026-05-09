import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type PlatformStats = {
  total_vehicles: number
  total_entries: number
  verified_entries: number
  total_workshops: number
  verified_workshops: number
  gold_workshops: number
  total_emirates_covered: number
}

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

  const [{ data: { user } }, { data: statsRaw }, { data: directoryRaw }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.rpc('public_platform_stats'),
      supabase.rpc('public_workshop_directory', { p_limit: 6, p_offset: 0 }),
    ])

  const stats = (statsRaw as PlatformStats) ?? null
  const featured = (directoryRaw as DirectoryRow[]) ?? []

  return (
    <main className="min-h-[100svh]">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tightest text-chalk">
            vehkit
          </Link>
          <nav className="flex items-center gap-1 text-xs">
            <Link
              href="/workshops"
              className="px-3 py-1.5 text-ash hover:text-chalk transition-colors"
            >
              Directory
            </Link>
            <Link
              href="/workshop/start"
              className="px-3 py-1.5 text-ash hover:text-chalk transition-colors"
            >
              For workshops
            </Link>
            {user ? (
              <Link href="/mycars" className="pill-primary text-xs ml-2">
                My cars →
              </Link>
            ) : (
              <Link href="/login" className="pill-primary text-xs ml-2">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* HERO */}
      <section className="px-6 pt-20 md:pt-32 pb-16">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-volt">
            Verified vehicle records · UAE
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
            Every car deserves
            <br />
            <span className="text-volt">a passport.</span>
          </h1>
          <p className="text-lg md:text-xl text-ash max-w-2xl mx-auto mt-8 leading-relaxed">
            One immutable service record per car, attested by verified workshops, owned by you.
            Resale buyers see the truth. Workshops build a portfolio. You stop chasing receipts.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-10">
            {user ? (
              <Link href="/mycars" className="pill-primary inline-flex items-center gap-2">
                Open my cars <span aria-hidden>→</span>
              </Link>
            ) : (
              <Link href="/login" className="pill-primary inline-flex items-center gap-2">
                Start your first car <span aria-hidden>→</span>
              </Link>
            )}
            <Link href="/workshops" className="pill-ghost inline-flex items-center">
              Browse workshops
            </Link>
          </div>

          <p className="text-xs text-ash/70 mt-5">
            Free for owners · No credit card · Available now in the UAE
          </p>
        </div>
      </section>

      {/* LIVE COUNTERS */}
      {stats && stats.total_vehicles > 0 && (
        <section className="px-6 pb-12">
          <div className="max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-3">
            <Counter label="Cars on Vehkit" value={stats.total_vehicles} />
            <Counter label="Verified entries" value={stats.verified_entries} />
            <Counter label="Verified workshops" value={stats.verified_workshops} />
            <Counter label="Emirates covered" value={stats.total_emirates_covered} />
          </div>
        </section>
      )}

      {/* THREE TRACKS */}
      <section className="px-6 py-16 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter text-center">
            One platform. Three audiences.
          </h2>
          <p className="text-ash text-center mt-3 max-w-xl mx-auto">
            Whether you drive, fix, or buy — Vehkit speaks to you in your language.
          </p>

          <div className="grid md:grid-cols-3 gap-4 mt-12">
            <TrackCard
              tone="volt"
              tag="For owners"
              title="Track every wrench turn."
              bullets={[
                'Add cars in 60 seconds — make, model, plate, VIN.',
                'Log services yourself, or have your workshop verify them with a one-time code.',
                'Reminders fire when your next service is due — by date or kilometers.',
                'Generate a shareable resale passport when it’s time to sell.',
              ]}
              cta={{ href: '/login', label: 'Start your first car →' }}
            />
            <TrackCard
              tone="wallet"
              tag="For workshops"
              title="Build a verified portfolio."
              bullets={[
                'Customer hands you a 6-digit code. Enter it. Log the service. Done.',
                'Every entry on a customer’s record carries your name forever.',
                'Verified workshops climb the directory and earn Silver / Gold badges.',
                'Free dashboard with customer roster, upcoming visits, and reviews.',
              ]}
              cta={{ href: '/workshop/start', label: 'Sign up your workshop →' }}
            />
            <TrackCard
              tone="chalk"
              tag="For buyers"
              title="See the truth before you sign."
              bullets={[
                'Sellers send you a passport link.',
                'You see every verified service, every workshop, every kilometer.',
                'A 0–100 Vehkit score summarizes the car’s history at a glance.',
                'No edits, no deletions, no hidden gaps. The record is the record.',
              ]}
              cta={{ href: '/workshops', label: 'Browse the directory →' }}
            />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-6 py-16 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter text-center">
            How verification works.
          </h2>
          <p className="text-ash text-center mt-3 max-w-xl mx-auto">
            The trust loop. Owner-controlled, workshop-attested, immutable after 24 hours.
          </p>

          <div className="grid md:grid-cols-3 gap-3 mt-12">
            <Step
              n="1"
              title="Owner generates a code"
              body="At the workshop, you tap Generate workshop code on your car. Vehkit issues a single-use, 1-hour code."
            />
            <Step
              n="2"
              title="Workshop logs the service"
              body="The workshop visits vehkit.com/shop, enters your code, and fills in service type, date, odometer, cost."
            />
            <Step
              n="3"
              title="You confirm. It locks."
              body="The entry shows in your inbox for 24 hours. You can retract; after that the record is permanent."
            />
          </div>
        </div>
      </section>

      {/* SCORE EXPLAINER */}
      <section className="px-6 py-16 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div>
              <p className="text-[10px] tracking-[0.3em] uppercase text-volt">
                The Vehkit score
              </p>
              <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-4">
                A number worth more than the photos.
              </h2>
              <p className="text-ash mt-4 leading-relaxed">
                Every car gets a passport score from 0 to 100. It rewards verified service,
                on-time reminders, history continuity, and recency. It rewards workshop diversity
                so a single shop can’t game the number.
              </p>
              <p className="text-ash mt-4 leading-relaxed">
                Buyers see this. So do you. So does your insurance broker, eventually.
              </p>
            </div>

            <div className="card p-6">
              <div className="flex items-baseline justify-between gap-4 mb-5">
                <p className="text-[10px] tracking-widest uppercase text-ash">Sample score</p>
                <p className="font-mono text-5xl font-semibold text-volt tabular-nums tracking-tighter">
                  87
                  <span className="text-ash text-base font-normal ml-1">/100</span>
                </p>
              </div>
              <ScoreRow label="Verification" value={36} max={40} />
              <ScoreRow label="Compliance" value={28} max={30} />
              <ScoreRow label="Consistency" value={16} max={20} />
              <ScoreRow label="Recency" value={7} max={10} />
            </div>
          </div>
        </div>
      </section>

      {/* WORKSHOP DIRECTORY PREVIEW */}
      {featured.length > 0 && (
        <section className="px-6 py-16 border-t border-seam">
          <div className="max-w-6xl mx-auto">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter">
                  Workshops on Vehkit.
                </h2>
                <p className="text-ash mt-2 max-w-xl">
                  Real shops with verified service histories. Ranked by tier, then rating.
                </p>
              </div>
              <Link
                href="/workshops"
                className="text-xs tracking-widest uppercase text-volt hover:underline"
              >
                See full directory →
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-8">
              {featured.map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.slug}`}
                  className="card p-5 hover:border-volt/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-base font-semibold text-chalk truncate">{w.name}</p>
                    {w.verification_tier === 'gold' && (
                      <span className="text-[10px] tracking-widest uppercase bg-wallet/20 text-wallet px-2 py-0.5 rounded-pill font-medium shrink-0">
                        ✓ Gold
                      </span>
                    )}
                    {w.verification_tier === 'silver' && (
                      <span className="text-[10px] tracking-widest uppercase bg-volt/20 text-volt px-2 py-0.5 rounded-pill font-medium shrink-0">
                        ✓ Silver
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ash mt-1">
                    {w.emirate ?? 'UAE'}
                    {w.review_count > 0 && (
                      <>
                        {' · '}
                        <span className="font-mono">
                          {Number(w.avg_rating).toFixed(1)}★ ({w.review_count})
                        </span>
                      </>
                    )}
                  </p>
                  <p className="text-[11px] text-ash/70 mt-3 font-mono">
                    {w.total_entries} verified{' '}
                    {w.total_entries === 1 ? 'entry' : 'entries'}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* TRUST PILLARS */}
      <section className="px-6 py-16 border-t border-seam">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter text-center">
            Built on four lines we don’t cross.
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">
            <Pillar
              title="Owner-controlled"
              body="Your record. Your codes. Your share links. Workshops can log; only you can publish."
            />
            <Pillar
              title="Immutable after 24h"
              body="Workshop entries lock after a one-day retract window. No edits, no rewrites — just the truth that was."
            />
            <Pillar
              title="Verified workshops"
              body="Trade-license-backed Silver tier. 100+ entries + 4.5★ rating Gold tier. The directory is curated, not pay-to-play."
            />
            <Pillar
              title="Privacy as default"
              body="Workshops never see your email or phone unless you opt in. Buyers see only what your share link permits."
            />
          </div>
        </div>
      </section>

      {/* RESALE PITCH */}
      <section className="px-6 py-20 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-wallet">At resale</p>
          <h2 className="text-3xl md:text-5xl font-semibold text-chalk tracking-tighter mt-4 leading-tight">
            A passport pays for itself
            <br />
            the day you sell.
          </h2>
          <p className="text-ash mt-6 leading-relaxed text-lg">
            Buyers pay more for cars they can trust. A clean Vehkit passport — verified entries,
            consistent service cadence, honest score — is the difference between haggling and
            asking price.
          </p>
          <p className="text-ash mt-3 leading-relaxed">
            And unlike a folder of paper receipts: no forgery, no missing pages, no he-said.
          </p>
          <div className="mt-10">
            {user ? (
              <Link href="/mycars" className="pill-primary inline-flex items-center gap-2">
                Open my cars →
              </Link>
            ) : (
              <Link href="/login" className="pill-primary inline-flex items-center gap-2">
                Start your passport →
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 border-t border-seam">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter text-center">
            Common questions.
          </h2>
          <div className="mt-10 space-y-3">
            <Faq
              q="Is Vehkit free?"
              a="Yes — free for vehicle owners and free for workshops. We don’t charge for the core record. We may add paid tiers in the future for fleet operators or premium analytics, but the passport will always be free for individual owners."
            />
            <Faq
              q="What if my workshop isn’t on Vehkit yet?"
              a="No problem. You log the service yourself as an owner-attested entry. When the workshop joins, they can claim their profile. Your past entries pre-link to them automatically when names match."
            />
            <Faq
              q="Can a workshop edit a record after the 24-hour window?"
              a="No. After 24 hours, workshop-attested entries are immutable. Even Vehkit can’t edit them. This is core to the trust model — buyers can rely on what they see."
            />
            <Faq
              q="What data do workshops see about me?"
              a="Vehicle details only — make, model, plate, VIN if you’ve added it, service history with their workshop. They never see your email, phone, or full name unless you explicitly enable workshop outreach for that vehicle."
            />
            <Faq
              q="Do I need a Vehkit account to receive a passport?"
              a="No. Sellers send buyers a public share link. The buyer sees the full record without signing up. If they want to verify a specific workshop, our directory is also fully public."
            />
            <Faq
              q="What happens if I sell my car?"
              a="The buyer can request the share link from you and continue tracking under their own account. We’re working on a smoother ownership-transfer flow — for now, generate a fresh share token for the new owner and they can take it from there."
            />
            <Faq
              q="Where does my data live?"
              a="Postgres-backed (Supabase) in the Mumbai region for low UAE latency. Encrypted at rest, encrypted in transit. We don’t sell data, don’t serve ads, and never will. See our Privacy page for the full list."
            />
          </div>
        </div>
      </section>

      {/* FOOTER CTA */}
      <section className="px-6 py-20 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.3em] uppercase text-volt">Get started</p>
          <h2 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-4">
            Two minutes. One car. Forever record.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            {user ? (
              <Link href="/mycars" className="pill-primary">
                Open my cars
              </Link>
            ) : (
              <Link href="/login" className="pill-primary">
                Sign up — it’s free
              </Link>
            )}
            <Link href="/workshop/start" className="pill-ghost">
              I run a workshop
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="px-6 py-10 border-t border-seam">
        <div className="max-w-6xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <p className="text-sm font-semibold text-chalk">vehkit</p>
            <p className="text-[11px] text-ash/70 mt-1 leading-relaxed">
              Every car deserves a passport.
            </p>
          </div>
          <FooterCol
            title="Owners"
            links={[
              { href: '/login', label: 'Sign in / Sign up' },
              { href: '/mycars', label: 'My cars' },
              { href: '/workshops', label: 'Browse workshops' },
            ]}
          />
          <FooterCol
            title="Workshops"
            links={[
              { href: '/workshop/start', label: 'For workshops' },
              { href: '/workshop/claim', label: 'Claim a workshop' },
              { href: '/shop', label: 'Log an entry' },
            ]}
          />
          <FooterCol
            title="Company"
            links={[
              { href: '/privacy', label: 'Privacy' },
              { href: '/terms', label: 'Terms' },
              { href: 'mailto:hello@vehkit.com', label: 'Contact' },
            ]}
          />
        </div>
        <div className="max-w-6xl mx-auto pt-8 mt-8 border-t border-seam flex items-center justify-between flex-wrap gap-3">
          <p className="text-[10px] tracking-widest uppercase text-ash/60">
            © {new Date().getFullYear()} Vehkit · Made in Dubai
          </p>
          <p className="text-[10px] tracking-widest uppercase text-ash/60">
            One log · Every car · Every workshop
          </p>
        </div>
      </footer>
    </main>
  )
}

// ===========================================================================
// Subcomponents
// ===========================================================================

function Counter({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4 text-center">
      <p className="font-mono text-2xl md:text-3xl font-semibold text-chalk tabular-nums tracking-tighter">
        {value.toLocaleString()}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1">{label}</p>
    </div>
  )
}

function TrackCard({
  tone,
  tag,
  title,
  bullets,
  cta,
}: {
  tone: 'volt' | 'wallet' | 'chalk'
  tag: string
  title: string
  bullets: string[]
  cta: { href: string; label: string }
}) {
  const accent =
    tone === 'volt' ? 'text-volt' : tone === 'wallet' ? 'text-wallet' : 'text-chalk'
  return (
    <div className="card p-6 flex flex-col">
      <p className={`text-[10px] tracking-[0.25em] uppercase ${accent}`}>{tag}</p>
      <h3 className="text-2xl font-semibold text-chalk tracking-tighter mt-3">{title}</h3>
      <ul className="mt-5 space-y-2.5 flex-1">
        {bullets.map((b, i) => (
          <li key={i} className="text-sm text-ash leading-relaxed flex gap-2">
            <span className={`${accent} shrink-0`} aria-hidden>
              •
            </span>
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link
        href={cta.href}
        className={`mt-6 text-xs tracking-widest uppercase font-medium ${accent} hover:underline`}
      >
        {cta.label}
      </Link>
    </div>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-5">
      <div className="w-10 h-10 rounded-pill bg-volt/15 text-volt flex items-center justify-center font-mono font-semibold">
        {n}
      </div>
      <h3 className="text-base font-semibold text-chalk mt-4">{title}</h3>
      <p className="text-sm text-ash mt-2 leading-relaxed">{body}</p>
    </div>
  )
}

function ScoreRow({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.min(100, (value / max) * 100)
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ash tracking-wide">{label}</span>
        <span className="font-mono tabular-nums text-chalk">
          {value}
          <span className="text-ash"> / {max}</span>
        </span>
      </div>
      <div className="h-1 bg-iron rounded-full mt-1 overflow-hidden">
        <div
          className={`h-full ${value >= max * 0.66 ? 'bg-volt' : value >= max * 0.33 ? 'bg-wallet' : 'bg-signal/70'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function Pillar({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-5">
      <h3 className="text-base font-semibold text-chalk">{title}</h3>
      <p className="text-sm text-ash mt-2 leading-relaxed">{body}</p>
    </div>
  )
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="card p-5 group">
      <summary className="flex items-center justify-between gap-4 cursor-pointer list-none">
        <span className="text-base font-medium text-chalk">{q}</span>
        <span className="text-ash text-xl group-open:rotate-45 transition-transform">+</span>
      </summary>
      <p className="text-sm text-ash mt-3 leading-relaxed">{a}</p>
    </details>
  )
}

function FooterCol({
  title,
  links,
}: {
  title: string
  links: { href: string; label: string }[]
}) {
  return (
    <div>
      <p className="text-[10px] tracking-widest uppercase text-ash/70">{title}</p>
      <ul className="mt-3 space-y-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="text-sm text-chalk hover:text-volt transition-colors"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
