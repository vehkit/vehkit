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
 * Workshop marks a service as in-progress.
 * Only workshop members for this workshop can do this — RLS via the
 * service_records update policy.
 */
export async function markServiceInProgress(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const recordId = strOrNull(formData.get('record_id'))
  if (!recordId) redirect('/workshop')

  await supabase
    .from('service_records')
    .update({
      status: 'in_progress',
      started_at: new Date().toISOString(),
    })
    .eq('id', recordId)

  revalidatePath('/workshop')
  redirect('/workshop')
}

/**
 * Workshop marks a service as done.
 *
 * This is the moment the customer becomes eligible to rate — we set
 * rating_requested_at so the customer-side UI can highlight the prompt.
 *
 * In a future iteration, this is where we'd fire an email + push
 * notification to the customer. For now the prompt surfaces on next
 * /mycars or /vehicles/[id] load.
 */
export async function markServiceDone(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const recordId = strOrNull(formData.get('record_id'))
  if (!recordId) redirect('/workshop')

  const now = new Date().toISOString()
  await supabase
    .from('service_records')
    .update({
      status: 'done',
      completed_at: now,
      rating_requested_at: now,
    })
    .eq('id', recordId)

  revalidatePath('/workshop')
  // TODO: send rating email via Resend — add a row to a notification queue
  // table once the customer rating flow is fully baked.

  redirect('/workshop')
}
