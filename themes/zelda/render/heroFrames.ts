/**
 * The hero's sprite frames, composed from head / torso / legs bands so every
 * frame shares the same face and outfit. `heroFrames(shape)` returns the
 * whole `hero_*` family for a shape: a hair style, what is worn on the head
 * and what is worn below the belt (render/heroLook.ts; the NEW LOOK booth in
 * town chooses them). `DRAWN_SHAPE` is the hero as first drawn, and
 * tests/zelda-look.test.mjs holds its frames to tests/zelda-hero-drawn.json
 * pixel for pixel.
 *
 * A hair style is three heads (down, up, side) without anything on them, and
 * for hair that falls past the chin the pixels it lays over the torso. What
 * is worn on the head is drawn over the hair. Palette letters: heroColors.ts.
 */
import { blank, edit, join, mirror, rotCW, rowsAt, shiftDown, shiftX, stamp, type Rows } from './spritesWildKit'

export type HairStyle = 'short' | 'long' | 'tail' | 'pigtails'
export type Headwear = 'band' | 'bow' | 'none'
export type Bottoms = 'trousers' | 'shorts' | 'skirt' | 'dress'

export interface HeroShape {
  hair: HairStyle
  head: Headwear
  bottom: Bottoms
}

export const HAIR_STYLES: readonly HairStyle[] = ['short', 'long', 'tail', 'pigtails']
export const HEADWEAR: readonly Headwear[] = ['band', 'bow', 'none']
export const BOTTOMS: readonly Bottoms[] = ['trousers', 'shorts', 'skirt', 'dress']

/** The hero as first drawn: short hair, the headband with its tail, trousers. */
export const DRAWN_SHAPE: HeroShape = { hair: 'short', head: 'band', bottom: 'trousers' }

type Op = [number, number, string]
type Dir3 = 'down' | 'up' | 'side'

/** Nearest-neighbour shrink of a sprite into a w×h frame, centred on row `cy`. */
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

/** `ch` on every x from x0 to x1 in row y. */
function span(x0: number, x1: number, y: number, ch: string): Op[] {
  const ops: Op[] = []
  for (let x = x0; x <= x1; x++) ops.push([x, y, ch])
  return ops
}

/** Ops moved down by `dy` rows (the push frames stand a pixel lower); rows off the sprite are dropped. */
function lower(ops: Op[], dy: number): Op[] {
  return ops.map(([x, y, ch]): Op => [x, y + dy, ch]).filter(([, y]) => y >= 0 && y < 16)
}

// ---------------------------------------------------------------------------
// Hair: a bare head per direction, and what falls over the torso (rows 8+)
// ---------------------------------------------------------------------------

interface Hair {
  head: Record<Dir3, Rows>
  /** Hair below the chin, drawn over the torso. */
  over: Record<Dir3, Op[]>
  /** The hair is wider than the head: the headband is worn without its flying tail. */
  wide: boolean
  /** The frame where the hero holds a find overhead has its own, narrower head. */
  get: Op[]
}

const SHORT: Hair = {
  head: {
    down: [
      '................',
      '.....kkkkkk.....',
      '....kHHhhhhk....',
      '...kHhhhhhhhk...',
      '...khhhhhhhhk...',
      '...khsssssshk...',
      '...kssksskssk...',
      '....ksSssSsk....',
    ],
    up: [
      '................',
      '.....kkkkkk.....',
      '....khHHhhhk....',
      '...khHhhhhhhk...',
      '...khhhhhhhhk...',
      '...khhhhhHhhk...',
      '...khhhhhhhhk...',
      '....khhhhhhk....',
    ],
    side: [
      '................',
      '.....kkkkk......',
      '....kHHhhhk.....',
      '...kHhhhhhhk....',
      '...khhhhhhhhk...',
      '...khhhsssssk...',
      '....khhssskssk..',
      '.....khsSssSk...',
    ],
  },
  over: { down: [], up: [], side: [] },
  wide: false,
  get: [],
}

/** To the shoulders: beside the face from the front, down the back from behind. */
const LONG: Hair = {
  head: {
    down: rowsAt(SHORT.head.down, 4, [
      '..khhhhhhhhhhk..',
      '..khhsssssshhk..',
      '..khsskssksshk..',
      '..khksSssSskhk..',
    ]),
    up: rowsAt(SHORT.head.up, 4, [
      '..khHhhhhhhhhk..',
      '..khHhhhhhhhhk..',
      '..khHhhhhhhhhk..',
      '..khHhhhhhhhhk..',
    ]),
    side: rowsAt(SHORT.head.side, 4, [
      '...khhhhhhhhk...',
      '..khhhhsssssk...',
      '..khhhhssskssk..',
      '..khhhhsSssSk...',
    ]),
  },
  over: {
    down: [[2, 8, 'k'], [3, 8, 'h'], [12, 8, 'h'], [13, 8, 'k'], [3, 9, 'h'], [12, 9, 'h']],
    up: [[2, 8, 'k'], ...span(3, 12, 8, 'h'), [4, 8, 'H'], [13, 8, 'k'], ...span(4, 11, 9, 'h'), [5, 9, 'H'], ...span(5, 10, 10, 'h')],
    side: [[2, 8, 'k'], [3, 8, 'h'], [4, 8, 'h'], [2, 9, 'k'], [3, 9, 'h'], [3, 10, 'k']],
  },
  wide: true,
  get: [[4, 7, 'h'], [11, 7, 'h'], [12, 7, 'k'], [4, 8, 'h'], [11, 8, 'h'], [12, 8, 'k']],
}

