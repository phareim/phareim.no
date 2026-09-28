// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Crossroads Café — a corner café where the old town meets the new. Left:
 * stone townhouses with stepped gables and a clock tower, a gas lamp and
 * cobbles. Right: a glass tower with a lit lobby, a screen that shows the
 * music's layers as bars, blinking aviation lights far up. In between, the
 * café: a gold CROSSROADS board over a striped awning, a warm window with
 * an espresso machine and a barista, a bistro table outside with steam off
 * the cup. A traffic light cycles; trams and pod cars stop for it and
 * people cross on red.
 *
 * The music: lead and counter notes light a window in the old town, arp and
 * bells a pane in the glass tower (pitch → height), the kick puffs steam
 * from the machine, the chord colour runs up the tower's neon strip, and
 * intensity brings more traffic.
 */
import { disc, ditherGradient, hash2, rect } from '../pixel/scenery.ts'
import { drawText, mix, textWidth } from '../pixel/sprites.ts'
import { layer, melodic, wrap, type FrameCtx, type G, type Lights, type Place } from '../lib/kit.ts'
import { INK, paintMoon } from '../lib/paint.ts'

interface Pane { x: number; y: number; w: number; h: number; warm: boolean; f: number }
interface Car { kind: 'tram' | 'pod' | 'bike'; x: number; v: number; len: number }
interface Puff { x: number; y: number; age: number; life: number; vx: number }

const CYCLE = 18
const LAYERS = ['pad', 'arp', 'bass', 'drums', 'perc', 'lead', 'counter', 'bells'] as const

