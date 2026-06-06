'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  extractMulkiyaFromImage,
  mergeExtractions,
  type ExtractedMulkiya,
} from '@/lib/extract-mulkiya'

// maxDuration is set on the root layout so all server actions inherit
// 60s. Cannot be exported here because 'use server' files only allow
// async exports.

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

// 'auto' is the new default — frontend stops asking the user what the
// doc is. Extraction figures it out from the image and writes the
// detected type into extracted_data.detected_doc_type. The legacy enum
// values stay valid for older uploads and for any back-end caller that
// already knows what kind of doc it has.
const ALLOWED_DOC_TYPES = new Set([
  'auto',
  'mulkiya',
  'insurance_policy',
  'driving_licence',
  'noc',
  'pollution_test',
  'service_history',
  'other',
])

/**
 * Owner uploads a new vehicle document. Accepts ONE OR MANY files in the
 * same form post — front + back of a mulkiya, multi-page insurance, etc.
 *
 * Shape:
 *   - Inserts ONE row into vehicle_documents (the logical document)
 *   - Inserts N rows into vehicle_document_files (one per uploaded file)
 *   - First file is also denormalised onto the parent row's storage_path
 *     so legacy code paths that read the parent column still work.
 *
 * Failure modes: any upload or insert error rolls back any storage blobs
 * we already wrote, so we don't leave orphans.
 */
export async function createVehicleDocument(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const vehicleId = strOrNull(formData.get('vehicle_id'))
  const docTypeRaw = strOrNull(formData.get('doc_type'))
  if (!vehicleId) redirect('/garage')

  // The new FAB flow stops asking the user what the doc is. Anything
  // missing or unknown gets stored as 'auto' and extraction figures it
  // out. Legacy callers (older /documents/new page) still pass the
  // proper enum value, which we honour.
  const docType =
    docTypeRaw && ALLOWED_DOC_TYPES.has(docTypeRaw) ? docTypeRaw : 'auto'

  // Accept all files keyed under "file" — the input has `multiple`, so
  // the browser submits multiple entries with the same name. Cap at 10
  // to keep the vision token bill predictable.
  const allFiles = formData
    .getAll('file')
    .filter((v): v is File => v instanceof File && v.size > 0)
  const fileEntries = allFiles.slice(0, 10)

  if (fileEntries.length === 0) {
    redirect(`/vehicles/${vehicleId}?error=Pick+at+least+one+file`)
  }

  // Label and expires are no longer collected from the new flow — the
  // extractor fills expires_at from the document body if it's present.
  const label = strOrNull(formData.get('label'))
  const expiresAt = strOrNull(formData.get('expires_at'))

  // Upload all blobs first. Track paths so we can clean up on failure.
  //
  // We don't verify with createSignedUrl after each upload — storage RLS
  // requires a matching vehicle_documents row before a path becomes
  // readable, and that row hasn't been inserted yet at this point. The
  // legitimate failure case (storage.upload returns error) is caught
  // below; the silent-persistence-failure case is rare enough that we
  // accept it and rely on the user noticing if a file is missing on view.
  const uploadedPaths: string[] = []
  const fileMeta: Array<{ path: string; type: string; size: number }> = []

  for (let i = 0; i < fileEntries.length; i++) {
    const f = fileEntries[i]!
    const ext = f.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    // Random suffix defeats the rare case of two iterations sharing a
    // millisecond, which would collide with upsert: false.
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `vehicles/${vehicleId}/docs/${Date.now()}-${rand}-${docType}-${i}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('vehicle-docs')
      .upload(path, f, { contentType: f.type, upsert: false })

    if (upErr) {
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('vehicle-docs').remove(uploadedPaths)
      }
      redirect(
        `/vehicles/${vehicleId}/documents/new?error=${encodeURIComponent(`File ${i + 1}: ${upErr.message}`)}`,
      )
    }

    uploadedPaths.push(path)
    fileMeta.push({ path, type: f.type, size: f.size })
  }

  // Insert the parent document row. First file's metadata is denormalised
  // onto the parent for legacy callers; child rows hold the full set.
  const primary = fileMeta[0]!
  const { data: doc, error: insErr } = await supabase
    .from('vehicle_documents')
    .insert({
      vehicle_id: vehicleId,
      doc_type: docType,
      label,
      storage_path: primary.path,
      file_type: primary.type,
      file_size_bytes: primary.size,
      expires_at: expiresAt,
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  if (insErr || !doc) {
    await supabase.storage.from('vehicle-docs').remove(uploadedPaths)
    redirect(
      `/vehicles/${vehicleId}/documents/new?error=${encodeURIComponent(insErr?.message ?? 'Insert failed')}`,
    )
  }

  // Insert all child file rows. Position 0 = first file (front, primary).
  const fileRows = fileMeta.map((m, idx) => ({
    document_id: doc.id,
    vehicle_id: vehicleId,
    storage_path: m.path,
    file_type: m.type,
    file_size_bytes: m.size,
    position: idx,
    uploaded_by: user.id,
  }))

  const { error: childErr } = await supabase
    .from('vehicle_document_files')
    .insert(fileRows)

  if (childErr) {
    // Rollback: blobs + parent row
    await supabase.storage.from('vehicle-docs').remove(uploadedPaths)
    await supabase.from('vehicle_documents').delete().eq('id', doc.id)
    redirect(
      `/vehicles/${vehicleId}/documents/new?error=${encodeURIComponent(childErr.message)}`,
    )
  }

  // Run extraction for every upload — we no longer ask the user what
  // the doc is, so the model classifies + extracts in one pass. The
  // detected_doc_type field comes back in extracted_data and may later
  // be promoted onto the parent row's doc_type column once we trust
  // the classifier (currently parked as 'auto').
  await supabase
    .from('vehicle_documents')
    .update({ extraction_status: 'pending' })
    .eq('id', doc.id)

  await runMulkiyaExtraction(doc.id, fileEntries, vehicleId)

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}#documents`)
}

