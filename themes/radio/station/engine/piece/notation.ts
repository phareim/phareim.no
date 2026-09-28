// Vendored from phareim/radio@7530515 by scripts/sync-radio.mjs — edit it there, then re-sync.
/**
 * The bar notation of a piece (see types.ts): note bars
 * "<step>:<pitches>:<len>[:<vel>]" and drum bars "<hit>:<16 chars>".
 * Parse and format are exact inverses on formatted text, so a bar survives
 * any number of round trips through the editor, the store and Opus.
 */
import type { DrumHit, Groove } from '../types.ts'
import { DRUM_HITS } from '../catalog.ts'
import type { PieceNote } from './types.ts'

const LETTER: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
const NOTE = /^([A-G])(#|b)?(-1|[0-9])$/
/** A decimal with at most two places. */
const DECIMAL = /^\d+(\.\d{1,2})?$/

/** MIDI number of a note name (C4 = 60, 'Eb3', 'F#5', 'Cb4' = 59, 'B#3' = 60); null if it is not one. */
export function parseNoteName(s: string): number | null {
  const m = NOTE.exec(s)
  if (!m) return null
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0
  return (Number(m[3]) + 1) * 12 + LETTER[m[1]!]! + acc
}

/** Name of a MIDI note, sharps unless `preferFlats`. */
export function noteName(midi: number, preferFlats = false): string {
  const pc = ((midi % 12) + 12) % 12
  return (preferFlats ? FLAT_NAMES : SHARP_NAMES)[pc]! + String(Math.floor(midi / 12) - 1)
}

/** Round to two decimals and print without trailing zeros. */
function num2(x: number): string {
  return String(Math.round(x * 100) / 100)
}

/** The printed velocity digit 1..9 of a 0..1 velocity. */
export function velDigit(vel: number): number {
  return Math.max(1, Math.min(9, Math.round(vel * 9)))
}

/** Parse a note bar. The empty string is an empty bar. */
export function parseNoteBar(s: string): { notes: PieceNote[] } | { error: string } {
  const notes: PieceNote[] = []
  const src = s.trim()
  if (!src) return { notes }
  for (const tok of src.split(/\s+/)) {
    const parts = tok.split(':')
    if (parts.length < 3 || parts.length > 4) return { error: `token '${tok}' is not <step>:<pitches>:<len>[:<vel>]` }
    const [stepS, pitchS, lenS, velS] = parts as [string, string, string, string | undefined]
    if (!DECIMAL.test(stepS) || Number(stepS) >= 16) return { error: `bad step '${stepS}' in token '${tok}' (0 ≤ step < 16, at most 2 decimals)` }
    if (!DECIMAL.test(lenS) || !(Number(lenS) > 0) || Number(lenS) > 256) return { error: `bad length '${lenS}' in token '${tok}' (> 0 sixteenths, at most 2 decimals)` }
    let vel = 7
    if (velS !== undefined) {
      if (!/^[1-9]$/.test(velS)) return { error: `bad velocity '${velS}' in token '${tok}' (1..9)` }
      vel = Number(velS)
    }
    if (!pitchS) return { error: `no pitches in token '${tok}'` }
    for (const name of pitchS.split('+')) {
      const midi = parseNoteName(name)
      if (midi === null) return { error: `bad pitch '${name}' in token '${tok}'` }
      notes.push({ step: Number(stepS), midi, len: Number(lenS), vel: vel / 9 })
    }
  }
  return { notes }
}

/**
 * Format notes as a note bar: sorted by step then pitch, notes sharing step,
 * length and velocity merged into one token with '+', velocity printed only
 * when it is not 7.
 */
export function formatNoteBar(notes: PieceNote[], preferFlats = false): string {
  const groups = new Map<string, { step: number; len: number; vel: number; midis: Set<number> }>()
  for (const n of notes) {
    const step = Math.round(n.step * 100) / 100
    const len = Math.round(n.len * 100) / 100
    const vel = velDigit(n.vel)
    const k = `${step}|${len}|${vel}`
    let g = groups.get(k)
    if (!g) { g = { step, len, vel, midis: new Set() }; groups.set(k, g) }
    g.midis.add(Math.round(n.midi))
  }
  return [...groups.values()]
    .map(g => ({ ...g, sorted: [...g.midis].sort((a, b) => a - b) }))
    .sort((a, b) => a.step - b.step || a.sorted[0]! - b.sorted[0]! || a.len - b.len || a.vel - b.vel)
    .map(g => `${num2(g.step)}:${g.sorted.map(m => noteName(m, preferFlats)).join('+')}:${num2(g.len)}${g.vel === 7 ? '' : ':' + g.vel}`)
    .join(' ')
}

/** Parse a drum bar into the radio's Groove. The empty string is an empty groove. */
export function parseDrumBar(s: string): { groove: Groove } | { error: string } {
  const groove: Groove = {}
  const src = s.trim()
  if (!src) return { groove }
  for (const tok of src.split(/\s+/)) {
    const m = /^([^:]+):(.*)$/.exec(tok)
    if (!m) return { error: `token '${tok}' is not <hit>:<16 chars>` }
    const hit = m[1] as DrumHit
    const row = m[2]!
    if (!DRUM_HITS.includes(hit)) return { error: `unknown hit '${m[1]}' in token '${tok}' (one of ${DRUM_HITS.join(' ')})` }
    if (groove[hit] !== undefined) return { error: `hit '${hit}' twice` }
    if (row.length !== 16) return { error: `token '${tok}' has ${row.length} steps (needs 16)` }
    const bad = /[^.xXg-]/.exec(row)
    if (bad) return { error: `bad char '${bad[0]}' in token '${tok}' (. x X g, and - after z)` }
    if (row.includes('-')) {
      if (hit !== 'z') return { error: `'-' in token '${tok}': only a z riser holds` }
      if (/^-|\.-/.test(row)) return { error: `'-' in token '${tok}' must follow a z hit or another '-'` }
    }
    groove[hit] = row
  }
  return { groove }
}

/** Format a groove as a drum bar: hits in DRUM_HITS order, empty rows left out. */
export function formatDrumBar(g: Groove): string {
  return DRUM_HITS
    .filter(h => g[h] && /[xXg]/.test(g[h]!))
    .map(h => `${h}:${g[h]}`)
    .join(' ')
}

/**
 * Pull notes toward a grid (in steps: 1 = sixteenths, 2 = eighths, 4/3 =
 * eighth triplets) by `strength` 0..1: starts snap, lengths snap to whole
 * grid units (at least one). Works on bar or loop positions alike; a start
 * that snaps to 16 or past is left for the caller to move to the next bar.
 */
export function quantize(notes: PieceNote[], grid = 1, strength = 1): PieceNote[] {
  const k = Math.max(0, Math.min(1, strength))
  const r2 = (x: number) => Math.round(x * 100) / 100
  return notes.map(n => {
    const step = n.step + (Math.round(n.step / grid) * grid - n.step) * k
    const len = n.len + (Math.max(grid, Math.round(n.len / grid) * grid) - n.len) * k
    return { ...n, step: Math.max(0, r2(step)), len: Math.max(0.01, r2(len)) }
  })
}
