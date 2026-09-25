/**
 * Aunt Hedvig: a green, see-through ghost in 1920s pearls, seated behind
 * her round séance table (the painter draws the table in front of her, so
 * she sorts with it). Feet (the table's foot) at (a.x, a.y).
 *
 * Poses: '' seated, teacup raised, pinky out · 'trance' eyes shut, hands
 * on the crystal ball (the séance) · 'shock' hands up, eyes wide ·
 * 'float' no table, the whole ghost with a wispy tail (the room then draws
 * the table itself). A talking mouth when v.talking === 'hedvig'.
 *
 * `hedvigGlow` is her emissive rim, eyes and pearls; the parlour's glow()
 * calls it so she shines through the light map.
 */
import { makeCanvas } from '../../../base/pixel/stage'
import type { ActorState, GameState } from '../../types'
import type { G, NpcPainter, View } from '../api'
import { INK, dot, line, oval, ovalK, poly, rect } from '../rooms/foyer'

const MINT = '#7dffb8'
const MINT_D = '#3fd89a'
const MINT_DD = '#1f9a6e'
const MINT_HI = '#d8fff0'
const HAIR = '#1f7a5a'
const HAIR_HI = '#3fb88a'
const FACE = '#c8ffe4'
const RIM = '#0f4a34'

let buf: HTMLCanvasElement | null = null

