import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import {
  MarketingHeader,
  MarketingFooter,
  SamplePassport,
} from '@/components/MarketingChrome'

export const metadata: Metadata = {
  title: 'The Vehkit Score',
  description:
    'A 0–100 number for every car. Verified service, on-time compliance, history continuity, recency. The methodology in detail.',
}

export default async function ScorePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-[100svh] flex flex-col">
      <MarketingHeader signedIn={!!user} />

      {/* HERO */}
      <section className="px-6 md:px-10 pt-16 md:pt-24 pb-16 md:pb-20">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            The Vehkit Score
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
            A number worth
            <br />
            more than the photos.
          </h1>
          <p className="text-lg text-ash mt-8 leading-relaxed max-w-2xl">
            Every car on Vehkit gets a passport score from zero to a hundred.
            It's not a marketing label. It's a function of four things every
            careful owner already does — recorded over time, attested by the
            workshops who did the work, and resistant to gaming by any single
            shop.
          </p>
        </div>
      </section>

      {/* COMPONENTS — long-form editorial */}
      <section className="px-6 md:px-10 py-16 md:py-20 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash mb-12">
            The four components
          </p>

          <Component
            n="01"
            title="Verification"
            weight="40 points"
            paragraph="Most points come from how many of your services are attested by a verified workshop versus self-logged. Each workshop-verified entry is worth three points, capped at thirty. The remaining ten points come from workshop diversity — five if at least two distinct shops have logged work, five more for any entries by Silver- or Gold-tier shops. The diversification cap means a single workshop attestating a hundred fake services cannot push your score past thirty in this category."
          />

          <Component
            n="02"
            title="Compliance"
            weight="30 points"
            paragraph="When a service is logged, Vehkit auto-creates a reminder for the next one — by date, kilometers, or both. This category measures the ratio of completed reminders to (completed plus missed). A car with twelve reminders, ten completed and two missed, scores 25 of 30. Currently overdue reminders deduct up to ten points — every car with a brake fluid flush three months overdue takes a hit, regardless of past compliance."
          />

          <Component
            n="03"
            title="Consistency"
            weight="20 points"
            paragraph="A car that's been serviced twice a year for four years has eight verified entries; one serviced once in five years has one. The score divides total entries by the vehicle's age in years and benchmarks against two-per-year as the full score. This rewards continuous care, not bursts of activity. Brand-new cars (less than a year old) get full points by default — there hasn't been time to build a pattern yet."
          />

          <Component
            n="04"
            title="Recency"
            weight="10 points"
            paragraph="When was the last service? Within six months earns the full ten. Within twelve, half. Older than a year, zero. A car can have a clean history and still drop here if it's been sitting in a garage for two years — buyers should know."
          />
        </div>
      </section>

      {/* SAMPLE — visual */}
      <section className="px-6 md:px-10 py-16 md:py-20 border-t border-seam">
        <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
              Sample
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
              An 87. Healthy.
              <br />
              Not perfect.
            </h2>
            <p className="text-base text-ash mt-8 leading-relaxed max-w-md">
              Twelve verified entries from two workshops. One overdue reminder
              (brake fluid). Last service three weeks ago. Eighty-seven of a
              hundred. The buyer sees this. So does the owner. So does the
              insurance broker, eventually.
            </p>
            <p className="text-sm text-ash/80 mt-6 leading-relaxed max-w-md">
              The lost thirteen points are recoverable. Catch up on that brake
              fluid and recency stays full → 90+. The score is dynamic, not a
              one-shot grade.
            </p>
          </div>
          <div className="md:col-span-5 md:flex md:justify-end">
            <SamplePassport />
          </div>
        </div>
      </section>

      {/* ANTI-GAMING */}
      <section className="px-6 md:px-10 py-16 md:py-20 border-t border-seam">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Why this resists gaming
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter text-chalk mt-4 leading-tight">
            Three structural defenses,
            <br />
            no human moderation.
          </h2>

          <div className="mt-12 space-y-10">
            <Defense
              title="No one workshop dominates."
              body="The verification component caps any single workshop's contribution at thirty of forty. To max out the category, the car needs entries from at least two distinct shops, and ideally one of them is Silver- or Gold-tier. A friend running a fake garage can't single-handedly inflate a friend's resale score."
            />
            <Defense
              title="Owners can't backfill history."
              body="Owner-logged entries (no workshop attestation) earn no points in the verification category. They're recorded and visible — the buyer can see them — but they don't move the score. The number is built from third-party attestations, not self-reports."
            />
            <Defense
              title="Compliance fights vanity."
              body="A workshop can attest entries all day, but if the owner ignores the reminders it generates, the compliance component drops fast. The four components are correlated by intent, not by single signal — a high score requires the owner to actually maintain the car, not just stack receipts."
            />
          </div>
        </div>
      </section>

      {/* WHO USES IT */}
      <section className="px-6 md:px-10 py-16 md:py-20 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            Who reads the score
          </p>
          <div className="grid md:grid-cols-3 gap-12 mt-10">
            <ScoreReader
              kicker="Owners"
              body="A live indicator of whether your car is well-cared-for, missed-up, or somewhere in between. Most owners see their score climb after the second verified service, plateau, then drop if they skip a year."
            />
            <ScoreReader
              kicker="Buyers"
              body="The single number that summarises a car's history when the seller hands you a passport link. A car at 30 with photos that look fine should make you ask harder questions than a car at 85."
            />
            <ScoreReader
              kicker="Workshops"
              body="Every customer they keep on Vehkit raises that customer's score. Workshops climbing the verification tier get found in the directory; their reputation compounds with their customers'."
            />
          </div>
        </div>
      </section>

      {/* CLOSE */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Try it
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tightest text-chalk mt-4 leading-[1.05]">
            See your car's score.
          </h2>
          <p className="text-base text-ash mt-6 leading-relaxed max-w-md mx-auto">
            Add a vehicle, log one service, the score appears. The number moves
            in real time as your record grows.
          </p>
          <div className="mt-12">
            {user ? (
              <Link href="/mycars" className="pill-primary inline-flex items-center">
                Open my cars
              </Link>
            ) : (
              <Link href="/login" className="pill-primary inline-flex items-center">
                Start your first car
              </Link>
            )}
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}

