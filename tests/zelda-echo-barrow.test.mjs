// Neon Shrine, THE ECHO BARROW (docs/worlds/atlas.md "The Echo Barrow"; docs/games/neon-shrine.md "The Echo"): the
// map and its rules, the echo, the two rooms only the echo solves, Mixtral, the Shield Hall, and the whole way from
// the door in Seter Fell to the great lock, walked and fought by scripted players. The fights are the point: nobody
// plays them by hand before they ship, so a player who stands still must be hurt, and one who plays on what is drawn
// (the lane, the daze, the shields) must win.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8]
/** `ECHO_LOG=1`: how long each fight took and what it cost. */
const LOG = (what, r) => { if (process.env.ECHO_LOG) console.log(`${what}: ${r.won ? 'won' : 'lost'} in ${r.seconds.toFixed(1)} s, ${r.hurts} blows taken`) }
const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** The barrow's rooms by name: the top-left tile of each (cells of 16 × 12). */
const ROOM = {
  answering: [0, 0], parrot: [16, 0], shield: [32, 0],
  mixtral: [0, 12], hall: [16, 12], crossing: [32, 12],
  porch: [16, 24], stones: [32, 24],
}
/** A tile of a room, by the room's own coordinates. */
const T = (room, x, y) => [ROOM[room][0] + x, ROOM[room][1] + y]
const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]
const roomOf = s => Object.keys(ROOM).find(k => ROOM[k][0] === s.zone.x && ROOM[k][1] === s.zone.y)

/** A game in the barrow with the blade, standing at tile (x, y) of a room (its foes fresh, its gates as loaded). */
function at(room, x, y, { inv = {}, flags = [], seed = 3, hearts = 15, view = 'iso' } = {}) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map: 'echobarrow', entry: 'start' } })
  Object.assign(s.inv, { sword: true }, inv)
  for (const f of flags) s.flags[f] = true
  const [tx, ty] = T(room, x, y)
  Z.enterMap(Z.WORLD, s, 'echobarrow', 'start', [], { x: tx + 0.5, y: ty + 0.5 })
  s.view = view
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  s.hero.maxHp = s.hero.hp = hearts * 2
  return s
}

const step = (s, i = inp(), W = Z.WORLD) => Z.stepGame(W, s, 1 / FPS, i)
function run(s, frames, i = inp(), W = Z.WORLD) {
  const ev = []
  for (let k = 0; k < frames; k++) ev.push(...step(s, k ? { ...i, aPress: false, bPress: false, rollPress: false } : i, W))
  return ev
}
/** Left to stand `s` seconds. */
const wait = (s, secs, W = Z.WORLD) => run(s, Math.round(secs * FPS), inp(), W)
/** One swing facing `dir`, played out. */
function swing(s, dir, W = Z.WORLD) {
  s.hero.dir = dir
  s.hero.aim = undefined
  s.hero.cooldown = 0
  const ev = run(s, 1, inp({ aPress: true, a: true }), W)
  ev.push(...run(s, 30, inp(), W))
  return ev
}
/** B, with the echo in hand. */
function leave(s, dir, W = Z.WORLD) {
  s.inv.selected = 'echo'
  if (dir) s.hero.dir = dir
  const ev = run(s, 1, inp({ bPress: true }), W)
  ev.push(...run(s, 15, inp(), W))
  return ev
}

// ---- a room to try things in -----------------------------------------------------------------------------------

/** One 16 × 12 dungeon room with `put` ({ 'x,y': char }) in it; the hero starts at 2,9 with the blade and the echo. */
function lab(put = {}, marks = {}, extra = {}) {
  const rows = Array.from({ length: 12 }, (_, y) => Array.from({ length: 16 }, (_, x) =>
    put[`${x},${y}`] ?? (x === 2 && y === 9 ? '@' : x === 0 || y === 0 || x === 15 || y === 11 ? '#' : '.')).join(''))
  const W = {
    start: { map: 'lab', entry: 'start' },
    maps: { lab: { id: 'lab', name: 'LAB', kind: 'dungeon', track: 'dungeon', cell: { w: 16, h: 12 }, rows, marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'up' } }, ...marks }, ...extra } },
  }
  const s = Z.createGame(W, { seed: 5, at: W.start })
  Object.assign(s.inv, { sword: true, echo: true, selected: 'echo' })
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  s.hero.maxHp = s.hero.hp = 30
  const put2 = (x, y, dir) => { Object.assign(s.hero, { x: x + 0.5, y: y + 0.5, safe: { x: x + 0.5, y: y + 0.5 } }); if (dir) s.hero.dir = dir }
  return { W, s, hero: put2 }
}
/** An echo set down at (x, y) of a lab, facing `dir`, without walking there. */
function echoAt(s, x, y, dir = 'right') { s.echo = { x: x + 0.5, y: y + 0.5, dir, cut: null } }
/** Freeze a foe where it stands: a brain that decides nothing for a long while. */
function hold(e, mode = 'idle') { e.ai.mode = mode; e.ai.t = 999; e.stun = 0 }

// ================================================================================================================

