/**
 * Neon Shrine — character, item, object, FX and HUD pixel art.
 *
 * Every sprite is a string map: one char per logical pixel, '.' is
 * transparent, every other char is a key of PAL. The renderer builds a
 * canvas per sprite once and places it with its bottom-centre pixel at the
 * entity's feet; 'side' sprites face right and are mirrored for left.
 *
 * Hand-drawn maps are written out below; a few families (hero frames,
 * directional variants, the boss's TV static, explosion rings) are composed
 * by small deterministic helpers so the variants stay consistent. All
 * designs are original.
 */

import { WILD_RAW } from './spritesWild'
import { BEACH_RAW } from './spritesBeach'

export interface SpriteDef { rows: string[] }

export const PAL: Record<string, string> = {
  k: '#0b0616', // outline
  K: '#1c1030', // dark shade
  w: '#fff4ff',
  W: '#cfc6ff', // pale lavender
  g: '#8f86b8',
  G: '#5a5285',
  c: '#2ff3ff', // cyan
  C: '#1a9fc4',
  b: '#2f5fd0',
  B: '#1a2f78',
  p: '#ff2fa0', // pink
  P: '#b01874',
  m: '#ff8ae0',
  v: '#9a4ff0', // violet
  V: '#54259e',
  y: '#ffd23f', // gold
  Y: '#c4861c',
  o: '#ff8a3d',
  r: '#ff3b5c',
  R: '#9e1638',
  s: '#f5c3a8', // skin
  S: '#c98576',
  h: '#3a1a4a', // hair
  H: '#7a3a8a',
  n: '#6a4432',
  N: '#3a2418',
  l: '#b6ff4a', // lime
  L: '#4f9a2a',
  t: '#3fd8b0', // teal
  T: '#1f7a6e',
  // additions
  u: '#2a1f4a', // deep violet-grey (stone shadow, static)
  e: '#fff1b0', // pale gold highlight
  a: '#5b2a1c', // dark clay
  i: '#b0543a', // clay
  j: '#e07a4e', // clay light
  // Wildwood additions (spritesWild*.ts)
  d: '#a8876a', // hide tan (troll belly, owl face, basket light)
  f: '#4e7a3c', // moss / felt green
  F: '#2b4a28', // dark moss / felt shadow
  q: '#c4fbff', // pale wind cyan (Mistral's bands)
  x: '#8a7c68', // troll skin, stone grey-brown
  X: '#574a3c', // troll skin shadow
  // Hero-only twins, so Mini World's clothes can recolour them apart (render/heroColors.ts)
  E: '#fff4ff', // the hero's shoes (w elsewhere on the hero is the shirt's stripe)
  M: '#ff2fa0', // the hero's open mouth (p elsewhere on the hero is the headband)
}

// ---------------------------------------------------------------------------
// Helpers (pure, deterministic)
// ---------------------------------------------------------------------------

type Rows = string[]

/** Replace single pixels: [x, y, ch] triples. */
function edit(src: Rows, ...ops: Array<[number, number, string]>): Rows {
  const out = src.map(r => r.split(''))
  for (const [x, y, ch] of ops) out[y]![x] = ch
  return out.map(r => r.join(''))
}

/** Replace whole rows starting at `y`. */
function rowsAt(src: Rows, y: number, rows: Rows): Rows {
  const out = src.slice()
  rows.forEach((r, i) => { out[y + i] = r })
  return out
}

function mirror(src: Rows): Rows {
  return src.map(r => r.split('').reverse().join(''))
}

function swapChars(src: Rows, map: Record<string, string>): Rows {
  return src.map(r => r.split('').map(ch => map[ch] ?? ch).join(''))
}

/** Rotate 90° clockwise. */
function rotCW(src: Rows): Rows {
  const h = src.length
  const w = src[0]!.length
  const out: string[] = []
  for (let x = 0; x < w; x++) {
    let row = ''
    for (let y = h - 1; y >= 0; y--) row += src[y]![x]
    out.push(row)
  }
  return out
}

/** Shift every pixel down by n rows (top filled transparent, bottom dropped). */
function shiftDown(src: Rows, n: number): Rows {
  const w = src[0]!.length
  const blank = '.'.repeat(w)
  return [...Array(n).fill(blank), ...src.slice(0, src.length - n)]
}

function blank(w: number, h: number): string[][] {
  return Array.from({ length: h }, () => Array(w).fill('.'))
}

function join(grid: string[][]): Rows {
  return grid.map(r => r.join(''))
}

/** Nearest-neighbour shrink of a sprite into a w×h frame, bottom-centred at `by`. */
function shrink(src: Rows, scale: number, w: number, h: number, cy: number): Rows {
  const sw = src[0]!.length
  const sh = src.length
  const dw = Math.max(1, Math.round(sw * scale))
  const dh = Math.max(1, Math.round(sh * scale))
  const g = blank(w, h)
  const ox = Math.floor((w - dw) / 2)
  const oy = Math.round(cy - dh / 2)
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const ch = src[Math.floor((y + 0.5) / scale)]?.[Math.floor((x + 0.5) / scale)] ?? '.'
      const gx = ox + x
      const gy = oy + y
      if (ch !== '.' && gx >= 0 && gx < w && gy >= 0 && gy < h) g[gy]![gx] = ch
    }
  }
  return join(g)
}

/** Tiny deterministic hash for procedural texture (static, smoke). */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/**
 * Concentric disc: `rings` from outside in, each [radius, char]. Pixels
 * with a hash below `holes` of their ring are left out (for smoke).
 */
function disc(size: number, cx: number, cy: number, rings: Array<[number, string, number?]>, seed = 1): Rows {
  const g = blank(size, size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy)
      for (let i = rings.length - 1; i >= 0; i--) {
        const [r, ch, holes] = rings[i]!
        if (d <= r) {
          if (!holes || hash(x, y, seed + i) >= holes) g[y]![x] = ch
          break
        }
      }
    }
  }
  return join(g)
}

/** Draw a 1-px outline ('k') around every opaque pixel (4-neighbour). */
function outline(src: Rows, ch = 'k'): Rows {
  const h = src.length
  const w = src[0]!.length
  const g = src.map(r => r.split(''))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y]![x] !== '.') continue
      const n = [src[y - 1]?.[x], src[y + 1]?.[x], src[y]![x - 1], src[y]![x + 1]]
      if (n.some(c => c !== undefined && c !== '.' && c !== ch)) g[y]![x] = ch
    }
  }
  return join(g)
}

// ---------------------------------------------------------------------------
// Hero — composed from head / torso / legs bands so every frame shares
// the same face and outfit.
// ---------------------------------------------------------------------------

const HEAD_DOWN: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kHHhhhhk....',
  '...kHhhhhhhhk...',
  '...kpppppppppk..',
  '...khsssssshkpk.',
  '...kssksskssk.pk',
  '....ksSssSsk..k.',
]
const TORSO_DOWN: Rows = [
  '...kkcCwwCckk...',
  '..kCccCwwCccCk..',
  '..kCccCwwCccCk..',
  '..kskCcyycCksk..',
]
const LEGS_DOWN: Rows = [
  '...kBBBBBBBBk...',
  '...kBBBkkBBBk...',
  '...kEEk..kEEk...',
  '...kkkk..kkkk...',
]
const LEGS_DOWN_W1: Rows = [
  '...kBBBBBBBBk...',
  '...kBBBkkEEEk...',
  '...kEEEk.kkkk...',
  '...kkkkk........',
]

const heroDown0 = [...HEAD_DOWN, ...TORSO_DOWN, ...LEGS_DOWN]
// Walk: one foot lifted, the opposite hand swings forward (up a row).
const heroDown1 = edit([...HEAD_DOWN, ...TORSO_DOWN, ...LEGS_DOWN_W1],
  [12, 10, 's'], [12, 11, 'k'], [13, 11, '.'], [13, 10, 'k'])
const heroDown2 = edit([...HEAD_DOWN, ...TORSO_DOWN, ...mirror(LEGS_DOWN_W1)],
  [3, 10, 's'], [3, 11, 'k'], [2, 11, '.'], [2, 10, 'k'])

const HEAD_UP: Rows = [
  '................',
  '.....kkkkkk.....',
  '....khHHhhhk....',
  '...khHhhhhhhk...',
  '...kppppppppk...',
  '...khhhppHhhk...',
  '...khhhphphhk...',
  '....khhphphk....',
]
const TORSO_UP: Rows = [
  '...kkccccccCk...',
  '..kCccccccccCk..',
  '..kCccccccCCCk..',
  '..kskCCCCCCksk..',
]
const heroUp0 = [...HEAD_UP, ...TORSO_UP, ...LEGS_DOWN]
const heroUp1 = edit([...HEAD_UP, ...TORSO_UP, ...LEGS_DOWN_W1],
  [3, 10, 's'], [3, 11, 'k'], [2, 11, '.'], [2, 10, 'k'])
