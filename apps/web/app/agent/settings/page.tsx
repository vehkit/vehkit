import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateAgentOrg } from '@/app/actions/agent-onboarding'
import { AgentTradeLicenseUpload } from '@/components/AgentTradeLicenseUpload'

export const dynamic = 'force-dynamic'

export default async function AgentSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error
  const saved = sp.saved === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/agent/settings')

  const { data: membership } = await supabase
    .from('agent_members')
    .select(
      'agent_id, role, agents(id, name, slug, category, emirate, phone, email, verification_tier, trade_license_url, trade_license_uploaded_at)',
    )
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
      verification_tier: 'unverified' | 'silver' | 'gold' | string
      trade_license_url: string | null
      trade_license_uploaded_at: string | null
    } | null
  }
  const m = membership as unknown as Membership | null

  if (!m) redirect('/agent/start')
  const a = m.agents
  if (!a) redirect('/agent/start')

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      <div className="max-w-xl mx-auto px-6 pt-6 md:pt-8">
        <Link
          href="/agent"
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← Dashboard
        </Link>

        <p className="nav-pill mt-3">vehkit · agent</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Settings
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Org details that customers see when they share with you. Trade
          licence verification opens up code redemption.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}
        {saved && (
          <div className="mt-6 bg-volt/10 border border-volt/30 text-volt text-sm px-4 py-3 rounded-DEFAULT">
            Saved
          </div>
        )}

        {/* TRADE LICENCE — gates code redemption */}
        <section className="mt-8">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Verification
          </h2>
          <AgentTradeLicenseUpload
            agentId={a.id}
            hasLicense={!!a.trade_license_url}
            currentTier={a.verification_tier}
          />
        </section>

        {/* EDITABLE ORG FIELDS */}
        <section className="mt-10">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Organisation
          </h2>
          <form action={updateAgentOrg} id="agent-settings-form" className="space-y-4">
            <input type="hidden" name="agent_id" value={a.id} />

            <div>
              <label htmlFor="name" className="label">
                Name <span className="text-signal">*</span>
              </label>
              <input
                id="name"
                name="name"
                type="text"
                required
                maxLength={120}
                defaultValue={a.name}
                className="field"
              />
            </div>

            <div>
              <label htmlFor="category" className="label">
                Category
              </label>
              <select
                id="category"
                name="category"
                defaultValue={a.category}
                className="field"
              >
                <option value="insurance">Insurance broker</option>
                <option value="fleet">Fleet manager</option>
                <option value="leasing">Leasing / rental</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="emirate" className="label">
                  Emirate
                </label>
                <select
                  id="emirate"
                  name="emirate"
                  defaultValue={a.emirate ?? ''}
                  className="field"
                >
                  <option value="">Pick…</option>
                  <option value="Dubai">Dubai</option>
                  <option value="Abu Dhabi">Abu Dhabi</option>
                  <option value="Sharjah">Sharjah</option>
                  <option value="Ajman">Ajman</option>
                  <option value="Fujairah">Fujairah</option>
                  <option value="Ras Al Khaimah">Ras Al Khaimah</option>
                  <option value="Umm Al Quwain">Umm Al Quwain</option>
                </select>
              </div>
              <div>
                <label htmlFor="phone" className="label">
                  Phone
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={a.phone ?? ''}
                  placeholder="+971 50 …"
                  className="field"
                />
              </div>
            </div>

            <div>
              <label htmlFor="email" className="label">
                Contact email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={a.email ?? ''}
                placeholder="hello@yourcompany.ae"
                className="field"
              />
            </div>
          </form>
        </section>

        {/* SLUG (read-only — directory routing) */}
        <section className="mt-10">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Public handle
          </h2>
          <div className="card p-5">
            <p className="text-xs text-ash leading-relaxed">
              Your directory slug. Customers won't see this until your desk is
              public-listed (Silver+).
            </p>
            <p className="text-sm font-mono text-chalk mt-2">
              vehkit.com/agents/{a.slug}
            </p>
          </div>
        </section>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href="/agent" className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            form="agent-settings-form"
            className="pill-primary flex-[2] text-center"
          >
            Save changes
          </button>
        </div>
      </div>
    </main>
  )
}
