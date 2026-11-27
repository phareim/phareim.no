/** The frontier's classic people. Each recipe makes the two steps for all four facings on a 16×16 grid. */
import { grokRows } from './spritesHeap'

type Head = 'helmet' | 'cap' | 'braids' | 'hood' | 'hair' | 'bonnet' | 'visor' | 'wood'
type Hand = 'pick' | 'tube' | 'lever' | 'bucket' | 'crook' | 'rope' | 'broom' | 'sled' | 'water' | 'key' | 'book' | 'tail'

export interface Person {
  head: Head
  hand: Hand
  coat: string
  fold: string
  trim: string
  skin: string
  hair: string
  skirt?: boolean
  short?: boolean
}

export const FRONTIER_PEOPLE = {
  foreman: { head: 'helmet', hand: 'pick', coat: 'g', fold: 'G', trim: 'y', skin: 'S', hair: 'N' },
  tubeblower: { head: 'visor', hand: 'tube', coat: 'a', fold: 'N', trim: 'c', skin: 's', hair: 'n' },
  liftlady: { head: 'cap', hand: 'lever', coat: 'u', fold: 'K', trim: 'p', skin: 's', hair: 'W' },
  dairymaid: { head: 'braids', hand: 'bucket', coat: 'r', fold: 'R', trim: 'e', skin: 's', hair: 'o', skirt: true },
  oldherder: { head: 'cap', hand: 'crook', coat: 'n', fold: 'N', trim: 'W', skin: 'S', hair: 'W' },
  huldra: { head: 'hair', hand: 'tail', coat: 'T', fold: 'F', trim: 'm', skin: 's', hair: 'n', skirt: true },
  fjordfisher: { head: 'bonnet', hand: 'rope', coat: 'y', fold: 'Y', trim: 'W', skin: 'S', hair: 'N' },
  lamplighter: { head: 'hood', hand: 'broom', coat: 'H', fold: 'h', trim: 'r', skin: 's', hair: 'W', skirt: true },
  sledchild: { head: 'hood', hand: 'sled', coat: 'b', fold: 'B', trim: 't', skin: 's', hair: 'a', short: true },
  gardenbot: { head: 'visor', hand: 'water', coat: 'W', fold: 'g', trim: 't', skin: 'u', hair: 'g', short: true },
  stagepuppet: { head: 'wood', hand: 'key', coat: 'V', fold: 'h', trim: 'y', skin: 'd', hair: 'n' },
  stagemanager: { head: 'hair', hand: 'book', coat: 'K', fold: 'h', trim: 'p', skin: 'S', hair: 'g', skirt: true },
} as const satisfies Record<string, Person>

export type FrontierNpcLook = keyof typeof FRONTIER_PEOPLE | 'fellgoat'

export function frontierNpcLook(name: string): name is FrontierNpcLook {
  return name === 'fellgoat' || Object.prototype.hasOwnProperty.call(FRONTIER_PEOPLE, name)
}

type Facing = 'down' | 'up' | 'side'

function brush() {
  const pixels = Array.from({ length: 16 }, () => Array<string>(16).fill('.'))
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) {
      if (yy >= 0 && yy < 16 && xx >= 0 && xx < 16) pixels[yy]![xx] = c
    }
  }
  const box = (x: number, y: number, w: number, h: number, c: string) => {
    rect(x, y, w, h, 'k')
    rect(x + 1, y + 1, w - 2, h - 2, c)
  }
  return { rect, box, rows: () => pixels.map(row => row.join('')) }
}

