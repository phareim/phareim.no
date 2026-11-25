#!/usr/bin/env node
// Neon Shrine hero lab: builds the hero's fight and movement poses for the
// isometric view (THE HERO IN A FIGHT in docs/art/codex-tasks.md: H1–H3, H5–H7)
// and writes them as rows of role letters to themes/zelda/render/iso/heroPoses.ts;
// and draws the contact sheet of every pose, iso and classic, no browser needed.
//
//   node scripts/zelda-lab/hero-poses.mjs                     write heroPoses.ts
//   node scripts/zelda-lab/hero-poses.mjs --check             exit 1 if heroPoses.ts is not what this builds
//   node scripts/zelda-lab/hero-poses.mjs sheet <out.png> [look …]
//
// The sheet: per look, a line of the isometric frames from the front
// (`hero_down_<pose>`), one from behind (`hero_up_<pose>`), and the classic
// frames down, up and side under them, every pose of `ART_POSES` and
// `ART_EXTRA_POSES` in a column (a yellow dot: the foot point). A look is
// `drawn`, `girl`, or a shape as hair/head/bottom (`pigtails/bow/dress`);
// without looks: the drawn hero, the girl, long/bow/skirt and short/none/shorts.
// SCALE=<n> sets the zoom (default 4).
//
// How a pose is made: the shirt (with its stripe and belt) is cut from the
// drawn standing body of the same facing (`HERO_BODIES['0/<facing>/trousers']`)
// at the drawing's own grid, moved by whole px (and for the roll turned by
// quarter turns, which loses nothing), and the limbs are laid round it by a
// small rig: a sleeve, a forearm and a fist per arm; a thigh, a shin and the
// drawn sneaker per leg, each part outlined in its role's darkest slot and
// shaded in the role's slots, light on the side the drawing has it. The
// shorts and the skirt are the trousers' recipe with bare shins, and with the
// drawing's pleated hem laid over the hips. An arm that rises past the neck
// goes to `HERO_POSE_ARMS`, which is laid over the head. Nothing is scaled.
//
// The rows it writes can be edited by hand; running this again overwrites them.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const root = resolve(repo, 'themes/zelda')
const OUT = resolve(root, 'render/iso/heroPoses.ts')

const built = esbuild.buildSync({
  stdin: { contents: `export { HERO_BODIES, HERO_LETTERS } from './render/iso/heroArt'`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const A = await import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))
const L = A.HERO_LETTERS

// ---------------------------------------------------------------------------
// A sparse grid of letters in body coordinates (the foot point at 0,0, y up is negative)
// ---------------------------------------------------------------------------

class Grid {
  constructor() { this.m = new Map() }
  get(x, y) { return this.m.get(`${x},${y}`) }
  set(x, y, ch) { if (ch === '.' || ch == null) this.m.delete(`${x},${y}`); else this.m.set(`${x},${y}`, ch) }
  *each() { for (const [k, ch] of this.m) { const [x, y] = k.split(',').map(Number); yield [x, y, ch] } }
  clone() { const g = new Grid(); for (const [k, v] of this.m) g.m.set(k, v); return g }
  /** Another grid laid over this one, moved by dx, dy. */
  lay(o, dx = 0, dy = 0) { for (const [x, y, ch] of o.each()) this.set(x + dx, y + dy, ch); return this }
  /** Quarter turns clockwise about (cx, cy) (screen coordinates: y grows down). */
  turn(q, cx = 0, cy = 0) {
    const g = new Grid()
    for (const [x, y, ch] of this.each()) {
      let u = x - cx, v = y - cy
      for (let i = 0; i < ((q % 4) + 4) % 4; i++) [u, v] = [-v, u]
      g.set(u + cx, v + cy, ch)
    }
    return g
  }
  box() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
    for (const [x, y] of this.each()) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y) }
    return { x0, y0, x1, y1 }
  }
  part(extra = {}) {
    const { x0, y0, x1, y1 } = this.box()
    const rows = []
    for (let y = y0; y <= y1; y++) { let r = ''; for (let x = x0; x <= x1; x++) r += this.get(x, y) ?? '.'; rows.push(r) }
    return { x: x0, y: y0, ...extra, rows }
  }
}

function fromPart(p) {
  const g = new Grid()
  p.rows.forEach((r, y) => [...r].forEach((ch, x) => g.set(p.x + x, p.y + y, ch)))
  return g
}

