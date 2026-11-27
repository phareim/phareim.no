/**
 * The chart: what has been seen of a map (`engine/explore.ts`), in that land's own inks, darker and flatter than the
 * world so that its marks stand out; fog where the hero has not been. Here are its parts: the ink tables, one ink a
 * tile (`chartPixels`), the marks drawn over it (`chartMarks`, `drawChartMarks`), the tally of what is left to find
 * (`chartTally`) and the ways between lands (`landPasses`). The top right corner shows a window of it round the hero
 * (`render/corner.ts`); the menu's MAP page (M) the whole land, with the world's chart (`render/mapPage.ts`).
 *
 * Pure but for the layer cache: no canvas, no DOM.
 */
import type { GameState, MapDef, MapState, TileChar, ViewSide, World } from '../types'
import { cellIndex, condMet, mapDef, mapInfo, type MapInfo } from '../engine/map'
import { charted, seenTile } from '../engine/explore'
import { DAY } from '../engine/day'
import { TILE_INFO, blockUp, isTileChar, isViewBlock } from '../world/tiles'
import { lumaOf } from './looks'

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
  // Lumenby Quarry: dusky rose earth, pale pink-stone roads, ochre benches, violet stone over near-black pits.
  quarry: /* @__PURE__ */ inks('764a60 825468 664a42 c4a0a4 8c5a42 b8784a 0e4a6c 46a8c8 56a0b8 22143e 342256 746030 7c5e9c 463068 5a4076 cc8a40 865230 5c3c58 f0e0f2 07030c 58365a', ['#2e1c3c', '#3a264a'], '#7a8cff'),
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
 * What a land of the grid is called on the world's chart (`mapPage.ts`) where its own name (without a leading THE)
 * is wider than the land: the forms to try, the first that fits.
 */
export const WORLD_SHORT: Readonly<Record<string, readonly string[]>> = /* @__PURE__ */ Object.freeze({
  overworld: ['COAST'], wildwood: ['WILDWOOD', 'WOOD'], seterfell: ['FELL'], yulefjord: ['FJORD'], sporelight: ['SPORE'],
  stillsand: ['SAND'], rerun: ['RERUN'], lumenby: ['LUMENBY'], fogstage: ['FOG'],
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
  // The view blocks: wall while up. While down they are floor, which `chartKind` says by the view.
  '□': 'wall', '◇': 'wall',
}

function cornerKind(ch: TileChar): Ground {
  return CORNER_KIND[ch] ?? (isTileChar(ch) && TILE_INFO[ch].solid ? 'thing' : 'ground')
}

/** A tile's ink in a view: a view block that is down there is floor. */
function chartKind(ch: TileChar, view: ViewSide): Ground {
  return isViewBlock(ch) && !blockUp(ch, view) ? 'ground' : cornerKind(ch)
}

/** Which tile of a block shows where the world's chart has one px for several (`mapPage.ts`): houses, roads and water before the ground they lie on. */
const RANK_SMALL: Partial<Record<Ground, number>> = { house: 7, road: 6, bridge: 6, water: 5, ice: 4, door: 3, pit: 3, wall: 2, tree: 1, sand: 1 }
export function tileRank(ch: TileChar): number {
  return RANK_SMALL[cornerKind(ch)] ?? 0
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

/** An ink as the hour dims it (`ChartPaint.night`). */
export function dimInk(ink: string, level: 0 | 1 | 2): string {
  return level ? blend(ink, NIGHT_INK, NIGHT_MIX[level]) : ink
}

export interface ChartPaint {
  /** Unseen ground in fog (with the ghost of its water and cliffs out of doors); false: left clear (null). */
  fog: boolean
  /** The ghost under the fog (false for the lab's comparison). */
  ghost?: boolean
  night?: 0 | 1 | 2
  /** The view the chart is drawn in (`GameState.view`; default 'iso', as a game opens): which view blocks are wall. */
  view?: ViewSide
}

/**
 * One ink a tile for a map's tiles (`tiles`: the live ones, or the authored `info.base`), what is not seen in fog or
 * clear. Pure.
 */
export function chartPixels(info: MapInfo, tiles: readonly TileChar[], terrain: MapState['terrain'] | undefined, seen: (x: number, y: number) => boolean, o: ChartPaint): Array<string | null> {
  const { w, h } = info
  const c = chartInks(info.def)
  const fog = fogInks(c)
  const kinds = tiles.map(t => chartKind(t, o.view ?? 'iso'))
  const at = (x: number, y: number): Ground | null => (x < 0 || y < 0 || x >= w || y >= h ? null : kinds[y * w + x]!)
  const wet = (k: Ground | null) => k === null || k === 'water' || k === 'ice' || k === 'bridge'
  const rise = (x: number, y: number) => (!terrain || x < 0 || y < 0 || x >= w || y >= h ? 0 : terrain.h[y * w + x]! - terrain.g)
  /** A wall with nothing but wall (or the map's edge) all round it: the mass behind a cliff's rim. */
  const buried = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = at(x + dx, y + dy); if (n !== null && n !== 'wall') return false }
    return true
  }
  const outline = (o.ghost ?? true) && info.def.kind === 'overworld'
  const night = o.night ?? 0
  const dimmed = new Map<string, string>()
  const dim = (ink: string) => {
    if (!night) return ink
    let d = dimmed.get(ink)
    if (!d) dimmed.set(ink, d = dimInk(ink, night))
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
  const px = chartPixels(info, s.map.tiles, s.map.terrain, (x, y) => seenTile(s, s.map.id, info.w, x, y), { fog: true, ghost, night, view: s.view }) as string[]
  return { w: info.w, h: info.h, inks: chartInks(info.def), px }
}

const layers = /* @__PURE__ */ new WeakMap<GameState['map'], { key: string; layer: ChartLayer }>()

/** The current map's chart, made again only when its tiles, the view, what has been seen of it or the hour's level change. */
export function chartLayer(world: World, s: GameState): ChartLayer {
  const night = chartNight(world, s)
  const key = `${s.map.id}|${s.map.version}|${s.view}|${s.explored?.[s.map.id] ?? ''}|${night}`
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
  /** The two px of the n-th of seven pips, left to right: on the frame's lower edge, or where its socket stands. */
  pip(n: number): ReadonlyArray<readonly [number, number]>
  /** The pips stand on the land and not in the rim: drawn as this art (`MARK_ART.socket`), `G` its colour, in an ink line all round. */
  pipArt?: readonly string[]
}
export interface Box { x: number; y: number; w: number; h: number }

export interface MarkInks { ink: string; edge: string; hot: string; prize: string; dim: string }
type Put = (x: number, y: number, color: string) => void

const FAINT = '#7a6ab0'
export const SOCKET = '#54259e'
const PALE = '#f2e9ff'
/** The colours the marks' art is painted in (`MARK_ART`), besides the skin's own. */
export const MARK_INKS = /* @__PURE__ */ Object.freeze({ L: '#fff1b0', R: '#ff5a6a', D: FAINT, P: PALE })
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
  // A letter of the sign where it stands on the land: a tall lamp, nothing like a chest.
  socket: ['GG', 'GG', 'GG', 'GG'],
  hero: ['PPP', 'PPP', 'PPP'],
  heroIso: ['.PP.', 'PPPP', '.PP.'],
} as const

