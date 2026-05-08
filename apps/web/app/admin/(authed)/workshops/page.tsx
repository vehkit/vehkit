import Link from 'next/link'
import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Workshop = {
  id: string
  name: string
  slug: string
  emirate: string | null
  phone: string | null
  email: string | null
  verification_tier: 'unverified' | 'silver' | 'gold'
  trade_license_url: string | null
  created_at: string
}

async function setTier(formData: FormData) {
  'use server'
  const id = String(formData.get('id') ?? '')
  const tier = String(formData.get('tier') ?? '')
  if (!id || !['unverified', 'silver', 'gold'].includes(tier)) return
  const supabase = createAdminClient()
  await supabase.rpc('admin_set_workshop_tier', {
    p_workshop_id: id,
    p_tier: tier,
  })
  revalidatePath('/admin/workshops')
}

export default async function AdminWorkshopsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string }>
}) {
  const sp = await searchParams
  const q = sp.q?.trim() ?? ''
  const tierFilter = sp.tier ?? ''

  const supabase = createAdminClient()

  let query = supabase
    .from('workshops')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (q) {
    query = query.or(`name.ilike.%${q}%,emirate.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`)
  }
  if (tierFilter) {
    query = query.eq('verification_tier', tierFilter)
  }

  const { data: workshops } = await query
  const list = (workshops ?? []) as Workshop[]

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl">
      <header className="mb-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
            Workshops · {list.length}
          </h1>
        </div>
        <form className="flex gap-2 flex-wrap">
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search name, emirate…"
            className="field max-w-xs"
          />
          <select name="tier" defaultValue={tierFilter} className="field max-w-[140px]">
            <option value="">All tiers</option>
            <option value="gold">Gold</option>
            <option value="silver">Silver</option>
            <option value="unverified">Unverified</option>
          </select>
          <button type="submit" className="pill-outline text-sm">
            Apply
          </button>
          {(q || tierFilter) && (
            <Link href="/admin/workshops" className="pill-ghost text-sm">
              Clear
            </Link>
          )}
        </form>
      </header>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[10px] uppercase tracking-widest text-ash border-b border-seam">
            <tr>
              <th className="text-left p-3">Workshop</th>
              <th className="text-left p-3">Emirate</th>
              <th className="text-left p-3">Contact</th>
              <th className="text-left p-3">Tier</th>
              <th className="text-left p-3">License</th>
              <th className="text-left p-3">Set tier</th>
            </tr>
          </thead>
          <tbody>
            {list.map((w) => (
              <tr key={w.id} className="border-b border-seam/50 hover:bg-iron/30 align-top">
                <td className="p-3">
                  <p className="text-chalk font-medium">{w.name}</p>
                  <Link
                    href={`/w/${w.slug}`}
                    target="_blank"
                    className="text-xs text-ash hover:text-volt font-mono"
                  >
                    /w/{w.slug}
                  </Link>
                </td>
                <td className="p-3 text-xs text-ash">{w.emirate ?? '—'}</td>
                <td className="p-3 text-xs">
                  {w.email && <p className="text-ash font-mono">{w.email}</p>}
                  {w.phone && <p className="text-ash font-mono">{w.phone}</p>}
                </td>
                <td className="p-3">
                  <TierBadge tier={w.verification_tier} />
                </td>
                <td className="p-3 text-xs text-ash">
                  {w.trade_license_url ? '✓ on file' : '—'}
                </td>
                <td className="p-3">
                  <form action={setTier} className="flex gap-1">
                    <input type="hidden" name="id" value={w.id} />
                    <select
                      name="tier"
                      defaultValue={w.verification_tier}
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
            ))}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-ash">
                  No workshops
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TierBadge({ tier }: { tier: 'unverified' | 'silver' | 'gold' }) {
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
