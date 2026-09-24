import type { Game } from '../types'
import { CAPTURE_X, CHAPTERS } from '../engine/levels'
import {
  CYAN, GOLD, INK, PINK, SCENES,
  bar, clamp, disc, emissiveLayer, glow, hash, pixelMode, pixelText, poly, rect, textStep,
  type Camera, type Pt, type View, makeView,
} from './core'
import { makeCanvas } from '../../base/pixel/stage'
import { DUSK as NSD, ditherGradient, drawStars, paintRidge, paintSky, paintSun } from '../../base/pixel/scenery'
import { drawBeastAt, drawBuddyAt, drawGuard, drawPilotAt, drawShip, drawWinged, type PilotLook } from './figures'
import { drawSun, sunGeom } from './scenery'

// The three cuts: the prologue (the last run over the neon grid, the storm,
// the sun tearing open), the capture (the beast shot out of the air, the
// guards), the ending (the lamp, the shot, the friend, the flight into the
// rising sun). And the chapter card. Hard cuts between shots, never a fade.

export interface CutLook extends PilotLook {
  trim: string
  pilot: string
  ship: string
}

/** The arcade dusk the prologue and the homecoming fly through, painted once per size. */
interface ArcadeLayer {
  w: number
  h: number
  back: HTMLCanvasElement
  sun: HTMLCanvasElement
  hy: number
  sx: number
  sy: number
  r: number
  starTop: number
}

export interface CutState {
  layer: ArcadeLayer | null
}

export function createCutState(): CutState {
  return { layer: null }
}

/**
 * The arcade's dusk, the Neon Shrine way (2026-09-24): dithered sky, the
 * striped sun behind two ridges, a dithered sea with the sun's glitter.
 * Everything in logical pixels; the returned geometry is in CSS px for the
 * shots that fly through it.
 */
function arcade(ctx: CanvasRenderingContext2D, st: CutState, w: number, h: number, t: number): { hy: number; sx: number; sy: number; r: number } {
  const hy = w < 600 ? h * 0.92 : h * 0.7
  const r = Math.min(w * 0.22, h * 0.15)
  const geo = { hy, sx: w * 0.5, sy: hy - r * 0.62, r }
  const m = pixelMode()
  if (!m) return geo
  const k = m.k
  const vw = m.vw
  const vh = m.vh
  let L = st.layer
  if (!L || L.w !== vw || L.h !== vh) {
    const hyL = Math.round(hy / k)
    const rL = Math.max(6, Math.round(r / k))
    const sxL = Math.round(vw / 2)
    const syL = Math.round((hy - r * 0.62) / k)
    const farH = Math.max(8, Math.round(vh * 0.08))
    const front = makeCanvas(vw, vh)
    const f = front.getContext('2d')!
    paintRidge(f, vw, hyL, farH, hyL + 1, NSD.ridgeFar, NSD.ridgeFarRim, 21, 0.8)
    paintRidge(f, vw, hyL + 1, Math.round(farH * 0.5), hyL + 2, NSD.ridge, NSD.ridgeRim, 33, 0.4)
    ditherGradient(f, 0, hyL + 1, vw, vh, [NSD.water, NSD.waterD, NSD.sky1, NSD.sky0])
    f.fillStyle = NSD.foam
    f.fillRect(0, hyL + 1, vw, 1)
    const sun = makeCanvas(vw, vh)
    const sg = sun.getContext('2d')!
    paintSun(sg, sxL, syL, rL, NSD.sky5)
    sg.globalCompositeOperation = 'destination-out'
    sg.drawImage(front, 0, 0)
    sg.globalCompositeOperation = 'source-over'
    const back = makeCanvas(vw, vh)
    const bg = back.getContext('2d')!
    paintSky(bg, vw, hyL + 1)
    bg.drawImage(sun, 0, 0)
    bg.drawImage(front, 0, 0)
    L = st.layer = { w: vw, h: vh, back, sun, hy: hyL, sx: sxL, sy: syL, r: rL, starTop: Math.max(4, hyL - farH - rL * 2) }
  }
  // Through rect() first so the emissive layer is cleared under the backdrop.
  rect(ctx, 0, 0, w, h, INK)
  ctx.drawImage(L.back, 0, 0)
  drawStars(ctx, vw, L.starTop, t, 1, 7)
  // The sun and its glitter glow over the light map.
  const e = emissiveLayer()
  if (e) {
    e.drawImage(L.sun, 0, 0)
    const stripes = [NSD.sun0, NSD.sun1, NSD.sun2, NSD.sun3]
    for (let i = 0; i < 7; i++) {
      const y = L.hy + 2 + i * (i + 1)
      if (y >= vh) break
      const ww = Math.max(2, Math.round(L.r * (1.5 - i * 0.18)))
      const shift = Math.round(Math.sin(t * 2.2 + i * 1.7) * 2)
      e.fillStyle = stripes[Math.min(3, i >> 1)]!
      e.fillRect(L.sx - (ww >> 1) + shift, y, ww, 1)
    }
  }
  m.stage.light(L.sx, L.sy, L.r * 3.2, '#ff8a3d', 0.7)
  return geo
}

