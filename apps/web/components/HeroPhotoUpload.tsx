'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateVehicleHero } from '@/app/actions/vehicles'

export function HeroPhotoUpload({
  vehicleId,
  currentUrl,
}: {
  vehicleId: string
  currentUrl?: string | null
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

  if (preview) {
    return (
      <div className="relative w-full aspect-[16/9] overflow-hidden rounded-DEFAULT border border-seam group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={preview} alt="" className="w-full h-full object-cover" />
        <label className="absolute inset-x-0 bottom-0 px-4 py-3 bg-gradient-to-t from-noir to-transparent flex justify-end opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
          <span className="text-xs tracking-widest uppercase text-chalk bg-iron/80 backdrop-blur px-3 py-1.5 rounded-pill">
            {uploading ? 'Uploading…' : 'Change photo'}
          </span>
          <input
            type="file"
            accept="image/*"
            onChange={onChange}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>
    )
  }

  return (
    <label className="block w-full aspect-[16/9] rounded-DEFAULT border border-dashed border-seam bg-carbon/40 cursor-pointer hover:border-volt/40 transition-colors flex items-center justify-center">
      <div className="text-center">
        <p className="text-sm text-ash">{uploading ? 'Uploading…' : '+ Add hero photo'}</p>
        {error && <p className="text-xs text-signal mt-1">{error}</p>}
      </div>
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
