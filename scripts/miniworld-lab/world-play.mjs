#!/usr/bin/env node
// Mini World: a scripted play-through of the runtime in headless Chromium
// (needs world.html from world-shot.mjs, same outDir). Walks, jumps, walks
// up to doors, pops balloons, runs the obby's start and the meadow, and
// prints what the runtime reported. Run under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/miniworld-lab/world-play.mjs [outDir]
import { join, resolve } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { launch } from '../zelda-lab/cdp.mjs'

const out = resolve(process.argv[2] || join(homedir(), 'zshots', 'miniworld'))
const html = join(out, 'world.html')
if (!existsSync(html)) { console.error('run world-shot.mjs first'); process.exit(1) }

const checks = []
const ok = (name, cond, info = '') => { checks.push([name, cond]); console.log(cond ? 'ok  ' : 'FAIL', name, info) }

const b = await launch({ width: 390, height: 844, dpr: 1 })
try {
  await b.goto('file://' + html)
  const W = '__world'
  const body = `${W}.rt.__debug.body`
  // Walk right (camera-relative: east from the spawn, clear of the fountain) for a second.
  const x0 = await b.eval(`${body}.x`)
  await b.eval(`${W}.input.moveX = 1; ${W}.step(30); ${W}.input.moveX = 0; ${W}.step(10)`)
  const x1 = await b.eval(`${body}.x`)
  ok('walks about 8 u/s', x1 - x0 > 6 && x1 - x0 < 9.5, `${(x1 - x0).toFixed(2)} units`)
  // Jump.
  const top = await b.eval(`(() => { ${W}.input.jumpPressed = true; let m = 0; for (let i = 0; i < 30; i++) { ${W}.step(1); m = Math.max(m, ${body}.y) } return m })()`)
  ok('jumps about 2.2 high', top > 1.9 && top < 2.4, top.toFixed(2))
  // Home door: near, then zone on action.
  await b.eval(`${W}.events.length = 0; ${W}.at(-20, 0, -4.5, Math.PI); ${W}.step(3); ${W}.input.actionPressed = true; ${W}.step(1)`)
  const ev1 = await b.eval(`JSON.stringify(${W}.events)`)
  ok('home door shows Gå inn and sends zone home', ev1.includes('"zone":"home","label":"Gå inn"') && ev1.includes('{"type":"zone","zone":"home"}'), ev1)
  // Neighbour door.
  await b.eval(`${W}.events.length = 0; ${W}.at(-30, 0, -5, Math.PI); ${W}.step(3)`)
  const ev2 = await b.eval(`JSON.stringify(${W}.events)`)
  ok('neighbour door shows Se på', ev2.includes('neighbor:p1'), ev2)
  // The sea sends you back to the shore.
  await b.eval(`${W}.at(0, 0, 63, 0); ${W}.input.moveY = 1; ${W}.step(60); ${W}.input.moveY = 0; ${W}.step(5)`)
  const pos = await b.eval(`JSON.stringify({ x: ${body}.x, y: ${body}.y, z: ${body}.z })`)
  const p = JSON.parse(pos)
  ok('the sea puts you back on land', p.y >= -0.01 && p.z < 60, pos)
  // Magic pops balloons (capped bits).
  await b.eval(`${W}.events.length = 0; ${W}.at(36, 0, 44, Math.PI); ${W}.step(5); for (let k = 0; k < 40; k++) { ${W}.input.usePressed = true; ${W}.step(6); ${W}.rt.__debug.body.x = 30 + (k % 6) * 3; ${W}.rt.__debug.body.z = 44 - (k % 5) * 3 }`)
  const pops = await b.eval(`JSON.stringify(${W}.events.filter(e => e.type === 'pop'))`)
  const pl = JSON.parse(pops)
  const bits = pl.reduce((s, e) => s + e.bits, 0)
  ok('magic pops balloons', pl.length > 0, `${pl.length} pops, ${bits} bits`)
  ok('bits from pops never pass 30', bits <= 30)
  // Obby: fall off the start, respawn at the start.
  await b.eval(`${W}.events.length = 0; ${W}.go({ kind: 'obby', level: 'easy' }); ${W}.step(5); ${W}.at(0, 0, 0, 0); ${W}.input.moveX = 1; ${W}.step(60); ${W}.input.moveX = 0; ${W}.step(80)`)
  const ob = await b.eval(`JSON.stringify({ y: ${body}.y, ev: ${W}.events.filter(e => e.type === 'hud').slice(-1) })`)
  ok('obby: a fall puts you back on the start', JSON.parse(ob).y > -0.5, ob)
  await b.eval(`${W}.go({ kind: 'town' })`)
  const back = await b.eval(`JSON.stringify(${W}.events.filter(e => e.type === 'obby-end' || e.type === 'place').slice(-2))`)
  ok('leaving the obby unfinished sends obby-end null', back.includes('"obby-end","result":null'), back)
  // Meadow: 45 s later, stars-end.
  await b.eval(`${W}.events.length = 0; ${W}.go({ kind: 'stars' }); ${W}.step(1500)`)
  const st = await b.eval(`JSON.stringify(${W}.events.filter(e => e.type === 'stars-end'))`)
  ok('the meadow ends with stars-end', st.includes('stars-end'), st)
  // House: wardrobe zone, exit zone.
  await b.eval(`${W}.events.length = 0; ${W}.go({ kind: 'house', edit: false }); ${W}.step(5)`)
  const hz = await b.eval(`JSON.stringify(${W}.events.filter(e => e.type === 'near'))`)
  ok('house: arriving at the door offers Gå ut', hz.includes('"exit"'), hz)
  if (b.errors.length) ok('no page errors', false, b.errors.slice(0, 5).join('\n'))
} finally {
  await b.close()
}
const failed = checks.filter(c => !c[1]).length
console.log(`${checks.length - failed}/${checks.length} ok`)
process.exit(failed ? 1 : 0)