/** Cut text in Neon Shrine's 5×7 font, on the HUD layer (the font is upper case only). */
function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'left'): void {
  void ctx
  pixelText(s, x, y, size, color, align)
}

/** Typed out, one character per 30 ms, from `start`. */
function typed(s: string, t: number, start: number): string {
  if (t < start) return ''
  return s.slice(0, Math.floor((t - start) / 0.03))
}


/** Flat banks of storm cloud coming down over the arcade sky. */
function clouds(ctx: CanvasRenderingContext2D, w: number, h: number, hy: number, storm: number, t: number): void {
  for (let i = 0; i < 7; i++) {
    const y = -h * 0.2 + (hy * 0.55 + h * 0.2) * storm * (0.4 + hash(i) * 0.6)
    const x0 = (hash(i + 10) - 0.3) * w - (t * (20 + i * 6)) % (w * 0.4)
    const cw = w * (0.5 + hash(i + 20) * 0.6)
    poly(ctx, [[x0, y - 40], [x0 + cw * 0.2, y - 60], [x0 + cw * 0.7, y - 55], [x0 + cw, y - 20], [x0 + cw * 0.8, y + 12], [x0 + cw * 0.1, y + 8]], i % 2 ? '#1a0f30' : '#120a24')
  }
}

// ---- prologue ----

