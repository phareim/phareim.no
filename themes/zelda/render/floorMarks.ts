/**
 * What is painted flat on the floor, under everything that stands: what a foe's blow will hit (`stencilsOf`,
 * `engine/stencils.ts`), the pot stands, and the ring under the echo. Drawn on the ground picture of whichever view
 * is up (`renderer.ts` `queue`'s `flat`), in classic px for a camera at (cx, cy), so the isometric view lays them on
 * its floor with the tiles.
 */
import type { GameState, World } from '../types'
import { TILE } from '../types'
import { cellIndex, mapInfo } from '../engine/map'
import { stencilsOf, type Stencil } from '../engine/stencils'
import { laneOf, throwerLanes } from '../engine/gifts'

type G = CanvasRenderingContext2D
const T = TILE

/** Danger is pink, the hero's own is cyan. */
const PINK = '#ff2fa0'
const PINK_LIGHT = '#ffc2e6'
const CYAN = '#2ff3ff'

export function drawFloorMarks(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean) {
  const info = mapInfo(world, s.map.id)
  const m = s.map
  const dungeon = info.def.kind === 'dungeon'
  for (const i of info.stands) {
    const x = i % m.w
    const y = Math.floor(i / m.w)
    if (dungeon && cellIndex(info, x + 0.5, y + 0.5) !== s.zoneIndex && !s.scroll) continue
    stand(g, x * T - cx, y * T - cy, m.tiles[i] !== 'o', time, reduced)
  }
  const marks: Stencil[] = []
  for (const e of m.enemies) {
    if (e.dead || (dungeon && e.cell !== s.zoneIndex)) continue
    marks.push(...stencilsOf(e))
  }
  // The Steamhouse's gifts: the throws being told, and the way still ahead of each one in the air.
  marks.push(...throwerLanes(s))
  for (const p of m.projectiles) if (p.kind === 'gift' && p.to) marks.push(laneOf(p.x, p.y, p.to, 0))
  for (const st of marks) {
    g.save()
    // Never up the walls: the room's floor only.
    if (dungeon) {
      const z = s.zone
      g.beginPath()
      g.rect((z.x + 1) * T - cx, (z.y + 1) * T - cy, (z.w - 2) * T, (z.h - 2) * T)
      g.clip()
    }
    if (st.t === 'ray') ray(g, st, cx, cy, time, reduced)
    else lane(g, st, cx, cy, time, reduced)
    g.restore()
  }
  if (s.echo) echoRing(g, s.echo.x * T - cx, s.echo.y * T - cy + 4, time, reduced)
}

/** A lane (they run along an axis): a wash that deepens as the tell runs out, a hard edge, chevrons down it. */
function lane(g: G, st: Extract<Stencil, { t: 'lane' }>, cx: number, cy: number, time: number, reduced: boolean) {
  const len = Math.hypot(st.x1 - st.x0, st.y1 - st.y0)
  const flat = Math.abs(st.x1 - st.x0) >= Math.abs(st.y1 - st.y0)
  const way = Math.sign(flat ? st.x1 - st.x0 : st.y1 - st.y0) || 1
  const half = st.w / 2
  const a = flat ? Math.min(st.x0, st.x1) - st.cap : st.x0 - half
  const b = flat ? st.y0 - half : Math.min(st.y0, st.y1) - st.cap
  const x = Math.round(a * T - cx)
  const y = Math.round(b * T - cy)
  const w = Math.round((flat ? len + st.cap * 2 : st.w) * T)
  const h = Math.round((flat ? st.w : len + st.cap * 2) * T)
  g.globalAlpha = 0.2 + 0.25 * st.k
  g.fillStyle = PINK
  g.fillRect(x, y, w, h)
  const blink = !reduced && st.k > 0.65 && Math.floor(time * 14) % 2 === 0
  g.globalAlpha = 1
  g.fillStyle = blink ? PINK_LIGHT : PINK
  g.fillRect(x, y, w, 2)
  g.fillRect(x, y + h - 2, w, 2)
  g.fillRect(x, y, 2, h)
  g.fillRect(x + w - 2, y, 2, h)
  // Chevrons, a tile apart, running the way the charge will.
  const run = reduced ? 0 : (time * 2.5) % 1
  const wing = Math.round(half * T * 0.55)
  g.globalAlpha = 0.85
  for (let d = 0.4 + run; d < len + st.cap - 0.2; d += 1) {
    const px = Math.round((st.x0 + (flat ? way * d : 0)) * T - cx)
    const py = Math.round((st.y0 + (flat ? 0 : way * d)) * T - cy)
    for (let k = 0; k <= wing; k++) {
      const back = Math.round(k * 0.55) * way
      for (const side of k ? [-1, 1] : [1]) {
        if (flat) g.fillRect(px - back - 1, py + k * side, 3, 1)
        else g.fillRect(px + k * side, py - back - 1, 1, 3)
      }
    }
  }
  g.globalAlpha = 1
}

