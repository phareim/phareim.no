/**
 * The ITEMS page of the menu, in the MAP page's manner (`mapPage.ts`): no window and no HUD, the corner's colours on
 * the page's own veil (`PAGE_VEIL`), from the menu's tabs at the top to the touch deck. From the top: ON B, a grid of
 * 3 × 3 sockets, one for each thing B can hold in the order of `B_ITEMS`; the name of the one under the cursor and
 * what it does (`B_WORDS`); ALWAYS, what needs no slot; the seven Sacred Weights on their beam, once one is held;
 * the heart pieces, with a keyring's keys where there is one; and the QUEST. Wider than tall, the grid and its line
 * stand at the left and the rest in a column at the right.
 *
 * The player picks: a cursor walks the grid (`moveCursor`) and what is under it goes on B (`pickCell`). The shell
 * routes the keys and lays a button over each cell from the layout's boxes.
 *
 * `itemsPageContent` says what there is to show, `itemsPageLayout` where each part goes on a screen and what gave
 * way, `cellPicture`, `cursorPicture` and `balancePicture` what is drawn. All of them are pure; `drawItemsPage`
 * paints them. A paused game is painted once, so nothing here moves.
 */
import { B_ITEMS, B_WORDS, WEIGHTS, type GameState, type Inventory, type UseItem } from '../types'
import { hasBigKey, hasWeight, keyCount } from '../engine/map'
import { objective } from '../progress'
import type { HudKeys } from '../keys'
import { drawMenuTabs, hudFont, menuTabsY, type HudFont, type HudSkin } from './hud'
import { Buf, CORNER_SKIN, type CornerPicture } from './corner'
import { MARK_INKS, type Box } from './worldMap'
import { PAGE_VEIL, pageBottom } from './mapPage'
import { sprite } from './sheet'

type G = CanvasRenderingContext2D

const SKIN = CORNER_SKIN
const WHITE = MARK_INKS.P
/** The outline of a socket with nothing in it, and an empty pan's ring. */
const QUIET = '#6a5aa8'
/** The ground of a socket with something in it. */
const FILL = '#1d1236'

// ---- the grid ------------------------------------------------------------------------------------------------

export const GRID_COLS = 3
export const GRID_CELLS = GRID_COLS * GRID_COLS

/** A cell of the grid: the thing owned there (`id` null: an empty socket, which says nothing of what will be). */
export interface Socket {
  id: UseItem | null
  name: string
  does: string
  icon: string
  /** It is the one in hand. */
  held: boolean
  /** The bombs carried; null for anything that is not counted. */
  count: number | null
}

const EMPTY: Socket = { id: null, name: '', does: '', icon: '', held: false, count: null }

/** The nine cells: `B_ITEMS` in its order, each there only once owned; the rest empty. */
export function sockets(inv: Inventory): Socket[] {
  return Array.from({ length: GRID_CELLS }, (_, i): Socket => {
    const b = B_ITEMS[i]
    if (!b || !b.owned(inv)) return EMPTY
    const words = B_WORDS[b.id]
    return { id: b.id, name: words?.name ?? b.name, does: words?.does ?? '', icon: b.icon, held: inv.selected === b.id, count: b.id === 'bombs' ? inv.bombs : null }
  })
}

/** Where the cursor stands as the page opens: on the thing in hand, else the first owned, else the first cell. */
export function cursorStart(inv: Inventory): number {
  const cells = sockets(inv)
  const held = cells.findIndex(c => c.held)
  return held >= 0 ? held : Math.max(0, cells.findIndex(c => c.id))
}

/** A step of the cursor; it stops at the grid's edges. */
export function moveCursor(at: number, dx: number, dy: number): number {
  const keep = (v: number) => Math.max(0, Math.min(GRID_COLS - 1, v))
  return keep(Math.floor(at / GRID_COLS) + dy) * GRID_COLS + keep((at % GRID_COLS) + dx)
}

/** Puts what is in cell `at` on B: sets `inv.selected` and nothing else. False for an empty socket. */
export function pickCell(inv: Inventory, at: number): boolean {
  const id = sockets(inv)[at]?.id
  if (!id) return false
  inv.selected = id
  return true
}

// ---- what there is to show -----------------------------------------------------------------------------------

