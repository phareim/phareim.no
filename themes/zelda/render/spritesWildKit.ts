/**
 * Small pure helpers for the Wildwood sprite files (spritesWild*.ts).
 * A copy of the patterns in sprites.ts, kept separate so the Wildwood art
 * never imports sprites.ts (which imports it).
 */

export type Rows = string[]

/** Replace single pixels: [x, y, ch] triples. */
export function edit(src: Rows, ...ops: Array<[number, number, string]>): Rows {
  const out = src.map(r => r.split(''))
  for (const [x, y, ch] of ops) if (out[y] && x >= 0 && x < out[y]!.length) out[y]![x] = ch
  return out.map(r => r.join(''))
}

/** Replace whole rows starting at `y`. */
export function rowsAt(src: Rows, y: number, rows: Rows): Rows {
  const out = src.slice()
  rows.forEach((r, i) => { out[y + i] = r })
  return out
}

export function mirror(src: Rows): Rows {
  return src.map(r => r.split('').reverse().join(''))
}

export function swapChars(src: Rows, map: Record<string, string>): Rows {
  return src.map(r => r.split('').map(ch => map[ch] ?? ch).join(''))
}

/** Shift every pixel down by n rows (top filled transparent, bottom dropped). */
export function shiftDown(src: Rows, n: number): Rows {
  const w = src[0]!.length
  const b = '.'.repeat(w)
  return [...Array(n).fill(b), ...src.slice(0, src.length - n)]
}

/** Shift every pixel right by n columns (negative: left). */
export function shiftX(src: Rows, n: number): Rows {
  return src.map((r) => {
    if (n >= 0) return ('.'.repeat(n) + r).slice(0, r.length)
    return (r.slice(-n) + '.'.repeat(-n))
  })
}

export function blank(w: number, h: number): string[][] {
  return Array.from({ length: h }, () => Array(w).fill('.'))
}

export function join(grid: string[][]): Rows {
  return grid.map(r => r.join(''))
}

/** Paint `src` onto grid `g` at (ox, oy); '.' pixels are skipped. */
export function stamp(g: string[][], src: Rows, ox: number, oy: number): void {
  src.forEach((row, y) => row.split('').forEach((ch, x) => {
    const gy = oy + y
    const gx = ox + x
    if (ch !== '.' && gy >= 0 && gy < g.length && gx >= 0 && gx < g[0]!.length) g[gy]![gx] = ch
  }))
}

/** Tiny deterministic hash for procedural texture. */
export function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296
}

/** Draw a 1-px outline ('k') around every opaque pixel (4-neighbour). */
export function outline(src: Rows, ch = 'k'): Rows {
  const h = src.length
  const w = src[0]!.length
  const g = src.map(r => r.split(''))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (src[y]![x] !== '.') continue
      const n = [src[y - 1]?.[x], src[y + 1]?.[x], src[y]![x - 1], src[y]![x + 1]]
      if (n.some(c => c !== undefined && c !== '.' && c !== ch)) g[y]![x] = ch
    }
  }
  return join(g)
}

/** Rotate 90° clockwise. */
export function rotCW(src: Rows): Rows {
  const h = src.length
  const w = src[0]!.length
  const out: string[] = []
  for (let x = 0; x < w; x++) {
    let row = ''
    for (let y = h - 1; y >= 0; y--) row += src[y]![x]
    out.push(row)
  }
  return out
}