const heroUp2 = edit([...HEAD_UP, ...TORSO_UP, ...mirror(LEGS_DOWN_W1)],
  [12, 10, 's'], [12, 11, 'k'], [13, 11, '.'], [13, 10, 'k'])

const HEAD_SIDE: Rows = [
  '................',
  '.....kkkkk......',
  '....kHHhhhk.....',
  '...kHhhhhhhk....',
  '..kpppppppppk...',
  '.kpkhhhsssssk...',
  '.kp.khhssskssk..',
  '..k..khsSssSk...',
]
const TORSO_SIDE: Rows = [
  '.....kkCcckk....',
  '....kCcccCcck...',
  '....kCccCCck....',
  '....kCcCsk......',
]
const LEGS_SIDE: Rows = [
  '.....kBBBBk.....',
  '.....kBBBBk.....',
  '.....kEEEEEk....',
  '.....kkkkkkk....',
]
const LEGS_SIDE_W1: Rows = [
  '.....kBBBBk.....',
  '....kBBkkBBk....',
  '...kEEEk.kEEEk..',
  '...kkkkk.kkkkk..',
]
const LEGS_SIDE_W2: Rows = [
  '.....kBBBBk.....',
  '.....kBBBk......',
  '....kEEEEEk.....',
  '....kkkkkkk.....',
]
const heroSide0 = [...HEAD_SIDE, ...TORSO_SIDE, ...LEGS_SIDE]
// Arm swings back on one step, forward on the other.
const heroSide1 = rowsAt([...HEAD_SIDE, ...TORSO_SIDE, ...LEGS_SIDE_W1], 10, [
  '...kkCcCCck.....',
  '...ksCcCck......',
])
const heroSide2 = rowsAt([...HEAD_SIDE, ...TORSO_SIDE, ...LEGS_SIDE_W2], 10, [
  '....kCccCCCk....',
  '....kCcCkcsk....',
])

// Attack poses: the arm reaches toward the blade.
const heroDownAtk = rowsAt(heroDown0, 10, [
  '..kCcCcwwcCcCk..',
  '..kCCcsssscCCk..',
  '...kBBkssskBk...',
])
const heroUpAtk = edit(rowsAt(heroUp0, 8, [
  '...kkCccccCkkk..',
  '..kCccccccccCsk.',
  '..kCcCccccCcCk..',
  '..kskccccccck...',
]), [12, 5, 'k'], [13, 5, 'k'], [12, 6, 'C'], [13, 6, 's'], [14, 6, 'k'], [12, 7, 'C'], [13, 7, 'C'], [14, 7, 'k'])
const heroSideAtk = rowsAt(heroSide0, 8, [
  '.....kkCcckk....',
  '....kCcccCCCCsk.',
  '....kCccCkkkkk..',
  '....kCcCck......',
])

// Carrying: both arms up beside the head, hands above it.
function carryArms(src: Rows, wideBody: boolean): Rows {
  let r = edit(src,
    [2, 0, 'k'], [3, 0, 'k'], [12, 0, 'k'], [13, 0, 'k'],
    [2, 1, 's'], [3, 1, 'k'], [12, 1, 'k'], [13, 1, 's'],
    [1, 1, 'k'], [14, 1, 'k'],
    [1, 2, 'k'], [2, 2, 'C'], [13, 2, 'C'], [14, 2, 'k'],
    [1, 3, 'k'], [2, 3, 'c'], [13, 3, 'c'], [14, 3, 'k'],
    [1, 4, 'k'], [2, 4, 'c'], [13, 4, 'c'], [14, 4, 'k'],
    [1, 5, 'k'], [2, 5, 'C'], [13, 5, 'C'], [14, 5, 'k'],
    [2, 6, 'k'], [13, 6, 'k'],
  )
  if (wideBody) {
    r = edit(r, [2, 9, '.'], [2, 10, '.'], [2, 11, '.'], [13, 9, '.'], [13, 10, '.'], [13, 11, '.'],
      [3, 9, 'k'], [3, 10, 'k'], [3, 11, 'k'], [12, 9, 'k'], [12, 10, 'k'], [12, 11, 'k'])
  }
  return r
}
const heroDownCarry0 = carryArms(heroDown0, true)
const heroDownCarry1 = carryArms([...HEAD_DOWN, ...TORSO_DOWN, ...LEGS_DOWN_W1], true)
const heroUpCarry0 = carryArms(heroUp0, true)
const heroUpCarry1 = carryArms([...HEAD_UP, ...TORSO_UP, ...mirror(LEGS_DOWN_W1)], true)
const SIDE_CARRY_TORSO: Rows = [
  '.....kkCcckk....',
  '....kCcccCck....',
  '....kCcccCk.....',
  '....kCcCCk......',
]
const sideCarryHead = edit(HEAD_SIDE, [9, 0, 'k'], [10, 0, 'k'], [9, 1, 's'], [10, 1, 's'], [11, 1, 'k'],
  [11, 2, 'C'], [12, 2, 'k'], [12, 3, 'k'])
const heroSideCarry0 = [...sideCarryHead, ...SIDE_CARRY_TORSO, ...LEGS_SIDE]
const heroSideCarry1 = [...sideCarryHead, ...SIDE_CARRY_TORSO, ...LEGS_SIDE_W1]

// Pushing: body lowered a pixel, hands flat against the block.
const heroDownPush = rowsAt(shiftDown(heroDown0, 1), 11, [
  '..kCCcsssscCCk..',
  '..kkBsskssBkk...',
  '...kBBBkkBBBk...',
  '..kEEEk..kEEEk..',
  '..kkkkk..kkkkk..',
])
const heroUpPush = rowsAt(shiftDown(heroUp0, 1), 8, [
  '..ks.kkCcccCkk..',
])
const heroUpPushFixed = edit(heroUpPush, [2, 8, 'k'], [3, 8, 's'], [12, 8, 's'], [13, 8, 'k'])
const heroSidePush = rowsAt(edit(shiftDown(heroSide0, 0), [13, 6, '.']), 8, [
  '.....kkCcckk....',
  '....kCcccCCCsk..',
  '....kCccCCCCsk..',
  '....kCcCckkkk...',
  '....kBBBBk......',
  '...kBBBBk.......',
  '..kEEEkBBk......',
  '..kkkkkEEEk.....',
])

const heroGet = [
  '..ks........sk..',
  '..kCk.kkkk.kCk..',
  '..kCkkHhhhkkCk..',
  '..kCkHhhhhhkCk..',
  '..kckppppppkck..',
  '..kckhsssshkck..',
  '..kCkskssksCk...',
  '...kkssMMssk....',
  '...kkCcwwcCk....',
  '...kCcCwwCcCk...',
  '...kCcCwwCcCk...',
  '...kkccyycckk...',
  '...kBBBBBBBBk...',
  '...kBBBkkBBBk...',
  '...kEEk..kEEk...',
  '...kkkk..kkkk...',
]

const heroHurt = rowsAt(edit(heroDown0, [6, 6, 'S'], [9, 6, 'S'], [5, 6, 'k'], [10, 6, 'k'],
  [7, 7, 'k'], [8, 7, 'k']), 8, [
  '.k.kkCcwwcCkk.k.',
  '.skCccCwwCccCks.',
  '..kkcCcwwcCckk..',
  '...kkccyycckk...',
])

const heroDead = (() => {
  // Lying on the ground: the stand pose turned on its side, pushed to the floor.
  const r = rotCW(heroDown0)
  // rotCW puts the head on the right; sit the body on the bottom row.
  const g = blank(16, 16)
  let bottom = -1
  r.forEach((row, y) => { if (row.replace(/\./g, '').length) bottom = Math.max(bottom, y) })
  const off = 15 - bottom
  r.forEach((row, y) => {
    const ty = y + off
    if (ty < 0 || ty > 15) return
    for (let x = 0; x < 16; x++) if (row[x] !== '.') g[ty]![x] = row[x]!
  })
  return join(g)
})()

const heroFall0 = shrink(heroDown0, 0.75, 16, 16, 10)
const heroFall1 = shrink(heroDown0, 0.5, 16, 16, 11)
const heroFall2 = shrink(heroDown0, 0.25, 16, 16, 12)

// ---------------------------------------------------------------------------
// Sword blades
// ---------------------------------------------------------------------------

const swordV: Rows = [
  '...w...',
  '..cwc..',
  '..cwC..',
  '..cwC..',
  '..cwC..',
  '..cwC..',
  '..cwC..',
  '..cwC..',
  '..cwC..',
  '.kcwCk.',
  'yYYyYYy',
  '.kYyYk.',
  '...n...',
  '..kyk..',
]
const swordH = rotCW(swordV)
const swordD = (() => {
  const g = blank(12, 12)
  // Blade from (3,8) up to the tip (11,0): white core, cyan edges.
  for (let i = 0; i <= 8; i++) {
    const x = 3 + i
    const y = 8 - i
    g[y]![x] = 'w'
    if (i < 8) {
      if (x + 1 < 12) g[y]![x + 1] = 'c'
      if (y + 1 < 12) g[y + 1]![x] = 'C'
    }
  }
  g[0]![11] = 'w'
  // Cross-guard perpendicular to the blade, hilt and pommel.
  g[7]![1] = 'y'; g[8]![2] = 'Y'; g[9]![3] = 'Y'; g[10]![4] = 'y'
  g[6]![1] = 'k'; g[10]![5] = 'k'
  g[9]![2] = 'n'; g[10]![1] = 'n'
  g[11]![0] = 'y'
  return join(g)
})()