/** Draws the ghost into a 48×72 buffer, feet-of-torso at (24, 60). */
function ghost(c: G, a: ActorState, v: View) {
  const cx = 24
  const pose = a.pose
  const talking = v.talking === 'hedvig'
  const float = pose === 'float'
  // Torso: a drop-waist dress, the waist hidden behind the table.
  const top = 20
  if (float) {
    // Wispy tail curling below.
    for (let i = 0; i < 14; i++) {
      const w = 9 - i * 0.6
      const x = cx + Math.sin(v.t * 3 + i * 0.5) * (i * 0.35)
      oval(c, x, 54 + i, Math.max(1, w), 1.5, i % 3 === 0 ? MINT_D : MINT)
    }
  }
  poly(c, [[cx - 8, top + 14], [cx + 8, top + 14], [cx + 11, 58], [cx - 11, 58]], RIM)
  poly(c, [[cx - 7, top + 15], [cx + 7, top + 15], [cx + 10, 57], [cx - 10, 57]], MINT)
  poly(c, [[cx + 3, top + 15], [cx + 7, top + 15], [cx + 10, 57], [cx + 5, 57]], MINT_D)
  // Drop waist sash with a bow.
  rect(c, cx - 10, 48, 20, 2, MINT_DD)
  oval(c, cx - 7, 49, 2, 1.5, MINT_DD)
  // Shoulders.
  oval(c, cx, top + 16, 9, 3, MINT)
  // Neck and head.
  rect(c, cx - 2, top + 9, 4, 5, FACE)
  ovalK(c, cx, top + 4, 6, 7, FACE, RIM)
  oval(c, cx + 3, top + 6, 2, 3, MINT)
  // The bob: finger waves, cut at the jaw.
  oval(c, cx, top - 1, 8, 5, HAIR)
  rect(c, cx - 8, top - 1, 4, 10, HAIR)
  rect(c, cx + 4, top - 1, 4, 10, HAIR)
  oval(c, cx - 6, top + 9, 2, 2, HAIR)
  oval(c, cx + 6, top + 9, 2, 2, HAIR)
  for (let i = -6; i <= 5; i += 3) { dot(c, cx + i, top - 3, HAIR_HI); dot(c, cx + i + 1, top - 2, HAIR_HI) }
  line(c, cx - 7, top + 2, cx - 7, top + 7, HAIR_HI)
  // Headband, jewel and a curling feather.
  rect(c, cx - 8, top - 1, 16, 2, MINT_HI)
  rect(c, cx - 8, top, 16, 1, MINT_D)
  dot(c, cx + 4, top - 1, '#ffffff')
  for (let i = 0; i < 9; i++) {
    const fx = cx + 5 + Math.round(Math.sin(i * 0.5 + v.t * 2) * 1 + i * 0.5)
    const fy = top - 2 - i
    dot(c, fx, fy, i > 6 ? MINT_HI : MINT)
    dot(c, fx - 1, fy, i % 2 ? MINT_D : MINT)
  }
  // Face: big ghostly eyes with lashes, a cupid's-bow mouth.
  const shut = pose === 'trance' || (!talking && Math.floor(v.t * 0.7) % 7 === 0 && (v.t * 0.7) % 1 < 0.15)
  if (shut) {
    line(c, cx - 4, top + 4, cx - 2, top + 4, RIM)
    line(c, cx + 1, top + 4, cx + 3, top + 4, RIM)
  } else if (pose === 'shock') {
    oval(c, cx - 3, top + 3, 1.5, 2, RIM); oval(c, cx + 2, top + 3, 1.5, 2, RIM)
    dot(c, cx - 3, top + 3, '#ffffff'); dot(c, cx + 2, top + 3, '#ffffff')
  } else {
    rect(c, cx - 4, top + 3, 2, 2, RIM); rect(c, cx + 1, top + 3, 2, 2, RIM)
    dot(c, cx - 4, top + 3, '#ffffff'); dot(c, cx + 1, top + 3, '#ffffff')
    dot(c, cx - 5, top + 2, RIM); dot(c, cx + 3, top + 2, RIM)
  }
  // Rouge.
  dot(c, cx - 4, top + 6, '#7de8b0'); dot(c, cx + 3, top + 6, '#7de8b0')
  const open = talking && Math.floor(v.t * 9) % 2 === 0
  if (pose === 'shock') oval(c, cx - 0.5, top + 8, 1.5, 1.5, RIM)
  else if (open) { rect(c, cx - 2, top + 7, 3, 2, RIM); dot(c, cx - 1, top + 8, '#0b2a1e') }
  else { rect(c, cx - 2, top + 8, 3, 1, MINT_DD); dot(c, cx - 1, top + 7, MINT_DD) }
  // Long pearls, knotted at the waist.
  for (let i = 0; i < 16; i++) {
    const t = i / 15
    const px = cx - 4 + Math.round(Math.sin(t * Math.PI) * 4 + t * 4)
    dot(c, px, top + 12 + Math.round(t * 22), '#ffffff')
  }
  dot(c, cx + 1, top + 35, '#ffffff'); dot(c, cx + 2, top + 37, '#ffffff'); dot(c, cx + 1, top + 39, '#ffffff')
  // Arms.
  if (pose === 'trance') {
    poly(c, [[cx - 9, top + 16], [cx - 6, top + 17], [cx - 3, top + 38], [cx - 6, top + 39]], MINT_D)
    poly(c, [[cx + 9, top + 16], [cx + 6, top + 17], [cx + 3, top + 38], [cx + 6, top + 39]], MINT_D)
    oval(c, cx - 4, top + 39, 2, 1.5, FACE); oval(c, cx + 4, top + 39, 2, 1.5, FACE)
  } else if (pose === 'shock') {
    poly(c, [[cx - 9, top + 16], [cx - 7, top + 15], [cx - 13, top + 2], [cx - 15, top + 3]], MINT_D)
    poly(c, [[cx + 9, top + 16], [cx + 7, top + 15], [cx + 13, top + 2], [cx + 15, top + 3]], MINT_D)
    oval(c, cx - 14, top + 1, 2, 2, FACE); oval(c, cx + 14, top + 1, 2, 2, FACE)
  } else {
    // Left arm rests towards the ball; right arm holds up a teacup, pinky out.
    poly(c, [[cx - 9, top + 16], [cx - 6, top + 17], [cx - 5, top + 36], [cx - 8, top + 36]], MINT_D)
    oval(c, cx - 6, top + 37, 2, 1.5, FACE)
    const sip = Math.sin(v.t * 0.8) > 0.85 ? -2 : 0
    poly(c, [[cx + 9, top + 16], [cx + 6, top + 18], [cx + 9, top + 26], [cx + 12, top + 25]], MINT_D)
    poly(c, [[cx + 9, top + 26], [cx + 12, top + 25], [cx + 13, top + 16 + sip], [cx + 10, top + 17 + sip]], MINT_D)
    // Teacup and saucer.
    rect(c, cx + 9, top + 12 + sip, 6, 4, MINT_HI)
    rect(c, cx + 9, top + 12 + sip, 6, 1, '#ffffff')
    rect(c, cx + 15, top + 13 + sip, 1, 2, MINT_HI)
    rect(c, cx + 8, top + 16 + sip, 8, 1, MINT)
    dot(c, cx + 8, top + 14 + sip, FACE)
    // Steam from ghostly tea.
    const st = Math.floor(v.t * 3) % 3
    dot(c, cx + 11 + (st === 1 ? 1 : 0), top + 10 + sip - st, MINT_HI)
  }
}

