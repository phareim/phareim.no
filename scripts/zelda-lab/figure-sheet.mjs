#!/usr/bin/env node
// Neon Shrine figure lab: the 16-bit view's hero model (render/iso/figure.ts)
// on contact sheets, no browser needed (the figure renders into typed arrays;
// this writes the PNGs itself).
//
//   node scripts/zelda-lab/figure-sheet.mjs <outDir> [sheet …]
//
// Without sheet names it writes all five:
//   figure-turn.png     idle at 16 yaws, a walk cycle at 4 yaws, every other act (4× on dusk ground, a one-tile ellipse under each)
//   figure-swing.png    the swing at 6 moments in 8 directions, sword and Arc Blade; a spin at 8 moments; a charged blade
//   figure-looks.png    the drawn look, the girl and one of each hair, headwear and bottom, from the front, the side and behind
//   figure-lit.png      a few poses as colour, as the engine will light them from the normals, and the normals themselves
//   figure-compare.png  the classic hero's frames at 2× beside the figure at 1×, the size they share on screen
// and prints the average ms per frame for a walk and for a swing.
// A sheet name is `turn`, `swing`, `looks`, `lit` or `compare`. ZOOM=<n> overrides a sheet's zoom.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../themes/zelda')

export async function loadFigure() {
  const built = esbuild.buildSync({
    stdin: {
      contents: `export * from './render/iso/figure'; export * from './render/heroFrames'; export * from './render/heroLook'; export { PAL } from './render/sprites'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(built.outputFiles[0].text).toString('base64'))
}

const hex = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** The dusk ground every figure stands on, and the one-tile ellipse under it. */
export const DUSK = '#1f4a68'
const TILE_RING = '#2b5d7c'

/** A picture to draw cells on. */
export class Sheet {
  constructor(w, h, bg = '#0b0616') {
    this.w = w
    this.h = h
    this.px = Buffer.alloc(w * h * 4)
    this.fill(0, 0, w, h, bg)
  }

  fill(x, y, w, h, color) {
    const [r, g, b] = typeof color === 'string' ? hex(color) : color
    for (let yy = Math.max(0, y); yy < Math.min(this.h, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(this.w, x + w); xx++) {
        const i = (yy * this.w + xx) * 4
        this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b; this.px[i + 3] = 255
      }
    }
  }

  /**
   * One cell: ground, the tile ellipse, and a window of the sprite at `zoom`.
   * `crop` is the window in sprite px: [x0, y0, w, h]. `mode` is 'albedo',
   * 'normal' or 'lit'. A trail's alpha is shown as the ordered dither the
   * engine makes of it.
   */
  cell(x, y, sprite, crop, zoom, mode = 'albedo', ground = DUSK) {
    const [cx, cy, cw, ch] = crop
    this.fill(x, y, cw * zoom, ch * zoom, ground)
    const ring = hex(TILE_RING)
    for (let sy = 0; sy < ch; sy++) {
      for (let sx = 0; sx < cw; sx++) {
        const X = cx + sx
        const Y = cy + sy
        // A circle one tile across on the ground: 2:1 on the screen, 45.25 px wide.
        const ex = (X + 0.5 - sprite.ax) / 22.63
        const ey = (Y + 0.5 - sprite.ay) / 11.31
        if (mode !== 'normal' && ex * ex + ey * ey < 1) this.fill(x + sx * zoom, y + sy * zoom, zoom, zoom, ring)
        if (X < 0 || Y < 0 || X >= sprite.w || Y >= sprite.h) continue
        const i = (Y * sprite.w + X) * 4
        const a = sprite.albedo[i + 3]
        if (!a) continue
        if (a < 255 && (a / 255) * 16 <= BAYER[(Y & 3) * 4 + (X & 3)] + 0.5) continue
        let c
        if (mode === 'normal') c = [sprite.normal[i], sprite.normal[i + 1], sprite.normal[i + 2]]
        else if (mode === 'lit') c = lit(sprite, i)
        else c = [sprite.albedo[i], sprite.albedo[i + 1], sprite.albedo[i + 2]]
        this.fill(x + sx * zoom, y + sy * zoom, zoom, zoom, c)
      }
    }
  }

  save(path) {
    const { w, h, px } = this
    const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
    const crc = buf => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
      const body = Buffer.concat([Buffer.from(type), data])
      const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body))
      return Buffer.concat([len, body, sum])
    }
    const head = Buffer.alloc(13)
    head.writeUInt32BE(w, 0); head.writeUInt32BE(h, 4); head[8] = 8; head[9] = 6
    const raw = Buffer.alloc((w * 4 + 1) * h)
    for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
    writeFileSync(path, Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', head), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
    ]))
    console.log(`${path} (${w}×${h})`)
  }
}

// The engine's light on a figure, near enough: ambient dusk, a magenta light
// from the left and a cyan one from the right, each falling in four steps.
const AMBIENT = hex('#8e82c4').map(v => v / 255)
const LIGHTS = [
  { dir: norm([-0.72, 0.38, 0.58]), color: hex('#ff4fd0').map(v => v / 255 * 0.75) },
  { dir: norm([0.76, 0.3, 0.58]), color: hex('#3fe8ff').map(v => v / 255 * 0.65) },
]
function norm(v) { const l = Math.hypot(...v); return v.map(c => c / l) }
function lit(sprite, i) {
  const n = [0, 1, 2].map(k => sprite.normal[i + k] / 127.5 - 1)
  const glow = sprite.normal[i + 3] / 255
  const light = [...AMBIENT]
  for (const L of LIGHTS) {
    const f = Math.floor(Math.max(0, n[0] * L.dir[0] + n[1] * L.dir[1] + n[2] * L.dir[2]) * 4 + 0.5) / 4
    for (let k = 0; k < 3; k++) light[k] += f * L.color[k]
  }
  return [0, 1, 2].map(k => Math.min(255, Math.round(sprite.albedo[i + k] * (light[k] * (1 - glow) + glow))))
}

// The engine's swing: SWORD_ARC wide, eased out (engine/hero.ts `swingAngle`).
const ARC = Math.PI * 0.95
const swingAngle = (base, p) => base - ARC / 2 + ARC * (1 - (1 - Math.min(1, Math.max(0, p))) ** 2)

export function swingPose(base, p, kind = 'sword') {
  const trail = []
  for (let k = 1; k <= 4; k++) if (p - k * 0.06 > -0.06) trail.push(swingAngle(base, p - k * 0.06))
  return { yaw: base, act: 'swing', t: p, blade: { a: swingAngle(base, p), reach: kind === 'arc' ? 1.4 : 1.2, trail, kind, charge: 0, flash: false } }
}

export function spinPose(base, p, kind = 'sword') {
  const a = base + p * Math.PI * 2
  const trail = []
  for (let k = 1; k <= 10; k++) if (p * Math.PI * 2 - k * 0.22 > -0.1) trail.push(a - k * 0.22)
  return { yaw: base, act: 'spin', t: p, blade: { a, reach: 1.55, trail, kind, charge: 0, flash: false } }
}

/** The window of the cell a standing figure needs, and the whole cell. */
const BODY = [52, 20, 56, 60]
const WIDE = [30, 8, 100, 80]

function sheetTurn(M, zoom) {
  const [, , cw, ch] = BODY
  const gap = 2
  const cols = 8
  const rows = 2 + 4 + 5
  const s = new Sheet(cols * (cw * zoom + gap) + gap, rows * (ch * zoom + gap) + gap)
  const at = (c, r) => [gap + c * (cw * zoom + gap), gap + r * (ch * zoom + gap)]
  const look = M.DRAWN_LOOK
  let r = 0
  for (let k = 0; k < 16; k++) s.cell(...at(k % 8, r + (k >> 3)), M.renderFigure({ yaw: k * Math.PI / 8, act: 'idle', t: 0 }, look), BODY, zoom)
  r += 2
  for (const [j, yaw] of [Math.PI / 4, Math.PI * 0.75, -Math.PI / 4, -Math.PI * 0.75].entries()) {
    for (let k = 0; k < 8; k++) s.cell(...at(k, r + j), M.renderFigure({ yaw, act: 'walk', t: k / 8 }, look), BODY, zoom)
  }
  r += 4
  const front = Math.PI / 4 + 0.5
  const back = -Math.PI / 2
  const acts = [
    [
      { act: 'lift', t: 0 }, { act: 'lift', t: 0.35 }, { act: 'lift', t: 0.7 }, { act: 'lift', t: 1 },
      { act: 'carry', t: 0 }, { act: 'carry', t: 0.25, moving: true }, { act: 'carry', t: 0.75, moving: true }, { act: 'get', t: 1 },
    ],
    [
      { act: 'push', t: 0 }, { act: 'push', t: 0.25 }, { act: 'push', t: 0.75 }, { act: 'use', t: 0.1 },
      { act: 'use', t: 0.25 }, { act: 'use', t: 0.8 }, { act: 'hurt', t: 0 }, { act: 'hurt', t: 0.8 },
    ],
  ]
  for (const yaw of [front, back]) {
    for (const line of acts) {
      line.forEach((p, k) => s.cell(...at(k, r), M.renderFigure({ yaw, ...p }, look), BODY, zoom))
      r++
    }
  }
  const ends = [
    { act: 'fall', t: 0 }, { act: 'fall', t: 0.3 }, { act: 'fall', t: 0.6 }, { act: 'fall', t: 0.85 },
    { act: 'dead', t: 0.12 }, { act: 'dead', t: 0.3 }, { act: 'dead', t: 0.42 }, { act: 'dead', t: 1 },
  ]
  ends.forEach((p, k) => s.cell(...at(k, r), M.renderFigure({ yaw: front, ...p }, look), BODY, zoom))
  return s
}

function sheetSwing(M, zoom) {
  const cw = M.FIG.w
  const ch = M.FIG.h
  const full = [0, 0, cw, ch]
  const gap = 2
  const cols = 6
  const rows = 8 + 8 + 2 + 2
  const s = new Sheet(cols * (cw * zoom + gap) + gap, rows * (ch * zoom + gap) + gap)
  const at = (c, r) => [gap + c * (cw * zoom + gap), gap + r * (ch * zoom + gap)]
  const look = M.DRAWN_LOOK
  let r = 0
  for (const kind of ['sword', 'arc']) {
    for (let d = 0; d < 8; d++) {
      for (let k = 0; k < 6; k++) s.cell(...at(k, r), M.renderFigure(swingPose(d * Math.PI / 4, [0.04, 0.18, 0.36, 0.56, 0.78, 1][k], kind), look), full, zoom)
      r++
    }
  }
  for (let k = 0; k < 8; k++) s.cell(...at(k % 4, r + (k >> 2)), M.renderFigure(spinPose(Math.PI / 2, (k + 0.5) / 8), look), full, zoom)
  s.cell(...at(4, r), M.renderFigure(spinPose(0, 0.5, 'arc'), look), full, zoom)
  s.cell(...at(5, r), M.renderFigure(spinPose(Math.PI, 0.9, 'arc'), look), full, zoom)
  s.cell(...at(4, r + 1), M.renderFigure(spinPose(-Math.PI / 2, 0.25, 'arc'), look), full, zoom)
  s.cell(...at(5, r + 1), M.renderFigure(spinPose(Math.PI / 2, 0.7, 'arc'), look), full, zoom)
  r += 2
  const held = (yaw, act, t, kind, charge, flash) => ({ yaw, act, t, blade: { a: yaw, reach: kind === 'arc' ? 1.4 : 1.2, trail: [], kind, charge, flash } })
  const charged = [
    held(Math.PI / 2, 'idle', 0, 'sword', 0.15, false), held(Math.PI / 2, 'idle', 0, 'sword', 0.6, false), held(Math.PI / 2, 'idle', 0, 'sword', 1, true),
    held(0, 'walk', 0.25, 'sword', 1, true), held(-Math.PI / 2, 'walk', 0.5, 'sword', 1, false), held(Math.PI, 'idle', 0, 'sword', 1, true),
    held(Math.PI / 2, 'idle', 0, 'arc', 0.15, false), held(Math.PI / 2, 'idle', 0, 'arc', 0.6, false), held(Math.PI / 2, 'idle', 0, 'arc', 1, true),
    held(0, 'walk', 0.25, 'arc', 1, true), held(-Math.PI / 2, 'walk', 0.5, 'arc', 1, false), held(Math.PI, 'idle', 0, 'arc', 1, true),
  ]
  charged.forEach((p, k) => s.cell(...at(k % 6, r + Math.floor(k / 6)), M.renderFigure(p, look), full, zoom))
  return s
}

function looksOf(M) {
  const shape = (hair, head, bottom) => M.parseHeroLook({ ...M.DRAWN_LOOK, hair, head, bottom })
  return [
    M.DRAWN_LOOK, M.GIRL_LOOK,
    shape('long', 'band', 'shorts'), shape('tail', 'band', 'skirt'), shape('tail', 'bow', 'trousers'),
    shape('pigtails', 'bow', 'dress'), shape('pigtails', 'band', 'shorts'), shape('short', 'none', 'skirt'), shape('long', 'none', 'dress'),
    // Other colours, so the ramps are seen on dark and on pale.
    { ...shape('tail', 'none', 'shorts'), skin: '#80492b', hairColor: '#ffd23f', top: '#ff3b5c', stripe: '#1c1030', belt: '#fff4ff', bottomColor: '#4f9a2a', shoes: '#1c1030' },
    { ...shape('pigtails', 'bow', 'skirt'), skin: '#ffe3d2', hairColor: '#1c1030', headColor: '#b6ff4a', top: '#fff4ff', stripe: '#ff2fa0', belt: '#9a4ff0', bottomColor: '#ff8a3d', shoes: '#2f5fd0' },
  ]
}

function sheetLooks(M, zoom) {
  const [, , cw, ch] = BODY
  const gap = 2
  const looks = looksOf(M)
  const views = [
    { yaw: Math.PI / 4, act: 'idle', t: 0 }, { yaw: Math.PI / 4 + 0.6, act: 'idle', t: 0 }, { yaw: Math.PI * 0.75, act: 'idle', t: 0 },
    { yaw: Math.PI * 1.25 - 0.5, act: 'idle', t: 0 }, { yaw: Math.PI * 1.25, act: 'idle', t: 0 }, { yaw: -Math.PI / 4, act: 'walk', t: 0.25 },
    { yaw: Math.PI / 4 - 0.4, act: 'walk', t: 0.75 }, { yaw: 0, act: 'get', t: 1 },
  ]
  const s = new Sheet(views.length * (cw * zoom + gap) + gap, looks.length * (ch * zoom + gap) + gap)
  looks.forEach((look, r) => views.forEach((p, c) => s.cell(gap + c * (cw * zoom + gap), gap + r * (ch * zoom + gap), M.renderFigure(p, look), BODY, zoom, 'albedo', r % 2 ? '#3b2b62' : DUSK)))
  return s
}

function sheetLit(M, zoom) {
  const [, , cw, ch] = WIDE
  const gap = 2
  const poses = [
    { yaw: Math.PI / 4, act: 'idle', t: 0 }, { yaw: Math.PI * 1.25, act: 'idle', t: 0 }, { yaw: -Math.PI / 4, act: 'walk', t: 0.25 },
    swingPose(Math.PI / 4, 0.4), { yaw: Math.PI * 0.75, act: 'carry', t: 0 }, { yaw: Math.PI / 4, act: 'hurt', t: 0 },
  ]
  const s = new Sheet(poses.length * (cw * zoom + gap) + gap, 3 * (ch * zoom + gap) + gap)
  poses.forEach((p, c) => {
    const look = c % 2 ? M.GIRL_LOOK : M.DRAWN_LOOK
    ;['albedo', 'lit', 'normal'].forEach((mode, r) => s.cell(gap + c * (cw * zoom + gap), gap + r * (ch * zoom + gap), M.renderFigure(p, look), WIDE, zoom, mode, mode === 'normal' ? '#808080' : DUSK))
  })
  return s
}

function sheetCompare(M, zoom) {
  // Pairs: a classic frame (two px for each of its own) and the figure in the same pose, at the same size on screen.
  const E = -Math.PI / 4 // faces the right of the screen
  const pairs = [
    ['hero_down_0', { yaw: Math.PI / 4, act: 'idle', t: 0 }], ['hero_down_1', { yaw: Math.PI / 4, act: 'walk', t: 0.25 }],
    ['hero_side_0', { yaw: E, act: 'idle', t: 0 }], ['hero_side_1', { yaw: E, act: 'walk', t: 0.25 }],
    ['hero_up_0', { yaw: Math.PI * 1.25, act: 'idle', t: 0 }], ['hero_up_1', { yaw: Math.PI * 1.25, act: 'walk', t: 0.25 }],
    ['hero_down_atk', { yaw: Math.PI / 4, act: 'use', t: 0.25 }], ['hero_side_atk', { yaw: E, act: 'use', t: 0.25 }],
    ['hero_down_carry_0', { yaw: Math.PI / 4, act: 'carry', t: 0 }], ['hero_side_carry_0', { yaw: E, act: 'carry', t: 0 }],
    ['hero_down_push', { yaw: Math.PI / 4, act: 'push', t: 0 }], ['hero_side_push', { yaw: E, act: 'push', t: 0 }],
    ['hero_get', { yaw: 0, act: 'get', t: 1 }], ['hero_hurt', { yaw: Math.PI / 4, act: 'hurt', t: 0 }],
    ['hero_fall_1', { yaw: Math.PI / 4, act: 'fall', t: 0.5 }], ['hero_dead', { yaw: 0, act: 'dead', t: 1 }],
  ]
  const looks = [M.DRAWN_LOOK, M.GIRL_LOOK]
  const [, , cw, ch] = BODY
  const gap = 2
  const cols = 8
  const lines = Math.ceil(pairs.length / cols)
  const s = new Sheet(cols * (cw * zoom + gap) + gap, looks.length * lines * 2 * (ch * zoom + gap) + gap)
  looks.forEach((look, li) => {
    const pal = { ...M.PAL, ...M.lookPalette(look) }
    const frames = M.heroFrames(look)
    pairs.forEach(([name, pose], k) => {
      const x = gap + (k % cols) * (cw * zoom + gap)
      const y = gap + (li * lines + Math.floor(k / cols)) * 2 * (ch * zoom + gap)
      // The classic frame, its feet on the same ground point.
      s.cell(x, y, { w: 1, h: 1, ax: 28, ay: 46, albedo: [0, 0, 0, 0], normal: [] }, [0, 0, cw, ch], zoom)
      frames[name].forEach((row, fy) => {
        for (let fx = 0; fx < row.length; fx++) {
          const c = pal[row[fx]]
          if (c) s.fill(x + (28 - 16 + fx * 2) * zoom, y + (46 - 30 + fy * 2) * zoom, zoom * 2, zoom * 2, c)
        }
      })
      s.cell(x, y + ch * zoom + gap, M.renderFigure(pose, look), BODY, zoom)
    })
  })
  return s
}

function timing(M) {
  const out = M.renderFigure({ yaw: 0, act: 'idle', t: 0 }, M.DRAWN_LOOK)
  const run = (n, pose) => {
    for (let k = 0; k < 300; k++) M.renderFigure(pose(k), M.DRAWN_LOOK, out)
    const t0 = performance.now()
    for (let k = 0; k < n; k++) M.renderFigure(pose(k), M.DRAWN_LOOK, out)
    return (performance.now() - t0) / n
  }
  const walk = run(4000, k => ({ yaw: k * 0.013, act: 'walk', t: k / 60 }))
  const swing = run(4000, k => swingPose((k % 8) * Math.PI / 4, 0.3 + (k % 40) / 60))
  const spin = run(4000, k => spinPose(0, (k % 50) / 50))
  console.log(`walk ${walk.toFixed(3)} ms/frame · swing with its trail ${swing.toFixed(3)} ms/frame · spin with a full trail ${spin.toFixed(3)} ms/frame`)
}

const SHEETS = { turn: [sheetTurn, 4], swing: [sheetSwing, 2], looks: [sheetLooks, 4], lit: [sheetLit, 4], compare: [sheetCompare, 4] }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [outArg, ...names] = process.argv.slice(2)
  if (!outArg) { console.error('usage: figure-sheet.mjs <outDir> [turn|swing|looks|lit|compare …]'); process.exit(2) }
  const dir = resolve(outArg)
  mkdirSync(dir, { recursive: true })
  const M = await loadFigure()
  for (const name of names.length ? names : Object.keys(SHEETS)) {
    const def = SHEETS[name]
    if (!def) { console.error('no such sheet: ' + name); process.exit(2) }
    def[0](M, +(process.env.ZOOM || def[1])).save(join(dir, `figure-${name}.png`))
  }
  timing(M)
}
