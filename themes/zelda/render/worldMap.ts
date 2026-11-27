/**
 * The chart: what has been seen of a map (`engine/explore.ts`), in that land's own inks, darker and flatter than the
 * world so that its marks stand out; fog where the hero has not been. The top right corner shows a window of it
 * round the hero (`render/corner.ts`), the menu's MAP page (M) the whole of what has been seen, with the world's
 * chart beside it. Both turn with the world: `e` is the view's turn (0 the classic view, north up; 1 the isometric
 * one, the map a diamond lying as the ground does), so what is up the screen in the world is up the map too.
 *
 * Everything is in the HUD's logical px; the caller sets the scale.
 */
import type { GameState, MapDef, MapState, TileChar, World } from '../types'
import type { HudKeys } from '../keys'
import { cellIndex, condMet, mapDef, mapInfo, type MapInfo } from '../engine/map'
import { charted, chunkGrid, CHUNK, seenAny, seenTile } from '../engine/explore'
import { DAY } from '../engine/day'
import { TILE_INFO, isTileChar } from '../world/tiles'
import { lumaOf } from './looks'
import { projection } from './iso/project'
import { TILE } from '../types'
import { drawMenuTabs, hudFont, type HudSkin } from './hud'

type G = CanvasRenderingContext2D

/** One tile step on the chart, for a turn e and a zoom z (L px a tile in the classic view). */
function axes(e: number, z: number) {
  const p = projection(e)
  return { ax: (p.ex.x / TILE) * z, ay: (p.ex.y / TILE) * z, bx: (p.ey.x / TILE) * z, by: (p.ey.y / TILE) * z }
}

/** Draws a one-px-a-tile canvas so that tile point (fx, fy) lands on (px, py). */
function drawChart(g: G, c: HTMLCanvasElement, e: number, z: number, fx: number, fy: number, px: number, py: number) {
  const { ax, ay, bx, by } = axes(e, z)
  g.save()
  g.imageSmoothingEnabled = false
  g.transform(ax, ay, bx, by, px - (fx * ax + fy * bx), py - (fx * ay + fy * by))
  g.drawImage(c, 0, 0)
  g.restore()
}

// ---- the corner's chart (render/corner.ts): the land's own inks, the fog, the marks ------------------------

/**
 * One look's inks on the corner's chart, taken from the land's own picture (the painters' palettes in
 * `tiles.ts` and `looks.ts`, the isometric view's ground), a step darker and flatter so the marks stand out.
 * Houses are never pink: pink on the chart is the hero and nothing else.
 */
export interface ChartInks {
  /** Open ground and its speckle; tall grass and drained floors. */
  ground: string
  ground2: string
  low: string
  road: string
  /** A pier, a bridge, mine rails. */
  bridge: string
  sand: string
  water: string
  /** Water against anything that is not water: the coastline. */
  shore: string
  ice: string
  /** Two inks, so a wood is not a slab. */
  tree: string
  tree2: string
  bush: string
  /** A wall or cliff: its lit rim, the face it shows to the south, and what lies behind the rim. */
  wall: string
  face: string
  top: string
  /** A roof, and the front under it. */
  house: string
  houseD: string
  fence: string
  door: string
  pit: string
  thing: string
  /** What has not been walked: the two darkest inks of the land. */
  fog: readonly [string, string]
  /** The land's sign on another chart: the fill of the pass tab that leads here. */
  tab: string
}

const inks = (list: string, fog: readonly [string, string], tab: string): ChartInks => {
  const [ground, ground2, low, road, bridge, sand, water, shore, ice, tree, tree2, bush, wall, face, top, house, houseD, fence, door, pit, thing] = list.split(' ').map(c => '#' + c) as string[]
  return { ground: ground!, ground2: ground2!, low: low!, road: road!, bridge: bridge!, sand: sand!, water: water!, shore: shore!, ice: ice!, tree: tree!, tree2: tree2!, bush: bush!, wall: wall!, face: face!, top: top!, house: house!, houseD: houseD!, fence: fence!, door: door!, pit: pit!, thing: thing!, fog, tab }
}

/**
 * The tables, keyed as the game keys a map's looks: its realm, else its `look`, else the palette its kind is
 * painted in (`chartLook`). Columns: ground ground2 low road bridge sand water shore ice tree tree2 bush wall face
 * top house houseD fence door pit thing.
 */
