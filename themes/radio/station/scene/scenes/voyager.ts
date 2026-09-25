// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Voyager — through a ship's window. Outside: nebulae, a ringed planet
 * with a small moon going round it, asteroids tumbling past and a
 * starfield streaming toward us (faster as the music builds). Inside: the
 * window frame and a console whose row of lights plays along with the
 * sequencer (each note lights the lamp at its pitch) and breathes with the
 * kick, beside a little scope tracing a wave.
 */
import { rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { makeCanvas } from '../pixel/stage.ts'
import { layer, melodic, rng, wrap, type FrameCtx, type G, type Lights, type Place } from '../lib/kit.ts'
import { INK } from '../lib/paint.ts'
import { drawFlyers, makeFlyers, paintNebula, paintPlanet, rockFrames, type Flyer } from '../lib/space.ts'

const LEDS = ['#2ff3ff', '#3fd8b0', '#b6ff4a', '#ffd23f', '#ff8a3d', '#ff2fa0', '#ff8ae0', '#9a4ff0']

export function createVoyager(): Place {
  let W = 0
  let H = 0
  let win = { x0: 0, y0: 0, x1: 0, y1: 0, cut: 0 }
  let space: HTMLCanvasElement | null = null
  let frame: HTMLCanvasElement | null = null
  let mask: HTMLCanvasElement | null = null
  let planet = { x: 0, y: 0, r: 0 }
  let rocks: HTMLCanvasElement[][] = []
  let flyers: Flyer[] = []
  let leds: { x: number; y: number }[] = []
  let scope = { x: 0, y: 0, w: 0, h: 0 }
  let levels: number[] = []
  const seed = rng(5)

  function inWindow(x: number, y: number): boolean {
    const { x0, y0, x1, y1, cut } = win
    if (x < x0 || x > x1 || y < y0 || y > y1) return false
    const dx = Math.min(x - x0, x1 - x)
    const dy = Math.min(y - y0, y1 - y)
    return dx + dy >= cut
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    const m = Math.round(Math.min(w, h) * 0.07)
    win = { x0: m, y0: m, x1: w - m - 1, y1: Math.round(h * (portrait ? 0.74 : 0.7)), cut: Math.round(m * 1.4) }
    planet = { x: Math.round(w * (portrait ? 0.62 : 0.68)), y: Math.round(win.y1 - (win.y1 - win.y0) * 0.36), r: Math.round(Math.min(w, h) * (portrait ? 0.2 : 0.17)) }
    space = layer(w, h, g => {
      rect(g, '#07040f', 0, 0, w, h)
      paintNebula(g, w, h, w * 0.3, h * 0.35, w * 0.45, h * 0.35, ['#1a0f33', '#2a1450', '#4a1a6a', '#7a2a86', '#b0347e', '#e0508a'], 11)
      paintNebula(g, w, h, w * 0.75, h * 0.2, w * 0.3, h * 0.22, ['#0f1a40', '#16305a', '#1a5a7a', '#2a8a9a', '#5fd6b8'], 23, 0.9)
      // Fixed far stars.
      const R = rng(3)
      for (let i = 0; i < (w * h) / 90; i++) {
        const x = Math.floor(R() * w)
        const y = Math.floor(R() * h)
        const b = R()
        rect(g, b > 0.97 ? '#fff4ff' : b > 0.8 ? '#cfc6ff' : '#5a4f90', x, y, 1, 1)
      }
      paintPlanet(g, planet.x, planet.y, planet.r, {
        bands: ['#54259e', '#7a3a8a', '#9a4ff0', '#b0547e', '#7a3a8a', '#e0508a', '#9a4ff0', '#54259e'],
        dark: '#140b26',
        rim: '#ffd0ec',
        ring: ['#6a4fb0', '#8f86b8', '#cfc6ff', '#a79ed8', '#6a5fa0'],
      }, -0.8, -0.5, 0.26)
    })
    mask = layer(w, h, g => {
      g.fillStyle = '#ffffff'
      for (let y = win.y0; y <= win.y1; y++) for (let x = win.x0; x <= win.x1; x++) if (inWindow(x, y)) g.fillRect(x, y, 1, 1)
    })
    leds = []
    frame = layer(w, h, g => {
      // Hull interior everywhere but the window: panels, seams, rivets.
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        if (inWindow(x, y)) continue
        const px = Math.floor(x / 24)
        const py = Math.floor(y / 18)
        let col = (px + py) % 2 ? '#241838' : '#2a1d42'
        if (x % 24 === 0 || y % 18 === 0) col = '#140b24'
        else if (x % 24 === 1 || y % 18 === 1) col = '#3a2a5a'
        if ((x % 24 === 3 || x % 24 === 21) && (y % 18 === 3 || y % 18 === 15)) col = '#5a5285'
        rect(g, col, x, y, 1, 1)
      }
      // Window rim: a dark lip, a lit bevel and a cyan strip.
      for (let y = win.y0 - 3; y <= win.y1 + 3; y++) for (let x = win.x0 - 3; x <= win.x1 + 3; x++) {
        if (inWindow(x, y)) continue
        const n1 = inWindow(x + 1, y) || inWindow(x - 1, y) || inWindow(x, y + 1) || inWindow(x, y - 1)
        const n2 = inWindow(x + 2, y) || inWindow(x - 2, y) || inWindow(x, y + 2) || inWindow(x, y - 2)
        const n3 = inWindow(x + 3, y) || inWindow(x - 3, y) || inWindow(x, y + 3) || inWindow(x, y - 3)
        if (n1) rect(g, INK, x, y, 1, 1)
        else if (n2) rect(g, '#2ff3ff', x, y, 1, 1)
        else if (n3) rect(g, '#5a5285', x, y, 1, 1)
      }
      // A strut down the middle of the glass.
      const sx = Math.round(w * (portrait ? 0.5 : 0.38))
      rect(g, INK, sx - 2, win.y0, 5, win.y1 - win.y0)
      rect(g, '#3a2a5a', sx - 1, win.y0, 3, win.y1 - win.y0)
      rect(g, '#5a5285', sx - 1, win.y0, 1, win.y1 - win.y0)
      // Console: a slanted desk under the window.
      const cy = win.y1 + Math.round((h - win.y1) * 0.3)
      rect(g, '#140b24', 0, cy - 1, w, 1)
      for (let y = cy; y < h; y++) rect(g, y < cy + 3 ? '#4a3d78' : '#2c2050', 0, y, w, 1)
      const n = portrait ? 8 : 16
      const lx0 = Math.round(w * (portrait ? 0.12 : 0.1))
      const step = Math.round((w * (portrait ? 0.5 : 0.42)) / n)
      const ly = cy + Math.round((h - cy) * 0.35)
      for (let i = 0; i < n; i++) {
        const x = lx0 + i * step
        rect(g, INK, x - 1, ly - 1, 4, 4)
        rect(g, '#1a1030', x, ly, 2, 2)
        leds.push({ x, y: ly })
      }
      scope = { x: Math.round(w * (portrait ? 0.68 : 0.62)), y: cy + 3, w: Math.round(w * (portrait ? 0.24 : 0.18)), h: Math.max(8, Math.round((h - cy) * 0.6)) }
      rect(g, INK, scope.x - 1, scope.y - 1, scope.w + 2, scope.h + 2)
      rect(g, '#0a1a24', scope.x, scope.y, scope.w, scope.h)
      for (let x = scope.x; x < scope.x + scope.w; x += 4) rect(g, '#123040', x, scope.y, 1, scope.h)
      rect(g, '#123040', scope.x, scope.y + Math.floor(scope.h / 2), scope.w, 1)
      // Two chunky switches.
      for (let i = 0; i < 2; i++) {
        const bx = Math.round(w * (portrait ? 0.08 : 0.86)) + i * 8
        rect(g, INK, bx, scope.y + 1, 5, 5)
        rect(g, i ? '#ff2fa0' : '#ffd23f', bx + 1, scope.y + 2, 3, 2)
      }
    })
    rocks = [rockFrames(3, 1, 12, makeCanvas), rockFrames(5, 2, 16, makeCanvas), rockFrames(2, 3, 8, makeCanvas), rockFrames(4, 4, 12, makeCanvas)]
    flyers = makeFlyers(Math.round((w * h) / 700), seed)
    levels = new Array(leds.length).fill(0)
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!space || !frame || !mask) return
    g.drawImage(space, 0, 0)
    drawFlyers(g, flyers, W, H, W * 0.42, H * 0.36, c.dt, 0.05 + c.energy * 0.07, seed)
    // A small moon orbiting the planet, passing behind it.
    const a = c.t * 0.05
    const mx = planet.x + Math.cos(a) * planet.r * 2.6
    const my = planet.y + Math.sin(a) * planet.r * 0.7
    if (Math.sin(a) > 0 || Math.abs(mx - planet.x) > planet.r) {
      rect(g, '#cfc6ff', Math.round(mx) - 1, Math.round(my) - 1, 3, 3)
      rect(g, '#8f86b8', Math.round(mx), Math.round(my), 2, 2)
    }
    // Asteroids drifting across the view.
    rocks.forEach((fr, i) => {
      const sp = 3 + i * 1.7 + c.energy * 3
      const x = wrap(W * (0.2 + i * 0.27) - c.t * sp, W + 40) - 20
      const y = win.y0 + (win.y1 - win.y0) * (0.2 + ((i * 0.37) % 0.7)) + Math.sin(c.t * 0.1 + i) * 6
      const f = fr[Math.floor(wrap(c.t * (0.6 + i * 0.2), fr.length))]!
      g.drawImage(f, Math.round(x), Math.round(y))
    })
    L.emitImage(mask)
    g.drawImage(frame, 0, 0)
    L.light(planet.x, planet.y, planet.r * 2.4, '#ff8ae0', 0.25)
    // Window glow on the frame edge.
    L.light(W * 0.5, win.y1, W * 0.35, '#2ff3ff', 0.18)
    // Console lamps: each note lights the lamp at its pitch.
    const n = leds.length
    for (const nh of c.notes) {
      if (!melodic(nh.layer)) continue
      const ix = Math.max(0, Math.min(n - 1, Math.round(nh.h * (n - 1))))
      levels[ix] = 1
    }
    for (let i = 0; i < n; i++) {
      levels[i] = Math.max(0, levels[i]! - c.dt * 2.2)
      const led = leds[i]!
      const col = LEDS[Math.floor((i / n) * LEDS.length)]!
      const on = Math.max(levels[i]!, 0.3 + 0.2 * c.beat)
      rect(g, on > 0.4 ? col : mix('#1a1030', col, on * 1.6), led.x, led.y, 2, 2)
      L.emit(led.x, led.y, 2, 2)
      if (on > 0.3) L.light(led.x + 1, led.y + 1, 6, col, on * 0.6)
    }
    // Scope trace.
    const amp = scope.h * (0.2 + 0.2 * (c.levels.pad ?? 0.5) + 0.1 * c.beat)
    let prev = -1
    for (let x = 0; x < scope.w; x++) {
      const y = Math.round(scope.y + scope.h / 2 + Math.sin(x * 0.35 + c.t * 3) * amp * Math.sin(x * 0.05 + c.t * 0.7))
      rect(g, '#5fd6b8', scope.x + x, y, 1, 1)
      if (prev >= 0 && Math.abs(y - prev) > 1) rect(g, '#2a8579', scope.x + x, Math.min(y, prev), 1, Math.abs(y - prev))
      prev = y
    }
    L.emit(scope.x, scope.y, scope.w, scope.h)
    L.light(scope.x + scope.w / 2, scope.y + scope.h / 2, scope.w, '#5fd6b8', 0.25)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#8a80c0', '#6a5f9e', c.dark * 0.5), '#b4a8e0', c.energy * 0.1),
    horizon: () => Math.round(H * 0.4),
  }
}
