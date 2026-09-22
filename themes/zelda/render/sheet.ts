/** Sprite canvases built once from the pixel maps in sprites.ts (and mirrored on demand). */
import { PAL, SPRITES } from './sprites'

type Canvas = HTMLCanvasElement

const cache = new Map<string, Canvas>()
const tinted = new Map<string, Canvas>()

function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

function build(name: string): Canvas {
  const def = SPRITES[name]
  if (!def) return makeCanvas(1, 1)
  const h = def.rows.length
  const w = def.rows[0]!.length
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  for (let y = 0; y < h; y++) {
    const row = def.rows[y]!
    for (let x = 0; x < w; x++) {
      const col = PAL[row[x]!]
      if (!col) continue
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

/** The sprite canvas; `flip` mirrors it horizontally. */
export function sprite(name: string, flip = false): Canvas {
  const key = flip ? name + '|f' : name
  let c = cache.get(key)
  if (c) return c
  if (!flip) c = build(name)
  else {
    const src = sprite(name)
    c = makeCanvas(src.width, src.height)
    const g = c.getContext('2d')!
    g.translate(src.width, 0)
    g.scale(-1, 1)
    g.drawImage(src, 0, 0)
  }
  cache.set(key, c)
  return c
}

/** Mirrored horizontally (fh) and/or vertically (fv). */
export function spriteT(name: string, fh: boolean, fv: boolean): Canvas {
  if (!fv) return sprite(name, fh)
  const key = `${name}|${fh ? 'f' : ''}v`
  let c = cache.get(key)
  if (c) return c
  const src = sprite(name, fh)
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.translate(0, src.height)
  g.scale(1, -1)
  g.drawImage(src, 0, 0)
  cache.set(key, c)
  return c
}

/** A solid-colour silhouette of a sprite (hit flashes, shadows). */
export function silhouette(name: string, color: string, flip = false): Canvas {
  const key = `${name}|${flip ? 'f' : ''}|${color}`
  let c = tinted.get(key)
  if (c) return c
  const src = sprite(name, flip)
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  tinted.set(key, c)
  return c
}

/** Draw a sprite with its bottom-centre at (x, y) in logical pixels. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, x: number, y: number, flip = false, alpha = 1) {
  const c = sprite(name, flip)
  if (alpha !== 1) g.globalAlpha = alpha
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height))
  if (alpha !== 1) g.globalAlpha = 1
}

/** Draw a sprite centred on (x, y). */
export function drawCentered(g: CanvasRenderingContext2D, name: string, x: number, y: number, flip = false) {
  const c = sprite(name, flip)
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2))
}

export function hasSprite(name: string) {
  return !!SPRITES[name]
}

export { makeCanvas }
