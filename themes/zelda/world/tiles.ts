/**
 * Tile behaviour. One table, read by the engine (collision, cutting,
 * lifting, bombing) and the validator. The look is the renderer's business.
 */
import type { TileChar, ViewSide } from '../types'

export interface TileInfo {
  /** Blocks walkers. */
  solid: boolean
  /** Blocks flying things (projectiles, the disc, thrown pots). */
  wall: boolean
  cut?: boolean // sword/spin/bomb removes it
  lift?: 'pot' | 'rock'
  bomb?: boolean // a blast removes it for good
  hurt?: boolean
  pit?: boolean
  light?: boolean
  /** The grappling hook bites into it and reels the hero over. */
  hook?: boolean
  /** Static vines: only the Arc Blade cuts them. */
  vine?: boolean
}

const S = { solid: true, wall: true }
const LOW = { solid: true, wall: false } // blocks walking, not flight
const OPEN = { solid: false, wall: false }

export const TILE_INFO: Record<TileChar, TileInfo> = {
  '.': OPEN,
  ',': OPEN,
  ':': OPEN,
  ';': { ...OPEN, cut: true },
  '*': { ...LOW, cut: true },
  T: S,
  '#': S,
  '~': LOW,
  '=': OPEN,
  o: { ...LOW, lift: 'pot' },
  r: { ...LOW, lift: 'rock' },
  R: { ...S, bomb: true },
  '%': { ...S, bomb: true },
  L: S,
  K: S,
  X: S,
  b: S,
  _: OPEN,
  c: LOW,
  P: LOW,
  C: LOW,
  // The view blocks, as they stand when up: a wall. Whether one is up is the view's to say (`blockUp`); every read
  // that can meet one asks that (`engine/map.ts` `solidTile`).
  '□': S,
  '◇': S,
  x: { ...OPEN, hurt: true },
  O: { ...OPEN, pit: true },
  t: { ...LOW, light: true, hook: true },
  S: LOW,
  G: S,
  F: LOW,
  H: S,
  D: OPEN,
  '>': OPEN,
  $: { ...LOW, hook: true },
  n: LOW,
  I: { ...S, hook: true },
  M: { ...S, light: true },
  Z: LOW,
  '[': S,
  '(': LOW,
  w: LOW,
  Y: LOW,
  i: OPEN,
  f: OPEN,
  '^': S,
  '|': { ...LOW, hook: true },
  l: { ...S, vine: true },
  B: S,
  '{': OPEN,
  '}': LOW,
  '-': OPEN,
  q: S,
  '¤': LOW,
  // Terrain (`engine/terrain.ts`): open to the tile table; a map's heights do the blocking.
  а: OPEN, б: OPEN, в: OPEN, д: OPEN, е: OPEN, ж: OPEN, з: OPEN, и: OPEN, й: OPEN, к: OPEN,
  // Physical puzzles (world/puzzles.ts, engine/puzzles/)
  'α': OPEN,
  'β': S,
  'μ': LOW,
  'ν': LOW,
  'π': LOW,
  'ρ': LOW,
  'θ': OPEN,
  'η': OPEN,
  'σ': OPEN,
  'κ': S,
  'ω': LOW,
  'ψ': OPEN,
  'ξ': LOW,
  // The Lighthouse: the storm lamp set down, and the Black Box's pedestal (low: they stop walkers and beams, not shots or sight)
  'Φ': LOW,
  'Ξ': LOW,
  // Lumen tubes (world/tubes.ts, engine/puzzles/tubes.ts): walked over; the tap and the socket stand.
  '╵': OPEN, '╶': OPEN, '╷': OPEN, '╴': OPEN,
  '│': OPEN, '─': OPEN, '┌': OPEN, '┐': OPEN, '└': OPEN, '┘': OPEN, '├': OPEN, '┤': OPEN, '┬': OPEN, '┴': OPEN, '┼': OPEN,
  '║': OPEN, '═': OPEN, '╔': OPEN, '╗': OPEN, '╚': OPEN, '╝': OPEN, '╠': OPEN, '╣': OPEN, '╦': OPEN, '╩': OPEN, '╬': OPEN,
  'Θ': LOW,
  'Λ': LOW,
}

export const TILE_CHARS = Object.keys(TILE_INFO) as TileChar[]

/** The square block and the diamond block: the tiles the view makes solid or floor. */
export const SQUARE_BLOCK = '□' as const
export const DIAMOND_BLOCK = '◇' as const
export const isViewBlock = (t: TileChar): t is typeof SQUARE_BLOCK | typeof DIAMOND_BLOCK => t === SQUARE_BLOCK || t === DIAMOND_BLOCK

/**
 * THE answer to "is this block up", for everything that moves, looks or draws: a square block is up in the 8-bit
 * view only, a diamond block in the isometric view only. False for any other tile.
 */
export function blockUp(t: TileChar, view: ViewSide): boolean {
  return view === 'flat' ? t === SQUARE_BLOCK : t === DIAMOND_BLOCK
}

export function isTileChar(ch: string): ch is TileChar {
  return Object.prototype.hasOwnProperty.call(TILE_INFO, ch)
}