/** What needs no slot, in the ALWAYS row's order: each shown once it is the hero's. */
export const ALWAYS: ReadonlyArray<{ icon: (s: GameState) => string; owned: (s: GameState) => boolean }> = [
  { icon: s => (s.inv.arc ? 'item_arc' : 'item_sword'), owned: s => s.inv.sword },
  { icon: () => 'item_bigbag', owned: s => s.inv.bigBag },
  { icon: () => 'item_prism', owned: s => s.inv.prism },
  // Treasures to come: nothing grants these yet. Each shows with the flag its grant will set (`item:<id>`).
  { icon: () => 'item_no', owned: s => s.flags['item:no'] === true },
  { icon: () => 'item_stomp', owned: s => s.flags['item:stomp'] === true },
  { icon: () => 'item_lens', owned: s => s.flags['item:lens'] === true },
]

/** Things carried for someone: shown on the hearts' row until they are handed over. */
const ERRANDS: ReadonlyArray<{ icon: string; carried: (s: GameState) => boolean }> = [
  { icon: 'item_waffle', carried: s => s.flags['item:waffle'] === true && s.flags.luna !== true },
  { icon: 'item_shroom', carried: s => s.inv.shrooms > 0 && s.flags['got:mossa:heartPiece'] !== true },
  { icon: 'item_tube', carried: s => s.flags['item:tube'] === true && s.flags['got:dusty:heartPiece'] !== true },
  { icon: 'item_walkie', carried: s => s.flags['item:walkie'] === true && s.flags['got:toby:bits50'] !== true },
  { icon: 'item_hat', carried: s => s.flags['item:hat'] === true && s.flags['got:troll:bigBag'] !== true },
]

export interface ItemsContent {
  cells: Socket[]
  always: string[]
  /** The seven pans in `WEIGHTS`' order (the icon of each held, else null); null with none held: no row at all. */
  weights: Array<string | null> | null
  pieces: number
  /** The keys of the place the hero is in; null where it has no keyring. */
  keys: { count: number; big: boolean } | null
  errands: string[]
  quest: string
  /** The keys' hints, beside a keyboard: the page's own, then the menu's. */
  hints: Array<Array<{ text: string; tone: 'dim' | 'cool' | 'hot' | 'prize' }>>
}

export function itemsPageContent(s: GameState, o: { muted?: boolean; view?: string } = {}): ItemsContent {
  const held = WEIGHTS.map(w => (hasWeight(s, w.id) ? `item_weight_${w.word.toLowerCase()}` : null))
  const menu: ItemsContent['hints'][number] = [
    { text: 'T TOWN', tone: 'dim' },
    { text: `O SOUND ${o.muted ? 'OFF' : 'ON'}`, tone: o.muted ? 'hot' : 'cool' },
  ]
  if (o.view) menu.push({ text: `V VIEW ${o.view}`, tone: 'prize' })
  return {
    cells: sockets(s.inv),
    always: ALWAYS.filter(a => a.owned(s)).map(a => a.icon(s)),
    weights: held.some(Boolean) ? held : null,
    pieces: s.inv.pieces,
    // (The Shrine's ring is also what every place without a keyring of its own carries: only the Shrine itself has it.)
    keys: s.map.ring !== 'shrine' || s.map.id === 'shrine' ? { count: keyCount(s), big: hasBigKey(s) } : null,
    errands: ERRANDS.filter(e => e.carried(s)).map(e => e.icon),
    quest: objective(s),
    hints: [[{ text: 'ESC RESUME', tone: 'dim' }, { text: 'ARROWS PICK', tone: 'dim' }, { text: 'ENTER TAKE', tone: 'dim' }], menu],
  }
}

// ---- where things go -----------------------------------------------------------------------------------------

export interface ItemsLayoutOpts {
  content: ItemsContent
  /** Fine px a logical px: the skin's density. */
  density: number
  /** CSS px a logical px. */
  css: number
  /** Beside a keyboard: the hints at the bottom. */
  keys: boolean
  /** The first y the page may not use, logical px: the top of the touch deck, or of the bottom safe band. */
  bottom: number
  safe?: { top?: number; left?: number; right?: number }
  /** The dress's lettering, for widths. */
  font: Pick<HudFont, 'width' | 'wrap'>
}

