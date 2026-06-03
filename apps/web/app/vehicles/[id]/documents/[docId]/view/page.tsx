import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Multi-file document viewer.
 *
 * Renders every file attached to the document — image thumbnails inline,
 * non-image files as cards with an "Open" button. Each file gets a fresh
 * 60-second signed URL minted server-side, so private bytes never leak.
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
       files:vehicle_document_files(id, storage_path, file_type, file_size_bytes, position)`,
    )
    .eq('id', docId)
    .eq('vehicle_id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (!doc) notFound()

  // Fall back to the parent's single storage_path if the child table is
  // empty (very early legacy rows). The parent path is always populated.
  type FileRow = {
    id: string
    storage_path: string
    file_type: string | null
    file_size_bytes: number | null
    position: number
  }
  const rawFiles: FileRow[] = doc.files && doc.files.length > 0
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

  // Mint signed URLs in parallel. 5 minutes is enough to render + click.
  const signed = await Promise.all(
    files.map(async (f) => {
      const { data } = await supabase.storage
        .from('vehicle-docs')
        .createSignedUrl(f.storage_path, 300)
      return { ...f, url: data?.signedUrl ?? null }
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
      <div className="max-w-[1240px] mx-auto px-6 md:px-10 pt-6 md:pt-8">
        <Link
          href={`/vehicles/${id}#documents`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← Back to vehicle
        </Link>

        <div className="mt-4 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <p className="nav-pill">{typeLabel}</p>
            <h1 className="text-2xl md:text-4xl font-semibold text-chalk tracking-tighter leading-tight mt-2">
              {title}
            </h1>
            <p className="text-sm text-ash mt-2">
              {files.length} {files.length === 1 ? 'file' : 'files'}
              {doc.expires_at && ` · Expires ${doc.expires_at}`}
            </p>
          </div>
        </div>

        {/* File grid — images render inline, PDFs / other types render as
            cards with an Open button. */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {signed.map((f, idx) => (
            <FileTile key={f.id} file={f} positionLabel={positionLabel(idx, files.length)} />
          ))}
        </div>
      </div>
    </main>
  )
}

/**
 * Friendly labels for the position. "Front" / "Back" when there are
 * exactly two files (covers the mulkiya case). Otherwise numeric.
 */
function positionLabel(idx: number, total: number): string {
  if (total === 2) return idx === 0 ? 'Front' : 'Back'
  return `Page ${idx + 1}`
}

function FileTile({
  file,
  positionLabel,
}: {
  file: {
    id: string
    storage_path: string
    file_type: string | null
    file_size_bytes: number | null
    url: string | null
  }
  positionLabel: string
}) {
  const isImage = file.file_type?.startsWith('image/')
  const isPdf = file.file_type === 'application/pdf'

  if (!file.url) {
    return (
      <div className="card p-4 text-sm text-signal">
        Could not generate a link for this file.
      </div>
    )
  }

  return (
    <a
      href={file.url}
      target="_blank"
      rel="noopener noreferrer"
      className="card overflow-hidden hover:border-leaf/30 transition-colors group block"
    >
      <div className="relative w-full aspect-[3/4] bg-iron overflow-hidden">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={file.url}
            alt={positionLabel}
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ash">
            <svg
              width="56"
              height="56"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            <span className="text-[10px] tracking-widest uppercase">
              {isPdf ? 'PDF' : 'File'}
            </span>
          </div>
        )}
      </div>
      <div className="p-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-chalk leading-tight">
            {positionLabel}
          </p>
          {file.file_size_bytes != null && (
            <p className="text-[11px] text-ash mt-0.5 font-mono tabular-nums">
              {(file.file_size_bytes / 1024).toFixed(0)} KB
            </p>
          )}
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
