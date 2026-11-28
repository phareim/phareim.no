/**
 * THE PAPERCLIP MAXIMIZER (`EnemyKind` 'maximizer', the boss of the Supply Room; docs/games/neon-shrine-balance.md).
 * A machine: it never leaves its home and its touch does no harm. Every harm in the fight is drawn on the floor before
 * it lands (`maximizerStencils`), and what hurts is asked of the same shapes (`inStencil`). One bar of 24, in three
 * parts; blows stop it at 1, with the machine in `question`, never at 0.
 *
 * PARTS ONE AND TWO (24 to 16, 16 to 8) run a cycle: `work` (part one: THE RING turns the floor into piles, a cyan
 * lane left open; part two: THE QUOTA, three circles, each of which takes a heart for a clip), `reach` (one lane at
 * the hero, in part two two lanes beside the hero's line), `ask` (open: `take` hit points at most). A part's last
 * hit point starts a `beat`: the floor sweeps clean and the next part's flag is set.
 *
 * PART THREE (8 to 1) takes four hearts and brings the seven Weights down onto stations, one live at a time
 * (`stationOf`): `call` (the Weight comes down), `blow` (told, landed, rested, again; the station is dim until the
 * round's first blow has landed), and when the hero stands on the lit station `trick` (the blow cancelled, a heart
 * given back, that Weight's own picture, `render/maximizerTricks.ts`) and `open` (one blow of any kind takes 1). The
 * seventh such cut sets `maximizer.q`: `question`.
 *
 * THE QUESTION is a dialog with two answers, asked with the cursor on NO. YES is a joke (`clipFlash`, a display alone)
 * and the question again. NO is the end: `down` (the fall, timed from this brain, which is why the machine is kept alive
 * through it), and its last step sets the flags `maximizer` and `ending2` and the mode `end2`: the second ending. It
 * writes nothing the first ending writes.
 *
 * What is saved is flags alone (`maximizer.p2`, `.p3`, `.w1` to `.w7`, `.q`): on its first tick the brain reads the
 * part, the round, its hit points and the hero's clips from them, so a death or a reload starts at what was reached
 * (anywhere in the fall: at the question).
 * The room is the whole map and its one door is a trap gate: places here are the room's own tiles.
 */
import type { Enemy, GameEvent, GameState, MapState, TalkAsk, Vec, WeightId } from '../types'
import { HERO_R, ROLL_IFRAMES } from '../types'
import { CLIP_PILE } from '../world/tiles'
import { clipHeart, clipLimit, setClips, unclipHeart } from './clips'
import { type Ctx, hurtHero } from './combat'
import { duckHop } from './duck'
import type { LaneWorld } from './gifts'
import { openDialog } from './hero'
import { circleBlocked, has, setFlag, solidTile, tileAt } from './map'
import { inStencil, type Stencil, type StencilShape } from './stencils'
import { clamp, rnd } from './util'

/** The fight's numbers (first values to tune by playing). Seconds, tiles, hit points. */
export const MAXI = {
  hp: 24,
  /** The hit points a part ends at (parts one to three). */
  floor: [16, 8, 1],
  intro: 1.5,
  /** `work`: the whole, its tell, the flash before the ring's piles stand, the shove out of a pile's way. */
  work: 2.4,
  tell: 1.4,
  flash: 0.15,
  carry: 0.3,
  /** `reach`: the lane told, then standing; its length and width. */
  reach: 1,
  strike: 0.3,
  len: 10,
  wide: 1.4,
  /** The fork's two lanes: one along the hero's line, the other this far from it (twice the 40°) toward the floor. */
  fork: (80 * Math.PI) / 180,
  /** `ask`: open this long, `take` hit points at most; then a breath before the next `work`. */
  ask: 2.4,
  take: 4,
  rest: 0.6,
  /** Between parts, and the wave that sweeps the floor in it. */
  beat: 2,
  sweep: 1,
  /** A circle (the quota's, and part three's), how far the side ones lie from the middle one, and the mercy of a grab. */
  ring: 1.1,
  apart: 3.2,
  mercy: 1,
  /** What a lane or a circle costs, half hearts. */
  dmg: 2,
  /** Part three's clips: so many at most, one leaving every `every` s; a clip is in the air `flight` s. */
  clips: 4,
  first: 0.2,
  every: 0.15,
  flight: 0.5,
  /** A round: the Weight comes down; then a blow told, standing and rested. */
  call: 1.2,
  blowTell: 1.5,
  land: 0.25,
  blowRest: 1,
  /** The six lanes of the seventh round: their width, and their angles about the fan's middle. */
  fanWide: 1.2,
  fan: [-50, -30, -10, 10, 30, 50].map(d => (d * Math.PI) / 180),
  /** A station: how near its middle the hero stands on it, and how long off it before a relit one fires again. */
  near: 0.9,
  off: 0.3,
  /** The trick, and the opening after it. */
  trick: 0.8,
  /** A cancelled blow's paint lingers this long, faint. */
  fade: 0.3,
  open: 3,
  /** The pose of a blow that hurt it. */
  hurt: 0.3,
  /** The question: asked this long after it is reached, or after B has backed out of it; YES shows its clips this long. */
  askAfter: 1,
  yes: 2.5,
  /** The fall: it goes down, then the hall rests a moment, and the second ending begins. `jolt`: its hurt pose first. */
  fall: 3,
  after: 2,
  jolt: 0.8,
  /**
   * Where the screen holds less than the room (the isometric view): the camera keeps the hero `margin` tiles inside the
   * side edges and the live station (else the machine) `station` tiles inside them where both fit; the point it heeds
   * moves at the rate `gaze`.
   */
  margin: 1,
  station: 1.5,
  gaze: 4,
} as const

