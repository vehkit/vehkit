/**
 * Odometer fraud detection — your trust moat.
 *
 * If the car's odometer reading on a later date is LOWER than on an earlier date,
 * the record has been tampered with (or there's a clerical error worth flagging).
 *
 * Run this on every new service_records insert in a server-side check.
 */

export interface OdometerReading {
  date: Date
  odometer: number
  source: 'owner' | 'workshop' | 'inspection' | 'receipt'
}

export type FraudFlag =
  | { kind: 'rollback'; from: OdometerReading; to: OdometerReading; deltaKm: number }
  | { kind: 'impossible_growth'; from: OdometerReading; to: OdometerReading; kmPerDay: number }
  | { kind: 'duplicate_date_conflict'; readings: OdometerReading[] }

const MAX_REASONABLE_KM_PER_DAY = 1500 // ~Dubai-Muscat-Dubai daily round trip ceiling

export function detectOdometerAnomalies(readings: OdometerReading[]): FraudFlag[] {
  const sorted = [...readings].sort((a, b) => a.date.getTime() - b.date.getTime())
  const flags: FraudFlag[] = []

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (!prev || !curr) continue

    // Rollback — later date, lower odo
    if (curr.odometer < prev.odometer) {
      flags.push({
        kind: 'rollback',
        from: prev,
        to: curr,
        deltaKm: prev.odometer - curr.odometer,
      })
      continue
    }

    // Impossible growth — too many km in too few days
    const daysBetween = Math.max(
      1,
      (curr.date.getTime() - prev.date.getTime()) / (1000 * 60 * 60 * 24)
    )
    const kmPerDay = (curr.odometer - prev.odometer) / daysBetween
    if (kmPerDay > MAX_REASONABLE_KM_PER_DAY) {
      flags.push({ kind: 'impossible_growth', from: prev, to: curr, kmPerDay })
    }
  }

  // Duplicate-date conflicts
  const byDay = new Map<string, OdometerReading[]>()
  for (const r of sorted) {
    const key = r.date.toISOString().slice(0, 10)
    const arr = byDay.get(key) ?? []
    arr.push(r)
    byDay.set(key, arr)
  }
  for (const arr of byDay.values()) {
    if (arr.length > 1) {
      const min = Math.min(...arr.map((r) => r.odometer))
      const max = Math.max(...arr.map((r) => r.odometer))
      if (max - min > 200) {
        flags.push({ kind: 'duplicate_date_conflict', readings: arr })
      }
    }
  }

  return flags
}
