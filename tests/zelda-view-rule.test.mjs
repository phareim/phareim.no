// Neon Shrine: the view as a rule (square blocks `□` solid in the 8-bit view, diamond blocks `◇` in the isometric
// one) and the Turn Room that teaches it. Pure modules, bundled with esbuild like the other zelda tests; the shell's
// own wiring is read from its source (it is walked in a real browser apart from this).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
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
        `export { seesHero, walk } from './engine/enemies'`,
        `export { psiPush } from './engine/hero'`,
        `export { explode } from './engine/objects'`,
        `export { spawnEnemy } from './engine/spawn'`,
        `export { enterMap } from './engine/game'`,
        `export { WORLD } from './world/index'`,
        `export { TILE_INFO, blockUp, isViewBlock } from './world/tiles'`,
        `export { validateWorld } from './world/validate'`,
        `export { NO_INPUT, HERO_R } from './types'`,
        `export { createTurn, turnSide, viewSide } from './render/turn'`,
        `export { ruleMove, ruleLoose } from './viewRule'`,
        `export { ENGINE_LOADERS } from './views'`,
        `export { chartPixels, chartInks, chartLayer } from './render/worldMap'`,
        `export { viewBlockPixels, BLOCK_INK, SIDE_PATCH } from './render/viewBlocks'`,
        `export { shapeOf, CARD, FLAT } from './render/iso/shape'`,
        `export { renderCorner, cornerShape, STAND_CLEAR, RULE_TAGS, CORNER_W } from './render/corner'`,
        `export { textWidth } from '../base/pixel/font'`,
        `export { mapPageFor } from './render/mapPage'`,
        `export { NEON_SKIN } from './render/hud'`,
        `export { TOUCH_KEYS } from './keys'`,
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
  it('says which block is up: a square in the 8-bit view, a diamond in the isometric one', () => {
    each((t, side, up, w) => assert.equal(Z.blockUp(t, side), up, w))
    for (const t of Object.keys(Z.TILE_INFO)) if (!Z.isViewBlock(t)) for (const side of SIDES) assert.equal(Z.blockUp(t, side), false, t)
    assert.deepEqual(Object.keys(Z.TILE_INFO).filter(Z.isViewBlock), ['□', '◇'])
  })

  it('opens a game in the isometric view, and the map reads the game\'s view', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1 })
    assert.equal(s.view, 'iso')
    assert.equal(s.map.view, 'iso')
    s.view = 'flat'
    assert.equal(s.map.view, 'flat')
  })

  it('blocks the hero and a shot while up, and every creature always (solidTile, circleBlocked, moveCircle, lineClear)', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t })
      const s = game(world, side)
      for (const [mode, solid] of [['hero', up], ['shot', up], ['enemy', true], ['fly', true]]) {
        assert.equal(Z.solidTile(world, s.map, 7, 4, mode), solid, `${w} ${mode}`)
        assert.equal(Z.circleBlocked(world, s.map, 7.5, 4.5, 0.34, mode), solid, `${w} ${mode} circle`)
        const r = Z.moveCircle(world, s.map, 5.5, 4.5, 0.34, 2, 0, mode)
        assert.equal(r.hitX, solid, `${w} ${mode} move`)
        assert.ok(solid ? r.x <= 7 - 0.34 + 1e-6 && r.x > 6.5 : r.x === 7.5, `${w} ${mode}: ${r.x}`)
      }
      assert.equal(Z.lineClear(world, s.map, 5.5, 4.5, 10.5, 4.5), !up, `${w} line`)
    })
  })

  it('walks, rolls and springs the hero by it', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t })
      const s = game(world, side)
      run(world, s, 60, { move: { x: 1, y: 0 } }, () => assert.ok(!inSolid(world, s), w))
      assert.ok(up ? s.hero.x < 6.67 : s.hero.x > 9, `${w}: walked to ${s.hero.x}`)
      const r = game(world, side, 5.6, 4.5)
      let sprang = false
      run(world, r, 30, { move: { x: 1, y: 0 }, rollPress: true }, () => { sprang ||= r.hero.air?.kind === 'spring'; assert.ok(!inSolid(world, r), w) })
      assert.equal(sprang, up, `${w}: a roll springs off a wall only`)
    })
  })

  it('lets foes see across a block only while it is down', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t }, { E: { ent: { t: 'enemy', kind: 'eye' } } })
      world.maps.fix.rows = rows({ '2,9': '@', '7,4': t, '10,4': 'E' })
      const s = game(world, side)
      const foe = s.map.enemies[0]
      assert.equal(Z.seesHero(Z.ctx(world, s, []), foe, 9), !up, w)
      foe.ai.ang = Math.PI
      foe.ai.t = 0
      run(world, s, 2, {})
      assert.equal(foe.ai.mode === 'aim', !up, `${w}: the eye takes aim`)
    })
  })

  it('keeps foes off both kinds in both views, walking and flying, knocked back too', () => {
    for (const kind of ['blob', 'bat', 'sentry', 'drone']) {
      each((t, side, up, w) => {
        const world = worldOf({ '7,4': t })
        const s = game(world, side, 12.5, 4.5)
        const foe = Z.spawnEnemy('f', kind, 5.5, 4.5, 'right', 0)
        s.map.enemies.push(foe)
        const c = Z.ctx(world, s, [])
        for (let i = 0; i < 120; i++) Z.walk(c, foe, 5, 0, 1 / 60)
        assert.ok(foe.x <= 7 - foe.r + 1e-6, `${w}: a ${kind} at ${foe.x}`)
        // Its own brain, and a shove: never over the tile.
        foe.x = 5.5
        foe.knock = { vx: 12, vy: 0, t: 0.3 }
        for (let i = 0; i < 400; i++) {
          s.hero.invuln = 1
          run(world, s, 1, {})
          assert.ok(!Z.circleBlocked(world, s.map, foe.x, foe.y, foe.r - 0.001, kind === 'bat' || kind === 'drone' ? 'fly' : 'enemy'), `${w}: a ${kind} inside at ${foe.x},${foe.y}`)
        }
      })
    }
  })

  it('stops the hook\'s chain at an up block, and pulls over a down one', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t, '11,4': '|' })
      const s = game(world, side)
      Object.assign(s.inv, { hook: true, selected: 'hook' })
      const events = run(world, s, 90, { bPress: true })
      assert.equal(events.some(e => e.type === 'clank'), up, w)
      assert.ok(up ? s.hero.x === 5.5 : s.hero.x > 10, `${w}: ${s.hero.x}`)
      assert.ok(!inSolid(world, s), w)
    })
  })

  it('turns the disc back at an up block', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t }, { L: { ent: { t: 'lever', flag: 'fix.lever' } } })
      world.maps.fix.rows = rows({ '2,9': '@', '7,4': t, '9,4': 'L' })
      const s = game(world, side)
      Object.assign(s.inv, { disc: true, selected: 'disc' })
      run(world, s, 90, { bPress: true })
      assert.equal(!!s.flags['fix.lever'], !up, w)
    })
  })

  it('stops shots and thrown pots at an up block', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t })
      const s = game(world, side, 2.5, 8.5)
      s.map.projectiles.push({ id: 1, kind: 'pellet', x: 5.5, y: 4.5, vx: 8, vy: 0, r: 0.2, t: 0, life: 3, reflect: false })
      run(world, s, 30, {})
      assert.equal(s.map.projectiles.length, up ? 0 : 1, `${w}: a shot`)
      const p = game(world, side, 4.6, 4.5)
      p.hero.carry = 'pot'
      p.hero.act = 'carry'
      let far = 0
      let broke = null
      for (let i = 0; i < 60; i++) {
        for (const e of Z.stepGame(world, p, 1 / 60, inp(i ? {} : { aPress: true }))) if (e.type === 'shatter') broke = e.x
        for (const o of p.map.thrown) far = Math.max(far, o.x)
      }
      assert.ok(broke !== null, `${w}: it breaks somewhere`)
      assert.ok(up ? broke <= 7.01 : broke > 7.5, `${w}: the pot broke at ${broke}`)
    })
  })

  it('leaves a bomb\'s blast as it is at a wall, breaks no view block, and lets none be set on one', () => {
    each((t, side, up, w) => {
      const world = worldOf({ '7,4': t }, { L: { ent: { t: 'lever', flag: 'fix.lever' } } })
      world.maps.fix.rows = rows({ '2,9': '@', '7,4': t, '8,4': 'L' })
      const s = game(world, side, 2.5, 8.5)
      Z.explode(Z.ctx(world, s, []), 6.9, 4.5)
      assert.equal(at(s, 7, 4), t, w)
      // (A blast has no line of sight in this engine: it reaches past a wall, and past a block either way.)
      assert.ok(s.flags['fix.lever'], w)
      // Facing a block: the bomb lands at the hero's feet, not on it.
      const b = game(world, side, 6.4, 4.5)
      Object.assign(b.inv, { bombBag: true, bombs: 3, selected: 'bombs' })
      run(world, b, 1, { bPress: true })
      assert.equal(b.map.bombs.length, 1, w)
      assert.ok(b.map.bombs[0].x < 7, `${w}: set at ${b.map.bombs[0].x}`)
      // Standing on a block that is down, facing a wall (so the bomb would lie at the hero's feet): none is set.
      if (up) return
      const walled = worldOf({ '7,4': t, '7,3': '#' })
      const d = game(walled, side, 7.5, 4.5, 'up')
      Object.assign(d.inv, { bombBag: true, bombs: 3, selected: 'bombs' })
      const events = run(walled, d, 1, { bPress: true })
      assert.equal(d.map.bombs.length, 0, w)
      assert.equal(d.inv.bombs, 3, w)
      assert.ok(events.some(e => e.type === 'error'), w)
    })
  })

  it('never lets a push block, a mirror, a psi block or a boulder onto either kind, in either view', () => {
    each((t, side, up, w) => {
      // A push block on a plain map, and a mirror and a block under the puzzle rules.
      for (const pushed of ['b', 'μ']) {
        const world = worldOf({ '6,4': pushed, '7,4': t })
        const s = game(world, side, 5.4, 4.5)
        run(world, s, 90, { move: { x: 1, y: 0 } })
        assert.equal(at(s, 6, 4), pushed, `${w}: ${pushed}`)
        assert.equal(at(s, 7, 4), t, `${w}: ${pushed}`)
      }
      // A blast shoves a mirror: not onto a block.
      const shoved = worldOf({ '6,4': 'μ', '7,4': t })
      const b = game(shoved, side, 2.5, 8.5)
      Z.explode(Z.ctx(shoved, b, []), 4.9, 4.5)
      assert.equal(at(b, 6, 4), 'μ', w)
      assert.equal(at(b, 7, 4), t, w)
      // Luna's psi block stops short of it.
      const psi = worldOf({ '4,4': 'B', '7,4': t })
      const p = game(psi, side, 2.5, 4.5)
      Z.psiPush(Z.ctx(psi, p, []), 4, 4, 'right')
      assert.equal(at(p, 6, 4), 'B', w)
      assert.equal(at(p, 7, 4), t, w)
      // A rolling stone comes to rest short of it.
      const stone = worldOf({}, { Q: { ent: { t: 'boulder', dir: 'right', flag: 'fix.roll' } } })
      stone.maps.fix.rows = rows({ '2,9': '@', '3,4': 'Q', '7,4': t })
      const r = game(stone, side, 2.5, 8.5)
      r.flags['fix.roll'] = true
      run(stone, r, 120, {})
      assert.equal(at(r, 6, 4), 'κ', w)
      assert.equal(at(r, 7, 4), t, w)
    })
  })

  it('stops a beam at an up block', () => {
    each((t, side, up, w) => {
      const world = worldOf({}, { e: { ent: { t: 'emitter', dir: 'right' } }, r: { ent: { t: 'receiver', flag: 'fix.lit' } } })
      world.maps.fix.rows = rows({ '2,9': '@', '3,4': 'e', '7,4': t, '11,4': 'r' })
      const s = game(world, side, 2.5, 8.5)
      run(world, s, 5, {})
      assert.equal(!!s.flags['fix.lit'], !up, w)
    })
  })
})

