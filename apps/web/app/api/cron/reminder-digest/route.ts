import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { emailReminderDigest, type DigestVehicle } from '@/lib/email'
import { humanizeReminderType, reminderStatus, type ReminderRow } from '@/lib/reminders'

type DigestRow = {
  owner_id: string
  owner_email: string
  owner_name: string | null
  vehicle_id: string
  vehicle_name: string
  reminder_id: string
  reminder_type: string
  due_date: string | null
  due_at_km: number | null
  current_odometer: number | null
}

export async function GET() {
  const h = await headers()

  // Verify cron secret — Vercel sends Authorization: Bearer <CRON_SECRET>
  const auth = h.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: rows, error } = await supabase.rpc('due_reminders_for_digest')

  if (error) {
    console.error('[cron] due_reminders_for_digest failed:', error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return Response.json({ sent: 0, message: 'No due reminders' })
  }

  const digestRows = rows as DigestRow[]

  // Group by owner_id, then by vehicle_id
  const byOwner = new Map<
    string,
    {
      email: string
      name: string | null
      vehicles: Map<string, { vehicleName: string; reminders: DigestRow[] }>
    }
  >()

  for (const r of digestRows) {
    let owner = byOwner.get(r.owner_id)
    if (!owner) {
      owner = { email: r.owner_email, name: r.owner_name, vehicles: new Map() }
      byOwner.set(r.owner_id, owner)
    }
    let vehicle = owner.vehicles.get(r.vehicle_id)
    if (!vehicle) {
      vehicle = { vehicleName: r.vehicle_name, reminders: [] }
      owner.vehicles.set(r.vehicle_id, vehicle)
    }
    vehicle.reminders.push(r)
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vehkit.com'
  let sent = 0
  let failed = 0
  const notifiedIds: string[] = []

  for (const [, owner] of byOwner) {
    const digestVehicles: DigestVehicle[] = []
    for (const [vehicleId, v] of owner.vehicles) {
      digestVehicles.push({
        vehicleName: v.vehicleName,
        vehicleId,
        reminders: v.reminders.map((r) => {
          const reminderRow: ReminderRow = {
            id: r.reminder_id,
            vehicle_id: r.vehicle_id,
            reminder_type: r.reminder_type,
            due_date: r.due_date,
            due_at_km: r.due_at_km,
            status: 'open',
            notes: null,
          }
          const status = reminderStatus(reminderRow, r.current_odometer)
          const isOverdue = status === 'overdue'

          let when = ''
          if (r.due_date) {
            const d = new Date(r.due_date)
            when = d.toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          }
          if (r.due_at_km != null && r.current_odometer != null) {
            const remaining = r.due_at_km - r.current_odometer
            const km =
              remaining < 0
                ? `${Math.abs(remaining).toLocaleString()} km overdue`
                : `${remaining.toLocaleString()} km left`
            when = when ? `${when} · ${km}` : km
          }

          return {
            label: humanizeReminderType(r.reminder_type),
            when: when || 'Due',
            isOverdue,
          }
        }),
      })
    }

    const result = await emailReminderDigest({
      to: owner.email,
      ownerName: owner.name,
      vehicles: digestVehicles,
      baseUrl,
    })

    if ('sent' in result && result.sent) {
      sent++
      const ownerIds: string[] = []
      for (const [, v] of owner.vehicles) {
        for (const r of v.reminders) {
          ownerIds.push(r.reminder_id)
        }
      }
      // Mark THIS owner's reminders immediately after their email
      // succeeds. Batching all marks after the loop meant a mid-loop
      // crash re-emailed every already-notified owner on the next run.
      if (ownerIds.length > 0) {
        await supabase.rpc('mark_reminders_notified', {
          p_reminder_ids: ownerIds,
        })
        notifiedIds.push(...ownerIds)
      }
    } else {
      failed++
    }
  }

  return Response.json({
    owners_emailed: sent,
    owners_failed: failed,
    reminders_marked: notifiedIds.length,
  })
}
