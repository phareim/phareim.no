/**
 * The realms of the frontier, as data. Each one's design is
 * `docs/worlds/realm-<id>.md`; what is here is the part the generator reads.
 * Lines are in the pixel font's letters (upper case, ≤ 30 chars a line).
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
      { look: 'vendor', says: [['THE FERRY GOES BACK ANY TIME.', 'TOWN IS JUST ACROSS THE BAY.'], ['ROADS LEAVE NORTH, EAST, WEST.', 'EACH ONE ENDS SOMEWHERE ODD.']] },
      { look: 'kid', says: [['I SAW A TROLL! OR A ROCK.', 'A ROCK WITH OPINIONS.'], ['MAPMAKERS GIVE UP HERE.', 'THE LAND KEEPS GOING.']], wander: true },
      { look: 'robot', says: [['FRONTIER SURVEY: 0% DONE.', 'PLEASE WALK AROUND MORE.']] },
    ],
    lore: ['THE LANDING', 'THE FERRY WAITS AT THE DOCK.', 'EVERY ROAD STARTS HERE.'],
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
      { look: 'hippie', says: [['THE GRASS HUMS AT NIGHT.', 'I HUM BACK. WE GET ALONG.']], wander: true },
      { look: 'guitar', says: [['ONE MORE SONG, THEN NORTH.', 'I SAID THAT LAST YEAR.']] },
      { look: 'cat', says: [['MEOW.', '(IT LOOKS AT THE CAVE.)']], wander: true },
    ],
    lore: ['THE GREEN MILES', 'MIND THE BLOBS. THEY MIND YOU.', 'NORTH: COLDER. EAST: STRANGER.', 'WEST: THE QUARRY. SOUTH: FOG.'],
    loot: SOFT_LOOT,
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
      { look: 'dusty', says: [['EVERY NEON TUBE ON THE COAST', 'WAS DUG RIGHT HERE.'], ['THE TOWN WENT DARK.', 'THE TUBES WENT TO THE CITY.']] },
      { look: 'robot', says: [['PICK NOT FOUND.', 'DIGGING WITH HOPE: 0 PER HOUR.'], ['LUMEN ACCEPTED.', 'FEELINGS NOT.']] },
      { look: 'twirler', says: [["THAT'S A LOVELY SERIF", 'OF A ROCK.'], ['I BLOW GLASS. I SPEAK FONT.', 'THIS HILL IS ALL CAPS.']] },
      { look: 'kid', says: [['BEEP. UNDER THE TRUCK. BEEP.'], ['MY DETECTOR LIKES TRUCKS.', 'AND SPOONS.']], wander: true },
      { look: 'keeper', says: [['SQUARE. ISH. FINE.'], ['SEVEN LOTS ON THE BOARD.', 'NOT ONE OF THEM BUILT.']] },
      { look: 'cat', says: [['MRRP.', '(FOUR STARS.)']], wander: true },
    ],
    lore: ['LUMENBY QUARRY', 'TOOLS FIRST. THEN THE HILL.', 'THE SIGN ON THE HILL IS OUT.', 'SHIFT WHISTLE: OUT OF ORDER.'],
    loot: DEEP_LOOT,
    cave: { name: 'LUMENBY: A DRIFT', foes: [['bat', 3], ['skull', 2], ['blob', 1]] },
  },
  /** Not on the macro map: the descent under Lumenby (`descent.ts`) reads its folk, foes and loot. */
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
    folk: [
      { look: 'keeper', says: [['ROSE STICK. ROSE LEDGE.', 'HOME BY TEA.']] },
      { look: 'mossa', says: [['BONE? LOVELY.', 'BONE LIFTS SING.']] },
      { look: 'ghost', says: [['DOWN.']] },
      { look: 'kid', says: [["I'VE BEEN TO TWO. NEARLY."]] },
    ],
    lore: ['THE UNDERGLOW', 'GOING DOWN IS EASY.', 'COMING UP IS THE PROBLEM.', 'THE DEEP PULLS. REST A WHILE.'],
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
      { look: 'barmaid', says: [['THREE COWS MISSING.', 'FIVE DAYS LEFT.'], ['CALL THEM AND THEY COME.', 'MOSTLY. COWS HAVE OPINIONS.']] },
      { look: 'twirler', says: [['LOVELY EVENING.', "DON'T LOOK DOWN."], ['WHAT A LONG PLAIT I HAVE.', 'ONLY A PLAIT. NOTHING ELSE.']] },
      { look: 'owl', says: [['SOMEBODY DUG INTO MY PANTRY.'], ['ASK BEFORE YOU DIG.', "THAT'S OUR CHIMNEY."]] },
      { look: 'kid', says: [['FOUND A STONE THAT SQUEAKS.', 'WANT IT?']], wander: true },
      { look: 'troll', says: [['NO BUTTER. NO BUTTER! NO...'], ['THE PORRIDGE HAD NO BUTTER.', 'SOMEONE WILL HEAR OF IT.']] },
      { look: 'tree', says: [["I'LL WALK ON. TOMORROW.", 'PROBABLY.']] },
      { look: 'keeper', says: [['THE GOLD LIGHT? IT WAS EAST.', 'NOW WEST.']] },
    ],
    lore: ['SETER FELL', 'MOVING DAY IS SOON.', 'CALL BEFORE YOU DIG HERE.', 'THE HILLS SLEEP. MOSTLY.'],
    loot: [['bits20', 4], ['heart', 3], ['bits5', 2], ['bombs5', 1]],
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
      { look: 'guard', says: [['KEEP THE LAMPS LIT', 'TILL SUN DAY.'], ['I AM THE LAST ONE AWAKE.', 'I THINK. HELLO?']] },
      { look: 'sleeper', says: [['WAKE ME... WHEN IT\'S...', 'BUNS...']] },
      { look: 'kid', says: [['THE DOORS BY THE PIER', 'HAVE NO MARKS.']] },
      { look: 'ghost', says: [['MIND ROWING ME ACROSS, DEAR?', 'MY BROOM IS TIRED.']] },
      { look: 'guitar', says: [['IT TAUGHT ME ONE TUNE.', 'NOT THE END.']] },
      { look: 'barmaid', says: [['SOMETHING ATE MY FISH.', 'SOMETHING WET.']] },
      { look: 'keeper', says: [['THREE CRIES LAST NIGHT.', 'NOBODY ROWS.']] },
    ],
    lore: ['YULE FJORD', 'NO SUN TILL SUN DAY.', 'CHALK YOUR DOOR. LIE FLAT.', 'DO NOT ANSWER THE SEA.'],
    loot: [['bits20', 4], ['heart', 2], ['bombs5', 2], ['bits50', 1]],
    cave: { name: 'YULE FJORD: SEA CAVE', foes: [['bat', 3], ['dasher', 1], ['skull', 1]] },
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
      { look: 'ghost', says: [['(SHE HOLDS UP A STONE:', 'AN ARROW, EAST.)'], ['(HE HOLDS UP A STONE:', 'A STAR. THEN A SHRUG.)']], wander: true },
      { look: 'robot', says: [['WATER. WATER.', 'YOU ARE NOT A FLOWER.']] },
      { look: 'vendor', says: [['REAL FRUIT?', 'IS THAT SAFE TO BITE?']] },
      { look: 'kid', says: [['THE BIRDS ARE STONE.', "DON'T TELL THEM."]] },
      { look: 'smoker', says: [['MY REFLECTION GOT', 'THE BETTER TAN.']] },
      { look: 'hippie', says: [['IS THIS STILL THE WEBSITE?', 'NO SIGNAL.']] },
    ],
    lore: ['STILLSAND', 'THE WIND REDRAWS THE DUNES.', 'AN ISLAND SINKS WITH ITS LOAD.', 'SHH.'],
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
      { look: 'vendor', says: [['SIGN HERE.', 'NO, SHORTER.']] },
      { look: 'keeper', says: [["COAL'S LATE.", 'THE PUFFS ARE ON BREAK.']] },
      { look: 'guard', says: [['THE TOWN SAID NO.', 'THE FIRE SAID YES.']] },
      { look: 'twirler', says: [['AND LEFT, AND PUMP,', 'AND SMILE!']] },
      { look: 'hippie', says: [["WIND'S UP. THE HAZE", 'STAYS DOWN THERE.']] },
      { look: 'ghost', says: [['(IT HOLDS OUT GOLD.', 'IT SMELLS OF MUD.)']] },
    ],
    lore: ['THE SPORELIGHT', 'KEEP YOUR HEAD LOW.', 'CALM IS BETTER THAN WON.', 'NO FIRES. IT ONLY GROWS.'],
    loot: SOFT_LOOT,
    cave: { name: 'THE UNDER', foes: [['blob', 2], ['bat', 1]] },
  },

  // --- the south: fog and lawns -----------------------------------------------------
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
      { look: 'smoker', says: [['LOVELY SHOW.', 'CHECK YOUR POCKETS.']] },
      { look: 'robot', says: [["I'M VILLAGER #3.", 'I HAVE NO LINES YET.']] },
      { look: 'dusty', says: [["FOG'S THIN NORTH.", 'SOMETHING DRINKS IT.']] },
      { look: 'vendor', says: [['NO TICKET?', "THEN YOU'RE IN THE SHOW."]] },
      { look: 'kid', says: [['PROGRAMS!', 'ACT THREE IS TORN OUT!']], wander: true },
      { look: 'guard', says: [['NEVER LET THE STAGE GO DARK.', 'NEVER.']] },
    ],
    lore: ['FOGSTAGE', 'IN THE FOG, WAIT YOUR CUE.', 'NO FIGHT IN A GHOST LIGHT.', 'TONIGHT: THE SAME MUSICAL.'],
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
      { look: 'kid', says: [['EXTRA! SAME NEWS', 'AS YESTERDAY!']], wander: true },
      { look: 'vendor', says: [["EVERYTHING'S A BIT.", 'EVEN THE DOG.']] },
      { look: 'guitar', says: [['WE OWE THE DRIVE-IN', 'ONE GIG. FOREVER.']] },
      { look: 'mossa', says: [['I PLANTED THAT OAK.', 'MIND THE ROOTS.']] },
      { look: 'max', says: [['EVERY SET SHOWS THE SAME PLAY.', 'ODD.']] },
      { look: 'cat', says: [['MEOW.', '(IT SITS ON A HOOD.)']], wander: true },
    ],
    lore: ['RERUN ESTATES', 'SAME STREET. EVERY YEAR.', 'NO BALL GAMES. NO TIME GAMES.', "YOU'VE REACHED PETTER'S. BEEP."],
    loot: [['bits20', 5], ['bits5', 3], ['heart', 2], ['bits50', 1]],
  },
}