// The Arc Blade: same shapes, a white-hot blade with gold and violet edges.
const ARC: Record<string, string> = { c: 'y', C: 'v' }
const sword2V = swapChars(swordV, ARC)
const sword2H = swapChars(swordH, ARC)
const sword2D = swapChars(swordD, ARC)

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

const itemSword: Rows = [
  '.............kk.',
  '............kwwk',
  '...........kwwck',
  '..........kwwck.',
  '.........kwwck..',
  '........kwwck...',
  '.......kwwck....',
  '......kwwck.....',
  '..kk.kwwck......',
  '..kykwwck.......',
  '...kyYck........',
  '...kYyYk........',
  '..knkkyyk.......',
  '.knNk..kk.......',
  'kyNk............',
  'kkk.............',
]

const itemBombbag: Rows = [
  '......kk.kk.....',
  '.....kyk.kyk....',
  '......kykyk.....',
  '....kkkYYkkk....',
  '...knnkyykNnk...',
  '..knnnnkknnnNk..',
  '.knjnnnnnnnnnNk.',
  '.knnnkkkkknnnNk.',
  '.knnkBbbBBknnNk.',
  'knnnkbwbBBBknnNk',
  'knnnkbbBBBBknnNk',
  'knnnkBBBBBBknNNk',
  'kNnnnkBBBBknnNNk',
  '.kNnnnkkkknnNNk.',
  '..kkNNNNNNNNkk..',
  '....kkkkkkkk....',
]

const itemDisc: Rows = [
  '.....kkkkkk.....',
  '...kkccccccckk..',
  '..kcwccccccccCk.',
  '.kcwcCkkkkkCccCk',
  '.kcckkppppmkkcCk',
  'kcckppkkkkppkcCk',
  'kcckpkwwwwkpkcCk',
  'kcckpkwkkwkpkcCk',
  'kcckpkwkkwkPkcCk',
  'kcckpkwwwWkPkcCk',
  'kcCkppkkkkPPkCCk',
  '.kcCkkPPPPkkCCk.',
  '.kCccCkkkkkCCCk.',
  '..kCCcccccCCCk..',
  '...kkCCCCCCkk...',
  '.....kkkkkk.....',
]

const itemKey: Rows = [
  '..kkkk..',
  '.kyeyyk.',
  'kyekkyYk',
  'kyk..kYk',
  'kyk..kYk',
  'kYykkyYk',
  '.kYyyYk.',
  '..kyYk..',
  '..kyYk..',
  '..kyYk..',
  '..kyYkk.',
  '..kyYyYk',
  '..kyYkk.',
  '..kyYyYk',
  '..kyYkk.',
  '..kkkk..',
]

const itemBigkey: Rows = [
  '....kkkkkk......',
  '...kyyeyyYk.....',
  '..kyykkkkyYk....',
  '.kyyk.kk.kyYk...',
  '.kyk.kmpk.kyk...',
  '.kyk.kpPk.kYk...',
  '.kyYk.kk.kYYk...',
  '..kyYkkkkYYk....',
  '...kyyYYYYk.....',
  '....kkyYkk......',
  '.....kyYk.......',
  '.....kyYkkkk....',
  '.....kyYyyYYk...',
  '.....kyYkkkk....',
  '.....kyYyYYk....',
  '.....kkkkkk.....',
]

const itemHeartpiece: Rows = [
  '................',
  '..kkkkk.........',
  '.kmmppPk........',
  'kmwmpppPk.......',
  'kmmppppPk.......',
  'kmpppppPk.......',
  'kppppppPkkkkkkk.',
  'kpppppppPPPPPPk.',
  'kPppppppppppPk..',
  '.kPpppppppppk...',
  '..kPppppppPk....',
  '...kPPppPPk.....',
  '....kPPPPk......',
  '.....kPPk.......',
  '......kk........',
  '................',
]

const itemContainer: Rows = [
  '................',
  '..kkkk....kkkk..',
  '.kyyyyk..kyyyyk.',
  'kymmppyk kyppPYk'.replace(' ', 'k'),
  'kymwppPykyppppYk',
  'kympppppppppppYk',
  'kyppppppppppPPYk',
  'kYppppppppppPPYk',
  '.kYpppppppppPYk.',
  '..kYppppppPPPYk.',
  '...kYpppppPPYk..',
  '....kYpppPPYk...',
  '.....kYpPPYk....',
  '......kYYYk.....',
  '.......kkk......',
  '................',
]

// The Sun Prism: a cut crystal holding a striped synthwave sun.
const itemPrism: Rows = (() => {
  const span = [[6, 9], [5, 10], [4, 11], [3, 12], [2, 13], [1, 14], [1, 14], [1, 14], [1, 14], [1, 14], [2, 13], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]]
  const g = blank(16, 16)
  const inside = (x: number, y: number) => y >= 0 && y < 16 && x >= span[y]![0]! && x <= span[y]![1]!
  for (let y = 0; y < 16; y++) {
    for (let x = span[y]![0]!; x <= span[y]![1]!; x++) {
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      if (edge) { g[y]![x] = 'k'; continue }
      const edge2 = !inside(x - 2, y) || !inside(x + 2, y) || !inside(x, y - 2) || !inside(x, y + 2)
      // Crystal body: deep violet, lit facets top-left, cyan rim right.
      let ch = x + y < 12 ? 'v' : 'V'
      if (edge2) ch = y < 6 ? (x < 8 ? 'w' : 'W') : x < 8 ? 'W' : y > 10 ? 'C' : 'c'
      // The sun: a disc, solid gold on top, striped towards the horizon.
      const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8.5)
      if (d < 4.6 && !edge2) {
        if (y <= 6) ch = x <= 6 && y <= 5 ? 'e' : 'y'
        else if (y === 7) ch = 'y'
        else if (y === 8) ch = 'o'
        else if (y === 9) ch = 'V'
        else if (y === 10) ch = 'p'
        else if (y === 11) ch = 'V'
        else if (y === 12) ch = 'P'
      }
      g[y]![x] = ch
    }
  }
  // Horizon line and a facet glint.
  for (let x = 3; x <= 12; x++) if (g[13]![x] !== 'k' && g[13]![x] !== 'C') g[13]![x] = 'c'
  g[2]![6] = 'w'
  g[3]![5] = 'w'
  return join(g)
})()


// ---------------------------------------------------------------------------
// Pickups
// ---------------------------------------------------------------------------

const dropHeart: Rows = [
  '.kk.kk..',
  'kmpkppk.',
  'kwppppPk',
  'kpppppPk',
  '.kpppPk.',
  '..kpPk..',
  '...kk...',
  '........',
]
const bitShape = (hi: string, mid: string, lo: string): Rows => [
  '..kk..',
  '.k' + hi + mid + 'k.',
  'k' + hi + 'w' + mid + lo + 'k',
  'k' + hi + mid + mid + lo + 'k',
  'k' + mid + mid + lo + lo + 'k',
  'k' + mid + lo + lo + lo + 'k',
  '.k' + lo + lo + 'k.',
  '..kk..',
]
const bit1 = bitShape('l', 'l', 'L')
const bit5 = bitShape('c', 'b', 'B')
const bit20 = bitShape('m', 'p', 'P')

// A little pile of chips: blue and pink behind, lime in front.
const itemBits: Rows = (() => {
  const g = blank(16, 16)
  const stamp = (src: Rows, ox: number, oy: number) => src.forEach((row, y) => row.split('').forEach((ch, x) => {
    if (ch !== '.') g[oy + y]![ox + x] = ch
  }))
  stamp(bitShape('c', 'b', 'B'), 2, 3)
  stamp(bitShape('m', 'p', 'P'), 8, 2)
  stamp(bitShape('l', 'l', 'L'), 5, 7)
  stamp(bitShape('e', 'y', 'Y'), 10, 8)
  return join(g)
})()

const dropBomb: Rows = [
  '.....ky.',
  '....ky..',
  '..kkYk..',
  '.kBbbBk.',
  'kBwbBBBk',
  'kBbBBBBk',
  '.kBBBBk.',
  '..kkkk..',
]

const dropKey: Rows = [
  '..kkkk..',
  '.kyeyYk.',
  '.kykkYk.',
  '.kyYyYk.',
  '..kyYk..',
  '..kyYk..',
  '..kyYk..',
  '..kyYyk.',
  '..kyYk..',
  '..kyYyk.',
  '..kkkk..',
  '........',
]

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

