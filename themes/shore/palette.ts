/**
 * Another Shore II — palettes.
 *
 * Sixteen entries per palette, like the Amiga original: indices 0–7 are the
 * base hues, 8–15 the lit variant of the same hue (index + 8). A moonlit
 * rock face uses the lit index of its rock, never a new colour. The moon is
 * the lit skin (14): the figure's face and the sky's highlight share a slot.
 *
 * Every fill in the renderer goes through one of these arrays. Light events
 * are palette swaps: the four named palettes are the four acts of the
 * crossing, `dim()` is pause, `flash()` is lightning.
 */

export const SKY = 0
export const FAR = 1
export const MID = 2
export const NEAR = 3
export const SEA = 4
export const GROUND = 5
export const SKIN = 6
export const SHIRT = 7
export const LIT = 8

export type Palette = readonly string[]

/** dusk: warm grey sky, the shirt almost matches it, the moon barely there. */
const dusk: Palette = [
  '#7a6f78', // 0 sky
  '#5a525f', // 1 far rock
  '#3f3945', // 2 mid rock
  '#1c191e', // 3 near rock
  '#575a68', // 4 sea
  '#2c272f', // 5 ground
  '#c7b39a', // 6 skin
  '#8f6f78', // 7 shirt (almost the sky)
  '#978a93', // 8 lit sky
  '#6f6775', // 9 lit far
  '#544c5b', // 10 lit mid
  '#2b272f', // 11 lit near
  '#6d707e', // 12 lit sea
  '#3c3641', // 13 lit ground
  '#9d9099', // 14 lit skin (the moon, barely there)
  '#a98590', // 15 lit shirt
]

/** night: the petrol shore. */
const night: Palette = [
  '#1f414f', // 0 sky
  '#2b5364', // 1 far rock
  '#193440', // 2 mid rock
  '#0a161c', // 3 near rock
  '#173743', // 4 sea
  '#0f2029', // 5 ground
  '#e2d0ad', // 6 skin
  '#d9836a', // 7 shirt (coral, the accent)
  '#2f5c6d', // 8 lit sky
  '#3b6c7f', // 9 lit far
  '#26495a', // 10 lit mid
  '#16262e', // 11 lit near
  '#2c5868', // 12 lit sea (the tide band)
  '#1c3641', // 13 lit ground
  '#f4e8cb', // 14 lit skin (the moon)
  '#eea283', // 15 lit shirt
]

/** storm: one step darker; the lit ramp is pale so a lightning frame reads. */
const storm: Palette = [
  '#152d38', // 0 sky
  '#1e3a47', // 1 far rock
  '#11242e', // 2 mid rock
  '#060f14', // 3 near rock
  '#102730', // 4 sea
  '#0a161c', // 5 ground
  '#c9b899', // 6 skin
  '#b96e5a', // 7 shirt
  '#4a6b78', // 8 lit sky
  '#3f5f6c', // 9 lit far
  '#2a4652', // 10 lit mid
  '#152229', // 11 lit near
  '#3d6472', // 12 lit sea
  '#1b313a', // 13 lit ground
  '#eadfc3', // 14 lit skin
  '#d8917a', // 15 lit shirt
]

/** dawn at the lamp: the sky takes the skin tone; the figure's face becomes the sky. */
const dawn: Palette = [
  '#e2d0ad', // 0 sky = skin
  '#7c6a80', // 1 far rock
  '#4d4258', // 2 mid rock
  '#1d1a22', // 3 near rock
  '#8a8ca0', // 4 sea
  '#2e2834', // 5 ground
  '#e2d0ad', // 6 skin = sky
  '#d9836a', // 7 shirt
  '#f0e2c4', // 8 lit sky
  '#978398', // 9 lit far
  '#645770', // 10 lit mid
  '#2c2833', // 11 lit near
  '#a5a6b8', // 12 lit sea
  '#3f3846', // 13 lit ground
  '#fbf3df', // 14 lit skin
  '#f0a58a', // 15 lit shirt
]

export const PALETTES: readonly Palette[] = [dusk, night, storm, dawn]
export const PALETTE_NAMES = ['dusk', 'night', 'storm', 'dawn'] as const

/** Flash white: what a lit index becomes in the all-lit lightning frame. */
const FLASH_WHITE = '#e8eef0'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')
  return `#${c(r)}${c(g)}${c(b)}`
}

/** Pause: every index one step darker. */
export function dim(p: Palette): Palette {
  return p.map((hex) => {
    const [r, g, b] = hexToRgb(hex)
    return rgbToHex(r * 0.62, g * 0.62, b * 0.62)
  })
}

/** Lightning: every base index shows its lit colour; lit indices go white. */
export function flash(p: Palette): Palette {
  const out: string[] = []
  for (let i = 0; i < 8; i++) out[i] = p[i + 8]
  for (let i = 8; i < 16; i++) out[i] = FLASH_WHITE
  return out
}
