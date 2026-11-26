/**
 * Ambient life: small animated creatures, plants and lights that only touch the
 * picture (`../wildlife.ts` calls `queueLife`). Each creature is one file in this
 * folder exporting a `Critter`; `index.ts` lists them. Nothing here changes the
 * game state, and everything is a pure function of the map, the tile and the time,
 * so the same place shows the same life on every device.
 */
import type { GameState, IsoLandmark, MapKind } from '../../types'
import type { Light } from '../tiles'
import type { Item } from '../wild'

/** Frames as rows of palette letters ('.' is clear), one letter a classic px. */
export type Rows = readonly string[]

/**
 * When a critter shows. The game without the prism sits at the stuck dusk (sun ≈ 0.1) for good, so
 * `dark` (and `dusk-dawn`) critters are what most visitors see; `day` ones need a running clock past dawn.
 * - `dark`: sun ≤ 0.12 (night and the stuck dusk); `day`: sun > 0.12;
 * - `dusk-dawn`: −0.3 < sun ≤ 0.35 (the blue hours and the stuck dusk); `always`.
 */
export type LifeWhen = 'dark' | 'day' | 'dusk-dawn' | 'always'

export interface Critter {
  /** Short id; sprites are looked up as `<id>_<frame>`. */
  id: string
  /** Where it lives. A critter shows on a map when one of `maps` is the map's id or one of `realms` its realm. */
  maps?: readonly string[]
  realms?: readonly string[]
  /** Map kinds it may show on (default: overworld only). The Underglow's layers are dungeons. */
  kinds?: readonly MapKind[]
  when: LifeWhen
  /** The critter's own colours, by letter. */
  pal: Readonly<Record<string, string>>
  /** Its frames by name (`<id>_0`, `<id>_1`, … or any `<id>_<pose>`). */
  frames: Readonly<Record<string, Rows>>
  /** Puts what shows this frame into `ctx.items` / `ctx.lights`. */
  queue(ctx: LifeCtx): void
}

export interface LifeCtx {
  g: CanvasRenderingContext2D
  s: GameState
  /** Camera in classic px. */
  cx: number
  cy: number
  /** Seconds; frozen at 0 with reduced motion. */
  time: number
  reduced: boolean
  /** The sun's height: −1 deep night, about 0.1 dusk, 1 noon. */
  sun: number
  night: boolean
  /** The land's realm id (`MapDef.realm`), or '' on the hand-made maps. */
  realm: string
  /** The painter's palette (`MapDef.look`: wild, snow, dune, spore, fog, quarry, suburb), or ''. */
  look: string
  mapId: string
  kind: MapKind
  /** The hero's tile; critters live within `range` tiles of it. */
  hx: number
  hy: number
  range: number
  landmarks: readonly IsoLandmark[]
  items: Item[]
  lights: Light[]
  /** The tile char at (x, y), or '' off the map (legend in `../../types.ts`). */
  at(x: number, y: number): string
  /** A stable 0–1 hash of a tile. */
  seed(x: number, y: number, salt: number): number
  /**
   * Draw frame `name` (full sprite name, e.g. `fairy_1`) with its feet at world (x, y) in
   * tiles, lifted `lift` classic px off the ground. `alpha` fades it. Depth-sorted with the rest.
   */
  add(critter: Critter, name: string, x: number, y: number, lift?: number, flip?: boolean, alpha?: number): void
  /** Draw freehand at world (x, y) in tiles (sparkles, trails): `draw(px, py)` gets the classic-px spot. */
  draw(x: number, y: number, lift: number, fn: (g: CanvasRenderingContext2D, px: number, py: number) => void): void
  /** A light (glow on the light map) at world (x, y) tiles. */
  glow(x: number, y: number, r: number, color: string, a: number): void
}
