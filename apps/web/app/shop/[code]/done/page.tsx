import Link from 'next/link'

export default function ShopDonePage() {
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

        <p className="text-xs text-ash/60 mt-12 leading-relaxed">
          Want your workshop on Vehkit?<br />
          Email <span className="font-mono text-chalk/80">workshops@vehkit.com</span>
        </p>
      </div>
    </main>
  )
}
