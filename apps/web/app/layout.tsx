import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { AppNav } from '@/components/AppNav'

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
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Vehkit',
  },
  formatDetection: {
    telephone: false,
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
      <body className="font-sans bg-noir text-chalk pb-16 md:pb-0">
        <AppNav />
        {children}
      </body>
    </html>
  )
}
