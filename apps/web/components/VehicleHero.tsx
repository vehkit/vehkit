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

  return (
    <div className="relative w-full h-[55vh] md:h-[460px] overflow-hidden md:rounded-DEFAULT bg-iron group">
      {/* Photo */}
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : isOwner ? (
        // Empty-state IS the upload trigger. Whole placeholder area is a
        // <label> wrapping the file input, so tapping the big middle area
        // (not just the small icon) opens the OS picker.
        // No `capture` attribute so iOS Safari shows the full action sheet
        // (Photo Library / Take Photo / Choose Files) instead of camera-only.
        <label className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-iron via-carbon to-noir cursor-pointer active:opacity-90 transition-opacity">
          <div className="text-center pointer-events-none">
            <div className="w-16 h-16 mx-auto rounded-pill bg-noir/40 backdrop-blur flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-chalk/70"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13l1.66-4.97A2 2 0 016.55 6.5h10.9a2 2 0 011.89 1.53L21 13M5 13h14M7 17h.01M17 17h.01M5 13v4a1 1 0 001 1h12a1 1 0 001-1v-4"
                />
              </svg>
            </div>
            <p className="text-sm text-chalk mt-3 font-semibold">
              {uploading ? 'Uploading…' : 'Add a photo'}
            </p>
            <p className="text-[11px] text-chalk/60 mt-1 tracking-wide">
              Tap to pick from camera, photos, or files
            </p>
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      ) : (
        // Non-owner empty state — no upload action, just decoration.
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-iron via-carbon to-noir">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto rounded-pill bg-noir/40 backdrop-blur flex items-center justify-center">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-chalk/70"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13l1.66-4.97A2 2 0 016.55 6.5h10.9a2 2 0 011.89 1.53L21 13M5 13h14M7 17h.01M17 17h.01M5 13v4a1 1 0 001 1h12a1 1 0 001-1v-4"
                />
              </svg>
            </div>
            <p className="text-xs text-chalk/70 mt-3 tracking-widest uppercase">
              No photo yet
            </p>
          </div>
        </div>
      )}

      {/* Bottom gradient — for any caption / badge legibility */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-noir via-noir/40 to-transparent pointer-events-none" />

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
