/**
 * THE UNDERGLOW: the descent under Lumenby Quarry's deep drift (docs/worlds/realm-underglow.md, atlas.md). Three
 * hand-made floors of 3×2 camera rooms, two of the old six layers on each, each a little stranger than the one above.
 * Not on the grid: the drift's shaft in Lumenby leads down to the first floor's stairs, and the Geyser at the bottom
 * throws the hero back up to the drift's mouth.
 *
 *   underglow1  ECHO LEDGES (top row) and THE UPSIDE GROVE (bottom row)
 *     (0,0) the shaft foot: stairs up, Rut's lift   (1,0) the rails: BROR's camp      (2,0) the old drift (dark): bats, key
 *     (0,1) the hanging garden (dark): heart piece   (1,1) the grove: SIGGE            (2,1) the root stair: locked, stairs down
 *   The key lies in the old drift once its bats are down; the root stair's door takes it. The heart piece sits on an
 *   island in the garden's void, seen from the grove's door; the hook only reaches it from the north ledge, and the
 *   north ledge is behind the cracked wall in the shaft foot's south side (bombs).
 *
 *   underglow2  THE GLASS SEA (top row) and BROADCAST (bottom row)
 *     (0,0) the shore: stairs up, HANNA               (1,0) the still water            (2,0) the far ledge: blobs, key, grotto
 *     (0,1) the low stair (dark): stairs down, lever  (1,1) the consoles: heart piece  (2,1) the masts: ECHO, crystal switch
 *   The still water is crossed by the hook over the broken bridge, or the long way over the stepping stones; a chest on
 *   an islet needs the hook both ways. Pink blocks wall the masts in two; the switch stands on the far side (the hook or
 *   a thrown pot flips it). The consoles' heart piece is caged in cyan blocks: flip the switch back from the inner side.
 *   The low stair's lever opens the shutter up to the shore, the shortcut home. A cracked boulder hides the grotto.
 *
 *   underglow3  THE FOSSIL ARCADE (top row and the vault) and THE CORE (bottom right)
 *     (0,0) the cabinet row: stairs up                (1,0) the herd: the HERDSMAN     (2,0) the bone road: a push block
 *     (0,1) the fossil vault (dark, bomb the crack)   (1,1) the sun below: the Geyser  (2,1) the gold vein: key
 *   The bone road's block on its plate opens the shutter down to the gold vein; its foes guard the key to the Core.
 *   The Sun Below lies in the Core's floor; stepping onto it is the Geyser, which goes all the way up to Lumenby.
 *
 * Entries on every floor: `up` (beside the stairs up) and `down` (beside the stairs down, or the Geyser).
 * Marker chars are listed in each floor's `marks`.
 */
import type { EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { joinCells } from './cells'
import { at, cycle, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })
const foe = (kind: Extract<EntDef, { t: 'enemy' }>['kind'], tile?: Mark['tile']): Mark => (tile ? { tile, ent: { t: 'enemy', kind } } : { ent: { t: 'enemy', kind } })

const RANKS = ['rose', 'pink', 'cyan'] as const
/** The Delvers' Club's glowstick by a floor's way down: one rank a floor, breathing its colour. */
const glowstick = (rank: (typeof RANKS)[number], x: number, y: number): IsoLandmark =>
  prop(`underglow_glowstick_${rank}`, x, y, { lights: [light(rank, 2.6, 0.85, { z: 0.5, anim: 'pulse' })] })
/** An Upside Grove tree over its root tile 'T': crown on the floor, roots reaching up into the dark. */
const roots = (x: number, y: number): IsoLandmark => prop('underglow_roots', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 }, lights: [light('teal', 1.6, 0.45, { z: 1.4, anim: 'pulse' })] })
/** A ledge's face hanging into the void south of (s), east of (e), or both (se). */
const ledge = (side: 's' | 'e' | 'se', x: number, y: number): IsoLandmark => prop(`underglow_ledge_${side}`, x + 0.5, y + 0.5)
/** The ledge faces along a void's north and west edges: the tiles north of a pit run and west of it. */
function rim(x: number, y: number, w: number, h: number): IsoLandmark[] {
  const out: IsoLandmark[] = []
  for (let i = 0; i < w; i++) out.push(ledge('s', x + i, y - 1))
  for (let j = 0; j < h; j++) out.push(ledge('e', x - 1, y + j))
  return out
}

