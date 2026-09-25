/**
 * Night of the Dead Battery — speech blips. Animal Crossing–style babble:
 * one syllable per two or three letters, spread over the line's time on
 * screen, pitched and coloured per speaker. The vowel of each syllable picks
 * its step on the speaker's scale, so a line always "says" the same tune;
 * statements drift down at the end, questions go up, exclamations are
 * brighter. Planning is pure (tested); playing uses the kit.
 */
import * as K from './kit'
import type { Kit } from './kit'
import type { ActorId } from '../types'

type Kind = 'tone' | 'xylo' | 'breath' | 'growl' | 'mew' | 'chirp' | 'radio'

export interface Speaker {
  kind: Kind
  /** MIDI note of the scale's floor. */
  base: number
  /** Scale steps in semitones. */
  scale: readonly number[]
  /** Shortest gap between syllables, seconds (the speaker's top speed). */
  minGap: number
  /** Syllable length, seconds. */
  len: number
  wave: OscillatorType
  /** Filter colour: centre (bandpass) or cutoff (lowpass). */
  f: number
  vol: number
}

export const SPEAKERS: Record<ActorId, Speaker> = {
  // Mid and nasal: a square through a narrow band. Fretful major-ish steps.
  kjell: { kind: 'tone', base: 57, scale: [0, 2, 4, 5, 7], minGap: 0.075, len: 0.07, wave: 'square', f: 1150, vol: 1.86 },
  // Low and round: a triangle, soft, unhurried.
  dag: { kind: 'tone', base: 47, scale: [0, 2, 3, 5, 7], minGap: 0.11, len: 0.11, wave: 'triangle', f: 700, vol: 0.85 },
  // High and fast.
  espen: { kind: 'tone', base: 64, scale: [0, 2, 4, 7, 9, 12], minGap: 0.058, len: 0.05, wave: 'square', f: 2400, vol: 2.4 },
  // Clacky xylophone bones.
  bones: { kind: 'xylo', base: 72, scale: [0, 2, 4, 7, 9], minGap: 0.08, len: 0.06, wave: 'sine', f: 0, vol: 1.4 },
  // Breathy, wavery, with an echo from the other side.
  hedvig: { kind: 'breath', base: 69, scale: [0, 1, 3, 5, 7, 8], minGap: 0.13, len: 0.14, wave: 'sine', f: 0, vol: 0.6 },
  // A very low growl.
  gustav: { kind: 'growl', base: 31, scale: [0, 1, 3], minGap: 0.2, len: 0.2, wave: 'sawtooth', f: 400, vol: 0.8 },
  cat: { kind: 'mew', base: 76, scale: [0, 2, 5, 7], minGap: 0.14, len: 0.12, wave: 'triangle', f: 1600, vol: 0.72 },
  bat: { kind: 'chirp', base: 90, scale: [0, 3, 5, 7, 10], minGap: 0.07, len: 0.05, wave: 'sine', f: 0, vol: 1.5 },
  // Crisp and precise.
  professor: { kind: 'tone', base: 62, scale: [0, 2, 4, 5, 7, 9], minGap: 0.068, len: 0.055, wave: 'square', f: 1700, vol: 2.1 },
  // A voice on an old radio.
  narrator: { kind: 'radio', base: 50, scale: [0, 2, 3, 5, 7], minGap: 0.09, len: 0.09, wave: 'sawtooth', f: 1400, vol: 1.37 },
}

export interface Syl {
  /** Seconds after the line starts. */
  t: number
  m: number
  v: number
}

const VOWEL: Record<string, number> = { a: 0, æ: 0, o: 1, å: 1, ø: 1, u: 2, e: 3, i: 4, y: 4 }

/** The syllables of a line lasting `dur` seconds. */
export function planSpeech(who: ActorId, text: string, dur: number): Syl[] {
  const sp = SPEAKERS[who] ?? SPEAKERS.narrator
  const slots: ({ deg: number; first: boolean } | null)[] = []
  for (const word of text.toLowerCase().split(/\s+/)) {
    const letters = word.replace(/[^a-z0-9æøå]/g, '')
    if (letters.length) {
      const n = Math.max(1, Math.round(letters.length / 2.5))
      const size = letters.length / n
      for (let j = 0; j < n; j++) {
        const chunk = letters.slice(Math.floor(j * size), Math.max(Math.floor(j * size) + 1, Math.floor((j + 1) * size)))
        const v = [...chunk].find(c => c in VOWEL)
        slots.push({ deg: v ? VOWEL[v]! : 2, first: j === 0 })
      }
    }
    const end = word[word.length - 1] ?? ''
    if (',;:'.includes(end) && end) slots.push(null)
    else if ('.!?…'.includes(end) && end) slots.push(null, null)
  }
  while (slots.length && slots[slots.length - 1] === null) slots.pop()
  // Very long lines: keep every syllable but no more than ~48.
  const voiced = slots.filter(Boolean).length
  if (!voiced) return []
  const cut = voiced > 48 ? 48 / voiced : 1
  const gap = K.clamp((dur * 0.86) / slots.length, sp.minGap, 0.2)
  const trimmed = text.trim()
  const question = trimmed.endsWith('?')
  const shout = trimmed.endsWith('!')
  const out: Syl[] = []
  let i = 0
  let acc = 0
  slots.forEach((s, k) => {
    if (!s) return
    acc += cut
    if (acc < 1 && cut < 1) return
    acc -= 1
    const pos = i / Math.max(1, voiced - 1)
    let step = s.deg
    // Declination: statements sink a step or two by the end.
    if (!question) step -= Math.round(pos * 1.6)
    if (question && i >= voiced - 2) step += 2
    if (shout) step += 1
    const scale = sp.scale
    const idx = ((step % scale.length) + scale.length) % scale.length
    const oct = Math.floor(step / scale.length)
    const m = sp.base + scale[idx]! + 12 * oct
    const v = (s.first ? 1 : 0.82) * (shout ? 1.2 : 1)
    out.push({ t: k * gap, m, v })
    i++
  })
  return out.filter(s => s.t < dur)
}