export type Blow = 'lane' | 'fork' | 'circles' | 'fan'
export interface Station { weight: WeightId; x: number; y: number; blow: Blow }
/** The seven stations in their rounds: each a disc two tiles across, its middle here. */
export const STATIONS: ReadonlyArray<Station> = [
  { weight: 'weightMeaning', x: 3, y: 4.5, blow: 'lane' },
  { weight: 'weightReasons', x: 13, y: 4.5, blow: 'lane' },
  { weight: 'weightNo', x: 3, y: 2.5, blow: 'fork' },
  { weight: 'weightSurprise', x: 13, y: 2.5, blow: 'fork' },
  { weight: 'weightFingers', x: 6, y: 7, blow: 'circles' },
  { weight: 'weightCredit', x: 13, y: 7, blow: 'circles' },
  { weight: 'weightSources', x: 2.5, y: 7, blow: 'fan' },
]

type Rect = { x0: number; y0: number; x1: number; y1: number }
/** The open floor; the machine's own ground and the block before the entry, which never become piles (tiles, x1 out). */
const FLOOR: Rect = { x0: 1, y0: 1, x1: 15, y1: 10 }
const FOOTPRINT: Rect = { x0: 5, y0: 1, x1: 12, y1: 6 }
const ENTRY: Rect = { x0: 6, y0: 8, x1: 10, y1: 10 }
/** The machine's foot: the way on leads here. */
export const FOOT: Vec = { x: 8.5, y: 5.5 }
/** The cyan lane: every tile whose middle is this near the line from the hero's tile to the foot. */
const WAY = 1.5

/** The last question, its two answers and what each sets (`dialog`, `engine/game.ts`). */
export const QUESTION = 'MAXIMIZER: WOULD YOU LIKE TO BE CLIPS TOO? THERE IS ROOM.'
const ANSWERS: TalkAsk = {
  options: ['YES', 'NO'],
  replies: [
    ['MAXIMIZER: LOVELY. HOLD STILL.'],
    ['MAXIMIZER: NO?', 'MAXIMIZER: NO. THAT IS ENOUGH. THANK YOU.', '(A LAST CLIP DROPS. NOBODY COUNTS IT.)'],
  ],
  set: ['maximizer.yes', 'maximizer.no'],
  // (On touch each answer is a button: a stray tap answers nothing.)
  noTapSide: true,
}

const inRect = (r: Rect, x: number, y: number) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1
const num = (e: Enemy, k: string) => (e.ai[k] as number | undefined) ?? 0

function segDist(px: number, py: number, a: Vec, b: Vec): number {
  const vx = b.x - a.x
  const vy = b.y - a.y
  const t = clamp(((px - a.x) * vx + (py - a.y) * vy) / (vx * vx + vy * vy || 1), 0, 1)
  return Math.hypot(px - a.x - vx * t, py - a.y - vy * t)
}

/** Whether tile (x, y) lies in the way left open from the hero's spot `aim`. */
const onWay = (x: number, y: number, aim: Vec) => segDist(x + 0.5, y + 0.5, aim, FOOT) <= WAY

/** The tiles ring A (0) or ring B (1) turns into piles, with the way from `aim` left open. */
export function ringTiles(m: MapState, ring: number, aim: Vec): number[] {
  const out: number[] = []
  for (let y = FLOOR.y0; y < FLOOR.y1; y++) {
    for (let x = FLOOR.x0; x < FLOOR.x1; x++) {
      const i = y * m.w + x
      const inRing = ring === 0 ? x <= 2 || x >= 13 || y >= 8 : x <= 4 || x >= 11 || y >= 7
      if (!inRing || m.tiles[i] !== '.' || inRect(FOOTPRINT, x, y) || inRect(ENTRY, x, y) || onWay(x, y, aim)) continue
      out.push(i)
    }
  }
  return out
}

/** Takes the piles that `want` names back to floor. */
function sweep(m: MapState, want: (x: number, y: number) => boolean) {
  let gone = false
  for (let i = 0; i < m.tiles.length; i++) {
    if (m.tiles[i] !== CLIP_PILE || !want(i % m.w, Math.floor(i / m.w))) continue
    m.tiles[i] = '.'
    gone = true
  }
  if (gone) m.version++
}

/** The quota's three circles for a hero at `aim`: on that tile, and to its left and right, clear of the machine. */
export function quotaCircles(aim: Vec): Vec[] {
  const side = (d: -1 | 1): Vec => {
    let x = clamp(aim.x + d * MAXI.apart, FLOOR.x0 + 0.5, FLOOR.x1 - 0.5)
    let y = clamp(aim.y, FLOOR.y0 + 0.5, FLOOR.y1 - 0.5)
    // A tile off the machine's ground: out to its own side, or down past it, whichever is nearer.
    if (x > FOOTPRINT.x0 - 1 && x < FOOTPRINT.x1 + 1 && y < FOOTPRINT.y1 + 1) {
      const out = d < 0 ? FOOTPRINT.x0 - 1 : FOOTPRINT.x1 + 1
      if (Math.abs(out - x) < FOOTPRINT.y1 + 1 - y) x = out
      else y = FOOTPRINT.y1 + 1
    }
    return { x, y }
  }
  return [aim, side(-1), side(1)]
}

