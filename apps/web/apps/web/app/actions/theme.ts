'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

export async function setTheme(theme: 'light' | 'dark') {
  const c = await cookies()
  c.set('vehkit-theme', theme, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 year
    sameSite: 'lax',
  })
  // No revalidate — the client component flips the html class instantly,
  // and the cookie just keeps SSR consistent on next page load.
  return { ok: true }
}
