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
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <Link href="/garage" className="text-sm text-steel hover:text-ink transition-colors">
          ← Garage
        </Link>

        <header className="mt-4 bg-white border border-mist rounded p-6 flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            {(vehicle.year || vehicle.color) && (
              <p className="text-sm tracking-widest uppercase text-steel">
                {[vehicle.year, vehicle.color].filter(Boolean).join(' · ')}
              </p>
            )}
            <h1 className="text-3xl font-semibold text-ink mt-1">
              {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
            </h1>
            <p className="text-steel mt-1">
              {vehicle.make} {vehicle.model}
              {vehicle.plate_number && (
                <>
                  {' · '}
                  <span className="font-mono">{vehicle.plate_number}</span>
                </>
              )}
              {vehicle.plate_emirate && <> · {vehicle.plate_emirate}</>}
            </p>
            {vehicle.vin && (
              <p className="text-xs text-steel mt-2 font-mono">VIN · {vehicle.vin}</p>
            )}
            <p className="text-sm text-ink mt-3">
              <span className="font-medium font-mono">
                {vehicle.current_odometer?.toLocaleString() ?? '—'} km
              </span>
              <span className="text-steel"> · current odometer</span>
            </p>
          </div>
          <Link
            href={`/vehicles/${id}/service/new`}
            className="bg-ink text-cream px-4 py-2 rounded font-medium text-sm hover:bg-ink/90 transition-colors whitespace-nowrap"
          >
            + Add service
          </Link>
        </header>

        <section className="mt-10">
          <h2 className="text-sm tracking-widest uppercase text-steel mb-4">Service history</h2>

          {records && records.length > 0 ? (
            <div className="space-y-3">
              {records.map((r) => (
                <article
                  key={r.id}
                  className={`bg-white border rounded p-4 flex items-start justify-between gap-4 ${
                    r.attestation === 'workshop'
                      ? 'border-l-4 border-l-verified border-mist'
                      : 'border-mist'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-ink">
                        {humanize(r.service_type)}
                      </span>
                      {r.attestation === 'workshop' && (
                        <span className="text-xs bg-verified/10 text-verified px-2 py-0.5 rounded font-medium">
                          ✓ Verified
                        </span>
                      )}
                      {r.attestation === 'receipt' && (
                        <span className="text-xs bg-mist text-steel px-2 py-0.5 rounded font-medium">
                          Receipt
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-steel mt-1">
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
                      {r.workshop_name_freetext && <> · {r.workshop_name_freetext}</>}
                    </p>
                    {r.notes && <p className="text-sm text-ink/80 mt-2">{r.notes}</p>}
                  </div>
                  {r.cost_aed != null && (
                    <p className="text-sm text-ink font-mono whitespace-nowrap">
                      AED {Number(r.cost_aed).toLocaleString()}
                    </p>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-mist rounded p-10 text-center">
              <p className="text-ink font-medium">No service records yet.</p>
              <p className="text-sm text-steel mt-2 mb-6">
                Log your first service to start the timeline.
              </p>
              <Link
                href={`/vehicles/${id}/service/new`}
                className="inline-block bg-ink text-cream px-5 py-2.5 rounded font-medium hover:bg-ink/90 transition-colors"
              >
                Add service record
              </Link>
            </div>
          )}
        </section>

        <section className="mt-16 pt-6 border-t border-mist">
          <form action={deleteVehicle} className="text-right">
            <input type="hidden" name="id" value={id} />
            <button
              type="submit"
              className="text-sm text-signal hover:underline"
              formNoValidate
            >
              Delete this vehicle
            </button>
          </form>
        </section>
      </div>
    </main>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
