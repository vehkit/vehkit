'use client'

import { useEffect, useState, useTransition } from 'react'
import { generateWorkshopCode } from '@/app/actions/workshop'
import { formatCode } from '@/lib/workshop-codes'

export function WorkshopCodeSheet({ vehicleId }: { vehicleId: string }) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState<string | null>(null)
  const [expiresAt, setExpiresAt] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [now, setNow] = useState(() => Date.now())

  // Tick every second for the countdown
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [open])

  function generate() {
    setError(null)
    startTransition(async () => {
      const result = await generateWorkshopCode(vehicleId)
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

  return (
    <>
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="pill-outline text-sm disabled:opacity-50"
      >
        {isPending ? 'Generating…' : 'Workshop code'}
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
              <h3 className="text-lg font-semibold text-chalk">Workshop code</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-ash hover:text-chalk text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <p className="text-sm text-ash leading-relaxed">
              Show this code to the workshop. They open{' '}
              <span className="font-mono text-chalk">vehkit.com/shop</span> and enter it. Single
              use, expires automatically.
            </p>

            <div className="bg-noir border border-seam rounded-DEFAULT py-8 text-center">
              <p className="font-mono text-5xl md:text-6xl font-semibold text-chalk tracking-[0.1em]">
                {formatCode(code)}
              </p>
            </div>

            <div className="flex items-center justify-between text-sm">
              <p className="text-ash">
                Workshop URL{' '}
                <span className="font-mono text-chalk/80">vehkit.com/shop</span>
              </p>
              <p
                className={`font-mono tabular-nums ${
                  expired ? 'text-signal' : remainingMin < 5 ? 'text-wallet' : 'text-volt'
                }`}
              >
                {expired
                  ? 'Expired'
                  : `${remainingMin}:${String(remainingSec).padStart(2, '0')}`}
              </p>
            </div>

            <button
              onClick={() => setOpen(false)}
              className="pill-ghost w-full text-center text-sm"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}
