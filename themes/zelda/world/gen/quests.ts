/**
 * The frontier's questlines as data: hand-written places (`Site`s) set down in
 * named regions, with folk whose talk branches on flags. The stories and
 * what each step is for: `docs/worlds/quests.md`. Quest items are flags
 * (`q.<line>.<step>`), never new ItemIds; rewards are ordinary items given
 * once per person (`got:<npc>:<item>`).
 *
 * The rule of the dialogue: people say where to go and what is wrong, never
 * how to win. Every questline starts at the Landing or the crossroads camp
 * just north of it, so a new arrival meets a story within a minute, and
 * every step names the next place with a true bearing on the macro map.
 * Each person speaks under their own name ("GUNN: …", the name plate); a
 * page is whole sentences, at most three rows of the narrowest box.
 *
 * Region ids follow FRONTIER.layout (frontier.ts); a test checks that each
 * site lands in a region of the realm it names.
 */
import type { EntDef, TalkBranch } from '../../types'
import type { Site } from './types'

type Npc = Extract<EntDef, { t: 'npc' }>
const npc = (id: string, look: Npc['look'], talk: TalkBranch[], more: Partial<Npc> = {}): { ent: Npc } => ({ ent: { t: 'npc', id, look, talk, ...more } })
const sign = (...lines: string[]): { ent: EntDef } => ({ ent: { t: 'sign', lines } })

// Flags, by questline.
const BELL = { heard: 'q.bell.heard', crack: 'q.bell.crack', ore: 'q.bell.ore', chrome: 'q.bell.chrome', cast: 'q.bell.cast', rung: 'q.bell.rung' }
const MAP = { p1: 'q.map.p1', asked: 'q.map.asked', p2: 'q.map.p2', p3: 'q.map.p3', p4: 'q.map.p4', done: 'q.map.done' }
const ACT = { heard: 'q.act.heard', trap: 'q.act.trap', tape: 'q.act.tape', done: 'q.act.done' }
const SEED = { heard: 'q.seed.heard', well: 'q.seed.well', got: 'q.seed.got', planted: 'q.seed.planted' }
const LAMP = { heard: 'q.lamp.heard', ask: 'q.lamp.ask', got: 'q.lamp.got', done: 'q.lamp.done' }
export const QUEST_FLAGS = { bell: BELL, map: MAP, act: ACT, seed: SEED, lamp: LAMP }

/** Where each questline's people stand, by realm (checked against the macro map). */
export const SITE_REALMS: Record<string, string> = {}

const site = (realm: string, s: Site): Site => { SITE_REALMS[s.id] = realm; return s }

