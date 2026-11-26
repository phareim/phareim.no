/**
 * Dig & build in the picture (`engine/dig.ts`): the tile painters for its
 * ground (stone, timber, turf, dug earth, ore, ramps, holes), the outline on
 * the tile a tool would work, and the B item's icon. Both views paint from
 * these; the isometric view stands the heights up itself (`iso/dig.ts`).
 */
import type { GameState, MapKind, MapState, TileChar, World } from '../types'
import { TILE } from '../types'
import { digPlan, hasTool, isArt, isRamp, RAMPS } from '../engine/index'

type G = CanvasRenderingContext2D
type At = (dx: number, dy: number) => TileChar
const T = TILE

const DIG_CHARS = new Set<TileChar>(['а', 'б', 'в', 'д', 'е', 'ж', 'з', 'и', 'й', 'к'])
export const isDigChar = (t: TileChar): boolean => DIG_CHARS.has(t)

const C = {
  stone: '#6f6aa0', stoneL: '#9690c4', stoneD: '#443f72', stoneDD: '#2c2852',
  dirt: '#4e3148', dirtL: '#654061', dirtD: '#352137', pebble: '#8a6a86',
  wood: '#6e3d4e', woodL: '#8e5566', woodD: '#472536',
  vein: '#ff2fa0', veinL: '#ff8ae0', veinW: '#fff4ff',
  hole: '#0b0616', lip: '#271a33',
}

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) { g.fillStyle = c; g.fillRect(x, y, w, h) }
function hash(x: number, y: number, s: number): number {
  let h = (x * 374761393 + y * 668265263 + s * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** The map being painted: its heights draw the edges of what stands up. */
let painting: MapState | null = null
export function setDigPaint(m: MapState | null) { painting = m && m.dig ? m : null }
function rise(tx: number, ty: number): number {
  const m = painting
  if (!m || tx < 0 || ty < 0 || tx >= m.w || ty >= m.h) return 0
  return m.dig!.h[ty * m.w + tx]! - m.dig!.g - (isRamp(m.tiles[ty * m.w + tx]!) ? 1 : 0)
}
/** Does tile (tx, ty) stand above the ground (its picture then goes with what stands, not with the ground)? */
export const digRaised = (tx: number, ty: number): boolean => rise(tx, ty) > 0

function stone(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, C.stone, px, py, T, T)
  for (let by = 0; by < T; by += 8) {
    const off = ((by / 8 + tx) % 2) * 4
    for (let bx = -off; bx < T; bx += 8) {
      const x0 = px + Math.max(0, bx)
      const w = Math.min(8, 8 + bx, px + T - x0)
      if (w <= 0) continue
      r(g, C.stoneL, x0, py + by, w - 1, 1)
      r(g, C.stoneD, x0 + w - 1, py + by, 1, 8)
      r(g, C.stoneD, x0, py + by + 7, w, 1)
      if (hash(tx * 4 + bx, ty * 4 + by, 3) > 0.6) r(g, C.stoneD, x0 + 2, py + by + 3, 2, 1)
    }
  }
}

function dirt(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, C.dirt, px, py, T, T)
  for (let i = 0; i < 7; i++) {
    const x = Math.floor(hash(tx, ty, i) * 15)
    const y = Math.floor(hash(tx, ty, i + 9) * 15)
    r(g, i % 3 ? C.dirtD : C.dirtL, px + x, py + y, i % 2 ? 2 : 1, 1)
  }
  r(g, C.pebble, px + 3 + Math.floor(hash(tx, ty, 30) * 9), py + 4 + Math.floor(hash(tx, ty, 31) * 8), 2, 1)
}

function timber(g: G, px: number, py: number, tx: number, ty: number) {
  r(g, C.woodD, px, py, T, T)
  for (let i = 0; i < T; i += 4) {
    r(g, C.wood, px + i, py, 3, T)
    r(g, C.woodL, px + i, py, 1, T)
    const knot = Math.floor(hash(tx + i, ty, 5) * 12)
    r(g, C.woodD, px + i + 1, py + 2 + knot, 1, 1)
  }
  r(g, '#140a22', px, py + T - 1, T, 1)
}

function ore(g: G, px: number, py: number, tx: number, ty: number) {
  stone(g, px, py, tx, ty)
  // A vein of lumen: pink crystals with a white glint.
  const pts: Array<[number, number]> = [[3, 4], [5, 6], [7, 7], [9, 9], [11, 10], [12, 4], [4, 11]]
  for (const [x, y] of pts) { r(g, C.vein, px + x, py + y, 2, 2); r(g, C.veinL, px + x, py + y, 1, 1) }
  r(g, C.veinW, px + 7 + Math.floor(hash(tx, ty, 2) * 3), py + 7, 1, 1)
}

function hole(g: G, px: number, py: number, at: At) {
  r(g, C.hole, px, py, T, T)
  // The far wall shows: earth under the lip, darker the deeper.
  if (at(0, -1) !== 'к') { r(g, C.dirtL, px, py, T, 1); r(g, C.dirt, px, py + 1, T, 3); r(g, C.dirtD, px, py + 4, T, 2); r(g, C.lip, px, py + 6, T, 1) }
  if (at(-1, 0) !== 'к') r(g, C.dirtD, px, py, 2, T)
  if (at(1, 0) !== 'к') r(g, C.dirtD, px + T - 2, py, 2, T)
  if (at(0, 1) !== 'к') r(g, C.dirtL, px, py + T - 1, T, 1)
}

