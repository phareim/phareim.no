/**
 * LUMENBY QUARRY: the hill town that dug every neon tube on the coast, half empty now (docs/worlds/atlas.md; its
 * place on the grid is world/atlas.ts). THE GROVE ROAD climbs through the rust-pines from the Wildwood's gate to
 * LUMENBY, the union hall and seven chalk lots round a square, under THE HILL SIGN, whose seven letters stand dark
 * on their terrace. West of the town THE PIT steps down in benches to a floor of rain and stone, with the stair to
 * THE OLD QUARRY, where the last shift left its tools; north-west, under the cliffs, the headframe of THE DEEP DRIFT
 * stands over the shaft to the Underglow, and a cracked boulder shuts the cut from the drift into the pit. East
 * along the road to Seter Fell lies THE TRUCK YARD and the dead shift whistle; north-east THE TOPS carry the road
 * over to Yule Fjord past a gully. Dig & build is on (`dig`): the heights are the pit's benches and the hill's
 * terrace; the town's roads lie at the ground's level. A heart piece waits on a stack on the pit's highest bench
 * where the old ramp fell in.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`.
 */
import type { AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { gateHome } from './gates'
import { at, cycle, lantern, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })

/** The quarry's first-visit words, in whichever area the hero arrives (the gate, a pass): once. */
const INTRO: AreaIntro = { lines: ['PINK VEINS IN GREY STONE, AND RAIN IN THE PIT. THE SHIFT WHISTLE HAS NOT BLOWN IN YEARS.'], who: null, flag: 'realm:lumenby' }

/** The hill sign: L U M E N B Y on their scaffolds along the terrace, dark until the lots' flags light them. */
const LETTERS: IsoLandmark[] = [...'lumenby'].map((ch, i) => prop(`quarry_letter_${ch}_off`, 28.8 + i * 1.3, 7.6, {
  z: 0.85,
  lit: { flag: `q.lumenby.lot${i + 1}`, art: `quarry_letter_${ch}_on` },
  // A lit letter spills pink on the bench under it.
  lights: [light('rose', 1.9, 0.7, { z: 0.3, dy: 0.35, lit: true })],
  ...(i === 0 ? at(28, 7, 9, 1) : {}),
}))
/** A crystal of lumen in a bench or a heap, breathing teal. */
const vein = (x: number, y: number): IsoLandmark => prop('quarry_vein', x, y, { lights: [light('teal', 2.2, 0.6, { z: 0.2, anim: 'pulse' })] })

