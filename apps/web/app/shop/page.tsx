import Link from 'next/link'
import { redirect } from 'next/navigation'
import { normalizeCode } from '@/lib/workshop-codes'

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
    const raw = String(formData.get('code') ?? '').trim()
    const normalized = normalizeCode(raw)
    if (!normalized) {
      redirect('/shop?error=Enter+a+valid+code')
    }
    redirect(`/shop/${normalized}`)
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
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={8}
            required
            autoFocus
            defaultValue={prefilled}
            placeholder="ABC-123"
            className="field font-mono text-center text-3xl tracking-[0.2em] uppercase"
          />
          <button type="submit" className="pill-primary w-full">
            Continue →
          </button>
        </form>

        <p className="text-xs text-ash/60 mt-8 text-center">
          One code · One entry · Auto-expires
        </p>

        <div className="mt-12 card p-5">
          <p className="nav-pill text-[10px]">Want a workshop dashboard?</p>
          <p className="text-sm text-chalk mt-2 leading-relaxed">
            Track every customer car you've serviced, view stats, get verified.
          </p>
          <Link
            href="/workshop/start"
            className="inline-block mt-3 text-sm text-volt font-medium hover:underline"
          >
            Sign up your workshop →
          </Link>
        </div>
      </div>
    </main>
  )
}
