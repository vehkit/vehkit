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

  // Optional axes — empty string from form means not rated
  function axisOrNull(key: string): number | null {
    const raw = formData.get(key)
    if (raw == null) return null
    const s = String(raw).trim()
    if (s === '' || s === '0') return null
    const n = Number(s)
    if (!Number.isFinite(n) || n < 1 || n > 5) return null
    return n
  }
  const qualityRating = axisOrNull('quality_rating')
  const valueRating = axisOrNull('value_rating')
  const timelinessRating = axisOrNull('timeliness_rating')

  if (!recordId || !vehicleId || !Number.isFinite(rating) || rating < 1 || rating > 5) {
    redirect(`/vehicles/${vehicleId}?error=Invalid+rating`)
  }

  // Look up the service record. workshop_id may be null when the record
  // was logged for a freetext workshop (walk-in shop with no Vehkit
  // org). The review still attaches via service_record_id; it just
  // doesn't roll up to a specific workshop's aggregate score.
  const { data: record } = await supabase
    .from('service_records')
    .select('id, workshop_id, vehicle_id, attestation')
    .eq('id', recordId)
    .single()

  if (!record || record.attestation !== 'workshop') {
    redirect(`/vehicles/${vehicleId}?error=Cannot+review+this+entry`)
  }

  // Upsert review (one review per record per user)
  const { error } = await supabase
    .from('workshop_reviews')
    .upsert(
      {
        service_record_id: recordId,
        workshop_id: record.workshop_id, // may be null — schema allows it
        vehicle_id: vehicleId,
        rating,
        quality_rating: qualityRating,
        value_rating: valueRating,
        timeliness_rating: timelinessRating,
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
