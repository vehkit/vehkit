import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { relativeDate } from '@/lib/format'
import { PhotoChoiceUploader } from '@/components/PhotoChoiceUploader'

/**
 * /mycars — the post-login home for car owners.
 *
 * Designed around the *loyalty* premise of the product, not the data:
 *
 *   1. Welcome rail  — friendly greeting + "book a service" (the
 *                      primary money action of the app).
 *   2. Your cars     — visual hero card per vehicle. Photo first,
 *                      data second. Status pill calls out what needs
 *                      attention. Quick actions sit on the card.
 *   3. Trusted       — horizontal rail of garages this user has
 *      garages        actually visited. Loyalty currency. "Book
 *                      again" is the easiest path on the page.
 *   4. Coming up     — date-sorted timeline of expiries and to-dos.
 *                      No surprises, no notifications-only access.
 *   5. Recent        — last few services across all cars. Shows the
 *      activity       passport accumulating value.
 *
 * Everything is server-rendered. The only client-side bits are the
 * photo uploader (camera/gallery/files chooser) and any inline forms.
 *
 * Power-user analytics still live at `/insights` and are linked at
 * the bottom of the page.
 */

type Vehicle = {
  id: string
  make: string
  model: string
  year: number | null
  color: string | null
  nickname: string | null
  plate_number: string | null
  plate_emirate: string | null
  vin: string | null
  current_odometer: number | null
  hero_image_url: string | null
  owner_id: string
}

type ServiceRow = {
  id: string
  vehicle_id: string
  service_date: string | null
  workshop_name_freetext: string | null
  workshop_id: string | null
  cost_aed: number | null
  attestation: string | null
  confirmed_at: string | null
  rejected_at: string | null
  notes: string | null
}

