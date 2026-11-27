/**
 * The whole world, every map in it from the start: the home page's world (`core.ts`) and the dungeons
 * (`dungeons.ts`). Tests, labs and the stage take it from here. The shell and the Portal's landing must not: one
 * static import of this file puts every dungeon back on `/`. No map is registered here (a land's goes in
 * `lands.ts`, a dungeon's in `dungeons.ts`).
 */
import type { ExitDef, World } from '../types'
import { CORE, worldExits as exitsOf, worldStartingAt as startingAt } from './core'
import { DUNGEONS } from './dungeons'

export { INTRO } from './core'

export const WORLD: World = { ...CORE, lazy: undefined, maps: { ...CORE.maps, ...DUNGEONS } }

/** `core.ts` `worldExits`, of the whole world unless told otherwise. */
export function worldExits(world: World = WORLD): Array<ExitDef & { map: string }> {
  return exitsOf(world)
}

/** `core.ts` `worldStartingAt`, in the whole world unless told otherwise. */
export function worldStartingAt(map: unknown, entry: unknown, world: World = WORLD): World | null {
  return startingAt(map, entry, world)
}
