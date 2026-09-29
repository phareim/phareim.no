import { ref, type Ref } from 'vue'
import { fetchSession, signIn, signOut, authPageUrl, type AuthUser } from '~/themes/zelda/account'
import { readStoredPlayer, useLeaderboard } from '~/composables/useLeaderboard'

/**
 * The site account inside the two children's games (2026-09-29): Mini World
 * and Lag Din Figur show their own sign-in window until this says `in`, and
 * mount nothing of the game before that. The window is only manners; the
 * server is the lock (server/utils/account.ts), so this composable also
 * links the account to its player profile before a game reads any save.
 *
 * States: `checking` (asking auth.phareim.no), `out` (a sign-in window),
 * `offline` (auth or the site's own server is out of reach: a calm retry,
 * never a blank page), `in` (play). Everything talks to auth through
 * themes/zelda/account.ts; the window's texts are here so both games say
 * the same things.
 *
 * Profiles and devices: after a session is found, `POST /api/account/link`
 * says which profile is the account's and the browser adopts it, so the
 * same account has the same saves on every device, and the profile a
 * browser already had (a save from before logins) is claimed on the first
 * sign-in. When a different account signs in on a browser than the last
 * one that did, the browser's local game copies are cleared first, so one
 * child's save is never pushed into another child's profile.
 */

export type AccountState = 'checking' | 'out' | 'in' | 'offline'

const LAST_USER_KEY = 'phareim.account'
/** Local copies of the two games' data and the profile that belongs to them. */
const LOCAL_KEYS = [
  'miniworld.save', 'miniworld.heroColors', 'figur.save', 'figur.heroColors', 'phareim.wallet', 'phareim.player',
  // Neon Shrine's (the portal's world): its save, best time and the mark of a cleared run.
  'zeldaSave', 'zeldaBest', 'zeldaClearedAt',
]

export const ACCOUNT_TEXT = {
  wrong: 'Feil e-post eller passord',
  tooMany: 'For mange forsøk, vent litt',
  empty: 'Skriv inn e-post og passord',
  offline: 'Får ikke kontakt akkurat nå. Prøv igjen om litt.',
  error: 'Noe gikk galt. Prøv igjen.',
  rejected: 'Det gikk ikke å logge inn her. Prøv igjen.',
  loggedOut: 'Du er logget ut. Logg inn igjen.',
  logoutFailed: 'Fikk ikke logget ut. Prøv igjen.',
} as const

export interface AccountApi {
  state: Ref<AccountState>
  user: Ref<AuthUser | null>
  /** True while a call is running (sign-in button waits). */
  busy: Ref<boolean>
  /** A line for the window, or ''. */
  problem: Ref<string>
  /** Asks auth who is signed in and links the profile. The window's first move. */
  check(): Promise<void>
  /** Signs in with what was typed; the state changes on success, `problem` says why not. */
  submit(email: string, password: string): Promise<boolean>
  /** `before` runs first (the game's last save and wallet sync). Reloads on success. */
  logOut(before?: () => Promise<void>): Promise<boolean>
  /** The auth page's sign-up form for this page: sign-up is invite-only and stays there. */
  signUpUrl(): string
  /** Quiet re-check when the tab comes back: a session that ended sends the window back. */
  recheck(): Promise<void>
}

type Wiper = () => void

/** True after this page has been in the `in` state once: a later sign-in reloads, so no game state of another account survives in memory. */
let everIn = false
const listeners = new Set<() => void>()
let wired = false

/** A route of the site answered 401: the session may have ended. Safe to call from anywhere, any number of times. */
export function reportUnauthorized(): void {
  for (const cb of listeners) cb()
}

function clearLocalCopies(): void {
  for (const k of LOCAL_KEYS) {
    try { localStorage.removeItem(k) } catch { /* no storage */ }
  }
}

/** Clears the local copies when another account than the last one is signing in here. True when it did. */
function reconcileUser(userId: string, wipe: Wiper = clearLocalCopies): boolean {
  try {
    const last = localStorage.getItem(LAST_USER_KEY)
    const switched = !!last && last !== userId
    if (switched) wipe()
    localStorage.setItem(LAST_USER_KEY, userId)
    return switched
  } catch { return false /* no storage: nothing to keep apart either */ }
}

type Linked = { ok: true; playerId: string; name: string } | { ok: false; why: 'signed-out' | 'unreachable' }

/** Asks the site's own server which profile is the account's. */
async function linkProfile(): Promise<Linked> {
  try {
    const res = await fetch('/api/account/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: readStoredPlayer()?.id ?? null }),
    })
    if (res.status === 401) {
      let code = ''
      try { code = ((await res.json()) as { data?: { code?: string } }).data?.code ?? '' } catch { /* no body */ }
      return { ok: false, why: code === 'auth-down' ? 'unreachable' : 'signed-out' }
    }
    if (!res.ok) return { ok: false, why: 'unreachable' }
    const body = await res.json() as { playerId?: unknown; name?: unknown }
    if (typeof body.playerId !== 'string' || typeof body.name !== 'string') return { ok: false, why: 'unreachable' }
    return { ok: true, playerId: body.playerId, name: body.name }
  } catch {
    return { ok: false, why: 'unreachable' }
  }
}

