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
import { FRONTIER, realmAt } from '../world/gen/frontier'

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

/**
 * The polygon view's windows (a 1996 console's): dark glass the world shows through, a soft gradient down it, a
 * thin bright edge with a hotter top, and a hard drop shadow one pixel down and right.
 */
export function glassPanel(g: G, x: number, y: number, w: number, h: number, tone: 'hot' | 'cool' = 'hot', thin = 1) {
  g.fillStyle = 'rgba(0,0,0,0.55)'
  g.fillRect(x + 2, y + h, w - 1, 2)
  g.fillRect(x + w, y + 2, 2, h - 1)
  const grad = g.createLinearGradient(0, y, 0, y + h)
  if (tone === 'hot') { grad.addColorStop(0, 'rgba(46,22,88,0.84)'); grad.addColorStop(1, 'rgba(14,8,34,0.9)') }
  else { grad.addColorStop(0, 'rgba(14,52,82,0.84)'); grad.addColorStop(1, 'rgba(6,16,34,0.9)') }
  g.fillStyle = grad
  g.fillRect(x, y, w, h)
  // A sheen across the upper third, as glass catches the light.
  g.fillStyle = 'rgba(255,255,255,0.06)'
  g.fillRect(x + 1, y + 1, w - 2, Math.max(1, Math.round(h / 3)))
  const edge = tone === 'hot' ? '#ff6fd0' : '#6ff6ff'
  g.fillStyle = edge
  g.fillRect(x, y, w, thin)
  g.globalAlpha *= 0.55
  g.fillRect(x, y + h - thin, w, thin); g.fillRect(x, y + thin, thin, h - 2 * thin); g.fillRect(x + w - thin, y + thin, thin, h - 2 * thin)
  g.globalAlpha /= 0.55
}

export const GLASS_SKIN: HudSkin = {
  panel: glassPanel,
  text: '#f4f0ff', shadow: '#05020e', dim: '#c4b6ee', faint: '#7a6aa8',
  hot: '#ff8ae0', cool: '#7ff4ff', prize: '#ffd23f', ok: '#b6ff4a',
  outline: '#05020e', veil: 'rgba(6,3,18,0.66)', slot: 'rgba(200,170,255,0.14)', off: '#3a2a60',
}

/**
 * The 64-bit look's windows: round and soft. A rounded window of deep violet with a soft gradient and a soft
 * drop shadow under it, a thin light edge; a small square panel (an item slot) is a round frame instead.
 */
export function roundPanel(g: G, x: number, y: number, w: number, h: number, tone: 'hot' | 'cool' = 'hot', thin = 1) {
  const slot = w <= 30 && h <= 30 && Math.abs(w - h) <= 6
  const path = () => {
    g.beginPath()
    if (slot) g.arc(x + w / 2, y + h / 2, Math.max(w, h) / 2 + 1, 0, Math.PI * 2)
    else {
      const r = Math.min(6, h / 2, w / 2)
      g.moveTo(x + r, y)
      g.arcTo(x + w, y, x + w, y + h, r)
      g.arcTo(x + w, y + h, x, y + h, r)
      g.arcTo(x, y + h, x, y, r)
      g.arcTo(x, y, x + w, y, r)
      g.closePath()
    }
  }
  g.save()
  g.shadowColor = 'rgba(0,0,0,0.6)'
  g.shadowBlur = 4
  g.shadowOffsetY = 2
  const grad = g.createLinearGradient(0, y, 0, y + h)
  if (tone === 'hot') { grad.addColorStop(0, 'rgba(70,30,110,0.92)'); grad.addColorStop(1, 'rgba(28,10,52,0.94)') }
  else { grad.addColorStop(0, 'rgba(20,70,110,0.92)'); grad.addColorStop(1, 'rgba(8,24,52,0.94)') }
  g.fillStyle = grad
  path()
  g.fill()
  g.restore()
  g.save()
  g.lineWidth = (slot ? 1.5 : 1) * thin
  g.strokeStyle = tone === 'hot' ? 'rgba(255,150,220,0.85)' : 'rgba(140,240,255,0.85)'
  path()
  g.stroke()
  g.restore()
}

