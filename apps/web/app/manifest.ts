import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vehkit',
    short_name: 'Vehkit',
    description: 'Every car deserves a passport.',
    start_url: '/garage',
    display: 'standalone',
    background_color: '#0A0B0F',
    theme_color: '#0A0B0F',
    orientation: 'portrait',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
  }
}