/** Art with a one-px ink line round it, its top left at (x, y). */
export function stampMark(put: Put, rows: readonly string[], x: number, y: number, pal: Record<string, string>, ink: string) {
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
 * the hero's blink is on its bright step. `tab`: the ink of the land a pass leads to. Returns the room each mark
 * drawn has taken, the hero's first.
 */
export function drawChartMarks(put: Put, marks: readonly ChartMark[], view: ChartView, c: MarkInks, lit: boolean, tab: (to: string) => string): Box[] {
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
        stampMark(put, art, x, y, { P: body }, c.ink)
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
      // the ring under it, gold once its letter is lit, dark before, an ink line on either side. On a chart of the
      // whole land (`pipArt`) it stands where it is, in a shape of its own.
      const cols = view.pip(m.n ?? 1)
      const [a, b] = [cols[0]!, cols[cols.length - 1]!]
      const fill = m.state === 'lit' ? c.prize : SOCKET
      const art = view.pipArt
      if (art) {
        const [x, y] = [a[0], a[1] - Math.floor(art.length / 2)]
        taken.push({ x: x - 1, y: y - 1, w: art[0]!.length + 2, h: art.length + 2 })
        jobs.push(() => stampMark(put, art, x, y, { G: fill }, c.ink))
        continue
      }
      taken.push({ x: a[0] - 1, y: Math.min(a[1], b[1]) - 1, w: b[0] - a[0] + 3, h: Math.abs(a[1] - b[1]) + 3 })
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
        jobs.push(() => stampMark(put, MARK_ART.gate, x, y, { C: c.edge, K: c.ink }, c.ink))
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
    const pal = { G: c.prize, K: c.ink, ...MARK_INKS }
    // What is done with lies flat on the chart, with no ink line to lift it.
    jobs.push(done
      ? () => art.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] !== '.') put(x + i, y + j, pal[row[i] as keyof typeof pal]) })
      : () => stampMark(put, art, x, y, pal, c.ink))
  }
  // The most important last, on top.
  for (let i = jobs.length - 1; i >= 0; i--) jobs[i]!()
  return taken
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

/** The ways indoors, below and out of the game on a map: one tile a doorway, stair or machine. */
function doorsOf(world: World, id: string): Array<[number, number]> {
  const info = mapInfo(world, id)
  const doors = new Map<string, Array<[number, number]>>()
  const door = (to: string, x: number, y: number) => doors.set(to, [...(doors.get(to) ?? []), [x, y]])
  const onGrid = !!world.atlas?.[id]
  for (const wp of info.warps) {
    // (On the grid a way into another map of the grid is a pass, `landPasses`.)
    if (onGrid && world.atlas?.[wp.to]) continue
    for (let y = wp.y; y < wp.y + wp.h; y++) for (let x = wp.x; x < wp.x + wp.w; x++) door(wp.to, x, y)
  }
  for (const e of info.exits.values()) door(`exit:${e.id}`, Math.floor(e.x), Math.floor(e.y))
  return [...doors.values()].flatMap(clusters)
}

