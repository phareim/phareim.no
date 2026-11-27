// Neon Shrine's physical puzzles (engine/puzzles/, docs/games/neon-shrine-puzzles.md): the rules met by a scripted
// hero on small fixture rooms (ice, beams, weights, rolling stones, sluices, a blow that knocks a foe in), a kit
// stamped into a map, the Puzzle Lab played through, and the older maps left alone.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const DIR = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

/** A one-room world from rows (`@` is where the hero starts, facing up), with extra marks. */
function room(rows, marks = {}, extra = {}) {
  const def = { id: 't', name: 'T', kind: 'dungeon', track: 'dungeon', rows, marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'up' } }, ...marks }, ...extra }
  const world = { maps: { t: def }, start: { map: 't', entry: 'start' } }
  const s = Z.createGame(world, { seed: 3 })
  s.inv.sword = true
  return { world, s }
}
const step = (w, s, i = inp(), n = 1) => { const ev = []; for (let k = 0; k < n; k++) ev.push(...Z.stepGame(w.world ?? w, s, 1 / 60, i)); return ev }
const at = s => [Math.floor(s.hero.x), Math.floor(s.hero.y)]
const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]
/** Hold a way until the hero has stopped moving (a slide ends, a push is done). */
function hold(w, s, dir, frames = 90, until = () => false) {
  for (let k = 0; k < frames && !until(); k++) { s.hero.invuln = 1; step(w, s, inp({ move: DIR[dir] })) }
  for (let k = 0; k < 45; k++) step(w, s)
}
/** Face a way and press A (talks, lifts, turns a mirror or valve, throws a lever). */
function pressA(w, s, dir) {
  if (dir) s.hero.dir = dir
  step(w, s, inp({ aPress: true, a: true }))
  for (let k = 0; k < 600 && s.mode !== 'play'; k++) step(w, s, s.mode === 'dialog' && k % 20 === 19 ? inp({ aPress: true, a: true }) : inp())
  step(w, s, inp(), 20)
}
const put = (s, x, y) => { s.hero.x = x + 0.5; s.hero.y = y + 0.5 }

