/**
 * Conservatory (400 wide): a glass house against the storm. Iron-framed
 * glass walls and roof with rain running down them, a low brick wall,
 * leaking roof panes dripping into buckets, a potting bench with wet
 * leather gloves, a watering can, ferns and palms, and the iron pillar
 * where the lightning cable comes down from the roof into the junction box
 * and on down through the floor. Gustav (NPC) stands at x 300.
 *
 * State: F.junctionOpen (the box door hangs open: two chewed ends),
 * F.junctionBridged (the poker wedged across, sparking), F.gustavFed and
 * F.clockKeyTaken (the burped-up key on the floor at 266, 126).
 */
import { F } from '../../content/flags'
import type { GameState } from '../../types'
import type { G, RoomPainter, View } from '../api'
import { bolt, hash, rainIn } from '../fx'
import { INK, box, checker, dither, dot, line, oval, ovalK, poly, polyK, rect } from './foyer'

const W = 400
export const conservatoryFloor = (x: number) => 102 + Math.sin(x / 60) * 1.2

const IRON = '#1f4a3a'
const IRON_HI = '#3f8a6a'
const BRICK = '#8a3a2a'
const BRICK_D = '#5a2018'
const GOLD = '#ffd23f'

/** The panes of glass: x from, x to, y from, y to. */
const PANES: [number, number, number, number][] = []
for (let x = 24; x < 376; x += 28) PANES.push([x, x + 26, 18, 76])

function sky(g: G, v: View) {
  const f = v.flash
  // The glass wall and roof: storm sky behind everything.
  for (const [x0, x1, y0, y1] of PANES) {
    rect(g, x0, y0, x1 - x0, y1 - y0, f > 0.5 ? '#9ea8ff' : f > 0.2 ? '#4a4f9a' : '#14203a')
    if (f <= 0.2) dither(g, x0, y0 + 30, x1 - x0, y1 - y0 - 30, '#1c3040', 0.5)
  }
  // Roof panes (in perspective above the wall).
  for (let i = 0; i < 14; i++) {
    const xa = 24 + i * 26
    const xb = xa + 24
    poly(g, [[xa - 12 + i * 1.7, 0], [xb - 12 + i * 1.7, 0], [xb, 15], [xa, 15]], f > 0.5 ? '#8a94f0' : f > 0.2 ? '#3a3f8a' : '#101a30')
  }
  if (f > 0.5) {
    const bx = 60 + hash(Math.floor(v.t)) * 280
    g.save()
    g.beginPath()
    g.rect(0, 0, W, 76)
    g.clip()
    bolt(g, bx, 0, 70, Math.floor(v.t * 3) + 9)
    g.restore()
  }
  // Distant trees thrashing, and the rain on the glass.
  for (let x = 24; x < 376; x += 2) {
    const h = 6 + Math.round((Math.sin(x * 0.13) + Math.sin(x * 0.051 + v.t * 0.8)) * 3 + hash(x) * 3)
    rect(g, x, 76 - h, 2, h, f > 0.5 ? '#3a4a7a' : '#0a1418')
  }
  rainIn(g, 24, 0, 352, 76, v.t, 60, f)
  // Runnels down the glass.
  for (let i = 0; i < 10; i++) {
    const x = 30 + ((hash(i * 5 + 1) * 340) | 0)
    const p = (v.t * (0.2 + hash(i) * 0.2) + hash(i * 3)) % 1
    const y = 18 + Math.round(p * 56)
    rect(g, x, y, 1, 3, '#8fa6d8')
    dot(g, x, y + 3, '#cfe8ff')
  }
}

function frames(g: G) {
  // Iron glazing bars over the glass.
  for (const [x0, x1] of PANES) {
    rect(g, x0 - 2, 16, 2, 62, IRON)
    rect(g, x0 - 2, 16, 1, 62, IRON_HI)
    rect(g, x1, 46, x0 + 28 - x1, 1, IRON)
    rect(g, x0, 46, x1 - x0, 1, IRON)
    // A curly iron flourish at the top of each bay.
    dot(g, x0 + 3, 19, IRON_HI); dot(g, x0 + 2, 20, IRON_HI); dot(g, x1 - 3, 19, IRON_HI); dot(g, x1 - 2, 20, IRON_HI)
  }
  rect(g, 20, 15, 360, 3, IRON)
  rect(g, 20, 15, 360, 1, IRON_HI)
  for (let i = 0; i <= 14; i++) {
    const xa = 22 + i * 26
    line(g, xa - 12 + i * 1.7, 0, xa, 15, IRON)
  }
  // Two panes are cracked and leak.
  for (const [cx, cy] of [[60, 8], [200, 6]] as const) {
    line(g, cx - 4, cy - 3, cx + 1, cy + 2, '#cfe8ff')
    line(g, cx + 1, cy + 2, cx + 5, cy - 1, '#cfe8ff')
    line(g, cx + 1, cy + 2, cx, cy + 6, '#cfe8ff')
  }
}