// ---- the turn -----------------------------------------------------------------------------------------------

describe('the turn', () => {
  it('is refused with the hero on a rising block, or touching it, and nothing changes', () => {
    for (const [t, side] of [['□', 'iso'], ['◇', 'flat']]) {
      const to = side === 'iso' ? 'flat' : 'iso'
      const world = worldOf({ '7,4': t })
      for (const [x, y] of [[7.5, 4.5], [7 - 0.33, 4.5], [8.33, 4.5], [7.5, 3.67], [7.5, 5.33], [6.78, 3.78]]) {
        const s = game(world, side, x, y)
        const before = JSON.stringify([s.view, s.map.version, s.map.tiles, s.flags, s.hero])
        assert.equal(Z.risesUnderHero(s, to), true, `${x},${y}`)
        assert.equal(Z.setViewRule(s, to), false, `${x},${y}`)
        assert.equal(JSON.stringify([s.view, s.map.version, s.map.tiles, s.flags, s.hero]), before)
      }
      // Beside it, and past its corner: the turn goes through.
      for (const [x, y] of [[7 - 0.35, 4.5], [8.35, 4.5], [7.5, 3.65], [6.7, 3.7], [3.5, 8.5]]) {
        const s = game(world, side, x, y)
        const v = s.map.version
        assert.equal(Z.setViewRule(s, to), true, `${x},${y}`)
        assert.equal(s.view, to)
        assert.ok(s.map.version > v, 'the pictures are made again')
        assert.ok(!inSolid(world, s), `${x},${y}`)
      }
      // A block that goes down under the hero is no reason to refuse (and the same side is always granted).
      const s = game(world, side, 7.5, 4.5)
      assert.equal(Z.setViewRule(s, side), true)
    }
  })

  it('is refused while the hook\'s chain crosses a block that would rise', () => {
    const world = worldOf({ '7,4': '◇', '11,4': '|' })
    const s = game(world, 'flat')
    Object.assign(s.inv, { hook: true, selected: 'hook' })
    let refused = 0
    run(world, s, 60, { bPress: true }, () => { if (s.hook && s.hook.x > 7 && s.hero.x < 7) { assert.equal(Z.setViewRule(s, 'iso'), false); refused++ } })
    assert.ok(refused > 0)
    assert.ok(s.hero.x > 10 && !s.hook)
    assert.equal(Z.setViewRule(s, 'iso'), true, 'and granted once the pull is over')
  })

  /** Is Luna (a point: she has no collision) in a block that is up? */
  const lunaIn = s => Z.blockUp(at(s, Math.floor(s.luna.x), Math.floor(s.luna.y)), s.view)
  /** A hero walking north over the block at (7, 4) in the view where it is down, Luna behind on the trail. */
  function followed(t, toY) {
    const side = t === '□' ? 'iso' : 'flat'
    const world = worldOf({ '7,4': t })
    const s = game(world, side, 7.5, 6.5, 'up')
    s.luna = { x: 7.5, y: 7.6, dir: 'up', walkT: 0, trail: [{ x: 7.5, y: 7.6 }, { x: 7.5, y: 6.5 }], psi: 0 }
    for (let i = 0; i < 200 && s.hero.y > toY; i++) run(world, s, 1, { move: { x: 0, y: -Math.min(1, (s.hero.y - toY) * 6 + 0.1) } })
    return { world, s, to: side === 'iso' ? 'flat' : 'iso' }
  }

  it('does not let Luna stand in a block that rose on her trail', () => {
    for (const [t] of BLOCKS) {
      // The hero stops just past the block: the point she walks to lies in it.
      const { world, s, to } = followed(t, 3.66)
      run(world, s, 30, {})
      assert.deepEqual([Math.floor(s.luna.x), Math.floor(s.luna.y)], [7, 4], 'she is on the block as it lies')
      assert.equal(Z.setViewRule(s, to), true)
      assert.ok(!lunaIn(s), t)
      assert.deepEqual([s.luna.x, s.luna.y], [s.hero.x, s.hero.y], 'at the hero\'s heels')
      run(world, s, 90, {}, () => assert.ok(!lunaIn(s), `${t} standing: ${s.luna.x},${s.luna.y}`))
    }
  })

  it('keeps her out of it from any distance, whenever the turn comes, standing and walking on', () => {
    let heels = 0
    let stayed = 0
    for (const [t] of BLOCKS) {
      for (let toY = 3.64; toY > 1.4; toY -= 0.11) {
        for (const wait of [0, 4, 12, 40]) {
          const { world, s, to } = followed(t, toY)
          run(world, s, wait, {})
          const was = { x: s.luna.x, y: s.luna.y }
          if (!Z.setViewRule(s, to)) continue
          if (s.luna.x === was.x && s.luna.y === was.y) stayed++
          else heels++
          const clear = () => assert.ok(!lunaIn(s), `${t} ${toY.toFixed(2)} after ${wait}: ${s.luna.x},${s.luna.y}`)
          clear()
          assert.ok(s.luna.trail.every(p => !Z.blockUp(at(s, Math.floor(p.x), Math.floor(p.y)), s.view)), 'no point of the trail lies in a block')
          run(world, s, 40, {}, clear)
          run(world, s, 40, { move: { x: 1, y: 0 } }, clear)
          run(world, s, 40, { move: { x: 0, y: 1 } }, clear)
          run(world, s, 40, { move: { x: -1, y: 0 } }, clear)
        }
      }
    }
    assert.ok(heels > 0 && stayed > 0, `${heels} brought up, ${stayed} left where they were`)
  })

  it('leaves her where she is when her way is open', () => {
    const world = worldOf({ '7,4': '◇' })
    const s = game(world, 'flat', 3.5, 4.5)
    s.luna = { x: 2.2, y: 4.5, dir: 'right', walkT: 0, trail: [{ x: 2.2, y: 4.5 }, { x: 3.5, y: 4.5 }], psi: 0 }
    assert.equal(Z.setViewRule(s, 'iso'), true)
    assert.deepEqual([s.luna.x, s.luna.y, s.luna.trail.length], [2.2, 4.5, 2])
  })

  it('does not bother a map without view blocks', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1 })
    const v = s.map.version
    assert.equal(Z.hasViewBlocks(s.map), false)
    assert.equal(Z.setViewRule(s, 'flat'), true)
    assert.equal(s.map.version, v)
  })

  it('comes back beside the spot when a block has risen where a fall would put the hero', () => {
    const world = worldOf({ '7,4': '◇', '9,4': 'O' })
    const s = game(world, 'iso', 9.5, 4.5)
    s.hero.safe = { x: 7.5, y: 4.5 }
    s.hero.act = 'fall'
    s.hero.actT = 1
    run(world, s, 1, {})
    assert.ok(!inSolid(world, s))
  })

  it('is saved nowhere', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'turnroom', entry: 'start' } })
    s.inv.sword = true
    assert.equal(Z.setViewRule(s, 'flat'), true)
    const save = Z.toSave(s)
    assert.ok(!('view' in save))
    assert.doesNotMatch(JSON.stringify(save), /"view"|"flat"|"iso"/)
    const again = Z.createGame(Z.WORLD, { save: Z.parseSave({ ...JSON.parse(JSON.stringify(save)), view: 'flat' }) })
    assert.equal(again.view, 'iso')
  })
})

