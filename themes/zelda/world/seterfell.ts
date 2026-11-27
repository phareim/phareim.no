/**
 * SETER FELL: the high summer pasture above the town and Whisper Woods (docs/worlds/atlas.md; its place on the
 * grid is world/atlas.ts). The fell road climbs from the woods gate through the birches to the BIG SETER, the
 * huts in their dry-stone ring where Sigrid comes home when the fjord's bell rings. West of the stream lie the
 * MOUNDS, where the tusse keep their pantry and the road goes on to Lumenby; east the TROLL HUMPS, sleeping trolls
 * with birches on their backs, and the pass down to the Sporelight; north CAIRN RIDGE, the tarn, the lookout and
 * the way over the tops to Yule Fjord. A second mound's stairs go down to THE ECHO BARROW (`echobarrow.ts`). The
 * LOWER PASTURE's hay fields, mill and pond run to the fell's edge over
 * the town. A heart piece waits on a ledge the seter can see and only the ridge can reach. The elder's mound has a
 * hole in its roof under a cracked boulder (UNDER THE FELL). The gorge east of the fell road is crossed by two hook posts, the herder's quick
 * way home from the humps.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`.
 */
import type { EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { gateHome } from './gates'
import { at, cycle, lantern, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })


/** A seter hut: grass roof, hearth at the door, smoke from the chimney; cover is its 3×3 of H. */
const hut = (x: number, y: number): IsoLandmark => prop('seter_hut', x + 1.5, y + 1.5, {
  night: 'seter_hut_night', cover: { x, y, w: 3, h: 3 }, motion: cycle(2, 2),
  lights: [light('amber', 2.6, 0.75, { z: 0.5, dy: 1.8 }), light('fire', 2.4, 0.45, { dx: -0.4, dy: -0.8, z: 2, anim: 'fire' })],
})
/** A troll asleep as a hill on the heather of a HUMP (9×7 at x, y), breathing slowly; solid where it lies. */
const troll = (x: number, y: number): IsoLandmark => prop('seter_troll_big', x + 4.4, y + 4.8, { ...at(x + 3, y + 3, 3, 2), motion: cycle(2, 0.3), shadow: { tall: 1.0, wide: 0.91, deep: 0.55 } })
/** A small one, asleep as a mound. */
const mound = (x: number, y: number): IsoLandmark => prop('seter_troll_small', x + 2.5, y + 1.75, { motion: cycle(2, 0.25), shadow: { tall: 0.66, wide: 0.64 } })
/** The dry-stone walls: a piece over each fence tile. */
const WALLS: Array<[number, number, string]> = [[26, 16, 'seter_fence_ew'], [27, 16, 'seter_fence_ew'], [28, 16, 'seter_fence_ew'], [29, 16, 'seter_fence_ew'], [32, 16, 'seter_fence_ew'], [33, 16, 'seter_fence_ew'], [34, 16, 'seter_fence_ew'], [35, 16, 'seter_fence_ew'], [36, 16, 'seter_fence_ew'], [37, 16, 'seter_fence_ew'], [38, 16, 'seter_fence_ew'], [39, 16, 'seter_fence_ew'], [40, 16, 'seter_fence_ew'], [41, 16, 'seter_fence_ew'], [42, 16, 'seter_fence_ew'], [43, 16, 'seter_fence_ew'], [44, 16, 'seter_fence_ew'], [45, 16, 'seter_fence_ew'], [46, 16, 'seter_fence_ew'], [47, 16, 'seter_fence_ew'], [48, 16, 'seter_fence_ew'], [48, 17, 'seter_fence_ns'], [48, 18, 'seter_fence_ns'], [26, 19, 'seter_fence_ns'], [48, 19, 'seter_fence_ns'], [26, 20, 'seter_fence_ns'], [48, 20, 'seter_fence_ns'], [26, 21, 'seter_fence_ns'], [48, 21, 'seter_fence_ns'], [26, 22, 'seter_fence_ns'], [26, 23, 'seter_fence_ns'], [26, 24, 'seter_fence_ns'], [26, 25, 'seter_fence_ns'], [48, 25, 'seter_fence_ns'], [26, 26, 'seter_fence_ns'], [48, 26, 'seter_fence_ns'], [26, 27, 'seter_fence_ns'], [48, 27, 'seter_fence_ns'], [26, 28, 'seter_fence_ns'], [48, 28, 'seter_fence_ns'], [26, 29, 'seter_fence_ns'], [48, 29, 'seter_fence_ns'], [26, 30, 'seter_fence_ns'], [48, 30, 'seter_fence_ns'], [26, 31, 'seter_fence_ew'], [27, 31, 'seter_fence_ew'], [28, 31, 'seter_fence_ew'], [29, 31, 'seter_fence_ew'], [30, 31, 'seter_fence_ew'], [31, 31, 'seter_fence_ew'], [32, 31, 'seter_fence_ew'], [33, 31, 'seter_fence_ew'], [34, 31, 'seter_fence_ew'], [35, 31, 'seter_fence_ew'], [39, 31, 'seter_fence_ew'], [40, 31, 'seter_fence_ew'], [41, 31, 'seter_fence_ew'], [42, 31, 'seter_fence_ew'], [43, 31, 'seter_fence_ew'], [44, 31, 'seter_fence_ew'], [45, 31, 'seter_fence_ew'], [46, 31, 'seter_fence_ew'], [47, 31, 'seter_fence_ew'], [48, 31, 'seter_fence_ew'], [3, 35, 'seter_fence_ew'], [4, 35, 'seter_fence_ew'], [5, 35, 'seter_fence_ew'], [6, 35, 'seter_fence_ew'], [7, 35, 'seter_fence_ew'], [8, 35, 'seter_fence_ew'], [9, 35, 'seter_fence_ew'], [10, 35, 'seter_fence_ew'], [11, 35, 'seter_fence_ew'], [12, 35, 'seter_fence_ew'], [3, 36, 'seter_fence_ns'], [12, 36, 'seter_fence_ns'], [3, 37, 'seter_fence_ns'], [3, 38, 'seter_fence_ns'], [12, 38, 'seter_fence_ns'], [3, 39, 'seter_fence_ns'], [12, 39, 'seter_fence_ns'], [3, 40, 'seter_fence_ew'], [4, 40, 'seter_fence_ew'], [5, 40, 'seter_fence_ew'], [6, 40, 'seter_fence_ew'], [7, 40, 'seter_fence_ew'], [8, 40, 'seter_fence_ew'], [9, 40, 'seter_fence_ew'], [10, 40, 'seter_fence_ew'], [11, 40, 'seter_fence_ew'], [12, 40, 'seter_fence_ew']]

