/**
 * Space Voyagers II: what is drawn over the view, in logical pixels: the
 * canopy struts, the gunsight, the target's brackets and its lead diamond,
 * the lock closing in, arrows to what is off screen, the nav cross, the
 * speed dust, the subtitles and the effects (sparks, shield flashes,
 * explosions). Whole pixels, flat colours, no blending (DESIGN.md, "The
 * picture", "The cockpit").
 */
import * as THREE from 'three'
import { GUN, SHIPS } from '../engine/balance'
import { leadTo } from '../engine/math'
import type { V3 } from '../engine/math'
import { calzoneTurret } from '../engine/seats'
import { live, shipAt } from '../engine/ships'
import type { Ship } from '../engine/types'
import { calzone } from '../engine/world'
import type { Voyage } from '../engine/world'
import type { Monitor } from '../story/director'
import { rows } from '../story/director'
import type { Layout, Rect } from './layout'
import { picture } from './dash'
import { visScale } from './models'
import { C } from './palette'
import { disc, frame, line, rect, ring, text, textC } from './pix'
import type { G } from './pix'

const P = new THREE.Vector3()
const CAMSPACE = new THREE.Vector3()

export interface Projected { x: number; y: number; ahead: boolean; dist: number }

/** A world point onto the view (logical pixels). `ahead` false when it is behind the camera. */
export function project(l: Layout, cam: THREE.PerspectiveCamera, p: V3, out: Projected = { x: 0, y: 0, ahead: false, dist: 0 }): Projected {
  CAMSPACE.set(p.x, p.y, p.z).applyMatrix4(cam.matrixWorldInverse)
  out.ahead = CAMSPACE.z < -0.5
  out.dist = CAMSPACE.length()
  P.set(p.x, p.y, p.z).project(cam)
  out.x = l.view.x + ((P.x + 1) / 2) * l.view.w
  out.y = l.view.y + ((1 - P.y) / 2) * l.view.h
  if (!out.ahead) {
    // Behind: mirror, so an arrow points the right way round.
    out.x = l.view.x + l.view.w - (out.x - l.view.x)
    out.y = l.view.y + l.view.h - (out.y - l.view.y)
  }
  return out
}

/** How many logical pixels a metre is at a distance. */
export function pxPerMetre(l: Layout, cam: THREE.PerspectiveCamera, dist: number): number {
  const focal = l.view.h / (2 * Math.tan((cam.fov * Math.PI) / 360))
  return focal / Math.max(1, dist)
}

// ---------------------------------------------------------------- effects

interface Fx { kind: 'spark' | 'shield' | 'boom' | 'word' | 'head'; x: number; y: number; z: number; age: number; life: number; r: number; text?: string; colour?: string }
const fxs: Fx[] = []
export function addFx(f: Omit<Fx, 'age'>): void {
  // One shield ring a ship at a time: a new hit starts it again.
  if (f.kind === 'shield') {
    const old = fxs.find(o => o.kind === 'shield' && Math.abs(o.x - f.x) < 1 && Math.abs(o.y - f.y) < 1 && Math.abs(o.z - f.z) < 1)
    if (old) { old.age = 0; return }
  }
  if (fxs.length > 120) fxs.shift()
  fxs.push({ ...f, age: 0 })
}

/**
 * A ragged starburst of whole pixels: spikes of different lengths round a
 * small core, the same shape for the same seed. The light tone inside, the
 * darker at the tips. No disc, no blending.
 */
function burst(g: G, x: number, y: number, r: number, seed: number, inner: string, outer: string): void {
  const n = 9
  const s0 = Math.abs(Math.floor(seed * 7.3)) % 997
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + ((s0 * (i + 3)) % 17) * 0.05
    const len = r * (0.45 + (((s0 * 31 + i * 57) % 23) / 23) * 0.65)
    const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len
    line(g, outer, x, y, ex, ey)
    line(g, inner, x, y, x + Math.cos(a) * len * 0.55, y + Math.sin(a) * len * 0.55)
  }
  disc(g, inner, x, y, Math.max(1, Math.round(r * 0.22)))
}
export function clearFx(): void { fxs.length = 0 }

// ---------------------------------------------------------------- speed dust

interface Mote { p: THREE.Vector3 }
const motes: Mote[] = []
let moteSeed = 1
function rnd(): number {
  moteSeed = (moteSeed * 1103515245 + 12345) & 0x7fffffff
  return moteSeed / 0x7fffffff
}

