import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { logServiceViaCode } from '@/app/actions/workshop'
import { SERVICE_TYPES } from '@vehkit/types'

export const dynamic = 'force-dynamic'

export default async function ShopLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { code } = await params
  const sp = await searchParams
  const errorMsg = sp.error

  if (!/^\d{6}$/.test(code)) redirect('/shop?error=Invalid+code+format')

  const admin = createAdminClient()
  const { data: codeRow } = await admin
    .from('workshop_codes')
    .select('id, vehicle_id, expires_at, used_at')
    .eq('code', code)
    .maybeSingle()

  if (!codeRow) redirect('/shop?error=Invalid+code')
  if (codeRow.used_at) redirect('/shop?error=Code+already+used')
  if (new Date(codeRow.expires_at) < new Date()) redirect('/shop?error=Code+expired')

  const { data: vehicle } = await admin
    .from('vehicles')
    .select('id, make, model, nickname, year, color, plate_number, plate_emirate, current_odometer')
    .eq('id', codeRow.vehicle_id)
    .single()

  if (!vehicle) notFound()

  const today = new Date().toISOString().slice(0, 10)
  const expiresMs = new Date(codeRow.expires_at).getTime() - Date.now()
  const expiresMin = Math.max(0, Math.floor(expiresMs / 60000))

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-10">
        <Link href="/shop" className="nav-pill hover:text-chalk transition-colors">
          ← Re-enter code
        </Link>

        <div className="mt-6">
          <p className="nav-pill">Verified entry</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
            {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
          </h1>
          <p className="text-ash mt-1">
            {[vehicle.year, vehicle.make, vehicle.model, vehicle.color]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {(vehicle.plate_emirate || vehicle.plate_number) && (
            <div className="mt-3 inline-flex items-center gap-2 bg-iron border border-seam rounded-DEFAULT px-3 py-1.5">
              {vehicle.plate_emirate && (
                <span className="text-xs uppercase tracking-wider text-ash">
                  {vehicle.plate_emirate}
                </span>
              )}
              {vehicle.plate_emirate && vehicle.plate_number && (
                <span className="text-seam">·</span>
              )}
              {vehicle.plate_number && (
                <span className="font-mono text-sm text-chalk">{vehicle.plate_number}</span>
              )}
            </div>
          )}
          <p className="text-xs text-ash mt-3">
            Code expires in <span className="font-mono text-chalk">{expiresMin} min</span> · single
            use
          </p>
        </div>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={logServiceViaCode} className="mt-8 space-y-4" id="shop-form">
          <input type="hidden" name="code" value={code} />

          <Field
            label="Workshop name"
            name="workshop_name"
            placeholder="Al Quoz Auto Care"
            required
            hint="Will appear on the customer's record."
          />

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

          <p className="text-xs text-ash leading-relaxed pt-2">
            By submitting, you confirm you performed this service. The entry will be marked as
            <span className="text-volt"> ✓ Verified by workshop </span>
            on the customer's record.
          </p>
        </form>
      </div>

      <div className="fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0">
        <div className="max-w-xl mx-auto">
          <button
            type="submit"
            form="shop-form"
            className="pill-primary block text-center w-full"
          >
            Submit verified entry
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
  hint,
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
  hint?: string
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
