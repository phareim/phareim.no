// Neon Shrine music data: every track compiles, the Wildwood tracks keep
// their character, every jingle is in range, and the 16-bit flavour has a
// voice for everything the 8-bit one plays. Bundles audio.ts with esbuild
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
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(this); this.panners = 0; this.sources = 0 }
  createGain() { const n = new Node(this); n.gain = new Param(1); return n }
  createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); return n }
  createStereoPanner() { const n = new Node(this); n.pan = new Param(0); this.panners++; return n }
  createDynamicsCompressor() { const n = new Node(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n }
  createConvolver() { return new Node(this) }
  createWaveShaper() { return new Node(this) }
  createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n }
  createOscillator() { const o = new Src(this); o.frequency = new Param(440); o.detune = new Param(0); o.setPeriodicWave = () => {}; return o }
  createBufferSource() { const s = new Src(this); this.sources++; s.playbackRate = new Param(1); s.start = function (t = 0, off = 0) { finite(off, 'offset'); if (!this.buffer) bad('no buffer'); Src.prototype.start.call(this, t) }; return s }
  createBuffer(ch, len, rate) { if (len < 1) bad('empty buffer'); finite(rate, 'rate'); const d = Array.from({ length: ch }, () => new Float32Array(len)); return { getChannelData: i => d[i], length: len, sampleRate: rate } }
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

// ---- the 16-bit flavour ----------------------------------------------------

const SFX_NAMES = ['sword', 'spin', 'charge', 'hit', 'kill', 'clank', 'hurt', 'shock', 'die', 'cut',
  'shatter', 'lift', 'throw', 'coin', 'heart', 'key', 'chest', 'unlock', 'door', 'plate',
  'crystal', 'push', 'bombPlace', 'boom', 'disc', 'discHit', 'fall', 'pellet', 'laser',
  'reflect', 'warp', 'stairs', 'text', 'menu', 'select', 'error', 'bossRoar', 'bossHit',
  'bossDie', 'lowHp', 'gate', 'hook', 'hookHit', 'pull', 'psi', 'glyph', 'lever', 'land', 'beam', 'gust', 'bark']

test('the 16-bit tables are whole: a patch per track, a lead per jingle, sane gains, a kit that renders', () => {
  assert.deepEqual(A.validateSpc(), [])
  assert.deepEqual(Object.keys(A.SPC_PATCHES).sort(), Object.keys(A.TRACKS).sort())
  assert.deepEqual(Object.keys(A.SPC_JINGLE_LEAD).sort(), Object.keys(A.JINGLES).sort())
})

test('every 8-bit voice a track uses has a 16-bit one', () => {
  for (const [id, def] of Object.entries(A.TRACKS)) {
    const p = A.SPC_PATCHES[id]
    assert.ok(A.SPC_GAIN.lead[p.lead] > 0, `${id}: lead for ${def.lead}`)
    assert.ok(A.SPC_GAIN.bass[p.bass] > 0, `${id}: bass for ${def.bass}`)
    assert.ok(A.SPC_GAIN.arp[p.arp] > 0, `${id}: arp for ${def.arpVoice ?? 'square'}`)
    assert.ok(A.SPC_GAIN.pad[p.pad] > 0, `${id}: pad`)
    // The level is a trim against the 8-bit mix, not a second volume knob.
    assert.ok(p.level >= 0.5 && p.level <= 1.6, `${id}: level ${p.level}`)
  }
  for (const [kind, table] of Object.entries(A.SPC_GAIN)) {
    for (const [name, g] of typeof table === 'number' ? [[kind, table]] : Object.entries(table)) assert.ok(g > 0 && g <= 2, `${kind}.${name}: ${g}`)
  }
})

test('the 16-bit wavetables are short, start on their fundamental and never get brighter going up', () => {
  for (const [name, amps] of Object.entries(A.SPC_WAVES)) {
    assert.ok(amps.length >= 2 && amps.length <= 32, name)
    assert.equal(amps[0], 1, name)
    // The top third of a wave is quieter than its bottom third: the chip's samples were dull on top.
    const third = Math.ceil(amps.length / 3)
    const sum = a => a.reduce((x, y) => x + y, 0)
    assert.ok(sum(amps.slice(-third)) < sum(amps.slice(0, third)), name)
  }
})

test('the 16-bit drum kit is the same every time, ends on silence and each drum is its own sound', () => {
  const drums = Object.keys(A.SPC_GAIN.drums)
  assert.deepEqual(drums.sort(), ['hat', 'kick', 'openHat', 'snare', 'tom'])
  // Zero crossings per second: a kick is low, a hat is high.
  const crossings = d => { let n = 0; for (let i = 1; i < d.length; i++) if ((d[i] >= 0) !== (d[i - 1] >= 0)) n++; return n / (d.length / A.SPC_RATE) }
  for (const name of drums) {
    const a = A.renderSpcDrum(name)
    const b = A.renderSpcDrum(name)
    assert.deepEqual(Array.from(a), Array.from(b), name)
    assert.ok(a.length > A.SPC_RATE * 0.05 && a.length < A.SPC_RATE * 0.5, name)
    let peak = 0
    for (const v of a) peak = Math.max(peak, Math.abs(v))
    assert.ok(Math.abs(peak - 0.9) < 0.001, `${name}: peak ${peak}`)
    assert.ok(Math.abs(a[a.length - 1]) < 0.001, `${name}: ends on ${a[a.length - 1]}`)
  }
  assert.ok(crossings(A.renderSpcDrum('kick')) < 400)
  assert.ok(crossings(A.renderSpcDrum('tom')) < 800)
  assert.ok(crossings(A.renderSpcDrum('hat')) > 6000)
  assert.ok(crossings(A.renderSpcDrum('snare')) > crossings(A.renderSpcDrum('tom')))
  assert.ok(A.renderSpcDrum('openHat').length > A.renderSpcDrum('hat').length * 3)
})

