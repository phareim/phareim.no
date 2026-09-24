/**
 * Tile behaviour. One table, read by the engine (collision, cutting,
 * lifting, bombing) and the validator. The look is the renderer's business.
 */
import type { TileChar } from '../types'

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
  x: { ...OPEN, hurt: true },
  O: { ...OPEN, pit: true },
  t: { ...LOW, light: true },
  S: LOW,
  G: S,
  F: LOW,
  H: S,
  D: OPEN,
  '>': OPEN,
  $: LOW,
  n: LOW,
  I: S,
  M: { ...S, light: true },
  Z: LOW,
  '[': S,
  '(': LOW,
  w: LOW,
  Y: LOW,
  i: OPEN,
  f: OPEN,
  '^': S,
}

export const TILE_CHARS = Object.keys(TILE_INFO) as TileChar[]

export function isTileChar(ch: string): ch is TileChar {
  return Object.prototype.hasOwnProperty.call(TILE_INFO, ch)
}
