/**
 * RERUN ESTATES: one nice street, over and over, down to the sea (docs/worlds/atlas.md; its place on the grid is
 * world/atlas.ts). From the lake gate THE AVENUE runs east between the same house, the same mailbox and the same
 * flamingo four times over, to THE CUL-DE-SAC, where the dunes of Stillsand fall onto the lawns and five houses from
 * three different years stand round one turning circle. East of it THE DRIVE-IN's screen glows over its station
 * wagons (LENNY's band, ROSE's oak); main street runs south past RALF'S TV VAN and the yard sale to THE MARINA, its
 * empty berths and the members' island; second street runs east to THE PHONE BOOTH on the corner, and under the
 * common a bomb shelter nobody came up from. THE HEDGE MAZE fills the lots behind the avenue: six lanes by five behind
 * rails, the prize in the cell beside the way in, the cat in the middle.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`, the foes among them
 * (mailboxes on the avenue, flamingos at the drive-in, mowers by the fountain).
 */
import type { AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { gateHome } from './gates'
import { at, cycle, lantern, light, PORCH, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })

/** The estate's first-visit words, in whichever area the hero arrives (the gate, the pass): once. */
const INTRO: AreaIntro = { lines: ['LAWNS, MAILBOXES AND SPRINKLERS. THE SAME NICE STREET, OVER AND OVER.'], who: null, flag: 'realm:rerun' }

/** A house on its 3×3 of H, its windows lit and its porch light on after dusk. */
const house = (art: string, x: number, y: number): IsoLandmark => prop(art, x + 1.5, y + 1.5, {
  night: `${art}_night`, cover: { x, y, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.35, deep: 1.4 }, lights: PORCH,
})
/** A lawn sprinkler, turning. */
const sprinkler = (x: number, y: number): IsoLandmark => prop('rerun_sprinkler', x + 0.55, y + 0.55, { motion: cycle(2, 2), ...at(x, y) })
/**
 * One of the avenue's lots (x: the house's west edge; y: its north edge, 1 north of the road or 8 south of it): the
 * same house, the mailbox by the road, the flamingo and the sprinkler on the lawn. Always the same.
 */
const lot = (x: number, y: number): IsoLandmark[] => {
  const road = y === 1 ? 4 : 7
  return [
    house('rerun_house_0', x, y),
    prop('rerun_mailbox', x + 3.5, road + 0.45, at(x + 3, road)),
    prop('rerun_flamingo', x + 5.6, y + 1.5, at(x + 5, y + 1)),
    sprinkler(x + 4, y + 2),
  ]
}