function person(s: Person, facing: Facing, step: number): string[] {
  const { rect, box, rows } = brush()
  const back = facing === 'up'
  const side = facing === 'side'
  const crouch = Number(!!s.short)
  const headY = 1 + crouch * 2 + step
  const armY = 8 + crouch
  const heel = 15 - step

  // Boots and the walking swing.
  box(5 + (side ? step : 0), 12, 3, 4 - step, 'u')
  box(9 - (side ? step : 0), 12, 3, 3 + step, 'u')
  rect(6, heel, 1, 1, s.fold)
  rect(10, 14 + step, 1, 1, s.fold)
  if (s.skirt) {
    box(4, 9, 9, 5, s.fold)
    rect(5, 10, 7, 2, s.coat)
    rect(6, 12, 5, 1, s.trim)
  }
  box(5 + Number(side), 7 + crouch, side ? 6 : 7, s.skirt ? 5 : 6, s.coat)
  rect(10, 9 + crouch, 1, Math.max(1, 3 - crouch), s.fold)
  if (!back && !side) rect(6, 8 + crouch, 4, 1, s.trim)
  if (back) rect(7, 9 + crouch, 3, 1, s.trim)
  box(4, armY, 3, 4, s.coat)
  if (!side) box(11, armY + step, 3, 4, s.coat)
  rect(side ? 5 : 12, armY + (side ? 2 : 2 + step), 1, 1, s.skin)

  box(5 + Number(side), headY, side ? 6 : 7, 7, back ? s.hair : s.skin)
  rect(6 + Number(side), headY + 1, side ? 4 : 5, 1, s.hair)
  if (!back) {
    rect(side ? 10 : 7, headY + 3, 1, 1, s.head === 'visor' ? 'c' : 'k')
    if (!side) rect(10, headY + 3, 1, 1, s.head === 'visor' ? 'c' : 'k')
    rect(side ? 10 : 8, headY + 5, 1, 1, s.head === 'wood' ? 'N' : s.skin)
  }

  switch (s.head) {
    case 'helmet':
      box(5, headY - 1, 7, 3, 'y')
      rect(4, headY + 1, 9, 1, 'Y')
      if (!back) rect(side ? 10 : 8, headY, 1, 1, 'e')
      break
    case 'cap':
      box(5, headY - 1, 7, 3, s.fold)
      rect(side ? 8 : 5, headY + 1, 5, 1, s.trim)
      break
    case 'braids':
      rect(4, headY + 3, 2, 5, s.hair)
      rect(11, headY + 3, 2, 4, s.hair)
      rect(4, headY + 6, 2, 1, s.trim)
      rect(11, headY + 6, 2, 1, s.trim)
      break
    case 'bonnet':
      box(5, headY - 1, 7, 3, 'Y')
      rect(4, headY + 1, 9, 1, 'y')
      rect(5, headY + 2, 1, 4, 'Y')
      break
    case 'hood':
      box(5, headY - 1, 7, 3, s.coat)
      rect(5, headY + 2, 1, 4, s.fold)
      if (!side) rect(11, headY + 2, 1, 4, s.fold)
      rect(6, headY + 6, 5, 1, s.trim)
      break
    case 'visor':
      if (back) rect(9, headY + 2, 2, 2, s.trim)
      else {
        rect(side ? 8 : 6, headY + 2, side ? 4 : 6, 3, 'u')
        rect(side ? 10 : 7, headY + 3, 1, 1, 'c')
        if (!side) rect(10, headY + 3, 1, 1, 'c')
      }
      break
    case 'hair':
      rect(5, headY + 2, 1, 5, s.hair)
      rect(11, headY + 2, 1, 4, s.hair)
      break
    case 'wood':
      if (back) rect(8, headY + 2, 1, 3, 'd')
      else rect(8, headY + 4, 2, 1, 'N')
      break
  }

  const handX = back ? 2 : 12
  switch (s.hand) {
    case 'pick': rect(handX, 5, 1, 9, 'n'); rect(handX - 1, 5, 4, 1, 'W'); break
    case 'tube': rect(handX, 10, 3, 1, 'c'); rect(handX + 2, 9, 1, 3, 'C'); break
    case 'lever': rect(handX, 8, 1, 5, 'W'); rect(handX, 7, 2, 2, 'r'); break
    case 'bucket': box(handX - 1, 11, 4, 4, 'g'); rect(handX, 10, 2, 1, 'W'); break
    case 'crook': rect(handX + 1, 6, 1, 10, 'n'); rect(handX, 6, 2, 1, 'd'); break
    case 'rope': box(handX - 1, 10, 4, 4, 'y'); rect(handX, 11, 2, 1, 'Y'); break
    case 'broom': rect(handX, 7, 1, 7, 'n'); box(handX - 1, 12, 4, 4, 'Y'); break
    case 'sled': rect(handX - 1, 13, 4, 1, 'r'); rect(handX - 1, 14, 4, 1, 'n'); rect(handX + 2, 12, 2, 1, 'W'); break
    case 'water': box(handX - 1, 10, 4, 4, 't'); rect(handX + 2, 10, 2, 1, 'c'); break
    case 'key': rect(handX - 1, 8 + step, 4, 1, 'y'); rect(handX + 1, 7 + step, 2, 3, 'Y'); break
    case 'book': box(handX - 1, 9, 4, 4, 'p'); rect(handX + 1, 10, 1, 2, 'e'); break
    case 'tail':
      if (!back) { rect(3, 11, 1, 3, 'n'); rect(2, 10, 2, 1, 'N'); rect(4, 13, 2, 1, 'n') }
      break
  }
  return rows()
}

