'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function AgentTradeLicenseUpload({
  agentId,
  hasLicense,
  currentTier,
}: {
  agentId: string
  hasLicense: boolean
  currentTier: 'unverified' | 'silver' | 'gold' | string
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
    const path = `agents/${agentId}/trade-license/${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('workshop-docs')
      .upload(path, file, { contentType: file.type, upsert: true })

    if (uploadError) {
      setError(uploadError.message)
      setUploading(false)
      return
    }

    const { error: rpcError } = await supabase.rpc('set_agent_trade_license', {
      p_agent_id: agentId,
      p_url: path,
    })

    if (rpcError) {
      setError(rpcError.message)
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
          Top tier — trade license verified, customer code redemption is open,
          and your desk is featured in the public agent directory.
        </p>
      </div>
    )
  }

  const isVerified = currentTier === 'silver' || currentTier === 'gold'

  return (
    <div
      className={`card p-5 border-l-4 ${
        isVerified ? 'border-l-volt' : 'border-l-signal'
      }`}
    >
      <div className="flex items-center justify-between gap-3 mb-3">
        <p
          className={`nav-pill text-[10px] ${
            isVerified ? 'text-volt' : 'text-signal'
          }`}
        >
          {currentTier === 'silver'
            ? 'Silver Verified · Earn Gold'
            : 'Verification required'}
        </p>
        {hasLicense && (
          <span className="text-xs text-volt">✓ License on file</span>
        )}
      </div>

      <p className="text-sm text-chalk leading-relaxed">
        {currentTier === 'silver' ? (
          <>
            You're Silver. To unlock <span className="text-wallet">Gold</span>:
            consistent customer redemptions + good standing in customer
            disclosures.
          </>
        ) : (
          <>
            <span className="text-signal">
              Until your trade license is on file and verified, you cannot
              redeem customer share codes.
            </span>{' '}
            Upload your UAE trade license — Vehkit reviews and promotes you to{' '}
            <span className="text-volt">Silver</span>, which opens code
            redemption.
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
        Stored privately in the verification bucket. Reviewed manually by
        Vehkit ops within 24 hours. PDF or image, max 10MB.
      </p>
    </div>
  )
}