/** A high ponytail: a knot on top from the front, the tail down the back and out behind the head. */
const TAIL: Hair = {
  head: {
    down: edit(SHORT.head.down, [7, 0, 'k'], [8, 0, 'k'], [7, 1, 'h'], [8, 1, 'H']),
    up: edit(SHORT.head.up, [7, 0, 'k'], [8, 0, 'k'], [7, 1, 'h'], [8, 1, 'H'],
      [7, 4, 'H'], [8, 4, 'H'], [7, 5, 'H'], [8, 5, 'H'], [9, 5, 'h'], [7, 6, 'H'], [8, 6, 'H'], [7, 7, 'H'], [8, 7, 'H']),
    side: rowsAt(SHORT.head.side, 3, [
      '..kkHhhhhhhk....',
      '.khhhhhhhhhhk...',
      '.khkhhhsssssk...',
      '.khkkhhssskssk..',
      '..k..khsSssSk...',
    ]),
  },
  over: {
    down: [],
    up: [[6, 8, 'k'], [7, 8, 'H'], [8, 8, 'H'], [9, 8, 'k'], [6, 9, 'k'], [7, 9, 'H'], [8, 9, 'H'], [9, 9, 'k'], [7, 10, 'k'], [8, 10, 'k']],
    side: [],
  },
  wide: true,
  get: [[7, 0, 'k'], [8, 0, 'k'], [7, 1, 'h'], [8, 1, 'H']],
}

/** Two bunches, one by each ear. */
const PIGTAILS: Hair = {
  head: {
    down: rowsAt(SHORT.head.down, 5, [
      '.kkkhsssssshkkk.',
      'khhksskssksskhhk',
      'khhkksSssSskkhhk',
    ]),
    up: rowsAt(SHORT.head.up, 5, [
      '.kkkhhhhhHhhkkk.',
      'khhkhhhhhhhhkhhk',
      'khhkkhhhhhhkkhhk',
    ]),
    side: rowsAt(SHORT.head.side, 5, [
      '.kkkhhhsssssk...',
      'khhkkhhssskssk..',
      'khhk.khsSssSk...',
    ]),
  },
  over: {
    down: [[1, 8, 'k'], [2, 8, 'k'], [13, 8, 'k'], [14, 8, 'k']],
    up: [[1, 8, 'k'], [2, 8, 'k'], [13, 8, 'k'], [14, 8, 'k']],
    side: [[1, 8, 'k'], [2, 8, 'k']],
  },
  wide: true,
  get: [[4, 7, 'h'], [11, 7, 'h'], [12, 7, 'k'], [4, 8, 'h'], [11, 8, 'h'], [12, 8, 'k']],
}

const HAIR: Record<HairStyle, Hair> = { short: SHORT, long: LONG, tail: TAIL, pigtails: PIGTAILS }

// ---------------------------------------------------------------------------
// On the head: drawn over the hair
// ---------------------------------------------------------------------------

/** The headband round the brow; over short hair its knot and tail fly out behind. */
function band(dir: Dir3, hair: Hair, style: HairStyle): Op[] {
  const tail = !hair.wide
  const x0 = style === 'long' && dir !== 'side' ? 3 : 4
  const x1 = style === 'long' && dir !== 'side' ? 12 : 11
  switch (dir) {
    case 'down':
      return tail
        ? [...span(4, 12, 4, 'p'), [13, 4, 'k'], [13, 5, 'p'], [14, 5, 'k'], [14, 6, 'p'], [15, 6, 'k'], [14, 7, 'k']]
        : span(x0, x1, 4, 'p')
    case 'up':
      // From behind the knot hangs in the middle; a ponytail covers it.
      return [...span(x0, x1, 4, 'p'), ...(style === 'tail' ? [] : [[7, 5, 'p'], [8, 5, 'p'], [7, 6, 'p'], [9, 6, 'p'], [7, 7, 'p'], [9, 7, 'p']] as Op[])]
    case 'side':
      return tail
        ? [[2, 4, 'k'], ...span(3, 11, 4, 'p'), [1, 5, 'k'], [2, 5, 'p'], [1, 6, 'k'], [2, 6, 'p'], [2, 7, 'k']]
        : span(4, 11, 4, 'p')
  }
}

