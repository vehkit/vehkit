import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateProfile } from '@/app/actions/profile'
import { AvatarUpload } from '@/components/AvatarUpload'
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
      <div className="max-w-xl mx-auto px-6 pt-10">
        <Link href="/garage" className="nav-pill hover:text-chalk transition-colors">
          ← Garage
        </Link>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-4">
          Profile
        </h1>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}
        {savedMsg && (
          <div className="mt-6 bg-volt/10 border border-volt/30 text-volt text-sm px-4 py-3 rounded-DEFAULT">
            ✓ Saved
          </div>
        )}

        {/* Avatar + identity */}
        <section className="mt-8 flex items-start gap-5">
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
            <p className="text-xs text-ash mt-2">
              {ownedCount} {ownedCount === 1 ? 'vehicle' : 'vehicles'}
              {memberSince && <> · Member since {memberSince}</>}
            </p>
          </div>
        </section>

        {/* Edit form */}
        <form action={updateProfile} className="mt-10 space-y-4" id="profile-form">
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

        {/* Sign out */}
        <section className="mt-16 pt-6 border-t border-seam">
          <form action="/auth/signout" method="post">
            <button className="text-xs tracking-widest uppercase text-signal hover:underline">
              Sign out
            </button>
          </form>
        </section>
      </div>

      {/* Sticky save button */}
      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href="/garage" className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button type="submit" form="profile-form" className="pill-primary flex-[2] text-center">
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
