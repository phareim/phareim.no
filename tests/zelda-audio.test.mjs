// Neon Shrine music data: every track compiles, the Wildwood tracks keep
// their character, every jingle is in range. Bundles audio.ts with esbuild
// (it imports the radio modules without extensions).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')
const out = esbuild.buildSync({
  stdin: { contents: `export * from './audio'`, resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const A = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

test('every track and jingle compiles cleanly', () => {
  assert.deepEqual(A.validateTracks(), [])
})

test('the Wildwood tracks exist and sit in their tempo ranges', () => {
  const { forest, lab, static: st } = A.TRACKS
  assert.ok(forest.bpm >= 100 && forest.bpm <= 112)
  assert.ok(lab.bpm >= 96 && lab.bpm <= 110)
  assert.ok(st.bpm >= 70 && st.bpm <= 80)
  for (const t of [forest, lab, st]) {
    const { track } = A.compileTrack(t)
    assert.ok(track.bars.length >= 16)
  }
})

test('the lab runs a steady sixteenth sequence in every section', () => {
  for (const sec of Object.values(A.TRACKS.lab.sections)) {
    assert.equal(sec.arp, 'up')
    assert.equal(sec.arpRate, 16)
  }
})

test('the Other Side has almost no drums', () => {
  const { track } = A.compileTrack(A.TRACKS.static)
  let hits = 0
  for (const b of track.bars) for (const lane of ['k', 's', 'h']) hits += [...b.drums[lane]].filter(c => c !== '.').length
  assert.ok(hits / track.bars.length <= 3, `${hits} hits in ${track.bars.length} bars`)
})

test('the friend jingle is about two seconds', () => {
  const j = A.JINGLES.friend
  const beats = Math.max(...j.notes.map(([b, , len]) => b + len))
  const secs = beats * 60 / j.bpm
  assert.ok(secs > 1.6 && secs < 2.6, `${secs}s`)
})

// ---- a small fake Web Audio that records misuse instead of throwing silently

const misuse = []
const bad = msg => { misuse.push(msg); throw new Error(msg) }
const finite = (v, what) => { if (typeof v !== 'number' || !Number.isFinite(v)) bad(`${what}: ${v}`) }
class Param {
  constructor(v = 0) { this.value = v }
  setValueAtTime(v, t) { finite(v, 'set'); finite(t, 'time'); return this }
  linearRampToValueAtTime(v, t) { finite(v, 'lin'); finite(t, 'time'); return this }
  exponentialRampToValueAtTime(v, t) { finite(v, 'exp'); finite(t, 'time'); if (v <= 0) bad('exp ramp to ' + v); return this }
  setTargetAtTime(v, t, c) { finite(v, 'target'); finite(t, 'time'); finite(c, 'constant'); return this }
  cancelScheduledValues() { return this }
}
class Node {
  constructor(ctx) { this.ctx = ctx }
  connect(d) { if (!(d instanceof Node) && !(d instanceof Param)) bad('connect to non-node'); if (d.ctx && d.ctx !== this.ctx) bad('cross-context connect'); return d }
  disconnect() {}
}
class Src extends Node {
  start(t = 0) { finite(t, 'start'); if (this.started) bad('started twice'); this.started = true }
  stop(t = 0) { finite(t, 'stop'); if (!this.started) bad('stop before start') }
}
class Ctx {
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(this) }
  createGain() { const n = new Node(this); n.gain = new Param(1); return n }
  createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); return n }
  createDynamicsCompressor() { const n = new Node(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n }
  createConvolver() { return new Node(this) }
  createWaveShaper() { return new Node(this) }
  createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n }
  createOscillator() { const o = new Src(this); o.frequency = new Param(440); o.detune = new Param(0); o.setPeriodicWave = () => {}; return o }
  createBufferSource() { const s = new Src(this); s.start = function (t = 0, off = 0) { finite(off, 'offset'); if (!this.buffer) bad('no buffer'); Src.prototype.start.call(this, t) }; return s }
  createBuffer(ch, len, rate) { if (len < 1) bad('empty buffer'); const d = Array.from({ length: ch }, () => new Float32Array(len)); return { getChannelData: i => d[i], length: len, sampleRate: rate } }
  createPeriodicWave() { return {} }
  resume() { return Promise.resolve() }
  suspend() { return Promise.resolve() }
  close() { return Promise.resolve() }
}

test('every SFX, the friend jingle and the Wildwood tracks run on a fake Web Audio', () => {
  const ticks = []
  const realSet = globalThis.setInterval
  const realClear = globalThis.clearInterval
  let ctx = null
  globalThis.window = { AudioContext: class extends Ctx { constructor() { super(); ctx = this } } }
  globalThis.setInterval = fn => { ticks.push(fn); return ticks.length }
  globalThis.clearInterval = id => { ticks[id - 1] = null }
  try {
    const audio = A.createZeldaAudio()
    audio.unlock()
    assert.ok(ctx)
    const names = ['hook', 'hookHit', 'pull', 'psi', 'glyph', 'lever', 'land', 'beam', 'gust', 'bark',
      'sword', 'hit', 'boom', 'disc', 'bossRoar']
    for (const n of names) { audio.sfx(n); audio.sfx(n) }
    audio.jingle('friend')
    for (const id of ['forest', 'lab', 'static']) {
      audio.music(id)
      // Play 40 s in 25 ms ticks: every section of every track at least once.
      for (let i = 0; i < 1600; i++) { ctx.currentTime += 0.025; for (const f of ticks) f?.() }
    }
    audio.dispose()
    audio.unlock()
    audio.sfx('bark') // a new context must not reuse the old one's shaper
    audio.dispose()
  } finally {
    delete globalThis.window
    globalThis.setInterval = realSet
    globalThis.clearInterval = realClear
  }
  assert.deepEqual(misuse, [])
})
