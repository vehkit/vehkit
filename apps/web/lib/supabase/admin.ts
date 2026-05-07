/**
 * Service-role Supabase client. SERVER ONLY.
 *
 * Bypasses RLS. Never import this into a Client Component, never expose
 * its results to the browser without manual permission checks.
 *
 * Used for: public share routes (/r/[token]), admin tasks, edge functions.
 */

import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
