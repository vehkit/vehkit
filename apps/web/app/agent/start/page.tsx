import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAgentOrg } from '@/app/actions/agent-onboarding'

export const metadata = {
  title: 'Vehkit · Agent · Start',
}

export default async function AgentStartPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/agent/start`)

  // Already a member? Skip onboarding.
  const { data: existing } = await supabase
    .from('agent_members')
    .select('agent_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (existing) {
    redirect(sp.next ?? '/agent')
  }

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-md mx-auto px-6 pt-10 md:pt-12">
        <p className="nav-pill">vehkit · agent</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Set up your agent desk
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          For insurance brokers, leasing desks, fleet managers, used-car buyers
          and anyone customers might trust with their car documents. They share
          a one-time code; you get{' '}
          <span className="text-chalk font-medium">full access for 60 minutes</span>
          , then a quick reference of expiry dates for 30 days after. No PDFs
          flying around on WhatsApp.
        </p>

        {sp.error && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(sp.error)}
          </div>
        )}

        <form action={createAgentOrg} className="mt-6 space-y-4">
          {sp.next && <input type="hidden" name="next" value={sp.next} />}

          <div>
            <label htmlFor="name" className="label">
              Organisation name <span className="text-signal">*</span>
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              maxLength={120}
              placeholder="Al Wathba Insurance Brokers"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="category" className="label">
              Category
            </label>
            <select
              id="category"
              name="category"
              defaultValue="insurance"
              className="field"
            >
              <option value="insurance">Insurance broker</option>
              <option value="fleet">Fleet manager</option>
              <option value="leasing">Leasing / rental</option>
              <option value="other">Other</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="emirate" className="label">
                Emirate
              </label>
              <select
                id="emirate"
                name="emirate"
                defaultValue=""
                className="field"
              >
                <option value="">Pick…</option>
                <option value="Dubai">Dubai</option>
                <option value="Abu Dhabi">Abu Dhabi</option>
                <option value="Sharjah">Sharjah</option>
                <option value="Ajman">Ajman</option>
                <option value="Fujairah">Fujairah</option>
                <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                <option value="Umm Al Quwain">Umm Al Quwain</option>
              </select>
            </div>
            <div>
              <label htmlFor="phone" className="label">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+971 50 …"
                className="field"
              />
            </div>
          </div>

          <button type="submit" className="pill-primary block w-full text-center">
            Create agent desk
          </button>
        </form>

        <p className="text-[11px] text-ash/70 leading-relaxed mt-6">
          Trade-license verification is required before customers see your
          desk in directory listings. We'll guide you to{' '}
          <Link href="/agent/settings" className="underline">
            upload it
          </Link>{' '}
          after setup.
        </p>

        {/* Account escape hatch — onboarding has no AgentNav, so this is the
            only way to switch accounts mid-flow. */}
        <div className="mt-8 pt-6 border-t border-seam flex items-center justify-between gap-3">
          <p className="text-[11px] text-ash truncate min-w-0 flex-1">
            Signed in as{' '}
            <span className="text-chalk font-mono">{user.email}</span>
          </p>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-[11px] tracking-widest uppercase text-signal hover:underline shrink-0"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}
