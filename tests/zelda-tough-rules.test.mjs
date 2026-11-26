// Tough foes (docs/games/neon-shrine.md, "Tough foes"): the rules round the fight. The fight itself is
// `zelda-tough.test.mjs`. Here: the mark and the validator; poise and the opening; the disc and the hook; refills,
// the day clock, the fall and the water; and the five that stand in the lands, each from its real mark.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load } from './zelda-load.mjs'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

let Z
let resetEnemy
before(async () => {
  Z = await load()
  const out = esbuild.buildSync({
    stdin: { contents: `export { resetEnemy } from './engine/spawn'`, resolveDir: root, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  ;({ resetEnemy } = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64')))
})

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
  it('makes a tough foe with the hit points of TOUGH; a plain mark makes a plain one', () => {
    for (const kind of ['sentry', 'hound']) {
      const r = room(OPEN_ROWS, { z: mark(kind), y: mark(kind, {}) })
      const tough = r.foes.find(f => f.tough)
      const plain = r.foes.find(f => !f.tough)
      assert.equal(tough.hp, Z.TOUGH.hp[kind])
      assert.equal(tough.maxHp, Z.TOUGH.hp[kind])
      assert.equal(plain.tough, undefined)
      assert.equal(plain.hp, Z.STATS[kind].hp)
      assert.equal(plain.maxHp, Z.STATS[kind].hp)
      plain.stun = 1
      assert.equal(Z.toughOpen(plain), false, 'only a tough one is ever open')
    }
  })

  it('is refused by the validator on any other kind, and on a calm sentry', () => {
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
  for (const arc of [false, true]) {
    it(`a chain hit on a stalking tough sentry clanks off it and moves nothing${arc ? ', with the Arc Blade too' : ''}`, () => {
      const r = duel()
      if (arc) r.s.inv.arc = true
      const hx = r.s.hero.x
      r.go(A)
      for (let k = 0; k < 20 && !r.ev.some(v => v.type === 'clank'); k++) r.go()
      const clank = r.ev.find(v => v.type === 'clank')
      assert.ok(clank, 'it clanked')
      assert.ok(Math.hypot(clank.x - r.e.x, clank.y - r.e.y) < 0.2, 'at the foe')
      assert.ok(!(r.e.invuln > 0), 'a clank leaves no mercy time')
      assert.ok(!r.ev.some(v => v.type === 'hit'))
      assert.equal(r.e.hp, r.e.maxHp)
      assert.equal(r.e.knock, null)
      assert.ok(!((r.e.stagger ?? 0) > 0))
      assert.equal(r.e.reelChain, undefined)
      assert.ok(!(r.e.flash > 0), 'no flash')
      assert.equal(r.e.ai.mode, 'stalk', 'it goes on with what it was doing')
      assert.equal(r.s.hero.knock ?? null, null, 'the hero is not shoved')
      assert.ok(r.s.hero.x >= hx, 'nor thrown back')
    })

    it(`the same hit while it is spent reels and shoves it${arc ? ', with the Arc Blade too' : ''}`, () => {
      const r = duel('sentry', 'spent')
      if (arc) r.s.inv.arc = true
      assert.ok(Z.toughOpen(r.e))
      assert.ok(cut(r))
      assert.equal(r.e.maxHp - r.e.hp, Z.COMBO[0].dmg * (arc ? 2 : 1))
      assert.ok(r.e.knock, 'shoved')
      assert.ok(r.e.stagger > 0, 'reeling')
    })
  }

  it('no blow of the blade marks a closed one: the spin, a critical, a heavy cut, in every mode it shuts in', () => {
    for (const src of ['sword', 'spin']) {
      for (const [kind, modes] of [['sentry', ['stalk', 'tell', 'charge']], ['hound', ['prowl', 'tell', 'lunge']]]) {
        for (const mode of modes) {
          const r = duel(kind, mode)
          assert.equal(Z.hitEnemy(r.c(), r.e, 8, r.e.x - 1, r.e.y, src, { crit: true, knock: 1.7, stagger: 0.4, finisher: true }), false)
          assert.equal(r.e.hp, r.e.maxHp)
          assert.equal(r.e.knock, null)
          assert.ok(!((r.e.stagger ?? 0) > 0))
          assert.ok(!(r.e.invuln > 0))
          assert.equal(r.e.ai.mode, mode)
          assert.deepEqual(r.ev.map(v => v.type), ['clank'])
        }
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

  it('keeps a SLIP\'s critical edge for a blow that can land', () => {
    const r = duel()
    r.s.hero.edge = true
    assert.equal(Z.hitEnemy(r.c(), r.e, 1, r.e.x - 1, r.e.y, 'sword'), false)
    assert.equal(r.s.hero.edge, true, 'not spent on the clank')
    r.e.ai.mode = 'spent'
    r.e.invuln = 0
    assert.ok(Z.hitEnemy(r.c(), r.e, 1, r.e.x - 1, r.e.y, 'sword'))
    assert.equal(r.s.hero.edge, false)
    assert.equal(r.e.maxHp - r.e.hp, 2, 'critical')
  })

  it('a bomb, a pot or a batted shot shoves and reels it as any small foe, and a telling one keeps its warning', () => {
    for (const src of ['bomb', 'pot', 'shot']) {
      const r = duel('sentry', 'tell')
      r.e.ai.t = r.e.ai.tell = 0.5
      assert.ok(Z.hitEnemy(r.c(), r.e, 3, r.e.x - 1, r.e.y, src))
      assert.equal(r.e.maxHp - r.e.hp, 3)
      assert.ok(r.e.knock)
      assert.ok(r.e.stagger > 0)
      r.go(inp(), 14)
      assert.ok(r.e.ai.tell > 0)
      assert.equal(r.e.ai.mode, 'tell')
    }
  })

  it('a plain sentry is shoved and reels as ever', () => {
    const r = duel('sentry', 'patrol', {})
    r.e.ai.t = 99
    assert.ok(cut(r))
    assert.equal(r.e.maxHp - r.e.hp, Z.COMBO[0].dmg)
    assert.ok(r.e.knock)
    assert.ok(r.e.stagger > 0)
  })

  it('an open one harms no one; a closed one does', () => {
    for (const [mode, hurts] of [['stalk', true], ['spent', false]]) {
      const r = duel('sentry', mode)
      r.e.x = r.s.hero.x + 0.4
      r.go()
      assert.equal(r.s.hero.hp < 30, hurts, mode)
    }
  })

  it('the opening shuts on time however it is hammered, and the poise is back', () => {
    for (const [kind, open, shut] of [['sentry', 'spent', 'stalk'], ['hound', 'rest', 'prowl']]) {
      const r = duel(kind, open)
      r.e.ai.t = Z.TOUGH.spent
      for (let k = 0; k < Math.ceil(Z.TOUGH.spent * 60) + 1; k++) {
        r.e.knock = { vx: 0, vy: 0, t: 0.14 }
        r.e.stagger = 0.4
        r.go()
      }
      assert.equal(r.e.ai.mode, shut, kind)
      assert.equal(Z.toughOpen(r.e), false)
      assert.ok(!((r.e.stagger ?? 0) > 0))
    }
  })
})

describe('the disc and the hook', () => {
  for (const [src, time] of [['disc', 'stunDisc'], ['hook', 'stunHook']]) {
    for (const kind of ['sentry', 'hound']) {
      it(`the ${src} stuns a tough ${kind} for TOUGH.${time}, then it shrugs the next one off for TOUGH.shrug`, () => {
        const r = duel(kind, kind === 'sentry' ? 'stalk' : 'prowl')
        r.s.hero.invuln = 99
        const hit = () => { r.e.invuln = 0; return Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, src) }
        assert.ok(hit())
        assert.equal(r.e.stun, Z.TOUGH[time])
        assert.ok(Z.toughOpen(r.e))
        assert.equal(r.e.hp, r.e.maxHp)
        // A second one while it is stunned does not draw the stun out.
        r.go(inp(), 20)
        const left = r.e.stun
        assert.equal(hit(), false)
        assert.equal(r.e.stun, left)
        r.go(inp(), Math.ceil(left * 60) + 1)
        assert.equal(r.e.stun, 0)
        const n = r.ev.filter(v => v.type === 'clank').length
        assert.equal(hit(), false)
        assert.equal(r.e.stun, 0)
        assert.equal(r.ev.filter(v => v.type === 'clank').length, n + 1, 'it clanks off')
        r.go(inp(), Math.ceil(Z.TOUGH.shrug * 60) + 1)
        assert.ok(hit())
        assert.equal(r.e.stun, Z.TOUGH[time])
      })
    }
  }

  for (const [kind, tell, strike, walk] of [['sentry', 'tell', 'charge', 'stalk'], ['hound', 'tell', 'lunge', 'prowl']]) {
    for (const caught of [tell, strike]) {
      it(`a tough ${kind} stunned in its ${caught} starts over, and tells in full before it harms`, () => {
        const r = duel(kind, 'idle')
        r.e.x = r.s.hero.x + 3
        r.e.ai.mode = walk
        r.e.ai.t = 0
        // Up to the moment it is caught.
        for (let k = 0; k < 600 && r.e.ai.mode !== caught; k++) { r.s.hero.invuln = 1; r.go() }
        assert.equal(r.e.ai.mode, caught)
        r.s.hero.invuln = 0
        r.e.invuln = 0
        assert.ok(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'))
        let stunned = 0
        while (r.e.stun > 0) { r.s.hero.invuln = 1; r.go(); stunned++ }
        assert.ok(stunned < 2 * 60)
        assert.equal(r.e.ai.mode, walk, 'back to its walk')
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
        const full = kind === 'sentry' ? Z.TOUGH.tell : Z.TOUGH.houndTell
        assert.ok(told >= Math.floor(full * 60) - 1, `told ${told} frames before it harmed`)
      })
    }
  }

  it('the stun ends on time while the blade keeps it reeling', () => {
    const r = duel()
    r.s.hero.invuln = 99
    Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc')
    for (let k = 0; k < Math.ceil(Z.TOUGH.stunDisc * 60) + 1; k++) {
      r.e.stagger = 0.4
      r.go()
    }
    assert.equal(r.e.stun, 0)
    assert.equal(Z.toughOpen(r.e), false)
    assert.ok(!((r.e.stagger ?? 0) > 0))
  })

  it('the finisher on a tough foe the disc has stunned is critical', () => {
    const r = duel()
    assert.ok(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'))
    // The whole chain, as the hero swings it: the two quick cuts reel it, the third bites harder.
    r.go(A); r.go(inp(), 11); r.go(A); r.go(inp(), 11)
    assert.ok(r.e.stun > 0, 'still stunned')
    const hp = r.e.hp
    const from = r.ev.length
    r.go(A); r.go(inp(), 30)
    const fin = r.ev.slice(from).filter(v => v.type === 'hit').at(-1)
    assert.equal(fin?.crit, true)
    assert.equal(hp - r.e.hp, Z.COMBO[2].dmg + 1)
    assert.equal(r.e.maxHp - r.e.hp, Z.COMBO[0].dmg + Z.COMBO[1].dmg + Z.COMBO[2].dmg + 1)
  })
})

describe('refills, the day and the fall', () => {
  it('resetEnemy gives a tough one its own hit points again, a plain one those of its kind', () => {
    for (const kind of ['sentry', 'hound']) {
      const r = room(OPEN_ROWS, { z: mark(kind), y: mark(kind, {}) })
      for (const e of r.foes) { e.hp = 1; e.stun = 1; e.ai.shrug = 3; e.stagger = 0.2; e.ai.mode = kind === 'hound' ? 'rest' : 'spent' }
      for (const e of r.foes) resetEnemy(e)
      const tough = r.foes.find(f => f.tough)
      assert.equal(tough.hp, Z.TOUGH.hp[kind])
      assert.equal(r.foes.find(f => !f.tough).hp, Z.STATS[kind].hp)
      assert.equal(tough.ai.shrug, undefined)
      // It does not come back open: not stunned, not in the mode after its strike.
      for (const e of r.foes) assert.equal(e.stun, 0)
      assert.equal(tough.ai.mode, 'idle')
      assert.equal(Z.toughOpen(tough), false)
    }
  })

  for (const [map, x, y, kind] of FIVE) {
    it(`after the prism the ${map} ${kind} stays all day and all night, with no twin`, () => {
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
    })
  }

  it('falls with a heart and five bits, no fanfare, and the others in the room live', () => {
    for (let seed = 0; seed < 6; seed++) {
      const r = duel(seed % 2 ? 'hound' : 'sentry', seed % 2 ? 'rest' : 'spent')
      r.s.rng = seed * 977 + 1
      r.e.hp = 1
      assert.ok(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'sword'))
      assert.ok(r.e.dead)
      assert.deepEqual(r.s.map.drops.map(d => d.kind).sort(), ['bit5', 'heart'])
      assert.ok(!r.ev.some(v => v.type === 'bossDown'))
      assert.equal(r.other.cell, r.e.cell)
      assert.ok(!r.other.dead)
    }
  })

  it('a closed one at its last hit point still turns the blade; a bomb fells it', () => {
    const r = duel()
    r.e.hp = 1
    assert.equal(cut(r), undefined)
    assert.ok(!r.e.dead)
    r.e.invuln = 0
    assert.ok(Z.hitEnemy(r.c(), r.e, 3, r.e.x - 1, r.e.y, 'bomb'))
    assert.ok(r.e.dead)
    assert.deepEqual(r.s.map.drops.map(d => d.kind).sort(), ['bit5', 'heart'])
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
  it('are exactly the tough foes of the world, each a sentry or a hound', () => {
    const found = []
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      def.rows.forEach((row, y) => [...row].forEach((ch, x) => {
        const e = def.marks[ch]?.ent
        if (e?.t === 'enemy' && e.tough) found.push([id, x, y, e.kind])
      }))
    }
    assert.deepEqual(found.sort((a, b) => a[0].localeCompare(b[0])), FIVE)
    for (const f of found) assert.ok(f[3] === 'sentry' || f[3] === 'hound')
  })

  for (const [map, x, y, kind] of FIVE) {
    // Where it stands, among its trees and props: four tiles off on open floor, on every side that has such a spot.
    it(`the ${map} ${kind} strikes a hero who stands four tiles off, and opens`, () => {
      const info = Z.mapInfo(Z.WORLD, map)
      const open = (tx, ty) => { const t = info.base[ty * info.w + tx]; return t !== undefined && !Z.TILE_INFO[t].solid }
      const sides = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => [1, 2, 3, 4].every(k => open(x + dx * k, y + dy * k)))
      assert.ok(sides.length >= 2, `${sides.length} open sides`)
      for (const [dx, dy] of sides) {
        for (const seed of [1, 2, 3]) {
          const s = Z.createGame(Z.WORLD, { seed, at: { map, entry: Object.keys(info.entries)[0] } })
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
          assert.ok(opened, `from ${dx},${dy}, seed ${seed}: never open`)
          assert.ok(s.hero.hp < 30, `from ${dx},${dy}, seed ${seed}: never hurt`)
        }
      }
    })
  }
})

describe('what one opening gives', () => {
  for (const arc of [false, true]) {
    it(`an open tough sentry gives the ${arc ? 'Arc Blade' : 'blade'} TOUGH.take and no more, then shuts and turns the edge again`, () => {
      const r = duel('sentry', 'spent')
      if (arc) r.s.inv.arc = true
      r.s.hero.invuln = 99
      const hp = r.e.hp
      // Blow after blow straight at it, as fast as its mercy allows, while it stands spent.
      for (let k = 0; k < 8 && Z.toughOpen(r.e); k++) { r.e.invuln = 0; r.e.knock = null; r.e.stagger = 0; r.e.ai.t = 5; Z.hitEnemy(r.c(), r.e, arc ? 4 : 2, r.s.hero.x, r.s.hero.y, 'sword', { finisher: true }); r.go() }
      assert.equal(hp - r.e.hp, Z.TOUGH.take)
      assert.equal(Z.toughOpen(r.e), false, 'shut again')
      assert.equal(r.e.ai.mode, 'stalk')
      assert.ok(r.e.ai.t > 0 && r.e.ai.t <= Z.TOUGH.pause, 'with a fresh pause before it may tell')
      r.e.invuln = 0
      assert.equal(Z.hitEnemy(r.c(), r.e, 2, r.s.hero.x, r.s.hero.y, 'sword'), false, 'and the blade clanks')
      assert.equal(hp - r.e.hp, Z.TOUGH.take)
    })
  }

  it('a stunned one shuts the same way, and shrugs the next disc off', () => {
    const r = duel('hound', 'prowl')
    r.s.hero.invuln = 99
    assert.equal(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'), true)
    assert.ok(r.e.stun > 0)
    const hp = r.e.hp
    for (let k = 0; k < 8 && Z.toughOpen(r.e); k++) { r.e.invuln = 0; r.e.knock = null; Z.hitEnemy(r.c(), r.e, 2, r.s.hero.x, r.s.hero.y, 'sword'); r.go() }
    assert.equal(hp - r.e.hp, Z.TOUGH.take)
    assert.equal(r.e.stun, 0)
    assert.ok(r.e.ai.shrug > 0)
    r.e.invuln = 0
    assert.equal(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'), false)
  })

  it('a bomb is not counted: it hurts a closed one and leaves the opening whole', () => {
    const r = duel('sentry', 'stalk')
    const hp = r.e.hp
    assert.equal(Z.hitEnemy(r.c(), r.e, 3, r.s.hero.x, r.s.hero.y, 'bomb'), true)
    assert.equal(hp - r.e.hp, 3)
    assert.ok(!(r.e.ai.took > 0))
  })
})

describe('odds and ends', () => {
  it('a tough foe that carries a key leaves the key beside the heart and the bits', () => {
    const r = duel('sentry', 'stalk', { tough: true, carries: 'smallKey' })
    Z.killEnemy(r.c(), r.e)
    assert.deepEqual(r.s.map.drops.map(d => d.kind).sort(), ['bit5', 'heart', 'key'])
  })

  it('a clank leaves no mercy time, so a disc thrown right after still stuns', () => {
    const r = duel('sentry', 'stalk')
    assert.equal(Z.hitEnemy(r.c(), r.e, 2, r.s.hero.x, r.s.hero.y, 'sword'), false)
    assert.equal(Z.hitEnemy(r.c(), r.e, 1, r.s.hero.x, r.s.hero.y, 'disc'), true)
    assert.ok(Z.toughOpen(r.e))
  })

  it('the hound skids further past its mark than the sentry, so its second lunge can be answered', () => {
    assert.ok(Z.TOUGH.houndPast > Z.TOUGH.past)
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