export const CHART_INKS: Readonly<Record<string, ChartInks>> = /* @__PURE__ */ Object.freeze({
  // The coast and the town: teal-blue grass, rose-violet paving, deep sea, warm sand, terracotta roofs.
  coast: /* @__PURE__ */ inks('23536c 2a5e76 1f5e66 8c6c94 7c5258 b49272 102a66 2c62b4 4a90b8 123c46 17504e 1f6a5c 7862ac 46387a 2e2858 b0623c 74402e 8a6a96 dccbee 08050f 55447e', ['#19244a', '#222f5a'], '#4fd0c0'),
  // The Wildwood: moonlit blue woods, near black under the crowns, violet in them.
  wild: /* @__PURE__ */ inks('2c566c 33607a 2c6264 826082 74484c 806a64 0c2058 2a50a0 4a80a8 0e2a2c 2a2864 1a4a50 66549a 3e3270 241e4c 9a5640 663628 76587e c8b8e0 06030c 4c3c70', ['#24203e', '#2e2a4e'], '#2f8a58'),
  // Seter Fell (the `wild` look, but a mountain pasture of its own): green meadow, tan tracks, grey-violet stone.
  seterfell: /* @__PURE__ */ inks('35664c 3e7254 4a8050 b29878 8a5e50 a08c70 163e7c 3474bc 4a90b8 15383a 1c4a40 286850 8a84a8 565078 6a648a ac623a 74402c 6c4a44 dcd0e8 0a0614 8e88a4', ['#1c3236', '#254042'], '#55a058'),
  // Yule Fjord: snow and ice, navy pines, dark fjord, red timber.
  snow: /* @__PURE__ */ inks('93a6d0 a4b6dc 8292c0 8a688e 7a4448 8c7488 123274 3e78c4 5aaad2 223460 2e4a76 405e8c 7068a4 4a4078 b4c0e2 9a443a 662c2a 6c4c62 3a2a50 0a0a22 5c5a8c', ['#2a3668', '#36447a'], '#8fd0ff'),
  // Stillsand: peach dunes on rose hardpan, lilac stone and roads, the gold pyramid, a turquoise oasis.
  dune: /* @__PURE__ */ inks('b07e7a ba8a80 9a6c70 8a74a4 7c4c4c d6a682 0e5466 3aa098 56a0b4 5c2a50 76386a 7c4e66 6a5894 463872 8a78ac c8903c 8a5c2c 6a4a6a ecdcf0 180e28 6c5688', ['#44304e', '#523c5c'], '#f4dfa6'),
  // The Sporelight: indigo moss, violet flags, caps lit blue and violet, black pools with a cyan lip.
  spore: /* @__PURE__ */ inks('225060 29606a 266468 70589a 6e465e 705a68 081440 1e5a94 3a80a0 3450a4 6a329c 7a3c94 4c3c80 30245a 221a4c 8a6a4a 5c4436 5c4a78 c8bce8 05030e 56447e', ['#182044', '#212c52'], '#a77cf0'),
  // Rerun Estates: cut lawns, pink-grey pavers, hedges, terracotta roofs, a cyan sea behind the beach.
  suburb: /* @__PURE__ */ inks('2e7452 367e58 357a52 aa8ea4 7c4a4e b89874 0f5688 52aad4 5aa8c8 17442e 22583a 6c9a34 74608e 4a3a66 5a4a7a b45434 763224 94607a ecdcf0 0a0614 4c5a66', ['#1a3a32', '#23483c'], '#ff9a5a'),
  // Lumenby Quarry: rose earth and ochre benches, violet stone, dark pines, cyan rainwater.
  quarry: /* @__PURE__ */ inks('84566a 8e6072 74584e aa8890 80503e b47648 0e4a6c 3892b4 56a0b8 2a1a48 3c2862 70582e 5c4478 3a2a58 76588e c07e3c 82502c 6c4a66 e4d4e8 120a1c 603c5a', ['#382444', '#442e52'], '#7a8cff'),
  // Fogstage: grey-mauve lowland, mauve cobbles, green turf on the hills, violet water, ochre booths.
  fog: /* @__PURE__ */ inks('7c667e 887088 6c5a76 c2a4ac 7a4e5c ac9498 1a1860 46449c 6a8cb0 163640 204a4c 2c5a4a 6a58a0 44366e 2a564a b8784c 7c4c38 7c5a78 ecd8ec 0c0818 5a4a68', ['#3a3052', '#483c60'], '#a8b0c8'),
  // The Shrine (and every dungeon painted in its stone): violet floors, lit wall rims, solid rock near black.
  shrine: /* @__PURE__ */ inks('342c6c 3a3274 2e2660 584894 80504e 6a5668 14286e 305cb4 4e90c0 1c4a48 24584e 2a6458 8468c8 4a3a88 17112e 8a5c44 5c3c30 8a74b0 dccbee 04020a 9a74b8', ['#221a44', '#2c2354'], '#c8a0ff'),
  // Project Horizon's labs: navy deck plates, steel walls, teal coolant.
  lab: /* @__PURE__ */ inks('243050 2a385a 202a46 46567e 6a5450 5a5668 0e4c56 2aa092 4e90b0 1c4a48 24584e 2a6458 627cb8 36466e 0c101e 7a6a58 50443a 6a7aa8 cfe8f4 030409 6e80b0', ['#1a2440', '#243050'], '#2ff3c8'),
  // The Underglow: violet-black galleries, violet brick, timber rails.
  underglow: /* @__PURE__ */ inks('36265c 3e2c64 2e2052 5c447e 94583e 8a6050 12245e 2c58a8 4a88b0 3a2450 4a2e62 5a4a50 7e4ea0 4c2e6e 150c26 9a6440 66402c 7a5a78 e0ccf0 030106 8a5a7c', ['#281a44', '#332254'], '#ff8a3d'),
  // The plain violet chart of before: what a look without a table falls back to (a test names any map that does).
  old: /* @__PURE__ */ inks('3a2d5c 3a2d5c 2c2246 6d5a9a 6d5a9a 6b5470 1d5d8c 1d5d8c 5fa8c8 1f4a3d 1f4a3d 2b5c48 9a8cc4 9a8cc4 9a8cc4 c04a8c c04a8c 4e416f ffd23f 120a22 4e416f', ['#120a26', '#1c1238'], '#b9a8d9'),
})

/**
 * The ink table of a map: its realm's own where it has one (Seter Fell, the Underglow), else its look's
 * (`MapDef.look`), else the palette its kind is painted in (the coast's out of doors, the Shrine's stone in a
 * dungeon). 'old' for a look no table knows, and for a room indoors (never charted).
 */
export function chartLook(def: Pick<MapDef, 'look' | 'realm' | 'kind'>): string {
  const has = (k: string) => Object.prototype.hasOwnProperty.call(CHART_INKS, k)
  if (def.realm && has(def.realm)) return def.realm
  if (def.look) return has(def.look) ? def.look : 'old'
  return def.kind === 'overworld' ? 'coast' : def.kind === 'dungeon' ? 'shrine' : 'old'
}

export function chartInks(def: Pick<MapDef, 'look' | 'realm' | 'kind'>): ChartInks {
  return CHART_INKS[chartLook(def)]!
}

type Ground = Exclude<keyof ChartInks, 'fog' | 'tab' | 'ground2' | 'shore' | 'face' | 'top' | 'houseD' | 'tree2'>

/** What each tile is on the corner's chart. A tile not here is `thing` when solid, open ground when not; a lone small thing (a sign, a lamp, a chest: it has its mark) is ground too, so the chart is not freckled. */
const CORNER_KIND: Partial<Record<TileChar, Ground>> = {
  '.': 'ground', ':': 'ground', ';': 'low', 'ψ': 'low', ',': 'road', '=': 'bridge', '-': 'sand',
  '~': 'water', 'ω': 'water', 'α': 'ice',
  'T': 'tree', '*': 'bush', 'l': 'bush', 'Y': 'bush',
  '#': 'wall', '%': 'wall', '^': 'wall', '[': 'wall', 'q': 'wall', 'I': 'wall', 'X': 'wall', 'а': 'wall', 'е': 'wall',
  'H': 'house', 'M': 'house', 'D': 'door', '>': 'door', 'L': 'door', 'K': 'door',
  'O': 'pit', 'к': 'pit', 'F': 'fence', '¤': 'fence',
  'в': 'ground', 'д': 'sand', 'ж': 'road', 'з': 'road', 'и': 'road', 'й': 'road',
  'S': 'ground', 't': 'ground', '$': 'ground', 'Z': 'ground', '_': 'ground',
}