/** What gives way when room is short, in this order. `quest`: lines of it after the first. */
export const ITEMS_GIVE_WAY = ['always', 'quest', 'carried'] as const
export type ItemsGave = (typeof ITEMS_GIVE_WAY)[number]

export interface Label extends Box { text: string }

export interface ItemsLayout {
  /** A screen wider than it is tall: the grid and its line at the left, the rest in a column at the right. */
  wide: boolean
  tabs: Box
  heading: Label
  /** The grid with a px round it for the cursor. */
  grid: Box
  cells: Box[]
  /** The room of the name and what it does under the cursor: as tall as the longest of `B_ITEMS` takes. */
  line: Box & { pitch: number }
  always: (Box & { label: Label; icons: Box[] }) | null
  weights: (Box & { balance: Box; pans: Box[]; count: Label }) | null
  /** Heart pieces, the keys of a keyring and what is carried for someone. */
  carried: (Box & { label: Label; pieces: Box; key: (Box & { count: Label }) | null; bigKey: Box | null; errands: Array<Box & { icon: string }> }) | null
  quest: (Box & { title: Label; lines: Label[] }) | null
  /** The keys' hints. */
  last: (Box & { hints: Array<Label & { tone: 'dim' | 'cool' | 'hot' | 'prize' }> }) | null
  gave: ItemsGave[]
}

/** A line of lettering. */
const LINE = 7
const TABS_H = 10
const SIDE = 2
const WIDE_EDGE = 4
const ICON = 16
/** The quest's widest, logical px: the width the old window gave it. */
const QUEST_W = 224
/** A pan's slot on the beam, and how tall the balance is. */
export const PAN_W = 18
export const BALANCE_H = 22
/** The largest a cell grows, and the least it may be (it also takes 44 CSS px or more). */
const CELL_MOST = 30
const CELL_LEAST = 20

/** How close the parts stand: easy, and where room is short. */
interface Spacing { under: number; gap: number; cellGap: number; pitch: number; head: number }
const SPACINGS: Spacing[] = [
  { under: 6, gap: 7, cellGap: 4, pitch: 10, head: 3 },
  { under: 2, gap: 3, cellGap: 3, pitch: 9, head: 2 },
]

/** One way of fitting the page: what is left on it. */
interface Level { always: boolean; questLines: number; carried: boolean; quest: boolean }

/** A part laid out on its own: its size, and the part to be moved into place. */
interface Sized<T> { w: number; h: number; at(x: number, y: number): T }

const textW = (F: ItemsLayoutOpts['font'], text: string) => Math.ceil(F.width(text))
const label = (F: ItemsLayoutOpts['font'], text: string, x: number, y: number): Label => ({ text, x, y, w: textW(F, text), h: LINE })

/** Things in a row that wraps: where each stands, from (0, 0), every row in the middle of the widest. */
function flow(widths: number[], gap: number, room: number, pitch: number): { w: number; rows: number; at: Array<[number, number]> } {
  const rows: number[][] = []
  const total = (r: number[]) => r.reduce((a, i) => a + widths[i]!, 0) + gap * (r.length - 1)
  widths.forEach((_, i) => {
    const row = rows[rows.length - 1]
    if (row && total([...row, i]) <= room) row.push(i)
    else rows.push([i])
  })
  const w = Math.max(0, ...rows.map(total))
  const at: Array<[number, number]> = []
  rows.forEach((r, j) => {
    let x = Math.floor((w - total(r)) / 2)
    for (const i of r) { at[i] = [x, j * pitch]; x += widths[i]! + gap }
  })
  return { w, rows: rows.length, at }
}

function sizeAlways(o: ItemsLayoutOpts, room: number): Sized<NonNullable<ItemsLayout['always']>> | null {
  const list = o.content.always
  if (!list.length) return null
  const lw = textW(o.font, 'ALWAYS')
  const per = Math.max(1, Math.floor((room - lw - 6 + 2) / (ICON + 2)))
  const cols = Math.min(per, list.length)
  const rows = Math.ceil(list.length / cols)
  const w = lw + 6 + cols * (ICON + 2) - 2
  const h = rows * (ICON + 2) - 2
  return {
    w, h,
    at: (x, y) => ({
      x, y, w, h,
      label: label(o.font, 'ALWAYS', x, y + 5),
      icons: list.map((_, i) => ({ x: x + lw + 6 + (i % cols) * (ICON + 2), y: y + Math.floor(i / cols) * (ICON + 2), w: ICON, h: ICON })),
    }),
  }
}

