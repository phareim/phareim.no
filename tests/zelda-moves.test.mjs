// Neon Shrine's acrobatics and its art (engine/moves.ts, docs/games/neon-shrine.md "Combos and the hop"):
// FLIP CUT, BACKFLIP, COMET, TEMPEST, WALL SPRING, SLIP, mastery, the HOP on B and the HOP CUT out of it, who
// teaches it, and what a save keeps of it (and of the four arts it replaced).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { load } from './zelda-load.mjs'

let Z
/** The B box's icon (`render/itemIcon.ts`), bundled on its own. */
let P
before(async () => {
  Z = await load()
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: `export { itemIconName } from './render/itemIcon'; export { WILD_RAW } from './render/spritesWild'`, resolveDir: new URL('../themes/zelda', import.meta.url).pathname, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  P = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const A = () => inp({ aPress: true, a: true })
const R = (move = { x: 0, y: 0 }) => inp({ rollPress: true, move })
const B = (move = { x: 0, y: 0 }) => inp({ bPress: true, move })

/**
 * An empty room, the hero in it with the blade, facing east; a foe `d` tiles east (0: none). `rows` replaces the
 * room ('@' the hero); `extra` adds to its map (a `terrain`).
 */
function arena(d = 1.6, kind = 'blob', rows, extra = {}) {
  const W = {
    start: { map: 'pit', entry: 'start' },
    maps: {
      pit: {
        id: 'pit', name: 'ARENA', kind: 'interior', track: 'indoor',
        rows: rows ?? ['##################', '#................#', '#................#', '#................#', '#.....@..........#', '#................#', '#................#', '#................#', '##################'],
        marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } } },
        ...extra,
      },
    },
  }
  const s = Z.createGame(W)
  s.mode = 'play'
  s.dialog = null
  s.inv.sword = true
  s.hero.dir = 'right'
  s.hero.aim = 0
  const foes = []
  const add = (dx, dy = 0, k = kind) => {
    const st = Z.STATS[k]
    const e = { id: `foe${foes.length}`, kind: k, x: s.hero.x + dx, y: s.hero.y + dy, r: st.r, hp: 99, maxHp: 99, dir: 'left', cell: s.zoneIndex, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 99, tell: 0 }, home: { x: s.hero.x + dx, y: s.hero.y + dy }, dead: false, flash: 0 }
    s.map.enemies.push(e)
    foes.push(e)
    return e
  }
  if (d) add(d)
  const ev = []
  const go = (i = inp(), n = 1) => { for (let k = 0; k < n; k++) ev.push(...Z.stepGame(W, s, 1 / 60, i)) }
  /** Step until `f` holds (at most `n` frames); true if it did. */
  const until = (f, n = 120, i = inp()) => { for (let k = 0; k < n; k++) { if (f()) return true; go(i) } return f() }
  return { W, s, ev, go, until, add, foe: foes[0] }
}