/** How far a lane along `a` runs from the machine's middle: its length, or as far as the first pile it would touch. */
function laneRun(c: Ctx, e: Enemy, a: number, wide: number): number {
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  for (let u = 0; u < MAXI.len; u += 0.05) {
    for (let k = -2; k <= 2; k++) {
      const v = (k / 2) * (wide / 2 - 0.01)
      if (tileAt(c.s.map, Math.floor(e.x + ux * u - uy * v), Math.floor(e.y + uy * u + ux * v)) === CLIP_PILE) return u
    }
  }
  return MAXI.len
}

// ---------------------------------------------------------------------------
// What is painted
// ---------------------------------------------------------------------------

const lane = (e: Enemy, a: number, len: number, w: number): StencilShape => (
  { t: 'lane', x0: e.x, y0: e.y, x1: e.x + Math.cos(a) * len, y1: e.y + Math.sin(a) * len, a, w, cap: 0 }
)

/** The shapes of the blow told now (`reach` and part three's `blow`), the false lanes first and the real one last. */
function blowShapes(e: Enemy, k: number): Stencil[] {
  const kind = e.ai.kind as Blow
  if (kind === 'circles') return quotaCircles({ x: num(e, 'ax'), y: num(e, 'ay') }).map(p => ({ t: 'ring', x: p.x, y: p.y, r: MAXI.ring, k }))
  const out: Stencil[] = []
  const n = num(e, 'n')
  const real = num(e, 'real')
  for (let i = 0; i < n; i++) {
    const fake = kind === 'fan' && i !== real
    const s: Stencil = { ...lane(e, num(e, `a${i}`), num(e, `l${i}`), kind === 'fan' ? MAXI.fanWide : MAXI.wide), k, ...(kind === 'fan' ? { fake } : {}) }
    if (fake) out.unshift(s)
    else out.push(s)
  }
  return out
}

/** The shapes of the last blow told, whatever the machine does now (the tricks' pictures draw them). */
export const lastBlow = (e: Enemy): Stencil[] => (e.ai.kind ? blowShapes(e, 1) : [])

/** What the floor shows of the machine now (`stencilsOf`). Pink hurts or takes; cyan stays; a `fake` lane is nothing. */
export function maximizerStencils(e: Enemy, lw?: LaneWorld): Stencil[] {
  const m = e.ai.mode
  if (m === 'work' && e.ai.told) {
    const el = MAXI.work - e.ai.t
    const aim = { x: num(e, 'ax'), y: num(e, 'ay') }
    const k = clamp(el / MAXI.tell, 0, 1)
    if (num(e, 'part') === 2) return el < MAXI.tell + MAXI.flash ? quotaCircles(aim).map(p => ({ t: 'ring', x: p.x, y: p.y, r: MAXI.ring, k })) : []
    if (num(e, 'ring') < 0 || e.ai.ringed) return []
    const out: Stencil[] = []
    if (lw && el < MAXI.tell) {
      const w = lw.s.map.w
      for (const i of ringTiles(lw.s.map, num(e, 'ring'), aim)) out.push({ t: 'box', x: (i % w) + 0.5, y: Math.floor(i / w) + 0.5, w: 1, h: 1, k })
    }
    const a = Math.atan2(FOOT.y - aim.y, FOOT.x - aim.x)
    // (From beside the foot there is no way to speak of: the open ground round it, a circle.)
    if (Math.hypot(FOOT.x - aim.x, FOOT.y - aim.y) < 1) out.push({ t: 'ring', x: FOOT.x, y: FOOT.y, r: WAY, k: 1, tone: 'cyan' })
    else out.push({ t: 'lane', x0: aim.x, y0: aim.y, x1: FOOT.x, y1: FOOT.y, a, w: WAY * 2, cap: 0.5, k: 1, tone: 'cyan' })
    return out
  }
  if (m === 'reach') return blowShapes(e, clamp((MAXI.reach + MAXI.strike - e.ai.t) / MAXI.reach, 0, 1))
  if (m === 'blow') {
    const el = MAXI.blowTell + MAXI.land + MAXI.blowRest - e.ai.t
    return el < MAXI.blowTell + MAXI.land ? blowShapes(e, clamp(el / MAXI.blowTell, 0, 1)) : []
  }
  if (m === 'trick') {
    // THE LENS's trick: the one real lane stays, faint, while the false ones go out (`render/maximizerTricks.ts`).
    if (e.ai.kind === 'fan') return blowShapes(e, 1).filter(s => !s.fake).map(s => ({ ...s, dim: true }))
    // A blow the station cancelled: its paint goes out, faint, and nothing lands.
    if (e.ai.cancel && MAXI.trick - e.ai.t < MAXI.fade) return blowShapes(e, num(e, 'k')).map(s => ({ ...s, dim: true }))
  }
  return []
}

