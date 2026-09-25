/**
 * Inventory icons: hand-drawn pixel string maps, one per item, with a
 * one-pixel dark outline added round the silhouette by `outlined()`.
 *
 * Each map is at most 19×15 before the outline, so the icon is at most
 * 21×17: the tall (phone) panel then draws every icon at 2× in its 44×36
 * cells, and the wide panel at 1× in 26×22. Shading is top-lit: a light
 * key on top edges, a dark key underneath. The jam has two looks (lidded,
 * and open with a spoon once `jam.open` is set); each look is cached.
 */
import { makeCanvas } from '../../base/pixel/stage'
import { sprite } from '../../base/pixel/sprites'
import type { GameState, ItemId } from '../types'

const PAL: Record<string, string> = {
  k: '#0b0616', // outline
  w: '#fff8f0', // white
  W: '#d6cdee', // pale lavender (paper shade)
  g: '#9a94b8', // grey
  G: '#5a5285', // dark grey
  K: '#2c2440', // iron / near black
  1: '#8fb4ff', // blue light
  2: '#2f5fd0', // blue
  3: '#1a2f78', // navy
  r: '#ff3b5c', // red
  R: '#a8163e', // dark red
  m: '#ffa0c4', // pink light
  p: '#e8607e', // ham pink
  y: '#ffd23f', // gold
  Y: '#c4861c', // dark gold
  e: '#fff1b0', // cream
  E: '#dcc48a', // cream shade
  o: '#ff8a3d', // orange
  O: '#b0522a', // dark orange
  n: '#c08650', // wood
  N: '#6a4028', // dark wood
  c: '#f7d9a0', // bread crumb
  C: '#c98a4a', // crust
  l: '#8fe04a', // lettuce / lime
  L: '#3f8a2a', // dark green
  s: '#c8d4ec', // silver
  S: '#7a88b0', // silver shade
  i: '#ffffff', // shine
  v: '#7a52b8', // umbrella violet
  V: '#44287a', // umbrella shade
  h: '#261744', // umbrella deep
  u: '#1a1430', // display background
  t: '#c8f0ff', // glass
  T: '#6aa8d0', // glass shade
  q: '#fff29a', // oil light
  A: '#d4bf2e', // oil
  Q: '#8a7a14', // oil dark
  f: '#3a5a9a', // sardine back
  F: '#8aa4dc', // sardine belly
  z: '#ee9450', // ginger
  Z: '#a8582a', // dark ginger
  x: '#aca4c2', // cat grey
  X: '#6a6282', // cat dark grey
  j: '#b6ff4a', // cat eye
}

/** Pads the rows to one width and adds a 1-px outline ('k') round the shape. */
function outlined(rows: readonly string[]): string[] {
  const w = Math.max(...rows.map(r => r.length))
  const src = rows.map(r => r.padEnd(w, '.'))
  const h = src.length
  const on = (x: number, y: number) => y >= 0 && y < h && x >= 0 && x < w && src[y]![x] !== '.'
  const out: string[] = []
  for (let y = -1; y <= h; y++) {
    let line = ''
    for (let x = -1; x <= w; x++) {
      if (on(x, y)) line += src[y]![x]
      else line += on(x - 1, y) || on(x + 1, y) || on(x, y - 1) || on(x, y + 1) ? 'k' : '.'
    }
    out.push(line)
  }
  return out
}

// Owner's manual: navy booklet, dog-eared corner, a white band of "text"
// and Brunhilde in profile.
const MANUAL = [
  '31111111111W....',
  '32222222222wW...',
  '32222222222wwW..',
  '32222222222wwwW.',
  '322222222223333W',
  '3222222222222222',
  '3wwwwwwwwwwwwww2',
  '3w3w33w3w33w3ww2',
  '3wwwwwwwwwwwwww2',
  '3222222222222222',
  '32222wwwwwww2222',
  '3222wt1wt1ww2222',
  '322wwwwwwwwwwo22',
  '3222K22222K22222',
  '3333333333333333',
]

// Car keys: a ring, a brass key and a silver key, and the red Volvo 240
// estate fob.
const KEYS = [
  '...ssss............',
  '..s....s...........',
  '..s....sS.rrrrrrr..',
  '..s....s.SrtrtrtrR.',
  '...ssss..rrrrrrrrry',
  '..yyy.sss.RRRRRRRRR',
  '.yY.yss.sS.K....K..',
  '.yyyYsssS..........',
  '..yY..sS...........',
  '..yY..sS...........',
  '..yYy.sSs..........',
  '..yY..sS...........',
  '..yYy.sSs..........',
  '..YY..sSs..........',
  '.......S...........',
]

