/**
 * Space Voyagers II: the dashboard, drawn by code in logical pixels: wood
 * grain and bakelite, two cathode screens and the round radar between them
 * (Wing Commander III's Hellcat), and the gauges under them (DESIGN.md,
 * "The cockpit"). The left screen is the comms (the speaker's face) or, when
 * nobody talks, the damage display; the right is the target or the nav
 * point.
 */
import { SHIPS } from '../engine/balance'
import { forwardTo, rightTo, subTo, unrotateTo, upTo, v3 } from '../engine/math'
import { condition, live, shipAt } from '../engine/ships'
import type { Ship } from '../engine/types'
import { autoGoal, calzone } from '../engine/world'
import type { Voyage } from '../engine/world'
import type { Monitor } from '../story/director'
import type { Layout, Rect } from './layout'
import { C } from './palette'
import { clipTo, disc, frame, hash, line, rect, ring, stipple, text, textC } from './pix'
import type { G } from './pix'

// ---------------------------------------------------------------- pictures

const images = new Map<string, HTMLImageElement | null>()
/** A picture by path, loaded on first ask; null until it has loaded (or for good when missing). */
export function picture(src: string): HTMLImageElement | null {
  if (!images.has(src)) {
    images.set(src, null)
    if (typeof Image !== 'undefined') {
      const img = new Image()
      img.onload = () => images.set(src, img)
      img.src = src
    }
  }
  return images.get(src) ?? null
}

// ---------------------------------------------------------------- the wood

let woodCache: { key: string; canvas: HTMLCanvasElement } | null = null

function woodPanel(l: Layout): HTMLCanvasElement {
  const key = `${l.W}x${l.dash.h + l.under.h}`
  if (woodCache?.key === key) return woodCache.canvas
  const c = document.createElement('canvas')
  c.width = l.W
  c.height = l.dash.h + l.under.h
  const g = c.getContext('2d')!
  rect(g, C.wood, 0, 0, c.width, c.height)
  // Grain: long wavy runs of a darker tone, the same every time.
  for (let y = 0; y < c.height; y += 3) {
    const phase = hash(y, 7) % 40
    for (let x = 0; x < c.width; x++) {
      const wobble = Math.round(Math.sin((x + phase) / 9) * 0.8 + Math.sin((x * 0.37 + y) / 23))
      if (hash(x >> 3, y) % 5 === 0) continue
      g.fillStyle = (hash(x >> 2, y >> 1) % 7 === 0) ? C.woodLo : C.woodGrain
      g.fillRect(x, y + wobble + 1, 1, 1)
    }
  }
  // Knots.
  for (let i = 0; i < Math.max(2, Math.floor(c.width / 90)); i++) {
    const kx = hash(i, 3) % c.width, ky = 8 + (hash(i, 5) % Math.max(8, c.height - 16))
    ring(g, C.woodLo, kx, ky, 3)
    ring(g, C.woodGrain, kx, ky, 5, 2)
  }
  // The bakelite rail along the top, and its highlight.
  rect(g, C.bakelite, 0, 0, c.width, 3)
  rect(g, C.bakeliteHi, 0, 3, c.width, 1)
  rect(g, C.woodHi, 0, 4, c.width, 1)
  woodCache = { key, canvas: c }
  return c
}

/** A bezel: a raised metal frame, light from the upper left. */
function bezel(g: G, r: Rect): void {
  rect(g, C.bezelLo, r.x - 2, r.y - 2, r.w + 4, r.h + 4)
  rect(g, C.bezel, r.x - 2, r.y - 2, r.w + 3, r.h + 3)
  rect(g, C.bezelHi, r.x - 2, r.y - 2, r.w + 3, 1)
  rect(g, C.bezelHi, r.x - 2, r.y - 2, 1, r.h + 3)
  rect(g, C.crt, r.x, r.y, r.w, r.h)
}

/** Screen glass: a faint second tone in the corners (no gradient: a stipple). */
function glass(g: G, r: Rect): void {
  stipple(g, C.crtHi, r.x, r.y, 6, 3, 2)
  stipple(g, C.crtHi, r.x, r.y, 3, 6, 2)
}

function label(g: G, s: string, x: number, y: number): void {
  text(g, s, x, y, C.face)
}

// ---------------------------------------------------------------- the left screen

const MENU = ['1 BREAK+ATTACK', '2 FORM ON ME', '3 HELP ME OUT', '4 TAUNT', '5 REQUEST LAND']

