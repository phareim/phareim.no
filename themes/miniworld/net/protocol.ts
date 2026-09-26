/**
 * Mini World's shared world (2026-09-26): everyone who plays walks in the
 * same town and sees each other live. A small service on Sleeper
 * (`servers/mw-world/`, PM2 `mw-world`, `wss://sleeper.phareim.no/mw-world/ws`)
 * relays who is where; it keeps nothing on disk. This file is the wire
 * format, shared by the browser (net/client.ts) and the service (Node runs
 * it as TypeScript directly), so it must stay plain: no imports with
 * aliases, no enums, only erasable type syntax.
 *
 * Messages are JSON arrays or objects kept small; positions are rounded to
 * centimetres. A client sends its state at most `SEND_HZ` times a second
 * while it moves, and once when it stops.
 */

export const PROTOCOL = 1
export const SEND_HZ = 10
/** Everyone in one world; the service refuses more. */
export const MAX_PEERS = 40
/** Per socket: messages over this rate in a second are dropped. */
export const MAX_MSGS_PER_SEC = 30
/** Largest message the service accepts, in bytes. */
export const MAX_MSG_BYTES = 4096

/**
 * Where a peer is. Only peers in the same place are drawn:
 * 'town', 'house:<ownerPublicId>' (your own house or a visit),
 * 'obby:easy|medium|hard', 'stars', 'catwalk:<publicId>' (private).
 */
export type PlaceKey = string

/** What others need to draw you; sent on join and whenever it changes. */
export interface PeerInfo {
  /** Public player id (never the private one), or '' before the profile answers. */
  pub: string
  /** The active person's name (1–12 letters). */
  name: string
  title: 'king' | 'queen' | 'prince' | 'princess' | null
  /** PersonLook as the game defines it; the service checks only its shape and size. */
  look: unknown
  /** Weapon in hand: { base, magic, color, level } or null. */
  held: unknown
}

/** Pose names the avatar understands (AvatarPose in scene/contracts.ts). */
export const POSES = ['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'sleep', 'wave', 'swing', 'dance', 'cheer'] as const
export type NetPose = (typeof POSES)[number]

/** One peer's motion: place, position (x, y, z), facing (radians), pose, walk speed 0..1. */
export interface PeerState {
  pl: PlaceKey
  x: number
  y: number
  z: number
  r: number
  a: NetPose
  s: number
}

/** Short things others should see happen. */
export type PeerFx =
  | { k: 'magic'; magic: string; level: number; dx: number; dy: number; dz: number }
  | { k: 'emote'; e: 'wave' | 'dance' | 'cheer' | 'heart' }

// ---------------------------------------------------------------- client → service

export type ClientMsg =
  | { t: 'hello'; v: typeof PROTOCOL; info: PeerInfo; state: PeerState }
  | { t: 'info'; info: PeerInfo }
  | { t: 's'; state: PeerState }
  | { t: 'fx'; fx: PeerFx }
  | { t: 'ping' }

// ---------------------------------------------------------------- service → client

export type ServerMsg =
  /** After hello: your session id and everyone already here. */
  | { t: 'welcome'; id: string; peers: { id: string; info: PeerInfo; state: PeerState }[] }
  | { t: 'join'; id: string; info: PeerInfo; state: PeerState }
  | { t: 'info'; id: string; info: PeerInfo }
  | { t: 's'; id: string; state: PeerState }
  | { t: 'fx'; id: string; fx: PeerFx }
  | { t: 'leave'; id: string }
  | { t: 'full' }
  | { t: 'pong' }

// ---------------------------------------------------------------- validation (both sides)

const NAME_RE = /^[A-Za-zÆØÅæøåÉÈÄÖÜéèäöü \-]{1,12}$/
const PUB_RE = /^[A-Za-z0-9_-]{0,32}$/
const PLACE_RE = /^(town|stars|obby:(easy|medium|hard)|house:[A-Za-z0-9_-]{1,32}|catwalk:[A-Za-z0-9_-]{1,32})$/
const TITLES = new Set(['king', 'queen', 'prince', 'princess'])
const FX_MAGIC_RE = /^[a-z]{2,12}$/
const EMOTES = new Set(['wave', 'dance', 'cheer', 'heart'])

const finite = (n: unknown, lim: number): n is number => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= lim

export function validInfo(v: unknown): v is PeerInfo {
  if (!v || typeof v !== 'object') return false
  const i = v as Record<string, unknown>
  if (typeof i.pub !== 'string' || !PUB_RE.test(i.pub)) return false
  if (typeof i.name !== 'string' || !NAME_RE.test(i.name)) return false
  if (i.title !== null && !(typeof i.title === 'string' && TITLES.has(i.title))) return false
  if (!i.look || typeof i.look !== 'object' || Array.isArray(i.look)) return false
  if (i.held !== null && (typeof i.held !== 'object' || Array.isArray(i.held))) return false
  return JSON.stringify(v).length <= 2048
}

export function validState(v: unknown): v is PeerState {
  if (!v || typeof v !== 'object') return false
  const s = v as Record<string, unknown>
  return typeof s.pl === 'string' && PLACE_RE.test(s.pl)
    && finite(s.x, 1000) && finite(s.y, 1000) && finite(s.z, 1000) && finite(s.r, 100)
    && typeof s.a === 'string' && (POSES as readonly string[]).includes(s.a)
    && finite(s.s, 1) && (s.s as number) >= 0
}

export function validFx(v: unknown): v is PeerFx {
  if (!v || typeof v !== 'object') return false
  const f = v as Record<string, unknown>
  if (f.k === 'emote') return typeof f.e === 'string' && EMOTES.has(f.e)
  if (f.k === 'magic') {
    return typeof f.magic === 'string' && FX_MAGIC_RE.test(f.magic) && finite(f.level, 3) && (f.level as number) >= 1
      && finite(f.dx, 1.01) && finite(f.dy, 1.01) && finite(f.dz, 1.01)
  }
  return false
}

/** Rounds a state for the wire (centimetres, milliradians). */
export function packState(s: PeerState): PeerState {
  const r2 = (n: number) => Math.round(n * 100) / 100
  return { pl: s.pl, x: r2(s.x), y: r2(s.y), z: r2(s.z), r: Math.round(s.r * 1000) / 1000, a: s.a, s: r2(s.s) }
}
