/**
 * Another Shore II — the seven shots.
 *
 * Each shot is a fixed frame: walking off an edge hard-cuts to the next.
 * Gameplay geometry (`solids`, `hazards`, entry points) is authored once in
 * stage units; the picture is authored twice, as a 320×200 landscape and a
 * 200×320 portrait composition, each with its own horizon and negative
 * space. The stage is placed in the frame by a uniform scale `s` and an
 * anchor (stage y `stageY` at frame y `frameY`); stage x 0 is frame x 0 and
 * the stage spans the frame width, so the figure can never leave the picture
 * except through an edge.
 *
 * Figure scale per shot: 22×52 stage units. s = 0.5 makes it 26 frame units
 * (13 % of the landscape height), s = 0.4 makes it 1/10, and s = 1 in the
 * last shot is the one close-up.
 *
 * Palette indices: 0 sky, 1 far, 2 mid, 3 near, 4 sea, 5 ground, 6 skin,
 * 7 shirt; +8 = lit.
 */
import type { Poly, Shot, Vec, Composition, Solid, Hazard } from './types'

export const LAND_W = 320
export const LAND_H = 200
export const PORT_W = 200
export const PORT_H = 320

export const FIGURE_W = 22
export const FIGURE_H = 52
export const CROUCH_H = 30

const SKY = 0, FAR = 1, MID = 2, NEAR = 3, SEA = 4, GROUND = 5, MOON = 14

function P(c: number, ...pts: Vec[]): Poly {
  return { c, pts }
}

function rect(c: number, x: number, y: number, w: number, h: number): Poly {
  return P(c, [x, y], [x + w, y], [x + w, y + h], [x, y + h])
}

/** A flat disc as a 14-gon (the moon). */
function disc(c: number, cx: number, cy: number, r: number): Poly {
  const pts: Vec[] = []
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2
    pts.push([Math.round((cx + Math.cos(a) * r) * 10) / 10, Math.round((cy + Math.sin(a) * r) * 10) / 10])
  }
  return { c, pts }
}

/** Sky, far-water band and the ground plane below a horizon. */
function planes(W: number, H: number, horizon: number, groundY: number): Poly[] {
  return [rect(SKY, 0, 0, W, horizon), rect(SEA, 0, horizon, W, H - horizon), rect(GROUND, 0, groundY, W, H - groundY)]
}

function comp(
  s: number,
  stageY: number,
  frameY: number,
  back: Poly[],
  front: Poly[],
  extra: Partial<Composition> = {},
): Composition {
  return { s, stageY, frameY, back, front, seaY: undefined, bleedTop: SKY, bleedBottom: GROUND, ...extra }
}

const ground = (x: number, w: number, y: number, h = 200): Solid => ({ x, y, w, h, look: 'ground' })
const slab = (x: number, w: number, y: number, h = 90): Solid => ({ x, y, w, h, look: 'slab' })
const ledge = (x: number, w: number, y: number, h: number): Solid => ({ x, y, w, h, look: 'ledge' })
const hidden = (x: number, w: number, y: number, h: number): Solid => ({ x, y, w, h, look: 'hidden' })

/* ------------------------------------------------------------------ */
/* 0 · the tide pool — the figure surfaces and wades out; sky 70 %.    */
/* ------------------------------------------------------------------ */

const tidePool: Shot = {
  id: 'tide-pool',
  stageW: 640,
  leftWall: true,
  solids: [hidden(0, 270, 326, 80), ground(258, 400, 300)],
  hazards: [],
  enterLeft: [70, 326],
  enterRight: [600, 300],
  abyssY: 460,
  waterY: 300,
  land: comp(
    0.5, 300, 172,
    [
      ...planes(LAND_W, LAND_H, 140, 172),
      disc(MOON, 262, 42, 10),
      // far cape, right
      P(FAR, [196, 140], [232, 126], [268, 118], [300, 122], [320, 132], [320, 140]),
      // the shore plane sloping into the pool, and the wet beach behind the feet
      P(GROUND, [118, 200], [134, 172], [320, 172], [320, 200]),
      P(13, [134, 172], [152, 167], [240, 165], [320, 166], [320, 172]),
    ],
    [
      // near rock, lower left, in front of the pool
      P(NEAR, [0, 200], [0, 186], [18, 181], [36, 190], [34, 200]),
      // near rock, lower right
      P(NEAR, [244, 200], [258, 188], [292, 184], [320, 191], [320, 200]),
    ],
    { seaY: 140 },
  ),
  port: comp(
    0.3125, 300, 250,
    [
      ...planes(PORT_W, PORT_H, 200, 250),
      disc(MOON, 178, 30, 7),
      P(FAR, [118, 200], [146, 188], [176, 184], [200, 190], [200, 200]),
      P(GROUND, [72, 320], [84, 250], [200, 250], [200, 320]),
      P(13, [84, 250], [98, 246], [150, 244], [200, 245], [200, 250]),
    ],
    [
      P(NEAR, [0, 320], [0, 300], [14, 295], [26, 304], [24, 320]),
      P(NEAR, [148, 320], [158, 302], [184, 298], [200, 306], [200, 320]),
    ],
    { seaY: 200 },
  ),
}

