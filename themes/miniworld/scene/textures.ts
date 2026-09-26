/**
 * Mini World's canvas textures (avatar/house agent): faces, clothing
 * patterns, floors, wallpapers, name tags. All pixel-crisp: small canvases,
 * NearestFilter, no mipmaps, cached by key. Pattern painters work on any
 * 2D context so the avatar's body atlas (clothes.ts) and the tiled 3D
 * pieces share one look.
 */
import * as THREE from 'three'
import type { EyesId, MouthId, Pattern, SurfaceDef, RoyalTitle } from '../types'
import { RAINBOW } from '../catalog'
import { drawText, textWidth } from '../../zelda/render/font'

export type Colors = { main: string; second?: string; accent?: string }

// ---------------------------------------------------------------- basics

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** A nearest-filtered sRGB texture over a canvas. `repeat` sets wrapping. */
export function pixelTexture(c: HTMLCanvasElement, repeat = false): THREE.CanvasTexture {
  const t = new THREE.CanvasTexture(c)
  t.magFilter = THREE.NearestFilter
  t.minFilter = THREE.NearestFilter
  t.generateMipmaps = false
  t.colorSpace = THREE.SRGBColorSpace
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping }
  t.needsUpdate = true
  return t
}

const texCache = new Map<string, THREE.CanvasTexture>()
/** Cached texture by key; `draw` paints a fresh canvas once. Cached textures are shared: never dispose them. */
export function cachedTexture(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, repeat = false): THREE.CanvasTexture {
  let t = texCache.get(key)
  if (!t) {
    const c = makeCanvas(w, h)
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    draw(g)
    t = pixelTexture(c, repeat)
    t.userData.shared = true
    texCache.set(key, t)
  }
  return t
}

const px = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  g.fillStyle = color
  g.fillRect(x, y, w, h)
}

// ---------------------------------------------------------------- patterns

const STAR = ['..#..', '.###.', '#####', '.###.', '.#.#.']
const HEART = ['##.##', '#####', '#####', '.###.', '..#..']
const FLOWER = ['.#.', '#o#', '.#.']
const FLAKE = ['#.#.#', '.###.', '##o##', '.###.', '#.#.#']

function stamp(g: CanvasRenderingContext2D, rows: string[], x: number, y: number, c: string, o: string, clip: [number, number, number, number]) {
  for (let r = 0; r < rows.length; r++) {
    for (let k = 0; k < rows[r]!.length; k++) {
      const ch = rows[r]![k]
      if (ch === '.') continue
      const X = x + k, Y = y + r
      if (X < clip[0] || Y < clip[1] || X >= clip[0] + clip[2] || Y >= clip[1] + clip[3]) continue
      px(g, X, Y, 1, 1, ch === 'o' ? o : c)
    }
  }
}

/**
 * Fill a rectangle with a pattern: main as the ground, second for the
 * motif, accent for centres. `vertical` turns stripes and rainbow bands
 * upright (wallpaper). Motifs are placed on a grid anchored at the
 * rectangle's corner, so each body face starts clean.
 */
