import type { Buddy, Cage, ChapterId, Guard, Input, Leech, Player, World } from '../types'
import { killGuard } from './actors'
import { emit, hasFlag, setFlag } from './util'

// The five chapters as authored data plus a small script each. Coordinates
// are world px, y down; the shore's ground line is y 420. Reach, for
// authoring: a running jump rises ~168 and spans ~200; a standing hop rises
// ~86; the figure can pull itself onto a ledge whose top is up to ~70 above
// its feet at the top of a jump, so ~230 above the ground it jumped from.

export const GROUND = 420

export const CHAPTERS: Record<ChapterId, { title: string; roman: string }> = {
  1: { title: 'The pool', roman: 'I' },
  2: { title: 'The beast', roman: 'II' },
  3: { title: 'The cage', roman: 'III' },
  4: { title: 'The hall', roman: 'IV' },
  5: { title: 'The lamp', roman: 'V' },
}

/** Where the chase starts, and where the beast is stopped (chapter II). */
export const CHASE_X = 1880
export const CAPTURE_X = 4230
/** The cage (chapter III). */
export const CAGE_PIVOT = { x: 560, y: 36, rope: 200 }
const CAGE_BREAK = 0.62
const CAGE_H = 84

function newPlayer(x: number, y: number): Player {
  return {
    x, y, vx: 0, vy: 0, grounded: true, facing: 1, hop: false, landT: 0, crouching: false,
    kickT: 0, mantle: null, swimming: false, hasGun: false, holdT: 0, shotT: 0, gunCool: 0, stride: 0,
  }
}

function emptyWorld(chapter: ChapterId): World {
  return {
    chapter, width: 4000, groundY: GROUND, camTop: -1200, killY: 900,
    palette: 'dusk', scenery: 'shore',
    player: newPlayer(80, GROUND),
    platforms: [], water: [], hazards: [], actors: [], shots: [], shields: [], lamps: [], items: [],
    lifts: [], props: [], cage: null,
    checkpoint: -1, time: 0, dying: null, flags: [], timers: {}, exit: false, exitCut: null, hint: null,
    events: [], dawn: false, nextId: 1,
  }
}

// ---- authoring helpers ----

function ground(w: World, x: number, width: number, top = GROUND): void {
  w.platforms.push({ x, y: top, w: width, h: 900 - top, kind: 'ground' })
}
function block(w: World, x: number, top: number, width: number, base = GROUND, kind: 'rock' | 'ledge' = 'rock'): void {
  w.platforms.push({ x, y: top, w: width, h: base - top, kind })
}
function slab(w: World, x: number, top: number, width: number, h = 124): void {
  w.platforms.push({ x, y: top, w: width, h, kind: 'slab' })
}
function lamp(w: World, x: number, y: number, final = false): void {
  w.lamps.push({ x, y, lit: false, final })
}
function leech(w: World, x: number, y: number, minX: number, maxX: number, hanging = false): void {
  const a: Leech = { kind: 'leech', id: w.nextId++, x, y, dir: -1, state: hanging ? 'hang' : 'crawl', vy: 0, minX, maxX, t: 0 }
  w.actors.push(a)
}
function guard(w: World, x: number, y: number, facing: number, opts: Partial<Guard> = {}): Guard {
  const g: Guard = {
    kind: 'guard', id: w.nextId++, x, y, facing, state: 'idle', goalX: x,
    fireT: 0.9, shieldT: 0, alertT: 0, crouch: false, crouchT: 0, t: 0,
    range: 380, shieldHp: 2, fireEvery: 1.35, ...opts,
  }
  w.actors.push(g)
  return g
}
function buddy(w: World, x: number, y: number, state: Buddy['state']): Buddy {
  const b: Buddy = { kind: 'buddy', id: w.nextId++, x, y, facing: 1, state, goalX: x, t: 0 }
  w.actors.push(b)
  return b
}

// ---- I · the pool ----