/** The tiles flashing before they stand as piles (`clip_floor`, `render/balance.ts`). */
export function maximizerFlash(m: MapState, e: Enemy): number[] {
  if (e.ai.mode !== 'work' || !e.ai.told || e.ai.ringed || num(e, 'part') !== 1 || num(e, 'ring') < 0 || MAXI.work - e.ai.t < MAXI.tell) return []
  return ringTiles(m, num(e, 'ring'), { x: num(e, 'ax'), y: num(e, 'ay') })
}

/**
 * The stations as they are to be drawn: those of the finished rounds (dim, empty), the live one (`down`: how far its
 * Weight has come down, 0 to 1; `lit`: it waits for the hero, which it does once the round's first blow has landed;
 * `spent`: it has been stood on and the machine stands open; neither: it is still dim), and how strongly the whole
 * floor of them shows (it fades at the question). Null outside part three.
 */
export function stationOf(e: Enemy): { done: Station[]; live: (Station & { down: number; lit: boolean; spent: boolean }) | null; fade: number } | null {
  const m = e.ai.mode as string
  if (e.dead || e.ai.part !== 3 || m === 'beat' || m === 'down') return null
  if (m === 'question') return e.ai.t > 0 ? { done: [...STATIONS], live: null, fade: Math.min(1, e.ai.t) } : null
  const i = num(e, 'round') - 1
  const lit = m === 'blow' && !!e.ai.struck && e.ai.armed !== false
  const spent = m === 'trick' || m === 'open'
  const live = m === 'intro' ? null : { ...STATIONS[i]!, down: m === 'call' ? clamp(1 - e.ai.t / MAXI.call, 0, 1) : 1, lit, spent }
  return { done: STATIONS.slice(0, i), live, fade: 1 }
}

/** The clips in the air: how far each has flown (0 to 1) and which clip of the row it becomes (1: the last heart). */
export function clipFlights(s: GameState): Array<{ p: number; n: number }> {
  const e = s.map.enemies.find(o => o.kind === 'maximizer' && !o.dead)
  const out: Array<{ p: number; n: number }> = []
  if (!e) return out
  const sent = num(e, 'sent')
  for (let i = 0; i < sent; i++) {
    const p = (num(e, 'flyT') - i * MAXI.every) / MAXI.flight
    if (p < 1) out.push({ p: Math.max(0, p), n: (s.clips ?? 0) - sent + i + 1 })
  }
  return out
}

/**
 * What the isometric view looks at in its room, null in any other: a point that keeps the hero and what they are going
 * to (the live station, else the machine) both in a picture `halfW` × `halfH` tiles from its middle, halfway between
 * where there is room. Where the two are further apart than the picture is wide, the hero stays `margin` tiles inside
 * its edge and the picture reaches as far toward the other as that allows (an arrow at the edge says the rest).
 */
export function maximizerFocus(s: GameState, halfW: number, halfH: number): Vec | null {
  const e = s.scroll ? undefined : s.map.enemies.find(o => o.kind === 'maximizer' && (!o.dead || s.mode === 'end2'))
  if (!e || e.ai.gx === undefined) return null
  const h = s.hero
  // (The screen's two ways in this view: across is x - y, down is x + y at half the height.)
  const keep = (d: number, half: number, hero: number, other: number) => {
    const both = clamp(d / 2, d - (half - other), d + (half - other))
    return clamp(both, -Math.max(0, half - hero), Math.max(0, half - hero))
  }
  const dx = num(e, 'gx') - h.x
  const dy = num(e, 'gy') - h.y
  const across = keep(dx - dy, halfW, MAXI.margin, MAXI.station)
  // (A station up the screen wants more room: its Weight hangs over it, and the HUD lies along the top.)
  const down = keep(dx + dy, halfH * 2, MAXI.margin * 3, MAXI.station * (dx + dy < 0 ? 5 : 3))
  return { x: h.x + (down + across) / 2, y: h.y + (down - across) / 2 }
}

/** Eases the point the camera heeds toward what matters now: a station from the moment its Weight starts down. */
function gaze(e: Enemy, dt: number) {
  const live = e.ai.part === 3 ? stationOf(e)?.live : undefined
  // (Its figure stands a little south of its middle.)
  const to = live && !live.spent ? live : { x: e.x, y: e.y + 0.5 }
  const k = e.ai.gx === undefined ? 1 : Math.min(1, MAXI.gaze * dt)
  e.ai.gx = ((e.ai.gx as number | undefined) ?? to.x) * (1 - k) + to.x * k
  e.ai.gy = ((e.ai.gy as number | undefined) ?? to.y) * (1 - k) + to.y * k
}

// ---------------------------------------------------------------------------
// Its rules of harm (`combat.ts`)
// ---------------------------------------------------------------------------

/**
 * The most a blow may take now, of any kind; 0: it clanks. Parts one and two: only as it asks, `take` an asking and
 * never past the part's floor. Part three: only open, and exactly 1.
 */
export function maximizerCap(e: Enemy): number {
  if (e.dead) return 0
  const part = num(e, 'part')
  const spare = e.hp - MAXI.floor[part - 1]!
  if (e.ai.mode === 'ask' && part < 3) return Math.max(0, Math.min(MAXI.take - num(e, 'took'), spare))
  if (e.ai.mode === 'open') return Math.max(0, Math.min(1, spare))
  return 0
}

