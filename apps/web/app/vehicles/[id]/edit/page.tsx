import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateVehicle } from '@/app/actions/vehicles'
import { EMIRATES } from '@vehkit/types'

export default async function EditVehiclePage({
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
    .select('*')
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
        <p className="nav-pill mt-3">vehkit · vehicle</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Edit details
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Fix anything that's wrong. Service history, photos, and shares stay
          attached.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={updateVehicle} className="mt-8 space-y-4" id="edit-vehicle-form">
          <input type="hidden" name="id" value={id} />

          <Field label="Make" name="make" required defaultValue={vehicle.make} />
          <Field label="Model" name="model" required defaultValue={vehicle.model} />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Year"
              name="year"
              type="number"
              inputMode="numeric"
              defaultValue={vehicle.year?.toString() ?? ''}
            />
            <Field label="Color" name="color" defaultValue={vehicle.color ?? ''} />
          </div>

          <Field label="Nickname" name="nickname" defaultValue={vehicle.nickname ?? ''} />

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field
                label="Plate"
                name="plate_number"
                defaultValue={vehicle.plate_number ?? ''}
              />
            </div>
            <Select
              label="Emirate"
              name="plate_emirate"
              options={EMIRATES}
              defaultValue={vehicle.plate_emirate ?? ''}
            />
          </div>

          <Field label="VIN / Chassis" name="vin" defaultValue={vehicle.vin ?? ''} />
          <Field
            label="Odometer (km)"
            name="current_odometer"
            type="number"
            inputMode="numeric"
            defaultValue={vehicle.current_odometer?.toString() ?? ''}
          />

          {/* Workshop outreach opt-in */}
          <div className="card p-4 mt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="allow_workshop_outreach"
                defaultChecked={vehicle.allow_workshop_outreach ?? false}
                className="mt-0.5 w-4 h-4 accent-volt cursor-pointer shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-chalk">
                  Let workshops suggest reminders
                </p>
                <p className="text-xs text-ash mt-1 leading-relaxed">
                  Workshops you've visited can suggest service reminders for this car (e.g.
                  "next oil change due"). Suggestions show up in your inbox — you accept,
                  snooze, or dismiss. They never get your email or phone.
                </p>
              </div>
            </label>
          </div>
        </form>
      </div>

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href={`/vehicles/${id}`} className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            form="edit-vehicle-form"
            className="pill-primary flex-[2] text-center"
          >
            Save changes
          </button>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-signal">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="field"
      />
    </div>
  )
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string
  name: string
  options: readonly string[]
  defaultValue: string
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className="field">
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}