function buildPool(w: World): void {
  w.width = 3900
  w.palette = 'dusk'
  w.scenery = 'shore'
  // The pool: a rock wall on the left, water down to a floor, the bank on the right.
  w.platforms.push({ x: -60, y: 360, w: 120, h: 540, kind: 'rock' })
  w.water.push({ x: 60, w: 400, y: 444, bottom: 700 })
  w.platforms.push({ x: 60, y: 700, w: 400, h: 200, kind: 'rock' })
  w.hazards.push({ kind: 'tentacles', x: 60, w: 400, tip: 700, floor: 700, delay: 3.2, t: 0, active: false })
  w.props.push({ kind: 'wreck', x: 300, y: 700, w: 150, h: 40 })
  w.player = newPlayer(210, 690)
  w.player.grounded = false
  w.player.swimming = true
  w.hint = 'swim'

  // The shore: flat, a leech, a low rock; the beast watches from the ridge.
  ground(w, 460, 700)
  leech(w, 840, GROUND, 720, 960)
  block(w, 1010, 394, 40)
  w.props.push({ kind: 'ridgeBeast', x: 1320, y: 0, w: 0, h: 0 })
  // gap 1160–1250
  ground(w, 1250, 550)
  lamp(w, 1420, GROUND)
  // An overhang with two leeches hanging under it: keep running.
  w.platforms.push({ x: 1500, y: 236, w: 200, h: 64, kind: 'rock' })
  w.props.push({ kind: 'overhang', x: 1480, y: 236, w: 240, h: 64 })
  leech(w, 1552, 300, 0, 0, true)
  leech(w, 1648, 300, 0, 0, true)
  // gap 1800–1900, then a shelf to climb.
  ground(w, 1900, 700)
  block(w, 2150, 292, 250, GROUND, 'ledge')
  // The tide slab.
  // gap 2600–2700
  slab(w, 2700, 436, 200)
  w.hazards.push({ kind: 'tide', x: 2710, y: 436 - 44, w: 180, h: 44, period: 4, phase: 1.5 })
  // gap 2900–3000
  ground(w, 3000, 900)
  lamp(w, 3150, GROUND)
  leech(w, 3440, GROUND, 3300, 3620)
}

// ---- II · the beast ----

function buildBeast(w: World): void {
  w.width = 4700
  w.palette = 'night'
  w.scenery = 'causeway'
  ground(w, 0, 520)
  w.props.push({ kind: 'arch', x: 360, y: 250, w: 180, h: 0 })
  // gap 520–620
  ground(w, 620, 300)
  // gap 920–1030
  slab(w, 1030, 436, 200)
  w.hazards.push({ kind: 'tide', x: 1040, y: 436 - 44, w: 180, h: 44, period: 4, phase: 0.4 })
  // gap 1230–1330
  ground(w, 1330, 520)
  w.props.push({ kind: 'arch', x: 1520, y: 250, w: 180, h: 0 })
  lamp(w, 1760, GROUND)
  // The chase course.
  // gap 1850–1940
  ground(w, 1940, 400)
  block(w, 2150, 392, 40)
  // gap 2340–2450
  ground(w, 2450, 300)
  leech(w, 2640, GROUND, 2520, 2720)
  // gap 2750–2850
  ground(w, 2850, 600)
  block(w, 3100, 352, 350, GROUND, 'ledge')
  // gap 3450–3570
  ground(w, 3570, 450)
  block(w, 3800, 392, 40)
  // the last gap, 4020–4180, wide
  ground(w, 4180, 520)
  w.actors.push({ kind: 'beast', id: w.nextId++, x: -400, y: GROUND, state: 'hidden', speed: 0, t: 0 })
}

// ---- III · the cage ----

