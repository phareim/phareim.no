import { ref, type Ref } from 'vue'
import { readStoredPlayer } from '~/composables/useLeaderboard'

/**
 * The site-wide wallet (2026-09-26): the bits Neon Shrine's hero picks up
 * and Mini World spends. One balance per player, kept on the server
 * (players.bits) and mirrored in localStorage `phareim.wallet` so it works
 * offline and before a player exists.
 *
 * Every change is an op with a random id. Ops wait in the local copy until
 * `POST /api/wallet` has applied them; the server applies each id once, so
 * a retry after a lost answer never pays twice. The balance shown is the
 * last server balance plus what is still pending. The wallet never creates
 * a player: without one the ops simply wait.
 *
 * Plain functions (`readWallet`, `addToWallet`, `onWalletChange`,
 * `syncWallet`) are for code outside Vue (Neon Shrine's shell); `useWallet`
 * wraps them in a ref.
 */

export const WALLET_KEY = 'phareim.wallet'
export const WALLET_MAX = 99_999
/** The server refuses bigger ops; compaction never builds one. */
const OP_MAX = 2000
/** Ops per request (the server's cap). */
const BATCH = 50
/** Unsent ops beyond this are folded into one, so a long bit-collecting session stays small. */
const COMPACT_AT = 40
const SYNC_DELAY_MS = 1200

export interface WalletOp {
  id: string
  delta: number
  reason: string
  /** Set once the op has been in a request: its id must then be kept as it is. */
  sent?: boolean
}

interface WalletData {
  /** Last balance the server answered (0 before the first answer). */
  server: number
  pending: WalletOp[]
}

const clamp = (n: number) => Math.max(0, Math.min(WALLET_MAX, Math.round(n)))

function opId(): string {
  const b = new Uint8Array(9)
  crypto.getRandomValues(b)
  return [...b].map(x => (x % 36).toString(36)).join('') + Date.now().toString(36).slice(-5)
}

function cleanReason(r: string): string {
  return r.toLowerCase().replace(/[^a-z0-9:_-]/g, '').slice(0, 24) || 'misc'
}

function parse(raw: string | null): WalletData {
  const empty: WalletData = { server: 0, pending: [] }
  if (!raw) return empty
  try {
    const d = JSON.parse(raw) as Partial<WalletData>
    const server = typeof d.server === 'number' && Number.isFinite(d.server) ? clamp(d.server) : 0
    const pending = Array.isArray(d.pending)
      ? d.pending.filter((o): o is WalletOp =>
        !!o && typeof o.id === 'string' && /^[a-z0-9]{8,24}$/.test(o.id)
        && typeof o.delta === 'number' && Number.isInteger(o.delta) && Math.abs(o.delta) <= OP_MAX
        && typeof o.reason === 'string')
      : []
    return { server, pending }
  } catch {
    return empty
  }
}

function load(): WalletData {
  try {
    return parse(localStorage.getItem(WALLET_KEY))
  } catch {
    return { server: 0, pending: [] }
  }
}

function store(d: WalletData): void {
  try {
    localStorage.setItem(WALLET_KEY, JSON.stringify(d))
  } catch {
    // storage unavailable: the balance lives in memory for this page
    memoryCopy = d
  }
}

/** Only used when localStorage throws (private mode on old Safari). */
let memoryCopy: WalletData | null = null

function current(): WalletData {
  if (memoryCopy) return memoryCopy
  return load()
}

function balanceOf(d: WalletData): number {
  return clamp(d.server + d.pending.reduce((s, o) => s + o.delta, 0))
}

/** Folds unsent ops into as few as possible (each within OP_MAX). */
function compact(pending: WalletOp[]): WalletOp[] {
  const sent = pending.filter(o => o.sent)
  const unsent = pending.filter(o => !o.sent)
  if (unsent.length <= COMPACT_AT) return pending
  let sum = unsent.reduce((s, o) => s + o.delta, 0)
  const folded: WalletOp[] = []
  while (sum !== 0) {
    const part = Math.max(-OP_MAX, Math.min(OP_MAX, sum))
    folded.push({ id: opId(), delta: part, reason: 'many' })
    sum -= part
  }
  return [...sent, ...folded]
}

// ---------------------------------------------------------------- listeners

const listeners = new Set<(bits: number) => void>()
let lastNotified = -1

function notify(): void {
  const bits = readWallet()
  if (bits === lastNotified) return
  lastNotified = bits
  for (const cb of listeners) {
    try { cb(bits) } catch { /* a listener's bug is its own */ }
  }
}

