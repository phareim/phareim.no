/**
 * Giving up on a door whose map did not come. `warp()` (game.ts) holds a warp into a map of a chunk that is not
 * there yet at full dark (`World.lazy`); the shell calls this when it stops waiting (`dungeonLoad.ts` `holdStep`).
 * The hero is set down beside the door, the second half of the fade runs, and one line says what happened. Nothing a
 * save holds changes: it never named the map.
 */
import type { Dir, GameState, World } from '../types'
import { HERO_R, WARP_TIME } from '../types'
import { circleBlocked, mapInfo, tileAt } from './map'
import { toDir, opposite, dirVec, DIRS } from './util'

export const DOOR_SHUT = "THE DOOR WON'T OPEN. TRY AGAIN."
export const DOOR_SHUT_OFFLINE = "THE DOOR WON'T OPEN. CHECK THE CONNECTION."

/** How far from the door the hero may be set down, in steps. */
const REACH = 3

/** Pick the held warp up: false (and nothing done) when there is no warp waiting for its swap. */
export function abortWarp(s: GameState, world: World, offline = false): boolean {
  const w = s.warp
  if (s.mode !== 'warp' || !w || w.swapped) return false
  standOff(s, world)
  w.swapped = true
  w.aborted = offline ? DOOR_SHUT_OFFLINE : DOOR_SHUT
  w.t = WARP_TIME
  return true
}

/**
 * The hero to the centre of the nearest tile they can stand on that leads nowhere: a search outwards from their own
 * tile through open ground (so never through a wall), the way they came first, facing away from the door. They are
 * put there, not walked: nothing may start the warp again on the way.
 */
function standOff(s: GameState, world: World) {
  const h = s.hero
  const info = mapInfo(world, s.map.id)
  const sx = Math.floor(h.x)
  const sy = Math.floor(h.y)
  const back = opposite(h.dir)
  const order: Dir[] = [back, ...DIRS.filter(d => d !== back && d !== h.dir), h.dir]
  const leads = (x: number, y: number) => info.exits.has(y * info.w + x) || info.warps.some(r => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h)
  const open = (x: number, y: number) => x >= 0 && y >= 0 && x < info.w && y < info.h && tileAt(s.map, x, y) !== 'O' && !circleBlocked(world, s.map, x + 0.5, y + 0.5, HERO_R)
  let ring: Array<[number, number]> = [[sx, sy]]
  const seen = new Set([sy * info.w + sx])
  for (let step = 0; step <= REACH && ring.length; step++) {
    const next: Array<[number, number]> = []
    for (const [x, y] of ring) {
      if (open(x, y) && !leads(x, y)) { place(s, x + 0.5, y + 0.5, toDir(x - sx, y - sy, h.dir)); return }
      for (const d of order) {
        const v = dirVec(d)
        const nx = x + v.x
        const ny = y + v.y
        if (!open(nx, ny) || seen.has(ny * info.w + nx)) continue
        seen.add(ny * info.w + nx)
        next.push([nx, ny])
      }
    }
    ring = next
  }
  // (No door is that walled in; the map's continue point is always open ground.)
  const spot = info.entries[s.entry.map === s.map.id ? s.entry.entry : ''] ?? Object.values(info.entries)[0]!
  place(s, spot.x, spot.y, spot.dir)
}

function place(s: GameState, x: number, y: number, dir: Dir) {
  const h = s.hero
  h.x = x
  h.y = y
  h.dir = dir
  h.safe = { x, y }
  h.vx = 0
  h.vy = 0
  h.knock = null
  h.auto = null
  h.act = 'idle'
}