// ---------------------------------------------------------------------------
// The rig: limbs as capsules, outlined and shaded in a role's slots
// ---------------------------------------------------------------------------

/** Pixels within r of the segment a-b (pixel centres). */
function capsule(a, b, r) {
  const out = []
  const x0 = Math.floor(Math.min(a[0], b[0]) - r - 1), x1 = Math.ceil(Math.max(a[0], b[0]) + r + 1)
  const y0 = Math.floor(Math.min(a[1], b[1]) - r - 1), y1 = Math.ceil(Math.max(a[1], b[1]) + r + 1)
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy || 1
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / l2))
      const ex = px - (a[0] + t * dx), ey = py - (a[1] + t * dy)
      if (ex * ex + ey * ey <= r * r) out.push([x, y])
    }
  }
  return out
}

/**
 * Pixels as one part in a role: the rim in the outline slot, the inside in the role's slots, lighter on the `light`
 * side (+1: right, −1: left). `slots`: [rim, shade, mid, light].
 */
function paintPart(g, px, slots, light) {
  const S = new Set(px.map(([x, y]) => `${x},${y}`))
  const has = (x, y) => S.has(`${x},${y}`)
  for (const [x, y] of px) {
    const rim = !has(x - 1, y) || !has(x + 1, y) || !has(x, y - 1) || !has(x, y + 1)
    let ch
    if (rim) ch = slots[0]
    else if (!has(x + light * 2, y) || !has(x, y + 2)) ch = slots[1]
    else if (!has(x - light * 2, y)) ch = slots[3]
    else ch = slots[2]
    g.set(x, y, ch)
  }
}

const SKIN = [L.skin[0], L.skin[2], L.skin[3], L.skin[3]]
const SLEEVE = [L.top[0], L.top[1], L.top[2], L.top[3]]
const PANTS = [L.bottom[0], L.bottom[1], L.bottom[2], L.bottom[3]]
const SHOE = L.shoes

/** The drawn sneaker, seen from the front (toe toward the viewer) or the back, its middle on the ankle. */
const SNEAKERS = {
  front: ['.KLMMMLK.', 'KKLLLLLKK', '.KKKKKKK.'],
  back: ['.KLLMMK.', 'KKKLLLKK', '.KKKKKK.'],
  /** Seen from below: the sole, for a foot kicked up behind or a heel toward the camera. */
  sole: ['.KKKK.', 'KLLLLK', '.KKKK.'],
}
function sneaker(g, at, kind) {
  const rows = SNEAKERS[kind]
  const ox = Math.round(at[0] - rows[0].length / 2), oy = Math.round(at[1] - 1)
  rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') g.set(ox + x, oy + y, ch) }))
}

/** Which of the legs' pixels a bottom shows as skin: shorts bare the shin, the skirt the whole leg under its hem. */
function leg(g, hip, knee, ankle, bottom, facing, shoe, light) {
  const shinSkin = bottom !== 'trousers'
  const thigh = capsule(hip, knee, 2.7)
  const shin = capsule(knee, ankle, 2.3)
  if (bottom === 'skirt') paintPart(g, thigh, SKIN, light)
  else paintPart(g, thigh, PANTS, light)
  paintPart(g, shin, shinSkin ? SKIN : PANTS, light)
  if (!shinSkin) {
    // One piece of cloth from hip to cuff: no rim across the knee.
    const T = new Set(thigh.map(([x, y]) => `${x},${y}`))
    for (const [x, y] of shin) if (T.has(`${x},${y}`) && g.get(x, y) === PANTS[0]) {
      const inside = [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => g.get(x + dx, y + dy) && 'FGHIJ'.includes(g.get(x + dx, y + dy)))
      if (inside) g.set(x, y, PANTS[2])
    }
  }
  sneaker(g, ankle, shoe ?? facing)
}

/** An arm from the shoulder through the elbow to the fist: a short sleeve, a bare forearm. */
function arm(g, shoulder, elbow, hand, light) {
  const sleeveEnd = [shoulder[0] + (elbow[0] - shoulder[0]) * 0.7, shoulder[1] + (elbow[1] - shoulder[1]) * 0.7]
  paintPart(g, [...capsule(elbow, hand, 1.8)], SKIN, light)
  paintPart(g, capsule(hand, hand, 2.4), SKIN, light)
  paintPart(g, capsule(shoulder, sleeveEnd, 2.4), SLEEVE, light)
}

