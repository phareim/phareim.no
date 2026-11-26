/**
 * The arts' icons (16×16, `engine/moves.ts`): on the B box and button, held up when one is learned, and on the
 * pause screen's MOVES page. Drawn from shapes, outlined in the shared dark, in the shared palette. Original designs.
 */
import { type Rows, blank, join, outline, stamp } from './spritesWildKit'

/** Fill every px of a 16×16 grid whose centre `f` gives a letter for (null: leave it). */
function paint(f: (x: number, y: number) => string | null): string[][] {
  const g = blank(16, 16)
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const ch = f(x + 0.5, y + 0.5); if (ch) g[y]![x] = ch }
  return g
}

/** PULSE: a palm pushing, three arcs of the wave running off it. */
const PALM: Rows = [
  '.kk...',
  'kssk..',
  'kssskk',
  'ksssss',
  'ksssSs',
  'kssSSk',
  'ksSSk.',
  '.kkk..',
]
const itemPulse: Rows = (() => {
  const g = paint((x, y) => {
    const dx = x - 3
    const dy = y - 8
    const d = Math.hypot(dx, dy)
    if (dx <= 0 || Math.abs(Math.atan2(dy, dx)) > 0.95) return null
    if (Math.abs(d - 6.2) < 0.75) return 'w'
    if (Math.abs(d - 9) < 0.7) return 'c'
    if (Math.abs(d - 11.8) < 0.7) return 'C'
    return null
  })
  const out = outline(join(g)).map(r => r.split(''))
  stamp(out, PALM, 0, 4)
  return join(out)
})()

/** FLASH STEP: one long cut corner to corner, white-hot in the middle, with the step's shadows trailing it. */
const itemFlash: Rows = (() => {
  const g = paint((x, y) => {
    // Along the line from (2, 14) to (14, 2): its distance across, and how far along.
    const u = (x - 2 + (14 - y)) / Math.SQRT2 / (12 * Math.SQRT2)
    const v = Math.abs((x - 2) - (14 - y)) / Math.SQRT2
    if (u < 0 || u > 1) return null
    const w = 0.35 + 0.9 * Math.sin(u * Math.PI)
    if (v < w * 0.55) return 'w'
    if (v < w + 0.2) return u > 0.5 ? 'c' : 'C'
    return null
  })
  // Two chevrons behind, where the hero was.
  for (const [x, y] of [[3, 7], [4, 6], [5, 7], [7, 11], [8, 10], [9, 11]] as const) g[y]![x] = 'c'
  return outline(join(g))
})()

/** STARFALL: a gold star coming down, a pink trail behind it. */
const STAR: Rows = [
  '.....k.....',
  '....kyk....',
  '....kyk....',
  'kkkkyeykkkk',
  'kyyyewwyyyk',
  '.kyyywwyyk.',
  '..kyyyyyk..',
  '..kyyYyyk..',
  '.kyYk.kYyk.',
  '.kkk...kkk.',
]
const itemStar: Rows = (() => {
  const g = blank(16, 16)
  // The trail: a band down from the top left, pale near the star, deep at its tail.
  for (let i = 0; i < 9; i++) {
    const ch = i < 3 ? 'P' : i < 6 ? 'p' : 'm'
    for (const w of [0, 1]) { const x = 1 + i + w; const y = 1 + i; if (x < 16 && y < 16) g[y]![x] = ch }
  }
  const out = outline(join(g)).map(r => r.split(''))
  stamp(out, STAR, 5, 5)
  return join(out)
})()

/** HALO: a ring seen at a slant, three sparks riding it. */
const itemHalo: Rows = (() => {
  const g = paint((x, y) => {
    const dx = (x - 8) / 6.4
    const dy = (y - 9) / 4.2
    const d = Math.hypot(dx, dy)
    if (Math.abs(d - 1) < 0.17) return y < 9 ? 'C' : 'c'
    return null
  })
  const spark: Rows = ['.w.', 'www', '.w.']
  const out = outline(join(g)).map(r => r.split(''))
  for (const [x, y] of [[1, 7], [11, 11], [10, 3]] as const) {
    stamp(out, spark, x, y)
    for (const [ox, oy] of [[1, -1], [-1, 1], [1, 3], [3, 1], [0, 0], [2, 0], [0, 2], [2, 2]]) {
      const px = x + ox!
      const py = y + oy!
      if (out[py]?.[px] === '.') out[py]![px] = 'k'
    }
  }
  return join(out)
})()

export const ARTS_ICONS: Record<string, Rows> = {
  item_pulse: itemPulse,
  item_flash: itemFlash,
  item_star: itemStar,
  item_halo: itemHalo,
}
