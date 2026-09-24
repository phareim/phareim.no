// Neon Shrine engine tests: world checks, the first minute (down the coast
// road from the town, the Keeper's story, the blade, out of the hut door),
// the hut, exits on a small fixture, the rules before the blade, saves, and
// a full scripted run from the Keeper's hut to the Sun Prism with a
// path-finding walker (god mode on, bosses killed directly). The town's own
// checks are in portal-world.test.mjs.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp(), dt = 1 / 60) => Z.stepGame(Z.WORLD, s, dt, i)
/** The old overworld sits east of the town: add this to its x coordinates. */
const OX = 40
const HUT = { map: 'overworld', entry: 'hut' }

/** A new game out of the Keeper's hut door, the quest not yet begun. */
function newGame(seed = 5) {
  const s = Z.createGame(Z.WORLD, { seed, at: HUT })
  for (let k = 0; k < 120 && s.hero.auto; k++) step(s)
  return s
}

/** Press A through any dialog / item-get in progress. */
function settle(s, max = 600) {
  for (let i = 0; i < max && s.mode !== 'play' && s.mode !== 'won'; i++) {
    if (s.mode === 'dialog') { step(s, inp(), 0.3); step(s, inp({ aPress: true, a: true })) } else step(s)
  }
}

/** BFS over tiles the hero can stand on; returns tile path. */
function path(s, tx, ty) {
  const m = s.map
  const sx = Math.floor(s.hero.x)
  const sy = Math.floor(s.hero.y)
  const npc = new Set(m.npcs.flatMap(n => [[0, 0], [0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]].map(([a, b]) => Math.floor(n.y + b) * m.w + Math.floor(n.x + a))))
  const ok = (x, y) => x >= 0 && y >= 0 && x < m.w && y < m.h && !Z.solidTile(Z.WORLD, m, x, y, 'hero') && m.tiles[y * m.w + x] !== 'O' && !npc.has(y * m.w + x)
  const prev = new Map()
  const key = (x, y) => y * m.w + x
  const q = [[sx, sy]]
  prev.set(key(sx, sy), null)
  while (q.length) {
    const [x, y] = q.shift()
    if (x === tx && y === ty) break
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (!ok(nx, ny) || prev.has(key(nx, ny))) continue
      prev.set(key(nx, ny), [x, y])
      q.push([nx, ny])
    }
  }
  if (!prev.has(key(tx, ty))) return null
  const out = []
  let cur = [tx, ty]
  while (cur) { out.unshift(cur); cur = prev.get(key(cur[0], cur[1])) }
  return out
}

/** Walk the hero to tile (tx, ty) (map may change on the way). God mode. */
function walkTo(s, tx, ty, { map = s.map.id, budget = 4000, keepDialog = false } = {}) {
  let p = path(s, tx, ty)
  assert.ok(p, `no path in ${s.map.id} from ${Math.floor(s.hero.x)},${Math.floor(s.hero.y)} to ${tx},${ty}`)
  let i = 0
  for (let n = 0; n < budget; n++) {
    s.hero.hp = s.hero.maxHp
    s.hero.invuln = 1
    if (keepDialog && s.mode === 'dialog') return true
    if (s.mode === 'dialog' || s.mode === 'get') { settle(s); continue }
    if (s.mode === 'won') return true
    if (s.mode !== 'play') { step(s); continue }
    if (s.map.id !== map) return true
    const h = s.hero
    if (Math.floor(h.x) === tx && Math.floor(h.y) === ty && Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.12) return true
    while (i < p.length - 1 && Math.floor(h.x) === p[i][0] && Math.floor(h.y) === p[i][1] && Math.hypot(h.x - p[i][0] - 0.5, h.y - p[i][1] - 0.5) < 0.25) i++
    const [gx, gy] = p[Math.min(i, p.length - 1)]
    const dx = gx + 0.5 - h.x
    const dy = gy + 0.5 - h.y
    const d = Math.hypot(dx, dy) || 1
    step(s, inp({ move: { x: dx / d, y: dy / d } }))
    if (n % 90 === 89) { p = path(s, tx, ty) ?? p; i = 0 }
  }
  assert.fail(`walkTo ${tx},${ty} timed out at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)} in ${s.map.id}`)
}

