/**
 * Where everything sits on the screen, in logical pixels: the scene, the
 * sentence line, the verbs, the inventory, the portraits and the dialogue
 * choices. Pure, so the engine can hit-test and tests can click.
 *
 * Wide screens get DOTT's 320×200 block (scene 144, panel 56), centred.
 * Tall screens (a phone held upright) zoom in: a view about 160 wide, so
 * the scene fills the width at a bigger scale, sitting on a thumb-sized
 * panel anchored to the bottom. The camera scrolls more; nothing is lost.
 */
import type { HeroId, Verb } from '../types'
import { HERO_IDS, ROOM_H, VERB_GRID } from '../types'

export interface Box { x: number; y: number; w: number; h: number }

export interface Layout {
  vw: number
  vh: number
  tall: boolean
  scene: Box
  sentence: Box
  verbs: (Box & { verb: Verb })[]
  /** The whole inventory area (choices use verbs + inventory together). */
  inv: Box
  cols: number
  rows: number
  cell: { w: number; h: number }
  invUp: Box
  invDown: Box
  portraits: (Box & { hero: HeroId })[]
  /** Dialogue options; the arrows sit in a column at its right edge. */
  choices: Box
  /** Height of a one-line option; each wrapped line adds choiceWrapH. */
  choiceLineH: number
  choiceWrapH: number
  choiceUp: Box
  choiceDown: Box
  /** Space above the scene on tall screens (the renderer names the room there). */
  header: Box | null
}

export function hit(b: Box, x: number, y: number): boolean {
  return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h
}

/** The phone panel at its smallest: sentence, three verb rows, two inventory rows, the faces, gaps. */
export const TALL_PANEL_MIN = 11 + 3 * 16 + 3 + 2 * 22 + 3 + 20 + 3

/** A phone's view is at least this wide: less of the room than DOTT's 320, but bigger. */
export const TALL_MIN_W = 160

export function isTall(vw: number, vh: number): boolean {
  return vh >= vw * 1.3 && vh >= ROOM_H + TALL_PANEL_MIN
}

/**
 * The stage's minimum logical size for a screen (CSS px), so the pixel
 * stage picks the biggest whole-number scale that still fits: on a phone
 * held upright that is a view TALL_MIN_W wide with the scene and the panel
 * stacked between the safe areas; elsewhere DOTT's 320×200.
 */
export function stageMin(cssW: number, cssH: number, safeTop = 0, safeBottom = 0): [number, number] {
  if (cssH <= cssW * 1.3) return [320, 200]
  const free = Math.max(1, cssH - safeTop - safeBottom)
  return [TALL_MIN_W, Math.ceil((ROOM_H + TALL_PANEL_MIN + 3) * cssH / free)]
}

export function layout(vw: number, vh: number, safeBottom = 0, safeTop = 0): Layout {
  return isTall(vw, vh) ? tallLayout(vw, vh, safeBottom, safeTop) : wideLayout(vw, vh)
}

function wideLayout(vw: number, vh: number): Layout {
  const top = Math.max(0, Math.floor((vh - 200) / 2))
  const scene = { x: 0, y: top, w: vw, h: ROOM_H }
  const py = top + ROOM_H
  const sentence = { x: 0, y: py + 1, w: vw, h: 9 }
  const ay = py + 11
  // Centre a 320-wide panel on wider screens.
  const px = Math.max(0, Math.floor((vw - 320) / 2))
  const vwid = 44
  const vhgt = 15
  const verbs = VERB_GRID.map((verb, i) => ({
    verb,
    x: px + 2 + (i % 3) * vwid,
    y: ay + Math.floor(i / 3) * vhgt,
    w: vwid,
    h: vhgt,
  }))
  const invX = px + 2 + 3 * vwid + 12
  const portraitW = 26
  const invW = px + 320 - portraitW - 4 - invX
  const cellW = 26
  const cellH = 22
  const cols = Math.max(1, Math.floor(invW / cellW))
  const rows = 2
  const inv = { x: invX, y: ay, w: cols * cellW, h: rows * cellH }
  const invUp = { x: invX - 11, y: ay, w: 10, h: cellH }
  const invDown = { x: invX - 11, y: ay + cellH, w: 10, h: cellH }
  const portraits = HERO_IDS.map((hero, i) => ({ hero, x: px + 320 - portraitW - 1, y: ay + i * 15, w: portraitW, h: 15 }))
  const choices = { x: px + 4, y: ay, w: 320 - 8 - portraitW - 4 - 12, h: 45 }
  const choiceUp = { x: choices.x + choices.w + 1, y: ay, w: 10, h: 22 }
  const choiceDown = { x: choiceUp.x, y: ay + 23, w: 10, h: 22 }
  return {
    vw, vh, tall: false, scene, sentence, verbs, inv, cols, rows,
    cell: { w: cellW, h: cellH }, invUp, invDown, portraits,
    choices, choiceLineH: 9, choiceWrapH: 8, choiceUp, choiceDown, header: null,
  }
}

