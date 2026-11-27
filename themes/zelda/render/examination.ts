/**
 * THE EXAMINATION's drawing (`engine/exam.ts`), shared by both painters:
 * - on the floor, under everything that stands (`floorMarks.ts`): the pads, and the stencil shapes of its fights;
 * - standing in the world: the words over a HAND IN pad;
 * - on the HUD: the strip of the round under way (its rule's short name, marks and the pass mark) and the score card.
 */
import type { GameState, World } from '../types'
import { EXAM, TILE } from '../types'
import { cellDef, cellIndex, mapInfo, type PadInfo } from '../engine/map'
import type { Stencil } from '../engine/stencils'
import { drawText, textWidth } from '../../base/pixel/font'
import { sprite } from './sheet'
import type { Item } from './wild'

type G = CanvasRenderingContext2D
const T = TILE

/** Danger is pink, the hero's own is cyan, a prize is gold. */
const PINK = '#ff2fa0'
const PINK_LIGHT = '#ffc2e6'
const CYAN = '#2ff3ff'
const GOLD = '#ffd23f'
const GOLD_DARK = '#a86e14'
const INK = '#0b0616'

// ---------------------------------------------------------------------------
// The pads
// ---------------------------------------------------------------------------

/** Is the pad's room on screen (the hero's, or the one scrolled into)? */
const seen = (s: GameState, p: PadInfo) => p.cell === s.zoneIndex || (!!s.scroll && p.cell === s.scroll.index)

export function drawPads(g: G, world: World, s: GameState, cx: number, cy: number) {
  const info = mapInfo(world, s.map.id)
  for (const p of info.pads) {
    if (!seen(s, p)) continue
    const round = cellDef(info, p.cell)?.round
    const exam = s.map.exam?.cell === p.cell ? s.map.exam : undefined
    // A round passed: the pads lie there, and nothing about them is live.
    const quiet = !exam && !!round && s.flags[`exam.${round.id}`] === true
    const x = Math.round(p.x * T - cx)
    const y = Math.round(p.y * T - cy)
    const w = p.size * T
    const latched = !!exam?.got.includes(p.id)
    const fill = exam && !latched && p.hold > 0 ? Math.min(1, (exam.hold[p.id] ?? 0) / p.hold) : 0
    if (p.handin) handInPad(g, x, y, w, quiet)
    else if (p.pic) {
      g.drawImage(sprite(`pane_${p.pic}`), x, y, w, w)
      frame(g, x, y, w, INK)
      frame(g, x + 1, y + 1, w - 2, '#fff4ff')
    } else markPad(g, x, y, w)
    if (quiet) { dim(g, x, y, w, 0.45); continue }
    if (latched) {
      dim(g, x, y, w, 0.55)
      if (p.worth > 0) sign(g, x, y, w, s.view === 'iso', CYAN, TICK)
      else sign(g, x, y, w, s.view === 'iso', PINK, CROSS)
      continue
    }
    ring(g, x + w / 2, y + w / 2, w / 2 - 2, fill, p.handin ? '#fff4ff' : CYAN)
  }
}

function frame(g: G, x: number, y: number, w: number, c: string) {
  g.fillStyle = c
  g.fillRect(x, y, w, 1); g.fillRect(x, y + w - 1, w, 1); g.fillRect(x, y, 1, w); g.fillRect(x + w - 1, y, 1, w)
}

function dim(g: G, x: number, y: number, w: number, a: number) {
  g.globalAlpha = a
  g.fillStyle = INK
  g.fillRect(x, y, w, w)
  g.globalAlpha = 1
}

/** The ring of a pad: a faint track, and over it, clockwise from the top, as far as the hero has stood. In whole px. */
function ring(g: G, mx: number, my: number, r: number, fill: number, color: string) {
  const dot = (a: number, size: number) => g.fillRect(Math.round(mx + Math.cos(a) * r - size / 2), Math.round(my + Math.sin(a) * r - size / 2), size, size)
  const steps = Math.round(r * 7)
  g.fillStyle = '#fff4ff'
  g.globalAlpha = 0.35
  for (let i = 0; i < steps; i += 2) dot((i / steps) * Math.PI * 2 - Math.PI / 2, 1)
  g.globalAlpha = 1
  if (fill <= 0) return
  const n = Math.ceil(steps * fill)
  g.fillStyle = INK
  for (let i = 0; i < n; i++) dot((i / steps) * Math.PI * 2 - Math.PI / 2, 4)
  g.fillStyle = color
  for (let i = 0; i < n; i++) dot((i / steps) * Math.PI * 2 - Math.PI / 2, 2)
}

