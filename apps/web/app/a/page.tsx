import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { redeemAgentCode } from '@/app/actions/agent'

export default async function AgentRedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string; error?: string }>
}) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Anonymous → bounce through login with next param so they come right back
  if (!user) {
    const next = sp.code ? `/a?code=${encodeURIComponent(sp.code)}` : '/a'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  // Resolve any agent membership the user has
  const { data: memberships } = await supabase
    .from('agent_members')
    .select('agent_id, role, agents(id, name, category)')
    .eq('user_id', user.id)

  type Membership = {
    agent_id: string
    role: string
    agents: { id: string; name: string; category: string } | null
  }
  const orgs = (memberships ?? []) as Membership[]

  if (orgs.length === 0) {
    return (
      <main className="min-h-[100svh] pb-24">
        <div className="max-w-md mx-auto px-6 pt-12">
          <p className="nav-pill">vehkit · agent</p>
          <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-4">
            Set up your agent profile
          </h1>
          <p className="text-sm text-ash mt-3 leading-relaxed">
            You need to be part of an agent organisation to redeem a customer
            share code. It only takes a minute.
          </p>
          <Link
            href="/agent/start"
            className="pill-primary block text-center mt-6"
          >
            Start onboarding
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-md mx-auto px-6 pt-10">
        <p className="nav-pill">vehkit · agent</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-4">
          Redeem customer code
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Your customer shared a 6-character code with you. Enter it below to
          unlock their documents for 60 minutes.
        </p>

        {sp.error && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(sp.error)}
          </div>
        )}

        <form action={redeemAgentCode} className="mt-6 space-y-4">
          {orgs.length === 1 ? (
            <input
              type="hidden"
              name="agent_id"
              value={orgs[0]!.agent_id}
            />
          ) : (
            <div>
              <label htmlFor="agent_id" className="label">
                Acting on behalf of
              </label>
              <select
                id="agent_id"
                name="agent_id"
                required
                defaultValue=""
                className="field"
              >
                <option value="" disabled>
                  Pick an agent org…
                </option>
                {orgs.map((m) => (
                  <option key={m.agent_id} value={m.agent_id}>
                    {m.agents?.name ?? m.agent_id}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="code" className="label">
              Code
            </label>
            <input
              id="code"
              name="code"
              type="text"
              required
              autoFocus
              autoComplete="off"
              defaultValue={sp.code ?? ''}
              placeholder="ABC123"
              className="field font-mono text-2xl tracking-[0.2em] text-center uppercase"
              maxLength={8}
            />
            <p className="text-[11px] text-ash/70 mt-1.5">
              Single use. Expires automatically.
            </p>
          </div>

          <button type="submit" className="pill-primary block w-full text-center">
            Unlock customer documents
          </button>
        </form>

        <p className="text-[11px] text-ash/70 leading-relaxed mt-6">
          By redeeming, you agree to handle customer documents in line with
          UAE data protection law. Every access is logged.
        </p>
      </div>
    </main>
  )
}
