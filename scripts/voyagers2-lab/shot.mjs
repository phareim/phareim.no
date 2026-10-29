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

/** A clean campaign, straight from the hub into the first sortie, the clock held, the seed set. */
async function begin(b, size, seed = 7) {
  await campaign(b, size)
  await b.eval(`document.querySelector('.vg2-btn--gold').click()`)
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

/** Start a campaign from a clean browser and stand on its act card (or in the hub with `hub`). */
async function campaign(b, size, { hub = true, save = null } = {}) {
  await b.goto(`${base}/?theme=voyagers2&debug=voyagers2`)
  await b.eval(`(() => { localStorage.removeItem('voyagers2.save'); ${save ? `localStorage.setItem('voyagers2.save', ${JSON.stringify(JSON.stringify(save))});` : ''} return 1 })()`)
  await b.goto(`${base}/?theme=voyagers2&debug=voyagers2`)
  const press = async () => { if (SIZES[size].mobile) await b.tap(SIZES[size].width / 2, SIZES[size].height * 0.25); else await b.key('Enter') }
  await press()
  for (let i = 0; i < 60 && !(await b.eval(`!!document.querySelector('.vg2-act, .vg2-hub')`)); i++) await b.sleep(100)
  await b.sleep(500)
  if (hub && await b.eval(`!!document.querySelector('.vg2-act')`)) { await press(); await b.sleep(400) }
}

async function bigShip(b, size, sortie, kind, after) {
  const order = ['firstshift', 'convoy', 'siege', 'takeout', 'hansshot', 'dare', 'buffet', 'finale']
  const flown = order.slice(0, order.indexOf(sortie)).map(id => ({ id, result: 'won', score: 6000, kills: 10 }))
  await campaign(b, size, { save: { version: 1, pilot: 'nova', next: sortie, score: 40000, kills: 60, morale: 0.6, mood: 0.6, flags: {}, history: flown } })
  await b.eval(`document.querySelector('.vg2-btn--gold').click()`)
  for (let i = 0; i < 150 && !(await b.eval(`!!${V} && !!${V}.state()`)); i++) await b.sleep(100)
  await b.eval(`${V}.hold()`)
  await b.eval(`${V}.bot('sharp')`)
  await until(b, s => (s.kinds ?? []).includes(kind), 40000, 60)
  await step(b, after)
  // Look at it: the bot off, the nose turned to the big ship, a few ticks for the picture.
  await b.eval(`${V}.bot(null)`)
  await b.eval(`${V}.face('${kind === 'hut' ? 'vent' : kind}')`)
  await step(b, 3)
}

const SCENES = {
  async act(b, size) {
    await campaign(b, size, { hub: false })
  },
  async hub(b, size) {
    await campaign(b, size)
  },
  async talk(b, size) {
    await campaign(b, size)
    await b.eval(`document.querySelectorAll('.vg2-tab')[2].click()`)
    await b.sleep(200)
    await b.eval(`document.querySelectorAll('.vg2-person')[0].click()`)
    await b.sleep(300)
  },
  async debrief(b, size) {
    await campaign(b, size)
    await b.eval(`document.querySelector('.vg2-btn--gold').click()`)
    for (let i = 0; i < 150 && !(await b.eval(`!!${V} && !!${V}.state()`)); i++) await b.sleep(100)
    await b.eval(`${V}.end(true)`)
    await b.sleep(600)
  },
  /** The loop: launch the first sortie, end it won, read the debrief to its end, and stand in the hub for the second. PASS or FAIL. */
  async loop(b, size) {
    await campaign(b, size)
    await b.eval(`document.querySelector('.vg2-btn--gold').click()`)
    for (let i = 0; i < 150 && !(await b.eval(`!!${V} && !!${V}.state()`)); i++) await b.sleep(100)
    await b.eval(`${V}.end(true)`)
    await b.sleep(700)
    const debrief = await b.eval(`!!document.querySelector('.vg2-panel') && document.body.innerText.includes('SORTIE WON')`)
    for (let i = 0; i < 6 && !(await b.eval(`!!document.querySelector('.vg2-hub, .vg2-act')`)); i++) {
      await b.eval(`document.querySelector('.vg2-screen').click()`)
      await b.sleep(600)
    }
    const hub = await b.eval(`!!document.querySelector('.vg2-hub') && document.body.innerText.includes('CONVOY')`)
    const save = JSON.parse(await b.eval(`localStorage.getItem('voyagers2.save')`))
    const ok = debrief && hub && save?.next === 'convoy' && save.history.length === 1
    console.log(`${ok ? 'PASS' : 'FAIL'} loop ${size}: debrief ${debrief}, hub for CONVOY ${hub}, save next ${save?.next}, flown ${save?.history.length}`)
  },
  /**
   * The ending, on a dev server only (it calls the Hall of Fame; dev keeps scores in memory): a save at the finale,
   * the sortie ended won, the debrief read, the ending's card and the submit. PASS or FAIL.
   */
  async ending(b, size) {
    if (!/localhost|127\.0\.0\.1/.test(base)) { console.log('SKIP ending: not a dev server'); return }
    const flown = ['firstshift', 'convoy', 'siege', 'takeout', 'hansshot', 'dare', 'buffet'].map(id => ({ id, result: 'won', score: 7000, kills: 10 }))
    await campaign(b, size, { save: { version: 1, pilot: 'rex', next: 'finale', score: 49000, kills: 70, morale: 0.7, mood: 0.6, flags: {}, history: flown } })
    await b.eval(`document.querySelector('.vg2-btn--gold').click()`)
    for (let i = 0; i < 150 && !(await b.eval(`!!${V} && !!${V}.state()`)); i++) await b.sleep(100)
    await b.eval(`${V}.end(true)`)
    await b.sleep(700)
    for (let i = 0; i < 8 && !(await b.eval(`document.body.innerText.includes('CAMPAIGN SCORE')`)); i++) {
      await b.eval(`document.querySelector('.vg2-screen').click()`)
      await b.sleep(600)
    }
    await b.sleep(1500)
    const text = await b.eval(`document.body.innerText`)
    const save = JSON.parse(await b.eval(`localStorage.getItem('voyagers2.save')`))
    const card = await b.eval(`(() => { const el = document.querySelector('.vg2-ending'); return el ? getComputedStyle(el).backgroundImage : '' })()`)
    const ok = text.includes('DELIVERED') && save.next === 'end-won' && save.flags.submitted === true && /card-ending-won/.test(card) && !b.errors.length
    console.log(`${ok ? 'PASS' : 'FAIL'} ending ${size}: delivered ${text.includes('DELIVERED')}, next ${save.next}, submitted ${save.flags.submitted}, card ${/card-ending-won/.test(card)}, rank shown ${text.includes('WORLD RANK')}, errors ${b.errors.length}`)
  },
  /** A sortie with a big ship in it, flown by the bot until the big ship is in the fight: `hut` (the finale), `buffet`. */
  async hut(b, size) { await bigShip(b, size, 'finale', 'hut', 40) },
  async buffet(b, size) { await bigShip(b, size, 'buffet', 'buffet', 240) },
  /** Touch: the pause chip pauses, TURN BACK goes home to the hub, nothing recorded. PASS or FAIL. */
  async turnback(b, size) {
    if (!SIZES[size].mobile) return
    await begin(b, size)
    await b.eval(`${V}.run()`)
    await b.sleep(400)
    const s = await state(b)
    const l = s.layout
    await b.tap((l.pause.x + l.pause.w / 2) * l.css, (l.pause.y + l.pause.h / 2) * l.css)
    await b.sleep(300)
    await b.shot(join(out, `paused-${size}.png`))
    await b.tap((l.turnBack.x + l.turnBack.w / 2) * l.css, (l.turnBack.y + l.turnBack.h / 2) * l.css)
    await b.sleep(800)
    const hub = await b.eval(`!!document.querySelector('.vg2-hub')`)
    const save = JSON.parse(await b.eval(`localStorage.getItem('voyagers2.save')`))
    const ok = hub && save.history.length === 0 && save.next === 'firstshift'
    console.log(`${ok ? 'PASS' : 'FAIL'} turnback ${size}: hub ${hub}, flown ${save.history.length}, next ${save.next}`)
  },
  async strike(b, size) {
    await campaign(b, size, { save: { version: 1, pilot: 'nova', next: 'takeout', score: 12000, kills: 20, morale: 0.6, mood: 0.6, flags: {}, history: [{ id: 'firstshift', result: 'won', score: 6000, kills: 10 }, { id: 'convoy', result: 'won', score: 6000, kills: 10 }, { id: 'siege', result: 'won', score: 6000, kills: 10 }] } })
    await b.eval(`document.querySelector('.vg2-btn--gold').click()`)
    for (let i = 0; i < 150 && !(await b.eval(`!!${V} && !!${V}.state()`)); i++) await b.sleep(100)
    await b.eval(`${V}.hold()`)
    await b.eval(`${V}.bot('sharp')`)
    await until(b, s => s.stage === 'fly' && s.nav === 0 && s.enemies > 0, 30000, 60)
    await until(b, s => s.ships > 0 && s.me && s.me.target >= 0 && s.enemies <= 3, 20000, 60)
    await step(b, 120)
  },
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
  /**
   * A finger with a negative identifier (Safari hands those out) lands on the left of the view and
   * drags up: the stick must show, the nose must come up, and FIRE must fire. Prints PASS or FAIL.
   */
  async touch(b, size) {
    if (!SIZES[size].mobile) return
    await begin(b, size)
    await step(b, 200)
    const fwd = () => b.eval(`(() => { const w = ${V}.world(); const s = w.ships.find(x => x.id === w.player); const q = s.q; return JSON.stringify({ y: 2 * (q.w * q.x - q.y * q.z), shots: w.shots.filter(x => x.from === w.player).length }) })()`).then(JSON.parse)
    const before = await fwd()
    const x = SIZES[size].width * 0.25, y = SIZES[size].height * 0.45
    await b.touch('touchStart', [{ x, y, id: -7 }])
    await b.touch('touchMove', [{ x, y: y - 40, id: -7 }])
    await step(b, 40)
    const s = await state(b)
    const after = await fwd()
    const stickOk = s.stick !== null && s.input.pitch > 0.3
    const noseOk = after.y > before.y + 0.2
    // FIRE: the button's middle, from the layout, with a second negative finger.
    const l = s.layout
    const f = l.buttons.fire
    const fx = (f.x + f.w / 2) * l.css, fy = (f.y + f.h / 2) * l.css
    await b.touch('touchMove', [{ x, y: y - 40, id: -7 }, { x: fx, y: fy, id: -9 }])
    await b.touch('touchStart', [{ x, y: y - 40, id: -7 }, { x: fx, y: fy, id: -9 }])
    await step(b, 20)
    const fired = (await fwd()).shots > 0 || (await state(b)).input.fire
    await b.shot(join(out, `touch-held-${size}.png`))
    await b.touch('touchEnd', [])
    await step(b, 2)
    const released = (await state(b)).stick === null
    const ok = stickOk && noseOk && fired && released
    console.log(`${ok ? 'PASS' : 'FAIL'} touch ${size}: stick ${stickOk} (pitch ${s.input.pitch.toFixed(2)}), nose ${noseOk} (${before.y.toFixed(2)} -> ${after.y.toFixed(2)}), fire ${fired}, released ${released}`)
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
