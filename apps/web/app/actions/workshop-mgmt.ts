'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function claimWorkshop(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const name = String(formData.get('name') ?? '').trim()
  const emirate = String(formData.get('emirate') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const email = String(formData.get('email') ?? '').trim() || null

  if (!name) {
    redirect('/workshop/claim?error=Workshop+name+is+required')
  }

  const { data: workshopId, error } = await supabase.rpc('claim_workshop', {
    p_name: name,
    p_emirate: emirate,
    p_phone: phone,
    p_email: email,
  })

  if (error || !workshopId) {
    redirect(
      `/workshop/claim?error=${encodeURIComponent(error?.message ?? 'Claim failed')}&name=${encodeURIComponent(name)}`
    )
  }

  revalidatePath('/workshop')
  redirect('/workshop')
}
