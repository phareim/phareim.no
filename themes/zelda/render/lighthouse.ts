/**
 * The Lighthouse's own paint (`world/lighthouse.ts`), in both views:
 *
 * - `drawStrip`: the one stencil shape of the tower, a plain pink rectangle at any angle (ORCA's lane and box, the dark
 *   hound's lane, the Black Box's blurt and pink beam), flat on the floor under everything that stands (`floorMarks.ts`).
 * - `drawFace`, `drawDash`: the Black Box's numbered face strips and the dashed way of a beam to come.
 * - `drawLanes`: the Lamp Room's four lanes, a faint inlay on their path tiles.
 * - `stripLights`: light along every strip and dash that is up, so that a tell reads in the dim as it does in the light.
 * - `drawEyes`: what there is to see of a dark hound that is unseen.
 * - `drawBox`, `drawNumbers`: the Black Box on its pedestal, in either view, and its faces' numbers over the picture.
 * - `lampItem`: the storm lamp standing on the floor, outside the WebGL view.
 */
import type { Enemy, GameState, World } from '../types'
import { TILE } from '../types'
import { cellIndex, mapInfo } from '../engine/map'
import { stencilsOf, type Stencil } from '../engine/stencils'
import { boxSprite } from '../engine/bossBlackBox'
import { sprite } from './sheet'
import type { Light } from './tiles'
import type { Item } from './wild'

type G = CanvasRenderingContext2D
type Strip = Extract<Stencil, { t: 'strip' }>
type Face = Extract<Stencil, { t: 'face' }>
type Dash = Extract<Stencil, { t: 'dash' }>
const T = TILE

const PINK = '#ff2fa0'
const PINK_LIGHT = '#ffc2e6'
const CYAN = '#2ff3ff'
const CYAN_LIGHT = '#c4fbff'
const INK = '#0b0616'
const WHITE = '#fff4ff'

/**
 * The rectangle in hard px: a wash that deepens as the tell runs out, an edge two px wide, and chevrons running the way
 * the blow goes. Painted a row of px at a time, so it is crisp at any angle.
 */
export function drawStrip(g: G, st: Strip, cx: number, cy: number, time: number, reduced: boolean) {
  const len = st.len * T
  const half = (st.w * T) / 2
  const ox = st.x0 * T - cx
  const oy = st.y0 * T - cy
  const { ux, uy } = st
  const xs = [-half, half].flatMap(a => [ox - uy * a, ox + ux * len - uy * a])
  const ys = [-half, half].flatMap(a => [oy + ux * a, oy + uy * len + ux * a])
  const x0 = Math.floor(Math.min(...xs))
  const x1 = Math.ceil(Math.max(...xs))
  const y0 = Math.floor(Math.min(...ys))
  const y1 = Math.ceil(Math.max(...ys))
  const blink = !reduced && st.k > 0.65 && Math.floor(time * 14) % 2 === 0
  const run = reduced ? 0 : ((time * 2.5) % 1) * T
  const wing = half * 0.55
  // 0 outside, else which of the three paints this px takes: the wash, the edge, a chevron.
  const kind = (px: number, py: number): 0 | 1 | 2 | 3 => {
    const along = (px - ox) * ux + (py - oy) * uy
    const across = (py - oy) * ux - (px - ox) * uy
    const side = Math.abs(across)
    if (along < 0 || along > len || side > half) return 0
    if (along < 2 || along > len - 2 || side > half - 2) return 2
    const d = along + side * 0.55 - run
    return side <= wing && along < len - 3 && d > 0 && (d + T * 0.6) % T < 1.6 ? 3 : 1
  }
  for (let y = y0; y < y1; y++) {
    let from = x0
    let was = kind(x0 + 0.5, y + 0.5)
    for (let x = x0 + 1; x <= x1; x++) {
      const now = x < x1 ? kind(x + 0.5, y + 0.5) : 0
      if (now === was && x < x1) continue
      if (was) {
        // (Burning, a beam of the Black Box: the wash is solid and its chevrons white.)
        g.globalAlpha = was === 1 ? (st.hot ? 0.8 : 0.24 + 0.26 * st.k) : was === 3 ? 0.85 : 1
        g.fillStyle = (was === 2 && (blink || st.hot)) || (was === 3 && st.hot) ? PINK_LIGHT : PINK
        g.fillRect(from, y, x - from, 1)
      }
      from = x
      was = now
    }
  }
  g.globalAlpha = 1
}

