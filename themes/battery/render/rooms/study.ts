/**
 * The Professor's Study (420 wide): cosy and odd. Teal striped wallpaper
 * over rose wainscot, a Persian rug on leaning planks, bookshelves bursting
 * with titles, the big bulging desk (green leather, the diary, a
 * galvanometer, the green banker's lamp) with its drawer, the bust of Volta
 * in a knitted scarf, a stack of books, the dormer window between velvet
 * curtains (Count Flapula hangs from its latch), a brass telescope aimed out
 * of the little round gable window, and a collar beam for the Count to dine
 * on.
 *
 * State it reads: study.drawerOpen, F.monocleTaken, F.windowOpen (the
 * sashes swing in, the curtains blow, rain spits onto the floor).
 */
import { bayer } from '../../../base/pixel/sprites'
import { F } from '../../content/flags'
import type { GameState } from '../../types'
import type { G, RoomPainter, View } from '../api'
import { bolt, hash, rainIn } from '../fx'
import {
  INK, PLUM, WOOD, beam, box, cachedSprite, cobweb, dither, disc, dot, flagAt, line, oval, ovalO, poly, polyO, rect, stormPane,
  type P2,
} from './storeroom'

const W = 420
const FLOOR_Y = 102
const WIN = { x: 282, y: 20, w: 36, h: 38 }
const PORT = { cx: 401, cy: 48, r: 10 }
const LAMP = { x: 176, y: 44 }

function ceilY(x: number): number {
  if (x < 110) return 34 - x * 0.31
  if (x > 344) return (x - 344) * 0.3
  return 0
}

function paintWall(g: G) {
  for (let y = 0; y < FLOOR_Y; y++) {
    const lean = (FLOOR_Y - y) * -0.05
    for (let x = 0; x < W; x++) {
      if (y < ceilY(x)) continue
      const u = x - lean
      let c: string
      if (y >= 76) {
        // Rose-brown wainscot panels.
        const pu = ((u % 30) + 30) % 30
        c = '#8a3a4a'
        if (pu < 1 || y === 76 || y === 77) c = '#5a1e30'
        else if (pu < 2 || y === 79) c = '#b0506a'
        else if (y > 80 && y < 97 && pu > 4 && pu < 26) c = y === 81 ? '#5a1e30' : '#7a3040'
        if (y === 78) c = '#d8a040'
      } else {
        const idx = Math.floor(u / 7)
        c = idx % 2 ? '#2a6a7a' : '#246070'
        // Little gold and rose lozenges in every other stripe.
        if (idx % 2 === 0) {
          const ly = ((y + idx * 5) % 12 + 12) % 12
          const lx = u - idx * 7
          if (Math.abs(lx - 3) + Math.abs(ly - 6) < 2) c = idx % 4 === 0 ? '#d8a040' : '#c04a6a'
        }
        if (bayer(x, y) < 0.6 - y / 50) c = '#1c4a58'
      }
      dot(g, x, y, c)
    }
  }
  for (let x = 0; x < W; x++) { rect(g, x, FLOOR_Y - 3, 1, 2, WOOD.d); dot(g, x, FLOOR_Y - 1, INK) }
}

function paintCeiling(g: G) {
  for (let x = 0; x < W; x++) {
    const cy = ceilY(x)
    for (let y = 0; y < cy; y++) {
      const d = cy - y
      let c = Math.floor(d / 5) % 2 ? PLUM.d : PLUM.m
      if (d % 5 < 1 || bayer(x, y) < 0.25) c = PLUM.k
      dot(g, x, y, c)
    }
  }
  beam(g, -4, 36, 114, -2, 6)
  beam(g, 340, -2, 424, 26, 6)
  // The collar beam (the Count's dining rafter).
  beam(g, -6, 6, W + 6, 9, 7)
}

