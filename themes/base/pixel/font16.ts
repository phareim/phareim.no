/**
 * Neon Shrine — the 16-bit view's lettering: a proportional dialog font twice
 * as fine as the 5×7 one. Capitals are twelve rows high, uprights two pixels
 * wide and crossbars one, corners cut round: the build of a console RPG's
 * text box from the early nineties. It is drawn light with a one-pixel dark
 * shadow to the right and below.
 *
 * Same letters as font.ts, uppercase only (drawText16 upper-cases its input).
 * Glyphs are twelve rows of '#'/'.'; the advance is the glyph's width + 2 px,
 * so a clear column stays between one letter's shadow and the next letter.
 * No glyph advances further than its 5×7 twin does at twice the size, so a
 * line that fits a box in that font fits it in this one (the tests hold it
 * to that).
 * ABOVE holds the rows over the cap height (Å's ring, É's accent), BELOW the
 * ones under the baseline (a comma's tail).
 *
 * One font pixel is one pixel of the canvas by default; a HUD laid out in
 * classic pixels on a canvas scaled 2× passes `unit` 0.5.
 */

/** Rows in a capital. */
export const CAP16 = 12
/** The line box layout gives this font: the 5×7 font's seven rows at twice the density. The capitals sit one pixel down in it. */
export const LINE16 = 14
/** Clear pixels between two glyphs (one of them takes the shadow). */
const GAP = 2

/** `rows` from row `top` on, in a twelve-row glyph that is blank elsewhere. */
function at(top: number, rows: string[]): string[] {
  const blank = '.'.repeat(rows[0]!.length)
  const out: string[] = []
  for (let r = 0; r < CAP16; r++) out.push(rows[r - top] ?? blank)
  return out
}

/** `n` copies of a row. */
function x(n: number, row: string): string[] {
  return Array.from({ length: n }, () => row)
}

