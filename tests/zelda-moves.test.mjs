// Neon Shrine's acrobatics (engine/moves.ts, docs/games/neon-shrine.md "Combos and the hop"):
// FLIP CUT, BACKFLIP, COMET, TEMPEST, WALL SPRING, SLIP, mastery, the HOP on B and the HOP CUT out of it, and who
// teaches it, played with scripted presses in a bare arena. What an old save keeps of the four arts the hop replaced
// is in `zelda-old-saves.test.mjs`.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { arena as room } from './zelda-arena.mjs'

let Z
before(async () => { Z = await load() })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const A = () => inp({ aPress: true, a: true })
const R = (move = { x: 0, y: 0 }) => inp({ rollPress: true, move })
const B = (move = { x: 0, y: 0 }) => inp({ bPress: true, move })

/** The arena: a foe `d` tiles east of the hero (0: none). */
const arena = (d = 1.6, kind = 'blob', rows, extra) => room(Z, d, kind, rows, extra)
function withHop(d = 1.6, kind = 'blob', rows, extra) {
  const a = arena(d, kind, rows, extra)
  Z.grant(a.s, 'artHop')
  return a
}
const landed = a => a.until(() => !a.s.hero.air, 60)

describe('the acrobatics: in the air', () => {
  it('FLIP CUT: A in a roll flips over unharmed by foes and chops one; a stone still lands, and a press in the air strikes on landing', () => {
    const { W, s, ev, go, until, foe } = arena(3)
    go(R({ x: 1, y: 0 }))
    go(inp(), 4)
    go(A())
    assert.equal(s.hero.act, 'air')
    assert.equal(s.hero.air.kind, 'flip')
    go(inp(), 6)
    assert.ok(Z.heroZ(s.hero) > 0.3, `only ${Z.heroZ(s.hero).toFixed(2)} up`)
    assert.equal(Z.hurtHero(Z.ctx(W, s, []), 1, s.hero.x + 0.3, s.hero.y, false, true), false, 'a foe hurt him in the air')
    const hp0 = foe.hp
    assert.ok(until(() => !s.hero.air))
    assert.ok(ev.some(e => e.type === 'touchdown' && e.kind === 'flip' && e.heavy))
    assert.equal(hp0 - foe.hp, Z.FLIP_CHOP.dmg, 'the chop missed')
    assert.ok(ev.some(e => e.type === 'move' && e.id === 'flip' && e.first), 'no FLIP CUT credited')
    assert.equal(s.inv.moves.flip, 1)
    // A stone or a blast is no foe's blow: it lands, and brings the hero down.
    {
      const { W, s, ev, go } = arena(0)
      go(R({ x: 1, y: 0 }))
      go(inp(), 4)
      go(A())
      assert.equal(s.hero.air?.kind, 'flip')
      const c = Z.ctx(W, s, ev)
      assert.equal(Z.hurtHero(c, 1, s.hero.x - 1, s.hero.y, false, true), false, 'a foe\'s blow landed in the air')
      assert.equal(Z.hurtHero(c, 2, s.hero.x - 1, s.hero.y), true, 'the stone passed through')
      assert.equal(s.hero.air, null)
      assert.equal(s.hero.act, 'hurt')
    }
    // A pressed in the air strikes as soon as the hero lands.
    {
      const { s, ev, go, until } = arena(0)
      go(R({ x: 1, y: 0 }))
      go(A())
      assert.equal(s.hero.air?.kind, 'flip')
      go(inp(), 3)
      go(A())
      assert.ok(until(() => !s.hero.air))
      assert.ok(until(() => s.hero.act === 'swing', 30), 'the press in the air was lost')
      assert.ok(ev.some(e => e.type === 'swing' && e.n === 0))
    }
  })

  it('BACKFLIP: R in the chain with the stick at rest flips back, still facing the blow; A then is the COMET', () => {
    const { s, ev, go, until, foe } = arena(1.3)
    go(A())
    go(inp(), 8)
    const x0 = s.hero.x
    go(R())
    assert.equal(s.hero.air?.kind, 'back')
    assert.equal(s.hero.dir, 'right', 'turned away from the blow')
    go(inp(), 8)
    assert.ok(s.hero.x < x0 - 0.5, `flew back only ${(x0 - s.hero.x).toFixed(2)}`)
    const hp0 = foe.hp
    go(A())
    assert.equal(s.hero.air?.kind, 'comet')
    assert.ok(until(() => !s.hero.air))
    assert.ok(foe.hp < hp0, 'the comet missed')
    assert.ok(s.hero.x > foe.home.x - 0.5, 'the comet did not carry through')
    const ids = ev.filter(e => e.type === 'move').map(e => e.id)
    assert.ok(ids.includes('backflip') && ids.includes('comet'), ids.join(' '))
  })

  it('TEMPEST: A late in the finisher takes off into a double whirl that strikes round more than once', () => {
    const { s, ev, go, until, foe } = arena(1.2)
    go(A()); go(inp(), 11); go(A()); go(inp(), 11); go(A())
    assert.equal(s.hero.swing.n, 2)
    assert.ok(until(() => s.hero.swing && s.hero.swing.t / Z.swingDur(s.hero.swing) >= Z.TEMPEST_FROM, 40))
    go(A())
    assert.equal(s.hero.air?.kind, 'tempest')
    const hits0 = ev.filter(e => e.type === 'hit').length
    // The foe comes back into reach (the finisher threw it): set it beside the hero.
    foe.x = s.hero.x + 0.9; foe.y = s.hero.y; foe.knock = null; foe.invuln = 0
    assert.ok(until(() => !s.hero.air))
    assert.ok(ev.filter(e => e.type === 'hit').length - hits0 >= 2, 'one blow or none in the tempest')
    assert.ok(ev.some(e => e.type === 'move' && e.id === 'tempest'))
  })

  it('WALL SPRING: a roll into a wall kicks off it the other way; the map\'s own rim is no wall', () => {
    const { s, ev, go, until } = arena(0)
    s.hero.x = 15.2
    go(R({ x: 1, y: 0 }))
    assert.ok(until(() => s.hero.air?.kind === 'spring', 30), 'no spring off the wall')
    assert.ok(s.hero.air.vx < 0, 'did not turn back off it')
    assert.ok(ev.some(e => e.type === 'air' && e.kind === 'spring'))
    assert.ok(until(() => !s.hero.air))
    assert.ok(s.hero.x < 15.2, `sprang back only to ${s.hero.x.toFixed(2)}`)
    // The open rim of a map is no wall.
    {
      const rows = ['##################', '#.................', '#.................', '#.....@...........', '#.................', '##################']
      const { s, ev, go } = arena(0, 'blob', rows)
      s.hero.x = 16.2
      go(R({ x: 1, y: 0 }))
      go(inp(), 30)
      assert.ok(!ev.some(e => e.type === 'air'), 'sprang off the rim')
    }
  })

  it('the air never crosses a pit: a flip, a hop, a flight along a wall and the HOP CUT\'s spring all stop at its edge', () => {
    const rows = ['##################', '#................#', '#................#', '#................#', '#.....@..OOOOO...#', '#................#', '#................#', '#................#', '##################']
    const { s, go, until } = arena(0, 'blob', rows)
    go(R({ x: 1, y: 0 }))
    go(A())
    assert.equal(s.hero.air?.kind, 'flip')
    until(() => !s.hero.air)
    go(inp(), 5)
    assert.notEqual(s.hero.act, 'fall')
    assert.ok(s.hero.x < 9, `went over to ${s.hero.x.toFixed(2)}`)
    // A hop beside a pit.
    {
      const rows = ['##########', '#........#', '#..OO.@..#', '#........#', '##########']
      const b = withHop(0, 'blob', rows)
      b.go(B())
      assert.ok(landed(b))
      assert.ok(b.s.hero.x > 5 - 1e-6 + Z.HERO_R - 0.1, `over the pit: ${b.s.hero.x.toFixed(2)}`)
      assert.equal(b.s.hero.act === 'fall', false)
    }
    // A mastered BACKFLIP into the corner of a pit band and a wall.
    {
      const rows = ['##################', '#................#', '#................#', '#OOOOOOOOOOOOOOOO#', '#................#', '#................#', '#.....@..........#', '#................#', '##################']
      // A mastered BACKFLIP up and right, the hero flush with the east wall just south of the pit band.
      for (const [y0, ang] of [[4.28, 0.68]]) {
        const { s, ev, go, until, add } = arena(0, 'blob', rows)
        s.inv.moves = { backflip: 99 }
        s.hero.x = 17 - Z.HERO_R - 0.001
        s.hero.y = y0
        s.hero.aim = Math.PI - ang
        s.hero.dir = 'left'
        add(Math.cos(Math.PI - ang) * 0.9, Math.sin(Math.PI - ang) * 0.9)
        go(A())
        go(inp(), 4)
        go(R())
        assert.equal(s.hero.air?.kind, 'back')
        until(() => !s.hero.air)
        go(inp(), 3)
        assert.ok(!ev.some(e => e.type === 'fall'), 'fell')
        assert.ok(s.hero.y > 4, `crossed to ${s.hero.y.toFixed(2)}`)
      }
    }
    // A foe across a pit: the HOP CUT's spring would carry the hero into it.
    {
      // A foe across a pit: the spring would carry the hero into it, and stops at its edge.
      const rows = ['################', '#..............#', '#..@.....OO....#', '#..............#', '################']
      const a = withHop(0, 'blob', rows)
      a.go(B())
      assert.ok(landed(a))
      a.s.hero.x = 7.5
      a.add(4.1)
      a.go(A())
      assert.ok(a.until(() => a.s.hero.swing?.spring !== undefined, 10))
      assert.ok(a.s.hero.swing.spring > 2, `a short spring: ${a.s.hero.swing.spring}`)
      assert.ok(a.until(() => !a.s.hero.swing, 40))
      assert.ok(a.s.hero.x > 8.2 && a.s.hero.x < 9 - Z.HERO_R + 0.05, `ended at ${a.s.hero.x.toFixed(2)}`)
      a.go(inp(), 30)
      assert.notEqual(a.s.hero.act, 'fall')
    }
  })
})

