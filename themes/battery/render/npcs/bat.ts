/**
 * Count Flapula: a small, theatrical vampire bat in a high-collared cape
 * (black outside, blood-red lining). Feet at (a.x, a.y).
 *
 * Poses:
 * - 'hang' (and '') — upside down from the latch: toes at a.y, the caped
 *   body below, the head at the bottom (ears pointing down). Sways, blinks,
 *   talks with a fanged mouth.
 * - 'rafter' — the same from a rafter, hugging the jam jar and drinking it
 *   through a bendy straw, eyes shut in bliss; the jam goes down slowly.
 * - 'fly' — wings out, flapping, the jam jar in his feet, the body centred
 *   8 px under a.y (so a flight of `place` steps from the latch reads as one
 *   move).
 */
import type { NpcPainter } from '../api'

const K = '#0b0616'
const CAPE = '#1c1030'
const CAPE_HI = '#5a3a88'
const LINING = '#c01838'
const LINING_HI = '#ff3b5c'
const FUR = '#5e4478'
const FUR_HI = '#8a6aa8'
const SKIN = '#c89ac0'
const EAR_IN = '#e0708a'
const EYE = '#ffd23f'
const FANG = '#fff4ff'
const WING = '#2a1840'
const WING_HI = '#4a2a68'

type G = CanvasRenderingContext2D

function px(g: G, x: number, y: number, c: string, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(Math.round(x), Math.round(y), w, h)
}

/** The head, upside down: chin at y (towards the body), ears pointing down. */
function headDown(g: G, x: number, y: number, t: number, talking: boolean, bliss: boolean) {
  // Outline, skull, a lighter muzzle near the chin.
  px(g, x - 5, y, K, 11, 9)
  px(g, x - 4, y - 1, K, 9, 11)
  px(g, x - 4, y, FUR, 9, 9)
  px(g, x - 5, y + 1, FUR, 11, 6)
  px(g, x - 3, y, SKIN, 7, 4)
  px(g, x - 4, y + 7, FUR_HI, 9, 1)
  // A widow's peak (pointing down: he is upside down).
  px(g, x - 1, y + 8, K, 3, 1); px(g, x, y + 9, K)
  // Ears, pointing down, pink inside.
  px(g, x - 5, y + 7, K, 4, 4); px(g, x - 6, y + 10, K, 2, 3)
  px(g, x + 2, y + 7, K, 4, 4); px(g, x + 5, y + 10, K, 2, 3)
  px(g, x - 4, y + 8, EAR_IN, 2, 2); px(g, x - 5, y + 10, EAR_IN, 1, 2)
  px(g, x + 3, y + 8, EAR_IN, 2, 2); px(g, x + 5, y + 10, EAR_IN, 1, 2)
  // Eyes.
  const blink = !bliss && (t % 3.7) < 0.14
  if (bliss || blink) {
    px(g, x - 4, y + 4, K, 3, 1); px(g, x + 2, y + 4, K, 3, 1)
    if (bliss) { px(g, x - 4, y + 5, K); px(g, x - 2, y + 5, K); px(g, x + 2, y + 5, K); px(g, x + 4, y + 5, K) }
  } else {
    px(g, x - 4, y + 4, EYE, 3, 2); px(g, x + 2, y + 4, EYE, 3, 2)
    px(g, x - 3, y + 4, K); px(g, x + 3, y + 4, K)
  }
  // Very arched eyebrows (dramatic), below the eyes on screen.
  px(g, x - 4, y + 6, K, 2, 1); px(g, x - 2, y + 7, K); px(g, x + 3, y + 6, K, 2, 1); px(g, x + 2, y + 7, K)
  // Mouth, and fangs pointing up towards the body.
  const open = talking && Math.floor(t * 8) % 2 === 0
  if (open) {
    px(g, x - 2, y + 1, K, 5, 2); px(g, x - 1, y + 1, LINING, 3, 1)
  } else {
    px(g, x - 2, y + 2, K, 5, 1)
  }
  px(g, x - 2, y + (open ? 0 : 1), FANG); px(g, x + 2, y + (open ? 0 : 1), FANG)
}

