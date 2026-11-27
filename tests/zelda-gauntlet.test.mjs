// The boss gauntlet: every boss in its own room on the real maps, played through `stepGame` by scripted heroes.
//   - one who stands still is hurt;
//   - one who does what the fight asks (the blade at the right time, the hook, the llama's own spit batted back) fells
//     it without god mode, and its flag is set;
//   - all along both fights its bar is gold exactly while the blade bites: every few frames a blow from the front is
//     tried on a copy of the game and compared with `bossOpen`, which the renderer paints the bar by.
// A new boss in `BIG` adds its fight here (or names the file that holds it, `ELSEWHERE`).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

/** Bosses whose fights are played in a test file of their own. */
const ELSEWHERE = { mixtral: 'zelda-echo-barrow.test.mjs', parrot: 'zelda-echo-barrow.test.mjs' }
ELSEWHERE.sycophant = 'zelda-steamhouse.test.mjs'
ELSEWHERE.grok = 'zelda-heap.test.mjs'
ELSEWHERE.bard = 'zelda-act-three.test.mjs'

/**
 * Each boss: its map, the flag its fall sets, the B item the fight takes, and the states the two fights must have
 * seen (so that the bar was checked in each; `+` after a name is the same state stunned).
 */
const BOSSES = {
  knight: { map: 'shrine', flag: 'miniboss', item: 'disc', states: ['walk', 'tell', 'charge', 'dazed', 'walk+'] },
  king: { map: 'shrine', flag: 'boss', states: ['float', 'down', 'rise'] },
  llama: { map: 'lab1', flag: 'llama', item: 'disc', states: ['walk', 'aim', 'rear', 'charge', 'walk+'] },
  // (`stand`: where the hero who only stands is put, in the room's tiles. Mistral's wind only shoves: he is hurt by
  // the pits it shoves him into, so he stands by them. By the door he is never hurt.)
  mistral: { map: 'lab1', flag: 'mistral', item: 'hook', stand: [4, 4], states: ['float', 'inhale', 'blow', 'spin', 'down', 'rise'] },
  deepseek: { map: 'deep1', flag: 'deepseek', item: 'hook', states: ['under', 'rise', 'up', 'hauled'] },
  gemini: { map: 'deep2', flag: 'gemini', item: 'disc', states: ['orbit', 'down', 'orbit+'] },
}

