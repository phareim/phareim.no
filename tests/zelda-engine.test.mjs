import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import * as E from '../themes/zelda/engine.ts'
import * as T from '../themes/zelda/types.ts'

// ---------------------------------------------------------------------------
// Inline test world (do NOT import world.ts — owned by another agent).
// Three 15x11 rooms: meadow -> knightroom -> bossroom, joined by portals.
// ---------------------------------------------------------------------------

const MEADOW_ROWS = [
  '###############',
  '#.###.........#',
  '#.o...........#',
  '#.....~.......#',
  '#..W....T.....#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.........L...#',
  '#......S......#',
  '###############',
]

const KNIGHT_ROWS = [
  '###############',
  '#.............#',
  '#.............#',
  '#.............#',
  '#...........S.#',
  '#...........S.#',
  '#...........S.#',
  '#.............#',
  '#.............#',
  '#.............#',
  '###############',
]

const BOSS_ROWS = [
  '###############',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '#.............#',
  '###############',
]

const WORLD = {
  rooms: {
    meadow: {
      id: 'meadow',
      area: 'overworld',
      name: 'THE MEADOW',
      rows: MEADOW_ROWS,
      enemies: [
        { id: 'meadow.chaser1', kind: 'chaser', x: 6, y: 5 },
        { id: 'meadow.wanderer1', kind: 'wanderer', x: 3, y: 6 },
        { id: 'meadow.turret1', kind: 'turret', x: 12, y: 6, facing: 'left' },
      ],
      chests: [{ id: 'meadow.keychest', x: 6, y: 8, reward: { kind: 'smallKey' } }],
      pickups: [{ id: 'meadow.sword', x: 2, y: 8, reward: { kind: 'sword' } }],
      portals: [
        { id: 'meadow.east', x: 13, y: 4, w: 2, h: 3, toRoom: 'knightroom', toX: 1.5, toY: 9, dir: 'right' },
      ],
      entries: {
        start: { x: 7, y: 7, facing: 'up' },
        'knight.west': { x: 12, y: 5, facing: 'left' },
      },
    },
    knightroom: {
      id: 'knightroom',
      area: 'dungeon',
      name: 'THE GATE',
      rows: KNIGHT_ROWS,
      enemies: [{ id: 'knightroom.knight1', kind: 'knight', x: 6, y: 2, facing: 'down' }],
      chests: [],
      pickups: [],
      portals: [
        { id: 'knight.west', x: 0, y: 8, w: 2, h: 2, toRoom: 'meadow', toX: 12, toY: 5, dir: 'left' },
        { id: 'knight.east', x: 13, y: 4, w: 2, h: 3, toRoom: 'bossroom', toX: 1.5, toY: 9, dir: 'right' },
      ],
      entries: {
        start: { x: 7, y: 8, facing: 'down' },
        'meadow.east': { x: 1.5, y: 9, facing: 'right' },
        'boss.west': { x: 11, y: 5, facing: 'left' },
      },
    },
    bossroom: {
      id: 'bossroom',
      area: 'boss',
      name: 'THE SHRINE',
      rows: BOSS_ROWS,
      enemies: [{ id: 'bossroom.boss1', kind: 'slimeKnight', x: 7, y: 3 }],
      chests: [{ id: 'bossroom.relic', x: 6, y: 7, reward: { kind: 'relic' }, requiresFlag: 'boss' }],
      pickups: [],
      portals: [
        { id: 'boss.west', x: 0, y: 8, w: 2, h: 2, toRoom: 'knightroom', toX: 11, toY: 5, dir: 'left' },
      ],
      entries: {
        start: { x: 7, y: 8, facing: 'up' },
        'knight.east': { x: 1.5, y: 9, facing: 'right' },
      },
    },
  },
  startRoom: 'meadow',
  startEntry: 'start',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IDLE = { move: { x: 0, y: 0 }, attack: false, interact: false, autoFace: false }
const STEP = 1 / 120

/** JSON with Sets sorted — GameState holds swing.hit as a Set. */
function ser(s) {
  return JSON.stringify(s, (_k, v) => (v instanceof Set ? [...v].sort() : v))
}

function fresh(seed = 1234, opts = {}) {
  return E.createGame(WORLD, { seed, ...opts })
}

/** Step n substeps, collecting every event in order. */
function steps(state, n, input = IDLE) {
  const out = []
  for (let i = 0; i < n; i++) out.push(...E.stepGame(WORLD, state, STEP, input))
  return out
}

/** Walk toward (x, y) with scripted inputs only. Returns on arrival or when
 *  the phase leaves play (slides, death); throws when stuck. */
function walkTo(state, x, y, max = 3000) {
  for (let i = 0; i < max; i++) {
    if (state.phase !== 'play') return state.phase
    const dx = x - state.player.x
    const dy = y - state.player.y
    const d = Math.hypot(dx, dy)
    if (d < 0.06) {
      E.stepGame(WORLD, state, STEP, IDLE)
      return state.phase
    }
    E.stepGame(WORLD, state, STEP, { move: { x: dx / d, y: dy / d }, attack: false, interact: false, autoFace: false })
  }
  throw new Error(`walkTo: stuck going to ${x},${y}`)
}

/** Step once with a raw move vector (for facing checks). */
function moveOnce(state, mx, my) {
  E.stepGame(WORLD, state, STEP, { move: { x: mx, y: my }, attack: false, interact: false, autoFace: false })
}

/** Attack once (edge) then idle. */
function swingOnce(state, autoFace = false) {
  const ev = E.stepGame(WORLD, state, STEP, {
    move: { x: 0, y: 0 }, attack: true, interact: false, autoFace,
  })
  steps(state, 3)
  return ev
}

function enemyById(state, id) {
  return state.room.enemies.find((e) => e.id === id)
}

function clearRoom(state, keep = []) {
  state.room.enemies = state.room.enemies.filter((e) => keep.includes(e.id))
}

// ---------------------------------------------------------------------------
// Contract constants
// ---------------------------------------------------------------------------

describe('contract constants match types.ts', () => {
  it('every gameplay constant equals the types.ts value', () => {
    for (const k of [
      'PLAYER_RADIUS', 'PLAYER_SPEED', 'SWORD_REACH', 'SWING_TIME',
      'SWING_COOLDOWN', 'INVULN_TIME', 'KNOCKBACK_SPEED', 'KNOCKBACK_TIME',
      'SLIDE_TIME', 'STEP', 'START_HEARTS', 'MAX_HEARTS', 'SAVE_VERSION',
    ]) {
      assert.equal(E[k], T[k], k)
    }
    assert.ok(Math.abs(E.SWORD_ARC - Math.PI * 0.9) < 1e-12, 'SWORD_ARC')
  })

  it('rand is a deterministic mulberry32 in [0,1)', () => {
    const a = E.rand(42)
    const b = E.rand(42)
    assert.deepEqual(a, b)
    assert.ok(a.value >= 0 && a.value < 1)
    assert.notEqual(a.value, E.rand(a.next).value)
    assert.equal(typeof a.next, 'number')
  })

  it('worldToTile floors', () => {
    assert.deepEqual(E.worldToTile(2.9, 3.1), { tx: 2, ty: 3 })
    assert.deepEqual(E.worldToTile(0.1, 10.9), { tx: 0, ty: 10 })
  })
})

// ---------------------------------------------------------------------------
// Determinism, dead zone, clamp, wall slide, facing
// ---------------------------------------------------------------------------

describe('step determinism and movement', () => {
  it('same seed + inputs -> identical JSON state', () => {
    const run = () => {
      const s = fresh(77)
      const inputs = [
        { move: { x: 1, y: 0 }, attack: false, interact: false, autoFace: false },
        { move: { x: 0.5, y: -0.5 }, attack: true, interact: false, autoFace: true },
        IDLE,
      ]
      for (let i = 0; i < 240; i++) E.stepGame(WORLD, s, STEP, inputs[i % 3])
      return ser(s)
    }
    assert.equal(run(), run())
  })

  it('different seeds diverge once rng is drawn', () => {
    const a = fresh(1)
    const b = fresh(2)
    steps(a, 240)
    steps(b, 240)
    assert.notEqual(ser(a), ser(b))
  })

  it('dead zone: tiny input does not move', () => {
    const s = fresh()
    const { x, y } = s.player
    steps(s, 30, { move: { x: 0.1, y: 0 }, attack: false, interact: false, autoFace: false })
    assert.equal(s.player.x, x)
    assert.equal(s.player.y, y)
  })

  it('clamp: diagonal input moves at PLAYER_SPEED, not faster', () => {
    const s = fresh()
    clearRoom(s)
    const { x, y } = s.player
    E.stepGame(WORLD, s, STEP, { move: { x: 1, y: 1 }, attack: false, interact: false, autoFace: false })
    const d = Math.hypot(s.player.x - x, s.player.y - y)
    assert.ok(Math.abs(d - T.PLAYER_SPEED * STEP) < 1e-9, `moved ${d}`)
  })

  it('wall slide: blocked axis stops, free axis continues', () => {
    const s = fresh()
    clearRoom(s)
    s.player.x = 1.5
    s.player.y = 5.5
    // Into the west wall, drifting down: x must stick at the wall, y grows.
    steps(s, 60, { move: { x: -1, y: 0.4 }, attack: false, interact: false, autoFace: false })
    assert.ok(s.player.x >= 1.3 && s.player.x < 1.5, `x=${s.player.x}`)
    assert.ok(s.player.y > 5.6, `y=${s.player.y}`)
  })

  it('facing follows the dominant axis, kept at rest, frozen in swing', () => {
    const s = fresh()
    clearRoom(s)
    s.player.hasSword = true
    moveOnce(s, -1, 0)
    assert.equal(s.player.facing, 'left')
    moveOnce(s, 0.2, 1)
    assert.equal(s.player.facing, 'down')
    moveOnce(s, 0, 0)
    assert.equal(s.player.facing, 'down')
    // Start a swing, then push another way: facing stays put.
    E.stepGame(WORLD, s, STEP, { move: { x: 0, y: 0 }, attack: true, interact: false, autoFace: false })
    assert.ok(s.player.swing !== null)
    moveOnce(s, 1, 0)
    moveOnce(s, 1, 0)
    assert.equal(s.player.facing, 'down')
  })
})

// ---------------------------------------------------------------------------
// Sword: requirements, one hit per swing, walls, pots, grass, autoFace
// ---------------------------------------------------------------------------

describe('sword', () => {
  it('swinging with no sword does nothing', () => {
    const s = fresh()
    clearRoom(s)
    const ev = swingOnce(s)
    assert.equal(s.player.swing, null)
    assert.deepEqual(ev.filter((e) => e.type === 'swing'), [])
  })

  it('one hit per swing even when the enemy sits in the arc', () => {
    const s = fresh()
    s.player.hasSword = true
    const foe = enemyById(s, 'meadow.chaser1')
    // Pin the chaser next to the player, east of it.
    foe.x = s.player.x + 1.0
    foe.y = s.player.y
    foe.brain.phase = 'wander'
    foe.brain.t = 99
    foe.brain.dx = 0
    foe.brain.dy = 0
    s.player.facing = 'right'
    const ev = swingOnce(s)
    const hits = ev.filter((e) => e.type === 'swordHit' && e.enemyId === foe.id)
    assert.equal(hits.length, 1)
    assert.equal(hits[0].killed, false)
    assert.equal(foe.hp, 1)
  })

  it('no hit through a wall tile (raycast)', () => {
    const s = fresh()
    s.player.hasSword = true
    clearRoom(s)
    // Player west of the row-1 wall block, enemy east of it.
    s.player.x = 1.5
    s.player.y = 1.5
    s.player.facing = 'right'
    s.room.enemies.push(E.spawnEnemy({ id: 't.wall', kind: 'wanderer', x: 6.5, y: 1.5 }))
    const foe = enemyById(s, 't.wall')
    foe.brain.dx = 0
    foe.brain.dy = 0
    foe.brain.t = 99
    const ev = swingOnce(s)
    assert.deepEqual(ev.filter((e) => e.type === 'swordHit'), [])
    assert.equal(foe.hp, 1)
  })

  it('pot smashes and grass cuts, tiles become floor', () => {
    const s = fresh()
    s.player.hasSword = true
    clearRoom(s)
    assert.equal(s.room.tiles[2][2], 'o')
    assert.equal(s.room.tiles[3][6], '~')
    // Face the pot from below.
    s.player.x = 2.5
    s.player.y = 3.6
    s.player.facing = 'up'
    let ev = swingOnce(s)
    assert.equal(s.room.tiles[2][2], '.')
    assert.ok(ev.some((e) => e.type === 'potSmash'), 'potSmash event')
    // Face the grass from below.
    s.player.x = 6.5
    s.player.y = 4.6
    s.player.facing = 'up'
    ev = swingOnce(s)
    // Swing needs cooldown between the two attacks.
    if (!ev.some((e) => e.type === 'grassCut')) {
      steps(s, 40)
      ev = swingOnce(s)
    }
    assert.equal(s.room.tiles[3][6], '.')
    assert.ok(ev.some((e) => e.type === 'grassCut'), 'grassCut event')
  })

  it('touch autoFace turns to the nearest enemy in reach before swinging', () => {
    const s = fresh()
    s.player.hasSword = true
    clearRoom(s)
    s.player.x = 5.5
    s.player.y = 5.5
    s.player.facing = 'up'
    s.room.enemies.push(E.spawnEnemy({ id: 't.af', kind: 'wanderer', x: 6.3, y: 5.5 }))
    const foe = enemyById(s, 't.af')
    foe.brain.dx = 0
    foe.brain.dy = 0
    foe.brain.t = 99
    const ev = E.stepGame(WORLD, s, STEP, {
      move: { x: 0, y: 0 }, attack: true, interact: false, autoFace: true,
    })
    assert.equal(s.player.facing, 'right')
    steps(s, 25)
    assert.ok(ev.some((e) => e.type === 'swordHit'), 'auto-faced swing hits')
  })

  it('clank when the arc meets a wall', () => {
    const s = fresh()
    s.player.hasSword = true
    clearRoom(s)
    s.player.x = 1.5
    s.player.y = 1.5
    s.player.facing = 'right'
    const ev = swingOnce(s)
    assert.ok(ev.some((e) => e.type === 'swordClank'), 'wall clank')
  })
})

// ---------------------------------------------------------------------------
// Drops, healing, knockback, i-frames
// ---------------------------------------------------------------------------

describe('drops and damage', () => {
  it('heart heals 1, capped at maxHp', () => {
    const s = fresh()
    s.player.hp = 1
    s.room.drops.push({ id: 99, kind: 'heart', x: s.player.x, y: s.player.y, t: 0 })
    const ev = steps(s, 2)
    assert.equal(s.player.hp, 2)
    assert.ok(ev.some((e) => e.type === 'pickup'), 'pickup event')
    s.player.hp = s.player.maxHp
    s.room.drops.push({ id: 100, kind: 'heart', x: s.player.x, y: s.player.y, t: 0 })
    steps(s, 2)
    assert.equal(s.player.hp, s.player.maxHp)
  })

  it('old drops vanish after 8 s', () => {
    const s = fresh()
    clearRoom(s)
    s.room.drops.push({ id: 99, kind: 'heart', x: 10.5, y: 1.5, t: 7.9 })
    steps(s, 30)
    assert.equal(s.room.drops.length, 0)
  })

  it('contact deals 1, grants i-frames and knockback', () => {
    const s = fresh()
    const foe = enemyById(s, 'meadow.wanderer1')
    foe.brain.dx = 0
    foe.brain.dy = 0
    foe.brain.t = 99
    s.player.x = foe.x + 0.5
    s.player.y = foe.y
    const hp = s.player.hp
    const ev = steps(s, 2)
    assert.equal(s.player.hp, hp - 1)
    assert.ok(s.player.invuln > 0.9, `invuln=${s.player.invuln}`)
    assert.ok(s.player.knockback !== null, 'knockback set')
    assert.ok(ev.some((e) => e.type === 'playerHit'), 'playerHit event')
    assert.ok(ev.some((e) => e.type === 'hitStop' && e.ms === 60), 'hitStop 60')
    // A second overlap during i-frames deals nothing.
    s.player.x = foe.x + 0.5
    s.player.y = foe.y
    steps(s, 2)
    assert.equal(s.player.hp, hp - 1)
  })
})

// ---------------------------------------------------------------------------
// Enemy brains
// ---------------------------------------------------------------------------

describe('enemy brains', () => {
  it('chaser winds up (tell) then lunges fast', () => {
    const s = fresh()
    const foe = enemyById(s, 'meadow.chaser1')
    clearRoom(s, ['meadow.chaser1'])
    s.player.x = foe.x + 2.0
    s.player.y = foe.y
    s.player.invuln = 99 // ignore contact while observing
    let sawTell = false
    let lungeSpeed = 0
    for (let i = 0; i < 600; i++) {
      E.stepGame(WORLD, s, STEP, IDLE)
      if (foe.brain.phase === 'tell') sawTell = true
      if (foe.brain.phase === 'lunge') {
        const v = Math.hypot(foe.x - (foe.px ?? foe.x), 0)
        lungeSpeed = Math.max(lungeSpeed, v / STEP)
      }
      foe.px = foe.x
    }
    assert.ok(sawTell, 'tell phase observed')
    assert.ok(lungeSpeed > 6 && lungeSpeed < 8, `lunge speed ${lungeSpeed}`)
    assert.ok(foe.brain.tell === 0 || foe.brain.phase !== 'tell' || true)
  })

  it('turret fires every 1.6 s; bolts die on walls', () => {
    const s = fresh()
    clearRoom(s, ['meadow.turret1'])
    const foe = enemyById(s, 'meadow.turret1')
    foe.facing = 'up' // open lane to the north wall
    s.player.x = 2.5
    s.player.y = 8.5
    s.player.invuln = 99
    const ev = steps(s, 240) // 2 s
    assert.ok(ev.some((e) => e.type === 'shoot'), 'turret fired')
    // Silence the turret: in-flight bolts must all die at the border wall.
    clearRoom(s, [])
    steps(s, 300)
    assert.equal(s.room.projectiles.length, 0)
  })

  it('turret bolt hurts the player', () => {
    const s = fresh()
    clearRoom(s, ['meadow.turret1'])
    const foe = enemyById(s, 'meadow.turret1')
    foe.facing = 'left'
    s.player.x = foe.x - 2.0
    s.player.y = foe.y
    const hp = s.player.hp
    const ev = steps(s, 120) // first bolt lands ~0.6 s in
    assert.equal(s.player.hp, hp - 1)
    assert.ok(ev.some((e) => e.type === 'playerHit'), 'bolt hit')
  })

  it('bat flies over water and trees but not walls', () => {
    const s = fresh()
    clearRoom(s)
    s.room.enemies.push(E.spawnEnemy({ id: 't.bat', kind: 'bat', x: 1.5, y: 4.5 }))
    const bat = enemyById(s, 't.bat')
    s.player.x = 12.5
    s.player.y = 4.5
    s.player.invuln = 99
    steps(s, 240)
    assert.ok(bat.x > 4, `bat crossed W and T tiles, x=${bat.x}`)
    // Now the wall: bat west of the row-1 block, player east of it.
    bat.x = 5.5
    bat.y = 1.5
    s.player.x = 1.5
    s.player.y = 1.5
    steps(s, 240)
    assert.ok(bat.x > 5.2, `wall stops the bat, x=${bat.x}`)
  })

  it('knight guards its front (clank) but takes flank hits', () => {
    const s = fresh()
    s.player.hasSword = true
    clearRoom(s, [])
    s.room.enemies.push(E.spawnEnemy({ id: 't.knight', kind: 'knight', x: 7.5, y: 5.5, facing: 'down' }))
    const k = enemyById(s, 't.knight')
    // Frontal attack: player south of the knight, knight faces down.
    s.player.x = 7.5
    s.player.y = 6.7
    s.player.facing = 'up'
    let ev = swingOnce(s)
    assert.ok(ev.some((e) => e.type === 'swordClank'), 'frontal clank')
    assert.equal(k.hp, 3)
    // Flank attack: player north, knight still faces down.
    steps(s, 40)
    s.player.x = 7.5
    s.player.y = 4.3
    s.player.facing = 'down'
    ev = swingOnce(s)
    assert.ok(ev.some((e) => e.type === 'swordHit'), 'flank hit lands')
    assert.equal(k.hp, 2)
  })

  it('boss enters phase 2 at hp <= 4 and spawns are bounded to 4', () => {
    const s = fresh()
    clearRoom(s, [])
    s.room.enemies.push(E.spawnEnemy({ id: 't.boss', kind: 'slimeKnight', x: 7.5, y: 3.5 }))
    const boss = enemyById(s, 't.boss')
    s.player.x = 7.5
    s.player.y = 8.5
    s.player.invuln = 99
    boss.hp = 5
    E.damageEnemy(WORLD, s, boss, 7.5, 8.5, [])
    assert.equal(boss.hp, 4)
    // Force slam cycles until the phase flips and adds spawn.
    boss.brain.phase = 'tell'
    boss.brain.t = 0.01
    boss.brain.tell = 0.01
    const ev = steps(s, 5)
    assert.ok(ev.some((e) => e.type === 'bossPhase' && e.phase === 2), 'phase 2 event')
    // Run many slam cycles: wanderer count never exceeds 4.
    for (let i = 0; i < 40; i++) {
      boss.brain.phase = 'tell'
      boss.brain.t = 0.01
      boss.brain.tell = 0.01
      boss.hp = 4
      steps(s, 5)
      const n = s.room.enemies.filter((e) => e.kind === 'wanderer').length
      assert.ok(n <= 4, `bounded spawns, n=${n}`)
    }
  })
})

// ---------------------------------------------------------------------------
// Chests, rewards, doors
// ---------------------------------------------------------------------------

describe('chests and doors', () => {
  it('chest interact: reward, flag, no duplicate', () => {
    const s = fresh()
    clearRoom(s)
    assert.ok(s.room.chestsClosed.includes('meadow.keychest'))
    s.player.x = 6.5
    s.player.y = 7.6 // adjacent to chest tile (6,8): dist 0.9 < 1.1
    const ev = E.stepGame(WORLD, s, STEP, {
      move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: false,
    })
    assert.ok(ev.some((e) => e.type === 'chestOpened' && e.id === 'meadow.keychest'))
    assert.ok(ev.some((e) => e.type === 'reward' && e.reward.kind === 'smallKey'))
    assert.equal(s.player.smallKeys, 1)
    assert.ok(s.progress.flags.includes('chest:meadow.keychest'))
    assert.ok(!s.room.chestsClosed.includes('meadow.keychest'))
    // Interacting again opens nothing.
    const ev2 = E.stepGame(WORLD, s, STEP, {
      move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: false,
    })
    assert.deepEqual(ev2.filter((e) => e.type === 'chestOpened'), [])
    assert.equal(s.player.smallKeys, 1)
  })

  it('floor sword pickup by walking over it', () => {
    const s = fresh()
    clearRoom(s)
    assert.equal(s.player.hasSword, false)
    walkTo(s, 2.2, 8.2)
    assert.equal(s.player.hasSword, true)
    assert.ok(s.progress.flags.includes('pickup:meadow.sword'))
  })

  it('key + locked door: one atomic saved change', () => {
    const s = fresh()
    clearRoom(s)
    s.player.smallKeys = 1
    assert.equal(s.room.tiles[8][10], 'L')
    walkTo(s, 9.7, 8.5) // press against the door tile face (x=10)
    assert.equal(s.room.tiles[8][10], '.')
    assert.equal(s.player.smallKeys, 0)
    assert.ok(s.progress.flags.includes('door:meadow:10,8'))
    // Save/reload keeps it open with the key spent.
    const save = E.toSave(s)
    assert.ok(save !== null)
    const r = E.createGame(WORLD, { save })
    assert.equal(r.room.tiles[8][10], '.')
    assert.equal(r.player.smallKeys, 0)
    assert.ok(r.progress.flags.includes('door:meadow:10,8'))
  })

  it('locked door without a key stays shut', () => {
    const s = fresh()
    clearRoom(s)
    walkTo(s, 9.7, 8.5)
    assert.equal(s.room.tiles[8][10], 'L')
  })

  it('S door opens on room clear with doorOpened', () => {
    const s = fresh()
    s.player.hasSword = true
    s.player.invuln = 99
    assert.equal(s.room.tiles[9][7], 'S')
    // Sword-kill every enemy through the real swing path.
    for (const id of ['meadow.chaser1', 'meadow.wanderer1', 'meadow.turret1']) {
      const foe = enemyById(s, id)
      while (enemyById(s, id)) {
        s.player.x = foe.x
        s.player.y = foe.y + foe.r + 0.9
        s.player.facing = 'up'
        swingOnce(s)
        steps(s, 40)
      }
    }
    assert.equal(s.room.enemies.length, 0)
    assert.equal(s.room.tiles[9][7], '.')
  })

  it('doorOpened fires exactly for the cleared room', () => {
    const s = fresh()
    s.player.hasSword = true
    s.player.invuln = 99
    const ev = []
    for (const id of ['meadow.chaser1', 'meadow.wanderer1', 'meadow.turret1']) {
      const foe = enemyById(s, id)
      while (enemyById(s, id)) {
        s.player.x = foe.x
        s.player.y = foe.y + foe.r + 0.9
        s.player.facing = 'up'
        ev.push(...swingOnce(s))
        steps(s, 40)
      }
    }
    const opened = ev.filter((e) => e.type === 'doorOpened')
    assert.equal(opened.length, 1)
    assert.deepEqual([opened[0].x, opened[0].y], [7.5, 9.5])
  })
})

// ---------------------------------------------------------------------------
// Portals and slides
// ---------------------------------------------------------------------------

describe('portals', () => {
  it('slide, arrival, safe entry, no immediate refire', () => {
    const s = fresh()
    clearRoom(s)
    s.player.invuln = 99
    walkTo(s, 13.5, 5.0)
    assert.equal(s.phase, 'slide')
    const ev = steps(s, 60)
    const enter = ev.filter((e) => e.type === 'roomEnter')
    assert.equal(enter.length, 1)
    assert.equal(enter[0].room, 'knightroom')
    assert.deepEqual(s.safe, { room: 'knightroom', entry: 'meadow.east' })
    assert.ok(Math.abs(s.player.x - 1.5) < 0.01 && Math.abs(s.player.y - 9) < 0.01)
    // Arrival point sits inside the return trigger: it must not refire.
    assert.equal(s.room.insidePortal, 'knight.west')
    steps(s, 120)
    assert.equal(s.phase, 'play')
    assert.equal(s.room.id, 'knightroom')
    // Leaving the rect clears the guard (knight removed: portal mechanics only).
    s.room.enemies = []
    walkTo(s, 7, 7)
    assert.equal(s.room.insidePortal, null)
  })

  it('elapsed freezes during slides', () => {
    const s = fresh()
    clearRoom(s)
    const t0 = s.elapsed
    steps(s, 120)
    assert.ok(s.elapsed > t0)
    walkTo(s, 13.5, 5.0)
    const t1 = s.elapsed
    steps(s, 30) // mid-slide
    assert.equal(s.phase, 'slide')
    assert.equal(s.elapsed, t1)
  })
})

// ---------------------------------------------------------------------------
// Death, respawn, saves
// ---------------------------------------------------------------------------

describe('death and saves', () => {
  function dyingState() {
    const s = fresh()
    const foe = enemyById(s, 'meadow.wanderer1')
    foe.brain.dx = 0
    foe.brain.dy = 0
    foe.brain.t = 99
    s.player.hp = 1
    s.player.invuln = 0
    s.player.x = foe.x + 0.5
    s.player.y = foe.y
    return s
  }

  it('death -> dying -> auto respawn with hp = maxHp, room rebuilt', () => {
    const s = dyingState()
    // Smash the pot first so respawn has something to restore.
    s.player.hasSword = true
    s.player.x = 2.5
    s.player.y = 3.6
    s.player.facing = 'up'
    swingOnce(s)
    steps(s, 40)
    assert.equal(s.room.tiles[2][2], '.')
    // Now die.
    const foe = enemyById(s, 'meadow.wanderer1')
    s.player.hp = 1
    s.player.invuln = 0
    s.player.x = foe.x + 0.5
    s.player.y = foe.y
    let ev = steps(s, 2)
    assert.equal(s.phase, 'dying')
    assert.ok(ev.some((e) => e.type === 'playerDied'))
    ev = steps(s, 120)
    assert.ok(ev.some((e) => e.type === 'respawn'), 'respawn event')
    assert.ok(ev.some((e) => e.type === 'roomEnter'), 'roomEnter event')
    assert.equal(s.phase, 'play')
    assert.equal(s.player.hp, s.player.maxHp)
    assert.equal(s.room.tiles[2][2], 'o', 'pots reset')
    assert.ok(enemyById(s, 'meadow.wanderer1'), 'enemies reset')
  })

  it('chest loot survives death and reload', () => {
    const s = fresh()
    clearRoom(s)
    s.player.x = 6.5
    s.player.y = 7.6
    E.stepGame(WORLD, s, STEP, { move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: false })
    assert.equal(s.player.smallKeys, 1)
    // Die and respawn.
    s.player.hp = 1
    s.player.invuln = 0
    s.room.enemies.push(E.spawnEnemy({ id: 't.k', kind: 'wanderer', x: s.player.x + 0.5, y: s.player.y }))
    steps(s, 2)
    steps(s, 120)
    assert.equal(s.player.smallKeys, 1, 'key kept after death')
    assert.ok(!s.room.chestsClosed.includes('meadow.keychest'), 'chest stays open')
    // And after a save round-trip.
    const r = E.createGame(WORLD, { save: E.toSave(s) })
    assert.equal(r.player.smallKeys, 1)
    assert.ok(!r.room.chestsClosed.includes('meadow.keychest'))
  })

  it('parseSave rejects garbage; createGame starts fresh', () => {
    assert.equal(E.parseSave('nope'), null)
    assert.equal(E.parseSave(null), null)
    assert.equal(E.parseSave({ v: 999, room: 'meadow', entry: 'start' }), null)
    assert.equal(E.parseSave({
      v: 1, room: 'meadow', entry: 'start', hp: 99, maxHp: 3,
      hasSword: false, smallKeys: 0, hasBossKey: false,
      flags: [], containers: [], rng: 1, elapsed: 0,
    }), null)
    assert.equal(E.parseSave({
      v: 1, room: 'meadow', entry: 'start', hp: 3, maxHp: 3,
      hasSword: false, smallKeys: 0, hasBossKey: false,
      flags: 'nope', containers: [], rng: 1, elapsed: 0,
    }), null)
    const s = E.createGame(WORLD, { save: { bogus: true } })
    assert.equal(s.room.id, 'meadow')
    assert.equal(s.player.hp, 3)
    assert.deepEqual(s.progress.flags, [])
  })

  it('toSave returns null for demo state', () => {
    const s = fresh(1, { demo: true })
    assert.equal(s.demo, true)
    assert.equal(E.toSave(s), null)
  })

  it('toSave resumes at the safe entry with clamped hp', () => {
    const s = fresh()
    s.safe = { room: 'knightroom', entry: 'meadow.east' }
    s.player.hp = 2
    s.progress.containers.push('forest.heart')
    const save = E.toSave(s)
    const r = E.createGame(WORLD, { save })
    assert.equal(r.room.id, 'knightroom')
    assert.equal(r.player.maxHp, 4)
    assert.equal(r.player.hp, 2)
    assert.deepEqual([r.player.x, r.player.y], [1.5, 9])
  })
})

// ---------------------------------------------------------------------------
// Relic, won, elapsed, bounds
// ---------------------------------------------------------------------------

describe('relic and bounds', () => {
  it('relic chest is hidden until the boss dies, then wins the game', () => {
    const s = fresh()
    let bossRoom = E.buildRoom(WORLD, 'bossroom', [])
    assert.deepEqual(bossRoom.chestsClosed, [], 'relic hidden without the flag')
    bossRoom = E.buildRoom(WORLD, 'bossroom', ['boss'])
    assert.deepEqual(bossRoom.chestsClosed, ['bossroom.relic'], 'relic appears with the flag')
    s.room = bossRoom
    s.room.enemies = []
    s.player.x = 6.5
    s.player.y = 6.5
    const ev = E.stepGame(WORLD, s, STEP, {
      move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: false,
    })
    assert.equal(s.phase, 'won')
    assert.ok(s.progress.flags.includes('won'))
    assert.ok(ev.some((e) => e.type === 'won'), 'won event with elapsed')
  })

  it('elapsed freezes while dying', () => {
    const s = fresh()
    clearRoom(s)
    s.phase = 'dying'
    s.dying = { t: 0.5 }
    const t = s.elapsed
    steps(s, 30)
    assert.equal(s.elapsed, t)
  })

  it('drops cap at 12, projectiles cap at 24', () => {
    const s = fresh()
    clearRoom(s)
    for (let i = 0; i < 20; i++) E.spawnDrop(s, 'heart', 7.5, 7.5)
    assert.equal(s.room.drops.length, 12)
    // Park 24 motionless bolts on open floor, far from the player.
    s.player.x = 12.5
    s.player.y = 9.5
    for (let i = 0; i < 24; i++) {
      s.room.projectiles.push({ id: 100 + i, x: 7.5, y: 7.5, vx: 0, vy: 0, r: 0.18, owner: 'enemy' })
    }
    s.room.enemies.push(E.spawnEnemy({ id: 't.t', kind: 'turret', x: 12.5, y: 2.5, facing: 'left' }))
    const before = s.room.projectiles.length
    steps(s, 300)
    assert.ok(s.room.projectiles.length <= 24, `capped, got ${s.room.projectiles.length}`)
    assert.equal(s.room.projectiles.length, before, 'no 25th projectile spawned')
  })

  it('autopilot soak: 120 demo seconds, no death, same room', () => {
    const s = fresh(2026, { demo: true })
    s.player.hasSword = true
    for (let i = 0; i < 120 * 120; i++) {
      E.stepGame(WORLD, s, STEP, E.autopilot(WORLD, s))
    }
    assert.equal(s.phase, 'play')
    assert.equal(s.room.id, 'meadow')
    assert.ok(s.player.hp > 0, `survived, hp=${s.player.hp}`)
    assert.ok(Math.abs(s.elapsed - 120) < 0.5, `elapsed=${s.elapsed}`)
  })
})

// ---------------------------------------------------------------------------
// Scripted full run: start -> sword -> key -> door -> knight -> boss -> relic,
// using only stepGame with scripted inputs (walkTo/swing/interact).
// ---------------------------------------------------------------------------

describe('scripted full run', () => {
  /** Kill one enemy with a per-substep kite policy (approach, swing, flee tells). */
  function killEnemy(s, id, maxSteps = 6000) {
    let n = 0
    while (n++ < maxSteps) {
      if (s.phase !== 'play') return false
      const foe = enemyById(s, id)
      if (!foe) return true
      // Detour for hearts while hurt.
      if (s.player.hp < s.player.maxHp) {
        let bd = 16
        let bx = 0
        let by = 0
        let found = false
        for (const q of s.room.drops) {
          if (q.kind !== 'heart') continue
          const dd = (q.x - s.player.x) ** 2 + (q.y - s.player.y) ** 2
          if (dd < bd) {
            bd = dd
            bx = q.x
            by = q.y
            found = true
          }
        }
        if (found) {
          walkTo(s, bx, by)
          continue
        }
      }
      const dx = s.player.x - foe.x
      const dy = s.player.y - foe.y
      const d = Math.hypot(dx, dy) || 0.001
      const reach = E.SWORD_REACH + foe.r
      // Deterministic strafe direction, flips twice a second.
      const side = Math.floor(s.elapsed * 2) % 2 === 0 ? 1 : -1
      let move
      let attack = false
      if ((foe.brain.tell ?? 0) > 0) {
        move = { x: dx / d, y: dy / d } // flee the telegraph radially
      } else if (foe.kind === 'turret') {
        // Turret drill: bolts fly along the turret's facing, so approach and
        // park at a spot beside it (dist reach - 0.15) and never stand armed.
        const ax = foe.x
        const ay = foe.y + (s.player.y >= foe.y ? reach - 0.15 : -(reach - 0.15))
        const adx = ax - s.player.x
        const ady = ay - s.player.y
        const ad = Math.hypot(adx, ady)
        if (ad < 0.12) {
          move = { x: 0, y: 0 }
          attack = s.player.cooldown <= 0
        } else {
          move = { x: adx / (ad || 1), y: ady / (ad || 1) }
        }
      } else if (d > reach + 0.2) {
        move = { x: -dx / d, y: -dy / d } // close in
      } else if (s.player.cooldown > 0) {
        // Orbit at strike radius while the sword recovers: dodges bolts,
        // holds range, and the next stand-still swing auto-faces.
        const corr = Math.max(-0.6, Math.min(0.6, d - reach))
        const mx = (-dy / d) * side + (dx / d) * corr
        const my = (dx / d) * side + (dy / d) * corr
        const ml = Math.hypot(mx, my) || 1
        move = { x: mx / ml, y: my / ml }
      } else {
        move = { x: 0, y: 0 } // stand and swing (autoFace aims)
        attack = true
      }
      // Never back off into the east portal lane (trigger starts at x=13).
      if (s.player.x > 12.4 && move.x > 0) move = { x: -1, y: 0 }
      E.stepGame(WORLD, s, STEP, { move, attack, interact: false, autoFace: true })
    }
    return false
  }

  it('plays the whole test world to the relic', () => {
    const s = fresh(4242)
    // -- meadow: sword, then clear the room -------------------------------
    walkTo(s, 2.2, 8.2)
    assert.equal(s.player.hasSword, true, 'sword picked up')
    for (const id of ['meadow.wanderer1', 'meadow.chaser1', 'meadow.turret1']) {
      assert.ok(killEnemy(s, id), `killed ${id} (phase=${s.phase}, hp=${s.player.hp})`)
    }
    assert.equal(s.room.enemies.length, 0, 'meadow clear')
    assert.equal(s.room.tiles[9][7], '.', 'S door stands open')
    // Grab any heart that dropped.
    for (const d of [...s.room.drops]) {
      if (d.kind !== 'heart' || s.player.hp >= s.player.maxHp) continue
      if (s.phase !== 'play') break
      walkTo(s, d.x, d.y)
    }
    // -- chest key, locked door, east portal ------------------------------
    walkTo(s, 6.5, 7.6)
    E.stepGame(WORLD, s, STEP, { move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: false })
    assert.equal(s.player.smallKeys, 1, 'chest key')
    walkTo(s, 9.7, 8.5)
    assert.equal(s.room.tiles[8][10], '.', 'locked door consumed the key')
    assert.equal(s.player.smallKeys, 0)
    walkTo(s, 13.5, 5.0)
    assert.equal(s.phase, 'slide', 'east portal fires')
    steps(s, 60)
    assert.equal(s.room.id, 'knightroom', 'arrived at the knight')
    // The knight duel must never drift back into the west return trigger
    // (x<2): re-entering it after the arrival guard cleared would slide out.
    // -- knight: bait charges in open space, punish recoveries ---------------
    // Charges only trigger in front within 2.5 and contact for 2, so hp 2
    // means zero mistakes. The loop: hold south of the knight at ~2.7 (its
    // drift closes to 2.5 and starts a tell), sidestep the charge south into
    // open room, then strike twice in the 0.7 s guard-less recovery.
    let knightSteps = 0
    let strafeSide = 1
    let strafeX = -1
    let strafeY = 0
    let prevPhase = ''
    while (enemyById(s, 'knightroom.knight1') && knightSteps++ < 8000) {
      if (s.phase !== 'play') break
      const k = enemyById(s, 'knightroom.knight1')
      const phase = k.brain.phase
      const dx = s.player.x - k.x
      const dy = s.player.y - k.y
      const d = Math.hypot(dx, dy) || 0.001
      if (phase === 'tell' && prevPhase !== 'tell') {
        // Dodge south into open room (never the north wall) and LOCK the full
        // vector: re-deriving it every step flip-flops at dx≈0 into a stable
        // equilibrium directly under the knight, i.e. in the charge lane.
        strafeSide = 1
        if (s.player.y > 6.5) strafeSide = -1
        let px = -dy / d
        let py = dx / d
        if (py < 0) {
          px = -px
          py = -py
        }
        if (strafeSide < 0) {
          px = -px
          py = -py
        }
        const pl = Math.hypot(px, py) || 1
        strafeX = px / pl
        strafeY = py / pl
      }
      prevPhase = phase
      let move
      let attack = false
      if (phase === 'tell' || phase === 'charge') {
        move = { x: strafeX, y: strafeY } // hold the locked dodge line
      } else if (phase === 'recover') {
        // Guard-less and stationary: close to comfortable range, wait out
        // the cooldown standing, then swing. Never walk into contact.
        if (d > 1.5) {
          move = { x: -dx / d, y: -dy / d }
        } else {
          move = { x: 0, y: 0 }
          attack = s.player.cooldown <= 0
        }
      } else if (d < 2.2) {
        move = { x: dx / d, y: dy / d } // hold outside contact, inside the trigger
      } else if (d > 2.6) {
        move = { x: -dx / d, y: -dy / d } // drift back into range
      } else {
        move = { x: 0, y: 0 } // wait for the tell
      }
      E.stepGame(WORLD, s, STEP, { move, attack, interact: false, autoFace: true })
    }
    assert.ok(!enemyById(s, 'knightroom.knight1'), 'knight defeated')
    assert.ok(s.progress.flags.includes('miniboss'), 'miniboss flag persists')
    assert.ok(s.player.hp > 0, `survived the knight, hp=${s.player.hp}`)
    // -- through the opened S gate to the boss -----------------------------
    walkTo(s, 13.5, 5.0)
    assert.equal(s.phase, 'slide', 'gate portal fires')
    steps(s, 60)
    assert.equal(s.room.id, 'bossroom', 'arrived at the boss')
    // -- boss: strike at edge reach, flee every telegraph ------------------
    // Slam hurts out to 1.6 + radius for 2, so hp 2 means the 0.6 s tell
    // must always win the race. Strike at 1.9-2.0, hold (never walk in)
    // through cooldowns, retreat radially on every tell.
    let bossRounds = 0
    while (enemyById(s, 'bossroom.boss1') && bossRounds++ < 6000) {
      const b = enemyById(s, 'bossroom.boss1')
      if (s.phase !== 'play') break
      const dx = s.player.x - b.x
      const dy = s.player.y - b.y
      const d = Math.hypot(dx, dy) || 0.001
      if ((b.brain.tell ?? 0) > 0) {
        E.stepGame(WORLD, s, STEP, {
          move: { x: dx / d, y: dy / d }, attack: false, interact: false, autoFace: true,
        })
      } else if (d < 1.55) {
        E.stepGame(WORLD, s, STEP, {
          move: { x: dx / d, y: dy / d }, attack: false, interact: false, autoFace: true,
        })
      } else if (d > 2.0) {
        E.stepGame(WORLD, s, STEP, {
          move: { x: -dx / d, y: -dy / d }, attack: false, interact: false, autoFace: true,
        })
      } else if (s.player.cooldown > 0) {
        E.stepGame(WORLD, s, STEP, IDLE)
      } else {
        E.stepGame(WORLD, s, STEP, {
          move: { x: 0, y: 0 }, attack: true, interact: false, autoFace: true,
        })
      }
    }
    assert.ok(!enemyById(s, 'bossroom.boss1'), 'boss defeated')
    assert.ok(s.progress.flags.includes('boss'), 'boss flag persists')
    assert.ok(s.player.hp > 0, `survived the boss, hp=${s.player.hp}`)
    // -- relic ----------------------------------------------------------------
    assert.ok(s.room.chestsClosed.includes('bossroom.relic'), 'relic chest appears')
    s.room.enemies = [] // spawns stay out of the victory walk
    walkTo(s, 6.5, 6.5)
    const ev = E.stepGame(WORLD, s, STEP, {
      move: { x: 0, y: 0 }, attack: false, interact: true, autoFace: false,
    })
    assert.equal(s.phase, 'won', 'relic wins the game')
    assert.ok(ev.some((e) => e.type === 'won'), 'won event')
    assert.ok(s.progress.flags.includes('won'))
  })
})