export function menuRect(l: Layout, i: number): Rect {
  const r = l.left
  return { x: r.x, y: r.y + 3 + i * 10, w: r.w, h: 10 }
}

function leftScreen(g: G, l: Layout, w: Voyage, mon: Monitor, menu: boolean, frameNo: number): void {
  const r = l.left
  bezel(g, r)
  clipTo(g, r, () => {
    if (menu) {
      text(g, 'CB 19', r.x + 3, r.y + 2, C.phosphorLo)
      for (let i = 0; i < MENU.length; i++) {
        const lit = i < 4 || autoGoal(w) === 'land'
        const s = r.w < 90 ? MENU[i]!.replace('BREAK+ATTACK', 'ATTACK').replace('REQUEST LAND', 'LAND').replace('FORM ON ME', 'FORM UP') : MENU[i]!
        text(g, s, r.x + 3, r.y + 12 + i * 9, lit ? C.phosphor : C.phosphorLo)
      }
      return
    }
    if (mon.speaking && mon.who) {
      const img = picture(mon.portrait)
      const size = Math.min(r.h - 2, 52)
      if (img) {
        // The face, 1:1, cropped to the screen: the portrait's upper middle.
        const sx = Math.max(0, Math.floor((img.width - size) / 2) - 2)
        const sy = Math.max(0, Math.floor((img.height - size) / 3))
        if (mon.cutsIn) {
          for (let y = 0; y < size; y++) {
            const tear = (frameNo + y * 7) % 13 === 0 ? ((frameNo >> 1) % 5) - 2 : 0
            g.drawImage(img, sx, sy + y, size, 1, r.x + 1 + tear, r.y + 1 + y, size, 1)
          }
        } else {
          g.drawImage(img, sx, sy, size, size, r.x + 1, r.y + 1, size, size)
        }
      } else {
        rect(g, C.crtHi, r.x + 1, r.y + 1, size, size)
        textC(g, mon.name.slice(0, 2), r.x + 1 + size / 2, r.y + size / 2 - 3, C.phosphor)
      }
      // The signal: bars beside the face while the line types.
      const bx = r.x + size + 4
      for (let i = 0; i < 4; i++) {
        const h = mon.chars < mon.text.length ? 2 + ((hash(frameNo >> 2, i) % 9)) : 2
        rect(g, C.phosphorLo, bx + i * 3, r.y + r.h - 12 - h, 2, h)
      }
      // The name plate across the foot.
      rect(g, C.crt, r.x, r.y + r.h - 9, r.w, 9)
      text(g, mon.name, r.x + 2, r.y + r.h - 8, mon.cutsIn ? C.red : C.phosphor)
    } else {
      damage(g, l, w)
    }
    glass(g, r)
  })
}

/** The damage display: the Calzone from above, its shields front and back, armour on four sides. */
function damage(g: G, l: Layout, w: Voyage): void {
  const r = l.left
  const me = calzone(w)
  text(g, 'DAMAGE', r.x + 3, r.y + 2, C.phosphorLo)
  if (!me) return
  const c = condition(me)
  const cx = r.x + Math.floor(r.w / 2), cy = r.y + Math.floor(r.h / 2) + 3
  const tone = (f: number): string => (f > 0.66 ? C.phosphor : f > 0.33 ? C.amber : f > 0 ? C.red : C.redLo)
  // The ship: a fat dart from above.
  const hull = C.phosphorLo
  line(g, hull, cx, cy - 12, cx - 4, cy - 4); line(g, hull, cx, cy - 12, cx + 4, cy - 4)
  line(g, hull, cx - 4, cy - 4, cx - 4, cy + 9); line(g, hull, cx + 4, cy - 4, cx + 4, cy + 9)
  line(g, hull, cx - 4, cy + 9, cx - 8, cy + 13); line(g, hull, cx + 4, cy + 9, cx + 8, cy + 13)
  line(g, hull, cx - 4, cy + 9, cx + 4, cy + 9)
  ring(g, hull, cx, cy + 5, 2)
  // Armour: a bar on each side.
  rect(g, tone(c.af), cx - 5, cy - 17, 11, 2)
  rect(g, tone(c.ab), cx - 5, cy + 16, 11, 2)
  rect(g, tone(c.al), cx - 12, cy - 6, 2, 13)
  rect(g, tone(c.ar), cx + 11, cy - 6, 2, 13)
  // Shields: arcs in front and behind, dotted as they weaken.
  for (let i = -6; i <= 6; i++) {
    const a = (i / 6) * 0.9
    const fx = cx + Math.round(Math.sin(a) * 20), fy = cy - Math.round(Math.cos(a) * 20)
    const bx = cx + Math.round(Math.sin(a) * 20), by = cy + Math.round(Math.cos(a) * 20) + 2
    if (c.sf > (i + 6) / 13) rect(g, C.shield, fx, fy, 1, 1)
    else rect(g, C.shieldLo, fx, fy, 1, 1)
    if (c.sb > (i + 6) / 13) rect(g, C.shield, bx, by, 1, 1)
    else rect(g, C.shieldLo, bx, by, 1, 1)
  }
  const core = Math.max(0, Math.round(c.core * 100))
  text(g, String(core), r.x + r.w - 4 - String(core).length * 6, r.y + r.h - 9, tone(c.core))
}

