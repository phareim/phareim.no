// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Autumn Harbour — a small fjord harbour at grey dawn, late in the year.
 * Across the water, mountains with the first snow on their tops and a low
 * sun coming up through the saddle between them, a village climbing a hill
 * with a white church. In the middle, a red fishing boat lies moored with
 * its wheelhouse lit and someone in oilskins on deck; a breakwater runs out
 * to a harbour light that blinks. Near us: the stone quay with bollards,
 * a red boathouse, fish crates, an old lamp, a bench where someone sits
 * with a steaming cup, and a birch letting go of its last leaves.
 *
 * The music: kalimba arp notes glint on the water (high notes far out,
 * low notes close in), lead and counter notes light windows in the village
 * at their pitch's height up the hill, bells ring the church window. The
 * kick breathes the quay lamp and the boat's mast lantern and puffs the
 * boat's exhaust; the chord colour tints the harbour light and the boat's
 * pennant. Intensity is wind: faster clouds, more leaves, a rougher
 * harbour, more gulls. The pad thickens the mist; the bass rocks the boat;
 * darker modes draw an overcast veil over the dawn.
 */
import { disc, ditherGradient, hash2, noise1, paintSun, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { clamp, ditherPattern, ditherRect, drawSparks, layer, mirrorLights, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { INK, line, mirror } from '../lib/paint.ts'

interface Win { x: number; y: number; f: number }
interface Box { x: number; y: number; w: number; h: number }
interface Leaf { x: number; y: number; vy: number; ph: number; c: string; land: number; age: number }
interface Puff { x: number; y: number; age: number; life: number }
interface Band { y: number; len: number; sp: number; off: number; th: number; lit: string; body: string }
interface Post { x: number; base: number; h: number }

const SKY = ['#140b26', '#1c1234', '#2a1c48', '#43285e', '#6a3a72', '#94527a', '#c07078', '#e08a70', '#f0a878']
const LEAVES = ['#c4561c', '#e0902a', '#ffb13f', '#ffd23f', '#f0a030']

export function createAutumnHarbour4ce5(): Place {
  let W = 0
  let H = 0
  let hz = 0
  let quay = 0
  let boatY = 0
  let portrait = false
  let sky: HTMLCanvasElement | null = null
  let sunC: HTMLCanvasElement | null = null
  let land: HTMLCanvasElement | null = null
  let mole: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let boatC: HTMLCanvasElement | null = null
  let copy: HTMLCanvasElement | null = null
  let sun = { x: 0, y: 0, r: 0 }
  let town: Win[] = []
  let townTop = 0
  let church = { x: 0, y: 0, f: 0 }
  let harbourLight = { x: 0, y: 0, base: 0 }
  let boat = { x: 0, cw: 0, wl: 0, wins: [] as Box[], lantern: { x: 0, y: 0 }, mast: { x: 0, y: 0 }, stack: { x: 0, y: 0 }, stern: { x: 0, y: 0 }, bow: { x: 0, y: 0 } }
  let posts: Post[] = []
  let bollards: { x: number; y: number }[] = []
  let lamp = { x: 0, y: 0 }
  let naust = { win: { x: 0, y: 0, w: 0, h: 0 }, gap: { x: 0, y: 0, w: 0, h: 0 } }
  let bench = { x: 0, y: 0 }
  let cup = { x: 0, y: 0 }
  let crown = { x: 0, y: 0, rx: 0, ry: 0 }
  let walkY = 0
  let bands: Band[] = []
  const leaves: Leaf[] = []
  const puffs: Puff[] = []
  const sparks: Spark[] = []
  let lastBeat = 0

  /** The fishing boat in side view, bow to the right, waterline on the last row. */
  function paintBoat(g: G, BL: number, hh: number, mastH: number, ch: number) {
    const wl = ch - 1
    const x0 = 4
    const x1 = x0 + BL - 1
    const rake = Math.round(BL * 0.16)
    const top = (x: number) => {
      const u = clamp((x - x0) / BL, 0, 1)
      return wl - hh + 1 - Math.round(3.5 * u * u * u) - (u < 0.06 ? 1 : 0)
    }
    const bottom = (x: number) => {
      if (x > x1 - rake) { const k = (x - (x1 - rake)) / rake; return wl - Math.round(k * k * (hh - 2)) }
      if (x < x0 + 2) return wl - (x0 + 2 - x)
      return wl
    }
    // Stays first, so the mast and the wheelhouse sit over them.
    const mx = x0 + Math.round(BL * 0.56)
    const mTop = top(mx) - mastH
    const whx0 = x0 + Math.round(BL * 0.12)
    const whx1 = x0 + Math.round(BL * 0.36)
    const whH = Math.max(8, Math.round(BL * 0.17))
    const whTop = top(whx0) - whH
    line(g, '#5a5285', mx, mTop + 1, x1, top(x1))
    line(g, '#5a5285', mx, mTop + 1, whx1, whTop - 3)
    // Hull, column by column, outlined in ink.
    const stripe = wl - Math.round(hh * 0.45)
    for (let x = x0; x <= x1; x++) {
      const t = top(x)
      const b = bottom(x)
      rect(g, INK, x, t - 1, 1, b - t + 2)
      for (let y = t; y <= b; y++) {
        const r = y - t
        const col = y >= wl - 1 ? '#3a1a3a' : y === stripe ? '#cfc6ff' : r === 0 ? '#f0dcc8' : r % 3 === 2 ? '#94442e' : '#b0543a'
        rect(g, col, x, y, 1, 1)
      }
    }
    rect(g, INK, x0 - 1, top(x0) - 1, 1, wl - top(x0))
    rect(g, INK, x1 + 1, top(x1) - 1, 1, bottom(x1) - top(x1) + 2)
    // Mast, crossbar, lantern housing, a derrick boom.
    rect(g, '#241a3e', mx, mTop, 1, top(mx) - mTop)
    rect(g, '#241a3e', mx - 3, mTop + Math.round(mastH * 0.25), 7, 1)
    rect(g, INK, mx - 1, mTop - 3, 3, 3)
    line(g, '#241a3e', mx, top(mx) - Math.round(mastH * 0.35), whx1 + 3, top(whx1 + 3) - 2)
    // Wheelhouse with lit windows, a lifebuoy, the exhaust stack.
    const ww = whx1 - whx0
    rect(g, INK, whx0 - 1, whTop - 1, ww + 2, whH + 1)
    rect(g, '#b9b0e6', whx0, whTop, ww, whH)
    rect(g, '#e8e0ff', whx0, whTop, ww, 1)
    rect(g, '#8f86b8', whx0, whTop, 1, whH)
    const sx = whx0 + 2
    rect(g, INK, sx - 1, whTop - 9, 4, 7)
    rect(g, '#3a2a4a', sx, whTop - 8, 2, 6)
    rect(g, '#ff3b5c', sx, whTop - 7, 2, 1)
    rect(g, INK, whx0 - 2, whTop - 3, ww + 4, 3)
    rect(g, '#5a5285', whx0 - 1, whTop - 2, ww + 2, 1)
    const wins: Box[] = []
    const n = Math.max(2, Math.floor((ww - 2) / 4))
    for (let i = 0; i < n; i++) {
      const wx = whx0 + 2 + i * 4
      rect(g, INK, wx - 1, whTop + 1, 5, 5)
      rect(g, '#ffd23f', wx, whTop + 2, 3, 3)
      rect(g, '#fff1b0', wx, whTop + 2, 1, 1)
      wins.push({ x: wx, y: whTop + 2, w: 3, h: 3 })
    }
    if (whH >= 10) {
      const lx = whx0 + Math.round(ww * 0.5) - 1
      const ly = whTop + 7
      rect(g, '#ff8a3d', lx, ly, 3, 3)
      rect(g, '#fff4ff', lx + 1, ly, 1, 1)
      rect(g, '#fff4ff', lx + 1, ly + 2, 1, 1)
      rect(g, '#6a3a5a', lx + 1, ly + 1, 1, 1)
    }
    // Someone in oilskins on deck; fish crates and a heap of net forward.
    const fx = x0 + Math.round(BL * 0.44)
    const fb = top(fx)
    rect(g, INK, fx - 2, fb - 9, 5, 9)
    rect(g, '#ffd23f', fx - 1, fb - 6, 3, 5)
    rect(g, '#c4861c', fx + 1, fb - 6, 1, 5)
    rect(g, '#f5c3a8', fx - 1, fb - 7, 2, 1)
    rect(g, '#ffd23f', fx - 1, fb - 8, 3, 1)
    for (let i = 0; i < 3; i++) {
      const cx = x0 + Math.round(BL * 0.63) + i * 5 - (i === 2 ? 7 : 0)
      const cy = top(cx) - 3 - (i === 2 ? 3 : 0)
      const blue = i !== 1
      rect(g, INK, cx - 1, cy - 1, 6, 5)
      rect(g, blue ? '#2f5fd0' : '#ff8a3d', cx, cy, 4, 3)
      rect(g, blue ? '#7ce4ff' : '#ffd23f', cx, cy, 4, 1)
    }
    const nx = x0 + Math.round(BL * 0.8)
    disc(g, INK, nx, top(nx) - 1, 3)
    disc(g, '#1f7a6e', nx, top(nx) - 1, 2)
    rect(g, '#3fd8b0', nx - 1, top(nx) - 3, 2, 1)
    rect(g, '#f0dcc8', nx - 3, top(nx), 7, 1)
    boat.wins = wins
    boat.lantern = { x: mx, y: mTop - 2 }
    boat.mast = { x: mx, y: mTop }
    boat.stack = { x: sx + 1, y: whTop - 9 }
    boat.stern = { x: x0 + 1, y: top(x0 + 1) }
    boat.bow = { x: x1 - 3, y: top(x1 - 3) }
    boat.wl = wl
  }

  /** A red boathouse gable-on, with white barge boards, a lit gable window and a door ajar. */
  function paintNaust(g: G, x0: number, base: number, nw: number) {
    const wallH = Math.round(nw * 0.42)
    const roofH = Math.round(nw * 0.44)
    const wallTop = base - wallH
    const apex = Math.round(x0 + nw / 2)
    for (let y = 0; y <= roofH; y++) {
      const half = Math.round(((y + 1) / (roofH + 1)) * (nw / 2 + 2))
      const yy = wallTop - roofH + y
      rect(g, INK, apex - half - 1, yy - 1, half * 2 + 3, 2)
      rect(g, '#f0e4e8', apex - half, yy, 2, 1)
      rect(g, '#f0e4e8', apex + half - 1, yy, 2, 1)
      for (let x = apex - half + 2; x < apex + half - 1; x++) rect(g, (x - x0) % 3 === 0 ? '#5a1a24' : '#8a2a2e', x, yy, 1, 1)
    }
    rect(g, INK, x0 - 1, wallTop, nw + 2, wallH + 1)
    for (let x = x0; x < x0 + nw; x++) rect(g, (x - x0) % 3 === 0 ? '#5a1a24' : (x - x0) % 3 === 1 ? '#9a3032' : '#8a2a2e', x, wallTop, 1, wallH)
    rect(g, '#f0e4e8', x0 - 1, wallTop, nw + 2, 1)
    // Double doors, one ajar with the lamp inside.
    const dw = Math.round(nw * 0.5)
    const dx = apex - Math.round(dw / 2)
    const dh = Math.round(wallH * 0.8)
    rect(g, INK, dx - 1, base - dh - 1, dw + 2, dh + 1)
    rect(g, '#4a1420', dx, base - dh, dw, dh)
    rect(g, '#f0e4e8', dx, base - dh, dw, 1)
    rect(g, '#f0e4e8', dx + Math.round(dw / 2), base - dh, 1, dh)
    line(g, '#b9a0b0', dx + 1, base - 2, dx + Math.round(dw / 2) - 1, base - dh + 2)
    naust.gap = { x: dx + Math.round(dw / 2) + 1, y: base - dh + 1, w: 2, h: dh - 1 }
    rect(g, '#ffb13f', naust.gap.x, naust.gap.y, naust.gap.w, naust.gap.h)
    const gw = Math.max(4, Math.round(nw * 0.14))
    naust.win = { x: apex - Math.round(gw / 2), y: wallTop - Math.round(roofH * 0.55), w: gw, h: Math.max(3, Math.round(gw * 0.75)) }
    const wv = naust.win
    rect(g, INK, wv.x - 1, wv.y - 1, wv.w + 2, wv.h + 2)
    rect(g, '#ffd23f', wv.x, wv.y, wv.w, wv.h)
    rect(g, '#ffb13f', wv.x, wv.y + wv.h - 1, wv.w, 1)
    rect(g, INK, wv.x + Math.floor(wv.w / 2), wv.y, 1, wv.h)
    // Oars leaning on the wall and a lifebuoy.
    for (let k = 0; k < 2; k++) line(g, '#c4861c', x0 + 2 + k * 2, base - 1, x0 + 4 + k * 2, base - wallH - 3)
    const lx = x0 + nw - 6
    const ly = wallTop + 3
    disc(g, INK, lx, ly + 2, 3)
    disc(g, '#ff8a3d', lx, ly + 2, 2)
    rect(g, '#fff4ff', lx - 2, ly + 2, 1, 1)
    rect(g, '#fff4ff', lx + 2, ly + 2, 1, 1)
    rect(g, '#8a2a2e', lx, ly + 2, 1, 1)
  }

  /** A birch in autumn: a pale marked trunk, drooping limbs, a loose crown of gold going orange. */
  function paintBirch(g: G, x: number, base: number, th: number, dir: number, rx: number, ry: number) {
    const lean = dir * th * 0.08
    for (let i = 0; i <= th; i++) {
      const f = i / th
      const tx = Math.round(x + lean * f * f)
      const wd = f < 0.4 ? 4 : f < 0.75 ? 3 : 2
      rect(g, INK, tx - 1, base - i, wd + 2, 1)
      rect(g, '#d8d0f0', tx, base - i, wd, 1)
      rect(g, '#a89cc8', tx + wd - 1, base - i, 1, 1)
      if (hash2(i, 1, 81) > 0.8) rect(g, '#2a1f3a', tx + Math.floor(hash2(i, 2, 81) * wd), base - i, 2, 1)
    }
    const cx = Math.round(x + lean)
    const cy = Math.round(base - th + ry * 0.9)
    crown = { x: cx, y: cy, rx, ry }
    const limbs: { x: number; y: number }[] = []
    for (let k = 0; k < 7; k++) {
      const side = k % 2 ? 1 : -1
      const sy = cy + ry * (0.7 - k * 0.2)
      const ex = cx + side * rx * (0.5 + hash2(k, 3, 81) * 0.45)
      const ey = sy - ry * (0.2 + hash2(k, 4, 81) * 0.3)
      const f = Math.min(1, (base - sy) / th)
      line(g, '#3a2a4a', x + 1 + lean * f * f, sy, ex, ey)
      limbs.push({ x: ex, y: ey })
    }
    // Clumps of leaves, thinned by noise so the crown has holes and the limbs show.
    const n = Math.round((rx * ry) / 6)
    for (let k = 0; k < n; k++) {
      const px = cx + (hash2(k, 4, 83) - 0.5) * 2 * rx
      const py = cy + (hash2(k, 5, 83) - 0.5) * 2 * ry
      const dx = (px - cx) / rx
      const dy = (py - cy) / ry
      if (dx * dx + dy * dy > 1 || noise1(px + py * 3.1, 9, 85) < 0.3) continue
      const r = 2 + Math.round(hash2(k, 6, 83) * 1.6)
      disc(g, '#7a3418', px + 1, py + 1, r)
      disc(g, dy < -0.2 ? '#f0a030' : dy < 0.4 ? '#d87a24' : '#b4521c', px, py, r - 1)
      if (hash2(k, 10, 83) > 0.4) rect(g, dy < 0 ? '#ffd23f' : '#ffb13f', Math.round(px - r * 0.5), Math.round(py - r + 1), Math.max(1, r - 1), 1)
    }
    // Hanging twigs with a few leaves off the limb ends, and loose leaf pixels.
    for (const l of limbs) {
      const len = 4 + Math.round(hash2(Math.round(l.x), 11, 83) * ry * 0.3)
      for (let j = 0; j < len; j++) if (j % 2 === 0) rect(g, j % 4 ? '#ffb13f' : '#ffd23f', Math.round(l.x + Math.sin(j * 0.4) * 1), Math.round(l.y + j), 1, 1)
    }
    for (let k = 0; k < n * 2; k++) {
      const px = cx + (hash2(k, 7, 83) - 0.5) * 2.3 * rx
      const py = cy + (hash2(k, 8, 83) - 0.5) * 2.3 * ry
      rect(g, LEAVES[Math.floor(hash2(k, 9, 83) * LEAVES.length)]!, Math.round(px), Math.round(py), 1, 1)
    }
  }

  function layout(w: number, h: number) {
    W = w; H = h
    portrait = h > w * 1.1
    hz = Math.round(h * (portrait ? 0.44 : 0.5))
    quay = Math.round(h * (portrait ? 0.79 : 0.8))
    const water = quay - hz
    boatY = Math.round(hz + water * (portrait ? 0.5 : 0.58))
    const mH = h * (portrait ? 0.2 : 0.24)
    const r = Math.max(9, Math.min(20, Math.round(Math.min(w, h) * 0.085)))
    sun = { x: Math.round(w * (portrait ? 0.48 : 0.63)), y: 0, r }
    const farTop: number[] = []
    const nearTop: number[] = []
    const hc = w * (portrait ? 0.2 : 0.32)
    const hw = w * (portrait ? 0.34 : 0.3)
    for (let x = 0; x < w; x++) {
      const dip = 1 - 0.5 * Math.exp(-(((x - sun.x) / (w * 0.13)) ** 2))
      const n = noise1(x, 46, 3) * 0.65 + noise1(x, 15, 8) * 0.25 + noise1(x, 5, 2) * 0.1
      farTop.push(Math.round(hz - 2 - mH * (0.3 + 0.7 * n) * dip))
      let e = clamp(1 - Math.abs(x - hc) / hw, 0, 1)
      e = e * e * (3 - 2 * e)
      nearTop.push(Math.round(hz - 1 - (mH * 0.5 * e + 2) * (0.8 + 0.3 * noise1(x, 20, 12))))
    }
    sun.y = farTop[sun.x]! + Math.round(r * 0.2)
    copy = layer(w, h, () => {})
    sky = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, hz + 1, SKY)
      for (let i = 0; i < w * 0.12; i++) {
        const x = Math.floor(hash2(i, 1, 91) * w)
        const y = Math.floor(Math.pow(hash2(i, 2, 91), 1.8) * hz * 0.35)
        rect(g, hash2(i, 3, 91) > 0.85 ? '#cfc6ff' : '#5a4f90', x, y)
      }
      const mr = Math.max(5, Math.round(Math.min(w, h) * 0.035))
      const mx = Math.round(w * (portrait ? 0.2 : 0.36))
      const my = Math.round(h * (portrait ? 0.08 : 0.1))
      for (let y = -mr; y <= mr; y++) for (let x = -mr; x <= mr; x++) {
        if (x * x + y * y > mr * mr + mr * 0.8) continue
        const ox = x + mr * 0.55
        if (ox * ox + (y + 1) * (y + 1) < mr * mr * 0.85) continue
        rect(g, x < -mr * 0.6 ? '#e6e0ff' : '#b9b0e6', mx + x, my + y)
      }
    })
    sunC = layer(w, h, g => {
      paintSun(g, sun.x, sun.y, sun.r, '#c07078')
      for (let x = 0; x < w; x++) g.clearRect(x, farTop[x]!, 1, h)
    })
    land = layer(w, h, g => {
      // The far mountains, first snow on the tops, lit from behind.
      for (let x = 0; x < w; x++) {
        const t = farTop[x]!
        rect(g, '#3e3266', x, t, 1, hz - t)
        if (hash2(x, 1, 5) > 0.8) rect(g, '#352a5c', x, t + 3, 1, Math.round((hz - t) * 0.5))
        const high = (hz - 2 - t) / mH
        if (high > 0.68) rect(g, '#b8b0e0', x, t, 1, 1 + Math.round((high - 0.68) * 14))
        rect(g, high > 0.68 ? '#fff4ff' : '#d0909a', x, t, 1, 1)
        if (x > 0 && Math.abs(t - farTop[x - 1]!) > 1) rect(g, '#d0909a', x, Math.min(t, farTop[x - 1]!), 1, Math.abs(t - farTop[x - 1]!))
      }
      ditherRect(g, '#9a7aa0', 0.22, 0, hz - 7, w, 7)
      // The near hill with its autumn woods.
      for (let x = 0; x < w; x++) {
        const t = nearTop[x]!
        rect(g, '#2a2150', x, t, 1, hz - t)
        rect(g, '#7a5a90', x, t, 1, 1)
      }
      for (let y = 0; y < hz; y += 2) for (let x = 0; x < w; x += 3) {
        if (y < nearTop[x]! + 2 || hash2(x, y, 7) < 0.72) continue
        rect(g, ['#3a2448', '#5a2a40', '#6a3a3a'][Math.floor(hash2(x, y, 8) * 3)]!, x, y, 2, 1)
      }
      // The village climbing the hill, top rows first.
      town = []
      const tx0 = Math.round(w * (portrait ? 0.04 : 0.15))
      const tx1 = Math.round(w * (portrait ? 0.44 : 0.5))
      townTop = hz
      const walls = ['#a08aa8', '#8a7098', '#c09aa0', '#7a6a98', '#d8c8d8']
      for (let row = 7; row >= 0; row--) {
        const base = hz - 2 - row * 5
        for (let x = tx0 + (row % 2) * 3; x < tx1; x += 7) {
          const xx = x + Math.floor(hash2(x, row, 71) * 2)
          let fits = true
          for (let k = -1; k <= 6; k++) if (nearTop[clamp(xx + k, 0, w - 1)]! > base - 8) fits = false
          if (!fits || hash2(xx, row, 72) < 0.3) continue
          rect(g, '#1c1438', xx - 1, base, 7, 1)
          rect(g, walls[Math.floor(hash2(xx, row, 73) * walls.length)]!, xx, base - 3, 5, 3)
          rect(g, '#5a2a44', xx - 1, base - 4, 7, 1)
          rect(g, '#7a3a58', xx, base - 5, 5, 1)
          rect(g, '#a05070', xx + 1, base - 6, 3, 1)
          rect(g, '#2a1f4a', xx + 4, base - 3, 1, 3)
          const wx = xx + 1 + Math.floor(hash2(xx, row, 74) * 3)
          const lit = hash2(xx, row, 75) > 0.55
          rect(g, lit ? '#ffd23f' : '#3a2c5a', wx, base - 2, 1, 1)
          town.push({ x: wx, y: base - 2, f: 0 })
          townTop = Math.min(townTop, base - 2)
        }
      }
      // The white church on the highest ground the hill has room for.
      const cx = Math.round(tx0 + (tx1 - tx0) * 0.5)
      let cb = hz - 3
      for (let b = hz - 3; b > hz - mH; b--) {
        let ok = true
        for (let k = -2; k <= 12; k++) if (nearTop[clamp(cx + k, 0, w - 1)]! > b - 10) ok = false
        if (ok) cb = b; else break
      }
      rect(g, INK, cx - 1, cb - 6, 12, 7)
      rect(g, '#e8e0ff', cx, cb - 5, 10, 5)
      rect(g, '#8f86b8', cx, cb - 1, 10, 1)
      rect(g, '#8a3a60', cx - 1, cb - 7, 12, 1)
      rect(g, '#b05a7a', cx, cb - 8, 10, 1)
      rect(g, '#d07a90', cx + 1, cb - 9, 8, 1)
      rect(g, INK, cx - 1, cb - 14, 6, 9)
      rect(g, '#fff4ff', cx, cb - 13, 4, 8)
      rect(g, '#b9b0e6', cx + 3, cb - 13, 1, 8)
      for (let k = 0; k < 7; k++) rect(g, k < 2 ? '#d07a90' : '#b05a7a', cx + 2 - Math.floor(k / 3), cb - 21 + k, 1 + 2 * Math.floor(k / 3), 1)
      rect(g, '#ffd23f', cx + 2, cb - 22, 1, 1)
      church = { x: cx + 1, y: cb - 11, f: 0 }
      rect(g, '#3a2c5a', church.x, church.y, 2, 2)
      for (let k = 0; k < 3; k++) rect(g, '#3a2c5a', cx + 5 + k * 2, cb - 4, 1, 2)
    })
    // The breakwater and its harbour light: right in landscape, left in portrait.
    const mw = hz + Math.max(4, Math.round(water * 0.14))
    const m0 = portrait ? 0 : Math.round(w * 0.7)
    const m1 = portrait ? Math.round(w * 0.36) : w
    const tip = portrait ? m1 - 4 : m0 + 4
    mole = layer(w, h, g => {
      rect(g, INK, m0 - 1, mw - 4, m1 - m0 + 2, 5)
      for (let x = m0; x < m1; x++) {
        const end = portrait ? m1 - 1 - x : x - m0
        const t = mw - (end < 2 ? 2 : 3)
        rect(g, '#2e2452', x, t, 1, mw - t)
        rect(g, '#b08aa0', x, t, 1, 1)
        if ((x - m0) % 6 === 0) rect(g, INK, x, t + 1, 1, mw - t - 1)
      }
      const th = Math.max(14, Math.round(h * (portrait ? 0.06 : 0.1)))
      const tt = mw - 3 - th
      rect(g, INK, tip - 3, tt - 1, 7, th + 1)
      for (let y = tt; y < mw - 3; y++) {
        const k = y - tt
        const red = Math.floor(k / 4) % 2 === 1
        rect(g, red ? '#b01840' : '#e8e0ff', tip - 2, y, 5, 1)
        rect(g, red ? '#7a1030' : '#b9b0e6', tip + 2, y, 1, 1)
      }
      rect(g, INK, tip - 4, tt - 1, 9, 1)
      rect(g, INK, tip - 2, tt - 5, 5, 4)
      rect(g, '#9e1638', tip - 2, tt - 7, 5, 2)
      rect(g, '#9e1638', tip - 1, tt - 8, 3, 1)
      harbourLight = { x: tip - 1, y: tt - 4, base: mw }
    })
    // The boat.
    const BL = Math.round(clamp(w * (portrait ? 0.44 : 0.26), 40, 90))
    const hh = Math.max(7, Math.round(BL * 0.15))
    const mastH = Math.round(BL * 0.52)
    const ch = hh + mastH + 8
    boat.cw = BL + 10
    boatC = layer(boat.cw, ch, g => paintBoat(g, BL, hh, mastH, ch))
    boat.x = Math.round(w * (portrait ? 0.54 : 0.52) - boat.cw / 2)
    posts = [
      { x: Math.round(w * (portrait ? 0.14 : 0.3)), base: Math.round(hz + water * 0.3), h: 11 },
      { x: Math.round(w * (portrait ? 0.14 : 0.3)) + 4, base: Math.round(hz + water * 0.3) + 1, h: 8 },
      { x: Math.round(w * (portrait ? 0.9 : 0.88)), base: Math.round(hz + water * 0.8), h: 14 },
    ]
    // The quay, the boathouse, the birch and the things on the quay.
    const nw = Math.round(clamp(w * (portrait ? 0.34 : 0.19), 34, 66))
    const nx = Math.round(w * (portrait ? 0.04 : 0.12))
    bollards = [
      { x: Math.max(nx + nw + 5, Math.round(boat.x - w * 0.05)), y: quay + 1 },
      { x: Math.round(boat.x + boat.cw + w * 0.04), y: quay + 1 },
    ]
    walkY = quay + Math.max(10, Math.round((h - quay) * 0.32))
    front = layer(w, h, g => {
      rect(g, INK, 0, quay - 1, w, 1)
      ditherGradient(g, 0, quay, w, h, ['#6a5a80', '#56486e', '#463a62', '#3a3058'])
      let rowH = 3
      let k = 0
      for (let y = quay + 3; y < h; y += rowH, rowH = Math.min(9, rowH + 1), k++) {
        rect(g, '#2a2248', 0, y, w, 1)
        const sw = rowH * 4
        for (let x = (k % 2) * Math.round(sw / 2); x < w; x += sw) {
          rect(g, '#2a2248', x, y + 1, 1, rowH - 1)
          if (hash2(x, y, 61) > 0.6) rect(g, '#5e5078', x + 2, y + 2, Math.round(sw * 0.4), 1)
          if (hash2(x, y, 62) > 0.85) ditherRect(g, '#2f7a5a', 0.4, x + 1, y + 1, Math.round(sw * 0.5), rowH - 1)
        }
      }
      for (let i = 0; i < (portrait ? 4 : 3); i++) {
        const pw = 10 + Math.round(hash2(i, 1, 63) * 14)
        const px = Math.round(hash2(i, 2, 63) * (w - pw))
        const py = quay + 6 + Math.round(hash2(i, 3, 63) * (h - quay - 10))
        rect(g, '#2a2450', px + 2, py, pw - 4, 1)
        rect(g, '#2a2450', px, py + 1, pw, 2)
        rect(g, '#6a5a8a', px + 3, py + 1, Math.round(pw * 0.4), 1)
        rect(g, '#c08aa0', px + 4, py + 2, Math.round(pw * 0.2), 1)
      }
      rect(g, '#d8b0b0', 0, quay, w, 1)
      rect(g, '#8a7a98', 0, quay + 1, w, 1)
      rect(g, '#342a52', 0, quay + 2, w, 1)
      for (const b of bollards) {
        rect(g, INK, b.x - 1, b.y - 5, 7, 7)
        rect(g, '#3a3058', b.x, b.y - 3, 5, 4)
        rect(g, '#5a5285', b.x - 0, b.y - 5, 5, 2)
        rect(g, '#8f86b8', b.x, b.y - 5, 2, 1)
      }
      paintNaust(g, nx, quay + 3, nw)
      // Fish crates and a lobster pot.
      const cx = Math.round(w * (portrait ? 0.74 : 0.68))
      const cb = quay + Math.max(8, Math.round((h - quay) * 0.35))
      const crates: [number, number, string, string][] = [[0, 0, '#2f5fd0', '#7ce4ff'], [9, 0, '#ff8a3d', '#ffd23f'], [4, -5, '#2f5fd0', '#7ce4ff']]
      for (const [ox, oy, body, topc] of crates) {
        rect(g, INK, cx + ox - 1, cb + oy - 5, 10, 6)
        rect(g, body, cx + ox, cb + oy - 4, 8, 4)
        rect(g, topc, cx + ox, cb + oy - 4, 8, 1)
        rect(g, mix(body, INK, 0.4), cx + ox + 2, cb + oy - 2, 4, 1)
      }
      const px = cx + 22
      rect(g, INK, px - 1, cb - 7, 11, 8)
      rect(g, '#5b2a1c', px, cb - 6, 9, 6)
      for (let i = 0; i < 9; i += 2) rect(g, '#c4861c', px + i, cb - 6, 1, 6)
      rect(g, '#e07a4e', px, cb - 6, 9, 1)
      disc(g, INK, px - 8, cb - 2, 3)
      disc(g, '#b0843a', px - 8, cb - 2, 2)
      rect(g, '#5b2a1c', px - 8, cb - 2, 1, 1)
      // The old lamp.
      const lx = Math.round(w * (portrait ? 0.6 : 0.8))
      const lb = quay + Math.max(12, Math.round((h - quay) * 0.55))
      const lh = Math.round(h * (portrait ? 0.13 : 0.2))
      rect(g, INK, lx - 2, lb - 3, 5, 3)
      rect(g, INK, lx - 1, lb - lh, 3, lh)
      rect(g, '#4a3d70', lx, lb - lh + 2, 1, lh - 4)
      rect(g, INK, lx - 3, lb - lh - 6, 7, 6)
      rect(g, INK, lx - 2, lb - lh - 8, 5, 2)
      rect(g, '#3a3058', lx - 1, lb - lh - 9, 3, 1)
      lamp = { x: lx, y: lb - lh - 4 }
      // A bench with someone on it, cup in hand.
      const bx = Math.round(w * (portrait ? 0.3 : 0.5))
      const bb = quay + Math.max(16, Math.round((h - quay) * 0.72))
      bench = { x: bx, y: bb }
      rect(g, INK, bx - 1, bb - 6, 18, 2)
      rect(g, '#9a5a3a', bx, bb - 6, 16, 1)
      rect(g, INK, bx - 1, bb - 11, 18, 3)
      rect(g, '#9a5a3a', bx, bb - 10, 16, 1)
      for (const ox of [1, 14]) rect(g, INK, bx + ox, bb - 5, 1, 5)
      rect(g, INK, bx + 1, bb - 11, 1, 6)
      rect(g, INK, bx + 14, bb - 11, 1, 6)
      const sx = bx + 10
      rect(g, INK, sx - 1, bb - 16, 6, 11)
      rect(g, '#2a2248', sx, bb - 15, 4, 9)
      rect(g, '#3a3068', sx + 3, bb - 15, 1, 9)
      rect(g, '#e8946a', sx, bb - 15, 4, 2)
      rect(g, '#f5c3a8', sx + 1, bb - 17, 2, 2)
      rect(g, '#6a2a3a', sx, bb - 19, 4, 2)
      rect(g, '#2a2248', sx - 3, bb - 6, 4, 2)
      rect(g, INK, sx - 3, bb - 4, 1, 4)
      rect(g, '#fff4ff', sx - 2, bb - 11, 2, 2)
      cup = { x: sx - 1, y: bb - 12 }
      // The birch.
      const tx = Math.round(w * (portrait ? 0.9 : 0.04))
      const th = Math.round(h * (portrait ? 0.8 : 0.84))
      paintBirch(g, tx, h + 2, th, portrait ? -1 : 1, Math.round(w * (portrait ? 0.22 : 0.13)), Math.round(h * (portrait ? 0.12 : 0.26)))
    })
    // Cloud bands: long low stratus, lit peach from below near the sun.
    bands = []
    const nb = portrait ? 8 : 5
    for (let i = 0; i < nb; i++) {
      const f = (i + 0.5) / nb
      const y = Math.round(hz * (0.1 + f * 0.62))
      bands.push({
        y,
        len: Math.round(w * (0.18 + hash2(i, 1, 93) * 0.3)),
        sp: 0.8 + hash2(i, 2, 93) * 1.6,
        off: hash2(i, 3, 93) * w,
        th: 2 + Math.floor(hash2(i, 4, 93) * 2),
        lit: f > 0.55 ? '#f4b890' : f > 0.3 ? '#d08a90' : '#8a5a88',
        body: f > 0.55 ? '#7a4a78' : '#4a3468',
      })
    }
    leaves.length = 0
    puffs.length = 0
    sparks.length = 0
  }

  function drawClouds(g: G, c: FrameCtx) {
    const wind = 1 + c.energy * 1.5
    for (const b of bands) {
      const x = Math.round(wrap(b.off + c.t * b.sp * wind, W + b.len) - b.len)
      rect(g, b.body, x + 4, b.y, b.len - 8, 1)
      rect(g, b.body, x, b.y + 1, b.len, b.th - 1)
      rect(g, b.lit, x + 2, b.y + b.th, b.len - 5, 1)
      rect(g, b.body, x + Math.round(b.len * 0.55), b.y - 1, Math.round(b.len * 0.3), 1)
      rect(g, b.lit, x + Math.round(b.len * 0.2), b.y + b.th + 1, Math.round(b.len * 0.3), 1)
    }
  }

  function drawGulls(g: G, c: FrameCtx) {
    const n = Math.min(7, 2 + Math.round((c.levels.ambience ?? 0) * 2 + c.energy * 3))
    for (let i = 0; i < n; i++) {
      const cx = wrap(hash2(i, 1, 97) * W + c.t * (1 + hash2(i, 5, 97) * 2), W + 60) - 30
      const cy = hz * (0.18 + hash2(i, 2, 97) * 0.45)
      const rx = 8 + hash2(i, 3, 97) * 18
      const a = c.t * (0.3 + hash2(i, 4, 97) * 0.25) * (i % 2 ? 1 : -1) + i * 2
      const x = Math.round(cx + Math.cos(a) * rx)
      const y = Math.round(cy + Math.sin(a) * rx * 0.3)
      const flap = Math.sin(c.t * 7 + i * 3) > 0.4
      g.fillStyle = '#4a3a68'
      if (flap) { g.fillRect(x - 2, y - 1, 2, 1); g.fillRect(x + 1, y - 1, 2, 1) } else { g.fillRect(x - 3, y, 3, 1); g.fillRect(x + 1, y, 3, 1) }
      g.fillStyle = '#e8e0ff'
      g.fillRect(x, y, 1, 1)
    }
  }

  function drawWater(g: G, c: FrameCtx, L: Lights) {
    const water = quay - hz
    copy!.getContext('2d')!.drawImage(g.canvas, 0, 0, W, hz, 0, 0, W, hz)
    mirror(g, copy!, hz, hz, quay, W, c.t, 0.7 + c.energy * 1.1, '#1a1a4a', 0.42, 1.25)
    // The bright seam where the dawn meets the water.
    ditherRect(g, '#f4b890', 0.5, 0, hz, W, 1)
    // Crests: short dashes drifting, longer and sparser toward us; wind brings more.
    const speed = 1 + c.energy * 0.8
    for (let y = hz + 2; y < quay - 1; y++) {
      const d = (y - hz) / water
      const gap = Math.round(12 + d * 26)
      const len = 1 + Math.round(d * 4)
      const col = d < 0.3 ? '#d8a0a0' : d < 0.65 ? '#6a6aa8' : '#4a5a98'
      for (let i = -1; i < W / gap + 1; i++) {
        const n = hash2(i, y, 17)
        if (n < 0.62 - c.energy * 0.15) continue
        const x = Math.round(wrap(i * gap + n * gap + c.t * (1.5 + d * 5) * speed * (y % 2 ? 1 : -0.6), W + gap) - gap)
        if (Math.sin(c.t * 0.8 * speed + n * 6 + y * 0.25) < -0.1) continue
        rect(g, col, x, y, len, 1)
      }
    }
    // The sun's road: peach dashes that shimmer, widening toward us.
    for (let y = hz + 1; y < quay - 1; y++) {
      const d = (y - hz) / water
      const half = sun.r * (0.6 + d * 1.1)
      const col = d < 0.25 ? '#fff1b0' : d < 0.6 ? '#f4b07a' : '#e8946a'
      const seg = 3 + Math.round(d * 5)
      for (let x = -half; x < half; x += seg + 2) {
        const n = hash2(Math.round(x + 1000), y, 3)
        const s = Math.sin(c.t * 1.4 * speed + n * 9 + y * 0.7)
        if (s < 0.2 + d * 0.35) continue
        const lx = Math.round(sun.x + x + Math.sin(c.t * 0.7 + y) * 1.5)
        const lw = Math.max(1, Math.round(seg * (0.4 + 0.6 * s) * (1 - Math.abs(x) / half)))
        rect(g, col, lx, y, lw, 1)
        L.emit(lx, y, lw, 1)
      }
    }
  }

  function drawMist(g: G, c: FrameCtx, y0: number, y1: number, salt: number) {
    const peak = (0.1 + (c.levels.pad ?? 0) * 0.12 + c.dark * 0.06) * 64
    for (let i = 0; i < 2; i++) {
      const len = Math.round(W * (0.35 + hash2(i, 1, salt) * 0.35))
      const th = 5 + Math.floor(hash2(i, 4, salt) * 4)
      const y = Math.round(y0 + hash2(i, 2, salt) * Math.max(0, y1 - y0 - th))
      const x = Math.round(wrap(hash2(i, 3, salt) * W + c.t * (1.2 + i * 0.5) * (1 + c.energy), W + len) - len)
      for (let r = 0; r < th; r++) {
        const k = Math.sin((Math.PI * (r + 0.5)) / th)
        const pat = ditherPattern('#d8c0d8', Math.round(peak * k))
        if (!pat) continue
        // Each row a little shorter toward the band's edges, so it reads as a soft bank.
        const inset = Math.round((1 - k) * len * 0.2)
        g.fillStyle = pat
        g.fillRect(x + inset, y + r, len - inset * 2, 1)
      }
    }
  }

  function drawPost(g: G, c: FrameCtx, p: Post, gull: boolean) {
    for (let d = 1; d < p.h; d++) {
      if ((d + Math.floor(c.t * 3)) % 3 === 0) continue
      rect(g, '#1a1030', p.x + Math.round(Math.sin(c.t * 1.5 + d) * 0.8), p.base + d, 2, 1)
    }
    rect(g, INK, p.x - 1, p.base - p.h - 1, 4, p.h + 1)
    rect(g, '#6a4432', p.x, p.base - p.h, 2, p.h)
    rect(g, '#9a6a4a', p.x, p.base - p.h, 1, p.h)
    rect(g, '#cfc6ff', p.x, p.base - p.h, 2, 1)
    rect(g, '#3a2a4a', p.x, p.base - 3, 2, 1)
    if (!gull) return
    // A gull on the post, turning its head now and then.
    const x = p.x
    const y = p.base - p.h - 1
    const look = wrap(c.t, 7) < 3.5 ? 1 : -1
    rect(g, INK, x - 2, y - 4, 7, 5)
    rect(g, '#e8e0ff', x - 1, y - 3, 5, 2)
    rect(g, '#8f86b8', x - 1, y - 3, 3, 1)
    rect(g, '#fff4ff', x + (look > 0 ? 3 : -1), y - 4, 1, 1)
    rect(g, '#ffd23f', x + (look > 0 ? 4 : -2), y - 4, 1, 1)
    rect(g, '#ffd23f', x, y - 1, 1, 1)
    rect(g, '#ffd23f', x + 2, y - 1, 1, 1)
  }

  function drawBoat(g: G, c: FrameCtx, L: Lights) {
    if (!boatC) return
    const amp = 0.5 + (c.levels.bass ?? 0) * 0.9 + c.energy * 0.6
    const bob = Math.round(Math.sin(c.t * 0.9) * amp + Math.sin(c.t * 0.37 + 1) * 0.4)
    const bx = boat.x
    const by = boatY - boat.wl + bob
    // Reflection: the boat's rows mirrored about the waterline, rippled and broken.
    const rows = Math.min(boat.wl, quay - boatY - 2)
    g.globalAlpha = 0.32
    for (let d = 0; d < rows; d++) {
      if ((d + Math.floor(c.t * 2.5)) % 6 === 0) continue
      const off = Math.round(Math.sin(c.t * 1.6 + d * 0.55) * (0.4 + d * 0.05) * (1 + c.energy))
      g.drawImage(boatC, 0, boat.wl - d, boat.cw, 1, bx + off, boatY + 1 + d, boat.cw, 1)
    }
    g.globalAlpha = 1
    g.drawImage(boatC, bx, by)
    // Water lapping along the hull.
    for (let x = bx + 3; x < bx + boat.cw - 6; x += 3) if (Math.sin(c.t * 2 + x * 0.7) > 0) rect(g, '#8a7aa8', x, boatY + 1, 2, 1)
    for (const wv of boat.wins) {
      L.emit(bx + wv.x, by + wv.y, wv.w, wv.h)
      L.light(bx + wv.x + 1.5, by + wv.y + 1.5, 9, '#ffb13f', 0.3)
    }
    L.light(bx + boat.wins[0]!.x + 3, boatY + 4, 10, '#ffb13f', 0.12)
    // The mast lantern breathes with the kick; the pennant takes the chord colour.
    const lx = bx + boat.lantern.x
    const ly = by + boat.lantern.y
    rect(g, mix('#fff1b0', '#ffffff', c.beat * 0.5), lx, ly, 1, 1)
    L.emit(lx, ly, 1, 1)
    L.light(lx + 0.5, ly + 0.5, 8 + 4 * c.beat, '#fff1b0', 0.3 + 0.25 * c.beat)
    L.light(lx + 0.5, boatY + (boatY - ly) * 0.6, 6, '#fff1b0', 0.12 + 0.1 * c.beat)
    const pcol = mix(c.accent, '#ffffff', 0.1)
    const mx = bx + boat.mast.x
    const my = by + boat.mast.y
    const flutter = 0.5 + c.energy
    for (let k = 1; k <= 6; k++) rect(g, pcol, mx + k, my + 1 + Math.round(Math.sin(c.t * 6 + k * 0.9) * 0.5 * flutter), 1, k < 3 ? 2 : 1)
    L.light(mx + 3, my + 2, 5, c.accent, 0.15)
    // Exhaust: a puff on the kick when the drums are in, a wisp now and then.
    const onset = c.beat > 0.9 && lastBeat <= 0.9
    lastBeat = c.beat
    if (puffs.length < 20 && ((onset && (c.levels.drums ?? 0) > 0.15) || Math.random() < c.dt * 0.3)) puffs.push({ x: bx + boat.stack.x, y: by + boat.stack.y, age: 0, life: 1.8 + Math.random() })
    const wind = 3 + c.energy * 8
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i]!
      p.age += c.dt
      if (p.age > p.life) { puffs.splice(i, 1); continue }
      const k = p.age / p.life
      g.globalAlpha = 0.55 * (1 - k)
      rect(g, '#9a90b8', Math.round(p.x + k * wind * 1.2 + Math.sin(p.age * 3) * 0.8), Math.round(p.y - k * 9), 1 + Math.round(k * 3), 1 + Math.round(k * 1.5))
    }
    g.globalAlpha = 1
  }

  function drawRopes(g: G) {
    const by = boatY - boat.wl + 0
    const ends: [number, number, number, number][] = [
      [boat.x + boat.stern.x, by + boat.stern.y, bollards[0]!.x + 2, bollards[0]!.y - 4],
      [boat.x + boat.bow.x, by + boat.bow.y, bollards[1]!.x + 2, bollards[1]!.y - 4],
    ]
    for (const [x0, y0, x1, y1] of ends) {
      const mx = (x0 + x1) / 2
      const my = Math.max(y0, y1) - (y1 - y0) * 0.35 + 3
      line(g, '#8a6a58', x0, y0, mx, my)
      line(g, '#8a6a58', mx, my, x1, y1)
    }
  }

  function drawWalker(g: G, c: FrameCtx, L: Lights) {
    const period = 44
    const ph = wrap(c.t + 20, period) / period
    if (ph > 0.6) return
    const x = Math.round(W + 20 - (ph / 0.6) * (W + 50))
    const y = walkY
    const step = Math.floor(c.t * 4) % 2
    rect(g, INK, x - 1, y - 14, 6, 10)
    rect(g, '#3a2a58', x, y - 13, 4, 9)
    rect(g, '#b01874', x, y - 13, 4, 1)
    disc(g, '#f5c3a8', x + 2, y - 15, 1)
    rect(g, '#2a1f3a', x + 1, y - 17, 3, 1)
    rect(g, '#2a1f3a', x + step, y - 4, 1, 4)
    rect(g, '#2a1f3a', x + 3 - step, y - 4, 1, 4)
    // The dog trots ahead.
    const dx = x - 9
    rect(g, INK, dx - 1, y - 5, 8, 4)
    rect(g, '#9a6a4a', dx, y - 4, 6, 2)
    rect(g, '#9a6a4a', dx - 1, y - 6, 2, 2)
    rect(g, '#6a4432', dx + 5, y - 5, 2, 1)
    rect(g, '#6a4432', dx + (step ? 0 : 1), y - 2, 1, 2)
    rect(g, '#6a4432', dx + (step ? 5 : 4), y - 2, 1, 2)
    line(g, '#8f86b8', dx + 1, y - 4, x, y - 9)
    L.light(x + 2, y - 8, 8, '#e8946a', 0.12)
  }

  function drawLeaves(g: G, c: FrameCtx) {
    const wind = 3 + c.energy * 12
    if (leaves.length < 60 && Math.random() < c.dt * (0.8 + c.energy * 3)) {
      const x = crown.x + (Math.random() - 0.5) * 1.8 * crown.rx
      const y = crown.y + (Math.random() - 0.3) * crown.ry
      const land = Math.max(y + 12, hz + 3) + Math.random() * (H - Math.max(y + 12, hz + 3))
      leaves.push({ x, y, vy: 5 + Math.random() * 6, ph: Math.random() * 6.28, c: LEAVES[Math.floor(Math.random() * LEAVES.length)]!, land, age: 0 })
    }
    for (let i = leaves.length - 1; i >= 0; i--) {
      const l = leaves[i]!
      if (l.y < l.land) {
        l.x += wind * (0.6 + 0.4 * Math.sin(c.t * 0.7 + l.ph)) * c.dt
        l.y += l.vy * (0.6 + 0.4 * Math.sin(c.t * 2.3 + l.ph)) * c.dt
        const fx = Math.round(l.x + Math.sin(c.t * 4 + l.ph) * 1.2)
        const fy = Math.round(l.y)
        const tilt = Math.floor(c.t * 5 + l.ph) % 2
        rect(g, l.c, fx, fy, tilt ? 2 : 1, tilt ? 1 : 2)
      } else {
        l.age += c.dt
        const onWater = l.land < quay
        if (onWater) l.x += 1.5 * c.dt
        if (l.age > 6 || l.x > W + 2) { leaves.splice(i, 1); continue }
        g.globalAlpha = l.age > 4 ? (6 - l.age) / 2 : 1
        rect(g, onWater ? mix(l.c, '#1a1a4a', 0.35) : l.c, Math.round(l.x), Math.round(l.land), 2, 1)
        g.globalAlpha = 1
      }
    }
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!sky || !sunC || !land || !mole || !front || !boatC) return
    g.drawImage(sky, 0, 0)
    // Darker modes draw a grey overcast over the dawn.
    ditherRect(g, '#3a3060', clamp((c.dark - 0.35) * 0.7, 0, 0.35), 0, 0, W, hz)
    g.drawImage(sunC, 0, 0)
    L.emitImage(sunC)
    drawClouds(g, c)
    drawGulls(g, c)
    g.drawImage(land, 0, 0)
    // Village windows: lead and counter notes light them at their pitch's height up the hill.
    for (const n of c.notes) {
      if (n.layer === 'lead' || n.layer === 'counter') {
        const want = townTop + (1 - n.h) * (hz - 2 - townTop)
        let best: Win | null = null
        let bd = Infinity
        for (const wv of town) {
          const d = Math.abs(wv.y - want) + Math.random() * 6
          if (d < bd) { bd = d; best = wv }
        }
        if (best) best.f = 1
      } else if (n.layer === 'bells') church.f = 1
    }
    for (const wv of town) {
      if (wv.f <= 0) continue
      wv.f = Math.max(0, wv.f - c.dt / 2)
      g.globalAlpha = Math.min(1, wv.f * 1.5)
      rect(g, '#fff1b0', wv.x, wv.y, 1, 1)
      g.globalAlpha = 1
      L.emit(wv.x, wv.y, 1, 1)
      L.light(wv.x + 0.5, wv.y + 0.5, 6, '#ffb13f', 0.5 * wv.f)
    }
    if (church.f > 0) {
      church.f = Math.max(0, church.f - c.dt / 2.5)
      g.globalAlpha = Math.min(1, church.f * 1.5)
      rect(g, '#ffd23f', church.x, church.y, 2, 2)
      g.globalAlpha = 1
      L.emit(church.x, church.y, 2, 2)
      L.light(church.x + 1, church.y + 1, 10, '#ffd23f', 0.5 * church.f)
    }
    drawMist(g, c, hz - 9, hz - 3, 101)
    // Sky lights, then mirror them into the harbour before the near lights go in.
    L.light(sun.x, sun.y, sun.r * 3, '#ff8a3d', 0.32)
    L.light(sun.x, hz, W * 0.35, '#e8946a', 0.2)
    mirrorLights(L, hz, hz, 1.25, 0.35, quay)
    drawWater(g, c, L)
    // The harbour light blinks every four seconds in the chord's colour.
    g.drawImage(mole, 0, 0)
    const on = wrap(c.t, 4) < 1.1
    const hcol = mix('#ff3b5c', c.accent, 0.45)
    rect(g, on ? hcol : '#4a1020', harbourLight.x, harbourLight.y, 3, 2)
    if (on) {
      L.emit(harbourLight.x, harbourLight.y, 3, 2)
      L.light(harbourLight.x + 1.5, harbourLight.y + 1, 18, hcol, 0.6)
      for (let y = harbourLight.base + 1; y < Math.min(quay - 2, harbourLight.base + 30); y += 2) {
        if (Math.sin(c.t * 2 + y * 0.8) < -0.2) continue
        const lx = Math.round(harbourLight.x + Math.sin(c.t * 1.3 + y * 0.5) * 1.2)
        rect(g, hcol, lx, y, 2, 1)
        L.emit(lx, y, 2, 1)
      }
    }
    drawPost(g, c, posts[0]!, true)
    drawPost(g, c, posts[1]!, false)
    drawMist(g, c, hz + 2, boatY - 6, 103)
    drawBoat(g, c, L)
    drawPost(g, c, posts[2]!, false)
    drawMist(g, c, boatY + 4, quay - 4, 107)
    ditherRect(g, INK, 0.35, 0, quay - 3, W, 2)
    // Arp notes glint on the water: high notes far out, low notes close in.
    for (const n of c.notes) {
      if (n.layer !== 'arp' || Math.random() > 0.75) continue
      const x = clamp(sun.x + (Math.random() - 0.5) * W * 0.7, 4, W - 4)
      const y = hz + 2 + (1 - n.h) * (quay - hz - 8)
      spawnSpark(sparks, x, y, Math.random() < 0.5 ? '#fff1b0' : '#f4b890', false, 0.9)
    }
    drawSparks(g, sparks, c.dt, L, 0.3)
    g.drawImage(front, 0, 0)
    drawRopes(g)
    // The boathouse glows; the lamp breathes with the kick; steam off the cup.
    const nw = naust.win
    L.emit(nw.x, nw.y, nw.w, nw.h)
    L.light(nw.x + nw.w / 2, nw.y + nw.h / 2, 12, '#ffb13f', 0.4)
    const gp = naust.gap
    L.emit(gp.x, gp.y, gp.w, gp.h)
    L.light(gp.x + 1, gp.y + gp.h - 2, 14, '#ff8a3d', 0.35)
    rect(g, mix('#ffd23f', '#fff1b0', c.beat), lamp.x - 2, lamp.y - 1, 5, 4)
    rect(g, '#fff4ff', lamp.x, lamp.y, 1, 1)
    L.emit(lamp.x - 2, lamp.y - 1, 5, 4)
    L.light(lamp.x, lamp.y + 1, 26 + 4 * c.beat, '#ffd23f', 0.42 + 0.16 * c.beat)
    L.light(lamp.x, quay + 6, 22, '#ff8a3d', 0.22 + 0.08 * c.beat)
    for (let i = 0; i < 4; i++) {
      const ph = wrap(c.t * 0.35 + i / 4, 1)
      g.globalAlpha = 0.45 * (1 - ph)
      rect(g, '#fff4ff', Math.round(cup.x + Math.sin(c.t * 1.5 + i * 2) * 1.2 + ph * 3), Math.round(cup.y - ph * 9), 1, 2)
    }
    g.globalAlpha = 1
    L.light(bench.x + 10, bench.y - 12, 10, '#e8946a', 0.12)
    drawWalker(g, c, L)
    drawLeaves(g, c)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#ac9ed2', '#7e72a6', c.dark * 0.6), '#d4c8ec', c.energy * 0.12),
    horizon: () => hz,
  }
}
