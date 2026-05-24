import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Agent = {
  id: string
  name: string
  slug: string
  category: 'insurance' | 'fleet' | 'leasing' | 'other'
  emirate: string | null
  phone: string | null
  email: string | null
  verification_tier: 'unverified' | 'silver' | 'gold'
  trade_license: string | null
  trade_license_url: string | null
  trade_license_uploaded_at: string | null
  created_at: string
}

type Aggregates = {
  agent_id: string
  member_count: number
  total_grants: number
  active_grants: number
  last_redemption: string | null
}

async function setAgentTier(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  const tier = String(formData.get('tier') ?? '')
  if (!id || !['unverified', 'silver', 'gold'].includes(tier)) return
  const supabase = createAdminClient()
  await supabase.rpc('admin_set_agent_tier', {
    p_agent_id: id,
    p_tier: tier,
  })
  revalidatePath('/admin/agents')
}

export default async function AdminAgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string; category?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const tierFilter = sp.tier ?? ''
  const categoryFilter = sp.category ?? ''

  const supabase = createAdminClient()

  // Pull all agents
  let query = supabase
    .from('agents')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,emirate.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`,
    )
  }
  if (tierFilter) query = query.eq('verification_tier', tierFilter)
  if (categoryFilter) query = query.eq('category', categoryFilter)

  const { data: agents, error: agentsError } = await query
  const list = (agents ?? []) as Agent[]

  // Aggregate member counts + grant counts in parallel — small N, so we
  // accept the round-trip cost rather than building a custom RPC.
  const ids = list.map((a) => a.id)
  const [membersRes, grantsRes] = await Promise.all([
    ids.length > 0
      ? supabase.from('agent_members').select('agent_id').in('agent_id', ids)
      : Promise.resolve({ data: [] as { agent_id: string }[], error: null }),
    ids.length > 0
      ? supabase
          .from('agent_grants')
          .select('agent_id, granted_at, full_until, expires_at, revoked_at')
          .in('agent_id', ids)
      : Promise.resolve({
          data: [] as Array<{
            agent_id: string
            granted_at: string
            full_until: string
            expires_at: string
            revoked_at: string | null
          }>,
          error: null,
        }),
  ])

  type GrantLite = {
    agent_id: string
    granted_at: string
    full_until: string
    expires_at: string
    revoked_at: string | null
  }
  const memberRows = (membersRes.data ?? []) as { agent_id: string }[]
  const grantRows = (grantsRes.data ?? []) as GrantLite[]

  const aggMap = new Map<string, Aggregates>()
  for (const a of list) {
    aggMap.set(a.id, {
      agent_id: a.id,
      member_count: 0,
      total_grants: 0,
      active_grants: 0,
      last_redemption: null,
    })
  }
  for (const m of memberRows) {
    const x = aggMap.get(m.agent_id)
    if (x) x.member_count += 1
  }
  const now = Date.now()
  for (const g of grantRows) {
    const x = aggMap.get(g.agent_id)
    if (!x) continue
    x.total_grants += 1
    if (
      !g.revoked_at &&
      new Date(g.expires_at).getTime() > now
    ) {
      x.active_grants += 1
    }
    if (
      !x.last_redemption ||
      new Date(g.granted_at).getTime() >
        new Date(x.last_redemption).getTime()
    ) {
      x.last_redemption = g.granted_at
    }
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Agents · {list.length}
          </h1>
        </div>
        <form className="flex gap-2 flex-wrap">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, emirate, phone…"
            className="field max-w-xs"
          />
          <select
            name="category"
            defaultValue={categoryFilter}
            className="field max-w-[140px]"
          >
            <option value="">All types</option>
            <option value="insurance">Insurance</option>
            <option value="fleet">Fleet</option>
            <option value="leasing">Leasing</option>
            <option value="other">Other</option>
          </select>
          <select
            name="tier"
            defaultValue={tierFilter}
            className="field max-w-[140px]"
          >
            <option value="">All tiers</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="unverified">Unverified</option>
          </select>
          <button type="submit" className="pill-outline text-sm">
            Apply
          </button>
          {(q || tierFilter || categoryFilter) && (
            <Link href="/admin/agents" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      {agentsError && (
        <div className="mb-4 bg-signal/10 border border-signal/30 text-signal text-xs px-4 py-3 rounded-DEFAULT font-mono">
          agents: {agentsError.message} · {agentsError.code}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Emirate</th>
              <th className="text-left p-3">Members</th>
              <th className="text-left p-3">Grants</th>
              <th className="text-left p-3">Last redeem</th>
              <th className="text-left p-3">Tier</th>
              <th className="text-left p-3">License</th>
              <th className="text-left p-3">Set tier</th>
            </tr>
          </thead>
          <tbody>
            {list.map((a) => {
              const agg = aggMap.get(a.id)!
              return (
                <tr
                  key={a.id}
                  className="border-b border-seam/50 hover:bg-iron/30 align-top"
                >
                  <td className="p-3">
                    <p className="text-chalk font-medium">{a.name}</p>
                    <p className="text-xs text-ash/70 font-mono">{a.slug}</p>
                  </td>
                  <td className="p-3 text-xs text-ash capitalize">{a.category}</td>
                  <td className="p-3 text-xs text-ash">{a.emirate ?? '—'}</td>
                  <td className="p-3 text-xs">
                    <span className="font-mono tabular-nums text-chalk">
                      {agg.member_count}
                    </span>
                  </td>
                  <td className="p-3 text-xs">
                    <span className="font-mono tabular-nums text-chalk">
                      {agg.total_grants}
                    </span>
                    {agg.active_grants > 0 && (
                      <span className="text-[10px] text-volt ml-1">
                        ({agg.active_grants} active)
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-ash">
                    {agg.last_redemption
                      ? new Date(agg.last_redemption).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                        })
                      : '—'}
                  </td>
                  <td className="p-3">
                    <TierBadge tier={a.verification_tier} />
                  </td>
                  <td className="p-3 text-xs text-ash">
                    {a.trade_license_url ? (
                      <span className="text-leaf">✓ uploaded</span>
                    ) : a.trade_license ? (
                      <span title="Number entered, file not uploaded">
                        ⚠ number only
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="p-3">
                    <form action={setAgentTier} className="flex gap-1">
                      <input type="hidden" name="id" value={a.id} />
                      <select
                        name="tier"
                        defaultValue={a.verification_tier}
                        className="field py-1 px-2 text-xs"
                      >
                        <option value="unverified">Unverified</option>
                        <option value="silver">Silver</option>
                        <option value="gold">Gold</option>
                      </select>
                      <button
                        type="submit"
                        className="text-xs tracking-widest uppercase text-volt hover:underline"
                      >
                        Set
                      </button>
                    </form>
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-ash">
                  No agents
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TierBadge({
  tier,
}: {
  tier: 'unverified' | 'silver' | 'gold'
}) {
  if (tier === 'gold') {
    return (
      <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium">
        ★ Gold
      </span>
    )
  }
  if (tier === 'silver') {
    return (
      <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium">
        ✓ Silver
      </span>
    )
  }
  return (
    <span className="text-[10px] tracking-wider uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium">
      Unverified
    </span>
  )
}
