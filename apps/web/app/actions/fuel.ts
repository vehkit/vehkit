'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/**
 * Log a fuel fill-up. Owner-only — RLS enforces vehicle ownership.
 *
 * Side effect: if odometer_km is provided AND it's higher than the
 * vehicle's current_odometer, we bump the vehicle's odometer too.
 * Customers fill up regularly; this keeps the odometer fresh without
 * forcing a separate "update odometer" flow.
 */
export async function createFuelLog(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicle_id = String(formData.get('vehicle_id') ?? '').trim()
  if (!vehicle_id) {
    redirect('/mycars?error=' + encodeURIComponent('Missing vehicle.'))
  }

  const litersRaw = String(formData.get('liters') ?? '').trim()
  const totalRaw = String(formData.get('total_aed') ?? '').trim()
  const odoRaw = String(formData.get('odometer_km') ?? '').trim()
  const grade = String(formData.get('fuel_grade') ?? '').trim() || null
  const station = String(formData.get('station_name') ?? '').trim() || null
  const notes = String(formData.get('notes') ?? '').trim() || null

  const liters = parseFloat(litersRaw)
  if (!Number.isFinite(liters) || liters <= 0) {
    redirect(
      `/vehicles/${vehicle_id}/fuel/new?error=` +
        encodeURIComponent('Enter litres dispensed.'),
    )
  }
  // NaN guards — parseFloat('abc') is NaN, which would otherwise be
  // inserted into money/odometer columns and poison the bump check.
  const totalParsed = totalRaw ? parseFloat(totalRaw) : NaN
  const total_aed = Number.isFinite(totalParsed) && totalParsed >= 0 ? totalParsed : null
  const odoParsed = odoRaw ? parseInt(odoRaw, 10) : NaN
  const odometer_km =
    Number.isFinite(odoParsed) && odoParsed > 0 && odoParsed < 3_000_000
      ? odoParsed
      : null

  // Insert fuel log
  const { error: insertErr } = await supabase.from('fuel_logs').insert({
    vehicle_id,
    liters,
    total_aed,
    odometer_km,
    fuel_grade: grade,
    station_name: station,
    notes,
    created_by: user.id,
  })
  if (insertErr) {
    redirect(
      `/vehicles/${vehicle_id}/fuel/new?error=` +
        encodeURIComponent(insertErr.message),
    )
  }

  // Bump odometer if newer
  if (odometer_km != null) {
    const { data: v } = await supabase
      .from('vehicles')
      .select('current_odometer')
      .eq('id', vehicle_id)
      .single()
    if (v && (v.current_odometer == null || odometer_km > v.current_odometer)) {
      await supabase
        .from('vehicles')
        .update({ current_odometer: odometer_km })
        .eq('id', vehicle_id)
    }
  }

  revalidatePath(`/vehicles/${vehicle_id}`)
  revalidatePath('/mycars')
  redirect(`/vehicles/${vehicle_id}?logged=fuel`)
}
