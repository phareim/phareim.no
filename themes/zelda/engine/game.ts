/**
 * The simulation entry points: createGame, stepGame, saves. Pure and
 * deterministic — all gameplay randomness goes through state.rng.
 *
 * Modes: play → scroll (dungeon room change) / warp (door fade) / dialog /
 * get (item held up, then its text) / dying → respawn; won and exit (the
 * hero left through an exit, the shell navigates) are terminal.
 */
import type { AreaIntro, ArtId, Dialog, GameEvent, GameState, Input, Inventory, SaveData, Spot, TrackId, Vec, World } from '../types'
import { HERO_R, MAX_HP, MOVES, NO_INPUT, SAVE_VERSION, SCROLL_TIME, SLIP_SCALE, START_HP, STEP, TALK_REST, TILE, WARP_TIME, bItem, roomed } from '../types'
import { acquire, ctx, type Ctx } from './combat'
import { stepEnemies } from './enemies'
import { beginExit, openDialog, stepHero, WALK_OUT_TIME } from './hero'
import { cellDef, cellIndex, cellRect, condMet, has, loadMap, mapDef, mapInfo, moveCircle, stepClear } from './map'
import { stepObjects } from './objects'
import { bathArrive, keepRobe, startBath } from './attendants'
import { stepBeat, sycophantFocus, sycophantFrame, sycophantGone } from './bossSycophant'
import { resetEnemy } from './spawn'
import { DAY_LENGTH, settleFoes, stepFoes } from './day'
import { placeLuna, refreshNpcs, stepLuna } from './luna'
import { stepHook } from './hook'
import { stepEcho } from './echo'
import { stepBalance } from './balance'
import { lampHome } from './lamp'
import { homeIron } from './magnet'
import { raiseCard, stepCard } from './cards'
import { stepLens } from './lens'
import { examEnterCell, examEnterMap, stepExam } from './exam'
import { startChase, stepChase } from './chase'
import { dirVec } from './util'
import { TILE_INFO } from '../world/tiles'
import { terrainLevel } from './terrain'
import { resetPuzzleRoom } from './puzzles/index'
import { cleanExplored, revealAround, reveal } from './explore'
import { ART_IDS, endMoves, resetMoves, stepSlow } from './moves'

function freshInv(): Inventory {
  return {
    sword: false, bombBag: false, bombs: 0, disc: false, bits: 0, keys: 0, bigKey: false, pieces: 0, selected: null, prism: false,
    hook: false, arc: false, echo: false, lamp: false, magnet: false, bigBag: false, shrooms: 0, keyrings: {},
    stomp: false,
  }
}

/**
 * A new game, or a save continued. `at` puts the hero at that entry instead
 * of the save's continue point (the town's start, or in front of the cabinet
 * they left by); an `at` the world does not have is ignored.
 */
export function createGame(
  world: World,
  opts: { seed?: number; save?: SaveData | null; demo?: boolean; at?: { map: string; entry: string } | null; session?: boolean } = {},
): GameState {
  const save = opts.save ? rescueSave(world, opts.save) : null
  const at = opts.at && hasEntry(world, opts.at.map, opts.at.entry) ? opts.at : null
  const map = at ? at.map : save ? save.map : world.start.map
  const entry = at ? at.entry : save ? save.entry : world.start.entry
  const s: GameState = {
    mode: 'play',
    map: null as unknown as GameState['map'],
    hero: {
      x: 0, y: 0, dir: 'down', vx: 0, vy: 0, hp: save ? save.maxHp : START_HP, maxHp: save ? save.maxHp : START_HP,
      act: 'idle', actT: 0, walkT: 0, invuln: 0, knock: null, swing: null, spin: null, charge: -1, cooldown: 0, talkRest: 0,
      carry: null, push: 0, safe: { x: 0, y: 0 },
    },
    inv: save ? { ...freshInv(), ...save.inv } : freshInv(),
    flags: {},
    session: !!opts.session,
    // A game opens in the isometric view; the shell says otherwise (`setViewRule`).
    view: 'iso',
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
    hook: null,
    echo: null,
    lamp: null,
    luna: null,
    daytime: save?.inv.prism ? (typeof save.day === 'number' ? save.day : 0) : null,
    cardsSeen: [],
  }
  const seen = save ? cleanExplored(save.explored) : null
  if (seen) s.explored = seen
  if (save) for (const f of save.flags) s.flags[f] = true
  const ev: GameEvent[] = []
  enterMap(world, s, map, entry, ev)
  // A new game's intro waits until the hero has stepped out of the start door.
  if (!save && !at && !s.demo && world.intro) {
    if (s.hero.auto) s.hero.auto.intro = true
    else openDialog(ctx(world, s, ev), world.intro.lines, world.intro.who ?? null)
  }
  if (s.demo) { s.hero.x = -50; s.hero.y = -50; s.hero.auto = null }
  return s
}

