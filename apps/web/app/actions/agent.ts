'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { generateCode, normalizeCode } from '@/lib/workshop-codes'

/**
 * Owner generates a 60-minute one-time code for an insurance agent (or
 * any partner agent). The agent enters it at /a/<code> while signed
 * into their agent account → produces a 1-hour full-access grant +
 * 30-day metadata-only window.
 */
export async function generateAgentCode(vehicleId: string): Promise<{
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
    .from('agent_codes')
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
    const { data: expiresAt, error } = await supabase.rpc('create_agent_code', {
      p_vehicle_id: vehicleId,
      p_code: candidate,
      p_minutes: 60,
    })
    if (!error && expiresAt) {
      return { code: candidate, expiresAt: String(expiresAt) }
    }
    // Continue retrying on collision; surface other errors immediately
    if (error && !error.message.toLowerCase().includes('duplicate')) {
      return { error: error.message }
    }
  }
  return { error: 'Could not generate a unique code' }
}

/**
 * Agent member redeems a code → creates a grant and redirects to view.
 */
export async function redeemAgentCode(formData: FormData) {
  const rawCode = String(formData.get('code') ?? '').trim()
  const code = normalizeCode(rawCode)
  if (!code) redirect('/agent/redeem?error=Invalid+code+format')

  const agentIdInput = String(formData.get('agent_id') ?? '').trim()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/agent/redeem?code=${code}`)}`)
  }

  let agentId = agentIdInput
  // If the agent didn't pass an explicit org, try the first one they belong to.
  if (!agentId) {
    const { data: membership } = await supabase
      .from('agent_members')
      .select('agent_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (!membership) {
      redirect('/agent/start?next=' + encodeURIComponent(`/agent/redeem?code=${code}`))
    }
    agentId = membership.agent_id
  }

  const { data: grantId, error } = await supabase.rpc('redeem_agent_code', {
    p_code: code,
    p_agent_id: agentId,
    p_full_minutes: 60,
    p_meta_days: 30,
  })

  if (error || !grantId) {
    const msg = friendlyRedeemError(error?.message ?? 'Redemption failed')
    redirect(`/agent/redeem?error=${encodeURIComponent(msg)}`)
  }

  // Mark the IP attempt so rate limiting can deprioritise successful flows.
  const h = await headers()
  const xff = h.get('x-forwarded-for')
  const ip = xff ? xff.split(',')[0]?.trim() : h.get('x-real-ip')
  if (ip) {
    // Reuse the workshop attempt-tracking RPC if it accepts arbitrary
    // codes; otherwise a no-op. Best-effort.
    try {
      await supabase.rpc('mark_shop_attempt_success', {
        p_ip: ip,
        p_code: code,
      })
    } catch {
      // ignore — separate rate-limit table may live behind workshops only
    }
  }

  revalidatePath('/agent')
  redirect(`/agent/grant/${grantId}`)
}

/**
 * Owner panic-button — revokes ALL non-revoked agent grants on a vehicle in
 * one go. Useful when the customer suspects misuse, sold the car, or just
 * wants to cut the agent off cleanly. Idempotent.
 */
export async function revokeAllAgentGrants(formData: FormData) {
  const vehicleId = String(formData.get('vehicle_id') ?? '').trim()
  if (!vehicleId) redirect('/mycars')

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Defense in depth — RLS also enforces this, but bail early
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('owner_id')
    .eq('id', vehicleId)
    .single()
  if (!vehicle || vehicle.owner_id !== user.id) {
    redirect(`/vehicles/${vehicleId}?error=Not+allowed`)
  }

  await supabase
    .from('agent_grants')
    .update({ revoked_at: new Date().toISOString() })
    .eq('vehicle_id', vehicleId)
    .is('revoked_at', null)

  revalidatePath(`/vehicles/${vehicleId}`)
  revalidatePath(`/vehicles/${vehicleId}/edit`)
  redirect(`/vehicles/${vehicleId}/edit?revoked=1`)
}

/**
 * Translate the structured exception codes from redeem_agent_code into
 * user-friendly copy. Mirrors the approach in services.ts confirm/reject.
 */
function friendlyRedeemError(raw: string): string {
  const r = raw.toLowerCase()
  if (r.includes('not_authenticated')) return 'Please sign in again.'
  if (r.includes('not_agent_member'))
    return 'You are not a member of this agent organisation.'
  if (r.includes('agent_not_verified'))
    return "Your agent desk isn't verified yet. Upload your trade licence in Settings — once Vehkit reviews it, you'll be able to redeem customer codes."
  if (r.includes('code_not_found'))
    return 'That code does not exist or has expired.'
  if (r.includes('code_already_used'))
    return 'That code has already been redeemed.'
  if (r.includes('code_expired')) return 'That code has expired.'
  return raw
}
