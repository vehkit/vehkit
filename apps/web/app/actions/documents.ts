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
 * Owner uploads a new vehicle document. File goes to the private
 * 'vehicle-docs' bucket; the row goes to vehicle_documents (RLS-checked).
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

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/vehicles/${vehicleId}/documents/new?error=Pick+a+file`)
  }

  const label = strOrNull(formData.get('label'))
  const expiresAt = strOrNull(formData.get('expires_at'))

  // Path convention: vehicles/{vehicleId}/docs/{ts}-{slug}.{ext}
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
  const path = `vehicles/${vehicleId}/docs/${Date.now()}-${docType}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('vehicle-docs')
    .upload(path, file, { contentType: file.type, upsert: false })

  if (upErr) {
    redirect(
      `/vehicles/${vehicleId}/documents/new?error=${encodeURIComponent(`Upload failed: ${upErr.message}`)}`,
    )
  }

  const { error: insErr } = await supabase.from('vehicle_documents').insert({
    vehicle_id: vehicleId,
    doc_type: docType,
    label,
    storage_path: path,
    file_type: file.type,
    file_size_bytes: file.size,
    expires_at: expiresAt,
    uploaded_by: user.id,
  })

  if (insErr) {
    // Best-effort cleanup of the uploaded blob
    await supabase.storage.from('vehicle-docs').remove([path])
    redirect(
      `/vehicles/${vehicleId}/documents/new?error=${encodeURIComponent(insErr.message)}`,
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