function dust(g: G, l: Layout, cam: THREE.PerspectiveCamera, vel: V3, colour: string): void {
  const camPos = cam.position
  const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion)
  if (motes.length === 0) for (let i = 0; i < 36; i++) motes.push({ p: new THREE.Vector3() })
  const pr: Projected = { x: 0, y: 0, ahead: false, dist: 0 }
  const pr2: Projected = { x: 0, y: 0, ahead: false, dist: 0 }
  for (const m of motes) {
    const d = m.p.distanceTo(camPos)
    CAMSPACE.copy(m.p).sub(camPos)
    if (d > 110 || d < 2 || CAMSPACE.dot(fwd) < -20) {
      // A new mote somewhere ahead of the camera.
      m.p.set(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(160).add(camPos).addScaledVector(fwd, 40 + rnd() * 50)
    }
    project(l, cam, m.p, pr)
    if (!pr.ahead) continue
    const back = { x: m.p.x + vel.x * 0.045, y: m.p.y + vel.y * 0.045, z: m.p.z + vel.z * 0.045 }
    project(l, cam, back, pr2)
    if (!pr2.ahead) continue
    if (pr.x < l.view.x || pr.x >= l.view.x + l.view.w || pr.y < l.view.y || pr.y >= l.view.y + l.view.h) continue
    line(g, colour, pr.x, pr.y, pr2.x, pr2.y)
  }
}

// ---------------------------------------------------------------- marks

/** Four corner brackets round a box. */
function brackets(g: G, c: string, cx: number, cy: number, half: number, arm = 3): void {
  const x0 = Math.round(cx - half), x1 = Math.round(cx + half), y0 = Math.round(cy - half), y1 = Math.round(cy + half)
  rect(g, c, x0, y0, arm, 1); rect(g, c, x0, y0, 1, arm)
  rect(g, c, x1 - arm + 1, y0, arm, 1); rect(g, c, x1, y0, 1, arm)
  rect(g, c, x0, y1, arm, 1); rect(g, c, x0, y1 - arm + 1, 1, arm)
  rect(g, c, x1 - arm + 1, y1, arm, 1); rect(g, c, x1, y1 - arm + 1, 1, arm)
}

function diamond(g: G, c: string, x: number, y: number, r: number): void {
  const cx = Math.round(x), cy = Math.round(y)
  line(g, c, cx - r, cy, cx, cy - r)
  line(g, c, cx, cy - r, cx + r, cy)
  line(g, c, cx + r, cy, cx, cy + r)
  line(g, c, cx, cy + r, cx - r, cy)
}

/** An arrow at the view's edge towards a point that is off it. */
function edgeArrow(g: G, l: Layout, c: string, x: number, y: number): void {
  const v = l.view
  const cx = v.x + v.w / 2, cy = v.y + v.h / 2
  let dx = x - cx, dy = y - cy
  const len = Math.hypot(dx, dy) || 1
  dx /= len; dy /= len
  const mx = v.w / 2 - 10, my = v.h / 2 - 10
  const k = Math.min(Math.abs(dx) > 1e-6 ? mx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-6 ? my / Math.abs(dy) : Infinity)
  const ax = cx + dx * k, ay = cy + dy * k
  // A small filled triangle pointing outwards.
  const px = -dy, py = dx
  for (let i = 0; i < 5; i++) {
    const w = 4 - i * 0.8
    line(g, c, ax - dx * i + px * w, ay - dy * i + py * w, ax - dx * i - px * w, ay - dy * i - py * w)
  }
}

const sideColour = (s: Ship): string => (s.side === 'us' ? C.friend : SHIPS[s.kind].capital ? C.big : C.enemy)

function onView(l: Layout, p: Projected, margin = 0): boolean {
  const v = l.view
  return p.ahead && p.x >= v.x + margin && p.x < v.x + v.w - margin && p.y >= v.y + margin && p.y < v.y + v.h - margin
}

const LEAD = { x: 0, y: 0, z: 0 }
const SCRATCH = { x: 0, y: 0, z: 0 }

export interface HudState {
  /** The comms menu is open (keys: C; touch: the left screen). */
  menu: boolean
  /** Touch: the stick's centre and knob, or null. */
  stick: { x: number; y: number; kx: number; ky: number } | null
  /** Touch: buttons held. */
  fire: boolean
  burn: boolean
  paused: boolean
  reduced: boolean
}