export function drawPrologue(ctx: CanvasRenderingContext2D, st: CutState, w: number, h: number, t: number, look: CutLook, reduced: boolean): void {
  const small = Math.min(w, h) < 520
  const fs = small ? 10 : 12
  const pad = small ? 18 : 40
  if (t < 0.4) {
    rect(ctx, 0, 0, w, h, INK)
    return
  }
  if (t < 12.5) {
    const a = arcade(ctx, st, w, h, t)
    // Storm: flat banks of cloud come down over the sky from 8 s.
    const storm = clamp((t - 8) / 3, 0, 1)
    if (storm > 0) {
      clouds(ctx, w, h, a.hy, storm, t)
      if (!reduced && Math.floor(t * 7) % 13 === 0) rect(ctx, 0, 0, w, a.hy, 'rgba(207,233,255,0.08)')
    }
    // The ship: into the screen toward the sun, trembling in the storm.
    const u = clamp((t - 0.4) / 12, 0, 1)
    const shake = storm > 0 && !reduced ? (hash(Math.floor(t * 30)) - 0.5) * 6 * storm : 0
    const x = w * 0.5 + Math.sin(t * 0.7) * w * 0.05 + shake
    const y = h * 0.86 - (h * 0.86 - a.hy - 18) * u * 0.55
    const size = (small ? 26 : 38) * (1 - u * 0.45)
    drawShip(ctx, x, y, size, -Math.PI / 2 + Math.sin(t * 0.7) * 0.12, look.accent, look.trim, true, small)
    // Flight log, typed, top left: machine voice.
    const lines: Array<[string, number, string]> = [
      [`PILOT ${look.pilot}`, 0.9, CYAN],
      [`${look.ship} · LAST RUN OF THE NIGHT`, 2.0, CYAN],
      ['02:14 · SECTOR 7 CLEAR · HEADING HOME', 3.4, CYAN],
      ['STORM CELL AHEAD', 8.3, PINK],
      ['SUN READING — UNSTABLE', 10.1, PINK],
    ]
    let ly = pad + textStep(fs)
    for (const [s, start, c] of lines) {
      const shown = typed(s, t, start)
      if (shown) text(ctx, shown, pad, ly, fs, c)
      ly += textStep(fs)
    }
    return
  }
  if (t < 14.6) {
    const a = arcade(ctx, st, w, h, t)
    clouds(ctx, w, h, a.hy, 1, t)
    // The strike: one white frame, then the bolt and the sun tearing open.
    if (t < 12.58 && !reduced) {
      rect(ctx, 0, 0, w, h, '#f4f0ff')
      return
    }
    const open = clamp((t - 12.6) / 1.0, 0, 1)
    const r = a.r * 1.05
    // A dark door down the sun's middle; the stripes pull apart around it.
    glow(ctx, PINK, small ? 0 : 24, () => poly(ctx, [[a.sx - r * 0.5 * open, a.sy - r], [a.sx + r * 0.5 * open, a.sy - r], [a.sx + r * 0.3 * open, a.hy], [a.sx - r * 0.3 * open, a.hy]], '#05030d'), small)
    if (t < 13.1) {
      const pts: Pt[] = [[a.sx - w * 0.2, 0]]
      for (let i = 1; i < 7; i++) pts.push([a.sx - w * 0.2 * (1 - i / 7) + (hash(i + 90) - 0.5) * 40, (a.sy - r) * (i / 7)])
      pts.push([a.sx, a.sy])
      for (let i = 0; i < pts.length - 1; i++) glow(ctx, '#ffffff', 16, () => bar(ctx, pts[i], pts[i + 1], 3, '#ffffff'), small)
    }
    // The ship is pulled in and gone.
    const u = clamp((t - 12.9) / 1.6, 0, 1)
    const x0 = w * 0.5
    const y0 = h * 0.86 - (h * 0.86 - a.hy - 18) * 0.55
    const x = x0 + (a.sx - x0) * u
    const y = y0 + (a.sy - y0) * u
    if (u < 1) drawShip(ctx, x, y, (small ? 26 : 38) * 0.55 * (1 - u * 0.9), -Math.PI / 2 + u * 7, look.accent, look.trim, true, small)
    return
  }
  if (t < 16.4) {
    rect(ctx, 0, 0, w, h, INK)
    const blink = Math.floor(t * 2.5) % 2 === 0 ? '_' : ' '
    text(ctx, `SIGNAL LOST${blink}`, w / 2, h / 2, fs + 2, PINK, 'center')
    return
  }
  if (t < 19.2) {
    rect(ctx, 0, 0, w, h, INK)
    const big = clamp(Math.min(w, h) * 0.11, 30, 76)
    text(ctx, 'another shore', w / 2, h * 0.48, big, '#ece4f4', 'center')
    text(ctx, 'A CROSSING IN FIVE CHAPTERS', w / 2, h * 0.48 + big * 0.9, fs, CYAN, 'center')
    return
  }
  // Under water: the ship goes down, the pilot comes loose.
  rect(ctx, 0, 0, w, h, '#140a2e')
  for (let i = 0; i < 5; i++) {
    const x = w * (0.1 + i * 0.2) + Math.sin(t * 0.4 + i) * 20
    poly(ctx, [[x, 0], [x + 40, 0], [x + 140, h], [x + 90, h]], '#1b0f3a')
  }
  rect(ctx, 0, h * 0.9, w, h * 0.1, '#0b0616')
  const u = clamp((t - 19.2) / 2.4, 0, 1)
  const sx = w * 0.46
  const sy = -60 + (h * 0.84 + 60) * (1 - (1 - u) * (1 - u))
  drawShip(ctx, sx, sy, small ? 40 : 64, 0.35 + u * 0.8, '#3a2b5e', '#5a4190', false, true)
  if (Math.floor(t * 1.5) % 3 !== 0) rect(ctx, sx + 6, sy, 4, 4, look.accent)
  for (let i = 0; i < 14; i++) {
    const bt = (t * 0.7 + hash(i) ) % 1
    rect(ctx, sx + (hash(i + 5) - 0.5) * 80 + Math.sin(bt * 8 + i) * 6, sy - bt * h * 0.8, 3, 3, '#3b2a6a')
  }
  if (t > 20.8) {
    const k = clamp((t - 20.8) / 2.2, 0, 1)
    const px = sx - 30
    const py = sy - 40 - k * h * 0.35
    const v: View = {
      width: w, height: h, s: small ? 0.9 : 1.4, camX: 0, camY: 0, camCenter: 0, horizonY: 0, portrait: h > w, cheap: small,
      X: wx => wx, Y: wy => wy,
    }
    drawPilotAt(ctx, v, SCENES.dusk, px, py, 1, look, 'swim', Math.floor(t * 3))
  }
}

// ---- the capture ----

