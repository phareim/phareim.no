/**
 * The login console's side of auth.phareim.no (the site-wide account, built
 * alongside this site). Framework-free, and `fetch` is passed in, so the
 * portal tests run it against a fake server and never touch the network.
 *
 * Contract: the page `/` takes `redirect`, `theme` (neon | paper) and `mode`
 * (signin | signup); `GET /api/session` answers `{ user: { id, email, name,
 * image } | null }`; `POST /api/sign-out` ends the session; `POST
 * /api/sign-in { email, password }` answers `{ user }` and sets the cookie
 * (429 after ten failed tries for an email in ten minutes). All calls go
 * cross-origin with the session cookie (`credentials: 'include'`); the server
 * reflects phareim.no and *.phareim.no origins. Anything else (localhost, the
 * server down) comes back as `offline`. The in-game sign-in windows of Mini
 * World and Lag Din Figur (composables/useAccount.ts) use `signIn`; sign-up
 * stays on the auth page (invite only).
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

export type SignInResult =
  | { ok: true; user: AuthUser }
  /** wrong: email or password did not match; too-many: rate limited (429); offline: no answer; error: anything else. */
  | { ok: false; reason: 'wrong' | 'too-many' | 'offline' | 'error' }

/**
 * Signs in with email and password. The cookie comes back on the response
 * (auth sets it for `.phareim.no`); the password is sent once and kept
 * nowhere. A success without a readable user is confirmed with a session
 * call before it counts.
 */
export async function signIn(email: string, password: string, f: Fetch = fetch, base = AUTH_BASE, timeoutMs = AUTH_TIMEOUT_MS): Promise<SignInResult> {
  const res = await call(
    f,
    `${base}/api/sign-in`,
    { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ email: email.trim(), password }) },
    timeoutMs,
  )
  if (!res) return { ok: false, reason: 'offline' }
  if (res.status === 429) return { ok: false, reason: 'too-many' }
  if (res.status === 400 || res.status === 401 || res.status === 403 || res.status === 404) return { ok: false, reason: 'wrong' }
  if (!res.ok) return { ok: false, reason: 'error' }
  let parsed: Session | null = null
  try { parsed = parseSession(await res.json()) } catch { /* fall through to the session call */ }
  if (!parsed || parsed.state !== 'in') parsed = await fetchSession(f, base, timeoutMs)
  return parsed.state === 'in' ? { ok: true, user: parsed.user } : { ok: false, reason: 'error' }
}

/** The auth page in the neon theme, coming back to `back` afterwards. */
export function authPageUrl(mode: 'signin' | 'signup', back: string, base = AUTH_BASE): string {
  const q = new URLSearchParams({ theme: 'neon', redirect: back })
  if (mode === 'signup') q.set('mode', 'signup')
  return `${base}/?${q.toString()}`
}