// ======================================================================= underglow1: ECHO LEDGES / THE UPSIDE GROVE

const SHAFT_FOOT = [
  '################',
  '#t.....V......t#',
  '#......@.......#',
  '#..............#',
  '#...OOOO.......#',
  '#...OOOO.=======',
  '#...OOOO........',
  '#..............#',
  '#.1............#',
  '#..............#',
  '#t............t#',
  '#######%%#######',
]

const RAILS = [
  '################',
  '#t...:....:...t#',
  '#..............#',
  '#..OOOO..OOOO..#',
  '#..OOOO..OOOO..#',
  '================',
  '................',
  '#..............#',
  '#.......g......#',
  '#..............#',
  '#t..2.........t#',
  '#######..#######',
]

const OLD_DRIFT = [
  '################',
  '#t....OOO.....t#',
  '#.....OAO......#',
  '#.OO..OOO..OO..#',
  '#.OO..OOO..AO..#',
  '==============.#',
  '......===......#',
  '#.OO..OOO..OO..#',
  '#.AO..OOO..OO..#',
  '#.....OOO......#',
  '#t....OOO....kt#',
  '################',
]

const HANGING_GARDEN = [
  '#######..#######',
  '#T.T.T...t.#####',
  '#..........#####',
  '#OOOOOOOOOO....#',
  '#OOAOOOOOOO....#',
  '#OOOOOth..O.....',
  '#OOOOOOO|OO.....',
  '#OOOOOOOOAO....#',
  '#OOOOOOOOOO....#',
  '#..............#',
  '#t.....t......t#',
  '################',
]

const GROVE = [
  '#######..#######',
  '#T.T..T..T..T.T#',
  '#..............#',
  '#.:..T....T..:e#',
  '#..............#',
  '..........:.....',
  '....T.......T...',
  '#..............#',
  '#.:..T.s..T..:.#',
  '#e.............#',
  '#T..:..TT..:..T#',
  '################',
]

const ROOT_STAIR = [
  '################',
  '#t..........v.t#',
  '#..T....T...E..#',
  '#..............#',
  '#......:.......#',
  'L..............#',
  'L.....T........#',
  '#..............#',
  '#..e...:..T....#',
  '#.......a......#',
  '#t..T.....T...t#',
  '################',
]

