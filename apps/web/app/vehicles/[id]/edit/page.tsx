import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateVehicle } from '@/app/actions/vehicles'
import { revokeAllAgentGrants } from '@/app/actions/agent'
import { EMIRATES } from '@vehkit/types'

export default async function EditVehiclePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; revoked?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const errorMsg = sp.error
  const revoked = sp.revoked === '1'

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [vehicleRes, grantsRes] = await Promise.all([
    supabase.from('vehicles').select('*').eq('id', id).single(),
    supabase
      .from('agent_grants')
      .select('id, agent_id, expires_at, revoked_at, agents(name)')
      .eq('vehicle_id', id)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString()),
  ])

  const vehicle = vehicleRes.data
  if (vehicleRes.error || !vehicle) notFound()

  type ActiveGrant = {
    id: string
    agent_id: string
    expires_at: string
    revoked_at: string | null
    agents: { name: string } | null
  }
  const activeGrants = (grantsRes.data ?? []) as unknown as ActiveGrant[]

  return (
    <main className="min-h-[100svh] pb-32">
      <div className="max-w-xl mx-auto px-6 pt-8 md:pt-10">
        <Link
          href={`/vehicles/${id}`}
          className="text-xs tracking-widest uppercase text-ash hover:text-chalk transition-colors"
        >
          ← {vehicle.nickname ?? `${vehicle.make} ${vehicle.model}`}
        </Link>
        <p className="nav-pill mt-3">vehkit · vehicle</p>
        <h1 className="text-xl md:text-2xl font-semibold text-chalk tracking-tighter leading-none mt-3">
          Edit details
        </h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Fix anything that's wrong. Service history, photos, and shares stay
          attached.
        </p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={updateVehicle} className="mt-8 space-y-4" id="edit-vehicle-form">
          <input type="hidden" name="id" value={id} />

          <Field label="Make" name="make" required defaultValue={vehicle.make} />
          <Field label="Model" name="model" required defaultValue={vehicle.model} />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Year"
              name="year"
              type="number"
              inputMode="numeric"
              defaultValue={vehicle.year?.toString() ?? ''}
            />
            <Field label="Color" name="color" defaultValue={vehicle.color ?? ''} />
          </div>

          <Field label="Nickname" name="nickname" defaultValue={vehicle.nickname ?? ''} />

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <Field
                label="Plate"
                name="plate_number"
                defaultValue={vehicle.plate_number ?? ''}
              />
            </div>
            <Select
              label="Emirate"
              name="plate_emirate"
              options={EMIRATES}
              defaultValue={vehicle.plate_emirate ?? ''}
            />
          </div>

          <Field label="VIN / Chassis" name="vin" defaultValue={vehicle.vin ?? ''} />
          <Field
            label="Odometer (km)"
            name="current_odometer"
            type="number"
            inputMode="numeric"
            defaultValue={vehicle.current_odometer?.toString() ?? ''}
          />

          {/* Workshop outreach opt-in */}
          <div className="card p-4 mt-2">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="allow_workshop_outreach"
                defaultChecked={vehicle.allow_workshop_outreach ?? false}
                className="mt-0.5 w-4 h-4 accent-volt cursor-pointer shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-chalk">
                  Let workshops suggest reminders
                </p>
                <p className="text-xs text-ash mt-1 leading-relaxed">
                  Workshops you've visited can suggest service reminders for this car (e.g.
                  "next oil change due"). Suggestions show up in your inbox — you accept,
                  snooze, or dismiss. They never get your email or phone.
                </p>
              </div>
            </label>
          </div>
        </form>

        {/* PRIVACY & SHARING — agent grant control */}
        <section className="mt-10">
          <h2 className="text-[10px] tracking-widest uppercase text-ash mb-3">
            Privacy &amp; sharing
          </h2>

          {revoked && (
            <div className="mb-3 bg-volt/10 border border-volt/30 text-volt text-sm px-4 py-3 rounded-DEFAULT">
              All active agent grants on this vehicle have been revoked.
            </div>
          )}

          <div className="card p-5 space-y-3">
            <div>
              <p className="text-sm md:text-base font-semibold text-chalk leading-snug">
                Active agent shares ·{' '}
                <span className="font-mono tabular-nums">
                  {activeGrants.length}
                </span>
              </p>
              <p className="text-xs text-ash mt-1.5 leading-relaxed">
                Insurance brokers and other agents who have a non-expired
                grant on this vehicle. Each grant is full-access for 60
                minutes after redemption, then renewal-track metadata for
                30 days.
              </p>
            </div>

            {activeGrants.length > 0 && (
              <ul className="border-t border-seam pt-3 space-y-1.5">
                {activeGrants.map((g) => (
                  <li
                    key={g.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="text-chalk truncate">
                      {g.agents?.name ?? g.agent_id}
                    </span>
                    <span className="text-ash font-mono tabular-nums">
                      until{' '}
                      {new Date(g.expires_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <form action={revokeAllAgentGrants} className="border-t border-seam pt-3">
              <input type="hidden" name="vehicle_id" value={id} />
              <button
                type="submit"
                disabled={activeGrants.length === 0}
                className="w-full text-center text-xs tracking-widest uppercase text-signal hover:underline disabled:opacity-40 disabled:no-underline disabled:cursor-not-allowed"
              >
                Revoke all agent shares now
              </button>
              <p className="text-[10px] text-ash/70 leading-relaxed mt-2 text-center">
                Cuts off every active grant in one click. Brokers lose
                read access immediately. They can request a fresh code.
              </p>
            </form>
          </div>
        </section>
      </div>

      <div className="fixed bottom-16 md:bottom-0 inset-x-0 px-6 pb-6 pt-4 bg-gradient-to-t from-noir via-noir/95 to-noir/0 z-20">
        <div className="max-w-xl mx-auto flex gap-3">
          <Link href={`/vehicles/${id}`} className="pill-ghost flex-1 text-center">
            Cancel
          </Link>
          <button
            type="submit"
            form="edit-vehicle-form"
            className="pill-primary flex-[2] text-center"
          >
            Save changes
          </button>
        </div>
      </div>
    </main>
  )
}

function Field({
  label,
  name,
  type = 'text',
  required,
  defaultValue,
  inputMode,
}: {
  label: string
  name: string
  type?: string
  required?: boolean
  defaultValue?: string
  inputMode?: 'text' | 'numeric' | 'decimal' | 'email' | 'tel' | 'url' | 'search'
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label} {required && <span className="text-signal">*</span>}
      </label>
      <input
        type={type}
        id={name}
        name={name}
        required={required}
        defaultValue={defaultValue}
        inputMode={inputMode}
        className="field"
      />
    </div>
  )
}

function Select({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string
  name: string
  options: readonly string[]
  defaultValue: string
}) {
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
      </label>
      <select id={name} name={name} defaultValue={defaultValue} className="field">
        <option value="">—</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  )
}