function sizeWeights(o: ItemsLayoutOpts, room: number): Sized<NonNullable<ItemsLayout['weights']>> | null {
  const pans = o.content.weights
  if (!pans) return null
  const text = `${pans.filter(Boolean).length}/${pans.length}`
  const cw = textW(o.font, text)
  // (The pans close up where the row would not fit; an icon is 16 across.)
  const pitch = Math.max(ICON, Math.min(PAN_W, Math.floor((room - cw - 4) / pans.length)))
  const bw = pitch * pans.length
  const w = bw + 4 + cw
  return {
    w, h: BALANCE_H,
    at: (x, y) => ({
      x, y, w, h: BALANCE_H,
      balance: { x, y, w: bw, h: BALANCE_H },
      pans: pans.map((_, i) => ({ x: x + i * pitch + Math.floor((pitch - ICON) / 2), y: y + 4, w: ICON, h: ICON })),
      count: label(o.font, text, x + bw + 4, y + 8),
    }),
  }
}

function sizeCarried(o: ItemsLayoutOpts, room: number): Sized<NonNullable<ItemsLayout['carried']>> {
  const c = o.content
  const F = o.font
  const name = 'HEART PIECES'
  const lw = textW(F, name)
  const count = c.keys ? String(c.keys.count) : ''
  const keyW = c.keys ? ICON + 1 + textW(F, count) : 0
  // Whatever of these fits stands on one row; the rest wraps under it.
  const things: number[] = [lw + 5 + ICON]
  if (c.keys) things.push(keyW)
  if (c.keys?.big) things.push(ICON)
  for (const _ of c.errands) things.push(ICON)
  const f = flow(things, 5, room, ICON + 2)
  const h = f.rows * (ICON + 2) - 2
  return {
    w: f.w, h,
    at: (x, y) => {
      let n = 0
      const next = (w: number): Box => { const [dx, dy] = f.at[n++]!; return { x: x + dx, y: y + dy, w, h: ICON } }
      const first = next(things[0]!)
      const k = c.keys ? next(keyW) : null
      const big = c.keys?.big ? next(ICON) : null
      return {
        x, y, w: f.w, h,
        label: label(F, name, first.x, first.y + 5),
        pieces: { x: first.x + lw + 5, y: first.y, w: ICON, h: ICON },
        key: k ? { ...k, count: label(F, count, k.x + ICON + 1, k.y + 5) } : null,
        bigKey: big,
        errands: c.errands.map(icon => ({ ...next(ICON), icon })),
      }
    },
  }
}

/** The quest's rows at a width; `most` of them, the last one saying so where more are left. */
function questRows(F: ItemsLayoutOpts['font'], quest: string, room: number, most: number): string[] {
  const all = F.wrap(quest, room)
  if (all.length <= most) return all
  const rows = all.slice(0, most)
  let end = rows[most - 1]!
  while (end.includes(' ') && F.width(`${end}...`) > room) end = end.slice(0, end.lastIndexOf(' '))
  rows[most - 1] = `${end.replace(/[.,;:]+$/, '')}...`
  return rows
}

function sizeQuest(o: ItemsLayoutOpts, room: number, most: number, sp: Spacing): Sized<NonNullable<ItemsLayout['quest']>> {
  const F = o.font
  const rows = questRows(F, o.content.quest, room, most)
  const w = Math.max(textW(F, 'QUEST'), ...rows.map(r => textW(F, r)))
  const h = LINE + rows.length * sp.pitch
  return {
    w, h,
    at: (x, y) => ({
      x, y, w, h,
      title: label(F, 'QUEST', x, y),
      lines: rows.map((r, i) => label(F, r, x, y + sp.pitch + i * sp.pitch)),
    }),
  }
}

type PickPart = Pick<ItemsLayout, 'heading' | 'grid' | 'cells' | 'line'>

