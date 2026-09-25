// Vendored from phareim/radio@78b7024 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The radio's painted places, in Neon Shrine's pixel look.
 *
 * Each landscape has a place (`scenes/<id>.ts`) drawn into a small logical
 * buffer and scaled up by a whole number on the vendored pixel stage
 * (`pixel/stage.ts`): lit by its own light map, then bloom, scanlines and
 * vignette. The music reaches the places gently through `FrameCtx`: the
 * kick as `beat`, the smoothed intensity, the mode's darkness, the chord
 * root as an accent colour, and the notes that just began.
 *
 * A change of place is an ordered-dither dissolve: both places are painted
 * and lit apart, then the new one shows through an 8×8 Bayer threshold on
 * the blend, its sky a little ahead of its ground.
 */
import type { Layer, Mode, VisualState } from '../engine/types.ts'
import { createPixelStage, makeCanvas } from './pixel/stage.ts'
import { clamp, createLighter, ditherPattern, melodic, type FrameCtx, type G, type NoteHit, type Place } from './lib/kit.ts'
import { createCoast } from './scenes/coast.ts'
import { createSummit } from './scenes/summit.ts'
import { createJungle } from './scenes/jungle.ts'
import { createFrostwood } from './scenes/frostwood.ts'
import { createVillage } from './scenes/village.ts'
import { createNightdrive } from './scenes/nightdrive.ts'
import { createVoyager } from './scenes/voyager.ts'
import { createDeepspace } from './scenes/deepspace.ts'
import { createNeonrain } from './scenes/neonrain.ts'
import { createCaverns } from './scenes/caverns.ts'

export interface Scene {
  resize(cssW: number, cssH: number, dpr: number): void
  /** Paint one frame. `v` from player.visual(); `now` in ms (performance.now()). */
  frame(v: VisualState, now: number): void
  dispose(): void
}

const FACTORIES: Record<string, () => Place> = {
  coast: createCoast,
  summit: createSummit,
  jungle: createJungle,
  frostwood: createFrostwood,
  village: createVillage,
  nightdrive: createNightdrive,
  voyager: createVoyager,
  deepspace: createDeepspace,
  neonrain: createNeonrain,
  caverns: createCaverns,
}

export const SCENE_IDS: readonly string[] = Object.keys(FACTORIES)

/** Mood darkness per mode (the brightness ladder). */
const DARK: Record<Mode, number> = { lydian: 0, ionian: 0.17, mixolydian: 0.33, dorian: 0.5, aeolian: 0.67, phrygian: 0.85, harmonicMinor: 0.9 }

/** Chord roots round the circle of fifths → neighbouring neon hues. Index by pitch class. */
const ROOT_COLORS = (() => {
  const wheel = ['#2ff3ff', '#3fd8b0', '#b6ff4a', '#ffd23f', '#ff8a3d', '#ff3b5c', '#ff2fa0', '#ff8ae0', '#9a4ff0', '#6a6cff', '#2f8fe0', '#7ce4ff']
  const out: string[] = []
  for (let pc = 0; pc < 12; pc++) out[pc] = wheel[(pc * 7) % 12]!
  return out
})()

const EMPTY_LEVELS = { ambience: 0, drone: 0, pad: 0, bass: 0, drums: 0, perc: 0, arp: 0, lead: 0, counter: 0, bells: 0 } as Record<Layer, number>

function rgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1, 7), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}

function hex(c: [number, number, number]): string {
  return '#' + ((1 << 24) | (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2])).toString(16).slice(1)
}

