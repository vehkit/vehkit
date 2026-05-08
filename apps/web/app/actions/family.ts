'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { emailFamilyInvite } from '@/lib/email'

const ACCESS_LABELS: Record<'view' | 'add_record' | 'full', string> = {
  view: 'View only',
  add_record: 'Can add records',
  full: 'Full access',
}

export async function createFamilyInvite(
  vehicleId: string,
  accessLevel: 'view' | 'add_record' | 'full',
  email?: string
): Promise<{ token?: string; error?: string; emailSent?: boolean }> {
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

  let emailSent = false

  // If invitee email provided, fire the email
  if (email && token) {
    try {
      // Look up vehicle name + inviter profile for personalization
      const [vehicleRes, profileRes] = await Promise.all([
        supabase
          .from('vehicles')
          .select('make, model, nickname')
          .eq('id', vehicleId)
          .maybeSingle(),
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle(),
      ])

      const v = vehicleRes.data
      const p = profileRes.data

      if (v) {
        const h = await headers()
        const host = h.get('host') ?? 'vehkit.com'
        const proto = h.get('x-forwarded-proto') ?? 'https'

        const result = await emailFamilyInvite({
          to: email,
          inviterName: p?.full_name ?? null,
          inviterEmail: p?.email ?? user.email ?? '',
          vehicleName: v.nickname ?? `${v.make} ${v.model}`,
          accessLabel: ACCESS_LABELS[accessLevel],
          token: token as string,
          baseUrl: `${proto}://${host}`,
        })

        emailSent = !!('sent' in result && result.sent)
      }
    } catch (err) {
      console.error('[email] family invite send failed:', err)
    }
  }

  return { token: token as string, emailSent }
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