function paintFloor(g: G) {
  const vx = 210
  const vy = -60
  for (let y = FLOOR_Y; y < 144; y++) {
    const s = (y - vy) / (FLOOR_Y - vy)
    for (let x = 0; x < W; x++) {
      const u = vx + (x - vx) / s
      const idx = Math.floor(u / 11)
      const fr = (u - idx * 11) * s
      let c = hash(idx * 13 + 9) < 0.5 ? '#7a4428' : '#6a3a22'
      if (fr < 1) c = '#2a140e'
      else if (fr < 2) c = '#9a5a34'
      if (y < FLOOR_Y + 7 && bayer(x, y) < (FLOOR_Y + 7 - y) / 9) c = '#3a2014'
      dot(g, x, y, c)
    }
  }
  // The Persian rug, in perspective.
  const rug: P2[] = [[120, 108], [330, 108], [352, 138], [96, 138]]
  poly(g, rug.map(p => [p[0], p[1] + 1] as P2), INK)
  poly(g, rug, '#9a1e3a')
  poly(g, [[124, 110], [326, 110], [346, 136], [102, 136]], '#d8a040')
  poly(g, [[127, 111], [323, 111], [342, 135], [106, 135]], '#7a1830')
  poly(g, [[136, 114], [314, 114], [330, 131], [118, 131]], '#2a5a6a')
  poly(g, [[140, 115], [310, 115], [325, 130], [123, 130]], '#9a1e3a')
  // The medallion and little motifs.
  for (let y = 116; y < 130; y++) for (let x = 130; x < 322; x++) {
    const cx = 224
    const cy = 122.5
    const dd = Math.abs(x - cx) / 4.2 + Math.abs(y - cy)
    if (dd < 5) dot(g, x, y, dd < 2 ? '#ffd23f' : '#2a5a6a')
    else if (dd > 6.5 && dd < 7.5) dot(g, x, y, '#d8a040')
    else if ((x + y * 3) % 17 === 0 && dd > 9) dot(g, x, y, '#e0607a')
  }
  // Fringe.
  for (let x = 98; x < 351; x += 2) { dot(g, x, 139, '#e8d8b0'); dot(g, x + 1, 140, '#c8b898') }
  for (let x = 121; x < 330; x += 2) dot(g, x, 107, '#e8d8b0')
}

function paintDoorway(g: G) {
  // Back to the storeroom: a door standing open onto the dark.
  polyO(g, [[4, 36], [34, 38], [34, FLOOR_Y], [4, FLOOR_Y]], '#c04a6a')
  poly(g, [[8, 42], [30, 43], [30, FLOOR_Y], [8, FLOOR_Y]], '#140c24')
  dither(g, 8, 60, 22, 40, '#2a1c3a', 0.3)
  // The open door leaf, swung against the wall.
  poly(g, [[30, 43], [37, 40], [37, FLOOR_Y + 3], [30, FLOOR_Y]], INK)
  poly(g, [[31, 44], [36, 42], [36, FLOOR_Y + 1], [31, FLOOR_Y - 1]], '#2a8a86')
  line(g, 33, 50, 33, 94, '#1f6a66')
  dot(g, 35, 72, '#ffd23f')
}

const BOOK_COLS = ['#c04a6a', '#2a8a86', '#d8a040', '#7a3a8a', '#3a5aa8', '#b0602a', '#e0607a', '#3fa89a', '#8a2a4a', '#ffd23f']

