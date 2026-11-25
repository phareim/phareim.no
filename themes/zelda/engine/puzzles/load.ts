/**
 * Loading a map: what the save's flags say about its puzzles. Boulders that
 * rolled (`boulder:<map>:<home>:<rest>`, rest -1 when it filled a pit), pits
 * a block or a boulder filled (`fill:<map>:<tile>`), and each sluice group
 * full or drained by its flag. Cracked walls a boulder broke use the bombs'
 * own flags. Called from `loadMap`; a no-op on maps without puzzle tiles.
 */
import type { GameState, TileChar } from '../../types'
import type { MapInfo } from '../map'
import { floorUnder, puzzleFlag, puzzleInfo, sluiceFull } from './info'

export function loadPuzzleTiles(info: MapInfo, s: GameState, tiles: TileChar[]) {
  const p = puzzleInfo(info)
  if (!p.on) return
  const id = info.def.id
  for (const g of p.sluices) {
    const full = sluiceFull(s.flags, g)
    for (const i of g.tiles) if (tiles[i] === 'ω' || tiles[i] === 'ψ') tiles[i] = full ? 'ω' : 'ψ'
  }
  for (const f of Object.keys(s.flags)) {
    const q = puzzleFlag(f, id)
    if (!q) continue
    if ('fill' in q) tiles[q.fill] = '.'
    else {
      if (tiles[q.home] === 'κ') tiles[q.home] = floorUnder(info, p, s.flags, q.home)
      if (q.rest >= 0) tiles[q.rest] = 'κ'
    }
  }
}