const G: Record<string, string[]> = {
  A: ['...##...', '...##...', '..####..', '..####..', '.##..##.', '.##..##.', '.##..##.', '##....##', '########', '##....##', '##....##', '##....##'],
  B: ['######..', '##...##.', '##....##', '##....##', '##...##.', '######..', '##...##.', '##....##', '##....##', '##....##', '##...##.', '######..'],
  C: ['..####..', '.##..##.', '##....##', ...x(6, '##......'), '##....##', '.##..##.', '..####..'],
  D: ['######..', '##...##.', ...x(8, '##....##'), '##...##.', '######..'],
  E: ['#######', ...x(4, '##.....'), '######.', ...x(5, '##.....'), '#######'],
  F: ['#######', ...x(4, '##.....'), '######.', ...x(6, '##.....')],
  G: ['..####..', '.##..##.', '##....##', '##......', '##......', '##......', '##..####', '##....##', '##....##', '##....##', '.##..##.', '..####..'],
  H: [...x(5, '##....##'), '########', ...x(6, '##....##')],
  I: ['####', ...x(10, '.##.'), '####'],
  J: [...x(8, '.....##'), '##...##', '##...##', '.##.##.', '..###..'],
  K: ['##....##', '##...##.', '##...##.', '##..##..', '##.##...', '####....', '####....', '##.##...', '##..##..', '##...##.', '##...##.', '##....##'],
  L: [...x(11, '##.....'), '#######'],
  M: ['##......##', '###....###', '###....###', '####..####', '##.#..#.##', '##.####.##', '##..##..##', '##..##..##', ...x(4, '##......##')],
  N: ['##....##', '###...##', '###...##', '####..##', '##.#..##', '##.##.##', '##.##.##', '##..#.##', '##..####', '##...###', '##...###', '##....##'],
  O: ['..####..', '.##..##.', ...x(8, '##....##'), '.##..##.', '..####..'],
  P: ['######..', '##...##.', '##....##', '##....##', '##....##', '##...##.', '######..', ...x(5, '##......')],
  Q: ['..####..', '.##..##.', ...x(6, '##....##'), '##..#.##', '##..####', '.##..##.', '..###.##'],
  R: ['######..', '##...##.', '##....##', '##....##', '##...##.', '######..', '##.##...', '##..##..', '##..##..', '##...##.', '##...##.', '##....##'],
  S: ['..####..', '.##..##.', '##....##', '##......', '.##.....', '..####..', '.....##.', '......##', '......##', '##....##', '.##..##.', '..####..'],
  T: ['########', ...x(11, '...##...')],
  U: [...x(10, '##....##'), '.##..##.', '..####..'],
  V: [...x(4, '##....##'), ...x(4, '.##..##.'), '..####..', '..####..', '...##...', '...##...'],
  W: [...x(4, '##......##'), '##..##..##', '##..##..##', '##.####.##', '##.#..#.##', '####..####', '###....###', '###....###', '##......##'],
  X: ['##....##', '##....##', '.##..##.', '.##..##.', '..####..', '...##...', '...##...', '..####..', '.##..##.', '.##..##.', '##....##', '##....##'],
  Y: ['##....##', '##....##', '.##..##.', '.##..##.', '..####..', '..####..', ...x(6, '...##...')],
  Z: ['########', '......##', '.....##.', '.....##.', '....##..', '...##...', '...##...', '..##....', '.##.....', '.##.....', '##......', '########'],
  'Æ': ['...#######', '..####....', '..####....', '..####....', '.##.##....', '.##.#####.', '.##.##....', '.##.##....', '######....', '##..##....', '##..##....', '##..######'],
  'Ø': ['..####.#', '.##..##.', '##...###', '##...###', '##..#.##', '##..#.##', '##.#..##', '##.#..##', '###...##', '###...##', '.##..##.', '#.####..'],
  'Å': ['...##...', '...##...', '..####..', '..####..', '.##..##.', '.##..##.', '.##..##.', '##....##', '########', '##....##', '##....##', '##....##'],
  0: ['..###..', '.##.##.', ...x(8, '##...##'), '.##.##.', '..###..'],
  1: ['..##..', '.###..', '####..', ...x(8, '..##..'), '######'],
  2: ['..###..', '.##.##.', '##...##', '.....##', '.....##', '....##.', '...##..', '..##...', '.##....', '##.....', '##.....', '#######'],
  3: ['..###..', '.##.##.', '##...##', '.....##', '....##.', '..###..', '....##.', '.....##', '.....##', '##...##', '.##.##.', '..###..'],
  4: ['....##.', '...###.', '...###.', '..#.##.', '.##.##.', '.#..##.', '##..##.', '#######', ...x(4, '....##.')],
  5: ['#######', '##.....', '##.....', '##.....', '#####..', '....##.', '.....##', '.....##', '.....##', '##...##', '.##.##.', '..###..'],
  6: ['..###..', '.##.##.', '##.....', '##.....', '##.##..', '###.##.', ...x(4, '##...##'), '.##.##.', '..###..'],
  7: ['#######', '.....##', '.....##', '....##.', '....##.', '...##..', '...##..', ...x(5, '..##...')],
  8: ['..###..', '.##.##.', '##...##', '##...##', '.##.##.', '..###..', '.##.##.', '##...##', '##...##', '##...##', '.##.##.', '..###..'],
  9: ['..###..', '.##.##.', ...x(4, '##...##'), '.##.###', '..##.##', '.....##', '.....##', '.##.##.', '..###..'],
  ' ': x(12, '...'),
  '.': at(10, ['##', '##']),
  ',': at(10, ['.##', '.##']),
  '!': [...x(8, '##'), '..', '..', '##', '##'],
  '?': ['..###..', '.##.##.', '##...##', '.....##', '.....##', '....##.', '...##..', '...##..', '.......', '.......', '...##..', '...##..'],
  "'": at(0, ['##', '##', '.#', '#.']),
  '"': at(0, ['##.##', '##.##', '.#..#', '#..#.']),
  ':': at(3, ['##', '##', '..', '..', '..', '..', '..', '##', '##']),
  ';': at(3, ['.##', '.##', '...', '...', '...', '...', '...', '.##', '.##']),
  '-': at(5, ['#####', '#####']),
  '·': at(4, ['.##.', '####', '####', '.##.']),
  '+': at(3, ['..##..', '..##..', '######', '######', '..##..', '..##..']),
  '/': ['....##', '....##', '...##.', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...', '.##...', '##....', '##....'],
  '(': ['..##', '.##.', '.##.', ...x(6, '##..'), '.##.', '.##.', '..##'],
  ')': ['##..', '.##.', '.##.', ...x(6, '..##'), '.##.', '.##.', '##..'],
  '%': ['.##...##', '#..#..##', '#..#.##.', '.##..##.', '....##..', '....##..', '...##...', '...##...', '.##..##.', '.##.#..#', '##..#..#', '##...##.'],
  '&': ['..###....', '.##.##...', '.##.##...', '.##.##...', '..###....', '.###.....', '##.##..##', '##..##.##', '##...###.', '##...###.', '.##.##.##', '..###..##'],
  '*': at(2, ['...##...', '##.##.##', '.######.', '..####..', '.######.', '##.##.##', '...##...']),
  '#': at(1, ['.##..##.', '.##..##.', '########', '.##..##.', '.##..##.', '.##..##.', '########', '.##..##.', '.##..##.']),
  '=': at(3, ['######', '######', '......', '......', '######', '######']),
  '<': at(1, ['....##', '...##.', '..##..', '.##...', '##....', '##....', '.##...', '..##..', '...##.', '....##']),
  '>': at(1, ['##....', '.##...', '..##..', '...##.', '....##', '....##', '...##.', '..##..', '.##...', '##....']),
  _: at(10, ['#######', '#######']),
  '×': at(3, ['##...##', '.##.##.', '..###..', '..###..', '.##.##.', '##...##']),
  '♥': at(2, ['.##...##.', '####.####', '#########', '#########', '.#######.', '..#####..', '...###...', '....#....']),
  '→': at(3, ['.....##..', '......##.', '#########', '#########', '......##.', '.....##..']),
  '←': at(3, ['..##.....', '.##......', '#########', '#########', '.##......', '..##.....']),
  '↑': at(1, ['...##...', '..####..', '.######.', '##.##.##', ...x(6, '...##...')]),
  '↓': at(1, [...x(6, '...##...'), '##.##.##', '.######.', '..####..', '...##...']),
}

/** Rows above the cap height, top row first; the last one sits right over the capital. */
const ABOVE: Record<string, string[]> = {
  'Å': ['...##...', '..#..#..', '...##...'],
  'É': ['....##.', '...##..', '.......'],
}

/** Rows under the baseline, nearest row first. */
const BELOW: Record<string, string[]> = {
  ',': ['..#', '.#.'],
  ';': ['..#', '.#.'],
}

/** Most rows any glyph has above the capitals and under the baseline. */
export const ABOVE16 = 3
export const BELOW16 = 2

/** As font.ts: what an unknown character draws as. É keeps its accent here. */
const ALIAS: Record<string, string> = { '—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '.', 'É': 'E', 'È': 'E', 'Ä': 'Æ', 'Ö': 'Ø', 'Ü': 'U' }

function glyph(ch: string): string[] {
  return G[ch] ?? G[ALIAS[ch] ?? '?'] ?? G['?']!
}

/** Every character this font has a drawing for. */
export const GLYPHS16: readonly string[] = Object.keys(G)

/** A character's twelve rows ('#' = lit), after upper-casing. */
export function glyphRows16(ch: string): string[] {
  return glyph(ch.toUpperCase())
}

/** The rows a character draws above the capitals and under the baseline (usually none), after upper-casing. */
export function glyphExtra16(ch: string): { above: string[]; below: string[] } {
  const c = ch.toUpperCase()
  return { above: ABOVE[c] ?? [], below: BELOW[c] ?? [] }
}

/** Width of a line in font pixels (the last glyph's shadow not counted). */
export function textWidth16(text: string): number {
  let w = 0
  for (const ch of text.toUpperCase()) w += glyph(ch)[0]!.length + GAP
  return Math.max(0, w - GAP)
}

/** As font.ts's wrapText, measured in this font's pixels. */
export function wrapText16(text: string, maxWidth: number): string[] {
  const lines: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    for (const word of words) {
      const next = line ? line + ' ' + word : word
      if (textWidth16(next) <= maxWidth || !line) {
        line = next
      } else {
        lines.push(line)
        line = word
      }
    }
    lines.push(line)
  }
  return lines
}

/**
 * How the dark under the letters lies: 'drop' is the text box's shadow (right,
 * below and the corner between), 'rim' a line all the way round and the drop
 * outside it, for text that lies straight on the world.
 */
export type Edge16 = 'drop' | 'rim'

/** A glyph's cell on a strip: one pixel of margin for the rim, two more to the right and below for the drop. */
const PAD_L = 1
const PAD_T = 1 + ABOVE16
const CELL_H = PAD_T + CAP16 + BELOW16 + 2

interface Strip { canvas: HTMLCanvasElement; at: Map<string, { x: number; w: number }> }
const strips = new Map<string, Strip>()

/** Every glyph in one colour over one shadow, drawn once: a letter is then a single drawImage, and it fades as one piece. */
function strip(color: string, shadow: string | undefined, edge: Edge16): Strip {
  const key = `${color}|${shadow ?? ''}|${edge}`
  const hit = strips.get(key)
  if (hit) return hit
  if (strips.size > 48) strips.clear()
  const chars = [...Object.keys(G), ...Object.keys(ABOVE).filter(c => !G[c])]
  const at = new Map<string, { x: number; w: number }>()
  let width = 0
  for (const ch of chars) {
    const w = glyph(ch)[0]!.length
    at.set(ch, { x: width, w })
    width += w + PAD_L + 2
  }
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = CELL_H
  const g = canvas.getContext('2d')!
  const offsets = !shadow ? [] : edge === 'rim'
    ? [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [2, 1], [1, 2], [2, 2], [0, 2], [2, 0]]
    : [[1, 0], [0, 1], [1, 1]]
  for (const ch of chars) {
    const { x: cx } = at.get(ch)!
    const rows = [...(ABOVE[ch] ?? []), ...glyph(ch), ...(BELOW[ch] ?? [])]
    const top = PAD_T - (ABOVE[ch]?.length ?? 0)
    const pass = (ox: number, oy: number, fill: string) => {
      g.fillStyle = fill
      rows.forEach((row, r) => {
        let c = 0
        while (c < row.length) {
          if (row[c] !== '#') { c++; continue }
          const start = c
          while (c < row.length && row[c] === '#') c++
          g.fillRect(cx + PAD_L + start + ox, top + r + oy, c - start, 1)
        }
      })
    }
    if (shadow) {
      // The shadow is laid down solid and the letter cut out of it, so a see-through shadow colour does not add up where passes overlap.
      const cw = rows[0]!.length + PAD_L + 2
      for (const [ox, oy] of offsets) pass(ox!, oy!, '#000')
      g.save()
      g.beginPath()
      g.rect(cx, 0, cw, CELL_H)
      g.clip()
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = shadow
      g.fillRect(cx, 0, cw, CELL_H)
      g.restore()
    }
    pass(0, 0, color)
  }
  const made = { canvas, at }
  strips.set(key, made)
  return made
}

/**
 * Draw a line with its top-left at (x, y): y is the top of the capitals.
 * `unit` is the size of one font pixel in the context's units (0.5 on a
 * canvas scaled 2×); the line is snapped to that grid.
 */
export function drawText16(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  shadow?: string,
  unit = 1,
  edge: Edge16 = 'drop',
): void {
  const s = strip(color, shadow, edge)
  let cx = Math.round(x / unit) * unit
  const top = Math.round(y / unit) * unit
  for (const raw of text.toUpperCase()) {
    const ch = s.at.has(raw) ? raw : s.at.has(ALIAS[raw] ?? '') ? ALIAS[raw]! : '?'
    const cell = s.at.get(ch)!
    const w = cell.w + PAD_L + 2
    ctx.drawImage(s.canvas, cell.x, 0, w, CELL_H, cx - PAD_L * unit, top - PAD_T * unit, w * unit, CELL_H * unit)
    cx += (cell.w + GAP) * unit
  }
}