/** The drawing's pleated hem over the hips: from x0 to x1 at y, `drop` rows long, flaring a px each side half way. */
function skirt(g, x0, x1, y, drop = 5) {
  for (let r = 0; r < drop; r++) {
    const flare = r >= 2 ? 1 : 0
    const a = x0 - flare, b = x1 + flare
    for (let x = a; x <= b; x++) {
      let ch
      if (r === 0 || r === drop - 1 || x === a || x === b) ch = 'F'
      else if (r === 1) ch = 'I'
      else if (r === 2) ch = (x - a) % 3 === 2 ? 'H' : 'I'
      else ch = 'H'
      g.set(x, y + r, ch)
    }
  }
}

// ---------------------------------------------------------------------------
// The drawn shirt of each facing, and where its joints are
// ---------------------------------------------------------------------------

const SHIRT_LETTERS = new Set([...L.top, ...L.stripe, ...L.belt])
function shirt(facing) {
  const src = fromPart(A.HERO_BODIES[`0/${facing}/trousers`])
  const g = new Grid()
  const lastRow = facing === 'front' ? -10 : -9
  for (const [x, y, ch] of src.each()) if (y <= lastRow && SHIRT_LETTERS.has(ch)) g.set(x, y, ch)
  return g
}

/** The stand's joints, read off the drawing (foot point at 0,0). Light: the side the drawing lights. */
const RIG = {
  front: {
    neck: [3, -16], light: 1,
    shoulderL: [-2.5, -13.5], shoulderR: [9.5, -13.5],
    hipL: [-0.5, -8.5], hipR: [5.5, -8],
    footL: [-1.5, -4.5], footR: [5.5, -2.5],
  },
  back: {
    neck: [-5, -16], light: -1,
    shoulderL: [-9, -13], shoulderR: [5.5, -13],
    hipL: [-5, -8], hipR: [1.5, -8.5],
    footL: [-5.5, -2.5], footR: [2.5, -4.5],
  },
}

const add = (p, dx, dy) => [p[0] + dx, p[1] + dy]
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Directions per facing, so one recipe serves the front and the back: `fw` the way the hero faces on screen (both
 * drawings face left: the front down-left, the back up-left), `blade` the side whose hand holds the blade (the far arm
 * from the front, the near one from behind), and the stand's knees, ankles and hands (absolute, foot point at 0,0).
 */
const FACING = {
  front: {
    fw: [-1, 0.5], blade: 'L', off: 'R',
    stand: { kneeL: [-1, -6.5], kneeR: [5.5, -5], ankleL: [-1.5, -4.5], ankleR: [5.5, -2.5], handL: [-3.5, -9], handR: [9.5, -8.5] },
  },
  back: {
    fw: [-1, -0.5], blade: 'R', off: 'L',
    stand: { kneeL: [-5.5, -5], kneeR: [2, -6.5], ankleL: [-5.5, -2.5], ankleR: [2.5, -4.5], handL: [-9, -8], handR: [6.5, -9] },
  },
}

/**
 * A pose of one facing in one bottom. The recipe `p`, in screen px along the facing's own directions (`f` forward,
 * `u` up, `a` across from the blade shoulder to the other, as a fraction):
 *   body: [f, u] hips, shirt and neck moved; lean: [f, u] the shirt, shoulders and neck moved further;
 *   blade / off: the legs: ankle: [f, u] from the stand's ankle (as moved by `body` when `carried`), bend: the knee
 *     pushed forward this much more (or knee: [f, u] from the hip), shoe: 'front' | 'back' | 'sole';
 *   legsFront: the legs drawn over the shirt (knees drawn up to the chest); overLimbs: the legs and the arms in front
 *     laid over the head too (the ball: the knees up in front of the face);
 *   bladeArm / offArm: hand: [a, f, u] from the stand's hand (moved with the shoulders), layer: 'back' (behind the
 *     shirt), 'front' (over it), 'over' (over the head: `HERO_POSE_ARMS`), bend: the elbow pushed back.
 */