describe('ice', () => {
  it('slides the hero, a pushed block (by hand or a bomb) and a thrown pot until something stops them', () => {
    const w = room([
      '#######',
      '#.....#',
      '#αααα.#',
      '#αααα.#',
      '#@αααα.',
      '#######',
    ])
    for (let k = 0; k < 15; k++) step(w, w.s, inp({ move: DIR.right }))
    assert.equal(w.s.map.phys.slide?.dx, 1, 'sliding east')
    hold(w, w.s, 'up', 1)
    // The stick does not steer a slide: he goes on east to the ground past the ice.
    assert.deepEqual(at(w.s), [6, 4])
    hold(w, w.s, 'left', 10)
    // Back west over the ice to the wall.
    assert.deepEqual(at(w.s), [1, 4])
    hold(w, w.s, 'up', 60)
    assert.deepEqual(at(w.s), [1, 1], 'up the ice to the floor beyond')
    // A pushed block slides on, a thrown pot slides and breaks on the wall.
    {
      const w = room([
        '#########',
        '#.......#',
        '#@bααααα#',
        '#.......#',
        '#..o....#',
        '#..ααααα#',
        '#########',
      ])
      hold(w, w.s, 'right', 60)
      assert.equal(tile(w.s, 7, 2), 'b', 'slid to the far wall')
      assert.equal(tile(w.s, 2, 2), '.', 'the floor under it is back')
      // A pot thrown onto the ice keeps going.
      put(w.s, 3, 3)
      pressA(w, w.s, 'down')
      assert.equal(w.s.hero.carry, 'pot')
      put(w.s, 2, 5); w.s.hero.dir = 'right'
      step(w, w.s, inp({ aPress: true, a: true }))
      let far = 0
      let broke = false
      for (let k = 0; k < 120; k++) {
        for (const e of step(w, w.s)) if (e.type === 'shatter') broke = true
        for (const o of w.s.map.thrown) far = Math.max(far, o.x)
      }
      assert.ok(far > 7.2, `the pot slid to ${far}`)
      assert.ok(broke)
    }
    // A bomb shoves a block beside it, and on ice it slides.
    {
      const w = room([
        '#########',
        '#.......#',
        '#..bαααα#',
        '#.......#',
        '#@......#',
        '#########',
      ])
      w.s.map.bombs.push({ id: 99, x: 2.5, y: 2.5, t: 1.69 })
      step(w, w.s, inp(), 40)
      assert.equal(tile(w.s, 7, 2), 'b')
    }
  })

  it('neither the roll nor the swing\'s lunge moves him on ice: only a slide does (2026-11-25)', () => {
    const w = room([
      '#########',
      '#@......#',
      '#ααααααα#',
      '#ααααααα#',
      '#ααααααα#',
      '#ααααααα#',
      '#.......#',
      '#########',
    ])
    put(w.s, 4, 4)
    w.s.hero.dir = 'right'
    w.s.hero.aim = 0
    const x0 = w.s.hero.x
    const y0 = w.s.hero.y
    // The roll, from rest (the stick at rest: the roll would go the way he faces), any way: no roll at all.
    for (const [dir, aim] of [['right', 0], ['down', Math.PI / 4], ['up', -Math.PI / 2]]) {
      w.s.hero.dir = dir
      w.s.hero.aim = aim
      const ev = step(w, w.s, inp({ rollPress: true }))
      ev.push(...step(w, w.s, inp(), 30))
      assert.ok(!ev.some(e => e.type === 'roll'), `rolled on ice (${dir})`)
    }
    w.s.hero.dir = 'right'
    w.s.hero.aim = 0
    // A chain of swings with the stick at rest: they land, but in place.
    let swings = 0
    for (let k = 0; k < 6; k++) {
      swings += step(w, w.s, inp({ aPress: true, a: true })).filter(e => e.type === 'swing').length
      step(w, w.s, inp(), 12)
    }
    assert.ok(swings >= 4, `${swings} swings`)
    assert.ok(Math.abs(w.s.hero.x - x0) < 1e-9 && Math.abs(w.s.hero.y - y0) < 1e-9, `moved to (${w.s.hero.x.toFixed(2)}, ${w.s.hero.y.toFixed(2)})`)
    assert.equal(w.s.map.phys.slide ?? null, null)
    // A roll from the floor onto the ice ends at its edge.
    put(w.s, 4, 1)
    w.s.hero.rollCool = 0
    const ev = step(w, w.s, inp({ rollPress: true, move: { x: 0, y: 1 } }))
    ev.push(...step(w, w.s, inp(), 30))
    assert.ok(ev.some(e => e.type === 'roll'), 'no roll on the floor')
    assert.deepEqual(at(w.s), [4, 2], 'rolled on over the ice')
  })
})

