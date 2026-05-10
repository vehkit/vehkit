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

      {/* Vertical card grid — Bayut listing rhythm. 1 col mobile, 2 col tablet+. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
              className={`card block overflow-hidden hover:border-leaf/30 transition-colors group ${
                pendingForThis > 0 ? 'ring-1 ring-wallet/40' : ''
              }`}
            >
              {/* Hero photo on top — fixed aspect for grid alignment */}
              <div className="relative w-full aspect-[16/10] bg-iron overflow-hidden">
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
                      width="32"
                      height="32"
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

                {/* Top-right corner badge — pending or shared */}
                {pendingForThis > 0 && (
                  <span className="absolute top-3 right-3 text-[10px] tracking-widest uppercase bg-wallet/95 text-noir px-2 py-1 rounded-pill font-semibold shadow-sm">
                    {pendingForThis} pending
                  </span>
                )}
                {isShared && pendingForThis === 0 && (
                  <span className="absolute top-3 right-3 text-[10px] tracking-widest uppercase bg-noir/70 backdrop-blur text-chalk px-2 py-1 rounded-pill font-medium">
                    Shared
                  </span>
                )}
              </div>

              {/* Content stack */}
              <div className="p-5 flex flex-col gap-4">
                {/* Title block */}
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-semibold text-chalk truncate leading-tight tracking-tight">
                    {title}
                  </h2>
                  <p className="text-xs md:text-sm text-ash mt-1 truncate">
                    {subline}
                  </p>
                </div>

                {/* Pin row — plate (mirrors Bayut's location with map icon) */}
                {plateBadge && (
                  <div className="flex items-center gap-2 min-w-0">
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="text-ash shrink-0"
                      aria-hidden
                    >
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    <span className="text-xs text-chalk/85 truncate font-mono">
                      {plateBadge}
                    </span>
                  </div>
                )}

                {/* Stat box — Bayut's signature inset block with vertical divider */}
                <div className="bg-iron/50 rounded-DEFAULT p-3 grid grid-cols-2 divide-x divide-seam">
                  <div className="px-1">
                    <p className="text-[10px] tracking-widest uppercase text-ash">
                      Odometer
                    </p>
                    <p className="text-base md:text-lg font-semibold text-chalk font-mono tabular-nums tracking-tight mt-1 leading-none">
                      {v.current_odometer != null
                        ? `${v.current_odometer.toLocaleString()}`
                        : '—'}
                      <span className="text-[10px] tracking-widest uppercase text-ash ml-1">
                        km
                      </span>
                    </p>
                  </div>
                  <div className="px-1 pl-3">
                    <p className="text-[10px] tracking-widest uppercase text-ash">
                      {summary?.lastServiceDate ? 'Last service' : 'Services'}
                    </p>
                    {summary?.lastServiceDate ? (
                      <p className="text-sm md:text-base font-semibold text-chalk tracking-tight mt-1 leading-tight truncate">
                        {relativeDate(summary.lastServiceDate)}
                      </p>
                    ) : (
                      <p className="text-base md:text-lg font-semibold text-chalk font-mono tabular-nums tracking-tight mt-1 leading-none">
                        {summary?.serviceCount ?? 0}
                      </p>
                    )}
                  </div>
                </div>

                {/* CTA strip at bottom — Bayut's "Register Interest" block,
                    here as a soft leaf-tinted "Open passport" affordance.
                    The whole card is the Link, but the strip closes the
                    visual rhythm. */}
                <div className="bg-leaf/10 hover:bg-leaf/15 transition-colors rounded-DEFAULT py-3 text-center">
                  <span className="text-sm font-medium text-leaf inline-flex items-center gap-2">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    Open passport
                  </span>
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