/** A face's numbered squares, tiles from the strip's middle along it: each 9 px, in a row. */
const SQUARE = 9 / T
const squares = (st: Face, time: number, reduced: boolean) => Array.from({ length: st.n }, (_, i) => {
  let at = (i - (st.n - 1) / 2) * 0.72
  // (Rewiring, the strip spins: its squares run round it.)
  if (st.spin !== undefined && !reduced) at = ((((at + 1.5 + time * 5) % 3) + 3) % 3) - 1.5
  return { x: st.x + (st.vert ? 0 : at), y: st.y + (st.vert ? at : 0) }
})

/**
 * The Black Box's face strip, flat on the floor: three tiles by one, with as many large squares as its number (N 1,
 * E 2, S 3, W 4). Dim while it only says which face is which; lit cyan before the answer leaves it, pink before a
 * pink beam does.
 */
export function drawFace(g: G, st: Face, cx: number, cy: number, time: number, reduced: boolean) {
  const w = (st.vert ? 1 : 3) * T
  const h = (st.vert ? 3 : 1) * T
  const x = Math.round((st.x * T) - w / 2 - cx)
  const y = Math.round((st.y * T) - h / 2 - cy)
  const on = st.glow === 'cyan' ? CYAN : st.glow === 'pink' ? PINK : null
  const beat = reduced ? 1 : 0.8 + 0.2 * Math.sin(time * 10)
  // A near-black ground, so that the white squares stand out in any light; lit, the whole strip takes its colour.
  g.globalAlpha = on ? 1 : 0.94
  g.fillStyle = on ? (st.glow === 'cyan' ? '#12708c' : '#b01874') : INK
  g.fillRect(x, y, w, h)
  if (on) {
    g.globalAlpha = 0.35 * beat
    g.fillStyle = on
    g.fillRect(x, y, w, h)
  }
  g.globalAlpha = 1
  g.fillStyle = on ?? '#b99aff'
  const rim = on ? 2 : 1
  g.fillRect(x, y, w, rim)
  g.fillRect(x, y + h - rim, w, rim)
  g.fillRect(x, y, rim, h)
  g.fillRect(x + w - rim, y, rim, h)
  const side = Math.round(SQUARE * T)
  for (const q of squares(st, time, reduced)) {
    const qx = Math.round(q.x * T - cx - side / 2)
    const qy = Math.round(q.y * T - cy - side / 2)
    g.fillStyle = INK
    g.fillRect(qx - 2, qy - 2, side + 4, side + 4)
    g.fillStyle = WHITE
    g.fillRect(qx, qy, side, side)
  }
}

/** The dashed way a beam is about to take: thin, on a dark edge, its dashes marching away from the Box. */
export function drawDash(g: G, st: Dash, cx: number, cy: number, time: number, reduced: boolean) {
  const x0 = st.x0 * T - cx
  const y0 = st.y0 * T - cy
  const len = Math.hypot(st.x1 - st.x0, st.y1 - st.y0) * T
  if (len < 1) return
  const ux = ((st.x1 - st.x0) * T) / len
  const uy = ((st.y1 - st.y0) * T) / len
  const run = reduced ? 0 : (time * 14) % 9
  const color = st.hue === 'cyan' ? CYAN : PINK
  const dab = (d: number, size: number, fill: string) => {
    g.fillStyle = fill
    g.fillRect(Math.round(x0 + ux * d - size / 2), Math.round(y0 + uy * d - size / 2), size, size)
  }
  for (const [size, fill] of [[4, INK], [2, color]] as const) {
    for (let d = run - 9; d < len; d += 9) for (let k = 0; k < 5; k++) if (d + k > 0 && d + k < len) dab(d + k, size, fill)
  }
}

