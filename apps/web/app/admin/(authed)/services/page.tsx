import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Record_ = {
  id: string
  vehicle_id: string
  service_type: string
  service_date: string
  odometer: number | null
  cost_aed: number | null
  workshop_name_freetext: string | null
  attestation: 'owner' | 'receipt' | 'workshop'
  created_at: string
}

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ attestation?: string; q?: string }>
}) {
  const sp = await searchParams
  const attestation = sp.attestation ?? ''
  const q = sp.q?.trim() ?? ''

  const supabase = createAdminClient()

  let query = supabase
    .from('service_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (attestation) {
    query = query.eq('attestation', attestation)
  }
  if (q) {
    query = query.or(
      `service_type.ilike.%${q}%,workshop_name_freetext.ilike.%${q}%,notes.ilike.%${q}%`
    )
  }

  const { data: records } = await query
  const list = (records ?? []) as Record_[]

  // Vehicle names
  const vehicleIds = [...new Set(list.map((r) => r.vehicle_id))]
  const { data: vehicles } =
    vehicleIds.length > 0
      ? await supabase
          .from('vehicles')
          .select('id, make, model, nickname, plate_number')
          .in('id', vehicleIds)
      : { data: [] }
  const vMap = new Map<string, { name: string; plate: string | null }>()
  for (const v of vehicles ?? []) {
    vMap.set(v.id, {
      name: v.nickname ?? `${v.make} ${v.model}`,
      plate: v.plate_number,
    })
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Service records · {list.length}
          </h1>
        </div>
        <form className="flex gap-2 flex-wrap">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search type, workshop, notes…"
            className="field max-w-xs"
          />
          <select
            name="attestation"
            defaultValue={attestation}
            className="field max-w-[150px]"
          >
            <option value="">All attestation</option>
            <option value="owner">Owner</option>
            <option value="receipt">Receipt</option>
            <option value="workshop">Workshop</option>
          </select>
          <button type="submit" className="pill-outline text-sm">
            Apply
          </button>
          {(q || attestation) && (
            <Link href="/admin/services" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Date</th>
              <th className="text-left p-3">Service</th>
              <th className="text-left p-3">Vehicle</th>
              <th className="text-left p-3">Workshop</th>
              <th className="text-right p-3">Odo</th>
              <th className="text-right p-3">Cost</th>
              <th className="text-left p-3">Attest</th>
            </tr>
          </thead>
          <tbody>
            {list.map((r) => {
              const v = vMap.get(r.vehicle_id)
              return (
                <tr key={r.id} className="border-b border-seam/50 hover:bg-iron/30">
                  <td className="p-3 text-xs text-ash whitespace-nowrap">
                    {new Date(r.service_date).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </td>
                  <td className="p-3 text-chalk">{humanize(r.service_type)}</td>
                  <td className="p-3 text-xs">
                    <p className="text-chalk">{v?.name ?? '—'}</p>
                    {v?.plate && <p className="text-ash font-mono">{v.plate}</p>}
                  </td>
                  <td className="p-3 text-xs text-ash">{r.workshop_name_freetext ?? '—'}</td>
                  <td className="p-3 text-right font-mono tabular-nums text-chalk">
                    {r.odometer?.toLocaleString() ?? '—'}
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-chalk">
                    {r.cost_aed != null ? `${Number(r.cost_aed).toLocaleString()}` : '—'}
                  </td>
                  <td className="p-3">
                    <AttestationBadge tier={r.attestation} />
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-ash">
                  No records
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function AttestationBadge({ tier }: { tier: 'owner' | 'receipt' | 'workshop' }) {
  const cls =
    tier === 'workshop'
      ? 'bg-volt/15 text-volt'
      : tier === 'receipt'
        ? 'bg-iron text-chalk'
        : 'bg-iron text-ash'
  return (
    <span
      className={`text-[10px] tracking-wider uppercase ${cls} px-2 py-0.5 rounded-pill font-medium`}
    >
      {tier}
    </span>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
