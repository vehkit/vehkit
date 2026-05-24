import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { acceptFleetInvite } from '@/app/actions/fleet'

export const dynamic = 'force-dynamic'

type InvitePreview = {
  org_id: string
  org_name: string
  org_emirate: string | null
  role: 'admin' | 'member' | 'viewer'
  expires_at: string
  used_at: string | null
  inviter_email: string | null
}

export default async function AcceptFleetInvitePage({
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
  const { data: rows, error } = await supabase.rpc('preview_fleet_invite', {
    p_token: token,
  })

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

  async function accept() {
    'use server'
    return acceptFleetInvite(token)
  }

  const roleLabel =
    preview.role === 'admin'
      ? 'Admin · full management'
      : preview.role === 'member'
        ? 'Member · add own vehicles, log services'
        : 'Viewer · read-only'

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>

        <div className="card p-6 mt-8">
          <p className="nav-pill text-[10px]">You've been invited to a fleet</p>
          <h1 className="text-2xl font-semibold text-chalk tracking-tighter mt-3">
            {preview.org_name}
          </h1>
          {preview.org_emirate && (
            <p className="text-sm text-ash mt-1">{preview.org_emirate}</p>
          )}
          <div className="mt-5 pt-5 border-t border-seam space-y-2">
            <Row label="Role" value={roleLabel} />
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
              Join fleet
            </button>
          </form>
        ) : (
          <div className="mt-6 space-y-2">
            <Link
              href={`/login?next=${encodeURIComponent(`/f/${token}`)}`}
              className="pill-primary block text-center"
            >
              Sign in to join
            </Link>
            <p className="text-xs text-ash/60 text-center">
              No Vehkit account yet? Sign in with the link above to create one.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm gap-3">
      <span className="text-ash">{label}</span>
      <span className="text-chalk font-medium text-right">{value}</span>
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