type DocRow = {
  vehicle_id: string
  doc_type: string
  label: string | null
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

type TrustedGarage = {
  id: string
  name: string
  slug: string
  hero: string | null
  emirate: string | null
  tier: string | null
  visits: number
  lastVisit: string | null
}

type Upcoming = {
  vehicleId: string
  vehicleTitle: string
  kind: 'doc' | 'service'
  label: string
  dueAt: string
  daysAway: number
}

export default async function MyCarsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const ninetyDaysOut = new Date(
    Date.now() + 90 * 24 * 60 * 60 * 1000,
  ).toISOString()

  const [vehiclesRes, serviceRes, docsRes, pendingRes] = await Promise.all([
    supabase.from('vehicles').select('*').order('created_at', { ascending: false }),
    // All service rows (we'll partition into pending / history / trusted in
    // the same JS pass — keeps round-trips low).
    supabase
      .from('service_records')
      .select(
        'id, vehicle_id, service_date, workshop_name_freetext, workshop_id, cost_aed, attestation, confirmed_at, rejected_at, notes',
      )
      .is('rejected_at', null)
      .order('service_date', { ascending: false }),
    // Documents with an expiry in the next 90 days — feeds the "Coming up"
    // panel. Cap at 30 rows so this query stays cheap.
    supabase
      .from('vehicle_documents')
      .select('vehicle_id, doc_type, label, expires_at')
      .not('expires_at', 'is', null)
      .lte('expires_at', ninetyDaysOut.split('T')[0])
      .order('expires_at', { ascending: true })
      .limit(30),
    supabase
      .from('service_records')
      .select('vehicle_id')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo)
      .is('confirmed_at', null)
      .is('rejected_at', null),
  ])

  const vehicles = (vehiclesRes.data ?? []) as Vehicle[]
  const services = (serviceRes.data ?? []) as ServiceRow[]
  const docs = (docsRes.data ?? []) as DocRow[]
  const pending = pendingRes.data ?? []

  // ── trusted garages ──────────────────────────────────────────────
  const visitsByWorkshop = new Map<
    string,
    { visits: number; lastVisit: string | null }
  >()
  for (const s of services) {
    if (!s.workshop_id) continue
    const cur = visitsByWorkshop.get(s.workshop_id) ?? {
      visits: 0,
      lastVisit: null,
    }
    cur.visits += 1
    if (!cur.lastVisit || (s.service_date && s.service_date > cur.lastVisit)) {
      cur.lastVisit = s.service_date
    }
    visitsByWorkshop.set(s.workshop_id, cur)
  }

  let trusted: TrustedGarage[] = []
  if (visitsByWorkshop.size > 0) {
    const ids = Array.from(visitsByWorkshop.keys())
    const { data: workshopRows } = await supabase
      .from('workshops')
      .select('id, name, slug, hero_image_url, emirate, verification_tier')
      .in('id', ids)
    const ws = (workshopRows ?? []) as WorkshopRow[]
    trusted = ws
      .map((w) => {
        const stats = visitsByWorkshop.get(w.id)!
        return {
          id: w.id,
          name: w.name,
          slug: w.slug,
          hero: w.hero_image_url,
          emirate: w.emirate,
          tier: w.verification_tier,
          visits: stats.visits,
          lastVisit: stats.lastVisit,
        }
      })
      .sort((a, b) => b.visits - a.visits)
  }

  // ── pending workshop entries ─────────────────────────────────────
  const pendingByVehicle = new Map<string, number>()
  for (const p of pending) {
    pendingByVehicle.set(p.vehicle_id, (pendingByVehicle.get(p.vehicle_id) ?? 0) + 1)
  }

  // ── per-vehicle service summary (last service line on card) ──────
  const summaryByVehicle = new Map<
    string,
    {
      serviceCount: number
      lastServiceDate: string | null
      lastWorkshop: string | null
    }
  >()
  for (const row of services) {
    const vid = row.vehicle_id
    const existing = summaryByVehicle.get(vid)
    if (!existing) {
      summaryByVehicle.set(vid, {
        serviceCount: 1,
        lastServiceDate: row.service_date,
        lastWorkshop: row.workshop_name_freetext,
      })
    } else {
      existing.serviceCount += 1
    }
  }

  // ── upcoming items (doc expiries within 90d) ─────────────────────
  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]))
  const upcoming: Upcoming[] = []
  const now = new Date()
  for (const d of docs) {
    if (!d.expires_at) continue
    const veh = vehiclesById.get(d.vehicle_id)
    if (!veh) continue
    const due = new Date(d.expires_at)
    const days = Math.floor(
      (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    )
    upcoming.push({
      vehicleId: d.vehicle_id,
      vehicleTitle:
        veh.nickname ?? `${veh.make} ${veh.model}${veh.year ? ' ' + veh.year : ''}`,
      kind: 'doc',
      label: prettyDocType(d.doc_type),
      dueAt: d.expires_at,
      daysAway: days,
    })
  }
  upcoming.sort((a, b) => a.daysAway - b.daysAway)

  // ── recent activity (last 5 confirmed service rows) ──────────────
  const recent = services
    .filter((s) => s.confirmed_at || s.attestation === 'owner')
    .slice(0, 5)

  // user.email is optional on Supabase users; tolerate undefined at each step.
  const emailLocal = (user.email ?? 'there').split('@')[0] ?? 'there'
  const firstName = emailLocal.split('.')[0] ?? emailLocal
  const greetingName =
    firstName.length > 0
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
      : 'there'

  // ── empty state ──────────────────────────────────────────────────
  if (vehicles.length === 0) {
    return (
      <main className="min-h-[100svh] pb-24 md:pb-12">
        <div className="max-w-[760px] mx-auto px-6 md:px-10 pt-10 md:pt-16">
          <p className="text-xs tracking-[0.32em] uppercase text-leaf font-bold">
            Welcome to Vehkit
          </p>
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tighter leading-[1.05] mt-4">
            Hi {greetingName}. Let&rsquo;s start with{' '}
            <span className="italic font-light">your car.</span>
          </h1>
          <p className="text-base text-mute mt-5 max-w-md leading-relaxed">
            Two minutes to add one. After that, every garage you visit, every
            document you upload, and every reminder is in one place.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Link
              href="/vehicles/new"
              className="inline-flex items-center h-12 px-6 rounded-pill bg-leaf text-white font-bold hover:bg-leaf-dk transition-colors"
            >
              Add your car &rarr;
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
      {/* ── welcome + primary action ── */}
      <header className="px-6 md:px-10 pt-8 md:pt-12 max-w-[1240px] mx-auto">
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div className="min-w-0">
            <p className="text-xs tracking-[0.28em] uppercase text-leaf font-bold">
              Your garage
            </p>
            <h1 className="text-3xl md:text-5xl font-semibold tracking-tighter leading-[1.05] mt-2">
              Hi {greetingName}.
            </h1>
            <p className="text-sm md:text-base text-mute mt-2">
              {vehicles.length} car{vehicles.length === 1 ? '' : 's'}
              {trusted.length > 0 && ` · ${trusted.length} trusted garage${trusted.length === 1 ? '' : 's'}`}
              {upcoming.length > 0 && ` · ${upcoming.length} coming up`}
            </p>
          </div>
          <Link
            href="/workshops"
            className="inline-flex items-center h-12 px-5 rounded-pill bg-leaf text-white font-bold whitespace-nowrap hover:bg-leaf-dk transition-colors"
          >
            Book a service &rarr;
          </Link>
        </div>
      </header>

      {/* ── your cars ── */}
      <section className="px-6 md:px-10 pt-8 md:pt-12 max-w-[1240px] mx-auto">
        <SectionLabel>Your cars</SectionLabel>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {vehicles.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              isShared={v.owner_id !== user.id}
              pending={pendingByVehicle.get(v.id) ?? 0}
              summary={summaryByVehicle.get(v.id) ?? null}
              upcoming={upcoming.filter((u) => u.vehicleId === v.id)}
            />
          ))}
          <Link
            href="/vehicles/new"
            className="rounded-DEFAULT border border-dashed border-seam hover:border-leaf/40 hover:bg-leaf/5 transition-colors flex flex-col items-center justify-center text-center min-h-[200px] py-8"
          >
            <span className="w-12 h-12 rounded-pill bg-leaf/10 text-leaf flex items-center justify-center text-2xl font-bold">
              +
            </span>
            <p className="text-sm font-semibold text-ink mt-3">Add another car</p>
            <p className="text-xs text-mute mt-1">Two minutes. All it takes.</p>
          </Link>
        </div>
      </section>

      {/* ── trusted garages (loyalty) ── */}
      {trusted.length > 0 && (
        <section className="pt-12 md:pt-16">
          <div className="px-6 md:px-10 max-w-[1240px] mx-auto">
            <div className="flex items-end justify-between gap-3 flex-wrap">
              <div>
                <SectionLabel>Trusted garages</SectionLabel>
                <p className="text-sm text-mute mt-2 max-w-md">
                  Garages you&rsquo;ve used before. Quicker to book again — they
                  already know your car.
                </p>
              </div>
              <Link
                href="/workshops"
                className="text-sm font-semibold text-leaf hover:text-leaf-dk"
              >
                Browse all &rarr;
              </Link>
            </div>
            <div className="mt-5 flex gap-4 overflow-x-auto -mx-6 md:-mx-10 px-6 md:px-10 pb-2 snap-x snap-mandatory">
              {trusted.map((g) => (
                <TrustedGarageTile key={g.id} garage={g} />
              ))}
              <Link
                href="/workshops"
                className="snap-start shrink-0 w-[200px] rounded-DEFAULT border border-dashed border-seam hover:border-leaf/40 hover:bg-leaf/5 transition-colors flex flex-col items-center justify-center text-center min-h-[230px]"
              >
                <span className="w-10 h-10 rounded-pill bg-leaf/10 text-leaf flex items-center justify-center text-xl font-bold">
                  +
                </span>
                <p className="text-sm font-semibold text-ink mt-3 px-4">
                  Find more
                </p>
                <p className="text-[11px] text-mute mt-1 px-4">
                  Verified garages near you
                </p>
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── coming up + recent activity (two-column on lg) ── */}
      {(upcoming.length > 0 || recent.length > 0) && (
        <section className="px-6 md:px-10 max-w-[1240px] mx-auto pt-12 md:pt-16 grid lg:grid-cols-2 gap-6 lg:gap-10">
          {upcoming.length > 0 && (
            <div>
              <SectionLabel>Coming up</SectionLabel>
              <ul className="mt-4 divide-y divide-seam border-y border-seam">
                {upcoming.slice(0, 8).map((u, i) => (
                  <UpcomingRow key={i} item={u} />
                ))}
              </ul>
              {upcoming.length > 8 && (
                <p className="text-xs text-mute mt-3">
                  And {upcoming.length - 8} more later. We&rsquo;ll ping you
                  before each one.
                </p>
              )}
            </div>
          )}

          {recent.length > 0 && (
            <div>
              <SectionLabel>Recent activity</SectionLabel>
              <ul className="mt-4 divide-y divide-seam border-y border-seam">
                {recent.map((s) => {
                  const veh = vehiclesById.get(s.vehicle_id)
                  return <ActivityRow key={s.id} row={s} vehicle={veh ?? null} />
                })}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* ── escape hatch to /insights ── */}
      {services.length > 0 && (
        <section className="px-6 md:px-10 max-w-[1240px] mx-auto pt-12 md:pt-16">
          <div className="border-t border-seam pt-6 flex items-center justify-between flex-wrap gap-3">
            <p className="text-xs tracking-widest uppercase text-mute">
              Want the numbers?
            </p>
            <Link
              href="/insights"
              className="text-sm font-semibold text-leaf hover:text-leaf-dk inline-flex items-center gap-1.5"
            >
              Garage insights &rarr;
            </Link>
          </div>
        </section>
      )}
    </main>
  )
}

// ─── ui pieces ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] tracking-[0.28em] uppercase text-leaf font-bold">
      {children}
    </p>
  )
}

function VehicleCard({
  vehicle,
  isShared,
  pending,
  summary,
  upcoming,
}: {
  vehicle: Vehicle
  isShared: boolean
  pending: number
  summary:
    | { serviceCount: number; lastServiceDate: string | null; lastWorkshop: string | null }
    | null
  upcoming: Upcoming[]
}) {
  const title =
    vehicle.nickname ?? `${vehicle.year ? vehicle.year + ' ' : ''}${vehicle.make} ${vehicle.model}`
  const sub = vehicle.nickname
    ? [vehicle.year, vehicle.make, vehicle.model].filter(Boolean).join(' ')
    : [vehicle.color].filter(Boolean).join('')
  const plate =
    vehicle.plate_emirate && vehicle.plate_number
      ? `${vehicle.plate_emirate} · ${vehicle.plate_number}`
      : vehicle.plate_number ?? null
  const nextUpcoming = upcoming[0]

  // Status pill — picks the loudest signal in priority order:
  //   pending workshop entries > document due soon > all good
  let status: { label: string; tone: 'leaf' | 'wallet' | 'signal' }
  if (pending > 0) {
    status = {
      label: `${pending} pending review`,
      tone: 'wallet',
    }
  } else if (nextUpcoming && nextUpcoming.daysAway <= 30) {
    status = {
      label:
        nextUpcoming.daysAway < 0
          ? `${nextUpcoming.label} expired`
          : nextUpcoming.daysAway === 0
            ? `${nextUpcoming.label} due today`
            : `${nextUpcoming.label} in ${nextUpcoming.daysAway}d`,
      tone: nextUpcoming.daysAway < 7 ? 'signal' : 'wallet',
    }
  } else {
    status = { label: 'All good', tone: 'leaf' }
  }

  return (
    <article className="rounded-DEFAULT border border-seam bg-carbon overflow-hidden flex flex-col">
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="relative block aspect-[16/10] bg-iron overflow-hidden group"
      >
        {vehicle.hero_image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.hero_image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-iron via-carbon to-iron text-mute">
            <svg
              width="44"
              height="44"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 13l1.66-4.97A2 2 0 016.55 6.5h10.9a2 2 0 011.89 1.53L21 13M5 13h14M7 17h.01M17 17h.01M5 13v4a1 1 0 001 1h12a1 1 0 001-1v-4"
              />
            </svg>
            <p className="text-[11px] uppercase tracking-widest mt-2">
              Add a photo below
            </p>
          </div>
        )}

        {/* status pill (top-left) */}
        <span
          className={`absolute top-3 left-3 text-[10px] tracking-widest uppercase px-2.5 py-1 rounded-pill font-semibold shadow-sm ${
            status.tone === 'leaf'
              ? 'bg-leaf text-white'
              : status.tone === 'wallet'
                ? 'bg-wallet text-noir'
                : 'bg-signal text-white'
          }`}
        >
          {status.label}
        </span>

        {/* shared corner */}
        {isShared && (
          <span className="absolute top-3 right-3 text-[10px] tracking-widest uppercase bg-noir/65 backdrop-blur text-chalk px-2 py-1 rounded-pill font-medium">
            Shared
          </span>
        )}

        {/* photo controls overlay if a hero already exists */}
        {vehicle.hero_image_url && (
          <div className="absolute bottom-3 right-3 z-10" onClick={(e) => e.preventDefault()}>
            <PhotoChoiceUploader
              vehicleId={vehicle.id}
              hasPhoto
              size="sm"
            />
          </div>
        )}
      </Link>

      {/* photo uploader if no hero exists yet */}
      {!vehicle.hero_image_url && (
        <div className="px-5 pt-5">
          <PhotoChoiceUploader vehicleId={vehicle.id} hasPhoto={false} size="lg" />
        </div>
      )}

      <div className="p-5 flex flex-col gap-4 flex-1">
        <div>
          <Link
            href={`/vehicles/${vehicle.id}`}
            className="block group"
          >
            <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-ink leading-tight group-hover:text-leaf-dk transition-colors">
              {title}
            </h2>
            {sub && <p className="text-sm text-mute mt-1">{sub}</p>}
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-mute">
          {plate && (
            <span className="font-mono tabular-nums text-ink">{plate}</span>
          )}
          {vehicle.current_odometer != null && (
            <span className="font-mono tabular-nums">
              {vehicle.current_odometer.toLocaleString()} km
            </span>
          )}
          {summary?.lastServiceDate && (
            <span>Last service {relativeDate(summary.lastServiceDate)}</span>
          )}
        </div>

        <div className="mt-auto pt-3 border-t border-seam grid grid-cols-3 gap-2 text-center">
          <Link
            href={`/workshops?vehicle=${vehicle.id}`}
            className="text-xs font-semibold py-2 rounded-pill bg-leaf text-white hover:bg-leaf-dk transition-colors"
          >
            Book service
          </Link>
          <Link
            href={`/vehicles/${vehicle.id}/service/new`}
            className="text-xs font-semibold py-2 rounded-pill border border-seam text-ink hover:border-leaf/40 hover:text-leaf-dk transition-colors"
          >
            Add receipt
          </Link>
          <Link
            href={`/vehicles/${vehicle.id}`}
            className="text-xs font-semibold py-2 rounded-pill border border-seam text-ink hover:border-leaf/40 hover:text-leaf-dk transition-colors"
          >
            Details
          </Link>
        </div>
      </div>
    </article>
  )
}

