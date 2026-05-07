import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="min-h-[100svh] flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center space-y-8">
          <p className="nav-pill">vehkit</p>

          <h1 className="text-hero md:text-hero-lg font-semibold tracking-tightest text-chalk">
            Every car deserves<br />a passport.
          </h1>

          <p className="text-lg text-ash max-w-md mx-auto leading-relaxed">
            One record for every service, repair, and upgrade — across every car you own.
          </p>

          <div className="pt-4">
            {user ? (
              <Link href="/garage" className="pill-primary inline-flex items-center gap-2">
                Open my garage <span aria-hidden>→</span>
              </Link>
            ) : (
              <Link href="/login" className="pill-primary inline-flex items-center">
                Get started
              </Link>
            )}
          </div>
        </div>
      </div>

      <footer className="px-6 py-8 text-center">
        <p className="text-xs tracking-widest uppercase text-ash/60">
          One log · Every car · Every workshop
        </p>
      </footer>
    </main>
  )
}