function cornerKind(ch: TileChar): Ground {
  return CORNER_KIND[ch] ?? (isTileChar(ch) && TILE_INFO[ch].solid ? 'thing' : 'ground')
}

/** A steady scatter, 0–1, by tile. */
function scatter(x: number, y: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

function blend(a: string, b: string, t: number): string {
  const x = parseInt(a.slice(1), 16)
  const y = parseInt(b.slice(1), 16)
  let out = 0
  for (let i = 16; i >= 0; i -= 8) out = out * 256 + Math.round(((x >> i) & 255) * (1 - t) + ((y >> i) & 255) * t)
  return '#' + out.toString(16).padStart(6, '0')
}

/** The corner's chart of a map: one ink a tile, row by row; what is unseen is fog. */
export interface ChartLayer {
  w: number
  h: number
  inks: ChartInks
  px: readonly string[]
}

/**
 * The fog's own two inks, and the ghost of the land under it out of doors: where the water lies and where the
 * walls, cliffs and pits run, each hardly lighter or bluer than the fog round it. Enough that a land just arrived
 * in is a map with a shape and not a slab; the roads, the houses and everything else wait to be walked to. (A
 * dungeon has no ghost: its floor plan is for finding, and a room shows whole on entry.)
 */
export function fogInks(c: ChartInks): { a: string; b: string; water: string; wall: string; pit: string } {
  const [a, b] = c.fog
  // The water's own colour where that stands off the fog; a land whose water is as dark as its fog (the
  // Sporelight, the Shrine) shows the ghost in the shore's blue.
  let water = blend(blend(a, c.water, 0.7), c.shore, 0.2)
  if (Math.abs(lumaOf(water) - lumaOf(a)) < 0.035) water = blend(a, c.shore, 0.55)
  return { a, b, water, wall: blend(b, c.wall, 0.3), pit: blend(a, '#000000', 0.55) }
}

/**
 * How dark the hour is on the chart once the Sun Prism has started the day (`engine/day.ts`): 0 by day, at dusk and
 * at dawn (and before the prism, at the stuck dusk), 1 in the blue hours, 2 in the night. Steps, never a fade.
 */
export function nightLevel(daytime: number | null): 0 | 1 | 2 {
  if (daytime === null) return 0
  const t = ((daytime % 720) + 720) % 720
  if (t >= DAY.night && t < DAY.nightEnd) return 2
  if ((t >= DAY.blueEve && t < DAY.night) || (t >= DAY.nightEnd && t < DAY.blueMorn)) return 1
  return 0
}

/** The ink the chart is dimmed toward at night, and how far at each level. */
export const NIGHT_INK = '#101a50'
export const NIGHT_MIX = [0, 0.22, 0.4] as const

/** The night level of the chart of the map the hero is on: under the open sky only (a cave has no hours). */
export function chartNight(world: World, s: GameState): 0 | 1 | 2 {
  return mapDef(world, s.map.id)?.kind === 'overworld' ? nightLevel(s.daytime) : 0
}

export interface ChartPaint {
  /** Unseen ground in fog (with the ghost of its water and cliffs out of doors); false: left clear (null). */
  fog: boolean
  /** The ghost under the fog (false for the lab's comparison). */
  ghost?: boolean
  night?: 0 | 1 | 2
}

/**
 * One ink a tile for a map's tiles (`tiles`: the live ones, or the authored `info.base`), what is not seen in fog or
 * clear. Pure.
 */
export function chartPixels(info: MapInfo, tiles: readonly TileChar[], terrain: MapState['terrain'] | undefined, seen: (x: number, y: number) => boolean, o: ChartPaint): Array<string | null> {
  const { w, h } = info
  const c = chartInks(info.def)
  const fog = fogInks(c)
  const kinds = tiles.map(cornerKind)
  const at = (x: number, y: number): Ground | null => (x < 0 || y < 0 || x >= w || y >= h ? null : kinds[y * w + x]!)
  const wet = (k: Ground | null) => k === null || k === 'water' || k === 'ice' || k === 'bridge'
  const rise = (x: number, y: number) => (!terrain || x < 0 || y < 0 || x >= w || y >= h ? 0 : terrain.h[y * w + x]! - terrain.g)
  /** A wall with nothing but wall (or the map's edge) all round it: the mass behind a cliff's rim. */
  const buried = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = at(x + dx, y + dy); if (n !== null && n !== 'wall') return false }
    return true
  }
  const outline = (o.ghost ?? true) && info.def.kind === 'overworld'
  const mix = NIGHT_MIX[o.night ?? 0]
  const dimmed = new Map<string, string>()
  const dim = (ink: string) => {
    if (!mix) return ink
    let d = dimmed.get(ink)
    if (!d) dimmed.set(ink, d = blend(ink, NIGHT_INK, mix))
    return d
  }
  const px = new Array<string | null>(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x
      const k = kinds[i]!
      if (!seen(x, y)) {
        if (!o.fog) { px[i] = null; continue }
        // A sparse grain that moves with the land: the mark of ground not walked.
        const grain = (x * 3 + y * 5) % 11 < 2 || scatter(x, y) < 0.08
        px[i] = dim(!outline ? (grain ? fog.b : fog.a)
          : k === 'water' ? fog.water : k === 'pit' ? fog.pit : k === 'wall' && !buried(x, y) ? fog.wall : grain ? fog.b : fog.a)
        continue
      }
      let ink: string = c[k]
      if (k === 'water') {
        if (!wet(at(x - 1, y)) || !wet(at(x + 1, y)) || !wet(at(x, y - 1)) || !wet(at(x, y + 1))) ink = c.shore
      } else if (k === 'wall') {
        const south = at(x, y + 1)
        if (south !== null && south !== 'wall') ink = c.face
        else if (buried(x, y)) ink = c.top
      } else if (k === 'house') {
        if (at(x, y + 1) !== 'house') ink = c.houseD
      } else if (k === 'tree') {
        if (scatter(x, y) < 0.42) ink = c.tree2
      } else if (k === 'ground') {
        if (tiles[i] === 'в' || scatter(x, y) < 0.13) ink = c.ground2
      }
      // A map with heights (`engine/terrain.ts`): a bench's southern drop is a dark line.
      if (terrain && k !== 'wall' && k !== 'water' && k !== 'pit' && rise(x, y) > rise(x, y + 1)) ink = c.face
      px[i] = dim(ink)
    }
  }
  return px
}

