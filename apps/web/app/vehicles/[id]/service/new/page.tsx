import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createServiceRecord } from '@/app/actions/services'
import { SERVICE_TYPES } from '@vehkit/types'

export default async function NewServicePage({
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

  const today = new Date().toISOString().slice(0, 10)

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-10">
        <Link
          href={`/vehicles/${id}`}
          className="nav-pill hover:text-chalk transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-4">
          Log service
        </h1>
        <p className="text-ash mt-1">What was done?</p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form
          action={createServiceRecord}
          className="mt-8 space-y-4"
          id="service-form"
        >
          <input type="hidden" name="vehicle_id" value={id} />

          <div>
            <label htmlFor="service_type" className="label">
              Service type <span className="text-signal">*</span>
            </label>
            <select
              id="service_type"
              name="service_type"
              required
              defaultValue=""
              className="field"
            >
              <option value="" disabled>
                Pick one…
              </option>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Date"
            name="service_date"
            type="date"
            required
            defaultValue={today}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Odometer (km)"
              name="odometer"
              type="number"
              inputMode="numeric"
              defaultValue={vehicle.current_odometer?.toString() ?? ''}
            />
            <Field
              label="Cost (AED)"
              name="cost_aed"
              type="number"
              inputMode="decimal"
              placeholder="350"
            />
          </div>

          <Field
            label="Workshop"
            name="workshop_name"
            placeholder="Al Quoz Auto Care"
            hint="Free text for now."
          />

          <div>
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Mobil 1 5W-30, oil filter changed too"
              className="field resize-none"
            />
          </div>
        </form>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href={`/vehicles/${id}`} className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button type="submit" form="service-form" className="pill-primary flex-[2] text-center">
            Save record
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
  defaultValue,
  hint,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  hint?: string
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
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="field"
      />
      {hint && <p className="text-xs text-ash mt-1.5">{hint}</p>}
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