function tallLayout(vw: number, vh: number, safeBottom: number, safeTop: number): Layout {
  const m = 4
  const gap = 3
  const bottom = vh - Math.max(3, safeBottom)
  // Everything grows from its minimum while there is room, round-robin, so
  // a long phone gets bigger buttons before any space is left over.
  const size = { verb: 15, cell: 22, face: 20 }
  const cap = { verb: 22, cell: 32, face: 30 }
  let extra = bottom - safeTop - ROOM_H - TALL_PANEL_MIN
  for (let grew = true; extra > 0 && grew;) {
    grew = false
    for (const k of ['verb', 'cell', 'face'] as const) {
      const cost = k === 'verb' ? 3 : k === 'cell' ? 2 : 1
      if (size[k] < cap[k] && extra >= cost) { size[k]++; extra -= cost; grew = true }
    }
  }
  const pw = Math.floor((vw - m * 2 - gap * 2) / 3)
  const portraitH = size.face
  const portraits = HERO_IDS.map((hero, i) => ({ hero, x: m + i * (pw + gap), y: bottom - portraitH, w: pw, h: portraitH }))
  const arrowW = 14
  const invSpan = vw - m * 2 - arrowW - 2
  const cols = Math.max(3, Math.floor(invSpan / 32))
  const cellW = Math.floor(invSpan / cols)
  const cellH = size.cell
  const rows = 2
  const invY = bottom - portraitH - gap - rows * cellH
  const invX = m + arrowW + 2 + Math.floor((invSpan - cols * cellW) / 2)
  const inv = { x: invX, y: invY, w: cols * cellW, h: rows * cellH }
  const invUp = { x: m, y: invY, w: arrowW, h: cellH }
  const invDown = { x: m, y: invY + cellH, w: arrowW, h: cellH }
  const vrow = size.verb + 1
  const verbY = invY - gap - vrow * 3
  const verbs = VERB_GRID.map((verb, i) => ({
    verb,
    x: m + (i % 3) * (pw + gap),
    y: verbY + Math.floor(i / 3) * vrow,
    w: pw,
    h: size.verb,
  }))
  const sentence = { x: 0, y: verbY - 11, w: vw, h: 10 }
  // The scene sits on the panel; what is left above it holds the room's name.
  const sceneY = Math.max(safeTop, sentence.y - 1 - ROOM_H)
  const scene = { x: 0, y: sceneY, w: vw, h: ROOM_H }
  const choiceH = invY + rows * cellH - verbY
  const choices = { x: m, y: verbY, w: vw - m * 2 - arrowW - 2, h: choiceH }
  const half = Math.floor(choiceH / 2)
  const choiceUp = { x: choices.x + choices.w + 2, y: verbY, w: arrowW, h: half - 1 }
  const choiceDown = { x: choiceUp.x, y: verbY + half, w: arrowW, h: choiceH - half }
  const header = sceneY - safeTop >= 12 ? { x: 0, y: safeTop, w: vw, h: sceneY - safeTop } : null
  return {
    vw, vh, tall: true, scene, sentence, verbs, inv, cols, rows,
    cell: { w: cellW, h: cellH }, invUp, invDown, portraits,
    choices, choiceLineH: 13, choiceWrapH: 8, choiceUp, choiceDown, header,
  }
}
