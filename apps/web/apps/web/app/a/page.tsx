import { redirect } from 'next/navigation'

/**
 * Legacy redirect — `/a` was the original agent code redemption route,
 * but it lived in the same namespace as `/a/[token]` (family invite),
 * which meant brokers intuitively constructing `/a/CODE` landed on a
 * broken family-invite preview. Canonical home is now `/agent/redeem`.
 *
 * This server component preserves any existing share links while
 * forwarding `?code=…&error=…` searchParams.
 */
export default async function LegacyAgentCodePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(sp)) {
    if (typeof v === 'string') params.set(k, v)
  }
  const qs = params.toString()
  redirect(qs ? `/agent/redeem?${qs}` : '/agent/redeem')
}