describe('the acrobatics: in the air', () => {
  it('FLIP CUT: A in a roll flips over, no foe harms the hero in the air, and the chop lands on the foe', () => {
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
  })

  it('the chop turns to a foe the flip landed beside, even behind', () => {
    const { s, go, until } = arena(0)
    go(R({ x: 1, y: 0 }))
    go(A())
    // A foe where the flip comes down, a little behind its end.
    const x = s.hero.x + 1.2
    s.map.enemies.push({ id: 'back', kind: 'blob', x, y: s.hero.y + 0.9, r: Z.STATS.blob.r, hp: 99, maxHp: 99, dir: 'left', cell: s.zoneIndex, invuln: 0, stun: 0, knock: null, ai: { mode: 'idle', t: 99, tell: 0 }, home: { x, y: s.hero.y + 0.9 }, dead: false, flash: 0 })
    until(() => !s.hero.air)
    assert.ok(s.map.enemies.find(e => e.id === 'back').hp < 99, 'the chop did not turn to it')
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

  it('a roll in the chain with the stick pushed forward or across is still a roll', () => {
    const { s, go } = arena(0)
    go(A())
    go(inp(), 8)
    go(R({ x: 0, y: 1 }))
    assert.equal(s.hero.act, 'roll')
  })

  it('COMET also comes in the moment after a back flip lands', () => {
    const { s, go, until } = arena(0)
    go(A()); go(inp(), 8); go(R())
    assert.ok(until(() => !s.hero.air))
    assert.ok(s.hero.cometT > 0)
    go(A())
    assert.equal(s.hero.air?.kind, 'comet')
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

  it('a press long after the finisher is no tempest: the chain starts over', () => {
    const { s, go } = arena(0)
    go(A()); go(inp(), 12); go(A()); go(inp(), 12); go(A())
    go(inp(), 40)
    go(A())
    assert.equal(s.hero.act, 'swing')
    assert.equal(s.hero.swing.n, 0)
  })

  it('WALL SPRING: a roll into a wall kicks off it the other way', () => {
    const { s, ev, go, until } = arena(0)
    s.hero.x = 15.2
    go(R({ x: 1, y: 0 }))
    assert.ok(until(() => s.hero.air?.kind === 'spring', 30), 'no spring off the wall')
    assert.ok(s.hero.air.vx < 0, 'did not turn back off it')
    assert.ok(ev.some(e => e.type === 'air' && e.kind === 'spring'))
    assert.ok(until(() => !s.hero.air))
    assert.ok(s.hero.x < 15.2, `sprang back only to ${s.hero.x.toFixed(2)}`)
  })

  it('the air never crosses a pit: it stops at the edge, and nothing falls', () => {
    const rows = ['##################', '#................#', '#................#', '#................#', '#.....@..OOOOO...#', '#................#', '#................#', '#................#', '##################']
    const { s, go, until } = arena(0, 'blob', rows)
    go(R({ x: 1, y: 0 }))
    go(A())
    assert.equal(s.hero.air?.kind, 'flip')
    until(() => !s.hero.air)
    go(inp(), 5)
    assert.notEqual(s.hero.act, 'fall')
    assert.ok(s.hero.x < 9, `went over to ${s.hero.x.toFixed(2)}`)
  })

  it('nor a pit that runs into a wall, flown along that wall', () => {
    const rows = ['##################', '#................#', '#................#', '#OOOOOOOOOOOOOOOO#', '#................#', '#................#', '#.....@..........#', '#................#', '##################']
    // A mastered BACKFLIP up and right, the hero flush with the east wall just south of the pit band.
    for (const [y0, ang] of [[4.28, 0.68], [4.1, 0.5], [4.4, 0.8]]) {
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
  })

  it('WALL SPRING: the map\'s own rim is no wall', () => {
    const rows = ['##################', '#.................', '#.................', '#.....@...........', '#.................', '##################']
    const { s, ev, go } = arena(0, 'blob', rows)
    s.hero.x = 16.2
    go(R({ x: 1, y: 0 }))
    go(inp(), 30)
    assert.ok(!ev.some(e => e.type === 'air'), 'sprang off the rim')
  })

  it('harm that is not a foe\'s (a stone, a blast) lands in the air, and brings the hero down', () => {
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
  })
})

describe('SLIP and mastery', () => {
  it('a foe met in the roll\'s first moments slows the world once, and the next blow is critical', () => {
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
  })

  it('the world runs slow while the hero keeps full pace', () => {
    const { s, go } = arena(0)
    s.slow = 0.5
    const p = { id: 1, kind: 'pellet', x: 3, y: 3, vx: 6, vy: 0, r: 0.2, t: 0, life: 9 }
    s.map.projectiles.push(p)
    go(inp(), 6)
    assert.ok(Math.abs(p.x - 3 - 6 * 0.1 * Z.SLIP_SCALE) < 0.02, `the shot went ${(p.x - 3).toFixed(3)}`)
  })

  it('spikes in a roll are no slip, nor any harm not marked a foe\'s', () => {
    const { W, s, ev } = arena(0)
    const c = Z.ctx(W, s, ev)
    s.hero.roll = { t: 0.05, vx: 7, vy: 0 }
    s.hero.act = 'roll'
    Z.hurtHero(c, 1, s.hero.x, s.hero.y)
    assert.ok(!ev.some(e => e.type === 'slip'))
    const rows = ['##################', '#................#', '#................#', '#................#', '#.....@xxxxx.....#', '#................#', '#................#', '#................#', '##################']
    const r = arena(0, 'blob', rows)
    r.go(R({ x: 1, y: 0 }))
    r.go(inp({ move: { x: 1, y: 0 } }), 40)
    assert.ok(!r.ev.some(e => e.type === 'slip'), 'the spikes slipped')
    assert.equal(r.s.slow ?? 0, 0)
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
  function withHop(d = 1.6, kind = 'blob', rows, extra) {
    const a = arena(d, kind, rows, extra)
    Z.grant(a.s, 'artHop')
    return a
  }
  const landed = a => a.until(() => !a.s.hero.air, 60)

  it('learning the hop puts it in hand, after the items in the swap round', () => {
    const { s } = arena(0)
    s.inv.hook = true
    s.inv.selected = 'hook'
    Z.grant(s, 'artHop')
    assert.equal(s.inv.selected, 'hop')
    assert.deepEqual(s.inv.arts, ['hop'])
    assert.deepEqual(Z.useItems(s), ['hook', 'hop'])
    assert.deepEqual(Z.ARTS.map(a => a.id), ['hop'], 'the one art')
  })

  it('the hop in hand shows its own icon on B', () => {
    const { s } = arena(0)
    Z.grant(s, 'artHop')
    assert.equal(P.itemIconName(s), 'item_hop')
    assert.equal(P.WILD_RAW.item_hop?.length, 16)
    for (const old of ['pulse', 'flash', 'star', 'halo']) assert.equal(P.WILD_RAW[`item_${old}`], undefined, `item_${old} left behind`)
  })

  it('the bomb bag goes in hand over the hop', () => {
    const { s } = arena(0)
    Z.grant(s, 'artHop')
    Z.grant(s, 'bombBag')
    assert.equal(s.inv.selected, 'bombs')
  })

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
  })

  it('with the stick pushed it hops that way, still facing the foe; with no foe, straight back', () => {
    const a = withHop(1.6)
    const y0 = a.s.hero.y
    a.go(B({ x: 0, y: 1 }))
    assert.ok(landed(a))
    assert.ok(a.s.hero.y - y0 > 1.4, `sideways ${(a.s.hero.y - y0).toFixed(2)}`)
    assert.equal(a.s.hero.dir, 'right')
    const b = withHop(0)
    b.s.hero.dir = 'up'; b.s.hero.aim = -Math.PI / 2
    const by = b.s.hero.y
    b.go(B())
    assert.ok(landed(b))
    assert.ok(b.s.hero.y - by > 1.4, 'not back')
    assert.equal(b.s.hero.dir, 'up')
  })

  it('a stone or a blast still lands in the hop; the air never crosses a pit', () => {
    const a = withHop(0)
    const { s, go } = a
    go(B())
    go(inp(), 3)
    assert.equal(Z.hurtHero(Z.ctx(a.W, s, []), 1, s.hero.x + 1, s.hero.y), true)
    assert.equal(s.hero.air, null)
    const rows = ['##########', '#........#', '#..OO.@..#', '#........#', '##########']
    const b = withHop(0, 'blob', rows)
    b.go(B())
    assert.ok(landed(b))
    assert.ok(b.s.hero.x > 5 - 1e-6 + Z.HERO_R - 0.1, `over the pit: ${b.s.hero.x.toFixed(2)}`)
    assert.equal(b.s.hero.act === 'fall', false)
  })

  it('the chain goes on through the hop: A out of it is the HOP CUT, the next hit sprung back in at the foe', () => {
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
  })

  it('A just after the hop lands is still the HOP CUT; a while after it is a plain hit', () => {
    const a = withHop(1.6)
    a.go(B())
    assert.ok(landed(a))
    a.go(A())
    assert.ok(a.until(() => !!a.s.hero.swing, 10))
    assert.ok(a.s.hero.swing.spring !== undefined, 'no spring')
    const b = withHop(1.6)
    b.go(B())
    assert.ok(landed(b))
    b.go(inp(), Math.ceil(Z.HOP.window * 60) + 2)
    b.go(A())
    assert.ok(b.until(() => !!b.s.hero.swing, 10))
    assert.equal(b.s.hero.swing.spring, undefined)
  })

  it('out of the finisher the hop starts the chain over (no tempest out of it)', () => {
    const a = withHop(1.2)
    const { s, go, until } = a
    go(A()); go(inp(), 11); go(A()); go(inp(), 11); go(A())
    assert.equal(s.hero.swing?.n, 2)
    go(inp(), 5)
    go(B())
    assert.equal(s.hero.air?.kind, 'hop')
    go(A())
    assert.ok(landed(a))
    assert.ok(until(() => !!s.hero.swing, 20))
    assert.equal(s.hero.swing.n, 0)
    assert.notEqual(s.hero.air?.kind, 'tempest')
  })

  it('a foe\'s blow that passed under the hop makes the HOP CUT critical', () => {
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
  })

  it('the HOP CUT\'s spring stops short of a pit', () => {
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
  })

  it('a charge held into the hop is kept: let go once down, and the spin comes', () => {
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
  })

  it('a landed blow shortens the hop\'s rest', () => {
    const { s, go } = withHop(1.2)
    s.hero.artCool = { hop: 0.6 }
    go(A()); go(inp(), 3)
    assert.ok(s.hero.artCool.hop < 0.6 - Z.ART_FEED + 0.1)
  })
})

describe('who teaches the hop, and the save', () => {
  it('the Keeper teaches the HOP once the blade is in hand', () => {
    const keeper = Object.values(Z.WORLD.maps).flatMap(d => Object.values(d.marks)).map(m => m.ent)
      .find(e => e?.t === 'npc' && e.talk.some(b => b.give === 'artHop'))
    assert.ok(keeper, 'nobody teaches the hop')
    const br = keeper.talk.find(b => b.give === 'artHop')
    const s = Z.createGame(Z.WORLD)
    s.flags['item:sword'] = true
    assert.equal(keeper.talk.find(b => Z.condMet(s, Z.WORLD, b.when, -1)), br)
    s.flags['item:artHop'] = true
    assert.notEqual(keeper.talk.find(b => Z.condMet(s, Z.WORLD, b.when, -1)), br)
  })

  it('a boss down teaches nothing now', () => {
    const { s, go } = arena(0)
    s.flags.miniboss = true
    s.flags.mistral = true
    go(inp(), 300)
    assert.equal(s.mode, 'play')
    assert.equal(s.inv.arts, undefined)
  })

  it('a save from the days of the four arts knows the hop, in hand where an art was; counts survive', () => {
    const { s } = arena(0)
    s.flags['item:artPulse'] = true
    s.inv.moves = { flip: 3 }
    const raw = JSON.parse(JSON.stringify(Z.toSave(s)))
    for (const sel of ['pulse', 'flash', 'star', 'halo']) {
      const old = Z.parseSave({ ...raw, inv: { ...raw.inv, arts: ['pulse', sel, 'bogus'], selected: sel, moves: { flip: 3, nonsense: 4 } } })
      assert.ok(old, `a save with ${sel} in hand loads`)
      assert.deepEqual(old.inv.arts, ['hop'])
      assert.equal(old.inv.selected, 'hop')
      assert.deepEqual(old.inv.moves, { flip: 3 })
      assert.ok(old.flags.includes('item:artHop'), 'the Keeper would teach it again')
      const g = Z.createGame(Z.WORLD, { save: old })
      assert.deepEqual(Z.useItems(g), ['hop'])
    }
    // An old art in hand that the save never knew: nothing in hand.
    const odd = Z.parseSave({ ...raw, inv: { ...raw.inv, selected: 'halo' } })
    assert.equal(odd.inv.selected, null)
    assert.equal(odd.inv.arts, undefined)
    // Something that never was an art still makes a save unreadable.
    assert.equal(Z.parseSave({ ...raw, inv: { ...raw.inv, selected: 'nova' } }), null)
  })

  it('a save with the hop in hand loads as it was', () => {
    const { s } = arena(0)
    Z.grant(s, 'artHop')
    const back = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.ok(back)
    assert.equal(back.inv.selected, 'hop')
    assert.deepEqual(back.inv.arts, ['hop'])
    assert.equal(back.flags.filter(f => f === 'item:artHop').length, 1)
  })
})

describe('the flow between moves', () => {
  it('A pressed in the air strikes as soon as the hero lands', () => {
    const { s, ev, go, until } = arena(0)
    go(R({ x: 1, y: 0 }))
    go(A())
    assert.equal(s.hero.air?.kind, 'flip')
    go(inp(), 3)
    go(A())
    assert.ok(until(() => !s.hero.air))
    assert.ok(until(() => s.hero.act === 'swing', 30), 'the press in the air was lost')
    assert.ok(ev.some(e => e.type === 'swing' && e.n === 0))
  })

  it('the hop cuts a hit of the chain short from a third in, as the roll may, and comes out of a roll\'s second half', () => {
    const { s, go } = arena(1.5)
    Z.grant(s, 'artHop')
    go(A())
    go(B())
    assert.ok(!s.hero.air, 'cut the hit short at once')
    go(inp(), 4)
    go(B())
    assert.equal(s.hero.air?.kind, 'hop')
    assert.equal(s.hero.swing, null)
    const b = arena(0)
    Z.grant(b.s, 'artHop')
    b.go(R({ x: 1, y: 0 }))
    b.go(inp(), 9)
    b.go(B())
    assert.equal(b.s.hero.air?.kind, 'hop')
    assert.equal(b.s.hero.roll, null)
  })

  it('a shove (a shield, a gust) brings the hero down out of the air', () => {
    const { W, s, go } = arena(0)
    go(R({ x: 1, y: 0 }))
    go(A())
    s.hero.knock = { vx: -5, vy: 0, t: 0.1 }
    go()
    assert.equal(s.hero.air, null)
    assert.notEqual(s.hero.act, 'air')
    void W
  })
})
