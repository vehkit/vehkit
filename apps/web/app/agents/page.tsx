import { redirect } from 'next/navigation'

/**
 * People intuitively type the plural — let them.
 *
 * `/agents` → `/agent/start` so a returning agent or first-time visitor
 * lands in the right place. The agent layout will then forward signed-in
 * members on to `/agent` (the dashboard).
 */
export default function AgentsRedirect() {
  redirect('/agent/start')
}