export function createCrossroadsCafe(): Place {
  let W = 0
  let H = 0
  let walk = 0
  let curb = 0
  let lane = 0
  let near = 0
  let back: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let oldWins: Pane[] = []
  let panes: Pane[] = []
  let warmWins: { x: number; y: number }[] = []
  let clock = { x: 0, y: 0, r: 0 }
  let aviation: { x: number; y: number }[] = []
  let cafe = { l: 0, r: 0, top: 0, board: 0, win: { x: 0, y: 0, w: 0, h: 0 }, door: { x: 0, y: 0, w: 0, h: 0 } }
  let machine = { x: 0, y: 0 }
  let pendants: { x: number; y: number }[] = []
  let table = { x: 0, y: 0 }
  let tower = { l: 0, lobby: 0 }
  let screen = { x: 0, y: 0, w: 0, h: 0 }
  let signal = { x: 0, y: 0 }
  let gas = { x: 0, y: 0 }
  let led = { x: 0, y: 0 }
  let cross = { x: 0, w: 0 }
  const cars: Car[] = []
  const puffs: Puff[] = []
  let lastBeat = 0
  let nextCar = 2

  function archWindow(g: G, x: number, y: number, w: number, h: number, lit: boolean, salt: number): Pane {
    rect(g, INK, x - 1, y, w + 2, h + 1)
    rect(g, INK, x, y - 1, w, 1)
    const col = lit ? (hash2(x, y, salt) > 0.5 ? '#ffd23f' : '#ffb13f') : '#1a1034'
    rect(g, col, x, y, w, h)
    rect(g, INK, x, y, 1, 1)
    rect(g, INK, x + w - 1, y, 1, 1)
    rect(g, lit ? mix(col, INK, 0.35) : '#140b26', x, y + Math.round(h * 0.45), w, 1)
    rect(g, lit ? mix(col, INK, 0.35) : '#140b26', x + Math.floor(w / 2), y + 1, 1, h - 1)
    rect(g, '#6a5a78', x - 1, y + h, w + 2, 1)
    if (lit) warmWins.push({ x: x + w / 2, y: y + h / 2 })
    return { x, y, w, h, warm: true, f: 0 }
  }

  /** A stone townhouse with a stepped gable; returns its windows. */
  function townhouse(g: G, x0: number, x1: number, top: number, salt: number, body: string) {
    const steps = 3
    const bw = x1 - x0
    const stepW = Math.max(2, Math.round(bw * 0.12))
    for (let k = 0; k < steps; k++) {
      const ix = x0 + stepW * (k + 1) - 1
      const sy = top - (k + 1) * 4
      rect(g, INK, ix - 1, sy - 1, x1 - x0 - 2 * stepW * (k + 1) + 4, 5)
      rect(g, body, ix, sy, x1 - x0 - 2 * stepW * (k + 1) + 2, 4)
      rect(g, '#8a7098', ix, sy, x1 - x0 - 2 * stepW * (k + 1) + 2, 1)
    }
    rect(g, INK, x0 - 1, top - 1, bw + 2, walk - top + 1)
    rect(g, body, x0, top, bw, walk - top)
    for (let y = top + 2; y < walk; y += 3) {
      rect(g, mix(body, INK, 0.25), x0, y, bw, 1)
      for (let x = x0 + ((y / 3) % 2) * 3; x < x1; x += 6) {
        rect(g, mix(body, INK, 0.25), x, y - 2, 1, 2)
        if (hash2(x, y, salt) > 0.8) rect(g, mix(body, '#b9a0c8', 0.18), x + 1, y - 2, 4, 2)
      }
    }
    rect(g, '#8a7098', x0, top, bw, 1)
    const cols = Math.max(1, Math.floor((bw - 4) / 9))
    const pad = Math.round((bw - cols * 9 + 3) / 2)
    for (let y = top + 5; y < walk - 16; y += 15) for (let i = 0; i < cols; i++) {
      const wx = x0 + pad + i * 9
      oldWins.push(archWindow(g, wx, y, 6, 10, hash2(wx, y, salt) > 0.55, salt))
    }
    // A door at street level.
    const dx = x0 + Math.round(bw * 0.3)
    rect(g, INK, dx - 1, walk - 12, 9, 12)
    rect(g, '#4a2230', dx, walk - 11, 7, 11)
    rect(g, '#6a3040', dx, walk - 11, 7, 1)
    rect(g, '#ffb13f', dx + 5, walk - 6, 1, 1)
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    walk = Math.round(h * (portrait ? 0.72 : 0.7))
    curb = walk + Math.max(5, Math.round(h * 0.05))
    near = h - Math.max(6, Math.round(h * (portrait ? 0.08 : 0.05)))
    lane = curb + Math.round((near - curb) * 0.55)
    oldWins = []
    panes = []
    warmWins = []
    pendants = []
    aviation = []
    cars.length = 0
    const oldR = Math.round(w * (portrait ? 0.27 : 0.33))
    cafe.l = oldR + 1
    cafe.r = Math.round(w * (portrait ? 0.73 : 0.64))
    tower.l = cafe.r + 2
    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, walk, ['#0b0616', '#140b26', '#1c1846', '#2a2a6a', '#43307e', '#7a3a7c', '#c0587a'])
      for (let i = 0; i < w * 0.25; i++) {
        const x = Math.floor(hash2(i, 1, 41) * w)
        const y = Math.floor(Math.pow(hash2(i, 2, 41), 1.8) * h * 0.4)
        rect(g, hash2(i, 3, 41) > 0.8 ? '#fff4ff' : '#6a5fa0', x, y)
      }
      paintMoon(g, Math.round(w * 0.12), Math.round(h * 0.13), Math.max(5, Math.round(h * 0.045)))
      // Far skyline: old roofs and spires on the left, new towers on the right.
      for (let x = -4, i = 0; x < w; i++) {
        const newSide = x > w * 0.5
        const bw = newSide ? 10 + Math.floor(hash2(i, 1, 5) * 14) : 8 + Math.floor(hash2(i, 1, 5) * 10)
        const top = newSide ? Math.round(h * (0.12 + hash2(i, 2, 5) * 0.2)) : Math.round(h * (0.38 + hash2(i, 2, 5) * 0.12))
        const body = newSide ? '#1c2150' : '#2a1f50'
        rect(g, body, x, top, bw, walk - top)
        if (newSide) {
          rect(g, '#3a4a8a', x, top, bw, 1)
          for (let y = top + 3; y < walk; y += 3) for (let xx = x + 1; xx < x + bw - 1; xx += 2) if (hash2(xx, y, 9) > 0.86) rect(g, '#5a7ac0', xx, y, 1, 1)
          aviation.push({ x: x + Math.floor(bw / 2), y: top - 1 })
        } else {
          // Pitched roofs, now and then a spire or a dome.
          for (let k = 0; k < 4; k++) rect(g, body, x + k, top - 4 + k, bw - 2 * k, 1)
          const r = hash2(i, 3, 5)
          if (r > 0.75) { const sx = x + Math.floor(bw / 2); for (let k = 0; k < 12; k++) rect(g, body, sx - Math.floor(k / 5), top - 16 + k, 1 + 2 * Math.floor(k / 5), 1) }
          else if (r > 0.55) disc(g, body, x + Math.floor(bw / 2), top - 3, Math.max(3, Math.floor(bw / 3)))
        }
        x += bw + (newSide ? 3 : 1)
      }
      // The clock tower above the old town.
      const cx = Math.round(oldR * 0.62)
      const ct = Math.round(h * 0.14)
      rect(g, INK, cx - 8, ct - 1, 17, walk - ct)
      rect(g, '#3a2c5c', cx - 7, ct, 15, walk - ct)
      for (let y = ct + 3; y < walk; y += 4) rect(g, '#2e2250', cx - 7, y, 15, 1)
      for (let k = 0; k < 10; k++) rect(g, k === 9 ? '#8c2e72' : '#5a1c4c', cx - Math.floor(k * 0.9), ct - 10 + k, 1 + 2 * Math.floor(k * 0.9), 1)
      rect(g, '#8c2e72', cx, ct - 14, 1, 5)
      clock = { x: cx, y: ct + 8, r: 5 }
      disc(g, INK, cx, clock.y, 6)
      disc(g, '#fff1b0', cx, clock.y, 5)
      for (let k = 0; k < 12; k++) rect(g, '#a8847a', Math.round(cx + Math.cos(k * Math.PI / 6) * 4), Math.round(clock.y + Math.sin(k * Math.PI / 6) * 4))
    })
    front = layer(w, h, g => {
      // Old town.
      const mid = Math.round(oldR * 0.5)
      townhouse(g, -2, mid, Math.round(h * (portrait ? 0.34 : 0.3)), 3, '#4a3868')
      townhouse(g, mid + 2, oldR, Math.round(h * (portrait ? 0.4 : 0.37)), 7, '#503a5c')
      // The café's building: three old storeys over the shopfront.
      cafe.top = Math.round(h * (portrait ? 0.22 : 0.16))
      const cw = cafe.r - cafe.l
      rect(g, INK, cafe.l - 1, cafe.top - 3, cw + 2, walk - cafe.top + 3)
      rect(g, '#5e3f58', cafe.l, cafe.top, cw, walk - cafe.top)
      for (let y = cafe.top + 4; y < walk; y += 4) rect(g, '#533650', cafe.l, y, cw, 1)
      rect(g, '#8a6a88', cafe.l - 2, cafe.top - 2, cw + 4, 2)
      rect(g, '#b890a8', cafe.l - 2, cafe.top - 2, cw + 4, 1)
      const shopTop = walk - Math.round(h * (portrait ? 0.17 : 0.22))
      cafe.board = shopTop - 12
      const cols = Math.max(2, Math.floor((cw - 6) / 11))
      const pad = Math.round((cw - cols * 11 + 5) / 2)
      for (let y = cafe.top + 5; y < cafe.board - 14; y += 16) for (let i = 0; i < cols; i++) {
        const wx = cafe.l + pad + i * 11
        oldWins.push(archWindow(g, wx, y, 6, 11, hash2(wx, y, 13) > 0.45, 13))
        rect(g, '#2a8579', wx - 1, y + 12, 8, 2)
        rect(g, '#ff8ae0', wx + 1, y + 11, 1, 1)
        rect(g, '#ffd23f', wx + 4, y + 11, 1, 1)
      }
      // Sign board, awning, shop window, door.
      rect(g, INK, cafe.l + 2, cafe.board - 1, cw - 4, 11)
      rect(g, '#2a1426', cafe.l + 3, cafe.board, cw - 6, 9)
      rect(g, '#8a5a3a', cafe.l + 3, cafe.board, cw - 6, 1)
      for (let x = cafe.l; x < cafe.r; x++) {
        const c = Math.floor((x - cafe.l) / 4) % 2 ? '#fff1b0' : '#c4561c'
        rect(g, c, x, shopTop - 2, 1, 4)
        if ((x - cafe.l) % 4 === 1) rect(g, c, x, shopTop + 2, 2, 1)
      }
      rect(g, INK, cafe.l, shopTop + 3, cw, 1)
      const doorW = 9
      cafe.door = { x: cafe.r - doorW - 4, y: shopTop + 5, w: doorW, h: walk - shopTop - 5 }
      cafe.win = { x: cafe.l + 4, y: shopTop + 5, w: cafe.door.x - cafe.l - 7, h: walk - shopTop - 8 }
      const wv = cafe.win
      rect(g, INK, wv.x - 1, wv.y - 1, wv.w + 2, wv.h + 2)
      ditherGradient(g, wv.x, wv.y, wv.w, wv.y + wv.h, ['#ffd23f', '#ffc04a', '#ffb13f', '#e08a3a'])
      // Shelves with cups, a barista, the counter and the machine.
      rect(g, '#9a5a2a', wv.x + 2, wv.y + 5, wv.w - 4, 1)
      for (let x = wv.x + 3; x < wv.x + wv.w - 3; x += 4) rect(g, '#fff4ff', x, wv.y + 3, 2, 2)
      const ctop = wv.y + Math.round(wv.h * 0.62)
      const bx = wv.x + Math.round(wv.w * 0.66)
      rect(g, '#3a1a3a', bx - 2, ctop - 9, 5, 9)
      disc(g, '#3a1a3a', bx, ctop - 11, 2)
      rect(g, '#fff4ff', bx - 2, ctop - 6, 5, 1)
      rect(g, '#5b2a1c', wv.x, ctop, wv.w, 2)
      rect(g, '#b0643a', wv.x, ctop, wv.w, 1)
      rect(g, '#6a3424', wv.x, ctop + 2, wv.w, wv.y + wv.h - ctop - 2)
      machine = { x: wv.x + Math.round(wv.w * 0.24), y: ctop - 8 }
      const m = machine
      rect(g, INK, m.x - 1, m.y - 1, 13, 9)
      rect(g, '#b9b0e6', m.x, m.y, 11, 8)
      rect(g, '#fff4ff', m.x, m.y, 11, 1)
      rect(g, '#6a5fa0', m.x + 1, m.y + 4, 9, 1)
      rect(g, INK, m.x + 2, m.y + 5, 1, 2)
      rect(g, INK, m.x + 8, m.y + 5, 1, 2)
      rect(g, '#ff3b5c', m.x + 5, m.y + 2, 1, 1)
      rect(g, '#fff4ff', m.x + 3, m.y + 6, 2, 2)
      rect(g, '#fff4ff', m.x + 7, m.y + 6, 2, 2)
      for (const k of [0.3, 0.75]) pendants.push({ x: wv.x + Math.round(wv.w * k), y: wv.y + 7 })
      for (const p of pendants) rect(g, INK, p.x, wv.y, 1, p.y - wv.y)
      // Mullions.
      rect(g, INK, wv.x + Math.round(wv.w / 2), wv.y, 1, Math.round(wv.h * 0.62))
      const d = cafe.door
      rect(g, INK, d.x - 1, d.y - 1, d.w + 2, d.h + 1)
      rect(g, '#4a2230', d.x, d.y, d.w, d.h)
      rect(g, '#ffc04a', d.x + 2, d.y + 2, d.w - 4, Math.round(d.h * 0.55))
      rect(g, '#ffd23f', d.x + d.w - 3, d.y + Math.round(d.h * 0.62), 1, 2)
      // The bistro table and a guest, and a chalkboard by the door.
      table = { x: wv.x + Math.round(wv.w * 0.4), y: walk }
      const t = table
      rect(g, INK, t.x - 5, t.y - 8, 11, 1)
      rect(g, '#b9b0e6', t.x - 5, t.y - 9, 11, 1)
      rect(g, INK, t.x, t.y - 8, 1, 8)
      rect(g, INK, t.x - 2, t.y - 1, 5, 1)
      for (const s of [-1, 1]) {
        const cx = t.x + s * 9
        rect(g, INK, cx - 2, t.y - 5, 5, 1)
        rect(g, INK, cx + s * 2, t.y - 11, 1, 11)
        rect(g, INK, cx - s * 2, t.y - 5, 1, 5)
      }
      rect(g, '#2a1438', t.x + 6, t.y - 13, 4, 8)
      disc(g, '#2a1438', t.x + 8, t.y - 15, 2)
      rect(g, '#c4561c', t.x + 6, t.y - 18, 5, 1)
      rect(g, '#2a1438', t.x + 3, t.y - 11, 3, 1)
      rect(g, '#fff4ff', t.x - 2, t.y - 11, 3, 2)
      const ch = d.x - 8
      rect(g, INK, ch, walk - 9, 7, 9)
      rect(g, '#1f3a34', ch + 1, walk - 8, 5, 5)
      for (let k = 0; k < 3; k++) rect(g, '#dff', ch + 2, walk - 7 + k * 2, 1 + (k % 2) * 2, 1)
      // The glass tower: lobby, curtain wall, a screen.
      const tw = w - tower.l
      tower.lobby = walk - Math.round(h * 0.1)
      rect(g, INK, tower.l - 1, 0, tw + 1, walk)
      for (let y = 0; y < tower.lobby - 2; y += 6) for (let x = tower.l + 1; x < w; x += 6) {
        const refl = ((x - tower.l) - y * 0.8 + h) % (h * 0.9)
        const band = refl > h * 0.3 && refl < h * 0.42
        const base = mix('#1a3a6a', '#2a2a6a', y / walk)
        rect(g, band ? '#3a6aa0' : base, x, y, 5, 5)
        rect(g, mix(base, '#7ce4ff', 0.25), x, y, 5, 1)
        const lit = hash2(x, y, 17) > 0.8
        if (lit) rect(g, '#7ce4ff', x + 1, y + 2, 3, 2)
        panes.push({ x, y, w: 5, h: 5, warm: false, f: 0 })
      }
      rect(g, '#0e1a3a', tower.l, tower.lobby - 2, tw, 2)
      ditherGradient(g, tower.l + 1, tower.lobby, tw - 1, walk, ['#b8e4f4', '#8cc4e0', '#6aa0c8'])
      for (let x = tower.l + 1; x < w; x += 8) rect(g, '#9ac8e0', x, tower.lobby, 1, walk - tower.lobby)
      rect(g, '#d8f4ff', tower.l + 1, tower.lobby + 3, tw - 1, 1)
      for (let i = 0; i < 3; i++) {
        const px = tower.l + 6 + Math.floor(hash2(i, 1, 31) * (tw - 12))
        rect(g, '#2a3a6a', px, walk - 9, 3, 9)
        disc(g, '#2a3a6a', px + 1, walk - 11, 1)
      }
      screen = { x: tower.l + 4, y: Math.round(h * (portrait ? 0.3 : 0.24)), w: Math.min(34, tw - 10), h: 16 }
      rect(g, INK, screen.x - 2, screen.y - 2, screen.w + 4, screen.h + 4)
      rect(g, '#2f5fd0', screen.x - 1, screen.y - 1, screen.w + 2, 1)
      // Sidewalk: cobbles on the old side, slabs on the new.
      for (let y = walk; y < curb; y += 2) for (let x = (y % 4) === 0 ? 0 : -2; x < w; x += 4) {
        if (x > tower.l) break
        rect(g, hash2(x, y, 21) > 0.5 ? '#3c3060' : '#342a56', x, y, 3, 1)
        rect(g, '#241a44', x + 3, y, 1, 2)
        rect(g, '#241a44', x, y + 1, 3, 1)
      }
      rect(g, '#4a4270', tower.l, walk, w - tower.l, curb - walk)
      for (let x = tower.l; x < w; x += 10) rect(g, '#3a3260', x, walk, 1, curb - walk)
      rect(g, '#8f86b8', 0, walk, w, 1)
      rect(g, '#8f86b8', 0, curb - 1, w, 1)
      rect(g, '#2a2450', 0, curb, w, 1)
      // Road, tram rails, the crosswalk.
      rect(g, '#191330', 0, curb + 1, w, near - curb - 1)
      for (let y = curb + 2; y < near; y += 3) for (let x = 0; x < w; x += 7) if (hash2(x, y, 23) > 0.85) rect(g, '#221a3e', x, y, 2, 1)
      rect(g, '#4a4270', 0, lane + 2, w, 1)
      rect(g, '#4a4270', 0, lane + 5, w, 1)
      rect(g, '#8f86b8', 0, lane + 2, w, 1)
      cross = { x: tower.l + 6, w: Math.max(12, Math.round(w * 0.07)) }
      for (let y = curb + 2; y < near - 1; y += 3) rect(g, '#b9b0e6', cross.x, y, cross.w, 1)
      rect(g, '#8f86b8', cross.x - 3, curb + 2, 1, near - curb - 3)
      // The near sidewalk, with bollards.
      rect(g, '#2a2450', 0, near - 1, w, 1)
      rect(g, '#8f86b8', 0, near, w, 1)
      for (let y = near + 1; y < h; y += 2) for (let x = (y % 4) === 1 ? 0 : -2; x < tower.l; x += 4) {
        rect(g, hash2(x, y, 29) > 0.5 ? '#3c3060' : '#342a56', x, y, 3, 1)
        rect(g, '#241a44', x + 3, y, 1, 2)
      }
      rect(g, '#4a4270', tower.l, near + 1, w - tower.l, h - near - 1)
      for (let x = tower.l; x < w; x += 10) rect(g, '#3a3260', x, near + 1, 1, h - near - 1)
      for (let x = Math.round(w * 0.08); x < w; x += Math.round(w * 0.16)) {
        if (Math.abs(x - cross.x - cross.w / 2) < cross.w) continue
        rect(g, INK, x - 1, near - 5, 3, 6)
        rect(g, x < tower.l ? '#6a5a78' : '#9ac8e0', x, near - 4, 1, 4)
      }
      // Traffic light at the corner, a gas lamp in the old town, an LED lamp on the new side.
      signal = { x: cross.x - 6, y: curb - 30 }
      rect(g, INK, signal.x - 1, curb - 2, 3, 2)
      rect(g, INK, signal.x, signal.y, 1, 30)
      rect(g, '#3a3260', signal.x, signal.y + 2, 1, 26)
      rect(g, INK, signal.x - 2, signal.y - 12, 5, 13)
      gas = { x: Math.round(oldR * 0.2), y: walk - 20 }
      rect(g, INK, gas.x - 1, walk - 2, 3, 2)
      rect(g, INK, gas.x, gas.y, 1, 20)
      rect(g, INK, gas.x - 2, gas.y - 5, 5, 5)
      rect(g, INK, gas.x - 1, gas.y - 6, 3, 1)
      led = { x: Math.round(w - (w - tower.l) * 0.28), y: walk - 30 }
      rect(g, '#5a6a9a', led.x, led.y, 1, 30)
      rect(g, '#5a6a9a', led.x - 7, led.y, 8, 1)
    })
  }

  function light(c: FrameCtx) {
    const ph = wrap(c.t, CYCLE)
    return ph < 9 ? 'go' : ph < 11 ? 'amber' : 'stop'
  }

  function drawCar(g: G, L: Lights, car: Car) {
    const x = Math.round(car.x)
    const y = lane + 1
    if (car.kind === 'tram') {
      rect(g, INK, x - 1, y - 17, car.len + 2, 17)
      rect(g, '#7a2a3a', x, y - 16, car.len, 12)
      rect(g, '#fff1b0', x, y - 11, car.len, 2)
      for (let k = 3; k < car.len - 5; k += 7) {
        rect(g, '#ffc04a', x + k, y - 15, 5, 4)
        L.emit(x + k, y - 15, 5, 4)
      }
      rect(g, '#5a1c2a', x, y - 4, car.len, 3)
      rect(g, INK, x + car.len - 8, y - 22, 1, 6)
      rect(g, INK, x + car.len - 10, y - 22, 5, 1)
      for (const k of [4, car.len - 8]) disc(g, INK, x + k, y - 1, 2)
      L.light(x + car.len / 2, y - 12, car.len * 0.6, '#ffb13f', 0.3)
      L.light(x + car.len + 2, y - 6, 12, '#fff1b0', 0.5)
    } else if (car.kind === 'pod') {
      rect(g, INK, x, y - 9, car.len, 7)
      rect(g, INK, x + 4, y - 11, car.len - 9, 2)
      rect(g, '#2a2f5a', x + 1, y - 8, car.len - 2, 5)
      rect(g, '#7ce4ff', x + 5, y - 10, car.len - 11, 2)
      rect(g, '#fff4ff', x + car.len - 2, y - 6, 2, 1)
      rect(g, '#ff3b5c', x, y - 6, 1, 1)
      rect(g, '#2ff3ff', x + 2, y - 2, car.len - 4, 1)
      L.emit(x + 5, y - 10, car.len - 11, 2)
      L.emit(x + 2, y - 2, car.len - 4, 1)
      L.light(x + car.len / 2, y, car.len * 0.7, '#2ff3ff', 0.35)
      L.light(x + car.len + 4, y - 5, 12, '#eaffff', 0.45)
    } else {
      const step = Math.floor(car.x / 3) % 2
      disc(g, INK, x + 1, y - 2, 2)
      disc(g, INK, x + 9, y - 2, 2)
      rect(g, INK, x + 1, y - 5, 9, 1)
      rect(g, '#2a1438', x + 4, y - 12, 3, 7)
      disc(g, '#2a1438', x + 6, y - 13, 1)
      rect(g, '#2a1438', x + 5 + step, y - 5, 1, 3)
      rect(g, '#ffd23f', x + 10, y - 6, 1, 1)
    }
  }

  function traffic(g: G, c: FrameCtx, L: Lights) {
    const state = light(c)
    const stop = cross.x - 4
    nextCar -= c.dt
    if (nextCar <= 0 && state === 'go') {
      const r = Math.random()
      const kind: Car['kind'] = r < 0.3 ? 'tram' : r < 0.8 ? 'pod' : 'bike'
      const len = kind === 'tram' ? 46 : kind === 'pod' ? 22 : 11
      const v = kind === 'tram' ? 26 : kind === 'pod' ? 46 : 20
      if (!cars.length || cars[cars.length - 1]!.x > 6) cars.push({ kind, x: -len - 2, v, len })
      nextCar = 3 + Math.random() * (9 - c.energy * 6)
    }
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i]!
      let limit = Infinity
      if (state !== 'go' && car.x + car.len <= stop) limit = stop - car.len
      const ahead = cars[i - 1]
      if (ahead) limit = Math.min(limit, ahead.x - car.len - 4)
      car.x = Math.min(car.x + car.v * c.dt, Math.max(car.x, limit))
    }
    while (cars.length && cars[0]!.x > W + 4) cars.shift()
    for (const car of cars) drawCar(g, L, car)
    // Someone crosses on red, walking towards us.
    const ph = wrap(c.t, CYCLE)
    if (ph > 11.5 && ph < 17.5) {
      const k = (ph - 11.5) / 6
      const x = cross.x + Math.round(cross.w * 0.55)
      const y = Math.round(curb + k * (H - curb + 16))
      const step = Math.floor(c.t * 4) % 2
      rect(g, '#1c1030', x - 1, y - 13, 4, 9)
      disc(g, '#1c1030', x + 1, y - 15, 2)
      rect(g, '#2ff3ff', x - 1, y - 16, 5, 1)
      rect(g, '#1c1030', x - 1 + step, y - 4, 1, 4)
      rect(g, '#1c1030', x + 2 - step, y - 4, 1, 4)
      L.light(x + 1, y - 16, 7, '#2ff3ff', 0.4)
    }
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !front) return
    g.drawImage(back, 0, 0)
    // Aviation lights blink in turns; the clock tells scene time.
    for (let i = 0; i < aviation.length; i++) if (wrap(c.t + i * 0.37, 2) < 0.25) {
      const a = aviation[i]!
      rect(g, '#ff3b5c', a.x, a.y, 1, 1)
      L.emit(a.x, a.y, 1, 1)
      L.light(a.x + 0.5, a.y, 5, '#ff3b5c', 0.5)
    }
    const mins = c.t / 4
    const hand = (a: number, len: number, col: string) => {
      for (let k = 1; k <= len; k++) rect(g, col, Math.round(clock.x + Math.sin(a) * k), Math.round(clock.y - Math.cos(a) * k))
    }
    hand((mins / 60) * Math.PI * 2 + 1.2, 2, INK)
    hand(mins * Math.PI * 2 / 12, 4, '#2a1438')
    L.emit(clock.x - 4, clock.y - 4, 9, 9)
    L.light(clock.x, clock.y, 12, '#fff1b0', 0.35)
    g.drawImage(front, 0, 0)
    for (const wv of warmWins) L.light(wv.x, wv.y, 8, '#ffb13f', 0.25)
    // Notes: lead and counter light the old town, arp and bells the tower.
    for (const n of c.notes) {
      if (n.layer === 'lead' || n.layer === 'counter') {
        const dark = oldWins.filter(p => p.y <= walk - 16)
        const p = dark[Math.floor(Math.random() * dark.length)]
        if (p) p.f = 1
      } else if (melodic(n.layer) && panes.length) {
        const row = Math.round((1 - n.h) * (tower.lobby - 8) / 6) * 6
        const cand = panes.filter(p => p.y === row)
        const p = (cand.length ? cand : panes)[Math.floor(Math.random() * (cand.length || panes.length))]!
        p.f = 1
      }
    }
    for (const p of oldWins) if (p.f > 0) {
      p.f = Math.max(0, p.f - c.dt / 2.2)
      g.globalAlpha = Math.min(1, p.f * 1.5)
      rect(g, '#ffe07a', p.x, p.y + 1, p.w, p.h - 1)
      g.globalAlpha = 1
      L.emit(p.x, p.y + 1, p.w, p.h - 1)
      L.light(p.x + p.w / 2, p.y + p.h / 2, 12, '#ffb13f', 0.45 * p.f)
    }
    for (const p of panes) if (p.f > 0) {
      p.f = Math.max(0, p.f - c.dt / 1.4)
      g.globalAlpha = Math.min(1, p.f * 1.4)
      rect(g, '#eaffff', p.x, p.y + 1, p.w, p.h - 1)
      g.globalAlpha = 1
      L.emit(p.x, p.y + 1, p.w, p.h - 1)
      L.light(p.x + 2.5, p.y + 3, 10, '#7ce4ff', 0.4 * p.f)
    }
    // The tower's neon strip takes the chord's colour; the screen shows the layers.
    const strip = mix(c.accent, '#ffffff', 0.15 * c.beat)
    rect(g, strip, tower.l, 0, 1, tower.lobby - 2)
    L.emit(tower.l, 0, 1, tower.lobby - 2)
    for (let y = 8; y < tower.lobby; y += 18) L.light(tower.l, y, 12, c.accent, 0.3)
    const s = screen
    rect(g, '#0a1030', s.x, s.y, s.w, s.h)
    const bw = Math.max(2, Math.floor((s.w - 2) / LAYERS.length) - 1)
    for (let i = 0; i < LAYERS.length; i++) {
      const lv = c.levels[LAYERS[i]!] ?? 0
      const bh = Math.max(1, Math.round(lv * (s.h - 3) * (0.8 + 0.2 * c.beat)))
      const bx = s.x + 1 + i * (bw + 1)
      rect(g, i % 2 ? '#2ff3ff' : '#ff2fa0', bx, s.y + s.h - 1 - bh, bw, bh)
      rect(g, '#fff4ff', bx, s.y + s.h - 1 - bh, bw, 1)
    }
    L.emit(s.x, s.y, s.w, s.h)
    L.light(s.x + s.w / 2, s.y + s.h / 2, s.w * 0.8, '#6a6cff', 0.35)
    L.emit(tower.l + 1, tower.lobby, W - tower.l - 1, walk - tower.lobby)
    L.light((tower.l + W) / 2, walk - 4, (W - tower.l) * 0.6, '#b8e4f4', 0.3)
    // The café: board, OPEN, window and pendants, the guest's cup.
    const name = 'CROSSROADS'
    const nx = Math.round((cafe.l + cafe.r - textWidth(name)) / 2)
    drawText(g, name, nx, cafe.board + 1, '#ffd23f')
    L.emit(nx, cafe.board + 1, textWidth(name), 7)
    L.light((cafe.l + cafe.r) / 2, cafe.board + 4, (cafe.r - cafe.l) * 0.6, '#ffb13f', 0.4)
    const wv = cafe.win
    const openCol = mix(c.accent, '#ff2fa0', 0.4)
    const ox = wv.x + wv.w - textWidth('OPEN') - 3
    rect(g, '#3a1a2a', ox - 2, wv.y + 9, textWidth('OPEN') + 4, 11)
    drawText(g, 'OPEN', ox, wv.y + 11, openCol)
    L.emit(ox, wv.y + 11, textWidth('OPEN'), 7)
    L.light(ox + 9, wv.y + 14, 12, openCol, 0.35)
    L.emit(wv.x, wv.y, wv.w, Math.round(wv.h * 0.62))
    L.emit(cafe.door.x + 2, cafe.door.y + 2, cafe.door.w - 4, Math.round(cafe.door.h * 0.55))
    L.light(wv.x + wv.w / 2, wv.y + wv.h / 2, wv.w * 0.9, '#ffb13f', 0.5 + 0.08 * c.beat)
    L.light(wv.x + wv.w / 2, curb + 2, wv.w * 0.8, '#ff8a3d', 0.3)
    for (const p of pendants) {
      rect(g, '#fff1b0', p.x - 1, p.y, 3, 2)
      L.light(p.x, p.y + 2, 9, '#fff1b0', 0.35 + 0.15 * c.beat)
    }
    // Steam: the machine on the kick, the cup always.
    if (c.beat > 0.9 && lastBeat <= 0.9 && c.energy > 0.2) puffs.push({ x: machine.x + 3, y: machine.y - 1, age: 0, life: 1.4, vx: 2 })
    lastBeat = c.beat
    if (Math.random() < c.dt * 1.2) puffs.push({ x: table.x - 1, y: table.y - 12, age: 0, life: 2.4, vx: 1 })
    g.fillStyle = '#fff4ff'
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]!
      p.age += c.dt
      if (p.age > p.life) { puffs.splice(i, 1); continue }
      const k = p.age / p.life
      g.globalAlpha = 0.5 * (1 - k)
      g.fillRect(Math.round(p.x + Math.sin(p.age * 3 + p.x) * 1.5 + p.vx * k * 3), Math.round(p.y - k * 10), 1 + Math.round(k * 2), 1 + Math.round(k))
    }
    g.globalAlpha = 1
    // Street lights: a flickering gas lamp, a steady LED.
    const flick = 0.85 + 0.15 * Math.sin(c.t * 13) * Math.sin(c.t * 7.3)
    rect(g, '#ffd23f', gas.x - 1, gas.y - 4, 3, 3)
    L.emit(gas.x - 1, gas.y - 4, 3, 3)
    L.light(gas.x, gas.y - 3, 22, '#ffb13f', 0.55 * flick)
    L.light(gas.x, walk + 2, 18, '#ff8a3d', 0.25 * flick)
    rect(g, '#eaffff', led.x - 7, led.y + 1, 6, 1)
    L.emit(led.x - 7, led.y + 1, 6, 1)
    L.light(led.x - 4, led.y + 2, 24, '#d8f4ff', 0.45)
    L.light(led.x - 4, curb + 4, 20, '#9ac8e0', 0.25)
    // The traffic light.
    const st = light(c)
    const lamps: [string, string, boolean][] = [['#ff3b5c', '#4a1020', st === 'stop'], ['#ffb13f', '#4a3010', st === 'amber'], ['#3fd8b0', '#103a30', st === 'go']]
    for (let i = 0; i < 3; i++) {
      const [on, off, lit] = lamps[i]!
      const ly = signal.y - 11 + i * 4
      rect(g, lit ? on : off, signal.x - 1, ly, 3, 3)
      if (lit) { L.emit(signal.x - 1, ly, 3, 3); L.light(signal.x, ly + 1, 14, on, 0.55) }
    }
    traffic(g, c, L)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#9a8cc8', '#6e62a0', c.dark * 0.6), '#b8ace4', c.energy * 0.1),
    horizon: () => Math.round(H * 0.35),
  }
}
