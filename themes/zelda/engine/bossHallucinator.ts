/**
 * THE HALLUCINATOR (`EnemyKind` 'hallucinator', the boss of Act Three, docs/worlds/act-three.md): three bodies, one
 * real. The first of the kind in its room is the real one and carries the hit points and the fight's whole state; the
 * shuffle moves where it stands. A round: the SHUFFLE (the three glide to new slots, through one another in the
 * middle, so that no eye can follow one), the CLAIM (two of them point at the third, which is never the real one),
 * the BLOWS (crates, stencilled on the floor before they fall), the BOW (all three; then the OPEN, which the painter
 * says with a gold rail along the ceiling). Only in the open does the blade hurt the real body, and a cut pops a
 * false one. Its touch never hurts; only a stencilled crate does (`halluBoxes`). From half its hit points the
 * shuffle swaps twice, a round has a wave more and painted crates fall among the real ones, with no stencil.
 *
 * The bar over each body lies (`halluShown`): a quarter-rounded quote at each shuffle, less a twelfth for every blow
 * that did nothing. The plate on the floor (`HALLU.plate`) holds the glass up for the rest of a round's blows.
 * The arena's floor, walls and slots are fixed numbers here: the room of the brief.
 */
import type { Enemy, MapState } from '../types'
import { HERO_R } from '../types'
import { hurtHero, type Ctx, type HitOpts } from './combat'
import { LENS } from './lens'
import { inBoxes, type Box } from './sandbag'
import { rnd } from './util'

export const HALLU = {
  /** Seconds: a shuffle of one swap and of two, the claim; a wave's tell, fall and the breath after it. */
  shuffle: 1.4, shuffleHalf: 2, claim: 1.6, tell: 1.1, fall: 0.2, gap: 0.9,
  waves: 3, wavesHalf: 4,
  /** The bow's dark start, then the opening; and what is left of an opening that has given all it gives. */
  quiet: 0.8, open: 2, openHalf: 1.8, shut: 0.3,
  /** What one opening gives the blade, whatever the blade; and the hit points from which it is halved. */
  take: 4, half: 6,
  dmg: 2,
  /** The arena: the slots' middles (x), the height of a body's middle, the floor's top row and the open floor (x). */
  slots: [2.8, 7.2, 11.6], y: 10.8, floor: 12, walls: [1, 13],
  /** A crate's stencil: tiles wide, how far aside the second one is, and its height over the floor. */
  box: 2, aside: 4, band: 0.9,
  /** A landed crate: seconds it lies and fades, and how wide it is drawn (tiles). */
  lie: 1.2, fade: 0.4, crate: 1.5,
  /** The glass's switch on the floor (x). */
  plate: [6.5, 8.5],
  /** Seconds the real body shows a hurt, and a popped one fades. */
  hurt: 0.45, pop: 0.5,
} as const

/** Behind the set: where a popped body is kept until the next shuffle. */
const OFF = -30

/** The bodies of the room `e` is in, the real one first. */
export const halluBodies = (m: Pick<MapState, 'enemies'>, cell?: number): Enemy[] =>
  m.enemies.filter(e => e.kind === 'hallucinator' && (cell === undefined || e.cell === cell))

export const halluPopped = (e: Enemy) => typeof e.ai.pop === 'number'
const took = (e: Enemy) => (e.ai.took as number | undefined) ?? 0
const half = (lead: Enemy) => lead.hp <= HALLU.half
/** Open: the real body, in the opening, with this opening still to give. (A false one never is.) */
export const halluOpen = (e: Enemy) => !e.dead && e.ai.mode === 'open' && took(e) < HALLU.take

/** The bar's quote of the truth, in twelfths: what is left, rounded up to a quarter. */
const quote = (e: Enemy) => Math.ceil((Math.max(0, e.hp) / e.maxHp) * 4 - 1e-9) * 3
/** What the white bar shows, 0..1. */
export const halluShown = (lead: Enemy) => ((lead.ai.shown as number | undefined) ?? quote(lead)) / 12