/**
 * A way at any angle (a gift's lane), laid in whole px row by row: the same wash, hard edge and running chevrons as a
 * charge's lane.
 */
function ray(g: G, st: Extract<Stencil, { t: 'ray' }>, cx: number, cy: number, time: number, reduced: boolean) {
  const x0 = st.x0 * T - cx
  const y0 = st.y0 * T - cy
  const len = Math.hypot(st.x1 - st.x0, st.y1 - st.y0) * T
  if (len < 2) return
  const ux = ((st.x1 - st.x0) * T) / len
  const uy = ((st.y1 - st.y0) * T) / len
  const half = (st.w * T) / 2
  /** The run of px in row `y` that lies `a` to `b` along the way and within `h` of its middle; null when none does. */
  const span = (y: number, a: number, b: number, h: number): [number, number] | null => {
    let lo = -1e4
    let hi = 1e4
    const dy = y + 0.5 - y0
    for (const [k, c, from, to] of [[ux, dy * uy, a, b], [-uy, dy * ux, -h, h]] as const) {
      // from <= dx * k + c <= to
      if (Math.abs(k) < 1e-6) { if (c < from || c > to) return null; continue }
      const p = (from - c) / k
      const q = (to - c) / k
      lo = Math.max(lo, Math.min(p, q))
      hi = Math.min(hi, Math.max(p, q))
    }
    const l = Math.round(x0 + lo)
    const r = Math.round(x0 + hi)
    return r > l ? [l, r] : null
  }
  const reach = Math.abs(uy) * len + half + 2
  const top = Math.floor(Math.min(y0, y0 + uy * len) - half)
  const blink = !reduced && st.k > 0.65 && Math.floor(time * 14) % 2 === 0
  for (let y = top; y <= top + reach + half; y++) {
    const out = span(y, 0, len, half)
    if (!out) continue
    const core = span(y, 2, len - 2, half - 2)
    g.fillStyle = PINK
    g.globalAlpha = 0.2 + 0.25 * st.k
    g.fillRect(out[0], y, out[1] - out[0], 1)
    g.globalAlpha = 1
    g.fillStyle = blink ? PINK_LIGHT : PINK
    if (!core) { g.fillRect(out[0], y, out[1] - out[0], 1); continue }
    if (core[0] > out[0]) g.fillRect(out[0], y, core[0] - out[0], 1)
    if (out[1] > core[1]) g.fillRect(core[1], y, out[1] - core[1], 1)
  }
  // Chevrons, a tile apart, pointing the way the gift will go.
  const run = reduced ? 0 : ((time * 2.5) % 1) * T
  const wing = Math.round(half * 0.5)
  g.globalAlpha = 0.85
  g.fillStyle = blink ? PINK_LIGHT : PINK
  for (let d = 0.6 * T + run; d < len - 3; d += T) {
    for (let k = -wing; k <= wing; k++) {
      const back = Math.abs(k) * 0.7
      g.fillRect(Math.round(x0 + ux * (d - back) - uy * k) - 1, Math.round(y0 + uy * (d - back) + ux * k) - 1, 2, 2)
    }
  }
  g.globalAlpha = 1
}

/** A pot stand: a gold-cornered pad; empty, its ring shows where the next pot comes. */
function stand(g: G, x: number, y: number, empty: boolean, time: number, reduced: boolean) {
  g.fillStyle = '#ffd23f'
  g.globalAlpha = 0.8
  for (const [dx, dy, sx, sy] of [[0, 0, 1, 1], [15, 0, -1, 1], [0, 15, 1, -1], [15, 15, -1, -1]] as const) {
    g.fillRect(x + Math.min(dx, dx + sx * 3), y + dy, 4, 1)
    g.fillRect(x + dx, y + Math.min(dy, dy + sy * 3), 1, 4)
  }
  if (empty) {
    g.globalAlpha = reduced ? 0.55 : 0.45 + 0.2 * Math.sin(time * 4)
    g.strokeStyle = '#ffd23f'
    g.lineWidth = 1
    g.beginPath()
    g.arc(x + 8, y + 8, 5, 0, Math.PI * 2)
    g.stroke()
  }
  g.globalAlpha = 1
}

/** The soft ring on the floor under the echo. */
function echoRing(g: G, x: number, y: number, time: number, reduced: boolean) {
  const breathe = reduced ? 0 : Math.sin(time * 3)
  g.fillStyle = CYAN
  g.globalAlpha = 0.14
  g.beginPath()
  g.arc(Math.round(x), Math.round(y), 9 + breathe, 0, Math.PI * 2)
  g.fill()
  g.globalAlpha = 0.55 + 0.15 * breathe
  g.strokeStyle = CYAN
  g.lineWidth = 1
  g.beginPath()
  g.arc(Math.round(x), Math.round(y), 9 + breathe, 0, Math.PI * 2)
  g.stroke()
  g.globalAlpha = 1
}
