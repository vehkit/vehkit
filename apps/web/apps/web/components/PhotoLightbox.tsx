'use client'

import { useEffect, useState } from 'react'

export function PhotoLightbox({ photos }: { photos: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  useEffect(() => {
    if (openIndex === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenIndex(null)
      if (e.key === 'ArrowRight') setOpenIndex((i) => (i === null ? null : Math.min(photos.length - 1, i + 1)))
      if (e.key === 'ArrowLeft') setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1)))
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [openIndex, photos.length])

  if (photos.length === 0) return null

  return (
    <>
      <div
        className={
          photos.length === 1
            ? ''
            : 'grid grid-cols-2 gap-px bg-seam'
        }
      >
        {photos.slice(0, 4).map((url, i) => (
          <button
            type="button"
            key={i}
            onClick={() => setOpenIndex(i)}
            className="block w-full p-0 m-0 cursor-zoom-in"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className={`w-full object-cover ${
                photos.length === 1 ? 'h-40' : photos.length === 2 ? 'h-32' : 'h-24'
              }`}
            />
          </button>
        ))}
        {photos.length > 4 && (
          <button
            type="button"
            onClick={() => setOpenIndex(4)}
            className="col-span-2 px-3 py-1 text-xs text-ash bg-iron text-left hover:bg-iron/70 transition-colors"
          >
            +{photos.length - 4} more photos
          </button>
        )}
      </div>

      {openIndex !== null && (
        <div
          className="fixed inset-0 bg-noir/95 backdrop-blur-sm z-50 flex items-center justify-center"
          onClick={() => setOpenIndex(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[openIndex]}
            alt=""
            className="max-w-[95vw] max-h-[90vh] object-contain"
            onClick={(e) => e.stopPropagation()}
          />

          <button
            onClick={() => setOpenIndex(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-pill bg-iron border border-seam flex items-center justify-center text-chalk text-xl hover:bg-iron/70 transition-colors"
            aria-label="Close"
          >
            ×
          </button>

          {photos.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenIndex((i) => (i === null ? null : Math.max(0, i - 1)))
                }}
                disabled={openIndex === 0}
                className="absolute left-4 w-10 h-10 rounded-pill bg-iron border border-seam flex items-center justify-center text-chalk text-xl hover:bg-iron/70 transition-colors disabled:opacity-30"
                aria-label="Previous"
              >
                ‹
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setOpenIndex((i) =>
                    i === null ? null : Math.min(photos.length - 1, i + 1)
                  )
                }}
                disabled={openIndex === photos.length - 1}
                className="absolute right-4 w-10 h-10 rounded-pill bg-iron border border-seam flex items-center justify-center text-chalk text-xl hover:bg-iron/70 transition-colors disabled:opacity-30"
                aria-label="Next"
              >
                ›
              </button>
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-ash bg-iron border border-seam rounded-pill px-3 py-1">
                {openIndex + 1} / {photos.length}
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}
