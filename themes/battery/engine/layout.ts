/**
 * Where everything sits on the screen, in logical pixels: the scene, the
 * sentence line, the verbs, the inventory, the portraits and the dialogue
 * choices. Pure, so the engine can hit-test and tests can click.
 *
 * Wide screens get DOTT's 320×200 block (scene 144, panel 56), centred.
 * Tall screens (a phone held upright) get the scene in the middle and a big
 * thumb-sized panel anchored to the bottom.
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
  /** Empty space above the scene on tall screens (the renderer puts a header there). */
  header: Box | null
}

export function hit(b: Box, x: number, y: number): boolean {
  return x >= b.x && y >= b.y && x < b.x + b.w && y < b.y + b.h
}

export function layout(vw: number, vh: number, safeBottom = 0): Layout {
  const tall = vh >= vw * 1.3 && vh >= 320
  return tall ? tallLayout(vw, vh, safeBottom) : wideLayout(vw, vh)
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

function tallLayout(vw: number, vh: number, safeBottom: number): Layout {
  const m = 6
  const bottom = vh - Math.max(4, safeBottom)
  const pw = Math.floor((vw - m * 2 - 8) / 3)
  const portraitH = 38
  const portraits = HERO_IDS.map((hero, i) => ({ hero, x: m + i * (pw + 4), y: bottom - portraitH, w: pw, h: portraitH }))
  const cellW = 44
  const cellH = 36
  const cols = Math.max(3, Math.floor((vw - m * 2 - 20) / cellW))
  const rows = 2
  const invY = bottom - portraitH - 6 - rows * cellH
  const invX = Math.floor((vw - cols * cellW - 20) / 2) + 20
  const inv = { x: invX, y: invY, w: cols * cellW, h: rows * cellH }
  const invUp = { x: invX - 19, y: invY, w: 18, h: cellH }
  const invDown = { x: invX - 19, y: invY + cellH, w: 18, h: cellH }
  const vh3 = 26
  const verbY = invY - 6 - vh3 * 3
  const verbs = VERB_GRID.map((verb, i) => ({
    verb,
    x: m + (i % 3) * (pw + 4),
    y: verbY + Math.floor(i / 3) * vh3,
    w: pw,
    h: vh3 - 2,
  }))
  const sentence = { x: 0, y: verbY - 14, w: vw, h: 11 }
  const sceneY = Math.max(4, sentence.y - 4 - ROOM_H)
  const scene = { x: 0, y: sceneY, w: vw, h: ROOM_H }
  const choiceH = invY + rows * cellH - verbY
  const choices = { x: m, y: verbY, w: vw - m * 2 - 22, h: choiceH }
  const half = Math.floor(choiceH / 2)
  const choiceUp = { x: choices.x + choices.w + 2, y: verbY, w: 20, h: half - 1 }
  const choiceDown = { x: choiceUp.x, y: verbY + half, w: 20, h: choiceH - half }
  const header = sceneY > 24 ? { x: 0, y: 0, w: vw, h: sceneY } : null
  return {
    vw, vh, tall: true, scene, sentence, verbs, inv, cols, rows,
    cell: { w: cellW, h: cellH }, invUp, invDown, portraits,
    choices, choiceLineH: 16, choiceWrapH: 9, choiceUp, choiceDown, header,
  }
}
