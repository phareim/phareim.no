/**
 * Dig & build's pictures (`engine/dig.ts`): the tools (16×16: held up,
 * in the HUD's item box and on the touch deck's B button) and the four
 * materials (8×8: the HUD's counter while a tool is out). Original designs,
 * in the shared palette's letters.
 */

const itemPickaxe = [
  '................',
  '....kkkkkkk.....',
  '..kkWWWWWWWkk...',
  '.kWWgggggggWWk..',
  'kWgkkkkkkkkkgWk.',
  'kgk....kNk..kgk.',
  '.k.....kNk...k..',
  '.......knk......',
  '.......knk......',
  '.......knk......',
  '.......knk......',
  '.......kjk......',
  '.......knk......',
  '.......knk......',
  '.......kNk......',
  '........k.......',
]

// The deep-quarry upgrade, ready for the chrome-pick reward.
const itemChromePick = [
  '................',
  '.......kkkk.....',
  '.....kkWWCWkk...',
  '...kkWWcCcWWgk..',
  '..kWcCkkkkcWWgk.',
  '.kCckk....kcWgk.',
  '.kck...kk..kcgk.',
  '..k...kjNk..kGk.',
  '.....kjNk....k..',
  '....kjNk........',
  '...kjNk.........',
  '..kjNk..........',
  '.kYNk...........',
  '.kVk............',
  '..k.............',
  '................',
]

const itemShovel = [
  '.......kk.......',
  '......kyyk......',
  '......kYYk......',
  '.......kk.......',
  '.......knk......',
  '.......knk......',
  '.......kjk......',
  '.......knk......',
  '.....kkkNkkk....',
  '....kWWWWWWgk...',
  '....kWwWWWWgk...',
  '....kWWWWWggk...',
  '....kgWWWWggk...',
  '.....kgWWggk....',
  '......kggGk.....',
  '.......kkk......',
]

const itemAxe = [
  '................',
  '.........kkk....',
  '........kWWWk...',
  '.......kWwWgGk..',
  '......kkWWWggGk.',
  '.....knkkWggGGk.',
  '....knk..kgGGk..',
  '...knk....kkk...',
  '..knk...........',
  '.kjk............',
  'knk.............',
  'kNk.............',
  '.k..............',
  '................',
  '................',
  '................',
]

const itemHammer = [
  '................',
  '...kkkkkkkk.....',
  '..kWWWWWWWgk....',
  '..kWwWWWWggk....',
  '..kgWWWWgGGk....',
  '...kkkknkkk.....',
  '......knk.......',
  '......knk.......',
  '......kjk.......',
  '......knk.......',
  '......knk.......',
  '......kjk.......',
  '......knk.......',
  '......kNk.......',
  '.......k........',
  '................',
]

const hudDirt = [
  '........',
  '..kkkk..',
  '.kiaaik.',
  'kaiaaaak',
  'kaaiaaak',
  'kaaaaiak',
  '.kkkkkk.',
  '........',
]
const hudStone = [
  '........',
  '.kkkkkk.',
  'kWWgWWgk',
  'kgggkggk',
  'kkkkkkkk',
  'kWgWWgGk',
  'kgGggGGk',
  '.kkkkkk.',
]
const hudWood = [
  '........',
  '.kkkkkk.',
  'knjnnjnk',
  'knnnnnnk',
  'kNNNNNNk',
  'knjnnjnk',
  '.kkkkkk.',
  '........',
]
const hudLumen = [
  '...kk...',
  '..kmpk..',
  '.kmwmpk.',
  '.kmmppk.',
  'kpmmpPPk',
  '.kppPPk.',
  '..kPPk..',
  '...kk...',
]

export const DIG_RAW: Record<string, string[]> = {
  item_pickaxe: itemPickaxe, item_shovel: itemShovel, item_axe: itemAxe, item_hammer: itemHammer,
  item_chromePick: itemChromePick,
  hud_dirt: hudDirt, hud_stone: hudStone, hud_wood: hudWood, hud_lumen: hudLumen,
}
