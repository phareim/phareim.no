/**
 * Space Voyagers: the console, the ship's dashboard round the field. The
 * monitor (who is on the radio, the line typing out, a test card or the
 * sector's station ident in between) and the instruments (the score on a
 * counter that rolls, five valves, the weapon and its level, the DUET
 * needle, timed power-ups as lamps, the voyage on a strip chart, tows left).
 *
 * When a console bitmap is there, the instruments are drawn first and the
 * bitmap over them: they show through its transparent windows (the
 * rectangles in layout.ts). When it is not, the panel is drawn by code in
 * flat wood and metal with the same windows, so the game is whole either way.
 */
import { DUET, PARTNER, PICKUP, PLAYER, SECTORS } from '../engine/balance'
import { voyageProgress } from '../engine/flow'
import type { World } from '../engine/types'
import { ROW_CHARS } from '../story/cues'
import { rows as wrapRows } from '../story/director'
import type { Monitor } from '../story/director'
import type { Fx } from './fx'
import { roman } from './fx'
import { bandCrop } from './crops'
import { BAND_WINDOWS, LEFT_WINDOWS, RIGHT_WINDOWS } from './layout'
import type { Layout, Panel, Rect } from './layout'
import { C, INK, WHITE } from './palette'
import { clipTo, disc, frame, hash, line, rect, stipple, text, textC } from './pix'
import type { G } from './pix'
import type { SpriteStore } from './sprites'
import { textWidth } from '../../base/pixel/font'

const DIGITS = 7

export interface ConsoleState {
  /** The number the counter shows, on its way to the score. */
  shown: number
  /** Per wheel, right to left: how far it is through a roll (1 just begun, 0 at rest) and the digit it left. */
  roll: number[]
  from: number[]
  /** The line being typed, wrapped for the caption's width. */
  line: number
  width: number
  rows: string[]
  /** Ticks since the line began (a boss tears the picture as it cuts in). */
  lineT: number
  /** Ticks stepped, for the test card's turn with the ident. */
  t: number
}

export function createConsoleState(): ConsoleState {
  return { shown: 0, roll: new Array<number>(DIGITS).fill(0), from: new Array<number>(DIGITS).fill(0), line: -1, width: 0, rows: [], lineT: 0, t: 0 }
}

const digitAt = (v: number, i: number): number => Math.floor(v / 10 ** i) % 10

/** One tick of the game clock: the counter rolls towards the score. */
export function stepConsole(s: ConsoleState, w: World, m: Monitor): void {
  s.t++
  if (s.shown !== w.score) {
    const gap = w.score - s.shown
    const next = gap > 0 ? s.shown + Math.max(10, Math.ceil(gap / 8 / 10) * 10) : w.score
    const to = gap > 0 ? Math.min(w.score, next) : w.score
    for (let i = 0; i < DIGITS; i++) {
      const a = digitAt(s.shown, i)
      if (a !== digitAt(to, i) && s.roll[i]! <= 0) { s.roll[i] = 1; s.from[i] = a }
    }
    s.shown = to
  }
  for (let i = 0; i < DIGITS; i++) if (s.roll[i]! > 0) s.roll[i] = Math.max(0, s.roll[i]! - 0.25)
  if (m.speaking && m.line !== s.line) { s.line = m.line; s.lineT = 0; s.width = 0 } else s.lineT++
}

export function resetConsole(s: ConsoleState): void {
  s.shown = 0
  s.roll.fill(0)
  s.line = -1
  s.rows = []
}

export interface ConsoleView {
  reduced: boolean
  /** The run has not begun or is over: the monitor shows the test card. */
  idle: boolean
}

const off = (r: Rect, ox: number, oy: number): Rect => ({ x: r.x + ox, y: r.y + oy, w: r.w, h: r.h })

// ── The monitor ──────────────────────────────────────────────────────────

const BARS = ['#d8d0b4', '#d8c040', '#4cb8b0', '#5aa84a', '#b85aa0', '#c04a3a', '#3a4ea8']