// Ham sandwich, a bite out of the top corner.
const SANDWICH = [
  '...CCCCCCCCC.......',
  '.CCccccccccccC.....',
  'Cccccccccccccc.....',
  'Ccccccccccccccc..CC',
  'CCCCCCCCCCCCCCCCCCC',
  'lLllLllLllLllLllLlL',
  'LpmpppmpppmpppmpppL',
  '.pppppppppppppppppp',
  '.yyyyyyyyyyyyyyyyy.',
  'CccccccccccccccccC.',
  'CCCCCCCCCCCCCCCCCC.',
]

// EMF meter: yellow box, LED bar display, red light, grille, antenna.
const EMF = [
  '.........gG.',
  '.........gG.',
  '.eeeeeeeeee.',
  'eyyyyyyyyyyY',
  'eyKKKKKKKKyY',
  'eyKuuuuurKyY',
  'eyKuuuoorKyY',
  'eyKulyoorKyY',
  'eyKllyoorKyY',
  'eyKKKKKKKKyY',
  'eyryyyyyyyyY',
  'eyyyyGGGGyyY',
  'eyyyyyyyyyyY',
  'eyyyyGGGGyyY',
  '.YYYYYYYYYY.',
]

// Matchbox: red sleeve with a yellow label, the drawer slid out, one match.
const MATCHES = [
  '..............rr.',
  '..............rR.',
  '..............e..',
  '.............e...',
  'NnNnNnNnNnNn.e...',
  'rrrrrrrrrrrrNeNNn',
  'rryyyyyyyyrrnNNNn',
  'rryyyoyyyyrrneeeE',
  'rryyorryyyrreeeeE',
  'rryyrrryyyrreeeeE',
  'rryyyRyyyyrrEEEEE',
  'RRRRRRRRRRRR.....',
]

// Cooking oil: glass bottle, cork, golden oil, a label with an olive.
const OIL = [
  '...nn...',
  '...NN...',
  '...tT...',
  '...tT...',
  '..tqAT..',
  '.tqAAAT.',
  'tiqAAAAT',
  'tiqAAAAT',
  'teeeeeeT',
  'teeLlLeT',
  'teeeLeeT',
  'teeeeeeT',
  'tiAAAAAT',
  'tqAAAAQT',
  '.TQQQQT.',
]

// Sardine tin: the lid rolled back on its key, three sardines in oil.
const SARDINES = [
  '..sis..............',
  '..s.s..............',
  '.SsisSssssssssssss.',
  'sSsisSfAAfffffffAAs',
  'sSsisSAffFFFFFFwKfs',
  'sSsisSfAAFFFFFFFFAs',
  'sSsisSQAQAQAQAQAQAs',
  'sSsisSfAAfffffffAAs',
  'sSsisSAffFFFFFFwKfs',
  'sSsisSfAAFFFFFFFFAs',
  'sSSSSSQQQQQQQQQQQQs',
  '.SSSSSSSSSSSSSSSSS.',
]

// Umbrella, closed, violet, with a duck-head handle.
const UMBRELLA = [
  '......g......',
  '.....vvV.....',
  '.....vvVh....',
  '....vvvVh....',
  '....vvvVVh...',
  '...vvvvVVh...',
  '...mmmmmmmm..',
  '...vvvvVVhh..',
  '....vvvVVh...',
  '......G......',
  '....eyyyy....',
  '..ooyiKyyY...',
  '.oooyyyyyY...',
  '....yyyyY....',
  '.....YYY.....',
]

// Monocle: a gold ring round a glinting lens, chain curling away.
const MONOCLE = [
  '..yyyy.............',
  '.yYttty............',
  'yYtiittY...........',
  'yttittTY...........',
  'ytttttTY...........',
  'yttttTTY...........',
  '.yTTTTYy...........',
  '..YYYY..y..........',
  '.........Y.........',
  '.........y....yY...',
  '..........Y..Y..y..',
  '...........yY....Y.',
  '.................y.',
  '...............yY..',
]

// Letters: three envelopes, tied with a red ribbon and a bow.
const LETTERS = [
  '..EEEEEEEEEEEEEEEEE',
  '.eeeeeeeeeeeeeeeeeE',
  'wwwwwwwrwwwwwwwwweE',
  'wwwwwwwrwwwww222weE',
  'wWWWwwwrwwwww2y2weE',
  'wwwwwwwrwwwww222weE',
  'wwwwwrrwrrwwwwwwweE',
  'rrrrrRrRrRrrrrrrreE',
  'RRRRrrRrRrrRRRRRReE',
  'wwwwwrrwrrwwWWWWweE',
  'wwwwwwRwRwwwWWWwwe.',
  'WWWWWWWRWWWWWWWWW..',
]

// Lingonberry jam, lidded with a checked cloth tied with string.
const JAM = [
  '...wrwrwrw....',
  '..rwrwrwrwr...',
  '.wrwrwrwrwrw..',
  'rwrwrwrwrwrwr.',
  '.RyyyyyyyyyR..',
  '..tWWWWWWWT...',
  '.tirrrrrrrRT..',
  '.timrrrrrrRT..',
  '.tieeeeeeeRT..',
  '.tieRReeeERT..',
  '.tieReeeeERT..',
  '.tieEEEEEERT..',
  '.tmrrrrrrRRT..',
  '.tRRRRRRRRRT..',
  '..TTTTTTTTT...',
]