function face(s, dir) {
  s.hero.dir = dir
}

function pressA(s) { step(s, inp({ aPress: true, a: true })); settle(s) }

function killCell(s) {
  const c = Z.ctx(Z.WORLD, s, [])
  for (const e of s.map.enemies) if (e.cell === s.zoneIndex && !e.dead && e.kind !== 'eye') Z.killEnemy(c, e)
  for (let i = 0; i < 5; i++) step(s)
}

describe('world', () => {
  it('validates', () => assert.deepEqual(Z.validateWorld(Z.WORLD), []))
})

describe('the first minute', () => {
  it('starts in the town; the coast road leads to the Keeper, who tells the story once', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1 })
    assert.equal(s.mode, 'play')
    assert.equal(s.map.id, 'overworld')
    assert.equal(s.area, 'PHAREIM.NO')
    assert.equal(s.dialog, null)
    // East along the road to the hut's front yard; the Keeper speaks on arrival in Home Glade.
    walkTo(s, OX + 2, 30, { keepDialog: true })
    assert.equal(s.mode, 'dialog')
    assert.equal(s.area, 'HOME GLADE')
    assert.equal(s.dialog.who, 'keeper')
    assert.deepEqual(s.dialog.lines, Z.INTRO)
    settle(s)
    assert.ok(s.flags.intro)
    // No play time without the blade.
    assert.equal(s.elapsed, 0)
    // Out and back in: no second telling.
    walkTo(s, OX - 3, 26)
    walkTo(s, OX + 6, 30)
    assert.equal(s.mode, 'play')
    // The chest beside the door holds the blade; the clock starts with it.
    face(s, 'up'); pressA(s)
    assert.equal(s.inv.sword, true)
    for (let k = 0; k < 60; k++) step(s)
    assert.ok(s.elapsed > 0.9)
  })

  it('steps out of the hut door on its own, then hands over', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1, at: HUT })
    assert.equal(s.mode, 'play')
    assert.deepEqual([s.hero.x, s.hero.y, s.hero.dir], [OX + 7.5, 28.5, 'down'])
    assert.ok(s.hero.auto)
    // Input waits while the hero walks out.
    step(s, inp({ move: { x: 1, y: 0 } }))
    assert.equal(s.hero.x, OX + 7.5)
    let frames = 1
    while (s.hero.auto && frames < 120) { step(s); frames++ }
    const t = frames / 60
    assert.ok(t >= 0.18 && t <= 0.3, `walk-out took ${t.toFixed(2)} s`)
    assert.ok(Math.abs(s.hero.x - OX - 7.5) < 1e-6 && Math.abs(s.hero.y - 29.5) < 1e-6, `at ${s.hero.x},${s.hero.y}`)
    assert.equal(s.mode, 'play')
  })

  it('a save continues where it is told to, with its items', () => {
    const g = newGame()
    g.inv.sword = true
    g.inv.bits = 12
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(g))))
    assert.equal(save.entry, 'hut')
    // By default at its continue point…
    let s = Z.createGame(Z.WORLD, { save })
    assert.equal(s.area, 'HOME GLADE')
    // …or at the town's start, or in front of a cabinet.
    s = Z.createGame(Z.WORLD, { save, at: Z.WORLD.start })
    assert.deepEqual([s.map.id, s.area, s.inv.sword, s.inv.bits], ['overworld', 'PHAREIM.NO', true, 12])
    s = Z.createGame(Z.WORLD, { save, at: { map: 'arcade', entry: 'galaga' } })
    assert.equal(s.map.id, 'arcade')
    assert.equal(s.hero.dir, 'up')
    // An unknown spot falls back to the start.
    s = Z.createGame(Z.WORLD, { save, at: { map: 'arcade', entry: 'nope' } })
    assert.equal(s.area, 'HOME GLADE')
  })

  it('swings, cuts a bush and spins', () => {
    const s = newGame()
    s.inv.sword = true
    const t0 = s.map.tiles.filter(t => t === '*').length
    // Put the hero next to a bush and swing at it.
    const i = s.map.tiles.findIndex((t, k) => t === '*' && s.map.tiles[k + 1] === '.')
    s.hero.x = (i % s.map.w) + 1.5
    s.hero.y = Math.floor(i / s.map.w) + 0.5
    s.hero.dir = 'left'
    const ev = [...step(s, inp({ aPress: true, a: true }))]
    for (let k = 0; k < 20; k++) ev.push(...step(s))
    assert.ok(ev.some(e => e.type === 'swing'))
    assert.ok(s.map.tiles.filter(t => t === '*').length < t0)
    // Charge and release for a spin.
    const ev2 = [...step(s, inp({ aPress: true, a: true }))]
    for (let k = 0; k < 80; k++) ev2.push(...step(s, inp({ a: true })))
    ev2.push(...step(s, inp({ a: false })))
    assert.ok(ev2.some(e => e.type === 'charged'))
    assert.ok(ev2.some(e => e.type === 'spin'))
  })

  it('lifts and throws a pot', () => {
    const s = newGame()
    const i = s.map.tiles.findIndex((t, k) => t === 'o' && s.map.tiles[k + s.map.w] === '.')
    s.hero.x = (i % s.map.w) + 0.5
    s.hero.y = Math.floor(i / s.map.w) + 1.5
    s.hero.dir = 'up'
    pressA(s)
    assert.equal(s.hero.carry, 'pot')
    for (let k = 0; k < 30; k++) step(s)
    const ev = [...step(s, inp({ aPress: true, a: true }))]
    for (let k = 0; k < 60; k++) ev.push(...step(s))
    assert.ok(ev.some(e => e.type === 'shatter'))
    assert.equal(s.hero.carry, null)
  })
})

