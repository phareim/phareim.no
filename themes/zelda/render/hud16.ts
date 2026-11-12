/**
 * The 16-bit view's HUD skin at double density: every logical pixel of the
 * layout is two pixels here (`hudLayer` scales the canvas 2×, so half a unit
 * is one pixel). The window is the console RPG's: a gradient that changes a
 * little on every scanline, in the steps the machine's fifteen-bit colour
 * allowed, behind a two-pixel bevelled border with round corners, an inner
 * dark line and a soft shadow on the world. The lettering is font16.ts, the
 * hearts and the pointing hand are drawn here, and the few other icons are
 * the classic sprites through EPX.
 */
import { drawText16, textWidth16, wrapText16 } from '../../base/pixel/font16'
import { epxCanvas } from '../../base/pixel/epx'
import { makeCanvas, paintRows, sprite } from './sheet'
import type { HudFont, HudSkin } from './hud'

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement

/** Under the letters in a window, and round the ones that lie straight on the world. */
const SHADOW = '#0a0c38'
const RIM = '#06081f'

const FONT: HudFont = {
  width: text => textWidth16(text) / 2,
  wrap: (text, maxWidth) => wrapText16(text, maxWidth * 2),
  // The capitals are twelve pixels in the layout's fourteen-pixel line: one pixel down. Text handed the rim colour lies on the world and gets a line all the way round.
  draw: (g, text, x, y, color, shadow) => drawText16(g, text, x, y + 0.5, color, shadow ?? SHADOW, 0.5, shadow === RIM ? 'rim' : 'drop'),
}

// ---------------------------------------------------------------------------
// The window
// ---------------------------------------------------------------------------

interface Tone { top: [number, number, number]; bottom: [number, number, number]; hi: string; lo: string; hi2: string; lo2: string }
const TONES: Record<'hot' | 'cool', Tone> = {
  // Deep blue down to indigo: the dialog box, a label's plate, the view in use.
  hot: { top: [58, 74, 204], bottom: [36, 14, 104], hi: '#ffffff', lo: '#aab2ea', hi2: '#c8d0ff', lo2: '#6c74c4' },
  // Sea green down to night blue: the pause screen, the item box, a name plate.
  cool: { top: [34, 132, 164], bottom: [12, 44, 92], hi: '#ffffff', lo: '#a4c8e4', hi2: '#c4ecff', lo2: '#5c98c0' },
}

/** A filled box with its corners cut: `cuts[i]` pixels off each end of row i from the top and from the bottom. */
function box(g: G, x: number, y: number, w: number, h: number, cuts: number[], fill: string) {
  g.fillStyle = fill
  const n = Math.min(cuts.length, Math.floor(h / 2))
  for (let i = 0; i < n; i++) {
    const c = Math.min(cuts[i]!, Math.floor(w / 2))
    g.fillRect(x + c, y + i, w - c * 2, 1)
    g.fillRect(x + c, y + h - 1 - i, w - c * 2, 1)
  }
  g.fillRect(x, y + n, w, h - n * 2)
}

/** One channel in the machine's five bits. */
const five = (v: number) => Math.min(248, Math.round(v / 8) * 8)

/** Room on the canvas left of and over the window (its outline), and right of and under it (outline and shadow). */
const LEAD = 1
const TRAIL = 5

/** A window of w × h pixels, drawn once: outline, bevel, gradient, inner line, and its shadow on the world. */
function paintWindow(w: number, h: number, tone: Tone): Canvas {
  const c = makeCanvas(w + LEAD + TRAIL, h + LEAD + TRAIL)
  const g = c.getContext('2d')!
  const round = [3, 2, 1]
  // The shadow, in three steps that soften its edge.
  box(g, 3, 4, w + 2, h + 2, [4, 2, 1, 1], 'rgba(4,4,30,0.14)')
  box(g, 2, 3, w + 2, h + 2, round, 'rgba(4,4,30,0.2)')
  box(g, 1, 2, w + 2, h + 2, round, 'rgba(4,4,30,0.22)')
  box(g, 0, 0, w + 2, h + 2, round, '#070a2c')
  // Two rings of light, each darker along the bottom and the right.
  box(g, 1, 1, w, h, [2, 1], tone.lo)
  box(g, 1, 1, w - 1, h - 1, [2, 1], tone.hi)
  box(g, 2, 2, w - 2, h - 2, [1], tone.lo2)
  box(g, 2, 2, w - 3, h - 3, [1], tone.hi2)
  // The gradient: a new colour wherever the five-bit value of a channel changes.
  const rows = h - 4
  for (let r = 0; r < rows; r++) {
    const f = rows > 1 ? r / (rows - 1) : 0
    const ch = (i: number) => five(tone.top[i]! + (tone.bottom[i]! - tone.top[i]!) * f)
    g.fillStyle = `rgb(${ch(0)},${ch(1)},${ch(2)})`
    g.fillRect(3, 3 + r, w - 4, 1)
  }
  // The dark line inside the border, heavier under the top and the left edge where the border's own shadow falls.
  g.fillStyle = 'rgba(6,8,44,0.62)'
  g.fillRect(3, 3, w - 4, 1)
  g.fillRect(3, 4, 1, h - 5)
  g.fillStyle = 'rgba(6,8,44,0.36)'
  g.fillRect(4, h - 2, w - 5, 1)
  g.fillRect(w - 2, 4, 1, h - 6)
  return c
}