function Component({
  n,
  title,
  weight,
  paragraph,
}: {
  n: string
  title: string
  weight: string
  paragraph: string
}) {
  return (
    <div className="grid md:grid-cols-12 gap-6 md:gap-12 py-10 border-t border-seam first:border-t-0 first:pt-0">
      <div className="md:col-span-3">
        <p className="font-mono text-xs text-volt tabular-nums">{n}.</p>
        <h3 className="text-xl font-semibold text-chalk tracking-tight mt-2">
          {title}
        </h3>
        <p className="text-[10px] tracking-widest uppercase text-ash mt-2 font-mono">
          {weight}
        </p>
      </div>
      <div className="md:col-span-9">
        <p className="text-base text-chalk/85 leading-relaxed">{paragraph}</p>
      </div>
    </div>
  )
}

function Defense({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid md:grid-cols-12 gap-4 md:gap-12">
      <div className="md:col-span-4">
        <h3 className="text-lg font-semibold text-chalk tracking-tight">
          {title}
        </h3>
      </div>
      <div className="md:col-span-8">
        <p className="text-base text-ash leading-relaxed">{body}</p>
      </div>
    </div>
  )
}

function ScoreReader({ kicker, body }: { kicker: string; body: string }) {
  return (
    <div>
      <p className="text-[10px] tracking-[0.25em] uppercase text-volt">
        {kicker}
      </p>
      <p className="text-sm text-chalk/85 mt-3 leading-relaxed">{body}</p>
    </div>
  )
}
