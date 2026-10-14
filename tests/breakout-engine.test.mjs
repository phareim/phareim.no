import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

import {
  BALL_R, BASE_SPEED, MAX_SPEED, LIVES, MAX_BALLS, PULSE_PERIOD, EXPAND_SCALE, POWER_TYPES,
  mulberry32, geometry, colsFor, ballSpeed, boardSpec, isOpen, isDriftRow, paddleY,
  createGame, startRun, stepGame, resize, setPaddleX, launchBalls, autopilotX,
  quitRun, applyPower, pickPower,
} from '../themes/breakout/engine.ts'

const W = 400
const H = 800
const DT = 1 / 60

/** A brick in the top-left corner, out of every test's path: keeps the board from clearing. */
function sentinel() {
  return brick(0, 70, { w: 10 })
}

/** A run past its serve, with one sentinel brick and no planet or drops. */
function game(seed = 1, level = 1) {
  const g = createGame({ W, H, bandBottom: 0, rng: mulberry32(seed) })
  startRun(g)
  g.level = level
  g.bricks = [sentinel()]
  g.planet = null
  g.drops = []
  return g
}

function brick(x, y, opts = {}) {
  return {
    row: 0, col: 0, baseX: x, x, y, w: 40, h: 14,
    hp: 1, maxHp: 1, kind: 'crystal', points: 10, amp: 0, phase: 0, flash: 0, color: '#ff2fa0',
    ...opts,
  }
}

function ball(x, y, vx, vy, speed = Math.hypot(vx, vy)) {
  return { x, y, vx, vy, speed, stuck: false, trail: [] }
}

function run(g, seconds, input = {}) {
  for (let t = 0; t < seconds; t += DT) stepGame(g, DT, input)
}

function drain(g) {
  const ev = g.events.slice()
  g.events.length = 0
  return ev
}

describe('speed', () => {
  it('starts faster than the old game and rises with each level', () => {
    assert.equal(ballSpeed(1), BASE_SPEED)
    assert.ok(BASE_SPEED > 380)
    assert.ok(ballSpeed(2) > ballSpeed(1))
  })

  it('caps at MAX_SPEED', () => {
    assert.equal(ballSpeed(99), MAX_SPEED)
  })
})

describe('no tunnelling at top speed', () => {
  it('a ball at MAX_SPEED breaks a brick it would otherwise pass through in one frame', () => {
    const g = game()
    const target = brick(180, 300)
    g.bricks.push(target)
    g.balls = [ball(200, 240, 0, MAX_SPEED)]
    stepGame(g, 0.05, {})
    assert.ok(!g.bricks.includes(target), 'the brick is gone after one frame')
    assert.ok(drain(g).some(e => e.type === 'break'))
  })

  it('a ball at MAX_SPEED bounces off the paddle instead of falling through it', () => {
    const g = game()
    const p = g.paddle
    g.balls = [ball(p.x, p.y - 40, 0, MAX_SPEED)]
    stepGame(g, 0.05, {})
    assert.equal(g.lives, LIVES)
    assert.equal(g.balls.length, 1)
    assert.ok(g.balls[0].vy < 0, 'the ball goes back up')
    assert.ok(drain(g).some(e => e.type === 'paddle'))
  })
})

describe('the ball and the field', () => {
  it('losing the last ball costs a life and serves a new one', () => {
    const g = game()
    g.balls = [ball(200, H + 10, 0, 100)]
    stepGame(g, DT, {})
    assert.equal(g.lives, LIVES - 1)
    assert.equal(g.balls.length, 1)
    assert.ok(g.balls[0].stuck)
    assert.ok(drain(g).some(e => e.type === 'lost'))
  })

  it('the last life ends the run, and the death event comes 0.9 s later', () => {
    const g = game()
    g.lives = 1
    g.balls = [ball(200, H + 10, 0, 100)]
    stepGame(g, DT, {})
    assert.equal(g.over, true)
    assert.ok(drain(g).some(e => e.type === 'gameover'))
    let death = false
    for (let t = 0; t < 1.2 && !death; t += DT) {
      stepGame(g, DT, {})
      death = drain(g).some(e => e.type === 'death')
    }
    assert.ok(death)
  })

  it('the Escape hold ends a run at once, with the same game over', () => {
    const g = game()
    quitRun(g)
    assert.equal(g.over, true)
    assert.equal(g.lives, 0)
    assert.ok(drain(g).some(e => e.type === 'gameover'))
  })

  it('a shield line bounces one ball once, then goes', () => {
    const g = game()
    g.shield = true
    const shieldY = g.paddle.y + g.paddle.h + 10
    g.balls = [ball(50, shieldY - 20, 0, 400)]
    run(g, 0.2)
    assert.equal(g.shield, false)
    assert.ok(drain(g).some(e => e.type === 'shield'))
    assert.equal(g.lives, LIVES)
  })
})

