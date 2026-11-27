/**
 * The LOG page of the menu, the ITEMS and MAP pages' sibling: no window and no HUD, the corner's colours on the
 * page's own veil (`PAGE_VEIL`), from the menu's tabs to the touch deck. From the top: NEON SHRINE, the version, the
 * date of the newest change and its hash; the change list, a day over its lines; OLDER and NEWER where the list goes
 * on, the page's number between them; the DEV MODE switch; and the keys' line beside a keyboard.
 *
 * Nothing scrolls: the list is cut into pages (`logPages`), whole days to a page where they fit. A day too long for a
 * page of its own starts one and goes on over the next, its date said again, a change cut only when it alone is
 * longer than a page.
 *
 * The version and the list are made from git at build time (`scripts/zelda-changes.mjs`); the page is handed them.
 * `logPageLayout` is pure and says where everything goes, the three places a finger may press among it; the shell
 * lays a button over each (`LogPageButtons.vue`). `drawLogPage` paints.
 */
import type { HudKeys } from '../keys'
import { drawMenuTabs, hudFont, menuTabsBox, menuTabsY, type HudFont, type HudSkin } from './hud'
import { CORNER_SKIN } from './corner'
import { MARK_INKS, type Box } from './worldMap'
import { PAGE_VEIL, pageBottom } from './mapPage'

type G = CanvasRenderingContext2D

/** What the build step writes (`changes.gen.ts`): the changes newest first, by day, each line in capitals. */
export interface ChangeLog {
  version: number
  date: string
  hash: string
  changes: Array<{ date: string; lines: string[] }>
}

const SKIN = CORNER_SKIN
const WHITE = MARK_INKS.P
/** A day over its lines: the lilac, dimmed. */
const DAY = '#8d7cc4'
/** The side of a switch that is not on. */
const QUIET = '#6a5aa8'

export const NO_HISTORY = 'NO HISTORY IN THIS BUILD'
const KEY_HINTS = ['ESC RESUME', 'D DEV MODE', 'ARROWS OLDER/NEWER']

/** A line of lettering. */
const LINE = 7
const SIDE = 2
/** The list's widest, logical px. */
const COLUMN = 300
/** A change's lines stand in from its mark. */
const INDENT = 6

export interface Label extends Box { text: string }
/** A row of the list: a day's date, or a row of a change (`change`: its place in the whole list; `first`: its first row). */
export type LogRow =
  | (Label & { kind: 'day' })
  | (Label & { kind: 'line'; change: number; first: boolean; mark: Box })
/** A word to press and the room of the button over it (44 × 44 CSS px or more). */
export interface LogWord extends Label { hit: Box }

export interface LogLayoutOpts {
  log: ChangeLog
  /** Dev mode is on. */
  dev: boolean
  /** The page asked for, 0 the newest; held to what there is. */
  page: number
  /** CSS px a logical px. */
  css: number
  /** Beside a keyboard: the keys' line at the bottom. */
  keys: boolean
  /** The first y the page may not use, logical px: the top of the touch deck, or of the bottom safe band. */
  bottom: number
  safe?: { top?: number; left?: number; right?: number }
  /** The dress's lettering, for widths. */
  font: Pick<HudFont, 'width' | 'wrap'>
}

export interface LogLayout {
  tabs: Box
  title: Label
  /** The version, the date and the hash (two rows where one is too wide; none without a history). */
  stamp: Label[]
  /** The list's room. */
  list: Box
  rows: LogRow[]
  page: number
  pages: number
  /** Null where there is nothing older or newer to turn to. */
  older: LogWord | null
  newer: LogWord | null
  /** `1/4`; null with one page. */
  count: Label | null
  /** The DEV MODE row: its words, the switch's two sides, the gold or dim frame round the side that is on. */
  dev: { label: Label; off: Label; on: Label; frame: Box; hit: Box }
  /** The keys' line. */
  last: Label[]
}

const textW = (F: LogLayoutOpts['font'], text: string) => Math.ceil(F.width(text))
const label = (F: LogLayoutOpts['font'], text: string, x: number, y: number): Label => ({ text, x, y, w: textW(F, text), h: LINE })

