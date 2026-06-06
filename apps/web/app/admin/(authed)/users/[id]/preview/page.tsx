import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { nukeUserAction } from '@/app/admin/_actions/users'

export const dynamic = 'force-dynamic'

const ADMIN_HANDLE = 'vecna' // Single-user admin today; extend when multi-admin lands.

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  preferred_language: string | null
  avatar_url: string | null
  created_at: string
}

type VehicleLite = {
  id: string
  make: string
  model: string
  nickname: string | null
  year: number | null
  color: string | null
  plate_number: string | null
  plate_emirate: string | null
  current_odometer: number | null
  hero_image_url: string | null
  created_at: string
}

type ServiceRecLite = {
  id: string
  vehicle_id: string
  service_type: string
  service_date: string
  cost_aed: number | null
  workshop_name_freetext: string | null
  attestation: string
  confirmed_at: string | null
  rejected_at: string | null
  created_at: string
}

type DocumentLite = {
  id: string
  vehicle_id: string
  doc_type: string
  label: string | null
  expires_at: string | null
  archived_at: string | null
  created_at: string
}

type GrantLite = {
  id: string
  vehicle_id: string
  agent_id: string
  granted_at: string
  full_until: string
  expires_at: string
  revoked_at: string | null
  agents: { name: string } | null
}