function testCard(g: G, r: Rect): void {
  const bw = Math.ceil(r.w / BARS.length)
  for (let i = 0; i < BARS.length; i++) rect(g, BARS[i]!, r.x + i * bw, r.y, bw, r.h)
  const low = Math.round(r.h * 0.72)
  rect(g, C.glass, r.x, r.y + low, r.w, r.h - low)
  for (let i = 0; i < 6; i++) rect(g, i & 1 ? '#d8d0b4' : C.metalLo, r.x + Math.round((i * r.w) / 6), r.y + low + 3, Math.ceil(r.w / 6), Math.max(2, r.h - low - 6))
  const cx = r.x + (r.w >> 1)
  const cy = r.y + Math.round(r.h * 0.36)
  disc(g, C.glass, cx, cy, Math.round(r.w * 0.2))
  disc(g, '#d8d0b4', cx, cy, Math.round(r.w * 0.2) - 2)
  rect(g, C.glass, cx - Math.round(r.w * 0.2), cy, Math.round(r.w * 0.4), 1)
  rect(g, C.glass, cx, cy - Math.round(r.w * 0.2), 1, Math.round(r.w * 0.4))
}

/** Each sector's station between lines: a few flat colours and its call sign. */
const IDENTS: readonly { a: string; b: string; c: string; top: string; low: string }[] = [
  { a: '#3a4ea8', b: '#ff7ab8', c: '#ffd23f', top: 'LOVE', low: '96.9' },
  { a: '#5c2e14', b: '#ff8a3d', c: '#fff6e0', top: 'CB', low: '19' },
  { a: '#b85aa0', b: '#ff8a3d', c: '#ffd23f', top: 'SHAG', low: '96.9' },
  { a: '#343e58', b: '#8090ac', c: '#c4d0d8', top: 'NO', low: 'BAND' },
  { a: '#32204e', b: '#b48cff', c: '#fff6e0', top: 'THE', low: 'END' },
]

function ident(g: G, r: Rect, sector: number, t: number, reduced: boolean): void {
  const id = IDENTS[(sector - 1) % IDENTS.length]!
  rect(g, id.a, r.x, r.y, r.w, r.h)
  if (sector === 4) {
    // The Dead Band: no station, snow.
    stipple(g, id.b, r.x, r.y, r.w, r.h, 4, reduced ? 0 : t >> 2)
    stipple(g, id.c, r.x, r.y, r.w, r.h, 4, reduced ? 2 : (t >> 3) + 2)
  } else {
    // Op-art: rings of two flat tones round the middle.
    const cx = r.x + (r.w >> 1)
    const cy = r.y + (r.h >> 1)
    for (let k = Math.round(r.w * 0.7); k > 4; k -= 8) disc(g, (k >> 3) & 1 ? id.b : id.a, cx, cy, k)
  }
  const mid = r.y + (r.h >> 1)
  rect(g, INK, r.x, mid - 11, r.w, 22)
  textC(g, id.top, r.x + r.w / 2, mid - 9, id.c)
  textC(g, id.low, r.x + r.w / 2, mid + 2, id.b)
}

function portrait(g: G, sprites: SpriteStore, r: Rect, w: World, m: Monitor, s: ConsoleState, fx: Fx, v: ConsoleView): void {
  clipTo(g, r, () => {
    rect(g, C.glass, r.x, r.y, r.w, r.h)
    if (m.speaking && m.who) {
      const name = `portrait-${m.who}-${m.mood}`
      const size = sprites.size(name)
      // A narrow screen's window is smaller than the portrait: it shows the face (crops.ts), not the middle.
      const at = bandCrop(m.who, m.mood)
      if (size.w <= r.w || !sprites.blit(g, name, r.x, r.y, at[0], at[1], r.w, r.h)) sprites.draw(g, name, r.x + r.w / 2, r.y + r.h / 2)
      if (size.w < r.w) frame(g, C.glassHi, r.x, r.y, r.w, r.h)
    } else if (v.idle || (s.t >> 9) % 3 === 2) testCard(g, r)
    else ident(g, r, w.sector, s.t, v.reduced)
    // A boss cutting in tears the picture for a moment.
    const tearing = !v.reduced && ((m.speaking && m.cutsIn && s.lineT < 26) || fx.tear > 0)
    if (tearing) {
      const step = s.t >> 1
      for (let y = 0; y < r.h;) {
        const k = hash(step, y)
        const h = 2 + (k % 7)
        const shift = ((k >>> 5) % 15) - 7
        if (shift !== 0) g.drawImage(g.canvas, r.x, r.y + y, r.w, h, r.x + shift, r.y + y, r.w, h)
        if ((k & 3) === 0) stipple(g, WHITE, r.x, r.y + y, r.w, 1, 2, k)
        y += h
      }
    }
  })
}

