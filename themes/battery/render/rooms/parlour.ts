/**
 * Parlour (400 wide): crimson wallpaper, the fireplace with its fire and
 * the poker on a hook, the moose head in a party hat, the storm window,
 * Aunt Hedvig's séance table (drawn by her painter), the piano, the
 * gramophone, a fat armchair under a fringed lamp.
 *
 * State: F.pokerTaken (the hook is empty), F.furnaceLit (the radiator
 * steams), 'parlour.seanceLive' (the crystal ball blazes during the
 * séance), 'parlour.gramophone' (the record turns, notes float).
 */
import { F } from '../../content/flags'
import type { GameState } from '../../types'
import type { G, RoomPainter, View } from '../api'
import { hash } from '../fx'
import { drawTable, hedvigGlow } from '../npcs/hedvig'
import { INK, box, dither, dot, flame, line, oval, ovalK, poly, polyK, radiator, ramp, rect, steam, stormPane } from './foyer'

const W = 400
/** Back edge of the floor: 104 at the left, 99 at the right (it lists the other way). */
export const parlourFloor = (x: number) => 104 - x * 5 / W

const PAPER = '#8a1a4a'
const PAPER_HI = '#b02a62'
const GOLD = '#ffd23f'
const GOLD_D = '#c4861c'
const WOOD = '#6a3420'
const WOOD_D = '#3a1a10'
const WOOD_HI = '#9a5a30'

function walls(g: G) {
  rect(g, 0, 0, W, 12, '#2a0c20')
  dither(g, 0, 0, W, 9, '#140610', 0.5)
  // Striped crimson wallpaper with gold sprigs.
  rect(g, 20, 10, 360, 66, PAPER)
  for (let x = 20; x < 380; x += 8) { rect(g, x, 12, 3, 64, PAPER_HI); rect(g, x + 3, 12, 1, 64, '#6a0e38') }
  for (let y = 18; y < 72; y += 10) for (let x = 25 + ((y / 10) % 2) * 4; x < 380; x += 8) { dot(g, x, y, GOLD_D); dot(g, x, y + 1, '#e0a030') }
  ramp(g, 20, 10, 360, 12, '#2a0c20', 0.7, 0)
  rect(g, 20, 10, 360, 2, GOLD_D)
  rect(g, 20, 12, 360, 1, INK)
  // Dark wood wainscot, sloping with the floor.
  for (let x = 20; x < 380; x++) {
    const fy = Math.round(parlourFloor(x))
    rect(g, x, 76, 1, fy - 76, WOOD)
    rect(g, x, fy - 3, 1, 3, WOOD_D)
  }
  rect(g, 20, 74, 360, 2, GOLD)
  rect(g, 20, 76, 360, 1, INK)
  for (let x = 24; x < 376; x += 22) {
    polyK(g, [[x, 80], [x + 16, 80], [x + 16, parlourFloor(x) - 6], [x, parlourFloor(x) - 6]], WOOD, WOOD_D)
    rect(g, x + 1, 81, 15, 1, WOOD_HI)
  }
  // Side walls.
  poly(g, [[0, 0], [20, 10], [20, 103.8], [0, 122]], '#5a0c30')
  poly(g, [[400, 0], [380, 10], [380, 99.3], [400, 116]], '#5a0c30')
  line(g, 20, 10, 20, 103, INK)
  line(g, 380, 10, 380, 99, INK)
  // The doorway back to the foyer.
  poly(g, [[4, 38], [17, 44], [17, 104], [4, 116]], INK)
  poly(g, [[6, 42], [16, 47], [16, 104], [6, 114]], '#1a1030')
  poly(g, [[6, 90], [16, 90], [16, 104], [6, 114]], '#2a2050')
  for (let y = 92; y < 112; y += 3) line(g, 6, y + 2, 16, y - 1, '#e8d8c0')
  line(g, 3, 37, 18, 44, GOLD_D); line(g, 3, 37, 3, 117, GOLD_D); line(g, 18, 44, 18, 104, GOLD_D)
}