/**
 * Put the hero on a map at an entry; resets per-visit things. An `out`
 * entry starts the walk out of its door. `at` lands on that spot instead
 * (a drop through a hole); the continue point stays where it was.
 */
export function enterMap(world: World, s: GameState, mapId: string, entryId: string, ev: GameEvent[], at?: Vec) {
  const info = mapInfo(world, mapId)
  // The storm lamp is back in the hand (before the old map is let go: its tile gets its floor again).
  lampHome(s)
  s.map = loadMap(world, s, mapId)
  const spot: Spot = at ? { x: at.x, y: at.y, dir: s.hero.dir } : info.entries[entryId] ?? info.entries[Object.keys(info.entries)[0]!]!
  const h = s.hero
  delete h.side
  h.x = spot.x
  h.y = spot.y
  h.dir = spot.dir
  h.safe = { x: spot.x, y: spot.y }
  h.swing = null
  h.spin = null
  h.roll = null
  resetMoves(s)
  h.bufA = 0
  h.bufRoll = 0
  h.charge = -1
  h.knock = null
  h.carry = null
  h.act = 'idle'
  if (spot.out) {
    const v = dirVec(spot.dir)
    h.auto = { dir: spot.dir, t: WALK_OUT_TIME + 0.1, x: spot.x + v.x, y: spot.y + v.y }
  } else h.auto = null
  if (s.map.terrain) s.map.terrain.z = terrainLevel(s.map, h.x, h.y, HERO_R)
  s.disc = null
  s.hook = null
  s.echo = null
  delete s.beat
  if (!at) s.entry = { map: mapId, entry: entryId }
  keepRobe(s, mapId)
  // A land walked into is drawn on the MAP page's chart of the world (and the QUEST line stops pointing at the gates).
  if (info.def.away) s.flags[`seen:${mapId}`] = true
  placeLuna(s)
  setZone(world, s, cellIndex(info, h.x, h.y))
  settleFoes(world, s)
  startChase(world, s)
  raiseCard(world, s)
  examEnterMap(world, s)
  const area = areaAt(world, s)
  s.area = area.name
  ev.push({ type: 'enter', map: mapId, area: area.name, track: area.track })
}

function setZone(world: World, s: GameState, index: number) {
  const info = mapInfo(world, s.map.id)
  s.zoneIndex = index
  s.zone = roomed(info.def.kind) ? cellRect(info, index) : { x: 0, y: 0, w: info.w, h: info.h }
  // A dungeon room is seen whole as soon as the hero is in it.
  if (info.def.kind === 'dungeon' && !s.demo) reveal(s, s.map.id, info.w, info.h, s.zone)
  revealAround(s, info.def, info.w, info.h)
}

function areaAt(world: World, s: GameState): { name: string; track: TrackId; entry?: string; intro?: AreaIntro } {
  const info = mapInfo(world, s.map.id)
  const def = info.def
  if (def.areas) {
    const h = s.hero
    for (const a of def.areas) {
      if (h.x >= a.x && h.x < a.x + a.w && h.y >= a.y && h.y < a.y + a.h) return { name: a.name, track: a.track ?? def.track, entry: a.entry, intro: a.intro }
    }
  }
  const cd = roomed(def.kind) ? cellDef(info, s.zoneIndex) : undefined
  return { name: def.name, track: (cd?.calm && has(s, cd.calm) ? undefined : cd?.track) ?? def.track }
}

