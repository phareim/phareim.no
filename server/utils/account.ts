import type { H3Event } from 'h3'
import type { AuthUser } from '../../themes/zelda/account.ts'
import { createSessionChecker, type SessionChecker } from './sessionCheck'
import { getAccountLinks, type AccountLinks } from './accountLinks'
import { isPlayerId, type Store } from './store'
import { randomName, rerollName } from '~/themes/leaderboard/names'

/**
 * The sign-in gate for Mini World and Lag Din Figur (2026-09-29). The
 * window in the game is only manners; this is the lock. Every route of the
 * two games (`/api/mw/*`, `/api/save` for the slots `miniworld` and
 * `figur`, `/api/wallet` for Mini World and for any linked profile,
 * `/api/account/link`) asks here:
 *
 * 1. Is there a session? The request's `session_token` cookie goes to
 *    auth.phareim.no (sessionCheck.ts: cached, fail closed). No session is
 *    401 `sign-in`; auth unreachable is 401 `auth-down` (the client shows
 *    a calm retry, not a sign-in form).
 * 2. Is this profile the account's? A profile (`playerId`) belongs to at
 *    most one account (account_links). The first time an account uses a
 *    profile nobody owns, it is claimed on the spot, so a save made before
 *    logins existed is kept. Someone else's profile, or an account that
 *    already has a different one, is 403 `not-yours`.
 *
 * The rules are plain functions over the checker and the link store, so
 * the tests drive them with a fake auth server; the `require*` functions
 * are the thin glue the routes call. The Norway gate and Origin checks
 * are separate and run as before.
 */

export const ACCOUNT_GAMES: readonly string[] = ['miniworld', 'figur']

/** True for the save slots and wallet clients that need an account. */
export function isAccountGame(game: unknown): boolean {
  return typeof game === 'string' && ACCOUNT_GAMES.includes(game)
}

export class AccountError extends Error {
  constructor(public status: number, public code: 'sign-in' | 'auth-down' | 'not-yours' | 'no-profile') {
    super(code)
  }
}

/** The signed-in user behind this Cookie header. Throws AccountError 401 otherwise. */
export async function userFromCookie(checker: SessionChecker, cookie: string | null | undefined): Promise<AuthUser> {
  const v = await checker.check(cookie)
  if (v.state === 'in') return v.user
  throw new AccountError(401, v.state === 'down' ? 'auth-down' : 'sign-in')
}

/**
 * The profile must be the account's. Claims it when neither side is linked
 * yet. An unknown profile passes (there is nothing to protect, and the
 * route answers 404 as before); an id that is not a profile id at all
 * passes too, for the route's own 400.
 */
export async function authorizePlayer(links: AccountLinks, user: AuthUser, playerId: unknown, now = Date.now()): Promise<void> {
  if (!isPlayerId(playerId)) return
  const mine = await links.playerOf(user.id)
  if (mine === playerId) return
  if (mine) throw new AccountError(403, 'not-yours')
  const r = await links.claim(user.id, playerId, now)
  if (r === 'ok' || r === 'same' || r === 'no-player') return
  throw new AccountError(403, 'not-yours')
}

/**
 * For routes shared with a game that has no account yet (the wallet is
 * Neon Shrine's too): a profile nobody has linked stays open as before; a
 * linked one needs its owner's session.
 */
export async function guardLinked(links: AccountLinks, checker: SessionChecker, cookie: string | null | undefined, playerId: unknown): Promise<void> {
  if (!isPlayerId(playerId)) return
  const owner = await links.ownerOf(playerId)
  if (!owner) return
  const user = await userFromCookie(checker, cookie)
  if (user.id !== owner) throw new AccountError(403, 'not-yours')
}

export interface LinkAnswer {
  playerId: string
  name: string
  /** How the profile came to be the account's. */
  linked: 'existing' | 'claimed' | 'created'
}

/**
 * Whose profile is this account's, as /api/account/link answers it:
 * the account's own if it has one (a new device gets the same saves);
 * else the one the browser brought, claimed (a save from before logins is
 * kept); else, when the browser brought none, an unknown one or one
 * another account owns, a fresh one. `newId` is for the tests.
 */
