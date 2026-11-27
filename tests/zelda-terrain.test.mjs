// Neon Shrine terrain (engine/terrain.ts, render/iso/terrain.ts): heights and ramps in the collision, a ledge out
// of reach, the hook reeling the hero up onto one, Lumenby's stack, and saves from the days of dig & build.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { load } from './zelda-load.mjs'

let Z
/** The isometric view's ramps (`render/iso/terrain.ts`): pure, bundled on their own. */
let R
before(async () => {
  Z = await load()
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: `export { rampSlope, rampSides } from './render/iso/terrain'`, resolveDir: new URL('../themes/zelda', import.meta.url).pathname, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  R = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const A = () => inp({ aPress: true, a: true })

/**
 * A room of terrain: `rows` are its tiles ('@' the hero, 'C' a chest), `heights` a digit a tile. Returns the game,
 * its world and a stepper.
 */
function room(rows, heights) {
  const W = {
    start: { map: 'pit', entry: 'start' },
    maps: {
      pit: {
        id: 'pit', name: 'PIT', kind: 'overworld', track: 'static', rows, terrain: { heights },
        marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, C: { ent: { t: 'chest', id: 'pit.ledge', item: 'bits20' } } },
      },
    },
  }
  const s = Z.createGame(W)
  s.mode = 'play'
  s.dialog = null
  s.inv.sword = true
  const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) Z.stepGame(W, s, 1 / 60, i) }
  const at = (x, y, dir = 'right') => { s.hero.x = x; s.hero.y = y; s.hero.dir = dir; s.hero.aim = undefined; go() }
  const walk = (dx, dy, n = 60) => go(inp({ move: { x: dx, y: dy } }), n)
  const settle = () => { for (let i = 0; i < 400 && s.mode !== 'play'; i++) { if (s.mode === 'dialog') { go(inp(), 18); go(A()) } else go() } }
  return { s, W, go, at, walk, settle }
}

//  x: 0123456789012
const ROWS = [
  '#############',
  '#...........#',
  '#.@.........#',
  '#...........#',
  '#############',
]
// Ground (1) west, a ramp rising east at x 5 (its height 2), a terrace at 2 from x 6, a ledge at 3 from x 10.
const HEIGHTS = [
  '1111112222333',
  '1111112222333',
  '1111122222333',
  '1111112222333',
  '1111112222333',
]

