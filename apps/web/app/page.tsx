import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-2xl text-center space-y-6">
        <p className="text-sm tracking-widest uppercase text-steel">vehkit</p>
        <h1 className="text-5xl md:text-6xl font-semibold tracking-tightest text-ink">
          Every car deserves a passport.
        </h1>
        <p className="text-lg text-steel max-w-lg mx-auto leading-relaxed">
          A permanent, owner-controlled record of every service, repair, and upgrade — across every
          car you own.
        </p>
        <div className="pt-6 flex gap-3 justify-center">
          {user ? (
            <Link
              href="/garage"
              className="inline-flex items-center bg-ink text-cream px-6 py-3 rounded font-medium hover:bg-ink/90 transition-colors"
            >
              Open my garage →
            </Link>
          ) : (
            <Link
              href="/login"
              className="inline-flex items-center bg-ink text-cream px-6 py-3 rounded font-medium hover:bg-ink/90 transition-colors"
            >
              Sign in
            </Link>
          )}
        </div>
        <p className="pt-12 text-sm text-steel/70">
          One log. Every car. Every workshop.
        </p>
      </div>
    </main>
  )
}
