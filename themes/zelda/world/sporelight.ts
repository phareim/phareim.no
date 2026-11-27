/**
 * THE SPORELIGHT: giant glowing fungus over clean white roots, north of the Night Market (docs/worlds/atlas.md; its
 * place on the grid is world/atlas.ts). From the market gate the road climbs under THE CAPS, past the clear stream
 * and its pool, to the crossroads; west the road from Seter Fell's Troll Humps comes in by THE CLINKER, the smelter
 * camp of the people the town turned away. In the middle THE STEAMHOUSE, the spirits' bathhouse, stands on its pond,
 * a gold block of light seen from everywhere; north over the ridge OLA'S WINDMILL keeps the haze down; north-east
 * the grazers doze in THE SHELLYARD; south-east THE CLEAN WELL's stair goes down to THE UNDER, where the silent
 * spirit keeps the clean seed, and the roots end at Stillsand's pass. South lies THE ROOT HOLLOW, a hollow among the
 * roots; a cracked root joins it to the gate road for anyone with bombs, and east of it the grazers drink at a pool
 * while the Clinker's slag hounds stalk them. A heart piece
 * sits on an island in the pond, seen from the walkway: the hook bites the island's post from the north shore (or the
 * bath island), and the post on the north shore brings the hero back.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`, the foes among them
 * (the slag hounds at the pool, the grazer pen in the Shellyard).
 */
import type { EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { gateHome } from './gates'
import { at, cap, cycle, lantern, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })


type Tone = 'teal' | 'violet'
/** A giant cap on its stalk (solid where the stalk stands), its glow under the cap: large, medium, small. */
const capL = (tone: Tone, x: number, y: number): IsoLandmark => prop(`sporelight_mushroom_large_${tone}`, x + 0.5, y + 0.6, { shadow: { tall: 1.6, wide: 0.72 }, lights: cap(tone === 'teal' ? 'teal' : 'lilac', 3.6, 1.4), ...at(x, y) })
const capM = (tone: Tone, x: number, y: number): IsoLandmark => prop(`sporelight_mushroom_medium_${tone}`, x + 0.5, y + 0.6, { shadow: { tall: 1, wide: 0.44 }, lights: cap(tone === 'teal' ? 'teal' : 'lilac', 3, 0.9), ...at(x, y) })
const capS = (tone: Tone, x: number, y: number): IsoLandmark => prop(`sporelight_mushroom_small_${tone}`, x + 0.5, y + 0.6, { lights: cap(tone === 'teal' ? 'teal' : 'lilac', 2.2, 0.55), ...at(x, y) })
/** Glowing moss on the floor, and a puff of spores (or the bath's steam) rising. */
const moss = (x: number, y: number): IsoLandmark => prop('sporelight_glow_moss', x, y, { lights: [light('teal', 1.5, 0.5, { z: 0.1 })] })
const puff = (x: number, y: number): IsoLandmark => prop('sporelight_puff', x, y, { motion: cycle(3, 2) })
/** A grazer dozing among the shells, eyes cyan (calm), solid where it stands. */
const grazer = (x: number, y: number): IsoLandmark => prop('sporelight_grazer_calm', x + 0.5, y + 0.45, { motion: cycle(2, 1), shadow: { tall: 0.8, wide: 0.46 }, ...at(x, y) })

