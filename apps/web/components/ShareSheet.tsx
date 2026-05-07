'use client'

import { useState, useTransition } from 'react'
import { createShareToken } from '@/app/actions/share'

export function ShareSheet({ vehicleId, baseUrl }: { vehicleId: string; baseUrl: string }) {
  const [open, setOpen] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await createShareToken(vehicleId)
      if (result.error) {
        setError(result.error)
      } else if (result.token) {
        setToken(result.token)
        setOpen(true)
      }
    })
  }

  const shareUrl = token ? `${baseUrl}/r/${token}` : ''
  const qrUrl = token
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&bgcolor=16181d&color=f4f4f2&data=${encodeURIComponent(shareUrl)}`
    : ''

  async function copyLink() {
    if (!shareUrl) return
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  async function nativeShare() {
    if (!shareUrl || !navigator.share) {
      copyLink()
      return
    }
    try {
      await navigator.share({
        title: 'Vehicle Passport',
        text: 'Verified service history',
        url: shareUrl,
      })
    } catch {
      // user cancelled
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="pill-outline text-sm disabled:opacity-50"
      >
        {isPending ? 'Generating…' : 'Share passport'}
      </button>

      {error && <p className="text-xs text-signal mt-2">{error}</p>}

      {open && token && (
        <div
          className="fixed inset-0 bg-noir/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-carbon border border-seam rounded-DEFAULT max-w-md w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-chalk">Verified Passport</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-ash hover:text-chalk text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-ash">
              Anyone with this link sees the full service history. Link expires in 90 days.
            </p>

            <div className="flex justify-center py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="QR code"
                width={240}
                height={240}
                className="rounded-DEFAULT"
              />
            </div>

            <div className="space-y-2">
              <p className="nav-pill text-[10px]">Link</p>
              <div className="flex items-center gap-2 bg-iron border border-seam rounded-DEFAULT px-3 py-2.5">
                <code className="flex-1 text-xs text-chalk font-mono truncate">{shareUrl}</code>
                <button
                  onClick={copyLink}
                  className="text-xs tracking-widest uppercase text-volt hover:text-volt/80 shrink-0"
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="pill-ghost flex-1 text-center text-sm"
              >
                Open
              </a>
              <button onClick={nativeShare} className="pill-primary flex-1 text-sm">
                Share
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