export const LUMENBY: MapDef = {
  id: 'lumenby',
  name: 'LUMENBY QUARRY',
  kind: 'overworld',
  track: 'static',
  look: 'quarry',
  realm: 'lumenby',
  views: ['iso'],
  away: true,
  rows: [
    '######################################################,,,###########################',
    '######################################################,,,###########################',
    '#######################ввввввввввввввввввввввв..T.T.:T.,...#####........T.....T...##',
    '#######################вв3вввввввввввввввввzвв..;....K.,.;..:..TOO.;.;T....::...:.##',
    '###..##--V--.;#.##.###.ввввввввввввввввввввввв.:....;..,.T.T....OO....;...7..T..r.##',
    '##...:;--,--h..:...:...вввввввввввввввввжввввв..T...r.,,.T..TT.TOO#####..r..T:....##',
    '##.....g-,--GT....7.;..вввввааааааааааввдввввв.......T,T.....:..OO....#...;.......##',
    '##.T...--,--..;.....TT.вввввааааааааааввдввввв...T...;,...;..:..OO.|4.#:T.........##',
    '##.....--,--;.....:.T..вввввааааааааааввдpвввв.......,,;:.;...T;OO....#rT..:.:.T..##',
    '##.....--,,,,,,,,,,,,,,идддддддддддддддддвввввT...r.,,:TT....T;.OO#####TTr........##',
    '##..7T.-----.T.rr.T..,Eвввввввввввдввввввввввв......,....T.T:...OO......;..T..;.rT##',
    '##.......;...........,.вввввввввввжввввввввввв:.....,.........8.OO....:.T.r..0..:.##',
    '##адаааааааааааааааааRаааааа...c.L,;..............;,,...:T..;T:.OO.....T..T......T##',
    '##аааааааааааааааааад,аааааа.,,,,,,.HHHHHHH....;T.,,...T......T.T;....T...........##',
    '##ааааааааааааааааааа,аааааа.,...,,;HHHHHHH......,,.....T....;;...;...............##',
    '##аааааадааадаадааааа,аааааа.,...,,;HHHUHHH....N,,...................T........TM.:##',
    '##ааааjдааааааааааааа,аааааа......,....,.Z...;.,,.....:.............:...........,,,,',
    '##ааааааааааааааааааа,аааааа.,,,,,,----,------,,.................,,,,,,,,,,,,,,,,,,,',
    '##аааааадаааааааажааа,еееааа.,...,.----------v-;.;..........,,,,,,......;..:.;..,,,,',
    '##аааадаааааададааааа,аааада.,;....k-----------,,,,,,,,,,,,,,..;..,.....;.......TT##',
    '##аааааааааееежаааада,аааааа.,,,,,.------------.....;..i..........,......:........##',
    '##аааааааа.......W.......ааа.......------------.,,.,.,,.,,.;----s-,---Y-.-------:T##',
    '##адаааааа.а....Q,.......ааа...T..---y---------.,....,...,..------,.---.--------..##',
    '##аааааааа...----,,....а..........,------------.,....,...,..====================..##',
    '##ааааеааа..------,..:.....P..;.:,,...J,,............,,,,,..--=-----------------..##',
    '##адаааада...-----,,,,,,,...,,,,,,:....,,..,,,,;,,.,...;....--=---------------.-;:##',
    '##ааадаааа..~~~:......:.....,,,,,,:....,,.T...;.,...,....T..--=.--------.0----.-..##',
    '##дааадаае.~~|2~....::-:........;......,,..,....,...,.......--=---------.-------.T##',
    '##ааааааае:~~--~..:---:......,,.,,.....,,..,,,,.,,,,,..T....--=-------.---------;T##',
    '##ааааааве.~~~~~..----а.:дад.,...,.T.T.,,....f........T.;T..--=---------.-------:T##',
    '##еааааадв:.~~~...-----..ааа.,...,.TT..,,.....T..T.T.T...T.:--=----.-----.######..##',
    '##аеадаава.b---.....:....ааа.,,,,,...T.,,............;T.....--=-----------#.5.##:.##',
    '##ааааааааадааааееаваааааааа.........T.,..T..........T.T.T:...=...-9------#...##TT##',
    '##ааааадаааааааааавдвqаааааа;b..;;...T.,..:.u.......T.T.T.....=..---------##R###TT##',
    '##ааааадааааааааааааааааааааT...***.TT.,..........T....T..........--------##-###.:##',
    '##RаааааааааааааааааааааааааT...*6*T.T.,.B...T........:T..T.T:.T....:..;..T..T..TT##',
    '##ааааааааааааwаадааааааадаа.:.T***T.T.,..T..T.T...TT....:T....T..;.......TTT.:.TT##',
    '##1аRаадааааадаааааааааааааа.:.TTT...T;,.....TT.;T....TT..::...T.....TT..T..:..T.T##',
    '#######################################,############################################',
    '#######################################A############################################',
  ],
  dig: {
    // The ground is level 1. The pit's floor lies at it, its benches step up to 2 and 3 round it (a stack at 4);
    // the hill's terrace stands at 2 under its crest at 3. Ramps (ж и) join the levels where the haul roads ran.
    heights: [
      '....................................................................................',
      '....................................................................................',
      '.......................33333333333333333333333......................................',
      '.......................33333333333333333333333......................................',
      '.......................33333333333333333333333......................................',
      '.......................22332332233223222323233......................................',
      '.......................22222222222222222222222......................................',
      '.......................22222222222222222222222......................................',
      '.......................22222222222222222222222......................................',
      '.......................22222222222222222222222......................................',
      '.......................22222222222222222222222......................................',
      '.......................22222222222222222222222......................................',
      '..3333333333333333333.333333........................................................',
      '..3333333333333333333.333333........................................................',
      '..3333333333333333333.333333........................................................',
      '..3333333333333333333.333333........................................................',
      '..3333333333333333333.333333........................................................',
      '..3333333333333333333.333333........................................................',
      '..3333333333333333333.333333........................................................',
      '..3333332222222222222.222222........................................................',
      '..3333332222222222222.222222........................................................',
      '..33333322...............222........................................................',
      '..33333322.2.............222........................................................',
      '..33333322.............2............................................................',
      '..33333322..........................................................................',
      '..33333322..........................................................................',
      '..33333322..........................................................................',
      '..33333322..........................................................................',
      '..33333322..........................................................................',
      '..33333322............3..222........................................................',
      '..33333322...............222........................................................',
      '..33333322...............222........................................................',
      '..33333322222222222222222222........................................................',
      '..33333322222222222222222222........................................................',
      '..33333333333333333333333333........................................................',
      '..33333333333333333333333333........................................................',
      '..44333333333333333333333333........................................................',
      '..44333333333333333333333333........................................................',
      '....................................................................................',
      '....................................................................................',
    ],
    caches: [
      { x: 22, y: 27, id: 'lumenby.cache1', item: 'bits20' },
      { x: 8, y: 30, id: 'lumenby.cache2', item: 'bits50' },
      { x: 19, y: 33, id: 'lumenby.cache3', item: 'bits20' },
    ],
  },
  areas: [
    { name: 'THE DEEP DRIFT', x: 0, y: 0, w: 23, h: 12, entry: 'deep', intro: INTRO },
    { name: 'THE HILL SIGN', x: 23, y: 0, w: 23, h: 12, entry: 'hill', intro: INTRO },
    { name: 'THE TOPS', x: 46, y: 0, w: 38, h: 12, entry: 'tops', intro: INTRO },
    { name: 'THE PIT', x: 0, y: 12, w: 28, h: 28, entry: 'pit', intro: INTRO },
    { name: 'LUMENBY', x: 28, y: 12, w: 30, h: 17, entry: 'camp', intro: INTRO },
    { name: 'THE GROVE ROAD', x: 28, y: 29, w: 30, h: 11, entry: 'gate-quarry', intro: INTRO },
    { name: 'THE TRUCK YARD', x: 58, y: 12, w: 26, h: 28, entry: 'yard', intro: INTRO },
  ],
  entries: {
    'gate-quarry': { x: 39.5, y: 37.5, dir: 'up' },
    'camp': { x: 40.5, y: 20.5, dir: 'down' },
    'from-quarry': { x: 17.5, y: 22.5, dir: 'down' },
    'deep': { x: 9.5, y: 5.5, dir: 'down' },
    'pit': { x: 25.5, y: 25.5, dir: 'left' },
    'hill': { x: 34.5, y: 9.5, dir: 'down' },
    'tops': { x: 54.5, y: 8.5, dir: 'down' },
    'yard': { x: 63.5, y: 18.5, dir: 'down' },
    'hall': { x: 39.5, y: 16.5, dir: 'down' },
  },
  isoLandmarks: [
    // The realm's arch over the gate road, lit at night.
    prop('gate_lumenby_ns_off', 39.5, 36.5, { night: 'gate_lumenby_ns_on' }),
    // The hill sign.
    ...LETTERS,
    // On the terrace's east end, the apprentice's glass bench and the crates of tubes for the letters.
    prop('bench_2', 42.5, 7.4, { ...at(42, 7, 2, 1) }),
    prop('quarry_crate', 44.6, 6.6, at(44, 6)), prop('quarry_crate', 44.6, 7.6, at(44, 7)), prop('quarry_crate', 43.6, 9.6, at(43, 9)),
    // The deep drift: the headframe over the shaft (its legs solid either side), carts and crates in the yard.
    prop('quarry_headframe', 9.5, 4.9, { shadow: { tall: 2.2, wide: 0.52 }, lights: [light('red', 1.4, 0.9, { z: 2.3, anim: 'blink' }), light('amber', 2.6, 0.6, { z: 0.8, dy: 0.5 })], ...at(8, 4, 3) }),
    prop('quarry_cart_full', 7.5, 8.6, at(7, 8)),
    prop('quarry_cart_empty', 11.5, 9.6, at(11, 10)),
    prop('quarry_crate', 11.6, 4.6, at(11, 4)),
    // Lumenby: the vending unit by the hall, the old miner's bench, a cart of tubes on the square.
    prop('machine', 46.5, 17.5, { motion: cycle(3, 2), ...at(46, 17) }),
    prop('camp_log', 35.4, 18.2), prop('camp_board_blank', 36.6, 17.2),
    prop('fountain', 38.0, 20.0, { motion: cycle(2, 2), ...at(37, 19, 2, 2) }),
    prop('quarry_cart_empty', 43.5, 22.6, at(43, 22)),
    prop('quarry_crate', 44.6, 22.6, at(44, 22)),
    // The grove road: the prospector's camp.
    prop('tent', 47.0, 32.5, at(46, 32, 2, 1)),
    prop('campfire', 45.5, 34.5, { motion: cycle(3, 5), light: { r: 2.2, tone: 'gold', a: 0.6 }, ...at(45, 34) }),
    prop('camp_log', 44.6, 34.9),
    // The pit: a cart at the mouth, crates by the stair, the veins in the benches, the haul ramp.
    prop('quarry_cart_full', 26.5, 27.6, at(26, 27)),
    prop('quarry_crate', 18.6, 21.6, at(18, 21)),
    vein(12.5, 20.6), vein(9.5, 28.6), vein(23.5, 18.6), vein(16.5, 32.6), vein(6.5, 24.6), vein(2.5, 30.6),
    prop('quarry_crate', 19.6, 16.6, at(19, 16)), prop('quarry_cart_empty', 7.5, 19.6, at(7, 19)),
    prop('quarry_ramp_n', 14.5, 20.5),
    // The truck yard: two haul trucks, carts on the rail bed, crates, the whistle tower, the spoil heap's ramp.
    // (A train of carts stands on the rail bed where the last shift left it.)
    prop('quarry_cart_full', 64.5, 23.5), prop('quarry_cart_full', 65.5, 23.5), prop('quarry_cart_empty', 66.5, 23.5),
    prop('quarry_cart_full', 62.5, 30.5), prop('quarry_cart_empty', 74.5, 23.5),
    prop('quarry_crate', 66.6, 27.6, at(66, 27)), prop('quarry_crate', 67.6, 27.6, at(67, 27)), prop('quarry_crate', 66.6, 28.6, at(66, 28)),
    prop('quarry_crate', 71.6, 29.6, at(71, 29)), prop('quarry_crate', 72.6, 29.6, at(72, 29)),
    prop('quarry_crate', 60.6, 25.6, at(60, 25)),
    prop('quarry_crate', 61.6, 25.6, at(61, 25)),
    prop('quarry_crate', 60.6, 26.6, at(60, 26)),
    prop('mast', 68.5, 20.5, at(68, 20)),
    prop('quarry_ramp_w', 73.5, 32.5),
    vein(78.5, 28.6), vein(72.5, 34.6),
    // The tops: a walkers' shelter by the road over to Yule Fjord.
    prop('camp_shelter', 58.3, 6.5),
    prop('camp_board_violet', 57.4, 8.1),
    prop('camp_log', 57.6, 9.0),
  lantern('gold', 40.5, 33.5),
  lantern('gold', 38.5, 30.5),
  lantern('gold', 41.5, 27.5),
  lantern('cyan', 33.5, 16.5),
  lantern('cyan', 47.5, 21.5),
  lantern('cyan', 33.5, 27.5),
  lantern('pink', 52.5, 20.5),
  lantern('pink', 61.5, 17.5),
  lantern('pink', 71.5, 16.5),
  lantern('pink', 78.5, 18.5),
  lantern('violet', 51.5, 14.5),
  lantern('violet', 52.5, 8.5),
  lantern('violet', 56.5, 4.5),
  lantern('rose', 14.5, 10.5),
  lantern('rose', 19.5, 8.5),
  lantern('rose', 21.5, 24.5),
  lantern('rose', 16.5, 23.5),
  ],
  marks: {
    'A': gateHome('quarry'),
    'W': { ent: { t: 'warp', to: 'quarry', entry: 'start' }, tile: '>' },
    'V': { ent: { t: 'warp', to: 'underglow1', entry: 'up' }, tile: '>' },
    'U': { ent: { t: 'warp', to: 'unionhall', entry: 'door' }, tile: 'D' },
    'B': sign('LUMENBY QUARRY.\nEVERY NEON TUBE ON THE COAST STARTED HERE.'),
    'J': sign('↑ THE UNION HALL.\n← THE PIT.  → SETER FELL.\n↓ THE WILDWOOD.'),
    'N': sign('↑ YULE FJORD, OVER THE TOPS.\n↓ LUMENBY.'),
    'K': sign('↓ LUMENBY.\n↑ YULE FJORD.'),
    'M': sign('← LUMENBY.\n→ SETER FELL.'),
    'L': sign('THE HILL SIGN. ONE LETTER LIT\nFOR EVERY HOUSE IN TOWN.\nNOT ONE IS LIT.'),
    'Q': sign('THE OLD QUARRY ↓\nTHE LAST SHIFT LEFT ITS\nTOOLS DOWN THERE.'),
    'P': sign('THE PIT. HARD HATS PAST THIS\nPOINT. HATS NOT PROVIDED.'),
    'G': sign('THE DEEP DRIFT\nNAMES THAT NEVER CAME UP:\nBROR GUNN. (AND A SMUDGE.)'),
    'E': sign('← THE DEEP DRIFT.\n→ THE HILL SIGN.'),
    'Y': sign('SHIFT WHISTLE: OUT OF ORDER.\nGO HOME WHEN TIRED.'),
    'Z': sign('UNION HALL, LUMENBY\nSHIFT BOARD: EMPTY.\nNEXT SHIFT: WHEN SOMEONE COMES.'),
    'c': sign('BUILDING LOT.\nHOUSE NOT INCLUDED.'),
    'f': sign('RESERVED FOR A HOUSE.\nANY DAY NOW.'),
    'i': sign('LOT FOR A MINER\'S HOUSE.\nTHE MINER LEFT FIRST.'),
    'g': npc('l.deep.mag', 'mossa', [{ lines: ['MOTHER MAG: WELCOME TO THE DELVERS\' CLUB. ROSE STICK, ROSE LEDGE, HOME BY TEA.', 'MOTHER MAG: GOING DOWN IS EASY. MIND THE WAY BACK UP.'] }]),
    'h': npc('lumenby.liftop', 'liftlady', [{ lines: ['LIFT OPERATOR: MIND THE CAGE DOOR. KEEP YOUR THUMBS IN.', 'LIFT OPERATOR: THE LIFT IS OUT. THE CABLE WENT TO THE CITY WITH EVERYTHING ELSE.'] }]),
    'k': npc('lumenby.miner', 'dusty', [{ lines: ['OLD MINER: EVERY NEON TUBE ON THE COAST WAS DUG OUT OF THIS HILL. EVERY ONE.', 'OLD MINER: PINK IN THE ROCK MEANS LUMEN. PINK ON YOUR HANDS MEANS YOU TOUCHED IT.', 'OLD MINER: THE DEEP DRIFT IS NORTH-WEST, PAST THE HILL SIGN. NOBODY GOES DOWN IT FOR FUN.'] }]),
    'v': npc('lumenby.vending', 'robot', [{ lines: ['VENDING UNIT: LUMEN ACCEPTED. FEELINGS NOT.', 'VENDING UNIT: OUT OF STOCK SINCE THE SHIFT WHISTLE STOPPED. THANK YOU FOR WAITING.'] }]),
    'y': npc('lumenby.cat', 'cat', [{ lines: ['MRRP.', '(A QUARRY CAT, GREY WITH DUST. IT WATCHES THE PIT AS IF THE PIT OWES IT MONEY.)'] }], { wander: true }),
    'p': { tile: 'д', ...npc('lumenby.apprentice', 'tubeblower', [{ lines: ['APPRENTICE: I BLOW GLASS. I SPEAK FONT. THIS WHOLE HILL IS SET IN CAPITALS.', 'APPRENTICE: NILS SAYS I BLOW GLASS LIKE A KETTLE. HE MEANS IT KINDLY. I THINK.'] }]) },
    's': npc('lumenby.detector', 'kid', [{ lines: ['DETECTOR KID: BEEP. BEEP. THAT\'S A SPOON. IT\'S ALWAYS A SPOON.', 'DETECTOR KID: MUM WORKED THE DEEP SHIFT. I\'M NOT ALLOWED PAST THE TRUCKS.'] }], { wander: true }),
    'u': npc('lumenby.prospector', 'foreman', [{ lines: ['PROSPECTOR: CAME FOR THE LUMEN. FOUND RAIN, BATS AND A VERY UNFRIENDLY HILL.', 'PROSPECTOR: GUNN AT THE UNION HALL SAYS I DIG LIKE A DOG. A DOG WOULD BE FASTER, SHE SAYS.'] }]),
    '1': { ent: { t: 'chest', id: 'lumenby.stack', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'lumenby.island', item: 'bits50' } },
    '3': { ent: { t: 'chest', id: 'lumenby.crest', item: 'bits20' } },
    '4': { ent: { t: 'chest', id: 'lumenby.gully', item: 'bits50' } },
    '5': { ent: { t: 'chest', id: 'lumenby.spoil', item: 'bombs5' } },
    '6': { ent: { t: 'chest', id: 'lumenby.thicket', item: 'bits20' } },
    '7': { ent: { t: 'enemy', kind: 'bat' } },
    'z': { tile: 'в', ent: { t: 'enemy', kind: 'skull' } },
    '8': { ent: { t: 'enemy', kind: 'skull' } },
    '0': { ent: { t: 'enemy', kind: 'drone' } },
    'b': { ent: { t: 'enemy', kind: 'blob' } },
    'j': { tile: 'а', ent: { t: 'enemy', kind: 'bat' } },
    'q': { tile: 'а', ent: { t: 'enemy', kind: 'zapper' } },
    'w': { tile: 'а', ent: { t: 'enemy', kind: 'blob' } },
    '9': { ent: { t: 'enemy', kind: 'zapper' } },
  },
}

