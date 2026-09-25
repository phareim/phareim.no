/**
 * The pantry: Dag's cellar room. Violet stone, teal plaster flaking off,
 * red-brown flags. Left: crooked stairs up to a door nailed shut from the
 * other side (open once F.stairsDown). The jam shelves (LINGON 1987), the
 * chute hole in the ceiling with a flap of the foyer's chequered floor
 * hanging out of it, the mattress that caught Dag, the dumbwaiter hatch
 * and its bell, the herring barrel, the coal chute with the rain coming in,
 * and the doorway to the boiler room. One bare bulb.
 */
import { drawText, textWidth, sprite } from '../../../base/pixel/sprites'

import { F } from '../../content/flags'
import type { G, RoomPainter } from '../api'
import { rainIn } from '../fx'
import { INK, R, P, box, dith, ellipse, line, stones, slabs, cobweb, drip, hash, mix } from './cellar-kit'

const FLOOR_Y = 102

/** A herring's head, nose up, one big round eye. */
const HERRING = [
  '..kk...',
  '.kwWk..',
  'kwWWWk.',
  'kWkkWWk',
  'kWkwWgk',
  'kWWWWgk',
  'kWWWggk',
  '.kWggk.',
  '.kgGgk.',
]
const HERRING_BLINK = HERRING.map((r, i) => (i === 3 || i === 4 ? r.replace('kk', 'WW').replace('kw', 'kk') : r))
const BULB_X = 232
const BULB_Y = 30

const WOOD = { b: '#8a5430', hi: '#c07a44', lo: '#5a3018', dk: '#3a1e10' }

// ---------------------------------------------------------------------------
// Static background
// ---------------------------------------------------------------------------

function walls(g: G, w: number) {
  // Stone, violet and dusty.
  stones(g, 0, 8, w, FLOOR_Y, ['#6a5a8e', '#5e5082', '#74649a', '#655788'], '#2a1f40', '#8a7ab0', 7)
  // Teal plaster flaking off in patches.
  const patches: [number, number, number, number][] = [[92, 10, 96, 60], [226, 12, 60, 50], [300, 30, 34, 30]]
  for (const [px, py, pw, ph] of patches) {
    for (let y = py; y < py + ph; y++) {
      for (let x = px; x < px + pw; x++) {
        const ex = Math.min(x - px, px + pw - 1 - x, y - py, py + ph - 1 - y)
        const rough = hash(x * 3 + y * 977) * 5
        if (ex + rough < 3) continue
        const c = (y - py) < 2 ? '#7cc8bc' : hash(x * 7 + y * 131) < 0.05 ? '#3a7c78' : y > py + ph - 5 && hash(x + y * 3) < 0.4 ? '#3f8a84' : '#4f9e96'
        P(g, x, y, c)
      }
    }
  }
  // Damp stains running down from the ceiling.
  for (const sx of [40, 150, 276, 330]) {
    for (let y = 9; y < 9 + 20 + hash(sx) * 30; y++) {
      const wob = Math.round(Math.sin(y * 0.3 + sx) * 1.5)
      if (hash(sx + y * 13) < 0.6) P(g, sx + wob, y, '#3e3462')
    }
  }
  // Nothing in this house is straight: the stone courses sag and bulge.
  for (let x = 0; x < w; x++) {
    const off = Math.round(Math.sin(x * 0.05) * 2.2 + Math.sin(x * 0.017 + 1) * 1.6)
    if (off) g.drawImage(g.canvas, x, 8, 1, FLOOR_Y - 8, x, 8 + off, 1, FLOOR_Y - 8)
  }
  // Skirting shadow where the wall meets the floor.
  R(g, 0, FLOOR_Y - 2, w, 2, '#2a1f40')
}

function ceiling(g: G, w: number) {
  R(g, 0, 0, w, 9, WOOD.dk)
  // The main beam, and the joists' ends.
  R(g, 0, 5, w, 4, WOOD.lo)
  R(g, 0, 5, w, 1, WOOD.b)
  for (let x = 6; x < w; x += 38) {
    R(g, x, 0, 10, 8, WOOD.b)
    R(g, x, 0, 1, 8, WOOD.hi)
    R(g, x + 9, 0, 1, 8, WOOD.dk)
    R(g, x, 7, 10, 1, INK)
  }
  R(g, 0, 9, w, 1, INK)
}