/* ------------------------------------------------------------------ */
/* 1 · the arch — a black arch fills the left third; a low lintel.    */
/* ------------------------------------------------------------------ */

const lintel: Hazard[] = []

const arch: Shot = {
  id: 'arch',
  stageW: 800,
  solids: [ground(0, 800, 300), hidden(430, 50, 200, 60)],
  hazards: lintel,
  enterLeft: [60, 300],
  enterRight: [786, 300],
  abyssY: 460,
  land: comp(
    0.4, 300, 176,
    [
      ...planes(LAND_W, LAND_H, 104, 150),
      disc(MOON, 270, 34, 11),
      // far monolith, flat-topped, leaning
      P(FAR, [206, 150], [214, 52], [222, 44], [252, 40], [258, 48], [262, 150]),
      // mid rocks beyond the path
      P(MID, [120, 150], [130, 130], [150, 122], [176, 128], [190, 118], [204, 126], [210, 150]),
      // low arch: two rock supports behind, the passage open between them
      P(MID, [154, 176], [158, 148], [170, 140], [172, 176]),
      P(MID, [204, 176], [206, 142], [216, 148], [220, 176]),
    ],
    [
      // the fallen lintel over the passage (collider stage 430..480, underside 260 → frame 160);
      // it starts right of where a standing figure is stopped, so the figure is never hidden
      P(NEAR, [174, 144], [210, 140], [212, 158], [174, 160]),
      // the arch: a rock mass on the left third with an arched opening — left leg, lintel, right leg
      P(NEAR, [0, 200], [0, 0], [40, 0], [46, 44], [42, 90], [34, 130], [22, 170], [14, 200]),
      P(NEAR, [40, 0], [128, 0], [124, 26], [114, 44], [100, 54], [84, 50], [68, 56], [54, 50], [46, 44]),
      P(NEAR, [100, 54], [114, 44], [118, 80], [112, 120], [116, 160], [112, 200], [100, 200], [104, 150], [98, 110], [102, 80]),
      // near rock at the right foot
      P(NEAR, [286, 200], [296, 190], [320, 186], [320, 200]),
    ],
    { seaY: 104 },
  ),
  port: comp(
    0.25, 300, 262,
    [
      ...planes(PORT_W, PORT_H, 190, 236),
      disc(MOON, 158, 60, 9),
      P(FAR, [120, 236], [126, 108], [134, 100], [156, 98], [160, 106], [164, 236]),
      P(MID, [78, 236], [84, 220], [100, 214], [116, 218], [126, 236]),
      P(MID, [100, 262], [102, 244], [108, 240], [110, 262]),
      P(MID, [126, 262], [127, 240], [133, 244], [134, 262]),
    ],
    [
      P(NEAR, [108, 242], [130, 240], [131, 252], [108, 253]),
      P(NEAR, [0, 320], [0, 0], [24, 0], [28, 70], [26, 140], [20, 200], [13, 260], [8, 320]),
      P(NEAR, [24, 0], [78, 0], [76, 50], [70, 80], [62, 96], [52, 90], [42, 98], [34, 90], [28, 70]),
      P(NEAR, [62, 96], [70, 80], [72, 140], [68, 200], [70, 260], [68, 320], [60, 320], [63, 240], [59, 180], [62, 130]),
      P(NEAR, [176, 320], [184, 308], [200, 304], [200, 320]),
    ],
    { seaY: 190 },
  ),
}

