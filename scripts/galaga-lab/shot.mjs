#!/usr/bin/env node
// Space Voyagers picture lab: drive the real page in a headless browser
// through its debug hook (`?theme=galaga&debug=galaga`, window.__voyagers)
// and write PNGs. The clock is held and stepped by hand, so a seed and a
// tick count name a frame exactly.
//
//   npm run dev                                  # or any local build of the site
//   node scripts/galaga-lab/shot.mjs [baseUrl] [scene,scene…] [outDir]
//
// baseUrl defaults to http://localhost:3030, outDir to tmp/galaga-shots
// (git-ignored). Scene names are listed by SCENES below; a name without a
// size (`boss-cal`) takes both sizes. The browser is $CHROME_BIN, else the
// Mac's Chrome, else chromium-browser (scripts/zelda-lab/cdp.mjs).
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const MAC_CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
if (!process.env.CHROME_BIN && existsSync(MAC_CHROME)) process.env.CHROME_BIN = MAC_CHROME
const { launch } = await import('../zelda-lab/cdp.mjs')

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const [base = 'http://localhost:3030', only = '', outArg] = process.argv.slice(2)
const out = resolve(outArg ?? join(repo, 'tmp/galaga-shots'))
mkdirSync(out, { recursive: true })

const SIZES = {
  phone: { width: 375, height: 667, dpr: 2, mobile: true },
  wide: { width: 1280, height: 800, dpr: 1, mobile: false },
}
const SEED = 7
// Extra screens a scene may name with `sizes`: an installed tall phone, a laptop whose panels are narrower than their bitmaps.
const EXTRA = {
  tall: { width: 390, height: 844, dpr: 3, mobile: true },
  laptop: { width: 1180, height: 700, dpr: 2, mobile: false },
  side: { width: 667, height: 375, dpr: 2, mobile: true },
  hd: { width: 1920, height: 1080, dpr: 1, mobile: false },
}
const ALL = { ...SIZES, ...EXTRA }
const V = 'window.__voyagers'

/** Start a run from the title and take the clock: seed 7, the autopilot flying. */
async function begin(b, size, { autopilot = true } = {}) {
  if (ALL[size].mobile) await b.tap(ALL[size].width / 2, ALL[size].height * 0.45)
  else await b.key('Enter')
  for (let i = 0; i < 80 && !(await b.eval(`!!${V}`)); i++) await b.sleep(100)
  if (!(await b.eval(`!!${V}`))) throw new Error('the debug hook never appeared')
  await b.eval(`${V}.step(0); ${V}.seed(${SEED}); ${V}.autopilot(${autopilot}); 0`)
}
const step = (b, n) => b.eval(`${V}.step(${n}); 0`)
/** Step until `cond` (an expression over `s`, the hook's state) holds, at most `max` ticks. */
async function until(b, cond, max = 1200, chunk = 10) {
  for (let t = 0; t < max; t += chunk) {
    if (await b.eval(`(() => { const s = ${V}.state(); return !!(${cond}) })()`)) return true
    await step(b, chunk)
  }
  return false
}
/** Wait for every bitmap asked for so far, then draw the frame again. */
async function settle(b) {
  for (let i = 0; i < 40; i++) {
    await step(b, 0)
    if ((await b.eval(`${V}.state().sprites.loading.length`)) === 0) break
    await b.sleep(100)
  }
  await step(b, 0)
  await b.sleep(120)
}

const sector = n => async (b, size) => {
  await begin(b, size)
  await b.eval(`${V}.sector(${n}); 0`)
  await step(b, 620)
}
const boss = (n, id, ticks = 520) => async (b, size) => {
  await begin(b, size)
  await b.eval(`${V}.sector(${n}); ${V}.step(2); ${V}.give('disc', 3); ${V}.boss('${id}'); 0`)
  await step(b, ticks)
}
/** A boss with the engine's boxes drawn over it (the lab's switch), repeating one attack, stopped while that attack shows. */
const boxes = (n, id, force, ticks = 330) => async (b, size) => {
  await begin(b, size)
  await b.eval(`${V}.sector(${n}); ${V}.step(2); ${V}.boss('${id}'); ${V}.boxes(true); ${V}.world().boss.force = '${force}'; 0`)
  await step(b, ticks)
}

