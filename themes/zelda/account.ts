/**
 * The login console's side of auth.phareim.no (the site-wide account, built
 * alongside this site). Framework-free, and `fetch` is passed in, so the
 * portal tests run it against a fake server and never touch the network.
 *
 * Contract: the page `/` takes `redirect`, `theme` (neon | paper) and `mode`
 * (signin | signup); `GET /api/session` answers `{ user: { id, email, name,
 * image } | null }`; `POST /api/sign-out` ends the session. Both API calls go
 * cross-origin with the session cookie (`credentials: 'include'`); the server
 * reflects phareim.no and *.phareim.no origins. Anything else (localhost, the
 * server down) comes back as `offline`.
 */

/** The one place the auth server's address lives. */
export const AUTH_BASE = 'https://auth.phareim.no'

/** A session call that has not answered in this long counts as offline. */
export const AUTH_TIMEOUT_MS = 6000

export interface AuthUser {
  id: string
  email: string
  name: string | null
  image: string | null
}

export type Session =
  | { state: 'in'; user: AuthUser }
  | { state: 'out' }
  | { state: 'offline' }

type Fetch = typeof fetch

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null
}

/** The session body as the contract has it, or null when it is something else. */
export function parseSession(body: unknown): Session | null {
  if (!body || typeof body !== 'object' || !('user' in body)) return null
  const u = (body as { user: unknown }).user
  if (u === null) return { state: 'out' }
  if (!u || typeof u !== 'object') return null
  const o = u as Record<string, unknown>
  const id = str(o.id)
  const email = str(o.email)
  if (!id || !email) return null
  return { state: 'in', user: { id, email, name: str(o.name), image: str(o.image) } }
}

async function call(f: Fetch, url: string, init: RequestInit, timeoutMs: number): Promise<Response | null> {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
  try {
    return await f(url, { ...init, credentials: 'include', signal: ctl?.signal })
  } catch {
    // CORS refused, no network, timed out.
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Who is logged in on auth.phareim.no, from this browser. */
export async function fetchSession(f: Fetch = fetch, base = AUTH_BASE, timeoutMs = AUTH_TIMEOUT_MS): Promise<Session> {
  const res = await call(f, `${base}/api/session`, { method: 'GET', headers: { accept: 'application/json' } }, timeoutMs)
  if (!res?.ok) return { state: 'offline' }
  try {
    return parseSession(await res.json()) ?? { state: 'offline' }
  } catch {
    return { state: 'offline' }
  }
}

/** Ends the session. True when the server said so. */
export async function signOut(f: Fetch = fetch, base = AUTH_BASE, timeoutMs = AUTH_TIMEOUT_MS): Promise<boolean> {
  const res = await call(f, `${base}/api/sign-out`, { method: 'POST' }, timeoutMs)
  return !!res?.ok
}

/** The auth page in the neon theme, coming back to `back` afterwards. */
export function authPageUrl(mode: 'signin' | 'signup', back: string, base = AUTH_BASE): string {
  const q = new URLSearchParams({ theme: 'neon', redirect: back })
  if (mode === 'signup') q.set('mode', 'signup')
  return `${base}/?${q.toString()}`
}
