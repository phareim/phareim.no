/**
 * The heads-up display, drawn in logical pixels on the UI layer: hearts,
 * the B-item box, bits/bombs/keys, the area banner, the dialog box and the
 * pause screen with the quest hint.
 */
import type { GameState } from '../types'
import { objective } from '../progress'
import { subst, type HudKeys } from '../keys'
import { drawText, textWidth, wrapText, GLYPH_H } from '../../base/pixel/font'
import { sprite } from './sheet'
import { hasBigKey, keyCount } from '../engine/map'
import { asksChoice } from '../engine/game'

type G = CanvasRenderingContext2D

/**
 * How the HUD is dressed. Each view may bring its own: the classic neon
 * boxes, the 16-bit gradient windows of the isometric view, notes on paper
 * for the pencil view. The layout is the same in all of them.
 */
export interface HudSkin {
  /** A panel: the dialog box, the pause screen's box, the item box, a label's plate. `tone`: the edge is the hot colour or the cool one. */
  panel(g: G, x: number, y: number, w: number, h: number, tone?: 'hot' | 'cool'): void
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

/**
 * Notes on paper for the pencil view: a sheet lying on the sheet, its edge a
 * pencil line that never quite keeps to the ruler. `sheet`, `line`, `ink` and
 * the rest are Blyant's tokens for the paper in use (Papir or Kull).
 */
export function paperSkin(c: { sheet: string; sheet2: string; line: string; ink: string; soft: string; faint: string; red: string; blue: string; yellow: string; green: string; veil: string }): HudSkin {
  const panel = (g: G, x: number, y: number, w: number, h: number) => {
    g.fillStyle = c.sheet2
    g.fillRect(x, y, w, h)
    g.fillStyle = c.line
    // Each side drawn in a few strokes that sit a pixel off each other, like a line gone over by hand.
    const seg = (x0: number, y0: number, len: number, horiz: boolean, salt: number) => {
      let at = 0
      let i = 0
      while (at < len) {
        const n = Math.min(len - at, 9 + ((salt * 7 + i * 13) % 11))
        const off = ((salt + i * 5) % 3 === 0 ? 1 : 0)
        if (horiz) g.fillRect(x0 + at, y0 + off, n, 1)
        else g.fillRect(x0 + off, y0 + at, 1, n)
        at += n
        i++
      }
    }
    seg(x, y - 1, w, true, x + y)
    seg(x, y + h - 1, w, true, x + y + 3)
    seg(x - 1, y, h, false, x + y + 5)
    seg(x + w - 1, y, h, false, x + y + 8)
  }
  return {
    panel,
    text: c.ink, dim: c.soft, faint: c.faint,
    hot: c.red, cool: c.blue, prize: c.yellow, ok: c.green,
    outline: c.sheet, veil: c.veil, slot: c.faint + '55', off: c.faint,
  }
}

export function drawHud(g: G, s: GameState, vw: number, time: number, touch: boolean, skin: HudSkin = NEON_SKIN) {
  const h = s.hero
  const inv = s.inv
  // Hearts (top-left), up to 10 per row.
  const hearts = Math.ceil(h.maxHp / 2)
  const low = h.hp <= 2
  for (let i = 0; i < hearts; i++) {
    const hp = h.hp - i * 2
    const name = hp >= 2 ? 'hud_heart_full' : hp === 1 ? 'hud_heart_half' : 'hud_heart_empty'
    const x = 4 + (i % 10) * 9
    const y = 4 + Math.floor(i / 10) * 9 - (low && hp > 0 && Math.floor(time * 4) % 2 === 0 ? 1 : 0)
    g.drawImage(sprite(name), x, y)
  }
  // Counters row under the hearts.
  let cx = 4
  const cy = 4 + Math.ceil(hearts / 10) * 9 + 2
  const counter = (icon: string, n: number, digits: number, color = skin.text) => {
    g.drawImage(sprite(icon), cx, cy)
    const t = String(n).padStart(digits, '0')
    drawText(g, t, cx + 10, cy + 1, color, skin.outline)
    cx += 10 + textWidth(t) + 6
  }
  counter('hud_bit', inv.bits, 3, skin.ok)
  if (inv.bombBag) counter('hud_bomb', inv.bombs, 2)
  const keys = keyCount(s)
  if (keys > 0 || s.map.ring !== 'shrine' || s.map.id === 'shrine') counter('hud_key', keys, 1, skin.prize)
  if (hasBigKey(s)) { g.drawImage(sprite('hud_bigkey'), cx, cy); cx += 12 }

  // B-item box right of the hearts (touch shows it on the B button instead;
  // its VIEW and pause chips own the top-right corner).
  if (!touch && inv.selected) {
    const bx = Math.max(4 + Math.min(hearts, 10) * 9, cx) + 4
    skin.panel(g, bx, 3, 22, 22, 'cool')
    const icon = inv.selected === 'disc' ? 'item_disc' : inv.selected === 'hook' ? 'item_hook' : 'item_bombbag'
    const spr = sprite(icon)
    g.drawImage(spr, bx + 11 - spr.width / 2, 6)
    drawText(g, 'K', bx + 24, 4, skin.cool, skin.outline)
  }
  void vw
}

export function drawBanner(g: G, text: string, t: number, vw: number, vh: number, skin: HudSkin = NEON_SKIN) {
  const a = Math.min(1, t * 3, (2.2 - t) * 2)
  if (a <= 0) return
  g.globalAlpha = a
  const w = textWidth(text)
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
    drawText(g, text, x, y, skin.text, skin.shadow)
  }
  g.globalAlpha = 1
}

