'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_CATEGORIES = new Set(['insurance', 'fleet', 'leasing', 'other'])

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Create a new agent organisation and add the calling user as the
 * first 'owner' member. Goes through the SECURITY DEFINER RPC
 * `create_agent_org` because doing two row-level inserts from the
 * user session hits an RLS chicken-and-egg: the SELECT-after-INSERT
 * on agents requires is_agent_member(id), which is false until the
 * membership row is also inserted.
 */
export async function createAgentOrg(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/agent/start')

  const name = strOrNull(formData.get('name'))
  if (!name) {
    redirect('/agent/start?error=Pick+a+name')
  }

  const categoryRaw = String(formData.get('category') ?? 'insurance')
  const category = ALLOWED_CATEGORIES.has(categoryRaw)
    ? categoryRaw
    : 'insurance'

  const emirate = strOrNull(formData.get('emirate'))
  const phone = strOrNull(formData.get('phone'))
  const next = strOrNull(formData.get('next')) ?? '/agent'

  const { error } = await supabase.rpc('create_agent_org', {
    p_name: name,
    p_category: category,
    p_emirate: emirate,
    p_phone: phone,
  })

  if (error) {
    redirect(
      `/agent/start?error=${encodeURIComponent(friendlyOnboardingError(error.message))}`,
    )
  }

  redirect(next)
}

function friendlyOnboardingError(raw: string): string {
  if (raw.includes('not_authenticated')) return 'Please sign in again.'
  if (raw.includes('invalid_name')) return 'Pick a name.'
  if (raw.includes('invalid_category')) return 'Pick a valid category.'
  if (raw.toLowerCase().includes('duplicate'))
    return 'An organisation with that name already exists. Try a slightly different name.'
  return raw
}
