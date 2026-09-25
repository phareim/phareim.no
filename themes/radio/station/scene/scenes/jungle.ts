// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Jungle — deep in the green at dusk. A dense teal canopy frames the top
 * with vines hanging from it; through a gap the dusk sky sends pale shafts
 * down. A waterfall pours off a mossy cliff into a pool that mirrors it, a
 * shrine ruin sinks into the moss with a glyph that glows with the kick,
 * and fireflies drift everywhere: more of them as the music builds, and a
 * new one wherever a note lands (pitch → height).
 */
import { DUSK, ditherGradient, disc, hash2, noise1, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { layer, melodic, rng, wrap, type FrameCtx, type G, type Lights, type Place } from '../lib/kit.ts'
import { INK, mirror } from '../lib/paint.ts'

const C = { d: '#0f3445', m: '#1b5763', l: '#2a8579', h: '#5fd6b8', deep: '#0a1f30', far: '#153048', farL: '#1d4058', moss: '#4f9a2a', mossL: '#b6ff4a' }

interface Fly { x: number; y: number; ax: number; ay: number; fx: number; fy: number; ph: number; col: string; born: number; life: number }

export function createJungle(): Place {
  let W = 0
  let H = 0
  let poolTop = 0
  let poolBot = 0
  let fall = { x: 0, w: 0, top: 0 }
  let back: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let copy = document.createElement('canvas')
  let glyph = { x: 0, y: 0 }
  let vines: { x: number; top: number; len: number; ph: number }[] = []
  let flies: Fly[] = []
  const noteFlies: Fly[] = []

  /** A leaf mass: overlapping discs, lit from the upper left, with leaf flecks. */
  function foliage(g: G, x: number, y: number, r: number, salt: number, dark = C.d, mid = C.m, lit = C.l) {
    disc(g, dark, x, y, r)
    disc(g, mid, x - 1, y - 1, Math.max(1, r - 2))
    for (let i = 0; i < Math.max(2, r); i++) {
      const lx = Math.round(x - r + hash2(i, 1, salt) * r * 1.6)
      const ly = Math.round(y - r + hash2(i, 2, salt) * r * 1.4)
      rect(g, lit, lx, ly, 2 + Math.floor(hash2(i, 3, salt) * 2), 1)
      rect(g, dark, lx + 1, ly + 1, 2, 1)
    }
  }

  /** A big tropical leaf from (x, y) toward angle `a`, with a midrib and slits. */
  function bigLeaf(g: G, x: number, y: number, len: number, a: number, width: number, salt: number) {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    for (let s = 0; s < len; s += 0.5) {
      const u = s / len
      const half = Math.sin(Math.PI * Math.min(1, u * 1.05)) * width * (1 - u * 0.3)
      const droop = u * u * len * 0.25
      const cx = x + dx * s
      const cy = y + dy * s + droop
      for (let v = -half; v <= half; v += 0.5) {
        const slit = Math.abs(v) > half * 0.35 && Math.floor(s / 3 + (v > 0 ? 0.5 : 0)) % 3 === 0 && hash2(Math.floor(s / 3), v > 0 ? 1 : 2, salt) > 0.3
        if (slit) continue
        const px = Math.round(cx - dy * v)
        const py = Math.round(cy + dx * v)
        const edge = Math.abs(v) > half - 0.6
        const col = Math.abs(v) < 0.6 ? C.h : edge && v < 0 ? DUSK.rim : v < 0 ? C.l : C.m
        rect(g, col, px, py, 1, 1)
      }
    }
  }

  function layout(w: number, h: number) {
    W = w; H = h
    copy = layer(w, h, () => {})
    const portrait = h > w * 1.1
    poolTop = Math.round(h * (portrait ? 0.7 : 0.72))
    poolBot = Math.round(h * (portrait ? 0.84 : 0.88))
    fall = { x: Math.round(w * 0.54), w: Math.max(12, Math.round(w * 0.065)), top: Math.round(h * (portrait ? 0.3 : 0.22)) }
    const cliffL = Math.round(fall.x - w * 0.14)
    const cliffR = Math.round(fall.x + fall.w + w * 0.13)
    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, Math.round(h * 0.55), [DUSK.sky2, DUSK.sky3, DUSK.sky4, DUSK.sky5, DUSK.sky6])
      ditherGradient(g, 0, Math.round(h * 0.4), w, poolTop, [C.far, C.deep])
      // Far trees: trunks under a continuous far canopy, open above the fall.
      for (let i = 0; i < 10; i++) {
        const tx = Math.round((i + 0.3 + hash2(i, 1, 5) * 0.4) * (w / 10))
        const ty = Math.round(h * 0.3)
        rect(g, '#12283c', tx - 2, ty, 4, poolTop - ty)
        rect(g, C.farL, tx - 2, ty, 1, poolTop - ty)
      }
      const fr = Math.max(8, Math.round(h * 0.08))
      for (let x = -fr; x < w + fr; x += Math.round(fr * 0.8)) {
        const gap = Math.min(1, Math.max(0, 1.35 - Math.abs(x - fall.x - fall.w / 2) / (w * 0.17))) * (0.75 + hash2(x, 9, 5) * 0.25)
        const depth = h * (0.34 - gap * 0.3) + hash2(x, 1, 5) * h * 0.06 - gap * fr * 2
        for (let y = -fr; y < depth; y += Math.round(fr * 0.9)) foliage(g, x + (hash2(x, y, 6) - 0.5) * fr, y, fr, x * 7 + y, '#12283c', C.far, C.farL)
      }
      // The cliff with the fall, stepped ledges of mossy stone.
      for (let x = cliffL; x < cliffR; x++) {
        const edge = Math.min(x - cliffL, cliffR - x)
        const top = fall.top - 2 + Math.round(noise1(x, 5, 9) * 6) + (edge < 10 ? 10 - edge : 0)
        rect(g, '#2c2058', x, top, 1, poolTop - top)
        for (let y = top; y < poolTop; y++) {
          const n = hash2((x + ((y >> 2) & 1) * 2) >> 2, y >> 2, 13)
          if (n > 0.82) rect(g, '#352a68', x, y)
          else if (n < 0.1) rect(g, '#211848', x, y)
          if ((y & 3) === 3 && hash2(x >> 3, y, 14) > 0.5) rect(g, '#1c1440', x, y)
        }
        const drape = hash2(x, 7, 9) > 0.55 ? Math.round(3 + hash2(x, 8, 9) * 16) : 1
        rect(g, C.moss, x, top, 1, 1 + drape)
        if (drape > 6) rect(g, C.d, x, top + drape + 1, 1, 1)
        rect(g, C.mossL, x, top, 1, 1)
      }
      // The pool's far bank.
      rect(g, '#1c1440', 0, poolTop - 2, w, 2)
      rect(g, C.m, 0, poolTop - 3, w, 1)
    })
    // Front: ruin, bank, canopy frame, big leaves.
    front = layer(w, h, g => {
      // The ruin: two pillars and a lintel, sinking into the moss, left of the fall.
      const rx = Math.round(w * (portrait ? 0.08 : 0.14))
      const rw = Math.round(w * (portrait ? 0.26 : 0.2))
      const rTop = Math.round(poolTop - h * (portrait ? 0.22 : 0.33))
      const pw = Math.max(6, Math.round(rw * 0.24))
      for (const px of [rx, rx + rw - pw]) {
        stone(g, px, rTop + 6, pw, poolTop - rTop - 6, px)
      }
      stone(g, rx - 3, rTop, rw + 6, 7, 99)
      // The lintel is cracked; moss spills over it.
      rect(g, INK, rx + Math.round(rw * 0.62), rTop, 1, 7)
      for (let x = rx - 3; x < rx + rw + 3; x++) {
        const dn = Math.round(noise1(x, 3, 17) * 4)
        rect(g, C.moss, x, rTop - 1, 1, 1 + dn)
        rect(g, C.mossL, x, rTop - 1, 1, 1)
        if (hash2(x, 1, 17) > 0.85) rect(g, C.moss, x, rTop + dn, 1, 3 + Math.floor(hash2(x, 2, 17) * 6))
      }
      glyph = { x: rx + Math.round(rw / 2), y: Math.round(rTop + (poolTop - rTop) * 0.45) }
      // Dark doorway and the carved glyph (drawn lit in draw()).
      rect(g, '#0b0616', rx + pw, rTop + 7, rw - pw * 2, poolTop - rTop - 7)
      // Near bank: dark moss with ferns.
      for (let x = 0; x < w; x++) {
        const top = poolBot + Math.round(noise1(x, 9, 21) * 4 - 2)
        rect(g, '#0f2a3a', x, top, 1, h - top)
        rect(g, C.d, x, top, 1, 3)
        rect(g, C.l, x, top, 1, 1)
        if (hash2(x, 3, 21) > 0.7) rect(g, C.m, x, top + 3 + Math.floor(hash2(x, 4, 21) * 8), 2, 1)
      }
      const R = rng(7)
      for (let i = 0; i < Math.round(w / 14); i++) {
        const fx = Math.round(R() * w)
        const fy = poolBot + 2 + Math.round(R() * (h - poolBot) * 0.4)
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI / 2 + (k - 3) * 0.4
          const len = 7 + R() * 7
          for (let s = 0; s < len; s++) {
            const px = Math.round(fx + Math.cos(a) * s)
            const py = Math.round(fy + Math.sin(a) * s + (s * s) / len * 0.8)
            rect(g, s < len * 0.5 ? C.m : C.l, px, py, 1, 1)
            if (s % 2 === 1) rect(g, C.m, px + (k < 3 ? -1 : 1), py + 1, 1, 1)
          }
        }
      }
      // Big leaves in the bottom corners.
      bigLeaf(g, -4, h - 4, h * 0.34, -0.7, h * 0.07, 3)
      bigLeaf(g, 2, h + 2, h * 0.28, -1.2, h * 0.06, 5)
      bigLeaf(g, w + 4, h - 2, h * 0.36, Math.PI + 0.65, h * 0.075, 7)
      bigLeaf(g, w - 3, h + 3, h * 0.25, Math.PI + 1.1, h * 0.055, 9)
      // A trunk on the right edge.
      const tx = Math.round(w * 0.9)
      for (let y = 0; y < h; y++) {
        const x = tx + Math.round(Math.sin(y * 0.03) * 3)
        rect(g, '#241430', x, y, 9, 1)
        rect(g, DUSK.trunk, x + 1, y, 5, 1)
        rect(g, DUSK.rim, x + 1, y, 1, 1)
        if (hash2(x, y >> 2, 31) > 0.9) rect(g, C.moss, x + 2, y, 3, 1)
      }
      // Canopy across the top, ragged underside.
      const cr = Math.max(8, Math.round(h * 0.075))
      for (let x = -cr; x < w + cr; x += Math.round(cr * 0.9)) {
        const gap = Math.max(0, 1 - Math.abs(x - fall.x - fall.w / 2) / (w * 0.2))
        const cy = Math.round(h * 0.02 + hash2(x, 1, 41) * h * 0.08 - gap * (cr * 1.2 + h * 0.06))
        foliage(g, x, cy, cr + Math.round(hash2(x, 2, 41) * cr * 0.5), x + 7)
      }
      for (let x = 0; x < w; x += Math.round(cr * 1.3)) {
        if (Math.abs(x - fall.x - fall.w / 2) < w * 0.14) continue
        const cy = Math.round(-cr * 0.3 + hash2(x, 3, 43) * cr * 0.4)
        foliage(g, x, cy, cr + 2, x + 11)
        // Leaf tufts hanging under the canopy.
        for (let k = 0; k < 3; k++) {
          const lx = x + Math.round((hash2(x, k, 44) - 0.5) * cr * 1.6)
          const ly = cy + cr + Math.round(hash2(x, k + 5, 44) * cr * 0.6)
          rect(g, C.m, lx, ly, 1, 3)
          rect(g, C.l, lx - 1, ly + 2, 1, 2)
          rect(g, C.d, lx + 1, ly + 3, 1, 2)
        }
      }
    })
    vines = []
    for (let i = 0; i < 7; i++) {
      vines.push({ x: Math.round((i + 0.2 + hash2(i, 1, 51) * 0.6) * (w / 7)), top: Math.round(h * 0.06), len: Math.round(h * (0.2 + hash2(i, 2, 51) * 0.35)), ph: hash2(i, 3, 51) * 6 })
    }
    const R = rng(99)
    flies = []
    for (let i = 0; i < 40; i++) {
      flies.push({ x: R() * w, y: h * (0.25 + R() * 0.6), ax: 6 + R() * 16, ay: 3 + R() * 8, fx: 0.05 + R() * 0.12, fy: 0.07 + R() * 0.15, ph: R() * 6.28, col: R() > 0.4 ? '#b6ff4a' : '#ffd23f', born: 0, life: 0 })
    }
  }

  function stone(g: G, x: number, y: number, w: number, h: number, salt: number) {
    rect(g, INK, x - 1, y, w + 2, h)
    rect(g, DUSK.stone, x, y, w, h)
    for (let yy = y; yy < y + h; yy += 5) {
      const off = ((yy - y) / 5) % 2 ? 3 : 0
      for (let xx = x - off; xx < x + w; xx += 7) {
        const n = hash2(xx, yy, salt)
        const bx = Math.max(x, xx)
        const bw = Math.min(x + w, xx + 7) - bx
        if (bw <= 0) continue
        rect(g, n > 0.7 ? DUSK.stoneL : n < 0.3 ? DUSK.stoneD : DUSK.stone, bx, yy, bw, Math.min(5, y + h - yy))
        rect(g, DUSK.stoneTop, bx, yy + 4, bw, 1)
        if (n > 0.8) rect(g, C.moss, bx, yy, Math.min(3, bw), 1)
      }
    }
  }

  function drawFall(g: G, c: FrameCtx, L: Lights) {
    const len = poolTop - fall.top
    const speed = 38 + c.energy * 14
    rect(g, '#1f5a78', fall.x - 1, fall.top, fall.w + 2, len)
    for (let x = fall.x; x < fall.x + fall.w; x++) {
      const edge = x === fall.x || x === fall.x + fall.w - 1
      rect(g, edge ? '#2d6a9a' : '#3f8fa8', x, fall.top, 1, len)
      for (let k = 0; k < 4; k++) {
        const y = fall.top + Math.round(wrap(c.t * speed * (0.9 + hash2(x, k, 3) * 0.3) + hash2(x, k + 9, 3) * len, len))
        const dl = 3 + Math.floor(hash2(x, k + 20, 3) * 7)
        rect(g, k === 0 ? '#e8fbff' : '#7ce4ff', x, y, 1, Math.min(dl, poolTop - y))
      }
    }
    // The lip: a smooth bright curve.
    rect(g, '#7ce4ff', fall.x - 1, fall.top, fall.w + 2, 1)
    rect(g, '#e8fbff', fall.x, fall.top + 1, fall.w, 1)
    L.emit(fall.x - 1, fall.top, fall.w + 2, len)
    L.light(fall.x + fall.w / 2, poolTop, fall.w * 2.2, '#7ce4ff', 0.35)
  }

  function drawMist(g: G, c: FrameCtx) {
    // Foam and mist where the fall hits the pool.
    for (let i = 0; i < 14; i++) {
      const ph = wrap(c.t * 0.6 + hash2(i, 1, 61), 1)
      const x = fall.x + fall.w / 2 + (hash2(i, 2, 61) - 0.5) * fall.w * 2.4 * (0.5 + ph)
      const y = poolTop + 1 - ph * 8
      g.globalAlpha = 0.35 * (1 - ph)
      disc(g, '#cfeeff', x, y, Math.round(2 + ph * 3))
    }
    g.globalAlpha = 1
    for (let x = fall.x - 4; x < fall.x + fall.w + 4; x++) {
      if (hash2(x, Math.floor(c.t * 8), 5) > 0.4) rect(g, '#e8fbff', x, poolTop + (hash2(x, 1, 5) > 0.5 ? 0 : 1), 1, 1)
    }
  }

  function drawVines(g: G, c: FrameCtx) {
    for (const v of vines) {
      const sway = Math.sin(c.t * 0.5 + v.ph) * (1 + c.energy)
      for (let s = 0; s < v.len; s++) {
        const u = s / v.len
        const x = Math.round(v.x + Math.sin(s * 0.12 + v.ph) * 1.5 + sway * u * u * 3)
        const y = v.top + s
        rect(g, '#16402c', x, y, 1, 1)
        if (s % 5 === 0 && s > 3) {
          const side = (s / 5) % 2 ? 1 : -1
          rect(g, C.l, x + side, y, 1, 1)
          rect(g, C.m, x + side * 2, y + 1, 1, 1)
        }
      }
    }
  }

  function flyAt(f: Fly, t: number): [number, number] {
    return [f.x + Math.sin(t * f.fx * 6.28 + f.ph) * f.ax, f.y + Math.sin(t * f.fy * 6.28 + f.ph * 1.3) * f.ay]
  }

  function drawFly(g: G, L: Lights, x: number, y: number, a: number, col: string) {
    if (a < 0.05) return
    const px = Math.round(x)
    const py = Math.round(y)
    rect(g, a > 0.5 ? '#fff1b0' : col, px, py, 1, 1)
    L.emit(px, py, 1, 1)
    L.light(px + 0.5, py + 0.5, 6 + a * 4, col, a * 0.55)
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !front) return
    g.drawImage(back, 0, 0)
    // Shafts of dusk light from the canopy gap.
    g.fillStyle = '#9ff0e0'
    for (let i = 0; i < 3; i++) {
      const x0 = fall.x - W * 0.12 + i * W * 0.08
      const a = 0.07 + 0.03 * Math.sin(c.t * 0.3 + i * 2)
      for (let y = Math.round(H * 0.06); y < poolTop; y += 2) {
        g.globalAlpha = a * (1 - y / poolTop)
        g.fillRect(Math.round(x0 + (y - H * 0.06) * 0.35), y, 5 + i * 2, 2)
      }
    }
    g.globalAlpha = 1
    drawFall(g, c, L)
    // Pool: mirror what stands above it, tinted teal.
    rect(g, '#0a2a3a', 0, poolTop, W, poolBot - poolTop)
    copy.getContext('2d')!.drawImage(g.canvas, 0, 0, W, poolTop, 0, 0, W, poolTop)
    mirror(g, copy, poolTop - 3, poolTop, poolBot, W, c.t, 0.8 + c.energy * 0.3, '#0f3445', 0.4)
    drawMist(g, c)
    g.drawImage(front, 0, 0)
    // The glyph: a neon eye carved in the lintel's shadow.
    const gc = mix('#2ff3ff', c.accent, 0.35)
    const gx = glyph.x
    const gy = glyph.y
    rect(g, gc, gx - 3, gy, 7, 1)
    rect(g, gc, gx - 2, gy - 1, 5, 1)
    rect(g, gc, gx - 2, gy + 1, 5, 1)
    rect(g, '#0b0616', gx, gy, 1, 1)
    rect(g, gc, gx, gy - 3, 1, 1)
    rect(g, gc, gx, gy + 3, 1, 1)
    L.emit(gx - 3, gy - 3, 7, 7)
    L.light(gx, gy, 20, gc, 0.35 + 0.2 * c.beat)
    drawVines(g, c)
    // Fireflies: the steady swarm, then the ones the notes bring.
    const n = Math.round(8 + c.energy * 26)
    for (let i = 0; i < n; i++) {
      const f = flies[i]!
      const [x, y] = flyAt(f, c.t)
      const blink = Math.max(0, Math.sin(c.t * (0.6 + f.fy * 3) + f.ph * 3))
      drawFly(g, L, x, y, blink * blink, f.col)
    }
    for (const nh of c.notes) {
      if (!melodic(nh.layer) || noteFlies.length > 24) continue
      noteFlies.push({ x: W * (0.08 + Math.random() * 0.84), y: H * (0.82 - nh.h * 0.62), ax: 3 + Math.random() * 5, ay: 2 + Math.random() * 3, fx: 0.1, fy: 0.13, ph: Math.random() * 6, col: nh.layer === 'bells' ? '#fff1b0' : nh.layer === 'lead' ? mix(c.accent, '#b6ff4a', 0.5) : '#b6ff4a', born: c.t, life: 3 + Math.random() * 2 })
    }
    for (let i = noteFlies.length - 1; i >= 0; i--) {
      const f = noteFlies[i]!
      const age = c.t - f.born
      if (age > f.life) { noteFlies.splice(i, 1); continue }
      const [x, y] = flyAt(f, c.t)
      const a = age < 0.3 ? age / 0.3 : 1 - (age - 0.3) / (f.life - 0.3)
      drawFly(g, L, x, y - age * 2, a, f.col)
    }
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#a8b0dc', '#7c80b8', c.dark * 0.5), '#d0dcf0', c.energy * 0.12),
    horizon: () => Math.round(H * 0.35),
  }
}