export function paintPattern(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, pattern: Pattern | undefined, colors: Colors, vertical = false): void {
  const main = colors.main
  const second = colors.second ?? (pattern === 'plain' || !pattern ? main : '#ffffff')
  const accent = colors.accent ?? '#ffe14f'
  const clip: [number, number, number, number] = [x, y, w, h]
  px(g, x, y, w, h, main)
  switch (pattern) {
    case undefined:
    case 'plain':
      return
    case 'stripes':
      if (vertical) { for (let i = 3; i < w; i += 6) px(g, x + i, y, Math.min(3, w - i), h, second) } else { for (let i = 3; i < h; i += 6) px(g, x, y + i, w, Math.min(2, h - i), second) }
      return
    case 'dots':
      for (let j = 0; j < h; j += 6) for (let i = 0; i < w; i += 6) {
        const ox = (j / 6) % 2 ? 3 : 0
        const X = x + i + 1 + ox, Y = y + j + 1
        if (X + 2 <= x + w && Y + 2 <= y + h) px(g, X, Y, 2, 2, second)
      }
      return
    case 'stars':
      for (let j = 0; j < h; j += 9) for (let i = 0; i < w; i += 10) {
        const ox = (j / 9) % 2 ? 5 : 0
        stamp(g, STAR, x + i + 1 + ox - (ox ? 10 : 0), y + j + 2, second, accent, clip)
        if (ox) stamp(g, STAR, x + i + 1 + ox, y + j + 2, second, accent, clip)
        const dx = x + i + 8 - ox, dy = y + j + 7
        if (dx < x + w && dy < y + h && dx >= x) px(g, dx, dy, 1, 1, second)
      }
      return
    case 'hearts':
      for (let j = 0; j < h; j += 8) for (let i = -4; i < w; i += 8) {
        const ox = (j / 8) % 2 ? 4 : 0
        stamp(g, HEART, x + i + 1 + ox, y + j + 1, second, accent, clip)
      }
      return
    case 'checks':
      for (let j = 0; j < h; j += 4) for (let i = 0; i < w; i += 4) {
        if (((i + j) / 4) % 2) px(g, x + i, y + j, Math.min(4, w - i), Math.min(4, h - j), second)
      }
      return
    case 'rainbow': {
      const band = 3
      const n = vertical ? w : h
      for (let i = 0; i < n; i += band) {
        const c = RAINBOW[(i / band) % RAINBOW.length]!
        if (vertical) px(g, x + i, y, Math.min(band, w - i), h, c)
        else px(g, x, y + i, w, Math.min(band, h - i), c)
      }
      return
    }
    case 'sparkle':
      for (let j = 0; j < h; j += 6) for (let i = 0; i < w; i += 6) {
        const ox = (j / 6) % 2 ? 3 : 0
        const X = x + i + 2 + ox, Y = y + j + 2
        if (X >= x + w || Y >= y + h) continue
        const big = ((i + j) / 6) % 3 === 0
        if (big) stamp(g, ['.#.', '#o#', '.#.'], X - 1, Y - 1, second, '#ffffff', clip)
        else px(g, X, Y, 1, 1, (i + j) % 12 ? second : '#ffffff')
      }
      return
    case 'flowers':
      for (let j = 0; j < h; j += 7) for (let i = 0; i < w; i += 7) {
        const ox = (j / 7) % 2 ? 3 : 0
        stamp(g, FLOWER, x + i + 1 + ox, y + j + 1, second, accent, clip)
        const lx = x + i + 4 + ox, ly = y + j + 4
        if (lx < x + w && ly < y + h) px(g, lx, ly, 1, 1, colors.accent ? '#3fb870' : darkenHex(main))
      }
      return
    case 'snow':
      // A knit band at the top and flakes below.
      for (let i = 0; i < w; i++) if ((i % 4 === 0 || i % 4 === 2) && h > 3) px(g, x + i, y + 1 + (i % 4 === 2 ? 1 : 0), 1, 1, second)
      for (let j = 5; j < h; j += 8) for (let i = 0; i < w; i += 8) {
        const ox = (j / 8) % 2 ? 0 : 4
        stamp(g, FLAKE, x + i + ox - 1, y + j, second, second, clip)
      }
      return
  }
}

function darkenHex(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const d = (s: number) => Math.round(((n >> s) & 255) * 0.72)
  return '#' + ((1 << 24) | (d(16) << 16) | (d(8) << 8) | d(0)).toString(16).slice(1)
}

/**
 * A repeating tile of a pattern, for 3D pieces mapped with `worldUV` at
 * `PATTERN_DENSITY` repeats per unit (one tile = 24 px, one unit at the
 * body atlas' 24 px per unit).
 */
