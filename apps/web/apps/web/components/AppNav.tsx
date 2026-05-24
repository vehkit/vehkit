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
    supabase
      .from('vehicles')
      .select('id, current_odometer, nickname, make, model, plate_number')
      .order('created_at', { ascending: false }),
    supabase
      .from('reminders')
      .select('id, vehicle_id, reminder_type, due_date, due_at_km, status, notes')
      .eq('status', 'open'),
    supabase
      .from('service_records')
      .select('id, vehicle_id, created_at')
      .eq('attestation', 'workshop')
      .gte('created_at', oneDayAgo)
      .is('confirmed_at', null)
      .is('rejected_at', null),
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

  const fabVehicles = (vehicles ?? []).map((v) => ({
    id: v.id as string,
    nickname: (v as { nickname?: string | null }).nickname ?? null,
    make: (v as { make?: string | null }).make ?? null,
    model: (v as { model?: string | null }).model ?? null,
    plate: (v as { plate_number?: string | null }).plate_number ?? null,
  }))

  return (
    <AppNavClient
      avatarUrl={profileRes.data?.avatar_url ?? null}
      fullName={profileRes.data?.full_name ?? null}
      email={profileRes.data?.email ?? user.email ?? ''}
      notificationCount={notificationCount}
      fabVehicles={fabVehicles}
    />
  )
}
