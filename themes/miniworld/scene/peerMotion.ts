/**
 * The shared world's motion rules (2026-09-26), pure so node can test them
 * (tests/miniworld-peers.test.mjs). peers.ts draws with them.
 *
 * A peer's states arrive about ten times a second. Each peer keeps a short
 * buffer of them stamped with their arrival time, and is drawn `DELAY_MS`
 * behind now: position interpolated between the two states around that
 * moment, facing along the shortest arc. Past the newest state a walking
 * peer is carried on at their last velocity for at most `MAX_EXTRAP_MS`,
 * then held. A jump of more than `SNAP_DIST` units (a teleport, a respawn)
 * or a new place empties the buffer, so they appear at once where they are.
 */
import type { Place } from './contracts'
import type { PeerState } from '../net/protocol'

export const DELAY_MS = 120
export const MAX_EXTRAP_MS = 250
export const SNAP_DIST = 6
export const BUFFER_MAX = 12
/** A silence longer than this (they stood still) restarts the timeline, so the next step is not smeared over the whole pause. */
export const GAP_MS = 500

const TAU = Math.PI * 2
const MOVING = new Set(['walk', 'run'])

/** The signed turn from `from` to `to`, in (-π, π]. */
export function angleDelta(from: number, to: number): number {
  let d = (to - from) % TAU
  if (d > Math.PI) d -= TAU
  else if (d <= -Math.PI) d += TAU
  return d
}

export function lerpAngle(a: number, b: number, k: number): number {
  return a + angleDelta(a, b) * k
}

export interface Snap { t: number; x: number; y: number; z: number; r: number; a: string; s: number; pl: string }

export interface MotionSample {
  x: number; y: number; z: number; r: number
  /** Pose and walk speed 0..1. */
  a: string; s: number
  pl: string
  /** Bumped on every snap: a renderer that smooths should jump instead when it changes. */
  epoch: number
}

export function emptySample(): MotionSample {
  return { x: 0, y: 0, z: 0, r: 0, a: 'idle', s: 0, pl: '', epoch: 0 }
}

/** One peer's buffered motion. No allocation after the first `BUFFER_MAX` pushes. */
export class Motion {
  private buf: Snap[] = []
  private n = 0
  /** The state just before buf[0] (for the velocity past the newest), valid until a snap. */
  private prev: Snap = blank()
  private hasPrev = false
  epoch = 0

  get count(): number { return this.n }
  /** The newest state, or null. */
  get last(): Readonly<Snap> | null { return this.n ? this.buf[this.n - 1]! : null }

  clear(): void { this.n = 0; this.hasPrev = false; this.epoch++ }

  push(st: PeerState, at: number): void {
    const last = this.n ? this.buf[this.n - 1]! : null
    if (last) {
      const dx = st.x - last.x, dy = st.y - last.y, dz = st.z - last.z
      if (st.pl !== last.pl || dx * dx + dy * dy + dz * dz > SNAP_DIST * SNAP_DIST) {
        this.clear()
      } else if (at <= last.t) {
        at = last.t + 1
      } else if (at - last.t > GAP_MS) {
        // After a pause, pretend the last state came one send interval ago.
        last.t = at - 100
      }
    }
    if (this.n === BUFFER_MAX) this.dropFirst()
    let s = this.buf[this.n]
    if (!s) { s = blank(); this.buf[this.n] = s }
    s.t = at; s.x = st.x; s.y = st.y; s.z = st.z; s.r = st.r; s.a = st.a; s.s = st.s; s.pl = st.pl
    this.n++
  }

  /** Where to draw the peer at `now` (ms). False while nothing has arrived. */
  sample(now: number, out: MotionSample): boolean {
    if (!this.n) return false
    const rt = now - DELAY_MS
    // Drop states wholly behind the render time (keep the one just before it).
    while (this.n >= 2 && this.buf[1]!.t <= rt) this.dropFirst()
    const a = this.buf[0]!
    out.epoch = this.epoch
    if (rt <= a.t) { copy(out, a); return true }
    if (this.n >= 2) {
      const b = this.buf[1]!
      const k = (rt - a.t) / (b.t - a.t)
      out.x = a.x + (b.x - a.x) * k
      out.y = a.y + (b.y - a.y) * k
      out.z = a.z + (b.z - a.z) * k
      out.r = lerpAngle(a.r, b.r, k)
      out.s = a.s + (b.s - a.s) * k
      out.a = k < 0.5 ? a.a : b.a
      out.pl = b.pl
      return true
    }
    extrapolate(this.hasPrev ? this.prev : null, a, rt, out)
    return true
  }

  private dropFirst() {
    const first = this.buf.shift()!
    Object.assign(this.prev, first)
    this.hasPrev = true
    this.buf.push(first)
    this.n--
  }
}

function blank(): Snap { return { t: 0, x: 0, y: 0, z: 0, r: 0, a: 'idle', s: 0, pl: '' } }

/**
 * Past the newest state: carries a walking peer on along the last two
 * states' velocity, for at most `MAX_EXTRAP_MS`, in x and z only (y holds,
 * so nobody sinks into a floor). A standing peer just holds.
 */
export function extrapolate(prev: Readonly<Snap> | null, last: Readonly<Snap>, rt: number, out: MotionSample): void {
  copy(out, last)
  if (!prev || prev.pl !== last.pl || last.s <= 0.05 || !MOVING.has(last.a)) return
  const span = last.t - prev.t
  if (span <= 0 || span > GAP_MS) return
  const e = Math.min(rt - last.t, MAX_EXTRAP_MS)
  if (e <= 0) return
  const k = e / span
  out.x = last.x + (last.x - prev.x) * k
  out.z = last.z + (last.z - prev.z) * k
}

function copy(out: MotionSample, s: Readonly<Snap>) {
  out.x = s.x; out.y = s.y; out.z = s.z; out.r = s.r; out.a = s.a; out.s = s.s; out.pl = s.pl
}

// ---------------------------------------------------------------- place keys

const ID_OK = /^[A-Za-z0-9_-]{1,32}$/

/** A private token for keys that must not be shared before your public id is known. */
export function localToken(rand: () => number = Math.random): string {
  let s = 'l'
  for (let i = 0; i < 15; i++) s += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rand() * 36)]
  return s
}

/** Your place key on the wire (net/protocol.ts `PlaceKey`). */
export function placeKey(place: Place, selfPub: string, token: string): string {
  const me = ID_OK.test(selfPub) ? selfPub : token
  switch (place.kind) {
    case 'town': return 'town'
    case 'house': return `house:${me}`
    case 'visit': return `house:${ID_OK.test(place.playerId) ? place.playerId : token}`
    case 'obby': return `obby:${place.level}`
    case 'stars': return 'stars'
    case 'catwalk': return `catwalk:${me}`
  }
}
