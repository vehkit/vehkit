import { redirect } from 'next/navigation'
import { adminLogin } from '../_actions/auth'
import { getAdminSession } from '../_lib/auth'

export const dynamic = 'force-dynamic'

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error

  // If already signed in, jump straight to dashboard
  if (await getAdminSession()) redirect('/admin')

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12 bg-noir">
      <div className="w-full max-w-sm">
        <p className="text-xs tracking-[0.3em] uppercase text-ash">Vehkit · Admin</p>
        <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tightest mt-3">
          Sign in
        </h1>
        <p className="text-sm text-ash mt-2">Internal access only.</p>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={adminLogin} className="mt-8 space-y-3">
          <input
            type="text"
            name="username"
            required
            autoFocus
            autoComplete="username"
            placeholder="Username"
            className="field"
          />
          <input
            type="password"
            name="password"
            required
            autoComplete="current-password"
            placeholder="Password"
            className="field"
          />
          <button type="submit" className="pill-primary w-full">
            Enter
          </button>
        </form>

        <p className="text-xs text-ash/60 mt-12 text-center font-mono">
          v · system
        </p>
      </div>
    </main>
  )
}