export const PATTERN_DENSITY = 1
export function patternTile(pattern: Pattern | undefined, colors: Colors): THREE.CanvasTexture {
  const key = `pat|${pattern ?? 'plain'}|${colors.main}|${colors.second ?? ''}|${colors.accent ?? ''}`
  const size = pattern === 'rainbow' ? 18 : pattern === 'stars' ? 20 : pattern === 'flowers' ? 14 : pattern === 'hearts' ? 16 : 24
  return cachedTexture(key, size, size, g => paintPattern(g, 0, 0, size, size, pattern, colors), true)
}
/** Tile repeats per unit for `patternTile(pattern)` so every pattern draws at 24 px per unit. */
export function patternDensity(pattern: Pattern | undefined): number {
  const size = pattern === 'rainbow' ? 18 : pattern === 'stars' ? 20 : pattern === 'flowers' ? 14 : pattern === 'hearts' ? 16 : 24
  return 24 / size
}

// ---------------------------------------------------------------- faces

/** Face canvas size; the head's front is 0.64 × 0.6 units. */
export const FACE_W = 20
export const FACE_H = 18
const INK = '#2a2230'
const WHITE = '#ffffff'

function drawEyes(g: CanvasRenderingContext2D, eyes: EyesId, blink: boolean) {
  const L = 5, R = 13, Y = 7
  const closed = (x: number) => { px(g, x - 1, Y + 2, 4, 1, INK) }
  if (blink && eyes !== 'happy') {
    closed(L); closed(R)
    if (eyes === 'lashes') { px(g, L - 2, Y + 1, 1, 1, INK); px(g, R + 3, Y + 1, 1, 1, INK) }
    return
  }
  switch (eyes) {
    case 'dots':
      px(g, L, Y + 1, 2, 3, INK); px(g, R, Y + 1, 2, 3, INK)
      px(g, L, Y + 1, 1, 1, WHITE); px(g, R, Y + 1, 1, 1, WHITE)
      return
    case 'big':
      for (const x of [L - 1, R - 1]) {
        px(g, x, Y, 4, 5, INK)
        px(g, x + 1, Y - 1, 2, 1, INK)
        px(g, x + 1, Y + 1, 2, 3, '#4a3a8a')
        px(g, x + 1, Y + 1, 1, 1, WHITE)
        px(g, x + 2, Y + 3, 1, 1, WHITE)
      }
      return
    case 'happy':
      for (const x of [L - 1, R - 1]) {
        px(g, x, Y + 3, 1, 1, INK); px(g, x + 1, Y + 2, 2, 1, INK); px(g, x + 3, Y + 3, 1, 1, INK)
      }
      return
    case 'lashes':
      px(g, L, Y + 1, 2, 3, INK); px(g, R, Y + 1, 2, 3, INK)
      px(g, L, Y + 1, 1, 1, WHITE); px(g, R, Y + 1, 1, 1, WHITE)
      px(g, L - 1, Y, 1, 1, INK); px(g, L - 2, Y - 1, 1, 1, INK)
      px(g, R + 2, Y, 1, 1, INK); px(g, R + 3, Y - 1, 1, 1, INK)
      return
    case 'wink':
      px(g, L, Y + 1, 2, 3, INK); px(g, L, Y + 1, 1, 1, WHITE)
      px(g, R - 1, Y + 1, 1, 1, INK); px(g, R, Y + 2, 2, 1, INK); px(g, R - 1, Y + 3, 1, 1, INK)
      return
  }
}