function walls(g: G) {
  // The low brick wall along the back.
  for (let x = 20; x < 380; x++) {
    const fy = Math.round(conservatoryFloor(x))
    rect(g, x, 76, 1, fy - 76, BRICK)
  }
  for (let y = 78; y < 104; y += 4) {
    rect(g, 20, y, 360, 1, BRICK_D)
    for (let x = 20 + ((y / 4) % 2) * 5; x < 380; x += 10) rect(g, x, y, 1, 4, BRICK_D)
  }
  box(g, 20, 75, 360, 3, '#c07a5a', '#e0a07a', '#7a3a2a')
  // Moss.
  for (let x = 22; x < 378; x += 3) if (hash(x) < 0.35) { dot(g, x, 79 + ((hash(x * 3) * 20) | 0), '#4f9a2a'); dot(g, x + 1, 80 + ((hash(x * 3) * 20) | 0), '#3f7a2a') }
  // Side walls: glass in iron, darker.
  poly(g, [[0, 0], [20, 15], [20, 102], [0, 118]], '#10202a')
  poly(g, [[400, 0], [380, 15], [380, 102], [400, 118]], '#10202a')
  for (let y = 20; y < 110; y += 16) { line(g, 0, y - 6, 20, y + 4, IRON); line(g, 380, y + 4, 400, y - 6, IRON) }
  line(g, 20, 15, 20, 102, IRON_HI)
  line(g, 380, 15, 380, 102, IRON_HI)
  // The glass door back to the foyer (left wall).
  poly(g, [[3, 34], [17, 40], [17, 102], [3, 112]], INK)
  poly(g, [[5, 38], [16, 43], [16, 101], [5, 109]], '#3a1a50')
  poly(g, [[5, 70], [16, 72], [16, 101], [5, 109]], '#5b2aa6')
  line(g, 5, 72, 16, 74, '#ffd23f')
  line(g, 2, 33, 18, 40, '#3fb86a'); line(g, 2, 33, 2, 113, '#3fb86a'); line(g, 18, 40, 18, 102, '#3fb86a')
}

function floor(g: G) {
  const top = (x: number) => x < 20 ? 102 + (20 - x) * 0.8 : x > 380 ? 102 + (x - 380) * 0.8 : conservatoryFloor(x)
  checker(g, 0, W, top, { vpx: 200, hy: 44, tile: 1.3, a: '#c0603a', b: '#a04a2a', aLo: '#7a3420', bLo: '#6a2a18', tilt: 0, far: 5, grout: '#5a2a18' })
  // Wet patches that catch the light.
  for (const [x, y, rx] of [[70, 118, 20], [212, 126, 24], [326, 138, 16]] as const) {
    oval(g, x, y, rx, 2.5, '#6a3a3a')
    oval(g, x - 2, y - 0.5, rx - 5, 1.2, '#8a6a7a')
    rect(g, x - rx / 2, y - 1, rx / 3, 1, '#b8a8c8')
  }
  for (let x = 20; x < 380; x++) dither(g, x, Math.round(conservatoryFloor(x)), 1, 3, INK, 0.45)
}

function pillar(g: G) {
  // An iron pillar (x 234–264) holding up the roof, with the cable on it.
  const base = Math.round(conservatoryFloor(250))
  polyK(g, [[236, 14], [262, 14], [262, base], [236, base]], '#2a3a3a')
  rect(g, 237, 14, 3, base - 14, '#4a6a6a')
  rect(g, 259, 14, 2, base - 14, '#1a2424')
  for (let y = 20; y < base; y += 12) rect(g, 237, y, 24, 1, '#1a2424')
  box(g, 233, base - 4, 32, 4, '#2a3a3a', '#4a6a6a')
  box(g, 233, 12, 32, 3, '#2a3a3a', '#4a6a6a')
  // The lightning cable: down from the roof to the box, and on into the floor.
  rect(g, 247, 0, 4, 46, INK)
  rect(g, 248, 0, 2, 46, '#3a3040')
  rect(g, 248, 0, 1, 46, '#6a5a7a')
  for (let y = 4; y < 44; y += 9) box(g, 246, y, 6, 1, '#8a8aa8')
  rect(g, 247, 70, 4, base - 70 + 2, INK)
  rect(g, 248, 70, 2, base - 70 + 2, '#3a3040')
  oval(g, 249, base + 1, 5, 1.5, INK)
  // A warning sign on the pillar.
  poly(g, [[240, 84], [249, 76], [258, 84]], INK)
  poly(g, [[242, 83], [249, 78], [256, 83]], GOLD)
  line(g, 250, 79, 248, 81, INK); line(g, 248, 81, 250, 81, INK); line(g, 250, 81, 248, 83, INK)
  // Box body.
  box(g, 238, 44, 22, 26, '#6a7a8a', '#9aaabb', '#3a4a5a')
}

