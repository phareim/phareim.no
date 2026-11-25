/**
 * The realms of the frontier, as data. Each one's design is
 * `docs/worlds/realm-<id>.md`; what is here is the part the generator reads.
 * Lines are in the pixel font's letters (upper case, ≤ 30 chars a line).
 */
import type { RealmSpec } from './types'

const SOFT_LOOT: RealmSpec['loot'] = [['bits20', 5], ['bits5', 3], ['bombs5', 2], ['heart', 2], ['bits50', 1]]

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
    lore: ['THE GREEN MILES', 'MIND THE BLOBS. THEY MIND YOU.', 'NORTH: COLDER. EAST: STRANGER.'],
    loot: SOFT_LOOT,
  },
  lumenby: {
    id: 'lumenby',
    name: 'LUMENBY QUARRY',
    track: 'static',
    views: ['iso'],
    special: 'dig',
    terrain: { scale: 18, water: 0.16, sand: 0.03, cliff: 0.64, wood: 0.78, trees: 0.4, grass: 0.01, flowers: 0.005, bushes: 0.01, rocks: 0.025, ground: '-', lamps: 0.004 },
    foes: [['bat', 3], ['skull', 2], ['zapper', 2]],
    density: 0.8,
    pois: [{ stamp: 'ruin', min: 1, max: 2 }, { stamp: 'cave', min: 1, max: 1 }, { stamp: 'house', min: 0, max: 1 }],
    folk: [
      { look: 'dusty', says: [['EVERY NEON TUBE ON THE COAST', 'WAS DUG RIGHT HERE.'], ['THE TOWN WENT DARK.', 'THE TUBES WENT TO THE CITY.']] },
      { look: 'robot', says: [['PICK NOT FOUND.', 'DIGGING WITH HOPE: 0 PER HOUR.']] },
    ],
    lore: ['LUMENBY QUARRY', 'TOOLS FIRST. THEN THE HILL.', 'THE SIGN ON THE HILL IS OUT.'],
    loot: [['bits20', 4], ['bits50', 2], ['bombs5', 3], ['heart', 1]],
  },
}
