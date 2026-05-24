import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type GrantRow = {
  id: string
  agent_id: string
  vehicle_id: string
  granted_by: string
  granted_at: string
  full_until: string
  expires_at: string
  revoked_at: string | null
  // joined
  agents: { name: string; slug: string } | null
  vehicles: {
    make: string
    model: string
    plate_emirate: string | null
    plate_number: string | null
  } | null
}

async function revokeGrant(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  if (!id) return
  const supabase = createAdminClient()
  await supabase
    .from('agent_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', id)
  revalidatePath('/admin/agent-grants')
}

export default async function AdminAgentGrantsPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string; agent?: string }>
}) {
  const sp = await searchParams
  const windowFilter = sp.window ?? '' // '', 'full', 'meta', 'expired'
  const agentFilter = sp.agent ?? ''

  const supabase = createAdminClient()

  const nowIso = new Date().toISOString()

  let query = supabase
    .from('agent_grants')
    .select(
      'id, agent_id, vehicle_id, granted_by, granted_at, full_until, expires_at, revoked_at, agents(name, slug), vehicles(make, model, plate_emirate, plate_number)',
    )
    .order('granted_at', { ascending: false })
    .limit(300)

  if (agentFilter) query = query.eq('agent_id', agentFilter)
  if (windowFilter === 'full') query = query.gt('full_until', nowIso).is('revoked_at', null)
  if (windowFilter === 'meta')
    query = query
      .lte('full_until', nowIso)
      .gt('expires_at', nowIso)
      .is('revoked_at', null)
  if (windowFilter === 'expired') query = query.lte('expires_at', nowIso)

  const { data: grants, error } = await query
  const list = (grants ?? []) as unknown as GrantRow[]

  // Abuse signal: agents with >5 redemptions in last 24h
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000
  const recent24h = new Map<string, number>()
  for (const g of list) {
    const ts = new Date(g.granted_at).getTime()
    if (ts > dayAgo) {
      recent24h.set(g.agent_id, (recent24h.get(g.agent_id) ?? 0) + 1)
    }
  }
  const flaggedAgents = new Set(
    [...recent24h.entries()]
      .filter(([, n]) => n > 5)
      .map(([id]) => id),
  )

  // Stats for the header strip
  const fullCount = list.filter(
    (g) => !g.revoked_at && new Date(g.full_until).getTime() > Date.now(),
  ).length
  const metaCount = list.filter(
    (g) =>
      !g.revoked_at &&
      new Date(g.full_until).getTime() <= Date.now() &&
      new Date(g.expires_at).getTime() > Date.now(),
  ).length
  const expiredOrRevokedCount = list.filter(
    (g) => g.revoked_at || new Date(g.expires_at).getTime() <= Date.now(),
  ).length

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Agent grants · {list.length}
          </h1>
        </div>
        <form className="flex gap-2 flex-wrap">
          <select
            name="window"
            defaultValue={windowFilter}
            className="field max-w-[160px]"
          >
            <option value="">All windows</option>
            <option value="full">Full window (active)</option>
            <option value="meta">Renewal track</option>
            <option value="expired">Expired / revoked</option>
          </select>
          <button type="submit" className="pill-outline text-sm">
            Apply
          </button>
          {(windowFilter || agentFilter) && (
            <Link href="/admin/agent-grants" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      {/* Stat strip */}
      <div className="card p-4 mb-4 flex items-stretch gap-3 flex-wrap">
        <Stat value={list.length.toString()} label="grants" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat value={fullCount.toString()} label="full window" tone="volt" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat value={metaCount.toString()} label="renewal track" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat
          value={expiredOrRevokedCount.toString()}
          label="expired / revoked"
          mono
        />
        {flaggedAgents.size > 0 && (
          <>
            <span className="w-px bg-seam shrink-0" aria-hidden />
            <Stat
              value={flaggedAgents.size.toString()}
              label="agents flagged 24h"
              tone="signal"
              mono
            />
          </>
        )}
      </div>

      {error && (
        <div className="mb-4 bg-signal/10 border border-signal/30 text-signal text-xs px-4 py-3 rounded-DEFAULT font-mono">
          agent_grants: {error.message} · {error.code}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Granted</th>
              <th className="text-left p-3">Agent</th>
              <th className="text-left p-3">Vehicle</th>
              <th className="text-left p-3">Window</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {list.map((g) => {
              const isFull =
                !g.revoked_at && new Date(g.full_until).getTime() > Date.now()
              const isMeta =
                !g.revoked_at &&
                !isFull &&
                new Date(g.expires_at).getTime() > Date.now()
              const isExpired = g.revoked_at || (!isFull && !isMeta)
              const flagged = flaggedAgents.has(g.agent_id)
              const plate =
                g.vehicles?.plate_emirate && g.vehicles?.plate_number
                  ? `${g.vehicles.plate_emirate} · ${g.vehicles.plate_number}`
                  : g.vehicles?.plate_number ?? null
              return (
                <tr
                  key={g.id}
                  className="border-b border-seam/50 hover:bg-iron/30 align-top"
                >
                  <td className="p-3 text-xs text-ash font-mono">
                    {new Date(g.granted_at).toLocaleString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="p-3 text-xs">
                    <p className="text-chalk">{g.agents?.name ?? g.agent_id}</p>
                    {flagged && (
                      <span className="text-[10px] tracking-widest uppercase bg-signal/15 text-signal px-1.5 py-0.5 rounded-pill font-medium mt-1 inline-block">
                        Flagged · 5+ in 24h
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    <p className="text-chalk">
                      {g.vehicles
                        ? `${g.vehicles.make} ${g.vehicles.model}`
                        : g.vehicle_id}
                    </p>
                    {plate && (
                      <p className="text-ash font-mono">{plate}</p>
                    )}
                  </td>
                  <td className="p-3">
                    {g.revoked_at ? (
                      <span className="text-[10px] tracking-wider uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium">
                        Revoked
                      </span>
                    ) : isFull ? (
                      <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium">
                        Full
                      </span>
                    ) : isMeta ? (
                      <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium">
                        Renewal
                      </span>
                    ) : (
                      <span className="text-[10px] tracking-wider uppercase bg-iron text-ash/70 px-2 py-0.5 rounded-pill font-medium">
                        Expired
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-ash font-mono">
                    {new Date(g.expires_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td className="p-3">
                    {!isExpired && !g.revoked_at && (
                      <form action={revokeGrant}>
                        <input type="hidden" name="id" value={g.id} />
                        <button
                          type="submit"
                          className="text-xs tracking-widest uppercase text-signal hover:underline"
                        >
                          Revoke
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ash">
                  No grants
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Stat({
  value,
  label,
  mono,
  tone,
}: {
  value: string
  label: string
  mono?: boolean
  tone?: 'volt' | 'signal'
}) {
  const valueColor =
    tone === 'volt'
      ? 'text-volt'
      : tone === 'signal'
        ? 'text-signal'
        : 'text-chalk'
  return (
    <div className="min-w-0">
      <p
        className={`text-base md:text-lg font-semibold ${valueColor} tracking-tight leading-none ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}