export function drawCapture(ctx: CanvasRenderingContext2D, cam: Camera, game: Game, w: number, h: number, t: number, look: CutLook, drawWorldBase: (v: View) => void, reduced: boolean): void {
  const world = game.world
  const focus = { x: CAPTURE_X + 40, y: world.groundY, vx: 0 }
  const v = makeView(cam, world, w, h, focus)
  const sc = SCENES.night
  drawWorldBase(v)
  const px = world.player.x
  const gy = world.groundY
  // 0–1.2 s the beast comes over the gap; 1.2 a pink bolt takes it out of the air.
  const leapU = clamp(t / 1.2, 0, 1)
  const bx0 = 3990
  const bx = bx0 + (px - 40 - bx0) * leapU
  const by = gy - Math.sin(leapU * Math.PI) * 90
  if (t < 1.2) {
    drawBeastAt(ctx, v, bx, by, 1, 0, true)
  } else if (t < 2.4) {
    const f = clamp((t - 1.2) / 1.2, 0, 1)
    drawBeastAt(ctx, v, bx - f * 40, by + f * f * 420, 1, 0, true)
  }
  if (t >= 1.15 && t < 1.35) {
    const y = v.Y(by - 30)
    glow(ctx, PINK, 18, () => rect(ctx, v.X(bx), y - 2 * v.s, w - v.X(bx), 4 * v.s, PINK), v.cheap)
    if (!reduced && t < 1.22) rect(ctx, 0, 0, w, h, 'rgba(255,47,160,0.25)')
  }
  // The pilot turns, backs off; two guards walk in from the right.
  const back = t > 2.2 ? clamp((t - 2.2) / 1.6, 0, 1) * 30 : 0
  const down = t > 4.6
  drawPilotAt(ctx, v, sc, px - back, gy, t > 2.0 ? 1 : -1, look, down ? (t > 4.9 ? 'dead' : 'fall') : 'idle')
  const gIn = clamp((t - 2.0) / 2.0, 0, 1)
  for (let i = 0; i < 2; i++) {
    const gx = px + 420 + i * 70 - gIn * 250
    drawGuard(ctx, v, sc, {
      kind: 'guard', id: 90 + i, x: gx, y: gy, facing: -1, state: t > 4.1 && i === 0 ? 'alert' : gIn < 1 ? 'walk' : 'idle',
      goalX: gx, fireT: 0, shieldT: 0, alertT: 0, crouch: false, crouchT: 0, t, range: 1, shieldHp: 0, fireEvery: 0,
    }, t)
  }
  if (t >= 4.5 && t < 4.62) {
    glow(ctx, PINK, 18, () => rect(ctx, v.X(px - back), v.Y(gy - 36) - 2 * v.s, v.X(px + 170) - v.X(px - back), 4 * v.s, PINK), v.cheap)
  }
  if (t >= 4.62 && t < 4.7 && !reduced) rect(ctx, 0, 0, w, h, '#f4f0ff')
  if (t > 5.3) rect(ctx, 0, 0, w, h, INK)
}

// ---- the ending ----

