import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function ShopDonePage({
  params,
}: {
  params: Promise<{ code: string }>
}) {
  const { code } = await params

  // Try to fetch the workshop name from the just-used code so we can pre-fill claim
  let workshopName: string | null = null
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('workshop_codes')
      .select('used_by_workshop_name')
      .eq('code', code)
      .maybeSingle()
    workshopName = data?.used_by_workshop_name ?? null
  } catch {
    workshopName = null
  }

  const claimHref = workshopName
    ? `/workshop/claim?name=${encodeURIComponent(workshopName)}`
    : '/workshop/start'

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <div className="w-16 h-16 rounded-pill bg-volt/15 border border-volt mx-auto flex items-center justify-center">
          <span className="text-volt text-3xl">✓</span>
        </div>

        <h1 className="text-3xl font-semibold text-chalk tracking-tighter mt-6">
          Entry submitted
        </h1>
        <p className="text-sm text-ash mt-3 leading-relaxed">
          The verified service entry is now on the customer's record. They'll see it next time
          they open the app.
        </p>

        <div className="mt-10 space-y-2">
          <Link href="/shop" className="pill-primary block text-center">
            Log another vehicle
          </Link>
          <Link href="/" className="pill-ghost block text-center text-sm">
            Done
          </Link>
        </div>

        {/* Claim CTA */}
        <div className="card p-5 mt-12 text-left">
          <p className="nav-pill text-[10px]">Want a workshop dashboard?</p>
          <p className="text-sm text-chalk mt-2 leading-relaxed">
            {workshopName ? (
              <>
                Claim <span className="font-medium">{workshopName}</span> on Vehkit. Track every
                customer car you've serviced. Free.
              </>
            ) : (
              <>
                Sign up your workshop on Vehkit. Track every customer car you've serviced. Free.
              </>
            )}
          </p>
          <Link
            href={claimHref}
            className="inline-block mt-4 text-sm text-volt font-medium hover:underline"
          >
            {workshopName ? `Claim ${workshopName} →` : 'Sign up your workshop →'}
          </Link>
        </div>
      </div>
    </main>
  )
}
