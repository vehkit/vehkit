import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createFuelLog } from '@/app/actions/fuel'

const FUEL_GRADES = [
  { value: 'special', label: 'Special 95' },
  { value: 'super', label: 'Super 98' },
  { value: 'e_plus', label: 'E-Plus 91' },
  { value: 'diesel', label: 'Diesel' },
] as const

export default async function NewFuelLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const errorMsg = sp.error

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname, current_odometer')
    .eq('id', id)
    .single()
  if (error || !vehicle) notFound()

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-8 md:pt-10">
        <Link
          href={`/vehicles/${id}`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>
        <p className="nav-pill mt-3">vehkit · fuel</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Log a fill-up
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Track consumption and spend over time. The more you log, the sharper
          your kilometres-per-litre and AED-per-month read out.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={createFuelLog} className="mt-8 space-y-4">
          <input type="hidden" name="vehicle_id" value={id} />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="liters" className="label">
                Litres <span className="text-signal">*</span>
              </label>
              <input
                id="liters"
                name="liters"
                type="number"
                step="0.01"
                min="0.1"
                inputMode="decimal"
                required
                placeholder="42.5"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="total_aed" className="label">
                Total AED
              </label>
              <input
                id="total_aed"
                name="total_aed"
                type="number"
                step="0.01"
                min="0"
                inputMode="decimal"
                placeholder="135.00"
                className="field"
              />
            </div>
          </div>

          <div>
            <label htmlFor="odometer_km" className="label">
              Odometer{' '}
              <span className="text-ash/70 text-xs">
                {vehicle.current_odometer != null
                  ? `(now ${vehicle.current_odometer.toLocaleString()} km)`
                  : '(optional)'}
              </span>
            </label>
            <input
              id="odometer_km"
              name="odometer_km"
              type="number"
              min="0"
              step="1"
              inputMode="numeric"
              defaultValue={vehicle.current_odometer ?? undefined}
              className="field"
            />
            <p className="text-[11px] text-ash/70 mt-1.5">
              We&apos;ll bump your car&apos;s odometer if this is higher.
            </p>
          </div>

          <div>
            <label htmlFor="fuel_grade" className="label">
              Grade
            </label>
            <select
              id="fuel_grade"
              name="fuel_grade"
              defaultValue=""
              className="field"
            >
              <option value="">Skip</option>
              {FUEL_GRADES.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="station_name" className="label">
              Station <span className="text-ash/70">(optional)</span>
            </label>
            <input
              id="station_name"
              name="station_name"
              type="text"
              maxLength={80}
              placeholder="ENOC, ADNOC, EPPCO…"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="notes" className="label">
              Notes <span className="text-ash/70">(optional)</span>
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={2}
              maxLength={200}
              className="field"
            />
          </div>

          <div className="pt-2">
            <button type="submit" className="pill-primary block w-full text-center">
              Log fill-up
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
