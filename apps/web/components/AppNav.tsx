import { createClient } from '@/lib/supabase/server'
import { AppNavClient } from './AppNavClient'
import { reminderStatus, type ReminderRow } from '@/lib/reminders'

/**
 * Server wrapper for the app navigation. Returns null for unauthenticated
 * users so public pages stay clean.
 */
export async function AppNav() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch profile + notification count in parallel
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [profileRes, vehiclesRes, remindersRes, pendingRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, avatar_url, email')
      .eq('id', user.id)
      .single(),
    supabase.from('vehicles').select('id, current_odometer'),
    supabase
      .from('reminders')
      .select('id, vehicle_id, reminder_type, due_date, due_at_km, status, notes')
      .eq('status', 'open'),
    supabase
      .from('service_records')
      .select('id, vehicle_id, created_at')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo),
  ])

  const vehicles = vehiclesRes.data ?? []
  const reminders = remindersRes.data ?? []
  const pending = pendingRes.data ?? []

  const reminderCount = (reminders as ReminderRow[]).filter((r) => {
    const v = vehicles.find((x) => x.id === r.vehicle_id)
    const s = reminderStatus(r, v?.current_odometer ?? null)
    return s === 'overdue' || s === 'due_soon'
  }).length

  const notificationCount = reminderCount + pending.length

  return (
    <AppNavClient
      avatarUrl={profileRes.data?.avatar_url ?? null}
      fullName={profileRes.data?.full_name ?? null}
      email={profileRes.data?.email ?? user.email ?? ''}
      notificationCount={notificationCount}
    />
  )
}
