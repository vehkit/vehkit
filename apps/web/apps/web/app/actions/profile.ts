'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateProfile(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const fullName = String(formData.get('full_name') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const language = String(formData.get('preferred_language') ?? 'en').trim()

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: fullName,
      phone,
      preferred_language: language === 'ar' ? 'ar' : 'en',
    })
    .eq('id', user.id)

  if (error) {
    redirect(`/profile?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/profile')
  revalidatePath('/garage')
  redirect('/profile?saved=1')
}

export async function updateAvatar(userId: string, avatarUrl: string | null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user || user.id !== userId) return { error: 'Not authorized' }

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId)

  revalidatePath('/profile')
  revalidatePath('/garage')
  return { error: error?.message ?? null }
}
