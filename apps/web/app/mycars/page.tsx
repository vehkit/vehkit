import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { MyCarsList, type VehicleSummary } from '@/components/MyCarsList'
import { GaragePulse, type FuelLogRow, type ActivityEvent } from '@/components/GaragePulse'

export default async function MyCarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const today = new Date().toISOString().slice(0, 10)
  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  // Parallelize: vehicles + per-vehicle pending count + per-vehicle history
  // + documents + reminders + agent grants + top workshops (for the
  // community discovery tile in the suggestions section).
  const [
    vehiclesRes,
    pendingRes,
    historyRes,
    docsRes,
    remindersRes,
    grantsRes,
    topWorkshopsRes,
    fuelRes,
  ] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select('vehicle_id')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo)
      .is('confirmed_at', null)
      .is('rejected_at', null),
    supabase
      .from('service_records')
      .select('vehicle_id, service_date, workshop_name_freetext, cost_aed, created_at, id')
      .is('rejected_at', null)
      .order('service_date', { ascending: false }),
    supabase
      .from('vehicle_documents')
      .select('id, vehicle_id, doc_type, label, expires_at, created_at')
      .is('archived_at', null),
    supabase
      .from('reminders')
      .select('id, vehicle_id, due_date, due_at_km, status')
      .eq('status', 'open'),
    supabase
      .from('agent_grants')
      .select('id, vehicle_id, expires_at, revoked_at')
      .eq('granted_by', user.id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()),
    supabase.rpc('public_workshop_directory', {
      p_emirate: null,
      p_limit: 4,
      p_offset: 0,
    }),
    supabase
      .from('fuel_logs')
      .select('id, vehicle_id, logged_at, odometer_km, liters, total_aed, fuel_grade, station_name')
      .order('logged_at', { ascending: false }),
  ])

  const vehicles = vehiclesRes.data
  const pendingEntries = pendingRes.data
  const historyRows = historyRes.data ?? []
  const documents = (docsRes.data ?? []) as Array<{
    id: string
    vehicle_id: string
    doc_type: string
    label: string | null
    expires_at: string | null
    created_at: string
  }>
  const fuelLogs = (fuelRes.data ?? []) as FuelLogRow[]
  const reminders = (remindersRes.data ?? []) as Array<{
    id: string
    vehicle_id: string
    due_date: string | null
    due_at_km: number | null
    status: string
  }>
  const activeGrants = (grantsRes.data ?? []) as Array<{
    id: string
    vehicle_id: string
  }>
  const topWorkshops = (topWorkshopsRes.data ?? []) as Array<{
    id: string
    name: string
    logo_url: string | null
    hero_image_url: string | null
    verification_tier: string
    total_entries: number
  }>

  const pendingByVehicle = new Map<string, number>()
  for (const p of pendingEntries ?? []) {
    pendingByVehicle.set(p.vehicle_id, (pendingByVehicle.get(p.vehicle_id) ?? 0) + 1)
  }

  // Aggregate per-vehicle: last service date + workshop, total count, total spend.
  // Rows are pre-sorted desc by service_date, so the first row per vehicle is
  // the most recent — `lastService` only gets set on first encounter.
  const summaryByVehicle = new Map<string, VehicleSummary>()
  for (const row of historyRows) {
    const vid = row.vehicle_id as string
    if (!vid) continue
    const existing = summaryByVehicle.get(vid)
    if (!existing) {
      summaryByVehicle.set(vid, {
        serviceCount: 1,
        totalSpend: Number(row.cost_aed ?? 0),
        lastServiceDate: row.service_date as string | null,
        lastWorkshop: (row.workshop_name_freetext as string | null) ?? null,
      })
    } else {
      existing.serviceCount += 1
      existing.totalSpend += Number(row.cost_aed ?? 0)
    }
  }

  // Garage-wide stats for the editorial header
  const totalVehicles = vehicles?.length ?? 0
  const totalKmTracked = (vehicles ?? []).reduce(
    (sum, v) => sum + (v.current_odometer ?? 0),
    0,
  )
  const totalPending = pendingEntries?.length ?? 0
  const totalServices = historyRows.length

  // ===== Dynamic suggestions engine =====
  // Build a priority-ranked list of "what's next" cards from the user's
  // current state. Higher-urgency items (pending entries, overdue
  // reminders) bubble to the top; discovery (find a workshop) is always
  // last. We render at most 4 to keep the section scannable.
  const docsByVehicle = new Map<string, number>()
  for (const d of documents) {
    docsByVehicle.set(d.vehicle_id, (docsByVehicle.get(d.vehicle_id) ?? 0) + 1)
  }
  const expiringDocs = documents.filter(
    (d) => d.expires_at && d.expires_at >= today && d.expires_at <= in30,
  )
  const expiredDocs = documents.filter(
    (d) => d.expires_at && d.expires_at < today,
  )
  const overdueReminders = reminders.filter(
    (r) => r.due_date && r.due_date < today,
  )
  const dueSoonReminders = reminders.filter(
    (r) => r.due_date && r.due_date >= today && r.due_date <= in30,
  )
  const vehiclesMissingDocs = (vehicles ?? []).filter(
    (v) => (docsByVehicle.get(v.id) ?? 0) === 0,
  )
  const hasAnyShare = activeGrants.length > 0
  const hasAnyDocs = documents.length > 0

  type Suggestion = {
    key: string
    title: string
    body: string
    href: string
    cta: string
    tone: 'signal' | 'wallet' | 'volt' | 'ash'
    icon: 'alert' | 'doc' | 'clock' | 'share' | 'compass' | 'workshop'
  }
  const allSuggestions: Suggestion[] = []

  if (totalPending > 0) {
    allSuggestions.push({
      key: 'confirm-pending',
      title: `${totalPending} workshop ${totalPending === 1 ? 'entry' : 'entries'} awaiting you`,
      body:
        'Confirm or reject within 24 hours. After that, entries lock in automatically.',
      href: '/notifications',
      cta: 'Open inbox',
      tone: 'wallet',
      icon: 'alert',
    })
  }
  if (overdueReminders.length > 0) {
    allSuggestions.push({
      key: 'overdue-reminders',
      title: `${overdueReminders.length} overdue ${overdueReminders.length === 1 ? 'reminder' : 'reminders'}`,
      body:
        'Service reminders that have already slipped past their due date. Take action or snooze.',
      href: '/notifications',
      cta: 'Review',
      tone: 'signal',
      icon: 'alert',
    })
  }
  if (expiredDocs.length > 0) {
    allSuggestions.push({
      key: 'expired-docs',
      title: `${expiredDocs.length} document ${expiredDocs.length === 1 ? 'has' : 'have'} expired`,
      body:
        'Mulkiya, registration, insurance — refresh expired files so you\'re never that person scrambling at the gate.',
      href: vehicles?.[0] ? `/vehicles/${vehicles[0].id}#documents` : '/mycars',
      cta: 'Update',
      tone: 'signal',
      icon: 'doc',
    })
  }
  if (expiringDocs.length > 0) {
    allSuggestions.push({
      key: 'expiring-docs',
      title: `${expiringDocs.length} document ${expiringDocs.length === 1 ? 'expires' : 'expire'} this month`,
      body:
        'We\'ll keep nudging until it\'s sorted. Open the doc, see what\'s due, get it done.',
      href: vehicles?.[0] ? `/vehicles/${vehicles[0].id}#documents` : '/mycars',
      cta: 'View',
      tone: 'wallet',
      icon: 'clock',
    })
  }
  if (totalVehicles > 0 && vehiclesMissingDocs.length > 0 && !hasAnyDocs) {
    const v = vehiclesMissingDocs[0]!
    allSuggestions.push({
      key: 'add-docs',
      title: 'Build your digital glovebox',
      body:
        'Mulkiya, registration, insurance, NOC, service contracts — store them once, find them in seconds. We\'ll remind you before anything expires.',
      href: `/vehicles/${v.id}/documents/new`,
      cta: 'Upload',
      tone: 'volt',
      icon: 'doc',
    })
  }
  if (
    totalVehicles > 0 &&
    dueSoonReminders.length === 0 &&
    overdueReminders.length === 0 &&
    reminders.length === 0
  ) {
    const v = vehicles?.[0]
    if (v) {
      allSuggestions.push({
        key: 'set-reminders',
        title: 'Set service reminders',
        body:
          'Never miss an oil change, tyre rotation, or registration renewal. Auto-fires when due.',
        href: `/vehicles/${v.id}/reminders/new`,
        cta: 'Add reminder',
        tone: 'volt',
        icon: 'clock',
      })
    }
  }
  if (totalVehicles > 0 && hasAnyDocs && !hasAnyShare) {
    allSuggestions.push({
      key: 'share-with-agent',
      title: 'Need to share with someone?',
      body:
        'Insurance quote, leasing handover, sale to a buyer — generate a one-time code. 60 minutes of full access, no PDFs flying around WhatsApp.',
      href: vehicles?.[0]
        ? `/vehicles/${vehicles[0].id}#documents`
        : '/mycars',
      cta: 'Generate code',
      tone: 'volt',
      icon: 'share',
    })
  }
  // Always-on discovery cards — fill the remaining slots
  allSuggestions.push({
    key: 'find-workshop',
    title: 'Find a verified workshop',
    body:
      'Gold and Silver shops across the UAE — sorted by tier, with reviews and verified entries.',
    href: '/workshops',
    cta: 'Browse',
    tone: 'ash',
    icon: 'workshop',
  })
  if (totalVehicles > 0) {
    allSuggestions.push({
      key: 'set-reminders-evergreen',
      title: 'Let Vehkit do the remembering',
      body:
        "Mulkiya, oil change, tyre rotation, warranty — set it once, get reminded before it's due. No more renewal-day chaos.",
      href: vehicles?.[0]
        ? `/vehicles/${vehicles[0].id}/reminders/new`
        : '/mycars',
      cta: 'Add reminder',
      tone: 'ash',
      icon: 'clock',
    })
  }

  // Cap at 4 — anything beyond is noise
  const suggestions = allSuggestions.slice(0, 4)

  // ===== Activity timeline =====
  // Mix services + fuel + docs into a single time-sorted feed for "Recent
  // activity". We take the most recent ~5 across all sources.
  const vehiclesById = new Map(
    (vehicles ?? []).map((v) => [
      v.id,
      v.nickname ?? `${v.make} ${v.model}`,
    ]),
  )
  const events: ActivityEvent[] = []
  for (const r of historyRows.slice(0, 8)) {
    events.push({
      kind: 'service',
      at:
        (r as { service_date?: string | null }).service_date ??
        (r as { created_at?: string }).created_at ??
        '',
      vehicleId: r.vehicle_id as string,
      vehicleLabel: vehiclesById.get(r.vehicle_id as string) ?? 'Vehicle',
      label:
        (r as { workshop_name_freetext?: string | null })
          .workshop_name_freetext ?? 'Service entry',
      meta:
        (r as { cost_aed?: number | null }).cost_aed != null
          ? `AED ${Number((r as { cost_aed?: number }).cost_aed).toLocaleString()}`
          : null,
    })
  }
  for (const f of fuelLogs.slice(0, 8)) {
    events.push({
      kind: 'fuel',
      at: f.logged_at,
      vehicleId: f.vehicle_id,
      vehicleLabel: vehiclesById.get(f.vehicle_id) ?? 'Vehicle',
      label: f.station_name ?? 'Fill-up',
      meta:
        f.total_aed != null
          ? `${Number(f.liters).toFixed(1)} L · AED ${Number(
              f.total_aed,
            ).toLocaleString()}`
          : `${Number(f.liters).toFixed(1)} L`,
    })
  }
  for (const d of documents.slice(0, 4)) {
    events.push({
      kind: 'doc',
      at: d.created_at,
      vehicleId: d.vehicle_id,
      vehicleLabel: vehiclesById.get(d.vehicle_id) ?? 'Vehicle',
      label: d.label ?? d.doc_type.replace(/_/g, ' '),
      meta: d.expires_at ? `Expires ${d.expires_at}` : null,
    })
  }
  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const recentActivity = events.slice(0, 6)

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      {/* Top bar — mobile only; desktop uses AppNav */}
      <header className="px-6 pt-6 pb-2 md:hidden max-w-3xl mx-auto">
        <p className="nav-pill">vehkit</p>
      </header>

      {/* Editorial header — PF rhythm: title + supporting stat strip.
          Compact: title and stats share a row on desktop, stack on mobile. */}
      <div className="px-6 pt-2 md:pt-5 pb-3 max-w-3xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
          <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none">
            Your garage
          </h1>
          {totalVehicles > 0 && (
            <div className="flex items-stretch gap-3">
              <Stat
                value={totalVehicles.toString()}
                label={totalVehicles === 1 ? 'vehicle' : 'vehicles'}
              />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat
                value={totalKmTracked.toLocaleString()}
                label="km tracked"
                mono
              />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat
                value={totalServices.toString()}
                label={totalServices === 1 ? 'service' : 'services'}
              />
              {totalPending > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={totalPending.toString()}
                    label="pending"
                    tone="wallet"
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <section className="px-6 max-w-3xl mx-auto">
        {vehicles && vehicles.length > 0 ? (
          <>
            <MyCarsList
              vehicles={vehicles}
              currentUserId={user.id}
              pendingByVehicle={Object.fromEntries(pendingByVehicle)}
              summaryByVehicle={Object.fromEntries(summaryByVehicle)}
            />

            {/* Garage Pulse — analytics across everything the user logs:
                fuel efficiency, spend, services, docs, recent activity.
                Renders only when there's enough data to be meaningful. */}
            <GaragePulse
              vehicles={(vehicles ?? []).map((v) => ({
                id: v.id,
                label: v.nickname ?? `${v.make} ${v.model}`,
                currentOdometer: v.current_odometer ?? null,
              }))}
              fuelLogs={fuelLogs}
              summaryByVehicle={Object.fromEntries(summaryByVehicle)}
              documentsCount={documents.length}
              activity={recentActivity}
            />

            {/* Dynamic suggestions — adapts to user state.
                Tiered like Bayut's home: ONE hero, ONE community discovery
                card with workshop avatars, plus 2 secondary rows. */}
            {suggestions.length > 0 && (
              <section className="mt-10 space-y-3">
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-[10px] tracking-widest uppercase text-ash">
                    What's next
                  </h2>
                </div>

                {/* TIER 1 — hero (highest-urgency suggestion) */}
                <HeroSuggestion s={suggestions[0]!} />

                {/* TIER 2 — community discovery with workshop avatars */}
                <CommunityCard
                  workshops={topWorkshops}
                  href="/workshops"
                  kicker="Workshop directory"
                  title="Find a verified workshop"
                  body="Gold and Silver shops across the UAE — sorted by tier, with reviews."
                />

                {/* TIER 3 — narrow secondary rows */}
                {suggestions.length > 1 && (
                  <ul className="space-y-3">
                    {suggestions.slice(1, 4).map((s) => (
                      <li key={s.key}>
                        <RowSuggestion s={s} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        ) : (
          <div className="space-y-4">
            {/* Hero — plain-English value prop + ONE primary CTA */}
            <div className="card p-8">
              <p className="nav-pill text-[10px]">Welcome</p>
              <h2 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-3 leading-tight">
                Let&apos;s get your car set up.
              </h2>
              <p className="text-ash mt-3 leading-relaxed text-sm md:text-base">
                Add your car once. Upload your mulkiya, insurance and any
                service receipts — or hand them to your workshop and let them
                do it.{' '}
                <span className="text-chalk font-medium">
                  We&apos;ll email you before anything expires.
                </span>{' '}
                When you sell, share one link — the buyer sees everything.
              </p>

              <Link
                href="/vehicles/new"
                className="pill-primary mt-6 inline-flex items-center gap-2"
              >
                Add your car — 2 minutes <span aria-hidden>→</span>
              </Link>

              <form action={createSampleVehicle} className="mt-3">
                <button
                  type="submit"
                  className="text-sm text-ash hover:text-chalk transition-colors underline-offset-4 hover:underline"
                >
                  or try with a sample car (a demo Corolla)
                </button>
              </form>
            </div>

            {/* Journey preview — shows what comes next so the first step feels purposeful */}
            <div className="card p-6">
              <p className="text-[10px] tracking-widest uppercase text-ash">
                What happens next
              </p>
              <ol className="mt-4 space-y-3">
                <JourneyStep
                  n="1"
                  active
                  title="Add your car"
                  body="Make, model, plate, current kilometres. Two minutes."
                />
                <JourneyStep
                  n="2"
                  title="Upload your stuff"
                  body="Mulkiya, insurance, service receipts. Drop in PDFs or photos — we store them safely."
                />
                <JourneyStep
                  n="3"
                  title="We do the remembering"
                  body="One morning email a month. Renewals, services due, reminders set. Nothing slips."
                />
                <JourneyStep
                  n="4"
                  title="Share one link when you sell"
                  body="Full verified history travels with the car. Buyers see the truth in one tap."
                />
              </ol>
            </div>
          </div>
        )}
      </section>

      {/* The floating "+" FAB lives on AppNav so it persists across all
          consumer pages — it covers add-car + service + reminder + doc + fuel
          with smart vehicle context. No per-page floating button needed. */}
    </main>
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
  tone?: 'wallet'
}) {
  const valueColor = tone === 'wallet' ? 'text-wallet' : 'text-chalk'
  return (
    <div className="min-w-0">
      <p
        className={`text-sm md:text-base font-semibold ${valueColor} ${
          mono ? 'font-mono tabular-nums tracking-tight' : 'tracking-tight'
        } leading-none`}
      >
        {value}
      </p>
      <p className="text-[9px] md:text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}

function JourneyStep({
  n,
  title,
  body,
  active,
}: {
  n: string
  title: string
  body: string
  active?: boolean
}) {
  return (
    <li className="flex gap-4 items-start">
      <div
        className={`shrink-0 w-9 h-9 rounded-pill flex items-center justify-center ${
          active
            ? 'bg-leaf text-noir border-2 border-leaf'
            : 'bg-iron text-ash border border-seam'
        }`}
      >
        <span className="font-mono text-sm font-semibold">{n}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p
          className={`text-sm md:text-base font-semibold leading-snug ${
            active ? 'text-leaf' : 'text-chalk'
          }`}
        >
          {title}
          {active && (
            <span className="ml-2 text-[10px] tracking-widest uppercase text-leaf/80 font-medium">
              · You are here
            </span>
          )}
        </p>
        <p className="text-xs md:text-sm text-ash mt-1 leading-relaxed">
          {body}
        </p>
      </div>
    </li>
  )
}

type SuggestionData = {
  key: string
  title: string
  body: string
  href: string
  cta: string
  tone: 'signal' | 'wallet' | 'volt' | 'ash'
  icon: 'alert' | 'doc' | 'clock' | 'share' | 'compass' | 'workshop'
}

/**
 * TIER 1 — full-width hero CTA. Used for the single highest-urgency
 * suggestion. Mirrors Bayut's "Sell or Rent Your Property" hero panel:
 * dark coloured surface, oversized title, supporting line, large
 * decorative icon, prominent badge.
 */
function HeroSuggestion({ s }: { s: SuggestionData }) {
  // Surface tone — urgency drives the dominant colour
  const surface =
    s.tone === 'signal'
      ? 'bg-gradient-to-br from-signal/20 via-signal/10 to-noir border-signal/40'
      : s.tone === 'wallet'
        ? 'bg-gradient-to-br from-wallet/25 via-wallet/10 to-noir border-wallet/40'
        : s.tone === 'volt'
          ? 'bg-gradient-to-br from-leaf/30 via-leaf/15 to-noir border-leaf/40'
          : 'bg-gradient-to-br from-iron via-carbon to-noir border-seam'
  const titleColor =
    s.tone === 'signal'
      ? 'text-signal'
      : s.tone === 'wallet'
        ? 'text-wallet'
        : s.tone === 'volt'
          ? 'text-leaf'
          : 'text-chalk'
  const badgeLabel =
    s.tone === 'signal'
      ? 'Action required'
      : s.tone === 'wallet'
        ? 'Heads up'
        : 'New'
  const badgeBg =
    s.tone === 'signal'
      ? 'bg-signal text-noir'
      : s.tone === 'wallet'
        ? 'bg-wallet text-noir'
        : 'bg-leaf text-noir'
  return (
    <Link
      href={s.href as Parameters<typeof Link>[0]['href']}
      className={`relative block rounded-DEFAULT border ${surface} overflow-hidden hover:opacity-95 transition-opacity`}
    >
      {/* Badge — top-left, mimics Bayut's NEW pill */}
      <span
        className={`absolute top-4 left-4 text-[10px] tracking-widest uppercase px-2 py-1 rounded-pill font-semibold ${badgeBg} z-10`}
      >
        {badgeLabel}
      </span>

      {/* Decorative oversized icon — top-right corner, low opacity */}
      <div
        className={`absolute -top-2 -right-2 ${titleColor} opacity-10 pointer-events-none`}
        aria-hidden
      >
        <BigSuggestionIcon name={s.icon} />
      </div>

      <div className="p-6 md:p-8 pt-12 md:pt-12 relative">
        <h3
          className={`text-xl md:text-2xl font-semibold tracking-tighter leading-tight ${titleColor}`}
        >
          {s.title}
        </h3>
        <p className="text-sm md:text-base text-chalk/85 mt-3 leading-relaxed max-w-md">
          {s.body}
        </p>
        <p
          className={`text-xs tracking-widest uppercase mt-5 ${titleColor} font-medium`}
        >
          {s.cta} →
        </p>
      </div>
    </Link>
  )
}

/**
 * TIER 2 — community discovery card. Shows real workshop logos as
 * overlapping circles (Bayut's "TruBroker" pattern). Conveys "this is a
 * marketplace with real participants" rather than just a directory link.
 */
function CommunityCard({
  workshops,
  href,
  kicker,
  title,
  body,
}: {
  workshops: Array<{
    id: string
    name: string
    logo_url: string | null
    hero_image_url: string | null
  }>
  href: string
  kicker: string
  title: string
  body: string
}) {
  const top = workshops.slice(0, 4)
  return (
    <Link
      href={href as Parameters<typeof Link>[0]['href']}
      className="relative block rounded-DEFAULT border border-leaf/30 overflow-hidden bg-gradient-to-br from-leaf-dk/40 via-noir to-noir hover:opacity-95 transition-opacity"
    >
      {/* Subtle layered horizontal lines, evoking Bayut's stacked waves */}
      <div
        className="absolute inset-0 opacity-30 pointer-events-none"
        aria-hidden
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, transparent 0 28px, rgb(var(--leaf) / 0.05) 28px 29px)',
        }}
      />

      <div className="relative p-6 md:p-8">
        {/* Avatar row — mimics TruBroker faces */}
        {top.length > 0 && (
          <div className="flex items-center -space-x-2 mb-4">
            {top.map((w) => {
              const initials = w.name
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((s) => s.charAt(0).toUpperCase())
                .join('')
              const photo = w.logo_url ?? w.hero_image_url
              return (
                <div
                  key={w.id}
                  className="w-12 h-12 rounded-pill border-2 border-noir bg-iron overflow-hidden flex items-center justify-center font-mono text-[11px] font-semibold text-leaf"
                  title={w.name}
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span aria-hidden>{initials}</span>
                  )}
                </div>
              )
            })}
          </div>
        )}

        <p className="text-[10px] tracking-widest uppercase text-leaf">
          {kicker}
        </p>
        <h3 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-tight mt-1.5">
          {title}
        </h3>
        <p className="text-sm text-chalk/80 mt-2 leading-relaxed max-w-md">
          {body}
        </p>
        <p className="text-xs tracking-widest uppercase text-leaf font-medium mt-4">
          Browse →
        </p>
      </div>
    </Link>
  )
}

/**
 * TIER 3 — narrow horizontal row card. Mirrors Bayut's TruEstimate /
 * BayutGPT rows: small illustration left, title + body right, chevron.
 */
function RowSuggestion({ s }: { s: SuggestionData }) {
  const iconBg =
    s.tone === 'signal'
      ? 'bg-signal/15 text-signal'
      : s.tone === 'wallet'
        ? 'bg-wallet/15 text-wallet'
        : s.tone === 'volt'
          ? 'bg-leaf/15 text-leaf'
          : 'bg-iron text-ash'
  return (
    <Link
      href={s.href as Parameters<typeof Link>[0]['href']}
      className="card p-4 md:p-5 flex items-center gap-4 hover:border-leaf/30 transition-colors"
    >
      <span
        className={`shrink-0 w-14 h-14 rounded-DEFAULT flex items-center justify-center ${iconBg}`}
        aria-hidden
      >
        <SuggestionIcon name={s.icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-base md:text-lg font-semibold text-chalk leading-snug">
          {s.title}
        </p>
        <p className="text-xs md:text-sm text-ash mt-1 leading-relaxed line-clamp-2">
          {s.body}
        </p>
      </div>
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-ash shrink-0"
        aria-hidden
      >
        <polyline points="9 18 15 12 9 6" />
      </svg>
    </Link>
  )
}

/**
 * Larger version of the icon set, used as the decorative accent inside
 * HeroSuggestion. ~96px so it fills the corner like Bayut's skyline
 * illustration without needing a real illustration asset.
 */
function BigSuggestionIcon({ name }: { name: SuggestionData['icon'] }) {
  return <SuggestionIcon name={name} sizePx={120} strokeWidth={1.4} />
}

function SuggestionIcon({
  name,
  sizePx = 18,
  strokeWidth = 2,
}: {
  name: SuggestionData['icon']
  sizePx?: number
  strokeWidth?: number
}) {
  const common = {
    width: sizePx,
    height: sizePx,
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
  if (name === 'alert')
    return (
      <svg {...common}>
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    )
  if (name === 'doc')
    return (
      <svg {...common}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
      </svg>
    )
  if (name === 'clock')
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    )
  if (name === 'share')
    return (
      <svg {...common}>
        <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
        <polyline points="16 6 12 2 8 6" />
        <line x1="12" y1="2" x2="12" y2="15" />
      </svg>
    )
  if (name === 'workshop')
    return (
      <svg {...common}>
        <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
      </svg>
    )
  // compass
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="10" />
      <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  )
}