describe('SLIP and mastery', () => {
  it('a foe met in the roll\'s first moments slows the world, not the hero, once; the next blow is critical', () => {
    const { s, ev, go, foe } = arena(0.9)
    foe.ai.t = 0
    go(R({ x: 1, y: 0 }))
    go(inp(), 3)
    assert.ok(ev.some(e => e.type === 'slip'), 'no slip')
    assert.ok(s.slow > 0)
    assert.equal(s.hero.edge, true)
    assert.equal(ev.filter(e => e.type === 'slip').length, 1)
    go(inp(), 20)
    foe.x = s.hero.x + 1; foe.y = s.hero.y; foe.knock = null; foe.invuln = 0; foe.stun = 0
    s.hero.dir = 'right'; s.hero.aim = 0
    const hp0 = foe.hp
    go(A()); go(inp(), 12)
    const hit = ev.filter(e => e.type === 'hit').at(-1)
    assert.equal(hit?.crit, true)
    assert.equal(hp0 - foe.hp, Z.COMBO[0].dmg + 1)
    assert.equal(s.hero.edge, false)
    // The world runs slow while the hero keeps full pace.
    {
      const { s, go } = arena(0)
      s.slow = 0.5
      const p = { id: 1, kind: 'pellet', x: 3, y: 3, vx: 6, vy: 0, r: 0.2, t: 0, life: 9 }
      s.map.projectiles.push(p)
      go(inp(), 6)
      assert.ok(Math.abs(p.x - 3 - 6 * 0.1 * Z.SLIP_SCALE) < 0.02, `the shot went ${(p.x - 3).toFixed(3)}`)
    }
  })

  it('a combo counted its need times is mastered, and a mastered finisher bites one harder', () => {
    const { s, ev, go, foe } = arena(1.2)
    s.inv.moves = { triple: Z.MOVES.find(m => m.id === 'triple').need - 1 }
    go(A()); go(inp(), 11); go(A()); go(inp(), 11)
    const hp0 = foe.hp
    go(A()); go(inp(), 30)
    const m = ev.find(e => e.type === 'move' && e.id === 'triple')
    assert.equal(m?.mastered, true)
    assert.equal(Z.mastered(s, 'triple'), true)
    assert.equal(hp0 - foe.hp, Z.COMBO[2].dmg, 'the finisher that masters it is still the plain one')
    // The next one is the master's.
    foe.x = s.hero.x + 1.2; foe.y = s.hero.y; foe.knock = null; foe.invuln = 0; foe.stagger = 0
    go(inp(), 40)
    go(A()); go(inp(), 11); go(A()); go(inp(), 11)
    const hp1 = foe.hp
    go(A()); go(inp(), 30)
    assert.equal(hp1 - foe.hp, Z.COMBO[2].dmg + 1)
  })
})