/** THE UNION HALL: the shift board, the long tables, Gunn at her desk and Nils at his glass. */
export const UNIONHALL: MapDef = {
  id: 'unionhall',
  name: 'THE UNION HALL',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '################',
    '#[[[..s...[[[[.#',
    '#..............#',
    '#.t..a......t..#',
    '#..............#',
    '#.nnnn....nnnn.#',
    '#..............#',
    '#.nnnn..d.nnnn.#',
    '#..............#',
    '#o.....@.....oo#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'lumenby', entry: 'hall' } },
    s: { tile: 'S', ent: { t: 'sign', lines: ['SHIFT BOARD.\nDAY SHIFT: NOBODY.\nNIGHT SHIFT: NOBODY.'] } },
    a: npc('q.gunn', 'foreman', [
      { when: { flags: ['q.lamp.got'], not: ['q.lamp.done'] }, lines: ["GUNN: BROR'S LAMP. AND THE RAILS HOLD, HE SAYS?", 'GUNN: THEN HE STAYS DOWN THERE BY CHOICE. STUBBORN. LIKE OUR MOTHER.', 'GUNN: THANK YOU. TAKE THIS. I WAS KEEPING IT FOR HIM.'], set: 'q.lamp.done', give: 'heartPiece' },
      { when: { flags: ['q.bell.ore'], not: ['q.bell.chrome'] }, lines: ["GUNN: CHROME FOR A BELL? TAKE A SHIFT'S WORTH. IT ISN'T DOING ANYTHING HERE.", 'GUNN: AND TELL RAGNA FROM ME: NOT ONE TREE.', "GUNN: RAGNA'S CLINKER IS EAST, IN THE SPORELIGHT, PAST SETER FELL."], set: 'q.bell.chrome', give: 'bits20' },
      { when: { flag: 'q.lamp.done' }, lines: ["GUNN: BROR'S LAMP HANGS IN THE HALL NOW. IT STILL SMELLS OF THE DEEP."] },
      { lines: ['GUNN: LAST FOREWOMAN OF LUMENBY. I KEEP THE SHIFT BOARD, AND NOBODY IS ON IT.', 'GUNN: MY BROTHER BROR WENT DOWN THE DEEP DRIFT, WEST OF HERE, AND NEVER CAME UP.', 'GUNN: BRING ME WORD OF HIM. ANY WORD.'], set: 'q.lamp.ask' },
    ]),
    d: npc('q.lumenby.nils', 'tubeblower', [{ lines: ["NEON NILS: THAT'S A LOVELY SERIF OF A ROCK.", "NEON NILS: I BENT EVERY LETTER OF THE TOWN'S SIGN. NOW I BEND SPOONS. TO KEEP MY HAND IN."] }]),
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { lumenby: LUMENBY, unionhall: UNIONHALL }