function TrustedGarageTile({ garage }: { garage: TrustedGarage }) {
  return (
    <Link
      href={`/w/${garage.slug}/book`}
      className="snap-start shrink-0 w-[220px] rounded-DEFAULT border border-seam bg-carbon hover:border-leaf/40 transition-colors overflow-hidden group"
    >
      <div className="relative w-full aspect-[4/3] bg-iron overflow-hidden">
        {garage.hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={garage.hero}
            alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-mute">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <path d="M2 22h20M3 22V9a2 2 0 0 1 1.4-1.9l7-2.6a2 2 0 0 1 1.2 0l7 2.6A2 2 0 0 1 21 9v13" />
              <path d="M9 22V12h6v10" />
            </svg>
          </div>
        )}
        {garage.tier && garage.tier !== 'unverified' && (
          <span
            className={`absolute top-2 left-2 text-[9px] tracking-widest uppercase px-2 py-0.5 rounded-pill font-semibold ${
              garage.tier === 'gold'
                ? 'bg-wallet text-noir'
                : 'bg-noir/70 backdrop-blur text-chalk'
            }`}
          >
            {garage.tier}
          </span>
        )}
      </div>
      <div className="p-4">
        <p className="text-sm font-semibold text-ink line-clamp-1">{garage.name}</p>
        <p className="text-[11px] text-mute mt-1 line-clamp-1">
          {garage.emirate ?? 'UAE'} ·{' '}
          {garage.visits} visit{garage.visits === 1 ? '' : 's'}
        </p>
        {garage.lastVisit && (
          <p className="text-[11px] text-mute mt-0.5 line-clamp-1">
            Last {relativeDate(garage.lastVisit)}
          </p>
        )}
        <p className="text-xs font-semibold text-leaf mt-3 inline-flex items-center gap-1">
          Book again &rarr;
        </p>
      </div>
    </Link>
  )
}

