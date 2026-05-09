'use client'

import { useState } from 'react'
import { submitReview } from '@/app/actions/reviews'

type Axis = 'quality' | 'value' | 'timeliness'

export function ReviewForm({
  recordId,
  vehicleId,
  existingRating,
  existingComment,
  existingQuality,
  existingValue,
  existingTimeliness,
  autoOpen = false,
}: {
  recordId: string
  vehicleId: string
  existingRating?: number | null
  existingComment?: string | null
  existingQuality?: number | null
  existingValue?: number | null
  existingTimeliness?: number | null
  autoOpen?: boolean
}) {
  const [open, setOpen] = useState(autoOpen)
  const [rating, setRating] = useState<number>(existingRating ?? 0)
  const [hover, setHover] = useState<number>(0)
  const [axes, setAxes] = useState<Record<Axis, number>>({
    quality: existingQuality ?? 0,
    value: existingValue ?? 0,
    timeliness: existingTimeliness ?? 0,
  })
  const [showAxes, setShowAxes] = useState<boolean>(
    !!(existingQuality || existingValue || existingTimeliness)
  )

  const isEditing = existingRating != null

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs tracking-widest uppercase text-volt hover:text-volt/80 transition-colors"
      >
        {isEditing ? 'Edit review' : 'Rate this workshop'}
      </button>
    )
  }

  return (
    <form
      action={submitReview}
      className="mt-3 card p-4 space-y-4 border-volt/30"
      id={`review-${recordId}`}
    >
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="hidden" name="rating" value={rating} />
      <input type="hidden" name="quality_rating" value={axes.quality || ''} />
      <input type="hidden" name="value_rating" value={axes.value || ''} />
      <input type="hidden" name="timeliness_rating" value={axes.timeliness || ''} />

      <div>
        <p className="text-[10px] tracking-widest uppercase text-ash mb-2">Overall rating</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              className={`text-3xl transition-colors ${
                n <= (hover || rating) ? 'text-wallet' : 'text-seam hover:text-wallet/40'
              }`}
              aria-label={`Rate ${n} stars`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="label">
          Comment (optional)
        </label>
        <textarea
          name="comment"
          id="comment"
          rows={2}
          maxLength={500}
          defaultValue={existingComment ?? ''}
          placeholder="Quick notes — quality, speed, transparency…"
          className="field resize-none text-sm"
        />
      </div>

      {/* Optional drill-down */}
      <div className="border-t border-seam pt-3">
        {!showAxes ? (
          <button
            type="button"
            onClick={() => setShowAxes(true)}
            className="text-[11px] tracking-widest uppercase text-ash hover:text-chalk transition-colors"
          >
            + Rate quality / value / timeliness
          </button>
        ) : (
          <div className="space-y-3">
            <p className="text-[10px] tracking-widest uppercase text-ash">
              Optional details
            </p>
            <AxisRow
              label="Quality"
              value={axes.quality}
              onChange={(v) => setAxes((a) => ({ ...a, quality: v }))}
            />
            <AxisRow
              label="Value"
              value={axes.value}
              onChange={(v) => setAxes((a) => ({ ...a, value: v }))}
            />
            <AxisRow
              label="Timeliness"
              value={axes.timeliness}
              onChange={(v) => setAxes((a) => ({ ...a, timeliness: v }))}
            />
            <button
              type="button"
              onClick={() => {
                setShowAxes(false)
                setAxes({ quality: 0, value: 0, timeliness: 0 })
              }}
              className="text-[11px] tracking-widest uppercase text-ash/70 hover:text-ash"
            >
              Skip these
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="pill-ghost text-sm flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={rating === 0}
          className="pill-primary text-sm flex-1 disabled:opacity-50"
        >
          {isEditing ? 'Update' : 'Submit'}
        </button>
      </div>
    </form>
  )
}

function AxisRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-chalk min-w-[80px]">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? 0 : n)}
            className={`text-xl transition-colors ${
              n <= value ? 'text-wallet' : 'text-seam hover:text-wallet/40'
            }`}
            aria-label={`${label} ${n} stars`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}