describe('Neon Shrine terrain', () => {
  it('is on only where a map says so: Lumenby', () => {
    const on = Object.entries(Z.WORLD.maps).filter(([, d]) => d.terrain).map(([id]) => id)
    assert.deepEqual(on, ['lumenby'])
    assert.equal(Z.WORLD.maps.quarry, undefined, 'the Old Quarry went with dig & build')
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'lumenby', entry: 'pit' } })
    assert.equal(s.map.terrain.g, 1)
    assert.equal(s.map.terrain.h[37 * s.map.w + 2], 4, 'the stack')
    const o = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'overworld', entry: 'hut' } })
    assert.equal(o.map.terrain, undefined)
  })

  it('stops a walker at a step up, lets it step down, and takes it up a ramp', () => {
    const rows = ROWS.map((r, y) => (y === 2 ? r.slice(0, 5) + 'и' + r.slice(6) : r))
    const { s, at, walk } = room(rows, HEIGHTS)
    // Row 1: the terrace's face at x 6 is a wall from the ground.
    at(3.5, 1.5)
    walk(1, 0, 80)
    assert.ok(s.hero.x < 6 - Z.HERO_R + 0.02, `walked into the terrace: x ${s.hero.x}`)
    assert.equal(s.map.terrain.z, 1)
    // Row 2: up the ramp onto the terrace, on to the ledge's face.
    at(3.5, 2.5)
    walk(1, 0, 90)
    assert.equal(s.map.terrain.z, 2)
    assert.ok(s.hero.x > 6.5 && s.hero.x < 10 - Z.HERO_R + 0.02, `up the ramp, stopped at the ledge: x ${s.hero.x}`)
    // Off the terrace's north side? It runs to the wall; back west down the ramp's side onto the ground: free.
    at(7.5, 3.5, 'left')
    walk(-1, 0, 60)
    assert.ok(s.hero.x < 5.6, `stepped down: x ${s.hero.x}`)
    assert.equal(s.map.terrain.z, 1)
  })

  it('keeps a ledge chest out of reach until the hero stands as high', () => {
    const rows = ROWS.map((r, y) => (y === 2 ? r.slice(0, 10) + 'C' + r.slice(11) : r))
    const { s, go, at, settle } = room(rows, HEIGHTS)
    // On the terrace (2), the chest on the ledge (3) east of the hero: A does not reach it.
    at(9.5, 2.5)
    go(A())
    settle()
    assert.ok(!s.flags['chest:pit.ledge'], 'opened from below')
    // Up on the ledge's level it opens.
    s.map.terrain.h[2 * s.map.w + 9] = 3
    go(inp(), 40)
    at(9.5, 2.5)
    go(A())
    settle()
    assert.ok(s.flags['chest:pit.ledge'])
  })

  it('reels the hero up onto a ledge the hook bites into', () => {
    const rows = ROWS.map((r, y) => (y === 2 ? r.slice(0, 11) + 'C' + r.slice(12) : r))
    const { s, go, at, settle } = room(rows, HEIGHTS)
    s.inv.hook = true
    s.inv.selected = 'hook'
    at(7.5, 2.5)
    assert.equal(s.map.terrain.z, 2)
    go(inp({ bPress: true }))
    for (let i = 0; i < 200 && s.hook; i++) go()
    assert.equal(s.hook, null)
    assert.ok(s.hero.x > 10, `landed on the ledge: x ${s.hero.x}`)
    assert.equal(s.map.terrain.z, 3)
    go(inp(), 30)
    go(A())
    settle()
    assert.ok(s.flags['chest:pit.ledge'], 'and opens what it bit')
  })

  it('takes a hero with bombs and the hook up onto the stack in Lumenby\'s pit', () => {
    const W = Z.WORLD
    const s = Z.createGame(W, { seed: 4, at: { map: 'lumenby', entry: 'pit' } })
    s.mode = 'play'
    s.dialog = null
    Object.assign(s.inv, { sword: true, hook: true, bombBag: true, bombs: 4, selected: 'bombs' })
    for (const e of s.map.enemies) { e.dead = true; e.x = -9; e.y = -9 }
    const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) Z.stepGame(W, s, 1 / 60, i) }
    const at = (x, y, dir) => { s.hero.x = x; s.hero.y = y; s.hero.dir = dir; s.hero.aim = undefined; go() }
    const w = s.map.w
    assert.equal(s.map.tiles[37 * w + 4], 'R', 'a rock on the bench, in the way')
    // The hook, with the rock still there: a clank, and the hero stays on the bench.
    at(6.5, 37.5, 'left')
    s.inv.selected = 'hook'
    go(inp({ bPress: true }))
    for (let i = 0; i < 200 && s.hook; i++) go()
    assert.ok(s.hero.x > 5.5 && s.map.terrain.z === 3, 'still on the bench')
    // A bomb by the rock, and away from the blast.
    s.inv.selected = 'bombs'
    at(5.6, 37.5, 'left')
    go(inp({ bPress: true }))
    at(9.5, 36.5, 'left')
    go(inp(), 200)
    assert.notEqual(s.map.tiles[37 * w + 4], 'R', 'the rock is gone')
    // Now the hook bites the chest and reels the hero up onto the stack.
    s.inv.selected = 'hook'
    at(6.5, 37.5, 'left')
    go(inp({ bPress: true }))
    for (let i = 0; i < 200 && s.hook; i++) go()
    assert.equal(s.map.terrain.z, 4, `on the stack at x ${s.hero.x.toFixed(2)}`)
    go(inp(), 30)
    go(A())
    for (let i = 0; i < 400 && s.mode !== 'play'; i++) { if (s.mode === 'dialog') { go(inp(), 18); go(A()) } else go() }
    assert.ok(s.flags['chest:lumenby.stack'], 'the heart piece')
  })

  it('draws a ramp only on its own tile, not in the land beyond the edges (render/iso/terrain.ts)', () => {
    // 10×4, a ramp rising east at the east edge (9, 1).
    const tiles = Array(40).fill('.')
    const h = Array(40).fill(1)
    tiles[1 * 10 + 9] = 'и'
    h[1 * 10 + 9] = 2
    const m = { w: 10, h: 4, tiles, terrain: { h, g: 1, z: 1 } }
    assert.ok(R.rampSlope(m, 9, 1))
    assert.equal(R.rampSides(m, 9, 1).length, 2)
    // Beyond the west edge one row down, and beyond the east edge one row up, the row-major index lands on it.
    for (const [x, y] of [[-1, 2], [10, 0], [-1, 1], [0, -1], [9, 4], [-24, 5], [33, 1]]) {
      assert.equal(R.rampSlope(m, x, y), null, `slope at ${x}, ${y}`)
      assert.deepEqual(R.rampSides(m, x, y), [], `sides at ${x}, ${y}`)
    }
  })

  it('reads a save from the days of dig & build: its tools put away, its edits and materials dropped', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'lumenby', entry: 'pit' } })
    s.inv.sword = true
    s.inv.hook = true
    s.flags['item:shovel'] = true
    const save = Z.toSave(s)
    for (const sel of ['dig', 'build']) {
      const old = Z.parseSave({ ...save, inv: { ...save.inv, selected: sel, mats: { stone: 5, lumen: 2 }, build: 'lamp' }, dig: { lumenby: '1аa2' } })
      assert.ok(old, `a save with ${sel} out still loads`)
      assert.equal(old.inv.selected, null)
      assert.equal('mats' in old.inv, false)
      assert.equal('build' in old.inv, false)
      assert.equal('dig' in old, false)
      assert.equal(old.inv.hook, true, 'the rest is kept')
      const g = Z.createGame(Z.WORLD, { save: old })
      assert.equal(g.map.terrain.h[37 * g.map.w + 2], 4, 'the map as authored')
    }
    // Something that never was an item is nothing in hand too (it used to refuse the whole save).
    assert.equal(Z.parseSave({ ...save, inv: { ...save.inv, selected: 'spade' } }).inv.selected, null)
    // Made down in the Old Quarry: back up in Lumenby's pit, the tools' flags kept and harmless.
    const g = Z.createGame(Z.WORLD, { save: { ...save, map: 'quarry', entry: 'start' } })
    assert.deepEqual([g.entry.map, g.entry.entry], ['lumenby', 'pit'])
    assert.deepEqual(Z.useItems(g), ['hook'])
  })
})
