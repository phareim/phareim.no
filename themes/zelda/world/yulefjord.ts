/**
 * YULE FJORD: the dark time on a fjord that opens to the western sea (docs/worlds/atlas.md; its place on the grid is
 * world/atlas.ts). Two roads come down from the tops, from Lumenby's quarry hills and from Seter Fell's Cairn Ridge,
 * and meet in THE PASS above the village. THE STILTS is the sleeping village on its quay over the water, a few lamps
 * kept lit; THE STAVE CHURCH stands on its rise above it with the cracked bell; THE HARBOUR is where the ferry from
 * the town's pier comes in; THE LIGHTHOUSE watches the mouth. East, the fjord's head is frozen: THE ICE FLATS hold
 * the old lamp and the ice house, and the only way over to THE FAR SHORE, where the sea cave opens under the cliffs
 * and a heart piece waits in a nook the stilts' long pier looks straight at. From the far shore the hook comes
 * back to the pier.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`.
 */
import type { AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { COTTAGE, at, cycle, lantern, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })

/** The fjord's first-visit words, in whichever area the hero arrives (the ferry, a pass): once. */
const INTRO: AreaIntro = { lines: ['THE SUN HAS NOT RISEN FOR WEEKS. THE VILLAGE SLEEPS, AND A FEW LAMPS STAY LIT.'], who: null, flag: 'realm:yulefjord' }

