'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setStatus('sending')
    setError(null)

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setStatus('error')
      setError(error.message)
    } else {
      setStatus('sent')
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm space-y-6">
        <Link href="/" className="text-sm text-steel hover:text-ink transition-colors">
          ← vehkit
        </Link>

        <div>
          <h1 className="text-2xl font-semibold text-ink">Sign in</h1>
          <p className="text-sm text-steel mt-1">We'll email you a magic link.</p>
        </div>

        {status === 'sent' ? (
          <div className="bg-white border border-mist rounded p-6">
            <p className="text-ink font-medium">Check your inbox.</p>
            <p className="text-sm text-steel mt-1">
              We sent a sign-in link to <span className="font-mono">{email}</span>.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded border border-mist bg-white focus:border-ink outline-none transition-colors"
              disabled={status === 'sending'}
            />
            <button
              type="submit"
              disabled={status === 'sending'}
              className="w-full bg-ink text-cream py-3 rounded font-medium hover:bg-ink/90 transition-colors disabled:opacity-50"
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
