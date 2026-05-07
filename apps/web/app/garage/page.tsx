import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function GaragePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <header className="flex items-center justify-between mb-10">
          <div>
            <p className="text-sm tracking-widest uppercase text-steel">vehkit</p>
            <h1 className="text-3xl font-semibold text-ink">My Garage</h1>
          </div>
          <form action="/auth/signout" method="post">
            <button className="text-sm text-steel hover:text-ink transition-colors">
              Sign out
            </button>
          </form>
        </header>

        <p className="text-sm text-steel mb-6">
          Signed in as <span className="font-mono">{user.email}</span>
        </p>

        {vehicles && vehicles.length > 0 ? (
          <div className="space-y-3">
            {vehicles.map((v) => (
              <article
                key={v.id}
                className="bg-white border border-mist rounded p-6 flex items-center justify-between hover:border-ink/30 transition-colors"
              >
                <div>
                  <h2 className="font-medium text-ink">
                    {v.nickname ?? `${v.make} ${v.model}`}
                  </h2>
                  <p className="text-sm text-steel mt-1">
                    {v.plate_number ?? 'No plate'} · {v.current_odometer ?? 0} km
                  </p>
                </div>
                <Link
                  href={`/vehicles/${v.id}`}
                  className="text-sm text-ink font-medium hover:text-verified transition-colors"
                >
                  Open →
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <div className="bg-white border border-mist rounded p-10 text-center">
            <p className="text-ink font-medium">No vehicles yet.</p>
            <p className="text-sm text-steel mt-2 mb-6">
              Add your first car to start its passport.
            </p>
            <Link
              href="/vehicles/new"
              className="inline-block bg-ink text-cream px-5 py-2.5 rounded font-medium hover:bg-ink/90 transition-colors"
            >
              Add a vehicle
            </Link>
          </div>
        )}
      </div>
    </main>
  )
}