function caption(g: G, r: Rect, m: Monitor, s: ConsoleState): void {
  rect(g, C.glass, r.x, r.y, r.w, r.h)
  if (!m.speaking) return
  const chars = Math.max(8, Math.min(ROW_CHARS, Math.floor((r.w - 2) / 6)))
  if (s.width !== chars || s.line !== m.line) { s.rows = wrapRows(m.text, chars); s.width = chars; s.line = m.line }
  // What has been typed so far, row by row (a break swallows one space).
  let left = m.chars
  const typed: string[] = []
  for (const row of s.rows) {
    if (left <= 0) break
    typed.push(row.slice(0, left))
    left -= row.length + 1
  }
  const max = Math.max(1, Math.floor((r.h + 2) / 10))
  const from = Math.max(0, typed.length - max)
  const color = m.cutsIn ? C.pink : C.text
  const x = r.x + Math.max(1, (r.w - (chars * 6 - 1)) >> 1)
  const pitch = Math.min(10, Math.floor(r.h / max))
  for (let i = from; i < typed.length; i++) text(g, typed[i]!, x, r.y + 1 + (i - from) * pitch, color)
  if (m.chars < m.text.length && typed.length > 0 && (s.lineT >> 2) & 1) {
    const last = typed[typed.length - 1]!
    rect(g, color, x + textWidth(last) + 2, r.y + 1 + (typed.length - 1 - from) * pitch, 4, 7)
  }
}

function plate(g: G, r: Rect, s: string, paper: boolean): void {
  rect(g, paper ? C.face : C.glass, r.x, r.y, r.w, r.h)
  if (s) textC(g, s, r.x + r.w / 2, r.y + ((r.h - 7) >> 1), paper ? INK : C.gold)
}

// ── The instruments ──────────────────────────────────────────────────────

/** The score on wheels: a wheel whose digit changes rolls the old one up and the new one in from below. */
function counter(g: G, r: Rect, s: ConsoleState): void {
  const cell = Math.floor(r.w / DIGITS)
  const x0 = r.x + ((r.w - cell * DIGITS) >> 1)
  rect(g, INK, r.x, r.y, r.w, r.h)
  for (let i = 0; i < DIGITS; i++) {
    const cx = x0 + (DIGITS - 1 - i) * cell
    const cellR = { x: cx + 1, y: r.y, w: cell - 1, h: r.h }
    clipTo(g, cellR, () => {
      rect(g, C.face, cellR.x, cellR.y, cellR.w, cellR.h)
      const now = digitAt(s.shown, i)
      const up = Math.round(s.roll[i]! * r.h)
      const ty = r.y + ((r.h - 7) >> 1)
      const tx = cellR.x + ((cellR.w - 5) >> 1)
      text(g, String(now), tx, ty + up, INK)
      if (up > 0) text(g, String(s.from[i]!), tx, ty + up - r.h, INK)
      rect(g, C.faceLo, cellR.x, cellR.y, cellR.w, 1)
      rect(g, C.faceLo, cellR.x, cellR.y + cellR.h - 1, cellR.w, 1)
    })
  }
}

