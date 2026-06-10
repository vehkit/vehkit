import { headers } from 'next/headers'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteVehicle } from '@/app/actions/vehicles'
import { snoozeReminder, completeReminder } from '@/app/actions/reminders'
import { ShareSheet } from '@/components/ShareSheet'
import { WorkshopCodeSheet } from '@/components/WorkshopCodeSheet'
import { VehicleTrustPanel } from '@/components/VehicleTrustPanel'
import { VehicleSectionNav } from '@/components/VehicleSectionNav'
import { computeUvts, deriveDocXpView } from '@/lib/uvts'
import { ScrollAwareHeader } from '@/components/ScrollAwareHeader'
import { VehicleHero } from '@/components/VehicleHero'
import { ServiceRecordRow } from '@/components/ServiceRecordRow'
import { VehicleDocumentsList } from '@/components/VehicleDocumentsList'
import { AgentCodeSheet } from '@/components/AgentCodeSheet'
import {
  reminderStatus,
  reminderLabel,
  humanizeReminderType,
  type ReminderRow,
} from '@/lib/reminders'

/**
 * Vehicle detail page — redesigned around a researched IA:
 *
 *   1. Hero + identity         glanceable, Wallet-card minimal
 *   2. Vitals strip            odometer · trust · verified · next due
 *   3. Owner quick actions     share / workshop code / edit
 *   4. "Needs attention"       ONE merged urgency strip (reminders +
 *                              doc expiries + pending confirmations);
 *                              quiet all-clear state when empty
 *   5. Sticky section nav      anchors, not tabs (content never hides)
 *   6. Two-column desktop      left: trust → documents → history
 *                              right (sticky): details + manage
 *
 * The history timeline groups by year with per-year spend so long
 * histories stay scannable.
 */