export const SPORELIGHT: MapDef = {
  id: 'sporelight',
  name: 'THE SPORELIGHT',
  kind: 'overworld',
  track: 'lab',
  look: 'spore',
  realm: 'sporelight',
  kits: ['meadow'],
  views: ['iso', 'classic'],
  away: true,
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT',
    'TTTTT...TTTT...TTTT.T..;TTT.T.T.TTT.:..TT.T.TT..TT.TTTTTTTT..TT....T.TTTT.T..TTT',
    'TT..T....T.T..........TTTTT.T................:;..T.TTTTT;....TT.;..;....:....TTT',
    'TT.;;..T;......T......TTTTT.:...T...:..::.....;.T..TTTT.................9.....TT',
    'TTT:...............;..TTTTT;.:.;...::::H::::.T..:...TTT..r........0...r..;...TTT',
    'TT..r...............r............:::::::::::::.:...;............;.........T..TTT',
    'TT..........................:....::::::::k:::...;........;0.;........rrr......TT',
    'TTT.........---..s.........,,,,,,,,,,,,,,,,,,,,,.............;......rrrrr.....TT',
    'TTT..:....v-----....,,,,,,,,.::;..:::::,::::;..,,,,,,,,.....u...r.;.r.2.r....TTT',
    'TT..:.....-----,,,,,,....:....y...:T..:,.::.:..:..:...,,,,,.......;.rr.rr....TTT',
    'TT..:......e--,,a......;...#...##.#.##.,,.#..:##.:T.....;;,,,........r%r..r..TTT',
    'TT;.........--,..........:.############,,##########TT.......,,,...............TT',
    'TT...........,,..:....:...;############,,##########TT.......r.,.;.....;......TTT',
    'TT;....:....,,:........................,....:...TTTT....;.....,..;T.....0;...TTT',
    'TT...r......,........r...........;.....,;.....................,W...;T;.......TTT',
    'TTT.T.......,........T;................,...;..................,.........;..r..TT',
    'TT..r......:,U.....r..T....;.;.........,,,,,,,..;......T......,..............TTT',
    'TT.:..r.....,...Tr..;..;.........~~~~~~~~~~~~.|......;:....;.;,..;.;.........TTT',
    'TT;.T;..r...,.:.....TTTT.;;.....;~~~~~~~~~~~~...~~.......r....,....;........T.TT',
    'TT..........,..::..:TTTTT........~~~~~~~~~~~~~~~~~............,..............TTT',
    'TT..........,...r..TTTTTT;.....~~~~~:::::::~~~~~~~..T........,,....r.....r...TTT',
    ',,;;........,...;.....T........~~~~~::HHH::~~~~~~~...........,.........;......TT',
    ',,,,,,,,,,,,,.................~~~~~~::HHH::~~..1~~.........;.,........;;....T;TT',
    ',,..:...:...,E....T.......;...~~~~~~::H6H::~~.|.~~.;........,,............TTTTTT',
    'TTTT...T....,..;T.............~~~~~~:::8:d:~~~~~~~..........,.............TTTTTT',
    'TTTT.......;,..............;..~~~~~~::b,:::~~~~~~~......;..,,............TTTTTTT',
    'TT.T;.......,..m..........TT...~~~~~~~~=~~~~~~~~~~..;.;...,,...;...:......TTTTTT',
    'TTTT;.....;.,.................~~.~~~~~~=~~~~~~~..;....;N.,,...........;..:TTTTTT',
    'TTTT....;...,...;.........:...~...~~~~~=~~~~...........,,,.........T...;.;TTT.TT',
    'TT.T........,............p...~~....;...=.........;;.,,,,.,,.............;.....TT',
    'TTTT........,,,,,,,,,,,,,,,,==,...:::::,:::::..,,,,,,.....,,..........;.......TT',
    'TT.T........,......;.......~~;,,,,,,,,,,::,,,,,,...........,,........;........TT',
    'TTT.........,.........;.;.~~......:g:::,:::h:.......;.......,,....::.......;..TT',
    'TT..;.......,............~~.;.....:::K:,:::::;...............,,:::::::.......;TT',
    'TTT.........,...........~~.............,.;...................;,::...:::......TTT',
    'TT:.***.....,..........~~.T............,..........T.T.........,:..5..::..;....TT',
    'TT.**.**....,.....;...~~..TT....T.;.;..,.;.T..;.;...~~~.......,,..,...:.;.....TT',
    'TT.*.3.*....,........~~...TT....:......,.;T........~~~~~......:,,,,..::......TTT',
    'TT;**.**....,..;....~~....TT..;........,..;...;;..:~~~~~......:::.,.:::......;TT',
    'TT..***.....,.....~~~....;TT.;...TTTTT.,.TTTTT.:....~~~........:X:,:::;......TTT',
    'TTT....;...,,....~~~~~;...TT.....T.....,.....T;:;.................,..w....;..TTT',
    'TTT........,.....~~~~~...TTT.....T.;.........T..;:4.T;..........,,,..........TTT',
    'TT......;..,....z.~~~.....TT.....;..;..,.....T.:....4..........,,............;TT',
    'TT..;.....,,,,,,,,,,,,,,,,%%,,,,,,,,,,,7....;..:..;.........,,,,...........;.TTT',
    'TTT.;;....,...............TT.....;.;...,.,,,,,,.;:..........,.;.....;........TTT',
    'TTTT.....,,.....;...;.....TT;;T..T.....,..;...,,,,,,,,,,,,,,,................TTT',
    'TT.T.;..;,.B..............TT..:..T.;.........T......;..;..;,,...;.............TT',
    'TT.T.....,......;.........TTTTT..TTTTTTTTTTTTTTTTTTTT..;...,.....;.....TTTTT.TTT',
    'TTT.TT;.,,,.T.T:T..T.....TTTTTTTT;.....T..;..TTTTTTTT...T;,,,....TTT.TTTTTTTTTTT',
    'TTTTTTTTt,tTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,,TTTTTTTTTTTTTTTTTTT',
    'TTTTTTTTTATTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,,TTTTTTTTTTTTTTTTTTT',
  ],
  areas: [
    { name: 'THE CLINKER', x: 0, y: 0, w: 26, h: 26, entry: 'clinker' },
    { name: 'OLA\'S WINDMILL', x: 26, y: 0, w: 26, h: 15, entry: 'mill' },
    { name: 'THE SHELLYARD', x: 52, y: 0, w: 28, h: 26, entry: 'shellyard' },
    { name: 'THE STEAMHOUSE', x: 26, y: 15, w: 26, h: 21, entry: 'camp' },
    { name: 'THE CAPS', x: 0, y: 26, w: 26, h: 26, entry: 'gate-spore' },
    { name: 'THE ROOT HOLLOW', x: 26, y: 36, w: 26, h: 16, entry: 'from-arena' },
    { name: 'THE CLEAN WELL', x: 52, y: 26, w: 28, h: 26, entry: 'well' },
  ],
  entries: {
    'gate-spore': { x: 9.5, y: 49.5, dir: 'up' },
    'camp': { x: 39.5, y: 32.5, dir: 'down' },
    'clinker': { x: 12.5, y: 18.5, dir: 'up' },
    'mill': { x: 39.5, y: 9.5, dir: 'down' },
    'shellyard': { x: 62.5, y: 16.5, dir: 'up' },
    'well': { x: 66.5, y: 37.5, dir: 'down' },
  },
  isoLandmarks: [
    // The realm's arch over the gate road, lit at night.
    prop('gate_sporelight_ns_off', 9.5, 48.5, { night: 'gate_sporelight_ns_on' }),
    // The Steamhouse on its island, gold lanterns at its eaves; steam rising off the pond.
    prop('sporelight_bathhouse', 39.5, 23.3, { night: 'sporelight_bathhouse_night', cover: { x: 38, y: 22, w: 3, h: 3 }, shadow: { tall: 1.7, wide: 1.4, deep: 1.35 },
      lights: [light('gold', 2.5, 0.8, { dx: -1, dy: 2, z: 0.8, anim: 'fire' }), light('gold', 2.5, 0.8, { dx: 1, dy: 2, z: 0.8, anim: 'fire' }), light('gold', 6, 0.45, { z: 1.6 })] }),
    puff(36.6, 21.4), puff(42.4, 22.2), puff(33.5, 26.5),
    // Ola's windmill on its knoll, the cart and the hay.
    prop('meadow_mill', 39.5, 5.5, { motion: cycle(4, 2), cover: { x: 39, y: 5, w: 1, h: 1 }, shadow: { tall: 1.45, wide: 0.44 } }),
    prop('meadow_cart', 36.6, 6.3, at(36, 6)),
    prop('meadow_hay_large', 43.5, 5.5, at(43, 5)),
    prop('meadow_hay_small', 44.6, 7.4, at(44, 7)),
    // The Clinker: the smelting fire the dancers' bellows keep hot, the cook fire, the van, the tents.
    prop('bonfire', 13.5, 9.6, { motion: cycle(3, 6), lights: [light('fire', 3.4, 0.85, { z: 0.6, anim: 'fire' })], ...at(13, 9) }),
    prop('campfire', 7.5, 12.5, { motion: cycle(3, 6), lights: [light('fire', 2.2, 0.6, { z: 0.3, anim: 'fire' })] }),
    prop('camp_tripod', 7.5, 12.5),
    prop('camp_log', 6.9, 13.3), prop('camp_log', 8.2, 13.2),
    prop('van', 6, 8.5, at(5, 8, 2, 1)),
    prop('tent', 19.5, 13.5, at(19, 13)),
    prop('tent', 20.5, 7.5, at(20, 7)),
    prop('camp_shelter', 8.4, 16.4),
    prop('camp_board_gold', 15.4, 15.1),
    // One grazer dozing in the Shellyard (the live ones are marks: the pen).
    grazer(66, 18),
    // The well: glowing moss round its head, spores rising out of the clean air below.
    moss(63.6, 36.4), moss(69.4, 38.6), moss(64.5, 39.6), moss(68.3, 34.4), moss(65.2, 35.3), moss(67.8, 35.6), puff(66.5, 36.3),
    // The clickers' ring round the well's stair, so it reads from the road as a place and not a grate in the moss.
    capS('teal', 65, 34), capS('violet', 67, 34), capS('violet', 63, 35), capS('teal', 69, 35), capS('teal', 64, 36), capS('violet', 68, 36),
    // The grazers' pool east of the root hollow: three drinking, moss and spores at the water, a cap over it.
    grazer(49, 38), grazer(57, 39), grazer(54, 36),
    moss(50.5, 41.3), moss(56.4, 37.3), moss(48.6, 40.5), moss(55.6, 41.4), puff(53.5, 38.6),
    capM('violet', 48, 35),
    // Moss in the root hollow.
    moss(36.6, 44.6),
    // The Shellyard: the smelter's cart of shells, moss and spores among the grazers.
    prop('meadow_cart', 61.6, 8.3, at(61, 8)),
    moss(59.5, 11.5), moss(69.4, 14.6), moss(64.4, 7.6), moss(74.5, 20.4), puff(67.5, 12.5), puff(57.6, 17.4),
    // The Clinker's third tent by the road, the cart that brings the fungus wood.
    prop('tent', 6.5, 19.5, at(6, 19)),
    prop('meadow_cart', 16.6, 16.3, at(16, 16)),
    // Moss along the gate road under the caps.
    moss(5.5, 44.6), moss(14.4, 37.6), moss(3.8, 33.4), moss(18.6, 45.6),
    // The giant caps: over the gate road (the first thing past the arch), the clickers' line of small ones west of
    // the road pointing at the puffballs, the walkway's pair, the root hollow, the well's ring, the ridge, the yard.
    capL('violet', 6, 47),
    capL('teal', 12, 45),
    capM('teal', 7, 42),
    capL('violet', 14, 40),
    capL('teal', 9, 37),
    capM('violet', 15, 35),
    capL('violet', 8, 31),
    capM('teal', 16, 29),
    capL('teal', 4, 43),
    capM('violet', 21, 33),
    capL('teal', 19, 27),
    capM('teal', 10, 26),
    capS('teal', 10, 39),
    capS('teal', 9, 39),
    capS('violet', 8, 39),
    capM('teal', 35, 30),
    capM('violet', 44, 30),
    capL('violet', 35, 42),
    capL('teal', 43, 42),
    capM('teal', 37, 46),
    capM('violet', 41, 46),
    capM('teal', 29, 47),
    capM('violet', 48, 43),
    capM('teal', 60, 35),
    capM('violet', 71, 35),
    capL('teal', 59, 41),
    capL('violet', 72, 40),
    capL('violet', 55, 16),
    capM('teal', 76, 9),
    capL('teal', 29, 5),
    capM('violet', 48, 10),
    capS('violet', 22, 12),
    capS('teal', 4, 10),
    // Road lanterns: cyan and violet up the gate road, gold round the Steamhouse, rose at the Clinker, pink on the
    // ridge, violet and cyan on the way to the well and the pass, violet into the root hollow.
    lantern('cyan', 10.5, 48.5),
    lantern('violet', 9.5, 45.5),
    lantern('cyan', 12.5, 42.5),
    lantern('violet', 11.5, 35.5),
    lantern('cyan', 13.5, 33.5),
    lantern('gold', 33.5, 31.5),
    lantern('gold', 45.5, 33.5),
    lantern('gold', 38.5, 33.5),
    lantern('gold', 40.5, 31.5),
    lantern('rose', 11.5, 20.5),
    lantern('rose', 12.5, 13.5),
    lantern('pink', 33.5, 7.5),
    lantern('pink', 46.5, 9.5),
    lantern('violet', 56.5, 30.5),
    lantern('violet', 62.5, 24.5),
    lantern('cyan', 64.5, 37.5),
    lantern('cyan', 59.5, 44.5),
    lantern('cyan', 57.5, 47.5),
    lantern('violet', 38.5, 39.5),
    lantern('violet', 31.5, 43.5),
    lantern('gold', 5.5, 22.5),
  ],
  marks: {
    'A': gateHome('spore'),
    '5': { ent: { t: 'warp', to: 'sporeunder', entry: 'door' }, tile: '>' },
    // The Steamhouse's door, in the island building's south face, and the path tile before it where the way back lands.
    '6': { ent: { t: 'warp', to: 'steamhouse', entry: 'door' }, tile: 'D' },
    '8': { ent: { t: 'entry', id: 'steamhouse', dir: 'up' }, tile: ',' },
    '7': { ent: { t: 'entry', id: 'from-arena', dir: 'up' }, tile: ',' },
    'B': sign('NO FIRES.\nTHE CLINKER HAS BEEN TOLD.'),
    'E': sign('← SETER FELL.\n↑ THE CLINKER.\n↓ THE CAPS.'),
    'K': sign('THE STEAMHOUSE.\nNAMES KEPT AT THE DESK.\nNOT RETURNED.'),
    'N': sign('↑ THE SHELLYARD.\n↓ THE CLEAN WELL, STILLSAND.\n← THE STEAMHOUSE.'),
    'U': sign('VISITORS WELCOME.\nSPARKS ALSO.'),
    'W': sign('GRAZERS.\nCYAN EYES: CALM.\nPINK EYES: RUN.'),
    'X': sign('CLEAN BELOW.\nWIPE YOUR FEET.'),
    'a': npc('q.bell.forewoman', 'guard', [{ when: { flag: 'q.bell.cast' }, lines: ['RAGNA: RING IT GENTLY. AND TELL THEM UP NORTH WHO CAST IT.'] }, { when: { flag: 'q.bell.chrome' }, lines: ['RAGNA: CHROME, AND NOT ONE TREE FELLED. THERE. RECAST, AND STILL WARM.', 'RAGNA: ASLAK WILL WANT IT BEFORE IT COOLS. THE CHURCH ON THE FJORD.'], give: 'bits50', set: 'q.bell.cast' }, { when: { flag: 'q.bell.ore' }, lines: ['RAGNA: STILL NO CHROME. GUNN AT LUMENBY HAS A HILL OF IT.'] }, { when: { flag: 'q.bell.crack' }, lines: ["RAGNA: A BELL? I'LL POUR IT, BUT I WON'T BURN THE FOREST FOR IT.", 'RAGNA: I NEED CHROME. LUMENBY DIGS IT.'], set: 'q.bell.ore' }, { when: { flag: 'gateShut' }, lines: ['RAGNA: THE TOWN SAID NO TO US. THE FIRE SAID YES.', 'RAGNA: THE FIRE JUST CRACKLES NOW. I ASKED IT FOR A SIGN. IT CRACKLED. I TOOK THAT AS NO.'] }, { lines: ['RAGNA: THE TOWN SAID NO TO US. THE FIRE SAID YES.', 'RAGNA: THE FIRE TALKS WHEN THE SUN IS WRONG. IT SAID YES TO EVERYTHING. I STOPPED ASKING.'] }]),
    'e': npc('q.clinker.dancer', 'twirler', [{ lines: ['TRIXIE: AND LEFT, AND PUMP, AND SMILE!', 'TRIXIE: THE BELLOWS KEEP THE FIRE HOT. ALSO, GREAT FOR THE ARMS.'] }]),
    'v': npc('sporelight.dancer', 'twirler', [{ lines: ['BACKUP DANCER: FIVE, SIX, SEVEN, EIGHT. SORRY. I COUNT EVERYTHING NOW.'] }]),
    's': npc('sporelight.smelter', 'guard', [{ lines: ["SMELTER: I STOKE ON TRIXIE'S COUNT. WHEN SHE LOSES IT, THE IRON COMES OUT SOFT."] }]),
    'k': npc('q.seed.keeper', 'hippie', [{ when: { flag: 'q.seed.well' }, lines: ['OLA: BE POLITE. THE SPIRIT NOTICES FEET.'] }, { lines: ["OLA: WIND'S UP, SO THE HAZE STAYS LOW. IT'S THE WHOLE JOB. I AM VERY GOOD AT IT.", 'OLA: CLEAN SOIL? THE SPIRIT AT THE CLEAN WELL KEEPS SOME. SOUTH-EAST.'], set: 'q.seed.well' }]),
    'y': npc('sporelight.watcher', 'hippie', [{ lines: ["HAZE WATCHER: THE HAZE IS LOWER TODAY. OR I'M TALLER. HARD TO TELL."] }]),
    'b': npc('l.steam.clerk', 'vendor', [{ when: { item: 'weightNo' }, lines: ['MS. B: A GUEST LEFT BY THE FRONT DOOR. WE HAVE NO FORM FOR THAT.'] }, { when: { flag: 'steamhouse.visited' }, lines: ['MS. B: GO IN. EVERYONE IS SO HAPPY. NOBODY HAS COME OUT TO SAY SO.'] }, { lines: ['MS. B: WELCOME TO THE STEAMHOUSE. SIGN HERE.', 'MS. B: NO, SHORTER.', 'MS. B: SHORTER STILL. THERE. THAT IS YOUR NAME NOW.'] }]),
    'd': npc('l.steam.boiler', 'keeper', [{ lines: ['PUFFER: COAL\'S LATE AND THE PUFFS ARE ON BREAK. I DO THE BATHS, THE BOILER AND THE BOOKS.', 'PUFFER: IF YOU SEE A SPIRIT COVERED IN MUD, SEND IT IN. IT HAS NOT PAID.'] }]),
    'g': npc('sporelight.guest', 'keeper', [{ lines: ['BATH GUEST: THE STEAMHOUSE DESK CALLS ME G. I USED TO HAVE ELEVEN LETTERS.'] }]),
    'h': npc('sporelight.guest2', 'keeper', [{ lines: ['BATH GUEST: I CAME FOR ONE NIGHT. THE TOWELS ARE VERY PERSUASIVE.', 'BATH GUEST: SOMETHING GLINTS ON THE LITTLE ISLAND. THE OLD MOORING POSTS STILL HOLD.'] }]),
    'p': npc('sporelight.spirit2', 'ghost', [{ lines: ['(THE SPIRIT BOWS, MUCH TOO LOW. IT IS ON ITS WAY TO THE BATHS.)'] }], { wander: true }),
    'm': npc('sporelight.picker2', 'vendor', [{ lines: ['SPORE PICKER: I TOOK MY SHADOW TO THE BATHS. IT STAYED.'] }], { wander: true }),
    'z': npc('sporelight.spirit', 'ghost', [{ lines: ['(A TALL SPIRIT IN A PAPER MASK HOLDS OUT GOLD. IT SMELLS OF MUD.)'] }]),
    'u': npc('sporelight.smelter2', 'guard', [{ lines: ['SMELTER: I CUT A STALK AT DAWN. BACK BY LUNCH, TALLER. I STOPPED TAKING IT PERSONALLY.'] }]),
    'w': npc('sporelight.watcher2', 'hippie', [{ lines: ['HAZE WATCHER: THE FUNGUS DRANK THE POISON. I THANK IT EVERY MORNING. NO REPLY YET.'] }]),
    // The Clinker's slag hounds at the grazers' pool, on the road to the Clean Well.
    '4': { ent: { t: 'enemy', kind: 'hound' } },
    // The grazer pen in the Shellyard (sentries in a grazer's skin, `render/renderer.ts`): three calm ones that only
    // patrol until struck, and the pink one by the shells, a tough one.
    '0': { ent: { t: 'enemy', kind: 'sentry', calm: true } },
    '9': { ent: { t: 'enemy', kind: 'sentry', tough: true } },
    '1': { ent: { t: 'chest', id: 'sporelight.pond', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'sporelight.shells', item: 'bits50' } },
    '3': { ent: { t: 'chest', id: 'sporelight.puffballs', item: 'bombs5' } },
  },
}

