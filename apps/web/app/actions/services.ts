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

  const { error } = await supabase.from('service_records').insert(payload)
  if (error) {
    redirect(
      `/vehicles/${vehicleId}/service/new?error=${encodeURIComponent(error.message)}`
    )
  }

  // Update the vehicle's current odometer if this entry's reading is higher
  if (odo !== null) {
    await supabase
      .from('vehicles')
      .update({
        current_odometer: odo,
        current_odometer_at: new Date().toISOString(),
      })
      .eq('id', vehicleId)
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/garage')
  redirect(`/vehicles/${vehicleId}`)
}