describe("the Keeper's hut", () => {
  it('has one door, and leaving walks you out of it again', () => {
    const s = newGame()
    walkTo(s, OX + 7, 28)
    for (let k = 0; k < 80 && s.mode !== 'play'; k++) step(s)
    assert.equal(s.map.id, 'hut')
    assert.equal(s.area, "KEEPER'S HUT")
    assert.deepEqual(s.map.exits, [])
    walkTo(s, 6, 8)
    for (let k = 0; k < 80 && s.mode !== 'play'; k++) step(s)
    assert.equal(s.map.id, 'overworld')
    for (let k = 0; k < 40; k++) step(s)
    assert.equal(s.map.id, 'overworld', 'did not bounce back in')
    assert.deepEqual([s.hero.x, s.hero.y, s.mode], [OX + 7.5, 29.5, 'play'])
  })
})

// A small world with every kind of exit, spikes, a pit, a blob and a spitter.
function fixture() {
  return {
    start: { map: 'room', entry: 'start' },
    maps: {
      room: {
        id: 'room', name: 'FIXTURE', kind: 'interior', track: 'indoor',
        rows: [
          '#####E######',
          '#c.........#',
          '#......x...#',
          '#k....@....#',
          '#......j...#',
          '#...e....O.#',
          '#..........#',
          '############',
        ],
        marks: {
          '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
          c: { tile: 'M', ent: { t: 'exit', id: 'galaga', to: { theme: 'galaga' }, look: 'cabinet', art: 'galaga', label: 'GALAGA', lines: ['GALAGA. SHOOT THE SWARM.', 'INSERT COIN? PRESS A.'] } },
          k: { tile: 'n', ent: { t: 'exit', id: 'md', to: { url: 'https://phareim.md' }, side: 'right' } },
          E: { tile: 'D', ent: { t: 'exit', id: 'hangar', to: { theme: 'hangar' } } },
          e: { ent: { t: 'enemy', kind: 'blob' } },
          j: { ent: { t: 'enemy', kind: 'spitter' } },
        },
      },
    },
  }
}

