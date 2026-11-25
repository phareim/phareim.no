/**
 * Makes the frontier's neighbouring regions while the browser has nothing else to do. A region is generated the
 * first time it is asked for (`world/gen/frontier.ts`), which is 5–50 ms; asked for at a warp's dark frame, that
 * is a hitch at every first crossing of an edge. After the hero arrives in a region its (up to) four neighbours are
 * made one at a time in idle time (`requestIdleCallback`; a timeout where the browser has none), never while the
 * shell says the game is busy (a warp, a fight), so walking on finds them ready. Kept out of the engine: the
 * engine stays pure, and this only asks it for the maps (`mapInfo` makes the def and its derived info, both kept).
 */
import type { World } from './types'
import { mapDef, mapInfo } from './engine/index'

export interface Prefetch {
  /** The hero is in this map now: make its neighbours when idle (anything still queued for elsewhere is dropped). */
  near(mapId: string): void
  stop(): void
}

type Idle = (cb: (deadline: { timeRemaining(): number; didTimeout: boolean }) => void) => number

/** Idle slices shorter than this are passed over (a region takes longer than a frame's spare time anyway). */
const ROOM_MS = 6
/** After this many short slices a region is made all the same, as long as the game is not busy. */
const PATIENCE = 20
/** Without requestIdleCallback: wait this long after arriving, and between regions. */
const FALLBACK_MS = 400

export function neighbourPrefetch(world: World, busy: () => boolean = () => false): Prefetch {
  const g = globalThis as unknown as { requestIdleCallback?: Idle; cancelIdleCallback?: (id: number) => void }
  const idle: Idle = g.requestIdleCallback
    ? cb => g.requestIdleCallback!(cb)
    : cb => setTimeout(() => cb({ timeRemaining: () => ROOM_MS, didTimeout: true }), FALLBACK_MS) as unknown as number
  const cancel = (id: number) => (g.cancelIdleCallback ? g.cancelIdleCallback(id) : clearTimeout(id))
  const done = new Set<string>()
  let queue: string[] = []
  let handle: number | null = null
  let waited = 0

  const run: Parameters<Idle>[0] = deadline => {
    handle = null
    const id = queue[0]
    if (!id) return
    const roomy = deadline.didTimeout || deadline.timeRemaining() >= ROOM_MS || ++waited >= PATIENCE
    if (!busy() && roomy) {
      queue.shift()
      waited = 0
      done.add(id)
      try { mapInfo(world, id) } catch { /* a map that will not make is the warp's problem, as before */ }
    }
    if (queue.length) handle = idle(run)
  }

  return {
    near(mapId) {
      const edges = mapDef(world, mapId)?.edges
      queue = Object.values(edges ?? {}).filter((id): id is string => !!id && !done.has(id))
      waited = 0
      if (queue.length && handle === null) handle = idle(run)
    },
    stop() {
      queue = []
      if (handle !== null) cancel(handle)
      handle = null
    },
  }
}
