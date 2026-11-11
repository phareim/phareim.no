/**
 * INVASIVE (Invaders Mk II): the rules. Pure: no DOM, no canvas, no clock of
 * its own, so `tests/invasive-engine.test.mjs` plays whole runs in node.
 *
 * The sky is one organism. A grid of cells (`cols` × `rows`, row 0 at the
 * top, row `rows - 1` just above the roofs) holds its tissue: a ceiling of
 * flesh with a heart in it, and tendrils that grow from the ceiling down to
 * the town, one cell per heartbeat. Tissue lives only while it is joined to
 * a heart (4-connected). Shoot a cell out of a tendril and everything that
 * hung from it is severed and dies in a cascade; kill the last heart and the
 * whole layer goes. A tendril that reaches a roof roots there and puts the
 * house's windows out one by one. No lives: the run ends when every house
 * is dark.
 *
 * Units: cells. The cannon's `x` is a cell coordinate (cell c spans
 * [c, c + 1)); things below the grid (bolts leaving the cannon, spores and
 * motes falling past the roofs) have `y` > `rows`. Time is seconds.
 */

export type Rng = () => number

/** mulberry32: a small seeded generator. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------- constants

export const EMPTY = 0
/** The ceiling. Heals. */
export const FLESH = 1
/** A tendril's body. */
export const STEM = 2
/** A tendril's growing end. */
export const TIP = 3
/** A swelling on a tendril that drops spores. */
export const POD = 4
export const HEART = 5
/** A tendril end that has taken hold of a roof. */
export const ROOT = 6

/** Windows per house. */
export const WINDOWS = 4
/** House width in cells. */
export const HOUSE_W = 5
/** Seconds between bolts while fire is held. */
export const FIRE_INTERVAL = 0.13
/** Cells per second. */
export const BOLT_SPEED = 80
/** On the keys, on a field 32 cells wide; a wider field is crossed in the same time. */
export const CANNON_SPEED = 26
/** Where things below the grid sit, in rows under the last sky row. */
export const MUZZLE_DY = 1.5
export const CANNON_DY = 2.6
export const FLOOR_DY = 4.2
/** Seconds the lance burns once full. */
export const LANCE_TIME = 3.2
const LANCE_TICK = 0.045
/** Cells the lance eats per tick. */
const LANCE_BITE = 4
export const STUN_TIME = 1.1
const STUN_GRACE = 0.9
const SPORE_SPEED = 13
const MAX_MOTES = 48
const BPM_MAX = 176
const RAGE_BEATS = 220

export interface Species {
  name: string
  /** Heart rate with no tendrils out, and what each tendril cell adds. */
  bpm: number
  bpmGain: number
  /** Chance per beat that a tip grows a cell (before the field's reach). */
  grow: number
  /** Chance that a growing tip starts a sideways run. */
  side: number
  branch: number
  pod: number
  /** Beats between a pod's spores. */
  sporeEvery: number
  maxTips: number
  /** Chance per beat of a new tendril while under `maxTips`. */
  bud: number
  /** Chance per beat that a hole in the ceiling closes. */
  heal: number
  /** Lance ticks a heart takes. Bolts do not hurt it. */
  heartHp: number
  /** Beats between the heart's steps sideways; 0 = it stays. */
  heartMove: number
  /** Beats until a stem hardens to two hits; 0 = never. */
  bark: number
  hearts: number
  startTips: number
  /** Root-beats per window. */
  drain: number
  /** Motes that fill the lance, on a field 32 cells wide (see `chargeNeeded`). */
  charge: number
}

/** The five species, one per layer; the cycle repeats harder. */
export const SPECIES: readonly Species[] = [
  { name: 'MOSS', bpm: 76, bpmGain: 0.2, grow: 0.7, side: 0.24, branch: 0.06, pod: 0.025, sporeEvery: 8, maxTips: 6, bud: 0.6, heal: 0.3, heartHp: 18, heartMove: 0, bark: 0, hearts: 1, startTips: 4, drain: 6, charge: 18 },
  { name: 'VINE', bpm: 84, bpmGain: 0.22, grow: 0.8, side: 0.4, branch: 0.12, pod: 0.02, sporeEvery: 8, maxTips: 8, bud: 0.7, heal: 0.3, heartHp: 22, heartMove: 5, bark: 0, hearts: 1, startTips: 5, drain: 5, charge: 22 },
  { name: 'CORAL', bpm: 80, bpmGain: 0.2, grow: 0.7, side: 0.3, branch: 0.08, pod: 0.06, sporeEvery: 6, maxTips: 7, bud: 0.6, heal: 0.4, heartHp: 26, heartMove: 0, bark: 4, hearts: 1, startTips: 5, drain: 5, charge: 24 },
  { name: 'MYCEL', bpm: 88, bpmGain: 0.22, grow: 0.75, side: 0.3, branch: 0.1, pod: 0.04, sporeEvery: 7, maxTips: 9, bud: 0.8, heal: 0.35, heartHp: 18, heartMove: 6, bark: 0, hearts: 2, startTips: 6, drain: 4, charge: 28 },
  { name: 'CROWN', bpm: 90, bpmGain: 0.22, grow: 0.76, side: 0.35, branch: 0.12, pod: 0.05, sporeEvery: 6, maxTips: 10, bud: 0.9, heal: 0.45, heartHp: 22, heartMove: 4, bark: 6, hearts: 2, startTips: 6, drain: 4, charge: 30 },
]