// ---------------------------------------------------------------- the radar

const REL = v3()
const LOC = v3()

function radar(g: G, l: Layout, w: Voyage, frameNo: number): void {
  const { cx, cy, r } = l.radar
  disc(g, C.bezelLo, cx, cy, r + 2)
  disc(g, C.bezel, cx - 1, cy - 1, r + 1)
  disc(g, C.crt, cx, cy, r)
  ring(g, C.phosphorLo, cx, cy, Math.round(r / 2), 2)
  ring(g, C.phosphorLo, cx, cy, r - 1, 3)
  line(g, C.crtHi, cx - r + 2, cy, cx + r - 2, cy, 1)
  line(g, C.crtHi, cx, cy - r + 2, cx, cy + r - 2, 1)
  const me = calzone(w)
  if (!me) return
  const put = (p: { x: number; y: number; z: number }, c: string, big: boolean): void => {
    subTo(REL, p, me.pos)
    const d = Math.hypot(REL.x, REL.y, REL.z)
    if (d < 1) return
    unrotateTo(LOC, me.q, REL)
    // Off the nose by angle: 0 in the middle, 90 degrees on the inner ring, behind on the rim.
    const ang = Math.acos(Math.max(-1, Math.min(1, -LOC.z / d)))
    const rr = (ang / Math.PI) * (r - 2)
    const az = Math.atan2(LOC.y, LOC.x)
    const x = cx + Math.round(Math.cos(az) * rr)
    const y = cy - Math.round(Math.sin(az) * rr)
    if (big) rect(g, c, x - 1, y - 1, 3, 3)
    else rect(g, c, x, y, 2, 2)
  }
  const nav = w.mission.navs[w.mission.nav]
  if (nav && w.mission.stage === 'fly') {
    subTo(REL, nav.pos, me.pos)
    put(nav.pos, C.text, false)
  }
  for (const s of w.ships) {
    if (!live(s) || s.id === me.id) continue
    if (Math.hypot(s.pos.x - me.pos.x, s.pos.y - me.pos.y, s.pos.z - me.pos.z) > 12000) continue
    const big = SHIPS[s.kind].capital === true
    const c = s.side === 'us' ? (big ? '#bfe4ff' : C.friend) : big ? C.big : C.enemy
    const targeted = s.id === me.target
    if (targeted && (frameNo >> 3) % 2) continue
    put(s.pos, c, big || targeted)
  }
  for (const m of w.missiles) put(m.pos, C.gold, false)
  void forwardTo; void rightTo; void upTo
}

// ---------------------------------------------------------------- the right screen

const FACES: Partial<Record<string, string>> = {
  rat: '/voyagers2/face-rat.png', bear: '/voyagers2/face-bear.png', gorilla: '/voyagers2/face-gorilla.png',
  hound: '/voyagers2/face-hound.png', parmesan: '/voyagers2/face-lion.png',
}