/** The chute hole in the ceiling, with a flap of the foyer's chequered floor hanging from it. */
function chute(g: G) {
  const x0 = 184
  R(g, x0 - 1, 0, 34, 11, INK)
  R(g, x0, 0, 32, 10, '#07040d')
  // The shaft's inside, lit a little from the foyer above.
  dith(g, x0 + 1, 0, 30, 4, '#07040d', '#3a2a50', 0.5)
  R(g, x0 + 31, 0, 1, 10, '#2a1f40')
  // The flap: a tile of the foyer's chequered floor, hinged at the hole's
  // left edge and hanging down at a slant.
  const fw = 16
  for (let j = 0; j < 18; j++) {
    const y = 10 + j
    const sx = x0 + 1 - Math.round(j * 0.45)
    for (let i = 0; i < fw; i++) {
      const white = (Math.floor(i / 4) + Math.floor(j / 4.5)) % 2 === 0
      let c = white ? '#e8e0f4' : '#2a2040'
      if (i === 0) c = white ? '#ffffff' : '#3a3058'
      P(g, sx + i, y, c)
    }
    P(g, sx - 1, y, INK)
    P(g, sx + fw, y, INK)
  }
  R(g, x0 - 8, 28, fw + 2, 1, INK)
  // Its underside edge, and the hinge.
  R(g, x0 - 7, 27, fw, 1, '#8a7aa0')
  R(g, x0 - 1, 9, 4, 2, '#8a82a0')
  // Splinters round the hole.
  for (const [x, y] of [[x0 + 18, 10], [x0 + 24, 10], [x0 + 28, 11], [x0 + 21, 11]] as const) P(g, x, y, WOOD.hi)
}

function stairs(g: G) {
  // The shadow under the stairs.
  for (let y = 50; y < FLOOR_Y; y++) {
    const xr = 26 + ((y - 50) / 52) * 62
    R(g, 4, y, xr - 4, 1, '#241a38')
  }
  dith(g, 4, 60, 40, 42, '#241a38', '#1a1228', 0.4)
  // Landing and its post.
  box(g, 2, 48, 30, 4, WOOD.b, WOOD.hi, WOOD.lo)
  R(g, 28, 52, 3, FLOOR_Y - 52, WOOD.lo)
  R(g, 28, 52, 1, FLOOR_Y - 52, WOOD.b)
  // The treads: seven, each a little crooked.
  const n = 7
  for (let i = 1; i <= n; i++) {
    const ty = Math.round(FLOOR_Y - i * 7.4) + (i % 3 === 1 ? 1 : 0)
    const tx = Math.round(88 - i * 8.4)
    const tw = 10 + (i % 2)
    // Riser (front face).
    R(g, tx, ty + 2, tw - 1, 6, '#5e3620')
    R(g, tx, ty + 7, tw - 1, 1, WOOD.dk)
    box(g, tx - 1, ty, tw + 1, 2, WOOD.hi, '#e0a060', WOOD.b)
  }
  // The stringer: a thick board under the treads.
  line(g, 90, FLOOR_Y, 30, 50, INK, 2)
  line(g, 91, FLOOR_Y - 1, 31, 49, WOOD.lo, 1)
  // The handrail, wobbly, and its balusters.
  let prev: [number, number] | null = null
  for (let i = 0; i <= 8; i++) {
    const x = 92 - i * 8
    const y = Math.round(FLOOR_Y - 26 - i * 6.4 + Math.sin(i * 1.7) * 1.4)
    if (prev) { line(g, prev[0], prev[1], x, y, INK, 2); line(g, prev[0], prev[1] - 1, x, y - 1, '#a0643a') }
    if (i > 0 && i < 8) {
      const by = Math.round(FLOOR_Y - i * 7.4)
      line(g, x, y + 1, x + (i % 2 ? 1 : -1), by + 4, '#4a2a18')
    }
    prev = [x, y]
  }
  R(g, 90, FLOOR_Y - 30, 3, 30, WOOD.lo)
  R(g, 89, FLOOR_Y - 33, 5, 4, WOOD.b)
  P(g, 90, FLOOR_Y - 33, WOOD.hi)
}

