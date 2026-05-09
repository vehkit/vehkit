import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createVehicleDocument } from '@/app/actions/documents'

const DOC_TYPES = [
  { value: 'mulkiya', label: 'Mulkiya (registration)' },
  { value: 'insurance_policy', label: 'Insurance policy' },
  { value: 'driving_licence', label: 'Driving licence' },
  { value: 'noc', label: 'No-objection certificate' },
  { value: 'pollution_test', label: 'Pollution test' },
  { value: 'service_history', label: 'Service history PDF' },
  { value: 'other', label: 'Other' },
] as const

export default async function NewDocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string }>
}) {
  const { id } = await params
  const { error } = await searchParams

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname, owner_id')
    .eq('id', id)
    .single()
  if (!vehicle) notFound()
  if (vehicle.owner_id !== user.id) {
    redirect(`/vehicles/${id}?error=Only+the+owner+can+upload+documents`)
  }

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-6 md:pt-8">
        <Link
          href={`/vehicles/${id}#documents`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>

        <p className="nav-pill mt-3">vehkit · documents</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Add a document
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Mulkiya, insurance, NOC — anything you'd otherwise scramble to
          find when an insurance broker asks. Stored privately; only you
          and people you explicitly share with can see it.
        </p>

        {error && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(error)}
          </div>
        )}

        <form
          action={createVehicleDocument}
          encType="multipart/form-data"
          className="mt-6 space-y-5"
        >
          <input type="hidden" name="vehicle_id" value={id} />

          <div>
            <label htmlFor="doc_type" className="label">
              Document type <span className="text-signal">*</span>
            </label>
            <select
              id="doc_type"
              name="doc_type"
              required
              defaultValue=""
              className="field"
            >
              <option value="" disabled>
                Pick one…
              </option>
              {DOC_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="label" className="label">
              Label <span className="text-ash/70">(optional)</span>
            </label>
            <input
              id="label"
              name="label"
              type="text"
              maxLength={120}
              placeholder="e.g. RSA renewal 2026"
              className="field"
            />
          </div>

          <div>
            <label htmlFor="file" className="label">
              File <span className="text-signal">*</span>
            </label>
            <input
              id="file"
              name="file"
              type="file"
              accept="application/pdf,image/*"
              required
              className="field file:mr-3 file:py-1.5 file:px-3 file:rounded-pill file:border-0 file:bg-iron file:text-chalk file:text-xs file:tracking-widest file:uppercase file:font-medium hover:file:bg-iron/70 file:cursor-pointer"
            />
            <p className="text-[11px] text-ash/70 mt-1.5">PDF or image. Stays private to you.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="issued_date" className="label">
                Issued <span className="text-ash/70">(optional)</span>
              </label>
              <input
                id="issued_date"
                name="issued_date"
                type="date"
                className="field"
              />
            </div>
            <div>
              <label htmlFor="expires_at" className="label">
                Expires <span className="text-ash/70">(optional)</span>
              </label>
              <input
                id="expires_at"
                name="expires_at"
                type="date"
                className="field"
              />
            </div>
          </div>

          <p className="text-[11px] text-ash/70 leading-relaxed">
            Adding an expiry date lets us remind you — and your insurance
            broker, if you've shared with one — before it lapses.
          </p>

          <div className="pt-2">
            <button type="submit" className="pill-primary block w-full text-center">
              Save document
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
