/**
 * /admin/documents/[id] — extraction diagnostic.
 *
 * Renders a single vehicle_documents row with its per-file extraction
 * results side-by-side with the actual uploaded file. The whole point
 * is to make it obvious WHICH file's vision call produced WHICH value,
 * so when a customer reports "the year is wrong" we can pinpoint the
 * misclassification without spelunking jsonb in psql.
 *
 * Admin-only. Uses createAdminClient (service role) so RLS doesn't
 * apply — we can read every doc and sign URLs for every storage object
 * regardless of agent grants.
 */
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const TYPE_LABEL: Record<string, string> = {
  auto: 'Auto-classified',
  mulkiya: 'Mulkiya',
  insurance_policy: 'Insurance',
  driving_licence: 'Driving licence',
  noc: 'NOC',
  pollution_test: 'Pollution test',
  service_history: 'Service history',
  other: 'Other',
}

// Field display order — groups related fields so the eye walks the
// extraction the same way it walks the source document.
const FIELD_GROUPS: Array<{ heading: string; fields: string[] }> = [
  {
    heading: 'Classification',
    fields: ['detected_doc_type', 'detected_doc_confidence', 'document_number'],
  },
  {
    heading: 'Vehicle identity',
    fields: [
      'vehicle_make',
      'vehicle_model',
      'year',
      'color',
      'body_type',
      'category',
      'country_of_origin',
      'use_of_vehicle',
    ],
  },
  {
    heading: 'Spec',
    fields: [
      'cylinders',
      'doors',
      'seats',
      'fuel_type',
      'engine_number',
      'vin',
      'gross_weight_kg',
      'empty_weight_kg',
    ],
  },
  {
    heading: 'Registration',
    fields: [
      'plate_number',
      'plate_emirate',
      'plate_type',
      'registration_date',
      'registration_authority',
      'mortgage_by',
      'expires_at',
    ],
  },
  {
    heading: 'Owner',
    fields: ['owner_name', 'owner_nationality', 'traffic_code_no'],
  },
  {
    heading: 'Insurance',
    fields: [
      'insurance_company',
      'insurance_policy_number',
      'insurance_cover_type',
      'insurance_cover_plan',
      'insurance_commencement_at',
      'insurance_expires_at',
      'insurance_premium_aed',
      'insurance_insured_value_aed',
    ],
  },
]

type DocRow = {
  id: string
  vehicle_id: string
  doc_type: string
  label: string | null
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  expires_at: string | null
  uploaded_by: string
  archived_at: string | null
  extraction_status: string | null
  extraction_error: string | null
  extracted_at: string | null
  extracted_data: Record<string, unknown> | null
  created_at: string
  vehicles: {
    make: string
    model: string
    nickname: string | null
    plate_emirate: string | null
    plate_number: string | null
    owner_id: string
  } | null
}

type FileRow = {
  id: string
  storage_path: string
  file_type: string | null
  file_size_bytes: number | null
  position: number
}

