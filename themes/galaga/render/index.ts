/**
 * Space Voyagers: the frame. Everything is drawn into one small buffer of
 * logical pixels (one logical pixel is one sprite pixel) and put on the
 * canvas's backing store once, at a whole number of its pixels, unsmoothed.
 * Wide, those are device pixels. Narrow, the backing store is the frame and
 * CSS fits it to the screen (DESIGN.md, "The picture"). There is no
 * bloom, glow, scanline, vignette, light map or blending anywhere in here:
 * a fade is a stipple, light is a lighter tone (DESIGN.md, "The picture").
 *
 *   const r = createRenderer(canvas)
 *   r.resize(cssW, cssH, dpr, chrome)       // on mount and on resize
 *   step(world, input); r.tick(world, monitor)   // once a tick
 *   r.draw(world, monitor, view)            // once a frame
 *
 * The parts: layout.ts (where things sit), sprites.ts (bitmaps by name, with
 * placeholders), field.ts (the field), console.ts (the monitor and the
 * instruments), fx.ts (what outlasts a tick), pix.ts (pixel verbs).
 */
import { SECTORS, enemyKind } from '../engine/balance'
import type { World } from '../engine/types'
import type { Monitor } from '../story/director'
import { createConsoleState, drawConsole, lampStack, resetConsole, stepConsole } from './console'
import type { ConsoleState } from './console'
import { drawBackdrop, drawEnding, drawField, tearField } from './field'
import { createFx, resetFx, stepFx, takeEvents } from './fx'
import type { Fx } from './fx'
import { computeLayout, toField as fieldPoint, wholePx } from './layout'
import type { Layout, Screen } from './layout'
import { C } from './palette'
import { hash } from './pix'
import { createSpriteStore } from './sprites'
import type { SpriteStore } from './sprites'

export interface Chrome {
  /** The site's bottom band, in CSS pixels. */
  safeBottom: number
  /** The radio widget's left and bottom edges, in CSS pixels (0: none). */
  widgetLeft: number
  widgetBottom: number
}

export interface DrawView {
  /** prefers-reduced-motion: no shake, no tearing, a still backdrop. */
  reduced: boolean
  /** No run under way: the monitor shows the test card. */
  idle: boolean
  /** The lab's switch: the engine's boxes over the picture. */
  boxes?: boolean
}

export interface Renderer {
  readonly layout: Layout
  /** CSS pixels per logical pixel, as a whole number of device pixels: for what is laid over the frame. */
  readonly px: number
  readonly sprites: SpriteStore
  readonly fx: Fx
  /** `fieldH`: a run is under way and its field keeps this height (0: the screen decides). */
  resize(cssW: number, cssH: number, dpr: number, chrome: Chrome, fieldH?: number): Layout
  /** A new run: forget the last one's effects and counter. */
  reset(world: World): void
  /** After each `step(world)`: read its events, advance what outlasts a tick. */
  tick(world: World, monitor: Monitor): void
  draw(world: World, monitor: Monitor, view: DrawView): void
  /** Field coordinates of a point on the canvas given in CSS pixels. */
  toField(cssX: number, cssY: number): { x: number; y: number }
}

const ROLES = ['grunt', 'flanker', 'tank', 'diver', 'sniper', 'splitter', 'mite', 'captor', 'raider'] as const

