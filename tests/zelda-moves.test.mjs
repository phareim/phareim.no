// Neon Shrine's acrobatics and arts (engine/moves.ts, docs/games/neon-shrine.md "Combos and arts"):
// FLIP CUT, BACKFLIP, COMET, TEMPEST, WALL SPRING, SLIP, mastery, the four arts on B, who teaches them,
// and what a save keeps of them.
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

describe('the arts on B', () => {
  function withArt(art, d = 2, kind = 'blob', rows, extra) {
    const a = arena(d, kind, rows, extra)
    Z.grant(a.s, Z.ARTS.find(x => x.id === art).item)
    return a
  }

  it('learning an art puts it in hand, after the items in the swap round', () => {
    const { W, s } = arena(0)
    s.inv.hook = true
    s.inv.selected = 'hook'
    Z.grant(s, 'artPulse')
    assert.equal(s.inv.selected, 'pulse')
    assert.deepEqual(s.inv.arts, ['pulse'])
    assert.deepEqual(Z.useItems(s), ['hook', 'pulse'])
  })

  it('an art in hand shows its own icon on B', () => {
    const { W, s } = arena(0)
    for (const a of Z.ARTS) {
      Z.grant(s, a.item)
      assert.equal(P.itemIconName(s), `item_${a.id}`)
      assert.equal(P.WILD_RAW[`item_${a.id}`]?.length, 16, `no icon for ${a.id}`)
    }
  })

  it('the bomb bag goes in hand over an art: its pickup says B sets one', () => {
    const { s } = arena(0)
    Z.grant(s, 'artPulse')
    Z.grant(s, 'bombBag')
    assert.equal(s.inv.selected, 'bombs')
  })

  it('PULSE throws a foe in front back, stuns it, and rests before the next', () => {
    const { s, ev, go, foe } = withArt('pulse', 1.5)
    go(B())
    assert.ok(ev.some(e => e.type === 'art' && e.art === 'pulse'))
    go(inp(), 20)
    assert.ok(foe.x - foe.home.x > 1, `thrown only ${(foe.x - foe.home.x).toFixed(2)}`)
    assert.ok(foe.stun > 0)
    go(B())
    assert.ok(ev.some(e => e.type === 'error'), 'no buzz while it rests')
    go(inp(), Math.ceil(Z.ARTS.find(a => a.id === 'pulse').cool * 60) + 2)
    assert.ok(ev.some(e => e.type === 'artReady' && e.art === 'pulse'))
  })

  it('PULSE turns a shot round', () => {
    const { s, go } = withArt('pulse', 0)
    const p = { id: 7, kind: 'pellet', x: s.hero.x + 1.5, y: s.hero.y, vx: -3, vy: 0, r: 0.2, t: 0, life: 9 }
    s.map.projectiles.push(p)
    go(B())
    assert.equal(p.friendly, true)
    assert.ok(p.vx > 0)
  })

  it('FLASH STEP crosses through a foe and cuts it a moment later', () => {
    const { s, ev, go, until, foe } = withArt('flash', 2)
    const x0 = s.hero.x
    go(B())
    assert.equal(s.hero.act, 'dash')
    const hp0 = foe.hp
    go(inp(), 3)
    assert.ok(s.hero.x > foe.home.x, 'did not pass the foe')
    assert.equal(foe.hp, hp0, 'cut at once')
    assert.ok(until(() => !s.hero.dash))
    assert.ok(foe.hp < hp0, 'never cut')
    assert.ok(s.hero.x - x0 <= Z.FLASH.dist + 1e-6)
    assert.ok(ev.some(e => e.type === 'art' && e.art === 'flash'))
  })

  it('FLASH STEP stops short of a wall', () => {
    const { s, go, until } = withArt('flash', 0)
    s.hero.x = 15
    go(B())
    if (s.hero.dash) until(() => !s.hero.dash)
    assert.ok(s.hero.x < 17 - Z.HERO_R + 1e-6)
  })

  it('FLASH STEP on terrain steps down a ledge, never up one', () => {
    // Level 2 ground, a trench at level 1 two tiles wide, level 2 again past it: walking stops at the far side.
    const rows = ['##################', '#................#', '#................#', '#.....@..........#', '#................#', '##################']
    const heights = rows.map(r => r.split('').map((ch, x) => (x === 8 || x === 9 ? '1' : '2')).join(''))
    const { s, go } = withArt('flash', 0, 'blob', rows, { terrain: { heights } })
    s.hero.x = 6.5
    go(B({ x: 1, y: 0 }))
    go(inp(), 40)
    assert.ok(s.hero.x > 8.3 && s.hero.x < 10 - Z.HERO_R + 0.05, `ended at ${s.hero.x.toFixed(2)}`)
    assert.equal(s.map.terrain.z, 1)
  })

  it('STARFALL leaps onto the nearest foe and slams it', () => {
    const { s, ev, go, until, foe } = withArt('star', 3.2)
    foe.y += 1
    foe.home.y += 1
    go(B())
    assert.equal(s.hero.air?.kind, 'star')
    go(inp(), 14)
    assert.ok(Z.heroZ(s.hero) > 1.5, 'not high')
    const hp0 = foe.hp
    assert.ok(until(() => !s.hero.air))
    assert.ok(hp0 - foe.hp >= Z.STARFALL.dmg)
    assert.ok(Math.hypot(foe.home.x - s.hero.x, foe.home.y - s.hero.y) < 1, 'came down away from the foe')
    assert.ok(ev.some(e => e.type === 'touchdown' && e.kind === 'star' && e.heavy))
  })

  it('HALO: sparks round the hero cut a foe beside them, not every frame', () => {
    const { s, go, foe } = withArt('halo', 1.15)
    go(B())
    assert.ok(s.hero.halo)
    go(inp(), 60)
    const lost = 99 - foe.hp
    assert.ok(lost >= 1 && lost <= 6, `lost ${lost}`)
    go(inp(), Math.ceil(Z.HALO.time * 60))
    assert.equal(s.hero.halo, null)
  })

  it('a landed blow shortens the arts\' rest', () => {
    const { s, go } = withArt('pulse', 1.2)
    s.hero.artCool = { pulse: 2 }
    go(A()); go(inp(), 3)
    assert.ok(s.hero.artCool.pulse < 2 - Z.ART_FEED + 0.1)
  })
})

