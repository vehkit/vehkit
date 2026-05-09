import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SuggestReminderButton } from '@/components/SuggestReminderButton'
import { humanize, relativeDate } from '@/lib/format'

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

  // Aggregate top-strip stats
  const totalVisits = customers.reduce((s, c) => s + c.total_visits, 0)
  const totalSpend = customers.reduce(
    (s, c) => s + Number(c.total_spent_aed ?? 0),
    0,
  )
  const repeatCount = customers.filter((c) => c.total_visits > 1).length

  return (
    <main className="min-h-[100svh] pb-24">
      <div className="max-w-3xl mx-auto px-6 pt-6 md:pt-8">
        {/* Editorial header */}
        <p className="nav-pill">vehkit · workshop</p>
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mt-3">
          <div>
            <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none">
              Customers
            </h1>
            <p className="text-sm text-ash mt-2 leading-relaxed max-w-md">
              Every car you've serviced — last visit, lifetime spend, and who's
              due for outreach. Owner identity stays private until they share.
            </p>
          </div>
          {customers.length > 0 && (
            <div className="flex items-stretch gap-3">
              <Stat
                value={customers.length.toString()}
                label={customers.length === 1 ? 'vehicle' : 'vehicles'}
              />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat value={totalVisits.toString()} label="visits" mono />
              <span className="w-px bg-seam shrink-0" aria-hidden />
              <Stat value={repeatCount.toString()} label="repeat" />
              {totalSpend > 0 && (
                <>
                  <span className="w-px bg-seam shrink-0" aria-hidden />
                  <Stat
                    value={`AED ${totalSpend.toLocaleString()}`}
                    label="lifetime"
                    mono
                  />
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-xs px-4 py-3 rounded-DEFAULT font-mono">
            {error.message} · {error.code}
          </div>
        )}

        {customers.length === 0 ? (
          <div className="card p-10 text-center mt-8">
            <p className="text-chalk font-medium">No customers yet</p>
            <p className="text-sm text-ash mt-2 leading-relaxed">
              When a customer hands you a 6-character code and you log a
              service, their vehicle lands here — with last-visit date, total
              spend, and renewal-due signals.
            </p>
            <Link
              href="/shop"
              className="text-xs tracking-widest uppercase text-volt mt-4 inline-block hover:underline"
            >
              Log your first service →
            </Link>
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

function Stat({
  value,
  label,
  mono,
}: {
  value: string
  label: string
  mono?: boolean
}) {
  return (
    <div className="min-w-0">
      <p
        className={`text-sm md:text-base font-semibold text-chalk tracking-tight leading-none ${
          mono ? 'font-mono tabular-nums' : ''
        }`}
      >
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}