function drawMouth(g: CanvasRenderingContext2D, mouth: MouthId) {
  const Y = 12
  switch (mouth) {
    case 'smile':
      px(g, 7, Y, 1, 1, INK); px(g, 8, Y + 1, 4, 1, INK); px(g, 12, Y, 1, 1, INK)
      return
    case 'grin':
      px(g, 6, Y, 8, 1, INK); px(g, 7, Y + 1, 6, 1, INK); px(g, 8, Y + 2, 4, 1, INK)
      px(g, 7, Y, 6, 1, WHITE)
      px(g, 9, Y + 1, 2, 1, '#e0506a')
      return
    case 'open':
      px(g, 8, Y, 4, 1, INK); px(g, 7, Y + 1, 1, 2, INK); px(g, 12, Y + 1, 1, 2, INK); px(g, 8, Y + 3, 4, 1, INK)
      px(g, 8, Y + 1, 4, 2, '#b0304a')
      px(g, 9, Y + 2, 2, 1, '#ff7f9f')
      return
    case 'tongue':
      px(g, 7, Y, 1, 1, INK); px(g, 8, Y + 1, 4, 1, INK); px(g, 12, Y, 1, 1, INK)
      px(g, 9, Y + 2, 2, 2, '#ff6f9f'); px(g, 9, Y + 2, 1, 1, '#ff9fbf')
      return
    case 'cat':
      px(g, 7, Y, 1, 1, INK); px(g, 8, Y + 1, 1, 1, INK); px(g, 9, Y, 2, 1, INK); px(g, 11, Y + 1, 1, 1, INK); px(g, 12, Y, 1, 1, INK)
      px(g, 9, Y - 2, 2, 1, '#e0708a')
      return
  }
}

/** The face decal (transparent around the features), with an optional blink frame. */
export function faceTexture(eyes: EyesId, mouth: MouthId, cheeks: boolean, blink = false): THREE.CanvasTexture {
  return cachedTexture(`face|${eyes}|${mouth}|${cheeks ? 1 : 0}|${blink ? 1 : 0}`, FACE_W, FACE_H, (g) => {
    if (cheeks) {
      px(g, 2, 11, 3, 1, 'rgba(255,110,150,0.75)'); px(g, 15, 11, 3, 1, 'rgba(255,110,150,0.75)')
      px(g, 3, 12, 1, 1, 'rgba(255,110,150,0.4)'); px(g, 16, 12, 1, 1, 'rgba(255,110,150,0.4)')
    }
    drawEyes(g, eyes, blink)
    drawMouth(g, mouth)
  })
}

// ---------------------------------------------------------------- floors and walls

/** Pixels per house cell on floors and walls. */
export const SURFACE_PX = 24

function seeded(seed: number) {
  let s = seed || 1
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647 }
}

/** A floor tile (one cell, repeats) for a SurfaceDef. */
export function floorTexture(def: SurfaceDef): THREE.CanvasTexture {
  const S = SURFACE_PX
  const m = def.colors.main, s2 = def.colors.second ?? darkenHex(m)
  return cachedTexture(`floor|${def.id}|${def.pattern}|${m}|${s2}`, S, S, (g) => {
    const rnd = seeded(def.id.length * 131 + 7)
    switch (def.pattern) {
      case 'wood':
        for (let r = 0; r < 4; r++) {
          const y = r * 6
          px(g, 0, y, S, 6, r % 2 ? m : mixToward(m, s2, 0.35))
          px(g, 0, y + 5, S, 1, s2)
          const seam = (r * 9 + 5) % S
          px(g, seam, y, 1, 5, s2)
          px(g, (seam + 7) % S, y + 2, 2, 1, mixToward(m, s2, 0.6))
        }
        return
      case 'tiles':
        px(g, 0, 0, S, S, m)
        for (let i = 0; i < S; i += 12) { px(g, i, 0, 1, S, s2); px(g, 0, i, S, 1, s2) }
        px(g, 2, 2, 3, 1, '#ffffff'); px(g, 14, 14, 3, 1, '#ffffff')
        return
      case 'checks':
        px(g, 0, 0, S, S, m)
        px(g, 0, 0, S / 2, S / 2, s2); px(g, S / 2, S / 2, S / 2, S / 2, s2)
        return
      case 'grass':
        px(g, 0, 0, S, S, m)
        for (let i = 0; i < 40; i++) { const x = Math.floor(rnd() * S), y = Math.floor(rnd() * S); px(g, x, y, 1, 2, s2) }
        for (let i = 0; i < 3; i++) { const x = Math.floor(rnd() * (S - 3)), y = Math.floor(rnd() * (S - 3)); stamp(g, FLOWER, x, y, i % 2 ? '#ffffff' : '#ff8ae0', '#ffe14f', [0, 0, S, S]) }
        return
      case 'marble':
        px(g, 0, 0, S, S, m)
        for (let v = 0; v < 2; v++) {
          let x = Math.floor(rnd() * S)
          for (let y = 0; y < S; y++) { x = (x + (rnd() < 0.5 ? 1 : 0) + S) % S; px(g, x, y, 1, 1, s2) }
        }
        px(g, 0, 0, S, 1, mixToward(m, s2, 0.5)); px(g, 0, 0, 1, S, mixToward(m, s2, 0.5))
        return
      case 'rainbow':
        for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
          const k = Math.floor(((x + y) % S) / 4)
          px(g, x, y, 1, 1, RAINBOW[k % RAINBOW.length]!)
        }
        return
      case 'stars':
        px(g, 0, 0, S, S, m)
        stamp(g, STAR, 3, 3, s2, s2, [0, 0, S, S])
        stamp(g, STAR, 15, 14, s2, s2, [0, 0, S, S])
        px(g, 17, 4, 1, 1, '#ffffff'); px(g, 6, 18, 1, 1, '#ffffff')
        return
      default:
        paintPattern(g, 0, 0, S, S, def.pattern as Pattern, def.colors)
    }
  }, true)
}

