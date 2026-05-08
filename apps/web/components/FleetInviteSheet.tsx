'use client'

import { useState, useTransition } from 'react'
import { createFleetInvite } from '@/app/actions/fleet'

type FleetRole = 'admin' | 'member' | 'viewer'

const ROLE_DESCRIPTIONS: Record<FleetRole, string> = {
  admin: 'Manage fleet, invite others, add/remove vehicles',
  member: 'View fleet, add own vehicles, log services',
  viewer: 'Read-only — see vehicles and reports',
}

export function FleetInviteSheet({
  orgId,
  baseUrl,
}: {
  orgId: string
  baseUrl: string
}) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [role, setRole] = useState<FleetRole>('member')
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function generate() {
    setError(null)
    setToken(null)
    startTransition(async () => {
      const result = await createFleetInvite(orgId, role)
      if (result.error) {
        setError(result.error)
      } else if (result.token) {
        setToken(result.token)
      }
    })
  }

  const inviteUrl = token ? `${baseUrl}/f/${token}` : ''

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
        title: 'Vehkit · Fleet invite',
        text: "You've been invited to a fleet on Vehkit",
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
        Invite member
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
              <h3 className="text-lg font-semibold text-chalk">Invite a teammate</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-ash hover:text-chalk text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-ash leading-relaxed">
              Generate a one-tap invite link. Send via WhatsApp/SMS. Whoever opens it joins your
              fleet with the role you pick.
            </p>

            <div>
              <p className="nav-pill text-[10px] mb-2">Role</p>
              <div className="space-y-2">
                {(['admin', 'member', 'viewer'] as FleetRole[]).map((r) => (
                  <label
                    key={r}
                    className={`block card p-3 cursor-pointer transition-colors ${
                      role === r ? 'border-volt' : 'hover:border-volt/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="accent-volt"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-chalk capitalize">{r}</p>
                        <p className="text-xs text-ash mt-0.5">{ROLE_DESCRIPTIONS[r]}</p>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {!token && (
              <button
                type="button"
                onClick={generate}
                disabled={isPending}
                className="pill-primary w-full disabled:opacity-50"
              >
                {isPending ? 'Generating…' : 'Generate invite link'}
              </button>
            )}

            {error && <p className="text-sm text-signal">{error}</p>}

            {token && (
              <div className="space-y-3 border-t border-seam pt-4">
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
                    href={`https://wa.me/?text=${encodeURIComponent(`You're invited to join my fleet on Vehkit: ${inviteUrl}`)}`}
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
