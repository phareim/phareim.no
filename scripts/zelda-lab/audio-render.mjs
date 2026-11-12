#!/usr/bin/env node
// Neon Shrine sound lab: render the music through an OfflineAudioContext in
// headless Chromium, once per flavour ('8-bit', '16-bit'), write WAVs and say
// what they measure. For when nobody is there to listen.
//
//   node scripts/zelda-lab/audio-render.mjs <outDir> [track,track…|all] [seconds]
//
// Per track (default: overworld, 12 s):
//   <track>-8bit.wav, <track>-16bit.wav   the same bars on each chip
//   <track>-switch.wav                    8-bit, 16-bit from 1/3 in, 8-bit again from 2/3
//   <track>.png                           their spectrograms (40 Hz to 20 kHz, log), with the
//                                         side signal (left minus right) under each
// and a table: peak, RMS, spectral centroid, stereo width (side over mid) and
// the energy per band; then the same mix before the master compressor, and
// how hard that compressor works (its gain reduction, read every 10 ms). It
// then checks what the 16-bit flavour promises: no clipping (peak under
// 0.98), no silence, within 2 dB of the 8-bit mix after the compressor and
// within 3 dB before it, a compressor that works no harder than on the 8-bit
// mix (so the kick does not pump the pads), a lower centroid (A-weighted: as
// the ear weighs it), less above 6 kHz, a wider picture; and for the switch:
// no step between two samples larger than the music itself makes, no hole in
// the loudness, and the song still where it would have been (its last third
// matches the plain 8-bit render, its middle the 16-bit one). Exit code 1
// when a check fails.
//
// PARTS=1 also renders each part of the track alone (lead, counter, bass, pad,
// arp, drums) in both flavours and prints how loud each chip plays it, before
// the compressor: what the 16-bit gains in audio.ts (SPC_GAIN, SPC_PATCHES)
// are balanced with. It writes each 16-bit part as <track>-<part>-16bit.wav.
//
// SFX=1 also renders every SFX and jingle in turn, in both flavours
// (sfx-8bit.wav, sfx-16bit.wav), with the same peak and loudness checks;
// SFX=2 prints each sound's own numbers as well.
//
// TAIL=1 also stops the track after 6 s and listens to what the 16-bit echo
// leaves: each second of the tail must be duller than the one before.
//
// SAMPLES=1 also draws the 16-bit chip's recordings (samples.png: per
// instrument the first 60 ms, the whole sample's spectrogram, the loop's
// spectrum) and writes samples.wav: every recording played once, as the chip
// plays it.
//
// AUDIO_TS=<file> renders another audio.ts (an older one, to compare).
// The page's Math.random is seeded, so two runs give the same samples.
// Needs chromium-browser on PATH (cdp.mjs; CHROME_BIN picks another browser).
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, tracksArg = 'overworld', secsArg = '12'] = process.argv.slice(2)
if (!outArg) { console.error('usage: audio-render.mjs <outDir> [track,track…|all] [seconds]'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const secs = Math.max(4, Number(secsArg) || 12)

// ---- the page: render, measure, draw ---------------------------------------

const entry = `
import * as AUDIO from ${JSON.stringify(resolve(process.env.AUDIO_TS || join(repo, 'themes/zelda/audio.ts')))}
const { createZeldaAudioOn, TRACKS, JINGLES } = AUDIO

const RATE = 44100
const kept = {}

function seed(n) {
  let s = n >>> 0
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

/**
 * Render \`secs\` of the engine. \`plan\` is what happens when: [seconds, fn(audio)] pairs; the scheduler is ticked every 50 ms.
 * Gives [left, right], with \`.pre\` (the same mix before the master compressor) and \`.red\` (that compressor's gain
 * reduction in dB, every 10 ms) on it.
 */
async function offline(secs, plan) {
  seed(20261112)
  const ctx = new OfflineAudioContext(4, Math.floor(RATE * secs), RATE)
  // The engine's one compressor is tapped: it gets a stand-in that feeds the real one (out on channels 1 and 2)
  // and passes what came in on channels 3 and 4.
  let comp = null
  const make = ctx.createDynamicsCompressor.bind(ctx)
  const wire = AudioNode.prototype.connect
  ctx.createDynamicsCompressor = () => {
    comp = make()
    const pre = ctx.createGain()
    pre.channelCount = 2
    pre.channelCountMode = 'explicit'
    for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) Object.defineProperty(pre, k, { value: comp[k] })
    pre.connect = dest => {
      const merge = ctx.createChannelMerger(4)
      const post = ctx.createChannelSplitter(2), raw = ctx.createChannelSplitter(2)
      wire.call(pre, comp); wire.call(pre, raw); comp.connect(post)
      post.connect(merge, 0, 0); post.connect(merge, 1, 1); raw.connect(merge, 0, 2); raw.connect(merge, 1, 3)
      merge.connect(dest)
      return dest
    }
    return pre
  }
  const audio = createZeldaAudioOn(ctx)
  audio.unlock()
  const todo = plan.slice().sort((a, b) => a[0] - b[0])
  const run = t => { while (todo.length && todo[0][0] <= t + 1e-6) todo.shift()[1](audio) }
  const red = []
  run(0)
  audio.tick()
  for (let i = 1; i * 0.01 < secs; i++) {
    const t = i * 0.01
    ctx.suspend(t).then(() => {
      red.push(comp ? comp.reduction : 0)
      if (i % 5 === 0) { run(t); audio.tick() }
      ctx.resume()
    })
  }
  const buf = await ctx.startRendering()
  const out = [buf.getChannelData(0), buf.getChannelData(1)]
  out.pre = [buf.getChannelData(2), buf.getChannelData(3)]
  out.red = red
  return out
}

/** A render measured: after the compressor, before it, and how hard it worked (dB of reduction: the middle value and the deepest twentieth). */
function measured(s, from = 0) {
  const m = measure(s[0], s[1], from)
  const pre = measure(s.pre[0], s.pre[1], from)
  const red = s.red.slice(Math.floor(from * 100)).map(v => -v).sort((a, b) => a - b)
  m.pre = { rmsDb: pre.rmsDb, peak: pre.peak, bands: pre.bands }
  m.squeeze = { mid: red[Math.floor(red.length / 2)] ?? 0, deep: red[Math.floor(red.length * 0.95)] ?? 0 }
  return m
}

function fft(re, im) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) { const a = re[i]; re[i] = re[j]; re[j] = a; const b = im[i]; im[i] = im[j]; im[j] = b }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = -2 * Math.PI / len
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k)
        const xr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi
        const xi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr
        re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi
        re[i + k] += xr; im[i + k] += xi
      }
    }
  }
}

const N = 2048
const HANN = Float32Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N))

/** Power spectra of a signal, one per 1024 samples. */
function spectra(x) {
  const frames = []
  const re = new Float32Array(N), im = new Float32Array(N)
  for (let at = 0; at + N <= x.length; at += N / 2) {
    for (let i = 0; i < N; i++) { re[i] = x[at + i] * HANN[i]; im[i] = 0 }
    fft(re, im)
    const p = new Float32Array(N / 2)
    for (let i = 0; i < N / 2; i++) p[i] = re[i] * re[i] + im[i] * im[i]
    frames.push(p)
  }
  return frames
}

/** The A curve as a power weight: how much of a frequency the ear takes in at an ordinary level. */
function aWeight(hz) {
  const f2 = hz * hz
  const r = (12194 ** 2 * f2 * f2) / ((f2 + 20.6 ** 2) * Math.sqrt((f2 + 107.7 ** 2) * (f2 + 737.9 ** 2)) * (f2 + 12194 ** 2))
  return r * r
}

const db = v => 20 * Math.log10(Math.max(v, 1e-9))
const rms = (x, a = 0, b = x.length) => { let s = 0; for (let i = a; i < b; i++) s += x[i] * x[i]; return Math.sqrt(s / Math.max(1, b - a)) }

function measure(L, R, from = 0) {
  const a = Math.floor(from * RATE)
  const n = L.length
  const mid = new Float32Array(n), side = new Float32Array(n)
  let peak = 0, step = 0
  for (let i = 0; i < n; i++) {
    mid[i] = (L[i] + R[i]) / 2
    side[i] = (L[i] - R[i]) / 2
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]))
    if (i) step = Math.max(step, Math.abs(L[i] - L[i - 1]), Math.abs(R[i] - R[i - 1]))
  }
  const frames = spectra(mid.subarray(a))
  const sum = new Float64Array(N / 2)
  for (const f of frames) for (let i = 0; i < N / 2; i++) sum[i] += f[i]
  let num = 0, den = 0, numA = 0, denA = 0
  const edges = [0, 120, 400, 2000, 6000, 12000, RATE / 2]
  const bands = new Array(edges.length - 1).fill(0)
  for (let i = 1; i < N / 2; i++) {
    const hz = i * RATE / N
    num += hz * sum[i]; den += sum[i]
    const w = aWeight(hz)
    numA += hz * sum[i] * w; denA += sum[i] * w
    for (let b = 0; b < bands.length; b++) if (hz >= edges[b] && hz < edges[b + 1]) bands[b] += sum[i]
  }
  const total = bands.reduce((x, y) => x + y, 0) || 1
  const r = Math.sqrt((rms(L, a) ** 2 + rms(R, a) ** 2) / 2)
  return {
    peak, step, rms: r, rmsDb: db(r), centroid: den ? num / den : 0, centroidA: denA ? numA / denA : 0,
    width: rms(side, a) / Math.max(1e-9, rms(mid, a)),
    bands: bands.map(b => 10 * Math.log10(Math.max(1e-12, b / total))),
  }
}

function wav(L, R, rate = RATE) {
  const n = L.length
  const v = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true)
  v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true)
  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true)
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true)
  }
  const bytes = new Uint8Array(v.buffer)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** How alike two signals are over a stretch (1 = the same, 0 = strangers): their spectra from 80 Hz to 4 kHz, frame by frame, so the same beat under another melody does not pass. */
function alike(a, b, from, to) {
  const i0 = Math.floor(from * RATE), i1 = Math.floor(to * RATE)
  const fa = spectra(a.subarray(i0, i1)), fb = spectra(b.subarray(i0, i1))
  const lo = Math.ceil(80 * N / RATE), hi = Math.floor(4000 * N / RATE)
  let ab = 0, aa = 0, bb = 0, sa = 0, sb = 0, n = 0
  for (let k = 0; k < Math.min(fa.length, fb.length); k++) {
    for (let i = lo; i < hi; i++) {
      const x = Math.sqrt(fa[k][i]), y = Math.sqrt(fb[k][i])
      ab += x * y; aa += x * x; bb += y * y; sa += x; sb += y; n++
    }
  }
  const cov = ab - sa * sb / n, va = aa - sa * sa / n, vb = bb - sb * sb / n
  return cov / Math.sqrt(va * vb || 1)
}

/** Spectrogram rows on one canvas: per render the mid signal, and under it the side signal. */
function draw(rows, secs) {
  const W = 1200, H = 150, PAD = 18
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = rows.length * (H * 1.5 + PAD) + 4
  const g = cv.getContext('2d')
  g.fillStyle = '#0b0616'
  g.fillRect(0, 0, cv.width, cv.height)
  const lo = Math.log(40), hi = Math.log(20000)
  let y0 = 0
  for (const row of rows) {
    for (const [sig, h] of [[row.mid, H], [row.side, H / 2]]) {
      const frames = spectra(sig)
      const img = g.createImageData(W, h)
      for (let x = 0; x < W; x++) {
        const f = frames[Math.min(frames.length - 1, Math.floor(x / W * frames.length))]
        for (let y = 0; y < h; y++) {
          const hz = Math.exp(hi - (y / h) * (hi - lo))
          const bin = Math.max(1, Math.min(N / 2 - 1, Math.round(hz * N / RATE)))
          // -90 dB to -10 dB, from the dusk's violet to its sun.
          const v = Math.max(0, Math.min(1, (10 * Math.log10(f[bin] / (N * N / 16) + 1e-12) + 90) / 80))
          const o = (y * W + x) * 4
          img.data[o] = 255 * Math.min(1, v * 1.6)
          img.data[o + 1] = 255 * Math.max(0, v * 1.8 - 0.8)
          img.data[o + 2] = 255 * (0.25 + 0.5 * Math.sin(Math.PI * Math.min(1, v * 1.2)))
          img.data[o + 3] = 255
        }
      }
      g.putImageData(img, 0, PAD + y0)
      y0 += h
    }
    g.fillStyle = '#ffd9f0'
    g.font = '12px monospace'
    g.fillText(row.name + '   (top: mid, 40 Hz to 20 kHz log; under it: side = left minus right)   ' + secs + ' s', 6, y0 - H * 1.5 + 13)
    for (const t of row.marks ?? []) { g.fillStyle = '#7ffcff'; g.fillRect(Math.round(t / secs * W), PAD + y0 - H * 1.5, 1, H * 1.5) }
    y0 += PAD
  }
  return cv.toDataURL('image/png').split(',')[1]
}

window.lab = {
  tracks: Object.keys(TRACKS),
  async track(id, secs) {
    const a = secs / 3, b = secs * 2 / 3
    const start = fl => [0, au => { au.setFlavor(fl); au.music(id) }]
    const chip = await offline(secs, [start('8-bit')])
    const spc = await offline(secs, [start('16-bit')])
    const sw = await offline(secs, [start('8-bit'), [a, au => au.setFlavor('16-bit')], [b, au => au.setFlavor('8-bit')]])
    // The largest step between two samples around each change, and the quietest 100 ms there.
    // Its loudness is set against the plain renders over the same 100 ms: the deepest it falls under the quieter of the two.
    const around = t => {
      let step = 0, hole = 0
      const i0 = Math.floor((t - 0.05) * RATE), i1 = Math.floor((t + 0.6) * RATE)
      for (let i = i0 + 1; i < i1; i++) step = Math.max(step, Math.abs(sw[0][i] - sw[0][i - 1]), Math.abs(sw[1][i] - sw[1][i - 1]))
      const loud = (s, i) => db(Math.sqrt((rms(s[0], i, i + RATE / 10) ** 2 + rms(s[1], i, i + RATE / 10) ** 2) / 2))
      for (let i = i0; i + RATE / 10 <= i1; i += RATE / 20) hole = Math.min(hole, loud(sw, i) - Math.min(loud(chip, i), loud(spc, i)))
      return { step, holeDb: hole }
    }
    let same = 0
    for (let i = 0; i < Math.floor((a - 0.01) * RATE); i++) same = Math.max(same, Math.abs(sw[0][i] - chip[0][i]))
    const rows = [['8-bit', chip, []], ['16-bit', spc, []], ['8-bit, 16-bit, 8-bit', sw, [a, b]]].map(([name, s, marks]) => ({
      name: id + ' · ' + name, marks,
      mid: Float32Array.from(s[0], (v, i) => (v + s[1][i]) / 2),
      side: Float32Array.from(s[0], (v, i) => (v - s[1][i]) / 2),
    }))
    return {
      // The first second is the fade-in: measured from 1 s on.
      chip: measured(chip, 1), spc: measured(spc, 1), sw: measured(sw, 1),
      toSpc: around(a), toChip: around(b),
      // Before the first change the switch render is the 8-bit one, sample for sample.
      sameBefore: same,
      // Well after each change it is where the plain renders are.
      alikeSpc: alike(sw[0], spc[0], a + 1.2, b - 0.05),
      alikeChip: alike(sw[0], chip[0], b + 1.2, secs - 0.05),
      // And a restart would not be: the 16-bit render shifted to start at the change.
      alikeRestart: alike(sw[0].subarray(Math.floor(a * RATE)), spc[0], 1.2, b - a - 0.05),
      wav: { '8bit': wav(chip[0], chip[1]), '16bit': wav(spc[0], spc[1]), switch: wav(sw[0], sw[1]) },
      png: draw(rows, secs),
    }
  },
  /** One part of a track alone in both flavours: how loud each chip plays it. */
  async parts(id, secs) {
    const whole = TRACKS[id]
    const out = {}
    try {
      for (const part of ['lead', 'counter', 'bass', 'pad', 'arp', 'drums']) {
        const def = structuredClone(whole)
        const none = '.'.repeat(16)
        let has = false
        for (const sec of Object.values(def.sections)) {
          if (part === 'lead' ? sec.lead : part === 'counter' ? sec.counter : part === 'pad' ? sec.pad : part === 'arp' ? sec.arp : true) has = true
          if (part !== 'lead') delete sec.lead
          if (part !== 'counter') delete sec.counter
          if (part !== 'bass') sec.bass = none
          if (part !== 'drums') { sec.drums = { k: none, s: none, h: none }; delete sec.fill }
          if (part !== 'arp') delete sec.arp
          if (part !== 'pad') sec.pad = false
        }
        if (!has) continue
        TRACKS[id] = def
        out[part] = {}
        for (const fl of ['8-bit', '16-bit']) {
          const s = await offline(secs, [[0, au => { au.setFlavor(fl); au.music(id) }]])
          // Before the compressor: a part alone hardly moves it, the whole mix does.
          out[part][fl] = measure(s.pre[0], s.pre[1], 1)
          if (fl === '16-bit') out[part].wav = wav(s[0], s[1])
        }
      }
    } finally { TRACKS[id] = whole }
    return out
  },
  /** What the 16-bit echo leaves when the track stops at 6 s: per second of the tail, its level and how much of it sits around 3 kHz against under 1.2 kHz. */
  async tail(id) {
    const s = await offline(10.5, [[0, au => { au.setFlavor('16-bit'); au.music(id) }], [6, au => au.music(null)]])
    const out = []
    for (let t = 6.9; t + 1 <= 10.5; t += 1) {
      const frames = spectra(Float32Array.from(s.pre[0].subarray(Math.floor(t * RATE), Math.floor((t + 1) * RATE)), (v, i) => (v + s.pre[1][Math.floor(t * RATE) + i]) / 2))
      let low = 0, ring = 0, all = 0
      for (const f of frames) for (let i = 1; i < N / 2; i++) {
        const hz = i * RATE / N
        all += f[i]
        if (hz >= 150 && hz < 1200) low += f[i]
        if (hz >= 2300 && hz < 3600) ring += f[i]
      }
      out.push({ from: t, levelDb: 10 * Math.log10(all / frames.length / (N * N / 16) + 1e-20), ringDb: 10 * Math.log10((ring + 1e-30) / (low + 1e-30)) })
    }
    return out
  },
  /** The chip's recordings, drawn and played: one root of every instrument, and the kit. */
  samples() {
    const { SPC_SAMPLES, SPC_GAIN, SPC_RATE, renderSpcSample, renderSpcDrum, spcCodec } = AUDIO
    const list = []
    for (const [name, spec] of Object.entries(SPC_SAMPLES)) {
      for (const root of spec.roots) {
        const rec = renderSpcSample(name, root)
        list.push({ name: name + ' ' + root, data: spcCodec(rec.data, rec.loop), loop: rec.loop, hz: rec.hz, first: root === spec.roots[0] })
      }
    }
    for (const name of Object.keys(SPC_GAIN.drums)) list.push({ name, data: spcCodec(renderSpcDrum(name)), loop: -1, hz: 0, first: true })
    const shown = list.filter(s => s.first)
    const W = 1200, H = 96, PAD = 16
    const cv = document.createElement('canvas')
    cv.width = W
    cv.height = shown.length * (H + PAD) + 4
    const g = cv.getContext('2d')
    g.fillStyle = '#0b0616'
    g.fillRect(0, 0, W, cv.height)
    const M = 1024
    const win = Float32Array.from({ length: M }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / M))
    const spec = (x, at) => {
      const re = new Float32Array(M), im = new Float32Array(M)
      for (let i = 0; i < M; i++) re[i] = (x[at + i] ?? 0) * win[i]
      fft(re, im)
      return Float32Array.from({ length: M / 2 }, (_, i) => re[i] * re[i] + im[i] * im[i])
    }
    shown.forEach((s, row) => {
      const y0 = row * (H + PAD) + PAD
      const x = s.data
      // The first 60 ms.
      g.strokeStyle = '#7ffcff'
      g.beginPath()
      const n0 = Math.min(x.length, Math.floor(0.06 * SPC_RATE))
      for (let i = 0; i < n0; i++) { const px = i / n0 * 380, py = y0 + H / 2 - x[i] * H / 2; i ? g.lineTo(px, py) : g.moveTo(px, py) }
      g.stroke()
      // The whole sample: time across, 60 Hz to 16 kHz up.
      const img = g.createImageData(400, H)
      const lo = Math.log(60), hi = Math.log(16000)
      for (let px = 0; px < 400; px++) {
        const p = spec(x, Math.floor(px / 400 * Math.max(1, x.length - M)))
        for (let py = 0; py < H; py++) {
          const hz = Math.exp(hi - (py / H) * (hi - lo))
          const bin = Math.max(1, Math.min(M / 2 - 1, Math.round(hz * M / SPC_RATE)))
          const v = Math.max(0, Math.min(1, (10 * Math.log10(p[bin] / (M * M / 16) + 1e-12) + 80) / 70))
          const o = (py * 400 + px) * 4
          img.data[o] = 255 * Math.min(1, v * 1.6); img.data[o + 1] = 255 * Math.max(0, v * 1.8 - 0.8)
          img.data[o + 2] = 255 * (0.25 + 0.5 * Math.sin(Math.PI * Math.min(1, v * 1.2))); img.data[o + 3] = 255
        }
      }
      g.putImageData(img, 392, y0)
      if (s.loop > 0) { g.fillStyle = '#7ffcff'; g.fillRect(392 + Math.round(s.loop / x.length * 400), y0, 1, H) }
      // The loop's spectrum (the end of a drum has none: the whole of it), 0 to 16 kHz across, 70 dB up.
      const from = s.loop >= 0 ? s.loop : 0
      const avg = new Float32Array(M / 2)
      let frames = 0
      for (let at = from; at + M <= x.length; at += M / 2) { const p = spec(x, at); for (let i = 0; i < M / 2; i++) avg[i] += p[i]; frames++ }
      g.strokeStyle = '#ffd24a'
      g.beginPath()
      for (let i = 1; i < M / 2; i++) {
        const v = Math.max(0, Math.min(1, (10 * Math.log10(avg[i] / Math.max(1, frames) / (M * M / 16) + 1e-12) + 80) / 70))
        const px = 800 + i / (M / 2) * 396, py = y0 + H - v * H
        i > 1 ? g.lineTo(px, py) : g.moveTo(px, py)
      }
      g.stroke()
      g.fillStyle = '#ffd9f0'
      g.font = '12px monospace'
      g.fillText(s.name + (s.hz ? '  ' + s.hz.toFixed(1) + ' Hz' : '') + '  ' + (x.length / SPC_RATE).toFixed(2) + ' s' + (s.loop >= 0 ? ', loop from ' + (s.loop / SPC_RATE).toFixed(2) + ' s' : '') + '    | first 60 ms | spectrogram 60 Hz to 16 kHz (line: loop start) | loop spectrum 0 to 16 kHz, 70 dB', 6, y0 - 3)
    })
    // Every recording once, as the chip holds it: 0.9 s each (a looped one goes round), a short gap between.
    const each = Math.floor(0.9 * SPC_RATE), gap = Math.floor(0.2 * SPC_RATE)
    const tape = new Float32Array(list.length * (each + gap))
    list.forEach((s, k) => {
      for (let i = 0; i < each; i++) {
        let at = i
        if (at >= s.data.length) { if (s.loop < 0) break; at = s.loop + (at - s.loop) % (s.data.length - s.loop) }
        tape[k * (each + gap) + i] = s.data[at] * Math.min(1, (each - i) / 400) * 0.7
      }
    })
    return { png: cv.toDataURL('image/png').split(',')[1], wav: wav(tape, tape, SPC_RATE), names: list.map(s => s.name) }
  },
  async sfx(names) {
    const out = {}
    const jingles = Object.keys(JINGLES)
    const total = names.length * 1.25 + jingles.length * 4 + 1
    for (const fl of ['8-bit', '16-bit']) {
      const plan = [[0, au => au.setFlavor(fl)]]
      names.forEach((n, i) => plan.push([0.1 + i * 1.25, au => au.sfx(n)]))
      jingles.forEach((j, i) => plan.push([0.1 + names.length * 1.25 + i * 4, au => au.jingle(j)]))
      const s = await offline(total, plan)
      const jingle = jingles.map((n, i) => {
        const i0 = Math.floor((0.1 + names.length * 1.25 + i * 4) * RATE), i1 = Math.min(s[0].length, i0 + 4 * RATE)
        let peak = 0
        for (let k = i0; k < i1; k++) peak = Math.max(peak, Math.abs(s[0][k]), Math.abs(s[1][k]))
        return { name: 'jingle ' + n, peak, rise: 0, rmsDb: db(Math.sqrt((rms(s[0], i0, i1) ** 2 + rms(s[1], i0, i1) ** 2) / 2)) }
      })
      const each = names.map((n, i) => {
        const i0 = Math.floor((0.1 + i * 1.25) * RATE), i1 = i0 + Math.floor(1.25 * RATE)
        let peak = 0
        for (let k = i0; k < i1; k++) peak = Math.max(peak, Math.abs(s[0][k]), Math.abs(s[1][k]))
        // How fast it speaks: the time to reach half its peak.
        let rise = 0
        for (let k = i0; k < i1; k++) if (Math.abs(s[0][k]) >= peak / 2 || Math.abs(s[1][k]) >= peak / 2) { rise = (k - i0) / RATE; break }
        return { name: n, peak, rise, rmsDb: db(Math.sqrt((rms(s[0], i0, i1) ** 2 + rms(s[1], i0, i1) ** 2) / 2)) }
      })
      out[fl] = { all: measured(s), each: [...each, ...jingle], wav: wav(s[0], s[1]) }
    }
    return out
  },
}
`

const SFX_NAMES = ['sword', 'spin', 'charge', 'hit', 'kill', 'clank', 'hurt', 'shock', 'die', 'cut',
  'shatter', 'lift', 'throw', 'coin', 'heart', 'key', 'chest', 'unlock', 'door', 'plate',
  'crystal', 'push', 'bombPlace', 'boom', 'disc', 'discHit', 'fall', 'pellet', 'laser',
  'reflect', 'warp', 'stairs', 'text', 'menu', 'select', 'error', 'bossRoar', 'bossHit',
  'bossDie', 'lowHp', 'gate', 'hook', 'hookHit', 'pull', 'psi', 'glyph', 'lever', 'land', 'beam', 'gust', 'bark']

const entryFile = join(out, '_audio-entry.js')
const bundle = join(out, '_audio-bundle.js')
writeFileSync(entryFile, entry)
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_audio.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="${bundle}"></script>`)

// ---- run, write, judge -------------------------------------------------------

const fails = []
const check = (ok, what) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fails.push(what) }
const f = (v, d = 2) => v.toFixed(d).padStart(7)
/** The share of a mix above 6 kHz, in dB of the whole. */
const top = m => 10 * Math.log10(10 ** (m.bands[4] / 10) + 10 ** (m.bands[5] / 10))
const BANDS = '  <120   <400    <2k    <6k   <12k   >12k'

const b = await launch({ width: 800, height: 600 })
try {
  await b.goto(`file://${html}`)
  const all = await b.eval('window.lab.tracks')
  if (!Array.isArray(all)) throw new Error('the page did not load: ' + b.errors.join(' | '))
  const want = tracksArg === 'all' ? all : tracksArg.split(',')
  for (const id of want) {
    if (!all.includes(id)) { console.error(`no track ${id} (${all.join(', ')})`); process.exitCode = 2; continue }
    const r = await b.eval(`window.lab.track(${JSON.stringify(id)}, ${secs})`)
    if (!r) throw new Error(`${id}: no render: ${b.errors.join(' | ')}`)
    for (const [name, data] of Object.entries(r.wav)) writeFileSync(join(out, `${id}-${name}.wav`), Buffer.from(data, 'base64'))
    writeFileSync(join(out, `${id}.png`), Buffer.from(r.png, 'base64'))
    console.log(`\n${id} (${secs} s, measured from 1 s)`)
    console.log(`           peak    RMS dB  centroid  A-weighted   width  ${BANDS}  (dB of the whole, per band)`)
    for (const [name, m] of [['8-bit ', r.chip], ['16-bit', r.spc], ['switch', r.sw]]) {
      console.log(`  ${name} ${f(m.peak, 3)} ${f(m.rmsDb)} ${f(m.centroid, 0)} Hz ${f(m.centroidA, 0)} Hz ${f(m.width, 3)}  ${m.bands.map(x => f(x, 1)).join('')}`)
    }
    console.log('  before the master compressor:   RMS dB    peak   under 120 Hz (dBFS)   the compressor takes off (dB): mostly / at its deepest')
    for (const [name, m] of [['8-bit ', r.chip], ['16-bit', r.spc]]) {
      console.log(`  ${name}                         ${f(m.pre.rmsDb)} ${f(m.pre.peak, 3)}   ${f(m.pre.bands[0] + m.pre.rmsDb, 1)}                 ${f(m.squeeze.mid, 1)} / ${f(m.squeeze.deep, 1)}`)
    }
    check(r.chip.peak < 0.98 && r.spc.peak < 0.98 && r.sw.peak < 0.98, 'no clipping: every peak under 0.98')
    check(r.chip.rmsDb > -45 && r.spc.rmsDb > -45, 'no silence')
    check(Math.abs(r.spc.rmsDb - r.chip.rmsDb) <= 2, `the flavours are within 2 dB (16-bit is ${f(r.spc.rmsDb - r.chip.rmsDb).trim()} dB against 8-bit)`)
    check(Math.abs(r.spc.pre.rmsDb - r.chip.pre.rmsDb) <= 3, `and within 3 dB before the compressor (${f(r.spc.pre.rmsDb - r.chip.pre.rmsDb).trim()} dB)`)
    check(r.spc.squeeze.deep <= r.chip.squeeze.deep + 1, `the compressor works no harder on the 16-bit mix: at its deepest ${r.spc.squeeze.deep.toFixed(1)} dB against ${r.chip.squeeze.deep.toFixed(1)} dB`)
    // Judged as the ear weighs it (the A curve). The plain centroid is printed too, but it mostly says how much
    // of the mix is sub bass: the 8-bit bass doubles every note an octave down, at 33 to 62 Hz.
    check(r.spc.centroidA < r.chip.centroidA, `16-bit has the lower centroid, A-weighted (${Math.round(r.spc.centroidA)} Hz against ${Math.round(r.chip.centroidA)} Hz; unweighted ${Math.round(r.spc.centroid)} against ${Math.round(r.chip.centroid)}${r.spc.centroid < r.chip.centroid ? '' : ', NOT lower'})`)
    check(top(r.spc) < top(r.chip) || top(r.spc) < -50, `16-bit has less above 6 kHz, or next to nothing there (${f(top(r.spc), 1).trim()} dB of the mix against ${f(top(r.chip), 1).trim()} dB)`)
    check(r.spc.width > r.chip.width, `16-bit is wider (${r.spc.width.toFixed(3)} against ${r.chip.width.toFixed(3)})`)
    const music = Math.max(r.chip.step, r.spc.step)
    check(r.toSpc.step <= music * 1.25 && r.toChip.step <= music * 1.25, `no click at a change: largest step ${r.toSpc.step.toFixed(4)} / ${r.toChip.step.toFixed(4)}, the music's own ${music.toFixed(4)}`)
    check(r.toSpc.holeDb > -4 && r.toChip.holeDb > -4, `no hole at a change: at its deepest ${f(r.toSpc.holeDb, 1).trim()} / ${f(r.toChip.holeDb, 1).trim()} dB under the quieter plain render (100 ms windows)`)
    check(r.sameBefore < 1e-4, `before the change it is the 8-bit render (largest difference ${r.sameBefore.toExponential(1)})`)
    if (process.env.PARTS) {
      const parts = await b.eval(`window.lab.parts(${JSON.stringify(id)}, ${secs})`)
      console.log('  each part alone, before the compressor       8-bit RMS  centroid  width     16-bit RMS  centroid  width     16 against 8')
      for (const [part, m] of Object.entries(parts ?? {})) {
        const c = m['8-bit'], s = m['16-bit']
        writeFileSync(join(out, `${id}-${part}-16bit.wav`), Buffer.from(m.wav, 'base64'))
        console.log(`    ${part.padEnd(8)}          ${f(c.rmsDb)} ${f(c.centroid, 0)} Hz ${f(c.width, 3)}       ${f(s.rmsDb)} ${f(s.centroid, 0)} Hz ${f(s.width, 3)}       ${f(s.rmsDb - c.rmsDb, 1)} dB`)
        // PARTS=2: where in the spectrum each chip puts the part (absolute dB per band).
        if (process.env.PARTS === '2') for (const m2 of [c, s]) console.log(`      ${m2 === c ? ' 8-bit' : '16-bit'} per band (dBFS)  ${m2.bands.map(x => f(x + m2.rmsDb, 1)).join('')}   ${BANDS.trim().replace(/\s+/g, ' ')}`)
      }
    }
    check(r.alikeSpc > 0.85 && r.alikeChip > 0.85 && r.alikeSpc > r.alikeRestart + 0.1, `the song goes on where it was: alike ${r.alikeSpc.toFixed(2)} (16-bit part), ${r.alikeChip.toFixed(2)} (8-bit part); a restart would be ${r.alikeRestart.toFixed(2)}`)
    if (process.env.TAIL) {
      const tail = await b.eval(`window.lab.tail(${JSON.stringify(id)})`)
      console.log('  the 16-bit echo after the track stops at 6 s, second by second: level, and 2.3 to 3.6 kHz against 150 Hz to 1.2 kHz')
      for (const t of tail ?? []) console.log(`    from ${t.from.toFixed(1)} s   ${f(t.levelDb, 1)} dB   ${f(t.ringDb, 1)} dB`)
      const heard = (tail ?? []).filter(t => t.levelDb > -100)
      check(heard.length >= 1 && (tail ?? []).filter(t => t.levelDb > -140).every((t, i, all) => !i || t.ringDb <= all[i - 1].ringDb + 0.5), 'the echo gets duller as it dies: nothing rings around 3 kHz')
    }
  }
  if (process.env.SAMPLES) {
    const r = await b.eval('window.lab.samples()')
    if (!r) throw new Error(`samples: no drawing: ${b.errors.join(' | ')}`)
    writeFileSync(join(out, 'samples.png'), Buffer.from(r.png, 'base64'))
    writeFileSync(join(out, 'samples.wav'), Buffer.from(r.wav, 'base64'))
    console.log(`\nsamples.png, samples.wav: ${r.names.length} recordings (${r.names.join(', ')})`)
  }
  if (process.env.SFX) {
    const r = await b.eval(`window.lab.sfx(${JSON.stringify(SFX_NAMES)})`)
    if (!r) throw new Error(`sfx: no render: ${b.errors.join(' | ')}`)
    console.log('\nSFX and jingles, each in turn')
    console.log('           peak    RMS dB  centroid  A-weighted   width')
    for (const fl of ['8-bit', '16-bit']) {
      const m = r[fl].all
      writeFileSync(join(out, `sfx-${fl.replace('-', '')}.wav`), Buffer.from(r[fl].wav, 'base64'))
      console.log(`  ${fl.padEnd(6)} ${f(m.peak, 3)} ${f(m.rmsDb)} ${f(m.centroid, 0)} Hz ${f(m.centroidA, 0)} Hz ${f(m.width, 3)}`)
    }
    const chip = r['8-bit'], spc = r['16-bit']
    check(chip.all.peak < 0.98 && spc.all.peak < 0.98, 'no clipping')
    check(Math.abs(spc.all.rmsDb - chip.all.rmsDb) <= 2, `the flavours are within 2 dB (${f(spc.all.rmsDb - chip.all.rmsDb).trim()} dB)`)
    // SFX=2: each sound's own numbers, 8-bit then 16-bit.
    if (process.env.SFX === '2') {
      for (const [i, e] of chip.each.entries()) {
        const s16 = spc.each[i]
        console.log(`    ${e.name.padEnd(10)} peak ${f(e.peak, 3)} ${f(s16.peak, 3)}   RMS ${f(e.rmsDb, 1)} ${f(s16.rmsDb, 1)} dB   half its peak after ${f(e.rise * 1000, 1)} ${f(s16.rise * 1000, 1)} ms`)
      }
    }
    const quiet = spc.each.filter((e, i) => e.rmsDb < chip.each[i].rmsDb - 6 || e.peak < 0.003)
    check(quiet.length === 0, `every SFX still sounds in 16-bit${quiet.length ? ': too quiet: ' + quiet.map(e => e.name).join(', ') : ''}`)
    const slow = spc.each.filter((e, i) => e.rise > chip.each[i].rise + 0.006)
    check(slow.length === 0, `every SFX is as snappy (half its peak within 6 ms of the 8-bit one)${slow.length ? ': slow: ' + slow.map(e => `${e.name} ${Math.round(e.rise * 1000)} ms`).join(', ') : ''}`)
  }
  if (b.errors.length) { console.log('\npage errors:'); for (const e of b.errors) console.log('  ' + e); fails.push('page errors') }
} finally {
  await b.close()
}
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed')
console.log(out)
if (fails.length) process.exitCode = 1
