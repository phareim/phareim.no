/**
 * The heads-up display, drawn in logical pixels on the UI layer: hearts,
 * the B-item box, bits/bombs/keys, the area banner, the dialog box and the
 * pause screen with the quest hint.
 */
import type { GameState } from '../types'
import { has } from '../engine/index'
import { drawText, textWidth, wrapText, GLYPH_H } from './font'
import { sprite } from './sheet'

type G = CanvasRenderingContext2D

export interface HudKeys { a: string; b: string; cycle: string }

export function subst(text: string, k: HudKeys): string {
  return text.replace(/\{A\}/g, k.a).replace(/\{B\}/g, k.b).replace(/\{CYCLE\}/g, k.cycle)
}

function box(g: G, x: number, y: number, w: number, h: number, edge = '#ff2fa0', fill = 'rgba(11,6,22,0.86)') {
  g.fillStyle = fill
  g.fillRect(x, y, w, h)
  g.fillStyle = edge
  g.fillRect(x + 1, y, w - 2, 1)
  g.fillRect(x + 1, y + h - 1, w - 2, 1)
  g.fillRect(x, y + 1, 1, h - 2)
  g.fillRect(x + w - 1, y + 1, 1, h - 2)
  g.fillStyle = 'rgba(47,243,255,0.35)'
  g.fillRect(x + 2, y + 2, w - 4, 1)
}

export function drawHud(g: G, s: GameState, vw: number, time: number, touch: boolean) {
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
  const counter = (icon: string, n: number, digits: number, color = '#fff4ff') => {
    g.drawImage(sprite(icon), cx, cy)
    const t = String(n).padStart(digits, '0')
    drawText(g, t, cx + 10, cy + 1, color, '#0b0616')
    cx += 10 + textWidth(t) + 6
  }
  counter('hud_bit', inv.bits, 3, '#b6ff4a')
  if (inv.bombBag) counter('hud_bomb', inv.bombs, 2)
  if (inv.keys > 0 || s.map.id === 'shrine') counter('hud_key', inv.keys, 1, '#ffd23f')
  if (inv.bigKey) { g.drawImage(sprite('hud_bigkey'), cx, cy); cx += 12 }

  // B-item box right of the hearts (touch shows it on the B button instead;
  // the site radio owns the top-right corner).
  if (!touch && inv.selected) {
    const bx = Math.max(4 + Math.min(hearts, 10) * 9, cx) + 4
    box(g, bx, 3, 22, 22, '#2ff3ff')
    const icon = inv.selected === 'disc' ? 'item_disc' : 'item_bombbag'
    const spr = sprite(icon)
    g.drawImage(spr, bx + 11 - spr.width / 2, 6)
    drawText(g, 'K', bx + 24, 4, '#2ff3ff', '#0b0616')
  }
  void vw
}

export function drawBanner(g: G, text: string, t: number, vw: number, vh: number) {
  const a = Math.min(1, t * 3, (2.2 - t) * 2)
  if (a <= 0) return
  g.globalAlpha = a
  const w = textWidth(text)
  const x = Math.round((vw - w) / 2)
  const y = Math.round(vh * 0.22)
  g.fillStyle = 'rgba(11,6,22,0.6)'
  g.fillRect(x - 8, y - 5, w + 16, GLYPH_H + 10)
  drawText(g, text, x, y, '#fff4ff', '#ff2fa0')
  g.fillStyle = '#ff2fa0'
  g.fillRect(x - 8, y + GLYPH_H + 4, w + 16, 1)
  g.fillStyle = '#2ff3ff'
  g.fillRect(x - 8, y - 5, w + 16, 1)
  g.globalAlpha = 1
}

/** Dialog box: typed text, wrapped, bottom or top depending on the hero. */
export function drawDialog(g: G, s: GameState, vw: number, vh: number, heroScreenY: number, keys: HudKeys, time: number) {
  const d = s.dialog
  if (!d) return
  const line = subst(d.lines[d.line] ?? '', keys)
  const w = Math.min(vw - 12, 280)
  const inner = w - 16
  const wrapped = wrapText(line, inner)
  const h = wrapped.length * (GLYPH_H + 4) + 14
  const x = Math.round((vw - w) / 2)
  const y = heroScreenY > vh * 0.58 ? 8 : vh - h - 8
  box(g, x, y, w, h)
  let left = Math.floor(d.chars)
  for (let i = 0; i < wrapped.length; i++) {
    const text = wrapped[i]!
    const shown = text.slice(0, Math.max(0, left))
    left -= text.length + 1
    drawText(g, shown, x + 8, y + 8 + i * (GLYPH_H + 4), '#fff4ff', '#3a1a4a')
  }
  if (d.chars >= line.length && Math.floor(time * 3) % 2 === 0) {
    g.fillStyle = '#2ff3ff'
    g.fillRect(x + w - 11, y + h - 7, 5, 1)
    g.fillRect(x + w - 10, y + h - 6, 3, 1)
    g.fillRect(x + w - 9, y + h - 5, 1, 1)
  }
}