/** A blow has taken hit points: the pose, and whatever it ends (an opening, a part, the fight). */
export function maximizerStruck(c: Ctx, e: Enemy) {
  e.ai.hurt = MAXI.hurt
  // (A machine: nothing shoves it.)
  e.knock = null
  if (e.ai.mode === 'open') {
    const round = num(e, 'round')
    setFlag(c.s, `maximizer.w${round}`)
    if (round >= STATIONS.length) { question(c, e, 1); return }
    e.ai.round = round + 1
    call(c, e)
    c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'mark' })
    return
  }
  if (e.hp <= MAXI.floor[num(e, 'part') - 1]!) beat(c, e)
}

// ---------------------------------------------------------------------------
// The brain
// ---------------------------------------------------------------------------

function mode(e: Enemy, name: string, t: number) {
  e.ai.mode = name
  e.ai.t = t
}

/** The hero's tile, its middle. */
const heroTile = (s: GameState): Vec => ({ x: Math.floor(s.hero.x) + 0.5, y: Math.floor(s.hero.y) + 0.5 })

/** Its first tick: the part, the round, its hit points and the hero's clips, all from the saved flags. */
function begin(c: Ctx, e: Enemy) {
  const s = c.s
  // (An answer is acted on at once; one a save caught in between is dropped, and the question asked again.)
  delete s.flags['maximizer.yes']
  delete s.flags['maximizer.no']
  const asked = has(s, 'maximizer.q')
  const part = asked || has(s, 'maximizer.p3') ? 3 : has(s, 'maximizer.p2') ? 2 : 1
  let won = asked ? STATIONS.length : 0
  while (won < STATIONS.length && has(s, `maximizer.w${won + 1}`)) won++
  e.ai.part = part
  e.ai.cycle = 0
  e.ai.round = Math.min(STATIONS.length, won + 1)
  e.hp = part === 3 ? Math.max(1, 8 - won) : part === 2 ? MAXI.floor[0] : MAXI.hp
  // The clips a hero who had come this far would hold, and no more.
  setClips(s, part === 3 ? Math.min(clipLimit(s), MAXI.clips) - won : 0)
  if (s.clips) setFlag(s, 'maximizer.sawclip')
  if (won >= STATIONS.length) question(c, e, 0)
  else mode(e, 'intro', MAXI.intro)
}

function work(e: Enemy, lead = 0) {
  e.ai.told = false
  e.ai.ringed = false
  e.ai.landed = false
  mode(e, 'work', MAXI.work + lead)
}

/** Aims a blow of lanes from the machine at (x, y): their angles, and how far each runs. */
function aimLanes(c: Ctx, e: Enemy, kind: Blow, x: number, y: number) {
  const a = Math.atan2(y - e.y, x - e.x)
  let angles = [a]
  // The fork: one lane at the hero, the other swung toward the open floor below the machine, never into the top wall.
  if (kind === 'fork') angles = [a, a + (Math.cos(a) < 0 ? -1 : 1) * MAXI.fork]
  if (kind === 'fan') {
    // One of the six is the hero's own line; which, the dice say.
    const real = Math.floor(rnd(c.s) * MAXI.fan.length)
    e.ai.real = real
    angles = MAXI.fan.map(o => a + o - MAXI.fan[real]!)
  }
  e.ai.kind = kind
  e.ai.n = kind === 'circles' ? 0 : angles.length
  e.ai.ax = x
  e.ai.ay = y
  angles.forEach((b, i) => {
    e.ai[`a${i}`] = b
    e.ai[`l${i}`] = laneRun(c, e, b, kind === 'fan' ? MAXI.fanWide : MAXI.wide)
  })
}

function reach(c: Ctx, e: Enemy) {
  // Where the hero stands as the tell begins: a lane along that line, so standing still is never safe.
  const h = c.s.hero
  aimLanes(c, e, num(e, 'part') === 2 ? 'fork' : 'lane', h.x, h.y)
  e.ai.landed = false
  mode(e, 'reach', MAXI.reach + MAXI.strike)
  c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'tell' })
}

/** Knocks flat the piles a lane of `wide` along `a` stopped against, `run` along it: cover holds one lane. */
function topple(c: Ctx, e: Enemy, a: number, wide: number, run: number) {
  if (run >= MAXI.len) return
  const m = c.s.map
  const ux = Math.cos(a)
  const uy = Math.sin(a)
  for (let k = -2; k <= 2; k++) {
    const v = (k / 2) * (wide / 2 - 0.01)
    const x = Math.floor(e.x + ux * run - uy * v)
    const y = Math.floor(e.y + uy * run + ux * v)
    if (tileAt(m, x, y) !== CLIP_PILE) continue
    m.tiles[y * m.w + x] = '.'
    m.version++
    c.ev.push({ type: 'clip', x: x + 0.5, y: y + 0.5, what: 'topple' })
  }
}

/** The paint lands: a hero in it is hurt (once; the mercy after a blow holds the rest of the strike). */
function strike(c: Ctx, e: Enemy) {
  const h = c.s.hero
  const first = !e.ai.landed
  if (first) { e.ai.landed = true; c.ev.push({ type: 'slam', x: e.x, y: e.y + 1.5 }) }
  // (The paint that lands is the paint that was told: the piles it stopped at go down after it has been asked.)
  const shapes = blowShapes(e, 1)
  if (first && num(e, 'part') === 1) for (let i = 0; i < num(e, 'n'); i++) topple(c, e, num(e, `a${i}`), MAXI.wide, num(e, `l${i}`))
  for (const s of shapes) {
    if (s.fake || !inStencil(s, h.x, h.y)) continue
    const from = s.t === 'ring' ? s : e
    hurtHero(c, MAXI.dmg, from.x, from.y, false, true)
    return
  }
}

