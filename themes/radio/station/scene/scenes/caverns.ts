// Vendored from phareim/radio@61a86d4 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Crystal Caverns — under the shrine. Stalactites hang from a dark vault,
 * crystal clusters grow from the walls and the shore and light the rock
 * round them (they breathe with the kick), a shrine arch glows far back
 * in the chord's colour, water drips from the tips into a still lake that
 * mirrors it all, and motes of light drift up. A note glints on the crystal
 * that sits at its pitch.
 */
import { hash2, noise1, rect } from '../pixel/scenery.ts'
import { mix } from '../pixel/sprites.ts'
import { drawSparks, layer, melodic, mirrorLights, spawnSpark, wrap, type FrameCtx, type G, type Lights, type Place, type Spark } from '../lib/kit.ts'
import { mirror, paintCrystals } from '../lib/paint.ts'

const CYAN = { lo: '#1a9fc4', mid: '#2ff3ff', hi: '#e8fbff', edge: '#7ce4ff' }
const VIOLET = { lo: '#54259e', mid: '#9a4ff0', hi: '#e0c0ff', edge: '#cfa0ff' }
const ROCK = '#241a4c'
const ROCK_L = '#34276a'
const ROCK_D = '#170f33'
const PINK = { lo: '#b01874', mid: '#ff2fa0', hi: '#ffd0ec', edge: '#ff8ae0' }

interface Cluster { x: number; y: number; col: string; tips: { x: number; y: number }[] }
interface Drop { x: number; y: number; vy: number; tipY: number }
interface Ripple { x: number; age: number }

