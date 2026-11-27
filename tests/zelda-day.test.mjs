// Day and night after the Sun Prism (engine/day.ts, render/daylight.ts): the
// clock and its save, the woods' foes by the hour (none at noon, twice as many
// at midnight, never popping up in sight) and the light moving smoothly. A save
// from before the clock is in `zelda-old-saves.test.mjs`.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from './zelda-load.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

let Z
let L
before(async () => {
  Z = await load()
  const out = esbuild.buildSync({
    stdin: { contents: `export { dayLook } from './render/daylight'; export { resolveParams } from './viewParams'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  L = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const NO = () => ({ ...Z.NO_INPUT, move: { x: 0, y: 0 } })
const live = s => s.map.enemies.filter(e => !e.dead)

/** A won game standing at `entry` of `map`. */
function won(map, entry, prism = true) {
  const s = Z.createGame(Z.WORLD, { seed: 4, at: { map, entry } })
  Object.assign(s.inv, { sword: true, prism })
  if (prism) Z.setDaytime(Z.WORLD, s, 0)
  for (let k = 0; k < 60 && s.hero.auto; k++) Z.stepGame(Z.WORLD, s, 1 / 60, NO())
  return s
}

describe('the clock', () => {
  it('stands still before the prism; with it, runs, wraps after twelve minutes and is saved', () => {
    const s = won('wildwood', 'camp')
    Z.setDaytime(Z.WORLD, s, Z.DAY_LENGTH - 1)
    for (let k = 0; k < 120; k++) Z.stepGame(Z.WORLD, s, 1 / 60, NO())
    assert.ok(s.daytime > 0.9 && s.daytime < 1.1, `wrapped to ${s.daytime}`)
    assert.equal(Z.DAY_LENGTH, 720)
    const back = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))) })
    assert.equal(back.daytime, Math.round(s.daytime * 10) / 10)
    // Before the Prism: no clock, no night twins, no hour in the save.
    {
      const s = Z.createGame(Z.WORLD, { seed: 4, at: { map: 'wildwood', entry: 'camp' } })
      s.inv.sword = true
      const n = s.map.enemies.length
      for (let k = 0; k < 300; k++) Z.stepGame(Z.WORLD, s, 1 / 60, NO())
      assert.equal(s.daytime, null)
      assert.equal(s.map.enemies.length, n, 'no night twins')
      assert.ok(s.map.enemies.every(e => e.rank === undefined))
      assert.equal(Z.toSave(s).day, undefined)
    }
  })
})

describe('the woods by the hour', () => {
  it('hold the placed foes at dusk and dawn, twice as many at midnight and none at noon; dungeons are left be, and the fallen return', () => {
    assert.equal(Z.foeLevel(Z.HOURS.dusk), 1)
    assert.equal(Z.foeLevel(Z.HOURS.dawn), 1)
    assert.equal(Z.foeLevel(Z.HOURS.night), 2)
    assert.equal(Z.foeLevel(Z.HOURS.noon), 0)
    for (const [map, entry] of [['wildwood', 'camp'], ['overworld', 'glade']]) {
      const s = won(map, entry)
      const placed = s.map.enemies.filter(e => !e.id.endsWith(':night')).length
      Z.setDaytime(Z.WORLD, s, Z.HOURS.dusk)
      assert.equal(live(s).length, placed, `${map} at dusk`)
      Z.setDaytime(Z.WORLD, s, Z.HOURS.noon)
      assert.equal(live(s).length, 0, `${map} at noon`)
      Z.setDaytime(Z.WORLD, s, Z.HOURS.night)
      assert.ok(live(s).length > placed * 1.6, `${map} at midnight: ${live(s).length} of ${placed} placed`)
      Z.setDaytime(Z.WORLD, s, Z.HOURS.dawn)
      assert.equal(live(s).length, placed, `${map} at dawn`)
    }
    // A dungeon is left as it is, foes that carry keys with it.
    {
      const s = won('shrine', 'start')
      const n = s.map.enemies.length
      Z.setDaytime(Z.WORLD, s, Z.HOURS.noon)
      assert.equal(s.map.enemies.length, n)
      assert.ok(s.map.enemies.every(e => e.rank === undefined && !e.away))
    }
    // They leave in the morning out of sight, and one that was killed is back by evening.
    {
      const s = won('wildwood', 'camp')
      s.sight = { x: 13, y: 11 }
      Z.setDaytime(Z.WORLD, s, 450)
      const killed = live(s)[0]
      killed.hp = 0
      killed.dead = true
      for (let k = 0; k < 60 * 75; k++) {
        s.hero.invuln = 10
        Z.stepGame(Z.WORLD, s, 1 / 60, NO())
      }
      assert.ok(s.daytime > Z.DAY.noon)
      assert.equal(live(s).length, 0, 'the woods are empty at noon')
      Z.setDaytime(Z.WORLD, s, Z.HOURS.dusk)
      assert.ok(!killed.dead && killed.hp === killed.maxHp, 'the killed one is back by evening')
    }
  })

  // What a screen shows: a small phone in the classic view, and a desktop turned (the 16-bit view's diamond).
  const SIGHTS = [{ x: 13, y: 11 }, { x: 26, y: 16, turned: true }]
  /** On the screen as the player sees it (the camera on the hero, clamped in the classic view). */
  const visible = (s, v, x, y) => {
    if (v.turned) { const dx = x - s.hero.x; const dy = y - s.hero.y; return Math.abs(dx - dy) < v.x / 2 && Math.abs(dx + dy) < v.y }
    const cx = v.x >= s.map.w ? s.map.w / 2 : Math.max(v.x / 2, Math.min(s.map.w - v.x / 2, s.hero.x))
    const cy = v.y >= s.map.h ? s.map.h / 2 : Math.max(v.y / 2, Math.min(s.map.h - v.y / 2, s.hero.y))
    return Math.abs(x - cx) < v.x / 2 && Math.abs(y - cy) < v.y / 2
  }

  it('walk in from past the screen as the evening comes, never out of thin air', () => {
    for (const v of SIGHTS) {
      let walked = 0
      let came = 0
      for (const [map, entry] of [['wildwood', 'camp'], ['wildwood', 'deep'], ['overworld', 'woods'], ['overworld', 'graves'], ['overworld', 'glade']]) {
        const s = won(map, entry)
        s.sight = v
        Z.setDaytime(Z.WORLD, s, Z.DAY.noon + 50)
        const out = new Set(live(s).map(e => e.id))
        for (let k = 0; k < 60 * 140; k++) {
          s.hero.invuln = 10
          s.hero.hp = s.hero.maxHp
          Z.stepGame(Z.WORLD, s, 1 / 60, NO())
          for (const e of live(s)) {
            if (out.has(e.id)) continue
            out.add(e.id)
            came++
            assert.ok(!visible(s, v, e.x, e.y), `${e.id} appeared in sight at ${e.x.toFixed(1)},${e.y.toFixed(1)} (hero ${s.hero.x.toFixed(1)},${s.hero.y.toFixed(1)})`)
            if (e.trek) walked++
          }
        }
        assert.ok(s.daytime > Z.DAY.noonEnd + 60, 'evening came')
      }
      // Those whose home is on screen walk in; the rest are home before anyone sees them.
      assert.ok(walked > 0, `${v.x}×${v.y}: some walked in (${walked} of ${came})`)
    }
  })
})

describe('the light of the hour', () => {
  const base = () => {
    const p = L.resolveParams('iso')
    return {
      ambient: '#8e82c4', sunAngle: p.sunAngle, shadowLength: p.shadowLength, shadow: p.shadow,
      skyTop: p.skyTop, skyHorizon: p.skyHorizon, haze: p.hazeColor,
      nightLight: p.nightLight, dawnLight: p.dawnLight, noonLight: p.noonLight,
      nightSky: p.nightSky, nightHorizon: p.nightHorizon, dawnSky: p.dawnSky, dawnHorizon: p.dawnHorizon,
      noonSky: p.noonSky, noonHorizon: p.noonHorizon, noonBright: p.noonBright,
    }
  }

  it('moves the light smoothly, and swings the shadows round only where there are none', () => {
    const b = base()
    let prev = L.dayLook(0, b)
    for (let t = 0.5; t <= 720; t += 0.5) {
      const d = L.dayLook(t, b)
      const turn = Math.abs(((d.sunAngle - prev.sunAngle + 540) % 360) - 180)
      if (turn > 5) assert.ok(d.shadow < 0.1 && prev.shadow < 0.1, `a jump of ${turn.toFixed(0)}° at ${t} with shadows at ${d.shadow.toFixed(2)}`)
      assert.ok(Math.abs(d.shadow - prev.shadow) < 0.05, `shadow strength jumps at ${t}`)
      prev = d
    }
  })
})