/** The door at the top of the stairs (closed, nails poking through). */
function stairsDoor(g: G) {
  // Frame, leaning.
  for (let y = 8; y < 49; y++) {
    const lean = Math.round((49 - y) * 0.06)
    R(g, 5 + lean, y, 24, 1, INK)
    R(g, 6 + lean, y, 22, 1, y < 10 ? '#5a3018' : '#6a3c22')
    // Planks.
    for (const px of [11, 17, 23]) P(g, px + lean, y, '#4a2818')
    if (y % 9 === 0) R(g, 7 + lean, y, 20, 1, '#7a4a2c')
  }
  // Cross battens, nailed from the other side: the nail tips poke through, bent.
  for (const [y, xs] of [[16, [8, 14, 20, 26]], [30, [9, 15, 21, 25]], [42, [8, 13, 19, 26]]] as const) {
    for (const x of xs) {
      const lean = Math.round((49 - y) * 0.06)
      P(g, x + lean, y, '#c8c0d8')
      P(g, x + lean + 1, y - 1, '#8a8098')
    }
  }
  // Handle.
  R(g, 24, 30, 2, 2, '#ffd23f')
  P(g, 24, 31, '#c4861c')
}

function crate(g: G) {
  box(g, 32, 84, 30, 18, '#9a6a3a', '#c08a50', '#5a3a1a')
  R(g, 32, 92, 30, 1, '#5a3a1a')
  for (const x of [38, 47, 56]) R(g, x, 84, 1, 18, '#6a4424')
  drawText(g, 'POTET', 33, 87, '#3a2010')
  // Potatoes and their long pale sprouts, reaching for the light.
  for (const [x, y] of [[36, 82], [43, 81], [50, 82], [57, 81]] as const) {
    R(g, x - 1, y - 1, 6, 4, INK)
    R(g, x, y, 4, 2, '#c8a060')
    P(g, x, y, '#e8c888')
  }
  line(g, 44, 80, 50, 64, '#e8e4c0')
  line(g, 50, 64, 58, 60, '#e8e4c0')
  line(g, 38, 81, 34, 70, '#d8d4b0')
  line(g, 58, 80, 66, 72, '#e8e4c0')
  line(g, 66, 72, 72, 73, '#e8e4c0')
}

// --- the jam shelves -------------------------------------------------------

const SHELF = { x: 96, y: 12, w: 78, boards: [34, 51, 68, 85] }

/** How far the shelf unit leans at height y (it tips to the right). */
const lean = (y: number) => Math.round((FLOOR_Y - y) / 26)

function jar(g: G, x: number, y: number, h: number, fat: boolean, seed: number) {
  const w = fat ? 8 : 7
  // y is the bottom.
  const top = y - h
  R(g, x - 1, top - 1, w + 2, h + 1, INK)
  // Lid: gold, or a cloth cap with a string.
  if (hash(seed * 3) < 0.25) {
    R(g, x - 1, top, w + 2, 2, '#f0e8d0')
    R(g, x - 1, top + 1, w + 2, 1, '#c8203a')
    P(g, x + 1, top, '#c8203a'); P(g, x + 4, top, '#c8203a')
  } else {
    R(g, x, top, w, 2, '#ffd23f')
    R(g, x, top + 1, w, 1, '#c4861c')
    P(g, x + 1, top, '#fff1b0')
  }
  // The neck, then the jam in the glass.
  R(g, x, top + 2, w, 1, INK)
  R(g, x + 1, top + 2, w - 2, 1, '#7a3048')
  R(g, x, top + 3, w, h - 3, '#a8142c')
  R(g, x + 1, top + 3, 1, h - 4, '#e04058')
  R(g, x + w - 1, top + 3, 1, h - 3, '#62081a')
  R(g, x, y - 1, w, 1, '#62081a')
  P(g, x + 1, top + 3, '#ffe0ea')
  // A small label.
  const ly = top + 4 + Math.floor((h - 6) / 2)
  R(g, x + 2, ly, w - 4, 2, '#fff1b0')
  P(g, x + 3, ly, '#c8203a')
}