/** Entering a dungeon room: fresh enemies, reset blocks, clear leftovers. */
function enterCell(c: Ctx, index: number) {
  const s = c.s
  const m = s.map
  lampHome(s)
  setZone(c.w, s, index)
  sycophantGone(c)
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
  m.spell = ''
  m.spellTiles = []
  // A trap gate not yet beaten stands open again, in whatever room it is (the hero may have left by another way).
  for (const g of c.info.gates) {
    if (!g.trap || has(s, `gate:${g.id}`) || m.tiles[g.tiles[0]!] !== 'X') continue
    for (const i of g.tiles) m.tiles[i] = '.'
    m.version++
  }
  // Push blocks go home unless their puzzle is solved.
  const authored = c.info.blocks.get(index)
  if (authored) {
    // (A trap gate beaten is a fight won, not a puzzle solved.)
    const gateSolved = c.info.gates.some(g => !g.trap && g.cell === index && has(s, `gate:${g.id}`))
    if (!gateSolved) {
      const r = cellRect(c.info, index)
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
        const t = m.tiles[y * m.w + x]
        if (t === 'b' || t === 'B') m.tiles[y * m.w + x] = '.'
      }
      for (const [i, t] of authored) m.tiles[i] = t
      for (const f of Object.keys(s.flags)) {
        const p = f.split(':')
        if (p[0] === 'drop' && p[1] === m.id) m.tiles[Number(p[2])] = 'B'
      }
      m.moving.length = 0
      m.version++
    }
  }
  resetPuzzleRoom(c, index)
  // Iron goes home (`magnet.ts`), solved room or not.
  homeIron(c, index)
  examEnterCell(c, index)
  s.hero.safe = { x: s.hero.x, y: s.hero.y }
  placeLuna(s)
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
    const inp = first ? input : { ...input, aPress: false, bPress: false, cycle: false, rollPress: false, jumpPress: false, pick: undefined }
    first = false
    substep(world, s, h, inp, ev)
  }
  return ev
}

function substep(world: World, s: GameState, dt: number, inp: Input, ev: GameEvent[]) {
  const c = ctx(world, s, ev)
  if (s.shake > 0) s.shake = Math.max(0, s.shake - dt)
  // THE LENS: the clock of a still hero (`engine/lens.ts`), once a step, whatever holds the world.
  stepLens(c, inp, dt)
  // A card up: the world holds still under it (`engine/cards.ts`).
  if (s.card) { stepCard(s, inp, dt); return }
  switch (s.mode) {
    case 'play': return play(c, dt, inp)
    case 'scroll': return scroll(c, dt)
    case 'warp': return warp(c, dt)
    case 'dialog': return dialog(c, dt, inp)
    case 'get': return getItem(c, dt, inp)
    case 'dying': return dying(c, dt)
    case 'won': case 'exit': return
  }
}