/** ON B, the grid and the line under it: `w` wide, the grid in its middle. */
function sizePick(o: ItemsLayoutOpts, cell: number, w: number, sp: Spacing): Sized<PickPart> {
  const F = o.font
  const side = GRID_COLS * cell + (GRID_COLS - 1) * sp.cellGap + 2
  const rows = Math.max(1, ...B_ITEMS.map(b => F.wrap(B_WORDS[b.id]?.does ?? '', w).length))
  const lineH = LINE + 3 + LINE + (rows - 1) * sp.pitch
  const h = LINE + sp.head + side + sp.head + lineH
  return {
    w, h,
    at: (x, y) => {
      const gx = x + Math.floor((w - side) / 2)
      const gy = y + LINE + sp.head
      const head = textW(F, 'ON B')
      return {
        heading: label(F, 'ON B', x + Math.floor((w - head) / 2), y),
        grid: { x: gx, y: gy, w: side, h: side },
        cells: Array.from({ length: GRID_CELLS }, (_, i) => ({
          x: gx + 1 + (i % GRID_COLS) * (cell + sp.cellGap), y: gy + 1 + Math.floor(i / GRID_COLS) * (cell + sp.cellGap), w: cell, h: cell,
        })),
        line: { x, y: gy + side + sp.head, w, h: lineH, pitch: sp.pitch },
      }
    },
  }
}

/** Where `drawMenuTabs` lays the three tabs. */
function tabsBox(o: ItemsLayoutOpts, vw: number, y: number): Box {
  const widths = (o.keys ? ['P ITEMS', 'N MOVES', 'M MAP'] : ['ITEMS', 'MOVES', 'MAP']).map(t => o.font.width(t))
  const sum = widths.reduce((a, b) => a + b, 0)
  const gap = Math.min(18, Math.max(8, Math.floor((vw - sum) / 4)))
  const total = sum + gap * 2
  return { x: Math.round((vw - total) / 2), y, w: Math.ceil(total), h: TABS_H }
}

/**
 * Where every part of the page goes on a screen of vw × vh logical px. The tabs stand at the top under the safe area
 * and what is under them takes the middle of the rows left; the keys' hints end the page. The cells are as large as
 * fits (44 CSS px or more); the parts stand closer before anything gives way, and then it is the ALWAYS row, the
 * quest's lines after the first and the hearts' row, in that order. The grid, its line and the Weights stay.
 * Nothing overlaps and nothing scrolls. Pure.
 */
