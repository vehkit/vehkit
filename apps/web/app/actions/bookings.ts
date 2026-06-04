'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Customer creates a booking request to a workshop.
 * Routes through /w/[slug]/book — workshop slug resolved server-side.
 */
export async function createBookingRequest(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const workshopSlug = strOrNull(formData.get('workshop_slug'))
  if (!workshopSlug) redirect('/workshops')

  // Bounce unauth users to login, then back to the booking form preserved
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/w/${workshopSlug}/book`)}`)
  }

  const serviceCategory = strOrNull(formData.get('service_category'))
  const preferredDate = strOrNull(formData.get('preferred_date'))
  const message = strOrNull(formData.get('message'))
  const contactPhone = strOrNull(formData.get('contact_phone'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))

  if (!serviceCategory) {
    redirect(
      `/w/${workshopSlug}/book?error=${encodeURIComponent('Pick a service category')}`,
    )
  }

  // Resolve workshop_id from slug
  const { data: w } = await supabase
    .from('workshops')
    .select('id, name')
    .eq('slug', workshopSlug)
    .maybeSingle()

  if (!w) redirect('/workshops')

  const { error } = await supabase.from('booking_requests').insert({
    workshop_id: w.id,
    customer_id: user.id,
    vehicle_id: vehicleId,
    service_category: serviceCategory,
    preferred_date: preferredDate,
    message,
    contact_phone: contactPhone,
    status: 'pending',
  })

  if (error) {
    redirect(
      `/w/${workshopSlug}/book?error=${encodeURIComponent(error.message)}`,
    )
  }

  // Customer lands on a confirmation page
  redirect(`/w/${workshopSlug}/book/done`)
}

/**
 * Workshop accepts a booking. Optionally creates a placeholder
 * service_record so the workshop can drive it through the pipeline.
 */
export async function acceptBooking(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const bookingId = strOrNull(formData.get('booking_id'))
  if (!bookingId) redirect('/workshop')

  const note = strOrNull(formData.get('response_note'))

  await supabase
    .from('booking_requests')
    .update({
      status: 'confirmed',
      responded_at: new Date().toISOString(),
      response_note: note,
    })
    .eq('id', bookingId)

  revalidatePath('/workshop')
  redirect('/workshop')
}

/**
 * Workshop declines a booking. Frees up the row so the customer knows.
 */
export async function declineBooking(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const bookingId = strOrNull(formData.get('booking_id'))
  if (!bookingId) redirect('/workshop')

  const note = strOrNull(formData.get('response_note'))

  await supabase
    .from('booking_requests')
    .update({
      status: 'declined',
      responded_at: new Date().toISOString(),
      response_note: note,
    })
    .eq('id', bookingId)

  revalidatePath('/workshop')
  redirect('/workshop')
}

/**
 * Customer cancels their pending booking.
 */
export async function cancelBooking(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const bookingId = strOrNull(formData.get('booking_id'))
  if (!bookingId) redirect('/mycars')

  await supabase
    .from('booking_requests')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('customer_id', user.id)

  revalidatePath('/mycars')
  redirect('/mycars')
}
