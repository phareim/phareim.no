/**
 * Night of the Dead Battery — the orchestrations. The score (score.ts) says
 * which notes and chords; an arrangement says who plays them, bar by bar.
 * The four floors (and the title) arrange the same theme bars, so a floor
 * switch is a change of band at a bar line with nothing else moving.
 *
 *   ground   harpsichord oompah, tuba, brushes; theremin lead, and on the
 *            second pass the harpsichord takes the tune with a musette
 *            accordion a third below
 *   cellar   bassoon with the tune slowed to its skeleton an octave down,
 *            low pizzicato, tuned drips
 *   attic    celesta, music box, a high flute; the flute takes the tune on
 *            the second pass
 *   outside  the storm with fragments: a soft tuba, a theremin that only
 *            gets half its phrases out
 *   title    the theme in full, a different lead for every section
 *
 * Every pass after the first swaps something (who leads, a counter-line),
 * so the loop only repeats exactly after 128 bars (about three minutes).
 */
import * as K from './kit'
import type { Kit, Voice } from './kit'
import type { BarData, Chord, Ev } from './score'

export type ArrId = 'title' | 'ground' | 'cellar' | 'attic' | 'outside' | 'intro' | 'seance' | 'tension' | 'finale' | 'credits'

export interface BarCtx {
  k: Kit
  out: AudioNode
  /** Start of the bar, seconds per beat and per eighth. */
  t0: number
  beat: number
  e: number
  bar: BarData
  prev: BarData | null
  next: BarData
  /** Times through the loop so far (0 on the first). */
  pass: number
  /** Semitones to transpose everything (the tension cue climbs). */
  tr: number
  /** Per-layer memory: the last lead note (for theremin glides). */
  st: { last?: number }
  rnd: () => number
}

