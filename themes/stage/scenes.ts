/**
 * The places the view stage can show. Pure: each scene puts the hero somewhere
 * in the one world and says what the hero carries. The studio lists them by
 * `label`; `scripts/export-sprites.mjs` writes the list into the base.
 */
import type { GameEvent, GameState, World } from '../zelda/types'
import { enterMap } from '../zelda/engine/game'

export interface StageScene {
  id: string
  label: string
  /** Where it is, for the studio's list. */
  group: 'Town' | 'Coast' | 'Indoors' | 'Shrine' | 'Wildwood'
  set(world: World, s: GameState): void
}

const ev: GameEvent[] = []

/** Stand at an entry of a map, a few tiles off. */
function at(world: World, s: GameState, map: string, entry: string, dx = 0, dy = 0, dir?: GameState['hero']['dir']) {
  enterMap(world, s, map, entry, ev)
  if (dx || dy) enterMap(world, s, map, entry, ev, { x: s.hero.x + dx, y: s.hero.y + dy })
  if (dir) s.hero.dir = dir
}

/** Stand at a tile of a map. */
function on(world: World, s: GameState, map: string, x: number, y: number, dir: GameState['hero']['dir'] = 'down') {
  enterMap(world, s, map, '', ev, { x, y })
  s.hero.dir = dir
}

/** The Wildwood's story so far, so its people and its doors are as a player finds them. */
function wild(s: GameState, luna = false) {
  s.inv.hook = true
  for (const f of ['intro', 'llama.met', 'mistral.met', 'deepseek.met', 'gemini.met', 'room11', 'mistral.told']) s.flags[f] = true
  if (luna) s.flags.luna = true
}

export const STAGE_SCENES: readonly StageScene[] = [
  { id: 'plaza', label: 'The square', group: 'Town', set: (w, s) => at(w, s, w.start.map, w.start.entry) },
  { id: 'fountain', label: 'The fountain and the viewfinder', group: 'Town', set: (w, s) => on(w, s, 'overworld', 25.5, 14.5, 'up') },
  { id: 'look', label: 'The NEW LOOK stall', group: 'Town', set: (w, s) => on(w, s, 'overworld', 31.5, 14.5, 'up') },
  { id: 'kiosk', label: 'The newsstand', group: 'Coast', set: (w, s) => on(w, s, 'overworld', 18.5, 26.5, 'left') },
  { id: 'beach', label: 'The beach', group: 'Coast', set: (w, s) => on(w, s, 'overworld', 29.5, 28.5) },
  { id: 'road', label: 'The coast road', group: 'Coast', set: (w, s) => on(w, s, 'overworld', 39.5, 26.5, 'right') },
  { id: 'hut', label: 'The Keeper’s hut', group: 'Coast', set: (w, s) => at(w, s, 'overworld', 'hut', 0, 1.5) },
  { id: 'woods', label: 'The woods', group: 'Coast', set: (w, s) => on(w, s, 'overworld', 45.5, 9.5) },
  { id: 'lake', label: 'Mirror Lake', group: 'Coast', set: (w, s) => on(w, s, 'overworld', 87.5, 37.5, 'right') },
  { id: 'graves', label: 'The graves', group: 'Coast', set: (w, s) => at(w, s, 'overworld', 'shrine', 0, 6) },
  { id: 'arcade', label: 'The arcade', group: 'Indoors', set: (w, s) => at(w, s, 'arcade', 'door', 0, -1) },
  { id: 'home', label: 'Petter’s house', group: 'Indoors', set: (w, s) => at(w, s, 'home', 'door') },
  { id: 'shop', label: 'The shop', group: 'Indoors', set: (w, s) => at(w, s, 'shop', 'door', 0, -2) },
  { id: 'keeper', label: 'Inside the hut', group: 'Indoors', set: (w, s) => at(w, s, 'hut', 'door', 0, -3, 'up') },
  { id: 'shrine', label: 'The shrine’s first room', group: 'Shrine', set: (w, s) => at(w, s, 'shrine', 'start', 0, -2) },
  { id: 'hub', label: 'The shrine’s hub', group: 'Shrine', set: (w, s) => at(w, s, 'shrine', 'start', 0, -12) },
  { id: 'dark', label: 'A dark room', group: 'Shrine', set: (w, s) => at(w, s, 'shrine', 'start', 16, -30) },
  { id: 'camp', label: 'The camp', group: 'Wildwood', set: (w, s) => { wild(s, true); on(w, s, 'wildwood', 50.5, 38.5, 'up') } },
  { id: 'grove', label: 'The grove', group: 'Wildwood', set: (w, s) => { wild(s, true); on(w, s, 'wildwood', 39.5, 9.5, 'up') } },
  { id: 'lab', label: 'Horizon Lab', group: 'Wildwood', set: (w, s) => { wild(s, true); on(w, s, 'lab1', 23.5, 31.5, 'up') } },
]

export function stageScene(id: unknown): StageScene {
  return STAGE_SCENES.find(sc => sc.id === id) ?? STAGE_SCENES[0]!
}
