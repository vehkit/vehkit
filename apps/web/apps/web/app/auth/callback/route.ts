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
  '/fleet',
  '/admin',
  '/agent',
  '/a/',
  '/f/',
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

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Read both sources up front so we can clear the cookie regardless of path.
  const c = await cookies()
  const cookieRaw = c.get('vehkit-auth-next')?.value
  const queryRaw = searchParams.get('next')
  // Single-use cookie — clear after read.
  c.set('vehkit-auth-next', '', { path: '/', maxAge: 0 })

  // Sanitize each source independently. Cookie takes priority because it's
  // httpOnly and harder to spoof; falls back to the URL param (which now
  // carries the value across device hops).
  const explicitNext = sanitizeNext(cookieRaw) ?? sanitizeNext(queryRaw)

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)
  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    )
  }

  // Resolve final destination.
  let destination = explicitNext
  if (!destination) {
    // No explicit intent — air gap by role.
    const {
      data: { user },
    } = await supabase.auth.getUser()
    destination = user
      ? await detectPrimaryRoleDestination(user.id)
      : '/mycars'
  }

  return NextResponse.redirect(`${origin}${destination}`)
}