function play(c: Ctx, dt: number, inp: Input) {
  const s = c.s
  // A beat (the Sycophant's THE END): the world holds, and nothing but the beat moves.
  if (s.beat) return stepBeat(c, dt)
  if (!s.demo) {
    // The quest clock starts with the blade: strolling round the town is free.
    if (s.inv.sword) s.elapsed += dt
    // The sun moves once the prism is home.
    if (s.daytime !== null) {
      s.daytime = (s.daytime + dt) % DAY_LENGTH
      stepFoes(c.w, s)
    }
    // On terrain, the level the hero stands at before moving (`terrain.ts`).
    if (s.map.terrain) s.map.terrain.z = terrainLevel(s.map, s.hero.x, s.hero.y, HERO_R)
    stepHero(c, inp, dt)
    stepEcho(c, dt)
    stepBalance(c, dt)
    revealAround(s, c.info.def, c.info.w, c.info.h)
  }
  if (s.mode !== 'play') return
  // A SLIP: the world runs slow a moment, the hero at full pace (`moves.ts`).
  const wdt = s.slow ? dt * SLIP_SCALE : dt
  stepSlow(s, dt)
  // (The examination's rounds and its stands run on the hero's clock.)
  stepExam(c, dt)
  // A screen that scrolls by itself moves first, so that what rides it moves with it.
  stepChase(c, wdt)
  stepEnemies(c, wdt)
  stepObjects(c, wdt)
  if (s.mode !== 'play' || s.demo) return
  stepHook(c, dt)
  stepLuna(c, dt)
  if (s.mode !== 'play') return
  const h = s.hero
  // Still stepping out of a door (standing on its warp), or on the end of the hook's chain.
  if (h.auto || s.hook) return
  // Walk-on exits leave the game.
  const exit = c.info.exits.get(Math.floor(h.y) * c.info.w + Math.floor(h.x))
  if (exit?.walk) { beginExit(c, exit); return }
  // Warps
  for (const w of c.info.warps) {
    // (A warp that waits works once its condition holds and its stair has appeared: `objects.ts`.)
    if (w.when && (!condMet(s, c.w, w.when, -1) || s.map.tiles[w.y * c.info.w + w.x] !== c.info.base[w.y * c.info.w + w.x])) continue
    if (h.x >= w.x && h.x < w.x + w.w && h.y >= w.y && h.y < w.y + w.h) {
      s.mode = 'warp'
      s.warp = { t: 0, to: w.to, entry: w.entry, swapped: false }
      h.act = 'walk'
      c.ev.push({ type: 'warp' })
      return
    }
  }
  // Off the edge into the next region (the frontier).
  if (c.w.atlas?.[c.s.map.id] && edgeOut(c, inp)) return
  // Dungeon room change
  if (roomed(c.info.def.kind)) {
    const idx = cellIndex(c.info, h.x, h.y)
    if (idx !== s.zoneIndex) {
      const to = cellRect(c.info, idx)
      const from = s.zone
      const dx = to.x > from.x ? 1 : to.x < from.x ? -1 : 0
      const dy = to.y > from.y ? 1 : to.y < from.y ? -1 : 0
      s.scroll = { from, to, t: 0, dx, dy, index: idx }
      s.mode = 'scroll'
      s.disc = null
      // An echo stays with its room.
      s.echo = null
      h.carry = null
      h.swing = null
      h.spin = null
      h.roll = null
      endMoves(h)
      h.charge = -1
      h.dir = dx > 0 ? 'right' : dx < 0 ? 'left' : dy > 0 ? 'down' : 'up'
      c.ev.push({ type: 'scroll' })
      return
    }
  }
  // A room's scripted beat (a boss's name, Luna remembering, the Gate shutting).
  if (roomed(c.info.def.kind)) {
    const ev = cellDef(c.info, s.zoneIndex)?.events?.find(e => !has(s, e.set) && condMet(s, c.w, e.when, s.zoneIndex))
    if (ev) {
      s.flags[ev.set] = true
      openDialog(c, ev.lines, ev.who ?? null)
      return
    }
  }
  // Overworld area banner
  if (c.info.def.areas) {
    const a = areaAt(c.w, s)
    if (a.name !== s.area) {
      s.area = a.name
      if (a.entry) s.entry = { map: s.map.id, entry: a.entry }
      c.ev.push({ type: 'area', name: a.name, track: a.track })
      areaIntro(c, a)
    }
  }
}

/** An area's intro, the first time (`AreaIntro.flag`) and while its `when` holds. */
function areaIntro(c: Ctx, a: { intro?: AreaIntro }) {
  const s = c.s
  if (a.intro && !has(s, a.intro.flag) && condMet(s, c.w, a.intro.when, -1)) {
    s.flags[a.intro.flag] = true
    openDialog(c, a.intro.lines, a.intro.who ?? null)
  }
}

/**
 * The map on the world's grid (`World.atlas`) that holds tile (gx, gy), and that tile in its own coordinates;
 * null where no map does (the sea, the hills between the lands).
 */
export function atlasAt(world: World, gx: number, gy: number, not?: string): { map: string; x: number; y: number } | null {
  for (const [map, o] of Object.entries(world.atlas ?? {})) {
    if (map === not) continue
    const def = mapDef(world, map)
    if (!def) continue
    const x = gx - o.x
    const y = gy - o.y
    if (x >= 0 && y >= 0 && y < def.rows.length && x < def.rows[0]!.length) return { map, x, y }
  }
  return null
}