function goat(facing: Facing, step: number): string[] {
  const { rect, box, rows } = brush()
  const side = facing === 'side'
  const x = side ? 9 : 6
  box(side ? 2 : 5, 7, side ? 10 : 7, 6, 'W')
  box(5, 11, 2, 4 - step, 'g')
  box(9, 11, 2, 3 + step, 'g')
  rect(side ? 2 : 5, 7, 2, 2, 'G')
  box(x, 5 + step, 5, 6, 'w')
  rect(x, 3 + step, 1, 3, 'G')
  rect(x + 3, 3 + step, 1, 3, 'G')
  if (facing !== 'up') {
    rect(x + 3, 7 + step, 1, 1, 'k')
    rect(x + 2, 10 + step, 1, 2, 'g')
    rect(x + 1, 12, 1, 1, 'y')
  }
  return rows()
}

export const FRONTIER_NPC_NAMES: readonly FrontierNpcLook[] = [...Object.keys(FRONTIER_PEOPLE) as Array<keyof typeof FRONTIER_PEOPLE>, 'fellgoat']

export const FRONTIER_RAW: Record<string, string[]> = {}
for (const name of FRONTIER_NPC_NAMES) {
  for (const facing of ['down', 'up', 'side'] as const) for (const step of [0, 1]) {
    FRONTIER_RAW[`${name}_${facing}_${step}`] = name === 'fellgoat' ? goat(facing, step) : person(FRONTIER_PEOPLE[name], facing, step)
  }
}

FRONTIER_RAW.item_bathtag = [
  '................',
  '................',
  '.....kkkkkk.....',
  '....knjjjjnk....',
  '...kn...tjnk....',
  '...knjjt.jnk....',
  '...knjjj.jnk....',
  '...knjTTTjnk....',
  '...knjTjTjnk....',
  '...knjTTTjnk....',
  '...knjTjTjnk....',
  '...knjTTTjnk....',
  '....knnnnnk.....',
  '.....kkkkk......',
  '................',
  '................',
]

/** Separate silhouettes for the creatures, including their named poses. The classic palette is shared with the HUD. */
const BEASTS = {
  timberbeetle: ['..nn...nn..', '.nNj###jNn.', '..######...', '.##T##T##..', '###T##T###.', '#jj####jj#.', '.nN####Nn..', '..n####n...', '..n....n...'],
  orehopper: ['......c....', '.....cC....', '...ggCgg...', '..GgCcggG..', '.GggcCgggG.', 'GGgCwgggGG.', 'GGgggCcGGG.', '.GgccgGGG..', '..GGGGG....'],
  draug: ['....ttt....', '...tTfT....', '...TccT....', '....TT.....', '..uubbu....', '..uuubu....', 'nnnnnnn....', 'njjjnjn...n', '.nnnnjnnnnn'],
  nokk: ['.....ggg...', '....ggGgg..', '...gGcgGg..', '...GGggg...', '...gGg.....', '..ggGg.T...', '.gGggggTT..', 'TTGTGTTTTT.', '.TTTTTTTT..'],
  stonebird: ['.......G...', '......GGG..', '.....gggGy.', '...gGGcGG..', '..ggGGGG...', '.GGggGg....', 'GGggGG.....', '.GGGGG.....', '...GG.GG...'],
  grazer: ['....gggg...', '...GggggG..', '..GgGggggG.', '.GGGGGGGGG.', '.GggGcGcGG.', '.GGGGgggGG.', '..GGGGGGG..', '..GG...GG..', '..G.....G..'],
  mowermob: ['.....G.....', '....G.G....', '....G..G...', '...ggG.G...', '..ggggGG...', '.rrrcccRR..', 'RRrRRRRRRR.', '.K.RRRR.K..', '.k......k..'],
  flamingomob: ['.......mm..', '..p...pmmy.', '.pmy..pp...', '.pp...pp...', '.pp..ppp...', 'ppp.ppppp..', '.ppp.ppp...', '..n...n....', '..n...n....'],
  mailboxmob: ['...ggggg...', '..ggggggr..', '.Gggppggr..', '.GGkkkGGrr.', '.GGwkwGG...', '..GGGGGG...', '.....n.....', '.....n.....', '....nnn....'],
  grok: ['....GGG....', '...GggGG...', '..GGGGGGG..', '.GGcGGcGGG.', 'yGGGGGGGGGy', 'GGGGwGGGGGG', 'kGggggggGGk', 'kGGggggGGGk', '.kkkkkkkkk.'],
  phi: ['.....yy....', '..yYyyyYe..', '.yY..c..yY.', '.y..yy..yY.', '.yYywY..yY.', '..yyY...yY.', '......yYY..', '...YyyyY...', 'yyYyY......'],
  mixtral: ['...ttt.....', '.ggtTt.gg..', 'gGGcTGgGGg.', 'GGGgGGGGGG.', '.GGGGGGGG..', '.GgggGGGG..', 'GGGGGGGGGG.', 'GGG.GGG.GG.', 'GG.......G.'],
  orca: ['.....tt....', '...TTTtt...', '...TcCcT...', '...TTTTT...', '..uVVuVu...', '.nnuVVunn..', 'nnnjjnjn..n', 'njnjjnjnnnn', '.nnnnnnnnn.'],
  falcon: ['.......GG..', '.g...ggGy..', 'GGgggGcG...', 'GGggGGGGG..', '.GGGGGGGgg.', '..GGGgGGGGG', '...GGyGGGG.', '....GG.GG..', '....GG.G...'],
  bloom: ['...tppt....', '..tttttt...', '.tttttttt..', '.tTctTcTt..', '.tTTTTTTt..', 'TTTTpTTTTT.', 'TTTnTTTTTT.', '.TTTTTTTT..', '..TT...TT..'],
  bard: ['..yyyyyyy..', '.yRRRRRRRy.', '.yRRRRRRRy.', '.ypRRRppRy.', '.yRkyykRRy.', '.yRkkkkRRy.', '.yRRRRRRRy.', '..yyyyyyy..', '..uu...uu..'],
  copilot: ['....gggg...', '...gcccg...', '..gcggcgg..', '.grRRRRrgg.', 'rRRpppRRRRr', 'rRycCcyRRrr', 'rRRRRRRRRRr', '.kkRRRRRkk.', '.kk.....kk.'],
} as const