export interface Arrangement {
  /** Layer level (0..1) and reverb send. */
  level: number
  verb: number
  bar(b: BarCtx): void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const at = (b: BarCtx, eighth: number): number => b.t0 + eighth * b.e
const chordAt = (b: BarCtx, eighth: number): Chord => b.bar.chords[Math.min(b.bar.chords.length - 1, Math.floor(eighth / 2))]!
const beats = (b: BarCtx): number => b.bar.chords.length

/** The lowest note at or above `lo` with pitch class `pc`. */
const place = (pc: number, lo: number): number => lo + ((((pc - lo) % 12) + 12) % 12)

/** Close voicing of the chord from `lo` up. */
function voicing(c: Chord, lo: number, max = 4): number[] {
  return c.pcs.map(pc => place(pc, lo)).sort((x, y) => x - y).slice(0, max)
}

/** Tuba/pizz bass: the chord's bass note between D2 and C#3 (or from `lo`). */
const bassOf = (c: Chord, lo = 38): number => place(c.bass, lo)
/** The fifth, kept in the low register. */
function fifthOf(c: Chord, lo = 38): number {
  const f = place((c.root + (c.tones.includes(6) ? 6 : 7)) % 12, lo)
  return f > lo + 7 ? f - 12 : f
}

/** A chord tone a third to a sixth under `m`: an automatic second voice. */
function under(m: number, c: Chord): number {
  for (let d = 3; d <= 9; d++) if (c.pcs.includes(((m - d) % 12 + 12) % 12)) return m - d
  return m - 5
}

const accent = (ev: Ev): number => (ev.at === 0 ? 1 : ev.at % 2 === 0 ? 0.88 : 0.8)

interface LineOpts { oct?: number; vel?: number; gap?: number; glide?: boolean; harmony?: boolean }

/** Play melody events with a voice. */
function line(b: BarCtx, evs: readonly Ev[], voice: Voice, o: LineOpts = {}): void {
  const oct = o.oct ?? 0
  const vel = o.vel ?? 1
  const gap = o.gap ?? 0.94
  for (const ev of evs) {
    let m = ev.m + 12 * oct + b.tr
    if (o.harmony) m = under(m, chordAt(b, ev.at))
    const t = at(b, ev.at) + (b.rnd() - 0.5) * 0.006
    const dur = ev.len * b.e * gap
    const v = vel * accent(ev) * (0.95 + b.rnd() * 0.1)
    voice(b.k, b.out, m, t, dur, v, o.glide ? b.st.last : undefined)
    if (o.glide) b.st.last = m
  }
}

/**
 * The melody slowed to its skeleton: the note on the downbeat held for two
 * beats and the first note from beat three for one. The cellar's bassoon
 * sings the same tune at half the motion.
 */
function skeleton(bar: BarData): Ev[] {
  const out: Ev[] = []
  const first = bar.mel.find(e => e.at < 4)
  if (first) out.push({ at: first.at, len: Math.max(1, 4 - first.at), m: first.m })
  const third = bar.mel.find(e => e.at >= 4) ?? [...bar.mel].reverse().find(e => e.at >= 2 && e.at < 4)
  if (third && third !== first) out.push({ at: 4, len: 2, m: third.m })
  return out
}

interface OompahOpts {
  bass: Voice
  chord: Voice | null
  bv: number
  cv: number
  /** Lowest note of the chord voicing. */
  lo?: number
  /** Alternate root and fifth when a chord lasts two bars. */
  fifths?: boolean
  /** A chromatic walk into the next phrase on the last bar of every four. */
  fills?: boolean
}

/** Oom-pah-pah: bass on one, chords on two and three (or two and four in 4/4). */
function oompah(b: BarCtx, o: OompahOpts): void {
  const c0 = b.bar.chords[0]!
  const sameAsPrev = b.prev !== null && b.prev.chords[0]!.sym === c0.sym && b.prev.sec === b.bar.sec
  const bn = (o.fifths && sameAsPrev && b.bar.i % 2 === 1 && c0.bass === c0.root ? fifthOf(c0) : bassOf(c0)) + b.tr
  const n = beats(b)
  o.bass(b.k, b.out, bn, at(b, 0), b.beat * 0.8, o.bv)
  if (n === 4) {
    const c2 = chordAt(b, 4)
    o.bass(b.k, b.out, (c2.sym === c0.sym ? fifthOf(c0) : bassOf(c2)) + b.tr, at(b, 4), b.beat * 0.8, o.bv * 0.9)
  }
  const nextBass = bassOf(b.next.chords[0]!) + b.tr
  const walk = o.fills && b.bar.i % 4 === 3 && b.next.chords[0]!.sym !== c0.sym && n === 3
  if (walk) {
    o.bass(b.k, b.out, nextBass + 2, at(b, 2), b.beat * 0.7, o.bv * 0.8)
    o.bass(b.k, b.out, nextBass + 1, at(b, 4), b.beat * 0.7, o.bv * 0.85)
  }
  if (!o.chord) return
  const hits = n === 4 ? [2, 6] : [2, 4]
  for (const h of hits) {
    const c = chordAt(b, h)
    // A little Viennese lilt: the second beat comes a touch early.
    const t = at(b, h) - (h === 2 && n === 3 ? b.beat * 0.035 : 0)
    for (const m of voicing(c, o.lo ?? 55)) o.chord(b.k, b.out, m + b.tr, t, b.beat * 0.45, o.cv * (h === 2 ? 1 : 0.85))
  }
}

/** Brushes: a soft kick and swish on one, swishes after; a roll into each new section. */
function brushes(b: BarCtx, v: number): void {
  const n = beats(b)
  K.kick(b.k, b.out, at(b, 0), 0.45 * v)
  K.brush(b.k, b.out, at(b, 0), 0.7 * v, b.beat * 0.9)
  for (let i = 1; i < n; i++) K.brush(b.k, b.out, at(b, i * 2), v * (i === 1 ? 1 : 0.8))
  if (b.bar.i === b.bar.n - 1) {
    for (let x = 1; x < n * 2; x += 2) K.brush(b.k, b.out, at(b, x), v * (0.4 + x * 0.08), 0.08)
  }
}

/** Broken chords in eighths. */
function arpeggio(b: BarCtx, voice: Voice, lo: number, v: number, pattern = [0, 1, 2, 3, 2, 1]): void {
  for (let x = 0; x < b.bar.chords.length * 2; x++) {
    const vs = voicing(chordAt(b, x), lo, 3)
    const idx = pattern[x % pattern.length]!
    const m = idx < vs.length ? vs[idx]! : vs[0]! + 12
    voice(b.k, b.out, m + b.tr, at(b, x), b.e * 0.9, v * (x === 0 ? 1 : 0.8))
  }
}

/** Drops of water tuned to the chord, at random eighths. */
function drips(b: BarCtx, chance: number, v: number): void {
  for (let x = 0; x < b.bar.chords.length * 2; x++) {
    if (b.rnd() > chance) continue
    const c = chordAt(b, x)
    const pcs = c.pcs
    const m = place(pcs[Math.floor(b.rnd() * pcs.length)]!, 84)
    K.drip(b.k, b.out, m + b.tr, at(b, x) + b.rnd() * b.e * 0.5, 0.2, v * (0.6 + b.rnd() * 0.4))
  }
}

const isB = (b: BarCtx): boolean => b.bar.sec === 'B' || b.bar.sec === 'FB'
const isC = (b: BarCtx): boolean => b.bar.sec === 'C'
const odd = (b: BarCtx): boolean => b.pass % 2 === 1

// ---------------------------------------------------------------------------
// The floors
// ---------------------------------------------------------------------------

const ground: Arrangement = {
  level: 1,
  verb: 0.22,
  bar(b) {
    if (isC(b)) {
      oompah(b, { bass: K.tuba, chord: null, bv: 0.85, cv: 0 })
      arpeggio(b, K.harpsi, 57, 0.7)
      line(b, b.bar.mel, K.theremin, { glide: true, vel: 0.95 })
    } else {
      oompah(b, { bass: K.tuba, chord: K.harpsi, bv: 1, cv: 0.75, fifths: true, fills: true })
      if (isB(b) !== odd(b)) {
        line(b, b.bar.mel, K.harpsi, { vel: 1.25, gap: 0.8 })
        line(b, b.bar.mel, K.accordion, { harmony: true, vel: 0.8 })
      } else {
        line(b, b.bar.mel, K.theremin, { glide: true })
      }
    }
    brushes(b, isC(b) ? 0.6 : 1)
  },
}

const cellar: Arrangement = {
  level: 1.6,
  verb: 0.4,
  bar(b) {
    const c0 = b.bar.chords[0]!
    K.pizz(b.k, b.out, bassOf(c0, 33) + b.tr, at(b, 0), b.beat, 1)
    K.pizz(b.k, b.out, fifthOf(c0, 33) + 12 + b.tr, at(b, 4), b.beat, 0.6)
    if (b.bar.i % 2 === 1) {
      for (const m of voicing(chordAt(b, 2), 50, 2)) K.pizz(b.k, b.out, m + b.tr, at(b, 2), b.beat, 0.4)
    }
    if (isC(b)) line(b, b.bar.mel, K.bassoon, { oct: -1, vel: 1, gap: 0.97 })
    else line(b, skeleton(b.bar), K.bassoon, { oct: -1, vel: isB(b) ? 0.85 : 1, gap: 0.97 })
    // Second pass: a low bassoon pedal under the B section, like a snore.
    if (odd(b) && isB(b) && b.bar.i % 2 === 0) K.bassoon(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, 0), b.beat * 2.6, 0.45)
    drips(b, 0.09, 1)
  },
}

