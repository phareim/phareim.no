/**
 * What is painted flat on the floor, under everything that stands: what a foe's blow will hit (`stencilsOf`,
 * `engine/stencils.ts`), the pot stands, and the ring under the echo. Drawn on the ground picture of whichever view
 * is up (`renderer.ts` `queue`'s `flat`), in classic px for a camera at (cx, cy), so the isometric view lays them on
 * its floor with the tiles.
 */
import type { GameState, World } from '../types'
import { TILE } from '../types'
import { cellIndex, mapInfo } from '../engine/map'
import { inStencil, stencilsOf, type Stencil } from '../engine/stencils'

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
  for (const e of m.enemies) {
    if (e.dead || (dungeon && e.cell !== s.zoneIndex)) continue
    for (const st of stencilsOf(e)) {
      g.save()
      // Never up the walls: the room's floor only.
      if (dungeon) {
        const z = s.zone
        g.beginPath()
        g.rect((z.x + 1) * T - cx, (z.y + 1) * T - cy, (z.w - 2) * T, (z.h - 2) * T)
        g.clip()
      }
      paint(g, st, cx, cy, time, reduced)
      g.restore()
    }
  }
  if (s.echo) echoRing(g, s.echo.x * T - cx, s.echo.y * T - cy + 4, time, reduced)
}

/**
 * One stencil, a pixel at a time, so that its edge is exactly where the blow's is (`inStencil`): a pink wash that
 * deepens as the tell runs out, a hard edge, and down a lane the chevrons of the way it will be run. A copy's is
 * fainter, and dotted at the edge. Footsteps are only prints: nothing is hit there.
 */
function paint(g: G, st: Stencil, cx: number, cy: number, time: number, reduced: boolean) {
  const faint = st.dim ? 0.55 : 1
  if (st.t === 'steps') { steps(g, st, cx, cy, faint); return }
  const box = bounds(st)
  const x0 = Math.floor(box.x0 * T - cx)
  const x1 = Math.ceil(box.x1 * T - cx)
  const y0 = Math.floor(box.y0 * T - cy)
  const y1 = Math.ceil(box.y1 * T - cy)
  const at = (px: number, py: number) => inStencil(st, (px + 0.5 + cx) / T, (py + 0.5 + cy) / T)
  const blink = !reduced && !st.dim && st.k > 0.65 && Math.floor(time * 14) % 2 === 0
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
        if (!at(px - 2, py) || !at(px + 2, py) || !at(px, py - 2) || !at(px, py + 2)) now = st.dim && (px + py) % 4 < 2 ? 1 : 2
        else if (st.t === 'lane') {
          const wx = (px + 0.5 + cx) / T - st.x0
          const wy = (py + 0.5 + cy) / T - st.y0
          const u = wx * Math.cos(st.a) + wy * Math.sin(st.a)
          const v = Math.abs(wy * Math.cos(st.a) - wx * Math.sin(st.a))
          const phase = u + v * 0.55 - run
          if (v < half * 0.62 && u > 0.2 && phase - Math.floor(phase) < 0.16) now = 3
        }
      }
      if (now === ink) continue
      if (ink) {
        g.globalAlpha = faint * (ink === 1 ? 0.2 + 0.25 * st.k : ink === 2 ? 1 : 0.85)
        g.fillStyle = ink === 2 && blink ? PINK_LIGHT : PINK
        g.fillRect(from, py, px - from, 1)
      }
      ink = now
      from = px
    }
  }
  g.globalAlpha = 1
}

/** The tiles a stencil lies within. */
function bounds(st: Exclude<Stencil, { t: 'steps' }>): { x0: number; y0: number; x1: number; y1: number } {
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
