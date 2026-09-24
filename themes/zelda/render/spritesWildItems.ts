/**
 * Wildwood items (16×16 icons: held up, in chests, HUD and pause screen)
 * and the grappling hook's flight pieces. Original designs.
 */
import { type Rows, blank, edit, join, outline, rotCW, stamp, swapChars } from './spritesWildKit'

// ---------------------------------------------------------------------------
// Grappling hook: a chrome claw over a coil of chain.
// ---------------------------------------------------------------------------

const CLAW: Rows = [
  '.k..k..k.',
  'kWkkWkkWk',
  'kWkkWkkgk',
  'kWWkWkWgk',
  '.kWWWWgk.',
  '.kWwWggk.',
  '..kgGGk..',
  '...kgk...',
]

const itemHook: Rows = (() => {
  const g = blank(16, 16)
  // The coil: a ring of alternating light and dark links.
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x + 0.5 - 8.5, (y + 0.5 - 11.5) * 1.25)
      if (Math.abs(d - 4.6) < 0.8) g[y]![x] = (x + y) % 3 === 0 ? 'G' : (x + y) % 3 === 1 ? 'g' : 'W'
    }
  }
  // The loose end trailing off to the left.
  g[14]![1] = 'g'; g[14]![2] = 'W'; g[13]![2] = 'G'
  const out = outline(join(g)).map(r => r.split(''))
  stamp(out, CLAW, 4, 0)
  return join(out)
})()

const hookHeadV: Rows = [
  '.k.k.k.',
  'kWkWkWk',
  'kWkWkgk',
  'kWWWWgk',
  '.kgWgk.',
  '..kgk..',
  '..kGk..',
]
const hookHeadH = rotCW(hookHeadV)
const hookLink: Rows = [
  'kWk',
  'W.G',
  'kGk',
]

// ---------------------------------------------------------------------------
// Arc Blade: the sword icon, blade gone white-hot with gold and violet
// edges, a gold grip and a crackle of lightning.
// ---------------------------------------------------------------------------

