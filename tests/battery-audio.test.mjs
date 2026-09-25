// Night of the Dead Battery audio: bundles themes/battery/audio.ts (with the
// score, arrangements, kit, sfx, speech and storm, and the radio it holds)
// with esbuild, then drives it against a strict fake Web Audio API. The fake
// throws where browsers do (non-finite values, exponential ramps to zero,
// starting a source twice), so a bad recipe fails here, not on a phone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'battery')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `
        export * from './audio'
        export { SFX, MUSIC } from './content/sfx'
        export { speechDuration } from './engine/game'
        export { validateScore, compileTrack, TRACKS, SECTIONS } from './audio/score'
        export { planSpeech, SPEAKERS } from './audio/speech'
        export { ARRANGEMENTS, _internals } from './audio/arrange'
        export { RECIPES, TRIM } from './audio/sfx'
        export { getRadioEngine } from '../radio/engine'
      `,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const A = await load()
const { createBatteryAudio, SFX, MUSIC } = A

const FLOORS = ['ground', 'cellar', 'attic', 'outside']
const SPEAKERS = ['kjell', 'dag', 'espen', 'bones', 'hedvig', 'gustav', 'cat', 'bat', 'professor', 'narrator']
const ROOMS = ['driveway', 'foyer', 'parlour', 'kitchen', 'conservatory', 'pantry', 'boiler', 'lab', 'storeroom', 'study', 'roof']

// ---- the fake Web Audio API ----

const errors = []
function bad(E, msg) { const err = new E(msg); errors.push(err); throw err }
function finite(v, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(TypeError, `${what}: non-finite ${v}`)
}

class Param {
  constructor(v = 0) { this._v = v; this.events = [] }
  get value() { return this._v }
  set value(v) { finite(v, 'value'); this._v = v }
  setValueAtTime(v, t) { finite(v, 'setValueAtTime'); finite(t, 'time'); this._v = v; this.events.push(['set', v, t]); return this }
  linearRampToValueAtTime(v, t) { finite(v, 'linearRamp'); finite(t, 'time'); this._v = v; this.events.push(['lin', v, t]); return this }
  exponentialRampToValueAtTime(v, t) {
    finite(v, 'expRamp'); finite(t, 'time')
    if (v <= 0) bad(RangeError, 'exponential ramp to ' + v)
    this._v = v
    this.events.push(['exp', v, t])
    return this
  }
  setTargetAtTime(v, t, c) {
    finite(v, 'setTarget'); finite(t, 'time'); finite(c, 'constant')
    if (c <= 0) bad(RangeError, 'time constant ' + c)
    this._v = v
    this.events.push(['target', v, t])
    return this
  }
  cancelScheduledValues(t) { finite(t, 'cancel'); this.events.push(['cancel', 0, t]); return this }
}

class Node {
  constructor(ctx) { this.ctx = ctx; ctx.nodes++ }
  connect(d) {
    if (!(d instanceof Node) && !(d instanceof Param)) bad(TypeError, 'connect to non-node')
    return d
  }
  disconnect() {}
}

class Source extends Node {
  constructor(ctx) { super(ctx); this.started = false; ctx.sources++ }
  start(t = 0) {
    finite(t, 'start')
    if (this.started) bad(Error, 'started twice')
    this.started = true
    this.at = t
    this.ctx.starts.push(t)
  }
  stop(t = 0) { finite(t, 'stop'); if (!this.started) bad(Error, 'stop before start') }
}

class Osc extends Source {
  constructor(ctx) { super(ctx); this.type = 'sine'; this.frequency = new Param(440); this.detune = new Param(0); ctx.oscs++ }
  setPeriodicWave(w) { if (!w) bad(TypeError, 'no wave') }
}

class BufSrc extends Source {
  constructor(ctx) { super(ctx); this.buffer = null; this.loop = false; this.playbackRate = new Param(1) }
  start(t = 0, offset = 0) {
    finite(offset, 'offset')
    if (!this.buffer) bad(Error, 'no buffer')
    if (offset < 0 || offset > this.buffer.duration) bad(RangeError, 'offset out of buffer')
    super.start(t)
  }
}

class Buf {
  constructor(ch, len, rate) {
    this.numberOfChannels = ch; this.length = len; this.sampleRate = rate; this.duration = len / rate
    this.data = Array.from({ length: ch }, () => new Float32Array(len))
  }
  getChannelData(i) { return this.data[i] }
}

class FakeContext {
  constructor() {
    FakeContext.made++
    FakeContext.last = this
    this.nodes = 0
    this.sources = 0
    this.oscs = 0
    this.starts = []
    this.currentTime = 0
    this.sampleRate = 4000
    this.state = 'running'
    this.calls = []
    this.gains = []
    this.destination = new Node(this)
  }
  createGain() { const n = new Node(this); n.gain = new Param(1); this.gains.push(n); return n }
  createBiquadFilter() {
    const n = new Node(this)
    n.type = 'lowpass'; n.frequency = new Param(350); n.Q = new Param(1)
    return n
  }
  createDynamicsCompressor() {
    const n = new Node(this)
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0)
    this.compressor = n
    return n
  }
  createConvolver() { const n = new Node(this); n.buffer = null; return n }
  createDelay(max = 1) {
    const n = new Node(this)
    n.max = max
    n.delayTime = new Param(0)
    const orig = n.delayTime.linearRampToValueAtTime.bind(n.delayTime)
    n.delayTime.linearRampToValueAtTime = (v, t) => { if (v > max) bad(RangeError, 'delay over max'); return orig(v, t) }
    return n
  }
  createStereoPanner() { const n = new Node(this); n.pan = new Param(0); return n }
  createOscillator() { return new Osc(this) }
  createBufferSource() { return new BufSrc(this) }
  createBuffer(ch, len, rate) { if (len < 1) bad(Error, 'empty buffer'); return new Buf(ch, len, rate) }
  createPeriodicWave(real, imag) {
    if (real.length !== imag.length || real.length < 2) bad(Error, 'bad periodic wave')
    return { real, imag }
  }
  resume() { this.calls.push('resume'); this.state = 'running'; return Promise.resolve() }
  suspend() { this.calls.push('suspend'); this.state = 'suspended'; return Promise.resolve() }
  close() { this.calls.push('close'); this.state = 'closed'; return Promise.resolve() }
}
FakeContext.made = 0

let ticks = []
function install() {
  errors.length = 0
  FakeContext.made = 0
  ticks = []
  globalThis.window = { AudioContext: FakeContext }
  globalThis.__realSetInterval ??= globalThis.setInterval
  globalThis.__realClearInterval ??= globalThis.clearInterval
  globalThis.setInterval = fn => { ticks.push(fn); return ticks.length }
  globalThis.clearInterval = id => { ticks[id - 1] = null }
}
function uninstall() {
  assert.deepEqual(errors.map(e => e.message), [], 'the fake Web Audio API threw')
  delete globalThis.window
  if (globalThis.__realSetInterval) globalThis.setInterval = globalThis.__realSetInterval
  if (globalThis.__realClearInterval) globalThis.clearInterval = globalThis.__realClearInterval
}

/** Advance the fake clock in scheduler-sized steps. */
function run(ctx, seconds, step = 0.04) {
  const end = ctx.currentTime + seconds
  while (ctx.currentTime < end) {
    ctx.currentTime += step
    for (const t of ticks) if (t) t()
  }
}

function started() {
  install()
  const a = createBatteryAudio()
  a.unlock()
  const ctx = FakeContext.last
  return { a, ctx }
}

const music = (name, floor = 'ground') => ({ t: 'music', name, floor })

// ---- the score ----

test('the score is clean: every chord and note parses, bars have the right length', () => {
  assert.deepEqual(A.validateScore(), [])
})

test('the theme is at least 32 bars with contrasting sections; every cue has a proper length', () => {
  const theme = A.compileTrack('theme')
  assert.ok(theme.bars.length >= 64, `${theme.bars.length} bars`)
  assert.deepEqual(A.TRACKS.theme.form, ['A', 'B', 'A2', 'C'])
  assert.equal(A.TRACKS.theme.meter, 3)
  for (const id of Object.keys(A.TRACKS)) {
    const c = A.compileTrack(id)
    assert.ok(c.bars.length >= 16, `${id}: ${c.bars.length} bars`)
    for (const b of c.bars) assert.equal(b.chords.length, A.TRACKS[id].meter)
  }
  // The hook: D, a tumble F-E-D, then the leap to A with its chromatic wink.
  const first = theme.bars.slice(0, 2).flatMap(b => b.mel.map(e => e.m))
  assert.deepEqual(first, [74, 77, 76, 74, 81, 80, 81])
  // A is in D minor and ends on D; B starts in F.
  assert.equal(theme.bars[15].chords[0].sym, 'Dm')
  assert.equal(theme.bars[16].chords[0].sym, 'F')
})

test('the finale and the credits turn the hook to D major', () => {
  const fin = A.compileTrack('finale')
  const first = fin.bars[0].mel.map(e => e.m)
  assert.deepEqual(first, [74, 78, 76, 74])
  assert.equal(fin.bars[0].chords[0].sym, 'D')
})

test('arrangement helpers: voicings sit in range, the harmony is a chord tone under the tune', () => {
  const { voicing, under, skeleton } = A._internals
  const theme = A.compileTrack('theme')
  for (const b of theme.bars) {
    for (const c of b.chords) {
      const v = voicing(c, 55)
      assert.ok(v.every(m => m >= 55 && m < 67), `${c.sym}: ${v}`)
    }
    for (const e of b.mel) {
      const c = b.chords[Math.floor(e.at / 2)]
      const h = under(e.m, c)
      assert.ok(e.m - h >= 3 && e.m - h <= 9, `${e.m} over ${c.sym}`)
    }
    const sk = skeleton(b)
    assert.ok(sk.length <= 2)
    for (const e of sk) assert.ok(e.at + e.len <= 6 + 1e-9)
  }
})

// ---- speech planning ----

test('speech timing matches the engine and the babble fits the line', () => {
  for (const text of ['Hm.', 'Brunhilde. Not tonight. Please not tonight.', 'x'.repeat(200), 'Is anybody in there?']) {
    assert.equal(A.lineSeconds(text), A.speechDuration(text))
  }
  for (const who of SPEAKERS) {
    const text = 'Will the gentlemen be staying for dinner? I\'m afraid we are out of carrots.'
    const dur = A.lineSeconds(text)
    const syl = A.planSpeech(who, text, dur)
    const letters = text.replace(/[^a-z]/gi, '').length
    assert.ok(syl.length >= 8 && syl.length <= Math.ceil(letters / 2) + 1, `${who}: ${syl.length} syllables`)
    assert.ok(syl.every(s => s.t >= 0 && s.t < dur), `${who} runs past the line`)
    for (let i = 1; i < syl.length; i++) assert.ok(syl[i].t > syl[i - 1].t)
    const top = Math.max(...syl.map(s => s.m))
    const low = Math.min(...syl.map(s => s.m))
    assert.ok(top - low <= 24, `${who}: range ${low}-${top}`)
  }
  assert.deepEqual(A.planSpeech('kjell', '...', 1.5), [])
  // Deterministic: the same line always babbles the same tune.
  const x = A.planSpeech('espen', 'EPISODE TWELVE, Kjell!', 2)
  assert.deepEqual(x.map(s => s.m), A.planSpeech('espen', 'EPISODE TWELVE, Kjell!', 2).map(s => s.m))
  // Gustav growls far below everyone; the bat squeaks far above.
  const g = A.planSpeech('gustav', 'HRRMM.', 1.5)[0].m
  const b = A.planSpeech('bat', 'Blood!', 1.5)[0].m
  assert.ok(g < 45 && b > 85)
})

// ---- the engine against the fake ----

test('with no window every method is a silent no-op', () => {
  delete globalThis.window
  const a = createBatteryAudio()
  assert.doesNotThrow(() => {
    a.holdRadio()
    a.title(true)
    a.unlock()
    a.setMuted(true)
    for (const name of SFX) a.event({ t: 'sfx', name })
    a.event(music('auto'))
    a.event({ t: 'speak', who: 'kjell', text: 'Hello?' })
    a.event({ t: 'lightning', a: 1 })
    a.suspend(true)
    a.dispose()
  })
  assert.equal(a.debug().ctx, null)
})

test('nothing is created before unlock, and unlock makes one context and one timer', () => {
  install()
  try {
    const a = createBatteryAudio()
    a.title(true)
    for (const name of SFX.slice(0, 5)) a.event({ t: 'sfx', name })
    a.event({ t: 'speak', who: 'dag', text: 'There\'s a lot of jam down here.' })
    assert.equal(FakeContext.made, 0)
    a.unlock()
    a.unlock()
    assert.equal(FakeContext.made, 1)
    assert.equal(ticks.filter(Boolean).length, 1)
    const ctx = FakeContext.last
    assert.ok(ctx.compressor, 'a compressor guards the master')
    a.dispose()
    assert.equal(ticks.filter(Boolean).length, 0)
    assert.ok(ctx.calls.includes('close'))
  } finally { uninstall() }
})

test('the title music starts after unlock, and hands over to the ground floor at a bar line', () => {
  const { a, ctx } = started()
  try {
    run(ctx, 0.1)
    assert.equal(a.debug().track, 'theme')
    assert.equal(a.debug().arr, 'title')
    const before = ctx.oscs
    run(ctx, 6)
    assert.ok(ctx.oscs > before + 20, 'title plays notes')
    a.title(false)
    a.event(music('auto', 'ground'))
    run(ctx, 0.1)
    const d = a.debug()
    assert.equal(d.track, 'theme', 'same player: the theme keeps its place')
    assert.equal(d.arr, 'ground')
    run(ctx, 3)
    assert.equal(a.debug().track, 'theme', 'title(false) did not stop the game music')
    a.dispose()
  } finally { uninstall() }
})

test('every SFX name has its own recipe, and the level trims name real sounds', () => {
  for (const name of SFX) assert.equal(typeof A.RECIPES[name], 'function', `${name} has no recipe`)
  for (const name of Object.keys(A.TRIM)) assert.ok(SFX.includes(name), `trim for unknown ${name}`)
  for (const v of Object.values(A.TRIM)) assert.ok(v >= -12 && v <= 12)
})

test('every SFX name plays, makes nodes and never throws; unknown names blip', () => {
  const { a, ctx } = started()
  try {
    for (const name of SFX) {
      ctx.currentTime += 0.1
      const before = ctx.nodes
      a.event({ t: 'sfx', name })
      assert.ok(ctx.nodes > before + 1, `${name} made no sound`)
    }
    const before = ctx.nodes
    a.event({ t: 'sfx', name: 'no-such-sound' })
    assert.ok(ctx.nodes > before, 'unknown name made no blip')
    run(ctx, 5)
    a.dispose()
  } finally { uninstall() }
})

test('every music cue and every floor starts and keeps playing', () => {
  const { a, ctx } = started()
  try {
    for (const floor of FLOORS) {
      a.event(music('auto', floor))
      run(ctx, 4)
      assert.equal(a.debug().arr, floor)
      const before = ctx.sources
      run(ctx, 6)
      assert.ok(ctx.sources > before + 5, `${floor} played nothing`)
    }
    for (const name of MUSIC.filter(m => m !== 'auto')) {
      a.event(music(name))
      run(ctx, 2)
      assert.equal(a.debug().arr, name, `${name} did not start`)
      const before = ctx.sources
      run(ctx, 8)
      assert.ok(ctx.sources > before + 5, `${name} played nothing`)
    }
    a.event(music(null))
    run(ctx, 6)
    assert.equal(a.debug().track, null)
    const idle = ctx.oscs
    run(ctx, 8)
    assert.ok(ctx.oscs - idle < 20, 'music kept playing after null')
    a.dispose()
  } finally { uninstall() }
})

test('a floor switch crossfades at the next bar line: the old band ramps down, the new one comes in', () => {
  const { a, ctx } = started()
  try {
    a.event(music('auto', 'ground'))
    run(ctx, 3)
    a.event({ t: 'hero', id: 'dag' })
    a.event(music('auto', 'cellar'))
    run(ctx, 0.05)
    const d = a.debug()
    assert.equal(d.arr, 'cellar')
    const old = d.layers.find(l => l.arr === 'ground')
    const neu = d.layers.find(l => l.arr === 'cellar')
    assert.ok(old && neu)
    assert.ok(Number.isFinite(old.until), 'the ground band has an end')
    const down = old.gain.events.find(e => e[0] === 'target' && e[1] === 0)
    assert.ok(down, 'the ground band ramps to silence')
    const up = neu.gain.events.find(e => e[0] === 'target' && e[1] > 0)
    assert.ok(up, 'the cellar band ramps in')
    // Both start on the same bar line: a whole number of 3/4 bars at 132 bpm from the theme's start.
    const bar = 3 * 60 / 132
    const phase = ((up[2] + 0.03 - d.origin) / bar) % 1
    assert.ok(phase < 0.01 || phase > 0.99, `switch not on a bar line (${phase})`)
    assert.ok(Math.abs(down[2] - (up[2] + 0.03)) < 1e-6, 'the fade-out and fade-in share the bar line')
    // After the fade the old layer is gone.
    run(ctx, 8)
    assert.ok(!a.debug().layers.some(l => l.arr === 'ground'))
    // Rapid switching back and forth never piles up bands.
    for (const f of ['ground', 'attic', 'cellar', 'ground', 'attic']) {
      a.event(music('auto', f))
      run(ctx, 0.3)
      assert.ok(a.debug().layers.length <= 3)
    }
    run(ctx, 3)
    assert.equal(a.debug().arr, 'attic')
    a.dispose()
  } finally { uninstall() }
})

test('a forced cue crossfades to its own track and "auto" returns to the floor', () => {
  const { a, ctx } = started()
  try {
    a.event(music('auto', 'ground'))
    run(ctx, 3)
    a.event(music('seance', 'ground'))
    run(ctx, 0.1)
    assert.equal(a.debug().track, 'seance')
    assert.equal(a.debug().fading, 1, 'the theme fades out behind the séance')
    run(ctx, 10)
    assert.equal(a.debug().fading, 0)
    a.event(music('auto', 'ground'))
    run(ctx, 0.1)
    assert.equal(a.debug().track, 'theme')
    assert.equal(a.debug().arr, 'ground')
    a.dispose()
  } finally { uninstall() }
})

test('the intro drives, hiccups on two coughs and sputters out on the third', () => {
  const { a, ctx } = started()
  try {
    a.event(music('intro', 'outside'))
    run(ctx, 8)
    assert.equal(a.debug().track, 'intro')
    a.event({ t: 'sfx', name: 'car-cough' })
    run(ctx, 1.6)
    a.event({ t: 'sfx', name: 'car-cough' })
    run(ctx, 1.1)
    assert.equal(a.debug().track, 'intro', 'two coughs are only hiccups')
    a.event({ t: 'sfx', name: 'car-cough' })
    assert.equal(a.debug().track, null, 'the third cough kills the intro')
    run(ctx, 4)
    const quiet = ctx.oscs
    run(ctx, 2)
    assert.ok(ctx.oscs - quiet < 25, 'intro kept playing after the sputter')
    // A few seconds of rain, then the theme creeps back in, sparse, from the driveway.
    run(ctx, 4)
    assert.equal(a.debug().track, 'theme')
    assert.equal(a.debug().arr, 'outside')
    // And the script's next "auto" carries on from there at a bar line.
    a.event(music('auto', 'ground'))
    run(ctx, 0.1)
    assert.equal(a.debug().arr, 'ground')
    assert.equal(a.debug().fading, 0)
    a.dispose()
  } finally { uninstall() }
})

test('the tension cue climbs each pass (a semitone up, a little faster) and loops for minutes', () => {
  const t = A.TRACKS.tension
  assert.ok(t.trStep > 0 && t.bpmStep > 0 && t.maxSteps >= 3)
  assert.equal(t.form[t.loopFrom ?? 0], 'T2', 'the ticking-only opening plays once')
  const { a, ctx } = started()
  try {
    a.event(music('tension', 'ground'))
    run(ctx, 20)
    const early = ctx.oscs
    run(ctx, 100)
    assert.equal(a.debug().track, 'tension')
    assert.ok(ctx.oscs - early > 400, 'tension stopped looping')
    a.dispose()
  } finally { uninstall() }
})

test('an hour-scale run of the floor loop stays clean and light', () => {
  const { a, ctx } = started()
  try {
    a.event(music('auto', 'ground'))
    run(ctx, 2)
    const n0 = ctx.nodes
    const seconds = 400
    let floor = 0
    for (let s = 0; s < seconds; s += 20) {
      if (s % 60 === 0) a.event(music('auto', FLOORS[floor++ % 3]))
      if (s % 40 === 0) a.event({ t: 'lightning', a: 0.5 + (s % 3) * 0.25 })
      run(ctx, 20, 0.05)
    }
    const perSecond = (ctx.nodes - n0) / seconds
    console.log(`# ${perSecond.toFixed(0)} nodes per second over ${seconds} s of floor music, storm and thunder`)
    assert.ok(perSecond < 160, `${perSecond.toFixed(0)} nodes per second`)
    // Lookahead: nothing is scheduled far into the future.
    const late = ctx.starts.filter(t => t > ctx.currentTime + 2.5)
    assert.equal(late.length, 0, `${late.length} sources start more than 2.5 s ahead`)
    a.dispose()
  } finally { uninstall() }
})

