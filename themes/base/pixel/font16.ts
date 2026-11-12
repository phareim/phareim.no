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
  'Æ': ['...#######', '...###....', '..####....', '..####....', '.##.##....', '.##.#####.', '.##.##....', '##..##....', '######....', '##..##....', '##..##....', '##..######'],
  'Ø': ['..####.#', '.##..##.', '##...###', '##...###', '##..#.##', '##..#.##', '##.#..##', '##.#..##', '###...##', '###...##', '.##..##.', '#.####..'],
  // The A under the ring starts a row down, so the ring stands clear of its point.
  'Å': ['........', '...##...', '..####..', '..####..', '.##..##.', '.##..##.', '.##..##.', '##....##', '########', '##....##', '##....##', '##....##'],
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
  // The long dashes and the three dots are their own drawings here (the 5×7 font shows a hyphen and one dot).
  '–': at(5, ['#######', '#######']),
  '—': at(5, ['##########', '##########']),
  '…': at(10, ['##..##..##', '##..##..##']),
  '·': at(4, ['.##.', '####', '####', '.##.']),
  '+': at(3, ['..##..', '..##..', '######', '######', '..##..', '..##..']),
  '/': ['....##', '....##', '...##.', '...##.', '...##.', '..##..', '..##..', '.##...', '.##...', '.##...', '##....', '##....'],
  '(': ['..##', '.##.', '.##.', ...x(6, '##..'), '.##.', '.##.', '..##'],
  ')': ['##..', '.##.', '.##.', ...x(6, '..##'), '.##.', '.##.', '##..'],
  '%': ['.##....##.', '#..#...##.', '#..#..##..', '.##...##..', '.....##...', '.....##...', '....##....', '....##....', '...##..##.', '...##.#..#', '..##..#..#', '..##...##.'],
  '&': ['..####...', '.##..##..', '.##..##..', '.##..##..', '..####...', '..###....', '.####..##', '##..##.##', '##...###.', '##...###.', '.##.####.', '..###..##'],
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
  'Å': ['..####..', '.##..##.', '..####..'],
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

/** As font.ts: what an unknown character draws as. É keeps its accent here, and the long dashes and the ellipsis have glyphs of their own. */
const ALIAS: Record<string, string> = { '’': "'", '‘': "'", '“': '"', '”': '"', 'É': 'E', 'È': 'E', 'Ä': 'Æ', 'Ö': 'Ø', 'Ü': 'U' }

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

/** A line that holds only characters upper-casing leaves alone: most of them, since the game's lines are stored in capitals. */
const PLAIN = /^[\x20-\x5f]*$/
function upper(text: string): string {
  return PLAIN.test(text) ? text : text.toUpperCase()
}

/** Width of a line in font pixels (the last glyph's shadow not counted). */
export function textWidth16(text: string): number {
  let w = 0
  for (const ch of upper(text)) w += glyph(ch)[0]!.length + GAP
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
 * below and the corner between), 'rim' a one-pixel line all the way round,
 * like the rim of the HUD's icons, for text that lies straight on the world.
 */
export type Edge16 = 'drop' | 'rim'

/** A glyph's cell on a strip: one pixel of margin all round for the rim or the drop, and one to spare on the right and below. */
const PAD_L = 1
const PAD_T = 1 + ABOVE16
const CELL_H = PAD_T + CAP16 + BELOW16 + 2

interface Strip { canvas: HTMLCanvasElement; at: Map<string, { x: number; w: number }> }

/** Where the dark lies round a letter, as offsets of the letter itself. */
const OFFSETS: Record<Edge16, ReadonlyArray<readonly [number, number]>> = {
  drop: [[1, 0], [0, 1], [1, 1]],
  rim: [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]],
}

/** Every glyph once, opaque, each in its cell: what the coloured strips are made from. */
let mask: Strip | null = null
function glyphMask(): Strip {
  if (mask) return mask
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
  g.fillStyle = '#000'
  for (const ch of chars) {
    const { x: cx } = at.get(ch)!
    const rows = [...(ABOVE[ch] ?? []), ...glyph(ch), ...(BELOW[ch] ?? [])]
    const top = PAD_T - (ABOVE[ch]?.length ?? 0)
    rows.forEach((row, r) => {
      let c = 0
      while (c < row.length) {
        if (row[c] !== '#') { c++; continue }
        const start = c
        while (c < row.length && row[c] === '#') c++
        g.fillRect(cx + PAD_L + start, top + r, c - start, 1)
      }
    })
  }
  mask = { canvas, at }
  return mask
}

/** The strips made so far, by edge, colour and shadow, and how many there are. */
const strips: Record<Edge16, Map<string, Map<string, Strip>>> = { drop: new Map(), rim: new Map() }
let made = 0
let tint: HTMLCanvasElement | null = null

/**
 * Every glyph in one colour over one shadow, drawn once: a letter is then a
 * single drawImage, and it fades as one piece. A strip is the mask laid down
 * at each of the shadow's offsets and filled with the shadow colour (solid
 * first, so a see-through shadow does not add up where the offsets overlap),
 * and the mask in the letter's colour on top: a handful of canvas calls, so a
 * colour seen for the first time costs the frame nothing to speak of.
 */
function strip(color: string, shadow: string | undefined, edge: Edge16): Strip {
  let byShadow = strips[edge].get(color)
  if (!byShadow) { byShadow = new Map(); strips[edge].set(color, byShadow) }
  const hit = byShadow.get(shadow ?? '')
  if (hit) return hit
  if (made > 48) {
    strips.drop.clear()
    strips.rim.clear()
    made = 0
    byShadow = new Map()
    strips[edge].set(color, byShadow)
  }
  const m = glyphMask()
  const w = m.canvas.width
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = CELL_H
  const g = canvas.getContext('2d')!
  if (shadow) {
    for (const [ox, oy] of OFFSETS[edge]) g.drawImage(m.canvas, ox, oy)
    g.globalCompositeOperation = 'source-in'
    g.fillStyle = shadow
    g.fillRect(0, 0, w, CELL_H)
    g.globalCompositeOperation = 'source-over'
  }
  if (!tint) tint = document.createElement('canvas')
  tint.width = w
  tint.height = CELL_H
  const tg = tint.getContext('2d')!
  tg.drawImage(m.canvas, 0, 0)
  tg.globalCompositeOperation = 'source-in'
  tg.fillStyle = color
  tg.fillRect(0, 0, w, CELL_H)
  g.drawImage(tint, 0, 0)
  const out = { canvas, at: m.at }
  byShadow.set(shadow ?? '', out)
  made++
  return out
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
  for (const raw of upper(text)) {
    const ch = s.at.has(raw) ? raw : s.at.has(ALIAS[raw] ?? '') ? ALIAS[raw]! : '?'
    const cell = s.at.get(ch)!
    const w = cell.w + PAD_L + 2
    ctx.drawImage(s.canvas, cell.x, 0, w, CELL_H, cx - PAD_L * unit, top - PAD_T * unit, w * unit, CELL_H * unit)
    cx += (cell.w + GAP) * unit
  }
}
