/**
 * The HUD layer (unlit): the SCUMM panel (sentence line, verbs, inventory,
 * portraits), dialogue choices, speech over heads, caption cards, the
 * crosshair cursor and the tall layout's header.
 */
import { drawText, textWidth, wrapText } from '../../base/pixel/sprites'
import type { Game } from '../engine/game'
import type { Box } from '../engine/layout'
import { hit } from '../engine/layout'
import { HERO_IDS, VERB_LABEL } from '../types'
import type { G } from './api'
import { itemIcon } from './items'
import { portrait } from './actors'
import { drawHouseHeader } from './header'

export const UI = {
  panel: '#120a20',
  edge: '#3a2458',
  verb: '#7d6fa6',
  verbHover: '#e8dcff',
  verbOn: '#ffffff',
  verbLit: '#ffd23f',
  slot: '#1c1030',
  slotHover: '#2c1c48',
  outline: '#07040d',
}

/** Text with a one-pixel dark outline all round (readable on any room). */
export function outlined(g: G, text: string, x: number, y: number, color: string, outline = UI.outline) {
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    drawText(g, text, x + dx, y + dy, outline)
  }
  drawText(g, text, x, y, color)
}

function centred(g: G, text: string, b: Box, color: string, dy = 0) {
  const w = textWidth(text)
  drawText(g, text, Math.round(b.x + (b.w - w) / 2), Math.round(b.y + (b.h - 7) / 2) + dy, color)
}

export function drawPanel(g: G, game: Game) {
  const L = game.lay
  const hero = game.content.heroes[game.hero]
  const p = game.pointer
  const busy = game.busy && !game.choice

  // Sentence line
  const sentence = game.choice ? '' : busy ? '' : game.sentence()
  if (sentence) {
    const w = textWidth(sentence)
    drawText(g, sentence, Math.round(L.sentence.x + (L.sentence.w - w) / 2), L.sentence.y + Math.floor((L.sentence.h - 7) / 2), hero.color)
  }

  if (game.choice) {
    const rows = game.choiceRows()
    for (const r of rows) {
      const on = p && hit(r, p.x, p.y)
      const color = on ? '#ffffff' : hero.color
      const top = r.y + Math.floor((L.choiceLineH - 7) / 2)
      r.lines.forEach((line, k) => drawText(g, line, r.x + 2 + (k ? 6 : 0), top + k * L.choiceWrapH, color))
    }
    arrow(g, L.choiceUp, true, game.canScrollChoices(-1), p)
    arrow(g, L.choiceDown, false, game.canScrollChoices(1), p)
    drawPortraits(g, game, true)
    return
  }

  // Verbs
  const lit = game.litVerb()
  for (const v of L.verbs) {
    const on = game.verb === v.verb
    const hov = !busy && p && hit(v, p.x, p.y)
    if (L.tall) {
      g.fillStyle = on ? '#2c1c48' : UI.slot
      g.fillRect(v.x, v.y, v.w, v.h)
      g.fillStyle = on ? hero.color : UI.edge
      g.fillRect(v.x, v.y + v.h - 1, v.w, 1)
    }
    const color = busy ? '#3a2e52' : on ? UI.verbOn : lit === v.verb ? UI.verbLit : hov ? UI.verbHover : UI.verb
    centred(g, VERB_LABEL[v.verb], v, color)
  }

  // Inventory
  const slots = game.invSlots()
  for (let i = 0; i < L.cols * L.rows; i++) {
    const x = L.inv.x + (i % L.cols) * L.cell.w
    const y = L.inv.y + Math.floor(i / L.cols) * L.cell.h
    g.fillStyle = UI.slot
    g.fillRect(x + 1, y + 1, L.cell.w - 2, L.cell.h - 2)
  }
  for (const s of slots) {
    const hov = p && hit(s, p.x, p.y)
    const sel = game.obj1 === s.id
    if (hov || sel) {
      g.fillStyle = sel ? '#3a2458' : UI.slotHover
      g.fillRect(s.x + 1, s.y + 1, s.w - 2, s.h - 2)
    }
    const icon = itemIcon(s.id, game.s)
    const k = L.tall && icon.width * 2 <= s.w - 2 && icon.height * 2 <= s.h - 2 ? 2 : 1
    g.drawImage(icon, Math.round(s.x + (s.w - icon.width * k) / 2), Math.round(s.y + (s.h - icon.height * k) / 2), icon.width * k, icon.height * k)
  }
  arrow(g, L.invUp, true, game.canScroll(-1), p)
  arrow(g, L.invDown, false, game.canScroll(1), p)

  drawPortraits(g, game, busy)
}

function arrow(g: G, b: Box, up: boolean, on: boolean, p: { x: number; y: number } | null) {
  if (!on) return
  const cx = b.x + Math.floor(b.w / 2)
  const cy = b.y + Math.floor(b.h / 2)
  g.fillStyle = p && hit(b, p.x, p.y) ? '#ffffff' : UI.verb
  for (let r = 0; r < 4; r++) g.fillRect(cx - r, up ? cy - 2 + r : cy + 2 - r, r * 2 + 1, 1)
}

