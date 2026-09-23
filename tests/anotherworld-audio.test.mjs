// Another Shore audio: bundles themes/anotherworld/audio.ts (and the radio it
// imports) with esbuild, then drives it against a small fake Web Audio API.
// The fake is strict where browsers are: non-finite values and exponential
// ramps to zero throw, so a bad recipe fails here instead of in a browser.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'anotherworld')

async function load() {
  const out = esbuild.buildSync({
    stdin: { contents: `export * from './audio'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const { createShoreAudio } = await load()

const EVENTS = [
  { type: 'step' }, { type: 'jump' }, { type: 'land', hard: false }, { type: 'land', hard: true },
  { type: 'kick' }, { type: 'kickHit' }, { type: 'splash' }, { type: 'stroke' }, { type: 'climb' },
  { type: 'tentacles' }, { type: 'leechDrop' }, { type: 'leechDie' },
  ...['fall', 'tide', 'rockfall', 'tentacles', 'leech', 'beast', 'bolt'].map(cause => ({ type: 'death', cause })),
  { type: 'lamp', final: false }, { type: 'lamp', final: true },
  { type: 'shot' }, { type: 'beam' }, { type: 'charge' }, { type: 'chargeFull' },
  { type: 'shield', owner: 'player' }, { type: 'shield', owner: 'guard' }, { type: 'shieldHit' }, { type: 'shieldBreak' },
  { type: 'bolt' }, { type: 'guardAlert' }, { type: 'guardDie' },
  { type: 'beastRoar' }, { type: 'beastPounce' }, { type: 'rockfall' }, { type: 'rockLand' },
  { type: 'door' }, { type: 'lift' }, { type: 'cageCreak' }, { type: 'cageSnap' }, { type: 'cageCrash' },
  { type: 'gun' }, { type: 'thunder' }, { type: 'buddy' },
  ...[1, 2, 3, 4, 5].map(chapter => ({ type: 'chapter', chapter })),
  { type: 'cut', id: 'prologue' },
]
const AMBIENCES = ['sea', 'night', 'hall', 'storm', 'dawn']
const CUES = ['prologue', 'chase', 'capture', 'ending']
const BEATS = ['engine', 'lightning', 'fall', 'splash', 'bubbles', 'wings', 'flash']

// ---- the fake Web Audio API ----

// The module swallows errors from a closed context, so the fake also
// records every error it throws; each test asserts the list stays empty.
const errors = []
function bad(E, msg) { const err = new E(msg); errors.push(err); throw err }
function finite(v, what) {
  if (typeof v !== 'number' || !Number.isFinite(v)) bad(TypeError, `${what}: non-finite ${v}`)
}

class Param {
  constructor(v = 0) { this._v = v }
  get value() { return this._v }
  set value(v) { finite(v, 'value'); this._v = v }
  setValueAtTime(v, t) { finite(v, 'setValueAtTime'); finite(t, 'time'); this._v = v; return this }
  linearRampToValueAtTime(v, t) { finite(v, 'linearRamp'); finite(t, 'time'); this._v = v; return this }
  exponentialRampToValueAtTime(v, t) {
    finite(v, 'expRamp'); finite(t, 'time')
    if (v <= 0) bad(RangeError, 'exponential ramp to ' + v)
    this._v = v
    return this
  }
  setTargetAtTime(v, t, c) { finite(v, 'setTarget'); finite(t, 'time'); finite(c, 'constant'); this._v = v; return this }
  cancelScheduledValues(t) { finite(t, 'cancel'); return this }
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
  start(t = 0) { finite(t, 'start'); if (this.started) bad(Error, 'started twice'); this.started = true }
  stop(t = 0) { finite(t, 'stop'); if (!this.started) bad(Error, 'stop before start') }
}

class Osc extends Source {
  constructor(ctx) { super(ctx); this.type = 'sine'; this.frequency = new Param(440); this.detune = new Param(0) }
  setPeriodicWave() {}
}

class BufSrc extends Source {
  constructor(ctx) { super(ctx); this.buffer = null; this.loop = false; this.playbackRate = new Param(1) }
  start(t = 0, offset = 0) {
    finite(offset, 'offset')
    if (!this.buffer) bad(Error, 'no buffer')
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
    this.nodes = 0
    this.sources = 0
    this.currentTime = 0
    this.sampleRate = 8000
    this.state = 'running'
    this.calls = []
    this.destination = new Node(this)
  }
  createGain() { const n = new Node(this); n.gain = new Param(1); return n }
  createBiquadFilter() { const n = new Node(this); n.type = 'lowpass'; n.frequency = new Param(350); n.Q = new Param(1); return n }
  createDynamicsCompressor() {
    const n = new Node(this)
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0)
    return n
  }
  createConvolver() { const n = new Node(this); n.buffer = null; return n }
  createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n }
  createOscillator() { return new Osc(this) }
  createBufferSource() { return new BufSrc(this) }
  createBuffer(ch, len, rate) { if (len < 1) bad(Error, 'empty buffer'); return new Buf(ch, len, rate) }
  createPeriodicWave() { return {} }
  resume() { this.calls.push('resume'); this.state = 'running'; return Promise.resolve() }
  suspend() { this.calls.push('suspend'); this.state = 'suspended'; return Promise.resolve() }
  close() { this.calls.push('close'); this.state = 'closed'; return Promise.resolve() }
}
FakeContext.made = 0

// Capture the scheduler interval so the test can tick it by hand.
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
function run(ctx, seconds) {
  const end = ctx.currentTime + seconds
  while (ctx.currentTime < end) {
    ctx.currentTime += 0.05
    for (const t of ticks) if (t) t()
  }
}

function everything(a) {
  a.unlock()
  a.setMuted(false)
  for (const e of EVENTS) a.event(e)
  for (const k of AMBIENCES) a.ambience(k)
  a.ambience(null)
  for (const c of CUES) a.cue(c)
  a.cue(null)
  for (const b of BEATS) a.beat(b)
  a.suspend(true)
  a.suspend(false)
  a.setMuted(true)
  a.dispose()
}

// ---- tests ----

test('with no window every method is a silent no-op', () => {
  uninstall()
  const a = createShoreAudio()
  assert.doesNotThrow(() => everything(a))
  assert.equal(FakeContext.made, 0)
})

test('nothing is created before unlock, and unlock makes one context', () => {
  install()
  try {
    const a = createShoreAudio()
    for (const e of EVENTS) a.event(e)
    a.cue('chase')
    for (const b of BEATS) a.beat(b)
    a.suspend(true)
    assert.equal(FakeContext.made, 0)
    a.unlock()
    a.unlock()
    assert.equal(FakeContext.made, 1)
    assert.equal(ticks.filter(Boolean).length, 1)
    a.dispose()
    assert.equal(ticks.filter(Boolean).length, 0)
  } finally { uninstall() }
})

test('every event, ambience, cue and beat runs against a strict fake', () => {
  install()
  try {
    let ctx
    const Orig = FakeContext
    globalThis.window.AudioContext = class extends Orig { constructor() { super(); ctx = this } }
    const a = createShoreAudio()
    a.unlock()
    for (const e of EVENTS) {
      const before = ctx.nodes
      ctx.currentTime += 0.2
      a.event(e)
      if (e.type !== 'cut') assert.ok(ctx.nodes > before, `${e.type} made no sound`)
      else assert.equal(ctx.nodes, before)
    }
    for (const k of AMBIENCES) {
      const before = ctx.sources
      a.ambience(k)
      assert.ok(ctx.sources > before, `${k} started no sources`)
      run(ctx, 25)
    }
    a.ambience(null)
    for (const c of CUES) {
      const before = ctx.nodes
      a.cue(c)
      run(ctx, 40)
      assert.ok(ctx.nodes > before, `${c} played nothing`)
    }
    a.cue(null)
    for (const b of BEATS) {
      const before = ctx.nodes
      a.beat(b)
      assert.ok(ctx.nodes > before, `${b} made no sound`)
    }
    a.dispose()
    assert.ok(ctx.calls.includes('close'))
  } finally { uninstall() }
})

test('lightning cuts the prologue; one-shot cues end on their own', () => {
  install()
  try {
    let ctx
    globalThis.window.AudioContext = class extends FakeContext { constructor() { super(); ctx = this } }
    const a = createShoreAudio()
    a.unlock()
    a.cue('prologue')
    run(ctx, 3)
    a.beat('lightning')
    run(ctx, 1)
    const after = ctx.nodes
    run(ctx, 10)
    assert.equal(ctx.nodes, after, 'prologue kept playing after the lightning')
    a.cue('capture')
    run(ctx, 12)
    const idle = ctx.nodes
    run(ctx, 5)
    assert.equal(ctx.nodes, idle, 'capture never ended')
    a.cue('chase')
    run(ctx, 5)
    const looping = ctx.nodes
    run(ctx, 5)
    assert.ok(ctx.nodes > looping, 'chase stopped looping')
    a.dispose()
  } finally { uninstall() }
})

test('ambience asked for before unlock starts on unlock', () => {
  install()
  try {
    let ctx
    globalThis.window.AudioContext = class extends FakeContext { constructor() { super(); ctx = this } }
    const a = createShoreAudio()
    a.ambience('storm')
    a.unlock()
    assert.ok(ctx.sources > 0)
    a.dispose()
  } finally { uninstall() }
})

test('mute silences one-shots, steps are rate-limited, suspend and dispose behave', () => {
  install()
  try {
    let ctx
    globalThis.window.AudioContext = class extends FakeContext { constructor() { super(); ctx = this } }
    const a = createShoreAudio()
    a.unlock()
    a.setMuted(true)
    let before = ctx.nodes
    a.event({ type: 'shot' })
    assert.equal(ctx.nodes, before)
    a.setMuted(false)
    a.event({ type: 'step' })
    before = ctx.nodes
    a.event({ type: 'step' })
    assert.equal(ctx.nodes, before, 'steps closer than 90 ms both played')
    a.event({ type: 'beam' })
    const afterBeam = ctx.nodes
    a.event({ type: 'beam' })
    assert.equal(ctx.nodes, afterBeam, 'identical one-shot piled up within 30 ms')
    assert.ok(afterBeam > before)
    a.suspend(true)
    a.suspend(false)
    assert.deepEqual(ctx.calls.slice(-2), ['suspend', 'resume'])
    a.dispose()
    before = ctx.nodes
    a.event({ type: 'shot' })
    a.cue('chase')
    a.ambience('sea')
    a.beat('wings')
    assert.equal(ctx.nodes, before)
    a.dispose()
  } finally { uninstall() }
})
