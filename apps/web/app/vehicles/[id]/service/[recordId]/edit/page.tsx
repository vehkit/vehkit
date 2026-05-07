import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateServiceRecord } from '@/app/actions/services'
import { SERVICE_TYPES } from '@vehkit/types'

export default async function EditServicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; recordId: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id, recordId } = await params
  const sp = await searchParams
  const errorMsg = sp.error

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: record, error } = await supabase
    .from('service_records')
    .select('*')
    .eq('id', recordId)
    .eq('vehicle_id', id)
    .single()

  if (error || !record) notFound()

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname')
    .eq('id', id)
    .single()
  if (!vehicle) notFound()

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
          Edit service
        </h1>
        <p className="text-ash mt-1">Fix what was wrong.</p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={updateServiceRecord} className="mt-8 space-y-4" id="edit-form">
          <input type="hidden" name="id" value={recordId} />
          <input type="hidden" name="vehicle_id" value={id} />

          <div>
            <label htmlFor="service_type" className="label">
              Service type <span className="text-signal">*</span>
            </label>
            <select
              id="service_type"
              name="service_type"
              required
              defaultValue={record.service_type}
              className="field"
            >
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
            defaultValue={record.service_date}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Odometer (km)"
              name="odometer"
              type="number"
              inputMode="numeric"
              defaultValue={record.odometer?.toString() ?? ''}
            />
            <Field
              label="Cost (AED)"
              name="cost_aed"
              type="number"
              inputMode="decimal"
              defaultValue={record.cost_aed?.toString() ?? ''}
            />
          </div>

          <Field
            label="Workshop"
            name="workshop_name"
            defaultValue={record.workshop_name_freetext ?? ''}
          />

          <div>
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              defaultValue={record.notes ?? ''}
              className="field resize-none"
            />
          </div>
        </form>
      </div>

      <div className="fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href={`/vehicles/${id}`} className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button type="submit" form="edit-form" className="pill-primary flex-[2] text-center">
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

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