/** Step until the game leaves, collecting events. */
function runOut(W, s, input = inp(), max = 240) {
  const ev = []
  for (let k = 0; k < max && s.mode !== 'exit'; k++) ev.push(...Z.stepGame(W, s, 1 / 60, input))
  return ev
}

describe('exits', () => {
  it('validates, registers an entry beside each exit and lists them on the map', () => {
    const W = fixture()
    assert.deepEqual(Z.validateWorld(W), [])
    const e = Z.mapInfo(W, 'room').entries
    assert.deepEqual(e.galaga, { x: 1.5, y: 2.5, dir: 'up' }) // below a cabinet, facing it
    assert.deepEqual(e.md, { x: 2.5, y: 3.5, dir: 'left' }) // side: 'right', facing it
    assert.deepEqual(e.hangar, { x: 5.5, y: 1.5, dir: 'down' }) // below a door, facing away
    const s = Z.createGame(W)
    assert.equal(s.mode, 'play') // no intro in this world
    const byId = Object.fromEntries(s.map.exits.map(x => [x.id, x]))
    assert.deepEqual(byId.galaga, { id: 'galaga', x: 1.5, y: 1.5, to: { theme: 'galaga' }, look: 'cabinet', art: 'galaga', label: 'GALAGA', walk: false })
    assert.equal(byId.md.look, 'sign')
    assert.equal(byId.md.walk, false)
    assert.equal(byId.hangar.look, 'door')
    assert.equal(byId.hangar.walk, true)
  })

  it('a cabinet: A shows its lines, closing them leaves through it', () => {
    const W = fixture()
    const s = Z.createGame(W)
    Z.enterMap(W, s, 'room', 'galaga', [])
    const ev = [...Z.stepGame(W, s, 1 / 60, inp({ aPress: true, a: true }))]
    assert.equal(s.mode, 'dialog')
    assert.deepEqual(s.dialog.lines, ['GALAGA. SHOOT THE SWARM.', 'INSERT COIN? PRESS A.'])
    for (let k = 0; k < 20 && s.mode === 'dialog'; k++) {
      ev.push(...Z.stepGame(W, s, 0.3, inp()))
      ev.push(...Z.stepGame(W, s, 1 / 60, inp({ aPress: true, a: true })))
    }
    assert.equal(s.mode, 'warp')
    assert.ok(ev.some(e => e.type === 'text'))
    ev.push(...runOut(W, s))
    assert.equal(s.mode, 'exit')
    assert.deepEqual(ev.filter(e => e.type === 'exit'), [{ type: 'exit', id: 'galaga', to: { theme: 'galaga' } }])
    assert.equal(s.warp.t, Z.WARP_TIME) // held at full dark
  })

  it('a solid exit without lines leaves at once', () => {
    const W = fixture()
    const s = Z.createGame(W)
    Z.enterMap(W, s, 'room', 'md', [])
    Z.stepGame(W, s, 1 / 60, inp({ aPress: true, a: true }))
    assert.equal(s.mode, 'warp')
    const ev = runOut(W, s)
    assert.deepEqual(ev.filter(e => e.type === 'exit'), [{ type: 'exit', id: 'md', to: { url: 'https://phareim.md' } }])
  })

  it('a door: walking onto it leaves', () => {
    const W = fixture()
    const s = Z.createGame(W)
    Z.enterMap(W, s, 'room', 'hangar', [])
    const ev = runOut(W, s, inp({ move: { x: 0, y: -1 } }))
    assert.equal(s.mode, 'exit')
    assert.deepEqual(ev.filter(e => e.type === 'exit'), [{ type: 'exit', id: 'hangar', to: { theme: 'hangar' } }])
  })

  it('the validator catches bad exits', () => {
    const W = fixture()
    const m = W.maps.room
    m.rows = m.rows.map(r => r.replace('k', 'c'))
    m.marks.c.ent.to = { url: 'http://insecure.example' }
    m.marks.E.ent.side = 'up'
    const out = Z.validateWorld(W).join('\n')
    assert.match(out, /exit id galaga is used twice/)
    assert.match(out, /exit galaga goes to url http:\/\/insecure.example/)
    assert.match(out, /exit hangar has no floor on its up side/)
  })
})