/** The species of a layer (1-based), with the cycle's tier added. */
export function speciesFor(layer: number): Species {
  const base = SPECIES[(layer - 1) % SPECIES.length]!
  const tier = Math.floor((layer - 1) / SPECIES.length)
  if (!tier) return base
  // Every cycle is a step up.
  return {
    ...base,
    bpm: Math.round(base.bpm * (1 + 0.14 * tier)),
    grow: Math.min(0.97, base.grow + 0.07 * tier),
    heartHp: base.heartHp + 6 * tier,
    maxTips: base.maxTips + 2 * tier,
    drain: Math.max(2, base.drain - tier),
    charge: base.charge + 4 * tier,
  }
}

// ---------------------------------------------------------------- state

export interface Tip { x: number; y: number; run: number; sdir: number; len: number; creep: boolean }
export interface Heart { x: number; y: number; hp: number; maxHp: number; alive: boolean; dir: number }
export interface House { x0: number; x1: number; lights: number; drain: number; roots: number }
export interface Bolt { col: number; y: number }
export interface Spore { x: number; y: number }
export interface Mote { x: number; y: number; vx: number; vy: number }

export type GameEvent =
  | { t: 'shot' }
  | { t: 'pop'; x: number; y: number; kind: number; chain: number; severed: boolean }
  | { t: 'clank'; x: number; y: number }
  | { t: 'sever'; x: number; y: number; n: number; score: number }
  | { t: 'beat'; n: number }
  | { t: 'heartHit'; x: number; y: number }
  | { t: 'heartDown'; x: number; y: number; last: boolean }
  | { t: 'latch'; house: number }
  | { t: 'window'; house: number; lights: number }
  | { t: 'relight' }
  | { t: 'spore'; x: number; y: number }
  | { t: 'sporePop'; x: number; y: number }
  | { t: 'stun' }
  | { t: 'mote' }
  | { t: 'lance'; on: boolean }
  | { t: 'layer'; n: number }
  | { t: 'over' }

export type Phase = 'descend' | 'play' | 'collapse' | 'between' | 'over'

export interface Input {
  /** -1, 0 or 1: keys. */
  move: number
  /** A cell coordinate the cannon jumps to (touch, mouse), or null. */
  target: number | null
  fire: boolean
}

export interface Game {
  cols: number
  rows: number
  /** Rows of ceiling. */
  body: number
  /** A size asked for mid-run; taken at the next layer. */
  nextCols: number
  nextRows: number
  rng: Rng
  kind: Uint8Array
  hp: Uint8Array
  /** The beat a cell was born on. */
  birth: Uint16Array
  /** Steps to the nearest heart; -1 = cut off. */
  dist: Int16Array
  /** When a severed cell pops; 0 = alive. */
  dieAt: Float32Array
  dying: number[]
  queue: Int32Array
  scratch: Int16Array
  tips: Tip[]
  hearts: Heart[]
  houses: House[]
  cannon: { x: number; stun: number; grace: number }
  bolts: Bolt[]
  spores: Spore[]
  motes: Mote[]
  charge: number
  lance: number
  lanceAcc: number
  /** Row the lance beam stops at this frame (-1 = the top). */
  beamTop: number
  fireAcc: number
  score: number
  layer: number
  species: Species
  phase: Phase
  phaseT: number
  demo: boolean
  over: boolean
  time: number
  beats: number
  beatT: number
  beatInterval: number
  /** Tendril cells alive at the last beat. */
  tendrils: number
  chain: number
  dirty: boolean
  cutX: number
  cutY: number
  /** The longest cut of the run. */
  bestCut: number
  events: GameEvent[]
  ai: { col: number; until: number }
}

export interface GameOptions { cols: number; rows: number; rng?: Rng }

const DESCEND_TIME = 1.6
const BETWEEN_TIME = 2.4

export function bodyRows(rows: number): number {
  return Math.max(5, Math.min(8, Math.round(rows * 0.17)))
}

/**
 * How angry the heart is, 0–1: it climbs for as long as a layer is left
 * alive (full after `RAGE_BEATS`). It beats faster and sends more tendrils,
 * so holding the line is not enough: the heart has to die.
 */
export function rage(g: Game): number {
  return Math.min(1, g.beats / RAGE_BEATS)
}

/** Motes that fill the lance: a wider field sheds more of them, so it asks for more. */
export function chargeNeeded(g: Game): number {
  return Math.max(6, Math.round(g.species.charge * g.cols / 32))
}

/** A wider field carries more tendrils: the same number per roof. */
function tipLimit(g: Game): number {
  return Math.max(3, Math.round(g.species.maxTips * (1 + rage(g)) * g.cols / 32))
}

/** How fast tendrils must be to cross a field this tall in about the same time. */
function reach(g: Game): number {
  return Math.max(0.45, Math.min(1.15, (g.rows - g.body) / 38))
}

function alloc(g: Game, cols: number, rows: number) {
  g.cols = cols
  g.rows = rows
  g.body = bodyRows(rows)
  const n = cols * rows
  g.kind = new Uint8Array(n)
  g.hp = new Uint8Array(n)
  g.birth = new Uint16Array(n)
  g.dist = new Int16Array(n)
  g.dieAt = new Float32Array(n)
  g.queue = new Int32Array(n)
  g.scratch = new Int16Array(n)
}

