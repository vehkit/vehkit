import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { PrintButton } from '@/components/PrintButton'
import { VehicleUvtsCard } from '@/components/VehicleUvtsCard'
import { computeUvts } from '@/lib/uvts'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>
}): Promise<Metadata> {
  const { token } = await params
  const supabase = createAdminClient()

  const { data: share } = await supabase
    .from('vehicle_share_tokens')
    .select('vehicle_id')
    .eq('token', token)
    .is('revoked_at', null)
    .maybeSingle()

  if (!share) return { title: 'Vehkit · Vehicle Passport' }

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('make, model, nickname, year')
    .eq('id', share.vehicle_id)
    .maybeSingle()

  if (!vehicle) return { title: 'Vehkit · Vehicle Passport' }

  const name = vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`
  return {
    title: `${name} · Vehkit Passport`,
    description: `Verified service history for ${vehicle.year ?? ''} ${vehicle.make} ${vehicle.model}`.trim(),
  }
}

export default async function ResaleReportPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const supabase = createAdminClient()

  // Look up the share token
  const { data: share } = await supabase
    .from('vehicle_share_tokens')
    .select('id, vehicle_id, expires_at, revoked_at, view_count')
    .eq('token', token)
    .maybeSingle()

  if (!share || share.revoked_at) notFound()
  if (share.expires_at && new Date(share.expires_at) < new Date()) notFound()

  // Increment view count (fire and forget)
  void supabase
    .from('vehicle_share_tokens')
    .update({ view_count: (share.view_count ?? 0) + 1 })
    .eq('id', share.id)

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', share.vehicle_id)
    .single()
  if (!vehicle) notFound()

  const [{ data: records }, { data: documents }] = await Promise.all([
    supabase
      .from('service_records')
      .select('*, service_files(storage_path)')
      .eq('vehicle_id', share.vehicle_id)
      .order('service_date', { ascending: false }),
    supabase
      .from('vehicle_documents')
      .select(
        'doc_type, expires_at, created_at, extracted_data, archived_at',
      )
      .eq('vehicle_id', share.vehicle_id)
      .is('archived_at', null),
  ])

  // UVTS — headline trust signal. Computed from the same data shown
  // elsewhere on the passport so the buyer can audit every input.
  const uvts = computeUvts(
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
    (documents ?? []).map((d) => ({
      doc_type: d.doc_type as string,
      expires_at: (d.expires_at as string | null) ?? null,
      created_at: d.created_at as string,
      extracted_data:
        (d.extracted_data as Record<string, unknown> | null) ?? null,
    })),
    (records ?? []).map((r) => ({
      service_type: (r.service_type as string | null) ?? null,
      service_date: (r.service_date as string | null) ?? null,
      odometer: (r.odometer as number | null) ?? null,
      status: (r.status as string | null) ?? null,
    })),
  )

  const totalEntries = records?.length ?? 0
  const verifiedEntries = records?.filter((r) => r.attestation === 'workshop').length ?? 0
  const totalSpent = (records ?? []).reduce(
    (sum, r) => sum + (r.cost_aed ? Number(r.cost_aed) : 0),
    0
  )

  return (
    <div className="min-h-[100svh] bg-noir text-chalk print:bg-white print:text-black">
      {/* Top action bar — hidden in print */}
      <header className="sticky top-0 bg-noir/90 backdrop-blur border-b border-seam print:hidden z-10">
        <div className="max-w-3xl mx-auto px-6 py-3 flex items-center justify-between">
          <p className="nav-pill text-[10px]">Vehkit · Verified Passport</p>
          <PrintButton />
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 print:py-6">
        {/* Cover */}
        <section className="text-center print:text-left">
          <p className="nav-pill text-[10px] print:text-black">Vehicle Passport</p>
          <h1 className="text-4xl md:text-6xl font-semibold tracking-tightest mt-3 print:text-black">
            {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
          </h1>
          <p className="text-ash mt-2 print:text-gray-600">
            {[vehicle.year, vehicle.make, vehicle.model, vehicle.color]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {(vehicle.plate_emirate || vehicle.plate_number) && (
            <div className="mt-4 inline-flex items-center gap-2 bg-iron border border-seam rounded-DEFAULT px-3 py-1.5 print:bg-gray-100 print:border-gray-300">
              {vehicle.plate_emirate && (
                <span className="text-xs uppercase tracking-wider text-ash print:text-gray-700">
                  {vehicle.plate_emirate}
                </span>
              )}
              {vehicle.plate_emirate && vehicle.plate_number && (
                <span className="text-seam print:text-gray-400">·</span>
              )}
              {vehicle.plate_number && (
                <span className="font-mono text-sm print:text-black">
                  {vehicle.plate_number}
                </span>
              )}
            </div>
          )}
        </section>

        {/* Hero photo */}
        {vehicle.hero_image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={vehicle.hero_image_url}
            alt=""
            className="w-full aspect-[16/9] object-cover rounded-DEFAULT mt-8 print:rounded-none"
          />
        )}

        {/* UVTS — the only vehicle score. Workshop-axis ratings live
            on the workshop pages, not here. On the share view we don't
            pass vehicleId so the "Earn more XP" chips don't render —
            buyers can see the data the car has, not be nudged to add
            more. */}
        <section className="mt-8 print:mt-6">
          <VehicleUvtsCard result={uvts} />
        </section>

        {/* Headline stats */}
        <section className="mt-6 grid grid-cols-3 gap-3 print:gap-2">
          <Stat label="Odometer" value={vehicle.current_odometer?.toLocaleString() ?? '—'} suffix="km" />
          <Stat label="Records" value={totalEntries.toString()} />
          <Stat label="Verified" value={verifiedEntries.toString()} />
        </section>

        {totalSpent > 0 && (
          <p className="text-center text-sm text-ash mt-4 print:text-gray-600 print:text-left">
            Total documented spend:{' '}
            <span className="font-mono text-chalk print:text-black">
              AED {totalSpent.toLocaleString()}
            </span>
          </p>
        )}

        {vehicle.vin && (
          <p className="text-center text-xs text-ash mt-2 font-mono print:text-left print:text-gray-600">
            VIN · {vehicle.vin}
          </p>
        )}

        {/* Verified seal */}
        <section className="mt-10 flex items-center justify-center gap-3 py-6 border-y border-seam print:border-gray-300">
          <div className="w-10 h-10 rounded-pill bg-volt/20 border border-volt flex items-center justify-center print:bg-green-50 print:border-green-700">
            <span className="text-volt text-lg print:text-green-700">✓</span>
          </div>
          <div>
            <p className="text-sm font-medium print:text-black">Vehkit Verified Record</p>
            <p className="text-xs text-ash print:text-gray-600">
              Owner-controlled, immutable, cryptographically signed
            </p>
          </div>
        </section>

        {/* Service timeline */}
        <section className="mt-10">
          <h2 className="text-xs tracking-widest uppercase text-ash mb-4 print:text-gray-700">
            Service history · {totalEntries} {totalEntries === 1 ? 'entry' : 'entries'}
          </h2>

          {records && records.length > 0 ? (
            <ol className="space-y-3 print:space-y-2">
              {records.map((r) => (
                <li
                  key={r.id}
                  className={`card overflow-hidden print:border print:border-gray-300 print:bg-white print:shadow-none print:rounded-none print:break-inside-avoid ${
                    r.attestation === 'workshop' ? 'border-l-4 border-l-volt' : ''
                  }`}
                >
                  <div className="p-5 print:p-4 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium print:text-black">
                          {humanize(r.service_type)}
                        </span>
                        {r.attestation === 'workshop' && (
                          <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium print:bg-green-50 print:text-green-700 print:border print:border-green-700">
                            ✓ Verified
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ash mt-1.5 print:text-gray-700">
                        {new Date(r.service_date).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {r.odometer && (
                          <>
                            {' · '}
                            <span className="font-mono">{r.odometer.toLocaleString()} km</span>
                          </>
                        )}
                      </p>
                      {r.workshop_name_freetext && (
                        <p className="text-sm text-ash/80 mt-1 print:text-gray-600">
                          @ {r.workshop_name_freetext}
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-sm text-chalk/80 mt-2 leading-relaxed print:text-gray-800">
                          {r.notes}
                        </p>
                      )}
                    </div>
                    {r.cost_aed != null && (
                      <p className="text-sm font-mono whitespace-nowrap tabular-nums print:text-black">
                        AED {Number(r.cost_aed).toLocaleString()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-ash print:text-gray-600">No service history recorded.</p>
          )}
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-seam text-center text-xs text-ash space-y-1 print:border-gray-300 print:text-gray-600">
          <p>
            Generated by <span className="font-medium text-chalk print:text-black">Vehkit</span> ·
            vehkit.com
          </p>
          <p>
            Verify this report at:{' '}
            <span className="font-mono break-all">
              {process.env.NEXT_PUBLIC_SITE_URL ?? 'https://vehkit.com'}/r/{token}
            </span>
          </p>
          <p className="text-ash/60">
            Generated{' '}
            {new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </footer>
      </main>
    </div>
  )
}

function Stat({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  return (
    <div className="card p-4 text-center print:bg-gray-50 print:border print:border-gray-300 print:shadow-none">
      <p className="text-[10px] tracking-widest uppercase text-ash print:text-gray-600">{label}</p>
      <p className="font-mono text-2xl md:text-3xl font-semibold mt-1 tabular-nums tracking-tighter print:text-black">
        {value}
        {suffix && <span className="text-ash text-sm ml-1 print:text-gray-600">{suffix}</span>}
      </p>
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
