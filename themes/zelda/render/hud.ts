/**
 * The heads-up display, drawn in logical pixels on the UI layer: hearts,
 * the B-item box, bits/bombs/keys, the area banner, the dialog box, the
 * menu's tabs and MOVES page, and the start-over question.
 */
import type { GameState, World } from '../types'
import { subst, type HudKeys } from '../keys'
import { drawText, textWidth, wrapText, GLYPH_H } from '../../base/pixel/font'
import { sprite } from './sheet'
import { hasBigKey, keyCount } from '../engine/map'
import { asksChoice } from '../engine/game'
import { itemIconName } from './itemIcon'
import { ARTS, MOVES, type ArtId, type MoveId } from '../types'
import { artRest, isArt, knowsArt, mastered, moveCount } from '../engine/moves'
import { PAGE_VEIL } from './mapPage'

type G = CanvasRenderingContext2D

/**
 * A skin's own lettering, measured and placed in the HUD's logical pixels
 * like the 5×7 font (y is the top of a seven-row line box), whatever it is
 * drawn with.
 */
export interface HudFont {
  width(text: string): number
  wrap(text: string, maxWidth: number): string[]
  draw(g: G, text: string, x: number, y: number, color: string, shadow?: string): void
}

/** The 5×7 pixel font every skin wears unless it brings its own. */
const PIXEL_FONT: HudFont = { width: textWidth, wrap: wrapText, draw: drawText }

/** The lettering a skin's text is drawn with. */
export function hudFont(skin?: HudSkin): HudFont {
  return skin?.font ?? PIXEL_FONT
}

/**
 * How the HUD is dressed. Each view may bring its own: the classic neon
 * boxes, the 16-bit gradient windows of the isometric view. The layout is the same in all of them.
 */
export interface HudSkin {
  /** A panel: the dialog box, the pause screen's box, the item box, a label's plate. `tone`: the edge is the hot colour or the cool one. */
  panel(g: G, x: number, y: number, w: number, h: number, tone?: 'hot' | 'cool'): void
  /**
   * Canvas pixels per logical pixel (none: 1). At 2 the layout is the same,
   * in logical pixels, on a canvas scaled 2×: the skin's panels, lettering
   * and icons are drawn at half-pixel detail (`hudLayer` in renderer.ts).
   */
  density?: 1 | 2
  /** Its own lettering (none: the 5×7 pixel font). */
  font?: HudFont
  /** A sprite as this skin shows it, drawn at the sprite's own logical size (none: the sprite itself). */
  icon?(name: string): HTMLCanvasElement
  /** The mark in the corner of a dialog line that has more after it; (x, y) is where the classic arrow's top-left is (none: that arrow, blinking). */
  more?(g: G, x: number, y: number, time: number): void
  /** The pointer at the answer picked; (x, y) is the top-left of the eight pixels left of the answer (none: a '>'). */
  pointer?(g: G, x: number, y: number, time: number): void
  /** The heart pieces found so far (0–4), at (x, y) after their label (none: four squares). */
  pieces?(g: G, x: number, y: number, have: number): void
  /** The hearts drawn this much larger than their sprite (none: 1), and this far apart (none: 9 logical px). */
  heartScale?: number
  heartStep?: number
  /** A known speaker's name ("KEEPER: …") goes on a plate on the dialog box's edge instead of in front of the line. */
  plate?: boolean
  /** A dialog box at the top of the screen starts under the hearts and the counters instead of on them, when the hero leaves it the room. */
  underHud?: boolean
  /** The skin worn in its place on a screen too coarse for its density (a screen scale of 1), where it has no finer pixel to draw with. */
  coarse?: () => HudSkin
  /** Body text and the shadow under it (none: no shadow). */
  text: string
  shadow?: string
  /** Secondary text, and text that is switched off. */
  dim: string
  faint: string
  hot: string
  cool: string
  prize: string
  ok: string
  /** Under text that lies straight on the world. */
  outline: string
  /** Over the stopped world on the pause screen. */
  veil: string
  /** An empty slot, and a heart piece not yet found. */
  slot: string
  off: string
}

