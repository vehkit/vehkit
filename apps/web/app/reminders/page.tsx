import { redirect } from 'next/navigation'

/**
 * Legacy redirect — `/reminders` duplicated `/notifications` data.
 * The inbox is now the single canonical surface for reminders, pending
 * workshop entries, and reviews.
 */
export default function RemindersPage() {
  redirect('/notifications')
}