/** The séance table (drawn in front of her): cloth, fringe, crystal ball, teacups. */
export function drawTable(g: G, x: number, y: number, v: View, s: GameState) {
  const top = y - 10
  // Cloth drape: a round table, so the hem curves towards us, in folds.
  const hem = (dx: number) => y + 4 + Math.round(3 * Math.sqrt(Math.max(0, 1 - (dx / 27) ** 2)))
  for (let dx = -27; dx <= 27; dx++) {
    const w = 24 + Math.round(3 * Math.abs(dx) / 27)
    if (Math.abs(dx) > w) continue
    const b = hem(dx)
    rect(g, x + dx, top, 1, b - top + 1, INK)
    if (Math.abs(dx) < 27) {
      const fold = ((dx + 30) % 6) < 2
      rect(g, x + dx, top, 1, b - top, fold ? '#5a0c28' : Math.abs(dx) > 20 ? '#6a1030' : '#7a1438')
      dot(g, x + dx, b, (dx & 1) ? '#ffd23f' : '#c4861c')
    }
  }
  // Top.
  ovalK(g, x, top, 25, 4, '#9e1a48')
  oval(g, x, top - 1, 22, 2.5, '#b8285a')
  // Teacups (four, one each for the spirits).
  for (const dx of [-18, -10, 10, 17]) {
    rect(g, x + dx - 2, top - 3, 4, 3, '#fff4ff')
    rect(g, x + dx - 2, top - 3, 4, 1, '#cfc6ff')
    rect(g, x + dx - 3, top, 6, 1, '#cfc6ff')
  }
  // Crystal ball on a brass stand.
  rect(g, x - 3, top - 2, 7, 2, INK)
  rect(g, x - 2, top - 2, 5, 1, '#ffd23f')
  const live = !!s.flags['parlour.seanceLive']
  ovalK(g, x + 0.5, top - 7, 5, 5, live ? '#c8fff0' : '#8fd8ff')
  oval(g, x + 0.5, top - 6, 3.5, 3.5, live ? '#7dffb8' : '#5a9adf')
  const sw = Math.sin(v.t * 2) * 1.5
  dot(g, x + sw, top - 6, '#ffffff')
  dot(g, x - 2, top - 9, '#ffffff'); dot(g, x - 1, top - 10, '#ffffff')
}

export const paint: NpcPainter = (g, a, v, s) => {
  if (!buf) buf = makeCanvas(48, 72)
  const c = buf.getContext('2d')!
  c.clearRect(0, 0, 48, 72)
  ghost(c, a, v)
  const bob = Math.round(Math.sin(v.t * 1.6) * 1.5)
  const x = Math.round(a.x) - 24
  const y = Math.round(a.y) - 70 + bob + (a.pose === 'float' ? -6 : 0)
  g.globalAlpha = 0.72
  g.drawImage(buf, x, y)
  g.globalAlpha = 1
  if (a.pose !== 'float') drawTable(g, Math.round(a.x), Math.round(a.y), v, s)
}

/** Her glow: rim, eyes and pearls at full brightness (call from the room's glow()). */
export function hedvigGlow(g: G, a: ActorState, v: View, s: GameState) {
  if (!buf) return
  const bob = Math.round(Math.sin(v.t * 1.6) * 1.5)
  const x = Math.round(a.x) - 24
  const y = Math.round(a.y) - 70 + bob + (a.pose === 'float' ? -6 : 0)
  const pulse = 0.28 + Math.sin(v.t * 2.2) * 0.08
  g.globalAlpha = pulse
  // Seated, only what stands above the table shines.
  const hCut = a.pose === 'float' ? 72 : Math.max(1, Math.min(72, Math.round(a.y) - 14 - y))
  g.drawImage(buf, 0, 0, 48, hCut, x, y, 48, hCut)
  g.globalAlpha = 1
  if (a.pose !== 'float') {
    const top = Math.round(a.y) - 10
    const live = !!s.flags['parlour.seanceLive']
    g.globalAlpha = live ? 0.9 : 0.45 + Math.sin(v.t * 3) * 0.1
    oval(g, a.x + 0.5, top - 6, 3.5, 3.5, live ? '#b8ffd8' : '#8fd8ff')
    g.globalAlpha = 1
    dot(g, a.x + Math.sin(v.t * 2) * 1.5, top - 6, '#ffffff')
  }
}
