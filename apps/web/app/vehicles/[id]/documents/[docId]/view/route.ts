import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Owner clicks "view" on a document → we resolve the row (RLS-checked
 * via vehicle_documents SELECT policy), mint a 60-second signed URL
 * for the storage object, and 302 there. No public URLs ever leave
 * the server.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  const { id, docId } = await params

  const supabase = await createClient()
  const { data: doc, error } = await supabase
    .from('vehicle_documents')
    .select('storage_path, vehicle_id')
    .eq('id', docId)
    .eq('vehicle_id', id)
    .is('archived_at', null)
    .maybeSingle()

  if (error || !doc) {
    return NextResponse.redirect(
      new URL(`/vehicles/${id}?error=Document+not+available`, _req.url),
    )
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from('vehicle-docs')
    .createSignedUrl(doc.storage_path, 60)

  if (signErr || !signed) {
    return NextResponse.redirect(
      new URL(`/vehicles/${id}?error=Signed+URL+failed`, _req.url),
    )
  }

  return NextResponse.redirect(signed.signedUrl)
}