/* ------------------------------------------------------------------ */
/* 2 · the causeway — broken slabs over the sea, the moon centred.    */
/* ------------------------------------------------------------------ */

const causeway: Shot = {
  id: 'causeway',
  stageW: 640,
  solids: [slab(0, 120, 300), slab(190, 110, 300), slab(370, 100, 312, 78), ground(540, 100, 300)],
  hazards: [{ kind: 'tide', x: 370, w: 100, y: 312, period: 4.5, coverFrom: 3.0, coverTo: 4.0, restY: 340 }],
  enterLeft: [14, 300],
  enterRight: [626, 300],
  abyssY: 420,
  land: comp(
    0.5, 300, 172,
    [
      rect(SKY, 0, 0, LAND_W, 128),
      disc(MOON, 160, 56, 16),
      rect(SEA, 0, 128, LAND_W, 72),
      P(FAR, [0, 128], [0, 112], [28, 106], [66, 118], [92, 128]),
      P(FAR, [248, 128], [278, 116], [320, 110], [320, 128]),
    ],
    [P(NEAR, [0, 200], [0, 191], [38, 187], [52, 200])],
    { seaY: 128, bleedBottom: SEA },
  ),
  port: comp(
    0.3125, 300, 248,
    [
      rect(SKY, 0, 0, PORT_W, 200),
      disc(MOON, 100, 84, 13),
      rect(SEA, 0, 200, PORT_W, 120),
      P(FAR, [0, 200], [0, 188], [20, 184], [44, 194], [58, 200]),
      P(FAR, [154, 200], [176, 190], [200, 186], [200, 200]),
    ],
    [P(NEAR, [0, 320], [0, 308], [28, 304], [40, 320])],
    { seaY: 200, bleedBottom: SEA },
  ),
}

/* ------------------------------------------------------------------ */
/* 3 · the stair — a cliff face, descending ledges, the sea below.    */
/* ------------------------------------------------------------------ */

const stair: Shot = {
  id: 'stair',
  stageW: 640,
  solids: [ledge(0, 140, 180, 44), ledge(170, 90, 230, 44), ledge(290, 90, 280, 44), ledge(400, 100, 330, 44), ground(520, 120, 370, 200)],
  hazards: [],
  enterLeft: [14, 180],
  enterRight: [626, 370],
  abyssY: 470,
  land: comp(
    0.5, 370, 160,
    [
      rect(SKY, 0, 0, LAND_W, 120),
      rect(SEA, 0, 120, LAND_W, 80),
      P(FAR, [200, 120], [236, 112], [284, 108], [320, 114], [320, 120]),
      // the cliff: one mass whose silhouette is the staircase; the ledges are cut into it
      P(MID, [0, 0], [0, 200], [320, 200], [320, 158], [258, 158], [258, 138], [198, 138], [198, 113], [143, 113], [143, 88], [83, 88], [83, 63], [36, 63], [36, 0]),
      // crevices between the steps
      P(NEAR, [70, 65], [85, 90], [86, 200], [71, 200]),
      P(NEAR, [130, 90], [145, 115], [146, 200], [131, 200]),
      P(NEAR, [190, 115], [200, 140], [201, 200], [191, 200]),
      P(NEAR, [250, 140], [260, 160], [261, 200], [251, 200]),
    ],
    [P(NEAR, [0, 200], [0, 192], [60, 188], [130, 194], [200, 190], [320, 196], [320, 200])],
    { seaY: 120, bleedBottom: SEA },
  ),
  port: comp(
    0.3125, 370, 256,
    [
      rect(SKY, 0, 0, PORT_W, 180),
      rect(SEA, 0, 180, PORT_W, 140),
      P(FAR, [120, 180], [150, 172], [186, 170], [200, 176], [200, 180]),
      P(MID, [0, 0], [0, 320], [200, 320], [200, 255], [161, 255], [161, 243], [124, 243], [124, 227], [90, 227], [90, 211], [52, 211], [52, 196], [22, 196], [22, 0]),
      P(NEAR, [44, 197], [53, 212], [54, 320], [45, 320]),
      P(NEAR, [81, 212], [91, 228], [92, 320], [82, 320]),
      P(NEAR, [119, 228], [125, 244], [126, 320], [120, 320]),
      P(NEAR, [156, 244], [162, 256], [163, 320], [157, 320]),
    ],
    [P(NEAR, [0, 320], [0, 310], [48, 306], [110, 312], [200, 308], [200, 320])],
    { seaY: 180, bleedBottom: SEA },
  ),
}

