// Neon Shrine's sound: the tracks, jingles and 16-bit tables are whole, and both
// chips play all of them on a fake Web Audio that records every misuse. Bundles
// audio.ts with esbuild (it imports the radio modules without extensions).
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
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(this); this.sources = 0; this.oscs = 0; this.buffers = 0; this.filters = [] }
  createGain() { const n = new Node(this); n.gain = new Param(1); return n }
  createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); this.filters.push(n); return n }
  createStereoPanner() { const n = new Node(this); n.pan = new Param(0); return n }
  createDynamicsCompressor() { const n = new Node(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n }
  createConvolver() { return new Node(this) }
  createWaveShaper() { return new Node(this) }
  createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n }
  createOscillator() { const o = new Src(this); this.oscs++; o.frequency = new Param(440); o.detune = new Param(0); o.setPeriodicWave = () => {}; return o }
  createBufferSource() { const s = new Src(this); this.sources++; s.playbackRate = new Param(1); s.start = function (t = 0, off = 0) { finite(off, 'offset'); if (!this.buffer) bad('no buffer'); Src.prototype.start.call(this, t) }; return s }
  createBuffer(ch, len, rate) { this.buffers++; if (len < 1) bad('empty buffer'); finite(rate, 'rate'); const d = Array.from({ length: ch }, () => new Float32Array(len)); return { getChannelData: i => d[i], length: len, sampleRate: rate } }
  createPeriodicWave() { return {} }
  resume() { return Promise.resolve() }
  suspend() { return Promise.resolve() }
  close() { return Promise.resolve() }
}

const SFX_NAMES = ['sword', 'spin', 'charge', 'hit', 'kill', 'clank', 'hurt', 'shock', 'die', 'cut',
  'shatter', 'lift', 'throw', 'coin', 'heart', 'key', 'chest', 'unlock', 'door', 'plate',
  'crystal', 'push', 'bombPlace', 'boom', 'disc', 'discHit', 'fall', 'pellet', 'laser',
  'reflect', 'warp', 'stairs', 'text', 'menu', 'select', 'error', 'bossRoar', 'bossHit',
  'bossDie', 'lowHp', 'gate', 'hook', 'hookHit', 'pull', 'psi', 'glyph', 'lever', 'land', 'beam', 'gust', 'bark',
  'flip', 'comet', 'hop', 'slip',
  'sword2', 'swordHeavy', 'hitHeavy', 'roll']

test('every track and jingle compiles cleanly, and the 16-bit tables have a voice for each', () => {
  assert.deepEqual(A.validateTracks(), [])
  assert.deepEqual(A.validateSpc(), [])
})

for (const flavor of ['8-bit', '16-bit']) {
  test(`the ${flavor} chip plays every track, SFX and jingle on a fake Web Audio`, () => {
    const ticks = []
    const later = []
    const real = { setInterval: globalThis.setInterval, clearInterval: globalThis.clearInterval, setTimeout: globalThis.setTimeout }
    let ctx = null
    globalThis.window = { AudioContext: class extends Ctx { constructor() { super(); ctx = this } } }
    globalThis.setInterval = f => { ticks.push(f); return ticks.length }
    globalThis.clearInterval = id => { ticks[id - 1] = null }
    globalThis.setTimeout = f => { later.push(f); return 0 }
    misuse.length = 0
    /** Moves the clock in 25 ms ticks. */
    const play = secs => { for (let i = 0; i < secs * 40; i++) { ctx.currentTime += 0.025; for (const f of ticks) f?.() } }
    try {
      const audio = A.createZeldaAudio()
      // Asked for before the first key: remembered, and the first track starts on that chip.
      audio.setFlavor(flavor)
      audio.unlock()
      assert.ok(ctx)
      // What unlock builds belongs to both chips (the 8-bit delay's filter among it).
      const shared = ctx.filters.length
      // The 16-bit chip records its instruments in the background, one at a time; the 8-bit one records nothing.
      const before = ctx.buffers
      let most = 0
      for (let guard = 0; later.length && guard < 500; guard++) {
        const had = ctx.buffers
        later.shift()()
        most = Math.max(most, ctx.buffers - had)
      }
      if (flavor === '16-bit') {
        const all = Object.values(A.SPC_SAMPLES).reduce((n, spec) => n + spec.roots.length, 0) + Object.keys(A.SPC_GAIN.drums).length
        assert.deepEqual([ctx.buffers - before, most], [all, 1])
      }
      const made = ctx.buffers
      // 40 s of each: every section of every track at least once.
      for (const id of Object.keys(A.TRACKS)) { audio.music(id); play(40) }
      if (flavor === '16-bit') {
        assert.equal(ctx.buffers, made, 'a track records nothing more')
        // No filter on this chip has a peak at its corner (Q is in dB for a lowpass: 0 and under is none). One in the
        // echo's loop would ring louder with every repeat.
        const lows = ctx.filters.slice(shared).filter(f => f.type === 'lowpass' || f.type === 'highpass')
        assert.ok(lows.length > 0)
        for (const f of lows) assert.ok(f.Q.value <= 0, `a ${f.type} at ${f.frequency.value} Hz with a ${f.Q.value} dB peak`)
      }
      for (const n of SFX_NAMES) { audio.sfx(n); audio.sfx(n) }
      for (const j of Object.keys(A.JINGLES)) audio.jingle(j)
      play(4)
      // A track that ends leaves its echo to ring out, and the next one brings its own.
      audio.music(null)
      play(6)
      audio.music('overworld')
      play(7.3)
      // A change of chip in the middle of a track, and back again.
      for (const to of flavor === '8-bit' ? ['16-bit', '8-bit'] : ['8-bit', '16-bit']) { audio.setFlavor(to); audio.setFlavor(to); play(2) }
      // A new context must not reuse the old one's nodes.
      audio.dispose()
      audio.unlock()
      audio.sfx('bark')
      audio.dispose()
    } finally {
      delete globalThis.window
      Object.assign(globalThis, real)
    }
    assert.deepEqual(misuse, [])
    // (The fake cannot hear: no recording may clip.)
    if (flavor === '16-bit') {
      for (const [name, spec] of Object.entries(A.SPC_SAMPLES)) {
        for (const root of spec.roots) {
          let peak = 0
          for (const v of A.renderSpcSample(name, root).data) peak = Math.max(peak, Math.abs(v))
          assert.ok(peak > 0 && peak <= 1, `${name} ${root}: peak ${peak}`)
        }
      }
    }
  })
}