describe('HOP, on B', () => {
  it('hops away from the foe, still facing it, and no blow of its lands in the air; then it rests a moment', () => {
    const a = withHop(1.6)
    const { s, ev, go, foe } = a
    const x0 = s.hero.x
    s.hero.dir = 'left'; s.hero.aim = Math.PI
    go(B())
    assert.equal(s.hero.air?.kind, 'hop')
    assert.equal(s.hero.dir, 'right', 'turned to face the foe')
    go(inp(), 4)
    assert.ok(Z.heroZ(s.hero) > 0.2, 'not off the ground')
    const hp = s.hero.hp
    assert.equal(Z.hurtHero(Z.ctx(a.W, s, []), 1, foe.x, foe.y, false, true), false, 'a foe\'s blow landed in the hop')
    assert.equal(s.hero.hp, hp)
    assert.ok(landed(a))
    assert.ok(x0 - s.hero.x > 1.5 && x0 - s.hero.x < 2.4, `hopped ${(x0 - s.hero.x).toFixed(2)}`)
    assert.equal(s.hero.dir, 'right')
    assert.ok(ev.some(e => e.type === 'touchdown' && e.kind === 'hop'))
    // Resting: a press is the buzz; rested, it hops again.
    go(B())
    assert.ok(!s.hero.air && ev.at(-1)?.type === 'error', 'hopped again at once')
    go(inp(), Math.ceil(Z.ARTS[0].cool * 60))
    go(B())
    assert.equal(s.hero.air?.kind, 'hop')
    // A charge held into the hop is kept: let go once down, and the spin comes.
    {
      const a = withHop(0)
      const { s, ev, go, until } = a
      go(A())
      assert.ok(until(() => !s.hero.swing, 20, inp({ a: true })))
      go(inp({ a: true }), 40)
      assert.ok(s.hero.charge >= Z.CHARGE_TIME)
      go(inp({ a: true, bPress: true }))
      assert.equal(s.hero.air?.kind, 'hop')
      assert.ok(until(() => !s.hero.air, 60, inp({ a: true })))
      go(inp())
      assert.ok(until(() => !!s.hero.spin, 5), 'no spin')
      assert.ok(ev.some(e => e.type === 'spin'))
    }
  })

  it('the chain goes on through the hop: A out of it is the HOP CUT, sprung back in at the foe, critical after a blow passed under', () => {
    const a = withHop(1.2)
    const { s, ev, go, until, foe } = a
    go(A())
    go(inp(), 5)
    go(B())
    assert.equal(s.hero.air?.kind, 'hop', 'the hop cut the hit short')
    assert.equal(s.hero.swing, null)
    const far = foe.x - s.hero.x
    go(inp(), 2)
    go(A())
    assert.ok(landed(a))
    assert.ok(until(() => !!s.hero.swing, 20), 'no cut out of the hop')
    assert.equal(s.hero.swing.n, 1, 'the chain started over')
    assert.ok(s.hero.swing.spring > 1, `sprang only ${s.hero.swing.spring}`)
    const fromFoe = foe.x - s.hero.x
    assert.ok(fromFoe > far, 'did not hop away')
    const hp0 = foe.hp
    assert.ok(until(() => foe.hp < hp0, 30), 'the cut never landed')
    assert.ok(foe.x - s.hero.x < fromFoe - 0.8, 'did not spring back in')
    assert.ok(ev.some(e => e.type === 'move' && e.id === 'hopcut'))
    assert.ok(ev.some(e => e.type === 'swing' && e.spring))
    // And the chain's finisher follows.
    assert.ok(until(() => !s.hero.swing, 30))
    go(A())
    assert.ok(until(() => s.hero.swing?.n === 2, 10), 'the finisher')
    // A foe's blow that passed under the hop makes the HOP CUT critical.
    {
      const a = withHop(1.6)
      const { s, ev, go, until, foe } = a
      go(B())
      go(inp(), 3)
      Z.hurtHero(Z.ctx(a.W, s, []), 1, foe.x, foe.y, false, true)
      go(A())
      assert.ok(landed(a))
      const hp0 = foe.hp
      assert.ok(until(() => foe.hp < hp0, 40))
      const hit = ev.filter(e => e.type === 'hit').at(-1)
      assert.equal(hit?.crit, true)
      assert.equal(hp0 - foe.hp, Z.COMBO[0].dmg + 1)
    }
  })
})