function buildCage(w: World): void {
  w.width = 2300
  w.palette = 'hall'
  w.scenery = 'hall'
  w.platforms.push({ x: -60, y: 0, w: 60, h: 900, kind: 'wall' })
  w.platforms.push({ x: 0, y: GROUND, w: 2300, h: 480, kind: 'floor' })
  w.props.push({ kind: 'vent', x: 150, y: GROUND, w: 44, h: 60 })
  w.props.push({ kind: 'doorway', x: 1560, y: GROUND, w: 70, h: 120 })
  for (const x of [260, 900, 1300, 1900]) w.props.push({ kind: 'window', x, y: 110, w: 90, h: 200 })
  for (const x of [420, 1100, 1750, 2150]) w.props.push({ kind: 'pillar', x, y: 0, w: 46, h: GROUND })
  const cage: Cage = {
    pivotX: CAGE_PIVOT.x, pivotY: CAGE_PIVOT.y, rope: CAGE_PIVOT.rope,
    theta: 0.04, omega: 0, state: 'hang', x: CAGE_PIVOT.x, y: CAGE_PIVOT.y + CAGE_PIVOT.rope,
    vx: 0, vy: 0, lastPump: 0, t: 0,
  }
  w.cage = cage
  w.player = newPlayer(CAGE_PIVOT.x - 12, cage.y + CAGE_H - 2)
  w.hint = 'swing'
  buddy(w, CAGE_PIVOT.x + 14, cage.y + CAGE_H - 2, 'caged')
  guard(w, 700, GROUND, -1, { range: 0 })
  lamp(w, 790, GROUND)
}

// ---- IV · the hall ----

function buildHall(w: World): void {
  w.width = 3600
  w.palette = 'hall'
  w.scenery = 'hall'
  w.platforms.push({ x: -60, y: 0, w: 60, h: 900, kind: 'wall' })
  // Lower corridor.
  w.platforms.push({ x: 0, y: GROUND, w: 2300, h: 480, kind: 'floor' })
  for (const x of [240, 1000, 1880]) w.props.push({ kind: 'window', x, y: 110, w: 90, h: 200 })
  for (const x of [560, 1240, 2080]) w.props.push({ kind: 'pillar', x, y: 0, w: 46, h: GROUND })
  guard(w, 760, GROUND, -1)
  lamp(w, 1020, GROUND)
  // The blast door under a low ceiling: only a beam opens it.
  w.platforms.push({ x: 1300, y: 60, w: 400, h: 200, kind: 'wall' })
  w.platforms.push({ x: 1450, y: 260, w: 26, h: 160, kind: 'door', id: 'blast-1' })
  guard(w, 1620, GROUND, -1, { fireEvery: 1.2 })
  // The shaft: the upper floor is out of reach until the lift comes down.
  w.platforms.push({ x: 2300, y: 170, w: 1300, h: 730, kind: 'wall' })
  w.platforms.push({ x: 2180, y: 170, w: 110, h: 16, kind: 'lift', id: 'lift-1' })
  w.lifts.push({ id: 'lift-1', x: 2180, w: 110, y: 170, yTop: 170, yBottom: GROUND, state: 'up', t: 0 })
  buddy(w, 2420, 170, 'hidden')
  // Upper floor.
  for (const x of [2620, 3260]) w.props.push({ kind: 'window', x, y: -130, w: 90, h: 200 })
  w.props.push({ kind: 'pillar', x: 2940, y: -240, w: 46, h: 410 })
  lamp(w, 2470, 170)
  guard(w, 2900, 170, -1, { fireEvery: 1.15 })
  guard(w, 3300, 170, -1, { fireEvery: 1.3, shieldHp: 3 })
  w.props.push({ kind: 'doorway', x: 3520, y: 170, w: 70, h: 120 })
}

// ---- V · the lamp ----

