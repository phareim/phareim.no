/**
 * The simulation entry points: createGame, stepGame, saves. Pure and
 * deterministic — all gameplay randomness goes through state.rng.
 *
 * Modes: play → scroll (dungeon room change) / warp (door fade) / dialog /
 * get (item held up, then its text) / dying → respawn; won is terminal.
 */
import type { GameEvent, GameState, Input, Inventory, SaveData, World } from '../types'
import { HERO_R, NO_INPUT, SAVE_VERSION, SCROLL_TIME, START_HP, STEP, WARP_TIME } from '../types'
import { ctx, type Ctx } from './combat'
import { stepEnemies } from './enemies'
import { openDialog, stepHero } from './hero'
import { cellDef, cellIndex, cellRect, has, loadMap, mapInfo } from './map'
import { stepObjects } from './objects'
import { resetEnemy } from './spawn'

export const INTRO = [
  'KEEPER: THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS. THE STATIC KING TOOK THE SUN PRISM INTO THE OLD NEON SHRINE.',
  'OPEN THAT CHEST, KID. THE BLADE INSIDE IS YOURS NOW.',
]

function freshInv(): Inventory {
  return { sword: false, bombBag: false, bombs: 0, disc: false, bits: 0, keys: 0, bigKey: false, pieces: 0, selected: null, prism: false }
}

export function createGame(world: World, opts: { seed?: number; save?: SaveData | null; demo?: boolean } = {}): GameState {
  const save = opts.save && validSave(world, opts.save) ? opts.save : null
  const map = save ? save.map : world.start.map
  const entry = save ? save.entry : world.start.entry
  const s: GameState = {
    mode: 'play',
    map: null as unknown as GameState['map'],
    hero: {
      x: 0, y: 0, dir: 'down', vx: 0, vy: 0, hp: save ? save.maxHp : START_HP, maxHp: save ? save.maxHp : START_HP,
      act: 'idle', actT: 0, walkT: 0, invuln: 0, knock: null, swing: null, spin: null, charge: -1, cooldown: 0,
      carry: null, push: 0, safe: { x: 0, y: 0 },
    },
    inv: save ? { ...freshInv(), ...save.inv } : freshInv(),
    flags: {},
    entry: { map, entry },
    zone: { x: 0, y: 0, w: 1, h: 1 },
    zoneIndex: 0,
    scroll: null,
    warp: null,
    dialog: null,
    get: null,
    dying: null,
    area: '',
    elapsed: save ? save.elapsed : 0,
    rng: save ? save.rng : (opts.seed ?? 1) | 0,
    nextId: 0,
    shake: 0,
    demo: !!opts.demo,
    disc: null,
  }
  if (save) for (const f of save.flags) s.flags[f] = true
  const ev: GameEvent[] = []
  enterMap(world, s, map, entry, ev)
  if (!save && !s.demo) openDialog(ctx(world, s, ev), INTRO, 'keeper')
  if (s.demo) { s.hero.x = -50; s.hero.y = -50 }
  return s
}

/** Put the hero on a map at an entry; resets per-visit things. */
export function enterMap(world: World, s: GameState, mapId: string, entryId: string, ev: GameEvent[]) {
  const info = mapInfo(world, mapId)
  s.map = loadMap(world, s, mapId)
  const spot = info.entries[entryId] ?? info.entries[Object.keys(info.entries)[0]!]!
  const h = s.hero
  h.x = spot.x
  h.y = spot.y
  h.dir = spot.dir
  h.safe = { x: spot.x, y: spot.y }
  h.swing = null
  h.spin = null
  h.charge = -1
  h.knock = null
  h.carry = null
  h.act = 'idle'
  s.disc = null
  s.entry = { map: mapId, entry: entryId }
  setZone(world, s, cellIndex(info, h.x, h.y))
  const area = areaAt(world, s)
  s.area = area.name
  ev.push({ type: 'enter', map: mapId, area: area.name, track: area.track })
}

function setZone(world: World, s: GameState, index: number) {
  const info = mapInfo(world, s.map.id)
  s.zoneIndex = index
  s.zone = info.def.kind === 'dungeon' ? cellRect(info, index) : { x: 0, y: 0, w: info.w, h: info.h }
}

function areaAt(world: World, s: GameState): { name: string; track: import('../types').TrackId } {
  const info = mapInfo(world, s.map.id)
  const def = info.def
  if (def.areas) {
    const h = s.hero
    for (const a of def.areas) {
      if (h.x >= a.x && h.x < a.x + a.w && h.y >= a.y && h.y < a.y + a.h) return { name: a.name, track: a.track ?? def.track }
    }
  }
  const cd = def.kind === 'dungeon' ? cellDef(info, s.zoneIndex) : undefined
  return { name: def.name, track: cd?.track ?? def.track }
}

