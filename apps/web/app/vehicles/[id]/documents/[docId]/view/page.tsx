import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { applyExtractedToVehicle } from '@/app/actions/documents'
import type { ExtractedMulkiya } from '@/lib/extract-mulkiya'

/**
 * Multi-file document viewer.
 *
 * Renders every file attached to the document with an inline image
 * thumbnail when the type is image/*, a PDF/file card otherwise. Each
 * file gets a fresh 5-minute signed URL minted server-side.
 *
 * Path: /vehicles/[id]/documents/[docId]/view
 *
 * RLS guards: vehicle_documents SELECT policy already gates row access
 * (owner / family / agent grant). vehicle_document_files SELECT inherits
 * via the policy in 20260510000013_vehicle_document_files.sql.
 */
export default async function DocumentViewPage({
  params,
}: {
  params: Promise<{ id: string; docId: string }>
}) {
  const { id, docId } = await params

  const supabase = await createClient()

  const { data: doc } = await supabase
    .from('vehicle_documents')
    .select(
      `id, doc_type, label, storage_path, file_type, expires_at, created_at,
       extracted_data, extraction_status, extraction_error,
       files:vehicle_document_files(id, storage_path, file_type, file_size_bytes, position)`,
    )
    .eq('id', docId)
    .eq('vehicle_id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!doc) notFound()

  // Fall back to the parent's single storage_path if the child table is
  // empty (legacy single-file docs uploaded before the multi-file migration).
  type FileRow = {
    id: string
    storage_path: string
    file_type: string | null
    file_size_bytes: number | null
    position: number
  }
  const rawFiles: FileRow[] =
    doc.files && doc.files.length > 0
      ? (doc.files as FileRow[])
      : [
          {
            id: 'parent',
            storage_path: doc.storage_path,
            file_type: doc.file_type,
            file_size_bytes: null,
            position: 0,
          },
        ]

  const files = rawFiles.sort((a, b) => a.position - b.position)

  // Mint signed URLs in parallel; capture errors per-file so the tile can
  // explain WHY it failed instead of a vague "could not generate link".
  const signed = await Promise.all(
    files.map(async (f) => {
      const { data, error } = await supabase.storage
        .from('vehicle-docs')
        .createSignedUrl(f.storage_path, 300)
      return {
        ...f,
        url: data?.signedUrl ?? null,
        error: error?.message ?? null,
      }
    }),
  )

  const TYPE_LABELS: Record<string, string> = {
    mulkiya: 'Mulkiya',
    insurance_policy: 'Insurance',
    driving_licence: 'Driving licence',
    noc: 'NOC',
    pollution_test: 'Pollution test',
    service_history: 'Service history',
    other: 'Document',
  }
  const typeLabel = TYPE_LABELS[doc.doc_type] ?? 'Document'
  const title = doc.label ?? typeLabel

  return (
    <main className="min-h-[100svh] pb-24 md:pb-12">
      <div className="max-w-[1240px] mx-auto px-5 md:px-10 pt-5 md:pt-8">
        <Link
          href={`/vehicles/${id}#documents`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← Back to vehicle
        </Link>

        <div className="mt-3 md:mt-4">
          <p className="nav-pill">{typeLabel}</p>
          <h1 className="text-xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight mt-2">
            {title}
          </h1>
          <p className="text-sm text-ash mt-1.5">
            {files.length} {files.length === 1 ? 'file' : 'files'}
            {doc.expires_at && ` · Expires ${doc.expires_at}`}
          </p>
        </div>

        {/* Extraction status / extracted-fields card (mulkiya only) */}
        {doc.doc_type === 'mulkiya' && (
          <ExtractionCard
            vehicleId={id}
            docId={doc.id}
            status={doc.extraction_status}
            error={doc.extraction_error}
            extracted={
              doc.extracted_data as ExtractedMulkiya | null
            }
          />
        )}

        {/* Mobile: stacked list of compact rows.
            Desktop: 2/3-col grid of vertical tiles with bigger thumbnails. */}
        <ul className="mt-6 md:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {signed.map((f, idx) => (
            <li key={f.id}>
              <FileTile
                file={f}
                positionLabel={positionLabel(idx, files.length)}
              />
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}

/**
 * Friendly labels for the position. "Front" / "Back" when there are
 * exactly two files (mulkiya, driving licence, NOC); otherwise "Page N".
 */
function positionLabel(idx: number, total: number): string {
  if (total === 1) return 'File'
  if (total === 2) return idx === 0 ? 'Front' : 'Back'
  return `Page ${idx + 1}`
}

type SignedFile = {
  id: string
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  url: string | null
  error: string | null
}

function FileTile({
  file,
  positionLabel,
}: {
  file: SignedFile
  positionLabel: string
}) {
  const isImage = file.file_type?.startsWith('image/')
  const isPdf = file.file_type === 'application/pdf'

  // Error state — surface the actual problem instead of a vague label.
  if (!file.url) {
    return (
      <div className="card p-4 border border-signal/30 bg-signal/[0.04]">
        <p className="text-[10px] tracking-widest uppercase text-signal">
          {positionLabel} · Couldn&apos;t load
        </p>
        <p className="text-xs text-chalk mt-1.5 leading-snug break-words">
          {file.error ?? 'Signed URL not generated.'}
        </p>
        <p className="text-[10px] text-ash/70 mt-2 font-mono break-all">
          {file.storage_path}
        </p>
      </div>
    )
  }

  // Phone: compact horizontal row — 80px square thumb on left, info on right.
  // Tablet+ : full vertical tile with large 3/4 thumbnail.
  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card overflow-hidden hover:border-leaf/30 transition-colors group block flex flex-row sm:flex-col"
    >
      {/* Thumbnail */}
      <div
        className="relative bg-iron overflow-hidden shrink-0
                   w-24 h-24 sm:w-full sm:h-auto sm:aspect-[3/4]"
      >
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={positionLabel}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ash">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className="sm:w-12 sm:h-12"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[9px] tracking-widest uppercase">
              {isPdf ? 'PDF' : 'File'}
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3 sm:p-4 flex items-center justify-between gap-3 flex-1 min-w-0">
        <div className="min-w-0">
          <p className="text-sm md:text-base font-semibold text-chalk leading-tight truncate">
            {positionLabel}
          </p>
          <p className="text-[11px] text-ash mt-0.5">
            {(isImage ? 'Image' : isPdf ? 'PDF' : 'File')}
            {file.file_size_bytes != null && (
              <>
                {' · '}
                <span className="font-mono tabular-nums">
                  {(file.file_size_bytes / 1024).toFixed(0)} KB
                </span>
              </>
            )}
          </p>
        </div>
        <span className="text-xs tracking-widest uppercase text-leaf shrink-0 inline-flex items-center gap-1.5">
          Open
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
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </a>
  )
}

/**
 * Mulkiya extraction surface — shows pending / ready / failed / applied
 * state. When ready, lists the fields Claude pulled and offers to apply
 * them to the vehicle profile.
 */
function ExtractionCard({
  vehicleId,
  docId,
  status,
  error,
  extracted,
}: {
  vehicleId: string
  docId: string
  status: 'pending' | 'ready' | 'failed' | 'applied' | null
  error: string | null
  extracted: ExtractedMulkiya | null
}) {
  if (!status) return null

  if (status === 'pending') {
    return (
      <div className="mt-6 card p-5 border border-leaf/30 bg-leaf/5">
        <div className="flex items-center gap-3">
          <span
            className="w-5 h-5 rounded-full border-2 border-leaf/40 border-t-leaf animate-spin shrink-0"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-chalk">
              Reading your mulkiya…
            </p>
            <p className="text-xs text-ash mt-0.5">
              We&apos;re pulling the plate, VIN, make &amp; model, and expiry.
              Refresh in a few seconds.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'failed') {
    return (
      <div className="mt-6 card p-5 border border-signal/30 bg-signal/[0.04]">
        <p className="text-xs tracking-widest uppercase text-signal">
          Couldn&apos;t read this mulkiya
        </p>
        <p className="text-sm text-chalk mt-2 leading-snug">
          {error ?? 'Try a clearer photo with all four corners visible.'}
        </p>
      </div>
    )
  }

  if (status === 'applied') {
    return (
      <div className="mt-6 card p-5 border border-leaf/30 bg-leaf/5">
        <p className="text-xs tracking-widest uppercase text-leaf">
          ✓ Applied to your car
        </p>
        <p className="text-xs text-ash mt-2 leading-snug">
          The details from this mulkiya have been added to the vehicle.
        </p>
      </div>
    )
  }

  // status === 'ready'
  if (!extracted) return null

  const fields: Array<{ label: string; value: string | number | null }> = [
    { label: 'Make', value: extracted.vehicle_make },
    { label: 'Model', value: extracted.vehicle_model },
    { label: 'Year', value: extracted.year },
    { label: 'Plate', value: extracted.plate_number },
    { label: 'Emirate', value: extracted.plate_emirate },
    { label: 'VIN', value: extracted.vin },
    { label: 'Expires', value: extracted.expires_at },
  ]
  const populated = fields.filter((f) => f.value != null && f.value !== '')

  if (populated.length === 0) return null

  return (
    <div className="mt-6 card p-5 md:p-6 border border-leaf/40 bg-leaf/5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="text-[10px] tracking-widest uppercase text-leaf">
            ✨ We found these details
          </p>
          <h3 className="text-lg md:text-xl font-semibold text-chalk mt-1 leading-tight">
            Apply them to your car?
          </h3>
          <p className="text-xs text-ash mt-2 leading-relaxed max-w-md">
            Read straight from your mulkiya. We only fill in blanks — anything
            you&apos;ve already typed stays as you set it.
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-3">
        {populated.map((f) => (
          <div key={f.label} className="min-w-0">
            <dt className="text-[10px] tracking-widest uppercase text-ash">
              {f.label}
            </dt>
            <dd className="text-sm md:text-base font-semibold text-chalk mt-1 font-mono tabular-nums tracking-tight truncate">
              {String(f.value)}
            </dd>
          </div>
        ))}
      </dl>

      <form action={applyExtractedToVehicle} className="mt-5">
        <input type="hidden" name="document_id" value={docId} />
        <input type="hidden" name="vehicle_id" value={vehicleId} />
        <button type="submit" className="pill-primary inline-flex items-center gap-2">
          Apply to my car <span aria-hidden>→</span>
        </button>
      </form>
    </div>
  )
}