function rightScreen(g: G, l: Layout, w: Voyage): void {
  const r = l.right
  bezel(g, r)
  const me = calzone(w)
  clipTo(g, r, () => {
    const t = me ? shipAt(w, w.seat === 'front' ? me.target : w.crew.target) : null
    if (me && live(t)) {
      const c = t.side === 'us' ? C.friend : SHIPS[t.kind].capital ? C.big : C.enemy
      // The pilot's face, for the Franchise's mascots: Wing Commander showed who you were fighting.
      const face = FACES[t.kind]
      const img = face ? picture(face) : null
      if (img && r.w > 60) g.drawImage(img, r.x + r.w - img.width - 3, r.y + 3)
      text(g, t.name.slice(0, Math.floor((r.w - 4) / 6)), r.x + 2, r.y + 2, c)
      const d = Math.hypot(t.pos.x - me.pos.x, t.pos.y - me.pos.y, t.pos.z - me.pos.z)
      text(g, d >= 1000 ? (d / 1000).toFixed(1) + ' KM' : Math.round(d) + ' M', r.x + 2, r.y + 11, C.phosphor)
      const k = condition(t)
      bar(g, 'SH', r.x + 2, r.y + r.h - 22, r.w - 4, (k.sf + k.sb) / 2, C.shield, C.shieldLo)
      bar(g, 'AR', r.x + 2, r.y + r.h - 12, r.w - 4, (k.af + k.ab + k.al + k.ar + k.core) / 5, C.armour, C.armourLo)
      if (t.ai && r.h > 44) text(g, t.ai.mode.toUpperCase(), r.x + 2, r.y + 20, C.phosphorLo)
    } else {
      const nav = w.mission.navs[w.mission.nav]
      text(g, 'NAV', r.x + 2, r.y + 2, C.phosphorLo)
      // Nothing targeted: the screen shows the shop's own slice beside the way to go.
      const slice = picture('/voyagers2/face-slice.png')
      if (slice && r.w > 60) g.drawImage(slice, r.x + r.w - slice.width - 3, r.y + 3)
      if (nav && me) {
        text(g, nav.name.slice(0, Math.floor((r.w - 4) / 6)), r.x + 2, r.y + 11, C.phosphor)
        const d = Math.hypot(nav.pos.x - me.pos.x, nav.pos.y - me.pos.y, nav.pos.z - me.pos.z)
        text(g, (d / 1000).toFixed(1) + ' KM', r.x + 2, r.y + 20, C.phosphor)
      }
      const goal = autoGoal(w)
      if (goal !== 'none') text(g, goal === 'land' ? 'LAND: N' : 'AUTO: N', r.x + 2, r.y + r.h - 10, C.amber)
    }
    glass(g, r)
  })
}

function bar(g: G, name: string, x: number, y: number, w: number, f: number, c: string, lo: string): void {
  text(g, name, x, y, C.phosphorLo)
  const bx = x + 14, bw = w - 14
  rect(g, lo, bx, y + 2, bw, 3)
  rect(g, c, bx, y + 2, Math.round(bw * Math.max(0, Math.min(1, f))), 3)
}

// ---------------------------------------------------------------- gauges

