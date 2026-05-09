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

export async function updateWorkshop(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/workshop/settings')

  const id = String(formData.get('id') ?? '')
  const name = String(formData.get('name') ?? '').trim()
  const emirate = String(formData.get('emirate') ?? '').trim() || null
  const phone = String(formData.get('phone') ?? '').trim() || null
  const email = String(formData.get('email') ?? '').trim() || null
  const address = String(formData.get('address') ?? '').trim() || null

  if (!id) redirect('/workshop')
  if (!name) {
    redirect('/workshop/settings?error=Workshop+name+is+required')
  }

  // Verify caller is a member (RLS will also enforce this; double-belt is cheap)
  const { data: membership } = await supabase
    .from('workshop_members')
    .select('user_id')
    .eq('workshop_id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (!membership) {
    redirect('/workshop/settings?error=Not+a+member+of+this+workshop')
  }

  const { error } = await supabase
    .from('workshops')
    .update({ name, emirate, phone, email, address })
    .eq('id', id)

  if (error) {
    redirect(`/workshop/settings?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/workshop')
  revalidatePath('/workshop/settings')
  redirect('/workshop/settings?saved=1')
}
