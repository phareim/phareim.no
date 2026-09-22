/**
 * The overworld: one 64×48 map the camera scrolls over freely. Six areas —
 * Whisper Woods (NW), Night Market (N), Hollow Graves (NE, the Shrine's
 * door), Home Glade (SW, the start), the Crossroads and Mirror Lake (SE).
 * Tile legend: types.ts. Marker chars are listed in `marks` below.
 */
import type { MapDef } from '../types'

export const OVERWORLD: MapDef = {
  id: 'overworld',
  name: 'THE NEON COAST',
  kind: 'overworld',
  track: 'overworld',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT####################################',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTT#T:..................:T######II#####',
    'TTT:..;;:TTTTTTTTTTTTTT.:.TT#..HHHHHHH....HHHHHH...#####IVVI####',
    'TT..:....TTTTTTTTTTTTTT.5.TT#..HHHHHHH....HHHHHH...#####IW.I####',
    'TT:..4...:.....;;..TTTT...TT#t.HHHMHHH..t.HHHMHH.t.######RR#####',
    'TT..:...:.TTTTT;;;..TTTTRTTT#..HHHBHHH....HHHNHH...##T:......:T#',
    'TTT:..a..TTTTTTT;;..TTTT.TTT#.....E....:.....U.....##.G..G..G..#',
    'TTTT....TTT;;TTTT...TTT;.;TT#.t,,,,,,,,,,,,,,,,,,t.##.....z....#',
    'TTTTT..TTT;;;;TT..a..TT...TT#..,:,,,,,,,,,,,,,,:,..##.G..G..G.g#',
    'TTTT...TTTT;;TTT.....TT.;.TT#..,,,,,t~~~~t,,,,,,,..##..........#',
    'TTT;..;..TTTTTTT..d.....;......,,,,,,~~~~,,,,y,,,..##.G..G..G..#',
    'TTT;;...;TTTTTTTT.......;......,,,,,,~~~~,,,,,,,,..##:....z....#',
    'TTTT;...;;TTTTTTTTTTT;;TTTTT#..,,,,,t~~~~t,,,,,,,..............#',
    'TTTTT..;;;;TTTTTTTTT;;;;TTTT#..,:,,,,,,,,,,,,,,:,.......+......#',
    'TTTTT...d..;TTTTTT;;*;;TTTTT#.t,,,,,,,k,,,,,,,,,,t.##.G..G..G..#',
    'TTTTTT.....;;TTTT;;*;*;TTTTT#T..:....,,,,....:...T.##..........#',
    'TTTTTTT..TTTT;;;;;;;*;TTTTTT#TT*....:,,,,:....*..TT##T.G..G..G.#',
    'TTTTTT...TTTTTTTTTTTTTTTTTTT#TTT*...,,,,,,....*TTTT##T....z....#',
    'TTTTTT...TTTTTTTTTTTTTTTTTTT#TTTT..&.,,,,,...TTTTTT##TT.......T#',
    'TTTTTT..TTTTTTTTTTTTTTTTTTTT#TTTTTTTTTT,,TTTTTTTTTT##TT..*..*.T#',
    'TTTTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTT#TTT.....TT#',
    'TTTTT....TTTTTTTTTT:.:TTTTTTTTTTTT:....,,.....:...TT#TT;;..;;TT#',
    'TTTT:..,..:TTTTTT*......*TTTTTTTT..j...,,......*...T#T;;;...;TT#',
    'TTT....,.......................,,,,,,,,,,,..!......T#T;..q..;;T#',
    'TT.....,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..;.....;TT#',
    'TT..HHHHHH.,.:........;;;...t..TT.....q..,,,,,,,,,,,...;..;..TT#',
    'TTo.HHHHHH.,..........;;;......TTT..*....,,..j...:TT#TTTTTTTTTT#',
    'TTo.HHHHHH.,...t..e...;;;......TTTTTTTTTT,,TTTTTTTTT############',
    'TT..HHHHHH.,.......:...........TTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTT',
    'TT..t.2.3..,.........*..*......TTT:.....,,...:.......:....TTTTTT',
    'TT.?..1....,............e......TT.....,,,.......*...........:TTT',
    'TT:..o.....,.......:...........TT...,,...~~~~~~~~~~~~~~~~~.....T',
    'TT....,,,,,,.....;;;;.....*....TT..,,..~~~~~~~~~~~~~~~~~~~~~...T',
    'TTT..,.................;;......TT..,..~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TTTT.,..:.....*.............:..TT..,.~~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TTT..,.....*..*..e.............TT..,.~~~~~~~~~...~~~~~~~~~~~~..T',
    'TT...,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,===========.6.~~~~~~~~~~~..T',
    'TT:...;;;.......:.......;;.....,,,,,.~~~~~~~~~...~~~~~~~~~~~~..T',
    'TT...;;;;;..rrr.....*..........TT..,.~~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TT....;;;.rr.7.r....:.....e....TT../..~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TT........rr...r........*......TT..,,..~~~~~~~~~~~~~~~~~~~~~...T',
    'TT.:.......rrrr..........;;;...TT...,,...~~~~~~~~~~~~~~~~~.....T',
    'TT..~~~.............:...;;;;...TT.....,,,,,,,,,,,,,,,,,,,,,,...T',
    'TT.~~~~~.....*.............:..TTT.:...e.......;;;......e...:...T',
    'TT..~~~.....:.......*.......TTTTT....*..j.......;;;....tA......T',
    'TTT......TT.....TT......TTTTTTTTT#######################%#######',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT#######################Q#######',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT################################',
  ],
  areas: [
    { name: 'WHISPER WOODS', x: 0, y: 0, w: 28, h: 20, entry: 'woods' },
    { name: 'NIGHT MARKET', x: 28, y: 0, w: 24, h: 20, track: 'village', entry: 'market' },
    { name: 'HOLLOW GRAVES', x: 52, y: 0, w: 12, h: 28, entry: 'graves' },
    { name: 'HOME GLADE', x: 0, y: 20, w: 32, h: 28, entry: 'start' },
    { name: 'THE CROSSROADS', x: 32, y: 20, w: 20, h: 8, entry: 'crossroads' },
    { name: 'MIRROR LAKE', x: 32, y: 28, w: 32, h: 20, entry: 'lake' },
  ],
  // Continue points per area (death puts you back at the last one visited).
  entries: {
    woods: { x: 7, y: 17.5, dir: 'up' },
    market: { x: 40, y: 17.5, dir: 'up' },
    graves: { x: 53.5, y: 12.5, dir: 'right' },
    crossroads: { x: 40.5, y: 24.5, dir: 'right' },
    lake: { x: 42, y: 29.5, dir: 'down' },
  },
  marks: {
    // Home Glade
    '1': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    '2': { ent: { t: 'chest', id: 'ow.sword', item: 'sword' } },
    '3': {
      ent: {
        t: 'npc', id: 'keeper', look: 'keeper', dir: 'left',
        talk: [
          {
            when: { notFlag: 'item:sword' },
            lines: [
              'KEEPER: THERE YOU ARE. THE SUN HAS HUNG ON THE HORIZON FOR THREE NIGHTS NOW.',
              'THE STATIC KING CRAWLED OUT OF THE OLD NEON SHRINE AND TOOK THE SUN PRISM.',
              'OPEN THAT CHEST. THE BLADE INSIDE IS YOURS NOW.',
            ],
          },
          {
            when: { notFlag: 'item:bombBag' },
            lines: [
              'KEEPER: THE SHRINE LIES NORTH OF THE HOLLOW GRAVES, PAST THE NIGHT MARKET.',
              'RUBBLE SEALS ITS DOOR. SOMETHING IN WHISPER WOODS, UP NORTH, COULD BLOW IT OPEN.',
            ],
          },
          {
            when: { notFlag: 'boss' },
            lines: ['KEEPER: BOMBS! GOOD. NOW TO THE GRAVES, AND MIND THE JELLIES. THEY BITE BACK.'],
          },
          { lines: ['KEEPER: LOOK AT THAT SKY. WELL DONE, KID.'] },
        ],
      },
    },
    '?': { tile: 'S', ent: { t: 'sign', lines: ["KEEPER'S HUT.   ↑ WHISPER WOODS   → NIGHT MARKET"] } },
    '7': { ent: { t: 'chest', id: 'ow.rockring', item: 'bits20' } },
    // Whisper Woods
    '4': { ent: { t: 'chest', id: 'ow.bombbag', item: 'bombBag' } },
    '5': { ent: { t: 'item', id: 'ow.piece.woods', item: 'heartPiece' } },
    // Night Market
    'B': { tile: 'D', ent: { t: 'warp', to: 'shop', entry: 'door' } },
    'N': { tile: 'D', ent: { t: 'warp', to: 'arcade', entry: 'door' } },
    'E': { ent: { t: 'entry', id: 'shop', dir: 'down' } },
    'U': { ent: { t: 'entry', id: 'arcade', dir: 'down' } },
    'k': {
      ent: {
        t: 'npc', id: 'kid', look: 'kid', wander: true,
        talk: [
          { when: { notFlag: 'item:bombBag' }, lines: ['KID: BUSHES AND POTS HIDE BITS. THE SHOP TAKES BITS. DO THE MATH.'] },
          { lines: ['KID: BOMBS CRACK ANYTHING THAT LOOKS CRACKED. WALLS TOO. EVEN IN THE LAKE CLIFFS.'] },
        ],
      },
    },
    'y': { ent: { t: 'npc', id: 'cat', look: 'cat', wander: true, talk: [{ lines: ['MRRROW.'] }] } },
    '&': { tile: 'S', ent: { t: 'sign', lines: ['NIGHT MARKET. OPEN ALL NIGHT.', '(IT IS ALWAYS NIGHT.)'] } },
    // Hollow Graves
    'V': { tile: '>', ent: { t: 'warp', to: 'shrine', entry: 'start' } },
    'W': { ent: { t: 'entry', id: 'shrine', dir: 'down' } },
    'g': {
      ent: {
        t: 'npc', id: 'ghost', look: 'ghost', dir: 'left',
        talk: [
          { when: { notFlag: 'item:bombBag' }, lines: ['GHOST: BOO. SORRY. HABIT.', 'THE SHRINE IS SEALED BY RUBBLE. ONLY A BLAST WILL MOVE IT.'] },
          { lines: ['GHOST: THE JELLIES SPARK WHEN STRUCK. A BLAST OR A THROWN POT DOES THE TRICK.'] },
        ],
      },
    },
    '+': { tile: 'S', ent: { t: 'sign', lines: ['HOLLOW GRAVES.   ↑ THE NEON SHRINE'] } },
    // Crossroads
    '!': { tile: 'S', ent: { t: 'sign', lines: ['↑ NIGHT MARKET   → HOLLOW GRAVES   ↓ MIRROR LAKE   ← HOME'] } },
    // Mirror Lake
    '6': { ent: { t: 'chest', id: 'ow.island', item: 'bits50' } },
    '/': { tile: 'S', ent: { t: 'sign', lines: ['MIRROR LAKE. THE SUN STILL SHINES IN IT.'] } },
    'A': { ent: { t: 'entry', id: 'cave', dir: 'down' } },
    'Q': { tile: 'D', ent: { t: 'warp', to: 'cave', entry: 'door' } },
    // Enemies
    'e': { ent: { t: 'enemy', kind: 'blob' } },
    'a': { ent: { t: 'enemy', kind: 'bat' } },
    'd': { ent: { t: 'enemy', kind: 'dasher' } },
    'j': { ent: { t: 'enemy', kind: 'spitter' } },
    'q': { ent: { t: 'enemy', kind: 'sentry' } },
    'z': { ent: { t: 'enemy', kind: 'zapper' } },
  },
}
