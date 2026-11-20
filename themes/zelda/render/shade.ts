/**
 * The classic view's shadows: the isometric view's light, flat on the ground
 * and in hard pixels.
 *
 * - Outdoors a low sun throws the shadow of every mass (a house, a wall, a
 *   wood) along the ground: its footprint swept away from the sun, as far as
 *   the mass is tall times the shadow length. The same heights the isometric
 *   view marches through (`massesOf`), drawn once per map.
 * - What stands or walks throws a blob away from whatever lights its spot
 *   most (the sun outdoors, the nearest lamps anywhere): a pool under the
 *   feet when lit from all sides, long when lit from one, so a shadow swings
 *   round as the hero passes a lamp.
 *
 * One mask, one darkness: it is multiplied onto the light map's ambient
 * colour before the lamps are added, so a lamp shines into a shadow.
 * `massesOf`, `blobOf` and `shadeTint` are pure.
 */
import type { GameState, MapKind, MapState, TileChar, World } from '../types'
import { TILE } from '../types'
import { mapInfo, raised } from '../engine/index'
import { beyondTile } from './beyond'
import { exitTiles } from './exits'
import { shapeOf } from './iso/shape'
import { makeCanvas } from './sheet'
import type { Light } from './tiles'
import type { Item } from './wild'

const T = TILE
type G = CanvasRenderingContext2D

/** A card's foot, px up from its tile's south edge (as in the isometric view). */
const FOOT = 3
/** How far a lone tree's crown reaches above its tile, px. */
const CROWN = 10

export interface ShadeLook {
  /** Where the sun stands, radians on the ground (0 east, π/2 south). */
  angle: number
  /** How far a thing one tile tall throws its shadow, tiles. */
  length: number
  /** 0 none … 0.9. */
  strength: number
  /** '#rrggbb'. */
  color: string
  /**
   * The sun is on the move (day and night): cast only round the view, again
   * as it moves on, instead of the whole map once. A full map costs tens of
   * ms, too much every few seconds.
   */
  moving?: boolean
}

/** What a tile is for the shadows: 0 open ground, 1 a mass's own picture (no shadow is drawn on it), 2 a thing standing alone. */
export interface Masses {
  w: number
  h: number
  /** Height of the mass standing on each tile, in tiles. */
  height: Float32Array
  kind: Uint8Array
}

/** The heights of a map's masses and what each tile shows. `tile` reads the map (and what lies past its edge). */
export function massesOf(w: number, h: number, kind: MapKind, tile: (x: number, y: number) => TileChar, own: (x: number, y: number) => boolean = () => false, up: (x: number, y: number) => boolean = () => false): Masses {
  const height = new Float32Array(w * h)
  const kinds = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sh = shapeOf(tile(x, y), kind, (dx, dy) => tile(x + dx, y + dy), own(x, y), up(x, y))
    if (sh.k === 'top') {
      const fy = y + sh.f
      if (fy < h) height[fy * w + x] = Math.max(height[fy * w + x]!, sh.h / T)
    }
    kinds[y * w + x] = sh.k === 'top' || sh.k === 'face' ? 1 : sh.k === 'card' ? 2 : 0
  }
  return { w, h, height, kind: kinds }
}

/** What a shadow does to the light: the isometric view's tint (the shadow colour, lifted), as far in as the strength. */
export function shadeTint(color: string, strength: number): string {
  const v = parseInt(color.slice(1, 7), 16)
  const c = [((v >> 16) & 255) / 255, ((v >> 8) & 255) / 255, (v & 255) / 255]
  const lift = [0.34, 0.3, 0.42]
  const k = Math.max(0, Math.min(1, strength))
  return '#' + c.map((q, i) => {
    const t = Math.min(1, lift[i]! + q * 0.9)
    return Math.round((1 + (t - 1) * k) * 255).toString(16).padStart(2, '0')
  }).join('')
}

export interface Blob {
  /** Centre, tiles. */
  x: number
  y: number
  /** The long axis (a unit vector) and the half axes, tiles. */
  ux: number
  uy: number
  long: number
  wide: number
}

/**
 * The shadow of something `tall` standing at (x, y): away from what lights
 * the spot most. `sun` is the sun's pull (a vector toward it, 0 indoors),
 * `reach` the shadow length. A light on the thing itself (a lantern in its
 * hand) pulls nothing.
 */
export function blobOf(x: number, y: number, tall: number, wide: number, lights: readonly Light[], sun: { x: number; y: number } | null, reach: number): Blob {
  let dx = sun ? sun.x * 0.5 : 0
  let dy = sun ? sun.y * 0.5 : 0
  let sum = sun ? 0.5 : 0.15
  for (const L of lights) {
    const lx = L.x - x
    const ly = L.y - y
    const d = Math.hypot(lx, ly)
    if (d >= L.r || d < 0.75) continue
    const w = Math.max(0, Math.min(1, L.a)) * (1 - d / L.r) * luma(L.color)
    dx += (lx / d) * w
    dy += (ly / d) * w
    sum += w
  }
  const n = Math.hypot(dx, dy)
  const co = Math.min(1, n / sum)
  const ux = n > 1e-6 ? -dx / n : 0
  const uy = n > 1e-6 ? -dy / n : 1
  const len = tall * (0.25 + reach * 0.75 * co)
  return { x: x + ux * len * 0.5, y: y + uy * len * 0.5, ux, uy, long: len / 2 + wide, wide }
}

