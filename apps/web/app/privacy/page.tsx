import Link from 'next/link'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy · Vehkit',
  description:
    'How Vehkit handles personal data, vehicle records, and workshop information. UAE PDPL aligned.',
}

export default function PrivacyPage() {
  return (
    <main className="min-h-[100svh] pb-16">
      <header className="sticky top-0 z-30 bg-noir/90 backdrop-blur border-b border-seam">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold tracking-tightest text-chalk">
            ← vehkit
          </Link>
          <Link
            href="/terms"
            className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
          >
            Terms
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 pt-10">
        <p className="text-[10px] tracking-[0.3em] uppercase text-volt">Vehkit · Legal</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-3">
          Privacy
        </h1>
        <p className="text-ash mt-2 text-sm">
          Last updated: <span className="font-mono">{new Date().getFullYear()}-05-09</span>
        </p>

        <div className="mt-8 space-y-6 text-chalk/90 leading-relaxed">
          <Section title="What we collect">
            <p>
              When you use Vehkit, we collect: your email address (for sign-in), your full name
              and phone number if you choose to provide them, and the vehicle data you enter —
              make, model, plate, VIN, color, odometer, service records, and photos you upload.
            </p>
          </Section>

          <Section title="What we don't collect">
            <p>
              We do not collect biometrics, location history, contacts, or call/SMS metadata.
              We do not track you across other websites. We do not run advertising networks. We
              do not sell data — to anyone, ever.
            </p>
          </Section>

          <Section title="Workshop visibility">
            <p>
              Workshops you visit see only the vehicle context they need to log a service:
              make, model, plate, optional VIN, and your service history with their workshop.
              They do not see your email, phone, or full name unless you explicitly enable
              workshop outreach for that vehicle in the vehicle's settings.
            </p>
          </Section>

          <Section title="Public share links">
            <p>
              You can generate a public share link for any of your vehicles. Anyone with the
              link sees the vehicle's verified service history. No login required. You can
              revoke the link at any time. View counts are anonymous.
            </p>
          </Section>

          <Section title="Where data lives">
            <p>
              Vehkit data is hosted on Supabase (Postgres) in the Mumbai region for low UAE
              latency. Email is sent via Resend. The application runs on Vercel. All
              communication is encrypted in transit (HTTPS). All data is encrypted at rest.
            </p>
          </Section>

          <Section title="Your rights (UAE PDPL · EU GDPR)">
            <p>
              You can request: a copy of your data, deletion of your data, correction of
              inaccurate data, and objection to processing. Email{' '}
              <a href="mailto:hello@vehkit.com" className="text-volt hover:underline">
                hello@vehkit.com
              </a>{' '}
              and we'll respond within 30 days.
            </p>
            <p>
              Account deletion removes your profile, vehicles, services, photos, and
              reminders. Workshop-attested entries about your vehicles are anonymized but
              retained as part of the verified workshop's history (this is by design — to
              prevent retroactive history tampering).
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              Vehkit uses two functional cookies: a Supabase auth session cookie (so you stay
              signed in) and an admin session cookie (only for our internal ops console). We
              don't use tracking cookies, advertising cookies, or third-party analytics
              cookies that follow you across sites.
            </p>
          </Section>

          <Section title="Updates">
            <p>
              When this policy changes materially, we'll email you and post a banner. Minor
              clarifications will be reflected in the "Last updated" date above.
            </p>
          </Section>
        </div>

        <div className="mt-12 pt-6 border-t border-seam">
          <p className="text-sm text-ash leading-relaxed">
            Privacy questions: email{' '}
            <a href="mailto:hello@vehkit.com" className="text-volt hover:underline">
              hello@vehkit.com
            </a>
            . We read everything.
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