describe('the Echo Barrow, the map', () => {
  it('passes the world\'s validator', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(p => /echobarrow|seterfell|atlas/.test(p)), [])
  })

  it('is a dungeon of eight rooms on its own keyring and crystals, in both views', () => {
    const def = Z.WORLD.maps.echobarrow
    assert.equal(def.kind, 'dungeon')
    assert.deepEqual(def.cell, { w: 16, h: 12 })
    assert.equal(def.keyring, 'echobarrow')
    assert.equal(def.crystal, 'echobarrow')
    assert.equal(def.name, 'THE ECHO BARROW')
    assert.deepEqual([...def.views].sort(), ['classic', 'iso'])
    assert.deepEqual([def.rows[0].length, def.rows.length], [48, 36])
    assert.equal(def.track, 'dungeon')
    assert.equal(def.cells['1,0'].track, 'boss')
    assert.equal(Object.keys(def.cells).length, 8)
    // The ninth cell is rock.
    for (let y = 24; y < 36; y++) assert.equal(def.rows[y].slice(0, 16), '#'.repeat(16))
  })

  it('has two small keys for two locked doors and one big key for one great lock', () => {
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    const runs = ch => {
      const seen = new Set()
      let n = 0
      info.base.forEach((t, i) => {
        if (t !== ch || seen.has(i)) return
        n++
        for (const q = [i]; q.length;) { const j = q.pop(); if (seen.has(j) || info.base[j] !== ch) continue; seen.add(j); q.push(j + 1, j - 1, j + info.w, j - info.w) }
      })
      return n
    }
    assert.equal(runs('L'), 2)
    assert.equal(runs('K'), 1)
    assert.deepEqual(info.chestList.filter(c => c.item === 'smallKey').map(c => c.id).sort(), ['echobarrow.key1', 'echobarrow.key2'])
    assert.equal(info.chestList.filter(c => c.item === 'bigKey').length, 1)
    assert.ok(info.marks.some(m => m.ent.t === 'item' && m.ent.id === 'echobarrow.heart' && m.ent.item === 'heartPiece'))
  })

  it('has no foe in the porch, the hall, the two puzzle rooms or the Parrot\'s room, and four a room at most', () => {
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    const foes = {}
    for (const m of info.marks) {
      if (m.ent.t !== 'enemy') continue
      const room = Object.keys(ROOM).find(k => m.x >= ROOM[k][0] && m.x < ROOM[k][0] + 16 && m.y >= ROOM[k][1] && m.y < ROOM[k][1] + 12)
      ;(foes[room] ??= []).push(m.ent.kind)
    }
    assert.deepEqual(Object.keys(foes).sort(), ['mixtral', 'shield', 'stones'])
    assert.deepEqual(foes.mixtral, ['mixtral'])
    assert.deepEqual(foes.shield, ['knight', 'knight'])
    assert.ok(foes.stones.length <= 4 && foes.stones.every(k => k === 'bat' || k === 'skull'), String(foes.stones))
  })

  it('opens its rooms only in order: each key, the echo, the crystals, then the great lock', () => {
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    const entry = info.entries.start
    /** Rooms reached on foot with the tiles in `open` given way; view blocks either way (a turn), crystals as `down`. */
    const reach = (open, down = '') => {
      const seen = new Set()
      const q = [Math.floor(entry.y) * info.w + Math.floor(entry.x)]
      const rooms = new Set()
      while (q.length) {
        const i = q.pop()
        if (seen.has(i)) continue
        seen.add(i)
        const x = i % info.w
        const y = Math.floor(i / info.w)
        rooms.add(Object.keys(ROOM).find(k => x >= ROOM[k][0] && x < ROOM[k][0] + 16 && y >= ROOM[k][1] && y < ROOM[k][1] + 12))
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < 0 || ny < 0 || nx >= info.w || ny >= info.h) continue
          const j = ny * info.w + nx
          const t = info.base[j]
          if (open.includes(j) || t === '□' || t === '◇' || down.includes(t) || !Z.TILE_INFO[t].solid) q.push(j)
        }
      }
      return [...rooms].sort()
    }
    const tiles = (room, ...xy) => xy.map(([x, y]) => { const [a, b] = T(room, x, y); return b * info.w + a })
    const west = tiles('hall', [0, 5], [0, 6])
    const east = tiles('hall', [14, 8], [14, 9], [15, 8], [15, 9])
    const great = tiles('hall', [7, 0], [8, 0])
    assert.deepEqual(reach([]), ['hall', 'porch', 'stones'])
    assert.deepEqual(reach(west), ['answering', 'hall', 'mixtral', 'porch', 'stones'])
    // East: the crossing's south side only; the crystals gate the way north.
    assert.deepEqual(reach([...west, ...east]), ['answering', 'crossing', 'hall', 'mixtral', 'porch', 'stones'])
    assert.ok(reach([...west, ...east], 'CP').includes('shield'))
    assert.ok(!reach([...west, ...east], 'CP').includes('parrot'))
    assert.ok(reach([...west, ...east, ...great], 'CP').includes('parrot'))
  })

  it('keeps the great lock shut without the Big Key, and opens it with it', () => {
    const [x, y] = T('hall', 7, 1)
    const s = at('hall', 7, 1)
    s.hero.dir = 'up'
    run(s, 60, inp({ move: { x: 0, y: -1 } }))
    run(s, 1, inp({ aPress: true, a: true }))
    assert.equal(s.mode, 'dialog')
    assert.match(s.dialog.lines[0], /GREAT LOCK/)
    P.settle(s)
    assert.equal(tile(s, x, y - 1), 'K')
    // Small keys do nothing to it, nor does another dungeon's big key.
    s.inv.keyrings = { echobarrow: 5 }
    s.inv.bigKey = true
    run(s, 60, inp({ move: { x: 0, y: -1 } }))
    assert.equal(tile(s, x, y - 1), 'K')
    s.flags['bigkey:echobarrow'] = true
    run(s, 20, inp({ move: { x: 0, y: -1 } }))
    assert.equal(tile(s, x, y - 1), '.')
    assert.equal(tile(s, x + 1, y - 1), '.')
  })

  it('shuts the hall\'s east way to a hero without the echo, key in hand or not', () => {
    const s = at('hall', 13, 8, { inv: { keyrings: { echobarrow: 1 } } })
    run(s, 90, inp({ move: { x: 1, y: 0 } }))
    const [gx, gy] = T('hall', 14, 8)
    assert.equal(tile(s, gx, gy), 'X')
    assert.equal(tile(s, gx + 1, gy), 'L')
    assert.equal(s.inv.keyrings.echobarrow, 1, 'the key is not spent')
    Z.grant(s, 'echo')
    run(s, 90, inp({ move: { x: 1, y: 0 } }))
    assert.equal(tile(s, gx, gy), '.')
    assert.equal(tile(s, gx + 1, gy), '.')
    assert.equal(s.inv.keyrings.echobarrow, 0)
  })

  it('leaves Seter Fell its size, with a way down in the Mounds, a sign, and the way back', () => {
    const fell = Z.WORLD.maps.seterfell
    assert.deepEqual([fell.rows[0].length, fell.rows.length], [72, 52])
    const info = Z.mapInfo(Z.WORLD, 'seterfell')
    const warp = info.warps.find(w => w.to === 'echobarrow')
    assert.deepEqual([warp.x, warp.y, warp.entry], [20, 26, 'start'])
    const mounds = fell.areas.find(a => a.name === 'THE MOUNDS')
    assert.ok(warp.x >= mounds.x && warp.x < mounds.x + mounds.w && warp.y >= mounds.y && warp.y < mounds.y + mounds.h)
    assert.deepEqual(info.signs.get(27 * info.w + 21).lines, ['THE ECHO BARROW.\nKNOCK, AND IT KNOCKS FIRST.'])
    // From the Mounds' entry on foot with the blade, down the stairs, and up again.
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'seterfell', entry: 'mounds' } })
    s.inv.sword = true
    s.mode = 'play'
    s.dialog = null
    P.walkTo(s, 20, 27)
    P.until(s, () => s.map.id === 'echobarrow' && s.mode === 'play', inp({ move: { x: 0, y: -1 } }))
    assert.deepEqual(s.entry, { map: 'echobarrow', entry: 'start' })
    assert.equal(roomOf(s), 'porch')
    P.until(s, () => s.map.id === 'seterfell' && s.mode === 'play', inp({ move: { x: 0, y: 1 } }))
    assert.ok(gap(s.hero, { x: 20.5, y: 27.5 }) < 0.1)
  })

  it('has the elder speak of the hall while its Weight is not held', () => {
    const k = Z.WORLD.maps.seterfell.marks.k.ent
    assert.deepEqual(k.talk[0].lines, ['MOUND ELDER: THE HALL UNDER US ANSWERS BACK. IT USED TO WAIT TO BE ASKED.'])
    assert.deepEqual(k.talk[0].when, { notFlag: 'item:weightMeaning' })
    assert.ok(k.talk.some(b => /PANTRY/.test(b.lines[0])), 'the pantry line is kept')
  })

  it('says the brief\'s words, and no others', () => {
    const def = Z.WORLD.maps.echobarrow
    const signs = Object.values(def.marks).flatMap(m => (m.ent.t === 'sign' ? m.ent.lines : []))
    assert.deepEqual(signs.sort(), [
      '(SOMEBODY SHOUTED HELLO IN HERE, LONG AGO. IT IS STILL GOING ROUND.)',
      'SOME STONES ARE ONLY THERE FROM ONE SIDE. TURN AND LOOK.',
      'THE DOOR OPENS FOR WHOEVER STANDS HERE. IT DOES NOT ASK WHO.',
    ].sort())
    const cards = Object.values(def.cells).flatMap(c => (c.events ?? []).flatMap(e => e.lines))
    assert.deepEqual(cards, ['MIXTRAL. EIGHT OPINIONS AND ONE HEADACHE.'])
    const s = at('hall', 7, 5)
    assert.deepEqual(Z.itemText(s, 'echo'), ['YOU GOT THE ECHO!', '{B} LEAVES ONE WHERE YOU STAND. WHEN YOU CUT, IT CUTS.'])
  })

  it('returns a hero who dies to the porch, with the opened doors still open', () => {
    const s = at('hall', 7, 5, { flags: ['bigkey:echobarrow'] })
    Z.hurtHero(Z.ctx(Z.WORLD, s, []), 99, s.hero.x + 1, s.hero.y)
    wait(s, 2.5)
    assert.equal(roomOf(s), 'porch')
    assert.equal(s.mode, 'play')
  })

  it('lends the Parrot\'s room two pots, and lends them again once the room holds none', () => {
    const s = at('parrot', 7, 6)
    const stands = [T('parrot', 3, 3), T('parrot', 12, 8)]
    const pots = () => stands.filter(([x, y]) => tile(s, x, y) === 'o').length
    assert.equal(pots(), 2)
    assert.equal(s.map.enemies.filter(e => e.cell === s.zoneIndex).length, 0, 'it stands empty')
    const lift = ([x, y]) => { Object.assign(s.hero, { x: x + 0.5, y: y + 1.45, dir: 'up' }); run(s, 1, inp({ aPress: true, a: true })); wait(s, 0.4); assert.equal(s.hero.carry, 'pot') }
    const toss = () => { Object.assign(s.hero, { x: ROOM.parrot[0] + 7.5, y: 6.5, dir: 'right' }); run(s, 1, inp({ aPress: true, a: true })); wait(s, 0.7) }
    lift(stands[0])
    toss()
    wait(s, 3)
    assert.equal(pots(), 1, 'one pot left: nothing comes back')
    lift(stands[1])
    wait(s, 3)
    assert.equal(pots(), 0, 'one in the hands: still nothing')
    toss()
    Object.assign(s.hero, { x: stands[0][0] + 0.5, y: stands[0][1] + 0.5 })
    wait(s, 3)
    assert.equal(pots(), 0, 'nor onto a stand the hero stands on')
    Object.assign(s.hero, { x: ROOM.parrot[0] + 7.5, y: 6.5 })
    wait(s, 0.2)
    assert.equal(pots(), 2)
  })
})

// ================================================================================================================

