'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function createFamilyInvite(
  vehicleId: string,
  accessLevel: 'view' | 'add_record' | 'full',
  email?: string
): Promise<{ token?: string; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: token, error } = await supabase.rpc('create_family_invite', {
    p_vehicle_id: vehicleId,
    p_access_level: accessLevel,
    p_email: email ?? null,
  })

  if (error) return { error: error.message }
  return { token: token as string }
}

export async function acceptFamilyInvite(token: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/a/${token}`)}`)
  }

  const { data: vehicleId, error } = await supabase.rpc('accept_family_invite', {
    p_token: token,
  })

  if (error || !vehicleId) {
    redirect(`/a/${token}?error=${encodeURIComponent(error?.message ?? 'Accept failed')}`)
  }

  revalidatePath('/garage')
  redirect(`/vehicles/${vehicleId}`)
}
