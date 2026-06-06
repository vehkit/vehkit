'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateVehicleHero } from '@/app/actions/vehicles'

/**
 * PropertyFinder-style vehicle hero.
 *   - Edge-to-edge photo on mobile, column-bound on desktop
 *   - Floating circular icons: back (left) + share (right) + camera (top-right edge)
 *   - Badges overlay top-left for tier / pending status
 *   - Bottom strip: photo counter + small caption (year / color)
 */
export function VehicleHero({
  vehicleId,
  currentUrl,
  badges = [],
  isOwner,
  backHref,
  backLabel,
}: {
  vehicleId: string
  currentUrl: string | null | undefined
  badges?: Array<{ label: string; tone: 'volt' | 'wallet' | 'signal' | 'iron' }>
  isOwner: boolean
  backHref: string
  backLabel: string
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const supabase = createClient()

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `vehicles/${vehicleId}/hero-${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('service-files')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (upErr) {
      setUploading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('service-files').getPublicUrl(path)

    const result = await updateVehicleHero(vehicleId, publicUrl)
    if (!result.error) setPreview(publicUrl)
    setUploading(false)
  }

  // No photo? Collapse to a thin "Add a photo" strip (owner) or
  // nothing at all (non-owner). The 300px gray box was dominating
  // the page on every vehicle that hadn't uploaded a hero yet.
  if (!preview) {
    if (!isOwner) return null
    return (
      <label className="flex items-center gap-3 px-4 py-3 rounded-DEFAULT border border-dashed border-seam bg-iron/30 hover:border-leaf/40 hover:bg-leaf/5 transition-colors cursor-pointer">
        <span className="w-9 h-9 rounded-pill bg-noir/30 flex items-center justify-center text-chalk shrink-0">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden
          >
            <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-chalk">
            {uploading ? 'Uploading…' : 'Add a photo'}
          </span>
          <span className="block text-[11px] text-ash">
            Camera, photos, or files
          </span>
        </span>
        <input
          type="file"
          accept="image/*"
          onChange={onChange}
          className="hidden"
          disabled={uploading}
        />
      </label>
    )
  }

  return (
    <div className="relative w-full h-[32vh] min-h-[220px] md:h-[300px] overflow-hidden rounded-DEFAULT bg-iron group">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={preview}
        alt=""
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Soft gradient at the bottom edge only. Keeps badges legible
          without the heavy 50% black overlay that made the old hero
          dominate the page. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-noir/55 to-transparent pointer-events-none" />

      {/* Top-left: back button (mobile only — desktop has the column heading) */}
      <Link
        href={backHref}
        className="md:hidden absolute top-4 left-4 w-10 h-10 rounded-pill bg-noir/60 backdrop-blur flex items-center justify-center text-chalk hover:bg-noir/80 transition-colors"
        aria-label={backLabel}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </Link>

      {/* Top-right: camera (owner only) */}
      {isOwner && (
        <label
          className="absolute top-4 right-4 w-10 h-10 rounded-pill bg-noir/60 backdrop-blur flex items-center justify-center text-chalk hover:bg-noir/80 transition-colors cursor-pointer"
          aria-label="Change photo"
        >
          {uploading ? (
            <span className="text-[10px] tracking-widest uppercase">…</span>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      )}

      {/* Bottom-left: badges */}
      {badges.length > 0 && (
        <div className="absolute bottom-4 left-4 flex items-center gap-2 flex-wrap">
          {badges.map((b, i) => {
            const cls =
              b.tone === 'volt'
                ? 'bg-volt/90 text-noir'
                : b.tone === 'wallet'
                  ? 'bg-wallet/90 text-noir'
                  : b.tone === 'signal'
                    ? 'bg-signal/90 text-noir'
                    : 'bg-noir/70 text-chalk backdrop-blur'
            return (
              <span
                key={i}
                className={`text-[10px] tracking-widest uppercase font-semibold px-2.5 py-1 rounded-pill ${cls}`}
              >
                {b.label}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}