describe('the Echo', () => {
  it('is a B item: granted into the hand, cycled with the others, with its own icon', () => {
    const { s } = lab()
    s.inv.echo = false
    s.inv.selected = null
    assert.ok(!Z.useItems(s).includes('echo'))
    Z.grant(s, 'echo')
    assert.equal(s.inv.echo, true)
    assert.equal(s.inv.selected, 'echo')
    assert.deepEqual(Z.useItems(s), ['echo'])
    assert.equal(Z.B_ITEMS.find(b => b.id === 'echo').icon, 'item_echo')
  })

  it('leaves one where the hero stands, facing as the hero faced; B again moves it', () => {
    const { W, s, hero } = lab()
    assert.equal(s.echo, null)
    hero(5, 5, 'left')
    const ev = leave(s, 'left', W)
    assert.ok(ev.some(e => e.type === 'echo'))
    assert.deepEqual([s.echo.x, s.echo.y, s.echo.dir], [5.5, 5.5, 'left'])
    hero(9, 6)
    leave(s, 'down', W)
    assert.deepEqual([s.echo.x, s.echo.y, s.echo.dir], [9.5, 6.5, 'down'])
  })

  it('stays where it is while the hero walks about', () => {
    const { W, s, hero } = lab()
    hero(5, 5)
    leave(s, 'up', W)
    run(s, 90, inp({ move: { x: 1, y: 0 } }), W)
    assert.deepEqual([s.echo.x, s.echo.y], [5.5, 5.5])
  })

  it('is refused on a pit, water, a block that is down or in a door\'s tile, and keeps the one before', () => {
    const cases = [
      ['a pit', { '7,5': 'O' }], ['water', { '7,5': '~' }], ['a drained sluice', { '7,5': 'ψ' }, true], ['stairs', { '7,5': '>' }], ['a doorway', { '7,5': 'D' }],
      ['a cyan block that is down', { '7,5': 'C' }], ['a diamond block that is down', { '7,5': '◇' }, false, 'flat'], ['a square block that is down', { '7,5': '□' }, false, 'iso'],
    ]
    for (const [name, put, fine, view] of cases) {
      const { W, s } = lab(put)
      if (view) s.view = view
      const c = Z.ctx(W, s, [])
      assert.equal(Z.echoMayStand(c, 7.5, 5.5), !!fine, name)
      assert.equal(Z.echoMayStand(c, 4.5, 5.5), true, `${name}: plain floor beside it`)
    }
    // An opened lock, and a shutter's tiles, open or not.
    const { W, s } = lab({ '7,5': 'L', '9,5': 'X' }, { q: { ent: { t: 'gate', open: { flag: 'x' } }, tile: 'X' } })
    s.map.tiles[5 * 16 + 7] = '.'
    s.map.tiles[5 * 16 + 9] = '.'
    const c = Z.ctx(W, s, [])
    assert.equal(Z.echoMayStand(c, 7.5, 5.5), false, 'an opened locked door')
    // (The gate: a marked one.)
    const g = lab({ '9,5': 'q' }, { q: { ent: { t: 'gate', open: { flag: 'x' } }, tile: 'X' } })
    g.s.map.tiles[5 * 16 + 9] = '.'
    assert.equal(Z.echoMayStand(Z.ctx(g.W, g.s, []), 9.5, 5.5), false, 'an opened shutter')
    // And B there buzzes and moves nothing.
    const p = lab({ '7,5': '◇' })
    p.s.view = 'flat'
    echoAt(p.s, 3, 3)
    p.hero(7, 5)
    const ev = run(p.s, 2, inp({ bPress: true }), p.W)
    assert.ok(ev.some(e => e.type === 'error'))
    assert.deepEqual([p.s.echo.x, p.s.echo.y], [3.5, 3.5])
  })

  it('holds a light plate by itself, and counts as one weight on a heavy plate', () => {
    const marks = {
      p: { tile: 'θ', ent: { t: 'plate', id: 'light' } }, h: { tile: 'η', ent: { t: 'plate', id: 'heavy' } },
    }
    const { W, s, hero } = lab({ '5,5': 'p', '9,5': 'h' }, marks)
    hero(2, 2)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, [])
    echoAt(s, 5, 5)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, ['light'])
    // A heavy plate needs two: the echo is one, as the hero is, and the two together hold it.
    echoAt(s, 9, 5)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, [])
    hero(9, 5)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, ['heavy'])
    s.echo = null
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, [], 'the hero alone is one too')
  })

  it('weighs a scale pan as the hero does', () => {
    const marks = { p: { tile: 'σ', ent: { t: 'plate', id: 'scale' } } }
    const { W, s, hero } = lab({ '5,5': 'p', '9,5': 'p' }, marks)
    echoAt(s, 5, 5)
    hero(2, 2)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, [])
    hero(9, 5)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, ['scale'])
  })

  it('holds a plain plate down as a block does, and the gate it opens stays open', () => {
    const marks = { p: { tile: '_', ent: { t: 'plate', id: 'plain' } }, g: { tile: 'X', ent: { t: 'gate', open: { plates: ['plain'] } } } }
    const { W, s, hero } = lab({ '5,5': 'p', '9,0': 'g' }, marks)
    // (The hero alone does not hold a plain plate: unchanged.)
    hero(5, 5)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, [])
    hero(2, 2)
    echoAt(s, 5, 5)
    wait(s, 0.1, W)
    assert.deepEqual(s.map.plates, ['plain'])
    assert.equal(tile(s, 9, 0), '.')
  })

  it('cuts when the hero cuts: a lever out of the hero\'s reach', () => {
    const marks = { l: { tile: '}', ent: { t: 'lever', flag: 'pulled' } } }
    const { W, s, hero } = lab({ '11,4': 'l' }, marks)
    echoAt(s, 10, 4, 'down')
    hero(3, 8)
    wait(s, 0.3, W)
    assert.ok(!s.flags.pulled, 'not before the hero cuts')
    const ev = swing(s, 'left', W)
    assert.ok(ev.some(e => e.type === 'echoCut'))
    assert.ok(s.flags.pulled)
    assert.deepEqual([s.echo.x, s.echo.y, s.echo.dir], [10.5, 4.5, 'down'], 'it stays put and keeps its facing')
  })

  it('cuts a crystal switch, once a blow', () => {
    const { W, s, hero } = lab({ '10,3': 'c' }, {}, { crystal: 'lab' })
    echoAt(s, 10, 4, 'down')
    hero(3, 8)
    let ev = swing(s, 'left', W)
    assert.deepEqual(ev.filter(e => e.type === 'crystal').map(e => e.state), ['cyan'])
    wait(s, 0.6, W)
    ev = swing(s, 'left', W)
    assert.deepEqual(ev.filter(e => e.type === 'crystal').map(e => e.state), ['pink'])
  })

  it('shatters a pot it sweeps (the hero\'s own blade does not)', () => {
    // (The hero's pot is off the hero's shoulder: square in front, A would lift it.)
    const { W, s, hero } = lab({ '11,4': 'o', '4,7': 'o' })
    echoAt(s, 10, 4, 'down')
    hero(3, 8)
    swing(s, 'up', W)
    assert.equal(tile(s, 11, 4), '.')
    assert.equal(tile(s, 4, 7), 'o')
  })

  it('strikes a foe from where it stands with the hero\'s own damage, its blows of their own kind', () => {
    const { W, s, hero } = lab({ '11,4': 'k' }, { k: { ent: { t: 'enemy', kind: 'sentry' } } })
    const e = s.map.enemies[0]
    hold(e)
    echoAt(s, 10, 4, 'down')
    hero(2, 8)
    const hp = e.hp
    swing(s, 'left', W)
    assert.equal(hp - e.hp, Z.COMBO[0].dmg)
    // A second hit of the chain, then the finisher, are as hard as the hero's.
    e.hp = 20
    e.echoInvuln = 0
    s.hero.combo = { n: 1, t: 1 }
    swing(s, 'left', W)
    assert.equal(20 - e.hp, Z.COMBO[2].dmg)
    // With the Arc Blade, twice that.
    s.inv.arc = true
    e.hp = 20
    e.echoInvuln = 0
    s.hero.combo = undefined
    wait(s, 0.5, W)
    hold(e)
    e.x = 11.5; e.y = 4.5
    swing(s, 'left', W)
    assert.equal(20 - e.hp, 2 * Z.COMBO[0].dmg)
  })

  it('lands beside the hero\'s own blow: one foe, two blades', () => {
    const { W, s, hero } = lab({ '8,5': 'k' }, { k: { ent: { t: 'enemy', kind: 'sentry' } } })
    const e = s.map.enemies[0]
    hold(e)
    e.hp = 20
    echoAt(s, 9, 5, 'left')
    hero(7, 5)
    swing(s, 'right', W)
    assert.equal(20 - e.hp, 2 * Z.COMBO[0].dmg)
    // Whichever comes first: neither mercy swallows the other blade, and each still guards against its own.
    const c = Z.ctx(W, s, [])
    for (const [first, second] of [['echo', 'sword'], ['sword', 'echo']]) {
      Object.assign(e, { hp: 20, invuln: 0, echoInvuln: 0 })
      assert.equal(Z.hitEnemy(c, e, 1, 7.5, 5.5, first), true)
      assert.equal(Z.hitEnemy(c, e, 1, 7.5, 5.5, second), true, `${second} after ${first}`)
      assert.equal(Z.hitEnemy(c, e, 1, 7.5, 5.5, first), false)
      assert.equal(Z.hitEnemy(c, e, 1, 7.5, 5.5, second), false)
    }
  })

  it('aims at the nearest thing a blade can hit, else along its own facing', () => {
    const { W, s } = lab({ '8,5': 'k', '5,5': 'c' }, { k: { ent: { t: 'enemy', kind: 'sentry' } } })
    const c = Z.ctx(W, s, [])
    const e = s.map.enemies[0]
    hold(e)
    // The foe 0.7 east, the switch a whole tile west: the foe.
    e.x = 7.2; e.y = 5.5
    assert.ok(Math.abs(Z.echoAim(c, { x: 6.5, y: 5.5 }, Z.SWORD_REACH)) < 1e-6)
    // The foe gone: the switch, to the west. (A foe the blade cannot reach is no target.)
    e.dead = true
    assert.ok(Math.abs(Math.abs(Z.echoAim(c, { x: 6.5, y: 5.5 }, Z.SWORD_REACH)) - Math.PI) < 1e-6)
    // Nothing in reach.
    assert.equal(Z.echoAim(c, { x: 11.5, y: 8.5 }, Z.SWORD_REACH), null)
  })

  it('spins when the hero spins, and chops when the hero\'s flip comes down', () => {
    const marks = { k: { ent: { t: 'enemy', kind: 'sentry' } } }
    for (const move of ['spin', 'flip']) {
      const { W, s, hero } = lab({ '11,4': 'k' }, marks)
      const e = s.map.enemies[0]
      hold(e)
      e.hp = 20
      echoAt(s, 10, 4, 'down')
      hero(3, 8, 'right')
      if (move === 'spin') {
        s.hero.charge = 1
        run(s, 1, inp({ a: true }), W)
        run(s, 40, inp(), W)
        // (The press that lets go is the release itself.)
        assert.equal(20 - e.hp, 2, 'the spin')
      } else {
        run(s, 1, inp({ rollPress: true }), W)
        run(s, 3, inp(), W)
        run(s, 1, inp({ aPress: true, a: true }), W)
        run(s, 60, inp(), W)
        assert.equal(20 - e.hp, Z.FLIP_CHOP.dmg, 'the chop')
      }
    }
  })

  it('never hurts or shoves the hero: a knight\'s shield turns it in silence, a zapper does not shock', () => {
    const marks = { k: { ent: { t: 'enemy', kind: 'knight', dir: 'left' } }, z: { ent: { t: 'enemy', kind: 'zapper' } } }
    const { W, s, hero } = lab({ '10,4': 'k', '10,8': 'z' }, marks)
    const [k, z] = [s.map.enemies.find(e => e.kind === 'knight'), s.map.enemies.find(e => e.kind === 'zapper')]
    hold(k, 'walk'); k.dir = 'left'
    hold(z)
    // In front of the shield.
    echoAt(s, 9, 4, 'right')
    hero(3, 6)
    const c = Z.ctx(W, s, [])
    assert.equal(Z.hitEnemy(c, k, 2, 9.5, 4.5, 'echo'), false)
    assert.equal(s.hero.knock, null)
    assert.equal(k.invuln, 0, 'the hero\'s blade is not swallowed by it')
    assert.ok(c.ev.some(e => e.type === 'clank'))
    // From behind it bites.
    k.echoInvuln = 0
    assert.equal(Z.hitEnemy(c, k, 2, 11.5, 4.5, 'echo'), true)
    assert.equal(k.hp, 6)
    // The zapper: the echo's blow lands, and nobody is shocked.
    const hp = s.hero.hp
    assert.equal(Z.hitEnemy(c, z, 1, 9.5, 8.5, 'echo'), true)
    assert.equal(s.hero.hp, hp)
  })

  it('is not seen by foes, and a walker goes round it as round a pot', () => {
    const marks = { k: { ent: { t: 'enemy', kind: 'sentry' } } }
    // A sentry that sees the hero comes straight for them, with the echo square in the way.
    const { W, s, hero } = lab({ '9,5': 'k' }, { k: { ent: { t: 'enemy', kind: 'sentry', dir: 'left' } } })
    const e = s.map.enemies[0]
    hero(4, 5)
    echoAt(s, 6, 5)
    let nearest = 9
    for (let f = 0; f < 3 * FPS; f++) {
      s.hero.invuln = 1
      step(s, inp(), W)
      nearest = Math.min(nearest, gap(e, s.echo))
    }
    assert.ok(nearest < e.r + Z.ECHO_R + 0.3, `it never came up against it: ${nearest.toFixed(2)}`)
    assert.ok(nearest >= e.r + Z.ECHO_R - 0.02, `walked into it: ${nearest.toFixed(2)}`)
    // And one coming at a slant gets round it.
    Object.assign(e, { x: 9.5, y: 5.9 })
    e.ai.mode = 'chase'; e.ai.t = 9; e.ai.lost = 0
    for (let f = 0; f < 2 * FPS && e.x > 5; f++) { s.hero.invuln = 1; hero(3, 5); step(s, inp(), W); assert.ok(gap(e, s.echo) >= e.r + Z.ECHO_R - 0.02) }
    assert.ok(e.x <= 5, `stuck at ${e.x.toFixed(2)},${e.y.toFixed(2)}`)
    assert.equal(s.echo.x, 6.5)
  })

  it('is gone when the hero leaves the room, warps or dies', () => {
    const s = at('porch', 7, 5, { inv: { echo: true, selected: 'echo' } })
    leave(s, 'up')
    assert.ok(s.echo)
    run(s, 90, inp({ move: { x: 0, y: -1 } }))
    P.settle(s)
    assert.equal(roomOf(s), 'hall')
    assert.equal(s.echo, null)
    leave(s, 'up')
    assert.ok(s.echo)
    Z.enterMap(Z.WORLD, s, 'seterfell', 'echobarrow', [])
    assert.equal(s.echo, null)
    const d = at('porch', 7, 5, { inv: { echo: true } })
    echoAt(d, ...T('porch', 4, 4))
    Z.hurtHero(Z.ctx(Z.WORLD, d, []), 99, d.hero.x + 1, d.hero.y)
    assert.equal(d.echo, null)
  })

  it('out in a land is gone once the hero is a screen away', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'seterfell', entry: 'mounds' } })
    Object.assign(s.inv, { sword: true, echo: true, selected: 'echo' })
    s.mode = 'play'; s.dialog = null; s.hero.auto = null
    leave(s, 'right')
    assert.ok(s.echo)
    s.hero.x += 10
    wait(s, 0.1)
    assert.ok(s.echo)
    s.hero.x += 8
    wait(s, 0.1)
    assert.equal(s.echo, null)
  })

  it('is never in a save; a save with the echo in hand loads, and one from before it loads without', () => {
    const s = at('porch', 7, 5, { inv: { echo: true, selected: 'echo' } })
    leave(s, 'up')
    assert.ok(s.echo)
    const raw = JSON.parse(JSON.stringify(Z.toSave(s)))
    assert.ok(!('echo' in raw))
    assert.ok(!JSON.stringify(raw).includes('"cut"'))
    const back = Z.parseSave(raw)
    assert.equal(back.inv.selected, 'echo')
    assert.equal(back.inv.echo, true)
    const again = Z.createGame(Z.WORLD, { save: back })
    assert.equal(again.echo, null)
    delete raw.inv.echo
    raw.inv.selected = null
    assert.equal(Z.parseSave(raw).inv.echo, false)
  })
})