function gauges(g: G, l: Layout, w: Voyage, frameNo: number): void {
  const me = calzone(w)
  const gs = l.gauges
  const k = me ? SHIPS[me.kind] : null
  // A wide screen's gauges are short rows: the label beside the value, not over it.
  const row = (r: Rect): boolean => r.h < 24
  // Speed: amber digits and a bar.
  {
    const r = gs.speed
    const v = me ? Math.round(me.speed) : 0
    const c = me?.burning ? C.gold : C.amber
    if (row(r)) {
      label(g, 'SPD', r.x, r.y + 2)
      nixies(g, String(v).padStart(3, '0'), r.x + 22, r.y, c)
      if (k) bar1(g, r.x + 48, r.y + 4, r.w - 48, Math.min(1, v / k.burn), c)
    } else {
      label(g, 'SPD', r.x, r.y)
      nixies(g, String(v).padStart(3, '0'), r.x, r.y + 9, c)
      if (k) bar1(g, r.x, r.y + r.h - 4, r.w, Math.min(1, v / k.burn), c)
    }
  }
  // Guns: the capacitor as a VU meter of segments.
  {
    const r = gs.guns
    const x0 = row(r) ? r.x + 22 : r.x
    const y0 = row(r) ? r.y + 1 : r.y + 10
    const h = row(r) ? Math.min(9, r.h - 2) : Math.max(4, r.h - 14)
    label(g, 'GUN', r.x, row(r) ? r.y + 2 : r.y)
    const segs = Math.max(4, Math.floor((r.x + r.w - x0) / 4))
    const lit = me ? Math.round(me.energy * segs) : 0
    for (let i = 0; i < segs; i++) {
      const on = i < lit
      const c = i >= segs - 2 ? (on ? C.red : C.redLo) : i >= segs - 4 ? (on ? C.amber : C.amberLo) : on ? C.green : C.greenLo
      rect(g, c, x0 + i * 4, y0, 3, h)
    }
  }
  // Afterburner fuel: five valves.
  {
    const r = gs.burn
    label(g, 'BURN', r.x, row(r) ? r.y + 2 : r.y)
    const lit = me ? Math.ceil(me.fuel * 5 - 0.01) : 0
    for (let i = 0; i < 5; i++) {
      const x = (row(r) ? r.x + 28 : r.x + 1) + i * 6, y = row(r) ? r.y : r.y + 10
      rect(g, C.bakelite, x, y, 5, 9)
      rect(g, i < lit ? C.orange : C.lampOff, x + 1, y + 1, 3, 6)
      if (i < lit) rect(g, C.gold, x + 2, y + 2, 1, 2)
    }
  }
  // Missiles: nixie digits.
  {
    const r = gs.msl
    const c = me && me.lock >= 1 ? C.red : C.amber
    // A big ship targeted with torpedoes on the rack: the gauge counts the torpedoes.
    const tg = me ? shipAt(w, me.target) : null
    const torp = !!me && me.torps > 0 && live(tg) && SHIPS[tg.kind].capital === true
    const name = torp ? 'TRP' : 'MSL'
    const n = String(me ? (torp ? me.torps : me.missiles) : 0)
    if (row(r)) { label(g, name, r.x, r.y + 2); nixies(g, n, r.x + 22, r.y, c) } else { label(g, name, r.x, r.y); nixies(g, n, r.x, r.y + 9, c) }
  }
  // The lamps.
  const goal = autoGoal(w)
  lamp(g, gs.auto, goal === 'land' ? 'LND' : 'AUT', goal !== 'none', C.green, frameNo)
  const locked = !!me && (w.missiles.some(m => m.target === me.id) || w.ships.some(s => live(s) && s.side !== me.side && s.target === me.id && s.lock > 0.5))
  lamp(g, gs.lock, 'MSL', locked && (frameNo >> 3) % 2 === 0, C.red, frameNo)
  // The seats: who sits where; the player's name lit. Tap (or X) to change.
  {
    const r = gs.seats
    const pf = w.seat === 'front'
    text(g, 'F ' + w.front.toUpperCase(), r.x, r.y, pf ? C.gold : C.face)
    text(g, 'B ' + w.back.toUpperCase(), r.x, r.y + 9, pf ? C.face : C.gold)
    if (r.h > 24) text(g, l.touch ? 'SWAP' : 'X SWAP', r.x, r.y + r.h - 8, C.face)
  }
}

function bar1(g: G, x: number, y: number, w: number, f: number, c: string): void {
  rect(g, C.bakelite, x, y, w, 3)
  rect(g, c, x, y, Math.round(w * f), 3)
}

function nixies(g: G, s: string, x: number, y: number, c: string): void {
  for (let i = 0; i < s.length; i++) {
    rect(g, C.bakelite, x + i * 8, y, 7, 11)
    text(g, s[i]!, x + i * 8 + 1, y + 2, c)
  }
}

function lamp(g: G, r: Rect, name: string, on: boolean, colour: string, _frameNo: number): void {
  if (r.h < 24) {
    // Beside: the lamp on the left, its name to the right.
    const cy = r.y + 6
    disc(g, C.bezelLo, r.x + 6, cy, 5)
    disc(g, on ? colour : C.lampOff, r.x + 6, cy, 4)
    if (on) rect(g, C.text, r.x + 4, cy - 2, 2, 2)
    text(g, name, r.x + 14, cy - 3, C.face)
    return
  }
  const cx = r.x + Math.floor(r.w / 2)
  disc(g, C.bezelLo, cx, r.y + 7, 6)
  disc(g, on ? colour : C.lampOff, cx, r.y + 7, 5)
  if (on) rect(g, C.text, cx - 2, r.y + 4, 2, 2)
  textC(g, name, cx, r.y + 15, C.face)
}

// ---------------------------------------------------------------- all of it

export function drawDash(g: G, l: Layout, w: Voyage, mon: Monitor, menu: boolean, frameNo: number): void {
  g.drawImage(woodPanel(l), 0, l.dash.y)
  leftScreen(g, l, w, mon, menu, frameNo)
  radar(g, l, w, frameNo)
  rightScreen(g, l, w)
  gauges(g, l, w, frameNo)
  // Rivets at the dashboard's corners.
  for (const [x, y] of [[2, l.dash.y + 6], [l.W - 4, l.dash.y + 6]] as [number, number][]) {
    rect(g, C.bezelLo, x, y, 2, 2)
    rect(g, C.bezelHi, x, y, 1, 1)
  }
  void frame
}
