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
 * Slugify a name into a URL-safe handle. Append a short random suffix to
 * collide-proof the result without a fancy uniqueness loop.
 */
function makeSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  const suffix = Math.random().toString(36).slice(2, 6)
  return `${base || 'agent'}-${suffix}`
}

/**
 * Create a new agent organisation and add the calling user as the
 * first member with role='owner'. Both INSERTs go through the RLS
 * policies declared in the agents schema migration.
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

  const { data: agent, error: agentErr } = await supabase
    .from('agents')
    .insert({
      name,
      slug: makeSlug(name),
      category,
      emirate,
      phone,
    })
    .select('id')
    .single()

  if (agentErr || !agent) {
    redirect(
      `/agent/start?error=${encodeURIComponent(agentErr?.message ?? 'Could not create agent')}`,
    )
  }

  const { error: memErr } = await supabase.from('agent_members').insert({
    agent_id: agent.id,
    user_id: user.id,
    role: 'owner',
  })

  if (memErr) {
    redirect(
      `/agent/start?error=${encodeURIComponent(`Created org but member insert failed: ${memErr.message}`)}`,
    )
  }

  redirect(next)
}
