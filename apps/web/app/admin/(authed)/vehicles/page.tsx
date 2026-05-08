import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Vehicle = {
  id: string
  make: string
  model: string
  year: number | null
  nickname: string | null
  plate_number: string | null
  plate_emirate: string | null
  current_odometer: number | null
  owner_id: string
  fleet_org_id: string | null
  created_at: string
}

export default async function AdminVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; emirate?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const emirateFilter = sp.emirate ?? ''

  const supabase = createAdminClient()

  let query = supabase
    .from('vehicles')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    query = query.or(
      `make.ilike.%${q}%,model.ilike.%${q}%,nickname.ilike.%${q}%,plate_number.ilike.%${q}%,vin.ilike.%${q}%`
    )
  }
  if (emirateFilter) {
    query = query.eq('plate_emirate', emirateFilter)
  }

  const { data: vehicles } = await query
  const list = (vehicles ?? []) as Vehicle[]

  // Owner emails for display
  const ownerIds = [...new Set(list.map((v) => v.owner_id))]
  const { data: owners } =
    ownerIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', ownerIds)
      : { data: [] }
  const ownerMap = new Map<string, { email: string | null; name: string | null }>()
  for (const o of owners ?? []) {
    ownerMap.set(o.id, { email: o.email, name: o.full_name })
  }

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Vehicles · {list.length}
          </h1>
        </div>
        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search make, plate, VIN…"
            className="field max-w-xs"
          />
          <button type="submit" className="pill-outline text-sm">
            Search
          </button>
          {(q || emirateFilter) && (
            <Link href="/admin/vehicles" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Vehicle</th>
              <th className="text-left p-3">Plate</th>
              <th className="text-left p-3">Owner</th>
              <th className="text-right p-3">Odometer</th>
              <th className="text-left p-3">Fleet</th>
              <th className="text-right p-3">Added</th>
            </tr>
          </thead>
          <tbody>
            {list.map((v) => {
              const owner = ownerMap.get(v.owner_id)
              return (
                <tr key={v.id} className="border-b border-seam/50 hover:bg-iron/30">
                  <td className="p-3">
                    <p className="text-chalk">{v.nickname ?? `${v.make} ${v.model}`}</p>
                    <p className="text-xs text-ash">
                      {[v.year, v.make, v.model].filter(Boolean).join(' · ')}
                    </p>
                  </td>
                  <td className="p-3 text-xs">
                    {v.plate_emirate && <span className="text-ash">{v.plate_emirate} · </span>}
                    <span className="font-mono text-chalk">{v.plate_number ?? '—'}</span>
                  </td>
                  <td className="p-3 text-xs">
                    <p className="text-chalk">{owner?.name ?? '—'}</p>
                    <p className="text-ash font-mono">{owner?.email ?? '—'}</p>
                  </td>
                  <td className="p-3 text-right font-mono tabular-nums text-chalk">
                    {v.current_odometer?.toLocaleString() ?? '—'}
                  </td>
                  <td className="p-3 text-xs text-ash">{v.fleet_org_id ? 'Fleet' : '—'}</td>
                  <td className="p-3 text-right text-xs text-ash">
                    {new Date(v.created_at).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              )
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ash">
                  No vehicles {q && `match "${q}"`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
