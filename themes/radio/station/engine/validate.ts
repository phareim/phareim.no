// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * validateLandscape: checks a Landscape from any source (built-in files,
 * Opus's JSON) and returns a normalised copy. Pure; the backend imports it
 * with Node's type stripping.
 */
import type { Groove, Landscape, Layer, WrittenPart } from './types.ts'
import { AMBIENCE_IDS, DRUM_HITS, KIT_IDS, LAYER_IDS, MODE_IDS, SCENE_IDS, VOICE_IDS } from './catalog.ts'
import { parseProgression } from './theory.ts'
import { parseMotif } from './composer.ts'
import { noteName, parseDrumBar, parseNoteBar } from './piece/notation.ts'
import { MAX_BAR_CHARS } from './piece/validate.ts'

export interface Validation {
  ok: boolean
  errors: string[]
  landscape?: Landscape
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)
const num = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

export const MAX_WRITTEN = 8
export const MAX_WRITTEN_PARTS = 10

export function validateLandscape(input: unknown): Validation {
  const errors: string[] = []
  const err = (m: string) => errors.push(m)
  if (!isObj(input)) return { ok: false, errors: ['not an object'] }
  const L = structuredClone(input) as unknown as Landscape

  if (typeof L.id !== 'string' || !/^[a-z0-9][a-z0-9-]{1,40}$/.test(L.id)) err('id: lower-case slug, 2–41 chars')
  if (typeof L.name !== 'string' || !L.name.trim() || L.name.length > 24) err('name: 1–24 chars')
  if (typeof L.blurb !== 'string') err('blurb: string')
  if (!num(L.tonic) || L.tonic < 0 || L.tonic > 11 || !Number.isInteger(L.tonic)) err('tonic: integer 0..11')
  if (!Array.isArray(L.moods) || !L.moods.length || L.moods.some(m => !MODE_IDS.includes(m))) err(`moods: non-empty list of ${MODE_IDS.join('|')}`)
  if (!num(L.mood) || L.mood < 0 || L.mood > 1) err('mood: 0..1')
  if (!num(L.bpm) || L.bpm < 50 || L.bpm > 170) err('bpm: 50..170')
  if (!num(L.swing) || L.swing < 0 || L.swing > 0.5) err('swing: 0..0.5')
  if (L.phraseBars !== undefined && L.phraseBars !== 4 && L.phraseBars !== 8) err('phraseBars: 4 or 8')
  if (!num(L.color) || L.color < 0 || L.color > 1) err('color: 0..1')

  const voice = (v: unknown, where: string) => {
    if (!VOICE_IDS.includes(v as never)) err(`${where}: unknown voice '${String(v)}'`)
  }

  // Progressions parse in every mood's mode and fill whole bars.
  if (!Array.isArray(L.progressions) || !L.progressions.length) err('progressions: at least one')
  else {
    const modes = Array.isArray(L.moods) ? L.moods.filter(m => MODE_IDS.includes(m)) : []
    L.progressions.forEach((p, i) => {
      if (!isObj(p) || typeof p.chords !== 'string') { err(`progressions[${i}]: needs chords`); return }
      if (p.barsPerChord !== undefined && ![0.5, 1, 2, 4].includes(p.barsPerChord)) err(`progressions[${i}].barsPerChord: 0.5, 1, 2 or 4`)
      if (p.role !== undefined && !['a', 'b', 'bridge'].includes(p.role)) err(`progressions[${i}].role: a|b|bridge`)
      for (const mode of modes) {
        const r = parseProgression(p.chords, { tonic: num(L.tonic) ? L.tonic : 0, mode }, p.barsPerChord ?? 1)
        if ('error' in r) { err(`progressions[${i}]: ${r.error}`); break }
        if (![2, 4, 8, 16].includes(r.bars)) { err(`progressions[${i}]: ${r.bars} bars (must total 2, 4, 8 or 16)`); break }
      }
    })
  }

  if (!isObj(L.pad)) err('pad: { voice }')
  else voice(L.pad.voice, 'pad.voice')
  if (L.drone !== undefined) isObj(L.drone) ? voice(L.drone.voice, 'drone.voice') : err('drone: { voice }')

  if (!isObj(L.bass)) err('bass: required')
  else {
    voice(L.bass.voice, 'bass.voice')
    if (!Array.isArray(L.bass.patterns) || L.bass.patterns.length !== 5) err('bass.patterns: five strings (intensity 0..4)')
    else L.bass.patterns.forEach((p, i) => {
      if (typeof p !== 'string' || (p !== '' && (p.length !== 16 || /[^RO537a.\-]/.test(p)))) err(`bass.patterns[${i}]: '' or 16 chars of R O 5 3 7 a - .`)
    })
    if (L.bass.octave !== undefined && (!num(L.bass.octave) || L.bass.octave < 24 || L.bass.octave > 48)) err('bass.octave: 24..48')
  }

  if (L.arp !== undefined) {
    if (!isObj(L.arp)) err('arp: object')
    else {
      voice(L.arp.voice, 'arp.voice')
      if (!['up', 'down', 'updown', 'random', 'broken', 'pedal', 'sequence'].includes(L.arp.pattern)) err('arp.pattern')
      if (!Array.isArray(L.arp.rate) || L.arp.rate.length !== 5 || L.arp.rate.some(r => ![4, 8, 16].includes(r))) err('arp.rate: five of 4|8|16')
      if (L.arp.octaves !== 1 && L.arp.octaves !== 2) err('arp.octaves: 1|2')
      if (!num(L.arp.low) || L.arp.low < 40 || L.arp.low > 84) err('arp.low: 40..84')
      if (L.arp.pattern === 'sequence' && (!Array.isArray(L.arp.sequence) || !L.arp.sequence.length || L.arp.sequence.some(n => !Number.isInteger(n) || Math.abs(n) > 14))) err('arp.sequence: integers -14..14')
    }
  }

  if (L.lead !== undefined) {
    if (!isObj(L.lead)) err('lead: object')
    else {
      const m = L.lead
      voice(m.voice, 'lead.voice')
      if (!Array.isArray(m.range) || m.range.length !== 2 || !num(m.range[0]) || !num(m.range[1]) || m.range[0] < 48 || m.range[1] > 96 || m.range[1] - m.range[0] < 10) err('lead.range: [lo, hi] within 48..96, at least 10 apart')
      if (!num(m.density) || m.density < 0 || m.density > 1) err('lead.density: 0..1')
      if (!num(m.stepwise) || m.stepwise < 0 || m.stepwise > 1) err('lead.stepwise: 0..1')
      if (!Array.isArray(m.rhythm) || !m.rhythm.length || m.rhythm.some(r => !['long', 'straight', 'dotted', 'syncopated', 'sixteenths'].includes(r))) err('lead.rhythm')
      if (m.motifBars !== 1 && m.motifBars !== 2) err('lead.motifBars: 1|2')
      if (!num(m.rest) || m.rest < 0 || m.rest > 1) err('lead.rest: 0..1')
      if (m.motifs !== undefined) {
        if (!Array.isArray(m.motifs)) err('lead.motifs: list of strings')
        else m.motifs.forEach((src, i) => {
          let ok = false
          try { ok = typeof src === 'string' && parseMotif(src) !== null } catch { ok = false }
          if (!ok) err(`lead.motifs[${i}]: one or two bars of 8 tokens (degree 1-7 with ' or , for octaves, - hold, . rest), bars split by |`)
        })
      }
    }
  }
  if (L.counter !== undefined) {
    if (!isObj(L.counter)) err('counter: object')
    else { voice(L.counter.voice, 'counter.voice'); if (!['guide', 'answer'].includes(L.counter.style)) err('counter.style: guide|answer') }
  }
  if (L.bells !== undefined) {
    if (!isObj(L.bells)) err('bells: object')
    else { voice(L.bells.voice, 'bells.voice'); if (!num(L.bells.density) || L.bells.density < 0 || L.bells.density > 1) err('bells.density: 0..1') }
  }

  const groove = (g: unknown, where: string) => {
    if (!isObj(g)) { err(`${where}: object`); return }
    for (const [hit, pat] of Object.entries(g as Groove)) {
      if (!DRUM_HITS.includes(hit as never)) err(`${where}: unknown hit '${hit}'`)
      if (typeof pat !== 'string' || pat.length !== 16 || /[^.xXg\-]/.test(pat)) err(`${where}.${hit}: 16 chars of . x X g -`)
    }
  }
  if (!isObj(L.drums)) err('drums: required')
  else {
    if (!KIT_IDS.includes(L.drums.kit)) err(`drums.kit: one of ${KIT_IDS.join('|')}`)
    if (!Array.isArray(L.drums.grooves) || L.drums.grooves.length !== 5) err('drums.grooves: five grooves')
    else L.drums.grooves.forEach((g, i) => groove(g, `drums.grooves[${i}]`))
    groove(L.drums.fill, 'drums.fill')
    if (L.drums.perc !== undefined) {
      if (!Array.isArray(L.drums.perc) || L.drums.perc.length !== 5) err('drums.perc: five grooves')
      else L.drums.perc.forEach((g, i) => groove(g, `drums.perc[${i}]`))
    }
  }

  if (!Array.isArray(L.layers) || L.layers.length !== 5) err('layers: five lists (intensity 0..4)')
  else {
    let prev = new Set<Layer>()
    L.layers.forEach((ls, i) => {
      if (!Array.isArray(ls) || ls.some(l => !LAYER_IDS.includes(l))) { err(`layers[${i}]: layer names`); return }
      for (const l of prev) if (!ls.includes(l)) err(`layers[${i}]: drops '${l}' present at ${i - 1} (must grow)`)
      prev = new Set(ls)
      const need: Array<[Layer, unknown]> = [['arp', L.arp], ['lead', L.lead], ['counter', L.counter], ['bells', L.bells], ['drone', L.drone], ['perc', L.drums?.perc]]
      for (const [layer, spec] of need) if (ls.includes(layer) && spec === undefined) err(`layers[${i}]: '${layer}' without a ${layer} spec`)
    })
  }

  if (!isObj(L.fx)) err('fx: required')
  else {
    const f = L.fx
    for (const k of ['reverb', 'delay', 'tone', 'grit'] as const) if (!num(f[k]) || f[k] < 0 || f[k] > 1) err(`fx.${k}: 0..1`)
    if (!num(f.reverbSize) || f.reverbSize < 0.8 || f.reverbSize > 10) err('fx.reverbSize: 0.8..10 s')
    if (f.pump !== undefined && (!num(f.pump) || f.pump < 0 || f.pump > 1)) err('fx.pump: 0..1')
  }

  if (!isObj(L.ambience)) err('ambience: object')
  else for (const [k, v] of Object.entries(L.ambience)) {
    if (!AMBIENCE_IDS.includes(k as never)) err(`ambience: unknown '${k}'`)
    if (!num(v) || v < 0 || v > 1) err(`ambience.${k}: 0..1`)
  }

  // Written phrases: eight bars each in jam's bar notation, quoted verbatim.
  if (L.quote !== undefined && (!num(L.quote) || L.quote < 0 || L.quote > 1)) err('quote: 0..1 (the chance a section quotes a written phrase)')
  if (L.written !== undefined) {
    if (!Array.isArray(L.written)) err('written: a list of phrases { chords, parts, name?, chordBars?, weight? }')
    else {
      if (L.written.length > MAX_WRITTEN) err(`written: at most ${MAX_WRITTEN} phrases, got ${L.written.length}`)
      const modes = Array.isArray(L.moods) ? L.moods.filter(m => MODE_IDS.includes(m)) : []
      const ladder = Array.isArray(L.layers) && L.layers.length === 5 && L.layers.every(Array.isArray) ? L.layers : null
      L.written.slice(0, MAX_WRITTEN).forEach((w, i) => {
        if (!isObj(w)) { err(`written[${i}]: { chords, parts, name?, chordBars?, weight? }`); return }
        const at = typeof w.name === 'string' && w.name.trim() ? `written[${i}] '${w.name}'` : `written[${i}]`
        if (w.name !== undefined && (typeof w.name !== 'string' || !w.name.trim() || w.name.length > 24)) err(`${at}.name: 1–24 chars`)
        if (w.chordBars !== undefined && w.chordBars !== 1 && w.chordBars !== 2) err(`${at}.chordBars: 1 or 2`)
        if (w.weight !== undefined && (!num(w.weight) || w.weight <= 0 || w.weight > 10)) err(`${at}.weight: above 0, at most 10`)
        const bpc = w.chordBars === 1 ? 1 : 2
        if (typeof w.chords !== 'string') err(`${at}.chords: a progression string lasting 8 bars`)
        else for (const mode of modes) {
          const r = parseProgression(w.chords, { tonic: num(L.tonic) ? L.tonic : 0, mode }, bpc)
          if ('error' in r) { err(`${at}.chords: ${r.error}`); break }
          if (r.bars !== 8) { err(`${at}.chords: '${w.chords}' lasts ${r.bars} bars (needs exactly 8; tokens without ':n' last chordBars = ${bpc})`); break }
        }
        if (!Array.isArray(w.parts) || !w.parts.length || w.parts.length > MAX_WRITTEN_PARTS) {
          err(`${at}.parts: 1 to ${MAX_WRITTEN_PARTS} parts`)
          if (!Array.isArray(w.parts)) return
        }
        w.parts.slice(0, MAX_WRITTEN_PARTS).forEach((p, j) => writtenPart(p, `${at}.parts[${j}]`, ladder, err))
      })
    }
  }

  if (typeof L.accent !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(L.accent)) err('accent: #rrggbb')
  if (L.alt !== undefined) {
    if (!isObj(L.alt)) err('alt: { lead?, arp?, pad?, bass?, counter?: voice lists; double?: voice or null }')
    else for (const [k, v] of Object.entries(L.alt)) {
      if (k === 'double') { if (v !== null) voice(v, 'alt.double'); continue }
      if (!['lead', 'arp', 'pad', 'bass', 'counter'].includes(k)) { err(`alt.${k}: not a layer the conductor re-voices (lead, arp, pad, bass, counter, double)`); continue }
      if (!Array.isArray(v) || v.length > 4) { err(`alt.${k}: a list of at most 4 voices`); continue }
      v.forEach((x, i) => voice(x, `alt.${k}[${i}]`))
    }
  }
  if (L.scene !== undefined && !(SCENE_IDS as readonly string[]).includes(L.scene)) err(`scene: one of ${SCENE_IDS.join('|')}`)
  if (L.scene === undefined && !(SCENE_IDS as readonly string[]).includes(L.id)) err(`scene: required, one of ${SCENE_IDS.join('|')}`)

  return errors.length ? { ok: false, errors } : { ok: true, errors: [], landscape: L }
}

