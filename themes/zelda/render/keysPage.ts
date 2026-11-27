/**
 * The KEYS page of the menu, the ITEMS page's sibling, beside a keyboard only: no window and no HUD, the corner's
 * colours on the page's own veil (`PAGE_VEIL`). From the top: the menu's tabs; PLAY and MENU, a row for each action
 * that can be given another key, its name at the left and its key in a small framed cell at the right; RESET ALL;
 * a line for a browser that is not signed in; and the last line, which says what the keys do just now.
 *
 * On a screen wider than tall PLAY and MENU stand beside each other where both fit whole; else it is one column, as
 * many whole rows to a page as fit, a section's word again over a page it goes on to, and MORE to turn the page. The
 * page up is the one the cursor stands on. Nothing scrolls.
 *
 * `keysPageLayout` is pure and says where everything goes; the shell lays a button over each row, RESET ALL and MORE
 * (`KeysPageButtons.vue`) and holds the page's state (`keysShell.ts`). `drawKeysPage` paints. Neither knows which key
 * does what: the rows arrive with their names.
 */
import type { HudKeys } from '../keys'
import { drawMenuTabs, hudFont, menuTabsBox, menuTabsY, type HudFont, type HudSkin } from './hud'
import { CORNER_SKIN } from './corner'
import { MARK_INKS, type Box } from './worldMap'
import { PAGE_VEIL, pageBottom } from './mapPage'

type G = CanvasRenderingContext2D

export interface KeysRow { section: 'PLAY' | 'MENU'; name: string; key: string }

/** What the page shows just now. The cursor stands on a row, or on RESET ALL (`rows.length`). */
export interface KeysView {
  rows: KeysRow[]
  cursor: number
  /** The cursor's row waits for its new key. */
  capturing: boolean
  /** RESET ALL has been pressed once. */
  armed: boolean
  /** The row that changed places with the last one changed. */
  lit: number | null
  /** The rows flashing at this moment. */
  flash: number[]
  /** The last line. */
  last: string
  /** Not signed in: the line that says what signing in would do. */
  signIn: boolean
}

export const SIGN_IN_LINE = 'SIGN IN TO SYNC DEVICES.'
export const RESET_WORDS = 'RESET ALL'
export const AGAIN_WORDS = 'PRESS AGAIN'
export const REFUSED_WORDS = 'NOT THAT KEY'
export const CAPTURE_WORDS = '...'

const SKIN = CORNER_SKIN
const WHITE = MARK_INKS.P
/** A section's word: the lilac, dimmed. */
const DIM_LILAC = '#8d7cc4'
/** A key cell's ground and edge, the corner's cap look. */
const FILL = '#1d1236'
const QUIET = '#6a5aa8'

/** A line of lettering. */
const LINE = 7
const SIDE = 2
const CELL_H = 11
const CELL_LEAST = 13
/** The widest a column grows, and the room between the two. */
const COLUMN = 156
const BETWEEN = 8

export interface Label extends Box { text: string }

export interface KeysLayoutOpts {
  view: KeysView
  /** CSS px a logical px. */
  css: number
  /** The first y the page may not use, logical px. */
  bottom: number
  safe?: { top?: number; left?: number; right?: number }
  /** The dress's lettering, for widths. */
  font: Pick<HudFont, 'width'>
  keys: HudKeys
}

export interface KeyRowBox {
  /** Its place in `view.rows`. */
  index: number
  /** The whole row, which is its button's room: 24 CSS px tall or more. */
  box: Box
  name: Label
  cell: Box
  key: Label
}

export interface KeysLayout {
  /** PLAY and MENU beside each other. */
  wide: boolean
  tabs: Box
  sections: Label[]
  rows: KeyRowBox[]
  /** RESET ALL, on the page that has it. */
  reset: { box: Box; label: Label } | null
  /** `1/2` and MORE; null with one page. */
  pager: { count: Label; more: Label; hit: Box } | null
  page: number
  /** What each page holds: the rows' places, RESET ALL's being `view.rows.length`. */
  pages: number[][]
  signIn: Label | null
  last: Label
}

interface Spacing { row: number; gap: number; head: number; under: number }

/**
 * Where every part of the page goes on a screen of vw × vh logical px: the tabs at the top under the safe area, the
 * last line (and the sign-in line over it) at the bottom, the rows in the middle of what is between. Pure.
 */
