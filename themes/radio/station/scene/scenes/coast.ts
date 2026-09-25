// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Neon Coast — Neon Shrine's home. Dusk over the sea: the striped sun on the
 * horizon with cloud streaks drifting across it, a far headland, the sun's
 * reflection broken into gold dashes, a pier with lamps (they breathe with
 * the kick), palms on the beach, gulls, slow waves washing the sand.
 * Bells and leads light stars; arp notes glint on the water.
 */
import { DUSK, ditherGradient, drawStars, hash2, noise1, paintSky, paintSun, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { drawSparks, layer, melodic, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { INK, paintPalm } from '../lib/paint.ts'

interface Palm { x: number; base: number; h: number; lean: number; salt: number; frames: HTMLCanvasElement[] }

export function createCoast(): Place {
  let W = 0
  let hz = 0
  let shore = 0
  let deckY = 0
  let pierX0 = 0
  let back: HTMLCanvasElement | null = null
  let sunC: HTMLCanvasElement | null = null
  let land: HTMLCanvasElement | null = null
  let pier: HTMLCanvasElement | null = null
  let sun = { x: 0, y: 0, r: 0 }
  let lamps: { x: number; y: number }[] = []
  let palms: Palm[] = []
  const sparks: Spark[] = []

  function layout(w: number, h: number) {
    W = w
    const portrait = h > w * 1.1
    hz = Math.round(h * (portrait ? 0.55 : 0.58))
    shore = Math.round(h * (portrait ? 0.8 : 0.83))
    const r = Math.max(12, Math.min(30, Math.round(Math.min(w, h) * 0.15)))
    sun = { x: Math.round(w * (portrait ? 0.56 : 0.64)), y: hz - Math.round(r * 0.25), r }
    back = layer(w, h, g => {
      paintSky(g, w, hz + 1)
      // Sea: the sky's warm band near the horizon deepening to blue toward us.
      ditherGradient(g, 0, hz, w, shore + 2, [DUSK.sky5, DUSK.sky4, '#2a2468', DUSK.water, DUSK.waterD])
    })
    sunC = layer(w, h, g => paintSun(g, sun.x, sun.y, sun.r))
    // A far headland on the left, a low island on the right; both over the sun's foot.
    land = layer(w, h, g => {
      const edge = Math.round(w * (portrait ? 0.34 : 0.3))
      for (let x = 0; x < edge + 30; x++) {
        const fall = Math.max(0, Math.min(1, (x - edge * 0.55) / (edge * 0.6)))
        const top = Math.round(hz - (noise1(x, 22, 4) * 0.6 + 0.5) * h * 0.085 * (1 - fall * fall) - 1)
        if (top >= hz) continue
        rect(g, DUSK.ridgeFar, x, top, 1, hz - top + 1)
        rect(g, DUSK.ridgeFarRim, x, top, 1, 1)
      }
      const ix = Math.round(w * 0.86)
      for (let x = ix - 26; x < ix + 26; x++) {
        const d = Math.abs(x - ix) / 26
        const top = Math.round(hz - (1 - d * d) * 5 - noise1(x, 6, 9) * 2)
        if (top >= hz) continue
        rect(g, '#241a4c', x, top, 1, hz - top + 1)
        rect(g, DUSK.ridgeFarRim, x, top, 1, 1)
      }
      rect(g, DUSK.sky6, 0, hz, w, 1)
      // Beach.
      ditherGradient(g, 0, shore, w, h, [DUSK.pathL, DUSK.path, DUSK.pathD, '#3e2448'])
      for (let y = shore + 2; y < h; y += 2) for (let x = 0; x < w; x += 3) {
        const n = hash2(x, y, 31)
        if (n > 0.93) rect(g, DUSK.pathL, x, y, 2, 1)
        else if (n < 0.05) rect(g, '#3e2448', x, y, 2, 1)
      }
      // A rowboat pulled up on the sand, and a few stones.
      const bx = Math.round(w * (portrait ? 0.55 : 0.4))
      const by = Math.round(shore + (h - shore) * 0.5)
      const bw = Math.max(18, Math.round(w * 0.07))
      for (let y = 0; y < 5; y++) {
        const inset = y < 2 ? 0 : y - 1
        rect(g, y === 0 ? '#b0543a' : y === 4 ? '#241430' : '#5b2a1c', bx - Math.round(bw / 2) + inset, by + y, bw - inset * 2, 1)
      }
      rect(g, '#e07a4e', bx - Math.round(bw / 2), by, bw, 1)
      rect(g, '#241430', bx - Math.round(bw / 2) + 3, by + 1, bw - 6, 1)
      rect(g, '#3a2240', bx - 3, by - 1, 1, 2)
      rect(g, '#3e2448', bx - Math.round(bw / 2) - 2, by + 5, bw + 5, 1)
      for (let i = 0; i < 6; i++) {
        const sx = Math.round(hash2(i, 1, 37) * w)
        const sy = Math.round(shore + 4 + hash2(i, 2, 37) * (h - shore - 6))
        rect(g, '#5e3862', sx, sy, 3, 2)
        rect(g, '#9b6593', sx, sy, 2, 1)
      }
    })
    // The pier: plank deck on posts from the right edge out over the sea.
    deckY = Math.round(hz + (shore - hz) * 0.36)
    pierX0 = Math.round(w * (portrait ? 0.38 : 0.5))
    lamps = []
    pier = layer(w, h, g => {
      rect(g, INK, pierX0, deckY - 1, w - pierX0, 4)
      rect(g, '#5e3862', pierX0, deckY, w - pierX0, 1)
      rect(g, '#3a2240', pierX0, deckY + 1, w - pierX0, 1)
      for (let x = pierX0 + 2; x < w; x += 7) {
        rect(g, INK, x, deckY + 3, 2, shore - deckY)
        rect(g, '#3a2240', x, deckY + 3, 1, shore - deckY)
      }
      // Railing.
      rect(g, INK, pierX0, deckY - 5, w - pierX0, 1)
      for (let x = pierX0; x < w; x += 5) rect(g, INK, x, deckY - 5, 1, 5)
      const step = portrait ? 34 : 40
      for (let x = pierX0 + 6; x < w - 2; x += step) {
        rect(g, INK, x, deckY - 15, 1, 15)
        rect(g, INK, x - 2, deckY - 18, 5, 3)
        rect(g, DUSK.window, x - 1, deckY - 17, 3, 2)
        rect(g, '#fff1b0', x, deckY - 17, 1, 1)
        lamps.push({ x: x + 0.5, y: deckY - 16 })
      }
    })
    const ph = portrait ? h * 0.4 : h * 0.7
    palms = [
      { x: Math.round(w * 0.06), base: h + 2, h: Math.round(ph), lean: 0.2, salt: 3, frames: [] },
      { x: Math.round(w * (portrait ? 0.2 : 0.22)), base: h + 1, h: Math.round(ph * 0.66), lean: -0.14, salt: 8, frames: [] },
    ]
    for (const p of palms) for (let f = 0; f < 5; f++) p.frames.push(layer(w, h, g => paintPalm(g, p.x, p.base, p.h, p.lean, (f - 2) / 2, p.salt)))
  }

  function drawSea(g: G, c: FrameCtx, L: Lights) {
    const t = c.t
    const speed = 1 + c.energy * 0.8
    // Wave crests: short light dashes, sparser and longer toward us, drifting.
    for (let y = hz + 2; y < shore; y++) {
      const d = (y - hz) / (shore - hz)
      const gap = Math.round(10 + d * 26)
      const len = 1 + Math.round(d * 5)
      const drift = t * (2 + d * 7) * speed
      const col = d < 0.35 ? '#8a3a8a' : d < 0.7 ? '#3f4fa0' : '#2d6a9a'
      for (let i = -1; i < W / gap + 1; i++) {
        const n = hash2(i, y, 7)
        if (n < 0.55) continue
        const x = Math.round(wrap(i * gap + n * gap + drift * (y % 2 ? 1 : -0.6), W + gap) - gap)
        const pulse = Math.sin(t * 0.9 * speed + n * 6 + y * 0.2)
        if (pulse < -0.2) continue
        rect(g, col, x, y, len, 1)
      }
    }
    // The sun's road: gold dashes that shimmer, widening toward us.
    for (let y = hz + 1; y < shore; y++) {
      const d = (y - hz) / (shore - hz)
      const half = sun.r * (0.55 + d * 0.9)
      const col = d < 0.25 ? DUSK.sun1 : d < 0.55 ? DUSK.sun2 : DUSK.sun3
      const seg = 3 + Math.round(d * 6)
      for (let x = -half; x < half; x += seg + 2) {
        const n = hash2(Math.round(x + 1000), y, 3)
        const s = Math.sin(t * 1.6 * speed + n * 9 + y * 0.7)
        if (s < 0.1 + d * 0.3) continue
        const lx = Math.round(sun.x + x + Math.sin(t * 0.8 + y) * 1.5)
        const lw = Math.max(1, Math.round(seg * (0.4 + 0.6 * s) * (1 - Math.abs(x) / half)))
        rect(g, col, lx, y, lw, 1)
        L.emit(lx, y, lw, 1)
      }
    }
    // Lamp reflections: broken vertical streaks under the pier's lamps.
    for (const l of lamps) {
      for (let y = deckY + 4; y < shore; y += 2) {
        const s = Math.sin(t * 2 + y * 0.8 + l.x)
        if (s < -0.2) continue
        const lw = s > 0.6 ? 3 : 2
        const lx = Math.round(l.x - lw / 2 + Math.sin(t * 1.3 + y * 0.5) * 1.2)
        rect(g, y - deckY < 10 ? DUSK.window : DUSK.sun2, lx, y, lw, 1)
        L.emit(lx, y, lw, 1)
      }
    }
  }

  function drawShore(g: G, c: FrameCtx) {
    // The wash: a foam line that runs up and back over the sand.
    const t = c.t * (0.6 + c.energy * 0.25)
    for (let x = 0; x < W; x++) {
      const reach = Math.sin(t + x * 0.035) * 1.6 + Math.sin(t * 0.6 + x * 0.09 + 2) * 1.1 + 2
      const y = shore + Math.round(reach)
      rect(g, DUSK.waterD, x, shore, 1, Math.max(0, y - shore))
      rect(g, DUSK.foam, x, y, 1, 1)
      if (hash2(x, Math.round(t * 4), 5) > 0.7) rect(g, '#cfc6ff', x, y - 1, 1, 1)
    }
  }

  function drawGulls(g: G, c: FrameCtx) {
    const n = 2 + Math.round(c.intensity * 0.5)
    for (let i = 0; i < n; i++) {
      const sp = 3 + hash2(i, 1, 51) * 4
      const x = Math.round(wrap(hash2(i, 2, 51) * W + c.t * sp, W + 20) - 10)
      const y = Math.round(hz * (0.2 + hash2(i, 3, 51) * 0.45) + Math.sin(c.t * 0.4 + i * 2) * 3)
      const up = Math.sin(c.t * (2.5 + i * 0.3) + i) > 0
      g.fillStyle = '#2a1a4c'
      g.fillRect(x, y, 1, 1)
      if (up) { g.fillRect(x - 2, y - 1, 2, 1); g.fillRect(x + 1, y - 1, 2, 1) } else { g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1); g.fillRect(x - 3, y + 1, 1, 1); g.fillRect(x + 3, y + 1, 1, 1) }
    }
  }

  function drawStreaks(g: G, c: FrameCtx) {
    // Thin cloud streaks crossing the sun, lit pink from below.
    const bands = [0.55, 0.7, 0.82, 0.9]
    bands.forEach((b, i) => {
      const y = Math.round(hz * b)
      const len = 30 + Math.round(hash2(i, 1, 61) * 60)
      const x = Math.round(wrap(hash2(i, 2, 61) * W + c.t * (1 + i * 0.6), W + len) - len)
      rect(g, i < 2 ? DUSK.sky5 : '#8c3a86', x, y, len, 1)
      rect(g, DUSK.sky7, x + 3, y + 1, len - 8, 1)
      if (i % 2 === 0) rect(g, DUSK.sky5, x + 10, y - 1, Math.round(len * 0.4), 1)
    })
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !sunC || !land || !pier) return
    g.drawImage(back, 0, 0)
    drawStars(g, W, Math.round(hz * 0.5), c.t, 0.9, 17)
    g.drawImage(sunC, 0, 0)
    L.emitImage(sunC)
    drawStreaks(g, c)
    g.drawImage(land, 0, 0)
    drawSea(g, c, L)
    drawShore(g, c)
    g.drawImage(pier, 0, 0)
    drawGulls(g, c)
    const sway = Math.sin(c.t * (0.7 + c.energy * 0.3)) * (0.5 + c.energy * 0.5) + Math.sin(c.t * 1.9) * 0.15
    for (const p of palms) {
      const f = Math.max(0, Math.min(4, Math.round((sway + 1) * 2 + (p.salt % 3 - 1) * 0.3)))
      g.drawImage(p.frames[f]!, 0, 0)
    }
    // Lights: the sun warms the sky and sea; lamps breathe with the kick.
    L.light(sun.x, sun.y, sun.r * 2.6, '#ff8a3d', 0.32)
    L.light(sun.x, hz + (shore - hz) * 0.5, sun.r * 1.6, '#ff2fa0', 0.18)
    for (const l of lamps) {
      L.emit(Math.round(l.x) - 1, Math.round(l.y) - 1, 3, 2)
      L.light(l.x, l.y + 3, 22, '#ffd23f', 0.42 + 0.14 * c.beat)
    }
    for (const n of c.notes) {
      if (!melodic(n.layer)) continue
      if (n.layer === 'arp') {
        if (Math.random() < 0.5) spawnSpark(sparks, sun.x + (Math.random() - 0.5) * sun.r * 2.4, hz + 2 + Math.random() * (shore - hz - 6), DUSK.sun0, false, 0.9)
      } else {
        spawnSpark(sparks, 6 + Math.random() * (W - 12), 3 + (1 - n.h) * hz * 0.55, n.layer === 'bells' ? '#fff4ff' : mix(c.accent, '#ffffff', 0.4), n.layer === 'bells')
      }
    }
    drawSparks(g, sparks, c.dt, L)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#a497d4', '#6f5f9e', c.dark * 0.45), '#d8ccf4', c.energy * 0.15),
    horizon: () => hz,
  }
}
