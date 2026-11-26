/**
 * Lumen tubes as data (Relight the Sign; the rules are `engine/puzzles/tubes.ts`, the design
 * docs/games/neon-shrine-sign.md). A tube's arms are a mask: north 1, east 2, south 4, west 8. The light
 * box chars turn (a quarter clockwise a hit); the double ones are bolted down; a cross turned is itself, so it
 * never turns. `Θ` is a tap, `Λ` a socket. Pure data: the engine, the painters and the validator read it.
 */
import type { TileChar } from '../types'

/** Every tube's arms. */
export const TUBE_ARMS: Readonly<Partial<Record<TileChar, number>>> = {
  '╵': 1, '╶': 2, '╷': 4, '╴': 8,
  '└': 3, '┌': 6, '┐': 12, '┘': 9, '│': 5, '─': 10,
  '├': 7, '┬': 14, '┤': 13, '┴': 11, '┼': 15,
  '╚': 3, '╔': 6, '╗': 12, '╝': 9, '║': 5, '═': 10,
  '╠': 7, '╦': 14, '╣': 13, '╩': 11, '╬': 15,
}

/** The turning tube with these arms. */
const LIGHT: Readonly<Record<number, TileChar>> = {
  1: '╵', 2: '╶', 4: '╷', 8: '╴', 3: '└', 6: '┌', 12: '┐', 9: '┘', 5: '│', 10: '─', 7: '├', 14: '┬', 13: '┤', 11: '┴', 15: '┼',
}

const BOLTED = new Set<TileChar>(['╚', '╔', '╗', '╝', '║', '═', '╠', '╦', '╣', '╩', '╬'])

export const TAP: TileChar = 'Θ'
export const SOCKET: TileChar = 'Λ'

/** Every tile Relight the Sign adds. */
export const TUBE_TILES: ReadonlySet<TileChar> = new Set<TileChar>([...(Object.keys(TUBE_ARMS) as TileChar[]), TAP, SOCKET])

export const isTube = (t: TileChar): boolean => TUBE_ARMS[t] !== undefined
export const armsOf = (t: TileChar): number => TUBE_ARMS[t] ?? 0
/** Does a hit turn this tube? (A bolted one, a cross, anything else: no.) */
export const turns = (t: TileChar): boolean => isTube(t) && !BOLTED.has(t) && t !== '┼'
export const bolted = (t: TileChar): boolean => BOLTED.has(t)

/** The arms turned a quarter clockwise, `n` times. */
export function turnArms(arms: number, n = 1): number {
  let a = arms
  for (let i = 0; i < ((n % 4) + 4) % 4; i++) a = ((a << 1) | (a >> 3)) & 15
  return a
}

/** A turning tube turned a quarter clockwise, `n` times (anything else as it was). */
export function turnTube(t: TileChar, n = 1): TileChar {
  return turns(t) ? LIGHT[turnArms(armsOf(t), n)]! : t
}

/** The four ways from a tile: its step, the arm that way and the arm that answers it. */
export const WAYS: ReadonlyArray<{ dx: number; dy: number; arm: number; back: number }> = [
  { dx: 0, dy: -1, arm: 1, back: 4 },
  { dx: 1, dy: 0, arm: 2, back: 8 },
  { dx: 0, dy: 1, arm: 4, back: 1 },
  { dx: -1, dy: 0, arm: 8, back: 2 },
]
