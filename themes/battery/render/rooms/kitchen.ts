/**
 * Kitchen (400 wide): mustard tiles, the dumbwaiter hatch with its bell,
 * the cold iron range, the counter with the drawer, the wall cupboard, the
 * sink under a storm window, the frozen freezer, the humming fridge (Mrs
 * Whiskers sleeps on top), a side counter, the door to the foyer.
 *
 * State: 'kitchen.drawerOpen', 'kitchen.cupboardOpen', 'kitchen.freezerOpen',
 * 'kitchen.hatchOpen'; F.matchesTaken, F.oilTaken, 'kitchen.sardinesTaken',
 * F.glovesTaken; F.furnaceLit (the freezer has thawed: no frost, a puddle).
 */
import { F } from '../../content/flags'
import type { GameState } from '../../types'
import type { G, RoomPainter, View } from '../api'
import { INK, box, checker, dither, dot, line, oval, ovalK, poly, polyK, ramp, rect, stormPane } from './foyer'

const W = 400
/** Back edge of the floor: bulges up a little in the middle. */
export const kitchenFloor = (x: number) => 102 + x * 3 / W - Math.sin(x / W * Math.PI) * 2

const TILE = '#d8a830'
const TILE_HI = '#f0c848'
const TILE_LO = '#a07818'
const CAB = '#1f7a6e'
const CAB_HI = '#3fb89a'
const CAB_D = '#155a52'
const GOLD = '#ffd23f'
const GOLD_D = '#c4861c'

function walls(g: G) {
  rect(g, 0, 0, W, 12, '#3a2010')
  dither(g, 0, 0, W, 9, '#1c1008', 0.5)
  // Tiles, a touch crooked: every other row shifts by a pixel.
  rect(g, 20, 10, 360, 94, TILE)
  for (let y = 12; y < 104; y += 6) {
    const shift = ((y / 6) | 0) % 2 ? 3 : 0
    rect(g, 20, y, 360, 1, TILE_LO)
    for (let x = 20 + shift; x < 380; x += 6) rect(g, x, y, 1, 6, TILE_LO)
    for (let x = 21 + shift; x < 380; x += 6) rect(g, x, y + 1, 4, 1, TILE_HI)
  }
  // A row of little blue tulip tiles.
  for (let x = 23; x < 380; x += 12) { dot(g, x + 1, 43, '#2f5fd0'); dot(g, x, 44, '#2f5fd0'); dot(g, x + 2, 44, '#2f5fd0'); dot(g, x + 1, 45, '#1f7a6e') }
  ramp(g, 20, 10, 360, 12, '#3a2010', 0.7, 0)
  rect(g, 20, 10, 360, 2, CAB_D)
  rect(g, 20, 12, 360, 1, INK)
  // Side walls.
  poly(g, [[0, 0], [20, 10], [20, 102], [0, 120]], '#a07818')
  poly(g, [[400, 0], [380, 10], [380, 103], [400, 120]], '#a07818')
  line(g, 20, 10, 20, 102, INK)
  line(g, 380, 10, 380, 103, INK)
  // The door to the foyer (right wall).
  poly(g, [[396, 38], [383, 44], [383, 103], [396, 112]], INK)
  poly(g, [[394, 42], [384, 47], [384, 103], [394, 110]], '#2a1450')
  poly(g, [[394, 92], [384, 92], [384, 103], [394, 110]], '#3a2a60')
  line(g, 397, 37, 382, 44, CAB_D); line(g, 397, 37, 397, 113, CAB_D); line(g, 382, 44, 382, 103, CAB_D)
}

function floor(g: G) {
  const top = (x: number) => x < 20 ? 102 + (20 - x) * 0.9 : x > 380 ? 103 + (x - 380) * 0.85 : kitchenFloor(x)
  checker(g, 0, W, top, { vpx: 200, hy: 50, tile: 1.4, a: '#c83040', b: '#f0e0c8', aLo: '#801828', bLo: '#a09080', tilt: 0.004, far: 5, grout: '#6a3a3a' })
  for (let x = 20; x < 380; x++) dither(g, x, Math.round(kitchenFloor(x)), 1, 3, INK, 0.45)
}