export function createRenderer(canvas: HTMLCanvasElement): Renderer {
  const screen = canvas.getContext('2d', { alpha: false })!
  const buf = document.createElement('canvas')
  const g = buf.getContext('2d', { alpha: false })!
  const sprites = createSpriteStore()
  const fx = createFx()
  const consoleState: ConsoleState = createConsoleState()
  /** The canvas as it was last measured, in CSS pixels. */
  let shape: Screen = { w: 240, h: 320 }
  let layout: Layout = computeLayout(shape)
  let lastX = 0
  let lastQX = 0
  let bank = 0
  let partnerBank = 0
  let sectorSeen = 0

  /** Ask for a sector's bitmaps while its card is up, so nothing arrives as a placeholder. */
  function preload(w: World): void {
    const def = SECTORS[w.sector - 1]
    if (!def) return
    for (const role of ROLES) sprites.want(enemyKind(def.gang, role))
    for (const b of def.bosses) sprites.want(`boss-${b}`)
    sprites.want(`bg-${w.sector}-a`)
    sprites.want(`bg-${w.sector}-b`)
    sprites.want(def.event.type === 'rescue' ? `stranded-${def.event.id}` : `rig-${def.event.id}`)
  }

  function resize(cssW: number, cssH: number, ratio: number, chrome: Chrome, fieldH = 0): Layout {
    shape = { w: Math.max(1, cssW), h: Math.max(1, cssH), ratio, ...chrome }
    layout = computeLayout(shape, fieldH)
    if (canvas.width !== layout.cw) canvas.width = layout.cw
    if (canvas.height !== layout.ch) canvas.height = layout.ch
    // Wide, a logical pixel is whole device pixels and stays hard. Narrow, CSS fits the backing store to the
    // screen by a few percent: `pixelated` there would make pixels of two sizes, the browser's own smoothing does not.
    canvas.style.imageRendering = layout.mode === 'wide' ? 'pixelated' : 'auto'
    buf.width = layout.lw
    buf.height = layout.lh
    return layout
  }

  function reset(w: World): void {
    resetFx(fx)
    resetConsole(consoleState)
    lastX = w.player.x
    lastQX = w.partner.x
    bank = partnerBank = 0
    sectorSeen = 0
    for (const n of ['ship-rex', 'ship-nova', 'ship-rex-bank', 'ship-nova-bank', 'valve-on', 'valve-off', 'console-left', 'console-right', 'console-band']) sprites.want(n)
    preload(w)
  }

  function tick(w: World, m: Monitor): void {
    takeEvents(fx, w)
    stepFx(fx)
    stepConsole(consoleState, w, m)
    // The bank follows the ship's sideways speed, with a little memory so it does not flutter.
    bank = bank * 0.6 + (w.player.x - lastX) * 0.4
    partnerBank = partnerBank * 0.6 + (w.partner.x - lastQX) * 0.4
    lastX = w.player.x
    lastQX = w.partner.x
    if (w.sector !== sectorSeen) { sectorSeen = w.sector; preload(w) }
  }

  function draw(w: World, m: Monitor, view: DrawView): void {
    const L = layout
    const f = L.field
    // The run keeps the height it began with; the frame was laid out for it (resize).
    const fh = w.h
    const under = Math.max(0, L.lh - f.y - fh)
    g.imageSmoothingEnabled = false
    g.fillStyle = C.desk
    g.fillRect(0, 0, L.lw, L.lh)

    let sx = 0
    let sy = 0
    if (fx.shake > 0 && !view.reduced) {
      const k = hash(w.tick, 77)
      const amp = Math.max(1, Math.round(fx.shakeAmp * Math.min(1, fx.shake / 10)))
      sx = (k % (amp * 2 + 1)) - amp
      sy = ((k >>> 8) % (amp * 2 + 1)) - amp
    }
    // The far moon of sector 5 is the Deaf Star: when the thing itself arrives, the far one goes, and stays gone.
    const b = w.boss
    const star = w.sector === 5 && b.active && b.id === 'deafstar'
    const hideBg = star || (w.sector === 5 && (w.stage === 'clear' || w.stage === 'ending')) ? 'bg-5-a' : undefined
    const hideShare = star && b.state === 'enter' ? Math.max(0, Math.min(1, (b.y + b.hh + 10) / (b.homeY + b.hh + 10))) : 1
    const fv = { h: fh, under, reduced: view.reduced, bank, partnerBank, hideBg, hideShare, boxes: view.boxes }
    // A frame wider than the field (a short narrow screen): the sky runs on either side of it.
    if (L.mode === 'band' && L.lw > f.w) {
      for (let x = (f.x % f.w) - f.w; x < L.lw; x += f.w) {
        if (x === f.x) continue
        g.save()
        g.beginPath()
        g.rect(x, f.y, f.w, fh + under)
        g.clip()
        g.translate(x, f.y)
        drawBackdrop(g, sprites, w.sector, w.tick, { ...fv, beside: true })
        g.restore()
      }
    }
    g.save()
    g.beginPath()
    g.rect(f.x, f.y, f.w, fh + under)
    g.clip()
    g.translate(f.x, f.y)
    drawBackdrop(g, sprites, w.sector, w.tick, fv)
    if (w.stage === 'ending') drawEnding(g, sprites, w, fx, fh)
    else {
      g.translate(sx, sy)
      drawField(g, sprites, w, fx, fv)
    }
    g.restore()
    if (w.slow > 0 && !view.reduced) {
      g.save()
      g.beginPath()
      g.rect(f.x, f.y, f.w, fh)
      g.clip()
      tearField(g, buf, f.x, f.y, w, fh)
      g.restore()
    }

    const hasLamps = drawConsole({ g, layout: L, sprites, world: w, monitor: m, fx, state: consoleState, view })
    if (!hasLamps) lampStack(g, f.x + 4, f.y + 12, w)

    screen.imageSmoothingEnabled = false
    screen.drawImage(buf, 0, 0, L.lw, L.lh, 0, 0, L.lw * L.scale, L.lh * L.scale)
  }

  function toField(cssX: number, cssY: number): { x: number; y: number } {
    return fieldPoint(layout, shape, cssX, cssY)
  }

  return {
    get layout() { return layout },
    get px() { return wholePx(layout, shape) },
    sprites, fx, resize, reset, tick, draw, toField,
  }
}
