/**
 * The generated world's own contract: what a realm says about itself, read by
 * the region generator (`region.ts`). A realm is data, no code: its terrain
 * mix, its foes, its folk and the places that stand in it. The design behind
 * each realm is `docs/worlds/realm-<id>.md`.
 */
import type { EnemyKind, ItemId, MapDef, Mark, NpcLook, Prop, TileChar, TrackId } from '../../types'
import type { Gate } from './gates'

/** The drawing engines a map may be shown in (`viewParams.ts` ENGINES). */
export type ViewEngine = 'classic' | 'iso'

export interface Terrain {
  /** Size of the land's main features, in tiles (noise scale). */
  scale: number
  /** Height (0–1) below which there is water, and the band above it that is sand. */
  water: number
  sand: number
  /** Height above which the land breaks into cliff walls. 1 = never. */
  cliff: number
  /** Moisture (0–1) above which trees stand close; and the share of tiles beyond that which are trees. */
  wood: number
  trees: number
  /** Scattered per open tile (0–1). */
  grass: number
  flowers: number
  bushes: number
  rocks: number
  /** The ground everywhere else: grass ('.') or sand ('-'). */
  ground: '.' | '-'
  /** Optional sprinkles: gravestones, pillars, lamp posts per open tile. */
  graves?: number
  pillars?: number
  lamps?: number
}

/** Someone who may live in a realm. */
export interface FolkSpec {
  look: NpcLook
  /** Pools of things this kind of person says; one pool is picked per person. */
  says: string[][]
  wander?: boolean
}

/**
 * A place stamped into a region: a small grid in the generator's own chars
 * (see `stamps.ts`), set down on open land and joined to the road.
 */
export interface PoiSpec {
  stamp: string
  /** How many per region (a range, picked per region). */
  min: number
  max: number
  /** Per region: the chance it is there at all (default 1). */
  chance?: number
}

export interface RealmSpec {
  id: string
  /** The banner: the pixel font's letters. */
  name: string
  track: TrackId
  /** The painter's palette (MapDef.look). */
  look?: MapDef['look']
  /** The views this realm can be shown in (default every view). */
  views?: ViewEngine[]
  terrain: Terrain
  /** Field foes, by weight. */
  foes: Array<[EnemyKind, number]>
  /** Foes per 100 open tiles at the realm's easiest; more further from the Landing. */
  density: number
  pois: PoiSpec[]
  folk: FolkSpec[]
  /**
   * What a sign says where its place has no words of its own (`signs`): the first line is the
   * heading, one of the others follows it. At least two lines on a realm with signs.
   */
  lore: string[]
  /** The first visit's few words of mood (a dialog over the banner); default the heading of `lore`. */
  intro?: string[]
  /**
   * What the signs of a place (a stamp of `stamps.ts`, by name) say in this realm: alternatives, each the
   * pages of one sign. A camp's sign gets a page of the roads out to other realms after it (`region.ts`).
   */
  signs?: Record<string, string[][]>
  /** Chest contents, by weight (a heart piece is placed by the frontier, not here). */
  loot: Array<[ItemId, number]>
  props?: Array<Prop['kind']>
  /** What this realm is about beyond the sword (docs: realm sketch → Mechanic hook). */
  special?: 'dig' | 'battle' | 'puzzles'
  /** What its caves are called and who lives in them (default `A CAVE IN <NAME>`, bats and skulls). */
  cave?: { name: string; foes?: Array<[EnemyKind, number]> }
}

/**
 * A place written by hand and set down in one region: a quest's people,
 * a landmark, a boss's door. Its rows are tile chars and the stamp slots of
 * `stamps.ts`, plus its own chars in `marks` (as in a MapDef); the generator
 * places it like any other stamp, before the realm's own places.
 */
export interface Site {
  id: string
  /** The region: `fr:<rx>,<ry>`. */
  region: string
  rows: string[]
  marks?: Record<string, Mark>
  props?: Prop[]
  /** Where in the region (tiles), if it matters; otherwise wherever it fits. */
  at?: { x: number; y: number }
  /** What its plain ground `.` becomes; default the realm's own ground (a puzzle keeps the floor its kit was solved on). */
  ground?: TileChar
}

/** The frontier's shape: a grid of regions, each one map. */
export interface FrontierSpec {
  seed: number
  /** Region size in tiles. */
  w: number
  h: number
  /** The macro map: one char per region, rows north to south; ' ' = no region (the sea). */
  layout: string[]
  /** Which realm a layout char is. */
  realms: Record<string, string>
  /** Where the ferry lands. */
  landing: { rx: number; ry: number }
  /** Hand-written places, each in its region (quests, landmarks). */
  sites?: Site[]
  /** Ways in on foot from the hand-made world, each cut into its region's rim (`gates.ts`). */
  gates?: Gate[]
}
