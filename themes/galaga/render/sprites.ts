/**
 * Space Voyagers: the sprite store. A bitmap is asked for by name and loaded
 * from `public/galaga/<name>.png` the first time; until it has arrived, and
 * for good when the file is not there, a flat placeholder with the name's
 * initials stands in at the size the design gives that kind of thing. The
 * store measures what it loads, so nothing else needs to know a bitmap's size.
 *
 * Every draw is whole pixels, centred on the thing. Variants are made from
 * the bitmap once: `white` (the hit flash, a silhouette), `frost` (every
 * other pixel of the silhouette, for a thing held in hairspray) and the
 * mirror image (a ship banking the other way).
 */
import { drawText, textWidth } from '../../base/pixel/font'
import { C, INK, WHITE } from './palette'

type G = CanvasRenderingContext2D
type Variant = 'plain' | 'white' | 'frost'

interface Entry {
  name: string
  state: 'loading' | 'ready' | 'missing'
  w: number
  h: number
  img: HTMLImageElement | null
  made: Map<string, HTMLCanvasElement>
  /** Measured once: the bitmap's bottom row is mostly solid, so it stands on an edge (a horizon, not a thing adrift). */
  grounded: boolean | null
}

/** The size a placeholder takes, by the start of the name (DESIGN.md, "The picture"). */
const SIZES: readonly [string, number, number][] = [
  ['ship-', 32, 36], ['boss-deafstar', 192, 96], ['boss-', 112, 96], ['rig-', 36, 148], ['stranded-', 40, 48],
  ['pick-', 16, 16], ['portrait-', 64, 64], ['duo', 46, 52], ['valve-', 12, 24], ['enemy-', 24, 24],
  ['console-band', 240, 96], ['console-', 200, 432], ['card-title', 240, 320], ['card-ending', 240, 200], ['bg-', 160, 96],
]

function guess(name: string): [number, number] {
  if (name.endsWith('-tank') || name.endsWith('-captor')) return [32, 32]
  if (name.endsWith('-mite')) return [12, 12]
  for (const [prefix, w, h] of SIZES) if (name.startsWith(prefix)) return [w, h]
  return [24, 24]
}

/** `enemy-glitterati-grunt` is EGG. */
export function initials(name: string): string {
  return name.split('-').map(p => p[0] ?? '').join('').toUpperCase().slice(0, 4)
}

function canvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

export interface SpriteStore {
  /** Ask for a bitmap ahead of its first draw. */
  want(name: string): void
  /** Has the file arrived? */
  ready(name: string): boolean
  /** The file is not there (or not a picture). */
  missing(name: string): boolean
  /** The bitmap's size, or the placeholder's until it is known. */
  size(name: string): { w: number; h: number }
  /** Is the bitmap cut straight along its bottom edge (most of its last row is solid)? */
  grounded(name: string): boolean
  /** Centred on (x, y). */
  draw(g: G, name: string, x: number, y: number, opts?: DrawOptions): void
  /** Top-left at (x, y); a part of it when `sx..sh` are given. No placeholder: returns false when not ready. */
  blit(g: G, name: string, x: number, y: number, sx?: number, sy?: number, sw?: number, sh?: number): boolean
  /** Names asked for, for the lab: which loaded, which are missing. */
  report(): { ready: string[]; missing: string[]; loading: string[] }
}

export interface DrawOptions {
  variant?: Variant
  mirror?: boolean
  /** Rows of the bitmap to draw, from the top (a rig's cab alone). */
  rows?: number
  /** Keep the top edge where the whole bitmap's would be when `rows` cuts it. */
  anchorTop?: boolean
}

