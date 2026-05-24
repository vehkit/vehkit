'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function TradeLicenseUpload({
  workshopId,
  hasLicense,
  currentTier,
}: {
  workshopId: string
  hasLicense: boolean
  currentTier: string
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setUploading(true)

    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const path = `workshops/${workshopId}/trade-license/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('workshop-docs')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    // Save the path (private — no public URL)
    const { error: saveError } = await supabase.rpc('set_trade_license', {
      p_workshop_id: workshopId,
      p_url: path,
    })

    if (saveError) {
      setError(saveError.message)
      setUploading(false)
      return
    }

    setUploading(false)
    router.refresh()
  }

  if (currentTier === 'gold') {
    return (
      <div className="card p-5 border-l-4 border-l-wallet">
        <p className="nav-pill text-[10px] text-wallet">Gold Verified</p>
        <p className="text-sm text-chalk mt-2 leading-relaxed">
          You're at the top tier. Trade license verified, 50+ entries, 4.5+ rating. Featured in
          the directory.
        </p>
      </div>
    )
  }

  return (
    <div className="card p-5 border-l-4 border-l-volt">
      <div className="flex items-center justify-between gap-3 mb-3">
        <p className="nav-pill text-[10px] text-volt">
          {currentTier === 'silver' ? 'Silver Verified · Earn Gold' : 'Upgrade to Silver'}
        </p>
        {hasLicense && (
          <span className="text-xs text-volt">✓ License on file</span>
        )}
      </div>

      <p className="text-sm text-chalk leading-relaxed">
        {currentTier === 'silver' ? (
          <>
            You're Silver. To unlock <span className="text-wallet">Gold</span>: 50+ verified
            entries, 5+ reviews averaging 4.5★, license on file.
          </>
        ) : (
          <>
            Upload your UAE trade license. Combined with 3+ verified entries, your workshop
            auto-promotes to <span className="text-volt">Silver</span> — visible badge in the
            directory.
          </>
        )}
      </p>

      <label className="block mt-4 cursor-pointer">
        <input
          type="file"
          accept="image/*,.pdf"
          onChange={onChange}
          disabled={uploading}
          className="hidden"
        />
        <span
          className={`pill-outline text-sm inline-block ${uploading ? 'opacity-50' : ''}`}
        >
          {uploading
            ? 'Uploading…'
            : hasLicense
              ? 'Replace license'
              : 'Upload trade license'}
        </span>
      </label>

      {error && <p className="text-xs text-signal mt-2">{error}</p>}

      <p className="text-xs text-ash/70 mt-3 leading-relaxed">
        License stored privately. Only your workshop members can access. PDF or image, max ~10MB.
      </p>
    </div>
  )
}
