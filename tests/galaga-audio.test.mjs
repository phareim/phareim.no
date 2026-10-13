import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  TRACKS, TRACK_NAMES, intensityVoices, transposeFor, parseLead, midi, hz,
  SFX_NAMES, soundFor, createGalagaAudio,
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

// ── The one-shots of Space Voyagers ──────────────────────────────────────

test('the one-shots DESIGN.md names are there, each once', () => {
  assert.equal(new Set(SFX_NAMES).size, SFX_NAMES.length)
  for (const name of ['radioOpen', 'radioClose', 'beam', 'tow', 'duet', 'horn']) assert.ok(SFX_NAMES.includes(name), name)
})

test('every engine event is either silent or makes a one-shot that exists', () => {
  const src = readFileSync(new URL('../themes/galaga/engine/events.ts', import.meta.url), 'utf8')
  const types = [...src.matchAll(/E<'(\w+)'/g)].map(m => m[1])
  assert.ok(types.length >= 55, `${types.length} event types read from events.ts`)
  const heard = new Set()
  for (const type of types) {
    for (const kind of ['', 'blaster', 'disc', 'boombox', 'wing', 'boss', 'enemy', 'armor', 'door', 'bubble', 'mirrorball', 'tracking', 'marge', 'babs', 'sector']) {
      for (const n of [0, 1, 2, 100]) {
        const s = soundFor(type, kind, n)
        assert.ok(s === null || SFX_NAMES.includes(s), `${type}/${kind}: ${s}`)
        if (s) heard.add(s)
      }
    }
  }
  // The page plays these itself: the radio keying up and letting go, a boss cutting in.
  for (const name of SFX_NAMES) assert.ok(heard.has(name) || ['radioOpen', 'radioClose', 'cutIn'].includes(name), `nothing plays ${name}`)
})

test('which sound an event makes', () => {
  assert.equal(soundFor('shot', 'blaster', 0), 'shoot')
  assert.equal(soundFor('shot', 'disc', 0), 'disc')
  assert.equal(soundFor('shot', 'boombox', 0), 'bass')
  assert.equal(soundFor('shot', 'blaster', 1), null, 'the partner\'s guns are not heard')
  assert.equal(soundFor('shot', 'wing', 2), null)
  assert.equal(soundFor('pop', 'enemy-hogs-grunt', 100), 'kill')
  assert.equal(soundFor('pop', 'enemy-hogs-grunt', 0), null, 'a pop that is not the player\'s is silent')
  assert.equal(soundFor('beamOn', 'enemy-hogs-captor', 100), 'beam')
  assert.equal(soundFor('tow', '', 1), 'tow')
  assert.equal(soundFor('duetOn', '', 0), 'duet')
  assert.equal(soundFor('convoyIn', 'marge', 0), 'horn')
  assert.equal(soundFor('rig', 'rig-duckie', 0), 'horn')
  assert.equal(soundFor('pass', 'duckie', 0), 'horn')
  assert.equal(soundFor('pass', 'babs', 0), null, 'a rocket has no horn')
  assert.equal(soundFor('card', 'boss', 1), 'warning')
  assert.equal(soundFor('card', 'sector', 1), null)
  assert.equal(soundFor('cue', 'idle', 0), null)
})

test('every one-shot plays against a fake Web Audio and makes a sound source', () => {
  let sources = 0
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {} })
  const node = () => ({
    gain: param(), frequency: param(), delayTime: param(), type: '', buffer: null, loop: false, loopStart: 0,
    connect() {}, start() {}, stop() {},
  })
  class FakeContext {
    currentTime = 0
    sampleRate = 8000
    state = 'running'
    destination = node()
    createGain() { return node() }
    createBiquadFilter() { return node() }
    createConvolver() { return node() }
    createDelay() { return node() }
    createOscillator() { sources++; return node() }
    createBufferSource() { sources++; return node() }
    createBuffer(_c, len) { return { getChannelData: () => new Float32Array(len) } }
    resume() { return Promise.resolve() }
    suspend() { return Promise.resolve() }
    close() { return Promise.resolve() }
  }
  const before = globalThis.window
  let ctx = null
  globalThis.window = { AudioContext: class extends FakeContext { constructor() { super(); ctx = this } } }
  try {
    const audio = createGalagaAudio()
    assert.equal(audio.start(), true)
    for (const name of SFX_NAMES) {
      ctx.currentTime += 1
      const was = sources
      audio.play(name)
      assert.ok(sources > was, `${name} made no sound`)
    }
    const was = sources
    audio.play('no such sound')
    assert.equal(sources, was)
    // The guns are limited: a second volley 50 ms on is not heard.
    ctx.currentTime += 1
    audio.play('shoot')
    const after = sources
    ctx.currentTime += 0.05
    audio.play('shoot')
    assert.equal(sources, after)
    audio.dispose()
  } finally {
    globalThis.window = before
  }
})
