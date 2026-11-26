/**
 * YULE FJORD: the dark time on a fjord that opens to the western sea (docs/worlds/atlas.md; its place on the grid is
 * world/atlas.ts). Two roads come down from the tops, from Lumenby's quarry hills and from Seter Fell's Cairn Ridge,
 * and meet in THE PASS above the village. THE STILTS is the sleeping village on its quay over the water, a few lamps
 * kept lit; THE STAVE CHURCH stands on its rise above it with the cracked bell; THE HARBOUR is where the ferry from
 * the town's pier comes in; THE LIGHTHOUSE watches the mouth. East, the fjord's head is frozen: THE ICE FLATS hold
 * the old lamp and the ice house, and the only way over to THE FAR SHORE: a sleeping hamlet whose lamps wake when
 * the old lamp's beam is turned into the dark lamp, the rapid that never freezes, the sea cave under the cliffs and
 * a heart piece in a nook the stilts' long pier looks at. The shore path ends on the bank straight across from the
 * pier's post, where the hook comes back. In the spruce east of the ice road a frozen tarn keeps an ice-fishing camp.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`.
 */
import type { AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { COTTAGE, at, cycle, lantern, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })

/** The lighthouse's beam still going out to sea: once, and only while the Gate stands open. */
const BEAM: AreaIntro = { lines: ['(A BEAM GOES OUT TO SEA AND COMES BACK WITH A HISS.)'], who: null, flag: 'yulefjord.beam', when: { notFlag: 'gateShut' } }

/** A red cottage under snow, its windows lit at night; cover is its 3×3 of H. */
const cottage = (x: number, y: number): IsoLandmark => prop('fjord_cottage', x + 1.5, y + 1.5, { night: 'fjord_cottage_night', cover: { x, y, w: 3, h: 3 }, lights: COTTAGE })
/** A boathouse on stilts at the water's edge; cover is its 5×3 of H. */
const boathouse = (x: number, y: number): IsoLandmark => prop('fjord_boathouse', x + 2.5, y + 1.5, { cover: { x, y, w: 5, h: 3 }, lights: [light('amber', 2.6, 0.7, { z: 0.7, dy: 1.8 })] })
/** The fjord's own lamp post on a 't' tile, lit (the warden's), put out (the sweeper's), or dark until a flag is set. */
const post = (x: number, y: number, lit: boolean | string = true): IsoLandmark => lit === true
  ? prop('fjord_lantern', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 }, lights: [light('amber', 3.2, 0.8, { z: 1.1, anim: 'fire' })] })
  : typeof lit === 'string'
    ? prop('fjord_lantern_out', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 }, lit: { flag: lit, art: 'fjord_lantern' }, lights: [light('amber', 3.2, 0.8, { z: 1.1, anim: 'fire', lit: true })] })
    : prop('fjord_lantern_out', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 } })

