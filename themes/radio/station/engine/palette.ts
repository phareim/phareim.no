// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The Era palette: which voice and kit a layer plays at a given Era.
 *
 * Era 0.5 is the landscape as written. Away from the middle the layers hand
 * over one by one, soft beds first and the lead last, to chip voices (toward
 * 0, 8-bit) or acoustic instruments (toward 1, analog). The conductor maps
 * each bar after composing it, so the composer, the written quotes and the
 * orchestration never need to know.
 */
import type { DrumEvent, KitId, Layer, NoteEvent, VoiceId } from './types.ts'

/**
 * How far from the middle (0..1) the knob must be before a layer hands
 * over. Beds and drums go first, so the colour shifts before the tune does;
 * the lead goes last. Every layer has handed over at era 0 and 1.
 */
export const HANDOVER: Record<Layer, number> = {
  drone: 0.2, pad: 0.2, drums: 0.35, perc: 0.35, bells: 0.45, arp: 0.55, bass: 0.65, counter: 0.75, lead: 0.85,
  ambience: 1,
}

/** The 8-bit counterpart of every voice. Chip voices (`chip.*`, `arp.square`, `lead.pulse`) keep themselves. */
export const CHIP: Record<VoiceId, VoiceId> = {
  // Melodic voices of any kind become the NES pulse lead; lead.pulse is chip already.
  'lead.square': 'chip.lead', 'lead.saw': 'chip.lead', 'lead.pulse': 'lead.pulse', 'lead.ep': 'chip.lead',
  'lead.hollow': 'chip.lead', 'lead.fm': 'chip.lead', 'lead.glide': 'chip.lead', 'lead.whistle': 'chip.lead',
  'mallet.kalimba': 'chip.lead', 'mallet.marimba': 'chip.lead', 'pluck.harp': 'chip.lead',
  'keys.piano': 'chip.lead', 'keys.felt': 'chip.lead',
  'guitar.nylon': 'chip.lead', 'guitar.steel': 'chip.lead', 'guitar.mute': 'chip.lead',
  'wind.flute': 'chip.lead', 'mallet.vibes': 'chip.lead',
  // Arps: the chip arp.
  'arp.square': 'arp.square', 'arp.pluck': 'arp.square', 'arp.warm': 'arp.square', 'arp.glass': 'arp.square', 'arp.seq': 'arp.square',
  // Pads: the chord as a frame-rate arpeggio.
  'pad.saw': 'chip.pad', 'pad.strings': 'chip.pad', 'pad.choir': 'chip.pad', 'pad.glass': 'chip.pad',
  'pad.warm': 'chip.pad', 'pad.dark': 'chip.pad', 'strings.ensemble': 'chip.pad',
  // Basses and drones: the triangle channel.
  'bass.saw': 'chip.bass', 'bass.square': 'chip.bass', 'bass.round': 'chip.bass', 'bass.sub': 'chip.bass',
  'bass.pluck': 'chip.bass', 'bass.fm': 'chip.bass', 'bass.finger': 'chip.bass', 'bass.upright': 'chip.bass',
  'drone.sub': 'chip.bass', 'drone.organ': 'chip.bass', 'drone.shimmer': 'chip.bass',
  // Bells: the thin pulse blip.
  'bell.glass': 'chip.bell', 'bell.fm': 'chip.bell', 'bell.chime': 'chip.bell',
  // Counter lines: the thinner pulse, so the line stays apart from the lead.
  'counter.strings': 'lead.pulse', 'counter.soft': 'lead.pulse',
  'chip.lead': 'chip.lead', 'chip.bass': 'chip.bass', 'chip.pad': 'chip.pad', 'chip.bell': 'chip.bell',
}

/** The acoustic counterpart of every voice. Played and acoustic instruments keep themselves. */
export const ANALOG: Record<VoiceId, VoiceId> = {
  // Leads: the instrument each synth lead imitates or recalls.
  'lead.square': 'keys.piano', 'lead.saw': 'guitar.steel', 'lead.pulse': 'mallet.marimba', 'lead.ep': 'keys.piano',
  'lead.hollow': 'wind.flute', 'lead.fm': 'mallet.vibes', 'lead.glide': 'wind.flute', 'lead.whistle': 'wind.flute',
  // Mallets, harp, keys, guitars and the acoustic voices are acoustic already.
  'mallet.kalimba': 'mallet.kalimba', 'mallet.marimba': 'mallet.marimba', 'pluck.harp': 'pluck.harp',
  'keys.piano': 'keys.piano', 'keys.felt': 'keys.felt',
  'guitar.nylon': 'guitar.nylon', 'guitar.steel': 'guitar.steel', 'guitar.mute': 'guitar.mute',
  'wind.flute': 'wind.flute', 'mallet.vibes': 'mallet.vibes', 'strings.ensemble': 'strings.ensemble',
  // Arps: picked guitar for the soft ones, muted guitar for the sequencer ones, harp for the glassy one.
  'arp.square': 'guitar.nylon', 'arp.warm': 'guitar.nylon', 'arp.pluck': 'guitar.mute', 'arp.seq': 'guitar.mute',
  'arp.glass': 'pluck.harp',
  // Pads: a bowed string section; the choir is voices already.
  'pad.saw': 'strings.ensemble', 'pad.strings': 'strings.ensemble', 'pad.choir': 'pad.choir', 'pad.glass': 'strings.ensemble',
  'pad.warm': 'strings.ensemble', 'pad.dark': 'strings.ensemble',
  // Basses: fingered for the driving ones, upright for the round and sub ones.
  'bass.saw': 'bass.finger', 'bass.square': 'bass.finger', 'bass.pluck': 'bass.finger', 'bass.fm': 'bass.finger',
  'bass.round': 'bass.upright', 'bass.sub': 'bass.upright', 'bass.finger': 'bass.finger', 'bass.upright': 'bass.upright',
  // Bells: vibraphone, and the kalimba for the small chime.
  'bell.glass': 'mallet.vibes', 'bell.fm': 'mallet.vibes', 'bell.chime': 'mallet.kalimba',
  // Counter lines: strings.
  'counter.strings': 'strings.ensemble', 'counter.soft': 'strings.ensemble',
  // Drones: the organ holds; the shimmer becomes high strings.
  'drone.sub': 'drone.organ', 'drone.organ': 'drone.organ', 'drone.shimmer': 'strings.ensemble',
  // Chip voices (a landscape may use them): their nearest acoustic kin.
  'chip.lead': 'keys.piano', 'chip.bass': 'bass.upright', 'chip.pad': 'strings.ensemble', 'chip.bell': 'mallet.vibes',
}