const pot: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kjiiiiak....',
  '.....kaaaak.....',
  '....kjiiiiak....',
  '...kjjiiiiiak...',
  '..kjjiiiiiiiak..',
  '..kjcccccccCak..',
  '..kppppppppPak..',
  '..kjiiiiiiiiak..',
  '..kjiiiiiiiaak..',
  '..kiiiiiiiiaak..',
  '...kiiiiiiaak...',
  '....kaaaaaak....',
  '.....kkkkkk.....',
  '................',
]

const rock: Rows = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkWWWggGkk...',
  '..kWWwWgggggGk..',
  '..kWWgggggggGk..',
  '.kWggggGgggggGk.',
  '.kWgggGGggggGGk.',
  '.kgggggggGgGGGk.',
  '.kggggggggGGGGk.',
  '.kGgggggGGGGGuk.',
  '..kGGggGGGGGuk..',
  '..kuGGGGGGGuuk..',
  '...kkuuuuuukk...',
  '.....kkkkkk.....',
  '................',
]

const bomb0: Rows = [
  '.........ky.',
  '........kyo.',
  '.......kYk..',
  '....kkkYk...',
  '...kBBBBkk..',
  '..kBwbBBBBk.',
  '..kBbbBBBBk.',
  '.kBbBBBBBBBk',
  '.kBBBBBBBBBk',
  '.kBBBBBBBBuk',
  '..kBBBBBBuk.',
  '...kkkkkkk..',
]
const bomb1 = swapChars(edit(bomb0, [10, 0, 'w'], [9, 0, 'y'], [11, 0, 'r'], [10, 1, 'r']), { B: 'R', b: 'r', u: 'k' })

const disc0: Rows = [
  '....kkkk....',
  '..kkcccckk..',
  '.kcwccccCCk.',
  '.kckkppkkCk.',
  'kcckpwwpkcCk',
  'kckpwkkwpkCk',
  'kckpwkkwpkCk',
  'kcckpwwpkcCk',
  '.kCkkppkkCk.',
  '.kCCccccCCk.',
  '..kkCCCCkk..',
  '....kkkk....',
]
const disc1: Rows = [
  '....kkkk....',
  '..kkccwckk..',
  '.kcccwccCCk.',
  '.kckkppkkCk.',
  'kcckpkkpkcCk',
  'kwkpkwwkpkCk',
  'kckpkwwkpkck',
  'kCckpkkpkcCk',
  '.kCkkppkkCk.',
  '.kCCccccCCk.',
  '..kkCCwCkk..',
  '....kkkk....',
]

const chest: Rows = [
  '................',
  '..kkkkkkkkkkkk..',
  '.knjnnnnnnnnnNk.',
  '.knyyyyyyyyyyNk.',
  '.knnnnnnnnnnnNk.',
  '.kyyyyykkyyyyyk.',
  '.kYYYYkyykYYYYk.',
  '.knnnnkYYknnnNk.',
  '.knnnnnkknnnnNk.',
  '.kyNnnnnnnnnNyk.',
  '.kyNnnnnnnnnNyk.',
  '.kyNNnnnnnnNNyk.',
  '.kyNNNNNNNNNNyk.',
  '.kYYYYYYYYYYYYk.',
  '.kkkkkkkkkkkkkk.',
  '................',
]
const chestOpen: Rows = [
  '................',
  '..kkkkkkkkkkkk..',
  '.knNNNNNNNNNNnk.',
  '.kyNNNNNNNNNNyk.',
  '.kykkkkkkkkkkyk.',
  '.kkeyyyyyyyyekk.',
  '.kYNNNNNNNNNNYk.',
  '.knkkkkkkkkkkNk.',
  '.knnnnnnnnnnnNk.',
  '.kyNnnnnnnnnNyk.',
  '.kyNnnnnnnnnNyk.',
  '.kyNNnnnnnnNNyk.',
  '.kyNNNNNNNNNNyk.',
  '.kYYYYYYYYYYYYk.',
  '.kkkkkkkkkkkkkk.',
  '................',
]

const bigchest: Rows = [
  '........................',
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kVvvvvvvvvvvvvvvvvvvVk.',
  '.kvmmmmmmmmmmmmmmmmmmvk.',
  '.kvVVVVVVVVVVVVVVVVVVvk.',
  '.kyyyyyyyykkkkyyyyyyyyk.',
  '.kvvvvvvvkyeyYkvvvvvvvk.',
  '.kyyyyyyykYyyYkyyyyyyyk.',
  '.kYYYYYYYYkYYkYYYYYYYYk.',
  '.kVvvvvvvvvkkvvvvvvvvVk.',
  '.kVvvvvvvvvvvvvvvvvvvVk.',
  '.kyVvvvvvvvvvvvvvvvvVyk.',
  '.kyVvvvvvvvvvvvvvvvvVyk.',
  '.kyVVvvvvvvvvvvvvvvVVyk.',
  '.kyVVvvvvvvvvvvvvvvVVyk.',
  '.kyVVVVVVVVVVVVVVVVVVyk.',
  '.kyVVVVVVVVVVVVVVVVVVyk.',
  '.kYYYYYYYYYYYYYYYYYYYYk.',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  '........................',
]
const bigchestOpen: Rows = [
  '........................',
  '..kkkkkkkkkkkkkkkkkkkk..',
  '.kvVVVVVVVVVVVVVVVVVVvk.',
  '.kyVVVVVVVVVVVVVVVVVVyk.',
  '.kykkkkkkkkkkkkkkkkkkyk.',
  '.kkeyyyyyyyyyyyyyyyyekk.',
  '.kYKKKKKKKKKKKKKKKKKKYk.',
  '.kvkkkkkkkkkkkkkkkkkkvk.',
  '.kYYYYYYYYYYYYYYYYYYYYk.',
  '.kVvvvvvvvvvvvvvvvvvvVk.',
  '.kVvvvvvvvvvvvvvvvvvvVk.',
  '.kyVvvvvvvvvvvvvvvvvVyk.',
  '.kyVvvvvvvvvvvvvvvvvVyk.',
  '.kyVVvvvvvvvvvvvvvvVVyk.',
  '.kyVVvvvvvvvvvvvvvvVVyk.',
  '.kyVVVVVVVVVVVVVVVVVVyk.',
  '.kyVVVVVVVVVVVVVVVVVVyk.',
  '.kYYYYYYYYYYYYYYYYYYYYk.',
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  '........................',
]

const pellet: Rows = [
  '.kkkk.',
  'kmwwpk',
  'kwwppk',
  'kpppPk',
  'kmpPPk',
  '.kkkk.',
]
const shard: Rows = [
  '...kk...',
  '..kmpk..',
  '.kmwppk.',
  'kmwpppPk',
  'kpppPPPk',
  '.kpPPPk.',
  '..kPPk..',
  '...kk...',
]

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

const blob0: Rows = [
  '..............',
  '.....kkkk.....',
  '...kkvvvvkk...',
  '..kvmvvvvvVk..',
  '.kvmvvvvvvvVk.',
  '.kvvkkvvkkvVk.',
  '.kvkmpkkmpkVk.',
  'kvvkppkkppkVVk',
  'kvvvkkvvkkvVVk',
  'kVvvvvvvvvVVVk',
  '.kVVVVVVVVVVk.',
  '..kkkkkkkkkk..',
]
const blob1: Rows = [
  '..............',
  '..............',
  '..............',
  '....kkkkkk....',
  '..kkvmvvvvkk..',
  '.kvmvvvvvvvVk.',
  'kvvkkvvvvkkvVk',
  'kvkmpkvvkmpkVk',
  'kvkppkvvkppkVk',
  'kvvkkvvvvkkVVk',
  'kVVvvvvvvvVVVk',
  '.kkkkkkkkkkkk.',
]