function pose(facing, bottom, p) {
  const R = RIG[facing]
  const F = FACING[facing]
  const fw = F.fw
  const mv = (pt, f, u) => [pt[0] + fw[0] * f, pt[1] + fw[1] * f - u]
  const [bf, bu] = p.body ?? [0, 0]
  const [lf, lu] = p.lean ?? [0, 0]
  const body = mv([0, 0], bf, bu)
  const top = mv(body, lf, lu)
  const neck = add(R.neck, ...top)
  const hips = { L: add(R.hipL, ...body), R: add(R.hipR, ...body) }
  const shoulders = { L: add(R.shoulderL, ...top), R: add(R.shoulderR, ...top) }
  const across = [shoulders[F.off][0] - shoulders[F.blade][0], shoulders[F.off][1] - shoulders[F.blade][1]]
  const fl = Math.hypot(...fw)
  const fn = [fw[0] / fl, fw[1] / fl]
  const g = new Grid()
  const over = new Grid()

  const legOf = side => {
    const r = (side === F.blade ? p.blade : p.off) ?? {}
    const st = F.stand[`ankle${side}`]
    const base = r.carried ? add(st, ...body) : st
    const ankle = mv(base, ...(r.ankle ?? [0, 0]))
    const hip = hips[side]
    const rest = dist(R[`hip${side}`], F.stand[`knee${side}`]) + dist(F.stand[`knee${side}`], st)
    const fold = Math.max(0, rest - dist(hip, ankle)) * 0.75 + (r.bend ?? 0)
    const knee = r.knee ? mv(hip, ...r.knee) : add(lerp(hip, ankle, 0.5), fn[0] * fold, fn[1] * fold - fold * 0.3)
    return { hip, knee, ankle, shoe: r.shoe }
  }
  const armOf = side => {
    const r = (side === F.blade ? p.bladeArm : p.offArm) ?? {}
    const sh = shoulders[side]
    const st = add(F.stand[`hand${side}`], ...top)
    const [a, f, u] = r.hand ?? [0, 0, 0]
    const hand = mv([st[0] + across[0] * a, st[1] + across[1] * a], f, u)
    const fold = Math.max(0, 5.5 - dist(sh, hand)) * 0.6 + (r.bend ?? 0)
    const elbow = add(lerp(sh, hand, 0.5), -fn[0] * fold, -fn[1] * fold + fold * 0.2)
    return { sh, elbow, hand, layer: r.layer ?? (side === (facing === 'front' ? 'L' : 'R') ? 'back' : 'front') }
  }
  const legs = { L: legOf('L'), R: legOf('R') }
  const arms = { L: armOf('L'), R: armOf('R') }
  const farLeg = p.farLeg ?? (facing === 'front' ? 'L' : 'R')
  const limbs = p.overLimbs ? over : g
  const drawLeg = s => leg(limbs, legs[s].hip, legs[s].knee, legs[s].ankle, bottom, facing, legs[s].shoe, R.light)
  const drawArm = (s, into) => arm(into, arms[s].sh, arms[s].elbow, arms[s].hand, R.light)

  for (const s of ['L', 'R']) if (arms[s].layer === 'back') drawArm(s, g)
  if (!p.legsFront) { drawLeg(farLeg); drawLeg(farLeg === 'L' ? 'R' : 'L') }
  paintPart(g, capsule(add(hips.L, 0, -1), add(hips.R, 0, -1), 2.6), PANTS, R.light)
  g.lay(shirt(facing), Math.round(top[0]), Math.round(top[1]))
  if (bottom === 'skirt') {
    const x0 = Math.round(Math.min(hips.L[0], hips.R[0]) - 3), x1 = Math.round(Math.max(hips.L[0], hips.R[0]) + 3)
    skirt(g, x0, x1, Math.round(Math.min(hips.L[1], hips.R[1]) - 1), p.hem ?? 5)
  }
  // Knees drawn up to the chest come in front of the hem too.
  if (p.legsFront) { drawLeg(farLeg); drawLeg(farLeg === 'L' ? 'R' : 'L') }
  for (const s of ['L', 'R']) if (arms[s].layer === 'front') drawArm(s, limbs)
  for (const s of ['L', 'R']) if (arms[s].layer === 'over') drawArm(s, over)
  return { g, over, neck: [Math.round(neck[0]), Math.round(neck[1])] }
}

// ---------------------------------------------------------------------------
// The recipes
// ---------------------------------------------------------------------------

const BOTTOM_KINDS = ['trousers', 'shorts', 'skirt']

