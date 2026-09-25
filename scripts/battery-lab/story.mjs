#!/usr/bin/env node
// Night of the Dead Battery: cutscene stills. Runs the intro or the
// midnight strike (set up with everything in place, or with one piece
// missing) in the real engine and renderer, steps until a moment, and
// screenshots it. One headless Chromium; run it under the shared lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/battery-lab/story.mjs <outDir> <shot> [<shot> …]
//
// A shot is a query string:
//   name=split3&run=finale&until=split:3&after=20&w=1280&h=800&dpr=1
//   run      intro | finale | fail:<flag missing, e.g. rod.up>
//   until    split:<n> (panes on screen) | say:<regex> (a line being spoken) | card:<regex> | view:<room> | room:<room> (Kjell's room)
//   after    frames to run once `until` holds (default 20)
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, ...shots] = process.argv.slice(2)
if (!outArg || !shots.length) { console.error('usage: story.mjs <outDir> <shot>…'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const B = p => JSON.stringify(join(repo, 'themes/battery', p))

const entry = `
import { createPixelStage } from ${JSON.stringify(join(repo, 'themes/base/pixel/stage.ts'))}
import { Game } from ${B('engine/index.ts')}
import { CONTENT } from ${B('content/index.ts')}
import { createRenderer } from ${B('render/index.ts')}

window.__shot = (qs) => {
  const q = new URLSearchParams(qs)
  const W = +(q.get('w') || 1280), H = +(q.get('h') || 800), dpr = +(q.get('dpr') || 1)
  document.body.innerHTML = ''
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'display:block;width:' + W + 'px;height:' + H + 'px'
  document.body.style.cssText = 'margin:0;background:#07040d;overflow:hidden'
  document.body.appendChild(canvas)
  const stage = createPixelStage(canvas, { bg: '#07040d' })
  const tall = H > W * 1.3
  stage.resize(W, H, dpr, 320, tall ? 400 : 200)
  const g = new Game(CONTENT)
  g.resize(stage.vw, stage.vh, 0)
  const run = q.get('run') || 'intro'
  if (run === 'intro') g.begin()
  else {
    const all = ['rod.up', 'junction.bridged', 'lever.armed', 'cat.booth', 'clockkey.taken', 'furnace.lit', 'lab.open', 'gustav.fed', 'bat.fed', 'window.open']
    const miss = run.startsWith('fail:') ? run.slice(5) : null
    for (const f of all) if (f !== miss) g.s.flags[f] = true
    g.s.inv.kjell.push('clockkey')
    Object.assign(g.s.actors.kjell, { room: 'foyer', x: 106, y: 110 })
    Object.assign(g.s.actors.dag, { room: 'lab', x: 360, y: 114 })
    Object.assign(g.s.actors.espen, { room: 'roof', x: 326, y: 118 })
    if (miss !== 'cat.booth') Object.assign(g.s.actors.cat, { room: 'lab', x: 297, y: 118, pose: 'booth' })
    g.resume()
    g.act('use', { kind: 'item', id: 'clockkey' }, { kind: 'hotspot', id: 'clock' })
  }
  const until = q.get('until') || ''
  const [kind, arg] = [until.split(':')[0], until.split(':').slice(1).join(':')]
  const test = () => {
    if (kind === 'split') return (g.split?.length ?? 0) === +arg
    if (kind === 'say') return !!g.speech && new RegExp(arg, 'i').test(g.speech.text)
    if (kind === 'card') return !!g.card && new RegExp(arg, 'i').test(g.card.text)
    if (kind === 'view') return g.viewRoom === arg && g.fade === 0
    if (kind === 'room') return g.s.actors.kjell.room === arg && g.fade === 0
    return true
  }
  let i = 0
  for (; i < 60 * 900 && !test(); i++) { g.update(1 / 60); g.drain() }
  if (!test()) return 'never reached ' + until
  const after = +(q.get('after') || 20)
  for (let k = 0; k < after; k++) { g.update(1 / 60); g.drain() }
  if (q.get('flash')) g.flash = +q.get('flash')
  createRenderer().draw(stage, g, { cursor: false })
  return 'ok'
}
document.title = 'ready'
`
const entryFile = join(out, '_story_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_story_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_story.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="_story_bundle.js"></script>`)

const b = await launch({ width: 1440, height: 900 })
try {
  await b.goto('file://' + html)
  for (const spec of shots) {
    const q = new URLSearchParams(spec)
    const name = q.get('name') || 'story'
    const W = +(q.get('w') || 1280), H = +(q.get('h') || 800), dpr = +(q.get('dpr') || 1)
    await b.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: dpr, mobile: false })
    const res = await b.eval(`(() => { try { return window.__shot(${JSON.stringify(spec)}) } catch (e) { return 'ERR ' + e.stack } })()`)
    if (res !== 'ok') { console.error(name, res); continue }
    const png = join(out, name + '.png')
    await b.shot(png)
    console.log(png)
  }
  if (b.errors?.length) console.error('page errors:', b.errors.slice(0, 5))
} finally {
  await b.close()
}