/** Builds the chart of the current map from the live tiles and what has been seen of it, unseen in fog. Pure. `ghost`: false leaves the fog bare (for the lab's comparison). */
export function buildChart(world: World, s: GameState, ghost = true, night: 0 | 1 | 2 = 0): ChartLayer {
  const info = mapInfo(world, s.map.id)
  const px = chartPixels(info, s.map.tiles, s.map.terrain, (x, y) => seenTile(s, s.map.id, info.w, x, y), { fog: true, ghost, night }) as string[]
  return { w: info.w, h: info.h, inks: chartInks(info.def), px }
}

const layers = /* @__PURE__ */ new WeakMap<GameState['map'], { key: string; layer: ChartLayer }>()

/** The current map's chart, made again only when its tiles, what has been seen of it or the hour's level change. */
export function chartLayer(world: World, s: GameState): ChartLayer {
  const night = chartNight(world, s)
  const key = `${s.map.id}|${s.map.version}|${s.explored?.[s.map.id] ?? ''}|${night}`
  const hit = layers.get(s.map)
  if (hit?.key === key) return hit.layer
  const layer = buildChart(world, s, true, night)
  layers.set(s.map, { key, layer })
  return layer
}

// ---- the marks pass -----------------------------------------------------------------------------------------

export type ChartMarkKind = 'hero' | 'chest' | 'heart' | 'door' | 'pass' | 'pip'
export type ChartMarkState = 'up' | 'down' | 'left' | 'right' | 'closed' | 'opened' | 'lying' | 'taken' | 'open' | 'seen' | 'unseen' | 'lit' | 'dark'

/** One thing to mark on the chart, at tile (x, y). `to`: the land a pass leads to. `n`: a pip's number, 1–7. */
export interface ChartMark {
  kind: ChartMarkKind
  x: number
  y: number
  state: ChartMarkState
  to?: string
  n?: number
}

/** The frame the marks are laid on (`render/corner.ts`), in the chart's own px. */
export interface ChartView {
  /** The isometric chart (the frame past the half of its turn). */
  iso: boolean
  /** The px of tile (tx, ty), inside the frame or not. */
  at(tx: number, ty: number): readonly [number, number]
  /** The top left for a w × h shape by (x, y), centred there or `far` px off at most, wholly inside the glass, clear of the gem and of `taken`; null where there is none. */
  fit(x: number, y: number, w: number, h: number, far: number, taken: readonly Box[]): readonly [number, number] | null
  /** True when the tile lies well inside the window. */
  near(tx: number, ty: number): boolean
  /** The middle of a tab on the rim, toward tile (tx, ty), clear of the gem and of `taken`. */
  rim(tx: number, ty: number, taken: readonly Box[]): readonly [number, number] | null
  /** The two px of the frame's lower edge where the n-th of seven pips sits, left to right. */
  pip(n: number): ReadonlyArray<readonly [number, number]>
}
export interface Box { x: number; y: number; w: number; h: number }

export interface MarkInks { ink: string; edge: string; hot: string; prize: string; dim: string }
type Put = (x: number, y: number, color: string) => void

const FAINT = '#7a6ab0'
const SOCKET = '#54259e'
const PALE = '#f2e9ff'
export const HERO_NOSE = '#ffe4f6'
export const HERO_BLINK = '#ff86cc'

/** The marks' pixels (`.` clear). `A` is the arch's or chest's own colour, `K` ink. */
export const MARK_ART = {
  chest: ['LLL', 'GKG', 'GGG'],
  opened: ['DDD', 'DKD', 'DDD'],
  heart: ['R.R', 'RRR', '.R.'],
  taken: ['D.D', 'DDD', '.D.'],
  door: ['.P.', 'PKP', 'PKP'],
  gate: ['CCC', 'CKC', 'CKC'],
  hero: ['PPP', 'PPP', 'PPP'],
  heroIso: ['.PP.', 'PPPP', '.PP.'],
} as const

/** Art with a one-px ink line round it, its top left at (x, y). */
function stamp(put: Put, rows: readonly string[], x: number, y: number, pal: Record<string, string>, ink: string) {
  const on = (i: number, j: number) => !!rows[j]?.[i] && rows[j]![i] !== '.'
  for (let j = -1; j <= rows.length; j++) {
    for (let i = -1; i <= rows[0]!.length; i++) {
      if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) put(x + i, y + j, ink)
    }
  }
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(x + i, y + j, pal[row[i]!] ?? ink) })
}

/** Who gets the room when two marks would lie on each other; the later ones move over or are left out. */
const RANK: Record<ChartMarkKind, number> = { hero: 0, pip: 1, pass: 2, chest: 3, heart: 4, door: 5 }

/** The way the hero faces, on screen: a unit step in chart px. */
export function facing(dir: ChartMarkState, iso: boolean): readonly [number, number] {
  const v = dir === 'up' ? [0, -1] : dir === 'left' ? [-1, 0] : dir === 'right' ? [1, 0] : [0, 1]
  if (!iso) return [v[0]!, v[1]!]
  return [v[0]! - v[1]!, (v[0]! + v[1]!) / 2]
}

/**
 * The marks, drawn in the chart's px over the glass: never part of the cached chart, always on the grid. `lit`:
 * the hero's blink is on its bright step. `tab`: the ink of the land a pass leads to.
 */