/** Entering a dungeon room: fresh enemies, reset blocks, clear leftovers. */
function enterCell(c: Ctx, index: number) {
  const s = c.s
  const m = s.map
  setZone(c.w, s, index)
  for (const e of m.enemies) {
    if (e.cell !== index) continue
    if (e.once && has(s, e.once)) continue
    if (!e.dead && e.hp === e.maxHp) { resetEnemy(e); continue }
    resetEnemy(e)
  }
  m.enemies = m.enemies.filter(e => !e.id.startsWith('king.bat'))
  m.projectiles.length = 0
  m.drops = m.drops.filter(d => d.kind === 'key')
  m.bombs.length = 0
  m.blasts.length = 0
  m.thrown.length = 0
  // Push blocks go home unless their puzzle is solved.
  const authored = c.info.blocks.get(index)
  if (authored) {
    const gateSolved = c.info.gates.some(g => g.cell === index && has(s, `gate:${g.id}`))
    if (!gateSolved) {
      const r = cellRect(c.info, index)
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) if (m.tiles[y * m.w + x] === 'b') m.tiles[y * m.w + x] = '.'
      for (const i of authored) m.tiles[i] = 'b'
      m.moving.length = 0
      m.version++
    }
  }
  s.hero.safe = { x: s.hero.x, y: s.hero.y }
  const area = areaAt(c.w, s)
  c.ev.push({ type: 'area', name: area.name, track: area.track })
}

// ---------------------------------------------------------------------------
// Step
// ---------------------------------------------------------------------------

export function stepGame(world: World, s: GameState, dt: number, input: Input): GameEvent[] {
  const ev: GameEvent[] = []
  let left = Math.min(dt, 0.1)
  let first = true
  while (left > 1e-9) {
    const h = Math.min(STEP, left)
    left -= h
    const inp = first ? input : { ...input, aPress: false, bPress: false, cycle: false }
    first = false
    substep(world, s, h, inp, ev)
  }
  return ev
}

function substep(world: World, s: GameState, dt: number, inp: Input, ev: GameEvent[]) {
  const c = ctx(world, s, ev)
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt)
  switch (s.mode) {
    case 'play': return play(c, dt, inp)
    case 'scroll': return scroll(c, dt)
    case 'warp': return warp(c, dt)
    case 'dialog': return dialog(c, dt, inp)
    case 'get': return getItem(c, dt, inp)
    case 'dying': return dying(c, dt)
    case 'won': return
  }
}

function play(c: Ctx, dt: number, inp: Input) {
  const s = c.s
  if (!s.demo) {
    s.elapsed += dt
    stepHero(c, inp, dt)
  }
  if (s.mode !== 'play') return
  stepEnemies(c, dt)
  stepObjects(c, dt)
  if (s.mode !== 'play' || s.demo) return
  const h = s.hero
  // Warps
  for (const w of c.info.warps) {
    if (h.x >= w.x && h.x < w.x + w.w && h.y >= w.y && h.y < w.y + w.h) {
      s.mode = 'warp'
      s.warp = { t: 0, to: w.to, entry: w.entry, swapped: false }
      h.act = 'walk'
      c.ev.push({ type: 'warp' })
      return
    }
  }
  // Dungeon room change
  if (c.info.def.kind === 'dungeon') {
    const idx = cellIndex(c.info, h.x, h.y)
    if (idx !== s.zoneIndex) {
      const to = cellRect(c.info, idx)
      const from = s.zone
      const dx = to.x > from.x ? 1 : to.x < from.x ? -1 : 0
      const dy = to.y > from.y ? 1 : to.y < from.y ? -1 : 0
      s.scroll = { from, to, t: 0, dx, dy, index: idx }
      s.mode = 'scroll'
      s.disc = null
      h.carry = null
      h.swing = null
      h.spin = null
      h.charge = -1
      h.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up'
      c.ev.push({ type: 'scroll' })
      return
    }
  }
  // Overworld area banner
  if (c.info.def.areas) {
    const a = areaAt(c.w, s)
    if (a.name !== s.area) {
      s.area = a.name
      c.ev.push({ type: 'area', name: a.name, track: a.track })
    }
  }
}

function scroll(c: Ctx, dt: number) {
  const s = c.s
  const sc = s.scroll!
  const h = s.hero
  sc.t += dt
  // Walk the hero through the doorway while the camera slides.
  const dist = sc.dy !== 0 ? 1.5 : 1.3
  h.x += (sc.dx * dist * dt) / SCROLL_TIME
  h.y += (sc.dy * dist * dt) / SCROLL_TIME
  h.walkT += dt
  h.act = 'walk'
  if (sc.t >= SCROLL_TIME) {
    s.scroll = null
    s.mode = 'play'
    h.act = 'idle'
    enterCell(c, sc.index)
  }
}

function warp(c: Ctx, dt: number) {
  const s = c.s
  const w = s.warp!
  w.t += dt
  if (!w.swapped && w.t >= WARP_TIME) {
    w.swapped = true
    enterMap(c.w, s, w.to, w.entry, c.ev)
  }
  if (w.t >= WARP_TIME * 2) {
    s.warp = null
    s.mode = 'play'
  }
}

