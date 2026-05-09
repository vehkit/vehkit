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

      <div className="space-y-4">
        {filtered.map((v) => {
          const isShared = v.owner_id !== currentUserId
          const pendingForThis = pendingByVehicle[v.id] ?? 0
          const heroPhoto = v.hero_image_url
          const title = v.nickname ?? `${v.make} ${v.model}`
          const subtitle = [
            v.year && String(v.year),
            `${v.make} ${v.model}`,
            v.plate_emirate && v.plate_number
              ? `${v.plate_emirate} · ${v.plate_number}`
              : v.plate_number,
          ]
            .filter(Boolean)
            .join(' · ')

          return (
            <Link
              key={v.id}
              href={`/vehicles/${v.id}`}
              className={`card block overflow-hidden hover:border-volt/30 transition-colors group ${
                pendingForThis > 0 ? 'ring-1 ring-wallet/40' : ''
              }`}
            >
              {/* Photo — top, prominent */}
              <div className="relative aspect-[16/10] md:aspect-[16/9] bg-iron overflow-hidden">
                {heroPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={heroPhoto}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-500"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-iron via-carbon to-noir">
                    <svg
                      width="36"
                      height="36"
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

                {/* Floating top-right badges — over the photo */}
                {(isShared || pendingForThis > 0) && (
                  <div className="absolute top-3 right-3 flex gap-2">
                    {pendingForThis > 0 && (
                      <span className="text-[10px] tracking-widest uppercase bg-wallet text-noir px-2.5 py-1 rounded-pill font-semibold">
                        {pendingForThis} pending
                      </span>
                    )}
                    {isShared && (
                      <span className="text-[10px] tracking-widest uppercase bg-noir/70 text-chalk px-2.5 py-1 rounded-pill font-medium backdrop-blur-sm">
                        Shared
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Content below photo — PropertyFinder pattern */}
              <div className="p-4 md:p-5">
                {/* Title + subtitle */}
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-semibold text-chalk tracking-tight truncate">
                    {title}
                  </h2>
                  <p className="text-xs text-ash mt-0.5 truncate">{subtitle}</p>
                </div>

                {/* Stats row — vertical dividers, PropertyFinder-style */}
                <div className="grid grid-cols-3 divide-x divide-seam border-t border-seam mt-4 pt-4">
                  <Stat
                    value={v.current_odometer?.toLocaleString() ?? '—'}
                    label="km"
                  />
                  <Stat
                    value={v.year ? String(v.year) : '—'}
                    label="Year"
                  />
                  <Stat
                    value={v.color ?? '—'}
                    label="Color"
                  />
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

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center px-2">
      <p className="font-mono text-base md:text-lg font-semibold text-chalk tabular-nums tracking-tight leading-none truncate">
        {value}
      </p>
      <p className="text-[10px] tracking-widest uppercase text-ash mt-1.5 truncate">
        {label}
      </p>
    </div>
  )
}