export function drawChartMarks(put: Put, marks: readonly ChartMark[], view: ChartView, c: MarkInks, lit: boolean, tab: (to: string) => string) {
  const taken: Box[] = []
  const jobs: Array<() => void> = []
  const order = [...marks].sort((a, b) => RANK[a.kind] - RANK[b.kind] || Number(b.state === 'closed' || b.state === 'lying') - Number(a.state === 'closed' || a.state === 'lying'))
  for (const m of order) {
    const [px, py] = view.at(m.x, m.y)
    if (m.kind === 'hero') {
      const art = view.iso ? MARK_ART.heroIso : MARK_ART.hero
      const w = art[0].length
      const x = px - Math.floor((w - 1) / 2)
      const y = py - 1
      taken.push({ x: x - 1, y: y - 1, w: w + 2, h: art.length + 2 })
      const [dx, dy] = facing(m.state, view.iso)
      jobs.push(() => {
        const body = lit ? c.hot : HERO_BLINK
        stamp(put, art, x, y, { P: body }, c.ink)
        // The nose: a pale px just past the body, the way they face, in an ink line of its own.
        const nx = view.iso ? x + (dx > 0 ? w : -1) : x + 1 + dx * 2
        const ny = view.iso ? y + (dy > 0 ? 2 : 0) : y + 1 + dy * 2
        put(nx + Math.sign(dx), ny, c.ink)
        put(nx, ny + Math.sign(dy), c.ink)
        put(nx, ny, HERO_NOSE)
      })
      continue
    }
    if (m.kind === 'pip') {
      // A socket let into the rim itself, so it is never taken for a chest on the land: two px of the edge and
      // the ring under it, gold once its letter is lit, dark before, an ink line on either side.
      const cols = view.pip(m.n ?? 1)
      const [a, b] = [cols[0]!, cols[cols.length - 1]!]
      taken.push({ x: a[0] - 1, y: Math.min(a[1], b[1]) - 1, w: b[0] - a[0] + 3, h: Math.abs(a[1] - b[1]) + 3 })
      const fill = m.state === 'lit' ? c.prize : SOCKET
      jobs.push(() => {
        for (const [x, y] of cols) { put(x, y - 1, c.ink); put(x, y, fill); put(x, y + 1, fill) }
        for (const [x, y] of [[a[0] - 1, a[1]], [b[0] + 1, b[1]]] as const) { put(x, y, c.ink); put(x, y + 1, c.ink) }
      })
      continue
    }
    if (m.kind === 'pass') {
      const spot = view.near(m.x, m.y) ? view.fit(px, py, 3, 3, 3, taken) : null
      if (spot) {
        const [x, y] = spot
        taken.push({ x, y, w: 3, h: 3 })
        jobs.push(() => stamp(put, MARK_ART.gate, x, y, { C: c.edge, K: c.ink }, c.ink))
        continue
      }
      const at = view.rim(m.x, m.y, taken)
      if (!at) continue
      const [x, y] = [at[0] - 2, at[1] - 2]
      taken.push({ x, y, w: 5, h: 5 })
      const seen = m.state === 'seen'
      const fill = tab(m.to ?? '')
      jobs.push(() => {
        for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
          const rim = i === 0 || j === 0 || i === 4 || j === 4
          // Walked into: the land's own ink in an ink line. Not yet: an empty box, its sides lilac, nothing in it.
          put(x + i, y + j, seen ? (rim ? c.ink : fill) : rim ? FAINT : c.ink)
        }
      })
      continue
    }
    const done = m.state === 'opened' || m.state === 'taken'
    const art = m.kind === 'chest' ? (done ? MARK_ART.opened : MARK_ART.chest) : m.kind === 'heart' ? (done ? MARK_ART.taken : MARK_ART.heart) : MARK_ART.door
    const spot = view.fit(px, py, 3, 3, 2, taken)
    if (!spot) continue
    const [x, y] = spot
    taken.push({ x, y, w: 3, h: 3 })
    const pal = { G: c.prize, L: '#fff1b0', K: c.ink, R: '#ff5a6a', D: FAINT, P: PALE }
    // What is done with lies flat on the chart, with no ink line to lift it.
    jobs.push(done
      ? () => art.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(x + i, y + j, pal[row[i] as keyof typeof pal]) })
      : () => stamp(put, art, x, y, pal, c.ink))
  }
  // The most important last, on top.
  for (let i = jobs.length - 1; i >= 0; i--) jobs[i]!()
}

// ---- passes and marks ----------------------------------------------------------------------------------------

export interface LandPass { x: number; y: number; to: string }

const passes = /* @__PURE__ */ new WeakMap<World, Map<string, LandPass[]>>()

/**
 * The ways from a map of the grid to another: the open runs of its rim that meet open ground across the seam
 * (`World.atlas`, `edgeOut` in `engine/game.ts`) and its warps into another map of the grid (the gates, the
 * ferry). One a run, at the run's middle tile.
 */
export function landPasses(world: World, id: string): LandPass[] {
  let byMap = passes.get(world)
  if (!byMap) passes.set(world, byMap = new Map())
  const hit = byMap.get(id)
  if (hit) return hit
  const out: LandPass[] = []
  const atlas = world.atlas ?? {}
  const here = atlas[id]
  if (here) {
    const info = mapInfo(world, id)
    const found = new Map<string, Array<[number, number]>>()
    const add = (to: string, x: number, y: number) => {
      const list = found.get(to) ?? []
      if (!list.some(([a, b]) => a === x && b === y)) list.push([x, y])
      found.set(to, list)
    }
    const open = (m: MapInfo, x: number, y: number) => !TILE_INFO[m.base[y * m.w + x]!].solid
    for (const [to, o] of Object.entries(atlas)) {
      if (to === id || !mapDef(world, to)) continue
      const there = mapInfo(world, to)
      const meet = (x: number, y: number, gx: number, gy: number) => {
        const nx = here.x + gx - o.x
        const ny = here.y + gy - o.y
        if (nx >= 0 && ny >= 0 && nx < there.w && ny < there.h && open(info, x, y) && open(there, nx, ny)) add(to, x, y)
      }
      for (let x = 0; x < info.w; x++) { meet(x, 0, x, -1); meet(x, info.h - 1, x, info.h) }
      for (let y = 0; y < info.h; y++) { meet(0, y, -1, y); meet(info.w - 1, y, info.w, y) }
    }
    for (const wp of info.warps) {
      if (!atlas[wp.to] || wp.to === id) continue
      for (let y = wp.y; y < wp.y + wp.h; y++) for (let x = wp.x; x < wp.x + wp.w; x++) add(wp.to, x, y)
    }
    for (const [to, list] of found) for (const [x, y] of clusters(list)) out.push({ x, y, to })
  }
  byMap.set(id, out)
  return out
}

