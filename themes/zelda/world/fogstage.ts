/**
 * FOGSTAGE: the lowland west of the Wildwood's Deep Woods, drowned to the knees of its hills in pink stage fog
 * (docs/worlds/atlas.md; its place on the grid is world/atlas.ts). From the deep woods gate the road climbs under the
 * arch into THE TICKET HILL, the first hill town out of the fog (the box office, the camp's fire, spotlights swinging
 * over the lowland); west of it the road goes down into the fog past BIRGER's BUCKET, the open-air stage whose trap
 * goes down UNDER THE STAGE, past Pia and her programs, and on to THE RAINCHECK's MAST, where the touring blimp is
 * moored over the western sea. South lie THE FLATS, painted scenery standing in the fog round the ponds, the fog
 * engine and a chest in a ring of bushes; north THE GHOST LIGHTS, a hilltop path of lone lamps (a chest in a nook
 * behind bushes) that loops back down into the Ticket Hill through a cracked rock; south-west THE WESTERN SHORE and
 * its bay, where a heart piece sits on an island seen from the beach: a cracked rock shuts the old pier's cove off
 * from the beach, and from the pier's end the hook bites the island's post (the post on the pier brings the hero
 * back). Under the stage lie bombs for both cracks.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`, the foes among them
 * (blobs at the Flats pond, skulls on the shore, bats at the ghost lights). A foe that walks, knocked into water,
 * drowns (`physics`).
 */