describe('beams and weights', () => {
  it('split by a prism, stopped by a pushed block, latch what they lit, and burn a foe they cross', () => {
    const w = room([
      '#########',
      '#...E...#',
      '#.@b....#',
      '#A..π..B#',
      '#.......#',
      '#########',
    ], {
      E: { ent: { t: 'emitter', dir: 'down' } },
      A: { ent: { t: 'receiver', flag: 'a' } },
      B: { ent: { t: 'receiver', flag: 'b' } },
    })
    step(w, w.s)
    assert.ok(w.s.flags.a && w.s.flags.b, 'both arms lit')
    assert.equal(w.s.map.phys.lit.length, 2)
    // A block pushed into the beam's way stops it, but what was lit stays solved.
    hold(w, w.s, 'right', 40)
    assert.equal(tile(w.s, 4, 2), 'b')
    assert.equal(w.s.map.phys.lit.length, 0)
    assert.ok(w.s.flags.a && w.s.flags.b)
    // A beam burns the foe it crosses.
    {
      const w = room([
        '#######',
        '#E....#',
        '#.....#',
        '#..m..#',
        '#.....#',
        '#..@..#',
        '#######',
      ], { E: { ent: { t: 'emitter', dir: 'down' } }, m: { ent: { t: 'enemy', kind: 'blob' } } })
      const blob = w.s.map.enemies[0]
      blob.x = 1.5; blob.y = 3.5
      blob.ai.mode = 'wait'; blob.ai.t = 99
      step(w, w.s, inp(), 30)
      assert.ok(blob.dead, 'the blob burned')
    }
  })

  const plates = () => room([
    '##########',
    '#.H..o...#',
    '#.....b..#',
    '#.s..s...#',
    '#....@...#',
    '##########',
  ], {
    H: { ent: { t: 'plate', id: 'heavy' }, tile: 'η' },
    s: { ent: { t: 'plate', id: 'scale' }, tile: 'σ' },
  })

  it('press a heavy plate and a scale only with weight enough: a pot in his arms, a block, equal pans', () => {
    const w = plates()
    put(w.s, 2, 1)
    step(w, w.s, inp(), 2)
    assert.equal(Z.weightOn(Z.ctx(w.world, w.s, []), 1 * 10 + 2), 1)
    assert.ok(!w.s.map.plates.includes('heavy'))
    put(w.s, 5, 2)
    pressA(w, w.s, 'up')
    assert.equal(w.s.hero.carry, 'pot')
    put(w.s, 2, 1)
    const ev = step(w, w.s, inp(), 2)
    assert.ok(w.s.map.plates.includes('heavy'))
    assert.ok(ev.some(e => e.type === 'plate'))
    // A scale is down only while its pans carry equal weight.
    {
      const w = plates()
      // The block onto the east pan: 2 against nothing.
      put(w.s, 6, 1)
      hold(w, w.s, 'down', 40)
      assert.equal(tile(w.s, 6, 3), 'b')
      hold(w, w.s, 'left', 3)
      put(w.s, 7, 3)
      hold(w, w.s, 'left', 40)
      assert.equal(tile(w.s, 5, 3), 'b')
      assert.ok(!w.s.map.plates.includes('scale'))
      // The hero alone on the west pan: 1 against 2.
      put(w.s, 2, 3)
      step(w, w.s, inp(), 2)
      assert.ok(!w.s.map.plates.includes('scale'))
      // With a pot in his arms: 2 against 2.
      put(w.s, 5, 2); w.s.map.tiles[1 * 10 + 5] = 'o'
      pressA(w, w.s, 'up')
      put(w.s, 2, 3)
      step(w, w.s, inp(), 2)
      assert.ok(w.s.map.plates.includes('scale'))
    }
    // A weighed plate without a marker presses as any other.
    {
      const w = room(['#####', '#.θ.#', '#.@.#', '#####'])
      const ev = step(w, w.s, inp({ move: DIR.up }), 30)
      assert.ok(w.s.map.plates.includes('w:7'))
      assert.ok(ev.some(e => e.type === 'plate' && e.x === 2.5 && e.y === 1.5))
    }
  })

  it('glow still with reduced motion', async () => {
    const esbuild = createRequire(import.meta.url)('esbuild')
    const render = fileURLToPath(new URL('../themes/zelda/render', import.meta.url))
    const out = esbuild.buildSync({ stdin: { contents: `export { drawBeams } from './puzzleTiles'`, resolveDir: render, loader: 'ts' }, bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error' })
    const { drawBeams } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
    const glow = (time, reduced) => {
      const alphas = []
      const g = { save() {}, restore() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { alphas.push(this.globalAlpha) } }
      drawBeams(g, { map: { phys: { beams: [{ x0: 1, y0: 1, x1: 1, y1: 5 }] } } }, (x, y) => ({ x, y }), time, reduced)
      return alphas[0]
    }
    assert.notEqual(glow(0.01, false), glow(0.06, false), 'it flickers')
    for (const t of [0.01, 0.06, 1.3]) assert.equal(glow(t, true), 1)
  })
})

describe('rolling stones and sluices', () => {
  const quarry = () => room([
    '###########',
    '#κ....m.%.#',
    '#.........#',
    '#..L......#',
    '#.....O...#',
    '#....@....#',
    '###########',
  ], {
    κ: { ent: { t: 'boulder', dir: 'right', flag: 'go' }, tile: 'κ' },
    L: { ent: { t: 'lever', flag: 'go' } },
    m: { ent: { t: 'enemy', kind: 'sentry' } },
  })

  it('roll when the lever is thrown: a foe crushed, a cracked wall broken, a pit filled, the hero thrown aside, all saved', () => {
    const q = quarry()
    const id = 'fr:1,2'
    const world = { maps: { [id]: { ...q.world.maps.t, id } }, start: { map: id, entry: 'start' } }
    const s = Z.createGame(world, { seed: 3 })
    const w = { world, s }
    // (On a map whose id has colons, as the old frontier's had: the flags still read.)
    const foe = s.map.enemies[0]
    foe.ai.mode = 'idle'; foe.stun = 99
    put(s, 3, 4)
    pressA(w, s, 'up')
    assert.ok(s.flags.go)
    step(w, s, inp(), 120)
    assert.ok(foe.dead, 'crushed')
    assert.equal(tile(s, 8, 1), '.', 'the cracked wall is broken')
    assert.equal(tile(s, 1, 1), '.')
    assert.equal(tile(s, 9, 1), 'κ')
    assert.ok(s.flags[`boulder:${id}:12:20`])
    // A second stone kicked north into the pit fills it.
    s.map.tiles[5 * 11 + 6] = 'κ'
    put(s, 2, 5)
    assert.ok(Z.startRoll(Z.ctx(world, s, []), 5 * 11 + 6, 0, -1))
    step(w, s, inp(), 30)
    assert.ok(s.flags[`fill:${id}:50`])
    const again = Z.createGame(world, { save: Z.toSave(s) })
    assert.equal(again.map.tiles[20], 'κ', 'the stone lies where it came to rest')
    assert.equal(again.map.tiles[12], '.', 'not back at home')
    assert.equal(again.map.tiles[50], '.', 'the pit stays filled')
    assert.equal(again.map.tiles[19], '.', 'and the wall stays broken')
    // The lever's flag is still set: the stone at rest does not roll again, from home or from where it lies.
    step({ world }, again, inp(), 60)
    assert.equal(again.map.tiles[20], 'κ')
    assert.equal(again.map.tiles[12], '.')
    assert.ok(again.flags[`boulder:${id}:12:20`])
    // A stone rolling at the hero hurts him and shoves him off its road.
    {
      const w = quarry()
      const c = Z.ctx(w.world, w.s, [])
      // A boulder rolling at the hero hurts and shoves him off its road.
      w.s.map.tiles[2 * 11 + 1] = 'κ'
      put(w.s, 5, 2)
      w.s.hero.invuln = 0
      const hp = w.s.hero.hp
      assert.ok(Z.startRoll(c, 2 * 11 + 1, 1, 0))
      step(w, w.s, inp(), 40)
      assert.equal(w.s.hero.hp, hp - 2)
      assert.notEqual(Math.floor(w.s.hero.y), 2, 'thrown off the row')
    }
  })

  const basin = () => room([
    '#########',
    '#.WWWW..#',
    '#.WWWWv.#',
    '#.AAAA..#',
    '#@......#',
    '#########',
  ], {
    W: { ent: { t: 'sluice', flag: 'tide' } },
    A: { ent: { t: 'sluice', flag: 'tide', invert: true } },
    v: { ent: { t: 'valve', flag: 'tide' } },
  })

  it('sluices drain one basin as the other floods: the water waits for the hero, drowns a foe, and is saved', () => {
    const w = basin()
    assert.equal(tile(w.s, 3, 1), 'ω')
    assert.equal(tile(w.s, 3, 3), 'ψ')
    put(w.s, 3, 3)
    put(w.s, 6, 3)
    pressA(w, w.s, 'up')
    assert.ok(w.s.flags.tide)
    assert.equal(tile(w.s, 3, 1), 'ψ', 'drained: floor')
    assert.equal(tile(w.s, 3, 3), 'ω', 'flooded')
    // Turn it back while standing in the drained basin's way: his tile stays dry until he leaves it.
    put(w.s, 5, 2)
    pressA(w, w.s, 'right')
    assert.ok(!w.s.flags.tide)
    assert.equal(tile(w.s, 5, 2), 'ψ')
    assert.equal(tile(w.s, 4, 2), 'ω')
    put(w.s, 7, 2)
    step(w, w.s, inp(), 2)
    assert.equal(tile(w.s, 5, 2), 'ω')
    // A save loads the basins as they were left.
    pressA(w, w.s, 'left')
    const again = Z.createGame(w.world, { save: Z.toSave(w.s) })
    assert.equal(again.map.tiles[1 * 9 + 3], 'ψ')
    assert.equal(again.map.tiles[3 * 9 + 3], 'ω')
    // Flooding drowns the foes that walk.
    {
      const w = basin()
      w.s.map.enemies.push({ id: 'x', kind: 'blob', x: 3.5, y: 3.5, r: 0.38, hp: 2, maxHp: 2, dir: 'down', cell: 0, invuln: 0, stun: 99, knock: null, ai: { mode: 'wait', t: 9, tell: 0 }, home: { x: 3.5, y: 3.5 }, dead: false, flash: 0 })
      put(w.s, 6, 3)
      pressA(w, w.s, 'up')
      assert.ok(w.s.map.enemies[0].dead)
    }
  })
})

describe('physical combat', () => {
  /** A bank over a pond: the hero swings south at a blob on the tile beside the water. */
  const bank = physics => room([
    '#######',
    '#.....#',
    '#.@...#',
    '#.m...#',
    '#.~~..#',
    '#.....#',
    '#######',
  ], { m: { ent: { t: 'enemy', kind: 'blob' } } }, physics ? { physics: true } : {})

  /** One press of A, facing the foe; it is held still until the blade lands. */
  function strike(w, e) {
    e.stun = 99
    w.s.hero.dir = 'down'
    w.s.hero.aim = Math.PI / 2
    step(w, w.s, inp({ aPress: true, a: true }))
    step(w, w.s, inp(), 40)
  }

  const pitRoom = physics => room([
    '#######',
    '#.....#',
    '#.mO..#',
    '#.@...#',
    '#.....#',
    '#######',
  ], { m: { ent: { t: 'enemy', kind: 'sentry' } } }, physics ? { physics: true } : {})

  it('knocks a foe into the water or a pit with a blow, on a fixture and on the Flats pond in Fogstage', () => {
    // The bank: one press of the blade, and it drowns.
    const w = bank(true)
    const e = w.s.map.enemies[0]
    strike(w, e)
    assert.ok(e.dead)
    assert.deepEqual([Math.floor(e.x), Math.floor(e.y)], [2, 4], 'in the water')
    // A pit.
    const p = pitRoom(true)
    const foe = p.s.map.enemies[0]
    foe.stun = 99
    Z.hitEnemy(Z.ctx(p.world, p.s, []), foe, 1, foe.x - 1, foe.y)
    step(p, p.s, inp(), 20)
    assert.ok(foe.dead, 'fell')
    // The shipped ponds: (the tile each stands on here is beside the water to its south).
    {
      const info = Z.mapInfo(Z.WORLD, 'fogstage')
      assert.ok(Z.puzzleInfo(info).physical)
      for (const [kind, x, y] of [['blob', 54, 41], ['skull', 29, 45]]) {
        const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'fogstage', entry: 'flats' } })
        s.inv.sword = true
        s.flags['realm:fogstage'] = true
        Z.enterMap(Z.WORLD, s, 'fogstage', 'flats', [])
        s.mode = 'play'
        s.dialog = null
        assert.equal(tile(s, x, y + 1), '~')
        const e = s.map.enemies.find(f => f.kind === kind)
        e.x = x + 0.5
        e.y = y + 0.5
        put(s, x, y - 1)
        s.hero.invuln = 2
        strike({ world: Z.WORLD, s }, e)
        assert.ok(e.dead, `the ${kind} drowned`)
        assert.equal(Math.floor(e.y), y + 1)
      }
    }
  })
})

