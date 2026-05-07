import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createVehicle } from '@/app/actions/vehicles'
import { EMIRATES } from '@vehkit/types'

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const errorMsg = params.error

  return (
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-xl mx-auto">
        <Link href="/garage" className="text-sm text-steel hover:text-ink transition-colors">
          ← Garage
        </Link>
        <h1 className="text-3xl font-semibold text-ink mt-4">Add a vehicle</h1>
        <p className="text-steel mt-1">Start its passport.</p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={createVehicle} className="mt-8 space-y-4">
          <Field label="Make" name="make" placeholder="Toyota" required />
          <Field label="Model" name="model" placeholder="Land Cruiser" required />

          <div className="grid grid-cols-2 gap-4">
            <Field label="Year" name="year" type="number" placeholder="2023" />
            <Field label="Color" name="color" placeholder="White" />
          </div>

          <Field
            label="Nickname"
            name="nickname"
            placeholder="The Patrol"
            hint="Shows on your garage card."
          />

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Field label="Plate number" name="plate_number" placeholder="A 12345" />
            </div>
            <Select label="Emirate" name="plate_emirate" options={EMIRATES} />
          </div>

          <Field label="VIN / Chassis" name="vin" placeholder="17 characters" />
          <Field
            label="Current odometer (km)"
            name="current_odometer"
            type="number"
            placeholder="82000"
          />

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              className="bg-ink text-cream px-6 py-3 rounded font-medium hover:bg-ink/90 transition-colors"
            >
              Add vehicle
            </button>
            <Link
              href="/garage"
              className="px-6 py-3 rounded font-medium text-steel hover:text-ink transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </main>
  )
}

function Field({
  label,
  name,
  type = 'text',
  placeholder,
  required,
  hint,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  hint?: string
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink mb-1">
        {label} {required && <span className="text-signal">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2.5 rounded border border-mist bg-white focus:border-ink outline-none transition-colors"
      />
      {hint && <p className="text-xs text-steel mt-1">{hint}</p>}
    </div>
  )
}

function Select({
  label,
  name,
  options,
}: {
  label: string
  name: string
  options: readonly string[]
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-ink mb-1">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
        className="w-full px-3 py-2.5 rounded border border-mist bg-white focus:border-ink outline-none transition-colors"
      >
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
