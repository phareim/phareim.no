// Mini World audio: bundles themes/miniworld/audio.ts (and its score) with
// esbuild, then drives it against a strict fake Web Audio API that throws
// where browsers do (non-finite values, exponential ramps to zero, starting
// a source twice), so a bad recipe fails here, not on a phone.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'miniworld')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `
        export * from './audio'
        export * from './audioScore'
        export { getRadioEngine } from '../radio/engine'
      `,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

const A = await load()
const { createMiniAudio, TRACKS, SECTIONS, compileBar, validateScore } = A

const MUSIC = ['town', 'house', 'obby', 'stars', 'fashion', 'memory', 'shop', 'castle']
const SFX = [
  'jump', 'land', 'bounce', 'splash', 'respawn', 'checkpoint', 'finish',
  'star', 'coin', 'pop', 'magic', 'door', 'sit',
  'click', 'open', 'close', 'buy', 'poor', 'equip', 'dress',
  'place', 'pick', 'rotate', 'store', 'upgrade',
  'flip', 'match', 'win', 'fanfare', 'gift', 'crown', 'judge',
]
const MAGIC = ['bubbles', 'stars', 'hearts', 'confetti', 'rainbow', 'snow', 'lightning', 'flowers', 'dragon']

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
    this.ctx.starts.push(t)
  }
  stop(t = 0) { finite(t, 'stop'); if (!this.started) bad(Error, 'stop before start') }
}

class Osc extends Source {
  constructor(ctx) { super(ctx); this.type = 'sine'; this.frequency = new Param(440); this.detune = new Param(0); ctx.oscs++ }
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
    FakeContext.last = this
    this.nodes = 0
    this.sources = 0
    this.oscs = 0
    this.starts = []
    this.currentTime = 0
    this.sampleRate = 4000
    this.state = 'suspended'
    this.calls = []
    this.gains = []
    this.destination = new Node(this)
  }
  createGain() { const n = new Node(this); n.gain = new Param(1); this.gains.push(n); return n }
  createBiquadFilter() { const n = new Node(this); n.type = 'lowpass'; n.frequency = new Param(350); n.Q = new Param(1); return n }
  createDynamicsCompressor() {
    const n = new Node(this)
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0)
    this.compressor = n
    return n
  }
  createConvolver() { const n = new Node(this); n.buffer = null; return n }
  createOscillator() { return new Osc(this) }
  createBufferSource() { return new BufSrc(this) }
  createBuffer(ch, len, rate) { if (len < 1) bad(Error, 'empty buffer'); return new Buf(ch, len, rate) }
  resume() { this.calls.push('resume'); this.state = 'running'; return Promise.resolve() }
  suspend() { this.calls.push('suspend'); this.state = 'suspended'; return Promise.resolve() }
  close() { this.calls.push('close'); this.state = 'closed'; return Promise.resolve() }
}
FakeContext.made = 0

let ticks = []
let store = {}
let docListeners = {}
const doc = {
  hidden: false,
  addEventListener(ev, fn) { (docListeners[ev] ??= []).push(fn) },
  removeEventListener(ev, fn) { docListeners[ev] = (docListeners[ev] ?? []).filter(f => f !== fn) },
}
function setHidden(h) { doc.hidden = h; for (const fn of docListeners.visibilitychange ?? []) fn() }

function install({ keepStore = false } = {}) {
  errors.length = 0
  FakeContext.made = 0
  ticks = []
  docListeners = {}
  doc.hidden = false
  if (!keepStore) store = {}
  globalThis.window = { AudioContext: FakeContext }
  globalThis.document = doc
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v) },
    removeItem: k => { delete store[k] },
  }
  globalThis.__realSetInterval ??= globalThis.setInterval
  globalThis.__realClearInterval ??= globalThis.clearInterval
  globalThis.setInterval = fn => { ticks.push(fn); return ticks.length }
  globalThis.clearInterval = id => { ticks[id - 1] = null }
}
function uninstall() {
  assert.deepEqual(errors.map(e => e.message), [], 'the fake Web Audio API threw')
  delete globalThis.window
  delete globalThis.document
  delete globalThis.localStorage
  globalThis.setInterval = globalThis.__realSetInterval
  globalThis.clearInterval = globalThis.__realClearInterval
}

function run(ctx, seconds, step = 0.04) {
  const end = ctx.currentTime + seconds
  while (ctx.currentTime < end) {
    ctx.currentTime += step
    for (const t of ticks) if (t) t()
  }
}

function started(opts) {
  install(opts)
  const a = createMiniAudio()
  a.unlock()
  return { a, ctx: FakeContext.last }
}

// ---- the score ----

test('the score is clean: every chord and note parses, every bar has eight steps', () => {
  assert.deepEqual(validateScore(), [])
})

test('every track has several sections, and the town loops through at least four', () => {
  for (const id of MUSIC) {
    const t = TRACKS[id]
    assert.ok(new Set(t.form).size >= 3, `${id}: ${t.form.join(' ')}`)
    assert.ok(t.form.some(s => SECTIONS[s].mel === null), `${id} never lets the tune rest`)
  }
  assert.ok(new Set(TRACKS.town.form).size >= 4)
  assert.ok(TRACKS.town.bpm >= 90 && TRACKS.town.bpm <= 110)
  assert.ok(TRACKS.town.leads.length >= 2, 'the town tune changes voice each pass')
})

test('every note of every bar of every track sits in a friendly range', () => {
  const DRUMS = new Set(['kick', 'snare', 'clap', 'hat', 'shaker', 'tick', 'tom'])
  for (const id of MUSIC) {
    const t = TRACKS[id]
    for (let pass = 0; pass < 3; pass++) {
      for (const s of t.form) {
        for (let bar = 0; bar < 8; bar++) {
          const evs = compileBar(id, s, bar, pass)
          assert.ok(evs.length > 0, `${id} ${s} bar ${bar} is empty`)
          for (const e of evs) {
            assert.ok(e.step >= 0 && e.step < 8, `${id} ${s}: step ${e.step}`)
            assert.ok(e.len > 0 && e.vel > 0 && e.vel <= 1)
            if (DRUMS.has(e.voice)) continue
            const [lo, hi] = e.voice === 'bass' ? [36, 55] : [50, 100]
            assert.ok(e.midi >= lo && e.midi <= hi, `${id} ${s} bar ${bar}: ${e.voice} ${e.midi}`)
          }
        }
      }
    }
  }
})

// ---- the engine against the fake ----

test('with no window every method is a silent no-op', () => {
  delete globalThis.window
  const a = createMiniAudio()
  assert.doesNotThrow(() => {
    a.setMusic('town')
    a.unlock()
    for (const n of SFX) a.sfx(n)
    a.setMuted(true)
    a.dispose()
  })
  assert.equal(a.debug().ctx, null)
})

test('silent before unlock; unlock makes one context, one timer, a silent buffer, and starts the wanted track', () => {
  install()
  try {
    const a = createMiniAudio()
    a.setMusic('town')
    for (const n of SFX) a.sfx(n)
    assert.equal(FakeContext.made, 0)
    a.unlock()
    a.unlock()
    assert.equal(FakeContext.made, 1)
    const ctx = FakeContext.last
    assert.equal(ticks.filter(Boolean).length, 1)
    assert.ok(ctx.calls.includes('resume'), 'unlock resumes the context')
    assert.ok(ctx.sources >= 1, 'a silent buffer opens the iOS audio path')
    assert.equal(a.debug().track, 'town')
    assert.ok(a.debug().radioHeld, 'the site radio is held silent')
    a.dispose()
  } finally { uninstall() }
})

test('every track plays notes and keeps playing across its form', () => {
  const { a, ctx } = started()
  try {
    for (const id of MUSIC) {
      a.setMusic(id)
      run(ctx, 2)
      assert.equal(a.debug().track, id)
      const before = ctx.oscs
      run(ctx, 30)
      assert.ok(ctx.oscs > before + 40, `${id} played ${ctx.oscs - before} oscillators in 30 s`)
    }
    a.setMusic('off')
    run(ctx, 3)
    assert.equal(a.debug().track, null)
    assert.equal(a.debug().fading, 0)
    const idle = ctx.oscs
    run(ctx, 5)
    assert.equal(ctx.oscs, idle, 'music kept playing after off')
    a.dispose()
  } finally { uninstall() }
})

test('setMusic crossfades: the old track ramps down while the new one ramps in; the same track is a no-op', () => {
  const { a, ctx } = started()
  try {
    a.setMusic('town')
    run(ctx, 3)
    const g0 = ctx.gains.length
    a.setMusic('town')
    assert.equal(ctx.gains.length, g0, 'the same track restarted')
    a.setMusic('house')
    assert.equal(a.debug().track, 'house')
    assert.equal(a.debug().fading, 1)
    const outs = ctx.gains.filter(g => g.gain.events.some(e => e[0] === 'target'))
    assert.ok(outs.some(g => g.gain.events.at(-1)[0] === 'target' && g.gain.events.at(-1)[1] === 0), 'the town ramps to silence')
    const newOut = ctx.gains[g0]
    assert.ok(newOut.gain.events.some(e => e[0] === 'target' && e[1] > 0), 'the house ramps in')
    const before = ctx.oscs
    run(ctx, 0.8)
    assert.equal(a.debug().fading, 1, 'the old track still plays under the fade')
    assert.ok(ctx.oscs > before)
    run(ctx, 2)
    assert.equal(a.debug().fading, 0, 'the old track is dropped after the fade')
    // Rapid switching never piles up tracks.
    for (const id of ['obby', 'stars', 'fashion', 'memory', 'shop', 'castle', 'town']) { a.setMusic(id); run(ctx, 0.1) }
    assert.ok(a.debug().fading <= 2)
    a.dispose()
  } finally { uninstall() }
})

test('the scheduler looks ahead a little, never far', () => {
  const { a, ctx } = started()
  try {
    a.setMusic('obby')
    run(ctx, 60)
    const late = ctx.starts.filter(t => t > ctx.currentTime + 1)
    assert.equal(late.length, 0)
    const n0 = ctx.nodes
    run(ctx, 60)
    const perSecond = (ctx.nodes - n0) / 60
    assert.ok(perSecond < 200, `${perSecond.toFixed(0)} nodes per second`)
    a.dispose()
  } finally { uninstall() }
})

test('every sfx plays and never throws; magic has a sound for every magic', () => {
  const { a, ctx } = started()
  try {
    for (const n of SFX) {
      ctx.currentTime += 0.1
      const before = ctx.nodes
      a.sfx(n)
      assert.ok(ctx.nodes > before + 1, `${n} made no sound`)
    }
    const seen = new Set()
    for (const m of MAGIC) {
      ctx.currentTime += 0.1
      const before = ctx.oscs + ctx.sources
      const n0 = ctx.nodes
      a.sfx('magic', { magic: m })
      assert.ok(ctx.nodes > n0 + 1, `${m} made no sound`)
      seen.add(`${ctx.oscs + ctx.sources - before}:${ctx.nodes - n0}`)
    }
    assert.ok(seen.size >= 5, 'the magics sound alike')
    // The same sound twice in one instant does not pile up.
    ctx.currentTime += 0.1
    a.sfx('coin')
    const n = ctx.nodes
    a.sfx('coin')
    assert.equal(ctx.nodes, n)
    run(ctx, 2)
    a.dispose()
  } finally { uninstall() }
})

test('mute persists, silences, and is read back by the next audio', () => {
  const { a, ctx } = started()
  try {
    a.setMusic('town')
    run(ctx, 1)
    a.setMuted(true)
    assert.equal(a.muted, true)
    assert.equal(store['miniworld.muted'], '1')
    assert.ok(ctx.calls.at(-1) === 'suspend', 'a muted context sleeps')
    const n = ctx.nodes
    a.sfx('jump')
    run(ctx, 3)
    assert.equal(ctx.nodes, n, 'muted but still sounding')
    a.dispose()
  } finally { uninstall() }

  const b = started({ keepStore: true })
  try {
    assert.equal(b.a.muted, true, 'the mute was not read back')
    b.a.setMuted(false)
    assert.equal(store['miniworld.muted'], '0')
    b.a.setMusic('town')
    const n = b.ctx.oscs
    run(b.ctx, 3)
    assert.ok(b.ctx.oscs > n, 'no music after unmute')
    b.a.dispose()
  } finally { uninstall() }
})

test('a hidden tab suspends the context and a visible one resumes it', () => {
  const { a, ctx } = started()
  try {
    a.setMusic('stars')
    run(ctx, 1)
    setHidden(true)
    assert.equal(ctx.calls.at(-1), 'suspend')
    const n = ctx.nodes
    a.sfx('star')
    assert.equal(ctx.nodes, n, 'sfx in a hidden tab')
    setHidden(false)
    assert.equal(ctx.calls.at(-1), 'resume')
    // A long stall (the context clock jumped) does not burst out old notes.
    ctx.currentTime += 20
    const s0 = ctx.starts.length
    run(ctx, 0.1)
    assert.ok(ctx.starts.slice(s0).every(t => t >= ctx.currentTime - 0.2), 'stale notes after a stall')
    a.dispose()
  } finally { uninstall() }
})

test('dispose closes the context, clears the timer, removes listeners and releases the radio', () => {
  const { a, ctx } = started()
  try {
    const radio = A.getRadioEngine()
    const holds = []
    const orig = radio.hold
    radio.hold = on => { holds.push(on); return orig.call(radio, on) }
    a.setMusic('town')
    run(ctx, 1)
    a.dispose()
    assert.ok(ctx.calls.includes('close'))
    assert.equal(ticks.filter(Boolean).length, 0)
    assert.equal((docListeners.visibilitychange ?? []).length, 0)
    assert.deepEqual(holds, [false])
    assert.equal(a.debug().radioHeld, false)
    const n = ctx.nodes
    a.sfx('jump')
    a.setMusic('house')
    a.unlock()
    assert.equal(ctx.nodes, n)
    assert.equal(FakeContext.made, 1, 'unlock after dispose made a new context')
    radio.hold = orig
  } finally { uninstall() }
})