/** The Lamp Room's lanes, out of the pedestal's faces: every path tile of the room edged faintly. */
export function drawLanes(g: G, world: World, s: GameState, cx: number, cy: number) {
  if (s.map.id !== 'lighthouse3') return
  const info = mapInfo(world, s.map.id)
  const m = s.map
  g.fillStyle = '#8a6ad8'
  for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
    if (m.tiles[y * m.w + x] !== ',') continue
    const cell = cellIndex(info, x + 0.5, y + 0.5)
    if (cell !== s.zoneIndex && !(s.scroll && cell === s.scroll.index)) continue
    const px = x * T - cx
    const py = y * T - cy
    g.globalAlpha = 0.22
    g.fillRect(px + 1, py + 1, T - 2, T - 2)
    g.globalAlpha = 0.6
    g.fillRect(px + 1, py + 1, T - 2, 1)
    g.fillRect(px + 1, py + T - 2, T - 2, 1)
    g.fillRect(px + 1, py + 2, 1, T - 4)
    g.fillRect(px + T - 2, py + 2, 1, T - 4)
  }
  g.globalAlpha = 1
}

/**
 * Light along the strips and dashes of the hero's room: the floor is lit with the room, and neither a dim room nor the
 * 8-bit painter's dusk must swallow a tell. Stronger in the dark.
 */
export function stripLights(world: World, s: GameState, lights: Light[], dark: boolean) {
  const dungeon = mapInfo(world, s.map.id).def.kind === 'dungeon'
  for (const e of s.map.enemies) {
    if (e.dead || (dungeon && e.cell !== s.zoneIndex)) continue
    for (const st of stencilsOf(e)) {
      if (st.t === 'strip') for (let d = 0.6; d < st.len; d += 1.2) lights.push({ x: st.x0 + st.ux * d, y: st.y0 + st.uy * d, r: 1.2, color: PINK, a: st.hot ? 0.9 : dark ? 0.55 : 0.4 })
      // (A face's number is read in the dim at any time; lit, its strip shines.)
      if (st.t === 'face') for (const d of [-1, 0, 1]) lights.push({ x: st.x + (st.vert ? 0 : d), y: st.y + (st.vert ? d : 0), r: 1, color: st.glow === 'cyan' ? CYAN : st.glow === 'pink' ? PINK : '#cfc6ff', a: st.glow ? 0.5 : dark ? 0.35 : 0.15 })
      if (st.t === 'dash') for (let d = 0.5; d < 1; d += 0.25) lights.push({ x: st.x0 + (st.x1 - st.x0) * d, y: st.y0 + (st.y1 - st.y0) * d, r: 1.1, color: st.hue === 'cyan' ? CYAN : PINK, a: 0.6 })
    }
  }
}

/**
 * An unseen dark hound (`engine/lamp.ts` `unseen`): two pink eyes at head height, 3×2 px each with a px of glow, a
 * light of their own so the dark does not dull them. (x, y): its feet, in the scene's px.
 */
export function drawEyes(g: G, x: number, y: number, side: number) {
  const ex = Math.round(x) + side * 3
  const ey = Math.round(y) - 10
  for (const dx of [-4, 1]) {
    g.globalAlpha = 0.4
    g.fillStyle = PINK
    g.fillRect(ex + dx - 1, ey - 1, 5, 4)
    g.globalAlpha = 1
    g.fillRect(ex + dx, ey, 3, 2)
    g.fillStyle = PINK_LIGHT
    g.fillRect(ex + dx + 1, ey, 1, 1)
  }
}

/** Where the Box's picture stands, px under its middle: on the 8-bit pedestal, and on the isometric one. */
const BOX_FOOT = { classic: 20, iso: 3 }
/** The isometric card stands this far (tiles, east and south) ahead of the Box's middle: in front of its pedestal. */
export const BOX_AHEAD = 1.55

/** The Box's foot on the screen, px under its middle: `span` as the isometric view projects (null: the 8-bit view). */
export function boxFoot(e: Enemy, span: Span | null): number {
  if (!span) return BOX_FOOT.classic
  const turn = 1 - Math.max(0, Math.min(1, span(e.x, e.y, e.x + 1, e.y + 1).x / T))
  return Math.round(BOX_FOOT.classic + (BOX_FOOT.iso - BOX_FOOT.classic) * turn)
}

type Span = (x1: number, y1: number, x2: number, y2: number) => { x: number; y: number }