export const YULEFJORD: MapDef = {
  id: 'yulefjord',
  name: 'YULE FJORD',
  kind: 'overworld',
  track: 'static',
  look: 'snow',
  realm: 'yulefjord',
  kits: ['landing'],
  views: ['iso'],
  away: true,
  rows: [
    '########################################################################################',
    '########################################################################################',
    '~~~~~~~~###############################################~~###############################',
    '~~~~~~~~####################################5##########~~###############################',
    '~~~~~~~~######################T....#....;###,#...T#....~~.#THHH..;..T.....HHH.;.T.######',
    '~~~~~~~~###################......;...;......,......T.;.~~.m.HHH..;..T..;..HHH..T;..#####',
    '~~~~~~~~###################.1.T.T8.,,,,,,,,,,,,,,,,,,,,==,.;HHH..t.......tHHH..;.T7#####',
    '~~~~~~~~###################.....;..,;;.;.......;..7..;.~~,,,,,,,,,,,,,,,,,,,,,.;.....###',
    '~~~~~~~~~~~~~###~~#~######~###.....,............;;.....~~.############,#################',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~αααα#ααααααααααααααα~~ααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~αααααα#ααααααααααααα~~ααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ααααααααααααααααααααααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~==~~~~~~~~~~~~~~~~~~~~~~ααααααααααααααααααα#ααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~3~~~~~~~=|~~~~~~~~~~~~~~~~~~~~~~α#ααααααααααααααααααααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~~~~~=~~~~~~~~~~~~~~~~~~~~~~~ααααααααααααα#ααααααααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~~~~~=~~~~~~~~~~~[~~~~~~~~~~~αααα~~αααααα#αααα~~αααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~~~~~=~~~~~~~~~~~=~~~~~~~~~~~αααα~~ααααααααααααααααα#ααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~~~~~=~~~~~~~~~~~=~~~~~~~~~~~ααααααααααααααααααααααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~HHH~=~~HHH~~~HHH=~~HHH~~~~~~αααααααα#αααααααααααααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~HHH~=~~HHH~~~HHH=~~HHH~~~~~~αααααααααααααααα#αααααααααα###',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~=~~~HHH~=~~HHH~~~HHH=~~HHH~~~~~~ααααααααααααααααααααααααααα###',
    '~~~~~~~~~~~~HHHHH~~HHHHH~~=~~===s============c========~~~~..........................####',
    '~~~~~~~~~~~~HHHHH~~HHHHH~~=~,,,,,,,,,,,,,,,,,,,,,,,,e,,..M...........,....#h######.;####',
    '~~~~~~~~~~~~HHHHH~~HHHHH~~=~~:...E.,.t....,.t.....t...t....#########.,;...#......k2.####',
    '~~~~~~~~.---------d--------t-..HHH.,..HHH.,..HHH........;.;######y##.,;..;#αααααα#:.####',
    '~~~~~~~~.----------------,--J..HHH.,..HHH.,..HHH......:....#.αααααα#.,....#αμαααα#..####',
    '~~~~~~~~...t..;.,....t..,,....;HHH.,..HHH.,..HHH...........#.αbααα##.,....#αααααα#;.####',
    '~~~.............,......;,;;...,,,,,,,,,,,,,,,,,,,,,,,,,,,.;#.ααααα.#;,..;;#......#.:####',
    '~~~............FFFFFF...,...........,.;....;,.........;...;#......4#.,....####.###..####',
    '~~.HHH.6........,.f.....,....;.;....,t...T..,.###########.T####,####.,........,NT..:####',
    '~~.HHH.........FFFFFF...,....FFFF..,,.;.....,T#.;HHHHH.;#......,,O,,,,,,,,,,,,,.TTTT####',
    '~~.HHH....t.::..,.....;.,.........,,...w...;,;#..HHHHH..#TTT.TT......,.T.;T.TT.T.:..####',
    '~~..,.....;.,,,,,,,,,...,....FFFF.,.........,.#..HHHHH..#.;...;..T...,:.;.T.........####',
    '~~.;,,,,,,,,,.......,,,,,,,,,...;.,.........,;#.;HHHHH..#...8.T.T.T..,:.T.T..T..T.T.####',
    '~~..;...L....;....;.;..TT...,....;,..;......,,,....a....#..;TT.....T***.T........T..####',
    '~~~....;.......TT.........;.......,..;........#.;..,....#...T..TT.T.:,;..αααα#ααα.T.####',
    '~~~~.;....;~........;.............,;;.....;T..#...K,....#TT..T....T.;,...ααααα#αα..T####',
    '##TTT....T.........;.........T....,...;...T...####,,,####......;.....,...αααααααα...####',
    '####T#####.....T....;T...9.r..T...,.........T......,........T..T;T.T.,:..#αααVαα#.T.####',
    '##T####T##..8...T..T:.............,T..........;....,....;T..T........,...αααααααα...####',
    '##T#######;...;...0..............C,.T..:.T...:....;,....T....0;...;..,...αα~ααααα.T.####',
    '###T######...T.............,,,,,,,,,,,,,,,,,,,,,,,,,,....T.TT...T.T.;,...αααα#ααα..T####',
    '##T###TT##..;;.....;.,,,,,,,.;.;....;...............,,,;....;...T.T;.,.T...;.....T..####',
    '####T#TT#T...T...,,,,,......I....;......I.............,,,;.T....T.:,,,.T..T....;T.:.####',
    '##########....;,,,.....;.........;....T;..........;.....,,,..T....,,.;T..TT.TT.9.T..####',
    '##T#T#####...I,,..;...9T.T...T..T...T...T.;...9;.;......;.,,,..;,,,.;:TT.;T;..T.T..T####',
    '###T####T#.;,,,.T.T....;T.;.;...T......;.......;............,,,,,.;..T..;..T.T.TT...####',
    '###T######T,,A...;]...........;T....;...T...:;.....;....TTT.I;,,.:;......T..T..;T...####',
    '#########T.,T..T.....;........................;........:.TTTTT.,TB.....T..T:T....T..####',
    '######T##T.,........;...:....T.T..................;.........T..,...T....;......T....####',
    '##########,,,#################################################,,,#######################',
    '##########,,,#################################################,,,#######################',
  ],
  areas: [
    { name: 'THE FAR SHORE', x: 26, y: 0, w: 62, h: 9, entry: 'farshore' },
    { name: 'THE LIGHTHOUSE', x: 0, y: 0, w: 13, h: 38, entry: 'lighthouse', intro: BEAM },
    { name: 'THE HARBOUR', x: 13, y: 9, w: 16, h: 29, entry: 'ferry' },
    { name: 'THE STAVE CHURCH', x: 44, y: 28, w: 12, h: 12, entry: 'church' },
    { name: 'THE STILTS', x: 29, y: 9, w: 27, h: 29, entry: 'camp' },
    { name: 'THE ICE FLATS', x: 56, y: 9, w: 32, h: 31, entry: 'iceflats' },
    { name: 'THE PASS', x: 0, y: 38, w: 88, h: 14, entry: 'pass' },
  ],
  entries: {
    'camp': { x: 36.5, y: 23.5, dir: 'down' },
    'ferry': { x: 26.5, y: 15.5, dir: 'down' },
    'lighthouse': { x: 8.5, y: 32.5, dir: 'down' },
    'church': { x: 51.5, y: 35.5, dir: 'down' },
    'iceflats': { x: 60.5, y: 21.5, dir: 'up' },
    'farshore': { x: 70.5, y: 6.5, dir: 'down' },
    'pass': { x: 34.5, y: 42.5, dir: 'up' },
    'seacave': { x: 44.5, y: 4.5, dir: 'down' },
  },
  isoLandmarks: [
    // THE STILTS: four cottages over the water on the quay, three ashore; the harbour's boathouses; the church, the lighthouse.
    cottage(30, 18),
    cottage(37, 18),
    cottage(43, 18),
    cottage(49, 18),
    cottage(31, 24),
    cottage(38, 24),
    cottage(45, 24),
    // The far shore's hamlet under the cliff, asleep; its two lamps wake with the old lamp's beam.
    cottage(60, 4),
    cottage(74, 4),
    post(65, 6, 'yulefjord.lamp.lit'),
    post(73, 6, 'yulefjord.lamp.lit'),
    boathouse(12, 21),
    boathouse(19, 21),
    prop('fjord_church', 51.5, 32.05, { cover: { x: 49, y: 30, w: 5, h: 4 }, shadow: { tall: 2, wide: 1.15, deep: 1.1 }, lights: [light('gold', 2.2, 0.55, { z: 0.6, dy: 2.25 })] }),
    prop('fjord_lighthouse', 4.5, 30.5, { night: 'fjord_lighthouse_lens', cover: { x: 3, y: 29, w: 3, h: 3 }, motion: cycle(4, 1), lights: [light('cream', 6.5, 0.8, { z: 2.6, anim: 'sweep' }), light('amber', 2.2, 0.6, { z: 0.5, dy: 1.8 })] }),
    // The warden's fire on the green; the rest stop where the two roads meet.
    prop('campfire', 38.5, 32.5, { motion: cycle(3, 6), light: { r: 2.6, tone: 'gold', a: 0.7 }, ...at(38, 32) }),
    prop('camp_log', 37.6, 33.2),
    prop('camp_log', 39.5, 33.1),
    prop('camp_tripod', 38.5, 32.5),
    prop('camp_shelter', 28.3, 37.5),
    prop('camp_board_blank', 31.4, 39.05),
    prop('camp_log', 29.6, 39.4),
    prop('camp_log', 26.6, 39.2),
    // The ice-fishing camp on the tarn's west bank, its hole in the ice.
    prop('campfire', 71.5, 39.5, { motion: cycle(3, 6), light: { r: 2.4, tone: 'gold', a: 0.65 }, ...at(71, 39) }),
    prop('camp_tripod', 71.5, 39.5),
    prop('camp_log', 72.4, 40.5),
    prop('landing_crates', 71.5, 41.4, at(71, 41)),
    // The fjord's lamp posts (one put out), the harbour's things, floes, the ice's broken edge, the roads' lanterns.
    post(37, 23),
    post(44, 23),
    post(50, 23),
    post(54, 23, false),
    post(21, 26),
    post(11, 26),
    post(27, 24),
    post(10, 31),
    post(37, 29),
    prop('landing_harbour_light', 26.85, 13.9, { light: { r: 2.6, tone: 'cyan', a: 0.65 } }),
    prop('landing_bollard', 26.2, 18.5),
    prop('landing_bollard', 26.8, 16.4),
    prop('landing_bollard', 34.8, 16.5),
    // Boats moored by the piers' bollards, bobbing: two at the harbour pier, one at the stilts' pier.
    prop('harbour_boat', 25.0, 18.5, { motion: cycle(2, 1) }),
    prop('harbour_boat', 28.0, 16.5, { motion: cycle(2, 0.8) }),
    prop('harbour_boat', 36.0, 16.5, { motion: cycle(2, 1.25) }),
    prop('landing_crates', 22.5, 25.4, at(22, 25)),
    prop('landing_crates', 14.5, 25.3, at(14, 25)),
    prop('landing_net_rack', 10.6, 25.3, at(10, 25)),
    prop('fjord_floe_large', 12.5, 14.5),
    prop('fjord_floe_mid', 40.5, 11.5),
    prop('fjord_floe_small', 21.5, 18.5),
    prop('fjord_floe_mid', 52.5, 14.5),
    prop('fjord_floe_small', 5.5, 20.5),
    prop('fjord_floe_large', 47.5, 10.5),
    prop('fjord_floe_small', 30.5, 15.5),
    prop('fjord_floe_mid', 18.5, 10.5),
    prop('fjord_floe_small', 55.5, 18.5),
    prop('fjord_floe_mid', 3.5, 9.5),
    prop('fjord_edge_w', 58.5, 10.5),
    prop('fjord_edge_w', 58.5, 13.5),
    prop('fjord_edge_w', 58.5, 16.5),
    prop('fjord_edge_w', 58.5, 19.5),
    lantern('gold', 12.5, 49.5),
    lantern('gold', 16.5, 43.5),
    lantern('gold', 25.5, 41.5),
    lantern('gold', 35.5, 38.5),
    lantern('pink', 62.5, 48.5),
    lantern('pink', 57.5, 43.5),
    lantern('pink', 46.5, 40.5),
    lantern('violet', 50.5, 38.5),
    lantern('violet', 52.5, 39.5),
    lantern('cyan', 19.5, 31.5),
    lantern('cyan', 12.5, 34.5),
    lantern('cyan', 70.5, 40.5),
    lantern('cyan', 70.5, 26.5),
    lantern('rose', 33.5, 35.5),
    lantern('cyan', 45.5, 5.5),
    // The far shore: the ice landing seen from the ice, the bank across from the pier's hook post.
    lantern('cyan', 69.5, 6.6),
    lantern('cyan', 36.5, 8.4),
  ],
  marks: {
    // The ferry home from the end of the harbour pier; the sea cave's mouth in the far shore's cliff.
    '3': { ent: { t: 'warp', to: 'overworld', entry: 'ferry' }, tile: '=' },
    '5': { ent: { t: 'warp', to: 'seacave', entry: 'door' }, tile: 'D' },
    // Signs: the passes, the junctions and a few places.
    'A': sign('↑ THE STILTS AND THE HARBOUR.\n↓ LUMENBY QUARRY, OVER THE TOPS.'),
    'B': sign('← THE STILTS. ↑ THE ICE FLATS.\n↓ SETER FELL, OVER THE TOPS.'),
    'C': sign('↑ THE STILTS.\n← THE HARBOUR.\n→ THE STAVE CHURCH.'),
    'E': sign('YULE FJORD. 9 LAMPS, 1 WARDEN.\nTHE WARDEN WOULD LIKE A SECOND WARDEN.'),
    'J': sign('FERRY: END OF THE PIER.\nIT WILL WAIT. IT HAS NOWHERE ELSE TO BE.'),
    'K': sign('THE BELL IS CRACKED.\nSOMEONE RANG IT ANYWAY.\nIT SAID CLUNK.'),
    'L': sign('DO NOT ANSWER THE SEA.'),
    'M': sign('THE ICE HAS NO BRAKES.\nMIND THE OPEN WATER.'),
    'N': sign('THE OLD LAMP FACES THE WRONG WALL. THE DARK LAMP IS IN THE EAST WALL.'),
    'O': sign('THE ICE HOUSE. THE HEAVY PLATE HAS HELD NOTHING SINCE THE BLOCK GOT AWAY ON THE ICE.'),
    // The heart piece in the far shore's nook (over the ice), the two puzzles' chests, and four small finds.
    '1': { ent: { t: 'chest', id: 'yulefjord.nook', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'yulefjord.lamp', item: 'bits50', appear: { flag: 'yulefjord.lamp.lit' } } },
    '4': { ent: { t: 'chest', id: 'yulefjord.icehouse', item: 'bombs5', appear: { plates: ['yulefjord.icehouse'] } } },
    '[': { ent: { t: 'chest', id: 'yulefjord.pier', item: 'bits20' } },
    ']': { ent: { t: 'chest', id: 'yulefjord.pass', item: 'bombs5' } },
    '6': { ent: { t: 'chest', id: 'yulefjord.keeper', item: 'bits20' } },
    'V': { ent: { t: 'chest', id: 'yulefjord.tarn', item: 'bits50' } },
    // THE OLD LAMP (beam, mirror on ice) and THE ICE HOUSE (block on ice onto the heavy plate): proven by the kit solver.
    'h': { ent: { t: 'emitter', dir: 'down' } },
    'k': { ent: { t: 'receiver', flag: 'yulefjord.lamp.lit' } },
    'y': { ent: { t: 'plate', id: 'yulefjord.icehouse' }, tile: 'η' },
    // ASLAK and the cracked bell (`q.bell.*`, docs/worlds/quests.md): the Clinker lies south-east past Seter Fell; the seters south.
    'a': npc('q.bell.ringer', 'keeper', [
      { when: { flag: 'q.bell.rung' }, lines: ['ASLAK: IT RINGS EVERY HOUR NOW. EVEN WHEN ASKED NOT TO.'] },
      { when: { flag: 'q.bell.cast' }, lines: ['ASLAK: RECAST! UP IT GOES.', '(DONG. THE WHOLE FJORD GOES QUIET TO LISTEN.)', 'ASLAK: SOMEWHERE SOUTH, ON THE SETERS, A GIRL WITH HAY IN HER HAIR JUST LOOKED UP.'], set: 'q.bell.rung', give: 'heartPiece' },
      { when: { flag: 'q.bell.crack' }, lines: ['ASLAK: THE CLINKER. ASK FOR RAGNA. SHE WILL NOT SMILE.'] },
      { lines: ['ASLAK: THE BELL CRACKED IN THE COLD. A BELL THAT CANNOT RING CALLS NOBODY HOME.', 'ASLAK: NO FIRE ON THE FJORD IS BIG ENOUGH. I TRIED THE STOVE. THE BELL DID NOT FIT.', 'ASLAK: THE CLINKER, IN THE SPORELIGHT. THEY HAVE A FIRE THEY ARE PROUD OF.'], set: 'q.bell.crack' },
    ]),
    // The fjord's folk (the old frontier's yulefjord realm).
    'w': npc('yulefjord.warden', 'guard', [{ lines: ['LAMP WARDEN: I LIGHT THEM. THE OLD WOMAN WITH THE BROOM PUTS THEM OUT.', 'LAMP WARDEN: WE HAVE NEVER BEEN IN THE SAME PLACE. I THINK SHE PLANS IT.', 'LAMP WARDEN: SUN BUNS FOR EVERYONE AT SUNRISE. I HAVE BEEN SAVING ROOM.'] }]),
    's': npc('yulefjord.sleeper', 'sleeper', [{ lines: ["SLEEPER: WAKE ME... WHEN IT'S... BUNS..."] }]),
    'c': npc('yulefjord.chalk', 'sledchild', [{ lines: ['CHALK GIRL: THE DOORS BY THE PIER HAVE NO MARKS. THAT IS VERY BAD.', "CHALK GIRL: I'M NOT SCARED OF THE DARK. I'M SCARED OF WHAT RIDES ACROSS IT."] }], { wander: true }),
    'e': npc('yulefjord.sweeper', 'lamplighter', [{ lines: ["SWEEPER: SUCH BRIGHT LAMPS. SUCH A SHAME. NOBODY NEEDS A LAMP WHEN THEY'RE ASLEEP.", 'SWEEPER: I SWEEP THE DOORSTEPS, DEAR. AND WHATEVER I FIND ON THEM.'] }]),
    'm': npc('yulefjord.musician', 'guitar', [{ when: { flag: 'yulefjord.lamp.lit' }, lines: ['(THE MUSICIAN PLAYS THE LAST BAR. IT IS ONE NOTE.)'] }, { lines: ['MUSICIAN: SOMETHING IN THE RAPID TAUGHT ME ONE TUNE. NOT THE END OF IT.', 'MUSICIAN: HUM ME THE LAST BAR, IF YOU KNOW IT. NOBODY KNOWS IT.'] }]),
    'f': npc('yulefjord.fishwife', 'fjordfisher', [{ lines: ['FISHWIFE: SOMETHING ATE MY FISH. SOMETHING WET.'] }]),
    'd': npc('yulefjord.grandad', 'keeper', [{ when: { flags: ['gateShut'], not: ['yulefjord.hiss'] }, lines: ['GRANDAD: THE BEAM CAME BACK EMPTY TODAY. FIRST TIME IN THREE NIGHTS. I MISS THE HISS.'], set: 'yulefjord.hiss' }, { lines: ['GRANDAD: THREE CRIES OUT ON THE WATER LAST NIGHT. NOBODY ROWS IN THE DARK.', "GRANDAD: HALF A BOAT WENT PAST IN THE FOG. HALF A MAN ROWING IT. DON'T WAVE."] }]),
    // Field foes: seals on the far shore, bats under the cliffs, wisps on the pass, skulls in the spruce.
    '7': { ent: { t: 'enemy', kind: 'dasher' } },
    '8': { ent: { t: 'enemy', kind: 'bat' } },
    '9': { ent: { t: 'enemy', kind: 'zapper' } },
    '0': { ent: { t: 'enemy', kind: 'skull' } },
  },
}

/** THE SEA CAVE: under the far shore's cliffs, where the tide comes in and something carved a name. */
export const SEACAVE: MapDef = {
  id: 'seacave',
  name: 'THE SEA CAVE',
  kind: 'dungeon',
  track: 'indoor',
  cell: { w: 16, h: 12 },
  cells: { '0,0': { name: 'THE SEA CAVE', dark: true } },
  rows: [
    '################',
    '################',
    '#~~~~~~~...1...#',
    '#~~~~~~..v....o#',
    '#~~~~~.....r...#',
    '#~~~~..........#',
    '#~~~....r...~~~#',
    '#~~.........~~~#',
    '#.....n.....~~~#',
    '#.r........o..v#',
    '#......@.......#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'yulefjord', entry: 'seacave' } },
    '1': { ent: { t: 'chest', id: 'seacave.wreck', item: 'bits50' } },
    v: { ent: { t: 'enemy', kind: 'bat' } },
    n: { tile: 'S', ent: { t: 'sign', lines: ['(SOMEONE HAS CARVED A NAME INTO THE ROCK. YOU DECIDE NOT TO SAY IT OUT LOUD.)'] } },
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { yulefjord: YULEFJORD, seacave: SEACAVE }