export default async function AdminDocumentDetail({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

  const [{ data: docRaw, error: docErr }, { data: filesRaw }] =
    await Promise.all([
      supabase
        .from('vehicle_documents')
        .select(
          'id, vehicle_id, doc_type, label, storage_path, file_type, file_size_bytes, expires_at, uploaded_by, archived_at, extraction_status, extraction_error, extracted_at, extracted_data, created_at, vehicles(make, model, nickname, plate_emirate, plate_number, owner_id)',
        )
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('vehicle_document_files')
        .select('id, storage_path, file_type, file_size_bytes, position')
        .eq('document_id', id)
        .order('position', { ascending: true }),
    ])

  if (docErr || !docRaw) notFound()
  const doc = docRaw as unknown as DocRow
  const files = (filesRaw ?? []) as FileRow[]

  // Sign URLs for each file so we can render the actual upload next to
  // its extraction. 5 minute TTL is plenty for an admin diagnostic
  // session.
  const signedUrls = await Promise.all(
    files.map(async (f) => {
      const { data } = await supabase.storage
        .from('vehicle-docs')
        .createSignedUrl(f.storage_path, 300)
      return data?.signedUrl ?? null
    }),
  )

  // Look up uploader email (best-effort; admin client can read auth.users).
  const { data: uploader } = await supabase
    .from('profiles')
    .select('email, full_name')
    .eq('id', doc.uploaded_by)
    .maybeSingle()

  const extracted = (doc.extracted_data ?? {}) as Record<string, unknown>
  const perFile = (extracted.per_file_extractions ?? []) as Array<
    Record<string, unknown>
  >

  const vehicleLabel = doc.vehicles
    ? `${doc.vehicles.make} ${doc.vehicles.model}`
    : doc.vehicle_id

  return (
    <div className="px-6 md:px-10 py-8 max-w-7xl">
      <header className="mb-6">
        <Link
          href="/admin/documents"
          className="text-[11px] tracking-widest uppercase text-ash hover:text-chalk"
        >
          ← Documents
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-3">
          Extraction diagnostic
        </h1>
        <p className="text-xs text-ash mt-1 font-mono">{doc.id}</p>
      </header>

      {/* Status banner */}
      <ExtractionStatusBanner
        status={doc.extraction_status}
        error={doc.extraction_error}
        extractedAt={doc.extracted_at}
      />

      {/* Top metadata strip */}
      <div className="card p-4 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetaCell label="Type" value={TYPE_LABEL[doc.doc_type] ?? doc.doc_type} />
        <MetaCell
          label="Files"
          value={files.length > 0 ? files.length.toString() : '—'}
        />
        <MetaCell
          label="Vehicle"
          value={vehicleLabel}
          href={`/admin/vehicles?q=${doc.vehicle_id}`}
        />
        <MetaCell
          label="Uploader"
          value={
            (uploader?.full_name as string | null) ??
            (uploader?.email as string | null) ??
            doc.uploaded_by.slice(0, 8)
          }
        />
        <MetaCell
          label="Uploaded"
          value={new Date(doc.created_at).toLocaleString('en-GB')}
        />
        <MetaCell
          label="Extracted"
          value={
            doc.extracted_at
              ? new Date(doc.extracted_at).toLocaleString('en-GB')
              : '—'
          }
        />
        <MetaCell
          label="Doc expires"
          value={doc.expires_at ?? '—'}
          mono
        />
        <MetaCell
          label="Size"
          value={
            doc.file_size_bytes
              ? `${Math.round(doc.file_size_bytes / 1024)} KB`
              : '—'
          }
          mono
        />
      </div>

      {/* Per-file extractions */}
      <section className="mb-8">
        <header className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Per-file extractions
          </h2>
          <p className="text-xs text-ash mt-1">
            What each upload returned individually — before the merge
            step. detected_doc_type drives the priority allowlist.
            Inspect rows where it&apos;s null or wrong to debug field misses.
          </p>
        </header>

        {perFile.length === 0 && files.length === 0 && (
          <div className="card p-6 text-center text-ash text-sm">
            No per-file extraction data — extraction never ran for this
            document.
          </div>
        )}

        <div className="space-y-4">
          {files.map((file, idx) => {
            const extraction = perFile[idx] ?? null
            const url = signedUrls[idx] ?? null
            return (
              <FileBlock
                key={file.id}
                fileIndex={idx + 1}
                file={file}
                signedUrl={url}
                extraction={extraction}
              />
            )
          })}
        </div>
      </section>

      {/* Merged result */}
      <section className="mb-8">
        <header className="mb-3">
          <h2 className="text-lg font-semibold tracking-tight">
            Merged result
          </h2>
          <p className="text-xs text-ash mt-1">
            What ended up stored after mergeExtractions ran the priority
            allowlist + permissive fallback. This is what the customer
            sees on /vehicles/[id].
          </p>
        </header>
        <FieldGrid extraction={extracted} />
      </section>

      {/* Raw JSON */}
      <section>
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold tracking-tight">
            Raw extracted_data JSON
          </summary>
          <pre className="mt-4 text-[11px] font-mono text-ash bg-noir/40 p-4 rounded-DEFAULT overflow-x-auto leading-relaxed">
            {JSON.stringify(doc.extracted_data, null, 2)}
          </pre>
        </details>
      </section>
    </div>
  )
}

function ExtractionStatusBanner({
  status,
  error,
  extractedAt,
}: {
  status: string | null
  error: string | null
  extractedAt: string | null
}) {
  if (!status) {
    return (
      <div className="card p-4 mb-4 bg-iron/30">
        <p className="text-xs text-ash">
          No extraction status — this doc was uploaded before extraction
          was wired up.
        </p>
      </div>
    )
  }
  if (status === 'applied' || status === 'ready') {
    return (
      <div className="card p-4 mb-4 border-volt/30 bg-volt/5">
        <p className="text-xs tracking-widest uppercase text-volt font-semibold">
          Extraction applied
        </p>
        {extractedAt && (
          <p className="text-[11px] text-ash mt-1">
            {new Date(extractedAt).toLocaleString('en-GB')}
          </p>
        )}
      </div>
    )
  }
  if (status === 'failed') {
    return (
      <div className="card p-4 mb-4 border-signal/30 bg-signal/5">
        <p className="text-xs tracking-widest uppercase text-signal font-semibold">
          Extraction failed
        </p>
        {error && (
          <p className="text-sm text-chalk mt-2 leading-relaxed">{error}</p>
        )}
      </div>
    )
  }
  if (status === 'pending') {
    return (
      <div className="card p-4 mb-4 border-wallet/30 bg-wallet/5">
        <p className="text-xs tracking-widest uppercase text-wallet font-semibold">
          Extraction pending
        </p>
      </div>
    )
  }
  return (
    <div className="card p-4 mb-4 bg-iron/30">
      <p className="text-xs text-ash">Status: {status}</p>
    </div>
  )
}

function FileBlock({
  fileIndex,
  file,
  signedUrl,
  extraction,
}: {
  fileIndex: number
  file: FileRow
  signedUrl: string | null
  extraction: Record<string, unknown> | null
}) {
  const isImage = (file.file_type ?? '').startsWith('image/')
  return (
    <div className="card overflow-hidden">
      <header className="px-4 py-3 border-b border-seam bg-iron/30 flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs tracking-widest uppercase text-leaf font-semibold">
            File {fileIndex}
          </p>
          <p className="text-[11px] text-ash font-mono truncate">
            {file.storage_path}
          </p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-ash font-mono">
          <span>{file.file_type ?? 'unknown'}</span>
          {file.file_size_bytes && (
            <span>{Math.round(file.file_size_bytes / 1024)} KB</span>
          )}
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-leaf hover:underline"
            >
              Open
            </a>
          )}
        </div>
      </header>

      <div className="grid md:grid-cols-[280px_1fr]">
        {/* Preview */}
        <div className="border-r border-seam bg-noir/30 flex items-center justify-center p-4 min-h-[200px]">
          {signedUrl && isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={`File ${fileIndex}`}
              className="max-w-full max-h-[400px] object-contain"
            />
          ) : signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-ash hover:text-chalk text-center"
            >
              <p className="mb-2 font-mono">{file.file_type}</p>
              <p>Click Open to view ↗</p>
            </a>
          ) : (
            <p className="text-xs text-ash">No preview</p>
          )}
        </div>

        {/* Extraction */}
        <div className="p-4">
          {extraction ? (
            <FieldGrid extraction={extraction} />
          ) : (
            <p className="text-xs text-ash italic">
              No extraction result for this file (per_file_extractions
              array shorter than file list — extraction may have failed
              or been skipped).
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FieldGrid({
  extraction,
}: {
  extraction: Record<string, unknown>
}) {
  return (
    <div className="space-y-3">
      {FIELD_GROUPS.map((group) => {
        const rows = group.fields
          .map((f) => [f, extraction[f]] as [string, unknown])
          .filter(([, v]) => v !== undefined)

        // Show the group even if all values are null — for diagnostic
        // value we want to see what was attempted and what came back empty.
        if (rows.length === 0) return null
        return (
          <div key={group.heading}>
            <p className="text-[10px] tracking-widest uppercase text-leaf font-semibold mb-1.5">
              {group.heading}
            </p>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
              {rows.map(([field, value]) => (
                <div
                  key={field}
                  className="flex items-baseline justify-between gap-3 border-b border-seam/30 py-1"
                >
                  <dt className="text-ash truncate">{field}</dt>
                  <dd
                    className={`font-mono text-right break-all ${
                      value == null ? 'text-ash/40' : 'text-chalk'
                    }`}
                  >
                    {value == null ? 'null' : String(value)}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </div>
  )
}

function MetaCell({
  label,
  value,
  href,
  mono,
}: {
  label: string
  value: string
  href?: string
  mono?: boolean
}) {
  const body = (
    <>
      <p className="text-[10px] tracking-widest uppercase text-ash">{label}</p>
      <p
        className={`text-sm text-chalk mt-1 leading-tight truncate ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
    </>
  )
  if (href) {
    return (
      <Link href={href} className="block hover:bg-iron/30 rounded-DEFAULT -m-2 p-2">
        {body}
      </Link>
    )
  }
  return <div>{body}</div>
}
