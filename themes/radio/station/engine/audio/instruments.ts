// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The played instruments (jam's piano, guitar and bass; any layer may use
 * them): keys.piano, keys.felt, guitar.nylon, guitar.steel, guitar.mute,
 * bass.finger, and the acoustic end of the Era knob: bass.upright (plucked
 * gut string) and mallet.vibes (vibraphone).
 *
 * Each note is a buffer rendered in JS (render.ts: Karplus-Strong strings,
 * additive pianos and vibraphone bars), cached per voice, pitch, velocity
 * bucket and round-robin variant in `res.bufs`, played through a gated VCA:
 * the string, piano or bar rings on its own decay while the note is held,
 * and the release (end of `dur`, or NoteHandle.release) damps it like a
 * finger, a damper or the vibraphone's damper bar. Two nodes a note (three
 * with a pan). The vibraphone's notes play into one motor tremolo per layer
 * (`v.cache`), so they pulse together.
 *
 * Velocity picks the bucket (brightness: pick attack, hammer and mallet
 * hardness) and scales the level; the level trims sit these voices at the
 * loudness of their neighbours (plucks and mallets, the other basses) in
 * tests/audio-harness.
 */
import type { VoiceId, NoteEvent } from '../types.ts'
import { type VoiceCtx, type NoteHandle, begin, envelope, finish, gain, hz, clamp, velAmp } from './synth.ts'
import { renderPluck, renderPiano, renderVibes, type PluckSpec } from './render.ts'

type Patch = (v: VoiceCtx, midi: number, at: number, dur: number, vel: number, opts: NoteEvent['opts'], pan: number) => NoteHandle

export type InstrumentId =
  | 'keys.piano' | 'keys.felt' | 'guitar.nylon' | 'guitar.steel' | 'guitar.mute' | 'bass.finger'
  | 'bass.upright' | 'mallet.vibes'

/** Loudness trims (linear), calibrated with tests/audio-harness like voices.ts LEVEL. */
export const INSTRUMENT_LEVEL: Record<InstrumentId, number> = {
  'keys.piano': 0.314, 'keys.felt': 0.345,
  'guitar.nylon': 0.31, 'guitar.steel': 0.233, 'guitar.mute': 0.36, 'bass.finger': 0.24,
  'bass.upright': 0.254, 'mallet.vibes': 0.356,
}

/** Round-robin variants per pitch, so repeated notes are not identical. */
const VARIANTS: Record<InstrumentId, number> = {
  'keys.piano': 1, 'keys.felt': 1, 'guitar.nylon': 2, 'guitar.steel': 2, 'guitar.mute': 3, 'bass.finger': 2,
  'bass.upright': 2, 'mallet.vibes': 1,
}
const turn = new Map<string, number>()

/** Velocity bucket centres; a note renders at the nearest one and scales its level by the rest. */
const PLUCK_BUCKETS = [0.35, 0.62, 0.9]
const PIANO_BUCKETS = [0.28, 0.5, 0.72, 0.92]

function bucket(vel: number, centres: readonly number[]): number {
  let best = 0
  for (let i = 1; i < centres.length; i++) if (Math.abs(centres[i]! - vel) < Math.abs(centres[best]! - vel)) best = i
  return best
}

/**
 * Play a rendered buffer as a gated note. `release` is the damping time (to
 * about -55 dB). The note ends where the buffer does if that comes first.
 */
function playRendered(
  v: VoiceCtx, id: InstrumentId, key: string, render: () => Float32Array,
  at: number, dur: number, vel: number, pan: number, release: number, dest: AudioNode = v.out.input,
): NoteHandle {
  const n = begin(v.res, at, dest, pan)
  const buf = v.res.bufs.get(key, render)
  const src = v.ac.createBufferSource()
  src.buffer = buf
  // Grit: the same few cents of random spread the oscillator voices get.
  const cents = v.res.grit * (Math.random() * 2 - 1) * 5
  const rate = Math.pow(2, cents / 1200)
  if (cents) src.playbackRate.value = rate
  src.connect(n.amp)
  src.start(at)
  n.srcs.push(src)
  const env = envelope(n, dur, { peak: INSTRUMENT_LEVEL[id] * velAmp(vel), a: 0.001, d: 1, s: 1, r: release })
  const bufEnd = at + buf.duration / rate + 0.005
  return finish(n, { end: Math.min(env.end, bufEnd), relAt: env.relAt }, release, at + dur)
}

