'use client'

import { useState } from 'react'
import { submitReview } from '@/app/actions/reviews'

export function ReviewForm({
  recordId,
  vehicleId,
  existingRating,
  existingComment,
}: {
  recordId: string
  vehicleId: string
  existingRating?: number | null
  existingComment?: string | null
}) {
  const [open, setOpen] = useState(false)
  const [rating, setRating] = useState<number>(existingRating ?? 0)
  const [hover, setHover] = useState<number>(0)

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
    <form action={submitReview} className="mt-3 card p-4 space-y-3 border-volt/30">
      <input type="hidden" name="record_id" value={recordId} />
      <input type="hidden" name="vehicle_id" value={vehicleId} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <p className="nav-pill text-[10px] mb-2">Your rating</p>
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

      <div className="flex gap-2">
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