function valves(g: G, sprites: SpriteStore, r: Rect, w: World, fx: Fx, small: boolean): void {
  rect(g, C.glass, r.x, r.y, r.w, r.h)
  const hull = w.player.hull
  const blink = fx.valveT < 24 && (fx.valveT >> 2) & 1
  if (small) {
    // Five small valves, then the tows as two hooks.
    for (let i = 0; i < PLAYER.hull; i++) {
      const x = r.x + 2 + i * 9
      const on = i < hull && !(blink && i === hull - 1)
      rect(g, C.metalLo, x, r.y + r.h - 3, 7, 2)
      rect(g, on ? C.bass : C.metalLo, x + 1, r.y + 2, 5, r.h - 5)
      rect(g, on ? C.bolt : C.glassHi, x + 2, r.y + 3, 2, r.h - 8)
      rect(g, on ? C.bass : C.metalLo, x + 2, r.y + 1, 3, 1)
    }
    for (let i = 0; i < PLAYER.tows; i++) {
      const x = r.x + 49 + i * 5
      rect(g, i < w.player.tows ? C.cable : C.metalLo, x, r.y + 3, 3, r.h - 6)
      rect(g, C.glass, x + 1, r.y + 4, 2, r.h - 9)
    }
    return
  }
  const pitch = Math.floor(r.w / PLAYER.hull)
  const painted = sprites.ready('valve-on') && sprites.ready('valve-off')
  const valve = sprites.size('valve-on')
  for (let i = 0; i < PLAYER.hull; i++) {
    const on = i < hull && !(blink && i === hull - 1)
    const cx = r.x + pitch * i + (pitch >> 1)
    // Both bitmaps are one canvas (12 x 24): put on the same corner, the lit valve does not jump when it pops.
    if (painted) { sprites.blit(g, on ? 'valve-on' : 'valve-off', cx - (valve.w >> 1), r.y + ((r.h - valve.h) >> 1)); continue }
    // No bitmap: a valve in four flat tones, lit or dark.
    rect(g, C.metalLo, cx - 5, r.y + r.h - 5, 10, 4)
    rect(g, on ? C.bass : C.metalLo, cx - 4, r.y + 4, 8, r.h - 9)
    rect(g, on ? C.bass : C.metalLo, cx - 2, r.y + 2, 4, 2)
    rect(g, on ? C.bolt : C.glassHi, cx - 2, r.y + 7, 3, r.h - 15)
  }
}

const WEAPON_SHORT: Record<string, string> = { blaster: 'BLAST', disc: 'DISC', boombox: 'BOOM' }

function weapon(g: G, sprites: SpriteStore, r: Rect, w: World, fx: Fx, small: boolean): void {
  rect(g, C.glass, r.x, r.y, r.w, r.h)
  const p = w.player
  const lit = fx.weaponT < 30 && (fx.weaponT >> 2) & 1
  if (small) {
    text(g, WEAPON_SHORT[p.weapon] ?? '', r.x + 2, r.y + 1, lit ? WHITE : C.gold)
    text(g, String(p.level), r.x + r.w - 7, r.y + 1, lit ? WHITE : C.text)
    return
  }
  sprites.draw(g, `pick-${p.weapon}`, r.x + r.w / 2, r.y + 12)
  textC(g, p.weapon.toUpperCase(), r.x + r.w / 2, r.y + 24, lit ? WHITE : C.gold)
  for (let i = 0; i < 5; i++) {
    const x = r.x + 5 + i * 8
    rect(g, C.metalLo, x, r.y + 36, 6, 7)
    if (i < p.level) { rect(g, lit ? WHITE : C.bass, x + 1, r.y + 37, 4, 5); rect(g, C.bolt, x + 1, r.y + 37, 4, 1) }
  }
}

/** The DUET needle over the painted meter (or a face drawn here when there is no bitmap). */
function vu(g: G, face: Rect, w: World, painted: boolean, reduced: boolean): void {
  if (!painted) {
    rect(g, C.metalLo, face.x - 2, face.y - 2, face.w + 4, face.h + 4)
    rect(g, C.face, face.x, face.y, face.w, face.h)
    for (let i = 0; i <= 10; i++) {
      const a = (-55 + i * 11) * (Math.PI / 180)
      const px = face.x + face.w / 2 + Math.sin(a) * 30
      const py = face.y + face.h - 4 - Math.cos(a) * 30
      rect(g, i >= 8 ? C.needle : INK, Math.round(px), Math.round(py), 1, 3)
    }
  }
  const playing = w.duet > 0
  let v = playing ? 0.85 + 0.15 * (w.duet / DUET.ticks) : Math.max(0, Math.min(1, w.duetMeter))
  if (playing && !reduced) v += ((hash(w.tick >> 1, 3) % 5) - 2) * 0.012
  const a = (-55 + 110 * v) * (Math.PI / 180)
  const px = face.x + (face.w >> 1)
  const py = face.y + face.h - 4
  line(g, C.needle, px, py, px + Math.sin(a) * 31, py - Math.cos(a) * 31)
  rect(g, INK, px - 1, py - 1, 3, 3)
  if (w.duetMeter >= 1 && !playing && (reduced || (w.tick >> 3) & 1)) text(g, 'DUET', face.x + 3, face.y + face.h - 9, C.needle)
}