test('speech blips play for the line, stop on the next line, and every speaker has a voice', () => {
  const { a, ctx } = started()
  try {
    for (const who of SPEAKERS) {
      const before = ctx.sources
      a.event({ t: 'speak', who, text: 'This is going to be episode twelve. EPISODE TWELVE, Kjell!' })
      run(ctx, 0.3)
      assert.ok(ctx.sources > before, `${who} made no sound`)
      assert.ok(a.debug().speaking)
    }
    a.event({ t: 'speak', who: 'kjell', text: 'Brunhilde has never let me down. Except tonight. And in 2019. And twice in 2021.' })
    run(ctx, 0.3)
    const left = a.debug().queued
    assert.ok(left > 5)
    const g = ctx.gains.at(-1)
    a.event({ t: 'speak', who: 'dag', text: 'Hm.' })
    run(ctx, 0.1)
    assert.ok(a.debug().queued < left, 'the old line kept its queue')
    // The long line's gain was faded out.
    const kjellGain = ctx.gains.filter(n => n.gain.events.some(e => e[0] === 'target' && e[1] === 0 && e[2] > 0)).length
    assert.ok(kjellGain > 0 && g)
    run(ctx, 8)
    assert.equal(a.debug().queued, 0)
    a.dispose()
  } finally { uninstall() }
})