function floor(g: G) {
  // Herringbone parquet, warm.
  for (let x = 0; x < W; x++) {
    const top = x < 20 ? 103.8 + (20 - x) * 0.9 : x > 380 ? 99.3 + (x - 380) * 0.83 : parlourFloor(x)
    for (let y = Math.floor(top); y < 144; y++) {
      const d = 800 / Math.max(1, y - 40)
      const X = (x - 200) * d / 100
      const u = X / 1.2
      const vv = d / 0.6
      const iu = Math.floor(u)
      const k = ((iu & 1) === 0) ? Math.floor(vv + u) : Math.floor(vv - u)
      const c = k % 3 === 0 ? '#8a4a24' : k % 3 === 1 ? '#a0582c' : '#7a3e1e'
      g.fillStyle = (u - iu) < 0.06 ? '#4a2210' : c
      g.fillRect(x, y, 1, 1)
    }
  }
  // A big round rug under the table.
  for (let y = 108; y < 136; y++) {
    const t = (y - 122) / 14
    const hw = 64 * Math.sqrt(Math.max(0, 1 - t * t))
    rect(g, 196 - hw - 1, y, hw * 2 + 2, 1, INK)
    rect(g, 196 - hw, y, hw * 2, 1, '#1f5a6a')
    const hw2 = hw - 5
    if (hw2 > 0) rect(g, 196 - hw2, y, hw2 * 2, 1, '#2a7a8a')
    if (hw > 3) { dot(g, 196 - hw + 2, y, GOLD); dot(g, 196 + hw - 3, y, GOLD) }
  }
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI * 2
    oval(g, 196 + Math.cos(a) * 40, 122 + Math.sin(a) * 8, 2, 1, '#e0a030')
  }
  for (let x = 20; x < 380; x++) dither(g, x, Math.round(parlourFloor(x)), 1, 3, INK, 0.45)
}

function fireplace(g: G) {
  // Marble surround (x 30–98), mantel at y 56.
  const base = Math.round(parlourFloor(64))
  polyK(g, [[32, 58], [96, 58], [96, base], [32, base]], '#e8b8c8')
  dither(g, 32, 58, 64, base - 58, '#c890a8', 0.3)
  for (let i = 0; i < 6; i++) line(g, 36 + i * 11, 60 + (i % 3) * 7, 40 + i * 11, 70 + (i % 2) * 9, '#b87898')
  // Mantelpiece shelf.
  box(g, 28, 54, 72, 4, '#f4d8e0', '#ffffff', '#c890a8')
  // Firebox.
  poly(g, [[42, 68], [86, 68], [86, base], [42, base]], INK)
  poly(g, [[44, 70], [84, 70], [84, base], [44, base]], '#1a0a0a')
  ramp(g, 44, 70, 40, 10, '#2a1010', 0.8, 0)
  // Arch.
  for (let x = 42; x <= 86; x++) {
    const t = (x - 64) / 22
    const y = 68 - Math.round(4 * Math.sqrt(Math.max(0, 1 - t * t)))
    rect(g, x, y, 1, 68 - y + 1, '#e8b8c8')
    dot(g, x, y - 1, INK)
  }
  // Hearth.
  box(g, 26, base, 76, 3, '#c890a8', '#f4d8e0')
  // Grate.
  rect(g, 50, base - 5, 28, 2, INK)
  for (let x = 51; x < 78; x += 4) rect(g, x, base - 8, 1, 6, '#4a3a4a')
  // Logs.
  ovalK(g, 58, base - 8, 7, 2, '#5a2a14')
  ovalK(g, 70, base - 9, 7, 2, '#6a3418')
  // On the mantel: two candlesticks and a carriage clock.
  for (const x of [34, 94]) { rect(g, x - 1, 46, 3, 8, INK); rect(g, x, 46, 1, 8, GOLD); rect(g, x, 42, 1, 4, '#fff4ff') }
  box(g, 60, 47, 8, 7, GOLD_D, GOLD)
  oval(g, 64, 50, 2, 2, '#fff4ff')
  // The poker hook, to the right of the fireplace.
  rect(g, 104, 58, 3, 2, INK)
  rect(g, 105, 58, 1, 1, GOLD)
  // Tongs and shovel stand (the poker's empty neighbours).
  rect(g, 112, 66, 1, 32, '#4a3a4a')
  rect(g, 110, 97, 5, 2, INK)
  line(g, 110, 66, 113, 60, '#6a5a6a')
  rect(g, 114, 66, 1, 30, '#4a3a4a')
  poly(g, [[112, 94], [117, 94], [116, 99], [113, 99]], '#4a3a4a')
}