function layoutHouses(cols: number, old: House[] | null): House[] {
  const n = cols >= 47 ? 6 : cols >= 36 ? 5 : cols >= 25 ? 4 : 3
  const gap = (cols - n * HOUSE_W) / (n + 1)
  const out: House[] = []
  for (let i = 0; i < n; i++) {
    const x0 = Math.round(gap * (i + 1) + HOUSE_W * i)
    out.push({ x0, x1: x0 + HOUSE_W - 1, lights: old?.[i]?.lights ?? WINDOWS, drain: 0, roots: 0 })
  }
  // A narrower field has fewer houses: keep the windows that were lit.
  if (old && old.length > n) {
    let spare = 0
    for (let i = n; i < old.length; i++) spare += old[i]!.lights
    for (const h of out) { const add = Math.min(WINDOWS - h.lights, spare); h.lights += add; spare -= add }
  }
  return out
}

export function createGame(o: GameOptions): Game {
  const g = {
    nextCols: o.cols, nextRows: o.rows,
    rng: o.rng ?? Math.random,
    dying: [], tips: [], hearts: [], houses: [],
    cannon: { x: o.cols / 2, stun: 0, grace: 0 },
    bolts: [], spores: [], motes: [],
    charge: 0, lance: 0, lanceAcc: 0, beamTop: -1, fireAcc: 0,
    score: 0, layer: 1, species: SPECIES[0]!,
    phase: 'descend', phaseT: 0, demo: true, over: false,
    time: 0, beats: 0, beatT: 0, beatInterval: 1, tendrils: 0,
    chain: 0, dirty: false, cutX: 0, cutY: 0, bestCut: 0,
    events: [], ai: { col: -1, until: 0 },
  } as unknown as Game
  alloc(g, o.cols, o.rows)
  g.houses = layoutHouses(g.cols, null)
  buildLayer(g)
  return g
}

/** Ask for another field size; a run takes it at its next layer, the demo at once. */
export function setField(g: Game, cols: number, rows: number) {
  g.nextCols = cols
  g.nextRows = rows
  if (g.demo && (cols !== g.cols || rows !== g.rows)) startDemo(g)
}

function reset(g: Game, demo: boolean) {
  g.demo = demo
  g.over = false
  g.score = 0
  g.layer = 1
  g.charge = 0
  g.lance = 0
  g.bestCut = 0
  g.time = 0
  g.bolts = []
  g.spores = []
  g.motes = []
  g.events = []
  g.houses = []
  g.cannon.stun = 0
  g.cannon.grace = 0
  buildLayer(g)
  g.cannon.x = g.cols / 2
}

export function startDemo(g: Game) { reset(g, true) }
export function startRun(g: Game) { reset(g, false) }

/** A new ceiling for `g.layer`: flesh, hearts, the first tendrils. */
export function buildLayer(g: Game) {
  if (g.nextCols !== g.cols || g.nextRows !== g.rows || !g.houses.length) {
    const old = g.houses.length ? g.houses : null
    if (g.nextCols !== g.cols || g.nextRows !== g.rows) alloc(g, g.nextCols, g.nextRows)
    g.houses = layoutHouses(g.cols, old)
    g.cannon.x = Math.max(0.5, Math.min(g.cols - 0.5, g.cannon.x))
    g.bolts = []
    g.spores = []
    g.motes = []
  }
  const sp = g.species = speciesFor(g.layer)
  g.kind.fill(EMPTY)
  g.hp.fill(0)
  g.dieAt.fill(0)
  g.birth.fill(0)
  g.dying = []
  g.tips = []
  g.hearts = []
  g.beats = 0
  g.beatT = 0
  g.chain = 0
  g.dirty = false
  g.tendrils = 0
  g.beatInterval = 60 / sp.bpm
  g.charge = 0
  g.lance = 0
  for (const h of g.houses) { h.drain = 0; h.roots = 0 }
  for (let y = 0; y < g.body; y++) for (let x = 0; x < g.cols; x++) {
    const i = y * g.cols + x
    g.kind[i] = FLESH
    g.hp[i] = 1
  }
  // The underside is ragged: here and there the flesh hangs a cell lower.
  if (g.body < g.rows - 4) {
    let run = 0
    for (let x = 0; x < g.cols; x++) {
      if (run > 0) run--
      else if (g.rng() < 0.22) run = 1 + Math.floor(g.rng() * 3)
      else continue
      const i = g.body * g.cols + x
      g.kind[i] = FLESH
      g.hp[i] = 1
    }
  }
  const hy = Math.max(1, g.body - 4)
  for (let h = 0; h < sp.hearts; h++) {
    const span = g.cols - 6
    const hx = sp.hearts === 1
      ? 3 + Math.floor(span * (0.3 + g.rng() * 0.4))
      : 3 + Math.floor(span * (h === 0 ? 0.08 + g.rng() * 0.3 : 0.62 + g.rng() * 0.3))
    const heart: Heart = { x: hx, y: hy, hp: sp.heartHp, maxHp: sp.heartHp, alive: true, dir: g.rng() < 0.5 ? -1 : 1 }
    g.hearts.push(heart)
    stampHeart(g, heart)
  }
  flood(g, g.dist, -1)
  for (let i = 0; i < Math.round(sp.startTips * g.cols / 32); i++) bud(g)
  g.phase = 'descend'
  g.phaseT = 0
  g.events.push({ t: 'layer', n: g.layer })
}

function stampHeart(g: Game, h: Heart) {
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = h.x + dx
    const y = h.y + dy
    if (x < 0 || y < 0 || x >= g.cols || y >= g.body) continue
    const i = y * g.cols + x
    if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue
    g.kind[i] = HEART
    g.hp[i] = 1
    g.dieAt[i] = 0
  }
}

// ---------------------------------------------------------------- connectivity

/**
 * Steps from the nearest live heart into `dist` (-1 where no heart is
 * reached), walking live tissue. `skip` is a cell treated as gone (the
 * autopilot asks what a cut would sever). Returns the cells reached.
 */