export function itemsPageLayout(vw: number, vh: number, o: ItemsLayoutOpts): ItemsLayout {
  const c = o.content
  const left = (o.safe?.left ?? 0) + SIDE
  const across = vw - (o.safe?.right ?? 0) - SIDE - left
  const bottom = Math.min(o.bottom, vh)
  const wide = vw > vh
  const least = Math.max(CELL_LEAST, Math.ceil(44 / o.css))
  const between = 10
  // Wide: the grid's column, and the rest beside it, which is never narrower than the Weights' row at its closest.
  const forWeights = c.weights ? c.weights.length * ICON + 4 + textW(o.font, `${c.weights.length}/${c.weights.length}`) : 0
  const pickW = wide
    ? Math.max(3 * least + 8, Math.min(150, Math.floor(across * 0.42), across - between - 2 * WIDE_EDGE - forWeights))
    : Math.min(across, QUEST_W)
  const restW = wide ? Math.min(QUEST_W, across - pickW - between - 2 * WIDE_EDGE) : across
  const questW = Math.min(restW, QUEST_W)
  const questMost = o.font.wrap(c.quest, questW).length

  const tryPage = (l: Level, cell: number, sp: Spacing, force = false): ItemsLayout | null => {
    const first = menuTabsY(vh, o.safe?.top)
    const bodyTop = first + TABS_H + sp.under
    const pick = sizePick(o, cell, pickW, sp)
    const parts: Array<readonly [keyof ItemsLayout, Sized<object>]> = []
    const add = (key: keyof ItemsLayout, p: Sized<object> | null) => { if (p) parts.push([key, p]) }
    if (l.always) add('always', sizeAlways(o, restW))
    add('weights', sizeWeights(o, restW))
    if (l.carried) add('carried', sizeCarried(o, restW))
    if (l.quest) add('quest', sizeQuest(o, questW, l.questLines, sp))
    // The hints: each group on rows of its own.
    const groups = o.keys ? c.hints.map(g => ({ g, f: flow(g.map(h => textW(o.font, h.text)), 10, across, sp.pitch) })) : []
    const lastRows = groups.reduce((a, g) => a + g.f.rows, 0)
    const lastH = lastRows ? (lastRows - 1) * sp.pitch + LINE : 0
    const tail = lastH ? lastH + sp.gap : 0
    const colH = parts.reduce((a, [, p]) => a + p.h, 0) + sp.gap * Math.max(0, parts.length - 1)
    const bodyH = wide ? Math.max(pick.h, colH) : pick.h + (parts.length ? sp.gap + colH : 0)
    const spare = bottom - bodyTop - tail - bodyH
    const widest = Math.max(0, ...parts.map(([, p]) => p.w))
    const gridW = GRID_COLS * cell + (GRID_COLS - 1) * sp.cellGap + 2
    if (!force && (spare < 0 || gridW > pickW || (wide ? widest > restW : widest > across))) return null

    const out: ItemsLayout = {
      wide, tabs: tabsBox(o, vw, first),
      heading: null!, grid: null!, cells: [], line: null!,
      always: null, weights: null, carried: null, quest: null, last: null, gave: [],
    }
    const place = (key: keyof ItemsLayout, p: Sized<object>, x: number, y: number) => { Object.assign(out, { [key]: p.at(x, y) }) }
    let lastY: number
    if (!wide) {
      // Room left over opens the gaps a little and stands the page in the middle of the rest.
      const joins = parts.length + (lastH ? 1 : 0)
      const more = Math.max(0, Math.min(7, Math.floor(spare / (joins + 2))))
      let y = bodyTop + Math.max(0, Math.floor((spare - more * joins) / 2))
      Object.assign(out, pick.at(left + Math.floor((across - pick.w) / 2), y))
      y += pick.h
      for (const [key, p] of parts) {
        y += sp.gap + more
        place(key, p, left + Math.floor((across - p.w) / 2), y)
        y += p.h
      }
      lastY = y + sp.gap + more
    } else {
      const colW = Math.max(0, widest)
      const gap = colW ? Math.max(between, Math.min(24, across - pickW - colW)) : 0
      const x0 = left + Math.max(0, Math.floor((across - pickW - gap - colW) / 2))
      const y0 = bodyTop + Math.max(0, Math.floor(spare / 2))
      Object.assign(out, pick.at(x0, y0 + Math.floor((bodyH - pick.h) / 2)))
      let y = y0 + Math.floor((bodyH - colH) / 2)
      for (const [key, p] of parts) {
        place(key, p, x0 + pickW + gap + Math.floor((colW - p.w) / 2), y)
        y += p.h + sp.gap
      }
      lastY = bottom - lastH
    }
    if (lastH) {
      const hints: NonNullable<ItemsLayout['last']>['hints'] = []
      let y = lastY
      for (const { g, f } of groups) {
        const x = left + Math.floor((across - f.w) / 2)
        g.forEach((h, i) => hints.push({ ...label(o.font, h.text, x + f.at[i]![0], y + f.at[i]![1]), tone: h.tone }))
        y += f.rows * sp.pitch
      }
      const x = Math.min(...hints.map(h => h.x))
      out.last = { x, y: lastY, w: Math.max(...hints.map(h => h.x + h.w)) - x, h: lastH, hints }
    }
    if (c.always.length && !l.always) out.gave.push('always')
    if (!l.quest || l.questLines < questMost) out.gave.push('quest')
    if (!l.carried) out.gave.push('carried')
    return out
  }

  // What to give up, one step at a time.
  const all: Level = { always: true, questLines: questMost, carried: true, quest: true }
  const levels: Level[] = [all]
  if (c.always.length) levels.push({ ...all, always: false })
  for (let n = questMost - 1; n >= 1; n--) levels.push({ ...all, always: false, questLines: n })
  levels.push({ always: false, questLines: 1, carried: false, quest: true })
  // (A screen smaller than any the game is played on gives up the quest too.)
  levels.push({ always: false, questLines: 0, carried: false, quest: false })
  for (const l of levels) {
    for (let cell = Math.max(CELL_MOST, least); cell >= least; cell--) {
      for (const sp of SPACINGS) {
        const page = tryPage(l, cell, sp)
        if (page) return page
      }
    }
  }
  return tryPage(levels[levels.length - 1]!, least, SPACINGS[1]!, true)!
}