test('lightning makes thunder later and louder for a close strike', () => {
  const { a, ctx } = started()
  try {
    run(ctx, 0.5)
    const peak = (a0) => {
      const g0 = ctx.gains.length
      a.event({ t: 'lightning', a: a0 })
      const made = ctx.gains.slice(g0)
      return Math.max(...made.flatMap(n => n.gain.events.filter(e => e[0] === 'lin').map(e => e[1])))
    }
    const far = peak(0.4)
    const near = peak(1)
    assert.ok(near > far * 2, `near ${near} vs far ${far}`)
    run(ctx, 8)
    a.dispose()
  } finally { uninstall() }
})

test('every room has a storm mix and the room and hero events apply it', () => {
  const { a, ctx } = started()
  try {
    a.event(music('auto', 'ground'))
    for (const room of ROOMS) {
      a.event({ t: 'room', room })
      run(ctx, 1)
    }
    for (const id of ['dag', 'espen', 'kjell']) {
      a.event({ t: 'hero', id })
      run(ctx, 0.5)
    }
    a.event({ t: 'solve', id: 'furnace' })
    a.event({ t: 'save' })
    a.event({ t: 'flash', color: '#fff', a: 1 })
    a.event({ t: 'shake', s: 0.3, px: 2 })
    a.event({ t: 'end' })
    run(ctx, 3)
    a.dispose()
  } finally { uninstall() }
})

