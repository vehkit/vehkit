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

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

/**
 * Snooze a reminder forward by N days and/or N km.
 * Form fields: id, snooze_days, snooze_km, vehicle_id (for redirect)
 */
export async function snoozeReminder(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  const days = numOrNull(formData.get('snooze_days')) ?? 7
  const km = numOrNull(formData.get('snooze_km'))

  if (!id) redirect(vehicleId ? `/vehicles/${vehicleId}` : '/notifications')

  const { data: existing } = await supabase
    .from('reminders')
    .select('due_date, due_at_km')
    .eq('id', id)
    .maybeSingle()

  if (!existing) redirect(vehicleId ? `/vehicles/${vehicleId}` : '/notifications')

  const newDueDate = existing.due_date
    ? addDays(new Date(existing.due_date), days).toISOString().slice(0, 10)
    : addDays(new Date(), days).toISOString().slice(0, 10)

  const newDueAtKm =
    km !== null
      ? (existing.due_at_km ?? 0) + km
      : existing.due_at_km

  await supabase
    .from('reminders')
    .update({
      due_date: newDueDate,
      due_at_km: newDueAtKm,
      notified_at: null, // reset so digest re-evaluates
    })
    .eq('id', id)

  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/notifications')
  revalidatePath('/reminders')
  redirect(vehicleId ? `/vehicles/${vehicleId}` : '/notifications')
}

/**
 * Mark a reminder as done (manually). Cleaner than delete for audit trail.
 */
export async function completeReminder(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!id) redirect(vehicleId ? `/vehicles/${vehicleId}` : '/notifications')

  await supabase.from('reminders').update({ status: 'done' }).eq('id', id)

  if (vehicleId) revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/notifications')
  revalidatePath('/reminders')
  redirect(vehicleId ? `/vehicles/${vehicleId}` : '/notifications')
}

/**
 * Owner manually creates a custom reminder (not auto-generated from a service).
 */
export async function createReminder(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicleId = strOrNull(formData.get('vehicle_id'))
  const reminderType = strOrNull(formData.get('reminder_type'))
  const dueDate = strOrNull(formData.get('due_date'))
  const dueAtKm = numOrNull(formData.get('due_at_km'))
  const notes = strOrNull(formData.get('notes'))

  if (!vehicleId) redirect('/garage')
  if (!reminderType) {
    redirect(`/vehicles/${vehicleId}/reminders/new?error=Type+required`)
  }
  if (!dueDate && dueAtKm === null) {
    redirect(`/vehicles/${vehicleId}/reminders/new?error=Either+date+or+km+required`)
  }

  const { error } = await supabase.from('reminders').insert({
    vehicle_id: vehicleId,
    reminder_type: reminderType,
    due_date: dueDate,
    due_at_km: dueAtKm,
    notes,
    status: 'open',
  })

  if (error) {
    redirect(
      `/vehicles/${vehicleId}/reminders/new?error=${encodeURIComponent(error.message)}`
    )
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath('/reminders')
  revalidatePath('/notifications')
  redirect(`/vehicles/${vehicleId}`)
}