function hatch(g: G) {
  // The dumbwaiter: a wooden frame round a sliding hatch (x 24–48, y 46–74).
  box(g, 24, 46, 26, 30, '#6a3420', '#9a5a30', '#3a1a10')
  rect(g, 27, 50, 20, 22, INK)
  // Brass plate.
  rect(g, 31, 47, 12, 2, GOLD)
  // Bell on a curly bracket, with a pull cord.
  line(g, 52, 46, 56, 44, GOLD_D)
  ovalK(g, 57, 47, 3, 3, GOLD)
  rect(g, 55, 49, 5, 1, GOLD_D)
  line(g, 57, 50, 57, 64, '#e8e4f0')
  ovalK(g, 57, 65, 1, 1, '#ff3b5c')
}

function hatchDoor(g: G, s: GameState) {
  if (s.flags['kitchen.hatchOpen']) {
    rect(g, 28, 51, 18, 20, '#140a08')
    ramp(g, 28, 51, 18, 20, '#3a2010', 0.6, 0)
    // The little lift's rope.
    rect(g, 36, 51, 1, 20, '#8a6a4a')
    rect(g, 28, 51, 18, 3, '#6a3420')
    return
  }
  rect(g, 28, 51, 18, 20, '#8a4a2a')
  for (let y = 53; y < 71; y += 3) rect(g, 28, y, 18, 1, '#6a3420')
  rect(g, 35, 66, 4, 2, GOLD_D)
}

function stove(g: G) {
  const base = Math.round(kitchenFloor(80))
  // Flue pipe to the ceiling.
  rect(g, 76, 10, 7, 36, INK)
  rect(g, 77, 10, 5, 36, '#3a3448')
  rect(g, 77, 10, 1, 36, '#5a5470')
  rect(g, 75, 24, 9, 2, '#2a2438')
  // The range: fat and black.
  polyK(g, [[60, 60], [100, 60], [102, base], [58, base]], '#2a2438')
  rect(g, 61, 61, 38, 2, '#4a4460')
  box(g, 58, 56, 44, 4, '#3a3448', '#6a6488')
  // Oven doors with brass handles.
  box(g, 63, 66, 15, 14, '#3a3448', '#5a5470')
  box(g, 82, 66, 15, 14, '#3a3448', '#5a5470')
  rect(g, 67, 68, 7, 1, GOLD_D); rect(g, 86, 68, 7, 1, GOLD_D)
  box(g, 63, 84, 34, 8, '#3a3448', '#5a5470')
  for (let x = 66; x < 95; x += 4) rect(g, x, 87, 2, 2, INK)
  // A pot and a kettle, both cold.
  box(g, 64, 50, 12, 6, '#5a6a8a', '#8a9ab8')
  rect(g, 62, 51, 2, 1, INK); rect(g, 76, 51, 2, 1, INK)
  ovalK(g, 90, 51, 5, 4, '#b8283c')
  oval(g, 89, 50, 2, 2, '#ff5c7a')
  line(g, 94, 50, 97, 47, '#b8283c')
  line(g, 87, 47, 93, 47, INK)
}

function counter(g: G) {
  const base = Math.round(kitchenFloor(140))
  // Base cabinets (x 108–170), a thick wooden top.
  polyK(g, [[108, 80], [170, 80], [171, base], [107, base]], CAB)
  box(g, 105, 76, 68, 4, '#c07040', '#e09860', '#8a4a2a')
  // The drawer (top left, x 112–138).
  box(g, 112, 83, 26, 7, CAB, CAB_HI, CAB_D)
  rect(g, 122, 86, 6, 1, GOLD)
  box(g, 142, 83, 24, 7, CAB, CAB_HI, CAB_D)
  rect(g, 151, 86, 6, 1, GOLD)
  // Cupboard doors below.
  box(g, 112, 93, 26, base - 96, CAB, CAB_HI, CAB_D)
  box(g, 142, 93, 24, base - 96, CAB, CAB_HI, CAB_D)
  dot(g, 136, 96, GOLD); dot(g, 144, 96, GOLD)
  // A chopping board and a jar of wooden spoons.
  box(g, 144, 72, 18, 3, '#e8c898', '#fff1b0')
  box(g, 114, 68, 6, 8, '#e8e4f0', '#ffffff')
  line(g, 115, 68, 113, 62, '#c07040'); line(g, 117, 68, 118, 61, '#c07040'); line(g, 119, 68, 121, 63, '#c07040')
}

