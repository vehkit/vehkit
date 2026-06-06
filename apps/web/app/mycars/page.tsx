import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { relativeDate } from '@/lib/format'

/**
 * /mycars v4. Dead simple Excel-style table.
 *
 * Visual / photo cards (v1, v2) and the service-picker hero (v3)
 * were not loved. Users said the layout was sophisticated when what
 * they actually wanted was rich data they could act on instantly.
 *
 * v4 strips back to a flat table. Each row is a vehicle. Columns
 * carry the actionable values the owner cares about:
 *
 *   Car            nickname or year + make + model
 *   Plate          emirate code + plate number
 *   KM             current odometer
 *   Mulkiya        days to expiry (or expired N d ago)
 *   Insurance      days to expiry, separate column
 *   Last service   relative date + workshop name
 *   Pending        unread workshop-attested entries to confirm
 *   Status         one-word current state
 *
 * Whole row clickable. Tap = open detail. Excel rhythm. No photos
 * on this surface (photos stay on the per-vehicle detail page).
 *
 * Above the table: single greeting + single primary CTA ("Find a
 * garage"). Below the table: trusted garages quiet rail (only if
 * any) and insights footer.
 */

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
}

type ServiceRow = {
  vehicle_id: string
  service_date: string | null
  workshop_name_freetext: string | null
  workshop_id: string | null
  attestation: string | null
  confirmed_at: string | null
  rejected_at: string | null
}

type DocRow = {
  vehicle_id: string
  doc_type: string
  expires_at: string | null
}

type WorkshopRow = {
  id: string
  name: string
  slug: string
  hero_image_url: string | null
  emirate: string | null
  verification_tier: string | null
}