/** Parts joined by a middle dot, on as many rows as the width needs. */
function joined(F: LogLayoutOpts['font'], parts: string[], room: number): string[] {
  const rows: string[] = []
  for (const p of parts) {
    const last = rows[rows.length - 1]
    if (last !== undefined && textW(F, `${last} · ${p}`) <= room) rows[rows.length - 1] = `${last} · ${p}`
    else rows.push(p)
  }
  return rows
}

/** A change in rows no wider than `room`: at the spaces, and through a word that alone is wider. */
function wrapRows(F: LogLayoutOpts['font'], text: string, room: number): string[] {
  return F.wrap(text, room).flatMap((row) => {
    const out: string[] = []
    let rest = row
    while (rest.length > 1 && textW(F, rest) > room) {
      let n = rest.length - 1
      while (n > 1 && textW(F, rest.slice(0, n)) > room) n--
      out.push(rest.slice(0, n))
      rest = rest.slice(n)
    }
    return [...out, rest]
  })
}

/** A row of a page before it is placed: a date, a change's row, or the blank between two days. */
type Slot = null | { day: string } | { text: string; change: number; first: boolean }

/** The list cut into pages of `cap` rows. */
export function logPages(days: Array<{ date: string; changes: string[][] }>, cap: number): Slot[][] {
  const pages: Slot[][] = [[]]
  let page = pages[0]!
  const turn = () => { if (page.length) pages.push(page = []) }
  let n = 0
  for (const d of days) {
    const changes = d.changes.map(rows => { const change = n++; return rows.map((text, i): Slot => ({ text, change, first: i === 0 })) })
    const size = 1 + changes.reduce((a, c) => a + c.length, 0)
    const head: Slot = { day: d.date }
    if (page.length && page.length + 1 + size <= cap) page.push(null)
    else turn()
    if (size <= cap) { page.push(head, ...changes.flat()); continue }
    // A day longer than a page: change by change, its date over each page of it. (A page of one row has no room for it.)
    const dated = cap > 1 ? [head] : []
    page.push(...dated)
    for (const c of changes) {
      const fresh = () => page.length === dated.length
      if (page.length + c.length > cap && c.length + dated.length <= cap) { turn(); page.push(...dated) }
      for (const row of c) {
        if (page.length >= cap && !fresh()) { turn(); page.push(...dated) }
        page.push(row)
      }
    }
  }
  return pages
}

/**
 * Where every part of the page goes on a screen of vw × vh logical px. The tabs and the version stand at the top
 * under the safe area; the switch and the keys' line end the page above `bottom`, OLDER and NEWER over them (beside
 * the switch on a screen wider than tall, where there is room); the list takes what is between. Pure.
 */