/**
 * THE UNDER: under the clean well's stair, below the roots, where the fungus drank the poison out of the soil: white
 * sand, stone trees, clean pools. The silent spirit keeps the one seed that is not fungus at all.
 */
export const SPOREUNDER: MapDef = {
  id: 'sporeunder',
  name: 'THE UNDER',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '################',
    '#--~~~--I------#',
    '#-~~~~~-----I--#',
    '#--~~~~-a------#',
    '#-I------------#',
    '#------I-----I-#',
    '#--1-----------#',
    '#------..---I--#',
    '#--I---.@------#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'sporelight', entry: 'well' } },
    '1': { ent: { t: 'chest', id: 'sporeunder.sand', item: 'bits50' } },
    a: { tile: '-', ...npc('q.seed.spirit', 'ghost', [
      { when: { flag: 'q.seed.got' }, lines: ['(THE SPIRIT LOOKS AT YOUR FEET. THEN AT YOU. YOU WIPE THEM AGAIN.)'] },
      { lines: ['(THE SPIRIT HOLDS OUT A SEED. IT IS NOT FUNGUS AT ALL. IT SMELLS OF CLEAN SAND.)'], set: 'q.seed.got' },
    ]) },
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { sporelight: SPORELIGHT, sporeunder: SPOREUNDER }