export default async function MyCarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [vehiclesRes, serviceRes, docsRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    supabase
      .from('service_records')
      .select(
        'vehicle_id, service_date, workshop_name_freetext, workshop_id, attestation, confirmed_at, rejected_at',
      )
      .is('rejected_at', null)
      .order('service_date', { ascending: false }),
    supabase
      .from('vehicle_documents')
      .select('vehicle_id, doc_type, expires_at')
      .not('expires_at', 'is', null),
  ])

  const vehicles = (vehiclesRes.data ?? []) as Vehicle[]
  const services = (serviceRes.data ?? []) as ServiceRow[]
  const docs = (docsRes.data ?? []) as DocRow[]

  // Per-vehicle aggregates. Single pass to keep this cheap.
  const pendingByVehicle = new Map<string, number>()
  const lastServiceByVehicle = new Map<
    string,
    { date: string; workshop: string | null }
  >()
  for (const s of services) {
    if (
      s.attestation === 'workshop' &&
      s.confirmed_at === null &&
      s.service_date &&
      new Date(s.service_date).toISOString() >= oneDayAgo
    ) {
      pendingByVehicle.set(
        s.vehicle_id,
        (pendingByVehicle.get(s.vehicle_id) ?? 0) + 1,
      )
    }
    if (!lastServiceByVehicle.has(s.vehicle_id) && s.service_date) {
      lastServiceByVehicle.set(s.vehicle_id, {
        date: s.service_date,
        workshop: s.workshop_name_freetext,
      })
    }
  }

  // Per-vehicle doc expiry pulled by type. Mulkiya and insurance are
  // the two we surface as their own columns; other docs go on the
  // detail page.
  const mulkiyaByVehicle = new Map<string, string>()
  const insuranceByVehicle = new Map<string, string>()
  for (const d of docs) {
    if (!d.expires_at) continue
    if (d.doc_type === 'mulkiya' && !mulkiyaByVehicle.has(d.vehicle_id)) {
      mulkiyaByVehicle.set(d.vehicle_id, d.expires_at)
    } else if (
      (d.doc_type === 'insurance' || d.doc_type === 'insurance_policy') &&
      !insuranceByVehicle.has(d.vehicle_id)
    ) {
      insuranceByVehicle.set(d.vehicle_id, d.expires_at)
    }
  }

  // Trusted garages. Same query as v3.
  const visitsByWorkshop = new Map<
    string,
    { count: number; lastDate: string | null }
  >()
  for (const s of services) {
    if (!s.workshop_id) continue
    const cur = visitsByWorkshop.get(s.workshop_id) ?? {
      count: 0,
      lastDate: null,
    }
    cur.count += 1
    if (!cur.lastDate || (s.service_date && s.service_date > cur.lastDate)) {
      cur.lastDate = s.service_date
    }
    visitsByWorkshop.set(s.workshop_id, cur)
  }
  let trusted: Array<{
    id: string
    name: string
    slug: string
    hero: string | null
    emirate: string | null
    tier: string | null
    count: number
    lastDate: string | null
  }> = []
  if (visitsByWorkshop.size > 0) {
    const { data: workshopRows } = await supabase
      .from('workshops')
      .select('id, name, slug, hero_image_url, emirate, verification_tier')
      .in('id', Array.from(visitsByWorkshop.keys()))
    trusted = ((workshopRows ?? []) as WorkshopRow[])
      .map((w) => {
        const s = visitsByWorkshop.get(w.id)!
        return {
          id: w.id,
          name: w.name,
          slug: w.slug,
          hero: w.hero_image_url,
          emirate: w.emirate,
          tier: w.verification_tier,
          count: s.count,
          lastDate: s.lastDate,
        }
      })
      .sort((a, b) => b.count - a.count)
  }

  const emailLocal = (user.email ?? 'there').split('@')[0] ?? 'there'
  const firstName = emailLocal.split('.')[0] ?? emailLocal
  const greetingName =
    firstName.length > 0
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
      : 'there'

  // Empty state.
  if (vehicles.length === 0) {
    return (
      <main className="min-h-[100svh] pb-24 md:pb-16">
        <div className="max-w-[760px] mx-auto px-6 md:px-10 pt-10 md:pt-16">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tighter leading-[1.05]">
            Hi {greetingName}.
          </h1>
          <p className="text-base text-mute mt-4 max-w-md leading-relaxed">
            Find a verified UAE garage in two taps. Or add your car to keep
            its full service history.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Link
              href="/vehicles/new"
              className="inline-flex items-center h-12 px-6 rounded-pill bg-leaf text-white font-bold hover:bg-leaf-dk transition-colors"
            >
              Add your car
            </Link>
            <Link
              href="/workshops"
              className="inline-flex items-center h-12 px-6 rounded-pill border border-seam text-ink font-semibold hover:border-leaf/40 hover:text-leaf-dk transition-colors"
            >
              Browse garages
            </Link>
            <form action={createSampleVehicle}>
              <button
                type="submit"
                className="text-sm text-mute hover:text-ink underline-offset-4 hover:underline"
              >
                or try with a sample car
              </button>
            </form>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-[100svh] pb-24 md:pb-16">
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 pt-8 md:pt-12">
        {/* greeting + primary action */}
        <header className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter leading-tight">
              Hi {greetingName}.
            </h1>
            <p className="text-sm text-mute mt-1">
              {vehicles.length} car{vehicles.length === 1 ? '' : 's'}
              {trusted.length > 0 &&
                ` . ${trusted.length} trusted garage${trusted.length === 1 ? '' : 's'}`}
            </p>
          </div>
          <Link
            href="/workshops"
            className="inline-flex items-center h-11 px-5 rounded-pill bg-leaf text-white font-bold whitespace-nowrap hover:bg-leaf-dk transition-colors"
          >
            Find a garage
          </Link>
        </header>

        {/* the table */}
        <section className="mt-8">
          <p className="text-[11px] tracking-[0.28em] uppercase text-leaf font-bold mb-3">
            Your cars
          </p>
          <div className="border border-seam rounded-DEFAULT overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] tracking-widest uppercase text-mute border-b border-seam bg-iron/30">
                  <Th>Car</Th>
                  <Th>Plate</Th>
                  <Th align="right">KM</Th>
                  <Th>Mulkiya</Th>
                  <Th>Insurance</Th>
                  <Th>Last service</Th>
                  <Th align="right">Pending</Th>
                  <Th>Status</Th>
                  <Th>{''}</Th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => {
                  const isShared = v.owner_id !== user.id
                  const pending = pendingByVehicle.get(v.id) ?? 0
                  const lastService = lastServiceByVehicle.get(v.id) ?? null
                  const mulkiyaExp = mulkiyaByVehicle.get(v.id) ?? null
                  const insuranceExp = insuranceByVehicle.get(v.id) ?? null

                  const title =
                    v.nickname ??
                    `${v.year ? v.year + ' ' : ''}${v.make} ${v.model}`
                  const sub = v.nickname
                    ? `${v.year ? v.year + ' ' : ''}${v.make} ${v.model}`
                    : null
                  const plate =
                    v.plate_emirate && v.plate_number
                      ? `${v.plate_emirate} . ${v.plate_number}`
                      : v.plate_number ?? '—'

                  const status = computeStatus({
                    pending,
                    mulkiyaExp,
                    insuranceExp,
                  })

                  return (
                    <tr
                      key={v.id}
                      className="border-b border-seam last:border-0 hover:bg-leaf/5 transition-colors"
                    >
                      <Td>
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="block min-w-[180px]"
                        >
                          <p className="font-semibold text-ink truncate">
                            {title}
                            {isShared && (
                              <span className="ml-2 text-[9px] tracking-widest uppercase text-mute bg-iron px-1.5 py-0.5 rounded-pill align-middle">
                                Shared
                              </span>
                            )}
                          </p>
                          {sub && (
                            <p className="text-xs text-mute truncate">{sub}</p>
                          )}
                        </Link>
                      </Td>
                      <Td mono>{plate}</Td>
                      <Td align="right" mono>
                        {v.current_odometer != null
                          ? v.current_odometer.toLocaleString()
                          : '—'}
                      </Td>
                      <Td>
                        <DaysCell iso={mulkiyaExp} />
                      </Td>
                      <Td>
                        <DaysCell iso={insuranceExp} />
                      </Td>
                      <Td>
                        {lastService ? (
                          <span>
                            <span className="text-ink">
                              {relativeDate(lastService.date)}
                            </span>
                            {lastService.workshop && (
                              <span className="text-mute">
                                {' '}
                                . {lastService.workshop}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-mute">—</span>
                        )}
                      </Td>
                      <Td align="right" mono>
                        {pending > 0 ? (
                          <span className="text-wallet font-semibold">
                            {pending}
                          </span>
                        ) : (
                          <span className="text-mute">0</span>
                        )}
                      </Td>
                      <Td>
                        <StatusPill status={status} />
                      </Td>
                      <Td>
                        <Link
                          href={`/vehicles/${v.id}`}
                          className="text-xs font-semibold text-leaf hover:text-leaf-dk"
                        >
                          Open
                        </Link>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3">
            <Link
              href="/vehicles/new"
              className="text-sm font-semibold text-leaf hover:text-leaf-dk"
            >
              + Add another car
            </Link>
          </div>
        </section>

        {/* trusted garages */}
        {trusted.length > 0 && (
          <section className="mt-12">
            <div className="flex items-end justify-between gap-3">
              <p className="text-[11px] tracking-[0.28em] uppercase text-leaf font-bold">
                Trusted garages
              </p>
              <Link
                href="/workshops"
                className="text-xs font-semibold text-leaf hover:text-leaf-dk"
              >
                Browse all
              </Link>
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto -mx-6 md:-mx-10 px-6 md:px-10 pb-2 snap-x snap-mandatory">
              {trusted.map((g) => (
                <Link
                  key={g.id}
                  href={`/w/${g.slug}/book`}
                  className="snap-start shrink-0 w-[180px] rounded-DEFAULT border border-seam bg-carbon hover:border-leaf/40 transition-colors overflow-hidden group"
                >
                  <div className="relative w-full aspect-[4/3] bg-iron overflow-hidden">
                    {g.hero ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.hero}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-mute text-3xl font-bold">
                        {g.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-semibold text-ink line-clamp-1">
                      {g.name}
                    </p>
                    <p className="text-[11px] text-mute mt-0.5 line-clamp-1">
                      {g.count} visit{g.count === 1 ? '' : 's'}
                      {g.lastDate && ` . ${relativeDate(g.lastDate)}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* quiet footer */}
        <div className="mt-12 pt-5 border-t border-seam flex items-center justify-between flex-wrap gap-3">
          <p className="text-xs tracking-widest uppercase text-mute">
            Want the numbers?
          </p>
          <Link
            href="/insights"
            className="text-sm font-semibold text-leaf hover:text-leaf-dk"
          >
            Garage insights
          </Link>
        </div>
      </div>
    </main>
  )
}

// table helpers

function Th({
  children,
  align = 'left',
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
}) {
  return (
    <th
      className={`px-4 py-3 text-${align} font-bold whitespace-nowrap`}
    >
      {children}
    </th>
  )
}

function Td({
  children,
  align = 'left',
  mono,
}: {
  children: React.ReactNode
  align?: 'left' | 'right'
  mono?: boolean
}) {
  return (
    <td
      className={`px-4 py-3 text-${align} whitespace-nowrap ${mono ? 'font-mono tabular-nums' : ''}`}
    >
      {children}
    </td>
  )
}

type Status = 'ok' | 'pending' | 'due_soon' | 'overdue'

function computeStatus(opts: {
  pending: number
  mulkiyaExp: string | null
  insuranceExp: string | null
}): Status {
  if (opts.pending > 0) return 'pending'
  const now = Date.now()
  const dayMs = 1000 * 60 * 60 * 24
  const dates = [opts.mulkiyaExp, opts.insuranceExp].filter(Boolean) as string[]
  for (const iso of dates) {
    const daysAway = Math.floor((new Date(iso).getTime() - now) / dayMs)
    if (daysAway < 0) return 'overdue'
    if (daysAway <= 14) return 'due_soon'
  }
  return 'ok'
}

function StatusPill({ status }: { status: Status }) {
  const map: Record<Status, { label: string; tone: string }> = {
    ok: { label: 'OK', tone: 'bg-leaf/15 text-leaf-dk' },
    pending: { label: 'Review', tone: 'bg-wallet/20 text-wallet' },
    due_soon: { label: 'Due soon', tone: 'bg-wallet/20 text-wallet' },
    overdue: { label: 'Overdue', tone: 'bg-signal/20 text-signal' },
  }
  const cfg = map[status]
  return (
    <span
      className={`text-[10px] tracking-widest uppercase px-2 py-1 rounded-pill font-semibold whitespace-nowrap ${cfg.tone}`}
    >
      {cfg.label}
    </span>
  )
}

function DaysCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-mute">—</span>
  const dayMs = 1000 * 60 * 60 * 24
  const days = Math.floor((new Date(iso).getTime() - Date.now()) / dayMs)
  if (days < 0) {
    return <span className="text-signal">{-days}d overdue</span>
  }
  if (days === 0) {
    return <span className="text-signal">today</span>
  }
  if (days <= 14) {
    return <span className="text-signal">{days}d</span>
  }
  if (days <= 30) {
    return <span className="text-wallet">{days}d</span>
  }
  return <span className="text-mute">{days}d</span>
}
