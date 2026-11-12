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
  constructor() { this.currentTime = 0; this.sampleRate = 8000; this.state = 'running'; this.destination = new Node(this); this.panners = 0; this.sources = 0; this.oscs = 0; this.buffers = 0; this.filters = [] }
  createGain() { const n = new Node(this); n.gain = new Param(1); return n }
  createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); this.filters.push(n); return n }
  createStereoPanner() { const n = new Node(this); n.pan = new Param(0); this.panners++; return n }
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
    // A lead's gain is times a note volume of 0.2 or less, so it may be larger than the rest.
    for (const [name, g] of typeof table === 'number' ? [[kind, table]] : Object.entries(table)) assert.ok(g > 0 && g <= (kind === 'lead' ? 4 : 2), `${kind}.${name}: ${g}`)
  }
})

test('every 16-bit instrument has its recordings: the same every time, peak 0.9, a loop that closes on itself', () => {
  const voices = [...Object.keys(A.SPC_GAIN.lead), ...Object.keys(A.SPC_GAIN.bass), ...Object.keys(A.SPC_GAIN.arp), ...Object.keys(A.SPC_GAIN.pad)]
  assert.deepEqual(Object.keys(A.SPC_SAMPLES).sort(), voices.sort())
  for (const [name, spec] of Object.entries(A.SPC_SAMPLES)) {
    for (const root of spec.roots) {
      const a = A.renderSpcSample(name, root)
      assert.deepEqual(Array.from(A.renderSpcSample(name, root).data.subarray(0, 2000)), Array.from(a.data.subarray(0, 2000)), `${name} ${root}`)
      let peak = 0, step = 0
      for (const v of a.data) peak = Math.max(peak, Math.abs(v))
      assert.ok(Math.abs(peak - 0.9) < 0.001, `${name} ${root}: peak ${peak}`)
      assert.equal(a.data.length - a.loop, 1 << spec.size, `${name} ${root}`)
      assert.equal(a.loop, Math.round(spec.attack * A.SPC_RATE / 16) * 16, `${name} ${root}`)
      // Where the loop comes round, the jump is no larger than between two samples inside it.
      for (let i = a.loop + 1; i < a.data.length; i++) step = Math.max(step, Math.abs(a.data[i] - a.data[i - 1]))
      assert.ok(Math.abs(a.data[a.data.length - 1] - a.data[a.loop]) <= step, `${name} ${root}: the loop does not close`)
      // The pitch is the note's, to the loop's grid.
      assert.ok(Math.abs(12 * Math.log2(a.hz / A.hz(root))) < 0.5, `${name} ${root}: ${a.hz} Hz`)
    }
  }
})

test('a recording speaks before it sustains: breath before a flute\'s tone, a harp brightest at the pluck', () => {
  const rms = (x, a, b) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / (b - a)) }
  // How much of a stretch is above the tone: the sample-to-sample difference against the level.
  const bright = (x, a, b) => { let s = 0; for (let i = a + 1; i < b; i++) s += (x[i] - x[i - 1]) ** 2; return Math.sqrt(s / (b - a)) / rms(x, a, b) }
  const ms = t => Math.floor(t * A.SPC_RATE / 1000)
  const flute = A.renderSpcSample('flute')
  assert.ok(rms(flute.data, 0, ms(10)) < rms(flute.data, flute.loop, flute.data.length) * 0.5, 'the flute starts under its tone')
  assert.ok(bright(flute.data, 0, ms(10)) > bright(flute.data, flute.loop, flute.data.length) * 2, 'the flute starts with air')
  for (const name of ['harp', 'keys', 'slap', 'chime', 'glass', 'mallet']) {
    const s = A.renderSpcSample(name)
    assert.ok(bright(s.data, 0, ms(40)) > bright(s.data, s.loop, s.data.length) * 1.3, `${name} is brightest as it is struck`)
  }
  // Bowed and sung instruments are all loop: the bow is the player's envelope.
  assert.equal(A.renderSpcSample('strings').loop, 0)
  assert.equal(A.renderSpcSample('choir').loop, 0)
})

test('the nearest recording plays a note, and nothing any track or jingle plays is bent out of shape', () => {
  const [low, high] = A.SPC_SAMPLES.flute.roots
  assert.equal(A.spcRoot('flute', low - 5), low)
  assert.equal(A.spcRoot('flute', high), high)
  // Between two recordings a note takes the one above sooner than the one below: slower is kinder than faster.
  assert.equal(A.spcRoot('flute', low + 3), low)
  assert.equal(A.spcRoot('flute', (low + high) / 2), high)
  // A pad's chord (G3 to F#4) comes off one recording, so its notes are one section.
  for (const pad of Object.keys(A.SPC_GAIN.pad)) {
    assert.equal(new Set(Array.from({ length: 12 }, (_, i) => A.spcRoot(pad, 55 + i))).size, 1, pad)
  }
  assert.ok(A.SPC_REACH <= 9)
  // validateSpc walks every note of every track and jingle against SPC_REACH.
  assert.deepEqual(A.validateSpc().filter(e => e.includes('no recording')), [])
})

