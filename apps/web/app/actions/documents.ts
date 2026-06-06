'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  extractMulkiyaFromImage,
  type ExtractedMulkiya,
} from '@/lib/extract-mulkiya'

function strOrNull(v: FormDataEntryValue | null): string | null {
  if (v === null) return null
  const s = String(v).trim()
  return s === '' ? null : s
}

const ALLOWED_DOC_TYPES = new Set([
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
  const docType = strOrNull(formData.get('doc_type'))
  if (!vehicleId) redirect('/garage')
  if (!docType || !ALLOWED_DOC_TYPES.has(docType)) {
    redirect(`/vehicles/${vehicleId}/documents/new?error=Pick+a+document+type`)
  }

  // Accept all files keyed under "file" — the input has `multiple`, so
  // the browser submits multiple entries with the same name.
  const fileEntries = formData
    .getAll('file')
    .filter((v): v is File => v instanceof File && v.size > 0)

  if (fileEntries.length === 0) {
    redirect(`/vehicles/${vehicleId}/documents/new?error=Pick+at+least+one+file`)
  }

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

  // Mulkiya only — fire-and-forget extraction so the user redirect isn't
  // blocked on Claude's response. The extraction writes back to the doc
  // row when done; the UI polls via revalidation when user lands on the
  // doc view.
  if (docType === 'mulkiya' && fileEntries[0]) {
    await supabase
      .from('vehicle_documents')
      .update({ extraction_status: 'pending' })
      .eq('id', doc.id)

    // Run extraction in the background, but use after() so Vercel keeps
    // the function alive after the redirect response. Without this, the
    // worker is killed the moment the action returns and the extraction
    // never finishes (which is why nothing showed in the logs before).
    const primaryFile = fileEntries[0]
    if (primaryFile) {
      after(() => runMulkiyaExtraction(doc.id, primaryFile, vehicleId))
    }
  }

  revalidatePath(`/vehicles/${vehicleId}`)
  redirect(`/vehicles/${vehicleId}#documents`)
}

/**
 * Send the mulkiya image to Claude, parse the structured response, and
 * write it back to the document row. Runs out-of-band of the user's
 * redirect; the doc-view page reads the result.
 *
 * Designed to NEVER throw — we always end with a status the UI can read.
 */
async function runMulkiyaExtraction(
  docId: string,
  file: File,
  vehicleId: string,
): Promise<void> {
  try {
    // Only photos for now. PDFs need a different content shape — we'll
    // mark them failed with a friendly error rather than crashing.
    if (!file.type.startsWith('image/')) {
      const supabase = await createClient()
      await supabase
        .from('vehicle_documents')
        .update({
          extraction_status: 'failed',
          extraction_error: 'PDF extraction not supported yet — try a photo.',
        })
        .eq('id', docId)
      return
    }

    // Convert file to base64
    const buf = await file.arrayBuffer()
    const b64 = Buffer.from(buf).toString('base64')

    const extracted = await extractMulkiyaFromImage(b64, file.type)

    const supabase = await createClient()

    if (!extracted) {
      await supabase
        .from('vehicle_documents')
        .update({
          extraction_status: 'failed',
          extraction_error:
            'Could not read the mulkiya. Try a clearer photo with all four corners visible.',
          extracted_at: new Date().toISOString(),
        })
        .eq('id', docId)
      return
    }

    // Promote the expires_at from the extracted data onto the parent row
    // — that's what fires the renewal reminder cron. The other fields
    // wait for the user to click "Apply to my car."
    const updates: Record<string, unknown> = {
      extracted_data: extracted,
      extraction_status: 'ready',
      extracted_at: new Date().toISOString(),
    }
    if (extracted.expires_at) {
      updates.expires_at = extracted.expires_at
    }

    await supabase.from('vehicle_documents').update(updates).eq('id', docId)
    // Revalidate the vehicle page so when the user navigates back, the
    // freshly extracted data is visible.
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

  // Fetch current vehicle so we only fill in blank fields — never
  // overwrite something the user has typed in.
  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('make, model, year, plate_number, plate_emirate, vin')
    .eq('id', vehicleId)
    .maybeSingle()

  if (!vehicle) redirect(`/vehicles/${vehicleId}#documents`)

  const updates: Record<string, unknown> = {}
  if (!vehicle.make && e.vehicle_make) updates.make = e.vehicle_make
  if (!vehicle.model && e.vehicle_model) updates.model = e.vehicle_model
  if (!vehicle.year && e.year) updates.year = e.year
  if (!vehicle.plate_number && e.plate_number)
    updates.plate_number = e.plate_number
  if (!vehicle.plate_emirate && e.plate_emirate)
    updates.plate_emirate = e.plate_emirate
  if (!vehicle.vin && e.vin) updates.vin = e.vin

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