describe('kits for the generator', () => {
  it('stamp into an ordinary map, which loads, validates, and plays by the kit\'s rules', () => {
    const base = {
      id: 'g', name: 'G', kind: 'dungeon', track: 'dungeon',
      rows: ['############', ...Array.from({ length: 8 }, () => '#..........#'), '############'],
      marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'up' } } },
    }
    base.rows[8] = '#....@.....#'
    let def = base
    const conds = []
    for (const [id, x, y] of [['beam-mirrors', 1, 1], ['sluice', 6, 4]]) {
      const r = Z.stampKit(def, Z.puzzleKits.find(k => k.id === id), x, y, `r1.${id}`)
      def = r.def
      conds.push(r.solved)
    }
    assert.deepEqual(conds, [{ flag: 'r1.beam-mirrors.lit' }, { plates: ['r1.sluice.goal'] }])
    const world = { maps: { g: def }, start: { map: 'g', entry: 'start' } }
    assert.deepEqual(Z.validateWorld(world), [])
    const s = Z.createGame(world, { seed: 1 })
    const p = Z.puzzleInfo(Z.mapInfo(world, 'g'))
    assert.ok(p.on)
    assert.equal(p.emitters.length, 1)
    assert.equal(p.sluices[0].flag, 'r1.sluice.drain')
    assert.equal(s.map.tiles[5 * 12 + 6], 'ω')
  })
})

