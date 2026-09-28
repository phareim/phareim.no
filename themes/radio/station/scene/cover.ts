// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * A still of one place, square, for the lock screen's cover art
 * (MediaMetadata artwork). Painted by the same scene as the window, on a
 * detached canvas, in the mood of the bar that is sounding: the mode's
 * darkness, the intensity and the tonic as the accent colour.
 *
 * Covers are cached by place, mode, intensity and tonic; a new one costs a
 * couple of scene frames.
 */
import type { BarPlan, Layer, Mode, VisualState } from '../engine/types.ts'
import { createScene } from './index.ts'

export interface CoverMood {
  landscape: string
  mode: Mode
  intensity: number
  tonic: number
}

/** Painted at one logical pixel per pixel, then doubled with hard edges. */
const PAINT = 256
const SIZE = 512
const KEEP = 24
const cache = new Map<string, string>()

const LEVELS = { ambience: 1, drone: 0.5, pad: 0.8, bass: 0.7, drums: 0.6, perc: 0.3, arp: 0.6, lead: 0.4, counter: 0, bells: 0.3 } as Record<Layer, number>

function visual(m: CoverMood): VisualState {
  const bar = {
    index: 0, bpmStart: 100, bpmEnd: 100, swing: 0,
    chords: [{ from: 0, len: 16, chord: { root: m.tonic, bass: m.tonic, tones: [0, 7], symbol: '', degree: '' } }],
    key: { tonic: m.tonic, mode: m.mode }, scale: [], notes: [], drums: [], mix: {},
    fx: { reverb: 0, delay: 0, reverbSize: 2, tone: 1, grit: 0, crush: 0, pump: 0, width: 1 },
    ambience: {}, ambienceFadeBars: 1,
    meta: {
      landscape: m.landscape,
      scene: { from: m.landscape, to: m.landscape, blendStart: 1, blendEnd: 1 },
      phraseBar: 0, phraseBars: 8, section: '', active: [], upcoming: [],
      transition: { kind: 'none', from: m.landscape, to: m.landscape, progress: 1, note: '' },
      intensity: m.intensity,
    },
  } as BarPlan
  const scene = { from: m.landscape, to: m.landscape, blend: 1 }
  return { bar, step: 0, scene, beat: 0, levels: LEVELS, recent: [], time: 0, playing: true }
}

/** A JPEG data URL of the place in this mood, or '' where canvas is not available. */
export function coverURL(m: CoverMood): string {
  const key = [m.landscape, m.mode, Math.round(m.intensity), m.tonic].join('|')
  const hit = cache.get(key)
  if (hit) {
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  let url = ''
  try {
    const canvas = document.createElement('canvas')
    const scene = createScene(canvas)
    scene.resize(PAINT, PAINT, 1)
    const v = visual(m)
    // The first frame snaps the mood; the second lets anything that eases in settle a little.
    scene.frame(v, 0)
    scene.frame(v, 100)
    scene.dispose()
    const out = document.createElement('canvas')
    out.width = out.height = SIZE
    const g = out.getContext('2d')!
    g.imageSmoothingEnabled = false
    g.drawImage(canvas, 0, 0, SIZE, SIZE)
    // JPEG: the scanlines and grain make a PNG of this ~300 KB; this is a fifth of that.
    url = out.toDataURL('image/jpeg', 0.9)
  } catch {
    return ''
  }
  cache.set(key, url)
  if (cache.size > KEEP) cache.delete(cache.keys().next().value!)
  return url
}
