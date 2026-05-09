import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { AgentNav } from '@/components/AgentNav'

/**
 * Layout for /agent/* — wraps dashboard pages with AgentNav when the user
 * has an agent membership. For users without a membership (i.e. on
 * /agent/start), we render children bare — no nav. This prevents the
 * "redirect to /agent/start when no membership" loop, since /agent/start
 * itself lives under this layout.
 *
 * The "you need an org" redirect happens on individual dashboard pages
 * (/agent/page.tsx, /agent/grant/[grantId]/page.tsx, etc.), not here.
 */
export default async function AgentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/agent')

  const { data: membership } = await supabase
    .from('agent_members')
    .select('agent_id, agents(id, name)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  type Membership = {
    agent_id: string
    agents: { id: string; name: string } | null
  }
  const m = membership as Membership | null

  // Onboarding flow — no nav, just the bare page (e.g. /agent/start).
  if (!m) {
    return <>{children}</>
  }

  const { data: grants } = await supabase.rpc('agent_dashboard_grants', {
    p_agent_id: m.agent_id,
  })

  type Grant = {
    grant_id: string
    expires_at: string
    next_doc_expiry: string | null
  }
  const list = (grants ?? []) as Grant[]
  const activeGrants = list.length
  const thirtyDaysFromNow = Date.now() + 30 * 24 * 60 * 60 * 1000
  const expiringSoon = list.filter(
    (g) =>
      g.next_doc_expiry &&
      new Date(g.next_doc_expiry).getTime() < thirtyDaysFromNow,
  ).length

  return (
    <>
      <AgentNav
        agentName={m.agents?.name ?? 'Agent'}
        activeGrants={activeGrants}
        expiringSoon={expiringSoon}
      />
      {children}
    </>
  )
}