/** The crates of the wave under way: the stencilled ones' middles, and the painted ones'. */
const pick = (e: Enemy, keys: string[]) => keys.map(k => e.ai[k]).filter((v): v is number => typeof v === 'number')
export const halluAims = (lead: Enemy) => (lead.ai.mode === 'blows' ? pick(lead, ['c0', 'c1']) : [])
export const halluPaint = (lead: Enemy) => (lead.ai.mode === 'blows' ? pick(lead, ['p0', 'p1']) : [])
/** The crates lying: the real ones, the painted ones, and how long since they landed. */
export const halluLain = (lead: Enemy) => {
  const t = (lead.ai.down as number | undefined) ?? -1
  return t < 0 || t >= HALLU.lie + HALLU.fade ? null : { t, real: pick(lead, ['l0', 'l1']), painted: pick(lead, ['q0', 'q1']) }
}

/** What the crates on their way will hit: the stencil, and the hurt boxes. */
export function halluBoxes(lead: Enemy): Box[] {
  if (lead.dead || ((lead.ai.wt as number | undefined) ?? 0) >= HALLU.tell + HALLU.fall) return []
  return halluAims(lead).map(x => ({ x0: x - HALLU.box / 2, x1: x + HALLU.box / 2, y0: HALLU.floor - HALLU.band, y1: HALLU.floor }))
}

// ---------------------------------------------------------------------------
// The blade
// ---------------------------------------------------------------------------

/** A blow that did nothing: the same clank and white spark on every body, and a notch off the lying bar. */
function nothing(c: Ctx, e: Enemy, lead: Enemy) {
  lead.ai.shown = Math.max(1, Math.round(halluShown(lead) * 12) - 1)
  c.ev.push({ type: 'clank', x: e.x, y: e.y, white: true })
}

/**
 * What a blow takes now: the most it may, or null (nothing happens to the body: a clank, or in the opening a false
 * body pops). `blade`: the hero's blade or the echo's; nothing else ever hurts or pops one.
 */
export function halluRule(c: Ctx, e: Enemy, blade: boolean): number | null {
  const lead = halluBodies(c.s.map, e.cell)[0]!
  if (blade && lead.ai.mode === 'open') {
    if (e === lead) {
      if (took(lead) < HALLU.take) return HALLU.take - took(lead)
    } else {
      // A cut that finds nothing there. (Not a death: it is back at the next shuffle.)
      lead.ai.shown = Math.max(1, Math.round(halluShown(lead) * 12) - 1)
      e.ai.pop = 0
      e.ai.gx = e.x
      e.ai.gy = e.y
      c.ev.push({ type: 'puff', x: e.x, y: e.y })
      e.x = OFF
      return null
    }
  }
  nothing(c, e, lead)
  return null
}

/** The mercy a blow leaves behind: short after a hit of the chain, so that the whole chain counts. */
export function halluMercy(e: Enemy, echo: boolean, opt?: HitOpts) {
  const mercy = opt?.chain ? 0.1 : 0.28
  if (echo) e.echoInvuln = mercy
  else e.invuln = mercy
}

/** After a blow that bit: it stays where it stands, shows the hurt, and at half the fight turns. */
export function halluStruck(c: Ctx, e: Enemy, echo: boolean, opt?: HitOpts) {
  e.knock = null
  halluMercy(e, echo, opt)
  e.ai.hurt = HALLU.hurt
  if (e.dead || !half(e) || e.ai.phase === 2) return
  e.ai.phase = 2
  c.ev.push({ type: 'bossPhase', phase: 2 })
  c.ev.push({ type: 'hitStop', ms: 120 })
  c.s.shake = 0.4
}

/** The real one has fallen: the other two go with it, all three popping at once (the painter's white puffs). */
export function halluFall(c: Ctx, e: Enemy) {
  for (const o of halluBodies(c.s.map, e.cell)) {
    if (o !== e && !o.dead) { o.dead = true; c.ev.push({ type: 'puff', x: o.x, y: o.y }) }
    // (No flat white pop of the kit's: it would stand frozen behind the room's line.)
    o.deathT = 1
  }
}

// ---------------------------------------------------------------------------
// The round
// ---------------------------------------------------------------------------

function set(e: Enemy, mode: string, t: number) {
  e.ai.mode = mode
  e.ai.t = t
}