describe('a condition on the view', () => {
  const marks = {
    g: { ent: { t: 'gate', open: { view: 'flat' } } },
    c: { ent: { t: 'chest', id: 'fix.late', item: 'bits5', appear: { view: 'flat' } } },
    n: { ent: { t: 'npc', id: 'who', look: 'keeper', talk: [{ when: { view: 'flat' }, lines: ['FLAT.'] }, { lines: ['DEEP.'] }] } },
    S: { ent: { t: 'sign', lines: ['DEEP SIGN.'], alt: { when: { view: 'flat' }, lines: ['FLAT SIGN.'] } } },
  }
  const world = () => { const w = worldOf({}, marks); w.maps.fix.rows = rows({ '2,9': '@', '5,2': 'g', '9,2': 'c', '4,6': 'n', '8,6': 'S' }); return w }

  it('holds in its own view only', () => {
    const w = world()
    const s = game(w, 'iso', 2.5, 8.5)
    for (const side of SIDES) {
      assert.equal(Z.condMet(s, w, { view: side }, 0), side === 'iso')
    }
    s.view = 'flat'
    assert.equal(Z.condMet(s, w, { view: 'flat' }, 0), true)
  })

  it('opens gates and raises chests (for good), and chooses what a person and a sign say', () => {
    for (const side of SIDES) {
      const w = world()
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
  })
})

// ---- the validator ------------------------------------------------------------------------------------------

describe('the validator on a map with view blocks', () => {
  const line = (y, t) => Object.fromEntries(Array.from({ length: 14 }, (_, i) => [`${i + 1},${y}`, t]))
  const chest = { c: { ent: { t: 'chest', id: 'fix.chest', item: 'bits5' } } }
  const check = (at, marks = {}, extra = {}) => { const w = worldOf(at, marks, extra); return Z.validateWorld(w) }

  it('walks the routes in both states: a chest behind one row of each, with ground to turn on, is reached', () => {
    assert.deepEqual(check({ ...line(4, '◇'), ...line(7, '□'), '5,2': 'c' }, chest), [])
    // A row that is a wall one way only is no wall.
    assert.deepEqual(check({ ...line(4, '□'), '5,2': 'c' }, chest), [])
    assert.deepEqual(check({ ...line(4, '◇'), '5,2': 'c' }, chest), [])
  })

  it('finds a chest no turning reaches: the two rows with nowhere to turn between them', () => {
    const bad = check({ ...line(4, '◇'), ...line(5, '□'), '5,2': 'c' }, chest)
    assert.deepEqual(bad, ['fix: chest at 5,2 is unreachable'])
  })

  it('finds a warp and an entry no turning reaches', () => {
    const marks = { w: { ent: { t: 'warp', to: 'fix', entry: 'start' } }, e: { ent: { t: 'entry', id: 'far', dir: 'down' } } }
    const bad = check({ ...line(4, '◇'), ...line(5, '□'), '5,2': 'w', '9,2': 'e' }, marks)
    assert.ok(bad.includes('fix: entry at 9,2 is unreachable from the entry at 2,9 in either view') || bad.includes('fix: entry at 2,9 is unreachable from the entry at 9,2 in either view'), bad.join('\n'))
    const warpOnly = check({ ...line(4, '◇'), ...line(5, '□'), '5,2': 'w' }, { w: marks.w })
    assert.deepEqual(warpOnly, ['fix: warp at 5,2 is unreachable'])
  })

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

  it('takes the hook over a block that is down, where that is the only way across', () => {
    for (const [t] of BLOCKS) assert.deepEqual(check(strait(t), chest), [], t)
    assert.deepEqual(check(strait('~'), chest), [], 'over plain water')
    // It is the only way: no post, no crossing. A wall in the path stops the chain in both views.
    assert.deepEqual(check(strait('◇', { post: '#' }), chest), LOST)
    assert.deepEqual(check(strait('#'), chest), LOST)
    // One of each: in either view one stands in the chain's way, and the water gives nowhere to turn.
    assert.deepEqual(check(strait('◇', { near: '□' }), chest), LOST)
  })

  it('and the game agrees: across in the view where the block is down, not in the other', () => {
    for (const [t] of BLOCKS) {
      for (const side of SIDES) {
        const world = worldOf(strait(t), chest)
        const s = game(world, side, 5.5, 6.5, 'up')
        Object.assign(s.inv, { hook: true, selected: 'hook' })
        run(world, s, 90, { bPress: true })
        assert.ok(upIn(t, side) ? s.hero.y === 6.5 : s.hero.y < 2.6, `${t} in ${side}: ${s.hero.y}`)
      }
    }
  })

  it('wants every entry and landing on ground that is floor in both views, naming the map and the tile', () => {
    for (const [t] of BLOCKS) {
      const w = worldOf({ '9,6': t }, {}, { entries: { back: { x: 9.5, y: 6.5, dir: 'down' } } })
      assert.deepEqual(Z.validateWorld(w), [`fix: entry back lands on 9,6 ('${t}'), which is not free in both views`])
    }
    // A marker entry with a block for its tile.
    const marker = check({ '9,6': 'e' }, { e: { ent: { t: 'entry', id: 'm', dir: 'down' }, tile: '□' }, r: { ent: { t: 'warp', to: 'fix', entry: 'm' } } })
    assert.ok(marker.includes("fix: entry m lands on 9,6 ('□'), which is not free in both views"), marker.join('\n'))
    // The step out of a door.
    const out = worldOf({ '9,7': '◇' }, {}, { entries: { door: { x: 9.5, y: 6.5, dir: 'down', out: true } } })
    assert.deepEqual(Z.validateWorld(out), ["fix: the step out of entry door lands on 9,7 ('◇'), which is not free in both views"])
    // A warp from another map: the landing is named on the map that holds the blocks.
    const two = worldOf({ '9,6': '◇' }, {}, { entries: { far: { x: 9.5, y: 6.5, dir: 'down' } } })
    two.maps.other = { id: 'other', name: 'O', kind: 'dungeon', track: 'dungeon', rows: rows({ '2,9': '@', '6,6': 'w' }), marks: { '@': { ent: { t: 'entry', id: 'start' } }, w: { ent: { t: 'warp', to: 'fix', entry: 'far' } } } }
    assert.deepEqual(Z.validateWorld(two), ["fix: entry far lands on 9,6 ('◇'), which is not free in both views"])
    // A hole above.
    const holes = worldOf({ '9,6': '□' })
    holes.maps.up = { id: 'up', name: 'U', kind: 'dungeon', track: 'dungeon', below: 'fix', cell: { w: 16, h: 12 }, rows: rows({ '2,9': '@', '9,6': 'O' }), marks: { '@': { ent: { t: 'entry', id: 'start' } } } }
    assert.deepEqual(Z.validateWorld(holes), ["fix: the hole of up lands on 9,6 ('□'), which is not free in both views"])
  })

  it('wants both views allowed', () => {
    assert.deepEqual(check({ '9,6': '□' }, {}, { views: ['iso', 'classic'] }), [])
    for (const views of [['iso'], ['classic']]) {
      assert.deepEqual(check({ '9,6': '□' }, {}, { views }), [`fix: has a view block at 9,6 ('□') but allows only ${views[0]} (a map with view blocks allows both views)`])
    }
    // A map without them may pin what it likes.
    assert.deepEqual(check({}, {}, { views: ['iso'] }), [])
  })
})

// ---- the Turn Room ------------------------------------------------------------------------------------------

describe('the Turn Room', () => {
  const def = () => Z.WORLD.maps.turnroom
  const start = (side) => {
    const s = Z.createGame(Z.WORLD, { seed: 11, at: { map: 'turnroom', entry: 'start' } })
    s.inv.sword = true
    assert.equal(Z.setViewRule(s, side), true)
    return s
  }
  const other = side => (side === 'iso' ? 'flat' : 'iso')

  it('is one dungeon room in both views, with two signs, a chest of twenty bits and nothing else', () => {
    const d = def()
    assert.equal(d.kind, 'dungeon')
    assert.deepEqual([d.rows.length, d.rows[0].length, d.cell], [12, 16, { w: 16, h: 12 }])
    assert.deepEqual([...d.views].sort(), ['classic', 'iso'])
    assert.equal(d.look, Z.WORLD.maps.puzzlelab.look)
    const info = Z.mapInfo(Z.WORLD, 'turnroom')
    assert.deepEqual(info.chestList.map(c => [c.id, c.item, c.appear]), [['turnroom.prize', 'bits20', undefined]])
    assert.deepEqual(info.marks.map(m => m.ent.t).sort(), ['chest', 'entry', 'sign', 'sign', 'warp'])
    assert.deepEqual([...info.signs.values()].map(s => s.lines), [
      ['SQUARE FOR FLAT. DIAMOND FOR DEEP.', "(SOMEBODY HAS UNDERLINED 'STAND CLEAR'.)"],
      ['THE TURN ROOM. SOME THINGS ARE ONLY THERE FROM ONE SIDE.'],
    ])
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
  })

  it('lies behind a door in the Weigh House, one wall tile of the Puzzle Lab, and leads back to it', () => {
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
  })

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

  /**
   * Every place the hero can stand and every turn they can take there, on a fine grid: the fewest turns to stand
   * where the chest opens (a 0-1 search; walking is free, a turn costs one), or null with no way.
   */
  function fewest(from, maxTurns = Infinity) {
    const s = start(from)
    const STEP = 1 / 8
    const info = Z.mapInfo(Z.WORLD, 'turnroom')
    const chest = info.chestList[0]
    const opens = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => Math.floor(x + dx * 0.8) === chest.x && Math.floor(y + dy * 0.8) === chest.y)
    const k = (x, y, side) => `${Math.round(x / STEP)},${Math.round(y / STEP)},${side}`
    const best = new Map([[k(s.hero.x, s.hero.y, from), 0]])
    const q = [[s.hero.x, s.hero.y, from, 0]]
    while (q.length) {
      const [x, y, side, n] = q.shift()
      if (n > best.get(k(x, y, side))) continue
      if (opens(x, y)) return n
      s.view = side
      Object.assign(s.hero, { x, y })
      const go = (nx, ny, ns, nn, front) => {
        if (nn > maxTurns) return
        const key = k(nx, ny, ns)
        if (best.has(key) && best.get(key) <= nn) return
        best.set(key, nn)
        if (front) q.unshift([nx, ny, ns, nn])
        else q.push([nx, ny, ns, nn])
      }
      if (!Z.risesUnderHero(s, other(side))) go(x, y, other(side), n + 1, false)
      for (const [dx, dy] of [[STEP, 0], [-STEP, 0], [0, STEP], [0, -STEP]]) {
        // (The door leads out of the room.)
        if (y + dy < 11 && !Z.circleBlocked(Z.WORLD, s.map, x + dx, y + dy, Z.HERO_R)) go(x + dx, y + dy, side, n, true)
      }
    }
    return null
  }

  it('takes four turns at the fewest from the isometric view, three from the 8-bit one', () => {
    assert.equal(fewest('iso'), 4)
    assert.equal(fewest('flat'), 3)
    assert.equal(fewest('iso', 3), null)
    assert.equal(fewest('flat', 2), null)
  })

  it('meets a player who arrives in the isometric view with a wall: they must turn at once', () => {
    const s = start('iso')
    assert.ok(!walkTo(s, 8.5, 7.5), 'the diamonds stand')
    assert.ok(s.hero.y > 9)
    const t = start('flat')
    assert.ok(walkTo(t, 8.5, 6.5), 'in the 8-bit view they are floor')
    assert.ok(!walkTo(t, 8.5, 3.5), 'and the squares come next')
  })

  it('cannot be solved with no turn', () => {
    for (const side of SIDES) assert.equal(fewest(side, 0), null, side)
  })

  it('is solved by a scripted player in those turns', () => {
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

  it('needs two turns from two different tiles for the stagger alone', () => {
    const s = start('iso')
    Object.assign(s.hero, { x: 3.5, y: 3.5 })
    assert.ok(!walkTo(s, 7.9, 1.9), 'the diamonds stand in the isometric view')
    Object.assign(s.hero, { x: 4.5, y: 1.9 })
    assert.equal(Z.setViewRule(s, 'flat'), true)
    assert.ok(walkTo(s, 7.9, 1.9))
    assert.ok(walkTo(s, 8.5, 2.5))
    assert.ok(!walkTo(s, 11.35, 2.5), 'the squares stand in the 8-bit one')
    Object.assign(s.hero, { x: 8.2, y: 2.5 })
    assert.equal(Z.setViewRule(s, 'iso'), true)
    assert.ok(walkTo(s, 11.35, 2.5))
  })

  it('refuses a turn from either row\'s line: STAND CLEAR is met on purpose', () => {
    for (const [y, side] of [[8.5, 'flat'], [5.5, 'iso']]) {
      for (let x = 1.5; x < 15; x++) {
        const s = start(side)
        Object.assign(s.hero, { x, y })
        assert.ok(!inSolid(Z.WORLD, s), `${x},${y} is floor while the row is down`)
        assert.equal(Z.setViewRule(s, other(side)), false, `${x},${y}`)
        assert.equal(s.view, side)
      }
    }
  })

  it('never leaves the hero inside a solid tile, whatever turns are tried along the way, from either side', () => {
    // Every order: at the start of each leg, and half way along each leg that crosses a row, a turn is tried or not.
    const legs = ROUTE.map((p, i) => ({ to: p, mid: p.need ? { x: ((i ? ROUTE[i - 1].x : 8.5) + p.x) / 2, y: ((i ? ROUTE[i - 1].y : 10.5) + p.y) / 2 } : null }))
    const chances = legs.length + legs.filter(l => l.mid).length
    assert.equal(chances, 12)
    for (const from of SIDES) {
      let granted = 0
      let refused = 0
      let solved = 0
      for (let order = 0; order < 1 << chances; order++) {
        const s = start(from)
        const check = () => assert.ok(!inSolid(Z.WORLD, s), `${from} ${order}: inside at ${s.hero.x},${s.hero.y} in ${s.view}`)
        let bit = 0
        const chance = () => {
          if (!(order & (1 << bit++))) return
          if (Z.setViewRule(s, other(s.view))) granted++
          else refused++
          check()
        }
        for (const leg of legs) {
          chance()
          if (leg.mid) { walkTo(s, leg.mid.x, leg.mid.y, check); chance() }
          walkTo(s, leg.to.x, leg.to.y, check)
        }
        if (Math.hypot(s.hero.x - 11.35, s.hero.y - 2.5) < 0.1) solved++
      }
      assert.ok(granted > 1000 && refused > 100 && solved > 0, `${from}: ${granted} granted, ${refused} refused, ${solved} through`)
    }
  })

  it('never does either with a stick and turns at random', () => {
    let seed = 99
    const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
    for (const from of SIDES) {
      const s = start(from)
      let move = { x: 0, y: -1 }
      for (let i = 0; i < 20000; i++) {
        if (rnd() < 0.05) { const a = rnd() * Math.PI * 2; move = { x: Math.cos(a), y: Math.sin(a) } }
        if (rnd() < 0.08) Z.setViewRule(s, other(s.view))
        // (Not out of the door.)
        if (s.hero.y > 10.4) move = { x: move.x, y: -Math.abs(move.y) }
        Z.stepGame(Z.WORLD, s, 1 / 60, inp(s.mode === 'play' ? { move, rollPress: rnd() < 0.02, aPress: rnd() < 0.02 } : { aPress: i % 20 === 0 }))
        if (s.map.id === 'turnroom') assert.ok(!inSolid(Z.WORLD, s), `${from} ${i}: ${s.hero.x},${s.hero.y} in ${s.view}`)
      }
    }
  })
})

// ---- the moment of the turn, and the shell ------------------------------------------------------------------

describe('the moment of a turn', () => {
  /** The renderer's turn, as the shell reads it. */
  const state = (t, dark = false) => ({ id: t.id, k: t.k, turning: t.turning, dark })

  it('turns the rule once, past the half toward the isometric picture and back at the half out of it', () => {
    const t = Z.createTurn(id => id === 'iso', 0.7)
    let side = 'flat'
    const flips = []
    const play = () => { for (let i = 0; i < 80; i++) { t.step(1 / 60); const next = Z.turnSide(t, side); if (next !== side) flips.push([next, t.k]); side = next } }
    t.set('iso')
    play()
    assert.equal(flips.length, 1)
    assert.ok(flips[0][0] === 'iso' && flips[0][1] > 0.5 && flips[0][1] < 0.53, String(flips[0]))
    t.set('classic')
    play()
    assert.equal(flips.length, 2)
    assert.ok(flips[1][0] === 'flat' && flips[1][1] <= 0.5 && flips[1][1] > 0.47, String(flips[1]))
    // Taken back before the half: nothing flips at all.
    t.set('iso')
    for (let i = 0; i < 15; i++) { t.step(1 / 60); side = Z.turnSide(t, side) }
    t.set('classic')
    play()
    assert.equal(flips.length, 2)
  })

  it('turns at once for an instant turn, and waits for a view that cannot draw yet', () => {
    const t = Z.createTurn(id => id === 'iso', 0.7)
    t.set('iso', true)
    assert.equal(Z.turnSide(t, 'flat'), 'iso')
    t.set('classic', true)
    assert.equal(Z.turnSide(t, 'iso'), 'flat')
    t.set('iso')
    for (let i = 0; i < 30; i++) t.step(1 / 60, false)
    assert.equal(Z.turnSide(t, 'flat'), 'flat')
    assert.equal(Z.viewSide('classic'), 'flat')
    assert.equal(Z.viewSide('iso'), 'iso')
  })

  it('takes a turn back before the half when the hero walks onto a block that would rise', () => {
    const world = worldOf({ '7,4': '□' })
    const s = game(world, 'iso', 5.5, 4.5)
    const vs = k => ({ id: 'classic', k, turning: true, dark: false })
    assert.equal(Z.ruleMove(s, vs(0.9), false), 'iso')
    s.hero.x = 7.5
    assert.equal(Z.ruleMove(s, vs(0.7), false), 'back')
    assert.equal(Z.ruleMove(s, vs(0.4), false), 'back')
    s.hero.x = 5.5
    assert.equal(Z.ruleMove(s, vs(0.4), false), 'flat')
    // No picture yet: no move.
    assert.equal(Z.ruleMove(s, { ...vs(0), dark: true }, false), null)
  })

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

  it('never turns the rule ahead of the picture while the engine is on its way: it turns when the picture does', async () => {
    const { s, t, back } = await late()
    assert.deepEqual([s.view, t.id, t.k, back], ['iso', 'iso', 1, 0])
  })

  it('takes a late view back where it would raise a block under the hero', async () => {
    // Walked on into the diamond row (floor in the 8-bit view) while the engine was coming.
    const { s, t, back } = await late({ x: 7.5, y: 8.5 })
    assert.equal(back, 1)
    assert.deepEqual([s.view, t.id], ['flat', 'classic'])
    assert.ok(!inSolid(Z.WORLD, s))
  })

  it('leaves the rule alone when the isometric engine\'s loader fails, so V can turn it and the room opens', async () => {
    const real = Z.ENGINE_LOADERS.iso
    Z.ENGINE_LOADERS.iso = () => Promise.reject(new Error('offline'))
    try {
      // As `showView` does it: fetch, add the engine, turn. The fetch fails: nothing is added.
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
      // The classic picture at rest says nothing about the rule, frame after frame.
      for (const side of SIDES) {
        Z.setViewRule(s, side)
        assert.equal(Z.ruleMove(s, state(t), loose), null)
      }
    } finally { Z.ENGINE_LOADERS.iso = real }
    // A round without an isometric view is the same.
    assert.equal(Z.ruleLoose(false, [{ engine: 'classic' }]), true)
    assert.equal(Z.ruleLoose(false, [{ engine: 'classic' }, { engine: 'iso' }]), false)
  })

  const shell = readFileSync(join(root, 'Zelda.vue'), 'utf8')
  const body = name => { const from = shell.indexOf(`function ${name}(`); assert.ok(from > 0, name); return shell.slice(from, shell.indexOf('\n}\n', from)) }

  it('is turned by one call in the shell, beside the dress, and the world holds still for it', () => {
    assert.equal(shell.split('setViewRule(').length - 1, 1)
    assert.match(body('turnRule'), /setViewRule\(state, side\)[^]*ruleTurned = true/)
    assert.match(shell, /stepRule\(renderer\.viewState\(\)\)\s*stepDress\(renderer\.viewState\(\)\)\s*syncUnit\(\)/)
    const frame = body('frame')
    const hold = frame.indexOf('if (ruleTurned) { ruleTurned = false; syncDeck(); drawFrame(nowMs, dt); return }')
    assert.ok(hold > 0 && hold < frame.indexOf('input.read()') && hold < frame.indexOf('stepGame('))
    // Asked again after the step, before the picture moves on: no turn is refused at its half.
    assert.match(frame.slice(frame.indexOf('stepGame(')), /fitView\(\)[^]*?stepRule\(renderer\.viewState\(\)\)[^]*?drawFrame\(nowMs, dt\)/)
    // A reload by the same call.
    assert.match(body('begin'), /const side = state\.view\s*state = createGame\([^\n]*\)\s*turnRule\(side\)/)
  })

  it('never turns the rule ahead of the picture: not at mount, not for a turn a map makes', () => {
    // A visit starts on the classic picture, and so does the rule.
    assert.match(shell, /turnRule\('flat'\)/)
    assert.doesNotMatch(shell, /turnRule\([^)]*firstView/)
    // A map's turn only asks for the picture: at once on a map with view blocks, behind the door's fade.
    assert.match(body('forceView'), /void showView\(id, hasViewBlocks\(state\.map\), false\)/)
    assert.doesNotMatch(body('forceView') + body('fitView'), /turnRule|setViewRule/)
    assert.equal(body('fitView').split('forceView(').length - 1, 2)
    // A view that arrives after the hero walked onto a block does not set out; only a visitor's own press turns the
    // rule alone when the fetch fails.
    const show = body('showView')
    // (And says why, over no "Classic view" of the corner's own.)
    assert.match(show, /if \(!rulesAlone\(\) && risesUnderHero\(state, viewSide\(def\.engine\)\)\) \{\s*viewId\.value = viewShown[^]*?cn\.rest = viewShown\s*syncDress\(\)\s*turnRefuse\(STAND_CLEAR, 'Stand clear'\)/)
    assert.match(show, /if \(remember && hasViewBlocks\(state\.map\) && !turnRule/)
    assert.match(body('turnBack'), /showView\(back, false, askKept\)/)
  })

  it('reads the turn again once it is drawn, so a press between two frames finds the rule on the picture\'s side', () => {
    assert.match(body('drawFrame'), /renderer\.draw\(state, ui, dt\)[^]*if \(vs\.turning && !vs\.waiting\) \{ stepRule\(vs\); stepDress\(renderer\.viewState\(\)\) \}/)
    // The case itself: a turn drawn past its half and pressed back at once. Seen after the draw, the rule has turned
    // and the press back turns it again; unseen, it would stay behind while the dress went over.
    const t = Z.createTurn(id => id === 'iso', 0.7)
    t.set('iso', true)
    t.set('classic')
    let side = 'iso'
    while (t.k > 0.5) { t.step(1 / 60); side = Z.turnSide(t, side) }
    assert.equal(side, 'flat')
    t.set('iso')
    assert.equal(Z.turnSide(t, side), 'flat', 'back to the isometric rule only past the half again')
  })

  it('leaves the stick to the picture: it turns smoothly with it', () => {
    assert.match(body('frame'), /const turn = state\.mode === 'dialog' \? 0 : renderer\.viewState\(\)\.turn\s*const inp = turn \? \{ \.\.\.raw, move: turnMove\(raw\.move, turn\) \} : raw/)
    assert.doesNotMatch(shell, /heldTurn/)
  })

  it('says STAND CLEAR on the corner, and turns the rule alone where the isometric picture cannot be had', () => {
    const cycle = body('cycleView')
    assert.match(cycle, /if \(hasViewBlocks\(state\.map\) && rulesAlone\(\)\) \{ flipRule\(\); return \}/)
    assert.match(cycle, /risesUnderHero\(state, viewSide\(def\.engine\)\)\) \{ turnRefuse\(STAND_CLEAR, 'Stand clear'\); return \}/)
    assert.match(body('turnBack'), /turnRefuse\(STAND_CLEAR, 'Stand clear'\)/)
    assert.match(body('flipRule'), /if \(!turnRule\(to\)\) \{ turnRefuse\(STAND_CLEAR, 'Stand clear'\); return \}/)
    const show = body('showView')
    assert.match(show, /engineLost\.set\(def\.engine, 'fetch'\)/)
    assert.match(show, /hasViewBlocks\(state\.map\) && !turnRule\(viewSide\(def\.engine\)\)/)
    assert.match(body('viewFailed'), /engineLost\.set\(def\.engine, 'throw'\)/)
    assert.match(body('stepCorner'), /const rule = hasViewBlocks\(s\.map\) && rulesAlone\(\) \? s\.view : null/)
  })

  it('keys the rule on a view\'s engine, never its id', () => {
    for (const name of ['turnRule', 'stepRule', 'turnBack', 'flipRule', 'forceView', 'cycleView']) assert.doesNotMatch(body(name), /(id|viewId\.value|viewShown|next|back)\s*[!=]==\s*'(classic|iso)'/, name)
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

  it('tells a square from a diamond by shape on screen, up and down, in both pictures', () => {
    for (const face of SIDES) {
      for (const up of [true, false]) {
        const square = cornered(onScreen('square', up, face))
        const diamond = cornered(onScreen('diamond', up, face))
        assert.ok(square > 0.82, `square ${face} up ${up}: ${square}`)
        assert.ok(diamond < 0.68, `diamond ${face} up ${up}: ${diamond}`)
      }
    }
  })

  it('draws a block up as stone with a cut, and down as an outline on the floor', () => {
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

  it('cuts the isometric block\'s sides from plain stone', () => {
    const { x, y, w, h } = Z.SIDE_PATCH
    for (const [, shape] of BLOCKS) {
      const px = Z.viewBlockPixels(shape, true, 'iso')
      for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) assert.equal(px[j * 16 + i], Z.BLOCK_INK.top, `${shape} ${i},${j}`)
    }
  })

  it('stands up in the isometric view only while up', () => {
    for (const [t] of BLOCKS) {
      assert.equal(Z.shapeOf(t, 'dungeon', () => '.', false, true), Z.CARD)
      assert.equal(Z.shapeOf(t, 'dungeon', () => '.', false, false), Z.FLAT)
    }
  })

  it('charts a block that is down as floor and one that is up as wall, by the view', () => {
    const info = Z.mapInfo(Z.WORLD, 'turnroom')
    const inks = Z.chartInks(info.def)
    for (const side of SIDES) {
      const px = Z.chartPixels(info, info.base, undefined, () => true, { fog: false, view: side })
      // The square row (y 5) and the diamond row (y 8).
      for (const [y, t] of [[5, '□'], [8, '◇']]) {
        const got = new Set(px.slice(y * 16 + 1, y * 16 + 15))
        if (upIn(t, side)) assert.ok([...got].every(c => c === inks.wall || c === inks.face), `${t} ${side}: ${[...got]}`)
        else assert.ok([...got].every(c => c === inks.ground || c === inks.ground2), `${t} ${side}: ${[...got]}`)
      }
    }
    // The cached chart follows a turn.
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'turnroom', entry: 'start' } })
    const a = Z.chartLayer(Z.WORLD, s).px[8 * 16 + 3]
    Z.setViewRule(s, 'flat')
    assert.notEqual(Z.chartLayer(Z.WORLD, s).px[8 * 16 + 3], a)
  })

  it('names the rule on the MAP page\'s Prism where it turns alone, over the 8-bit chart', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'turnroom', entry: 'start' } })
    const page = (rule, round) => Z.mapPageFor(Z.WORLD, s, 390, 600, { keys: Z.TOUCH_KEYS, e: 0, css: 1, deck: 520, rule, round }, Z.NEON_SKIN).layout
    assert.equal(page(null).plate.text, '8-BIT')
    assert.equal(page('iso').plate.text, 'ISO')
    assert.equal(page('flat').plate.text, '8-BIT')
    assert.ok(page('iso', [{ engine: 'classic' }]).gem, 'and a Prism to turn it by')
    assert.equal(page(null, [{ engine: 'classic' }]).gem, null)
  })

  it('shows the rule as a badge beside the corner, and a gem to turn it by', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'turnroom', entry: 'start' } })
    const plain = Z.renderCorner(Z.WORLD, s, { e: 0 })
    const left = p => p.px.filter((c, i) => c && i % p.w < 66 && Math.floor(i / p.w) < 20).length
    assert.equal(left(plain), 0)
    const pics = SIDES.map(rule => Z.renderCorner(Z.WORLD, s, { e: 0, rule }))
    for (const p of pics) assert.ok(left(p) > 40)
    assert.notDeepEqual(pics[0].px, pics[1].px)
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 0, round: [{ engine: 'classic' }], rule: 'flat' }).gem, true)
    assert.equal(Z.cornerShape(Z.WORLD, s, { e: 0, round: [{ engine: 'classic' }] }).gem, false)
    assert.deepEqual(Z.RULE_TAGS, { flat: '8-BIT', iso: 'ISO' })
    assert.equal(Z.STAND_CLEAR, 'STAND CLEAR')
    assert.ok(Z.textWidth(Z.STAND_CLEAR) + 6 <= Z.CORNER_W - 2, 'the tag holds the words')
  })
})
