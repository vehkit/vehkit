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
            Free dashboard.
            <br />
            Free customers.
            <br />
            <span className="text-volt">Free for life.</span>
          </h1>
          <p className="text-lg md:text-xl text-chalk mt-8 leading-relaxed max-w-2xl font-medium">
            List your shop. Log a customer&apos;s service in 60 seconds. They
            get reminders, you stay on the record. New customers find you in
            our directory.
          </p>
          <p className="text-base text-ash mt-5 leading-relaxed max-w-2xl">
            No subscription. No commission. No credit card. We don&apos;t
            charge you, we don&apos;t take a cut of your jobs, and we
            don&apos;t sell ads to your competitors.
          </p>
          <div className="mt-12 flex items-center gap-6 flex-wrap">
            <Link href="/workshop/claim" className="pill-primary inline-flex items-center">
              Claim your workshop — free
            </Link>
            <Link
              href="/workshops"
              className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
            >
              See workshops on Vehkit →
            </Link>
          </div>
        </div>
      </section>

      {/* QUICK PROOF — 3 stat-cards: what you get on day one */}
      <section className="px-6 md:px-10 pb-16 border-t border-seam pt-16">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash mb-8">
            What you get on day one
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <ProofCard
              big="A profile page"
              small="A live page customers can find — your name, location, services, reviews. Public, searchable, free."
            />
            <ProofCard
              big="A dashboard"
              small="Customer list, upcoming reminders, pending entries, recent reviews — everything you need to run your shop on one screen."
            />
            <ProofCard
              big="A reputation"
              small="Every service you log stays on that car forever. When the owner sells, the buyer sees your name. Loyalty travels with the car."
            />
          </div>
        </div>
      </section>

      {/* WHAT IT GIVES YOU — scannable, one-line bodies */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            What you get
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05] max-w-3xl">
            More than a logbook.
          </h2>

          <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-10">
            <Feature
              n="01"
              title="Your name stays with the car"
              body="Every service you log is locked to that car forever. The next owner sees you did it. The next workshop sees you did it. Your work earns you future customers."
            />
            <Feature
              n="02"
              title="A real dashboard, not a spreadsheet"
              body="Customers sorted by last visit. Cars due for service. Reviews you've earned. Reminders you can send. All free, all in your browser, no software to install."
            />
            <Feature
              n="03"
              title="Send reminders without spamming"
              body="When a customer opts in, you can flag their car for a service nudge. They get it in their email. You never see their phone or address. No spam, no risk."
            />
            <Feature
              n="04"
              title="Get found by new customers"
              body="The Vehkit directory is the first place buyers look for verified shops. Earn Silver after 10 jobs and a trade licence. Earn Gold after 100 jobs and 5 reviews. No paid placement."
            />
          </div>
        </div>
      </section>

      {/* IS THIS REALLY FREE — addresses the big skeptical question */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Honest answers
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
            Is this actually free?
          </h2>
          <p className="text-base text-ash mt-6 leading-relaxed">
            Yes, and we want to be transparent about why so it doesn&apos;t
            feel like a trap.
          </p>

          <div className="mt-12 space-y-8">
            <FAQ
              q="Do you take a cut of my jobs?"
              a="No. You charge whatever you charge. We never see prices unless the customer chooses to log them, and even then it&apos;s their record, not ours to monetise."
            />
            <FAQ
              q="Will you start charging later?"
              a="The dashboard, profile, customer list, and directory listing stay free for workshops, period. Our revenue comes from the agent side — insurance brokers, leasing desks, buyers — paying for verified document access. Not from you."
            />
            <FAQ
              q="Will customers see my prices?"
              a="Only the cost field on entries you log, if you fill it in. Leave it blank and no one sees a price. The customer is in control of what they share with buyers."
            />
            <FAQ
              q="Do I need a website or fancy software?"
              a="No. Vehkit runs in your browser. You can log a service from your phone in the bay. No app, no install, no IT person required."
            />
          </div>
        </div>
      </section>

      {/* TIER LADDER */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-5xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            How you climb the directory
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05] max-w-3xl">
            Earned by work,
            <br />
            not paid for.
          </h2>

          <div className="mt-12 grid md:grid-cols-3 gap-px bg-seam rounded-DEFAULT overflow-hidden">
            <Tier
              label="Member"
              tone="ash"
              criteria={[
                'Free to claim',
                'Listed in our directory',
                'Customer entries show your name',
                'Full dashboard from day one',
              ]}
            />
            <Tier
              label="Silver"
              tone="volt"
              criteria={[
                'Upload your trade licence',
                '10+ verified services logged',
                'Silver badge on your profile',
                'Ranked above unverified shops',
              ]}
            />
            <Tier
              label="Gold"
              tone="wallet"
              criteria={[
                'Trade licence + 100+ services',
                '4.5★ average, 5+ reviews',
                'Gold badge, top of directory',
                'Featured on the home page',
              ]}
            />
          </div>

          <p className="text-sm text-ash mt-6 leading-relaxed max-w-2xl">
            Tiers update automatically. No fees, no application, no premium
            upgrade. Do the work — the badge follows.
          </p>
        </div>
      </section>

      {/* HOW IT WORKS — plain language, shop owner's POV */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            Logging a service
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
            Under a minute,
            <br />
            from start to done.
          </h2>

          <div className="mt-12 space-y-12">
            <FlowStep
              n="①"
              who="The customer"
              action="hands you a 6-digit code"
              detail="They tap a button on their car page in Vehkit and read you the code. It works once and expires in an hour."
            />
            <FlowStep
              n="②"
              who="You"
              action="open vehkit.com/shop and type the code"
              detail="Already signed in? Your shop name is pre-filled. Type the service (oil change, brakes, whatever), the date, the kilometres, the cost. Tap submit."
            />
            <FlowStep
              n="③"
              who="The customer"
              action="confirms it's right"
              detail="They get an email and see it in their Vehkit. They tap confirm — or retract if you made a typo. After 24 hours it locks in permanently."
            />
            <FlowStep
              n="④"
              who="Your name"
              action="is now on that car forever"
              detail="Your shop appears in their service history, in their next workshop's view of the car, and in the buyer's view when they sell. Your work earns you future work."
            />
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Ready when you are
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tightest text-chalk mt-4 leading-[1.05]">
            Free. Always.
            <br />
            No credit card.
          </h2>
          <p className="text-base text-ash mt-6 leading-relaxed max-w-md mx-auto">
            5 minutes to set up your shop. 60 seconds to log your first
            service. Then it just runs in the background while you do the
            work.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6 flex-wrap">
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

function ProofCard({ big, small }: { big: string; small: string }) {
  return (
    <div className="card p-6">
      <p className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-tight">
        {big}
      </p>
      <p className="text-sm text-ash mt-3 leading-relaxed">{small}</p>
    </div>
  )
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="grid md:grid-cols-12 gap-3 md:gap-8">
      <div className="md:col-span-5">
        <h3 className="text-lg font-semibold text-chalk tracking-tight leading-snug">
          {q}
        </h3>
      </div>
      <div className="md:col-span-7">
        <p className="text-base text-ash leading-relaxed">{a}</p>
      </div>
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
