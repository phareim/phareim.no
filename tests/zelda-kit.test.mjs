// The dungeon kit (docs/games/neon-shrine.md): the Sacred Weights as items, trap gates, the bosses' bars (what counts
// as open), the big key's words per dungeon, the B items a save may hold, the room left under the profile's save cap,
// the key-carrier that must fall for good, and the sprites' data gate. Pure: fixtures are built here, no map of the
// world is added.
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
/** The font and the touch deck's names (the wrap check of `zelda-world.test.mjs`), the sprites, the save caps. */
let X
before(async () => {
  Z = await load()
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { wrapText } from '../base/pixel/font'; export { subst, TOUCH_KEYS } from './keys';
        export { itemSpriteName } from './render/itemIcon'; export { SPRITES, PAL } from './render/sprites';
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
// The Sacred Weights, and the sprites
// ---------------------------------------------------------------------------

describe('the Sacred Weights', () => {
  it('are held up and read like any find; seven are held, counted and come back from a save', () => {
    const def = { id: 'room', name: 'ROOM', kind: 'interior', track: 'indoor', rows: ['#####', '#@w.#', '#####'], marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, w: { ent: { t: 'item', id: 'room.weight', item: 'weightFingers' } } } }
    const W = { maps: { room: def }, start: { map: 'room', entry: 'start' } }
    const g = Z.createGame(W, { seed: 1 })
    g.mode = 'play'
    g.dialog = null
    const ev = []
    for (let k = 0; k < 120 && g.mode !== 'dialog'; k++) ev.push(...Z.stepGame(W, g, 1 / 60, inp({ move: { x: 1, y: 0 } })))
    assert.ok(ev.some(e => e.type === 'itemGet' && e.item === 'weightFingers'))
    assert.equal(g.dialog.lines[0], 'YOU GOT A SACRED WEIGHT!')
    for (const l of g.dialog.lines) fits(l)
    assert.ok(g.flags['took:room.weight'] && Z.hasWeight(g, 'weightFingers'))
    // All seven, and one of them twice.
    const s = Z.createGame(Z.WORLD, { seed: 1, at: { map: 'overworld', entry: 'hut' } })
    s.inv.sword = true
    assert.equal(Z.weightCount(s), 0)
    for (const w of Z.WEIGHTS) {
      Z.grant(s, w.id)
      for (const l of Z.itemText(s, w.id)) fits(l)
    }
    Z.grant(s, 'weightNo')
    assert.equal(Z.weightCount(s), 7)
    const back = Z.createGame(Z.WORLD, { save: roundTrip(s) })
    assert.equal(Z.weightCount(back), 7)
    for (const w of Z.WEIGHTS) assert.ok(Z.hasWeight(back, w.id), w.id)
    assert.equal(Z.condMet(back, Z.WORLD, { item: 'weightCredit' }, -1), true)
  })

  it('every item the world hands out has a picture, and every sprite is drawn in the palette\'s letters', () => {
    const items = new Set(['artHop', ...Z.WEIGHTS.map(w => w.id)])
    for (const def of Object.values(Z.WORLD.maps)) for (const m of Object.values(def.marks)) {
      if (m.ent.item) items.add(m.ent.item)
      for (const b of m.ent.talk ?? []) if (b.give) items.add(b.give)
    }
    for (const item of items) assert.ok(X.SPRITES[X.itemSpriteName(item)], `${item}: ${X.itemSpriteName(item)}`)
    for (const [name, { rows }] of Object.entries(X.SPRITES)) {
      for (const row of rows) for (const ch of row) if (ch !== '.' && !X.PAL[ch]) assert.fail(`${name}: '${ch}' is not a palette letter`)
    }
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
  it('is refused outside a dungeon\'s rooms, with a condition of its own; a gate without either is too', () => {
    const bad = (change) => { const W = dungeon(FOE); change(W.maps.dun); return Z.validateWorld(W).join('\n') }
    assert.match(bad(d => { d.kind = 'interior'; delete d.cell }), /trap gate outside/)
    assert.match(bad(d => { d.marks['!'] = { ent: { t: 'gate', trap: true, open: { flag: 'x' } } } }), /condition of its own/)
    assert.match(bad(d => { d.marks['!'] = { ent: { t: 'gate' } } }), /nothing opens/)
  })

  it('shuts once, behind a hero who walks in and once its doorway is clear, and they cannot walk back out', () => {
    // A foe in the doorway, then a block, and the hero already in the room: it waits for both.
    const w = play()
    w.at(20, 5.9)
    const foe = w.s.map.enemies[0]
    foe.x = 16.5; foe.y = 5.5
    w.go(inp(), 5)
    assert.equal(w.tiles(), '..')
    foe.x = 29.5
    w.s.map.tiles[6 * 32 + 16] = 'b'
    w.go(inp(), 5)
    assert.equal(w.tiles(), '.b')
    w.s.map.tiles[6 * 32 + 16] = '.'
    w.go()
    assert.equal(w.tiles(), 'XX')
    // Walked in: open while the hero is on its tiles, shut behind them, once, and not saved.
    const r = play()
    assert.equal(r.tiles(), '..')
    r.walkIn(16.9)
    assert.equal(r.tiles(), '..', 'the hero is on its tiles')
    r.walkIn(18)
    assert.equal(r.tiles(), 'XX')
    r.go(inp({ move: { x: -1, y: 0 } }), 120)
    assert.ok(r.s.hero.x >= 17 + Z.HERO_R - 0.01, `stopped at ${r.s.hero.x}`)
    assert.equal(r.s.zoneIndex, 1)
    assert.equal(shuts(r.ev).length, 1, 'once')
    assert.equal(r.s.flags[r.flag], undefined)
  })

  it('opens for good when the room is clear, the save keeping it, and never shuts on a room with no foes', () => {
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
    // No foes, a statue only, or a foe that has fallen for good: it stays open.
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

  it('stands open again after a death, a warp out or leaving the room, the foes and the push blocks back', () => {
    const r = play({ put: [[29, 9, 'z'], [29, 2, 'z'], [20, 3, 'b']], marks: blob })
    const back = () => { Object.assign(r.s.hero, { x: 10, y: 5.9 }); for (let k = 0; k < 120 && (r.s.zoneIndex !== 0 || r.s.mode !== 'play'); k++) r.go(); assert.equal(r.s.zoneIndex, 0) }
    const again = what => {
      assert.equal(r.tiles(), '..', what)
      assert.equal(r.s.flags[r.flag], undefined, what)
      r.walkIn(19)
      assert.ok(r.s.map.enemies.every(e => !e.dead && e.hp === e.maxHp), `${what}: the foes are back`)
      assert.equal(r.tiles(), 'XX', what)
    }
    r.walkIn(19)
    assert.equal(r.tiles(), 'XX')
    // A death.
    r.s.map.enemies[0].hp = 1
    Z.hurtHero(Z.ctx(r.W, r.s, r.ev), 99, 25, 5)
    assert.equal(r.s.mode, 'dying')
    for (let k = 0; k < 200 && r.s.mode !== 'play'; k++) r.go()
    assert.equal(r.s.mode, 'play')
    assert.ok(r.s.hero.x < 16, 'back at the stair')
    again('after a death')
    // A warp out and back.
    Z.enterMap(r.W, r.s, 'out', 'start', r.ev)
    Z.enterMap(r.W, r.s, 'dun', 'start', r.ev)
    again('after a warp')
    // One falls, and the hero gets out another way (set down in the other room).
    Z.killEnemy(Z.ctx(r.W, r.s, r.ev), r.s.map.enemies[0])
    back()
    again('after leaving the room')
    // A beaten room's push blocks go home too: it is a fight, not a puzzle.
    r.kill()
    r.go()
    r.s.map.tiles[3 * 32 + 20] = '.'
    r.s.map.tiles[3 * 32 + 21] = 'b'
    back()
    r.walkIn(19)
    assert.deepEqual([r.s.map.tiles[3 * 32 + 20], r.s.map.tiles[3 * 32 + 21]], ['b', '.'])
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

  it('turns away the hook, the disc, a bomb, a pushed block, a roll and a hop, all of which pass it open', () => {
    for (const open of [true, false]) {
      // The hook.
      const h = inner(open, [[27, 5, '|']])
      h.s.inv.selected = 'hook'
      h.go(B)
      h.go(inp(), 90)
      assert.equal(h.ev.some(e => e.type === 'hookHit'), open)
      assert.equal(h.ev.some(e => e.type === 'clank'), !open)
      if (open) assert.ok(h.s.hero.x > 25, 'pulled through')
      else assert.equal(h.s.hero.x, 20.5)
      // The disc, before what stands behind it.
      const d = inner(open, [[26, 5, 'q']], { q: { ent: { t: 'enemy', kind: 'sentry' } } })
      d.at(22.5, 5.5)
      d.s.inv.selected = 'disc'
      d.go(B)
      d.go(inp(), 90)
      assert.equal(d.ev.some(e => e.type === 'discHit'), open)
      // A pushed block (long enough for one push, not a second).
      const p = inner(open, [[23, 5, 'b']])
      p.at(22.5, 5.5)
      p.go(inp({ move: { x: 1, y: 0 } }), 32)
      assert.deepEqual([p.s.map.tiles[5 * 32 + 23], p.s.map.tiles[5 * 32 + 24]], open ? ['.', 'b'] : ['b', 'X'])
      // A roll: off a wall it springs.
      const r = inner(open)
      r.at(23, 6)
      r.go(ROLL(1, 0))
      r.go(inp(), 60)
      if (open) assert.ok(r.s.hero.x > 24.5, `through at ${r.s.hero.x}`)
      else assert.ok(r.s.hero.x < 24, `stopped at ${r.s.hero.x}`)
      assert.equal(r.ev.some(e => e.type === 'air' && e.kind === 'spring'), !open)
    }
    // The HOP, along the stick, into it shut.
    const hop = inner(false)
    Z.grant(hop.s, 'artHop')
    hop.at(23, 6)
    hop.go(inp({ move: { x: 1, y: 0 }, bPress: true }))
    assert.equal(hop.s.hero.act, 'air')
    hop.go(inp({ move: { x: 1, y: 0 } }), 40)
    assert.ok(hop.s.hero.x <= 24 - Z.HERO_R + 0.01, `${hop.s.hero.x}`)
    // A bomb is set at the hero's feet, not in it, and the gate stands through the blast.
    const b = inner(false)
    b.at(23.6, 5.5)
    b.s.inv.selected = 'bombs'
    b.go(B)
    assert.equal(b.s.map.bombs.length, 1)
    assert.ok(b.s.map.bombs[0].x < 24, `${b.s.map.bombs[0].x}`)
    b.go(inp(), 150)
    assert.ok(b.ev.some(e => e.type === 'boom'))
    assert.equal(b.tiles(), 'XX')
    assert.ok(!Object.keys(b.s.flags).some(f => f.startsWith('bomb:')))
    // And the gate does not shut while the hook's chain is out across it.
    const c = play({ inner: true, put: [[27, 5, '|'], [29, 9, 'z']], marks: blob })
    c.at(20.5, 5.5)
    c.s.inv.selected = 'hook'
    c.go(B)
    assert.ok(c.s.hook)
    while (c.s.hook) { assert.equal(c.tiles(), '..'); c.go() }
    c.go()
    assert.equal(c.tiles(), 'XX')
    assert.ok(c.s.hero.x > 25)
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

  it('gold exactly when the blade bites, for each of the six bosses in each of its states', () => {
    for (const [kind, cases] of Object.entries(CASES)) {
      for (const [mode, stun, open] of cases) {
        const { e } = boss(kind)
        e.ai.mode = mode
        e.stun = stun
        assert.equal(Z.bossOpen(e), open, `${kind} ${mode} stun ${stun}`)
        assert.equal(bites(kind, mode, stun), open, `the blade on a ${kind} ${mode} stun ${stun}`)
      }
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

  it('a save keeps the item in hand; one holding a name the game does not know loads with nothing, the rest kept', () => {
    const raw = save()
    // Each item in hand, and nothing, come back as they were.
    for (const selected of [...Z.B_ITEMS.map(b => b.id), null]) assert.equal(Z.parseSave({ ...raw, inv: { ...raw.inv, selected } })?.inv.selected, selected)
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
})
