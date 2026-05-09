import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
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
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0A0B0F' },
    { media: '(prefers-color-scheme: light)', color: '#FAFAF8' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
}

// Inline script that runs BEFORE first paint to apply the saved theme.
// Reading localStorage server-side isn't possible, but the cookie works
// for the first SSR render. This script then reconciles with localStorage
// in case the user's preference is newer than the cookie.
const NO_FLASH_SCRIPT = `
(function(){
  try {
    var ls = localStorage.getItem('vehkit-theme');
    var theme = ls === 'light' || ls === 'dark' ? ls : null;
    if (!theme) {
      var m = document.cookie.match(/(?:^|; )vehkit-theme=(light|dark)/);
      theme = m ? m[1] : 'dark';
    }
    var html = document.documentElement;
    html.classList.remove('light', 'dark');
    html.classList.add(theme);
  } catch (e) {}
})();
`

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const themeCookie = cookieStore.get('vehkit-theme')?.value
  const theme = themeCookie === 'light' ? 'light' : 'dark'

  return (
    <html lang="en" className={`${inter.variable} ${theme}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="font-sans bg-noir text-chalk pb-16 md:pb-0">
        <AppNav />
        {children}
      </body>
    </html>
  )
}
