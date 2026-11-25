/**
 * The map: the small one in the corner (a window round the hero, in the shell's corner button) and the whole
 * one on the menu's MAP page (M). Both show only what the hero has seen (`engine/explore.ts`), as a chart in a
 * few flat colours: floor, road, water, trees, walls, houses, the ways in and out lit. Both turn with the
 * world: `e` is the view's turn (0 the classic view, north up; 1 the isometric one, the map a diamond lying as
 * the ground does), so what is up the screen in the world is up the map too.
 *
 * Everything is in the HUD's logical px; the caller sets the scale.
 */
import type { GameState, MapDef, TileChar, World } from '../types'
import type { HudKeys } from '../keys'
import { mapDef, mapInfo } from '../engine/map'
import { charted, chunkGrid, CHUNK, seenAny, seenTile } from '../engine/explore'
import { TILE_INFO, isTileChar } from '../world/tiles'
import { projection } from './iso/project'
import { TILE } from '../types'
import { drawMenuTabs, hudFont, type HudSkin } from './hud'

type G = CanvasRenderingContext2D

/** The chart's colours: a plan, not a picture. */
const INK = {
  floor: '#3a2d5c',
  low: '#2c2246',
  road: '#6d5a9a',
  sand: '#6b5470',
  water: '#1d5d8c',
  ice: '#5fa8c8',
  tree: '#1f4a3d',
  bush: '#2b5c48',
  wall: '#9a8cc4',
  house: '#c04a8c',
  door: '#ffd23f',
  pit: '#120a22',
  thing: '#4e416f',
} as const

const KIND: Partial<Record<TileChar, keyof typeof INK>> = {
  ',': 'road', '=': 'road', '-': 'sand',
  '~': 'water', 'ω': 'water', 'α': 'ice',
  'T': 'tree', '*': 'bush', ';': 'floor',
  '#': 'wall', '%': 'wall', '^': 'wall', '[': 'wall', 'q': 'wall', 'а': 'wall', 'е': 'wall', 'I': 'wall',
  'H': 'house', 'D': 'door', '>': 'door',
  'O': 'pit', 'к': 'pit', 'Z': 'low',
}

function inkOf(ch: string): string {
  const k = KIND[ch as TileChar]
  if (k) return INK[k]
  return isTileChar(ch) && TILE_INFO[ch].solid ? INK.thing : INK.floor
}

// ---- the chart: one px a tile, what is unseen left clear ----------------------------------------------------

/** Per visit of a map (`loadMap` makes a new state each time, its `version` starting over). */
const charts = new WeakMap<GameState['map'], { key: string; c: HTMLCanvasElement }>()

/** The current map as a chart, made again only when its tiles or what has been seen of it change. */
function chartOf(s: GameState, w: number, h: number): HTMLCanvasElement {
  const id = s.map.id
  const key = `${s.map.version}|${s.explored?.[id] ?? ''}`
  const hit = charts.get(s.map)
  if (hit?.key === key) return hit.c
  const c = hit?.c ?? document.createElement('canvas')
  c.width = w
  c.height = h
  const g = c.getContext('2d')!
  g.clearRect(0, 0, w, h)
  const { cw, ch } = chunkGrid(w, h)
  for (let cy = 0; cy < ch; cy++) {
    for (let cx = 0; cx < cw; cx++) {
      if (!seenTile(s, id, w, cx * CHUNK, cy * CHUNK)) continue
      for (let y = cy * CHUNK; y < Math.min(h, (cy + 1) * CHUNK); y++) {
        for (let x = cx * CHUNK; x < Math.min(w, (cx + 1) * CHUNK); x++) {
          g.fillStyle = inkOf(s.map.tiles[y * w + x] ?? '.')
          g.fillRect(x, y, 1, 1)
        }
      }
    }
  }
  charts.set(s.map, { key, c })
  return c
}

/** One tile step on the chart, for a turn e and a zoom z (L px a tile in the classic view). */
function axes(e: number, z: number) {
  const p = projection(e)
  return { ax: (p.ex.x / TILE) * z, ay: (p.ex.y / TILE) * z, bx: (p.ey.x / TILE) * z, by: (p.ey.y / TILE) * z }
}

/** Draws the chart so that tile point (fx, fy) lands on (px, py). */
function drawChart(g: G, c: HTMLCanvasElement, e: number, z: number, fx: number, fy: number, px: number, py: number) {
  const { ax, ay, bx, by } = axes(e, z)
  g.save()
  g.imageSmoothingEnabled = false
  g.transform(ax, ay, bx, by, px - (fx * ax + fy * bx), py - (fx * ay + fy * by))
  g.drawImage(c, 0, 0)
  g.restore()
}

/** The hero's mark: a lit square with a dark edge, and a pixel the way they face. */
function heroMark(g: G, x: number, y: number, s: GameState, e: number, skin: HudSkin, on: boolean, big = false) {
  const X = Math.round(x)
  const Y = Math.round(y)
  const r = big ? 3 : 2
  g.fillStyle = skin.outline
  g.fillRect(X - r, Y - r, r * 2, r * 2)
  g.fillStyle = on ? skin.hot : skin.text
  g.fillRect(X - r + 1, Y - r + 1, r * 2 - 2, r * 2 - 2)
  const d = s.hero.dir
  const v = d === 'up' ? [0, -1] : d === 'down' ? [0, 1] : d === 'left' ? [-1, 0] : [1, 0]
  const { ax, ay, bx, by } = axes(e, 1)
  const sx = v[0]! * ax + v[1]! * bx
  const sy = v[0]! * ay + v[1]! * by
  const n = Math.hypot(sx, sy) || 1
  g.fillStyle = skin.text
  g.fillRect(Math.round(x + (sx / n) * (r + 1) - 0.5), Math.round(y + (sy / n) * (r + 1) - 0.5), 1, 1)
}

