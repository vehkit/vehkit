import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createReminder } from '@/app/actions/reminders'
import { REMINDER_TYPES } from '@vehkit/types'

export default async function NewReminderPage({
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
      <div className="max-w-xl mx-auto px-6 pt-10">
        <Link
          href={`/vehicles/${id}`}
          className="nav-pill hover:text-chalk transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-4">
          Add reminder
        </h1>
        <p className="text-ash mt-1">Set a custom service reminder.</p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={createReminder} className="mt-8 space-y-4" id="reminder-form">
          <input type="hidden" name="vehicle_id" value={id} />

          <div>
            <label htmlFor="reminder_type" className="label">
              Type <span className="text-signal">*</span>
            </label>
            <select
              id="reminder_type"
              name="reminder_type"
              required
              defaultValue=""
              className="field"
            >
              <option value="" disabled>
                Pick one…
              </option>
              {REMINDER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {humanize(t)}
                </option>
              ))}
            </select>
            <p className="text-xs text-ash mt-1.5">
              Reminders fire when due — set a date, a km target, or both.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Due date" name="due_date" type="date" />
            <Field
              label="Due at km"
              name="due_at_km"
              type="number"
              inputMode="numeric"
              placeholder={
                vehicle.current_odometer
                  ? `${(vehicle.current_odometer + 5000).toLocaleString()}`
                  : 'e.g. 90,000'
              }
            />
          </div>

          <div>
            <label htmlFor="notes" className="label">
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              rows={3}
              placeholder="Anything specific to remember…"
              className="field resize-none"
            />
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
            form="reminder-form"
            className="pill-primary flex-[2] text-center"
          >
            Add reminder
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
  inputMode,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        placeholder={placeholder}
        inputMode={inputMode}
        className="field"
      />
    </div>
  )
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
