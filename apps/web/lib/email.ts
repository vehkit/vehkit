import { Resend } from 'resend'

/**
 * Server-only Resend client. Lazy — won't throw at import time if the
 * env var is missing. Calls to send() return a swallowed error so a
 * failed email never breaks the user-facing flow.
 */

let cachedClient: Resend | null = null

function getClient(): Resend | null {
  if (cachedClient) return cachedClient
  const key = process.env.RESEND_API_KEY
  if (!key) return null
  cachedClient = new Resend(key)
  return cachedClient
}

const FROM = process.env.RESEND_FROM ?? 'Vehkit <hello@vehkit.com>'

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtDate(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Notify a vehicle owner that a workshop just logged a verified entry.
 * 24-hour retract window emphasized.
 */
export async function emailWorkshopEntryToOwner(args: {
  to: string
  ownerName?: string | null
  vehicleName: string
  vehicleId: string
  workshopName: string
  serviceType: string
  serviceDate: string
  odometer?: number | null
  costAed?: number | null
  baseUrl: string
}) {
  const client = getClient()
  if (!client) {
    console.warn('[email] RESEND_API_KEY not set; skipping')
    return { skipped: true }
  }

  const stat = [
    fmtDate(args.serviceDate),
    args.odometer ? `${args.odometer.toLocaleString()} km` : null,
    args.costAed ? `AED ${args.costAed.toLocaleString()}` : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const greeting = args.ownerName ? `${args.ownerName.split(' ')[0]},` : ''

  const html = `
<div style="background:#0A0B0F;color:#F4F4F2;padding:40px 20px;font-family:-apple-system,system-ui,sans-serif;">
  <div style="max-width:480px;margin:0 auto;">
    <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8B8E96;margin:0;">vehkit</p>
    <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;margin:16px 0 8px;">
      New verified entry on your ${escapeHtml(args.vehicleName)}
    </h1>
    ${greeting ? `<p style="color:#8B8E96;margin:0 0 16px;">${escapeHtml(greeting)}</p>` : ''}
    <p style="color:#8B8E96;line-height:1.6;margin:0 0 16px;">
      <strong style="color:#F4F4F2;">${escapeHtml(args.workshopName)}</strong> just logged a service on your car:
    </p>
    <div style="background:#16181D;border:1px solid #2A2D33;border-left:4px solid #19E68C;border-radius:8px;padding:16px 20px;margin:20px 0;">
      <p style="font-weight:600;margin:0;font-size:16px;">${escapeHtml(humanize(args.serviceType))}</p>
      <p style="color:#8B8E96;font-size:13px;margin:6px 0 0;">${escapeHtml(stat)}</p>
    </div>
    <p style="color:#F4F4F2;line-height:1.6;margin:0 0 24px;">
      You have <strong style="color:#E5C158;">24 hours to retract this entry</strong> if it's incorrect. After that, it becomes permanent on your car's record.
    </p>
    <a href="${args.baseUrl}/vehicles/${args.vehicleId}" style="display:inline-block;background:#19E68C;color:#0A0B0F;padding:14px 28px;border-radius:999px;font-weight:600;text-decoration:none;">
      Review entry
    </a>
    <p style="color:#8B8E96;font-size:12px;margin:32px 0 0;line-height:1.5;">
      Sent because someone used your Vehkit workshop code on this vehicle. If this wasn't authorized, retract immediately and avoid sharing your code with strangers.
    </p>
    <p style="color:#5B6573;font-size:11px;margin-top:40px;letter-spacing:0.1em;text-transform:uppercase;">
      Every car deserves a passport.
    </p>
  </div>
</div>`.trim()

  try {
    const result = await client.emails.send({
      from: FROM,
      to: [args.to],
      subject: `New verified entry on your ${args.vehicleName}`,
      html,
    })
    return { sent: true, id: result.data?.id ?? null }
  } catch (err) {
    console.error('[email] workshop-entry send failed:', err)
    return { error: String(err) }
  }
}

// Family-invite and fleet-invite emails removed. Both features were
// retired in the June 2026 cleanup pass when the underlying tables
// (family_invites, fleet_orgs/members/invites) were dropped. Sharing
// is now handled by the agent grant flow (/agent/redeem).

/**
 * Reminder digest — daily email to owners whose vehicles have due/overdue
 * reminders. Grouped by vehicle.
 */
export type DigestVehicle = {
  vehicleName: string
  vehicleId: string
  reminders: {
    label: string
    when: string
    isOverdue: boolean
  }[]
}

export async function emailReminderDigest(args: {
  to: string
  ownerName?: string | null
  vehicles: DigestVehicle[]
  baseUrl: string
}) {
  const client = getClient()
  if (!client) return { skipped: true }

  const greeting = args.ownerName?.split(' ')[0] ?? 'there'
  const totalReminders = args.vehicles.reduce((sum, v) => sum + v.reminders.length, 0)
  const overdueCount = args.vehicles.reduce(
    (sum, v) => sum + v.reminders.filter((r) => r.isOverdue).length,
    0
  )

  const summary =
    overdueCount > 0
      ? `${overdueCount} overdue · ${totalReminders - overdueCount} due soon`
      : `${totalReminders} due soon`

  const vehicleBlocks = args.vehicles
    .map((v) => {
      const items = v.reminders
        .map((r) => {
          const dot = r.isOverdue
            ? '<span style="color:#FF5A5F;">●</span>'
            : '<span style="color:#E5C158;">●</span>'
          const tag = r.isOverdue
            ? `<span style="color:#FF5A5F;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;">Overdue</span>`
            : ''
          return `
            <div style="padding:10px 0;border-bottom:1px solid #2A2D33;">
              <p style="margin:0;color:#F4F4F2;font-size:14px;">${dot} ${escapeHtml(r.label)} ${tag}</p>
              <p style="margin:2px 0 0 14px;color:#8B8E96;font-size:12px;font-family:ui-monospace,monospace;">${escapeHtml(r.when)}</p>
            </div>`
        })
        .join('')

      return `
        <div style="background:#16181D;border:1px solid #2A2D33;border-radius:8px;padding:18px;margin:0 0 14px;">
          <p style="margin:0 0 10px;color:#F4F4F2;font-weight:600;font-size:15px;">${escapeHtml(v.vehicleName)}</p>
          ${items}
          <a href="${args.baseUrl}/vehicles/${v.vehicleId}" style="display:inline-block;margin-top:12px;color:#19E68C;font-size:13px;text-decoration:none;font-weight:500;">View vehicle →</a>
        </div>`
    })
    .join('')

  const html = `
<div style="background:#0A0B0F;color:#F4F4F2;padding:40px 20px;font-family:-apple-system,system-ui,sans-serif;">
  <div style="max-width:520px;margin:0 auto;">
    <p style="font-size:11px;letter-spacing:0.15em;text-transform:uppercase;color:#8B8E96;margin:0;">vehkit</p>
    <h1 style="font-size:24px;font-weight:600;letter-spacing:-0.02em;margin:16px 0 4px;">
      Hi ${escapeHtml(greeting)} —
    </h1>
    <p style="color:#8B8E96;margin:0 0 20px;line-height:1.6;">${escapeHtml(summary)} across your cars this week.</p>
    ${vehicleBlocks}
    <a href="${args.baseUrl}/notifications" style="display:inline-block;background:#19E68C;color:#0A0B0F;padding:14px 28px;border-radius:999px;font-weight:600;text-decoration:none;margin-top:8px;">
      Open inbox
    </a>
    <p style="color:#8B8E96;font-size:12px;margin:32px 0 0;line-height:1.5;">
      We email this digest at most once a week per reminder. To stop entirely, mark services as done — reminders auto-clear.
    </p>
    <p style="color:#5B6573;font-size:11px;margin-top:40px;letter-spacing:0.1em;text-transform:uppercase;">
      Every car deserves a passport.
    </p>
  </div>
</div>`.trim()

  try {
    const result = await client.emails.send({
      from: FROM,
      to: [args.to],
      subject:
        overdueCount > 0
          ? `${overdueCount} overdue service${overdueCount === 1 ? '' : 's'} on your cars`
          : `Service reminders for your cars`,
      html,
    })
    return { sent: true, id: result.data?.id ?? null }
  } catch (err) {
    console.error('[email] digest send failed:', err)
    return { error: String(err) }
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