export const UNDERGLOW1: MapDef = {
  id: 'underglow1',
  name: 'THE UNDERGLOW',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'quarry',
  realm: 'underglow',
  views: ['iso'],
  keyring: 'underglow',
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'ECHO LEDGES', events: [{ lines: ['THE UNDERGLOW. LAYER ONE: ECHO LEDGES.', 'EVERY STEP COMES BACK A MOMENT LATE.'], set: 'underglow1.layer' }] },
    '1,0': { name: 'ECHO LEDGES' },
    '2,0': { name: 'ECHO LEDGES', dark: true },
    '0,1': { name: 'THE UPSIDE GROVE', track: 'forest', dark: true },
    '1,1': { name: 'THE UPSIDE GROVE', track: 'forest', events: [{ lines: ['LAYER TWO: THE UPSIDE GROVE.', 'THE TREES HERE GROW DOWN FROM THE ROOF, AND THEIR ROOTS REACH UP INTO THE DARK.'], set: 'underglow1.grove' }] },
    '2,1': { name: 'THE UPSIDE GROVE', track: 'forest' },
  },
  rows: joinCells([
    [SHAFT_FOOT, RAILS, OLD_DRIFT],
    [HANGING_GARDEN, GROVE, ROOT_STAIR],
  ]),
  isoLandmarks: [
    // The shaft foot: the void the lift hangs over, Rut's lift head on its north lip, the cage half way down.
    ...rim(4, 4, 4, 3),
    prop('underglow_lift_wheel', 5.5, 4.0, { motion: cycle(4, 1) }),
    prop('underglow_lift_cage', 5.5, 4.72, { z: -0.35, lights: [light('gold', 1.8, 0.75, { z: 0.6 })] }),
    // The rails: two voids under the line, and Bror's camp south of it.
    ...rim(19, 3, 4, 2), ...rim(25, 3, 4, 2),
    prop('camp_shelter', 21.3, 7.6),
    prop('camp_fire', 21.5, 9.0, { ...at(21, 8), motion: cycle(4, 5), lights: [light('fire', 3.2, 0.8, { z: 0.4, anim: 'fire' })] }),
    prop('camp_tripod', 21.5, 9.0),
    prop('camp_log', 20.6, 9.6),
    prop('camp_log', 22.5, 9.5),
    prop('camp_board_gold', 27.4, 8.2),
    // The old drift: a void down its middle under the plank bridge, two more either side.
    ...rim(38, 1, 3, 4), ...rim(38, 7, 3, 4), ...rim(34, 3, 2, 2), ...rim(34, 7, 2, 2), ...rim(43, 3, 2, 2), ...rim(43, 7, 2, 2),
    // The hanging garden: the north ledge's face over the void, the island's.
    ...Array.from({ length: 10 }, (_, i) => ledge('s', 1 + i, 2)),
    ledge('s', 6, 17), ledge('s', 7, 17), ledge('se', 9, 17), ledge('s', 8, 16),
    roots(1, 13), roots(3, 13), roots(5, 13),
    // The grove.
    ...([[17, 13], [19, 13], [22, 13], [25, 13], [28, 13], [30, 13], [21, 15], [26, 15], [20, 18], [28, 18], [21, 20], [26, 20], [17, 22], [23, 22], [24, 22], [30, 22]] as const).map(([x, y]) => roots(x, y)),
    // The root stair, and the rose stick by the way down.
    roots(35, 14), roots(40, 14), roots(38, 18), roots(42, 20), roots(36, 22), roots(42, 22),
    glowstick('rose', 45.45, 14.5),
  ],
  marks: {
    V: { tile: '>', ent: { t: 'warp', to: 'lumenby', entry: 'deep' } },
    '@': { ent: { t: 'entry', id: 'up', dir: 'down' } },
    v: { tile: '>', ent: { t: 'warp', to: 'underglow2', entry: 'up' } },
    E: { ent: { t: 'entry', id: 'down', dir: 'down' } },
    '1': sign('ECHO LEDGES. LAYER ONE.\nTHE LIFT IS BEING MENDED.\n↑ LUMENBY QUARRY.'),
    '2': sign('THE RAILS HOLD.\n(SCRATCHED UNDER IT: B.G.)'),
    g: npc('q.lamp.bror', 'dusty', [
      { when: { flag: 'q.lamp.got' }, lines: ['BROR: GO ON UP. GUNN WILL BE AT THE UNION HALL. SHE ALWAYS IS.'] },
      { lines: ['BROR: FROM UP TOP? TELL MY SISTER GUNN THE RAILS HOLD.', "BROR: TAKE HER MY LAMP. I CAN'T CLIMB ANY MORE, AND I LIKE IT HERE. IT'S WARM."], set: 'q.lamp.got' },
    ]),
    s: npc('d.sigge', 'kid', [{ lines: ["SIGGE: I'M ONLY ALLOWED DOWN TO LAYER TWO. THIS IS LAYER TWO. I CHECKED.", "SIGGE: THE TREES HERE GROW DOWN FROM THE ROOF. DON'T LOOK UP FOR TOO LONG."] }]),
    k: { ent: { t: 'chest', id: 'underglow1.key', item: 'smallKey', appear: { clear: true } } },
    h: { ent: { t: 'item', id: 'underglow1.piece', item: 'heartPiece' } },
    a: foe('bat'),
    A: foe('bat', 'O'),
    e: foe('blob'),
  },
}

