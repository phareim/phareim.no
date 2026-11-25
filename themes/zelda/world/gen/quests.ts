/**
 * The frontier's questlines as data: hand-written places (`Site`s) set down in
 * named regions, with folk whose talk branches on flags. The stories and
 * what each step is for: `docs/worlds/quests.md`. Quest items are flags
 * (`q.<line>.<step>`), never new ItemIds; rewards are ordinary items given
 * once per person (`got:<npc>:<item>`).
 *
 * The rule of the dialogue: people say where to go and what is wrong, never
 * how to win. Every questline starts at the Landing or the crossroads camp
 * just north of it, so a new arrival meets a story within a minute.
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
        { when: { flag: MAP.p1 }, lines: ['THE WIND HERE BLOWS WEST.', "LIKE IT'S LATE FOR SOMETHING."] },
        { lines: ['THIS PAGE BLEW IN FROM EAST.', 'IT SAYS STILLSAND ON IT.', 'SOMEONE OUT THERE LOST A MAP.', 'TAKE IT. IT TICKLES.'], set: MAP.p1 },
      ]),
      d: npc('q.lamp.miner', 'dusty', [
        { when: { flag: LAMP.done }, lines: ["BROR'S LAMP CAME UP?", "THEN HE'S FINE. HE'S STUBBORN."] },
        { lines: ['MY MATE BROR WENT DOWN', 'THE DEEP DRIFT. NEVER CAME UP.', 'LUMENBY QUARRY, OUT WEST.', 'HIS SISTER STILL WAITS THERE.'], set: LAMP.heard },
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
      a: npc('q.bell.girl', 'barmaid', [
        { when: { flag: BELL.crack }, lines: ['THE BELL IS IN YOUR BAG?', 'CAREFUL. IT SULKS.'] },
        { lines: ['THE RIDE DROPPED ME HERE.', 'MY COWS ARE UP ON THE FELL.', 'THE FJORD CHURCH BELL WOULD', 'CALL ME HOME. IT IS CRACKED.'], set: BELL.heard },
      ], { hide: { flag: BELL.rung } }),
      d: npc('q.act.busker', 'guitar', [
        { when: { flag: ACT.done }, lines: ['THE SHOW ENDS NOW!', "IT'S SAD! GO AND SEE IT!"] },
        { lines: ['OUR SHOW HAS NO ENDING.', 'SOMEONE TOOK ACT THREE.', 'THE BLIMP IS DOWN IN THE FOG,', 'SOUTH-WEST. I SING THE GAP.'], set: ACT.heard },
      ]),
      e: npc('q.seed.tender', 'robot', [
        { when: { flag: SEED.planted }, lines: ['THE SEED TOOK? GOOD.', 'I WILL WALK HOME. SLOWLY.'], give: 'bits50' },
        { lines: ['WATER. WATER. NOTHING GROWS.', 'MY LAST BED IS IN STILLSAND.', 'IT WANTS A CLEAN SEED.', 'NOTHING HERE IS CLEAN ENOUGH.'], set: SEED.heard },
      ]),
      g: sign('THE CROSSROADS CAMP', 'NORTH: COLD. EAST: ODD.', 'WEST: QUARRY. SOUTH: FOG.'),
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
        { when: { flag: BELL.rung }, lines: ['IT RINGS EVERY HOUR NOW.', 'EVEN WHEN ASKED NOT TO.'] },
        { when: { flag: BELL.cast }, lines: ['RECAST! UP IT GOES.', '(DONG. THE FJORD LISTENS.)', 'WHOEVER WAS TAKEN', 'HEARS THE WAY HOME NOW.'], set: BELL.rung, give: 'heartPiece' },
        { when: { flag: BELL.crack }, lines: ['A FIRE HOT ENOUGH TO RECAST?', 'THE CLINKER CAMP, EAST,', 'IN THE GLOWING WOOD.'] },
        { lines: ['THE BELL CRACKED IN THE COLD.', 'A BELL THAT CANNOT RING', 'CALLS NOBODY HOME.', 'TAKE IT TO A GREAT FIRE.'], set: BELL.crack },
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
        { when: { flag: BELL.cast }, lines: ['RING IT GENTLE.', 'AND TELL THE TOWN WHO CAST IT.'] },
        { when: { flag: BELL.chrome }, lines: ['CHROME, AND NOT A TREE FELLED.', 'THERE. RECAST. STILL WARM.', 'NOW THE FJORD, NORTH.'], set: BELL.cast, give: 'bits50' },
        { when: { flag: BELL.ore }, lines: ['CHROME. LUMENBY QUARRY.', 'WEST. ASK FOR GUNN.'] },
        { when: { flag: BELL.crack }, lines: ['A BELL? I NEED CHROME FOR IT,', 'NOT MORE TREES.', 'THE QUARRY WEST HAS CHROME.'], set: BELL.ore },
        { lines: ['THE TOWN SAID NO.', 'THE FIRE SAID YES.'] },
      ]),
      e: npc('q.clinker.dancer', 'twirler', [{ lines: ['AND LEFT, AND PUMP,', 'AND SMILE! THE BELLOWS', 'ARE GOOD CARDIO.'] }]),
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
      a: npc('q.gunn', 'keeper', [
        { when: { flags: [LAMP.got], not: [LAMP.done] }, lines: ["BROR'S LAMP. THE RAILS HOLD?", 'THEN HE STAYS DOWN BY CHOICE.', 'THE HILL GETS AN EIGHTH', 'LETTER FOR THAT.'], set: LAMP.done, give: 'heartPiece' },
        { when: { flags: [BELL.ore], not: [BELL.chrome] }, lines: ['CHROME FOR A BELL?', "TAKE A SHIFT'S WORTH.", 'TELL HER: NO TREES.'], set: BELL.chrome, give: 'bits20' },
        { when: { flag: LAMP.done }, lines: ['EIGHT LETTERS NOW.', "DON'T TELL THE SIGN."] },
        { lines: ['SEVEN LOTS. SEVEN LETTERS.', 'DIG.', 'MY BROTHER WENT DOWN', 'THE DEEP DRIFT, WEST.', 'BRING ME WORD. ANY WORD.'], set: LAMP.ask },
      ]),
      d: npc('q.lumenby.nils', 'twirler', [{ lines: ["THAT'S A LOVELY SERIF", 'OF A ROCK.'] }]),
      g: sign('UNION HALL, LUMENBY', 'SHIFT BOARD: 7 LOTS, 0 BUILT.'),
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
      a: npc('q.bell.home', 'barmaid', [
        { lines: ['THE BELL RANG, AND HERE I WAS.', "THE COWS DIDN'T EVEN NOTICE."], give: 'bits50' },
      ], { hide: { notFlag: BELL.rung } }),
      d: npc('q.bell.tail', 'twirler', [
        { when: { flag: BELL.rung }, lines: ['A BELL THAT RINGS! NOW', 'I CAN BE WED UNDER IT.', '(A TAIL SWISHES.', 'NOBODY MENTIONS IT.)'] },
        { lines: ['LOVELY EVENING.', "DON'T LOOK DOWN.", 'I WANT TO BE WED UNDER A BELL', 'THAT RINGS. THERE IS NONE.'] },
      ]),
      g: sign('BIG SETER', 'MOVING DAY: SOON.'),
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
        { when: { flags: [MAP.p1, MAP.p2, MAP.p3, MAP.p4], not: [MAP.done] }, lines: ['ALL FOUR PAGES! THE MAP', 'IS WHOLE. AND RIGHT.', 'FOR NOW. THE WIND TURNS', 'IN THREE MINUTES.'], set: MAP.done, give: 'heartPiece' },
        { when: { flag: MAP.done }, lines: ['MY MAP IS RIGHT.', 'I DARE NOT LOOK UP.'] },
        { when: { flag: MAP.asked }, lines: ['PAGES IN THE FOG, ON THE FELL', 'AND OUT ON THE LAWNS.', 'THE WIND PLAYS FAVOURITES.'] },
        { lines: ['MY MAP WAS RIGHT.', 'THEN IT BLEW AWAY.', 'ONE PAGE TO THE FERRY, ONE', 'TO THE FOG, FELL AND LAWNS.'], set: MAP.asked, give: 'bits20' },
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
        { when: { flag: MAP.p2 }, lines: ['PROGRAMS!', 'STILL NO ACT THREE!'] },
        { lines: ['PROGRAMS! ACT THREE IS TORN', 'OUT, SO I GLUED IN A MAP PAGE.', 'NOBODY READS THEM ANYWAY.', 'HAVE IT.'], set: MAP.p2 },
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
        { when: { flag: MAP.p3 }, lines: ['THE GOLD LIGHT? IT WAS EAST.', 'NOW WEST.'] },
        { lines: ['A PAGE BLEW INTO MY CAIRN.', 'IT HAS DUNES ON IT.', 'WE HAVE NO DUNES. TAKE IT.'], set: MAP.p3 },
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
        { when: { flag: MAP.p4 }, lines: ['EXTRA! SAME NEWS', 'AS YESTERDAY!'] },
        { lines: ['EXTRA! A MAP PAGE FELL', "OUT OF THE SKY! I FOLDED IT", "INTO TODAY'S PAPER. HERE."], set: MAP.p4 },
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
        { when: { flag: ACT.trap }, lines: ['PSST. A TV. ON THE LAWNS.'] },
        { lines: ['PSST. THE LAST ACT WENT', 'DOWN THE STAGE TRAP.', 'AND OUT ON THE AIR. SOME TV', 'GOT IT. THE LAWNS, EAST.'], set: ACT.trap },
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
        { when: { flag: ACT.tape }, lines: ['THE PLAY STILL RUNS', 'ON EVERY SET. ODD.'] },
        { when: { flag: ACT.trap }, lines: ['A STOLEN LAST ACT?', 'I TAPED IT OFF THE AIR.', 'TAKE THE TAPE. THE SETS', 'SHOW IT ANYWAY.'], set: ACT.tape },
        { lines: ['EVERY SET SHOWS THE SAME PLAY.', 'IT STOPS BEFORE THE END.'] },
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
      a: npc('q.act.director', 'guard', [
        { when: { flag: ACT.done }, lines: ['WE END EVERY NIGHT NOW.', 'THE AUDIENCE CRIES. GOOD.'] },
        { when: { flag: ACT.tape }, lines: ['THE LAST ACT, ON TAPE!', 'TONIGHT THE RAINCHECK ENDS', 'THE SHOW. TAKE A BOW.'], set: ACT.done, give: 'heartPiece' },
        { lines: ['THE RAINCHECK MOORS HERE.', 'TONIGHT: THE SAME MUSICAL.', 'IT STOPS BEFORE THE END.', 'SOMETHING STOLE ACT THREE.'] },
      ]),
      d: npc('q.act.cast', 'smoker', [{ lines: ['LOVELY SHOW.', 'CHECK YOUR POCKETS.'] }]),
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
        { when: { flag: SEED.well }, lines: ['THE SPIRIT BY THE WELL,', 'NORTH-EAST. BE POLITE.'] },
        { lines: ["WIND'S UP. THE HAZE STAYS", 'DOWN THERE. CLEAN SOIL? ONLY', 'UNDER THE ROOTS. A SPIRIT', 'SITS BY THE WELL, NORTH-EAST.'], set: SEED.well },
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
        { when: { flag: SEED.got }, lines: ['(IT NODS AT THE SAPLING', 'BY THE POOL.)'] },
        { lines: ['(THE SPIRIT HOLDS OUT A SEED.', 'IT IS NOT FUNGUS AT ALL.', 'IT SMELLS OF CLEAN SAND.)'], set: SEED.got },
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
      a: npc('q.seed.bed', 'robot', [
        { when: { flag: SEED.planted }, lines: ['GROWING. YOU ARE STILL', 'NOT A FLOWER.'] },
        { when: { flag: SEED.got }, lines: ['A CLEAN SEED. PLANTING.', '(A SHOOT. THEN A LEAF.)', 'WATER. WATER. YES.'], set: SEED.planted, give: 'heartPiece' },
        { lines: ['WATER. WATER. THIS BED', 'IS EMPTY. IT WANTS A SEED', 'FROM CLEAN SOIL.'] },
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
      a: npc('l.caravan.cook', 'vendor', [{ lines: ['REAL FRUIT?', 'IS THAT SAFE TO BITE?', 'WE EAT BRICKS. RATION ONES.'] }]),
      g: sign('THE GOLD PYRAMID', 'THE GATE IS SHUT. IT HUMS.'),
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
      a: npc('l.steam.clerk', 'vendor', [{ lines: ['SIGN HERE.', 'NO, SHORTER.', 'SHORTER STILL. THERE.'] }]),
      d: npc('l.steam.boiler', 'keeper', [{ lines: ["COAL'S LATE.", 'THE PUFFS ARE ON BREAK.'] }]),
      g: sign('THE STEAMHOUSE', 'SHIFTS PAID IN TAGS.', 'NAMES KEPT AT THE DESK.'),
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
        { lines: ['THE DELVERS CLUB. ROSE STICK,', 'ROSE LEDGE. HOME BY TEA.', 'GOING DOWN IS EASY.', 'MIND THE WAY BACK UP.'] },
      ]),
      g: sign('THE DEEP DRIFT', 'NAMES THAT NEVER CAME UP:', 'BROR GUNN. (AND A SMUDGE.)'),
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
      a: npc('l.band', 'guitar', [{ lines: ['WE OWE THE DRIVE-IN', 'ONE GIG. FOREVER.', 'OUR BASSIST IS IN', 'ANOTHER DECADE.'] }]),
      d: npc('l.rose', 'mossa', [{ lines: ['I PLANTED THAT OAK.', 'MIND THE ROOTS.'] }]),
    },
  }),
]

/**
 * Folk of the descent under Lumenby (`descent.ts`), by layer: placed in a
 * room of that layer.
 */
