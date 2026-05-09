'use server'

import { headers } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { generateCode, normalizeCode } from '@/lib/workshop-codes'
import { emailWorkshopEntryToOwner } from '@/lib/email'

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

/**
 * Owner generates a single-use workshop code valid for 1 hour.
 * Uses owner's session — RLS enforces ownership of the vehicle.
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

  // Reuse a still-valid one if present
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

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateCode()
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
 * Workshop redeems a code — calls a SECURITY DEFINER Postgres function
 * that does the entire transaction atomically. No service-role key needed.
 */
export async function logServiceViaCode(formData: FormData) {
  const rawCode = String(formData.get('code') ?? '').trim()
  const code = normalizeCode(rawCode)
  if (!code) redirect('/shop?error=Invalid+code+format')

  const serviceType = String(formData.get('service_type') ?? '').trim()
  const serviceDate = String(formData.get('service_date') ?? '').trim()
  const workshopName = String(formData.get('workshop_name') ?? '').trim()

  if (!serviceType || !serviceDate || !workshopName) {
    redirect(`/shop/${code}?error=Service+type%2C+date+and+workshop+name+are+required`)
  }

  const odoRaw = formData.get('odometer')
  const odometer =
    odoRaw !== null && odoRaw !== '' && Number.isFinite(Number(odoRaw))
      ? Number(odoRaw)
      : null
  const costRaw = formData.get('cost_aed')
  const costAed =
    costRaw !== null && costRaw !== '' && Number.isFinite(Number(costRaw))
      ? Number(costRaw)
      : null
  const notes = String(formData.get('notes') ?? '').trim() || null

  const supabase = await createClient()

  const { data: recordId, error } = await supabase.rpc('redeem_workshop_code', {
    p_code: code,
    p_workshop_name: workshopName,
    p_service_type: serviceType,
    p_service_date: serviceDate,
    p_odometer: odometer,
    p_cost_aed: costAed,
    p_notes: notes,
  })

  if (error || !recordId) {
    redirect(
      `/shop/${code}?error=${encodeURIComponent(error?.message ?? 'Submission failed')}`
    )
  }

  // If the submitter is a signed-in workshop member, attribute the record to
  // their workshop so it counts toward CRM/stats. Verify membership first.
  const workshopIdInput = String(formData.get('workshop_id') ?? '').trim()
  if (workshopIdInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user) {
      const { data: membership } = await supabase
        .from('workshop_members')
        .select('workshop_id')
        .eq('user_id', user.id)
        .eq('workshop_id', workshopIdInput)
        .maybeSingle()
      if (membership) {
        await supabase
          .from('service_records')
          .update({ workshop_id: workshopIdInput })
          .eq('id', recordId)
      }
    }
  }

  // Mark this IP's attempt as successful → doesn't count toward rate limit
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  const ip = xff ? xff.split(',')[0]?.trim() : h.get('x-real-ip')
  if (ip) {
    await supabase.rpc('mark_shop_attempt_success', { p_ip: ip, p_code: code })
  }

  // Notify the vehicle owner by email — fire-and-forget, never blocks the flow
  try {
    const { data: rec } = await supabase
      .from('service_records')
      .select(
        'vehicle_id, service_type, service_date, odometer, cost_aed, vehicles(make, model, nickname, owner_id)'
      )
      .eq('id', recordId)
      .maybeSingle()

    if (rec?.vehicle_id) {
      const v = (Array.isArray(rec.vehicles) ? rec.vehicles[0] : rec.vehicles) as
        | { make: string; model: string; nickname: string | null; owner_id: string }
        | null
      if (v?.owner_id) {
        const { data: owner } = await supabase
          .from('profiles')
          .select('email, full_name')
          .eq('id', v.owner_id)
          .maybeSingle()

        if (owner?.email) {
          const host = h.get('host') ?? 'vehkit.com'
          const proto = h.get('x-forwarded-proto') ?? 'https'
          await emailWorkshopEntryToOwner({
            to: owner.email,
            ownerName: owner.full_name,
            vehicleName: v.nickname ?? `${v.make} ${v.model}`,
            vehicleId: rec.vehicle_id,
            workshopName,
            serviceType,
            serviceDate,
            odometer,
            costAed,
            baseUrl: `${proto}://${host}`,
          })
        }
      }
    }
  } catch (err) {
    console.error('[email] failed to notify owner of new workshop entry:', err)
  }

  // Auto-create reminder for this service type (best-effort, ignore errors)
  const rule = REMINDER_RULES[serviceType]
  if (rule) {
    const dueDate = rule.months
      ? (() => {
          const d = new Date(serviceDate)
          d.setMonth(d.getMonth() + rule.months!)
          return d.toISOString().slice(0, 10)
        })()
      : null
    const dueAtKm = rule.km && odometer !== null ? odometer + rule.km : null

    // We don't have vehicle_id directly; fetch via the new record
    const { data: rec } = await supabase
      .from('service_records')
      .select('vehicle_id')
      .eq('id', recordId)
      .maybeSingle()

    if (rec?.vehicle_id) {
      await supabase
        .from('reminders')
        .update({ status: 'done' })
        .eq('vehicle_id', rec.vehicle_id)
        .eq('reminder_type', rule.reminderType)
        .eq('status', 'open')

      await supabase.from('reminders').insert({
        vehicle_id: rec.vehicle_id,
        reminder_type: rule.reminderType,
        due_date: dueDate,
        due_at_km: dueAtKm,
        status: 'open',
      })

      revalidatePath(`/vehicles/${rec.vehicle_id}`)
    }
  }

  redirect(`/shop/${code}/done`)
}

/**
 * Workshop plants a reminder on a customer vehicle (privacy-gated).
 * Calls workshop_suggest_reminder RPC which validates membership,
 * outreach opt-in, and prior service history.
 */
export async function suggestReminder({
  workshopId,
  vehicleId,
  reminderType,
  dueDate,
  dueAtKm,
  notes,
}: {
  workshopId: string
  vehicleId: string
  reminderType: string
  dueDate: string | null
  dueAtKm: number | null
  notes: string | null
}): Promise<{ ok?: boolean; error?: string }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not signed in' }

  const { error } = await supabase.rpc('workshop_suggest_reminder', {
    p_workshop_id: workshopId,
    p_vehicle_id: vehicleId,
    p_reminder_type: reminderType,
    p_due_date: dueDate,
    p_due_at_km: dueAtKm,
    p_notes: notes,
  })

  if (error) return { error: error.message }

  revalidatePath('/workshop/customers')
  revalidatePath('/workshop')
  return { ok: true }
}
