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
  if (!code) redirect('/a?error=Invalid+code+format')

  const agentIdInput = String(formData.get('agent_id') ?? '').trim()

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/a?code=${code}`)}`)
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
      redirect('/agent/start?next=' + encodeURIComponent(`/a?code=${code}`))
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
    redirect(
      `/a?error=${encodeURIComponent(error?.message ?? 'Redemption failed')}`,
    )
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
