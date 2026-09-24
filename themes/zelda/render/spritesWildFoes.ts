/**
 * Wildwood enemies: the static hound, the lab security drone and the LLAMA
 * miniboss (26×26). Original designs.
 */
import { type Rows, blank, edit, hash, join, outline, rowsAt, stamp } from './spritesWildKit'

/** Turn 'u' fill into flickering TV static (dark greys with a few sparks). */
function staticize(src: Rows, seed: number): Rows {
  return src.map((row, y) => row.split('').map((ch, x) => {
    if (ch !== 'u') return ch
    const n = hash(x, y, seed)
    return n < 0.2 ? 'K' : n < 0.5 ? 'u' : n < 0.82 ? 'G' : n < 0.96 ? 'g' : 'W'
  }).join(''))
}

// ---------------------------------------------------------------------------
// Static hound — lean, eyeless, made of static; the head is a closed bud
// with a pink seam. It opens like a flower before it lunges.
// ---------------------------------------------------------------------------

const HOUND_SIDE_BODY: Rows = [
  '................',
  '................',
  '................',
  '..........kkk...',
  '.........kuuuk..',
  '.kk..k..kuuuuuk.',
  'kuuk.kkkuuuuuPk.',
  '.kuukuuuuuuuPpk.',
  '..kuuuuuuuuukpk.',
  '..kuuuuuuuuuukk.',
  '...kuuuuuuuuuk..',
]
const HOUND_SIDE_LEGS0: Rows = [
  '...kuuk...kuuk..',
  '..kukkuk.kukkuk.',
  '..kukkuk.kukkuk.',
  '.kuk..kukuk..kuk',
  '.kk....k.k....kk',
]
const HOUND_SIDE_LEGS1: Rows = [
  '...kuuk...kuuk..',
  '...kuuk...kuuk..',
  '...kuuk...kuuk..',
  '..kuuk...kuuk...',
  '..kkkk...kkkk...',
]
const houndSide0 = staticize([...HOUND_SIDE_BODY, ...HOUND_SIDE_LEGS0], 3)
const houndSide1 = staticize(edit([...HOUND_SIDE_BODY, ...HOUND_SIDE_LEGS1], [0, 6, '.'], [0, 5, 'k'], [1, 5, 'u'], [2, 5, 'k'], [1, 4, 'k']), 4)

const HOUND_DOWN: Rows = [
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '..kkuuuuuuuukk..',
  '..kuuuuuuuuuuk..',
  '..kuuukkkkuuuk..',
  '.kuuukuuuukuuuk.',
  '.kuukuuuuuukuuk.',
  '.kuukuupPuukuuk.',
  '.kuk.kuPpuk.kuk.',
  '.kuk.kuPpuk.kuk.',
  '.kuk..kppk..kuk.',
  '.kuk...kk...kuk.',
  'kuuk........kuuk',
  'kkk..........kkk',
]
const houndDown0 = staticize(HOUND_DOWN, 5)
const houndDown1 = staticize(rowsAt(HOUND_DOWN, 12, [
  '.kuk..kppk..kuk.',
  '.kuk...kk..kuuk.',
  'kuuk.......kkk..',
  'kkk.............',
]), 6)

const HOUND_UP: Rows = [
  '................',
  '................',
  '......kkkk......',
  '.....kuuuuk.....',
  '....kuuuuuuk....',
  '..k.kuuuuuuk.k..',
  '.kuk.kuuuuk.kuk.',
  '.kuk.kuuuuk.kuk.',
  '.kuukuuuuuukuuk.',
  '..kuuuuuuuuuuk..',
  '..kuuuuuuuuuuk..',
  '...kuuukkuuuk...',
  '..kuuuk..kuuuk..',
  '..kuuk....kuuk..',
  '.kuuk......kuuk.',
  '.kkk........kkk.',
]
const houndUp0 = staticize(HOUND_UP, 7)
const houndUp1 = staticize(rowsAt(HOUND_UP, 12, [
  '..kuuuk..kuuuk..',
  '..kuuk...kuuk...',
  '..kuuk....kkk...',
  '..kkk...........',
]), 8)