/** A running leg at phase t (0: landing in front; on the ground until 0.3, then swung forward again). */
function runLeg(t) {
  t = ((t % 1) + 1) % 1
  const A = 3.2
  if (t < 0.3) return { ankle: [A - (2 * A * t) / 0.3, 0], bend: t > 0.1 && t < 0.25 ? 1.5 : 0.5, shoe: undefined }
  const k = (t - 0.3) / 0.7
  const f = -A + 2 * A * (0.5 - 0.5 * Math.cos(Math.PI * k))
  const up = 1.5 + 3.5 * Math.sin(Math.PI * k)
  return { ankle: [f, up], bend: 1.5 + 1.5 * Math.sin(Math.PI * k), shoe: k < 0.45 ? 'sole' : undefined }
}
function run(i) {
  const t = i / 6
  const bob = [0, -1, 1, 0, -1, 1][i]
  const bl = runLeg(t)
  const of = runLeg(t + 0.5)
  // The arms swing against the legs: the blade hand forward while the off leg is.
  const sw = Math.cos(2 * Math.PI * t)
  return {
    body: [0.5, bob], lean: [1, 0],
    blade: bl, off: of,
    bladeArm: { hand: [0.05, -2.2 * sw, 2 + Math.max(0, -sw)], layer: -sw > 0.2 ? 'front' : 'back' },
    offArm: { hand: [0, 2.4 * sw, 2 + Math.max(0, sw)], layer: sw > 0.2 ? 'front' : 'back' },
  }
}

const RECIPES = {
  // H1: the blade arm drawn back over the far shoulder, weight on the back foot.
  atk_wind: {
    body: [-1, 0], lean: [-1, 0],
    blade: { ankle: [2.5, 0], bend: 0 }, off: { ankle: [-1, 0], bend: 1.5 },
    bladeArm: { hand: [0.85, -1, 8.5], layer: 'over' },
    offArm: { hand: [-0.15, 2.5, 3], layer: 'front' },
  },
  // H1: the backhand: the blade arm swept out past the far side, shoulders turned.
  atk_back: {
    body: [0.5, 0], lean: [0.5, 0],
    blade: { ankle: [2.5, 0], bend: 0.5 }, off: { ankle: [-1.5, 0], bend: 0 },
    bladeArm: { hand: [1.25, 1.5, 4.5], layer: 'front' },
    offArm: { hand: [0.1, -3, 2.5], layer: 'back' },
  },
  // H2: the finisher: a deep step, the body low, the blade arm all the way out.
  atk_lunge: {
    body: [2.5, -3], lean: [1.5, 0],
    blade: { ankle: [5.5, 0], bend: 1 }, off: { ankle: [-3, 0], bend: -1 },
    bladeArm: { hand: [-0.1, 7, 5], layer: 'front' },
    offArm: { hand: [0.2, -4.5, 4], layer: 'back' },
  },
  // H2: the landing: the front knee bent, the blade low in front.
  atk_land: {
    body: [2, -2], lean: [1, -1],
    blade: { ankle: [4.5, 0], bend: 2 }, off: { ankle: [-2, 0], bend: 0 },
    bladeArm: { hand: [0.1, 4, -2], layer: 'front' },
    offArm: { hand: [0, -1.5, 0.5], layer: 'back' },
  },
  // H3: tucked, the head down, the knees up to the chest, hands round the shins.
  roll_0: {
    body: [1, -4], lean: [1.5, -1.5], legsFront: true,
    blade: { ankle: [1.5, 0], knee: [3, 4] }, off: { ankle: [0.5, 0], knee: [2.5, 3.5] },
    bladeArm: { hand: [0.3, 2.5, 1], layer: 'front' },
    offArm: { hand: [-0.2, 2, 1], layer: 'front' },
  },
  // H3: uncurled to a crouch, a hand on the ground.
  roll_3: {
    body: [1, -4], lean: [1.5, -0.5],
    blade: { ankle: [2, 0], bend: 2 }, off: { ankle: [-1, 0], bend: 1 },
    bladeArm: { hand: [0, 3, -1.5], layer: 'front' },
    offArm: { hand: [0, -1, 0], layer: 'front' },
  },
  ...Object.fromEntries([0, 1, 2, 3, 4, 5].map(i => [`run_${i}`, run(i)])),
  // H6: the other half of the breath: the chest and shoulders up a px.
  idle_1: { lean: [0, 1] },
  // H6: the held charge: crouched, the blade low behind, the back foot braced.
  charge: {
    body: [-0.5, -2], lean: [0.5, 0],
    blade: { ankle: [1.5, 0], bend: 1 }, off: { ankle: [-3, 0], bend: -0.5 },
    bladeArm: { hand: [0.75, -4, -1.5], layer: 'back' },
    offArm: { hand: [-0.3, 2.5, 2.5], layer: 'front' },
  },
  // H7: hurt: thrown back, the arms flung out (drawn from behind; the front is heroArt.ts's own).
  hurt: {
    body: [-1, 0], lean: [-1.5, 0],
    blade: { ankle: [1.5, 0], bend: 0 }, off: { ankle: [-1.5, 0], bend: 0 },
    bladeArm: { hand: [-0.3, -1, 4.5], layer: 'front' },
    offArm: { hand: [0.3, -1, 4.5], layer: 'front' },
  },
  // H7: staggered: the knees buckled, slumped forward, the arms hanging.
  stagger: {
    body: [0.5, -3], lean: [1.5, -0.5],
    blade: { ankle: [0.5, 0], bend: -1.5 }, off: { ankle: [-0.5, 0], bend: -1.5 },
    bladeArm: { hand: [0.1, 1.5, -2.5], layer: 'front' },
    offArm: { hand: [-0.1, 1.5, -2.5], layer: 'front' },
  },
}
/** Which facings a recipe is drawn in (hurt: from behind only; heroArt.ts draws it from the front). */
const FACINGS = { hurt: ['back'] }

