/**
 * What is painted flat on the floor, under everything that stands: what a foe's blow will hit (`stencilsOf`,
 * `engine/stencils.ts`), the pot stands, and the ring under the echo. Drawn on the ground picture of whichever view
 * is up (`renderer.ts` `queue`'s `flat`), in classic px for a camera at (cx, cy), so the isometric view lays them on
 * its floor with the tiles.
 */
import type { GameState, World } from '../types'
import { TILE } from '../types'
import { cellIndex, mapInfo, solidTile } from '../engine/map'
import { inStencil, stencilsOf, type Stencil } from '../engine/stencils'
import { flightLane, throwerLanes } from '../engine/gifts'
import { drawDash, drawFace, drawLanes, drawStrip } from './lighthouse'
import { drawPads, drawShape } from './examination'
import { drawMaximizerFloor } from './balance'

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
  drawLanes(g, world, s, cx, cy)
  drawPads(g, world, s, cx, cy)
  for (const i of info.stands) {
    const x = i % m.w
    const y = Math.floor(i / m.w)
    if (dungeon && cellIndex(info, x + 0.5, y + 0.5) !== s.zoneIndex && !s.scroll) continue
    stand(g, x * T - cx, y * T - cy, m.tiles[i] !== 'o', time, reduced)
  }
  for (const l of info.lends) {
    const x = l.idx % m.w
    const y = Math.floor(l.idx / m.w)
    if (cellIndex(info, x + 0.5, y + 0.5) !== s.zoneIndex && !s.scroll) continue
    stand(g, x * T - cx, y * T - cy, m.tiles[l.idx] !== l.tile, time, reduced)
  }
  // The Maximizer's stations and its flashing tiles lie under its paint (`balance.ts`).
  drawMaximizerFloor(g, s, cx, cy, time, reduced)
  const marks: Stencil[] = []
  const lw = { w: world, s }
  for (const e of m.enemies) {
    if (e.dead || (dungeon && e.cell !== s.zoneIndex)) continue
    marks.push(...stencilsOf(e, lw))
  }
  // The Steamhouse's gifts: the throws being told, and the way still ahead of each one in the air.
  marks.push(...throwerLanes(lw))
  for (const p of m.projectiles) if (p.kind === 'gift') marks.push(flightLane(p, lw))
  // Never up the walls: the room's floor only, with the open tiles of its border (a doorway's mouth: a blow that lands
  // there is painted there). Found once, a row's run at a time, so that a room with a second wall row or a pillar
  // keeps the paint off it.
  let floor: Path2D | null = null
  if (dungeon && marks.length) {
    const z = s.zone
    floor = new Path2D()
    for (let y = z.y; y < z.y + z.h; y++) {
      let from = -1
      for (let x = z.x; x <= z.x + z.w; x++) {
        const edge = x === z.x || y === z.y || x === z.x + z.w - 1 || y === z.y + z.h - 1
        const open = x < z.x + z.w && (edge ? !solidTile(world, m, x, y, 'enemy') : m.tiles[y * m.w + x] !== '#')
        if (open && from < 0) from = x
        else if (!open && from >= 0) { floor.rect(from * T - cx, y * T - cy, (x - from) * T, T); from = -1 }
      }
    }
  }
  for (const st of marks) {
    g.save()
    if (floor) g.clip(floor)
    if (st.t === 'ray') ray(g, st, cx, cy, time, reduced)
    else if (st.t === 'strip') drawStrip(g, st, cx, cy, time, reduced)
    else if (st.t === 'disc' || st.t === 'path') drawShape(g, st, cx, cy, time, reduced)
    else if (st.t === 'face') drawFace(g, st, cx, cy, time, reduced)
    else if (st.t === 'dash') drawDash(g, st, cx, cy, time, reduced)
    else paint(g, st, cx, cy, time, reduced)
    g.restore()
  }
  if (s.echo) echoRing(g, s.echo.x * T - cx, s.echo.y * T - cy + 4, time, reduced)
}

/**
 * One stencil, a pixel at a time, so that its edge is exactly where the blow's is (`inStencil`): a pink wash that
 * deepens as the tell runs out, a hard edge, and down a lane the chevrons of the way it will be run. A copy's is
 * fainter, and dotted at the edge. Footsteps are only prints: nothing is hit there.
 */
