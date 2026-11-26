/**
 * Relight the Sign: lumen gas in glass tubes (docs/games/neon-shrine-sign.md; the tiles are `world/tubes.ts`).
 *
 * A board is tubes laid side by side in the ground with a tap (`Θ`) and a socket (`Λ`) beside them. Gas runs out
 * of the tap into any tube that opens onto it, and on along every pair of arms that meet. An arm that meets
 * nothing that answers it (ground, a wall, a tube turned away) is an open end: the gas hisses out there. A socket
 * the gas reaches through a line with no open end is fed: its flag is set for good, and its letter on Lumenby's hill
 * sign lights.
 *
 * A map's rows hold each board solved, so it reads as it plays; loading the map turns every turning tube of a board
 * whose sockets are not all lit out of true (`scrambleTubes`, the same way each time). A blade, the disc or A turns
 * a tube a quarter clockwise (`hitPuzzle`); `stepTubes` traces the gas again whenever the map changes.
 */
import type { GameState, GasState, TileChar } from '../../types'
import { armsOf, isTube, SOCKET, TAP, turns, turnTube, WAYS } from '../../world/tubes'
import type { Ctx } from '../combat'
import { openDialog } from '../hero'
import type { MapInfo } from '../map'
import { puzzleInfo, type TubeBoard } from './info'

/** Tubes a second the gas runs along a line it has just found (the picture runs it in at this pace). */
export const GAS_SPEED = 14

export interface BoardGas {
  tubes: Array<{ idx: number; arms: number; depth: number }>
  leaks: GasState['leaks']
  /** Sockets the gas reaches, open ends or not. */
  reached: number[]
  /** Sockets fed: reached, with no end open. */
  fed: number[]
}

/** The gas in one board with these tiles (`w` wide): pure. */
export function traceBoard(tiles: readonly TileChar[], w: number, b: TubeBoard): BoardGas {
  const h = Math.floor(tiles.length / w)
  const depth = new Map<number, number>()
  const order: number[] = []
  const at = (i: number, dx: number, dy: number): number => {
    const x = (i % w) + dx
    const y = Math.floor(i / w) + dy
    return x < 0 || y < 0 || x >= w || y >= h ? -1 : y * w + x
  }
  for (const tap of b.taps) for (const way of WAYS) {
    const j = at(tap, way.dx, way.dy)
    if (j < 0 || depth.has(j) || !isTube(tiles[j]!) || !(armsOf(tiles[j]!) & way.back)) continue
    depth.set(j, 1)
    order.push(j)
  }
  const leaks: GasState['leaks'] = []
  const reached = new Set<number>()
  for (let k = 0; k < order.length; k++) {
    const i = order[k]!
    const arms = armsOf(tiles[i]!)
    for (const way of WAYS) {
      if (!(arms & way.arm)) continue
      const j = at(i, way.dx, way.dy)
      const t = j < 0 ? null : tiles[j]!
      if (t === TAP) continue
      if (t === SOCKET) { reached.add(j); continue }
      if (t && isTube(t) && armsOf(t) & way.back) {
        if (!depth.has(j)) { depth.set(j, depth.get(i)! + 1); order.push(j) }
        continue
      }
      leaks.push({ idx: i, dx: way.dx, dy: way.dy })
    }
  }
  const tubes = order.map(idx => ({ idx, arms: armsOf(tiles[idx]!), depth: depth.get(idx)! }))
  const r = [...reached].sort((a, z) => a - z)
  return { tubes, leaks, reached: r, fed: leaks.length ? [] : r }
}

/** Is the board solved as these tiles stand: every socket of it fed? */
export function boardSolved(tiles: readonly TileChar[], w: number, b: TubeBoard): boolean {
  if (!b.sockets.length) return false
  const fed = traceBoard(tiles, w, b).fed
  return b.sockets.every(i => fed.includes(i))
}

function hash(id: string, i: number): number {
  let h = (i * 374761393) | 0
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 2654435761)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Has every socket of this board been lit (its flag set)? */
export function boardLit(info: MapInfo, flags: GameState['flags'], b: TubeBoard): boolean {
  const p = puzzleInfo(info)
  return b.sockets.length > 0 && b.sockets.every(i => flags[p.sockets.get(i)?.flag ?? ''] === true)
}