/** The ball the roll turns: the tuck with the feet off the ground, the head down on the knees. */
const BALL = {
  body: [1, -4], lean: [1.5, -2.5], legsFront: true, overLimbs: true,
  blade: { ankle: [-4, 5], knee: [3.5, 7], shoe: 'sole' }, off: { ankle: [-6.5, 4], knee: [2.5, 6.5], shoe: 'sole' },
  bladeArm: { hand: [-0.1, 6.5, 3.5], layer: 'front' },
  offArm: { hand: [-0.25, 3, 2.5], layer: 'front' },
}
/** From behind the far foot and the blade hand reach out further, for the same width. */
const BALL_BACK = {
  ...BALL,
  blade: { ...BALL.blade, ankle: [-7, 4] }, off: { ...BALL.off, ankle: [-9, 3] },
  bladeArm: { hand: [0.2, 7.5, 3.5], layer: 'front' },
}
/** The roll's ball: the tuck turned a quarter (`roll_1`) and a half (`roll_2`) forward about its middle, head and all. */
const ROLL_TURNS = { roll_1: 3, roll_2: 2 }

const bodies = {}
const arms = {}
function store(name, facing, bottom, out, nr, perBottom = false) {
  const extra = { nx: out.neck[0], ny: out.neck[1] }
  if (nr) extra.nr = nr
  bodies[`${name}/${facing}/${bottom}`] = out.g.part(extra)
  if (out.over.m.size && (perBottom || bottom === 'trousers')) arms[perBottom ? `${name}/${facing}/${bottom}` : `${name}/${facing}`] = out.over.part()
}
for (const [name, r] of Object.entries(RECIPES)) {
  for (const facing of FACINGS[name] ?? ['front', 'back']) {
    for (const bottom of BOTTOM_KINDS) store(name, facing, bottom, pose(facing, bottom, r))
  }
}

