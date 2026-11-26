/**
 * STILLSAND: a pastel desert held just after sunrise, behind the Hollow Graves' east wall (docs/worlds/atlas.md; its
 * place on the grid is world/atlas.ts). From the graves gate THE BONE ROAD runs east under THE RIBS, the arched bones
 * of a stone bird (the stone birds nest south of them, a ring of stones round an egg), to THE GOLD PYRAMID, the stepped
 * gold mass in the middle of the sands, whose door goes down to THE PUZZLE LAB. North the road climbs past ARNE'S
 * SURVEY CAMP to the Sporelight's roots; east of it the QUARTZ ISLANDS hang over the dunes, and a garden that fell sits
 * upright in its crater with a heart piece in it, seen from the road and reached only from stake to stake. East of the
 * pyramid THE CARAVAN camps round its oasis; north-east THE TENDER'S BED waits under its lens for a clean seed, beside
 * FIRST LIGHT, where the sunstone's beam wants to reach a stone eye. South-west lie THE SCALES, a sunken court of three
 * pans, whose cracked west wall opens straight back to the Bone Road; south-east THE SALT FLAT, the hermit's pools and
 * THE MAKER'S BOX, a hollow butte. South the dunes fall to Rerun's lawns.
 *
 * Laid out with a script once (tmp), then edited by hand; marker chars are listed in `marks`.
 */
import type { AreaIntro, EntDef, IsoLandmark, MapDef, Mark, TalkBranch } from '../types'
import { gateHome } from './gates'
import { at, cycle, lantern, light, prop } from './scenery'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): Mark => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (text: string): Mark => ({ tile: 'S', ent: { t: 'sign', lines: [text] } })

/** Stillsand's first-visit words, in whichever area the hero arrives (the gate, a pass): once. */
const INTRO: AreaIntro = { lines: ['SO QUIET THAT A FOOTSTEP CARRIES FOR MILES. STONE ISLANDS HANG OVER THE DUNES.'], who: null, flag: 'realm:stillsand' }

type Size = 'small' | 'medium' | 'large'
const SHADOW: Record<Size, IsoLandmark['shadow']> = { small: { tall: 0.6, wide: 0.5, deep: 0.45 }, medium: { tall: 0.8, wide: 0.72, deep: 0.59 }, large: { tall: 0.9, wide: 0.9, deep: 0.7 } }
/** A quartz island hanging over the sand, held up by the gold hum-quartz in its roots; solid where its shadow falls. */
const island = (size: Size, x: number, y: number, w = 1): IsoLandmark =>
  prop(`stillsand_island_${size}`, x + w / 2, y + 0.6, { shadow: SHADOW[size], lights: [light('gold', 1.6, 0.5, { z: 1.2, anim: 'pulse' })], ...at(x, y, w, 1) })