/** A wallpaper tile (one cell square, repeats). */
export function wallTexture(def: SurfaceDef): THREE.CanvasTexture {
  const S = SURFACE_PX
  return cachedTexture(`wall|${def.id}|${def.pattern}|${def.colors.main}|${def.colors.second ?? ''}`, S, S, (g) => {
    if (def.pattern === 'plain') {
      px(g, 0, 0, S, S, def.colors.main)
      const s2 = def.colors.second ?? darkenHex(def.colors.main)
      px(g, 0, 0, 1, S, s2); px(g, 12, 0, 1, S, mixToward(def.colors.main, s2, 0.5))
      return
    }
    if (def.pattern === 'stripes') {
      px(g, 0, 0, S, S, def.colors.main)
      px(g, 4, 0, 4, S, def.colors.second ?? '#ffffff'); px(g, 16, 0, 4, S, def.colors.second ?? '#ffffff')
      return
    }
    if (def.pattern === 'wood' || def.pattern === 'tiles' || def.pattern === 'marble' || def.pattern === 'grass') {
      paintPattern(g, 0, 0, S, S, 'plain', def.colors)
      return
    }
    paintPattern(g, 0, 0, S, S, def.pattern, def.colors, true)
  }, true)
}

function mixToward(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const m = (s: number) => Math.round(((pa >> s) & 255) + ((((pb >> s) & 255) - ((pa >> s) & 255)) * t))
  return '#' + ((1 << 24) | (m(16) << 16) | (m(8) << 8) | m(0)).toString(16).slice(1)
}

// ---------------------------------------------------------------- name tags

const CROWN = ['#.#.#', '#####', '#o#o#', '#####']

/**
 * A name plate: the pixel font (ÆØÅ included), white on a dark box with
 * notched corners, and a small crown before the name for a title
 * (gold for king/queen, silver for prince/princess). Not cached: the
 * caller owns the texture.
 */
export function tagCanvas(name: string, title: RoyalTitle | null): HTMLCanvasElement {
  const text = name.slice(0, 16)
  const tw = textWidth(text)
  const crownW = title ? 7 : 0
  const w = tw + crownW + 6, h = 11
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  px(g, 1, 0, w - 2, h, 'rgba(26,16,40,0.78)')
  px(g, 0, 1, w, h - 2, 'rgba(26,16,40,0.78)')
  if (title) {
    const gold = title === 'king' || title === 'queen'
    stamp(g, CROWN, 3, 3, gold ? '#ffd23f' : '#e0e0ff', gold ? '#ff3b5c' : '#4fb8ff', [0, 0, w, h])
  }
  drawText(g, text, 3 + crownW, 2, '#ffffff')
  return c
}