/** The head's box at a neck point (the widest drawn head, so the ball is turned about the whole figure's middle). */
function headBox(facing, neck) {
  const h = facing === 'front' ? { x: -9, y: -18, w: 22, h: 18 } : { x: -8, y: -17, w: 22, h: 17 }
  return { x0: neck[0] + h.x, y0: neck[1] + h.y, x1: neck[0] + h.x + h.w - 1, y1: neck[1] + h.y + h.h - 1 }
}
for (const [name, q] of Object.entries(ROLL_TURNS)) {
  for (const facing of ['front', 'back']) {
    for (const bottom of BOTTOM_KINDS) {
      const out = pose(facing, bottom, facing === 'back' ? BALL_BACK : BALL)
      const b = out.g.box()
      const ob = out.over.box()
      // Turned a quarter, the ball's width is its height: at least the art's 26 px (tests/zelda-hero-art.test.mjs).
      if (Math.max(b.x1, ob.x1) - Math.min(b.x0, ob.x0) + 1 < 27) throw new Error(`the ${facing} ball is ${Math.max(b.x1, ob.x1) - Math.min(b.x0, ob.x0) + 1} px wide`)
      const hb = headBox(facing, out.neck)
      const x0 = Math.min(b.x0, hb.x0), x1 = Math.max(b.x1, hb.x1), y0 = Math.min(b.y0, hb.y0), y1 = Math.max(b.y1, hb.y1)
      const cx = Math.round((x0 + x1) / 2), cy = Math.round((y0 + y1) / 2)
      const g = out.g.turn(q, cx, cy)
      const ov = out.over.turn(q, cx, cy)
      const nk = new Grid(); nk.set(out.neck[0], out.neck[1], 'x')
      const [[nx0, ny0]] = [...nk.turn(q, cx, cy).each()]
      // The ball sits on the ground: its lowest px (body or turned head) on row −1, centred on the stand's middle.
      const hq = new Grid()
      for (let y = hb.y0; y <= hb.y1; y++) for (let x = hb.x0; x <= hb.x1; x++) hq.set(x, y, 'h')
      const all = g.clone().lay(ov).lay(hq.turn(q, cx, cy))
      const ab = all.box()
      const dx = Math.round((facing === 'front' ? 3 : -2) - (ab.x0 + ab.x1) / 2)
      const dy = -1 - ab.y1
      const moved = new Grid().lay(g, dx, dy)
      store(name, facing, bottom, { g: moved, over: new Grid().lay(ov, dx, dy), neck: [nx0 + dx, ny0 + dy] }, q, true)
    }
  }
}

// ---------------------------------------------------------------------------
// Written out
// ---------------------------------------------------------------------------

const fmt = p => {
  const head = [`x: ${p.x}`, `y: ${p.y}`]
  if (p.nx !== undefined) head.push(`nx: ${p.nx}`, `ny: ${p.ny}`)
  if (p.nr) head.push(`nr: ${p.nr}`)
  return `{ ${head.join(', ')}, rows: [\n${p.rows.map(r => `    '${r}',`).join('\n')}\n  ] }`
}
const text = `/**
 * The hero's fight and movement poses in the isometric view (docs/art/codex-tasks.md, THE HERO IN A FIGHT), the
 * extra poses \`hero.ts\` lists in \`ART_EXTRA_POSES\`. Built by \`scripts/zelda-lab/hero-poses.mjs\` from the drawn
 * standing bodies in \`heroArt.ts\`: the drawn shirt cut at its own grid and moved by whole px (turned by quarter turns
 * for the roll), the limbs laid round it by a small rig in the same role letters (\`HERO_LETTERS\`). Same parts as
 * \`heroArt.ts\`: bodies \`pose/facing/bottom\` from the foot point with the neck point \`nx\`, \`ny\` (\`nr\`: the head is
 * turned that many quarter turns clockwise about the neck point), and arms laid over the head \`pose/facing\`.
 * Edit the rows here, or the recipes there and build again (which overwrites the rows).
 */
import type { HeroPart } from './heroArt'

/** A body whose head is turned (the roll): quarter turns clockwise about the neck point. */
export interface HeroPosePart extends HeroPart { nr?: 1 | 2 | 3 }

export const HERO_POSE_BODIES: Record<string, HeroPosePart> = {
${Object.keys(bodies).sort().map(k => `  '${k}': ${fmt(bodies[k])},`).join('\n')}
}

export const HERO_POSE_ARMS: Record<string, HeroPart> = {
${Object.keys(arms).sort().map(k => `  '${k}': ${fmt(arms[k])},`).join('\n')}
}
`
if (process.argv[2] === 'sheet') {
  await sheet(process.argv[3], process.argv.slice(4))
} else if (process.argv.includes('--check')) {
  const now = readFileSync(OUT, 'utf8')
  if (now !== text) { console.error('heroPoses.ts differs from what hero-poses.mjs builds'); process.exit(1) }
  console.log('heroPoses.ts is up to date')
} else {
  writeFileSync(OUT, text)
  console.log(`${Object.keys(bodies).length} bodies, ${Object.keys(arms).length} arms -> ${OUT}`)
}

// ---------------------------------------------------------------------------
// The contact sheet
// ---------------------------------------------------------------------------