// name → what to do before the picture. Each runs at both sizes unless `sizes` says otherwise.
const SCENES = {
  // The title's hint blinks: `still` asks for reduced motion so that it is in the picture.
  title: { still: true, run: async () => {} },
  'sector-1': { run: sector(1) },
  'sector-2': { run: sector(2) },
  'sector-3': { run: sector(3) },
  'sector-4': { run: sector(4) },
  'sector-5': { run: sector(5) },
  card: { run: async (b, size) => { await begin(b, size); await step(b, 60) } },
  monitor: { run: async (b, size) => { await begin(b, size); await step(b, 330) } },
  capture: {
    run: async (b, size) => {
      await begin(b, size, { autopilot: false })
      await b.eval(`${V}.wave(1); 0`)
      await step(b, 260)
      await b.eval(`${V}.capture(); 0`)
      await until(b, `s.partner === 'beamed'`, 900, 5)
      await step(b, 14)
    },
  },
  hanging: {
    run: async (b, size) => {
      await begin(b, size, { autopilot: false })
      await b.eval(`${V}.wave(1); 0`)
      await step(b, 260)
      await b.eval(`${V}.capture(); 0`)
      await until(b, `s.partner === 'hanging'`, 1200, 5)
      await step(b, 60)
    },
  },
  dock: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.wave(2); 0`)
      await step(b, 300)
      await b.eval(`${V}.dock(); 0`)
      await until(b, `s.partner === 'docked'`, 400, 5)
      await step(b, 40)
    },
  },
  duet: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(2); ${V}.step(2); ${V}.wave(3); 0`)
      await step(b, 420)
      await b.eval(`${V}.duet(); 0`)
      await step(b, 50)
    },
  },
  convoy: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.wave(3); 0`)
      await step(b, 900)
    },
  },
  'convoy-3': {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(2); ${V}.step(2); ${V}.wave(3); 0`)
      await step(b, 1300)
    },
  },
  rescue: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(3); ${V}.step(2); ${V}.wave(3); 0`)
      await until(b, `s.wing === 'stalled' && ${V}.world().wing.bar > 0.3`, 2400, 10)
    },
  },
  wing: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(4); ${V}.step(2); ${V}.wave(3); 0`)
      await until(b, `s.wing === 'flying'`, 3000, 10)
      await step(b, 200)
    },
  },
  bonus: { run: async (b, size) => { await begin(b, size); await b.eval(`${V}.wave('bonus'); 0`); await step(b, 300) } },
  tracking: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(3); ${V}.step(2); ${V}.wave(2); 0`)
      await step(b, 420)
      await b.eval(`${V}.give('tracking'); ${V}.give('hairspray'); ${V}.give('bubble'); ${V}.give('magnet'); ${V}.give('quarter'); 0`)
      await step(b, 70)
    },
  },
  cb: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.wave(2); 0`)
      await step(b, 360)
      await b.eval(`${V}.give('cb'); ${V}.give('boombox', 4); 0`)
      await step(b, 75)
    },
  },
  'boss-knight': { run: boss(1, 'knight') },
  'boss-humdinger': { run: boss(2, 'humdinger') },
  'boss-durant': { run: boss(3, 'durant') },
  'boss-cal': { run: boss(4, 'cal', 700) },
  'boss-fader': { run: boss(5, 'fader') },
  'boss-deafstar': { run: boss(5, 'deafstar', 600) },
  // Each boss with its body box, weak spot, the point its shots leave from and the line its columns begin on.
  'boxes-knight': { run: boxes(1, 'knight', 'rays', 300) },
  'boxes-knight-glint': { run: boxes(1, 'knight', 'glint', 300) },
  'boxes-humdinger': { run: boxes(2, 'humdinger', 'mines', 330) },
  'boxes-humdinger-ram': { run: boxes(2, 'humdinger', 'ram', 300) },
  'boxes-humdinger-hogs': { run: boxes(2, 'humdinger', 'hogs', 290) },
  'boxes-durant': { run: boxes(3, 'durant', 'notes', 330) },
  'boxes-durant-chord': { run: boxes(3, 'durant', 'chord', 300) },
  'boxes-cal': { run: boxes(4, 'cal', 'eye', 560) },
  'boxes-fader': { run: boxes(5, 'fader', 'choke', 300) },
  'boxes-fader-sliders': { run: boxes(5, 'fader', 'sliders', 420) },
  'boxes-deafstar': { run: boxes(5, 'deafstar', 'rings', 330) },
  'boxes-deafstar-squeeze': { run: boxes(5, 'deafstar', 'squeeze', 330) },
  gameover: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(3); 0`)
      await step(b, 700)
      await b.eval(`${V}.quit(); 0`)
      await step(b, 120)
      await b.sleep(900)
    },
  },
  ending: { run: async (b, size) => { await begin(b, size); await b.eval(`${V}.ending(); 0`); await step(b, 200) } },
  // The partner hooks on: the field cleared, the cable, the TOW banner.
  tow: {
    run: async (b, size) => {
      await begin(b, size, { autopilot: false })
      await b.eval(`${V}.sector(2); ${V}.step(2); ${V}.wave(2); 0`)
      await step(b, 200)
      await b.eval(`${V}.hull(1); 0`)
      await until(b, `s.tows < 2`, 4000, 5)
      await step(b, 40)
      // The towed ship blinks: stop on a frame that shows it.
      await until(b, `s.tick % 8 === 1`, 8, 1)
    },
  },
  // GAME OVER after a finished voyage: the ending picture in the panel.
  'gameover-delivered': {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.ending(); 0`)
      await step(b, 900)
      await b.eval(`${V}.quit(); 0`)
      await step(b, 120)
      await b.sleep(900)
    },
  },
  'voyage-2': { run: async (b, size) => { await begin(b, size); await b.eval(`${V}.ending(); 0`); await step(b, 640) } },
  duo: {
    run: async (b, size) => {
      // Nobody shoots: he comes once the whole wave has formed up.
      await begin(b, size, { autopilot: false })
      await b.eval(`${V}.sector(2); ${V}.step(2); ${V}.wave(2); 0`)
      await until(b, `${V}.world().duo.active && ${V}.world().duo.x > 96`, 3000, 4)
    },
  },
  // The last fight with every friend made: a rig through the boss's guns, then a strafing run.
  'pass-rig': {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(5); ${V}.step(2); ${V}.world().friends.push('marge', 'duckie', 'babs', 'ridley', 'lena'); ${V}.give('disc', 4); ${V}.boss('fader'); 0`)
      await until(b, `${V}.world().rigs.some(r => r.active && r.job === 'pass' && r.y < s.height - 40)`, 9000, 5)
    },
  },
  'pass-strafe': {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(5); ${V}.step(2); ${V}.world().friends.push('babs', 'ridley', 'lena'); ${V}.give('disc', 4); ${V}.boss('fader'); 0`)
      await until(b, `${V}.world().pass.active && ${V}.world().pass.x > 70 && ${V}.world().pass.x < 170`, 9000, 3)
    },
  },
  'convoy-lost': {
    run: async (b, size) => {
      await begin(b, size, { autopilot: false })
      await b.eval(`${V}.wave(3); 0`)
      await until(b, `${V}.world().latched > 0`, 3000, 5)
      await b.eval(`${V}.world().convoy.cargo = 0.004; 0`)
      await step(b, 40)
    },
  },
  'rescue-lost': {
    run: async (b, size) => {
      await begin(b, size, { autopilot: false })
      await b.eval(`${V}.sector(3); ${V}.step(2); ${V}.wave(3); 0`)
      await until(b, `s.wing === 'stalled' && ${V}.world().latched > 1`, 4000, 5)
      await step(b, 120)
      await b.eval(`${V}.world().wing.y = 60; 0`)
      await until(b, `s.wing === 'off'`, 4000, 5)
      await step(b, 20)
    },
  },
  // Reduced motion in play: TRACKING without its tear, no shake, a still backdrop.
  reduced: {
    still: true, play: true,
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.reduced(true); ${V}.sector(3); ${V}.step(2); ${V}.wave(2); 0`)
      await step(b, 420)
      await b.eval(`${V}.give('tracking'); ${V}.give('hairspray'); 0`)
      await step(b, 70)
    },
  },
  // Several things popping in one tick: do the points stand clear of each other?
  words: {
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.sector(4); ${V}.step(2); ${V}.wave(2); 0`)
      await step(b, 400)
      await b.eval(`${V}.give('quarter'); ${V}.step(2); ${V}.give('mirrorball'); ${V}.step(1); ${V}.give('mirrorball'); 0`)
      await step(b, 14)
    },
  },
  // A phone turned in the middle of a run, and a window made smaller: the same field, whole, at a smaller scale, paused.
  turned: {
    sizes: ['phone', 'tall'],
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.wave(2); 0`)
      await step(b, 400)
      await b.eval(`${V}.run(); 0`)
      const z = ALL[size]
      await b.send('Emulation.setDeviceMetricsOverride', { width: z.height, height: z.width, deviceScaleFactor: z.dpr, mobile: true })
      await b.sleep(700)
      console.log('  turned:', await b.eval(`JSON.stringify((s => ({ paused: s.paused, height: s.height, scale: s.layout.scale, mode: s.layout.mode, field: s.layout.field, lh: s.layout.lh }))(${V}.state()))`))
    },
  },
  shrunk: {
    sizes: ['wide'],
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.wave(2); 0`)
      await step(b, 400)
      await b.send('Emulation.setDeviceMetricsOverride', { width: 700, height: 430, deviceScaleFactor: 1, mobile: false })
      await b.sleep(500)
      await step(b, 1)
      console.log('  shrunk:', await b.eval(`JSON.stringify((s => ({ paused: s.paused, height: s.height, scale: s.layout.scale, mode: s.layout.mode, field: s.layout.field, lh: s.layout.lh }))(${V}.state()))`))
    },
  },
  // Not this game's page: the Hall of Fame board under its new title, and the cabinet in the portal's arcade.
  board: { page: '/?theme=leaderboard', still: true, run: async b => { await b.sleep(1500) } },
  cabinet: {
    page: '/', still: true,
    run: async (b, size) => {
      await b.eval(`sessionStorage.setItem('portal.return', JSON.stringify({ map: 'arcade', entry: 'galaga' }))`)
      await b.goto(`${base}/`)
      await b.sleep(1500)
      if (ALL[size].mobile) await b.tap(ALL[size].width * 0.8, ALL[size].height * 0.5)
      else await b.key('Space')
      await b.sleep(1800)
    },
  },
  // The same game with no bitmap at all: every /galaga/*.png is refused.
  fallback: {
    block: true,
    run: async (b, size) => {
      await begin(b, size)
      await b.eval(`${V}.wave(3); 0`)
      await step(b, 700)
    },
  },
  'fallback-title': { block: true, still: true, run: async () => {} },
  // The layouts the two standard sizes do not reach.
  layouts: { sizes: ['tall', 'laptop', 'side'], run: async (b, size) => { await begin(b, size); await b.eval(`${V}.wave(2); 0`); await step(b, 420); await b.eval(`${V}.give('quarter'); ${V}.give('magnet'); 0`); await step(b, 30) } },
  'title-more': { sizes: ['tall', 'laptop', 'side', 'hd'], still: true, run: async () => {} },
}