export function flood(g: Game, dist: Int16Array, skip: number): number {
  const { cols, rows, kind, dieAt, queue } = g
  dist.fill(-1)
  let head = 0
  let tail = 0
  for (const h of g.hearts) {
    if (!h.alive) continue
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = h.x + dx
      const y = h.y + dy
      if (x < 0 || y < 0 || x >= cols || y >= rows) continue
      const i = y * cols + x
      if (kind[i] !== HEART || dist[i] !== -1 || i === skip) continue
      dist[i] = 0
      queue[tail++] = i
    }
  }
  while (head < tail) {
    const i = queue[head++]!
    const d = dist[i]! + 1
    const x = i % cols
    const y = (i - x) / cols
    if (x > 0) { const j = i - 1; if (kind[j] && dist[j] === -1 && !dieAt[j] && j !== skip) { dist[j] = d; queue[tail++] = j } }
    if (x < cols - 1) { const j = i + 1; if (kind[j] && dist[j] === -1 && !dieAt[j] && j !== skip) { dist[j] = d; queue[tail++] = j } }
    if (y > 0) { const j = i - cols; if (kind[j] && dist[j] === -1 && !dieAt[j] && j !== skip) { dist[j] = d; queue[tail++] = j } }
    if (y < rows - 1) { const j = i + cols; if (kind[j] && dist[j] === -1 && !dieAt[j] && j !== skip) { dist[j] = d; queue[tail++] = j } }
  }
  return tail
}

/** Live tissue cells. */
export function tissue(g: Game): number {
  let n = 0
  for (let i = 0; i < g.kind.length; i++) if (g.kind[i] && !g.dieAt[i]) n++
  return n
}

/** What shooting out cell `i` would sever: the cells that would lose their heart. */
export function cutValue(g: Game, i: number): { n: number; roots: number } {
  const before = tissue(g)
  const reached = flood(g, g.scratch, i)
  let roots = 0
  for (let j = 0; j < g.kind.length; j++) if (g.kind[j] === ROOT && !g.dieAt[j] && g.scratch[j] === -1 && j !== i) roots++
  return { n: Math.max(0, before - 1 - reached), roots }
}

/** After a cut: everything that lost its heart starts to die, rippling out from the cut. */
function sever(g: Game) {
  g.dirty = false
  flood(g, g.dist, -1)
  let n = 0
  for (let i = 0; i < g.kind.length; i++) {
    if (!g.kind[i] || g.dieAt[i] || g.dist[i] !== -1) continue
    const x = i % g.cols
    const y = (i - x) / g.cols
    const d = Math.abs(x - g.cutX) + Math.abs(y - g.cutY)
    g.dieAt[i] = g.time + 0.05 + Math.min(1.5, d * 0.03)
    g.dying.push(i)
    n++
  }
  if (!n) return
  dropDeadTips(g)
  const score = n * (2 + Math.floor(n / 8))
  g.score += score
  if (n > g.bestCut) g.bestCut = n
  g.events.push({ t: 'sever', x: g.cutX, y: g.cutY, n, score })
}

function dropDeadTips(g: Game) {
  g.tips = g.tips.filter(t => {
    const i = t.y * g.cols + t.x
    return g.kind[i] === TIP && !g.dieAt[i]
  })
}

// ---------------------------------------------------------------- damage

function removeCell(g: Game, i: number) {
  g.kind[i] = EMPTY
  g.hp[i] = 0
  g.dieAt[i] = 0
}

/** A bolt (`lance` false) or the lance lands on cell `i`. Only the lance hurts a heart. */
function hitCell(g: Game, i: number, dmg: number, lance = false) {
  const x = i % g.cols
  const y = (i - x) / g.cols
  const k = g.kind[i]!
  if (k === HEART) {
    const h = g.hearts.find(q => q.alive && Math.abs(q.x - x) <= 1 && Math.abs(q.y - y) <= 1)
    if (!h) { removeCell(g, i); return }
    if (!lance) { g.events.push({ t: 'clank', x, y }); return }
    h.hp -= dmg
    g.events.push({ t: 'heartHit', x: h.x, y: h.y })
    if (h.hp <= 0) killHeart(g, h)
    return
  }
  // The top row is the organism's back, and it goes on above the screen:
  // nothing cuts it, so the ceiling cannot be shot in two.
  if (y === 0 && k === FLESH && !g.dieAt[i]) {
    g.events.push({ t: 'clank', x, y })
    return
  }
  if (g.dieAt[i]) {
    // Already dying: it just goes a moment sooner.
    g.dieAt[i] = g.time
    return
  }
  if (g.hp[i]! > dmg) {
    g.hp[i] = g.hp[i]! - dmg
    g.events.push({ t: 'clank', x, y })
    return
  }
  removeCell(g, i)
  g.score += 1
  g.events.push({ t: 'pop', x, y, kind: k, chain: 0, severed: false })
  if (k === TIP) dropDeadTips(g)
  g.dirty = true
  g.cutX = x
  g.cutY = y
}

function killHeart(g: Game, h: Heart) {
  h.alive = false
  h.hp = 0
  const last = !g.hearts.some(q => q.alive)
  g.score += 500 * g.layer
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const x = h.x + dx
    const y = h.y + dy
    if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) continue
    const i = y * g.cols + x
    if (g.kind[i] === HEART) removeCell(g, i)
  }
  g.events.push({ t: 'heartDown', x: h.x, y: h.y, last })
  if (!last) {
    g.dirty = true
    g.cutX = h.x
    g.cutY = h.y
    return
  }
  // The last heart: the whole layer dies, rippling out from where it was.
  g.dirty = false
  g.tips = []
  let n = 0
  for (let i = 0; i < g.kind.length; i++) {
    if (!g.kind[i]) continue
    const x = i % g.cols
    const y = (i - x) / g.cols
    const d = Math.abs(x - h.x) + Math.abs(y - h.y)
    const at = g.time + 0.3 + d * 0.02
    if (!g.dieAt[i]) { g.dying.push(i); n++ }
    g.dieAt[i] = at
  }
  g.score += n
  g.lance = 0
  g.phase = 'collapse'
  g.phaseT = 0
}

