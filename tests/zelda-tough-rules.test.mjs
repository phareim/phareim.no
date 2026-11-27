// Tough foes (docs/games/neon-shrine.md, "Tough foes"): the rules round the fight, played with scripted presses
// through `stepGame`. The fight itself is `zelda-tough.test.mjs`. Here: the mark's validator; poise and the opening;
// the disc and the hook; the day clock, the fall and the water; and the five that stand in the lands, each from its
// real mark.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

/** The five that stand in the lands: map, column, row, kind. */
const FIVE = [
  ['fogstage', 54, 35, 'sentry'],
  ['rerun', 29, 26, 'hound'],
  ['seterfell', 43, 8, 'sentry'],
  ['sporelight', 72, 4, 'sentry'],
  ['stillsand', 53, 22, 'sentry'],
]

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const A = inp({ aPress: true, a: true })

/** A bare room from marks: `z` and `y` are foes, the hero at `@` facing east with the blade. */
function room(rows, marks, extra = {}) {
  // (Not a map id starting with `t`: the tempest's list of what it has struck keeps those, `engine/moves.ts`.)
  const def = { id: 'room', name: 'ROOM', kind: 'interior', track: 'indoor', rows, marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, ...marks }, ...extra }
  const W = { maps: { room: def }, start: { map: 'room', entry: 'start' } }
  const s = Z.createGame(W, { seed: 3 })
  s.mode = 'play'
  s.dialog = null
  s.inv.sword = true
  s.hero.dir = 'right'
  s.hero.aim = 0
  s.hero.maxHp = s.hero.hp = 30
  const ev = []
  const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) ev.push(...Z.stepGame(W, s, 1 / 60, i)) }
  return { W, s, ev, go, foes: s.map.enemies, c: () => Z.ctx(W, s, ev) }
}
const mark = (kind = 'sentry', more = { tough: true }) => ({ ent: { t: 'enemy', kind, dir: 'left', ...more } })
const OPEN_ROWS = ['##############', '#............#', '#............#', '#............#', '#...@z.......#', '#............#', '#............#', '#..........y.#', '##############']
/** A tough foe a tile east of the hero (and a plain one far off), made to stand in `mode`. */
function duel(kind = 'sentry', mode = 'stalk', more) {
  const r = room(OPEN_ROWS, { z: mark(kind, more), y: mark('blob', {}) })
  const e = r.foes.find(f => f.kind === kind)
  e.x = r.s.hero.x + 1.2
  e.ai.mode = mode
  e.ai.t = 5
  return { ...r, e, other: r.foes.find(f => f !== e) }
}
/** One press of A, stepped until the blade lands (or it plainly will not). */
function cut(r) {
  const from = r.ev.length
  r.go(A)
  for (let k = 0; k < 20 && !r.ev.slice(from).some(v => v.type === 'hit'); k++) r.go()
  return r.ev.slice(from).find(v => v.type === 'hit')
}

describe('the mark', () => {
  it('is refused by the validator on any other kind of foe, and on a calm sentry', () => {
    const check = m => {
      const def = { id: 't', name: 'T', kind: 'interior', track: 'indoor', rows: ['#####', '#@z.#', '#####'], marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, z: m } }
      return Z.validateWorld({ maps: { t: def }, start: { map: 't', entry: 'start' } }).join('\n')
    }
    assert.equal(check(mark('sentry')), '')
    assert.equal(check(mark('hound')), '')
    assert.match(check(mark('blob')), /tough blob/)
    assert.match(check(mark('sentry', { tough: true, calm: true })), /calm and tough/)
  })
})

