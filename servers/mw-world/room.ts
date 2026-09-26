/**
 * Mini World's shared world, the room itself: who is connected, where they
 * are, and who hears what. No sockets here; server.ts feeds it text and
 * gives it something with send/close. Everything is in memory; a restart
 * empties the room and the clients reconnect by themselves.
 *
 * Who hears what:
 * - join, info and leave go to everyone.
 * - a state ('s') goes to the peers in the sender's place, and, when the
 *   sender changes place, also to the peers in the place it left (so it
 *   disappears there).
 * - when a peer changes place it gets everyone's latest state, so its view
 *   of who stands where is fresh again (states from places it was not in
 *   were not sent to it).
 * - fx go to the peers in the sender's place.
 */
import {
  MAX_MSG_BYTES, MAX_MSGS_PER_SEC, MAX_PEERS, PROTOCOL,
  validFx, validInfo, validState, packState,
} from '../../themes/miniworld/net/protocol.ts'
import type { PeerInfo, PeerState, ServerMsg } from '../../themes/miniworld/net/protocol.ts'

export interface RoomSocket {
  send(text: string): void
  close(code: number, reason: string): void
}

export interface Conn {
  readonly sock: RoomSocket
  /** Session id once the hello is accepted; null before. */
  id: string | null
  info: PeerInfo | null
  state: PeerState | null
  lastSeen: number
  openedAt: number
  winStart: number
  winCount: number
  closed: boolean
}

export interface RoomOptions {
  now?: () => number
  /** No message at all for this long drops the socket. */
  idleMs?: number
  /** A socket that has not said hello by then is dropped. */
  helloMs?: number
  maxPeers?: number
  newId?: () => string
  log?: (line: string) => void
}

export const IDLE_MS = 60_000
export const HELLO_MS = 10_000

/** Close codes the service uses (4000–4999 are free for applications). */
export const CLOSE = { idle: 4000, protocol: 4001, full: 4003 } as const

export function createRoom(opts: RoomOptions = {}) {
  const now = opts.now ?? (() => Date.now())
  const idleMs = opts.idleMs ?? IDLE_MS
  const helloMs = opts.helloMs ?? HELLO_MS
  const maxPeers = opts.maxPeers ?? MAX_PEERS
  const newId = opts.newId ?? (() => globalThis.crypto.randomUUID().replace(/-/g, '').slice(0, 10))
  const log = opts.log ?? (() => {})

  const conns = new Set<Conn>()
  /** Joined peers by session id. */
  const peers = new Map<string, Conn>()

  const send = (c: Conn, msg: ServerMsg) => {
    if (c.closed) return
    try { c.sock.send(JSON.stringify(msg)) } catch { /* the socket's close handler cleans up */ }
  }
  const drop = (c: Conn, code: number, reason: string) => {
    try { c.sock.close(code, reason) } catch { /* already gone */ }
    close(c)
  }

  function open(sock: RoomSocket): Conn {
    const t = now()
    const c: Conn = { sock, id: null, info: null, state: null, lastSeen: t, openedAt: t, winStart: t, winCount: 0, closed: false }
    conns.add(c)
    return c
  }

  /** One text frame from a socket. Invalid or over-limit messages are dropped quietly. */
  function message(c: Conn, text: string) {
    if (c.closed) return
    const t = now()
    c.lastSeen = t
    if (t - c.winStart >= 1000) { c.winStart = t; c.winCount = 0 }
    if (++c.winCount > MAX_MSGS_PER_SEC) return
    if (text.length > MAX_MSG_BYTES) return

    let m: Record<string, unknown>
    try {
      const v: unknown = JSON.parse(text)
      if (!v || typeof v !== 'object' || Array.isArray(v)) return
      m = v as Record<string, unknown>
    } catch { return }

    if (m.t === 'ping') { send(c, { t: 'pong' }); return }

    if (c.id === null) {
      if (m.t !== 'hello') return
      if (m.v !== PROTOCOL) { drop(c, CLOSE.protocol, 'protocol'); return }
      if (!validInfo(m.info) || !validState(m.state)) return
      if (peers.size >= maxPeers) {
        send(c, { t: 'full' })
        log(`full: refused a hello (${peers.size} peers)`)
        drop(c, CLOSE.full, 'full')
        return
      }
      let id = newId()
      while (peers.has(id)) id = newId()
      c.id = id
      c.info = m.info
      c.state = packState(m.state)
      send(c, { t: 'welcome', id, peers: others(c).map(p => ({ id: p.id!, info: p.info!, state: p.state! })) })
      for (const p of others(c)) send(p, { t: 'join', id, info: c.info, state: c.state })
      peers.set(id, c)
      log(`join (${peers.size} peers)`)
      return
    }

    const id = c.id
    switch (m.t) {
      case 'info': {
        if (!validInfo(m.info)) return
        c.info = m.info
        for (const p of others(c)) send(p, { t: 'info', id, info: m.info })
        return
      }
      case 's': {
        if (!validState(m.state)) return
        const from = c.state!.pl
        const state = packState(m.state)
        c.state = state
        for (const p of others(c)) {
          const pl = p.state!.pl
          if (pl === state.pl || pl === from) send(p, { t: 's', id, state })
        }
        if (from !== state.pl) {
          for (const p of others(c)) send(c, { t: 's', id: p.id!, state: p.state! })
        }
        return
      }
      case 'fx': {
        if (!validFx(m.fx)) return
        const pl = c.state!.pl
        for (const p of others(c)) if (p.state!.pl === pl) send(p, { t: 'fx', id, fx: m.fx })
        return
      }
    }
  }

  /** The socket is gone (or being dropped). Safe to call twice. */
  function close(c: Conn) {
    if (c.closed) return
    c.closed = true
    conns.delete(c)
    if (c.id !== null && peers.get(c.id) === c) {
      peers.delete(c.id)
      for (const p of peers.values()) send(p, { t: 'leave', id: c.id })
      log(`leave (${peers.size} peers)`)
    }
  }

  /** Drops sockets that went quiet, and ones that never said hello. Call every few seconds. */
  function sweep() {
    const t = now()
    for (const c of [...conns]) {
      if (c.id === null && t - c.openedAt > helloMs) drop(c, CLOSE.idle, 'no hello')
      else if (t - c.lastSeen > idleMs) drop(c, CLOSE.idle, 'idle')
    }
  }

  function others(c: Conn): Conn[] {
    const out: Conn[] = []
    for (const p of peers.values()) if (p !== c) out.push(p)
    return out
  }

  return {
    open, message, close, sweep,
    /** Joined peers. */
    get peers() { return peers.size },
    /** Open sockets, joined or not. */
    get sockets() { return conns.size },
  }
}

export type Room = ReturnType<typeof createRoom>