/* ------------------------------------------------------------------ */
/* 4 · the beast — a silhouette on a far rock turns its head.         */
/* ------------------------------------------------------------------ */

const beast: Shot = {
  id: 'beast',
  stageW: 640,
  solids: [ground(0, 640, 300)],
  hazards: [],
  enterLeft: [14, 300],
  enterRight: [626, 300],
  abyssY: 460,
  beast: {
    turnX: 300,
    headAway: [P(NEAR, [240, 78], [246, 66], [256, 68], [254, 82])],
    headTurned: [
      P(NEAR, [236, 80], [237, 64], [250, 62], [252, 80]),
      P(MOON, [240, 70], [243, 70], [243, 72], [240, 72]),
      P(MOON, [246, 70], [249, 70], [249, 72], [246, 72]),
    ],
  },
  land: comp(
    0.5, 300, 176,
    [
      ...planes(LAND_W, LAND_H, 110, 150),
      // the far rock in the sea, with the beast on it
      P(MID, [166, 150], [178, 98], [214, 84], [250, 90], [264, 150]),
      P(NEAR, [196, 96], [204, 78], [226, 72], [240, 80], [246, 96]),
      P(MID, [270, 150], [286, 134], [320, 128], [320, 150]),
    ],
    [
      P(NEAR, [0, 200], [0, 184], [20, 179], [42, 188], [46, 200]),
      P(NEAR, [300, 200], [306, 192], [320, 190], [320, 200]),
    ],
    { seaY: 110 },
  ),
  port: comp(
    0.3125, 300, 262,
    [
      ...planes(PORT_W, PORT_H, 190, 236),
      P(MID, [96, 236], [106, 182], [134, 170], [160, 176], [170, 236]),
      P(NEAR, [118, 180], [124, 164], [142, 158], [154, 166], [158, 180]),
      P(MID, [172, 236], [184, 224], [200, 220], [200, 236]),
    ],
    [
      P(NEAR, [0, 320], [0, 306], [16, 302], [32, 310], [34, 320]),
      P(NEAR, [186, 320], [190, 312], [200, 310], [200, 320]),
    ],
    { seaY: 190 },
  ),
}

/* the beast's head in portrait: same shapes, shifted */
const shift = (polys: Poly[], dx: number, dy: number, k: number): Poly[] =>
  polys.map((p) => ({ c: p.c, pts: p.pts.map(([x, y]) => [Math.round((x - 220) * k + dx), Math.round((y - 80) * k + dy)] as Vec) }))
export const BEAST_PORT_HEAD = {
  away: shift(beast.beast!.headAway, 140, 168, 0.85),
  turned: shift(beast.beast!.headTurned, 140, 168, 0.85),
}

/* ------------------------------------------------------------------ */
/* 5 · the tower base — huge; three ledges up; the cracked overhang.  */
/* ------------------------------------------------------------------ */