describe('poise', () => {
  it('clanks the blade off a stalking one, the Arc Blade too, and moves nothing; a spent one reels, as a plain one does', () => {
    for (const arc of [false, true]) {
      const r = duel()
      if (arc) r.s.inv.arc = true
      r.s.hero.edge = true
      const hx = r.s.hero.x
      r.go(A)
      for (let k = 0; k < 20 && !r.ev.some(v => v.type === 'clank'); k++) r.go()
      const clank = r.ev.find(v => v.type === 'clank')
      assert.ok(clank, 'it clanked')
      assert.ok(Math.hypot(clank.x - r.e.x, clank.y - r.e.y) < 0.2, 'at the foe')
      assert.ok(!r.ev.some(v => v.type === 'hit'))
      assert.equal(r.e.hp, r.e.maxHp)
      assert.equal(r.e.knock, null)
      assert.ok(!((r.e.stagger ?? 0) > 0) && !(r.e.flash > 0))
      assert.equal(r.e.ai.mode, 'stalk', 'it goes on with what it was doing')
      assert.equal(r.s.hero.knock ?? null, null, 'the hero is not shoved')
      assert.ok(r.s.hero.x >= hx, 'nor thrown back')
      assert.equal(r.s.hero.edge, true, 'and a SLIP\'s critical edge is not spent on the clank')
      // The same hit on a spent one, and on a plain sentry.
      for (const [mode, more] of [['spent', undefined], ['patrol', {}]]) {
        const o = duel('sentry', mode, more)
        if (arc) o.s.inv.arc = true
        o.e.ai.t = 99
        assert.equal(Z.toughOpen(o.e), mode === 'spent')
        assert.ok(cut(o), mode)
        assert.equal(o.e.maxHp - o.e.hp, Z.COMBO[0].dmg * (arc ? 2 : 1), mode)
        assert.ok(o.e.knock, 'shoved')
        assert.ok(o.e.stagger > 0, 'reeling')
      }
    }
  })

  it('every move of the blade clanks off a closed one: the chain, the spin, the flip cut, the tempest', () => {
    // Each move, then a clank after the move's own mark (the swing, the spin, the leap): the foe stands telling.
    const moves = {
      chain: [r => { for (let k = 0; k < 3; k++) { r.go(A); r.go(inp(), 11) } }, 'swing', 1.6],
      spin: [r => { r.go(A); r.go(inp({ a: true }), 80); r.go(inp(), 40) }, 'spin', 1.6],
      flip: [r => { r.go(inp({ rollPress: true, move: { x: 1, y: 0 } })); r.go(inp(), 4); r.go(A); r.go(inp(), 40) }, 'air', 3.2],
      tempest: [r => {
        r.go(A); r.go(inp(), 11); r.go(A); r.go(inp(), 11); r.go(A)
        for (let k = 0; k < 40 && !(r.s.hero.swing && r.s.hero.swing.t / Z.swingDur(r.s.hero.swing) >= Z.TEMPEST_FROM); k++) r.go()
        r.go(A)
        assert.equal(r.s.hero.air?.kind, 'tempest')
        r.go(inp(), 60)
      }, 'air', 1.2],
    }
    for (const [name, [play, mark, d]] of Object.entries(moves)) {
      const r = duel('sentry', 'tell')
      r.s.inv.arc = true
      r.s.hero.invuln = 99
      r.e.ai.t = 99
      r.e.x = r.s.hero.x + d
      play(r)
      const at = r.ev.findIndex(v => v.type === mark)
      assert.ok(at >= 0, `${name}: no ${mark}`)
      assert.ok(r.ev.slice(at).some(v => v.type === 'clank'), `${name}: it clanked`)
      assert.equal(r.e.hp, r.e.maxHp, name)
    }
  })
})

