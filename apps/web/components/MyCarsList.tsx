'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { relativeDate } from '@/lib/format'

type Vehicle = {
  id: string
  make: string
  model: string
  year: number | null
  color: string | null
  nickname: string | null
  plate_number: string | null
  plate_emirate: string | null
  vin: string | null
  current_odometer: number | null
  hero_image_url: string | null
  owner_id: string
}

export type VehicleSummary = {
  serviceCount: number
  totalSpend: number
  lastServiceDate: string | null
  lastWorkshop: string | null
}

type FilterMode = 'all' | 'pending'

export function MyCarsList({
  vehicles,
  currentUserId,
  pendingByVehicle,
  summaryByVehicle = {},
}: {
  vehicles: Vehicle[]
  currentUserId: string
  pendingByVehicle: Record<string, number>
  summaryByVehicle?: Record<string, VehicleSummary>
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  const totalPending = Object.values(pendingByVehicle).reduce(
    (sum, n) => sum + n,
    0,
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return vehicles.filter((v) => {
      if (filter === 'pending' && (pendingByVehicle[v.id] ?? 0) === 0) {
        return false
      }
      if (!q) return true
      const haystack = [
        v.make,
        v.model,
        v.nickname,
        v.plate_number,
        v.plate_emirate,
        v.vin,
        v.color,
        v.year != null ? String(v.year) : null,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(q)
    })
  }, [vehicles, query, filter, pendingByVehicle])

  return (
    <>
      {/* Search + filter strip — PF rhythm: search left-grows, filters right-fixed */}
      {vehicles.length > 1 && (
        <div className="mb-4 flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ash pointer-events-none">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search make, plate, nickname, VIN…"
              className="field pl-11 w-full"
              autoComplete="off"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-ash hover:text-chalk text-xl leading-none"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          {/* Filter chips */}
          <div className="flex items-center gap-1.5 shrink-0">
            <FilterChip
              active={filter === 'all'}
              onClick={() => setFilter('all')}
              label="All"
              count={vehicles.length}
            />
            <FilterChip
              active={filter === 'pending'}
              onClick={() => setFilter('pending')}
              label="Pending"
              count={totalPending}
              tone="wallet"
              dimWhenZero
            />
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filtered.map((v) => {
          const isShared = v.owner_id !== currentUserId
          const pendingForThis = pendingByVehicle[v.id] ?? 0
          const summary = summaryByVehicle[v.id]
          const heroPhoto = v.hero_image_url
          const title = v.nickname ?? `${v.make} ${v.model}`
          const subline = [
            v.year && String(v.year),
            `${v.make} ${v.model}`,
            v.color,
          ]
            .filter(Boolean)
            .join(' · ')
          const plateBadge =
            v.plate_emirate && v.plate_number
              ? `${v.plate_emirate} · ${v.plate_number}`
              : v.plate_number

          return (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className={`card block overflow-hidden hover:border-volt/30 transition-colors group ${
                pendingForThis > 0 ? 'ring-1 ring-wallet/40' : ''
              }`}
            >
              <div className="flex items-stretch">
                {/* Photo thumb — left */}
                <div className="relative w-28 sm:w-36 md:w-44 shrink-0 bg-iron overflow-hidden">
                  {heroPhoto ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={heroPhoto}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-iron via-carbon to-noir">
                      <svg
                        width="28"
                        height="28"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="text-ash/60"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 13l1.66-4.97A2 2 0 016.55 6.5h10.9a2 2 0 011.89 1.53L21 13M5 13h14M7 17h.01M17 17h.01M5 13v4a1 1 0 001 1h12a1 1 0 001-1v-4"
                        />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Content — right side, PF list-card rhythm */}
                <div className="flex-1 min-w-0 p-4 md:p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-base md:text-lg font-semibold text-chalk truncate leading-snug">
                        {title}
                      </h2>
                      <p className="text-xs text-ash mt-1 truncate">{subline}</p>
                    </div>
                    {pendingForThis > 0 && (
                      <span className="text-[10px] tracking-widest uppercase bg-wallet/15 text-wallet px-2 py-0.5 rounded-pill font-semibold shrink-0">
                        {pendingForThis} pending
                      </span>
                    )}
                    {isShared && pendingForThis === 0 && (
                      <span className="text-[10px] tracking-widest uppercase bg-iron text-ash px-2 py-0.5 rounded-pill font-medium shrink-0">
                        Shared
                      </span>
                    )}
                  </div>

                  {/* Intelligence line — PF "what's interesting" rhythm */}
                  <p className="text-xs mt-2 truncate">
                    {summary?.lastServiceDate ? (
                      <>
                        <span className="text-ash/60">Last service · </span>
                        <span className="text-chalk/90">
                          {relativeDate(summary.lastServiceDate)}
                        </span>
                        {summary.lastWorkshop && (
                          <>
                            <span className="text-ash/60"> at </span>
                            <span className="text-chalk/90">
                              {summary.lastWorkshop}
                            </span>
                          </>
                        )}
                      </>
                    ) : (
                      <span className="text-ash/60">No services logged yet</span>
                    )}
                  </p>

                  {/* Bottom stat strip — PF vertical-divider rhythm */}
                  <div className="mt-auto pt-3 flex items-center gap-3">
                    {plateBadge && (
                      <>
                        {/* Plate is the variable-length stat — flexible so it
                            truncates first when the row gets tight. */}
                        <CardStat
                          label="Plate"
                          value={plateBadge}
                          mono
                          small
                          flexible
                        />
                        <span
                          className="w-px h-7 bg-seam shrink-0"
                          aria-hidden
                        />
                      </>
                    )}
                    <CardStat
                      label="km"
                      value={
                        v.current_odometer != null
                          ? v.current_odometer.toLocaleString()
                          : '—'
                      }
                      mono
                    />
                    {summary && summary.serviceCount > 0 && (
                      <>
                        <span
                          className="w-px h-7 bg-seam shrink-0"
                          aria-hidden
                        />
                        <CardStat
                          label={
                            summary.serviceCount === 1 ? 'service' : 'services'
                          }
                          value={summary.serviceCount.toString()}
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && (query || filter === 'pending') && (
        <div className="card p-10 text-center mt-2">
          <p className="text-chalk font-medium">
            {filter === 'pending'
              ? 'No vehicles with pending entries'
              : `No cars match "${query}"`}
          </p>
          <p className="text-sm text-ash mt-2">
            {filter === 'pending'
              ? 'Workshop entries awaiting your review will appear here.'
              : 'Try make, model, plate, or nickname.'}
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
            className="text-xs tracking-widest uppercase text-volt mt-4 hover:underline"
          >
            Reset filters
          </button>
        </div>
      )}
    </>
  )
}

function FilterChip({
  active,
  onClick,
  label,
  count,
  tone,
  dimWhenZero,
}: {
  active: boolean
  onClick: () => void
  label: string
  count: number
  tone?: 'wallet'
  dimWhenZero?: boolean
}) {
  const isDim = dimWhenZero && count === 0 && !active
  const activeStyles =
    tone === 'wallet'
      ? 'bg-wallet/15 text-wallet border-wallet/40'
      : 'bg-volt/15 text-volt border-volt/40'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDim}
      className={`text-xs px-3 h-10 inline-flex items-center gap-2 rounded-pill border transition-colors ${
        active
          ? activeStyles
          : `bg-iron/40 text-ash border-seam hover:text-chalk hover:border-iron ${
              isDim ? 'opacity-50 cursor-not-allowed' : ''
            }`
      }`}
    >
      <span className="tracking-tight font-medium">{label}</span>
      <span
        className={`font-mono tabular-nums text-[10px] tracking-tight ${
          active ? 'opacity-90' : 'opacity-70'
        }`}
      >
        {count}
      </span>
    </button>
  )
}

function CardStat({
  label,
  value,
  mono,
  small,
  flexible,
}: {
  label: string
  value: string
  mono?: boolean
  small?: boolean
  /**
   * When true, the stat occupies remaining space and truncates instead of
   * pushing siblings. Use for variable-width values like plate numbers;
   * leave default for numeric fixed-width stats.
   */
  flexible?: boolean
}) {
  return (
    <div className={flexible ? 'min-w-0 flex-1' : 'min-w-0 shrink-0'}>
      <p
        className={`${
          small ? 'text-xs' : 'text-sm md:text-base'
        } font-semibold text-chalk tabular-nums tracking-tight leading-none truncate ${
          mono ? 'font-mono' : ''
        }`}
      >
        {value}
      </p>
      <p className="text-[9px] tracking-widest uppercase text-ash mt-1">
        {label}
      </p>
    </div>
  )
}
