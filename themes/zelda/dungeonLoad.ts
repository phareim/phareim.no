/**
 * The dungeons' chunk: fetching it, and what the shell does while it is on its way. The home page's world
 * (`world/core.ts`) has no dungeon maps and its sprite table none of their pictures; this is the one file that asks
 * for them (`dungeonChunk.ts`, which adds the pictures to the table as it loads) and puts the maps into that world in
 * place: in that order, so no frame of a dungeon is asked for before its rows are there. No Vue and no `window`:
 * `Zelda.vue` calls it, and the tests drive it with loaders of their own.
 */
import type { GameState, SaveData, World } from './types'
import { WARP_TIME } from './types'
import { loadSpot } from './engine/game'
import { mapDef, mapInfo } from './engine/map'
import { CORE } from './world/core'

/** Seconds a door is held dark before the shell gives up on it. */
export const HOLD_S = 8

export type FetchMaps = () => Promise<World['maps']>
const fetchDungeons: FetchMaps = () => import('./dungeonChunk').then(m => m.DUNGEONS)

/** The fetch on its way, by the world's `lazy` (which its copies share, as they share `maps`). */
const flights = new WeakMap<object, Promise<void>>()

/**
 * The dungeons into `world`, in place; resolves at once when nothing is to come. Callers share one fetch; a fetch
 * that fails is forgotten, so the next call asks again.
 */
export function loadDungeons(load: FetchMaps = fetchDungeons, world: World = CORE): Promise<void> {
  const lazy = world.lazy
  if (!lazy?.pending) return Promise.resolve()
  let p = flights.get(lazy)
  if (!p) {
    p = load().then(
      (maps) => { Object.assign(world.maps, maps); lazy.pending = false },
      (e: unknown) => { flights.delete(lazy); throw e },
    )
    flights.set(lazy, p)
  }
  return p
}

/**
 * Can a failed fetch work on a second try? Not when the build on the server is a newer one (`outdated`: the file this
 * page names is gone), nor when the browser says the answer was no script. Chrome words every failed `import()` the
 * same, so most failures get their second try.
 */
export function mayHeal(e: unknown, outdated: boolean): boolean {
  return !outdated && !/MIME|\b404\b/i.test(String((e as { message?: unknown } | null)?.message ?? e))
}

/** `go`, and once more when it failed in a way a second try can mend. */
export function withRetry(go: () => Promise<void> = loadDungeons, outdated: () => boolean = () => false): Promise<void> {
  return go().catch((e: unknown) => {
    if (!mayHeal(e, outdated())) throw e
    return go()
  })
}

/**
 * Where a page load goes first. 'wait': the save continues on a map that has not come yet (a reload inside a
 * dungeon), so `createGame` must not see it before the chunk is there. Everything else begins 'now': a town or land
 * save, and a save on a map the world no longer has (`World.rescue` knows those).
 */
export function bootPlan(world: World, local: SaveData | null, back: World['start'] | null, out: boolean): 'now' | 'wait' {
  if (!local || loadSpot(world, local, back, out) !== null) return 'now'
  return !mapDef(world, local.map) && !world.rescue?.(local.map, local.entry) ? 'wait' : 'now'
}

/** True when a door on `map` leads to a map that has not come yet: the moment to fetch it ahead of the hero. */
export function doorAhead(world: World, map: string): boolean {
  return !!world.lazy?.pending && !!mapDef(world, map) && mapInfo(world, map).warps.some(w => !mapDef(world, w.to))
}

/** What `holdStep` remembers of the door it is holding. */
export interface Hold {
  /** Seconds this door has been waited for. */
  t: number
  /** Its fetch has failed. */
  failed: boolean
  /** The warp that is waited for, to tell one walk into a door from the next. */
  warp: GameState['warp']
  load: () => Promise<void>
}

export function newHold(load: () => Promise<void> = () => withRetry()): Hold {
  return { t: 0, failed: false, warp: null, load }
}

/**
 * Once a frame, after the game's step. 'none': no door waits for its map. 'wait': one does (the first such frame
 * starts the fetch). 'abort': give up on it (`abortWarp`), because the fetch failed (`st.failed` stays true) or
 * `HOLD_S` seconds have passed; said only once the screen is full dark, so the picture never jumps.
 */
export function holdStep(state: GameState, world: World, st: Hold, dt: number): 'none' | 'wait' | 'abort' {
  const w = state.warp
  if (state.mode !== 'warp' || !w || w.swapped || w.exit || !world.lazy?.pending || mapDef(world, w.to)) {
    st.warp = null
    return 'none'
  }
  if (st.warp !== w) {
    st.warp = w
    st.t = 0
    st.failed = false
    // (A fetch that fails after this door was given up on says nothing about the next one.)
    st.load().catch(() => { if (st.warp === w) st.failed = true })
  }
  st.t += dt
  if ((st.failed || st.t > HOLD_S) && w.t >= WARP_TIME) {
    st.t = 0
    st.warp = null
    return 'abort'
  }
  return 'wait'
}