/** The heart pieces lying about on the current map, taken or not: never one whose condition is unmet. */
function heartsOf(world: World, s: GameState): Array<{ x: number; y: number; taken: boolean }> {
  const info = mapInfo(world, s.map.id)
  const out: Array<{ x: number; y: number; taken: boolean }> = []
  for (const m of info.marks) {
    const e = m.ent
    if (e.t !== 'item' || e.item !== 'heartPiece') continue
    const taken = s.flags[`took:${e.id}`] === true
    if (!taken && e.appear && !condMet(s, world, e.appear, cellIndex(info, m.x + 0.5, m.y + 0.5))) continue
    out.push({ x: m.x, y: m.y, taken })
  }
  return out
}

/** The chests of the current map, opened or not: never one that has not appeared. */
function chestsOf(world: World, s: GameState): Array<{ x: number; y: number; opened: boolean }> {
  const out: Array<{ x: number; y: number; opened: boolean }> = []
  for (const c of mapInfo(world, s.map.id).chestList) {
    const opened = s.flags[`chest:${c.id}`] === true
    // (The engine sets `appear:<id>` the moment the chest's condition is met.)
    if (c.appear && !opened && s.flags[`appear:${c.id}`] !== true) continue
    out.push({ x: c.x, y: c.y, opened })
  }
  return out
}

/** The letters of Lumenby's sign: where each socket stands, its number (1–7) and whether it is lit. */
function socketsOf(world: World, s: GameState): Array<{ x: number; y: number; n: number; lit: boolean }> {
  const out: Array<{ x: number; y: number; n: number; lit: boolean }> = []
  for (const m of mapInfo(world, s.map.id).marks) {
    const e = m.ent
    if (e.t !== 'socket') continue
    const n = /^q\.lumenby\.sign([1-7])$/.exec(e.flag)?.[1]
    if (n) out.push({ x: m.x, y: m.y, n: Number(n), lit: s.flags[e.flag] === true })
  }
  return out.sort((a, b) => a.n - b.n)
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
  const out: ChartMark[] = [{ kind: 'hero', x: Math.floor(s.hero.x), y: Math.floor(s.hero.y), state: s.hero.dir }]

  for (const [x, y] of doorsOf(world, id)) if (seen(x, y)) out.push({ kind: 'door', x, y, state: 'open' })

  for (const p of landPasses(world, id)) {
    if (!seen(p.x, p.y)) continue
    // The coast and the Wildwood are known from the start (as on the MAP page); a land once walked into.
    const known = !mapDef(world, p.to)?.away || s.flags[`seen:${p.to}`] === true
    out.push({ kind: 'pass', x: p.x, y: p.y, state: known ? 'seen' : 'unseen', to: p.to })
  }

  for (const h of heartsOf(world, s)) if (seen(h.x, h.y)) out.push({ kind: 'heart', x: h.x, y: h.y, state: h.taken ? 'taken' : 'lying' })
  for (const c of chestsOf(world, s)) if (seen(c.x, c.y)) out.push({ kind: 'chest', x: c.x, y: c.y, state: c.opened ? 'opened' : 'closed' })

  return [...out, ...socketsOf(world, s).map((p): ChartMark => ({ kind: 'pip', x: p.x, y: p.y, n: p.n, state: p.lit ? 'lit' : 'dark' }))]
}

/** What a map holds and how much of it is done: each pair is [done, all]. */
export interface ChartTally {
  chests: readonly [number, number]
  hearts: readonly [number, number]
  sockets: readonly [number, number]
  /** Doorways, stairs and machines, and the ways to other lands. */
  doors: number
  passes: number
}

/**
 * The MAP page's tally of the current map, seen or not: the chests opened of all it holds, the heart pieces taken
 * of all that lie about on it, the sockets of the sign lit, and how many doors and passes there are. A chest or a
 * heart piece whose condition is unmet is not counted: the total never tells of it. Pure.
 */
export function chartTally(world: World, s: GameState): ChartTally {
  if (!hasChart(world, s)) return { chests: [0, 0], hearts: [0, 0], sockets: [0, 0], doors: 0, passes: 0 }
  const chests = chestsOf(world, s)
  const hearts = heartsOf(world, s)
  const sockets = socketsOf(world, s)
  return {
    chests: [chests.filter(c => c.opened).length, chests.length],
    hearts: [hearts.filter(h => h.taken).length, hearts.length],
    sockets: [sockets.filter(p => p.lit).length, sockets.length],
    doors: doorsOf(world, s.map.id).length,
    passes: landPasses(world, s.map.id).length,
  }
}