describe('the planet', () => {
  it('bends the ball and keeps its speed', () => {
    const g = game(1, 4)
    g.planet = { fx: 0.5, x: W / 2 + 90, y: 330, r: 30 }
    g.balls = [ball(W / 2, 260, 0, 500, 500)]
    run(g, 0.5)
    const b = g.balls[0]
    assert.ok(Math.abs(b.vx) > 1, 'the ball is pulled sideways')
    assert.ok(Math.abs(Math.hypot(b.vx, b.vy) - 500) < 1e-6, 'speed holds')
  })

  it('a ball far from the planet flies straight', () => {
    const g = game(1, 4)
    g.planet = { fx: 0.5, x: W / 2 + 90, y: 330, r: 30 }
    g.balls = [ball(40, 260, 0, 500, 500)]
    run(g, 0.2)
    assert.equal(g.balls[0].vx, 0)
  })

  it('appears only on even levels from 4', () => {
    assert.equal(boardSpec(3).planet, false)
    assert.equal(boardSpec(4).planet, true)
    assert.equal(boardSpec(5).planet, false)
    assert.equal(boardSpec(6).planet, true)
  })
})

describe('pulse bricks', () => {
  it('a closed pulse brick bounces the ball without taking damage', () => {
    const g = game(1, 3)
    const b = brick(180, 300, { kind: 'pulse', phase: 1.5, color: '#2ff3ff' })
    g.bricks.push(b)
    g.balls = [ball(200, 240, 0, 500, 500)]
    assert.equal(isOpen(b, g.t), false)
    run(g, 0.4)
    assert.ok(g.bricks.includes(b))
    assert.equal(b.hp, 1)
    assert.ok(drain(g).some(e => e.type === 'solid'))
  })

  it('an open pulse brick breaks like any other', () => {
    const g = game(1, 3)
    const b = brick(180, 300, { kind: 'pulse', phase: 0, color: '#2ff3ff' })
    g.bricks.push(b)
    g.balls = [ball(200, 240, 0, 500, 500)]
    assert.equal(isOpen(b, g.t), true)
    run(g, 0.4)
    assert.ok(!g.bricks.includes(b))
    assert.ok(drain(g).some(e => e.type === 'break'))
  })

  it('open and shut in turn, half a period each', () => {
    const b = { phase: 0 }
    assert.equal(isOpen(b, 0), true)
    assert.equal(isOpen(b, PULSE_PERIOD / 2 + 0.01), false)
  })
})

describe('power-ups', () => {
  it('a capsule caught on the paddle applies its power', () => {
    const g = game()
    g.drops = [{ x: g.paddle.x, y: g.paddle.y, power: 'expand' }]
    stepGame(g, DT, {})
    assert.ok(g.timers.expand > 0)
    assert.ok(drain(g).some(e => e.type === 'powerup' && e.power === 'expand'))
  })

  it('EXPAND widens the paddle, and it returns when the timer runs out', () => {
    const g = game()
    const base = g.paddle.baseW
    applyPower(g, 'expand', 0, 0)
    stepGame(g, DT, {})
    assert.equal(g.paddle.w, base * EXPAND_SCALE)
    run(g, 13)
    assert.equal(g.paddle.w, base)
  })

  it('MULTI adds balls, up to the cap', () => {
    const g = game()
    g.balls = [ball(200, 400, 0, 500, 500)]
    for (let i = 0; i < 6; i++) applyPower(g, 'multi', 200, 400)
    assert.ok(g.balls.length > 1)
    assert.ok(g.balls.length <= MAX_BALLS)
  })

  it('LASER fires bolts that break a brick above the paddle', () => {
    const g = game()
    // The left bolt leaves at paddle.x - 0.35 w; this brick sits under the right one.
    const target = brick(g.paddle.x + g.paddle.w * 0.35 - 20, 300)
    g.bricks.push(target)
    applyPower(g, 'laser', 0, 0)
    run(g, 2)
    assert.ok(!g.bricks.includes(target))
    assert.ok(drain(g).some(e => e.type === 'laser'))
  })

  it('a capsule is one of the POWER_TYPES', () => {
    const rng = mulberry32(5)
    for (let i = 0; i < 200; i++) assert.ok(POWER_TYPES.includes(pickPower(rng)))
  })
})

