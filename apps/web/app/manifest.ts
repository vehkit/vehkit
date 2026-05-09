import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Vehkit',
    short_name: 'Vehkit',
    description: 'Every car deserves a passport.',
    start_url: '/mycars',
    display: 'standalone',
    background_color: '#0A0B0F',
    theme_color: '#0A0B0F',
    orientation: 'portrait',
    // Icons intentionally omitted until brand PNGs are shipped to /public.
    // Next.js will fall back to the favicon for browsers + add-to-home-screen,
    // and we avoid the 404 noise from referencing non-existent files.
  }
}