export function drawEnding(ctx: CanvasRenderingContext2D, st: CutState, cam: Camera, game: Game, w: number, h: number, t: number, look: CutLook, drawWorldBase: (v: View, sunLift: number) => void, reduced: boolean): void {
  const world = game.world
  const lamp = world.lamps[world.lamps.length - 1]
  const lx = lamp?.x ?? 2520
  const ly = lamp?.y ?? -240
  const sc = SCENES.dawn
  const small = Math.min(w, h) < 520
  if (t < 19) {
    // One fixed shot on the lamp platform. The sea horizon sits on the
    // cliff edge, so the sun comes up from behind the rock.
    const focus = { x: lx - 90, y: ly, vx: 0, frac: 0.68, horizon: ly - 2 }
    const v = makeView(cam, world, w, h, focus)
    const lift = 0.1 + clamp(t / 8, 0, 1) * 1.15
    drawWorldBase(v, lift)
    const px = lx - 70
    const gx = lx - 360
    const bxLand = gx - 30
    // 0–3.1 the pilot stands in the light. 2.2 the last guard pulls himself
    // up over the edge behind; 3.1 he fires. 3.7 the friend drops on him.
    if (t < 3.2) drawPilotAt(ctx, v, sc, px, ly, 1, look, 'idle')
    else if (t < 3.45) drawPilotAt(ctx, v, sc, px, ly, 1, look, 'fall')
    else if (t < 7.6) drawPilotAt(ctx, v, sc, px, ly, 1, look, 'dead')
    if (t > 2.2 && t < 12) {
      const state = t < 3.9 ? 'alert' : t < 4.5 ? 'dying' : 'dead'
      drawGuard(ctx, v, sc, {
        kind: 'guard', id: 99, x: gx, y: ly, facing: 1, state, goalX: gx, fireT: 0, shieldT: 0,
        alertT: 0, crouch: false, crouchT: 0, t: state === 'dying' ? t - 3.9 : 1, range: 1, shieldHp: 0, fireEvery: 0,
      }, t)
    }
    if (t >= 3.1 && t < 3.24) glow(ctx, PINK, 16, () => rect(ctx, v.X(gx + 22), v.Y(ly - 36) - 2 * v.s, v.X(px) - v.X(gx + 22), 4 * v.s, PINK), v.cheap)
    if (t >= 3.6 && t < 7.6) {
      // Down from the tower onto the guard, then to the pilot's side.
      const drop = clamp((t - 3.6) / 0.3, 0, 1)
      const runU = clamp((t - 4.4) / 1.3, 0, 1)
      const bx = bxLand + (px - 26 - bxLand) * runU
      const by = ly - (1 - drop) * 260
      drawBuddyAt(ctx, v, sc, bx, by, 1, drop < 1 ? 'stand' : runU > 0 && runU < 1 ? 'run' : 'stand', t)
    }
    // The winged thing comes in from the sun and settles off the edge.
    const inU = clamp((t - 6.2) / 2.8, 0, 1)
    const ease = 1 - (1 - inU) * (1 - inU)
    const wx = lx + 600 - ease * 420
    const wy = ly - 300 + ease * 270 + Math.sin(t * 2) * 5
    if (t > 6.2 && t < 10.6) drawWinged(ctx, v, wx, wy, 1.5, t, -1)
    if (t >= 7.6 && t < 10.6) {
      const cu = clamp((t - 7.6) / 2.2, 0, 1)
      const bx = px - 26 + (wx - 36 - (px - 26)) * cu
      const by = ly - Math.max(0, cu - 0.8) * 5 * 26
      drawBuddyAt(ctx, v, sc, bx, by, 1, cu < 1 ? 'carry' : 'stand', t)
      drawPilotAt(ctx, v, sc, bx + 12, by - 36, 1, look, 'dead')
    }
    if (t >= 10.6) {
      // Away into the sun, smaller every beat.
      const fu = clamp((t - 10.6) / 8, 0, 1)
      const start = { x: v.X(wx), y: v.Y(wy) }
      const sun = sunGeom(v, lift)
      const x = start.x + (sun.x - start.x) * fu
      const y = start.y + (sun.y - start.y) * fu - Math.sin(fu * Math.PI) * h * 0.08
      const k = v.s * (1.5 - fu * 1.4)
      const flyV: View = { ...v, s: k / 1, X: q => q, Y: q => q }
      drawWinged(ctx, flyV, x, y, 1, t, 1)
      if (fu < 0.8) {
        glow(ctx, look.accent, 8, () => rect(ctx, x - 8 * k, y - 26 * k, 6 * k, 9 * k, look.accent), v.cheap)
        rect(ctx, x + 2 * k, y - 34 * k, 5 * k, 17 * k, '#05030d')
      }
    }
    return
  }
  // Home: the neon grid again, the ship coming out of the sun toward us.
  const a = arcade(ctx, st, w, h, t)
  const u = clamp((t - 19) / 6, 0, 1)
  const x = a.sx + Math.sin(t) * 10
  const y = a.sy + (h * 0.8 - a.sy) * u
  drawShip(ctx, x, y, (small ? 10 : 14) + u * (small ? 26 : 40), Math.PI / 2, look.accent, look.trim, true, small)
  const fs = small ? 10 : 12
  const lines: Array<[string, number, string]> = [
    ['SIGNAL FOUND', 19.8, GOLD],
    [`WELCOME BACK, ${look.pilot}`, 21.0, CYAN],
  ]
  let ly2 = (small ? 18 : 40) + textStep(fs)
  for (const [s, start, c] of lines) {
    const shown = typed(s, t, start)
    if (shown) text(ctx, shown, small ? 18 : 40, ly2, fs, c)
    ly2 += textStep(fs)
  }
  void reduced
}

// ---- the chapter card ----

export function drawCard(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, chapter: 1 | 2 | 3 | 4 | 5, dark: boolean): void {
  if (t < 0.35) {
    rect(ctx, 0, 0, w, h, INK)
    return
  }
  const c = CHAPTERS[chapter]
  const big = clamp(Math.min(w, h) * 0.075, 24, 54)
  const y = h * 0.3
  text(ctx, `CHAPTER ${c.roman}`, w / 2, y - big * 0.9 - (pixelMode()?.k ?? 0) * 4, Math.max(10, big * 0.26), dark ? '#3a1f4c' : CYAN, 'center')
  text(ctx, c.title, w / 2, y, big, dark ? '#1a0f24' : '#ece4f4', 'center')
}

export { drawSun, disc }