/** Kits: the NES noise channel toward 8-bit. */
export const CHIP_KITS: Record<KitId, KitId> = {
  'kit.synthwave': 'kit.chip', 'kit.soft': 'kit.chip', 'kit.tribal': 'kit.chip', 'kit.brush': 'kit.chip',
  'kit.motorik': 'kit.chip', 'kit.heartbeat': 'kit.chip', 'kit.chip': 'kit.chip', 'kit.acoustic': 'kit.chip',
}

/** Kits: a real kit in a room toward analog; brushes and hand drums are real already. */
export const ANALOG_KITS: Record<KitId, KitId> = {
  'kit.synthwave': 'kit.acoustic', 'kit.soft': 'kit.acoustic', 'kit.motorik': 'kit.acoustic',
  'kit.heartbeat': 'kit.acoustic', 'kit.chip': 'kit.acoustic',
  'kit.brush': 'kit.brush', 'kit.tribal': 'kit.tribal', 'kit.acoustic': 'kit.acoustic',
}

/**
 * A melodic chip voice fits some layers badly: an arp gets the chip arp, a
 * counter line the thinner pulse (apart from the lead), a pad the chord
 * arpeggio, a bass the triangle, bells the blip.
 */
const CHIP_LAYER: Partial<Record<Layer, VoiceId>> = {
  arp: 'arp.square', counter: 'lead.pulse', pad: 'chip.pad', bass: 'chip.bass', bells: 'chip.bell',
}

/** 0 at the middle of the knob, 1 at either end. */
export function eraDistance(era: number): number {
  return Math.min(1, Math.abs(era - 0.5) * 2)
}

/** Whether `layer` has handed over at this era (never at 0.5). */
export function handedOver(layer: Layer, era: number): boolean {
  const d = eraDistance(era)
  return d > 0 && d + 1e-9 >= HANDOVER[layer]
}

/** The voice `layer` plays at `era` in place of `voice`. */
export function eraVoice(voice: VoiceId, layer: Layer, era: number): VoiceId {
  if (!handedOver(layer, era)) return voice
  if (era > 0.5) return ANALOG[voice]
  const v = CHIP[voice]
  return v === 'chip.lead' ? CHIP_LAYER[layer] ?? v : v
}

/** The kit `layer` plays at `era` in place of `kit`. */
export function eraKit(kit: KitId, layer: Layer, era: number): KitId {
  if (!handedOver(layer, era)) return kit
  return era > 0.5 ? ANALOG_KITS[kit] : CHIP_KITS[kit]
}

/**
 * One bar's notes and drums at `era`. Events that keep their sound are
 * passed through as they are (at 0.5 the arrays come back unchanged);
 * changed ones are copies, so nothing the composer or a landscape holds is
 * touched. Then every chip.pad note learns its place in its chord.
 */
export function eraBar(notes: NoteEvent[], drums: DrumEvent[], era: number): { notes: NoteEvent[]; drums: DrumEvent[] } {
  let ns = notes
  let ds = drums
  if (eraDistance(era) > 0) {
    ns = notes.map(n => {
      const v = eraVoice(n.voice, n.layer, era)
      return v === n.voice ? n : { ...n, voice: v }
    })
    ds = drums.map(d => {
      const k = eraKit(d.kit, d.layer, era)
      return k === d.kit ? d : { ...d, kit: k }
    })
  }
  return { notes: chipChords(ns), drums: ds }
}

/**
 * chip.pad plays a chord as an arpeggio, so each of its notes needs its
 * place: `opts.chord = [index, count]`, by pitch from low to high among the
 * chip.pad notes of the same layer starting on the same step.
 */
export function chipChords(notes: NoteEvent[]): NoteEvent[] {
  if (!notes.some(n => n.voice === 'chip.pad')) return notes
  const groups = new Map<string, number[]>()
  notes.forEach((n, i) => {
    if (n.voice !== 'chip.pad') return
    const k = `${n.layer}@${n.step}`
    const g = groups.get(k)
    if (g) g.push(i)
    else groups.set(k, [i])
  })
  const out = notes.slice()
  for (const idx of groups.values()) {
    const order = [...idx].sort((a, b) => notes[a]!.midi - notes[b]!.midi || a - b)
    order.forEach((i, place) => {
      const n = notes[i]!
      const c = n.opts?.chord
      if (c && c[0] === place && c[1] === order.length) return
      out[i] = { ...n, opts: { ...n.opts, chord: [place, order.length] } }
    })
  }
  return out
}
