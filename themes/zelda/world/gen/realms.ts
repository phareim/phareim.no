/**
 * The realms of the frontier, as data. Each one's design is
 * `docs/worlds/realm-<id>.md`; what is here is the part the generator reads.
 *
 * Lines are in the pixel font's letters, upper case: a page is one whole
 * sentence or more and at most three rows of the narrowest dialog box (a
 * test checks). Folk open with who they are ("DAIRYMAID: …", the name
 * plate); animals and the silent are told in brackets. Nobody here is one of
 * the hand-made game's own people, whatever sprite they wear. People and
 * signs say where to go and what is wrong, never how to win, and say
 * nothing of systems that are not built yet.
 *
 * Foes are today's kinds standing in for the sketches' own (a seal is a
 * dasher, a sprinkler a spitter, a loose dog a hound); places are the stamps
 * of `stamps.ts`. What a realm's special system needs (dig, battle, the tide,
 * the three eras) comes with that system; the land and the folk are here now.
 */
import type { RealmSpec } from './types'

const SOFT_LOOT: RealmSpec['loot'] = [['bits20', 5], ['bits5', 3], ['bombs5', 2], ['heart', 2], ['bits50', 1]]
const DEEP_LOOT: RealmSpec['loot'] = [['bits20', 4], ['bits50', 2], ['bombs5', 3], ['heart', 1]]

