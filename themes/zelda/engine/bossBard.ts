/**
 * BARD (`EnemyKind` 'bard', Act Three's miniboss, docs/worlds/act-three.md): it is somebody else each time. It hides
 * as one of three pieces of THE BOARDS' set (a door, a chest, a rope end), shudders in it with its blow stencilled,
 * steps out as that piece, stands dazed and open, goes behind the set and picks another, never the same twice running.
 * Its touch never hurts; only a stencilled blow does, and what it hurts is exactly the stencil (`bardBoxes`). Behind
 * the set it is not in the room at all (nothing can strike it, find it or turn the hero toward it). The room's floor
 * and ledge are fixed numbers here: the arena of the brief.
 */
import type { Enemy, MapState } from '../types'
import { HERO_R } from '../types'
import { hurtHero, type Ctx, type HitOpts } from './combat'
import { column, inBoxes, type Box } from './sandbag'
import { rnd } from './util'

export const BARD = {
  /** Seconds: the first hide and the others, the two tells, the leap, the bags' fall, the opening and the wings. */
  first: 4, hide: 5, tell: 0.9, ropeTell: 1.1, leap: 0.7, drop: 0.2, open: 2.4, wings: 1,
  /** What one opening gives the blade, whatever the blade. */
  take: 4,
  dmg: 2,
  /** The charge, tiles/s, and the height of its band over the floor. */
  speed: 9, band: 0.9,
  /** The arena: the floor's and the ledge's top rows, and the open floor between the walls (x). */
  floor: 12, ledge: 10, walls: [1, 14],
  /** The leap's box, tiles wide, and where it may come down. */
  box: 3, leapMin: 2.5, leapMax: 12.5, arc: 3,
  /** The bags: columns `bagW` wide, their middles `bagStep` apart, the hero's within `bagMin`..`bagMax`. */
  bagW: 2, bagStep: 4, bagMin: 3, bagMax: 12, bagFrom: 2, bagTo: 13,
} as const

export type BardPiece = 'door' | 'chest' | 'rope'
/** The set: where each piece stands (its middle, and the row it stands on). */
export const BARD_SET: Record<BardPiece, { x: number; floor: number }> = {
  door: { x: 7.5, floor: BARD.floor },
  chest: { x: 4.5, floor: BARD.floor },
  rope: { x: 11.5, floor: BARD.ledge },
}
const PIECES = Object.keys(BARD_SET) as BardPiece[]
/** Behind the set. */
const OFF = -30

export const bardPiece = (e: Enemy) => (e.ai.piece as BardPiece | undefined) ?? 'door'
/** Not to be seen: behind the set, or in it. */
export const bardUnseen = (e: Enemy) => e.ai.mode === 'idle' || e.ai.mode === 'hide' || e.ai.mode === 'wings'
/** Stepped out of the set, to be drawn as itself. (Telling, it is still the piece: solid enough to clank on.) */
export const bardOut = (e: Enemy) => e.ai.mode === 'blow' || e.ai.mode === 'open'
const took = (e: Enemy) => (e.ai.took as number | undefined) ?? 0
/** Open: dazed, with this daze still to give. */
export const bardOpen = (e: Enemy) => !e.dead && e.ai.mode === 'open' && took(e) < BARD.take

/** What a blow of the hero's takes now: the most it may, or null (it clanks, and nothing happens). */
export function bardRule(c: Ctx, e: Enemy, blade: boolean): number | null {
  if (blade && bardOpen(e)) return BARD.take - took(e)
  if (!bardUnseen(e)) c.ev.push({ type: 'clank', x: e.x, y: e.y })
  return null
}

/** After a blow that bit: it stays where it stands, and its mercy is short enough for the whole chain. */
export function bardStruck(e: Enemy, opt?: HitOpts) {
  e.knock = null
  const mercy = opt?.chain ? 0.1 : 0.28
  if (opt?.echo) e.echoInvuln = mercy
  else e.invuln = mercy
}

/** The middles of the three bags' columns: the first at the hero's x (to the whole tile), the others where there is room. */
function bagMiddles(x: number): number[] {
  const first = Math.max(BARD.bagMin, Math.min(BARD.bagMax, Math.round(x)))
  const out = [first]
  for (const k of [-1, 1, -2, 2]) {
    const at = first + k * BARD.bagStep
    if (out.length < 3 && at >= BARD.bagFrom && at <= BARD.bagTo) out.push(at)
  }
  return out
}
export const bardBags = (e: Enemy) => [e.ai.c0, e.ai.c1, e.ai.c2].filter((v): v is number => typeof v === 'number')

/**
 * The blow it is telling or landing, as the boxes it hurts in and is stencilled by: the charge's band from the door
 * to the wall, the leap's patch of floor, or the three columns from the ceiling to what stops a bag.
 */
export function bardBoxes(m: MapState, e: Enemy): Box[] {
  if (e.dead || (e.ai.mode !== 'tell' && e.ai.mode !== 'blow')) return []
  const piece = bardPiece(e)
  const low = { y0: BARD.floor - BARD.band, y1: BARD.floor }
  if (piece === 'door') {
    const x = BARD_SET.door.x
    return [(e.ai.way as number) < 0 ? { x0: BARD.walls[0], x1: x, ...low } : { x0: x, x1: BARD.walls[1], ...low }]
  }
  if (piece === 'chest') return [{ x0: (e.ai.tx as number) - BARD.box / 2, x1: (e.ai.tx as number) + BARD.box / 2, ...low }]
  return bardBags(e).flatMap(x => column(m, x - BARD.bagW / 2, x + BARD.bagW / 2, 1))
}