export async function linkProfile(
  store: Pick<Store, 'getPlayer' | 'upsertPlayer'>,
  links: AccountLinks,
  userId: string,
  requested: unknown,
  now = Date.now(),
  newId: () => string = () => crypto.randomUUID(),
): Promise<LinkAnswer & { fresh: boolean }> {
  const answer = async (id: string, linked: LinkAnswer['linked']) => {
    const p = await store.getPlayer(id)
    return p ? { playerId: id, name: p.name, linked, fresh: false } : null
  }
  /** Another request may have linked the account in the meantime: its answer stands. */
  const raced = async () => {
    const won = await links.playerOf(userId)
    return won ? answer(won, 'existing') : null
  }

  const mine = await links.playerOf(userId)
  if (mine) {
    const a = await answer(mine, 'existing')
    if (a) return a
  } else if (isPlayerId(requested)) {
    const r = await links.claim(userId, requested, now)
    if (r === 'ok' || r === 'same') {
      const a = await answer(requested, 'claimed')
      if (a) return a
    }
    const a = await raced()
    if (a) return a
  }

  for (let i = 0; i < 6; i++) {
    const id = newId()
    let name = randomName()
    let made = false
    for (let j = 0; j < 8 && !made; j++) {
      if ((await store.upsertPlayer(id, name)) === 'ok') made = true
      else name = rerollName(name)
    }
    if (!made) continue
    if ((await links.claim(userId, id, now)) === 'ok') return { playerId: id, name, linked: 'created', fresh: true }
    const a = await raced()
    if (a) return a
  }
  throw new AccountError(500, 'no-profile')
}

// ---------------------------------------------------------------- glue for the routes

let shared: SessionChecker | null = null
let override: SessionChecker | null = null

/** Tests hand in a checker with a fake auth server; null puts the real one back. */
export function useSessionChecker(checker: SessionChecker | null): void {
  override = checker
}

function checkerFor(): SessionChecker {
  if (override) return override
  // Under `nuxi dev` the auth server can be swapped for a local fake (the
  // browser runs, scripts/login-lab/); in production the address is fixed.
  const devBase = import.meta.dev ? process.env.PHAREIM_DEV_AUTH_BASE : undefined
  return (shared ??= createSessionChecker(devBase ? { base: devBase } : {}))
}

function fail(e: unknown): never {
  if (e instanceof AccountError) throw createError({ statusCode: e.status, statusMessage: e.code, data: { code: e.code } })
  throw e
}

const cookieOf = (event: H3Event) => getRequestHeader(event, 'cookie')

/** The signed-in user, or a 401. */
export async function requireAccount(event: H3Event): Promise<AuthUser> {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  try {
    return await userFromCookie(checkerFor(), cookieOf(event))
  } catch (e) { return fail(e) }
}

/** The signed-in user, who must own `playerId` (claimed if free). 401 or 403 otherwise. */
export async function requireAccountPlayer(event: H3Event, playerId: unknown): Promise<AuthUser> {
  const user = await requireAccount(event)
  try {
    await authorizePlayer(getAccountLinks(event), user, playerId)
    return user
  } catch (e) { return fail(e) }
}

/** The wallet without a game hint: open for a profile nobody linked, the owner's for a linked one. */
export async function guardLinkedPlayer(event: H3Event, playerId: unknown): Promise<void> {
  try {
    await guardLinked(getAccountLinks(event), checkerFor(), cookieOf(event), playerId)
  } catch (e) { fail(e) }
}

/** The signed-in user or null, never an error (for routes that open more to owners). */
export async function softAccount(event: H3Event): Promise<AuthUser | null> {
  const v = await checkerFor().check(cookieOf(event))
  return v.state === 'in' ? v.user : null
}

/** True when a signed-in user owns `playerId`. */
export async function ownsPlayer(event: H3Event, playerId: string): Promise<boolean> {
  const user = await softAccount(event)
  return !!user && (await getAccountLinks(event).ownerOf(playerId)) === user.id
}