export default async function AdminUserPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const errorMsg = sp.error
  const supabase = createAdminClient()

  // Audit-log this preview load BEFORE rendering anything. Even partial
  // page loads count — every "view" is recorded.
  await supabase.from('admin_audit_log').insert({
    admin_handle: ADMIN_HANDLE,
    action: 'preview_user',
    target_user_id: id,
    target_table: 'profiles',
  })

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!profile) notFound()
  const p = profile as Profile

  // Pull everything the customer would see — admin client bypasses RLS.
  const [vehiclesRes, recordsRes, docsRes, grantsRes] = await Promise.all([
    supabase
      .from('vehicles')
      .select(
        'id, make, model, nickname, year, color, plate_number, plate_emirate, current_odometer, hero_image_url, created_at',
      )
      .eq('owner_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select(
        'id, vehicle_id, service_type, service_date, cost_aed, workshop_name_freetext, attestation, confirmed_at, rejected_at, created_at',
      )
      .in(
        'vehicle_id',
        ((
          await supabase.from('vehicles').select('id').eq('owner_id', id)
        ).data ?? []).map((v) => (v as { id: string }).id),
      )
      .order('service_date', { ascending: false })
      .limit(50),
    supabase
      .from('vehicle_documents')
      .select(
        'id, vehicle_id, doc_type, label, expires_at, archived_at, created_at',
      )
      .in(
        'vehicle_id',
        ((
          await supabase.from('vehicles').select('id').eq('owner_id', id)
        ).data ?? []).map((v) => (v as { id: string }).id),
      )
      .order('created_at', { ascending: false }),
    supabase
      .from('agent_grants')
      .select(
        'id, vehicle_id, agent_id, granted_at, full_until, expires_at, revoked_at, agents(name)',
      )
      .eq('granted_by', id)
      .order('granted_at', { ascending: false }),
  ])

  const vehicles = (vehiclesRes.data ?? []) as VehicleLite[]
  const records = (recordsRes.data ?? []) as ServiceRecLite[]
  const documents = (docsRes.data ?? []) as DocumentLite[]
  const grants = (grantsRes.data ?? []) as unknown as GrantLite[]

  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]))

  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl">
      {/* PROMINENT BANNER — admin must always know they're in shadow mode */}
      <div className="mb-6 bg-signal/10 border-2 border-signal/40 text-signal px-4 py-3 rounded-DEFAULT flex items-center gap-3">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="shrink-0"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm leading-snug">
            Admin preview · read-only · this view is logged in admin_audit_log
          </p>
          <p className="text-xs text-signal/80 mt-0.5">
            Customer:{' '}
            <span className="font-mono">{p.email ?? p.id}</span>
            {p.full_name && <> · {p.full_name}</>}
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-xs tracking-widest uppercase text-signal hover:underline shrink-0"
        >
          Exit
        </Link>
      </div>

      {/* Header — mirrors the consumer's /mycars header */}
      <header className="mb-6">
        <p className="text-[10px] tracking-widest uppercase text-ash">Vehkit · Admin</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1 text-chalk">
          Customer view
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          What this customer sees in their portal — vehicles, service history,
          documents, and active agent grants. Read-only; no actions.
        </p>
      </header>

      {/* Identity card */}
      <section className="card p-5 mb-6">
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">Email</p>
            <p className="font-mono text-chalk mt-1">{p.email ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">Name</p>
            <p className="text-chalk mt-1">{p.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">Phone</p>
            <p className="font-mono text-chalk mt-1">{p.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">Joined</p>
            <p className="font-mono text-chalk mt-1">
              {new Date(p.created_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            </p>
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">Language</p>
            <p className="text-chalk mt-1">{p.preferred_language ?? 'en'}</p>
          </div>
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">User ID</p>
            <p className="font-mono text-[11px] text-ash mt-1 break-all">{p.id}</p>
          </div>
        </div>
      </section>

      {/* Stat strip */}
      <div className="card p-4 mb-6 flex items-stretch gap-3 flex-wrap">
        <Stat value={vehicles.length.toString()} label="vehicles" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat value={records.length.toString()} label="services" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat
          value={documents.filter((d) => !d.archived_at).length.toString()}
          label="documents"
          mono
        />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat
          value={grants.filter((g) => !g.revoked_at).length.toString()}
          label="agent grants"
          mono
        />
      </div>

      {/* VEHICLES */}
      <section className="mb-8">
        <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
          Vehicles · {vehicles.length}
        </h2>
        {vehicles.length === 0 ? (
          <div className="card p-6 text-sm text-ash text-center">
            No vehicles
          </div>
        ) : (
          <ul className="space-y-3">
            {vehicles.map((v) => (
              <li key={v.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <div className="shrink-0 w-12 h-12 rounded-pill bg-iron overflow-hidden">
                    {v.hero_image_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.hero_image_url}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-chalk truncate">
                      {v.nickname ?? `${v.make} ${v.model}`}
                    </p>
                    <p className="text-xs text-ash truncate">
                      {[
                        v.year,
                        `${v.make} ${v.model}`,
                        v.color,
                        v.plate_emirate && v.plate_number
                          ? `${v.plate_emirate} · ${v.plate_number}`
                          : v.plate_number,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-chalk tabular-nums shrink-0">
                    {v.current_odometer?.toLocaleString() ?? '—'}{' '}
                    <span className="text-[10px] text-ash">km</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* SERVICE HISTORY */}
      {records.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
            Recent service history · {records.length}
          </h2>
          <ul className="card divide-y divide-seam">
            {records.slice(0, 30).map((r) => {
              const v = vehiclesById.get(r.vehicle_id)
              const tone = r.rejected_at
                ? 'text-signal'
                : r.confirmed_at
                  ? 'text-volt'
                  : 'text-ash'
              return (
                <li key={r.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk truncate">
                      <span className="font-semibold">
                        {humanize(r.service_type)}
                      </span>
                      {v && (
                        <span className="text-ash">
                          {' · '}
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </span>
                      )}
                      {r.workshop_name_freetext && (
                        <span className="text-ash">
                          {' · '}
                          {r.workshop_name_freetext}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-ash mt-0.5 font-mono">
                      {new Date(r.service_date).toLocaleDateString('en-GB')}
                      {r.cost_aed != null &&
                        ` · AED ${Number(r.cost_aed).toLocaleString()}`}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] tracking-widest uppercase shrink-0 ${tone}`}
                  >
                    {r.rejected_at
                      ? 'Rejected'
                      : r.confirmed_at
                        ? 'Confirmed'
                        : r.attestation}
                  </span>
                </li>
              )
            })}
          </ul>
          {records.length > 30 && (
            <p className="text-[11px] text-ash mt-2 text-right">
              +{records.length - 30} older entries
            </p>
          )}
        </section>
      )}

      {/* DOCUMENTS */}
      {documents.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
            Documents · {documents.length}
          </h2>
          <p className="text-[11px] text-ash/70 leading-relaxed mb-3">
            Document metadata only. File contents are NOT shown — to read a
            file for support escalation, ask the customer to share via /agent.
          </p>
          <ul className="card divide-y divide-seam">
            {documents.map((d) => {
              const v = vehiclesById.get(d.vehicle_id)
              return (
                <li key={d.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk truncate">
                      <span className="font-semibold capitalize">
                        {d.doc_type.replace(/_/g, ' ')}
                      </span>
                      {d.label && (
                        <span className="text-ash"> · {d.label}</span>
                      )}
                      {v && (
                        <span className="text-ash">
                          {' · '}
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-ash mt-0.5 font-mono">
                      {d.expires_at
                        ? `Expires ${d.expires_at}`
                        : 'No expiry set'}
                    </p>
                  </div>
                  {d.archived_at && (
                    <span className="text-[10px] tracking-widest uppercase text-ash shrink-0">
                      Archived
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* DANGER ZONE — nuke user */}
      <section className="mt-12 border-2 border-signal/40 rounded-DEFAULT p-5 bg-signal/5">
        <p className="text-[10px] tracking-widest uppercase text-signal font-bold">
          Danger zone
        </p>
        <h2 className="text-xl font-semibold text-chalk tracking-tighter mt-2">
          Nuke this user
        </h2>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Permanently delete{' '}
          <span className="font-mono text-chalk">{p.email ?? p.id}</span> and
          every row attached: vehicles ({vehicles.length}), services (
          {records.length}), documents ({documents.length}), bookings, reviews,
          agent grants ({grants.length}), and the auth account. Cannot be
          undone. Storage files are listed in the result so you can purge
          buckets manually.
        </p>
        {errorMsg && (
          <p className="text-sm text-signal mt-3 font-mono">
            {decodeURIComponent(errorMsg)}
          </p>
        )}
        <form action={nukeUserAction} className="mt-4 flex gap-2 items-center flex-wrap">
          <input type="hidden" name="userId" value={p.id} />
          <input
            type="text"
            name="confirmEmail"
            required
            placeholder={`Type "${p.email ?? 'email'}" to confirm`}
            className="field max-w-xs font-mono text-xs"
            autoComplete="off"
          />
          <button
            type="submit"
            className="text-xs tracking-widest uppercase font-bold bg-signal text-white px-4 py-2.5 rounded-pill hover:bg-signal/85 transition-colors"
          >
            Nuke user
          </button>
        </form>
        <p className="text-[11px] text-ash mt-3 leading-relaxed">
          Logged in <span className="font-mono">admin_audit_log</span> with the
          deleted email, vehicle count, and a list of storage paths to clear
          from the buckets.
        </p>
      </section>

      {/* AGENT GRANTS issued by this customer */}
      {grants.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
            Agent grants · {grants.length}
          </h2>
          <ul className="card divide-y divide-seam">
            {grants.map((g) => {
              const v = vehiclesById.get(g.vehicle_id)
              const now = Date.now()
              const isFull =
                !g.revoked_at && new Date(g.full_until).getTime() > now
              const isMeta =
                !g.revoked_at &&
                !isFull &&
                new Date(g.expires_at).getTime() > now
              return (
                <li key={g.id} className="px-4 py-3 flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-chalk truncate">
                      <span className="font-semibold">
                        {g.agents?.name ?? g.agent_id}
                      </span>
                      {v && (
                        <span className="text-ash">
                          {' · '}
                          {v.nickname ?? `${v.make} ${v.model}`}
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-ash mt-0.5 font-mono">
                      Granted {new Date(g.granted_at).toLocaleDateString('en-GB')}
                      {' · '}
                      Expires {new Date(g.expires_at).toLocaleDateString('en-GB')}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] tracking-widest uppercase shrink-0 ${
                      g.revoked_at
                        ? 'text-ash'
                        : isFull
                          ? 'text-volt'
                          : isMeta
                            ? 'text-wallet'
                            : 'text-ash'
                    }`}
                  >
                    {g.revoked_at
                      ? 'Revoked'
                      : isFull
                        ? 'Full window'
                        : isMeta
                          ? 'Renewal track'
                          : 'Expired'}
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function Stat({
  value,
  label,
  mono,
}: {
  value: string
  label: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-base md:text-lg font-semibold text-chalk tracking-tight leading-none ${
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

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