/** The Black Box on its pedestal. */
export function drawBox(g: G, e: Enemy, cx: number, cy: number, time: number, reduced: boolean, lights: Light[], span: Span | null, shake: number) {
  const open = e.ai.mode === 'open'
  const hot = e.ai.mode === 'blurt' || e.ai.mode === 'beam'
  // The classic painter draws at the Box's own place; the isometric one lays this drawing's anchor ahead of it.
  let x = e.x * T - cx
  let y = e.y * T - cy
  if (span) {
    const to = span(e.x, e.y, e.x + BOX_AHEAD, e.y + BOX_AHEAD)
    x = (e.x + BOX_AHEAD) * T - cx - to.x
    y = (e.y + BOX_AHEAD) * T - cy - to.y
  }
  const img = sprite(boxSprite(e, reduced ? 0 : time))
  g.drawImage(img, Math.round(x + shake - img.width / 2), Math.round(y + boxFoot(e, span) - img.height))
  lights.push({ x: e.x, y: e.y - 0.6, r: open ? 3.4 : 2.8, color: open ? '#ffd23f' : hot ? PINK : '#c4fbff', a: open ? 0.85 : 0.6 })
}

/**
 * The faces' numbers again, over the lit picture: unlit, so that they can be counted in the dim, and over the Box,
 * whose picture would hide some of them in the isometric view. Where the hero or his lamp stands in front of one,
 * it is left under them. `place`: a world point on the screen.
 */
export function drawNumbers(g: G, s: GameState, e: Enemy, place: (x: number, y: number) => { x: number; y: number }, time: number, reduced: boolean) {
  /** The px a standing thing of the room covers: its feet's place, half its width, its height. */
  const stands = [{ ...place(s.hero.x, s.hero.y), w: 7, h: 18 }]
  if (s.lamp) stands.push({ ...place((s.lamp.idx % s.map.w) + 0.5, Math.floor(s.lamp.idx / s.map.w) + 0.5), w: 7, h: 12 })
  const half = SQUARE / 2
  const edge = 1.5 / T
  for (const st of stencilsOf(e)) {
    if (st.t !== 'face') continue
    for (const q of squares(st, time, reduced)) {
      const at = place(q.x, q.y)
      const a = place(q.x + 1, q.y)
      const b = place(q.x, q.y + 1)
      const ex = { x: a.x - at.x, y: a.y - at.y }
      const ey = { x: b.x - at.x, y: b.y - at.y }
      const det = ex.x * ey.y - ey.x * ex.y
      if (Math.abs(det) < 1e-6) continue
      const rx = Math.ceil((Math.abs(ex.x) + Math.abs(ey.x)) * (half + edge))
      const ry = Math.ceil((Math.abs(ex.y) + Math.abs(ey.y)) * (half + edge))
      for (let v = Math.floor(at.y - ry); v <= at.y + ry; v++) for (let u = Math.floor(at.x - rx); u <= at.x + rx; u++) {
        const px = u + 0.5 - at.x
        const py = v + 0.5 - at.y
        const off = Math.max(Math.abs((px * ey.y - py * ey.x) / det), Math.abs((py * ex.x - px * ex.y) / det))
        if (off > half + edge || stands.some(p => Math.abs(u - p.x) <= p.w && v >= p.y - p.h && v <= p.y + 6)) continue
        g.fillStyle = off > half ? INK : st.glow ? WHITE : '#d9ccff'
        g.fillRect(u, v, 1, 1)
      }
    }
  }
}

/**
 * The storm lamp standing on the floor as the 8-bit view and the canvas-drawn isometric one show it: its drawn
 * picture, flickering. (`things: []`: the WebGL view builds a lantern of its own and takes no card from this.)
 */
export function lampItem(g: G, s: GameState, cx: number, cy: number, time: number, reduced: boolean): Item {
  const l = s.lamp!
  const tx = l.idx % s.map.w
  const ty = Math.floor(l.idx / s.map.w)
  // (A flicker now and then, not a blink.)
  const dim = !reduced && Math.sin(time * 11) + Math.sin(time * 17.3) > 1.1
  return { x: tx + 0.5, y: ty + 0.7, foot: 0.3, things: [], draw: () => g.drawImage(sprite(dim ? 'lamp_down_1' : 'lamp_down'), tx * T - cx, ty * T - cy) }
}