// ---------------------------------------------------------------- the beat

function isFree(g: Game, x: number, y: number, fromI: number): boolean {
  if (x < 0 || y < 0 || x >= g.cols || y >= g.rows) return false
  const i = y * g.cols + x
  if (g.kind[i]) return false
  // A tendril keeps a cell of air round itself, so it stays a thread.
  if (x > 0 && g.kind[i - 1] && i - 1 !== fromI) return false
  if (x < g.cols - 1 && g.kind[i + 1] && i + 1 !== fromI) return false
  if (y > 0 && g.kind[i - g.cols] && i - g.cols !== fromI) return false
  if (y < g.rows - 1 && g.kind[i + g.cols] && i + g.cols !== fromI) return false
  return true
}

function setCell(g: Game, x: number, y: number, kind: number) {
  const i = y * g.cols + x
  g.kind[i] = kind
  g.hp[i] = 1
  g.birth[i] = g.beats
  g.dieAt[i] = 0
}

/**
 * A new tendril: half the time a shoot from a stem that is already there (a
 * cut stump grows back), otherwise from the underside of the ceiling.
 */
function bud(g: Game): boolean {
  const y = g.body
  if (y >= g.rows - 1) return false
  if (g.rng() < 0.5 && sprout(g)) return true
  return budCeiling(g) || sprout(g)
}

function sprout(g: Game): boolean {
  const span = (g.rows - 1 - g.body) * g.cols
  for (let tries = 0; tries < 40; tries++) {
    const i = g.body * g.cols + Math.floor(g.rng() * span)
    if (g.kind[i] !== STEM || g.dieAt[i] || g.dist[i] === -1) continue
    const x = i % g.cols
    const sy = (i - x) / g.cols
    const d = g.rng() < 0.5 ? -1 : 1
    const spots: [number, number][] = [[x, sy + 1], [x + d, sy], [x - d, sy]]
    for (const [nx, ny] of spots) {
      if (!isFree(g, nx, ny, i)) continue
      setCell(g, nx, ny, TIP)
      g.tips.push({ x: nx, y: ny, run: nx === x ? 0 : 1 + Math.floor(g.rng() * 3), sdir: nx - x, len: 1, creep: false })
      return true
    }
  }
  return false
}

function budCeiling(g: Game): boolean {
  for (let tries = 0; tries < 8; tries++) {
    const x = 1 + Math.floor(g.rng() * (g.cols - 2))
    // Under the lowest flesh in the column.
    const y = g.kind[g.body * g.cols + x] === FLESH ? g.body + 1 : g.body
    const above = (y - 1) * g.cols + x
    if (g.kind[above] !== FLESH || g.dieAt[above] || g.dist[above] === -1) continue
    if (!isFree(g, x, y, above) || g.kind[(y + 1) * g.cols + x]) continue
    setCell(g, x, y, TIP)
    g.tips.push({ x, y, run: 0, sdir: 0, len: 1, creep: false })
    return true
  }
  return false
}

/** The lit house nearest to column `x`, or -1. */
function nearestLit(g: Game, x: number): number {
  let best = -1
  let bd = 1e9
  for (let h = 0; h < g.houses.length; h++) {
    const H = g.houses[h]!
    if (H.lights <= 0) continue
    const d = x < H.x0 ? H.x0 - x : x > H.x1 ? x - H.x1 : 0
    if (d < bd) { bd = d; best = h }
  }
  return best
}

function moveTip(g: Game, t: Tip, nx: number, ny: number) {
  g.kind[t.y * g.cols + t.x] = STEM
  setCell(g, nx, ny, TIP)
  t.x = nx
  t.y = ny
  t.len++
}

