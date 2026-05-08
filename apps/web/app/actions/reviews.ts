'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function submitReview(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const recordId = String(formData.get('record_id') ?? '')
  const vehicleId = String(formData.get('vehicle_id') ?? '')
  const rating = Number(formData.get('rating'))
  const comment = String(formData.get('comment') ?? '').trim() || null

  if (!recordId || !vehicleId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirect(`/vehicles/${vehicleId}?error=Invalid+rating`)
  }

  // Look up the service record to get workshop_id
  const { data: record } = await supabase
    .from('service_records')
    .select('id, workshop_id, vehicle_id, attestation')
    .eq('id', recordId)
    .single()

  if (!record || record.attestation !== 'workshop' || !record.workshop_id) {
    redirect(`/vehicles/${vehicleId}?error=Cannot+review+this+entry`)
  }

  // Upsert review (one review per record per user)
  const { error } = await supabase
    .from('workshop_reviews')
    .upsert(
      {
        service_record_id: recordId,
        workshop_id: record.workshop_id,
        vehicle_id: vehicleId,
        rating,
        comment,
        created_by: user.id,
      },
      { onConflict: 'service_record_id,created_by' }
    )

  if (error) {
    redirect(`/vehicles/${vehicleId}?error=${encodeURIComponent(error.message)}`)
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}`)
}
