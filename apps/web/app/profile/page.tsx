import Link from 'next/link'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/app/actions/profile'
import { AvatarUpload } from '@/components/AvatarUpload'
import { ThemeToggle } from '@/components/ThemeToggle'
import { getInitials } from '@/lib/initials'

export const dynamic = 'force-dynamic'

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error
  const savedMsg = sp.saved

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/profile')

  // Read theme cookie for the toggle's initial state
  const cookieStore = await cookies()
  const theme: 'light' | 'dark' =
    cookieStore.get('vehkit-theme')?.value === 'light' ? 'light' : 'dark'

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Count vehicles for member stat
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id, owner_id')
    .eq('owner_id', user.id)

  const ownedCount = vehicles?.length ?? 0
  const initials = getInitials(profile?.full_name, profile?.email ?? user.email)
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-GB', {
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-8 md:pt-10">
        {/* Editorial header */}
        <p className="nav-pill">vehkit · profile</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Your details
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Name and contact info travel with the vehicles you own. Workshops and
          insurance brokers use this to reach you when you share a code.
        </p>

        {/* Garage stat strip */}
        <div className="mt-4 flex items-stretch gap-3">
          <Stat
            value={ownedCount.toString()}
            label={ownedCount === 1 ? 'vehicle' : 'vehicles'}
          />
          {memberSince && (
            <>
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat value={memberSince} label="member since" />
            </>
          )}
        </div>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}
        {savedMsg && (
          <div className="mt-6 bg-volt/10 border border-volt/30 text-volt text-sm px-4 py-3 rounded-DEFAULT">
            Saved
          </div>
        )}

        {/* Identity card */}
        <section className="mt-8 card p-5 flex items-start gap-5">
          <AvatarUpload
            userId={user.id}
            currentUrl={profile?.avatar_url}
            initials={initials}
          />
          <div className="flex-1 min-w-0 pt-1">
            <p className="font-medium text-chalk text-lg truncate">
              {profile?.full_name ?? user.email}
            </p>
            <p className="text-sm text-ash truncate font-mono">
              {profile?.email ?? user.email}
            </p>
            <p className="text-[11px] tracking-widest uppercase text-ash mt-3">
              Tap the photo to change
            </p>
          </div>
        </section>

        {/* Edit form */}
        <section className="mt-8">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Personal
          </h2>
          <form action={updateProfile} className="space-y-4" id="profile-form">
            <Field
              label="Full name"
              name="full_name"
              defaultValue={profile?.full_name ?? ''}
              placeholder="Ameen Ahsan"
            />
            <Field
              label="Phone"
              name="phone"
              type="tel"
              inputMode="tel"
              defaultValue={profile?.phone ?? ''}
              placeholder="+971 50 123 4567"
            />
            <div>
              <label htmlFor="preferred_language" className="label">
                Preferred language
              </label>
              <select
                id="preferred_language"
                name="preferred_language"
                defaultValue={profile?.preferred_language ?? 'en'}
                className="field"
              >
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </div>
          </form>
        </section>

        {/* Appearance */}
        <section className="mt-10">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Appearance
          </h2>
          <div className="card p-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm md:text-base font-semibold text-chalk leading-snug">
                Theme
              </p>
              <p className="text-xs text-ash mt-1 leading-relaxed">
                Vehkit follows your light/dark choice across every device on this
                account.
              </p>
            </div>
            <ThemeToggle initialTheme={theme} />
          </div>
        </section>

        {/* Account actions */}
        <section className="mt-10">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Account
          </h2>
          <div className="card p-5 flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm md:text-base font-semibold text-chalk leading-snug">
                Sign out
              </p>
              <p className="text-xs text-ash mt-1 leading-relaxed">
                You'll need a fresh magic link to come back in.
              </p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="text-xs tracking-widest uppercase text-signal hover:underline shrink-0"
              >
                Sign out
              </button>
            </form>
          </div>
        </section>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href="/mycars" className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            form="profile-form"
            className="pill-primary flex-[2] text-center"
          >
            Save changes
          </button>
        </div>
      </div>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0">
      <p className="text-sm md:text-base font-semibold text-chalk tracking-tight leading-none">
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}

function Field({
  label,
  name,
  type = 'text',
  defaultValue,
  placeholder,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  defaultValue?: string
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
        defaultValue={defaultValue}
        placeholder={placeholder}
        inputMode={inputMode}
        className="field"
      />
    </div>
  )
}