function neonPanel(g: G, x: number, y: number, w: number, h: number, tone: 'hot' | 'cool' = 'hot') {
  g.fillStyle = 'rgba(11,6,22,0.86)'
  g.fillRect(x, y, w, h)
  g.fillStyle = tone === 'hot' ? '#ff2fa0' : '#2ff3ff'
  g.fillRect(x + 1, y, w - 2, 1)
  g.fillRect(x + 1, y + h - 1, w - 2, 1)
  g.fillRect(x, y + 1, 1, h - 2)
  g.fillRect(x + w - 1, y + 1, 1, h - 2)
  g.fillStyle = 'rgba(47,243,255,0.35)'
  g.fillRect(x + 2, y + 2, w - 4, 1)
}

/** The classic view's neon boxes. */
export const NEON_SKIN: HudSkin = {
  panel: neonPanel,
  text: '#fff4ff', shadow: '#3a1a4a', dim: '#b9a8d9', faint: '#4a3d68',
  hot: '#ff2fa0', cool: '#2ff3ff', prize: '#ffd23f', ok: '#b6ff4a',
  outline: '#0b0616', veil: 'rgba(11,6,22,0.78)', slot: 'rgba(47,243,255,0.08)', off: '#3a2a5a',
}

/**
 * A 16-bit window: a blue gradient in bands (the machine had the colours for
 * it, and a dither where two bands meet), a white bevel, corners cut round.
 */
function windowPanel(g: G, x: number, y: number, w: number, h: number, tone: 'hot' | 'cool' = 'hot') {
  const bands = tone === 'hot' ? ['#3a46c8', '#2f38b0', '#262c98', '#1d2180', '#151868'] : ['#1f7a9a', '#1a6888', '#155676', '#104464', '#0b3252']
  for (let r = 0; r < h; r++) {
    const f = (r / Math.max(1, h - 1)) * (bands.length - 1)
    const i = Math.min(bands.length - 1, Math.floor(f))
    g.fillStyle = bands[i]!
    g.fillRect(x, y + r, w, 1)
    // The row before a band changes is every other pixel of the next one.
    if (f - i > 0.75 && i + 1 < bands.length) {
      g.fillStyle = bands[i + 1]!
      for (let c = (r + x) % 2; c < w; c += 2) g.fillRect(x + c, y + r, 1, 1)
    }
  }
  // Bevel: dark outside, white, then a soft blue inside.
  g.fillStyle = '#0a0e30'
  g.fillRect(x + 2, y - 1, w - 4, 1); g.fillRect(x + 2, y + h, w - 4, 1)
  g.fillRect(x - 1, y + 2, 1, h - 4); g.fillRect(x + w, y + 2, 1, h - 4)
  g.fillRect(x, y, 2, 1); g.fillRect(x, y + 1, 1, 1); g.fillRect(x + w - 2, y, 2, 1); g.fillRect(x + w - 1, y + 1, 1, 1)
  g.fillRect(x, y + h - 1, 2, 1); g.fillRect(x, y + h - 2, 1, 1); g.fillRect(x + w - 2, y + h - 1, 2, 1); g.fillRect(x + w - 1, y + h - 2, 1, 1)
  g.fillStyle = '#f4f6ff'
  g.fillRect(x + 2, y, w - 4, 1); g.fillRect(x + 2, y + h - 1, w - 4, 1)
  g.fillRect(x, y + 2, 1, h - 4); g.fillRect(x + w - 1, y + 2, 1, h - 4)
  g.fillRect(x + 1, y + 1, 1, 1); g.fillRect(x + w - 2, y + 1, 1, 1); g.fillRect(x + 1, y + h - 2, 1, 1); g.fillRect(x + w - 2, y + h - 2, 1, 1)
  g.fillStyle = 'rgba(160,190,255,0.5)'
  g.fillRect(x + 2, y + 1, w - 4, 1)
  g.fillRect(x + 1, y + 2, 1, h - 4)
  g.fillStyle = 'rgba(6,8,40,0.45)'
  g.fillRect(x + 2, y + h - 2, w - 4, 1)
  g.fillRect(x + w - 2, y + 2, 1, h - 4)
}

/** The isometric view's 16-bit windows. */
export const WINDOW_SKIN: HudSkin = {
  panel: windowPanel,
  text: '#ffffff', shadow: '#0a0e30', dim: '#b8c8ff', faint: '#6a78c0',
  hot: '#ff9ad8', cool: '#8fe8ff', prize: '#ffe066', ok: '#a8f070',
  outline: '#0a0e30', veil: 'rgba(8,10,44,0.72)', slot: 'rgba(160,190,255,0.14)', off: '#2a3080',
}

