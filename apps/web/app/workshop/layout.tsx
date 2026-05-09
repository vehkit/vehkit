import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { WorkshopNav } from '@/components/WorkshopNav'

export const dynamic = 'force-dynamic'

export default async function WorkshopLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Public route — claim flow handles auth itself
  if (!user) return <>{children}</>

  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  // Not a workshop member yet — claim/start pages handle their own UX,
  // so we render without the workshop nav.
  if (!membership?.workshop_id) return <>{children}</>

  // Member — fetch workshop name + badge counts in parallel
  const [{ data: workshop }, { data: pendingRaw }, { data: upcomingRaw }] =
    await Promise.all([
      supabase.from('workshops').select('name').eq('id', membership.workshop_id).single(),
      supabase.rpc('workshop_pending_entries', { p_workshop_id: membership.workshop_id }),
      supabase.rpc('workshop_upcoming_visits', {
        p_workshop_id: membership.workshop_id,
        p_days_ahead: 30,
      }),
    ])

  const pendingCount = (pendingRaw ?? []).length
  const upcomingOverdue = ((upcomingRaw ?? []) as { is_overdue: boolean }[]).filter(
    (u) => u.is_overdue
  ).length

  return (
    <div className="min-h-[100svh] pb-16 md:pb-0">
      <WorkshopNav
        workshopName={workshop?.name ?? 'Your workshop'}
        pendingCount={pendingCount}
        upcomingOverdue={upcomingOverdue}
      />
      {children}
    </div>
  )
}