describe('who teaches the arts, and the save', () => {
  it('the Keeper teaches PULSE once the blade is in hand', () => {
    const keeper = Object.values(Z.WORLD.maps).flatMap(d => Object.values(d.marks)).map(m => m.ent)
      .find(e => e.t === 'npc' && e.talk.some(b => b.give === 'artPulse'))
    assert.ok(keeper, 'nobody teaches PULSE')
    const br = keeper.talk.find(b => b.give === 'artPulse')
    assert.ok(br, 'the Keeper teaches nothing')
    const s = Z.createGame(Z.WORLD)
    s.flags['item:sword'] = true
    assert.equal(keeper.talk.find(b => Z.condMet(s, Z.WORLD, b.when, -1)), br)
    s.flags['item:artPulse'] = true
    assert.notEqual(keeper.talk.find(b => Z.condMet(s, Z.WORLD, b.when, -1)), br)
  })

  it('a boss down teaches its art once the room is calm', () => {
    const { s, go, until } = arena(0)
    s.flags.miniboss = true
    go(inp(), 30)
    assert.equal(s.mode, 'play', 'taught at once')
    assert.ok(until(() => s.mode === 'get', 200))
    assert.equal(s.get.item, 'artFlash')
    assert.deepEqual(s.inv.arts, ['flash'])
  })

  it('an old save with the boss down has the art, quietly; arts and counts survive a save', () => {
    const { s } = arena(0)
    s.flags.mistral = true
    s.flags.gemini = true
    s.inv.selected = null
    const raw = JSON.parse(JSON.stringify(Z.toSave(s)))
    const back = Z.createGame(Z.WORLD, { save: Z.parseSave(raw) })
    assert.deepEqual([...back.inv.arts].sort(), ['halo', 'star'])
    back.inv.moves = { flip: 3, nonsense: 4 }
    const again = Z.parseSave(JSON.parse(JSON.stringify({ ...Z.toSave(back), inv: { ...Z.toSave(back).inv, arts: ['star', 'bogus', 'star'], selected: 'pulse' } })))
    assert.deepEqual(again.inv.arts, ['star'])
    assert.deepEqual(again.inv.moves, { flip: 3 })
    assert.equal(again.inv.selected, null, 'an art not learned in hand')
  })

  it('a save with an art in hand loads', () => {
    const { s } = arena(0)
    Z.grant(s, 'artHalo')
    const back = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.ok(back)
    assert.equal(back.inv.selected, 'halo')
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

  it('an art cuts a hit of the chain short, as the roll may', () => {
    const { s, ev, go } = arena(1.5)
    Z.grant(s, 'artPulse')
    go(A())
    go(inp(), 5)
    go(B())
    assert.ok(ev.some(e => e.type === 'art' && e.art === 'pulse'))
    assert.equal(s.hero.swing, null)
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

describe('the air and the field battles', () => {
  it('a comet into a field battle\'s foe starts the fight and leaves the air cleanly', () => {
    // A glade of its own: one group of foes, nothing else.
    const rows = ['TTTTTTTTTTTTTTT', ...Array.from({ length: 12 }, (_, y) => (y === 9 ? 'T......@......T' : 'T.............T')), 'TTTTTTTTTTTTTTT']
    const W = {
      start: { map: 'glade', entry: 'start' },
      maps: {
        glade: {
          id: 'glade', name: 'GLADE', kind: 'overworld', track: 'forest', rows,
          marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'up' } } },
          battle: { track: 'boss', groups: [{ id: 'g.goo', x: 7.5, y: 5, foes: [Object.keys(Z.FOES)[0]] }] },
        },
      },
    }
    const s = Z.createGame(W, { seed: 3 })
    s.mode = 'play'
    s.dialog = null
    s.inv.sword = true
    const g = W.maps.glade.battle.groups[0]
    Z.enterMap(W, s, 'glade', 'start', [], { x: g.x, y: g.y + 2.4 })
    // What a SLIP and the halo leave behind is cleared too.
    s.slow = 0.5
    s.hero.edge = true
    s.hero.halo = { t: 3, turn: 0, mercy: {} }
    s.hero.dir = 'up'
    s.hero.aim = -Math.PI / 2
    const foe = s.map.enemies.find(e => e.group === g.id)
    s.hero.x = foe.x
    s.hero.cometT = 0.2
    let k = 0
    Z.stepGame(W, s, 1 / 60, inp({ aPress: true, a: true, move: { x: 0, y: -1 } }))
    assert.equal(s.hero.air?.kind ?? s.mode, s.mode === 'battle' ? 'battle' : 'comet')
    while (s.mode !== 'battle' && k++ < 40) Z.stepGame(W, s, 1 / 60, inp())
    assert.equal(s.mode, 'battle')
    assert.equal(s.hero.air, null)
    assert.equal(s.hero.dash, null)
    assert.equal(s.hero.cometT, 0)
    assert.equal(s.hero.halo, null)
    assert.equal(s.hero.edge, false)
    assert.equal(s.slow, 0)
    for (let j = 0; j < 30; j++) Z.stepGame(W, s, 1 / 60, inp())
  })

  it('a field battle walked into with a COMET\'s window open closes it', () => {
    const rows = ['TTTTTTTTTTTTTTT', ...Array.from({ length: 12 }, (_, y) => (y === 9 ? 'T......@......T' : 'T.............T')), 'TTTTTTTTTTTTTTT']
    const W = {
      start: { map: 'glade', entry: 'start' },
      maps: {
        glade: {
          id: 'glade', name: 'GLADE', kind: 'overworld', track: 'forest', rows,
          marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'up' } } },
          battle: { track: 'boss', groups: [{ id: 'g.goo', x: 7.5, y: 5, foes: [Object.keys(Z.FOES)[0]] }] },
        },
      },
    }
    const s = Z.createGame(W, { seed: 3 })
    s.mode = 'play'
    s.dialog = null
    s.inv.sword = true
    const g = W.maps.glade.battle.groups[0]
    Z.enterMap(W, s, 'glade', 'start', [], { x: g.x, y: g.y + 2.4 })
    s.hero.x = s.map.enemies.find(e => e.group === g.id).x
    s.hero.dir = 'up'
    s.hero.aim = -Math.PI / 2
    let k = 0
    while (s.mode !== 'battle' && k++ < 300) { s.hero.cometT = 0.3; Z.stepGame(W, s, 1 / 60, inp({ move: { x: 0, y: -1 } })) }
    assert.equal(s.mode, 'battle')
    assert.equal(s.hero.cometT, 0)
  })
})