/** Dialog box: typed text, wrapped, bottom or top depending on the hero. */
export function drawDialog(g: G, s: GameState, vw: number, vh: number, heroScreenY: number, keys: HudKeys, time: number, skin: HudSkin = NEON_SKIN) {
  const d = s.dialog
  if (!d) return
  const line = subst(d.lines[d.line] ?? '', keys)
  const w = Math.min(vw - 12, 280)
  const inner = w - 16
  const wrapped = wrapText(line, inner)
  // An exit's last line asks YES / NO on a row of its own, YES in the left half and NO in the right (touch taps a half).
  const asks = asksChoice(d)
  const textH = wrapped.length * (GLYPH_H + 4)
  const h = textH + 14 + (asks ? GLYPH_H + 8 : 0)
  const x = Math.round((vw - w) / 2)
  const y = heroScreenY > vh * 0.58 ? 8 : vh - h - 8
  skin.panel(g, x, y, w, h, 'hot')
  let left = Math.floor(d.chars)
  for (let i = 0; i < wrapped.length; i++) {
    const text = wrapped[i]!
    const shown = text.slice(0, Math.max(0, left))
    left -= text.length + 1
    drawText(g, shown, x + 8, y + 8 + i * (GLYPH_H + 4), skin.text, skin.shadow)
  }
  if (asks) {
    if (d.chars < line.length) return
    const oy = y + 8 + textH + 4
    ;(d.ask?.options ?? ['YES', 'NO']).forEach((label, i) => {
      const on = (d.choice ?? 0) === i
      const cx = x + Math.round(w * (i === 0 ? 0.3 : 0.7))
      const tx = Math.round(cx - textWidth(label) / 2)
      drawText(g, label, tx, oy, on ? skin.cool : skin.dim, on && skin.shadow ? skin.outline : undefined)
      if (on) drawText(g, '>', tx - 8, oy, skin.cool)
    })
    return
  }
  if (d.chars >= line.length && Math.floor(time * 3) % 2 === 0) {
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
  const lines = wrapText('YOUR QUEST, ITEMS AND HEARTS WILL BE GONE, HERE AND ON YOUR PILOT. YOUR BEST TIME STAYS.', w - 16)
  const h = 20 + lines.length * 10
  let y = Math.max(8, Math.round(vh / 2 - h / 2 - 14))
  const title = 'START OVER?'
  drawText(g, title, Math.round((vw - textWidth(title)) / 2), y, skin.hot, skin.outline)
  y += 14
  skin.panel(g, x, y, w, h, 'hot')
  lines.forEach((l, i) => drawText(g, l, x + 8, y + 10 + i * 10, skin.text))
  const hint = keys.touch ? 'YES OR NO BELOW' : 'Y YES   N NO'
  drawText(g, hint, Math.round((vw - textWidth(hint)) / 2), y + h + 8, skin.dim)
}

export function drawPause(g: G, s: GameState, vw: number, vh: number, keys: HudKeys, confirmReset = false, muted = false, view = '', skin: HudSkin = NEON_SKIN) {
  g.fillStyle = skin.veil
  g.fillRect(0, 0, vw, vh)
  if (confirmReset) { drawConfirmReset(g, vw, vh, keys, skin); return }
  const w = Math.min(vw - 16, 240)
  const x = Math.round((vw - w) / 2)
  let y = Math.max(8, Math.round(vh / 2 - 70))
  drawText(g, 'PAUSED', Math.round((vw - textWidth('PAUSED')) / 2), y, skin.hot, skin.outline)
  y += 14
  skin.panel(g, x, y, w, 118, 'cool')
  // Items
  const items: Array<[string, boolean, string]> = [
    [s.inv.arc ? 'item_arc' : 'item_sword', s.inv.sword, s.inv.arc ? 'ARC' : 'BLADE'],
    ['item_bombbag', s.inv.bombBag, 'BOMBS'],
    ['item_hook', s.inv.hook, 'HOOK'],
    ['item_disc', s.inv.disc, 'DISC'],
    ['item_bigkey', hasBigKey(s), 'BIG KEY'],
  ]
  const slot = Math.floor((w - 16) / 5)
  items.forEach(([icon, owned, label], i) => {
    const ix = x + 8 + i * slot
    const iy = y + 8
    g.fillStyle = skin.slot
    g.fillRect(ix, iy, slot - 4, 30)
    if (owned) {
      const spr = sprite(icon)
      g.drawImage(spr, Math.round(ix + (slot - 4) / 2 - spr.width / 2), iy + 2)
      const selected = (icon === 'item_disc' && s.inv.selected === 'disc') || (icon === 'item_bombbag' && s.inv.selected === 'bombs') || (icon === 'item_hook' && s.inv.selected === 'hook')
      if (selected) { g.fillStyle = skin.prize; g.fillRect(ix, iy + 29, slot - 4, 1) }
    }
    drawText(g, owned ? label : '---', Math.round(ix + (slot - 4) / 2 - textWidth(owned ? label : '---') / 2), iy + 21, owned ? skin.dim : skin.faint)
  })
  // Heart pieces
  const py = y + 46
  drawText(g, 'HEART PIECES', x + 8, py, skin.dim)
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i < s.inv.pieces ? skin.hot : skin.off
    g.fillRect(x + 8 + textWidth('HEART PIECES') + 6 + (i % 2) * 5, py - 1 + Math.floor(i / 2) * 5, 4, 4)
  }
  // Things carried for someone: small icons at the right of that row.
  const errands: string[] = []
  const f = (k: string) => s.flags[k] === true
  if (f('item:waffle') && !f('luna')) errands.push('item_waffle')
  if (s.inv.shrooms > 0 && !f('got:mossa:heartPiece')) errands.push('item_shroom')
  if (f('item:tube') && !f('got:dusty:heartPiece')) errands.push('item_tube')
  if (f('item:walkie') && !f('got:toby:bits50')) errands.push('item_walkie')
  if (f('item:hat') && !f('got:troll:bigBag')) errands.push('item_hat')
  errands.forEach((icon, i) => {
    const spr = sprite(icon)
    g.drawImage(spr, x + w - 8 - (errands.length - i) * 14, py - 5, 12, 12)
  })
  // Objective
  const lines = wrapText(objective(s), w - 16)
  drawText(g, 'QUEST', x + 8, y + 62, skin.prize)
  lines.slice(0, 4).forEach((l, i) => drawText(g, l, x + 8, y + 74 + i * 10, skin.text))
  const hint = keys.touch ? 'TAP RESUME' : 'P RESUME   T TOWN'
  drawText(g, hint, Math.round((vw - textWidth(hint)) / 2), y + 126, skin.dim)
  const sound = `${keys.touch ? 'SOUND' : 'M SOUND'} ${muted ? 'OFF' : 'ON'}`
  // Sound and the view share the line: both are things to switch from here.
  const look = view ? `${keys.touch ? 'VIEW' : 'V VIEW'} ${view}` : ''
  const gap = look ? 12 : 0
  const sx = Math.round((vw - textWidth(sound) - gap - textWidth(look)) / 2)
  drawText(g, sound, sx, y + 138, muted ? skin.hot : skin.cool)
  if (look) drawText(g, look, sx + textWidth(sound) + gap, y + 138, skin.prize)
}

