/**
 * Gustav: a carnivorous plant the size of a wardrobe, in a fat terracotta
 * pot with his name on it. Feet (the pot's foot) at (a.x, a.y); the head
 * leans towards a.face.
 *
 * Poses: '' idle: sways, breathes, eyes follow the room · 'snap' lunges
 * sideways, jaws wide · 'chomp' chewing fast · 'burp' head thrown back,
 * mouth wide · 'sleep' head drooped on the rim, eyes shut, snoring, Zzz.
 * The jaw works when v.talking === 'gustav'.
 */
import { drawText } from '../../../base/pixel/sprites'
import type { NpcPainter } from '../api'
import { INK, dot, line, oval, poly, rect } from '../rooms/foyer'

const LEAF = '#3f9a2a'
const LEAF_D = '#1f5a1a'
const LEAF_HI = '#8fd82a'
const LIME = '#b6ff4a'
const MOUTH = '#c8284a'
const THROAT = '#5a0a20'
const TOOTH = '#fff4e0'
const POT = '#c0603a'
const POT_HI = '#e0844e'
const POT_D = '#7a3420'

/** Half an ellipse: upper (dir −1) or lower (dir 1), filled. */
function lobe(g: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, dir: 1 | -1, c: string) {
  g.fillStyle = c
  for (let k = 0; k <= Math.ceil(ry); k++) {
    const t = k / Math.max(1, ry)
    if (t > 1) break
    const hw = rx * Math.sqrt(1 - t * t)
    const y = Math.round(cy + dir * k)
    g.fillRect(Math.round(cx - hw), y, Math.round(hw * 2), 1)
  }
}

function leaf(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, w: number) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const pts: [number, number][] = []
  for (let i = 0; i <= 8; i++) { const t = i / 8; const s = Math.sin(t * Math.PI) * w; pts.push([x0 + dx * t + nx * s, y0 + dy * t + ny * s]) }
  for (let i = 8; i >= 0; i--) { const t = i / 8; const s = Math.sin(t * Math.PI) * w * 0.7; pts.push([x0 + dx * t - nx * s, y0 + dy * t - ny * s]) }
  poly(g, pts.map(([x, y]) => [x + 1, y + 1] as const), INK)
  poly(g, pts, LEAF)
  poly(g, pts.slice(0, 9).concat([[x1, y1], [x0, y0]]), LEAF_HI)
  line(g, x0, y0, x1, y1, LEAF_D)
}