export const SETERFELL: MapDef = {
  id: 'seterfell',
  name: 'SETER FELL',
  kind: 'overworld',
  track: 'forest',
  look: 'wild',
  realm: 'seterfell',
  kits: ['meadow'],
  views: ['iso', 'classic'],
  away: true,
  rows: [
    '######################,,,###############################################',
    'TT####################,,,#############################################TT',
    'TT.####.############..,,,####.##.########.########.##.###########.####TT',
    'TT.#..#....#;.#######.,,,..#.....######.;#######.;.....#############;.TT',
    'TT.....~~~~~~...###....,.N......#########..####........############...TT',
    'TT..;~~~~~~~~~....:;.;.,.;I...;..#######......:....;.:;.#########.....TT',
    'TT...~~~~~~~~~;.....:..,,,:;m.:I......:.:::..;...;.:;.....#####.......TT',
    'TT...;~~~~~~~~......;.....,,,,,,;.;;.;:;...:...,,:::::......;.........TT',
    'TT.....~~~~~~...;.9...;...;;.:,.,,,,,,,,,,,!,,,..::::::..............;TT',
    'TT....;...:.~~......:..:I..:.Q,..;.I..:.8..;;....::::....;T;.....;;...TT',
    'TT....;......~~......;..::..:.,........;:...:;..........;;;;;.........TT',
    'TT............~......:.:..:..;,...;;:.;.....:.......;..T;;;;;........;TT',
    'TT..:.:.6....;~~.....;....####,,#############.########..;;;;;......;..TT',
    'TT......:.;....~~;...;;...####,,#############.########...;;;......;...TT',
    'TT:.............~.....:......:............;#...#.............T..;;;;;.TT',
    'TT.T....:T......~T..T.......;.......;......#.1.#...T....:8..:.T;;***;;TT',
    ',,..L.....;T.;.~~......T:.FFFF,,FFFFFFFFFFFFFFFFF..:.........T.;**G**;TT',
    ',,,,,,,,,,,,,,,=,,,,,,,,,,,,,,,,..:.............F....:.T.;;.v..;;*,*;;TT',
    ',,.....T..;...~.....;.T.;.,...,,..HHH..HHH..HHH.F.T;:....:..:...;;,;;.TT',
    'TTT..;;;;;...~~...........F...,,..HHH..HHH..HHH.F..;...:........;...T.TT',
    'TT..;;###;;..~....;...;...F.:.,,:.HHH.hHHH:.HHH.F;......T......T...T..TT',
    'TT..;*#5#*;k.~.......T.TT.F...,,...a:...g.......F:........p...T...M..TTT',
    'TT..;;#R#;;.;~........T...F..:,,,,,,,,,,,,,,,::.,............,,,,,,,..,,',
    'TT...;;,;;...~~.....;.....F....:.....,......,,,,,,,,,,,,,,,,,.T...;.,,,,',
    'TTTT..:...;...~...;;;;;...F..........,...:d.....,...;.;...,...........,,',
    'TT..T;.....:..~~.;;***;;..F.HHH......,.:.....:..F...;..T..,......;;...TT',
    'TTT.T:.;....T..~.;**4**;..F.HHH:.....,....:.:...F...O...T.,.......T...TT',
    'TT....;;;;;.:..~~;;*,0;;.;F.HHH..r...,:....r....F;.OO;...,...;T;......TT',
    'TT...;;***;;T;..~.;;,;;...F.......j..,..........F..OOOT..,..;;;;;...TTTT',
    'TT...;**G**;.T..~....;...;F........::,.......r:.F...OO...,.T;;;;;...:.TT',
    'TT...;;*,*;;.:.~~..:....:;F:....:.:..,..........F...OOO..,..;;;;;.....TT',
    'TTT.:.;;,;;....~....;.....FFFFFFFFFF,,,FFFFFFFFFF...OOOT.,...;;;.7....TT',
    'TT...T..;T.....~.....................,.E.......;..:OOO..,..T..T.......TT',
    'TT..T6T.T......~;;................T..,;......T....OOO...,...#.2.#.....TT',
    'TT.;....;......~.......:.......:.;.:,,.;T.:...;T..OOO;..,...#...#T....TT',
    'TT.FFFFFFFFFF..~~...:::::.....:...,,.;,J...........OO..,...T##R##.....TT',
    'TT.F;;;;;;;;F..T~..:::::::......,,..;;.;,.;.T......OO;.,.;..;....T:...TT',
    'TT.F;;;;;;;;,,,,=,,,,,,,,,,,,,,,........,;y...T....OOO.,..............TT',
    'TT.F;;;;;;;;F...~~....,...;.............,..T...;...OO:,....;T;...;.T.;TT',
    'TT.F;;;;;;;;FT...~..s.,,..:...........T..,;TT....|,OO,|...;;;;;.......TT',
    'TT.FFFFFFFFFF....~.....;,,,.............;,...T.,,,,OO....T;;;;;..:....TT',
    'TT......:;...:.;.........HHH...;..T...;.;,..,,,...OOO..;..;;;;;;;;;;..TT',
    'TT................;.....THHH......TT......,,..T;..OOOO.....;;;;;***;;.TT',
    'TT....:..:;.;.:...:~~~.;.HHH.....:..........,;.....OOO........;**G**;.TT',
    'TT********......u~~~~~~~;........T.T......:T;,,....OOOO..T...T;;*,*;;TTT',
    'TT*......*.....;.~~~~~~~;..:..6.....T.:...T:;,,...;.OOO;.......;;,;;:.TT',
    'TT*..3...*.......~~~~~~~;....:...T..T........,,.....OO.......7...;....TT',
    'TT*......*..:......~~~...;.T;.........T....;;,,...TOOO.....T........;TTT',
    'TT********.....;............;...P.........;B.,,....OO......;..........TT',
    'TT;..........:....;..;...................:..,,,.;.;OOT...T..:.:..;T...TT',
    '############################################t,t#########################',
    '#############################################A##########################',
  ],
  areas: [
    { name: 'CAIRN RIDGE', x: 0, y: 0, w: 72, h: 14, entry: 'ridge' },
    { name: 'THE MOUNDS', x: 0, y: 14, w: 25, h: 20, entry: 'mounds' },
    { name: 'THE BIG SETER', x: 25, y: 14, w: 25, h: 20, entry: 'camp' },
    { name: 'TROLL HUMPS', x: 50, y: 14, w: 22, h: 38, entry: 'humps' },
    { name: 'LOWER PASTURE', x: 0, y: 34, w: 34, h: 18, entry: 'pasture' },
    { name: 'THE FELL ROAD', x: 34, y: 34, w: 16, h: 18, entry: 'gate-fell' },
  ],
  entries: {
    'gate-fell': { x: 45.5, y: 48.5, dir: 'up' },
    'camp': { x: 37.5, y: 28.5, dir: 'down' },
    'ridge': { x: 30.5, y: 10.5, dir: 'down' },
    'mounds': { x: 12.5, y: 17.5, dir: 'right' },
    'humps': { x: 56.5, y: 23.5, dir: 'right' },
    'pasture': { x: 22.5, y: 38.5, dir: 'down' },
    'fellcave': { x: 7.5, y: 23.5, dir: 'down' },
    'echobarrow': { x: 20.5, y: 27.5, dir: 'down' },
  },
  isoLandmarks: [
    // The realm's arch over the gate road, lit at night.
    prop('gate_seterfell_ns_off', 45.5, 47.5, { night: 'gate_seterfell_ns_on' }),
    // The Big Seter: Sigrid's hut, the byre, two more huts; the churns by the path.
    hut(34, 18), hut(44, 18), hut(28, 25),
    prop('seter_byre', 40.5, 19.5, { cover: { x: 39, y: 18, w: 3, h: 3 } }),
    prop('seter_churns', 33.5, 24.45, at(33, 24)),
    // The yard's fire where its paths meet, lit all the last week of summer, and two logs to sit on.
    prop('campfire', 40.5, 26.5, { motion: cycle(3, 5), light: { r: 2.4, tone: 'gold', a: 0.65 }, ...at(40, 26) }),
    prop('camp_log', 39.55, 26.95), prop('camp_log', 41.45, 27.1),
    // The hay barn in the Lower Pasture, the mill on its knoll, the haystacks.
    prop('seter_byre', 26.5, 42.5, { cover: { x: 25, y: 41, w: 3, h: 3 } }),
    prop('meadow_mill', 22.5, 35.5, { ...at(22, 35), motion: cycle(4, 2), shadow: { tall: 1.45, wide: 0.44 } }),
    prop('meadow_hay_large', 6.5, 37.5, at(6, 37)),
    prop('meadow_hay_medium', 9.5, 38.5, at(9, 38)),
    prop('meadow_hay_medium', 12.5, 42.5, at(12, 42)),
    prop('meadow_hay_small', 5.5, 42.5, at(5, 42)),
    // The varde on Cairn Ridge by the cairn keeper's sign: the fell's far landmark, seen from the Big Seter and the fell road.
    prop('seter_varde', 28.5, 11.5, at(28, 11)),
    // The lookout's waystone on Cairn Ridge.
    prop('meadow_waystone', 51.5, 8.5, { ...at(51, 8), light: { r: 1.6, tone: 'cyan', a: 0.5 } }),
    // The trolls asleep as hills, and the small ones as mounds (not the elder's: its door is the pantry's).
    troll(54, 8), troll(58, 26), troll(56, 37),
    mound(5, 27), mound(17, 24), mound(63, 14), mound(62, 41),
  lantern('gold', 44.5, 45.5),
  lantern('gold', 46.5, 43.5),
  lantern('gold', 42.5, 39.5),
  lantern('gold', 38.5, 33.5),
  lantern('cyan', 30.5, 15.5),
  lantern('cyan', 19.5, 18.5),
  lantern('cyan', 6.5, 18.5),
  lantern('violet', 52.5, 22.5),
  lantern('violet', 61.5, 21.5),
  lantern('violet', 67.5, 21.5),
  lantern('pink', 23.5, 7.5),
  lantern('pink', 33.5, 7.5),
  lantern('pink', 44.5, 7.5),
    ...WALLS.map(([x, y, art]) => prop(art, x + 0.5, y + 0.5, { cover: { x, y, w: 1, h: 1 } })),
  ],
  marks: {
    'A': gateHome('fell'),
    'B': sign('CLOSE THE GATE.\nTHE GOATS HAVE LEARNED THE LATCH.'),
    'E': sign('MILK. CHEESE. BUTTER.\nNOT FOR THE NISSE.'),
    'J': sign('↑ THE BIG SETER.\n← LOWER PASTURE.\n↓ WHISPER WOODS.'),
    'L': sign('← LUMENBY QUARRY.'),
    'M': sign('→ THE SPORELIGHT.'),
    'N': sign('↑ YULE FJORD, OVER THE TOPS.'),
    'P': sign('THE FELL\'S EDGE.\nBELOW: PHAREIM.NO.'),
    'Q': sign('ADD A STONE. TAKE NONE.'),
    'a': npc('q.bell.home', 'dairymaid', [{ lines: ['SIGRID: THE BELL RANG, AND THERE I WAS. HOME, WITH HAY IN MY HAIR.', "SIGRID: THE GOATS DIDN'T EVEN NOTICE I WAS GONE. HERE. FOR YOUR WALK."], give: 'bits50' }], { hide: { notFlag: 'q.bell.rung' } }),
    'd': npc('q.bell.tail', 'huldra', [{ when: { flags: ['item:prism'], not: ['seterfell.sun'] }, lines: ['SOLVEIG: THE SUN HAS MOVED. NOBODY TOLD ME IT COULD DO THAT.'], set: 'seterfell.sun' }, { when: { flag: 'q.bell.rung' }, lines: ['SOLVEIG: A BELL THAT RINGS! NOW I CAN BE WED UNDER IT.', '(SOMETHING SWISHES BEHIND HER SKIRT. NOBODY MENTIONS IT.)'] }, { lines: ['SOLVEIG: LOVELY EVENING. DON\'T LOOK DOWN.', 'SOLVEIG: I WANT TO BE WED UNDER A BELL THAT RINGS. THE ONE ON THE FJORD IS CRACKED.'] }]),
    'g': npc('seterfell.dairymaid', 'dairymaid', [{ lines: ['DAIRYMAID: THE CHURN HAS BEEN GOING SINCE MAY. I AM NOT SURE IT IS STILL BUTTER.'] }]),
    'h': npc('seterfell.nisse', 'troll', [{ lines: ['BARN NISSE: NO BUTTER. NO BUTTER! NOT A SCRAP OF BUTTER IN MY PORRIDGE.', 'BARN NISSE: SOMEONE WILL HEAR ABOUT THIS PORRIDGE. SOMEONE WITH COWS.'] }]),
    'j': npc('seterfell.goat', 'fellgoat', [{ lines: ['(THE GOAT EYES YOUR COAT.)', 'MAA.'] }], { wander: true }),
    'k': npc('seterfell.elder', 'owl', [{ when: { notFlag: 'item:weightMeaning' }, lines: ['MOUND ELDER: THE HALL UNDER US ANSWERS BACK. IT USED TO WAIT TO BE ASKED.', 'MOUND ELDER: SOMEBODY DUG INTO MY PANTRY, SO WE ROLLED A BOULDER OVER THE HOLE.'] }, { when: { item: 'weightMeaning' }, lines: ['MOUND ELDER: QUIET DOWN THERE NOW. I ASKED IT THE TIME. IT SAID NOTHING. LOVELY.'] }]),
    'm': npc('q.map.cairn', 'owl', [{ when: { flag: 'q.map.p3' }, lines: ['STEINAR: I WOULD GIVE YOU A STONE FOR THE ROAD. THEY ARE ALL SPOKEN FOR.'] }, { lines: ['STEINAR: I KEEP THE CAIRNS. A PAGE BLEW INTO THIS ONE. IT HAS DUNES ON IT.', 'STEINAR: WE HAVE NO DUNES UP HERE. TAKE IT.'], set: 'q.map.p3' }]),
    'p': npc('seterfell.herder', 'oldherder', [{ lines: ["OLD HERDER: DON'T WHISTLE NEAR THE HUMPS. THEY'RE ONLY HILLS IN THE DAYTIME.", 'OLD HERDER: TWO POSTS OVER THE GORGE. I NEVER LEARNED THE HOOK, SO I WALK ROUND.'] }]),
    's': npc('seterfell.ashlad', 'kid', [{ lines: ['ASH LAD: THAT HILL HAS A NOSE. I POKED IT. IT SNEEZED.', 'ASH LAD: MY BROTHERS SAY I\'M NO GOOD FOR ANYTHING. I\'M GOOD AT POCKETS.'] }], { wander: true }),
    'y': npc('seterfell.walker', 'keeper', [{ lines: ["WALKER: FORTY YEARS ON THESE PATHS. THE CAIRNS MOVE ABOUT. I DON'T ASK."] }]),
    'u': npc('seterfell.sitter', 'tree', [{ lines: ["SITTER: I'LL WALK ON. TOMORROW. PROBABLY."] }]),
    'v': npc('seterfell.goat2', 'fellgoat', [{ lines: ['(THE GOAT IS CHEWING SOMETHING. IT MAY ONCE HAVE BEEN A HAT.)'] }], { wander: true }),
    '1': { ent: { t: 'chest', id: 'seterfell.ledge', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'seterfell.nostril', item: 'bits50' } },
    '3': { ent: { t: 'chest', id: 'seterfell.hedge', item: 'bits20' } },
    '5': { ent: { t: 'warp', to: 'fellcave', entry: 'door' }, tile: '>' },
    // The way down into THE ECHO BARROW, in the little garden south of a small mound, and its sign.
    '4': { ent: { t: 'warp', to: 'echobarrow', entry: 'start' }, tile: '>' },
    '0': sign('THE ECHO BARROW.\nKNOCK, AND IT KNOCKS FIRST.'),
    '6': { ent: { t: 'enemy', kind: 'blob' } },
    '7': { ent: { t: 'enemy', kind: 'hound' } },
    '8': { ent: { t: 'enemy', kind: 'bat' } },
    '9': { ent: { t: 'enemy', kind: 'sentry' } },
    // A tough sentry on the spur to the heart-piece chute.
    '!': { tile: ',', ent: { t: 'enemy', kind: 'sentry', tough: true } },
  },
}

/** UNDER THE FELL: the tusse's pantry under the elder's mound, through the hole somebody dug in its roof (a cracked
 * boulder over it, outside); the pantry's chest is in the shelf corner behind the pots. */
export const FELLCAVE: MapDef = {
  id: 'fellcave',
  name: 'UNDER THE FELL',
  kind: 'interior',
  track: 'indoor',
  cells: { '0,0': { dark: true } },
  rows: [
    '################',
    '#[[[..oo..[[[o1#',
    '#............oo#',
    '#.o..t....t..o.#',
    '#......a.......#',
    '#..nn.....nn...#',
    '#..............#',
    '#..............#',
    '#..............#',
    '#......@.......#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'seterfell', entry: 'fellcave' } },
    '1': { ent: { t: 'chest', id: 'fellcave.pantry', item: 'bits50' } },
    a: npc('fellcave.tusse', 'kid', [{ lines: ['TUSSE: THE PANTRY IS SHUT FOR STOCKTAKING. THE CHEESE IS BEING COUNTED.', 'TUSSE: FIRST SOMEBODY DUG A HOLE IN THE ROOF. NOW SOMEBODY HAS BLOWN UP THE BOULDER.'] }]),
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { seterfell: SETERFELL, fellcave: FELLCAVE }
