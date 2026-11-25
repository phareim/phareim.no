/**
 * Field battles on screen (`GameState.battle`): the little that is drawn
 * over the world while a fight is on, in the HUD's logical px. Everything
 * else is the world as it is: the fighters are the hero, Luna and the
 * map's enemies, moved by the engine (the lunge, the walk into place) and
 * flashing as usual.
 *
 * - under each party member, a 12×2 gauge (cyan; white blinking when full) and its tech points as dots;
 *   Luna's hit points as pips over it (the hero's are the hearts in the corner);
 * - over each foe, its hit points as pips, and a dot for each status on it;
 * - numbers and words rising from whoever was hit;
 * - while a member chooses: a marker over its head and a small strip of at most four commands beside it;
 *   choosing a target, a bouncing arrow over the target with its name, and a diamond under all it would hit.
 *
 * Both the classic and the isometric view draw it (`hudPaint` in renderer.ts), each with its own `place`.
 * The strip's lines and the fighters are returned as touch boxes.
 */
import type { BattlePick, BattleStatus, GameState } from '../types'
import { FOES, fighterAt, menuView, TP_MAX } from '../engine/battle/index'
import { hudFont, type HudSkin } from './hud'

type G = CanvasRenderingContext2D
export interface BattleBox { x: number; y: number; w: number; h: number; pick: BattlePick }
/** A world point (tiles; z up) in the HUD's logical px. */
export type HudPlace = (x: number, y: number, z?: number) => { x: number; y: number }

const LINE = 9
const STATUS_TONE: Record<BattleStatus, 'prize' | 'ok' | 'cool' | 'hot'> = { stun: 'prize', static: 'ok', slow: 'cool', break: 'hot' }

/** How far below a figure's position its feet are (tiles): every view stands its picture there. */
const FEET = 0.45
/** How tall a foe stands over its feet (tiles), for its pips. */
function heightOf(look: string): number {
  return look === 'knight' ? 2.3 : look === 'bat' || look === 'drone' ? 1.85 : look === 'blob' ? 1.15 : 1.55
}

/**
 * Draw the fight's overlay. `top` and `bottom` keep it clear of the HUD's top row and the screen's bottom band.
 * Returns the touch boxes (HUD px).
 */
