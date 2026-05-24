import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired — must be called for SSR auth to work.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Auth gate for protected routes.
  const path = request.nextUrl.pathname
  const protectedPrefixes = [
    '/mycars',
    '/garage', // legacy — redirects to /mycars but still gates auth
    '/vehicles',
    '/reminders',
    '/notifications',
    '/fleet',
    '/profile',
  ]
  const isWorkshopArea = path.startsWith('/workshop')
  const isPublicWorkshopPath =
    path.startsWith('/workshop/claim') || path.startsWith('/workshop/start')
  const requiresAuth =
    protectedPrefixes.some((p) => path.startsWith(p)) ||
    (isWorkshopArea && !isPublicWorkshopPath)

  if (requiresAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', request.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
