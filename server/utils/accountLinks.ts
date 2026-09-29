import type { H3Event } from 'h3'
import { getStore, type D1Like } from './store'

/**
 * Which player profile belongs to which site account (2026-09-29): the
 * table `account_links` (migrations/0007_account_links.sql), D1 in
 * production and a per-process memory copy under `nuxi dev` and in the
 * tests, like the other stores. One row per account, at most one account
 * per profile. The rules that use it are in account.ts.
 */

export type ClaimResult =
  /** Linked now. */
  | 'ok'
  /** Already linked, to each other. */
  | 'same'
  /** The account already has another profile. */
  | 'user-linked'
  /** Another account has this profile. */
  | 'player-taken'
  /** No such profile (nothing to link). */
  | 'no-player'

export interface AccountLinks {
  /** The profile of an account, or null. */
  playerOf(userId: string): Promise<string | null>
  /** The account that owns a profile, or null. */
  ownerOf(playerId: string): Promise<string | null>
  /** Links an account to an existing profile unless either side is taken. */
  claim(userId: string, playerId: string, now: number): Promise<ClaimResult>
}

export class D1AccountLinks implements AccountLinks {
  constructor(private db: D1Like) {}

  async playerOf(userId: string) {
    const r = await this.db.prepare('SELECT player_id FROM account_links WHERE user_id = ?').bind(userId).first<{ player_id: string }>()
    return r?.player_id ?? null
  }

  async ownerOf(playerId: string) {
    const r = await this.db.prepare('SELECT user_id FROM account_links WHERE player_id = ?').bind(playerId).first<{ user_id: string }>()
    return r?.user_id ?? null
  }

  async claim(userId: string, playerId: string, now: number): Promise<ClaimResult> {
    // One statement: the row exists only if the profile does, and the two
    // unique keys refuse a second link on either side (INSERT OR IGNORE).
    const r = await this.db
      .prepare('INSERT OR IGNORE INTO account_links (user_id, player_id, linked_at) SELECT ?, id, ? FROM players WHERE id = ?')
      .bind(userId, now, playerId)
      .run()
    if ((r.meta?.changes ?? 0) > 0) return 'ok'
    const mine = await this.playerOf(userId)
    if (mine === playerId) return 'same'
    if (mine) return 'user-linked'
    if (await this.ownerOf(playerId)) return 'player-taken'
    return 'no-player'
  }
}

export class MemoryAccountLinks implements AccountLinks {
  private byUser = new Map<string, string>()
  private byPlayer = new Map<string, string>()

  constructor(private playerExists: (id: string) => Promise<boolean>) {}

  async playerOf(userId: string) { return this.byUser.get(userId) ?? null }
  async ownerOf(playerId: string) { return this.byPlayer.get(playerId) ?? null }

  async claim(userId: string, playerId: string): Promise<ClaimResult> {
    const mine = this.byUser.get(userId)
    if (mine === playerId) return 'same'
    if (mine) return 'user-linked'
    if (!(await this.playerExists(playerId))) return 'no-player'
    if (this.byPlayer.has(playerId)) return 'player-taken'
    this.byUser.set(userId, playerId)
    this.byPlayer.set(playerId, userId)
    return 'ok'
  }
}

let memory: MemoryAccountLinks | null = null

export function getAccountLinks(event: H3Event): AccountLinks {
  const env = (event.context as { cloudflare?: { env?: Record<string, unknown> } }).cloudflare?.env
  const db = env?.LEADERBOARD_DB as D1Like | undefined
  if (db) return new D1AccountLinks(db)
  // getStore throws in production without the binding; in dev it is the memory store.
  const main = getStore(event)
  return (memory ??= new MemoryAccountLinks(async id => !!(await main.getPlayer(id))))
}