export function drawHud(g: G, l: Layout, w: Voyage, cam: THREE.PerspectiveCamera, view: 'front' | 'back' | 'outside', mon: Monitor, ui: HudState, frameNo: number, dustColour: string): void {
  const me = calzone(w)
  const v = l.view
  const pr: Projected = { x: 0, y: 0, ahead: false, dist: 0 }
  if (me && live(me) && view !== 'outside') dust(g, l, cam, me.vel, dustColour)

  // Effects first (under the marks).
  for (let i = fxs.length - 1; i >= 0; i--) {
    const f = fxs[i]!
    f.age++
    if (f.age > f.life) { fxs.splice(i, 1); continue }
    SCRATCH.x = f.x; SCRATCH.y = f.y; SCRATCH.z = f.z
    project(l, cam, SCRATCH, pr)
    if (!onView(l, pr, -20)) continue
    const k = pxPerMetre(l, cam, pr.dist)
    const t = f.age / f.life
    if (f.kind === 'spark') {
      const c = f.age < 3 ? C.text : C.gold
      const s = 1 + (f.age >> 1)
      rect(g, c, pr.x - s, pr.y, s * 2 + 1, 1)
      rect(g, c, pr.x, pr.y - s, 1, s * 2 + 1)
    } else if (f.kind === 'shield') {
      const r = Math.max(4, f.r * k * 1.15)
      ring(g, f.age < 4 ? C.shield : C.shieldLo, pr.x, pr.y, r, f.age < 4 ? 0 : 2, f.age)
    } else if (f.kind === 'boom') {
      const r = Math.max(3, f.r * k)
      if (f.age < 3) burst(g, pr.x, pr.y, r * (0.5 + f.age * 0.2), f.x + f.z, C.text, C.gold)
      else if (f.age < 12) burst(g, pr.x, pr.y, r * (0.7 + f.age * 0.03), f.x + f.z + f.age, f.age < 7 ? C.gold : C.orange, f.age < 7 ? C.orange : C.red)
      if (f.age > 2) ring(g, t < 0.5 ? C.gold : C.orange, pr.x, pr.y, Math.round(r * (0.8 + t * 1.4)), t < 0.4 ? 0 : 2, f.age)
    } else if (f.kind === 'head' && f.text) {
      // A mascot's head on its spring, popped off: it rises and bobs, drawn 1:1.
      const img = picture(f.text)
      if (img && pr.dist < 1800) {
        const bob = Math.round(Math.sin(f.age / 4) * 3 * (1 - t))
        g.drawImage(img, Math.round(pr.x - img.width / 2 + bob), Math.round(pr.y - img.height / 2 - f.age / 3))
      }
    } else if (f.kind === 'word' && f.text) {
      textC(g, f.text, pr.x, pr.y - 10 - f.age / 4, f.colour ?? C.gold, '#120d18')
    }
  }

  if (!me || !live(me) || view === 'outside') {
    drawSub(g, l, mon, frameNo)
    return
  }

  // Canopy struts (front seat) or the bubble's rim (back seat).
  if (view === 'front') {
    const sx = Math.round(v.w * 0.16)
    line(g, C.bakelite, v.x, v.y + sx, v.x + sx, v.y)
    line(g, C.bakelite, v.x, v.y + sx + 1, v.x + sx + 1, v.y)
    line(g, C.bakeliteHi, v.x, v.y + sx + 2, v.x + sx + 2, v.y)
    line(g, C.bakelite, v.x + v.w - 1, v.y + sx, v.x + v.w - 1 - sx, v.y)
    line(g, C.bakelite, v.x + v.w - 1, v.y + sx + 1, v.x + v.w - 2 - sx, v.y)
    line(g, C.bakeliteHi, v.x + v.w - 1, v.y + sx + 2, v.x + v.w - 3 - sx, v.y)
  }

  const cx = Math.round(v.x + v.w / 2), cy = Math.round(v.y + v.h / 2)
  const tgtId = view === 'front' ? me.target : w.crew.target
  const tgt = shipAt(w, tgtId)

  // Every other fighter in view gets a small mark, so a phone can find them.
  for (const s of w.ships) {
    if (!live(s) || s.id === me.id || s.id === tgtId) continue
    if (SHIPS[s.kind].capital) continue
    project(l, cam, s.pos, pr)
    if (!onView(l, pr, 2) || pr.dist > 6000) continue
    const c = s.side === 'us' ? C.blueLo : C.enemyLo
    rect(g, c, pr.x - 3, pr.y - 3, 2, 1); rect(g, c, pr.x + 2, pr.y - 3, 2, 1)
    rect(g, c, pr.x - 3, pr.y + 3, 2, 1); rect(g, c, pr.x + 2, pr.y + 3, 2, 1)
  }

  // The nav point.
  const nav = w.mission.navs[w.mission.nav]
  if (nav && w.mission.stage === 'fly') {
    project(l, cam, nav.pos, pr)
    if (onView(l, pr, 6)) {
      rect(g, C.nav, pr.x - 3, pr.y, 7, 1)
      rect(g, C.nav, pr.x, pr.y - 3, 1, 7)
      text(g, nav.name, pr.x + 5, pr.y + 3, C.textDim, '#120d18')
    } else if (!tgt) edgeArrow(g, l, C.textDim, pr.x, pr.y)
  }

  // The target: brackets, the lead diamond, the lock.
  let onDiamond = false
  if (live(tgt)) {
    const c = sideColour(tgt)
    project(l, cam, tgt.pos, pr)
    if (onView(l, pr, 4)) {
      const half = Math.max(5, Math.min(48, tgt.r * visScale(SHIPS[tgt.kind].capital === true) * pxPerMetre(l, cam, pr.dist) * 0.75))
      brackets(g, c, pr.x, pr.y, half, half > 10 ? 4 : 3)
      const km = pr.dist >= 1000 ? (pr.dist / 1000).toFixed(1) + 'K' : String(Math.round(pr.dist))
      text(g, km, pr.x - half, pr.y + half + 3, c, '#120d18')
      if (tgt.side === 'them') {
        // The lead diamond: where to aim (the guns of the seat the player is in).
        const from = view === 'front' ? me.pos : turretWorldPos(me)
        const speed = view === 'front' ? GUN.speed : GUN.turretSpeed
        SCRATCH.x = me.vel.x * GUN.inherit; SCRATCH.y = me.vel.y * GUN.inherit; SCRATCH.z = me.vel.z * GUN.inherit
        const t = leadTo(LEAD, from, SCRATCH, tgt.pos, tgt.vel, speed)
        if (t > 0 && pr.dist < 3200) {
          const lp: Projected = { x: 0, y: 0, ahead: false, dist: 0 }
          project(l, cam, LEAD, lp)
          if (onView(l, lp, 2)) {
            diamond(g, C.lead, lp.x, lp.y, 3)
            const assist = ui.stick ? GUN.assistTouch : GUN.assistKeys
            const focal = l.view.h / (2 * Math.tan((cam.fov * Math.PI) / 360))
            onDiamond = Math.hypot(lp.x - cx, lp.y - cy) < Math.tan(assist) * focal + 1
          }
        }
        // The lock: brackets that close from twice the size to the target's.
        if (view === 'front' && me.lock > 0) {
          const k = me.lock >= 1 ? 1 : 2.2 - me.lock * 1.2
          const lc = me.lock >= 1 ? C.lock : (frameNo >> 2) % 2 ? C.lock : C.redLo
          brackets(g, lc, pr.x, pr.y, half * k + 2, 2)
          const torp = me.torps > 0 && SHIPS[tgt.kind].capital === true
          if (me.lock >= 1) textC(g, torp ? 'TORPEDO' : 'LOCK', pr.x, pr.y - half - 11, C.lock, '#120d18')
          else if (torp) textC(g, 'HOLD ' + Math.ceil((1 - me.lock) * 5), pr.x, pr.y - half - 11, C.gold, '#120d18')
        }
      }
    } else {
      edgeArrow(g, l, c, pr.x, pr.y)
    }
  }

  // The sight.
  const sc = onDiamond ? C.gold : C.sight
  if (view === 'front') {
    rect(g, sc, cx - 6, cy, 4, 1); rect(g, sc, cx + 3, cy, 4, 1)
    rect(g, sc, cx, cy - 6, 1, 4); rect(g, sc, cx, cy + 3, 1, 4)
    rect(g, sc, cx, cy, 1, 1)
  } else {
    bubbleFrame(g, l)
    ring(g, sc, cx, cy, 7)
    ring(g, C.textLo, cx, cy, 14, 3)
    rect(g, sc, cx, cy, 1, 1)
    text(g, 'TURRET', v.x + 24, v.y + 4, C.textDim, '#120d18')
  }

  // Incoming: a missile on its way to us.
  const homing = w.missiles.some(m => m.target === me.id && m.side !== me.side)
  if (homing && (frameNo >> 3) % 2 === 0) textC(g, 'MISSILE', cx, cy + 22, C.red, '#120d18')

  // Changing seats.
  if (w.crew.swapping > 0) textC(g, 'CHANGING SEATS', cx, cy - 26, C.gold, '#120d18')

  drawSub(g, l, mon, frameNo)
  if (ui.stick) drawStick(g, ui.stick)
  if (l.buttons) drawButtons(g, l, w, ui)
}