/** One swap: new slots for all three, with the real one never back in the slot the shuffle began from. */
function swap(c: Ctx, all: Enemy[], seconds: number) {
  const lead = all[0]!
  const now = all.map(b => (b.ai.slot as number | undefined) ?? -1)
  const was = lead.ai.was as number
  const orders = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]]
    .filter(o => o[0] !== was && o.some((v, i) => v !== now[i]))
  const to = orders[Math.floor(rnd(c.s) * orders.length)]!
  all.forEach((b, i) => {
    b.ai.slot = to[i]!
    b.ai.fx = b.x
    b.ai.fy = b.y
  })
  lead.ai.span = seconds
  lead.ai.t = seconds
}

function shuffle(c: Ctx, all: Enemy[]) {
  const lead = all[0]!
  for (const b of all) {
    if (!halluPopped(b)) continue
    b.x = b.ai.gx as number
    b.y = b.ai.gy as number
    delete b.ai.pop
  }
  lead.ai.shown = quote(lead)
  lead.ai.hurt = 0
  // The plate is ready again.
  lead.ai.plate = 0
  lead.ai.was = (lead.ai.slot as number | undefined) ?? -1
  lead.ai.swaps = half(lead) ? 2 : 1
  lead.ai.mode = 'shuffle'
  swap(c, all, half(lead) ? HALLU.shuffleHalf / 2 : HALLU.shuffle)
}

const ease = (p: number) => p * p * (3 - 2 * p)
/** On their way: to the middle of the room, all three on one spot, and out again to their slots. */
function glide(h: { x: number }, all: Enemy[]) {
  const lead = all[0]!
  const p = Math.max(0, Math.min(1, 1 - lead.ai.t / (lead.ai.span as number)))
  const mid = { x: HALLU.slots[1], y: HALLU.y }
  for (const b of all) {
    const [from, to, k] = p < 0.5
      ? [{ x: b.ai.fx as number, y: b.ai.fy as number }, mid, ease(p * 2)]
      : [mid, { x: HALLU.slots[b.ai.slot as number]!, y: HALLU.y }, ease(p * 2 - 1)]
    b.x = from.x + (to.x - from.x) * k
    b.y = from.y + (to.y - from.y) * k
    b.dir = h.x < b.x ? 'left' : 'right'
  }
}

/**
 * Where two painted crates come down: anywhere clear of the stencils and of each other. (Not under the false bodies:
 * that would say which they are.)
 */
function paintedAt(c: Ctx, aims: number[]): number[] {
  const out: number[] = []
  for (let n = 0; n < 2; n++) {
    const free: number[] = []
    for (let x = HALLU.walls[0] + 1; x <= HALLU.walls[1] - 1 + 1e-9; x += 0.25) {
      if (aims.every(a => Math.abs(a - x) >= (HALLU.box + HALLU.crate) / 2) && out.every(o => Math.abs(o - x) >= HALLU.crate)) free.push(x)
    }
    if (free.length) out.push(free[Math.floor(rnd(c.s) * free.length)]!)
  }
  return out
}

/** A wave begins: the stencils are settled now, one on the hero and one aside, toward the side with more room. */
function wave(c: Ctx, lead: Enemy) {
  const ai = lead.ai
  const first = Math.max(HALLU.walls[0] + 1, Math.min(HALLU.walls[1] - 1, c.s.hero.x))
  const second = first + (first < (HALLU.walls[0] + HALLU.walls[1]) / 2 ? HALLU.aside : -HALLU.aside)
  ai.c0 = first
  ai.c1 = second
  delete ai.p0
  delete ai.p1
  if (ai.painted) paintedAt(c, [first, second]).forEach((x, i) => { ai[`p${i}`] = x })
  ai.wt = 0
}

/** The crates come down: whoever stands on the floor under a stencil is hit, and they lie where they fell. */
function land(c: Ctx, lead: Enemy) {
  const h = c.s.hero
  const boxes = halluAims(lead).map(x => ({ x0: x - HALLU.box / 2, x1: x + HALLU.box / 2, y0: HALLU.floor - HALLU.band, y1: HALLU.floor }))
  c.s.shake = Math.max(c.s.shake, 0.15)
  c.ev.push({ type: 'land' })
  const ai = lead.ai
  ai.down = 0
  ai.l0 = ai.c0!
  ai.l1 = ai.c1!
  delete ai.q0
  delete ai.q1
  halluPaint(lead).forEach((x, i) => { ai[`q${i}`] = x })
  // (A blow throws him toward the middle of the room, never out by the stair.)
  if (h.side?.ground && Math.abs(h.y + HERO_R - HALLU.floor) < 0.1 && inBoxes(boxes, h.x, h.y)) {
    hurtHero(c, HALLU.dmg, h.x + (h.x < HALLU.slots[1] ? -0.5 : 0.5), h.y, false, true)
  }
}