// ================================================================================================================

describe('the Answering Room', () => {
  const GATE = T('answering', 10, 5)
  const PLATE = [3, 8]

  it('opens its gate only while something stands on the plate', () => {
    const s = at('answering', 3, 9)
    wait(s, 0.1)
    assert.equal(tile(s, ...GATE), 'X')
    P.walkTo(s, ...T('answering', ...PLATE))
    wait(s, 0.1)
    assert.equal(tile(s, ...GATE), '.')
    P.walkTo(s, ...T('answering', 3, 6))
    wait(s, 0.1)
    assert.equal(tile(s, ...GATE), 'X')
    assert.ok(!s.flags[`gate:echobarrow.${T('answering', 10, 5).join(',')}`])
  })

  it('is solved with the echo: leave it on the plate, walk through, take the key; the gate then stays open', () => {
    const s = at('answering', 7, 10, { inv: { echo: true, selected: 'echo' } })
    P.walkTo(s, ...T('answering', ...PLATE))
    leave(s, 'right')
    // (The chest is at 13,3 of the room: stand under it.)
    P.walkTo(s, ...T('answering', 13, 4))
    s.hero.dir = 'up'
    P.pressA(s)
    assert.equal(s.inv.keyrings.echobarrow, 1)
    s.echo = null
    wait(s, 0.2)
    assert.equal(tile(s, ...GATE), '.', 'open for good')
    Z.enterMap(Z.WORLD, s, 'echobarrow', 'start', [])
    assert.equal(tile(s, ...GATE), '.')
  })

  it('cannot trap a hero who moves the echo from inside: the chest there opens the gate for good', () => {
    const s = at('answering', 7, 10, { inv: { echo: true, selected: 'echo' } })
    P.walkTo(s, ...T('answering', ...PLATE))
    leave(s, 'right')
    P.walkTo(s, ...T('answering', 12, 8))
    leave(s, 'left')
    assert.equal(tile(s, ...GATE), 'X', 'shut behind')
    P.walkTo(s, ...T('answering', 13, 4))
    s.hero.dir = 'up'
    P.pressA(s)
    wait(s, 0.2)
    assert.equal(tile(s, ...GATE), '.')
  })

  it('is not solved without it: nothing else there weighs anything, and no move outruns the gate', () => {
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) {
      const [a, b] = T('answering', x, y)
      assert.ok(!'orbBκ□◇μνO'.includes(info.base[b * info.w + a]), `${x},${y} holds something to weigh or slip through`)
    }
    const inside = s => s.hero.x > GATE[0] + 0.9
    const east = { x: 1, y: 0 }
    const up = unit(1, -0.4)
    // From the plate and from beside it: walk, roll, flip, back flip, comet, tempest and the hop, at the gate.
    const moves = {
      walk: s => run(s, 150, inp({ move: up })),
      roll: s => { for (let k = 0; k < 12; k++) { run(s, 1, inp({ move: up, rollPress: true })); run(s, 24, inp({ move: up })) } },
      flip: s => { for (let k = 0; k < 8; k++) { run(s, 1, inp({ move: up, rollPress: true })); run(s, 4, inp({ move: up })); run(s, 1, inp({ move: up, aPress: true, a: true })); run(s, 40, inp({ move: up })) } },
      comet: s => { for (let k = 0; k < 8; k++) { s.hero.dir = 'left'; s.hero.aim = Math.PI; run(s, 1, inp({ aPress: true, a: true })); run(s, 8); run(s, 1, inp({ rollPress: true })); run(s, 4); run(s, 1, inp({ move: up, aPress: true, a: true })); run(s, 40, inp({ move: up })) } },
      hop: s => { s.inv.arts = ['hop']; s.inv.selected = 'hop'; for (let k = 0; k < 8; k++) { run(s, 1, inp({ move: up, bPress: true })); run(s, 50, inp({ move: up })) } },
    }
    for (const [name, go] of Object.entries(moves)) {
      for (const start of [PLATE, [4, 8], [8, 6], [2, 6]]) {
        const s = at('answering', ...start)
        wait(s, 0.05)
        go(s)
        assert.ok(!inside(s), `${name} from ${start} got through (${(s.hero.x - ROOM.answering[0]).toFixed(1)}, ${s.hero.y.toFixed(1)})`)
      }
    }
  })
})

