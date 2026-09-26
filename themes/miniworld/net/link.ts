/**
 * The browser's end of Mini World's shared world: one WebSocket to the
 * mw-world service on Sleeper (servers/mw-world/), per `WorldLink` in
 * scene/contracts.ts and the wire format in protocol.ts.
 *
 * - Opens once it has a valid info and state, says hello with the latest
 *   of both on every (re)connect.
 * - Reconnects with backoff (1 s, 2 s, 4 s … 30 s, plus up to 30 % jitter);
 *   closes while the tab is hidden and reconnects when it shows again.
 * - `pushState` is called every frame: it sends when the state changed
 *   beyond small thresholds, at most SEND_HZ a second, and once more with
 *   the exact state after the player stops.
 * - Peers are dropped with a `{ t: 'reset' }` when the connection is lost
 *   and before a new welcome's joins.
 * - Never throws into the game: every failure ends as status 'offline'.
 */
import { PROTOCOL, SEND_HZ, packState, validFx, validInfo, validState } from './protocol.ts'
import type { ClientMsg, PeerFx, PeerInfo, PeerState } from './protocol.ts'
import type { LinkStatus, WorldLink } from '../scene/contracts'

export type PeerEvent = Parameters<Parameters<WorldLink['onPeer']>[0]>[0]

/** The parts of a browser WebSocket the link uses. */
export interface LinkSocket {
  readonly readyState: number
  send(data: string): void
  close(code?: number, reason?: string): void
  onopen: ((ev: unknown) => void) | null
  onmessage: ((ev: { data: unknown }) => void) | null
  onclose: ((ev: { code?: number }) => void) | null
  onerror: ((ev: unknown) => void) | null
}

interface Events {
  addEventListener(type: string, fn: () => void): void
  removeEventListener(type: string, fn: () => void): void
}

/** For tests; the browser's own are used when left out. */
export interface LinkDeps {
  WebSocket?: new (url: string) => LinkSocket
  doc?: (Events & { readonly hidden: boolean }) | null
  win?: Events | null
  random?: () => number
}

const OPEN = 1
const PING_MS = 20_000
const TICK_MS = 5_000
/** Nothing from the service this long: the socket is dead, start over. */
const DEAD_MS = 60_000
/** Socket open and welcomed within this, or start over. */
const CONNECT_MS = 15_000
const BACKOFF_MIN = 1_000
const BACKOFF_MAX = 30_000
const GAP_MS = 1000 / SEND_HZ
/** A small leftover change is sent this long after the last send (the player stopped). */
const SETTLE_MS = 250
const POS_EPS = 0.03
const ROT_EPS = 0.03
const SPEED_EPS = 0.05

/** Where the world service is: the local one in dev, Sleeper otherwise. */
export function worldUrl(): string {
  if (import.meta.dev) return `ws://${location.hostname}:3034/ws`
  return 'wss://sleeper.phareim.no/mw-world/ws'
}

function angleGap(a: number, b: number): number {
  const d = Math.abs(a - b) % (Math.PI * 2)
  return d > Math.PI ? Math.PI * 2 - d : d
}

function movedBeyond(a: PeerState, b: PeerState): boolean {
  return a.pl !== b.pl || a.a !== b.a
    || Math.abs(a.x - b.x) > POS_EPS || Math.abs(a.y - b.y) > POS_EPS || Math.abs(a.z - b.z) > POS_EPS
    || angleGap(a.r, b.r) > ROT_EPS || Math.abs(a.s - b.s) > SPEED_EPS
}

function sameState(a: PeerState, b: PeerState): boolean {
  return a.pl === b.pl && a.a === b.a && a.x === b.x && a.y === b.y && a.z === b.z && a.r === b.r && a.s === b.s
}