function drawerOpen(g: G, s: GameState) {
  if (!s.flags['kitchen.drawerOpen']) return
  // Pulled out towards us.
  polyK(g, [[110, 82], [140, 82], [142, 92], [108, 92]], '#3a1a10')
  rect(g, 111, 83, 29, 3, '#1a0a08')
  box(g, 108, 90, 34, 4, CAB, CAB_HI, CAB_D)
  rect(g, 122, 91, 6, 1, GOLD)
  // Cutlery and string.
  line(g, 113, 84, 120, 84, '#cfc6ff')
  line(g, 131, 85, 138, 83, '#cfc6ff')
  oval(g, 127, 84, 2, 1, '#e8c898')
  if (!s.flags[F.matchesTaken]) {
    box(g, 121, 83, 5, 3, '#ff3b5c', '#ffd23f')
    rect(g, 122, 84, 3, 1, '#fff4ff')
  }
}

function wallCupboard(g: G) {
  // Above the counter (x 112–166, y 20–54), hung a little askew.
  polyK(g, [[111, 20], [167, 22], [166, 55], [112, 54]], CAB_D)
}

function wallCupboardDoors(g: G, s: GameState) {
  const open = !!s.flags['kitchen.cupboardOpen']
  // Inside: two shelves.
  if (open) {
    rect(g, 113, 22, 52, 31, '#2a1810')
    rect(g, 113, 36, 52, 2, '#6a3420')
    rect(g, 113, 51, 52, 2, '#6a3420')
    // A few tins, a teapot, the oil and the sardines.
    box(g, 118, 29, 5, 7, '#9e1638', '#ff5c7a')
    box(g, 125, 30, 5, 6, '#2f5fd0', '#8fa6ff')
    ovalK(g, 158, 32, 4, 3, '#fff4ff')
    if (!s.flags[F.oilTaken]) {
      // Oil bottle: olive-green, tall, with a cork.
      rect(g, 137, 38, 6, 13, INK)
      rect(g, 138, 41, 4, 10, '#8a9a2a')
      rect(g, 138, 41, 1, 10, '#c8d850')
      rect(g, 139, 38, 2, 3, '#8a9a2a')
      rect(g, 139, 37, 2, 1, '#c07040')
      rect(g, 138, 45, 4, 3, '#fff1b0')
    }
    if (!s.flags['kitchen.sardinesTaken']) {
      box(g, 148, 47, 10, 4, '#c0c8e0', '#ffffff', '#6a7090')
      rect(g, 150, 48, 6, 1, '#2f5fd0')
      dot(g, 152, 49, '#ffd23f')
    }
    // The doors, swung wide.
    polyK(g, [[103, 19], [112, 21], [112, 54], [103, 56]], CAB)
    polyK(g, [[166, 22], [175, 20], [175, 57], [166, 55]], CAB)
    rect(g, 106, 36, 1, 4, GOLD); rect(g, 172, 36, 1, 4, GOLD)
    return
  }
  polyK(g, [[113, 22], [138, 22.5], [138, 53.5], [113, 53]], CAB)
  polyK(g, [[140, 23], [165, 23.5], [165, 54], [140, 53.5]], CAB)
  rect(g, 116, 26, 19, 1, CAB_HI); rect(g, 143, 27, 19, 1, CAB_HI)
  polyK(g, [[117, 28], [134, 28], [134, 49], [117, 49]], CAB, CAB_D)
  polyK(g, [[144, 29], [161, 29], [161, 50], [144, 50]], CAB, CAB_D)
  rect(g, 136, 38, 1, 4, GOLD); rect(g, 142, 38, 1, 4, GOLD)
}