// ================================================================================================================

describe('the Crossing', () => {
  const SWITCH = T('crossing', 6, 10)
  const north = s => s.hero.y < ROOM.crossing[1] + 3

  it('is solved with the echo: leave it by the switch, cross the first row, cut', () => {
    const s = at('crossing', 1, 9, { inv: { echo: true, selected: 'echo' } })
    assert.equal(s.map.crystalAll, 'pink')
    P.walkTo(s, ...T('crossing', 6, 9))
    leave(s, 'down')
    P.walkTo(s, ...T('crossing', 6, 4))
    assert.ok(!north(s))
    const ev = swing(s, 'up')
    assert.deepEqual(ev.filter(e => e.type === 'crystal').map(e => e.state), ['cyan'])
    assert.equal(s.map.crystalAll, 'cyan')
    P.walkTo(s, ...T('crossing', 5, 1))
    assert.ok(north(s))
    // And back again the same way, the echo still there.
    P.walkTo(s, ...T('crossing', 6, 4))
    swing(s, 'up')
    P.walkTo(s, ...T('crossing', 3, 9))
    assert.equal(roomOf(s), 'crossing')
  })

  it('is not solved without it: the blade at the switch only ever raises the row it just crossed', () => {
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    const [ox, oy] = ROOM.crossing
    // Every blade there is reaches this far from the hero's middle at most (the Arc Blade's spin and the tempest).
    const REACH = Z.SPIN_REACH + 0.2 + 0.1
    /** Can a blow from somewhere on this tile touch the switch? (Generous: from the tile's whole square, grown by the hero.) */
    const canCut = (x, y) => {
      const dx = Math.max(SWITCH[0] - (x + 1), x - (SWITCH[0] + 1), 0)
      const dy = Math.max(SWITCH[1] - (y + 1), y - (SWITCH[1] + 1), 0)
      return Math.hypot(dx, dy) <= REACH
    }
    const solid = (x, y, cyan) => {
      const t = info.base[y * info.w + x]
      if (t === 'P') return !cyan
      if (t === 'C') return cyan
      return Z.TILE_INFO[t].solid
    }
    // Every (tile, crystal state) a hero with only the blade can get to, from the hall's door.
    const seen = new Set()
    const q = [[ox + 1, oy + 8, false]]
    while (q.length) {
      const [x, y, cyan] = q.pop()
      const key = `${x},${y},${cyan}`
      if (seen.has(key)) continue
      seen.add(key)
      assert.ok(y >= oy + 3 || x >= ox + 12, `got north: ${x - ox},${y - oy}`)
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < ox || ny < oy || nx >= ox + 16 || ny >= oy + 12) continue
        if (!solid(nx, ny, cyan)) q.push([nx, ny, cyan])
      }
      if (canCut(x, y)) {
        assert.ok(y > oy + 6, `the switch is in reach from ${x - ox},${y - oy}, past the first row`)
        q.push([x, y, !cyan])
      }
    }
    assert.ok([...seen].some(k => k.startsWith(`${ox + 6},${oy + 4},false`)), 'the ground between the rows is reached')
    // Nothing in the room to throw at the switch, nothing for the hook to bite north of it.
    for (let y = 0; y < 12; y++) for (let x = 0; x < 16; x++) assert.ok(!'orIt$|'.includes(info.base[(oy + y) * info.w + ox + x]), `${x},${y}`)
  })

  it('defeats a scripted hero without it, who tries: cut by the switch, run north', () => {
    const s = at('crossing', 6, 9)
    swing(s, 'down')
    assert.equal(s.map.crystalAll, 'cyan')
    run(s, 120, inp({ move: { x: 0, y: -1 } }))
    assert.ok(s.hero.y > ROOM.crossing[1] + 7, 'the first row is up')
    // Back to the switch, the first row down again, between the rows, and cut at it from there.
    P.walkTo(s, ...T('crossing', 6, 9))
    wait(s, 0.6)
    swing(s, 'down')
    assert.equal(s.map.crystalAll, 'pink')
    P.walkTo(s, ...T('crossing', 6, 4))
    swing(s, 'down')
    assert.equal(s.map.crystalAll, 'pink', 'out of reach from between the rows')
    run(s, 120, inp({ move: { x: 0, y: -1 } }))
    assert.ok(s.hero.y > ROOM.crossing[1] + 4, 'the second row is up')
  })

  it('keeps the short way back shut until both knights are down and the lever is thrown', () => {
    const g = T('crossing', 13, 0)
    for (const flags of [[], ['echobarrow.lever'], ['echobarrow.shield1', 'echobarrow.shield2'], ['echobarrow.lever', 'echobarrow.shield1']]) {
      const s = at('crossing', 13, 5, { flags })
      wait(s, 0.1)
      assert.equal(tile(s, ...g), 'X', flags.join(' '))
    }
    const s = at('crossing', 13, 5, { flags: ['echobarrow.lever', 'echobarrow.shield1', 'echobarrow.shield2'] })
    wait(s, 0.1)
    assert.equal(tile(s, ...g), '.')
    assert.equal(tile(s, g[0] + 1, g[1]), '.')
  })
})

// ================================================================================================================
// Mixtral
// ================================================================================================================

/** Mixtral's room, fresh: the hero in from the east door, a seed moving both. */
function mixtralRoom(seed, { inv = {}, hearts = 15 } = {}) {
  const s = at('mixtral', 12 - (seed % 3), 2 + ((seed * 3) % 8), { inv, seed, hearts })
  // (The card is read already: the fight is what is tried.)
  s.flags['echobarrow.mixtral.met'] = true
  const e = s.map.enemies.find(o => o.kind === 'mixtral')
  e.x = ROOM.mixtral[0] + 3.5 + (seed % 2)
  e.y = ROOM.mixtral[1] + 3.5 + ((seed * 5) % 6)
  return { s, e }
}
/** The middle of the room's floor, and how far a hero's middle may go from it. */
const inner = room => ({ x0: ROOM[room][0] + 1.4, x1: ROOM[room][0] + 14.6, y0: ROOM[room][1] + 1.4, y1: ROOM[room][1] + 10.6 })

/**
 * Plays Mixtral on what is drawn: the lane while it tells and charges, the daze. In the stalk it stands well off, in
 * line, to be charged; a lane under its feet it walks out of; a dazed Mixtral it walks up to and cuts.
 */
