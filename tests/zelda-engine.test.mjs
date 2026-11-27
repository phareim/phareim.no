// Neon Shrine engine tests, played through `stepGame`: the first minute (down the coast road from the town, the
// Keeper's story, the hut, the blade), a save and where it continues, exits, talks, the chain and the roll in a bare
// arena, calm sentries, and a full scripted run from the Keeper's hut to the Sun Prism with a path-finding walker
// (god mode on, bosses killed directly; their fights are `zelda-gauntlet.test.mjs`). The real world's validator is in
// `zelda-world.test.mjs`, old saves in `zelda-old-saves.test.mjs`; the town's own checks in portal-world.test.mjs.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { prismRun } from './zelda-prism-run.mjs'
import { walker } from './zelda-walk.mjs'
import { arena as room } from './zelda-arena.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const A = inp({ aPress: true, a: true })
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

describe('the first minute', () => {
  it('starts in the town; the coast road leads to the Keeper, who tells the story once; the hut, the blade, a bush and a spin', () => {
    const { walkTo, face, pressA, settle } = P
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
    // The hut has one door, and leaving it walks you out again without bouncing back in.
    P.walkTo(s, OX + 7, 28)
    for (let k = 0; k < 80 && s.mode !== 'play'; k++) step(s)
    assert.deepEqual([s.map.id, s.area, s.map.exits], ['hut', "KEEPER'S HUT", []])
    P.walkTo(s, 6, 8)
    for (let k = 0; k < 80 && s.mode !== 'play'; k++) step(s)
    for (let k = 0; k < 40; k++) step(s)
    assert.deepEqual([s.map.id, s.hero.x, s.hero.y, s.mode], ['overworld', OX + 7.5, 29.5, 'play'])
    // With the blade: a bush cut, a spin charged and let go.
    {
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
    }
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
    s = Z.createGame(Z.WORLD, { save, at: { map: 'arcade', entry: 'voyagers2' } })
    assert.equal(s.map.id, 'arcade')
    assert.equal(s.hero.dir, 'up')
    // An unknown spot falls back to the start.
    s = Z.createGame(Z.WORLD, { save, at: { map: 'arcade', entry: 'nope' } })
    assert.equal(s.area, 'HOME GLADE')
  })
})

describe('a sign with a second text', () => {
  /** Stand under the sign at (x, y) and read it; returns the lines and closes the box. */
  function read(s, x, y) {
    Object.assign(s.hero, { x: x + 0.5, y: y + 1.5, dir: 'up' })
    s.map.enemies = []
    for (let k = 0; k < 30; k++) step(s)
    step(s, inp({ aPress: true, a: true }))
    const said = s.dialog?.lines
    P.settle(s)
    for (let k = 0; k < 30; k++) step(s)
    return said
  }
  function at(map, entry) {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: { map, entry } })
    s.flags.intro = true
    return s
  }

  it('the phone booth in Rerun hisses until the Gate is shut, then sounds relieved', () => {
    const s = at('rerun', 'booth')
    assert.deepEqual(read(s, 58, 24), ['(YOU PICK UP. THE DIAL TONE HAS A HISS UNDER IT, LIKE SOMETHING WAITING ITS TURN.)'])
    s.flags.gateShut = true
    assert.deepEqual(read(s, 58, 24), ['(YOU PICK UP. JUST THE DIAL TONE. IT SOUNDS RELIEVED.)'])
  })
})

// A small world with every kind of exit.
function fixture() {
  return {
    start: { map: 'room', entry: 'start' },
    maps: {
      room: {
        id: 'room', name: 'FIXTURE', kind: 'interior', track: 'indoor',
        rows: ['#####E######', '#c.........#', '#..........#', '#k....@....#', '#..........#', '############'],
        marks: {
          '@': { ent: { t: 'entry', id: 'start', dir: 'up' } },
          c: { tile: 'M', ent: { t: 'exit', id: 'galaga', to: { theme: 'galaga' }, look: 'cabinet', art: 'galaga', label: 'GALAGA', lines: ['GALAGA. SHOOT THE SWARM.', 'INSERT COIN? PRESS A.'] } },
          k: { tile: 'n', ent: { t: 'exit', id: 'md', to: { url: 'https://phareim.md' }, side: 'right' } },
          E: { tile: 'D', ent: { t: 'exit', id: 'hangar', to: { theme: 'hangar' } } },
        },
      },
    },
  }
}