function buildTower(w: World): void {
  w.width = 2620
  w.palette = 'storm'
  w.scenery = 'tower'
  ground(w, 0, 700)
  leech(w, 520, GROUND, 380, 660)
  block(w, 700, 300, 200, 900, 'ledge')
  block(w, 980, 190, 180, 900, 'ledge')
  block(w, 1220, 90, 280, 900, 'ledge')
  // A rock comes down out of the storm; grit trickles where it will land.
  w.hazards.push({
    kind: 'rockfall', x: 1372, y: 90 - 40, w: 52, h: 40,
    triggerX: 1236, triggerW: 40, top: -440, vy: 0, state: 'hanging',
  })
  lamp(w, 1450, 90)
  block(w, 1580, -20, 200, 900, 'ledge')
  guard(w, 1730, -20, -1, { range: 380, fireEvery: 1.4 })
  block(w, 1840, -130, 210, 900, 'ledge')
  leech(w, 1960, -130, 1880, 2030)
  lamp(w, 1880, -130)
  block(w, 2100, -240, 520, 900, 'ledge')
  guard(w, 2330, -240, -1, { shieldHp: 3, fireEvery: 1.05 })
  lamp(w, 2520, -240, true)
  w.props.push({ kind: 'lampTower', x: 2520, y: -240, w: 60, h: 220 })
}

const BUILDERS: Record<ChapterId, (w: World) => void> = {
  1: buildPool, 2: buildBeast, 3: buildCage, 4: buildHall, 5: buildTower,
}

/**
 * A chapter, fresh, or picked up at a lamp: lamps up to the checkpoint are
 * lit, the figure stands at the last one, and whatever it had already
 * passed (guards, hanging rocks) is gone or down.
 */
export function buildChapter(chapter: ChapterId, checkpoint = -1, hasGun = false): World {
  const w = emptyWorld(chapter)
  BUILDERS[chapter](w)
  w.player.hasGun = hasGun || chapter >= 4
  if (checkpoint >= 0 && checkpoint < w.lamps.length) {
    const lp = w.lamps[checkpoint]
    for (let i = 0; i <= checkpoint; i++) w.lamps[i].lit = true
    w.checkpoint = checkpoint
    const p = newPlayer(lp.x, lp.y)
    p.hasGun = w.player.hasGun
    w.player = p
    w.hint = null
    for (const hz of w.hazards) {
      if (hz.kind === 'rockfall' && hz.triggerX < lp.x) {
        hz.state = 'landed'
        hz.top = hz.y
        w.platforms.push({ x: hz.x, y: hz.y, w: hz.w, h: hz.h, kind: 'rock' })
      }
    }
    w.actors = w.actors.filter(a => !((a.kind === 'guard' || a.kind === 'leech') && a.x < lp.x - 40))
    if (chapter === 3) afterCage(w, true)
    if (chapter === 4 && checkpoint >= 1) {
      const lift = w.lifts[0]
      lift.state = 'up'
      setFlag(w, 'lift')
    }
  }
  return w
}

// ---- scripts ----

function stepCage(w: World, input: Input, h: number): void {
  const c = w.cage!
  const p = w.player
  c.t += h
  if (c.state === 'hang') {
    // Push in the direction it is already swinging; that is all a pump is.
    const d = (input.right ? 1 : 0) - (input.left ? 1 : 0)
    let pump = 0
    if (d !== 0 && Math.sign(c.omega) === d) pump = 1.15 * d
    if (d !== 0 && c.omega === 0) pump = 1.2 * d
    const prevOmega = c.omega
    c.omega += (-12.2 * Math.sin(c.theta) - 0.28 * c.omega + pump) * h
    c.theta += c.omega * h
    if (d !== 0) p.facing = d
    // A creak at each turn once it swings for real.
    if (Math.sign(prevOmega) !== Math.sign(c.omega) && Math.abs(c.theta) > 0.22) emit(w, { type: 'cageCreak' })
    if (c.theta > CAGE_BREAK && c.omega > 0) {
      c.state = 'fall'
      c.vx = c.rope * c.omega * Math.cos(c.theta) * 0.25
      c.vy = 0
      w.hint = null
      emit(w, { type: 'cageSnap' })
    }
    c.x = c.pivotX + Math.sin(c.theta) * c.rope
    c.y = c.pivotY + Math.cos(c.theta) * c.rope
  } else if (c.state === 'fall') {
    c.vy += 2100 * h
    c.x += c.vx * h
    c.y += c.vy * h
    c.theta *= Math.max(0, 1 - 3 * h)
    if (c.y + CAGE_H >= GROUND) {
      c.y = GROUND - CAGE_H
      c.state = 'down'
      c.theta = 0.18
      emit(w, { type: 'cageCrash' })
      for (const a of w.actors) {
        if (a.kind === 'guard' && a.state !== 'dead' && a.state !== 'dying' && Math.abs(a.x - c.x) < 70) {
          a.carriesGun = true
          killGuard(w, a)
        }
      }
      afterCage(w, false)
      return
    }
  }
  // Riders sit on the cage floor.
  p.x = c.x - 12
  p.y = c.y + CAGE_H - 2
  for (const a of w.actors) if (a.kind === 'buddy' && a.state === 'caged') { a.x = c.x + 14; a.y = p.y }
}