let wired = false
/** Other tabs, visibility and the first sync; once per page, client only. */
function wire(): void {
  if (wired || typeof window === 'undefined') return
  wired = true
  window.addEventListener('storage', (e) => {
    if (e.key === WALLET_KEY) notify()
  })
  document.addEventListener('visibilitychange', () => {
    void syncWallet()
  })
  void syncWallet()
}

// ---------------------------------------------------------------- plain API

/** The balance now: last server balance plus pending ops, 0..99 999. */
export function readWallet(): number {
  if (typeof window === 'undefined') return 0
  return balanceOf(current())
}

/**
 * Adds (or, with a negative delta, takes) bits and returns the new balance.
 * A take bigger than the balance takes what there is; the top is 99 999.
 * `reason` is a short tag for the server's log ("zelda:rupee", "mw:shop").
 */
export function addToWallet(delta: number, reason: string): number {
  if (typeof window === 'undefined') return 0
  wire()
  const d = current()
  const now = balanceOf(d)
  let n = Math.round(delta)
  if (!Number.isFinite(n) || n === 0) return now
  n = clamp(now + n) - now
  if (n === 0) return now
  let left = n
  while (left !== 0) {
    const part = Math.max(-OP_MAX, Math.min(OP_MAX, left))
    d.pending.push({ id: opId(), delta: part, reason: cleanReason(reason) })
    left -= part
  }
  d.pending = compact(d.pending)
  store(d)
  notify()
  scheduleSync()
  return balanceOf(d)
}

/** Calls `cb` with the balance whenever it changes, in this tab or another. Returns the unsubscribe. */
export function onWalletChange(cb: (bits: number) => void): () => void {
  wire()
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

let timer: ReturnType<typeof setTimeout> | null = null
function scheduleSync(): void {
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => { timer = null; void syncWallet() }, SYNC_DELAY_MS)
}

let inFlight: Promise<void> | null = null
let again = false

/**
 * Sends pending ops (or just asks for the balance) and takes the server's
 * answer. One request at a time; a call while one runs makes it go round
 * once more. Silent offline; skipped without a player.
 */
export function syncWallet(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (inFlight) {
    again = true
    return inFlight
  }
  inFlight = (async () => {
    try {
      do {
        again = false
        await syncOnce()
      } while (again)
    } finally {
      inFlight = null
    }
  })()
  return inFlight
}

async function syncOnce(): Promise<void> {
  const player = readStoredPlayer()
  if (!player) return
  const d = current()
  const batch = d.pending.slice(0, BATCH)
  if (batch.length) {
    for (const o of batch) o.sent = true
    store(d)
  }
  let bits: number
  try {
    const res = await fetch('/api/wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: player.id, ops: batch.map(({ id, delta, reason }) => ({ id, delta, reason })) }),
      keepalive: document.visibilityState === 'hidden',
    })
    if (!res.ok) return
    const body = await res.json() as { bits?: unknown }
    if (typeof body.bits !== 'number') return
    bits = body.bits
  } catch {
    return // offline: the ops wait for the next change or visibility
  }
  // Re-read: another tab or a new op may have changed the copy meanwhile.
  const after = current()
  const done = new Set(batch.map(o => o.id))
  after.pending = after.pending.filter(o => !done.has(o.id))
  after.server = clamp(bits)
  store(after)
  notify()
  if (after.pending.length) again = true
}

// ---------------------------------------------------------------- Vue

export interface Wallet {
  /** The balance, live (this tab and others). */
  bits: Ref<number>
  /** Adds n bits (n > 0). */
  earn(n: number, reason: string): void
  /** Takes n bits if there are enough; false (and nothing taken) when short. */
  spend(n: number, reason: string): boolean
  /** Pushes pending ops and refreshes the balance from the server. */
  sync(): Promise<void>
}

let shared: Ref<number> | null = null

export function useWallet(): Wallet {
  if (!shared) {
    shared = ref(readWallet())
    if (typeof window !== 'undefined') onWalletChange((b) => { shared!.value = b })
  }
  const bits = shared
  return {
    bits,
    earn(n, reason) {
      if (n > 0) bits.value = addToWallet(n, reason)
    },
    spend(n, reason) {
      if (!(n >= 0)) return false
      if (readWallet() < n) return false
      if (n > 0) bits.value = addToWallet(-n, reason)
      return true
    },
    sync: syncWallet,
  }
}
