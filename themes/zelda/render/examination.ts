/**
 * THE EXAMINATION's drawing (`engine/exam.ts`), shared by both painters:
 * - on the floor, under everything that stands (`floorMarks.ts`): the pads, the ring in the pond's middle, the
 *   lanes of the hall's two stones and the stencil shapes of its fights;
 * - over THE BENCHMARK TITAN, on the HUD's layer: its two cards;
 * - standing in the world: the words over a HAND IN pad, and THE DUCK set down;
 * - over the world: the pale wash of a room that waits (TIME MOVES), round the hero;
 * - on the HUD: the strip of the round under way (its rule's short name, marks and the pass mark, and a clock with
 *   still hands while time waits) and the score card.
 */
import type { Enemy, GameState, Vec, World } from '../types'
import { EXAM, STILL, TILE, TITAN } from '../types'
import { titanCards, titanOpen, type TitanKind } from '../engine/bossTitan'
import { TILE_INFO } from '../world/tiles'
import { cellDef, cellIndex, mapInfo, type PadInfo } from '../engine/map'
import { puzzleInfo } from '../engine/puzzles/info'
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
const PAPER = '#fbf1d8'
const PAPER_EDGE = '#c9b78e'
const PEN = '#2a1f4a'

// ---------------------------------------------------------------------------
// The pads
// ---------------------------------------------------------------------------

/** Is the pad's room on screen (the hero's, or the one scrolled into)? */
const seen = (s: GameState, p: PadInfo) => p.cell === s.zoneIndex || (!!s.scroll && p.cell === s.scroll.index)

export function drawPads(g: G, world: World, s: GameState, cx: number, cy: number) {
  const info = mapInfo(world, s.map.id)
  drawFloats(g, world, s, cx, cy)
  drawStoneLanes(g, world, s, cx, cy)
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
      // (A pane's tick is the hero's cyan; a mark pad's is gold, as the stone it lies on.)
      if (p.worth > 0) sign(g, x, y, w, s.view === 'iso', p.pic ? CYAN : GOLD, TICK)
      else sign(g, x, y, w, s.view === 'iso', PINK, CROSS)
      continue
    }
    ring(g, x + w / 2, y + w / 2, w / 2 - 2, fill, p.handin ? '#fff4ff' : CYAN)
  }
}

/**
 * The ways of the two stones in the Titan's hall: faint pink dashes down each lane from the start (a lever is a
 * danger), bright while its stone rolls.
 */
function drawStoneLanes(g: G, world: World, s: GameState, cx: number, cy: number) {
  if (s.map.id !== 'examtop') return
  const info = mapInfo(world, s.map.id)
  for (const m of info.marks) {
    if (m.ent.t !== 'boulder') continue
    const rolling = !!s.map.phys?.rolling.some(r => Math.floor(r.x) === m.x)
    let end = m.y + 1
    while (end < info.h && !TILE_INFO[info.base[end * info.w + m.x]!].solid) end++
    const x = Math.round((m.x + 0.5) * T - cx)
    g.globalAlpha = rolling ? 1 : 0.4
    for (let y = (m.y + 1) * T; y < end * T; y += 8) {
      // (Two rows of dashes, a stone's width apart.)
      for (const dx of [-6, 5]) {
        g.fillStyle = INK
        if (rolling) g.fillRect(x + dx - 1, y - cy, 4, 7)
        g.fillStyle = PINK
        g.fillRect(x + dx, Math.round(y - cy) + 1, 2, 5)
      }
    }
    g.globalAlpha = 1
  }
}

/**
 * The ring in the middle of a pond (a float plate): the middle counts. A broken ring of foam while nothing floats
 * on it, whole and lit gold while it is held.
 */
