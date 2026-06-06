import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createSampleVehicle } from '@/app/actions/vehicles'
import { relativeDate } from '@/lib/format'

/**
 * /mycars v3 — garage-discovery first.
 *
 * Why this revision exists:
 *
 *   v1 + v2 led with vehicle photos. Photo-led cards reward a small
 *   subset of users (those who've uploaded a hero photo) and feel
 *   sparse to everyone else. They also push the *primary action of
 *   the product* — "find a garage" — below the fold.
 *
 *   This version inverts the hierarchy:
 *
 *   1. Greeting line (compact).
 *   2. SERVICE PICKER hero. The dominant card. Big "What does your
 *      car need today?" prompt + a row of common service chips
 *      (Oil & filters / AC / Tires / General service / Body work /
 *      Car wash). Each chip routes to /workshops with the service
 *      pre-filtered. This IS the product — surface it first.
 *   3. Next-up — only if there's something urgent (overdue mulkiya,
 *      pending workshop entry). One row, dismiss-by-action.
 *   4. CARS — compact rows, not full-bleed cards. 60x60 thumbnail +
 *      name + plate + odometer + small status pill. Four+ cars fit
 *      on a phone without scrolling.
 *   5. Trusted garages — quiet horizontal rail, only if any.
 *   6. Quiet footer → /insights.
 *
 * Visual intent: dashboard, not Instagram. Asset photos are still
 * present on the detail page; here they're a 60x60 identifying
 * thumbnail, nothing more.
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
  current_odometer: number | null
  hero_image_url: string | null
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

type NextUp =
  | { kind: 'confirm'; vehicleId: string; vehicleTitle: string; count: number }
  | {
      kind: 'doc'
      vehicleId: string
      vehicleTitle: string
      doc: string
      daysAway: number
    }
  | null

// Service chips drive the hero — picked from real UAE garage demand,
// not invented categories. Order = ascending visit frequency in our
// pilot data; tweak as we learn.
const SERVICE_CHIPS: { label: string; slug: string; emoji: string }[] = [
  { label: 'Oil & filters', slug: 'oil', emoji: '🛢️' },
  { label: 'AC service', slug: 'ac', emoji: '❄️' },
  { label: 'Tires', slug: 'tires', emoji: '🛞' },
  { label: 'Brakes', slug: 'brakes', emoji: '🛑' },
  { label: 'General service', slug: 'service', emoji: '🔧' },
  { label: 'Body work', slug: 'body', emoji: '🚗' },
  { label: 'Car wash', slug: 'wash', emoji: '🧼' },
  { label: 'Detailing', slug: 'detailing', emoji: '✨' },
]

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
      .not('expires_at', 'is', null)
      .lte('expires_at', ninetyDaysOut.split('T')[0])
      .order('expires_at', { ascending: true })
      .limit(30),
  ])

  const vehicles = (vehiclesRes.data ?? []) as Vehicle[]
  const services = (serviceRes.data ?? []) as ServiceRow[]
  const docs = (docsRes.data ?? []) as DocRow[]

  // ── pending workshop entries by vehicle ─────────────────────────
  const pendingByVehicle = new Map<string, number>()
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
  }

  // ── last-service date by vehicle ────────────────────────────────
  const lastServiceByVehicle = new Map<string, string>()
  for (const s of services) {
    if (!lastServiceByVehicle.has(s.vehicle_id) && s.service_date) {
      lastServiceByVehicle.set(s.vehicle_id, s.service_date)
    }
  }

  // ── upcoming doc expiries ───────────────────────────────────────
  const vehiclesById = new Map(vehicles.map((v) => [v.id, v]))
  const titleOf = (v: Vehicle) =>
    v.nickname ?? `${v.year ? v.year + ' ' : ''}${v.make} ${v.model}`

  type UpcomingItem = {
    vehicleId: string
    vehicleTitle: string
    doc: string
    daysAway: number
  }
  const upcoming: UpcomingItem[] = []
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
      vehicleTitle: titleOf(veh),
      doc: prettyDocType(d.doc_type),
      daysAway: days,
    })
  }
  upcoming.sort((a, b) => a.daysAway - b.daysAway)
  const upcomingByVehicle = new Map<string, UpcomingItem>()
  for (const u of upcoming) {
    if (!upcomingByVehicle.has(u.vehicleId)) {
      upcomingByVehicle.set(u.vehicleId, u)
    }
  }

  // ── trusted garages (loyalty rail) ──────────────────────────────
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
    const ws = (workshopRows ?? []) as WorkshopRow[]
    trusted = ws
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

  // ── next-up: only fires for genuinely urgent stuff ──────────────
  let nextUp: NextUp = null
  if (pendingByVehicle.size > 0) {
    const [vehicleId, count] = Array.from(pendingByVehicle.entries())[0]!
    const veh = vehiclesById.get(vehicleId)
    if (veh) {
      nextUp = {
        kind: 'confirm',
        vehicleId,
        vehicleTitle: titleOf(veh),
        count,
      }
    }
  } else if (upcoming.length > 0 && upcoming[0]!.daysAway <= 30) {
    const u = upcoming[0]!
    nextUp = {
      kind: 'doc',
      vehicleId: u.vehicleId,
      vehicleTitle: u.vehicleTitle,
      doc: u.doc,
      daysAway: u.daysAway,
    }
  }

  // ── greeting name ───────────────────────────────────────────────
  const emailLocal = (user.email ?? 'there').split('@')[0] ?? 'there'
  const firstName = emailLocal.split('.')[0] ?? emailLocal
  const greetingName =
    firstName.length > 0
      ? firstName.charAt(0).toUpperCase() + firstName.slice(1)
      : 'there'

  // ── empty state ─────────────────────────────────────────────────
  if (vehicles.length === 0) {
    return (
      <main className="min-h-[100svh] pb-24 md:pb-16">
        <div className="max-w-[760px] mx-auto px-6 md:px-10 pt-10 md:pt-16">
          <h1 className="text-3xl md:text-5xl font-semibold tracking-tighter leading-[1.05]">
            Hi {greetingName}.
          </h1>
          <p className="text-base text-mute mt-4 max-w-md leading-relaxed">
            Find a verified UAE garage in two taps — or add your car to keep
            its full service history.
          </p>

          <ServicePickerHero className="mt-8" />

          <div className="mt-8 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Link
              href="/vehicles/new"
              className="inline-flex items-center h-12 px-6 rounded-pill border border-seam text-ink font-semibold hover:border-leaf/40 hover:text-leaf-dk transition-colors"
            >
              + Add your car
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
      <div className="max-w-[840px] mx-auto px-6 md:px-10 pt-8 md:pt-12">
        {/* ── 1. greeting ── */}
        <header>
          <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter leading-tight">
            Hi {greetingName}.
          </h1>
          <p className="text-sm text-mute mt-1">
            {vehicles.length} car{vehicles.length === 1 ? '' : 's'}
            {trusted.length > 0 && ` · ${trusted.length} trusted garage${trusted.length === 1 ? '' : 's'}`}
          </p>
        </header>

        {/* ── 2. service picker hero — THE primary action ── */}
        <ServicePickerHero className="mt-6" />

        {/* ── 3. next-up — only when urgent ── */}
        {nextUp && (
          <div className="mt-4">
            <NextUpRow nextUp={nextUp} />
          </div>
        )}

        {/* ── 4. cars — compact rows ── */}
        <section className="mt-10">
          <div className="flex items-center justify-between">
            <SectionLabel>
              {vehicles.length === 1 ? 'Your car' : 'Your cars'}
            </SectionLabel>
            <Link
              href="/vehicles/new"
              className="text-xs font-semibold text-leaf hover:text-leaf-dk"
            >
              + Add
            </Link>
          </div>
          <ul className="mt-3 divide-y divide-seam border-y border-seam">
            {vehicles.map((v) => (
              <CarRow
                key={v.id}
                vehicle={v}
                isShared={v.owner_id !== user.id}
                pending={pendingByVehicle.get(v.id) ?? 0}
                lastServiceDate={lastServiceByVehicle.get(v.id) ?? null}
                upcoming={upcomingByVehicle.get(v.id) ?? null}
              />
            ))}
          </ul>
        </section>

        {/* ── 5. trusted garages — quiet rail ── */}
        {trusted.length > 0 && (
          <section className="mt-10">
            <div className="flex items-end justify-between gap-3">
              <SectionLabel>Trusted garages</SectionLabel>
              <Link
                href="/workshops"
                className="text-xs font-semibold text-leaf hover:text-leaf-dk"
              >
                Browse all &rarr;
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
                      {g.lastDate && ` · ${relativeDate(g.lastDate)}`}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── 6. quiet footer ── */}
        <div className="mt-12 pt-5 border-t border-seam flex items-center justify-between flex-wrap gap-3">
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
      </div>
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

function ServicePickerHero({ className = '' }: { className?: string }) {
  return (
    <section
      className={`rounded-DEFAULT bg-gradient-to-br from-leaf/15 via-leaf/5 to-wallet/10 border border-leaf/20 p-5 md:p-6 ${className}`}
    >
      <p className="text-[11px] tracking-[0.28em] uppercase text-leaf font-bold">
        Find a garage
      </p>
      <h2 className="text-xl md:text-2xl font-semibold tracking-tight text-ink mt-2 leading-tight">
        What does your car need today?
      </h2>
      <p className="text-sm text-mute mt-1.5">
        Verified UAE garages. Real customer reviews. Book in two taps.
      </p>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SERVICE_CHIPS.map((c) => (
          <Link
            key={c.slug}
            href={`/workshops?service=${c.slug}`}
            className="flex items-center gap-2 px-3 py-2.5 rounded-pill bg-paper border border-seam text-sm font-semibold text-ink hover:border-leaf/40 hover:bg-leaf/5 transition-colors"
          >
            <span aria-hidden>{c.emoji}</span>
            <span className="truncate">{c.label}</span>
          </Link>
        ))}
      </div>

      <Link
        href="/workshops"
        className="inline-flex items-center mt-5 text-sm font-semibold text-leaf-dk hover:text-leaf transition-colors"
      >
        Or browse all garages &rarr;
      </Link>
    </section>
  )
}

