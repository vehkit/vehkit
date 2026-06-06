'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

/**
 * Tiny invisible client component. Mounted alongside any document that
 * is currently in extraction_status='pending'. Polls the page via
 * router.refresh() every 4 seconds until the parent re-renders without
 * this component (meaning the row flipped to 'ready', 'applied', or
 * 'failed'). Cheap: refresh() is a server-rendered partial fetch, not
 * a full page reload.
 */
export function ExtractionStatusPing({ enabled }: { enabled: boolean }) {
  const router = useRouter()
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!enabled) return
    timer.current = setInterval(() => {
      router.refresh()
    }, 4000)
    return () => {
      if (timer.current) clearInterval(timer.current)
    }
  }, [enabled, router])

  return null
}