const windows = new Map<string, Canvas>()

function panel(g: G, x: number, y: number, w: number, h: number, tone: 'hot' | 'cool' = 'hot') {
  const pw = Math.max(8, Math.round(w * 2))
  const ph = Math.max(8, Math.round(h * 2))
  const key = `${pw}x${ph}${tone}`
  let c = windows.get(key)
  if (!c) {
    // Sizes come and go with what is said; the few on screen are painted again when the store is emptied.
    if (windows.size > 40) windows.clear()
    c = paintWindow(pw, ph, TONES[tone])
    windows.set(key, c)
  }
  g.drawImage(c, Math.round(x * 2) / 2 - LEAD / 2, Math.round(y * 2) / 2 - LEAD / 2, c.width / 2, c.height / 2)
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const INK: Record<string, string> = {
  k: '#12061c', // rim
  w: '#ffffff',
  m: '#ffa0e4', // light on the heart
  p: '#ff3aa8',
  P: '#c2187c', // the heart's shaded side
  D: '#7c0e58',
  K: '#2a1a4a', // an empty heart
  u: '#463672',
  g: '#c8cef4', // the glove's shade
  e: '#eaffb4', // the bit: a cut stone, lit from the upper left
  l: '#b6ff4a',
  d: '#7cd238',
  L: '#4f9a2a',
  f: '#2c661c',
  b: '#3f6fe0', // the bomb
  B: '#1f3a94',
  N: '#131f5a',
  y: '#ffd23f', // fuse and key
  Y: '#c4861c',
  E: '#fff1b0',
  o: '#ff8a3d',
}

/** The hearts, twice as fine as the classic 8 × 8: a light on the left lobe, a shaded right side, a dark rim. */
const HEART_FULL = [
  '..kkkk...kkkk...',
  '.kmmppk.kppppk..',
  'kmwwpppkpppppPk.',
  'kmwpppppppppPPk.',
  'kmppppppppppPPk.',
  'kpppppppppppPPk.',
  'kppppppppppPPDk.',
  '.kpppppppppPDk..',
  '..kpppppppPDk...',
  '...kpppppPDk....',
  '....kpppPDk.....',
  '.....kpPDk......',
  '......kDk.......',
  '.......k........',
  '................',
  '................',
]
const HEART_HALF = [
  '..kkkk...kkkk...',
  '.kmmppk.kuuuuk..',
  'kmwwpppkKKKKKuk.',
  'kmwppppkKKKKKKk.',
  'kmpppppkKKKKKKk.',
  'kppppppkKKKKKKk.',
  'kppppppkKKKKKKk.',
  '.kpppppkKKKKKk..',
  '..kppppkKKKKk...',
  '...kpppkKKKk....',
  '....kppkKKk.....',
  '.....kpkKk......',
  '......kkk.......',
  '.......k........',
  '................',
  '................',
]
const HEART_EMPTY = [
  '..kkkk...kkkk...',
  '.kuuuuk.kuuuuk..',
  'kuuKKKKkKKKKKuk.',
  'kuKKKKKKKKKKKKk.',
  'kuKKKKKKKKKKKKk.',
  'kKKKKKKKKKKKKKk.',
  'kKKKKKKKKKKKKKk.',
  '.kKKKKKKKKKKKk..',
  '..kKKKKKKKKKk...',
  '...kKKKKKKKk....',
  '....kKKKKKk.....',
  '.....kKKKk......',
  '......kKk.......',
  '.......k........',
  '................',
  '................',
]
const BIT = [
  '......kkkk......',
  '.....kellLk.....',
  '....keelllLk....',
  '...keewllllLk...',
  '..kelwwlllldLk..',
  '.kellwllllldLLk.',
  'kellllllllddLLLk',
  'klllllllldddLLLk',
  'klllllllddddLLfk',
  'kdlllllddddLLLfk',
  '.kddlldddLLLLfk.',
  '..kdddddLLLLfk..',
  '...kdddLLLLfk...',
  '....kdLLLLfk....',
  '.....kLLffk.....',
  '......kkkk......',
]
const BOMB = [
  '...........kk...',
  '..........kyok..',
  '.........kYyk...',
  '........kYYk....',
  '....kkkkkkk.....',
  '..kkbbbbBBkk....',
  '.kbbwbbbbBBBk...',
  '.kbwwbbbbBBBk...',
  'kbbwbbbbBBBBBk..',
  'kbbbbbbbBBBBBk..',
  'kbbbbbbBBBBBBk..',
  'kbbbbbBBBBBBNk..',
  '.kbbBBBBBBBNk...',
  '.kBBBBBBBBNNk...',
  '..kkBBBBNNkk....',
  '....kkkkkk......',
]
const KEY = [
  '................',
  '................',
  '................',
  '..kkkk..........',
  '.kEEyyk.........',
  'kEykkyYk........',
  'kEk..kyYkkkkkkkk',
  'kyk..kyyyyyyyyYk',
  'kyykkyYYYYYYYYYk',
  '.kyyYYkkkkkYkYk.',
  '..kkkk....kYkYk.',
  '..........kkkkk.',
  '................',
  '................',
  '................',
  '................',
]
const DRAWN: Record<string, string[]> = { hud_heart_full: HEART_FULL, hud_heart_half: HEART_HALF, hud_heart_empty: HEART_EMPTY, hud_bit: BIT, hud_bomb: BOMB, hud_key: KEY }

/** The pointing glove at an answer. */
const HAND = [
  '.....kkkk.....',
  '....kwwwwkkkk.',
  '.kkkwwwwwwwwwk',
  'kwwwwwwwwwwwwk',
  'kwwwwwwkkkkkk.',
  'kwwwwwwwwk....',
  'kwwwwwwgk.....',
  'kwwwwwwwwk....',
  '.kwwwwwgk.....',
  '..kggggk......',
  '...kkkk.......',
]

const drawn = new Map<string, Canvas>()
const scaled = new WeakMap<Canvas, Canvas>()

function art(name: string, rows: string[]): Canvas {
  let c = drawn.get(name)
  if (!c) { c = paintRows(rows, INK); drawn.set(name, c) }
  return c
}

/** A sprite at twice its pixels: drawn here when it is, else the classic one through EPX (kept per canvas, so a sprite the studio redraws is scaled again). */
function icon(name: string): Canvas {
  const rows = DRAWN[name]
  if (rows) return art(name, rows)
  const spr = sprite(name)
  let big = scaled.get(spr)
  if (!big) { big = epxCanvas(spr); scaled.set(spr, big) }
  return big
}

/** The heart pieces found, as quarters of one heart: top left, top right, bottom left, bottom right. */
function pieces(g: G, x: number, y: number, have: number) {
  g.drawImage(art('hud_heart_empty', HEART_EMPTY), x, y, 8, 8)
  const full = art('hud_heart_full', HEART_FULL)
  for (let i = 0; i < Math.min(4, have); i++) {
    const sx = i % 2 ? 8 : 0
    const sy = i > 1 ? 6 : 0
    g.drawImage(full, sx, sy, 8, i > 1 ? 10 : 6, x + sx / 2, y + sy / 2, 4, i > 1 ? 5 : 3)
  }
  // The cuts between the quarters.
  g.fillStyle = INK.k!
  g.fillRect(x + 3.5, y + 1, 0.5, 5.5)
  g.fillRect(x + 0.5, y + 3, 6.5, 0.5)
}

/** The "more" mark: a small arrow that dips and comes back, and is gone for a moment in between. */
function more(g: G, x: number, y: number, time: number) {
  const beat = (time * 1.6) % 1
  if (beat > 0.72) return
  const dy = beat > 0.36 ? 0.5 : 0
  const rows = [10, 8, 6, 4, 2]
  rows.forEach((n, r) => {
    g.fillStyle = SHADOW
    g.fillRect(x + (10 - n) / 4 + 0.5, y + dy + r / 2 + 0.5, n / 2, 0.5)
  })
  rows.forEach((n, r) => {
    g.fillStyle = r === 0 ? '#e4fbff' : '#8cecff'
    g.fillRect(x + (10 - n) / 4, y + dy + r / 2, n / 2, 0.5)
  })
}

/** The glove points at the answer and nudges toward it. */
function pointer(g: G, x: number, y: number, time: number) {
  const c = art('hand', HAND)
  const dx = Math.floor(time * 3) % 2 === 0 ? 0 : 0.5
  g.drawImage(c, x - 1 + dx, y + 1, c.width / 2, c.height / 2)
}

/** The isometric view's windows at double density: `kit.hudLayer(…, HIRES_WINDOW_SKIN)`. */
export const HIRES_WINDOW_SKIN: HudSkin = {
  panel,
  density: 2,
  font: FONT,
  icon,
  more,
  pointer,
  pieces,
  plate: true,
  text: '#ffffff', shadow: SHADOW, dim: '#b8c6fa', faint: '#7482cc',
  hot: '#ff8fd4', cool: '#8cecff', prize: '#ffe070', ok: '#aaf472',
  outline: RIM, veil: 'rgba(8,10,44,0.72)', slot: 'rgba(170,196,255,0.16)', off: '#262c7c',
}
