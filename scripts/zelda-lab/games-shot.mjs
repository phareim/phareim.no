#!/usr/bin/env node
// Screenshot each game theme in the dev server: idle, then after starting a run.
//   node scripts/zelda-lab/games-shot.mjs <baseUrl> <outDir> [ids] [w] [h]
import { launch } from './cdp.mjs'
import { mkdirSync } from 'node:fs'
const [base, out, ids = 'invaders,galaga,breakout,tetris,rtype,outrun,starfox,anotherworld', w = '1280', h = '800'] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const mobile = +w < 600
for (const id of ids.split(',')) {
  const b = await launch({ width: +w, height: +h, dpr: mobile ? 2 : 1, mobile })
  await b.goto(`${base}/?theme=${id}`)
  await b.sleep(2500)
  await b.shot(`${out}/${id}-${w}-idle.png`)
  if (mobile) { await b.tap(+w / 2, +h / 2); await b.sleep(300); await b.tap(+w / 2, +h / 2) } else { await b.key('Enter'); await b.key('Space') }
  await b.keyDown('Space')
  await b.hold('ArrowLeft', 900)
  await b.hold('ArrowUp', 700)
  await b.keyUp('Space')
  await b.sleep(1500)
  await b.shot(`${out}/${id}-${w}-play.png`)
  if (b.errors.length) console.log(id, 'errors:', b.errors.slice(0, 3))
  await b.close()
  console.log('shot', id)
}
