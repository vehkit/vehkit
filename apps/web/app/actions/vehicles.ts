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

export async function updateVehicle(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = strOrNull(formData.get('id'))
  if (!id) redirect('/garage')

  const make = strOrNull(formData.get('make'))
  const model = strOrNull(formData.get('model'))
  if (!make || !model) {
    redirect(`/vehicles/${id}/edit?error=Make+and+model+are+required`)
  }

  const odo = numOrNull(formData.get('current_odometer'))

  const payload = {
    make,
    model,
    year: numOrNull(formData.get('year')),
    plate_number: strOrNull(formData.get('plate_number')),
    plate_emirate: strOrNull(formData.get('plate_emirate')),
    vin: strOrNull(formData.get('vin')),
    nickname: strOrNull(formData.get('nickname')),
    color: strOrNull(formData.get('color')),
    current_odometer: odo,
    ...(odo !== null && { current_odometer_at: new Date().toISOString() }),
  }

  const { error } = await supabase.from('vehicles').update(payload).eq('id', id)

  if (error) {
    redirect(`/vehicles/${id}/edit?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/vehicles/${id}`)
  revalidatePath('/garage')
  redirect(`/vehicles/${id}`)
}

export async function createSampleVehicle() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date()
  const sixMonthsAgo = new Date(today)
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  const threeMonthsAgo = new Date(today)
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3)

  const { data: vehicle, error } = await supabase
    .from('vehicles')
    .insert({
      owner_id: user.id,
      make: 'Toyota',
      model: 'Corolla',
      year: 2022,
      color: 'Pearl White',
      nickname: 'Sample Car',
      plate_number: 'A 12345',
      plate_emirate: 'Dubai',
      current_odometer: 47820,
      current_odometer_at: today.toISOString(),
    })
    .select('id')
    .single()

  if (error || !vehicle) {
    redirect(`/garage?error=${encodeURIComponent(error?.message ?? 'Sample creation failed')}`)
  }

  // Pre-populate with realistic service history
  await supabase.from('service_records').insert([
    {
      vehicle_id: vehicle.id,
      service_type: 'oil_change',
      service_date: sixMonthsAgo.toISOString().slice(0, 10),
      odometer: 38500,
      cost_aed: 320,
      workshop_name_freetext: 'Al Futtaim Toyota',
      notes: 'Mobil 1 5W-30, oil filter replaced',
      attestation: 'workshop',
      created_by: user.id,
    },
    {
      vehicle_id: vehicle.id,
      service_type: 'tyre_change',
      service_date: threeMonthsAgo.toISOString().slice(0, 10),
      odometer: 43200,
      cost_aed: 1450,
      workshop_name_freetext: 'ZDegree Tyre Shop',
      notes: 'Continental ContiPremiumContact 6 · 195/65 R15 · all four',
      attestation: 'workshop',
      created_by: user.id,
    },
    {
      vehicle_id: vehicle.id,
      service_type: 'ac_filter',
      service_date: today.toISOString().slice(0, 10),
      odometer: 47820,
      cost_aed: 180,
      workshop_name_freetext: 'Quick Lube Garage',
      notes: 'Cabin filter + engine air filter replaced',
      attestation: 'owner',
      created_by: user.id,
    },
  ])

  revalidatePath('/garage')
  redirect(`/vehicles/${vehicle.id}`)
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