/** True where the corner map has something to show: a charted map (not a room indoors), in a game being played, not in a fight (its menus want the room). */
export function hasMiniMap(world: World, s: GameState): boolean {
  const def = mapDef(world, s.map.id)
  return !!def && charted(def) && !s.demo && s.mode !== 'battle'
}

/** The corner map's size, in L. */
export const MINI_W = 56
export const MINI_H = 40

/**
 * The corner map: a window on the chart round the hero, in a panel of the view's own dress. `key`: the letter
 * that opens the whole map (beside a keyboard), else null.
 */
export function drawMiniMap(g: G, world: World, s: GameState, e: number, skin: HudSkin, key: string | null, time: number, reduced: boolean) {
  g.clearRect(0, 0, MINI_W, MINI_H)
  skin.panel(g, 0, 0, MINI_W, MINI_H, 'cool')
  const info = mapInfo(world, s.map.id)
  const inset = 3
  g.save()
  g.beginPath()
  g.rect(inset, inset, MINI_W - inset * 2, MINI_H - inset * 2)
  g.clip()
  const z = 2 - 0.75 * e
  drawChart(g, chartOf(s, info.w, info.h), e, z, s.hero.x, s.hero.y, MINI_W / 2, MINI_H / 2)
  g.restore()
  heroMark(g, MINI_W / 2, MINI_H / 2, s, e, skin, reduced || Math.floor(time * 2.5) % 2 === 0)
  if (key) hudFont(skin).draw(g, key, inset + 1, MINI_H - inset - 8, skin.cool, skin.outline)
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

/** The whole grid as a chart, one px a tile, what has been seen of each known map drawn where it lies. */
const worlds = new WeakMap<GameState['flags'], { key: string; c: HTMLCanvasElement }>()
function worldCanvas(world: World, s: GameState): HTMLCanvasElement {
  const b = atlasBox(world)
  const known = b.rects.filter(r => !r.away || !!s.flags[`seen:${r.id}`] || r.id === s.map.id)
  const key = known.map(r => `${r.id}:${s.explored?.[r.id] ?? ''}`).join('|')
  const hit = worlds.get(s.flags)
  if (hit?.key === key) return hit.c
  const c = hit?.c ?? document.createElement('canvas')
  c.width = b.w
  c.height = b.h
  const g = c.getContext('2d')!
  g.clearRect(0, 0, b.w, b.h)
  for (const r of known) {
    const info = mapInfo(world, r.id)
    const { cw, ch } = chunkGrid(r.w, r.h)
    for (let cy = 0; cy < ch; cy++) for (let cx = 0; cx < cw; cx++) {
      if (!seenTile(s, r.id, r.w, cx * CHUNK, cy * CHUNK)) continue
      for (let y = cy * CHUNK; y < Math.min(r.h, (cy + 1) * CHUNK); y++) for (let x = cx * CHUNK; x < Math.min(r.w, (cx + 1) * CHUNK); x++) {
        g.fillStyle = inkOf(info.base[y * r.w + x] ?? '.')
        g.fillRect(r.x - b.x0 + x, r.y - b.y0 + y, 1, 1)
      }
    }
  }
  worlds.set(s.flags, { key, c })
  return c
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
  /** The corner map is on. */
  corner: boolean
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
    // What has been seen of the map, as large as fits (never closer than six px a tile).
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
    drawChart(g, chartOf(s, info.w, info.h), o.e, z, fx, fy, cx, cy)
    const at = (tx: number, ty: number) => ({ x: cx + ((tx - fx) * ax + (ty - fy) * bx) * z, y: cy + ((tx - fx) * ay + (ty - fy) * by) * z })
    // The names of the areas seen, where they do not lie over one another.
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
    // The ways between the coast and the lands seen on this map (the gates, the ferry): a lit square each.
    // (Out in a land only those home: its stairs down to the quarry, the glade or the lab are no way to the coast.)
    for (const wp of info.warps) {
      const to = world.maps[wp.to]
      if (!to || !world.atlas?.[wp.to] || !!to.away === !!def.away || !seenTile(s, s.map.id, info.w, wp.x, wp.y)) continue
      const p = at(wp.x + 0.5, wp.y + 0.5)
      g.fillStyle = skin.outline
      g.fillRect(Math.round(p.x) - 2, Math.round(p.y) - 2, 4, 4)
      g.fillStyle = skin.ok
      g.fillRect(Math.round(p.x) - 1, Math.round(p.y) - 1, 2, 2)
    }
    const h = at(s.hero.x, s.hero.y)
    heroMark(g, h.x, h.y, s, o.e, skin, true, z >= 4)
  }
  y += ph + 8
  const k = o.keys.touch
  const corner = `${k ? 'CORNER MAP' : 'C CORNER MAP'} ${o.corner ? 'ON' : 'OFF'}`
  const look = o.view ? `${k ? 'VIEW' : 'V VIEW'} ${o.view}` : ''
  const line = k ? '' : 'ESC RESUME'
  if (line) F.draw(g, line, Math.round((vw - F.width(line)) / 2), y, skin.dim)
  const gap = look ? 12 : 0
  const sx = Math.round((vw - F.width(corner) - gap - F.width(look)) / 2)
  F.draw(g, corner, sx, y + (line ? 12 : 0), o.corner ? skin.cool : skin.hot)
  if (look) F.draw(g, look, sx + F.width(corner) + gap, y + (line ? 12 : 0), skin.prize)
}