describe('before the blade', () => {
  it('A and B do nothing with nothing to talk to, and nothing shows a buzz', () => {
    const W = fixture()
    const s = Z.createGame(W)
    const ev = [...Z.stepGame(W, s, 1 / 60, inp({ aPress: true, a: true, bPress: true }))]
    for (let k = 0; k < 30; k++) ev.push(...Z.stepGame(W, s, 1 / 60, inp()))
    assert.deepEqual(ev.filter(e => e.type === 'swing' || e.type === 'error'), [])
    assert.equal(s.mode, 'play')
  })

  it('with the blade, A swings', () => {
    const W = fixture()
    const s = Z.createGame(W)
    s.inv.sword = true
    const ev = [...Z.stepGame(W, s, 1 / 60, inp({ aPress: true, a: true, bPress: true }))]
    assert.ok(ev.some(e => e.type === 'swing'))
  })
})

describe('saves', () => {
  it('round-trips and rejects garbage', () => {
    const s = newGame()
    s.inv.sword = true
    s.inv.bits = 42
    s.flags['chest:ow.sword'] = true
    const save = Z.toSave(s)
    const back = Z.parseSave(JSON.parse(JSON.stringify(save)))
    assert.ok(back)
    const s2 = Z.createGame(Z.WORLD, { save: back })
    assert.equal(s2.inv.bits, 42)
    assert.equal(s2.mode, 'play')
    assert.equal(Z.parseSave({ v: 1 }), null)
    assert.equal(Z.parseSave('nope'), null)
    assert.equal(Z.parseSave({ ...save, inv: { ...save.inv, bits: 'x' } }), null)
    assert.equal(Z.toSave(Z.createGame(Z.WORLD, { demo: true })), null)
  })

  it('death respawns at the entry with full hearts and keeps progress', () => {
    const s = newGame()
    s.inv.sword = true
    s.flags['chest:ow.sword'] = true
    const blob = s.map.enemies.find(e => e.kind === 'blob')
    s.hero.hp = 1
    s.hero.invuln = 0
    let died = false
    for (let k = 0; k < 300 && !died; k++) { s.hero.x = blob.x; s.hero.y = blob.y; step(s); died = s.mode === 'dying' }
    assert.ok(died)
    for (let k = 0; k < 300 && s.mode !== 'play'; k++) step(s)
    assert.equal(s.mode, 'play')
    assert.equal(s.hero.hp, s.hero.maxHp)
    assert.equal(s.inv.sword, true)
  })
})