export function keysPageLayout(vw: number, vh: number, o: KeysLayoutOpts): KeysLayout {
  const F = o.font
  const v = o.view
  const textW = (t: string) => Math.ceil(F.width(t))
  const label = (text: string, x: number, y: number): Label => ({ text, x, y, w: textW(text), h: LINE })
  const left = (o.safe?.left ?? 0) + SIDE
  const across = vw - (o.safe?.right ?? 0) - SIDE - left
  const bottom = Math.min(o.bottom, vh)
  const mid = (w: number) => left + Math.floor((across - w) / 2)
  /** A button's least height: 24 CSS px. */
  const least = Math.ceil(24 / o.css)
  const spacings: Spacing[] = [
    { row: Math.max(least, 13), gap: 2, head: 11, under: 5 },
    { row: Math.max(least, CELL_H), gap: 1, head: 9, under: 3 },
  ]
  const tabs = menuTabsBox(F, vw, menuTabsY(vh, o.safe?.top), o.keys)

  const last = label(v.last, mid(textW(v.last)), bottom - LINE)
  const signIn = v.signIn ? label(SIGN_IN_LINE, mid(textW(SIGN_IN_LINE)), last.y - 10) : null
  const footTop = (signIn ?? last).y - 3

  const count = v.rows.length
  const reset = count
  const rowAt = (index: number, x: number, y: number, w: number, h: number): KeyRowBox => {
    const row = v.rows[index]!
    const key = v.capturing && v.cursor === index ? CAPTURE_WORDS : row.key
    const cw = Math.max(CELL_LEAST, textW(key) + 8)
    const cell = { x: x + w - 2 - cw, y: y + Math.floor((h - CELL_H) / 2), w: cw, h: CELL_H }
    return {
      index, box: { x, y, w, h }, cell,
      name: label(row.name, x + 4, y + Math.floor((h - LINE) / 2)),
      key: label(key, cell.x + Math.floor((cw - textW(key)) / 2), cell.y + 2),
    }
  }
  const resetAt = (x: number, y: number, w: number, h: number) => {
    const text = v.armed ? AGAIN_WORDS : RESET_WORDS
    return { box: { x, y, w, h }, label: label(text, x + Math.floor((w - textW(text)) / 2), y + Math.floor((h - LINE) / 2)) }
  }

  // ---- two columns, where the screen is wide and both fit whole ----
  if (vw > vh) {
    // (Room for any key's name: eight of the widest letters.)
    const need = Math.max(...v.rows.map(r => textW(r.name))) + 4 + 6 + textW('MMMMMMMM') + 8 + 2
    const colW = Math.min(COLUMN, Math.floor((across - BETWEEN) / 2))
    const play = v.rows.map((r, i) => (r.section === 'PLAY' ? i : -1)).filter(i => i >= 0)
    const menu = v.rows.map((r, i) => (r.section === 'MENU' ? i : -1)).filter(i => i >= 0)
    for (const sp of spacings) {
      const top = tabs.y + tabs.h + sp.under
      const tall = Math.max(play.length, menu.length)
      const h = sp.head + tall * (sp.row + sp.gap) + 2 + sp.row
      if (colW < need || h > footTop - top) continue
      const y0 = top + Math.floor((footTop - top - h) / 2)
      const x0 = mid(2 * colW + BETWEEN)
      const sections: Label[] = []
      const rows: KeyRowBox[] = []
      for (const [c, list] of [play, menu].entries()) {
        const x = x0 + c * (colW + BETWEEN)
        sections.push(label(v.rows[list[0]!]!.section, x + 4, y0))
        list.forEach((index, i) => rows.push(rowAt(index, x, y0 + sp.head + i * (sp.row + sp.gap), colW, sp.row)))
      }
      return {
        wide: true, tabs, sections, rows,
        reset: resetAt(mid(colW), y0 + sp.head + tall * (sp.row + sp.gap) + 2, colW, sp.row),
        pager: null, page: 0, pages: [[...rows.map(r => r.index), reset]], signIn, last,
      }
    }
  }

  // ---- one column, in pages of whole rows ----
  const colW = Math.min(COLUMN, across - 4)
  const x = mid(colW)
  const sectionOf = (i: number) => (i < count ? v.rows[i]!.section : null)
  /** The pages for a room `room` tall, and how tall each came out. */
  const cut = (sp: Spacing, room: number) => {
    const pages: Array<{ items: number[]; h: number }> = [{ items: [], h: 0 }]
    for (let i = 0; i <= count; i++) {
      let page = pages[pages.length - 1]!
      const head = () => !!sectionOf(i) && (!page.items.length || sectionOf(page.items[page.items.length - 1]!) !== sectionOf(i))
      const tall = () => (page.items.length ? sp.gap : 0) + (head() ? sp.head : 0) + (i === reset && page.items.length ? 2 : 0) + sp.row
      if (page.items.length && page.h + tall() > room) pages.push(page = { items: [], h: 0 })
      page.h += tall()
      page.items.push(i)
    }
    return pages
  }
  let sp = spacings[0]!
  let pages = cut(sp, footTop - (tabs.y + tabs.h + sp.under))
  if (pages.length > 1) { sp = spacings[1]!; pages = cut(sp, footTop - (tabs.y + tabs.h + sp.under)) }
  const paged = pages.length > 1
  const pagerY = footTop - sp.row
  const top = tabs.y + tabs.h + sp.under
  const end = paged ? pagerY - 2 : footTop
  if (paged) pages = cut(sp, end - top)
  const page = Math.max(0, pages.findIndex(p => p.items.includes(v.cursor)))
  const shown = pages[page]!
  // (Paged, the rows start under the tabs, so they stay put from page to page.)
  let y = paged ? top : top + Math.max(0, Math.floor((end - top - shown.h) / 2))
  const sections: Label[] = []
  const rows: KeyRowBox[] = []
  let resetBox: KeysLayout['reset'] = null
  let section: string | null = null
  shown.items.forEach((i, n) => {
    if (n) y += sp.gap
    const s = sectionOf(i)
    if (s && s !== section) { sections.push(label(s, x + 4, y)); y += sp.head; section = s }
    if (i === reset) { if (n) y += 2; resetBox = resetAt(x, y, colW, sp.row) }
    else rows.push(rowAt(i, x, y, colW, sp.row))
    y += sp.row
  })
  let pager: KeysLayout['pager'] = null
  if (paged) {
    const n = `${page + 1}/${pages.length}`
    const hitW = Math.max(least, textW('MORE') + 10)
    const px = mid(textW(n) + 8 + hitW)
    const hit = { x: px + textW(n) + 8, y: pagerY, w: hitW, h: sp.row }
    const textY = pagerY + Math.floor((sp.row - LINE) / 2)
    pager = { count: label(n, px, textY), more: label('MORE', hit.x + Math.floor((hitW - textW('MORE')) / 2), textY), hit }
  }
  return { wide: false, tabs, sections, rows, reset: resetBox, pager, page, pages: pages.map(p => p.items), signIn, last }
}