/** A red cottage under snow, its windows lit at night; cover is its 3×3 of H. */
const cottage = (x: number, y: number): IsoLandmark => prop('fjord_cottage', x + 1.5, y + 1.5, { night: 'fjord_cottage_night', cover: { x, y, w: 3, h: 3 }, lights: COTTAGE })
/** A boathouse on stilts at the water's edge; cover is its 5×3 of H. */
const boathouse = (x: number, y: number): IsoLandmark => prop('fjord_boathouse', x + 2.5, y + 1.5, { cover: { x, y, w: 5, h: 3 }, lights: [light('amber', 2.6, 0.7, { z: 0.7, dy: 1.8 })] })
/** The fjord's own lamp post on a 't' tile, lit (the warden's) or put out (the sweeper's). */
const post = (x: number, y: number, lit = true): IsoLandmark => lit
  ? prop('fjord_lantern', x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 }, lights: [light('amber', 3.2, 0.8, { z: 1.1, anim: 'fire' })] })
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
    '~~~~~~~~######################T....#....;###,#...T#...~~~~#........#.#...#;#.T#;##.#.###',
    '~~~~~~~~###################......;...;....R.,......T.;~~~~.;;T....T.;.T........7;....###',
    '~~~~~~~~###################.1.T.T8...........T......;..~~m....T...........;.....;8T..###',
    '~~~~~~~~###################.....;...;;.;.......;....7...;.;..........................###',
    '~~~~~~~~~~~~~###~~#~######~###..................;;........############.#################',
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
    '~~~~~~~~~~~~HHHHH~~HHHHH~~=~~:...E.,.t...Q,.t.....t...t....#########.,;...#......k2.####',
    '~~~~~~~~.---------d--------t-..HHH.,..HHH.,..HHH........;.;######y##.,;..;#αααααα#:.####',
    '~~~~~~~~.----------------,--J..HHH.,..HHH.,..HHH......:....#.αααααα#.,....#αμαααα#..####',
    '~~~~~~~~...t..;.,....t..,,....;HHH.,..HHH.,..HHH...........#.αbααα##.,....#αααααα#;.####',
    '~~~.............,......;,;;...,,,,,,,,,,,,,,,,,,,,,,,,,,,.;#.ααααα.#;,..;;#......#.:####',
    '~~~............FFFFFF...,...........,.;....;,..z......;...;#......4#.,....####.###..####',
    '~~.HHH.6........,.f.....,....;.;....,t...T..,.###########.T####,####.,........,NT..:####',
    '~~.HHH.........FFFFFF...,....FFFF..,,.;.....,T#.;HHHHH.;#......,,O,,,,,,,,,,,,,.TTTT####',
    '~~.HHH....t.::..,.....;.,.........,,...w...;,;#..HHHHH..#TTT.TT......,.T.;T.TT.T.:..####',
    '~~........;.,,,,,,,,,...,....FFFF.,.........,.#..HHHHH..#.;...;..T...,:.;.T.........####',
    '~~.;..,,,,,,,.......,,,,,,,,,...;.,.........,;#.;HHHHH..#...8.T.T.T..,:..TT..0.T.T..####',
    '~~..;...L....;....;.;..TT...,....;,..;......,,,....a....#..;TT.....T***.T........:..####',
    '~~~....;.......TT.........;.......,..;........#.;..,....#...T..TT.T.:,;....T.T..T.;.####',
    '~~~~.;....;~........;.............,;;.....;T..#...K,....#TT..T....T.;,...;T......T..####',
    '##TTT....T.........;.........T....,...;...T...####,,,####......;.....,;.T:....T..TT;####',
    '####T#####.....T....;T...7.r..T...,.........T......,........T..T;T.T.,:..T.;T...T;..####',
    '##T####T##..8...T..T:.............,T..........;....,....;T..T........,..T......T..T.####',
    '##T#######;...;...0..............C,.T..:.T...:....;,....T.....;...;..,.....T......;.####',
    '###T######...T.............,,,,,,,,,,,,,,,,,,,,,,,,,,....T.TT...T.T.;,.:..T..T..T...####',
    '##T###TT##..;;.....;.,,,,,,,.;.;....;...............,,,;....;...T.T;.,..T.T......;..####',
    '####T#TT#T...T...,,,,,......IP...;......I.............,,,;.T....T.:,,,.T..T....;T.:.####',
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
    { name: 'THE FAR SHORE', x: 26, y: 0, w: 62, h: 9, entry: 'farshore', intro: INTRO },
    { name: 'THE LIGHTHOUSE', x: 0, y: 0, w: 13, h: 38, entry: 'lighthouse', intro: INTRO },
    { name: 'THE HARBOUR', x: 13, y: 9, w: 16, h: 29, entry: 'ferry', intro: INTRO },
    { name: 'THE STAVE CHURCH', x: 44, y: 28, w: 12, h: 12, entry: 'church', intro: INTRO },
    { name: 'THE STILTS', x: 29, y: 9, w: 27, h: 29, entry: 'camp', intro: INTRO },
    { name: 'THE ICE FLATS', x: 56, y: 9, w: 32, h: 31, entry: 'iceflats', intro: INTRO },
    { name: 'THE PASS', x: 0, y: 38, w: 88, h: 14, entry: 'pass', intro: INTRO },
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
  ],
  marks: {
    // The ferry home from the end of the harbour pier; the sea cave's mouth in the far shore's cliff.
    '3': { ent: { t: 'warp', to: 'overworld', entry: 'ferry' }, tile: '=' },
    '5': { ent: { t: 'warp', to: 'seacave', entry: 'door' }, tile: 'D' },
    // Signs: the passes, the junction, each place.
    'A': sign('↑ YULE FJORD.\n↓ LUMENBY QUARRY, OVER THE TOPS.'),
    'B': sign('↑ YULE FJORD.\n↓ SETER FELL, OVER THE TOPS.'),
    'C': sign('↑ THE STILTS.\n← THE HARBOUR.\n→ THE STAVE CHURCH.'),
    'E': sign('YULE FJORD. THE SUN COMES BACK IN SPRING. KEEP A LAMP LIT UNTIL THEN.'),
    'Q': sign('THE STILTS. NO KNOCKING. SLEEPERS INSIDE UNTIL SPRING.'),
    'J': sign('THE HARBOUR. THE FERRY SAILS FOR THE NEON COAST FROM THE END OF THE PIER.'),
    'K': sign('THE STAVE CHURCH. THE BELL CRACKED IN THE COLD. NO RINGING UNTIL IT MENDS.'),
    'L': sign('THE LIGHTHOUSE. DO NOT ANSWER THE SEA.'),
    'M': sign('THE ICE FLATS. THE ICE HAS NO BRAKES. MIND THE OPEN WATER.'),
    'N': sign('THE OLD LAMP SHINES DOWN ALL WINTER, AND THE DARK LAMP IN THE EAST WALL NEVER SEES IT.'),
    'O': sign('THE ICE HOUSE. THE HEAVY PLATE HAS HELD NOTHING SINCE THE BLOCK GOT AWAY ON THE ICE.'),
    'R': sign('THE SEA CAVE. THE TIDE COMES IN WITHOUT KNOCKING.'),
    'P': sign('CAIRN. ADD A STONE. TAKE NONE.'),
    // The heart piece in the far shore's nook (over the ice), the two puzzles' chests, and three small finds.
    '1': { ent: { t: 'chest', id: 'yulefjord.nook', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'yulefjord.lamp', item: 'bits50', appear: { flag: 'yulefjord.lamp.lit' } } },
    '4': { ent: { t: 'chest', id: 'yulefjord.icehouse', item: 'bombs5', appear: { plates: ['yulefjord.icehouse'] } } },
    '[': { ent: { t: 'chest', id: 'yulefjord.pier', item: 'bits20' } },
    ']': { ent: { t: 'chest', id: 'yulefjord.pass', item: 'bombs5' } },
    '6': { ent: { t: 'chest', id: 'yulefjord.keeper', item: 'bits20' } },
    // THE OLD LAMP (beam, mirror on ice) and THE ICE HOUSE (block on ice onto the heavy plate): proven by the kit solver.
    'h': { ent: { t: 'emitter', dir: 'down' } },
    'k': { ent: { t: 'receiver', flag: 'yulefjord.lamp.lit' } },
    'y': { ent: { t: 'plate', id: 'yulefjord.icehouse' }, tile: 'η' },
    // ASLAK and the cracked bell (`q.bell.*`, docs/worlds/quests.md): the Clinker lies south-east past Seter Fell; the seters south.
    'a': npc('q.bell.ringer', 'keeper', [
      { when: { flag: 'q.bell.rung' }, lines: ['ASLAK: IT RINGS EVERY HOUR NOW. EVEN WHEN ASKED NOT TO.'] },
      { when: { flag: 'q.bell.cast' }, lines: ['ASLAK: RECAST! UP IT GOES.', '(DONG. THE WHOLE FJORD GOES QUIET TO LISTEN.)', 'ASLAK: WHOEVER WAS CARRIED OFF CAN HEAR THE WAY HOME NOW. TRY THE SETERS, SOUTH.'], set: 'q.bell.rung', give: 'heartPiece' },
      { when: { flag: 'q.bell.crack' }, lines: ['ASLAK: A FIRE HOT ENOUGH TO RECAST A BELL? THE CLINKER CAMP, IN THE SPORELIGHT.', 'ASLAK: SOUTH-EAST, PAST SETER FELL. THE EAST ROAD GOES OVER THE TOPS.'] },
      { lines: ['ASLAK: THE BELL CRACKED IN THE COLD. A BELL THAT CANNOT RING CALLS NOBODY HOME.', 'ASLAK: TAKE IT TO A FIRE BIG ENOUGH TO RECAST IT. THERE IS NONE ON THE FJORD.'], set: 'q.bell.crack' },
    ]),
    // The fjord's folk (the old frontier's yulefjord realm).
    'w': npc('yulefjord.warden', 'guard', [{ lines: ['LAMP WARDEN: KEEP THE LAMPS LIT TILL THE SUN COMES BACK. THAT\'S THE WHOLE JOB.', 'LAMP WARDEN: I AM THE LAST ONE AWAKE. I THINK. HELLO? OH, GOOD. YOU\'RE AWAKE TOO.', 'LAMP WARDEN: WHEN THE SUN COMES BACK, EVERYONE GETS SUN BUNS. I\'VE BEEN SAVING ROOM.'] }]),
    's': npc('yulefjord.sleeper', 'sleeper', [{ lines: ['SLEEPER: WAKE ME... WHEN IT\'S... BUNS...', '(THEY SLEEP ON THE PORCH IN A BOX BED, UNDER SIX SKINS.)'] }]),
    'z': npc('yulefjord.sleeper2', 'sleeper', [{ lines: ['SLEEPER: NOT YET... STILL DARK... FIVE MORE WEEKS...', 'SLEEPER: WHO\'S ROWING... NOBODY ROWS IN WINTER... SHH...'] }]),
    'c': npc('yulefjord.chalk', 'sledchild', [{ lines: ['CHALK GIRL: THE DOORS BY THE PIER HAVE NO MARKS. THAT IS VERY BAD.', 'CHALK GIRL: A CROSS ON EVERY DOOR, SO THE NIGHT RIDERS GO PAST. GRANDMA SAYS.', 'CHALK GIRL: I\'M NOT SCARED OF THE DARK. I\'M SCARED OF WHAT RIDES ACROSS IT.'] }], { wander: true }),
    'e': npc('yulefjord.sweeper', 'lamplighter', [{ lines: ['SWEEPER: MIND ROWING ME ACROSS THE FJORD, DEAR? MY BROOM IS TIRED.', 'SWEEPER: SUCH BRIGHT LAMPS. SUCH A SHAME. NOBODY NEEDS A LAMP WHEN THEY\'RE ASLEEP.', 'SWEEPER: I SWEEP THE DOORSTEPS, DEAR. AND WHATEVER I FIND ON THEM.'] }]),
    'm': npc('yulefjord.musician', 'guitar', [{ lines: ['MUSICIAN: SOMETHING IN THE RAPID TAUGHT ME ONE TUNE. NOT THE END OF IT.', 'MUSICIAN: I CAN\'T STOP PLAYING. MY FINGERS WON\'T LET ME. IT\'S BEEN THREE DAYS.', 'MUSICIAN: HUM ME THE LAST BAR, IF YOU KNOW IT. NOBODY KNOWS IT.'] }]),
    'f': npc('yulefjord.fishwife', 'fjordfisher', [{ lines: ['FISHWIFE: SOMETHING ATE MY FISH. SOMETHING WET.', 'FISHWIFE: COD ON THE RACKS ALL WINTER. IT DRIES IN THE DARK. SO DO I.', 'FISHWIFE: IF THE SEA CALLS YOUR NAME, DON\'T ANSWER. IT DOESN\'T WANT A CHAT.'] }]),
    'd': npc('yulefjord.grandad', 'keeper', [{ lines: ['GRANDAD: THREE CRIES OUT ON THE WATER LAST NIGHT. NOBODY ROWS IN THE DARK.', 'GRANDAD: HALF A BOAT WENT PAST IN THE FOG. HALF A MAN ROWING IT. DON\'T WAVE.', 'GRANDAD: THE BOATHOUSE STAYS SHUT TILL SPRING. THE SEA KNOWS WHO\'S INSIDE.'] }]),
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