test('the 16-bit echo sits on the chip’s 16 ms grid and follows the tempo', () => {
  for (const def of Object.values(A.TRACKS)) {
    const t = A.spcEchoTime(def.bpm)
    assert.ok(t >= 0.064 - 1e-9 && t <= 0.24 + 1e-9, `${def.bpm}: ${t}`)
    assert.ok(Math.abs(t / 0.016 - Math.round(t / 0.016)) < 1e-6, `${def.bpm}: ${t}`)
  }
  assert.ok(A.spcEchoTime(150) < A.spcEchoTime(100))
})

test('a view picks the flavour: the isometric engine is 16-bit unless it says otherwise', () => {
  assert.equal(A.flavorForView('classic'), '8-bit')
  assert.equal(A.flavorForView('blyant', { sound: '16-bit' }), '8-bit')
  assert.equal(A.flavorForView('iso'), '16-bit')
  assert.equal(A.flavorForView('iso', {}), '16-bit')
  assert.equal(A.flavorForView('iso', null), '16-bit')
  assert.equal(A.flavorForView('iso', { sound: '16-bit' }), '16-bit')
  assert.equal(A.flavorForView('iso', { sound: '8-bit' }), '8-bit')
})

/** Run `fn(audio, ctx, play)` on the fake Web Audio; `play(seconds)` moves its clock in 25 ms ticks. */
function onFake(fn) {
  const ticks = []
  const realSet = globalThis.setInterval
  const realClear = globalThis.clearInterval
  let ctx = null
  globalThis.window = { AudioContext: class extends Ctx { constructor() { super(); ctx = this } } }
  globalThis.setInterval = f => { ticks.push(f); return ticks.length }
  globalThis.clearInterval = id => { ticks[id - 1] = null }
  misuse.length = 0
  try {
    const audio = A.createZeldaAudio()
    const play = secs => { for (let i = 0; i < secs * 40; i++) { ctx.currentTime += 0.025; for (const f of ticks) f?.() } }
    fn(audio, () => ctx, play)
    audio.dispose()
  } finally {
    delete globalThis.window
    globalThis.setInterval = realSet
    globalThis.clearInterval = realClear
  }
  assert.deepEqual(misuse, [])
}

test('the 8-bit flavour never touches the 16-bit chip', () => {
  onFake((audio, ctx, play) => {
    audio.unlock()
    audio.music('overworld')
    play(20)
    for (const n of SFX_NAMES) audio.sfx(n)
    audio.jingle('fanfare')
    // No stereo panner and no sampled drum: the graph is the one it always was.
    assert.equal(ctx().panners, 0)
    audio.setFlavor('8-bit')
    play(2)
    assert.equal(ctx().panners, 0)
  })
})

test('every track, every SFX and every jingle runs in the 16-bit flavour', () => {
  onFake((audio, ctx, play) => {
    // Asked for before the first key: remembered, and the first track starts on that chip.
    audio.setFlavor('16-bit')
    audio.unlock()
    for (const id of Object.keys(A.TRACKS)) {
      audio.music(id)
      play(40)
    }
    assert.ok(ctx().panners > 0)
    for (const n of SFX_NAMES) { audio.sfx(n); audio.sfx(n) }
    for (const j of Object.keys(A.JINGLES)) audio.jingle(j)
    play(4)
  })
})

test('a change of flavour in the middle of a track neither restarts it nor leaves the old chip sounding', () => {
  onFake((audio, ctx, play) => {
    audio.unlock()
    audio.music('overworld')
    play(7.3)
    const before = ctx().sources
    audio.setFlavor('16-bit')
    audio.setFlavor('16-bit')
    play(6)
    // The kit is samples: the 16-bit drums are buffer sources, more than the 8-bit noise hits were.
    assert.ok(ctx().sources > before)
    const pannersAt = ctx().panners
    audio.setFlavor('8-bit')
    play(0.1)
    audio.setFlavor('16-bit')
    play(0.1)
    audio.setFlavor('8-bit')
    // Only what was already scheduled may still be voiced on the old chip: a handful of nodes, then none.
    const settle = ctx().panners
    play(8)
    assert.equal(ctx().panners, settle)
    assert.ok(settle >= pannersAt)
    // The track is the same player all along: asking for it again changes nothing.
    audio.music('overworld')
    play(1)
    assert.equal(ctx().panners, settle)
  })
})

test('the lab seam runs the engine on a context it is given, with no timer of its own', () => {
  let timers = 0
  const realSet = globalThis.setInterval
  globalThis.window = {}
  globalThis.setInterval = () => { timers++; return 1 }
  misuse.length = 0
  try {
    const ctx = new Ctx()
    const audio = A.createZeldaAudioOn(ctx)
    audio.unlock()
    audio.setFlavor('16-bit')
    audio.music('title')
    for (let i = 0; i < 400; i++) { ctx.currentTime += 0.05; audio.tick() }
    audio.setFlavor('8-bit')
    for (let i = 0; i < 100; i++) { ctx.currentTime += 0.05; audio.tick() }
    audio.pause(true)
    audio.dispose()
    assert.equal(timers, 0)
    assert.ok(ctx.panners > 0)
  } finally {
    delete globalThis.window
    globalThis.setInterval = realSet
  }
  assert.deepEqual(misuse, [])
})