/**
 * The hero pushes against an edge with a land beyond it on the grid: fade into that map at the same place along
 * the edge, one step in. Both maps open the same tiles of a pass (`docs/worlds/atlas.md`, the seams), so it is
 * open ground on both sides; anywhere else a rim of cliff, sea or wood keeps the hero from the edge.
 */
function edgeOut(c: Ctx, inp: Input): boolean {
  const s = c.s
  const h = s.hero
  const o = c.w.atlas![s.map.id]!
  const near = HERO_R + 0.08
  const { w, h: hh } = c.info
  let side: 'n' | 's' | 'e' | 'w' | null = null
  if (h.x <= near && inp.move.x < -0.3) side = 'w'
  else if (h.x >= w - near && inp.move.x > 0.3) side = 'e'
  else if (h.y <= near && inp.move.y < -0.3) side = 'n'
  else if (h.y >= hh - near && inp.move.y > 0.3) side = 's'
  if (!side) return false
  // The grid tile just past the edge, level with the hero.
  const gx = o.x + (side === 'w' ? -1 : side === 'e' ? w : Math.floor(h.x))
  const gy = o.y + (side === 'n' ? -1 : side === 's' ? hh : Math.floor(h.y))
  const next = atlasAt(c.w, gx, gy, s.map.id)
  if (!next) return false
  const land = mapInfo(c.w, next.map)
  const IN = 1.1
  const fx = h.x - Math.floor(h.x)
  const fy = h.y - Math.floor(h.y)
  const at = side === 'w' ? { x: land.w - IN, y: next.y + fy } : side === 'e' ? { x: IN, y: next.y + fy }
    : side === 'n' ? { x: next.x + fx, y: land.h - IN } : { x: next.x + fx, y: IN }
  const back = side === 'w' ? { x: land.w - 0.5, y: at.y } : side === 'e' ? { x: 0.5, y: at.y }
    : side === 'n' ? { x: at.x, y: land.h - 0.5 } : { x: at.x, y: 0.5 }
  // Only into open ground: a way dug or built to the edge off a pass meets the neighbour's rim, and stays here.
  for (const p of [at, back]) {
    if (p.x < 0 || p.y < 0 || p.x >= land.w || p.y >= land.h) return false
    const t = land.base[Math.floor(p.y) * land.w + Math.floor(p.x)]
    if (!t || TILE_INFO[t].solid) return false
  }
  s.mode = 'warp'
  s.warp = { t: 0, to: next.map, entry: '', swapped: false, at, edge: true }
  h.act = 'walk'
  c.ev.push({ type: 'warp' })
  return true
}