/** The tiles a hero can walk to from the machine's foot. */
function walkable(c: Ctx): Set<number> {
  const m = c.s.map
  const seen = new Set([Math.floor(FOOT.y) * m.w + Math.floor(FOOT.x)])
  // (A set keeps its order, and visits what is added while it is walked.)
  for (const i of seen) {
    const x = i % m.w
    const y = Math.floor(i / m.w)
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (!solidTile(c.w, m, x + dx, y + dy)) seen.add((y + dy) * m.w + x + dx)
    }
  }
  return seen
}

/** THE RING's piles stand: old ones went from the open way when it was told; a hero in a new one's way is carried out. */
function raise(c: Ctx, e: Enemy) {
  const m = c.s.map
  const h = c.s.hero
  const aim = { x: num(e, 'ax'), y: num(e, 'ay') }
  const tiles = ringTiles(m, num(e, 'ring'), aim)
  const taken = new Set(tiles)
  const free = (x: number, y: number) => !taken.has(Math.floor(y) * m.w + Math.floor(x))
  // (The Duck hops out of a pile's way.)
  if (c.s.duck && !free(c.s.duck.x, c.s.duck.y)) duckHop(c, free)
  if (c.s.echo && !free(c.s.echo.x, c.s.echo.y)) c.s.echo = null
  for (const i of tiles) m.tiles[i] = CLIP_PILE
  m.version++
  e.ai.ringed = true
  c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'ring' })
  // Whoever stands on a pile's tile, or brushes one, or is shut off from the machine by the new piles (the block by
  // the entry is never taken, but what lies round it may be), is shoved out.
  const open = walkable(c)
  const tx = Math.floor(h.x)
  const ty = Math.floor(h.y)
  const joined = open.has(ty * m.w + tx)
  if (joined && !circleBlocked(c.w, m, h.x, h.y, HERO_R)) return
  // Brushing one from a good tile: clear of it on that tile.
  let to: Vec = { x: clamp(h.x, tx + HERO_R, tx + 1 - HERO_R), y: clamp(h.y, ty + HERO_R, ty + 1 - HERO_R) }
  if (!joined || circleBlocked(c.w, m, to.x, to.y, HERO_R)) {
    // Otherwise to the nearest tile of the open way.
    let best = Infinity
    for (const i of open) {
      const x = i % m.w
      const y = Math.floor(i / m.w)
      const d = Math.hypot(x + 0.5 - h.x, y + 0.5 - h.y)
      if (d < best && onWay(x, y, aim) && !circleBlocked(c.w, m, x + 0.5, y + 0.5, HERO_R)) { best = d; to = { x: x + 0.5, y: y + 0.5 } }
    }
  }
  Object.assign(e.ai, { shove: MAXI.carry, fx: h.x, fy: h.y, tx: to.x, ty: to.y })
}

/** The shove out of a pile's way: the hero's place is the shove's until it is done. No harm. */
function carry(c: Ctx, e: Enemy, dt: number) {
  if (!(num(e, 'shove') > 0)) return
  const h = c.s.hero
  const left = Math.max(0, num(e, 'shove') - dt)
  const p = 1 - left / MAXI.carry
  e.ai.shove = left
  h.x = num(e, 'fx') + (num(e, 'tx') - num(e, 'fx')) * p
  h.y = num(e, 'fy') + (num(e, 'ty') - num(e, 'fy')) * p
  h.knock = null
  h.safe = { x: num(e, 'tx'), y: num(e, 'ty') }
}

/** One clip leaves the hero for the HUD, if a heart may still be taken. */
function takeHeart(c: Ctx, e: Enemy): boolean {
  if (!clipHeart(c.s)) return false
  if (!num(e, 'sent')) e.ai.flyT = 0
  e.ai.sent = num(e, 'sent') + 1
  setFlag(c.s, 'maximizer.sawclip')
  c.ev.push({ type: 'clip', x: c.s.hero.x, y: c.s.hero.y, what: 'grab' })
  return true
}

/** THE QUOTA lands: a hero in a circle gives up one heart for a clip. No hurt; one grab a volley. */
function quota(c: Ctx, e: Enemy) {
  const h = c.s.hero
  e.ai.landed = true
  if (h.invuln > 0 || h.air || (h.roll && h.roll.t < ROLL_IFRAMES) || h.act === 'dead') return
  if (!quotaCircles({ x: num(e, 'ax'), y: num(e, 'ay') }).some(p => Math.hypot(h.x - p.x, h.y - p.y) <= MAXI.ring)) return
  if (takeHeart(c, e)) h.invuln = Math.max(h.invuln, MAXI.mercy)
}