describe('exits', () => {
  it('leave by a cabinet once its lines are read, a sign at once, a door walked onto', () => {
    const W = fixture()
    assert.deepEqual(Z.validateWorld(W), [])
    /** Steps until the game has left, then says through which exits. */
    const out = (s, ev, input = inp()) => {
      for (let k = 0; k < 240 && s.mode !== 'exit'; k++) ev.push(...Z.stepGame(W, s, 1 / 60, input))
      assert.equal(s.mode, 'exit')
      return ev.filter(e => e.type === 'exit')
    }
    // A cabinet: A shows its lines, closing them leaves through it, held at full dark.
    const c = Z.createGame(W)
    Z.enterMap(W, c, 'room', 'galaga', [])
    const ev = [...Z.stepGame(W, c, 1 / 60, A)]
    assert.deepEqual([c.mode, c.dialog.lines], ['dialog', ['GALAGA. SHOOT THE SWARM.', 'INSERT COIN? PRESS A.']])
    for (let k = 0; k < 20 && c.mode === 'dialog'; k++) {
      ev.push(...Z.stepGame(W, c, 0.3, inp()))
      ev.push(...Z.stepGame(W, c, 1 / 60, A))
    }
    assert.equal(c.mode, 'warp')
    assert.deepEqual(out(c, ev), [{ type: 'exit', id: 'galaga', to: { theme: 'galaga' } }])
    assert.equal(c.warp.t, Z.WARP_TIME)
    // A solid exit without lines leaves at once.
    const k = Z.createGame(W)
    Z.enterMap(W, k, 'room', 'md', [])
    Z.stepGame(W, k, 1 / 60, A)
    assert.equal(k.mode, 'warp')
    assert.deepEqual(out(k, []), [{ type: 'exit', id: 'md', to: { url: 'https://phareim.md' } }])
    // A door: walking onto it leaves.
    const d = Z.createGame(W)
    Z.enterMap(W, d, 'room', 'hangar', [])
    assert.deepEqual(out(d, [], inp({ move: { x: 0, y: -1 } })), [{ type: 'exit', id: 'hangar', to: { theme: 'hangar' } }])
  })
})

