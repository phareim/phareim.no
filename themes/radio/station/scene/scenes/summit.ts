// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Mountain Top — above the clouds at dusk. Violet peaks rise from a sea of
 * cloud that drifts in two layers; their snow catches the pink light of a
 * sun sinking into the cloud. On the summit ledge in front: a cairn with a
 * butter lamp (it breathes with the kick) and a line of prayer flags that
 * flutters harder as the music builds, with spindrift off the snow.
 */
import { DUSK, ditherGradient, hash2, noise1, paintSun, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { clamp, ditherRect, drawSparks, layer, melodic, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { INK, drawStarList, line, makeStars, type Star } from '../lib/paint.ts'

const FLAGS = ['#2f5fd0', '#fff4ff', '#ff3b5c', '#3fd8b0', '#ffd23f']

export function createSummit(): Place {
  let W = 0
  let H = 0
  let cloudTop = 0
  let back: HTMLCanvasElement | null = null
  let sunC: HTMLCanvasElement | null = null
  let peaks: HTMLCanvasElement | null = null
  let cloudsFar: HTMLCanvasElement | null = null
  let cloudsMid: HTMLCanvasElement | null = null
  let cloudsNear: HTMLCanvasElement | null = null
  let ledge: HTMLCanvasElement | null = null
  let stars: Star[] = []
  let sun = { x: 0, y: 0, r: 0 }
  let lamp = { x: 0, y: 0 }
  let flagA = { x: 0, y: 0 }
  let flagB = { x: 0, y: 0 }
  let snowTops: { x: number; y: number }[] = []
  const sparks: Spark[] = []

  /**
   * A peak: a jagged ridge with the face toward the sun (right) lit, the
   * crest line between the faces wandering, snow lying in gullies that run
   * down the slope, and haze where it meets the cloud.
   */
  function peak(g: G, cx: number, topY: number, halfW: number, baseY: number, salt: number, rock: string, rockL: string, snowL: string, snowD: string, rim: string, haze: string) {
    const x0 = Math.round(cx - halfW)
    const x1 = Math.round(cx + halfW)
    const span = baseY - topY
    for (let x = x0; x <= x1; x++) {
      const d = (x - cx) / halfW
      const shape = 1 - Math.pow(Math.abs(d), 0.85)
      const n = noise1(x, 9, salt) * 0.16 + noise1(x, 3, salt + 5) * 0.07
      const top = Math.round(topY + span * (1 - shape * (0.86 + n)))
      if (top >= baseY) continue
      for (let y = top; y < baseY; y++) {
        const depth = (y - topY) / span
        const crest = cx + (noise1(y, 11, salt + 2) - 0.5) * halfW * 0.25 - (y - topY) * 0.15
        const lit = x > crest
        // Gullies run down the slope; more of them are snow near the top.
        const u = lit ? x - (y - top) * 0.9 : x + (y - top) * 0.9
        const gully = noise1(u, 4, salt + 7) * 0.7 + noise1(u, 2, salt + 13) * 0.3
        const snowy = y - top < 2 + shape * span * 0.12 || gully > 0.05 + depth * 1.05
        let col = snowy ? (lit ? snowL : snowD) : lit ? rockL : rock
        if (y === top) col = lit ? rim : snowD
        else if (snowy && lit && y - top < 2) col = '#fff4ff'
        rect(g, col, x, y, 1, 1)
      }
    }
    // Haze toward the cloud sea.
    const band = Math.max(2, Math.round(span * 0.08))
    ditherRect(g, haze, 0.25, x0, baseY - band * 2, x1 - x0 + 1, band)
    ditherRect(g, haze, 0.5, x0, baseY - band, x1 - x0 + 1, band)
    snowTops.push({ x: cx, y: topY })
  }

  /**
   * A band of cloud, periodic in x with period w (drawn twice as wide so it
   * can scroll): the top is the outline of a row of round billows, lit on
   * top, with a second row of smaller billows inside for depth.
   */
  function cloudStrip(w: number, h: number, y: number, r: number, salt: number, body: string, lit: string, shade: string, fill: string): HTMLCanvasElement {
    const outline = (rad: number, lift: number, s2: number) => {
      const tops = new Float32Array(w).fill(y + lift + rad * 0.5)
      const n = Math.ceil(w / (rad * 1.6))
      for (let i = 0; i < n; i++) {
        const pr = rad * (0.7 + hash2(i, 1, s2) * 0.7)
        const px = (i / n) * w + hash2(i, 2, s2) * rad * 0.6
        const py = y + lift + hash2(i, 3, s2) * rad * 0.5
        for (let x = Math.floor(px - pr); x <= px + pr; x++) {
          const dx = x - px
          const top = py - Math.sqrt(Math.max(0, pr * pr - dx * dx)) * 0.9
          const xi = ((x % w) + w) % w
          if (top < tops[xi]!) tops[xi] = top
        }
      }
      return tops
    }
    const outer = outline(r, 0, salt)
    const inner = outline(r * 0.6, r * 0.7, salt + 50)
    return layer(w * 2, h, g => {
      for (let xx = 0; xx < w * 2; xx++) {
        const x = xx % w
        const top = Math.round(outer[x]!)
        rect(g, body, xx, top, 1, h - top)
        rect(g, lit, xx, top, 1, 1)
        rect(g, mix(lit, body, 0.5), xx, top + 1, 1, 1)
        const it = Math.round(inner[x]!)
        if (it > top + 3) {
          rect(g, shade, xx, it - 1, 1, 1)
          rect(g, mix(body, lit, 0.3), xx, it, 1, 1)
        }
        const deep = Math.round(y + r * 1.6)
        if (deep > top) rect(g, fill, xx, deep, 1, h - deep)
      }
      for (let yy = Math.round(y + r * 1.6) + 2; yy < h; yy += 3) for (let x = 0; x < w; x += 6) {
        if (hash2(x, yy, salt) > 0.8) for (const off of [0, w]) rect(g, shade, x + off, yy, 5, 1)
      }
    })
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    cloudTop = Math.round(h * (portrait ? 0.6 : 0.6))
    const r = Math.max(8, Math.round(Math.min(w, h) * 0.08))
    sun = { x: Math.round(w * (portrait ? 0.9 : 0.8)), y: cloudTop + Math.round(r * 0.1), r }
    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, cloudTop + 4, [DUSK.sky0, DUSK.sky1, DUSK.sky2, DUSK.sky3, DUSK.sky4, DUSK.sky5, DUSK.sky6, DUSK.sky7])
    })
    sunC = layer(w, h, g => paintSun(g, sun.x, sun.y, sun.r, DUSK.sky7))
    stars = makeStars(w, Math.round(cloudTop * 0.45), 0.9, 21)
    snowTops = []
    peaks = layer(w, h, g => {
      const base = cloudTop + 6
      // Far range, hazy.
      const haze = '#8c5a9e'
      peak(g, w * 0.12, cloudTop - h * 0.16, w * 0.16, base, 3, '#3a2f70', '#4a3d88', '#b9a8d9', '#6a5fa0', '#e0a0d8', haze)
      peak(g, w * 0.64, cloudTop - h * 0.21, w * 0.2, base, 5, '#3a2f70', '#4a3d88', '#b9a8d9', '#6a5fa0', '#e0a0d8', haze)
      // The big one.
      peak(g, w * (portrait ? 0.42 : 0.36), cloudTop - h * (portrait ? 0.3 : 0.42), w * (portrait ? 0.4 : 0.3), base, 11, '#221a4a', '#54259e', '#ffc4e8', '#7a70b0', '#ff8ae0', haze)
      if (!portrait) peak(g, w * 0.9, cloudTop - h * 0.13, w * 0.14, base, 17, '#2c2058', '#43246e', '#e6c0e8', '#8f86b8', '#ff8ae0', haze)
    })
    const cr = Math.max(6, Math.round(Math.min(h, w) * 0.045))
    cloudsFar = cloudStrip(w, h, cloudTop + 1, cr, 31, '#8c5a9e', '#e8a0d0', '#6a3f86', '#6a3f86')
    const span = h - cloudTop
    cloudsMid = cloudStrip(w, h, cloudTop + Math.round(span * 0.13), Math.round(cr * 1.4), 39, '#9c68ab', '#f0b4dc', '#74469a', '#62428c')
    cloudsNear = cloudStrip(w, h, cloudTop + Math.round(span * 0.33), Math.round(cr * 2), 47, '#b07ab8', '#ffd0ec', '#7d4d9c', '#5a3f86')
    // The summit ledge, lower left, with the cairn and the flag pole.
    const lx = Math.round(w * (portrait ? 0.62 : 0.5))
    const ly = Math.round(h * (portrait ? 0.84 : 0.8))
    let cairnX = Math.round(w * (portrait ? 0.2 : 0.14))
    ledge = layer(w, h, g => {
      for (let x = 0; x < w; x++) {
        const d = x / lx
        const top = Math.round(ly + Math.pow(Math.max(0, d), 2.2) * (h - ly) * 1.1 - noise1(x, 6, 71) * 5)
        if (top >= h) continue
        rect(g, '#1c1440', x, top, 1, h - top)
        rect(g, '#2c2058', x, top + 2, 1, Math.max(0, Math.round((h - top) * 0.3)))
        const snow = Math.round(1 + noise1(x, 4, 73) * 3)
        rect(g, '#cfc6ff', x, top, 1, snow)
        rect(g, '#ff8ae0', x, top, 1, 1)
        if (hash2(x, 9, 71) > 0.8) rect(g, '#8f86b8', x, top + snow, 1, 1)
      }
      const groundAt = (x: number) => Math.round(ly + Math.pow(Math.max(0, x / lx), 2.2) * (h - ly) * 1.1 - noise1(x, 6, 71) * 5)
      // Cairn: stacked flat stones.
      const cy0 = groundAt(cairnX)
      const stones: [number, number][] = [[9, 3], [8, 3], [7, 3], [5, 2], [4, 2], [3, 2]]
      let y = cy0 + 1
      stones.forEach(([sw, sh], i) => {
        y -= sh
        const sx = cairnX - Math.floor(sw / 2) + (i % 2 ? 1 : 0)
        rect(g, INK, sx - 1, y - 1, sw + 2, sh + 1)
        rect(g, i % 2 ? '#4a3d88' : '#3a2f70', sx, y, sw, sh - 1)
        rect(g, '#8f86b8', sx, y, sw, 1)
        rect(g, '#cfc6ff', sx + 1, y, Math.max(1, sw - 4), 1)
      })
      lamp = { x: cairnX + 6, y: cy0 - 2 }
      rect(g, INK, lamp.x - 2, lamp.y - 1, 5, 3)
      rect(g, '#c4861c', lamp.x - 1, lamp.y, 3, 1)
      flagA = { x: cairnX, y: y - 1 }
      // Pole.
      const px = Math.round(lx * 0.95)
      const py = groundAt(px)
      rect(g, INK, px, py - Math.round(h * 0.2), 2, Math.round(h * 0.2) + 2)
      rect(g, '#6a4432', px, py - Math.round(h * 0.2), 1, Math.round(h * 0.2))
      flagB = { x: px, y: py - Math.round(h * 0.2) }
    })
  }

  function drawFlags(g: G, c: FrameCtx) {
    const n = Math.max(5, Math.round((flagB.x - flagA.x) / 7))
    const wind = 0.5 + c.energy * 1.2
    let px = flagA.x
    let py = flagA.y
    for (let i = 1; i <= n; i++) {
      const u = i / n
      const x = Math.round(flagA.x + (flagB.x - flagA.x) * u)
      const y = Math.round(flagA.y + (flagB.y - flagA.y) * u + Math.sin(u * Math.PI) * 6 + Math.sin(c.t * 1.5 * wind + u * 4) * wind * 0.8)
      line(g, '#140a22', px, py, x, y)
      if (i < n) {
        // A flag hangs from the string and swings back in the wind.
        const col = FLAGS[i % FLAGS.length]!
        const lift = clamp(Math.sin(c.t * 3 * wind + i * 1.7) * 0.5 + wind * 0.6, 0, 1.6)
        for (let fy = 0; fy < 4; fy++) {
          const sx = Math.round(x + 1 - fy * lift * 0.7)
          rect(g, col, sx, y + 1 + fy, 3, 1)
        }
        rect(g, mix(col, '#0b0616', 0.4), Math.round(x + 1 - 3 * lift * 0.7), y + 4, 3, 1)
      }
      px = x; py = y
    }
  }

  function drawSpindrift(g: G, c: FrameCtx) {
    const n = Math.round(8 + c.energy * 30)
    const wind = 10 + c.energy * 25
    for (let i = 0; i < n; i++) {
      const top = snowTops[i % snowTops.length]!
      const life = 3 + hash2(i, 1, 81) * 3
      const ph = wrap(c.t + hash2(i, 2, 81) * life, life) / life
      const x = Math.round(top.x - ph * wind * life * 0.8 + hash2(i, 3, 81) * 6)
      const y = Math.round(top.y + ph * 14 + Math.sin(c.t * 2 + i) * 2 + hash2(i, 4, 81) * 4)
      if (ph > 0.85) continue
      rect(g, ph < 0.4 ? '#fff4ff' : '#cfc6ff', x, y)
    }
    // Snow blowing past up close.
    const m = Math.round(4 + c.energy * 16)
    for (let i = 0; i < m; i++) {
      const sp = wind * (2 + hash2(i, 5, 83) * 2)
      const x = Math.round(W - wrap(c.t * sp + hash2(i, 6, 83) * W * 3, W + 20))
      const y = Math.round(H * (0.55 + hash2(i, 7, 83) * 0.45) + Math.sin(c.t * 3 + i) * 3)
      rect(g, '#fff4ff', x, y, 2, 1)
    }
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !sunC || !peaks || !cloudsFar || !cloudsNear || !ledge) return
    g.drawImage(back, 0, 0)
    drawStarList(g, stars, c.t)
    g.drawImage(sunC, 0, 0)
    L.emitImage(sunC)
    g.drawImage(peaks, 0, 0)
    const drift = 1.2 + c.energy * 1.5
    g.drawImage(cloudsFar, -Math.round(wrap(c.t * drift, W)), 0)
    // Haze where the peaks meet the cloud.
    ditherRect(g, '#e8a0d0', 0.25, 0, cloudTop - 3, W, 3)
    if (cloudsMid) g.drawImage(cloudsMid, -Math.round(wrap(c.t * drift * 1.6, W)), 0)
    g.drawImage(cloudsNear, -Math.round(wrap(c.t * drift * 2.3, W)), 0)
    g.drawImage(ledge, 0, 0)
    drawFlags(g, c)
    drawSpindrift(g, c)
    L.light(sun.x, sun.y, sun.r * 5, '#ff8ae0', 0.3)
    L.light(sun.x, sun.y, sun.r * 2.2, '#ffd23f', 0.3)
    const f = 0.5 + 0.5 * Math.sin(c.t * 7) * Math.sin(c.t * 4.3)
    rect(g, '#ffd23f', lamp.x, lamp.y - 1 - Math.round(f), 1, 1 + Math.round(f))
    L.emit(lamp.x - 1, lamp.y - 2, 3, 3)
    L.light(lamp.x + 0.5, lamp.y - 1, 16 + f * 2, '#ff8a3d', 0.5 + 0.18 * c.beat)
    for (const n of c.notes) {
      if (!melodic(n.layer) || n.layer === 'arp') continue
      spawnSpark(sparks, 6 + Math.random() * (W - 12), 3 + (1 - n.h) * cloudTop * 0.4, n.layer === 'bells' ? '#fff4ff' : mix(c.accent, '#ffffff', 0.4), n.layer === 'bells', 2)
    }
    drawSparks(g, sparks, c.dt, L)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#c4b8e8', '#8a7cb8', c.dark * 0.5), '#e8dcff', c.energy * 0.12),
    horizon: () => cloudTop,
  }
}