function duetBar(g: G, r: Rect, w: World, reduced: boolean): void {
  rect(g, C.glass, r.x, r.y, r.w, r.h)
  const playing = w.duet > 0
  const v = playing ? w.duet / DUET.ticks : Math.max(0, Math.min(1, w.duetMeter))
  const fill = Math.round((r.w - 2) * v)
  const ready = w.duetMeter >= 1 && !playing
  const c = playing ? C.pink : ready && (reduced || (w.tick >> 3) & 1) ? WHITE : C.bass
  rect(g, c, r.x + 1, r.y + 1, fill, r.h - 2)
  if (!playing && !ready) stipple(g, C.glass, r.x + 1, r.y + 1, fill, r.h - 2, 2)
  for (let i = 1; i < 4; i++) rect(g, C.glass, r.x + Math.round((r.w * i) / 4), r.y, 1, r.h)
}

interface Lamp { code: string; share: number; color: string }

/** The timed power-ups running now, with the share of their time that is left. */
export function lamps(w: World): Lamp[] {
  const p = w.player
  return [
    { code: 'MG', share: p.magnet / PICKUP.magnetTicks, color: C.red },
    { code: 'X2', share: p.quarter / PICKUP.quarterTicks, color: C.gold },
    { code: 'TR', share: w.slow / PICKUP.trackingTicks, color: C.disc },
    { code: 'EH', share: w.cloud.active ? w.cloud.t / PICKUP.cloudTicks : 0, color: C.cloud },
    { code: 'DK', share: w.partner.state === 'docked' ? w.partner.dock / PARTNER.dockTicks : 0, color: C.green },
    { code: 'BB', share: p.bubble / PICKUP.bubbleHits, color: C.bubble },
  ]
}

function lampRow(g: G, r: Rect, w: World): void {
  rect(g, C.glass, r.x, r.y, r.w, r.h)
  const all = lamps(w)
  const cell = Math.floor(r.w / all.length)
  for (let i = 0; i < all.length; i++) {
    const l = all[i]!
    const x = r.x + i * cell + ((cell - 11) >> 1)
    const on = l.share > 0
    text(g, l.code, x, r.y + 1, on ? l.color : C.glassHi)
    rect(g, C.glassHi, x, r.y + r.h - 3, 11, 2)
    if (on) rect(g, l.color, x, r.y + r.h - 3, Math.max(1, Math.round(11 * Math.min(1, l.share))), 2)
  }
}

/** The lit lamps alone, stacked in a corner of the field: for a screen with no room for the row. */
export function lampStack(g: G, x: number, y: number, w: World): void {
  let row = 0
  for (const l of lamps(w)) {
    if (l.share <= 0) continue
    text(g, l.code, x, y + row * 12, l.color, INK)
    rect(g, INK, x - 1, y + row * 12 + 8, 13, 3)
    rect(g, l.color, x, y + row * 12 + 9, Math.max(1, Math.round(11 * Math.min(1, l.share))), 1)
    row++
  }
}

/** The voyage as a strip chart: five sectors of paper, a trace as far as the run has got, a pen at the sector. */
function chart(g: G, r: Rect, w: World): void {
  rect(g, C.glass, r.x, r.y, r.w, r.h)
  const paper = { x: r.x + 2, y: r.y + 2, w: r.w - 4, h: r.h - 14 }
  rect(g, C.face, paper.x, paper.y, paper.w, paper.h)
  const n = SECTORS.length
  for (let i = 0; i < n; i++) {
    const x = paper.x + Math.round((paper.w * i) / n)
    if (i > 0) line(g, C.faceLo, x, paper.y, x, paper.y + paper.h - 1, 2)
    text(g, String(i + 1), x + 3, paper.y + 2, i + 1 === w.sector ? C.needle : C.faceLo)
  }
  const reach = Math.round(paper.w * voyageProgress(w))
  let py = paper.y + paper.h - 5
  for (let x = 0; x < reach; x++) {
    const k = hash(x >> 2, w.voyage * 31 + 5)
    const ny = paper.y + paper.h - 4 - (k % 9) - (x % Math.round(paper.w / n) > paper.w / n - 6 ? 6 : 0)
    rect(g, C.needle, paper.x + x, Math.min(py, ny), 1, Math.abs(ny - py) + 1)
    py = ny
  }
  // The pen.
  const px = paper.x + Math.min(paper.w - 2, reach)
  rect(g, INK, px, paper.y, 1, paper.h)
  rect(g, INK, px - 1, py - 1, 3, 3)
  // Under the paper: tows left, and the voyage.
  const ty = r.y + r.h - 10
  text(g, 'TOW', r.x + 3, ty + 1, C.textDim)
  for (let i = 0; i < PLAYER.tows; i++) {
    const x = r.x + 24 + i * 8
    rect(g, i < w.player.tows ? C.cable : C.metalLo, x, ty + 1, 6, 7)
    rect(g, C.glass, x + 2, ty + 2, 4, 3)
  }
  const voyage = `VOYAGE ${roman(w.voyage)}`
  text(g, voyage, r.x + r.w - 3 - textWidth(voyage), ty + 1, C.gold)
}