export function objective(s: GameState): string {
  if (!s.inv.sword) return "OPEN THE CHEST BY THE KEEPER'S HUT."
  if (!s.inv.bombBag) return 'SEARCH WHISPER WOODS, NORTH OF HOME, FOR SOMETHING THAT GOES BOOM.'
  if (!Object.keys(s.flags).some(f => f.startsWith('bomb:overworld:')) && s.map.id !== 'shrine') return 'BLAST THE RUBBLE AT THE NORTH END OF THE HOLLOW GRAVES.'
  if (!s.inv.disc) return "FIND THE SHRINE'S TREASURE. KEYS OPEN THE WAY WEST OF THE GREAT HALL."
  if (!s.inv.bigKey) return 'A KNIGHT GUARDS THE BIG KEY, NORTH OF THE CRYSTAL ROOM.'
  if (!has(s, 'boss')) return 'OPEN THE GREAT DOOR AND FACE THE STATIC KING.'
  return 'CLAIM THE SUN PRISM.'
}

export function drawPause(g: G, s: GameState, vw: number, vh: number, keys: HudKeys) {
  g.fillStyle = 'rgba(11,6,22,0.78)'
  g.fillRect(0, 0, vw, vh)
  const w = Math.min(vw - 16, 240)
  const x = Math.round((vw - w) / 2)
  let y = Math.max(8, Math.round(vh / 2 - 70))
  drawText(g, 'PAUSED', Math.round((vw - textWidth('PAUSED')) / 2), y, '#ff2fa0', '#0b0616')
  y += 14
  box(g, x, y, w, 118, '#2ff3ff')
  // Items
  const items: Array<[string, boolean, string]> = [
    ['item_sword', s.inv.sword, 'BLADE'],
    ['item_bombbag', s.inv.bombBag, 'BOMBS'],
    ['item_disc', s.inv.disc, 'DISC'],
    ['item_bigkey', s.inv.bigKey, 'BIG KEY'],
  ]
  const slot = Math.floor((w - 16) / 4)
  items.forEach(([icon, owned, label], i) => {
    const ix = x + 8 + i * slot
    const iy = y + 8
    g.fillStyle = 'rgba(47,243,255,0.08)'
    g.fillRect(ix, iy, slot - 4, 30)
    if (owned) {
      const spr = sprite(icon)
      g.drawImage(spr, Math.round(ix + (slot - 4) / 2 - spr.width / 2), iy + 2)
      const selected = (icon === 'item_disc' && s.inv.selected === 'disc') || (icon === 'item_bombbag' && s.inv.selected === 'bombs')
      if (selected) { g.fillStyle = '#ffd23f'; g.fillRect(ix, iy + 29, slot - 4, 1) }
    }
    drawText(g, owned ? label : '---', Math.round(ix + (slot - 4) / 2 - textWidth(owned ? label : '---') / 2), iy + 21, owned ? '#b9a8d9' : '#4a3d68')
  })
  // Heart pieces
  const py = y + 46
  drawText(g, 'HEART PIECES', x + 8, py, '#b9a8d9')
  for (let i = 0; i < 4; i++) {
    g.fillStyle = i < s.inv.pieces ? '#ff2fa0' : '#3a2a5a'
    g.fillRect(x + 8 + textWidth('HEART PIECES') + 6 + (i % 2) * 5, py - 1 + Math.floor(i / 2) * 5, 4, 4)
  }
  // Objective
  const lines = wrapText(objective(s), w - 16)
  drawText(g, 'QUEST', x + 8, y + 62, '#ffd23f')
  lines.slice(0, 4).forEach((l, i) => drawText(g, l, x + 8, y + 74 + i * 10, '#fff4ff'))
  const hint = keys.a === 'A' ? 'TAP RESUME' : 'P OR ESC TO RESUME'
  drawText(g, hint, Math.round((vw - textWidth(hint)) / 2), y + 126, '#b9a8d9')
}