const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const DIR = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** A game with the hero in the boss's room, a few tiles off it on open floor, with the blade and `hearts`. */
function arena(kind, seed, hearts) {
  const { map, item } = BOSSES[kind]
  const info = Z.mapInfo(Z.WORLD, map)
  const s = Z.createGame(Z.WORLD, { seed, at: { map, entry: Object.keys(info.entries)[0] } })
  Object.assign(s.inv, { sword: true })
  if (item) Object.assign(s.inv, { [item]: true, selected: item })
  const bosses = s.map.enemies.filter(e => e.kind === kind)
  assert.ok(bosses.length, `${kind} stands in ${map}`)
  const cell = bosses[0].cell
  const room = Z.cellRect(info, cell)
  const open = (x, y) => { const t = s.map.tiles[y * s.map.w + x]; return !Z.TILE_INFO[t].solid && !Z.TILE_INFO[t].pit }
  // The open tile nearest to five tiles from the room's middle toward its south: clear of the walls and of every boss.
  let best = null
  for (let y = room.y + 2; y < room.y + room.h - 2; y++) {
    for (let x = room.x + 2; x < room.x + room.w - 2; x++) {
      if (![[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => open(x + dx, y + dy))) continue
      if (bosses.some(b => Math.hypot(b.x - x - 0.5, b.y - y - 0.5) < 4)) continue
      const d = Math.hypot(x + 0.5 - (room.x + room.w / 2), y + 0.5 - (room.y + room.h - 3))
      if (!best || d < best.d) best = { x: x + 0.5, y: y + 0.5, d }
    }
  }
  assert.ok(best, `${kind}: floor to stand on`)
  Object.assign(s.hero, { x: best.x, y: best.y, safe: { x: best.x, y: best.y }, auto: null, hp: hearts * 2, maxHp: hearts * 2 })
  s.zoneIndex = cell
  s.zone = room
  s.mode = 'play'
  s.dialog = null
  return { s, bosses, room }
}

/** Does a blow of the blade from the front take anything off `boss` as the game stands? Tried on a copy. */
function bites(s, boss) {
  const copy = structuredClone(s)
  const e = copy.map.enemies.find(o => o.id === boss.id)
  e.invuln = 0
  const hp = e.hp
  const [dx, dy] = DIR[e.dir]
  Z.hitEnemy(Z.ctx(Z.WORLD, copy, []), e, 1, e.x + dx * 2, e.y + dy * 2, 'sword')
  return e.hp < hp || e.dead
}

/**
 * Plays up to `seconds`, `policy` giving each frame's input in play (a talk or a find is pressed through), looking at
 * every living boss's bar as it goes. Stops when `until` says so, or the hero falls.
 */
function play(kind, a, policy, seconds, seen, until = () => a.bosses.every(b => b.dead)) {
  const { s, bosses } = a
  const mem = {}
  let f = 0
  for (; f < seconds * FPS && !until(); f++) {
    const input = s.mode === 'play' ? policy(a, f, mem) : inp({ aPress: f % 20 === 0 })
    Z.stepGame(Z.WORLD, s, 1 / FPS, input)
    if (s.mode === 'dying') break
    for (const b of bosses) {
      if (b.dead) continue
      const state = `${b.ai.mode}${b.stun > 0 ? '+' : ''}`
      const first = !seen.has(state)
      seen.add(state)
      // (The idle moment before a boss takes its first step has no bar to speak of.)
      if (b.ai.mode === 'idle' || !(first || f % 5 === 0)) continue
      const gold = Z.bossOpen(b)
      if (bites(s, b) !== gold) assert.fail(`${kind} ${state}: the bar is ${gold ? 'gold and the blade clanks' : 'pink and the blade bites'}`)
    }
  }
  return f / FPS
}

// ---- the hands ------------------------------------------------------------------------------------------------

/** What every hand needs of a frame: the hero, the boss, how far, the way to it. */
function look({ s }, e) {
  const h = s.hero
  const d = Math.hypot(e.x - h.x, e.y - h.y)
  const to = (k = 1) => unit(e.x - h.x, e.y - h.y, k)
  const away = (k = 1) => unit(h.x - e.x, h.y - e.y, k)
  const reach = Z.SWORD_REACH + e.r - 0.25
  return { h, d, to, away, reach }
}
/** Runs in and cuts. */
function strike(a, e, f) {
  const { d, to, reach } = look(a, e)
  return d > reach ? inp({ move: to() }) : inp({ move: to(0.05), aPress: f % 5 === 0, a: true })
}
/** The disc, from close by, until the boss has been seen stunned once (so that its bar is looked at stunned too). */
function stunOnce(a, e, f, mem) {
  mem.stunned ||= e.stun > 0
  if (mem.stunned || f > 20 * FPS) return null
  return look(a, e).d > 3.5 ? inp({ move: look(a, e).to() }) : use(a, e, f)
}
/** Faces the boss and presses B, one throw at a time. */
function use(a, e, f) {
  const { to } = look(a, e)
  return inp({ move: to(0.05), bPress: f % 8 === 0 && !a.s.hook })
}
/** Rolls square to a charge, toward the middle of the room. */
function dodge(a, e) {
  const { s, room } = a
  const h = s.hero
  const [dx, dy] = DIR[e.dir]
  let p = { x: -dy, y: dx }
  if (p.x * (room.x + room.w / 2 - h.x) + p.y * (room.y + room.h / 2 - h.y) < 0) p = { x: -p.x, y: -p.y }
  return inp({ move: p, rollPress: !h.roll })
}
/** Keeps between `near` and `far` of the boss, facing it. */
function keep(a, e, near, far) {
  const { d, to, away } = look(a, e)
  return inp({ move: d < near ? away() : d > far ? to() : to(0.05) })
}

const HANDS = {
  // The disc once, then wait for the charge to end against a wall (or the stun) and cut while the bar is gold.
  knight(a, f, mem) {
    const e = a.bosses[0]
    const disc = stunOnce(a, e, f, mem)
    if (disc) return disc
    if (Z.bossOpen(e)) return strike(a, e, f)
    if (e.ai.mode === 'charge') return dodge(a, e)
    return keep(a, e, 3, 5)
  },
  // Cut the shards off; when he drops, cut him.
  king(a, f) {
    const e = a.bosses[0]
    if (Z.bossOpen(e)) return strike(a, e, f)
    const shard = [0, 1, 2, 3].filter(i => e.ai.shards & (1 << i)).map(i => Z.shardPos(e, i))
      .sort((p, q) => Math.hypot(p.x - a.s.hero.x, p.y - a.s.hero.y) - Math.hypot(q.x - a.s.hero.x, q.y - a.s.hero.y))[0]
    if (!shard || e.ai.mode !== 'float') return keep(a, e, 4, 6)
    const { h } = look(a, e)
    const d = Math.hypot(shard.x - h.x, shard.y - h.y)
    const way = unit(shard.x - h.x, shard.y - h.y, d > 1.2 ? 1 : 0.05)
    return inp({ move: way, aPress: d < 1.6 && f % 5 === 0, a: d < 1.6 })
  },
  // The disc once, then stand at a spit's distance and bat each spit back.
  llama(a, f, mem) {
    const e = a.bosses[0]
    const disc = stunOnce(a, e, f, mem)
    if (disc) return disc
    const { h } = look(a, e)
    const spit = a.s.map.projectiles.find(p => p.kind === 'spit' && !p.friendly && Math.hypot(p.x - h.x, p.y - h.y) < 1.5)
    if (spit) return inp({ move: unit(spit.x - h.x, spit.y - h.y, 0.05), aPress: true, a: true })
    if (e.ai.mode === 'charge') return dodge(a, e)
    return keep(a, e, 3, 4.5)
  },
  // Wait in the middle of the room, between its pillars; hook it while it draws breath; cut it on the floor.
  mistral(a, f) {
    const e = a.bosses[0]
    if (Z.bossOpen(e)) return strike(a, e, f)
    const { h, d } = look(a, e)
    // (Not into a pillar: the hook would bite it and reel the hero off.)
    if ((e.ai.mode === 'inhale' || e.ai.mode === 'blow') && d <= 6 && Z.lineClear(Z.WORLD, a.s.map, h.x, h.y, e.x, e.y)) return use(a, e, f)
    const mid = { x: a.room.x + a.room.w / 2, y: a.room.y + a.room.h / 2 }
    const off = Math.hypot(mid.x - h.x, mid.y - h.y)
    return off > 0.5 ? inp({ move: unit(mid.x - h.x, mid.y - h.y) }) : keep(a, e, 0, 9)
  },
  // Hook it from under the floor; cut it while it is up.
  deepseek(a, f) {
    const e = a.bosses[0]
    if (Z.bossOpen(e)) return strike(a, e, f)
    return look(a, e).d > 5 ? inp({ move: look(a, e).to() }) : use(a, e, f)
  },
  // Wear both down evenly, so that the second falls before the first gets up.
  gemini(a, f, mem) {
    const up = a.bosses.filter(b => !b.dead && b.ai.mode !== 'down')
    const e = up.sort((x, y) => y.hp - x.hp)[0]
    if (!e) return inp()
    return stunOnce(a, e, f, mem) ?? strike(a, e, f)
  },
}

// ---- the gauntlet ---------------------------------------------------------------------------------------------

describe('the boss gauntlet', () => {
  it('has a fight for every boss', () => {
    assert.deepEqual([...Z.BIG].filter(k => !BOSSES[k] && !ELSEWHERE[k]), [])
  })

  for (const [kind, { flag, states }] of Object.entries(BOSSES)) {
    it(`${kind}: hurts a hero who stands, falls to one who fights it as it asks, and is gold exactly while the blade bites`, () => {
      const seen = new Set()
      // Standing still.
      const still = arena(kind, 1, 30)
      const { stand } = BOSSES[kind]
      if (stand) {
        const at = { x: still.room.x + stand[0] + 0.5, y: still.room.y + stand[1] + 0.5 }
        Object.assign(still.s.hero, { ...at, safe: { ...at } })
      }
      play(kind, still, () => inp(), 60, seen, () => still.s.hero.hp < still.s.hero.maxHp)
      assert.ok(still.s.hero.hp < still.s.hero.maxHp, `${kind}: stood a minute unharmed`)
      assert.ok(!still.s.flags[flag])
      // Fighting: thirty hearts, every blow taken as it comes.
      const a = arena(kind, 2, 30)
      assert.ok(!a.s.flags[flag])
      if (kind === 'gemini') {
        // One twin brought down and left alone gets up again.
        const [first] = a.bosses
        play(kind, a, (g, f) => strike(g, first, f), 90, seen, () => first.ai.mode === 'down')
        assert.equal(first.ai.mode, 'down', 'the first twin falls')
        play(kind, a, g => keep(g, first, 6, 9), 5, seen, () => first.ai.mode !== 'down')
        assert.ok(first.ai.mode === 'orbit' && first.hp > 0 && !first.dead && !a.s.flags[flag], 'and gets up again')
      }
      const seconds = play(kind, a, HANDS[kind], 240, seen)
      const left = a.bosses.map(b => b.hp)
      assert.ok(a.bosses.every(b => b.dead), `${kind}: not felled in ${seconds.toFixed(0)} s (hp ${left}, hero ${a.s.hero.hp})`)
      assert.equal(a.s.flags[flag], true, `${kind}: its flag`)
      assert.ok(a.s.hero.hp > 0)
      if (process.env.GAUNTLET) console.log(`${kind}: ${seconds.toFixed(1)} s, ${a.s.hero.maxHp - a.s.hero.hp} of ${a.s.hero.maxHp} half hearts lost; states ${[...seen].join(' ')}`)
      for (const state of states) assert.ok(seen.has(state), `${kind}: the bar was never checked ${state} (seen ${[...seen].join(' ')})`)
    })
  }
})
