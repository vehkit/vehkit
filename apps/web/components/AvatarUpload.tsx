'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateAvatar } from '@/app/actions/profile'

export function AvatarUpload({
  userId,
  currentUrl,
  initials,
}: {
  userId: string
  currentUrl?: string | null
  initials: string
}) {
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const supabase = createClient()

  async function onFile(file: File | undefined | null) {
    setMenuOpen(false)
    if (!file) return

    setError(null)
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
    const path = `profiles/${userId}/avatar-${Date.now()}.${ext}`

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

    const result = await updateAvatar(userId, publicUrl)
    if (result.error) {
      setError(result.error)
    } else {
      setPreview(publicUrl)
    }
    setUploading(false)
  }

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={preview ? 'Change photo' : 'Add photo'}
        className="block group"
      >
        <div className="relative w-24 h-24 rounded-pill overflow-hidden">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-iron flex items-center justify-center">
              <span className="text-3xl font-semibold text-chalk uppercase">
                {initials}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-noir/0 group-hover:bg-noir/60 transition-colors flex items-center justify-center">
            <span className="text-xs tracking-widest uppercase text-chalk opacity-0 group-hover:opacity-100 transition-opacity">
              {uploading ? '…' : preview ? 'Change' : 'Add'}
            </span>
          </div>
        </div>
      </button>

      {/* Two explicit triggers so the user is never stuck with one
          source. Tap the avatar → small menu pops up with Gallery and
          Camera; each routes to its own hidden input. */}
      {menuOpen && (
        <div
          className="absolute left-1/2 -translate-x-1/2 mt-2 z-20 min-w-[180px] bg-carbon border border-seam rounded-DEFAULT shadow-card overflow-hidden"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-chalk hover:bg-iron/40 transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-leaf"
              aria-hidden
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            Choose from gallery
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-chalk hover:bg-iron/40 transition-colors border-t border-seam"
          >
            <svg
              width="16"
              height="16"
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
            Take a photo
          </button>
        </div>
      )}

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="hidden"
        disabled={uploading}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => onFile(e.target.files?.[0])}
        className="hidden"
        disabled={uploading}
      />

      {error && <p className="text-xs text-signal mt-2">{error}</p>}
    </div>
  )
}

/**
 * Read-only avatar display — used in headers, cards, etc.
 */
export function AvatarDisplay({
  url,
  initials,
  size = 'md',
}: {
  url?: string | null
  initials: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const sizeClass =
    size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-12 h-12 text-base'

  return (
    <div
      className={`${sizeClass} rounded-pill overflow-hidden border border-seam shrink-0`}
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-iron flex items-center justify-center">
          <span className="font-semibold text-chalk uppercase">{initials}</span>
        </div>
      )}
    </div>
  )
}