function ramp(g: G, t: TileChar, px: number, py: number, tx: number, ty: number) {
  stone(g, px, py, tx, ty)
  const d = RAMPS[t]!
  // Steps across the way it rises, lit on their noses.
  for (let i = 0; i < 4; i++) {
    const k = d[0] < 0 || d[1] < 0 ? i : 3 - i
    const c = i % 2 ? C.stone : C.stoneD
    if (d[1] !== 0) { r(g, c, px, py + k * 4, T, 4); r(g, C.stoneL, px, py + k * 4 + (d[1] < 0 ? 0 : 3), T, 1) }
    else { r(g, c, px + k * 4, py, 4, T); r(g, C.stoneL, px + k * 4 + (d[0] > 0 ? 3 : 0), py, 1, T) }
  }
}

/** The edges of what stands: a lit lip where the ground falls away north, a dark one south (both views read them). */
function edges(g: G, px: number, py: number, tx: number, ty: number) {
  const h = rise(tx, ty)
  if (h <= 0) return
  if (rise(tx, ty - 1) < h) r(g, 'rgba(255,244,255,0.22)', px, py, T, 1)
  if (rise(tx, ty + 1) < h) r(g, 'rgba(11,6,22,0.45)', px, py + T - 1, T, 1)
  if (rise(tx - 1, ty) < h) r(g, 'rgba(255,244,255,0.12)', px, py, 1, T)
  if (rise(tx + 1, ty) < h) r(g, 'rgba(11,6,22,0.3)', px + T - 1, py, 1, T)
}

/**
 * Paint a dig tile (either pass). `pass`: 'base' paints what lies on the ground, 'objects' what stands up
 * (anything above the ground's level). `grass` paints the coast's grass, for the turf. True when painted.
 */
export function paintDigTile(kind: MapKind, g: G, t: TileChar, px: number, py: number, tx: number, ty: number, at: At, pass: 'base' | 'objects', grass: () => void): boolean {
  if (!DIG_CHARS.has(t)) return false
  void kind
  // A tile that stands up (and a ramp, which rises off the ground) is painted with what stands; under it the
  // ground is plain earth.
  const up = digRaised(tx, ty) || isRamp(t)
  if (pass === 'base' && up) { dirt(g, px, py, tx, ty); return true }
  if (pass === 'objects' && !up) return true
  switch (t) {
    case 'а': stone(g, px, py, tx, ty); break
    case 'е': ore(g, px, py, tx, ty); break
    case 'б': timber(g, px, py, tx, ty); break
    case 'в': grass(); break
    case 'д': dirt(g, px, py, tx, ty); break
    case 'к': hole(g, px, py, at); break
    default: ramp(g, t, px, py, tx, ty)
  }
  edges(g, px, py, tx, ty)
  return true
}

/** The outline's colour: cyan to dig (or take back), pink to build, rose when it cannot. */
export function cursorColor(p: { ok: boolean; verb: string | null }): string {
  return !p.ok ? '#ff3b5c' : p.verb === 'build' ? '#ff2fa0' : '#2ff3ff'
}

/** The tile a tool would work, outlined (the classic view; the isometric one draws it at its height, `iso/dig.ts`). */
export function drawDigCursor(g: G, world: World, s: GameState, cx: number, cy: number, time: number) {
  if (s.mode !== 'play' || !s.map.dig) return
  const p = digPlan(world, s)
  if (!p) return
  const px = p.tx * T - cx
  const py = p.ty * T - cy
  g.globalAlpha = (p.ok ? 0.75 : 0.45) + 0.2 * Math.sin(time * 6)
  g.strokeStyle = cursorColor(p)
  g.lineWidth = 1
  g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1)
  // Corner ticks, so the outline reads on any ground.
  g.fillStyle = g.strokeStyle
  for (const [x, y] of [[1, 1], [T - 3, 1], [1, T - 3], [T - 3, T - 3]] as const) g.fillRect(px + x, py + y, 2, 2)
  g.globalAlpha = 1
}

/** The B item's icon for DIG or BUILD: the tool for the tile in front (or the first one found), or the hammer. */
/** The icon of the B item out (the HUD's box, the touch B pad): for DIG, `digIcon`; '' with nothing out. */
export function itemIconName(world: World, s: GameState): string {
  const u = s.inv.selected
  if (!u) return ''
  if (isArt(u)) return `item_${u}`
  return u === 'dig' || u === 'build' ? digIcon(world, s) : u === 'disc' ? 'item_disc' : u === 'hook' ? 'item_hook' : 'item_bombbag'
}

export function digIcon(world: World, s: GameState): string {
  if (s.inv.selected === 'build') return 'item_hammer'
  const p = s.map.dig ? digPlan(world, s) : null
  if (p?.tool && p.tool !== 'hammer' && hasTool(s, p.tool)) return `item_${p.tool}`
  for (const t of ['pickaxe', 'shovel', 'axe'] as const) if (hasTool(s, t)) return `item_${t}`
  return 'item_pickaxe'
}
