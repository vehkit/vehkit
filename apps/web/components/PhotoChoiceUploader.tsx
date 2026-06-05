'use client'

import { forwardRef, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateVehicleHero } from '@/app/actions/vehicles'

/**
 * Three-button photo uploader.
 *
 * Mobile chooser UIs sometimes hide the "camera" option behind a menu,
 * which makes users miss it. We surface all three sources as explicit
 * buttons:
 *   📷  Take photo  — input with capture="environment" (forces camera)
 *   🖼️  Gallery     — input with accept="image/*"     (gallery sheet)
 *   📁  Files       — input with no accept restriction (file system)
 *
 * On desktop the camera button still triggers the OS device picker if
 * a webcam exists; if none, the OS falls back to file selection.
 *
 * Used in `VehicleHeroCard` on /mycars and reusable anywhere a vehicle
 * photo is captured.
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
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const filesRef = useRef<HTMLInputElement>(null)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleFile(file: File | undefined | null) {
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

    // Reload to surface the new image on next paint. Server-component
    // re-render after the action keeps things consistent.
    window.location.reload()
  }

  // Compact icon-only variant for use on a hero card overlay.
  if (size === 'sm') {
    return (
      <div className="flex items-center gap-1.5">
        <IconButton
          title="Take photo"
          uploading={uploading}
          onClick={() => cameraRef.current?.click()}
          icon="camera"
        />
        <IconButton
          title="From gallery"
          uploading={uploading}
          onClick={() => galleryRef.current?.click()}
          icon="image"
        />
        <IconButton
          title="From files"
          uploading={uploading}
          onClick={() => filesRef.current?.click()}
          icon="file"
        />

        <HiddenInput
          ref={cameraRef}
          accept="image/*"
          capture="environment"
          onFile={handleFile}
        />
        <HiddenInput ref={galleryRef} accept="image/*" onFile={handleFile} />
        <HiddenInput ref={filesRef} accept="image/*,application/pdf" onFile={handleFile} />

        {error && (
          <p
            className="absolute -bottom-7 right-0 text-[10px] text-signal whitespace-nowrap"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    )
  }

  // Large 3-button stack — used when no photo exists yet.
  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs text-mute text-center mb-1">
        {hasPhoto
          ? 'Replace photo'
          : 'Add a photo so your car looks like yours.'}
      </p>
      <div className="grid grid-cols-3 gap-2">
        <BigChoice
          label="Take photo"
          sub="Camera"
          uploading={uploading}
          onClick={() => cameraRef.current?.click()}
          icon="camera"
        />
        <BigChoice
          label="Gallery"
          sub="Photos"
          uploading={uploading}
          onClick={() => galleryRef.current?.click()}
          icon="image"
        />
        <BigChoice
          label="Files"
          sub="Browse"
          uploading={uploading}
          onClick={() => filesRef.current?.click()}
          icon="file"
        />
      </div>

      <HiddenInput
        ref={cameraRef}
        accept="image/*"
        capture="environment"
        onFile={handleFile}
      />
      <HiddenInput ref={galleryRef} accept="image/*" onFile={handleFile} />
      <HiddenInput ref={filesRef} accept="image/*,application/pdf" onFile={handleFile} />

      {error && (
        <p className="text-xs text-signal text-center mt-1" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

// ─── helpers ────────────────────────────────────────────────────────

function BigChoice({
  label,
  sub,
  onClick,
  uploading,
  icon,
}: {
  label: string
  sub: string
  onClick: () => void
  uploading: boolean
  icon: 'camera' | 'image' | 'file'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={uploading}
      aria-busy={uploading}
      className="flex flex-col items-center justify-center gap-1.5 py-3.5 rounded-DEFAULT border border-seam bg-carbon/40 hover:border-leaf/40 hover:bg-leaf/5 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      <Icon name={icon} className="w-5 h-5 text-leaf" />
      <span className="text-sm font-semibold text-ink leading-none">{label}</span>
      <span className="text-[10px] uppercase tracking-widest text-mute leading-none">
        {uploading ? 'Uploading…' : sub}
      </span>
    </button>
  )
}

function IconButton({
  title,
  onClick,
  uploading,
  icon,
}: {
  title: string
  onClick: () => void
  uploading: boolean
  icon: 'camera' | 'image' | 'file'
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={uploading}
      aria-busy={uploading}
      className="w-9 h-9 rounded-pill bg-noir/65 backdrop-blur flex items-center justify-center text-chalk hover:bg-noir/85 transition-colors disabled:opacity-60 disabled:cursor-wait"
    >
      <Icon name={icon} className="w-4 h-4" />
    </button>
  )
}

const HiddenInput = forwardRef<
  HTMLInputElement,
  {
    accept: string
    capture?: 'environment' | 'user'
    onFile: (f: File | undefined | null) => void
  }
>(function HiddenInput({ accept, capture, onFile }, ref) {
  return (
    <input
      ref={ref}
      type="file"
      accept={accept}
      capture={capture}
      onChange={(e) => onFile(e.target.files?.[0])}
      className="hidden"
    />
  )
})

function Icon({
  name,
  className,
}: {
  name: 'camera' | 'image' | 'file'
  className?: string
}) {
  if (name === 'camera') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
        <circle cx="12" cy="13" r="4" />
      </svg>
    )
  }
  if (name === 'image') {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden
      >
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    )
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