/**
 * A map being loaded (`loadPuzzleTiles`): every board not yet lit has its turning tubes turned out of true, each by
 * a quarter, a half or three quarters (a straight one by an odd number), the same way every time; if that left it
 * solved, tubes are turned on one by one until it is not.
 */
export function scrambleTubes(info: MapInfo, flags: GameState['flags'], tiles: TileChar[]) {
  const p = puzzleInfo(info)
  const id = info.def.id
  for (const b of p.boards) {
    if (boardLit(info, flags, b)) continue
    const turning = b.tubes.filter(i => turns(tiles[i]!))
    for (const i of turning) {
      const t = tiles[i]!
      const straight = armsOf(t) === 5 || armsOf(t) === 10
      const k = straight ? (hash(id, i) < 0.5 ? 1 : 3) : 1 + Math.floor(hash(id, i) * 3)
      tiles[i] = turnTube(t, k)
    }
    for (let n = 0; n < turning.length && boardSolved(tiles, info.w, b); n++) tiles[turning[n]!] = turnTube(tiles[turning[n]!]!)
  }
}

/**
 * Each step, once the map has changed: trace the gas in every board. A tube the gas finds anew fills from where the
 * gas already was; a socket fed for the first time sets its flag and lights its letter.
 */
export function stepTubes(c: Ctx) {
  const p = puzzleInfo(c.info)
  if (!p.boards.length) return
  const s = c.s
  const m = s.map
  const ph = m.phys!
  if (ph.gas && ph.gas.v === m.version) return
  const before = new Map((ph.gas?.tubes ?? []).map(t => [t.idx, t]))
  const tubes: GasState['tubes'] = []
  const leaks: GasState['leaks'] = []
  const fed: number[] = []
  const fresh: Array<{ idx: number; arms: number; depth: number }> = []
  for (const b of p.boards) {
    const g = traceBoard(m.tiles, m.w, b)
    leaks.push(...g.leaks)
    fed.push(...g.fed)
    for (const t of g.tubes) {
      const old = before.get(t.idx)
      if (old && old.arms === t.arms) tubes.push({ ...t, t0: old.t0 })
      else fresh.push(t)
    }
  }
  // What is new fills from the nearest of it outward, from now.
  const d0 = Math.min(...fresh.map(t => t.depth))
  for (const t of fresh) tubes.push({ ...t, t0: s.elapsed + (t.depth - d0) / GAS_SPEED })
  ph.gas = { v: m.version, tubes, leaks, fed }
  const lit: string[] = []
  for (const i of fed) {
    const so = p.sockets.get(i)
    if (!so || s.flags[so.flag]) continue
    s.flags[so.flag] = true
    c.ev.push({ type: 'plate', x: (i % m.w) + 0.5, y: Math.floor(i / m.w) + 0.5 })
    c.ev.push({ type: 'secret' })
    if (so.letter) lit.push(so.letter)
  }
  if (lit.length) {
    const letters = [...p.sockets.values()].filter(so => so.letter)
    const n = letters.filter(so => s.flags[so.flag]).length
    const lines = lit.map(l => `THE ${l} ON THE HILL SIGN LIGHTS UP! (${n}/${letters.length})`)
    if (n === letters.length) lines.push('EVERY LETTER IS LIT. GUNN AT THE UNION HALL WILL WANT TO SEE THIS.')
    openDialog(c, lines, null)
  }
}

/** What A on a tap or a socket says (null: neither). */
export function tubeWords(c: Ctx, idx: number, t: TileChar): string[] | null {
  if (t === TAP) return ['A LUMEN TAP. THE GAS STILL RUNS IN IT, WITH NOWHERE TO GO BUT THE TUBES.']
  if (t !== SOCKET) return null
  const so = puzzleInfo(c.info).sockets.get(idx)
  const name = so?.letter ? `THE ${so.letter}'S LINE UP THE HILL` : 'A LINE UP THE HILL'
  if (so && c.s.flags[so.flag]) return [`${name}. IT HUMS, WARM.`]
  return [`${name}, COLD.`, 'TURN THE TUBES WITH {A} TILL THE GAS RUNS FROM THE TAP TO HERE, WITH NO END LEFT OPEN.']
}
