// The side view (docs/games/neon-shrine.md, "The side view"): two end-to-end tests, and no more (Petter, 2026-11-27).
// A scripted player plays the lab's trial room through, from its entry to the locked door standing open, and loads a
// save made there; and a scripted minute on the Shrine ends exactly as it did before the side view existed. The
// jump's numbers are measured by `scripts/zelda-lab/side-measure.mjs`, not pinned here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let Z
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export * from './engine/index'; export * from './types'; export { WORLD } from './world/index';
        export { validateWorld } from './world/validate'; export { SIDE_LAB } from '../../scripts/zelda-lab/side-trial'`,
      resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

// ---------------------------------------------------------------------------
// The player
// ---------------------------------------------------------------------------

function player(W, s) {
  const said = []
  const inp = (o = {}) => ({ ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o })
  const step = (o) => { said.push(...Z.stepGame(W, s, 1 / 60, inp(o))) }
  const feet = () => s.hero.y + Z.HERO_R
  const standing = () => s.mode === 'play' && !!s.hero.side?.ground && s.hero.act !== 'fall'
  const where = () => `at ${s.hero.x.toFixed(2)}, feet ${feet().toFixed(2)} (${s.mode}, ${s.hero.act}, ${s.hero.hp} hp)`
  const idle = (n) => { for (let i = 0; i < n; i++) step() }
  /** Through a find's pose and its words. */
  function read() {
    for (let i = 0; i < 600 && s.mode !== 'play'; i++) step(i % 12 === 0 ? { aPress: true } : {})
    assert.equal(s.mode, 'play', `the words never closed ${where()}`)
    idle(30)
  }
  /** Along the ground to x. */
  function walk(x) {
    for (let i = 0; i < 400; i++) {
      // (A find on the way: its pose and words come first, and the caller reads them.)
      if (s.mode !== 'play') return
      if (Math.abs(s.hero.x - x) < 0.07) { idle(1); return }
      step({ move: { x: Math.sign(x - s.hero.x), y: 0 } })
    }
    assert.fail(`never walked to ${x}: ${where()}`)
  }
  /** A held jump from here, steered to come down at x with the feet on row `row`. */
  function jump(x, row, what) {
    assert.ok(standing(), `not standing before ${what}: ${where()}`)
    const toward = () => {
      const v = s.hero.side.vx
      const d = x - (s.hero.x + (v * Math.abs(v)) / (2 * Z.SIDE.airAccel))
      return Math.abs(d) < 0.08 ? 0 : Math.sign(d)
    }
    step({ move: { x: toward(), y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
    assert.ok(s.hero.side.vy < 0 && !s.hero.side.ground, `no jump: ${what}, ${where()}`)
    for (let i = 0; i < 150 && !standing(); i++) {
      step({ move: { x: toward(), y: 0 }, jumpHeld: true })
      // The jump is not the HOP: nothing of its mercy comes along.
      assert.notEqual(s.hero.act, 'air')
    }
    assert.ok(standing(), `never landed: ${what}, ${where()}`)
    assert.ok(Math.abs(feet() - row) < 0.01, `${what}: feet on ${feet().toFixed(3)}, wanted ${row}, ${where()}`)
    assert.ok(Math.abs(s.hero.x - x) < 0.7, `${what}: came down ${where()}, wanted x ${x}`)
  }
  /** Fell the foe with the blade: close in on its row, cut toward it. Returns the chain's hits that were thrown. */
  function chain(e) {
    const hits = new Set()
    for (let i = 0; i < 1200 && !e.dead; i++) {
      if (s.mode !== 'play') { read(); continue }
      const dx = e.x - s.hero.x
      const level = Math.abs(e.y - s.hero.y) < 0.7
      const way = Math.sign(dx) || 1
      if (level && Math.abs(dx) < 1.45) step(i % 6 === 0 ? { move: { x: way * 0.5, y: 0 }, aPress: true, a: true } : {})
      else step({ move: { x: Math.abs(dx) > 1.2 ? way : 0, y: 0 } })
      if (s.hero.swing) hits.add(s.hero.swing.n)
    }
    assert.ok(e.dead, `the ${e.kind} stands (hp ${e.hp}, at ${e.x.toFixed(2)},${e.y.toFixed(2)}): ${where()}`)
    idle(30)
    return hits
  }
  return { said, inp, step, idle, read, walk, jump, chain, feet, standing, where }
}

// ---------------------------------------------------------------------------
// 1. The trial room, played through
// ---------------------------------------------------------------------------

describe('the side view', () => {
  it('plays the trial room from its entry to the open door, and a save made there loads there', () => {
    // (A yard of its own to start the world in, so that a save which forgot the trial room would show.)
    const yard = { id: 'yard', name: 'YARD', kind: 'interior', track: 'indoor', rows: ['#####', '#.@.#', '#####'], marks: { '@': { ent: { t: 'entry', id: 'a' } } } }
    const W = { maps: { ...Z.SIDE_LAB.maps, yard }, start: { map: 'yard', entry: 'a' } }
    assert.deepEqual(Z.validateWorld(W), [])
    const s = Z.createGame(W, { seed: 4, at: { map: 'sidetrial', entry: 'start' } })
    Z.grant(s, 'sword')
    s.hero.maxHp = s.hero.hp = 20
    const P = player(W, s)
    const { step, idle, read, walk, jump, chain, feet, standing, where } = P
    const foe = kind => s.map.enemies.find(e => e.kind === kind)
    const R = Z.HERO_R

    idle(40)
    assert.ok(standing() && Math.abs(feet() - 33) < 0.01, `the hero falls to the floor: ${where()}`)
    assert.ok(Math.abs(foe('sentry').y + foe('sentry').r - 27) < 0.01, 'the sentry stands on its platform')
    assert.ok(Math.abs(foe('blob').y + foe('blob').r - 33) < 0.01, 'the blob stands on the floor')

    // A roll toward the gap, the stick let go, stops at the edge.
    walk(3.6)
    step({ move: { x: 1, y: 0 } })
    step({ rollPress: true })
    assert.equal(s.hero.act, 'roll')
    idle(40)
    assert.ok(standing() && s.hero.x > 4.4 && Math.abs(feet() - 33) < 0.01, `the roll holds at the edge: ${where()}`)

    // The three tile gap, over the fall: once the blob across it rests well back from the far edge.
    walk(4.8)
    const rests = b => b.ai.mode === 'idle' && b.ai.t > 0.75 && b.x > 9.2
    for (let i = 0; i < 1800 && !rests(foe('blob')); i++) idle(1)
    jump(8.1, 33, 'the gap')
    assert.equal(s.hero.hp, s.hero.maxHp)

    chain(foe('blob'))

    // The three tile ledge, and the chest on it.
    walk(10.3)
    jump(12, 30, 'the ledge')
    walk(13.5)
    step({ move: { x: 1, y: 0 } })
    step({ aPress: true, a: true })
    read()
    assert.ok(Z.has(s, 'chest:sidetrial.bits'), `the chest opens: ${where()}`)

    // The sentry waits at its platform's end: up at it from the ledge, cutting, and the chain until it falls.
    const sentry = foe('sentry')
    const hits = new Set()
    const on = row => standing() && Math.abs(feet() - row) < 0.01
    for (let i = 0, held = false; i < 3000 && !sentry.dead; i++) {
      if (s.mode !== 'play') { read(); continue }
      const dx = sentry.x - s.hero.x
      const reach = Math.abs(sentry.y - s.hero.y) < 0.7 && Math.abs(dx) < 1.45
      const cut = reach && i % 5 === 0 ? { aPress: true, a: true } : {}
      if (on(27)) step({ move: { x: reach ? Math.sign(dx) * 0.5 * (cut.a ? 1 : 0) : Math.sign(dx), y: 0 }, ...cut })
      else if (on(30) && Math.abs(s.hero.x - 11.6) < 0.08) { held = true; step({ move: { x: -0.5, y: 0 }, bPress: true, jumpPress: true, jumpHeld: true }) }
      else if (on(30)) step({ move: { x: Math.sign(11.6 - s.hero.x), y: 0 } })
      else if (on(33)) { walk(10.3); jump(12, 30, 'back up to the ledge') }
      else step({ move: { x: s.hero.x > 10.4 ? -1 : cut.a ? Math.sign(dx) * 0.5 : 0, y: 0 }, jumpHeld: held, ...cut })
      if (s.hero.swing) hits.add(s.hero.swing.n)
    }
    assert.ok(sentry.dead, `the sentry stands (hp ${sentry.hp}, at ${sentry.x.toFixed(2)},${sentry.y.toFixed(2)}): ${where()}`)
    assert.deepEqual([...hits].sort(), [0, 1, 2], 'the chain of three cuts')
    idle(60)

    // Back to the ledge (off the platform's end, or already there), and the ladder up into the loft.
    for (let i = 0; i < 200 && !(on(30) && s.hero.x > 12.2); i++) step({ move: { x: 1, y: 0 } })
    assert.ok(on(30), `down on the ledge again: ${where()}`)
    walk(13.5)
    const heard = P.said.length
    step({ move: { x: 0, y: -1 }, jumpPress: true, jumpHeld: true })
    assert.ok(s.hero.side.ladder && !P.said.slice(heard).some(e => e.type === 'jump'), `up takes the ladder, it does not jump: ${where()}`)
    for (let i = 0; i < 400 && !(standing() && s.zoneIndex === 0); i++) step({ move: { x: 0, y: -1 }, jumpHeld: true })
    assert.equal(s.zoneIndex, 0, `into the loft: ${where()}`)
    assert.ok(Math.abs(feet() - 20) < 0.01, `on the ladder's top: ${where()}`)

    // Past the safe ledge's mark, then up the one-way platforms.
    walk(11.5)
    assert.deepEqual(s.hero.side.safe && [s.hero.side.safe.x, Math.round((s.hero.side.safe.y + R) * 100) / 100], [11.5, 20], 'the ledge mark is the way back')
    walk(10.4)
    jump(7.9, 17, 'the first platform')
    walk(6.4)
    jump(4.2, 14, 'the second platform')

    // A fall, on purpose, down through the platform: half a heart, and back on the safe ledge.
    s.hero.invuln = 0
    const hp = s.hero.hp
    for (let i = 0; i < 200 && s.hero.act !== 'fall'; i++) step({ move: { x: 0, y: 1 } })
    assert.equal(s.hero.act, 'fall', `off the bottom: ${where()}`)
    idle(60)
    assert.equal(s.hero.hp, hp - 1, 'half a heart poorer')
    assert.ok(standing() && Math.abs(s.hero.x - 11.5) < 0.05 && Math.abs(feet() - 20) < 0.01, `on the safe ledge: ${where()}`)
    assert.equal(Math.hypot(s.hero.vx, s.hero.vy), 0)
    assert.equal(s.zoneIndex, 0)
    idle(70)

    walk(10.4)
    jump(7.9, 17, 'the first platform again')
    walk(6.4)
    jump(4.2, 14, 'the second platform again')
    walk(4.6)
    jump(7, 11, 'the third platform')

    // The bat, cut overhead.
    const bat = foe('bat')
    let upward = false
    for (let i = 0; i < 1500 && !bat.dead; i++) {
      const dx = bat.x - s.hero.x
      const above = s.hero.y - bat.y
      const strike = Math.abs(dx) < 0.45 && above > 0.55 && above < 1.5 && !s.hero.swing
      step(strike ? { move: { x: 0, y: -1 }, aPress: true, a: true } : !standing() || Math.abs(s.hero.x - 7.2) < 0.15 ? {} : { move: { x: Math.sign(7.2 - s.hero.x), y: 0 } })
      if (bat.dead) upward = s.hero.swing?.dir === 'up'
    }
    assert.ok(bat.dead, `the bat flies on at ${bat.x.toFixed(2)},${bat.y.toFixed(2)}: ${where()}`)
    assert.ok(upward, 'it fell to a cut upward')
    idle(60)

    // Up to the key on its high ledge.
    walk(8.2)
    jump(9.8, 8, 'the fourth platform')
    walk(11.2)
    jump(13.4, 5, 'the key ledge')
    walk(14.4)
    idle(20)
    if (s.mode !== 'play') read()
    assert.equal(s.inv.keyrings.sidetrial, 1, `the key: ${where()}`)

    // Down and across to the locked door.
    walk(13.2)
    jump(10.4, 8, 'back down to the fourth platform')
    walk(9.2)
    jump(5.2, 8, 'across to the door')
    const door = () => [6, 7].map(y => s.map.tiles[y * s.map.w + 3]).join('')
    assert.equal(door(), 'LL')
    for (let i = 0; i < 120 && door() !== '..'; i++) step({ move: { x: -1, y: 0 } })
    assert.equal(door(), '..', `the door stands open: ${where()}`)
    assert.equal(s.inv.keyrings.sidetrial, 0)

    // A save made here loads here.
    const save = Z.parseSave(JSON.parse(JSON.stringify({ ...Z.toSave(s), savedAt: 1 })))
    const again = Z.createGame(W, { save })
    assert.equal(again.map.id, 'sidetrial')
    assert.deepEqual([6, 7].map(y => again.map.tiles[y * again.map.w + 3]), ['.', '.'])
    assert.ok(again.map.enemies.length === 0 && Z.has(again, 'chest:sidetrial.bits') && Z.has(again, 'took:sidetrial.key'))
    const Q = player(W, again)
    Q.idle(40)
    assert.ok(Q.standing() && Math.abs(Q.feet() - 33) < 0.01, `at the entry, on its floor: ${Q.where()}`)

    // A blow from the side shoves along the floor, and the hero stays on it.
    const x = again.hero.x
    Z.hurtHero(Z.ctx(W, again, []), 1, x - 0.5, again.hero.y - 0.4)
    Q.idle(20)
    assert.ok(again.hero.x > x + 0.6 && Math.abs(Q.feet() - 33) < 0.01, `shoved along the floor: ${Q.where()}`)
  })

  // -------------------------------------------------------------------------
  // 2. Nothing top-down has moved
  // -------------------------------------------------------------------------

  it('leaves a scripted minute on the Shrine ending as it did before', () => {
    const run = shrineMinute()
    // (The numbers first: they say what moved where the digest only says that something did. Recorded 2026-11-27
    // from the tree before the side view. A change to the Shrine, its foes or the blade means recording it again.)
    assert.deepEqual({ rooms: run.rooms, ...run.tally }, { rooms: 6, kills: 9, hurts: 13, hits: 26, scrolls: 6 })
    assert.equal(run.digest, '7f00ddea8316a6230b00556df9f259a790c70e1a2b8926b3ae1c1f1e0fcc4673')
  })
})

