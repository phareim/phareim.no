/**
 * What THE HEAP draws over its tiles: the rails and pads on the floor, the Magnet's corner bracket under the metal a
 * tap would take, the iron on the move, the latch line and the glint on all metal. Shapes in tiles, painted in classic
 * px for a camera at (cx, cy): the floor marks and the lines go onto whichever view's ground picture is up
 * (`renderer.ts` `floorMarks`), so the isometric view lays them on its floor with the tiles, and the iron on the move
 * is queued as a thing that stands, which each view stands up its own way.
 */
import type { Dir, GameState, TileChar, World } from '../types'
import { TILE } from '../types'
import { cellIndex, mapInfo } from '../engine/map'
import { magnetPreview } from '../engine/magnet'
import { dirVec } from '../engine/util'
import { isIron, isRailed } from '../world/tiles'
import { sprite } from './sheet'
import type { Light } from './tiles'
import type { Item } from './wild'

type G = CanvasRenderingContext2D
const T = TILE

const CYAN = '#2ff3ff'
const CYAN_DARK = '#1a9fc4'
const INK = '#0b0616'

const PICTURE: Partial<Record<TileChar, string>> = { '▣': 'heap_crate', '▤': 'heap_scrap', '▥': 'heap_cart_striped', '▦': 'heap_cart' }

/** Rails and pads of the room on screen (both rooms while it scrolls), and the bracket under what B would take. */
export function drawHeapFloor(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean) {
  const info = mapInfo(world, s.map.id)
  const m = s.map
  const here = (cell: number) => cell === s.zoneIndex || (!!s.scroll && cell === s.scroll.index)
  for (const r of info.rails) {
    if (!here(r.cell)) continue
    r.tiles.forEach((i, k) => {
      // (A cart covers its own tile.)
      if (isIron(m.tiles[i]!)) return
      rail(g, (i % m.w) * T - cx, Math.floor(i / m.w) * T - cy, r.dir === 'right', k === 0 ? -1 : k === r.tiles.length - 1 ? 1 : 0)
    })
  }
  for (const p of info.ironPads) {
    if (!here(p.cell) || isIron(m.tiles[p.idx]!)) continue
    pad(g, (p.idx % m.w) * T - cx, Math.floor(p.idx / m.w) * T - cy, p.dir)
  }
  const mark = magnetPreview(world, s)
  if (!mark || cellIndex(info, mark.x, mark.y) !== s.zoneIndex) return
  bracket(g, Math.round((mark.x - 0.5) * T - cx), Math.round((mark.y - 0.5) * T - cy), reduced ? 0 : Math.floor(time * 3) % 2)
}

/** Two bright strips on dark sleepers; a stop across the rail's two ends. */
function rail(g: G, x: number, y: number, flat: boolean, end: -1 | 0 | 1) {
  const bar = (color: string, u: number, v: number, w: number, h: number) => {
    g.fillStyle = color
    if (flat) g.fillRect(x + u, y + v, w, h)
    else g.fillRect(x + v, y + u, h, w)
  }
  for (const u of [1, 6, 11]) bar('#6a4432', u, 3, 3, 10)
  for (const v of [4, 10]) { bar(INK, 0, v + 1, T, 1); bar('#8f86b8', 0, v, T, 1) }
  if (end) bar('#cfc6ff', end < 0 ? 0 : T - 2, 2, 2, 12)
}

/** A square stencilled in cyan, with a short bar toward what it faces. */
function pad(g: G, x: number, y: number, dir: Dir) {
  g.globalAlpha = 0.14
  g.fillStyle = CYAN
  g.fillRect(x + 3, y + 3, 10, 10)
  g.globalAlpha = 0.8
  g.fillStyle = CYAN_DARK
  g.fillRect(x + 2, y + 2, 12, 1)
  g.fillRect(x + 2, y + 13, 12, 1)
  g.fillRect(x + 2, y + 3, 1, 10)
  g.fillRect(x + 13, y + 3, 1, 10)
  g.globalAlpha = 1
  g.fillStyle = CYAN
  const v = dirVec(dir)
  // From the middle out past the square's edge.
  if (v.x) g.fillRect(v.x < 0 ? x : x + 9, y + 7, 7, 2)
  else g.fillRect(x + 7, v.y < 0 ? y : y + 9, 2, 7)
}

