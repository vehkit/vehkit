import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createFleetOrg } from '@/app/actions/fleet'
import { EMIRATES } from '@vehkit/types'

export const dynamic = 'force-dynamic'

export default async function FleetIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/fleet')

  // Orgs the user is a member of
  const { data: memberships } = await supabase
    .from('fleet_members')
    .select('role, fleet_orgs(id, name, slug, emirate)')
    .eq('user_id', user.id)

  const orgs = (memberships ?? [])
    .map((m) => {
      const o = Array.isArray(m.fleet_orgs) ? m.fleet_orgs[0] : m.fleet_orgs
      return o ? { ...o, role: m.role } : null
    })
    .filter((x): x is { id: string; name: string; slug: string; emirate: string | null; role: string } => x !== null)

  return (
    <main className="min-h-[100svh] pb-24">
      <header className="px-6 pt-10 pb-6">
        <Link href="/garage" className="nav-pill hover:text-chalk transition-colors">
          ← Garage
        </Link>
        <p className="nav-pill mt-3">Fleet</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
          Your fleets
        </h1>
        <p className="text-ash mt-2 text-sm leading-relaxed">
          For SMBs running multiple vehicles — taxi co-ops, delivery fleets, rental ops, corporate
          motor pools.
        </p>
      </header>

      <div className="max-w-3xl mx-auto px-6 space-y-8">
        {errorMsg && (
          <div className="bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* Existing orgs */}
        {orgs.length > 0 && (
          <section>
            <h2 className="nav-pill mb-3">Your fleets</h2>
            <div className="space-y-2">
              {orgs.map((o) => (
                <Link
                  key={o.id}
                  href={`/fleet/${o.slug}`}
                  className="card block p-5 hover:border-volt/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-semibold text-chalk truncate">{o.name}</h3>
                      <p className="text-sm text-ash mt-0.5">
                        {o.emirate ? `${o.emirate} · ` : ''}
                        <span className="uppercase tracking-wider text-xs">{o.role}</span>
                      </p>
                    </div>
                    <span className="text-xs tracking-widest uppercase text-ash">Open →</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Create new */}
        <section>
          <h2 className="nav-pill mb-3">
            {orgs.length > 0 ? 'Add a fleet' : 'Create your first fleet'}
          </h2>
          <form action={createFleetOrg} className="card p-5 space-y-3">
            <div>
              <label htmlFor="name" className="label">
                Fleet name <span className="text-signal">*</span>
              </label>
              <input
                type="text"
                name="name"
                id="name"
                required
                placeholder="Al Quoz Delivery Co"
                className="field"
              />
            </div>

            <div>
              <label htmlFor="emirate" className="label">
                Primary emirate
              </label>
              <select id="emirate" name="emirate" defaultValue="" className="field">
                <option value="">—</option>
                {EMIRATES.map((e) => (
                  <option key={e} value={e}>
                    {e}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="pill-primary w-full mt-2">
              Create fleet
            </button>
          </form>
        </section>

        {/* Pitch */}
        {orgs.length === 0 && (
          <section className="card p-5">
            <p className="nav-pill text-[10px]">Why fleets</p>
            <ul className="text-sm text-chalk mt-2 space-y-2 leading-relaxed">
              <li>· One dashboard for every vehicle in your operation</li>
              <li>· Aggregate odometer + service spend tracking</li>
              <li>· Invite drivers and dispatchers as members</li>
              <li>· Bulk verified entries via workshop codes</li>
            </ul>
            <p className="text-xs text-ash mt-3">
              Pricing for fleets coming soon. Free for first 5 vehicles per org.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
