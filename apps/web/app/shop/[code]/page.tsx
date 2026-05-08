import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logServiceViaCode } from '@/app/actions/workshop'
import { normalizeCode, formatCode } from '@/lib/workshop-codes'
import { SERVICE_TYPES } from '@vehkit/types'

export const dynamic = 'force-dynamic'

function getClientIp(h: Headers): string | null {
  const xff = h.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]?.trim() ?? null
  return h.get('x-real-ip') ?? null
}

type CodePreview = {
  vehicle_id: string
  expires_at: string
  used_at: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_nickname: string | null
  vehicle_year: number | null
  vehicle_color: string | null
  vehicle_plate_number: string | null
  vehicle_plate_emirate: string | null
  vehicle_current_odometer: number | null
}

export default async function ShopLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { code: rawCode } = await params
  const sp = await searchParams
  const errorMsg = sp.error

  const code = normalizeCode(rawCode)
  if (!code) redirect('/shop?error=Invalid+code+format')

  const supabase = await createClient()

  // Rate limit before any DB lookup
  const h = await headers()
  const ip = getClientIp(h)
  const { data: allowed } = await supabase.rpc('check_and_track_shop_attempt', {
    p_ip: ip,
    p_code: code,
  })
  if (allowed === false) {
    redirect('/shop?error=Too+many+attempts.+Try+again+in+10+minutes.')
  }

  const { data: rows, error } = await supabase.rpc('preview_workshop_code', {
    p_code: code,
  })

  if (error || !rows || rows.length === 0) {
    redirect('/shop?error=Invalid+code')
  }

  const preview = rows[0] as CodePreview
  if (preview.used_at) redirect('/shop?error=Code+already+used')
  if (new Date(preview.expires_at) < new Date()) {
    redirect('/shop?error=Code+expired')
  }

  const today = new Date().toISOString().slice(0, 10)
  const expiresMs = new Date(preview.expires_at).getTime() - Date.now()
  const expiresMin = Math.max(0, Math.floor(expiresMs / 60000))

  const heroName =
    preview.vehicle_nickname ?? `${preview.vehicle_make} ${preview.vehicle_model}`

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-10">
        <Link href="/shop" className="nav-pill hover:text-chalk transition-colors">
          ← Re-enter code
        </Link>

        <div className="mt-6">
          <p className="nav-pill">Verified entry</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
            {heroName}
          </h1>
          <p className="text-ash mt-1">
            {[
              preview.vehicle_year,
              preview.vehicle_make,
              preview.vehicle_model,
              preview.vehicle_color,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          {(preview.vehicle_plate_emirate || preview.vehicle_plate_number) && (
            <div className="mt-3 inline-flex items-center gap-2 bg-iron border border-seam rounded-DEFAULT px-3 py-1.5">
              {preview.vehicle_plate_emirate && (
                <span className="text-xs uppercase tracking-wider text-ash">
                  {preview.vehicle_plate_emirate}
                </span>
              )}
              {preview.vehicle_plate_emirate && preview.vehicle_plate_number && (
                <span className="text-seam">·</span>
              )}
              {preview.vehicle_plate_number && (
                <span className="font-mono text-sm text-chalk">
                  {preview.vehicle_plate_number}
                </span>
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
              defaultValue={preview.vehicle_current_odometer?.toString() ?? ''}
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