const attic: Arrangement = {
  level: 2.3,
  verb: 0.5,
  bar(b) {
    const c0 = b.bar.chords[0]!
    K.pizz(b.k, b.out, bassOf(c0, 45) + b.tr, at(b, 0), b.beat, 0.35)
    if (isB(b)) {
      for (let x = 0; x < 6; x += 2) {
        for (const m of voicing(chordAt(b, x), 79, 3)) K.musicBox(b.k, b.out, m + b.tr, at(b, x), b.e, x === 0 ? 0.7 : 0.45)
      }
    } else {
      arpeggio(b, K.musicBox, 81, 0.8, [0, 2, 1, 2, 0, 1])
    }
    if (odd(b)) {
      line(b, b.bar.mel, K.flute, { vel: 1 })
      line(b, b.bar.mel, K.celesta, { harmony: true, vel: 0.6 })
    } else {
      line(b, b.bar.mel, K.celesta, { vel: 1.1 })
      // A high flute holds the chord's third, a whistle through the rafters.
      if (b.bar.i % 2 === 0) {
        const third = c0.pcs[1] ?? c0.pcs[0]!
        K.flute(b.k, b.out, place(third, 81) + b.tr, at(b, 0), b.beat * 5.4, 0.45)
      }
    }
  },
}

const outside: Arrangement = {
  level: 1,
  verb: 0.55,
  bar(b) {
    const c0 = b.bar.chords[0]!
    K.tuba(b.k, b.out, bassOf(c0) + b.tr, at(b, 0), b.beat * 1.4, 0.55)
    const phrase = b.bar.i % 4
    if (phrase < 2) line(b, b.bar.mel, odd(b) ? K.glass : K.theremin, { glide: true, vel: 0.8 })
    else b.st.last = undefined
  },
}

