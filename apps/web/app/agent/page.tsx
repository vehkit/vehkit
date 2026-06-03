import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

type GrantRow = {
  grant_id: string
  vehicle_id: string
  granted_at: string
  full_until: string
  expires_at: string
  vehicle_make: string
  vehicle_model: string
  vehicle_plate_emirate: string | null
  vehicle_plate_number: string | null
  owner_full_name: string | null
  owner_phone: string | null
  doc_count: number
  next_doc_expiry: string | null
  is_full_window: boolean
}

function expiryTone(dateStr: string | null): {
  label: string
  tone: 'volt' | 'wallet' | 'signal' | 'ash'
} | null {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const days = Math.floor(
    (d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (days < 0) return { label: 'Expired', tone: 'signal' }
  if (days <= 30) return { label: `${days}d to expiry`, tone: 'wallet' }
  if (days <= 90) return { label: `${Math.ceil(days / 30)} mo to expiry`, tone: 'volt' }
  return null
}

function fullWindowRemaining(fullUntil: string): string {
  const ms = new Date(fullUntil).getTime() - Date.now()
  if (ms <= 0) return 'expired'
  const min = Math.floor(ms / 60000)
  return `${min}m left`
}

export default async function AgentDashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/agent')

  const { data: membership } = await supabase
    .from('agent_members')
    .select('agent_id, agents(name, category)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  type Membership = {
    agent_id: string
    agents: { name: string; category: string } | null
  }
  const m = membership as unknown as Membership | null
  if (!m) redirect('/agent/start')

  const { data: grants } = await supabase.rpc('agent_dashboard_grants', {
    p_agent_id: m.agent_id,
  })
  const list = (grants ?? []) as GrantRow[]

  const fullWindowOpen = list.filter((g) => g.is_full_window)
  const metaOnly = list.filter((g) => !g.is_full_window)

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 pt-6 md:pt-8">
        {/* Editorial header */}
        <p className="nav-pill">vehkit · agent</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight">
              {m.agents?.name ?? 'Agent'}
            </h1>
            <p className="text-sm text-ash mt-2 leading-relaxed max-w-md capitalize-first">
              <span className="capitalize">{m.agents?.category ?? 'agent'}</span>{' '}
              desk — every customer who shares a code lands here for 60 minutes
              of full access, then 30 days of renewal-track metadata.
            </p>
          </div>
          <div className="flex items-stretch gap-3">
            <Stat value={list.length.toString()} label="active grants" />
            <span className="w-px bg-seam shrink-0" aria-hidden />
            <Stat
              value={fullWindowOpen.length.toString()}
              label="full window"
              tone={fullWindowOpen.length > 0 ? 'volt' : undefined}
            />
            <span className="w-px bg-seam shrink-0" aria-hidden />
            <Stat value={metaOnly.length.toString()} label="renewal track" />
          </div>
        </div>

        {/* FULL WINDOW — actively share-able */}
        <section className="mt-10">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="text-[10px] tracking-widest uppercase text-ash">
              Full document access
            </h2>
            <span className="text-[10px] tracking-widest uppercase text-ash font-mono tabular-nums">
              {fullWindowOpen.length}
            </span>
          </div>
          {fullWindowOpen.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="text-chalk font-medium">No customer sessions open</p>
              <p className="text-sm text-ash mt-2 leading-relaxed">
                Ask the customer for a 6-character share code from their car
                profile, then redeem it to unlock 60 minutes of full document
                access.
              </p>
              <Link
                href="/a"
                className="text-xs tracking-widest uppercase text-volt mt-4 inline-block hover:underline"
              >
                Redeem a code →
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {fullWindowOpen.map((g) => (
                <GrantRow key={g.grant_id} g={g} />
              ))}
            </ul>
          )}
        </section>

        {/* METADATA-ONLY — renewal pipeline */}
        {metaOnly.length > 0 && (
          <section className="mt-10">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-[10px] tracking-widest uppercase text-ash">
                Renewal track
              </h2>
              <span className="text-[10px] tracking-widest uppercase text-ash font-mono tabular-nums">
                {metaOnly.length}
              </span>
            </div>
            <p className="text-xs text-ash/80 mb-3 leading-relaxed">
              60-minute window closed. Expiry dates and contact details remain
              visible for renewal outreach — full documents do not.
            </p>
            <ul className="space-y-3">
              {metaOnly.map((g) => (
                <GrantRow key={g.grant_id} g={g} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  )
}

function GrantRow({ g }: { g: GrantRow }) {
  const plate =
    g.vehicle_plate_emirate && g.vehicle_plate_number
      ? `${g.vehicle_plate_emirate} · ${g.vehicle_plate_number}`
      : g.vehicle_plate_number
  const expiry = expiryTone(g.next_doc_expiry)
  const expiryToneClass =
    expiry?.tone === 'signal'
      ? 'bg-signal/15 text-signal'
      : expiry?.tone === 'wallet'
        ? 'bg-wallet/15 text-wallet'
        : 'bg-volt/10 text-volt'

  // Avatar: vehicle initials, tone-coded by window state
  const initials =
    `${g.vehicle_make} ${g.vehicle_model}`
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '·'
  const avatarTone = g.is_full_window
    ? 'bg-volt/20 text-volt'
    : 'bg-iron text-ash'

  return (
    <li className="card p-4">
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-pill flex items-center justify-center shrink-0 font-mono text-xs font-semibold tracking-tighter ${avatarTone}`}
          aria-hidden
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm md:text-base font-semibold text-chalk truncate leading-snug">
              {g.vehicle_make} {g.vehicle_model}
            </p>
            {g.is_full_window ? (
              <span className="text-[10px] tracking-widest uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-semibold shrink-0">
                {fullWindowRemaining(g.full_until)}
              </span>
            ) : (
              <span className="text-[10px] tracking-widest uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium shrink-0">
                Renewal track
              </span>
            )}
          </div>
          <p className="text-xs text-ash mt-0.5 truncate">
            {plate && <span className="font-mono text-chalk/90">{plate}</span>}
            {g.owner_full_name && (
              <>
                {' · '}
                <span>{g.owner_full_name}</span>
              </>
            )}
            {g.owner_phone && (
              <>
                {' · '}
                <span className="font-mono">{g.owner_phone}</span>
              </>
            )}
          </p>
        </div>

        {g.is_full_window ? (
          <Link
            href={`/agent/grant/${g.grant_id}`}
            className="text-xs tracking-widest uppercase text-volt hover:underline shrink-0"
          >
            Open →
          </Link>
        ) : expiry ? (
          <span
            className={`text-[10px] tracking-widest uppercase px-2 py-0.5 rounded-pill font-medium shrink-0 ${expiryToneClass}`}
          >
            {expiry.label}
          </span>
        ) : null}
      </div>

      {/* Bottom row — doc count + expiry date */}
      <div className="mt-3 pt-3 border-t border-seam flex items-center gap-3 text-[11px]">
        <span className="text-ash">
          <span className="font-mono tabular-nums text-chalk">{g.doc_count}</span>{' '}
          docs
        </span>
        {g.next_doc_expiry && (
          <>
            <span className="w-px h-3 bg-seam" aria-hidden />
            <span className="text-ash">
              Next renewal{' '}
              <span className="font-mono tabular-nums text-chalk">
                {new Date(g.next_doc_expiry).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            </span>
          </>
        )}
      </div>
    </li>
  )
}

function Stat({
  value,
  label,
  tone,
}: {
  value: string
  label: string
  tone?: 'volt'
}) {
  const valueColor = tone === 'volt' ? 'text-volt' : 'text-chalk'
  return (
    <div className="min-w-0">
      <p
        className={`text-sm md:text-base font-semibold ${valueColor} font-mono tabular-nums tracking-tight leading-none`}
      >
        {value}
      </p>
      <p className="text-[9px] md:text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}
