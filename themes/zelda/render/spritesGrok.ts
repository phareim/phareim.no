/** GROK's classic rows: a frontier boss, met out of doors, so on the home page (not with the Heap's pictures). */

// ---------------------------------------------------------------------------
// GROK in the 8-bit view
// ---------------------------------------------------------------------------

/**
 * GROK as the 8-bit view draws it (`frontierSprites.ts` takes these for its `grok_*` names; the isometric view has a
 * figure of its own, baked against these rows): a pale chrome dome ringed in ink over a dark face with two cyan eyes,
 * the drill under it and a tread on each side. About as wide as its lane (14 px of the 16), and pale on the violet
 * floor, where the first drawing was small and grey.
 */
const GROK_DOME = [
  '................',
  '................',
  '.....kkkkkk.....',
  '...kkwwwWWWkk...',
  '..kwwwwWWWWWWk..',
  '.kwwwWWWWWWWWgk.',
  '.kwWWWWWWWWWggk.',
  '.kkkkkkkkkkkkkk.',
]
/** Under the dome, from row 8: the face and the drill, seen from the front. */
const GROK_FRONT = [
  '.kKcccKKKKcccKk.',
  'kkKcwcKKKKcwcKkk',
  'kwkKKKkwwkKKKkwk',
  'kWkykkwwWWkkykWk',
  'kgkkkwWWWWgkkkgk',
  'kWk.kkWWggkk.kWk',
  'kgk...kggk...kgk',
  'kkk....kk....kkk',
]
const GROK_BACK = [
  '.kwWWWWWWWWWggk.',
  'kkgWWWWWWWWgggkk',
  'kwkKKKKKKKKKKkwk',
  'kWkKcKKKKKKcKkWk',
  'kgkkkkkkkkkkkkgk',
  'kWk..........kWk',
  'kgk..........kgk',
  'kkk..........kkk',
]
/** The whole of it from the side, facing right. */
const GROK_SIDE = [
  '................',
  '................',
  '................',
  '....kkkkk.......',
  '..kkwwwWWkk.....',
  '.kwwwwWWWWWk....',
  '.kwwWWWWWWWWk...',
  '.kwWWWWWkkkkkk..',
  '.kWWWWWkKcccKk..',
  '.kWWWWgkKcwcKkk.',
  '.kgWWgggkkkkwwk.',
  '.kggggkkkykwwWWk',
  'kkkkkkkkkkkkWggk',
  'kwWkwWkwWkwk.kk.',
  'kWgkWgkWgkWk....',
  '.kkkkkkkkkk.....',
]
/** The poses, from row 8 on. */
const GROK_POSE: Record<string, string[]> = {
  // Telling: pink eyes, the drill run out.
  ram: [
    '.kKpppKKKKpppKk.',
    'kkKpwpkwwkpwpKkk',
    'kwkKKkwwWWkKKkwk',
    'kWkykkwwWWkkykWk',
    'kgkkkwwWWWgkkkgk',
    'kWk.kwWWWgk..kWk',
    'kgk..kWWgk...kgk',
    'kkk...kgk....kkk',
  ],
  // Rolling: head down, the treads a blur.
  roll: [
    '.kKpppKKKKpppKk.',
    'kkKpwpkwwkpwpKkk',
    'wwkKKKwwWWKKKkww',
    'kkkykwwWWWWkykkk',
    'WWkkkkWWggkkkkWW',
    'kkk..kkggkk..kkk',
    'ggk....kk....kgg',
    'kkk..........kkk',
  ],
  // Dazed: gold eyes (open), the drill hanging.
  dazed: [
    '.kKyKyKKKKyKyKk.',
    'kkKKyKKKKKKyKKkk',
    'kwkyKyKKKKyKyKwk',
    'kWkKKkwwWWkKKkWk',
    'kgkkkkWWggkkkkgk',
    'kWk..kkggkk..kWk',
    'kgk...kkkk...kgk',
    'kkk..........kkk',
  ],
  // Boring: the long bit, striped.
  drill: [
    '.kKpppKKKKpppKk.',
    'kkKpwpkwwkpwpKkk',
    'kwkKKkwwWWkKKkwk',
    'kWkykkppppkkykWk',
    'kgkkkkwwWWkkkkgk',
    'kWk..kppppk..kWk',
    'kgk...kwWk...kgk',
    'kkk....pk....kkk',
  ],
}

/** The treads' other step: their pale and mid links change places. */
const turn = (rows: string[], from: number) => rows.map((r, y) => (y < from ? r : [...r].map((ch, x) => (x < 3 || x > 12 ? (ch === 'w' ? 'g' : ch === 'W' ? 'w' : ch === 'g' ? 'W' : ch) : ch)).join('')))

export function grokRows(facing: 'down' | 'up' | 'side', step: number, pose?: string): string[] {
  if (pose) return [...GROK_DOME, ...GROK_POSE[pose]!]
  if (facing === 'side') return step ? GROK_SIDE.map((r, y) => (y === 13 || y === 14 ? r.replace(/[wWg]/g, ch => (ch === 'w' ? 'g' : ch === 'W' ? 'w' : 'W')) : r)) : GROK_SIDE
  const rows = [...GROK_DOME, ...(facing === 'up' ? GROK_BACK : GROK_FRONT)]
  return step ? turn(rows, 9) : rows
}