/** A bow on top of the head: two loops and the knot between them (one loop and the knot from the side). */
function bow(dir: Dir3): Op[] {
  if (dir === 'side') {
    return [
      [4, 0, 'k'], [5, 0, 'k'],
      [3, 1, 'k'], [4, 1, 'p'], [5, 1, 'p'], [6, 1, 'k'],
      [3, 2, 'k'], [4, 2, 'p'], [5, 2, 'p'], [6, 2, 'p'], [7, 2, 'p'],
    ]
  }
  return [
    [5, 0, 'k'], [6, 0, 'k'], [9, 0, 'k'], [10, 0, 'k'],
    [4, 1, 'k'], [5, 1, 'p'], [6, 1, 'p'], [7, 1, 'k'], [8, 1, 'k'], [9, 1, 'p'], [10, 1, 'p'], [11, 1, 'k'],
    [4, 2, 'k'], ...span(5, 10, 2, 'p'), [11, 2, 'k'],
  ]
}

function headwear(dir: Dir3, s: HeroShape): Op[] {
  if (s.head === 'band') return band(dir, HAIR[s.hair], s.hair)
  if (s.head === 'bow') return bow(dir)
  return []
}

// ---------------------------------------------------------------------------
// Torso and legs
// ---------------------------------------------------------------------------

const TORSO_DOWN: Rows = [
  '...kkcCwwCckk...',
  '..kCccCwwCccCk..',
  '..kCccCwwCccCk..',
  '..kskCcyycCksk..',
]
const TORSO_UP: Rows = [
  '...kkccccccCk...',
  '..kCccccccccCk..',
  '..kCccccccCCCk..',
  '..kskCCCCCCksk..',
]
const TORSO_SIDE: Rows = [
  '.....kkCcckk....',
  '....kCcccCcck...',
  '....kCccCCck....',
  '....kCcCsk......',
]

interface Legs { down: Rows; downW1: Rows; side: Rows; sideW1: Rows; sideW2: Rows }

const TROUSERS: Legs = {
  down: [
    '...kBBBBBBBBk...',
    '...kBBBkkBBBk...',
    '...kEEk..kEEk...',
    '...kkkk..kkkk...',
  ],
  downW1: [
    '...kBBBBBBBBk...',
    '...kBBBkkEEEk...',
    '...kEEEk.kkkk...',
    '...kkkkk........',
  ],
  side: [
    '.....kBBBBk.....',
    '.....kBBBBk.....',
    '.....kEEEEEk....',
    '.....kkkkkkk....',
  ],
  sideW1: [
    '.....kBBBBk.....',
    '....kBBkkBBk....',
    '...kEEEk.kEEEk..',
    '...kkkkk.kkkkk..',
  ],
  sideW2: [
    '.....kBBBBk.....',
    '.....kBBBk......',
    '....kEEEEEk.....',
    '....kkkkkkk.....',
  ],
}

/** Bare legs under the hem: the second leg row in skin. */
function bare(legs: Rows): Rows {
  return legs.map((r, i) => (i === 1 ? r.replace(/B/g, 's') : r))
}

const SHORTS: Legs = {
  down: bare(TROUSERS.down), downW1: bare(TROUSERS.downW1),
  side: bare(TROUSERS.side), sideW1: bare(TROUSERS.sideW1), sideW2: bare(TROUSERS.sideW2),
}

/** A hem that flares a pixel past the hips; the lifted foot of a step is under it. */
const SKIRT: Legs = {
  down: [
    '...kBBBBBBBBk...',
    '..kBBBBBBBBBBk..',
    '...kEEkkkkEEk...',
    '...kkkk..kkkk...',
  ],
  downW1: [
    '...kBBBBBBBBk...',
    '..kBBBBBBBBBBk..',
    '...kEEEkkkkkk...',
    '...kkkkk........',
  ],
  side: [
    '.....kBBBBk.....',
    '....kBBBBBBk....',
    '.....kEEEEEk....',
    '.....kkkkkkk....',
  ],
  sideW1: [
    '.....kBBBBk.....',
    '....kBBBBBBk....',
    '...kEEEkkkEEEk..',
    '...kkkkk.kkkkk..',
  ],
  sideW2: [
    '.....kBBBBk.....',
    '....kBBBBBk.....',
    '....kEEEEEk.....',
    '....kkkkkkk.....',
  ],
}

/** A dress is the skirt's cut in the shirt's colour (the palette's business, heroLook.ts). */
const LEGS: Record<Bottoms, Legs> = { trousers: TROUSERS, shorts: SHORTS, skirt: SKIRT, dress: SKIRT }

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

const SIDE_CARRY_TORSO: Rows = [
  '.....kkCcckk....',
  '....kCcccCck....',
  '....kCcccCk.....',
  '....kCcCCk......',
]

/** Holding a find overhead: its own head and arms, on the standing legs. */
const GET_TOP: Rows = [
  '..ks........sk..',
  '..kCk.kkkk.kCk..',
  '..kCkkHhhhkkCk..',
  '..kCkHhhhhhkCk..',
  '..kckhhhhhhkck..',
  '..kckhsssshkck..',
  '..kCkskssksCk...',
  '...kkssMMssk....',
  '...kkCcwwcCk....',
  '...kCcCwwCcCk...',
  '...kCcCwwCcCk...',
  '...kkccyycckk...',
]