// ======================================================================= underglow2: THE GLASS SEA / BROADCAST

const SHORE = [
  '################',
  '#t.....V......t#',
  '#......@.......#',
  '#..............#',
  '#...........~~~#',
  '#...........~~~.',
  '#..........--...',
  '#....j.....--~~#',
  '#.1.......~~~~~#',
  '#........~~~~~~#',
  '#t......~~~~~~t#',
  '#######..#######',
]

const STILL_WATER = [
  '################',
  '#t~~~~~~~~~~~~t#',
  '#~~~~~~~~~~~4~~#',
  '#~~~~~~~~~~~..~#',
  '#~~~~~~~~~~~~~~#',
  '.====~~~~======.',
  '.====~~~~=|====.',
  '#~.~~~~~~~~..|~#',
  '#~..~...~...~~~#',
  '#~~...~.e.~~~~~#',
  '#t~~~~~~~~~~~~t#',
  '################',
]

const FAR_LEDGE = [
  '################',
  '#t~~~......#.5.#',
  '#~~~.......#...#',
  '#~~.........#R##',
  '#~~...e........#',
  '...............#',
  '...............#',
  '#~~........e...#',
  '#~~~...........#',
  '#~~~~.e........#',
  '#t~~~~...k....t#',
  '#######..#######',
]

const LOW_STAIR = [
  '#######WX#######',
  '#t........y...t#',
  '#..............#',
  '#..v...........#',
  '#..E...........#',
  '#...............',
  '#...............',
  '#..............#',
  '#..............#',
  '#...........a..#',
  '#t............t#',
  '################',
]

const CONSOLES = [
  '################',
  '#t.n.......n..t#',
  '#..............#',
  '#.....CCC......#',
  '#.....ChC......#',
  'L.....CCC.......',
  'L...............',
  '#..............#',
  '#.n....z....n..#',
  '#..............#',
  '#t............t#',
  '################',
]

const MASTS = [
  '#######..#######',
  '#t....P.......t#',
  '#.....P....3...#',
  '#..c..P.....M..#',
  '#.....P........#',
  '......P...z....#',
  '..u...P........#',
  '#.....P.M...Q..#',
  '#.M...P........#',
  '#.....P..oo.z..#',
  '#t....P...o...t#',
  '################',
]