describe('who teaches the hop', () => {
  it('the Keeper teaches the HOP once the blade is in hand, and it goes in hand after the items in the swap round', () => {
    const keeper = Object.values(Z.WORLD.maps).flatMap(d => Object.values(d.marks)).map(m => m.ent)
      .find(e => e?.t === 'npc' && e.talk.some(b => b.give === 'artHop'))
    assert.ok(keeper, 'nobody teaches the hop')
    const br = keeper.talk.find(b => b.give === 'artHop')
    const s = Z.createGame(Z.WORLD)
    s.flags['item:sword'] = true
    assert.equal(keeper.talk.find(b => Z.condMet(s, Z.WORLD, b.when, -1)), br)
    s.flags['item:artHop'] = true
    assert.notEqual(keeper.talk.find(b => Z.condMet(s, Z.WORLD, b.when, -1)), br)
    // Learned, it is in hand, after the items in the swap round.
    {
      const { s } = arena(0)
      s.inv.hook = true
      s.inv.selected = 'hook'
      Z.grant(s, 'artHop')
      assert.equal(s.inv.selected, 'hop')
      assert.deepEqual(s.inv.arts, ['hop'])
      assert.deepEqual(Z.useItems(s), ['hook', 'hop'])
      assert.deepEqual(Z.ARTS.map(a => a.id), ['hop'], 'the one art')
    }
  })
})
