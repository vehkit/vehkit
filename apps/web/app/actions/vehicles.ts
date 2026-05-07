'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  if (v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function createVehicle(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const make = strOrNull(formData.get('make'))
  const model = strOrNull(formData.get('model'))
  if (!make || !model) {
    redirect('/vehicles/new?error=Make+and+model+are+required')
  }

  const odo = numOrNull(formData.get('current_odometer'))

  const payload = {
    owner_id: user.id,
    make,
    model,
    year: numOrNull(formData.get('year')),
    plate_number: strOrNull(formData.get('plate_number')),
    plate_emirate: strOrNull(formData.get('plate_emirate')),
    vin: strOrNull(formData.get('vin')),
    nickname: strOrNull(formData.get('nickname')),
    color: strOrNull(formData.get('color')),
    current_odometer: odo,
    current_odometer_at: odo !== null ? new Date().toISOString() : null,
  }

  const { data, error } = await supabase
    .from('vehicles')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    redirect(`/vehicles/new?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath('/garage')
  redirect(`/vehicles/${data!.id}`)
}

export async function deleteVehicle(formData: FormData) {
  const id = strOrNull(formData.get('id'))
  if (!id) redirect('/garage')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('vehicles').delete().eq('id', id)
  revalidatePath('/garage')
  redirect('/garage')
}

export async function updateVehicleHero(vehicleId: string, imageUrl: string | null) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase
    .from('vehicles')
    .update({ hero_image_url: imageUrl })
    .eq('id', vehicleId)

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/garage')
  return { error: error?.message ?? null }
}
