/**
 * The physical puzzles' tiles as data (the rules are in `engine/puzzles/`):
 * which chars are puzzle tiles, which are floors a block may cover, and the
 * tile a puzzle mark stands on when it names none. Pure data; the engine, the
 * renderer and the validator read it.
 */
import type { EntDef, TileChar } from '../types'

/** Every tile the physical puzzles add. A map with any of them runs the puzzle rules. */
export const PUZZLE_TILES: ReadonlySet<TileChar> = new Set<TileChar>(['α', 'β', 'μ', 'ν', 'π', 'ρ', 'θ', 'η', 'σ', 'κ', 'ω', 'ψ', 'ξ'])

/** Floors that come back when what stood on them moves away (the base layer remembers them). */
export const PUZZLE_FLOORS: ReadonlySet<TileChar> = new Set<TileChar>(['α', 'θ', 'η', 'σ', 'ω', 'ψ'])

/** Plates that weigh what stands on them, and the weight each needs (a scale pan: equal weight on all its pans). */
export const WEIGHT_PLATES: Readonly<Partial<Record<TileChar, number>>> = { 'θ': 1, 'η': 2, 'σ': 1 }

export const isMirror = (t: TileChar) => t === 'μ' || t === 'ν'

/** The tile a puzzle mark stands on when it names none. */
export function puzzleMarkTile(e: EntDef): TileChar | null {
  switch (e.t) {
    case 'emitter': return 'β'
    case 'receiver': return 'ρ'
    case 'boulder': return 'κ'
    case 'sluice': return e.invert ? 'ψ' : 'ω'
    case 'valve': return 'ξ'
    default: return null
  }
}
