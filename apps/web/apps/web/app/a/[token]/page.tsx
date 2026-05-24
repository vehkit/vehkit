import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { acceptFamilyInvite } from '@/app/actions/family'

export const dynamic = 'force-dynamic'

type InvitePreview = {
  vehicle_id: string
  access_level: 'view' | 'add_record' | 'full'
  expires_at: string
  used_at: string | null
  vehicle_make: string
  vehicle_model: string
  vehicle_nickname: string | null
  vehicle_year: number | null
  inviter_email: string | null
}

export default async function AcceptInvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { token } = await params
  const sp = await searchParams
  const errorMsg = sp.error

  const supabase = await createClient()

  // Preview is public via SECURITY DEFINER function
  const { data: rows, error } = await supabase.rpc('preview_family_invite', { p_token: token })

  if (error || !rows || rows.length === 0) {
    return <BadInvite reason="Invite link is invalid or doesn't exist." />
  }

  const preview = rows[0] as InvitePreview

  if (preview.used_at) {
    return <BadInvite reason="This invite has already been used." />
  }
  if (new Date(preview.expires_at) < new Date()) {
    return <BadInvite reason="This invite link has expired." />
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Form action for accepting (must be a server function inside the file)
  async function accept() {
    'use server'
    return acceptFamilyInvite(token)
  }

  const heroName =
    preview.vehicle_nickname ?? `${preview.vehicle_make} ${preview.vehicle_model}`

  const accessLabel =
    preview.access_level === 'full'
      ? 'Full access'
      : preview.access_level === 'add_record'
        ? 'Can add service records'
        : 'View-only access'

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>

        <div className="card p-6 mt-8">
          <p className="nav-pill text-[10px]">You've been invited</p>
          <h1 className="text-2xl font-semibold text-chalk tracking-tighter mt-3">
            {heroName}
          </h1>
          <p className="text-sm text-ash mt-1">
            {[preview.vehicle_year, preview.vehicle_make, preview.vehicle_model]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <div className="mt-5 pt-5 border-t border-seam space-y-2">
            <Row label="Access" value={accessLabel} />
            <Row
              label="Expires"
              value={new Date(preview.expires_at).toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })}
            />
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        {user ? (
          <form action={accept} className="mt-6">
            <button type="submit" className="pill-primary w-full">
              Accept invite
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/a/${token}`)}`}
              className="pill-primary block text-center"
            >
              Sign in to accept
            </Link>
            <p className="text-xs text-ash/60 text-center">
              Don't have a Vehkit account? Sign in with the link above to create one — same magic
              link flow.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-ash">{label}</span>
      <span className="text-chalk font-medium">{value}</span>
    </div>
  )
}

function BadInvite({ reason }: { reason: string }) {
  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-pill bg-signal/15 border border-signal/40 mx-auto flex items-center justify-center">
          <span className="text-signal text-3xl">×</span>
        </div>
        <h1 className="text-2xl font-semibold text-chalk tracking-tighter mt-6">
          Invite unavailable
        </h1>
        <p className="text-sm text-ash mt-3">{reason}</p>
        <Link href="/" className="pill-ghost block mt-8 text-center text-sm">
          Back to Vehkit
        </Link>
      </div>
    </main>
  )
}