// ---- the pictures --------------------------------------------------------------------------------------------

export type CellKind = 'empty' | 'owned' | 'held'

/** A cell of `side` px: an empty socket's dim outline; a ground and an edge for a thing owned; the one in hand framed in gold. */
export function cellPicture(side: number, kind: CellKind): CornerPicture {
  const B = new Buf(side, side)
  const edge = kind === 'held' ? SKIN.prize : kind === 'owned' ? SKIN.dim : QUIET
  const thick = kind === 'held' ? 2 : 1
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    // (Notched corners, as the corner's plates have.)
    if ((x === 0 || x === side - 1) && (y === 0 || y === side - 1)) continue
    const from = Math.min(x, y, side - 1 - x, side - 1 - y)
    if (from < thick) B.set(x, y, edge)
    else if (kind !== 'empty') B.set(x, y, FILL)
  }
  return B
}

/** The cursor round a cell of `side` px, a px wider on every side: cyan, its corners only, two px thick. */
export function cursorPicture(side: number): CornerPicture {
  const n = side + 2
  const B = new Buf(n, n)
  const arm = Math.max(5, Math.floor(n / 4))
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = Math.min(x, n - 1 - x)
    const dy = Math.min(y, n - 1 - y)
    if (Math.min(dx, dy) < 2 && Math.max(dx, dy) < arm) B.set(x, y, SKIN.cool)
  }
  return B
}

/** The balance, drawn plain: the beam, seven hooks, and under each a dim ring, or the pan a Weight held hangs in. */
export function balancePicture(held: boolean[], pitch: number): CornerPicture {
  const B = new Buf(pitch * held.length, BALANCE_H)
  for (let x = 0; x < B.w; x++) B.set(x, 0, SKIN.dim)
  held.forEach((on, i) => {
    const mid = i * pitch + Math.floor(pitch / 2)
    for (let y = 1; y < (on ? 4 : 7); y++) B.set(mid, y, on ? SKIN.dim : QUIET)
    if (on) {
      for (let x = mid - 7; x <= mid + 6; x++) B.set(x, BALANCE_H - 1, SKIN.prize)
      B.set(mid - 8, BALANCE_H - 2, SKIN.prize)
      B.set(mid + 7, BALANCE_H - 2, SKIN.prize)
      return
    }
    // The empty pan: a ring.
    for (let y = 6; y < 19; y++) for (let x = mid - 7; x <= mid + 7; x++) {
      const d = Math.hypot(x - mid, y - 12)
      if (d >= 4.5 && d < 5.5) B.set(x, y, QUIET)
    }
  })
  return B
}

// ---- the painter ---------------------------------------------------------------------------------------------

export interface ItemsPageOpts {
  keys: HudKeys
  /** The cell the cursor stands on. */
  cursor: number
  /** CSS px a logical px (none: 2 on the fine dress, 1.5 on the classic one, a phone's). */
  css?: number
  /** The top of the touch deck in logical px, as the shell measured it. */
  deck?: number | null
  safe?: { top?: number; left?: number; right?: number; bottom?: number }
  muted?: boolean
  /** The current view's name, for the keys' hints. */
  view?: string
  /** Told where everything was laid, for what stands over the canvas (the cells' buttons). */
  placed?: (page: ItemsLayout) => void
}

/** The page laid out for a game on a screen: what `drawItemsPage` paints. */
export function itemsPageFor(s: GameState, vw: number, vh: number, o: ItemsPageOpts, skin: HudSkin): { layout: ItemsLayout; opts: ItemsLayoutOpts } {
  const density = skin.density ?? 1
  const css = o.css ?? (density > 1 ? 2 : 1.5)
  const opts: ItemsLayoutOpts = {
    content: itemsPageContent(s, o),
    density,
    css,
    keys: !o.keys.touch,
    bottom: pageBottom(vh, o, css),
    safe: o.safe,
    font: hudFont(skin),
  }
  return { layout: itemsPageLayout(vw, vh, opts), opts }
}

