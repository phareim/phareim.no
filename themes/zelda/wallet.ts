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
import { MAX_BITS, type Inventory, type SaveData } from './types'

export interface WalletApi {
  read(): number
  /** Adds `delta` (may be negative) and answers the new balance. */
  add(delta: number, reason: string): number
}

export interface BitsBridge {
  /** A new game state was created: its bits become the wallet's. */
  adopt(inv: Inventory): void
  /** After an engine step: a change in `inv.bits` goes to the wallet. Returns the delta sent (0 when none). */
  step(inv: Inventory): number
  /** The wallet moved (any cause): the hero carries the new balance. */
  external(inv: Inventory, balance: number): void
}

export const WALLET_REASON = 'shrine'

export function carried(balance: number): number {
  if (!Number.isFinite(balance)) return 0
  return Math.max(0, Math.min(MAX_BITS, Math.floor(balance)))
}

export function createBitsBridge(wallet: WalletApi): BitsBridge {
  /** What `inv.bits` held after the last sync: anything else is the engine's doing. */
  let seen = 0
  const set = (inv: Inventory, balance: number) => {
    inv.bits = carried(balance)
    seen = inv.bits
  }
  return {
    adopt(inv) { set(inv, wallet.read()) },
    step(inv) {
      const delta = inv.bits - seen
      if (delta === 0) return 0
      // The wallet may fire its change callback inside add(); set() makes that harmless.
      seen = inv.bits
      set(inv, wallet.add(delta, WALLET_REASON))
      return delta
    },
    external(inv, balance) { set(inv, balance) },
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