// ── The panels ───────────────────────────────────────────────────────────

/** A panel drawn by code: flat wood or metal, and a bezel round each window. */
function chrome(g: G, r: Rect, wood: boolean, windows: Rect[]): void {
  const base = wood ? C.wood : C.metal
  const hi = wood ? C.woodHi : C.metalHi
  const lo = wood ? C.woodLo : C.metalLo
  rect(g, base, r.x, r.y, r.w, r.h)
  for (let y = r.y + 5; y < r.y + r.h; y += wood ? 7 : 29) {
    const k = hash(y, r.x)
    if (wood) { rect(g, lo, r.x + (k % 40), y, 30 + (k >>> 7) % 90, 1); rect(g, hi, r.x + ((k >>> 3) % 120), y + 3, 20 + (k >>> 11) % 40, 1) } else rect(g, lo, r.x, y, r.w, 1)
  }
  rect(g, hi, r.x, r.y, r.w, 1)
  rect(g, lo, r.x, r.y + r.h - 1, r.w, 1)
  rect(g, lo, r.x, r.y, 1, r.h)
  rect(g, lo, r.x + r.w - 1, r.y, 1, r.h)
  for (const win of windows) {
    rect(g, lo, win.x - 4, win.y - 4, win.w + 8, win.h + 8)
    rect(g, wood ? C.metalHi : hi, win.x - 3, win.y - 3, win.w + 6, win.h + 6)
    rect(g, INK, win.x - 1, win.y - 1, win.w + 2, win.h + 2)
  }
}

export interface ConsoleArgs {
  g: G
  layout: Layout
  sprites: SpriteStore
  world: World
  monitor: Monitor
  fx: Fx
  state: ConsoleState
  view: ConsoleView
}

function leftPanel(a: ConsoleArgs, p: Panel): void {
  const { g, sprites, world: w, monitor: m, fx, state: s, view: v } = a
  const ox = p.x - p.srcX
  const win = LEFT_WINDOWS
  const r = { portrait: off(win.portrait, ox, p.y), name: off(win.name, ox, p.y), channel: off(win.channel, ox, p.y), caption: off(win.caption, ox, p.y) }
  const inside = (): void => {
    portrait(g, sprites, r.portrait, w, m, s, fx, v)
    plate(g, r.name, m.speaking ? m.name : '', true)
    plate(g, r.channel, m.speaking ? m.channel : '', false)
    caption(g, r.caption, m, s)
  }
  clipTo(g, p, () => {
    if (sprites.ready('console-left')) {
      inside()
      sprites.blit(g, 'console-left', p.x, p.y, p.srcX, 0, p.w, p.h)
    } else {
      chrome(g, p, true, Object.values(r))
      inside()
    }
  })
}

