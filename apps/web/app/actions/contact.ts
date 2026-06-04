'use server'

import { redirect } from 'next/navigation'

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Landing-page callback form submission.
 *
 * For now this just emails the team via Resend; once we have real
 * inbound volume we'll persist to a contact_requests table + assign to
 * a sales rep. Keeping it simple for the initial launch.
 */
export async function requestCallback(formData: FormData) {
  const name = strOrNull(formData.get('name')) ?? '—'
  const whatsapp = strOrNull(formData.get('whatsapp')) ?? '—'
  const garageCount = strOrNull(formData.get('garage_count')) ?? '—'
  const role = strOrNull(formData.get('role')) ?? '—'

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'Vehkit <hello@vehkit.com>'
  const to = process.env.CONTACT_INBOX ?? 'hello@vehkit.com'

  if (apiKey) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from,
          to: [to],
          subject: `Vehkit callback request — ${name}`,
          text: [
            `Name: ${name}`,
            `WhatsApp: ${whatsapp}`,
            `Garages: ${garageCount}`,
            `Role: ${role}`,
          ].join('\n'),
        }),
      })
    } catch (err) {
      console.error('[requestCallback] resend failed', err)
      // Don't block the user — they still see the success page.
    }
  } else {
    // Useful in dev when no Resend key is set.
    console.log('[requestCallback]', { name, whatsapp, garageCount, role })
  }

  redirect('/?callback=sent#callback')
}
