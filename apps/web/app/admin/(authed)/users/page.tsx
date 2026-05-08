import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Profile = {
  id: string
  email: string | null
  full_name: string | null
  phone: string | null
  preferred_language: string
  created_at: string
}

type VehicleCount = { owner_id: string; cnt: number }

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''

  const supabase = createAdminClient()

  let query = supabase
    .from('profiles')
    .select('id, email, full_name, phone, preferred_language, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    query = query.or(
      `email.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%`
    )
  }

  const { data: profiles } = await query

  // Vehicle counts per owner (just for context)
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('owner_id')

  const counts = new Map<string, number>()
  for (const v of vehicles ?? []) {
    counts.set(v.owner_id, (counts.get(v.owner_id) ?? 0) + 1)
  }

  const list = (profiles ?? []) as Profile[]

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Users · {list.length}
          </h1>
        </div>
        <form className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search email, name, phone…"
            className="field max-w-xs"
          />
          <button type="submit" className="pill-outline text-sm">
            Search
          </button>
          {q && (
            <Link href="/admin/users" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Name</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Phone</th>
              <th className="text-left p-3">Lang</th>
              <th className="text-right p-3">Vehicles</th>
              <th className="text-right p-3">Joined</th>
            </tr>
          </thead>
          <tbody>
            {list.map((u) => (
              <tr key={u.id} className="border-b border-seam/50 hover:bg-iron/30">
                <td className="p-3 text-chalk">{u.full_name ?? '—'}</td>
                <td className="p-3 font-mono text-xs text-ash">{u.email ?? '—'}</td>
                <td className="p-3 font-mono text-xs text-ash">{u.phone ?? '—'}</td>
                <td className="p-3 text-ash uppercase text-xs">{u.preferred_language}</td>
                <td className="p-3 text-right font-mono tabular-nums text-chalk">
                  {counts.get(u.id) ?? 0}
                </td>
                <td className="p-3 text-right text-xs text-ash">
                  {new Date(u.created_at).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ash">
                  No users {q && `match "${q}"`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
