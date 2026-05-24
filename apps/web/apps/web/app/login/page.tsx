import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { requestMagicLink } from '@/app/actions/auth'

export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; sent?: string; email?: string }>
}) {
  const sp = await searchParams
  const next = sp.next ?? '/mycars'
  const errorMsg = sp.error
  const sent = sp.sent === '1'
  const sentEmail = sp.email

  // If already signed in, skip the form
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user && !sent) redirect(next)

  // Contextual headline based on `next`
  const ctx = contextLabel(next)

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>

        <div className="mt-10">
          <p className="text-[10px] tracking-[0.3em] uppercase text-volt">
            {ctx.eyebrow}
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
            {ctx.heading}
          </h1>
          <p className="text-sm text-ash mt-2 leading-relaxed">{ctx.sub}</p>
        </div>

        {sent ? (
          <div className="card p-6 mt-8">
            <p className="text-chalk font-medium">Check your inbox.</p>
            <p className="text-sm text-ash mt-1.5">
              We sent a sign-in link to{' '}
              <span className="font-mono text-chalk">{sentEmail ?? 'your email'}</span>.
            </p>
            <p className="text-xs text-ash/70 mt-4 leading-relaxed">
              Link expires in 5 minutes. Use it on the same device. The link is one-time —
              click it once and you're in.
            </p>
            <div className="mt-5 pt-4 border-t border-seam text-[11px] text-ash">
              Didn't get it?{' '}
              <Link href="/login" className="text-volt hover:underline">
                Try again
              </Link>
              .
            </div>
          </div>
        ) : (
          <form action={requestMagicLink} className="space-y-3 mt-8">
            <input type="hidden" name="next" value={next} />
            <input
              type="email"
              name="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              className="field"
            />
            <button type="submit" className="pill-primary w-full">
              Send magic link
            </button>
            {errorMsg && (
              <p className="text-sm text-signal">{decodeURIComponent(errorMsg)}</p>
            )}
            <p className="text-[11px] text-ash/70 leading-relaxed pt-2">
              We email a one-time sign-in link. No password needed.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

function contextLabel(next: string): {
  eyebrow: string
  heading: string
  sub: string
} {
  if (next === '/workshop' || next.startsWith('/workshop/')) {
    return {
      eyebrow: 'Workshop sign-in',
      heading: 'Sign in to your workshop',
      sub: "We'll email you a one-time link. Lands you straight on your dashboard.",
    }
  }
  if (next === '/agent' || next.startsWith('/agent/')) {
    return {
      eyebrow: 'Agent sign-in',
      heading: 'Sign in to your agent desk',
      sub: 'Insurance brokers, fleet desks, leasing operators. One-time link, no password.',
    }
  }
  if (next === '/admin' || next.startsWith('/admin/')) {
    return {
      eyebrow: 'Admin',
      heading: 'Sign in',
      sub: 'Internal access only.',
    }
  }
  if (next.startsWith('/a/')) {
    return {
      eyebrow: 'Family invite',
      heading: 'Sign in to accept',
      sub: "We'll email you a link. Click it and the vehicle is added to your account.",
    }
  }
  if (next.startsWith('/f/')) {
    return {
      eyebrow: 'Fleet invite',
      heading: 'Sign in to join the fleet',
      sub: "Click the link in your email — you'll land in the fleet dashboard.",
    }
  }
  return {
    eyebrow: 'Sign in',
    heading: 'Welcome back',
    sub: "We'll email you a magic link. No password to remember.",
  }
}