export const QUEST_SITES: Site[] = [
  // --- the starts: the Landing and the crossroads camp north of it ---------------
  site('landing', {
    id: 'q.landing',
    region: 'fr:6,8',
    rows: [
      '.......',
      '.a...d.',
      '.......',
    ],
    marks: {
      a: npc('q.map.kid', 'kid', [
        { when: { flag: MAP.p1 }, lines: ['TUVA: THE MAP MAN MUST BE IN STILLSAND. NORTH-EAST, WHERE THE GRASS RUNS OUT.'] },
        { lines: ['TUVA: A PAGE OF A MAP BLEW IN ON THE WIND. IT SAYS STILLSAND IN THE CORNER.', 'TUVA: SOMEONE OUT THERE IS MISSING IT. TAKE IT. IT TICKLES.'], set: MAP.p1 },
      ]),
      d: npc('q.lamp.miner', 'dusty', [
        { when: { flag: LAMP.done }, lines: ["KNUT: BROR'S LAMP CAME UP? THEN HE'S FINE. HE WAS ALWAYS STUBBORN."] },
        { lines: ['KNUT: MY MATE BROR WENT DOWN THE DEEP DRIFT AND NEVER CAME UP.', 'KNUT: HIS SISTER GUNN STILL WAITS AT THE UNION HALL. LUMENBY QUARRY, NORTH-WEST.'], set: LAMP.heard },
      ]),
    },
  }),
  site('meadow', {
    id: 'q.crossroads',
    region: 'fr:6,7',
    rows: [
      '...........',
      '..a.....e..',
      '.....Z.....',
      '..d.....g..',
      '...........',
    ],
    props: [{ kind: 'campfire', x: 5.5, y: 3 }],
    marks: {
      a: npc('q.bell.girl', 'dairymaid', [
        { when: { flag: BELL.crack }, lines: ['SIGRID: YOU HAVE THE CHURCH BELL? CAREFUL WITH IT. IT SULKS.'] },
        { lines: ['SIGRID: I WOKE UP HERE WITH HAY IN MY HAIR. SOMETHING CARRIED ME OFF IN THE NIGHT.', 'SIGRID: MY COWS ARE UP ON SETER FELL. THE CHURCH BELL ON YULE FJORD WOULD CALL ME HOME.', 'SIGRID: BUT THE BELL IS CRACKED. THE CHURCH IS FAR NORTH, ON THE FJORD.'], set: BELL.heard },
      ], { hide: { flag: BELL.rung } }),
      d: npc('q.act.busker', 'guitar', [
        { when: { flag: ACT.done }, lines: ['BO: THE SHOW HAS AN ENDING NOW. IT IS VERY SAD. GO AND SEE IT TWICE.'] },
        { lines: ["BO: I PLAY IN THE RAINCHECK'S SHOW. THE RAINCHECK IS A BLIMP, A FLYING THEATRE.", 'BO: OUR SHOW HAS NO ENDING. SOMEONE STOLE ACT THREE, SO I HUM THE GAP.', 'BO: SHE IS MOORED IN FOGSTAGE, WEST. OUR OLD PROMPTER SAW EVERYTHING.'], set: ACT.heard },
      ]),
      e: npc('q.seed.tender', 'robot', [
        { when: { flag: SEED.planted }, lines: ['TENDER: THE SEED TOOK? GOOD. I WILL WALK HOME NOW. SLOWLY.'], give: 'bits50' },
        { lines: ['TENDER: WATER. WATER. NOTHING GROWS IN THIS PATCH. I HAVE WATERED IT FOR NINE YEARS.', 'TENDER: MY LAST BED IS IN STILLSAND. IT WANTS A CLEAN SEED, AND NOTHING HERE IS CLEAN.', 'TENDER: THE WINDMILL KEEPER IN THE SPORELIGHT KNOWS WHERE CLEAN SOIL IS. NORTH-EAST.'], set: SEED.heard },
      ]),
      g: sign('CROSSROADS CAMP\nNORTH: SETER FELL, YULE FJORD\nNORTH-WEST: LUMENBY QUARRY', 'NORTH-EAST: THE SPORELIGHT\nEAST: RERUN ESTATES, STILLSAND\nWEST: FOGSTAGE'),
    },
  }),

  // --- THE CRACKED BELL -----------------------------------------------------------
  site('yulefjord', {
    id: 'q.church',
    region: 'fr:5,0',
    rows: [
      '...........',
      '..I.HHH.I..',
      '...HHHHH...',
      '...HHHHH...',
      '..I.HHH.I..',
      '....,a,....',
      '..G.,,,.G..',
      '....,,,....',
    ],
    marks: {
      a: npc('q.bell.ringer', 'keeper', [
        { when: { flag: BELL.rung }, lines: ['ASLAK: IT RINGS EVERY HOUR NOW. EVEN WHEN ASKED NOT TO.'] },
        { when: { flag: BELL.cast }, lines: ['ASLAK: RECAST! UP IT GOES.', '(DONG. THE WHOLE FJORD GOES QUIET TO LISTEN.)', 'ASLAK: WHOEVER WAS CARRIED OFF CAN HEAR THE WAY HOME NOW. TRY THE SETERS ON THE FELL, SOUTH.'], set: BELL.rung, give: 'heartPiece' },
        { when: { flag: BELL.crack }, lines: ['ASLAK: A FIRE HOT ENOUGH TO RECAST A BELL? THE CLINKER CAMP, IN THE SPORELIGHT. SOUTH-EAST.'] },
        { lines: ['ASLAK: THE BELL CRACKED IN THE COLD. A BELL THAT CANNOT RING CALLS NOBODY HOME.', 'ASLAK: TAKE IT TO A FIRE BIG ENOUGH TO RECAST IT. THERE IS NONE ON THE FJORD.'], set: BELL.crack },
      ]),
    },
  }),
  site('sporelight', {
    id: 'q.clinker',
    region: 'fr:8,3',
    rows: [
      '..........',
      '.HHHH.ZZZ.',
      '.HHHH.....',
      '.HHHH.....',
      '..e...Z...',
      '.n.n.,,.a.',
      '.....,....',
    ],
    props: [{ kind: 'van', x: 7.5, y: 2 }, { kind: 'campfire', x: 6.5, y: 5 }],
    marks: {
      a: npc('q.bell.forewoman', 'guard', [
        { when: { flag: BELL.cast }, lines: ['RAGNA: RING IT GENTLY. AND TELL THEM UP NORTH WHO CAST IT.'] },
        { when: { flag: BELL.chrome }, lines: ['RAGNA: CHROME, AND NOT ONE TREE FELLED. THERE. RECAST, AND STILL WARM.', 'RAGNA: TAKE IT BACK TO THE CHURCH ON YULE FJORD. NORTH-WEST.'], set: BELL.cast, give: 'bits50' },
        { when: { flag: BELL.ore }, lines: ['RAGNA: CHROME. LUMENBY QUARRY, DUE WEST. ASK FOR GUNN AT THE UNION HALL.'] },
        { when: { flag: BELL.crack }, lines: ['RAGNA: A BELL? I CAN RECAST IT, BUT NOT BY BURNING MORE OF THE FOREST.', 'RAGNA: BRING ME CHROME INSTEAD. THE QUARRY OUT WEST HAS CHROME.'], set: BELL.ore },
        { lines: ["RAGNA: THIS IS THE CLINKER. THE TOWN SAID NO TO US. THE FIRE SAID YES.", 'RAGNA: NOBODY HERE IS TURNED AWAY. NOT EVEN YOU.'] },
      ]),
      e: npc('q.clinker.dancer', 'twirler', [{ lines: ['TRIXIE: AND LEFT, AND PUMP, AND SMILE!', 'TRIXIE: THE BELLOWS KEEP THE FIRE HOT. ALSO, GREAT FOR THE ARMS.'] }]),
    },
  }),
  site('lumenby', {
    id: 'q.unionhall',
    region: 'fr:2,3',
    rows: [
      '.........',
      '.HHHHHHH.',
      '.HHHHHHH.',
      '.HHHHHHH.',
      '.t.a.d.t.',
      '....,....',
      '...,g,...',
    ],
    marks: {
      a: npc('q.gunn', 'foreman', [
        { when: { flags: [LAMP.got], not: [LAMP.done] }, lines: ["GUNN: BROR'S LAMP. AND THE RAILS HOLD, HE SAYS?", 'GUNN: THEN HE STAYS DOWN THERE BY CHOICE. STUBBORN. LIKE OUR MOTHER.', 'GUNN: THANK YOU. TAKE THIS. I WAS KEEPING IT FOR HIM.'], set: LAMP.done, give: 'heartPiece' },
        { when: { flags: [BELL.ore], not: [BELL.chrome] }, lines: ["GUNN: CHROME FOR A BELL? TAKE A SHIFT'S WORTH. IT ISN'T DOING ANYTHING HERE.", 'GUNN: AND TELL RAGNA FROM ME: NOT ONE TREE.'], set: BELL.chrome, give: 'bits20' },
        { when: { flag: LAMP.done }, lines: ["GUNN: BROR'S LAMP HANGS IN THE HALL NOW. IT STILL SMELLS OF THE DEEP."] },
        { lines: ['GUNN: LAST FOREWOMAN OF LUMENBY. I KEEP THE SHIFT BOARD, AND NOBODY IS ON IT.', 'GUNN: MY BROTHER BROR WENT DOWN THE DEEP DRIFT, WEST OF HERE, AND NEVER CAME UP.', 'GUNN: BRING ME WORD OF HIM. ANY WORD.'], set: LAMP.ask },
      ]),
      d: npc('q.lumenby.nils', 'tubeblower', [{ lines: ["NEON NILS: THAT'S A LOVELY SERIF OF A ROCK.", "NEON NILS: I BENT EVERY LETTER OF THE TOWN'S SIGN. NOW I BEND SPOONS. TO KEEP MY HAND IN."] }]),
      g: sign('UNION HALL, LUMENBY\nSHIFT BOARD: EMPTY.\nNEXT SHIFT: WHEN SOMEONE COMES.'),
    },
  }),
  site('seterfell', {
    id: 'q.seter',
    region: 'fr:4,1',
    rows: [
      'FFFF,,,FFFF',
      'F.........F',
      'F.HHH.HHH.F',
      'F.HHH.HHH.F',
      'F.HHH.HHH.F',
      'F..a...d..F',
      'F.:.....:.F',
      'F..n.g.n..F',
      'FFFF,,,FFFF',
      '...........',
    ],
    marks: {
      a: npc('q.bell.home', 'dairymaid', [
        { lines: ['SIGRID: THE BELL RANG, AND THERE I WAS. HOME, WITH HAY IN MY HAIR.', "SIGRID: THE COWS DIDN'T EVEN NOTICE I WAS GONE. HERE. FOR YOUR WALK."], give: 'bits50' },
      ], { hide: { notFlag: BELL.rung } }),
      d: npc('q.bell.tail', 'huldra', [
        { when: { flag: BELL.rung }, lines: ['SOLVEIG: A BELL THAT RINGS! NOW I CAN BE WED UNDER IT.', '(SOMETHING SWISHES BEHIND HER SKIRT. NOBODY MENTIONS IT.)'] },
        { lines: ["SOLVEIG: LOVELY EVENING. DON'T LOOK DOWN.", 'SOLVEIG: I WANT TO BE WED UNDER A BELL THAT RINGS. THE ONE ON THE FJORD IS CRACKED.'] },
      ]),
      g: sign('BIG SETER\nMILK, CHEESE, BUTTER.\nNO BUTTER FOR THE NISSE.'),
    },
  }),

  // --- THE SURVEYOR'S PAGES --------------------------------------------------------
  site('stillsand', {
    id: 'q.survey',
    region: 'fr:9,4',
    rows: [
      '-------',
      '-ZZ----',
      '----a--',
      '-------',
    ],
    props: [{ kind: 'tent', x: 2, y: 2, tone: 'gold' }],
    marks: {
      a: npc('q.map.surveyor', 'smoker', [
        { when: { flags: [MAP.p1, MAP.p2, MAP.p3, MAP.p4], not: [MAP.done] }, lines: ['ARNE: ALL FOUR PAGES. THE MAP IS WHOLE, AND IT IS RIGHT.', 'ARNE: FOR NOW. THE WIND TURNS IN THREE MINUTES. TAKE THIS BEFORE IT DOES.'], set: MAP.done, give: 'heartPiece' },
        { when: { flag: MAP.done }, lines: ['ARNE: MY MAP IS RIGHT. I DARE NOT LOOK UP.'] },
        { when: { flag: MAP.asked }, lines: ['ARNE: ONE PAGE WENT WEST, TO FOGSTAGE. ONE NORTH-WEST, TO SETER FELL.', 'ARNE: ONE SOUTH, TO RERUN ESTATES. AND ONE TO THE FERRY. THE WIND PLAYS FAVOURITES.'] },
        { lines: ['ARNE: I SURVEY THE DUNES. MY MAP WAS RIGHT. THEN THE WIND TURNED AND TOOK FOUR PAGES.', 'ARNE: ONE TO THE FERRY. ONE WEST, TO FOGSTAGE. ONE NORTH-WEST, TO SETER FELL.', 'ARNE: AND ONE SOUTH, TO RERUN ESTATES. HERE, FOR YOUR BOOTS.'], set: MAP.asked, give: 'bits20' },
      ]),
    },
  }),
  site('fogstage', {
    id: 'q.programs',
    region: 'fr:2,7',
    rows: [
      ' ,,,,, ',
      ',,t,a,,',
      ',,,,,,,',
    ],
    marks: {
      a: npc('q.map.programs', 'kid', [
        { when: { flag: MAP.p2 }, lines: ['PIA: PROGRAMS. STILL NO ACT THREE. STILL HALF PRICE.'] },
        { lines: ['PIA: PROGRAMS! ACT THREE IS TORN OUT, SO I GLUED IN A MAP PAGE INSTEAD.', 'PIA: NOBODY READS THEM ANYWAY. HAVE THE PAGE.'], set: MAP.p2 },
      ]),
    },
  }),
  site('seterfell', {
    id: 'q.cairn',
    region: 'fr:3,2',
    rows: [
      '.......',
      '.I.t.I.',
      '..,a,..',
      '...,...',
    ],
    marks: {
      a: npc('q.map.cairn', 'owl', [
        { when: { flag: MAP.p3 }, lines: ['STEINAR: THAT PAGE BELONGS TO SOMEONE IN STILLSAND. FAR EAST. I PUT A STONE DOWN FOR YOU.'] },
        { lines: ['STEINAR: I KEEP THE CAIRNS. A PAGE BLEW INTO THIS ONE. IT HAS DUNES ON IT.', 'STEINAR: WE HAVE NO DUNES UP HERE. TAKE IT.'], set: MAP.p3 },
      ]),
    },
  }),
  site('rerun', {
    id: 'q.paper',
    region: 'fr:9,7',
    rows: [
      '.......',
      '.FFa...',
      '..,,,..',
    ],
    marks: {
      a: npc('q.map.paperboy', 'toby', [
        { when: { flag: MAP.p4 }, lines: ['OTTO: EXTRA! SAME NEWS AS YESTERDAY.'] },
        { lines: ['OTTO: EXTRA! A MAP PAGE FELL OUT OF THE SKY.', "OTTO: I FOLDED IT INTO TODAY'S PAPER. HERE. NO CHARGE."], set: MAP.p4 },
      ], { wander: true }),
    },
  }),

  // --- THE STOLEN LAST ACT ---------------------------------------------------------
  site('fogstage', {
    id: 'q.prompter',
    region: 'fr:2,6',
    rows: [
      '.....',
      '.F.F.',
      '..a..',
      '..,..',
    ],
    marks: {
      a: npc('q.act.prompter', 'sleeper', [
        { when: { flag: ACT.trap }, lines: ['BIRGER: PSST. THE TV REPAIRMAN IN RERUN ESTATES. EAST. HE TAPES EVERYTHING.'] },
        { lines: ['BIRGER: PSST. I SAW IT ALL FROM MY BUCKET. THE LAST ACT WENT DOWN THE STAGE TRAP.', 'BIRGER: THEN OUT ON THE AIR. SOME TV IN RERUN ESTATES CAUGHT IT. EAST OF HERE.'], set: ACT.trap },
      ]),
    },
  }),
  site('rerun', {
    id: 'q.tvvan',
    region: 'fr:8,6',
    rows: [
      '.......',
      '.ZZZ...',
      '.....a.',
      '.......',
    ],
    props: [{ kind: 'van', x: 2.5, y: 2 }],
    marks: {
      a: npc('q.act.repairman', 'max', [
        { when: { flag: ACT.tape }, lines: ['RALF: EVERY SET ON THE STREET SHOWS THE PLAY NOW, RIGHT TO THE END.', 'RALF: THE TAPE BELONGS ON THE RAINCHECK. FOGSTAGE, WEST.'] },
        { when: { flag: ACT.trap }, lines: ['RALF: A STOLEN LAST ACT? IT WENT OUT ON THE AIR, AND I TAPED IT. I TAPE EVERYTHING.', 'RALF: TAKE THE TAPE BACK TO THE RAINCHECK. FOGSTAGE, WEST.'], set: ACT.tape },
        { lines: ['RALF: TV REPAIRS. EVERY SET ON THE STREET SHOWS THE SAME PLAY. IT STOPS BEFORE THE END.', 'RALF: I HAVE CHECKED THE TUBES TWICE. THE TUBES ARE FINE.'] },
      ]),
    },
  }),
  site('fogstage', {
    id: 'q.raincheck',
    region: 'fr:1,6',
    rows: [
      '..t...t..',
      '.........',
      '...Z.a...',
      '..d......',
      '....,....',
    ],
    props: [{ kind: 'mast', x: 3.5, y: 3 }],
    marks: {
      a: npc('q.act.director', 'stagemanager', [
        { when: { flag: ACT.done }, lines: ['VEGA: WE END EVERY NIGHT NOW. THE AUDIENCE CRIES. GOOD.'] },
        { when: { flag: ACT.tape }, lines: ['VEGA: THE LAST ACT, ON TAPE! TONIGHT THE RAINCHECK FINALLY ENDS ITS SHOW.', 'VEGA: TAKE A BOW. YOU EARNED IT.'], set: ACT.done, give: 'heartPiece' },
        { lines: ['VEGA: WELCOME TO THE RAINCHECK. YES, THE BLIMP. BEST SEATS IN THE FOG.', 'VEGA: TONIGHT: THE SAME MUSICAL. IT STOPS BEFORE THE END. SOMETHING STOLE ACT THREE.', 'VEGA: ASK OUR OLD PROMPTER, EAST OF THE MAST. HE NEVER LEAVES HIS BUCKET.'] },
      ]),
      d: npc('q.act.cast', 'smoker', [{ lines: ['FINGERS: LOVELY SHOW. CHECK YOUR POCKETS.', 'FINGERS: NO, REALLY. CHECK THEM. I GET BORED BETWEEN SCENES.'] }]),
    },
  }),

  // --- THE CLEAN SEED --------------------------------------------------------------
  site('sporelight', {
    id: 'q.windmill',
    region: 'fr:8,2',
    rows: [
      '.........',
      '..HHH.Z..',
      '..HHH....',
      '..HHH....',
      '.t.,a,.t.',
      '....,....',
    ],
    props: [{ kind: 'mast', x: 6.5, y: 2 }],
    marks: {
      a: npc('q.seed.keeper', 'hippie', [
        { when: { flag: SEED.well }, lines: ['OLA: THE SPIRIT BY THE CLEAN WELL. NORTH-EAST OF THE MILL. BE POLITE.'] },
        { lines: ["OLA: WIND'S UP. THE MILL KEEPS THE HAZE DOWN THERE, WHERE IT BELONGS.", 'OLA: CLEAN SOIL? ONLY UNDER THE ROOTS. A SPIRIT KEEPS A CLEAN WELL, NORTH-EAST OF HERE.'], set: SEED.well },
      ]),
    },
  }),
  site('sporelight', {
    id: 'q.well',
    region: 'fr:9,1',
    rows: [
      ' ::::: ',
      ':.....:',
      ':.,a,.:',
      ':.:,:.:',
      ' ::,:: ',
    ],
    marks: {
      a: npc('q.seed.spirit', 'ghost', [
        { when: { flag: SEED.got }, lines: ['(THE SPIRIT POINTS SOUTH, PAST THE TREES, TO WHERE THE SAND BEGINS.)'] },
        { lines: ['(THE SPIRIT HOLDS OUT A SEED. IT IS NOT FUNGUS AT ALL. IT SMELLS OF CLEAN SAND.)', '(THEN IT POINTS SOUTH, TOWARD STILLSAND.)'], set: SEED.got },
      ]),
    },
  }),
  site('stillsand', {
    id: 'q.bed',
    region: 'fr:10,3',
    rows: [
      ' ----- ',
      '-::::;-',
      '-:-a-:-',
      '-::,::-',
      '---,---',
    ],
    marks: {
      a: npc('q.seed.bed', 'gardenbot', [
        { when: { flag: SEED.planted }, lines: ['BED TENDER: GROWING. YOU ARE STILL NOT A FLOWER. THAT IS ALL RIGHT.'] },
        { when: { flag: SEED.got }, lines: ['BED TENDER: A CLEAN SEED. PLANTING.', '(A SHOOT. THEN A LEAF. THE TENDER HUMS.)', 'BED TENDER: TELL MY PARTNER AT THE CROSSROADS CAMP, SOUTH-WEST. IT CAN STOP WATERING.'], set: SEED.planted, give: 'heartPiece' },
        { lines: ['BED TENDER: SCANNING. YOU ARE NOT A FLOWER.', 'BED TENDER: THIS BED IS EMPTY. IT WANTS A SEED FROM CLEAN SOIL. NONE GROWS OUT HERE.'] },
      ]),
    },
  }),
]

