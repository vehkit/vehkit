import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SuggestReminderButton } from '@/components/SuggestReminderButton'

export const dynamic = 'force-dynamic'

type CustomerVehicle = {
  vehicle_id: string
  make: string
  model: string
  year: number | null
  color: string | null
  nickname: string | null
  plate_number: string | null
  plate_emirate: string | null
  current_odometer: number | null
  last_visit_date: string
  last_service_type: string
  total_visits: number
  total_spent_aed: number
  pending_count: number
  has_due_reminder: boolean
  allow_outreach: boolean
}

function relativeDate(iso: string): string {
  const d = new Date(iso)
  const days = Math.floor((Date.now() - d.getTime()) / (24 * 60 * 60 * 1000))
  if (days < 1) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) === 1 ? '' : 's'} ago`
  if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) === 1 ? '' : 's'} ago`
  return `${Math.floor(days / 365)} year${Math.floor(days / 365) === 1 ? '' : 's'} ago`
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

export default async function WorkshopCustomersPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/workshop/customers')

  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  if (!membership?.workshop_id) redirect('/workshop/claim')

  const { data, error } = await supabase.rpc('workshop_customer_vehicles', {
    p_workshop_id: membership.workshop_id,
  })

  const customers = (data ?? []) as CustomerVehicle[]

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-6">
        <Link href="/workshop" className="nav-pill hover:text-chalk transition-colors">
          ← Workshop
        </Link>

        <header className="mt-4 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter">
              Customers
            </h1>
            <p className="text-sm text-ash mt-0.5">
              {customers.length === 0
                ? 'No vehicles serviced yet.'
                : `${customers.length} ${customers.length === 1 ? 'vehicle' : 'vehicles'}`}
            </p>
          </div>
        </header>

        {error && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-xs px-4 py-3 rounded-DEFAULT font-mono">
            {error.message} · {error.code}
          </div>
        )}

        {customers.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-14 h-14 mx-auto rounded-pill border border-seam flex items-center justify-center">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-ash"
                aria-hidden
              >
                <path d="M3 13l1.66-4.97A2 2 0 016.55 6.5h10.9a2 2 0 011.89 1.53L21 13M5 13h14M7 17h.01M17 17h.01M5 13v4a1 1 0 001 1h12a1 1 0 001-1v-4" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-chalk mt-4">No customers yet</h3>
            <p className="text-sm text-ash mt-1 leading-relaxed">
              When you log a service via a code, the vehicle appears here.
            </p>
          </div>
        ) : (
          <ul className="card divide-y divide-seam mt-4">
            {customers.map((c) => {
              const title = c.nickname ?? `${c.make} ${c.model}`
              const initials =
                title
                  .split(/\s+/)
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((s) => s.charAt(0).toUpperCase())
                  .join('') || '·'
              const subtitle = [
                c.year && String(c.year),
                `${c.make} ${c.model}`,
                c.plate_emirate && c.plate_number
                  ? `${c.plate_emirate} · ${c.plate_number}`
                  : c.plate_number,
              ]
                .filter(Boolean)
                .join(' · ')

              return (
                <li key={c.vehicle_id} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-pill bg-volt/15 text-volt flex items-center justify-center shrink-0 font-mono text-sm font-semibold tracking-tighter">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-chalk truncate">{title}</p>
                      <p className="text-xs text-ash truncate">{subtitle}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-chalk">{relativeDate(c.last_visit_date)}</p>
                      <p className="text-[10px] text-ash">{humanize(c.last_service_type)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap mt-3 pl-14">
                    <span className="text-[10px] tracking-widest uppercase text-ash">
                      {c.total_visits} {c.total_visits === 1 ? 'visit' : 'visits'}
                    </span>
                    {Number(c.total_spent_aed) > 0 && (
                      <>
                        <span className="text-seam text-[10px]">·</span>
                        <span className="text-[10px] tracking-widest uppercase text-ash font-mono">
                          AED {Number(c.total_spent_aed).toLocaleString()}
                        </span>
                      </>
                    )}
                    {c.pending_count > 0 && (
                      <span className="text-[10px] tracking-widest uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-medium">
                        {c.pending_count} pending
                      </span>
                    )}
                    {c.has_due_reminder && (
                      <span className="text-[10px] tracking-widest uppercase bg-volt/15 text-volt px-2 py-0.5 rounded-pill font-medium">
                        Due soon
                      </span>
                    )}
                    <div className="ml-auto">
                      {c.allow_outreach ? (
                        <SuggestReminderButton
                          workshopId={membership.workshop_id}
                          vehicleId={c.vehicle_id}
                          vehicleName={title}
                        />
                      ) : (
                        <span
                          className="text-[10px] tracking-widest uppercase text-ash/60"
                          title="Owner has not enabled workshop outreach"
                        >
                          Outreach off
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}

        <p className="text-[11px] text-ash/70 leading-relaxed mt-6">
          Customer identity is intentionally minimal. You see the vehicle and your service
          history with it — not the owner's name, email, or phone. To suggest a reminder, the
          owner must opt in to workshop outreach on their vehicle settings.
        </p>
      </div>
    </main>
  )
}
