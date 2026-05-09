import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import { MarketingHeader, MarketingFooter } from '@/components/MarketingChrome'

export const metadata: Metadata = {
  title: 'For workshops',
  description:
    'Free verified portfolio for UAE auto workshops. Customer hands you a code, you log the service, your name stays on the record forever.',
}

export default async function ForWorkshopsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-[100svh] flex flex-col">
      <MarketingHeader signedIn={!!user} />

      {/* HERO */}
      <section className="px-6 md:px-10 pt-16 md:pt-24 pb-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            For workshops
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
            Put your work
            <br />
            on the record.
          </h1>
          <p className="text-lg text-ash mt-8 leading-relaxed max-w-2xl">
            When the customer's next workshop asks{' '}
            <em className="text-chalk not-italic">"who did this last?"</em> —
            your name should be the answer. Vehkit gives you a verified entry
            on every car you service, a portfolio that compounds across
            customers, and a free dashboard that runs your shop.
          </p>
          <div className="mt-12 flex items-center gap-6">
            <Link href="/workshop/claim" className="pill-primary inline-flex items-center">
              Claim your workshop
            </Link>
            <Link
              href="/workshops"
              className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
            >
              See the directory →
            </Link>
          </div>
        </div>
      </section>

      {/* WHAT IT GIVES YOU */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            What you get
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05] max-w-3xl">
            More than a logbook.
          </h2>

          <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-12">
            <Feature
              n="01"
              title="A verified portfolio that travels."
              body="Every entry you attest stays on that car forever. When the owner sells in three years, the buyer reads your name. When the owner moves to a new workshop, that workshop sees what you did. Reputation compounds across customers, not against them."
            />
            <Feature
              n="02"
              title="A dashboard that runs your shop."
              body="Customer roster sorted by last visit. Upcoming reminders on cars you've serviced. Pending entries awaiting confirmation. Recent reviews. Multi-axis ratings. Twelve-week trend charts. Free, unlimited."
            />
            <Feature
              n="03"
              title="Verified outreach, on the customer's terms."
              body="When an owner opts in, you can plant a service reminder on their car — they see it in their inbox marked as suggested by you. You never get their email or phone. Trust compounds; spam doesn't."
            />
            <Feature
              n="04"
              title="A directory that earns visibility."
              body="Verified workshops climb the public directory. Buyers and prospective customers find you. Tiered: ten entries plus a trade license earns Silver. A hundred entries, four-and-a-half-star average, five reviews earns Gold. Ranking is curated by data, not by money."
            />
          </div>
        </div>
      </section>

      {/* TIER LADDER */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            The verification ladder
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05] max-w-3xl">
            Climb on data, not dues.
          </h2>

          <div className="mt-12 grid md:grid-cols-3 gap-px bg-seam rounded-DEFAULT overflow-hidden">
            <Tier
              label="Member"
              tone="ash"
              criteria={[
                'Free to claim',
                'Listed in the directory',
                'Customer entries attribute to you',
                'Full dashboard',
              ]}
            />
            <Tier
              label="Silver Verified"
              tone="volt"
              criteria={[
                'Trade license uploaded',
                '10+ verified service entries',
                'Silver badge in directory',
                'Higher placement in search',
              ]}
            />
            <Tier
              label="Gold Verified"
              tone="wallet"
              criteria={[
                'Trade license uploaded',
                '100+ verified service entries',
                '4.5★ average across 5+ reviews',
                'Gold badge, top of directory',
              ]}
            />
          </div>

          <p className="text-sm text-ash mt-6 leading-relaxed max-w-2xl">
            Tiers are evaluated automatically. There's no application fee, no
            subscription, no premium tier. The data does the gatekeeping.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS — editorial, not card-grid */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            How an entry happens
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
            The whole loop in
            <br />
            ninety seconds.
          </h2>

          <div className="mt-12 space-y-12">
            <FlowStep
              n="①"
              who="The customer"
              action="generates a six-digit code"
              detail="On their car page, they tap Generate workshop code. Vehkit issues a single-use code that expires in one hour."
            />
            <FlowStep
              n="②"
              who="You"
              action="enter the code at vehkit.com/shop"
              detail="If you're signed in to your workshop dashboard, your shop is already attached. Fill in service type, date, odometer, cost. Tap submit."
            />
            <FlowStep
              n="③"
              who="The owner"
              action="confirms the entry — or not"
              detail="They get an email and a notification. They have twenty-four hours to retract if you logged the wrong thing. After that, the record is permanent. Most owners confirm immediately."
            />
            <FlowStep
              n="④"
              who="The score"
              action="updates on the car's passport"
              detail="Verified entries lift the verification component. Workshop diversity rewards the second and third shop on a car's history. Your name is now part of that car's permanent record."
            />
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Sign your shop up
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tightest text-chalk mt-4 leading-[1.05]">
            Free. Always.
            <br />
            No credit card.
          </h2>
          <p className="text-base text-ash mt-6 leading-relaxed max-w-md mx-auto">
            Five minutes to claim. Your first verified entry takes another two.
            Your portfolio starts the moment a customer hands you their first
            code.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6">
            <Link href="/workshop/claim" className="pill-primary inline-flex items-center">
              Claim your workshop
            </Link>
            <Link
              href="/login?next=%2Fworkshop"
              className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
            >
              Already have an account →
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}

function Feature({
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

function Tier({
  label,
  tone,
  criteria,
}: {
  label: string
  tone: 'ash' | 'volt' | 'wallet'
  criteria: string[]
}) {
  const accent =
    tone === 'volt' ? 'text-volt' : tone === 'wallet' ? 'text-wallet' : 'text-ash'
  return (
    <div className="bg-noir px-6 py-7">
      <p className={`text-[10px] tracking-[0.25em] uppercase font-medium ${accent}`}>
        {label}
      </p>
      <ul className="mt-5 space-y-2">
        {criteria.map((c, i) => (
          <li key={i} className="text-sm text-chalk/85 leading-relaxed">
            · {c}
          </li>
        ))}
      </ul>
    </div>
  )
}

function FlowStep({
  n,
  who,
  action,
  detail,
}: {
  n: string
  who: string
  action: string
  detail: string
}) {
  return (
    <div className="grid md:grid-cols-12 gap-4 md:gap-8">
      <div className="md:col-span-4">
        <span className="font-mono text-volt text-xl">{n}</span>
        <p className="text-base font-semibold text-chalk tracking-tight mt-1">
          {who}{' '}
          <span className="text-ash font-normal">{action}</span>
        </p>
      </div>
      <div className="md:col-span-8">
        <p className="text-base text-ash leading-relaxed">{detail}</p>
      </div>
    </div>
  )
}
