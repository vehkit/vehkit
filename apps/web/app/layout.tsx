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
  title: {
    default: 'Vehkit — Every car deserves a passport.',
    template: '%s · Vehkit',
  },
  description:
    'Verified service records for every car you own. Owner-controlled, workshop-attested, immutable. Built for the UAE.',
  metadataBase: new URL('https://vehkit.com'),
  applicationName: 'Vehkit',
  authors: [{ name: 'Vehkit', url: 'https://vehkit.com' }],
  keywords: [
    'vehicle service history',
    'car service log',
    'UAE car records',
    'workshop verification',
    'vehicle passport',
    'resale report',
    'car maintenance app',
    'Dubai car app',
  ],
  openGraph: {
    title: 'Vehkit — Every car deserves a passport.',
    description:
      'Verified service records for every car you own. Owner-controlled, workshop-attested, immutable.',
    type: 'website',
    url: 'https://vehkit.com',
    siteName: 'Vehkit',
    locale: 'en_AE',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Vehkit — Every car deserves a passport.',
    description:
      'Verified service records for every car you own. Owner-controlled, workshop-attested, immutable.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
    },
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