function getHeadwear(s: HeroShape): Op[] {
  if (s.head === 'band') return span(5, 10, 4, 'p')
  if (s.head === 'bow') return [[6, 0, 'k'], [9, 0, 'k'], [5, 1, 'k'], [6, 1, 'p'], [9, 1, 'p'], [10, 1, 'k'], ...span(6, 9, 2, 'p')]
  return []
}

// ---------------------------------------------------------------------------
// The family
// ---------------------------------------------------------------------------

/** Every `hero_*` frame for a shape, as rows of palette letters (16×16 each). */
export function heroFrames(shape: HeroShape): Record<string, Rows> {
  const hair = HAIR[shape.hair]
  const legs = LEGS[shape.bottom]
  const shorts = shape.bottom === 'shorts'
  const skirt = shape.bottom === 'skirt' || shape.bottom === 'dress'
  const head = (dir: Dir3) => edit(hair.head[dir], ...headwear(dir, shape))
  /** The hair that falls below the chin, laid over a finished frame. */
  const over = (rows: Rows, dir: Dir3, dy = 0) => edit(rows, ...lower(hair.over[dir], dy))

  const HEAD_DOWN = head('down')
  const HEAD_UP = head('up')
  const HEAD_SIDE = head('side')
  const LEGS_DOWN = legs.down
  const LEGS_DOWN_W1 = legs.downW1
  const LEGS_SIDE = legs.side
  const LEGS_SIDE_W1 = legs.sideW1
  const LEGS_SIDE_W2 = legs.sideW2

  const down0 = over([...HEAD_DOWN, ...TORSO_DOWN, ...LEGS_DOWN], 'down')
  const downW1 = over([...HEAD_DOWN, ...TORSO_DOWN, ...LEGS_DOWN_W1], 'down')
  const downW2 = over([...HEAD_DOWN, ...TORSO_DOWN, ...mirror(LEGS_DOWN_W1)], 'down')
  // Walk: one foot lifted, the opposite hand swings forward (up a row).
  const down1 = edit(downW1, [12, 10, 's'], [12, 11, 'k'], [13, 11, '.'], [13, 10, 'k'])
  const down2 = edit(downW2, [3, 10, 's'], [3, 11, 'k'], [2, 11, '.'], [2, 10, 'k'])

  const up0 = over([...HEAD_UP, ...TORSO_UP, ...LEGS_DOWN], 'up')
  const upW1 = over([...HEAD_UP, ...TORSO_UP, ...LEGS_DOWN_W1], 'up')
  const upW2 = over([...HEAD_UP, ...TORSO_UP, ...mirror(LEGS_DOWN_W1)], 'up')
  const up1 = edit(upW1, [3, 10, 's'], [3, 11, 'k'], [2, 11, '.'], [2, 10, 'k'])
  const up2 = edit(upW2, [12, 10, 's'], [12, 11, 'k'], [13, 11, '.'], [13, 10, 'k'])

  const side0 = over([...HEAD_SIDE, ...TORSO_SIDE, ...LEGS_SIDE], 'side')
  // Arm swings back on one step, forward on the other.
  const side1 = over(rowsAt([...HEAD_SIDE, ...TORSO_SIDE, ...LEGS_SIDE_W1], 10, [
    '...kkCcCCck.....',
    '...ksCcCck......',
  ]), 'side')
  const side2 = over(rowsAt([...HEAD_SIDE, ...TORSO_SIDE, ...LEGS_SIDE_W2], 10, [
    '....kCccCCCk....',
    '....kCcCkcsk....',
  ]), 'side')

  // Attack poses: the arm reaches toward the blade.
  const downAtk = rowsAt(down0, 10, [
    '..kCcCcwwcCcCk..',
    '..kCCcsssscCCk..',
    '...kBBkssskBk...',
  ])
  const upAtk = edit(over(rowsAt(up0, 8, [
    '...kkCccccCkkk..',
    '..kCccccccccCsk.',
    '..kCcCccccCcCk..',
    '..kskccccccck...',
  ]), 'up'), [12, 5, 'k'], [13, 5, 'k'], [12, 6, 'C'], [13, 6, 's'], [14, 6, 'k'], [12, 7, 'C'], [13, 7, 'C'], [14, 7, 'k'])
  const sideAtk = over(rowsAt(side0, 8, [
    '.....kkCcckk....',
    '....kCcccCCCCsk.',
    '....kCccCkkkkk..',
    '....kCcCck......',
  ]), 'side')

  const downCarry0 = carryArms(down0, true)
  const downCarry1 = carryArms(downW1, true)
  const upCarry0 = carryArms(up0, true)
  const upCarry1 = carryArms(upW2, true)
  const sideCarryHead = edit(HEAD_SIDE, [9, 0, 'k'], [10, 0, 'k'], [9, 1, 's'], [10, 1, 's'], [11, 1, 'k'],
    [11, 2, 'C'], [12, 2, 'k'], [12, 3, 'k'])
  const sideCarry0 = over([...sideCarryHead, ...SIDE_CARRY_TORSO, ...LEGS_SIDE], 'side')
  const sideCarry1 = over([...sideCarryHead, ...SIDE_CARRY_TORSO, ...LEGS_SIDE_W1], 'side')

  // Pushing: body lowered a pixel, hands flat against the block.
  const downPush = rowsAt(shiftDown(down0, 1), 11, [
    '..kCCcsssscCCk..',
    '..kkBsskssBkk...',
    skirt ? '..kBBBBBBBBBBk..' : shorts ? '...kssskksssk...' : '...kBBBkkBBBk...',
    '..kEEEk..kEEEk..',
    '..kkkkk..kkkkk..',
  ])
  const upLow = shiftDown(up0, 1)
  const upPush = edit(rowsAt(upLow, 8, [
    '..ks.kkCcccCkk..',
  ]), [2, 8, 'k'], [3, 8, 's'], [12, 8, 's'], [13, 8, 'k'],
  // Hair that reaches down the back stays over the shoulders.
  ...[5, 6, 7, 8, 9, 10].filter(x => 'hH'.includes(upLow[9]![x]!)).map((x): Op => [x, 8, upLow[8]![x]!]))
  const sidePush = over(rowsAt(edit(side0, [13, 6, '.']), 8, [
    '.....kkCcckk....',
    '....kCcccCCCsk..',
    '....kCccCCCCsk..',
    '....kCcCckkkk...',
    '....kBBBBk......',
    skirt ? '...kBBBBBBk.....' : shorts ? '...kssssk.......' : '...kBBBBk.......',
    shorts ? '..kEEEkssk......' : '..kEEEkBBk......',
    '..kkkkkEEEk.....',
  ]), 'side')

  const get = [...edit(GET_TOP, ...getHeadwear(shape), ...hair.get), ...LEGS_DOWN]

  const hurt = over(rowsAt(edit(down0, [6, 6, 'S'], [9, 6, 'S'], [5, 6, 'k'], [10, 6, 'k'],
    [7, 7, 'k'], [8, 7, 'k']), 8, [
    '.k.kkCcwwcCkk.k.',
    '.skCccCwwCccCks.',
    '..kkcCcwwcCckk..',
    '...kkccyycckk...',
  ]), 'down')

  // Lying on the ground: the stand pose turned on its side, pushed to the floor.
  const dead = (() => {
    const r = rotCW(down0)
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


  // -------------------------------------------------------------------------
  // The fight and movement poses (docs/art/codex-tasks.md, THE HERO IN A FIGHT): the classic frames the isometric
  // poses are drawn over (`ART_EXTRA_POSES`, render/iso/hero.ts). Each is the head of this shape, set `dy` rows lower
  // for a crouch, on a torso and legs of its own; legs drawn in trousers take the shape's bottom (`cut`).
  // -------------------------------------------------------------------------

  /** Legs drawn in trousers, in this shape's bottom: shorts bare the rows from `shin` down, the skirt flares a hem. */
  const cut = (rows: Rows, shin = 1, hem = true): Rows => {
    if (!shorts && !skirt) return rows
    const out = rows.map((r, i) => (i >= shin ? r.replace(/B/g, 's') : r))
    if (!skirt || !hem) return skirt ? rows.map((r, i) => (i > shin ? r.replace(/B/g, 's') : r)) : out
    // The hem: the row under the hips, a px wider than they are each side.
    const top = rows[0]!
    const x0 = top.search(/[^.]/)
    const x1 = top.length - 1 - [...top].reverse().join('').search(/[^.]/)
    const at = rows.length >= 4 ? 1 : 0
    const r = [...out[at]!]
    for (let x = x0 - 1; x <= x1 + 1; x++) if (x >= 0 && x < r.length) r[x] = x === x0 - 1 || x === x1 + 1 ? 'k' : 'B'
    out[at] = r.join('')
    for (let i = 0; i < at; i++) out[i] = rows[i]!
    return out
  }
  const HEADS: Record<Dir3, Rows> = { down: HEAD_DOWN, up: HEAD_UP, side: HEAD_SIDE }
  /** The head `dy` rows down, a torso and legs under it (16 rows in all), and the hair that falls past the chin. */
  const stack = (dir: Dir3, dy: number, torso: Rows, legRows: Rows, ...ops: Op[]): Rows => {
    const rows = [...Array<string>(dy).fill('.'.repeat(16)), ...HEADS[dir], ...torso, ...legRows]
    if (rows.length !== 16) throw new Error(`hero ${dir}: ${rows.length} rows`)
    return edit(over(rows, dir, dy), ...ops)
  }
  /** Eyes squeezed shut (the dark eye px turned to the skin's shade), `dy` rows down. */
  const squint = (dir: Dir3, dy: number): Op[] =>
    (dir === 'side' ? [11] : [6, 9]).filter(x => HEADS[dir][6]![x] === 'k').map((x): Op => [x, 6 + dy, 'S'])
  /** Sits a frame on the bottom row, its middle on the sprite's. */
  const grounded = (rows: Rows): Rows => {
    let bottom = 15
    while (bottom > 0 && !/[^.]/.test(rows[bottom]!)) bottom--
    let x0 = 15, x1 = 0
    for (const r of rows) { const a = r.search(/[^.]/); if (a >= 0) { x0 = Math.min(x0, a); x1 = Math.max(x1, r.length - 1 - [...r].reverse().join('').search(/[^.]/)) } }
    return shiftX(shiftDown(rows, 15 - bottom), Math.round(7.5 - (x0 + x1) / 2))
  }
  const rot180 = (rows: Rows): Rows => rows.slice().reverse().map(r => [...r].reverse().join(''))

  // Down (facing the viewer).
  const D_RUN_A = ['...kkcCwwCckk...', '..kCccCwwCccCk..', '.kskCcCwwCccCk..', '..kkkCcyycCksk..']
  const D_RUN_B = mirror(D_RUN_A)
  const D_LUNGE_LEGS = cut(['..kBBBk..kBBBk..', '.kBBBk....kBBBk.', '.kEEEk....kEEEk.', '.kkkkk....kkkkk.'])
  const D_LAND_LEGS = cut(['.kskBBkkkBBBk...', '.kkBBk..kBBk....', '.kEEEk..kEEEk...', '.kkkkk..kkkkk...'])
  const D_CROUCH_LEGS = cut(['..kBBBBkkBBBBk..', '.kskEEk..kEEksk.', '.kkkkkk..kkkkkk.'])
  const D_PASS = cut(['...kBBBBBBBBk...', '...kEEEkkEEEk...', '...kkkkk.kkkkk..'])
  const D_FLY = cut(['...kBBBBBBBBk...', '..kEEEkkEEEEk...', '..kkkkk.kkkkk...', '................'])
  const D_BRACE = cut(['.ksBBBBBBBBBk...', '.kkBBBkkkBBBk...', '..kEEEk..kEEEk..', '..kkkkk..kkkkk..'])
  const D_BUCKLE = cut(['...kBBBkkBBBk...', '....kBBkkBBk....', '...kEEEkkEEEk...'])
  const D_TORSO_3 = ['..kCccCwwCccCk..', '..kCccCwwCccCk..', '..kskCcyycCksk..']

  // Up (from behind).
  const U_RUN_A = ['...kkccccccCk...', '..kCccccccccCk..', '.kskCcccccCCCk..', '..kkkCCCCCCksk..']
  const U_RUN_B = ['...kkccccccCk...', '..kCccccccccCk..', '..kCcccccccCCksk', '..kskCCCCCCkkk..']
  const U_TORSO_3 = ['..kCccccccccCk..', '..kCccccccCCCk..', '..kskCCCCCCksk..']

  // Side (facing right).
  const S_LUNGE_LEGS = cut(['....kBBBBBBk....', '..kBBBk..kBBk...', '.kEEEk....kEEEk.', '.kkkkk....kkkkk.'])
  const S_LAND_LEGS = cut(['....kBBBBBk.....', '...kBBkkBBBk....', '..kEEEk.kEEEk...', '..kkkkk.kkkkk...'])
  const S_PASS = cut(['.....kBBBBk.....', '....kEEEEEk.....', '....kkkkkkk.....'])
  const S_PASS2 = cut(['.....kBBBk......', '...kEEEEEEk.....', '...kkkkkkkk.....'])
  const S_FLY = cut(['....kBBBBBBk....', '..kEEEk..kEEEk..', '..kkkkk..kkkkk..', '................'])
  const S_BRACE = cut(['....kBBBBBk.....', '..kBBBk..kBBk...', '.kEEEk...kEEEk..', '.kkkkk...kkkkk..'])
  const S_BUCKLE = cut(['....kBBBBk......', '......kBBk......', '....kEEEEEk.....'])
  const S_RUN_A = ['.....kkCcckk....', '....kCcccCcck...', '....kCccCCCsk...', '....kCcCkkk.....']
  const S_RUN_B = ['.....kkCcckk....', '...kkCcccCcck...', '..ksCCccCCck....', '....kCcCck......']

  // The roll's ball: from the front and behind, the crown of the head tucked under a rounded back with the knees
  // either side; from the side, the head turned forward and down, the back curled over it.
  const ballFront = (() => {
    const crown = rot180(HEAD_UP.slice(1, 8))
    const top = [
      '.....kkkkkk.....',
      '...kkcccccCkk...',
      '..kCccccccccCk..',
      '.kBBkccccccCkBBk',
      '.kBBBkCCCCCkBBBk',
      '.kEEkkkkkkkkkEEk',
    ].map(r => (shorts ? r.replace(/B/g, 's') : r))
    return grounded(edit([...Array<string>(3).fill('.'.repeat(16)), ...top, ...crown], [1, 9, 'k'], [2, 9, 's'], [13, 9, 's'], [14, 9, 'k']))
  })()
  const ballSide = (() => {
    const g = blank(16, 16)
    stamp(g, rotCW([...HEAD_SIDE, ...Array<string>(8).fill('.'.repeat(16))]), 0, 2)
    stamp(g, [
      '....kkkk.',
      '..kkCccck',
      '.kCccccck',
      'kCcccccCk',
      'kCcccCCk.',
      'kCccCkBBk',
      'kCcCkBBBk',
      'kkCkBBBBk',
      'kEkBBBBkk',
      'kEEkBBksk',
      '.kEEkkksk',
      '..kkk.kk.',
    ].map(r => (shorts ? r.replace(/B/g, 's') : r)), 0, 4)
    return grounded(join(g))
  })()

  const fight: Record<string, Rows> = {
    // H1: winding up (the blade arm drawn back over the far shoulder) and the backhand (swept out the other way).
    hero_down_atk_wind: stack('down', 0, ['...kkcCwwCckksk.', '..kCccCwwCCCCk..', '..kCccCwwCccCk..', '..kskCcyycCkk...'], mirror(LEGS_DOWN_W1)),
    hero_up_atk_wind: stack('up', 0, ['..kskccccccCk...', '..kCCCCcccccCk..', '..kCccccccCCCk..', '...kkCCCCCCksk..'], mirror(LEGS_DOWN_W1)),
    hero_side_atk_wind: stack('side', 0, ['...kskCcckk.....', '...kCCcccCcck...', '....kCccCCck....', '....kCcCck......'], LEGS_SIDE_W1),
    hero_down_atk_back: stack('down', 0, ['...kkcCwwCckk...', 'ksskCcCwwCccCk..', 'kk.kCcCwwCccCk..', '...kkCcyycCksk..'], LEGS_DOWN_W1),
    hero_up_atk_back: stack('up', 0, ['...kkccccccCk...', '..kCccccccccCssk', '..kCccccccCCCkkk', '..kskCCCCCCk....'], LEGS_DOWN_W1),
    hero_side_atk_back: stack('side', 0, ['.....kkCcckksk..', '....kCcccCCCk...', '....kCccCCck....', '....kCcCck......'], LEGS_SIDE_W2),
    // H2: the finisher, a deep low step with the blade arm all the way out, and its landing on a bent front knee.
    hero_down_atk_lunge: stack('down', 1, ['..kCcCcwwcCcCk..', '..kCCcsssscCCk..', '...kBBkssskBBk..'], D_LUNGE_LEGS),
    hero_up_atk_lunge: stack('up', 1, ['..kCccccccccCksk', '..kCccccccCCCkk.', '..kskBBBBBBk....'], D_LUNGE_LEGS),
    hero_side_atk_lunge: stack('side', 1, ['....kCcccCCCCCsk', '....kCccCkkkkkk.', '....kCcCck......'], S_LUNGE_LEGS),
    hero_down_atk_land: stack('down', 1, ['..kCccCwwCccCk..', '..kCCcCwwCcCCk..', '..kCkCcyycCksk..'], D_LAND_LEGS),
    hero_up_atk_land: stack('up', 1, U_TORSO_3, mirror(D_LAND_LEGS)),
    hero_side_atk_land: stack('side', 1, ['....kCcccCcck...', '....kCccCCck....', '....kCcCcksk....'], S_LAND_LEGS),
    // H3: the roll: tucked, the ball, the ball a quarter turn on, and uncurling to a crouch.
    hero_down_roll_0: stack('down', 4, [], cut(['..kCCkBBBBkCCk..', '..ksskBBBBkssk..', '...kkEEkkEEkk...', '....kkkkkkkk....'], 1, false)),
    hero_up_roll_0: stack('up', 4, [], cut(['..kCcccccccCCk..', '..kskBBBBBBksk..', '...kEEkkkkEEk...', '...kkkk..kkkk...'], 1, false)),
    hero_side_roll_0: stack('side', 4, [], cut(['....kCcccCBBk...', '....kCcCkBBsk...', '....kkEEEEEk....', '.....kkkkkk.....'], 1, false)),
    hero_down_roll_1: ballFront,
    hero_up_roll_1: mirror(ballFront),
    hero_side_roll_1: ballSide,
    hero_down_roll_2: grounded(rotCW(ballFront)),
    hero_up_roll_2: grounded(rotCW(mirror(ballFront))),
    hero_side_roll_2: grounded(rotCW(ballSide)),
    hero_down_roll_3: stack('down', 3, ['..kCccCwwCccCk..', '..kCcCcyycCcCk..'], D_CROUCH_LEGS),
    hero_up_roll_3: stack('up', 3, ['..kCccccccccCk..', '..kCccccccCCCk..'], D_CROUCH_LEGS),
    hero_side_roll_3: stack('side', 3, ['....kCcccCcck...', '....kCccCCck....'], cut(['....kBBBBBBBk...', '..kEEEkskEEEk...', '..kkkkkkkkkkk...'])),
    // H5: the run: landing, passing low, in the air (both feet off the ground), and the same on the other foot,
    // the arms pumping higher than the walk's.
    hero_down_run_0: stack('down', 0, D_RUN_A, LEGS_DOWN_W1),
    hero_down_run_1: stack('down', 1, TORSO_DOWN, D_PASS),
    hero_down_run_2: stack('down', 0, D_RUN_B, D_FLY),
    hero_down_run_3: stack('down', 0, D_RUN_B, mirror(LEGS_DOWN_W1)),
    hero_down_run_4: stack('down', 1, TORSO_DOWN, mirror(D_PASS)),
    hero_down_run_5: stack('down', 0, D_RUN_A, mirror(D_FLY)),
    hero_up_run_0: stack('up', 0, U_RUN_B, LEGS_DOWN_W1),
    hero_up_run_1: stack('up', 1, TORSO_UP, D_PASS),
    hero_up_run_2: stack('up', 0, U_RUN_A, D_FLY),
    hero_up_run_3: stack('up', 0, U_RUN_A, mirror(LEGS_DOWN_W1)),
    hero_up_run_4: stack('up', 1, TORSO_UP, mirror(D_PASS)),
    hero_up_run_5: stack('up', 0, U_RUN_B, mirror(D_FLY)),
    hero_side_run_0: stack('side', 0, S_RUN_A, LEGS_SIDE_W1),
    hero_side_run_1: stack('side', 1, TORSO_SIDE, S_PASS),
    hero_side_run_2: stack('side', 0, S_RUN_B, S_FLY),
    hero_side_run_3: stack('side', 0, S_RUN_B, LEGS_SIDE_W1),
    hero_side_run_4: stack('side', 1, TORSO_SIDE, S_PASS2),
    hero_side_run_5: stack('side', 0, S_RUN_A, S_FLY),
    // H6: the breath in (shoulders and hands up a px) and the held charge (low, the blade hand behind, braced).
    hero_down_idle_1: stack('down', 0, ['...kCcCwwCcCk...', '..kCccCwwCccCk..', '..ksccCwwCccsk..', '..kkkCcyycCkkk..'], LEGS_DOWN, [3, 7, 'k'], [12, 7, 'k']),
    hero_up_idle_1: stack('up', 0, ['...kCcccccCCk...', '..kCccccccccCk..', '..ksccccccCCsk..', '..kkkCCCCCCkkk..'], LEGS_DOWN, [3, 7, 'k'], [12, 7, 'k']),
    hero_side_idle_1: stack('side', 0, ['....kCCcccCk....', '....kCcccCcck...', '....kCccCsk.....', '....kCcCkk......'], LEGS_SIDE),
    hero_down_charge: stack('down', 1, ['..kCccCwwCccCk..', '.kCCccCwwCccCk..', '.kCkkCcyycCksk..'], D_BRACE),
    hero_up_charge: stack('up', 1, ['..kCccccccccCk..', '..kCccccccCCCkk.', '..kskCCCCCCkksk.'], mirror(D_BRACE)),
    hero_side_charge: stack('side', 1, ['....kCcccCcck...', '..ksCcccCCck....', '....kCcCck......'], S_BRACE),
    // H7: hurt from every side (down is `hero_hurt`), and staggered: knees buckled, slumped, eyes screwed up.
    hero_down_hurt: hurt,
    hero_up_hurt: stack('up', 0, ['.k.kkccccccCk.k.', '.skCccccccccCks.', '..kkcccccccCkk..', '...kkCCCCCCkk...'], LEGS_DOWN),
    hero_side_hurt: stack('side', 0, ['.k...kkCcckk.k..', '.sk.kCcccCcck.s.', '...kkCccCCckk...', '....kCcCck......'], LEGS_SIDE_W2, ...squint('side', 0)),
    hero_down_stagger: stack('down', 2, D_TORSO_3.map((r, i) => (i === 2 ? '...ksCcyycCsk...' : r)), D_BUCKLE, ...squint('down', 2)),
    hero_up_stagger: stack('up', 2, U_TORSO_3.map((r, i) => (i === 2 ? '...ksCCCCCCsk...' : r)), D_BUCKLE),
    hero_side_stagger: stack('side', 2, ['....kCcccCcck...', '....kCccCCck....', '....kCcsk.......'], S_BUCKLE, ...squint('side', 2)),
  }

  return {
    hero_down_0: down0, hero_down_1: down1, hero_down_2: down2,
    hero_up_0: up0, hero_up_1: up1, hero_up_2: up2,
    hero_side_0: side0, hero_side_1: side1, hero_side_2: side2,
    hero_down_atk: downAtk, hero_up_atk: upAtk, hero_side_atk: sideAtk,
    hero_down_carry_0: downCarry0, hero_down_carry_1: downCarry1,
    hero_up_carry_0: upCarry0, hero_up_carry_1: upCarry1,
    hero_side_carry_0: sideCarry0, hero_side_carry_1: sideCarry1,
    hero_down_push: downPush, hero_up_push: upPush, hero_side_push: sidePush,
    hero_get: get, hero_hurt: hurt,
    hero_fall_0: shrink(down0, 0.75, 16, 16, 10),
    hero_fall_1: shrink(down0, 0.5, 16, 16, 11),
    hero_fall_2: shrink(down0, 0.25, 16, 16, 12),
    hero_dead: dead,
    ...fight,
  }
}

/** The frame names every shape has. */
export const HERO_FRAMES: readonly string[] = Object.keys(heroFrames(DRAWN_SHAPE))