function NextUpRow({ nextUp }: { nextUp: NonNullable<NextUp> }) {
  if (nextUp.kind === 'confirm') {
    return (
      <Link
        href={`/vehicles/${nextUp.vehicleId}`}
        className="flex items-center gap-3 rounded-DEFAULT border border-wallet/40 bg-wallet/10 px-4 py-3 hover:bg-wallet/15 transition-colors"
      >
        <span className="w-9 h-9 rounded-pill bg-wallet flex items-center justify-center text-noir font-bold shrink-0">
          !
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-ink leading-tight">
            {nextUp.count === 1 ? '1 entry' : `${nextUp.count} entries`} to confirm{' '}
            <span className="text-mute font-normal">on {nextUp.vehicleTitle}</span>
          </p>
          <p className="text-[11px] text-mute mt-0.5">
            A garage logged service — confirm or reject.
          </p>
        </div>
        <span className="text-sm font-semibold text-leaf shrink-0">&rarr;</span>
      </Link>
    )
  }

  const overdue = nextUp.daysAway < 0
  const dueSoon = nextUp.daysAway <= 7
  const tone = overdue || dueSoon
    ? 'border-signal/40 bg-signal/10 hover:bg-signal/15'
    : 'border-wallet/40 bg-wallet/10 hover:bg-wallet/15'
  const headline = overdue
    ? `${nextUp.doc} expired ${-nextUp.daysAway}d ago`
    : nextUp.daysAway === 0
      ? `${nextUp.doc} expires today`
      : `${nextUp.doc} in ${nextUp.daysAway}d`
  const iconBg = overdue || dueSoon ? 'bg-signal text-white' : 'bg-wallet text-noir'

  return (
    <Link
      href={`/vehicles/${nextUp.vehicleId}`}
      className={`flex items-center gap-3 rounded-DEFAULT border px-4 py-3 transition-colors ${tone}`}
    >
      <span className={`w-9 h-9 rounded-pill flex items-center justify-center font-bold shrink-0 ${iconBg}`}>
        !
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink leading-tight">
          {headline}{' '}
          <span className="text-mute font-normal">on {nextUp.vehicleTitle}</span>
        </p>
      </div>
      <span className="text-sm font-semibold text-leaf shrink-0">&rarr;</span>
    </Link>
  )
}