const towerBase: Shot = {
  id: 'tower-base',
  stageW: 800,
  solids: [ground(0, 800, 300), ledge(500, 80, 260, 40), ledge(600, 80, 220, 80), ledge(700, 100, 180, 120)],
  hazards: [{ kind: 'rock', triggerX: 290, x: 320, w: 45, h: 30, hangY: 120, groundY: 300 }],
  enterLeft: [14, 300],
  enterRight: [786, 180],
  abyssY: 460,
  lamps: { land: [[252, 34], [252, 58], [252, 82]], port: [[160, 70], [160, 100], [160, 130]], size: 5 },
  land: comp(
    0.4, 300, 176,
    [
      ...planes(LAND_W, LAND_H, 118, 150),
      disc(MOON, 60, 30, 9),
      P(FAR, [0, 118], [0, 106], [40, 100], [80, 110], [96, 118]),
      // the overhang, top left, with the cracked underside
      P(MID, [0, 0], [0, 78], [40, 88], [100, 100], [126, 104], [150, 104], [170, 88], [176, 40], [160, 0]),
      P(10, [126, 102], [148, 102], [147, 104], [127, 104]),
      // the tower: frame x 208..320, full height; a black mass with a moonlit face and a plinth
      P(NEAR, [206, 200], [210, 0], [320, 0], [320, 200]),
      P(MID, [206, 200], [210, 0], [222, 0], [220, 200]),
      P(10, [206, 200], [210, 0], [214, 0], [212, 200]),
      P(MID, [196, 176], [206, 150], [236, 150], [244, 176]),
    ],
    [
      P(NEAR, [0, 200], [0, 190], [30, 186], [60, 194], [64, 200]),
    ],
    { seaY: 118 },
  ),
  port: comp(
    0.25, 300, 270,
    [
      ...planes(PORT_W, PORT_H, 200, 250),
      disc(MOON, 40, 40, 8),
      P(FAR, [0, 200], [0, 190], [26, 184], [52, 194], [60, 200]),
      P(MID, [0, 0], [0, 196], [40, 212], [78, 225], [94, 225], [102, 206], [98, 140], [80, 80], [60, 0]),
      P(10, [78, 224], [92, 224], [91, 225.5], [79, 225.5]),
      P(NEAR, [128, 320], [132, 0], [200, 0], [200, 320]),
      P(MID, [128, 320], [132, 0], [140, 0], [138, 320]),
      P(10, [128, 320], [132, 0], [135, 0], [133, 320]),
      P(MID, [122, 270], [128, 250], [146, 250], [150, 270]),
    ],
    [P(NEAR, [0, 320], [0, 310], [20, 306], [40, 314], [42, 320])],
    { seaY: 200 },
  ),
}

/* ------------------------------------------------------------------ */
/* 6 · the lamp — the one close shot.                                 */
/* ------------------------------------------------------------------ */

const lamp: Shot = {
  id: 'lamp',
  stageW: 320,
  solids: [ground(0, 320, 250), hidden(262, 60, 0, 250)],
  hazards: [],
  enterLeft: [16, 250],
  enterRight: [240, 250],
  abyssY: 420,
  land: comp(
    1, 250, 150,
    [
      rect(SKY, 0, 0, LAND_W, 122),
      disc(MOON, 118, 30, 14),
      rect(SEA, 0, 122, LAND_W, 30),
      P(FAR, [0, 122], [0, 116], [30, 112], [70, 118], [90, 122]),
      // the tower shaft, right
      P(MID, [262, 150], [264, 0], [320, 0], [320, 150]),
      P(10, [262, 150], [264, 0], [270, 0], [268, 150]),
      // the lamp post (stage x 200)
      rect(MID, 197, 100, 6, 50),
      P(MID, [186, 100], [214, 100], [210, 96], [190, 96]),
    ],
    [P(NEAR, [0, 200], [0, 188], [120, 184], [320, 182], [320, 200])],
    { seaY: 122 },
  ),
  port: comp(
    0.625, 250, 236,
    [
      rect(SKY, 0, 0, PORT_W, 206),
      disc(MOON, 130, 110, 12),
      rect(SEA, 0, 206, PORT_W, 30),
      P(FAR, [0, 206], [0, 200], [24, 196], [50, 202], [64, 206]),
      P(MID, [164, 236], [166, 0], [200, 0], [200, 236]),
      P(10, [164, 236], [166, 0], [170, 0], [168, 236]),
      rect(MID, 123, 205, 4, 31),
      P(MID, [116, 205], [134, 205], [131, 202], [119, 202]),
    ],
    [P(NEAR, [0, 320], [0, 306], [80, 302], [200, 300], [200, 320])],
    { seaY: 206 },
  ),
}

/** The lamp head, drawn by the renderer in the beacon colour (frame units). */
export const LAMP_HEAD = {
  land: P(NEAR, [188, 84], [212, 84], [214, 98], [186, 98]),
  port: P(NEAR, [117, 194], [133, 194], [134, 203], [116, 203]),
}

export const SHOTS: readonly Shot[] = [tidePool, arch, causeway, stair, beast, towerBase, lamp]

/** The three beacons: a stranded lamp post, the stair landing, the lamp. */
export const BEACONS: readonly { shot: number; x: number; y: number }[] = [
  { shot: 0, x: 580, y: 300 },
  { shot: 3, x: 605, y: 370 },
  { shot: 6, x: 200, y: 250 },
]

export const START: Vec = [70, 326]
/** In attract mode the loop cuts to black once the figure has climbed out. */
export const ATTRACT_END_X = 470
