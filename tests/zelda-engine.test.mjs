// Neon Shrine engine tests: world checks, the first minute, saves, combat
// rules, puzzles, and a full scripted run from the Keeper's hut to the Sun
// Prism with a path-finding walker (god mode on, bosses killed directly).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp(), dt = 1 / 60) => Z.stepGame(Z.WORLD, s, dt, i)

function newGame(seed = 5) {
  const s = Z.createGame(Z.WORLD, { seed })
  // Skip the intro.
  while (s.mode === 'dialog') { step(s, inp(), 0.5); step(s, inp({ aPress: true, a: true })) }
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
function walkTo(s, tx, ty, { map = s.map.id, budget = 4000 } = {}) {
  let p = path(s, tx, ty)
  assert.ok(p, `no path in ${s.map.id} from ${Math.floor(s.hero.x)},${Math.floor(s.hero.y)} to ${tx},${ty}`)
  let i = 0
  for (let n = 0; n < budget; n++) {
    s.hero.hp = s.hero.maxHp
    s.hero.invuln = 1
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
  it('opens with the Keeper and has the blade one step away', () => {
    const s = Z.createGame(Z.WORLD, { seed: 1 })
    assert.equal(s.mode, 'dialog')
    settle(s)
    assert.equal(s.mode, 'play')
    face(s, 'up')
    step(s, inp({ move: { x: 0, y: -1 } }))
    pressA(s)
    assert.equal(s.inv.sword, true)
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

describe('full run', () => {
  it('goes from the hut to the Sun Prism', () => {
    const s = newGame(11)
    const got = item => assert.ok(s.flags[`item:${item}`], `expected ${item}`)
    // Blade
    walkTo(s, 6, 30)
    face(s, 'up'); pressA(s); got('sword')
    // Bomb bag in Whisper Woods (chest at 5,4 — stand below it)
    walkTo(s, 5, 5)
    face(s, 'up'); pressA(s); got('bombBag')
    // Heart piece behind the woods boulder (24,5): bomb from below
    walkTo(s, 24, 6)
    face(s, 'up')
    step(s, inp({ bPress: true }))
    for (let k = 0; k < 150; k++) { s.hero.invuln = 1; step(s) }
    walkTo(s, 24, 5)
    walkTo(s, 24, 3)
    settle(s)
    assert.equal(s.inv.pieces, 1)
    // Rubble at the shrine: stand below it and bomb it
    walkTo(s, 57, 5)
    face(s, 'up')
    step(s, inp({ bPress: true }))
    for (let k = 0; k < 150; k++) { s.hero.invuln = 1; step(s) }
    assert.equal(s.map.tiles[4 * s.map.w + 57], '.')
    walkTo(s, 57, 3)
    walkTo(s, 57, 2, { map: 'overworld' })
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