export const REALMS: Record<string, RealmSpec> = {
  landing: {
    id: 'landing',
    name: 'THE LANDING',
    track: 'village',
    terrain: { scale: 22, water: 0.2, sand: 0.05, cliff: 1, wood: 0.66, trees: 0.6, grass: 0.04, flowers: 0.05, bushes: 0.015, rocks: 0.006, ground: '.' },
    foes: [['blob', 1]],
    density: 0,
    pois: [{ stamp: 'market', min: 1, max: 1 }, { stamp: 'house', min: 1, max: 2 }],
    folk: [
      { look: 'vendor', says: [
        ['TRADER: THE FERRY GOES BACK TO TOWN WHENEVER YOU LIKE. THE DOCK IS RIGHT BEHIND YOU.'],
        ['TRADER: ONE ROAD OUT OF HERE, AND IT GOES NORTH. IT SPLITS AT THE CAMPFIRE.'],
        ['TRADER: I CAME OVER TO SELL MAPS. THERE ARE NO MAPS OF THIS PLACE. I SELL STRING NOW.'],
      ] },
      { look: 'kid', says: [
        ['DOCK KID: I SAW A TROLL UP NORTH! OR A ROCK. A ROCK WITH OPINIONS.'],
        ["DOCK KID: MUM SAYS DON'T GO PAST THE CAMPFIRE. SO I GO RIGHT UP TO THE CAMPFIRE."],
        ['DOCK KID: THE BLOBS UP THERE BOUNCE IF YOU POKE THEM. THEN THEY POKE BACK.'],
      ], wander: true },
      { look: 'robot', says: [
        ['SURVEY UNIT: FRONTIER SURVEY BARELY BEGUN. PLEASE WALK AROUND MORE.'],
        ['SURVEY UNIT: LAND DETECTED NORTH, EAST AND WEST. SOUTH IS WET.'],
        ['SURVEY UNIT: I WAS BUILT TO MEASURE THINGS. NOTHING OUT HERE STAYS MEASURED.'],
      ] },
    ],
    lore: ['THE LANDING', 'THE FERRY WAITS AT THE DOCK.', 'EVERY ROAD STARTS HERE.'],
    intro: ['THE FERRY BUMPS THE DOCK. A ROAD RUNS NORTH INTO LAND NOBODY HAS FINISHED DRAWING.'],
    signs: {
      landing: [['THE LANDING\nFERRY TO TOWN: THE DOCK\nCROSSROADS CAMP: NORTH']],
      market: [['LANDING MARKET. OPEN WHEN THE FERRY IS IN.', 'THE FERRY IS ALWAYS IN.']],
    },
    loot: SOFT_LOOT,
  },
  meadow: {
    id: 'meadow',
    name: 'THE GREEN MILES',
    track: 'overworld',
    terrain: { scale: 26, water: 0.24, sand: 0.04, cliff: 0.86, wood: 0.6, trees: 0.55, grass: 0.06, flowers: 0.03, bushes: 0.03, rocks: 0.01, ground: '.' },
    foes: [['blob', 4], ['sentry', 2], ['dasher', 2], ['spitter', 1]],
    density: 0.9,
    pois: [{ stamp: 'house', min: 0, max: 1 }, { stamp: 'shrine', min: 0, max: 1, chance: 0.6 }, { stamp: 'pond', min: 0, max: 1 }, { stamp: 'cave', min: 0, max: 1, chance: 0.4 }, { stamp: 'grove', min: 0, max: 1, chance: 0.5 }],
    folk: [
      { look: 'hippie', says: [
        ['WANDERER: THE GRASS HUMS AT NIGHT. I HUM BACK. WE GET ALONG.'],
        ['WANDERER: I CAME OVER FOR A WEEKEND. THAT WAS A WHILE AGO. THE WEEKEND IS GOING WELL.'],
        ["WANDERER: NORTH IS COLD AND EAST IS ODD. I'M STAYING IN THE MIDDLE. THE MIDDLE HUMS."],
      ], wander: true },
      { look: 'guitar', says: [
        ['SONGWRITER: ONE MORE SONG, THEN I HEAD NORTH. I SAID THAT LAST SUMMER.'],
        ["SONGWRITER: EVERYTHING RHYMES WITH MILES. SMILES, STILES, PILES. I'M STUCK ON PILES."],
        ['SONGWRITER: I PLAYED FOR THE BLOBS ONCE. THEY BOUNCED IN TIME. BEST CROWD I EVER HAD.'],
      ] },
      { look: 'vendor', says: [
        ['PEDDLER: LACES, SPOONS, STRING. THE MILES ARE LONG AND NOBODY NEEDS A SPOON.'],
        ['PEDDLER: I WALKED HERE FROM THE FERRY. MY FEET HAVE OPINIONS ABOUT THAT.'],
        ['PEDDLER: THE CAMPS ALONG THE ROAD KEEP A FIRE GOING. NOBODY REMEMBERS WHO LIGHTS THEM.'],
      ] },
      { look: 'cat', says: [
        ['MEOW.', '(THE CAT STARES AT A HOLE IN THE HILLSIDE. IT HAS DECIDED NOT TO GO IN.)'],
        ['(A CAT IN THE LONG GRASS. ONLY ITS EARS SHOW. THE EARS ARE JUDGING YOU.)'],
        ['(THE CAT ROLLS OVER IN THE SUN. IT IS NOT AN INVITATION.)'],
      ], wander: true },
    ],
    lore: ['THE GREEN MILES', 'MIND THE BLOBS. THEY MIND YOU.', 'KEEP TO THE ROADS.'],
    intro: ['GRASS TO THE KNEES, AND IT HUMS. EVERY ROAD OFF THE GREEN MILES GOES SOMEWHERE STRANGER.'],
    signs: {
      camp: [
        ['THE GREEN MILES. MIND THE BLOBS. THEY MIND YOU.'],
        ['THE GREEN MILES. CAMP HERE. THE FIRE IS FREE. THE GROUND IS LUMPY.'],
        ['THE GREEN MILES. LOST? SO WAS WHOEVER PUT UP THIS SIGN.'],
      ],
    },
    loot: SOFT_LOOT,
    cave: { name: 'UNDER THE GREEN MILES' },
  },

  // --- the quarry and what lies under it ------------------------------------------
  lumenby: {
    id: 'lumenby',
    name: 'LUMENBY QUARRY',
    track: 'static',
    look: 'quarry',
    views: ['iso'],
    special: 'dig',
    terrain: { scale: 18, water: 0.16, sand: 0.03, cliff: 0.64, wood: 0.78, trees: 0.4, grass: 0.01, flowers: 0.005, bushes: 0.01, rocks: 0.025, ground: '-', lamps: 0.004 },
    foes: [['bat', 3], ['skull', 2], ['zapper', 2], ['drone', 1], ['blob', 1]],
    density: 0.8,
    pois: [
      { stamp: 'lots', min: 0, max: 1, chance: 0.6 }, { stamp: 'ruin', min: 1, max: 2 }, { stamp: 'cave', min: 1, max: 1 },
      { stamp: 'truck', min: 1, max: 2 }, { stamp: 'whistle', min: 0, max: 1, chance: 0.3 }, { stamp: 'house', min: 0, max: 1 },
    ],
    folk: [
      { look: 'dusty', says: [
        ['OLD MINER: EVERY NEON TUBE ON THE COAST WAS DUG OUT OF THIS HILL. EVERY ONE.'],
        ["OLD MINER: THE TOWN WENT DARK AND THE TUBES WENT TO THE CITY. WE STAYED. DON'T ASK ME WHY."],
        ['OLD MINER: PINK IN THE ROCK MEANS LUMEN. PINK ON YOUR HANDS MEANS YOU TOUCHED IT.'],
        ['OLD MINER: THE DEEP DRIFT IS IN THE FAR WEST OF THE HILLS. NOBODY GOES DOWN IT FOR FUN.'],
      ] },
      { look: 'robot', says: [
        ['VENDING UNIT: LUMEN ACCEPTED. FEELINGS NOT.'],
        ['VENDING UNIT: OUT OF STOCK SINCE THE SHIFT WHISTLE STOPPED. THANK YOU FOR WAITING.'],
        ['VENDING UNIT: PICK NOT FOUND. DIGGING WITH HOPE. PROGRESS: SLOW.'],
      ] },
      { look: 'tubeblower', says: [
        ['APPRENTICE: NILS SAYS I BLOW GLASS LIKE A KETTLE. HE MEANS IT KINDLY. I THINK.'],
        ['APPRENTICE: I BLOW GLASS. I SPEAK FONT. THIS WHOLE HILL IS SET IN CAPITALS.'],
        ['APPRENTICE: ONE GOOD PINK VEIN MAKES A HUNDRED TUBES. A BAD ONE MAKES A HUNDRED CUTS.'],
      ] },
      { look: 'kid', says: [
        ["DETECTOR KID: BEEP. BEEP. THAT'S A SPOON. IT'S ALWAYS A SPOON."],
        ['DETECTOR KID: MY DETECTOR LIKES TRUCKS. AND SPOONS. MOSTLY SPOONS.'],
        ["DETECTOR KID: MUM WORKED THE DEEP SHIFT. I'M NOT ALLOWED PAST THE TRUCKS."],
      ], wander: true },
      { look: 'foreman', says: [
        ['PROSPECTOR: CAME FOR THE LUMEN. FOUND RAIN, BATS AND A VERY UNFRIENDLY HILL.'],
        ['PROSPECTOR: GUNN AT THE UNION HALL SAYS I DIG LIKE A DOG. A DOG WOULD BE FASTER, SHE SAYS.'],
        ['PROSPECTOR: EMPTY LOTS AND NOT ONE HOUSE. THE TOWN LEFT, BUT IT LEFT ITS PLANS.'],
      ] },
      { look: 'cat', says: [
        ['MRRP.', '(THE CAT IS ASLEEP ON A WARM ROCK. IT WAS HERE FIRST.)'],
        ['(A QUARRY CAT, GREY WITH DUST. IT WATCHES THE PIT AS IF THE PIT OWES IT MONEY.)'],
        ['(THE CAT SNIFFS YOUR BOOTS AND GIVES THEM THREE STARS.)'],
      ], wander: true },
      { look: 'liftlady', says: [
        ['LIFT OPERATOR: MIND THE CAGE DOOR. KEEP YOUR THUMBS IN.'],
        ['LIFT OPERATOR: THE LIFT IS OUT. THE CABLE WENT TO THE CITY WITH EVERYTHING ELSE.'],
        ["LIFT OPERATOR: TWENTY YEARS GOING UP AND DOWN. NOW I JUST STAND HERE. IT'S RESTFUL."],
      ] },
    ],
    lore: ['LUMENBY QUARRY', 'MIND THE PIT EDGE.', 'SHIFT WHISTLE: OUT OF ORDER.'],
    intro: ['PINK VEINS IN GREY STONE, AND RAIN IN THE PIT. THE SHIFT WHISTLE HAS NOT BLOWN IN YEARS.'],
    signs: {
      camp: [
        ['LUMENBY QUARRY. HARD HATS PAST THIS POINT. HATS NOT PROVIDED.'],
        ['LUMENBY QUARRY. THE SHIFT WHISTLE IS BROKEN. GO HOME WHEN TIRED.'],
        ['LUMENBY QUARRY. EVERY NEON TUBE ON THE COAST STARTED HERE.'],
      ],
      lots: [
        ['BUILDING LOT. HOUSE NOT INCLUDED.'],
        ['RESERVED FOR A HOUSE. ANY DAY NOW.'],
        ["LOT FOR A MINER'S HOUSE. THE MINER LEFT FIRST."],
      ],
    },
    loot: DEEP_LOOT,
    cave: { name: 'A LUMENBY DRIFT', foes: [['bat', 3], ['skull', 2], ['blob', 1]] },
  },
  /** Not on the macro map: the descent under Lumenby (`descent.ts`) reads its name, foes and loot. */
  underglow: {
    id: 'underglow',
    name: 'THE UNDERGLOW',
    track: 'dungeon',
    look: 'quarry',
    views: ['iso'],
    special: 'dig',
    terrain: { scale: 16, water: 0.2, sand: 0.04, cliff: 0.6, wood: 0.8, trees: 0.3, grass: 0.01, flowers: 0.01, bushes: 0, rocks: 0.03, ground: '.' },
    foes: [['bat', 3], ['skull', 2], ['eye', 1], ['zapper', 2], ['blob', 1]],
    density: 1,
    pois: [],
    // Its people are the deep folk of `quests.ts` (DEEP_FOLK), one a layer; its layers have no generated signs.
    folk: [],
    lore: [],
    loot: [['bits50', 3], ['bombs5', 2], ['heart', 2], ['bits20', 2]],
  },

  // --- the cold north ---------------------------------------------------------------
  seterfell: {
    id: 'seterfell',
    name: 'SETER FELL',
    track: 'forest',
    // The last week of summer: heather and birch, not snow (the sketch's snow is a cap on the highest bands).
    look: 'wild',
    views: ['iso', 'classic'],
    special: 'dig',
    terrain: { scale: 24, water: 0.22, sand: 0.02, cliff: 0.72, wood: 0.68, trees: 0.5, grass: 0.1, flowers: 0.12, bushes: 0.02, rocks: 0.03, ground: '.', pillars: 0.002 },
    foes: [['blob', 3], ['hound', 2], ['bat', 1], ['sentry', 1]],
    density: 0.7,
    pois: [
      { stamp: 'seter', min: 1, max: 2 }, { stamp: 'trollhump', min: 2, max: 3 }, { stamp: 'mound', min: 2, max: 4 },
      { stamp: 'cairns', min: 1, max: 2 }, { stamp: 'cave', min: 0, max: 1, chance: 0.4 },
    ],
    folk: [
      { look: 'dairymaid', says: [
        ['DAIRYMAID: THREE COWS MISSING, AND FIVE DAYS TILL WE WALK THE HERDS DOWN.'],
        ['DAIRYMAID: CALL THEM AND THEY COME. MOSTLY. COWS HAVE OPINIONS.'],
        ['DAIRYMAID: CHEESE ON EVERY SHELF, BUTTER IN THE CHURN. HANDS OFF BOTH.'],
      ] },
      { look: 'huldra', says: [
        ['NEIGHBOUR: WHAT A LONG PLAIT I HAVE. ONLY A PLAIT. NOTHING ELSE BACK THERE.'],
        ["NEIGHBOUR: WE MOVE INTO THE HUTS WHEN YOU MOVE OUT. IT'S ONLY FAIR. YOU HAD THE SUMMER."],
        ["NEIGHBOUR: STEEL? I DON'T CARE FOR STEEL. DO PUT THAT SWORD AWAY. IT'S RUDE."],
      ] },
      { look: 'owl', says: [
        ['MOUND ELDER: SOMEBODY DUG INTO MY PANTRY. I WOULD LIKE A WORD WITH THEM.'],
        ["MOUND ELDER: ASK BEFORE YOU DIG ON THE FELL. THAT LUMP YOU'RE STANDING ON IS OUR CHIMNEY."],
        ['MOUND ELDER: WE LIVE UNDER THE MOUNDS AND HEAR EVERY FOOTSTEP. YOURS ARE LOUD.'],
      ] },
      { look: 'kid', says: [
        ['ASH LAD: FOUND A STONE THAT SQUEAKS. WANT IT? NO? MORE FOR ME.'],
        ["ASH LAD: MY BROTHERS SAY I'M NO GOOD FOR ANYTHING. I'M GOOD AT POCKETS."],
        ['ASH LAD: THAT HILL HAS A NOSE. I POKED IT. IT SNEEZED.'],
      ], wander: true },
      { look: 'troll', says: [
        ['BARN NISSE: NO BUTTER. NO BUTTER! NOT A SCRAP OF BUTTER IN MY PORRIDGE.'],
        ['BARN NISSE: SOMEONE WILL HEAR ABOUT THIS PORRIDGE. SOMEONE WITH COWS.'],
        ['BARN NISSE: I KEEP THE BARN AND THE BARN KEEPS ME. A FAIR DEAL, WITH BUTTER.'],
      ] },
      { look: 'tree', says: [
        ["SITTER: I'LL WALK ON. TOMORROW. PROBABLY."],
        ['SITTER: I STOPPED HERE FOR A REST. THE MOSS WAS VERY WELCOMING.'],
        ['SITTER: SIT DOWN A WHILE. NO? WELL. THE OFFER STANDS. SO DO I. MORE OR LESS.'],
      ] },
      { look: 'keeper', says: [
        ["WALKER: FORTY YEARS ON THESE PATHS. THE CAIRNS MOVE ABOUT. I DON'T ASK."],
        ["WALKER: YULE FJORD IS NORTH, OVER THE TOPS. I DON'T GO. TOO DARK UP THERE FOR ME."],
        ['WALKER: SALT, LACES AND NEWS. NOBODY UP HERE WANTS ANYTHING BUT THE SALT.'],
      ] },
      { look: 'oldherder', says: [
        ['OLD HERDER: WHEN THE COWBELLS GO QUIET, SOMETHING IS WATCHING THE HERD.'],
        ['OLD HERDER: FIFTY SUMMERS UP HERE. EVERY ONE ENDS THE SAME: WE WALK DOWN, THEY MOVE IN.'],
        ["OLD HERDER: DON'T WHISTLE NEAR THE HUMPS. THEY'RE ONLY HILLS IN THE DAYTIME."],
      ] },
      { look: 'fellgoat', says: [
        ['(THE GOAT EYES YOUR COAT.)', 'MAA.'],
        ['(THE GOAT IS CHEWING SOMETHING. IT MAY ONCE HAVE BEEN A HAT.)'],
        ['(THE GOAT STARES. YOU LOOK AWAY FIRST.)'],
      ], wander: true },
    ],
    lore: ['SETER FELL', 'MOVING DAY IS SOON.', 'THE HILLS SLEEP. MOSTLY.'],
    intro: ['HEATHER, BIRCHES AND COWBELLS: THE LAST WEEK OF SUMMER ON THE HIGH PASTURE.', 'SOME OF THE HILLS ARE BREATHING.'],
    signs: {
      camp: [
        ['SETER FELL. SUMMER PASTURE. CLOSE EVERY GATE BEHIND YOU.'],
        ['SETER FELL. THE HILLS ARE SLEEPING. WALK SOFTLY.'],
        ['SETER FELL. COWS HAVE RIGHT OF WAY.'],
      ],
      seter: [
        ['SETER. CHEESE ON THE SHELF. HANDS OFF THE CHEESE.'],
        ['SETER. MOVING DAY IS SOON. THE HUTS WILL NOT STAY EMPTY.'],
        ['SETER. KNOCK. IF SOMEONE VERY SMALL ANSWERS, SAY SORRY.'],
      ],
      cairns: [
        ['CAIRN. ADD A STONE. TAKE NONE.'],
        ['CAIRN. THE STONES ARE COUNTED.'],
        ['CAIRN. THE PATH GOES ON. SO DO THE STONES.'],
      ],
    },
    loot: [['bits20', 4], ['heart', 3], ['bits5', 2], ['bombs5', 1]],
    cave: { name: 'UNDER THE FELL' },
  },
  yulefjord: {
    id: 'yulefjord',
    name: 'YULE FJORD',
    track: 'static',
    look: 'snow',
    views: ['iso'],
    special: 'puzzles',
    terrain: { scale: 20, water: 0.4, sand: 0.05, cliff: 0.67, wood: 0.72, trees: 0.4, grass: 0.005, flowers: 0.004, bushes: 0.01, rocks: 0.025, ground: '.', lamps: 0.003 },
    foes: [['dasher', 3], ['zapper', 2], ['bat', 2], ['skull', 1]],
    density: 0.7,
    pois: [
      { stamp: 'stilts', min: 1, max: 1 }, { stamp: 'boathouse', min: 0, max: 2 }, { stamp: 'racks', min: 0, max: 1, chance: 0.6 },
      { stamp: 'lighthouse', min: 0, max: 1, chance: 0.3 }, { stamp: 'cave', min: 0, max: 1, chance: 0.5 },
    ],
    folk: [
      { look: 'guard', says: [
        ["LAMP WARDEN: KEEP THE LAMPS LIT TILL THE SUN COMES BACK. THAT'S THE WHOLE JOB."],
        ["LAMP WARDEN: I AM THE LAST ONE AWAKE. I THINK. HELLO? OH, GOOD. YOU'RE AWAKE TOO."],
        ["LAMP WARDEN: WHEN THE SUN COMES BACK, EVERYONE GETS SUN BUNS. I'VE BEEN SAVING ROOM."],
      ] },
      { look: 'sleeper', says: [
        ["SLEEPER: WAKE ME... WHEN IT'S... BUNS..."],
        ['SLEEPER: NOT YET... STILL DARK... FIVE MORE WEEKS...'],
        ["SLEEPER: WHO'S ROWING... NOBODY ROWS IN WINTER... SHH..."],
      ] },
      { look: 'sledchild', says: [
        ['CHALK GIRL: THE DOORS BY THE PIER HAVE NO MARKS. THAT IS VERY BAD.'],
        ['CHALK GIRL: A CROSS ON EVERY DOOR, SO THE NIGHT RIDERS GO PAST. GRANDMA SAYS.'],
        ["CHALK GIRL: I'M NOT SCARED OF THE DARK. I'M SCARED OF WHAT RIDES ACROSS IT."],
      ] },
      { look: 'lamplighter', says: [
        ['SWEEPER: MIND ROWING ME ACROSS THE FJORD, DEAR? MY BROOM IS TIRED.'],
        ["SWEEPER: SUCH BRIGHT LAMPS. SUCH A SHAME. NOBODY NEEDS A LAMP WHEN THEY'RE ASLEEP."],
        ['SWEEPER: I SWEEP THE DOORSTEPS, DEAR. AND WHATEVER I FIND ON THEM.'],
      ] },
      { look: 'guitar', says: [
        ['MUSICIAN: SOMETHING IN THE RAPID TAUGHT ME ONE TUNE. NOT THE END OF IT.'],
        ["MUSICIAN: I CAN'T STOP PLAYING. MY FINGERS WON'T LET ME. IT'S BEEN THREE DAYS."],
        ['MUSICIAN: HUM ME THE LAST BAR, IF YOU KNOW IT. NOBODY KNOWS IT.'],
      ] },
      { look: 'fjordfisher', says: [
        ['FISHWIFE: SOMETHING ATE MY FISH. SOMETHING WET.'],
        ['FISHWIFE: COD ON THE RACKS ALL WINTER. IT DRIES IN THE DARK. SO DO I.'],
        ["FISHWIFE: IF THE SEA CALLS YOUR NAME, DON'T ANSWER. IT DOESN'T WANT A CHAT."],
      ] },
      { look: 'keeper', says: [
        ['GRANDAD: THREE CRIES OUT ON THE WATER LAST NIGHT. NOBODY ROWS IN THE DARK.'],
        ["GRANDAD: HALF A BOAT WENT PAST IN THE FOG. HALF A MAN ROWING IT. DON'T WAVE."],
        ["GRANDAD: THE BOATHOUSE STAYS SHUT TILL SPRING. THE SEA KNOWS WHO'S INSIDE."],
      ] },
    ],
    lore: ['YULE FJORD', 'NO SUN UNTIL SPRING.', 'DO NOT ANSWER THE SEA.'],
    intro: ['THE SUN HAS NOT RISEN FOR WEEKS. THE VILLAGE SLEEPS, AND A FEW LAMPS STAY LIT.'],
    signs: {
      camp: [
        ['YULE FJORD. THE SUN COMES BACK IN SPRING. KEEP A LAMP LIT UNTIL THEN.'],
        ['YULE FJORD. QUIET, PLEASE. THE VILLAGE IS ASLEEP UNTIL SPRING.'],
        ['YULE FJORD. DO NOT ANSWER THE SEA.'],
      ],
      stilts: [
        ['THE STILTS. NO KNOCKING. SLEEPERS INSIDE UNTIL SPRING.'],
        ['THE STILTS. MIND THE GAPS IN THE BOARDS. THE SEA IS LISTENING.'],
      ],
    },
    loot: [['bits20', 4], ['heart', 2], ['bombs5', 2], ['bits50', 1]],
    cave: { name: 'A SEA CAVE', foes: [['bat', 3], ['dasher', 1], ['skull', 1]] },
  },

  // --- the strange east ------------------------------------------------------------
  stillsand: {
    id: 'stillsand',
    name: 'STILLSAND',
    track: 'beach',
    look: 'dune',
    views: ['iso'],
    special: 'puzzles',
    terrain: { scale: 22, water: 0.12, sand: 0, cliff: 0.68, wood: 0.86, trees: 0.25, grass: 0.004, flowers: 0.002, bushes: 0.004, rocks: 0.018, ground: '-', pillars: 0.002 },
    foes: [['dasher', 3], ['blob', 2], ['drone', 2], ['sentry', 1]],
    density: 0.6,
    pois: [
      { stamp: 'island', min: 2, max: 3 }, { stamp: 'ribs', min: 1, max: 2 }, { stamp: 'oasis', min: 0, max: 1, chance: 0.4 },
      { stamp: 'warden', min: 1, max: 1 }, { stamp: 'caravan', min: 0, max: 1, chance: 0.35 },
    ],
    folk: [
      { look: 'ghost', says: [
        ['(SHE HOLDS UP A STONE WITH AN ARROW SCRATCHED ON IT. THEN SHE WALKS ON.)'],
        ['(HE HOLDS UP A STONE: A STAR. THEN A SHRUG.)'],
        ['(THE WANDERER PUTS A FINGER TO HER LIPS. THE DUNES ARE LISTENING.)'],
      ], wander: true },
      { look: 'gardenbot', says: [
        ['GARDEN UNIT: FLOWERS WATERED: ALL OF THEM. FLOWERS LOOKED AT: NONE. UNTIL NOW.'],
        ['GARDEN UNIT: SCANNING. YOU ARE NOT A WEED. YOU ARE NOT A SEED. PLEASE EXPLAIN.'],
        ['GARDEN UNIT: MY ISLAND FELL. I KEPT WATERING THE SPOT. IT SEEMED POLITE.'],
      ] },
      { look: 'vendor', says: [
        ["CARAVANNER: WE RIDE THE STONE BIRDS ACROSS. THEY DON'T TALK. NEITHER DO WE, MOSTLY."],
        ['CARAVANNER: RATION BRICK? NO? WISE. NOBODY KNOWS WHAT THEY ARE MADE OF.'],
        ["CARAVANNER: SALT, GLASS AND QUIET. THAT'S ALL STILLSAND SELLS."],
      ] },
      { look: 'kid', says: [
        ["ROOST KID: THE BIRDS ARE STONE. DON'T TELL THEM."],
        ['ROOST KID: I KNOW EVERY STONE BIRD BY NAME. THAT ONE IS GRAVEL. SO IS THAT ONE.'],
        ["ROOST KID: WHEN THE WIND TURNS, KEEP STILL. THE DUNES MOVE. YOU DON'T HAVE TO."],
      ] },
      { look: 'smoker', says: [
        ['SALT HERMIT: MY REFLECTION GOT THE BETTER TAN.'],
        ['SALT HERMIT: I TALK TO MY REFLECTION IN THE SALT. IT AGREES WITH EVERYTHING. GOOD COMPANY.'],
        ["SALT HERMIT: SHH. OH. IT'S ONLY YOU. I THOUGHT YOU WERE THE WIND."],
      ] },
      { look: 'hippie', says: [
        ["TOURIST: I CAME OVER ON THE FERRY FOR AN AFTERNOON. THE SUN HASN'T MOVED SINCE."],
        ['TOURIST: NO SHADE, NO SNACKS, NO SIGNAL. FIVE STARS FOR THE VIEW, THOUGH.'],
        ['TOURIST: THE FERRY IS SOUTH-WEST OF HERE, RIGHT? EVERYTHING SEEMS TO BE SOUTH-WEST.'],
      ] },
    ],
    lore: ['STILLSAND', 'THE WIND REDRAWS THE DUNES.', 'SHH.'],
    intro: ['SO QUIET THAT A FOOTSTEP CARRIES FOR MILES. STONE ISLANDS HANG OVER THE DUNES.'],
    signs: {
      camp: [
        ['STILLSAND. SHH.'],
        ['STILLSAND. THE WIND MOVES THE DUNES. THE SIGN STAYS.'],
        ['STILLSAND. FOOTSTEPS CARRY. WALK LIKE A GUEST.'],
      ],
    },
    loot: [['bits20', 4], ['bits50', 2], ['bombs5', 2], ['heart', 1]],
  },
  sporelight: {
    id: 'sporelight',
    name: 'THE SPORELIGHT',
    track: 'lab',
    look: 'spore',
    views: ['iso', 'classic'],
    special: 'battle',
    terrain: { scale: 18, water: 0.2, sand: 0.02, cliff: 0.9, wood: 0.5, trees: 0.45, grass: 0.12, flowers: 0.03, bushes: 0.05, rocks: 0.004, ground: '.' },
    foes: [['blob', 3], ['bat', 3], ['spitter', 2], ['hound', 1]],
    density: 0.6,
    pois: [
      { stamp: 'well', min: 1, max: 2 }, { stamp: 'clickers', min: 1, max: 1 }, { stamp: 'shellyard', min: 0, max: 1, chance: 0.35 },
      { stamp: 'windmill', min: 0, max: 1, chance: 0.5 },
    ],
    folk: [
      { look: 'vendor', says: [
        ['SPORE PICKER: PICK THE CAPS LOW. ABOVE THE KNEE, THE HAZE STINGS YOUR EYES.'],
        ['SPORE PICKER: A BASKET OF CAPS BUYS A BATH AT THE STEAMHOUSE. WORTH EVERY CAP.'],
        ["SPORE PICKER: EVERYTHING GLOWS HERE. I HAVEN'T SEEN MY OWN SHADOW IN YEARS."],
      ] },
      { look: 'keeper', says: [
        ['BATH GUEST: THE STEAMHOUSE DESK CALLS ME G. I USED TO HAVE ELEVEN LETTERS.'],
        ['BATH GUEST: A SOAK, A NAP, ANOTHER SOAK. THE SPIRITS RUN A FINE HOUSE.'],
        ['BATH GUEST: I CAME FOR ONE NIGHT. THE TOWELS ARE VERY PERSUASIVE.'],
      ] },
      { look: 'guard', says: [
        ['SMELTER: THE TOWN TURNED US AWAY. THE CLINKER TOOK US IN. WE OWE THE FIRE.'],
        ['SMELTER: OUR SMOKE MAKES THE FOREST GROW FASTER. NOBODY PLANNED THAT. NOBODY STOPS IT.'],
        ["SMELTER: IRON OUT OF FUNGUS WOOD. DON'T ASK ME HOW. I JUST STOKE."],
      ] },
      { look: 'twirler', says: [
        ['BACKUP DANCER: TRIXIE LEADS AND I FOLLOW. AND PUMP. AND SMILE. MY FACE HURTS.'],
        ["BACKUP DANCER: WE KEEP THE CLINKER'S BELLOWS GOING ALL NIGHT. GREAT FOR THE KNEES."],
        ['BACKUP DANCER: FIVE, SIX, SEVEN, EIGHT. SORRY. I COUNT EVERYTHING NOW.'],
      ] },
      { look: 'hippie', says: [
        ["HAZE WATCHER: THE HAZE IS LOWER TODAY. OR I'M TALLER. HARD TO TELL."],
        ['HAZE WATCHER: BREATHE THE HAZE AND YOU SEE COLOURS. ALSO SPOTS. MOSTLY SPOTS.'],
        ['HAZE WATCHER: UNDER THE ROOTS THE SOIL IS CLEAN. THE FUNGUS DRANK THE POISON. GOOD FUNGUS.'],
      ] },
      { look: 'ghost', says: [
        ['(A TALL SPIRIT IN A PAPER MASK HOLDS OUT GOLD. IT SMELLS OF MUD.)'],
        ['(THE SPIRIT BOWS, MUCH TOO LOW. IT IS ON ITS WAY TO THE BATHS.)'],
        ['(A SPIRIT DRIFTS PAST, HUMMING. ITS TOWEL IS DRY.)'],
      ] },
    ],
    lore: ['THE SPORELIGHT', 'KEEP YOUR HEAD LOW.', 'NO FIRES. FIRE ONLY MAKES IT GROW.'],
    intro: ['GIANT FUNGUS GLOWS IN A SLOW CYAN HAZE. THE AIR STINGS ABOVE THE KNEE.'],
    signs: {
      camp: [
        ['THE SPORELIGHT. THE HAZE STINGS ABOVE THE KNEE. KEEP YOUR HEAD LOW.'],
        ['THE SPORELIGHT. NO FIRES. FIRE ONLY MAKES IT GROW.'],
        ['THE SPORELIGHT. GUESTS WELCOME AT THE STEAMHOUSE. NAMES SHORTENED AT THE DESK.'],
      ],
    },
    loot: SOFT_LOOT,
    cave: { name: 'THE UNDER', foes: [['blob', 2], ['bat', 1]] },
  },

  // --- the south: the fog and the estates -------------------------------------------
  fogstage: {
    id: 'fogstage',
    name: 'FOGSTAGE',
    track: 'indoor',
    look: 'fog',
    views: ['iso'],
    special: 'battle',
    terrain: { scale: 20, water: 0.26, sand: 0.02, cliff: 0.68, wood: 0.76, trees: 0.3, grass: 0.14, flowers: 0.01, bushes: 0.01, rocks: 0.02, ground: '.', lamps: 0.002 },
    foes: [['blob', 4], ['bat', 3], ['knight', 0.25]],
    density: 1,
    pois: [
      { stamp: 'hilltown', min: 0, max: 1, chance: 0.55 }, { stamp: 'ghostlight', min: 0, max: 1, chance: 0.75 }, { stamp: 'flats', min: 1, max: 2 },
      { stamp: 'reeds', min: 2, max: 3 },
    ],
    folk: [
      { look: 'smoker', says: [
        ['STAGEHAND: WE MOVE THE HILLS BETWEEN SCENES. NOT REALLY. BUT IT FEELS LIKE IT.'],
        ['STAGEHAND: SAME SHOW EVERY NIGHT. I COULD DO IT IN MY SLEEP. LAST NIGHT I DID.'],
        ['STAGEHAND: NICE BOOTS. WHAT SIZE? JUST ASKING. FOR A COSTUME.'],
      ] },
      { look: 'stagepuppet', says: [
        ["UNDERSTUDY: I'M VILLAGER #3. I HAVE NO LINES YET."],
        ["UNDERSTUDY: MY CARD SAYS: ENTER, LOOK WORRIED, EXIT. I'VE BEEN PRACTISING WORRIED."],
        ["UNDERSTUDY: I'VE NEVER SEEN A REAL SUNSET. THE FOG ALWAYS GETS IN THE WAY."],
      ] },
      { look: 'dusty', says: [
        ["FOG STOKER: FOG'S THIN UP NORTH. SOMETHING DRINKS IT."],
        ["FOG STOKER: EVERY WISP OF THIS FOG CAME OUT OF MY ENGINES. YOU'RE WELCOME."],
        ["FOG STOKER: KNEE DEEP FOR A SCENE, WAIST DEEP FOR A FINALE. NOBODY'S ASKED FOR A FINALE."],
      ] },
      { look: 'vendor', says: [
        ["TICKET-TAKER: NO TICKET? THEN YOU'RE IN THE SHOW."],
        ['TICKET-TAKER: SOLD OUT TONIGHT. SOLD OUT EVERY NIGHT. NOBODY HAS EVER BOUGHT A TICKET.'],
        ['TICKET-TAKER: THE RAINCHECK IS OUR BLIMP, A FLYING THEATRE. SHE MOORS IN THE FAR WEST.'],
      ] },
      { look: 'kid', says: [
        ['USHER: THIS WAY, PLEASE. MIND THE FOG. MIND THE STEP. THERE IS NO STEP.'],
        ['USHER: NO RUNNING IN THE AISLES. THE AISLES ARE WHEREVER I SAY.'],
        ['USHER: THE SHOW STOPS BEFORE THE END. EVERYONE CLAPS ANYWAY. THEN THEY WAIT.'],
      ], wander: true },
      { look: 'stagemanager', says: [
        ['NIGHT WATCH: NEVER LET THE STAGE GO DARK. NEVER.'],
        ['NIGHT WATCH: ONE LAMP ON AN EMPTY STAGE KEEPS THE GHOSTS FROM PUTTING ON A SHOW.'],
        ['NIGHT WATCH: I CHECK EVERY GHOST LIGHT TWICE A NIGHT. ONCE FOR ME, ONCE FOR THEM.'],
      ] },
    ],
    lore: ['FOGSTAGE', 'WAIT FOR YOUR CUE.', 'TONIGHT: THE SAME MUSICAL.'],
    intro: ['PINK FOG UP TO THE KNEES OF THE HILLS. OUT HERE, EVERYONE WAITS FOR THEIR CUE.'],
    signs: {
      camp: [
        ['FOGSTAGE. THE FOG IS PART OF THE SHOW. PLEASE DO NOT WAVE IT AWAY.'],
        ['FOGSTAGE. TONIGHT: THE RAINCHECK, A TOURING BLIMP, PLAYS THE SAME MUSICAL.'],
        ['FOGSTAGE. LATECOMERS WILL BE SEATED IN THE FOG.'],
      ],
      hilltown: [
        ['BOX OFFICE. TONIGHT IS SOLD OUT. TONIGHT IS ALWAYS SOLD OUT.'],
        ['HILLTOWN. QUIET, PLEASE. THE SHOW HAS ALREADY STARTED. IT ALWAYS HAS.'],
      ],
      flats: [
        ['SCENERY. DO NOT LEAN ON THE CASTLE.'],
        ['SCENERY. THE MOON IS PLYWOOD. PLEASE DO NOT TELL THE MOON.'],
        ['SCENERY FOR ACT THREE. ACT THREE IS MISSING.'],
        ['SCENERY. THE SHIP DOES NOT FLOAT. PLEASE STOP TRYING.'],
      ],
    },
    loot: [['bits20', 4], ['bits50', 2], ['heart', 2], ['bombs5', 1]],
  },
  rerun: {
    id: 'rerun',
    name: 'RERUN ESTATES',
    track: 'village',
    look: 'suburb',
    views: ['iso', 'classic'],
    special: 'battle',
    terrain: { scale: 24, water: 0.16, sand: 0.02, cliff: 1, wood: 0.72, trees: 0.4, grass: 0.01, flowers: 0.03, bushes: 0.04, rocks: 0.002, ground: '.', lamps: 0.004 },
    foes: [['spitter', 3], ['hound', 3], ['drone', 1]],
    density: 0.8,
    pois: [
      { stamp: 'culdesac', min: 1, max: 1 }, { stamp: 'lot', min: 2, max: 3 }, { stamp: 'booth', min: 1, max: 1 },
      { stamp: 'hedgemaze', min: 0, max: 1, chance: 0.4 }, { stamp: 'garagesale', min: 0, max: 1, chance: 0.3 },
    ],
    folk: [
      { look: 'kid', says: [
        ["BIKE KID: I'VE RIDDEN ROUND THE BLOCK A THOUSAND TIMES. IT'S ALWAYS THE SAME BLOCK."],
        ["BIKE KID: THERE'S A CAR THAT DRIVES ROUND AND ROUND. NOBODY'S DRIVING IT. COOL, RIGHT?"],
        ['BIKE KID: MUM SAYS BE HOME WHEN THE STREETLIGHTS COME ON. THEY NEVER GO OFF.'],
      ], wander: true },
      { look: 'vendor', says: [
        ["YARD SELLER: EVERYTHING'S A BIT. EVEN THE DOG."],
        ['YARD SELLER: THAT LAMP? A BIT. THAT CHAIR? A BIT. MY HUSBAND? MAKE ME AN OFFER.'],
        ['YARD SELLER: SAME SALE EVERY SATURDAY, SAME THINGS ON THE TABLE. NOBODY TAKES THE DOG.'],
      ] },
      { look: 'guitar', says: [
        ['TEEN ROCKER: MY BAND PRACTISES IN THE GARAGE. THE NEIGHBOURS PRACTISE COMPLAINING.'],
        ['TEEN ROCKER: ONE DAY I WILL PLAY THE DRIVE-IN. THE BAND THEY BOOKED NEVER SHOWED.'],
        ["TEEN ROCKER: THREE CHORDS AND A LAWN. THAT'S ALL ROCK AND ROLL EVER WAS."],
      ] },
      { look: 'mossa', says: [
        ['GARDENER: MOW ON SATURDAY, WATER ON SUNDAY. EVERY WEEK. THE GRASS NEVER GROWS.'],
        ["GARDENER: MY ROSES WIN THE SHOW EVERY YEAR. NOBODY ELSE ENTERS. THAT'S NOT MY FAULT."],
        ['GARDENER: MIND THE SPRINKLERS. THEY HAVE OPINIONS ABOUT VISITORS.'],
      ] },
      { look: 'max', says: [
        ["NEIGHBOUR KID: OUR TV SHOWS THE SAME PLAY EVERY NIGHT. DAD SAYS IT'S CULTURE."],
        ['NEIGHBOUR KID: I DUG A HOLE IN THE BACK YARD. NEXT DAY IT WAS FILLED IN. NOBODY DID IT.'],
        ["NEIGHBOUR KID: THE PHONE BOOTH RINGS AT NIGHT. NOBODY ANSWERS. I'M NOT ALLOWED."],
      ] },
      { look: 'cat', says: [
        ['MEOW.', '(THE CAT SITS ON A WARM CAR HOOD AND STARES DOWN THE SPRINKLERS.)'],
        ['(A CAT ON A MAILBOX. IT HAS READ ALL THE MAIL.)'],
        ['MEOW. (IT WANTS TO GO IN. THEN OUT. THEN IN AGAIN.)'],
      ], wander: true },
    ],
    lore: ['RERUN ESTATES', 'SAME STREET. EVERY YEAR.', 'NO BALL GAMES ON THE LAWNS.'],
    intro: ['LAWNS, MAILBOXES AND SPRINKLERS. THE SAME NICE STREET, OVER AND OVER.'],
    signs: {
      camp: [
        ['RERUN ESTATES. A NICE STREET. THE SAME NICE STREET, OVER AND OVER.'],
        ['RERUN ESTATES. SLOW: CHILDREN AND SPRINKLERS AT PLAY.'],
        ['RERUN ESTATES. NO BALL GAMES ON THE LAWNS.'],
      ],
      culdesac: [
        ['NO THROUGH ROAD. TURN AROUND. EVERYONE DOES.'],
        ['MAPLE CLOSE. NO THROUGH ROAD. NO WAY OUT, REALLY.'],
      ],
      lot: [
        ['FOR SALE. VIEWING BY APPOINTMENT. NO APPOINTMENTS LEFT.'],
        ['LAWN. KEEP OFF. YES, ALL OF IT.'],
        ['SOLD. NEW OWNERS MOVING IN SOON. THEY HAVE BEEN MOVING IN SOON FOR YEARS.'],
        ['LAWN OF THE MONTH. EVERY MONTH.'],
        ['PRIVATE LAWN. THE GNOMES ARE WATCHING.'],
      ],
      booth: [
        ['PHONE BOOTH. LOCAL CALLS ONLY. EVERY CALL IS LOCAL.'],
        ['PHONE BOOTH. THE LINE IS BUSY. IT HAS BEEN BUSY FOR YEARS.'],
      ],
    },
    loot: [['bits20', 5], ['bits5', 3], ['heart', 2], ['bits50', 1]],
  },
}
