'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

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

export function MyCarsList({
  vehicles,
  currentUserId,
  pendingByVehicle,
}: {
  vehicles: Vehicle[]
  currentUserId: string
  pendingByVehicle: Record<string, number>
}) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return vehicles
    return vehicles.filter((v) => {
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
  }, [vehicles, query])

  return (
    <>
      {vehicles.length > 1 && (
        <div className="relative mb-4">
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
            className="field pl-11"
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
      )}

      <div className="space-y-3">
        {filtered.map((v) => {
          const isShared = v.owner_id !== currentUserId
          const pendingForThis = pendingByVehicle[v.id] ?? 0
          const heroPhoto = v.hero_image_url
          return (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className={`card block overflow-hidden hover:border-volt/30 transition-colors group relative ${
                pendingForThis > 0 ? 'border-l-4 border-l-wallet' : ''
              } ${heroPhoto ? 'h-40 md:h-44' : ''}`}
            >
              {heroPhoto && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={heroPhoto}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-noir via-noir/40 to-transparent" />
                </>
              )}

              <div
                className={
                  heroPhoto
                    ? 'absolute inset-x-0 bottom-0 p-5 flex items-end justify-between gap-4'
                    : 'p-5 flex items-start justify-between gap-4'
                }
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {(v.year || v.color) && (
                      <p className="nav-pill text-[10px]">
                        {[v.year, v.color].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    {isShared && (
                      <span className="text-[10px] tracking-wider uppercase bg-iron/80 text-ash px-2 py-0.5 rounded-pill font-medium">
                        Shared
                      </span>
                    )}
                    {pendingForThis > 0 && (
                      <span className="text-[10px] tracking-wider uppercase bg-wallet/20 text-wallet px-2 py-0.5 rounded-pill font-medium">
                        {pendingForThis} pending
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl md:text-2xl font-semibold text-chalk mt-1 truncate tracking-tighter">
                    {v.nickname ?? `${v.make} ${v.model}`}
                  </h2>
                  <p className="text-sm text-ash mt-0.5 truncate">
                    {v.make} {v.model}
                    {v.plate_number && (
                      <>
                        {' · '}
                        <span className="font-mono">{v.plate_number}</span>
                      </>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono text-2xl md:text-3xl font-semibold text-chalk tabular-nums">
                    {v.current_odometer?.toLocaleString() ?? '—'}
                  </p>
                  <p className="text-[10px] tracking-widest uppercase text-ash mt-0.5">km</p>
                </div>
              </div>
            </Link>
          )
        })}
      </div>

      {filtered.length === 0 && query && (
        <div className="card p-10 text-center mt-2">
          <p className="text-chalk font-medium">No cars match "{query}"</p>
          <p className="text-sm text-ash mt-2">
            Try make, model, plate, or nickname.
          </p>
          <button
            type="button"
            onClick={() => setQuery('')}
            className="text-xs tracking-widest uppercase text-volt mt-4 hover:underline"
          >
            Clear search
          </button>
        </div>
      )}
    </>
  )
}