const SPITTER_DOWN0: Rows = [
  '................',
  '.....kkkkkk.....',
  '...kkrrrrrrkk...',
  '..krmmrrrrrrRk..',
  '..krmrrrrrrrRk..',
  '.krrwwkrrwwkrRk.',
  '.krrwkkrrwkkrRk.',
  '.krrrrrrrrrrRRk.',
  '.kRrrrkkkkrrRRk.',
  '..kRrkPppPkrRk..',
  '..kRRkPkkPkRRk..',
  '...kRRkkkkRRk...',
  '..kRkRRRRRRkRk..',
  '.kRk.kRkkRk.kRk.',
  '.kk..kRkkRk..kk.',
  '.....kk..kk.....',
]
const SPITTER_LEGS1: Rows = [
  '..kRkRRRRRRkRk..',
  '..kRkkRkkRkkRk..',
  '...kk.kRRk.kk...',
  '.......kk.......',
]
const spitterDown0 = SPITTER_DOWN0
const spitterDown1 = rowsAt(SPITTER_DOWN0, 12, SPITTER_LEGS1)
const SPITTER_UP0 = rowsAt(SPITTER_DOWN0, 5, [
  '.krrrrrrrrrrrRk.',
  '.krrrrrrrrrrrRk.',
  '.kRrrrrrrrrrRRk.',
  '.kRRrrrrrrrRRRk.',
  '..kRRrrrrrRRRk..',
  '..kRRRRRRRRRRk..',
  '...kRRRRRRRRk...',
])
const spitterUp0 = SPITTER_UP0
const spitterUp1 = rowsAt(SPITTER_UP0, 12, SPITTER_LEGS1)
const SPITTER_SIDE0: Rows = [
  '................',
  '....kkkkkk......',
  '..kkrrrrrrkk....',
  '.krmmrrrrrrrk...',
  '.krmrrrrrwwrk...',
  '.krrrrrrrwkkrk..',
  '.krrrrrrrrrrrkkk',
  '.kRrrrrrrrrkPPpk',
  '.kRRrrrrrrrkPkkk',
  '..kRRrrrrrRkkk..',
  '..kRRRRRRRRk....',
  '...kRRRRRRk.....',
  '..kRkRkRkRk.....',
  '.kRk.kRkkRk.....',
  '.kk..kRk.kRk....',
  '.....kk...kk....',
]
const spitterSide0 = SPITTER_SIDE0
const spitterSide1 = rowsAt(SPITTER_SIDE0, 12, [
  '..kRkRkRkRk.....',
  '...kRkRkkRk.....',
  '...kRkkRk.kRk...',
  '....kk.kk..kk...',
])

const SENTRY_DOWN0: Rows = [
  '.............w..',
  '.....kkkkkk.kwk.',
  '....kvmvvvvkkgk.',
  '....kvvvvvvk.g..',
  '....kppppppk.g..',
  '....kKmKKmKk.g..',
  '...kkVvvvvVkkg..',
  '..kVvvyvvyvvVsk.',
  '..kVvvvvvvvvVgk.',
  '..kvkVvvvvVkvg..',
  '..ksKVVVVVVKkg..',
  '...kKvvKvvKk.g..',
  '...kVVk.kVVk.g..',
  '...kVVk.kVVk.g..',
  '..kGGGk.kGGGkg..',
  '..kkkkk.kkkkk...',
]
const sentryDown0 = SENTRY_DOWN0
const sentryDown1 = rowsAt(SENTRY_DOWN0, 12, [
  '...kVVk.kVVk.g..',
  '..kGGGk.kVVk.g..',
  '..kkkkk.kGGGkg..',
  '........kkkkk...',
])
const SENTRY_UP0 = rowsAt(SENTRY_DOWN0, 2, [
  '....kvvvvvmkkgk.',
  '....kvvvvvvk.g..',
  '....kVvvvvVk.g..',
  '....kVVVVVVk.g..',
  '...kkVvvvvVkkg..',
  '..kVvvvvvvvvVsk.',
  '..kVvvvvvvvvVgk.',
])
const sentryUp0 = SENTRY_UP0
const sentryUp1 = rowsAt(SENTRY_UP0, 12, [
  '...kVVk.kVVk.g..',
  '...kVVk.kGGGkg..',
  '..kGGGk.kkkkk...',
  '..kkkkk.........',
])
const SENTRY_SIDE0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kvmvvvvk....',
  '....kvvvvvvvk...',
  '....kVvvvpppk...',
  '....kVVvvKmKk...',
  '....kkVvvvVkk...',
  '...kVvvvvvVk....',
  '..kVvvyvvsskkkkk',
  '..kVvvvvvkggggwk',
  '..kVVvvvVkkkkkk.',
  '...kKvvvKk......',
  '....kVVVk.......',
  '....kVVVk.......',
  '....kGGGGk......',
  '....kkkkkk......',
]
const sentrySide0 = SENTRY_SIDE0
const sentrySide1 = rowsAt(SENTRY_SIDE0, 12, [
  '....kVkVk.......',
  '...kVk.kVk......',
  '..kGGk.kGGk.....',
  '..kkk...kkk.....',
])

const bat0: Rows = [
  'kk............kk',
  'Pmk..........kmP',
  '.Ppk.k....k.kpP.',
  '..PpkvkkkkvkpP..',
  '...PkvyvvyvkP...',
  '....kvvvvvvk....',
  '.....kVwwVk.....',
  '......kVVk......',
  '.......kk.......',
  '................',
]
const bat1: Rows = [
  '................',
  '................',
  '.....k....k.....',
  '....kvkkkkvk....',
  '...kkvyvvyvkk...',
  '..kPpvvvvvvpPk..',
  '.kPpkkVwwVkkpPk.',
  'kPpk..kVVk..kpPk',
  'kPk....kk....kPk',
  'kk............kk',
]

const DASHER_SIDE0: Rows = [
  '................',
  '..........kkkk..',
  '.........kooook.',
  '........kowkoook',
  '........koooookr',
  '........kPooookr',
  '.........kPPkk..',
  '....kkkk.kPok...',
  '...kooook.kok...',
  '..kPPooPPkkok...',
  '.koookkooooPk...',
  'kPPok..kPPPok...',
  'kook....kooPk...',
  '.kk......kkk....',
]
const dasherSide0 = DASHER_SIDE0
const dasherSide1: Rows = [
  '................',
  '................',
  '..........kkkk..',
  '.........kooook.',
  '........kowkoook',
  '........koooookr',
  '........kPooook.',
  '.kk.....kkPPkk..',
  'kPok..kkkkPok...',
  'koook.kooookok..',
  '.kPPokkPPooook..',
  '..kooooookPPok..',
  '...kPPPPokkkk...',
  '....kkkkk.......',
]
// Facing down: the head (eyes, tongue) is at the bottom, the body trails up.
const dasherDown0: Rows = [
  '......kk........',
  '.....kPok.......',
  '......kooPk.....',
  '.....kPPook.....',
  '......kooPPk....',
  '.....kPPook.....',
  '....kkooookk....',
  '...kPooooooPk...',
  '...kooooooook...',
  '...kowkookwok...',
  '...kokkookkok...',
  '....kooooook....',
  '.....kkrrkk.....',
  '.......rr.......',
]
const dasherDown1 = rowsAt(dasherDown0, 0, [
  '........kk......',
  '.......koPk.....',
  '.....kPook......',
  '.....kooPPk.....',
  '....kPPook......',
  '.....kooPPk.....',
])
const DASHER_UP0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kooooook....',
  '...kooPPPPook...',
  '...kooooooook...',
  '...kPoooooooPk..',
  '....kPooooPk....',
  '.....kkookk.....',
  '......kook......',
  '.....kPPook.....',
  '......kooPPk....',
  '.....kPPook.....',
  '......kooPk.....',
  '.......kkk......',
]
const dasherUp0 = edit(DASHER_UP0, [13, 5, '.'], [12, 5, 'k'])
const dasherUp1 = rowsAt(dasherUp0, 8, [
  '......kook......',
  '.......kPPok....',
  '......kooPPk....',
  '.....kPPook.....',
  '....kooPPk......',
  '.....kkkk.......',
])

const zapper0: Rows = [
  '...l...c..l...',
  '..lk..kck.kl..',
  '...kl.kck.lk..',
  '....kkkckk....',
  '...kkmmmmmkk..',
  '..kmmwmmmmmPk.',
  '.kmmwmmmmmmmPk',
  '.kmmmkmmmkmmPk',
  '.kmmmkmmmkmmPk',
  '.kmmmmmmmmmmPk',
  '.kPmmmpppmmPPk',
  '.kPPmmmmmmPPPk',
  '..kPPPPPPPPPk.',
  '..kPk.kPk.kPk.',
  '..kPk.kPk.kPk.',
  '...k...k...k..',
]
const zapper1 = edit(zapper0,
  [0, 0, 'c'], [13, 0, 'c'], [0, 4, 'l'], [13, 3, 'l'], [3, 0, 'c'], [10, 0, 'c'], [7, 0, 'l'],
  [4, 7, 'w'], [9, 7, 'w'], [5, 7, 'c'], [10, 8, 'c'])

const skull0: Rows = [
  '..............',
  '....kkkkkk....',
  '...kWwwWWWk...',
  '..kWwWWWWggk..',
  '.kWWWWWWWWggk.',
  '.kWkkkWWkkkgk.',
  '.kWkpkWWkpkgk.',
  '.kWkkkWWkkkGk.',
  '.kgWWWkkWWgGk.',
  '..kgWWWWWgGk..',
  '...kwkwkwkk...',
  '...kGkGkGkk...',
  '..kGGk..kGGk..',
  '..kkkk..kkkk..',
]
const skull1 = edit(skull0, [4, 6, 'm'], [9, 6, 'm'])
const skullJump: Rows = [
  '....kkkkkk....',
  '...kWwwWWWk...',
  '..kWwWWWWggk..',
  '.kWWWWWWWWggk.',
  '.kWkkkWWkkkgk.',
  '.kWkpkWWkpkgk.',
  '.kWkkkWWkkkGk.',
  '.kgWWWkkWWgGk.',
  '..kgWWWWWgGk..',
  '...kwkwkwkk...',
  '...kGkGkGkk...',
  '...kGk..kGk...',
  '..............',
  '......kk......',
]

