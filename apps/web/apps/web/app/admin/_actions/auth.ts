'use server'

import { redirect } from 'next/navigation'
import { checkCredentials, setAdminCookie, clearAdminCookie } from '../_lib/auth'

export async function adminLogin(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim()
  const password = String(formData.get('password') ?? '')

  if (!checkCredentials(username, password)) {
    redirect('/admin/login?error=Invalid+credentials')
  }

  await setAdminCookie()
  redirect('/admin')
}

export async function adminLogout() {
  await clearAdminCookie()
  redirect('/admin/login')
}
