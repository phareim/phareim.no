/**
 * Little pictures for the studio's buttons, as PNG data URLs shown with
 * `image-rendering: pixelated`: a garment from its texture (shoes as a
 * pair), a figure in a style (whole, or its head for the hair, eye and
 * mouth pickers), and canvases for downloads. Cached; client only.
 */
import type { DrawnGarment, Figure, GarmentDef, Hex, PixelBuffer, StyleId, Texture } from '../types'
import { garmentTexture, drawnTexture } from '../core/textures'
import { frameFor, styleById } from '../render/styles'
import { writeRGBA } from '../render/pixels'

const CACHE_MAX = 400
const cache = new Map<string, string>()

function remember(key: string, make: () => string): string {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  if (typeof document === 'undefined') return ''
  const url = make()
  if (cache.size >= CACHE_MAX) cache.clear()
  cache.set(key, url)
  return url
}

/** A canvas holding `buf` at one CSS pixel per logical pixel. */
export function bufferCanvas(buf: PixelBuffer): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = buf.w
  c.height = buf.h
  const g = c.getContext('2d')!
  const img = g.createImageData(buf.w, buf.h)
  writeRGBA(buf, img.data)
  g.putImageData(img, 0, 0)
  return c
}

/** `buf` scaled up by a whole number, crisp. */
export function scaledCanvas(buf: PixelBuffer, scale: number): HTMLCanvasElement {
  const src = bufferCanvas(buf)
  const c = document.createElement('canvas')
  c.width = buf.w * scale
  c.height = buf.h * scale
  const g = c.getContext('2d')!
  g.imageSmoothingEnabled = false
  g.drawImage(src, 0, 0, c.width, c.height)
  return c
}

const texKey = (t: Texture) => `${t.w}x${t.h}:${t.px.map(c => c ?? '').join(',')}`

/** Shoes are one shoe: show the pair, the second mirrored, a pixel apart. */
function pairOf(t: Texture): Texture {
  const w = t.w * 2 + 1
  const px: Array<Hex | null> = new Array(w * t.h).fill(null)
  for (let y = 0; y < t.h; y++) {
    for (let x = 0; x < t.w; x++) {
      const c = t.px[y * t.w + x] ?? null
      px[y * w + x] = c
      px[y * w + (w - 1 - x)] = c
    }
  }
  return { w, h: t.h, px }
}

export function texturePic(t: Texture, pair = false): string {
  const tex = pair ? pairOf(t) : t
  return remember('t|' + texKey(tex), () => bufferCanvas(tex).toDataURL())
}

/** A built-in piece in the given colours. */
export function garmentPic(def: GarmentDef, color?: Hex, color2?: Hex): string {
  return texturePic(garmentTexture(def, color, color2), def.kind === 'sneaker' || def.kind === 'boot' || def.kind === 'flat')
}

/** A drawn piece, or '' when it is broken. */
export function drawnPic(d: DrawnGarment): string {
  const t = drawnTexture(d)
  return t ? texturePic(t, d.kind === 'sneaker' || d.kind === 'boot' || d.kind === 'flat') : ''
}

const STILL = { t: 0, pose: { bob: 0, blink: false, cheer: 0 }, backdrop: false }

/** How much of a figure's height its head takes, per style (for the head crop). */
const HEAD_SHARE: Record<StyleId, number> = { minecraft: 0.42, roblox: 0.46, toca: 0.6, avatar: 0.62 }

function bbox(buf: PixelBuffer): { x: number; y: number; w: number; h: number } | null {
  let x0 = buf.w, y0 = buf.h, x1 = -1, y1 = -1
  for (let y = 0; y < buf.h; y++) {
    for (let x = 0; x < buf.w; x++) {
      if (!buf.px[y * buf.w + x]) continue
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}

function crop(buf: PixelBuffer, r: { x: number; y: number; w: number; h: number }): PixelBuffer {
  const px: Array<Hex | null> = new Array(r.w * r.h).fill(null)
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      const sx = r.x + x
      const sy = r.y + y
      if (sx >= 0 && sy >= 0 && sx < buf.w && sy < buf.h) px[y * r.w + x] = buf.px[sy * buf.w + sx] ?? null
    }
  }
  return { w: r.w, h: r.h, px }
}

const figKey = (f: Figure, closet: readonly DrawnGarment[]) =>
  JSON.stringify([f.body, f.outfit]) + '|' + closet.filter(d => Object.values(f.outfit).some(w => w?.id === d.id)).map(d => d.id + d.tex.data + d.tex.pal.join()).join()

/** The whole figure in `style`, transparent around it, trimmed to its outline. */
export function figurePic(f: Figure, closet: readonly DrawnGarment[], style: StyleId): string {
  return remember(`f|${style}|${figKey(f, closet)}`, () => {
    const buf = frameFor(f, closet as DrawnGarment[], styleById(style), STILL)
    const b = bbox(buf)
    return bufferCanvas(b ? crop(buf, b) : buf).toDataURL()
  })
}

/** The figure's head in `style`: a square from the top of its outline. */
export function headPic(f: Figure, closet: readonly DrawnGarment[], style: StyleId): string {
  return remember(`h|${style}|${figKey(f, closet)}`, () => {
    const buf = frameFor(f, closet as DrawnGarment[], styleById(style), STILL)
    const b = bbox(buf)
    if (!b) return bufferCanvas(buf).toDataURL()
    const side = Math.max(4, Math.min(b.w, Math.round(b.h * HEAD_SHARE[style])))
    const x = b.x + Math.floor((b.w - side) / 2)
    return bufferCanvas(crop(buf, { x, y: b.y, w: side, h: side })).toDataURL()
  })
}

/** How a picture left: shared (iOS puts it in Photos), downloaded, or not at all (cancelled, failed). */
export type SaveOutcome = 'shared' | 'saved' | false

/**
 * Hands `canvas` over as a PNG named `name`: the share sheet where the
 * device can share files (on iOS that is how a picture reaches Photos),
 * else an <a download> click.
 */
export function downloadCanvas(canvas: HTMLCanvasElement, name: string): Promise<SaveOutcome> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) { resolve(false); return }
      const file = typeof File === 'function' ? new File([blob], name, { type: 'image/png' }) : null
      const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean }
      if (file && typeof nav.share === 'function' && nav.canShare?.({ files: [file] })) {
        nav.share({ files: [file] }).then(() => resolve('shared'), (err: unknown) => {
          // Cancelled by the child: nothing went. Any other refusal: try the plain download.
          if (err instanceof DOMException && err.name === 'AbortError') resolve(false)
          else resolve(anchorDownload(blob, name))
        })
        return
      }
      resolve(anchorDownload(blob, name))
    }, 'image/png')
  })
}

function anchorDownload(blob: Blob, name: string): SaveOutcome {
  try {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Slow phones may start reading the file late: keep it for a minute.
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
    return 'saved'
  } catch {
    return false
  }
}