export const DEEP_FOLK: Record<number, Npc[]> = {
  1: [npc('q.lamp.bror', 'dusty', [
    { when: { flag: LAMP.got }, lines: ['THE RAILS HOLD.', 'GO ON UP. MIND THE PULL.'] },
    { lines: ['TELL MY SISTER THE RAILS HOLD.', 'TAKE MY LAMP UP TO HER.', "I CAN'T CLIMB ANY MORE.", "AND I LIKE IT HERE. IT'S WARM."], set: LAMP.got },
  ]).ent],
  2: [npc('d.sigge', 'kid', [{ lines: ["I'VE BEEN TO TWO. NEARLY.", 'THE TREES GROW DOWN HERE.', 'DROP A BIT. WATCH IT FALL UP.'] }]).ent],
  3: [npc('d.hanna', 'ghost', [{ lines: ['DOWN.'] }]).ent],
  4: [npc('d.echo', 'ghost', [{ lines: ['DID I SAY LEFT?', 'I MEANT LEFT.'] }]).ent],
  5: [npc('d.herdsman', 'troll', [{ lines: ['THE JUKEBOXES ONLY PLAY', 'WHEN FED COINS.', 'THEY ARE SHY. LIKE ME.'] }]).ent],
  6: [],
}

export const SITES: Site[] = [...QUEST_SITES, ...LANDMARK_SITES]