function blit(g: G, pic: CornerPicture, x: number, y: number) {
  for (let j = 0; j < pic.h; j++) {
    for (let i = 0; i < pic.w;) {
      const c = pic.px[j * pic.w + i]
      let end = i + 1
      while (end < pic.w && pic.px[j * pic.w + end] === c) end++
      if (c) { g.fillStyle = c; g.fillRect(x + i, y + j, end - i, 1) }
      i = end
    }
  }
}

/** A sprite in the middle of a box, as the dress shows it. */
function icon(g: G, skin: HudSkin, name: string, b: Box) {
  const spr = sprite(name)
  const x = b.x + Math.floor((b.w - spr.width) / 2)
  const y = b.y + Math.floor((b.h - spr.height) / 2)
  g.drawImage(skin.icon ? skin.icon(name) : spr, x, y, spr.width, spr.height)
}

/** The ITEMS page of the menu, in the skin's logical px; the caller sets the scale. */
export function drawItemsPage(g: G, s: GameState, vw: number, vh: number, o: ItemsPageOpts, skin: HudSkin) {
  g.fillStyle = PAGE_VEIL
  g.fillRect(0, 0, vw, vh)
  const F = hudFont(skin)
  const { layout: p, opts } = itemsPageFor(s, vw, vh, o, skin)
  o.placed?.(p)
  const c = opts.content
  const text = (t: string, x: number, y: number, color: string) => F.draw(g, t, x, y, color, SKIN.outline)
  const say = (l: Label, color: string) => text(l.text, l.x, l.y, color)
  drawMenuTabs(g, 'items', vw, p.tabs.y, o.keys, skin)
  say(p.heading, SKIN.prize)

  p.cells.forEach((b, i) => {
    const cell = c.cells[i]!
    blit(g, cellPicture(b.w, cell.held ? 'held' : cell.id ? 'owned' : 'empty'), b.x, b.y)
    if (!cell.id) return
    icon(g, skin, cell.icon, b)
    if (cell.count === null) return
    const n = String(cell.count)
    text(n, b.x + b.w - 2 - Math.ceil(F.width(n)), b.y + b.h - 9, cell.count ? WHITE : SKIN.hot)
  })
  const at = p.cells[o.cursor]
  if (at) blit(g, cursorPicture(at.w), at.x - 1, at.y - 1)

  const on = c.cells[o.cursor]
  if (on?.id) {
    const centred = (t: string, y: number, color: string) => text(t, p.line.x + Math.floor((p.line.w - F.width(t)) / 2), y, color)
    centred(on.name, p.line.y, SKIN.prize)
    F.wrap(on.does, p.line.w).forEach((t, i) => centred(t, p.line.y + LINE + 3 + i * p.line.pitch, WHITE))
  }

  if (p.always) {
    say(p.always.label, SKIN.dim)
    p.always.icons.forEach((b, i) => icon(g, skin, c.always[i]!, b))
  }
  if (p.weights && c.weights) {
    blit(g, balancePicture(c.weights.map(Boolean), p.weights.balance.w / c.weights.length), p.weights.balance.x, p.weights.balance.y)
    p.weights.pans.forEach((b, i) => { const name = c.weights![i]; if (name) icon(g, skin, name, b) })
    say(p.weights.count, SKIN.prize)
  }
  const h = p.carried
  if (h) {
    say(h.label, SKIN.dim)
    // (The fine dress draws the heart centred on a line of lettering; the classic one has four squares.)
    if (skin.pieces) skin.pieces(g, h.pieces.x, h.pieces.y + 4, c.pieces)
    else for (let i = 0; i < 4; i++) {
      g.fillStyle = i < c.pieces ? SKIN.hot : skin.off
      g.fillRect(h.pieces.x + 3 + (i % 2) * 5, h.pieces.y + 4 + Math.floor(i / 2) * 5, 4, 4)
    }
    if (h.key) { icon(g, skin, 'item_key', { ...h.key, w: ICON }); say(h.key.count, SKIN.prize) }
    if (h.bigKey) icon(g, skin, 'item_bigkey', h.bigKey)
    for (const e of h.errands) icon(g, skin, e.icon, e)
  }
  if (p.quest) {
    say(p.quest.title, SKIN.prize)
    for (const l of p.quest.lines) say(l, WHITE)
  }
  for (const l of p.last?.hints ?? []) say(l, SKIN[l.tone])
}