function CarRow({
  vehicle,
  isShared,
  pending,
  lastServiceDate,
  upcoming,
}: {
  vehicle: Vehicle
  isShared: boolean
  pending: number
  lastServiceDate: string | null
  upcoming: {
    vehicleId: string
    doc: string
    daysAway: number
    vehicleTitle: string
  } | null
}) {
  const title =
    vehicle.nickname ?? `${vehicle.year ? vehicle.year + ' ' : ''}${vehicle.make} ${vehicle.model}`
  const plate =
    vehicle.plate_emirate && vehicle.plate_number
      ? `${vehicle.plate_emirate} · ${vehicle.plate_number}`
      : vehicle.plate_number ?? null

  let statusLabel: string | null = null
  let statusTone: 'leaf' | 'wallet' | 'signal' = 'leaf'
  if (pending > 0) {
    statusLabel = `${pending} pending`
    statusTone = 'wallet'
  } else if (upcoming) {
    if (upcoming.daysAway < 0) {
      statusLabel = `${upcoming.doc} expired`
      statusTone = 'signal'
    } else if (upcoming.daysAway <= 7) {
      statusLabel = `${upcoming.doc} ${upcoming.daysAway}d`
      statusTone = 'signal'
    } else if (upcoming.daysAway <= 30) {
      statusLabel = `${upcoming.doc} ${upcoming.daysAway}d`
      statusTone = 'wallet'
    }
  }

  return (
    <li>
      <Link
        href={`/vehicles/${vehicle.id}`}
        className="flex items-center gap-4 py-4 hover:bg-leaf/5 transition-colors -mx-2 px-2 rounded-DEFAULT"
      >
        {/* thumbnail */}
        <div className="relative w-16 h-16 shrink-0 rounded-DEFAULT overflow-hidden bg-iron">
          {vehicle.hero_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vehicle.hero_image_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-mute">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13l1.66-4.97A2 2 0 016.55 6.5h10.9a2 2 0 011.89 1.53L21 13M5 13h14M7 17h.01M17 17h.01M5 13v4a1 1 0 001 1h12a1 1 0 001-1v-4"
                />
              </svg>
            </div>
          )}
        </div>

        {/* main column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-base font-semibold text-ink truncate">{title}</p>
            {isShared && (
              <span className="text-[9px] tracking-widest uppercase text-mute bg-iron px-1.5 py-0.5 rounded-pill">
                Shared
              </span>
            )}
          </div>
          <p className="text-xs text-mute mt-0.5 truncate">
            {[
              plate,
              vehicle.current_odometer != null
                ? `${vehicle.current_odometer.toLocaleString()} km`
                : null,
              lastServiceDate ? `last ${relativeDate(lastServiceDate)}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        </div>

        {/* status pill + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {statusLabel && (
            <span
              className={`text-[10px] tracking-widest uppercase px-2 py-1 rounded-pill font-semibold whitespace-nowrap ${
                statusTone === 'leaf'
                  ? 'bg-leaf/10 text-leaf-dk'
                  : statusTone === 'wallet'
                    ? 'bg-wallet/15 text-wallet'
                    : 'bg-signal/15 text-signal'
              }`}
            >
              {statusLabel}
            </span>
          )}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-mute"
            aria-hidden
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      </Link>
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
      return 'RSA'
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