function variant(id: InstrumentId, midi: number): number {
  const k = `${id}|${midi}`
  const i = ((turn.get(k) ?? -1) + 1) % VARIANTS[id]
  turn.set(k, i)
  if (turn.size > 512) turn.clear()
  return i
}

// ---- strings ---------------------------------------------------------------------------

interface StringVoice {
  /** The render spec for a pitch and bucket velocity. */
  spec(midi: number, f: number, vel: number): Omit<PluckSpec, 'sr' | 'f' | 'seed'>
  /** Damping time when the note is let go. */
  release(midi: number): number
}

const kt = (x: number, midi: number, ref: number, per: number) => x * Math.pow(2, -(midi - ref) / per)

type StringId = 'guitar.nylon' | 'guitar.steel' | 'guitar.mute' | 'bass.finger' | 'bass.upright'

const STRINGS: Record<StringId, StringVoice> = {
  // Round and soft: a flesh-and-nail pluck mid-string, the highs die quickly, a woody body.
  'guitar.nylon': {
    spec: (m, _f, vel) => {
      const t60 = clamp(kt(5, m, 52, 20), 1, 6)
      return {
        t60, hiT60: clamp(t60 * 0.09, 0.12, 0.5), hiHz: 2500,
        exciteHz: (700 + 2800 * vel * vel) * (m > 64 ? 1.3 : 1), pos: 0.2, maxDur: 5,
        body: [[95, 1.6, 4], [205, 1.4, 2.5], [2800, 0.8, -2]], tone: 6000,
      }
    },
    release: m => clamp(kt(0.12, m, 52, 36), 0.06, 0.16),
  },
  // Brighter, more ring: a pick near the bridge, highs that last, a little presence.
  'guitar.steel': {
    spec: (m, _f, vel) => {
      const t60 = clamp(kt(7, m, 52, 20), 1.4, 7)
      return {
        t60, hiT60: clamp(t60 * 0.22, 0.3, 1.5), hiHz: 3000,
        exciteHz: 1500 + 5000 * vel * vel, pos: 0.13, maxDur: 6,
        body: [[110, 1.6, 3.5], [230, 1.4, 2], [2400, 0.9, 1.5]], tone: 8000,
      }
    },
    release: m => clamp(kt(0.14, m, 52, 36), 0.07, 0.18),
  },
  // Palm mute: the hand on the bridge kills the string in a few tenths, and thumps.
  'guitar.mute': {
    spec: (m, _f, vel) => {
      const t60 = clamp(kt(0.4, m, 52, 30), 0.16, 0.5)
      return {
        t60, hiT60: t60 * 0.18, hiHz: 1500,
        exciteHz: 450 + 1500 * vel * vel, pos: 0.16, maxDur: 0.7,
        body: [[105, 1.4, 4], [220, 1.4, 2]], tone: 4500, thump: 0.5,
      }
    },
    release: () => 0.05,
  },
  // Fingered electric bass: a soft round pluck, warm low end, the finger's thump.
  'bass.finger': {
    spec: (m, _f, vel) => {
      const t60 = clamp(kt(4, m, 40, 24), 1.2, 5)
      return {
        t60, hiT60: 0.3, hiHz: 1200,
        exciteHz: 300 + 1400 * vel * vel, pos: 0.24, maxDur: 4,
        body: [[70, 1.2, 2], [700, 1, -2]], tone: 2800, thump: 0.35,
      }
    },
    release: m => clamp(kt(0.08, m, 40, 36), 0.05, 0.1),
  },
  // Upright bass pizzicato: a gut string plucked with the side of the finger, dark and short, a big thump,
  // the wooden body's low resonances (air and top plate) around 90-250 Hz and a dip where a bass guitar's
  // pickup would bark.
  'bass.upright': {
    spec: (m, _f, vel) => {
      const t60 = clamp(kt(1.9, m, 40, 24), 0.8, 2.4)
      return {
        t60, hiT60: 0.14, hiHz: 900,
        exciteHz: 220 + 900 * vel * vel, pos: 0.3, maxDur: 2.6,
        body: [[98, 1.3, 4], [165, 1.6, 3], [240, 1.8, 3.5], [650, 1, -3]], tone: 2000, thump: 0.75,
      }
    },
    release: m => clamp(kt(0.07, m, 40, 36), 0.04, 0.09),
  },
}