export const paint: NpcPainter = (g, a, v) => {
  const x = Math.round(a.x)
  const y = Math.round(a.y)
  const d = a.face === 'right' ? 1 : -1
  const pose = a.pose
  const t = v.t
  const talking = v.talking === 'gustav'

  // Head placement and jaw opening per pose.
  let hx = x + d * 10 + Math.sin(t * 1.2) * 2
  let hy = y - 64 + Math.sin(t * 1.7) * 1.5
  let open = 3 + Math.sin(t * 1.7) * 1.5
  if (talking) open = 3 + Math.abs(Math.sin(t * 10)) * 7
  if (pose === 'snap') { hx = x + d * 28 + Math.sin(t * 40) * 1; hy = y - 60; open = Math.floor(t * 8) % 2 ? 12 : 1 }
  if (pose === 'chomp') { open = Math.floor(t * 7) % 2 ? 7 : 1; hy += Math.floor(t * 7) % 2 }
  if (pose === 'burp') { hy = y - 68; open = 14 }
  const asleep = pose === 'sleep'
  if (asleep) { hx = x + d * 20; hy = y - 40; open = 3 + Math.sin(t * 1.4) * 1.2 }

  // Back leaves.
  const sw = Math.sin(t * 1.1) * 1.5
  leaf(g, x - 4, y - 30, x - 42 + sw, y - 62, 9)
  leaf(g, x + 4, y - 30, x + 40 + sw, y - 68, 9)
  leaf(g, x + 2, y - 30, x + 30 - sw, y - 44, 6)

  // The stem: a thick curve from the soil to the head.
  for (let i = 0; i <= 16; i++) {
    const s = i / 16
    const bx = x + (hx - x) * s + Math.sin(s * Math.PI) * -d * 8
    const by = (y - 30) + (hy + 10 - (y - 30)) * s
    oval(g, bx, by, 5.5, 2.5, INK)
  }
  for (let i = 0; i <= 16; i++) {
    const s = i / 16
    const bx = x + (hx - x) * s + Math.sin(s * Math.PI) * -d * 8
    const by = (y - 30) + (hy + 10 - (y - 30)) * s
    oval(g, bx, by, 4.5, 1.8, LEAF)
    dot(g, bx - 2, by, LEAF_HI); dot(g, bx + 2, by, LEAF_D)
  }

  // Pot: fat, bulging, a thick rim, his name on it.
  for (let py = y - 30; py < y; py++) {
    const k = (py - (y - 30)) / 30
    const hw = 22 + Math.sin(k * Math.PI) * 6 - k * 4
    rect(g, x - hw - 1, py, hw * 2 + 2, 1, INK)
    rect(g, x - hw, py, hw * 2, 1, POT)
    rect(g, x - hw, py, 3, 1, POT_HI)
    rect(g, x + hw - 4, py, 4, 1, POT_D)
  }
  rect(g, x - 28, y - 35, 56, 7, INK)
  rect(g, x - 27, y - 34, 54, 5, POT_HI)
  rect(g, x - 27, y - 30, 54, 1, POT_D)
  rect(g, x - 25, y - 36, 50, 1, '#3a2010')
  drawText(g, 'GUSTAV', x - 17, y - 22, '#fff1b0')
  rect(g, x - 24, y - 1, 48, 1, POT_D)

  // Front leaves, drooping over the rim.
  leaf(g, x - 8, y - 34, x - 32 - sw, y - 24, 6)
  leaf(g, x + 8, y - 34, x + 31 - sw, y - 22, 6)

  // Head: upper and lower jaw lobes, the red mouth between.
  const rx = 26
  const lipY = Math.round(hy)
  const low = Math.round(hy + open)
  // Mouth interior.
  rect(g, hx - rx + 2, lipY, rx * 2 - 4, Math.max(1, low - lipY), THROAT)
  if (low - lipY > 3) {
    rect(g, hx - rx + 4, lipY + 1, rx * 2 - 8, 1, MOUTH)
    oval(g, hx, low - 1, 6, 1.5, '#ff5c7a')
  }
  // Upper jaw.
  lobe(g, hx, lipY, rx + 1, 15, -1, INK)
  lobe(g, hx, lipY, rx, 14, -1, LEAF)
  lobe(g, hx, lipY - 4, rx - 4, 9, -1, LEAF_HI)
  for (const [ox, oy] of [[-14, -6], [-6, -10], [6, -8], [15, -4], [0, -5], [-18, -2]] as const) { dot(g, hx + ox, lipY + oy, LIME); dot(g, hx + ox + 1, lipY + oy, LIME) }
  rect(g, hx - rx + 1, lipY - 1, rx * 2 - 2, 1, MOUTH)
  // Lower jaw.
  lobe(g, hx, low, rx - 1, 11, 1, INK)
  lobe(g, hx, low, rx - 2, 10, 1, LEAF)
  lobe(g, hx, low + 3, rx - 8, 5, 1, LEAF_D)
  rect(g, hx - rx + 3, low, rx * 2 - 6, 1, MOUTH)
  // Teeth: down from the upper lip, up from the lower.
  for (let i = -rx + 4; i < rx - 3; i += 4) {
    const tl = (i % 8 === 0) ? 3 : 2
    for (let k = 0; k < tl; k++) rect(g, hx + i + Math.floor(k / 2), lipY + k, Math.max(1, 3 - k * 1), 1, TOOTH)
    for (let k = 0; k < 2; k++) rect(g, hx + i + 2 + Math.floor(k / 2), low - 1 - k, Math.max(1, 2 - k), 1, TOOTH)
  }
  // Spiky "eyelashes" round the lobe's edge.
  for (let i = 0; i < 7; i++) {
    const an = Math.PI * (0.1 + i * 0.8 / 6)
    const ex = hx - Math.cos(an) * (rx + 1)
    const ey = lipY - Math.sin(an) * 15
    line(g, ex, ey, ex - Math.cos(an) * 3, ey - Math.sin(an) * 3, LEAF_D)
  }
  // Eyes on top: bulging, heavy lids; they look towards the face side.
  for (const ex of [hx - 9, hx + 9]) {
    const ey = lipY - 14
    oval(g, ex, ey, 5.2, 5.2, INK)
    oval(g, ex, ey, 4.3, 4.3, '#fff4ff')
    if (asleep) {
      lobe(g, ex, ey + 1, 3.6, 4, -1, LEAF)
      line(g, ex - 3, ey + 1, ex + 3, ey + 1, INK)
    } else {
      const look = pose === 'snap' || pose === 'burp' ? d * 2 : Math.round(Math.sin(t * 0.4) * 1.5) + d
      oval(g, ex + look, ey + 1, 1.6, 1.8, INK)
      dot(g, ex + look - 1, ey, '#ffffff')
      // Heavy lid.
      lobe(g, ex, ey - 1, 3.8, 3, -1, LEAF)
      rect(g, ex - 4, ey - 1, 8, 1, LEAF_D)
    }
  }
  if (asleep) {
    // Snot bubble and Zzz.
    const b = 1 + (Math.sin(t * 1.4) + 1) * 1.5
    oval(g, hx + d * 16, lipY + 3, b, b, '#cfe8ff')
    dot(g, hx + d * 16 - 1, lipY + 2, '#ffffff')
    for (let i = 0; i < 3; i++) {
      const p = (t * 0.35 + i / 3) % 1
      const zx = Math.round(hx - d * 8 + p * 16 * -d)
      const zy = Math.round(lipY - 20 - p * 22)
      if (p < 0.9) drawText(g, 'Z', zx, zy, p < 0.5 ? '#ffffff' : '#cfc6ff')
    }
  }
  if (pose === 'burp') {
    for (let i = 0; i < 4; i++) {
      const p = (t * 1.5 + i / 4) % 1
      oval(g, hx + Math.sin(i * 2) * 6, lipY - 16 - p * 16, 1 + p * 2, 1 + p * 2, '#b8ffb0')
    }
  }
}