const SWORD_ICON: Rows = [
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
const itemArc = edit(swapChars(SWORD_ICON, { c: 'y', n: 'Y', N: 'y' }),
  [9, 1, 'w'], [8, 2, 'v'], [8, 3, 'v'], [7, 4, 'v'], [6, 5, 'w'], [5, 6, 'v'],
  [14, 4, 'w'], [13, 5, 'v'], [12, 7, 'v'], [11, 8, 'w'],
  [12, 3, 'e'], [10, 5, 'e'], [8, 7, 'e'])

// ---------------------------------------------------------------------------
// Big bomb bag: the bomb bag, grown fuller, lime drawstring and stitching.
// ---------------------------------------------------------------------------

const itemBigbag: Rows = [
  '.....kk..kk.....',
  '....klk..klk....',
  '.....klkklk.....',
  '...kkkkLLkkkk...',
  '..knnnkllknnNk..',
  '.knnnnnkknnnnNk.',
  'knjnnkkkkkknnnNk',
  'knnnkBbbBBBknnNk',
  'knnkbwbBBBBBknNk',
  'knnkbbBBBBBBknNk',
  'knnkBBBBBBBukNNk',
  'kNnnkBBBBBukNnNk',
  'klnlnkkkkkknlNlk',
  'kNlNlNlNlNlNlNNk',
  '.kNNNNNNNNNNNNk.',
  '..kkkkkkkkkkkk..',
]

// ---------------------------------------------------------------------------
// Golden waffle: a rounded grid, a pat of butter, a drip of syrup.
// ---------------------------------------------------------------------------

const itemWaffle: Rows = (() => {
  const g = blank(16, 16)
  for (let y = 2; y <= 14; y++) {
    for (let x = 1; x <= 14; x++) {
      const corner = (x === 1 || x === 14) && (y === 2 || y === 14)
      if (corner) continue
      const ridge = (x - 1) % 3 === 0 || (y - 2) % 3 === 0
      const lit = x + y < 12
      g[y]![x] = ridge ? (lit ? 'e' : x + y > 22 ? 'Y' : 'y') : (x + y > 22 ? 'o' : 'Y')
    }
  }
  const out = outline(join(g)).map(r => r.split(''))
  // Butter.
  const butter: Rows = ['.ww.', 'wwee', 'weey', '.YY.']
  stamp(out, butter, 6, 5)
  // Syrup running off the butter.
  out[9]![8] = 'o'; out[10]![8] = 'o'; out[11]![8] = 'i'; out[9]![7] = 'o'
  return join(out)
})()

// ---------------------------------------------------------------------------
// Glowing teal mushroom.
// ---------------------------------------------------------------------------

const itemShroom: Rows = [
  '..c.........c...',
  '.....kkkkkk.....',
  '...kkttcttTkk...',
  '..ktcwcttttTTk..',
  '.ktcwctttwtttTk.',
  '.kttctttwwttTTk.',
  'kttttttttttttTTk',
  'kTttwttttttTTTTk',
  '.kkTTTTTTTTTTkk.',
  'c...kkWwwWkk...c',
  '.....kwwwWk.....',
  '.....kwwwWk.....',
  '....kwwwwWWk....',
  '....kWwwwWWk..c.',
  '.....kkkkkk.....',
  '................',
]

// ---------------------------------------------------------------------------
// Vacuum tube: glass envelope, plates, an orange filament glow, gold pins.
// ---------------------------------------------------------------------------

const itemTube: Rows = [
  '.......kk.......',
  '......kqqk......',
  '.....kqwqqk.....',
  '....kqwqqqqk....',
  '...okqwGGGqko...',
  '....kqGyoGqk....',
  '...okqGoyGqko...',
  '....kqGyoGqk....',
  '....kqGoyGqk....',
  '....kqwGGGqk....',
  '....kqqqqqqk....',
  '...kkGGGGGGkk...',
  '...kGggWgggGk...',
  '...kGGGGGGGGk...',
  '....kykykykk....',
  '.....k.k.k......',
]

// ---------------------------------------------------------------------------
// Walkie-talkie: chunky grey body, lime display, grille, antenna.
// ---------------------------------------------------------------------------

const itemWalkie: Rows = [
  '....kk..........',
  '....kgk.........',
  '....kgk.........',
  '....kgk...kkk...',
  '...kkGkkkkrkyk..',
  '..kWggggggggGk..',
  '..kgkkkkkkkkGk..',
  '..kgkllllLLkGk..',
  '..kgkLLLLLLkGk..',
  '..kgkkkkkkkkGk..',
  '..kgkgkgkgkgGk..',
  '..kgkgkgkgkgGk..',
  '..kgggggggggGk..',
  '..kgrgkyykgGGk..',
  '..kGGGGGGGGGGk..',
  '...kkkkkkkkkk...',
]

// ---------------------------------------------------------------------------
// The troll's hat: battered green felt, a drooping tip, a patch, a hole.
// ---------------------------------------------------------------------------

const itemHat: Rows = [
  '................',
  '........kkkk....',
  '.......kfffFk...',
  '......kffkkFFk..',
  '......kfFk.kFk..',
  '.....kffFk..kk..',
  '.....kffFFk.....',
  '....kfnnffFk....',
  '....knynfFFk....',
  '...kfnnfffFFk...',
  '...kffkfffFFk...',
  '..knnnnnnnnnnk..',
  '.kfffffffffFFFk.',
  '.kFfffffffFFFFk.',
  '..kkkkkkkkkkkk..',
  '................',
]

export const ITEMS: Record<string, Rows> = {
  item_hook: itemHook, item_arc: itemArc, item_bigbag: itemBigbag, item_waffle: itemWaffle,
  item_shroom: itemShroom, item_tube: itemTube, item_walkie: itemWalkie, item_hat: itemHat,
  hook_head_v: hookHeadV, hook_head_h: hookHeadH, hook_link: hookLink,
}