const eye: Rows = [
  '................',
  '....kkkkkkkk....',
  '...kWggggggGk...',
  '..kWgGGGGGGgGk..',
  '..kgGkkkkkkGGk..',
  '..kgkkkkkkkkGk..',
  '..kgkkkkkkkkGk..',
  '..kgGkkkkkkGGk..',
  '..kgGGGGGGGGuk..',
  '..kGgggggggguk..',
  '.kkkkkkkkkkkkkk.',
  '.kWggpgggggpggk.',
  '.kgGGGGGGGGGGuk.',
  '.kGuuuuuuuuuuuk.',
  '.kGGGGGGGGGGGGk.',
  '.kkkkkkkkkkkkkk.',
]

const blade: Rows = [
  'k......kk......k',
  '.kk...kpPk...kk.',
  '.kpk..kpPk..kpk.',
  '..kpkkkggkkkpk..',
  '...kGWggggGGk...',
  '..kkWggGGggGkk..',
  '.kppgGkppkGgGppk',
  'kpPggGkpPkGgGPpk',
  '.kkggGkPPkGgGkk.',
  '...kWggkkggGk...',
  '..kkGgggggGGkk..',
  '.kpkkGGGGGGkkpk.',
  '.kk..kkppkk..kk.',
  '.....kpPPk......',
  '......kkk.......',
  '................',
]

// Knight (miniboss): chrome armour, pink plume, big shield on its facing side.
const KNIGHT_DOWN0: Rows = [
  '..........kkk...........',
  '.........kmpmk..........',
  '........kmppPk..........',
  '.......kkkpPkkkk........',
  '......kWWwWWWggGk.......',
  '.....kWwWWWWWgggGk......',
  '.....kWWkkkkkkggGk......',
  '.....kWkppppppkgGk......',
  '.....kgkkkkkkkkgGk......',
  '....kkggGGGGGGgGGkk.....',
  '...kWWkkWWWWWWgkkWGk....',
  '..kWwWkWwWWWWWggkggGk...',
  '..kWWgkWkkkkkkggkggGk...',
  '..kkkkkkyyyyyyykkkkkk...',
  '.kpPpkPkWWWWWWWggkWgGk..',
  '.kPyPkPkWggggggGGkggGk..',
  '.kpPpkPkgGGGGGGGGkkGk...',
  '.kPPPkPkkggGGGGgGk.kk...',
  '..kPPkk.kgGk.kgGk.......',
  '...kkk..kWGk.kWGk.......',
  '........kgGk.kgGk.......',
  '.......kWWGk.kWWGk......',
  '.......kgggk.kgggk......',
  '.......kkkkk.kkkkk......',
]
// The shield sits in front (a big plate over the torso) when facing down.
const knightDown0 = rowsAt(KNIGHT_DOWN0, 10, [
  '...kWWkkWWWWWWgkkWGk....',
  '..kWwWkWwWWWWWggkggGk...',
  '..kWWgkkppppppkkkggGk...',
  '..kkkkkpmwmmmPPkkkkkk...',
  '.kWgGkkpmmyymPPkkWgGk...',
  '.kgGGkkpmyyyyPPkkggGk...',
  '.kkGGkkppmyymPPkkkGk....',
  '..kkk..kpPmmPPk..kk.....',
  '........kkpPkk..........',
])
const knightDown1 = rowsAt(knightDown0, 19, [
  '........kWGk.kgGk.......',
  '........kgGk.kWGk.......',
  '.......kWWGk.kgGk.......',
  '.......kgggk.kWWGk......',
  '.......kkkkk.kgggk......',
])
const knightUp0: Rows = [
  '...........kkk..........',
  '..........kmpmk.........',
  '..........kPppmk........',
  '........kkkkPpkkk.......',
  '.......kWWWWWWggGk......',
  '......kWwWWWWWgggGk.....',
  '......kWWWWWWWWggGk.....',
  '......kWWWWWWWWggGk.....',
  '......kgWWWWWWggGGk.....',
  '.....kkggGGGGGGgGGkk....',
  '....kWGkkWWWWWWgkkWWk...',
  '...kWgGkWwWWWWWggkWwWk..',
  '...kWgGkWWWWWWWggkgWWk..',
  '...kkkkkkyyyyyyykkkkkk..',
  '..kgGkkWWWWWWWggGkkgGk..',
  '..kggkkWggggggGGGkkggk..',
  '..kkGkkgGGGGGGGGGkkGkk..',
  '...kk.kggGGGGGGgGk.kk...',
  '.......kgGk..kgGk.......',
  '.......kWGk..kWGk.......',
  '.......kgGk..kgGk.......',
  '......kWWGk..kWWGk......',
  '......kgggk..kgggk......',
  '......kkkkk..kkkkk......',
]
const knightUp1 = rowsAt(knightUp0, 19, [
  '.......kWGk..kgGk.......',
  '.......kgGk..kWGk.......',
  '......kWWGk..kgGk.......',
  '......kgggk..kWWGk......',
  '......kkkkk..kgggk......',
])
const knightSide0: Rows = [
  '........kkk.............',
  '.......kmpmk............',
  '......kmppPk............',
  '......kkpPkkkkk.........',
  '.....kkWWWwWWgGk........',
  '....kWWwWWWWWggGk.......',
  '....kWWWWWWkkkkkk.......',
  '....kWWWWWkppppppk......',
  '....kgWWWWWkkkkkkk......',
  '....kggGGGGGGgGk........',
  '...kWWkWWWWWWWkkkk......',
  '..kWwWkWWWWWWkPpppk.....',
  '..kWWgkWWWWWWkpmmPPk....',
  '..kkkkkyyyyyykpmyyPPk...',
  '..kgGkWWWWWWgkpmyyPPk...',
  '..kggkWggggGGkpmmmPPk...',
  '..kkGkgGGGGGGkppmmPPk...',
  '...kk.kggGGGGkkppPPk....',
  '......kgGk.kgGkkkkk.....',
  '......kWGk.kWGk.........',
  '......kgGk.kgGk.........',
  '.....kWWGk.kWWGk........',
  '.....kgggk.kgggk........',
  '.....kkkkk.kkkkk........',
]
const knightSide1 = rowsAt(knightSide0, 18, [
  '......kgGk..kgGk........',
  '.....kWGk....kWGk.......',
  '.....kgGk....kgGk.......',
  '....kWWGk....kWWGk......',
  '....kgggk....kgggk......',
  '....kkkkk....kkkkk......',
])

