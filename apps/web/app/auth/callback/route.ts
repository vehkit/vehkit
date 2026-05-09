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
  '/a/',
  '/f/',
  '/r/',
  '/shop',
] as const

function sanitizeNext(raw: string | null | undefined): string {
  if (!raw) return '/mycars'
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/mycars'
  if (!ALLOWED_NEXT_PREFIXES.some((p) => raw === p || raw.startsWith(p))) {
    return '/mycars'
  }
  return raw
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Cookie set by /actions/auth.requestMagicLink — primary source of truth.
  const c = await cookies()
  const cookieNext = c.get('vehkit-auth-next')?.value
  // Fallback: if anything still sends ?next= (older deep links), honor it.
  const queryNext = searchParams.get('next')
  const next = sanitizeNext(cookieNext ?? queryNext ?? '/mycars')

  // Clear the cookie regardless of outcome (single-use).
  c.set('vehkit-auth-next', '', { path: '/', maxAge: 0 })

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(`${origin}/login?error=auth_failed`)
}