export function drawBattle(g: G, s: GameState, place: HudPlace, vw: number, vh: number, top: number, bottom: number, time: number, skin: HudSkin): BattleBox[] {
  const b = s.battle
  if (!b || (s.mode !== 'battle' && b.phase !== 'lost')) return []
  // Points by a figure are measured from its feet.
  const P: HudPlace = (x, y, z = 0) => place(x, y + FEET, z)
  const F = hudFont(skin)
  const boxes: BattleBox[] = []
  const view = b.phase === 'fight' ? menuView(s) : null
  const covered = new Set(view?.targets ?? [])
  const rect = (x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), w, h) }
  const outlined = (text: string, x: number, y: number, color: string) => F.draw(g, text, Math.round(x), Math.round(y), color, skin.outline)
  const live = b.phase === 'fight' || b.phase === 'intro'

  // --- foes: pips and statuses; the target markers -------------------------------------
  for (const f of b.fighters) {
    if (f.side !== 'foe' || f.down) continue
    const at = fighterAt(s, f)
    const look = FOES[f.foe!].look
    const head = P(at.x, at.y, heightOf(look))
    const feet = P(at.x, at.y)
    boxes.push({ x: head.x - 9, y: head.y - 2, w: 18, h: Math.max(14, feet.y - head.y + 6), pick: { target: f.id } })
    if (!live) continue
    const n = f.maxHp >= 60 ? 8 : 5
    const full = Math.ceil((f.hp / f.maxHp) * n)
    const w = n * 3 - 1
    const x0 = Math.round(head.x - w / 2)
    const y0 = Math.round(head.y - 4)
    rect(x0 - 1, y0 - 1, w + 2, 4, skin.outline)
    for (let i = 0; i < n; i++) rect(x0 + i * 3, y0, 2, 2, i < full ? (f.flash > 0 ? skin.text : skin.hot) : skin.off)
    const sts = Object.keys(f.status) as BattleStatus[]
    sts.forEach((k, i) => rect(x0 + w + 2 + i * 3, y0, 2, 2, skin[STATUS_TONE[k]]))
    if (f.guard) rect(x0 - 4, y0, 2, 2, skin.cool)
    if (covered.has(f.id)) { const d = P(at.x, at.y); diamond(g, d.x, d.y, skin.hot, time) }
  }

  // --- the party: gauges, tech points, Luna's pips ------------------------------------
  for (const f of b.fighters) {
    if (f.side !== 'party') continue
    const at = fighterAt(s, f)
    const feet = P(at.x, at.y)
    const head = P(at.x, at.y, 1.9)
    if (covered.has(f.id)) diamond(g, feet.x, feet.y - 2, skin.ok, time)
    boxes.push({ x: head.x - 9, y: head.y - 2, w: 18, h: Math.max(14, feet.y - head.y + 2), pick: { target: f.id } })
    if (!live) continue
    const x0 = Math.round(feet.x - 6)
    const y0 = Math.round(feet.y)
    if (f.down) { outlined('KO', feet.x - F.width('KO') / 2, y0, skin.hot); continue }
    rect(x0 - 1, y0 - 1, 14, 4, skin.outline)
    rect(x0, y0, 12, 2, skin.off)
    const ready = f.atb >= 1
    const blink = Math.floor(time * 6) % 2 === 0
    rect(x0, y0, Math.round(12 * Math.min(1, f.atb)), 2, ready ? (blink ? skin.text : skin.cool) : skin.cool)
    for (let i = 0; i < TP_MAX; i++) rect(x0 + 1 + i * 4, y0 + 3, 2, 1, i < f.tp ? skin.prize : skin.faint)
    if (f.member !== 'hero') {
      const n = Math.ceil(f.maxHp / 2)
      const full = Math.ceil(f.hp / 2)
      for (let i = 0; i < n; i++) rect(x0 + i * 3, y0 - 4, 2, 2, i < full ? skin.hot : skin.off)
    }
    const sts = Object.keys(f.status) as BattleStatus[]
    sts.forEach((k, i) => rect(x0 + 13 + i * 3, y0, 2, 2, skin[STATUS_TONE[k]]))
  }

  // --- rising numbers and words -------------------------------------------------------
  for (const p of b.pops) {
    const at = P(p.x, p.y, 1.55)
    const rise = Math.min(1, p.t / 0.5)
    const y = at.y - 4 - (1 - (1 - rise) * (1 - rise)) * 10
    const color = p.tone === 'hit' ? skin.text : p.tone === 'hurt' ? skin.hot : p.tone === 'heal' ? skin.ok : skin.prize
    g.globalAlpha = p.t > 0.7 ? Math.max(0, (1 - p.t) / 0.3) : 1
    outlined(p.text, at.x - F.width(p.text) / 2, y, color)
    g.globalAlpha = 1
  }

  // --- the menu -----------------------------------------------------------------------
  if (view) {
    const me = b.fighters.find(f => f.id === view.who)!
    const at = fighterAt(s, me)
    const head = P(at.x, at.y, 2.05)
    // Whose turn: a small marker over the head.
    const bob = Math.round(Math.sin(time * 6) * 1)
    rect(head.x - 2, head.y - 5 + bob, 5, 1, skin.prize)
    rect(head.x - 1, head.y - 4 + bob, 3, 1, skin.prize)
    rect(head.x, head.y - 3 + bob, 1, 1, skin.prize)
    // The strip beside the member, on the side away from the foes.
    const foes = b.fighters.filter(f => f.side === 'foe' && !f.down)
    const fx = foes.length ? foes.reduce((a, f) => a + P(f.home.x, f.home.y).x, 0) / foes.length : vw
    const body = P(at.x, at.y, 1.15)
    const tw = Math.max(...view.lines.map(l => F.width(l.label)))
    const extra = view.lines.some(l => l.cost || l.count !== undefined) ? 12 : 0
    const w = tw + 14 + extra
    const h = view.lines.length * LINE + 5
    // Beside the member, away from the foes, never over another fighter: the first spot that covers nobody
    // (beside, then a little above or below, then the other side), else the one that covers least.
    const away = fx > body.x ? -1 : 1
    const figures = b.fighters.filter(f => f !== me && !f.down).map(f => { const p = fighterAt(s, f); const hd = P(p.x, p.y, 1.95); const ft = P(p.x, p.y, 0); return { x: hd.x - 8, y: hd.y - 6, w: 16, h: ft.y - hd.y + 10 } })
    const clampX = (x: number) => Math.round(Math.max(2, Math.min(vw - 2 - w, x)))
    const clampY = (y: number) => Math.round(Math.max(top + 2, Math.min(vh - bottom - 2 - h, y)))
    let best = { x: 0, y: 0, cost: Infinity }
    for (const side of [away, -away]) {
      for (const dy of [0, -h / 2 - 6, h / 2 + 6]) {
        const want = { x: side < 0 ? body.x - 13 - w : body.x + 13, y: body.y - h / 2 + dy }
        const x = clampX(want.x)
        const y = clampY(want.y)
        let cost = Math.abs(x - want.x) + Math.abs(y - want.y) + (side === away ? 0 : 6) + Math.abs(dy) * 0.2
        for (const r of figures) cost += overlap(x, y, w, h, r) * 4
        // (Never over the member itself.)
        const self = { x: body.x - 8, y: head.y - 4, w: 16, h: P(at.x, at.y).y - head.y + 8 }
        cost += overlap(x, y, w, h, self) * 8
        if (cost < best.cost) best = { x, y, cost }
      }
    }
    const x = best.x
    const y = best.y
    const choosing = view.level !== 'target'
    g.globalAlpha = choosing ? 1 : 0.7
    skin.panel(g, x, y, w, h, 'cool')
    view.lines.forEach((l, i) => {
      const ly = y + 3 + i * LINE
      const here = i === view.cursor
      const color = !l.ok ? skin.faint : here ? skin.text : skin.dim
      F.draw(g, l.label, x + 9, ly, color, skin.shadow)
      if (l.cost) for (let k = 0; k < l.cost; k++) rect(x + w - 5 - k * 3, ly + 3, 2, 2, l.ok ? skin.prize : skin.faint)
      else if (l.count !== undefined) { const t = String(l.count); F.draw(g, t, x + w - 4 - F.width(t), ly, color, skin.shadow) }
      if (here) {
        if (skin.pointer) skin.pointer(g, x + 1, ly, time)
        else F.draw(g, '>', x + 3 + (choosing && Math.floor(time * 4) % 2 ? 1 : 0), ly, skin.prize, skin.shadow)
      }
      boxes.push({ x, y: ly - 1, w, h: LINE, pick: { cmd: i } })
    })
    g.globalAlpha = 1
    // The target: a bouncing arrow over it and its name.
    if (view.target) {
      const t = b.fighters.find(f => f.id === view.target)
      if (t) {
        const ta = fighterAt(s, t)
        const th = P(ta.x, ta.y, t.side === 'foe' ? heightOf(FOES[t.foe!].look) + 0.45 : 2.35)
        const by = Math.round(th.y - 6 + Math.abs(Math.sin(time * 7)) * -2)
        rect(th.x - 3, by, 7, 1, skin.hot)
        rect(th.x - 2, by + 1, 5, 1, skin.hot)
        rect(th.x - 1, by + 2, 3, 1, skin.hot)
        rect(th.x, by + 3, 1, 1, skin.hot)
        const name = t.side === 'foe' ? FOES[t.foe!].name : t.member === 'hero' ? 'YOU' : 'LUNA'
        const nw = F.width(name)
        const nx = Math.max(2, Math.min(vw - 2 - nw, th.x - nw / 2))
        outlined(name, nx, Math.max(top + 1, by - 9), skin.text)
      }
    }
  }
  return boxes
}

