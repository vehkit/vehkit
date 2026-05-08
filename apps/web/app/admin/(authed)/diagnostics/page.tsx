import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Check = {
  label: string
  ok: boolean
  detail: string
}

async function runChecks(): Promise<Check[]> {
  const checks: Check[] = []

  // 1. SUPABASE_URL set
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  checks.push({
    label: 'NEXT_PUBLIC_SUPABASE_URL',
    ok: !!url,
    detail: url ? `${url.slice(0, 40)}…` : 'NOT SET',
  })

  // 2. Service role key set + format
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  const keyFormat = !key
    ? 'NOT SET'
    : key.startsWith('sb_secret_')
      ? `new format · sb_secret_…${key.slice(-4)}`
      : key.startsWith('eyJ')
        ? `LEGACY JWT · eyJ…${key.slice(-4)} — switch to sb_secret_`
        : `unrecognized format · starts with "${key.slice(0, 6)}…"`

  checks.push({
    label: 'SUPABASE_SERVICE_ROLE_KEY',
    ok: !!key && key.startsWith('sb_secret_'),
    detail: keyFormat,
  })

  // 3. Try a real query — profiles count
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
    if (error) {
      checks.push({
        label: 'profiles count',
        ok: false,
        detail: `${error.message || '(empty message)'} · ${error.code ?? '—'} · ${JSON.stringify(error)}`,
      })
    } else {
      checks.push({
        label: 'profiles count',
        ok: (count ?? 0) > 0,
        detail: `${count ?? 0} rows`,
      })
    }
  } catch (e) {
    checks.push({
      label: 'profiles count',
      ok: false,
      detail: `threw: ${(e as Error).message}`,
    })
  }

  // 4. Vehicles count
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('vehicles')
      .select('*', { count: 'exact', head: true })
    if (error) {
      checks.push({
        label: 'vehicles count',
        ok: false,
        detail: `${error.message || '(empty message)'} · ${error.code ?? '—'} · ${JSON.stringify(error)}`,
      })
    } else {
      checks.push({
        label: 'vehicles count',
        ok: true,
        detail: `${count ?? 0} rows`,
      })
    }
  } catch (e) {
    checks.push({
      label: 'vehicles count',
      ok: false,
      detail: `threw: ${(e as Error).message}`,
    })
  }

  // 5. Workshops count
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('workshops')
      .select('*', { count: 'exact', head: true })
    if (error) {
      checks.push({
        label: 'workshops count',
        ok: false,
        detail: `${error.message || '(empty message)'} · ${error.code ?? '—'} · ${JSON.stringify(error)}`,
      })
    } else {
      checks.push({
        label: 'workshops count',
        ok: true,
        detail: `${count ?? 0} rows`,
      })
    }
  } catch (e) {
    checks.push({
      label: 'workshops count',
      ok: false,
      detail: `threw: ${(e as Error).message}`,
    })
  }

  // 6. Service records count
  try {
    const supabase = createAdminClient()
    const { count, error } = await supabase
      .from('service_records')
      .select('*', { count: 'exact', head: true })
    if (error) {
      checks.push({
        label: 'service_records count',
        ok: false,
        detail: `${error.message || '(empty message)'} · ${error.code ?? '—'} · ${JSON.stringify(error)}`,
      })
    } else {
      checks.push({
        label: 'service_records count',
        ok: true,
        detail: `${count ?? 0} rows`,
      })
    }
  } catch (e) {
    checks.push({
      label: 'service_records count',
      ok: false,
      detail: `threw: ${(e as Error).message}`,
    })
  }

  // 7. RPC sanity — admin_overview_stats
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.rpc('admin_overview_stats')
    if (error) {
      checks.push({
        label: 'admin_overview_stats RPC',
        ok: false,
        detail: `${error.message || '(empty message)'} · ${error.code ?? '—'} · ${JSON.stringify(error)}`,
      })
    } else {
      checks.push({
        label: 'admin_overview_stats RPC',
        ok: !!data,
        detail: data ? 'returned object' : 'returned null',
      })
    }
  } catch (e) {
    checks.push({
      label: 'admin_overview_stats RPC',
      ok: false,
      detail: `threw: ${(e as Error).message}`,
    })
  }

  // 8. Resend
  checks.push({
    label: 'RESEND_API_KEY',
    ok: !!process.env.RESEND_API_KEY,
    detail: process.env.RESEND_API_KEY
      ? `set · …${process.env.RESEND_API_KEY.slice(-4)}`
      : 'NOT SET',
  })
  checks.push({
    label: 'RESEND_FROM',
    ok: !!process.env.RESEND_FROM,
    detail: process.env.RESEND_FROM ?? 'NOT SET',
  })

  // 9. Cron secret
  checks.push({
    label: 'CRON_SECRET',
    ok: !!process.env.CRON_SECRET,
    detail: process.env.CRON_SECRET ? 'set' : 'NOT SET',
  })

  // 10. Admin auth env
  checks.push({
    label: 'ADMIN_USERNAME',
    ok: !!process.env.ADMIN_USERNAME,
    detail: process.env.ADMIN_USERNAME ?? 'NOT SET (defaults to "vecna")',
  })
  checks.push({
    label: 'ADMIN_PASSWORD',
    ok: !!process.env.ADMIN_PASSWORD,
    detail: process.env.ADMIN_PASSWORD ? 'set' : 'NOT SET',
  })
  checks.push({
    label: 'ADMIN_SESSION_SECRET',
    ok: !!process.env.ADMIN_SESSION_SECRET,
    detail: process.env.ADMIN_SESSION_SECRET ? 'set' : 'NOT SET',
  })

  // 11. Site URL
  checks.push({
    label: 'NEXT_PUBLIC_SITE_URL',
    ok: !!process.env.NEXT_PUBLIC_SITE_URL,
    detail: process.env.NEXT_PUBLIC_SITE_URL ?? 'NOT SET',
  })

  return checks
}

