'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { randomBytes } from 'crypto'
import { createClient } from '@/lib/supabase/server'

function generateToken(): string {
  // 24 bytes → 32 url-safe chars
  return randomBytes(24).toString('base64url')
}

export async function createShareToken(vehicleId: string): Promise<{
  token?: string
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  // Re-use an existing un-revoked, un-expired token if one exists
  const { data: existing } = await supabase
    .from('vehicle_share_tokens')
    .select('token, expires_at, revoked_at')
    .eq('vehicle_id', vehicleId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing && (!existing.expires_at || new Date(existing.expires_at) > new Date())) {
    return { token: existing.token }
  }

  const token = generateToken()
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90) // 90 days

  const { error } = await supabase.from('vehicle_share_tokens').insert({
    vehicle_id: vehicleId,
    token,
    created_by: user.id,
    expires_at: expiresAt.toISOString(),
  })

  if (error) return { error: error.message }
  return { token }
}

export async function revokeShareToken(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const tokenId = String(formData.get('token_id') ?? '')
  const vehicleId = String(formData.get('vehicle_id') ?? '')
  if (!tokenId || !vehicleId) return

  await supabase
    .from('vehicle_share_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', tokenId)

  revalidatePath(`/vehicles/${vehicleId}`)
}