describe('saves', () => {
  it('round-trip, reject garbage and say how far the quest has come', () => {
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
    // The summary the profile shows.
    {
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
    }
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

  const saveAt = (at, patch = {}) => ({ ...Z.toSave(newGame()), savedAt: at, ...patch })

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
})

describe('full run', () => {
  it('goes from the hut to the Sun Prism', () => {
    const s = newGame(11)
    const { walkTo, face, pressA } = P
    // A pot in Home Glade, lifted and thrown, before the walk (`zelda-prism-run.mjs`, shared with the A button's test).
    const pot = s.map.tiles.findIndex((t, k) => t === 'o' && s.map.tiles[k + s.map.w] === '.')
    walkTo(s, pot % s.map.w, Math.floor(pot / s.map.w) + 1)
    face(s, 'up'); pressA(s)
    assert.equal(s.hero.carry, 'pot')
    for (let k = 0; k < 30; k++) step(s)
    const thrown = [...step(s, A)]
    for (let k = 0; k < 60; k++) thrown.push(...step(s))
    assert.ok(thrown.some(e => e.type === 'shatter'))
    assert.equal(s.hero.carry, null)
    prismRun(s, { ...P, Z, OX })
  })
})

describe('talks', () => {
  const ask = { options: ['TALK', 'PET'], replies: [['MRRROW.'], ['THE CAT APPROVES.']] }
  const asking = () => {
    const s = newGame()
    s.mode = 'dialog'
    s.dialog = { lines: ['A CAT.'], line: 0, chars: 99, who: 'cat', after: null, choice: 0, held: false, ask }
    return s
  }
  it('that ask open the reply picked, the first by A and the second after a press right, and close on B', () => {
    const first = asking()
    step(first, A)
    assert.deepEqual(first.dialog.lines, ask.replies[0])
    assert.equal(first.dialog.ask, undefined)
    const second = asking()
    step(second, inp({ move: { x: 1, y: 0 } }))
    step(second, A)
    assert.deepEqual(second.dialog.lines, ask.replies[1])
    const closed = asking()
    step(closed, inp({ bPress: true }))
    assert.equal(closed.mode, 'play')
  })

  it('mashing A does not start the talk over; a rested A talks again', () => {
    const s = Z.createGame(Z.WORLD, { seed: 3, at: Z.WORLD.start })
    P.settle(s)
    for (let k = 0; k < 40; k++) step(s)
    const kid = s.map.npcs.find(n => n.id === 'townkid')
    kid.wander = false
    s.hero.x = kid.x; s.hero.y = kid.y + 0.8; s.hero.dir = 'up'
    step(s, inp({ aPress: true, a: true }))
    assert.equal(s.mode, 'dialog')
    // A every 150 ms, long past the last line.
    let opened = 1
    let was = true
    for (let f = 0; f < 600; f++) {
      step(s, f % 9 === 0 ? inp({ aPress: true, a: true }) : inp())
      const is = s.mode === 'dialog'
      if (is && !was) opened++
      was = is
    }
    assert.equal(opened, 1)
    assert.equal(s.mode, 'play')
    for (let f = 0; f < 30; f++) step(s)
    step(s, inp({ aPress: true, a: true }))
    assert.equal(s.mode, 'dialog', 'after a rest A talks again')
  })
})

describe('real-time combat: the chain, the roll (2026-11-25)', () => {
  /** The arena, the foe `d` tiles in front. */
  const arena = (d = 1.2, kind = 'blob') => room(Z, d, kind)

  it('chains: a press in a swing waits for the next hit, the finisher lunges and drives the foe, a reeling foe harms no one', () => {
    // A press during a swing waits and starts hit 2 before hit 1 is over; a press long after the chain starts it over.
    // The Arc Blade is only a blade (2026-11-25): even at full hearts a swing throws nothing.
    const a = arena(0)
    a.s.inv.arc = true
    a.go(A)
    assert.equal(a.s.hero.swing.n, 0)
    a.go(inp(), 3)
    a.go(A)
    assert.deepEqual([a.s.hero.swing.n, a.s.hero.bufA > 0], [0, true], 'too early: the press waits')
    let k = 0
    while (a.s.hero.swing.n === 0 && k++ < 30) a.go()
    assert.deepEqual([a.s.hero.swing.n, a.s.hero.swing.side], [1, -1], 'hit 2, back the other way')
    assert.ok((4 + k) / 60 < Z.COMBO[0].time, `hit 2 began ${k} frames later`)
    a.go(inp(), 12); a.go(A)
    assert.equal(a.s.hero.swing.n, 2, 'the third is the finisher')
    a.go(inp(), 40); a.go(A)
    assert.equal(a.s.hero.swing.n, 0, 'after the finisher the chain starts over')
    assert.ok(!a.s.map.projectiles.some(p => p.friendly), 'the Arc Blade threw something')
    // On a foe: all three land, 1 + 1 + 2, no crit of its own; the foe stays in reach, then the finisher drives it off.
    const b = arena()
    b.go(A); b.go(inp(), 11)
    assert.ok(Math.hypot(b.foe.x - b.s.hero.x, b.foe.y - b.s.hero.y) < Z.SWORD_REACH + b.foe.r, 'shoved out of reach')
    b.go(A); b.go(inp(), 11)
    const x0 = b.s.hero.x
    const f0 = b.foe.x
    b.go(A)
    assert.equal(b.s.hero.swing.n, 2)
    b.go(inp(), 30)
    assert.ok(b.s.hero.x > x0, 'no lunge')
    assert.ok(b.foe.x - f0 >= 1, `driven ${(b.foe.x - f0).toFixed(2)} tiles`)
    const hits = b.ev.filter(e => e.type === 'hit')
    assert.deepEqual(hits.map(e => !!e.crit), [false, false, false])
    assert.equal(99 - b.foe.hp, Z.COMBO[0].dmg + Z.COMBO[1].dmg + Z.COMBO[2].dmg)
    assert.equal(hits.at(-1).heavy, true)
    assert.ok(b.ev.some(e => e.type === 'hitStop' && e.ms >= 80))
    // The finisher on a stunned foe is critical.
    const c = arena()
    c.go(A); c.go(inp(), 11); c.go(A); c.go(inp(), 11)
    c.foe.stun = 1
    const hp0 = c.foe.hp
    c.go(A); c.go(inp(), 30)
    assert.equal(c.ev.filter(e => e.type === 'hit').at(-1).crit, true)
    assert.equal(hp0 - c.foe.hp, Z.COMBO[2].dmg + 1)
    // A reeling foe right on top of the hero harms no one.
    {
      const { s, go, foe } = arena()
      go(A)
      go(inp(), 3)
      assert.ok(foe.stagger > 0 || foe.knock)
      // Right on top of the hero, still reeling.
      foe.x = s.hero.x + 0.4
      foe.knock = null
      foe.stagger = 0.3
      const hp = s.hero.hp
      go(inp(), 5)
      assert.equal(s.hero.hp, hp)
    }
  })

  it('rolls: harm passes in the first moments, about two tiles go by, and one press is one roll', () => {
    const { W, s, ev, go } = arena(0)
    const c = Z.ctx(W, s, [])
    go(inp({ rollPress: true, move: { x: 1, y: 0 } }))
    assert.equal(s.hero.act, 'roll')
    assert.ok(ev.some(e => e.type === 'roll'))
    assert.equal(Z.hurtHero(c, 1, s.hero.x - 1, s.hero.y), false, 'hurt in the roll\'s first moment')
    go(inp(), 12)
    assert.equal(Z.hurtHero(c, 1, s.hero.x - 1, s.hero.y), true, 'not hurt after the i-frames')
    const b = arena(0)
    const x0 = b.s.hero.x
    const y0 = b.s.hero.y
    b.go(inp({ rollPress: true, move: { x: 1, y: 0 } }))
    b.go(inp(), 30)
    assert.ok(Math.abs(b.s.hero.x - x0 - Z.ROLL_DIST) < 0.3, `rolled ${(b.s.hero.x - x0).toFixed(2)}`)
    assert.ok(Math.abs(b.s.hero.y - y0) < 1e-9)
    assert.equal(b.s.hero.act, 'idle')
    // One long frame, twelve substeps: the press on the first only.
    {
      const { W, s, ev } = arena(0)
      // One 0.1 s frame: twelve substeps, the press on the first.
      ev.push(...Z.stepGame(W, s, 0.1, inp({ rollPress: true, move: { x: 1, y: 0 } })))
      assert.equal(ev.filter(e => e.type === 'roll').length, 1)
      for (let k = 0; k < 40; k++) ev.push(...Z.stepGame(W, s, 1 / 60, inp()))
      assert.equal(ev.filter(e => e.type === 'roll').length, 1, 'a second roll from one press')
    }
  })
})

describe('calm sentries (the grazer pen)', () => {
  /** A bare room: the hero at the west, a sentry four tiles east of him, facing him. */
  function pen(calm) {
    const W = {
      start: { map: 'pen', entry: 'start' },
      maps: {
        pen: {
          id: 'pen', name: 'PEN', kind: 'interior', track: 'indoor',
          rows: ['############', '#..........#', '#..........#', '#.@...z....#', '#..........#', '#..........#', '############'],
          marks: { '@': { ent: { t: 'entry', id: 'start', dir: 'right' } }, z: { ent: { t: 'enemy', kind: 'sentry', dir: 'left', ...(calm ? { calm: true } : {}) } } },
        },
      },
    }
    const s = Z.createGame(W, { seed: 3 })
    s.mode = 'play'
    s.dialog = null
    s.inv.sword = true
    const e = s.map.enemies[0]
    const step = (n = 1) => { for (let k = 0; k < n; k++) Z.stepGame(W, s, 1 / 60, inp()) }
    return { W, s, e, step }
  }

  it('a calm one only patrols, where another goes for the hero, and its touch does no harm', () => {
    const wild = pen(false)
    wild.step()
    assert.equal(wild.e.ai.mode, 'alert', 'a sentry that is not calm goes for him')
    const { s, e, step } = pen(true)
    const hp = s.hero.hp
    for (let k = 0; k < 900; k++) {
      // Every so often it is put right against the hero, facing him.
      if (k % 150 === 0) { e.x = s.hero.x + 0.5; e.y = s.hero.y; e.dir = 'left' }
      step()
      assert.ok(e.ai.mode !== 'alert' && e.ai.mode !== 'chase', `frame ${k}: ${e.ai.mode}`)
    }
    assert.equal(s.hero.hp, hp)
    assert.ok(!e.ai.angry)
  })

  it('a calm one struck by the blade or a bomb turns angry and goes for the hero', () => {
    for (const [src, dmg] of [['sword', 1], ['bomb', 2]]) {
      const { W, s, e, step } = pen(true)
      step()
      assert.ok(Z.hitEnemy(Z.ctx(W, s, []), e, dmg, s.hero.x, s.hero.y, src), src)
      assert.equal(e.ai.angry, true)
      for (let k = 0; k < 300 && e.ai.mode !== 'chase'; k++) { s.hero.invuln = 1; step() }
      assert.equal(e.ai.mode, 'chase', src)
    }
  })

  it('the Shellyard keeps three calm grazers and one that is not, and they are calm again after a reload', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'sporelight', entry: 'shellyard' } })
    const pen = s.map.enemies.filter(e => e.kind === 'sentry')
    assert.deepEqual(pen.map(e => !!e.calm).sort(), [false, true, true, true])
    assert.ok(pen.every(e => !e.ai.angry))
  })
})