export const ROUND_SKIN: HudSkin = {
  panel: roundPanel,
  text: '#fff6ff', shadow: 'rgba(10,4,24,0.85)', dim: '#d2c4f4', faint: '#8a7ab8',
  hot: '#ff9ae4', cool: '#8ff4ff', prize: '#ffe066', ok: '#c4ff70',
  outline: '#140828', veil: 'rgba(12,6,30,0.6)', slot: 'rgba(210,180,255,0.16)', off: '#4a3a70',
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
/** The smallest logical area the layout is drawn for: the pause screen's five slots across, and from its title to its last line (the classic view never shows less than 176 rows either). */
const HUD_MIN_W = 176
const HUD_MIN_H = 176

/** A sprite at (x, y), as the skin shows it. */
function icon(g: G, skin: HudSkin, name: string, x: number, y: number) {
  const spr = sprite(name)
  if (skin.icon) g.drawImage(skin.icon(name), x, y, spr.width, spr.height)
  else g.drawImage(spr, x, y)
}

export function drawHud(g: G, s: GameState, vw: number, time: number, touch: boolean, skin: HudSkin = NEON_SKIN) {
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
  // its pause chip owns the top-right corner).
  if (!touch && inv.selected) {
    const bx = Math.max(4 + Math.min(hearts, 10) * step, cx) + 4
    skin.panel(g, bx, 3, 22, 22, 'cool')
    const item = inv.selected === 'disc' ? 'item_disc' : inv.selected === 'hook' ? 'item_hook' : 'item_bombbag'
    icon(g, skin, item, bx + 11 - sprite(item).width / 2, 6)
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

export function drawPause(g: G, s: GameState, vw: number, vh: number, keys: HudKeys, confirmReset = false, muted = false, view = '', skin: HudSkin = NEON_SKIN) {
  g.fillStyle = skin.veil
  g.fillRect(0, 0, vw, vh)
  if (confirmReset) { drawConfirmReset(g, vw, vh, keys, skin); return }
  const F = hudFont(skin)
  const w = Math.min(vw - 16, 240)
  const x = Math.round((vw - w) / 2)
  let y = Math.max(8, Math.round(vh / 2 - 70))
  F.draw(g, 'PAUSED', Math.round((vw - F.width('PAUSED')) / 2), y, skin.hot, skin.outline)
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
  items.forEach(([name, owned, label], i) => {
    const ix = x + 8 + i * slot
    const iy = y + 8
    g.fillStyle = skin.slot
    g.fillRect(ix, iy, slot - 4, 30)
    if (owned) {
      icon(g, skin, name, Math.round(ix + (slot - 4) / 2 - sprite(name).width / 2), iy + 2)
      const selected = (name === 'item_disc' && s.inv.selected === 'disc') || (name === 'item_bombbag' && s.inv.selected === 'bombs') || (name === 'item_hook' && s.inv.selected === 'hook')
      if (selected) { g.fillStyle = skin.prize; g.fillRect(ix, iy + 29, slot - 4, 1) }
    }
    F.draw(g, owned ? label : '---', Math.round(ix + (slot - 4) / 2 - F.width(owned ? label : '---') / 2), iy + 21, owned ? skin.dim : skin.faint)
  })
  // Heart pieces
  const py = y + 46
  F.draw(g, 'HEART PIECES', x + 8, py, skin.dim)
  const hx = x + 8 + Math.ceil(F.width('HEART PIECES')) + 6
  if (skin.pieces) skin.pieces(g, hx, py - 1, s.inv.pieces)
  for (let i = 0; i < 4 && !skin.pieces; i++) {
    g.fillStyle = i < s.inv.pieces ? skin.hot : skin.off
    g.fillRect(hx + (i % 2) * 5, py - 1 + Math.floor(i / 2) * 5, 4, 4)
  }
  // Things carried for someone: small icons at the right of that row.
  const errands: string[] = []
  const f = (k: string) => s.flags[k] === true
  if (f('item:waffle') && !f('luna')) errands.push('item_waffle')
  if (s.inv.shrooms > 0 && !f('got:mossa:heartPiece')) errands.push('item_shroom')
  if (f('item:tube') && !f('got:dusty:heartPiece')) errands.push('item_tube')
  if (f('item:walkie') && !f('got:toby:bits50')) errands.push('item_walkie')
  if (f('item:hat') && !f('got:troll:bigBag')) errands.push('item_hat')
  // A skin with finer pixels shows each at its full sixteen, as it shows the items; the classic box shrinks them to twelve.
  const fine = (skin.density ?? 1) > 1
  errands.forEach((name, i) => {
    const ex = x + w - 8 - (errands.length - i) * (fine ? 17 : 14)
    if (fine) icon(g, skin, name, ex, py - 5)
    else g.drawImage(sprite(name), ex, py - 5, 12, 12)
  })
  // Objective (in the frontier the map of its regions stands at the right of it)
  const map = frontierMapSize(s)
  const lines = F.wrap(objective(s), w - 16 - (map ? map.w + 8 : 0))
  F.draw(g, 'QUEST', x + 8, y + 62, skin.prize)
  lines.slice(0, 4).forEach((l, i) => F.draw(g, l, x + 8, y + 74 + i * 10, skin.text))
  if (map) drawFrontierMap(g, s, x + w - 8 - map.w, y + 62, map.cell, skin)
  const hint = keys.touch ? 'TAP RESUME' : 'P RESUME   T TOWN'
  F.draw(g, hint, Math.round((vw - F.width(hint)) / 2), y + 126, skin.dim)
  const sound = `${keys.touch ? 'SOUND' : 'M SOUND'} ${muted ? 'OFF' : 'ON'}`
  // Sound and the view share the line: both are things to switch from here.
  const look = view ? `${keys.touch ? 'VIEW' : 'V VIEW'} ${view}` : ''
  const gap = look ? 12 : 0
  const sx = Math.round((vw - F.width(sound) - gap - F.width(look)) / 2)
  F.draw(g, sound, sx, y + 138, muted ? skin.hot : skin.cool)
  if (look) F.draw(g, look, sx + F.width(sound) + gap, y + 138, skin.prize)
}

/** The region the hero is in, when it is one of the frontier's (a cave counts as its region). */
function frontierAt(s: GameState): { rx: number; ry: number } | null {
  const m = /^fr:(\d+),(\d+)/.exec(s.map.id)
  return m ? { rx: Number(m[1]), ry: Number(m[2]) } : null
}

/** The pause screen's map of the frontier: its size, or null away from it. Cells shrink to keep it within 72 × 50. */
function frontierMapSize(s: GameState): { w: number; h: number; cell: number } | null {
  if (!frontierAt(s)) return null
  const cols = Math.max(...FRONTIER.layout.map(r => r.length))
  const rows = FRONTIER.layout.length
  const cell = Math.max(3, Math.min(6, Math.floor(72 / cols), Math.floor(50 / rows)))
  return { w: cols * cell, h: rows * cell, cell }
}

/**
 * The frontier's regions as a grid of small squares: the ones walked into lit (`seen:<id>`), the Landing in the
 * prize colour, the hero's own in the hot one. No names, no legend: where you have been and where you are.
 */
function drawFrontierMap(g: G, s: GameState, x: number, y: number, cell: number, skin: HudSkin) {
  const here = frontierAt(s)!
  FRONTIER.layout.forEach((row, ry) => {
    for (let rx = 0; rx < row.length; rx++) {
      if (!realmAt(rx, ry)) continue
      const id = `fr:${rx},${ry}`
      const isHere = here.rx === rx && here.ry === ry
      const landing = FRONTIER.landing.rx === rx && FRONTIER.landing.ry === ry
      g.fillStyle = isHere ? skin.hot : landing ? skin.prize : s.flags[`seen:${id}`] ? skin.cool : skin.slot
      g.fillRect(x + rx * cell, y + ry * cell, cell - 1, cell - 1)
    }
  })
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