/**
 * Send any uploaded document image(s) to gpt-4o vision, classify the
 * type, extract the fields, write everything back to the document row.
 *
 * The model also tells us what kind of doc it thinks it is
 * (detected_doc_type). We persist that into extracted_data; the UI can
 * eventually promote it onto the parent doc_type column once we trust
 * the classifier across a real sample of uploads.
 *
 * Designed to NEVER throw — we always end with a status the UI can read.
 */
async function runMulkiyaExtraction(
  docId: string,
  files: File[],
  vehicleId: string,
): Promise<void> {
  try {
    // Only photos for now. PDFs need a different content shape — we'll
    // mark them failed with a friendly error rather than crashing. If
    // the user uploaded a mix, we extract from the images and silently
    // ignore the PDFs (they're still stored).
    const imageFiles = files.filter((f) => f.type.startsWith('image/'))
    if (imageFiles.length === 0) {
      const supabase = await createClient()
      await supabase
        .from('vehicle_documents')
        .update({
          extraction_status: 'failed',
          extraction_error: 'PDF reading is coming soon — for now upload photos.',
        })
        .eq('id', docId)
      return
    }

    // Extract each file INDEPENDENTLY in parallel. Bundling mixed doc
    // types (mulkiya + insurance + passing) into a single vision call
    // causes cross-contamination — the model picks barcode digits from
    // one doc as the plate of another, or sees a premium "1984.5" and
    // calls it the year. Per-file extraction gives each doc its own
    // clean context; the merge step picks the authoritative value per
    // field from the priority table in extract-mulkiya.ts.
    const perFile = await Promise.all(
      imageFiles.map(async (f) => {
        try {
          const buf = await f.arrayBuffer()
          const b64 = Buffer.from(buf).toString('base64')
          const result = await extractMulkiyaFromImage([
            { base64: b64, mimeType: f.type },
          ])
          return result
        } catch (err) {
          console.error('[runExtraction] per-file failed', err)
          return null
        }
      }),
    )
    const validResults = perFile.filter(
      (r): r is ExtractedMulkiya => r !== null,
    )

    const extracted = mergeExtractions(validResults)

    const supabase = await createClient()

    if (!extracted) {
      await supabase
        .from('vehicle_documents')
        .update({
          extraction_status: 'failed',
          extraction_error:
            'Could not read this document. Try a clearer photo with all corners visible.',
          extracted_at: new Date().toISOString(),
        })
        .eq('id', docId)
      return
    }

    // Promote derived fields onto the parent row so the legacy reminder
    // cron + the UI don't need to look inside the jsonb. The detected
    // doc type only gets promoted if the model was confident (>= 0.6)
    // and the detected value matches one of the allowed enum strings on
    // the column — otherwise we leave doc_type='auto' and rely on the
    // jsonb for downstream reads.
    // Store the merged record as the top-level extracted_data (the
    // shape every UI reader expects), but also tuck the per-file array
    // inside so we can audit later which doc contributed which value.
    // 30 days from now we'll mine this to see what's actually in users'
    // garages and design the proper UI around the real distribution.
    const docUpdates: Record<string, unknown> = {
      extracted_data: {
        ...extracted,
        per_file_extractions: validResults,
        per_file_count: validResults.length,
      },
      extraction_status: 'applied',
      extracted_at: new Date().toISOString(),
    }
    if (extracted.expires_at) {
      docUpdates.expires_at = extracted.expires_at
    }
    // Only promote doc_type when the bundle is unambiguously one kind
    // of document. A mixed bundle (mulkiya + insurance + passing) keeps
    // doc_type='auto' — otherwise the reminder cron mis-labels the
    // renewal and the UI shows the wrong category.
    const uniqueTypes = new Set(
      validResults
        .filter((r) => (r.detected_doc_confidence ?? 0) >= 0.6)
        .map((r) => r.detected_doc_type)
        .filter((t): t is NonNullable<typeof t> => t != null),
    )
    if (uniqueTypes.size === 1) {
      const singleType = [...uniqueTypes][0]!
      const mapping: Record<string, string> = {
        mulkiya: 'mulkiya',
        insurance_certificate: 'insurance_policy',
        insurance_policy_schedule: 'insurance_policy',
        driving_licence: 'driving_licence',
        noc: 'noc',
        pollution_test: 'pollution_test',
        rta_passing_certificate: 'pollution_test',
        service_invoice: 'service_history',
        service_history: 'service_history',
      }
      const mapped = mapping[singleType]
      if (mapped) docUpdates.doc_type = mapped
    }
    await supabase.from('vehicle_documents').update(docUpdates).eq('id', docId)

    // Auto-apply the identifying fields to the vehicle row. The mulkiya
    // is the source of truth, so we overwrite any earlier free-text
    // guesses (Tovota → Toyota). Null readings are skipped so we never
    // blank a field the OCR could not read.
    const vUpdates: Record<string, unknown> = {}
    if (extracted.vehicle_make) vUpdates.make = extracted.vehicle_make
    if (extracted.vehicle_model) vUpdates.model = extracted.vehicle_model
    if (extracted.year) vUpdates.year = extracted.year
    if (extracted.color) vUpdates.color = extracted.color
    if (extracted.plate_number) vUpdates.plate_number = extracted.plate_number
    if (extracted.plate_emirate)
      vUpdates.plate_emirate = extracted.plate_emirate
    if (extracted.vin) vUpdates.vin = extracted.vin

    if (Object.keys(vUpdates).length > 0) {
      await supabase.from('vehicles').update(vUpdates).eq('id', vehicleId)
    }

    // Revalidate the vehicle page so the next render picks up the
    // freshly applied extracted fields without the user hitting refresh.
    revalidatePath(`/vehicles/${vehicleId}`)
  } catch (err) {
    console.error('[runMulkiyaExtraction] failed', err)
    try {
      const supabase = await createClient()
      await supabase
        .from('vehicle_documents')
        .update({
          extraction_status: 'failed',
          extraction_error: 'Unexpected error during extraction.',
          extracted_at: new Date().toISOString(),
        })
        .eq('id', docId)
    } catch {
      // Last-ditch — silently give up rather than throw out of an async branch
    }
  }
}

