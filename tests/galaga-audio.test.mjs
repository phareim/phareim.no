import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  TRACKS, TRACK_NAMES, intensityVoices, transposeFor, parseLead, midi, hz,
} from '../themes/galaga/audio.ts'

test('three stations with 8 bars each', () => {
  assert.deepEqual([...TRACK_NAMES], ['STARDUST RUN', 'VOID CHOIR', 'BULLET BALLET'])
  assert.equal(TRACKS.length, 3)
  for (const t of TRACKS) {
    assert.equal(t.bars.length, 8)
    assert.equal(t.lead.length, 8)
    assert.equal(t.bass.length, 16)
    assert.equal(t.kick.length, 16)
    assert.equal(t.snare.length, 16)
    assert.equal(t.hat.length, 16)
    for (const bar of t.bars) assert.equal(bar.chord.length, 3)
  }
  assert.ok(TRACKS[0].bpm !== TRACKS[1].bpm && TRACKS[1].bpm !== TRACKS[2].bpm)
})

test('intensity voices build from arp-only to full band', () => {
  assert.deepEqual(intensityVoices(0), { arp: true, bass: false, lead: false, snare: false })
  assert.deepEqual(intensityVoices(1), { arp: true, bass: true, lead: false, snare: false })
  assert.deepEqual(intensityVoices(2), { arp: true, bass: true, lead: true, snare: true })
  assert.deepEqual(intensityVoices(3), { arp: true, bass: true, lead: true, snare: true })
  assert.equal(transposeFor(false), 0)
  assert.equal(transposeFor(true), 2)
})

test('lead parser and note helpers', () => {
  assert.equal(midi('A4'), 69)
  assert.equal(midi('C5'), 72)
  assert.equal(midi('nope'), -1)
  assert.ok(Math.abs(hz(69) - 440) < 0.001)
  const steps = parseLead(['C5 . A4 C5 - D5 C5 A4'])
  assert.equal(steps.length, 16)
  assert.equal(steps[0], 72)
  assert.equal(steps[2], -1)
  assert.equal(steps[8], -2)
})