const title: Arrangement = {
  level: 1,
  verb: 0.28,
  bar(b) {
    const sec = b.bar.sec
    if (sec === 'C') {
      oompah(b, { bass: K.tuba, chord: null, bv: 0.8, cv: 0 })
      arpeggio(b, K.harpsi, 57, 0.6)
      line(b, b.bar.mel, K.bassoon, { oct: -1, gap: 0.97 })
      line(b, b.bar.mel, K.celesta, { oct: 1, vel: 0.35 })
      drips(b, 0.06, 0.8)
      brushes(b, 0.5)
      return
    }
    oompah(b, { bass: K.tuba, chord: K.harpsi, bv: 1, cv: 0.72, fifths: true, fills: true })
    brushes(b, 1)
    if (sec === 'B') {
      line(b, b.bar.mel, K.harpsi, { vel: 1.25, gap: 0.8 })
      line(b, b.bar.mel, K.accordion, { harmony: true, vel: 0.8 })
      if (b.bar.i % 2 === 1) K.pizz(b.k, b.out, fifthOf(b.bar.chords[0]!, 45) + b.tr, at(b, 4), b.beat, 0.4)
    } else {
      line(b, b.bar.mel, K.theremin, { glide: true })
      if (sec === 'A2') {
        line(b, b.bar.mel, K.celesta, { oct: 1, vel: 0.4 })
        arpeggio(b, K.musicBox, 81, 0.5, [0, 2, 1, 2, 0, 1])
      }
    }
  },
}

// ---------------------------------------------------------------------------
// The cues
// ---------------------------------------------------------------------------

const intro: Arrangement = {
  level: 1,
  verb: 0.16,
  bar(b) {
    oompah(b, { bass: K.tuba, chord: K.accordion, bv: 1, cv: 1.1, lo: 57 })
    K.kick(b.k, b.out, at(b, 0), 0.5)
    K.kick(b.k, b.out, at(b, 4), 0.4)
    K.snare(b.k, b.out, at(b, 2), 0.45)
    K.snare(b.k, b.out, at(b, 6), 0.5)
    for (let x = 0; x < 8; x++) K.shaker(b.k, b.out, at(b, x), x % 2 === 0 ? 1 : 0.6)
    K.wiper(b.k, b.out, at(b, 0), 1, 1)
    K.wiper(b.k, b.out, at(b, 4), 1, -1)
    if (b.bar.sec === 'D') line(b, b.bar.mel, K.theremin, { glide: true })
    else {
      line(b, b.bar.mel, K.harpsi, { vel: 1.3, gap: 0.8 })
      line(b, b.bar.mel, K.theremin, { harmony: true, vel: 0.5, glide: true })
    }
  },
}

const seance: Arrangement = {
  level: 1.5,
  verb: 0.65,
  bar(b) {
    const c0 = b.bar.chords[0]!
    const barLen = b.beat * 3
    for (const m of voicing(c0, 53)) K.organ(b.k, b.out, m + b.tr, at(b, 0), barLen * 0.97, 0.9)
    K.organ(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, 0), barLen * 0.97, 1)
    line(b, b.bar.mel, K.glass, { gap: 1 })
    if (b.bar.i % 4 === 0) K.celesta(b.k, b.out, place(c0.root, 86) + b.tr, at(b, 0), 1, 0.35)
    if (b.bar.i % 8 === 7) {
      // A ghost sighs through the room: a slow theremin glide down a fifth.
      const m = place(c0.root, 74) + b.tr
      K.theremin(b.k, b.out, m, at(b, 2), b.beat * 1.8, 0.3, m + 7)
    }
  },
}

