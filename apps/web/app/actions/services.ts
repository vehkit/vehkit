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

// Mirror DEFAULT_INTERVALS from packages/lib (kept inline to avoid edge-runtime import drama)
const REMINDER_RULES: Record<
  string,
  { km?: number; months?: number; reminderType: string }
> = {
  oil_change: { km: 10_000, months: 6, reminderType: 'oil_change' },
  tyre_rotation: { km: 10_000, reminderType: 'tyres' },
  brake_pads: { km: 40_000, reminderType: 'brake_pads' },
  battery: { months: 36, reminderType: 'battery' },
  major_service: { km: 60_000, months: 24, reminderType: 'major_service' },
  ac_filter: { months: 12, reminderType: 'ac_filter' },
  spark_plugs: { km: 60_000, reminderType: 'spark_plugs' },
  brake_fluid: { months: 24, reminderType: 'brake_fluid' },
  coolant: { months: 36, reminderType: 'coolant' },
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date)
  d.setMonth(d.getMonth() + months)
  return d
}

export async function createServiceRecord(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicleId = strOrNull(formData.get('vehicle_id'))
  const serviceType = strOrNull(formData.get('service_type'))
  const serviceDate = strOrNull(formData.get('service_date'))

  if (!vehicleId) redirect('/garage')
  if (!serviceType || !serviceDate) {
    redirect(`/vehicles/${vehicleId}/service/new?error=Service+type+and+date+are+required`)
  }

  const odo = numOrNull(formData.get('odometer'))

  const payload = {
    vehicle_id: vehicleId,
    service_type: serviceType,
    service_date: serviceDate,
    odometer: odo,
    cost_aed: numOrNull(formData.get('cost_aed')),
    workshop_name_freetext: strOrNull(formData.get('workshop_name')),
    notes: strOrNull(formData.get('notes')),
    attestation: 'owner' as const,
    created_by: user.id,
  }

  const { data: record, error } = await supabase
    .from('service_records')
    .insert(payload)
    .select('id')
    .single()

  if (error) {
    redirect(
      `/vehicles/${vehicleId}/service/new?error=${encodeURIComponent(error.message)}`
    )
  }

  // Optional multi-photo upload
  const photos = formData.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0)
  for (const [i, photo] of photos.entries()) {
    const ext = photo.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `vehicles/${vehicleId}/services/${record!.id}/${Date.now()}-${i}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('service-files')
      .upload(path, photo, { contentType: photo.type })

    if (upErr) continue

    const {
      data: { publicUrl },
    } = supabase.storage.from('service-files').getPublicUrl(path)

    await supabase.from('service_files').insert({
      service_record_id: record!.id,
      vehicle_id: vehicleId,
      storage_path: publicUrl,
      file_type: photo.type,
      file_size_bytes: photo.size,
      uploaded_by: user.id,
    })
  }

  // Update vehicle odometer
  if (odo !== null) {
    await supabase
      .from('vehicles')
      .update({
        current_odometer: odo,
        current_odometer_at: new Date().toISOString(),
      })
      .eq('id', vehicleId)
  }

  // Auto-create reminder if this service type has a default interval
  const rule = REMINDER_RULES[serviceType]
  if (rule) {
    const dueDate = rule.months ? addMonths(new Date(serviceDate), rule.months) : null
    const dueAtKm = rule.km && odo !== null ? odo + rule.km : null

    // Mark any existing open reminders of this type as done (we just serviced it)
    await supabase
      .from('reminders')
      .update({ status: 'done' })
      .eq('vehicle_id', vehicleId)
      .eq('reminder_type', rule.reminderType)
      .eq('status', 'open')

    await supabase.from('reminders').insert({
      vehicle_id: vehicleId,
      reminder_type: rule.reminderType,
      due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      due_at_km: dueAtKm,
      status: 'open',
    })
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/garage')
  revalidatePath('/reminders')
  redirect(`/vehicles/${vehicleId}`)
}

export async function updateServiceRecord(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!id || !vehicleId) redirect('/garage')

  const serviceType = strOrNull(formData.get('service_type'))
  const serviceDate = strOrNull(formData.get('service_date'))
  if (!serviceType || !serviceDate) {
    redirect(
      `/vehicles/${vehicleId}/service/${id}/edit?error=Service+type+and+date+are+required`
    )
  }

  const odo = numOrNull(formData.get('odometer'))

  const { error } = await supabase
    .from('service_records')
    .update({
      service_type: serviceType,
      service_date: serviceDate,
      odometer: odo,
      cost_aed: numOrNull(formData.get('cost_aed')),
      workshop_name_freetext: strOrNull(formData.get('workshop_name')),
      notes: strOrNull(formData.get('notes')),
    })
    .eq('id', id)

  if (error) {
    redirect(
      `/vehicles/${vehicleId}/service/${id}/edit?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}`)
}

/**
 * Owner confirms a workshop entry early — locks it before the 24h window
 * and immediately routes back to the vehicle page with a query param that
 * auto-opens the review form. Zero-friction trust loop close.
 */
export async function confirmServiceRecord(formData: FormData) {
  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!id || !vehicleId) redirect('/mycars')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify the user owns this vehicle (defense in depth — RLS also blocks)
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('owner_id')
    .eq('id', vehicleId)
    .single()
  if (!vehicle || vehicle.owner_id !== user.id) {
    redirect(`/vehicles/${vehicleId}?error=Not+allowed`)
  }

  const { error } = await supabase
    .from('service_records')
    .update({ confirmed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('vehicle_id', vehicleId)

  if (error) {
    redirect(
      `/vehicles/${vehicleId}?error=${encodeURIComponent(`Confirm failed: ${error.message}`)}`
    )
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/notifications')
  // Pass review=id to auto-open the rate-this-workshop form
  redirect(`/vehicles/${vehicleId}?review=${id}#review-${id}`)
}

export async function deleteServiceRecord(formData: FormData) {
  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!id || !vehicleId) redirect('/garage')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('service_records').delete().eq('id', id)

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}`)
}
