'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateVehicleHero } from '@/app/actions/vehicles'

export function HeroPhotoUpload({
  vehicleId,
  currentUrl,
  children,
  fullBleed = false,
}: {
  vehicleId: string
  currentUrl?: string | null
  children?: React.ReactNode
  fullBleed?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
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
    } else {
      setPreview(publicUrl)
    }
    setUploading(false)
  }

  const containerClass = fullBleed
    ? 'relative w-full h-[55vh] md:h-[460px] overflow-hidden rounded-DEFAULT border border-seam bg-iron group'
    : 'relative w-full h-72 md:h-80 overflow-hidden rounded-DEFAULT border border-seam group'

  if (preview) {
    return (
      <div className={containerClass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="absolute inset-0 w-full h-full object-cover" />

        {/* Bottom gradient for overlay legibility */}
        {children && (
          <div
            className={`absolute inset-x-0 bottom-0 ${fullBleed ? 'h-3/4' : 'h-2/3'} bg-gradient-to-t from-noir via-noir/85 to-transparent pointer-events-none`}
          />
        )}

        {/* Camera icon top-right for re-upload */}
        <label className="absolute top-3 right-3 cursor-pointer z-10">
          <span className="w-9 h-9 rounded-pill bg-noir/70 backdrop-blur flex items-center justify-center text-chalk hover:bg-noir/90 transition-colors">
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
          </span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={onChange}
            className="hidden"
            disabled={uploading}
          />
        </label>

        {/* Overlay content */}
        {children && (
          <div className="absolute inset-x-0 bottom-0 p-5">{children}</div>
        )}
      </div>
    )
  }

  return (
    <label
      className={
        fullBleed
          ? 'block w-full h-[55vh] md:h-[460px] rounded-DEFAULT border border-dashed border-seam bg-carbon/40 cursor-pointer hover:border-volt/40 transition-colors relative'
          : 'block w-full h-72 md:h-80 rounded-DEFAULT border border-dashed border-seam bg-carbon/40 cursor-pointer hover:border-volt/40 transition-colors relative'
      }
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-ash">{uploading ? 'Uploading…' : '+ Add hero photo'}</p>
          {error && <p className="text-xs text-signal mt-1">{error}</p>}
        </div>
      </div>
      {/* Overlay content even when no photo */}
      {children && (
        <div className="absolute inset-x-0 bottom-0 p-5 bg-gradient-to-t from-noir via-noir/80 to-transparent pointer-events-none">
          {children}
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onChange}
        className="hidden"
        disabled={uploading}
      />
    </label>
  )
}
