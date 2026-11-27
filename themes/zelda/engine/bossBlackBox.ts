/**
 * THE BLACK BOX (`EnemyKind` 'blackbox', the Lighthouse's boss in the Lamp Room; docs/games/neon-shrine-lighthouse.md):
 * a cube on a 3×3 pedestal (`Ξ`) with four lanes out of its faces. It never moves and its touch does no harm. A storm
 * lamp's beam that meets the pedestal enters a face; after a think, in which the face it will answer from glows and a
 * dashed line shows the way, a beam of its own leaves that face. The three receivers round the room take that beam and
 * no other; with all three lit it stands open, gold. Then it rewires. While nothing is shone into it, it blurts: the
 * lane the hero stands in fills pink.
 *
 * A face is told by its number (`BOX_FACES`: N 1, E 2, S 3, W 4), never by a colour. Everything that is painted on the
 * floor comes out of this file as stencils (`boxStencils`), and what hurts is asked of the same shapes (`inStencil`).
 *
 * The brain is `e.ai`: `mode` is 'idle' (listening), 'think', 'answer', 'open', 'rewire', 'blurt' (the lane told) or
 * 'beam' (the lane filled). It begins afresh on every entry to the room (`resetEnemy`), and its first step puts the
 * three receivers out.
 */
import type { Dir, Enemy, GameState, Vec } from '../types'
import { type Ctx, hurtHero } from './combat'
import { cellRect, tileAt } from './map'
import { puzzleInfo, type Emitter } from './puzzles/info'
import { stopsBeam } from './puzzles/index'
import { inStencil, type Stencil, type StencilShape } from './stencils'
import { clamp, rnd } from './util'

/** The fight's numbers (first values to tune by playing); seconds unless said. */
export const BOX = {
  /** A lamp's beam must have been in a face this long, unbroken, to count. */
  listen: 0.6,
  think: 1.2,
  answer: 2.2,
  /** With the third receiver lit, the answer is held this long before the Box opens, so that the beam is seen there. */
  full: 0.5,
  /** After an answer the face it was asked through is not heard again until its beam has been off this long. */
  forget: 0.4,
  /** Open this long at most; it takes `take` hit points an opening, and shuts `shut` s after it has taken them. */
  open: 6,
  take: 6,
  shut: 0.35,
  /** A bomb or a thrown pot, while it is open. */
  throwDmg: 3,
  rewire: 1.8,
  /** Nothing heard for this long and it blurts: after the hero comes in, after a rewire, after an answer. */
  quietIn: 8,
  quietRewire: 5.5,
  quietAnswer: 5,
  /** From one blurt to the next, with nothing heard between. */
  again: 5.5,
  /** The blurt: the lane told, then filled. */
  warn: 1.8,
  fire: 0.5,
  /** Round three's pink beam, as the answer starts. */
  pink: 0.5,
  pinkW: 1,
  /** Half hearts a pink beam takes. */
  dmg: 2,
  /** The white-hot frame after a blow. */
  hurt: 0.25,
  /**
   * The camera rests on the Box while it stands in the hero's room, `aside` tiles along the isometric screen's width
   * from its middle (the west receiver is a tile further out than the east one), and moves off that only as far as
   * keeps the hero `margin` tiles inside the picture.
   */
  aside: -0.5,
  margin: 0.8,
} as const

/** The faces, in the order every table here is written: N, E, S, W. */
export const BOX_FACES = ['n', 'e', 's', 'w'] as const
export type Face = 0 | 1 | 2 | 3

/**
 * The three wirings: for a beam into face i (N, E, S, W), the face the answer leaves; round three also sends a pink
 * beam out of the face opposite the one it was asked through. After the third round the third wiring repeats.
 */
export const BOX_WIRINGS: ReadonlyArray<{ name: string; out: readonly Face[]; pink?: readonly Face[] }> = [
  // N→E, E→S, S→W, W→N
  { name: 'TURN', out: [1, 2, 3, 0] },
  // N→W, E→W, S→N, W→E
  { name: 'FUNNEL', out: [3, 3, 0, 1] },
  // Round one's turn, and pink out of the far side: in N pink out S, E out W, S out N, W out E.
  { name: 'TWO FACES', out: [1, 2, 3, 0], pink: [2, 3, 0, 1] },
]

/** The receivers' flags, in the faces' order (none on the south). Their bit in `ai.mask` is 1 << face. */
const RECEIVERS = ['lighthouse.box.n', 'lighthouse.box.e', 'lighthouse.box.w'] as const
const FACE_OF: Record<string, Face> = { 'lighthouse.box.n': 0, 'lighthouse.box.e': 1, 'lighthouse.box.w': 3 }
const ALL = (1 << 0) | (1 << 1) | (1 << 3)

