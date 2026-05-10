'use client'

import { useEffect, useState, useTransition } from 'react'
import { generateAgentCode } from '@/app/actions/agent'
import { formatCode } from '@/lib/workshop-codes'

export function AgentCodeSheet({
  vehicleId,
  vehicleTitle,
  baseUrl,
  disabled = false,
}: {
  vehicleId: string
  vehicleTitle: string
  baseUrl: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [now, setNow] = useState(() => Date.now())
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [open])

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await generateAgentCode(vehicleId)
      if (result.error) {
        setError(result.error)
      } else if (result.code && result.expiresAt) {
        setCode(result.code)
        setExpiresAt(result.expiresAt)
        setOpen(true)
      }
    })
  }

  const remainingMs = expiresAt ? new Date(expiresAt).getTime() - now : 0
  const remainingMin = Math.max(0, Math.floor(remainingMs / 60000))
  const remainingSec = Math.max(0, Math.floor((remainingMs % 60000) / 1000))
  const expired = remainingMs <= 0

  const agentUrl = `${baseUrl}/agent/redeem`

  async function copyShareText() {
    if (!code) return
    const text = `${vehicleTitle} — Vehkit insurance share\n\nCode: ${formatCode(code)}\nOpen: ${agentUrl}\n\nFull access for 60 minutes after redemption, then renewal-only metadata for 30 days.`
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // best-effort
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={isPending || disabled}
        className="text-xs tracking-widest uppercase text-volt hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
        title={
          disabled ? 'Add a document first to share with an agent' : undefined
        }
      >
        {isPending ? 'Generating…' : 'Share with agent →'}
      </button>

      {error && <p className="text-xs text-signal mt-2">{error}</p>}

      {open && code && (
        <div
          className="fixed inset-0 bg-noir/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-carbon border border-seam rounded-DEFAULT max-w-md w-full p-6 space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-chalk">
                Share with agent
              </h3>
              <button
                onClick={() => setOpen(false)}
                className="text-ash hover:text-chalk text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-ash leading-relaxed">
              Send this to your insurance broker. They sign in at{' '}
              <span className="font-mono text-chalk/80">{agentUrl}</span> and
              enter the code. Full document access for{' '}
              <span className="text-chalk">60 minutes</span>, then renewal-only
              metadata for 30 days.
            </p>

            <div className="bg-noir border border-seam rounded-DEFAULT py-8 text-center">
              <p className="font-mono text-5xl md:text-6xl font-semibold text-chalk tracking-[0.1em]">
                {formatCode(code)}
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-ash">
                Code expires in
              </p>
              <p
                className={`font-mono tabular-nums ${
                  expired
                    ? 'text-signal'
                    : remainingMin < 5
                      ? 'text-wallet'
                      : 'text-volt'
                }`}
              >
                {expired
                  ? 'Expired'
                  : `${remainingMin}:${String(remainingSec).padStart(2, '0')}`}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={copyShareText}
                className="pill-outline flex-1 text-sm"
                disabled={expired}
              >
                {copied ? 'Copied ✓' : 'Copy share text'}
              </button>
              <button
                onClick={() => setOpen(false)}
                className="pill-ghost flex-1 text-sm"
              >
                Done
              </button>
            </div>

            <p className="text-[11px] text-ash/70 leading-relaxed">
              The agent must already have a Vehkit agent account. Anyone with
              the code who doesn't will be guided to{' '}
              <span className="font-mono text-chalk/80">/agent/start</span>.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