export const STILLSAND: MapDef = {
  id: 'stillsand',
  name: 'STILLSAND',
  kind: 'overworld',
  track: 'beach',
  look: 'dune',
  realm: 'stillsand',
  views: ['iso'],
  away: true,
  rows: [
    '##########################,,,###########################################################',
    '#-###-#-##-#-##---#--####-,,,#-###########-#-#---#--##---##########-##-#-###############',
    '######------.--------------,---#OO#####OO#----------7-------#####---------#.U.......E.##',
    '######--------.---r.......-,N--OOO:*T;:OOO------------------9.-::::::::::-#...........##',
    '#-####----7.......-.......-,-.-OO*::1::;OO--------------8......:........:-#...4.......##',
    '##---------.......-.......V,-.-OOO::|::OOO--------...----......:.....d..:-#...........##',
    '##-.--------......-....nn.-,---OOOO:.:OOOO-....--.....----.....:........:-#.μ...b...ν.##',
    '#--------.---.-----....a..-,----OOOOOOOOO---...-h--------------::::,:::::-#...........##',
    '#-------rI-I-I-----.......-,-----OOOOOOO-k------------....---,,,,,,,!-,,--#####,,#######',
    '##-----I.......I.------.---,-----,,,,,,,,,,,,,,,,,,,,,,,,,,,,,-.----,,,,,,,,,,,,-----.##',
    '##---r-r....2....I--|-|-|--,,,,,,,.-|--#############-------.--.---------,,,---v---..--##',
    '#-------.........----------,--r-----.--#############-------------Tr---.---,---r--.----##',
    'A,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,---##HHHHHHHHH##----------;;;;;;;-r---,--.--.----###',
    '#----B--.........r--------J--------,---##HHHHHHHHH##--------T;;~~~~~;;T-.-,,--------r###',
    '##--r---.........I--------r.......-,.--##HHHHHHHHH##--------;;~~~~~~~;;----,-------.-###',
    '#-----rI.......I.---------.........,---##HHHH5HHHH##-------.;;;~~~~~;;--T-,,--.------###',
    '##-------I-I,I--------------......-,---######,######---------T;;;;;;;T----,.---------###',
    '#-----------,----------------.--r.-,---######,######-----y................,----.-----###',
    '##----------,------.#############.-,..I...W..,......I.---,,,,p,,,,,,,,,,,,,---.------###',
    '#--------...,,------#t....3....t#--,,,,,,,,,,,,,,,,,,,,,,,........,g.....--##---.-----##',
    '#-----.......,,9----#..Q.....Q..#.---....j...,........---.........,......-s##-------.--#',
    '##---..rrr....,-----#...........#----........,........--..........,......---r---------##',
    '##----.r@r....,,,---#...I...I...#-r----------,----.--0------------,,-----------###-r9-##',
    '#----..rrr......,,--#...........#e--.-------.,-----.-.---------.-.-,....m...-#######--##',
    '###---.........-.,,,R....b.b.....,,,,,,,,,,,,,,-----..-------...?..,,........#######---#',
    '####----..----.-----#...........#-------.-----,--..rIr-----.........,,,,.....#######---#',
    '####---8------------#.....Q.....#--r----------,,-..*+*..---.~αuα.......,,,,,,..#6#-----#',
    '#####----.----------#...........#--------------,-z.***..--α~~~ααααα.........,,,,,&.----#',
    '####---.------------#r.........r#-------0---.--,---.-.--7-ααααααααα.............-------#',
    '####----------.-.-###############--###------.-,,,---------8--ααα........~~~~.----.######',
    '#########----##-#############-##########-#---#,,,#-#--#-##----#####-#-###-###---#-######',
    '##############################################,,,#######################################',
  ],
  areas: [
    { name: 'THE BONE ROAD', x: 0, y: 0, w: 19, h: 32, entry: 'gate-sand', intro: INTRO },
    { name: 'ARNE\'S SURVEY CAMP', x: 19, y: 0, w: 14, h: 14, entry: 'survey', intro: INTRO },
    { name: 'THE SCALES', x: 19, y: 14, w: 14, h: 18, entry: 'scales', intro: INTRO },
    { name: 'QUARTZ ISLANDS', x: 33, y: 0, w: 24, h: 10, entry: 'islands', intro: INTRO },
    { name: 'THE GOLD PYRAMID', x: 33, y: 10, w: 24, h: 22, entry: 'camp', intro: INTRO },
    { name: 'THE TENDER\'S BED', x: 57, y: 0, w: 31, h: 11, entry: 'bed', intro: INTRO },
    { name: 'THE CARAVAN', x: 57, y: 11, w: 31, h: 11, entry: 'caravan', intro: INTRO },
    { name: 'THE SALT FLAT', x: 57, y: 22, w: 31, h: 10, entry: 'saltflat', intro: INTRO },
  ],
  entries: {
    'gate-sand': { x: 2.5, y: 12.5, dir: 'right' },
    'camp': { x: 45.5, y: 19.5, dir: 'down' },
    'from-puzzlelab': { x: 45.5, y: 17.5, dir: 'down' },
    'survey': { x: 27.5, y: 7.5, dir: 'down' },
    'islands': { x: 46.5, y: 9.5, dir: 'up' },
    'caravan': { x: 62.5, y: 18.5, dir: 'right' },
    'bed': { x: 67.5, y: 9.5, dir: 'up' },
    'scales': { x: 34.5, y: 24.5, dir: 'left' },
    'saltflat': { x: 68.5, y: 25.5, dir: 'right' },
    'box': { x: 80.5, y: 27.5, dir: 'down' },
  },
  isoLandmarks: [
    // THE GOLD PYRAMID over the 9×4 H block at (41, 12) on its stone terrace (#, x 39..51, y 10..17), the ground under
    // its middle at (45.5, 14); its drawn doorway sits over the door tile (5, the Puzzle Lab) at (45, 15), the quartz
    // at its apex catching the light.
    prop('stillsand_pyramid', 45.5, 14, { cover: { x: 41, y: 12, w: 9, h: 4 }, lights: [light('gold', 2.4, 0.45, { z: 6, anim: 'pulse' })] }),
    // The realm's arch over the gate road, lit at night.
    prop('gate_stillsand_ew_off', 3.5, 12.5, { night: 'gate_stillsand_ew_on' }),
    // The quartz islands over the dunes, and the one that fell: it sits on its rock at the back of its crater.
    island('large', 50, 3, 2), island('medium', 45, 4), island('small', 55, 6),
    island('small', 14, 4), island('medium', 70, 28), island('small', 27, 15),
    prop('stillsand_island_lowered', 36.5, 2.6, { shadow: SHADOW.medium }),
    // Arne's camp: his tent, the theodolite on its tripod, the map board.
    prop('tent', 21.0, 4.5, at(20, 4, 2, 1)),
    prop('camp_tripod', 21.5, 7.5),
    prop('camp_board_gold', 24.5, 3.6),
    prop('camp_fire', 20.5, 6.5, { motion: cycle(4, 5), light: { r: 2.2, tone: 'gold', a: 0.6 } }),
    prop('camp_log', 20.1, 7.2), prop('camp_log', 21.1, 7.3),
    // The caravan round the oasis: three tents and the cook's fire.
    prop('tent', 59.0, 20.5, at(58, 20, 2, 1)),
    prop('tent', 63.0, 21.0, at(62, 21, 2, 1)),
    prop('tent', 71.0, 21.0, at(70, 21, 2, 1)),
    // The cook's fire stands on the sand beside the path south, so the way to the salt flat stays clear.
    prop('campfire', 68.5, 20.5, { motion: cycle(3, 5), lights: [light('fire', 2.4, 0.6, { z: 0.3, anim: 'fire' })], ...at(68, 20) }),
    prop('camp_log', 67.6, 21.3), prop('camp_log', 69.4, 20.4),
    // The Tender's lens over its bed: dark until the clean seed is planted, then a gold pulse.
    prop('stillsand_lens_0', 67.5, 3.6, { lit: { flag: 'q.seed.planted', art: 'stillsand_lens_1' }, lights: [light('gold', 3, 0.85, { z: 1, anim: 'pulse', lit: true })], ...at(67, 3) }),
    lantern('gold', 44.5, 18.5),
    lantern('gold', 46.5, 18.5),
    lantern('gold', 44.5, 22.5),
    lantern('gold', 47.5, 24.5),
    lantern('gold', 49.5, 29.5),
    lantern('rose', 6.5, 11.5),
    lantern('rose', 20.5, 11.5),
    lantern('rose', 30.5, 13.5),
    lantern('cyan', 59.5, 17.5),
    lantern('cyan', 70.5, 19.5),
    lantern('cyan', 73.5, 11.5),
    lantern('violet', 28.5, 6.5),
    lantern('violet', 26.5, 2.5),
    lantern('violet', 42.5, 8.5),
    lantern('violet', 56.5, 10.5),
    lantern('pink', 37.5, 25.5),
    lantern('pink', 72.5, 25.5),
    lantern('pink', 78.5, 28.5),
  ],
  marks: {
    'A': gateHome('sand'),
    '5': { ent: { t: 'warp', to: 'puzzlelab', entry: 'start' }, tile: 'D' },
    '6': { ent: { t: 'warp', to: 'makersbox', entry: 'door' }, tile: '>' },
    'B': sign('STILLSAND. SHH.\nFOOTSTEPS CARRY HERE.\nWALK LIKE A GUEST.'),
    'J': sign('↑ THE SPORELIGHT.\n→ THE GOLD PYRAMID.\n← THE HOLLOW GRAVES.'),
    'N': sign('↑ THE SPORELIGHT.\n↓ THE BONE ROAD.'),
    'V': sign('ARNE\'S SURVEY CAMP.\nKEEP OFF THE LINES.'),
    'W': sign('THE GOLD PYRAMID.\nTHE DOOR HUMS.\nTHE PUZZLE LAB INSIDE.'),
    'e': sign('THE SCALES. THREE PANS,\nTWO WEIGHTS AND ONE GUEST.\nA GUEST ALONE IS TOO LIGHT.'),
    'v': sign('FIRST LIGHT. THE SUNSTONE\nSHINES ALL DAY. THE STONE\nEYE HAS NEVER SEEN IT.'),
    'y': sign('THE CARAVAN. RATION BRICKS,\nSALT, GLASS AND QUIET.'),
    'z': sign('↓ RERUN ESTATES.\n↑ THE GOLD PYRAMID.\n← THE SCALES.'),
    'E': { ent: { t: 'emitter', dir: 'down' }, tile: 'β' },
    'U': { ent: { t: 'receiver', flag: 'stillsand.firstlight' }, tile: 'ρ' },
    'Q': { ent: { t: 'plate', id: 'stillsand.scale' }, tile: 'σ' },
    '&': sign('THE MAKER\'S BOX.\nNEW FLOOR TODAY.\nMIND THE PAINT.'),
    '!': sign('THE TENDER\'S BED.\nPLEASE DO NOT STAND\nIN THE BED.'),
    '?': sign('THE SALT FLAT.\nDO NOT FEED THE REFLECTIONS.'),
    'a': npc('q.map.surveyor', 'smoker', [{ when: { flags: ['q.map.p1', 'q.map.p2', 'q.map.p3', 'q.map.p4'], not: ['q.map.done'] }, lines: ['ARNE: ALL FOUR PAGES. THE MAP IS WHOLE, AND IT IS RIGHT.', 'ARNE: FOR NOW. THE WIND TURNS IN THREE MINUTES. TAKE THIS BEFORE IT DOES.'], give: 'heartPiece', set: 'q.map.done' }, { when: { flag: 'q.map.done' }, lines: ['ARNE: MY MAP IS RIGHT. I DARE NOT LOOK UP.'] }, { when: { flag: 'q.map.asked' }, lines: ['ARNE: ONE PAGE WENT FAR WEST, TO FOGSTAGE. ONE NORTH-WEST, TO SETER FELL.', 'ARNE: ONE SOUTH, TO RERUN ESTATES. ONE WEST, TO THE FERRY ON THE TOWN\'S PIER.'] }, { lines: ['ARNE: I SURVEY THE DUNES. MY MAP WAS RIGHT. THEN THE WIND TURNED AND TOOK FOUR PAGES.', 'ARNE: ONE WEST, TO THE FERRY ON THE TOWN\'S PIER. ONE FAR WEST, TO FOGSTAGE.', 'ARNE: ONE NORTH-WEST, TO SETER FELL. ONE SOUTH, TO RERUN ESTATES. HERE, FOR YOUR BOOTS.'], give: 'bits20', set: 'q.map.asked' }]),
    'd': npc('q.seed.bed', 'gardenbot', [{ when: { flag: 'q.seed.planted' }, lines: ['BED TENDER: GROWING. YOU ARE STILL NOT A FLOWER. THAT IS ALL RIGHT.'] }, { when: { flag: 'q.seed.got' }, lines: ['BED TENDER: A CLEAN SEED. PLANTING.', '(A SHOOT. THEN A LEAF. THE TENDER HUMS.)', 'BED TENDER: TELL MY PARTNER AT THE CROSSROADS, WEST. IT CAN STOP WATERING.'], give: 'heartPiece', set: 'q.seed.planted' }, { lines: ['BED TENDER: SCANNING. YOU ARE NOT A FLOWER.', 'BED TENDER: THIS BED IS EMPTY. IT WANTS A SEED FROM CLEAN SOIL. NONE GROWS OUT HERE.'] }]),
    'g': npc('l.caravan.cook', 'vendor', [{ lines: ['ABEL: I COOK FOR THE CARAVAN. THE OASIS PALMS DROP REAL FRUIT. IS IT SAFE TO BITE?', 'ABEL: WE EAT RATION BRICKS. WE HAVE NEVER CHEWED ANYTHING. WE ARE NOT SURE HOW.'] }]),
    'h': npc('stillsand.quiet', 'ghost', [{ lines: ['(SHE HOLDS UP A PAINTED STONE: AN ARROW, POINTING SOUTH TO THE GOLD PYRAMID.)', '(THEN SHE PUTS A FINGER TO HER LIPS. THE DUNES ARE LISTENING.)'] }], { wander: true }),
    'm': npc('stillsand.quiet2', 'ghost', [{ lines: ['(HE HOLDS UP A STONE: A STAR. THEN A SHRUG.)', '(HE TURNS THE STONE OVER. ON THE BACK, A BOX WITH A DOOR.)'] }], { wander: true }),
    'k': npc('stillsand.gardenunit', 'gardenbot', [{ lines: ['GARDEN UNIT: MY ISLAND FELL. I KEPT WATERING THE SPOT. IT SEEMED POLITE.', 'GARDEN UNIT: THE SURVEYOR LEFT A STAKE ON EACH SIDE OF THE CRACK. I WATER THOSE TOO.'] }]),
    'p': npc('stillsand.caravanner', 'vendor', [{ lines: ['CARAVANNER: WE RIDE THE STONE BIRDS ACROSS. THEY DON\'T TALK. NEITHER DO WE, MOSTLY.', 'CARAVANNER: SALT, GLASS AND QUIET. THAT\'S ALL STILLSAND SELLS.'] }]),
    's': npc('stillsand.roostkid', 'kid', [{ lines: ['ROOST KID: THE BIRDS ARE STONE. DON\'T TELL THEM.', 'ROOST KID: I KNOW EVERY STONE BIRD BY NAME. THAT ONE IS GRAVEL. SO IS THAT ONE.', 'ROOST KID: THEY NEST FAR WEST, SOUTH OF THE RIBS. THE EGG IS NOT STONE. I CHECKED.'] }]),
    'u': npc('stillsand.hermit', 'smoker', [{ lines: ['SALT HERMIT: SHH. OH. IT\'S ONLY YOU. I THOUGHT YOU WERE THE WIND.', 'SALT HERMIT: I TALK TO MY REFLECTION IN THE SALT. IT AGREES WITH EVERYTHING. GOOD COMPANY.'] }]),
    'j': npc('stillsand.tourist', 'hippie', [{ lines: ['TOURIST: I CAME THROUGH THE GRAVES FOR AN AFTERNOON. THE SUN HASN\'T MOVED SINCE.', 'TOURIST: A GOLD PYRAMID, AND NOT ONE GIFT SHOP. FIVE STARS FOR THE VIEW, THOUGH.'] }]),
    '1': { ent: { t: 'chest', id: 'stillsand.garden', item: 'heartPiece' } },
    '2': { ent: { t: 'chest', id: 'stillsand.ribs', item: 'bits20' } },
    '3': { ent: { t: 'chest', id: 'stillsand.scales', item: 'bits50', appear: { plates: ['stillsand.scale'] } } },
    // A Warden, half-buried to the shoulders, still waiting for a beam; something glints in the dry shrub at its feet.
    '+': { ent: { t: 'chest', id: 'stillsand.warden', item: 'bits20' } },
    // The stone birds' nest south of the Ribs: a ring of stones round an egg that is not stone. Lift one to reach it.
    '@': { ent: { t: 'chest', id: 'stillsand.nest', item: 'bits20' } },
    '4': { ent: { t: 'chest', id: 'stillsand.firstlight', item: 'bombs5', appear: { flag: 'stillsand.firstlight' } } },
    '7': { ent: { t: 'enemy', kind: 'dasher' } },
    '8': { ent: { t: 'enemy', kind: 'blob' } },
    '9': { ent: { t: 'enemy', kind: 'drone' } },
    '0': { ent: { t: 'enemy', kind: 'sentry' } },
  },
}

