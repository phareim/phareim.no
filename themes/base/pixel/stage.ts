/**
 * The pixel stage: Neon Shrine's look for any canvas game (2026-09-24).
 *
 * A game draws its world into `g`, a small logical-resolution buffer (one
 * logical pixel = one sprite pixel), and asks for lights with `light()`.
 * `present()` then does what `themes/zelda/render/renderer.ts` does for the
 * world: multiply the scene by a light map (an ambient colour plus additive
 * glow pools, so lamps, shots and eyes light what is round them), scale it
 * by a whole number onto the screen, add a soft bloom of the same lights,
 * faint scanlines and a vignette, then lay the HUD layer (`hud`, also
 * logical pixels, not lit) on top. Things drawn in the `afterLight` hook are
 * at full brightness, the way emissive neon is.
 *
 * Games keep their own coordinates (usually CSS pixels); `k` is CSS px per
 * logical pixel and `px()` converts and rounds, so nothing lands between
 * pixels. The scale is the largest whole number that still shows at least
 * `minW`×`minH` logical pixels, so a phone and a monitor both get chunky,
 * crisp pixels like the town on `/`.
 *
 * Rotated (R-Type on a portrait phone, 2026-09-24): `resize(…, rotate =
 * true)` keeps the scene in the game's world orientation (vw along the
 * world's forward axis, which points up the screen) and turns it a quarter
 * at `present()`. `minW`/`minH` then measure the world, and the HUD layer
 * (`hw`×`hh`) stays upright in screen orientation.
 */

type G = CanvasRenderingContext2D

export interface Light {
  /** Logical pixels. */
  x: number
  y: number
  /** Radius in logical pixels. */
  r: number
  color: string
  /** 0–1. */
  a: number
}

export interface PresentOptions {
  /** Light-map base colour; null leaves the scene unlit (no multiply pass). */
  ambient?: string | null
  /** Whole-screen flash drawn after the light (0–1 alpha). */
  flash?: { color: string; a: number } | null
  /** Fade to the background colour, 0–1. */
  fade?: number
  /** Shake in logical pixels (rounded). */
  shakeX?: number
  shakeY?: number
  /** Bloom strength multiplier (0 = none). Default 1. */
  bloom?: number
  /** Drawn into `g` after the light map, at full brightness (neon, shots, sparks). */
  afterLight?: (g: G) => void
}

export interface StageOptions {
  minW?: number
  minH?: number
  /** Screen colour round the scaled buffer and fade colour. */
  bg?: string
}

export interface PixelStage {
  /**
   * `minW`/`minH` override the stage's defaults for this size. `rotate`
   * draws the scene turned a quarter (world +x up the screen, world y
   * across it, left to right).
   */
  resize(cssW: number, cssH: number, dpr: number, minW?: number, minH?: number, rotate?: boolean): void
  /** Start a frame: clears the light list and the HUD layer; returns the scene context. */
  begin(): G
  light(x: number, y: number, r: number, color: string, a?: number): void
  /** A rectangle that stays at full brightness through the light map. */
  emit(x: number, y: number, w: number, h: number): void
  /**
   * Every opaque pixel of a static image (e.g. a sun layer) stays at full
   * brightness through the light map. The white mask is cached per image,
   * so the image must not change after its first use here.
   */
  emitImage(img: HTMLCanvasElement, x?: number, y?: number): void
  present(opts?: PresentOptions): void
  /** CSS px → logical px, rounded to the pixel. */
  px(v: number): number
  readonly g: G
  readonly hud: G
  readonly lights: Light[]
  /** Logical size of the scene (world orientation when rotated). */
  readonly vw: number
  readonly vh: number
  /** Logical size of the HUD layer (always screen orientation). */
  readonly hw: number
  readonly hh: number
  readonly rotated: boolean
  /** Device pixels per logical pixel (whole number). */
  readonly scale: number
  /** CSS px per logical pixel. */
  readonly k: number
  readonly cssW: number
  readonly cssH: number
}

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.ceil(w))
  c.height = Math.max(1, Math.ceil(h))
  return c
}

const glowCache = new Map<string, HTMLCanvasElement>()

/** A soft radial glow sprite (64×64) in one colour, cached. */
export function glowSprite(color: string): HTMLCanvasElement {
  let c = glowCache.get(color)
  if (c) return c
  c = makeCanvas(64, 64)
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  grad.addColorStop(0, color)
  grad.addColorStop(0.35, color + 'aa')
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, 64, 64)
  glowCache.set(color, c)
  return c
}