function shelves(g: G) {
  const { x, y, w, boards } = SHELF
  // The back of the unit, dark.
  for (let yy = y; yy < FLOOR_Y; yy++) R(g, x + lean(yy), yy, w, 1, '#3a2230')
  dith(g, x + 3, y + 2, w - 6, FLOOR_Y - y - 4, '#3a2230', '#2e1a26', 0.35)
  // Posts.
  for (let yy = y - 2; yy < FLOOR_Y; yy++) {
    R(g, x - 2 + lean(yy), yy, 5, 1, INK)
    R(g, x - 1 + lean(yy), yy, 3, 1, WOOD.b)
    P(g, x - 1 + lean(yy), yy, WOOD.hi)
    R(g, x + w - 3 + lean(yy), yy, 5, 1, INK)
    R(g, x + w - 2 + lean(yy), yy, 3, 1, WOOD.b)
    P(g, x + w - 2 + lean(yy), yy, WOOD.hi)
  }
  // Jars on each board, then the board in front of their feet.
  let seed = 11
  for (const by of boards) {
    let jx = x + 3 + lean(by)
    const tilt = by === 51 ? 1 : 0
    while (jx < x + w - 10 + lean(by)) {
      const h = 9 + Math.floor(hash(seed) * 3)
      const fat = hash(seed * 7) < 0.3
      jar(g, jx, by + (tilt && jx > x + w / 2 ? 1 : 0), h, fat, seed)
      jx += (fat ? 9 : 8) + (hash(seed * 5) < 0.3 ? 1 : 0)
      seed++
    }
    const l = lean(by)
    R(g, x - 3 + l, by, w + 6, 4, INK)
    R(g, x - 2 + l, by + 1, w + 4, 2, WOOD.b)
    R(g, x - 2 + l, by + 1, w + 4, 1, WOOD.hi)
    if (tilt) R(g, x + w / 2 + l, by + 3, w / 2 + 2, 1, INK)
  }
  // Bottom: three fat crocks of juice.
  for (const [cx, lbl] of [[x + 14, 'SAFT'], [x + 38, ''], [x + 60, '']] as const) {
    const l = lean(96)
    ellipse(g, cx + l, 94, 10, 8, INK)
    ellipse(g, cx + l, 94, 9, 7, '#c8703a')
    ellipse(g, cx - 3 + l, 91, 3, 2, '#f0a060')
    R(g, cx - 4 + l, 85, 9, 3, INK)
    R(g, cx - 3 + l, 86, 7, 1, '#8a4a2a')
    if (lbl) drawText(g, lbl, cx - 11 + l, 92, '#fff1b0')
  }
  // Top board and the plaque.
  const l = lean(y)
  R(g, x - 4 + l, y - 2, w + 8, 5, INK)
  R(g, x - 3 + l, y - 1, w + 6, 3, WOOD.b)
  R(g, x - 3 + l, y - 1, w + 6, 1, WOOD.hi)
  const text = 'LINGON 1987'
  const tw = textWidth(text)
  const px = x + Math.floor((w - tw) / 2) + l - 1
  // The plaque hangs a little crooked, on two strings.
  box(g, px - 3, y + 5, tw + 6, 11, '#f0e0b0', '#fff4d0', '#c8b080')
  line(g, px - 1, y + 2, px + 2, y + 5, INK)
  line(g, px + tw + 1, y + 2, px + tw - 2, y + 5, INK)
  drawText(g, text, px, y + 7, '#b01830')
}

function sacksAndMattress(g: G) {
  // Flour sacks slumped against the wall under the chute.
  for (const [cx, cy, rx, ry] of [[182, 92, 11, 11], [214, 91, 12, 12], [198, 86, 10, 9]] as const) {
    ellipse(g, cx, cy, rx + 1, ry + 1, INK)
    ellipse(g, cx, cy, rx, ry, '#b8a070')
    ellipse(g, cx - 1, cy - 1, rx - 2, ry - 2, '#d8c090')
    ellipse(g, cx - 3, cy - ry + 3, 3, 2, '#f0e0b0')
  }
  drawText(g, 'MEL', 205, 90, '#8a6a40')
  // Tied necks.
  R(g, 196, 76, 5, 3, INK); R(g, 197, 76, 3, 2, '#a08050')
  // The mattress: blue and white ticking, folded over, a Dag-shaped dent in it.
  const mx = 168
  const my = 100
  const mw = 64
  R(g, mx - 1, my - 1, mw + 2, 18, INK)
  for (let y = my; y < my + 16; y++) {
    for (let x = mx; x < mx + mw; x++) {
      const stripe = Math.floor((x - mx + (y - my) * 0.3) / 3) % 2 === 0
      let c = stripe ? '#e8e4f0' : '#5a7ad0'
      if (y > my + 11) c = stripe ? '#b8b0d0' : '#3a52a0'
      // The dent: darker in the middle.
      const d = ((x - 200) / 16) ** 2 + ((y - my - 3) / 5) ** 2
      if (d < 1) c = stripe ? '#b8b0d0' : '#3a52a0'
      P(g, x, y, c)
    }
  }
  // Rounded ends and buttons.
  P(g, mx, my, INK); P(g, mx + mw - 1, my, INK)
  for (const x of [176, 190, 212, 224]) { P(g, x, my + 6, '#2a3a80'); P(g, x, my + 7, '#8a9ae0') }
  // A flour puff on the floor.
  dith(g, 162, 114, 12, 4, '#7a4a4a', '#d8d0c0', 0.3)
  dith(g, 226, 115, 10, 3, '#7a4a4a', '#d8d0c0', 0.25)
}