const tension: Arrangement = {
  level: 1.35,
  verb: 0.3,
  bar(b) {
    const sec = b.bar.sec
    const c0 = b.bar.chords[0]!
    for (let q = 0; q < 4; q++) K.tick(b.k, b.out, at(b, q * 2), q === 0 ? 1 : 0.8, q % 2 === 1)
    K.timpani(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, 0), sec === 'T1' ? 0.6 : 0.85)
    for (const m of voicing(c0, 50, 3)) K.strings(b.k, b.out, m + b.tr, at(b, 0), b.beat * 3.9, sec === 'T1' ? 0.6 : 0.8)
    if (sec === 'T1') return
    const vs = voicing(c0, 50, 3)
    const pat = [0, 1, 2, 1, 0, 1, 2, 3]
    for (let x = 0; x < 8; x++) {
      const i = pat[x]!
      const m = i < vs.length ? vs[i]! : vs[0]! + 12
      K.pizz(b.k, b.out, m + b.tr, at(b, x), b.e, x % 2 === 0 ? 0.8 : 0.55)
    }
    if (sec === 'T3') line(b, b.bar.mel, K.strings, { vel: 1.2, gap: 1 })
    if (sec === 'T4') {
      line(b, b.bar.mel, K.brass, { vel: 1 })
      K.timpani(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, 4), 0.6)
    }
    if (b.bar.i === b.bar.n - 1 && sec !== 'T2') {
      for (let x = 0; x < 16; x++) K.snare(b.k, b.out, at(b, x / 2), 0.15 + x * 0.02)
    }
  },
}

const finale: Arrangement = {
  level: 1,
  verb: 0.25,
  bar(b) {
    const c0 = b.bar.chords[0]!
    oompah(b, { bass: K.tuba, chord: K.harpsi, bv: 1.05, cv: 0.8, fifths: true, fills: true })
    for (const x of [2, 4]) for (const m of voicing(chordAt(b, x), 62, 3)) K.accordion(b.k, b.out, m + b.tr, at(b, x), b.beat * 0.4, 0.7)
    K.kick(b.k, b.out, at(b, 0), 0.6)
    K.snare(b.k, b.out, at(b, 2), 0.35)
    K.snare(b.k, b.out, at(b, 4), 0.3)
    if (b.bar.i % 8 === 0) K.cymbal(b.k, b.out, at(b, 0), 1)
    if (b.bar.i % 4 === 0) K.timpani(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, 0), 0.8)
    line(b, b.bar.mel, K.brass, { vel: 1.1 })
    line(b, b.bar.mel, K.celesta, { oct: 1, vel: 0.45 })
    if (b.bar.sec === 'FB') line(b, b.bar.mel, K.flute, { harmony: true, vel: 0.7 })
    if (b.bar.sec === 'FE' && b.bar.i === b.bar.n - 1) {
      for (let x = 0; x < 6; x++) K.timpani(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, x), 0.3 + x * 0.1)
      K.cymbal(b.k, b.out, at(b, 0), 1.2)
    }
  },
}

const credits: Arrangement = {
  level: 2.2,
  verb: 0.38,
  bar(b) {
    const c0 = b.bar.chords[0]!
    const sec = b.bar.sec
    K.pizz(b.k, b.out, bassOf(c0, 38) + b.tr, at(b, 0), b.beat, 1)
    K.pizz(b.k, b.out, fifthOf(c0, 38) + 12 + b.tr, at(b, 4), b.beat, 0.55)
    for (const m of voicing(chordAt(b, 2), 57)) K.harpsi(b.k, b.out, m + b.tr, at(b, 2), b.beat * 0.4, 0.45)
    for (const m of voicing(chordAt(b, 4), 57)) K.harpsi(b.k, b.out, m + b.tr, at(b, 4), b.beat * 0.4, 0.38)
    brushes(b, 0.55)
    if (b.bar.i % 2 === 1) arpeggio(b, K.musicBox, 81, 0.4, [0, 2, 1, 2, 0, 1])
    if (sec === 'F') line(b, b.bar.mel, K.accordion, { vel: 1.3 })
    else if (sec === 'B') {
      line(b, b.bar.mel, K.celesta, { vel: 1.1 })
      line(b, b.bar.mel, K.flute, { harmony: true, vel: 0.55 })
    } else if (sec === 'C') {
      line(b, b.bar.mel, K.flute, { vel: 1 })
      arpeggio(b, K.harpsi, 57, 0.4)
    } else {
      line(b, b.bar.mel, K.accordion, { vel: 1.2 })
      line(b, b.bar.mel, K.celesta, { oct: 1, vel: 0.4 })
    }
  },
}

export const ARRANGEMENTS: Record<ArrId, Arrangement> = {
  title, ground, cellar, attic, outside, intro, seance, tension, finale, credits,
}

/** Exposed for the tests. */
export const _internals = { voicing, bassOf, fifthOf, under, skeleton }