function growTip(g: Game, t: Tip, sp: Species): boolean {
  const from = t.y * g.cols + t.x
  if (t.creep) {
    // Along the roofline to the nearest lit house, then it takes hold.
    const h = nearestLit(g, t.x)
    if (h < 0) return true
    const H = g.houses[h]!
    if (t.x >= H.x0 && t.x <= H.x1) {
      g.kind[from] = ROOT
      g.hp[from] = 2
      g.events.push({ t: 'latch', house: h })
      return false
    }
    // Tissue in the way is its own: it runs through it and comes out the other side.
    const d = t.x < H.x0 ? 1 : -1
    let nx = t.x + d
    while (nx >= 0 && nx < g.cols && g.kind[t.y * g.cols + nx]) {
      if (nx >= H.x0 && nx <= H.x1) {
        const j = t.y * g.cols + nx
        g.kind[from] = STEM
        if (g.kind[j] !== ROOT) { g.kind[j] = ROOT; g.hp[j] = 2; g.events.push({ t: 'latch', house: h }) }
        return false
      }
      nx += d
    }
    if (nx < 0 || nx >= g.cols) { g.kind[from] = STEM; return false }
    moveTip(g, t, nx, t.y)
    return true
  }
  if (t.y >= g.rows - 1) { t.creep = true; return true }
  const ox = t.x
  const oy = t.y
  let moved = false
  if (t.run <= 0 && g.rng() < sp.side) {
    const h = nearestLit(g, t.x)
    const toward = h < 0 ? 0 : Math.sign((g.houses[h]!.x0 + g.houses[h]!.x1) / 2 - t.x)
    t.sdir = toward && g.rng() < 0.6 ? toward : g.rng() < 0.5 ? -1 : 1
    t.run = 1 + Math.floor(g.rng() * 4)
  }
  if (t.run > 0) {
    if (isFree(g, t.x + t.sdir, t.y, from)) { moveTip(g, t, t.x + t.sdir, t.y); t.run--; moved = true } else t.run = 0
  }
  if (!moved) {
    if (isFree(g, t.x, t.y + 1, from)) { moveTip(g, t, t.x, t.y + 1); moved = true } else {
      const d = g.rng() < 0.5 ? -1 : 1
      if (isFree(g, t.x + d, t.y, from)) { moveTip(g, t, t.x + d, t.y); moved = true } else if (isFree(g, t.x - d, t.y, from)) { moveTip(g, t, t.x - d, t.y); moved = true }
    }
  }
  if (!moved) { g.kind[from] = STEM; return false } // a dead end
  if (t.len >= 4 && g.tips.length < tipLimit(g) && g.rng() < sp.branch) {
    const d = g.rng() < 0.5 ? -1 : 1
    const oi = oy * g.cols + ox
    if (isFree(g, ox + d, oy, oi)) {
      setCell(g, ox + d, oy, TIP)
      g.tips.push({ x: ox + d, y: oy, run: 1 + Math.floor(g.rng() * 3), sdir: d, len: 1, creep: false })
    }
  } else if (t.len >= 5 && g.rng() < sp.pod) {
    const oi = oy * g.cols + ox
    g.kind[oi] = POD
    g.hp[oi] = 2
    g.birth[oi] = g.beats
  }
  return true
}

function moveHearts(g: Game, sp: Species) {
  if (!sp.heartMove || g.beats % sp.heartMove) return
  for (const h of g.hearts) {
    if (!h.alive) continue
    // Under fire (a hole in the flesh below it) it backs away from the cannon.
    let open = false
    for (let dx = -1; dx <= 1 && !open; dx++) for (let y = h.y + 2; y < g.body; y++) if (!g.kind[y * g.cols + h.x + dx]) { open = true; break }
    if (open) h.dir = g.cannon.x < h.x + 0.5 ? 1 : -1
    else if (g.rng() < 0.25) h.dir = -h.dir
    let nx = h.x + h.dir
    if (nx < 2 || nx > g.cols - 3) { h.dir = -h.dir; nx = h.x + h.dir }
    if (g.hearts.some(o => o !== h && o.alive && Math.abs(o.x - nx) < 6)) { h.dir = -h.dir; continue }
    // The column it leaves turns to flesh; the one it enters becomes heart.
    const leave = h.x - h.dir
    for (let dy = -1; dy <= 1; dy++) setCell(g, leave, h.y + dy, FLESH)
    h.x = nx
    stampHeart(g, h)
    g.dirty = true
    g.cutX = h.x
    g.cutY = h.y
  }
}

function beat(g: Game) {
  const sp = g.species
  g.beats++
  const { cols, rows, kind, dieAt, dist } = g
  moveHearts(g, sp)
  // Tendrils grow.
  const p = sp.grow * reach(g)
  const tips = g.tips
  g.tips = []
  for (const t of tips) {
    const i = t.y * cols + t.x
    if (kind[i] !== TIP || dieAt[i]) continue
    if (g.rng() >= p || growTip(g, t, sp)) g.tips.push(t)
  }
  if (g.tips.length < tipLimit(g) && g.rng() < sp.bud * Math.max(1, g.cols / 32)) bud(g)
  // The ceiling closes its wounds; pods drop spores; stems harden.
  const healed: number[] = []
  let tendrils = 0
  for (let i = 0; i < kind.length; i++) {
    const k = kind[i]!
    const x = i % cols
    const y = (i - x) / cols
    if (!k) {
      if (y >= g.body) continue
      const fed = (x > 0 && isBody(g, i - 1)) || (x < cols - 1 && isBody(g, i + 1)) || (y > 0 && isBody(g, i - cols)) || (y < g.body - 1 && isBody(g, i + cols))
      if (fed && g.rng() < sp.heal) healed.push(i)
      continue
    }
    if (dieAt[i] || k === FLESH || k === HEART) continue
    tendrils++
    const age = g.beats - g.birth[i]!
    if (k === POD && dist[i] !== -1 && age > 0 && age % sp.sporeEvery === 0 && g.spores.length < 24) {
      g.spores.push({ x: x + 0.5, y: y + 1 })
      g.events.push({ t: 'spore', x, y })
    } else if (k === STEM && sp.bark && g.hp[i] === 1 && age >= sp.bark) {
      g.hp[i] = 2
    }
  }
  for (const i of healed) {
    const x = i % cols
    const y = (i - x) / cols
    setCell(g, x, y, FLESH)
  }
  if (healed.length) g.dirty = true
  // Roots drink the windows.
  const bottom = (rows - 1) * cols
  for (let h = 0; h < g.houses.length; h++) {
    const H = g.houses[h]!
    let roots = 0
    for (let x = H.x0; x <= H.x1; x++) if (kind[bottom + x] === ROOT && !dieAt[bottom + x]) roots++
    H.roots = roots
    if (!roots || H.lights <= 0) { if (!roots) H.drain = 0; continue }
    H.drain += Math.min(3, roots)
    if (H.drain < sp.drain) continue
    H.drain = 0
    H.lights--
    g.events.push({ t: 'window', house: h, lights: H.lights })
    if (H.lights > 0) continue
    // A dark house feeds nothing: its roots let go and creep on.
    for (let x = H.x0; x <= H.x1; x++) {
      const i = bottom + x
      if (kind[i] !== ROOT || dieAt[i]) continue
      kind[i] = TIP
      g.hp[i] = 1
      g.tips.push({ x, y: rows - 1, run: 0, sdir: 0, len: 9, creep: true })
    }
  }
  g.tendrils = tendrils
  g.beatInterval = 60 / Math.min(BPM_MAX, sp.bpm * (1 + 0.6 * rage(g)) + sp.bpmGain * tendrils)
  g.events.push({ t: 'beat', n: g.beats })
  if (g.houses.every(h => h.lights <= 0)) { if (g.demo) startDemo(g); else endRun(g) }
}