function hatchFrame(g: G) {
  // The frame and the (closed) sliding hatch.
  box(g, 238, 40, 32, 42, '#5a3018', '#7a4a2c', '#3a1e10')
  R(g, 241, 43, 26, 36, INK)
  hatchDoor(g, 0)
  // A little brass plate with arrows up and down.
  box(g, 248, 84, 12, 6, '#c4861c', '#ffd23f', '#8a5a10')
  P(g, 251, 86, INK); R(g, 250, 87, 3, 1, INK)
  R(g, 255, 86, 3, 1, INK); P(g, 256, 87, INK)
  // The pull rope beside it.
  for (let y = 42; y < 72; y++) P(g, 273 + (y % 6 < 3 ? 0 : 1), y, '#c8a060')
  R(g, 272, 72, 4, 4, '#c8a060')
  R(g, 272, 75, 4, 1, '#8a6a30')
}

function hatchDoor(g: G, open: number) {
  // open 0 = shut, 1 = slid up out of sight.
  const top = 43
  const h = Math.round(36 * (1 - open))
  if (h <= 0) return
  const y = top
  R(g, 242, y, 24, h, '#9a6a3a')
  for (let yy = y; yy < y + h; yy += 6) R(g, 242, yy, 24, 1, '#6a4424')
  R(g, 242, y, 24, 1, '#c08a50')
  if (h > 8) { R(g, 252, y + h - 7, 5, 3, INK); R(g, 253, y + h - 6, 3, 1, '#ffd23f') }
}

function barrel(g: G) {
  const cx = 304
  const top = 70
  const bot = 112
  for (let y = top; y < bot; y++) {
    const t = (y - top) / (bot - top)
    const half = Math.round(18 + Math.sin(t * Math.PI) * 5)
    R(g, cx - half - 1, y, half * 2 + 2, 1, INK)
    for (let x = -half; x < half; x++) {
      const stave = Math.floor((x + half) / 6)
      const edge = (x + half) % 6 === 0
      const k = x / half
      let c = stave % 2 ? '#a0602e' : '#b06a34'
      if (k < -0.6) c = '#c88048'
      if (k > 0.55) c = '#6a3a1a'
      if (edge) c = '#5a3018'
      P(g, cx + x, y, c)
    }
  }
  // Hoops.
  for (const hy of [76, 91, 106]) {
    const t = (hy - top) / (bot - top)
    const half = Math.round(18 + Math.sin(t * Math.PI) * 5)
    R(g, cx - half - 1, hy - 1, half * 2 + 2, 4, INK)
    R(g, cx - half, hy, half * 2, 2, '#5a5270')
    R(g, cx - half, hy, half * 2, 1, '#8a82a0')
  }
  drawText(g, 'SILD', cx - 11, 82, '#f0e8f8')
}

