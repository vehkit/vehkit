import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { claimWorkshop } from '@/app/actions/workshop-mgmt'
import { EMIRATES } from '@vehkit/types'

export default async function ClaimWorkshopPage({
  searchParams,
}: {
  searchParams: Promise<{ name?: string; error?: string }>
}) {
  const sp = await searchParams
  const presetName = sp.name ? decodeURIComponent(sp.name) : ''
  const errorMsg = sp.error

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // If signed in already and has a workshop, send straight to dashboard
  if (user) {
    const { data: existingMembership } = await supabase
      .from('workshop_members')
      .select('workshop_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (existingMembership) {
      redirect('/workshop')
    }
  }

  // Not signed in — send to /login with next= back to here, preserving the name
  if (!user) {
    const nextUrl = `/workshop/claim${presetName ? `?name=${encodeURIComponent(presetName)}` : ''}`
    redirect(`/login?next=${encodeURIComponent(nextUrl)}`)
  }

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-10">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>
        <div className="mt-6">
          <p className="nav-pill">Claim your workshop</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
            {presetName || 'Set up your workshop'}
          </h1>
          <p className="text-ash mt-2 leading-relaxed">
            Two minutes. After this, every entry logged under your name auto-links to your
            workshop, and you'll get a dashboard.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={claimWorkshop} className="mt-8 space-y-4" id="claim-form">
          <Field
            label="Workshop name"
            name="name"
            required
            defaultValue={presetName}
            placeholder="Al Quoz Auto Care"
          />

          <div>
            <label htmlFor="emirate" className="label">
              Emirate
            </label>
            <select id="emirate" name="emirate" defaultValue="" className="field">
              <option value="">—</option>
              {EMIRATES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <Field
            label="Workshop phone"
            name="phone"
            type="tel"
            inputMode="tel"
            placeholder="+971 4 123 4567"
          />
          <Field
            label="Workshop email"
            name="email"
            type="email"
            inputMode="email"
            placeholder="hello@yourshop.ae"
          />

          <p className="text-xs text-ash leading-relaxed pt-2">
            You'll be the workshop owner. You can invite mechanics and add a trade license later
            for the verified workshop badge.
          </p>
        </form>
      </div>

      <div className="fixed bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0">
        <div className="max-w-xl mx-auto">
          <button
            type="submit"
            form="claim-form"
            className="pill-primary block text-center w-full"
          >
            Claim workshop
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
  placeholder,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
  placeholder?: string
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
        placeholder={placeholder}
        className="field"
      />
    </div>
  )
}