function paint(g: G, st: Exclude<Stencil, { t: 'ray' | 'strip' | 'disc' | 'path' | 'face' | 'dash' }>, cx: number, cy: number, time: number, reduced: boolean) {
  const faint = st.dim ? 0.55 : 1
  if (st.t === 'steps') { steps(g, st, cx, cy, faint); return }
  const box = bounds(st)
  const x0 = Math.floor(box.x0 * T - cx)
  const x1 = Math.ceil(box.x1 * T - cx)
  const y0 = Math.floor(box.y0 * T - cy)
  const y1 = Math.ceil(box.y1 * T - cy)
  // (A lane's own test with its way worked out once: six of them are painted at a time. The same sum as `inStencil`.)
  let at = (px: number, py: number) => inStencil(st, (px + 0.5 + cx) / T, (py + 0.5 + cy) / T)
  if (st.t === 'lane') {
    const ux = Math.cos(st.a)
    const uy = Math.sin(st.a)
    const far = Math.hypot(st.x1 - st.x0, st.y1 - st.y0) + st.cap
    const across = st.w / 2
    at = (px, py) => {
      const dx = (px + 0.5 + cx) / T - st.x0
      const dy = (py + 0.5 + cy) / T - st.y0
      const u = dx * ux + dy * uy
      return u >= -st.cap && u <= far && Math.abs(dy * ux - dx * uy) <= across
    }
  }
  // Cyan stays (a way left open): dashed at the edge, hardly filled. A false lane is hatched, its edge dotted.
  const cyan = st.tone === 'cyan'
  const fake = !!st.fake
  // The one true lane among false ones is filled solid.
  const sole = st.fake === false
  // (A field of tiles, the Maximizer's ring, stays pink: a pale blink over fifty of them would read as another colour.)
  const tiles = st.t === 'box'
  const blink = !reduced && !st.dim && !cyan && !fake && !tiles && st.k > 0.65 && Math.floor(time * 14) % 2 === 0
  const run = reduced ? 0 : time * 2.5
  const half = st.t === 'lane' ? st.w / 2 : 0
  for (let py = y0; py < y1; py++) {
    // Runs of one ink along the row.
    let ink = 0
    let from = x0
    for (let px = x0; px <= x1; px++) {
      let now = 0
      if (px < x1 && at(px, py)) {
        now = 1
        const gx = px + Math.round(cx)
        const gy = py + Math.round(cy)
        const dash = cyan ? (((gx + gy) % 8) + 8) % 8 >= 5 : fake && (((gx + gy) % 5) + 5) % 5 >= 2
        if (!at(px - 2, py) || !at(px + 2, py) || !at(px, py - 2) || !at(px, py + 2)) now = dash || (st.dim && (px + py) % 4 < 2) ? 1 : 2
        else if (fake) { if ((((gx - gy) % 6) + 6) % 6 === 0) now = 3 }
        else if (st.t === 'lane') {
          const wx = (px + 0.5 + cx) / T - st.x0
          const wy = (py + 0.5 + cy) / T - st.y0
          const u = wx * Math.cos(st.a) + wy * Math.sin(st.a)
          const v = Math.abs(wy * Math.cos(st.a) - wx * Math.sin(st.a))
          const phase = u + v * 0.55 - run
          // Down a danger's lane the chevrons of its way; down the open way a broken line to its end.
          if (cyan) { if (v < 0.1 && u - Math.floor(u * 2) / 2 < 0.28) now = 3 }
          else if (v < half * 0.62 && u > 0.2 && phase - Math.floor(phase) < 0.16) now = 3
        }
      }
      if (now === ink) continue
      if (ink) {
        g.globalAlpha = faint * (ink === 1 ? (cyan ? 0.12 : fake ? 0.05 : tiles ? 0.35 + 0.45 * st.k : sole ? 0.55 + 0.35 * st.k : 0.2 + 0.25 * st.k) : fake ? (ink === 2 ? 0.7 : 0.4) : ink === 2 ? 1 : 0.85)
        g.fillStyle = cyan ? CYAN : ink === 2 && blink ? PINK_LIGHT : PINK
        g.fillRect(from, py, px - from, 1)
      }
      ink = now
      from = px
    }
  }
  g.globalAlpha = 1
}

/** The tiles a stencil lies within. */
function bounds(st: Exclude<Stencil, { t: 'steps' | 'ray' | 'strip' | 'disc' | 'path' | 'face' | 'dash' }>): { x0: number; y0: number; x1: number; y1: number } {
  // (A box is placed by its middle, as `inStencil` reads it.)
  if (st.t === 'box') return { x0: st.x - st.w / 2, y0: st.y - st.h / 2, x1: st.x + st.w / 2, y1: st.y + st.h / 2 }
  if (st.t !== 'lane') return { x0: st.x - st.r, y0: st.y - st.r, x1: st.x + st.r, y1: st.y + st.r }
  const pad = Math.hypot(st.cap, st.w / 2)
  return { x0: Math.min(st.x0, st.x1) - pad, y0: Math.min(st.y0, st.y1) - pad, x1: Math.max(st.x0, st.x1) + pad, y1: Math.max(st.y0, st.y1) + pad }
}

/** Three steps toward the hero: a bird's prints ahead of it, left and right of the way, each coming up in turn. */
function steps(g: G, st: Extract<Stencil, { t: 'steps' }>, cx: number, cy: number, faint: number) {
  const dx = st.x1 - st.x0
  const dy = st.y1 - st.y0
  const d = Math.hypot(dx, dy) || 1
  const ux = dx / d
  const uy = dy / d
  g.fillStyle = PINK
  for (let i = 0; i < 3; i++) {
    if (st.k < i * 0.25) continue
    const along = (i + 1) / 3
    const side = i % 2 ? 0.28 : -0.28
    // From its front edge on, or its own body would hide them.
    const x = Math.round((st.x0 + dx * along + ux * 0.8 - uy * side) * T - cx)
    const y = Math.round((st.y0 + dy * along + uy * 0.8 + ux * side) * T - cy)
    g.globalAlpha = faint * 0.9
    // A pad, and three toes forward.
    g.fillRect(x - 2, y - 2, 4, 4)
    for (const turn of [-0.6, 0, 0.6]) {
      const ax = ux * Math.cos(turn) - uy * Math.sin(turn)
      const ay = uy * Math.cos(turn) + ux * Math.sin(turn)
      for (let r = 3; r <= 6; r++) g.fillRect(Math.round(x + ax * r) - 1, Math.round(y + ay * r) - 1, 2, 2)
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