export function logPageLayout(vw: number, vh: number, o: LogLayoutOpts): LogLayout {
  const F = o.font
  const left = (o.safe?.left ?? 0) + SIDE
  const across = vw - (o.safe?.right ?? 0) - SIDE - left
  const bottom = Math.min(o.bottom, vh)
  const short = vh < 340
  const sp = short ? { under: 3, head: 4, gap: 3, pitch: 9 } : { under: 5, head: 6, gap: 6, pitch: 10 }
  const colW = Math.min(across - 4, COLUMN)
  const x0 = left + Math.floor((across - colW) / 2)
  const mid = (w: number) => left + Math.floor((across - w) / 2)
  const centred = (text: string, y: number) => label(F, text, mid(textW(F, text)), y)
  const side = Math.ceil(44 / o.css)

  const tabs = menuTabsBox(F, vw, menuTabsY(vh, o.safe?.top), o.keys)

  // The head. On a short screen the name and the version share a row where they fit.
  let y = tabs.y + tabs.h + sp.under
  const name = 'NEON SHRINE'
  const stampParts = o.log.version > 0 ? [`V ${o.log.version}`, o.log.date, o.log.hash.toUpperCase()] : []
  const one = stampParts.join(' · ')
  const beside = short && !!one && textW(F, name) + 10 + textW(F, one) <= across
  let title: Label
  let stamp: Label[]
  if (beside) {
    const x = mid(textW(F, name) + 10 + textW(F, one))
    title = label(F, name, x, y)
    stamp = [label(F, one, x + title.w + 10, y)]
    y += LINE
  } else {
    title = centred(name, y)
    y += LINE
    stamp = joined(F, stampParts, across).map((t, i) => centred(t, y + 3 + i * sp.pitch))
    if (stamp.length) y = stamp[stamp.length - 1]!.y + LINE
  }
  const listTop = y + sp.head

  // The foot, from the bottom up: the keys, the switch, and the pages' row where there is more than one.
  const hints = o.keys ? joined(F, KEY_HINTS, across) : []
  const hintsH = hints.length ? (hints.length - 1) * sp.pitch + LINE : 0
  const last = hints.map((t, i) => centred(t, bottom - hintsH + i * sp.pitch))
  const footBottom = bottom - (hintsH ? hintsH + sp.gap : 0)

  const rowH = Math.max(side, LINE + 4)
  const textY = (top: number) => top + Math.floor((rowH - LINE) / 2)
  // The switch: its name, then OFF and ON, a frame round the one that is so.
  const devWords = { label: textW(F, 'DEV MODE'), off: textW(F, 'OFF'), on: textW(F, 'ON') }
  const devW = devWords.label + 8 + devWords.off + 10 + devWords.on + 3
  const devHitW = Math.max(side, devW + 8)
  // The pages' row: NEWER, the number, OLDER, each word in a room of its own.
  const wordW = (t: string) => Math.max(side, textW(F, t) + 10)

  const days = o.log.changes.map(d => ({ date: d.date, changes: d.lines.map(l => wrapRows(F, l, colW - INDENT)) }))
  const capOf = (listBottom: number) => Math.max(1, Math.floor((listBottom - listTop - LINE) / sp.pitch) + 1)

  // First without the pages' row; with it where the list does not fit on one page.
  let devTop = footBottom - rowH
  let pagerTop: number | null = null
  let shared = false
  let listBottom = devTop - sp.gap
  let pages = logPages(days, capOf(listBottom))
  if (pages.length > 1) {
    const countW = textW(F, '88/88')
    const pagerW = wordW('NEWER') + countW + wordW('OLDER') + 4
    shared = vw > vh && pagerW + 8 + devHitW <= across
    pagerTop = shared ? devTop : devTop - 1 - rowH
    listBottom = pagerTop - sp.gap
    pages = logPages(days, capOf(listBottom))
  }
  const page = Math.max(0, Math.min(pages.length - 1, Math.floor(o.page) || 0))

  // Beside each other: the pages' row at the left of the pair, the switch at the right.
  const countW = textW(F, '88/88')
  const pagerW = wordW('NEWER') + countW + wordW('OLDER') + 4
  const pairX = shared ? mid(pagerW + 8 + devHitW) : 0
  let newer: LogWord | null = null
  let older: LogWord | null = null
  let count: Label | null = null
  if (pagerTop !== null) {
    const top = pagerTop
    const x = shared ? pairX : mid(pagerW)
    const word = (text: string, at: number): LogWord => {
      const w = wordW(text)
      return { ...label(F, text, at + Math.floor((w - textW(F, text)) / 2), textY(top)), hit: { x: at, y: top, w, h: rowH } }
    }
    if (page > 0) newer = word('NEWER', x)
    const countX = x + wordW('NEWER') + 2
    const n = `${page + 1}/${pages.length}`
    count = label(F, n, countX + Math.floor((countW - textW(F, n)) / 2), textY(top))
    if (page < pages.length - 1) older = word('OLDER', countX + countW + 2)
  }
  const devHitX = shared ? pairX + pagerW + 8 : mid(devHitW)
  const dx = devHitX + Math.floor((devHitW - devW) / 2)
  const dy = textY(devTop)
  const devLabel = label(F, 'DEV MODE', dx, dy)
  const off = label(F, 'OFF', dx + devWords.label + 8, dy)
  const on = label(F, 'ON', off.x + off.w + 10, dy)
  const lit = o.dev ? on : off
  const dev = { label: devLabel, off, on, frame: { x: lit.x - 3, y: dy - 2, w: lit.w + 6, h: LINE + 4 }, hit: { x: devHitX, y: devTop, w: devHitW, h: rowH } }

  const list: Box = { x: x0, y: listTop, w: colW, h: Math.max(0, listBottom - listTop) }
  const rows: LogRow[] = []
  if (!days.length) {
    const said = F.wrap(NO_HISTORY, colW)
    const top = listTop + Math.max(0, Math.floor((list.h - said.length * sp.pitch) / 2))
    said.forEach((t, i) => rows.push({ ...centred(t, top + i * sp.pitch), kind: 'day' }))
  } else {
    pages[page]!.forEach((slot, i) => {
      if (!slot) return
      const ry = listTop + i * sp.pitch
      if ('day' in slot) rows.push({ ...label(F, slot.day, x0, ry), kind: 'day' })
      else rows.push({ ...label(F, slot.text, x0 + INDENT, ry), kind: 'line', change: slot.change, first: slot.first, mark: { x: x0 + 1, y: ry + 3, w: 2, h: 2 } })
    })
  }
  return { tabs, title, stamp, list, rows, page, pages: pages.length, older, newer, count, dev, last }
}

