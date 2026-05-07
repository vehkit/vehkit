'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams?.get('next') ?? '/garage'

  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl },
    })

    if (error) {
      setStatus('error')
      setError(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="min-h-[100svh] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <Link href="/" className="nav-pill hover:text-chalk transition-colors">
          ← vehkit
        </Link>

        <div className="mt-10">
          <h1 className="text-3xl md:text-4xl font-semibold text-chalk tracking-tighter">
            Sign in
          </h1>
          <p className="text-sm text-ash mt-2">We'll email you a magic link.</p>
        </div>

        {status === 'sent' ? (
          <div className="card p-6 mt-8">
            <p className="text-chalk font-medium">Check your inbox.</p>
            <p className="text-sm text-ash mt-1.5">
              We sent a sign-in link to{' '}
              <span className="font-mono text-chalk">{email}</span>.
            </p>
            <p className="text-xs text-ash/70 mt-4">
              Link expires in 5 minutes. Use it on the same device.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3 mt-8">
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="field"
              disabled={status === 'sending'}
            />
            <button
              type="submit"
              disabled={status === 'sending' || !email}
              className="pill-primary w-full disabled:opacity-50 disabled:active:scale-100"
            >
              {status === 'sending' ? 'Sending…' : 'Send magic link'}
            </button>
            {error && <p className="text-sm text-signal">{error}</p>}
          </form>
        )}
      </div>
    </main>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100svh] flex items-center justify-center">
          <p className="text-ash text-sm">Loading…</p>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  )
}