export default async function AdminDiagnosticsPage() {
  const checks = await runChecks()
  const passed = checks.filter((c) => c.ok).length
  const total = checks.length

  return (
    <div className="px-6 md:px-10 py-8 max-w-4xl">
      <header className="mb-8">
        <p className="text-xs tracking-widest uppercase text-ash">Vehkit · Admin</p>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tighter mt-1">
          Diagnostics
        </h1>
        <p className="text-sm text-ash mt-1">
          {passed} / {total} checks passed
        </p>
      </header>

      <div className="card divide-y divide-seam">
        {checks.map((c, i) => (
          <div key={i} className="flex items-start gap-3 p-4">
            <div
              className={`shrink-0 w-2 h-2 rounded-full mt-2 ${
                c.ok ? 'bg-volt' : 'bg-signal'
              }`}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm text-chalk font-mono">{c.label}</p>
              <p
                className={`text-xs mt-1 font-mono ${
                  c.ok ? 'text-ash' : 'text-signal'
                }`}
              >
                {c.detail}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 text-xs text-ash leading-relaxed">
        <p className="mb-2">
          <span className="text-chalk">If profiles count is 0 but DB has rows:</span>{' '}
          your service role key is the legacy JWT (eyJ…). Get the new sb_secret_*
          key from Supabase → Project Settings → API and update Vercel env vars.
        </p>
        <p className="mb-2">
          <span className="text-chalk">If a count returns an error:</span> the row
          shows the Postgres error message + code. Common: <code>42P01</code> (table
          missing) means a migration didn't run; <code>42501</code> (permission)
          means RLS is rejecting service role (key is wrong).
        </p>
        <p>
          <span className="text-chalk">If everything is green but pages still
          show zero:</span> hard reload the admin page and check Vercel runtime
          logs for the actual query.
        </p>
      </div>
    </div>
  )
}