export const UNDERGLOW2: MapDef = {
  id: 'underglow2',
  name: 'THE UNDERGLOW',
  kind: 'dungeon',
  track: 'dungeon',
  look: 'quarry',
  realm: 'underglow',
  views: ['iso'],
  keyring: 'underglow',
  crystal: 'underglow2',
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE GLASS SEA', track: 'beach', events: [{ lines: ['LAYER THREE: THE GLASS SEA.', 'WATER SO STILL IT LOOKS LIKE A FLOOR. IT IS NOT A FLOOR.'], set: 'underglow2.layer' }] },
    '1,0': { name: 'THE GLASS SEA', track: 'beach' },
    '2,0': { name: 'THE GLASS SEA', track: 'beach' },
    '0,1': { name: 'BROADCAST', track: 'static', dark: true, mood: 'static' },
    '1,1': { name: 'BROADCAST', track: 'static', mood: 'static' },
    '2,1': { name: 'BROADCAST', track: 'static', mood: 'static', events: [{ lines: ['LAYER FOUR: BROADCAST.', 'THE STATIC DOWN HERE HAS A VOICE, AND IT IS LISTENING.'], set: 'underglow2.broadcast' }] },
  },
  rows: joinCells([
    [SHORE, STILL_WATER, FAR_LEDGE],
    [LOW_STAIR, CONSOLES, MASTS],
  ]),
  isoLandmarks: [
    // The Delvers' rest on the shore: a fire with logs round it by the water, the club's board by the stairs.
    prop('camp_fire', 9.5, 5.5, { ...at(9, 5), motion: cycle(4, 5), lights: [light('fire', 3, 0.75, { z: 0.4, anim: 'fire' })] }),
    prop('camp_log', 8.6, 6.1), prop('camp_log', 10.4, 6.0), prop('camp_log', 9.5, 4.7),
    prop('camp_board_cyan', 4.4, 1.6),
    // Shards of the glass sea on the shore, in the water and on the far ledge.
    prop('underglow_shards_0', 3.5, 4.5, at(3, 4)),
    prop('underglow_shards_1', 5.5, 9.5, at(5, 9)),
    prop('underglow_shards_0', 13.5, 8.5),
    prop('underglow_shards_1', 20.5, 3.5),
    prop('underglow_shards_0', 24.5, 2.5),
    prop('underglow_shards_1', 27.5, 10.5),
    prop('underglow_shards_0', 41.5, 8.5, at(41, 8)),
    prop('underglow_shards_1', 37.5, 2.5, at(37, 2)),
    // The masts: dead, crackling with static, tuned.
    prop('underglow_mast_0', 34.5, 20.5, { cover: { x: 34, y: 20, w: 1, h: 1 } }),
    prop('underglow_mast_2', 40.5, 19.5, { cover: { x: 40, y: 19, w: 1, h: 1 }, lights: [light('cyan', 2.4, 0.6, { z: 2.4, anim: 'pulse' })] }),
    prop('underglow_mast_1', 44.5, 15.5, { cover: { x: 44, y: 15, w: 1, h: 1 }, lights: [light('pink', 2.4, 0.7, { z: 2.4, anim: 'blink' })] }),
    // The consoles, still lit, talking to nobody.
    prop('console', 19.5, 13.5, { cover: { x: 19, y: 13, w: 1, h: 1 }, motion: cycle(2, 1.5), lights: [light('cyan', 1.6, 0.6, { z: 0.6 })] }),
    prop('console', 27.5, 13.5, { cover: { x: 27, y: 13, w: 1, h: 1 }, motion: cycle(2, 1.2), lights: [light('cyan', 1.6, 0.6, { z: 0.6 })] }),
    prop('console', 18.5, 20.5, { cover: { x: 18, y: 20, w: 1, h: 1 }, motion: cycle(2, 1), lights: [light('cyan', 1.6, 0.6, { z: 0.6 })] }),
    prop('console', 28.5, 20.5, { cover: { x: 28, y: 20, w: 1, h: 1 }, motion: cycle(2, 1.7), lights: [light('cyan', 1.6, 0.6, { z: 0.6 })] }),
    // The pink stick by the way down.
    glowstick('pink', 4.45, 16.5),
  ],
  marks: {
    V: { tile: '>', ent: { t: 'warp', to: 'underglow1', entry: 'down' } },
    '@': { ent: { t: 'entry', id: 'up', dir: 'down' } },
    v: { tile: '>', ent: { t: 'warp', to: 'underglow3', entry: 'up' } },
    E: { ent: { t: 'entry', id: 'down', dir: 'down' } },
    '1': sign('THE GLASS SEA. LAYER THREE.\nSTILL WATER. NO SWIMMING.\nNO SPLASHING EITHER.'),
    '3': sign('BROADCAST. LAYER FOUR.\nTHE RADIO TALKS BACK.\nDO NOT TALK BACK TO IT.'),
    j: npc('d.hanna', 'ghost', [{ lines: ['HANNA: DOWN.', 'HANNA: DEEPER.'] }]),
    u: npc('d.echo', 'ghost', [{ lines: ['ECHO: DID I SAY LEFT? I MEANT LEFT.'] }]),
    k: { ent: { t: 'chest', id: 'underglow2.key', item: 'smallKey', appear: { clear: true } } },
    '4': { ent: { t: 'chest', id: 'underglow2.islet', item: 'bits20' } },
    '5': { ent: { t: 'chest', id: 'underglow2.grotto', item: 'bits50' } },
    h: { ent: { t: 'item', id: 'underglow2.piece', item: 'heartPiece' } },
    // The low stair's lever opens the shutter up to the shore.
    W: { tile: 'X', ent: { t: 'gate', open: { flag: 'underglow2.shortcut' } } },
    y: { ent: { t: 'lever', flag: 'underglow2.shortcut' } },
    e: foe('blob'),
    z: foe('zapper'),
    a: foe('bat'),
    Q: foe('eye', 'I'),
  },
}

