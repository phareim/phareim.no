/**
 * What the Steamhouse paints (`engine/attendants.ts`, `engine/refuse.ts`): each attendant's ring, flat on the floor
 * under everything that stands; the lingering clock over an attendant's head; the robe over the hero. No pictures of
 * its own beyond rects and arcs: the rings and the clock are the whole of the rule that can be seen.
 *
 * The ring is white, not pink: it is not a blow. A one-pixel ink outline lets it read on any floor. The clock is a
 * white arc that turns pink for its last seconds (pink: this will take you).
 */
import type { GameState, Npc, World } from '../types'
import { TILE } from '../types'
import { clockOf } from '../engine/attendants'
import { cellIndex, mapInfo } from '../engine/map'

type G = CanvasRenderingContext2D
const T = TILE

const INK = '#0b0616'
const WHITE = '#ffffff'
const PINK = '#ff2fa0'

/** Every attendant's ring of the hero's room, flat on the floor (classic px for a camera at (cx, cy)). */
export function drawRings(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean) {
  const info = mapInfo(world, s.map.id)
  const dungeon = info.def.kind === 'dungeon'
  for (const n of s.map.npcs) {
    const a = n.att
    if (!a || a.mode !== 'ask') continue
    if (dungeon && cellIndex(info, n.x, n.y) !== s.zoneIndex && !s.scroll) continue
    const x = Math.round(n.x * T - cx)
    const y = Math.round(n.y * T - cy)
    const r = a.ring * T
    // The dashes turn slowly (still, under reduced motion).
    const turn = reduced ? 0 : time * 6
    g.save()
    g.lineCap = 'butt'
    g.setLineDash([5, 4])
    g.lineDashOffset = -turn
    g.strokeStyle = INK
    g.lineWidth = 3
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.stroke()
    g.strokeStyle = WHITE
    g.globalAlpha = a.made && !a.linger ? 0.45 : 0.9
    g.lineWidth = 1
    g.beginPath()
    g.arc(x, y, r, 0, Math.PI * 2)
    g.stroke()
    g.restore()
  }
}

/** The lingering clock over an attendant's head (`x`, `y`: its feet, classic px): an arc filling clockwise. */
export function drawClock(g: G, n: Npc, x: number, y: number, time: number, reduced: boolean) {
  const c = clockOf(n)
  if (!c) return
  const cxp = Math.round(x)
  const cyp = Math.round(y - 26)
  const r = 5
  const start = -Math.PI / 2
  g.save()
  g.lineCap = 'butt'
  g.strokeStyle = INK
  g.lineWidth = 4
  g.beginPath()
  g.arc(cxp, cyp, r, 0, Math.PI * 2)
  g.stroke()
  // (Pink for the last stretch, and under it the pink still flickers a little: this will take you.)
  g.strokeStyle = c.pink ? (reduced || Math.floor(time * 10) % 4 ? PINK : '#ffc2e6') : WHITE
  g.lineWidth = 2
  g.beginPath()
  g.arc(cxp, cyp, r, start, start + Math.PI * 2 * Math.max(0.04, c.k))
  g.stroke()
  g.restore()
}

/** A towel turban on the hero's head (`x`: the middle, `feet`: where the feet stand, classic px). */
export function drawTurban(g: G, x: number, feet: number) {
  const hx = Math.round(x)
  const top = Math.round(feet) - 18
  g.fillStyle = INK
  g.fillRect(hx - 5, top, 10, 5)
  g.fillRect(hx - 2, top - 2, 5, 3)
  g.fillStyle = WHITE
  g.fillRect(hx - 4, top + 1, 8, 3)
  g.fillRect(hx - 1, top - 1, 3, 2)
  g.fillStyle = '#9ad7ff'
  g.fillRect(hx - 4, top + 3, 8, 1)
}
