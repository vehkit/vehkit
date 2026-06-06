import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Force logout.
 *
 * Both verbs supported so the route works:
 *   - POST  — from a <form action="/auth/signout"> button click
 *   - GET   — by typing the URL in the address bar (useful for
 *             nuking a stuck session on the phone)
 *
 * Always redirects to `/` after clearing the session.
 */
async function handle(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), { status: 303 })
}

export const GET = handle
export const POST = handle
