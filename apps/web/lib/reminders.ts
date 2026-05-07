/**
 * Pure helpers for reminder display logic.
 * No I/O. Server + client safe.
 */

export type ReminderRow = {
  id: string
  vehicle_id: string
  reminder_type: string
  due_date: string | null
  due_at_km: number | null
  status: string
  notes: string | null
}

export type ReminderStatus = 'overdue' | 'due_soon' | 'ok'

const DUE_SOON_DAYS = 30
const DUE_SOON_KM = 1000

export function reminderStatus(
  reminder: Pick<ReminderRow, 'due_date' | 'due_at_km'>,
  currentOdometer: number | null
): ReminderStatus {
  const now = new Date()
  let daysUntil: number | null = null
  let kmUntil: number | null = null

  if (reminder.due_date) {
    const due = new Date(reminder.due_date)
    daysUntil = Math.floor((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  }
  if (reminder.due_at_km !== null && currentOdometer !== null) {
    kmUntil = reminder.due_at_km - currentOdometer
  }

  if ((daysUntil !== null && daysUntil < 0) || (kmUntil !== null && kmUntil < 0)) {
    return 'overdue'
  }
  if (
    (daysUntil !== null && daysUntil <= DUE_SOON_DAYS) ||
    (kmUntil !== null && kmUntil <= DUE_SOON_KM)
  ) {
    return 'due_soon'
  }
  return 'ok'
}

export function reminderLabel(reminder: ReminderRow, currentOdometer: number | null): string {
  const parts: string[] = []
  if (reminder.due_date) {
    const due = new Date(reminder.due_date)
    parts.push(
      due.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    )
  }
  if (reminder.due_at_km !== null) {
    if (currentOdometer !== null) {
      const remaining = reminder.due_at_km - currentOdometer
      if (remaining <= 0) {
        parts.push(`${Math.abs(remaining).toLocaleString()} km overdue`)
      } else {
        parts.push(`${remaining.toLocaleString()} km`)
      }
    } else {
      parts.push(`@ ${reminder.due_at_km.toLocaleString()} km`)
    }
  }
  return parts.join(' · ')
}

export function humanizeReminderType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
