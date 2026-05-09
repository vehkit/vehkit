import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AgentSettingsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/agent/settings')

  const { data: membership } = await supabase
    .from('agent_members')
    .select('agent_id, role, agents(id, name, slug, category, emirate, phone, email, verification_tier)')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  type Membership = {
    agent_id: string
    role: string
    agents: {
      id: string
      name: string
      slug: string
      category: string
      emirate: string | null
      phone: string | null
      email: string | null
      verification_tier: string
    } | null
  }
  const m = membership as unknown as Membership | null

  if (!m) redirect('/agent/start')
  const a = m.agents

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      <div className="max-w-3xl mx-auto px-6 pt-6 md:pt-8">
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter">
          Settings
        </h1>

        <section className="mt-6 card p-5 space-y-4">
          <div>
            <p className="text-[10px] tracking-widest uppercase text-ash">
              Organisation
            </p>
            <p className="text-base font-semibold text-chalk mt-1">
              {a?.name}
            </p>
            <p className="text-xs text-ash mt-0.5 capitalize">
              {a?.category} · {a?.emirate ?? 'No emirate'}
            </p>
          </div>

          <div className="border-t border-seam pt-4">
            <p className="text-[10px] tracking-widest uppercase text-ash">
              Verification
            </p>
            <p className="text-sm text-chalk mt-1 capitalize">
              {a?.verification_tier ?? 'unverified'}
            </p>
            <p className="text-xs text-ash mt-1 leading-relaxed">
              Trade-license verification will mirror the workshop flow —
              coming next session. Until then, customers can still share
              codes with you, but your desk won't appear in the public
              agent directory.
            </p>
          </div>

          <div className="border-t border-seam pt-4">
            <p className="text-[10px] tracking-widest uppercase text-ash">
              Contact
            </p>
            <p className="text-xs text-chalk mt-1 font-mono">
              {a?.phone ?? '—'}
            </p>
            <p className="text-xs text-chalk mt-0.5 font-mono">
              {a?.email ?? '—'}
            </p>
          </div>
        </section>

        <p className="text-[11px] text-ash/70 leading-relaxed mt-6">
          Need to update org details? Editing UI ships in the next iteration.
          For now, contact{' '}
          <Link href="mailto:hello@vehkit.com" className="text-volt underline">
            hello@vehkit.com
          </Link>
          .
        </p>
      </div>
    </main>
  )
}