function paintShelves(g: G) {
  const x0 = 40
  const x1 = 104
  // Case, leaning a little.
  polyO(g, [[x0, 22], [x1, 20], [x1 + 2, FLOOR_Y], [x0 + 2, FLOOR_Y]], WOOD.m)
  poly(g, [[x0 + 3, 25], [x1 - 3, 23], [x1 - 1, FLOOR_Y - 3], [x0 + 5, FLOOR_Y - 3]], '#2a140e')
  line(g, x0, 22, x1, 20, WOOD.h)
  const shelves = [25, 44, 63, 82, 99]
  for (let si = 0; si < shelves.length - 1; si++) {
    const top = shelves[si]!
    const bot = shelves[si + 1]!
    const lean = si * 0.5
    let x = x0 + 5 + lean
    let n = 0
    while (x < x1 - 4 + lean) {
      const r = hash(si * 101 + n * 7)
      const bw = 2 + Math.floor(r * 3)
      const bh = bot - top - 3 - Math.floor(hash(n * 13 + si) * 5)
      const col = BOOK_COLS[Math.floor(hash(n * 3 + si * 11) * BOOK_COLS.length)]!
      if (hash(n * 5 + si * 3) < 0.1 && x < x1 - 14 + lean) {
        // A book lying down, or leaning.
        rect(g, x, bot - 5, 9, 4, col)
        rect(g, x, bot - 5, 9, 1, '#fff4ff')
        x += 10
      } else {
        rect(g, x, bot - 1 - bh, bw, bh, col)
        rect(g, x, bot - 1 - bh, bw, 1, '#fff1b0')
        if (bh > 8) rect(g, x, bot - 1 - bh + 3, bw, 1, '#0b0616')
        x += bw
      }
      n++
    }
    // The shelf plank.
    rect(g, x0 + 3 + lean, bot - 1, x1 - x0 - 5, 3, WOOD.l)
    rect(g, x0 + 3 + lean, bot - 1, x1 - x0 - 5, 1, WOOD.h)
  }
  // A skull on the top shelf, reading.
  ovalO(g, 92, 38, 3, 3, '#e8e4d0'); dot(g, 91, 38, INK); dot(g, 93, 38, INK)
  // A little jar with something pickled.
  box(g, 50, 36, 5, 6, '#9ad8b0', '#d8fff0'); dot(g, 52, 39, '#e0607a')
}

function paintDesk(g: G) {
  // A fat, bulging desk with round feet (DOTT furniture).
  polyO(g, [[110, 66], [192, 64], [194, 70], [108, 72]], '#2a7a4a')
  poly(g, [[112, 66], [190, 64], [191, 66], [111, 68]], '#4aa86a')
  rect(g, 108, 71, 86, 3, WOOD.d)
  // The body.
  polyO(g, [[112, 73], [190, 72], [188, 102], [114, 102]], WOOD.m)
  poly(g, [[113, 74], [189, 73], [189, 75], [113, 76]], WOOD.l)
  // Side pedestals with little panels.
  for (const x of [118, 170]) {
    rect(g, x, 78, 14, 20, WOOD.d)
    rect(g, x + 1, 79, 12, 1, WOOD.l)
    rect(g, x + 5, 86, 4, 2, '#ffd23f')
  }
  // The drawer front (drawn shut; back() pulls it out).
  box(g, 137, 88, 28, 9, WOOD.l, WOOD.h, WOOD.d)
  // Round bun feet.
  for (const x of [116, 182]) { ovalO(g, x, 102, 4, 2, WOOD.m); dot(g, x - 1, 101, WOOD.h) }
  // Desk things: an inkwell and quill, a galvanometer, papers.
  box(g, 158, 60, 5, 4, '#1c1030', '#3a2458')
  line(g, 161, 59, 166, 50, '#fff4ff'); line(g, 162, 59, 167, 51, '#d8d0ec')
  // A brass desk clock, stopped at 11:59 like every clock in the house.
  box(g, 142, 54, 12, 10, '#d8a040', '#ffe070', '#8a5a18')
  oval(g, 148, 58, 4, 3, '#f4ecd8')
  line(g, 148, 58, 148, 55, INK)
  line(g, 148, 58, 147, 56, INK)
  dot(g, 148, 58, '#c04a6a')
  poly(g, [[184, 62], [192, 61], [192, 64], [184, 65]], '#f4ecd8')
}

function paintDiary(g: G) {
  // The diary: fat, red, a ribbon hanging out.
  box(g, 115, 61, 20, 5, '#8a1830', '#c02a4a', '#5a1020')
  rect(g, 116, 62, 18, 1, '#f4ecd8')
  rect(g, 133, 61, 1, 5, '#ffd23f')
  line(g, 124, 66, 125, 70, '#ffd23f')
}

function paintLampBase(g: G) {
  const { x, y } = LAMP
  rect(g, x - 4, y + 18, 9, 2, INK); rect(g, x - 3, y + 18, 7, 1, '#d8a040')
  rect(g, x, y + 9, 1, 9, '#d8a040'); rect(g, x - 1, y + 9, 1, 9, INK)
}

