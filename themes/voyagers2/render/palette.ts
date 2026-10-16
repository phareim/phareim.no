/**
 * Space Voyagers II: the colours. Every material of a model is a ramp of
 * four tones, shadow to light, and the light picks one: shadows lean
 * blue-violet, lights lean warm (nova's style block). Nothing is black; the
 * darkest tone is a blue-brown. The 2D parts (cockpit, HUD) use `C`.
 */

export type Ramp = readonly [string, string, string, string]

/** Material ids, in the order of `RAMPS` (the shader indexes the ramps by these). */
export const M = {
  white: 0, red: 1, wood: 2, glass: 3, steel: 4, glow: 5, mustard: 6, brown: 7, cream: 8, mred: 9,
  brick: 10, pan: 11, crust: 12, gold: 13, orange: 14, dark: 15,
} as const
export type MaterialId = (typeof M)[keyof typeof M]

export const RAMPS: readonly Ramp[] = [
  /* white */ ['#4e4866', '#9a92ae', '#d8d0cc', '#fff6e0'],
  /* red */ ['#3e1630', '#8c1e36', '#cc3a36', '#ff7a52'],
  /* wood */ ['#38201c', '#663418', '#9a5624', '#cc8838'],
  /* glass */ ['#141a33', '#24305a', '#3f5a8c', '#9fc4dc'],
  /* steel */ ['#262636', '#464c66', '#767e9c', '#b4bccc'],
  /* glow */ ['#c8501e', '#ff8a3d', '#ffc45c', '#fff1b0'],
  /* mustard */ ['#46321c', '#86621e', '#c8962c', '#f2ca52'],
  /* brown */ ['#2a1c22', '#4c3026', '#784a30', '#a66e46'],
  /* cream */ ['#56484c', '#968478', '#ccb89c', '#f4e2c2'],
  /* mred (mascot details) */ ['#381428', '#761c2e', '#bc2e3e', '#ee5c56'],
  /* brick */ ['#36181e', '#682a26', '#9c4232', '#cc6c4a'],
  /* pan */ ['#222230', '#40425a', '#686c88', '#9aa0b6'],
  /* crust */ ['#46281c', '#84502a', '#c4863e', '#eebc6c'],
  /* gold */ ['#463018', '#8a6218', '#cea030', '#fff0a0'],
  /* orange */ ['#441c16', '#88341a', '#cc5a26', '#ff9050'],
  /* dark */ ['#16141e', '#22202e', '#302c40', '#423c56'],
]

/** The ink of every outline. */
export const INK = '#120d18'

/** Space behind each act: the base and three star tones, far to near. */
export const SPACE: readonly { base: string; far: string; mid: string; near: string }[] = [
  { base: '#141a33', far: '#2a3358', mid: '#4a5a8c', near: '#b0bcd8' },
  { base: '#1c1a2c', far: '#3a3048', mid: '#6a5868', near: '#d0b8a8' },
  { base: '#1a1230', far: '#32204e', mid: '#563a7c', near: '#b8a0d8' },
]

export const C = {
  text: '#fff6e0',
  textDim: '#a89cb4',
  textLo: '#5c5070',
  gold: '#ffd23f',
  red: '#ff4f6e',
  redLo: '#8c2a44',
  green: '#7ad66a',
  greenLo: '#2c5a34',
  blue: '#8fc4ff',
  blueLo: '#3a5a9c',
  orange: '#ff9a4a',
  // The HUD on the view.
  sight: '#ffe9b0',
  enemy: '#ff5a5a',
  enemyLo: '#9c2a3a',
  friend: '#8fc4ff',
  big: '#ffa24a',
  nav: '#fff6e0',
  lead: '#ffe27a',
  lock: '#ff4f6e',
  // Bolts.
  bolt: '#ffe27a',
  boltCore: '#fff6e0',
  turretBolt: '#ff9a4a',
  enemyBolt: '#ff4f6e',
  enemyBoltCore: '#ffd0b0',
  // The dashboard.
  wood: '#7a4018',
  woodHi: '#a85a24',
  woodLo: '#4e2812',
  woodGrain: '#64341a',
  bakelite: '#2a2028',
  bakeliteHi: '#4a3a44',
  bezel: '#5a5a6c',
  bezelHi: '#9a9cb0',
  bezelLo: '#2e2e3c',
  crt: '#0f1a1c',
  crtHi: '#1c3236',
  phosphor: '#9cf08a',
  phosphorLo: '#3c7a44',
  amber: '#ffb84a',
  amberLo: '#7a4a1c',
  lampOff: '#3a2a2c',
  face: '#f0e2b4',
  faceLo: '#b8a070',
  needle: '#b0221e',
  shield: '#8fd0ff',
  shieldLo: '#3a6aa8',
  armour: '#ffd23f',
  armourLo: '#8a6a1c',
  core: '#ff7a52',
} as const

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}