export function createPixelStage(canvas: HTMLCanvasElement, opts: StageOptions = {}): PixelStage {
  const defW = opts.minW ?? 240
  const defH = opts.minH ?? 180
  const bgColor = opts.bg ?? '#0b0616'
  const screen = canvas.getContext('2d')!
  let scene = makeCanvas(1, 1)
  let sg = scene.getContext('2d')!
  let lightC = makeCanvas(1, 1)
  let lg = lightC.getContext('2d')!
  let hudC = makeCanvas(1, 1)
  let hg = hudC.getContext('2d')!
  let bloomC = makeCanvas(1, 1)
  let bg = bloomC.getContext('2d')!
  let vignetteC: HTMLCanvasElement | null = null
  let scanTile: HTMLCanvasElement | null = null
  let W = 1
  let H = 1
  let scale = 1
  let vw = 1
  let vh = 1
  let hw = 1
  let hh = 1
  let rot = false
  let dpr = 1
  let cssW = 1
  let cssH = 1
  // Lights are pooled: light() reuses objects across frames (phones).
  const lights: Light[] = []
  const pool: Light[] = []
  const emits: number[] = []
  const emitImgs: { img: HTMLCanvasElement; x: number; y: number }[] = []
  const masks = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>()

  function maskOf(img: HTMLCanvasElement): HTMLCanvasElement {
    let m = masks.get(img)
    if (!m) {
      m = makeCanvas(img.width, img.height)
      const mg = m.getContext('2d')!
      mg.drawImage(img, 0, 0)
      mg.globalCompositeOperation = 'source-in'
      mg.fillStyle = '#ffffff'
      mg.fillRect(0, 0, m.width, m.height)
      masks.set(img, m)
    }
    return m
  }

  function resize(w: number, h: number, ratio: number, minW = defW, minH = defH, rotate = false) {
    dpr = Math.max(1, Math.min(3, ratio || 1))
    cssW = Math.max(1, w)
    cssH = Math.max(1, h)
    W = Math.max(1, Math.round(cssW * dpr))
    H = Math.max(1, Math.round(cssH * dpr))
    canvas.width = W
    canvas.height = H
    rot = rotate
    const fw = rot ? H : W
    const fh = rot ? W : H
    scale = Math.max(1, Math.floor(Math.min(fw / minW, fh / minH)))
    vw = Math.ceil(fw / scale)
    vh = Math.ceil(fh / scale)
    hw = Math.ceil(W / scale)
    hh = Math.ceil(H / scale)
    scene = makeCanvas(vw, vh)
    sg = scene.getContext('2d')!
    lightC = makeCanvas(vw, vh)
    lg = lightC.getContext('2d')!
    hudC = makeCanvas(hw, hh)
    hg = hudC.getContext('2d')!
    bloomC = makeCanvas(vw, vh)
    bg = bloomC.getContext('2d')!
    for (const c of [sg, lg, hg, screen]) c.imageSmoothingEnabled = false
    const p = makeCanvas(1, Math.max(2, scale))
    const pg = p.getContext('2d')!
    pg.fillStyle = 'rgba(0,0,0,0.13)'
    pg.fillRect(0, 0, 1, Math.max(1, Math.floor(scale / 3)))
    scanTile = p
    vignetteC = null
  }

  // Scanlines and vignette are static: one overlay, built once per size, one blit a frame.
  function vignette() {
    if (!vignetteC) {
      vignetteC = makeCanvas(W, H)
      const g = vignetteC.getContext('2d')!
      const scan = scanTile && scale >= 3 ? g.createPattern(scanTile, 'repeat') : null
      if (scan) {
        g.fillStyle = scan
        g.fillRect(0, 0, W, H)
      }
      const grad = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75)
      grad.addColorStop(0, 'rgba(5,3,12,0)')
      grad.addColorStop(1, 'rgba(5,3,12,0.45)')
      g.fillStyle = grad
      g.fillRect(0, 0, W, H)
    }
    screen.drawImage(vignetteC, 0, 0)
  }

  function begin(): G {
    lights.length = 0
    emits.length = 0
    emitImgs.length = 0
    sg.setTransform(1, 0, 0, 1, 0, 0)
    sg.globalAlpha = 1
    sg.globalCompositeOperation = 'source-over'
    hg.setTransform(1, 0, 0, 1, 0, 0)
    hg.clearRect(0, 0, hw, hh)
    return sg
  }

  function light(x: number, y: number, r: number, color: string, a = 1) {
    let L = pool[lights.length]
    if (!L) { L = { x, y, r, color, a }; pool.push(L) } else { L.x = x; L.y = y; L.r = r; L.color = color; L.a = a }
    lights.push(L)
  }

  function emit(x: number, y: number, w: number, h: number) {
    emits.push(x, y, w, h)
  }

  function emitImage(img: HTMLCanvasElement, x = 0, y = 0) {
    emitImgs.push({ img, x, y })
  }

  function present(o: PresentOptions = {}) {
    const g = sg
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.globalAlpha = 1
    // --- light map ---
    if (o.ambient) {
      lg.globalCompositeOperation = 'source-over'
      lg.globalAlpha = 1
      lg.fillStyle = o.ambient
      lg.fillRect(0, 0, vw, vh)
      lg.globalCompositeOperation = 'lighter'
      for (const L of lights) {
        if (L.x < -L.r || L.y < -L.r || L.x > vw + L.r || L.y > vh + L.r) continue
        lg.globalAlpha = Math.max(0, Math.min(1, L.a))
        lg.drawImage(glowSprite(L.color), L.x - L.r, L.y - L.r, L.r * 2, L.r * 2)
      }
      lg.globalAlpha = 1
      lg.globalCompositeOperation = 'source-over'
      lg.fillStyle = '#ffffff'
      for (let i = 0; i < emits.length; i += 4) lg.fillRect(emits[i]!, emits[i + 1]!, emits[i + 2]!, emits[i + 3]!)
      for (const e of emitImgs) lg.drawImage(maskOf(e.img), e.x, e.y)
      g.globalCompositeOperation = 'multiply'
      g.drawImage(lightC, 0, 0)
      g.globalCompositeOperation = 'source-over'
    }
    o.afterLight?.(g)
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    if (o.flash && o.flash.a > 0.004) {
      g.globalAlpha = Math.min(1, o.flash.a)
      g.fillStyle = o.flash.color
      g.fillRect(0, 0, vw, vh)
      g.globalAlpha = 1
    }
    const fade = Math.max(0, Math.min(1, o.fade ?? 0))
    if (fade > 0) {
      g.globalAlpha = fade
      g.fillStyle = bgColor
      g.fillRect(0, 0, vw, vh)
      g.globalAlpha = 1
    }
    // --- to the screen ---
    screen.setTransform(1, 0, 0, 1, 0, 0)
    screen.globalCompositeOperation = 'source-over'
    screen.globalAlpha = 1
    screen.fillStyle = bgColor
    screen.fillRect(0, 0, W, H)
    const sw = rot ? vh : vw // scene size on screen
    const sh = rot ? vw : vh
    const ox = Math.floor((W - sw * scale) / 2) + Math.round(o.shakeX ?? 0) * scale
    const oy = Math.floor((H - sh * scale) / 2) + Math.round(o.shakeY ?? 0) * scale
    // Rotated: world (x, y) lands at screen (y, bottom - x).
    const place = () => { if (rot) screen.setTransform(0, -scale, scale, 0, ox, oy + vw * scale) }
    const unplace = () => { if (rot) screen.setTransform(1, 0, 0, 1, 0, 0) }
    screen.imageSmoothingEnabled = false
    place()
    if (rot) screen.drawImage(scene, 0, 0)
    else screen.drawImage(scene, 0, 0, vw, vh, ox, oy, vw * scale, vh * scale)
    unplace()
    const bloomK = o.bloom ?? 1
    if (bloomK > 0 && fade < 1 && lights.length) {
      bg.globalCompositeOperation = 'source-over'
      bg.clearRect(0, 0, vw, vh)
      bg.globalCompositeOperation = 'lighter'
      for (const L of lights) {
        if (L.a < 0.3) continue
        const rad = L.r * 0.9
        if (L.x < -rad || L.y < -rad || L.x > vw + rad || L.y > vh + rad) continue
        bg.globalAlpha = Math.min(1, L.a) * 0.32 * bloomK
        bg.drawImage(glowSprite(L.color), L.x - rad, L.y - rad, rad * 2, rad * 2)
      }
      bg.globalAlpha = 1
      screen.globalCompositeOperation = 'lighter'
      screen.globalAlpha = 1 - fade
      screen.imageSmoothingEnabled = true
      place()
      if (rot) screen.drawImage(bloomC, 0, 0)
      else screen.drawImage(bloomC, 0, 0, vw, vh, ox, oy, vw * scale, vh * scale)
      unplace()
      screen.imageSmoothingEnabled = false
      screen.globalAlpha = 1
      screen.globalCompositeOperation = 'source-over'
    }
    vignette()
    const hx = Math.floor((W - hw * scale) / 2)
    const hy = Math.floor((H - hh * scale) / 2)
    screen.drawImage(hudC, 0, 0, hw, hh, hx, hy, hw * scale, hh * scale)
  }

  const stage: PixelStage = {
    resize,
    begin,
    light,
    emit,
    emitImage,
    present,
    px: (v: number) => Math.round((v * dpr) / scale),
    get g() { return sg },
    get hud() { return hg },
    lights,
    get vw() { return vw },
    get vh() { return vh },
    get hw() { return hw },
    get hh() { return hh },
    get rotated() { return rot },
    get scale() { return scale },
    get k() { return scale / dpr },
    get cssW() { return cssW },
    get cssH() { return cssH },
  }
  return stage
}