export const RERUN: MapDef = {
  id: 'rerun',
  name: 'RERUN ESTATES',
  kind: 'overworld',
  track: 'village',
  look: 'suburb',
  realm: 'rerun',
  views: ['iso', 'classic'],
  away: true,
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,,TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'T****.HHH...s*HHH....*HHH....*HHH....*...HHH--,,,-V-HHH...5F......T...T...T....T',
    'T****.HHH....*HHH....*HHH....*HHH....*..:HHH.-,,,,..HHH....F...............:...T',
    'T****.HHH....*HHH....*HHH....*HHH....*...HHH.,,,,,,.HHH....F...................T',
    'T.....:,:.FFF.:,:.FFF.6,:.FFF.6,:.FFF.+...,.,,,,,,,,,,.,,,,,,,.................T',
    'A,,,,,,,,,,+,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,::,,,...z...F.,.................T',
    'T....,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,::,,,,,,,HHHF.,.................T',
    'T...E..,..FFF..,,......,a.FFF..,..FFFQ,,U...,,,,,,,,,,,,HHHF.,.................T',
    'T*****HHH...:*.,,.J..*HHH....*HHH....*,,.....,,,,,,.....HHHF.,.................T',
    'T*****HHH....*.,,....*HHH....*HHH....*,,......,,,,.........F.,.................T',
    'T*****HHH....*.,,....*HHH....*HHH..*.*,,.HHH..:...:HHH.....F.,................3T',
    'T*****.......*.,,N...*..:....*....*4**,,.HHH..*::*.HHH.....F.,.......:...&:....T',
    'TFFFFFFFFFFFFFF,,FFFFFFFFFFFFFFFFFFFFF,,.HHH..::::.HHH.....F.,.................T',
    'TTTTTTTTTTTTTTT..TTTTT................,,F.,...*::*..,.....:F.,...........&.....T',
    'TTT.:...F.....F..F2.FT..HHH...HHH.....,,F.,.........,......F.,.................T',
    'TTT.....F.....F..F..FT..HHH...HHH..:..,,FFFFFF..FFFFFFF....F.,....:............T',
    'TTT..F..F..F..F..F..FT..HHH...HHH.:...,,....:.........****.F.,.................T',
    'TTT..F.....F.:...F..FT...,.....,....h.,,...HHH.....HHH::::.F.,............u:...T',
    'TTT..F.....F.....F..FT...,,,,,,,,,,,,,,,...HHH.:...HHH::::.F.,,,,,,,,,,,,,,,...T',
    'TTT..FFFFFFFFFFFFF..FT....y...........,,...HHH.....HHH::::.F.,.:.........:.....T',
    'TTT.:....:.F....:...FT....j........:..,,....,.......,..9...W,,.................T',
    'TTT........F0.......FTFFFFFFFFFFFFF...,,,,,,,,,,,,,,,,,,,,,,,,..:::..:......:..T',
    'TTTFFFFFF..FFFFFFF..FT.............T..,,,,,,,,,,,,,,,,,,,,,,,,..:Tm..........T.T',
    'TTT*.F.....F......:.FT...............p,,.....8..............:.:.:::............T',
    'TTT*.F.....F........FT.T..............,,......###.........e....................T',
    'TTT..F..FFFF..FFFF..FTT............:..,,......#v#.........................:....T',
    'TTT.......:...F.....FT.......7.7..T...,,......#%#......:......T................T',
    'TTT....:......F**...FT..T......:......,,...T.............T.........T.....T.....T',
    'TTTTTTTTTTTTTTTTTTTTTT................,,......:................:...............T',
    '~#####################################,,##############################%########~',
    '~~----------------------d-----------g-,,--------------------------------------~~',
    '~~,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,~~',
    '~~~----------=------------------------==---------------------=k--------------~~~',
    '~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~=~~~~~----~~~~~~~~~',
    '~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~|=~~~~~-|-1~~~~~~~~~',
    '~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~=~~~~~----~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
  ],
  areas: [
    { name: 'THE AVENUE', x: 0, y: 0, w: 37, h: 13, entry: 'gate-lawns', intro: INTRO },
    { name: 'THE CUL-DE-SAC', x: 37, y: 0, w: 22, h: 16, entry: 'camp', intro: INTRO },
    { name: 'THE DRIVE-IN', x: 59, y: 0, w: 21, h: 29, entry: 'drivein', intro: INTRO },
    { name: 'THE HEDGE MAZE', x: 0, y: 13, w: 23, h: 16, entry: 'maze', intro: INTRO },
    { name: 'RALF\'S TV VAN', x: 23, y: 13, w: 17, h: 16, entry: 'tvvan', intro: INTRO },
    { name: 'THE PHONE BOOTH', x: 40, y: 16, w: 19, h: 13, entry: 'booth', intro: INTRO },
    { name: 'THE MARINA', x: 0, y: 29, w: 80, h: 11, entry: 'marina', intro: INTRO },
  ],
  entries: {
    'gate-lawns': { x: 1.5, y: 5.5, dir: 'right' },
    'camp': { x: 47.5, y: 8.5, dir: 'down' },
    'maze': { x: 15.5, y: 10.5, dir: 'down' },
    'tvvan': { x: 38.5, y: 16.5, dir: 'down' },
    'booth': { x: 48.5, y: 21.5, dir: 'right' },
    'drivein': { x: 61.5, y: 19.5, dir: 'up' },
    'marina': { x: 38.5, y: 30.5, dir: 'down' },
    'shelter': { x: 47.5, y: 27.5, dir: 'down' },
  },
  isoLandmarks: [
    // The realm's arch over the gate road, lit at night.
    prop('gate_rerun_ew_off', 3.5, 5.5, { night: 'gate_rerun_ew_on' }),
    // THE AVENUE: one lot, seven times over (and the sold one with no house, where the path goes down to the maze).
    ...[6, 14, 22, 30].flatMap(x => lot(x, 1)),
    ...[6, 22, 30].flatMap(x => lot(x, 8)),
    lantern('gold', 4.5, 4.5),
    ...[13, 21, 29, 37].map(x => lantern('gold', x + 0.5, 4.5)),
    ...[13, 21, 29].map(x => lantern('gold', x + 0.5, 7.5)),
    // THE CUL-DE-SAC: the same close in three years at once (1958, 1986, 2086), round one turning circle.
    house('rerun_house_1958', 41, 1), house('rerun_house_2086', 52, 1), house('rerun_house_1', 56, 6),
    house('rerun_house_1986', 41, 10), house('rerun_house_0', 51, 10),
    prop('rerun_mailbox', 44.5, 4.45, at(44, 4)),
    prop('rerun_mailbox', 51.5, 3.45, at(51, 3)),
    prop('rerun_mailbox', 55.5, 8.45, at(55, 8)),
    prop('rerun_mailbox', 43.5, 9.45, at(43, 9)),
    prop('rerun_mailbox', 52.5, 9.45, at(52, 9)),
    prop('rerun_station_wagon', 54.75, 4.65, at(54, 4, 2)),
    prop('rerun_flamingo', 45.6, 2.5, at(45, 2)),
    prop('rerun_flamingo', 50.6, 13.5, at(50, 13)),
    prop('rerun_flamingo', 44.6, 13.5, at(44, 13)),
    sprinkler(40, 3), sprinkler(54, 13),
    prop('rerun_lawnmower', 58.4, 10.3, at(58, 10)),
    lantern('pink', 44.5, 3.5),
    lantern('pink', 50.5, 2.5),
    lantern('pink', 45.5, 9.5),
    lantern('pink', 50.5, 9.5),
    // The turning circle's lamp, on its island.
    lantern('pink', 48, 6),
    // THE DRIVE-IN: wagons facing east at the screen (5 tiles long on its timber legs at the lot's east edge, the evening's
    // picture showing through it, its marquee lit), the band's corner.
    prop('rerun_screen', 76.5, 10.5, at(76, 8, 1, 5)),
    ...[[64, 6], [64, 9], [64, 12], [68, 6], [68, 9], [68, 15], [72, 6], [72, 9], [72, 12]].map(([x, y]) => prop('rerun_station_wagon', x + 0.75, y + 0.65, at(x, y, 2))),
    prop('speaker', 72.5, 16.5, at(72, 16)),
    prop('speaker', 75.5, 16.5, at(75, 16)),
    prop('lights', 73.5, 15.5, { motion: cycle(4, 3), ...at(73, 15) }),
    // (The snack counter.)
    prop('bench_2', 70.5, 23.5, at(70, 23, 2, 1)),
    lantern('rose', 62.5, 6.5),
    lantern('rose', 62.5, 12.5),
    lantern('rose', 62.5, 17.5),
    lantern('rose', 69.5, 19.5),
    // The back lot behind the snack counter: the drive-in's sprinklers, and the three that have gone touchy.
    sprinkler(73, 24), sprinkler(77, 27),
    // RALF'S TV VAN: the van, the sets he is mending on the lawn, his mast (seen from all over the estate).
    house('rerun_house_1986', 30, 14),
    prop('van', 34.0, 16.6, at(33, 16, 2, 1)),
    prop('mast', 35.5, 14.5, { night: 'mast_on', shadow: { tall: 2.4, wide: 0.4 }, lights: [light('red', 1.4, 0.9, { z: 3.2, anim: 'blink' })], ...at(35, 14) }),
    prop('console', 32.5, 17.5, { motion: cycle(2, 2), ...at(32, 17) }),
    prop('console', 33.5, 17.5, { motion: cycle(2, 2), ...at(33, 17) }),
    // The yard sale on the next lawn: everything a bit (the table is the counter), and the park behind its fence.
    house('rerun_house_1', 24, 14),
    prop('table_records', 23.5, 19.5, at(23, 19)),
    prop('table', 26.5, 19.5, { cover: { x: 26, y: 19, w: 1, h: 1 } }),
    prop('sofa_3', 29.0, 19.5, at(28, 19, 2, 1)),
    prop('shelf_1', 23.5, 17.5, at(23, 17)),
    prop('plant', 27.5, 17.5, at(27, 17)),
    prop('bike', 24.5, 20.5, at(24, 20)),
    prop('fountain', 29.5, 24.5, { motion: cycle(2, 2), ...at(29, 24) }),
    // Main street, down to the sea.
    lantern('gold', 40.5, 10.5),
    lantern('gold', 37.5, 14.5),
    lantern('gold', 37.5, 24.5),
    lantern('gold', 40.5, 27.5),
    // THE PHONE BOOTH on second street's corner, lit ice blue; the flamingo flock on the common.
    house('rerun_house_0', 43, 17), house('rerun_house_1', 51, 17),
    prop('rerun_mailbox', 46.5, 20.45, at(46, 20)),
    prop('rerun_mailbox', 50.5, 20.45, at(50, 20)),
    prop('rerun_phone_booth', 58.5, 24.65, { cover: { x: 58, y: 24, w: 1, h: 1 }, shadow: { tall: 1.2, wide: 0.28 }, lights: [light('ice', 2, 0.7, { z: 0.9, dy: 0.5 })] }),
    prop('rerun_flamingo', 51.6, 25.5, at(51, 25)),
    prop('rerun_flamingo', 52.6, 26.5, at(52, 26)),
    prop('rerun_flamingo', 53.6, 25.5, at(53, 25)),
    lantern('violet', 41.5, 20.5),
    lantern('violet', 48.5, 20.5),
    lantern('violet', 56.5, 23.5),
    // THE MARINA: the promenade's lamps, the bike kid's bike, the one flamingo on the members' island.
    ...[6, 18, 30, 46, 56, 74].map(x => lantern('cyan', x + 0.5, 30.5)),
    prop('bike', 26.5, 30.5, at(26, 30)),
    prop('rerun_flamingo', 69.6, 34.5, at(69, 34)),
  ],
  marks: {
    'A': gateHome('lawns'),
    'E': sign('RERUN ESTATES. A NICE STREET.\nTHE SAME NICE STREET,\nOVER AND OVER.'),
    'J': sign('SOLD. NEW OWNERS MOVING IN SOON.\nTHEY HAVE BEEN MOVING IN SOON\nFOR YEARS.'),
    'N': sign('↓ THE HEDGE MAZE.\nTHE CAT IS IN THERE AGAIN.\nTHE PRIZE IS BY THE GATE.'),
    'Q': sign('← MIRROR LAKE.\n→ THE CUL-DE-SAC, THE DRIVE-IN.\n↓ THE MARINA.'),
    'U': sign('THE CUL-DE-SAC.\nEVERYONE TURNS AROUND HERE.\n↑ STILLSAND, UP THE DUNES.'),
    'V': sign('↑ STILLSAND, UP THE DUNES.\n↓ THE CUL-DE-SAC.'),
    'W': sign('THE DRIVE-IN. TONIGHT:\nTHE OVERDUE FOUR. ONE NIGHT\nONLY. EVERY NIGHT.'),
    'e': sign('PHONE BOOTH. THE LINE IS BUSY.\nIT HAS BEEN BUSY FOR YEARS.'),
    'g': sign('THE MARINA. THREE BERTHS.\nEVERY BOAT IS OUT. BACK SOON.'),
    'k': sign('THE ISLAND. MEMBERS ONLY.\nMEMBERS ARE ASKED NOT TO SWIM.'),
    'p': sign('→ THE PHONE BOOTH.\n→ THE DRIVE-IN.\n↓ THE MARINA.'),
    's': sign('LAWN OF THE MONTH.\nEVERY MONTH.'),
    'a': npc('q.map.paperboy', 'toby', [{ when: { flag: 'q.map.p4' }, lines: ['OTTO: EXTRA! SAME NEWS AS YESTERDAY.', 'OTTO: THE MAP MAN? HE CAMPS IN STILLSAND. NORTH, UP OVER THE DUNES.'] }, { lines: ['OTTO: EXTRA! A MAP PAGE FELL OUT OF THE SKY.', 'OTTO: I FOLDED IT INTO TODAY\'S PAPER. HERE. NO CHARGE.'], set: 'q.map.p4' }], { wander: true }),
    'd': npc('rerun.bikekid', 'kid', [{ lines: ['BIKE KID: I\'VE RIDDEN ROUND THE BLOCK A THOUSAND TIMES. IT\'S ALWAYS THE SAME BLOCK.', 'BIKE KID: THE SEA WALL UNDER THE DRIVE-IN IS CRACKED. ONE GOOD BANG AND I COULD RIDE UP.'] }], { wander: true }),
    'h': npc('q.act.repairman', 'max', [{ when: { flag: 'q.act.tape' }, lines: ['RALF: EVERY SET ON THE STREET SHOWS THE PLAY NOW, RIGHT TO THE END.', 'RALF: THE TAPE BELONGS ON THE RAINCHECK. FOGSTAGE, FAR WEST.'] }, { when: { flag: 'q.act.trap' }, lines: ['RALF: A STOLEN LAST ACT? IT WENT OUT ON THE AIR, AND I TAPED IT. I TAPE EVERYTHING.', 'RALF: TAKE THE TAPE BACK TO THE RAINCHECK, IN FOGSTAGE. FAR WEST, PAST MIRROR LAKE.', 'RALF: PAST THE NEON COAST AND THE WILDWOOD, TOO. IT IS A LONG WAY FOR A TAPE.'], set: 'q.act.tape' }, { lines: ['RALF: TV REPAIRS. EVERY SET ON THE STREET SHOWS THE SAME PLAY. IT STOPS BEFORE THE END.', 'RALF: I HAVE CHECKED THE TUBES TWICE. THE TUBES ARE FINE.'] }]),
    'j': npc('rerun.seller', 'vendor', [{ lines: ['YARD SELLER: EVERYTHING\'S A BIT. EVEN THE DOG.', 'YARD SELLER: SAME SALE EVERY SATURDAY, SAME THINGS ON THE TABLE. NOBODY TAKES THE DOG.'] }]),
    'y': { tile: 'n', ent: { t: 'shop', id: 'rerun.sale', item: 'heart', price: 1 } },
    'u': npc('l.band', 'guitar', [{ lines: ['LENNY: WE\'RE THE OVERDUE FOUR. WE OWE THE DRIVE-IN ONE GIG. WE HAVE OWED IT FOR YEARS.', 'LENNY: THREE OF US ARE HERE. THE BASSIST WANDERED OFF WITH THE BASS. AND THE VAN.'] }]),
    'm': npc('l.rose', 'mossa', [{ lines: ['ROSE: I PLANTED THAT OAK WHEN I WAS SMALL. MIND THE ROOTS.', 'ROSE: THE STREET LOOKS THE SAME EVERY YEAR. THE OAK IS HOW I KNOW IT ISN\'T.'] }]),
    'z': npc('rerun.rocker', 'guitar', [{ lines: ['TEEN ROCKER: MY BAND PRACTISES IN THE GARAGE. THE NEIGHBOURS PRACTISE COMPLAINING.', 'TEEN ROCKER: ONE DAY I WILL PLAY THE DRIVE-IN. THE BAND THEY BOOKED IS ONE BASSIST SHORT.'] }]),
    '0': npc('rerun.cat', 'cat', [{ lines: ['MRRP.', '(THE CAT HAS FOUND THE MIDDLE OF THE MAZE. IT HAS NO PLANS TO LEAVE.)'] }]),
    '9': npc('rerun.gardener', 'mossa', [{ lines: ['GARDENER: MOW ON SATURDAY, WATER ON SUNDAY. EVERY WEEK. THE GRASS NEVER GROWS.', 'GARDENER: MY ROSES WIN THE SHOW EVERY YEAR. NOBODY ELSE ENTERS. THAT\'S NOT MY FAULT.'] }]),
    '8': npc('rerun.kid', 'kid', [{ lines: ['NEIGHBOUR KID: I DUG A HOLE IN THE COMMON. NEXT DAY IT WAS FILLED IN. NOBODY DID IT.', 'NEIGHBOUR KID: THE PHONE BOOTH RINGS AT NIGHT. NOBODY ANSWERS. I\'M NOT ALLOWED.'] }]),
    // The lawn answers back: a mailbox spitter on each of the avenue's lots, flamingo drones at the drive-in, mower
    // hounds by the fountain (the skins: `render/renderer.ts`).
    '6': { tile: ':', ent: { t: 'enemy', kind: 'spitter', dir: 'down' } },
    '+': { tile: ',', ent: { t: 'enemy', kind: 'spitter', dir: 'down' } },
    '&': { ent: { t: 'enemy', kind: 'drone' } },
    '7': { ent: { t: 'enemy', kind: 'hound' } },
    '1': { ent: { t: 'chest', id: 'rerun.island', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'rerun.maze', item: 'bits50' } },
    '5': { ent: { t: 'chest', id: 'rerun.close', item: 'bits20' } },
    '3': { ent: { t: 'chest', id: 'rerun.screen', item: 'bits20' } },
    '4': { ent: { t: 'chest', id: 'rerun.lawn', item: 'bits20' } },
    'v': { tile: '>', ent: { t: 'warp', to: 'bombshelter', entry: 'door' } },
  },
}

/** THE BOMB SHELTER: under the common, through the hatch somebody filled in. GORDON came down for a drill. */
export const BOMBSHELTER: MapDef = {
  id: 'bombshelter',
  name: 'THE BOMB SHELTER',
  kind: 'interior',
  track: 'indoor',
  cells: { '0,0': { dark: true } },
  rows: [
    '################',
    '#[[[[......[[[[#',
    '#..............#',
    '#.nn......M....#',
    '#......a.......#',
    '#..............#',
    '#.o.o.....1....#',
    '#..............#',
    '#.((......((...#',
    '#......@.......#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'rerun', entry: 'shelter' } },
    '1': { ent: { t: 'chest', id: 'bombshelter.tins', item: 'bits50' } },
    a: npc('bombshelter.gordon', 'guard', [{ lines: ['GORDON: THIS IS A DRILL. I CAME DOWN FOR THE DRILL. NOBODY SOUNDED THE ALL CLEAR.', "GORDON: WHAT YEAR IS IT UP THERE? NO, DON'T TELL ME. IT'S ALWAYS THE SAME ONE."] }]),
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { rerun: RERUN, bombshelter: BOMBSHELTER }