const TYPE_SPEED = 55 // chars per second

function dialog(c: Ctx, dt: number, inp: Input) {
  const s = c.s
  const d = s.dialog!
  const line = d.lines[d.line] ?? ''
  if (d.chars < line.length) {
    const before = Math.floor(d.chars)
    d.chars = Math.min(line.length, d.chars + dt * TYPE_SPEED)
    if (Math.floor(d.chars) > before && line[Math.floor(d.chars) - 1] !== ' ') c.ev.push({ type: 'text' })
  }
  if (!inp.aPress && !inp.bPress) return
  if (d.chars < line.length) { d.chars = line.length; return }
  d.line++
  d.chars = 0
  if (d.line < d.lines.length) return
  // Close
  s.dialog = null
  s.mode = 'play'
  if (d.after) {
    for (const f of d.after.set ?? []) s.flags[f] = true
  }
  if (s.get) {
    const item = s.get.item
    s.get = null
    s.hero.act = 'idle'
    if (item === 'prism') {
      s.mode = 'won'
      s.flags.won = true
      c.ev.push({ type: 'won', elapsed: s.elapsed })
    }
  }
}

function getItem(c: Ctx, dt: number, _inp: Input) {
  const s = c.s
  const g = s.get!
  g.t += dt
  if (g.t >= 0.75) {
    s.mode = 'dialog'
    s.dialog = { lines: g.text, line: 0, chars: 0, who: null, after: null }
  }
}

function dying(c: Ctx, dt: number) {
  const s = c.s
  const d = s.dying!
  d.t += dt
  if (d.t >= 1.8) respawn(c.w, s, c.ev)
}

export function respawn(world: World, s: GameState, ev: GameEvent[] = []): GameEvent[] {
  s.dying = null
  s.mode = 'play'
  s.hero.hp = s.hero.maxHp
  s.hero.invuln = 1.2
  enterMap(world, s, s.entry.map, s.entry.entry, ev)
  ev.push({ type: 'respawn' })
  return ev
}

// ---------------------------------------------------------------------------
// Saves
// ---------------------------------------------------------------------------

export function toSave(s: GameState): SaveData | null {
  if (s.demo) return null
  return {
    v: SAVE_VERSION,
    map: s.entry.map,
    entry: s.entry.entry,
    hp: s.hero.maxHp,
    maxHp: s.hero.maxHp,
    inv: { ...s.inv },
    flags: Object.keys(s.flags),
    rng: s.rng,
    elapsed: s.elapsed,
  }
}

function validSave(world: World, v: SaveData): boolean {
  const m = world.maps[v.map]
  if (!m) return false
  try { return !!mapInfo(world, v.map).entries[v.entry] } catch { return false }
}

export function parseSave(raw: unknown): SaveData | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (r.v !== SAVE_VERSION) return null
  if (typeof r.map !== 'string' || typeof r.entry !== 'string') return null
  const num = (x: unknown) => typeof x === 'number' && Number.isFinite(x)
  if (!num(r.hp) || !num(r.maxHp) || !num(r.rng) || !num(r.elapsed)) return null
  if (!Array.isArray(r.flags) || !r.flags.every(f => typeof f === 'string')) return null
  const inv = r.inv as Record<string, unknown> | undefined
  if (!inv || typeof inv !== 'object') return null
  const base = freshInv()
  for (const k of Object.keys(base) as Array<keyof Inventory>) {
    const want = typeof base[k]
    if (k === 'selected') { if (inv[k] !== null && inv[k] !== 'disc' && inv[k] !== 'bombs') return null; continue }
    if (typeof inv[k] !== want) return null
  }
  const maxHp = Math.max(START_HP, Math.min(20, Math.round(r.maxHp as number)))
  return {
    v: SAVE_VERSION, map: r.map, entry: r.entry, hp: maxHp, maxHp,
    inv: inv as unknown as Inventory, flags: r.flags as string[], rng: (r.rng as number) | 0, elapsed: Math.max(0, r.elapsed as number),
  }
}

/** Where the camera wants to be (tile units, top-left) for a view of vw×vh tiles. */
export function cameraFor(s: GameState, vw: number, vh: number): { x: number; y: number } {
  const h = s.hero
  const clampTo = (z: { x: number; y: number; w: number; h: number }) => {
    const cx = z.w <= vw ? z.x + (z.w - vw) / 2 : Math.max(z.x, Math.min(z.x + z.w - vw, h.x - vw / 2))
    const cy = z.h <= vh ? z.y + (z.h - vh) / 2 : Math.max(z.y, Math.min(z.y + z.h - vh, h.y - vh / 2))
    return { x: cx, y: cy }
  }
  if (s.scroll) {
    const a = clampTo(s.scroll.from)
    const b = clampTo(s.scroll.to)
    const t = Math.min(1, s.scroll.t / SCROLL_TIME)
    const e = t * t * (3 - 2 * t)
    return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e }
  }
  return clampTo(s.zone)
}

export { NO_INPUT, HERO_R }