describe('the Puzzle Lab', () => {
  /** BFS over the floor tiles of the room (no ice, no pits, no water), then steer there. */
  function walkTo(s, tx, ty, budget = 1500) {
    const m = s.map
    const ok = (x, y) => !Z.solidTile(Z.WORLD, m, x, y, 'hero') && !['O', 'α', 'x'].includes(m.tiles[y * m.w + x])
    const prev = new Map([[Math.floor(s.hero.y) * m.w + Math.floor(s.hero.x), -1]])
    const q = [Math.floor(s.hero.y) * m.w + Math.floor(s.hero.x)]
    for (let i = 0; i < q.length; i++) {
      const x = q[i] % m.w
      const y = Math.floor(q[i] / m.w)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + dy) * m.w + x + dx
        if (prev.has(j) || !ok(x + dx, y + dy)) continue
        prev.set(j, q[i])
        q.push(j)
      }
    }
    const goal = ty * m.w + tx
    assert.ok(prev.has(goal), `no floor path to ${tx},${ty} from ${at(s)}`)
    const route = []
    for (let j = goal; j !== -1; j = prev.get(j)) route.unshift(j)
    let i = 0
    for (let n = 0; n < budget; n++) {
      s.hero.hp = s.hero.maxHp
      s.hero.invuln = 1
      if (s.mode !== 'play') { step(Z.WORLD, s); continue }
      const h = s.hero
      const cur = Math.floor(h.y) * m.w + Math.floor(h.x)
      while (i < route.length - 1 && cur === route[i] && Math.hypot(h.x - (route[i] % m.w) - 0.5, h.y - Math.floor(route[i] / m.w) - 0.5) < 0.25) i++
      const gx = (route[i] % m.w) + 0.5
      const gy = Math.floor(route[i] / m.w) + 0.5
      if (cur === goal && Math.hypot(h.x - gx, h.y - gy) < 0.12) { step(Z.WORLD, s, inp(), 2); return }
      const d = Math.hypot(gx - h.x, gy - h.y) || 1
      step(Z.WORLD, s, inp({ move: { x: (gx - h.x) / d, y: (gy - h.y) / d } }))
    }
    assert.fail(`walkTo ${tx},${ty} timed out at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}`)
  }
  const W = { world: null }

  it('is played through by a scripted walk: weights, ice, beams, the stone, the sluices, all together, the chest', () => {
    W.world = Z.WORLD
    const s = Z.createGame(Z.WORLD, { seed: 9, at: { map: 'puzzlelab', entry: 'start' } })
    s.inv.sword = true
    const g = Z.WORLD
    // A: a pot carried onto the heavy plate.
    walkTo(s, 6, 17)
    pressA(g, s, 'up')
    assert.equal(s.hero.carry, 'pot')
    walkTo(s, 11, 17)
    assert.ok(s.flags['gate:puzzlelab.15,17'], 'A\'s gate is open')
    pressA(g, s, 'right') // put the pot down the hard way
    walkTo(s, 17, 17)
    assert.equal(s.zoneIndex, 4, 'in B')
    // B: the block up the ice, then east onto the plate.
    walkTo(s, 20, 20)
    hold(g, s, 'up', 60)
    assert.equal(tile(s, 20, 14), 'b', 'the block slid up to the stone')
    hold(g, s, 'left', 30)
    assert.deepEqual(at(s), [17, 15])
    walkTo(s, 17, 14)
    hold(g, s, 'right', 120, () => !!s.flags['gate:puzzlelab.31,17'])
    assert.equal(tile(s, 28, 14), 'b', 'on the heavy plate')
    assert.ok(s.flags['gate:puzzlelab.31,17'])
    hold(g, s, 'down', 40)
    walkTo(s, 33, 17)
    assert.equal(s.zoneIndex, 5, 'in C')
    // C: both mirrors turned toward the receivers.
    walkTo(s, 33, 17)
    pressA(g, s, 'up')
    walkTo(s, 46, 17)
    pressA(g, s, 'up')
    assert.ok(s.flags['lab.c.a'] && s.flags['lab.c.b'], 'both eyes lit')
    walkTo(s, 39, 11)
    assert.equal(s.zoneIndex, 2, 'in D')
    // D: the lever; the stone breaks the wall and fills the pit.
    walkTo(s, 42, 9)
    // A bomb beside the waiting stone does not kick it while the lever holds it.
    s.map.bombs.push({ id: 999, x: 43.5, y: 2.5, t: Z.BOMB_FUSE - 1 / 120 })
    s.hero.invuln = 99
    step(g, s, inp(), 60)
    assert.equal(tile(s, 44, 2), 'κ', 'the stone stays where the lever holds it')
    assert.ok(!Object.keys(s.flags).some(f => f.startsWith('boulder:puzzlelab:')), 'no rolled stone saved')
    pressA(g, s, 'up')
    step(g, s, inp(), 120)
    assert.equal(tile(s, 36, 2), '.')
    assert.equal(tile(s, 35, 2), '.')
    assert.ok(s.flags['fill:puzzlelab:131'], 'the filled pit is saved')
    walkTo(s, 33, 2)
    walkTo(s, 31, 2)
    assert.equal(s.zoneIndex, 1, 'in E')
    // E: the east valve drains the near basin (and floods the far one), the middle valve the other way round.
    walkTo(s, 29, 7)
    pressA(g, s, 'up')
    walkTo(s, 24, 8)
    pressA(g, s, 'left')
    walkTo(s, 17, 4)
    walkTo(s, 15, 5)
    assert.equal(s.zoneIndex, 0, 'in F')
    // F: the lever, the mirror up the ice and turned, the receiver, the gate, the chest.
    walkTo(s, 2, 3)
    pressA(g, s, 'up')
    step(g, s, inp(), 120)
    assert.equal(tile(s, 4, 3), '.', 'the stone broke the wall in the beam\'s road')
    walkTo(s, 10, 6)
    hold(g, s, 'up', 60)
    assert.equal(tile(s, 10, 3), 'μ', 'the mirror slid up into the beam')
    assert.deepEqual(at(s), [10, 4])
    pressA(g, s, 'up')
    assert.ok(s.flags['lab.f.lit'], 'the receiver is lit')
    hold(g, s, 'down', 30)
    walkTo(s, 13, 9)
    pressA(g, s, 'up')
    assert.ok(s.flags['chest:puzzlelab.prize'])
  })

  it('F: a stone that came to rest in the beam\'s road goes home when the hero comes back, and rolls again', () => {
    const s = Z.createGame(Z.WORLD, { seed: 9, at: { map: 'puzzlelab', entry: 'start' } })
    s.inv.sword = true
    const g = Z.WORLD
    s.zoneIndex = 0
    put(s, 13, 4)
    // The mirror pushed off the ice to (4,4), in the stone's road; then the lever.
    s.map.tiles[5 * s.map.w + 10] = 'α'
    s.map.tiles[4 * s.map.w + 4] = 'μ'
    s.flags['lab.f.roll'] = true
    step(g, s, inp(), 120)
    assert.equal(tile(s, 4, 3), 'κ', 'the stone rests in the beam\'s row')
    assert.ok(s.flags['boulder:puzzlelab:52:148'], 'and is saved there')
    // Out into E and back: the room is not solved, so its mirror and its stone go home and the lever lets it go again.
    walkTo(s, 17, 4)
    assert.equal(s.zoneIndex, 1, 'in E')
    walkTo(s, 13, 4)
    assert.equal(s.zoneIndex, 0, 'in F')
    step(g, s, inp(), 120)
    assert.equal(tile(s, 4, 3), '.', 'the beam\'s road is open')
    assert.equal(tile(s, 4, 10), 'κ', 'the stone rolled on to the wall')
    assert.equal(tile(s, 10, 5), 'μ', 'the mirror is home')
    assert.ok(s.flags['boulder:puzzlelab:52:484'])
    assert.ok(!s.flags['boulder:puzzlelab:52:148'])
    // The room plays as it was meant to: the mirror up the ice, turned, the receiver lit.
    walkTo(s, 10, 6)
    hold(g, s, 'up', 60)
    pressA(g, s, 'up')
    assert.ok(s.flags['lab.f.lit'], 'the receiver is lit')
  })
})

