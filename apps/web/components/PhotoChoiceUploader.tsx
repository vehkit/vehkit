'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateVehicleHero } from '@/app/actions/vehicles'

/**
 * Single-button photo uploader.
 *
 * Modern iOS Safari + Android Chrome already show an action sheet when
 * a file input with `accept="image/*"` is tapped — listing Camera,
 * Photo Library, and Files. Inserting our own 3-button chooser was
 * redundant noise; we now defer to the native OS picker.
 *
 * The input deliberately omits `capture` so the browser is free to
 * offer all sources. On desktop, the OS file picker opens directly.
 *
 * Two render modes:
 *   `lg` — block button with a friendly label, used when no hero photo
 *          exists yet.
 *   `sm` — compact icon-only pill overlay, used on top of an existing
 *          hero image to replace it.
 */
export function PhotoChoiceUploader({
  vehicleId,
  hasPhoto,
  size = 'lg',
}: {
  vehicleId: string
  hasPhoto: boolean
  size?: 'sm' | 'lg'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `vehicles/${vehicleId}/hero-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('service-files')
      .upload(path, file, { contentType: file.type, upsert: false })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from('service-files').getPublicUrl(path)

    const result = await updateVehicleHero(vehicleId, publicUrl)
    if (result.error) {
      setError(result.error)
      setUploading(false)
      return
    }

    // Server-rendered card → reload so the new image surfaces.
    window.location.reload()
  }

  if (size === 'sm') {
    return (
      <label className="relative inline-flex items-center justify-center w-9 h-9 rounded-pill bg-noir/65 backdrop-blur text-chalk hover:bg-noir/85 transition-colors cursor-pointer">
        {uploading ? (
          <span className="text-[10px] tracking-widest uppercase">…</span>
        ) : (
          <svg
            width="16"
            height="16"
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
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={onChange}
          className="hidden"
          disabled={uploading}
        />
        {error && (
          <span
            className="absolute -bottom-7 right-0 text-[10px] text-signal whitespace-nowrap"
            role="alert"
          >
            {error}
          </span>
        )}
      </label>
    )
  }

  return (
    <label className="w-full block">
      <span className="block text-center text-xs text-mute mb-2">
        {hasPhoto
          ? 'Replace photo'
          : 'Add a photo so your car looks like yours.'}
      </span>
      <span className="flex items-center justify-center gap-2 h-12 rounded-pill border border-seam bg-carbon/40 hover:border-leaf/40 hover:bg-leaf/5 text-ink font-semibold text-sm cursor-pointer transition-colors">
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-leaf"
          aria-hidden
        >
          <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
          <circle cx="12" cy="13" r="4" />
        </svg>
        {uploading ? 'Uploading…' : 'Add a photo'}
      </span>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
        disabled={uploading}
      />
      {error && (
        <span className="block text-xs text-signal text-center mt-2" role="alert">
          {error}
        </span>
      )}
    </label>
  )
}
