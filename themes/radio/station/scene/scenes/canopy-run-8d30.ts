// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Canopy Run — high in the rainforest in the gold of late afternoon. Two
 * giant trunks hold plank platforms, and a rope bridge hung with bunting
 * sags between them over a valley: a sea of crowns rolls off to a misty
 * ridge and a few emergent trees, and far below a river winds toward us.
 * The sun hangs in a gap of the canopy behind a leafy twig that sways in
 * front of it, so its shafts flicker down through the leaves. Runners
 * sprint the bridge and loop round behind the trunks (on a tall screen they
 * slide down a rope to a second bridge and run back), someone swings on a
 * vine above them, and parrots cross the sky.
 *
 * The music: intensity is how many run and how fast (a walk when it is
 * still, a sprint when it surges) and brings the swinger and more parrots;
 * the kick bounces the bridge and the toucan's head and brightens the
 * shafts; the chord colour runs in the runners' headband ribbons and the
 * lanterns on the bridge posts; lead and counter notes open flowers on the
 * hanging vines (pitch → height), arp and bells glint in the air over the
 * valley; drums and perc flap the bunting, the pad thickens the valley mist.
 */
import { DUSK, disc, ditherGradient, hash2, noise1, paintRidge, paintSun, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { clamp, drawSparks, layer, melodic, rng, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { INK, line, paintPuffs } from '../lib/paint.ts'

const C = {
  d: '#0f3445', m: '#1b5763', l: '#2a8579', h: '#5fd6b8', moss: '#4f9a2a', mossL: '#b6ff4a',
  bark: '#3a2240', barkD: '#241430', barkL: '#5a3458',
  wood: '#8a5a3a', woodL: '#c4864a', woodD: '#4a2a20', rope: '#d8b07a', ropeD: '#7a5a3a',
}
const SHIRTS = ['#ff8a3d', '#ff2fa0', '#2ff3ff', '#ffd23f']
const FLAGS = ['#ff2fa0', '#ffd23f', '#2ff3ff', '#b6ff4a']
const BIRDS: [string, string, string][] = [['#ff3b5c', '#2f5fd0', '#ffd23f'], ['#2f5fd0', '#ffd23f', '#2ff3ff'], ['#b6ff4a', '#ff3b5c', '#ffd23f']]
const TAU = Math.PI * 2

interface Trunk { x: number; w: number }
interface Bridge { xa: number; xb: number; ya: number; yb: number; sag: number; deck: Float32Array }
interface Seg { kind: 0 | 1 | 2; b: number; x0: number; x1: number; y0: number; y1: number; len: number }
interface Runner { d: number; ph: number; k: number; shirt: string; x: number; y: number; dir: number; kind: number; b: number }
interface Vine { x: number; top: number; len: number; ph: number }
interface Bloom { v: number; s: number; age: number; life: number; col: string }
interface Bird { x: number; y: number; vx: number; ph: number; kind: number }

export function createCanopyRun8d30(): Place {
  let W = 0
  let H = 0
  let hz = 0
  let vBot = 0
  let portrait = false
  let back: HTMLCanvasElement | null = null
  let sunC: HTMLCanvasElement | null = null
  let clouds: HTMLCanvasElement | null = null
  let mid: HTMLCanvasElement | null = null
  let plat: HTMLCanvasElement | null = null
  let front: HTMLCanvasElement | null = null
  let twig: HTMLCanvasElement | null = null
  let twigAt = { x: 0, y: 0 }
  let sun = { x: 0, y: 0, r: 0 }
  let trunks: Trunk[] = []
  let bridges: Bridge[] = []
  let path: Seg[] = []
  let total = 1
  let lanterns: { x: number; y: number }[] = []
  let vines: Vine[] = []
  let swing = { x: 0, y: 0, len: 0 }
  let toucan = { x: 0, y: 0 }
  let river: { y0: number; y1: number } = { y0: 0, y1: 0 }
  const runners: Runner[] = []
  const blooms: Bloom[] = []
  const birds: Bird[] = []
  const sparks: Spark[] = []
  let nextBird = 1

  /** The valley's middle at row y: it meanders more as it comes nearer. */
  function vcx(y: number): number {
    const d = Math.max(0, y - hz)
    return W * 0.5 + Math.sin(d * 0.07 + 0.6) * d * (portrait ? 0.22 : 0.32)
  }

  function riverX(y: number): number {
    return vcx(y) + Math.sin(y * 0.16) * (y - hz) * 0.08
  }

  /** A leaf mass lit from the sun's side (upper right), with leaf flecks. */
  function foliage(g: G, x: number, y: number, r: number, salt: number, dark = C.d, body = C.m, lit = C.l, rim: string = DUSK.rim) {
    disc(g, dark, x, y, r)
    disc(g, body, x + 1, y - 1, Math.max(1, r - 2))
    for (let i = 0; i < Math.max(2, r); i++) {
      const lx = Math.round(x - r * 0.6 + hash2(i, 1, salt) * r * 1.6)
      const ly = Math.round(y - r + hash2(i, 2, salt) * r * 1.4)
      rect(g, lit, lx, ly, 2 + Math.floor(hash2(i, 3, salt) * 2), 1)
      rect(g, dark, lx - 1, ly + 1, 2, 1)
    }
    rect(g, rim, Math.round(x + r * 0.7), Math.round(y - r * 0.5), 1, Math.max(1, Math.round(r * 0.5)))
  }

  /** A distant crown: dark round, lit cap, a sun-side rim. */
  function crown(g: G, x: number, y: number, r: number, dark: string, body: string, lit: string, rim: string, salt: number) {
    disc(g, dark, x, y, r)
    disc(g, body, x + 1, y - 1, Math.max(1, r - 1))
    rect(g, lit, Math.round(x - r * 0.1), Math.round(y - r), Math.max(1, Math.round(r * 0.9)), 1)
    rect(g, rim, Math.round(x + r * 0.5), Math.round(y - r * 0.8), Math.max(1, Math.round(r * 0.5)), 1)
    rect(g, rim, x + r, Math.round(y - r * 0.4), 1, Math.max(1, Math.round(r * 0.5)))
    if (r > 4) for (let i = 0; i < 2; i++) {
      const lx = Math.round(x - r * 0.5 + hash2(i, 4, salt) * r)
      const ly = Math.round(y - r * 0.4 + hash2(i, 5, salt) * r * 0.7)
      rect(g, lit, lx, ly, 2, 1)
      rect(g, dark, lx - 1, ly + 1, 2, 1)
    }
  }

  /** A big tropical leaf from (x, y) toward angle `a`, with a midrib and slits. */
  function bigLeaf(g: G, x: number, y: number, len: number, a: number, width: number, salt: number) {
    const dx = Math.cos(a)
    const dy = Math.sin(a)
    for (let s = 0; s < len; s += 0.5) {
      const u = s / len
      const half = Math.sin(Math.PI * Math.min(1, u * 1.05)) * width * (1 - u * 0.3)
      const cx = x + dx * s
      const cy = y + dy * s + u * u * len * 0.25
      for (let v = -half; v <= half; v += 0.5) {
        if (Math.abs(v) > half * 0.35 && Math.floor(s / 3 + (v > 0 ? 0.5 : 0)) % 3 === 0 && hash2(Math.floor(s / 3), v > 0 ? 1 : 2, salt) > 0.3) continue
        const edge = Math.abs(v) > half - 0.6
        rect(g, Math.abs(v) < 0.6 ? C.h : edge && v < 0 ? DUSK.rim : v < 0 ? C.l : C.m, Math.round(cx - dy * v), Math.round(cy + dx * v), 1, 1)
      }
    }
  }

  function trunk(g: G, t: Trunk, salt: number) {
    for (let y = 0; y < H; y++) {
      const x = t.x + Math.round(Math.sin(y * 0.025 + salt) * 1.5)
      rect(g, INK, x - 1, y, t.w + 2, 1)
      rect(g, C.bark, x, y, t.w, 1)
      rect(g, C.barkD, x, y, 2, 1)
      for (let k = 4; k < t.w - 2; k += 4) if (hash2(k + salt, y >> 3, 7) > 0.35) rect(g, C.barkD, x + k + ((y >> 4) & 1), y, 1, 1)
      rect(g, C.barkL, x + t.w - 3, y, 2, 1)
      rect(g, DUSK.rim, x + t.w - 1, y, 1, 1)
      if (hash2(x >> 2, y >> 2, salt + 31) > 0.9) rect(g, C.moss, x + 1 + Math.floor(hash2(y, 1, salt) * (t.w - 4)), y, 3, 1)
    }
    // A liana spiralling up it, and bromeliads in the crooks.
    for (let y = 0; y < H; y++) {
      const s = Math.sin(y * 0.09 + salt)
      if (s < -0.2) continue
      const x = t.x + Math.round((s * 0.5 + 0.5) * (t.w - 1))
      rect(g, C.moss, x, y, 1, 1)
      if (y % 7 === 0) { rect(g, C.l, x - 1, y, 1, 1); rect(g, C.mossL, x + 1, y - 1, 1, 1) }
    }
    for (let i = 0; i < 4; i++) {
      const by = Math.round(H * (0.2 + i * 0.2 + hash2(i, 2, salt) * 0.08))
      const bx = t.x + (i % 2 ? t.w - 2 : 1)
      for (let k = -2; k <= 2; k++) line(g, C.l, bx, by, bx + k * 2, by - 3 + Math.abs(k))
      rect(g, '#ff2fa0', bx, by - 4, 1, 2)
      rect(g, '#ff8ae0', bx, by - 5, 1, 1)
    }
  }

  function platform(g: G, t: Trunk, y: number, x0: number, x1: number, outer: number) {
    // Struts to the trunk, then the deck, then a railing on the side away from the bridge.
    for (const sx of [x0 + 2, x1 - 3]) line(g, C.woodD, sx, y + 2, t.x + t.w / 2 + (sx < t.x ? -2 : 2), y + 12)
    rect(g, INK, x0 - 1, y - 1, x1 - x0 + 2, 4)
    rect(g, C.wood, x0, y, x1 - x0, 2)
    for (let x = x0; x < x1; x += 3) rect(g, C.woodL, x, y, 2, 1)
    rect(g, C.woodD, x0, y + 2, x1 - x0, 1)
    if (outer >= 0) {
      rect(g, INK, outer - 1, y - 9, 3, 9)
      rect(g, C.wood, outer, y - 8, 1, 8)
      const a = outer < t.x ? outer : t.x + t.w
      const b = outer < t.x ? t.x : outer
      rect(g, C.rope, a, y - 7, b - a, 1)
      rect(g, C.ropeD, a, y - 4, b - a, 1)
    }
  }

  function post(g: G, x: number, y: number) {
    rect(g, INK, x - 1, y - 13, 3, 13)
    rect(g, C.wood, x, y - 12, 1, 12)
    rect(g, C.woodL, x, y - 12, 1, 1)
    rect(g, INK, x - 3, y - 13, 7, 1)
    lanterns.push({ x, y: y - 10 })
  }

  function layout(w: number, h: number) {
    W = w; H = h
    portrait = h > w * 1.1
    hz = Math.round(h * (portrait ? 0.4 : 0.52))
    vBot = Math.round(h * (portrait ? 0.88 : 0.89))
    sun = { x: Math.round(w * (portrait ? 0.66 : 0.7)), y: Math.round(h * (portrait ? 0.17 : 0.24)), r: portrait ? 12 : 13 }
    const tw = portrait ? 12 : 16
    const pw = portrait ? 7 : 9
    trunks = [{ x: Math.round(w * (portrait ? 0.08 : 0.1)) - tw / 2, w: tw }, { x: Math.round(w * (portrait ? 0.92 : 0.9)) - tw / 2, w: tw }]
    const [tl, tr] = trunks as [Trunk, Trunk]
    const xa = tl.x + tw + pw
    const xb = tr.x - pw
    const mk = (ya: number, yb: number, sag: number): Bridge => ({ xa, xb, ya: Math.round(ya), yb: Math.round(yb), sag, deck: new Float32Array(w + 1) })
    bridges = portrait
      ? [mk(h * 0.29, h * 0.28, h * 0.07), mk(h * 0.58, h * 0.57, h * 0.06)]
      : [mk(h * 0.45, h * 0.43, h * 0.1)]
    const cl = tl.x + tw / 2
    const cr = tr.x + tw / 2
    const rope = xb + 3
    path = portrait
      ? [
          { kind: 0, b: 0, x0: cl, x1: rope, y0: 0, y1: 0, len: rope - cl },
          { kind: 1, b: 0, x0: rope, x1: rope, y0: bridges[0]!.yb, y1: bridges[1]!.yb, len: (bridges[1]!.yb - bridges[0]!.yb) * 0.6 },
          { kind: 0, b: 1, x0: rope, x1: cl, y0: 0, y1: 0, len: rope - cl },
          { kind: 2, b: 0, x0: 0, x1: 0, y0: 0, y1: 0, len: 50 },
        ]
      : [
          { kind: 0, b: 0, x0: cl, x1: cr, y0: 0, y1: 0, len: cr - cl },
          { kind: 2, b: 0, x0: 0, x1: 0, y0: 0, y1: 0, len: 40 },
        ]
    total = path.reduce((s, p) => s + p.len, 0)
    runners.length = 0
    river = { y0: hz + 3, y1: vBot + 8 }

    back = layer(w, h, g => {
      ditherGradient(g, 0, 0, w, hz + 2, ['#43246e', '#6a2a7c', '#a8347e', '#e0508a', '#ff8a5c', '#ffb86a'])
      // A far ridge in the haze, then emergent giants on the skyline.
      paintRidge(g, w, hz - 2, h * 0.07, hz + 2, mix(DUSK.sky5, '#ff8a5c', 0.35), '#ffc08a', 23, 0.4)
      paintRidge(g, w, hz + 1, h * 0.05, hz + 3, mix(DUSK.sky5, DUSK.ridgeFar, 0.45), '#ff8ac0', 29, 0.6)
    })
    sunC = layer(w, h, g => paintSun(g, sun.x, sun.y, sun.r, '#ff8a5c'))
    clouds = layer(w, h, g => {
      for (let i = 0; i < 4; i++) {
        const cx = Math.round((i + hash2(i, 1, 71) * 0.5) * (w / 4))
        const cy = Math.round(h * (portrait ? 0.1 + hash2(i, 2, 71) * 0.18 : 0.12 + hash2(i, 2, 71) * 0.22))
        paintPuffs(g, cx, cy, 20 + hash2(i, 3, 71) * 22, 3 + Math.round(hash2(i, 4, 71) * 2), i * 5 + 3, '#e07a9a', '#ffd0b0', '#b04a86')
      }
    })
    mid = layer(w, h, g => {
      // Emergent trees on the skyline: a bare trunk forking into flat clumps.
      const em = portrait ? 3 : 5
      for (let i = 0; i < em; i++) {
        const ex = Math.round((i + 0.2 + hash2(i, 1, 81) * 0.6) * (w / em))
        if (Math.abs(ex - sun.x) < sun.r + 8) continue
        const eh = Math.round(h * (0.05 + hash2(i, 2, 81) * 0.06))
        const top = hz - eh
        const rw = Math.round(6 + hash2(i, 3, 81) * 5)
        rect(g, '#4a2f6a', ex, top, 1, eh + 4)
        rect(g, '#ff9ab0', ex + 1, top + 3, 1, eh - 2)
        for (const k of [0, 4, 1, 3, 2]) {
          const bx = ex + Math.round((k - 2) * rw * 0.5 + (hash2(i, k, 83) - 0.5) * 2)
          const by = top - Math.round((2 - Math.abs(k - 2)) * 1.5) - 1
          line(g, '#4a2f6a', ex, top + 2, bx, by + 1)
          const cw = Math.round(rw * 0.3 + 2)
          rect(g, '#5a3a80', bx - cw, by - 1, cw * 2 + 1, 2)
          rect(g, '#5a3a80', bx - cw + 1, by - 2, cw * 2 - 1, 1)
          rect(g, '#ffa0b0', bx, by - 2, cw, 1)
          rect(g, '#c06a9a', bx - cw + 1, by - 2, cw - 1, 1)
          rect(g, '#3a2a68', bx - cw + 1, by + 1, cw * 2 - 1, 1)
        }
      }
      // The valley under the skyline, deepening toward us, and the river in it.
      ditherGradient(g, 0, hz, w, h, [mix(DUSK.sky6, '#ff8a5c', 0.3), '#8a3a7c', '#4a3070', '#1f3a5a', '#12303c', '#0a2430'])
      for (let y = river.y0; y < river.y1; y++) {
        const f = (y - river.y0) / (river.y1 - river.y0)
        const half = 0.6 + (y - hz) * (portrait ? 0.07 : 0.1)
        const x = riverX(y)
        const bank = 2 + Math.round(half * 0.8 + noise1(y, 4, 3) * 3)
        rect(g, mix('#4a2a60', '#0f2a36', f), Math.round(x - half - bank), y, Math.round(half * 2 + bank * 2), 1)
        rect(g, mix('#6a3a70', C.moss, f * 0.6), Math.round(x - half - 1), y, 1, 1)
        rect(g, f < 0.4 ? mix('#ffb86a', '#e0508a', f / 0.4) : mix('#e0508a', '#2f5fd0', Math.min(1, (f - 0.4) / 0.4)), Math.round(x - half), y, Math.max(1, Math.round(half * 2)), 1)
        if (half > 2) rect(g, mix('#fff1b0', '#7ce4ff', f), Math.round(x - half), y, 1, 1)
      }
      // Small trees on the valley floor, either side of the river.
      for (let i = 0; i < (portrait ? 70 : 50); i++) {
        const y = Math.round(hz + 4 + Math.pow(hash2(i, 1, 97), 0.8) * (vBot - hz))
        const d = clamp((y - hz) / (vBot - hz), 0, 1)
        const half = 0.6 + (y - hz) * (portrait ? 0.07 : 0.1)
        const side = hash2(i, 2, 97) > 0.5 ? 1 : -1
        const rr = Math.max(1, Math.round(1 + d * 3))
        const x = Math.round(riverX(y) + side * (half + 3 + rr + hash2(i, 3, 97) * (1 + (y - hz) * 0.5)))
        crown(g, x, y, rr, mix('#3a2a68', C.d, d), mix('#54408a', C.m, d), mix('#b86aa8', C.l, d), mix('#ffa0b0', DUSK.rim, d), i)
      }
      // The hillsides: solid canopy wherever the valley is narrower than the
      // distance to its middle, shaded far (hazy violet) to near (teal).
      const depth = (y: number) => Math.pow(clamp((y - hz) / (vBot - hz), 0, 1), 0.74)
      const halfGap = (y: number) => 1 + (y - hz) * (portrait ? 0.5 : 0.7)
      for (let y = hz; y < h; y++) {
        const dark = mix('#3a2a68', C.d, Math.pow(depth(y), 0.7))
        const mx = vcx(y)
        const gp = halfGap(y)
        for (let x = 0; x < w; x++) {
          if (Math.abs(x - mx) - gp - noise1(x + y * 0.5, 7, 90) * 4 < 0) continue
          let x1 = x
          while (x1 + 1 < w && Math.abs(x1 + 1 - mx) - gp - noise1(x1 + 1 + y * 0.5, 7, 90) * 4 >= 0) x1++
          rect(g, dark, x, y, x1 - x + 1, 1)
          x = x1
        }
      }
      // Rows of crowns on them, far to near, the valley's edge rounded by crowns too.
      const rows = portrait ? 9 : 7
      for (let k = 0; k < rows; k++) {
        const f = k / (rows - 1)
        const fc = Math.pow(f, 0.7)
        const yk = Math.round(hz + (vBot - hz) * Math.pow(f, 1.35))
        const r = Math.round(3 + f * (portrait ? 8 : 9))
        const dark = mix('#3a2a68', C.d, fc)
        const body = mix('#54408a', C.m, fc)
        const lit = mix('#b86aa8', C.l, fc)
        const rim = mix('#ffa0b0', DUSK.rim, fc)
        const step = Math.max(3, Math.round(r * 1.1))
        const put = (cx: number, cy: number, rr: number, salt: number) => {
          crown(g, cx, cy, rr, mix(dark, body, hash2(salt, 1, 95) * 0.25), body, lit, rim, salt)
          if (fc > 0.5 && hash2(salt, k, 93) > 0.6) rect(g, C.h, cx + 1, cy - rr + 1, 2, 1)
        }
        for (let x = -r; x < w + r; x += step) {
          const rr = Math.max(2, Math.round(r * (0.7 + hash2(x, k + 3, 91) * 0.5)))
          const cx = x + Math.round((hash2(x, k, 91) - 0.5) * r * 0.8)
          const cy = yk - Math.round(hash2(x, k + 9, 91) * r * 0.8)
          if (Math.abs(cx - vcx(cy)) < halfGap(cy) + rr * 0.6) continue
          put(cx, cy, rr, x * 13 + k)
        }
        for (const side of [-1, 1]) {
          const rr = Math.max(2, Math.round(r * 0.8))
          put(Math.round(vcx(yk) + side * (halfGap(yk) + rr * 0.4)), yk - Math.round(rr * 0.3), rr, k * 7 + side)
        }
      }
    })
    lanterns = []
    plat = layer(w, h, g => {
      for (const b of bridges) {
        platform(g, tl, b.ya, tl.x - (portrait ? 4 : pw), xa, portrait ? -1 : tl.x - pw)
        platform(g, tr, b.yb, xb, tr.x + tw + (portrait ? 4 : pw), portrait ? -1 : tr.x + tw + pw - 1)
        post(g, xa, b.ya)
        post(g, xb, b.yb)
      }
      if (portrait) {
        // The rope they slide down to the lower bridge.
        const y0 = bridges[0]!.yb - 12
        const y1 = bridges[1]!.yb
        rect(g, INK, rope - 1, y0, 3, y1 - y0)
        for (let y = y0; y < y1; y++) rect(g, (y & 3) === 0 ? C.ropeD : C.rope, rope, y, 1, 1)
        rect(g, INK, rope - 3, y0 - 1, 7, 2)
      }
    })
    front = layer(w, h, g => {
      trunk(g, tl, 3)
      trunk(g, tr, 11)
      // The lip of each platform, in front of the trunk.
      for (const b of bridges) {
        rect(g, INK, tl.x - 1, b.ya + 1, tw + 2, 3)
        rect(g, C.wood, tl.x - 1, b.ya + 1, tw + 2, 1)
        rect(g, INK, tr.x - 1, b.yb + 1, tw + 2, 3)
        rect(g, C.wood, tr.x - 1, b.yb + 1, tw + 2, 1)
      }
      // Canopy across the top: clumps of leaves, thick over the trunks, thin at the sun.
      const cr = Math.max(8, Math.round(Math.min(w, h) * 0.07))
      for (let x = -cr; x < w + cr; x += Math.round(cr * 0.8)) {
        const near = Math.min(Math.abs(x - tl.x), Math.abs(x - tr.x)) / (w * 0.3)
        const sunGap = Math.max(0, 1 - Math.abs(x - sun.x) / (sun.r * 2.4))
        const cy = Math.round(-cr * 0.4 + (1 - Math.min(1, near)) * h * 0.07 + hash2(x, 1, 41) * cr * 0.6 - sunGap * cr * 1.3)
        for (let j = 0; j < 3; j++) {
          const r = Math.round(cr * (0.55 + hash2(x, j + 20, 41) * 0.4))
          foliage(g, x + Math.round((hash2(x, j + 30, 41) - 0.5) * cr * 1.4), cy + Math.round((hash2(x, j + 40, 41) - 0.2) * cr * 0.8), r, x * 3 + j)
        }
        for (let k = 0; k < 3; k++) {
          const lx = x + Math.round((hash2(x, k, 44) - 0.5) * cr * 1.6)
          const ly = cy + cr + Math.round(hash2(x, k + 5, 44) * cr * 0.4) - 2
          rect(g, C.m, lx, ly, 1, 3)
          rect(g, C.l, lx - 1, ly + 2, 1, 2)
          rect(g, C.d, lx + 1, ly + 3, 1, 2)
        }
      }
      // Near crowns along the bottom, then big leaves in the corners.
      const nr = Math.max(9, Math.round(Math.min(w, h) * 0.09))
      for (let x = -nr; x < w + nr; x += Math.round(nr * 1.1)) {
        const cy = vBot + Math.round(nr * 0.5 + hash2(x, 3, 47) * nr * 0.5)
        foliage(g, x, cy, nr, x + 3, '#0a2436', C.d, C.m)
        rect(g, '#0a2436', x - nr, cy, nr * 2 + 1, h - cy)
      }
      bigLeaf(g, -4, h - 3, h * 0.3, -0.7, h * 0.06, 3)
      bigLeaf(g, 2, h + 2, h * 0.24, -1.2, h * 0.05, 5)
      bigLeaf(g, w + 4, h - 2, h * 0.32, Math.PI + 0.65, h * 0.065, 7)
      bigLeaf(g, w - 3, h + 3, h * 0.22, Math.PI + 1.1, h * 0.05, 9)
    })
    // A twig that hangs in front of the sun and sways: the flicker.
    twig = layer(sun.r * 4, sun.r * 4, g => {
      const s = sun.r * 4
      let px = s - 1
      let py = 0
      for (let i = 0; i < s * 1.2; i++) {
        const u = i / (s * 1.2)
        const x = Math.round(s - 1 - u * s * 0.8)
        const y = Math.round(u * s * 0.75 + Math.sin(u * 5) * 2)
        line(g, C.barkD, px, py, x, y)
        px = x; py = y
        if (i % 4 === 1) {
          // A pointed leaf drooping off the twig, lit along its upper edge.
          const side = (i >> 2) % 2 ? 1 : -1
          const len = 5 + ((i >> 3) % 2) * 2
          for (let k = 0; k <= len; k++) {
            const lx = Math.round(x + side * k * 0.6)
            const ly = y + 1 + k
            const wd = k < 1 || k >= len - 1 ? 1 : 2
            rect(g, C.d, side > 0 ? lx : lx - wd + 1, ly, wd, 1)
            rect(g, k < len * 0.6 ? C.l : C.m, lx, ly, 1, 1)
          }
        }
      }
    })
    twigAt = { x: sun.x - sun.r * 2.6, y: sun.y - sun.r * 1.6 }
    // Hanging vines from the canopy; the notes open flowers on them.
    vines = []
    const nv = portrait ? 6 : 8
    for (let i = 0; i < nv; i++) {
      const vx = Math.round((i + 0.25 + hash2(i, 1, 51) * 0.5) * (w / nv))
      vines.push({ x: vx, top: Math.round(h * 0.04), len: Math.round(h * ((portrait ? 0.14 : 0.18) + hash2(i, 2, 51) * (portrait ? 0.2 : 0.3))), ph: hash2(i, 3, 51) * 6 })
    }
    swing = { x: Math.round(w * (portrait ? 0.42 : 0.38)), y: -4, len: Math.round(h * (portrait ? 0.2 : 0.3)) }
    toucan = { x: tl.x + tw + 3, y: bridges[0]!.ya - 1 }
    blooms.length = 0
    birds.length = 0
    const R = rng(5)
    for (let i = 0; i < 2; i++) birds.push({ x: R() * w, y: h * (0.12 + R() * 0.2), vx: (R() > 0.5 ? 1 : -1) * (14 + R() * 8), ph: R() * 6, kind: i % 3 })
  }

  function deckAt(b: number, x: number): number {
    const br = bridges[b]!
    if (x <= br.xa) return br.ya
    if (x >= br.xb) return br.yb
    return br.deck[Math.round(x)]!
  }

  function place(r: Runner) {
    let d = wrap(r.d, total)
    for (const s of path) {
      if (d < s.len) {
        const f = d / s.len
        r.kind = s.kind
        r.b = s.b
        if (s.kind === 0) { r.x = s.x0 + (s.x1 - s.x0) * f; r.dir = s.x1 > s.x0 ? 1 : -1 }
        else if (s.kind === 1) { r.x = s.x0; r.y = s.y0 + (s.y1 - s.y0) * f; r.dir = -1 }
        return
      }
      d -= s.len
    }
    r.kind = 2
  }

  /** A thick line of rects: (ox, oy, sw, sh) is the brush round each point. */
  function seg(g: G, x0: number, y0: number, x1: number, y1: number, ox: number, oy: number, sw: number, sh: number) {
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))))
    for (let k = 0; k <= n; k++) g.fillRect(Math.round(x0 + ((x1 - x0) * k) / n) + ox, Math.round(y0 + ((y1 - y0) * k) / n) + oy, sw, sh)
  }

  /**
   * A runner, side view, about 13 px tall: `ph` is the stride phase, `run`
   * 0 (walk) .. 1 (sprint), `slide` hangs them on a rope instead.
   */
  function drawRunner(g: G, L: Lights, c: FrameCtx, x: number, foot: number, dir: number, ph: number, run: number, shirt: string, slide: boolean) {
    const P = FIG
    const lean = slide ? 0 : 0.6 + run * 1.2
    let hipY = 0
    let lowest = -99
    for (let i = 0; i < 2; i++) {
      const p = TAU * (ph + i * 0.5)
      const a = slide ? (i ? 0.25 : -0.1) : Math.sin(p) * (0.45 + run * 0.55)
      const bend = slide ? 0.5 : Math.max(0, Math.cos(p)) * (0.6 + run * 1.1)
      P[i * 4] = Math.sin(a) * 3.2 * dir
      P[i * 4 + 1] = Math.cos(a) * 3.2
      P[i * 4 + 2] = P[i * 4]! + Math.sin(a - bend) * 3.2 * dir
      P[i * 4 + 3] = P[i * 4 + 1]! + Math.cos(a - bend) * 3.2
      if (P[i * 4 + 3]! > lowest) lowest = P[i * 4 + 3]!
    }
    hipY = slide ? foot - 7 : foot - lowest - Math.max(0, Math.sin(TAU * ph * 2)) * run * 0.8
    const hx = Math.round(x)
    const hy = Math.round(hipY)
    const sx = hx + lean * dir
    const sy = hy - 4
    const headX = Math.round(sx + dir * (slide ? 0 : 1))
    const headY = Math.round(sy - 2.5)
    // Arms: swing against the legs, forearms bent forward; up on the rope.
    for (let i = 0; i < 2; i++) {
      const b = slide ? 0 : -Math.sin(TAU * (ph + i * 0.5)) * (0.5 + run * 0.6)
      P[8 + i * 4] = slide ? (i ? 1 : -1) * 0.5 : Math.sin(b) * 2.2 * dir
      P[8 + i * 4 + 1] = slide ? -2.5 : Math.cos(b) * 2.2
      P[8 + i * 4 + 2] = slide ? 0 : P[8 + i * 4]! + Math.sin(b + 1.5) * 2.2 * dir
      P[8 + i * 4 + 3] = slide ? -5 : P[8 + i * 4 + 1]! + Math.cos(b + 1.5) * 2.2
    }
    // Outline pass.
    g.fillStyle = INK
    for (let i = 0; i < 2; i++) {
      seg(g, hx, hy, hx + P[i * 4]!, hy + P[i * 4 + 1]!, -1, -1, 3, 3)
      seg(g, hx + P[i * 4]!, hy + P[i * 4 + 1]!, hx + P[i * 4 + 2]!, hy + P[i * 4 + 3]!, -1, -1, 3, 3)
      seg(g, sx, sy, sx + P[8 + i * 4]!, sy + P[8 + i * 4 + 1]!, -1, -1, 3, 3)
      seg(g, sx + P[8 + i * 4]!, sy + P[8 + i * 4 + 1]!, sx + P[8 + i * 4 + 2]!, sy + P[8 + i * 4 + 3]!, -1, -1, 3, 3)
    }
    seg(g, hx, hy, sx, sy, -1, -1, 4, 3)
    g.fillRect(headX - 2, headY - 1, 5, 3)
    g.fillRect(headX - 1, headY - 2, 3, 5)
    // Far limbs, torso, near limbs, head.
    for (const i of [1, 0]) {
      const skin = i ? '#c98576' : '#f5c3a8'
      g.fillStyle = skin
      seg(g, sx, sy, sx + P[8 + i * 4]!, sy + P[8 + i * 4 + 1]!, 0, 0, 1, 1)
      seg(g, sx + P[8 + i * 4]!, sy + P[8 + i * 4 + 1]!, sx + P[8 + i * 4 + 2]!, sy + P[8 + i * 4 + 3]!, 0, 0, 1, 1)
      seg(g, hx + P[i * 4]!, hy + P[i * 4 + 1]!, hx + P[i * 4 + 2]!, hy + P[i * 4 + 3]!, 0, 0, 1, 1)
      g.fillStyle = i ? '#1a2f78' : '#2f5fd0'
      seg(g, hx, hy, hx + P[i * 4]!, hy + P[i * 4 + 1]!, 0, 0, 1, 1)
      g.fillStyle = '#fff4ff'
      g.fillRect(Math.round(hx + P[i * 4 + 2]!), Math.round(hy + P[i * 4 + 3]!), 1, 1)
      if (i === 1) {
        g.fillStyle = shirt
        seg(g, hx, hy - 1, sx, sy, dir > 0 ? -1 : 0, 0, 2, 1)
      }
    }
    rect(g, '#f5c3a8', headX - 1, headY - 1, 3, 3)
    rect(g, '#3a1a4a', headX - dir, headY, 1, 2)
    rect(g, '#b6ff4a', headX - 1, headY - 1, 3, 1)
    // The ribbon streams behind in the chord's colour.
    const rib = mix(c.accent, '#b6ff4a', 0.3)
    const n = slide ? 2 : 2 + Math.round(run * 2)
    for (let k = 1; k <= n; k++) rect(g, rib, headX - dir * (1 + k), headY - 1 + Math.round(Math.sin(c.t * 18 + k * 1.3 + x) * 0.5 * (k / n) + (slide ? k * 0.7 : 0)), 1, 1)
    L.emit(headX - 1, headY - 1, 3, 1)
    L.light(headX, headY, 6, rib, 0.3)
  }

  function drawBridge(g: G, br: Bridge, front: boolean, c: FrameCtx) {
    const dk = br.deck
    if (!front) {
      g.fillStyle = C.ropeD
      for (let x = br.xa; x <= br.xb; x++) g.fillRect(x, Math.round(dk[x]!) - 8, 1, 1)
      return
    }
    for (let x = br.xa; x <= br.xb; x++) {
      const y = Math.round(dk[x]!)
      const gap = (x - br.xa) % 3 === 2
      rect(g, gap ? C.woodD : C.woodL, x, y, 1, 1)
      rect(g, gap ? C.woodD : C.wood, x, y + 1, 1, 1)
      rect(g, INK, x, y + 2, 1, 1)
      rect(g, C.rope, x, y - 6, 1, 1)
      if ((x - br.xa) % 5 === 0) rect(g, C.ropeD, x, y - 5, 1, 5)
    }
    // Bunting under the rail; drums and perc (and the kick) flap it.
    const flap = 0.4 + (c.levels.drums ?? 0) * 0.8 + (c.levels.perc ?? 0) * 0.8 + c.beat * 0.6
    for (let x = br.xa + 4, i = 0; x < br.xb - 2; x += 8, i++) {
      const y = Math.round(dk[x]!) - 5
      const tip = Math.round(Math.sin(c.t * 7 + i * 1.7) * flap)
      const col = FLAGS[i % FLAGS.length]!
      rect(g, col, x - 1, y, 3, 1)
      rect(g, col, x - 1 + (tip > 0 ? 1 : 0), y + 1, 2, 1)
      rect(g, col, x + tip, y + 2, 1, 1)
    }
  }

  function drawBird(g: G, L: Lights, b: Bird, t: number) {
    const x = Math.round(b.x)
    const y = Math.round(b.y + Math.sin(t * 2 + b.ph) * 2)
    const d = b.vx > 0 ? 1 : -1
    const [body, wing, head] = BIRDS[b.kind]!
    const up = Math.sin(t * 14 + b.ph) > 0
    rect(g, INK, x - 2, y - 1, 5, 3)
    rect(g, body, x - 1, y, 3, 1)
    rect(g, head, x + d * 2, y, 1, 1)
    rect(g, body, x - d * 2, y + 1, 1, 1)
    rect(g, body, x - d * 3, y + 1, 1, 1)
    rect(g, wing, x - (d > 0 ? 1 : 0), up ? y - 2 : y + 1, 2, up ? 2 : 2)
    L.light(x, y, 4, body, 0.15)
  }

  function drawSwinger(g: G, L: Lights, c: FrameCtx) {
    const amp = 0.5 + c.energy * 0.45
    const a = Math.sin(c.t * 1.5) * amp
    const face = Math.cos(c.t * 1.5) >= 0 ? 1 : -1
    const ux = Math.sin(a)
    const uy = Math.cos(a)
    const hx = swing.x + ux * swing.len
    const hy = swing.y + uy * swing.len
    line(g, '#16402c', swing.x, swing.y, hx, hy)
    // Hanging off the vine: arms up, head between them, legs kicked into the swing.
    const sx = hx + ux * 3
    const sy = hy + uy * 3
    const px = sx + ux * 4.5
    const py = sy + uy * 4.5
    const kick = face * (0.4 + 0.5 * Math.abs(Math.cos(c.t * 1.5)))
    const fx = px + Math.sin(a + kick) * 4.5
    const fy = py + Math.cos(a + kick) * 4.5
    const headX = Math.round(hx + ux * 2 + uy * face * 1.5)
    const headY = Math.round(hy + uy * 2 - ux * face * 1.5)
    g.fillStyle = INK
    seg(g, hx, hy, sx, sy, -1, -1, 3, 3)
    seg(g, sx, sy, px, py, -1, -1, 4, 3)
    seg(g, px, py, fx, fy, -1, -1, 3, 3)
    g.fillRect(headX - 2, headY - 1, 5, 3)
    g.fillRect(headX - 1, headY - 2, 3, 5)
    g.fillStyle = '#f5c3a8'
    seg(g, hx, hy, sx, sy, 0, 0, 1, 1)
    seg(g, px, py, fx, fy, 0, 0, 1, 1)
    g.fillStyle = '#ff2fa0'
    seg(g, sx, sy, px, py, 0, 0, 2, 1)
    g.fillStyle = '#2f5fd0'
    g.fillRect(Math.round(px), Math.round(py), 2, 1)
    rect(g, '#f5c3a8', headX - 1, headY - 1, 3, 3)
    rect(g, '#3a1a4a', headX - face, headY, 1, 2)
    rect(g, '#b6ff4a', headX - 1, headY - 1, 3, 1)
    rect(g, '#fff4ff', Math.round(fx), Math.round(fy), 1, 1)
    L.emit(headX - 1, headY - 1, 3, 1)
    L.light(sx, sy, 8, '#ff8ae0', 0.2)
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !sunC || !clouds || !mid || !plat || !front || !twig) return
    const run = clamp(c.energy * 1.1, 0, 1)
    g.drawImage(back, 0, 0)
    g.drawImage(sunC, 0, 0)
    L.emitImage(sunC)
    const cx = Math.round(wrap(c.t * 1.5, W))
    g.drawImage(clouds, cx, 0)
    g.drawImage(clouds, cx - W, 0)
    g.drawImage(mid, 0, 0)
    // The sun's flicker: how much of it the twig lets through right now.
    const sway = Math.sin(c.t * 0.9) * 2 + Math.sin(c.t * 2.3 + 1) * (0.6 + c.energy)
    const flick = clamp(0.55 + 0.25 * Math.sin(c.t * 3.1) * Math.sin(c.t * 1.7 + 2) + 0.2 * c.beat - Math.abs(sway) * 0.05, 0.2, 1)
    L.light(sun.x, sun.y, sun.r * 6, '#ffb86a', 0.35 + 0.2 * flick)
    L.light(sun.x, sun.y, sun.r * 2.5, '#fff1b0', 0.4)
    // River glints running toward us.
    const span = river.y1 - river.y0
    g.fillStyle = '#e8fbff'
    for (let i = 0; i < 14; i++) {
      const y = river.y0 + Math.round(wrap(hash2(i, 1, 7) * span + c.t * (4 + hash2(i, 2, 7) * 6), span))
      if (y > vBot) continue
      const half = 0.6 + (y - hz) * (portrait ? 0.07 : 0.1)
      const x = Math.round(riverX(y) + (hash2(i, 3, 7) - 0.5) * half * 1.4)
      g.fillRect(x, y, 1 + Math.round(half * 0.3), 1)
      L.emit(x, y, 1, 1)
    }
    L.light(riverX(river.y0 + span * 0.6), river.y0 + span * 0.6, span * 0.4, '#7ce4ff', 0.2)
    // Mist over the valley, thicker with the pad.
    const mist = 0.1 + (c.levels.pad ?? 0) * 0.12
    g.fillStyle = '#ffd0e0'
    for (let i = 0; i < 9; i++) {
      const y = hz + 4 + hash2(i, 1, 13) * (vBot - hz) * 0.5
      const x = wrap(hash2(i, 2, 13) * W + c.t * (2 + hash2(i, 3, 13) * 2), W + 40) - 20
      g.globalAlpha = mist
      g.fillRect(Math.round(x - 12), Math.round(y), 24, 2)
      g.fillRect(Math.round(x - 7), Math.round(y - 1), 14, 1)
    }
    g.globalAlpha = 1
    // Shafts fanning down-left from the sun through the leaves.
    g.fillStyle = '#fff1b0'
    for (let i = 0; i < 5; i++) {
      const ang = 2.05 + i * 0.16
      const fl = clamp(flick + 0.3 * Math.sin(c.t * (2.1 + i) + i * 2), 0.1, 1)
      const len = H * 0.9
      const ca = Math.cos(ang)
      const sa = Math.sin(ang)
      for (let s = sun.r + 2; s < len; s += 2) {
        const x = sun.x + ca * s
        const y = sun.y + sa * s
        if (y > H || x < 0) break
        g.globalAlpha = 0.09 * fl * (1 - s / len)
        const wdt = 2 + s * 0.06
        g.fillRect(Math.round(x - wdt / 2), Math.round(y), Math.round(wdt), 2)
      }
    }
    g.globalAlpha = 1
    // Parrots, more of them as it builds.
    nextBird -= c.dt
    if (nextBird <= 0 && birds.length < 2 + Math.round(c.energy * 6)) {
      const d = Math.random() > 0.5 ? 1 : -1
      const lead = { x: d > 0 ? -6 : W + 6, y: H * (portrait ? 0.08 + Math.random() * 0.22 : 0.1 + Math.random() * 0.28), vx: d * (16 + Math.random() * 10), ph: Math.random() * 6, kind: Math.floor(Math.random() * 3) }
      birds.push(lead)
      if (c.energy > 0.5 && birds.length < 10) birds.push({ x: lead.x - d * 7, y: lead.y + 4, vx: lead.vx, ph: lead.ph + 1, kind: (lead.kind + 1) % 3 })
      nextBird = 1.5 + Math.random() * (5 - c.energy * 3)
    }
    for (let i = birds.length - 1; i >= 0; i--) {
      const b = birds[i]!
      b.x += b.vx * c.dt
      if (b.x < -10 || b.x > W + 10) { birds.splice(i, 1); continue }
      drawBird(g, L, b, c.t)
    }
    if (c.intensity > 1.6) drawSwinger(g, L, c)
    // Runners: as many as the intensity asks for, spread round the loop.
    const want = 1 + Math.floor(clamp(c.intensity, 0, 4) * 0.8)
    if (!runners.length) for (let i = 0; i < want; i++) runners.push({ d: (total * i) / want + 20, ph: i * 0.37, k: 1, shirt: SHIRTS[i % 4]!, x: 0, y: 0, dir: 1, kind: 0, b: 0 })
    const hidden = total - path[path.length - 1]!.len * 0.5
    let clear = runners.length < want
    for (const r of runners) if (Math.abs(wrap(r.d - hidden + total / 2, total) - total / 2) < 40) clear = false
    if (clear) {
      runners.push({ d: hidden, ph: 0, k: 1, shirt: SHIRTS[runners.length % 4]!, x: 0, y: 0, dir: 1, kind: 2, b: 0 })
    }
    const speed = 9 + 46 * run
    for (let i = runners.length - 1; i >= 0; i--) {
      const r = runners[i]!
      place(r)
      if (runners.length > want && r.kind === 2) { runners.splice(i, 1); continue }
      const v = speed * (r.kind === 1 ? 1.4 : 1)
      r.d = wrap(r.d + v * c.dt, total)
      r.ph = wrap(r.ph + (v * c.dt) / (8 + 5 * run), 1)
      place(r)
    }
    // The decks sag, bounce on the kick, and dip under whoever is on them.
    for (let bi = 0; bi < bridges.length; bi++) {
      const br = bridges[bi]!
      const spanX = br.xb - br.xa
      const sag = br.sag * (1 + 0.05 * Math.sin(c.t * 1.3 + bi))
      for (let x = br.xa; x <= br.xb; x++) {
        const u = (x - br.xa) / spanX
        const bell = Math.sin(Math.PI * u)
        let y = br.ya + (br.yb - br.ya) * u + sag * 4 * u * (1 - u) + c.beat * 1.3 * bell
        for (const r of runners) if (r.kind === 0 && r.b === bi) {
          const du = (x - r.x) / spanX * 9
          y += (1.8 * bell) / (1 + du * du)
        }
        br.deck[x] = y
      }
    }
    g.drawImage(plat, 0, 0)
    for (const br of bridges) drawBridge(g, br, false, c)
    for (const r of runners) {
      if (r.kind === 2) continue
      const foot = r.kind === 0 ? deckAt(r.b, r.x) - 1 : r.y
      drawRunner(g, L, c, r.x, foot, r.dir, r.ph, run, r.shirt, r.kind === 1)
    }
    for (const br of bridges) drawBridge(g, br, true, c)
    g.drawImage(front, 0, 0)
    // The twig across the sun.
    g.drawImage(twig, Math.round(twigAt.x + sway), Math.round(twigAt.y + Math.sin(c.t * 1.3) * 0.8))
    // Lanterns on the posts: gold with the chord's colour, breathing with the kick.
    const lc = mix('#ffd23f', c.accent, 0.55)
    for (const l of lanterns) {
      rect(g, INK, l.x - 2, l.y - 1, 5, 6)
      rect(g, lc, l.x - 1, l.y, 3, 4)
      rect(g, '#fff1b0', l.x - 1, l.y, 1, 2)
      L.emit(l.x - 1, l.y, 3, 4)
      L.light(l.x, l.y + 2, 14, lc, 0.4 + 0.25 * c.beat)
    }
    // The toucan on the left platform bobs on the kick.
    const bob = c.beat > 0.55 ? 1 : 0
    const tx = toucan.x
    const ty = toucan.y
    rect(g, INK, tx - 1, ty - 8 + bob, 5, 8 - bob)
    rect(g, '#1c1030', tx, ty - 7 + bob, 3, 6 - bob)
    rect(g, '#fff1b0', tx + 2, ty - 6 + bob, 1, 2)
    rect(g, '#fff4ff', tx + 2, ty - 7 + bob, 1, 1)
    rect(g, INK, tx + 3, ty - 8 + bob, 4, 3)
    rect(g, '#ffd23f', tx + 3, ty - 7 + bob, 3, 1)
    rect(g, '#ff8a3d', tx + 3, ty - 6 + bob, 3, 1)
    rect(g, '#ff3b5c', tx + 5, ty - 7 + bob, 1, 1)
    rect(g, '#1c1030', tx - 1, ty - 1, 1, 2)
    // Vines sway; lead and counter notes open flowers on them (pitch → height).
    for (const nh of c.notes) {
      if (nh.layer === 'lead' || nh.layer === 'counter') {
        if (blooms.length >= 24) blooms.shift()
        const v = Math.floor(Math.random() * vines.length)
        blooms.push({ v, s: Math.round((1 - nh.h) * (vines[v]!.len - 3)) + 2, age: 0, life: 2.4, col: nh.layer === 'lead' ? mix(c.accent, '#ff2fa0', 0.4) : '#ffd23f' })
      } else if (melodic(nh.layer)) {
        spawnSpark(sparks, W * (0.2 + Math.random() * 0.6), hz - 6 + (1 - nh.h) * (vBot - hz) * 0.7 - nh.h * (hz * 0.5), nh.layer === 'bells' ? '#fff1b0' : '#b6ff4a', nh.layer === 'bells', 1.2)
      }
    }
    for (let vi = 0; vi < vines.length; vi++) {
      const v = vines[vi]!
      const sw = Math.sin(c.t * 0.8 + v.ph) * (1 + c.energy * 1.5)
      for (let s = 0; s < v.len; s++) {
        const u = s / v.len
        const x = Math.round(v.x + Math.sin(s * 0.12 + v.ph) * 1.5 + sw * u * u * 3)
        const y = v.top + s
        rect(g, '#16402c', x, y, 1, 1)
        if (s % 5 === 0 && s > 3) {
          const side = (s / 5) % 2 ? 1 : -1
          rect(g, C.l, x + side, y, 1, 1)
          rect(g, C.m, x + side * 2, y + 1, 1, 1)
        }
      }
      rect(g, C.l, Math.round(v.x + Math.sin(v.len * 0.12 + v.ph) * 1.5 + sw * 3), v.top + v.len, 1, 2)
    }
    for (let i = blooms.length - 1; i >= 0; i--) {
      const b = blooms[i]!
      b.age += c.dt
      if (b.age > b.life) { blooms.splice(i, 1); continue }
      const v = vines[b.v]!
      const u = b.s / v.len
      const sw = Math.sin(c.t * 0.8 + v.ph) * (1 + c.energy * 1.5)
      const x = Math.round(v.x + Math.sin(b.s * 0.12 + v.ph) * 1.5 + sw * u * u * 3)
      const y = v.top + b.s
      const k = b.age / b.life
      const a = k < 0.15 ? k / 0.15 : 1 - (k - 0.15) / 0.85
      rect(g, '#fff1b0', x, y, 1, 1)
      if (a > 0.3) { rect(g, b.col, x - 1, y, 1, 1); rect(g, b.col, x + 1, y, 1, 1); rect(g, b.col, x, y - 1, 1, 1); rect(g, b.col, x, y + 1, 1, 1) }
      if (a > 0.7) { rect(g, b.col, x - 1, y - 1, 1, 1); rect(g, b.col, x + 1, y + 1, 1, 1) }
      L.emit(x - 1, y - 1, 3, 3)
      L.light(x + 0.5, y + 0.5, 8, b.col, 0.4 * a)
    }
    drawSparks(g, sparks, c.dt, L, 0.3)
    // Motes drifting in the light.
    g.fillStyle = '#fff1b0'
    const motes = 8 + Math.round(c.energy * 16)
    for (let i = 0; i < motes; i++) {
      const s = sun.r + 10 + hash2(i, 1, 17) * H * 0.6
      const ang = 2.05 + hash2(i, 2, 17) * 0.64
      const x = sun.x + Math.cos(ang) * s + Math.sin(c.t * 0.5 + i) * 4
      const y = sun.y + Math.sin(ang) * s + wrap(c.t * 2 + i * 3, 12) - 6
      if (Math.sin(c.t * 2 + i * 1.7) * flick < 0.1) continue
      g.fillRect(Math.round(x), Math.round(y), 1, 1)
      L.emit(Math.round(x), Math.round(y), 1, 1)
    }
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#c0b4e0', '#908ac4', c.dark * 0.6), '#e0dcf4', c.energy * 0.12),
    horizon: () => hz,
  }
}

/** Scratch for a figure's joints: legs (knee, foot) ×2, then arms (elbow, hand) ×2. */
const FIG = new Float32Array(16)