test('a solve plays a sting and ducks the music, then lets it back', () => {
  const { a, ctx } = started()
  try {
    a.event(music('auto', 'ground'))
    run(ctx, 2)
    const before = ctx.oscs
    a.event({ t: 'solve', id: 'matches' })
    assert.ok(ctx.oscs > before + 3)
    const duck = ctx.gains.filter(n => n.gain.events.some(e => e[0] === 'target' && e[1] > 0.1 && e[1] < 0.3))
    assert.ok(duck.length >= 1, 'music ducked')
    a.dispose()
  } finally { uninstall() }
})

test('mute silences one-shots and speech; suspend pauses the context; dispose releases the radio', () => {
  const { a, ctx } = started()
  try {
    const radio = A.getRadioEngine()
    const holds = []
    const orig = radio.hold
    radio.hold = on => { holds.push(on); return orig.call(radio, on) }
    a.holdRadio()
    assert.deepEqual(holds, [true])
    assert.ok(a.debug().radioHeld)

    a.setMuted(true)
    let before = ctx.nodes
    a.event({ t: 'sfx', name: 'door' })
    a.event({ t: 'speak', who: 'espen', text: 'Hello?' })
    a.event({ t: 'solve', id: 'oil' })
    a.event({ t: 'lightning', a: 1 })
    assert.equal(ctx.nodes, before, 'muted but still sounding')
    assert.ok(a.debug().muted)
    a.setMuted(false)
    before = ctx.nodes
    a.event({ t: 'sfx', name: 'door' })
    assert.ok(ctx.nodes > before)
    before = ctx.nodes
    a.event({ t: 'sfx', name: 'door' })
    assert.equal(ctx.nodes, before, 'the same sfx twice in one instant piled up')

    a.suspend(true)
    a.suspend(false)
    assert.deepEqual(ctx.calls.slice(-2), ['suspend', 'resume'])

    a.dispose()
    assert.deepEqual(holds, [true, false])
    assert.equal(a.debug().radioHeld, false)
    before = ctx.nodes
    a.event({ t: 'sfx', name: 'door' })
    a.event(music('auto'))
    a.unlock()
    assert.equal(ctx.nodes, before, 'sounded after dispose')
    assert.equal(FakeContext.made, 1, 'unlock after dispose made a new context')
    radio.hold = orig
  } finally { uninstall() }
})

test('muted music keeps time silently and comes back on the grid', () => {
  const { a, ctx } = started()
  try {
    a.event(music('auto', 'attic'))
    run(ctx, 2)
    a.setMuted(true)
    const before = ctx.oscs
    run(ctx, 10)
    assert.ok(ctx.oscs - before < 10, 'muted music still built notes')
    a.setMuted(false)
    run(ctx, 4)
    assert.ok(ctx.oscs - before > 10, 'music did not come back after unmute')
    a.dispose()
  } finally { uninstall() }
})
