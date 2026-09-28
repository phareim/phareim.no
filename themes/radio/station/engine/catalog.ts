// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * Runtime lists of the ids in types.ts, for validation and for the Opus
 * compose prompt. The Record types make the compiler refuse a list that
 * misses an id.
 */
import type { AmbienceId, DrumHit, KitId, Layer, Mode, VoiceId } from './types.ts'

const VOICES: Record<VoiceId, true> = {
  'lead.square': true, 'lead.saw': true, 'lead.pulse': true, 'lead.ep': true, 'lead.hollow': true,
  'lead.fm': true, 'lead.glide': true, 'lead.whistle': true,
  'mallet.kalimba': true, 'mallet.marimba': true, 'pluck.harp': true,
  'arp.square': true, 'arp.pluck': true, 'arp.warm': true, 'arp.glass': true, 'arp.seq': true,
  'pad.saw': true, 'pad.strings': true, 'pad.choir': true, 'pad.glass': true, 'pad.warm': true, 'pad.dark': true,
  'bass.saw': true, 'bass.square': true, 'bass.round': true, 'bass.sub': true, 'bass.pluck': true, 'bass.fm': true,
  'bell.glass': true, 'bell.fm': true, 'bell.chime': true, 'counter.strings': true, 'counter.soft': true,
  'drone.sub': true, 'drone.organ': true, 'drone.shimmer': true,
  'keys.piano': true, 'keys.felt': true, 'guitar.nylon': true, 'guitar.steel': true, 'guitar.mute': true, 'bass.finger': true,
  'chip.lead': true, 'chip.bass': true, 'chip.pad': true, 'chip.bell': true,
  'strings.ensemble': true, 'wind.flute': true, 'mallet.vibes': true, 'bass.upright': true,
}
export const VOICE_IDS = Object.keys(VOICES) as VoiceId[]

const KITS: Record<KitId, true> = {
  'kit.synthwave': true, 'kit.soft': true, 'kit.tribal': true, 'kit.brush': true,
  'kit.motorik': true, 'kit.heartbeat': true, 'kit.chip': true, 'kit.acoustic': true,
}
export const KIT_IDS = Object.keys(KITS) as KitId[]

const HITS: Record<DrumHit, true> = {
  k: true, s: true, c: true, h: true, o: true, r: true, p: true, t: true, m: true, T: true, x: true, z: true,
}
export const DRUM_HITS = Object.keys(HITS) as DrumHit[]

const AMBIENCE: Record<AmbienceId, true> = {
  wind: true, 'wind.high': true, birds: true, 'birds.jungle': true, insects: true, rain: true,
  'rain.roof': true, stream: true, waves: true, gulls: true, owl: true, snow: true, fire: true,
  chimes: true, 'bell.distant': true, road: true, passing: true, city: true, radio: true,
  'space.hum': true, shimmer: true,
}
export const AMBIENCE_IDS = Object.keys(AMBIENCE) as AmbienceId[]

const MODES: Record<Mode, true> = {
  lydian: true, ionian: true, mixolydian: true, dorian: true, aeolian: true, phrygian: true, harmonicMinor: true,
}
export const MODE_IDS = Object.keys(MODES) as Mode[]

const LAYER_SET: Record<Layer, true> = {
  ambience: true, drone: true, pad: true, bass: true, drums: true, perc: true, arp: true, lead: true, counter: true, bells: true,
}
export const LAYER_IDS = Object.keys(LAYER_SET) as Layer[]

/** The painted scenes: one per built-in landscape, and one per composed channel that has been painted (named after its landscape id). */
export const SCENE_IDS = [
  'coast', 'summit', 'jungle', 'frostwood', 'village', 'nightdrive', 'voyager', 'deepspace', 'neonrain', 'caverns',
  'crossroads-cafe-5b44', 'autumn-harbour-4ce5', 'canopy-run-8d30',
] as const

export const INTENSITY_NAMES = ['STILL', 'DRIFT', 'CRUISE', 'DRIVE', 'SURGE'] as const

/** Bumped when the composer or conductor changes in a way feedback should know about. */
export const ENGINE_VERSION = '1.3.2'
