// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Night Drive — the coastal highway at night, seen from the side. Our car
 * cruises right toward the city on the horizon; streetlights sweep past and
 * light it, palms and the guard rail stream by at their own depths, the
 * moon lays a path on the sea, and now and then a car comes the other way.
 * Intensity is the speedometer: the road runs faster as the music builds.
 */
import { disc, ditherGradient, hash2, noise1, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { drawSparks, layer, melodic, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { INK, drawStarList, makeStars, paintMoon, paintPalm, type Star } from '../lib/paint.ts'

export function createNightdrive(): Place {
  let W = 0
  let H = 0
  let hz = 0
  let roadTop = 0
  let roadBot = 0
  let back: HTMLCanvasElement | null = null
  let moonC: HTMLCanvasElement | null = null
  let city: HTMLCanvasElement | null = null
  let palm: HTMLCanvasElement | null = null
  let stars: Star[] = []
  let moon = { x: 0, y: 0, r: 0 }
  let cityWins: { x: number; y: number; c: string }[] = []
  let masts: { x: number; y: number }[] = []
  let dist = 0
  let lastT = -1
  const sparks: Spark[] = []

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    hz = Math.round(h * (portrait ? 0.5 : 0.48))
    roadTop = Math.round(h * (portrait ? 0.66 : 0.68))
    roadBot = Math.round(h * (portrait ? 0.8 : 0.88))
    const mr = Math.max(7, Math.round(Math.min(w, h) * 0.055))
    moon = { x: Math.round(w * 0.22), y: Math.round(hz * 0.35), r: mr }
    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, hz + 1, ['#07050f', '#0e0a24', '#170f32', '#241646', '#3a1f5c', '#5a2a70'])
      // Sea: dark, with a warm band under the city glow.
      ditherGradient(g, 0, hz, w, roadTop, ['#2a1a4c', '#15204e', '#0f1a40', '#0b1434'])
      // The near verge below the road.
      rect(g, '#140c26', 0, roadBot, w, h - roadBot)
      for (let y = roadBot + 2; y < h; y += 2) for (let x = 0; x < w; x += 5) if (hash2(x, y, 5) > 0.85) rect(g, '#22163c', x, y, 3, 1)
    })
    moonC = layer(w, h, g => paintMoon(g, moon.x, moon.y, moon.r))
    stars = makeStars(w, Math.round(hz * 0.85), 1, 61)
    cityWins = []
    masts = []
    city = layer(w, h, g => {
      // Headland running out to the city, and the skyline on it.
      const cx0 = Math.round(w * (portrait ? 0.42 : 0.55))
      for (let x = cx0 - 20; x < w; x++) {
        const rise = Math.min(1, (x - cx0 + 20) / 30)
        const top = Math.round(hz - rise * 3 - noise1(x, 9, 3) * 2)
        rect(g, '#1c1440', x, top, 1, hz - top + 1)
      }
      let x = cx0
      let i = 0
      while (x < w + 4) {
        const bw = 5 + Math.floor(hash2(i, 1, 7) * 9)
        const bh = Math.round(h * (0.04 + Math.pow(hash2(i, 2, 7), 1.5) * 0.16) * (x < cx0 + 30 ? 0.5 : 1))
        const top = hz - 3 - bh
        const col = hash2(i, 3, 7) > 0.5 ? '#1c1440' : '#241a50'
        rect(g, col, x, top, bw, bh + 3)
        rect(g, '#3a2a70', x, top, bw, 1)
        for (let wy = top + 2; wy < hz - 4; wy += 2) for (let wx = x + 1; wx < x + bw - 1; wx += 2) {
          if (hash2(wx, wy, i + 9) > 0.72) {
            const c = hash2(wx, wy, 3) > 0.8 ? '#2ff3ff' : hash2(wx, wy, 4) > 0.7 ? '#ff8ae0' : '#ffd23f'
            rect(g, c, wx, wy, 1, 1)
            cityWins.push({ x: wx, y: wy, c })
          }
        }
        if (bh > h * 0.13) {
          rect(g, INK, x + Math.floor(bw / 2), top - 5, 1, 5)
          masts.push({ x: x + Math.floor(bw / 2), y: top - 6 })
        }
        x += bw + (hash2(i, 4, 7) > 0.7 ? 2 : 0)
        i++
      }
    })
    const ph = Math.round(h * (portrait ? 0.2 : 0.3))
    palm = layer(ph * 2, ph + 4, g => paintPalm(g, ph, ph + 4, ph, 0.12, 0, 5))
  }

  function drawSea(g: G, c: FrameCtx, L: Lights) {
    // Moon path and city lights on the water.
    for (let y = hz + 1; y < roadTop - 2; y++) {
      const d = (y - hz) / (roadTop - hz)
      if ((y - hz) % 2) continue
      const half = moon.r * (0.4 + d * 0.9)
      for (let x = -half; x < half; x += 4) {
        const s = Math.sin(c.t * 1.2 + hash2(Math.round(x + 99), y, 3) * 9 + y * 0.6)
        if (s < 0.4) continue
        const lx = Math.round(moon.x + x + Math.sin(c.t + y) * 1.2)
        const lw = s > 0.8 ? 3 : 2
        rect(g, d < 0.3 ? '#cfc6ff' : '#8f86b8', lx, y, lw, 1)
      }
      if (y < hz + 14) for (let i = 0; i < cityWins.length; i += 7) {
        const cw = cityWins[i]!
        if (Math.sin(c.t * 2 + i + y) < 0.2) continue
        rect(g, cw.c, cw.x + Math.round(Math.sin(c.t + y) * 1), y, 1, 1)
      }
    }
    // Slow swell lines.
    for (let y = hz + 3; y < roadTop - 2; y += 3) {
      const off = Math.round(wrap(c.t * (3 + (y - hz) * 0.2), 24))
      for (let x = -24; x < W; x += 24) if (hash2(x, y, 11) > 0.5) rect(g, '#1f2c62', x + off, y, 6, 1)
    }
  }

  function drawCar(g: G, c: FrameCtx, L: Lights, x: number, y: number) {
    const bob = Math.sin(c.t * 9) > 0.93 ? 1 : 0
    y -= bob
    // Body outline, body, cabin.
    rect(g, INK, x - 1, y - 7, 44, 6)
    rect(g, INK, x + 10, y - 12, 23, 6)
    for (let r = 0; r < 5; r++) {
      const inset = 4 - r
      rect(g, r === 0 ? '#1a0f2a' : '#1a2f78', x + 11 + inset, y - 11 + r, 21 - inset * 2 + 2, 1)
    }
    rect(g, '#2ff3ff', x + 22, y - 10, 1, 1)
    rect(g, '#2ff3ff', x + 21, y - 9, 1, 2)
    rect(g, INK, x + 19, y - 11, 1, 5)
    rect(g, '#ff2fa0', x, y - 6, 42, 4)
    rect(g, '#ff8ae0', x + 1, y - 6, 40, 1)
    rect(g, '#b01874', x, y - 3, 42, 1)
    rect(g, '#2ff3ff', x + 2, y - 4, 38, 1)
    // Wheels with turning spokes.
    const spin = dist * 0.35
    for (const wx of [x + 9, x + 33]) {
      disc(g, INK, wx, y - 1, 4)
      disc(g, '#3a2a5a', wx, y - 1, 2)
      const a = spin
      rect(g, '#8f86b8', Math.round(wx + Math.cos(a) * 2), Math.round(y - 1 + Math.sin(a) * 2), 1, 1)
      rect(g, '#8f86b8', Math.round(wx - Math.cos(a) * 2), Math.round(y - 1 - Math.sin(a) * 2), 1, 1)
      rect(g, '#cfc6ff', wx, y - 1, 1, 1)
    }
    // Lamps: red tail, white head, a cyan glow underneath.
    rect(g, '#ff3b5c', x, y - 6, 2, 2)
    rect(g, '#fff1b0', x + 40, y - 6, 2, 1)
    L.emit(x, y - 6, 2, 2)
    L.emit(x + 40, y - 6, 2, 1)
    L.light(x, y - 5, 10, '#ff3b5c', 0.5)
    L.light(x + 56, y - 4, 16, '#fff1b0', 0.35)
    L.light(x + 80, y - 2, 20, '#fff1b0', 0.2)
    L.light(x + 21, y + 1, 18, '#2ff3ff', 0.3 + 0.12 * c.beat)
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !moonC || !city || !palm) return
    if (lastT >= 0) dist += (c.t - lastT) * (90 + c.energy * 80)
    lastT = c.t
    g.drawImage(back, 0, 0)
    drawStarList(g, stars, c.t)
    g.drawImage(moonC, 0, 0)
    L.emitImage(moonC)
    L.light(moon.x, moon.y, moon.r * 4, '#cfc6ff', 0.25)
    g.drawImage(city, 0, 0)
    for (let i = 0; i < cityWins.length; i += 3) { const w = cityWins[i]!; L.emit(w.x, w.y, 1, 1) }
    L.light(W * 0.8, hz - 4, W * 0.3, '#ff2fa0', 0.18)
    for (const m of masts) {
      const on = 0.5 + 0.5 * Math.sin(c.t * 2 + m.x)
      rect(g, on > 0.5 ? '#ff3b5c' : '#6a1a30', m.x, m.y, 1, 1)
      L.emit(m.x, m.y, 1, 1)
      L.light(m.x, m.y, 5, '#ff3b5c', 0.4 * on)
    }
    drawSea(g, c, L)
    // Palms on the sea side, slower than the road.
    const ps = palm.width * 1.6
    for (let i = -1; i < W / ps + 2; i++) {
      const x = Math.round(i * ps - wrap(dist * 0.45, ps)) + Math.round(hash2(i + Math.floor(dist * 0.45 / ps), 1, 3) * ps * 0.4)
      g.drawImage(palm, x - palm.width / 2, roadTop + 2 - palm.height)
    }
    // Streetlights between the sea and the road.
    const ls = Math.max(110, W * 0.42)
    const lampH = Math.round(H * 0.3)
    for (let i = -1; i < W / ls + 2; i++) {
      const x = Math.round(i * ls - wrap(dist * 0.9, ls))
      rect(g, INK, x, roadTop - lampH, 2, lampH)
      rect(g, '#3a2a5a', x, roadTop - lampH, 1, lampH - 2)
      rect(g, INK, x, roadTop - lampH, 10, 2)
      rect(g, INK, x + 7, roadTop - lampH + 2, 5, 2)
      rect(g, '#ffb13f', x + 8, roadTop - lampH + 3, 3, 1)
      L.emit(x + 8, roadTop - lampH + 3, 3, 1)
      L.light(x + 9, roadTop - lampH + 4, 16, '#ffb13f', 0.5)
      L.light(x + 12, roadTop + (roadBot - roadTop) * 0.5, 34, '#ff8a3d', 0.4 + 0.08 * c.beat)
    }
    // Guard rail.
    rect(g, '#2c2058', 0, roadTop - 3, W, 1)
    rect(g, '#8f86b8', 0, roadTop - 4, W, 1)
    for (let x = -Math.round(wrap(dist, 12)); x < W; x += 12) rect(g, '#2c2058', x, roadTop - 4, 1, 4)
    // Road.
    rect(g, '#231d40', 0, roadTop, W, roadBot - roadTop)
    rect(g, '#cfc6ff', 0, roadTop + 1, W, 1)
    rect(g, '#1a1532', 0, roadBot - 1, W, 1)
    const mid = Math.round((roadTop + roadBot) / 2)
    for (let x = -Math.round(wrap(dist, 30)); x < W; x += 30) rect(g, '#ffd23f', x, mid, 14, 1)
    for (let y = roadTop + 3; y < roadBot - 1; y += 2) for (let x = 0; x < W; x += 7) {
      const hx = Math.round(wrap(x - dist, W))
      if (hash2(x, y, 9) > 0.9) rect(g, '#2c2450', hx, y, 2, 1)
    }
    // An oncoming car in the far lane now and then (more often when driving hard).
    const period = 9 - c.energy * 4
    const ph = wrap(c.t, period) / period
    if (ph < 0.3) {
      const ox = Math.round(W + 40 - (ph / 0.3) * (W + 120))
      const oy = Math.round(roadTop + (mid - roadTop) * 0.6)
      rect(g, INK, ox, oy - 5, 30, 5)
      rect(g, '#2a2a5a', ox + 1, oy - 5, 28, 3)
      rect(g, '#fff4ff', ox, oy - 4, 2, 1)
      L.emit(ox, oy - 4, 2, 1)
      L.light(ox - 6, oy - 3, 18, '#fff4ff', 0.45)
      rect(g, '#ff3b5c', ox + 29, oy - 4, 1, 1)
    }
    drawCar(g, c, L, Math.round(W * 0.34), Math.round(roadBot - (roadBot - mid) * 0.35))
    // Roadside scrub rushing past in the foreground.
    const fg = Math.round(Math.max(6, (H - roadBot) * 0.55))
    for (let x = 0; x < W; x++) {
      const wx = x + dist * 1.5
      const n = noise1(wx, 16, 7) * 0.7 + noise1(wx, 5, 9) * 0.3
      const hh = Math.round(n * n * fg * 1.6)
      if (hh <= 0) continue
      rect(g, '#0b0616', x, H - hh, 1, hh)
      if (hh > 3 && noise1(wx, 5, 9) > 0.6) rect(g, '#1c1030', x, H - hh, 1, 1)
    }
    // Notes flare as stars over the sea.
    for (const n of c.notes) {
      if (!melodic(n.layer) || n.layer === 'arp') continue
      spawnSpark(sparks, 6 + Math.random() * (W - 12), 3 + (1 - n.h) * hz * 0.7, n.layer === 'bells' ? '#fff4ff' : mix(c.accent, '#ffffff', 0.4), n.layer === 'bells')
    }
    drawSparks(g, sparks, c.dt, L)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#8a80c0', '#6a5f9e', c.dark * 0.5), '#b4a8e0', c.energy * 0.12),
    horizon: () => hz,
  }
}