/** The cage is down: the figure is out, the friend leaves; on a respawn, the guard's already dead. */
function afterCage(w: World, respawn: boolean): void {
  const c = w.cage!
  c.state = 'down'
  if (respawn) {
    c.x = 676
    c.y = GROUND - CAGE_H
    c.theta = 0.18
    for (const a of w.actors) {
      if (a.kind === 'guard') { a.state = 'dead'; a.t = 5 }
      if (a.kind === 'buddy') a.state = 'gone'
    }
    setFlag(w, 'free')
    setFlag(w, 'armed')
    w.hint = null
    w.player.hasGun = true
    return
  }
  const p = w.player
  p.x = c.x - 30
  p.y = GROUND
  p.grounded = true
  p.vx = 0
  p.vy = 0
  p.facing = 1
  p.landT = 0.5
  for (const a of w.actors) {
    if (a.kind === 'buddy') {
      a.state = 'stand'
      a.x = c.x + 26
      a.y = GROUND
      a.t = 0
      a.facing = -1
    }
  }
  setFlag(w, 'free')
}

function scriptPool(w: World): void {
  const p = w.player
  if (w.hint === 'swim' && !p.swimming && p.grounded) w.hint = null
  if (!hasFlag(w, 'kickHint') && !p.swimming && p.x > 620) {
    setFlag(w, 'kickHint')
    w.hint = 'kick'
  }
  if (w.hint === 'kick' && p.x > 1000) w.hint = null
  if (p.x > w.width - 20) w.exit = true
}

function scriptBeast(w: World): void {
  const p = w.player
  const beast = w.actors.find(a => a.kind === 'beast')
  if (beast && beast.kind === 'beast' && beast.state === 'hidden' && p.x > CHASE_X && p.grounded) {
    beast.state = 'chase'
    beast.x = p.x - 600
    beast.t = 0
    emit(w, { type: 'beastRoar' })
  }
  if (p.x > CAPTURE_X && p.grounded && !w.dying) {
    w.exit = true
    w.exitCut = 'capture'
  }
}

