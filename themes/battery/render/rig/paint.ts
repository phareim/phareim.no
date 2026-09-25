/**
 * Paints one frame of a hero (or the Professor) into a Doll from a Rig:
 * two-bone arms and legs solved to their targets, a torso, the head with
 * its face, ears, tail and props. Side frames face right; the caller
 * mirrors them for left.
 */
import { Doll, stamp, tone, turn } from './doll'
import type { Mat } from './doll'
import { INK, LOOKS, MAT } from './looks'
import type { Look, RigId } from './looks'
import type { Arm, FrameDesc, Rig } from './poses'
import { rigFor } from './poses'
import { dagEarsBehind, head } from './heads'

type P = [number, number]

/** Two-bone IK: the middle joint for a chain a→b of lengths l1, l2, bent to side `bend`. */
function ik(ax: number, ay: number, tx: number, ty: number, l1: number, l2: number, bend: number): { m: P; e: P } {
  let dx = tx - ax, dy = ty - ay
  let d = Math.hypot(dx, dy)
  const max = l1 + l2 - 0.01
  if (d > max) { dx *= max / d; dy *= max / d; d = max }
  if (d < 0.5) { d = 0.5; dy = 0.5 }
  const ux = dx / d, uy = dy / d
  const a = Math.max(-1, Math.min(1, (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
  const h = Math.sqrt(Math.max(0, 1 - a * a)) * l1
  const along = a * l1
  // Perpendicular (−uy, ux) times bend.
  const mx = ax + ux * along + -uy * h * bend
  const my = ay + uy * along + ux * h * bend
  return { m: [mx, my], e: [ax + dx, ay + dy] }
}



// ---------------------------------------------------------------------------
// The painter
// ---------------------------------------------------------------------------

export interface Built {
  c: HTMLCanvasElement
  /** Where the feet are inside c. */
  ax: number
  ay: number
}

const W = 72, H = 88, OX = 36, OY = 80

export function paintFrame(desc: FrameDesc): Built {
  const L = LOOKS[desc.id]
  const r = rigFor(L, desc)
  const d = new Doll(W, H, OX, OY)
  drawBody(d, L, r, desc)
  let c = d.render()
  let ax = OX, ay = OY
  if (r.rot) {
    // Turn about the body's middle, then set it down (lie) or in the air (fall).
    const mid = -Math.round((L.legLen + L.torsoH) * 0.62)
    c = turn(c, r.rot)
    const q = r.rot % 4
    // Where the pivot (OX, OY + mid) lands after the turn.
    const px = OX, py = OY + mid
    const cx = W / 2, cy = H / 2
    const dx = px - cx, dy = py - cy
    const rx = q === 1 ? -dy : q === 2 ? -dx : q === 3 ? dy : dx
    const ry = q === 1 ? dx : q === 2 ? -dy : q === 3 ? -dx : dy
    const nx = c.width / 2 + rx, ny = c.height / 2 + ry
    if (desc.pose === 'lie') {
      // The lowest painted row rests on the floor.
      const b = bottomRow(c)
      ax = Math.round(nx)
      ay = b + 1
    } else {
      ax = Math.round(nx)
      ay = Math.round(ny) + 22
    }
  }
  return trim({ c, ax, ay })
}

function bottomRow(c: HTMLCanvasElement): number {
  const g = c.getContext('2d')!
  const data = g.getImageData(0, 0, c.width, c.height).data
  for (let y = c.height - 1; y >= 0; y--) for (let x = 0; x < c.width; x++) if (data[(y * c.width + x) * 4 + 3]! > 0) return y
  return c.height - 1
}

function trim(b: Built): Built {
  const { c } = b
  const g = c.getContext('2d')!
  const data = g.getImageData(0, 0, c.width, c.height).data
  let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
    if (data[(y * c.width + x) * 4 + 3]! === 0) continue
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  if (x1 < 0) return b
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(c, -x0, -y0)
  return { c: out, ax: b.ax - x0, ay: b.ay - y0 }
}

interface Joints {
  hip: P
  sh: P
  head: P
  arms: { s: P; m: P; h: P; arm: Arm; far: boolean }[]
  legs: { h: P; k: P; a: P; far: boolean; lift: number }[]
}

function solve(L: Look, r: Rig): Joints {
  const side = r.view === 'side'
  const hipY = -(L.legLen - r.crouch) + r.dy
  const hipX = r.shake
  const shY = hipY - L.torsoH - r.lift
  const shX = hipX + r.lean
  const headX = shX + r.headDx + (side ? 1 : 0)
  const headY = shY - L.neck + r.headDy + r.lift
  const thigh = L.legLen * 0.52, shin = L.legLen * 0.48
  const legs = [0, 1].map(i => {
    const lg = r.legs[i]!
    const sgn = i === 0 ? -1 : 1
    const hx = side ? hipX + (i === 0 ? -0.8 : 0.6) : hipX + sgn * L.legGap
    const tx = side ? hipX + lg.x * L.legLen + (i === 0 ? -0.8 : 0.6) : hx + sgn * lg.x * L.legLen
    const ty = -lg.lift + r.dy - 0.5
    const bend = side ? 1 : -sgn
    const s = ik(hx, hipY, tx, ty, thigh, shin, bend)
    if (!side && r.crouch === 0) {
      // Facing us or away, a stepping leg just gets shorter (the knee comes towards us).
      const ay = Math.min(ty, hipY + L.legLen)
      return { h: [hx, hipY] as P, k: [(hx + tx) / 2, (hipY + ay) / 2] as P, a: [tx, ay] as P, far: false, lift: lg.lift }
    }
    return { h: [hx, hipY] as P, k: s.m, a: s.e, far: side && i === 0, lift: lg.lift }
  })
  const arms = [0, 1].map(i => {
    const arm = r.arms[i]!
    const sgn = i === 0 ? -1 : 1
    const sx = side ? shX + (i === 0 ? -1.5 : 0.5) : shX + sgn * L.shoulderX
    const sy = shY + (L.id === 'dag' ? 3 : 2)
    const reach = L.armLen
    let tx: number, ty: number
    if (arm.at) {
      // Local pixels; x is forward (side) or outward for this arm (front, back).
      tx = hipX + (side ? arm.at[0] : sgn * arm.at[0])
      ty = arm.at[1] + r.dy
    } else { tx = sx + (side ? 1 : sgn) * arm.x * reach; ty = sy + arm.y * reach }
    // The elbow: side view bends back by default; front view outward (bend −1 means outward here).
    const bend = side ? arm.bend : arm.bend * sgn
    const s = ik(sx, sy, tx, ty, reach * 0.5, reach * 0.5, bend)
    return { s: [sx, sy] as P, m: s.m, h: s.e, arm, far: side && i === 0 }
  })
  return { hip: [hipX, hipY], sh: [shX, shY], head: [headX, headY], arms, legs }
}

function drawBody(d: Doll, L: Look, r: Rig, desc: FrameDesc) {
  const J = solve(L, r)
  const side = r.view === 'side'
  const back = r.view === 'back'
  const front = r.view === 'front'

  // Behind everything: hanging ears (Dag), Espen's flopped ears in back view.
  if (L.id === 'dag') dagEarsBehind(d, L, J.head[0], J.head[1], r)

  // Hand-to-face poses put the near arm in front of the head (side view).
  const raised = side && (desc.pose === 'eat' || desc.pose === 'think' || (!desc.pose && desc.idle === 'glasses'))
  const sitting = r.crouch > L.legLen * 0.6
  if (side) {
    arm(d, L, J.arms[0]!, r, -1)
    leg(d, L, J.legs[0]!, r, -1)
    if (!sitting) leg(d, L, J.legs[1]!, r, 0)
    tail(d, L, J, r)
    torso(d, L, J, r, desc)
    if (sitting) leg(d, L, J.legs[1]!, r, 0)
    if (r.prop === 'battery') battery(d, J, r)
    if (!raised) arm(d, L, J.arms[1]!, r, 0)
    head(d, L, J.head[0], J.head[1], r, desc)
    if (raised) arm(d, L, J.arms[1]!, r, 0)
  } else {
    if (!sitting || back) { leg(d, L, J.legs[0]!, r, 0); leg(d, L, J.legs[1]!, r, 0) }
    torso(d, L, J, r, desc)
    // Sitting, facing us: the legs fold in front of the body.
    if (sitting && !back) { leg(d, L, J.legs[0]!, r, 0); leg(d, L, J.legs[1]!, r, 0) }
    if (back) tail(d, L, J, r)
    arm(d, L, J.arms[0]!, r, 0)
    arm(d, L, J.arms[1]!, r, 0)
    if (front && r.prop === 'battery') {
      battery(d, J, r)
      // Paws round its sides.
      for (const a of J.arms) d.ell(a.h[0], a.h[1], L.handR, L.handR, L.hand, { line: 'k' })
    }
    head(d, L, J.head[0], J.head[1], r, desc)
  }
  if (r.prop === 'spoon') spoon(d, J, r)
  if (r.prop === 'meter') {
    // Espen holds the EMF meter up; its LED blinks.
    const [mx, my] = J.arms[1]!.h
    meter(d, Math.round(mx) + (side ? 1 : 0), Math.round(my) - 3, desc)
    d.px(Math.round(mx) + (side ? 1 : 0) - 1, Math.round(my) - 7, '#a8a8c8', false)
    d.px(Math.round(mx) + (side ? 1 : 0) - 1, Math.round(my) - 6, '#a8a8c8', false)
  }
  if (r.prop === 'sweat' && !back) {
    const [hx, hy] = J.head
    const x = side ? hx - 3 : hx + L.headRx
    d.px(x, hy - L.headRy + 1, INK.sweat, false)
    d.px(x, hy - L.headRy + 2, INK.sweat, false)
  }
}

function leg(d: Doll, L: Look, lg: Joints['legs'][0], r: Rig, dim: number) {
  const [hx, hy] = lg.h, [kx, ky] = lg.k, [ax, ay] = lg.a
  const trou = L.id === 'professor' ? MAT.trousers : L.suit
  const thighR = L.legR + (L.id === 'dag' ? 0.3 : 0.25)
  d.cap(hx, hy, kx, ky, thighR, L.legR, trou, { dim, line: 'd' })
  d.cap(kx, ky, ax, ay, L.legR, L.legR * 0.95, trou, { dim, join: true })
  // Mud and grass.
  if (L.id === 'dag' && r.view !== 'back') {
    const mud = [tone(MAT.shoeD, 2), tone(MAT.shoeD, 1), tone(MAT.shoeD, 3)]
    const kxr = Math.round(kx), kyr = Math.round(ky)
    stamp(d, r.view === 'side' ? ['..a', '.ba', 'c.b'] : ['.a.b', 'bac.', '.b.a'], kxr - (r.view === 'side' ? 0 : 2), kyr - 1, { a: mud[0]!, b: mud[1]!, c: mud[2]! })
  }
  if (L.id === 'espen' && r.view !== 'back' && lg === lg) {
    d.px(kx, ky, '#5a9a2a', true)
    d.px(kx + 1, ky + 1, '#7ac040', true)
  }
  // The shoe: a round-toed lump in front of the ankle.
  const side = r.view === 'side'
  const sh = L.shoe
  const fw = L.id === 'dag' ? 3.6 : L.id === 'espen' ? 2.6 : 2.7
  if (side) {
    d.ell(ax + fw * 0.55, ay - 0.9, fw, 1.6, sh, { dim, line: 'k' })
    if (L.id === 'espen') d.rect(Math.round(ax + fw * 0.55 - fw), Math.round(ay), Math.round(fw * 2), 1, '#fbf8ff', true)
  } else {
    d.ell(ax, ay - (r.view === 'back' ? 1.2 : 0.9), fw * 0.72, 1.7, sh, { dim, line: 'k' })
    if (L.id === 'espen') d.rect(Math.round(ax - 1.5), Math.round(ay), 3, 1, '#fbf8ff', true)
  }
}

function arm(d: Doll, L: Look, a: Joints['arms'][0], r: Rig, dim: number) {
  const [sx, sy] = a.s, [mx, my] = a.m, [hx, hy] = a.h
  const sleeve = L.suit
  d.cap(sx, sy, mx, my, L.armR + 0.2, L.armR, sleeve, { dim, line: 'k' })
  d.cap(mx, my, hx, hy, L.armR, L.armR * 0.9, sleeve, { dim, join: true })
  const hand = a.arm.hand ?? 'mitt'
  const hr = L.handR
  // A cuff line where the paw meets the sleeve.
  d.ell(hx, hy, hr, hr, L.hand, { dim, line: 'd' })
  if (hand === 'point') {
    const ux = hx - mx, uy = hy - my
    const n = Math.hypot(ux, uy) || 1
    d.cap(hx, hy, hx + (ux / n) * (hr + 2), hy + (uy / n) * (hr + 2), 0.7, 0.6, L.hand, { dim, join: true })
  } else if (hand === 'open') {
    const ux = hx - mx, uy = hy - my
    const n = Math.hypot(ux, uy) || 1
    d.ell(hx + (ux / n) * 1.2, hy + (uy / n) * 1.2, hr * 1.05, hr * 1.05, L.hand, { dim, join: true })
  }
}

function torso(d: Doll, L: Look, J: Joints, r: Rig, desc: FrameDesc) {
  const side = r.view === 'side'
  const back = r.view === 'back'
  const [hx, hy] = J.hip, [sx, sy] = J.sh
  const top = sy - 1
  const bot = hy + (L.id === 'dag' ? 3 : 2.5)
  const coat = L.id === 'professor'
  const k = side ? L.depth : 1
  const cx = (f: number) => sx + (hx - sx) * f + (side ? L.paunch * Math.sin(f * Math.PI) * 0.9 : 0)
  const half = (f: number) => {
    // Chest → belly → hips, rounded shoulders at the top.
    const sh = Math.min(1, Math.sqrt(Math.max(0, f) / 0.14))
    const w = f < 0.6 ? L.chestW + (L.bellyW - L.chestW) * (f / 0.6) : L.bellyW + (L.hipW - L.bellyW) * ((f - 0.6) / 0.4)
    return w * k * (0.55 + 0.45 * sh)
  }
  if (coat) {
    // The lab coat flares to the knee.
    const hem = hy + L.legLen * 0.45
    d.blob(top, hem, f => sx + (hx - sx) * Math.min(1, f * 1.4), f => (f < 0.55 ? half(f / 0.55 * 0.6) : L.hipW * k + (f - 0.55) * 5 * k), MAT.coat, {})
    if (!back && !side) {
      // Lapels and a teal blouse.
      stamp(d, ['.tt.', '.tt.', '..t.'], Math.round(sx) - 2, Math.round(top) + 1, { t: '#2cc4d6' })
      d.line(sx - 2, top + 1, sx, top + 5, tone(MAT.coat, 1), true)
      d.line(sx + 1, top + 1, sx - 1, top + 5, tone(MAT.coat, 1), true)
      d.line(sx - 0.5, top + 6, sx - 0.5, hem - 1, tone(MAT.coat, 1), true)
      // A pocket with pens.
      d.rect(Math.round(sx) + 2, Math.round(top) + 4, 1, 2, '#ff3b5c', true)
      d.rect(Math.round(sx) + 3, Math.round(top) + 4, 1, 2, '#2f5fd0', true)
      d.rect(Math.round(sx) + 2, Math.round(top) + 6, 3, 1, tone(MAT.coat, 1), true)
    }
    if (side) {
      d.line(sx + L.chestW * k - 1, top + 3, cx(0.9) + L.hipW * k - 0.5, hem - 1, tone(MAT.coat, 1), true)
    }
    return
  }
  d.blob(top, bot, cx, half, L.suit, { line: 'd' })

  const X = Math.round(sx), T = Math.round(top)
  if (L.id === 'kjell') {
    if (!back && !side) {
      // The broken zip: open to the belly, a teal T-shirt showing, the pull dangling.
      const zipTop = T + 1, zipBot = Math.round(top + (bot - top) * 0.55)
      for (let y = zipTop; y <= zipBot; y++) {
        const f = (y - zipTop) / Math.max(1, zipBot - zipTop)
        const w = Math.round(2.2 * (1 - f))
        d.rect(X - 1 - w, y, 2 + w * 2, 1, tone(MAT.teeK, 2), true)
        d.px(X - 2 - w, y, tone(L.suit, 0), true)
        d.px(X + 1 + w, y, tone(L.suit, 0), true)
      }
      d.px(X - 1, zipTop + 1, tone(MAT.teeK, 3), true)
      d.px(X, zipTop + 2, '#fbf8ff', true) // a tiny print on the tee
      d.px(X - 1, zipBot + 1, '#8a8aa8', true)
      d.px(X - 1, zipBot + 2, '#c0c0d8', true)
      d.line(X - 0.5, zipBot + 3, X - 0.5, bot - 2, tone(L.suit, 1), true)
    } else if (side) {
      d.px(Math.round(cx(0.2) + L.chestW * k) - 1, T + 3, tone(MAT.teeK, 2), true)
      d.px(Math.round(cx(0.3) + L.chestW * k) - 1, T + 4, tone(MAT.teeK, 2), true)
    }
  } else if (L.id === 'dag') {
    if (!back) {
      // The split belly seam: stitches straining over an orange T-shirt.
      const pal = { d: tone(L.suit, 0), o: tone(MAT.teeD, 2), O: tone(MAT.teeD, 3), x: '#fbf8ff' }
      const y0 = Math.round(top + (bot - top) * 0.4)
      if (side) {
        const bx = Math.round(cx(0.55) + L.bellyW * k) - 3
        stamp(d, ['.d', 'dO', 'xx', 'do', 'xx', '.d'], bx, y0, pal)
      } else {
        stamp(d, ['..d..', '.dOd.', 'dxxxd', 'dooOd', 'dxxxd', 'doood', 'dxxxd', '.dod.', '..d..'], X - 2, y0 - 1, pal)
        d.line(X, T + 2, X, y0 - 1, tone(L.suit, 1), true)
      }
    }
  } else if (L.id === 'espen') {
    // Grass stains, and the EMF meter's strap.
    if (!back) {
      d.px(X + (side ? 2 : -3), Math.round(bot) - 3, '#5a9a2a', true)
      d.px(X + (side ? 1 : -2), Math.round(bot) - 2, '#7ac040', true)
      d.px(X + (side ? 2 : -2), Math.round(bot) - 3, '#7ac040', true)
    }
    if (!side) {
      const x0 = back ? X + 3 : X - 3, x1 = back ? X - 4 : X + 4
      d.line(x0, T + 1, x1, Math.round(bot) - 4, '#3a2418', true)
    } else {
      d.line(X + 1, T + 1, X - 2, Math.round(bot) - 4, '#3a2418', true)
    }
  }
  if (L.id === 'espen' && r.prop !== 'meter' && !back) meter(d, side ? X - 2 : X + 3, Math.round(bot) - 4, desc)
}

function meter(d: Doll, x: number, y: number, desc: FrameDesc) {
  d.box(x - 2, y - 2, 4, 5, MAT.emf, { line: 'k' })
  d.rect(x - 1, y - 1, 2, 2, '#16301e', true)
  d.px(x - 1, y, '#b6ff4a', true)
  d.px(x + 1, y + 2, (desc.f + desc.walk) % 2 ? '#ff3b5c' : '#7a1020', true)
}

function tail(d: Doll, L: Look, J: Joints, r: Rig) {
  if (L.id === 'professor') return
  const side = r.view === 'side'
  const [hx, hy] = J.hip
  const bx = side ? hx - L.hipW * L.depth - 0.5 : hx
  const by = hy + (side ? -1 : -2)
  const rr = L.id === 'dag' ? 2.8 : 2.2
  if (L.id === 'kjell') {
    // Hanging by a thread.
    const tx = bx + (side ? -1 : 0) + r.tail, ty = by + 8
    d.line(bx, by, tx, ty - 2, '#c9c2e2', false)
    d.ell(tx, ty, rr, rr, L.suit, { line: 'k' })
  } else {
    d.ell(bx + (side ? -0.8 : 0), by, rr, rr, L.suit, { line: 'k' })
  }
}

function battery(d: Doll, J: Joints, r: Rig) {
  const side = r.view === 'side'
  const [hx, hy] = J.hip
  const w = side ? 10 : 14
  const x = side ? hx + 4 : hx - 7
  const y = hy - (side ? 9 : 8)
  d.box(x, y, w, 8, MAT.battery, { line: 'k' })
  d.rect(x, y + 3, w, 2, '#ffd23f', true)
  d.px(x + 1, y + 3, '#c4861c', true)
  d.box(x + 1, y - 2, 2, 2, MAT.red, { line: 'k' })
  d.box(x + w - 3, y - 2, 2, 2, MAT.steel, { line: 'k' })
  d.px(x + 1, y + 1, '#ff3b5c', true)
  d.px(x + w - 2, y + 1, '#a8a8c8', true)
}

function spoon(d: Doll, J: Joints, r: Rig) {
  const a = J.arms[1]!
  const [hx, hy] = a.h
  const side = r.view === 'side'
  const tx = hx + (side ? 1 : 0), ty = hy - 3
  d.line(hx, hy, tx, ty, '#c8c8e0', false)
  d.px(tx, ty - 1, '#d0304c', false)
  d.px(tx + (side ? 1 : 1), ty - 1, '#ff7a8c', false)
}