/** A receiver that only the Box's own beam lights (`traceBeams`: a lamp's ends there and lights nothing). */
export const boxReceiver = (flag: string | undefined): boolean => !!flag && flag in FACE_OF

/** Each face's way out, in tiles from the room's corner. */
const DIRS: readonly Dir[] = ['up', 'right', 'down', 'left']
const WAY: ReadonlyArray<{ x: number; y: number }> = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]
/** How far each lane runs from the pedestal's face. */
const LANE = [3, 4, 3, 5] as const

const num = (e: Enemy, k: string, or = 0) => (e.ai[k] as number | undefined) ?? or
const bits = (mask: number) => [0, 1, 3].filter(f => mask & (1 << f)).length
/** The wiring in force. */
export const wiringOf = (e: Enemy) => BOX_WIRINGS[Math.min(num(e, 'round'), BOX_WIRINGS.length - 1)]!
/** Receivers its answers have lit this round: 0 to 3 (a panel off it for each). */
export const panelsOff = (e: Enemy) => bits(num(e, 'mask'))

/** The middle of the face's tile in the pedestal's rim: where its beams start. */
const rim = (e: Enemy, f: number) => ({ x: e.home.x + WAY[f]!.x, y: e.home.y + WAY[f]!.y })

/** The lane out of face `f`: a rectangle from the pedestal's face to the lane's end, three tiles wide. */
export function boxLane(e: Enemy, f: number): Extract<StencilShape, { t: 'strip' }> {
  const v = WAY[f]!
  return { t: 'strip', x0: e.home.x + v.x * 1.5, y0: e.home.y + v.y * 1.5, ux: v.x, uy: v.y, len: LANE[f]!, w: 3 }
}

/** Is (x, y) in the lane out of face `f`? (-1: in no lane.) */
export function laneAt(e: Enemy, x: number, y: number): number {
  for (let f = 0; f < 4; f++) if (inStencil(boxLane(e, f), x, y)) return f
  return -1
}

/**
 * Where a straight beam out of face `f` ends, a dry run of the beam the puzzle code will send: at a receiver's middle,
 * at the near edge of the first solid tile (a lamp stood in the way is one), or at the room's edge.
 */
function rayEnd(c: Ctx, e: Enemy, f: number): { x: number; y: number } {
  const v = WAY[f]!
  const z = cellRect(c.info, e.cell)
  const from = rim(e, f)
  let x = Math.floor(from.x)
  let y = Math.floor(from.y)
  for (let n = 0; n < 32; n++) {
    const nx = x + v.x
    const ny = y + v.y
    if (nx < z.x || ny < z.y || nx >= z.x + z.w || ny >= z.y + z.h) break
    if (tileAt(c.s.map, nx, ny) === 'ρ') return { x: nx + 0.5, y: ny + 0.5 }
    if (stopsBeam(c, nx, ny)) break
    x = nx
    y = ny
  }
  return { x: x + 0.5 + v.x * 0.5, y: y + 0.5 + v.y * 0.5 }
}

/** A beam has met the pedestal going (dx, dy): only a lamp's enters a face, told by the way it was going. */
export function boxFace(c: Ctx, dx: number, dy: number, src: string | undefined) {
  if (src !== 'lamp') return
  const face: Face = dy > 0 ? 0 : dx < 0 ? 1 : dy < 0 ? 2 : 3
  const box = c.s.map.enemies.find(e => e.kind === 'blackbox' && !e.dead && e.cell === c.s.zoneIndex)
  if (box) box.ai.fed = face
}

/** The map's emitters and, while the Box answers, its own beam out of the answering face. */
export function boxEmitters(c: Ctx, list: Emitter[]): Emitter[] {
  const box = c.s.map.enemies.find(e => e.kind === 'blackbox' && !e.dead && e.cell === c.s.zoneIndex)
  if (!box || box.ai.mode !== 'answer') return list
  const f = num(box, 'exit')
  const p = rim(box, f)
  return [...list, { idx: Math.floor(p.y) * c.s.map.w + Math.floor(p.x), dir: DIRS[f]!, cell: box.cell, src: 'box' }]
}