/**
 * Neon Shrine, the portal's world (2026-09-29): nobody has to sign in there, but a visitor who is signed in
 * plays under the account's profile, so the save, the bits, the hero's colours and the scores follow the
 * account to every device. Same link as the games' (`/api/account/link`). Call from a component's setup:
 * it takes the `adopt` of useLeaderboard() then, since the composable needs the Nuxt context.
 *   'linked'    the profile is the account's now: go on
 *   'switched'  another account was here last: the local copies are gone, start the page again
 *   'skipped'   nothing changed (no session, or the server was out of reach): play as before
 */
export function usePortalAccountLink(): (user: AuthUser) => Promise<'linked' | 'switched' | 'skipped'> {
  const { adopt } = useLeaderboard()
  return async (user) => {
    const switched = reconcileUser(user.id)
    const linked = await linkProfile()
    if (!linked.ok) return 'skipped'
    adopt({ id: linked.playerId, name: linked.name })
    return switched ? 'switched' : 'linked'
  }
}

export function useAccount(): AccountApi {
  const state = useState<AccountState>('accountState', () => 'checking')
  const user = useState<AuthUser | null>('accountUser', () => null)
  const busy = useState<boolean>('accountBusy', () => false)
  const problem = useState<string>('accountProblem', () => '')
  const { adopt } = useLeaderboard()

  /** A session is found: link the profile, then play. */
  async function settle(u: AuthUser): Promise<void> {
    reconcileUser(u.id)
    const linked = await linkProfile()
    if (linked.ok) {
      adopt({ id: linked.playerId, name: linked.name })
      user.value = u
      problem.value = ''
      state.value = 'in'
      everIn = true
    } else if (linked.why === 'signed-out') {
      // Auth says yes and the site's server says no: the cookie does not reach it (an address outside phareim.no).
      user.value = null
      problem.value = ACCOUNT_TEXT.rejected
      state.value = 'out'
    } else {
      problem.value = ACCOUNT_TEXT.offline
      state.value = 'offline'
    }
  }

  async function check(): Promise<void> {
    if (busy.value) return
    busy.value = true
    if (state.value !== 'in') state.value = 'checking'
    try {
      const s = await fetchSession()
      if (s.state === 'offline') {
        problem.value = ACCOUNT_TEXT.offline
        if (state.value !== 'in') state.value = 'offline'
      } else if (s.state === 'out') {
        user.value = null
        problem.value = ''
        state.value = 'out'
      } else if (state.value !== 'in') {
        await settle(s.user)
      }
    } finally {
      busy.value = false
    }
  }

  async function submit(email: string, password: string): Promise<boolean> {
    if (busy.value) return false
    if (!email.trim() || !password) {
      problem.value = ACCOUNT_TEXT.empty
      return false
    }
    busy.value = true
    problem.value = ''
    try {
      const r = await signIn(email, password)
      if (!r.ok) {
        problem.value = r.reason === 'wrong' ? ACCOUNT_TEXT.wrong
          : r.reason === 'too-many' ? ACCOUNT_TEXT.tooMany
            : r.reason === 'offline' ? ACCOUNT_TEXT.offline : ACCOUNT_TEXT.error
        return false
      }
      // Signed in again after a session ended mid-game: start the page over, so nothing of the last account is left in memory.
      if (everIn) { location.reload(); return true }
      await settle(r.user)
      return state.value === 'in'
    } finally {
      busy.value = false
    }
  }

  async function logOut(before?: () => Promise<void>): Promise<boolean> {
    if (busy.value) return false
    busy.value = true
    try {
      try { await before?.() } catch { /* the last save is best effort */ }
      if (!(await signOut())) {
        problem.value = ACCOUNT_TEXT.logoutFailed
        return false
      }
      // A fresh page: the game's state in memory belongs to the account that just left.
      everIn = false
      location.reload()
      return true
    } finally {
      busy.value = false
    }
  }

  async function recheck(): Promise<void> {
    if (busy.value || state.value !== 'in') return
    const s = await fetchSession()
    if (s.state === 'out') {
      user.value = null
      problem.value = ACCOUNT_TEXT.loggedOut
      state.value = 'out'
    }
  }

  // A 401 from any route of the game asks whether the session is still there (at most every 5 s).
  if (typeof window !== 'undefined' && !wired) {
    wired = true
    let last = 0
    listeners.add(() => {
      const now = Date.now()
      if (now - last < 5000) return
      last = now
      void recheck()
    })
  }

  return {
    state, user, busy, problem, check, submit, logOut, recheck,
    signUpUrl: () => authPageUrl('signup', location.href),
  }
}
