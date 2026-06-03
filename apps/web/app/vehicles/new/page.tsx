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
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-8 md:pt-10">
        <p className="nav-pill">Step 1 of your setup</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Add your car
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Just the basics now — only{' '}
          <span className="text-chalk font-medium">make and model</span> are
          required. You can add documents, services and reminders right after.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={createVehicle} className="mt-8 space-y-4" id="vehicle-form">
          <Field label="Make" name="make" placeholder="Toyota" required autoFocus />
          <Field label="Model" name="model" placeholder="Land Cruiser" required />

          <div className="grid grid-cols-2 gap-3">
            <Field label="Year" name="year" type="number" inputMode="numeric" placeholder="2023" />
            <Field label="Color" name="color" placeholder="White" />
          </div>

          <Field
            label="Nickname"
            name="nickname"
            placeholder="The Patrol"
            hint="What you'd call it in conversation. Shows on your garage card."
          />

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field
                label="Plate number"
                name="plate_number"
                placeholder="A 12345"
                hint="Letter + numbers, exactly as on the plate."
              />
            </div>
            <Select label="Emirate" name="plate_emirate" options={EMIRATES} />
          </div>

          <Field
            label="VIN / Chassis number"
            name="vin"
            placeholder="17 characters"
            hint="Found on your mulkiya (registration). Optional — but helps with resale."
          />
          <Field
            label="Current kilometres"
            name="current_odometer"
            type="number"
            inputMode="numeric"
            placeholder="82000"
            hint="What the odometer reads today. We use this to time service reminders."
          />
        </form>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href="/mycars" className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button type="submit" form="vehicle-form" className="pill-primary flex-[2] text-center">
            Save and continue
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
  placeholder,
  required,
  hint,
  inputMode,
  enterKeyHint = 'next',
  autoFocus,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  hint?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
  /**
   * Hints the mobile keyboard's action key. Defaults to "next" so most
   * fields show a "Next" button that moves to the following input. The
   * final field of a form should pass "done" so the soft keyboard offers
   * a clear submit affordance.
   */
  enterKeyHint?: 'enter' | 'done' | 'go' | 'next' | 'previous' | 'search' | 'send'
  autoFocus?: boolean
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
        placeholder={placeholder}
        required={required}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoFocus={autoFocus}
        className="field"
      />
      {hint && <p className="text-xs text-ash mt-1.5">{hint}</p>}
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
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} defaultValue="" className="field">
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