// ======================================================================= underglow3: THE FOSSIL ARCADE / THE CORE

const CABINET_ROW = [
  '################',
  '#t.....V......t#',
  '#......@.......#',
  '#..............#',
  '#.M..M....M..M.#',
  '#...............',
  '#...............',
  '#.M..M....M..M.#',
  '#..............#',
  '#.1.........s..#',
  '#t............t#',
  '#######%%#######',
]

const HERD = [
  '################',
  '#t............t#',
  '#..............#',
  '#..............#',
  '#..............#',
  '.......g........',
  '................',
  '#..............#',
  '#..............#',
  '#..............#',
  '#t............t#',
  '################',
]

const BONE_ROAD = [
  '################',
  '#t.....##.....t#',
  '#......##......#',
  '#..b...........#',
  '#.......##.....#',
  '........##..s..#',
  '........##..p..#',
  '#..............#',
  '#.M.##.....s.M.#',
  '#...##.........#',
  '#t.s..........t#',
  '#######WX#######',
]

const VAULT = [
  '#######..#######',
  '#t............t#',
  '#..............#',
  '#.M..........M.#',
  '#..............#',
  '#.M....6.....M.#',
  '#..............#',
  '#.M....a.....M.#',
  '#..............#',
  '#......2.......#',
  '#t............t#',
  '################',
]

const SUN_BELOW = [
  '################',
  '#t.....5......t#',
  '#..............#',
  '#..............#',
  '#..............#',
  '#...............',
  '#...............',
  '#....t....t....#',
  '#..............#',
  '#...3..........#',
  '#t...t.E..t...t#',
  '################',
]

const GOLD_VEIN = [
  '#######..#######',
  '#t............t#',
  '#..............#',
  '#..I.......I...#',
  '#....z.........#',
  'L...........s..#',
  'L..............#',
  '#.........z....#',
  '#..I.......I...#',
  '#.......k......#',
  '#t............t#',
  '################',
]

/** A cabinet of the fossil arcade over its 'M' tile, its screen still faintly playing. */
const cabinet = (x: number, y: number): IsoLandmark => prop('underglow_cabinet', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 }, lights: [light('gold', 1.5, 0.55, { z: 0.9, dy: 0.4 })] })
/** One of the herdsman's jukeboxes, grazing; solid where it stands. */
const jukebox = (x: number, y: number, fps: number): IsoLandmark => prop('machine', x + 0.5, y + 0.5, { ...at(x, y), motion: cycle(3, fps), lights: [light('rose', 1.5, 0.6, { z: 0.6 })] })