/** A thick stroke from (x0, y0) to (x1, y1) in whole px. */
function stroke(g: G, x0: number, y0: number, x1: number, y1: number, size: number) {
  const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
  for (let i = 0; i <= n; i++) g.fillRect(Math.round(x0 + ((x1 - x0) * i) / n - size / 2), Math.round(y0 + ((y1 - y0) * i) / n - size / 2), size, size)
}

/**
 * A tick or a cross over a latched pad: strokes given as the eye should see them (px of a 32 px pad, from its
 * middle). The isometric view lays the floor on the slant, so there they are laid on it the other way round.
 */
function sign(g: G, x: number, y: number, w: number, iso: boolean, color: string, lines: ReadonlyArray<readonly [number, number, number, number]>) {
  const k = w / 32
  const at = (u: number, v: number): [number, number] => {
    const [dx, dy] = iso ? [(u + 2 * v) / 2, (2 * v - u) / 2] : [u, v]
    return [x + w / 2 + dx * k, y + w / 2 + dy * k]
  }
  for (const [c, size] of [[INK, Math.max(3, Math.round(7 * k))], [color, Math.max(1, Math.round(3 * k))]] as const) {
    g.fillStyle = c
    for (const [u0, v0, u1, v1] of lines) stroke(g, ...at(u0, v0), ...at(u1, v1), size)
  }
}
const TICK = [[-10, 0, -4, 5], [-4, 5, 10, -6]] as const
const CROSS = [[-8, -6, 8, 6], [8, -6, -8, 6]] as const

/** A mark pad with no picture: a dark stone with a gold ring in it. */
function markPad(g: G, x: number, y: number, w: number) {
  g.fillStyle = INK
  g.fillRect(x + 1, y + 1, w - 2, w - 2)
  frame(g, x + 2, y + 2, w - 4, GOLD_DARK)
}

/** The HAND IN pad: a gold plate in the floor (its words stand over it, `queueExam`). */
function handInPad(g: G, x: number, y: number, w: number, quiet: boolean) {
  g.fillStyle = INK
  g.fillRect(x, y, w, w)
  g.fillStyle = quiet ? GOLD_DARK : GOLD
  g.fillRect(x + 1, y + 1, w - 2, w - 2)
  g.fillStyle = GOLD_DARK
  g.fillRect(x + 1, y + w - 3, w - 2, 2)
  g.fillRect(x + 4, y + 4, w - 8, w - 8)
}

/** The words over each HAND IN pad of the round under way, on a gold plate that stands. */
export function queueExam(g: G, world: World, s: GameState, cx: number, cy: number, items: Item[]) {
  const x = s.map.exam
  if (!x || x.over) return
  for (const p of mapInfo(world, s.map.id).pads) {
    if (!p.handin || p.cell !== x.cell || !seen(s, p)) continue
    const mx = p.x + p.size / 2
    // The isometric view stands the desk beside the niche in front of the pad: the words go high over it. From above
    // nothing is in the way, and they sit just over the pad, a little inward, clear of the corner chart.
    const iso = s.view === 'iso'
    items.push({
      x: mx,
      y: p.y + p.size / 2,
      draw: () => {
        // (The D stands a little apart with a foot and a cap to its left: smoothed, a bare D of this font reads as an O.)
        const dAt = textWidth('HAN') + 2
        const inAt = dAt + textWidth('D') + 5
        const tw = inAt + textWidth('IN')
        const px = Math.round((mx - (iso ? 0 : 0.75)) * T - cx - tw / 2)
        const py = Math.round((p.y + p.size / 2) * T - cy - (iso ? 30 : 18))
        g.fillStyle = INK
        g.fillRect(px - 3, py - 3, tw + 6, 13)
        g.fillStyle = GOLD
        g.fillRect(px - 2, py - 2, tw + 4, 11)
        drawText(g, 'HAN', px, py, INK)
        drawText(g, 'D', px + dAt, py, INK)
        g.fillRect(px + dAt - 1, py, 1, 1)
        g.fillRect(px + dAt - 1, py + 6, 1, 1)
        drawText(g, 'IN', px + inAt, py, INK)
      },
    })
  }
}

// ---------------------------------------------------------------------------
// Stencils: what a blow will hit, on the floor (`engine/stencils.ts`)
// ---------------------------------------------------------------------------

/**
 * The examination's shapes, flat on the floor: a disc, a box or a path from point to point at any angle. `k` fills
 * it from the edge to the middle (a path: from its start to its end) as its landing nears; `dim` is a fainter copy.
 * Painted px by px, so the edges stay hard.
 */
