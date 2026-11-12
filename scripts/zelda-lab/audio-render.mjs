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
// the energy per band. It then checks what the 16-bit flavour promises:
// no clipping (peak under 0.98), no silence, within 2 dB of the 8-bit mix,
// a lower centroid (A-weighted: as the ear weighs it), less above 6 kHz, a
// wider picture; and for the switch: no step between two
// samples larger than the music itself makes, no hole in the loudness, and
// the song still where it would have been (its last third matches the plain
// 8-bit render, its middle the 16-bit one). Exit code 1 when a check fails.
//
// PARTS=1 also renders each part of the track alone (lead, counter, bass, pad,
// arp, drums) in both flavours and prints how loud each chip plays it: what
// the 16-bit gains in audio.ts (SPC_GAIN, SPC_PATCHES) are balanced with.
//
// SFX=1 also renders every SFX and jingle in turn, in both flavours
// (sfx-8bit.wav, sfx-16bit.wav), with the same peak and loudness checks;
// SFX=2 prints each sound's own numbers as well.
//
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
import { createZeldaAudioOn, TRACKS, JINGLES } from ${JSON.stringify(join(repo, 'themes/zelda/audio.ts'))}

const RATE = 44100
const kept = {}

function seed(n) {
  let s = n >>> 0
  Math.random = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 }
}

/** Render \`secs\` of the engine. \`plan\` is what happens when: [seconds, fn(audio)] pairs; the scheduler is ticked every 50 ms. */
async function offline(secs, plan) {
  seed(20261112)
  const ctx = new OfflineAudioContext(2, Math.floor(RATE * secs), RATE)
  const audio = createZeldaAudioOn(ctx)
  audio.unlock()
  const todo = plan.slice().sort((a, b) => a[0] - b[0])
  const run = t => { while (todo.length && todo[0][0] <= t + 1e-6) todo.shift()[1](audio) }
  run(0)
  audio.tick()
  for (let i = 1; i * 0.05 < secs; i++) {
    const t = i * 0.05
    ctx.suspend(t).then(() => { run(t); audio.tick(); ctx.resume() })
  }
  const buf = await ctx.startRendering()
  return [buf.getChannelData(0), buf.getChannelData(1)]
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

function wav(L, R) {
  const n = L.length
  const v = new DataView(new ArrayBuffer(44 + n * 4))
  const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt '); v.setUint32(16, 16, true)
  v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, RATE, true); v.setUint32(28, RATE * 4, true)
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
      chip: measure(chip[0], chip[1], 1), spc: measure(spc[0], spc[1], 1), sw: measure(sw[0], sw[1], 1),
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
          out[part][fl] = measure(s[0], s[1], 1)
        }
      }
    } finally { TRACKS[id] = whole }
    return out
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
      out[fl] = { all: measure(s[0], s[1]), each: [...each, ...jingle], wav: wav(s[0], s[1]) }
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
    check(r.chip.peak < 0.98 && r.spc.peak < 0.98 && r.sw.peak < 0.98, 'no clipping: every peak under 0.98')
    check(r.chip.rmsDb > -45 && r.spc.rmsDb > -45, 'no silence')
    check(Math.abs(r.spc.rmsDb - r.chip.rmsDb) <= 2, `the flavours are within 2 dB (16-bit is ${f(r.spc.rmsDb - r.chip.rmsDb).trim()} dB against 8-bit)`)
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
      console.log('  each part alone       8-bit RMS  centroid  width     16-bit RMS  centroid  width     16 against 8')
      for (const [part, m] of Object.entries(parts ?? {})) {
        const c = m['8-bit'], s = m['16-bit']
        console.log(`    ${part.padEnd(8)}          ${f(c.rmsDb)} ${f(c.centroid, 0)} Hz ${f(c.width, 3)}       ${f(s.rmsDb)} ${f(s.centroid, 0)} Hz ${f(s.width, 3)}       ${f(s.rmsDb - c.rmsDb, 1)} dB`)
        // PARTS=2: where in the spectrum each chip puts the part (absolute dB per band).
        if (process.env.PARTS === '2') for (const m2 of [c, s]) console.log(`      ${m2 === c ? ' 8-bit' : '16-bit'} per band (dBFS)  ${m2.bands.map(x => f(x + m2.rmsDb, 1)).join('')}   ${BANDS.trim().replace(/\s+/g, ' ')}`)
      }
    }
    check(r.alikeSpc > 0.85 && r.alikeChip > 0.85 && r.alikeSpc > r.alikeRestart + 0.1, `the song goes on where it was: alike ${r.alikeSpc.toFixed(2)} (16-bit part), ${r.alikeChip.toFixed(2)} (8-bit part); a restart would be ${r.alikeRestart.toFixed(2)}`)
  }
  if (process.env.SFX) {
    const r = await b.eval(`window.lab.sfx(${JSON.stringify(SFX_NAMES)})`)
    if (!r) throw new Error(`sfx: no render: ${b.errors.join(' | ')}`)
    console.log('\nSFX and jingles, each in turn')
    console.log('           peak    RMS dB  centroid   width')
    for (const fl of ['8-bit', '16-bit']) {
      const m = r[fl].all
      writeFileSync(join(out, `sfx-${fl.replace('-', '')}.wav`), Buffer.from(r[fl].wav, 'base64'))
      console.log(`  ${fl.padEnd(6)} ${f(m.peak, 3)} ${f(m.rmsDb)} ${f(m.centroid, 0)} Hz ${f(m.width, 3)}`)
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
    const slow = spc.each.filter((e, i) => e.rise > chip.each[i].rise + 0.02)
    check(slow.length === 0, `every SFX is as snappy (half its peak within 20 ms of the 8-bit one)${slow.length ? ': slow: ' + slow.map(e => `${e.name} ${Math.round(e.rise * 1000)} ms`).join(', ') : ''}`)
  }
  if (b.errors.length) { console.log('\npage errors:'); for (const e of b.errors) console.log('  ' + e); fails.push('page errors') }
} finally {
  await b.close()
}
console.log(fails.length ? `\n${fails.length} check(s) failed` : '\nall checks passed')
console.log(out)
if (fails.length) process.exitCode = 1