export const UNDERGLOW3: MapDef = {
  id: 'underglow3',
  name: 'THE UNDERGLOW',
  kind: 'dungeon',
  track: 'static',
  look: 'quarry',
  realm: 'underglow',
  views: ['iso'],
  keyring: 'underglow',
  cell: { w: 16, h: 12 },
  cells: {
    '0,0': { name: 'THE FOSSIL ARCADE', events: [{ lines: ['LAYER FIVE: THE FOSSIL ARCADE.', 'SOMEWHERE BELOW, SOMETHING HUMS LIKE A SUN.'], set: 'underglow3.layer' }] },
    '1,0': { name: 'THE FOSSIL ARCADE' },
    '2,0': { name: 'THE FOSSIL ARCADE' },
    '0,1': { name: 'THE FOSSIL ARCADE', dark: true },
    '1,1': { name: 'THE CORE', track: 'boss', events: [{ lines: ['LAYER SIX: THE CORE.', 'THE SUN BELOW LIES IN THE FLOOR LIKE A DROPPED COIN, AND THE FLOOR IS WARM.'], set: 'underglow3.core' }] },
    '2,1': { name: 'THE CORE', track: 'boss' },
  },
  rows: joinCells([
    [CABINET_ROW, HERD, BONE_ROAD],
    [VAULT, SUN_BELOW, GOLD_VEIN],
  ]),
  // The Geyser: the Sun Below's middle throws the hero all the way up.
  warps: [{ x: 23, y: 20, w: 2, h: 2, to: 'lumenby', entry: 'deep' }],
  isoLandmarks: [
    ...([[2, 4], [5, 4], [10, 4], [13, 4], [2, 7], [5, 7], [10, 7], [13, 7], [2, 15], [13, 15], [2, 17], [13, 17], [2, 19], [13, 19]] as const).map(([x, y]) => cabinet(x, y)),
    // The bone road: cabinets grown into the rock, bones in tanks.
    cabinet(34, 8), cabinet(45, 8),
    prop('tank', 43.5, 1.5, { ...at(43, 1), motion: cycle(2, 1), lights: [light('cyan', 1.4, 0.5, { z: 0.8 })] }),
    prop('tank', 44.5, 10.5, { ...at(44, 10), motion: cycle(2, 0.8), lights: [light('cyan', 1.4, 0.5, { z: 0.8 })] }),
    // The gold vein: torches along it, burning gold with the Sun Below's own root under the floor.
    ...([[37, 14, 6], [42, 21, 5], [45, 16, 4], [36, 19, 5.5]] as const).map(([x, y, fps]) =>
      prop('torch', x + 0.5, y + 0.5, { ...at(x, y), motion: cycle(3, fps), lights: [light('gold', 3, 0.8, { z: 0.9, anim: 'fire' })] })),
    // The herd.
    jukebox(20, 3, 2), jukebox(26, 3, 1.5), jukebox(19, 8, 1), jukebox(27, 7, 2.5), jukebox(24, 9, 1.2),
    // The Sun Below, and the cyan stick by it.
    prop('underglow_sun', 24, 21, { motion: cycle(2, 1), lights: [light('gold', 6.5, 0.9, { z: 1.2, anim: 'pulse' }), light('cream', 2.4, 0.8, { z: 0.4 })] }),
    glowstick('cyan', 24.45, 22.5),
  ],
  marks: {
    V: { tile: '>', ent: { t: 'warp', to: 'underglow2', entry: 'down' } },
    '@': { ent: { t: 'entry', id: 'up', dir: 'down' } },
    E: { ent: { t: 'entry', id: 'down', dir: 'down' } },
    '1': sign('THE FOSSIL ARCADE. LAYER FIVE.\nINSERT COIN.\nNOBODY HAS, FOR A LONG TIME.'),
    '2': sign('HIGH SCORES\n1ST: BROR. 2ND: BROR.\n3RD: A SMUDGE.'),
    '3': sign('THE GEYSER\nGOES UP. ALL THE WAY UP.\nHOLD ON TO YOUR HAT.'),
    g: npc('d.herdsman', 'troll', [{ lines: ['HERDSMAN: THE JUKEBOXES ARE MY HERD. THEY ONLY PLAY WHEN FED COINS.', 'HERDSMAN: THEY ARE SHY. LIKE ME.'] }]),
    p: { ent: { t: 'plate', id: 'underglow3.road' } },
    W: { tile: 'X', ent: { t: 'gate', open: { plates: ['underglow3.road'] } } },
    k: { ent: { t: 'chest', id: 'underglow3.key', item: 'smallKey', appear: { clear: true } } },
    '5': { ent: { t: 'chest', id: 'underglow3.prize', item: 'bits50', big: true } },
    '6': { ent: { t: 'chest', id: 'underglow3.vault', item: 'bombs5' } },
    s: foe('skull'),
    z: foe('zapper'),
    a: foe('bat'),
  },
}

/** The Underglow's floors by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { underglow1: UNDERGLOW1, underglow2: UNDERGLOW2, underglow3: UNDERGLOW3 }