function poker(g: G) {
  // Hangs from the hook: brass knob at the top.
  ovalK(g, 106, 60, 2, 2, GOLD)
  rect(g, 105, 62, 2, 30, INK)
  rect(g, 105, 62, 1, 30, '#8a8aa8')
  line(g, 106, 92, 108, 95, INK)
  line(g, 105, 92, 104, 96, INK)
}

function moose(g: G, v: View) {
  // Plaque.
  polyK(g, [[56, 30], [72, 30], [74, 40], [64, 46], [54, 40]], WOOD_HI)
  // Antlers: fat palms with stubby points.
  for (const s of [-1, 1] as const) {
    const bx = 64 + s * 6
    const pts: [number, number][] = [[bx, 24], [bx + s * 6, 20], [bx + s * 9, 12], [bx + s * 11, 16], [bx + s * 14, 7], [bx + s * 16, 13], [bx + s * 19, 6], [bx + s * 20, 13], [bx + s * 23, 10], [bx + s * 22, 18], [bx + s * 16, 23], [bx + s * 6, 27]]
    polyK(g, pts, '#d8b078')
    poly(g, [[bx + s * 4, 25], [bx + s * 16, 20], [bx + s * 15, 22], [bx + s * 5, 26]], '#a07848')
    dot(g, bx + s * 13, 12, '#fff1c8'); dot(g, bx + s * 18, 11, '#fff1c8')
  }
  // Ears.
  polyK(g, [[55, 25], [48, 23], [55, 29]], '#7a4a24')
  polyK(g, [[73, 25], [80, 23], [73, 29]], '#7a4a24')
  // Head and long snout, a big droopy nose.
  ovalK(g, 64, 28, 9, 7, '#8a5a30')
  polyK(g, [[57, 30], [71, 30], [73, 44], [55, 44]], '#8a5a30')
  ovalK(g, 64, 45, 9, 5, '#a8703e')
  oval(g, 62, 43, 4, 2, '#c08850')
  dot(g, 60, 46, INK); dot(g, 61, 46, INK); dot(g, 67, 46, INK); dot(g, 68, 46, INK)
  rect(g, 60, 49, 8, 1, '#5a3418')
  // Dewlap.
  poly(g, [[61, 50], [67, 50], [65, 55], [63, 55]], '#7a4a24')
  // Googly eyes: one looks at you, one wanders.
  ovalK(g, 60, 27, 2.5, 2.5, '#ffffff'); ovalK(g, 68, 27, 2.5, 2.5, '#ffffff')
  const look = Math.floor(v.t / 3) % 3
  dot(g, 60 + (look === 1 ? 1 : 0), 27 + (look === 2 ? 1 : 0), INK)
  dot(g, 68, 26, INK)
  // Party hat, jaunty, with a pompom and an elastic under the chin.
  poly(g, [[63, 22], [74, 20], [71, 5]], INK)
  poly(g, [[64, 21], [73, 20], [71, 7]], '#ff2fa0')
  line(g, 67, 18, 73, 16, GOLD); line(g, 68, 13, 72, 12, GOLD)
  const pp = Math.round(Math.sin(v.t * 2.3))
  ovalK(g, 71 + pp, 5, 2, 2, GOLD)
  line(g, 64, 22, 56, 44, '#ff8ae0')
}

function windowFrame(g: G) {
  // A tall window (x 120–156) with heavy curtains.
  rect(g, 119, 15, 38, 58, INK)
  // Sill.
  box(g, 116, 72, 44, 3, '#e8b8c8', '#ffffff')
}