/**
 * Owner clicks "Apply to my car" on the extracted-fields card.
 * Writes the extracted fields back to the vehicle row (only filling
 * blanks unless the user opted to overwrite — for now, blanks only).
 */
export async function applyExtractedToVehicle(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const docId = strOrNull(formData.get('document_id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!docId || !vehicleId) redirect('/mycars')

  const { data: doc } = await supabase
    .from('vehicle_documents')
    .select('extracted_data, extraction_status')
    .eq('id', docId)
    .maybeSingle()

  if (!doc || doc.extraction_status !== 'ready' || !doc.extracted_data) {
    redirect(`/vehicles/${vehicleId}#documents`)
  }

  const e = doc.extracted_data as ExtractedMulkiya

  // Overwrite the vehicle's fields with whatever the document
  // extracted. The mulkiya is the source of truth for plate, VIN,
  // year, make, model, plate_emirate. If the user had typed
  // something different, it gets replaced. Anything the extractor
  // returned null for is left untouched (we don't blow away a
  // field the doc couldn't read).
  const updates: Record<string, unknown> = {}
  if (e.vehicle_make) updates.make = e.vehicle_make
  if (e.vehicle_model) updates.model = e.vehicle_model
  if (e.year) updates.year = e.year
  if (e.plate_number) updates.plate_number = e.plate_number
  if (e.plate_emirate) updates.plate_emirate = e.plate_emirate
  if (e.vin) updates.vin = e.vin

  if (Object.keys(updates).length > 0) {
    await supabase.from('vehicles').update(updates).eq('id', vehicleId)
  }

  await supabase
    .from('vehicle_documents')
    .update({ extraction_status: 'applied' })
    .eq('id', docId)

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}#documents`)
}

/**
 * Owner archives (soft-delete) a vehicle document. Keeps history for
 * agents who already have a grant; UI hides archived rows.
 */
export async function archiveVehicleDocument(formData: FormData) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const id = strOrNull(formData.get('id'))
  const vehicleId = strOrNull(formData.get('vehicle_id'))
  if (!id || !vehicleId) redirect('/garage')

  await supabase
    .from('vehicle_documents')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}#documents`)
}

/**
 * Generates a short-lived signed URL for a document's storage object.
 * The vehicle_documents row's RLS gate already controls metadata visibility;
 * this helper produces the actual file download URL on demand.
 */
export async function signedDocumentUrl(
  storagePath: string,
  ttlSeconds = 60,
): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage
    .from('vehicle-docs')
    .createSignedUrl(storagePath, ttlSeconds)
  if (error || !data) return null
  return data.signedUrl
}