function rightPanel(a: ConsoleArgs, p: Panel): void {
  const { g, sprites, world: w, fx, state: s, view: v } = a
  const ox = p.x - p.srcX
  const win = RIGHT_WINDOWS
  const r = {
    score: off(win.score, ox, p.y), valves: off(win.valves, ox, p.y), weapon: off(win.weapon, ox, p.y),
    lamps: off(win.lamps, ox, p.y), chart: off(win.chart, ox, p.y),
  }
  const face = off(win.vu, ox, p.y)
  const inside = (): void => {
    counter(g, r.score, s)
    valves(g, sprites, r.valves, w, fx, false)
    weapon(g, sprites, r.weapon, w, fx, false)
    lampRow(g, r.lamps, w)
    chart(g, r.chart, w)
  }
  clipTo(g, p, () => {
    const painted = sprites.ready('console-right')
    if (painted) {
      inside()
      sprites.blit(g, 'console-right', p.x, p.y, p.srcX, 0, p.w, p.h)
    } else {
      chrome(g, p, false, Object.values(r))
      inside()
    }
    vu(g, face, w, painted, v.reduced)
  })
}

function band(a: ConsoleArgs, p: Panel): void {
  const { g, sprites, world: w, monitor: m, fx, state: s, view: v } = a
  // When the band is cut short (a very low window) its lower rows are the ones shown.
  const cut = 96 - p.h
  const oy = p.y - cut
  const win = BAND_WINDOWS
  const r = {
    portrait: off(win.portrait, p.x, oy), caption: off(win.caption, p.x, oy), score: off(win.score, p.x, oy),
    valves: off(win.valves, p.x, oy), weapon: off(win.weapon, p.x, oy), duet: off(win.duet, p.x, oy),
  }
  const inside = (): void => {
    portrait(g, sprites, r.portrait, w, m, s, fx, v)
    caption(g, r.caption, m, s)
    counter(g, r.score, s)
    valves(g, sprites, r.valves, w, fx, true)
    weapon(g, sprites, r.weapon, w, fx, true)
    duetBar(g, r.duet, w, v.reduced)
  }
  clipTo(g, p, () => {
    if (sprites.ready('console-band')) {
      inside()
      sprites.blit(g, 'console-band', p.x, p.y, 0, cut, p.w, p.h)
    } else {
      chrome(g, { x: p.x, y: oy, w: p.w, h: 96 }, true, Object.values(r))
      inside()
      text(g, 'DUET', r.duet.x - 27, r.duet.y, C.face)
    }
  })
}

/**
 * The rows above the band, top to bottom: the name plate, the channel, the lamps, the voyage chart.
 * Each goes beside the radio widget when it is narrow enough to, else under it, and is left out
 * when the rows are used up.
 */
function strip(a: ConsoleArgs, r: Rect): boolean {
  const { g, layout: L, world: w, monitor: m } = a
  let hasLamps = false
  let y = r.y + 2
  const clearY = r.y + L.stripClearY
  const place = (width: number, height: number): Rect | null => {
    let wd = width
    if (y < clearY && wd > L.stripClearW - 6) {
      // Too wide to stand beside the widget: the name plate may shrink, the rest goes under it.
      if (width === 104 && L.stripClearW >= 76) wd = L.stripClearW - 6
      else y = clearY + 2
    }
    if (y + height > r.y + r.h - 1) return null
    const out = { x: y >= clearY ? r.x + ((r.w - wd) >> 1) : r.x + 3, y, w: wd, h: height }
    rect(g, C.woodLo, out.x - 2, out.y - 2, out.w + 4, out.h + 4)
    y += height + 3
    return out
  }
  clipTo(g, r, () => {
    chrome(g, r, true, [])
    const name = place(104, 9)
    if (name) plate(g, name, m.speaking ? m.name : '', true)
    const channel = name ? place(84, 9) : null
    if (channel) plate(g, channel, m.speaking ? m.channel : '', false)
    const lr = place(100, 12)
    if (lr) { lampRow(g, lr, w); hasLamps = true }
    const cr = lr ? place(150, 40) : null
    if (cr) chart(g, cr, w)
  })
  return hasLamps
}

/** Draw the console. Returns false when the lamps found no room and belong in the field's corner. */
export function drawConsole(a: ConsoleArgs): boolean {
  const { g, layout: L } = a
  if (L.mode === 'wide') {
    if (L.left) leftPanel(a, L.left)
    if (L.right) {
      if (L.rightPad > 0) chrome(g, { x: L.right.x, y: L.right.y - L.rightPad, w: L.right.w, h: L.rightPad }, false, [])
      rightPanel(a, L.right)
    }
    return true
  }
  let hasLamps = false
  if (L.strip) hasLamps = strip(a, L.strip)
  if (L.band && L.band.h > 0) band(a, L.band)
  return hasLamps
}
