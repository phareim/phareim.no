#!/usr/bin/env node
// Space Voyagers lab: what a frame costs. A tall phone (390 x 844 at ratio 3) under a 4x CPU
// throttle, a busy wave and a boss, through the debug hook: the time one draw takes, the time a
// tick and a draw take, and how far apart frames come when the game runs by itself.
//
//   npm run dev        # or a preview of the built site
//   node scripts/galaga-lab/perf.mjs [baseUrl] [throttle]
import { existsSync } from 'node:fs'
const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!process.env.CHROME_BIN && existsSync(MAC_CHROME)) process.env.CHROME_BIN = MAC_CHROME
const { launch } = await import('../zelda-lab/cdp.mjs')
const [base = 'http://localhost:3030', rate = '4'] = process.argv.slice(2)
const V = 'window.__voyagers'

const SCENES = {
  'busy wave (sector 5, wave 3, DUET)': `${V}.sector(5); ${V}.step(2); ${V}.wave(3); ${V}.step(400); ${V}.duet(); ${V}.step(20); 0`,
  'boss (the Deaf Star, rings)': `${V}.sector(5); ${V}.step(2); ${V}.boss('deafstar'); ${V}.world().boss.force = 'rings'; ${V}.step(420); 0`,
  'TRACKING (the tear)': `${V}.sector(4); ${V}.step(2); ${V}.wave(2); ${V}.step(400); ${V}.give('tracking'); ${V}.step(30); 0`,
}
const stats = a => { a = [...a].sort((x, y) => x - y); const q = p => a[Math.min(a.length - 1, Math.floor(a.length * p))]; return `mean ${(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2)}  p50 ${q(0.5).toFixed(2)}  p95 ${q(0.95).toFixed(2)}  max ${a[a.length - 1].toFixed(2)} ms` }

for (const [ratio, label] of [[3, 'ratio 3 (the device\'s own)'], [2, 'ratio 2'], [1, 'ratio 1']]) {
  const b = await launch({ width: 390, height: 844, dpr: ratio, mobile: true })
  await b.goto(`${base}/?theme=galaga&debug=galaga`)
  await b.sleep(600)
  await b.tap(195, 380)
  for (let i = 0; i < 80 && !(await b.eval(`!!${V}`)); i++) await b.sleep(100)
  await b.eval(`${V}.step(0); ${V}.seed(7); ${V}.autopilot(true); 0`)
  await b.send('Emulation.setCPUThrottlingRate', { rate: +rate })
  const L = JSON.parse(await b.eval(`JSON.stringify(${V}.state().layout)`))
  console.log(`\n${label}, CPU x${rate}: canvas ${390 * ratio} x ${844 * ratio}, ${L.scale} device px a pixel, buffer ${L.lw} x ${L.lh}`)
  for (const [name, setup] of Object.entries(SCENES)) {
    await b.eval(setup)
    await b.sleep(300)
    // One draw, and one tick with its draw, timed in the page.
    const draw = JSON.parse(await b.eval(`(() => { const out = []; for (let i = 0; i < 120; i++) { const t = performance.now(); ${V}.step(0); out.push(performance.now() - t) } return JSON.stringify(out) })()`))
    const both = JSON.parse(await b.eval(`(() => { const out = []; for (let i = 0; i < 120; i++) { const t = performance.now(); ${V}.step(1); out.push(performance.now() - t) } return JSON.stringify(out) })()`))
    // Running by itself for four seconds: the gaps between frames.
    await b.eval(`${V}.run(); window.__gaps = []; (() => { let last = performance.now(); const f = now => { window.__gaps.push(now - last); last = now; if (window.__gaps.length < 2000) requestAnimationFrame(f) }; requestAnimationFrame(f) })(); 0`)
    await b.sleep(4000)
    const gaps = JSON.parse(await b.eval(`JSON.stringify(window.__gaps.slice(5))`))
    await b.eval(`window.__gaps.length = 5000; ${V}.step(0); 0`)
    const long = gaps.filter(g => g > 25).length
    console.log(`  ${name}\n    draw            ${stats(draw)}\n    tick and draw   ${stats(both)}\n    frame gaps      ${stats(gaps)}  (${gaps.length} frames in 4 s, ${long} over 25 ms)`)
  }
  await b.close()
}
