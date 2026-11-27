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
      lane(g, st, cx, cy, time, reduced)
      g.restore()
    }
  }
  if (s.echo) echoRing(g, s.echo.x * T - cx, s.echo.y * T - cy + 4, time, reduced)
}

/** A lane (they run along an axis): a wash that deepens as the tell runs out, a hard edge, chevrons down it. */
function lane(g: G, st: Stencil, cx: number, cy: number, time: number, reduced: boolean) {
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
