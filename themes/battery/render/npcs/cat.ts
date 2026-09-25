/**
 * Mrs Whiskers: a charcoal cat with the Professor's white streak and a
 * white monocle-shaped ring round her right eye. Feet at (a.x, a.y); she
 * faces a.face ('left' or 'right').
 *
 * Poses: 'sleep' curled up, breathing (the start, on the fridge) · 'peek'
 * curled up, one ringed eye open, judging · 'hiss' arched, fur up, mouth
 * open · 'sit' sitting upright · 'monocle' sitting upright wearing the
 * monocle, giving you a long look · '' (any other) sits. She wears the
 * monocle in every sitting pose once F.catMonocle is set.
 */
import { F } from '../../content/flags'
import type { NpcPainter } from '../api'
import { INK, dot, line, oval, poly, rect } from '../rooms/foyer'

const FUR = '#2e2640'
const FUR_HI = '#4c4068'
const FUR_LO = '#1a1428'
const WHITE = '#f4f0ff'
const EYE = '#ffd23f'
const GOLD = '#ffd23f'
const GOLD_D = '#c4861c'

export const paint: NpcPainter = (g, a, v, s) => {
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  const d = a.face === 'right' ? 1 : -1
  const pose = a.pose
  const monocle = !!s.flags[F.catMonocle]
  const talking = v.talking === 'cat'

  if (pose === 'sleep' || pose === 'peek') {
    const br = Math.sin(v.t * 2.2) * 0.6
    // The tail hangs over the edge and swings, lazily.
    const tx = x - d * 9
    for (let k = 0; k < 14; k++) {
      const sx = Math.round(Math.sin(v.t * 1.3 + k * 0.25) * (k / 5))
      rect(g, tx + sx - 1, y - 1 + k, 3, 1, INK)
    }
    for (let k = 0; k < 13; k++) {
      const sx = Math.round(Math.sin(v.t * 1.3 + k * 0.25) * (k / 5))
      dot(g, tx + sx, y - 1 + k, k > 10 ? WHITE : FUR)
    }
    // Body loaf.
    oval(g, x - d * 1, y - 4, 10, 5.2 + br, INK)
    oval(g, x - d * 1, y - 4, 9, 4.4 + br, FUR)
    oval(g, x - d * 1, y - 6.5, 7, 1.6, FUR_HI)
    // Front paws tucked under the chin.
    rect(g, x + d * 5 - 1, y - 2, 4, 2, FUR_HI)
    // Head, resting on the paws, on the facing side.
    const hx = x + d * 8
    const hy = y - 5
    oval(g, hx, hy, 5.2, 4.5, INK)
    oval(g, hx, hy, 4.4, 3.7, FUR)
    poly(g, [[hx - 4, hy - 2], [hx - 4, hy - 7], [hx - 1, hy - 3]], INK)
    poly(g, [[hx + 4, hy - 2], [hx + 4, hy - 7], [hx + 1, hy - 3]], INK)
    dot(g, hx - 3, hy - 4, '#9a5a8a'); dot(g, hx + 3, hy - 4, '#9a5a8a')
    // The Professor's streak, from forehead back over the head.
    line(g, hx, hy - 3, hx - d * 5, hy - 4, WHITE)
    dot(g, hx - d * 6, hy - 4, WHITE)
    // Eyes: the ring round one.
    const re = hx + d * 2
    const le = hx - d * 1.5
    dot(g, re - 1, hy, WHITE); dot(g, re + 1, hy, WHITE); dot(g, re, hy - 1, WHITE); dot(g, re, hy + 1, WHITE)
    if (pose === 'peek') { dot(g, re, hy, EYE) } else { dot(g, re, hy, FUR_LO) }
    dot(g, le, hy, FUR_LO); dot(g, le + d, hy, FUR_LO)
    dot(g, hx + d * 0.5, hy + 2, '#ff8ae0')
    // Zz while asleep.
    if (pose === 'sleep') {
      const p = (v.t * 0.5) % 1
      const zx = hx + d * 3 + Math.round(p * 4) * d
      const zy = hy - 8 - Math.round(p * 8)
      if (p < 0.85) { rect(g, zx, zy, 3, 1, '#cfc6ff'); dot(g, zx + 1, zy + 1, '#cfc6ff'); rect(g, zx, zy + 2, 3, 1, '#cfc6ff') }
    }
    return
  }

  if (pose === 'hiss') {
    // Arched back, fur up, tail like a bottlebrush.
    for (const lx of [-6, -3, 3, 6]) { rect(g, x + lx - 1, y - 6, 3, 6, INK); rect(g, x + lx, y - 6, 1, 5, FUR) }
    oval(g, x, y - 9, 9, 5, INK)
    oval(g, x, y - 9, 8, 4, FUR)
    for (let i = -6; i <= 6; i += 2) dot(g, x + i, y - 14 + Math.abs(i) * 0.3, FUR_HI)
    // Tail.
    for (let i = 0; i < 9; i++) { oval(g, x - d * 9, y - 10 - i, 2.2, 1, INK); dot(g, x - d * 9, y - 10 - i, FUR_HI) }
    // Head, ears back, mouth open.
    const hx = x + d * 9
    oval(g, hx, y - 10, 4.5, 4, INK)
    oval(g, hx, y - 10, 3.6, 3.2, FUR)
    poly(g, [[hx - 1, y - 13], [hx - d * 5, y - 15], [hx - d * 2, y - 11]], INK)
    line(g, hx - 1, y - 12, hx + 2, y - 12, WHITE)
    dot(g, hx + d * 2, y - 11, EYE); dot(g, hx - d, y - 11, EYE)
    dot(g, hx + d * 2 - 1, y - 12, WHITE); dot(g, hx + d * 2 + 1, y - 12, WHITE); dot(g, hx + d * 2, y - 13, WHITE)
    rect(g, hx + d * 1 - 1, y - 8, 3, 2, '#9e1638')
    dot(g, hx, y - 8, WHITE); dot(g, hx + d * 2, y - 8, WHITE)
    return
  }

  // Sitting upright (sit, monocle, or anything else).
  // Tail curled round the feet.
  const tw = Math.round(Math.sin(v.t * 1.6) * 1)
  line(g, x - d * 4, y - 1, x - d * 9, y - 2 + tw, INK)
  line(g, x - d * 9, y - 2 + tw, x - d * 10, y - 6 + tw, INK)
  line(g, x - d * 4, y - 2, x - d * 8, y - 3 + tw, FUR_HI)
  // Body.
  oval(g, x, y - 6, 6, 6.5, INK)
  oval(g, x, y - 6, 5, 5.6, FUR)
  oval(g, x + d * 1, y - 7, 2, 3.5, FUR_HI)
  // Front paws.
  rect(g, x + d * 1 - 1, y - 2, 2, 2, FUR_HI)
  rect(g, x + d * 3 - 1, y - 2, 2, 2, FUR_HI)
  // Head.
  const hx = x + d * 1
  const hy = y - 14
  oval(g, hx, hy, 4.8, 4.3, INK)
  oval(g, hx, hy, 4, 3.5, FUR)
  poly(g, [[hx - 4, hy - 1], [hx - 4, hy - 7], [hx - 1, hy - 3]], INK)
  poly(g, [[hx + 4, hy - 1], [hx + 4, hy - 7], [hx + 1, hy - 3]], INK)
  dot(g, hx - 3, hy - 4, '#9a5a8a'); dot(g, hx + 3, hy - 4, '#9a5a8a')
  // The Professor's streak.
  line(g, hx + d, hy - 4, hx + d, hy - 1, WHITE)
  dot(g, hx + d * 2, hy - 4, WHITE)
  // Eyes: the ringed one is on the facing side.
  const re = hx + d * 2
  const le = hx - d * 1.5
  const blink = Math.floor(v.t * 0.5) % 5 === 0 && (v.t * 0.5) % 1 < 0.1
  if (monocle || pose === 'monocle') {
    // The monocle: a gold ring, a glint, a chain down to the collar.
    oval(g, re, hy, 2.4, 2.4, GOLD)
    oval(g, re, hy, 1.4, 1.4, '#cfe8ff')
    dot(g, re, hy, blink ? FUR : EYE)
    dot(g, re - d, hy - 1, '#ffffff')
    line(g, re + d * 1, hy + 2, x + d * 3, y - 8, GOLD_D)
  } else {
    dot(g, re - 1, hy, WHITE); dot(g, re + 1, hy, WHITE); dot(g, re, hy - 1, WHITE); dot(g, re, hy + 1, WHITE)
    dot(g, re, hy, blink ? FUR : EYE)
  }
  dot(g, le, hy, blink ? FUR : EYE)
  // Nose and mouth.
  dot(g, hx + d * 0.5, hy + 2, '#ff8ae0')
  if (talking && Math.floor(v.t * 8) % 2 === 0) dot(g, hx + d * 0.5, hy + 3, '#9e1638')
  // Whiskers.
  dot(g, hx + d * 5, hy + 1, WHITE); dot(g, hx + d * 6, hy + 2, WHITE)
}