export function createScene(canvas: HTMLCanvasElement): Scene {
  const stage = createPixelStage(canvas, { minW: 256, minH: 160, bg: '#0b0616' })
  const places = new Map<string, Place>()
  /** Size each place was laid out for. */
  const laidOut = new Map<string, string>()
  const lighter = createLighter()
  let bufA = makeCanvas(1, 1)
  let bufB = makeCanvas(1, 1)
  let maskC = makeCanvas(1, 1)
  let size = ''
  let last = -1
  const ctx: FrameCtx = { t: 0, dt: 0, beat: 0, intensity: 1, energy: 0.25, dark: 0.4, accent: '#2ff3ff', notes: [], levels: EMPTY_LEVELS }
  let accent: [number, number, number] = rgb('#2ff3ff')
  const seen = new Map<string, number>()
  let lastAudio = -1
  const notes: NoteHit[] = []

  function place(id: string): Place {
    const key = FACTORIES[id] ? id : 'coast'
    let p = places.get(key)
    if (!p) { p = FACTORIES[key]!(); places.set(key, p) }
    if (laidOut.get(key) !== size) { p.layout(stage.vw, stage.vh); laidOut.set(key, size) }
    return p
  }

  function resize(cssW: number, cssH: number, dpr: number) {
    const portrait = cssH > cssW * 1.1
    stage.resize(cssW, cssH, dpr, portrait ? 180 : 256, portrait ? 240 : 160)
    size = stage.vw + 'x' + stage.vh
    bufA = makeCanvas(stage.vw, stage.vh)
    bufB = makeCanvas(stage.vw, stage.vh)
    maskC = makeCanvas(stage.vw, stage.vh)
    for (const b of [bufA, bufB]) b.getContext('2d')!.imageSmoothingEnabled = false
  }

  /** Update the shared frame context from the player's state. */
  function update(v: VisualState, now: number) {
    const dt = last < 0 ? 1 / 60 : clamp((now - last) / 1000, 0, 0.1)
    last = now
    ctx.dt = dt
    ctx.t += dt
    ctx.beat = clamp(v.beat || 0, 0, 1)
    ctx.levels = v.levels ?? EMPTY_LEVELS
    const bar = v.bar
    const target = bar ? clamp(bar.meta.intensity, 0, 4) : 1
    ctx.intensity += (target - ctx.intensity) * (1 - Math.exp(-dt / 2.5))
    ctx.energy = ctx.intensity / 4
    const dark = bar ? DARK[bar.key.mode] ?? 0.5 : 0.4
    ctx.dark += (dark - ctx.dark) * (1 - Math.exp(-dt / 3))
    if (bar && bar.chords.length) {
      const span = bar.chords.find(s => v.step >= s.from && v.step < s.from + s.len) ?? bar.chords[0]!
      const root = Number.isFinite(span.chord.root) ? span.chord.root : 0
      const want = rgb(ROOT_COLORS[((Math.round(root) % 12) + 12) % 12]!)
      const k = 1 - Math.exp(-dt / 1.2)
      accent = [accent[0] + (want[0] - accent[0]) * k, accent[1] + (want[1] - accent[1]) * k, accent[2] + (want[2] - accent[2]) * k]
      ctx.accent = hex(accent)
    }
    // Fresh notes: those whose start time we have not seen, begun in the last quarter second.
    notes.length = 0
    const time = v.time || 0
    if (time < lastAudio - 0.5) seen.clear()
    lastAudio = time
    for (const r of v.recent ?? []) {
      if (!melodic(r.layer) || r.age > 0.25) continue
      const start = time - r.age
      const key = r.layer + ':' + r.midi + ':' + Math.round(start * 50)
      if (seen.has(key)) continue
      seen.set(key, start)
      notes.push({ layer: r.layer, midi: r.midi, h: clamp((r.midi - 48) / 48, 0, 1) })
    }
    if (seen.size > 200) for (const [k, s] of seen) if (s < time - 4) seen.delete(k)
    ctx.notes = notes
  }

  /** Paint and light one place into `g`; its lights go to the stage's bloom at `weight`. */
  function paint(p: Place, g: G, weight: number) {
    lighter.reset()
    g.globalAlpha = 1
    g.globalCompositeOperation = 'source-over'
    p.draw(g, ctx, lighter)
    lighter.apply(g, stage.vw, stage.vh, p.ambient(ctx))
    for (const L of lighter.list) stage.light(L.x, L.y, L.r, L.color, L.a * weight)
  }

  function frame(v: VisualState, now: number) {
    if (!size) return
    update(v, now)
    let from = 'coast'
    let to = 'coast'
    let blend = 1
    if (v.bar && v.scene) {
      from = FACTORIES[v.scene.from] ? v.scene.from : 'coast'
      to = FACTORIES[v.scene.to] ? v.scene.to : 'coast'
      blend = clamp(v.scene.blend, 0, 1)
    }
    const g = stage.begin()
    if (from === to || blend >= 0.999 || blend <= 0.001) {
      const p = place(blend <= 0.001 ? from : to)
      paint(p, g, 1)
      stage.present({ ambient: null, bloom: p.bloom ?? 1 })
      return
    }
    const a = place(from)
    const b = place(to)
    const ga = bufA.getContext('2d')!
    const gb = bufB.getContext('2d')!
    paint(a, ga, 1 - blend)
    paint(b, gb, blend)
    // Keep the new place only where the Bayer threshold is under this row's
    // blend. The mask is built on its own canvas: destination-in clears
    // everything outside the shape it draws, so it must be one full-size blit.
    const w = stage.vw
    const h = stage.vh
    const hzB = Math.max(1, b.horizon())
    const mg = maskC.getContext('2d')!
    mg.clearRect(0, 0, w, h)
    let y = 0
    while (y < h) {
      const level = rowLevel(y, blend, hzB)
      let y2 = y + 1
      while (y2 < h && rowLevel(y2, blend, hzB) === level) y2++
      const pat = level >= 64 ? '#ffffff' : ditherPattern('#ffffff', level)
      if (pat) {
        mg.fillStyle = pat
        mg.fillRect(0, y, w, y2 - y)
      }
      y = y2
    }
    gb.globalCompositeOperation = 'destination-in'
    gb.drawImage(maskC, 0, 0)
    gb.globalCompositeOperation = 'source-over'
    g.drawImage(bufA, 0, 0)
    g.drawImage(bufB, 0, 0)
    stage.present({ ambient: null, bloom: (a.bloom ?? 1) * (1 - blend) + (b.bloom ?? 1) * blend })
  }

  return {
    resize,
    frame,
    dispose() {
      places.clear()
      laidOut.clear()
      seen.clear()
      size = ''
    },
  }
}

/** Dissolve level 0..64 for a row: the target's sky leads its ground. */
function rowLevel(y: number, blend: number, hz: number): number {
  const lead = 0.6 * (1 - clamp(y / hz, 0, 1))
  return Math.round(clamp(blend * (1 + lead), 0, 1) * 64)
}

/** For callers that want the accent colours (e.g. the UI). */
export function rootColor(pc: number): string {
  return ROOT_COLORS[((pc % 12) + 12) % 12]!
}

