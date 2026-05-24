'use client'

import { useState, useTransition } from 'react'
import { createFamilyInvite } from '@/app/actions/family'

type AccessLevel = 'view' | 'add_record' | 'full'
type SendStatus = 'idle' | 'sending' | 'sent' | 'failed'

const LEVEL_DESCRIPTIONS: Record<AccessLevel, string> = {
  view: 'Read-only — see records and reminders, can\'t modify',
  add_record: 'Can add service entries, but not edit the vehicle itself',
  full: 'Full access — same as you (except deletion)',
}

export function FamilyShareSheet({
  vehicleId,
  baseUrl,
}: {
  vehicleId: string
  baseUrl: string
}) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('full')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [emailStatus, setEmailStatus] = useState<SendStatus>('idle')
  const [isPending, startTransition] = useTransition()

  function generate() {
    setError(null)
    setToken(null)
    setEmailStatus(email.trim() ? 'sending' : 'idle')
    startTransition(async () => {
      const result = await createFamilyInvite(vehicleId, accessLevel, email.trim() || undefined)
      if (result.error) {
        setError(result.error)
        setEmailStatus('idle')
      } else if (result.token) {
        setToken(result.token)
        setEmailStatus(result.emailSent ? 'sent' : email.trim() ? 'failed' : 'idle')
      }
    })
  }

  const inviteUrl = token ? `${baseUrl}/a/${token}` : ''

  async function copyLink() {
    if (!inviteUrl) return
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (!inviteUrl || !navigator.share) {
      copyLink()
      return
    }
    try {
      await navigator.share({
        title: 'Vehkit — Family access',
        text: 'I\'m sharing this car with you on Vehkit',
        url: inviteUrl,
      })
    } catch {
      /* cancelled */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setToken(null)
          setError(null)
        }}
        className="pill-outline text-sm"
      >
        Share with family
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-noir/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-carbon border border-seam rounded-DEFAULT max-w-md w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-chalk">Share with family</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-ash hover:text-chalk text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-ash leading-relaxed">
              Generate a one-tap link. Send it via WhatsApp/SMS. Whoever opens it gets access to
              this vehicle.
            </p>

            <div>
              <p className="nav-pill text-[10px] mb-2">Access level</p>
              <div className="space-y-2">
                {(['full', 'add_record', 'view'] as AccessLevel[]).map((l) => (
                  <label
                    key={l}
                    className={`block card p-3 cursor-pointer transition-colors ${
                      accessLevel === l ? 'border-volt' : 'hover:border-volt/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="access_level"
                        value={l}
                        checked={accessLevel === l}
                        onChange={() => setAccessLevel(l)}
                        className="accent-volt"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-chalk capitalize">
                          {l === 'add_record' ? 'Can add records' : l === 'full' ? 'Full access' : 'View only'}
                        </p>
                        <p className="text-xs text-ash mt-0.5">{LEVEL_DESCRIPTIONS[l]}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {!token && (
              <>
                <div>
                  <p className="nav-pill text-[10px] mb-2">Send to (optional)</p>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="them@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="field"
                  />
                  <p className="text-xs text-ash mt-1.5">
                    If filled, we email the invite link directly. Otherwise, copy and share.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={generate}
                  disabled={isPending}
                  className="pill-primary w-full disabled:opacity-50"
                >
                  {isPending
                    ? email.trim()
                      ? 'Sending…'
                      : 'Generating…'
                    : email.trim()
                      ? 'Generate + email link'
                      : 'Generate invite link'}
                </button>
              </>
            )}

            {error && <p className="text-sm text-signal">{error}</p>}

            {token && (
              <div className="space-y-3 border-t border-seam pt-4">
                {emailStatus === 'sent' && (
                  <p className="text-sm text-volt">✓ Invite emailed to {email}</p>
                )}
                {emailStatus === 'failed' && (
                  <p className="text-sm text-wallet">
                    Email send failed — share the link below manually.
                  </p>
                )}
                <p className="nav-pill text-[10px]">Invite link · expires in 14 days</p>
                <div className="flex items-center gap-2 bg-iron border border-seam rounded-DEFAULT px-3 py-2.5">
                  <code className="flex-1 text-xs text-chalk font-mono truncate">
                    {inviteUrl}
                  </code>
                  <button
                    onClick={copyLink}
                    className="text-xs tracking-widest uppercase text-volt hover:text-volt/80 shrink-0"
                  >
                    {copied ? '✓' : 'Copy'}
                  </button>
                </div>

                <div className="flex gap-2">
                  <a
                    href={`https://wa.me/?text=${encodeURIComponent(`I'm sharing this car with you on Vehkit: ${inviteUrl}`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="pill-ghost flex-1 text-center text-sm"
                  >
                    WhatsApp
                  </a>
                  <button onClick={nativeShare} className="pill-primary flex-1 text-sm">
                    Share
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