function junction(g: G, s: GameState, v: View) {
  const open = !!s.flags[F.junctionOpen]
  const bridged = !!s.flags[F.junctionBridged]
  if (!open) {
    // The door, shut, with a bolt and a skull on it.
    rect(g, 240, 46, 18, 22, '#7a8a9a')
    rect(g, 240, 46, 18, 1, '#aabbcc')
    oval(g, 249, 55, 3, 3, '#fff4ff')
    dot(g, 248, 55, INK); dot(g, 250, 55, INK); rect(g, 248, 57, 3, 1, INK)
    rect(g, 256, 56, 2, 3, INK)
    return
  }
  // Inside: two terminals, the cable chewed through between them.
  rect(g, 240, 46, 18, 22, '#1a1a24')
  box(g, 246, 47, 6, 3, '#c4861c', GOLD)
  box(g, 246, 64, 6, 3, '#c4861c', GOLD)
  rect(g, 248, 50, 2, 5, '#3a3040')
  rect(g, 248, 59, 2, 5, '#3a3040')
  // Frayed copper ends.
  for (const [yy, dir] of [[55, 1], [59, -1]] as const) {
    dot(g, 247, yy, '#ff8a3d'); dot(g, 249, yy + dir, '#ff8a3d'); dot(g, 251, yy, '#ff8a3d'); dot(g, 248, yy + dir, '#ffd23f')
  }
  // Tooth marks on the insulation.
  dot(g, 247, 52, '#b6ff4a'); dot(g, 250, 61, '#b6ff4a')
  if (bridged) {
    // The poker wedged across the gap, knob sticking out.
    line(g, 243, 50, 255, 66, INK)
    line(g, 244, 50, 256, 66, '#8a8aa8')
    ovalK(g, 242, 49, 1.5, 1.5, GOLD)
    const k = Math.floor(v.t * 12) % 4
    if (k < 2) { dot(g, 247 + k, 56, '#ffffff'); dot(g, 251 - k, 59, '#8fd8ff') }
  }
  // The door, swung open on its hinge (to the right).
  polyK(g, [[259, 46], [266, 44], [266, 70], [259, 68]], '#7a8a9a')
  rect(g, 262, 55, 1, 3, INK)
}

function bench(g: G) {
  const base = Math.round(conservatoryFloor(120))
  // Potting bench (x 88–152).
  box(g, 86, 80, 68, 4, '#8a5a30', '#b07a48', '#5a3418')
  for (const x of [90, 148]) { rect(g, x - 1, 84, 4, base - 84, INK); rect(g, x, 84, 2, base - 84, '#6a4020') }
  box(g, 90, 94, 60, 2, '#6a4020', '#8a5a30')
  // Pots on it and under it.
  for (const [x, y, r] of [[96, 78, 3], [106, 78, 4], [142, 78, 3], [100, 92, 4], [138, 92, 3]] as const) {
    polyK(g, [[x - r, y - r * 1.5], [x + r, y - r * 1.5], [x + r - 1, y], [x - r + 1, y]], '#c0603a')
    rect(g, x - r, y - r * 1.5, r * 2, 1, '#e0844e')
  }
  // A seedling that has grown teeth.
  line(g, 106, 72, 106, 67, '#3f9a2a')
  oval(g, 106, 66, 2, 1.5, '#8fd82a'); dot(g, 105, 67, '#ffffff'); dot(g, 107, 67, '#ffffff')
  // The wet leather gloves, dripping.
  poly(g, [[115, 80], [125, 80], [127, 76], [124, 74], [118, 75]], INK)
  poly(g, [[116, 79], [124, 79], [126, 76], [123, 75], [118, 76]], '#8a5a2a')
  poly(g, [[124, 80], [134, 80], [134, 76], [128, 75]], INK)
  poly(g, [[125, 79], [133, 79], [133, 77], [128, 76]], '#a06a34')
  dot(g, 119, 77, '#c8905a'); dot(g, 129, 77, '#c8905a')
  // Trowel and a seed box.
  line(g, 136, 79, 146, 77, '#8a8aa8')
  box(g, 142, 74, 8, 5, '#b07a48', '#e0a07a')
}