/** One part of a written phrase: layer, one of voice/kit, enter on the ladder, 8 bars that parse. */
function writtenPart(p: unknown, where: string, ladder: Landscape['layers'] | null, err: (m: string) => void): void {
  if (!isObj(p)) { err(`${where}: { layer, voice | kit, enter, bars, gain? }`); return }
  const part = p as unknown as WrittenPart
  const layerOk = LAYER_IDS.includes(part.layer) && part.layer !== 'ambience'
  const at = layerOk ? `${where} (${part.layer})` : where
  if (!layerOk) err(`${at}.layer: one of ${LAYER_IDS.filter(l => l !== 'ambience').join('|')}`)
  const hasVoice = part.voice !== undefined
  const hasKit = part.kit !== undefined
  const one = hasVoice !== hasKit
  if (!one) err(`${at}: exactly one of voice (note bars) and kit (drum bars)`)
  else if (hasVoice && !VOICE_IDS.includes(part.voice!)) err(`${at}.voice: unknown voice '${String(part.voice)}'`)
  else if (hasKit) {
    if (!KIT_IDS.includes(part.kit!)) err(`${at}.kit: one of ${KIT_IDS.join('|')}`)
    if (layerOk && part.layer !== 'drums' && part.layer !== 'perc') err(`${at}: a kit part plays on layer 'drums' or 'perc'`)
  }
  const enterOk = num(part.enter) && Number.isInteger(part.enter) && part.enter >= 0 && part.enter <= 4
  if (!enterOk) err(`${at}.enter: integer 0..4`)
  else if (layerOk && ladder && !ladder[part.enter]!.includes(part.layer)) {
    const first = ladder.findIndex(ls => ls.includes(part.layer))
    err(`${at}: enters at ${part.enter} but layers[${part.enter}] has no '${part.layer}', so it could not sound there; ${first >= 0 ? `raise enter to ${first} or ` : ''}add '${part.layer}' to layers[${part.enter}] and up`)
  }
  if (part.gain !== undefined && (!num(part.gain) || part.gain < 0 || part.gain > 1.5)) err(`${at}.gain: 0..1.5`)
  if (!Array.isArray(part.bars) || part.bars.length !== 8) {
    err(`${at}.bars: 8 strings (one per bar of the phrase, '' for an empty bar), got ${Array.isArray(part.bars) ? part.bars.length : 'none'}`)
    return
  }
  part.bars.forEach((b, k) => {
    if (typeof b !== 'string') { err(`${at} bar ${k}: not a string`); return }
    if (b.length > MAX_BAR_CHARS) { err(`${at} bar ${k}: ${b.length} chars (max ${MAX_BAR_CHARS})`); return }
    if (!one) return
    if (hasKit) {
      const r = parseDrumBar(b)
      if ('error' in r) err(`${at} bar ${k}: ${r.error}`)
    } else {
      const r = parseNoteBar(b)
      if ('error' in r) err(`${at} bar ${k}: ${r.error}`)
      else {
        const off = r.notes.find(n => n.midi < 12 || n.midi > 120)
        if (off) err(`${at} bar ${k}: note ${noteName(off.midi)} out of range C0..C9`)
      }
    }
  })
}
