import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TRACKS as GALAGA_TRACKS, TRACK_NAMES as GALAGA_NAMES, midi, thirdFor,
} from '../themes/galaga/audio.ts'
import { TRACKS as OUTRUN_TRACKS, TRACK_NAMES as OUTRUN_NAMES } from '../themes/outrun/audio.ts'

const ALL = [...GALAGA_TRACKS, ...OUTRUN_TRACKS]
const BASS_ALPHABET = new Set(['R', 'o', '5', '3', '7', '.'])
const DRUM_ALPHABET = new Set(['x', '.'])

test('six tracks keep the sequencer shape (8 bars, 16-step patterns)', () => {
  assert.equal(ALL.length, 6)
  for (const t of ALL) {
    assert.equal(t.bars.length, 8)
    assert.equal(t.lead.length, 8)
    for (const line of t.lead) assert.equal(line.trim().split(/\s+/).length, 8)
    for (const pat of [t.bass, t.kick, t.snare, t.hat]) assert.equal(pat.length, 16)
    for (const bar of t.bars) assert.equal(bar.chord.length, 3)
    for (const ch of t.bass) assert.ok(BASS_ALPHABET.has(ch), `${t.name}: bass char ${ch}`)
    for (const pat of [t.kick, t.snare, t.hat]) {
      for (const ch of pat) assert.ok(DRUM_ALPHABET.has(ch), `${t.name}: drum char ${ch}`)
    }
    assert.ok((t.swing ?? 0) >= 0 && (t.swing ?? 0) <= 0.3, `${t.name}: swing range`)
  }
  assert.deepEqual([...GALAGA_NAMES], ['STARDUST RUN', 'VOID CHOIR', 'BULLET BALLET'])
  assert.deepEqual([...OUTRUN_NAMES], ['MIDNIGHT SHOWER', 'PASSING NEON', 'SPLASH GRID'])
})

test('midi understands flats as well as sharps (no NaN lead notes)', () => {
  assert.equal(midi('Db5'), midi('C#5'))
  assert.equal(midi('Ab4'), midi('G#4'))
  assert.ok(midi('Bb4') > 0)
  assert.equal(midi('nope'), -1)
  for (const t of ALL) {
    for (const line of t.lead) {
      for (const tok of line.trim().split(/\s+/)) {
        if (tok === '-' || tok === '.') continue
        assert.ok(midi(tok) > 0, `${t.name}: unplayable token ${tok}`)
      }
    }
  }
})

test('thirdFor resolves minor/major through inversions', () => {
  assert.equal(thirdFor({ root: 41, chord: [53, 56, 60] }), 3) // Fm
  assert.equal(thirdFor({ root: 41, chord: [53, 57, 60] }), 4) // F
  assert.equal(thirdFor({ root: 48, chord: [60, 64, 67] }), 4) // C root position
  assert.equal(thirdFor({ root: 34, chord: [46, 49, 53] }), 3) // Bbm
  assert.equal(thirdFor({ root: 47, chord: [59, 63, 66] }), 4) // B major
})

test('every bar downbeat is a chord tone or a half-step approach', () => {
  for (const t of ALL) {
    t.bars.forEach((bar, i) => {
      const first = t.lead[i].trim().split(/\s+/)[0]
      assert.ok(first !== '.' && first !== '-', `${t.name} bar ${i}: lead must open with a note`)
      const iv = ((midi(first) - bar.root) % 12 + 12) % 12
      const pcs = new Set(bar.chord.map(n => ((n - bar.root) % 12 + 12) % 12))
      const ok = pcs.has(iv) || pcs.has((iv + 1) % 12) || pcs.has((iv + 11) % 12)
      assert.ok(ok, `${t.name} bar ${i}: ${first} clashes with the chord`)
    })
  }
})

test('second half lifts: the turnaround differs from the loop start', () => {
  for (const t of ALL) {
    const first = t.bars[0]
    const last = t.bars[7]
    const same = last.root === first.root &&
      last.chord.length === first.chord.length &&
      last.chord.every((n, i) => n === first.chord[i])
    assert.ok(!same, `${t.name}: bar 8 must turn around, not restate bar 1`)
    const halfA = JSON.stringify(t.bars.slice(0, 4))
    const halfB = JSON.stringify(t.bars.slice(4))
    assert.ok(halfA !== halfB, `${t.name}: bars 5-8 must differ from 1-4`)
  }
})