// The same jar, open, with a spoon in it.
const JAM_OPEN = [
  '...........is.',
  '..........sS..',
  '.........sS...',
  '..tWWWWWsSWT..',
  '.tRRRRRsSRRRT.',
  '.tirrrrsRrrRT.',
  '.timrrrrrrrRT.',
  '.tieeeeeeeeRT.',
  '.tieRReeeeERT.',
  '.tieReeeeeERT.',
  '.tieEEEEEEERT.',
  '.tmrrrrrrrRRT.',
  '.tRRRRRRRRRRT.',
  '..TTTTTTTTTT..',
]

// The lab key: dark iron, a lightning-bolt bow in gold.
const LABKEY = [
  '...eyyy............',
  '..eyyyY............',
  '.eyyyY.............',
  'eyyyyyyy...........',
  '.YYYyyyY...........',
  '...eyyYgggggggggggg',
  '..eyyYGGGGGGGGGGGGG',
  '..yyY.........GgGgG',
  '.yyY..........GgGgG',
  '.yY...........GG.GG',
  'yY.................',
]

// Mrs Whiskers: grey-ginger tabby, white streak, a gold monocle, tail round
// her feet.
const CAT = [
  '.z.......z.....',
  '.zz..w..zz.....',
  '.zmxxwxxmz.....',
  'xxxxwwxxxxX....',
  'xyyyxwxxxxX....',
  'xyjyxxxjKxX....',
  'xyyyxxxxxxX....',
  '.xwwwmwwwX.....',
  '..yxwwwwX......',
  '..xzyxwwxzX....',
  '.xzxxywwxxzX...',
  '.xxzxxwwxxzXX..',
  'xxxzxwwwwxxzX.z',
  'zzwwxwwxwwzzzzZ',
  '.ZZZZZZZZZZZZZ.',
]

// Yellow rubber gloves, a pair, one over the other.
const GLOVES = [
  '..eyeYeY...........',
  '..yYyYyY...........',
  '..yYyYyYy..........',
  '..yYyYyYy.eyeYeY...',
  'e.yyyyyyY.yYyYyY...',
  'yyyyyyyyY.yYyYyYy..',
  '.yyyyyyyY.yYyYyYy..',
  '..yyyyyY.eyyyyyyY..',
  '..yyyyyYyyyyyyyyY..',
  '..yyyyyY.yyyyyyyY..',
  '..wewewe..yyyyyY...',
  '..YYYYYY..yyyyyY...',
  '..........yyyyyY...',
  '..........wewewe...',
  '..........YYYYYY...',
]

// Fireplace poker: brass handle, iron shaft, the point and its hook.
const POKER = [
  '...............g..',
  '..............gG..',
  '.............gGGgG',
  '............gGG..G',
  '...........gG.....',
  '..........gG......',
  '.........gG.......',
  '........gG........',
  '.......gG.........',
  '......gG..........',
  '....eyY...........',
  '...eyyY...........',
  '..eyYyY...........',
  '..yY.YY...........',
  '..yYYY............',
]

// Brass clock key: butterfly bow, a shaft, the square socket.
const CLOCKKEY = [
  '.ee......ee.',
  'eyyy....yyyY',
  'eyNyy..yyNyY',
  'eyyyyyyyyyyY',
  '.YyyyyyyyyY.',
  '..YY.yY.YY..',
  '.....yY.....',
  '.....yY.....',
  '.....yY.....',
  '.....yY.....',
  '....eyyY....',
  '....yKKY....',
  '....yKKY....',
  '....YYYY....',
]

const MAPS: Record<ItemId, readonly string[]> = {
  manual: MANUAL,
  keys: KEYS,
  sandwich: SANDWICH,
  emf: EMF,
  matches: MATCHES,
  oil: OIL,
  sardines: SARDINES,
  umbrella: UMBRELLA,
  monocle: MONOCLE,
  letters: LETTERS,
  jam: JAM,
  labkey: LABKEY,
  cat: CAT,
  gloves: GLOVES,
  poker: POKER,
  clockkey: CLOCKKEY,
}

const cache = new Map<string, HTMLCanvasElement>()

export function itemIcon(id: ItemId, s: GameState): HTMLCanvasElement {
  const open = id === 'jam' && !!s.flags['jam.open']
  const key = open ? 'jam.open' : id
  let c = cache.get(key)
  if (!c) {
    const rows = open ? JAM_OPEN : MAPS[id]
    if (rows) c = sprite(outlined(rows), PAL)
    else {
      c = makeCanvas(8, 8)
      const g = c.getContext('2d')!
      g.fillStyle = '#5a5285'
      g.fillRect(1, 1, 6, 6)
    }
    cache.set(key, c)
  }
  return c
}