function sink(g: G) {
  const base = Math.round(kitchenFloor(194))
  polyK(g, [[176, 80], [214, 80], [215, base], [175, base]], CAB)
  box(g, 173, 76, 44, 4, '#e8e4f0', '#ffffff', '#9a90b0')
  rect(g, 180, 77, 30, 2, '#6a6290')
  // Tap.
  rect(g, 194, 68, 2, 8, '#cfc6ff')
  rect(g, 194, 68, 6, 2, '#cfc6ff')
  ovalK(g, 192, 70, 1, 1, '#ff3b5c')
  box(g, 180, 84, 30, base - 88, CAB, CAB_HI, CAB_D)
  // A curtain under the sink, gingham.
  for (let y = 84; y < base - 4; y++) for (let x = 180; x < 210; x++) if (((x >> 1) + (y >> 1)) % 2 === 0) dot(g, x, y, '#c83040')
  // Window frame.
  rect(g, 177, 18, 36, 46, INK)
  box(g, 174, 62, 42, 3, '#e8e4f0', '#ffffff')
}

function windowPane(g: G, v: View) {
  stormPane(g, 179, 20, 32, 42, v, 41, '#141a44', '#2a2a6a')
  rect(g, 194, 20, 2, 42, '#e8e4f0')
  rect(g, 179, 40, 32, 2, '#e8e4f0')
  // A potted herb on the sill that has given up.
  box(g, 200, 57, 7, 5, '#c07040', '#e09860')
  line(g, 203, 56, 201, 50, '#8a7a4a'); line(g, 204, 56, 206, 51, '#8a7a4a')
  // Curtain frill.
  for (let x = 177; x < 213; x++) rect(g, x, 18, 1, 3 + ((x >> 1) % 2), (x >> 2) % 2 ? '#c83040' : '#f0e0c8')
}

function freezer(g: G, s: GameState, v: View) {
  const base = Math.round(kitchenFloor(240))
  const thawed = !!s.flags[F.furnaceLit]
  const open = !!s.flags['kitchen.freezerOpen']
  // Body: a tall white upright freezer (x 224–258).
  polyK(g, [[225, 36], [257, 35], [258, base], [224, base]], '#dce8f4')
  if (open) {
    // Inside: shelves, meltwater, the note, maybe the gloves.
    rect(g, 227, 38, 28, base - 42, '#6a8aa8')
    ramp(g, 227, 38, 28, base - 42, '#3a5a78', 0, 0.7)
    rect(g, 227, 56, 28, 1, '#cfe8ff')
    rect(g, 227, 76, 28, 1, '#cfe8ff')
    // The note: DON'T (…FORGET TO DEFROST).
    box(g, 230, 42, 10, 8, '#fff4e0')
    rect(g, 231, 44, 7, 1, '#9e1638'); rect(g, 231, 46, 5, 1, '#6a6290'); rect(g, 231, 48, 6, 1, '#6a6290')
    if (!s.flags[F.glovesTaken]) {
      // Yellow rubber gloves, flopped over the shelf.
      poly(g, [[236, 57], [246, 57], [247, 66], [244, 70], [241, 66], [237, 64]], INK)
      poly(g, [[237, 57], [245, 57], [246, 65], [244, 68], [242, 65], [238, 63]], GOLD)
      poly(g, [[244, 58], [252, 58], [253, 67], [250, 71], [247, 67]], INK)
      poly(g, [[245, 58], [251, 58], [252, 66], [250, 69], [248, 66]], '#ffe060')
      dot(g, 239, 59, '#fff1b0'); dot(g, 247, 60, '#fff1b0')
    }
    // Drips.
    const p = (v.t * 1.3) % 1
    dot(g, 240, 77 + Math.round(p * (base - 80)), '#8fd8ff')
    // The door, swung open to the left.
    polyK(g, [[214, 33], [225, 36], [224, base], [213, base + 2]], '#c8d8e8')
    rect(g, 215, 60, 2, 12, '#9aa8c0')
    return
  }
  rect(g, 226, 37, 31, 1, '#ffffff')
  rect(g, 255, 38, 2, base - 40, '#9aa8c0')
  // Chrome handle and badge.
  rect(g, 228, 58, 2, 14, INK); rect(g, 229, 58, 1, 14, '#e8e4f0')
  rect(g, 238, 40, 10, 3, '#c83040')
  dot(g, 240, 41, '#ffffff'); dot(g, 242, 41, '#ffffff'); dot(g, 244, 41, '#ffffff')
  if (!thawed) {
    // Frost, icicles, and the ice block showing through a frosted window.
    rect(g, 234, 50, 16, 26, INK)
    rect(g, 235, 51, 14, 24, '#8fd8ff')
    dither(g, 235, 51, 14, 24, '#e8f4ff', 0.45)
    rect(g, 238, 60, 4, 6, '#ffd23f')
    rect(g, 242, 55, 4, 4, '#fff4e0')
    dither(g, 225, 36, 34, base - 36, '#ffffff', 0.18)
    for (let x = 226; x < 258; x += 3) {
      const h = 2 + ((x * 7) % 5)
      for (let k = 0; k < h; k++) dot(g, x + (k > h - 2 ? 1 : 0), 36 + k, k < h - 1 ? '#e8f4ff' : '#8fd8ff')
    }
    // Cold breath from the door gap.
    const p = (v.t * 0.4) % 1
    if (p < 0.7) dither(g, 214, base - 6 - Math.round(p * 6), 10, 3, '#cfe8ff', 0.3 * (1 - p))
  } else {
    // Thawed: a porthole of water, and drips round the seal.
    rect(g, 234, 50, 16, 26, INK)
    rect(g, 235, 51, 14, 24, '#3a6a98')
    rect(g, 235, 51, 14, 10, '#6a9ac8')
    for (let i = 0; i < 3; i++) {
      const p = (v.t * 0.8 + i / 3) % 1
      dot(g, 226 + i * 13, 40 + Math.round(p * (base - 44)), '#8fd8ff')
    }
  }
}

