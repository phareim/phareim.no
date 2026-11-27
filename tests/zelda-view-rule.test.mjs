// Neon Shrine: the view as a rule (square blocks `□` solid in the 8-bit view, diamond blocks `◇` in the isometric
// one) and the Turn Room that teaches it, played through `stepGame` and `setViewRule`. Pure modules, bundled with
// esbuild like the other zelda tests. The shell's own wiring is walked in a real browser, apart from this.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

let Z
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './engine/index'`,
        `export { ctx } from './engine/combat'`,
        `export { psiPush } from './engine/hero'`,
        `export { explode } from './engine/objects'`,
        `export { spawnEnemy } from './engine/spawn'`,
        `export { enterMap } from './engine/game'`,
        `export { WORLD } from './world/index'`,
        `export { blockUp } from './world/tiles'`,
        `export { validateWorld } from './world/validate'`,
        `export { NO_INPUT, HERO_R } from './types'`,
        `export { createTurn, viewSide } from './render/turn'`,
        `export { ruleMove, ruleLoose } from './viewRule'`,
        `export { ENGINE_LOADERS } from './views'`,
        `export { viewBlockPixels, BLOCK_INK } from './render/viewBlocks'`,
      ].join('; '),
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view'],
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const SIDES = ['flat', 'iso']
const BLOCKS = [['□', 'square'], ['◇', 'diamond']]
/** The rule as the job states it, written out here apart from the code under test. */
const upIn = (t, side) => (t === '□' && side === 'flat') || (t === '◇' && side === 'iso')

// ---- fixtures -----------------------------------------------------------------------------------------------

const W = 16
/** A 16 × 12 walled room with `at` ({ 'x,y': char }) set in it. */
function rows(at = {}) {
  return Array.from({ length: 12 }, (_, y) => Array.from({ length: W }, (_, x) => at[`${x},${y}`] ?? (x === 0 || y === 0 || x === W - 1 || y === 11 ? '#' : '.')).join(''))
}
function worldOf(at, marks = {}, extra = {}) {
  const def = { id: 'fix', name: 'FIX', kind: 'dungeon', track: 'dungeon', cell: { w: 16, h: 12 }, rows: rows({ '2,9': '@', ...at }), marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'up' } }, ...marks }, ...extra }
  return { maps: { fix: def }, start: { map: 'fix', entry: 'start' } }
}
/** A game standing at (x, y) in a fixture, the rule on `side`. */
function game(world, side, x = 5.5, y = 4.5, dir = 'right') {
  const s = Z.createGame(world, { seed: 5, at: world.start })
  s.view = side
  Object.assign(s.inv, { sword: true })
  Object.assign(s.hero, { x, y, dir, auto: null, safe: { x, y } })
  s.mode = 'play'
  return s
}
const inp = (o = {}) => ({ ...Z.NO_INPUT, ...o })
function run(world, s, frames, o, each) {
  const events = []
  for (let i = 0; i < frames; i++) {
    events.push(...Z.stepGame(world, s, 1 / 60, i ? inp({ ...o, aPress: false, bPress: false, rollPress: false }) : inp(o)))
    each?.()
  }
  return events
}
const at = (s, x, y) => s.map.tiles[y * s.map.w + x]
const inSolid = (world, s) => Z.circleBlocked(world, s.map, s.hero.x, s.hero.y, Z.HERO_R)

/** For each kind of block and each view: `fn(tile, side, up)`. */
const each = fn => { for (const [t] of BLOCKS) for (const side of SIDES) fn(t, side, upIn(t, side), `${t} in ${side}`) }

// ---- the rule, mover by mover -------------------------------------------------------------------------------

describe('the view rule, one read for everything that moves or looks', () => {
  it('stops the hero while a block is up, walking and rolling; foes keep off it either way, and an eye sees over a down one', () => {
    each((t, side, up, w) => {
      // The one read, written out apart from the code: a square is up in the 8-bit view, a diamond in the isometric one.
      assert.equal(Z.blockUp(t, side), up, w)
      const world = worldOf({ '7,4': t })
      const s = game(world, side)
      run(world, s, 60, { move: { x: 1, y: 0 } }, () => assert.ok(!inSolid(world, s), w))
      assert.ok(up ? s.hero.x < 6.67 : s.hero.x > 9, `${w}: walked to ${s.hero.x}`)
      // A roll springs off a wall only.
      const r = game(world, side, 5.6, 4.5)
      let sprang = false
      run(world, r, 30, { move: { x: 1, y: 0 }, rollPress: true }, () => { sprang ||= r.hero.air?.kind === 'spring'; assert.ok(!inSolid(world, r), w) })
      assert.equal(sprang, up, `${w}: a roll springs off a wall only`)
      // A blob and a bat, shoved at it and then left to their own brains: never into the tile.
      for (const kind of ['blob', 'bat']) {
        const f = game(world, side, 12.5, 4.5)
        const foe = Z.spawnEnemy('f', kind, 5.5, 4.5, 'right', 0)
        f.map.enemies.push(foe)
        foe.knock = { vx: 12, vy: 0, t: 0.3 }
        for (let i = 0; i < 120; i++) {
          f.hero.invuln = 1
          run(world, f, 1, {})
          assert.ok(!Z.circleBlocked(world, f.map, foe.x, foe.y, foe.r - 0.001, kind === 'bat' ? 'fly' : 'enemy'), `${w}: a ${kind} inside at ${foe.x},${foe.y}`)
        }
      }
      // An eye takes aim across a block only while it is down.
      const sight = worldOf({}, { E: { ent: { t: 'enemy', kind: 'eye' } } })
      sight.maps.fix.rows = rows({ '2,9': '@', '7,4': t, '10,4': 'E' })
      const e = game(sight, side)
      const eye = e.map.enemies[0]
      eye.ai.ang = Math.PI
      eye.ai.t = 0
      run(sight, e, 2, {})
      assert.equal(eye.ai.mode === 'aim', !up, `${w}: the eye takes aim`)
    })
  })

  it('stops the hook, the disc, a shot, a thrown pot and a beam at an up block, and refuses a turn under the hook\'s chain', () => {
    each((t, side, up, w) => {
      // The hook: a clank at an up block, a pull over a down one.
      const post = worldOf({ '7,4': t, '11,4': '|' })
      const h = game(post, side)
      Object.assign(h.inv, { hook: true, selected: 'hook' })
      const events = run(post, h, 90, { bPress: true })
      assert.equal(events.some(e => e.type === 'clank'), up, `${w}: the hook`)
      assert.ok(up ? h.hero.x === 5.5 : h.hero.x > 10, `${w}: the hook pulled to ${h.hero.x}`)
      assert.ok(!inSolid(post, h), w)
      // The disc turns back.
      const lever = worldOf({}, { L: { ent: { t: 'lever', flag: 'fix.lever' } } })
      lever.maps.fix.rows = rows({ '2,9': '@', '7,4': t, '9,4': 'L' })
      const d = game(lever, side)
      Object.assign(d.inv, { disc: true, selected: 'disc' })
      run(lever, d, 90, { bPress: true })
      assert.equal(!!d.flags['fix.lever'], !up, `${w}: the disc`)
      // A shot dies on it, a pot breaks on it.
      const open = worldOf({ '7,4': t })
      const s = game(open, side, 2.5, 8.5)
      s.map.projectiles.push({ id: 1, kind: 'pellet', x: 5.5, y: 4.5, vx: 8, vy: 0, r: 0.2, t: 0, life: 3, reflect: false })
      run(open, s, 30, {})
      assert.equal(s.map.projectiles.length, up ? 0 : 1, `${w}: a shot`)
      const p = game(open, side, 4.6, 4.5)
      p.hero.carry = 'pot'
      p.hero.act = 'carry'
      const broke = run(open, p, 60, { aPress: true }).find(e => e.type === 'shatter')?.x
      assert.ok(broke !== undefined, `${w}: the pot breaks somewhere`)
      assert.ok(up ? broke <= 7.01 : broke > 7.5, `${w}: the pot broke at ${broke}`)
      // A beam.
      const beam = worldOf({}, { e: { ent: { t: 'emitter', dir: 'right' } }, r: { ent: { t: 'receiver', flag: 'fix.lit' } } })
      beam.maps.fix.rows = rows({ '2,9': '@', '3,4': 'e', '7,4': t, '11,4': 'r' })
      const b = game(beam, side, 2.5, 8.5)
      run(beam, b, 5, {})
      assert.equal(!!b.flags['fix.lit'], !up, `${w}: the beam`)
    })
    // While the chain crosses a block that would rise, the turn is refused; granted once the pull is over.
    const world = worldOf({ '7,4': '◇', '11,4': '|' })
    const s = game(world, 'flat')
    Object.assign(s.inv, { hook: true, selected: 'hook' })
    let refused = 0
    run(world, s, 60, { bPress: true }, () => { if (s.hook && s.hook.x > 7 && s.hero.x < 7) { assert.equal(Z.setViewRule(s, 'iso'), false); refused++ } })
    assert.ok(refused > 0)
    assert.ok(s.hero.x > 10 && !s.hook)
    assert.equal(Z.setViewRule(s, 'iso'), true, 'and granted once the pull is over')
  })

  it('never lets a push block, a mirror, a psi block, a boulder or a bomb onto either kind, and a blast breaks none', () => {
    each((t, side, up, w) => {
      // A push block on a plain map, and a mirror and a block under the puzzle rules.
      for (const pushed of ['b', 'μ']) {
        const world = worldOf({ '6,4': pushed, '7,4': t })
        const s = game(world, side, 5.4, 4.5)
        run(world, s, 90, { move: { x: 1, y: 0 } })
        assert.deepEqual([at(s, 6, 4), at(s, 7, 4)], [pushed, t], `${w}: ${pushed}`)
      }
      // A blast shoves a mirror: not onto a block, and the block stands.
      const shoved = worldOf({ '6,4': 'μ', '7,4': t })
      const m = game(shoved, side, 2.5, 8.5)
      Z.explode(Z.ctx(shoved, m, []), 4.9, 4.5)
      assert.deepEqual([at(m, 6, 4), at(m, 7, 4)], ['μ', t], `${w}: a shoved mirror`)
      // Luna's psi block stops short of it.
      const psi = worldOf({ '4,4': 'B', '7,4': t })
      const p = game(psi, side, 2.5, 4.5)
      Z.psiPush(Z.ctx(psi, p, []), 4, 4, 'right')
      assert.deepEqual([at(p, 6, 4), at(p, 7, 4)], ['B', t], `${w}: a psi block`)
      // A rolling stone comes to rest short of it.
      const stone = worldOf({}, { Q: { ent: { t: 'boulder', dir: 'right', flag: 'fix.roll' } } })
      stone.maps.fix.rows = rows({ '2,9': '@', '3,4': 'Q', '7,4': t })
      const r = game(stone, side, 2.5, 8.5)
      r.flags['fix.roll'] = true
      run(stone, r, 120, {})
      assert.deepEqual([at(r, 6, 4), at(r, 7, 4)], ['κ', t], `${w}: a boulder`)
      // Facing a block, a bomb lands at the hero's feet, not on it.
      const open = worldOf({ '7,4': t })
      const b = game(open, side, 6.4, 4.5)
      Object.assign(b.inv, { bombBag: true, bombs: 3, selected: 'bombs' })
      run(open, b, 1, { bPress: true })
      assert.equal(b.map.bombs.length, 1, w)
      assert.ok(b.map.bombs[0].x < 7, `${w}: set at ${b.map.bombs[0].x}`)
      // Standing on a block that is down, facing a wall (so it would lie at the hero's feet): none is set.
      if (up) return
      const walled = worldOf({ '7,4': t, '7,3': '#' })
      const d = game(walled, side, 7.5, 4.5, 'up')
      Object.assign(d.inv, { bombBag: true, bombs: 3, selected: 'bombs' })
      const events = run(walled, d, 1, { bPress: true })
      assert.deepEqual([d.map.bombs.length, d.inv.bombs], [0, 3], w)
      assert.ok(events.some(e => e.type === 'error'), w)
    })
  })
})

// ---- the turn -----------------------------------------------------------------------------------------------

describe('the turn', () => {
  it('is refused on or touching a rising block, granted beside it, and a fall comes back beside one that rose', () => {
    for (const [t, side] of [['□', 'iso'], ['◇', 'flat']]) {
      const to = side === 'iso' ? 'flat' : 'iso'
      const world = worldOf({ '7,4': t })
      for (const [x, y] of [[7.5, 4.5], [7 - 0.33, 4.5]]) {
        const s = game(world, side, x, y)
        const was = JSON.stringify([s.view, s.map.version, s.map.tiles, s.flags, s.hero])
        assert.equal(Z.setViewRule(s, to), false, `${x},${y}`)
        assert.equal(JSON.stringify([s.view, s.map.version, s.map.tiles, s.flags, s.hero]), was, 'and nothing changes')
        // The same side is always granted.
        assert.equal(Z.setViewRule(s, side), true)
      }
      for (const [x, y] of [[7 - 0.35, 4.5], [6.7, 3.7]]) {
        const s = game(world, side, x, y)
        const v = s.map.version
        assert.equal(Z.setViewRule(s, to), true, `${x},${y}`)
        assert.equal(s.view, to)
        assert.ok(s.map.version > v, 'the pictures are made again')
        assert.ok(!inSolid(world, s), `${x},${y}`)
      }
    }
    const world = worldOf({ '7,4': '◇', '9,4': 'O' })
    const s = game(world, 'iso', 9.5, 4.5)
    s.hero.safe = { x: 7.5, y: 4.5 }
    s.hero.act = 'fall'
    s.hero.actT = 1
    run(world, s, 1, {})
    assert.ok(!inSolid(world, s), 'a fall comes back beside the spot')
  })

  it('never leaves Luna in a block that rose on her trail, and leaves her where she is when her way is open', () => {
    /** Is Luna (a point: she has no collision) in a block that is up? */
    const lunaIn = s => Z.blockUp(at(s, Math.floor(s.luna.x), Math.floor(s.luna.y)), s.view)
    for (const [t] of BLOCKS) {
      const side = t === '□' ? 'iso' : 'flat'
      const to = side === 'iso' ? 'flat' : 'iso'
      // Just past the block (the point she walks to lies in it), and further off; at once, and after standing a while.
      for (const [toY, wait] of [[3.66, 30], [3.0, 4], [1.9, 40]]) {
        const world = worldOf({ '7,4': t })
        const s = game(world, side, 7.5, 6.5, 'up')
        s.luna = { x: 7.5, y: 7.6, dir: 'up', walkT: 0, trail: [{ x: 7.5, y: 7.6 }, { x: 7.5, y: 6.5 }], psi: 0 }
        for (let i = 0; i < 200 && s.hero.y > toY; i++) run(world, s, 1, { move: { x: 0, y: -Math.min(1, (s.hero.y - toY) * 6 + 0.1) } })
        run(world, s, wait, {})
        if (toY === 3.66) assert.deepEqual([Math.floor(s.luna.x), Math.floor(s.luna.y)], [7, 4], 'she is on the block as it lies')
        assert.equal(Z.setViewRule(s, to), true)
        const clear = () => assert.ok(!lunaIn(s), `${t} from ${toY} after ${wait}: ${s.luna.x},${s.luna.y}`)
        clear()
        assert.ok(s.luna.trail.every(p => !Z.blockUp(at(s, Math.floor(p.x), Math.floor(p.y)), s.view)), 'no point of the trail lies in a block')
        for (const move of [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }]) run(world, s, 40, { move }, clear)
      }
    }
    const world = worldOf({ '7,4': '◇' })
    const s = game(world, 'flat', 3.5, 4.5)
    s.luna = { x: 2.2, y: 4.5, dir: 'right', walkT: 0, trail: [{ x: 2.2, y: 4.5 }, { x: 3.5, y: 4.5 }], psi: 0 }
    assert.equal(Z.setViewRule(s, 'iso'), true)
    assert.deepEqual([s.luna.x, s.luna.y, s.luna.trail.length], [2.2, 4.5, 2])
  })

  it('opens gates and raises chests by view (for good), chooses what is said, and saves no view', () => {
    const marks = {
      g: { ent: { t: 'gate', open: { view: 'flat' } } },
      c: { ent: { t: 'chest', id: 'fix.late', item: 'bits5', appear: { view: 'flat' } } },
      n: { ent: { t: 'npc', id: 'who', look: 'keeper', talk: [{ when: { view: 'flat' }, lines: ['FLAT.'] }, { lines: ['DEEP.'] }] } },
      S: { ent: { t: 'sign', lines: ['DEEP SIGN.'], alt: { when: { view: 'flat' }, lines: ['FLAT SIGN.'] } } },
    }
    const gated = () => { const w = worldOf({}, marks); w.maps.fix.rows = rows({ '2,9': '@', '5,2': 'g', '9,2': 'c', '4,6': 'n', '8,6': 'S' }); return w }
    for (const side of SIDES) {
      const w = gated()
      const s = game(w, side, 2.5, 8.5)
      run(w, s, 3, {})
      assert.equal(!!s.flags['gate:fix.5,2'], side === 'flat')
      assert.equal(!!s.flags['appear:fix.late'], side === 'flat')
      // For good: turned away and back, and loaded again, what opened stays open.
      if (side === 'flat') {
        for (const next of ['iso', 'flat', 'iso']) {
          assert.equal(Z.setViewRule(s, next), true)
          run(w, s, 3, {})
          assert.deepEqual([at(s, 5, 2), at(s, 9, 2)], ['.', '$'], `turned to ${next}`)
          assert.ok(s.flags['gate:fix.5,2'] && s.flags['appear:fix.late'])
        }
        Z.enterMap(w, s, 'fix', 'start', [])
        assert.deepEqual([s.view, at(s, 5, 2), at(s, 9, 2)], ['iso', '.', '$'])
      }
      for (const [x, y, flat, deep] of [[4.5, 7.3, 'FLAT.', 'DEEP.'], [8.5, 7.3, 'FLAT SIGN.', 'DEEP SIGN.']]) {
        const t = game(w, side, x, y, 'up')
        run(w, t, 1, { aPress: true })
        assert.deepEqual(t.dialog?.lines, [side === 'flat' ? flat : deep])
      }
    }
    // The view is saved nowhere: a save made in the 8-bit view opens in the isometric one, as a new game does.
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'turnroom', entry: 'start' } })
    assert.deepEqual([s.view, s.map.view], ['iso', 'iso'])
    s.inv.sword = true
    assert.equal(Z.setViewRule(s, 'flat'), true)
    assert.equal(s.map.view, 'flat')
    const save = Z.toSave(s)
    assert.ok(!('view' in save))
    assert.doesNotMatch(JSON.stringify(save), /"view"|"flat"|"iso"/)
    const again = Z.createGame(Z.WORLD, { save: Z.parseSave({ ...JSON.parse(JSON.stringify(save)), view: 'flat' }) })
    assert.deepEqual([again.map.id, again.view], ['turnroom', 'iso'])
  })
})

describe('the validator on a map with view blocks', () => {
  const line = (y, t) => Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`${i + 1},${y}`, t]))
  const chest = { c: { ent: { t: 'chest', id: 'fix.chest', item: 'bits5' } } }
  const check = (at, marks = {}, extra = {}) => { const w = worldOf(at, marks, extra); return Z.validateWorld(w) }

  /**
   * Where the hook is the only way across: a corridor north out of the room, water in it, `mid` in the chain's path
   * between two stretches of water (`near`: the one before the landing), a post at its end and the chest beside the
   * landing. Walking stops at the first water whatever the view.
   */
  function strait(mid, { near = '~', post = '|' } = {}) {
    const walls = Object.fromEntries([1, 2, 3, 4, 5, 6].flatMap(y => Array.from({ length: 14 }, (_, i) => [`${i + 1},${y}`, '#'])))
    return { ...walls, '5,6': '.', '5,5': '~', '5,4': mid, '5,3': near, '5,2': '.', '5,1': post, '6,2': '.', '7,2': 'c' }
  }
  const LOST = ['fix: chest at 7,2 is unreachable']

  it('walks the routes in both states: a chest no turning reaches is named, and the hook\'s crossing agrees with a played game', () => {
    assert.deepEqual(check({ ...line(4, '◇'), ...line(7, '□'), '5,2': 'c' }, chest), [])
    // A row that is a wall one way only is no wall.
    assert.deepEqual(check({ ...line(4, '◇'), '5,2': 'c' }, chest), [])
    // Two rows with nowhere to turn between them.
    assert.deepEqual(check({ ...line(4, '◇'), ...line(5, '□'), '5,2': 'c' }, chest), ['fix: chest at 5,2 is unreachable'])
    // Where the hook is the only way across: over a block that is down, not through a wall, not past one of each.
    for (const [t] of BLOCKS) assert.deepEqual(check(strait(t), chest), [], t)
    assert.deepEqual(check(strait('#'), chest), LOST)
    assert.deepEqual(check(strait('◇', { near: '□' }), chest), LOST)
    // And the game agrees: across in the view where the block is down, not in the other.
    for (const [t] of BLOCKS) {
      for (const side of SIDES) {
        const world = worldOf(strait(t), chest)
        const s = game(world, side, 5.5, 6.5, 'up')
        Object.assign(s.inv, { hook: true, selected: 'hook' })
        run(world, s, 90, { bPress: true })
        assert.ok(upIn(t, side) ? s.hero.y === 6.5 : s.hero.y < 2.6, `${t} in ${side}: ${s.hero.y}`)
      }
    }
    // An entry or a landing must be floor in both views, and a map with view blocks must allow both.
    assert.deepEqual(check({ '9,6': '□' }, {}, { entries: { back: { x: 9.5, y: 6.5, dir: 'down' } } }), ["fix: entry back lands on 9,6 ('□'), which is not free in both views"])
    assert.deepEqual(check({ '9,6': '□' }, {}, { views: ['iso', 'classic'] }), [])
    assert.deepEqual(check({ '9,6': '□' }, {}, { views: ['iso'] }), ["fix: has a view block at 9,6 ('□') but allows only iso (a map with view blocks allows both views)"])
  })
})

// ---- the Turn Room ------------------------------------------------------------------------------------------

describe('the Turn Room', () => {
  const start = (side) => {
    const s = Z.createGame(Z.WORLD, { seed: 11, at: { map: 'turnroom', entry: 'start' } })
    s.inv.sword = true
    assert.equal(Z.setViewRule(s, side), true)
    return s
  }
  const other = side => (side === 'iso' ? 'flat' : 'iso')

  /** A scripted player: walk straight to (x, y) with the stick. True when there. */
  function walkTo(s, x, y, watch) {
    let still = 0
    for (let i = 0; i < 600; i++) {
      const dx = x - s.hero.x
      const dy = y - s.hero.y
      const d = Math.hypot(dx, dy)
      if (d < 0.06) return true
      const m = Math.min(1, d / 0.12)
      const was = [s.hero.x, s.hero.y]
      Z.stepGame(Z.WORLD, s, 1 / 60, inp(s.mode === 'play' ? { move: { x: (dx / d) * m, y: (dy / d) * m } } : {}))
      watch?.()
      still = Math.hypot(s.hero.x - was[0], s.hero.y - was[1]) < 1e-4 ? still + 1 : 0
      if (still > 10) return false
    }
    return false
  }
  /** The way through, as waypoints, and the side each leg north of it needs. */
  const ROUTE = [
    { x: 7.5, y: 9.5 },
    { x: 7.5, y: 6.9, need: 'flat' }, // over the diamond row
    { x: 3.5, y: 6.5 },
    { x: 3.5, y: 3.5, need: 'iso' }, // over the square row
    { x: 4.5, y: 1.9 },
    { x: 7.9, y: 1.9, need: 'flat' }, // over the stagger's diamonds
    { x: 8.5, y: 2.5 },
    { x: 11.35, y: 2.5, need: 'iso' }, // over its squares
  ]
  function openChest(s) {
    s.hero.dir = 'right'
    Z.stepGame(Z.WORLD, s, 1 / 60, inp({ aPress: true, a: true }))
    return !!s.flags['chest:turnroom.prize']
  }

  it('lies behind a door in the Weigh House and is solved by a scripted player from either view', () => {
    const lab = Z.WORLD.maps.puzzlelab
    assert.deepEqual([lab.rows.length, lab.rows[0].length], [24, 48])
    assert.equal(Z.mapInfo(Z.WORLD, 'puzzlelab').base[12 * 48 + 7], 'D')
    for (const side of SIDES) {
      const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'puzzlelab', entry: 'from-turnroom' } })
      s.view = side
      s.hero.dir = 'up'
      const go = (y, until) => { for (let i = 0; i < 200 && !until(); i++) Z.stepGame(Z.WORLD, s, 1 / 60, inp(s.mode === 'play' ? { move: { x: 0, y } } : {})) }
      go(-1, () => s.map.id === 'turnroom' && s.mode === 'play')
      assert.equal(s.map.id, 'turnroom')
      assert.ok(!inSolid(Z.WORLD, s))
      go(1, () => s.map.id === 'puzzlelab' && s.mode === 'play')
      assert.equal(s.map.id, 'puzzlelab')
      assert.deepEqual([s.hero.x, s.hero.y], [7.5, 13.5])
    }
    // Solved by a scripted player: four turns from the isometric view, three from the 8-bit one, twenty bits.
    // Arriving in the isometric view the diamonds stand: they must turn at once. In the 8-bit view the squares come next.
    assert.ok(!walkTo(start('iso'), 8.5, 7.5), 'the diamonds stand')
    const t = start('flat')
    assert.ok(walkTo(t, 8.5, 6.5), 'in the 8-bit view they are floor')
    assert.ok(!walkTo(t, 8.5, 3.5), 'and the squares come next')
    for (const from of SIDES) {
      const s = start(from)
      let turns = 0
      for (const p of ROUTE) {
        if (p.need && s.view !== p.need) { assert.equal(Z.setViewRule(s, p.need), true, `${from}: turning to ${p.need} at ${s.hero.x},${s.hero.y}`); turns++ }
        assert.ok(walkTo(s, p.x, p.y, () => assert.ok(!inSolid(Z.WORLD, s))), `${from}: stuck at ${s.hero.x},${s.hero.y} for ${p.x},${p.y}`)
      }
      assert.equal(openChest(s), true, from)
      assert.equal(s.get?.item, 'bits20')
      assert.equal(s.inv.bits, 20)
      assert.equal(turns, from === 'iso' ? 4 : 3, from)
    }
  })

  it('never holds the hero inside a block, with the turn pressed at random while they walk it from either view', () => {
    // One seeded walk: toward the waypoints of the way through and back again, the stick wandering, a roll now and
    // then, and the turn pressed at random. A failure names the seed: `TURN_SEED=<n>` runs that walk again.
    const first = Number(process.env.TURN_SEED ?? 99)
    let seed = first
    const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
    const there = [...ROUTE, ...ROUTE.slice(0, -1).reverse()]
    for (const from of SIDES) {
      const s = start(from)
      let goal = 0
      let stick = { x: 0, y: -1 }
      let granted = 0
      let refused = 0
      let north = 12
      const reached = new Set()
      for (let i = 0; i < 6000; i++) {
        const p = there[goal % there.length]
        if (Math.hypot(p.x - s.hero.x, p.y - s.hero.y) < 0.5) { reached.add(goal % there.length); goal++ }
        if (i % 12 === 0) {
          const a = rnd() < 0.7 ? Math.atan2(p.y - s.hero.y, p.x - s.hero.x) + (rnd() - 0.5) : rnd() * Math.PI * 2
          stick = { x: Math.cos(a), y: Math.sin(a) }
        }
        if (rnd() < 0.08) { if (Z.setViewRule(s, other(s.view))) granted++; else refused++ }
        // (Not out of the door: no step further south near it, and no roll.)
        const door = s.hero.y > 9.4
        const move = s.hero.y > 10 ? { x: stick.x, y: -Math.abs(stick.y) } : stick
        const roll = rnd() < 0.02 && !door
        Z.stepGame(Z.WORLD, s, 1 / 60, inp(s.mode === 'play' ? { move, rollPress: roll, aPress: rnd() < 0.02 } : { aPress: i % 20 === 0 }))
        north = Math.min(north, s.hero.y)
        if (s.map.id !== 'turnroom') assert.fail(`TURN_SEED=${first}: from ${from} the walk left the room at frame ${i}`)
        if (inSolid(Z.WORLD, s)) assert.fail(`TURN_SEED=${first}: from ${from}, frame ${i}, the hero is inside a block at ${s.hero.x},${s.hero.y} in ${s.view}`)
      }
      // The walk means something: hundreds of presses, both answers, and past both rows and the stagger.
      const said = `TURN_SEED=${first}: from ${from}, ${granted} granted, ${refused} refused, north to ${north.toFixed(1)}, ${reached.size} waypoints`
      assert.ok(granted + refused > 300 && granted > 100 && refused > 20 && north < 3, said)
    }
  })
})

// ---- the moment of the turn ---------------------------------------------------------------------------------

describe('the moment of a turn', () => {
  /** The renderer's turn, as the shell reads it. */
  const state = (t, dark = false) => ({ id: t.id, k: t.k, turning: t.turning, dark })

  /**
   * The shell's frames round a loader that answers late: the renderer's own turn (which has no isometric view until
   * the code is added) and the rule's move applied each frame as `stepRule` does. `heroAt`: where the hero has got to
   * by the time the code arrives.
   */
  async function late(heroAt) {
    const real = Z.ENGINE_LOADERS.iso
    let arrive
    Z.ENGINE_LOADERS.iso = () => new Promise(done => { arrive = done })
    try {
      const views = new Set()
      const t = Z.createTurn(id => views.has(id), 0.7)
      const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'turnroom', entry: 'start' } })
      s.inv.sword = true
      // At mount: the classic picture draws, and the rule is its side.
      Z.setViewRule(s, 'flat')
      // As `showView` does it: fetch, then add the engine and turn.
      const shown = Z.ENGINE_LOADERS.iso().then(() => { views.add('iso') })
      let back = 0
      const frames = n => {
        for (let i = 0; i < n; i++) {
          const move = Z.ruleMove(s, state(t), false)
          if (move === 'back') { back++; t.set('classic') } else if (move) Z.setViewRule(s, move)
          // The rule and the picture agree on every frame: never ahead of it.
          assert.equal(s.view, t.id === 'iso' && t.k > 0.5 ? 'iso' : 'flat', `frame ${i}, k ${t.k}`)
          t.step(1 / 60)
        }
      }
      frames(600)
      assert.deepEqual([s.view, t.id], ['flat', 'classic'], 'ten seconds without the engine: 8-bit, rule and picture')
      if (heroAt) Object.assign(s.hero, heroAt)
      arrive({ default: () => {} })
      await shown
      t.set('iso')
      frames(80)
      return { s, t, back }
    } finally { Z.ENGINE_LOADERS.iso = real }
  }

  it('never turns the rule ahead of the picture: a late engine is waited for, taken back over a block, and one that fails leaves V the rule', async () => {
    // The engine arrives late: the rule turns when the picture does.
    const a = await late()
    assert.deepEqual([a.s.view, a.t.id, a.t.k, a.back], ['iso', 'iso', 1, 0])
    // The hero has walked into the diamond row (floor in the 8-bit view) while it was coming: the turn is taken back.
    const b = await late({ x: 7.5, y: 8.5 })
    assert.equal(b.back, 1)
    assert.deepEqual([b.s.view, b.t.id], ['flat', 'classic'])
    assert.ok(!inSolid(Z.WORLD, b.s))
    // The loader fails: nothing is added, the picture stays classic and says nothing about the rule.
    const real = Z.ENGINE_LOADERS.iso
    Z.ENGINE_LOADERS.iso = () => Promise.reject(new Error('offline'))
    try {
      const views = new Set()
      const t = Z.createTurn(id => views.has(id), 0.7)
      let lost = false
      await Z.ENGINE_LOADERS.iso().then(() => { views.add('iso') }, () => { lost = true })
      t.set('iso')
      t.step(1 / 60)
      assert.equal(t.id, 'classic')
      const loose = Z.ruleLoose(lost, [{ engine: 'classic' }, { engine: 'iso' }])
      assert.equal(loose, true)
      const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'turnroom', entry: 'start' } })
      assert.equal(s.view, 'iso')
      for (const side of SIDES) {
        Z.setViewRule(s, side)
        assert.equal(Z.ruleMove(s, state(t), loose), null)
      }
    } finally { Z.ENGINE_LOADERS.iso = real }
    // A round without an isometric view is the same.
    assert.equal(Z.ruleLoose(false, [{ engine: 'classic' }]), true)
    assert.equal(Z.ruleLoose(false, [{ engine: 'classic' }, { engine: 'iso' }]), false)
  })
})

// ---- the pictures -------------------------------------------------------------------------------------------

describe('the blocks\' pictures', () => {
  /** Where the cyan lies, as the screen shows it: straight down, or in the isometric picture's own measure. */
  function onScreen(shape, up, face) {
    const px = Z.viewBlockPixels(shape, up, face)
    const ink = up ? Z.BLOCK_INK.cut : Z.BLOCK_INK.floor
    const pts = []
    px.forEach((c, i) => {
      if (c !== ink) return
      const u = (i % 16) + 0.5
      const v = Math.floor(i / 16) + 0.5
      pts.push(face === 'flat' ? [u, v] : [u - v, (u + v) / 2])
    })
    return pts
  }
  /** How much of the way into the corners of its box a shape reaches: near 1 a square, near a half a diamond. */
  function cornered(pts) {
    const xs = pts.map(p => p[0])
    const ys = pts.map(p => p[1])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2
    const w = (Math.max(...xs) - Math.min(...xs)) / 2
    const h = (Math.max(...ys) - Math.min(...ys)) / 2
    return Math.max(...pts.map(([x, y]) => Math.min(Math.abs(x - cx) / w, Math.abs(y - cy) / h)))
  }

  it('tells a square from a diamond by shape on screen, up as stone with a cut and down as an outline, in both pictures', () => {
    for (const face of SIDES) {
      for (const up of [true, false]) {
        const square = cornered(onScreen('square', up, face))
        const diamond = cornered(onScreen('diamond', up, face))
        assert.ok(square > 0.82, `square ${face} up ${up}: ${square}`)
        assert.ok(diamond < 0.68, `diamond ${face} up ${up}: ${diamond}`)
      }
    }
    for (const [, shape] of BLOCKS) {
      for (const face of SIDES) {
        const up = Z.viewBlockPixels(shape, true, face)
        const down = Z.viewBlockPixels(shape, false, face)
        assert.ok(up.every(c => c !== null))
        assert.ok(up.includes(Z.BLOCK_INK.cut) && up.includes(Z.BLOCK_INK.top))
        assert.deepEqual([...new Set(down)].sort(), [Z.BLOCK_INK.floor, null].sort())
        assert.ok(down.filter(Boolean).length < 80, 'an outline, not a slab')
      }
    }
  })
})