// The lunge tell: the bud splits into five petals around a pink, toothed maw.
const houndOpen = staticize([
  '................',
  '................',
  '................',
  '....kkkkkkkk....',
  '..kkuuuuuuuukk..',
  '.kukkuuuuuukkuk.',
  'kuuk.kpPPpk.kuuk',
  'kuukkpmwwmpkkuuk',
  '.kuukpwkkwpkuuk.',
  'kuuukpwkkwpkuuuk',
  'kuukkpmwwmpkkuuk',
  '.kk.kkpPPpkk.kk.',
  '.kuk.kukkuk.kuk.',
  '.kuk..k..k..kuk.',
  'kuuk........kuuk',
  'kkk..........kkk',
], 9)

// ---------------------------------------------------------------------------
// Lab security drone — chrome shell, one red eye, twin rotors, a pink
// underside lamp. Frame 1: rotor blades turned, eye glint moved.
// ---------------------------------------------------------------------------

const drone0: Rows = [
  '................',
  'kkkkkk....kkkkkk',
  '..kgk......kgk..',
  '...kk.kkkk.kk...',
  '....kkWWwWkk....',
  '...kWWwWWWggk...',
  '..kWwWWWWWWggk..',
  '..kWWkkkkkkgGk..',
  '..kWkrwrrRkgGk..',
  '..kWkrrrrRkGGk..',
  '..kgWkkkkkkGGk..',
  '...kgggggGGGk...',
  '....kGGGGGGk....',
  '.....kkppkk.....',
  '......kppk......',
  '.......kk.......',
]
const drone1 = rowsAt(edit(drone0, [6, 8, 'r'], [7, 8, 'w']), 1, [
  '..kkk.....kkk...'.replace(/^/, ''),
  '.kkgkk...kkgkk..'.slice(0, 16),
])

// ---------------------------------------------------------------------------
// LLAMA (26×26) — very woolly, smug, in a pink neon lab harness with an
// "L" tag. Built from a fluffy wool body, legs and neck, then a hand-drawn
// head is stamped on top.
// ---------------------------------------------------------------------------

type Dir = 'down' | 'up' | 'side'

const LLAMA_HEAD_DOWN: Rows = [
  '.kk......kk.',
  'kWmk....kmWk',
  'kWmkkkkkkmWk',
  '.kWwWwWWwWk.',
  'kWWWwWWwWWWk',
  'kWvvvWWvvvWk',
  'kWwkkWWwkkWk',
  'kWWWWggWWWWk',
  '.kWWggggWWk.',
  '..kgkggkgk..',
  '..kggkkkPk..',
  '...kkkkkk...',
]
const LLAMA_HEAD_SPIT: Rows = [
  '.kk......kk.',
  'kWmk....kmWk',
  'kWmkkkkkkmWk',
  '.kWwWwWWwWk.',
  'kWWWwWWwWWWk',
  'kWvvvWWvvvWk',
  'kWkkkWWkkkWk',
  'kWWWggggWWWk',
  'kggggggggggk',
  'kgkggggggkgk',
  'kgggkmmkgggk',
  '.kkkkcwkkkk.',
]
const LLAMA_HEAD_UP: Rows = [
  '.kk......kk.',
  'kWWk....kWWk',
  'kWWkkkkkkWWk',
  '.kWwWwWWwWk.',
  'kWWWwWWwWWWk',
  'kWWwWWWWwWWk',
  'kWWWWWwWWWWk',
  '.kWWwWWWWWk.',
  '..kWWWWWWk..',
  '...kkkkkk...',
]
const LLAMA_HEAD_SIDE: Rows = [
  '.kk.........',
  'kWmk........',
  'kWmkkkk.....',
  'kWwWwWWkk...',
  '.kWWWWWWWkk.',
  '.kWvvvWWWWWk',
  '.kWwkkWWWggk',
  '..kWWWWWggkk',
  '..kWWWgggPk.',
  '...kWWggggk.',
  '....kkkkkk..',
]
const LLAMA_TAG: Rows = [
  '.kkkk.',
  'kyyyyk',
  'kypyyk',
  'kypyyk',
  'kyppyk',
  '.kkkk.',
]

