'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { emailFleetInvite } from '@/lib/email'

type FleetRole = 'admin' | 'member' | 'viewer'

export async function createFleetOrg(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/fleet')

  const name = String(formData.get('name') ?? '').trim()
  const emirate = String(formData.get('emirate') ?? '').trim() || null
  if (!name) redirect('/fleet?error=Name+required')

  const { data: orgId, error } = await supabase.rpc('create_fleet_org', {
    p_name: name,
    p_emirate: emirate,
  })

  if (error || !orgId) {
    redirect(`/fleet?error=${encodeURIComponent(error?.message ?? 'Could not create')}`)
  }

  // Look up the slug for the redirect
  const { data: org } = await supabase
    .from('fleet_orgs')
    .select('slug')
    .eq('id', orgId)
    .single()

  revalidatePath('/fleet')
  redirect(org ? `/fleet/${org.slug}` : '/fleet')
}

export async function assignVehicleToFleet(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicleId = String(formData.get('vehicle_id') ?? '')
  const orgId = String(formData.get('org_id') ?? '')
  const slug = String(formData.get('org_slug') ?? '')

  if (!vehicleId || !orgId) {
    redirect(slug ? `/fleet/${slug}?error=Missing+ids` : '/fleet')
  }

  // Verify ownership
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('owner_id')
    .eq('id', vehicleId)
    .single()
  if (!vehicle || vehicle.owner_id !== user.id) {
    redirect(`/fleet/${slug}?error=Not+the+vehicle+owner`)
  }

  const { error } = await supabase
    .from('vehicles')
    .update({ fleet_org_id: orgId })
    .eq('id', vehicleId)

  if (error) {
    redirect(`/fleet/${slug}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/fleet/${slug}`)
  revalidatePath('/garage')
  redirect(`/fleet/${slug}`)
}

export async function createFleetInvite(
  orgId: string,
  role: FleetRole,
  email?: string
): Promise<{ token?: string; error?: string; emailSent?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { data: token, error } = await supabase.rpc('create_fleet_invite', {
    p_org_id: orgId,
    p_role: role,
    p_email: email ?? null,
  })

  if (error) return { error: error.message }

  let emailSent = false

  if (email && token) {
    try {
      const [orgRes, profileRes] = await Promise.all([
        supabase.from('fleet_orgs').select('name').eq('id', orgId).maybeSingle(),
        supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .maybeSingle(),
      ])

      const o = orgRes.data
      const p = profileRes.data

      if (o) {
        const h = await headers()
        const host = h.get('host') ?? 'vehkit.com'
        const proto = h.get('x-forwarded-proto') ?? 'https'

        const result = await emailFleetInvite({
          to: email,
          inviterName: p?.full_name ?? null,
          inviterEmail: p?.email ?? user.email ?? '',
          orgName: o.name,
          role,
          token: token as string,
          baseUrl: `${proto}://${host}`,
        })

        emailSent = !!('sent' in result && result.sent)
      }
    } catch (err) {
      console.error('[email] fleet invite send failed:', err)
    }
  }

  return { token: token as string, emailSent }
}

export async function acceptFleetInvite(token: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/f/${token}`)}`)
  }

  const { data: orgId, error } = await supabase.rpc('accept_fleet_invite', {
    p_token: token,
  })

  if (error || !orgId) {
    redirect(`/f/${token}?error=${encodeURIComponent(error?.message ?? 'Accept failed')}`)
  }

  // Look up slug for redirect
  const { data: org } = await supabase
    .from('fleet_orgs')
    .select('slug')
    .eq('id', orgId)
    .single()

  revalidatePath('/fleet')
  redirect(org ? `/fleet/${org.slug}` : '/fleet')
}

export async function removeVehicleFromFleet(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicleId = String(formData.get('vehicle_id') ?? '')
  const slug = String(formData.get('org_slug') ?? '')
  if (!vehicleId) redirect(slug ? `/fleet/${slug}` : '/fleet')

  // Only the vehicle owner can remove from fleet
  await supabase
    .from('vehicles')
    .update({ fleet_org_id: null })
    .eq('id', vehicleId)
    .eq('owner_id', user.id)

  revalidatePath(`/fleet/${slug}`)
  redirect(`/fleet/${slug}`)
}