function paintBust(g: G) {
  const cx = 211
  // Marble plinth.
  polyO(g, [[cx - 9, 76], [cx + 9, 76], [cx + 8, FLOOR_Y], [cx - 8, FLOOR_Y]], '#d8d0ec')
  rect(g, cx - 10, 74, 21, 3, '#f0ecff'); rect(g, cx - 10, 76, 21, 1, INK)
  rect(g, cx - 9, 98, 19, 3, '#b0a8c8')
  for (const x of [cx - 5, cx, cx + 5]) line(g, x, 78, x, 97, '#b0a8c8')
  dither(g, cx + 3, 78, 5, 20, '#a098c0', 0.4)
  // Shoulders and head in white plaster.
  oval(g, cx, 72, 11, 4, INK); oval(g, cx, 72, 10, 3, '#e8e4f4')
  ovalO(g, cx, 58, 7, 9, '#f0ecff')
  dither(g, cx + 2, 52, 5, 14, '#c8c0e0', 0.45)
  // Curls.
  for (const [x, y] of [[-6, 51], [-4, 49], [-1, 48], [2, 48], [5, 50], [6, 53], [-7, 55]] as const) { oval(g, cx + x, y, 2, 2, '#d8d0ec'); dot(g, cx + x, y, '#a8a0c8') }
  // A face: stern eyes, a big nose.
  rect(g, cx - 4, 57, 2, 1, '#8a80a8'); rect(g, cx + 2, 57, 2, 1, '#8a80a8')
  rect(g, cx - 4, 56, 3, 1, '#a098c0'); rect(g, cx + 2, 56, 3, 1, '#a098c0')
  line(g, cx, 57, cx + 1, 61, '#a098c0')
  rect(g, cx - 2, 63, 4, 1, '#a098c0')
  // The knitted scarf (red and gold stripes), one end hanging down the plinth.
  for (let i = 0; i < 17; i++) {
    const y = 66 + Math.round(Math.sin(i * 0.4) * 1)
    rect(g, cx - 8 + i, y, 1, 5, i % 4 < 2 ? '#d03050' : '#ffd23f')
  }
  rect(g, cx - 9, 65, 19, 1, INK); rect(g, cx - 9, 71, 19, 1, INK)
  for (let j = 0; j < 14; j++) {
    const y = 71 + j
    rect(g, cx + 4 + Math.round(j * 0.15), y, 4, 1, Math.floor(j / 2) % 2 ? '#d03050' : '#ffd23f')
    dot(g, cx + 3 + Math.round(j * 0.15), y, INK); dot(g, cx + 8 + Math.round(j * 0.15), y, INK)
  }
  for (let i = 0; i < 4; i++) dot(g, cx + 5 + i, 86, '#ffd23f')
}

function paintCatBed(g: G) {
  // A cat bed by the book stack: velvet, round, full of white hairs.
  oval(g, 276, 106, 10, 3, INK)
  oval(g, 276, 105, 9, 3, '#c04a6a')
  oval(g, 276, 105, 6, 1, '#e0708a')
  rect(g, 270, 102, 13, 1, '#ff8aa8')
  dot(g, 273, 105, '#ffffff'); dot(g, 279, 104, '#ffffff'); dot(g, 276, 106, '#ffffff')
}

function paintBookStack(g: G) {
  let y = FLOOR_Y + 4
  const widths = [26, 22, 24, 18, 21, 16, 19, 14]
  for (let i = 0; i < widths.length; i++) {
    const bw = widths[i]!
    const h = 3 + (i % 3 === 0 ? 1 : 0)
    const off = Math.round(Math.sin(i * 1.7) * 2 + i * 0.4)
    const x = 247 - bw / 2 + off
    y -= h
    box(g, x, y, bw, h, BOOK_COLS[(i * 3) % BOOK_COLS.length]!)
    rect(g, x + 1, y + 1, bw - 2, 1, '#f4ecd8')
  }
  // "Midnight: Why It Matters" on top, and a teacup.
  box(g, 245, y - 5, 5, 4, '#fff4ff', '#ffffff', '#c8c0e0')
  rect(g, 250, y - 4, 1, 2, '#fff4ff')
}

