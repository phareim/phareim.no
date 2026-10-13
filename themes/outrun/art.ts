/**
 * The pictures of the drive: indexed bitmaps in public/outrun/, made the way
 * the places of Nova's Solo Rescue are (scripts/outrun-lab/art/README.md) and
 * drawn here with nothing resampled but by the sprite scaler's nearest
 * neighbour. A picture is asked for by name and by the hour's shade; the
 * shaded copy is made once (a palette change, no blending in the frame) and
 * kept. Until a picture has loaded, asking for it gives null and the renderer
 * draws without it: the road is there from the first frame.
 */
import { shadeRgb, type Shade } from './color'

export const ART = [
  'car', 'car-left', 'car-right',
  'cab', 'truck', 'bug', 'wagon',
  'maple', 'pine', 'snowpine', 'pole', 'lamp', 'bush', 'rock', 'snowrock', 'deer',
  'barn', 'diner', 'cabin', 'lighthouse', 'motel',
  'billboard', 'payphone', 'gas', 'decker', 'mill', 'screen',
  'cloud-1', 'cloud-2', 'cloud-3', 'cloud-4', 'cloud-5', 'cloud-6',
  'skyline', 'mountains', 'hills', 'card-goal',
  'nova-calm', 'nova-smirk', 'nova-angry', 'nova-surprised', 'nova-shout', 'nova-wince', 'nova-laugh', 'nova-eyeroll', 'nova-set',
  'rex-cheerful', 'rex-eating', 'rex-sheepish', 'rex-worried',
] as const

export type ArtName = typeof ART[number]

export interface Picture {
  c: HTMLCanvasElement
  w: number
  h: number
}

export interface Art {
  /** A picture as it was drawn, or under an hour's shade (`key` names the shade for the cache). */
  get(name: ArtName, key?: string, shade?: Shade): Picture | null
  /**
   * A backdrop band made to repeat: the picture and its mirror image side by
   * side, so the two ends always meet themselves.
   */
  band(name: ArtName, key?: string, shade?: Shade): Picture | null
  /** The car's second frame: the ends of the two headbands and of her hair a pixel lower, for the wind. */
  flutter(name: ArtName, key?: string, shade?: Shade): Picture | null
  readonly ready: boolean
  readonly loaded: number
}

function canvasOf(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/** `src` maps a name to its address; the page uses /outrun/<name>.png, the shot lab hands in data URLs. */
export function loadArt(src: (name: ArtName) => string = name => `/outrun/${name}.png`): Art {
  const plain = new Map<string, Picture>()
  const made = new Map<string, Picture>()
  let loaded = 0

  for (const name of ART) {
    const img = new Image()
    img.onload = () => {
      const c = canvasOf(img.width, img.height)
      const g = c.getContext('2d')!
      g.imageSmoothingEnabled = false
      g.drawImage(img, 0, 0)
      plain.set(name, { c, w: img.width, h: img.height })
      loaded++
    }
    img.src = src(name)
  }

  function shaded(p: Picture, shade: Shade): Picture {
    const c = canvasOf(p.w, p.h)
    const g = c.getContext('2d')!
    g.drawImage(p.c, 0, 0)
    const data = g.getImageData(0, 0, p.w, p.h)
    const d = data.data
    // A picture has a few dozen colours: shade each once.
    const memo = new Map<number, [number, number, number]>()
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue
      const key = (d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!
      let o = memo.get(key)
      if (!o) memo.set(key, o = shadeRgb(d[i]!, d[i + 1]!, d[i + 2]!, shade))
      d[i] = o[0]
      d[i + 1] = o[1]
      d[i + 2] = o[2]
    }
    g.putImageData(data, 0, 0)
    return { c, w: p.w, h: p.h }
  }

  function get(name: ArtName, key = '', shade?: Shade): Picture | null {
    const p = plain.get(name)
    if (!p) return null
    if (!key || !shade || shade.k <= 0) return p
    const id = `${name}|${key}`
    let s = made.get(id)
    if (!s) made.set(id, s = shaded(p, shade))
    return s
  }

  function band(name: ArtName, key = '', shade?: Shade): Picture | null {
    const id = `band|${name}|${key}`
    let b = made.get(id)
    if (b) return b
    const p = get(name, key, shade)
    if (!p) return null
    const c = canvasOf(p.w * 2, p.h)
    const g = c.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(p.c, 0, 0)
    g.translate(p.w * 2, 0)
    g.scale(-1, 1)
    g.drawImage(p.c, 0, 0)
    made.set(id, b = { c, w: p.w * 2, h: p.h })
    return b
  }

  function flutter(name: ArtName, key = '', shade?: Shade): Picture | null {
    const id = `flutter|${name}|${key}`
    let f = made.get(id)
    if (f) return f
    const p = get(name, key, shade)
    if (!p) return null
    const c = canvasOf(p.w, p.h)
    const g = c.getContext('2d')!
    g.drawImage(p.c, 0, 0)
    // What flies is what sticks out to either side above the seat backs: the
    // outer columns of the top third. Find them, and let each drop a pixel.
    const rows = Math.round(p.h * 0.3)
    const data = g.getImageData(0, 0, p.w, rows + 1)
    let x0 = p.w
    let x1 = 0
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < p.w; x++) {
        if (data.data[(y * p.w + x) * 4 + 3]) {
          if (x < x0) x0 = x
          if (x > x1) x1 = x
        }
      }
    }
    const reach = 12
    for (const [from, to] of [[x0, Math.min(p.w, x0 + reach)], [Math.max(0, x1 - reach + 1), x1 + 1]] as const) {
      if (to <= from) continue
      g.clearRect(from, 0, to - from, rows + 1)
      g.drawImage(p.c, from, 0, to - from, rows, from, 1, to - from, rows)
    }
    made.set(id, f = { c, w: p.w, h: p.h })
    return f
  }

  return {
    get, band, flutter,
    get ready() { return loaded === ART.length },
    get loaded() { return loaded },
  }
}