function turretWorldPos(me: Ship): V3 {
  const t = calzoneTurret(me)
  if (!t) return me.pos
  const q = new THREE.Quaternion(me.q.x, me.q.y, me.q.z, me.q.w)
  const v = new THREE.Vector3(t.at.x, t.at.y, t.at.z).applyQuaternion(q)
  return { x: me.pos.x + v.x, y: me.pos.y + v.y, z: me.pos.z + v.z }
}

/** The line being said, at the foot of the view: the name, then the rows typing out. */
function drawSub(g: G, l: Layout, mon: Monitor, frameNo: number): void {
  if (!mon.speaking) return
  const s = l.sub
  const rs = rows(mon.shown, s.chars).slice(0, 4)
  const all = rows(mon.text, s.chars).slice(0, 4)
  const top = s.y + s.h - all.length * 9 - 10
  const nameC = mon.cutsIn ? C.red : C.gold
  text(g, mon.name, s.x + 2, top, nameC, '#120d18')
  for (let i = 0; i < rs.length; i++) {
    const shake = mon.cutsIn && (frameNo + i * 3) % 11 === 0 ? 1 : 0
    text(g, rs[i]!, s.x + 2 + shake, top + 9 + i * 9, C.text, '#120d18')
  }
}

/** The gunner sits in a glass bubble: its frame, two ribs over the top and a rim at the foot of the view. */
function bubbleFrame(g: G, l: Layout): void {
  const v = l.view
  const cx = v.x + v.w / 2
  const rx = v.w * 0.62, ry = v.h * 0.75
  // Two ribs curving over the bubble.
  for (const side of [-1, 1]) {
    let px = cx + side * rx, py = v.y + v.h
    for (let i = 1; i <= 24; i++) {
      const a = (i / 24) * (Math.PI / 2)
      const x = cx + side * Math.cos(a) * rx * 0.55 + side * rx * 0.45 * (1 - i / 24)
      const y = v.y + v.h - Math.sin(a) * ry
      line(g, C.bakelite, px, py, x, y)
      line(g, C.bakeliteHi, px - side, py, x - side, y)
      px = x; py = y
    }
  }
  // The rim: the bubble's steel ring, with the Calzone's tail fins standing past it.
  const rimY = v.y + v.h - 6
  rect(g, C.bezelLo, v.x, rimY, v.w, 6)
  rect(g, C.bezel, v.x, rimY, v.w, 2)
  for (const side of [-1, 1]) {
    const fx = cx + side * v.w * 0.36
    for (let i = 0; i < 18; i++) line(g, i < 2 ? '#ff7a52' : '#8c1e36', fx - side * i * 0.4, rimY - 18 + i, fx + side * (10 - i * 0.3), rimY - 18 + i)
  }
}

