// The dungeon kit (docs/games/neon-shrine.md): the Sacred Weights as items, trap gates, the bosses' bars (what counts
// as open), the big key's words per dungeon, the B items a save may hold, the room left under the profile's save cap,
// and the key-carrier that must fall for good. Pure: fixtures are built here, no map of the world is added.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from './zelda-load.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let Z
/** The font and the touch deck's names (the wrap check of `zelda-world.test.mjs`), the sprites, the icons, the caps. */
let X
before(async () => {
  Z = await load()
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { wrapText } from '../base/pixel/font'; export { subst, TOUCH_KEYS } from './keys';
        export { itemSpriteName, itemIconName } from './render/itemIcon'; export { SPRITES, PAL } from './render/sprites';
        export { saveGameById } from '../leaderboard/games'`,
      resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  X = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const B = inp({ bPress: true })
const ROLL = (x, y) => inp({ move: { x, y }, rollPress: true })

/** A page as the narrowest box shows it: in the pixel font, at most three rows of 180 px. */
function fits(line) {
  const shown = X.subst(line, X.TOUCH_KEYS)
  assert.match(shown, /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·↑↓←→\n]*$/, `not in the font: ${line}`)
  assert.ok(X.wrapText(shown, 180).length <= 3, `more than three rows: ${line}`)
}

/** A save as it goes over the wire and comes back. */
const roundTrip = s => Z.parseSave(JSON.parse(JSON.stringify({ ...Z.toSave(s), savedAt: 1 })))

// ---------------------------------------------------------------------------
// The Sacred Weights
// ---------------------------------------------------------------------------

describe('the Sacred Weights', () => {
  const WORDS = {
    weightMeaning: ['MEANING', 'seterfell'], weightReasons: ['REASONS', 'yulefjord'], weightNo: ['NO', 'sporelight'],
    weightSurprise: ['SURPRISE', 'stillsand'], weightFingers: ['FINGERS', 'rerun'], weightCredit: ['CREDIT', 'lumenby'],
    weightSources: ['SOURCES', 'fogstage'],
  }
  const fresh = () => Z.createGame(Z.WORLD, { seed: 1, at: { map: 'overworld', entry: 'hut' } })

  it('are seven, one a land, each with its word', () => {
    assert.deepEqual(Object.fromEntries(Z.WEIGHTS.map(w => [w.id, [w.word, w.land]])), WORDS)
    for (const w of Z.WEIGHTS) assert.ok(Z.WORLD.maps[w.land]?.away, `${w.land} is a land`)
  })

  it('grant nothing but their flag, count, and come back from a save', () => {
    const s = fresh()
    s.inv.sword = true
    assert.equal(Z.weightCount(s), 0)
    let n = 0
    for (const w of Z.WEIGHTS) {
      const inv = JSON.stringify(s.inv)
      const flags = Object.keys(s.flags)
      const hp = [s.hero.hp, s.hero.maxHp]
      assert.equal(Z.hasWeight(s, w.id), false)
      Z.grant(s, w.id)
      assert.equal(Z.hasWeight(s, w.id), true)
      assert.equal(Z.weightCount(s), ++n)
      assert.equal(JSON.stringify(s.inv), inv, `${w.id} touches no inventory field`)
      assert.deepEqual(Object.keys(s.flags).filter(f => !flags.includes(f)), [`item:${w.id}`])
      assert.deepEqual([s.hero.hp, s.hero.maxHp], hp)
    }
    // Held twice is held once.
    Z.grant(s, 'weightNo')
    assert.equal(Z.weightCount(s), 7)
    const back = Z.createGame(Z.WORLD, { save: roundTrip(s) })
    assert.equal(Z.weightCount(back), 7)
    for (const w of Z.WEIGHTS) assert.ok(Z.hasWeight(back, w.id), w.id)
    assert.equal(Z.condMet(back, Z.WORLD, { item: 'weightCredit' }, -1), true)
  })

  it('are told in a name plate and one page, three rows at most', () => {
    const s = fresh()
    for (const w of Z.WEIGHTS) {
      const lines = Z.itemText(s, w.id)
      const end = w.id === 'weightNo' ? 'IT IS THE SMALLEST. IT IS THE HEAVIEST.' : 'IT IS HEAVIER THAN IT LOOKS.'
      assert.deepEqual(lines, ['YOU GOT A SACRED WEIGHT!', `IT IS STAMPED ${w.word}. ${end}`])
      for (const l of lines) fits(l)
    }
  })

  it('are held up and read like any find', () => {
    const s = fresh()
    s.inv.sword = true
    s.dialog = null
    s.mode = 'play'
    const def = { id: 'room', name: 'ROOM', kind: 'interior', track: 'indoor', rows: ['#####', '#@w.#', '#####'], marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, w: { ent: { t: 'item', id: 'room.weight', item: 'weightFingers' } } } }
    const W = { maps: { room: def }, start: { map: 'room', entry: 'start' } }
    const g = Z.createGame(W, { seed: 1 })
    g.mode = 'play'
    g.dialog = null
    const ev = []
    for (let k = 0; k < 120 && g.mode !== 'dialog'; k++) ev.push(...Z.stepGame(W, g, 1 / 60, inp({ move: { x: 1, y: 0 } })))
    assert.ok(ev.some(e => e.type === 'itemGet' && e.item === 'weightFingers'))
    assert.equal(g.dialog.lines[0], 'YOU GOT A SACRED WEIGHT!')
    assert.ok(g.flags['took:room.weight'] && Z.hasWeight(g, 'weightFingers'))
  })

  it('share one picture of their own, never the coin', () => {
    const rows = X.SPRITES.item_weight?.rows
    assert.ok(rows, 'item_weight is a sprite')
    assert.equal(rows.length, 16)
    for (const r of rows) {
      assert.equal(r.length, 16)
      for (const ch of r) assert.ok(ch === '.' || X.PAL[ch], `not a palette letter: ${ch}`)
    }
    for (const w of Z.WEIGHTS) {
      assert.equal(X.itemSpriteName(w.id), 'item_weight')
      assert.notEqual(X.itemSpriteName(w.id), X.itemSpriteName('bits5'))
      assert.equal(Z.isWeight(w.id), true)
    }
    assert.equal(Z.isWeight('heartContainer'), false)
  })

  it('every item the world hands out has a picture that exists', () => {
    const items = new Set(['artHop', ...Z.WEIGHTS.map(w => w.id)])
    for (const def of Object.values(Z.WORLD.maps)) for (const m of Object.values(def.marks)) {
      if (m.ent.item) items.add(m.ent.item)
      for (const b of m.ent.talk ?? []) if (b.give) items.add(b.give)
    }
    for (const item of items) assert.ok(X.SPRITES[X.itemSpriteName(item)], `${item}: ${X.itemSpriteName(item)}`)
  })
})

// ---------------------------------------------------------------------------
// Trap gates
// ---------------------------------------------------------------------------

/**
 * Two rooms of 16×12 side by side, joined by a doorway on rows 5 and 6, and a one-room map beside them. The right
 * room's own wall at column 16 holds a trap gate; with `inner`, the gate stands in a wall across that room instead
 * (column 24), so that things can be thrown at it from within the room. `put`: [x, y, char] triples.
 */
function dungeon({ inner = false, put = [], marks = {} } = {}) {
  const gx = inner ? 24 : 16
  const grid = []
  for (let y = 0; y < 12; y++) {
    let r = ''
    for (let x = 0; x < 32; x++) {
      const edge = y === 0 || y === 11 || x % 16 === 0 || x % 16 === 15
      const door = (y === 5 || y === 6) && (x === 15 || x === 16)
      r += edge && !door ? '#' : '.'
    }
    grid.push(r.split(''))
  }
  if (inner) for (let y = 1; y < 11; y++) grid[y][24] = '#'
  grid[5][gx] = '!'
  grid[6][gx] = 'X'
  grid[5][3] = '@'
  for (const [x, y, ch] of put) grid[y][x] = ch
  const dun = {
    id: 'dun', name: 'DUNGEON', kind: 'dungeon', track: 'dungeon', keyring: 'kit', cell: { w: 16, h: 12 },
    rows: grid.map(r => r.join('')),
    marks: {
      '@': { ent: { t: 'entry', id: 'start', dir: 'right' } },
      '!': { ent: { t: 'gate', trap: true } },
      ...marks,
    },
  }
  const out = {
    id: 'out', name: 'OUT', kind: 'interior', track: 'indoor', rows: ['#####', '#.@.#', '#####'],
    marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } } },
  }
  return { maps: { dun, out }, start: { map: 'dun', entry: 'start' } }
}

const blob = { z: { ent: { t: 'enemy', kind: 'blob' } } }
const FOE = { put: [[29, 9, 'z']], marks: blob }

/** A game on the fixture, the hero armed; `go` steps it; foes stand stunned, so that only the gate moves. */
function play(opts = FOE) {
  const W = dungeon(opts)
  const s = Z.createGame(W, { seed: 5 })
  s.mode = 'play'
  s.dialog = null
  Object.assign(s.inv, { sword: true, bombBag: true, bombs: 8, hook: true, disc: true, keyrings: {} })
  s.hero.maxHp = s.hero.hp = 30
  const ev = []
  const hold = () => { for (const e of s.map.enemies) e.stun = 999 }
  const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) { hold(); ev.push(...Z.stepGame(W, s, 1 / 60, i)) } }
  const gx = opts.inner ? 24 : 16
  const tiles = () => [s.map.tiles[5 * 32 + gx], s.map.tiles[6 * 32 + gx]].join('')
  const flag = `gate:dun.${gx},5`
  const kill = () => { for (const e of s.map.enemies) if (!e.dead && e.kind !== 'eye') Z.killEnemy(Z.ctx(W, s, ev), e) }
  /** Stand the hero somewhere, in the room that holds it. */
  const at = (x, y, dir = 'right') => {
    Object.assign(s.hero, { x, y, dir, aim: { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[dir], knock: null })
    s.zoneIndex = Z.cellIndex(Z.mapInfo(W, s.map.id), x, y)
    s.zone = Z.cellRect(Z.mapInfo(W, s.map.id), s.zoneIndex)
  }
  /** Walk east from the entry, through the doorway, until the hero is `x` far. */
  const walkIn = (x = 19.5) => {
    for (let k = 0; k < 600 && (s.hero.x < x || s.mode !== 'play'); k++) go(inp({ move: { x: 1, y: 0 } }))
    assert.ok(s.hero.x >= x, `walked to ${s.hero.x.toFixed(2)}`)
  }
  return { W, s, ev, go, tiles, flag, kill, at, walkIn }
}
const shuts = ev => ev.filter(e => e.type === 'gate' && e.shut)

describe('a trap gate', () => {
  it('passes the validator', () => {
    assert.deepEqual(Z.validateWorld(dungeon(FOE)), [])
    assert.deepEqual(Z.validateWorld(dungeon({ ...FOE, inner: true })), [])
  })

  it('lets the validator through to what lies behind it, the hook included', () => {
    // A chest beyond the inner gate, and one that only the gate's doorway leads to.
    const marks = { ...blob, c: { ent: { t: 'chest', id: 'kit.chest', item: 'bits5' } } }
    assert.deepEqual(Z.validateWorld(dungeon({ inner: true, put: [[29, 9, 'z'], [29, 2, 'c']], marks })), [])
  })

  it('is refused outside a dungeon\'s rooms, with a condition of its own; a gate without either is too', () => {
    const bad = (change) => { const W = dungeon(FOE); change(W.maps.dun); return Z.validateWorld(W).join('\n') }
    assert.match(bad(d => { d.kind = 'interior'; delete d.cell }), /trap gate outside/)
    assert.match(bad(d => { d.marks['!'] = { ent: { t: 'gate', trap: true, open: { flag: 'x' } } } }), /condition of its own/)
    assert.match(bad(d => { d.marks['!'] = { ent: { t: 'gate' } } }), /nothing opens/)
  })

  it('is floor on entry, on the map and in what the map is made from', () => {
    const r = play()
    assert.equal(r.tiles(), '..')
    const info = Z.mapInfo(r.W, 'dun')
    assert.equal(info.base[5 * 32 + 16] + info.base[6 * 32 + 16], '..')
    assert.deepEqual(info.gates.map(g => [g.tiles.length, g.cell, !!g.trap]), [[2, 1, true]])
    r.go(inp(), 60)
    assert.equal(r.tiles(), '..', 'the hero is in the other room')
  })

  it('shuts only once the hero is in its room and clear of its tiles', () => {
    const r = play()
    // Just short of the room, and in the doorway on the gate itself: open.
    r.at(15.5, 5.9)
    r.go(inp(), 10)
    assert.equal(r.tiles(), '..')
    for (const x of [16.1, 16.7, 17.2]) {
      r.at(x, 5.9)
      r.go(inp(), 10)
      assert.equal(r.tiles(), '..', `on the gate at ${x}`)
    }
    assert.equal(shuts(r.ev).length, 0)
    r.at(17.4, 5.9)
    r.s.shake = 0
    r.go()
    assert.equal(r.tiles(), 'XX')
    assert.deepEqual(shuts(r.ev).map(e => [e.x, e.y]), [[16.5, 5.5]])
    assert.ok(r.s.shake > 0, 'the room shakes')
    assert.equal(r.s.flags[r.flag], undefined, 'shut is not saved')
    r.go(inp(), 60)
    assert.equal(shuts(r.ev).length, 1, 'once')
  })

  it('shuts behind a hero who walks in, and they cannot walk back out', () => {
    const r = play()
    r.walkIn(18)
    assert.equal(r.tiles(), 'XX')
    r.go(inp({ move: { x: -1, y: 0 } }), 120)
    assert.ok(r.s.hero.x >= 17 + Z.HERO_R - 0.01, `stopped at ${r.s.hero.x}`)
    assert.equal(r.s.zoneIndex, 1)
  })

  it('waits for a walking foe or a block to leave its doorway', () => {
    const r = play()
    r.at(20, 5.9)
    const foe = r.s.map.enemies[0]
    foe.x = 16.5; foe.y = 5.5
    r.go(inp(), 5)
    assert.equal(r.tiles(), '..')
    foe.x = 29.5
    r.s.map.tiles[6 * 32 + 16] = 'b'
    r.go(inp(), 5)
    assert.equal(r.tiles(), '.b')
    r.s.map.tiles[6 * 32 + 16] = '.'
    r.go()
    assert.equal(r.tiles(), 'XX')
  })

  it('stays open with no foes: an empty room, a statue, a foe that has fallen for good', () => {
    for (const opts of [
      { put: [], marks: {} },
      { put: [[29, 9, 'e']], marks: { e: { ent: { t: 'enemy', kind: 'eye' } } } },
    ]) {
      const r = play(opts)
      r.walkIn(20)
      r.go(inp(), 60)
      assert.equal(r.tiles(), '..')
      assert.equal(r.s.flags[r.flag], undefined)
    }
    const once = { put: [[29, 9, 'z']], marks: { z: { ent: { t: 'enemy', kind: 'blob', once: 'kit.blob' } } } }
    const W = dungeon(once)
    const s = Z.createGame(W, { seed: 1 })
    s.flags['kit.blob'] = true
    Z.enterMap(W, s, 'dun', 'start', [])
    s.mode = 'play'
    s.dialog = null
    Object.assign(s.hero, { x: 20, y: 5.9 })
    s.zoneIndex = 1
    for (let k = 0; k < 30; k++) Z.stepGame(W, s, 1 / 60, inp())
    assert.equal(s.map.tiles[5 * 32 + 16], '.')
  })

  it('opens for good when the room is clear, and the save keeps it', () => {
    const r = play()
    r.walkIn(19)
    assert.equal(r.tiles(), 'XX')
    r.ev.length = 0
    r.kill()
    r.go()
    assert.equal(r.tiles(), '..')
    assert.equal(r.s.flags[r.flag], true)
    assert.ok(r.ev.some(e => e.type === 'gate' && !e.shut) && r.ev.some(e => e.type === 'secret'))
    const back = Z.createGame(r.W, { save: roundTrip(r.s) })
    assert.equal(back.flags[r.flag], true)
    assert.equal(back.map.tiles[5 * 32 + 16], '.')
    // The foe comes back with the room; the gate stays open for it.
    Object.assign(back, { mode: 'play', dialog: null, zoneIndex: 1 })
    Object.assign(back.hero, { x: 20, y: 5.9 })
    assert.ok(back.map.enemies.some(e => !e.dead))
    for (let k = 0; k < 30; k++) Z.stepGame(r.W, back, 1 / 60, inp())
    assert.equal(back.map.tiles[5 * 32 + 16], '.')
  })

  it('counts a room beaten before it ever shut', () => {
    const r = play()
    r.at(16.5, 5.9)
    r.go(inp(), 5)
    r.kill()
    r.go()
    assert.equal(r.s.flags[r.flag], true)
    assert.equal(r.ev.filter(e => e.type === 'gate').length, 0, 'nothing moved')
  })

  it('stands open again after a death, the room\'s foes back', () => {
    const r = play()
    r.walkIn(19)
    const foe = r.s.map.enemies[0]
    foe.hp = 1
    Z.hurtHero(Z.ctx(r.W, r.s, r.ev), 99, 25, 5)
    assert.equal(r.s.mode, 'dying')
    for (let k = 0; k < 200 && r.s.mode !== 'play'; k++) r.go()
    assert.equal(r.s.mode, 'play')
    assert.ok(r.s.hero.x < 16, 'back at the stair')
    assert.equal(r.tiles(), '..')
    assert.equal(r.s.flags[r.flag], undefined)
    assert.equal(r.s.map.enemies[0].hp, r.s.map.enemies[0].maxHp)
    r.walkIn(19)
    assert.equal(r.tiles(), 'XX')
  })

  it('stands open again after a warp out and back', () => {
    const r = play()
    r.walkIn(19)
    Z.enterMap(r.W, r.s, 'out', 'start', r.ev)
    Z.enterMap(r.W, r.s, 'dun', 'start', r.ev)
    assert.equal(r.tiles(), '..')
    assert.equal(r.s.flags[r.flag], undefined)
    r.walkIn(19)
    assert.equal(r.tiles(), 'XX')
  })

  it('stands open again when a room is entered anew, the room\'s foes reset', () => {
    // Two foes: one falls, the hero gets out another way (set down in the other room), and comes back.
    const r = play({ put: [[29, 9, 'z'], [29, 2, 'z']], marks: blob })
    r.walkIn(19)
    assert.equal(r.tiles(), 'XX')
    const [a] = r.s.map.enemies
    Z.killEnemy(Z.ctx(r.W, r.s, r.ev), a)
    Object.assign(r.s.hero, { x: 10, y: 5.9 })
    for (let k = 0; k < 120 && (r.s.zoneIndex !== 0 || r.s.mode !== 'play'); k++) r.go()
    assert.equal(r.s.zoneIndex, 0)
    assert.equal(r.tiles(), '..')
    r.walkIn(19)
    assert.ok(r.s.map.enemies.every(e => !e.dead), 'the foes are back')
    assert.equal(r.tiles(), 'XX')
  })

  it('leaves the room\'s push blocks to go home once beaten: it is a fight, not a puzzle', () => {
    const r = play({ put: [[29, 9, 'z'], [20, 3, 'b']], marks: blob })
    r.walkIn(19)
    r.kill()
    r.go()
    r.s.map.tiles[3 * 32 + 20] = '.'
    r.s.map.tiles[3 * 32 + 21] = 'b'
    Object.assign(r.s.hero, { x: 10, y: 5.9 })
    for (let k = 0; k < 120 && (r.s.zoneIndex !== 0 || r.s.mode !== 'play'); k++) r.go()
    r.walkIn(19)
    assert.equal(r.s.map.tiles[3 * 32 + 20], 'b')
    assert.equal(r.s.map.tiles[3 * 32 + 21], '.')
  })
})

describe('a shut trap gate is a wall', () => {
  /** The inner gate in a room with a foe, the hero west of it; `open`: the same room with the gate already beaten. */
  function inner(open, put = [], marks = {}) {
    const r = play({ inner: true, put: [[29, 9, 'z'], ...put], marks: { ...blob, ...marks } })
    if (open) r.s.flags[r.flag] = true
    r.at(20.5, 5.5)
    r.go()
    assert.equal(r.tiles(), open ? '..' : 'XX')
    r.ev.length = 0
    return r
  }

  it('turns the hook away', () => {
    const post = [[27, 5, '|']]
    for (const open of [true, false]) {
      const r = inner(open, post)
      r.s.inv.selected = 'hook'
      r.go(B)
      r.go(inp(), 90)
      assert.equal(r.ev.some(e => e.type === 'hookHit'), open)
      assert.equal(r.ev.some(e => e.type === 'clank'), !open)
      if (open) assert.ok(r.s.hero.x > 25, 'pulled through')
      else assert.equal(r.s.hero.x, 20.5)
    }
  })

  it('is not shut while the hook\'s chain is out', () => {
    const r = play({ inner: true, put: [[27, 5, '|'], [29, 9, 'z']], marks: blob })
    r.at(20.5, 5.5)
    r.s.inv.selected = 'hook'
    r.go(B)
    assert.ok(r.s.hook)
    while (r.s.hook) { assert.equal(r.tiles(), '..'); r.go() }
    r.go()
    assert.equal(r.tiles(), 'XX')
    assert.ok(r.s.hero.x > 25)
  })

  it('turns the disc back before what stands behind it', () => {
    for (const open of [true, false]) {
      const r = inner(open, [[26, 5, 'q']], { q: { ent: { t: 'enemy', kind: 'sentry' } } })
      r.at(22.5, 5.5)
      r.s.inv.selected = 'disc'
      r.go(B)
      r.go(inp(), 90)
      assert.equal(r.ev.some(e => e.type === 'discHit'), open)
    }
  })

  it('takes no bomb into it and stands through a blast', () => {
    const r = inner(false)
    r.at(23.6, 5.5)
    r.s.inv.selected = 'bombs'
    r.go(B)
    assert.equal(r.s.map.bombs.length, 1)
    // A wall in the way: the bomb is set at the hero's feet, west of the gate, not in it.
    assert.ok(r.s.map.bombs[0].x < 24, `${r.s.map.bombs[0].x}`)
    r.go(inp(), 150)
    assert.ok(r.ev.some(e => e.type === 'boom'))
    assert.equal(r.tiles(), 'XX')
    assert.ok(!Object.keys(r.s.flags).some(f => f.startsWith('bomb:')))
  })

  it('stops a pushed block', () => {
    for (const open of [true, false]) {
      const r = inner(open, [[23, 5, 'b']])
      r.at(22.5, 5.5)
      // (Long enough for one push, not a second.)
      r.go(inp({ move: { x: 1, y: 0 } }), 32)
      assert.equal(r.s.map.tiles[5 * 32 + 24], open ? 'b' : 'X')
      assert.equal(r.s.map.tiles[5 * 32 + 23], open ? '.' : 'b')
    }
  })

  it('stops a roll, and the air moves with it', () => {
    for (const open of [true, false]) {
      const r = inner(open)
      r.at(23, 6)
      r.go(ROLL(1, 0))
      r.go(inp(), 60)
      if (open) assert.ok(r.s.hero.x > 24.5, `through at ${r.s.hero.x}`)
      else assert.ok(r.s.hero.x < 24, `stopped at ${r.s.hero.x}`)
      assert.equal(r.ev.some(e => e.type === 'air' && e.kind === 'spring'), !open, 'off a wall a roll springs')
    }
    // The HOP, along the stick, into it.
    const r = inner(false)
    Z.grant(r.s, 'artHop')
    r.at(23, 6)
    r.go(inp({ move: { x: 1, y: 0 }, bPress: true }))
    assert.equal(r.s.hero.act, 'air')
    r.go(inp({ move: { x: 1, y: 0 } }), 40)
    assert.ok(r.s.hero.x <= 24 - Z.HERO_R + 0.01, `${r.s.hero.x}`)
  })

  it('stops a foe', () => {
    const r = inner(false)
    assert.equal(Z.solidTile(r.W, r.s.map, 24, 5, 'enemy'), true)
    assert.equal(Z.solidTile(r.W, r.s.map, 24, 5, 'fly'), true)
    assert.equal(Z.solidTile(r.W, r.s.map, 24, 5, 'hero'), true)
  })
})

// ---------------------------------------------------------------------------
// The bosses' bars: what counts as open
// ---------------------------------------------------------------------------

describe('bossOpen', () => {
  /** A lone foe in a room, a tile east of the hero, facing them. */
  function boss(kind) {
    const def = {
      id: 'room', name: 'ROOM', kind: 'interior', track: 'boss', rows: ['##########', '#........#', '#........#', '#..@..z..#', '#........#', '#........#', '##########'],
      marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, z: { ent: { t: 'enemy', kind, dir: 'left' } } },
    }
    const W = { maps: { room: def }, start: { map: 'room', entry: 'start' } }
    const s = Z.createGame(W, { seed: 3 })
    s.mode = 'play'
    s.dialog = null
    const e = s.map.enemies[0]
    return { W, s, e }
  }
  /** Does a blow of the blade from the front take hit points off it in this state? */
  function bites(kind, mode, stun = 0) {
    const { W, s, e } = boss(kind)
    Object.assign(e.ai, { mode, t: 1 })
    e.stun = stun
    e.invuln = 0
    const hp = e.hp
    Z.hitEnemy(Z.ctx(W, s, []), e, 1, e.x - 2, e.y, 'sword')
    return e.hp < hp
  }
  /** [state, stun, open] */
  const CASES = {
    knight: [['walk', 0, false], ['tell', 0, false], ['charge', 0, false], ['dazed', 0, true], ['walk', 1, true]],
    king: [['float', 0, false], ['rise', 0, false], ['down', 0, true]],
    llama: [['walk', 0, false], ['aim', 0, false], ['rear', 0, false], ['charge', 0, false], ['dazed', 0, false], ['walk', 1, false]],
    mistral: [['float', 0, false], ['inhale', 0, false], ['blow', 0, false], ['spin', 0, false], ['rise', 0, false], ['down', 0, true]],
    deepseek: [['under', 0, false], ['rise', 0, false], ['up', 0, true], ['hauled', 0, true]],
    gemini: [['orbit', 0, true], ['orbit', 0.5, true], ['down', 0, false]],
  }

  it('knows the six bosses', () => {
    assert.deepEqual(Object.keys(CASES).sort(), [...Z.BIG].sort())
  })

  for (const [kind, cases] of Object.entries(CASES)) {
    it(`${kind}: gold exactly when the blade bites`, () => {
      for (const [mode, stun, open] of cases) {
        const { e } = boss(kind)
        e.ai.mode = mode
        e.stun = stun
        assert.equal(Z.bossOpen(e), open, `${kind} ${mode} stun ${stun}`)
        assert.equal(bites(kind, mode, stun), open, `the blade on a ${kind} ${mode} stun ${stun}`)
      }
    })
  }

  it('leaves the knight\'s back out: the blade bites there, but where the hero stands is not the knight\'s state', () => {
    const { W, s, e } = boss('knight')
    e.ai.mode = 'walk'
    assert.equal(Z.hitEnemy(Z.ctx(W, s, []), e, 1, e.x + 2, e.y, 'sword'), true)
    e.ai.mode = 'walk'
    assert.equal(Z.bossOpen(e), false)
  })

  it('is false for the fallen and for every other foe', () => {
    const { e } = boss('king')
    e.ai.mode = 'down'
    e.dead = true
    assert.equal(Z.bossOpen(e), false)
    for (const kind of Object.keys(Z.STATS).filter(k => !Z.BIG.has(k))) {
      const r = boss(kind)
      r.e.stun = 1
      r.e.ai.mode = 'down'
      assert.equal(Z.bossOpen(r.e), false, kind)
    }
  })
})

// ---------------------------------------------------------------------------
// The big key's words
// ---------------------------------------------------------------------------

describe('a big key', () => {
  const KING = 'THE BIG KEY! IT OPENS THE GREAT DOOR TO THE KING.'
  const HERE = 'THE BIG KEY! IT OPENS THE GREAT DOOR HERE.'

  it('names the King in the Shrine\'s ring, and "here" in every other', () => {
    const rings = new Map()
    for (const [id, def] of Object.entries(Z.WORLD.maps)) rings.set(def.keyring ?? 'shrine', id)
    assert.ok(rings.has('shrine') && rings.has('lab1') && rings.has('deep'))
    for (const [ring, id] of rings) {
      const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: id, entry: Object.keys(Z.mapInfo(Z.WORLD, id).entries)[0] } })
      assert.deepEqual(Z.itemText(s, 'bigKey'), [ring === 'shrine' ? KING : HERE], `${id} (${ring})`)
    }
    fits(KING)
    fits(HERE)
  })

  it('says so when it is picked up', () => {
    const r = play()
    const c = Z.ctx(r.W, r.s, [])
    assert.equal(r.s.map.ring, 'kit')
    Z.grant(c.s, 'bigKey')
    assert.deepEqual(Z.itemText(c.s, 'bigKey'), [HERE])
    assert.ok(r.s.flags['bigkey:kit'])
  })
})

// ---------------------------------------------------------------------------
// B items
// ---------------------------------------------------------------------------

describe('the B items', () => {
  const save = () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'overworld', entry: 'hut' } })
    Object.assign(s.inv, { sword: true, hook: true, disc: true, bombBag: true, bombs: 4 })
    Z.grant(s, 'artHop')
    return roundTrip(s)
  }

  it('are one table: ids, names and pictures that exist, in the cycle\'s order', () => {
    assert.deepEqual(Z.B_ITEMS.map(b => b.id), ['hook', 'disc', 'bombs', 'hop'])
    assert.deepEqual(Z.B_ITEMS.map(b => b.name), ['HOOK', 'DISC', 'BOMBS', 'HOP'])
    for (const b of Z.B_ITEMS) assert.ok(X.SPRITES[b.icon], b.icon)
    const g = Z.createGame(Z.WORLD, { save: save() })
    assert.deepEqual(Z.useItems(g), ['hook', 'disc', 'bombs', 'hop'])
    for (const b of Z.B_ITEMS) {
      g.inv.selected = b.id
      assert.equal(X.itemIconName(g), b.icon)
    }
    g.inv.selected = null
    assert.equal(X.itemIconName(g), '')
  })

  it('a save with each of them in hand loads with it in hand', () => {
    const raw = save()
    for (const b of Z.B_ITEMS) {
      const back = Z.parseSave({ ...raw, inv: { ...raw.inv, selected: b.id } })
      assert.equal(back?.inv.selected, b.id)
    }
    assert.equal(Z.parseSave({ ...raw, inv: { ...raw.inv, selected: null } }).inv.selected, null)
  })

  it('a save holding a name the game does not know loads with nothing in hand, the rest kept', () => {
    const raw = save()
    for (const selected of ['something-new', 'spade', '', 'toString', '__proto__', 7, {}, undefined]) {
      const back = Z.parseSave({ ...raw, inv: { ...raw.inv, selected } })
      assert.ok(back, `${String(selected)} loads`)
      assert.equal(back.inv.selected, null)
      assert.equal(back.inv.hook, true)
      assert.deepEqual(back.flags, raw.flags)
    }
    const g = Z.createGame(Z.WORLD, { save: Z.parseSave({ ...raw, inv: { ...raw.inv, selected: 'something-new' } }) })
    g.mode = 'play'
    g.dialog = null
    g.hero.auto = null
    const ev = Z.stepGame(Z.WORLD, g, 1 / 60, B)
    assert.ok(ev.some(e => e.type === 'error'), 'B with nothing in hand buzzes')
  })

  it('each does its own thing on B', () => {
    for (const [id, event] of [['hook', 'hook'], ['disc', 'disc'], ['bombs', 'bombPlace'], ['hop', 'air']]) {
      const r = play({ put: [], marks: {} })
      Z.grant(r.s, 'artHop')
      r.at(5.5, 5.5)
      r.s.inv.selected = id
      r.go(B)
      assert.ok(r.ev.some(e => e.type === event), `${id}: ${event}`)
    }
  })
})

// ---------------------------------------------------------------------------
// The save cap
// ---------------------------------------------------------------------------

/**
 * A save with everything in today's world done, built from the world's data (nobody plays it): every flag the data or
 * the engine could write for it, a full pack, and every map explored. An upper bound: a pit counts as filled and a
 * psi block as moved whether or not both can be.
 */
function fullSave() {
  const W = Z.WORLD
  const flags = new Set(['won', 'luna.home'])
  const items = new Set(['artHop'])
  // Every flag name the world's data speaks of.
  const walk = (o, seen) => {
    if (!o || typeof o !== 'object' || seen.has(o)) return
    seen.add(o)
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'string' && ['flag', 'set', 'once', 'lit', 'notFlag', 'clear'].includes(k)) flags.add(v)
      else if (Array.isArray(v) && ['flags', 'not', 'set'].includes(k)) for (const f of v) { if (typeof f === 'string') flags.add(f) }
      else walk(v, seen)
    }
  }
  walk(W, new Set())
  const s = Z.createGame(W, { seed: 3, at: { map: 'overworld', entry: 'hut' } })
  for (const [id, def] of Object.entries(W.maps)) {
    const info = Z.mapInfo(W, id)
    if (def.away) flags.add(`seen:${id}`)
    if (def.crystal) flags.add(`crystal:${def.crystal}`)
    for (const c of info.chestList) {
      flags.add(`chest:${c.id}`)
      if (c.appear) flags.add(`appear:${c.id}`)
      items.add(c.item)
    }
    for (const g of info.gates) flags.add(`gate:${g.id}`)
    for (const m of info.marks) {
      const e = m.ent
      if (e.t === 'item' || (e.t === 'shop' && e.once)) flags.add(`took:${e.id}`)
      if (e.t === 'item' || e.t === 'shop') items.add(e.item)
      if (e.t !== 'npc') continue
      for (const b of e.talk) if (b.give) {
        items.add(b.give)
        flags.add(`got:${e.id}:${b.give}`)
        if (b.set) flags.add(`got:${e.id}:${b.give}:${b.set}`)
      }
    }
    const puzzle = Z.puzzleInfo(info)
    for (const f of [...puzzle.receivers.values(), ...puzzle.valves.values(), ...[...puzzle.sockets.values()].map(so => so.flag)]) flags.add(f)
    info.base.forEach((t, i) => {
      if (t === 'R' || t === '%') flags.add(`bomb:${id}:${i}`)
      if (t === 'L' || t === 'K') { flags.add(`door:${id}:${i}`); flags.add(`bigkey:${def.keyring ?? 'shrine'}`) }
      if (t === 'O' && puzzle.on && !def.below) flags.add(`fill:${id}:${i}`)
      if (t === 'κ') flags.add(`boulder:${id}:${i}:${i}`)
      if (t === 'B') {
        if (def.below) flags.add(`drop:${def.below}:${i}`)
        if (def.kind !== 'dungeon') flags.add(`psi:${id}:${i}:${i}`)
      }
    })
    const w = def.rows[0].length
    Z.reveal(s, id, w, def.rows.length, { x: 0, y: 0, w, h: def.rows.length })
  }
  for (const item of items) flags.add(`item:${item}`)
  const rings = [...new Set(Object.values(W.maps).map(d => d.keyring ?? 'shrine'))].filter(r => r !== 'shrine')
  Object.assign(s.inv, {
    sword: true, arc: true, bombBag: true, bigBag: true, bombs: 20, disc: true, hook: true, prism: true, bigKey: true,
    bits: Z.MAX_BITS, keys: 9, pieces: 3, shrooms: 3, selected: 'bombs', arts: Z.ARTS.map(a => a.id),
    moves: Object.fromEntries(Z.MOVES.map(m => [m.id, 999])), keyrings: Object.fromEntries(rings.map(r => [r, 9])),
  })
  for (const f of flags) s.flags[f] = true
  s.elapsed = 359999.12345678901
  s.rng = -2147483648
  s.daytime = 719.9
  return { save: { ...Z.toSave(s), savedAt: 1_800_000_000_000 }, flags }
}

describe('the profile\'s save cap', () => {
  /** What the server measures (`server/api/save.post.ts`). */
  const size = o => JSON.stringify(o).length

  it('holds a full save of today\'s world with half of it to spare', () => {
    const { save, flags } = fullSave()
    const cap = X.saveGameById('zelda').maxBytes
    // It is a save the game reads back whole.
    const back = Z.parseSave(JSON.parse(JSON.stringify(save)))
    assert.ok(back)
    assert.equal(back.flags.length, flags.size)
    assert.deepEqual(Object.keys(back.explored).sort(), Object.keys(save.explored).sort())
    const bytes = size(save)
    // Seven dungeons to come, at 40 flags of 24 characters each.
    const more = Array.from({ length: 7 * 40 }, (_, i) => `dungeon.${String(i).padStart(16, '0')}`)
    assert.ok(more.every(f => f.length === 24))
    const added = size({ ...save, flags: [...save.flags, ...more] }) - bytes
    if (process.env.SAVE_SIZE) {
      const kinds = {}
      for (const f of save.flags) {
        const k = f.includes(':') ? f.slice(0, f.indexOf(':')) : '(named by the world)'
        const r = (kinds[k] ??= { n: 0, bytes: 0 })
        r.n++
        r.bytes += f.length + 3
      }
      console.log(`save: ${bytes} bytes; flags ${save.flags.length} in ${size(save.flags)}, explored ${size(save.explored)}, inv ${size(save.inv)}`)
      console.log(kinds)
      console.log(`seven dungeons add ${added}; together ${bytes + added}; cap ${cap}`)
    }
    assert.ok(bytes <= cap / 2, `a full save is ${bytes} bytes, the cap ${cap}`)
    assert.ok(bytes + added <= cap, `with seven dungeons ${bytes + added} bytes, the cap ${cap}`)
  })
})

// ---------------------------------------------------------------------------
// A key-carrier falls for good
// ---------------------------------------------------------------------------

describe('a foe that carries a key', () => {
  const carrier = more => ({ put: [[29, 9, 'k']], marks: { k: { ent: { t: 'enemy', kind: 'blob', carries: 'smallKey', ...more } } } })

  it('is refused without a once flag', () => {
    assert.match(Z.validateWorld(dungeon(carrier({}))).join('\n'), /carries a smallKey and has no once flag/)
    assert.deepEqual(Z.validateWorld(dungeon(carrier({ once: 'kit.carrier' }))), [])
  })

  it('with one, drops its key once: it does not come back with the room', () => {
    const r = play(carrier({ once: 'kit.carrier' }))
    r.walkIn(19)
    r.kill()
    r.go()
    assert.equal(r.s.map.drops.filter(d => d.kind === 'key').length, 1)
    Object.assign(r.s.hero, { x: 10, y: 5.9 })
    for (let k = 0; k < 120 && (r.s.zoneIndex !== 0 || r.s.mode !== 'play'); k++) r.go()
    r.walkIn(19)
    assert.ok(r.s.map.enemies.every(e => e.dead))
  })

  it('no map of the world has one without', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(p => /carries/.test(p)), [])
  })
})