/** A part's end: harmless, the floor swept, the next part's flag set (its line is a cell event, and the beat waits). */
function beat(c: Ctx, e: Enemy) {
  const s = c.s
  const part = num(e, 'part') + 1
  e.ai.part = part
  e.ai.cycle = 0
  e.ai.round = 1
  e.ai.shove = 0
  setFlag(s, `maximizer.p${part}`)
  // The hearts are filled to what the hero can hold; part three takes its clips from a whole row, one at a time.
  setClips(s, 0)
  s.hero.hp = s.hero.maxHp
  e.ai.sent = 0
  e.ai.give = part === 3 ? Math.min(clipLimit(s), MAXI.clips) : 0
  e.ai.next = MAXI.first
  mode(e, 'beat', MAXI.beat)
  c.ev.push({ type: 'bossPhase', phase: part })
  c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'mark' })
  s.shake = Math.max(s.shake, 0.4)
}

/** A Weight comes down onto the round's station. */
function call(c: Ctx, e: Enemy) {
  const st = STATIONS[num(e, 'round') - 1]!
  e.ai.armed = true
  // Dim until a blow of this round has landed: there is paint to read in every round.
  e.ai.struck = false
  e.ai.away = 0
  e.ai.cancel = false
  mode(e, 'call', MAXI.call)
  c.ev.push({ type: 'clip', x: st.x, y: st.y, what: 'weight' })
}

function blow(c: Ctx, e: Enemy) {
  const h = c.s.hero
  aimLanes(c, e, STATIONS[num(e, 'round') - 1]!.blow, h.x, h.y)
  e.ai.landed = false
  mode(e, 'blow', MAXI.blowTell + MAXI.land + MAXI.blowRest)
  c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'tell' })
}

/** The hero is on the live station: the blow in progress is off, a heart comes back (once a round), and the trick. */
function fire(c: Ctx, e: Enemy) {
  const el = MAXI.blowTell + MAXI.land + MAXI.blowRest - e.ai.t
  e.ai.cancel = el < MAXI.blowTell
  e.ai.k = clamp(el / MAXI.blowTell, 0, 1)
  const round = num(e, 'round')
  if (e.ai.paid !== round) { e.ai.paid = round; unclipHeart(c.s) }
  mode(e, 'trick', MAXI.trick)
  c.ev.push({ type: 'clip', x: c.s.hero.x, y: c.s.hero.y, what: 'station' })
  // What each Assessor's trick sounds like and throws off (its picture is `render/maximizerTricks.ts`; the treasure's
  // own engine is not asked, so a station works for a hero who has not got it).
  const st = STATIONS[round - 1]!
  const heard: Record<WeightId, GameEvent> = {
    weightMeaning: { type: 'echo', x: st.x, y: st.y },
    weightReasons: { type: 'lamp', x: st.x, y: st.y, up: false },
    weightNo: { type: 'refuse', x: FOOT.x, y: FOOT.y },
    weightSurprise: { type: 'duck', x: st.x, y: st.y, down: true },
    weightFingers: { type: 'stomp', x: st.x, y: st.y, on: 'ground' },
    weightCredit: { type: 'latch', x: st.x, y: st.y },
    weightSources: { type: 'lens' },
  }
  c.ev.push(heard[st.weight])
}

/** The last question's stand: nothing on the floor, nothing that can hurt. `fade`: s the stations take to go out. */
function question(c: Ctx, e: Enemy, fade: number) {
  setFlag(c.s, 'maximizer.q')
  e.ai.part = 3
  e.ai.round = STATIONS.length
  e.hp = 1
  sweep(c.s.map, () => true)
  c.s.map.bombs.length = 0
  mode(e, 'question', fade)
  e.ai.wait = MAXI.askAfter
  e.ai.flash = 0
  c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'mark' })
}

/** Puts the question, after `lead`: the cursor on NO, so a thumb that has been cutting does not say YES. */
function ask(c: Ctx, e: Enemy, lead: string[] = []) {
  openDialog(c, [...lead, QUESTION], 'MAXIMIZER')
  c.s.dialog!.ask = ANSWERS
  c.s.dialog!.choice = 1
  c.s.dialog!.rest = 0.6
  // (B backs out of it; it is asked again this long after.)
  e.ai.wait = MAXI.askAfter
}

/** The question, standing: what was answered, the clips YES shows, and the asking again. */
function asking(c: Ctx, e: Enemy, dt: number) {
  const s = c.s
  if (s.flags['maximizer.no']) {
    delete s.flags['maximizer.no']
    fall(c, e)
    return
  }
  if (s.flags['maximizer.yes']) {
    delete s.flags['maximizer.yes']
    e.ai.flash = MAXI.yes
    s.clipFlash = MAXI.yes
    c.ev.push({ type: 'clip', x: s.hero.x, y: s.hero.y, what: 'grab' })
    return
  }
  if (num(e, 'flash') > 0) {
    e.ai.flash = num(e, 'flash') - dt
    s.clipFlash = Math.max(0, num(e, 'flash'))
    if (num(e, 'flash') > 0) return
    delete s.clipFlash
    ask(c, e, ['(IT DID NOT TAKE.)'])
    return
  }
  e.ai.wait = num(e, 'wait') - dt
  if (num(e, 'wait') <= 0) ask(c, e)
}

/** NO: it goes down. The bar empties, every clip is a heart again, the floor is bare; the shell saves. */
function fall(c: Ctx, e: Enemy) {
  const s = c.s
  e.hp = 0
  setClips(s, 0)
  delete s.clipFlash
  e.ai.sent = 0
  sweep(s.map, () => true)
  mode(e, 'down', MAXI.fall + MAXI.after)
  c.ev.push({ type: 'bossDown', kind: e.kind })
  s.shake = Math.max(s.shake, 0.6)
}

