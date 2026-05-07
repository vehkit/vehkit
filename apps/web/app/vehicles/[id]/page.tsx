import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteVehicle } from '@/app/actions/vehicles'

export default async function VehiclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !vehicle) notFound()

  const { data: records } = await supabase
    .from('service_records')
    .select('*')
    .eq('vehicle_id', id)
    .order('service_date', { ascending: false })

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <Link href="/garage" className="nav-pill hover:text-chalk transition-colors">
          ← Garage
        </Link>

        {/* Hero card */}
        <header className="card p-6 md:p-8 mt-4">
          {(vehicle.year || vehicle.color) && (
            <p className="nav-pill text-[10px]">
              {[vehicle.year, vehicle.color].filter(Boolean).join(' · ')}
            </p>
          )}
          <h1 className="text-3xl md:text-5xl font-semibold text-chalk tracking-tightest mt-2">
            {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
          </h1>
          <p className="text-ash mt-1">
            {vehicle.make} {vehicle.model}
            {vehicle.plate_number && (
              <>
                {' · '}
                <span className="font-mono text-chalk/80">{vehicle.plate_number}</span>
              </>
            )}
            {vehicle.plate_emirate && <> · {vehicle.plate_emirate}</>}
          </p>

          <div className="mt-6 pt-6 border-t border-seam flex items-end justify-between">
            <div>
              <p className="nav-pill text-[10px]">Odometer</p>
              <p className="font-mono text-4xl md:text-5xl font-semibold text-chalk tabular-nums tracking-tighter mt-1">
                {vehicle.current_odometer?.toLocaleString() ?? '—'}
                <span className="text-ash text-lg ml-1">km</span>
              </p>
            </div>
            {vehicle.vin && (
              <div className="text-right">
                <p className="nav-pill text-[10px]">VIN</p>
                <p className="text-xs text-ash mt-1 font-mono break-all max-w-[180px]">
                  {vehicle.vin}
                </p>
              </div>
            )}
          </div>
        </header>

        {/* Timeline */}
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="nav-pill">Service history</h2>
            {records && records.length > 0 && (
              <p className="nav-pill text-[10px]">
                {records.length} {records.length === 1 ? 'entry' : 'entries'}
              </p>
            )}
          </div>

          {records && records.length > 0 ? (
            <ol className="space-y-3">
              {records.map((r) => (
                <li
                  key={r.id}
                  className={`card p-5 ${
                    r.attestation === 'workshop' ? 'border-l-4 border-l-volt' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-chalk">
                          {humanize(r.service_type)}
                        </span>
                        {r.attestation === 'workshop' && (
                          <span className="text-[10px] tracking-wider uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium">
                            ✓ Verified
                          </span>
                        )}
                        {r.attestation === 'receipt' && (
                          <span className="text-[10px] tracking-wider uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium">
                            Receipt
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-ash mt-1.5">
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
                        <p className="text-sm text-ash/80 mt-1">
                          @ {r.workshop_name_freetext}
                        </p>
                      )}
                      {r.notes && (
                        <p className="text-sm text-chalk/80 mt-2 leading-relaxed">{r.notes}</p>
                      )}
                    </div>
                    {r.cost_aed != null && (
                      <p className="text-sm text-chalk font-mono whitespace-nowrap tabular-nums">
                        AED {Number(r.cost_aed).toLocaleString()}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <div className="card p-10 text-center">
              <p className="text-chalk font-medium">No service records yet.</p>
              <p className="text-sm text-ash mt-2 mb-6">
                Log your first service to start the timeline.
              </p>
              <Link
                href={`/vehicles/${id}/service/new`}
                className="pill-primary inline-flex items-center"
              >
                Add service record
              </Link>
            </div>
          )}
        </section>

        {/* Danger zone */}
        <section className="mt-16 pt-6 border-t border-seam">
          <form action={deleteVehicle} className="text-right">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="text-xs tracking-widest uppercase text-signal hover:underline"
              formNoValidate
            >
              Delete this vehicle
            </button>
          </form>
        </section>
      </div>

      {/* Sticky bottom action */}
      {records && records.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0">
          <div className="max-w-3xl mx-auto">
            <Link
              href={`/vehicles/${id}/service/new`}
              className="pill-primary block text-center max-w-md mx-auto"
            >
              + Add service
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