function UpcomingRow({ item }: { item: Upcoming }) {
  const tone =
    item.daysAway < 0
      ? 'text-signal'
      : item.daysAway < 7
        ? 'text-signal'
        : item.daysAway < 30
          ? 'text-wallet'
          : 'text-mute'
  const ago =
    item.daysAway < 0
      ? `${-item.daysAway}d overdue`
      : item.daysAway === 0
        ? 'today'
        : `in ${item.daysAway}d`
  return (
    <li className="py-3 flex items-center gap-3">
      <div className="w-8 h-8 rounded-pill bg-iron flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={tone} aria-hidden>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">
          {item.label} <span className="text-mute font-normal">— {item.vehicleTitle}</span>
        </p>
        <p className={`text-xs ${tone} mt-0.5`}>{ago}</p>
      </div>
      <Link
        href={`/vehicles/${item.vehicleId}`}
        className="text-xs font-semibold text-leaf hover:text-leaf-dk shrink-0"
      >
        Open
      </Link>
    </li>
  )
}

function ActivityRow({
  row,
  vehicle,
}: {
  row: ServiceRow
  vehicle: Vehicle | null
}) {
  const title = vehicle
    ? vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`
    : 'A vehicle'
  return (
    <li className="py-3 flex items-start gap-3">
      <div className="w-8 h-8 rounded-pill bg-leaf/10 flex items-center justify-center shrink-0 mt-0.5">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-leaf" aria-hidden>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">
          {row.workshop_name_freetext ?? 'Service'}
          {' '}
          <span className="text-mute font-normal">— {title}</span>
        </p>
        <p className="text-xs text-mute mt-0.5">
          {row.service_date ? relativeDate(row.service_date) : 'Recently'}
          {row.cost_aed ? ` · AED ${Number(row.cost_aed).toLocaleString()}` : ''}
        </p>
      </div>
      {vehicle && (
        <Link
          href={`/vehicles/${vehicle.id}`}
          className="text-xs font-semibold text-leaf hover:text-leaf-dk shrink-0"
        >
          View
        </Link>
      )}
    </li>
  )
}

function prettyDocType(code: string): string {
  switch (code) {
    case 'mulkiya':
      return 'Mulkiya'
    case 'insurance':
      return 'Insurance'
    case 'rsa':
      return 'RSA / breakdown'
    case 'noc':
      return 'NOC'
    case 'warranty':
      return 'Warranty'
    case 'attestation':
      return 'Attestation'
    default:
      return code.charAt(0).toUpperCase() + code.slice(1).replace(/_/g, ' ')
  }
}
