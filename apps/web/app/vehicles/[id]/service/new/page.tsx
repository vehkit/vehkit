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
    <main className="min-h-screen px-6 py-10">
      <div className="max-w-xl mx-auto">
        <Link
          href={`/vehicles/${id}`}
          className="text-sm text-steel hover:text-ink transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>
        <h1 className="text-3xl font-semibold text-ink mt-4">Add service record</h1>
        <p className="text-steel mt-1">Log what was done.</p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={createServiceRecord} className="mt-8 space-y-4">
          <input type="hidden" name="vehicle_id" value={id} />

          <div>
            <label
              htmlFor="service_type"
              className="block text-sm font-medium text-ink mb-1"
            >
              Service type <span className="text-signal">*</span>
            </label>
            <select
              id="service_type"
              name="service_type"
              required
              defaultValue=""
              className="w-full px-3 py-2.5 rounded border border-mist bg-white focus:border-ink outline-none transition-colors"
            >
              <option value="" disabled>
                Select…
              </option>
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Service date"
            name="service_date"
            type="date"
            required
            defaultValue={today}
          />

          <div className="grid grid-cols-2 gap-4">
            <Field
              label="Odometer (km)"
              name="odometer"
              type="number"
              defaultValue={vehicle.current_odometer?.toString() ?? ''}
            />
            <Field label="Cost (AED)" name="cost_aed" type="number" placeholder="350" />
          </div>

          <Field
            label="Workshop"
            name="workshop_name"
            placeholder="Al Quoz Auto Care"
            hint="Free text for now. Verified workshop linking comes later."
          />

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-ink mb-1">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Mobil 1 5W-30, oil filter changed too"
              className="w-full px-3 py-2.5 rounded border border-mist bg-white focus:border-ink outline-none transition-colors resize-none"
            />
          </div>

          <div className="pt-4 flex gap-3">
            <button
              type="submit"
              className="bg-ink text-cream px-6 py-3 rounded font-medium hover:bg-ink/90 transition-colors"
            >
              Save record
            </button>
            <Link
              href={`/vehicles/${id}`}
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
  defaultValue,
  hint,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
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
        defaultValue={defaultValue}
        className="w-full px-3 py-2.5 rounded border border-mist bg-white focus:border-ink outline-none transition-colors"
      />
      {hint && <p className="text-xs text-steel mt-1">{hint}</p>}
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
