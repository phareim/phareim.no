/**
 * The world's named colours in this look. World data names a `Tone`
 * (`types.ts`); a view with another palette brings its own table.
 */
import type { Ambience, Tone } from '../types'

export const TONES: Record<Tone, string> = {
  pink: '#ff2fa0',
  cyan: '#2ff3ff',
  violet: '#9a4ff0',
  gold: '#ffd23f',
  rose: '#ff5fd0',
}

/** Light-map base colour of a room that names its own light level. */
export const AMBIENCE: Record<Ambience, string> = {
  dim: '#8a76b8',
}