function drawPortraits(g: G, game: Game, dim: boolean) {
  const L = game.lay
  const p = game.pointer
  for (const b of L.portraits) {
    const on = b.hero === game.hero
    const hov = p && hit(b, p.x, p.y)
    const def = game.content.heroes[b.hero]
    const flashAt = game.arrived[b.hero]
    const blink = flashAt !== undefined && game.clock - flashAt < 1.6 && Math.floor((game.clock - flashAt) * 6) % 2 === 0
    g.fillStyle = on ? '#2c1c48' : blink ? '#5a3a20' : UI.slot
    g.fillRect(b.x, b.y, b.w, b.h)
    if (on || hov || blink) {
      g.fillStyle = on ? def.color : blink ? '#ffd23f' : UI.edge
      g.fillRect(b.x, b.y, b.w, 1)
      g.fillRect(b.x, b.y + b.h - 1, b.w, 1)
      g.fillRect(b.x, b.y, 1, b.h)
      g.fillRect(b.x + b.w - 1, b.y, 1, b.h)
    }
    let img = portrait(b.hero, L.tall ? 2 : 1, game.s)
    if (img.height > b.h - 2 || img.width > b.w - 4) img = portrait(b.hero, 1, game.s)
    g.globalAlpha = dim && !on ? 0.5 : 1
    // Names only when every face has room for its own, so the row matches.
    const named = L.tall && HERO_IDS.every(h => img.width + 10 + textWidth(game.content.heroes[h].name) <= b.w)
    if (named) {
      const x = b.x + Math.floor((b.w - img.width - 4 - textWidth(def.name)) / 2)
      g.drawImage(img, x, b.y + Math.floor((b.h - img.height) / 2))
      drawText(g, def.name, x + img.width + 4, b.y + Math.floor((b.h - 7) / 2), on ? def.color : UI.verb)
    } else {
      g.drawImage(img, Math.round(b.x + (b.w - img.width) / 2), Math.round(b.y + (b.h - img.height) / 2))
    }
    g.globalAlpha = 1
  }
}

/** Speech over the speaker's head, or along the top when they're in another room. */
export function drawSpeech(g: G, game: Game) {
  const sp = game.speech
  if (!sp) return
  const anchor = game.speechAnchor()
  if (!anchor) return
  const L = game.lay
  const sc = L.scene
  const maxW = Math.min(sc.w - 16, 210)
  const onScreen = anchor.room !== null && !game.split && anchor.room === game.room
  const npc = game.content.npcs[sp.who]
  const hero = game.content.heroes[sp.who as keyof typeof game.content.heroes]
  const name = hero?.name ?? npc?.name ?? ''
  const text = onScreen || !name ? sp.text : `${name}: ${sp.text}`
  const lines = wrapText(text.toUpperCase(), maxW)
  const lh = 9
  let y: number
  let cx: number
  if (onScreen) {
    cx = anchor.x - game.camX + sc.x
    y = sc.y + anchor.y - lines.length * lh - 2
  } else {
    cx = sc.x + sc.w / 2
    y = sc.y + 6
  }
  y = Math.max(sc.y + 2, Math.min(sc.y + sc.h - lines.length * lh - 2, y))
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const w = textWidth(line)
    const x = Math.round(Math.max(sc.x + 3, Math.min(sc.x + sc.w - w - 3, cx - w / 2)))
    outlined(g, line, x, Math.round(y + i * lh), anchor.color)
  }
}

export function drawCard(g: G, game: Game, w: number, h: number) {
  const c = game.card!
  const lines = wrapText(c.text.toUpperCase(), Math.min(w - 24, 260))
  const a = Math.min(1, c.age * 3, (c.s - c.age) * 3)
  g.globalAlpha = Math.max(0, a)
  const sc = game.lay.scene
  const top = sc.y + Math.round(sc.h / 2 - (lines.length * 10) / 2)
  lines.forEach((line, i) => {
    const lw = textWidth(line)
    drawText(g, line, Math.round((w - lw) / 2), top + i * 10, '#fff1b0')
  })
  g.globalAlpha = 1
  void h
}

export function drawCursor(g: G, game: Game) {
  const p = game.pointer!
  const x = Math.round(p.x)
  const y = Math.round(p.y)
  const hot = game.hover && (game.hover.kind !== 'scene' || game.hover.hs)
  const col = hot ? '#ffffff' : '#c7a6ff'
  const t = Math.floor(game.clock * 4) % 2
  g.fillStyle = UI.outline
  for (const [dx, dy, w, h] of [[-6, -1, 5, 3], [2, -1, 5, 3], [-1, -6, 3, 5], [-1, 2, 3, 5]] as const) g.fillRect(x + dx, y + dy, w, h)
  g.fillStyle = hot && t ? '#ffd23f' : col
  g.fillRect(x - 5, y, 4, 1)
  g.fillRect(x + 2, y, 4, 1)
  g.fillRect(x, y - 5, 1, 4)
  g.fillRect(x, y + 2, 1, 4)
}

export function drawHeader(g: G, game: Game, b: Box) {
  drawHouseHeader(g, game, b, false)
}