function windowPane(g: G, v: View) {
  stormPane(g, 121, 17, 34, 54, v, 31, '#141a44', '#2a2a6a')
  // Glazing bars.
  rect(g, 137, 17, 2, 54, '#3a1a2a')
  rect(g, 121, 43, 34, 2, '#3a1a2a')
  // Curtains, swaying a little in the draught.
  const sway = Math.sin(v.t * 1.1) * 1
  for (const [x0, dir] of [[112, 1], [150, -1]] as const) {
    for (let y = 12; y < 98; y++) {
      const tie = y > 52 && y < 58
      const w = tie ? 5 : 12 - Math.max(0, (60 - Math.abs(y - 55)) / 10) + (y > 58 ? (y - 58) / 8 : 0)
      const x = dir > 0 ? x0 : x0 + 14 - w
      const off = y > 58 ? Math.round(sway * (y - 58) / 40) : 0
      rect(g, x + off - 1, y, w + 2, 1, INK)
      rect(g, x + off, y, w, 1, '#1f5a4a')
      for (let k = 2; k < w; k += 4) dot(g, x + off + k, y, '#2f8a6a')
      if (tie) rect(g, x + off, y, w, 1, GOLD)
    }
  }
  // Pelmet.
  box(g, 110, 10, 56, 5, '#1f5a4a', '#3faa8a', '#0f3a2a')
  for (let x = 111; x < 165; x += 3) dot(g, x, 15, GOLD)
}

function piano(g: G) {
  // Upright piano (x 234–296), a bit bulgy.
  const base = Math.round(parlourFloor(265))
  polyK(g, [[236, 44], [294, 42], [296, base], [234, base]], '#2a1420')
  rect(g, 237, 45, 56, 2, '#5a3040')
  // Carved front panel.
  polyK(g, [[242, 50], [288, 49], [288, 66], [242, 66]], '#3a1a2a')
  for (let x = 246; x < 286; x += 8) oval(g, x + 2, 58, 2, 5, '#5a2a3a')
  // Sheet music.
  polyK(g, [[256, 52], [268, 51], [268, 64], [257, 65]], '#fff4e0')
  for (let y = 54; y < 63; y += 2) line(g, 258, y, 266, y - 0.3, '#8a7a90')
  // Keyboard.
  rect(g, 232, 70, 66, 6, INK)
  rect(g, 233, 70, 64, 4, '#fff4ff')
  for (let x = 234; x < 297; x += 3) rect(g, x, 70, 1, 4, '#b8b0c8')
  for (let x = 235; x < 296; x += 3) if ((x * 7) % 5 < 3) rect(g, x, 70, 2, 2, INK)
  rect(g, 232, 76, 66, 2, '#5a3040')
  // Legs with lion feet.
  for (const x of [238, 292]) { rect(g, x - 1, 78, 3, base - 78, INK); rect(g, x, 78, 1, base - 78, '#5a3040'); ovalK(g, x, base - 1, 3, 1, GOLD_D) }
  // Candelabra on top.
  rect(g, 283, 34, 1, 8, GOLD_D)
  rect(g, 279, 36, 9, 1, GOLD_D)
  rect(g, 279, 32, 1, 4, '#fff4ff'); rect(g, 287, 32, 1, 4, '#fff4ff'); rect(g, 283, 30, 1, 4, '#fff4ff')
  box(g, 280, 41, 7, 1, GOLD_D)
  // A bust of a composer who looks a lot like the moose.
  ovalK(g, 248, 36, 4, 5, '#e8e4f0')
  box(g, 245, 40, 7, 2, '#cfc6ff')
}

function gramophone(g: G) {
  // Cabinet (x 306–334).
  const base = Math.round(parlourFloor(320))
  polyK(g, [[306, 72], [334, 72], [335, base], [305, base]], WOOD)
  rect(g, 308, 76, 24, base - 80, WOOD_D)
  rect(g, 309, 77, 22, base - 82, WOOD)
  oval(g, 320, 86, 2, 2, GOLD)
  // Turntable box.
  box(g, 308, 64, 24, 8, WOOD_HI, '#c07a40', WOOD_D)
  rect(g, 333, 66, 3, 1, GOLD)
}

