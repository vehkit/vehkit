import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { VehicleDocumentsList } from '@/components/VehicleDocumentsList'

export default async function AgentGrantPage({
  params,
}: {
  params: Promise<{ grantId: string }>
}) {
  const { grantId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect(`/login?next=/agent/grant/${grantId}`)

  // Defence in depth: explicit membership guard. The layout above us
  // already returned bare children for users without a membership, but
  // anyone who lost their membership between grant creation and this
  // request would otherwise see a confusing "Customer vehicle" fallback.
  // Bounce them to onboarding instead.
  const { data: anyMembership } = await supabase
    .from('agent_members')
    .select('agent_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!anyMembership) redirect('/agent/start')

  // Read the grant via RLS — agent_members read their own org's grants.
  const { data: grant } = await supabase
    .from('agent_grants')
    .select('id, vehicle_id, granted_at, full_until, expires_at, revoked_at, agent_id')
    .eq('id', grantId)
    .maybeSingle()

  if (!grant) notFound()

  const now = Date.now()
  const fullUntilMs = new Date(grant.full_until).getTime()
  const expiresAtMs = new Date(grant.expires_at).getTime()
  const isFullWindow = !grant.revoked_at && now < fullUntilMs
  const isMetaWindow = !grant.revoked_at && now >= fullUntilMs && now < expiresAtMs

  // Pull the vehicle profile (RLS-checked — agents have read in full window
  // via vehicle_access? Actually no — for v1 we just rely on the grant
  // joining vehicle data in agent_dashboard_grants RPC. For the detail
  // view, fetch via SECURITY DEFINER proxy below.)
  const { data: vehicleData } = await supabase
    .from('vehicles')
    .select('id, make, model, plate_emirate, plate_number, color, year, owner_id')
    .eq('id', grant.vehicle_id)
    .maybeSingle()

  // Documents — RLS gates this. In the full window, the
  // 'agents_read_docs_in_full_window' policy unblocks reads. After,
  // direct SELECT returns nothing and we render the renewal-track summary.
  const { data: docs } = await supabase
    .from('vehicle_documents')
    .select(
      'id, doc_type, label, storage_path, file_type, file_size_bytes, issued_date, expires_at, created_at',
    )
    .eq('vehicle_id', grant.vehicle_id)
    .is('archived_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })

  const documents = docs ?? []

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 pt-6 md:pt-8">
        <Link
          href="/agent"
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← Dashboard
        </Link>

        <div className="mt-4">
          <p className="nav-pill">vehkit · agent</p>
          <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight mt-3">
            {vehicleData
              ? `${vehicleData.make} ${vehicleData.model}`
              : 'Customer vehicle'}
          </h1>
          {vehicleData && (
            <p className="text-xs text-ash mt-2">
              {[
                vehicleData.year,
                vehicleData.color,
                vehicleData.plate_emirate && vehicleData.plate_number
                  ? `${vehicleData.plate_emirate} · ${vehicleData.plate_number}`
                  : vehicleData.plate_number,
              ]
                .filter(Boolean)
                .join(' · ')}
            </p>
          )}
        </div>

        {/* Window banner */}
        {isFullWindow ? (
          <div className="mt-5 bg-volt/10 border border-volt/30 text-volt text-sm px-4 py-3 rounded-DEFAULT flex items-start gap-3">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="shrink-0 mt-0.5"
              aria-hidden
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            <div>
              <p className="font-medium leading-snug">
                Full document access until{' '}
                {new Date(grant.full_until).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
              <p className="text-volt/80 text-xs mt-0.5">
                Download what you need now. After the window closes, only
                document type + expiry stays visible to you.
              </p>
            </div>
          </div>
        ) : isMetaWindow ? (
          <div className="mt-5 bg-wallet/10 border border-wallet/30 text-wallet text-sm px-4 py-3 rounded-DEFAULT">
            <p className="font-medium leading-snug">
              Renewal-track only — full document window closed.
            </p>
            <p className="text-wallet/80 text-xs mt-0.5">
              You retain expiry-date visibility until{' '}
              {new Date(grant.expires_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
              . Ask the customer to share again to reopen full access.
            </p>
          </div>
        ) : (
          <div className="mt-5 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            <p className="font-medium leading-snug">
              This grant has expired or been revoked.
            </p>
          </div>
        )}

        <section id="documents" className="mt-8">
          <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
            Documents ({documents.length})
          </h2>
          {/* In the full window, the agent reads docs through the standard
              VehicleDocumentsList — but as a non-owner, so view/archive
              actions are hidden. */}
          <VehicleDocumentsList
            vehicleId={grant.vehicle_id}
            documents={documents}
            isOwner={false}
          />
        </section>
      </div>
    </main>
  )
}
