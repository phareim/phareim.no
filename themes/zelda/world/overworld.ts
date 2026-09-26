/**
 * The overworld: one 104×48 map the camera scrolls over freely. The town
 * (PHAREIM.NO, phareim.no's front door) fills the west 40 columns: Petter's
 * house with his name on the roof, the arcade, the fountain, the coast with
 * the PHAREIM.MD newsstand, the radio station and the pier. The coast road
 * runs east along the water into Home Glade and round to the Keeper's hut,
 * where the quest begins.
 * East of that the old Neon Coast: Whisper Woods (NW), Night Market (N),
 * Hollow Graves (NE, the Shrine's door), Home Glade (SW), the Crossroads and
 * Mirror Lake (SE).
 *
 * The start stands just below Petter's door, so the name and two buildings
 * are in view on a phone (≈15×28 tiles) and on a desktop (≈18×11).
 * tests/portal-world.test.mjs checks both. The town has no enemies.
 * Tile legend: types.ts. Marker chars are listed in `marks` below.
 */
import type { MapDef } from '../types'
import { INTRO } from './intro'

/** The town is the first 40 columns; everything east of it is the old overworld, shifted by this much. */
export const TOWN_W = 40

export const OVERWORLD: MapDef = {
  id: 'overworld',
  name: 'THE NEON COAST',
  kind: 'overworld',
  track: 'overworld',
  rows: [
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT####################################',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT#T:..................:T######II#####',
    'TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT:..;;:TTTTTTTTTTTTTT.:.TT#..HHHHHHH.....:..:....#####IVVI####',
    'TTTTTTTTTTTTTHHHHHHHHHHHHHHHTTTTTTTTTTTTTT..:....TTTTTTTTTTTTTT.5.TT#..HHHHHHH.....nn.nn...#####IW.I####',
    'TTTT....:.T..HHHHHHHHHHHHHHH..T..:..TTTTTT:..4...:.....;;..TTTT...TT#t.HHHMHHH..t........t.######RR#####',
    'TTT..::......HHHHHHHHHHHHHHH...:.....TTTTT..:...:.TTTTT;;;..TTTTRTTT#..HHHBHHH......:N.....##T:..X"..:T#',
    'TT.......:.t.HHHHHHHHHHHHHHH.t....:...TTTTT:..a..TTTTTTT;;..TTTT.TTT#.....E....:...........##.G..G..G..#',
    'TT..:..:.....HHHHHHHpHHHHHHH....:..:..TTTTTT....TTT;;TTTT...TTT;.;TT#.t,,,,,,,,,,,,,,,,,,t.##.....z....#',
    'TTTT........,,,,,,,,@,,,,,,,,.......TTTTTTTTT..TTT;;;;TT..a..TT...TT#..,:,,,,,,,,,,,,,,:,..##.G..G..G.g#',
    'TTT..........::,,,,,,,,,,,::.........TTTTTTT...TTTT;;TTT.....TT.;.TT#..,,,,,t~~~~t,,,,,,,..##..........#',
    'TT..HHHHHHHHH:,,,,,,,,,,,,,:.T...:..T.TTTTT;..;..TTTTTTT..d.....;......,,,,,,~~~~,,,,y,,,..##.G..G..G..#',
    'TT..HHHHHHHHH,,,,,t~~~~t,,,t..:...T...TTTTT;;...;TTTTTTTT.......;......,,,,,,~~~~,,,,,,,,..##:....z....#',
    'TT..HHHHHHHHH,,,,,,~~~~,,,,,T.....t.:.TTTTTT;...;;TTTTTTTTTTT;;TTTTT#..,,,,,t~~~~t,,,,,,,..............#',
    'TT.tHHHHHHHHHt,,8,,~~~~,,,,,.:...T....TTTTTTT..;;;;TTTTTTTTT;;;;TTTT#..,:,,,,,,,,,,,,,,:,.......+......#',
    'TT..HHHHUHHHH,,,,,t~~~~tu,,,,,,v..:...TTTTTTT...d..;TTTTTT;;*;;TTTTT#.t,,,,,,,k,,,,,,,,,,t.##.G..G..G..#',
    'TT..,,,,,,,,,,,,,,,,,,,,,,,,.........TTTTTTTTT.....;;TTTT;;*;*;TTTTT#T..:....,,,,....:...T.##..........#',
    'TTT..........,,,,,,,,,,,9,,,.........TTTTTTTTTT..TTTT;;;;;;;*;TTTTTT#TT*....:,,,,:....*..TT##T.G..G..G.#',
    'TTTT.........:,,,,,,,,,,,,,:........TTTTTTTTTT...TTTTTTTTTTTTTTTTTTT#TTT*...,,,,,,....*TTTT##T....z....#',
    'TT...........::,,,,,,,,,,,::..........TTTTTTTT...TTTTTTTTTTTTTTTTTTT#TTTT..&.,,,,,...TTTTTT##TT.......T#',
    'TT...:T....t.......,,,.......t...:T...TTTTTTTT..TTTTTTTTTTTTTTTTTTTT#TTTTTTTTTT,,TTTTTTTTTT##TT..*..*.T#',
    'TT.............::..,,,0.::............TTTTTTTT..TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT,,TTTTTTTTTTT#TTT.....TT#',
    'TTTTTTTTTTTTTTTTTT.,,,.TTTTTTTTTTTTTTTTTTTTTT....TTTTTTTTTT:.:TTTTTTTTTTTT:....,,.....:...TT#TT;;..;;TT#',
    'TT......T.....HHH..........T.......T..TTTTTT:..,..:TTTTTT*......*TTTTTTTT..j...,,......*...T#T;;;...;TT#',
    'TT..T:......T.HHH::,,,:HHHH....T......TTTTT....,.......................,,,,,,,,,,,..!......T#T;..q..;;T#',
    'TT.*..;;.:*...HHH..,,,.HHHH..*..;;:.*.TTTT.....,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..;.....;TT#',
    'TTT.)........tnmnt.,,,tHH]H:s.t......TTTTT..HHHHHH.,.:........;;;...t..TT.....q..,,,,,,,,,,,...;..;..TT#',
    '<,**,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,HHHHHH.,..........;;;......TTT..*....,,..j...:TT#TTTTTTTTTT#',
    '<,**,,,,,,,,,,,,,,,,,,J,,,,,,,,,,,,,,,,,,,,,HHHHHH.,...t..e...;;;......TTTTTTTTTT,,TTTTTTTTT############',
    'TT.T...............t,t..............T.TTTT,,HHHhHH.,.......:...........TTTTTTTTTT,,TTTTTTTTTTTTTTTTTTTTT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TTTT,,t.2.3..,.........*..*......TTT:.....,,...:.......:....TTTTTT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TTTT,,,,1....,............e......TT.....,,,.......*...........:TTT',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TTTT:?.o.....,.......:...........TT...,,...~~~~~~~~~~~~~~~~~.....T',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TTTT....,,,,,,.....;;;;.....*....TT..,,..~~~~~~~~~~~~~~~~~~~~~...T',
    'TT~~~~~~~~~~~~~~~~~~=~~~~~~~~~~~~~~~~~TTTTT..,.................;;......TT..,..~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTTTT.,..:.....*.............:..TT..,.~~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTTT..,.....*..*..e.............TT..,.~~~~~~~~~...~~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT...,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,===========.6.~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT:...;;;.......:.......;;.....,,,,,.~~~~~~~~~...~~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT...;;;;;..rrr.....*..........TT..,.~~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT....;;;.rr.7.r....:.....e....TT../..~~~~~~~~~~~~~~~~~~~~~~~..T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT........rr...r........*......TT..,,..~~~~~~~~~~~~~~~~~~~~~...T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT.:.......rrrr..........;;;...TT...,,...~~~~~~~~~~~~~~~~~.....T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT..~~~.............:...;;;;...TT.....,,,,,,,,,,,,,,,,,,,,,,...T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT.~~~~~.....*.............:..TTT.:...e.......;;;......e...:...T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTT..~~~.....:.......*.......TTTTT....*..j.......;;;....tA......T',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTTT......TT.....TT......TTTTTTTTT#######################%#######',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT#######################Q#######',
    'TT~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~TTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTTT################################',
  ],
  areas: [
    { name: 'PHAREIM.NO', x: 0, y: 0, w: 40, h: 48, track: 'village', entry: 'start' },
    { name: 'WHISPER WOODS', x: 40, y: 0, w: 28, h: 20, entry: 'woods' },
    { name: 'NIGHT MARKET', x: 68, y: 0, w: 24, h: 20, track: 'village', entry: 'market' },
    { name: 'HOLLOW GRAVES', x: 92, y: 0, w: 12, h: 28, entry: 'graves' },
    // Arriving without the blade, the Keeper calls you over and tells the story (once).
    {
      name: 'HOME GLADE', x: 40, y: 20, w: 32, h: 28, entry: 'glade',
      intro: { lines: INTRO, who: 'keeper', flag: 'intro', when: { notFlag: 'item:sword' } },
    },
    { name: 'THE CROSSROADS', x: 72, y: 20, w: 20, h: 8, entry: 'crossroads' },
    { name: 'MIRROR LAKE', x: 72, y: 28, w: 32, h: 20, entry: 'lake' },
  ],
  // The name on the roof of Petter's house, the arcade's marquee, the newsstand's and the radio station's signs.
  decals: [
    { x: 20.5, y: 3.15, text: 'PETTER HAREIM', scale: 3, align: 'center', color: '#2ff3ff' },
    { x: 20.5, y: 4.75, text: 'PHAREIM.NO', scale: 2, align: 'center', color: '#ffd23f' },
    { x: 8.5, y: 10.55, text: 'ARCADE', scale: 2, align: 'center', color: '#ff5fd0' },
    { x: 15.5, y: 22.35, text: 'PHAREIM.MD', scale: 1, align: 'center', color: '#ffd23f' },
    { x: 25, y: 23.35, text: 'RADIO', scale: 1, align: 'center', color: '#ff2fa0' },
  ],
  // Continue points per area (death puts you back at the last one visited),
  // the Keeper's hut door (stepping out of it), and where the town's doors put you back outside.
  entries: {
    hut: { x: 47.5, y: 28.5, dir: 'down', out: true },
    woods: { x: 47, y: 17.5, dir: 'up' },
    market: { x: 80, y: 17.5, dir: 'up' },
    graves: { x: 93.5, y: 12.5, dir: 'right' },
    crossroads: { x: 80.5, y: 24.5, dir: 'right' },
    lake: { x: 82, y: 29.5, dir: 'down' },
    home: { x: 20.5, y: 8.5, dir: 'down' },
    wildwood: { x: 1.5, y: 26.5, dir: 'right' },
    arcade: { x: 8.5, y: 15.5, dir: 'down' },
  },
  marks: {
    // ---- The town ----
    '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
    p: { tile: 'D', ent: { t: 'warp', to: 'home', entry: 'door' } },
    U: { tile: 'D', ent: { t: 'warp', to: 'arcade', entry: 'door' } },
    m: {
      tile: 'n',
      ent: {
        t: 'exit', id: 'kiosk', to: { url: 'https://phareim.md' }, look: 'kiosk', label: 'PHAREIM.MD', side: 'down',
        lines: ["PHAREIM.MD: PETTER'S WRITING. ESSAYS, NOTES AND THINGS HE WORKED OUT THE LONG WAY.", 'TAKE A COPY?'],
      },
    },
    // The radio station: a little studio on the coast road, a mast with a red light on the roof.
    ']': {
      tile: 'H',
      ent: {
        t: 'exit', id: 'radio', to: { theme: 'radio' }, look: 'studio', label: 'RADIO', side: 'down',
        lines: ['RADIO PHAREIM. TEN PLACES ON ONE DIAL, AND THE MUSIC IS MADE UP AS IT PLAYS.', 'TUNE IN?'],
      },
    },
    s: {
      tile: 'S',
      ent: {
        t: 'exit', id: 'games', to: { url: 'https://games.phareim.no' }, look: 'sign', label: 'GAMES.PHAREIM.NO', side: 'down',
        lines: ['GAMES.PHAREIM.NO: MORE GAMES, ON A SITE OF THEIR OWN.', 'FOLLOW THE SIGN?'],
      },
    },
    '8': {
      ent: {
        t: 'npc', id: 'townkid', look: 'kid', wander: true,
        talk: [
          {
            when: { notFlag: 'item:sword' },
            lines: [
              'KID: NEW HERE? WALK UP TO ANYTHING THAT GLOWS AND PRESS {A}.',
              "THE ARCADE IS WEST, ONE CABINET PER GAME. THE COAST ROAD, DOWN BY THE WATER, GOES EAST TO THE KEEPER'S HUT. THERE'S A JOB WAITING THERE.",
              'PETTER LIVES RIGHT THERE, UNDER HIS NAME. HE LIKES VISITORS.',
            ],
          },
          { lines: ['KID: IS THAT A REAL BLADE? DON\'T SWING IT AT THE CAT.', 'THE ARCADE IS WEST. PETTER LIVES UNDER HIS NAME.'] },
        ],
      },
    },
    '9': { ent: { t: 'npc', id: 'towncat', look: 'cat', wander: true, talk: [{ lines: ['MRRROW.', '(THE CAT WAS HERE FIRST.)'] }] } },
    '0': { tile: 'S', ent: { t: 'sign', lines: ["↑ PETTER'S HOUSE   ← THE ARCADE   ↓ THE COAST ROAD, THE RADIO STATION AND THE KEEPER'S HUT"] } },
    // The west road: into the Wildwood, through a thicket only a blade gets through.
    '<': { tile: ',', ent: { t: 'warp', to: 'wildwood', entry: 'town' } },
    ')': { tile: 'S', ent: { t: 'sign', lines: ['← THE WILDWOOD', 'THE THICKET HAS GROWN OVER THE ROAD AGAIN. YOU WOULD NEED A BLADE.'] } },
    J: { tile: 'S', ent: { t: 'sign', lines: ['THE NEON COAST.   ← PHAREIM.MD   RADIO →   GAMES.PHAREIM.NO →', "FOLLOW THE ROAD EAST TO THE KEEPER'S HUT."] } },
    u: { tile: 'S', ent: { t: 'sign', lines: ['THE FOUNTAIN. MAKE A WISH.', 'NO COINS, PLEASE. THOSE ARE FOR THE ARCADE.'] } },
    v: { tile: 'S', ent: { t: 'sign', lines: ["THE KEEPER'S HUT: DOWN TO THE COAST, THEN EAST ALONG THE ROAD.", 'THE SUN WON\'T SET. THE KEEPER IS LOOKING FOR SOMEONE TO GO GET IT BACK.'] } },
    // ---- Home Glade ----
    '1': { ent: { t: 'entry', id: 'glade', dir: 'up' } },
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
              'KEEPER: THE SHRINE LIES NORTH OF THE HOLLOW GRAVES, PAST THE NIGHT MARKET. RUBBLE SEALS ITS DOOR.',
              'KEEPER: FIRST, BOMBS. SOMETHING IN WHISPER WOODS, UP NORTH, GOES BOOM.',
            ],
          },
          {
            when: { notFlag: 'gateShut' },
            lines: [
              'KEEPER: BOMBS! GOOD. BUT THE GRAVES ARE WORSE SINCE YESTERDAY: STATIC VINES, ACROSS THE SHRINE ROAD. NO BLADE BITES THEM.',
              "KEEPER: THE STATIC COMES FROM THE WEST. THE OLD LAB IN THE WILDWOOD, PAST THE TOWN. THEY OPENED SOMETHING THERE THEY COULDN'T SHUT.",
              'KEEPER: GO WEST ALONG THE SHORE. FIND WHAT OPENED, AND SHUT IT.',
            ],
          },
          {
            when: { notFlag: 'boss' },
            lines: ['KEEPER: THE VINES ARE GONE! THE GRAVES ARE OPEN. NOW TO THE SHRINE, AND MIND THE JELLIES. THEY BITE BACK.'],
          },
          { lines: ['KEEPER: LOOK AT THAT SKY. WELL DONE, KID.'] },
        ],
      },
    },
    '?': { tile: 'S', ent: { t: 'sign', lines: ["KEEPER'S HUT.   ↑ WHISPER WOODS   → NIGHT MARKET   ← PHAREIM.NO"] } },
    'h': { tile: 'D', ent: { t: 'warp', to: 'hut', entry: 'door' } },
    '7': { ent: { t: 'chest', id: 'ow.rockring', item: 'bits20' } },
    // ---- Whisper Woods ----
    '4': { ent: { t: 'chest', id: 'ow.bombbag', item: 'bombBag' } },
    '5': { ent: { t: 'item', id: 'ow.piece.woods', item: 'heartPiece' } },
    // ---- Night Market ----
    'B': { tile: 'D', ent: { t: 'warp', to: 'shop', entry: 'door' } },
    'E': { ent: { t: 'entry', id: 'shop', dir: 'down' } },
    'N': { tile: 'S', ent: { t: 'sign', lines: ['THE ARCADE MOVED TO TOWN: WEST, PAST THE KEEPER\'S HUT, ALONG THE COAST ROAD.', 'THE CABINETS WERE LONELY OUT HERE.'] } },
    'k': {
      ent: {
        t: 'npc', id: 'kid', look: 'kid', wander: true,
        talk: [
          { when: { notFlag: 'item:bombBag' }, lines: ['KID: BUSHES AND POTS HIDE BITS. THE SHOP TAKES BITS. DO THE MATH.'] },
          { lines: ['KID: YOU GOT BOMBS? DON\'T TELL MY MOM WHERE YOU GOT THEM.'] },
        ],
      },
    },
    'y': { ent: { t: 'npc', id: 'cat', look: 'cat', wander: true, talk: [{ lines: ['MRRROW.'] }] } },
    '&': { tile: 'S', ent: { t: 'sign', lines: ['NIGHT MARKET. OPEN ALL NIGHT.', '(IT IS ALWAYS NIGHT.)'] } },
    // ---- Hollow Graves ----
    'V': { tile: '>', ent: { t: 'warp', to: 'shrine', entry: 'start' } },
    'W': { ent: { t: 'entry', id: 'shrine', dir: 'down' } },
    'g': {
      ent: {
        t: 'npc', id: 'ghost', look: 'ghost', dir: 'left',
        talk: [
          { when: { notFlag: 'item:bombBag' }, lines: ['GHOST: BOO. SORRY. HABIT.', 'THE SHRINE IS SEALED BY RUBBLE. ONLY A BLAST WILL MOVE IT.'] },
          { when: { notFlag: 'gateShut' }, lines: ['GHOST: THE VINES CAME UP OUT OF THE GROUND, HUMMING LIKE A DEAD CHANNEL.', 'GHOST: THEY GROW FROM SOMEWHERE FAR WEST. SHUT THE DOOR THEY CAME THROUGH AND THEY WILL WITHER.'] },
          { lines: ['GHOST: THE JELLIES SPARK WHEN STRUCK. ASK ME HOW I KNOW.'] },
        ],
      },
    },
    '+': { tile: 'S', ent: { t: 'sign', lines: ['HOLLOW GRAVES.   ↑ THE NEON SHRINE'] } },
    // Static vines from the Other Side, until the Gate in the Deep Lab is shut.
    '"': { tile: 'X', ent: { t: 'gate', open: { flag: 'gateShut' } } },
    // ---- Crossroads ----
    '!': { tile: 'S', ent: { t: 'sign', lines: ['↑ NIGHT MARKET   → HOLLOW GRAVES   ↓ MIRROR LAKE   ← HOME GLADE, PHAREIM.NO'] } },
    // ---- Mirror Lake ----
    '6': { ent: { t: 'chest', id: 'ow.island', item: 'bits50' } },
    '/': { tile: 'S', ent: { t: 'sign', lines: ['MIRROR LAKE. THE SUN STILL SHINES IN IT.'] } },
    'A': { ent: { t: 'entry', id: 'cave', dir: 'down' } },
    'Q': { tile: 'D', ent: { t: 'warp', to: 'cave', entry: 'door' } },
    // ---- Enemies (none in the town) ----
    'e': { ent: { t: 'enemy', kind: 'blob' } },
    'a': { ent: { t: 'enemy', kind: 'bat' } },
    'd': { ent: { t: 'enemy', kind: 'dasher' } },
    'j': { ent: { t: 'enemy', kind: 'spitter' } },
    'q': { ent: { t: 'enemy', kind: 'sentry' } },
    'z': { ent: { t: 'enemy', kind: 'zapper' } },
  },
}
