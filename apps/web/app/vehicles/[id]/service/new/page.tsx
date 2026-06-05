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
      <div className="max-w-xl mx-auto px-6 pt-8 md:pt-10">
        <Link
          href={`/vehicles/${id}`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>
        <p className="nav-pill mt-3">vehkit · service log</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          What was done?
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Log it yourself or hand the customer code to the workshop. Either way
          it lives forever on this car's passport.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form
          action={createServiceRecord}
          encType="multipart/form-data"
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

          <div>
            <label htmlFor="photos" className="label">
              Photos / receipts
            </label>
            <input
              type="file"
              id="photos"
              name="photos"
              accept="image/*"
              capture="environment"
              multiple
              className="block w-full text-sm text-ash file:mr-4 file:py-2 file:px-4 file:rounded-pill file:border-0 file:text-sm file:font-medium file:bg-iron file:text-chalk hover:file:bg-iron/70 file:cursor-pointer cursor-pointer"
            />
            <p className="text-xs text-ash mt-1.5">
              Optional. Snap the invoice, part you replaced, or before/after shots. Multiple
              allowed.
            </p>
          </div>
        </form>
      </div>

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
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
  inputMode,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
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
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="field"
      />
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