function barrelLid(g: G, open: boolean, t: number) {
  const cx = 304
  if (!open) {
    ellipse(g, cx, 70, 20, 4, INK)
    ellipse(g, cx, 70, 19, 3, '#8a5028')
    ellipse(g, cx - 2, 69, 15, 2, '#b06a34')
    R(g, cx - 12, 69, 24, 1, '#6a3a1a')
    // A tail pokes out from under the lid.
    const wag = Math.floor(t * 1.3) % 7 === 0 ? 1 : 0
    R(g, cx + 14, 64 - wag, 2, 4, INK)
    P(g, cx + 14, 64 - wag, '#c8d0e0')
    R(g, cx + 13, 62 - wag, 4, 2, INK)
    P(g, cx + 13, 62 - wag, '#c8d0e0'); P(g, cx + 16, 62 - wag, '#c8d0e0')
    return
  }
  // Open: the lid leans against the barrel, and the herring look out.
  ellipse(g, cx, 70, 19, 3, INK)
  ellipse(g, cx, 70, 18, 2, '#1a1020')
  for (let i = 0; i < 6; i++) {
    const hx = cx - 17 + i * 6
    const hy = 57 + ((i * 7) % 3) * 2
    const blink = Math.floor(t * 0.7 + i * 1.3) % 9 === 0
    g.drawImage(sprite(blink ? HERRING_BLINK : HERRING, undefined, i % 2 === 1), hx, hy)
  }
  // The lid, leaning on the left side of the barrel.
  ellipse(g, cx - 26, 92, 7, 20, INK)
  ellipse(g, cx - 26, 92, 6, 19, '#8a5028')
  ellipse(g, cx - 27, 91, 4, 17, '#a8622e')
  for (const yy of [80, 92, 104]) R(g, cx - 31, yy, 10, 1, '#5a3018')
  for (let y = 76; y < 108; y++) P(g, cx - 31 + Math.round(Math.abs(y - 92) / 8), y, '#c88048')
}

function coalChute(g: G) {
  // The square hatch high on the wall, open to the rain.
  box(g, 344, 10, 22, 18, '#1a1a2a')
  R(g, 343, 9, 24, 2, '#5a5270')
  R(g, 343, 9, 24, 1, '#8a82a0')
  // Grating stubs.
  for (const x of [348, 354, 360]) R(g, x, 11, 1, 16, '#3a3450')
  // The trough, sloping down from the hatch.
  for (let i = 0; i < 60; i++) {
    const y = 28 + i
    const x = 346 + Math.round(i * 0.34)
    R(g, x - 1, y, 14, 1, INK)
    R(g, x, y, 12, 1, '#5a5270')
    P(g, x, y, '#8a82a0')
    P(g, x + 11, y, '#3a3450')
    if (i % 7 === 0) R(g, x + 2, y, 8, 1, '#4a4460')
  }
  R(g, 366, 87, 13, 2, INK)
  // Wet coal at the bottom, and a puddle.
  for (const [x, y] of [[354, 108], [360, 110], [366, 109], [372, 110], [358, 106], [364, 106]] as const) {
    R(g, x - 1, y - 1, 6, 4, INK)
    R(g, x, y, 4, 2, '#2a2438')
    P(g, x, y, '#6a6488')
  }
  ellipse(g, 366, 116, 12, 2, '#2a2e5a')
  ellipse(g, 364, 116, 8, 1, '#4a5a9a')
}

function boilerDoorway(g: G, w: number) {
  // A leaning doorway through the stone into the boiler room's red dark.
  for (let y = 22; y < FLOOR_Y + 2; y++) {
    const l = Math.round((FLOOR_Y - y) * 0.08)
    R(g, 378 - l, y, w - 378 + l, 1, INK)
    R(g, 381 - l, y, w - 381 + l, 1, y < 26 ? '#3a1a1a' : '#2a1216')
  }
  // Brick arch edge.
  for (let y = 22; y < FLOOR_Y; y += 5) {
    const l = Math.round((FLOOR_Y - y) * 0.08)
    R(g, 376 - l, y, 4, 4, '#8a4a3a')
    R(g, 376 - l, y, 4, 1, '#aa6a50')
  }
  R(g, 372, 18, w - 372, 5, '#8a4a3a')
  R(g, 372, 18, w - 372, 1, '#aa6a50')
}

// ---------------------------------------------------------------------------
// The painter
// ---------------------------------------------------------------------------

function bulbSway(t: number): number {
  return Math.round(Math.sin(t * 0.9) * 1.2)
}