export type FrontierCreature = keyof typeof BEASTS
export const FRONTIER_CREATURES = Object.keys(BEASTS) as FrontierCreature[]
export const FRONTIER_BOSSES: readonly FrontierCreature[] = ['grok', 'phi', 'mixtral', 'orca', 'falcon', 'bloom', 'bard', 'copilot']

/** Special poses share the same classic name that the isometric router expects. */
export const CREATURE_POSES: Partial<Record<FrontierCreature, string[]>> = {
  nokk: ['eyes', 'risen'],
  stonebird: ['perch', 'fly'],
  grazer: ['angrya', 'angryb'],
  grok: ['roll', 'ram', 'dazed', 'drill'],
  phi: ['lit', 'eat'],
  mixtral: ['left', 'middle', 'right'],
  orca: ['row', 'strand'],
  falcon: ['perch', 'fly', 'dive', 'blind', 'quartz'],
  bloom: ['kneel', 'ring', 'calm'],
  bard: ['sing', 'dazed'],
  copilot: ['honk', 'neon', 'rust'],
}

function beast(name: FrontierCreature, facing: Facing, step: number, pose?: string): string[] {
  // (GROK is drawn whole, in the Heap's sprite file.)
  if (name === 'grok') return grokRows(facing, step, pose)
  const { rect, rows } = brush()
  if (name === 'nokk' && pose === 'eyes') {
    rect(5, 11, 6, 2, 'T')
    rect(6, 11, 1, 1, 'c')
    rect(9, 11, 1, 1, 'c')
    return rows()
  }
  const mask = BEASTS[name]
  const airborne = pose === 'fly' || pose === 'dive' || name === 'orehopper' && step === 1
  const baseY = airborne ? 3 : step ? 6 : 7
  mask.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || ch === '#') {
      if (ch === '.') return
      ch = 'N'
    }
    if (facing === 'up' && 'cpyw'.includes(ch) && y >= 2 && y < 7) ch = 'g'
    if (pose === 'angrya' || pose === 'angryb') { if (ch === 'c') ch = 'p' }
    if (pose === 'lit' || pose === 'quartz') { if (ch === 'c') ch = 'e' }
    if (pose === 'dazed' || pose === 'blind') { if ('cpr'.includes(ch)) ch = 'W' }
    const px = facing === 'side' ? 13 - x : 2 + x
    rect(px, baseY + y, 1, 1, ch)
  }))
  if (airborne && (name === 'falcon' || name === 'stonebird')) {
    rect(0, baseY + 3, 4, 2, 'G')
    rect(12, baseY + 3, 4, 2, 'g')
  }
  return rows()
}

for (const name of FRONTIER_CREATURES) {
  for (const facing of ['down', 'up', 'side'] as const) for (const step of [0, 1]) {
    FRONTIER_RAW[`${name}_${facing}_${step}`] = beast(name, facing, step)
  }
  for (const pose of CREATURE_POSES[name] ?? []) FRONTIER_RAW[`${name}_${pose}`] = beast(name, 'down', pose.endsWith('b') ? 1 : 0, pose)
}