function isBody(g: Game, i: number): boolean {
  const k = g.kind[i]
  return (k === FLESH || k === HEART) && !g.dieAt[i] && g.dist[i] !== -1
}

// ---------------------------------------------------------------- the step

function endRun(g: Game) {
  if (g.over) return
  g.over = true
  g.phase = 'over'
  g.phaseT = 0
  g.lance = 0
  g.events.push({ t: 'over' })
}

/** Ends a run from outside (a held Escape). */
export function quitRun(g: Game) {
  if (g.demo) return
  for (const h of g.houses) h.lights = 0
  endRun(g)
}

/** The row a bolt in column `col` would stop at (the lowest tissue), or -1. */
export function lowestIn(g: Game, col: number): number {
  for (let y = g.rows - 1; y >= 0; y--) if (g.kind[y * g.cols + col]) return y
  return -1
}

function cannonCol(g: Game): number {
  return Math.max(0, Math.min(g.cols - 1, Math.floor(g.cannon.x)))
}

function stepLance(g: Game, dt: number) {
  g.lanceAcc += dt
  const col = cannonCol(g)
  while (g.lanceAcc >= LANCE_TICK) {
    g.lanceAcc -= LANCE_TICK
    let bites = LANCE_BITE
    for (let y = g.rows - 1; y >= 0 && bites > 0 && g.phase === 'play'; y--) {
      const i = y * g.cols + col
      if (!g.kind[i]) continue
      const heart = g.kind[i] === HEART
      hitCell(g, i, heart ? 1 : 9, true)
      bites--
      if (heart) break
    }
  }
  g.beamTop = lowestIn(g, col)
}

function stepBolts(g: Game, dt: number) {
  const live = g.phase === 'play'
  let w = 0
  for (const b of g.bolts) {
    const from = b.y
    b.y -= BOLT_SPEED * dt
    let gone = false
    // Spores in the way.
    for (let s = 0; s < g.spores.length; s++) {
      const sp = g.spores[s]!
      if (Math.abs(sp.x - (b.col + 0.5)) < 0.9 && sp.y <= from + 0.5 && sp.y >= b.y - 0.5) {
        g.events.push({ t: 'sporePop', x: sp.x, y: sp.y })
        g.spores.splice(s, 1)
        g.score += 5
        gone = true
        break
      }
    }
    if (!gone && live) {
      const top = Math.max(0, Math.floor(b.y))
      for (let y = Math.min(g.rows - 1, Math.floor(from)); y >= top; y--) {
        const i = y * g.cols + b.col
        if (!g.kind[i]) continue
        hitCell(g, i, 1)
        gone = true
        break
      }
    }
    if (!gone && b.y > -1) g.bolts[w++] = b
  }
  g.bolts.length = w
}

function stepDying(g: Game) {
  if (!g.dying.length) { g.chain = 0; return }
  let w = 0
  for (const i of g.dying) {
    if (!g.dieAt[i]) continue // already shot away
    if (g.dieAt[i]! > g.time) { g.dying[w++] = i; continue }
    const k = g.kind[i]!
    const x = i % g.cols
    const y = (i - x) / g.cols
    removeCell(g, i)
    g.chain++
    g.events.push({ t: 'pop', x, y, kind: k, chain: g.chain, severed: true })
    const every = g.phase === 'collapse' ? 9 : 4
    if ((k === POD || g.chain % every === 0) && g.motes.length < MAX_MOTES) {
      g.motes.push({ x: x + 0.5, y: y + 0.5, vx: (g.rng() - 0.5) * 3, vy: -2 - g.rng() * 3 })
    }
  }
  g.dying.length = w
}

function stepFalling(g: Game, dt: number) {
  const c = g.cannon
  const cy = g.rows + CANNON_DY
  let w = 0
  for (const s of g.spores) {
    s.y += SPORE_SPEED * dt
    if (s.y >= cy - 0.8 && s.y <= cy + 1 && Math.abs(s.x - c.x) < 1.7 && !g.over) {
      if (c.stun <= 0 && c.grace <= 0) {
        c.stun = STUN_TIME
        g.events.push({ t: 'stun' })
      }
      continue
    }
    if (s.y < g.rows + FLOOR_DY) g.spores[w++] = s
  }
  g.spores.length = w
  w = 0
  for (const m of g.motes) {
    m.vy = Math.min(15, m.vy + 26 * dt)
    // Near the ground they lean toward the cannon.
    const dx = c.x - m.x
    if (m.y > g.rows - 8 && Math.abs(dx) < 6) m.vx += Math.sign(dx) * 40 * dt
    m.vx *= 1 - Math.min(1, 3 * dt)
    m.x += m.vx * dt
    m.y += m.vy * dt
    if (m.y >= cy - 1 && Math.abs(m.x - c.x) < 2.2 && !g.over) {
      g.score += 10
      // The gold rain of a fallen layer is points only: every heart is paid for with its own tendrils.
      if (g.lance <= 0 && g.phase === 'play') g.charge = Math.min(chargeNeeded(g), g.charge + 1)
      g.events.push({ t: 'mote' })
      continue
    }
    if (m.y < g.rows + FLOOR_DY) g.motes[w++] = m
  }
  g.motes.length = w
}