export function drawShape(g: G, st: Exclude<Stencil, { t: 'lane' }>, cx: number, cy: number, time: number, reduced: boolean) {
  const blink = !reduced && st.k > 0.65 && Math.floor(time * 14) % 2 === 0
  const edge = blink ? PINK_LIGHT : PINK
  // Distance to the shape's edge, in px, positive inside; and how far into the fill a point is (0 first, 1 last).
  let box: [number, number, number, number]
  let at: (x: number, y: number) => { in: number; f: number }
  if (st.t === 'disc') {
    const mx = st.x * T - cx
    const my = st.y * T - cy
    const r = st.r * T
    box = [mx - r, my - r, mx + r, my + r]
    at = (x, y) => { const d = r - Math.hypot(x - mx, y - my); return { in: d, f: d / r } }
  } else if (st.t === 'box') {
    const x0 = st.x * T - cx - (st.w * T) / 2
    const y0 = st.y * T - cy - (st.h * T) / 2
    const x1 = x0 + st.w * T
    const y1 = y0 + st.h * T
    box = [x0, y0, x1, y1]
    const half = Math.min(st.w, st.h) * T / 2
    at = (x, y) => { const d = Math.min(x - x0, x1 - x, y - y0, y1 - y); return { in: d, f: d / half } }
  } else {
    const ax = st.x0 * T - cx
    const ay = st.y0 * T - cy
    const dx = st.x1 * T - cx - ax
    const dy = st.y1 * T - cy - ay
    const len = Math.hypot(dx, dy) || 1
    const half = (st.w * T) / 2
    box = [Math.min(ax, ax + dx) - half, Math.min(ay, ay + dy) - half, Math.max(ax, ax + dx) + half, Math.max(ay, ay + dy) + half]
    at = (x, y) => {
      const along = ((x - ax) * dx + (y - ay) * dy) / len
      const off = Math.abs((x - ax) * dy - (y - ay) * dx) / len
      return { in: Math.min(half - off, along, len - along), f: along / len }
    }
  }
  const faint = st.dim ? 0.5 : 1
  for (let y = Math.floor(box[1]); y <= Math.ceil(box[3]); y++) {
    for (let x = Math.floor(box[0]); x <= Math.ceil(box[2]); x++) {
      const p = at(x + 0.5, y + 0.5)
      if (p.in < 0) continue
      const rim = p.in < 2
      g.globalAlpha = faint * (rim ? 1 : p.f <= st.k ? 0.5 : 0.18)
      g.fillStyle = rim ? edge : PINK
      g.fillRect(x, y, 1, 1)
    }
  }
  g.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// The strip and the card
// ---------------------------------------------------------------------------

const RULE_NAMES = { r1: 'NO BLADE', r2: 'NOT A MACHINE', r3: 'TIME WAITS', r4: 'WEIGH IT' } as const
const ROUND_NAMES = { r1: 'ROUND ONE', r2: 'ROUND TWO', r3: 'ROUND THREE', r4: 'ROUND FOUR' } as const

/** The strip's two rows are 8 px each. */
const ROW = 8
/**
 * On a HUD narrower than `NARROW` logical px (an upright phone) the corner chart reaches in past the middle: the
 * strip and the card start under it, at `UNDER_CORNER`.
 */
const NARROW = 270
const UNDER_CORNER = 54

/**
 * The two rows of the round under way, centred under the hearts: the rule's short name, then the marks and the pass
 * mark (lime once they are enough). `row` is the counters' row, `taken` how far across the counters and the item box
 * reach, `under` the first row clear of both: the strip drops there rather than lie on them.
 */
export function drawExamStrip(g: G, world: World, s: GameState, vw: number, row: number, taken: number, under: number, colors: { rule: string; text: string; pass: string; outline: string }) {
  const x = s.map.exam
  if (!x || x.over || x.cell !== s.zoneIndex) return
  const round = cellDef(mapInfo(world, s.map.id), x.cell)?.round
  if (!round) return
  const name = RULE_NAMES[x.id]
  const score = `MARKS ${x.marks}   PASS ${round.pass}`
  const w = Math.max(textWidth(name), textWidth(score))
  const clear = Math.round((vw - w) / 2) < taken + 3 ? under : row
  const y = vw < NARROW ? Math.max(clear, UNDER_CORNER) : clear
  // A dark plate behind the two rows: they read over a lit wall as over the floor.
  g.fillStyle = 'rgba(11,6,22,0.62)'
  g.fillRect(Math.round((vw - w) / 2) - 3, y - 2, w + 6, ROW * 2 + 2)
  drawText(g, name, Math.round((vw - textWidth(name)) / 2), y, colors.rule, colors.outline)
  drawText(g, score, Math.round((vw - textWidth(score)) / 2), y + ROW, x.marks >= round.pass ? colors.pass : colors.text, colors.outline)
}

const PAPER = '#fbf1d8'
const PAPER_EDGE = '#c9b78e'
const PEN = '#2a1f4a'

/**
 * The score card: a corner of an exam paper over the top third of the screen. The round's name, a tick box for every
 * two marks (filled as far as the marks go), a line where the pass mark lies, and a stamp. It is no dialog and no
 * ending: play goes on under it.
 */
export function drawExamCard(g: G, s: GameState, vw: number, vh: number, reduced: boolean) {
  const card = s.map.exam?.card
  if (!card) return
  const boxes = Math.ceil(card.max / 2)
  const BOX = 11
  const GAP = 3
  const row = boxes * (BOX + GAP) - GAP
  const w = Math.max(row, textWidth(ROUND_NAMES[card.id])) + 24
  const h = 58
  // It drops in over the first tenth of a second and leaves over the last.
  const away = reduced ? 0 : Math.max(0, 1 - card.t / 0.12, 1 - (EXAM.card - card.t) / 0.12)
  const x = Math.round((vw - w) / 2)
  const y = Math.round(Math.max(vw < NARROW ? UNDER_CORNER + 2 : 36, vh / 6 - h / 2) - away * 24)
  g.globalAlpha = 1 - 0.6 * away
  g.fillStyle = 'rgba(11,6,22,0.5)'
  g.fillRect(x + 3, y + 3, w, h)
  g.fillStyle = PAPER
  g.fillRect(x, y, w, h)
  // Ruled lines, a red margin, a dog-eared corner.
  g.fillStyle = PAPER_EDGE
  for (let ly = y + 13; ly < y + h - 2; ly += 10) g.fillRect(x + 1, ly, w - 2, 1)
  g.fillRect(x, y + h - 1, w, 1)
  g.fillRect(x + w - 1, y, 1, h)
  g.fillStyle = '#e0708a'
  g.fillRect(x + 6, y, 1, h)
  g.fillStyle = PAPER_EDGE
  for (let i = 0; i < 6; i++) g.fillRect(x + w - 6 + i, y + i, 6 - i, 1)
  const name = ROUND_NAMES[card.id]
  drawText(g, name, Math.round((vw - textWidth(name)) / 2), y + 4, PEN)
  // The boxes fill from the left in the card's first half second.
  const shown = card.marks * (reduced ? 1 : Math.min(1, card.t / 0.5))
  const bx = Math.round((vw - row) / 2)
  const by = y + 17
  for (let i = 0; i < boxes; i++) {
    const px = bx + i * (BOX + GAP)
    g.fillStyle = PEN
    g.fillRect(px, by, BOX, BOX)
    g.fillStyle = '#ffffff'
    g.fillRect(px + 1, by + 1, BOX - 2, BOX - 2)
    const have = Math.max(0, Math.min(2, shown - i * 2))
    if (have <= 0) continue
    // A whole box is ticked; half of one gets the tick's short stroke.
    g.fillStyle = '#1f5fd0'
    stroke(g, px + 3, by + 6, px + 5, by + 8, 2)
    if (have >= 2) stroke(g, px + 5, by + 8, px + 9, by + 2, 2)
  }
  // The pass mark: a line between the boxes.
  const line = Math.round(bx + (card.pass / 2) * (BOX + GAP) - GAP / 2 - 1)
  g.fillStyle = '#e0204c'
  g.fillRect(line, by - 3, 1, BOX + 6)
  g.fillRect(line - 1, by - 4, 3, 1)
  // The stamp, a moment after, slightly crooked: each letter and its piece of the frame a px lower than the last pair.
  if (reduced || card.t > 0.55) {
    const word = card.passed ? 'PASSED' : 'RESIT'
    const ink = card.passed ? '#a86e00' : '#e0187a'
    const wash = card.passed ? '#ffd23f' : '#ffc2e6'
    const sw = textWidth(word) + 12
    const sx = Math.round((vw - sw) / 2) + 6
    const sy = y + 36
    const drop = (px: number) => Math.floor((sw - px) / 14)
    for (let i = 0; i < sw; i++) {
      const d = drop(i)
      g.fillStyle = wash
      g.fillRect(sx + i, sy + d, 1, 14)
      g.fillStyle = ink
      if (i < 2 || i >= sw - 2) g.fillRect(sx + i, sy + d, 1, 14)
      else { g.fillRect(sx + i, sy + d, 1, 2); g.fillRect(sx + i, sy + d + 12, 1, 2) }
    }
    let at = 6
    for (const ch of word) {
      drawText(g, ch, sx + at, sy + 3 + drop(at + 2), card.passed ? '#5a3600' : ink)
      at += textWidth(ch) + 1
    }
  }
  g.globalAlpha = 1
}
