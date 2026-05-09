import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@/lib/supabase/server'
import {
  MarketingHeader,
  MarketingFooter,
  SamplePassport,
} from '@/components/MarketingChrome'

export const metadata: Metadata = {
  title: 'For buyers',
  description:
    "Don't buy a used car in the UAE without a Vehkit passport. Verified service history, on-time compliance, immutable record — built for resale.",
}

export default async function BuyersPage() {
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
            For buyers
          </p>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tightest text-chalk mt-6 leading-[0.95]">
            Don't buy a used car
            <br />
            without one.
          </h1>
          <p className="text-lg text-ash mt-8 leading-relaxed max-w-2xl">
            The price you pay is set by what the seller can prove. Photos
            don't prove. Stickers don't prove. A folder of receipts is half a
            story you can't verify. A Vehkit passport is the rest of it —
            owner-issued, workshop-attested, and impossible to backdate.
          </p>
        </div>
      </section>

      {/* THE PROBLEM */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            The problem you're solving
          </p>
          <p className="text-2xl md:text-3xl text-chalk mt-6 leading-relaxed tracking-tight">
            Every used car comes with two histories. The one the seller tells
            you, and the one the car remembers. The first is convenient. The
            second is rare. Vehkit makes the second portable.
          </p>
          <p className="text-base text-ash mt-8 leading-relaxed">
            Without it, you're buying on photos, plate number, a driving
            impression, and the seller's word. The asking price is set by
            condition the seller asserts. The price you should be paying is
            set by condition the car can prove. Vehkit is the difference.
          </p>
        </div>
      </section>

      {/* WHAT YOU SEE */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-6xl mx-auto grid md:grid-cols-12 gap-12 items-center">
          <div className="md:col-span-7">
            <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
              What a passport shows you
            </p>
            <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
              The whole record,
              <br />
              in one link.
            </h2>
            <ul className="mt-10 space-y-5">
              <Bullet
                title="Every verified service"
                body="Date, kilometers, type, cost, the workshop that performed it. No edits, no deletions — what's there is what was."
              />
              <Bullet
                title="The Vehkit Score"
                body="A zero-to-a-hundred summary. Verification, compliance, consistency, recency. A number you can compare across cars."
              />
              <Bullet
                title="Workshop tier"
                body="Each entry's workshop carries its own tier — Member, Silver, Gold. A car serviced exclusively by Gold-tier shops reads differently than one serviced by anyone."
              />
              <Bullet
                title="The gaps"
                body="A passport with a two-year gap is honest about it. You see the gap. You ask about the gap. You price the gap."
              />
            </ul>
          </div>
          <div className="md:col-span-5 md:flex md:justify-end">
            <SamplePassport />
          </div>
        </div>
      </section>

      {/* WHAT TO LOOK FOR */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-4xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-ash">
            How to read a passport
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tighter text-chalk mt-4 leading-[1.05]">
            Four questions a number answers.
          </h2>

          <div className="mt-12 space-y-12">
            <Question
              q="Is the score above 70?"
              a="A car at 70+ has consistent verified service, decent compliance, and recent care. Below that, ask why. The seller may have a reasonable answer (long-term storage, recent purchase, single-owner manual records). They may not."
            />
            <Question
              q="Are the workshops verified?"
              a="Entries from Silver and Gold workshops are stronger signal than entries from unverified shops. A car with all-Gold history is rare and worth a premium. A car with all-unverified history isn't a red flag — but it's a yellow one."
            />
            <Question
              q="Is the cadence steady?"
              a="A car that's serviced every six months for five years tells a different story than one with a flurry of entries in the last three months. Careful owners service on a schedule. Pre-sale owners service when they're about to sell."
            />
            <Question
              q="What's missing?"
              a="The passport shows what was logged. If the car has 80,000 km and only two oil changes recorded, that's not a Vehkit problem — that's an owner problem. Now you know."
            />
          </div>
        </div>
      </section>

      {/* PRIVACY NOTE */}
      <section className="px-6 md:px-10 py-20 md:py-24 border-t border-seam">
        <div className="max-w-3xl mx-auto">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            What you don't see
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tighter text-chalk mt-4 leading-tight">
            We respect both sides.
          </h2>
          <p className="text-base text-ash mt-8 leading-relaxed">
            A passport doesn't reveal the seller's email, phone, full name, or
            any contact information. The seller controls the link, the link
            expires, and they can revoke it at any time. You see the record;
            they keep their privacy. That's why owners are willing to share.
          </p>
        </div>
      </section>

      {/* CLOSE */}
      <section className="px-6 md:px-10 py-24 md:py-32 border-t border-seam">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-[10px] tracking-[0.35em] uppercase text-volt">
            Selling soon? Buying soon?
          </p>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tightest text-chalk mt-4 leading-[1.05]">
            Don't sign without a passport.
          </h2>
          <p className="text-base text-ash mt-6 leading-relaxed max-w-md mx-auto">
            Ask the seller. If they don't have one, ask them to start one. The
            record begins the moment they sign up — they have nothing to hide
            if they have nothing to hide.
          </p>
          <div className="mt-12 flex items-center justify-center gap-6">
            <Link
              href="/workshops"
              className="pill-primary inline-flex items-center"
            >
              See verified workshops
            </Link>
            <Link
              href="/score"
              className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
            >
              How the score works →
            </Link>
          </div>
        </div>
      </section>

      <MarketingFooter />
    </main>
  )
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="font-mono text-xs text-volt mt-1.5 shrink-0">·</span>
      <div>
        <p className="text-base font-semibold text-chalk tracking-tight">
          {title}
        </p>
        <p className="text-sm text-ash mt-1.5 leading-relaxed">{body}</p>
      </div>
    </li>
  )
}

function Question({ q, a }: { q: string; a: string }) {
  return (
    <div className="grid md:grid-cols-12 gap-4 md:gap-12">
      <div className="md:col-span-4">
        <h3 className="text-lg font-semibold text-chalk tracking-tight">{q}</h3>
      </div>
      <div className="md:col-span-8">
        <p className="text-base text-ash leading-relaxed">{a}</p>
      </div>
    </div>
  )
}