function paintDormer(g: G) {
  // A recess cut into the roof: cheeks in perspective, a little gable over it.
  poly(g, [[270, 10], [330, 10], [322, WIN.y + WIN.h + 6], [278, WIN.y + WIN.h + 6]], INK)
  poly(g, [[272, 12], [328, 12], [321, WIN.y + WIN.h + 5], [279, WIN.y + WIN.h + 5]], '#1c4a58')
  poly(g, [[272, 12], [282, 18], [282, WIN.y + WIN.h + 2], [279, WIN.y + WIN.h + 5]], '#246070')
  poly(g, [[328, 12], [318, 18], [318, WIN.y + WIN.h + 2], [321, WIN.y + WIN.h + 5]], '#163a48')
  // Window frame.
  box(g, WIN.x - 2, WIN.y - 2, WIN.w + 4, WIN.h + 4, '#e8e4f4', '#ffffff', '#a098c0')
  // Sill.
  box(g, WIN.x - 6, WIN.y + WIN.h + 2, WIN.w + 12, 4, WOOD.l, WOOD.h, WOOD.d)
  // Curtain rod.
  rect(g, 262, 12, 76, 2, '#d8a040'); rect(g, 262, 12, 76, 1, '#ffe070')
  ovalO(g, 261, 13, 2, 2, '#ffd23f'); ovalO(g, 339, 13, 2, 2, '#ffd23f')
}

function paintTelescope(g: G) {
  // Tripod.
  line(g, 356, 76, 344, FLOOR_Y + 4, INK); line(g, 357, 76, 345, FLOOR_Y + 4, WOOD.l)
  line(g, 358, 76, 370, FLOOR_Y + 4, INK); line(g, 359, 76, 371, FLOOR_Y + 4, WOOD.l)
  line(g, 357, 76, 358, FLOOR_Y + 6, INK); line(g, 358, 76, 359, FLOOR_Y + 6, WOOD.m)
  rect(g, 355, 73, 6, 5, INK); rect(g, 356, 74, 4, 3, '#d8a040')
  // The brass tube, aimed up at the little round window.
  const pts: P2[] = [[340, 86], [388, 52], [392, 57], [344, 91]]
  poly(g, pts.map(p => [p[0] - 1, p[1] - 1] as P2), INK)
  poly(g, pts.map(p => [p[0] + 1, p[1] + 1] as P2), INK)
  poly(g, pts, '#d8a040')
  line(g, 341, 86, 388, 53, '#ffe070')
  line(g, 344, 90, 391, 57, '#8a5a18')
  // Rings and the eyepiece.
  for (const k of [0.25, 0.55, 0.85]) {
    const x = 340 + 48 * k
    const y = 86 - 34 * k
    line(g, x, y - 1, x + 4, y + 5, '#8a5a18')
  }
  rect(g, 335, 87, 6, 4, INK); rect(g, 336, 88, 4, 2, '#8a5a18')
  // A brass plate: "PROPERTY OF O.V. HANDS OFF, COUNT".
  rect(g, 362, 70, 4, 2, '#ffe070')
}

function paintPorthole(g: G) {
  const { cx, cy, r } = PORT
  disc(g, cx, cy, r + 3, INK)
  disc(g, cx, cy, r + 2, '#d8a040')
  for (let a = 0; a < 40; a++) {
    const t = (a / 40) * Math.PI * 2
    dot(g, cx + Math.cos(t) * (r + 1), cy + Math.sin(t) * (r + 1), Math.sin(t) < 0 ? '#ffe070' : '#8a5a18')
  }
  disc(g, cx, cy, r, INK)
  stormPane(g, cx - r + 1, cy - r + 1, r * 2 - 1, r * 2 - 1, (x, y) => (x - cx) ** 2 + (y - cy) ** 2 < (r - 1) ** 2)
  // Far below: the gate, and Brunhilde's hazard lights (animated in glow()).
  rect(g, cx - 8, cy + 4, 16, 3, '#12102a')
  rect(g, cx - 3, cy + 3, 6, 2, '#b0542a')
  // Rivets.
  for (let a = 0; a < 8; a++) { const t = (a / 8) * Math.PI * 2; dot(g, cx + Math.cos(t) * (r + 2), cy + Math.sin(t) * (r + 2), '#fff1b0') }
}

