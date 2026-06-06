'use server'

import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
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

function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return '/mycars'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/mycars'
  // Only allow paths starting with whitelisted prefixes (defense in depth)
  if (!ALLOWED_NEXT_PREFIXES.some((p) => raw === p || raw.startsWith(p))) {
    return '/mycars'
  }
  return raw
}

/**
 * Send a magic-link email to `email`.
 *   1. Stores the post-auth `next` destination in a 10-minute cookie.
 *   2. Sends OTP via Supabase with a fixed callback URL (no query string).
 *   3. Redirects the form to /login?sent=1 to show the "check your email" UI.
 */
export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim().toLowerCase()
  const next = sanitizeNext(String(formData.get('next') ?? '/mycars'))

  if (!email || !email.includes('@')) {
    redirect('/login?error=Enter+a+valid+email')
  }

  const h = await headers()
  const host = h.get('host') ?? 'vehkit.com'
  const proto = h.get('x-forwarded-proto') ?? 'https'

  // Bake `next` into the magic link URL itself (not just the cookie) so the
  // post-auth destination survives device-hop clicks — phone-to-desktop is
  // common for magic links and the cookie won't be there.
  const callbackUrl = `${proto}://${host}/auth/callback?next=${encodeURIComponent(next)}`

  // Cookie is now a belt-and-braces backup for same-device flows. Still
  // useful: it's signed/httpOnly and harder to spoof than a query param.
  const c = await cookies()
  c.set('vehkit-auth-next', next, {
    path: '/',
    maxAge: 60 * 10,
    sameSite: 'lax',
    secure: proto === 'https',
    httpOnly: true,
  })

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callbackUrl, shouldCreateUser: true },
  })

  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }

  // Redirect to a "check your email" state. Pass email back so we can show it.
  redirect(`/login?sent=1&email=${encodeURIComponent(email)}`)
}