/**
 * What the camera looks at while the Box stands in the hero's room: null otherwise. `halfW`, `halfH`: half the picture,
 * in tiles along the screen's width and height; `iso`: the screen's width runs along x − y (a tile each way is 16 px
 * across and 8 down), not along x. A screen that holds the room rests on the Box; a smaller one gives way to the hero.
 * It eases in as the fight starts and back to the hero after the fall.
 */
export function boxFocus(s: GameState, halfW: number, halfH: number, iso: boolean): Vec | null {
  const e = s.scroll ? undefined : s.map.enemies.find(o => o.kind === 'blackbox' && o.cell === s.zoneIndex)
  if (!e) return null
  const h = s.hero
  const k = num(e, 'lean') * (e.dead ? 1 - Math.min(1, e.deathT ?? 1) : 1)
  const dx = h.x - e.home.x
  const dy = h.y - e.home.y
  /** `rest`, moved no further than keeps `hero` within `half` of it. */
  const near = (rest: number, hero: number, half: number) => clamp(rest, hero - Math.max(0, half), hero + Math.max(0, half))
  let to: Vec
  if (iso) {
    const across = near(BOX.aside, dx - dy, halfW - BOX.margin)
    // (Down the screen a tile of x + y is half as many px; the hero's own height wants the room above him.)
    const down = near(0, dx + dy, halfH * 2 - 4)
    to = { x: e.home.x + (down + across) / 2, y: e.home.y + (down - across) / 2 }
  } else to = { x: e.home.x + near(0, dx, halfW - BOX.margin), y: e.home.y + near(0, dy, halfH - 1.5) }
  return { x: h.x + (to.x - h.x) * k, y: h.y + (to.y - h.y) * k }
}

function listen(e: Enemy, quietFor: number | null) {
  e.ai.mode = 'idle'
  e.ai.t = 0
  e.ai.tell = 0
  e.ai.in = -1
  e.ai.feed = 0
  e.ai.quiet = 0
  e.ai.full = false
  if (quietFor !== null) e.ai.limit = quietFor
}

/** The round a Box with `e.hp` hit points left is in: one for each `take` it has lost. (A wounded Box comes back to it.) */
export const boxRound = (e: Enemy): number => Math.min(BOX_WIRINGS.length - 1, Math.max(0, Math.floor((e.maxHp - e.hp) / BOX.take)))

/** A lamp taken up or moved is heard afresh: whatever face the Box was ignoring is listened to again. */
export function boxHears(s: GameState) {
  for (const e of s.map.enemies) if (e.kind === 'blackbox' && !e.dead && e.ai.on) { e.ai.ignore = -1; e.ai.off = 0 }
}

/** The first step of a visit: the round its hit points say (the first when it is whole), shut, the three receivers dark. */
function begin(c: Ctx, e: Enemy) {
  e.ai.on = true
  e.ai.round = num(e, 'round')
  e.ai.mask = 0
  e.ai.ignore = -1
  e.ai.off = 0
  e.ai.last = -1
  e.ai.fed = e.ai.fed ?? -1
  listen(e, BOX.quietIn)
  douse(c)
}

/** The three receivers' flags go: each lights again, with its chime, when an answer reaches it. */
function douse(c: Ctx) {
  for (const f of RECEIVERS) delete c.s.flags[f]
  c.s.map.version++
}

/** A pink beam takes a heart off a hero whose middle is in it. No shove: it never puts anyone out of a lane or a door. */
function scald(c: Ctx, shape: StencilShape): boolean {
  const h = c.s.hero
  return inStencil(shape, h.x, h.y) && hurtHero(c, BOX.dmg, h.x, h.y, false, true)
}

/** Round three's pink beam out of face `f`, as far as its way is clear. */
function pinkStrip(e: Enemy, f: number): Extract<StencilShape, { t: 'strip' }> {
  const v = WAY[f]!
  const x0 = e.home.x + v.x * 1.5
  const y0 = e.home.y + v.y * 1.5
  const len = Math.max(0, (num(e, 'px') - x0) * v.x + (num(e, 'py') - y0) * v.y)
  return { t: 'strip', x0, y0, ux: v.x, uy: v.y, len, w: BOX.pinkW }
}

/** The ways of the beams to come, as the room stands now. */
function aim(c: Ctx, e: Enemy) {
  const end = rayEnd(c, e, num(e, 'exit'))
  e.ai.lx = end.x
  e.ai.ly = end.y
  const p = num(e, 'pink', -1)
  if (p < 0) return
  const far = rayEnd(c, e, p)
  e.ai.px = far.x
  e.ai.py = far.y
}