function offStage(e: Enemy) {
  e.x = OFF
  e.y = OFF
}
function inPiece(e: Enemy, x: number = BARD_SET[bardPiece(e)].x, floor: number = BARD_SET[bardPiece(e)].floor) {
  e.x = x
  e.y = floor - e.r
}
function set(e: Enemy, mode: string, t: number) {
  e.ai.mode = mode
  e.ai.t = t
  e.ai.tell = mode === 'tell' ? t : 0
}

function open(e: Enemy) {
  set(e, 'open', BARD.open)
  e.ai.took = 0
  e.invuln = 0
}

export function bard(c: Ctx, e: Enemy, dt: number) {
  const ai = e.ai
  const h = c.s.hero
  const m = c.s.map
  switch (ai.mode) {
    // The first step after the card and its line: the clock starts.
    case 'idle':
      ai.piece = PIECES[Math.floor(rnd(c.s) * PIECES.length)]!
      set(e, 'hide', BARD.first)
      offStage(e)
      return
    case 'hide': {
      offStage(e)
      if (ai.t > 0) return
      const piece = bardPiece(e)
      set(e, 'tell', piece === 'rope' ? BARD.ropeTell : BARD.tell)
      inPiece(e)
      // Where the blow goes is settled now, and stencilled.
      const door = BARD_SET.door.x
      ai.way = Math.abs(h.x - door) <= 1.5 || h.x < door ? -1 : 1
      ai.tx = Math.max(BARD.leapMin, Math.min(BARD.leapMax, h.x))
      const bags = bagMiddles(h.x)
      ai.c0 = bags[0]!
      ai.c1 = bags[1]!
      ai.c2 = bags[2]!
      e.dir = h.x < e.x ? 'left' : 'right'
      c.ev.push({ type: 'roar', x: BARD_SET[piece].x, y: BARD_SET[piece].floor - 1 })
      return
    }
    case 'tell': {
      if (ai.t > 0) return
      const piece = bardPiece(e)
      set(e, 'blow', piece === 'chest' ? BARD.leap : piece === 'rope' ? BARD.drop : 2)
      if (piece === 'door') e.dir = (ai.way as number) < 0 ? 'left' : 'right'
      return
    }
    case 'blow': {
      const piece = bardPiece(e)
      const boxes = bardBoxes(m, e)
      // (A blow throws him toward the middle of the room, never out by the stair behind him.)
      const hit = () => hurtHero(c, BARD.dmg, h.x + (h.x < BARD_SET.door.x ? -0.5 : 0.5), h.y, false, true)
      if (piece === 'door') {
        const way = ai.way as number
        const end = way < 0 ? BARD.walls[0] + e.r : BARD.walls[1] - e.r
        e.x = way < 0 ? Math.max(end, e.x - BARD.speed * dt) : Math.min(end, e.x + BARD.speed * dt)
        // The door itself, as it passes: in the band, and where it has got to.
        if (inBoxes(boxes, h.x, h.y) && Math.abs(h.x - e.x) <= e.r) hit()
        if (e.x === end) { c.s.shake = Math.max(c.s.shake, 0.2); c.ev.push({ type: 'land' }); open(e) }
        return
      }
      if (piece === 'chest') {
        const from = BARD_SET.chest.x
        const p = Math.max(0, Math.min(1, 1 - ai.t / BARD.leap))
        e.x = from + ((ai.tx as number) - from) * p
        e.y = BARD.floor - e.r - BARD.arc * 4 * p * (1 - p)
        if (ai.t > 0) return
        inPiece(e, ai.tx as number, BARD.floor)
        c.s.shake = Math.max(c.s.shake, 0.25)
        c.ev.push({ type: 'land' })
        // Whoever stands on the floor in the box: not one in the air, nor on the ledge.
        if (h.side?.ground && Math.abs(h.y + HERO_R - BARD.floor) < 0.1 && inBoxes(boxes, h.x, h.y)) hit()
        open(e)
        return
      }
      // The bags: BARD stays at the rope.
      if (inBoxes(boxes, h.x, h.y)) hit()
      if (ai.t <= 0) { c.ev.push({ type: 'land' }); open(e) }
      return
    }
    case 'open':
      // With all taken it shakes itself shut, a moment after the last blow shows.
      if (took(e) >= BARD.take) ai.t = Math.min(ai.t, 0.3)
      if (ai.t > 0) return
      set(e, 'wings', BARD.wings)
      offStage(e)
      // Another piece, unseen.
      ai.next = PIECES.filter(p => p !== bardPiece(e))[Math.floor(rnd(c.s) * (PIECES.length - 1))]!
      return
    case 'wings':
      offStage(e)
      if (ai.t > 0) return
      ai.piece = ai.next as BardPiece
      set(e, 'hide', BARD.hide)
      return
  }
}
