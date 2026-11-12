/**
 * EPX (Scale2x): a pixel-art picture at twice the size, without new colours.
 * Each pixel becomes four; a corner takes its neighbours' colour where the
 * two neighbours on its sides agree and the other two do not, so stairs turn
 * into diagonals and straight edges stay straight. For the handful of small
 * drawings a view at double density has no finer art for.
 */

/** `src`: w × h pixels, one number per pixel (any packing, compared whole). Returns 2w × 2h. */
export function epx(src: ArrayLike<number>, w: number, h: number): Uint32Array {
  const out = new Uint32Array(w * h * 4)
  const at = (x: number, y: number) => src[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))]!
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = at(x, y)
      const up = at(x, y - 1)
      const right = at(x + 1, y)
      const left = at(x - 1, y)
      const down = at(x, y + 1)
      const o = y * 2 * w * 2 + x * 2
      out[o] = left === up && left !== down && up !== right ? up : p
      out[o + 1] = up === right && up !== left && right !== down ? right : p
      out[o + w * 2] = down === left && down !== right && left !== up ? left : p
      out[o + w * 2 + 1] = right === down && right !== up && down !== left ? down : p
    }
  }
  return out
}

/** A canvas at twice the size, through `epx`. */
export function epxCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width
  const h = src.height
  const data = src.getContext('2d')!.getImageData(0, 0, w, h)
  const big = epx(new Uint32Array(data.data.buffer), w, h)
  const c = document.createElement('canvas')
  c.width = w * 2
  c.height = h * 2
  const g = c.getContext('2d')!
  const img = g.createImageData(w * 2, h * 2)
  new Uint32Array(img.data.buffer).set(big)
  g.putImageData(img, 0, 0)
  return c
}