/** The realms' landmarks: one-of-a-kind places with their own folk (no quest steps). */
export const LANDMARK_SITES: Site[] = [
  site('stillsand', {
    id: 'l.pyramid',
    region: 'fr:10,4',
    rows: [
      '-----------',
      '-----I-----',
      '----###----',
      '---#####---',
      '--###M###--',
      '-I#######I-',
      '-----,-----',
      '---a-,-g---',
      '-----------',
    ],
    marks: {
      a: npc('l.caravan.cook', 'vendor', [{ lines: ["ABEL: I COOK FOR THE CARAVAN. REAL FRUIT? IS THAT SAFE TO BITE?", 'ABEL: WE EAT RATION BRICKS. WE HAVE NEVER CHEWED ANYTHING. WE ARE NOT SURE HOW.'] }]),
      g: sign('THE GOLD PYRAMID\nTHE DOOR IS SHUT.\nIT HUMS.'),
    },
  }),
  site('sporelight', {
    id: 'l.steamhouse',
    region: 'fr:9,2',
    rows: [
      '.............',
      '.t.HHHHHHH.t.',
      '...HHHHHHH...',
      '...HHHHHHH...',
      '.~~HHHHHHH~~.',
      '.~~...,...~~.',
      '.....a,d.....',
      '..t..,,,..t..',
      '.....,,,.g...',
      '.............',
    ],
    marks: {
      a: npc('l.steam.clerk', 'vendor', [{ lines: ['MS. B: WELCOME TO THE STEAMHOUSE. SIGN HERE.', 'MS. B: NO, SHORTER.', 'MS. B: SHORTER STILL. THERE. THAT IS YOUR NAME NOW.'] }]),
      d: npc('l.steam.boiler', 'keeper', [{ lines: ["PUFFER: COAL'S LATE AND THE PUFFS ARE ON BREAK. I DO THE BATHS, THE BOILER AND THE BOOKS.", 'PUFFER: IF YOU SEE A SPIRIT COVERED IN MUD, SEND IT IN. IT HAS NOT PAID.'] }]),
      g: sign('THE STEAMHOUSE\nSHIFTS PAID IN TAGS.\nNAMES KEPT AT THE DESK.'),
    },
  }),
  site('lumenby', {
    id: 'l.deepdrift',
    region: 'fr:0,3',
    rows: [
      ' ####### ',
      '####k####',
      '#...e...#',
      '#.a...g.#',
      '##.....##',
      '.........',
    ],
    marks: {
      k: { ent: { t: 'warp', to: 'fr:0,3:deep1', entry: 'up' }, tile: '>' },
      e: { ent: { t: 'entry', id: 'deep' } },
      a: npc('l.deep.mag', 'mossa', [
        { lines: ["MOTHER MAG: WELCOME TO THE DELVERS' CLUB. ROSE STICK, ROSE LEDGE, HOME BY TEA.", 'MOTHER MAG: GOING DOWN IS EASY. MIND THE WAY BACK UP.'] },
      ]),
      g: sign('THE DEEP DRIFT\nNAMES THAT NEVER CAME UP:\nBROR GUNN. (AND A SMUDGE.)'),
    },
  }),
  site('rerun', {
    id: 'l.drivein',
    region: 'fr:8,7',
    rows: [
      '.MMMMMMM.',
      '.........',
      '.F.F.F.F.',
      '..a...d..',
      '.F.F.F.F.',
      '....,....',
    ],
    marks: {
      a: npc('l.band', 'guitar', [{ lines: ["LENNY: WE'RE THE OVERDUE FOUR. WE OWE THE DRIVE-IN ONE GIG. WE HAVE OWED IT FOR YEARS.", 'LENNY: THREE OF US ARE HERE. THE BASSIST WANDERED OFF WITH THE BASS. AND THE VAN.'] }]),
      d: npc('l.rose', 'mossa', [{ lines: ['ROSE: I PLANTED THAT OAK WHEN I WAS SMALL. MIND THE ROOTS.', "ROSE: THE STREET LOOKS THE SAME EVERY YEAR. THE OAK IS HOW I KNOW IT ISN'T."] }]),
    },
  }),
]

