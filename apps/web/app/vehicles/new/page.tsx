import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createVehicle } from '@/app/actions/vehicles'
import { VehicleMakeModelPicker } from '@/components/VehicleMakeModelPicker'
import { ContinueWhenValid } from '@/components/ContinueWhenValid'

/**
 * /vehicles/new — first form a new user fills.
 *
 * Stripped to the bare minimum:
 *   1. Make (required)
 *   2. Model (required)
 *   3. Current km from the odometer (required-ish; needed for service
 *      reminders to make sense)
 *
 * Everything else (plate, VIN, color, year, nickname, doors, fuel...)
 * is read from the mulkiya upload on the next screen, so we don't ask
 * twice. Less typing now equals more cars added.
 *
 * The Continue button stays hidden until the form's HTML5 validity
 * passes, so the user knows when they're done.
 */
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
          Make, model, and the odometer. The rest we will read off your
          mulkiya in a minute.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={createVehicle} className="mt-8 space-y-4" id="vehicle-form">
          <VehicleMakeModelPicker />

          <Field
            label="Current kilometres"
            name="current_odometer"
            type="number"
            inputMode="numeric"
            placeholder="82000"
            required
            hint="What the odometer reads today. We use this to time service reminders."
          />
        </form>
      </div>

      {/* Sticky bottom action bar. Continue only shows when the form
          is valid (make + model + odometer filled). Cancel is always
          there. */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href="/mycars" className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <ContinueWhenValid formId="vehicle-form">
            <button
              type="submit"
              form="vehicle-form"
              className="pill-primary flex-[2] text-center"
            >
              Continue
            </button>
          </ContinueWhenValid>
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