describe('the disc and the hook', () => {
  it('stun it open, are shrugged off for a while after, and the finisher on a stunned one is critical', () => {
    for (const [item, kind, mode, time] of [['disc', 'sentry', 'stalk', 'stunDisc'], ['hook', 'hound', 'prowl', 'stunHook']]) {
      const r = duel(kind, mode)
      Object.assign(r.s.inv, { [item]: true, selected: item })
      r.s.hero.invuln = 99
      r.e.x = r.s.hero.x + 2.5
      /** Throws it, and steps until it has landed (or come back). */
      const throwIt = () => {
        r.e.invuln = 0
        const from = r.ev.length
        r.go(inp({ bPress: true }))
        for (let k = 0; k < 90 && !(r.e.stun > 0) && !r.ev.slice(from).some(v => v.type === 'clank'); k++) r.go()
        return r.ev.slice(from).some(v => v.type === 'clank')
      }
      throwIt()
      assert.ok(r.e.stun > Z.TOUGH[time] - 0.1 && r.e.stun <= Z.TOUGH[time], `${item}: stunned ${r.e.stun}`)
      assert.ok(Z.toughOpen(r.e))
      assert.equal(r.e.hp, r.e.maxHp)
      // Once it is over, the next one clanks off, until TOUGH.shrug has passed.
      r.go(inp(), Math.ceil(r.e.stun * 60) + 60)
      assert.equal(r.e.stun, 0)
      r.e.x = r.s.hero.x + 2.5
      r.e.y = r.s.hero.y
      assert.equal(throwIt(), true, `${item}: shrugged off`)
      assert.equal(r.e.stun, 0)
      r.go(inp(), Math.ceil(Z.TOUGH.shrug * 60) + 1)
      r.e.x = r.s.hero.x + 2.5
      r.e.y = r.s.hero.y
      throwIt()
      assert.ok(r.e.stun > 0, `${item}: and stuns again`)
    }
    // The whole chain on one the disc has stunned: the two quick cuts reel it, the third bites harder.
    const r = duel()
    assert.ok(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'))
    r.go(A); r.go(inp(), 11); r.go(A); r.go(inp(), 11)
    assert.ok(r.e.stun > 0, 'still stunned')
    const hp = r.e.hp
    const from = r.ev.length
    r.go(A); r.go(inp(), 30)
    assert.equal(r.ev.slice(from).filter(v => v.type === 'hit').at(-1)?.crit, true)
    assert.equal(hp - r.e.hp, Z.COMBO[2].dmg + 1)
  })

  it('start a foe caught mid-charge over: it tells in full before it harms', () => {
    const r = duel('sentry', 'idle')
    r.e.x = r.s.hero.x + 3
    r.e.ai.mode = 'stalk'
    r.e.ai.t = 0
    // Up to the moment it is caught.
    for (let k = 0; k < 600 && r.e.ai.mode !== 'charge'; k++) { r.s.hero.invuln = 1; r.go() }
    assert.equal(r.e.ai.mode, 'charge')
    r.s.hero.invuln = 0
    r.e.invuln = 0
    assert.ok(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'))
    let stunned = 0
    while (r.e.stun > 0) { r.s.hero.invuln = 1; r.go(); stunned++ }
    assert.ok(stunned < 2 * 60)
    assert.equal(r.e.ai.mode, 'stalk', 'back to its walk')
    assert.ok(Math.abs(r.e.ai.t - Z.TOUGH.pause) < 0.05, 'a fresh pause')
    assert.equal(r.e.ai.tell, 0)
    // From here: it tells, the whole tell, before anything it does can hurt.
    r.s.hero.invuln = 0
    r.e.x = r.s.hero.x + 3
    r.e.y = r.s.hero.y
    let told = 0
    let hurt = false
    for (let k = 0; k < 10 * 60 && !hurt; k++) {
      r.go()
      if (r.e.ai.mode === 'tell') told++
      hurt = r.s.hero.hp < 30
    }
    assert.ok(hurt, 'it struck in the end')
    assert.ok(told >= Math.floor(Z.TOUGH.tell * 60) - 1, `told ${told} frames before it harmed`)
  })
})

describe('the day, the fall and the water', () => {
  it('after the Prism the five stay all day and all night with no twin, die for good until the map is entered again', () => {
    for (const [map, x, y, kind] of FIVE) {
      const s = Z.createGame(Z.WORLD, { seed: 4, at: { map, entry: Object.keys(Z.mapInfo(Z.WORLD, map).entries)[0] } })
      Object.assign(s.inv, { sword: true, prism: true })
      Z.setDaytime(Z.WORLD, s, Z.HOURS.noon)
      const id = `${map}:${x},${y}`
      const e = s.map.enemies.find(f => f.id === id)
      assert.ok(e?.tough)
      assert.ok(!e.dead && !e.away, 'there at noon')
      assert.equal(e.rank, undefined)
      e.hp = 2
      Z.setDaytime(Z.WORLD, s, Z.HOURS.night)
      assert.ok(!e.dead && !e.away, 'there at midnight')
      assert.equal(e.hp, 2, 'the clock leaves it be')
      assert.ok(!s.map.enemies.some(f => f.id === `${id}:night`))
      assert.equal(s.map.enemies.filter(f => f.tough).length, 1)
      // Struck down, it stays down until the map is entered again.
      Z.killEnemy(Z.ctx(Z.WORLD, s, []), e)
      Z.setDaytime(Z.WORLD, s, Z.HOURS.noon)
      Z.setDaytime(Z.WORLD, s, Z.HOURS.night)
      assert.ok(e.dead)
      Z.enterMap(Z.WORLD, s, map, Object.keys(Z.mapInfo(Z.WORLD, map).entries)[0], [])
      const back = s.map.enemies.find(f => f.id === id)
      assert.ok(!back.dead)
      assert.equal(back.hp, Z.TOUGH.hp[kind])
    }
  })

  it('falls with a heart, five bits and the key it carries, closed to the blade at its last hit point but not to a bomb', () => {
    const r = duel('sentry', 'stalk', { tough: true, carries: 'smallKey' })
    r.e.hp = 1
    assert.equal(cut(r), undefined)
    assert.ok(!r.e.dead)
    r.e.invuln = 0
    assert.ok(Z.hitEnemy(r.c(), r.e, 3, r.e.x - 1, r.e.y, 'bomb'))
    assert.ok(r.e.dead)
    assert.deepEqual(r.s.map.drops.map(d => d.kind).sort(), ['bit5', 'heart', 'key'])
    assert.ok(!r.ev.some(v => v.type === 'bossDown'), 'no fanfare')
    assert.equal(r.other.cell, r.e.cell)
    assert.ok(!r.other.dead, 'the others in the room live')
    // A bomb, a pot or a batted shot shoves and reels a closed one as any small foe, and a telling one keeps its warning.
    for (const src of ['bomb', 'pot', 'shot']) {
      const t = duel('sentry', 'tell')
      t.e.ai.t = t.e.ai.tell = 0.5
      assert.ok(Z.hitEnemy(t.c(), t.e, 3, t.e.x - 1, t.e.y, src), src)
      assert.equal(t.e.maxHp - t.e.hp, 3)
      assert.ok(t.e.knock && t.e.stagger > 0)
      t.go(inp(), 14)
      assert.ok(t.e.ai.tell > 0)
      assert.equal(t.e.ai.mode, 'tell')
    }
  })

  it('is not knocked into the water, where a plain one is', () => {
    for (const tough of [true, false]) {
      const rows = ['#######', '#.....#', '#.@...#', '#.m...#', '#.~~..#', '#.....#', '#######']
      const r = room(rows, { m: mark('sentry', tough ? { tough: true } : {}) }, { kind: 'dungeon', track: 'dungeon', physics: true })
      const e = r.foes[0]
      e.stun = 99
      r.s.hero.dir = 'down'
      r.s.hero.aim = Math.PI / 2
      r.go(A)
      r.go(inp(), 40)
      assert.ok(e.hp < e.maxHp, 'the blow landed')
      assert.equal(e.dead, !tough)
      if (tough) assert.equal(Math.floor(e.y), 3, 'on the bank')
    }
  })
})

describe('the five in the lands', () => {
  it('are exactly the tough foes out in the lands, and every tough foe of the world is a sentry or a hound', () => {
    const found = []
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const e = def.marks[ch]?.ent
        if (e?.t === 'enemy' && e.tough) found.push([id, x, y, e.kind])
      }))
    }
    assert.deepEqual(found.filter(f => Z.WORLD.atlas[f[0]]).sort((a, b) => a[0].localeCompare(b[0])), FIVE)
    for (const f of found) assert.ok(f[3] === 'sentry' || f[3] === 'hound')
  })

  // Where each stands, among its trees and props: four tiles off on open floor.
  it('each strike a hero who stands four tiles off, and open', () => {
    for (const [map, x, y] of FIVE) {
      const info = Z.mapInfo(Z.WORLD, map)
      const open = (tx, ty) => { const t = info.base[ty * info.w + tx]; return t !== undefined && !Z.TILE_INFO[t].solid }
      const side = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dy]) => [1, 2, 3, 4].every(k => open(x + dx * k, y + dy * k)))
      assert.ok(side, `${map}: no open side`)
      const [dx, dy] = side
      const s = Z.createGame(Z.WORLD, { seed: 1, at: { map, entry: Object.keys(info.entries)[0] } })
      s.mode = 'play'
      s.dialog = null
      s.inv.sword = true
      const e = s.map.enemies.find(f => f.id === `${map}:${x},${y}`)
      assert.ok(e?.tough)
      // Alone: whatever hurts him is this one.
      s.map.enemies = [e]
      Object.assign(s.hero, { x: x + 0.5 + dx * 4, y: y + 0.5 + dy * 4, auto: null, hp: 30, maxHp: 30 })
      let opened = false
      for (let f = 0; f < 15 * 60 && !(opened && s.hero.hp < 30); f++) {
        Z.stepGame(Z.WORLD, s, 1 / 60, inp())
        opened ||= Z.toughOpen(e)
      }
      assert.equal(s.map.id, map)
      assert.ok(opened, `${map}: never open`)
      assert.ok(s.hero.hp < 30, `${map}: never hurt`)
    }
  })

  it('every foe in the lands stands on ground that is found within two tiles of it, not on a patch of another', () => {
    for (const id of ['seterfell', 'yulefjord', 'sporelight', 'stillsand', 'rerun', 'lumenby', 'fogstage']) {
      const def = Z.WORLD.maps[id]
      const base = Z.mapInfo(Z.WORLD, id).base
      const w = def.rows[0].length
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (def.marks[ch]?.ent?.t !== 'enemy') return
        const here = base[y * w + x]
        const round = []
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if ((dx || dy) && def.rows[y + dy]?.[x + dx] !== undefined) round.push(base[(y + dy) * w + x + dx])
        assert.ok(round.includes(here), `${id}: the ${def.marks[ch].ent.kind} at ${x},${y} stands on '${here}' among '${round.join('')}'`)
      }))
    }
  })
})