export interface LogPageOpts {
  keys: HudKeys
  log: ChangeLog
  dev: boolean
  page: number
  /** CSS px a logical px (none: 2 on the fine dress, 1.5 on the classic one, a phone's). */
  css?: number
  /** The top of the touch deck in logical px, as the shell measured it. */
  deck?: number | null
  safe?: { top?: number; left?: number; right?: number; bottom?: number }
  /** Told where everything was laid, for what stands over the canvas (the buttons). */
  placed?: (page: LogLayout) => void
}

/** The page laid out for a screen: what `drawLogPage` paints. */
export function logPageFor(vw: number, vh: number, o: LogPageOpts, skin: HudSkin): LogLayout {
  const css = o.css ?? ((skin.density ?? 1) > 1 ? 2 : 1.5)
  return logPageLayout(vw, vh, {
    log: o.log, dev: o.dev, page: o.page, css, keys: !o.keys.touch, bottom: pageBottom(vh, o, css), safe: o.safe, font: hudFont(skin),
  })
}

/** The LOG page of the menu, in the skin's logical px; the caller sets the scale. */
export function drawLogPage(g: G, vw: number, vh: number, o: LogPageOpts, skin: HudSkin) {
  g.fillStyle = PAGE_VEIL
  g.fillRect(0, 0, vw, vh)
  const F = hudFont(skin)
  const p = logPageFor(vw, vh, o, skin)
  o.placed?.(p)
  const say = (l: Label, color: string) => F.draw(g, l.text, l.x, l.y, color, SKIN.outline)
  drawMenuTabs(g, 'log', vw, p.tabs.y, o.keys, skin)
  say(p.title, SKIN.prize)
  for (const l of p.stamp) say(l, SKIN.dim)
  for (const r of p.rows) {
    if (r.kind === 'day') { say(r, DAY); continue }
    if (r.first) { g.fillStyle = DAY; g.fillRect(r.mark.x, r.mark.y, r.mark.w, r.mark.h) }
    say(r, WHITE)
  }
  for (const w of [p.newer, p.older]) if (w) say(w, SKIN.cool)
  if (p.count) say(p.count, SKIN.dim)
  const d = p.dev
  say(d.label, WHITE)
  say(d.off, o.dev ? QUIET : WHITE)
  say(d.on, o.dev ? SKIN.prize : QUIET)
  const f = d.frame
  g.fillStyle = o.dev ? SKIN.prize : SKIN.dim
  g.fillRect(f.x + 1, f.y, f.w - 2, 1)
  g.fillRect(f.x + 1, f.y + f.h - 1, f.w - 2, 1)
  g.fillRect(f.x, f.y + 1, 1, f.h - 2)
  g.fillRect(f.x + f.w - 1, f.y + 1, 1, f.h - 2)
  for (const l of p.last) say(l, SKIN.dim)
}
