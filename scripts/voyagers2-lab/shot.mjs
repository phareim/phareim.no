#!/usr/bin/env node
// Space Voyagers II picture lab: drive the real page in a headless browser
// through its debug hook (`?theme=voyagers2&debug=voyagers2`,
// window.__voyagers2) and write PNGs. The clock is held and stepped by hand,
// and a bot flies, so a seed and a tick count name a frame exactly.
//
//   npm run dev                                   # or any local build of the site
//   node scripts/voyagers2-lab/shot.mjs [baseUrl] [scene,scene…] [outDir]
//
// baseUrl defaults to http://localhost:3030, outDir to tmp/voyagers2-shots.
// The browser is $CHROME_BIN, else chromium-browser (scripts/zelda-lab/cdp.mjs);
// on Sleeper use a wrapper that turns on SwiftShader so WebGL draws on the CPU.
// Never point it at phareim.no or a branch preview: it ends sorties, and a
// game that posts scores would post them there (no scores are posted yet).
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const { launch } = await import('../zelda-lab/cdp.mjs')

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [baseArg, only = '', outArg] = process.argv.slice(2)
const base = baseArg || 'http://localhost:3030'
const out = resolve(outArg ?? join(repo, 'tmp/voyagers2-shots'))
mkdirSync(out, { recursive: true })

const SIZES = {
  p844: { width: 390, height: 844, dpr: 3, mobile: true },
  p664: { width: 390, height: 664, dpr: 3, mobile: true },
  phone: { width: 375, height: 667, dpr: 2, mobile: true },
  wide: { width: 1280, height: 800, dpr: 1, mobile: false },
}
const V = 'window.__voyagers2'

async function begin(b, size, seed = 7) {
  await b.goto(`${base}/?theme=voyagers2&debug=voyagers2`)
  if (SIZES[size].mobile) await b.tap(SIZES[size].width / 2, SIZES[size].height * 0.3)
  else await b.key('Enter')
  for (let i = 0; i < 150 && !(await b.eval(`!!${V} && !!${V}.state()`)); i++) await b.sleep(100)
  await b.eval(`${V}.hold()`)
  await b.eval(`${V}.seed(${seed})`)
  await b.eval(`${V}.hold()`)
}

const step = (b, n) => b.eval(`${V}.step(${n})`)
const state = b => b.eval(`JSON.stringify(${V}.state())`).then(s => JSON.parse(s))

/** Step until a condition on the state holds (at most `max` ticks), `chunk` ticks at a time. */
async function until(b, cond, max = 6000, chunk = 30) {
  for (let t = 0; t < max; t += chunk) {
    const s = await state(b)
    if (cond(s)) return s
    await step(b, chunk)
  }
  return state(b)
}

const SCENES = {
  async title(b, size) {
    await b.goto(`${base}/?theme=voyagers2&debug=voyagers2`)
    await b.sleep(800)
  },
  async launch(b, size) {
    await begin(b, size)
    await step(b, 70)
  },
  async fight(b, size) {
    await begin(b, size)
    await b.eval(`${V}.bot('casual')`)
    await until(b, s => s.stage === 'fly' && s.enemies > 0)
    await step(b, 150)
  },
  async fight2(b, size) {
    await begin(b, size)
    await b.eval(`${V}.bot('casual')`)
    await until(b, s => s.stage === 'fly' && s.enemies > 0)
    await step(b, 420)
  },
  async turret(b, size) {
    await begin(b, size)
    await b.eval(`${V}.bot('casual')`)
    await until(b, s => s.stage === 'fly' && s.enemies > 0)
    await b.eval(`${V}.bot(null)`)
    await b.eval(`${V}.swap()`)
    await step(b, 200)
  },
  async menu(b, size) {
    await begin(b, size)
    await b.eval(`${V}.bot('casual')`)
    await until(b, s => s.stage === 'fly' && s.enemies > 0)
    await step(b, 60)
    await b.eval(`${V}.menu(true)`)
    await step(b, 1)
  },
  async auto(b, size) {
    await begin(b, size)
    await step(b, 160)
    await b.eval(`${V}.auto()`)
    await step(b, 90)
  },
  async home(b, size) {
    await begin(b, size)
    await b.eval(`${V}.bot('sharp')`)
    await until(b, s => s.stage === 'fly' && s.nav === 0 && s.enemies > 0, 30000, 60)
    await step(b, 240)
  },
}

const wanted = only ? only.split(',') : Object.keys(SCENES)
for (const size of Object.keys(SIZES)) {
  const b = await launch(SIZES[size])
  try {
    for (const name of wanted) {
      const [scene, onlySize] = name.split('@')
      if (onlySize && onlySize !== size) continue
      if (!SCENES[scene]) { console.error('no scene', scene); continue }
      try {
        await SCENES[scene](b, size)
        await b.sleep(250)
        const path = join(out, `${scene}-${size}.png`)
        await b.shot(path)
        console.log('wrote', path)
      } catch (e) {
        console.error(scene, size, e.message)
      }
    }
    if (b.errors.length) console.error('page errors:', b.errors.slice(0, 5).join('\n'))
  } finally {
    await b.close()
  }
}