export interface KeysPageOpts {
  keys: HudKeys
  view: KeysView
  /** CSS px a logical px (none: 2 on the fine dress, 1.5 on the classic one, a phone's). */
  css?: number
  safe?: { top?: number; left?: number; right?: number; bottom?: number }
  /** Told where everything was laid, for what stands over the canvas (the buttons). */
  placed?: (page: KeysLayout) => void
}

/** The page laid out for a screen: what `drawKeysPage` paints. */
export function keysPageFor(vw: number, vh: number, o: KeysPageOpts, skin: HudSkin): KeysLayout {
  const css = o.css ?? ((skin.density ?? 1) > 1 ? 2 : 1.5)
  return keysPageLayout(vw, vh, { view: o.view, css, bottom: pageBottom(vh, o, css), safe: o.safe, font: hudFont(skin), keys: o.keys })
}

/** A plate with its corners notched. */
function plate(g: G, b: Box, edge: string, fill: string | null) {
  if (fill) { g.fillStyle = fill; g.fillRect(b.x + 1, b.y + 1, b.w - 2, b.h - 2) }
  g.fillStyle = edge
  g.fillRect(b.x + 1, b.y, b.w - 2, 1)
  g.fillRect(b.x + 1, b.y + b.h - 1, b.w - 2, 1)
  g.fillRect(b.x, b.y + 1, 1, b.h - 2)
  g.fillRect(b.x + b.w - 1, b.y + 1, 1, b.h - 2)
}

/** The KEYS page of the menu, in the skin's logical px; the caller sets the scale. */
export function drawKeysPage(g: G, vw: number, vh: number, o: KeysPageOpts, skin: HudSkin) {
  g.fillStyle = PAGE_VEIL
  g.fillRect(0, 0, vw, vh)
  const F = hudFont(skin)
  const p = keysPageFor(vw, vh, o, skin)
  o.placed?.(p)
  const v = o.view
  const say = (l: Label, color: string) => F.draw(g, l.text, l.x, l.y, color, SKIN.outline)
  drawMenuTabs(g, 'keys', vw, p.tabs.y, o.keys, skin)
  for (const s of p.sections) say(s, DIM_LILAC)
  for (const r of p.rows) {
    const on = r.index === v.cursor
    const lit = r.index === v.lit
    const flash = v.flash.includes(r.index)
    if (on) plate(g, r.box, SKIN.prize, 'rgba(255,210,63,0.14)')
    else if (lit) plate(g, r.box, QUIET, 'rgba(255,210,63,0.22)')
    say(r.name, on || lit ? SKIN.prize : WHITE)
    plate(g, r.cell, on || lit || flash ? SKIN.prize : QUIET, flash ? SKIN.prize : FILL)
    if (flash) F.draw(g, r.key.text, r.key.x, r.key.y, SKIN.outline)
    else say(r.key, on && v.capturing ? SKIN.prize : WHITE)
  }
  if (p.reset) {
    const on = v.cursor === v.rows.length
    plate(g, p.reset.box, on ? SKIN.prize : QUIET, on ? 'rgba(255,210,63,0.14)' : null)
    say(p.reset.label, v.armed ? SKIN.hot : on ? SKIN.prize : SKIN.dim)
  }
  if (p.pager) {
    say(p.pager.count, SKIN.dim)
    say(p.pager.more, SKIN.cool)
  }
  if (p.signIn) say(p.signIn, DIM_LILAC)
  say(p.last, v.last === REFUSED_WORDS || v.last === AGAIN_WORDS ? SKIN.hot : v.capturing ? SKIN.prize : SKIN.dim)
}