/** THE MAKER'S BOX: the hollow butte on the salt flat. Its maker is a slow star overhead; the floor is new today. */
export const MAKERSBOX: MapDef = {
  id: 'makersbox',
  name: 'THE MAKER\'S BOX',
  kind: 'interior',
  track: 'indoor',
  rows: [
    '################',
    '#[[..oos.oo..[[#',
    '#..............#',
    '#.t..nnnn....t.#',
    '#........a.....#',
    '#..o........o..#',
    '#......1.......#',
    '#..............#',
    '#..............#',
    '#......@.......#',
    '#######D########',
  ],
  marks: {
    '@': { ent: { t: 'entry', id: 'door', dir: 'up' } },
    D: { tile: 'D', ent: { t: 'warp', to: 'stillsand', entry: 'box' } },
    '1': { ent: { t: 'chest', id: 'makersbox.paint', item: 'bits50' } },
    a: { tile: 'S', ent: { t: 'sign', lines: ['NEW FLOOR TODAY. MIND THE PAINT.\n- THE MAKER'] } },
    s: { tile: 'S', ent: { t: 'sign', lines: ['(A NOTE, PINNED TO THE WALL: TOMORROW, STAIRS. MAYBE.)'] } },
  },
}

/** This land's maps by id (`lands.ts` collects them into the world). */
export const MAPS: Record<string, MapDef> = { stillsand: STILLSAND, makersbox: MAKERSBOX }