const want = only ? only.split(',') : Object.keys(SCENES)
let failed = 0
for (const item of want) {
  const m = /^(.*)-(phone|wide)$/.exec(item)
  const name = m && SCENES[m[1]] ? m[1] : item
  const scene = SCENES[name]
  if (!scene) { console.error(`no scene "${item}" (have: ${Object.keys(SCENES).join(', ')})`); failed++; continue }
  for (const size of m && SCENES[m[1]] ? [m[2]] : scene.sizes ?? Object.keys(SIZES)) {
    const b = await launch(ALL[size])
    try {
      if (scene.still) await b.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
      if (scene.block) { await b.send('Network.enable'); await b.send('Network.setBlockedURLs', { urls: ['*/galaga/*.png'] }) }
      await b.goto(`${base}${scene.page ?? '/?theme=galaga&debug=galaga'}`)
      await b.sleep(600)
      await scene.run(b, size)
      if (!scene.still || scene.play) await settle(b)
      const file = join(out, `${name}-${size}.png`)
      await b.shot(file)
      const state = scene.still && !scene.play ? null : await b.eval(`JSON.stringify((s => ({ tick: s.tick, stage: s.stage, sector: s.sector, wave: s.wave, score: s.score, hull: s.hull, partner: s.partner, wing: s.wing, boss: s.boss && s.boss.id, mode: s.layout.mode, scale: s.layout.scale, field: s.layout.field, missing: s.sprites.missing }))(${V}.state()))`)
      console.log(`${name}-${size}.png`, state ?? '')
      if (b.errors.length) { failed++; console.log('  errors:', b.errors.slice(0, 4)) }
    } catch (err) {
      failed++
      console.log(`${name}-${size}: FAILED`, err.message)
    } finally {
      await b.close()
    }
  }
}
process.exit(failed ? 1 : 0)