function dancer(s, e, f) {
  const h = s.hero
  const b = inner('mixtral')
  const d = gap(h, e)
  const mode = e.ai.mode
  if (mode === 'tell' || mode === 'charge') {
    const flat = e.dir === 'left' || e.dir === 'right'
    const off = flat ? h.y - e.y : h.x - e.x
    if (Math.abs(off) > 1.45) return inp()
    const [v, lo, hi, mid] = flat ? [h.y, b.y0, b.y1, e.y] : [h.x, b.x0, b.x1, e.x]
    let way = off >= 0 ? 1 : -1
    // No room that side to get clear: across the lane to the other.
    if (way > 0 ? hi - mid < 1.5 : mid - lo < 1.5) way = -way
    void v
    return inp({ move: flat ? { x: 0, y: way } : { x: way, y: 0 } })
  }
  if (mode === 'dazed') {
    if (d > e.r + Z.SWORD_REACH - 0.25) return inp({ move: unit(e.x - h.x, e.y - h.y) })
    return inp({ move: unit(e.x - h.x, e.y - h.y, 0.05), aPress: f % 5 === 0, a: false })
  }
  if (mode === 'rouse') return inp({ move: unit(h.x - e.x, h.y - e.y) })
  // The stalk: four to six tiles off, level with it, on the side with room.
  const east = e.x + 5 <= b.x1 ? 1 : -1
  const goal = { x: Math.max(b.x0, Math.min(b.x1, e.x + east * 5.5)), y: Math.max(b.y0, Math.min(b.y1, e.y)) }
  if (d < 2.6) return inp({ move: unit(h.x - e.x + (goal.x - h.x) * 0.5, h.y - e.y + (h.y < (b.y0 + b.y1) / 2 ? 2 : -2)) })
  if (gap(h, goal) < 0.3) return inp()
  return inp({ move: unit(goal.x - h.x, goal.y - h.y) })
}

/** Plays a fight with a policy to the end or `seconds`. */
function fight(s, foes, policy, seconds) {
  let hurts = 0
  let hp = s.hero.hp
  let f = 0
  const mem = {}
  const events = []
  for (; f < seconds * FPS && foes.some(e => !e.dead) && s.mode !== 'dying'; f++) {
    if (s.mode === 'dialog' || s.mode === 'get') { P.settle(s); continue }
    events.push(...step(s, policy(s, foes[0], f, mem)))
    if (s.hero.hp < hp) hurts++
    hp = s.hero.hp
  }
  return { won: foes.every(e => e.dead), hurts, seconds: f / FPS, events, left: foes.map(e => e.hp), dead: s.mode === 'dying' }
}

describe('Mixtral', () => {
  it('is a heavy foe of ten, with its card the first time in the room', () => {
    assert.equal(Z.STATS.mixtral.hp, 10)
    assert.ok(Math.abs(Z.STATS.mixtral.r - 0.8) < 0.01)
    assert.ok(Z.BIG.has('mixtral'))
    const s = at('hall', 1, 5, { flags: ['door:echobarrow:' + (17 * 48 + 16), 'door:echobarrow:' + (18 * 48 + 16)] })
    for (let f = 0; f < 4 * FPS && s.mode !== 'dialog'; f++) { s.hero.invuln = 1; step(s, inp({ move: { x: -1, y: 0 } })) }
    assert.equal(roomOf(s), 'mixtral')
    assert.deepEqual(s.dialog.lines, ['MIXTRAL. EIGHT OPINIONS AND ONE HEADACHE.'])
    P.settle(s)
    assert.ok(s.flags['echobarrow.mixtral.met'])
    // Both ways have shut behind.
    assert.equal(tile(s, ...T('mixtral', 15, 5)), 'X')
    assert.equal(tile(s, ...T('mixtral', 7, 0)), 'X')
  })

  it('stencils the lane it will take, to the wall, as wide as its charge touches, then charges straight down it', () => {
    const { s, e } = mixtralRoom(1)
    Object.assign(s.hero, { x: ROOM.mixtral[0] + 11.5, y: e.y })
    for (let f = 0; f < 3 * FPS && e.ai.mode !== 'tell'; f++) { s.hero.invuln = 1; step(s) }
    assert.equal(e.ai.mode, 'tell')
    assert.equal(e.dir, 'right')
    assert.ok(Math.abs(e.ai.tell - Z.MIXTRAL.tell) < 0.02)
    const [lane] = Z.stencilsOf(e)
    assert.equal(lane.t, 'lane')
    assert.ok(Math.abs(lane.w / 2 - (e.r + Z.HERO_R - 0.05)) < 1e-9)
    assert.ok(Math.abs(lane.x1 - (ROOM.mixtral[0] + 15 - e.r)) < 0.1, `to the wall: ${lane.x1}`)
    assert.ok(Math.abs(lane.y1 - lane.y0) < 1e-6)
    const from = { x: e.x, y: e.y }
    // Out of the way, and watch it go: dead straight, nine tiles a second, to where the lane ended.
    Object.assign(s.hero, { y: from.y < ROOM.mixtral[1] + 6 ? from.y + 4 : from.y - 4 })
    for (let f = 0; f < FPS && e.ai.mode === 'tell'; f++) step(s)
    const t0 = { x: e.x }
    for (let f = 0; f < 12; f++) step(s)
    assert.ok(Math.abs((e.x - t0.x) / (12 / FPS) - Z.MIXTRAL.charge) < 1, `speed ${(e.x - t0.x) / 0.2}`)
    assert.ok(Math.abs(e.y - from.y) < 1e-6, 'it does not steer')
    for (let f = 0; f < 3 * FPS && e.ai.mode === 'charge'; f++) step(s)
    assert.equal(e.ai.mode, 'dazed')
    assert.ok(Math.abs(e.x - lane.x1) < 0.1)
    assert.deepEqual(Z.stencilsOf(e), [])
    assert.equal(Z.bossOpen(e), true)
    // The daze lasts 2.2 s.
    let secs = 0
    while (e.ai.mode === 'dazed') { step(s); secs += 1 / FPS }
    assert.ok(Math.abs(secs - Z.MIXTRAL.dazed) < 0.1, `${secs}`)
    assert.equal(Z.bossOpen(e), false)
  })

  it('turns the blade, the echo\'s too, except while dazed; and gives one daze five at most', () => {
    const { s, e } = mixtralRoom(2)
    const c = Z.ctx(Z.WORLD, s, [])
    for (const mode of ['stalk', 'tell', 'charge', 'rouse']) {
      e.ai.mode = mode
      for (const src of ['sword', 'spin', 'echo', 'disc', 'hook']) {
        e.invuln = 0; e.echoInvuln = 0
        assert.equal(Z.hitEnemy(c, e, 2, e.x + 1.5, e.y, src), false, `${src} in ${mode}`)
        assert.equal(e.stun, 0)
      }
      assert.equal(Z.bossOpen(e), false, mode)
    }
    assert.equal(e.hp, 10)
    assert.ok(c.ev.some(x => x.type === 'clank'))
    e.ai.mode = 'dazed'
    e.ai.took = 0
    assert.equal(Z.bossOpen(e), true)
    for (let k = 0; k < 6; k++) { e.invuln = 0; e.echoInvuln = 0; Z.hitEnemy(c, e, 2, e.x + 1.5, e.y, k % 2 ? 'echo' : 'sword') }
    assert.equal(e.hp, 5, 'five, the two blades together')
    assert.equal(Z.bossOpen(e), false)
  })

  it('is hurt by a bomb or a thrown pot at any time', () => {
    for (const src of ['bomb', 'pot']) {
      const { s, e } = mixtralRoom(2)
      e.ai.mode = 'stalk'
      assert.equal(Z.hitEnemy(Z.ctx(Z.WORLD, s, []), e, 2, e.x + 1, e.y, src), true)
      assert.equal(e.hp, 8)
    }
  })

  it('at half its hit points tells shorter and charges twice, turning once, each lane stencilled', () => {
    const { s, e } = mixtralRoom(1)
    const c = Z.ctx(Z.WORLD, s, [])
    e.ai.mode = 'dazed'; e.ai.took = 0; e.ai.t = 0.05
    Z.hitEnemy(c, e, 5, e.x + 1.5, e.y, 'sword')
    assert.ok(c.ev.some(x => x.type === 'bossPhase'))
    assert.equal(e.ai.phase, 2)
    e.x = ROOM.mixtral[0] + 4.5; e.y = ROOM.mixtral[1] + 4.5; e.knock = null
    Object.assign(s.hero, { x: ROOM.mixtral[0] + 11.5, y: e.y })
    for (let f = 0; f < 6 * FPS && e.ai.mode !== 'tell'; f++) { s.hero.invuln = 1; step(s) }
    assert.ok(Math.abs(e.ai.tell - Z.MIXTRAL.tell2) < 0.02)
    const first = e.dir
    Object.assign(s.hero, { y: ROOM.mixtral[1] + 9.5 })
    const modes = []
    const dirs = []
    for (let f = 0; f < 6 * FPS && e.ai.mode !== 'dazed'; f++) {
      s.hero.invuln = 1
      step(s)
      if (modes.at(-1) !== e.ai.mode) { modes.push(e.ai.mode); if (e.ai.mode === 'tell') dirs.push(e.dir) }
    }
    assert.deepEqual(modes, ['tell', 'charge', 'tell', 'charge', 'dazed'])
    assert.equal(first, 'right')
    assert.deepEqual(dirs.slice(-1), ['down'], 'a quarter turn, toward the hero')
  })

  it('hurts a hero who stands in its lane', () => {
    for (const seed of SEEDS) {
      const { s, e } = mixtralRoom(seed)
      const r = fight(s, [e], () => inp(), 12)
      assert.ok(r.hurts >= 1, `seed ${seed}: stood 12 s unharmed`)
    }
  })

  it('hurts a hero who walks up and hammers A, and is not beaten that way unharmed', () => {
    for (const seed of SEEDS) {
      const { s, e } = mixtralRoom(seed)
      const r = fight(s, [e], (s2, e2, f) => {
        const d = gap(s2.hero, e2)
        if (d > e2.r + 0.9) return inp({ move: unit(e2.x - s2.hero.x, e2.y - s2.hero.y) })
        return inp({ move: unit(e2.x - s2.hero.x, e2.y - s2.hero.y, 0.05), aPress: f % 5 === 0 })
      }, 40)
      assert.ok(r.hurts >= 2, `seed ${seed}: ${r.hurts}`)
    }
  })

  it('falls, without landing a blow, to a hero who steps out of the lane and cuts it while it is dazed', () => {
    for (const seed of SEEDS) {
      const { s, e } = mixtralRoom(seed)
      const r = fight(s, [e], dancer, 60)
      LOG(`mixtral ${seed}`, r)
      assert.ok(r.won, `seed ${seed}: not beaten in 60 s (${r.left} left, ${r.hurts} blows taken, mode ${e.ai.mode})`)
      assert.equal(r.hurts, 0, `seed ${seed}: took ${r.hurts} blows`)
      assert.ok(r.seconds >= 5 && r.seconds <= 40, `seed ${seed}: ${r.seconds.toFixed(1)} s`)
      assert.equal(r.events.filter(x => x.type === 'bossDown').length, 1)
      assert.ok(s.flags['echobarrow.mixtral'])
      wait(s, 1.5)
      // The ways open and the big chest with the echo appears.
      assert.equal(tile(s, ...T('mixtral', 15, 5)), '.')
      assert.equal(tile(s, ...T('mixtral', 7, 0)), '.')
      assert.equal(tile(s, ...T('mixtral', 7, 6)), '$')
    }
  })

  it('gives THE ECHO from that chest', () => {
    const s = at('mixtral', 7, 8, { flags: ['echobarrow.mixtral'] })
    wait(s, 0.2)
    assert.equal(s.map.enemies.filter(e => e.kind === 'mixtral').length, 0)
    P.walkTo(s, ...T('mixtral', 7, 7))
    s.hero.dir = 'up'
    P.pressA(s)
    assert.equal(s.inv.echo, true)
    assert.equal(s.inv.selected, 'echo')
  })
})

