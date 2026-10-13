/**
 * Space Voyagers: the flat colours the code draws with. Nothing here is
 * black: the darkest tone is a blue-brown. A lighter tone is light, a darker
 * one is shadow; nothing is blended (DESIGN.md, "The picture").
 */

export const INK = '#120d18'
export const WHITE = '#fff6e0'

/** The field behind each sector: base, and three star tones from far to near. */
export const SKY: readonly { base: string; far: string; mid: string; near: string }[] = [
  { base: '#141a33', far: '#2a3358', mid: '#4a5a8c', near: '#8f9fca' },
  { base: '#1c1a2c', far: '#3a3048', mid: '#6a5868', near: '#b09a8c' },
  { base: '#261628', far: '#4a2444', mid: '#7c3c5c', near: '#c8788c' },
  { base: '#181c22', far: '#2e3640', mid: '#4c5a66', near: '#8a98a2' },
  { base: '#1a1230', far: '#32204e', mid: '#563a7c', near: '#9a7cc0' },
]

export const C = {
  // Ours.
  bolt: '#ffe27a',
  boltCore: WHITE,
  disc: '#9fe8ff',
  discCore: WHITE,
  bass: '#ff8a3d',
  bassLo: '#c8501e',
  wing: '#ff7ab8',
  // Theirs: bright, so they read on every backdrop.
  enemyBolt: '#ff4f6e',
  enemyCore: '#ffd0b0',
  aimed: '#ffb02e',
  mine: '#c8c8d2',
  mineLo: '#6c6c7c',
  note: '#b48cff',
  ring: '#ff9a4a',
  warn: '#ff4f6e',
  warnLo: '#8c2a44',
  live: '#fff6e0',
  liveLo: '#ffb02e',
  // Things.
  bubble: '#bfeaff',
  beam: '#9fe8ff',
  beamLo: '#3f7ca8',
  cloud: '#e8d8f0',
  cable: '#ffd23f',
  cableLo: '#b0421e',
  cargo: '#7ad66a',
  cargoLo: '#2c5a34',
  barBack: '#3a2c3c',
  frost: '#d8f0ff',
  door: '#8a98a2',
  doorLo: '#4c5a66',
  doorHi: '#c4d0d8',
  // Words.
  text: WHITE,
  textDim: '#a89cb4',
  gold: '#ffd23f',
  pink: '#ff7ab8',
  red: '#ff4f6e',
  green: '#7ad66a',
  // The console drawn by code.
  wood: '#8a4a1c',
  woodHi: '#b8692a',
  woodLo: '#5c2e14',
  metal: '#52607c',
  metalHi: '#8090ac',
  metalLo: '#343e58',
  glass: '#161a30',
  glassHi: '#262c4a',
  face: '#f0e2b4',
  faceLo: '#b8a070',
  needle: '#b0221e',
  desk: '#1c1420',
  placeholder: '#5a4a6a',
  placeholderHi: '#9a88ac',
} as const

/** One pop's clusters, by what popped (a gang's own colours). */
export const POP: Record<string, readonly [string, string, string]> = {
  glitterati: ['#fff6e0', '#ffd23f', '#ff7ab8'],
  hogs: ['#fff6e0', '#ff8a3d', '#8a4a1c'],
  lovemachines: ['#fff6e0', '#ff7ab8', '#b48cff'],
  chromons: ['#fff6e0', '#c4d0d8', '#ff4f6e'],
  noise: ['#fff6e0', '#b48cff', '#563a7c'],
  boss: ['#fff6e0', '#ffd23f', '#ff8a3d'],
  ours: ['#fff6e0', '#9fe8ff', '#ffd23f'],
}