/** The caped body hanging from toes at (x, y), swaying by `dx` at the bottom. */
function hangingBody(g: G, x: number, y: number, dx: number, jar: number | null, t: number) {
  // Toes gripping.
  px(g, x - 2, y - 1, K, 5, 3)
  px(g, x - 2, y, '#8a8098'); px(g, x + 2, y, '#8a8098')
  px(g, x - 1, y + 1, K, 1, 2); px(g, x + 1, y + 1, K, 1, 2)
  const sx = (row: number) => Math.round((row / 14) * dx)
  // The cape: narrow at the feet, wide at the collar.
  for (let row = 0; row <= 11; row++) {
    const hw = 2 + Math.round(row * 0.42)
    const yy = y + 3 + row
    const cx = x + sx(row)
    px(g, cx - hw - 1, yy, K, hw * 2 + 3, 1)
    px(g, cx - hw, yy, CAPE, hw * 2 + 1, 1)
    px(g, cx - hw, yy, CAPE_HI)
    px(g, cx + hw, yy, CAPE_HI)
    // The lining shows down the front opening.
    if (row > 3) px(g, cx, yy, LINING)
  }
  // High collar, flaring out beside the head.
  const cy = y + 15
  const cx = x + sx(12)
  px(g, cx - 8, cy - 1, K, 4, 5); px(g, cx + 5, cy - 1, K, 4, 5)
  px(g, cx - 7, cy, LINING, 2, 3); px(g, cx + 6, cy, LINING, 2, 3)
  px(g, cx - 7, cy, LINING_HI); px(g, cx + 7, cy, LINING_HI)
  px(g, cx - 6, cy + 3, CAPE, 2, 1); px(g, cx + 5, cy + 3, CAPE, 2, 1)
  if (jar !== null) {
    // A wing-hand round the jam jar, a bendy straw into his mouth.
    const jx = cx + 7
    const jy = cy + 1
    px(g, jx - 1, jy - 1, K, 8, 10)
    px(g, jx, jy, '#d8e8f0', 6, 8)
    const lvl = Math.round(7 * jar)
    px(g, jx, jy + 8 - lvl, '#b01838', 6, lvl)
    if (lvl > 1) px(g, jx + 1, jy + 8 - lvl, '#ff3b5c', 2, 1)
    px(g, jx, jy - 1, '#ffd23f', 6, 1)
    px(g, jx + 1, jy + 1, '#ffffff', 1, 2)
    // Straw.
    px(g, jx + 3, jy - 4, '#ff8ae0', 1, 6)
    px(g, jx - 2, jy - 4, '#ff8ae0', 5, 1)
    px(g, jx - 3, jy - 3, '#ff8ae0', 1, 3)
    // Bubbles now and then.
    if (Math.floor(t * 2) % 3 === 0) px(g, jx + 2, jy + 8 - lvl + 1, '#ff8ae0')
    // The wing wrapped round it.
    px(g, jx - 2, jy + 3, CAPE, 3, 3); px(g, jx + 5, jy + 4, CAPE, 2, 3)
  }
  return cx
}

export const paint: NpcPainter = (g, a, v) => {
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  const t = v.t
  const talking = v.talking === 'bat'
  if (a.pose === 'fly') {
    const by = y + 8
    const up = Math.floor(t * 14) % 2 === 0
    const dir = a.face === 'left' ? -1 : 1
    // Wings.
    for (const s of [-1, 1] as const) {
      for (let i = 0; i < 9; i++) {
        const wx = x + s * (3 + i)
        const lift = up ? -Math.round(i * 0.7) : Math.round(i * 0.35)
        const hgt = 5 - Math.floor(i / 3)
        px(g, wx, by - 2 + lift - 1, K, 1, hgt + 2)
        px(g, wx, by - 2 + lift, i % 3 === 2 ? WING_HI : WING, 1, hgt)
      }
    }
    // Body in the cape, lining out behind.
    px(g, x - 3, by - 4, K, 7, 9)
    px(g, x - 2, by - 3, CAPE, 5, 7)
    px(g, x - 1, by + 1, LINING, 3, 2)
    // Head upright.
    px(g, x - 3, by - 9, K, 7, 6)
    px(g, x - 2, by - 8, FUR, 5, 4)
    px(g, x - 3, by - 11, K, 2, 3); px(g, x + 2, by - 11, K, 2, 3)
    px(g, x - 1 + dir, by - 7, EYE); px(g, x + 1 + dir, by - 7, EYE)
    px(g, x - 1 + dir, by - 5, FANG); px(g, x + 1 + dir, by - 5, FANG)
    // The jam jar, clutched in his feet.
    px(g, x - 3, by + 5, K, 7, 7)
    px(g, x - 2, by + 6, '#b01838', 5, 5)
    px(g, x - 2, by + 6, '#ffd23f', 5, 1)
    px(g, x - 1, by + 7, '#ff3b5c')
    return
  }
  const rafter = a.pose === 'rafter'
  const sway = rafter ? Math.sin(t * 0.8) * 0.6 : Math.sin(t * 1.3) * 1.2
  const jar = rafter ? Math.max(0.15, 1 - ((t * 0.01) % 0.85)) : null
  const cx = hangingBody(g, x, y, sway, jar, t)
  headDown(g, cx, y + 16, t, talking, rafter && !talking)
}