function scroll(c: Ctx, dt: number) {
  const s = c.s
  const sc = s.scroll!
  const h = s.hero
  sc.t += dt
  // Walk the hero through the doorway while the camera slides.
  const dist = sc.dy !== 0 ? 1.5 : 1.3
  // Through the doorway, stopping short of anything standing just inside.
  const r = moveCircle(c.w, s.map, h.x, h.y, HERO_R, (sc.dx * dist * dt) / SCROLL_TIME, (sc.dy * dist * dt) / SCROLL_TIME)
  h.x = r.x
  h.y = r.y
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
  if (w.exit && w.t >= WARP_TIME) {
    // Full dark: hold it there and hand over to the shell.
    w.t = WARP_TIME
    s.mode = 'exit'
    s.hero.act = 'idle'
    c.ev.push({ type: 'exit', id: w.exit.id, to: w.exit.to })
    return
  }
  if (!w.swapped && w.t >= WARP_TIME) {
    w.swapped = true
    enterMap(c.w, s, w.to, w.entry, c.ev, w.at)
    if (w.white) bathArrive(c)
    if (w.drop) {
      landClear(c)
      s.hero.act = 'idle'
      s.shake = Math.max(s.shake, 0.2)
      c.ev.push({ type: 'land' })
    } else if (w.edge) {
      // Walked over an edge into the next land: the area walked into is the continue point now (death; a reload,
      // `loadSpot`), or failing that the land's first entry.
      const into = areaAt(c.w, s).entry
      const entries = mapInfo(c.w, w.to).entries
      const entry = into && entries[into] ? into : Object.keys(entries)[0]!
      s.entry = { map: w.to, entry }
    }
  }
  if (w.t >= WARP_TIME * 2) {
    s.warp = null
    s.mode = 'play'
    // Arriving in a land (by a gate, the ferry, a seam) opens the first-visit words of the area arrived in.
    if (mapInfo(c.w, s.map.id).def.away) areaIntro(c, areaAt(c.w, s))
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
  // Lines that lead out of the world (an exit, the NEW GAME machine): B backs out at any line.
  if (inp.bPress && ((d.after && (d.after.exit || d.after.startOver)) || (d.ask && asksChoice(d)))) { closeWithoutLeaving(c); return }
  // Tracked on every line, so a direction still held from walking up never moves the cursor.
  const dir = Math.abs(inp.move.x) > 0.5 || Math.abs(inp.move.y) > 0.5
  const turned = dir && !d.held
  d.held = dir
  if (asksChoice(d) && d.chars >= line.length) {
    // The last line asks: YES goes, NO stays (a talk's own ask names its two answers). Any direction moves the cursor, a tap picks a side.
    if (turned) {
      d.choice = inp.move.x < -0.5 ? 0 : inp.move.x > 0.5 ? 1 : d.choice === 1 ? 0 : 1
      c.ev.push({ type: 'choose' })
    }
    if (inp.aPress && inp.tapSide) d.choice = inp.tapSide < 0 ? 0 : 1
    if (d.ask && inp.aPress) {
      // The reply carries the offer's own flags, and the pick's `after` (the Steamhouse's YES starts the bath).
      const pick = d.ask.after?.[d.choice ?? 0]
      openDialog(c, d.ask.replies[d.choice ?? 0], d.who, d.after || pick ? { ...d.after, ...pick } : null)
      return
    }
    if (inp.aPress && d.choice === 1) { closeWithoutLeaving(c); return }
  }
  if (!inp.aPress && !inp.bPress) return
  if (d.chars < line.length) { d.chars = line.length; return }
  d.line++
  d.chars = 0
  if (d.line < d.lines.length) return
  // Close
  s.dialog = null
  s.mode = 'play'
  s.hero.talkRest = TALK_REST
  if (d.after) {
    for (const f of d.after.set ?? []) s.flags[f] = true
    for (const f of d.after.clear ?? []) delete s.flags[f]
    if (d.after.exit) { beginExit(c, d.after.exit); return }
    if (d.after.startOver) { c.ev.push({ type: 'startOver' }); return }
    if (d.after.bath) { startBath(c); return }
    if (d.after.panel) { c.ev.push({ type: 'panel', id: d.after.panel.id, panel: d.after.panel.panel }); return }
    refreshNpcs(c)
    if (d.after.give) { acquire(c, d.after.give); return }
  }
  if (s.get) {
    const item = s.get.item
    s.get = null
    s.hero.act = 'idle'
    if (item === 'prism') {
      s.mode = 'won'
      s.flags.won = true
      // The sun can set at last: the day starts at the dusk it was stuck in.
      if (s.daytime === null) s.daytime = 0
      c.ev.push({ type: 'won', elapsed: s.elapsed })
    }
  }
}

/** True on the last line of an exit's lines: the dialog box shows YES / NO. */
export function asksToLeave(d: Dialog): boolean {
  return !!d.after?.exit && d.line === d.lines.length - 1
}

/** The last line asks something: YES / NO of an exit, or a talk's own two answers. */
export function asksChoice(d: Dialog): boolean {
  return (asksToLeave(d) || !!d.ask) && d.line === d.lines.length - 1
}

function closeWithoutLeaving(c: Ctx) {
  c.s.dialog = null
  c.s.mode = 'play'
  c.s.hero.talkRest = TALK_REST
  c.ev.push({ type: 'back' })
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

/** After the ending: the quest is won, the world stays, and play goes on from where the prism was. */
export function resumeAfterWin(s: GameState) {
  if (s.mode !== 'won') return
  s.mode = 'play'
  s.hero.act = 'idle'
  s.hero.actT = 0
}

export function respawn(world: World, s: GameState, ev: GameEvent[] = []): GameEvent[] {
  s.dying = null
  s.mode = 'play'
  s.hero.hp = s.hero.maxHp
  s.hero.robe = false
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
    ...(s.daytime !== null ? { day: Math.round(s.daytime * 10) / 10 } : {}),
    ...(s.explored && cleanExplored(s.explored) ? { explored: cleanExplored(s.explored)! } : {}),
  }
}

/**
 * A save continues where it was made, when the game starts there (no `at`: death in a session, a reload out in a
 * land, `loadSpot`; otherwise the shell starts in town and the save gives the items and flags). Where that spot
 * has gone (an entry renamed), it continues at the map's first entry; on a map the world no longer has, where
 * `World.rescue` says (the generated frontier's regions: the land that took their place), or at the start. The
 * items, hearts and flags are never thrown away for it; explored tiles of maps that are gone are.
 */
function rescueSave(world: World, v: SaveData): SaveData {
  if (hasEntry(world, v.map, v.entry)) return v
  if (mapDef(world, v.map)) return { ...v, entry: Object.keys(mapInfo(world, v.map).entries)[0]! }
  const to = world.rescue?.(v.map, v.entry)
  const spot = to && hasEntry(world, to.map, to.entry) ? to : world.start
  const gone = (id: string) => !mapDef(world, id)
  const explored = v.explored ? Object.fromEntries(Object.entries(v.explored).filter(([id]) => !gone(id))) : undefined
  return { ...v, map: spot.map, entry: spot.entry, ...(explored ? { explored } : {}) }
}

/**
 * A map a reload continues in: one out past the hand-made coast (`MapDef.away`), one that says so itself
 * (`MapDef.resume`), or one a save names that the world moved out there.
 */
export function awayMap(world: World, map: string, entry = ''): boolean {
  const def = mapDef(world, map)
  if (def) return !!def.away || !!def.resume
  const to = world.rescue?.(map, entry)
  return !!to && !!mapDef(world, to.map)?.away
}

/**
 * Where a page load starts. A tab that was out in a land (`out`: the shell keeps it per tab) reloads at the save's
 * own continue point there: null, so `createGame` takes the save's (rescued when it has gone). Otherwise in front
 * of the exit last used (`back`), or on the plaza: a new visit always starts in town, with the save's items.
 */
export function loadSpot(world: World, save: SaveData | null, back: World['start'] | null, out: boolean): World['start'] | null {
  if (out && save && awayMap(world, save.map, save.entry)) return null
  return back ?? world.start
}

/** True when `map` is in the world and has an entry `entry` (placed, listed, or beside an exit). */
export function hasEntry(world: World, map: unknown, entry: unknown): boolean {
  if (typeof map !== 'string' || typeof entry !== 'string' || !mapDef(world, map)) return false
  try { return Object.prototype.hasOwnProperty.call(mapInfo(world, map).entries, entry) } catch { return false }
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
  // Fields added after a save was written (the hook, the Arc Blade…) start at their defaults.
  const OLD_KEYS = ['sword', 'bombBag', 'bombs', 'disc', 'bits', 'keys', 'bigKey', 'pieces', 'selected', 'prism']
  for (const k of Object.keys(base) as Array<keyof Inventory>) {
    const want = typeof base[k]
    // What B holds is never a reason to refuse a save (below: a name the game does not know is nothing in hand).
    if (k === 'selected') continue
    if (inv[k] === undefined && !OLD_KEYS.includes(k)) continue
    if (k === 'keyrings') { if (!inv[k] || typeof inv[k] !== 'object' || Array.isArray(inv[k])) return null; continue }
    if (typeof inv[k] !== want) return null
  }
  const maxHp = Math.max(START_HP, Math.min(MAX_HP, Math.round(r.maxHp as number)))
  const arts = cleanArts(inv)
  const flags = r.flags as string[]
  // Whoever knew an art the game has dropped knows the HOP, as if the Keeper had taught it.
  const taught = !!arts.arts?.includes('hop') && !flags.includes('item:artHop')
  const clean: Inventory = { ...base, ...(cleanOld(inv) as unknown as Inventory), keyrings: cleanRings(inv.keyrings), ...arts }
  if (!bItem(clean.selected)) clean.selected = null
  return {
    v: SAVE_VERSION, map: r.map, entry: r.entry, hp: maxHp, maxHp,
    inv: clean, flags: taught ? [...flags, 'item:artHop'] : flags, rng: (r.rng as number) | 0, elapsed: Math.max(0, r.elapsed as number),
    ...(num(r.savedAt) && (r.savedAt as number) > 0 ? { savedAt: Math.floor(r.savedAt as number) } : {}),
    ...(num(r.day) && (r.day as number) >= 0 ? { day: (r.day as number) % DAY_LENGTH } : {}),
    ...(cleanExplored(r.explored) ? { explored: cleanExplored(r.explored)! } : {}),
  }
}

/** A save's items without what the game no longer has: dig & build's materials and hammer kind (gone 2026-11-26); tonics. */
function cleanOld(inv: Record<string, unknown>): Record<string, unknown> {
  const { mats: _mats, build: _build, tonics: _tonics, ...rest } = inv
  return rest
}

/**
 * The arts a save may know that the game has since dropped: PULSE, FLASH STEP, STARFALL and HALO (gone 2026-11-26,
 * the HOP in their place). A save that knew one knows the HOP, and one in hand is the HOP in hand.
 */
const OLD_ARTS: readonly string[] = ['pulse', 'flash', 'star', 'halo']

/** The arts and the combos' counts as a save has them, with anything unknown dropped (`moves.ts`). */
function cleanArts(inv: Record<string, unknown>): Pick<Inventory, 'arts' | 'moves'> & { selected?: Inventory['selected'] } {
  const out: Pick<Inventory, 'arts' | 'moves'> & { selected?: Inventory['selected'] } = { arts: undefined, moves: undefined }
  if (Array.isArray(inv.arts)) {
    const old: ArtId[] = inv.arts.some(a => OLD_ARTS.includes(a)) ? ['hop'] : []
    const arts = [...new Set([...old, ...inv.arts.filter((a): a is ArtId => (ART_IDS as readonly unknown[]).includes(a))])]
    if (arts.length) out.arts = arts
  }
  if (inv.moves && typeof inv.moves === 'object' && !Array.isArray(inv.moves)) {
    const moves: Inventory['moves'] = {}
    for (const m of MOVES) {
      const n = (inv.moves as Record<string, unknown>)[m.id]
      if (typeof n === 'number' && Number.isFinite(n) && n > 0) moves[m.id] = Math.min(999, Math.floor(n))
    }
    if (Object.keys(moves).length) out.moves = moves
  }
  // An art in hand that is not learned is nothing in hand; a dropped one in hand is the HOP.
  if (OLD_ARTS.includes(inv.selected as string)) out.selected = out.arts?.includes('hop') ? 'hop' : null
  else if (isArtId(inv.selected) && !out.arts?.includes(inv.selected)) out.selected = null
  return out
}
const isArtId = (x: unknown): x is ArtId => (ART_IDS as readonly unknown[]).includes(x)

/** Where the camera wants to be (tile units, top-left) for a view of vw×vh tiles. */
export function cameraFor(s: GameState, vw: number, vh: number): { x: number; y: number } {
  // (A side map's camera keeps a row of its own through a jump, `engine/side.ts`; a room change goes by the hero.)
  const at = sycophantFocus(s)
  const h = { x: at.x, y: (!s.scroll && s.hero.side?.cam) || at.y }
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
  const cam = clampTo(s.zone)
  // The Sycophant's room: its card, and where THE END comes down, are kept in a picture smaller than the room.
  const f = sycophantFrame(s, { x: (cam.x + vw / 2) * TILE, y: (cam.y + vh / 2) * TILE }, { x: vw * TILE, y: vh * TILE }, (x, y) => ({ x: x * TILE, y: y * TILE }))
  return { x: s.zone.w > vw ? f.x / TILE - vw / 2 : cam.x, y: s.zone.h > vh ? f.y / TILE - vh / 2 : cam.y }
}

export { NO_INPUT, HERO_R }

function cleanRings(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {}
  if (raw && typeof raw === 'object') for (const [k, v] of Object.entries(raw)) if (typeof v === 'number' && Number.isFinite(v)) out[k] = Math.max(0, Math.floor(v))
  return out
}

/** Landing from a hole on something solid (a block dropped earlier): step to the nearest free spot. */
function landClear(c: Ctx) {
  stepClear(c.w, c.s)
}