export function createCaverns(): Place {
  let W = 0
  let H = 0
  let lake = 0
  let back: HTMLCanvasElement | null = null
  let rock: HTMLCanvasElement | null = null
  let crys: HTMLCanvasElement | null = null
  let copy: HTMLCanvasElement | null = null
  let clusters: Cluster[] = []
  let tips: { x: number; y: number }[] = []
  let arch = { x: 0, y: 0, w: 0, h: 0 }
  const drops: Drop[] = []
  const ripples: Ripple[] = []
  const sparks: Spark[] = []
  let nextDrop = 0

  /** Rock mass: a filled region under/over a noisy edge, lit along the edge. */
  function rockEdge(g: G, x0: number, x1: number, edge: (x: number) => number, fromTop: boolean, salt: number) {
    for (let x = x0; x < x1; x++) {
      const e = Math.round(edge(x))
      const y0 = fromTop ? 0 : e
      const y1 = fromTop ? e : H
      rect(g, ROCK, x, y0, 1, y1 - y0)
      for (let y = y0; y < y1; y += 2) {
        const n = hash2((x + ((y >> 2) & 1) * 3) >> 2, y >> 2, salt)
        if (n > 0.8) rect(g, ROCK_L, x, y, 1, 2)
        else if (n < 0.12) rect(g, ROCK_D, x, y, 1, 2)
      }
      rect(g, ROCK_L, x, fromTop ? e - 3 : e, 1, 3)
      rect(g, '#6a4fb0', x, fromTop ? e - 1 : e, 1, 1)
    }
  }

  function layout(w: number, h: number) {
    W = w; H = h
    const portrait = h > w * 1.1
    lake = Math.round(h * (portrait ? 0.68 : 0.66))
    copy = layer(w, h, () => {})
    arch = { x: Math.round(w * 0.5), y: lake, w: Math.round(Math.min(w, h) * 0.16), h: Math.round(h * (portrait ? 0.16 : 0.26)) }
    back = layer(w, h, g => {
      rect(g, '#07040f', 0, 0, w, h)
      // The far wall: faint strata.
      for (let y = 0; y < lake; y++) for (let x = 0; x < w; x += 2) {
        const n = noise1(x + y * 3, 17, 3) * 0.6 + noise1(y, 5, 4) * 0.4
        if (n > 0.62) rect(g, '#140b26', x, y, 2, 1)
        else if (n > 0.55) rect(g, '#110922', x, y, 2, 1)
      }
      // The shrine arch far back, on the waterline.
      const ax = arch.x - Math.round(arch.w / 2)
      const top = lake - arch.h
      rect(g, '#1f1a3c', ax - 4, top - 4, arch.w + 8, arch.h + 4)
      for (let y = top - 4; y < lake; y += 3) rect(g, '#271f50', ax - 4, y, arch.w + 8, 1)
      const iw = arch.w - 6
      const ix = ax + 3
      for (let y = top + 4; y < lake; y++) {
        const r = iw / 2
        const dy = top + 4 + r - y
        const half = dy > 0 ? Math.floor(Math.sqrt(Math.max(0, r * r - dy * dy))) : Math.floor(r)
        rect(g, '#05030b', ix + Math.round(r) - half, y, half * 2, 1)
      }
      rect(g, '#1f1a3c', ax - 6, top - 6, arch.w + 12, 2)
    })
    clusters = []
    tips = []
    rock = layer(w, h, g => {
      // Vault with stalactites.
      const vault = (x: number) => h * 0.08 + noise1(x, 30, 5) * h * 0.1 + noise1(x, 7, 6) * 4
      rockEdge(g, 0, w, vault, true, 11)
      const n = Math.round(w / 16)
      for (let i = 0; i < n; i++) {
        const x = Math.round((i + 0.2 + hash2(i, 1, 7) * 0.6) * (w / n))
        const base = Math.round(vault(x)) - 1
        const len = Math.round(h * (0.05 + Math.pow(hash2(i, 2, 7), 2) * 0.22))
        const bw = 2 + Math.round(len * 0.18)
        for (let y = 0; y < len; y++) {
          const half = Math.max(0, Math.round(bw * (1 - y / len)))
          rect(g, ROCK, x - half, base + y, half * 2 + 1, 1)
          rect(g, ROCK_L, x - half, base + y, Math.max(1, half), 1)
          rect(g, '#6a4fb0', x - half, base + y, 1, 1)
          rect(g, ROCK_D, x + half, base + y, 1, 1)
        }
        rect(g, '#8f86b8', x, base + len - 1, 1, 1)
        tips.push({ x, y: base + len })
      }
      // Side walls.
      const wallL = (y: number) => w * (portrait ? 0.14 : 0.12) + noise1(y, 14, 21) * w * 0.07 - Math.max(0, (y - lake * 0.6)) * 0.15
      const wallR = (y: number) => w - (w * (portrait ? 0.14 : 0.12) + noise1(y, 14, 22) * w * 0.07)
      for (let y = 0; y < h; y++) {
        const a = Math.round(wallL(y))
        rect(g, ROCK, 0, y, a, 1)
        rect(g, ROCK_L, a - 3, y, 2, 1)
        rect(g, '#6a4fb0', a - 1, y, 1, 1)
        const b = Math.round(wallR(y))
        rect(g, ROCK, b, y, w - b, 1)
        rect(g, '#6a4fb0', b, y, 1, 1)
        rect(g, ROCK_L, b + 1, y, 2, 1)
        for (let x = 0; x < a - 3; x += 2) { const n = hash2((x + ((y >> 2) & 1) * 3) >> 2, y >> 2, 31); if (n > 0.8) rect(g, ROCK_L, x, y, 2, 1); else if (n < 0.12) rect(g, ROCK_D, x, y, 2, 1) }
        for (let x = b + 3; x < w; x += 2) { const n = hash2((x + ((y >> 2) & 1) * 3) >> 2, y >> 2, 32); if (n > 0.8) rect(g, ROCK_L, x, y, 2, 1); else if (n < 0.12) rect(g, ROCK_D, x, y, 2, 1) }
      }
      // Near shore: a rocky bank along the bottom.
      const shore = (x: number) => h * (portrait ? 0.88 : 0.9) - noise1(x, 20, 41) * h * 0.06 - Math.pow(Math.abs(x / w - 0.5) * 2, 3) * h * 0.14
      rockEdge(g, 0, w, shore, false, 43)
    })
    crys = layer(w, h, g => {
      const add = (x: number, y: number, hh: number, col: typeof CYAN, key: string, salt: number, flip = 1) => {
        const t = paintCrystals(g, x, y, hh, salt, col, flip)
        clusters.push({ x, y: y - hh / 2, col: key, tips: t })
      }
      const s = Math.min(w, h)
      add(Math.round(w * 0.1), Math.round(lake - h * 0.04), Math.round(s * 0.16), CYAN, '#2ff3ff', 3)
      add(Math.round(w * 0.05), Math.round(h * 0.42), Math.round(s * 0.09), VIOLET, '#9a4ff0', 5)
      add(Math.round(w * 0.92), Math.round(lake - h * 0.02), Math.round(s * 0.2), VIOLET, '#9a4ff0', 7, -1)
      add(Math.round(w * 0.95), Math.round(h * 0.34), Math.round(s * 0.08), CYAN, '#2ff3ff', 9, -1)
      add(Math.round(w * 0.18), Math.round(h * 0.97), Math.round(s * 0.22), PINK, '#ff2fa0', 11)
      add(Math.round(w * 0.78), Math.round(h * 0.99), Math.round(s * 0.18), CYAN, '#2ff3ff', 13, -1)
      add(Math.round(w * 0.62), Math.round(h * 0.96), Math.round(s * 0.09), PINK, '#ff2fa0', 15)
      add(Math.round(w * 0.36), Math.round(h * 0.97), Math.round(s * 0.07), VIOLET, '#9a4ff0', 17)
    })
  }

  function draw(g: G, c: FrameCtx, L: Lights) {
    if (!back || !rock || !crys || !copy) return
    g.drawImage(back, 0, 0)
    // The arch's neon in the chord's colour.
    const ac = mix('#2ff3ff', c.accent, 0.6)
    const ax = arch.x - Math.round(arch.w / 2)
    const top = lake - arch.h
    rect(g, ac, ax - 4, top - 2, arch.w + 8, 1)
    rect(g, ac, ax + Math.round(arch.w / 2), top - 1, 1, 1)
    L.emit(ax - 4, top - 2, arch.w + 8, 1)
    L.light(arch.x, top, arch.w * 1.2, ac, 0.3 + 0.1 * c.beat)
    L.light(arch.x, lake - arch.h * 0.4, arch.w * 0.9, '#3a2a8a', 0.4)
    // Motes rising slowly.
    for (let i = 0; i < 14 + Math.round(c.energy * 10); i++) {
      const life = 8 + hash2(i, 1, 5) * 6
      const ph = wrap(c.t / life + hash2(i, 2, 5), 1)
      const x = Math.round(W * (0.15 + hash2(i, 3, 5) * 0.7) + Math.sin(c.t * 0.4 + i) * 4)
      const y = Math.round(lake - ph * lake * 0.8)
      const a = Math.sin(ph * Math.PI)
      if (a < 0.2) continue
      rect(g, a > 0.6 ? '#cfa0ff' : '#6a4fb0', x, y, 1, 1)
      L.emit(x, y, 1, 1)
    }
    g.drawImage(rock, 0, 0)
    g.drawImage(crys, 0, 0)
    L.emitImage(crys)
    for (let i = 0; i < clusters.length; i++) {
      const cl = clusters[i]!
      const breathe = 0.5 + 0.5 * Math.sin(c.t * 0.7 + i * 1.3)
      L.light(cl.x, cl.y, 28 + breathe * 6, cl.col, 0.3 + 0.1 * breathe + 0.14 * c.beat)
    }
    // Drips from the stalactite tips into the lake.
    if (c.t > nextDrop && tips.length) {
      const tip = tips[Math.floor(Math.random() * tips.length)]!
      if (tip.x > W * 0.2 && tip.x < W * 0.8) drops.push({ x: tip.x, y: tip.y, vy: 0, tipY: tip.y })
      nextDrop = c.t + 0.6 + Math.random() * (1.6 - c.energy * 0.6)
    }
    for (let i = drops.length - 1; i >= 0; i--) {
      const d = drops[i]!
      d.vy += c.dt * 160
      d.y += d.vy * c.dt
      if (d.y >= lake) { ripples.push({ x: d.x, age: 0 }); drops.splice(i, 1); continue }
      rect(g, '#7ce4ff', Math.round(d.x), Math.round(d.y), 1, 2)
    }
    // The lake mirrors the cave above it.
    copy.getContext('2d')!.drawImage(g.canvas, 0, 0, W, lake, 0, 0, W, lake)
    rect(g, '#05030b', 0, lake, W, H - lake)
    mirror(g, copy, lake, lake, H, W, c.t * 0.6, 0.6, '#0b1434', 0.35)
    mirrorLights(L, lake, lake, 1, 0.45, H)
    rect(g, '#2c2058', 0, lake, W, 1)
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i]!
      r.age += c.dt
      if (r.age > 1.6) { ripples.splice(i, 1); continue }
      const rad = Math.round(1 + r.age * 9)
      const a = 1 - r.age / 1.6
      g.globalAlpha = a
      g.fillStyle = '#7ce4ff'
      g.fillRect(Math.round(r.x - rad), lake + 1 + Math.round(r.age * 2), rad * 2 + 1, 1)
      g.fillStyle = '#05030b'
      if (rad > 2) g.fillRect(Math.round(r.x - rad + 2), lake + 1 + Math.round(r.age * 2), rad * 2 - 3, 1)
      g.globalAlpha = 1
    }
    // The near bank and its crystals over the lake.
    g.drawImage(rock, 0, Math.round(H * 0.8), W, H - Math.round(H * 0.8), 0, Math.round(H * 0.8), W, H - Math.round(H * 0.8))
    g.drawImage(crys, 0, Math.round(H * 0.8), W, H - Math.round(H * 0.8), 0, Math.round(H * 0.8), W, H - Math.round(H * 0.8))
    // Notes glint on the crystal tip nearest their pitch.
    for (const n of c.notes) {
      if (!melodic(n.layer)) continue
      const want = H * (0.95 - n.h * 0.7)
      let best: { x: number; y: number } | null = null
      let bd = Infinity
      for (const cl of clusters) for (const t of cl.tips) {
        const d = Math.abs(t.y - want) + Math.random() * 20
        if (d < bd) { bd = d; best = t }
      }
      if (best) spawnSpark(sparks, best.x, best.y, n.layer === 'bells' ? '#fff4ff' : '#e8fbff', n.layer === 'bells', 0.9)
    }
    drawSparks(g, sparks, c.dt, L, 0.4)
  }

  return {
    layout,
    draw,
    ambient: c => mix(mix('#8a80c0', '#6a60a0', c.dark * 0.5), '#b0a4dc', c.energy * 0.1),
    horizon: () => lake,
  }
}