function wateringCan(g: G) {
  const x = 166
  const y = Math.round(conservatoryFloor(166)) + 6
  ovalK(g, x, y - 5, 7, 5, '#3faa6a')
  oval(g, x - 2, y - 7, 3, 2, '#7ad8a0')
  line(g, x + 6, y - 5, x + 13, y - 11, INK)
  line(g, x + 6, y - 6, x + 12, y - 11, '#3faa6a')
  ovalK(g, x + 13, y - 12, 2, 1, '#3faa6a')
  line(g, x - 5, y - 10, x - 2, y - 13, INK); line(g, x - 2, y - 13, x + 3, y - 12, INK)
}

function buckets(g: G, v: View) {
  for (const [bx, cy, roofX, roofY] of [[60, 112, 60, 10], [200, 116, 200, 8]] as const) {
    // Drips falling from the cracked pane.
    for (let i = 0; i < 2; i++) {
      const p = (v.t * 0.9 + i * 0.5 + bx * 0.01) % 1
      const y = roofY + p * (cy - 8 - roofY)
      rect(g, bx, y, 1, 2, '#8fd8ff')
    }
    // Bucket.
    polyK(g, [[bx - 7, cy - 9], [bx + 7, cy - 9], [bx + 5, cy], [bx - 5, cy]], '#8a90a8')
    rect(g, bx - 6, cy - 8, 12, 1, '#cfd8e8')
    oval(g, bx, cy - 9, 6, 1.2, '#3a5a8a')
    const r = (v.t * 0.9 + bx * 0.01) % 1
    if (r < 0.4) { dot(g, bx - 2 - Math.round(r * 5), cy - 9, '#cfe8ff'); dot(g, bx + 2 + Math.round(r * 5), cy - 9, '#cfe8ff') }
    line(g, bx - 7, cy - 9, bx - 4, cy - 14, '#4a4a5a'); line(g, bx - 4, cy - 14, bx + 4, cy - 14, '#4a4a5a'); line(g, bx + 4, cy - 14, bx + 7, cy - 9, '#4a4a5a')
    void roofX
  }
}

function plants(g: G, v: View) {
  const sw = Math.sin(v.t * 0.9)
  // A palm behind the bench and ferns along the wall.
  for (const [x, h] of [[40, 50], [184, 40], [356, 56]] as const) {
    const base = Math.round(conservatoryFloor(x))
    polyK(g, [[x - 7, base - 10], [x + 7, base - 10], [x + 5, base], [x - 5, base]], '#c0603a')
    rect(g, x - 1, base - 10 - h * 0.5, 2, h * 0.5, '#6a4a20')
    const top = base - 10 - h * 0.5
    for (let i = 0; i < 6; i++) {
      const an = -Math.PI * (0.1 + i * 0.16)
      const ex = x + Math.cos(an) * h * 0.55 + sw
      const ey = top + Math.sin(an) * h * 0.35 + h * 0.2
      line(g, x, top, ex, ey, '#1f5a1a')
      for (let k = 1; k < 8; k++) {
        const px = x + (ex - x) * k / 8
        const py = top + (ey - top) * k / 8
        dot(g, px, py + 1, '#3f9a2a'); dot(g, px, py - 1, '#4f9a2a')
      }
    }
  }
  // Hanging baskets with trailing vines.
  for (const x of [120, 330]) {
    line(g, x, 15, x, 26, '#4a3a2a')
    ovalK(g, x, 28, 6, 3, '#6a4a20')
    for (let i = -5; i <= 5; i += 2) {
      const len = 6 + ((hash(x + i) * 10) | 0)
      for (let k = 0; k < len; k++) dot(g, x + i + Math.round(Math.sin(v.t + k * 0.4 + i) * 0.8), 30 + k, k % 3 ? '#3f9a2a' : '#8fd82a')
    }
  }
}

function lantern(g: G, x: number, v: View) {
  const sw = Math.round(Math.sin(v.t * 0.7) * 1)
  line(g, x, 15, x + sw, 24, '#2a2020')
  polyK(g, [[x + sw - 3, 24], [x + sw + 3, 24], [x + sw + 4, 32], [x + sw - 4, 32]], '#2a3a3a')
  rect(g, x + sw - 2, 26, 5, 5, '#ffcf6a')
}

