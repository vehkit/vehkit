/**
 * Reminder calculation — the engine that decides "when is this car next due?"
 * Pure functions. No I/O. Trivially testable.
 */

export interface ServiceInterval {
  km?: number
  months?: number
}

export interface ReminderInput {
  lastServiceDate: Date
  lastServiceOdometer: number
  currentOdometer: number
  averageKmPerDay: number
  interval: ServiceInterval
}

export interface ReminderOutput {
  dueByDate: Date | null
  dueAtKm: number | null
  daysUntilDue: number | null
  kmUntilDue: number | null
  status: 'ok' | 'due_soon' | 'overdue'
}

const DUE_SOON_DAYS = 14
const DUE_SOON_KM = 500

export function computeNextServiceReminder(input: ReminderInput): ReminderOutput {
  const { lastServiceDate, lastServiceOdometer, currentOdometer, averageKmPerDay, interval } = input

  const dueByDate = interval.months
    ? addMonths(lastServiceDate, interval.months)
    : null
  const dueAtKm = interval.km ? lastServiceOdometer + interval.km : null

  const now = new Date()
  const daysUntilDue = dueByDate
    ? Math.floor((dueByDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null
  const kmUntilDue = dueAtKm ? dueAtKm - currentOdometer : null

  // "Whichever comes first" semantics
  let status: ReminderOutput['status'] = 'ok'
  if (
    (daysUntilDue !== null && daysUntilDue < 0) ||
    (kmUntilDue !== null && kmUntilDue < 0)
  ) {
    status = 'overdue'
  } else if (
    (daysUntilDue !== null && daysUntilDue <= DUE_SOON_DAYS) ||
    (kmUntilDue !== null && kmUntilDue <= DUE_SOON_KM)
  ) {
    status = 'due_soon'
  }

  return { dueByDate, dueAtKm, daysUntilDue, kmUntilDue, status }
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date)
  result.setMonth(result.getMonth() + months)
  return result
}

/**
 * Default service intervals — sensible UAE/MENA defaults.
 * Owner can override per vehicle.
 */
export const DEFAULT_INTERVALS: Record<string, ServiceInterval> = {
  oil_change: { km: 10_000, months: 6 },
  tyre_rotation: { km: 10_000 },
  brake_pads: { km: 40_000 },
  battery: { months: 36 },
  major_service: { km: 60_000, months: 24 },
  ac_filter: { months: 12 },
  spark_plugs: { km: 60_000 },
  brake_fluid: { months: 24 },
  coolant: { months: 36 },
}