/** Tiles within two steps of one another are one thing; each group gives the tile of it nearest its middle. */
function clusters(list: Array<[number, number]>): Array<[number, number]> {
  const left = [...list]
  const out: Array<[number, number]> = []
  while (left.length) {
    const group = [left.shift()!]
    for (let i = 0; i < group.length; i++) {
      for (let j = left.length - 1; j >= 0; j--) {
        if (Math.max(Math.abs(left[j]![0] - group[i]![0]), Math.abs(left[j]![1] - group[i]![1])) <= 2) group.push(...left.splice(j, 1))
      }
    }
    const mx = group.reduce((a, p) => a + p[0], 0) / group.length
    const my = group.reduce((a, p) => a + p[1], 0) / group.length
    out.push(group.sort((a, b) => Math.hypot(a[0] - mx, a[1] - my) - Math.hypot(b[0] - mx, b[1] - my))[0]!)
  }
  return out
}

/** True where there is a chart to show: a charted map (`engine/explore.ts`), in a game being played (not a cabinet's demo). */
export function hasChart(world: World, s: GameState): boolean {
  const def = mapDef(world, s.map.id)
  return !!def && charted(def) && !s.demo
}

/**
 * What the chart marks, from the game's data and the save: the hero, then the doors, stairs and warps, the ways to
 * other lands, heart pieces and chests of the seen squares, and the seven letters of Lumenby's sign (a tally on
 * the rim, so listed whether or not their sockets have been seen). Pure.
 */
export function chartMarks(world: World, s: GameState): ChartMark[] {
  if (!hasChart(world, s)) return []
  const id = s.map.id
  const info = mapInfo(world, id)
  const seen = (x: number, y: number) => seenTile(s, id, info.w, x, y)
  const flag = (f: string) => s.flags[f] === true
  const out: ChartMark[] = [{ kind: 'hero', x: Math.floor(s.hero.x), y: Math.floor(s.hero.y), state: s.hero.dir }]

  const doors = new Map<string, Array<[number, number]>>()
  const door = (to: string, x: number, y: number) => doors.set(to, [...(doors.get(to) ?? []), [x, y]])
  const onGrid = !!world.atlas?.[id]
  for (const wp of info.warps) {
    // (On the grid a way into another map of the grid is a pass, below.)
    if (onGrid && world.atlas?.[wp.to]) continue
    for (let y = wp.y; y < wp.y + wp.h; y++) for (let x = wp.x; x < wp.x + wp.w; x++) door(wp.to, x, y)
  }
  for (const e of info.exits.values()) door(`exit:${e.id}`, Math.floor(e.x), Math.floor(e.y))
  for (const list of doors.values()) for (const [x, y] of clusters(list)) if (seen(x, y)) out.push({ kind: 'door', x, y, state: 'open' })

  for (const p of landPasses(world, id)) {
    if (!seen(p.x, p.y)) continue
    // The coast and the Wildwood are known from the start (as on the MAP page); a land once walked into.
    const known = !mapDef(world, p.to)?.away || flag(`seen:${p.to}`)
    out.push({ kind: 'pass', x: p.x, y: p.y, state: known ? 'seen' : 'unseen', to: p.to })
  }

  for (const m of info.marks) {
    const e = m.ent
    if (e.t !== 'item' || e.item !== 'heartPiece' || !seen(m.x, m.y)) continue
    const taken = flag(`took:${e.id}`)
    if (!taken && e.appear && !condMet(s, world, e.appear, cellIndex(info, m.x + 0.5, m.y + 0.5))) continue
    out.push({ kind: 'heart', x: m.x, y: m.y, state: taken ? 'taken' : 'lying' })
  }

  for (const c of info.chestList) {
    if (!seen(c.x, c.y)) continue
    const opened = flag(`chest:${c.id}`)
    // (The engine sets `appear:<id>` the moment the chest's condition is met.)
    if (c.appear && !opened && !flag(`appear:${c.id}`)) continue
    out.push({ kind: 'chest', x: c.x, y: c.y, state: opened ? 'opened' : 'closed' })
  }

  const pips: ChartMark[] = []
  for (const m of info.marks) {
    const e = m.ent
    if (e.t !== 'socket') continue
    const n = /^q\.lumenby\.sign([1-7])$/.exec(e.flag)?.[1]
    if (n) pips.push({ kind: 'pip', x: m.x, y: m.y, n: Number(n), state: flag(e.flag) ? 'lit' : 'dark' })
  }
  return [...out, ...pips.sort((a, b) => a.n! - b.n!)]
}

// ---- the MAP page -------------------------------------------------------------------------------------------

/** The tiles round what has been seen of the current map, two tiles of room on every side, at least 24 × 16. */
function seenBounds(s: GameState, w: number, h: number): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const { cw, ch } = chunkGrid(w, h)
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      if (!seenTile(s, s.map.id, w, cx * CHUNK, cy * CHUNK)) continue
      x0 = Math.min(x0, cx * CHUNK); y0 = Math.min(y0, cy * CHUNK)
      x1 = Math.max(x1, Math.min(w, (cx + 1) * CHUNK)); y1 = Math.max(y1, Math.min(h, (cy + 1) * CHUNK))
    }
  }
  if (x0 > x1) return { x: 0, y: 0, w, h }
  const grow = (a: number, b: number, least: number, max: number) => {
    let lo = a - 2
    let hi = b + 2
    const short = least - (hi - lo)
    if (short > 0) { lo -= short / 2; hi += short / 2 }
    return [Math.max(0, lo), Math.min(max, hi)] as const
  }
  const [X0, X1] = grow(x0, x1, 24, w)
  const [Y0, Y1] = grow(y0, y1, 16, h)
  return { x: X0, y: Y0, w: X1 - X0, h: Y1 - Y0 }
}

/** The name over the map: the area the hero is in where the map has named ones, else the map's own. */
function placeName(s: GameState, def: MapDef): string {
  return (s.area || def.name || '').toUpperCase()
}

/** The grid's extent (`World.atlas`): every outdoor map's rectangle on it, and the box round them all. */
function atlasBox(world: World) {
  const rects = Object.entries(world.atlas ?? {}).flatMap(([id, o]) => {
    const def = world.maps[id]
    return def ? [{ id, x: o.x, y: o.y, w: def.rows[0]!.length, h: def.rows.length, away: !!def.away }] : []
  })
  const x0 = Math.min(...rects.map(r => r.x))
  const y0 = Math.min(...rects.map(r => r.y))
  const x1 = Math.max(...rects.map(r => r.x + r.w))
  const y1 = Math.max(...rects.map(r => r.y + r.h))
  return { rects, x0, y0, w: x1 - x0, h: y1 - y0 }
}