export function stepGame(g: Game, dt: number, input: Input) {
  g.time += dt
  g.phaseT += dt
  const c = g.cannon
  const playing = g.phase !== 'over'
  if (c.stun > 0) {
    c.stun -= dt
    if (c.stun <= 0) c.grace = STUN_GRACE
  } else if (playing) {
    if (c.grace > 0) c.grace -= dt
    if (input.target !== null) c.x = input.target
    else c.x += input.move * CANNON_SPEED * Math.max(1, g.cols / 32) * dt
    c.x = Math.max(0.5, Math.min(g.cols - 0.5, c.x))
  }
  // Fire.
  g.fireAcc -= dt
  g.beamTop = -1
  if (playing && c.stun <= 0) {
    if (g.lance > 0) {
      g.lance -= dt
      stepLance(g, dt)
      if (g.lance <= 0) { g.lance = 0; g.events.push({ t: 'lance', on: false }) }
    } else if (input.fire && g.fireAcc <= 0) {
      g.fireAcc = FIRE_INTERVAL
      g.bolts.push({ col: cannonCol(g), y: g.rows + MUZZLE_DY })
      g.events.push({ t: 'shot' })
    }
  }
  stepBolts(g, dt)
  // The heart beats only while the layer is alive and in place.
  if (g.phase === 'play') {
    g.beatT += dt
    if (g.beatT >= g.beatInterval) {
      g.beatT -= g.beatInterval
      beat(g)
    }
  }
  if (g.dirty && g.phase === 'play') sever(g)
  stepDying(g)
  stepFalling(g, dt)
  if (g.phase === 'play' && g.charge >= chargeNeeded(g) && g.lance <= 0) {
    g.charge = 0
    g.lance = LANCE_TIME
    g.lanceAcc = 0
    g.events.push({ t: 'lance', on: true })
  }
  // Phases.
  if (g.phase === 'descend' && g.phaseT >= DESCEND_TIME) {
    g.phase = 'play'
    g.phaseT = 0
  } else if (g.phase === 'collapse' && !g.dying.length) {
    g.phase = 'between'
    g.phaseT = 0
    // The town gets its breath back: a window in every house.
    for (const h of g.houses) h.lights = Math.min(WINDOWS, h.lights + 1)
    g.events.push({ t: 'relight' })
  } else if (g.phase === 'between' && g.phaseT >= BETWEEN_TIME) {
    g.layer++
    buildLayer(g)
  }
}

/** 0–1: how far the new ceiling still has to come down (1 = just off the top). */
export function descent(g: Game): number {
  if (g.phase !== 'descend') return 0
  const t = 1 - g.phaseT / DESCEND_TIME
  return t * t
}

/** 0–1: how close the lowest tendril is to the roofs. */
export function danger(g: Game): number {
  let low = g.body
  for (const t of g.tips) if (t.y > low) low = t.y
  for (const h of g.houses) if (h.roots) low = g.rows - 1
  return Math.max(0, Math.min(1, (low - g.body) / Math.max(1, g.rows - 1 - g.body)))
}

// ---------------------------------------------------------------- autopilot

/**
 * Plays the cannon: the attract mode behind the title, and the player the
 * tests measure the rules with. `skill` 1 looks for the cut that severs the
 * most; 0 just shoots at whatever hangs lowest. `think` is the seconds
 * between its decisions.
 */
export function autopilot(g: Game, skill = 1, think = 0.28): Input {
  const c = g.cannon
  if (g.phase !== 'play') return { move: 0, target: null, fire: false }
  if (g.time >= g.ai.until || g.ai.col < 0 || g.ai.col >= g.cols) {
    g.ai.until = g.time + think
    g.ai.col = pickColumn(g, skill)
  }
  const want = g.ai.col + 0.5
  const d = want - c.x
  const move = Math.abs(d) < 0.3 ? 0 : Math.sign(d)
  return { move, target: null, fire: Math.abs(d) < 1.2 }
}

function pickColumn(g: Game, skill: number): number {
  const here = Math.floor(g.cannon.x)
  const heart = g.hearts.find(h => h.alive)
  // With the lance lit, go for the heart.
  if (heart && g.lance > 0) return heart.x
  let best = here
  let bs = 0
  for (let x = 0; x < g.cols; x++) {
    const y = lowestIn(g, x)
    if (y < g.body) continue
    const i = y * g.cols + x
    if (g.dieAt[i]) continue
    let s = (y - g.body) * 0.5
    if (skill > 0) {
      const v = cutValue(g, i)
      s = (v.n + 1) / g.hp[i]! + v.roots * 40 + (g.kind[i] === ROOT ? 40 : 0) + Math.max(0, y - (g.rows - 10)) * 3
    }
    s -= Math.abs(x - here) * 0.35
    if (s > bs) { bs = s; best = x }
  }
  // Nothing worth a shot: fetch a mote on its way down.
  if (bs < 6) {
    for (const m of g.motes) if (m.y > g.rows - 16) return Math.max(0, Math.min(g.cols - 1, Math.floor(m.x)))
  }
  return best
}
