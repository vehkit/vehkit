import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { normalizeCode } from '@/lib/workshop-codes'

export const dynamic = 'force-dynamic'

export default async function WorkshopLogEntryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const errorMsg = sp.error

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/workshop/log')

  const { data: membership } = await supabase
    .from('workshop_members')
    .select('workshop_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()
  if (!membership?.workshop_id) redirect('/workshop/claim')

  async function go(formData: FormData) {
    'use server'
    const raw = String(formData.get('code') ?? '').trim()
    const normalized = normalizeCode(raw)
    if (!normalized) {
      redirect('/workshop/log?error=Enter+a+valid+code')
    }
    redirect(`/shop/${normalized}`)
  }

  return (
    <main className="max-w-3xl mx-auto px-6 pt-6 pb-24">
      <header>
        <p className="text-[10px] tracking-widest uppercase text-ash">Workshop · New entry</p>
        <h1 className="text-2xl md:text-3xl font-semibold text-chalk tracking-tighter mt-1">
          Log a service
        </h1>
        <p className="text-sm text-ash mt-0.5">
          Enter the 6-character code your customer generated.
        </p>
      </header>

      {errorMsg && (
        <div className="mt-4 bg-signal/10 border border-signal/30 text-signal text-sm px-4 py-3 rounded-DEFAULT">
          {decodeURIComponent(errorMsg)}
        </div>
      )}

      <section className="card p-6 md:p-8 mt-6">
        <form action={go} className="space-y-5">
          <div>
            <label htmlFor="code" className="label">
              Customer code
            </label>
            <input
              type="text"
              id="code"
              name="code"
              inputMode="text"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              maxLength={8}
              required
              autoFocus
              placeholder="ABC-123"
              className="field font-mono text-center text-3xl tracking-[0.2em] uppercase"
            />
            <p className="text-[11px] text-ash mt-2 text-center">
              Hyphens and spaces are auto-stripped. Codes expire 1 hour after generation.
            </p>
          </div>

          <button type="submit" className="pill-primary text-sm w-full">
            Continue →
          </button>
        </form>
      </section>

      {/* How it works refresher */}
      <section className="mt-8 grid md:grid-cols-3 gap-3">
        <Step
          n="1"
          title="Customer generates a code"
          body="On their car page, they tap Generate workshop code. Single-use, 1-hour expiry."
        />
        <Step
          n="2"
          title="You enter it here"
          body="Type the code, fill in service type, date, odometer, cost. Hit submit."
        />
        <Step
          n="3"
          title="Customer confirms"
          body="They get an email and have 24 hours to retract. After that, the entry is permanent on their record — and your portfolio."
        />
      </section>

      <p className="text-[11px] text-ash/70 leading-relaxed mt-8">
        Entries you log here count toward your verified-entry total, your tier progress, and
        your customer roster. They appear in <Link href="/workshop" className="text-volt hover:underline">Dashboard</Link> the moment they're logged.
      </p>
    </main>
  )
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card p-4">
      <div className="w-8 h-8 rounded-pill bg-volt/15 text-volt flex items-center justify-center font-mono text-sm font-semibold">
        {n}
      </div>
      <h3 className="text-sm font-semibold text-chalk mt-3">{title}</h3>
      <p className="text-xs text-ash mt-1.5 leading-relaxed">{body}</p>
    </div>
  )
}
