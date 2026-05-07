'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

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

function generate6DigitCode(): string {
  // Pad to 6 digits — always 100000–999999
  return String(100000 + Math.floor(Math.random() * 900000))
}

/**
 * Owner generates a single-use workshop code valid for 1 hour.
 * Re-uses an existing un-used un-expired code if one exists.
 */
export async function generateWorkshopCode(vehicleId: string): Promise<{
  code?: string
  expiresAt?: string
  error?: string
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  // Reuse if there's a still-valid one
  const { data: existing } = await supabase
    .from('workshop_codes')
    .select('code, expires_at')
    .eq('vehicle_id', vehicleId)
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { code: existing.code, expiresAt: existing.expires_at }
  }

  // Generate (retry on collision)
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generate6DigitCode()
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60).toISOString()
    const { error } = await supabase.from('workshop_codes').insert({
      vehicle_id: vehicleId,
      code: candidate,
      created_by: user.id,
      expires_at: expiresAt,
    })
    if (!error) {
      return { code: candidate, expiresAt }
    }
  }

  return { error: 'Could not generate a unique code, retry.' }
}

/**
 * Workshop redeems a code and submits a verified service entry.
 * Public — uses admin client.
 */
export async function logServiceViaCode(formData: FormData) {
  const code = String(formData.get('code') ?? '').trim()
  if (!code) redirect('/shop?error=Code+required')

  const admin = createAdminClient()

  const { data: codeRow } = await admin
    .from('workshop_codes')
    .select('id, vehicle_id, expires_at, used_at, created_by')
    .eq('code', code)
    .maybeSingle()

  if (!codeRow) redirect('/shop?error=Invalid+code')
  if (codeRow.used_at) redirect('/shop?error=Code+already+used')
  if (new Date(codeRow.expires_at) < new Date()) {
    redirect('/shop?error=Code+expired')
  }

  const serviceType = String(formData.get('service_type') ?? '').trim()
  const serviceDate = String(formData.get('service_date') ?? '').trim()
  const workshopName = String(formData.get('workshop_name') ?? '').trim()

  if (!serviceType || !serviceDate || !workshopName) {
    redirect(`/shop/${code}?error=Service+type%2C+date+and+workshop+name+are+required`)
  }

  const odoRaw = formData.get('odometer')
  const odometer =
    odoRaw !== null && odoRaw !== '' && Number.isFinite(Number(odoRaw)) ? Number(odoRaw) : null
  const costRaw = formData.get('cost_aed')
  const costAed =
    costRaw !== null && costRaw !== '' && Number.isFinite(Number(costRaw))
      ? Number(costRaw)
      : null

  // Insert service record (workshop attestation)
  const { data: record, error } = await admin
    .from('service_records')
    .insert({
      vehicle_id: codeRow.vehicle_id,
      service_type: serviceType,
      service_date: serviceDate,
      odometer,
      cost_aed: costAed,
      workshop_name_freetext: workshopName,
      notes: String(formData.get('notes') ?? '').trim() || null,
      attestation: 'workshop',
      created_by: codeRow.created_by,
    })
    .select('id')
    .single()

  if (error) {
    redirect(`/shop/${code}?error=${encodeURIComponent(error.message)}`)
  }

  // Mark code as used
  await admin
    .from('workshop_codes')
    .update({
      used_at: new Date().toISOString(),
      used_by_workshop_name: workshopName,
      used_for_record_id: record!.id,
    })
    .eq('id', codeRow.id)

  // Update vehicle odometer
  if (odometer !== null) {
    await admin
      .from('vehicles')
      .update({
        current_odometer: odometer,
        current_odometer_at: new Date().toISOString(),
      })
      .eq('id', codeRow.vehicle_id)
  }

  // Auto-create / update reminders for this service type
  const rule = REMINDER_RULES[serviceType]
  if (rule) {
    const dueDate = rule.months ? addMonths(new Date(serviceDate), rule.months) : null
    const dueAtKm = rule.km && odometer !== null ? odometer + rule.km : null

    await admin
      .from('reminders')
      .update({ status: 'done' })
      .eq('vehicle_id', codeRow.vehicle_id)
      .eq('reminder_type', rule.reminderType)
      .eq('status', 'open')

    await admin.from('reminders').insert({
      vehicle_id: codeRow.vehicle_id,
      reminder_type: rule.reminderType,
      due_date: dueDate ? dueDate.toISOString().slice(0, 10) : null,
      due_at_km: dueAtKm,
      status: 'open',
    })
  }

  revalidatePath(`/vehicles/${codeRow.vehicle_id}`)
  redirect(`/shop/${code}/done`)
}
