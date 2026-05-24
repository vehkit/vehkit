import { redirect } from 'next/navigation'
import { AdminSidebar } from '../_components/AdminSidebar'
import { getAdminSession } from '../_lib/auth'

export const dynamic = 'force-dynamic'

export default async function AuthedAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (!(await getAdminSession())) {
    redirect('/admin/login')
  }

  return (
    <div className="min-h-[100svh] bg-noir text-chalk flex flex-col md:flex-row">
      <AdminSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