/** Render one note of an instrument (what the cache holds): for tests and offline listening. */
export function renderInstrument(id: InstrumentId, midi: number, vel: number, sr: number, variantIndex = 0): Float32Array {
  const m = Math.round(midi)
  if (id === 'keys.piano' || id === 'keys.felt') {
    const b = bucket(vel, PIANO_BUCKETS)
    const felt = id === 'keys.felt'
    return renderPiano({ sr, midi: m, vel: PIANO_BUCKETS[b]!, felt, maxDur: felt ? 4 : 6, seed: m * 977 + b })
  }
  if (id === 'mallet.vibes') {
    const b = bucket(vel, PLUCK_BUCKETS)
    return renderVibes({ sr, midi: m, vel: PLUCK_BUCKETS[b]!, maxDur: 6, seed: m * 613 + b })
  }
  const b = bucket(vel, PLUCK_BUCKETS)
  const f = hz(m)
  return renderPluck({ sr, f, seed: (m * 131 + b * 17 + variantIndex * 7919) >>> 0, ...STRINGS[id].spec(m, f, PLUCK_BUCKETS[b]!) })
}

function stringPatch(id: keyof typeof STRINGS): Patch {
  const sv = STRINGS[id]
  return (v, midi, at, dur, vel, _o, pan) => {
    const m = Math.round(midi)
    const k = variant(id, m)
    const key = `${id}|${m}|${bucket(vel, PLUCK_BUCKETS)}|${k}`
    return playRendered(v, id, key, () => renderInstrument(id, m, vel, v.ac.sampleRate, k), at, dur, vel, pan, sv.release(m))
  }
}

// ---- vibraphone ---------------------------------------------------------------------------

/**
 * The vibraphone's motor: rotating discs in the resonators open and close
 * them, a tremolo of about 5 Hz on everything the bars play. One per layer,
 * built on first use; lives for the session.
 */
function motor(v: VoiceCtx): AudioNode {
  const hit = v.cache.get('vibes.motor')
  if (hit) return hit
  const ac = v.ac
  const trem = gain(ac, 0.74)
  const lfo = ac.createOscillator()
  lfo.frequency.value = 4.6 + Math.random() * 0.8
  const depth = gain(ac, 0.26)
  lfo.connect(depth)
  depth.connect(trem.gain)
  lfo.start(ac.currentTime)
  trem.connect(v.out.input)
  v.cache.set('vibes.motor', trem)
  return trem
}

/** Vibraphone: the rendered bar through the layer's motor tremolo; the damper bar comes down at the end of `dur`. */
const vibesPatch: Patch = (v, midi, at, dur, vel, _o, pan) => {
  const id = 'mallet.vibes'
  const m = Math.round(midi)
  const key = `${id}|${m}|${bucket(vel, PLUCK_BUCKETS)}`
  return playRendered(v, id, key, () => renderInstrument(id, m, vel, v.ac.sampleRate), at, dur, vel, pan, 0.3, motor(v))
}

// ---- pianos --------------------------------------------------------------------------------

function pianoPatch(id: 'keys.piano' | 'keys.felt'): Patch {
  const felt = id === 'keys.felt'
  return (v, midi, at, dur, vel, _o, pan) => {
    const m = Math.round(midi)
    const key = `${id}|${m}|${bucket(vel, PIANO_BUCKETS)}`
    // The damper: slower on the long bass strings.
    const release = clamp(kt(felt ? 0.22 : 0.3, m, 40, 30), 0.1, 0.35)
    return playRendered(v, id, key, () => renderInstrument(id, m, vel, v.ac.sampleRate), at, dur, vel, pan, release)
  }
}

export const INSTRUMENTS: Record<InstrumentId, Patch> = {
  'keys.piano': pianoPatch('keys.piano'),
  'keys.felt': pianoPatch('keys.felt'),
  'guitar.nylon': stringPatch('guitar.nylon'),
  'guitar.steel': stringPatch('guitar.steel'),
  'guitar.mute': stringPatch('guitar.mute'),
  'bass.finger': stringPatch('bass.finger'),
  'bass.upright': stringPatch('bass.upright'),
  'mallet.vibes': vibesPatch,
}

/** Every instrument id is a VoiceId (compile-time check). */
const _ids: VoiceId[] = Object.keys(INSTRUMENTS) as InstrumentId[]
void _ids