/** The world chart's size in px for a scale (px a tile). */
export function worldChart(world: World, scale: number): { w: number; h: number } {
  const b = atlasBox(world)
  return { w: Math.ceil(b.w * scale), h: Math.ceil(b.h * scale) }
}

/** A chart as a one-px-a-tile canvas (null px left clear), cached against `key` in `cache` under `owner`. */
function chartCanvas<K extends object>(cache: WeakMap<K, { key: string; c: HTMLCanvasElement }>, owner: K, key: string, w: number, h: number, paint: (g: G) => void): HTMLCanvasElement {
  const hit = cache.get(owner)
  if (hit?.key === key) return hit.c
  const c = hit?.c ?? document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.clearRect(0, 0, w, h)
  paint(g)
  cache.set(owner, { key, c })
  return c
}

function fillPixels(g: G, px: ReadonlyArray<string | null>, w: number, ox = 0, oy = 0) {
  for (let i = 0; i < px.length; i++) {
    const c = px[i]
    if (!c) continue
    g.fillStyle = c
    g.fillRect(ox + (i % w), oy + Math.floor(i / w), 1, 1)
  }
}

/** The current map's chart as a canvas for the MAP page: the corner's own chart (`chartLayer`), one px a tile. */
const pages = /* @__PURE__ */ new WeakMap<GameState['map'], { key: string; c: HTMLCanvasElement }>()
function pageCanvas(world: World, s: GameState): HTMLCanvasElement {
  const layer = chartLayer(world, s)
  const key = `${s.map.version}|${s.explored?.[s.map.id] ?? ''}|${chartNight(world, s)}`
  return chartCanvas(pages, s.map, key, layer.w, layer.h, g => fillPixels(g, layer.px, layer.w))
}

/** The whole grid as a chart, one px a tile, what has been seen of each known map drawn where it lies in its own inks. */
const worlds = /* @__PURE__ */ new WeakMap<GameState['flags'], { key: string; c: HTMLCanvasElement }>()
function worldCanvas(world: World, s: GameState): HTMLCanvasElement {
  const b = atlasBox(world)
  const known = b.rects.filter(r => !r.away || !!s.flags[`seen:${r.id}`] || r.id === s.map.id)
  const key = known.map(r => `${r.id}:${s.explored?.[r.id] ?? ''}`).join('|')
  return chartCanvas(worlds, s.flags, key, b.w, b.h, g => {
    for (const r of known) {
      const info = mapInfo(world, r.id)
      fillPixels(g, chartPixels(info, info.base, undefined, (x, y) => seenTile(s, r.id, r.w, x, y), { fog: false }), r.w, r.x - b.x0, r.y - b.y0)
    }
  })
}

/**
 * The whole world on one small chart (`docs/worlds/atlas.md`): every map of the grid where it lies, with what has
 * been seen of it in the chart's colours, the coast and the Wildwood always, a land once walked into (`seen:<id>`).
 * The map the hero is on is framed in the prize colour and the hero is a hot dot. North is up: a plan of where the
 * lands lie and how much of them has been walked.
 */
function drawWorldChart(g: G, world: World, s: GameState, x: number, y: number, scale: number, skin: HudSkin) {
  const b = atlasBox(world)
  // Each known map a dim block, so a land walked into shows where it lies before much of it is seen.
  for (const r of b.rects) {
    if (r.away && !s.flags[`seen:${r.id}`] && r.id !== s.map.id) continue
    g.fillStyle = skin.slot
    g.fillRect(x + Math.round((r.x - b.x0) * scale), y + Math.round((r.y - b.y0) * scale), Math.max(2, Math.round(r.w * scale)), Math.max(2, Math.round(r.h * scale)))
  }
  g.save()
  g.imageSmoothingEnabled = false
  g.drawImage(worldCanvas(world, s), x, y, Math.round(b.w * scale), Math.round(b.h * scale))
  g.restore()
  const here = b.rects.find(r => r.id === s.map.id)
  if (here) {
    g.strokeStyle = skin.prize
    g.lineWidth = 1
    g.strokeRect(x + Math.round((here.x - b.x0) * scale) + 0.5, y + Math.round((here.y - b.y0) * scale) + 0.5, Math.round(here.w * scale) - 1, Math.round(here.h * scale) - 1)
  }
  const o = world.atlas?.[s.map.id]
  if (o) {
    const hx = x + Math.round((o.x + s.hero.x - b.x0) * scale)
    const hy = y + Math.round((o.y + s.hero.y - b.y0) * scale)
    g.fillStyle = skin.outline
    g.fillRect(hx - 2, hy - 2, 4, 4)
    g.fillStyle = skin.hot
    g.fillRect(hx - 1, hy - 1, 2, 2)
  }
}

/** The world chart beside this map: on a map of the grid, once the blade is in hand (before it, the coast is all). */
function showsWorld(world: World, s: GameState): boolean {
  return s.inv.sword && !!world.atlas?.[s.map.id]
}

export interface MapPageOpts {
  keys: HudKeys
  /** The view's turn (0 classic, 1 isometric). */
  e: number
  view: string
}