export const painter: RoomPainter = {
  paint(g, w) {
    walls(g, w)
    slabs(g, 0, w, FLOOR_Y, 144 - FLOOR_Y, w / 2, -170, ['#7a4a4a', '#6e4244', '#845252', '#744648'], '#2a1620', '#9a6262', 5, 30)
    ceiling(g, w)
    chute(g)
    stairs(g)
    stairsDoor(g)
    crate(g)
    shelves(g)
    sacksAndMattress(g)
    hatchFrame(g)
    barrel(g)
    coalChute(g)
    boilerDoorway(g, w)
    // The onion string.
    line(g, 286, 9, 286, 34, '#c8a060')
    for (const [x, y, c] of [[284, 14, '#b0506a'], [288, 18, '#e8e0d0'], [283, 22, '#b0506a'], [287, 26, '#a04a60'], [285, 31, '#e8e0d0']] as const) {
      ellipse(g, x, y, 3, 3, INK)
      ellipse(g, x, y, 2, 2, c)
      P(g, x - 1, y - 1, '#fff4ff')
      P(g, x, y - 4, '#8a7a50')
    }
    // Cobwebs in the ceiling corners.
    cobweb(g, 0, 9, 18, 1, '#8a82a8')
    cobweb(g, 336, 9, 12, -1, '#8a82a8')
  },

  ambient: s => s.flags[F.furnaceLit] ? '#56486c' : '#4a4470',

  back(g, s, v) {
    const t = v.t
    // The stairs door, open at the end.
    if (s.flags[F.stairsDown]) {
      for (let y = 9; y < 48; y++) {
        const l = Math.round((49 - y) * 0.06)
        R(g, 6 + l, y, 22, 1, '#ffd89a')
      }
      dith(g, 6, 30, 22, 18, '#ffd89a', '#e8a860', 0.5)
      // The door leaf, swung open against the wall.
      R(g, 28, 9, 4, 40, INK)
      R(g, 29, 10, 2, 38, '#6a3c22')
    }
    // The bulb's cord (sways a little).
    const sw = bulbSway(t)
    line(g, BULB_X, 9, BULB_X + sw, BULB_Y - 8, '#2a2030')
    R(g, BULB_X - 2 + sw, BULB_Y - 8, 5, 3, '#5a5270')
    P(g, BULB_X - 2 + sw, BULB_Y - 8, '#8a82a0')
    ellipse(g, BULB_X + sw, BULB_Y - 1, 4, 4, INK)
    ellipse(g, BULB_X + sw, BULB_Y - 1, 3, 3, '#fff4c0')
    R(g, BULB_X - 1 + sw, BULB_Y - 5, 3, 1, '#c8c0d8')
    // A moth round the bulb.
    const ma = t * 2.3
    P(g, BULB_X + sw + Math.round(Math.cos(ma) * 8), BULB_Y - 2 + Math.round(Math.sin(ma * 1.3) * 5), '#e8e0d0')
    // The hatch: open or shut.
    if (s.flags['pantry.hatch']) {
      R(g, 241, 43, 26, 36, '#07040d')
      // The lift's ropes and a warm glimmer from the kitchen above.
      R(g, 245, 43, 1, 36, '#6a5a40')
      R(g, 262, 43, 1, 36, '#6a5a40')
      dith(g, 242, 43, 24, 6, '#07040d', '#6a4020', 0.4)
      R(g, 242, 76, 24, 3, '#3a2a1a')
    } else hatchDoor(g, 0)
    // The bell (trembles now and then).
    const ring = Math.floor(t * 0.4) % 11 === 0 ? Math.round(Math.sin(t * 40)) : 0
    for (let y = 29; y < 34; y++) P(g, 254 + (y % 2), y, '#8a82a0')
    ellipse(g, 254 + ring, 36, 4, 3, INK)
    R(g, 251 + ring, 35, 7, 3, '#ffd23f')
    R(g, 252 + ring, 34, 5, 1, '#ffd23f')
    P(g, 252 + ring, 35, '#fff1b0')
    R(g, 250 + ring, 38, 9, 1, '#c4861c')
    P(g, 254 + ring, 39, '#c4861c')
    // The barrel lid.
    barrelLid(g, !!s.flags['pantry.barrel'], t)
    // Rain in the coal chute's hatch, and drips off the end of the trough.
    rainIn(g, 345, 11, 20, 16, t, 10, v.flash)
    drip(g, 372, 89, 115, t, 1.3, 0, '#8fa6d8', '#c0d0f0')
    drip(g, 368, 89, 115, t, 1.9, 0.7, '#8fa6d8', '#c0d0f0')
    // Rain trickling down the trough.
    for (let i = 0; i < 4; i++) {
      const k = ((t * 0.9 + i * 0.25) % 1)
      const y = 28 + Math.round(k * 58)
      P(g, 350 + Math.round((y - 28) * 0.34), y, '#8fa6d8')
    }
    // Ripples in the puddle.
    const rp = (t * 1.3) % 1
    if (rp < 0.5) {
      const r = Math.round(rp * 10)
      P(g, 372 - r, 116, '#8fa6d8'); P(g, 372 + r, 116, '#8fa6d8')
    }
    // A drip from the damp ceiling above the barrel.
    drip(g, 290, 10, FLOOR_Y + 12, t, 3.1, 1.1, '#8a82c0', '#b0a8e0')
    // The boiler room beyond the doorway warms up when the furnace is lit.
    if (s.flags[F.furnaceLit]) {
      const f = 0.25 + 0.1 * Math.sin(t * 7) + 0.05 * Math.sin(t * 13)
      for (let y = 60; y < FLOOR_Y; y++) {
        const l = Math.round((FLOOR_Y - y) * 0.08)
        for (let x = 381 - l; x < 400; x++) if (((x + y) & 1) === 0 && ((y - 60) / 42) * 0.8 > (1 - f * 2) * 0.5) P(g, x, y, '#6a2a1a')
      }
    }
  },

  front(g, _s, v) {
    // A string of sausages hanging from the beam in front of everything.
    const sw = Math.round(Math.sin(v.t * 0.7 + 1) * 1)
    line(g, 62, 0, 62 + sw, 5, '#c8a060')
    for (let i = 0; i < 3; i++) {
      const x = 60 + sw + (i % 2)
      const y = 5 + i * 6
      R(g, x - 1, y, 5, 7, INK)
      R(g, x, y + 1, 3, 5, '#a8402e')
      P(g, x, y + 1, '#e07a5a')
    }
    // A swaying cobweb strand.
    const s2 = Math.round(Math.sin(v.t * 1.1) * 1.5)
    line(g, 18, 9, 16 + s2, 26, '#8a82a8')
    P(g, 16 + s2, 27, '#b0a8c8')
  },

  lights(L, s, v) {
    const t = v.t
    const sw = bulbSway(t)
    const fl = 0.92 + 0.05 * Math.sin(t * 23) * Math.sin(t * 3.1)
    L(BULB_X + sw, BULB_Y + 4, 130, '#ffcf8a', fl)
    L(BULB_X + sw, BULB_Y, 34, '#fff0c0', 0.8)
    // Warm light under the nailed door, from the foyer above.
    L(18, 48, 16, '#ffc070', 0.45)
    // Grey storm light down the coal chute.
    L(355, 22, 34, '#6a86c8', 0.55)
    L(368, 110, 24, '#5a78b8', 0.35)
    if (v.flash > 0) L(356, 40, 80, '#dfe6ff', Math.min(1, v.flash * 1.2))
    if (s.flags['pantry.hatch']) L(254, 50, 22, '#ffb870', 0.5)
    if (s.flags[F.stairsDown]) L(18, 34, 60, '#ffd89a', 0.9)
    if (s.flags[F.furnaceLit]) L(398, 90, 50, '#ff8a3d', 0.5 + 0.1 * Math.sin(t * 7))
  },

  glow(g, s, v) {
    const sw = bulbSway(v.t)
    ellipse(g, BULB_X + sw, BULB_Y - 1, 3, 3, '#fff4c0')
    ellipse(g, BULB_X + sw, BULB_Y - 1, 2, 2, '#fffbe8')
    P(g, BULB_X - 1 + sw, BULB_Y - 2, '#ffffff')
    // The crack of light under the nailed door.
    if (!s.flags[F.stairsDown]) R(g, 8, 47, 18, 1, '#ffc070')
    if (v.flash > 0.3) rainIn(g, 345, 11, 20, 16, v.t, 10, v.flash)
    if (s.flags[F.stairsDown]) {
      for (let y = 9; y < 48; y += 2) {
        const l = Math.round((49 - y) * 0.06)
        R(g, 8 + l, y, 18, 1, mix('#ffd89a', '#ffffff', 0.3))
      }
    }
  },
}


