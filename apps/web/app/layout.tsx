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

// Global double-click guard for forms. Runs on every form submit (capture
// phase, before React handlers) and disables all submit buttons inside the
// form for 10 seconds or until navigation completes — whichever comes first.
// Prevents duplicate submissions when server actions take time.
const FORM_GUARD_SCRIPT = `
(function(){
  if (typeof window === 'undefined') return;
  var disabledForms = new WeakMap();

  function disableForm(form) {
    if (disabledForms.has(form)) return;
    var buttons = form.querySelectorAll('button[type="submit"], button:not([type]), input[type="submit"]');
    var originalLabels = [];
    buttons.forEach(function(b, i) {
      originalLabels[i] = { el: b, disabled: b.disabled, opacity: b.style.opacity };
      b.disabled = true;
      b.style.opacity = '0.6';
      b.style.cursor = 'wait';
      b.setAttribute('aria-busy', 'true');
    });
    disabledForms.set(form, originalLabels);

    // Safety net: re-enable after 10s in case the action stalls so the user
    // isn't permanently locked out
    setTimeout(function() {
      var saved = disabledForms.get(form);
      if (!saved) return;
      saved.forEach(function(rec) {
        rec.el.disabled = rec.disabled;
        rec.el.style.opacity = rec.opacity || '';
        rec.el.style.cursor = '';
        rec.el.removeAttribute('aria-busy');
      });
      disabledForms.delete(form);
    }, 10000);
  }

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    // Defer disabling to the next microtask so React's server-action handler
    // captures the submitter before we lock the buttons.
    queueMicrotask(function() { disableForm(form); });
  }, true);
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
        <script dangerouslySetInnerHTML={{ __html: FORM_GUARD_SCRIPT }} />
      </head>
      <body className="font-sans bg-noir text-chalk pb-16 md:pb-0">
        <AppNav />
        {children}
      </body>
    </html>
  )
}
