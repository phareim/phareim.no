/**
 * The picture of the screen: the play canvas (2D in both views) as a JPEG small enough to send. The HTML over it (the
 * corner, the touch deck, DEV MODE's strip) is not in it.
 */

export interface Shot {
  blob: Blob | null
  /** The picture's size, px, and its JPEG quality; 0 where there is no picture. */
  w: number
  h: number
  q: number
  note: 'ok' | 'none' | 'too-big' | 'error'
}

/** The long edge at most, px (a smaller canvas is not blown up). */
export const LONG_EDGE = 1280
/** What a picture may weigh (the service takes 400 000). */
export const AIM_BYTES = 300_000
/** Tried in turn until one is small enough: JPEG quality, and the size against the first copy. */
const STEPS = [{ q: 0.72, k: 1 }, { q: 0.55, k: 1 }, { q: 0.4, k: 1 }, { q: 0.5, k: 0.75 }]

const none = (note: Shot['note']): Shot => ({ blob: null, w: 0, h: 0, q: 0, note })

function scaled(from: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w))
  c.height = Math.max(1, Math.round(h))
  const g = c.getContext('2d')!
  // (The page's ground under it: a JPEG has no transparency.)
  g.fillStyle = '#0b0616'
  g.fillRect(0, 0, c.width, c.height)
  g.imageSmoothingQuality = 'high'
  g.drawImage(from, 0, 0, c.width, c.height)
  return c
}

const jpeg = (c: HTMLCanvasElement, q: number) => new Promise<Blob | null>(done => c.toBlob(done, 'image/jpeg', q))

async function encode(first: HTMLCanvasElement): Promise<Shot> {
  for (const { q, k } of STEPS) {
    const c = k === 1 ? first : scaled(first, first.width * k, first.height * k)
    const blob = await jpeg(c, q)
    if (!blob) return none('error')
    if (blob.size <= AIM_BYTES) return { blob, w: c.width, h: c.height, q, note: 'ok' }
  }
  return none('too-big')
}

/** The frame on `canvas` now: it is copied before this returns, and encoded afterwards. Never rejects. */
export function captureScreen(canvas: HTMLCanvasElement | null): Promise<Shot> {
  try {
    if (!canvas || !canvas.width || !canvas.height) return Promise.resolve(none('none'))
    const k = Math.min(1, LONG_EDGE / Math.max(canvas.width, canvas.height))
    return encode(scaled(canvas, canvas.width * k, canvas.height * k)).catch(() => none('error'))
  } catch {
    return Promise.resolve(none('error'))
  }
}