/** How long the view strip stays up after a change (seconds). */
export const STRIP_TIME = 2.6

/**
 * The view strip: every way the world can be shown, side by side, the one in
 * use lit. It comes up when the view changes and goes again, so a visitor who
 * presses V once sees that there is a round to go.
 */
export function drawViewStrip(g: G, strip: { views: ReadonlyArray<{ name: string; tag: string }>; at: number; t: number }, vw: number, vh: number, touch: boolean, skin: HudSkin = NEON_SKIN) {
  const n = strip.views.length
  if (!n || strip.t >= STRIP_TIME) return
  const cardW = (v: { name: string; tag: string }) => Math.max(textWidth(v.name), textWidth(v.tag)) + 12
  const gap = 3
  // Every view in a row when they fit; else the one in use between its neighbours.
  let shown = strip.views.map((v, i) => ({ v, i }))
  const rowW = (list: typeof shown) => list.reduce((a, c) => a + cardW(c.v), 0) + gap * (list.length - 1)
  if (rowW(shown) > vw - 8 && n > 3) shown = [-1, 0, 1].map(d => { const i = (strip.at + d + n) % n; return { v: strip.views[i]!, i } })
  while (shown.length > 1 && rowW(shown) > vw - 8) shown = shown.filter(c => c.i === strip.at)
  const w = rowW(shown)
  const h = GLYPH_H * 2 + 11
  let x = Math.round((vw - w) / 2)
  const hint = touch ? 'VIEW' : 'V  NEXT VIEW'
  // Under the HUD's rows, in the top third: the bottom of the screen is the dialog box's and the page's own hint.
  const y = Math.max(40, Math.round(vh * 0.14))
  for (const { v, i } of shown) {
    const cw = cardW(v)
    const on = i === strip.at
    skin.panel(g, x, y, cw, h, on ? 'hot' : 'cool')
    if (!on) { g.fillStyle = skin.veil; g.fillRect(x + 1, y + 1, cw - 2, h - 2) }
    drawText(g, v.name, x + Math.round((cw - textWidth(v.name)) / 2), y + 4, on ? skin.text : skin.dim, on ? skin.shadow : undefined)
    drawText(g, v.tag, x + Math.round((cw - textWidth(v.tag)) / 2), y + 6 + GLYPH_H, on ? skin.prize : skin.faint)
    x += cw + gap
  }
  const count = `${hint}   ${strip.at + 1}/${n}`
  drawText(g, count, Math.round((vw - textWidth(count)) / 2), y + h + 4, skin.dim, skin.outline)
}
