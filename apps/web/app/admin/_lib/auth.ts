import { cookies } from 'next/headers'
import { createHmac, timingSafeEqual } from 'crypto'

/**
 * Local admin auth — completely separate from Supabase Auth.
 * Single user (vecna). Cookie-based session, HMAC-signed.
 */

const COOKIE_NAME = 'vehkit_admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? 'dev-only-fallback-secret-change-me'
}

function sign(value: string): string {
  return createHmac('sha256', getSecret()).update(value).digest('hex')
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return timingSafeEqual(ab, bb)
}

export function checkCredentials(username: string, password: string): boolean {
  const expectedUser = process.env.ADMIN_USERNAME ?? 'vecna'
  const expectedPass = process.env.ADMIN_PASSWORD ?? ''
  if (!expectedPass) return false // refuse login if password not configured
  return safeEq(username, expectedUser) && safeEq(password, expectedPass)
}

/**
 * Make a session token. Format: `<expiry>.<hmac>`
 */
export function makeSessionToken(): string {
  const expiry = Date.now() + COOKIE_MAX_AGE * 1000
  const payload = `vecna:${expiry}`
  const hmac = sign(payload)
  return `${expiry}.${hmac}`
}

export function verifySessionToken(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 2) return false
  const [expiryStr, hmac] = parts
  if (!expiryStr || !hmac) return false
  const expiry = Number(expiryStr)
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false
  const expected = sign(`vecna:${expiry}`)
  return safeEq(hmac, expected)
}

export async function getAdminSession(): Promise<boolean> {
  const c = await cookies()
  const token = c.get(COOKIE_NAME)?.value
  return verifySessionToken(token)
}

export async function setAdminCookie() {
  const c = await cookies()
  c.set(COOKIE_NAME, makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
}

export async function clearAdminCookie() {
  const c = await cookies()
  c.delete(COOKIE_NAME)
}
