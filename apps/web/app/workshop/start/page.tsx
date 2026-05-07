import Link from 'next/link'

export default function WorkshopStartPage() {
  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>

        <div className="mt-10">
          <p className="nav-pill">For workshops</p>
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter mt-3">
            Put your workshop<br />on the record.
          </h1>
          <p className="text-ash mt-4 leading-relaxed">
            Customers come in with a Vehkit code. You log the service. Your name shows up on
            their permanent record — and on every passport that car carries forward.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <Bullet
            icon="✓"
            title="Build verified service history"
            body="Every entry you log becomes part of the car's permanent record."
          />
          <Bullet
            icon="📈"
            title="Customer retention"
            body="Owners get reminders for their next service. Default to you."
          />
          <Bullet
            icon="⭐"
            title="Workshop directory + reviews"
            body="Verified workshops get visible badges and discoverable profiles."
          />
        </div>

        <div className="mt-10 space-y-2">
          <Link href="/workshop/claim" className="pill-primary block text-center">
            Sign up your workshop
          </Link>
          <Link href="/login?next=/workshop" className="pill-ghost block text-center text-sm">
            Already have an account → Sign in
          </Link>
        </div>

        <p className="text-xs text-ash/60 mt-8 text-center leading-relaxed">
          Free to use. No credit card. Workshops with ≥10 verified entries unlock the silver
          badge.
        </p>
      </div>
    </main>
  )
}

function Bullet({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <div className="card p-4 flex gap-3">
      <div className="w-8 h-8 rounded-pill bg-volt/15 border border-volt/40 flex items-center justify-center shrink-0">
        <span className="text-volt text-sm">{icon}</span>
      </div>
      <div>
        <p className="text-sm font-medium text-chalk">{title}</p>
        <p className="text-xs text-ash mt-0.5">{body}</p>
      </div>
    </div>
  )
}