/** The same windows for a view at twice the pixel density: finer bands, a real dialog font, hearts with a light on them (hud16.ts). */
export { HIRES_WINDOW_SKIN } from './hud16'

/**
 * The HUD's whole-number scale (device px per logical px) for a skin. A skin
 * at density 2 needs an even one, so each of its half pixels is a whole
 * number of device pixels: on an odd screen scale it takes the next even one
 * up when the layout still has room at that size (the lettering then stays as
 * large as the classic HUD's on a phone), else the one below, 2 at least.
 * `W`, `H`: the screen in device px.
 */
export function hudScale(scale: number, W: number, H: number, density = 1): number {
  if (density < 2 || scale % 2 === 0) return scale
  const up = scale + 1
  if (Math.ceil(W / up) >= HUD_MIN_W && Math.ceil(H / up) >= HUD_MIN_H) return up
  return Math.max(2, scale - 1)
}
/** The smallest logical area the layout is drawn for: the menu's pages across, and from its tabs to their last line (the classic view never shows less than 176 rows either). */
const HUD_MIN_W = 176
const HUD_MIN_H = 176

/** A sprite at (x, y), as the skin shows it. */
function icon(g: G, skin: HudSkin, name: string, x: number, y: number) {
  const spr = sprite(name)
  if (skin.icon) g.drawImage(skin.icon(name), x, y, spr.width, spr.height)
  else g.drawImage(spr, x, y)
}

export function drawHud(g: G, s: GameState, vw: number, time: number, touch: boolean, skin: HudSkin = NEON_SKIN, world?: World) {
  const h = s.hero
  const inv = s.inv
  const F = hudFont(skin)
  // Hearts (top-left), up to 10 per row.
  const hearts = Math.ceil(h.maxHp / 2)
  const low = h.hp <= 2
  const step = skin.heartStep ?? 9
  const hs = skin.heartScale ?? 1
  for (let i = 0; i < hearts; i++) {
    const hp = h.hp - i * 2
    const name = hp >= 2 ? 'hud_heart_full' : hp === 1 ? 'hud_heart_half' : 'hud_heart_empty'
    const x = 4 + (i % 10) * step
    const y = 4 + Math.floor(i / 10) * step - (low && hp > 0 && Math.floor(time * 4) % 2 === 0 ? 1 : 0)
    if (hs === 1) icon(g, skin, name, x, y)
    else { const spr = sprite(name); g.drawImage(skin.icon ? skin.icon(name) : spr, x, y, spr.width * hs, spr.height * hs) }
  }
  // Counters row under the hearts.
  let cx = 4
  const cy = 4 + Math.ceil(hearts / 10) * step + 2 + Math.round(7 * (hs - 1))
  const counter = (name: string, n: number, digits: number, color = skin.text) => {
    icon(g, skin, name, cx, cy)
    const t = String(n).padStart(digits, '0')
    F.draw(g, t, cx + 10, cy + 1, color, skin.outline)
    cx += 10 + F.width(t) + 6
  }
  counter('hud_bit', inv.bits, 3, skin.ok)
  if (inv.bombBag) counter('hud_bomb', inv.bombs, 2)
  const keys = keyCount(s)
  if (keys > 0 || s.map.ring !== 'shrine' || s.map.id === 'shrine') counter('hud_key', keys, 1, skin.prize)
  if (hasBigKey(s)) { icon(g, skin, 'hud_bigkey', cx, cy); cx += 12 }

  // B-item box right of the hearts (touch shows it on the B button instead;
  // its pause chip owns the top-right corner). An art resting shows dim, its rest filling a bar under it.
  if (!touch && inv.selected) {
    const bx = Math.max(4 + Math.min(hearts, 10) * step, cx) + 4
    skin.panel(g, bx, 3, 22, 22, 'cool')
    const item = itemIconName(s)
    const rest = isArt(inv.selected) ? artRest(s, inv.selected) : 1
    if (rest < 1) g.globalAlpha = 0.35
    icon(g, skin, item, bx + 11 - sprite(item).width / 2, 6)
    g.globalAlpha = 1
    if (rest < 1) {
      g.fillStyle = skin.off
      g.fillRect(bx + 3, 21, 16, 2)
      g.fillStyle = skin.cool
      g.fillRect(bx + 3, 21, Math.round(16 * rest), 2)
    }
    F.draw(g, 'K', bx + 24, 4, skin.cool, skin.outline)
  }
  void vw
}