// ================================================================================================================
// The Shield Hall
// ================================================================================================================

function shieldHall(seed, inv = {}) {
  const s = at('shield', 4 + (seed % 8), 8, { inv, seed, hearts: 15 })
  const knights = s.map.enemies.filter(e => e.kind === 'knight')
  return { s, knights }
}

/** The way to step that keeps clear of the knights, their lanes and the walls (what a player sees). */
function clear(s, knights, want = null) {
  const h = s.hero
  const b = inner('shield')
  let best = null
  let score = -Infinity
  for (let k = 0; k <= 16; k++) {
    const m = k === 16 ? { x: 0, y: 0 } : { x: Math.cos((k * Math.PI) / 8), y: Math.sin((k * Math.PI) / 8) }
    const x = h.x + m.x * 0.8
    const y = h.y + m.y * 0.8
    if (k < 16 && (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1 || Z.circleBlocked(Z.WORLD, s.map, x, y, Z.HERO_R))) continue
    let v = 0
    for (const e of knights) {
      if (e.dead) continue
      const d = Math.hypot(x - e.x, y - e.y)
      v -= d < 1.5 ? (1.5 - d) * 40 : 0
      v -= Math.max(0, 3.5 - d) * 2
      // In its lane as it tells or charges: get out.
      if (e.ai.mode === 'tell' || e.ai.mode === 'charge') {
        const flat = e.dir === 'left' || e.dir === 'right'
        const ahead = (flat ? x - e.x : y - e.y) * (e.dir === 'left' || e.dir === 'up' ? -1 : 1)
        const off = Math.abs(flat ? y - e.y : x - e.x)
        if (ahead > -1 && off < 1.5) v -= (1.5 - off) * 30 + 10
      }
    }
    v -= Math.max(0, 2 - Math.min(x - b.x0, b.x1 - x)) + Math.max(0, 2 - Math.min(y - b.y0, b.y1 - y))
    if (want) v += (m.x * want.x + m.y * want.y) * 3
    if (v > score) { score = v; best = m }
  }
  return best ?? { x: 0, y: 0 }
}

/** Without the echo: keeps clear, and cuts a knight dazed against a wall. */
function patient(knights) {
  return (s, _e, f) => {
    const h = s.hero
    const open = knights.filter(e => !e.dead && (e.ai.mode === 'dazed' || e.stun > 0)).sort((a, b) => gap(h, a) - gap(h, b))[0]
    const others = knights.filter(e => e !== open)
    if (open) {
      const d = gap(h, open)
      const danger = others.some(e => !e.dead && gap(h, e) < 1.8)
      if (!danger && d > open.r + Z.SWORD_REACH - 0.2) return inp({ move: clear(s, others, unit(open.x - h.x, open.y - h.y, 2)) })
      if (!danger) return inp({ move: unit(open.x - h.x, open.y - h.y, 0.05), aPress: f % 5 === 0 })
    }
    return inp({ move: clear(s, knights) })
  }
}

/**
 * With the echo: the same, and it leaves the echo in a knight's way; once a knight has walked past it, so that the
 * echo stands at its back or side, the hero cuts from wherever they are and the echo's blade lands.
 */
function echoer(knights, tally) {
  const wise = patient(knights)
  return (s, e, f, mem) => {
    const h = s.hero
    const live = knights.filter(k => !k.dead)
    const behind = k => {
      const e2 = s.echo
      if (!e2 || Math.hypot(e2.x - k.x, e2.y - k.y) > Z.SWORD_REACH + k.r - 0.05) return false
      const fx = k.dir === 'left' ? -1 : k.dir === 'right' ? 1 : 0
      const fy = k.dir === 'up' ? -1 : k.dir === 'down' ? 1 : 0
      const dx = e2.x - k.x
      const dy = e2.y - k.y
      return dx * fx + dy * fy <= 0.2 * Math.hypot(dx, dy)
    }
    const target = s.echo && live.find(k => k.ai.mode !== 'dazed' && behind(k))
    if (target && !h.swing && h.cooldown <= 0 && live.every(k => gap(h, k) > 1.7)) {
      tally.cuts++
      return inp({ move: unit(h.x - target.x, h.y - target.y, 0.05), aPress: true })
    }
    if (live.some(k => k.ai.mode === 'dazed' && gap(h, k) < 6)) return wise(s, e, f, mem)
    // Lay it where a walking knight is about to pass, then step on beyond it.
    const near = live.filter(k => k.ai.mode === 'walk').sort((a, b) => gap(h, a) - gap(h, b))[0]
    const useless = !s.echo || live.every(k => gap(s.echo, k) > 3.2)
    if (near && useless && (mem.laid ?? -99) < f - 40) {
      const d = gap(h, near)
      if (d > 1.9 && d < 2.9) { mem.laid = f; return inp({ bPress: true }) }
      if (d >= 2.9) return inp({ move: clear(s, knights, unit(near.x - h.x, near.y - h.y)) })
    }
    // Draw the knight past the echo: away from both, on the far side of it.
    if (s.echo && near && gap(s.echo, near) <= 3.2) return inp({ move: clear(s, knights, unit(s.echo.x - near.x, s.echo.y - near.y, 1.5)) })
    return inp({ move: clear(s, knights) })
  }
}

