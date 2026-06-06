'use server'

import { redirect } from 'next/navigation'
import { getAdminSession } from '@/app/admin/_lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'

const ADMIN_HANDLE = 'vecna'

/**
 * Destroy a user and every row of theirs in the public schema.
 *
 * Safety belts:
 *   1. Admin session required (HMAC cookie); fails to /admin/login otherwise.
 *   2. Type-to-confirm: admin must paste the target email — typo-proofing
 *      the destructive button. Mismatch = abort, no RPC call.
 *   3. The deletion itself runs as a single SECURITY DEFINER RPC so the
 *      schema-aware logic lives in the database, not the app — schema
 *      drift only needs to be patched in one place.
 *   4. Every call appended to admin_audit_log with the RPC return value
 *      (deleted email, vehicle count, storage paths). The audit row is
 *      the only thing that survives the nuke.
 */
export async function nukeUserAction(formData: FormData) {
  const isAdmin = await getAdminSession()
  if (!isAdmin) redirect('/admin/login')

  const userId = String(formData.get('userId') ?? '').trim()
  const confirmEmail = String(formData.get('confirmEmail') ?? '')
    .trim()
    .toLowerCase()

  if (!userId) redirect('/admin/users?error=missing_user_id')
  if (!confirmEmail) {
    redirect(`/admin/users/${userId}/preview?error=type+the+email+to+confirm`)
  }

  const supabase = createAdminClient()

  // Lookup the profile to verify the typed email matches.
  const { data: profile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .maybeSingle()

  const actualEmail = ((profile as { email: string | null } | null)?.email ?? '')
    .trim()
    .toLowerCase()

  if (!actualEmail) {
    redirect(`/admin/users/${userId}/preview?error=user+has+no+email+on+file`)
  }
  if (actualEmail !== confirmEmail) {
    redirect(
      `/admin/users/${userId}/preview?error=email+did+not+match+(${encodeURIComponent(actualEmail)})`,
    )
  }

  const { data: result, error } = await supabase.rpc('admin_nuke_user', {
    p_user_id: userId,
  })

  if (error) {
    redirect(
      `/admin/users/${userId}/preview?error=${encodeURIComponent('rpc: ' + error.message)}`,
    )
  }

  // Audit. The user row is gone, so target_user_id is stored as a
  // historical reference. The RPC return value is the receipt.
  await supabase.from('admin_audit_log').insert({
    admin_handle: ADMIN_HANDLE,
    action: 'nuke_user',
    target_table: 'auth.users',
    target_user_id: userId,
    metadata: result ?? {},
  })

  redirect(`/admin/users?nuked=${encodeURIComponent(actualEmail)}`)
}
