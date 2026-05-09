import Link from 'next/link'
import {
  ConfirmButton,
  RetractButton,
  DeleteButton,
} from '@/components/ServiceRecordActions'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { ReviewForm } from '@/components/ReviewForm'
import { StarRating } from '@/components/StarRating'
import { humanize, relativeDate } from '@/lib/format'

/**
 * Single service-history list-item rendered in PropertyFinder list rhythm.
 *
 * Layout:
 *   ┌──────────────────────────────────────────────┐
 *   │ [Avatar] Workshop name · status     [actions]│   ← primary row
 *   │          service · AED · km · date            │
 *   │          [photos / notes / review / form]     │   ← extras (when any)
 *   └──────────────────────────────────────────────┘
 *
 * Avatar size + content indent stay in lockstep via the constants below —
 * change AVATAR_SIZE_PX once, the indent follows.
 */

const AVATAR_SIZE_PX = 40
const ROW_GAP_PX = 12
const CONTENT_INDENT_PX = AVATAR_SIZE_PX + ROW_GAP_PX

export type ServiceFile = { storage_path: string }

export type ServiceReview = {
  id: string
  rating: number
  comment: string | null
  quality_rating: number | null
  value_rating: number | null
  timeliness_rating: number | null
}

export type ServiceRecord = {
  id: string
  attestation: 'workshop' | 'receipt' | 'owner' | string
  workshop_name_freetext: string | null
  service_type: string
  service_date: string
  cost_aed: number | null
  odometer: number | null
  notes: string | null
  created_at: string
  confirmed_at: string | null
  service_files?: ServiceFile[] | null
  workshop_reviews?: ServiceReview[] | null
}

export function ServiceRecordRow({
  record,
  vehicleId,
  isOwner,
  autoOpenReview = false,
}: {
  record: ServiceRecord
  vehicleId: string
  isOwner: boolean
  autoOpenReview?: boolean
}) {
  const photos = (record.service_files ?? [])
    .map((f) => f.storage_path)
    .filter(Boolean)
  const ageMs = Date.now() - new Date(record.created_at).getTime()
  const isConfirmed = !!record.confirmed_at
  const isPending =
    record.attestation === 'workshop' &&
    !isConfirmed &&
    ageMs < 24 * 60 * 60 * 1000
  const hoursLeft = isPending
    ? Math.max(1, Math.ceil((24 * 60 * 60 * 1000 - ageMs) / (60 * 60 * 1000)))
    : 0
  const review = record.workshop_reviews?.[0]
  const workshopName = record.workshop_name_freetext || 'Owner-logged'
  const initials =
    workshopName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('') || '·'

  const hasExtras = photos.length > 0 || !!record.notes || !!review
  const showReview =
    isOwner && record.attestation === 'workshop' && !isPending
  const showAuxiliary = hasExtras || showReview || (!isOwner && isPending)
  const showActionCluster = isOwner

  const avatarTone =
    record.attestation === 'workshop'
      ? isPending
        ? 'bg-wallet/20 text-wallet'
        : 'bg-volt/20 text-volt'
      : 'bg-iron text-ash'

  return (
    <li className="card p-4">
      {/* Primary row */}
      <div className="flex items-center gap-3">
        <div
          className={`rounded-pill flex items-center justify-center shrink-0 font-mono text-xs font-semibold tracking-tighter ${avatarTone}`}
          style={{ width: AVATAR_SIZE_PX, height: AVATAR_SIZE_PX }}
        >
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm md:text-base font-semibold text-chalk truncate leading-snug">
              {workshopName}
            </p>
            {record.attestation === 'workshop' && isPending && (
              <span className="text-[10px] tracking-widest uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium shrink-0">
                {hoursLeft}h
              </span>
            )}
            {record.attestation === 'workshop' && !isPending && (
              <span
                className="text-volt shrink-0"
                aria-label="Verified"
                title="Verified"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
            )}
            {record.attestation === 'receipt' && (
              <span className="text-[10px] tracking-widest uppercase text-ash shrink-0">
                Receipt
              </span>
            )}
          </div>
          <p className="text-xs text-ash mt-0.5 truncate">
            <span className="text-chalk/90">{humanize(record.service_type)}</span>
            {record.cost_aed != null && (
              <>
                {' · '}
                <span className="font-mono tabular-nums">
                  AED {Number(record.cost_aed).toLocaleString()}
                </span>
              </>
            )}
            {record.odometer != null && (
              <>
                {' · '}
                <span className="font-mono tabular-nums">
                  {record.odometer.toLocaleString()}km
                </span>
              </>
            )}
            {' · '}
            {relativeDate(record.service_date)}
          </p>
        </div>

        {showActionCluster && (
          <div className="flex items-center gap-1.5 shrink-0">
            {isPending && (
              <>
                <ConfirmButton recordId={record.id} vehicleId={vehicleId} />
                <RetractButton recordId={record.id} vehicleId={vehicleId} />
              </>
            )}
            {record.attestation !== 'workshop' && (
              <>
                <Link
                  href={`/vehicles/${vehicleId}/service/${record.id}/edit`}
                  aria-label="Edit entry"
                  title="Edit entry"
                  className="w-9 h-9 inline-flex items-center justify-center rounded-pill bg-iron text-ash hover:bg-iron/70 border border-seam transition-colors"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </Link>
                <DeleteButton recordId={record.id} vehicleId={vehicleId} />
              </>
            )}
          </div>
        )}
      </div>

      {/* Auxiliary content — aligned under the content column */}
      {showAuxiliary && (
        <div className="mt-3" style={{ paddingLeft: CONTENT_INDENT_PX }}>
          {photos.length > 0 && (
            <div className="-mx-1">
              <PhotoLightbox photos={photos} />
            </div>
          )}

          {record.notes && (
            <p className="text-xs text-ash/85 leading-relaxed mt-2 italic line-clamp-2">
              &quot;{record.notes}&quot;
            </p>
          )}

          {review && (
            <div className="flex items-center gap-2 mt-2">
              <StarRating rating={review.rating} size="sm" />
              {review.comment && (
                <span className="text-xs text-ash italic truncate">
                  &quot;{review.comment}&quot;
                </span>
              )}
            </div>
          )}

          {!isOwner && isPending && (
            <p className="text-[10px] tracking-widest uppercase text-ash mt-2">
              Awaiting owner confirmation
            </p>
          )}

          {showReview && (
            <div className="mt-2">
              <ReviewForm
                recordId={record.id}
                vehicleId={vehicleId}
                existingRating={review?.rating ?? null}
                existingComment={review?.comment ?? null}
                existingQuality={review?.quality_rating ?? null}
                existingValue={review?.value_rating ?? null}
                existingTimeliness={review?.timeliness_rating ?? null}
                autoOpen={autoOpenReview}
              />
            </div>
          )}
        </div>
      )}
    </li>
  )
}
