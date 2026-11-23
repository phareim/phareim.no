#!/usr/bin/env node
// The polygon view in motion, as frames: what a still does not show (the
// vertices snapping to the pixels, the textures swimming, the turn in from
// the classic picture).
//
//   CHROME_BIN=<chrome> node scripts/zelda-lab/poly-strip.mjs <outDir> walk|turn [scene] [w] [h]
//
// walk: eight frames of the hero walking north-east across the town square,
// six game frames apart.
// turn: eight frames across the turn in from the classic picture (42 frames,
// the first four the hand-off). Writes <mode>-0.png … <mode>-7.png into outDir
// (the lab's shot page is built there first, by shot.mjs).
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { launch } from './cdp.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const [outArg, mode = 'walk', scene = 'r-plaza', W = '1280', H = '800'] = process.argv.slice(2)
if (!outArg) { console.error('usage: poly-strip.mjs <outDir> walk|turn [scene] [w] [h]'); process.exit(2) }
const out = resolve(outArg)
// The shot page and its bundle (and one shot of the scene).
execFileSync('node', [join(here, 'shot.mjs'), out, `${scene}-1280`], { env: { ...process.env, VIEW: 'poly' }, stdio: 'ignore' })
const b = await launch({ width: +W, height: +H })
const frames = mode === 'turn' ? '&frames=1' : ''
await b.goto(`file://${join(out, '_shot.html')}#scene=${scene}&w=${W}&h=${H}&dpr=1&top=0&touch=0&view=poly${frames}`)
const grab = async (i) => {
  const url = await b.eval(`document.querySelector('canvas').toDataURL('image/png')`)
  const png = join(out, `${mode}-${i}.png`)
  writeFileSync(png, Buffer.from(url.split(',')[1], 'base64'))
  console.log(png)
}
// (The walk starts at the south-west of the town square, below the door the scene stands the hero at.)
if (mode === 'walk') await b.eval(`__lab.s.hero.x -= 5; __lab.s.hero.y += 8.5; __lab.s.hero.dir = 'up'; for (let k = 0; k < 4; k++) __lab.r.draw(__lab.s, __lab.ui, 1 / 60); 0`)
for (let i = 0; i < 8; i++) {
  if (mode === 'turn') {
    // 42 frames in all: one is drawn, then every fifth or sixth until the turn has seated.
    const n = i === 0 ? 0 : i === 7 ? 41 - 1 - 5 * 6 : 5
    await b.eval(`for (let k = 0; k < ${n}; k++) __lab.r.draw(__lab.s, __lab.ui, 1 / 60); __lab.r.viewState().k`)
  } else {
    await b.eval(`__lab.step(6, __lab.inp({ move: { x: 0.7071, y: -0.7071 } })); __lab.r.draw(__lab.s, __lab.ui, 1 / 60); 0`)
  }
  await grab(i)
}
if (b.errors.length) console.error(b.errors.join('\n'))
await b.close()
