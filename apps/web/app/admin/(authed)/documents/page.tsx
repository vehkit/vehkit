import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type DocRow = {
  id: string
  vehicle_id: string
  doc_type: string
  label: string | null
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  issued_date: string | null
  expires_at: string | null
  uploaded_by: string
  archived_at: string | null
  created_at: string
  // joined
  vehicles: {
    make: string
    model: string
    nickname: string | null
    plate_emirate: string | null
    plate_number: string | null
    owner_id: string
  } | null
}

const TYPE_LABEL: Record<string, string> = {
  auto: 'Auto-classified',
  mulkiya: 'Mulkiya',
  insurance_policy: 'Insurance',
  driving_licence: 'Driving licence',
  noc: 'NOC',
  pollution_test: 'Pollution test',
  service_history: 'Service history',
  other: 'Other',
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    type?: string
    state?: string
  }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const typeFilter = sp.type ?? ''
  const stateFilter = sp.state ?? '' // '', 'expired', 'expiring30', 'archived'

  const supabase = createAdminClient()

  let query = supabase
    .from('vehicle_documents')
    .select(
      'id, vehicle_id, doc_type, label, storage_path, file_type, file_size_bytes, issued_date, expires_at, uploaded_by, archived_at, created_at, vehicles(make, model, nickname, plate_emirate, plate_number, owner_id)',
    )
    .order('created_at', { ascending: false })
    .limit(300)

  if (typeFilter) query = query.eq('doc_type', typeFilter)

  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  if (stateFilter === 'expired') {
    query = query.lt('expires_at', today).is('archived_at', null)
  }
  if (stateFilter === 'expiring30') {
    query = query.gte('expires_at', today).lte('expires_at', in30).is('archived_at', null)
  }
  if (stateFilter === 'archived') {
    query = query.not('archived_at', 'is', null)
  } else if (stateFilter !== 'expired' && stateFilter !== 'expiring30') {
    // default: only non-archived
    query = query.is('archived_at', null)
  }

  if (q) {
    // q matches label OR vehicle plate (via filter pattern — Supabase doesn't
    // join-filter cleanly, so we fall back to label-only)
    query = query.ilike('label', `%${q}%`)
  }

  const { data: docs, error } = await query
  const list = (docs ?? []) as unknown as DocRow[]

  // Top-strip stats
  const total = list.length
  const expired = list.filter(
    (d) => d.expires_at && d.expires_at < today && !d.archived_at,
  ).length
  const expiring30 = list.filter(
    (d) =>
      d.expires_at &&
      d.expires_at >= today &&
      d.expires_at <= in30 &&
      !d.archived_at,
  ).length
  const archivedCount = list.filter((d) => !!d.archived_at).length

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Documents · {total}
          </h1>
        </div>
        <form className="flex gap-2 flex-wrap">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search label…"
            className="field max-w-xs"
          />
          <select
            name="type"
            defaultValue={typeFilter}
            className="field max-w-[140px]"
          >
            <option value="">All types</option>
            {Object.entries(TYPE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select
            name="state"
            defaultValue={stateFilter}
            className="field max-w-[160px]"
          >
            <option value="">Active only</option>
            <option value="expiring30">Expiring ≤ 30d</option>
            <option value="expired">Expired</option>
            <option value="archived">Archived</option>
          </select>
          <button type="submit" className="pill-outline text-sm">
            Apply
          </button>
          {(q || typeFilter || stateFilter) && (
            <Link href="/admin/documents" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      {/* Stat strip */}
      <div className="card p-4 mb-4 flex items-stretch gap-3 flex-wrap">
        <Stat value={total.toString()} label="documents" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat value={expiring30.toString()} label="expiring 30d" tone="wallet" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat value={expired.toString()} label="expired" tone="signal" mono />
        <span className="w-px bg-seam shrink-0" aria-hidden />
        <Stat value={archivedCount.toString()} label="archived" mono />
      </div>

      {error && (
        <div className="mb-4 bg-signal/10 border border-signal/30 text-signal text-xs px-4 py-3 rounded-DEFAULT font-mono">
          documents: {error.message} · {error.code}
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Type</th>
              <th className="text-left p-3">Label</th>
              <th className="text-left p-3">Vehicle</th>
              <th className="text-left p-3">Issued</th>
              <th className="text-left p-3">Expires</th>
              <th className="text-left p-3">Size</th>
              <th className="text-left p-3">Created</th>
              <th className="text-left p-3">State</th>
              <th className="text-left p-3"></th>
            </tr>
          </thead>
          <tbody>
            {list.map((d) => {
              const plate =
                d.vehicles?.plate_emirate && d.vehicles?.plate_number
                  ? `${d.vehicles.plate_emirate} · ${d.vehicles.plate_number}`
                  : d.vehicles?.plate_number ?? null
              const expState = d.expires_at
                ? d.expires_at < today
                  ? 'expired'
                  : d.expires_at <= in30
                    ? 'expiring'
                    : 'valid'
                : null
              return (
                <tr
                  key={d.id}
                  className="border-b border-seam/50 hover:bg-iron/30 align-top"
                >
                  <td className="p-3 text-xs text-chalk">
                    {TYPE_LABEL[d.doc_type] ?? d.doc_type}
                  </td>
                  <td className="p-3 text-xs text-ash truncate max-w-[160px]">
                    {d.label ?? '—'}
                  </td>
                  <td className="p-3 text-xs">
                    <p className="text-chalk">
                      {d.vehicles
                        ? `${d.vehicles.make} ${d.vehicles.model}`
                        : d.vehicle_id}
                    </p>
                    {plate && (
                      <p className="text-ash font-mono">{plate}</p>
                    )}
                  </td>
                  <td className="p-3 text-xs text-ash font-mono">
                    {d.issued_date ?? '—'}
                  </td>
                  <td className="p-3 text-xs font-mono">
                    {d.expires_at ? (
                      <span
                        className={
                          expState === 'expired'
                            ? 'text-signal'
                            : expState === 'expiring'
                              ? 'text-wallet'
                              : 'text-ash'
                        }
                      >
                        {d.expires_at}
                      </span>
                    ) : (
                      <span className="text-ash">—</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-ash font-mono">
                    {d.file_size_bytes
                      ? `${Math.round(d.file_size_bytes / 1024)} KB`
                      : '—'}
                  </td>
                  <td className="p-3 text-xs text-ash font-mono">
                    {new Date(d.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </td>
                  <td className="p-3">
                    {d.archived_at ? (
                      <span className="text-[10px] tracking-wider uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium">
                        Archived
                      </span>
                    ) : expState === 'expired' ? (
                      <span className="text-[10px] tracking-wider uppercase bg-signal/15 text-signal px-2 py-0.5 rounded-pill font-medium">
                        Expired
                      </span>
                    ) : expState === 'expiring' ? (
                      <span className="text-[10px] tracking-wider uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium">
                        Soon
                      </span>
                    ) : (
                      <span className="text-[10px] tracking-wider uppercase bg-volt/10 text-volt px-2 py-0.5 rounded-pill font-medium">
                        Valid
                      </span>
                    )}
                  </td>
                  <td className="p-3">
                    <Link
                      href={`/admin/documents/${d.id}`}
                      className="text-[10px] tracking-widest uppercase text-leaf hover:underline font-semibold"
                    >
                      Inspect →
                    </Link>
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-ash">
                  No documents
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-ash/70 leading-relaxed mt-4">
        File contents (the actual mulkiya / insurance PDFs) are NOT shown here.
        Admin role bypasses RLS for the document row, but storage objects are
        only accessible via the customer's signed-URL flow. To read a file for
        a support escalation, ask the customer to share it via /a code.
      </p>
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
  tone?: 'wallet' | 'signal'
}) {
  const valueColor =
    tone === 'wallet'
      ? 'text-wallet'
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
