// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Frostwood — a deep cold forest at night. A pale moon, a faint green-violet
 * aurora rippling over the sky (tinted a little by the chord root), rows of
 * snowy pines fading into drifting fog, a cabin whose window breathes with
 * the kick, and snow falling in three depths. Notes glint as snow sparkle
 * on the ground or stars in the sky.
 */
import { ditherGradient, hash2, noise1, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { drawSparks, layer, melodic, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { INK, drawStarList, makeStars, paintMoon, paintPine, type PineColors, type Star } from '../lib/paint.ts'

const FAR: PineColors = { body: '#1f2c52', bodyL: '#27386a', snow: '#6a78b0', snowD: '#4a5890', trunk: '#161e3a' }
const MID: PineColors = { body: '#132038', bodyL: '#1b2e4e', snow: '#a8b4e0', snowD: '#7482b8', trunk: '#0e1628' }
const NEAR: PineColors = { body: '#0a121f', bodyL: '#121e33', snow: '#dcd6ff', snowD: '#8f96c8', trunk: '#080c16' }

export function createFrostwood(): Place {
  let W = 0
  let H = 0
  let hz = 0
  let ground = 0
  let back: HTMLCanvasElement | null = null
  let moonC: HTMLCanvasElement | null = null
  let far: HTMLCanvasElement | null = null
  let mid: HTMLCanvasElement | null = null
  let near: HTMLCanvasElement | null = null
  let stars: Star[] = []
  let moon = { x: 0, y: 0, r: 0 }
  let win = { x: 0, y: 0 }
  let chimney = { x: 0, y: 0 }
  const sparks: Spark[] = []

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    hz = Math.round(h * (portrait ? 0.6 : 0.6))
    ground = Math.round(h * (portrait ? 0.7 : 0.74))
    const mr = Math.max(7, Math.round(Math.min(w, h) * 0.06))
    moon = { x: Math.round(w * (portrait ? 0.72 : 0.78)), y: Math.round(h * (portrait ? 0.12 : 0.18)), r: mr }
    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, hz + 10, ['#07050f', '#0c0a22', '#121634', '#182244', '#223058', '#2c3a68'])
      // Far hills with a dusting of snow.
      for (let x = 0; x < w; x++) {
        const top = Math.round(hz - 4 - noise1(x, 40, 3) * h * 0.1 - noise1(x, 11, 5) * 4)
        rect(g, '#1c2650', x, top, 1, h - top)
        rect(g, '#4a5890', x, top, 1, 1 + Math.floor(noise1(x, 5, 7) * 3))
      }
      // Snowfield.
      ditherGradient(g, 0, ground - 2, w, h, ['#6a70a8', '#8a8ec4', '#a8aad8', '#9a9cd0'])
      for (let y = ground; y < h; y += 2) for (let x = 0; x < w; x += 4) {
        const n = hash2(x, y, 9)
        if (n > 0.9) rect(g, '#c4c4ec', x, y, 3, 1)
        else if (n < 0.08) rect(g, '#7c80b8', x, y, 4, 1)
      }
      // A trail of footprints from the cabin door toward us.
      const doorX = Math.round(w * (portrait ? 0.3 : 0.36)) + Math.round(Math.max(18, Math.round(w * 0.075)) * 0.6)
      for (let i = 0; i < 40; i++) {
        const u = i / 40
        const y = Math.round(ground + 3 + u * (h - ground))
        if (y >= h) break
        const x = Math.round(doorX + Math.sin(u * 3) * w * 0.06 + u * w * 0.12 + (i % 2 ? 2 : -1) * (1 + u * 2))
        rect(g, '#6a6ea8', x, y, 1 + Math.round(u * 2), 1)
      }
      // Snowed-over rocks.
      for (let i = 0; i < 5; i++) {
        const rx = Math.round(w * (0.28 + hash2(i, 1, 19) * 0.5))
        const ry = Math.round(ground + 8 + hash2(i, 2, 19) * (h - ground - 14))
        const rw = 4 + Math.round(hash2(i, 3, 19) * 6)
        rect(g, '#5a5e98', rx, ry, rw, 2)
        rect(g, '#dcd6ff', rx + 1, ry - 1, rw - 2, 1)
        rect(g, '#c4c4ec', rx, ry, 1, 1)
      }
    })
    moonC = layer(w, h, g => paintMoon(g, moon.x, moon.y, moon.r))
    stars = makeStars(w, Math.round(hz * 0.8), 1.1, 33)
    far = layer(w, h, g => {
      for (let x = -4; x < w + 6; x += 5) {
        const th = Math.round(h * (0.08 + hash2(x, 1, 11) * 0.06))
        paintPine(g, x + hash2(x, 2, 11) * 3, hz + 6, th, x, FAR, 0.8)
      }
      rect(g, '#2c3a68', 0, hz + 6, w, ground - hz - 6)
    })
    mid = layer(w, h, g => {
      const cabinX = Math.round(w * (portrait ? 0.3 : 0.36))
      const cabinW = Math.max(18, Math.round(w * 0.075))
      for (let x = -8; x < w + 10; x += 9) {
        if (x > cabinX - 8 && x < cabinX + cabinW + 6) continue
        const th = Math.round(h * (0.18 + hash2(x, 3, 13) * 0.12))
        paintPine(g, x + hash2(x, 4, 13) * 5, ground + 2, th, x + 3, MID)
      }
      // The cabin: logs, a snowy roof, one warm window, a chimney.
      const cb = ground + 1
      const ch = Math.round(cabinW * 0.55)
      rect(g, INK, cabinX - 1, cb - ch - 1, cabinW + 2, ch + 1)
      for (let y = cb - ch; y < cb; y++) rect(g, (cb - y) % 3 === 0 ? '#2a1830' : '#4a2a3a', cabinX, y, cabinW, 1)
      const roofH = Math.round(cabinW * 0.4)
      for (let y = 0; y < roofH; y++) {
        const inset = Math.round((roofH - y) * 1.1)
        rect(g, y < 2 ? '#dcd6ff' : y < roofH - 1 ? '#b9b0e6' : '#6a70a8', cabinX - 3 + inset, cb - ch - roofH + y, cabinW + 6 - inset * 2, 1)
      }
      chimney = { x: cabinX + cabinW - 6, y: cb - ch - roofH - 1 }
      rect(g, INK, chimney.x - 1, chimney.y - 3, 5, roofH)
      rect(g, '#5a3a4a', chimney.x, chimney.y - 2, 3, roofH - 1)
      rect(g, '#dcd6ff', chimney.x - 1, chimney.y - 4, 5, 1)
      win = { x: cabinX + Math.round(cabinW * 0.3), y: cb - Math.round(ch * 0.65) }
      rect(g, INK, win.x - 1, win.y - 1, 6, 6)
      rect(g, '#ffd23f', win.x, win.y, 4, 4)
      rect(g, '#ffb13f', win.x, win.y + 2, 4, 2)
      rect(g, INK, win.x + 2, win.y, 1, 4)
      rect(g, '#fff1b0', win.x, win.y, 1, 1)
      // Light spilled on the snow under the window.
      rect(g, '#d8b0a0', win.x - 2, cb + 1, 9, 1)
      rect(g, '#c0a0a8', win.x - 4, cb + 2, 13, 1)
    })
    near = layer(w, h, g => {
      const big = Math.round(h * (portrait ? 0.62 : 0.95))
      paintPine(g, Math.round(w * 0.04), h + 4, big, 71, NEAR)
      paintPine(g, Math.round(w * 0.16), h + 6, Math.round(big * 0.7), 72, NEAR)
      paintPine(g, Math.round(w * 0.95), h + 4, Math.round(big * 0.88), 73, NEAR)
      if (!portrait) paintPine(g, Math.round(w * 0.84), h + 8, Math.round(big * 0.55), 74, NEAR)
    })
  }

  function drawAurora(g: G, c: FrameCtx, L: Lights) {
    const t = c.t
    const green = mix('#3fd8b0', c.accent, 0.25)
    const top = H * 0.05
    for (let x = 0; x < W; x++) {
      const b = Math.sin(x * 0.017 + t * 0.1) * 0.45 + Math.sin(x * 0.043 - t * 0.07) * 0.3 + 0.5
      if (b < 0.05) continue
      // Curtain rays: fine vertical striations that slide slowly.
      const ray = 0.65 + 0.35 * Math.sin(x * 0.7 + Math.sin(x * 0.05 + t * 0.3) * 3)
      const k = Math.min(1, b * ray) * (0.95 + c.energy * 0.12)
      const yB = Math.round(top + H * 0.22 + Math.sin(x * 0.026 + t * 0.13) * H * 0.06 + Math.sin(x * 0.009 - t * 0.08) * H * 0.05)
      const len = Math.round(H * (0.14 + 0.07 * Math.sin(x * 0.05 + t * 0.2)))
      g.fillStyle = '#9a4ff0'
      g.globalAlpha = 0.1 * k
      g.fillRect(x, yB - len, 1, Math.round(len * 0.5))
      g.fillStyle = green
      g.globalAlpha = 0.16 * k
      g.fillRect(x, yB - Math.round(len * 0.5), 1, Math.round(len * 0.25))
      g.globalAlpha = 0.3 * k
      g.fillRect(x, yB - Math.round(len * 0.25), 1, Math.round(len * 0.25))
      g.globalAlpha = 0.6 * k
      g.fillRect(x, yB, 1, 1)
    }
    g.globalAlpha = 1
    for (let i = 0; i < 4; i++) L.light(W * (0.15 + i * 0.25), top + H * 0.18, W * 0.14, green, 0.07)
  }

  function drawFog(g: G, c: FrameCtx, y: number, amp: number, speed: number, color: string, a: number, salt: number) {
    g.globalAlpha = a
    g.fillStyle = color
    for (let x = 0; x < W; x += 2) {
      const n = noise1(x + c.t * speed, 30, salt) * amp + noise1(x - c.t * speed * 0.6, 9, salt + 1) * amp * 0.4
      const top = Math.round(y - n)
      g.fillRect(x, top, 2, Math.round(amp * 1.4 + n))
    }
    g.globalAlpha = 1
  }

  function drawSnow(g: G, c: FrameCtx) {
    const wind = 3 + c.energy * 10
    const layers: [number, number, number, string][] = [[70, 7, 1, '#8f96c8'], [45, 13, 1, '#dcd6ff'], [14, 24, 2, '#fff4ff']]
    layers.forEach(([n, speed, size, col], li) => {
      g.fillStyle = col
      for (let i = 0; i < n; i++) {
        const x0 = hash2(i, li, 91) * (W + 40)
        const y0 = hash2(i, li + 7, 91) * H
        const sp = speed * (0.8 + hash2(i, li + 3, 91) * 0.4)
        const y = wrap(y0 + c.t * sp, H + 4) - 2
        const x = wrap(x0 + c.t * wind * (0.5 + li * 0.4) + Math.sin(c.t * 0.8 + i) * 2, W + 40) - 20
        g.fillRect(Math.round(x), Math.round(y), size, size)
      }
    })
  }

  function drawSmoke(g: G, c: FrameCtx) {
    for (let i = 0; i < 7; i++) {
      const ph = wrap(c.t * 0.12 + i / 7, 1)
      const x = chimney.x + 1 + ph * 14 + Math.sin(c.t * 0.7 + i) * 1.5
      const y = chimney.y - 4 - ph * H * 0.16
      const r = 1 + ph * 3
      g.globalAlpha = 0.45 * (1 - ph)
      g.fillStyle = '#8f96c8'
      g.fillRect(Math.round(x - r), Math.round(y - r * 0.7), Math.round(r * 2), Math.round(r * 1.4))
    }
    g.globalAlpha = 1
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !moonC || !far || !mid || !near) return
    g.drawImage(back, 0, 0)
    drawStarList(g, stars, c.t, 0.2)
    drawAurora(g, c, L)
    g.drawImage(moonC, 0, 0)
    L.emitImage(moonC)
    L.light(moon.x, moon.y, moon.r * 5, '#cfc6ff', 0.22)
    // Back row, fog, middle row, low fog, the cabin's warmth, snow, the near pines.
    g.drawImage(far, 0, 0)
    drawFog(g, c, hz + 6, 5, 2, '#4a5890', 0.45, 3)
    g.drawImage(mid, 0, 0)
    drawFog(g, c, ground + 3, 4, 3.5, '#8f96c8', 0.3, 7)
    drawSmoke(g, c)
    L.emit(win.x, win.y, 4, 4)
    L.light(win.x + 2, win.y + 2, 18, '#ffb13f', 0.5 + 0.18 * c.beat)
    L.light(win.x + 2, ground + 3, 14, '#ff8a3d', 0.28 + 0.1 * c.beat)
    // Glints: notes sparkle on the snow (low) or as stars (high).
    for (const n of c.notes) {
      if (!melodic(n.layer)) continue
      if (n.h > 0.45) spawnSpark(sparks, 6 + Math.random() * (W - 12), 3 + (1 - n.h) * hz * 0.7, n.layer === 'bells' ? '#fff4ff' : '#cfc6ff', n.layer === 'bells', 1.8)
      else spawnSpark(sparks, 6 + Math.random() * (W - 12), ground + 4 + Math.random() * (H - ground - 8), '#fff4ff', false, 1)
    }
    drawSparks(g, sparks, c.dt, L, 0.3)
    g.drawImage(near, 0, 0)
    drawSnow(g, c)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#9aa0d4', '#7478b0', c.dark * 0.5), '#c4c8ec', c.energy * 0.1),
    horizon: () => hz,
  }
}