export function blackbox(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  // It stands on its pedestal, whatever struck it.
  e.x = e.home.x
  e.y = e.home.y
  e.knock = null
  if (!ai.on) begin(c, e)
  ai.lean = Math.min(1, num(e, 'lean') + dt)
  if (num(e, 'hurt') > 0) ai.hurt = num(e, 'hurt') - dt
  // What the beams said at the last step.
  const fed = num(e, 'fed', -1)
  ai.fed = -1
  if (num(e, 'ignore', -1) >= 0) {
    ai.off = fed === ai.ignore ? 0 : num(e, 'off') + dt
    if (num(e, 'off') >= BOX.forget) ai.ignore = -1
  }
  const heard = fed >= 0 && fed !== ai.ignore ? fed : -1
  // Round three's pink beam burns on its own clock, whatever the Box does meanwhile.
  if (num(e, 'hot') > 0) {
    ai.hot = num(e, 'hot') - dt
    if (!ai.scalded && scald(c, pinkStrip(e, num(e, 'pink')))) ai.scalded = true
  }
  switch (ai.mode) {
    case 'idle': {
      if (heard >= 0) {
        ai.feed = ai.in === heard ? num(e, 'feed') + dt : dt
        ai.in = heard
        ai.quiet = 0
        // (A hero at work with the lamp is given the quiet of an answer, however soon the last blurt was.)
        ai.limit = Math.max(num(e, 'limit'), BOX.quietAnswer)
        if (num(e, 'feed') < BOX.listen) return
        const wiring = wiringOf(e)
        ai.mode = 'think'
        ai.t = ai.tell = BOX.think
        ai.exit = wiring.out[heard]!
        ai.pink = wiring.pink?.[heard] ?? -1
        aim(c, e)
        c.ev.push({ type: 'psi', x: e.x, y: e.y })
        return
      }
      ai.in = -1
      ai.feed = 0
      // (A lamp left standing at a face it is not heard through is no quiet: the Box does not strike for it, and the face's number is dim.)
      ai.quiet = fed >= 0 ? 0 : num(e, 'quiet') + dt
      if (num(e, 'quiet') < num(e, 'limit')) return
      // The blurt: the lane the hero stands in; from between the lanes, any but the last.
      let lane = laneAt(e, c.s.hero.x, c.s.hero.y)
      if (lane < 0) {
        const others = [0, 1, 2, 3].filter(f => f !== ai.last)
        lane = others[Math.floor(rnd(c.s) * others.length)]!
      }
      ai.lane = ai.last = lane
      ai.mode = 'blurt'
      ai.t = ai.tell = BOX.warn
      c.ev.push({ type: 'psi', x: e.x, y: e.y })
      return
    }
    case 'blurt':
      if (ai.t > 0) return
      ai.mode = 'beam'
      ai.t = BOX.fire
      ai.struck = false
      c.s.shake = Math.max(c.s.shake, 0.15)
      c.ev.push({ type: 'shoot', x: e.x, y: e.y, kind: 'laser' })
      if (scald(c, boxLane(e, num(e, 'lane')))) ai.struck = true
      return
    case 'beam':
      if (!ai.struck && scald(c, boxLane(e, num(e, 'lane')))) ai.struck = true
      if (ai.t <= 0) listen(e, BOX.again - BOX.warn - BOX.fire)
      return
    case 'think':
      // (The beam taken away before it is done: it was never asked.)
      if (fed !== ai.in) { listen(e, null); return }
      aim(c, e)
      if (ai.t > 0) return
      ai.mode = 'answer'
      ai.t = BOX.answer
      ai.tell = 0
      c.ev.push({ type: 'shoot', x: e.x, y: e.y, kind: 'laser' })
      if (num(e, 'pink', -1) >= 0) {
        ai.hot = BOX.pink
        ai.scalded = false
      }
      return
    case 'answer': {
      aim(c, e)
      // A receiver its beam has reached takes a panel off it.
      const info = puzzleInfo(c.info)
      for (const idx of c.s.map.phys?.lit ?? []) {
        const flag = info.receivers.get(idx)
        if (!boxReceiver(flag)) continue
        const bit = 1 << FACE_OF[flag!]!
        if (num(e, 'mask') & bit) continue
        ai.mask = num(e, 'mask') | bit
        c.ev.push({ type: 'push', x: e.x, y: e.y })
      }
      if (num(e, 'mask') === ALL) {
        // All three: the answer is held a moment, the lamp or no, and it opens.
        if (!ai.full) { ai.full = true; ai.t = Math.min(ai.t, BOX.full) }
        if (ai.t > 0) return
        ai.mode = 'open'
        ai.t = BOX.open
        ai.took = 0
        // (The third answer is an answer as the others are: the face it was asked through must go dark first, a rewire
        // or no, so a lamp left standing asks the new wiring nothing.)
        ai.ignore = ai.in
        ai.off = 0
        c.s.shake = Math.max(c.s.shake, 0.35)
        c.ev.push({ type: 'boom', x: e.x, y: e.y })
        return
      }
      if (ai.t > 0 && fed === ai.in) return
      ai.ignore = ai.in
      ai.off = 0
      listen(e, BOX.quietAnswer)
      return
    }
    case 'open':
      // Its share taken, it shuts early, as a tough foe does.
      if (num(e, 'took') >= BOX.take) ai.t = Math.min(ai.t, BOX.shut)
      if (ai.t > 0) return
      ai.mode = 'rewire'
      ai.t = BOX.rewire
      ai.round = num(e, 'round') + 1
      ai.mask = 0
      douse(c)
      // Round two at the first rewire, round three at the second.
      if (num(e, 'round') < BOX_WIRINGS.length) c.ev.push({ type: 'bossPhase', phase: num(e, 'round') + 1 })
      else c.ev.push({ type: 'psi', x: e.x, y: e.y })
      return
    case 'rewire':
      if (ai.t <= 0) listen(e, BOX.quietRewire)
      return
  }
}