// The Static King — procedural TV-static body, chrome rim, one huge eye,
// a pink neon crown and glitch stripes.
function kingSprite(frame: number, hurt: boolean): Rows {
  const S = 48
  const g = blank(S, S)
  const cx = 24
  const cy = 27
  const rx = 17
  const ry = 15
  const inBody = (x: number, y: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (!inBody(x, y)) continue
      const edge = !inBody(x - 1, y) || !inBody(x + 1, y) || !inBody(x, y - 1) || !inBody(x, y + 1)
      const edge2 = !inBody(x - 2, y) || !inBody(x + 2, y) || !inBody(x, y - 2) || !inBody(x, y + 2)
      if (edge) { g[y]![x] = 'k'; continue }
      if (edge2) { g[y]![x] = y < cy ? (x < cx ? 'W' : 'g') : (x < cx ? 'g' : 'G'); continue }
      const n = hash(x, y, 7 + frame * 13 + (hurt ? 101 : 0))
      const shade = (y - cy) / ry + (x - cx) / rx * 0.4
      let ch: string
      if (hurt) ch = n < 0.3 ? 'W' : n < 0.55 ? 'g' : n < 0.8 ? 'm' : 'w'
      else if (shade < -0.3) ch = n < 0.35 ? 'W' : n < 0.75 ? 'g' : 'G'
      else if (shade < 0.35) ch = n < 0.2 ? 'W' : n < 0.55 ? 'g' : n < 0.9 ? 'G' : 'u'
      else ch = n < 0.2 ? 'g' : n < 0.6 ? 'G' : 'u'
      g[y]![x] = ch
    }
  }
  // Glitch stripes: horizontal tears offset per frame.
  const stripes: Array<[number, string, number, number]> = frame === 0
    ? [[17, 'c', 12, 30], [33, 'p', 10, 22], [37, 'c', 26, 36]]
    : [[19, 'p', 18, 36], [31, 'c', 12, 26], [38, 'p', 16, 30]]
  for (const [y, ch, x0, x1] of stripes) {
    for (let x = x0; x <= x1; x++) if (g[y]![x] !== '.' && g[y]![x] !== 'k') g[y]![x] = ch
  }
  // The eye: white sclera ellipse, pink iris, black pupil, highlight.
  const ex = 24
  const ey = 26
  for (let y = ey - 7; y <= ey + 7; y++) {
    for (let x = ex - 10; x <= ex + 10; x++) {
      const d = ((x + 0.5 - ex) / 9.5) ** 2 + ((y + 0.5 - ey) / 6.5) ** 2
      if (d > 1) continue
      const rim = ((x + 0.5 - ex) / 8.5) ** 2 + ((y + 0.5 - ey) / 5.5) ** 2 > 1
      if (hurt) {
        g[y]![x] = rim ? 'k' : y === ey ? 'k' : y < ey ? 'P' : 'R'
        continue
      }
      if (rim) { g[y]![x] = 'k'; continue }
      const ix = ex + (frame === 0 ? 0 : 1)
      const di = Math.hypot(x + 0.5 - ix, y + 0.5 - ey)
      g[y]![x] = di < 1.8 ? 'k' : di < 3.2 ? 'p' : di < 4.4 ? (y < ey ? 'm' : 'P') : (y < ey - 2 ? 'w' : 'W')
    }
  }
  if (!hurt) { g[ey - 2]![ex - 2 + (frame === 0 ? 0 : 1)] = 'w'; g[ey - 1]![ex - 2 + (frame === 0 ? 0 : 1)] = 'w' }
  // Crown: five neon spikes with gold gems.
  const crownBase = 13
  for (let x = 12; x <= 36; x++) { g[crownBase]![x] = 'k'; g[crownBase - 1]![x] = 'p'; g[crownBase - 2]![x] = 'P' }
  for (let x = 13; x <= 35; x++) g[crownBase - 1]![x] = x % 4 === 0 ? 'y' : 'p'
  const spikes = [14, 19, 24, 29, 34]
  spikes.forEach((sx, i) => {
    const h = i === 2 ? 10 : i === 1 || i === 3 ? 8 : 6
    for (let k = 0; k < h; k++) {
      const y = crownBase - 3 - k
      const half = Math.max(0, Math.floor((h - k) / 3))
      for (let x = sx - half; x <= sx + half; x++) g[y]![x] = x === sx - half && half > 0 ? 'm' : 'p'
      g[y]![sx - half - 1] = 'k'
      g[y]![sx + half + 1] = 'k'
    }
    g[crownBase - 3 - h]![sx] = 'k'
    g[crownBase - 2 - h]![sx] = frame === 0 ? 'w' : 'm'
    g[crownBase - 4]![sx] = 'y'
  })
  // Floating chrome hands.
  const hand = (hx: number, hy: number) => {
    const shape = ['.kkkk.', 'kWWwgk', 'kWggGk', 'kgGGGk', '.kGGk.', 'k.kk.k']
    shape.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch !== '.') g[hy + y]![hx + x] = ch }))
  }
  const bob = frame === 0 ? 0 : 1
  hand(1, 30 + bob)
  hand(41, 30 - bob)
  // Shadow wisps under the body (it hovers).
  for (let x = 16; x <= 32; x++) if (hash(x, 44, frame) > 0.5) g[44]![x] = 'u'
  for (let x = 20; x <= 28; x++) g[46]![x] = 'u'
  for (let x = 18; x <= 30; x += 3) g[47]![x] = 'u'
  return join(g)
}

// ---------------------------------------------------------------------------
// NPCs
// ---------------------------------------------------------------------------

const keeper0: Rows = [
  '.............kk.',
  '......kkkk..kpmk',
  '.....kvvvvk.kmpk',
  '....kvvmvvvk.kk.',
  '...kvvvvvvvVkgk.',
  '...kVsksskskVgk.',
  '...kVssSSssVkgk.',
  '...kWWWssWWWkgk.',
  '..kvWwWWWWWWvsk.',
  '..kvVWWWWWWWVgk.',
  '..kvVvWWWWWVvgk.',
  '..kvVvvWWWvvVgk.',
  '..kvVVvvWvvVVgk.',
  '..kVVVVvvvVVVgk.',
  '..kVVVVVVVVVVgk.',
  '..kkkkkkkkkkkkk.',
]
const keeper1 = edit(keeper0, [5, 5, 's'], [6, 5, 'k'], [9, 5, 'k'], [10, 5, 's'], [5, 5, 'k'], [6, 5, 'S'], [9, 5, 'S'], [10, 5, 'k'],
  [14, 1, 'w'], [13, 2, 'p'])

const vendor0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....khhhhhhk....',
  '...kyyyyyyyyk...',
  '..kyeyyyyyyYYk..',
  '...kKKKKKKKKk...',
  '...ksskssksk....',
  '...ksssSSsssk...',
  '....kssssssk....',
  '..kkbbkwwkbbkk..',
  '.kbbkwwwwwwkbbk.',
  '.ksbkwwwwwwkbsk.',
  '.kkbkwWpWWwkbkk.',
  '...kkwwwwwwkk...',
  '...kBBBkkBBBk...',
  '...kkkk..kkkk...',
]
const vendor1Fixed = edit(vendor0, [5, 6, 'S'], [6, 6, 'S'], [8, 6, 'S'], [9, 6, 'S'], [4, 6, 'S'], [10, 6, 'S'])

const kid0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....koooooYk....',
  '...kooooooooYk..'.slice(0, 16),
  '...knnnnnnnnk...',
  '...knsssssnk....',
  '...kskssksk.....',
  '....ksSSsk......',
  '...kkllllkk.....',
  '..klLllllLlk....',
  '..ksLllllLsk....',
  '...kLLLLLLk.....',
  '...kBBkkBBk.....',
  '...kBBk.kBk.....',
  '...kwwk.kwk.....',
  '...kkkk.kkk.....',
]
// Centre the kid (it was drawn left-leaning).
const kidC0 = kid0.map(r => ('.' + r).slice(0, 16))
const kidC1 = rowsAt(kidC0, 5, [
  '....knsssssnk...',
  '....kSSssSSk....',
])

const robot0: Rows = [
  '.......kk.......',
  '......kyyk......',
  '.......kk.......',
  '.......gk.......',
  '....kkkkkkkk....',
  '...kWWWWWWWgk...',
  '...kWkkkkkkgk...',
  '...kWkckkckgk...',
  '...kWkkkkkkgk...',
  '...kgGGGGGGGk...',
  '..kkWWppyWWgkk..',
  '.kgkWWWWWWWgkgk.',
  '.kgkgggggggGkgk.',
  '..kkkGGGGGGkkk..',
  '....kGk..kGk....',
  '....kkk..kkk....',
]
const robot1 = edit(robot0, [7, 1, 'c'], [8, 1, 'c'], [6, 7, 'k'], [9, 7, 'k'], [5, 7, 'c'], [8, 7, 'c'], [7, 10, 'p'], [8, 10, 'y'])

const cat0: Rows = [
  '................',
  '................',
  '................',
  '................',
  '.k..k...........',
  '.kkkk.........k.',
  'kklkkl.......kk.',
  'kkkkkkk......k..',
  '.kkpkkkkkkkkkk..',
  '..kkKkkkkkkkkk..',
  '...kkKkkkkkkk...',
  '...kkkkkkkkkk...',
  '...kk.kk.kk.kk..',
  '...kk.kk.kk.kk..',
  '................',
  '................',
]
const catRows0 = shiftDown(cat0, 2)
const catRows1 = edit(catRows0, [2, 8, 'k'], [5, 8, 'k'], [14, 7, 'k'], [14, 8, '.'], [15, 6, 'k'])

const ghost0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kWwwwwWk....',
  '...kWwwwwwwWk...',
  '...kwwwwwwwWk...',
  '..kWwkkwwkkWgk..',
  '..kWwkcwwkcWgk..',
  '..kWwwwwwwwWgk..',
  '..kWwwwkkwwWgk..',
  '..kWwwwwwwwWgk..',
  '..kWWwwwwwWWgk..',
  '..kgWWwwwWWggk..',
  '..kggWWWWWggGk..',
  '..kgGgGggGgGGk..',
  '...kkgkGgkGkk...',
  '.....k..k..k....',
]
const ghost1 = rowsAt(shiftDown(ghost0, 1), 14, [
  '..kkGkgGkgGkkk..'.slice(0, 16),
  '....k..k..k.....',
])

// Petter, the portal's host: short side-parted hair, glasses, a dark hoodie
// with a cyan chest stripe, jeans. The glasses catch the light on frame 1.
const petter0: Rows = [
  '................',
  '.....kkkkkk.....',
  '....kNnnnnNk....',
  '...kNnnnnnnnk...',
  '...knnnsssssk...',
  '...kGGGGGGGGk...',
  '...kGkGssGkGk...',
  '....ksSssSsk....',
  '..kKuwuuuuwuKk..',
  '..kuuuwuuwuuuk..',
  '..kcccccccccck..',
  '..ksuuuuuuuusk..',
  '...kBbbbbbbbk...',
  '...kbbBkkBbbk...',
  '...kggk..kggk...',
  '...kkkk..kkkk...',
]
const petter1 = edit(petter0, [5, 6, 'c'], [10, 6, 'c'])