function drawFloats(g: G, world: World, s: GameState, cx: number, cy: number) {
  const info = mapInfo(world, s.map.id)
  const p = puzzleInfo(info)
  for (const i of p.floats) {
    const x = i % s.map.w
    const y = Math.floor(i / s.map.w)
    const cell = cellIndex(info, x + 0.5, y + 0.5)
    if (cell !== s.zoneIndex && s.scroll?.index !== cell) continue
    if (s.map.tiles[i] !== 'ω') continue
    const lit = s.map.plates.includes(p.weights.get(i)!)
    const mx = (x + 0.5) * T - cx
    const my = (y + 0.5) * T - cy
    // (Wider than the Duck, so that it shows round what floats in it.)
    for (const [color, off] of [[INK, 1], [lit ? GOLD : '#fff4ff', 0]] as const) {
      g.fillStyle = color
      for (let n = 0; n < 96; n++) {
        if (!lit && n % 12 >= 6) continue
        const a = (n / 96) * Math.PI * 2
        g.fillRect(Math.round(mx + Math.cos(a) * 12 - 1), Math.round(my + Math.sin(a) * 12 - 1) + off, 2, 2)
      }
    }
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

/** A mark pad with no picture: a gold-rimmed stone with a gold lozenge in it (never to be taken for a hole). */
function markPad(g: G, x: number, y: number, w: number) {
  g.fillStyle = INK
  g.fillRect(x + 1, y + 1, w - 2, w - 2)
  g.fillStyle = GOLD
  g.fillRect(x + 2, y + 2, w - 4, w - 4)
  g.fillStyle = GOLD_DARK
  g.fillRect(x + 4, y + 4, w - 8, w - 8)
  g.fillStyle = '#fff1b0'
  const mx = x + w / 2
  const my = y + w / 2
  for (let i = -3; i < 3; i++) { const half = 3 - Math.abs(i + 0.5) + 0.5; g.fillRect(Math.round(mx - half), my + i, Math.round(half * 2), 1) }
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

/**
 * THE DUCK where it was set down: on the floor over a small shadow, on water riding low with a ripple round it and a
 * slow bob (none under reduced motion).
 */
function queueDuck(g: G, s: GameState, cx: number, cy: number, time: number, reduced: boolean, items: Item[]) {
  const d = s.duck
  if (!d) return
  const wet = s.map.tiles[Math.floor(d.y) * s.map.w + Math.floor(d.x)] === 'ω'
  items.push({
    x: d.x,
    y: d.y,
    foot: 6 / T,
    draw: () => {
      const pic = sprite('item_duck')
      const px = Math.round(d.x * T - cx)
      const bob = wet && !reduced ? Math.round(Math.sin(time * 3)) : 0
      const feet = Math.round(d.y * T - cy + 6) + bob
      if (wet) {
        // The ripple: a flat broken line either side of it.
        const wide = reduced ? 10 : 9 + (Math.floor(time * 2) % 3)
        g.fillStyle = '#bff6ff'
        g.fillRect(px - wide, feet - 2, 4, 1)
        g.fillRect(px + wide - 4, feet - 2, 4, 1)
        g.fillRect(px - 5, feet, 10, 1)
        // (Its bottom two rows are under the water.)
        g.drawImage(pic, 0, 0, pic.width, pic.height - 3, px - 8, feet - pic.height + 2, pic.width, pic.height - 3)
        return
      }
      g.fillStyle = 'rgba(11,6,22,0.35)'
      g.fillRect(px - 5, feet - 2, 11, 2)
      g.fillRect(px - 3, feet, 7, 1)
      g.drawImage(pic, px - 8, feet - pic.height + 1)
    },
  })
}

/** Does the hero's room stand still enough to show it (TIME MOVES, under `STILL.pale`)? */
export function timeStands(s: GameState): boolean {
  const x = s.map.exam
  return !!x && x.rule === 'still' && !x.over && x.cell === s.zoneIndex && x.k < STILL.pale
}

/**
 * The room one step paler while it waits: a wash over the world with the hero left clear of it, in full colour.
 * (`mx`, `my`: the hero's middle on this canvas.)
 */
export function drawStillWash(g: G, mx: number, my: number) {
  const x = Math.round(mx)
  const y = Math.round(my)
  const wash = g.createRadialGradient(x, y, 11, x, y, 34)
  wash.addColorStop(0, 'rgba(214,226,255,0)')
  wash.addColorStop(1, 'rgba(214,226,255,0.22)')
  g.fillStyle = wash
  g.fillRect(-4096, -4096, 8192, 8192)
}

/** The words over each HAND IN pad of the round under way, on a gold plate that stands. */
export function queueExam(g: G, world: World, s: GameState, cx: number, cy: number, time: number, reduced: boolean, items: Item[]) {
  queueDuck(g, s, cx, cy, time, reduced, items)
  const x = s.map.exam
  if (!x || x.over) return
  for (const p of mapInfo(world, s.map.id).pads) {
    if (!p.handin || p.cell !== x.cell || !seen(s, p)) continue
    const mx = p.x + p.size / 2
    // The isometric view stands the desk beside the niche in front of the pad: the words go high over it. From above
    // nothing is in the way, and they sit just over the pad, a little inward, clear of the room's edge and the chart.
    const iso = s.view === 'iso'
    const inward = (p.x % mapInfo(world, s.map.id).cw) < mapInfo(world, s.map.id).cw / 2 ? 0.75 : -0.75
    items.push({
      x: mx,
      y: p.y + p.size / 2,
      draw: () => {
        // (The D stands a little apart with a foot and a cap to its left: smoothed, a bare D of this font reads as an O.)
        const dAt = textWidth('HAN') + 2
        const inAt = dAt + textWidth('D') + 5
        const tw = inAt + textWidth('IN')
        const px = Math.round((mx + (iso ? 0 : inward)) * T - cx - tw / 2)
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
export function drawShape(g: G, st: Extract<Stencil, { t: 'disc' | 'box' | 'path' }>, cx: number, cy: number, time: number, reduced: boolean) {
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
// THE BENCHMARK TITAN: its two cards, and its fall
// ---------------------------------------------------------------------------

/** The picture on each kind's card. (The POT's is the pot itself; BEAM and OTHER, a plain brass weight.) */
const CARD_PIC: Record<TitanKind, string> = {
  BLADE: 'item_sword', SPIN: 'card_spin', POT: 'pot', BOULDER: 'card_boulder', BOMB: 'item_bombbag', DISC: 'item_disc', HOOK: 'item_hook',
  BEAM: 'item_weight', OTHER: 'item_weight',
}
/** A card, 3 tiles wide and 2 tall, and the room between the two. */
const CARD_W = 48
const CARD_H = 32
const CARD_GAP = 6

/** A figure's height over its feet, classic px, with its bar. */
const TITAN_HEAD = 52
/** On a wide HUD the hearts, the counters and the item box take this much of the left edge, down to `UNDER_HEARTS`. */
const HEARTS_WIDE = 122
const UNDER_HEARTS = 36
/** On a wide HUD the corner chart takes this much of the right edge, down to `UNDER_CORNER`. */
const CORNER_WIDE = 84

/**
 * The two cards over the Titan, the older left and the newer right, each a picture over the kind's word: gold-framed
 * while it is open, pink as a blow of that kind is turned aside, turning over as a new kind takes its place. They are
 * painted on the HUD's layer (crisp, over every light), `at` a ground point on it and `px` the HUD's px per classic
 * px of a standing figure: over its head, pushed no further than keeps them whole on the screen and clear of the
 * hearts, the item box and the corner chart.
 */
export function drawTitanCards(g: G, s: GameState, at: (x: number, y: number) => Vec, px: number, area: { vw: number; top: number; left: number; right: number }, time: number, reduced: boolean) {
  const e = s.map.enemies.find(o => o.kind === 'titan' && !o.dead && o.cell === s.zoneIndex)
  if (!e) return
  const now = titanCards(e)
  const flip = reduced ? 0 : ((e.ai.flip as number | undefined) ?? 0) / TITAN.flip
  // The first half of the turn shows what hung there before, closing; the second what hangs now, opening.
  const kinds = flip > 0.5 ? [(e.ai.was as TitanKind | undefined) ?? now[0], now[0]] as const : now
  const wide = Math.max(2, Math.round(CARD_W * (flip > 0 ? Math.abs(flip - 0.5) * 2 : 1)))
  const open = titanOpen(e)
  const both = CARD_W * 2 + CARD_GAP
  const feet = at(e.x, e.y + e.r)
  const x0 = Math.round(Math.max(area.left + 3, Math.min(area.vw - area.right - both - 3, feet.x - both / 2)))
  // How high they may go: between the two corners of a wide screen, to its top.
  const underCorner = area.vw < NARROW || x0 + both > area.vw - area.right - CORNER_WIDE
  const highest = underCorner ? UNDER_CORNER + 3 : x0 < area.left + HEARTS_WIDE ? UNDER_HEARTS : 3
  const y = Math.round(Math.max(area.top + highest, feet.y - TITAN_HEAD * px - CARD_H))
  kinds.forEach((kind, i) => {
    const x = x0 + i * (CARD_W + CARD_GAP) + Math.round((CARD_W - wide) / 2)
    const turned = ((e.ai.turnT as number | undefined) ?? 0) > 0 && e.ai.turned === kind
    const hot = turned && (reduced || Math.floor(time * 14) % 2 === 0)
    const rim = turned || open ? 1 : 0
    g.fillStyle = INK
    g.fillRect(x - 2, y - 2, wide + 4, CARD_H + 4)
    g.fillStyle = turned ? PINK : open ? GOLD : PAPER_EDGE
    g.fillRect(x - 1, y - 1, wide + 2, CARD_H + 2)
    g.fillStyle = hot ? PINK : turned ? PINK_LIGHT : PAPER
    g.fillRect(x + rim, y + rim, wide - rim * 2, CARD_H - rim * 2)
    if (wide < CARD_W / 2) return
    const pic = sprite(CARD_PIC[kind])
    const pw = Math.round((pic.width * wide) / CARD_W)
    g.drawImage(pic, x + Math.round((wide - pw) / 2), y + 3, pw, pic.height)
    if (wide === CARD_W) drawText(g, kind, x + Math.round((CARD_W - textWidth(kind)) / 2), y + 22, hot ? '#ffffff' : PEN)
  })
}

/** Seconds of the Titan's fall. */
export const TITAN_FALL = 1.4

/** It goes down where it stood, in its hurt pose (no picture of it fallen yet), and fades off what it sat on. */
export function drawTitanFall(g: G, t: number, x: number, feet: number, reduced: boolean) {
  const pic = sprite('titan_hurt')
  const k = Math.min(1, t / TITAN_FALL)
  const sink = reduced ? 0 : Math.round(k * k * 18)
  g.globalAlpha = Math.min(1, (1 - k) * 2)
  g.drawImage(pic, 0, 0, pic.width, pic.height - sink, Math.round(x - pic.width / 2), Math.round(feet - pic.height + sink), pic.width, pic.height - sink)
  g.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// The strip and the card
// ---------------------------------------------------------------------------

const RULE_NAMES = { r1: 'NO BLADE', r2: 'NOT A MACHINE', r3: 'TIME MOVES', r4: 'WEIGH HOUSE' } as const
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
  // While time waits, a small clock stands left of the rule's name, its hands still.
  const clock = timeStands(s) ? CLOCK + 3 : 0
  const w = Math.max(textWidth(name) + clock * 2, textWidth(score))
  const clear = Math.round((vw - w) / 2) < taken + 3 ? under : row
  const y = vw < NARROW ? Math.max(clear, UNDER_CORNER) : clear
  // A dark plate behind the two rows: they read over a lit wall as over the floor.
  g.fillStyle = 'rgba(11,6,22,0.62)'
  g.fillRect(Math.round((vw - w) / 2) - 3, y - 2, w + 6, ROW * 2 + 2)
  const nx = Math.round((vw - textWidth(name)) / 2)
  drawText(g, name, nx, y, colors.rule, colors.outline)
  if (clock) drawStillClock(g, nx - clock, y - 1)
  drawText(g, score, Math.round((vw - textWidth(score)) / 2), y + ROW, x.marks >= round.pass ? colors.pass : colors.text, colors.outline)
}

/** A 9 px clock face, its hands at ten to two. */
const CLOCK = 9
const CLOCK_ROWS = [
  '..kkkkk..',
  '.kwwwwwk.',
  'kwkwwwkwk',
  'kwwkwkwwk',
  'kwwwkwwwk',
  'kwwwwwwwk',
  'kwwwwwwwk',
  '.kwwwwwk.',
  '..kkkkk..',
]
function drawStillClock(g: G, x: number, y: number) {
  CLOCK_ROWS.forEach((row, j) => [...row].forEach((ch, i) => {
    if (ch === '.') return
    g.fillStyle = ch === 'k' ? INK : '#fff4ff'
    g.fillRect(x + i, y + j, 1, 1)
  }))
}


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
    const word = card.passed ? 'PASSED' : card.resit ? 'KEPT' : 'RESIT'
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
