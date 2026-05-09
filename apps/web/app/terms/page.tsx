import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Terms · Vehkit',
  description: 'Terms of service for using Vehkit.',
}

export default function TermsPage() {
  return (
    <main className="min-h-[100svh] pb-16">
      <header className="sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tightest text-chalk">
            ← vehkit
          </Link>
          <Link
            href="/privacy"
            className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
          >
            Privacy
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 pt-10">
        <p className="text-[10px] tracking-[0.3em] uppercase text-volt">Vehkit · Legal</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-3">
          Terms of service
        </h1>
        <p className="text-ash mt-2 text-sm">
          Last updated: <span className="font-mono">{new Date().getFullYear()}-05-09</span>
        </p>

        <div className="mt-8 space-y-6 text-chalk/90 leading-relaxed">
          <Section title="Who can use Vehkit">
            <p>
              You can use Vehkit if you're 18 or older and capable of forming a binding
              contract under your local law. By creating an account, you agree to these terms.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You're responsible for what happens under your account. Don't share your
              magic-link emails with anyone you wouldn't trust with your data. If you suspect
              unauthorized access, email{' '}
              <a href="mailto:hello@vehkit.com" className="text-volt hover:underline">
                hello@vehkit.com
              </a>{' '}
              immediately.
            </p>
          </Section>

          <Section title="Your data">
            <p>
              The vehicles, services, photos, and notes you upload remain yours. You grant us
              a non-exclusive license to host, display, and process them strictly to operate
              Vehkit. We do not use your data to train AI models. We do not sell it to third
              parties.
            </p>
          </Section>

          <Section title="Workshop entries">
            <p>
              When a workshop logs a service to your vehicle via a one-time code, the entry
              becomes part of your record. You have a 24-hour window to retract it. After that
              window, the entry is immutable — even Vehkit cannot edit it. This is core to the
              trust model and applies equally to all parties.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>
              Don't use Vehkit to: log false services, claim workshops you don't operate,
              attempt to access other users' data, scrape the directory at industrial scale,
              or build systems that depend on Vehkit being available 24/7. We're a small team
              shipping fast — uptime is our goal but not our guarantee.
            </p>
          </Section>

          <Section title="Workshop verification tiers">
            <p>
              Silver and Gold tier badges are awarded based on entry count, customer ratings,
              and trade-license verification. Tier evaluation is automated; manual overrides
              exist only for fraud cases. Tier loss can occur if ratings drop, if the trade
              license expires, or if the workshop is found to be falsifying records.
            </p>
          </Section>

          <Section title="Pricing">
            <p>
              Vehkit is currently free for vehicle owners and free for workshops. We reserve
              the right to introduce paid tiers (e.g. fleet enterprise, premium analytics) but
              the personal vehicle passport will remain free. We will give 30 days' notice
              before any pricing change that affects existing users.
            </p>
          </Section>

          <Section title="Disclaimer">
            <p>
              Vehkit is a record-keeping tool. We do not guarantee the accuracy of entries
              made by individual users or workshops. Buyers reviewing a passport should verify
              critical details (chassis number, accident history, emirate registration)
              through official channels (RTA, insurance reports). Vehkit is not a substitute
              for due diligence — it's a layer on top of it.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              To the extent permitted by UAE law, Vehkit is provided "as is" without warranty
              of any kind. We are not liable for indirect, incidental, or consequential
              damages arising from use of the service. Our total liability in any claim is
              limited to AED 500 or fees you've paid us in the past 12 months, whichever is
              greater. (Today, that's AED 500.)
            </p>
          </Section>

          <Section title="Termination">
            <p>
              You can delete your account at any time via{' '}
              <a href="mailto:hello@vehkit.com" className="text-volt hover:underline">
                hello@vehkit.com
              </a>
              . We can suspend accounts that violate these terms. Workshop-attested entries
              survive account deletion in anonymized form (see Privacy).
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the laws of the United Arab Emirates. Disputes
              are resolved in Dubai courts unless local consumer law mandates otherwise.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We update these terms occasionally. Material changes will be emailed to you 30
              days before they take effect.
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-seam">
          <p className="text-sm text-ash leading-relaxed">
            Questions: email{' '}
            <a href="mailto:hello@vehkit.com" className="text-volt hover:underline">
              hello@vehkit.com
            </a>
            .
          </p>
        </div>
      </article>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xs tracking-widest uppercase text-ash mb-2">{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  )
}
