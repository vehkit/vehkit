import Link from 'next/link'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { TradeLicenseUpload } from '@/components/TradeLicenseUpload'
import { WorkshopHeroUpload } from '@/components/WorkshopHeroUpload'
import { updateWorkshop, setWorkshopUnlisted } from '@/app/actions/workshop-mgmt'
import { EMIRATES } from '@vehkit/types'

export const dynamic = 'force-dynamic'

export default async function WorkshopSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error
  const saved = sp.saved === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/workshop/settings')

  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id, role')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership?.workshop_id) redirect('/workshop/claim')

  const { data: workshop } = await supabase
    .from('workshops')
    .select('*')
    .eq('id', membership.workshop_id)
    .single()
  if (!workshop) redirect('/workshop/claim')

  const h = await headers()
  const host = h.get('host') ?? 'vehkit.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'
  const profileUrl = `${proto}://${host}/w/${workshop.slug}`

  const tierLabel =
    workshop.verification_tier === 'gold'
      ? 'Gold Verified'
      : workshop.verification_tier === 'silver'
        ? 'Silver Verified'
        : 'Unverified'

  return (
    <main className="max-w-3xl mx-auto px-6 pt-6 pb-12">
      <header>
        <p className="text-[10px] tracking-widest uppercase text-ash">Workshop · Settings</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-1">
          Settings
        </h1>
        <p className="text-sm text-ash mt-0.5">Edit how your workshop appears to customers.</p>
      </header>

      {saved && (
        <div className="mt-4 bg-volt/10 border border-volt/30 text-volt text-sm px-4 py-3 rounded-DEFAULT">
          Saved.
        </div>
      )}
      {errorMsg && (
        <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
          {decodeURIComponent(errorMsg)}
        </div>
      )}

      {/* Profile preview link */}
      <section className="card p-5 mt-6 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] tracking-widest uppercase text-ash">Public profile</p>
          <p className="text-sm font-mono text-volt mt-1 truncate">{profileUrl}</p>
          <p className="text-[10px] text-ash mt-1">
            What customers see when they click your name in the directory.
          </p>
        </div>
        <Link
          href={`/w/${workshop.slug}`}
          target="_blank"
          rel="noopener"
          className="pill-outline text-sm whitespace-nowrap"
        >
          View as customer →
        </Link>
      </section>

      {/* Editable info */}
      <section className="mt-6">
        <h2 className="text-xs tracking-widest uppercase text-ash mb-3">Workshop info</h2>
        <form action={updateWorkshop} className="card p-5 space-y-4">
          <input type="hidden" name="id" value={workshop.id} />

          <Field
            label="Workshop name"
            name="name"
            defaultValue={workshop.name}
            required
            hint="Shown on customer records and in the directory."
          />

          <div>
            <label htmlFor="emirate" className="label">
              Emirate
            </label>
            <select
              id="emirate"
              name="emirate"
              defaultValue={workshop.emirate ?? ''}
              className="field"
            >
              <option value="">—</option>
              {EMIRATES.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field
              label="Phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={workshop.phone ?? ''}
              placeholder="+971 4 123 4567"
            />
            <Field
              label="Email"
              name="email"
              type="email"
              inputMode="email"
              defaultValue={workshop.email ?? ''}
              placeholder="hello@yourshop.ae"
            />
          </div>

          <Field
            label="Address"
            name="address"
            defaultValue={workshop.address ?? ''}
            placeholder="Street + landmark, e.g. Al Quoz Industrial Area 4"
          />

          <button type="submit" className="pill-primary text-sm w-full md:w-auto">
            Save changes
          </button>
        </form>
      </section>

      {/* Trade license + verification */}
      <section className="mt-6">
        <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
          Verification · {tierLabel}
        </h2>
        <TradeLicenseUpload
          workshopId={workshop.id}
          hasLicense={!!workshop.trade_license_url}
          currentTier={workshop.verification_tier}
        />
      </section>

      {/* Hero photo — appears on /workshops directory and /w/[slug] profile */}
      <section className="mt-6">
        <h2 className="text-xs tracking-widest uppercase text-ash mb-3">
          Directory photo
        </h2>
        <WorkshopHeroUpload
          workshopId={workshop.id}
          currentUrl={workshop.hero_image_url ?? null}
        />
      </section>

      {/* Public listing visibility — workshop opts in/out of the public
          directory + landing page surfaces. Operational flows (verifying
          service records for existing customers) are unaffected. */}
      <section className="card p-5 mt-6">
        <p className="text-[10px] tracking-widest uppercase text-ash">
          Public listing
        </p>
        <div className="mt-2 flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-chalk leading-relaxed">
              {workshop.is_unlisted
                ? 'Hidden from the public directory and landing page.'
                : 'Listed on the public directory and the landing page.'}
            </p>
            <p className="text-xs text-ash mt-1.5 leading-relaxed">
              Either way, you can keep verifying customer service records and
              your existing customers see your name on their history.
            </p>
          </div>
          <form action={setWorkshopUnlisted}>
            <input type="hidden" name="id" value={workshop.id} />
            <input
              type="hidden"
              name="unlisted"
              value={workshop.is_unlisted ? '0' : '1'}
            />
            <button
              type="submit"
              className={
                workshop.is_unlisted
                  ? 'pill-primary text-sm whitespace-nowrap'
                  : 'pill-ghost text-sm whitespace-nowrap'
              }
            >
              {workshop.is_unlisted ? 'Re-list publicly' : 'Hide from public'}
            </button>
          </form>
        </div>
      </section>

      {/* How customers find you */}
      <section className="card p-5 mt-6">
        <p className="text-[10px] tracking-widest uppercase text-ash">How customers reach you</p>
        <p className="text-sm text-chalk mt-2 leading-relaxed">
          When a customer hands you a 6-digit code, enter it at{' '}
          <Link href="/shop" className="text-volt underline">
            vehkit.com/shop
          </Link>
          .
        </p>
        <p className="text-xs text-ash mt-3 leading-relaxed">
          Tip: pin <span className="font-mono text-chalk">vehkit.com/shop</span> to your
          phone home screen for one-tap access.
        </p>
      </section>

      {/* Sign out */}
      <section className="mt-10 pt-6 border-t border-seam flex items-center justify-between">
        <p className="text-xs text-ash">
          Signed in as <span className="text-chalk font-mono">{user.email}</span>
        </p>
        <form action="/auth/signout" method="post">
          <button className="text-xs tracking-widest uppercase text-signal hover:underline">
            Sign out
          </button>
        </form>
      </section>
    </main>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  required,
  placeholder,
  inputMode,
  hint,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
  required?: boolean
  placeholder?: string
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
        defaultValue={defaultValue ?? ''}
        required={required}
        placeholder={placeholder}
        inputMode={inputMode}
        className="field"
      />
      {hint && <p className="text-[11px] text-ash mt-1.5">{hint}</p>}
    </div>
  )
}
