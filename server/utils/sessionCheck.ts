import { AUTH_BASE, parseSession } from '../../themes/zelda/account.ts'
import type { AuthUser } from '../../themes/zelda/account.ts'

/**
 * Who is behind a request, asked of auth.phareim.no (2026-09-29). Shared by
 * the Pages routes (server/utils/account.ts) and the mw-world WebSocket
 * service on Sleeper (servers/mw-world/server.ts), so it is plain TypeScript
 * with no framework imports and `fetch` passed in: node strips the types,
 * the tests give it a fake auth server.
 *
 * The browser's `session_token` cookie is the whole credential. It is read
 * from the request's Cookie header and forwarded alone (no other cookie
 * leaves) to `GET <auth>/api/session`. What comes back is cached by the
 * SHA-256 of the token, never by the token: 5 minutes for a signed-in
 * answer, 30 seconds for a signed-out one. The token itself is never logged
 * or stored. Auth unreachable, slow or answering nonsense is `down`, which
 * is not cached and which callers treat as "no" (fail closed).
 *
 * A signed-out browser (no cookie) is answered without asking auth at all.
 * After a sign-out elsewhere a cached positive answer lives up to 5
 * minutes: the price of not asking auth on every request.
 */

export const SESSION_COOKIE = 'session_token'
export const POSITIVE_TTL_MS = 5 * 60_000
export const NEGATIVE_TTL_MS = 30_000
export const CHECK_TIMEOUT_MS = 4000
/** More than this many cached answers: expired ones go first, then the oldest. */
const MAX_ENTRIES = 500

export type Verdict =
  | { state: 'in'; user: AuthUser }
  | { state: 'out' }
  | { state: 'down' }

type Fetch = typeof fetch

/** The `session_token` value of a Cookie header, or null. */
export function sessionTokenFrom(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  for (const part of cookieHeader.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== SESSION_COOKIE) continue
    const value = part.slice(eq + 1).trim()
    // A token is short printable ASCII; anything else would only make a bad header.
    return /^[\x21-\x7e]{1,512}$/.test(value) && !/[;,\s]/.test(value) ? value : null
  }
  return null
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
}

export interface SessionCheckerOptions {
  fetch?: Fetch
  /** Where auth lives; the tests point it at a fake. */
  base?: string
  now?: () => number
  timeoutMs?: number
}

export interface SessionChecker {
  /** The verdict for this Cookie header. Never throws. */
  check(cookieHeader: string | null | undefined): Promise<Verdict>
  /** Forgets every cached answer (tests). */
  clear(): void
}

export function createSessionChecker(opts: SessionCheckerOptions = {}): SessionChecker {
  const now = opts.now ?? Date.now
  const timeoutMs = opts.timeoutMs ?? CHECK_TIMEOUT_MS
  const cache = new Map<string, { until: number; verdict: Verdict }>()
  /** Two requests with the same token at once share one question to auth. */
  const asking = new Map<string, Promise<Verdict>>()

  function remember(key: string, verdict: Verdict): void {
    const t = now()
    if (cache.size >= MAX_ENTRIES) {
      for (const [k, v] of cache) if (v.until <= t) cache.delete(k)
      while (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value as string)
    }
    cache.set(key, { until: t + (verdict.state === 'in' ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS), verdict })
  }

  async function ask(token: string, key: string): Promise<Verdict> {
    const f = opts.fetch ?? fetch
    const ctl = typeof AbortController === 'function' ? new AbortController() : null
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null
    try {
      const res = await f(`${opts.base ?? AUTH_BASE}/api/session`, {
        method: 'GET',
        headers: { accept: 'application/json', cookie: `${SESSION_COOKIE}=${token}` },
        signal: ctl?.signal,
      })
      // 401/403 are auth saying no; every other failure means auth could not say.
      if (res.status === 401 || res.status === 403) { remember(key, { state: 'out' }); return { state: 'out' } }
      if (!res.ok) return { state: 'down' }
      const parsed = parseSession(await res.json())
      if (!parsed || parsed.state === 'offline') return { state: 'down' }
      const verdict: Verdict = parsed.state === 'in' ? { state: 'in', user: parsed.user } : { state: 'out' }
      remember(key, verdict)
      return verdict
    } catch {
      return { state: 'down' }
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  return {
    async check(cookieHeader) {
      const token = sessionTokenFrom(cookieHeader)
      if (!token) return { state: 'out' }
      const key = await sha256Hex(token)
      const hit = cache.get(key)
      if (hit && hit.until > now()) return hit.verdict
      let pending = asking.get(key)
      if (!pending) {
        pending = ask(token, key).finally(() => { asking.delete(key) })
        asking.set(key, pending)
      }
      return pending
    },
    clear() {
      cache.clear()
      asking.clear()
    },
  }
}
