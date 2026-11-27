/**
 * The Lighthouse's own paint (`world/lighthouse.ts`), in both views:
 *
 * - `drawStrip`: the one stencil shape of the tower, a plain pink rectangle at any angle (ORCA's lane and box, the dark
 *   hound's lane), flat on the floor under everything that stands (`floorMarks.ts`).
 * - `drawLanes`: the Lamp Room's four lanes, a faint inlay on their path tiles.
 * - `stripLights`: pink light along every strip that is up, so that a tell reads in the dim as it does in the light.
 * - `drawEyes`: what there is to see of a dark hound that is unseen.
 */
import type { GameState, World } from '../types'
import { TILE } from '../types'
import { cellIndex, mapInfo } from '../engine/map'
import { stencilsOf, type Stencil } from '../engine/stencils'
import type { Light } from './tiles'

type G = CanvasRenderingContext2D
type Strip = Extract<Stencil, { t: 'strip' }>
const T = TILE

const PINK = '#ff2fa0'
const PINK_LIGHT = '#ffc2e6'

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
        g.globalAlpha = was === 1 ? 0.24 + 0.26 * st.k : was === 3 ? 0.85 : 1
        g.fillStyle = was === 2 && blink ? PINK_LIGHT : PINK
        g.fillRect(from, y, x - from, 1)
      }
      from = x
      was = now
    }
  }
  g.globalAlpha = 1
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
 * Pink light along the strips of the hero's room: the floor is lit with the room, and neither a dim room nor the
 * 8-bit painter's dusk must swallow a tell. Stronger in the dark.
 */
export function stripLights(world: World, s: GameState, lights: Light[], dark: boolean) {
  const dungeon = mapInfo(world, s.map.id).def.kind === 'dungeon'
  for (const e of s.map.enemies) {
    if (e.dead || (dungeon && e.cell !== s.zoneIndex)) continue
    for (const st of stencilsOf(e)) {
      if (st.t !== 'strip') continue
      for (let d = 0.6; d < st.len; d += 1.2) lights.push({ x: st.x0 + st.ux * d, y: st.y0 + st.uy * d, r: 1.2, color: PINK, a: dark ? 0.55 : 0.4 })
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