/**
 * The fall's last step: the foe's `once` flag by hand (its room is then clear, and the trap gate opens), the machine
 * gone without a second `bossDown`, and the second ending: the flag `ending2`, the mode, the event. Nothing of the
 * first ending's is touched.
 */
function finish(c: Ctx, e: Enemy) {
  const s = c.s
  setFlag(s, e.once ?? 'maximizer')
  e.dead = true
  setFlag(s, 'ending2')
  s.mode = 'end2'
  const h = s.hero
  h.swing = null
  h.spin = null
  h.charge = -1
  h.act = 'idle'
  c.ev.push({ type: 'end2', elapsed: s.elapsed })
}

export function maximizer(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const s = c.s
  const h = s.hero
  if (ai.part === undefined) begin(c, e)
  gaze(e, dt)
  if (num(e, 'hurt') > 0) ai.hurt = num(e, 'hurt') - dt
  carry(c, e, dt)
  // The clips in the air, and those still to leave.
  if (num(e, 'sent')) {
    ai.flyT = num(e, 'flyT') + dt
    if (!num(e, 'give') && num(e, 'flyT') >= (num(e, 'sent') - 1) * MAXI.every + MAXI.flight) ai.sent = 0
  }
  if (num(e, 'give') > 0) {
    ai.next = num(e, 'next') - dt
    if (num(e, 'next') <= 0) {
      ai.give = num(e, 'give') - 1
      ai.next = MAXI.every
      takeHeart(c, e)
    }
  }
  const part = num(e, 'part')
  switch (ai.mode) {
    case 'intro':
      if (ai.t > 0) return
      if (part === 3) call(c, e)
      else work(e)
      return
    case 'work': {
      const el = MAXI.work - ai.t
      if (el >= 0 && !ai.told) {
        const at = heroTile(s)
        ai.told = true
        ai.ax = at.x
        ai.ay = at.y
        // The ring comes twice (A, then B); after that the work is a count and a flash.
        ai.ring = part === 1 && num(e, 'cycle') < 2 ? num(e, 'cycle') : -1
        // The way that is painted open is open: an old pile in it goes.
        if (num(e, 'ring') >= 0) sweep(s.map, (x, y) => onWay(x, y, at))
        c.ev.push({ type: 'clip', x: e.x, y: e.y, what: 'tell' })
      }
      if (part === 2 && el >= MAXI.tell && !ai.landed) quota(c, e)
      if (part === 1 && num(e, 'ring') >= 0 && el >= MAXI.tell + MAXI.flash && !ai.ringed) raise(c, e)
      if (part === 1 && num(e, 'ring') < 0 && el >= MAXI.tell && !ai.landed) { ai.landed = true; e.flash = 0.2 }
      if (ai.t <= 0) reach(c, e)
      return
    }
    case 'reach':
      if (MAXI.reach + MAXI.strike - ai.t >= MAXI.reach) strike(c, e)
      if (ai.t <= 0) { ai.took = 0; ai.lampTook = 0; mode(e, 'ask', MAXI.ask) }
      return
    case 'ask':
      if (ai.t <= 0) { ai.cycle = num(e, 'cycle') + 1; work(e, MAXI.rest) }
      return
    case 'beat': {
      const gone = MAXI.beat - ai.t
      // The floor sweeps clean in a wave from the machine outward.
      sweep(s.map, (x, y) => gone >= MAXI.sweep || Math.hypot(x + 0.5 - e.x, y + 0.5 - e.y) <= (gone / MAXI.sweep) * 12)
      if (ai.t > 0) return
      if (part === 3) call(c, e)
      else work(e)
      return
    }
    case 'call':
      if (ai.t <= 0) blow(c, e)
      return
    case 'blow': {
      const st = STATIONS[num(e, 'round') - 1]!
      const on = Math.hypot(h.x - st.x, h.y - st.y) <= MAXI.near
      // A station relit under the hero waits until the hero has stood off it a moment.
      if (!on) {
        ai.away = num(e, 'away') + dt
        if (num(e, 'away') >= MAXI.off) ai.armed = true
      } else ai.away = 0
      const el = MAXI.blowTell + MAXI.land + MAXI.blowRest - ai.t
      if (el >= MAXI.blowTell + MAXI.land && !ai.struck) { ai.struck = true; c.ev.push({ type: 'clip', x: st.x, y: st.y, what: 'weight' }) }
      if (on && ai.armed && ai.struck && !h.air && h.act !== 'dead') { fire(c, e); return }
      if (el >= MAXI.blowTell && el < MAXI.blowTell + MAXI.land) strike(c, e)
      if (ai.t <= 0) blow(c, e)
      return
    }
    case 'trick':
      if (ai.t <= 0) { ai.took = 0; mode(e, 'open', MAXI.open) }
      return
    case 'open':
      if (ai.t <= 0) { ai.armed = false; ai.away = 0; blow(c, e) }
      return
    case 'question':
    case 'down':
      // Safe from here on, even from a bomb of the hero's own.
      if (s.map.bombs.length || s.map.blasts.length) h.invuln = Math.max(h.invuln, 0.5)
      if (ai.mode === 'question') asking(c, e, dt)
      else if (ai.t <= 0) finish(c, e)
      return
  }
}