async function sheet(outArg, lookArgs) {
  if (!outArg) { console.error('usage: hero-poses.mjs sheet <out.png> [look …]'); process.exit(2) }
  const { deflateSync } = await import('node:zlib')
  const lab = esbuild.buildSync({
    stdin: {
      contents: `export * from './render/iso/hero'; export * from './render/heroLook'; export { heroFrames } from './render/heroFrames'; export { PAL } from './render/sprites'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  const M = await import('data:text/javascript;base64,' + Buffer.from(lab.outputFiles[0].text).toString('base64'))
  const lookOf = arg => {
    if (arg === 'drawn') return M.DRAWN_LOOK
    if (arg === 'girl') return M.GIRL_LOOK
    const [hair, head, bottom] = arg.split('/')
    const look = M.parseHeroLook({ ...M.DRAWN_LOOK, hair, head: head ?? 'band', bottom: bottom ?? 'trousers' })
    if (!look) throw new Error('not a shape: ' + arg)
    return look
  }
  const looks = (lookArgs.length ? lookArgs : ['drawn', 'girl', 'long/bow/skirt', 'short/none/shorts']).map(lookOf)
  const poses = [...M.ART_POSES, ...M.ART_EXTRA_POSES]
  const SCALE = +(process.env.SCALE || 4)
  const CW = 52, ISO_H = 52, CL_H = 18
  const BLOCK = ISO_H * 2 + CL_H + 4
  const W = poses.length * CW + 2, H = looks.length * BLOCK + 2
  const px = Buffer.alloc(W * H * 4)
  const set = (x, y, c) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return
    const i = (y * W + x) * 4
    px[i] = parseInt(c.slice(1, 3), 16); px[i + 1] = parseInt(c.slice(3, 5), 16); px[i + 2] = parseInt(c.slice(5, 7), 16); px[i + 3] = 255
  }
  const fill = (x, y, w, h, c) => { for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) set(xx, yy, c) }
  fill(0, 0, W, H, '#0b0616')
  looks.forEach((look, li) => {
    const artPal = M.heroArtPalette(look)
    const pal = { ...M.PAL, ...M.lookPalette(look) }
    const frames = M.heroFrames(look)
    const top = 1 + li * BLOCK
    poses.forEach((pose, pi) => {
      const ox = 1 + pi * CW
      ;['down', 'up'].forEach((d, di) => {
        const oy = top + di * ISO_H
        fill(ox, oy, CW - 1, ISO_H - 1, (pi + di) % 2 ? '#1f5a4e' : '#3b2b62')
        const a = M.heroArtFrame(`hero_${d}_${pose}`, false, look)
        if (!a) return
        const { rows, ax, ay } = a.frame
        const w = rows[0].length
        const bx = ox + Math.round(CW / 2) - (a.flip ? w - ax : ax), by = oy + ISO_H - 5
        rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.') set(bx + (a.flip ? w - 1 - x : x), by - ay + y, artPal[ch] ?? '#ff0000') }))
        set(ox + Math.round(CW / 2), by, '#ffff00')
      })
      const cy = top + ISO_H * 2
      fill(ox, cy, CW - 1, CL_H, '#2a2440')
      ;['down', 'up', 'side'].forEach((d, di) => {
        const rows = frames[`hero_${d}_${pose}`] ?? (d === 'down' ? frames[`hero_${pose}`] : null)
        if (rows) rows.forEach((r, y) => [...r].forEach((ch, x) => { if (ch !== '.' && pal[ch]) set(ox + 1 + di * 17 + x, cy + 1 + y, pal[ch]) }))
      })
    })
  })
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
  const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const SW = W * SCALE, SH = H * SCALE
  const raw = Buffer.alloc((SW * 4 + 1) * SH)
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) px.copy(raw, y * (SW * 4 + 1) + 1 + x * 4, ((Math.floor(y / SCALE) * W) + Math.floor(x / SCALE)) * 4, ((Math.floor(y / SCALE) * W) + Math.floor(x / SCALE)) * 4 + 4)
  const head = Buffer.alloc(13)
  head.writeUInt32BE(SW, 0); head.writeUInt32BE(SH, 4); head[8] = 8; head[9] = 6
  const out = resolve(outArg)
  writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
  console.log(`${looks.length} looks × ${poses.length} poses -> ${out} (${SW}×${SH})`)
  console.log('poses:', poses.join(' '))
}