describe('profile saves', () => {
  const saveAt = (at, patch = {}) => ({ ...Z.toSave(newGame()), savedAt: at, ...patch })

  it('keeps savedAt through parseSave and drops junk stamps', () => {
    const save = saveAt(1_700_000_000_000)
    assert.equal(Z.parseSave(JSON.parse(JSON.stringify(save))).savedAt, 1_700_000_000_000)
    assert.equal(Z.parseSave({ ...save, savedAt: 'x' }).savedAt, undefined)
  })

  it('reconciles by newest write', () => {
    const old = saveAt(100)
    const fresh = saveAt(200, { elapsed: 99 })
    const remote = (data, savedAt) => ({ data, savedAt, best: null, clears: 0 })
    // No profile copy yet: send ours (a save, or a clear we remember).
    assert.deepEqual(Z.reconcile(old, 100, null, null), { kind: 'push', save: old, savedAt: 100 })
    assert.deepEqual(Z.reconcile(null, 50, null, null), { kind: 'push', save: null, savedAt: 50 })
    assert.deepEqual(Z.reconcile(null, 0, null, null), { kind: 'none' })
    // Profile newer: take it, including a cleared slot after a win elsewhere.
    assert.deepEqual(Z.reconcile(old, 100, remote(fresh, 200), fresh), { kind: 'pull', save: fresh })
    assert.deepEqual(Z.reconcile(old, 100, remote(null, 200), null), { kind: 'pull', save: null })
    // Local newer: send it; equal: nothing.
    assert.equal(Z.reconcile(fresh, 200, remote(old, 100), old).kind, 'push')
    assert.equal(Z.reconcile(old, 100, remote(old, 100), old).kind, 'none')
    // A newer local clear beats an older profile save (new game stays new).
    assert.deepEqual(Z.reconcile(null, 300, remote(old, 100), old), { kind: 'push', save: null, savedAt: 300 })
    // An unreadable profile save never replaces a readable local one.
    assert.equal(Z.reconcile(old, 100, remote({ v: 99 }, 200), null).kind, 'push')
  })

  it('summarises the quest from a save', () => {
    const s = newGame()
    let q = Z.summarizeSave(Z.toSave(s))
    assert.equal(q.step, 0)
    assert.equal(q.goal, 'THE BLADE')
    assert.equal(q.hearts, Z.START_HP / 2)
    s.inv.sword = true
    s.inv.bombBag = true
    q = Z.summarizeRaw(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.equal(q.step, 2)
    assert.equal(q.goal, 'THE WILDWOOD')
    Object.assign(s.inv, { hook: true, arc: true })
    for (const f of ['luna', 'mistral', 'gateShut', 'bomb:overworld:3,4']) s.flags[f] = true
    q = Z.summarizeRaw(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.equal(q.step, 8)
    assert.equal(q.goal, 'THE DISC')
    assert.equal(Z.summarizeRaw({ nope: true }), null)
    assert.equal(Z.formatPlayTime(3725), '1:02:05')
    assert.equal(Z.formatPlayTime(95), '1:35')
  })
})

describe('full run', () => {
  it('goes from the hut to the Sun Prism', () => {
    const s = newGame(11)
    const got = item => assert.ok(s.flags[`item:${item}`], `expected ${item}`)
    // Blade
    walkTo(s, OX + 6, 30)
    face(s, 'up'); pressA(s); got('sword')
    // Bomb bag in Whisper Woods (chest at OX+5,4 — stand below it)
    walkTo(s, OX + 5, 5)
    face(s, 'up'); pressA(s); got('bombBag')
    // Heart piece behind the woods boulder (OX+24,5): bomb from below
    walkTo(s, OX + 24, 6)
    face(s, 'up')
    step(s, inp({ bPress: true }))
    for (let k = 0; k < 150; k++) { s.hero.invuln = 1; step(s) }
    walkTo(s, OX + 24, 5)
    walkTo(s, OX + 24, 3)
    settle(s)
    assert.equal(s.inv.pieces, 1)
    // Rubble at the shrine (the static vines in front of it died with the Gate, in the Wildwood run): bomb it
    s.flags.gateShut = true
    step(s)
    walkTo(s, OX + 57, 5)
    face(s, 'up')
    step(s, inp({ bPress: true }))
    for (let k = 0; k < 150; k++) { s.hero.invuln = 1; step(s) }
    assert.equal(s.map.tiles[4 * s.map.w + OX + 57], '.')
    walkTo(s, OX + 57, 3)
    walkTo(s, OX + 57, 2, { map: 'overworld' })
    for (let k = 0; k < 80; k++) step(s)
    assert.equal(s.map.id, 'shrine')
    // East room: clear it, key chest appears
    walkTo(s, 33, 41)
    for (let k = 0; k < 60; k++) step(s)
    killCell(s)
    walkTo(s, 39, 44)
    face(s, 'up'); pressA(s)
    assert.equal(s.inv.keys, 1)
    // Push room (2,2): block (38,28) → right ×4, down ×3, right ×1 onto the plate (43,31)
    walkTo(s, 36, 34)
    const push = (fromX, fromY, dir, n) => {
      for (let k = 0; k < n; k++) {
        const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir]
        walkTo(s, fromX + v[0] * k, fromY + v[1] * k)
        for (let f = 0; f < 40; f++) step(s, inp({ move: { x: v[0], y: v[1] } }))
        for (let f = 0; f < 20; f++) step(s)
      }
    }
    push(37, 28, 'right', 4)
    push(42, 27, 'down', 3)
    push(41, 31, 'right', 1)
    for (let k = 0; k < 10; k++) step(s)
    assert.ok(s.map.plates.includes('push'), 'plate pressed')
    assert.equal(s.map.tiles[24 * s.map.w + 39], '.', 'gate open')
    // Dark room (2,1): clear, key 2
    walkTo(s, 39, 21)
    for (let k = 0; k < 60; k++) step(s)
    killCell(s)
    walkTo(s, 39, 18)
    face(s, 'up'); pressA(s)
    assert.equal(s.inv.keys, 2)
    // Hub west door → crystal room
    walkTo(s, 17, 29)
    for (let k = 0; k < 60; k++) step(s, inp({ move: { x: -1, y: 0 } }))
    assert.equal(s.inv.keys, 1)
    walkTo(s, 12, 30)
    face(s, 'left'); pressA(s)
    for (let k = 0; k < 30; k++) step(s)
    assert.equal(s.map.crystal[s.zoneIndex], 'cyan')
    walkTo(s, 3, 29)
    face(s, 'down'); pressA(s)
    got('disc')
    // Back to pink so the north blocks drop, then the locked door north.
    walkTo(s, 12, 30)
    face(s, 'left'); pressA(s)
    for (let k = 0; k < 30; k++) step(s)
    walkTo(s, 7, 25)
    for (let k = 0; k < 60; k++) step(s, inp({ move: { x: 0, y: -1 } }))
    assert.equal(s.inv.keys, 0)
    // Miniboss room (0,1)
    walkTo(s, 7, 21)
    for (let k = 0; k < 60; k++) step(s)
    killCell(s)
    assert.ok(s.flags.miniboss)
    for (let k = 0; k < 30; k++) step(s)
    walkTo(s, 8, 20)
    face(s, 'up'); pressA(s)
    got('bigKey')
    // Ante (1,1): disc the switch across the water from the corridor
    walkTo(s, 7, 29)
    walkTo(s, 23, 26)
    walkTo(s, 23, 16)
    face(s, 'left')
    s.inv.selected = 'disc'
    step(s, inp({ bPress: true }))
    for (let k = 0; k < 120; k++) step(s)
    assert.equal(s.map.crystal[s.zoneIndex], 'cyan', 'switch flipped by the disc')
    walkTo(s, 23, 13)
    for (let k = 0; k < 60; k++) step(s, inp({ move: { x: 0, y: -1 } }))
    // Boss
    walkTo(s, 23, 9)
    for (let k = 0; k < 60; k++) step(s)
    killCell(s)
    assert.ok(s.flags.boss)
    for (let k = 0; k < 20; k++) step(s)
    walkTo(s, 22, 8)
    settle(s)
    assert.equal(s.hero.maxHp, 8)
    walkTo(s, 25, 8)
    settle(s)
    assert.equal(s.mode, 'won')
  })
})