/** The MAP page of the menu: tabs, the map of where the hero is, and the world's chart beside it. */
export function drawMapPage(g: G, world: World, s: GameState, vw: number, vh: number, o: MapPageOpts, skin: HudSkin) {
  g.fillStyle = skin.veil
  g.fillRect(0, 0, vw, vh)
  const F = hudFont(skin)
  const def = mapDef(world, s.map.id)!
  const info = mapInfo(world, s.map.id)
  const w = Math.min(vw - 16, 320)
  const x = Math.round((vw - w) / 2)
  // A tall screen (a phone held upright) gets a squarer map; the touch deck holds the bottom.
  const below = o.keys.touch ? 84 : 40
  const ph = Math.max(96, Math.min(vh - 22 - below, vh > vw * 1.3 ? Math.round(w * 1.1) : 180))
  const top = Math.max(8, Math.round((vh - below - ph - 14) / 2))
  let y = drawMenuTabs(g, 'map', vw, top, o.keys, skin)
  skin.panel(g, x, y, w, ph, 'cool')
  const name = placeName(s, def)
  F.draw(g, name, x + 8, y + 7, skin.prize)
  // On the grid's maps (once the blade is in hand) the whole world's chart stands at the right.
  const fr = showsWorld(world, s)
  // (Beside the map on a wide screen, under it on an upright phone, where the width is what the map is short of.)
  const tall = ph > w
  const full = fr ? worldChart(world, 1) : null
  const scale = full ? Math.min(tall ? (w - 16) / full.w : 130 / full.w, (ph - 40) * (tall ? 0.42 : 1) / full.h) : 0
  const grid = full ? worldChart(world, scale) : null
  const area = { x: x + 8, y: y + 20, w: w - 16 - (grid && !tall ? grid.w + 10 : 0), h: ph - 28 - (grid && tall ? grid.h + 18 : 0) }
  if (grid) {
    const gx = tall ? x + Math.round((w - grid.w) / 2) : x + w - 8 - grid.w
    const gy = tall ? area.y + area.h + 4 : area.y
    drawWorldChart(g, world, s, gx, gy, scale, skin)
    F.draw(g, 'THE WORLD', tall ? Math.round(x + (w - F.width('THE WORLD')) / 2) : gx, gy + grid.h + 4, skin.dim)
  }
  if (!charted(def) || !seenAny(s, s.map.id)) {
    const say = charted(def) ? 'NOTHING SEEN YET' : 'NO MAP INDOORS'
    F.draw(g, say, area.x + Math.round((area.w - F.width(say)) / 2), area.y + Math.round(area.h / 2) - 4, skin.faint)
  } else {
    // What has been seen of the map, as large as fits (never closer than six px a tile), in the fog of the rest.
    const b = seenBounds(s, info.w, info.h)
    const corners = [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]] as const
    const { ax, ay, bx, by } = axes(o.e, 1)
    const px = corners.map(([cx, cy]) => cx * ax + cy * bx)
    const py = corners.map(([cx, cy]) => cx * ay + cy * by)
    const bw = Math.max(...px) - Math.min(...px)
    const bh = Math.max(...py) - Math.min(...py)
    const z = Math.min(6, area.w / bw, area.h / bh)
    const midX = (Math.max(...px) + Math.min(...px)) / 2
    const midY = (Math.max(...py) + Math.min(...py)) / 2
    // The map's middle on the area's middle: (fx, fy) is the tile point under it.
    const det = ax * by - bx * ay
    const fx = (midX * by - midY * bx) / det
    const fy = (midY * ax - midX * ay) / det
    const cx = area.x + area.w / 2
    const cy = area.y + area.h / 2
    g.save()
    g.beginPath()
    g.rect(area.x, area.y, area.w, area.h)
    g.clip()
    drawChart(g, pageCanvas(world, s), o.e, z, fx, fy, cx, cy)
    g.restore()
    const at = (tx: number, ty: number) => ({ x: cx + ((tx - fx) * ax + (ty - fy) * bx) * z, y: cy + ((tx - fx) * ay + (ty - fy) * by) * z })
    // The names of the areas seen, where they do not lie over one another: under the marks, so the hero and what is marked are never hidden by a name.
    const placed: Array<{ x: number; y: number; w: number }> = []
    for (const a of def.areas ?? []) {
      const tx = a.x + a.w / 2
      const ty = a.y + a.h / 2
      if (!seenTile(s, s.map.id, info.w, Math.floor(tx), Math.floor(ty))) continue
      const label = a.name.toUpperCase()
      // (The area the hero is in is the title already.)
      if (label === name) continue
      const p = at(tx, ty)
      const lw = F.width(label)
      const lx = Math.round(Math.max(area.x, Math.min(area.x + area.w - lw, p.x - lw / 2)))
      const ly = Math.round(p.y - 4)
      if (placed.some(q => Math.abs(q.y - ly) < 10 && lx < q.x + q.w + 4 && q.x < lx + lw + 4)) continue
      placed.push({ x: lx, y: ly, w: lw })
      F.draw(g, label, lx, ly, skin.dim, skin.outline)
    }
    // The corner's marks, at this scale: the hero, doors, ways to other lands, chests, heart pieces, the sign's sockets.
    const marks = chartMarks(world, s)
    const inside = (bx0: number, by0: number, bw0: number, bh0: number) => bx0 >= area.x && by0 >= area.y && bx0 + bw0 <= area.x + area.w && by0 + bh0 <= area.y + area.h
    const meetsBox = (a: Box, q: Box) => a.x < q.x + q.w && q.x < a.x + a.w && a.y < q.y + q.h && q.y < a.y + a.h
    const view: ChartView = {
      iso: o.e >= 0.5,
      at: (tx, ty) => { const p = at(tx + 0.5, ty + 0.5); return [Math.floor(p.x), Math.floor(p.y)] },
      fit(px0, py0, mw, mh, far, taken) {
        for (let r = 0; r <= far; r++) {
          for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue
            const bx0 = px0 - Math.floor((mw - 1) / 2) + dx
            const by0 = py0 - Math.floor(mh / 2) + dy
            if (!inside(bx0 - 1, by0 - 1, mw + 2, mh + 2)) continue
            if (taken.some(q => meetsBox(q, { x: bx0 - 1, y: by0 - 1, w: mw + 2, h: mh + 2 }))) continue
            return [bx0, by0]
          }
        }
        return null
      },
      near: () => true,
      rim: () => null,
      pip(n) {
        const m = marks.find(q => q.kind === 'pip' && q.n === n)
        const p = m ? at(m.x + 0.5, m.y + 0.5) : { x: -99, y: -99 }
        return [[Math.floor(p.x) - 1, Math.floor(p.y)], [Math.floor(p.x), Math.floor(p.y)]]
      },
    }
    const tab = (to: string) => { const d = mapDef(world, to); return d ? chartInks(d).tab : skin.dim }
    g.fillStyle = skin.outline
    drawChartMarks((mx, my, c) => { if (mx >= area.x && my >= area.y && mx < area.x + area.w && my < area.y + area.h) { g.fillStyle = c; g.fillRect(mx, my, 1, 1) } }, marks, view,
      { ink: skin.outline, edge: skin.cool, hot: skin.hot, prize: skin.prize, dim: skin.dim }, true, tab)
  }
  y += ph + 8
  const k = o.keys.touch
  const look = o.view ? `${k ? 'VIEW' : 'V VIEW'} ${o.view}` : ''
  const line = k ? '' : 'ESC RESUME'
  if (line) F.draw(g, line, Math.round((vw - F.width(line)) / 2), y, skin.dim)
  if (look) F.draw(g, look, Math.round((vw - F.width(look)) / 2), y + (line ? 12 : 0), skin.prize)
}