/** A minute on the Shrine by a bot with its own dice: six rooms with foes, ten seconds in each. */
function shrineMinute() {
  const W = Z.WORLD
  const s = Z.createGame(W, { seed: 7, at: { map: 'shrine', entry: 'start' } })
  for (const item of ['sword', 'disc', 'bombBag', 'hook', 'artHop']) Z.grant(s, item)
  s.hero.maxHp = s.hero.hp = 20
  let dice = 11
  const roll = () => { dice = (Math.imul(dice, 1103515245) + 12345) >>> 0; return (dice >>> 8) / 16777216 }
  const info = Z.mapInfo(W, 'shrine')
  const rooms = [...new Set(info.marks.filter(m => m.ent.t === 'enemy').map(m => Z.cellIndex(info, m.x + 0.5, m.y + 0.5)))].sort((a, b) => a - b).slice(0, 6)
  const round = v => Math.round(v * 1e6) / 1e6
  const seen = []
  const tally = { kills: 0, hurts: 0, hits: 0, scrolls: 0 }
  const snap = () => ({
    mode: s.mode, map: s.map.id, zone: s.zoneIndex, rng: s.rng,
    hero: [round(s.hero.x), round(s.hero.y), s.hero.hp, s.hero.dir, s.hero.act],
    inv: [s.inv.bits, s.inv.bombs, s.inv.keys, s.inv.selected],
    flags: Object.keys(s.flags).sort(),
    foes: s.map.enemies.map(e => [e.id, round(e.x), round(e.y), e.hp, e.dead, e.ai.mode]),
    tiles: s.map.tiles.join(''),
  })
  let move = { x: 0, y: 0 }
  let hold = 0
  for (let f = 0; f < 3600; f++) {
    if (f % 600 === 0) {
      const room = rooms[(f / 600) % rooms.length]
      const r = Z.cellRect(info, room)
      // The free tile nearest the room's middle.
      let best = null
      for (let y = r.y + 1; y < r.y + r.h - 1; y++) for (let x = r.x + 1; x < r.x + r.w - 1; x++) {
        if (Z.circleBlocked(W, s.map, x + 0.5, y + 0.5, Z.HERO_R) || s.map.tiles[y * s.map.w + x] !== '.') continue
        const d = Math.hypot(x - r.x - r.w / 2, y - r.y - r.h / 2)
        if (!best || d < best.d) best = { x: x + 0.5, y: y + 0.5, d }
      }
      if (best) { s.hero.x = best.x; s.hero.y = best.y }
    }
    const input = { move, a: hold > 0, aPress: false, bPress: false, cycle: false, autoFace: false }
    if (s.mode === 'dialog') input.aPress = f % 20 === 0
    else if (f % 10 === 0) {
      const foes = s.map.enemies.filter(e => !e.dead && e.cell === s.zoneIndex)
      foes.sort((a, b) => Math.hypot(a.x - s.hero.x, a.y - s.hero.y) - Math.hypot(b.x - s.hero.x, b.y - s.hero.y))
      const e = foes[0]
      const k = roll()
      if (e && k < 0.65) { const d = Math.hypot(e.x - s.hero.x, e.y - s.hero.y) || 1; move = { x: (e.x - s.hero.x) / d, y: (e.y - s.hero.y) / d } }
      else if (k < 0.9) { const a = roll() * Math.PI * 2; move = { x: Math.cos(a), y: Math.sin(a) } }
      else move = { x: 0, y: 0 }
      input.move = move
      if (roll() < 0.5) { input.aPress = true; input.a = true; hold = roll() < 0.12 ? 80 : 4 }
      if (roll() < 0.1) input.bPress = true
      if (roll() < 0.12) input.rollPress = true
      if (roll() < 0.05) input.cycle = true
    }
    if (hold > 0) hold--
    if (s.hero.hp <= 4) s.hero.hp = s.hero.maxHp
    for (const ev of Z.stepGame(W, s, 1 / 60, input)) {
      if (ev.type === 'kill') tally.kills++
      else if (ev.type === 'hurt' || ev.type === 'shock') tally.hurts++
      else if (ev.type === 'hit') tally.hits++
      else if (ev.type === 'scroll') tally.scrolls++
    }
    if (f % 600 === 599) seen.push(snap())
  }
  return { rooms: rooms.length, tally, digest: createHash('sha256').update(JSON.stringify(seen)).digest('hex') }
}