function paintClutter(g: G) {
  cobweb(g, 1, 36, 9, 1)
  cobweb(g, W - 2, 26, 9, -1)
  // A framed diploma, askew: "DOCTOR OF LIGHTNING".
  polyO(g, [[240, 30], [262, 28], [263, 44], [241, 46]], '#d8a040')
  poly(g, [[242, 31], [260, 30], [261, 42], [243, 44]], '#f4ecd8')
  line(g, 245, 35, 257, 34, '#8a80a8'); line(g, 245, 38, 256, 37, '#8a80a8')
  ovalO(g, 257, 41, 2, 2, '#e0607a')
  // A globe on the wainscot shelf.
  ovalO(g, 236, 70, 4, 4, '#3fa89a'); dot(g, 235, 69, '#b6ff4a'); dot(g, 237, 71, '#b6ff4a'); rect(g, 234, 75, 5, 1, '#d8a040')
  // A Leyden jar (a very old battery) on the floor by the telescope.
  box(g, 380, 92, 6, 9, '#c8e0f0', '#ffffff', '#8aa8c0'); rect(g, 380, 96, 6, 5, '#d8a040'); rect(g, 382, 88, 1, 4, '#8a8098'); ovalO(g, 382, 87, 1, 1, '#d8a040')
}

// ---------------------------------------------------------------------------

function drawer(open: boolean, monocle: boolean): HTMLCanvasElement {
  return cachedSprite(`st-drawer-${open}-${monocle}`, 34, 22, g => {
    if (!open) return
    // Pulled out towards us: we see into it from above, then its front, lower down.
    rect(g, 1, 0, 32, 21, INK)
    rect(g, 2, 1, 30, 9, '#3a1c10')
    rect(g, 2, 1, 1, 9, WOOD.d); rect(g, 31, 1, 1, 9, WOOD.d)
    rect(g, 2, 10, 30, 10, WOOD.l)
    rect(g, 2, 10, 30, 1, WOOD.h)
    rect(g, 2, 19, 30, 1, WOOD.d)
    rect(g, 14, 13, 6, 3, '#ffd23f'); dot(g, 15, 13, '#fff1b0')
    // Pencil stubs, a biscuit, a paperclip.
    rect(g, 4, 3, 6, 1, '#ffd23f'); dot(g, 10, 3, '#e0607a'); rect(g, 24, 2, 4, 3, '#d8a060'); dot(g, 25, 3, '#8a5a30')
    rect(g, 5, 7, 4, 1, '#c8c0e0')
    if (monocle) {
      oval(g, 16, 5, 3, 2, '#ffd23f'); oval(g, 16, 5, 2, 1, '#c8e8ff')
      dot(g, 15, 4, '#ffffff')
      line(g, 19, 6, 23, 8, '#d8a040'); line(g, 23, 8, 27, 7, '#d8a040')
    }
  })
}

function curtains(g: G, open: boolean, t: number) {
  // Rose velvet, gathered; when the window is open they billow into the room.
  for (const side of [-1, 1] as const) {
    const base = side < 0 ? 264 : 336
    for (let y = 14; y < 72; y++) {
      const k = (y - 14) / 58
      const blow = open ? (Math.sin(t * 3 + y * 0.15) * 2 + 3) * k * -side : 0
      const w = 6 + Math.round(k * 3)
      const x0 = side < 0 ? base + blow : base - w + blow
      rect(g, x0 - 1, y, w + 2, 1, INK)
      rect(g, x0, y, w, 1, '#b01838')
      for (let f = 1; f < w; f += 3) dot(g, x0 + f, y, '#ff3b5c')
      dot(g, x0 + (side < 0 ? w - 1 : 0), y, '#6a0c20')
    }
    // Gold tie-back.
    const tx = side < 0 ? base + 1 : base - 8
    rect(g, tx, 46, 8, 2, '#ffd23f')
  }
}

