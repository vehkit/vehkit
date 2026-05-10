import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vehkit',
    short_name: 'Vehkit',
    description: 'Every car deserves a passport.',
    start_url: '/mycars',
    display: 'standalone',
    background_color: '#0A0A0B',
    theme_color: '#21C07A', // leaf — primary brand
    orientation: 'portrait',
    icons: [
      {
        src: '/brand/app-icon/vehkit-favicon-256.png',
        sizes: '256x256',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/app-icon/vehkit-favicon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/app-icon/vehkit-app-icon-light-1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/brand/app-icon/vehkit-app-icon-dark-1024.png',
        sizes: '1024x1024',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