export default async function VehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ review?: string; error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const autoReviewRecordId = sp.review ?? null
  const errorMsg = sp.error
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Parallelize all reads — saves round trips.
  const [vehicleRes, recordsRes, remindersRes, documentsRes] =
    await Promise.all([
      supabase.from('vehicles').select('*').eq('id', id).single(),
      supabase
        .from('service_records')
        .select(
          '*, service_files(storage_path), workshop_reviews(id, rating, comment, created_by, quality_rating, value_rating, timeliness_rating)',
        )
        .eq('vehicle_id', id)
        .order('service_date', { ascending: false })
        .order('created_at', { ascending: false })
        .order('id', { ascending: false }),
      supabase
        .from('reminders')
        .select('*')
        .eq('vehicle_id', id)
        .eq('status', 'open')
        .order('due_date', { ascending: true, nullsFirst: false }),
      supabase
        .from('vehicle_documents')
        .select(
          `id, doc_type, label, storage_path, file_type, file_size_bytes,
           issued_date, expires_at, extracted_data, extraction_status,
           extraction_error, created_at,
           files:vehicle_document_files(id, storage_path, file_type, position)`,
        )
        .eq('vehicle_id', id)
        .is('archived_at', null)
        .order('expires_at', { ascending: true, nullsFirst: false }),
    ])

  const vehicle = vehicleRes.data
  // No row-level access (stale share link, old bookmark) → user's garage,
  // not a dead-end 404.
  if (vehicleRes.error || !vehicle) redirect('/mycars')

  const records = recordsRes.data ?? []
  const reminders = remindersRes.data ?? []
  const documents = documentsRes.data ?? []

  // Only the actual vehicle owner can confirm/retract entries.
  const isOwner = vehicle.owner_id === user.id

  const dueReminders = reminders.filter((r: ReminderRow) => {
    const s = reminderStatus(r, vehicle.current_odometer)
    return s === 'overdue' || s === 'due_soon'
  })

  // Base URL for share links
  const h = await headers()
  const host = h.get('host') ?? 'vehkit.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const baseUrl = `${proto}://${host}`

  const vehicleTitle = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`
  const vehicleSubline = [
    `${vehicle.make} ${vehicle.model}`,
    vehicle.plate_emirate && vehicle.plate_number
      ? `${vehicle.plate_emirate} · ${vehicle.plate_number}`
      : vehicle.plate_number,
  ]
    .filter(Boolean)
    .join(' · ')

  // ── Aggregates ────────────────────────────────────────────────────
  const verifiedRecords = records.filter(
    (r) => r.attestation === 'workshop',
  ).length
  const pendingRecords = records.filter((r) => {
    const ageMs = Date.now() - new Date(r.created_at).getTime()
    return (
      r.attestation === 'workshop' &&
      !r.confirmed_at &&
      !r.rejected_at &&
      ageMs < 24 * 60 * 60 * 1000
    )
  })
  const pendingCount = pendingRecords.length

  // Top workshop — folded into the history header as a single line.
  const workshopVisits: Record<string, { count: number; name: string }> = {}
  for (const r of records) {
    if (!r.workshop_id) continue
    const entry = workshopVisits[r.workshop_id] ?? {
      count: 0,
      name: r.workshop_name_freetext ?? 'Workshop',
    }
    entry.count += 1
    workshopVisits[r.workshop_id] = entry
  }
  const topWorkshop = Object.values(workshopVisits).sort(
    (a, b) => b.count - a.count,
  )[0]

  // Next due — earliest dated open reminder.
  const nextDue = reminders.find((r: ReminderRow) => !!r.due_date)
  const nextDueLabel = nextDue?.due_date
    ? new Date(nextDue.due_date).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
      })
    : null

  // Expiring / expired documents → attention strip.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiringDocs = documents
    .map((d) => {
      if (typeof d.expires_at !== 'string') return null
      const days = Math.floor(
        (new Date(d.expires_at).getTime() - today.getTime()) / 86_400_000,
      )
      if (days > 30) return null
      return { doc: d, days }
    })
    .filter(Boolean) as Array<{
    doc: (typeof documents)[number]
    days: number
  }>

  const attentionCount =
    dueReminders.length + expiringDocs.length + (pendingCount > 0 ? 1 : 0)

  // UVTS — computed once, feeds both the vitals strip and the panel.
  const uvtsResult = computeUvts(
    {
      id: vehicle.id as string,
      make: (vehicle.make as string) ?? null,
      model: (vehicle.model as string) ?? null,
      year: (vehicle.year as number) ?? null,
      vin: (vehicle.vin as string) ?? null,
      plate_number: (vehicle.plate_number as string) ?? null,
      plate_emirate: (vehicle.plate_emirate as string) ?? null,
      color: (vehicle.color as string) ?? null,
      current_odometer: (vehicle.current_odometer as number) ?? null,
      current_odometer_at: (vehicle.current_odometer_at as string) ?? null,
      created_at: vehicle.created_at as string,
    },
    documents.map((d) => ({
      doc_type: d.doc_type as string,
      expires_at: (d.expires_at as string | null) ?? null,
      created_at: d.created_at as string,
      extracted_data:
        (d.extracted_data as Record<string, unknown> | null) ?? null,
    })),
    records.map((r) => ({
      service_type: (r.service_type as string | null) ?? null,
      service_date: (r.service_date as string | null) ?? null,
      odometer: (r.odometer as number | null) ?? null,
      status: (r.status as string | null) ?? null,
    })),
  )
  const docView = uvtsResult
    ? deriveDocXpView(
        {
          id: vehicle.id as string,
          make: (vehicle.make as string) ?? null,
          model: (vehicle.model as string) ?? null,
          year: (vehicle.year as number) ?? null,
          vin: (vehicle.vin as string) ?? null,
          plate_number: (vehicle.plate_number as string) ?? null,
          plate_emirate: (vehicle.plate_emirate as string) ?? null,
          color: (vehicle.color as string) ?? null,
          current_odometer: (vehicle.current_odometer as number) ?? null,
          current_odometer_at:
            (vehicle.current_odometer_at as string) ?? null,
          created_at: vehicle.created_at as string,
        },
        documents.map((d) => ({
          doc_type: d.doc_type as string,
          expires_at: (d.expires_at as string | null) ?? null,
          created_at: d.created_at as string,
          extracted_data:
            (d.extracted_data as Record<string, unknown> | null) ?? null,
        })),
        records.map((r) => ({
          service_type: (r.service_type as string | null) ?? null,
          service_date: (r.service_date as string | null) ?? null,
          odometer: (r.odometer as number | null) ?? null,
          status: (r.status as string | null) ?? null,
        })),
        uvtsResult,
        id,
      )
    : undefined

  // History grouped by year, with per-year spend.
  const yearGroups: Array<{
    year: string
    items: typeof records
    spend: number
  }> = []
  for (const r of records) {
    const year = r.service_date
      ? String(new Date(r.service_date).getFullYear())
      : 'Undated'
    let group = yearGroups[yearGroups.length - 1]
    if (!group || group.year !== year) {
      group = { year, items: [], spend: 0 }
      yearGroups.push(group)
    }
    group.items.push(r)
    group.spend += r.cost_aed ? Number(r.cost_aed) : 0
  }

  // Hero badges — at most one status + one quality signal.
  const heroBadges: Array<{
    label: string
    tone: 'volt' | 'wallet' | 'signal' | 'iron'
  }> = []
  if (pendingCount > 0)
    heroBadges.push({ label: `${pendingCount} pending`, tone: 'wallet' })
  if (verifiedRecords >= 10)
    heroBadges.push({ label: 'Well-serviced', tone: 'volt' })
  else if (verifiedRecords >= 1)
    heroBadges.push({ label: 'Verified', tone: 'volt' })

  const ownerSinceLabel = vehicle.created_at
    ? new Date(vehicle.created_at).toLocaleDateString('en-GB', {
        month: 'short',
        year: 'numeric',
      })
    : null

  const navSections = [
    { id: 'trust', label: 'Trust' },
    { id: 'documents', label: 'Documents' },
    { id: 'history', label: 'History' },
    { id: 'details', label: 'Details' },
  ]

  return (
    <main className="min-h-[100svh] pb-32 bg-noir">
      {/* Sticky condensed header — mobile only */}
      <div className="md:hidden">
        <ScrollAwareHeader
          title={vehicleTitle}
          subtitle={vehicleSubline}
          backHref="/mycars"
          backLabel="My cars"
        />
      </div>

      {/* Desktop "← My cars" */}
      <div className="hidden md:block max-w-[1240px] mx-auto px-6 md:px-10 pt-6">
        <Link
          href="/mycars"
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← My cars
        </Link>
      </div>

      {/* HERO — edge to edge mobile, column-bound desktop */}
      <div className="md:max-w-[1240px] md:mx-auto md:mt-4 md:px-10">
        <VehicleHero
          vehicleId={id}
          currentUrl={vehicle.hero_image_url}
          badges={heroBadges}
          isOwner={isOwner}
          backHref="/mycars"
          backLabel="My cars"
        />
      </div>

      <div className="max-w-[1240px] mx-auto px-5 md:px-10">
        {/* IDENTITY — title + plate chip. Wallet-card glanceable:
            few fields here; everything else lives in Details. */}
        <section className="mt-6">
          <h1 className="text-3xl md:text-5xl font-semibold text-chalk tracking-tighter leading-tight">
            {vehicleTitle}
          </h1>
          <div className="mt-3 flex items-center gap-2.5 flex-wrap">
            <span className="text-sm text-ash">
              {[
                vehicle.year && String(vehicle.year),
                vehicle.color,
                `${vehicle.make} ${vehicle.model}`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
            {vehicle.plate_number && (
              <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-seam bg-carbon px-2.5 py-1 font-mono text-xs font-semibold tracking-wider text-chalk uppercase">
                {vehicle.plate_emirate && (
                  <span className="text-ash font-normal normal-case">
                    {vehicle.plate_emirate}
                  </span>
                )}
                {vehicle.plate_number}
              </span>
            )}
          </div>
        </section>

        {/* VITALS — the four numbers an owner actually checks. Trust
            links down to the panel. */}
        <section className="mt-6 grid grid-cols-4 divide-x divide-seam border-y border-seam">
          <Vital
            value={vehicle.current_odometer?.toLocaleString() ?? '—'}
            label="km"
          />
          <a href="#trust" className="group">
            <Vital
              value={uvtsResult ? String(uvtsResult.overallScore) : '—'}
              label="Trust XP"
              accent
            />
          </a>
          <Vital value={String(verifiedRecords)} label="Verified" />
          <Vital value={nextDueLabel ?? '—'} label="Next due" />
        </section>

        {/* OWNER QUICK ACTIONS — were buried in the footer; owners
            share and grant workshop access constantly. */}
        {isOwner && (
          <section className="mt-5 flex flex-wrap items-center gap-2">
            <ShareSheet vehicleId={id} baseUrl={baseUrl} />
            <WorkshopCodeSheet vehicleId={id} />
            <Link
              href={`/vehicles/${id}/edit`}
              className="pill-outline text-sm whitespace-nowrap"
            >
              Edit
            </Link>
          </section>
        )}

        {errorMsg && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* NEEDS ATTENTION — one merged urgency surface. Renders only
            when actionable; otherwise a quiet all-clear line. */}
        <section className="mt-8">
          {attentionCount > 0 ? (
            <>
              <SectionHeader
                title="Needs attention"
                hint={`${attentionCount} ${attentionCount === 1 ? 'item' : 'items'}`}
              />
              <div className="space-y-2">
                {pendingCount > 0 && (
                  <a
                    href="#history"
                    className="card p-4 border-l-4 border-l-wallet flex items-center justify-between gap-3 hover:bg-iron/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-xs tracking-widest uppercase text-ash">
                        Awaiting confirmation
                      </p>
                      <p className="font-medium text-chalk mt-0.5">
                        {pendingCount} workshop{' '}
                        {pendingCount === 1 ? 'entry' : 'entries'} to review
                      </p>
                    </div>
                    <span className="text-xs tracking-widest uppercase font-medium text-wallet shrink-0">
                      Review →
                    </span>
                  </a>
                )}

                {expiringDocs.map(({ doc, days }) => {
                  const expired = days < 0
                  return (
                    <Link
                      key={doc.id}
                      href={`/vehicles/${id}/documents/${doc.id}/view`}
                      className={`card p-4 border-l-4 flex items-center justify-between gap-3 hover:bg-iron/40 transition-colors ${
                        expired ? 'border-l-signal' : 'border-l-wallet'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs tracking-widest uppercase text-ash">
                          {expired ? 'Expired' : 'Expiring'}
                        </p>
                        <p className="font-medium text-chalk mt-0.5">
                          {prettyDocLabel(
                            doc.doc_type as string,
                            doc.label as string | null,
                          )}
                        </p>
                        <p
                          className={`text-sm mt-0.5 ${expired ? 'text-signal' : 'text-wallet'}`}
                        >
                          {expired
                            ? `Expired ${-days === 1 ? '1 day' : `${-days} days`} ago`
                            : days === 0
                              ? 'Expires today'
                              : `Expires in ${days === 1 ? '1 day' : `${days} days`}`}
                        </p>
                      </div>
                      <span
                        className={`text-xs tracking-widest uppercase font-medium shrink-0 ${
                          expired ? 'text-signal' : 'text-wallet'
                        }`}
                      >
                        View →
                      </span>
                    </Link>
                  )
                })}

                {dueReminders.map((r: ReminderRow) => {
                  const status = reminderStatus(r, vehicle.current_odometer)
                  const isOverdue = status === 'overdue'
                  return (
                    <div
                      key={r.id}
                      className={`card p-4 border-l-4 ${
                        isOverdue ? 'border-l-signal' : 'border-l-wallet'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs tracking-widest uppercase text-ash">
                            {isOverdue ? 'Overdue' : 'Due soon'}
                          </p>
                          <p className="font-medium text-chalk mt-0.5">
                            {humanizeReminderType(r.reminder_type)}
                          </p>
                          <p className="text-sm text-ash mt-0.5">
                            {reminderLabel(r, vehicle.current_odometer)}
                          </p>
                        </div>
                        <Link
                          href={`/vehicles/${id}/service/new`}
                          className={`text-xs tracking-widest uppercase font-medium shrink-0 ${
                            isOverdue ? 'text-signal' : 'text-wallet'
                          } hover:underline`}
                        >
                          Log →
                        </Link>
                      </div>
                      {isOwner && (
                        <div className="flex gap-3 mt-3 pt-3 border-t border-seam">
                          <form action={snoozeReminder} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="vehicle_id" value={id} />
                            <input type="hidden" name="snooze_days" value="7" />
                            <button
                              type="submit"
                              className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                            >
                              Snooze 7d
                            </button>
                          </form>
                          <form action={completeReminder} className="inline">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="vehicle_id" value={id} />
                            <button
                              type="submit"
                              className="text-xs tracking-widest uppercase text-ash hover:text-volt transition-colors"
                            >
                              Mark done
                            </button>
                          </form>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="pt-3 text-right">
                <Link
                  href={`/vehicles/${id}/reminders/new`}
                  className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                >
                  + Add custom reminder
                </Link>
              </div>
            </>
          ) : (
            (documents.length > 0 || records.length > 0) && (
              <div className="flex items-center gap-2.5 px-4 py-3 rounded-DEFAULT bg-leaf-50 border border-leaf/15">
                <span className="w-5 h-5 rounded-pill bg-leaf/15 text-leaf flex items-center justify-center shrink-0">
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </span>
                <p className="text-sm text-chalk">
                  All clear — nothing needs your attention.
                  {nextDueLabel && (
                    <span className="text-ash"> Next due {nextDueLabel}.</span>
                  )}
                </p>
              </div>
            )
          )}
        </section>

        {/* SECTION NAV — sticky anchors */}
        <div className="mt-8">
          <VehicleSectionNav sections={navSections} />
        </div>

        {/* TWO-COLUMN BODY */}
        <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] md:gap-10 md:items-start mt-8">
          {/* LEFT — trust, documents, history */}
          <div className="min-w-0">
            {/* TRUST */}
            <section id="trust" className="scroll-mt-28 md:scroll-mt-16">
              <VehicleTrustPanel
                result={uvtsResult}
                docView={docView}
                isOwner={isOwner}
              />
            </section>

            {/* DOCUMENTS */}
            <section
              id="documents"
              className="mt-10 scroll-mt-28 md:scroll-mt-16"
            >
              <SectionHeader
                title="Documents"
                hint={
                  documents.length > 0
                    ? `${documents.length} ${documents.length === 1 ? 'file' : 'files'}`
                    : 'Empty'
                }
              />
              <VehicleDocumentsList
                vehicleId={id}
                documents={documents}
                isOwner={isOwner}
              />
              {isOwner && (
                <div className="mt-3 flex items-center justify-end">
                  <AgentCodeSheet
                    vehicleId={id}
                    vehicleTitle={vehicleTitle}
                    baseUrl={baseUrl}
                    disabled={documents.length === 0}
                  />
                </div>
              )}
            </section>

            {/* SERVICE HISTORY — year-grouped timeline */}
            <section
              id="history"
              className="mt-10 scroll-mt-28 md:scroll-mt-16"
            >
              <div className="flex items-baseline justify-between gap-3 mb-1">
                <h2 className="text-base font-semibold text-chalk tracking-tight">
                  Service history
                </h2>
                <Link
                  href={`/vehicles/${id}/service/new`}
                  className="text-xs tracking-widest uppercase text-leaf font-medium hover:underline shrink-0"
                >
                  + Log service
                </Link>
              </div>
              {topWorkshop && (
                <p className="text-xs text-ash mb-4">
                  Most serviced at{' '}
                  <span className="text-chalk/90 font-medium">
                    {topWorkshop.name}
                  </span>{' '}
                  · {topWorkshop.count}{' '}
                  {topWorkshop.count === 1 ? 'visit' : 'visits'}
                </p>
              )}

              {records.length > 0 ? (
                <div className="space-y-8 mt-4">
                  {yearGroups.map((group) => (
                    <div key={group.year}>
                      <div className="flex items-baseline justify-between gap-3 mb-3">
                        <span className="font-mono text-sm font-semibold text-ash tabular-nums tracking-wide">
                          {group.year}
                        </span>
                        <span className="text-[10px] tracking-widest uppercase text-ash/70">
                          {group.items.length}{' '}
                          {group.items.length === 1 ? 'entry' : 'entries'}
                          {group.spend > 0 &&
                            ` · AED ${group.spend.toLocaleString()}`}
                        </span>
                      </div>
                      <ol className="space-y-3">
                        {group.items.map((r) => (
                          <ServiceRecordRow
                            key={r.id}
                            record={r}
                            vehicleId={id}
                            isOwner={isOwner}
                            autoOpenReview={autoReviewRecordId === r.id}
                          />
                        ))}
                      </ol>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-16 text-center card mt-4">
                  <div className="w-14 h-14 mx-auto rounded-pill border border-seam flex items-center justify-center">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-ash"
                      aria-hidden
                    >
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-chalk mt-4">
                    No services yet
                  </h3>
                  <p className="text-sm text-ash mt-1 mb-6">
                    Log your first service to start the timeline.
                  </p>
                  <Link
                    href={`/vehicles/${id}/service/new`}
                    className="text-sm tracking-wide text-volt font-medium hover:underline"
                  >
                    Add service record →
                  </Link>
                </div>
              )}
            </section>
          </div>

          {/* RIGHT — sticky reference column: details + manage */}
          <aside className="mt-10 md:mt-0 md:sticky md:top-14">
            <section id="details" className="scroll-mt-28 md:scroll-mt-16">
              <SectionHeader title="Details" />
              <DetailsTable
                vehicle={vehicle as Record<string, unknown>}
                documents={documents as Array<Record<string, unknown>>}
              />
            </section>

            {/* Manage — quiet meta + danger zone at the foot */}
            <section className="mt-10 pt-5 border-t border-seam space-y-4">
              {(vehicle.vin || ownerSinceLabel) && (
                <div className="flex items-center gap-4 text-[11px] text-ash/70 flex-wrap">
                  {vehicle.vin && (
                    <span className="font-mono">
                      VIN <span className="text-ash">{vehicle.vin}</span>
                    </span>
                  )}
                  {ownerSinceLabel && (
                    <span className="tracking-widest uppercase">
                      On Vehkit since {ownerSinceLabel}
                    </span>
                  )}
                </div>
              )}
              <div className="flex items-center justify-between">
                <a
                  href={`/vehicles/${id}/export`}
                  className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                  download
                >
                  Export CSV
                </a>
                {isOwner && (
                  <form action={deleteVehicle}>
                    <input type="hidden" name="id" value={id} />
                    <button
                      type="submit"
                      className="text-xs tracking-widest uppercase text-signal hover:underline"
                      formNoValidate
                    >
                      Delete this vehicle
                    </button>
                  </form>
                )}
              </div>
            </section>
          </aside>
        </div>
      </div>

      {/* The global "+" FAB covers Add service / reminder / doc / fuel. */}
    </main>
  )
}

function SectionHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 mb-3">
      <h2 className="text-base font-semibold text-chalk tracking-tight">
        {title}
      </h2>
      {hint && (
        <p className="text-[10px] tracking-widest uppercase text-ash">{hint}</p>
      )}
    </div>
  )
}

function Vital({
  value,
  label,
  accent = false,
}: {
  value: string
  label: string
  accent?: boolean
}) {
  return (
    <div className="text-center py-4 px-2">
      <p
        className={`font-mono text-xl md:text-2xl font-semibold tabular-nums tracking-tight leading-none ${
          accent ? 'text-leaf' : 'text-chalk'
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1.5 truncate">
        {label}
      </p>
    </div>
  )
}

// ─── DetailsTable ──────────────────────────────────────────────────
// Reference material: the original add-car form fields, plus anything
// extracted from the uploaded mulkiya, plus document expiry dates.
// Collapsible sections; first opens by default. Single-column rows —
// it now lives in the 360px desktop sidebar.
function DetailsTable({
  vehicle,
  documents,
}: {
  vehicle: Record<string, unknown>
  documents: Array<Record<string, unknown>>
}) {
  const get = (k: string) => vehicle[k] as string | number | null | undefined

  const mulkiyaDoc = documents.find((d) => d.doc_type === 'mulkiya')
  const insuranceDoc = documents.find(
    (d) => d.doc_type === 'insurance' || d.doc_type === 'insurance_policy',
  )
  // Priority: a typed mulkiya doc first (legacy uploads); otherwise the
  // most recent auto-classified bundle (doc_type='auto').
  const sourceDoc =
    mulkiyaDoc ??
    documents.find(
      (d) =>
        d.extracted_data &&
        typeof d.extracted_data === 'object' &&
        Object.keys(d.extracted_data as object).length > 0,
    )
  const extracted = (sourceDoc?.extracted_data ?? {}) as Record<
    string,
    string | number | null
  >

  const plateNumber = get('plate_number')
  const plateEmirate = get('plate_emirate')
  const plate =
    plateEmirate && plateNumber
      ? `${plateEmirate} . ${plateNumber}`
      : ((plateNumber as string) ?? null)

  const odo = get('current_odometer')
  const odoLabel = typeof odo === 'number' ? `${odo.toLocaleString()} km` : null

  const year = get('year') as number | null
  const make = get('make') as string | null
  const model = get('model') as string | null
  const vehicleLine = [year, make, model].filter(Boolean).join(' ') || null

  const mulkiyaExp =
    (mulkiyaDoc?.expires_at as string | null) ??
    (sourceDoc?.expires_at as string | null) ??
    (extracted.expires_at as string | null) ??
    null
  // Pull ONLY from the insurance fields. Do NOT fall back to the
  // parent doc's expires_at (that holds the mulkiya / generic expiry).
  const insuranceExp =
    (insuranceDoc?.expires_at as string | null) ??
    (extracted.insurance_expires_at as string | null) ??
    null
  const insuranceLabel = (insuranceDoc?.label as string | null) ?? null

  const otherExpiries = documents
    .filter(
      (d) =>
        d.doc_type !== 'mulkiya' &&
        d.doc_type !== 'insurance' &&
        d.doc_type !== 'insurance_policy' &&
        typeof d.expires_at === 'string',
    )
    .map(
      (d) =>
        [
          prettyDocLabel(d.doc_type as string, d.label as string | null),
          d.expires_at as string,
        ] as [string, string],
    )

  const aed = (n: unknown): string | null => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    return `AED ${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
  }

  type Row = [
    string,
    string | number | null,
    { mono?: boolean; date?: boolean }?,
  ]
  const sections: Array<{ heading: string; rows: Row[] }> = [
    {
      heading: 'Vehicle',
      rows: [
        ['Vehicle', vehicleLine],
        [
          'Color',
          (get('color') as string) ?? (extracted.color as string) ?? null,
        ],
        ['Body type', (extracted.body_type as string) ?? null],
        ['Category', (extracted.category as string) ?? null],
        ['Country of origin', (extracted.country_of_origin as string) ?? null],
        ['Fuel', (extracted.fuel_type as string) ?? null],
        ['Doors', (extracted.doors as number) ?? null, { mono: true }],
        ['Seats', (extracted.seats as number) ?? null, { mono: true }],
        ['Cylinders', (extracted.cylinders as number) ?? null, { mono: true }],
        [
          'Engine no.',
          (extracted.engine_number as string) ?? null,
          { mono: true },
        ],
        ['VIN', (get('vin') as string) ?? null, { mono: true }],
        [
          'Gross weight',
          extracted.gross_weight_kg ? `${extracted.gross_weight_kg} kg` : null,
          { mono: true },
        ],
        [
          'Empty weight',
          extracted.empty_weight_kg ? `${extracted.empty_weight_kg} kg` : null,
          { mono: true },
        ],
        ['Use', (extracted.use_of_vehicle as string) ?? null],
        ['Odometer', odoLabel, { mono: true }],
      ],
    },
    {
      heading: 'Registration',
      rows: [
        ['Plate', plate, { mono: true }],
        ['Plate type', (extracted.plate_type as string) ?? null],
        ['Authority', (extracted.registration_authority as string) ?? null],
        [
          'Registered on',
          (extracted.registration_date as string) ?? null,
          { mono: true },
        ],
        ['Mortgage by', (extracted.mortgage_by as string) ?? null],
        ['Mulkiya expires', mulkiyaExp, { mono: true, date: true }],
      ],
    },
    {
      heading: 'Owner',
      rows: [
        ['Name', (extracted.owner_name as string) ?? null],
        ['Nationality', (extracted.owner_nationality as string) ?? null],
        [
          'Traffic code',
          (extracted.traffic_code_no as string) ?? null,
          { mono: true },
        ],
      ],
    },
    {
      heading: 'Insurance',
      rows: [
        [
          'Insurer',
          (extracted.insurance_company as string) ?? insuranceLabel ?? null,
        ],
        [
          'Policy no.',
          (extracted.insurance_policy_number as string) ?? null,
          { mono: true },
        ],
        ['Cover type', (extracted.insurance_cover_type as string) ?? null],
        ['Cover plan', (extracted.insurance_cover_plan as string) ?? null],
        [
          'Started',
          (extracted.insurance_commencement_at as string) ?? null,
          { mono: true },
        ],
        ['Expires', insuranceExp, { mono: true, date: true }],
        ['Premium', aed(extracted.insurance_premium_aed), { mono: true }],
        [
          'Insured value',
          aed(extracted.insurance_insured_value_aed),
          { mono: true },
        ],
      ],
    },
  ]

  if (otherExpiries.length > 0) {
    sections.push({
      heading: 'Other documents',
      rows: otherExpiries.map(
        ([label, date]) =>
          [`${label} expires`, date, { mono: true, date: true }] as Row,
      ),
    })
  }

  const renderedSections = sections
    .map((s) => ({
      heading: s.heading,
      rows: s.rows.filter(([, v]) => v != null && String(v).trim() !== ''),
    }))
    .filter((s) => s.rows.length > 0)

  if (renderedSections.length === 0) return null

  return (
    <div className="mt-4 space-y-2">
      {renderedSections.map((section, sIdx) => (
        <details
          key={section.heading}
          className="group border-b border-seam/40 last:border-b-0 pb-2"
          {...(sIdx === 0 ? { open: true } : {})}
        >
          <summary className="flex items-center justify-between gap-3 cursor-pointer list-none py-2 select-none">
            <span className="text-[10px] tracking-[0.28em] uppercase text-leaf font-bold">
              {section.heading}
            </span>
            <span className="flex items-center gap-3 text-[10px] tracking-wider uppercase text-ash">
              <span className="font-mono tabular-nums">
                {section.rows.length}
              </span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-transform duration-200 group-open:rotate-180 text-ash"
                aria-hidden
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </summary>
          <dl className="mt-1 mb-2">
            {section.rows.map(([label, value, opts]) => (
              <div
                key={label}
                className="flex items-center justify-between gap-4 py-2.5 border-b border-seam/50 last:border-b-0"
              >
                <dt className="text-xs tracking-widest uppercase text-ash">
                  {label}
                </dt>
                <dd
                  className={`text-sm text-chalk text-right truncate ${opts?.mono ? 'font-mono tabular-nums' : ''}`}
                >
                  {opts?.date && typeof value === 'string' && (
                    <RelativeExpiry iso={value} />
                  )}
                  {value as React.ReactNode}
                </dd>
              </div>
            ))}
          </dl>
        </details>
      ))}
    </div>
  )
}

/**
 * Subtle "· in 7m 27d" / "· 5m ago" suffix appended to a date cell.
 * Past dates render in signal-red, within 30 days in wallet-amber,
 * further out in faded ash.
 */
function RelativeExpiry({ iso }: { iso: string }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const target = new Date(iso + 'T00:00:00Z').getTime()
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const diffMs = target - today.getTime()
  const days = Math.round(diffMs / 86_400_000)

  let label: string
  let tone: 'past' | 'soon' | 'far'

  if (days < 0) {
    const abs = -days
    if (abs >= 365) {
      const y = Math.floor(abs / 365)
      label = `${y}y ago`
    } else if (abs >= 30) {
      const m = Math.floor(abs / 30)
      const d = abs % 30
      label = d > 0 ? `${m}m ${d}d ago` : `${m}m ago`
    } else if (abs === 1) {
      label = '1d ago'
    } else {
      label = `${abs}d ago`
    }
    tone = 'past'
  } else if (days === 0) {
    label = 'today'
    tone = 'soon'
  } else if (days <= 30) {
    label = days === 1 ? 'in 1d' : `in ${days}d`
    tone = 'soon'
  } else if (days >= 365) {
    const y = Math.floor(days / 365)
    const remDays = days % 365
    const m = Math.floor(remDays / 30)
    label = m > 0 ? `in ${y}y ${m}m` : `in ${y}y`
    tone = 'far'
  } else {
    const m = Math.floor(days / 30)
    const d = days % 30
    label = d > 0 ? `in ${m}m ${d}d` : `in ${m}m`
    tone = 'far'
  }

  const cls =
    tone === 'past'
      ? 'text-signal'
      : tone === 'soon'
        ? 'text-wallet'
        : 'text-ash/60'

  return (
    <span
      className={`mr-2 text-[10px] tracking-wider uppercase font-medium ${cls}`}
    >
      {label} ·
    </span>
  )
}

function prettyDocLabel(docType: string, customLabel: string | null): string {
  if (customLabel && customLabel.trim().length > 0) return customLabel
  switch (docType) {
    case 'auto':
      return 'Document'
    case 'mulkiya':
      return 'Mulkiya'
    case 'insurance':
    case 'insurance_policy':
      return 'Insurance'
    case 'driving_licence':
      return 'Driving licence'
    case 'noc':
      return 'NOC'
    case 'pollution_test':
      return 'Pollution test'
    case 'service_history':
      return 'Service history'
    case 'warranty':
      return 'Warranty'
    case 'attestation':
      return 'Attestation'
    case 'rsa':
      return 'RSA'
    default:
      return (
        docType.charAt(0).toUpperCase() + docType.slice(1).replace(/_/g, ' ')
      )
  }
}