/** The switch: stepped on while it is ready, it holds the glass up until the round's blows are over. */
function plate(c: Ctx, lead: Enemy, dt: number) {
  const ai = lead.ai
  const h = c.s.hero
  const on = !!h.side?.ground && Math.abs(h.y + HERO_R - HALLU.floor) < 0.1 && h.x >= HALLU.plate[0] && h.x <= HALLU.plate[1]
  if (on && !ai.plate && (ai.mode === 'shuffle' || ai.mode === 'claim' || ai.mode === 'blows')) {
    ai.plate = 1
    c.ev.push({ type: 'lens' })
  }
  const was = (ai.glass as number | undefined) ?? 0
  ai.glass = ai.plate === 1 ? Math.min(1, was + dt / LENS.show) : Math.max(0, was - dt / LENS.back)
}

/** One step: the first body of the room runs the whole fight; the others are moved by it. */
export function hallucinator(c: Ctx, e: Enemy, dt: number) {
  const all = halluBodies(c.s.map, e.cell)
  if (all[0] !== e) return
  const ai = e.ai
  if ((ai.hurt as number) > 0) ai.hurt = (ai.hurt as number) - dt
  if (typeof ai.down === 'number' && ai.down >= 0) ai.down += dt
  for (const b of all) if (halluPopped(b)) b.ai.pop = (b.ai.pop as number) + dt
  if (ai.mode !== 'idle') plate(c, e, dt)
  switch (ai.mode) {
    // The first step in the room (after its card's line, if that has just been said): round one.
    // (A hero who stepped out and back finds it as wounded as he left it: the three bodies share the hit points, and the second half follows from them.)
    case 'idle':
      for (const b of all) b.hp = e.hp
      if (half(e)) e.ai.phase = 2
      shuffle(c, all)
      return
    case 'shuffle': {
      glide(c.s.hero, all)
      if (ai.t > 0) return
      ai.swaps = (ai.swaps as number) - 1
      if ((ai.swaps as number) > 0) { swap(c, all, HALLU.shuffleHalf / 2); return }
      set(e, 'claim', HALLU.claim)
      // One of the false ones is claimed: the other two turn and point at it.
      ai.claimed = 1 + Math.floor(rnd(c.s) * (all.length - 1))
      const at = all[ai.claimed as number]!
      for (const b of all) b.dir = (b === at ? c.s.hero.x : at.x) < b.x ? 'left' : 'right'
      c.ev.push({ type: 'roar', x: at.x, y: at.y })
      return
    }
    case 'claim':
      if (ai.t > 0) return
      for (const b of all) if (!halluPopped(b)) b.dir = c.s.hero.x < b.x ? 'left' : 'right'
      ai.painted = half(e)
      ai.waves = half(e) ? HALLU.wavesHalf : HALLU.waves
      ai.wave = 1
      set(e, 'blows', (HALLU.tell + HALLU.fall + HALLU.gap) * (ai.waves as number))
      wave(c, e)
      return
    case 'blows': {
      const was = ai.wt as number
      const now = ai.wt = was + dt
      const lands = HALLU.tell + HALLU.fall
      if (was < lands - 1e-9 && now >= lands - 1e-9) land(c, e)
      if (now < lands + HALLU.gap - 1e-9) return
      if ((ai.wave as number) < (ai.waves as number)) { ai.wave = (ai.wave as number) + 1; wave(c, e); return }
      set(e, 'bow', HALLU.quiet)
      if (ai.plate === 1) ai.plate = 2
      return
    }
    case 'bow':
      if (ai.t > 0) return
      set(e, 'open', half(e) ? HALLU.openHalf : HALLU.open)
      ai.took = 0
      e.invuln = 0
      return
    case 'open':
      // With all taken it shuts, a moment after the last blow shows.
      if (took(e) >= HALLU.take) ai.t = Math.min(ai.t, HALLU.shut)
      if (ai.t > 0) return
      shuffle(c, all)
      return
  }
}
