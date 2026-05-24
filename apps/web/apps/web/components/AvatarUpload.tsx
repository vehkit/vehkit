'use client'

import { useState } from 'react'
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
  const supabase = createClient()

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
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
    <label className="block cursor-pointer group">
      <input
        type="file"
        accept="image/*"
        onChange={onChange}
        className="hidden"
        disabled={uploading}
      />
      <div className="relative w-24 h-24 rounded-pill overflow-hidden border border-seam">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-iron flex items-center justify-center">
            <span className="text-3xl font-semibold text-chalk uppercase">{initials}</span>
          </div>
        )}
        <div className="absolute inset-0 bg-noir/0 group-hover:bg-noir/60 transition-colors flex items-center justify-center">
          <span className="text-xs tracking-widest uppercase text-chalk opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? '…' : preview ? 'Change' : 'Add'}
          </span>
        </div>
      </div>
      {error && <p className="text-xs text-signal mt-2">{error}</p>}
    </label>
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