function puddle(g: G, s: GameState, v: View) {
  if (!s.flags[F.furnaceLit]) return
  for (let y = 105; y < 114; y++) {
    const t = (y - 109.5) / 4.5
    const hw = 22 * Math.sqrt(Math.max(0, 1 - t * t)) + Math.sin(y * 1.7) * 2
    rect(g, 240 - hw, y, hw * 2, 1, '#5a9ac8')
  }
  const r = (v.t * 1.3) % 1
  oval(g, 240, 109, 2 + r * 8, 1 + r * 2, '#8fd8ff')
  oval(g, 240, 109, 1 + r * 8, r * 2, '#5a9ac8')
}

function fridge(g: G, v: View) {
  const base = Math.round(kitchenFloor(300))
  // A fat 1950s fridge (x 272–328), rounded shoulders, cream and chrome.
  const hum = Math.floor(v.t * 30) % 2
  const bx = 0
  for (let y = 58; y < base; y++) {
    let inset = 0
    if (y < 64) inset = [8, 5, 3, 2, 1, 1][y - 58]!
    rect(g, 271 + inset + bx, y, 58 - inset * 2, 1, INK)
    rect(g, 272 + inset + bx, y, 56 - inset * 2, 1, '#f0e0c8')
  }
  rect(g, 274, 60, 50, 1, '#fff8e8')
  for (let y = 60; y < base - 2; y++) dot(g, 326, y, '#c8b8a0')
  rect(g, 272, 78, 56, 1, '#c8b8a0')
  // Chrome handle and a badge: VOLTVIK FRIGIDOR.
  rect(g, 318, 82, 3, 16, INK); rect(g, 319, 82, 1, 16, '#ffffff')
  rect(g, 318, 66, 3, 8, INK); rect(g, 319, 66, 1, 8, '#ffffff')
  rect(g, 290, 70, 20, 3, '#c83040')
  rect(g, 292, 71, 16, 1, '#ffd23f')
  // Feet and the grille.
  rect(g, 276, base - 6, 48, 5, '#6a6290')
  for (let x = 278; x < 322; x += 3) rect(g, x, base - 5, 1, 3, INK)
  // Hum: squiggles by the motor.
  if (hum) { dot(g, 331, base - 10, '#cfc6ff'); dot(g, 332, base - 11, '#cfc6ff'); dot(g, 333, base - 10, '#cfc6ff') }
  else { dot(g, 331, base - 12, '#cfc6ff'); dot(g, 332, base - 13, '#cfc6ff') }
}

