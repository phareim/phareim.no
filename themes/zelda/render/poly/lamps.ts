/**
 * The polygon view's lamps, held steady. Pure: no canvas, no GPU.
 *
 * The lights the painters gather flicker with the clock (a torch's 0.85 + 0.15·sin(9t), a laser gate's
 * 0.75 + 0.25·sin(12t), a zapper's 0.5 + 0.3·sin(15t)). The classic and isometric views lay them into a smooth
 * light map, where that is a shimmer. This view lights every corner with them and then rounds the colour to the
 * 15-bit machine's with an ordered dither, so a lamp that changes by a per cent or two from one frame to the next
 * moves the dither's thresholds across everything it reaches: the lit world crawls, every frame. Here each lamp
 * keeps its strength from frame to frame (matched by colour and where it stands) and follows the painters' value
 * only slowly, through two smoothing steps, so a fire still breathes but no frame differs from the last by more
 * than the dither hides.
 *
 * The engine lights with sixteen lamps, the nearest the focus. A lamp holds its place among them while it fades
 * out (`LAMP_FADE`), and one that has come near enough takes a place once one is free and fades in: as the hero
 * walks, no lamp comes or goes at full strength. Standing still, the sixteen are the nearest, at full strength.
 */
import type { Lamp } from './engine'

/** A light as the painters gather it (`tiles.ts` `Light`). */
export interface RawLight { x: number; y: number; r: number; color: string; a: number }

/** The lamps the engine lights with, at most (`engine.ts`, `uLampPos[16]`). */
export const LAMP_CAP = 16
/** Each of the two smoothing steps' time constant, s: together about half a second, a fast flicker (1.5 to 2.5 Hz) down to a few per cent of its swing. */
export const LAMP_TAU = 0.35
/** How long a lamp takes to come into the sixteen or go out of them, s. */
export const LAMP_FADE = 0.3
/** How far a lamp may have moved since the last frame and still be the same one, tiles. */
const MATCH = 0.75

const NO_FIT = [1, 1] as const

interface Held { x: number; y: number; color: string; a1: number; a2: number; w: number; slot: boolean }

/** A '#rrggbb' colour as 0 … 1. */
function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1, 7), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/**
 * Make a lamp keeper for one view: called once a frame with the frame's lights, it gives the lamps to light
 * with, nearest the focus first, at most `LAMP_CAP`. `dt` is the frame's time (s; 0 holds everything as it
 * was); `gain` scales every lamp; `zOf` is the height a light stands at; `fit`, if given, a light's reach and
 * strength against a lamp's (a fire reaches further and burns brighter than the painters' 0 … 1 can say).
 */
/** The lab's control: every lamp's strength held where it is (the meter's `--freeze`). */
let frozen = false
export function freezeLamps(on: boolean): void { frozen = on }

export function createLampKeeper() {
  let held: Held[] = []
  return function steadyLamps(lights: readonly RawLight[], dt: number, focus: { x: number; y: number }, gain: number, zOf: (L: RawLight) => number, fit?: (L: RawLight) => readonly [number, number]): Lamp[] {
    const t = Math.max(0, Math.min(0.1, dt))
    const k = 1 - Math.exp(-t / LAMP_TAU)
    const step = t / LAMP_FADE
    const taken = new Uint8Array(held.length)
    const all: Array<{ L: RawLight; h: Held; d: number; fresh: boolean }> = []
    for (const L of lights) {
      const raw = Math.max(0, Math.min(1, L.a))
      // The same lamp as last frame: the nearest of its colour close by, not already claimed.
      let best = -1
      let bd = MATCH * MATCH
      for (let i = 0; i < held.length; i++) {
        const h = held[i]!
        if (taken[i] || h.color !== L.color) continue
        const d = (h.x - L.x) ** 2 + (h.y - L.y) ** 2
        if (d <= bd) { bd = d; best = i }
      }
      const was = best >= 0 ? held[best]! : null
      if (was) taken[best] = 1
      const a1 = was ? (frozen ? was.a1 : was.a1 + (raw - was.a1) * k) : raw
      const a2 = was ? (frozen ? was.a2 : was.a2 + (a1 - was.a2) * k) : raw
      all.push({ L, h: { x: L.x, y: L.y, color: L.color, a1, a2, w: was?.w ?? 0, slot: was?.slot ?? false }, d: Math.hypot(L.x - focus.x, L.y - focus.y), fresh: !was })
    }
    all.sort((a, b) => a.d - b.d)
    // The sixteen nearest are wanted; a lamp with a place keeps it until it has faded out of it.
    let free = LAMP_CAP
    for (let i = 0; i < all.length; i++) {
      const e = all[i]!
      if (!e.h.slot) continue
      e.h.w = i < LAMP_CAP ? Math.min(1, e.h.w + step) : Math.max(0, e.h.w - step)
      if (e.h.w <= 0 && i >= LAMP_CAP) e.h.slot = false
      else free--
    }
    for (let i = 0; i < LAMP_CAP && i < all.length && free > 0; i++) {
      const e = all[i]!
      if (e.h.slot) continue
      // (A light that was not there last frame, a shot or the first frame of a map, is there at once.)
      e.h.slot = true
      e.h.w = e.fresh ? 1 : step
      free--
    }
    held = all.map(e => e.h)
    const out: Lamp[] = []
    for (const e of all) {
      if (!e.h.slot || e.h.w <= 0) continue
      const f = fit ? fit(e.L) : NO_FIT
      const a = e.h.a2 * e.h.w * gain * f[1]
      const col = hex(e.L.color)
      out.push({ x: e.L.x, y: e.L.y, z: zOf(e.L), r: e.L.r * 1.15 * f[0], c: [col[0] * a, col[1] * a, col[2] * a] })
    }
    return out
  }
}
