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
  revalidatePath('/mycars')
  revalidatePath('/notifications')
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
 *
 * Calls a SECURITY DEFINER RPC because the standard owner_updates_own_records
 * RLS policy excludes workshop attestations (by design — owners shouldn't
 * mutate workshop fields directly). The RPC validates ownership server-side
 * and writes only confirmed_at.
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

  const { error } = await supabase.rpc('confirm_service_record', {
    p_record_id: id,
  })

  if (error) {
    const msg = friendlyDecisionError(error.message, 'confirm')
    redirect(`/vehicles/${vehicleId}?error=${encodeURIComponent(msg)}`)
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

/**
 * Owner retracts (soft-rejects) a pending workshop entry.
 *
 * Soft-retract: we DON'T delete the row — the RPC sets rejected_at. The
 * record stays so:
 *   1. We preserve the audit trail (workshop attempted to log this)
 *   2. The owner can immediately leave a workshop review explaining why
 *      (workshop_reviews.service_record_id is NOT NULL — needs the row)
 *
 * Redirects with ?review=<id> to auto-open the review form, mirroring
 * the confirm flow. Either action — confirm or retract — closes with
 * the same review prompt.
 */
export async function retractServiceRecord(formData: FormData) {
  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!id || !vehicleId) redirect('/mycars')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase.rpc('reject_service_record', {
    p_record_id: id,
  })

  if (error) {
    const msg = friendlyDecisionError(error.message, 'reject')
    redirect(`/vehicles/${vehicleId}?error=${encodeURIComponent(msg)}`)
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/notifications')
  redirect(`/vehicles/${vehicleId}?review=${id}#review-${id}`)
}

/**
 * Translate the structured exception codes from the decision RPCs into
 * user-friendly copy. The DB raises stable strings like 'not_vehicle_owner'
 * which we map here so the UI doesn't leak SQL error chatter.
 */
function friendlyDecisionError(
  raw: string,
  verb: 'confirm' | 'reject',
): string {
  if (raw.includes('not_authenticated')) return 'Please sign in again.'
  if (raw.includes('record_not_found')) return 'That entry no longer exists.'
  if (raw.includes('not_vehicle_owner')) {
    return verb === 'confirm'
      ? 'Only the vehicle owner can confirm entries.'
      : 'Only the vehicle owner can reject entries.'
  }
  if (raw.includes('not_workshop_record')) {
    return 'This entry is not a workshop submission.'
  }
  if (raw.includes('already_confirmed')) {
    return 'This entry has already been confirmed and can no longer be rejected.'
  }
  return `${verb === 'confirm' ? 'Confirm' : 'Reject'} failed: ${raw}`
}
