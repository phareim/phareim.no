#!/usr/bin/env node
// Night of the Dead Battery look lab: the real engine, content and renderer
// bundled with esbuild into a bare page (no Nuxt), screenshotted in ONE
// headless Chromium over CDP. Run it under the shared lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/battery-lab/shot.mjs <outDir> <shot> [<shot> …]
//
// A shot is a query string (outDir must be a non-hidden path under $HOME for
// the snap Chromium, e.g. ~/Pictures/battery):
//   name=foyer&room=foyer&x=200&y=120&face=left&hero=kjell&flags=furnace.lit,jam.open
//   &inv=poker,gloves&say=Hello there&who=kjell&w=1280&h=800&dpr=1&frames=60&title=1
//   &hover=300,80 (logical px: shows the sentence line) &verb=use &actors=cat:kitchen:200:100
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [outArg, ...shots] = process.argv.slice(2)
if (!outArg || !shots.length) { console.error('usage: shot.mjs <outDir> <shot>…'); process.exit(2) }
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const B = p => JSON.stringify(join(repo, 'themes/battery', p))

const entry = `
import { createPixelStage } from ${JSON.stringify(join(repo, 'themes/base/pixel/stage.ts'))}
import { Game } from ${B('engine/index.ts')}
import { CONTENT } from ${B('content/index.ts')}
import { createRenderer } from ${B('render/index.ts')}
import { drawTitle } from ${B('render/title.ts')}

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
  if (q.get('title')) { for (let i = 0; i < 30; i++) drawTitle(stage, i / 60 + +(q.get('t') || 2)); return 'ok' }
  const g = new Game(CONTENT)
  g.resize(stage.vw, stage.vh, 0)
  const hero = q.get('hero') || 'kjell'
  g.s.hero = hero
  for (const f of (q.get('flags') || '').split(',').filter(Boolean)) {
    const [k, v] = f.split('=')
    g.s.flags[k] = v === undefined ? true : isNaN(+v) ? v : +v
  }
  for (const it of (q.get('inv') || '').split(',').filter(Boolean)) {
    for (const h of ['kjell', 'dag', 'espen']) g.s.inv[h] = g.s.inv[h].filter(i => i !== it)
    g.s.inv[hero].push(it)
  }
  for (const a of (q.get('actors') || '').split(';').filter(Boolean)) {
    const [id, room, x, y, pose] = a.split(':')
    Object.assign(g.s.actors[id], { room: room === 'null' ? null : room, x: +x, y: +y, visible: true, pose: pose || '' })
  }
  const A = g.s.actors[hero]
  if (q.get('room')) { A.room = q.get('room'); A.x = +(q.get('x') || 200); A.y = +(q.get('y') || 124) }
  if (q.get('face')) A.face = q.get('face')
  if (q.get('pose')) A.pose = q.get('pose')
  g.resume()
  if (q.get('verb')) g.verb = q.get('verb')
  if (q.get('say')) { g.run(function* (c) { yield c.sayAs(q.get('who') || hero, q.get('say')) }) }
  const r = createRenderer()
  const frames = +(q.get('frames') || 30)
  for (let i = 0; i < frames; i++) { g.update(1 / 60); g.drain() }
  if (q.get('flash')) g.flash = +q.get('flash')
  if (q.get('hover')) { const [hx, hy] = q.get('hover').split(',').map(Number); g.pointerMove(hx, hy) }
  r.draw(stage, g, { cursor: !!q.get('hover') })
  return 'ok'
}
document.title = 'ready'
`
const entryFile = join(out, '_entry.ts')
writeFileSync(entryFile, entry)
const bundle = join(out, '_bundle.js')
esbuild.buildSync({ entryPoints: [entryFile], bundle: true, outfile: bundle, format: 'iife', logLevel: 'error' })
const html = join(out, '_shot.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="_bundle.js"></script>`)

const b = await launch({ width: 1440, height: 900 })
try {
  await b.goto('file://' + html)
  for (const spec of shots) {
    const q = new URLSearchParams(spec)
    const name = q.get('name') || q.get('room') || 'shot'
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
