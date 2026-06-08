import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_NEXT_PREFIXES = [
  '/mycars',
  '/vehicles',
  '/notifications',
  '/reminders',
  '/profile',
  '/workshop',
  '/workshops',
  '/admin',
  '/agent',
  '/a/',
  '/r/',
  '/shop',
] as const

/**
 * Returns the sanitized next destination, OR null when the input was
 * missing/invalid. Returning null lets the caller decide whether to do
 * role-based detection rather than always defaulting to /mycars (which
 * silently strands workshop owners and agents on the consumer surface).
 */
function sanitizeNext(raw: string | null | undefined): string | null {
  if (!raw) return null
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  if (!ALLOWED_NEXT_PREFIXES.some((p) => raw === p || raw.startsWith(p))) {
    return null
  }
  return raw
}

/**
 * Air gap. When no explicit `next` is set, route the user to whichever
 * portal they actually belong to. Priority:
 *   1. agent_members  → /agent
 *   2. workshop_members → /workshop
 *   3. /mycars (default consumer surface)
 *
 * Multi-role users (a workshop owner who also drives a car) only hit this
 * when they DIDN'T pass an explicit `next` — meaning they typed the
 * domain into the URL bar, used a stale bookmark, or the magic link
 * survived but lost context. In those cases their primary identity
 * (whichever role row exists) wins.
 *
 * If the explicit `next` was set (e.g. `/agent/start` from /agents), we
 * never reach this function.
 */
async function detectPrimaryRoleDestination(userId: string): Promise<string> {
  const supabase = await createClient()
  const [{ data: agentMember }, { data: workshopMember }] = await Promise.all([
    supabase
      .from('agent_members')
      .select('agent_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from('workshop_members')
      .select('workshop_id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle(),
  ])
  if (agentMember) return '/agent'
  if (workshopMember) return '/workshop'
  return '/mycars'
}

type OtpType =
  | 'magiclink'
  | 'signup'
  | 'invite'
  | 'recovery'
  | 'email_change'
  | 'email'

const ALLOWED_OTP_TYPES: ReadonlySet<OtpType> = new Set<OtpType>([
  'magiclink',
  'signup',
  'invite',
  'recovery',
  'email_change',
  'email',
])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  // Two parallel flows are tolerated here:
  //   1. `?code=` — OAuth / older magic-link flow → exchangeCodeForSession
  //      (requires the PKCE verifier cookie set when signInWithOtp ran).
  //   2. `?token_hash=&type=` — Supabase's SSR-recommended magic-link
  //      flow → verifyOtp. NO PKCE verifier needed, so this survives
  //      cross-browser / cross-device magic-link clicks that strand the
  //      code flow.
  // Production should be on token_hash (Email Template uses it). The
  // code branch stays as a fallback for OAuth providers we may add.
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const typeRaw = searchParams.get('type')

  // Read both sources up front so we can clear the cookie regardless of path.
  const c = await cookies()
  const cookieRaw = c.get('vehkit-auth-next')?.value
  const queryRaw = searchParams.get('next')
  // Single-use cookie — clear after read.
  c.set('vehkit-auth-next', '', { path: '/', maxAge: 0 })

  const explicitNext = sanitizeNext(cookieRaw) ?? sanitizeNext(queryRaw)

  if (!code && !tokenHash) {
    // Diagnose the missing-params case. Most common cause is the
    // Supabase email template still using {{ .ConfirmationURL }} (PKCE
    // flow) without the SSR token_hash that our callback expects.
    // Logging the full search params helps support tickets debug
    // template config drift.
    console.error(
      '[auth/callback] missing both code and token_hash. params=',
      Object.fromEntries(searchParams.entries()),
    )
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = await createClient()

  if (tokenHash) {
    const type = (typeRaw ?? 'email') as OtpType
    if (!ALLOWED_OTP_TYPES.has(type)) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent('Unknown OTP type: ' + type)}`,
      )
    }
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    })
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      )
    }
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) {
      return NextResponse.redirect(
        `${origin}/login?error=${encodeURIComponent(error.message)}`,
      )
    }
  }

  // Resolve final destination.
  let destination = explicitNext
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Guard rail: a stale `next=/vehicles/<id>` (from a forwarded share
  // link, a recovered bookmark, or another household's session) will
  // 404 a brand-new user as soon as the redirect lands. Verify the
  // signed-in user can actually read the row before honouring it.
  if (destination && user) {
    const m = destination.match(/^\/vehicles\/([0-9a-f-]{36})(?:[/?#].*)?$/i)
    if (m) {
      const { data: vehicleRow } = await supabase
        .from('vehicles')
        .select('id')
        .eq('id', m[1])
        .maybeSingle()
      if (!vehicleRow) {
        destination = null // fall through to role detection
      }
    }
  }

  if (!destination) {
    // No explicit intent — air gap by role.
    destination = user
      ? await detectPrimaryRoleDestination(user.id)
      : '/mycars'
  }

  return NextResponse.redirect(`${origin}${destination}`)
}