const lumaCache = new Map<string, number>()
function luma(hex: string): number {
  let l = lumaCache.get(hex)
  if (l === undefined) {
    const v = parseInt(hex.slice(1, 7), 16)
    l = (((v >> 16) & 255) * 0.3 + ((v >> 8) & 255) * 0.59 + (v & 255) * 0.11) / 255
    lumaCache.set(hex, l)
  }
  return l
}

/** How much of the isometric blob's soft disc the hard one keeps. */
const BLOB_EDGE = 0.74

export interface Shade {
  /**
   * This frame's shadows as a picture the size of the view, in the colour to
   * multiply the ambient light by; null when there is nothing to draw.
   * `items` are the frame's people and things, (cx, cy) the camera in px.
   */
  frame(s: GameState, look: ShadeLook, items: readonly (Item & { hero?: boolean })[], lights: readonly Light[], cx: number, cy: number, vw: number, vh: number): HTMLCanvasElement | null
}

export function createShade(world: World): Shade {
  let frame = makeCanvas(1, 1)
  let fg = frame.getContext('2d')!
  let cast: HTMLCanvasElement | null = null
  let castKey = ''
  /** The tiles the cast covers: the whole map, or a window round the view while the sun moves. */
  let castWin = { x: 0, y: 0, w: 0, h: 0 }
  let castWhole = false
  let masses: Masses | null = null
  let massMap: MapState | null = null
  let massVersion = -1

  function field(m: MapState, kind: MapKind): Masses {
    if (masses && massMap === m && massVersion === m.version) return masses
    const own = exitTiles(world, m.id)
    const tile = (x: number, y: number): TileChar => x < 0 || y < 0 || x >= m.w || y >= m.h ? (kind === 'overworld' ? beyondTile(m.tiles, m.w, m.h, x, y) : '#') : m.tiles[y * m.w + x]!
    // Crystal blocks count as up: which of them are is asked per frame (`raised`).
    masses = massesOf(m.w, m.h, kind, tile, (x, y) => own.has(y * m.w + x), () => true)
    massMap = m
    massVersion = m.version
    castKey = ''
    return masses
  }

  /**
   * The sun's shadows in hard pixels, black where a mass shades open ground:
   * over the whole map, or (`view`, tiles) over a window round the view.
   */
  function sunCast(f: Masses, look: ShadeLook, view: { x0: number; y0: number; x1: number; y1: number } | null): HTMLCanvasElement {
    const key = `${look.angle.toFixed(4)}:${look.length.toFixed(3)}`
    const inside = !view || (view.x0 >= castWin.x && view.y0 >= castWin.y && view.x1 <= castWin.x + castWin.w && view.y1 <= castWin.y + castWin.h)
    if (cast && castKey === key && (view ? inside : castWhole)) return cast
    castKey = key
    castWhole = !view
    // A window reaches 8 tiles past the view, so walking on recasts it only now and then.
    const PAD = 8
    castWin = view
      ? { x: Math.max(0, view.x0 - PAD), y: Math.max(0, view.y0 - PAD), w: 0, h: 0 }
      : { x: 0, y: 0, w: f.w, h: f.h }
    if (view) {
      castWin.w = Math.min(f.w, view.x1 + PAD) - castWin.x
      castWin.h = Math.min(f.h, view.y1 + PAD) - castWin.y
    }
    const W = castWin.w * T
    const H = castWin.h * T
    if (!cast || cast.width !== W || cast.height !== H) cast = makeCanvas(W, H)
    const g = cast.getContext('2d')!
    g.clearRect(0, 0, W, H)
    g.fillStyle = '#000'
    const vx = -Math.cos(look.angle) * look.length * T
    const vy = -Math.sin(look.angle) * look.length * T
    // A mass outside the window may throw its shadow into it: as far as the tallest one reaches.
    const reach = view ? Math.ceil(look.length * 4) + 1 : 0
    const tx0 = Math.max(0, castWin.x - reach)
    const ty0 = Math.max(0, castWin.y - reach)
    const tx1 = Math.min(f.w, castWin.x + castWin.w + reach)
    const ty1 = Math.min(f.h, castWin.y + castWin.h + reach)
    for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
      const h = f.height[y * f.w + x]!
      if (h <= 0) continue
      // The tile's square swept along the shadow: the two squares and the band between their corners.
      const ox = vx * h
      const oy = vy * h
      const x0 = (x - castWin.x) * T
      const y0 = (y - castWin.y) * T
      g.beginPath()
      for (const [ax, ay, bx, by] of [[0, 0, T, 0], [T, 0, T, T], [T, T, 0, T], [0, T, 0, 0]] as const) {
        g.moveTo(x0 + ax, y0 + ay)
        g.lineTo(x0 + bx, y0 + by)
        g.lineTo(x0 + bx + ox, y0 + by + oy)
        g.lineTo(x0 + ax + ox, y0 + ay + oy)
        g.closePath()
      }
      g.rect(x0 + ox, y0 + oy, T, T)
      g.fill('nonzero')
    }
    // Hard pixels: a shadow's edge is a stair, not a blur.
    const img = g.getImageData(0, 0, W, H)
    const d = img.data
    for (let i = 3; i < d.length; i += 4) d[i] = d[i]! >= 128 ? 255 : 0
    g.putImageData(img, 0, 0)
    return cast
  }

  function blob(g: G, b: Blob, cx: number, cy: number, vw: number, vh: number) {
    const px = b.x * T - cx
    const py = b.y * T - cy
    const L = b.long * T
    const Wd = b.wide * T
    const ext = Math.max(L, Wd)
    const x0 = Math.max(0, Math.floor(px - ext))
    const x1 = Math.min(vw - 1, Math.ceil(px + ext))
    const y0 = Math.max(0, Math.floor(py - ext))
    const y1 = Math.min(vh - 1, Math.ceil(py + ext))
    const lim = BLOB_EDGE * BLOB_EDGE
    for (let y = y0; y <= y1; y++) {
      let from = -1
      for (let x = x0; x <= x1 + 1; x++) {
        let inside = false
        if (x <= x1) {
          const qx = x + 0.5 - px
          const qy = y + 0.5 - py
          const a = (qx * b.ux + qy * b.uy) / L
          const c = (-qx * b.uy + qy * b.ux) / Wd
          inside = a * a + c * c < lim
        }
        if (inside && from < 0) from = x
        else if (!inside && from >= 0) { g.fillRect(from, y, x - from, 1); from = -1 }
      }
    }
  }

  return {
    frame(s, look, items, lights, cx, cy, vw, vh) {
      if (look.strength <= 0) return null
      const m = s.map
      const kind = mapInfo(world, m.id).def.kind
      const outdoors = kind === 'overworld'
      if (frame.width !== vw || frame.height !== vh) { frame = makeCanvas(vw, vh); fg = frame.getContext('2d')! }
      const g = fg
      g.globalCompositeOperation = 'source-over'
      g.clearRect(0, 0, vw, vh)
      g.fillStyle = '#000'
      const f = field(m, kind)
      if (outdoors && look.length > 0) {
        // Clamped to the map: past its edge there is nothing to cast, and a view that shakes over the edge would otherwise never be inside.
        const view = look.moving ? { x0: Math.max(0, Math.floor(cx / T)), y0: Math.max(0, Math.floor(cy / T)), x1: Math.min(f.w, Math.ceil((cx + vw) / T)), y1: Math.min(f.h, Math.ceil((cy + vh) / T)) } : null
        const c = sunCast(f, look, view)
        g.drawImage(c, castWin.x * T - cx, castWin.y * T - cy)
      }
      const sun = outdoors ? { x: Math.cos(look.angle), y: Math.sin(look.angle) } : null
      const reach = look.length * (outdoors ? 1 : 0.4)
      // What stands alone on its tile: a lone tree, a lamp post, a pot.
      const tx0 = Math.max(0, Math.floor(cx / T) - 3)
      const ty0 = Math.max(0, Math.floor(cy / T) - 3)
      const tx1 = Math.min(m.w - 1, Math.floor((cx + vw) / T) + 3)
      const ty1 = Math.min(m.h - 1, Math.floor((cy + vh) / T) + 3)
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        if (f.kind[ty * m.w + tx] !== 2) continue
        const t = m.tiles[ty * m.w + tx]!
        if ((t === 'P' || t === 'C') && !raised(world, m, tx, ty)) continue
        const tree = t === 'T'
        blob(g, blobOf(tx + 0.5, ty + 1 - FOOT / T, tree ? 1.4 : 0.9, tree ? 0.42 : 0.22, lights, sun, reach), cx, cy, vw, vh)
      }
      // People and things: at their feet.
      const tiles = m.tiles
      for (const it of items) {
        if (it.wall || it.tile) continue
        if (it.hero && s.hero.act === 'fall') continue
        const ay = (it.ay ?? it.y) + (it.foot ?? 0)
        if (it.x * T - cx < -3 * T || it.x * T - cx > vw + 3 * T || ay * T - cy < -3 * T || ay * T - cy > vh + 3 * T) continue
        blob(g, blobOf(it.x, ay - 0.1, 0.85, it.big ? 0.4 : 0.26, lights, sun, reach), cx, cy, vw, vh)
      }
      // A mass's own picture takes no shadow: the light there is the art's. A tree's crown reaches over its tile's edge.
      for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
        const k = f.kind[ty * m.w + tx]
        if (k === 1) g.clearRect(tx * T - cx, ty * T - cy, T, T)
        else if (k === 2 && tiles[ty * m.w + tx] === 'T') g.clearRect(tx * T - cx - 2, ty * T - cy - CROWN, T + 4, T + CROWN)
      }
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = shadeTint(look.color, look.strength)
      g.fillRect(0, 0, vw, vh)
      g.globalCompositeOperation = 'source-over'
      return frame
    },
  }
}
