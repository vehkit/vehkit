import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { deleteVehicle } from '@/app/actions/vehicles'
import { deleteServiceRecord } from '@/app/actions/services'
import { HeroPhotoUpload } from '@/components/HeroPhotoUpload'
import {
  reminderStatus,
  reminderLabel,
  humanizeReminderType,
  type ReminderRow,
} from '@/lib/reminders'

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
    .select('*, service_files(storage_path)')
    .eq('vehicle_id', id)
    .order('service_date', { ascending: false })

  const { data: reminders } = await supabase
    .from('reminders')
    .select('*')
    .eq('vehicle_id', id)
    .eq('status', 'open')
    .order('due_date', { ascending: true, nullsFirst: false })

  const dueReminders = (reminders ?? []).filter((r: ReminderRow) => {
    const s = reminderStatus(r, vehicle.current_odometer)
    return s === 'overdue' || s === 'due_soon'
  })

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-3xl mx-auto px-6 pt-10">
        <Link href="/garage" className="nav-pill hover:text-chalk transition-colors">
          ← Garage
        </Link>

        {/* Hero photo */}
        <div className="mt-4">
          <HeroPhotoUpload vehicleId={id} currentUrl={vehicle.hero_image_url} />
        </div>

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
          </p>

          {(vehicle.plate_emirate || vehicle.plate_number) && (
            <div className="mt-4 inline-flex items-center gap-2 bg-iron border border-seam rounded-DEFAULT px-3 py-1.5">
              {vehicle.plate_emirate && (
                <>
                  <span className="text-xs text-ash uppercase tracking-wider">
                    {vehicle.plate_emirate}
                  </span>
                  {vehicle.plate_number && <span className="text-seam">·</span>}
                </>
              )}
              {vehicle.plate_number && (
                <span className="font-mono text-sm text-chalk">{vehicle.plate_number}</span>
              )}
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-seam flex items-end justify-between gap-4">
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

        {/* Reminders banner */}
        {dueReminders.length > 0 && (
          <section className="mt-6 space-y-2">
            {dueReminders.map((r: ReminderRow) => {
              const status = reminderStatus(r, vehicle.current_odometer)
              const isOverdue = status === 'overdue'
              return (
                <div
                  key={r.id}
                  className={`card p-4 border-l-4 ${
                    isOverdue ? 'border-l-signal' : 'border-l-wallet'
                  } flex items-center justify-between`}
                >
                  <div>
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
                    className={`text-xs tracking-widest uppercase font-medium ${
                      isOverdue ? 'text-signal' : 'text-wallet'
                    } hover:underline`}
                  >
                    Log →
                  </Link>
                </div>
              )
            })}
          </section>
        )}

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
              {records.map((r) => {
                const photo = r.service_files?.[0]?.storage_path
                return (
                  <li
                    key={r.id}
                    className={`card overflow-hidden ${
                      r.attestation === 'workshop' ? 'border-l-4 border-l-volt' : ''
                    }`}
                  >
                    {photo && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photo} alt="" className="w-full h-40 object-cover" />
                    )}
                    <div className="p-5 flex items-start justify-between gap-4">
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
                              <span className="font-mono">
                                {r.odometer.toLocaleString()} km
                              </span>
                            </>
                          )}
                        </p>
                        {r.workshop_name_freetext && (
                          <p className="text-sm text-ash/80 mt-1">@ {r.workshop_name_freetext}</p>
                        )}
                        {r.notes && (
                          <p className="text-sm text-chalk/80 mt-2 leading-relaxed">{r.notes}</p>
                        )}
                        <div className="flex gap-3 mt-3">
                          <Link
                            href={`/vehicles/${id}/service/${r.id}/edit`}
                            className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
                          >
                            Edit
                          </Link>
                          <form action={deleteServiceRecord}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="vehicle_id" value={id} />
                            <button
                              type="submit"
                              className="text-xs tracking-widest uppercase text-ash hover:text-signal transition-colors"
                              formNoValidate
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                      {r.cost_aed != null && (
                        <p className="text-sm text-chalk font-mono whitespace-nowrap tabular-nums">
                          AED {Number(r.cost_aed).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
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
