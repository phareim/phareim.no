// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Neon Rain — a rainy city street at night. Tall dark buildings with a few
 * lit windows, a vertical HOTEL sign, a BAR sign tinted by the chord root,
 * and a small noodle bar with a glowing counter, curtains, red lanterns
 * that breathe with the kick and steam off the pots. Rain falls in two
 * depths and rings the puddles; the wet street mirrors everything. Now and
 * then someone walks past under an umbrella.
 */
import { disc, ditherGradient, hash2, rect } from '../pixel/scenery.ts'
import { drawText, mix } from '../pixel/sprites.ts'
import { layer, melodic, mirrorLights, wrap, type FrameCtx, type G, type Lights, type Place } from '../lib/kit.ts'
import { INK, mirror } from '../lib/paint.ts'

interface Ring { x: number; y: number; age: number }

export function createNeonrain(): Place {
  let W = 0
  let H = 0
  let walk = 0
  let street = 0
  let back: HTMLCanvasElement | null = null
  let fronts: HTMLCanvasElement | null = null
  let copy: HTMLCanvasElement | null = null
  let windows: { x: number; y: number; c: string }[] = []
  let hotel = { x: 0, y: 0 }
  let bar = { x: 0, y: 0 }
  let noodle = { x: 0, y: 0, w: 0 }
  let counter = { x: 0, y: 0, w: 0, h: 0 }
  let lanterns: { x: number; y: number }[] = []
  let vending = { x: 0, y: 0 }
  const rings: Ring[] = []

  function facade(g: G, x0: number, x1: number, top: number, base: number, salt: number, body: string, trim: string) {
    rect(g, INK, x0 - 1, top - 1, x1 - x0 + 2, base - top + 1)
    rect(g, body, x0, top, x1 - x0, base - top)
    for (let y = top + 3; y < base; y += 6) rect(g, mix(body, INK, 0.3), x0, y, x1 - x0, 1)
    rect(g, trim, x0, top, x1 - x0, 1)
    // Windows in a grid; a few lit.
    for (let y = top + 6; y < base - 22; y += 12) for (let x = x0 + 4; x < x1 - 8; x += 11) {
      rect(g, INK, x - 1, y - 1, 8, 8)
      const lit = hash2(x, y, salt) > 0.62
      const col = lit ? (hash2(x, y, salt + 1) > 0.6 ? '#ff8ae0' : '#ffd23f') : '#1a1034'
      rect(g, col, x, y, 6, 6)
      if (lit) {
        rect(g, mix(col, INK, 0.35), x, y + 3, 6, 3)
        for (let k = 0; k < 3; k++) rect(g, mix(col, INK, 0.5), x, y + k * 2, 6, 1)
        windows.push({ x: x + 3, y: y + 3, c: col })
      } else rect(g, '#2a1f4a', x, y, 2, 1)
    }
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    walk = Math.round(h * (portrait ? 0.7 : 0.74))
    street = walk + Math.max(4, Math.round(h * 0.03))
    windows = []
    lanterns = []
    copy = layer(w, h, () => {})
    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, Math.round(h * 0.6), ['#07050f', '#0e0a24', '#1a1036', '#2a1a4c', '#43246e', '#6a2a7c'])
      // Far towers in the rain haze.
      let x = -4
      let i = 0
      while (x < w) {
        const bw = 12 + Math.floor(hash2(i, 1, 3) * 20)
        const top = Math.round(h * (0.08 + hash2(i, 2, 3) * 0.25))
        rect(g, '#1c1236', x, top, bw, h - top)
        rect(g, '#2a1f4a', x, top, bw, 1)
        for (let y = top + 3; y < h * 0.6; y += 4) for (let xx = x + 2; xx < x + bw - 2; xx += 3) if (hash2(xx, y, 7) > 0.88) rect(g, '#6a4f90', xx, y, 1, 2)
        x += bw + 2
        i++
      }
    })
    fronts = layer(w, h, g => {
      const sL = Math.round(w * (portrait ? 0.3 : 0.32))
      const nL = sL + 2
      const nR = Math.round(w * (portrait ? 0.76 : 0.7))
      facade(g, -2, sL, Math.round(h * (portrait ? 0.2 : 0.12)), walk, 11, '#241a44', '#3a2a5a')
      facade(g, nL, nR, Math.round(h * (portrait ? 0.34 : 0.3)), walk, 23, '#2c1f3e', '#5a3a5a')
      facade(g, nR + 2, w + 2, Math.round(h * (portrait ? 0.26 : 0.18)), walk, 37, '#1f1a40', '#3a2f70')
      // The noodle bar's front: an awning, a board for the sign, a counter window.
      const shopTop = walk - Math.round(h * (portrait ? 0.15 : 0.22))
      noodle = { x: nL + 4, y: shopTop - 12, w: nR - nL - 8 }
      rect(g, INK, noodle.x - 1, noodle.y - 1, noodle.w + 2, 11)
      rect(g, '#140a22', noodle.x, noodle.y, noodle.w, 9)
      for (let x = nL; x < nR; x++) rect(g, x % 6 < 3 ? '#b01874' : '#fff1b0', x, shopTop, 1, 3)
      rect(g, INK, nL, shopTop + 3, nR - nL, 1)
      counter = { x: nL + 6, y: shopTop + 4, w: nR - nL - 12, h: walk - shopTop - 4 }
      rect(g, '#ffb13f', counter.x, counter.y, counter.w, counter.h)
      rect(g, '#ffd23f', counter.x, counter.y, counter.w, Math.round(counter.h * 0.5))
      // Shelves with bowls, a cook, the counter top and stools.
      for (let x = counter.x + 3; x < counter.x + counter.w - 3; x += 5) rect(g, '#c4861c', x, counter.y + 3, 3, 1)
      const cook = counter.x + Math.round(counter.w * 0.62)
      rect(g, '#3a1a4a', cook - 2, counter.y + 6, 5, counter.h - 10)
      disc(g, '#3a1a4a', cook, counter.y + 5, 2)
      rect(g, '#fff4ff', cook - 2, counter.y + 2, 5, 2)
      const ctop = walk - Math.round(counter.h * 0.35)
      rect(g, '#5b2a1c', counter.x - 2, ctop, counter.w + 4, 2)
      rect(g, '#b0543a', counter.x - 2, ctop, counter.w + 4, 1)
      rect(g, '#3a1a4a', counter.x, ctop + 2, counter.w, walk - ctop - 2)
      for (let x = counter.x + 4; x < counter.x + counter.w - 2; x += 9) {
        rect(g, INK, x, ctop + 3, 4, 1)
        rect(g, INK, x + 1, ctop + 4, 1, walk - ctop - 4)
        rect(g, INK, x + 2, ctop + 4, 1, walk - ctop - 4)
      }
      // Noren: split curtains across the top of the counter window.
      const panels = Math.max(3, Math.round(counter.w / 9))
      const pw = Math.floor(counter.w / panels)
      for (let i = 0; i < panels; i++) {
        const px = counter.x + i * pw
        rect(g, '#ff2fa0', px, counter.y, pw - 1, 7)
        rect(g, '#b01874', px, counter.y + 6, pw - 1, 1)
        rect(g, '#fff4ff', px + Math.floor(pw / 2) - 1, counter.y + 2, 2, 2)
      }
      lanterns = [{ x: nL + 2, y: shopTop + 6 }, { x: nR - 3, y: shopTop + 6 }]
      for (const l of lanterns) rect(g, INK, l.x, shopTop + 3, 1, 3)
      // Vertical HOTEL sign on a bracket, left; BAR sign box, right.
      hotel = { x: Math.round(sL - 14), y: Math.round(h * (portrait ? 0.26 : 0.2)) }
      rect(g, INK, hotel.x - 2, hotel.y - 2, 11, 5 * 9 + 3)
      rect(g, '#140a22', hotel.x - 1, hotel.y - 1, 9, 5 * 9 + 1)
      rect(g, INK, hotel.x + 9, hotel.y + 6, 5, 1)
      bar = { x: Math.round(nR + (w - nR) * 0.35), y: Math.round(h * (portrait ? 0.4 : 0.34)) }
      rect(g, INK, bar.x - 3, bar.y - 3, 23, 13)
      rect(g, '#140a22', bar.x - 2, bar.y - 2, 21, 11)
      // A vending machine at the right.
      vending = { x: Math.round(w - (w - nR) * 0.5), y: walk - 22 }
      rect(g, INK, vending.x - 1, vending.y - 1, 12, 23)
      rect(g, '#2f5fd0', vending.x, vending.y, 10, 22)
      rect(g, '#7ce4ff', vending.x + 1, vending.y + 2, 8, 9)
      for (let k = 0; k < 3; k++) rect(g, ['#ff3b5c', '#ffd23f', '#b6ff4a'][k]!, vending.x + 2 + k * 2, vending.y + 4, 1, 2)
      for (let k = 0; k < 3; k++) rect(g, ['#ff8a3d', '#fff4ff', '#ff2fa0'][k]!, vending.x + 2 + k * 2, vending.y + 8, 1, 2)
      rect(g, '#0b0616', vending.x + 2, vending.y + 16, 6, 3)
      // Sidewalk and curb.
      rect(g, '#2c2450', 0, walk, w, street - walk)
      for (let x = 0; x < w; x += 9) rect(g, '#1f1a40', x, walk, 1, street - walk)
      rect(g, '#5a5285', 0, walk, w, 1)
      rect(g, '#8f86b8', 0, street - 1, w, 1)
    })
  }

  function neonText(g: G, L: Lights, text: string, x: number, y: number, col: string, a: number, vertical: boolean) {
    const dim = mix(col, '#140a22', 0.6)
    for (let i = 0; i < text.length; i++) {
      const ch = text[i]!
      const px = vertical ? x : x + i * 6
      const py = vertical ? y + i * 9 : y
      const on = a > 0.5 || (i + Math.floor(a * 10)) % 3 !== 0
      drawText(g, ch, px, py, on ? col : dim)
      if (on) L.emit(px, py, 5, 7)
    }
    L.light(x + (vertical ? 2 : text.length * 3), y + (vertical ? text.length * 4.5 : 3), vertical ? 26 : 22, col, 0.45 * a)
  }

  function drawRain(g: G, c: FrameCtx) {
    const slant = 0.25
    const layers: [number, number, number, string, number][] = [[90, 150, 3, '#6a5fa0', 0.6], [45, 230, 5, '#b9b0e6', 0.7]]
    for (const [n, speed, len, col, a] of layers) {
      g.fillStyle = col
      g.globalAlpha = a
      for (let i = 0; i < n; i++) {
        const y0 = hash2(i, len, 5) * (H + 20)
        const x0 = hash2(i, len + 1, 5) * (W + 40)
        const sp = speed * (0.85 + hash2(i, len + 2, 5) * 0.3)
        const y = wrap(y0 + c.t * sp, H + 20) - 10
        const x = wrap(x0 - (y0 + c.t * sp) * slant, W + 40) - 20
        for (let k = 0; k < len; k++) g.fillRect(Math.round(x - k * slant), Math.round(y - k), 1, 1)
      }
    }
    g.globalAlpha = 1
    // Splashes on the pavement.
    for (let i = 0; i < 12; i++) {
      const ph = wrap(c.t * 2.2 + hash2(i, 1, 9), 1)
      if (ph > 0.25) continue
      const x = Math.round(hash2(i, Math.floor(c.t * 2.2 + hash2(i, 1, 9)), 9) * W)
      rect(g, '#cfc6ff', x - 1, walk - 1, 1, 1)
      rect(g, '#cfc6ff', x + 1, walk - 1, 1, 1)
    }
  }

  function drawWalker(g: G, c: FrameCtx, L: Lights) {
    const period = 38
    const ph = wrap(c.t + 12, period) / period
    if (ph > 0.55) return
    const x = Math.round(-16 + (ph / 0.55) * (W + 32))
    const y = walk
    const step = Math.floor(c.t * 4) % 2
    rect(g, '#140a22', x - 1, y - 13, 3, 9)
    disc(g, '#140a22', x, y - 14, 1)
    rect(g, '#140a22', x - 1 + step, y - 4, 1, 4)
    rect(g, '#140a22', x + 1 - step, y - 4, 1, 4)
    // Umbrella.
    for (let k = 0; k < 4; k++) rect(g, k === 0 ? '#ff8ae0' : '#b01874', x - 6 + k, y - 20 + k, 13 - k * 2, 1)
    rect(g, '#2ff3ff', x - 6, y - 17, 13, 1)
    rect(g, INK, x, y - 16, 1, 4)
    L.light(x, y - 18, 10, '#ff2fa0', 0.2)
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !fronts || !copy) return
    g.drawImage(back, 0, 0)
    g.drawImage(fronts, 0, 0)
    for (const wv of windows) L.light(wv.x, wv.y, 9, wv.c, 0.3)
    // Signs: HOTEL flickers once in a long while; BAR takes the chord's colour.
    const fl = wrap(c.t, 17) < 0.35 ? 0.3 : 1
    neonText(g, L, 'HOTEL', hotel.x + 1, hotel.y, '#2ff3ff', fl * (0.9 + 0.1 * c.beat), true)
    const barCol = mix('#ffd23f', c.accent, 0.5)
    neonText(g, L, 'BAR', bar.x + 1, bar.y, barCol, 0.85 + 0.15 * c.beat, false)
    const sign = 'NOODLES'
    const tx = Math.round(noodle.x + (noodle.w - sign.length * 6 + 1) / 2)
    neonText(g, L, sign, tx, noodle.y + 1, '#ff2fa0', 0.9 + 0.1 * c.beat, false)
    // The counter glow, the lanterns, the vending machine.
    L.emit(counter.x, counter.y, counter.w, Math.round(counter.h * 0.65))
    L.light(counter.x + counter.w / 2, counter.y + counter.h * 0.5, counter.w * 0.9, '#ffb13f', 0.55)
    L.light(counter.x + counter.w / 2, street + 4, counter.w * 0.8, '#ff8a3d', 0.3)
    for (const l of lanterns) {
      rect(g, INK, l.x - 2, l.y, 5, 7)
      rect(g, '#ff3b5c', l.x - 1, l.y + 1, 3, 5)
      rect(g, '#ff8a3d', l.x - 1, l.y + 2, 1, 2)
      L.emit(l.x - 1, l.y + 1, 3, 5)
      L.light(l.x, l.y + 3, 14, '#ff3b5c', 0.45 + 0.2 * c.beat)
    }
    L.emit(vending.x + 1, vending.y + 2, 8, 9)
    L.light(vending.x + 5, vending.y + 8, 16, '#7ce4ff', 0.4)
    // Steam off the pots.
    for (let i = 0; i < 6; i++) {
      const ph = wrap(c.t * 0.3 + i / 6, 1)
      const x = counter.x + counter.w * 0.35 + Math.sin(c.t + i * 2) * 3 + ph * 4
      const y = counter.y + counter.h * 0.5 - ph * counter.h * 0.5
      g.globalAlpha = 0.35 * (1 - ph)
      g.fillStyle = '#fff4ff'
      g.fillRect(Math.round(x), Math.round(y), 2 + Math.round(ph * 3), 2)
    }
    g.globalAlpha = 1
    drawWalker(g, c, L)
    // The wet street mirrors the block above it.
    copy.getContext('2d')!.drawImage(g.canvas, 0, 0, W, street, 0, 0, W, street)
    rect(g, '#0b0616', 0, street, W, H - street)
    mirror(g, copy, walk, street, H, W, c.t, 1.2, '#0f1a40', 0.5, 1.4)
    mirrorLights(L, walk, street, 1.4, 0.35, H)
    // Rain rings on the street; notes drop extra ones (pitch → how near).
    for (const nh of c.notes) if (melodic(nh.layer) && rings.length < 30) rings.push({ x: Math.random() * W, y: street + 2 + (1 - nh.h) * (H - street - 4), age: 0 })
    if (Math.random() < 0.3 + c.energy * 0.2) rings.push({ x: Math.random() * W, y: street + 2 + Math.random() * (H - street - 4), age: 0 })
    for (let i = rings.length - 1; i >= 0; i--) {
      const r = rings[i]!
      r.age += c.dt
      if (r.age > 0.8) { rings.splice(i, 1); continue }
      const rad = Math.round(1 + r.age * 6)
      g.fillStyle = r.age < 0.4 ? '#8f86b8' : '#4a4080'
      g.fillRect(Math.round(r.x - rad), Math.round(r.y), rad * 2 + 1, 1)
      g.fillStyle = '#0b0616'
      if (rad > 2) g.fillRect(Math.round(r.x - rad + 2), Math.round(r.y), rad * 2 - 3, 1)
    }
    drawRain(g, c)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#8c80c0', '#6a5f9e', c.dark * 0.5), '#b4a8e0', c.energy * 0.1),
    horizon: () => Math.round(H * 0.3),
  }
}