/**
 * Folk of the descent under Lumenby (`descent.ts`), by layer: placed in a
 * room of that layer.
 */
export const DEEP_FOLK: Record<number, Npc[]> = {
  1: [npc('q.lamp.bror', 'dusty', [
    { when: { flag: LAMP.got }, lines: ['BROR: GO ON UP. GUNN WILL BE AT THE UNION HALL. SHE ALWAYS IS.'] },
    { lines: ["BROR: FROM UP TOP? TELL MY SISTER GUNN THE RAILS HOLD.", "BROR: TAKE HER MY LAMP. I CAN'T CLIMB ANY MORE, AND I LIKE IT HERE. IT'S WARM."], set: LAMP.got },
  ]).ent],
  2: [npc('d.sigge', 'kid', [{ lines: ["SIGGE: I'M ONLY ALLOWED DOWN TO LAYER TWO. THIS IS LAYER TWO. I CHECKED.", "SIGGE: THE TREES HERE GROW DOWN FROM THE ROOF. DON'T LOOK UP FOR TOO LONG."] }]).ent],
  3: [npc('d.hanna', 'ghost', [{ lines: ['HANNA: DOWN.', 'HANNA: DEEPER.'] }]).ent],
  4: [npc('d.echo', 'ghost', [{ lines: ['ECHO: DID I SAY LEFT? I MEANT LEFT.'] }]).ent],
  5: [npc('d.herdsman', 'troll', [{ lines: ['HERDSMAN: THE JUKEBOXES ARE MY HERD. THEY ONLY PLAY WHEN FED COINS.', 'HERDSMAN: THEY ARE SHY. LIKE ME.'] }]).ent],
  6: [],
}

export const SITES: Site[] = [...QUEST_SITES, ...LANDMARK_SITES]
