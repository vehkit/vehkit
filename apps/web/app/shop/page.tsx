import Link from 'next/link'
import { redirect } from 'next/navigation'

export default async function ShopEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; code?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error
  const prefilled = sp.code ?? ''

  async function go(formData: FormData) {
    'use server'
    const code = String(formData.get('code') ?? '').trim()
    if (!code || !/^\d{6}$/.test(code)) {
      redirect('/shop?error=Enter+a+valid+6-digit+code')
    }
    redirect(`/shop/${code}`)
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>

        <div className="mt-10">
          <p className="nav-pill">For workshops</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-2">
            Enter the code
          </h1>
          <p className="text-sm text-ash mt-2 leading-relaxed">
            Ask the customer to generate a workshop code from their Vehkit app, then enter it
            below. You'll log a verified service entry on their car.
          </p>
        </div>

        {errorMsg && (
          <div className="mt-6 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
            {decodeURIComponent(errorMsg)}
          </div>
        )}

        <form action={go} className="mt-8 space-y-3">
          <input
            type="text"
            name="code"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            defaultValue={prefilled}
            placeholder="6-digit code"
            className="field font-mono text-center text-3xl tracking-[0.4em] tabular-nums"
          />
          <button type="submit" className="pill-primary w-full">
            Continue →
          </button>
        </form>

        <p className="text-xs text-ash/60 mt-8 text-center">
          One code · One entry · Auto-expires
        </p>
      </div>
    </main>
  )
}
