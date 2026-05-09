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

  // If user is signed in AND is a workshop member, pre-fill + attribute
  let memberWorkshop: { id: string; name: string } | null = null
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    const { data: m } = await supabase
      .from('workshop_members')
      .select('workshop_id, workshops(id, name)')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    const w = (Array.isArray((m as any)?.workshops) ? (m as any).workshops[0] : (m as any)?.workshops) as
      | { id: string; name: string }
      | undefined
    if (w?.id && w?.name) memberWorkshop = w
  }

  // Initials for avatar-style indicator
  const initials = heroName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s.charAt(0).toUpperCase())
    .join('') || '·'

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-6">
        <Link href="/shop" className="nav-pill hover:text-chalk transition-colors">
          ← Re-enter code
        </Link>

        {/* Vehicle preview card — compact, matches /mycars hero typography */}
        <div className="card p-4 mt-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-pill bg-volt/15 text-volt flex items-center justify-center shrink-0 font-mono text-sm font-semibold tracking-tighter">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-[10px] tracking-widest uppercase text-volt font-medium">
                  ✓ Verified entry
                </p>
              </div>
              <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter truncate mt-0.5">
                {heroName}
              </h1>
              <p className="text-xs text-ash truncate mt-0.5">
                {[
                  preview.vehicle_year && String(preview.vehicle_year),
                  `${preview.vehicle_make} ${preview.vehicle_model}`,
                  preview.vehicle_color,
                  preview.vehicle_plate_emirate && preview.vehicle_plate_number
                    ? `${preview.vehicle_plate_emirate} · ${preview.vehicle_plate_number}`
                    : preview.vehicle_plate_number,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-seam flex items-center justify-between text-[11px]">
            <span className="text-ash">
              Expires in <span className="font-mono text-chalk">{expiresMin}m</span>
            </span>
            <span className="text-ash tracking-widest uppercase">Single use</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {/* Tab divider — matches /vehicles/[id] and /w/[slug] section pattern */}
        <div className="mt-6 border-t border-seam">
          <div className="flex justify-center">
            <div className="px-4 py-3 -mt-px border-t-2 border-chalk text-xs tracking-widest uppercase text-chalk font-medium">
              Log service
            </div>
          </div>
        </div>

        <form
          action={logServiceViaCode}
          encType="multipart/form-data"
          className="mt-4 space-y-4"
          id="shop-form"
        >
          <input type="hidden" name="code" value={code} />
          {memberWorkshop && (
            <input type="hidden" name="workshop_id" value={memberWorkshop.id} />
          )}

          {memberWorkshop ? (
            <div>
              <label className="label">Workshop</label>
              <div className="card px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-chalk truncate">{memberWorkshop.name}</p>
                  <p className="text-[11px] text-ash mt-0.5">
                    Signed in — entry will count toward your dashboard
                  </p>
                </div>
                <span className="text-[10px] tracking-widest uppercase text-volt">
                  ✓ Verified
                </span>
              </div>
              <input
                type="hidden"
                name="workshop_name"
                value={memberWorkshop.name}
              />
            </div>
          ) : (
            <Field
              label="Workshop name"
              name="workshop_name"
              placeholder="Al Quoz Auto Care"
              required
              hint="Will appear on the customer's record."
            />
          )}

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

          {/* Photos — optional, multiple. Best-effort upload on the server.
              Anonymous (non-member) submissions can't persist photos due to
              RLS on service_files; the form still accepts them so the UX
              stays consistent. */}
          <div>
            <label htmlFor="photos" className="label">
              Photos <span className="text-ash/70">(optional)</span>
            </label>
            <input
              id="photos"
              name="photos"
              type="file"
              accept="image/*"
              multiple
              className="field file:mr-3 file:py-1.5 file:px-3 file:rounded-pill file:border-0 file:bg-iron file:text-chalk file:text-xs file:tracking-widest file:uppercase file:font-medium hover:file:bg-iron/70 file:cursor-pointer"
            />
            <p className="text-[11px] text-ash/70 mt-1.5 leading-relaxed">
              {memberWorkshop
                ? 'Receipts, before/after, parts replaced — anything that makes the entry richer.'
                : 'Sign in as a workshop member to attach photos.'}
            </p>
          </div>

          <p className="text-[11px] text-ash/80 leading-relaxed pt-1">
            Submitting marks this as <span className="text-volt">✓ Verified by workshop</span> on
            the customer's record.
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