function drawStick(g: G, s: { x: number; y: number; kx: number; ky: number }): void {
  ring(g, C.textLo, s.x, s.y, 22, 2)
  ring(g, C.textDim, s.x + s.kx, s.y + s.ky, 7)
  disc(g, C.textLo, s.x + s.kx, s.y + s.ky, 3)
}

function button(g: G, r: Rect, label: string, held: boolean, lit = true): void {
  const face = held ? '#5a2a2c' : '#2a2028'
  rect(g, face, r.x + 1, r.y + 1, r.w - 2, r.h - 2)
  frame(g, held ? C.gold : lit ? C.bezelHi : C.bezelLo, r.x, r.y, r.w, r.h)
  rect(g, C.bezelLo, r.x + 1, r.y + r.h - 2, r.w - 2, 1)
  textC(g, label, r.x + r.w / 2, r.y + Math.floor(r.h / 2) - 3, lit ? (held ? C.gold : C.text) : C.textLo)
}

function drawButtons(g: G, l: Layout, w: Voyage, ui: HudState): void {
  const b = l.buttons!
  const me = calzone(w)
  button(g, b.fire, w.seat === 'back' ? 'FIRE' : 'FIRE', ui.fire)
  const tg = me ? shipAt(w, me.target) : null
  const torp = !!me && me.torps > 0 && live(tg) && SHIPS[tg.kind].capital === true
  const label = torp ? (me!.lock >= 1 ? 'TRP!' : 'TRP') : me && me.lock >= 1 ? 'MSL!' : 'MSL'
  button(g, b.msl, label, false, w.seat === 'front' && !!me && (torp || me.missiles > 0))
  button(g, b.burn, 'BURN', ui.burn, w.seat === 'front')
}