describe('levels', () => {
  it('clearing the board starts the next level, with the banner', () => {
    const g = game()
    g.bricks = []
    stepGame(g, DT, {})
    assert.equal(g.level, 2)
    assert.ok(g.banner > 0)
    assert.ok(g.bricks.length > 0)
    assert.ok(drain(g).some(e => e.type === 'levelclear' && e.level === 2))
  })

  it('the same seed gives the same boards', () => {
    const a = createGame({ W, H, rng: mulberry32(9) })
    const b = createGame({ W, H, rng: mulberry32(9) })
    a.level = b.level = 5
    startRun(a)
    startRun(b)
    const shape = g => g.bricks.map(x => [x.row, x.col, x.kind, x.hp, x.amp > 0])
    assert.deepEqual(shape(a), shape(b))
  })

  it('rows grow to nine and the layouts cycle through five patterns', () => {
    assert.equal(boardSpec(1).rows, 5)
    assert.equal(boardSpec(20).rows, 9)
    const patterns = new Set([1, 2, 3, 4, 5].map(n => boardSpec(n).pattern))
    assert.equal(patterns.size, 5)
  })

  it('from level 2 every third row drifts', () => {
    assert.equal(isDriftRow(1, 2), false)
    assert.equal(isDriftRow(2, 2), true)
    assert.equal(isDriftRow(2, 1), false)
  })
})

describe('the drifting field', () => {
  it('drift keeps every brick inside the field for a long run', () => {
    const g = game(3)
    g.bricks = []
    stepGame(g, DT, {}) // an empty board clears: level 2 comes with the drifting rows
    assert.equal(g.level, 2)
    assert.ok(g.bricks.some(b => b.amp > 0), 'level 2 has drifting bricks')
    for (let t = 0; t < 30; t += DT) {
      stepGame(g, DT, {})
      for (const b of g.bricks) {
        assert.ok(b.x >= 0 && b.x + b.w <= W, `brick at ${b.x} leaves the field`)
      }
    }
  })
})

describe('layout', () => {
  it('a narrow window keeps the grid inside the field', () => {
    const g = game(2)
    resize(g, 320, 640, 0)
    const geo = geometry(320, 640, colsFor(320))
    assert.ok(geo.bw > 0)
    for (const b of g.bricks) assert.ok(b.x + b.w <= 320)
    assert.equal(g.paddle.y, paddleY(640, 0))
  })

  it('a served ball follows the paddle', () => {
    const g = game(2)
    g.balls = [{ x: 0, y: 0, vx: 0, vy: 0, speed: 500, stuck: true, trail: [] }]
    setPaddleX(g, 123)
    stepGame(g, DT, {})
    assert.equal(g.balls[0].x, 123)
  })
})

describe('attract mode and autopilot', () => {
  it('attract mode serves its own ball and never costs a life', () => {
    const g = createGame({ W, H, rng: mulberry32(4) })
    assert.equal(g.demo, true)
    run(g, 3)
    assert.equal(g.lives, LIVES)
    assert.equal(g.over, false)
    assert.equal(g.score, 0)
  })

  it('the autopilot aims under the lowest falling ball', () => {
    const g = game()
    g.balls = [ball(100, 200, 50, 300, 300), ball(300, 500, -20, 300, 300)]
    assert.ok(Math.abs(autopilotX(g) - (300 - 20 * 0.12)) < 1e-9)
  })

  it('the autopilot plays a real run to level 2 without losing its last life', () => {
    const g = createGame({ W, H, rng: mulberry32(3) })
    startRun(g)
    let t = 0
    while (g.level < 2 && t < 240 && !g.over) {
      setPaddleX(g, autopilotX(g))
      if (g.balls.some(b => b.stuck)) launchBalls(g)
      stepGame(g, DT, {})
      t += DT
    }
    assert.ok(g.level >= 2, `reached level ${g.level} in ${t.toFixed(1)} s`)
  })
})