// ---------------------------------------------------------------------------
// FX
// ---------------------------------------------------------------------------

const poof = [
  outline(disc(16, 8, 9, [[5, 'p'], [3.5, 'm'], [2, 'w']])),
  disc(16, 8, 8, [[7, 'P', 0.25], [5.5, 'm', 0.2], [3.5, 'w', 0.1]], 3),
  disc(16, 8, 8, [[7.5, 'P', 0.55], [6, 'm', 0.6], [4, 'W', 0.5]], 5),
  disc(16, 8, 8, [[7.5, 'V', 0.8], [6, 'P', 0.85], [3, '.', 0]], 9),
]

const spark0: Rows = [
  '...w....',
  '...w....',
  '..cwc...',
  'wwwwwww.',
  '..cwc...',
  '...w....',
  '...w....',
  '........',
]
const spark1: Rows = [
  '........',
  '.w...w..',
  '..c.c...',
  '...w....',
  '..c.c...',
  '.w...w..',
  '........',
  '........',
]

const boom = [
  disc(32, 16, 16, [[8, 'y'], [5.5, 'e'], [3.5, 'w']], 11),
  disc(32, 16, 16, [[13, 'p'], [11, 'o'], [8, 'y'], [5, 'w']], 12),
  disc(32, 16, 16, [[15, 'P', 0.35], [13, 'p', 0.15], [10, 'o', 0.3], [7, 'G', 0.2]], 13),
  disc(32, 16, 17, [[15, 'u', 0.75], [12, 'G', 0.6], [8, 'g', 0.7]], 14),
]

const splash0: Rows = [
  '................',
  '.....c....c.....',
  '...c..w..w..c...',
  '....cw.cc.wc....',
  '..cwcccccccccwc.',
  '.CcccbbbbbbcccC.',
  '..CCcbBBBBbcCC..',
  '....CCCCCCCC....',
]
const splash1: Rows = [
  '..c..........c..',
  'c...w......w...c',
  '..w..........w..',
  '.w............w.',
  'c..............c',
  '.C...cbbbbc...C.',
  '..C.cbBBBBbc.C..',
  '.....CCCCCC.....',
]

const leaf0: Rows = [
  '..kk..',
  '.ktTk.',
  'kttTk.',
  'ktTTk.',
  '.kTk..',
  '..k...',
]
const leaf1: Rows = [
  '......',
  '.kkk..',
  'kttTkk',
  'ktTTTk',
  '.kkkk.',
  '......',
]

// ---------------------------------------------------------------------------
// HUD 8×8
// ---------------------------------------------------------------------------

const hudHeartFull: Rows = [
  '.kk.kk..',
  'kmpkppk.',
  'kwpppPk.',
  'kpppppPk',
  '.kpppPk.',
  '..kpPk..',
  '...kk...',
  '........',
]
const hudHeartHalf: Rows = [
  '.kk.kk..',
  'kmpkKKk.',
  'kwpkKKk.',
  'kppkKKKk',
  '.kpkKKk.',
  '..kpKk..',
  '...kk...',
  '........',
]
const hudHeartEmpty: Rows = [
  '.kk.kk..',
  'kKKkKKk.',
  'kKKKKKk.',
  'kKKKKKKk',
  '.kKKKKk.',
  '..kKKk..',
  '...kk...',
  '........',
]
const hudBit: Rows = [
  '...kk...',
  '..klLk..',
  '.klwlLk.',
  'kllllLLk',
  'klllLLLk',
  '.kLLLLk.',
  '..kLLk..',
  '...kk...',
]
const hudBomb: Rows = [
  '.....ky.',
  '....ky..',
  '..kkYk..',
  '.kBbbBk.',
  'kBwbBBBk',
  'kBbBBBBk',
  '.kBBBBk.',
  '..kkkk..',
]
const hudKey: Rows = [
  '.kkk....',
  'kyeyk...',
  'kykYkkkk',
  'kyYyyyYk',
  '.kkkyky.',
  '....k.k.',
  '........',
  '........',
].map(r => r.replace(/y\.$/, 'k.'))
const hudBigkey: Rows = [
  '.kkkk...',
  'kyppYk..',
  'kpmpYkkk',
  'kyppyyYk',
  '.kkkkyky',
  '.....kkk',
  '........',
  '........',
].map(r => r.slice(0, 8))

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const RAW: Record<string, Rows> = {
  hero_down_0: heroDown0, hero_down_1: heroDown1, hero_down_2: heroDown2,
  hero_up_0: heroUp0, hero_up_1: heroUp1, hero_up_2: heroUp2,
  hero_side_0: heroSide0, hero_side_1: heroSide1, hero_side_2: heroSide2,
  hero_down_atk: heroDownAtk, hero_up_atk: heroUpAtk, hero_side_atk: heroSideAtk,
  hero_down_carry_0: heroDownCarry0, hero_down_carry_1: heroDownCarry1,
  hero_up_carry_0: heroUpCarry0, hero_up_carry_1: heroUpCarry1,
  hero_side_carry_0: heroSideCarry0, hero_side_carry_1: heroSideCarry1,
  hero_down_push: heroDownPush, hero_up_push: heroUpPushFixed, hero_side_push: heroSidePush,
  hero_get: heroGet, hero_hurt: heroHurt,
  hero_fall_0: heroFall0, hero_fall_1: heroFall1, hero_fall_2: heroFall2,
  hero_dead: heroDead,

  sword_v: swordV, sword_h: swordH, sword_d: swordD,
  sword2_v: sword2V, sword2_h: sword2H, sword2_d: sword2D,

  item_sword: itemSword, item_bombbag: itemBombbag, item_disc: itemDisc, item_key: itemKey,
  item_bigkey: itemBigkey, item_heartpiece: itemHeartpiece, item_container: itemContainer,
  item_prism: itemPrism, item_bits: itemBits,

  drop_heart: dropHeart, bit_1: bit1, bit_5: bit5, bit_20: bit20, drop_bomb: dropBomb, drop_key: dropKey,

  pot, rock, bomb_0: bomb0, bomb_1: bomb1, disc_0: disc0, disc_1: disc1,
  chest, chest_open: chestOpen, bigchest, bigchest_open: bigchestOpen, pellet, shard,

  blob_0: blob0, blob_1: blob1,
  spitter_down_0: spitterDown0, spitter_down_1: spitterDown1,
  spitter_up_0: spitterUp0, spitter_up_1: spitterUp1,
  spitter_side_0: spitterSide0, spitter_side_1: spitterSide1,
  sentry_down_0: sentryDown0, sentry_down_1: sentryDown1,
  sentry_up_0: sentryUp0, sentry_up_1: sentryUp1,
  sentry_side_0: sentrySide0, sentry_side_1: sentrySide1,
  bat_0: bat0, bat_1: bat1,
  dasher_down_0: dasherDown0, dasher_down_1: dasherDown1,
  dasher_up_0: dasherUp0, dasher_up_1: dasherUp1,
  dasher_side_0: dasherSide0, dasher_side_1: dasherSide1,
  zapper_0: zapper0, zapper_1: zapper1,
  skull_0: skull0, skull_1: skull1, skull_jump: skullJump,
  eye, blade,
  knight_down_0: knightDown0, knight_down_1: knightDown1,
  knight_up_0: knightUp0, knight_up_1: knightUp1,
  knight_side_0: knightSide0, knight_side_1: knightSide1,
  king_0: kingSprite(0, false), king_1: kingSprite(1, false), king_hurt: kingSprite(0, true),

  keeper_0: keeper0, keeper_1: keeper1,
  vendor_0: vendor0, vendor_1: vendor1Fixed,
  kid_0: kidC0, kid_1: kidC1,
  robot_0: robot0, robot_1: robot1,
  cat_0: catRows0, cat_1: catRows1,
  ghost_0: ghost0, ghost_1: ghost1,
  petter_0: petter0, petter_1: petter1,

  poof_0: poof[0]!, poof_1: poof[1]!, poof_2: poof[2]!, poof_3: poof[3]!,
  spark_0: spark0, spark_1: spark1,
  boom_0: boom[0]!, boom_1: boom[1]!, boom_2: boom[2]!, boom_3: boom[3]!,
  splash_0: splash0, splash_1: splash1,
  leaf_0: leaf0, leaf_1: leaf1,

  hud_heart_full: hudHeartFull, hud_heart_half: hudHeartHalf, hud_heart_empty: hudHeartEmpty,
  hud_bit: hudBit, hud_bomb: hudBomb, hud_key: hudKey, hud_bigkey: hudBigkey,

  ...WILD_RAW,
  ...BEACH_RAW,
}


export const SPRITES: Record<string, SpriteDef> = Object.fromEntries(
  Object.entries(RAW).map(([name, rows]) => [name, { rows }]),
)