function scriptCageRoom(w: World, h: number): void {
  const p = w.player
  const friend = w.actors.find((a): a is Buddy => a.kind === 'buddy')
  if (friend && hasFlag(w, 'free')) {
    friend.t += h
    if (friend.state === 'stand' && friend.t > 0.9) {
      friend.state = 'point'
      friend.t = 0
      emit(w, { type: 'buddy' })
    } else if (friend.state === 'point' && friend.t > 1.1) {
      friend.state = 'run'
      friend.goalX = 172
      friend.facing = -1
      friend.t = 0
    } else if (friend.state === 'run') {
      friend.x = Math.max(friend.goalX, friend.x - 230 * h)
      if (friend.x <= friend.goalX) friend.state = 'gone'
    }
  }
  if (p.hasGun && !hasFlag(w, 'armed')) {
    setFlag(w, 'armed')
    const lp = w.lamps[0]
    if (lp && !lp.lit) {
      lp.lit = true
      w.checkpoint = 0
      emit(w, { type: 'lamp', final: false })
    }
  }
  if (hasFlag(w, 'armed') && !hasFlag(w, 'second')) {
    w.timers.armed = (w.timers.armed ?? 0) + h
    if (w.timers.armed >= 1.4) {
      setFlag(w, 'second')
      const g = guard(w, 1595, GROUND, -1, { state: 'walk', goalX: 1260, fireEvery: 1.6, fireT: 1.2 })
      g.facing = -1
    }
  }
  if (w.hint === 'gun' && hasFlag(w, 'second') && w.actors.every(a => a.kind !== 'guard' || a.state === 'dead' || a.state === 'dying')) w.hint = null
  if (p.x > w.width - 20) w.exit = true
}

function scriptHall(w: World, h: number): void {
  const p = w.player
  const lift = w.lifts[0]
  const friend = w.actors.find((a): a is Buddy => a.kind === 'buddy')
  if (lift && !hasFlag(w, 'lift') && p.x > 1980 && p.y > 300) {
    setFlag(w, 'lift')
    lift.state = 'lowering'
    emit(w, { type: 'lift' })
    emit(w, { type: 'buddy' })
    if (friend) { friend.state = 'crank'; friend.x = 2340; friend.y = 170; friend.facing = -1; friend.t = 0 }
  }
  if (lift && lift.state === 'down' && lift.t > 0.45) {
    lift.state = 'rising'
    emit(w, { type: 'lift' })
  }
  if (friend && friend.state === 'crank' && lift?.state === 'up' && hasFlag(w, 'lift') && p.y < 200) {
    friend.state = 'run'
    friend.goalX = 3560
    friend.facing = 1
  }
  if (friend && friend.state === 'run') {
    friend.x = Math.min(friend.goalX, friend.x + 240 * h)
    if (friend.x >= friend.goalX) friend.state = 'gone'
  }
  if (p.x > w.width - 20) w.exit = true
}


/** Lightning strikes on a fixed rhythm; the renderer flashes on the same clock. */
export const LIGHTNING_PERIOD = 6.3
export const LIGHTNING_FRAME = 0.06

function scriptTower(w: World, h: number): void {
  const n = Math.floor(w.time / LIGHTNING_PERIOD)
  if (!w.dawn && n > 0 && (w.timers.thunder ?? 0) !== n) {
    w.timers.thunder = n
    emit(w, { type: 'thunder' })
  }
  const last = w.lamps[w.lamps.length - 1]
  if (last?.lit && !w.dawn) {
    w.dawn = true
    w.palette = 'dawn'
  }
  if (w.dawn) {
    w.timers.dawn = (w.timers.dawn ?? 0) + h
    if (w.timers.dawn >= 1.6 && !w.exit) {
      w.exit = true
      w.exitCut = 'ending'
    }
    // Guards fall still at dawn; the ending belongs to the cut.
    for (const a of w.actors) if (a.kind === 'guard' && a.state === 'alert') a.fireT = 99
    w.shots = w.shots.filter(s => s.owner !== 'guard')
  }
}

/** The chapter's own story, after the figure and the actors have moved. */
export function stepScript(w: World, input: Input, h: number): void {
  switch (w.chapter) {
    case 1: scriptPool(w); break
    case 2: scriptBeast(w); break
    case 3:
      if (w.cage && w.cage.state !== 'down') stepCage(w, input, h)
      scriptCageRoom(w, h)
      break
    case 4: scriptHall(w, h); break
    case 5: scriptTower(w, h); break
  }
}

/** True while the chapter script owns the figure (the cage swinging). */
export function scriptOwnsPlayer(w: World): boolean {
  return w.chapter === 3 && !!w.cage && w.cage.state !== 'down'
}
