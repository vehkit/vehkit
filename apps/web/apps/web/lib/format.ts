/**
 * Lightweight presentation formatters used across the consumer + workshop UIs.
 * Keep this file pure — no React, no Supabase imports.
 */

/**
 * Convert snake_case / lower_case identifiers to "Title Case" for display.
 *   humanize('oil_change') === 'Oil Change'
 */
export function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Render a date string as a friendly relative phrase.
 *   Today / Yesterday / 3 days ago / 2 weeks ago / 5 months ago
 * Falls back to a localized en-GB date for values >= 1 year old.
 *
 * Diff is computed at start-of-day so "Today" / "Yesterday" feel right
 * regardless of clock time.
 */
export function relativeDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(d)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.floor(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24),
  )

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) {
    const w = Math.floor(diffDays / 7)
    return `${w} ${w === 1 ? 'week' : 'weeks'} ago`
  }
  if (diffDays < 365) {
    const m = Math.floor(diffDays / 30)
    return `${m} ${m === 1 ? 'month' : 'months'} ago`
  }
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