export function createSpriteStore(base = '/galaga/'): SpriteStore {
  const entries = new Map<string, Entry>()

  function entry(name: string): Entry {
    let e = entries.get(name)
    if (e) return e
    const [w, h] = guess(name)
    e = { name, state: 'loading', w, h, img: null, made: new Map(), grounded: null }
    entries.set(name, e)
    const img = new Image()
    const it = e
    img.onload = () => {
      if (img.naturalWidth === 0) { it.state = 'missing'; return }
      it.img = img
      it.w = img.naturalWidth
      it.h = img.naturalHeight
      it.state = 'ready'
    }
    img.onerror = () => { it.state = 'missing' }
    img.src = `${base}${name}.png`
    return e
  }

  function variant(e: Entry, v: Variant, mirror: boolean): CanvasImageSource {
    if (v === 'plain' && !mirror) return e.img!
    const key = `${v}${mirror ? '-m' : ''}`
    let c = e.made.get(key)
    if (c) return c
    c = canvas(e.w, e.h)
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    if (mirror) { g.translate(e.w, 0); g.scale(-1, 1) }
    g.drawImage(e.img!, 0, 0)
    g.setTransform(1, 0, 0, 1, 0, 0)
    if (v !== 'plain') {
      // The silhouette: every pixel the bitmap has, in one tone.
      g.globalCompositeOperation = 'source-in'
      g.fillStyle = v === 'white' ? WHITE : C.frost
      g.fillRect(0, 0, e.w, e.h)
      if (v === 'frost') {
        g.globalCompositeOperation = 'destination-out'
        g.fillStyle = INK
        for (let y = 0; y < e.h; y++) for (let x = (y & 1); x < e.w; x += 2) g.fillRect(x, y, 1, 1)
      }
      g.globalCompositeOperation = 'source-over'
    }
    e.made.set(key, c)
    return c
  }

  function placeholder(g: G, e: Entry, x: number, y: number, v: Variant, rows: number): void {
    const h = Math.min(e.h, rows)
    g.fillStyle = v === 'white' ? WHITE : C.placeholder
    g.fillRect(x, y, e.w, h)
    if (v === 'white') return
    g.fillStyle = C.placeholderHi
    g.fillRect(x, y, e.w, 1)
    g.fillRect(x, y, 1, h)
    const t = initials(e.name)
    if (e.w >= textWidth(t) + 2 && h >= 9) drawText(g, t, x + Math.floor((e.w - textWidth(t)) / 2), y + Math.floor((h - 7) / 2), WHITE)
  }

  return {
    want(name) { entry(name) },
    ready(name) { return entry(name).state === 'ready' },
    missing(name) { return entry(name).state === 'missing' },
    size(name) { const e = entry(name); return { w: e.w, h: e.h } },
    grounded(name) {
      const e = entry(name)
      if (e.state !== 'ready') return false
      if (e.grounded === null) {
        const c = canvas(e.w, 1)
        const g = c.getContext('2d')!
        g.drawImage(e.img!, 0, e.h - 1, e.w, 1, 0, 0, e.w, 1)
        const row = g.getImageData(0, 0, e.w, 1).data
        let solid = 0
        for (let x = 0; x < e.w; x++) if (row[x * 4 + 3]! > 127) solid++
        e.grounded = solid > e.w * 0.6
      }
      return e.grounded
    },
    draw(g, name, x, y, opts) {
      const e = entry(name)
      const rows = opts?.rows ?? e.h
      const h = Math.min(e.h, rows)
      const left = Math.round(x - e.w / 2)
      const top = Math.round(y - (opts?.anchorTop ? e.h : h) / 2)
      const v = opts?.variant ?? 'plain'
      if (e.state !== 'ready') { placeholder(g, e, left, top, v, rows); return }
      g.drawImage(variant(e, v, opts?.mirror === true), 0, 0, e.w, h, left, top, e.w, h)
    },
    blit(g, name, x, y, sx = 0, sy = 0, sw, sh) {
      const e = entry(name)
      if (e.state !== 'ready') return false
      const w = Math.min(sw ?? e.w, e.w - sx)
      const h = Math.min(sh ?? e.h, e.h - sy)
      if (w > 0 && h > 0) g.drawImage(e.img!, sx, sy, w, h, Math.round(x), Math.round(y), w, h)
      return true
    },
    report() {
      const out = { ready: [] as string[], missing: [] as string[], loading: [] as string[] }
      for (const e of entries.values()) out[e.state].push(e.name)
      return out
    },
  }
}
