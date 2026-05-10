import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Daily document-expiry sweep.
 *
 * Runs at 03:00 UTC. Walks vehicle_documents with expires_at <= 30 days
 * out and creates a reminder per doc+due_date (idempotent via unique
 * index — re-runs are safe).
 *
 * Newly-created reminders get picked up by the reminder-digest cron
 * which fires an hour later (04:00 UTC), so the customer gets one
 * morning email covering services AND document renewals.
 *
 * Authenticated by CRON_SECRET — same pattern as reminder-digest.
 */
export async function GET() {
  const h = await headers()

  const auth = h.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc(
    'enqueue_document_expiry_reminders',
  )

  if (error) {
    console.error('[cron] enqueue_document_expiry_reminders failed:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  // RPC returns table (created int) — single row, single column.
  const created = (data as Array<{ created: number }> | null)?.[0]?.created ?? 0

  return Response.json({ created })
}
