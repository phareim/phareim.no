/**
 * Neon Shrine's bits are the site wallet (composables/useWallet.ts), the
 * same bits Mini World spends. The engine stays pure and keeps counting
 * `inv.bits`; this bridge, driven by the shell, turns every change the
 * engine makes into a wallet op and puts the wallet's balance back into
 * `inv.bits` whenever the wallet moves on its own (another tab, Mini World,
 * a server sync). The wallet is the truth; the save's `bits` is only a copy.
 *
 * The hero carries at most MAX_BITS: a bigger wallet shows MAX_BITS here
 * and stays exact in the wallet (pickups at the cap are lost, as with a
 * full purse in LTTP).
 *
 * Pure (no DOM, no Vue): the wallet functions and the storage come in as
 * arguments, so `tests/zelda-wallet.test.mjs` covers it in plain node.
 */
import { MAX_BITS, type Inventory, type SaveData, type World } from './types'

export interface WalletApi {
  read(): number
  /** Adds `delta` (may be negative) and answers the new balance. */
  add(delta: number, reason: string): number
}

export interface BitsBridge {
  /** A new game state was created: its bits become the wallet's. `flags`: the state's flags (one-time rewards it already has). */
  adopt(inv: Inventory, flags?: Readonly<Record<string, unknown>>): void
  /**
   * After an engine step: a change in `inv.bits` goes to the wallet, less a
   * one-time reward (a chest, a floor item, an NPC's gift) this browser was
   * paid before. Returns the delta sent (0 when none).
   */
  step(inv: Inventory, flags?: Readonly<Record<string, unknown>>): number
  /** The wallet moved (any cause): the hero carries the new balance. */
  external(inv: Inventory, balance: number): void
}

export const WALLET_REASON = 'shrine'

export function carried(balance: number): number {
  if (!Number.isFinite(balance)) return 0
  return Math.max(0, Math.min(MAX_BITS, Math.floor(balance)))
}

/**
 * One-time rewards are paid once per browser, not once per run. Before the
 * wallet a new game started on 0 bits, so a chest that paid again after
 * START OVER (or, before the sword, on every visit: nothing is saved yet)
 * cost nothing. With bits that outlive the run it would be a fountain.
 */
export interface OnceRewards {
  /** Bits paid by the flag the engine sets with the reward: `chest:<id>`, `took:<id>` (see `bitRewards`). `got:<npc>:bitsN` needs no entry. */
  rewards: ReadonlyMap<string, number>
  /** Flags this browser has been paid for. */
  paid: PaidFlags
}

export interface PaidFlags {
  has(flag: string): boolean
  add(flag: string): void
}

const BIT_ITEMS: Record<string, number> = { bits5: 5, bits20: 20, bits50: 50 }

/** The world's one-time bits: chest and floor-item flags → bits. */
export function bitRewards(world: Pick<World, 'maps'>): Map<string, number> {
  const out = new Map<string, number>()
  for (const map of Object.values(world.maps)) {
    for (const mark of Object.values(map.marks)) {
      const e = mark.ent
      if ((e.t === 'chest' || e.t === 'item') && BIT_ITEMS[e.item]) out.set(`${e.t === 'chest' ? 'chest' : 'took'}:${e.id}`, BIT_ITEMS[e.item]!)
    }
  }
  return out
}

function rewardOf(once: OnceRewards, flag: string): number {
  const r = once.rewards.get(flag)
  if (r) return r
  const m = /^got:.+:(bits\d+)$/.exec(flag)
  return m ? BIT_ITEMS[m[1]!] ?? 0 : 0
}

export function createBitsBridge(wallet: WalletApi, once?: OnceRewards): BitsBridge {
  /** What `inv.bits` held after the last sync: anything else is the engine's doing. */
  let seen = 0
  /** Flags already looked at in this state. */
  let known = new Set<string>()
  const set = (inv: Inventory, balance: number) => {
    inv.bits = carried(balance)
    seen = inv.bits
  }
  /** Bits of the rewards that arrived since the last look and were paid before. */
  const repaid = (flags: Readonly<Record<string, unknown>>): number => {
    if (!once) return 0
    let n = 0
    for (const f of Object.keys(flags)) {
      if (known.has(f)) continue
      known.add(f)
      const r = rewardOf(once, f)
      if (!r) continue
      if (once.paid.has(f)) n += r
      else once.paid.add(f)
    }
    return n
  }
  return {
    adopt(inv, flags) {
      known = new Set(flags ? Object.keys(flags) : [])
      // What this state already opened was paid in its own history.
      if (once) for (const f of known) if (rewardOf(once, f) && !once.paid.has(f)) once.paid.add(f)
      set(inv, wallet.read())
    },
    step(inv, flags) {
      const delta = inv.bits - seen
      if (delta === 0) return 0
      seen = inv.bits
      const send = delta > 0 && flags ? delta - Math.min(delta, repaid(flags)) : delta
      // The wallet may fire its change callback inside add(); set() makes that harmless.
      set(inv, send === 0 ? wallet.read() : wallet.add(send, WALLET_REASON))
      return send
    },
    external(inv, balance) { set(inv, balance) },
  }
}

/** localStorage key of the flags this browser has been paid for (a JSON list). */
export const PAID_KEY = 'zelda.paidBits'

/** PaidFlags kept in `store` under PAID_KEY, read fresh each time (another tab may have been paid). */
export function paidFlagStore(store: () => KV): PaidFlags {
  const memory = new Set<string>()
  const read = (): Set<string> => {
    try {
      const v = JSON.parse(store().getItem(PAID_KEY) ?? '[]') as unknown
      return new Set([...memory, ...(Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])])
    } catch {
      return new Set(memory)
    }
  }
  return {
    has: f => read().has(f),
    add(f) {
      memory.add(f)
      const all = read()
      all.add(f)
      try { store().setItem(PAID_KEY, JSON.stringify([...all])) } catch { /* private mode: this page remembers */ }
    },
  }
}

/** localStorage flag: this browser's old Neon Shrine bits went into the wallet. */
export const MIGRATED_KEY = 'zelda.bitsInWallet'

interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }

/**
 * Once per browser: the bits a save from before the wallet carries move
 * into the wallet. Returns the amount moved (0 when there was nothing to
 * move or it already happened).
 */
export function migrateSaveBits(save: SaveData | null, store: KV, wallet: WalletApi): number {
  try {
    if (store.getItem(MIGRATED_KEY)) return 0
    store.setItem(MIGRATED_KEY, String(Date.now()))
  } catch { return 0 }
  const bits = save ? Math.max(0, Math.floor(save.inv.bits || 0)) : 0
  if (bits > 0) wallet.add(bits, 'shrine-save')
  return bits
}
