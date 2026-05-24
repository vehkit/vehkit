export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Vehkit · Admin',
  robots: { index: false, follow: false },
}

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