/** A flat diamond on the ground under a fighter (blinks slowly). */
function diamond(g: G, x: number, y: number, color: string, time: number) {
  if (Math.floor(time * 3) % 3 === 2) return
  g.fillStyle = color
  const cx = Math.round(x)
  const cy = Math.round(y)
  for (let r = -2; r <= 2; r++) {
    const half = 4 - Math.abs(r) * 2
    g.fillRect(cx - half, cy + r, 1, 1)
    g.fillRect(cx + half, cy + r, 1, 1)
  }
}

/** The box under a point (HUD px), the strip's lines first; null: none. */
export function pickAt(boxes: readonly BattleBox[], x: number, y: number): BattlePick | null {
  const cmd = boxes.find(b => 'cmd' in b.pick && x >= b.x && x < b.x + b.w && y >= b.y && y < b.y + b.h)
  if (cmd) return cmd.pick
  let best: BattleBox | null = null
  let bd = Infinity
  for (const b of boxes) {
    if (!('target' in b.pick)) continue
    const pad = 4
    if (x < b.x - pad || x >= b.x + b.w + pad || y < b.y - pad || y >= b.y + b.h + pad) continue
    const d = Math.hypot(x - (b.x + b.w / 2), y - (b.y + b.h / 2))
    if (d < bd) { bd = d; best = b }
  }
  return best ? best.pick : null
}

/** The area two rectangles share (HUD px²). */
function overlap(x: number, y: number, w: number, h: number, r: { x: number; y: number; w: number; h: number }): number {
  const ox = Math.min(x + w, r.x + r.w) - Math.max(x, r.x)
  const oy = Math.min(y + h, r.y + r.h) - Math.max(y, r.y)
  return ox > 0 && oy > 0 ? ox * oy : 0
}
