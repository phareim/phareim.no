#!/usr/bin/env node
// The live page's frames, measured: the polygon view (or another) on a running site, the hero standing and then
// walking on real key events, every frame the page draws read back from its canvas in a requestAnimationFrame
// after the game's own. What the lab (walk-flicker.mjs) cannot show: the page's own path, with the quality left to
// the governor, the geometry built a slice a frame, and the real clock.
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/page-flicker.mjs <baseUrl> <outDir> [view] [w] [h] [dpr]
//
// Prints, for standing and for walking: the median and largest share of the picture changed between two
// consecutive frames (a channel by more than 6 of 255), frames whose mean light falls well under the rest, the
// canvas sizes seen, and the gaps between frames. Writes the worst pair and their difference to <outDir>.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { launch } from './cdp.mjs'

const [base, out, view = 'poly', W = '1280', H = '800', DPR = '1'] = process.argv.slice(2)
if (!base || !out) { console.error('usage: page-flicker.mjs <baseUrl> <outDir> [view] [w] [h] [dpr]'); process.exit(2) }
mkdirSync(out, { recursive: true })
const b = await launch({ width: +W, height: +H, dpr: +DPR, mobile: +W < 600 })
await b.goto(`${base}/?view=${view}`)
await b.sleep(6000)

const REC = `
window.__rec = (n) => new Promise(done => {
  const cv = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]
  const g = document.createElement('canvas').getContext('2d', { willReadFrequently: true })
  let prev = null, i = 0, last = performance.now()
  const st = [], sizes = new Set()
  let worst = { ch: -1, a: null, b: null }
  const T = 6
  const tick = () => {
    const now = performance.now()
    const W = cv.width, H = cv.height
    sizes.add(W + 'x' + H)
    if (g.canvas.width !== W || g.canvas.height !== H) { g.canvas.width = W; g.canvas.height = H }
    g.drawImage(cv, 0, 0)
    const d = g.getImageData(0, 0, W, H).data
    let luma = 0
    for (let p = 0; p < d.length; p += 16) luma += d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11
    luma /= (W * H / 4) * 255
    let ch = 0
    if (prev && prev.length === d.length) {
      for (let p = 0; p < d.length; p += 4) if (Math.max(Math.abs(prev[p] - d[p]), Math.abs(prev[p + 1] - d[p + 1]), Math.abs(prev[p + 2] - d[p + 2])) > T) ch++
      ch /= W * H
      if (ch > worst.ch) worst = { ch, a: prev, b: d, W, H }
    }
    st.push({ ch, luma, gap: now - last })
    last = now
    prev = d
    if (++i < n) requestAnimationFrame(tick)
    else {
      const pics = []
      if (worst.a) {
        const c2 = document.createElement('canvas'); c2.width = worst.W; c2.height = worst.H
        const g2 = c2.getContext('2d')
        for (const f of [worst.a, worst.b]) { g2.putImageData(new ImageData(new Uint8ClampedArray(f), worst.W, worst.H), 0, 0); pics.push(c2.toDataURL('image/png')) }
        const im = new ImageData(worst.W, worst.H)
        for (let p = 0; p < worst.b.length; p += 4) {
          const dd = Math.max(Math.abs(worst.a[p] - worst.b[p]), Math.abs(worst.a[p + 1] - worst.b[p + 1]), Math.abs(worst.a[p + 2] - worst.b[p + 2]))
          const l = (worst.b[p] * 0.3 + worst.b[p + 1] * 0.59 + worst.b[p + 2] * 0.11) * 0.25
          im.data[p] = dd > T ? 255 : l; im.data[p + 1] = dd > T ? 60 : l; im.data[p + 2] = dd > T ? 60 : l; im.data[p + 3] = 255
        }
        g2.putImageData(im, 0, 0)
        pics.push(c2.toDataURL('image/png'))
      }
      done({ st, sizes: [...sizes], worst: worst.ch, pics })
    }
  }
  requestAnimationFrame(tick)
})
0`
await b.eval(REC)
const median = a => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0 }
const report = (name, r) => {
  const ch = r.st.slice(1).map(q => q.ch)
  const lm = median(r.st.map(q => q.luma))
  const dark = r.st.filter(q => q.luma < lm * 0.6).length
  const gaps = r.st.slice(1).map(q => q.gap)
  console.log(`${name.padEnd(8)} frames ${r.st.length} changed med ${median(ch).toFixed(4)} max ${Math.max(...ch).toFixed(4)}  luma ${lm.toFixed(3)} min ${Math.min(...r.st.map(q => q.luma)).toFixed(3)} dark ${dark}  sizes ${r.sizes.join(',')}  gap med ${median(gaps).toFixed(1)} max ${Math.max(...gaps).toFixed(1)} ms`)
  r.pics.forEach((u, i) => writeFileSync(join(out, `${view}-${W}-${name}-${['a', 'b', 'diff'][i]}.png`), Buffer.from(u.split(',')[1], 'base64')))
  return { name, changedMedian: median(ch), changedMax: Math.max(...ch), dark, sizes: r.sizes, perFrame: r.st }
}
const res = []
res.push(report('stand', await b.eval(`__rec(90)`)))
// Walking: the arrow held down while the frames are read.
for (const key of ['ArrowDown', 'ArrowLeft']) {
  await b.keyDown(key)
  await b.sleep(200)
  res.push(report(key === 'ArrowDown' ? 'walk-dn' : 'walk-lt', await b.eval(`__rec(90)`)))
  await b.keyUp(key)
}
// And standing again, after the walk (the governor has had its say by now).
res.push(report('stand2', await b.eval(`__rec(60)`)))
await b.shot(join(out, `${view}-${W}-page.png`))
writeFileSync(join(out, `page-${view}-${W}.json`), JSON.stringify(res.map(r => ({ ...r, perFrame: r.perFrame.map(q => [+q.ch.toFixed(4), +q.luma.toFixed(3), +q.gap.toFixed(1)]) }))))
if (b.errors.length) console.error(b.errors.slice(0, 5).join('\n'))
await b.close()