/** The Box's frame (`render/spritesLighthouse.ts`): shut and bobbing, thinking, panels off, open, struck. */
export function boxSprite(e: Enemy, time: number): string {
  if (num(e, 'hurt') > 0) return 'box_hurt'
  const mode = e.ai.mode
  if (mode === 'open') return 'box_open'
  const off = mode === 'rewire' ? 0 : panelsOff(e)
  // (Thinking with panels off, it shows its thought and its panels by turns, so that the count stays readable.)
  if (mode === 'think' && (!off || Math.floor(time * 5) % 2 === 0)) return 'box_think'
  if (off) return off === 1 ? 'box_p1' : 'box_p2'
  if (mode === 'answer' || mode === 'blurt' || mode === 'beam') return 'box_think'
  return `box_${Math.floor(time * 1.6) % 2}`
}

/**
 * What the Box shows on the floor: a blurt's lane; the four faces' strips with their numbers, one glowing before a beam
 * leaves it; the dashed way of a beam to come; round three's pink beam as it burns.
 */
export function boxStencils(e: Enemy): Stencil[] {
  if (e.dead) return []
  const mode = e.ai.mode
  const out: Stencil[] = []
  const run = (whole: number) => Math.max(0, Math.min(1, 1 - e.ai.t / whole))
  const lane = num(e, 'lane')
  if (mode === 'blurt') out.push({ ...boxLane(e, lane), k: run(BOX.warn) })
  if (mode === 'beam') out.push({ ...boxLane(e, lane), k: 1, hot: true })
  const thinking = mode === 'think'
  const answering = mode === 'answer'
  const exit = num(e, 'exit', -1)
  const pink = num(e, 'pink', -1)
  for (let f = 0; f < 4; f++) {
    const v = WAY[f]!
    const glow = ((mode === 'blurt' || mode === 'beam') && f === lane) || ((thinking || answering) && f === pink) ? 'pink' : (thinking || answering) && f === exit ? 'cyan' : undefined
    out.push({ t: 'face', x: e.home.x + v.x * 2, y: e.home.y + v.y * 2, vert: !!v.x, n: f + 1, glow, ...(num(e, 'ignore', -1) === f ? { dim: true } : {}), ...(mode === 'rewire' ? { spin: run(BOX.rewire) } : {}), k: thinking ? run(BOX.think) : 1 })
  }
  if (thinking || answering) {
    const way = (f: number, x: number, y: number, hue: 'cyan' | 'pink'): Stencil => ({ t: 'dash', x0: e.home.x + WAY[f]!.x * 1.5, y0: e.home.y + WAY[f]!.y * 1.5, x1: x, y1: y, hue, k: thinking ? run(BOX.think) : 1 })
    // (While it answers, its own beam is the way: the dashes are the think's.)
    if (thinking) {
      out.push(way(exit, num(e, 'lx'), num(e, 'ly'), 'cyan'))
      if (pink >= 0) out.push(way(pink, num(e, 'px'), num(e, 'py'), 'pink'))
    }
  }
  if (num(e, 'hot') > 0) out.push({ ...pinkStrip(e, pink), k: 1, hot: true })
  return out
}
