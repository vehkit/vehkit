'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
