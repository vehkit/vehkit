import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: vehicle } = await supabase
    .from('vehicles')
    .select('id, make, model, nickname, plate_number')
    .eq('id', id)
    .single()

  if (!vehicle) {
    return new Response('Not found', { status: 404 })
  }

  const { data: records } = await supabase
    .from('service_records')
    .select(
      'service_date, service_type, odometer, cost_aed, workshop_name_freetext, attestation, notes'
    )
    .eq('vehicle_id', id)
    .order('service_date', { ascending: false })

  const headers = [
    'Date',
    'Service type',
    'Odometer (km)',
    'Cost (AED)',
    'Workshop',
    'Attestation',
    'Notes',
  ]

  const rows = (records ?? []).map((r) => [
    r.service_date,
    r.service_type,
    r.odometer ?? '',
    r.cost_aed ?? '',
    r.workshop_name_freetext ?? '',
    r.attestation,
    (r.notes ?? '').replace(/\n/g, ' '),
  ])

  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? '')
          if (s.includes(',') || s.includes('"') || s.includes('\n')) {
            return `"${s.replace(/"/g, '""')}"`
          }
          return s
        })
        .join(',')
    )
    .join('\n')

  const filename = `vehkit-${(vehicle.nickname ?? `${vehicle.make}-${vehicle.model}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.csv`

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