function windowPane(g: G, s: GameState, v: View) {
  const { x, y, w, h } = WIN
  const open = flagAt(s, F.windowOpen)
  // The storm outside (sky pre-painted by the static layer).
  g.drawImage(stormSprite(), x, y)
  if (open) {
    // The roof's slates just outside the sill, running with rain.
    for (let i = 0; i < w; i++) {
      const sy = y + h - 7 + Math.round(i * 0.12)
      rect(g, x + i, sy, 1, y + h - sy, (i + Math.floor(sy / 3)) % 5 ? '#3a2e58' : '#241a40')
    }
  }
  rainIn(g, x, y, w, h, v.t, open ? 20 : 10, v.flash)
  if (!open) {
    // Four panes: mullions.
    rect(g, x, y + h / 2 - 1, w, 2, '#e8e4f4')
    rect(g, x + w / 2 - 1, y, 2, h, '#e8e4f4')
    // Rain on the glass: slow drops.
    for (let i = 0; i < 6; i++) {
      const dx = x + 2 + Math.floor(hash(i * 5 + 1) * (w - 4))
      const dy = y + ((hash(i * 3 + 2) * h + v.t * (4 + i)) % h)
      dot(g, dx, dy, '#a8c0f0'); dot(g, dx, dy - 1, '#6a80c0')
    }
    // The latch: a brass lever hanging down over the sill (the Count's perch).
    rect(g, x + w / 2 - 3, y + h - 2, 6, 2, INK)
    rect(g, x + w / 2 - 2, y + h - 2, 4, 1, '#ffd23f')
    rect(g, x + w / 2 - 1, y + h - 1, 3, 3, INK)
    rect(g, x + w / 2, y + h - 1, 1, 2, '#ffd23f')
  } else {
    // Both sashes swung in, seen edge-on-ish.
    for (const [sx, dir] of [[x - 1, -1], [x + w + 1, 1]] as const) {
      const pts: P2[] = [[sx, y - 1], [sx + dir * 9, y + 3], [sx + dir * 9, y + h - 3], [sx, y + h + 1]]
      polyO(g, pts, '#e8e4f4')
      poly(g, [[sx + dir * 2, y + 2], [sx + dir * 7, y + 5], [sx + dir * 7, y + h - 5], [sx + dir * 2, y + h - 2]], '#8fa6d8')
      line(g, sx + dir * 2, y + h / 2, sx + dir * 7, y + h / 2 + 1, '#e8e4f4')
    }
  }
}

function stormSprite(): HTMLCanvasElement {
  return cachedSprite('st-storm', WIN.w, WIN.h, g => {
    stormPane(g, 0, 0, WIN.w, WIN.h, () => true)
    // Far off: the sea horizon and the town's lights across the bay.
    rect(g, 0, 27, WIN.w, 11, '#141a3a')
    for (let x = 0; x < WIN.w; x += 2) if (hash(x * 7) < 0.4) dot(g, x, 26 + (x % 3 === 0 ? -1 : 0), '#ffd890')
  })
}

