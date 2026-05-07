import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Vehkit — Every car deserves a passport.',
  description:
    'A permanent, owner-controlled record of every service, repair, and upgrade across every car you own.',
  metadataBase: new URL('https://vehkit.com'),
  openGraph: {
    title: 'Vehkit',
    description: 'Every car deserves a passport.',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0B0F',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} dark`}>
      <body className="font-sans bg-noir text-chalk">{children}</body>
    </html>
  )
}
