'use server'

import { redirect } from 'next/navigation'

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

/**
 * Landing-page contact form submission.
 *
 * Universal "let's talk" — works for drivers, garage owners, investors,
 * press, partners. The `who` field tells us which inbox / playbook to
 * route to once we wire that up.
 *
 * For now we just email the team via Resend; later we'll persist to a
 * contact_requests table and route by `who`.
 */
export async function requestCallback(formData: FormData) {
  const name = strOrNull(formData.get('name')) ?? '—'
  const whatsapp = strOrNull(formData.get('whatsapp')) ?? '—'
  const who = strOrNull(formData.get('who')) ?? '—'
  const message = strOrNull(formData.get('message')) ?? '—'

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM ?? 'Vehkit <hello@vehkit.com>'
  const to = process.env.CONTACT_INBOX ?? 'hello@vehkit.com'

  // Subject prefix tells you at a glance who's writing — easy mail sort.
  const subjectTag = who === '—' ? 'contact' : who.toLowerCase()

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
          subject: `Vehkit [${subjectTag}] — ${name}`,
          text: [
            `Who: ${who}`,
            `Name: ${name}`,
            `WhatsApp: ${whatsapp}`,
            '',
            'Message:',
            message,
          ].join('\n'),
        }),
      })
    } catch (err) {
      console.error('[requestCallback] resend failed', err)
      // Don't block the user — they still see the success page.
    }
  } else {
    // Useful in dev when no Resend key is set.
    console.log('[requestCallback]', { who, name, whatsapp, message })
  }

  redirect('/?callback=sent#callback')
}
