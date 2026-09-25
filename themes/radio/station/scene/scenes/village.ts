// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Village — a small village at dusk. Houses in two rows with lit windows,
 * smoke curling from the chimneys, a church tower with a rose window and a
 * bell, a well on the cobbled square, and a string of lanterns across it:
 * the lanterns breathe with the kick, and each note brightens the lantern
 * that sits at its pitch (low left, high right).
 */
import { DUSK, drawStars, hash2, paintHouse, paintLamp, paintSky, paintTreeLine, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { layer, melodic, wrap, type FrameCtx, type G, type Lights, type Place } from '../lib/kit.ts'
import { INK, line } from '../lib/paint.ts'

const LANTERNS = ['#ff2fa0', '#ffd23f', '#2ff3ff', '#b6ff4a', '#ff8a3d', '#ff8ae0']

export function createVillage(): Place {
  let W = 0
  let H = 0
  let hz = 0
  let plaza = 0
  let back: HTMLCanvasElement | null = null
  let houses: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let windows: { x: number; y: number; far: boolean }[] = []
  let chimneys: { x: number; y: number }[] = []
  let lamps: { x: number; y: number }[] = []
  let rose = { x: 0, y: 0 }
  let bell = { x: 0, y: 0 }
  let string = { x0: 0, y0: 0, x1: 0, y1: 0, sag: 0 }
  let flash: number[] = []

  function house(g: G, x: number, base: number, w: number, h: number, salt: number, far: boolean) {
    // Chimney first, so the roof overlaps its foot.
    const roofH = Math.max(4, Math.round(h * 0.45))
    const wallTop = base - (h - roofH)
    if (hash2(salt, 1, 3) > 0.35) {
      const cx = x + Math.round(w * (0.65 + hash2(salt, 2, 3) * 0.15))
      const cy = wallTop - roofH + 1
      rect(g, INK, cx - 1, cy - 1, 5, roofH)
      rect(g, far ? '#5a2a50' : '#7a3a5a', cx, cy, 3, roofH - 1)
      rect(g, '#b8468f', cx - 1, cy - 1, 5, 1)
      chimneys.push({ x: cx + 1.5, y: cy - 2 })
    }
    const wins = paintHouse(g, x, base, w, h, salt)
    for (const wv of wins) windows.push({ x: wv.x, y: wv.y, far })
    // A door on the near houses.
    if (!far) {
      const dx = x + Math.round(w * 0.5) - 2
      rect(g, INK, dx - 1, base - 9, 6, 9)
      rect(g, '#5b2a1c', dx, base - 8, 4, 8)
      rect(g, '#b0543a', dx, base - 8, 1, 8)
      rect(g, '#ffd23f', dx + 3, base - 4, 1, 1)
    }
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    hz = Math.round(h * (portrait ? 0.5 : 0.52))
    plaza = Math.round(h * (portrait ? 0.74 : 0.78))
    windows = []
    chimneys = []
    lamps = []
    back = layer(w, h, g => {
      paintSky(g, w, hz + 20)
      // Rolling hills and a tree line behind the roofs.
      for (let x = 0; x < w; x++) {
        const top = Math.round(hz - 6 - Math.sin(x * 0.02 + 1) * 5 - Math.sin(x * 0.05) * 2)
        rect(g, DUSK.ridgeFar, x, top, 1, h - top)
        rect(g, DUSK.ridgeFarRim, x, top, 1, 1)
      }
      paintTreeLine(g, 0, w, hz + 8, Math.max(5, Math.round(h * 0.035)), 17)
      rect(g, DUSK.g0, 0, hz + 8, w, h - hz - 8)
    })
    const backBase = Math.round(hz + (plaza - hz) * 0.45)
    houses = layer(w, h, g => {
      // The church tower, right.
      const tx = Math.round(w * (portrait ? 0.72 : 0.8))
      const tw = Math.max(14, Math.round(w * 0.055))
      const tTop = Math.round(h * (portrait ? 0.26 : 0.2))
      rect(g, INK, tx - 1, tTop, tw + 2, backBase - tTop)
      for (let y = tTop; y < backBase; y++) {
        const course = Math.floor((y - tTop) / 4)
        rect(g, course % 2 ? DUSK.stone : DUSK.stoneL, tx, y, tw, 1)
        if ((y - tTop) % 4 === 3) rect(g, DUSK.stoneD, tx, y, tw, 1)
        rect(g, DUSK.stoneD, tx + tw - 2, y, 2, 1)
      }
      // Spire.
      const sh = Math.round(tw * 1.5)
      for (let y = 0; y < sh; y++) {
        const half = Math.round((y / sh) * (tw / 2 + 2))
        rect(g, y % 3 === 2 ? DUSK.roofD : DUSK.roof, tx + Math.round(tw / 2) - half, tTop - sh + y, half * 2, 1)
        rect(g, DUSK.roofHi, tx + Math.round(tw / 2) - half, tTop - sh + y, 1, 1)
      }
      rect(g, '#ffd23f', tx + Math.round(tw / 2) - 1, tTop - sh - 4, 1, 4)
      rect(g, '#ffd23f', tx + Math.round(tw / 2) - 2, tTop - sh - 3, 3, 1)
      // Belfry arch with the bell.
      bell = { x: tx + Math.round(tw / 2), y: tTop + 5 }
      rect(g, '#0b0616', bell.x - 3, tTop + 2, 6, 9)
      rect(g, '#0b0616', bell.x - 2, tTop + 1, 4, 1)
      rect(g, '#c4861c', bell.x - 2, bell.y, 4, 3)
      rect(g, '#ffd23f', bell.x - 1, bell.y - 1, 2, 1)
      rect(g, '#ffd23f', bell.x - 3, bell.y + 3, 6, 1)
      // Rose window.
      rose = { x: tx + Math.round(tw / 2), y: tTop + Math.round((backBase - tTop) * 0.45) }
      rect(g, INK, rose.x - 3, rose.y - 3, 7, 7)
      rect(g, '#ff2fa0', rose.x - 2, rose.y - 2, 5, 5)
      rect(g, '#ffd23f', rose.x - 1, rose.y - 1, 3, 3)
      rect(g, '#2ff3ff', rose.x, rose.y, 1, 1)
      // Back row of houses.
      const backRow = portrait ? [[0.02, 0.2], [0.26, 0.16], [0.46, 0.2]] : [[0.02, 0.1], [0.14, 0.09], [0.26, 0.11], [0.52, 0.1], [0.64, 0.12]]
      backRow.forEach(([fx, fw], i) => house(g, Math.round(w * fx!), backBase, Math.round(w * fw!), Math.round(h * 0.13 + hash2(i, 1, 5) * h * 0.04), 10 + i, true))
      // Front row.
      const frontRow = portrait ? [[-0.04, 0.34], [0.62, 0.42]] : [[-0.02, 0.18], [0.2, 0.15], [0.62, 0.17], [0.84, 0.18]]
      frontRow.forEach(([fx, fw], i) => house(g, Math.round(w * fx!), plaza, Math.round(w * fw!), Math.round(h * 0.2 + hash2(i, 2, 5) * h * 0.05), 30 + i, false))
    })
    front = layer(w, h, g => {
      // Cobbled square.
      rect(g, DUSK.pathD, 0, plaza, w, h - plaza)
      // Cobbles in rows that grow toward us.
      let y = plaza + 1
      let row = 0
      while (y < h) {
        const d = (y - plaza) / (h - plaza)
        const ch = 1 + Math.round(d * 3)
        const cw = 3 + Math.round(d * 5)
        const off = row % 2 ? Math.round(cw / 2) : 0
        for (let x = -off; x < w; x += cw + 1) {
          const n = hash2(x, row, 23)
          rect(g, n > 0.75 ? DUSK.pathL : n < 0.2 ? '#6a4070' : DUSK.path, x, y, cw, ch)
          if (n > 0.9) rect(g, '#b07aa8', x, y, Math.max(1, cw - 2), 1)
        }
        y += ch + 1
        row++
      }
      rect(g, DUSK.pathL, 0, plaza, w, 1)
      // The well.
      const wx = Math.round(w * (portrait ? 0.34 : 0.44))
      const wy = Math.round(plaza + (h - plaza) * 0.62)
      const ww = Math.max(16, Math.round(w * 0.07))
      rect(g, INK, wx - 1, wy - 8, ww + 2, 10)
      for (let y = wy - 7; y < wy + 1; y++) for (let x = wx; x < wx + ww; x += 4) {
        const n = hash2(x, y >> 1, 29)
        rect(g, n > 0.6 ? DUSK.stoneL : DUSK.stone, x + ((y >> 1) % 2 ? 2 : 0), y, 3, 1)
      }
      rect(g, DUSK.stoneL, wx, wy - 8, ww, 1)
      rect(g, '#0b0616', wx + 2, wy - 9, ww - 4, 1)
      rect(g, INK, wx + 1, wy - 24, 2, 17)
      rect(g, INK, wx + ww - 3, wy - 24, 2, 17)
      rect(g, '#6a4432', wx + 1, wy - 24, 1, 16)
      rect(g, '#6a4432', wx + ww - 3, wy - 24, 1, 16)
      for (let y = 0; y < 5; y++) rect(g, y % 2 ? DUSK.roofD : DUSK.roof, wx - 3 + y, wy - 29 + y, ww + 6 - y * 2, 1)
      rect(g, DUSK.roofHi, wx - 3, wy - 29, ww + 6, 1)
      rect(g, INK, wx + 2, wy - 22, ww - 4, 1)
      line(g, '#8f86b8', wx + Math.round(ww / 2), wy - 21, wx + Math.round(ww / 2), wy - 15)
      rect(g, '#6a4432', wx + Math.round(ww / 2) - 1, wy - 15, 3, 3)
      // Two lamps on the square.
      lamps.push(paintLamp(g, Math.round(w * 0.1), Math.round(plaza + (h - plaza) * 0.8), 28, DUSK.window))
      lamps.push(paintLamp(g, Math.round(w * 0.9), Math.round(plaza + (h - plaza) * 0.8), 28, DUSK.window))
    })
    string = portrait
      ? { x0: Math.round(w * 0.28), y0: Math.round(plaza - h * 0.09), x1: Math.round(w * 0.64), y1: Math.round(plaza - h * 0.1), sag: Math.round(h * 0.03) }
      : { x0: Math.round(w * 0.16), y0: Math.round(plaza - h * 0.12), x1: Math.round(w * 0.64), y1: Math.round(plaza - h * 0.13), sag: Math.round(h * 0.06) }
    flash = new Array(Math.max(6, Math.round((string.x1 - string.x0) / 11))).fill(0)
  }

  function drawSmoke(g: G, c: FrameCtx) {
    const wind = 3 + c.energy * 6
    chimneys.forEach((ch, ci) => {
      for (let i = 0; i < 6; i++) {
        const ph = wrap(c.t * 0.15 + i / 6 + ci * 0.37, 1)
        const x = ch.x + ph * wind * 3 + Math.sin(c.t * 0.8 + i + ci) * 1.2
        const y = ch.y - ph * H * 0.14
        const r = 1 + ph * 2.5
        g.globalAlpha = 0.5 * (1 - ph)
        g.fillStyle = '#b9a8d9'
        g.fillRect(Math.round(x - r), Math.round(y - r * 0.7), Math.round(r * 2), Math.max(1, Math.round(r * 1.4)))
      }
    })
    g.globalAlpha = 1
  }

  function drawBirds(g: G, c: FrameCtx) {
    for (let i = 0; i < 3; i++) {
      const x = Math.round(wrap(hash2(i, 1, 7) * W - c.t * (4 + i), W + 20) - 10)
      const y = Math.round(hz * (0.25 + i * 0.12) + Math.sin(c.t * 0.5 + i) * 2)
      const up = Math.sin(c.t * 3 + i * 2) > 0
      g.fillStyle = '#2a1a4c'
      g.fillRect(x, y, 1, 1)
      if (up) { g.fillRect(x - 2, y - 1, 2, 1); g.fillRect(x + 1, y - 1, 2, 1) } else { g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1) }
    }
  }

  function drawString(g: G, c: FrameCtx, L: Lights) {
    const n = flash.length
    const sway = Math.sin(c.t * 0.9) * (0.6 + c.energy * 0.6)
    const at = (u: number) => ({
      x: string.x0 + (string.x1 - string.x0) * u,
      y: string.y0 + (string.y1 - string.y0) * u + Math.sin(u * Math.PI) * (string.sag + sway),
    })
    let prev = at(0)
    for (let i = 1; i <= 40; i++) {
      const p = at(i / 40)
      line(g, '#140a22', prev.x, prev.y, p.x, p.y)
      prev = p
    }
    for (const nh of c.notes) {
      if (!melodic(nh.layer)) continue
      const ix = Math.max(0, Math.min(n - 1, Math.round(nh.h * (n - 1))))
      flash[ix] = 1
    }
    for (let i = 0; i < n; i++) {
      flash[i] = Math.max(0, flash[i]! - c.dt * 1.4)
      const p = at((i + 0.5) / n)
      const col = LANTERNS[i % LANTERNS.length]!
      const x = Math.round(p.x) - 1
      const y = Math.round(p.y) + 1
      const swing = Math.round(Math.sin(c.t * 1.3 + i) * 0.6)
      rect(g, INK, x + swing, y, 3, 1)
      rect(g, col, x + swing, y + 1, 3, 3)
      rect(g, mix(col, '#ffffff', 0.5), x + swing + 1, y + 1, 1, 1)
      L.emit(x + swing, y + 1, 3, 3)
      L.light(x + swing + 1.5, y + 2.5, 9 + flash[i]! * 6, col, 0.28 + 0.12 * c.beat + flash[i]! * 0.45)
    }
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !houses || !front) return
    g.drawImage(back, 0, 0)
    drawStars(g, W, Math.round(hz * 0.4), c.t, 0.6, 41)
    drawBirds(g, c)
    drawSmoke(g, c)
    g.drawImage(houses, 0, 0)
    g.drawImage(front, 0, 0)
    for (const w of windows) {
      L.emit(Math.round(w.x - 1.5), Math.round(w.y - 1.5), 3, 3)
      L.light(w.x, w.y, w.far ? 9 : 14, '#ffb13f', (w.far ? 0.3 : 0.42) + 0.08 * c.beat)
    }
    for (const l of lamps) {
      L.emit(Math.round(l.x) - 1, Math.round(l.y) - 1, 3, 2)
      L.light(l.x, l.y + 4, 26, '#ffd23f', 0.45 + 0.1 * c.beat)
    }
    L.emit(rose.x - 2, rose.y - 2, 5, 5)
    L.light(rose.x, rose.y, 12, '#ff2fa0', 0.4 + 0.12 * c.beat)
    L.light(bell.x, bell.y + 2, 8, '#ffd23f', 0.25)
    drawString(g, c, L)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#a497d4', '#76689f', c.dark * 0.5), '#d8ccf4', c.energy * 0.12),
    horizon: () => hz,
  }
}