export function createWorldLink(url: string, deps: LinkDeps = {}): WorldLink {
  const WS = deps.WebSocket ?? (typeof WebSocket === 'function' ? (WebSocket as unknown as new (url: string) => LinkSocket) : null)
  const doc = deps.doc !== undefined ? deps.doc : (typeof document !== 'undefined' ? document : null)
  const win = deps.win !== undefined ? deps.win : (typeof window !== 'undefined' ? window : null)
  const random = deps.random ?? Math.random
  const now = () => Date.now()

  let status: LinkStatus = 'connecting'
  const peerHandlers = new Set<(e: PeerEvent) => void>()
  const statusHandlers = new Set<(s: LinkStatus) => void>()

  let info: PeerInfo | null = null
  let latest: PeerState | null = null
  let ws: LinkSocket | null = null
  let helloSent = false
  let online = false
  let full = false
  let sent: PeerState | null = null
  let sentAt = 0
  let sentInfo = ''
  let openedAt = 0
  let lastHeard = 0
  let lastPing = 0
  let attempt = 0
  let dirty = false
  let closed = false
  let retry: ReturnType<typeof setTimeout> | null = null
  let ticker: ReturnType<typeof setInterval> | null = null

  const setStatus = (s: LinkStatus) => {
    if (s === status) return
    status = s
    for (const h of [...statusHandlers]) { try { h(s) } catch { /* the game's problem, not the link's */ } }
  }
  const emit = (e: PeerEvent) => {
    if (e.t !== 'reset') dirty = true
    for (const h of [...peerHandlers]) { try { h(e) } catch { /* as above */ } }
  }
  const resetPeers = () => { if (dirty) { dirty = false; emit({ t: 'reset' }) } }
  const raw = (m: ClientMsg): boolean => {
    if (!ws || ws.readyState !== OPEN) return false
    try { ws.send(JSON.stringify(m)); return true } catch { return false }
  }
  const ready = () => !!info && !!latest && validInfo(info) && validState(latest)

  function connect() {
    if (closed || ws || retry || !WS || !ready() || doc?.hidden) return
    setStatus('connecting')
    let sock: LinkSocket
    try { sock = new WS(url) } catch { lost(); return }
    ws = sock
    helloSent = false; online = false; full = false
    openedAt = lastHeard = lastPing = now()
    sock.onopen = () => { if (ws === sock) { lastHeard = now(); hello() } }
    sock.onmessage = ev => { if (ws === sock) { lastHeard = now(); receive(ev.data) } }
    sock.onclose = ev => {
      if (ws !== sock) return
      if (ev?.code === 4001) attempt = 99 // the service speaks a newer protocol: a reload will fix it
      detach(); lost()
    }
    sock.onerror = () => { /* close follows */ }
    if (!ticker) ticker = setInterval(tick, TICK_MS)
  }

  function hello() {
    if (helloSent || !ready()) return
    const state = latest!
    if (raw({ t: 'hello', v: PROTOCOL, info: info!, state })) {
      helloSent = true
      sent = state; sentAt = now(); sentInfo = JSON.stringify(info)
    }
  }

  /** Forget the current socket (its late events are ignored) and close it. */
  function detach(code = 1000) {
    const s = ws
    ws = null
    helloSent = false; online = false
    if (s) {
      s.onopen = s.onmessage = s.onclose = s.onerror = null
      try { s.close(code) } catch { /* gone */ }
    }
  }

  function lost() {
    resetPeers()
    if (closed) return
    if (doc?.hidden) { setStatus('offline'); return }
    if (full) { setStatus('full'); attempt = 99 } else setStatus('offline')
    const base = Math.min(BACKOFF_MAX, BACKOFF_MIN * 2 ** Math.min(attempt, 10))
    attempt++
    clearRetry()
    retry = setTimeout(() => { retry = null; connect() }, base * (1 + 0.3 * random()))
  }

  function clearRetry() { if (retry) { clearTimeout(retry); retry = null } }

  function tick() {
    if (!ws) return
    const t = now()
    if ((!online && t - openedAt > CONNECT_MS) || t - lastHeard > DEAD_MS) { detach(); lost(); return }
    if (online && t - lastPing >= PING_MS) { lastPing = t; raw({ t: 'ping' }) }
  }

  function receive(data: unknown) {
    if (typeof data !== 'string') return
    let m: Record<string, unknown>
    try {
      const v: unknown = JSON.parse(data)
      if (!v || typeof v !== 'object') return
      m = v as Record<string, unknown>
    } catch { return }
    const id = m.id
    switch (m.t) {
      case 'welcome': {
        if (typeof id !== 'string' || !Array.isArray(m.peers)) return
        resetPeers()
        online = true; attempt = 0; lastPing = now()
        setStatus('online')
        for (const p of m.peers as Record<string, unknown>[]) {
          if (p && typeof p.id === 'string' && validInfo(p.info) && validState(p.state)) emit({ t: 'join', id: p.id, info: p.info, state: p.state })
        }
        // Anything that changed between hello and welcome.
        if (info && validInfo(info) && JSON.stringify(info) !== sentInfo) sendInfo()
        flushState(true)
        return
      }
      case 'join':
        if (typeof id === 'string' && validInfo(m.info) && validState(m.state)) emit({ t: 'join', id, info: m.info, state: m.state })
        return
      case 'info':
        if (typeof id === 'string' && validInfo(m.info)) emit({ t: 'info', id, info: m.info })
        return
      case 's':
        if (typeof id === 'string' && validState(m.state)) emit({ t: 's', id, state: m.state })
        return
      case 'fx':
        if (typeof id === 'string' && validFx(m.fx)) emit({ t: 'fx', id, fx: m.fx })
        return
      case 'leave':
        if (typeof id === 'string') emit({ t: 'leave', id })
        return
      case 'full':
        full = true
        return
    }
  }

  function sendInfo() {
    const j = JSON.stringify(info)
    if (raw({ t: 'info', info: info! })) sentInfo = j
  }

  function flushState(force: boolean) {
    if (!online || !latest || !validState(latest)) return
    if (sent && sameState(sent, latest)) return
    const t = now()
    const big = !sent || movedBeyond(sent, latest)
    if (force || (big && t - sentAt >= GAP_MS) || t - sentAt >= SETTLE_MS) {
      if (raw({ t: 's', state: latest })) { sent = latest; sentAt = t }
    }
  }

  const onVisibility = () => {
    try {
      if (closed) return
      if (doc?.hidden) {
        clearRetry()
        detach()
        resetPeers()
        setStatus('offline')
      } else {
        attempt = 0
        clearRetry()
        connect()
      }
    } catch { setStatus('offline') }
  }
  const onOnline = () => {
    try { if (!closed && !ws) { attempt = 0; clearRetry(); connect() } } catch { setStatus('offline') }
  }
  try { doc?.addEventListener('visibilitychange', onVisibility) } catch { /* no document */ }
  try { win?.addEventListener('online', onOnline) } catch { /* no window */ }
  if (!WS) status = 'offline'

  return {
    get status() { return status },
    setInfo(next) {
      try {
        if (closed) return
        info = JSON.parse(JSON.stringify(next)) as PeerInfo
        if (!ws) connect()
        else if (!helloSent) hello()
        else if (online && validInfo(info) && JSON.stringify(info) !== sentInfo) sendInfo()
      } catch { /* never into the game */ }
    },
    pushState(state) {
      try {
        if (closed || !state) return
        latest = packState(state)
        if (!ws) connect()
        else if (!helloSent) hello()
        else flushState(false)
      } catch { /* as above */ }
    },
    sendFx(fx: PeerFx) {
      try { if (online && validFx(fx)) raw({ t: 'fx', fx }) } catch { /* as above */ }
    },
    onPeer(handler) {
      peerHandlers.add(handler)
      return () => { peerHandlers.delete(handler) }
    },
    onStatus(handler) {
      statusHandlers.add(handler)
      return () => { statusHandlers.delete(handler) }
    },
    close() {
      if (closed) return
      closed = true
      clearRetry()
      if (ticker) { clearInterval(ticker); ticker = null }
      detach()
      resetPeers()
      try { doc?.removeEventListener('visibilitychange', onVisibility) } catch { /* ignore */ }
      try { win?.removeEventListener('online', onOnline) } catch { /* ignore */ }
      setStatus('offline')
      peerHandlers.clear()
      statusHandlers.clear()
    },
  }
}