/** One syllable. */
export function playSyl(k: Kit, out: AudioNode, echo: AudioNode, who: ActorId, s: Syl, t: number): void {
  const sp = SPEAKERS[who] ?? SPEAKERS.narrator
  const f = K.hz(s.m)
  const v = sp.vol * s.v
  const len = sp.len
  const end = t + len + 0.1
  const g = K.gain(k, 0)
  g.connect(out)
  switch (sp.kind) {
    case 'tone': {
      const o = K.osc(k, sp.wave, f * 1.04, t, end)
      o.frequency.exponentialRampToValueAtTime(f, t + len * 0.6)
      const fl = K.filt(k, sp.wave === 'triangle' ? 'lowpass' : 'bandpass', sp.f, sp.wave === 'triangle' ? 0.7 : 1.6)
      o.connect(fl)
      fl.connect(g)
      K.ahr(g.gain, t, 0.22 * v, 0.006, len * 0.45, len * 0.55)
      break
    }
    case 'xylo': {
      K.osc(k, 'sine', f, t, end).connect(g)
      const g2 = K.gain(k, 0)
      K.pluck(g2.gain, t, 0.08 * v, 0.001, 0.03)
      K.osc(k, 'sine', f * 3.93, t, t + 0.06).connect(g2)
      g2.connect(out)
      K.pluck(g.gain, t, 0.2 * v, 0.001, 0.1)
      break
    }
    case 'breath': {
      const o = K.osc(k, 'sine', f, t, end + 0.1)
      K.vibrato(k, o.detune, t, end + 0.1, 6.5, 45, 0.02)
      o.connect(g)
      const n = K.noise(k, t, len + 0.15)
      const bp = K.filt(k, 'bandpass', f * 2, 4)
      const ng = K.gain(k, 0.9)
      n.connect(bp)
      bp.connect(ng)
      ng.connect(g)
      K.ahr(g.gain, t, 0.16 * v, 0.035, len * 0.4, len * 0.7)
      g.connect(echo)
      break
    }
    case 'growl': {
      const o = K.osc(k, 'sawtooth', f, t, end + 0.05)
      o.frequency.linearRampToValueAtTime(f * 1.12, t + len * 0.4)
      o.frequency.linearRampToValueAtTime(f * 0.94, t + len)
      const lp = K.filt(k, 'lowpass', sp.f, 3)
      const am = K.gain(k, 0.6)
      const lfo = K.osc(k, 'square', 29, t, end + 0.05)
      const d = K.gain(k, 0.4)
      lfo.connect(d)
      d.connect(am.gain)
      o.connect(lp)
      lp.connect(am)
      am.connect(g)
      K.ahr(g.gain, t, 0.3 * v, 0.03, len * 0.5, len * 0.5)
      break
    }
    case 'mew': {
      const o = K.osc(k, sp.wave, f * 0.85, t, end)
      o.frequency.linearRampToValueAtTime(f * 1.15, t + len * 0.4)
      o.frequency.linearRampToValueAtTime(f * 0.9, t + len)
      const bp = K.filt(k, 'bandpass', sp.f, 1.5)
      o.connect(bp)
      bp.connect(g)
      K.ahr(g.gain, t, 0.3 * v, 0.02, len * 0.4, len * 0.6)
      break
    }
    case 'chirp': {
      const o = K.osc(k, 'sine', f, t, end)
      o.frequency.exponentialRampToValueAtTime(f * 1.4, t + len)
      o.connect(g)
      K.pluck(g.gain, t, 0.12 * v, 0.003, len)
      break
    }
    case 'radio': {
      const o = K.osc(k, 'sawtooth', f * 1.03, t, end)
      o.frequency.exponentialRampToValueAtTime(f, t + len * 0.5)
      const bp = K.filt(k, 'bandpass', sp.f, 2.8)
      const hp = K.filt(k, 'highpass', 380)
      o.connect(bp)
      bp.connect(hp)
      hp.connect(g)
      const n = K.noise(k, t, len + 0.05)
      const nh = K.filt(k, 'highpass', 3000)
      const ng = K.gain(k, 0.05)
      n.connect(nh)
      nh.connect(ng)
      ng.connect(g)
      K.ahr(g.gain, t, 0.5 * v, 0.006, len * 0.5, len * 0.5)
      break
    }
  }
}