export function drawBanner(g: G, text: string, t: number, vw: number, vh: number, skin: HudSkin = NEON_SKIN) {
  const a = Math.min(1, t * 3, (2.2 - t) * 2)
  if (a <= 0) return
  const F = hudFont(skin)
  g.globalAlpha = a
  const w = F.width(text)
  const x = Math.round((vw - w) / 2)
  const y = Math.round(vh * 0.22)
  if (skin === NEON_SKIN) {
    g.fillStyle = 'rgba(11,6,22,0.6)'
    g.fillRect(x - 8, y - 5, w + 16, GLYPH_H + 10)
    drawText(g, text, x, y, '#fff4ff', '#ff2fa0')
    g.fillStyle = '#ff2fa0'
    g.fillRect(x - 8, y + GLYPH_H + 4, w + 16, 1)
    g.fillStyle = '#2ff3ff'
    g.fillRect(x - 8, y - 5, w + 16, 1)
  } else {
    skin.panel(g, x - 8, y - 5, w + 16, GLYPH_H + 10, 'hot')
    F.draw(g, text, x, y, skin.text, skin.shadow)
  }
  g.globalAlpha = 1
}

/** A line that opens with a name: "KEEPER: …". */
const SPEAKER = /^([A-ZÆØÅ0-9][A-ZÆØÅ0-9 .'-]{1,15}):\s+(?=\S)/

/**
 * The name a spoken line opens with and the line without it, when the name
 * is the speaker's: `who` is who is talking (an NPC's look, null for a sign
 * or a thought), `first` the line their talk opened with. The name counts
 * when it is the speaker's own or the one the talk opened with (a barmaid's
 * lines say BARTENDER); a heading further in ("TODAY: …") is not a name.
 */
export function speakerOf(line: string, who: string | null | undefined, first = line): { name: string; body: string } | null {
  if (!who) return null
  const m = SPEAKER.exec(line)
  if (!m) return null
  const name = m[1]!
  if (name !== who.toUpperCase() && SPEAKER.exec(first)?.[1] !== name) return null
  return { name, body: line.slice(m[0].length) }
}

/** The most rows of text any line of a talk wraps to in a box, per talk (its lines are one array for as long as it lasts), font and width. */
const tallest = new WeakMap<readonly string[], { font: HudFont; inner: number; keys: string; rows: number }>()

function tallestRows(lines: readonly string[], who: string | null | undefined, plate: boolean, F: HudFont, inner: number, keys: HudKeys): number {
  const hit = tallest.get(lines)
  // The key names are part of the lines ("PRESS {A}").
  const named = keys.a + keys.b + keys.cycle
  if (hit && hit.font === F && hit.inner === inner && hit.keys === named) return hit.rows
  let rows = 1
  for (const raw of lines) {
    const line = subst(raw, keys)
    const said = plate ? speakerOf(line, who, lines[0]) : null
    rows = Math.max(rows, F.wrap(said ? said.body : line, inner).length)
  }
  tallest.set(lines, { font: F, inner, keys: named, rows })
  return rows
}

/** Dialog box: typed text, wrapped, bottom or top depending on the hero. */
export function drawDialog(g: G, s: GameState, vw: number, vh: number, heroScreenY: number, keys: HudKeys, time: number, skin: HudSkin = NEON_SKIN) {
  const d = s.dialog
  if (!d) return
  const F = hudFont(skin)
  const line = subst(d.lines[d.line] ?? '', keys)
  const w = Math.min(vw - 12, 280)
  const inner = w - 16
  // A skin with name plates lifts "KEEPER: " off the front of a known speaker's line; the letters still take their time to type.
  const named = skin.plate ? speakerOf(line, d.who, d.lines[0]) : null
  const body = named ? named.body : line
  const wrapped = F.wrap(body, inner)
  // An exit's last line asks YES / NO on a row of its own, YES in the left half and NO in the right (touch taps a half).
  const asks = asksChoice(d)
  const textH = wrapped.length * (GLYPH_H + 4)
  const h = textH + 14 + (asks ? GLYPH_H + 8 : 0)
  const x = Math.round((vw - w) / 2)
  const top = heroScreenY > vh * 0.58
  let y = top ? 8 : vh - h - 8
  if (top && skin.underHud && s.inv.sword) {
    // Under the hearts, the counters and the item box, if the tallest box this talk will show (its plate and a question's row with it) still ends well over the hero's head: the box then stays where it is from line to line.
    const under = 4 + Math.ceil(Math.ceil(s.hero.maxHp / 2) / 10) * 9 + 2 + 9 + 6
    const reach = tallestRows(d.lines, d.who, !!skin.plate, F, inner, keys) * (GLYPH_H + 4) + 14 + GLYPH_H + 8 + (skin.plate ? 10 : 0)
    if (under + Math.max(h, reach) <= heroScreenY - 26) y = under
  }
  skin.panel(g, x, y, w, h, 'hot')
  if (named) {
    // The plate rides the box's edge on the side away from the screen's: over a box at the bottom, under one at the top.
    const name = named.name
    const pw = F.width(name) + 12
    const py = top ? y + h - 4 : y - 9
    skin.panel(g, x + 6, py, pw, GLYPH_H + 6, 'cool')
    F.draw(g, name, x + 12, py + 3, skin.prize, skin.shadow)
  }
  // The line is typed at the pace of the whole of it, name and all, so the body starts at once and ends when the line does.
  let left = Math.floor(named ? d.chars * body.length / line.length : d.chars)
  for (let i = 0; i < wrapped.length; i++) {
    const text = wrapped[i]!
    const shown = text.slice(0, Math.max(0, left))
    left -= text.length + 1
    F.draw(g, shown, x + 8, y + 8 + i * (GLYPH_H + 4), skin.text, skin.shadow)
  }
  if (asks) {
    if (d.chars < line.length) return
    const oy = y + 8 + textH + 4
    ;(d.ask?.options ?? ['YES', 'NO']).forEach((label, i) => {
      const on = (d.choice ?? 0) === i
      const cx = x + Math.round(w * (i === 0 ? 0.3 : 0.7))
      const tx = Math.round(cx - F.width(label) / 2)
      F.draw(g, label, tx, oy, on ? skin.cool : skin.dim, on && skin.shadow ? skin.outline : undefined)
      if (!on) return
      if (skin.pointer) skin.pointer(g, tx - 8, oy, time)
      else F.draw(g, '>', tx - 8, oy, skin.cool)
    })
    return
  }
  if (d.chars < line.length) return
  if (skin.more) { skin.more(g, x + w - 11, y + h - 7, time); return }
  if (Math.floor(time * 3) % 2 === 0) {
    g.fillStyle = skin.cool
    g.fillRect(x + w - 11, y + h - 7, 5, 1)
    g.fillRect(x + w - 10, y + h - 6, 3, 1)
    g.fillRect(x + w - 9, y + h - 5, 1, 1)
  }
}

/** The NEW GAME machine's "start over?" question, over the stopped world until answered. */
function drawConfirmReset(g: G, vw: number, vh: number, keys: HudKeys, skin: HudSkin) {
  const w = Math.min(vw - 16, 240)
  const x = Math.round((vw - w) / 2)
  const F = hudFont(skin)
  const lines = F.wrap('YOUR QUEST, ITEMS AND HEARTS WILL BE GONE, HERE AND ON YOUR PILOT. YOUR BEST TIME STAYS.', w - 16)
  const h = 20 + lines.length * 10
  let y = Math.max(8, Math.round(vh / 2 - h / 2 - 14))
  const title = 'START OVER?'
  F.draw(g, title, Math.round((vw - F.width(title)) / 2), y, skin.hot, skin.outline)
  y += 14
  skin.panel(g, x, y, w, h, 'hot')
  lines.forEach((l, i) => F.draw(g, l, x + 8, y + 10 + i * 10, skin.text))
  const hint = keys.touch ? 'YES OR NO BELOW' : 'Y YES   N NO'
  F.draw(g, hint, Math.round((vw - F.width(hint)) / 2), y + h + 8, skin.dim)
}

/** The menu's pages. */
export type MenuPage = 'items' | 'moves' | 'map' | 'log'

/**
 * The row the menu's tabs stand on, ITEMS and MOVES alike: a small margin under the safe area, smaller on a short
 * screen. (The MAP page picks the same two by what it has to fit, `mapPage.ts`.)
 */
export const menuTabsY = (vh: number, safeTop = 0) => safeTop + (vh < 340 ? 2 : 4)

/** Where each of the menu's tabs stands in the row at `y`, in the menu's order; `keyboard`: each says its key. */
export function menuTabs(F: Pick<HudFont, 'width'>, vw: number, y: number, keyboard: boolean) {
  const tabs: Array<[MenuPage, string]> = [['items', keyboard ? 'P ITEMS' : 'ITEMS'], ['moves', keyboard ? 'N MOVES' : 'MOVES'], ['map', keyboard ? 'M MAP' : 'MAP'], ['log', keyboard ? 'G LOG' : 'LOG']]
  const words = tabs.reduce((a, [, t]) => a + F.width(t), 0)
  const gap = Math.min(18, Math.max(8, Math.floor((vw - words) / tabs.length)))
  let x = Math.round((vw - words - gap * (tabs.length - 1)) / 2)
  return tabs.map(([id, label]) => {
    const tab = { id, label, x, y, w: Math.ceil(F.width(label)), h: 10 }
    x += tab.w + gap
    return tab
  })
}

/** The box round the whole row of tabs, as the pages' layouts keep clear of it. */
export function menuTabsBox(F: Pick<HudFont, 'width'>, vw: number, y: number, keyboard: boolean) {
  const tabs = menuTabs(F, vw, y, keyboard)
  const last = tabs[tabs.length - 1]!
  return { x: tabs[0]!.x, y, w: last.x + last.w - tabs[0]!.x, h: last.h }
}

/** The menu's four pages, side by side over it, the one open lit: ITEMS (P, Escape), MOVES (N), MAP (M) and LOG (G). Returns the y under them. */
export function drawMenuTabs(g: G, page: MenuPage, vw: number, y: number, keys: HudKeys, skin: HudSkin): number {
  const F = hudFont(skin)
  for (const t of menuTabs(F, vw, y, !keys.touch)) {
    const on = t.id === page
    F.draw(g, t.label, t.x, y, on ? skin.hot : skin.faint, on ? skin.outline : undefined)
    if (on) { g.fillStyle = skin.hot; g.fillRect(t.x, y + GLYPH_H + 2, t.w, 1) }
  }
  return y + 14
}

/** The NEW GAME machine's question over the stopped world. (The menu's pages: `itemsPage.ts`, `drawMoves`, `mapPage.ts`, `logPage.ts`.) */
export function drawPause(g: G, vw: number, vh: number, keys: HudKeys, skin: HudSkin = NEON_SKIN) {
  g.fillStyle = skin.veil
  g.fillRect(0, 0, vw, vh)
  drawConfirmReset(g, vw, vh, keys, skin)
}

/** How long the view strip stays up after a change (seconds). */
export const STRIP_TIME = 2.6

/**
 * The view strip: every way the world can be shown, side by side, the one in
 * use lit. It comes up when the viewfinder on the square turns the view and
 * goes again, so a visitor sees that there is a round to go. (The pause
 * screen, where the views are chosen, names the view itself.)
 */
export function drawViewStrip(g: G, strip: { views: ReadonlyArray<{ name: string; tag: string }>; at: number; t: number }, vw: number, vh: number, touch: boolean, skin: HudSkin = NEON_SKIN) {
  const n = strip.views.length
  if (!n || strip.t >= STRIP_TIME) return
  const F = hudFont(skin)
  const cardW = (v: { name: string; tag: string }) => Math.ceil(Math.max(F.width(v.name), F.width(v.tag))) + 12
  const gap = 3
  // Every view in a row when they fit; else the one in use between its neighbours.
  let shown = strip.views.map((v, i) => ({ v, i }))
  const rowW = (list: typeof shown) => list.reduce((a, c) => a + cardW(c.v), 0) + gap * (list.length - 1)
  if (rowW(shown) > vw - 8 && n > 3) shown = [-1, 0, 1].map(d => { const i = (strip.at + d + n) % n; return { v: strip.views[i]!, i } })
  while (shown.length > 1 && rowW(shown) > vw - 8) shown = shown.filter(c => c.i === strip.at)
  const w = rowW(shown)
  const h = GLYPH_H * 2 + 11
  let x = Math.round((vw - w) / 2)
  // Under the HUD's rows, in the top third: the bottom of the screen is the dialog box's and the page's own hint.
  const y = Math.max(40, Math.round(vh * 0.14))
  for (const { v, i } of shown) {
    const cw = cardW(v)
    const on = i === strip.at
    skin.panel(g, x, y, cw, h, on ? 'hot' : 'cool')
    if (!on) { g.fillStyle = skin.veil; g.fillRect(x + 1, y + 1, cw - 2, h - 2) }
    F.draw(g, v.name, x + Math.round((cw - F.width(v.name)) / 2), y + 4, on ? skin.text : skin.dim, on ? skin.shadow : undefined)
    F.draw(g, v.tag, x + Math.round((cw - F.width(v.tag)) / 2), y + 6 + GLYPH_H, on ? skin.prize : skin.faint)
    x += cw + gap
  }
  void touch
  const count = `${strip.at + 1}/${n}`
  F.draw(g, count, Math.round((vw - F.width(count)) / 2), y + h + 4, skin.dim, skin.outline)
}

/** The art on the MOVES page: where it is to be found before it is learned (where to go, never how), what it does after. */
const ART_HINT: Record<ArtId, { find: string; does: string }> = {
  hop: { find: 'THE KEEPER HAS ONE MORE THING TO TEACH.', does: 'HOP CLEAR OF A BLOW. NO FOE CAN HIT YOU IN THE AIR.' },
}

/** How wide a combo's buttons are drawn (`drawKeys`). */
const keysWidth = (F: HudFont, keys: string) => keys.split(' ').reduce((sum, tok, i) => sum + F.width(tok) + (i ? 4 : 0), 0)

/** A combo's buttons, each token in its colour: A the blade, R the roll, B, the rest as words. */
function drawKeys(g: G, F: HudFont, keys: string, x: number, y: number, skin: HudSkin) {
  let cx = x
  for (const tok of keys.split(' ')) {
    const color = tok === 'A' ? skin.hot : tok === 'R' ? skin.cool : tok === 'B' ? skin.prize : skin.dim
    F.draw(g, tok, cx, y, color)
    cx += F.width(tok) + 4
  }
}

/**
 * The MOVES page (`N`): every combo with its buttons and how far it is from mastered (a gold MASTER once it is),
 * and the art on B, learned (what it does) or where to look for it. Laid out to fit a phone on its side. As the
 * menu's other pages it lies on the world under `PAGE_VEIL`, its tabs at the top (`top`: the safe area, logical px).
 */
export function drawMoves(g: G, s: GameState, vw: number, vh: number, keys: HudKeys, skin: HudSkin = NEON_SKIN, top = 0) {
  g.fillStyle = PAGE_VEIL
  g.fillRect(0, 0, vw, vh)
  const F = hudFont(skin)
  const w = Math.min(vw - 12, 248)
  const x = Math.round((vw - w) / 2)
  const row = vh < 230 ? 9 : 10
  const art = ARTS[0]!
  const known = knowsArt(s, art.id)
  const textX = 7 + 22
  const tip = F.wrap(known ? ART_HINT[art.id].does : ART_HINT[art.id].find, w - textX - 7).slice(0, 3)
  const artH = Math.max(20, tip.length * 10)
  const panelH = 16 + MOVES.length * row + 6 + 12 + artH + 6
  // The tabs where the other pages have them; what is under them in the middle of the screen.
  const under = drawMenuTabs(g, 'moves', vw, menuTabsY(vh, top), keys, skin)
  let y = Math.max(under, Math.round((vh - panelH - 14) / 2) + 14)
  // The combos.
  F.draw(g, 'COMBOS', x + 7, y + 6, skin.prize)
  const legend = keys.touch ? 'A SWORD  R ROLL' : `A ${keys.a}  R ${keys.roll ?? 'L'}`
  F.draw(g, legend, x + w - 7 - F.width(legend), y + 6, skin.faint)
  let ry = y + 18
  const nameW = Math.max(...MOVES.map(m => F.width(m.name)))
  const keysX = x + 7 + nameW + 6
  const barW = Math.max(16, Math.min(34, w - (keysX - x) - F.width('R > BLOW') - 18))
  const barX = x + w - 7 - barW
  // On a narrow screen the word MASTER would run into the widest buttons: a full gold bar says it instead.
  const word = barX + barW - F.width('MASTER') >= keysX + Math.max(...MOVES.map(m => keysWidth(F, m.keys))) + 3
  for (const m of MOVES) {
    const n = moveCount(s, m.id)
    const done = mastered(s, m.id)
    F.draw(g, m.name, x + 7, ry, done ? skin.prize : n > 0 ? skin.text : skin.dim)
    drawKeys(g, F, m.keys, keysX, ry, skin)
    if (done && word) F.draw(g, 'MASTER', barX + barW - F.width('MASTER'), ry, skin.prize)
    else if (done) { g.fillStyle = skin.prize; g.fillRect(barX, ry + 2, barW, 3) }
    else {
      g.fillStyle = skin.off
      g.fillRect(barX, ry + 2, barW, 3)
      g.fillStyle = n > 0 ? skin.cool : skin.off
      g.fillRect(barX, ry + 2, Math.round((barW * Math.min(n, m.need)) / m.need), 3)
    }
    ry += row
  }
  // The art on B: its icon in a slot (dim while it rests, underlined when in hand), its name and what it does.
  ry += 4
  const use = keys.touch ? 'ON THE ITEM BUTTON' : `ON ${keys.b}, ${keys.cycle} SWAPS`
  F.draw(g, known ? art.name : 'THE ART', x + 7, ry, skin.prize)
  F.draw(g, use, x + w - 7 - F.width(use), ry, skin.faint)
  ry += 11
  g.fillStyle = skin.slot
  g.fillRect(x + 7, ry, 20, 20)
  if (known) {
    const name = `item_${art.id}`
    if (artRest(s, art.id) < 1) g.globalAlpha = 0.4
    icon(g, skin, name, Math.round(x + 17 - sprite(name).width / 2), ry + 2)
    g.globalAlpha = 1
    if (s.inv.selected === art.id) { g.fillStyle = skin.prize; g.fillRect(x + 7, ry + 19, 20, 1) }
  } else F.draw(g, '?', Math.round(x + 17 - F.width('?') / 2), ry + 7, skin.faint)
  tip.forEach((line, i) => F.draw(g, line, x + textX, ry + (tip.length === 1 ? 7 : 2 + i * 10), known ? skin.dim : skin.faint))
  void artH
}

/** A combo's name called out where it lands: what it is, and once its first or its mastery. */
export interface Callout { id: MoveId; t: number; first: boolean; mastered: boolean }
export const CALLOUT_TIME = 1.1

/** `at`: the row the call-out stands on (over the hero's head); none: a third of the way down. */
export function drawCallout(g: G, c: Callout, vw: number, vh: number, skin: HudSkin = NEON_SKIN, at?: number) {
  const m = MOVES.find(x => x.id === c.id)
  if (!m) return
  const a = Math.min(1, c.t * 10, (CALLOUT_TIME - c.t) * 5)
  if (a <= 0) return
  const F = hudFont(skin)
  const rise = Math.round(Math.max(0, 1 - c.t * 8) * 4)
  const y = Math.round(Math.max(36, Math.min(vh - 48, at ?? vh * 0.3))) + rise
  g.globalAlpha = a
  const sub = c.mastered ? 'MASTERED!' : c.first ? 'NEW MOVE' : ''
  if (sub) F.draw(g, sub, Math.round((vw - F.width(sub)) / 2), y - 11, c.mastered ? skin.prize : skin.hot, skin.outline)
  F.draw(g, m.name, Math.round((vw - F.width(m.name)) / 2), y, c.mastered ? skin.prize : skin.text, skin.outline)
  if (c.mastered) F.draw(g, m.perk, Math.round((vw - F.width(m.perk)) / 2), y + 11, skin.dim, skin.outline)
  g.globalAlpha = 1
}

/** SLIP: the world running slow, a cool tint and a frame round the edge, coming and going. */
export function drawSlow(g: G, slow: number, vw: number, vh: number, skin: HudSkin = NEON_SKIN) {
  const a = Math.min(1, slow * 5)
  if (a <= 0) return
  g.globalAlpha = 0.09 * a
  g.fillStyle = skin.cool
  g.fillRect(0, 0, vw, vh)
  g.globalAlpha = 0.55 * a
  g.fillRect(0, 0, vw, 2)
  g.fillRect(0, vh - 2, vw, 2)
  g.fillRect(0, 0, 2, vh)
  g.fillRect(vw - 2, 0, 2, vh)
  g.globalAlpha = 1
}