function llama(dir: Dir, frame: number, spit = false): Rows {
  const S = 26
  const g = blank(S, S)
  const put = (x: number, y: number, ch: string) => { if (x >= 0 && x < S && y >= 0 && y < S) g[y]![x] = ch }
  const side = dir === 'side'
  const cx = side ? 10.5 : 12.5
  const cy = 15.5
  const rx = side ? 9.5 : 9
  const ry = 5
  // Fluffy wool body: an ellipse with a bumpy rim.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = (x + 0.5 - cx) / rx
      const dy = (y + 0.5 - cy) / ry
      const a = Math.atan2(dy, dx)
      const bump = 0.13 * Math.sin(a * 9 + frame * 0.6)
      if (dx * dx + dy * dy <= 1 + bump) put(x, y, 'W')
    }
  }
  // Legs: [x, top, bottom]; back legs end a row higher (further away).
  const lift = frame === 1 ? 1 : 0
  const legs: Array<[number, number, number]> = side
    ? [[3, 19, 23 - lift], [6, 19, 24], [14, 19, 24 - (1 - lift)], [17, 19, 23]]
    : [[6, 19, 23], [9, 19, 24 - lift], [15, 19, 24 - (1 - lift)], [18, 19, 23]]
  for (const [lx, top, bot] of legs) {
    for (let y = top; y <= bot; y++) {
      const ch = y <= top + 1 ? 'W' : y === bot ? 'G' : 'g'
      put(lx, y, ch); put(lx + 1, y, ch === 'g' ? 'G' : ch)
    }
  }
  // Neck.
  if (side) for (let y = 5; y <= 13; y++) for (let x = 15; x <= 20; x++) put(x, y, 'W')
  else for (let y = 8; y <= 13; y++) for (let x = 9; x <= 16; x++) put(x, y, 'W')
  // Tail puff.
  if (side) { put(0, 12, 'W'); put(1, 12, 'W'); put(1, 11, 'W'); put(0, 13, 'W') }
  // Wool texture: curls in white, shade underneath and away from the light.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (g[y]![x] !== 'W') continue
      const n = hash(x, y, 31)
      // Curls: short staggered dashes, two rows apart, a little jittered.
      const curl = y % 2 === 0 && (x + (y % 4 === 0 ? 0 : 2) + (n < 0.2 ? 1 : 0)) % 4 < 2
      const low = y > cy + ry * 0.35 && y < 19
      const far = x > cx + rx * 0.45 && !side
      if (low || far) g[y]![x] = curl ? 'W' : 'g'
      else g[y]![x] = curl ? 'w' : 'W'
    }
  }
  if (dir === 'up') { put(12, 12, 'w'); put(13, 12, 'w'); put(12, 13, 'W'); put(13, 13, 'g') }
  let rows = outline(join(g))
  const out = rows.map(r => r.split(''))
  const bob = frame === 1 ? 1 : 0
  if (dir === 'down') {
    // Harness: a strap round the neck base and one round the chest, tag between.
    for (let x = 8; x <= 17; x++) { out[13]![x] = x === 8 || x === 17 ? 'P' : 'p' }
    for (let x = 4; x <= 21; x++) if (out[17]![x] !== 'k' && out[17]![x] !== '.') out[17]![x] = x % 5 === 0 ? 'm' : 'p'
    stamp(out, LLAMA_TAG, 10, 14)
    stamp(out, spit ? LLAMA_HEAD_SPIT : LLAMA_HEAD_DOWN, 7, bob)
  } else if (dir === 'up') {
    for (let x = 8; x <= 17; x++) { out[13]![x] = x === 8 || x === 17 ? 'P' : 'p' }
    for (let x = 4; x <= 21; x++) if (out[16]![x] !== 'k' && out[16]![x] !== '.') out[16]![x] = 'p'
    for (let y = 13; y <= 16; y++) out[y]![12] = 'P'
    stamp(out, LLAMA_HEAD_UP, 7, 1 + bob)
  } else {
    // Side: the collar round the neck, the chest strap, the tag at the throat.
    for (let x = 15; x <= 20; x++) out[11]![x] = x === 20 ? 'P' : 'p'
    for (let y = 11; y <= 19; y++) if (out[y]![13] !== 'k' && out[y]![13] !== '.') out[y]![13] = 'p'
    stamp(out, LLAMA_TAG, 18, 12)
    stamp(out, LLAMA_HEAD_SIDE, 14, bob)
  }
  rows = join(out)
  return rows
}

export const FOES: Record<string, Rows> = {
  hound_down_0: houndDown0, hound_down_1: houndDown1,
  hound_up_0: houndUp0, hound_up_1: houndUp1,
  hound_side_0: houndSide0, hound_side_1: houndSide1,
  hound_open: houndOpen,
  drone_0: drone0, drone_1: drone1,
  llama_down_0: llama('down', 0), llama_down_1: llama('down', 1),
  llama_up_0: llama('up', 0), llama_up_1: llama('up', 1),
  llama_side_0: llama('side', 0), llama_side_1: llama('side', 1),
  llama_spit: llama('down', 0, true),
}