describe('the Shield Hall', () => {
  it('shuts behind the hero, and gives the Big Key once both knights are down', () => {
    const s = at('crossing', 5, 1)
    run(s, 90, inp({ move: { x: 0, y: -1 } }))
    P.settle(s)
    assert.equal(roomOf(s), 'shield')
    wait(s, 0.3)
    assert.equal(tile(s, ...T('shield', 5, 11)), 'X')
    const knights = s.map.enemies.filter(e => e.kind === 'knight')
    assert.deepEqual(knights.map(e => e.once).sort(), ['echobarrow.shield1', 'echobarrow.shield2'])
    const c = Z.ctx(Z.WORLD, s, [])
    Z.killEnemy(c, knights[0])
    assert.equal(knights[1].dead, false, 'one knight\'s fall leaves the other standing')
    wait(s, 0.3)
    assert.equal(tile(s, ...T('shield', 5, 11)), 'X')
    assert.equal(tile(s, ...T('shield', 7, 2)), '.')
    Z.killEnemy(c, knights[1])
    wait(s, 0.3)
    assert.equal(tile(s, ...T('shield', 5, 11)), '.')
    assert.equal(tile(s, ...T('shield', 7, 2)), '$')
  })

  it('keeps a knight that fell, after a death in the room', () => {
    const s = at('shield', 7, 8, { flags: ['echobarrow.shield1'] })
    assert.equal(s.map.enemies.filter(e => e.kind === 'knight').length, 1)
  })

  it('is won slowly without the echo, by the knights\' own daze', () => {
    for (const seed of SEEDS) {
      const { s, knights } = shieldHall(seed)
      const r = fight(s, knights, patient(knights), 150)
      LOG(`knights ${seed}, blade alone`, r)
      assert.ok(r.won, `seed ${seed}: ${r.left} left after ${r.seconds.toFixed(0)} s, ${r.hurts} blows, dead ${r.dead}`)
      assert.equal(r.events.filter(x => x.type === 'echoCut').length, 0)
    }
  })

  it('is won with the echo, which cuts knights at their backs, and sooner', () => {
    let with_ = 0
    let without = 0
    let landed = 0
    for (const seed of SEEDS) {
      const a = shieldHall(seed, { echo: true, selected: 'echo' })
      const tally = { cuts: 0 }
      // A blow on a knight that is not dazed, from the echo: count them.
      const play = echoer(a.knights, tally)
      let behindHits = 0
      const before = []
      const r = fight(a.s, a.knights, (s, e, f, mem) => {
        const i = play(s, e, f, mem)
        // (A blow's mercy just set, on a knight on its feet: one of the echo's landed this step.)
        a.knights.forEach((k, n) => {
          const m = k.echoInvuln ?? 0
          if (!k.dead && m > (before[n] ?? 0) && k.ai.mode !== 'dazed') behindHits++
          before[n] = m
        })
        return i
      }, 150)
      assert.ok(r.won, `seed ${seed}: ${r.left} left after ${r.seconds.toFixed(0)} s, ${r.hurts} blows, dead ${r.dead}`)
      LOG(`knights ${seed}, with the echo (${tally.cuts} cuts from behind tried, ${behindHits} landed on a knight on its feet)`, r)
      landed += behindHits
      with_ += r.seconds
      const b = shieldHall(seed)
      without += fight(b.s, b.knights, patient(b.knights), 150).seconds
    }
    assert.ok(landed > 0, 'the echo never got behind one')
    assert.ok(with_ < without, `with ${(with_ / 8).toFixed(1)} s, without ${(without / 8).toFixed(1)} s`)
  })
})

// ================================================================================================================
// From the door to the great lock
// ================================================================================================================

describe('the Echo Barrow, walked through', () => {
  it('goes from the door in Seter Fell to the Big Key door opened, with the blade and what the barrow gives', () => {
    const s = Z.createGame(Z.WORLD, { seed: 11, at: { map: 'seterfell', entry: 'mounds' } })
    s.inv.sword = true
    s.mode = 'play'
    s.dialog = null
    s.hero.auto = null
    s.hero.maxHp = s.hero.hp = 20
    const go = (room, x, y) => P.walkTo(s, ...T(room, x, y))
    /** Through a doorway into the next room: walk on until it is entered and the camera settles. */
    const into = (room, x, y) => {
      P.until(s, () => roomOf(s) === room && s.mode === 'play', inp({ move: { x, y } }))
      P.settle(s)
    }
    const open = (dir) => { s.hero.dir = dir; P.pressA(s) }
    const turn = view => assert.ok(Z.setViewRule(s, view), `STAND CLEAR turning to ${view} at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}`)
    const push = (x, y, frames = 40) => { for (let k = 0; k < frames; k++) { s.hero.invuln = 1; step(s, inp({ move: { x, y } })) } }

    P.walkTo(s, 20, 27)
    P.until(s, () => s.map.id === 'echobarrow' && s.mode === 'play', inp({ move: { x: 0, y: -1 } }))
    assert.equal(roomOf(s), 'porch')

    // East: the Turning Stones. Squares are floor in the isometric view, diamonds in the flat one.
    turn('iso')
    go('porch', 14, 5)
    into('stones', 1, 0)
    go('stones', 6, 5)
    turn('flat')
    go('stones', 11, 3)
    open('up')
    assert.equal(s.inv.keyrings.echobarrow, 1, 'small key A')
    // The heart piece, behind three rows in turn.
    go('stones', 11, 4)
    turn('iso')
    push(0, 1)
    assert.equal(Math.floor(s.hero.y) - ROOM.stones[1], 6)
    turn('flat')
    push(0, 1)
    assert.equal(Math.floor(s.hero.y) - ROOM.stones[1], 8)
    turn('iso')
    go('stones', 11, 10)
    P.settle(s)
    assert.ok(s.flags['took:echobarrow.heart'])
    assert.equal(s.inv.pieces, 1)
    // Back the same way.
    turn('iso')
    go('stones', 11, 8)
    turn('flat')
    go('stones', 11, 6)
    turn('iso')
    go('stones', 11, 4)
    go('stones', 10, 4)
    turn('flat')
    go('stones', 6, 5)
    turn('iso')
    go('stones', 1, 5)
    into('porch', -1, 0)

    // North to the hall; the west lock takes key A; Mixtral.
    go('porch', 7, 1)
    into('hall', 0, -1)
    go('hall', 1, 5)
    push(-1, 0, 20)
    assert.equal(s.inv.keyrings.echobarrow, 0)
    into('mixtral', -1, 0)
    const mix = s.map.enemies.find(e => e.kind === 'mixtral')
    const m = fight(s, [mix], dancer, 90)
    LOG('walk-through, mixtral', m)
    assert.ok(m.won, `Mixtral: ${m.left} left, ${m.hurts} blows`)
    wait(s, 1.5)
    go('mixtral', 7, 7)
    open('up')
    assert.equal(s.inv.echo, true)

    // North: the Answering Room.
    go('mixtral', 7, 1)
    into('answering', 0, -1)
    go('answering', 3, 8)
    leave(s, 'right')
    go('answering', 13, 4)
    open('up')
    assert.equal(s.inv.keyrings.echobarrow, 1, 'small key B')
    go('answering', 7, 10)
    into('mixtral', 0, 1)
    go('mixtral', 14, 5)
    into('hall', 1, 0)

    // The east way: the shutter has given way to the echo.
    go('hall', 13, 8)
    push(1, 0, 30)
    assert.equal(s.inv.keyrings.echobarrow, 0)
    into('crossing', 1, 0)
    go('crossing', 6, 9)
    leave(s, 'down')
    go('crossing', 6, 4)
    swing(s, 'up')
    go('crossing', 5, 1)
    into('shield', 0, -1)
    wait(s, 0.3)
    assert.equal(tile(s, ...T('shield', 5, 11)), 'X', 'shut in')
    const knights = s.map.enemies.filter(e => e.kind === 'knight')
    const k = fight(s, knights, echoer(knights, { cuts: 0 }), 150)
    LOG('walk-through, knights', k)
    assert.ok(k.won, `the knights: ${k.left} left, ${k.hurts} blows, dead ${k.dead}`)
    wait(s, 0.5)
    s.echo = null
    go('shield', 7, 3)
    open('up')
    assert.ok(s.flags['bigkey:echobarrow'])
    go('shield', 11, 9)
    swing(s, 'down')
    wait(s, 0.3)
    assert.ok(s.flags['echobarrow.lever'])
    assert.equal(tile(s, ...T('crossing', 13, 0)), '.')

    // The short way down, to the hall, and the great lock.
    go('shield', 13, 10)
    into('crossing', 0, 1)
    go('crossing', 1, 8)
    into('hall', -1, 0)
    go('hall', 7, 1)
    push(0, -1, 20)
    assert.equal(tile(s, ...T('hall', 7, 0)), '.', 'the great lock gives way')
    into('parrot', 0, -1)
    assert.equal(s.map.enemies.filter(e => e.cell === s.zoneIndex).length, 0)
    assert.ok(s.hero.hp > 0)
    // The whole of it survives a save.
    const back = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    const again = Z.createGame(Z.WORLD, { save: back, at: { map: 'echobarrow', entry: 'start' } })
    assert.equal(again.inv.echo, true)
    assert.equal(again.inv.selected, 'echo')
    assert.equal(tile(again, ...T('hall', 7, 0)), '.')
    assert.equal(tile(again, ...T('crossing', 13, 0)), '.')
  })
})
