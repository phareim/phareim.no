// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Orchestration: which voice plays each layer, section by section.
 *
 * A landscape keeps its own voices in its home sections (A), so the place
 * stays recognisable. The contrast section (B) hands the melody, the arp,
 * now and then the bass or the pad to a related instrument; the varied
 * section (A2) recolours the arp or the counter line; and when the home
 * theme returns after a contrast at drive or surge, a second instrument
 * doubles the lead an octave below.
 *
 * The alternatives come from `Landscape.alt` when the landscape names them,
 * else from KIN: for each voice, instruments of a similar character that
 * can stand in for it (jam's piano, felt piano, guitars and fingered bass
 * among them), so composed channels are orchestrated too.
 */
import type { Landscape, VoiceId } from './types.ts'
import type { Rng } from './rng.ts'

/** The layers whose voice a section may change. */
export type AltLayer = 'lead' | 'arp' | 'pad' | 'bass' | 'counter'
export const ALT_LAYERS: readonly AltLayer[] = ['lead', 'arp', 'pad', 'bass', 'counter']

/** A section's instrumentation: voices that replace the landscape's own, and a lead double. */
export interface Orchestration {
  voices: Partial<Record<AltLayer, VoiceId>>
  /** Plays every lead note an octave below, softer. */
  double?: VoiceId
}

/** Instruments of a similar character, best first. Chip stays chip; synthwave stays synth. */
export const KIN: Partial<Record<VoiceId, VoiceId[]>> = {
  // leads
  'lead.square': ['lead.pulse', 'lead.saw'],
  'lead.saw': ['lead.square', 'lead.glide'],
  'lead.pulse': ['lead.square'],
  'lead.ep': ['keys.felt', 'keys.piano', 'guitar.nylon'],
  'lead.hollow': ['keys.piano', 'lead.whistle', 'pluck.harp'],
  'lead.fm': ['lead.ep', 'keys.piano'],
  'lead.glide': ['lead.saw', 'lead.fm'],
  'lead.whistle': ['lead.hollow', 'mallet.marimba', 'guitar.nylon'],
  'mallet.kalimba': ['mallet.marimba', 'guitar.nylon', 'pluck.harp'],
  'mallet.marimba': ['mallet.kalimba', 'guitar.nylon'],
  'pluck.harp': ['guitar.nylon', 'mallet.kalimba', 'keys.piano'],
  'keys.piano': ['keys.felt', 'guitar.nylon'],
  'keys.felt': ['keys.piano', 'guitar.nylon'],
  'guitar.nylon': ['guitar.steel', 'keys.felt'],
  'guitar.steel': ['guitar.nylon', 'keys.piano'],
  // arps
  'arp.square': ['arp.pluck'],
  'arp.pluck': ['arp.seq', 'guitar.mute'],
  'arp.warm': ['guitar.nylon', 'keys.felt'],
  'arp.glass': ['pluck.harp', 'keys.piano', 'mallet.kalimba'],
  'arp.seq': ['arp.pluck'],
  'guitar.mute': ['arp.pluck', 'guitar.nylon'],
  // pads
  'pad.saw': ['pad.strings'],
  'pad.strings': ['pad.saw', 'pad.warm'],
  'pad.warm': ['pad.strings'],
  'pad.choir': ['pad.strings', 'pad.glass'],
  'pad.glass': ['pad.choir'],
  'pad.dark': ['pad.choir'],
  // basses
  'bass.saw': ['bass.pluck', 'bass.fm'],
  'bass.pluck': ['bass.saw', 'bass.fm'],
  'bass.fm': ['bass.pluck'],
  'bass.round': ['bass.finger'],
  'bass.finger': ['bass.round'],
  // counter lines
  'counter.soft': ['counter.strings', 'keys.felt'],
  'counter.strings': ['counter.soft'],
  // the Era voices: chip stays chip, acoustic stays acoustic (chip.pad and chip.bass have no chip kin: they keep their voice)
  'chip.lead': ['lead.pulse', 'lead.square'],
  'chip.bell': ['chip.lead', 'lead.pulse'],
  'strings.ensemble': ['pad.choir'],
  'wind.flute': ['lead.whistle', 'guitar.nylon', 'keys.felt', 'mallet.vibes'],
  'mallet.vibes': ['mallet.marimba', 'keys.felt', 'guitar.nylon'],
  'bass.upright': ['bass.finger'],
}

/** The instrument that doubles a lead an octave below. */
export const DOUBLE: Partial<Record<VoiceId, VoiceId>> = {
  'lead.square': 'lead.saw',
  'lead.saw': 'lead.square',
  'lead.pulse': 'lead.square',
  'lead.ep': 'keys.felt',
  'lead.hollow': 'keys.felt',
  'lead.fm': 'lead.ep',
  'lead.glide': 'lead.saw',
  'lead.whistle': 'mallet.marimba',
  'mallet.kalimba': 'guitar.nylon',
  'mallet.marimba': 'guitar.nylon',
  'pluck.harp': 'keys.felt',
  'keys.piano': 'keys.felt',
  'keys.felt': 'keys.piano',
  'guitar.nylon': 'keys.felt',
  'guitar.steel': 'guitar.nylon',
  'chip.lead': 'lead.pulse',
  'chip.bell': 'chip.lead',
  'wind.flute': 'mallet.vibes',
  'mallet.vibes': 'keys.felt',
}

/** The landscape's own voice on a layer (undefined when it has no such part). */
export function homeVoice(L: Landscape, layer: AltLayer): VoiceId | undefined {
  return layer === 'pad' ? L.pad.voice : L[layer]?.voice
}

/** Voices that may stand in for the layer's own: the landscape's list, else its kin. */
export function alternatives(L: Landscape, layer: AltLayer): VoiceId[] {
  const home = homeVoice(L, layer)
  if (!home) return []
  const listed = L.alt?.[layer]
  return (listed ?? KIN[home] ?? []).filter(v => v !== home)
}

export function doubleFor(L: Landscape): VoiceId | undefined {
  const home = L.lead?.voice
  if (!home) return undefined
  if (L.alt && 'double' in L.alt) return L.alt.double ?? undefined
  return DOUBLE[home]
}

/** Chance per section kind that a layer gets another voice. */
const CHANGE: Record<'A2' | 'B', Partial<Record<AltLayer, number>>> = {
  A2: { arp: 0.4, counter: 0.4 },
  B: { lead: 0.65, arp: 0.5, bass: 0.35, pad: 0.3 },
}

/**
 * The instrumentation of a new section. `returning`: an A that follows a
 * contrast (the theme comes home); at intensity 3 and up its lead is doubled.
 */
export function orchestrate(L: Landscape, name: string, rng: Rng, intensity: number, returning: boolean): Orchestration {
  const out: Orchestration = { voices: {} }
  const odds = name === 'A2' || name === 'B' ? CHANGE[name] : {}
  for (const layer of ALT_LAYERS) {
    // Always draw, so one landscape's lists do not shift another layer's choices.
    const roll = rng.next()
    const pick = rng.next()
    const alts = alternatives(L, layer)
    const p = odds[layer] ?? 0
    if (alts.length && roll < p) out.voices[layer] = alts[Math.floor(pick * alts.length)]!
  }
  if (name === 'A' && returning && intensity >= 3) out.double = doubleFor(L)
  return out
}