/** The corner bracket round a tile's floor, a px outside it and breathing by one. */
function bracket(g: G, x: number, y: number, step: number) {
  const o = 2 + step
  const arm = 5
  for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const ex = sx < 0 ? x - o : x + T + o - 1
    const ey = sy < 0 ? y - o : y + T + o - 1
    const hx = sx < 0 ? ex : ex - arm + 1
    const vy = sy < 0 ? ey : ey - arm + 1
    g.fillStyle = INK
    g.fillRect(hx - 1, ey - 1 - (sy < 0 ? 0 : 1), arm + 2, 4)
    g.fillRect(ex - 1 - (sx < 0 ? 0 : 1), vy - 1, 4, arm + 2)
    g.fillStyle = CYAN
    g.fillRect(hx, ey - (sy < 0 ? 0 : 1), arm, 2)
    g.fillRect(ex - (sx < 0 ? 0 : 1), vy, 2, arm)
  }
}

/** The two-frame glint on all metal: a point, then a small cross, each tile in its own time. */
export function drawMetalGlint(g: G, px: number, py: number, tx: number, ty: number, time: number, reduced: boolean) {
  const open = !reduced && Math.floor(time * 2 + (tx * 3 + ty * 5) * 0.37) % 3 === 0
  const x = px + 11
  const y = py + 3
  g.fillStyle = '#fff4ff'
  g.fillRect(x, y, 1, 1)
  if (!open) return
  g.fillRect(x - 2, y, 5, 1)
  g.fillRect(x, y - 2, 1, 5)
  g.fillStyle = CYAN
  g.fillRect(x - 3, y, 1, 1)
  g.fillRect(x + 3, y, 1, 1)
  g.fillRect(x, y - 3, 1, 1)
  g.fillRect(x, y + 3, 1, 1)
}

/** Iron on the move: loose iron lifted off the floor over its shadow, a cart on its wheels. And the marks' own light. */
export function queueHeap(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean, items: Item[], lights: Light[]) {
  // (The floor's paint is darkened with the floor: the pads and the bracket bring lights of their own.)
  for (const p of mapInfo(world, s.map.id).ironPads) {
    if (p.cell === s.zoneIndex) lights.push({ x: (p.idx % s.map.w) + 0.5, y: Math.floor(p.idx / s.map.w) + 0.5, r: 0.9, color: CYAN, a: 0.4 })
  }
  const mark = magnetPreview(world, s)
  if (mark) lights.push({ x: mark.x, y: mark.y, r: 1.3, color: CYAN, a: 0.75 })
  for (const f of s.map.iron?.flights ?? []) {
    const lift = isRailed(f.ch) ? 0 : 4
    items.push({
      x: f.x,
      ay: f.y + 0.5,
      y: f.y + 0.5,
      draw: () => {
        const x = Math.round((f.x - 0.5) * T - cx)
        const y = Math.round((f.y - 0.5) * T - cy)
        if (lift) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 2, y + 12, 12, 3) }
        g.drawImage(sprite(PICTURE[f.ch]!), x, y - lift)
        drawMetalGlint(g, x, y - lift, Math.floor(f.x), Math.floor(f.y), time, reduced)
      },
    })
    lights.push({ x: f.x, y: f.y, r: 1.3, color: CYAN, a: 0.6 })
  }
}

/** A line of square dots of `size` px from (x0, y0) to (x1, y1); `dash` px on and off, running toward the far end. */
function stroke(g: G, x0: number, y0: number, x1: number, y1: number, size: number, dash: number, run: number) {
  const len = Math.hypot(x1 - x0, y1 - y0)
  for (let d = 0; d <= len; d++) {
    if (dash && Math.floor((d - run + dash * 64) / dash) % 2) continue
    g.fillRect(Math.round(x0 + ((x1 - x0) * d) / len - size / 2), Math.round(y0 + ((y1 - y0) * d) / len - size / 2), size, size)
  }
}

/** The latch line, from the hero's hand: to each piece (and PHI) on the move, and (2 px, dashed) to the bolt in flight. */
export function drawLatchLines(g: G, s: GameState, cx: number, cy: number, time: number, reduced: boolean, lights: Light[]) {
  const h = s.hero
  const hx = h.x * T - cx
  const hy = h.y * T - cy - 4
  g.fillStyle = CYAN
  for (const f of s.map.iron?.flights ?? []) stroke(g, hx, hy, f.x * T - cx, f.y * T - cy - 4, 1, 0, 0)
  for (const e of s.map.enemies) if (!e.dead && e.kind === 'phi' && e.ai.mode === 'pulled') stroke(g, hx, hy, e.x * T - cx, e.y * T - cy, 1, 0, 0)
  const k = s.hook
  if (!k?.magnet) return
  const bx = k.x * T - cx
  const by = k.y * T - cy - 4
  if (Math.hypot(bx - hx, by - hy) < 1) return
  stroke(g, hx, hy, bx, by, 2, 4, reduced ? 0 : (time * 40) % 8)
  g.fillStyle = '#fff4ff'
  g.fillRect(Math.round(bx) - 1, Math.round(by) - 1, 3, 3)
  lights.push({ x: k.x, y: k.y, r: 1.4, color: CYAN, a: 0.75 })
}