function gramophoneTop(g: G, s: GameState, v: View) {
  const playing = !!s.flags['parlour.gramophone']
  // Record.
  ovalK(g, 320, 63, 9, 2, '#1a1020')
  const r = playing ? Math.floor(v.t * 8) % 4 : 0
  dot(g, 316 + r * 2, 63, '#6a5a7a')
  dot(g, 320, 63, '#ff3b5c')
  // Tone arm.
  line(g, 330, 62, 324, 62, '#cfc6ff')
  // The horn: a huge golden flower.
  line(g, 330, 62, 332, 50, GOLD_D)
  line(g, 331, 62, 333, 50, GOLD)
  for (let i = 0; i < 16; i++) {
    const t = i / 15
    const cx = 333 - t * 6
    const cy = 50 - t * 20
    oval(g, cx, cy, 1 + t * 11, 1 + t * 5, i === 15 ? INK : t > 0.6 ? GOLD : GOLD_D)
  }
  oval(g, 327, 30, 10, 4.5, '#ff8ae0')
  oval(g, 327, 30, 7, 3, '#b01874')
  oval(g, 327, 31, 3, 1.5, '#3a0a20')
  if (playing) {
    for (let i = 0; i < 3; i++) {
      const p = (v.t * 0.4 + i / 3) % 1
      const x = 322 - p * 20 + Math.sin(v.t * 3 + i) * 3
      const y = 26 - p * 18
      rect(g, x, y, 1, 4, '#fff1b0')
      rect(g, x - 2, y + 3, 2, 2, '#fff1b0')
    }
  }
}

function armchair(g: G) {
  // A fat teal armchair (x 344–384) and a fringed standard lamp.
  const base = Math.round(parlourFloor(364))
  // Lamp.
  rect(g, 388, 34, 1, base - 34, GOLD_D)
  box(g, 384, base - 2, 9, 2, GOLD_D)
  polyK(g, [[380, 34], [396, 34], [393, 24], [383, 24]], '#ffb86a')
  for (let x = 381; x < 396; x += 2) dot(g, x, 35, GOLD)
  // Chair back.
  ovalK(g, 364, 70, 18, 16, '#1f7a8a')
  oval(g, 362, 66, 12, 10, '#2f9aaa')
  for (const [x, y] of [[356, 62], [364, 60], [372, 62], [360, 70], [368, 70]] as const) dot(g, x, y, '#0f4a5a')
  // Seat and arms.
  ovalK(g, 364, 88, 20, 6, '#1f7a8a')
  ovalK(g, 346, 82, 6, 9, '#2f9aaa')
  ovalK(g, 382, 82, 6, 9, '#2f9aaa')
  oval(g, 345, 78, 3, 3, '#5ac8d0'); oval(g, 381, 78, 3, 3, '#5ac8d0')
  rect(g, 346, 93, 36, base - 94, '#155a6a')
  rect(g, 346, 93, 36, 1, INK)
  for (const x of [348, 380]) rect(g, x, base - 2, 3, 3, INK)
  // A knitted cushion with a lightning bolt on it.
  ovalK(g, 364, 80, 6, 5, '#ffd23f')
  line(g, 365, 76, 362, 80, '#ff3b5c'); line(g, 362, 80, 366, 80, '#ff3b5c'); line(g, 366, 80, 363, 84, '#ff3b5c')
}

function fire(g: G, v: View) {
  const base = Math.round(parlourFloor(64)) - 8
  for (let i = 0; i < 18; i++) {
    const x = 52 + i * 1.3
    const h = 5 + Math.round((Math.sin(v.t * 9 + i * 1.7) + Math.sin(v.t * 13 + i)) * 2 + hash(i) * 5)
    for (let k = 0; k < h; k++) {
      const c = k < h * 0.35 ? '#fff1b0' : k < h * 0.7 ? '#ffd23f' : '#ff8a3d'
      dot(g, x, base - k, c)
    }
  }
  for (let i = 0; i < 4; i++) {
    const p = (v.t * 0.9 + i / 4) % 1
    dot(g, 58 + i * 5 + Math.sin(v.t * 4 + i) * 2, base - 8 - p * 14, p < 0.5 ? '#ffd23f' : '#ff3b5c')
  }
}

