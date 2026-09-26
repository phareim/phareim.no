#!/usr/bin/env node
// Mini World: the shared world's peers in the real runtime. Bundles
// world-entry.ts (a dozen fake players on a virtual clock: walkers, a
// dancer, a waver, a heart, a magic caster, a garbage look, and two in
// other places who must not show), screenshots each shot, and checks the
// runtime's side of the contract: `here`, tapping a peer ('peer' event),
// selfState and emotes ('fx-out'). One browser, run under the lock:
//
//   flock /tmp/claude-1000/chrome.lock node scripts/miniworld-lab/peers-shot.mjs [outDir] [shots] [WxH@dpr]
//
// Shots (default all): torget, crowd, nabogata, park.
import { mkdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir } from 'node:os'
import { launch } from '../zelda-lab/cdp.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const here = dirname(fileURLToPath(import.meta.url))
const [outArg, shotArg, sizeArg] = process.argv.slice(2)
const out = resolve(outArg || join(homedir(), 'zshots', 'miniworld', 'peers'))
mkdirSync(out, { recursive: true })
const m = /^(\d+)x(\d+)(?:@(\d+))?$/.exec(sizeArg || '390x844@2')
const W = +m[1], H = +m[2], DPR = +(m[3] || 1)
const tag = `${W}x${H}`

// [setup run in the page, frames to run]
const SHOTS = {
  torget: [`__world.crowd('torget'); __world.at(0, 0, 11, Math.PI, { yaw: 0, pitch: 0.38, dist: 13 })`, 75],
  crowd: [`__world.crowd('torget'); __world.at(0, 0, 4, Math.PI, { yaw: 0.25, pitch: 0.7, dist: 19 })`, 75],
  nabogata: [`__world.crowd('nabogata'); __world.at(-21, 0, 0.5, -Math.PI / 2, { yaw: 2.0, pitch: 0.35, dist: 13 })`, 75],
  park: [`__world.crowd('park'); __world.at(36, 0, 38, Math.PI, { yaw: 0.3, pitch: 0.3, dist: 13 })`, 75],
}
const names = shotArg && shotArg !== 'all' ? shotArg.split(',') : Object.keys(SHOTS)

const built = esbuild.buildSync({
  entryPoints: [join(here, 'world-entry.ts')],
  bundle: true, format: 'iife', write: false, platform: 'browser', logLevel: 'error', target: 'es2022',
})
const html = join(out, 'peers.html')
writeFileSync(html, `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><body></body><script>${built.outputFiles[0].text}</script>`)

const b = await launch({ width: W, height: H, dpr: DPR })
let failed = false
const check = (ok, what) => { console.log(ok ? '  ok  ' : '  FAIL', what); if (!ok) failed = true }
try {
  for (const name of names) {
    const shot = SHOTS[name]
    if (!shot) { console.log('unknown shot', name); continue }
    await b.goto('file://' + html)
    await b.eval(`(() => { ${shot[0]}; __world.step(${shot[1]}); return 1 })()`)
    await b.sleep(250)
    const file = join(out, `peers-${name}-${tag}.png`)
    await b.shot(file)
    const hereN = await b.eval(`__world.rt.peers.here`)
    console.log(name, '→', file, 'here', hereN)
    if (name === 'torget') {
      check(hereN === 12, `12 peers here, 2 elsewhere hidden (got ${hereN})`)
      // Tap Ida (standing still) → a 'peer' event, and the camera does not turn.
      const r = JSON.parse(await b.eval(`(() => {
        const yaw0 = __world.rt.__debug.camera.yaw
        const n0 = __world.events.length
        const at = __world.tapPeer('s3', 'mouse')
        __world.step(2)
        const ev = __world.events.slice(n0).filter(e => e.type === 'peer')
        return JSON.stringify({ at, ev, turned: __world.rt.__debug.camera.yaw - yaw0 })
      })()`))
      check(r.ev.length === 1 && r.ev[0].id === 's3', `tap on a peer → peer event ${JSON.stringify(r)}`)
      // Your emotes and magic go out; your pose is on the wire.
      const e = JSON.parse(await b.eval(`(() => {
        const n0 = __world.events.length
        __world.rt.emote('wave'); __world.step(6)
        const s1 = __world.rt.selfState()
        __world.rt.emote('heart'); __world.step(2)
        __world.input.usePressed = true; __world.step(2)
        const out = __world.events.slice(n0).filter(e => e.type === 'fx-out').map(e => e.fx)
        return JSON.stringify({ s1, out })
      })()`))
      check(e.s1 && e.s1.pl === 'town' && e.s1.a === 'wave', `selfState ${JSON.stringify(e.s1)}`)
      check(e.out.length === 3 && e.out[0].e === 'wave' && e.out[1].e === 'heart' && e.out[2].k === 'magic', `fx-out ${JSON.stringify(e.out)}`)
      const h = JSON.parse(await b.eval(`(() => { __world.go({ kind: 'house', edit: false }); __world.step(3); return JSON.stringify({ here: __world.rt.peers.here, s: __world.rt.selfState() }) })()`))
      check(h.here === 0 && /^house:l[a-z0-9]+$/.test(h.s.pl), `own house before the public id: nobody, private key ${h.s.pl}`)
    }
  }
  if (b.errors.length) { failed = true; console.log('errors:\n' + b.errors.slice(0, 20).join('\n')) }
} finally {
  await b.close()
}
process.exit(failed ? 1 : 0)