function sideCounter(g: G) {
  const base = Math.round(kitchenFloor(352))
  polyK(g, [[336, 82], [370, 82], [371, base], [335, base]], CAB)
  box(g, 333, 78, 40, 3, '#c07040', '#e09860', '#8a4a2a')
  box(g, 339, 86, 28, base - 90, CAB, CAB_HI, CAB_D)
  rect(g, 351, 90, 4, 1, GOLD)
  // A cat bowl, empty, with "MRS W" on it.
  ovalK(g, 364, 77, 4, 1.5, '#ff8ae0')
  // A spice rack on the wall above.
  box(g, 338, 50, 30, 2, '#6a3420', '#9a5a30')
  for (let x = 340; x < 366; x += 5) box(g, x, 45, 3, 5, ['#c83040', '#ffd23f', '#3fd8b0', '#9a4ff0', '#ff8a3d', '#fff4ff'][((x - 340) / 5) | 0]!, '#ffffff')
}

function pendant(g: G, x: number, v: View) {
  const sw = Math.round(Math.sin(v.t * 0.8 + x) * 1)
  line(g, x, 10, x + sw, 26, '#2a2020')
  polyK(g, [[x + sw - 7, 32], [x + sw + 7, 32], [x + sw + 3, 26], [x + sw - 3, 26]], '#1f7a6e')
  rect(g, x + sw - 6, 31, 12, 1, '#3fb89a')
}

const painterKitchen: RoomPainter = {
  paint(g) {
    walls(g)
    floor(g)
    hatch(g)
    stove(g)
    counter(g)
    wallCupboard(g)
    sink(g)
    sideCounter(g)
    // A calendar, still on September 1987.
    polyK(g, [[256, 18], [270, 19], [269, 32], [255, 31]], '#fff4e0')
    rect(g, 257, 20, 11, 4, '#c83040')
    for (let y = 26; y < 31; y += 2) for (let x = 258; x < 268; x += 2) dot(g, x, y, '#6a6290')
    dot(g, 266, 30, '#c83040')
  },
  ambient: () => '#8a80a8',
  back(g, s, v) {
    hatchDoor(g, s)
    drawerOpen(g, s)
    wallCupboardDoors(g, s)
    windowPane(g, v)
    freezer(g, s, v)
    fridge(g, v)
    puddle(g, s, v)
  },
  front(g, _s, v) {
    pendant(g, 92, v)
    pendant(g, 340, v)
  },
  lights(L, s, v) {
    const sw1 = Math.sin(v.t * 0.8 + 92) * 1
    const sw2 = Math.sin(v.t * 0.8 + 340) * 1
    L(92 + sw1, 36, 80, '#ffe0a0', 0.8)
    L(340 + sw2, 36, 80, '#ffe0a0', 0.75)
    L(200, 60, 60, '#ffe0a0', 0.25)
    L(195, 40, 30, '#8fa6ff', 0.2 + v.flash * 0.7)
    L(37, 60, 18, '#ff8a3d', s.flags['kitchen.hatchOpen'] ? 0.4 : 0.1)
    if (!s.flags[F.furnaceLit]) L(241, 62, 22, '#8fd8ff', 0.3)
  },
  glow(g, _s, v) {
    for (const [x, ph] of [[92, 92], [340, 340]] as const) {
      const sw = Math.round(Math.sin(v.t * 0.8 + ph) * 1)
      rect(g, x + sw - 2, 32, 4, 2, '#fff8e0')
    }
  },
}

export const painter: RoomPainter = painterKitchen