const painterParlour: RoomPainter = {
  paint(g) {
    walls(g)
    floor(g)
    fireplace(g)
    windowFrame(g)
    radiator(g, 124, 80, 28, 16)
    piano(g)
    gramophone(g)
    armchair(g)
    // A crooked little painting: a boat in a storm, of course.
    polyK(g, [[196, 28], [222, 30], [221, 48], [195, 46]], GOLD_D)
    poly(g, [[198, 31], [219, 32], [218, 45], [197, 44]], '#1a2a5a')
    poly(g, [[200, 42], [216, 43], [214, 45], [202, 45]], '#6a3420')
    line(g, 208, 34, 208, 42, '#e8e4f0')
    poly(g, [[209, 35], [214, 41], [209, 41]], '#fff4ff')
  },
  ambient: () => '#8a78a8',
  back(g, s, v) {
    fire(g, v)
    if (!s.flags[F.pokerTaken]) poker(g)
    windowPane(g, v)
    moose(g, v)
    gramophoneTop(g, s, v)
    if (s.flags[F.furnaceLit]) steam(g, 124, 78, 28, v.t, 4)
    // Hedvig floats away from her table: draw the table here.
    const h = s.actors['hedvig']
    if (!h || h.room !== 'parlour' || !h.visible || h.pose === 'float') drawTable(g, 196, 112, v, s)
  },
  lights(L, s, v) {
    const fl = 0.85 + Math.sin(v.t * 11) * 0.06 + Math.sin(v.t * 6.7) * 0.06
    L(64, 86, 70, '#ff9a4a', 0.95 * fl)
    L(64, 50, 30, '#ffc070', 0.4 * fl)
    L(283, 32, 40, '#ffc070', 0.6 * fl)
    L(388, 30, 50, '#ffb070', 0.65)
    L(138, 44, 30, '#8fa6ff', 0.2 + v.flash * 0.7)
    const h = s.actors['hedvig']
    if (h && h.room === 'parlour' && h.visible) {
      const live = !!s.flags['parlour.seanceLive']
      L(h.x, h.y - 30, live ? 70 : 50, '#5affb0', (live ? 0.8 : 0.45) + Math.sin(v.t * 2.2) * 0.08)
    }
    if (s.flags[F.furnaceLit]) L(138, 90, 20, '#ff6a3d', 0.3)
  },
  glowBehind(g, _s, v) {
    fire(g, v)
    flame(g, 34, 41, v.t, 1)
    flame(g, 94, 41, v.t, 2)
    flame(g, 279, 31, v.t, 3)
    flame(g, 283, 29, v.t, 4)
    flame(g, 287, 31, v.t, 5)
    rect(g, 384, 34, 9, 1, '#fff1b0')
  },
  glow(g, s, v) {
    const h = s.actors['hedvig']
    if (h && h.room === 'parlour' && h.visible) hedvigGlow(g, h, v, s)
    if (s.flags['parlour.seanceLive'] && h) {
      // The ball blazes: a pulsing halo round it.
      const r = 8 + Math.sin(v.t * 5) * 1.5
      for (let i = 0; i < 24; i++) {
        const a = i / 24 * Math.PI * 2 + v.t
        if (i % 2) dot(g, h.x + 0.5 + Math.cos(a) * r, h.y - 17 + Math.sin(a) * r, '#b8ffd8')
      }
      for (let i = 0; i < 6; i++) {
        const a = v.t * 2 + i
        dot(g, 196 + Math.cos(a) * 12, 90 + Math.sin(a) * 4, '#b8ffd8')
      }
    }
  },
}

export const painter: RoomPainter = painterParlour
