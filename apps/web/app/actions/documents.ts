'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
  const uploadedPaths: string[] = []
  const fileMeta: Array<{ path: string; type: string; size: number }> = []

  for (let i = 0; i < fileEntries.length; i++) {
    const f = fileEntries[i]!
    const ext = f.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const path = `vehicles/${vehicleId}/docs/${Date.now()}-${docType}-${i}.${ext}`
    const { error: upErr } = await supabase.storage
      .from('vehicle-docs')
      .upload(path, f, { contentType: f.type, upsert: false })
    if (upErr) {
      // Roll back any blobs we already wrote
      if (uploadedPaths.length > 0) {
        await supabase.storage.from('vehicle-docs').remove(uploadedPaths)
      }
      redirect(
        `/vehicles/${vehicleId}/documents/new?error=${encodeURIComponent(`Upload failed: ${upErr.message}`)}`,
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
