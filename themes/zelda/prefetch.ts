/**
 * Makes the frontier's neighbouring regions while the browser truly has nothing else to do. A region is generated
 * the first time it is asked for (`world/gen/frontier.ts`), which is 5–50 ms in one piece; asked for at a warp's
 * dark frame, the dark hides it. Made in play, it would be a hitch while the hero walks, so after the hero arrives
 * in a region its (up to) four neighbours are made one at a time only when there is room for a whole one: an idle
 * slice of `ROOM_MS` or more (`requestIdleCallback` gives those only while the game loop draws nothing, as when a
 * paused world stands still), or while the shell says the game is calm (paused, a panel or a dialog open). Never
 * while it is busy (a warp, a fight, a scroll). A short slice never makes one, however many come: whatever is not
 * made by the next crossing is made at its warp, as before. Without `requestIdleCallback` only a calm game makes
 * them. Kept out of the engine: the engine stays pure, and this only asks it for the maps (`mapInfo` makes the def
 * and its derived info, both kept).
 */
import type { World } from './types'
import { mapDef, mapInfo } from './engine/index'

export interface Prefetch {
  /** The hero is in this map now: make its neighbours when idle (anything still queued for elsewhere is dropped). */
  near(mapId: string): void
  stop(): void
}

type Idle = (cb: (deadline: { timeRemaining(): number; didTimeout: boolean }) => void) => number

/** An idle slice this long holds a whole region (the browser's longest is 50 ms). */
export const ROOM_MS = 40
/** Without requestIdleCallback: look this often whether the game is calm. */
const FALLBACK_MS = 400

export interface PrefetchMood {
  /** A warp, a fight, a scroll: nothing is made. */
  busy(): boolean
  /** Paused, a panel or a dialog open: a region may be made whatever the idle slice. */
  calm(): boolean
}

export function neighbourPrefetch(world: World, mood: PrefetchMood): Prefetch {
  const g = globalThis as unknown as { requestIdleCallback?: Idle; cancelIdleCallback?: (id: number) => void }
  const idle: Idle = g.requestIdleCallback
    ? cb => g.requestIdleCallback!(cb)
    : cb => setTimeout(() => cb({ timeRemaining: () => 0, didTimeout: false }), FALLBACK_MS) as unknown as number
  const cancel = (id: number) => (g.cancelIdleCallback ? g.cancelIdleCallback(id) : clearTimeout(id))
  const done = new Set<string>()
  let queue: string[] = []
  let handle: number | null = null

  const run: Parameters<Idle>[0] = deadline => {
    handle = null
    const id = queue[0]
    if (!id) return
    if (!mood.busy() && (deadline.timeRemaining() >= ROOM_MS || mood.calm())) {
      queue.shift()
      done.add(id)
      try { mapInfo(world, id) } catch { /* a map that will not make is the warp's problem, as before */ }
    }
    if (queue.length) handle = idle(run)
  }

  return {
    near(mapId) {
      const edges = mapDef(world, mapId)?.edges
      queue = Object.values(edges ?? {}).filter((id): id is string => !!id && !done.has(id))
      if (queue.length && handle === null) handle = idle(run)
    },
    stop() {
      queue = []
      if (handle !== null) cancel(handle)
      handle = null
    },
  }
}