import type { AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { gateHome } from './gates'
import { at, BLIMP, bob, COTTAGE, cycle, lantern, light, POSTER, prop, SPOT } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (...lines: string[]): Mark => ({ tile: 'S', ent: { t: 'sign', lines } })

/** Fogstage's first-visit words, on the Ticket Hill: once. */
const INTRO: AreaIntro = { lines: ['(A SPOTLIGHT SWINGS OVER THE FOG, FINDS YOU, WAITS, AND MOVES ON.)'], who: null, flag: 'realm:fogstage' }

/** A stage spotlight on its stand, its head turned `dir` eighths of a turn from east, its beam swinging over the fog. */
const spot = (dir: number, x: number, y: number): IsoLandmark => prop(`fogstage_spotlight_${dir}`, x + 0.5, y + 0.6, { lights: SPOT, ...at(x, y) })
/** A house of the Ticket Hill on its 3×3 of H: a narrow painted house behind a stage-flat false front, its marquee bulbs always lit, its windows lit after dusk. */
const house = (x: number, y: number): IsoLandmark => prop('fogstage_house', x + 1.5, y + 1.5, { night: 'fogstage_house_night', cover: { x, y, w: 3, h: 3 }, lights: COTTAGE })
/** A painted flat standing in the fog, its two tiles of 'F' at (x, y) under it. */
const flat = (x: number, y: number): IsoLandmark => prop('fogstage_flat', x + 1, y + 0.75, { cover: { x, y, w: 2, h: 1 }, shadow: { tall: 1.15, wide: 0.7, deep: 0.06 } })

export const FOGSTAGE: MapDef = {
  id: 'fogstage',
  name: 'FOGSTAGE',
  kind: 'overworld',
  track: 'indoor',
  look: 'fog',
  realm: 'fogstage',
  views: ['iso'],
  away: true,
  physics: true,
  rows: [
    '######################################################################################TT',
    '######################################################################################TT',
    '~~~.##########.##########.###.#######;#.###..####.###.#######.##.###.######.########T#TT',
    '~~~~##########.########...#..##########.############.3.##########.#....:###########T##TT',
    '~~~~##########..######.......#########.:.....####.;.***##########.........###########TTT',
    '~~~##########.....:.......,...;.............,.......7.7.#########:.....;.############TTT',
    '~~~.#######........:...;.,t,.........;.....,t,...............#.,t,..;.;...###########TTT',
    '~~~.....:.........;..:....,..,,,,,,,,.;..:..,,,,,,,,,........,,,,,,,......###########.TT',
    '~~~.....;..:.;......,,,,,,,,,,..:...,,,,,,,,,,....t:,,,,,,,,,,###..,,,,,.;...#####....TT',
    '~~~~............,,,,,.....:......;.,.....i;.............,.t..#####.....,..............TT',
    '~~~;...........,,.........###.....,t,......####.........,;....###......,###.........TTTT',
    '~~~~......####,,.#.;.....######...:,.....#######........,.....:...#####R######......TTTT',
    '~~~~.....####,,######.:...###.............####......;...,.......#######,..######.....TTT',
    '~~~.....#####,..######...;;..;................:.........,:..;...####...,.....###...;.TTT',
    '~~~~..####...,,....####.......;..;......;....FF.FF.FF..:,......###HHH..,.HHH...#####TTTT',
    '~~~...##......,......##..;...:;~~~~;.......:.=========..,......###HHH..,.HHH...####TTTTT',
    '~~~~.###.............##.....;~~~~~~~;.:......====4====..,...:;###.HHH..,.HHH.HHH###TTTTT',
    '~~~~###...............##.....;~~~~;;.:.......=========.k,::...##.......,.....HHH.###TTTT',
    '~~~~###...............###......;;............=========..,..;..##.....,f,,,,,.HHH.....TTT',
    '~~~~###...............###................:......a......:,....###.....,,,,,,,..........TT',
    '~~~~###....,,,,,,,....###.d.........:.......:..:..........,,,,,,,,,,,,,,,,,,,,,,,,,,,,,A',
    '~~~~###...c,,,b,,,.,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..###....J,,,,,,,.e........TT',
    '~~~~###....,,,,,,,Q...##.............:............;..........###.....,,,,,,,.....B...TTT',
    '~~~~###...............###...:...............;.;...........;..###..HHH...,..HHH...##..TTT',
    '~~~~.###.............###..:.....:...FF...;..............:....####.HHH...,..HHH..####.TTT',
    '~~~~..##.............##....:...:...W...........................###HHH...,..HHH.####.T.TT',
    '~~~...####....,....###........:................;...........:...###......,......##....TTT',
    '~~~~...######.,.#####.....:..;..;;;;;.....;...............:.....####....,....###:...TTTT',
    '~~~.:...######,#####............;;;;;.....;.............:........######.,.#######....TTT',
    '~~~~--------..,###.............:;;;;;..:..;...:.:...........FF.....#####,######....T..TT',
    '~~~----------.,.......................~~~~~..;;.:......................,,####...:..T..TT',
    '~~~----------.,,,,,,,,,,..............~~~~~...............*****h...;...,.......;....TTTT',
    '~~~~~~~~~~~###########:,....;.........~~~~~;;;;;.....;....*.2.*.......,,......;;;..T.TTT',
    '~~~~~~~~~~~###########.,..;.........;:.....;;;;;;....:....*...*......,,..;...;;;;....TTT',
    '~~~~~~~~~~~~~~~~----##-,-..........:.......;;;;;..........*****;...,,g......;.;;;....TTT',
    '~~~~~~~~~~~~~~~~----##-,-........:........:...:;......!..:..;.....,,................TTTT',
    '~~~~~.|..~~~====----##-,U......:.....:...:..........;....:;..,,,,,,......:..~~~....T.TTT',
    '~~~~~....~~~=|==----R----...........:::.....,,,,,,,,,,,,,,,,,,.:..;.....:.;~~~~~.:;:.TTT',
    '~~~~~.1..~~~~~~~----##-,-.......:........,,,,............:....;..........;.:~~~.;:...TTT',
    '~~~~~~..;~~~~~~~----##-,-.......:......,,,;.........;;;;5;;..............FF..FF.....TTTT',
    '~~~~~~~~~~~###########-,-.;......;...,,,..;....FF.:.;;5;;;....:..................;:T.TTT',
    '~~~~~~~~~~~###########-,,....:.;...:,,..:........M:.~;;;;.....~~~~~...;............TT.TT',
    '~~~~~~~~~~~~~~~~~~~~----,,---------,,............~~~~~~~....:~~~~~~....;:..;........:TTT',
    '~~~~~~~~~~~~~~~~~~~~-----,,,,,,,,,,.............~~~~~~~~~.....~~~~~;;;;.............T.TT',
    '~~~~~~~~~~~~~~~~~~~~--------FF-----....:.........~~~~~~~..........;;;;;;.........;.TTTTT',
    '~~~~~~~~~~~~~~~~~~~~---------6--6--.....:......:.:..~.............;;;;;....:.......:TTTT',
    '~~~~~~~~~~~~~~~~~~~~-----~--~~~-~--..........~.:..;...;......:...~~.~...:.;.......~TTTTT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~..~~~;..~.~~..~.~.~~~.~~~;...~.~..~..~~~~.~.::~.TTTTT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT',
    '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT',
  ],
  areas: [
    { name: 'THE RAINCHECK\'S MAST', x: 0, y: 0, w: 26, h: 30, entry: 'mast' },
    { name: 'THE GHOST LIGHTS', x: 26, y: 0, w: 36, h: 12, entry: 'ghost' },
    { name: 'THE TICKET HILL', x: 62, y: 0, w: 26, h: 30, entry: 'camp', intro: INTRO },
    { name: 'BIRGER\'S BUCKET', x: 26, y: 12, w: 36, h: 18, entry: 'bucket' },
    { name: 'THE WESTERN SHORE', x: 0, y: 30, w: 35, h: 22, entry: 'shore' },
    { name: 'THE FLATS', x: 35, y: 30, w: 53, h: 22, entry: 'flats' },
  ],
  entries: {
    'gate-fog': { x: 85.5, y: 20.5, dir: 'left' },
    'camp': { x: 72.5, y: 21.5, dir: 'down' },
    'ghost': { x: 40.5, y: 8.5, dir: 'down' },
    'bucket': { x: 50.5, y: 20.5, dir: 'up' },
    'mast': { x: 14.5, y: 22.5, dir: 'down' },
    'flats': { x: 66.5, y: 36.5, dir: 'left' },
    'shore': { x: 23.5, y: 38.5, dir: 'down' },
    'trap': { x: 49.5, y: 17.5, dir: 'down' },
  },
  isoLandmarks: [
    prop('gate_fogstage_ew_off', 83.5, 20.5, { night: 'gate_fogstage_ew_on' }),
    // The Ticket Hill's houses, up the hill either side of its road.
    house(66, 14), house(73, 14), house(77, 16), house(66, 23), house(75, 23),
    prop('camp_fire', 70.1, 24.5, { motion: cycle(4, 5), light: { r: 2.2, tone: 'gold', a: 0.6 } }),
    prop('camp_log', 69.6, 25.3),
    prop('camp_log', 70.8, 25.2),
    prop('camp_tripod', 70.1, 24.5),
    spot(4, 65, 18),
    spot(5, 69, 13),
    spot(7, 76, 13),
    spot(3, 66, 26),
    prop('fogstage_poster_3', 65.5, 22.6, { lights: [light('pink', 1.5, 0.6, { z: 0.6, dy: 0.3 })] }),
    prop('camp_board_open', 79.6, 19.4),
    prop('fogstage_sandbags', 78.6, 25.4, at(78, 25)),
    prop('fogstage_sandbags', 69.6, 15.4, at(69, 15)),
    flat(45, 14),
    flat(48, 14),
    flat(51, 14),
    prop('speaker', 44.5, 16.5, at(44, 16)),
    prop('speaker', 54.5, 16.5, at(54, 16)),
    spot(7, 43, 18),
    spot(5, 55, 19),
    prop('camp_log', 45.6, 22.7),
    prop('camp_log', 47.4, 22.6),
    prop('camp_log', 51.6, 22.7),
    prop('camp_log', 53.4, 22.6),
    prop('camp_log', 46.5, 24.0),
    prop('camp_log', 48.6, 23.9),
    prop('camp_log', 50.4, 24.0),
    prop('camp_log', 52.5, 23.9),
    prop('fogstage_poster_5', 41.5, 19.6, { lights: [light('pink', 1.5, 0.6, { z: 0.6, dy: 0.3 })] }),
    prop('fogstage_raincheck', 12.5, 17.4, { motion: bob, shadow: { tall: 1.7, wide: 1.5, deep: 0.6 }, lights: BLIMP }),
    prop('fogstage_gangway', 12.5, 18.6),
    prop('mast', 17.5, 17.5, { night: 'mast_on', ...at(17, 17) }),
    prop('tent', 9.5, 16.5, at(9, 16)),
    spot(3, 19, 16),
    spot(1, 9, 24),
    prop('fogstage_poster_2', 15.9, 19.6, { lit: { flag: 'q.act.done', art: 'fogstage_poster_7' }, lights: POSTER }),
    prop('fogstage_poster_0', 27.5, 19.6, { lit: { flag: 'q.map.p2', art: 'fogstage_poster_1' }, lights: POSTER }),
    prop('tank', 67.5, 33.5, { motion: cycle(2, 2), ...at(67, 33) }),
    flat(60, 29),
    flat(47, 40),
    flat(36, 24),
    prop('fogstage_sandbags', 62.6, 29.4, at(62, 29)),
    prop('fogstage_sandbags', 46.1, 40.4, at(46, 40)),
    prop('fogstage_sandbags', 38.6, 24.4, at(38, 24)),
    prop('fogstage_sandbags', 27.1, 44.4, at(27, 44)),
    flat(28, 44),
    // The prop store out east in the fog.
    flat(73, 39),
    flat(77, 39),
    prop('fogstage_sandbags', 76.1, 40.4, at(76, 40)),
    prop('fogstage_poster_6', 75.5, 38.6, { lights: [light('pink', 1.5, 0.6, { z: 0.6, dy: 0.3 })] }),
    lantern('gold', 81.5, 21.5),
    lantern('gold', 80.5, 19.5),
    lantern('pink', 57.5, 22.5),
    lantern('pink', 39.5, 22.5),
    lantern('pink', 33.5, 22.5),
    lantern('pink', 27.5, 22.5),
    lantern('pink', 21.5, 22.5),
    lantern('cyan', 73.5, 28.5),
    lantern('cyan', 63.5, 37.5),
    lantern('cyan', 57.5, 38.5),
    lantern('cyan', 51.5, 38.5),
    lantern('cyan', 45.5, 38.5),
    lantern('cyan', 40.5, 40.5),
    lantern('rose', 13.5, 31.5),
    lantern('rose', 20.5, 30.5),
    lantern('rose', 24.5, 34.5),
    lantern('rose', 24.5, 40.5),
    lantern('rose', 28.5, 42.5),
  ],
  marks: {
    'A': gateHome('fog'),
    'B': sign('FOGSTAGE. THE FOG IS PART OF THE SHOW. PLEASE DO NOT WAVE IT AWAY.'),
    'J': sign('← THE RAINCHECK\'S MAST.\n↓ THE FLATS.\n→ THE WILDWOOD.'),
    'M': sign('SCENERY: THE MOON. YES, IT LOOKS LIKE A HOUSE. PLEASE DO NOT TELL THE MOON.'),
    'Q': sign('THE RAINCHECK. LATECOMERS WILL BE SEATED IN THE FOG.'),
    'U': sign('THE WESTERN SHORE. THE SEA IS REAL.\nNO PROPS, NO CUES, NO REFUNDS.', 'THE OLD PIER IS CLOSED. A ROCK SAT DOWN ACROSS THE WAY IN, JUST WEST OF HERE.'),
    'W': sign("← THE RAINCHECK'S MAST.\n→ BIRGER'S BUCKET."),
    // Blobs on the cut-grass bank of the Flats pond, skulls on the shore, bats round the ghost lights' nook. The first
    // two can be knocked into the water (`physics`); the bats fly.
    '5': { tile: ';', ent: { t: 'enemy', kind: 'blob' } },
    '6': { tile: '-', ent: { t: 'enemy', kind: 'skull' } },
    '7': { ent: { t: 'enemy', kind: 'bat' } },
    // A tough sentry on the Flats meadow, nine tiles west of the reeds chest.
    '!': { ent: { t: 'enemy', kind: 'sentry', tough: true } },
    '1': { ent: { t: 'chest', id: 'fogstage.island', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'fogstage.reeds', item: 'bits50' } },
    '3': { ent: { t: 'chest', id: 'fogstage.nook', item: 'bits50' } },
    '4': { ent: { t: 'warp', to: 'understage', entry: 'door' }, tile: '>' },
    'a': npc('q.act.prompter', 'sleeper', [{ when: { flags: ['q.act.trap', 'item:weightSources'] }, lines: ["BIRGER: IT'S QUIET UP THERE. I CHECKED. FROM MY BUCKET."] }, { when: { flag: 'q.act.trap' }, lines: ["BIRGER: THE TV MAN IN RERUN TAPES EVERYTHING. I'M STILL COMFORTABLE.", 'BIRGER: THE TRAP ROOM HAS STAIRS NOW. THEY GO UP.'] }, { lines: ['BIRGER: PSST. I SAW IT FROM MY BUCKET. ACT THREE WENT DOWN THE TRAP.', "BIRGER: A TV MAN IN RERUN, FAR EAST, TAPES EVERYTHING. I'D ASK, BUT I'M COMFORTABLE."], set: 'q.act.trap' }]),
    'b': npc('q.act.director', 'stagemanager', [{ when: { flags: ['q.act.done', 'item:weightSources'] }, lines: ['VEGA: SOURCES. SO IT WAS WRITTEN DOWN. AND SIGNED. LOVELY.', 'VEGA: PLACES, EVERYONE. ACT THREE, FROM THE TOP.'] }, { when: { flag: 'q.act.done' }, lines: ['VEGA: WE END EVERY NIGHT NOW. THE AUDIENCE CRIES. GOOD.', "VEGA: THE TV MAN'S COPY IS A COPY, THOUGH. I WANT THE ORIGINAL."] }, { when: { flag: 'q.act.tape' }, lines: ['VEGA: YOU BROUGHT THE ENDING. NOBODY HERE HAS SEEN IT. SIT, SIT, ALL OF YOU.'], give: 'heartPiece', set: 'q.act.done' }, { when: { flag: 'item:weightSources' }, lines: ['VEGA: A BRASS WEIGHT. STAMPED SOURCES. I ASKED FOR AN ACT.'] }, { lines: ['VEGA: THE RAINCHECK. YES, THE BLIMP. BEST SEATS IN THE FOG.', 'VEGA: ACT THREE IS GONE. I SAY "AND SCENE" AFTER ACT TWO AND WE ALL LOOK AT BIRGER.', 'VEGA: HE SAW IT HAPPEN. HE NEVER LEAVES HIS BUCKET, SO YOU WILL HAVE TO GO TO HIM.'] }]),
    'c': npc('q.act.cast', 'smoker', [{ lines: ['FINGERS: LOVELY SHOW. CHECK YOUR POCKETS.'] }]),
    'd': npc('q.map.programs', 'kid', [{ when: { flag: 'q.map.p2' }, lines: ['PIA: PROGRAMS. STILL NO ACT THREE. STILL HALF PRICE.'] }, { lines: ['PIA: PROGRAMS! ACT THREE IS TORN OUT, SO I GLUED IN A MAP PAGE INSTEAD.', 'PIA: NOBODY READS THEM ANYWAY. HAVE THE PAGE.'], set: 'q.map.p2' }]),
    'e': npc('fogstage.tickettaker', 'vendor', [{ lines: ["TICKET-TAKER: NO TICKET? THEN YOU'RE IN THE SHOW.", 'TICKET-TAKER: I TEAR EVERY TICKET IN HALF. THERE ARE NO TICKETS. I HAVE NEVER MISSED.'] }]),
    'f': npc('fogstage.usher', 'kid', [{ lines: ['USHER: THIS WAY, PLEASE. MIND THE FOG. MIND THE STEP. THERE IS NO STEP.'] }], { wander: true }),
    'g': npc('fogstage.stoker', 'dusty', [{ lines: ["FOG STOKER: EVERY WISP OF THIS FOG CAME OUT OF MY ENGINES. YOU'RE WELCOME.", 'FOG STOKER: ONE PUFF WENT WEST AND CAME BACK SHINING. LOOK OFF THE OLD PIER.'] }]),
    'h': npc('fogstage.stagehand', 'smoker', [{ lines: ['STAGEHAND: SAME SHOW EVERY NIGHT. I COULD DO IT IN MY SLEEP. LAST NIGHT I DID.'] }]),
    'i': npc('fogstage.nightwatch', 'stagemanager', [{ when: { flag: 'item:prism' }, lines: ['NIGHT WATCH: ONE LAMP ON AN EMPTY STAGE KEEPS THE GHOSTS FROM PUTTING ON A SHOW.', 'NIGHT WATCH: I CHECK EVERY GHOST LIGHT TWICE A NIGHT. ONCE FOR ME, ONCE FOR THEM.', "NIGHT WATCH: THE SUN WENT DOWN FOR REAL. THE GHOSTS CAME EARLY. I'VE ASKED THEM TO WAIT FOR A CUE."] }, { lines: ['NIGHT WATCH: ONE LAMP ON AN EMPTY STAGE KEEPS THE GHOSTS FROM PUTTING ON A SHOW.', 'NIGHT WATCH: I CHECK EVERY GHOST LIGHT TWICE A NIGHT. ONCE FOR ME, ONCE FOR THEM.', 'NIGHT WATCH: THREE NIGHTS OF EVENING. THE GHOSTS WANT THE SHOW TO END. SO DO I.'] }]),
    'k': npc('fogstage.understudy', 'stagepuppet', [{ lines: ["UNDERSTUDY: I'M VILLAGER #3. I HAVE NO LINES YET.", "UNDERSTUDY: MY CARD SAYS: ENTER, LOOK WORRIED, EXIT. I'VE BEEN PRACTISING WORRIED.", "UNDERSTUDY: THE BANGS FOR THE FINALE ARE UNDER THE STAGE. I'M NOT ALLOWED NEAR THEM."] }]),
  },
}

/** UNDER THE STAGE: the trap room under Birger's stage, where act three was taken; a cable runs up to the air. */
export const UNDERSTAGE: MapDef = {
  id: 'understage',
  name: 'UNDER THE STAGE',
  kind: 'interior',
  track: 'indoor',
  cells: { '0,0': { dark: true } },
  rows: [
    '################',
    '#[[..oo.h..[[[.#',
    '#..............#',
    '#.t...n..n...t.#',
    '#..............#',
    '#..s......1....#',
    '#..............#',
    '#.oo.......nn..#',
    '#......@.......#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: '>', ent: { t: 'warp', to: 'fogstage', entry: 'trap' } },
    '1': { ent: { t: 'chest', id: 'understage.props', item: 'bombs5' } },
    s: { tile: 'S', ent: { t: 'sign', lines: ['(CHALK ON A BEAM: ACT THREE, UP THE CABLE AND OUT ON THE AIR. NO RETURNS.)'] } },
    // The way up behind the paint: the climb of Act Three (`actthree.ts`).
    h: { tile: '>', ent: { t: 'warp', to: 'actunder', entry: 'foot' } },
  },
  entries: { upstairs: { x: 8.5, y: 2.5, dir: 'down' } },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { fogstage: FOGSTAGE, understage: UNDERSTAGE }