export const painter: RoomPainter = {
  paint(g, w, h) {
    rect(g, 0, 0, w, h, '#120a20')
    paintWall(g)
    paintCeiling(g)
    paintFloor(g)
    paintDoorway(g)
    paintShelves(g)
    paintDormer(g)
    paintPorthole(g)
    paintClutter(g)
    paintTelescope(g)
    paintBust(g)
    paintDesk(g)
    paintDiary(g)
    paintLampBase(g)
    paintBookStack(g)
    paintCatBed(g)
    for (const [x, ww] of [[112, 78], [202, 18], [232, 30], [42, 64]] as const) dither(g, x, FLOOR_Y + 1, ww, 2, INK, 0.5)
  },

  ambient: (s) => s.flags[F.windowOpen] ? '#766ca4' : '#7a6ea0',

  back(g, s, v) {
    windowPane(g, s, v)
    curtains(g, flagAt(s, F.windowOpen), v.t)
    const open = flagAt(s, 'study.drawerOpen')
    if (open) {
      rect(g, 137, 88, 28, 9, '#1c0c08')
      g.drawImage(drawer(true, !s.flags[F.monocleTaken]), 134, 87)
    }
    // The porthole's rain.
    rainIn(g, PORT.cx - 7, PORT.cy - 7, 14, 14, v.t, 5, v.flash)
    // Rain spitting in through the open window onto the floor.
    if (s.flags[F.windowOpen]) {
      for (let i = 0; i < 10; i++) {
        const k = ((v.t * 1.4 + hash(i * 7)) % 1)
        const x = WIN.x + 4 + hash(i * 3 + 1) * (WIN.w - 8) + k * 6
        const y = WIN.y + WIN.h + 4 + k * 52
        dot(g, x, y, '#8fa6d8'); dot(g, x, y - 1, '#5a6aa8')
      }
      // A puddle growing on the floorboards.
      oval(g, 300, 112, 12, 2, '#3a4a78'); oval(g, 298, 112, 6, 1, '#6a80c0')
    }
  },

  lights(L, s, v) {
    const f = 0.95 + Math.sin(v.t * 3.1) * 0.02
    L(LAMP.x, LAMP.y + 12, 110, '#ffd8a0', 0.9 * f)
    L(LAMP.x - 16, LAMP.y + 22, 40, '#b8ffb0', 0.3)
    L(WIN.x + WIN.w / 2, WIN.y + WIN.h / 2, s.flags[F.windowOpen] ? 70 : 46, '#8fa6ff', 0.4 + v.flash * 1.1)
    if (v.flash > 0.1) L(300, 110, 80, '#c8d0ff', v.flash * 0.8)
    L(PORT.cx, PORT.cy, 24, '#8fa6ff', 0.3 + v.flash * 0.6)
    L(60, 70, 60, '#ffb0a0', 0.12)
  },

  glow(g, s, v) {
    // The banker's lamp: green glass shade, a warm glow under it.
    const { x, y } = LAMP
    poly(g, [[x - 8, y + 9], [x + 8, y + 9], [x + 5, y + 3], [x - 5, y + 3]], INK)
    poly(g, [[x - 7, y + 8], [x + 7, y + 8], [x + 4, y + 4], [x - 4, y + 4]], '#2aa86a')
    rect(g, x - 3, y + 4, 6, 1, '#8affc0')
    rect(g, x - 6, y + 9, 13, 1, '#fff1b0')
    dot(g, x, y + 2, '#d8a040')
    // Brunhilde's hazard lights, far below through the porthole.
    if (Math.floor(v.t * 1.6) % 2 === 0) {
      dot(g, PORT.cx - 3, PORT.cy + 4, '#ff8a3d'); dot(g, PORT.cx + 2, PORT.cy + 4, '#ff8a3d')
    }
    // The monocle glints in its drawer.
    if (flagAt(s, 'study.drawerOpen') && !s.flags[F.monocleTaken] && (v.t % 2.2) < 0.25) {
      dot(g, 149, 91, '#ffffff'); dot(g, 148, 91, '#fff1b0'); dot(g, 150, 91, '#fff1b0'); dot(g, 149, 90, '#fff1b0'); dot(g, 149, 92, '#fff1b0')
    }
    // Lightning: the dormer's sky flares, a bolt comes down behind the panes.
    if (v.flash > 0.3) {
      const open = !!s.flags[F.windowOpen]
      const hh = WIN.h - (open ? 7 : 0)
      rect(g, WIN.x, WIN.y, WIN.w, hh, v.flash > 0.6 ? '#9a98d8' : '#5a5a9a')
      const seed = Math.floor(v.t * 3)
      g.save()
      g.beginPath(); g.rect(WIN.x, WIN.y, WIN.w, hh); g.clip()
      bolt(g, WIN.x + 8 + (seed % 20), WIN.y, WIN.y + WIN.h, seed, '#ffffff')
      g.restore()
      if (!open) {
        rect(g, WIN.x, WIN.y + WIN.h / 2 - 1, WIN.w, 2, '#e8e4f4')
        rect(g, WIN.x + WIN.w / 2 - 1, WIN.y, 2, WIN.h, '#e8e4f4')
      }
      disc(g, PORT.cx, PORT.cy, PORT.r - 1, v.flash > 0.6 ? '#9a98d8' : '#5a5a9a')
    }
  },
}