test('the chip\'s codec leaves its grain and takes the top off, and no more than that', () => {
  const db = v => 20 * Math.log10(v)
  const rms = x => Math.sqrt(x.reduce((s, v) => s + v * v, 0) / x.length)
  const blur = x => x.map((v, i) => 0.18 * (x[i - 1] ?? x[0]) + 0.64 * v + 0.18 * (x[i + 1] ?? 0))
  const snr = x => { const want = blur(x); const got = A.spcCodec(x); return db(rms(want)) - db(rms(want.map((v, i) => got[i] - v))) }
  const sine = f => Float32Array.from({ length: 8000 }, (_, i) => 0.8 * Math.sin(2 * Math.PI * f * i / A.SPC_RATE))
  let seed = 7
  const noise = Float32Array.from({ length: 8000 }, () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 - 0.5 })
  // A low tone comes through nearly clean, a bright one grainier, noise grainiest: the codec predicts, and noise cannot be predicted.
  assert.ok(snr(sine(440)) > 45, `440 Hz: ${snr(sine(440))}`)
  assert.ok(snr(sine(4000)) > 25 && snr(sine(4000)) < snr(sine(440)))
  assert.ok(snr(noise) > 15 && snr(noise) < 30, `noise: ${snr(noise)}`)
  // The grain is there: the codec is not a copy.
  const got = A.spcCodec(sine(440))
  assert.ok(blur(sine(440)).some((v, i) => Math.abs(got[i] - v) > 1e-5))
  // The blur: a tone near the top of the chip's range loses several dB, a low one nothing to speak of.
  assert.ok(db(rms(A.spcCodec(sine(12000))) / rms(sine(12000))) < -6)
  assert.ok(Math.abs(db(rms(A.spcCodec(sine(440))) / rms(sine(440)))) < 0.2)
  // The same length out as in, whatever the length, and silence stays silence.
  assert.equal(A.spcCodec(new Float32Array(1000)).length, 1000)
  assert.ok(A.spcCodec(new Float32Array(1000)).every(v => v === 0))
  // Every recording keeps its grain well under its tone.
  for (const name of Object.keys(A.SPC_SAMPLES)) {
    const s = A.renderSpcSample(name)
    const want = s.data.map((v, i) => 0.18 * (s.data[i - 1] ?? s.data[0]) + 0.64 * v + 0.18 * (s.data[i + 1] ?? s.data[s.loop]))
    const c = A.spcCodec(s.data, s.loop)
    assert.ok(db(rms(want)) - db(rms(want.map((v, i) => c[i] - v))) > 28, name)
  }
})

test('the effects kept out of the 16-bit echo are real effects', () => {
  assert.ok(A.SPC_DRY_SFX.length > 0)
  for (const n of A.SPC_DRY_SFX) assert.ok(SFX_NAMES.includes(n), n)
  assert.equal(new Set(A.SPC_DRY_SFX).size, A.SPC_DRY_SFX.length)
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
    // What unlock builds belongs to both chips (the 8-bit delay's filter among it).
    const shared = ctx().filters.length
    for (const id of Object.keys(A.TRACKS)) {
      audio.music(id)
      play(40)
    }
    assert.ok(ctx().panners > 0)
    // The instruments are recordings, not oscillators: what oscillators there are bend them (vibrato, tape wow).
    assert.ok(ctx().sources > ctx().oscs * 2, `${ctx().sources} buffer sources, ${ctx().oscs} oscillators`)
    // No filter on this chip has a peak at its corner (Q is in dB for a lowpass: 0 and under is none).
    // One in the echo's loop would ring louder with every repeat.
    const lows = ctx().filters.slice(shared).filter(f => f.type === 'lowpass' || f.type === 'highpass')
    assert.ok(lows.length > 0)
    for (const f of lows) assert.ok(f.Q.value <= 0, `a ${f.type} at ${f.frequency.value} Hz with a ${f.Q.value} dB peak`)
    for (const n of SFX_NAMES) { audio.sfx(n); audio.sfx(n) }
    for (const j of Object.keys(A.JINGLES)) audio.jingle(j)
    play(4)
    // A track that ends leaves its echo to ring out, and the next one brings its own.
    audio.music(null)
    play(6)
    audio.music('title')
    play(2)
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

test('the 16-bit chip records itself in the background once it is unlocked, one recording at a time', () => {
  const later = []
  const realTimeout = globalThis.setTimeout
  globalThis.setTimeout = fn => { later.push(fn); return 0 }
  try {
    // 8-bit: nothing is recorded, nothing is queued.
    onFake(audio => { audio.unlock(); audio.music('title') })
    assert.equal(later.length, 0)
    onFake((audio, ctx) => {
      audio.setFlavor('16-bit')
      audio.unlock()
      const before = ctx().buffers
      let most = 0
      for (let guard = 0; later.length && guard < 500; guard++) {
        const had = ctx().buffers
        later.shift()()
        most = Math.max(most, ctx().buffers - had)
      }
      const all = Object.values(A.SPC_SAMPLES).reduce((n, spec) => n + spec.roots.length, 0) + Object.keys(A.SPC_GAIN.drums).length
      assert.equal(ctx().buffers - before, all)
      assert.equal(most, 1)
      // Everything is there: a track and its jingles record nothing more.
      const made = ctx().buffers
      for (const id of Object.keys(A.TRACKS)) { audio.music(id); for (let i = 0; i < 400; i++) { ctx().currentTime += 0.05; audio.tick?.() } }
      for (const j of Object.keys(A.JINGLES)) audio.jingle(j)
      assert.equal(ctx().buffers, made)
    })
  } finally {
    globalThis.setTimeout = realTimeout
  }
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