function key(g: G) {
  // The clock key, slimy, on the tiles.
  ovalK(g, 263, 125, 2.5, 2, GOLD)
  dot(g, 263, 125, '#6a4a10')
  rect(g, 265, 125, 6, 1, INK)
  rect(g, 265, 124, 6, 1, GOLD)
  rect(g, 270, 125, 1, 2, GOLD)
  dot(g, 261, 127, '#b6ff4a'); dot(g, 267, 126, '#b6ff4a')
}

const painterConservatory: RoomPainter = {
  paint(g) {
    walls(g)
    floor(g)
    wateringCan(g)
  },
  ambient: (_s, v) => v.flash > 0.3 ? '#a8b0d0' : '#78809e',
  back(g, s, v) {
    sky(g, v)
    frames(g)
    pillar(g)
    bench(g)
    plants(g, v)
    junction(g, s, v)
    buckets(g, v)
    if (s.flags[F.gustavFed] && !s.flags[F.clockKeyTaken]) key(g)
  },
  front(g, _s, v) {
    lantern(g, 150, v)
    // Foreground foliage in the right corner (a DOTT frame): dark fronds.
    const sw = Math.sin(v.t * 0.8) * 1.5
    for (const [x0, x1, y1, w] of [[404, 366, 104, 6], [404, 352, 124, 7], [400, 378, 96, 5], [404, 372, 140, 6]] as const) {
      const pts: [number, number][] = []
      for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push([x0 + (x1 + sw - x0) * t, 146 + (y1 - 146) * t - Math.sin(t * Math.PI) * w]) }
      for (let i = 8; i >= 0; i--) { const t = i / 8; pts.push([x0 + (x1 + sw - x0) * t, 146 + (y1 - 146) * t + Math.sin(t * Math.PI) * w * 0.6]) }
      poly(g, pts, '#0f2a14')
      for (let i = 1; i < 8; i++) { const t = i / 8; dot(g, x0 + (x1 + sw - x0) * t, 146 + (y1 - 146) * t, '#1f4a1a') }
    }
  },
  lights(L, s, v) {
    const sw = Math.sin(v.t * 0.7)
    L(150 + sw, 30, 70, '#ffcf8a', 0.7)
    L(200, 40, 160, '#8fa6ff', v.flash * 0.9)
    if (s.flags[F.junctionBridged]) L(249, 57, 30, '#8fd8ff', 0.5 + Math.sin(v.t * 20) * 0.15)
    // The story's failed strike: the bolt arcs at the cut.
    if (s.flags['midnight.fail'] === 'junction') L(249, 57, 60, '#9ff3ff', 0.6 + Math.sin(v.t * 31) * 0.3)
    const gu = s.actors['gustav']
    if (gu && gu.room === 'conservatory') L(gu.x - 10, gu.y - 60, 26, '#b6ff4a', 0.18)
  },
  glow(g, s, v) {
    const sw = Math.round(Math.sin(v.t * 0.7) * 1)
    rect(g, 150 + sw - 1, 27, 3, 3, '#fff1b0')
    if (s.flags[F.junctionBridged]) {
      const k = Math.floor(v.t * 14)
      for (let i = 0; i < 4; i++) {
        if (hash(k * 7 + i) < 0.5) continue
        const a = hash(k * 13 + i) * Math.PI * 2
        const r = 2 + hash(k + i * 5) * 5
        dot(g, 249 + Math.cos(a) * r, 57 + Math.sin(a) * r, i % 2 ? '#ffffff' : '#8fd8ff')
      }
    }
    if (s.flags['midnight.fail'] === 'junction') {
      const k = Math.floor(v.t * 20)
      let y = 44
      let x = 249
      while (y < 70) { const nx = x + (hash(k * 3 + y) < 0.5 ? -1 : 1); line(g, x, y, nx, y + 2, hash(k + y) < 0.3 ? '#9ff3ff' : '#ffffff'); x = nx; y += 2 }
      for (let i = 0; i < 8; i++) dot(g, 249 + (hash(k * 5 + i) - 0.5) * 16, 57 + (hash(k * 7 + i) - 0.5) * 16, '#ffffff')
    }
    if (s.flags[F.gustavFed] && !s.flags[F.clockKeyTaken] && Math.floor(v.t * 1.5) % 3 === 0) dot(g, 264, 124, '#ffffff')
  },
}

export const painter: RoomPainter = painterConservatory