describe('the older maps', () => {
  it('have no puzzle tiles and no physics: every puzzle rule stays off there (on only in the Puzzle Lab and the puzzle lands)', () => {
    // The lands whose system is the physical puzzles (docs/worlds/atlas.md): Yule Fjord and Stillsand. Lumenby has
    // only lumen tubes (Relight the Sign): the rules run, its combat stays as it was.
    const PUZZLE_REALMS = new Set(['yulefjord', 'stillsand'])
    // (The maps as they stood when the rules came: a map built since brings what it needs.)
    const OLDER = ['overworld', 'shrine', 'hut', 'shop', 'cave', 'arcade', 'vip', 'home', 'wildwood', 'mossa', 'radio', 'lab1', 'lab1b', 'deep1', 'deep2', 'turnroom',
      'seterfell', 'fellcave', 'seacave', 'sporelight', 'sporeunder', 'makersbox', 'rerun', 'bombshelter', 'lumenby', 'unionhall', 'fogstage', 'understage', 'underglow1', 'underglow2', 'underglow3']
    for (const id of OLDER) {
      const def = Z.WORLD.maps[id]
      if (PUZZLE_REALMS.has(def.realm)) continue
      const p = Z.puzzleInfo(Z.mapInfo(Z.WORLD, id))
      assert.equal(p.on, id === 'lumenby', id)
      // Fogstage has no puzzle tiles, only its ponds to knock foes into (`MapDef.physics`).
      assert.equal(p.physical, id === 'fogstage', id)
      assert.equal(def.physics, id === 'fogstage' ? true : undefined, id)
    }
  })
})
