'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Upload + manage a workshop's hero photo. Shown on /workshop/settings.
 * The image lands on the public /workshops directory + /w/[slug] profile.
 *
 * Storage: service-files bucket (public read, auth-only write — same
 * bucket used for service entry photos).
 * DB: set_workshop_hero RPC validates membership before persisting the
 * URL on workshops.hero_image_url.
 */
export function WorkshopHeroUpload({
  workshopId,
  currentUrl,
}: {
  workshopId: string
  currentUrl: string | null
}) {
  const router = useRouter()
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
    const path = `workshops/${workshopId}/hero-${Date.now()}.${ext}`

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

    const { error: rpcError } = await supabase.rpc('set_workshop_hero', {
      p_workshop_id: workshopId,
      p_url: publicUrl,
    })

    if (rpcError) {
      setError(rpcError.message)
      setUploading(false)
      return
    }

    setPreview(publicUrl)
    setUploading(false)
    router.refresh()
  }

  return (
    <div className="card overflow-hidden">
      {/* Photo preview / drop zone */}
      <div className="relative w-full h-48 md:h-56 bg-iron group">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-iron via-carbon to-noir">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-pill bg-noir/60 backdrop-blur flex items-center justify-center">
                <svg
                  width="22"
                  height="22"
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
              <p className="text-[10px] tracking-widest uppercase text-chalk/70 mt-3">
                No hero photo yet
              </p>
            </div>
          </div>
        )}

        {/* Camera button — top-right */}
        <label
          className="absolute top-3 right-3 w-10 h-10 rounded-pill bg-noir/70 backdrop-blur flex items-center justify-center text-chalk hover:bg-noir/90 transition-colors cursor-pointer"
          aria-label={preview ? 'Replace photo' : 'Upload photo'}
        >
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
            type="file"
            accept="image/*"
            onChange={onChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      </div>

      {/* Caption + error */}
      <div className="p-4 border-t border-seam">
        <p className="text-xs text-ash leading-relaxed">
          Shown on the public directory at{' '}
          <span className="font-mono text-chalk/80">vehkit.com/workshops</span>{' '}
          and on your shop profile. Wide format works best — your front
          gate, bay shot, or fleet line.
        </p>
        {error && <p className="text-xs text-signal mt-2">{error}</p>}
      </div>
    </div>
  )
}
