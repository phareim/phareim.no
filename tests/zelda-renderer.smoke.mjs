import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// renderer.ts uses extensionless relative imports (repo style, same as
// themes/outrun/renderer.ts), which plain node type-stripping cannot
// resolve. Stage a temp copy with the two value-import specifiers rewritten
// to explicit .ts paths, then import that.
function loadRenderer() {
  const root = new URL('..', import.meta.url)
  const read = (p) => readFileSync(new URL(p, root), 'utf8')
  const tmp = mkdtempSync(join(tmpdir(), 'zelda-smoke-'))
  mkdirSync(join(tmp, 'themes/zelda'), { recursive: true })
  mkdirSync(join(tmp, 'themes/base'), { recursive: true })
  const renderer = read('themes/zelda/renderer.ts')
    .split(`from './types'`).join(`from './types.ts'`)
    .split(`from '../base/fonts'`).join(`from '../base/fonts.ts'`)
  writeFileSync(join(tmp, 'themes/zelda/renderer.ts'), renderer)
  writeFileSync(join(tmp, 'themes/zelda/types.ts'), read('themes/zelda/types.ts'))
  writeFileSync(join(tmp, 'themes/base/fonts.ts'), read('themes/base/fonts.ts'))
  return import(pathToFileURL(join(tmp, 'themes/zelda/renderer.ts')).href)
}

const { createRenderer } = await loadRenderer()

// A canvas stub: getContext returns a Proxy absorbing every call.
function makeCtx() {
  const fn = () => proxy
  const proxy = new Proxy(fn, {
    get(_t, prop) {
      if (prop === Symbol.toPrimitive) return () => 0
      return proxy
    },
    apply() {
      return proxy
    },
    set() {
      return true
    },
  })
  return proxy
}

function stubCanvas() {
  return {
    width: 0,
    height: 0,
    getContext() {
      return makeCtx()
    },
  }
}

const ROWS = [
  '###############',
  '#.............#',
  '#.~o..........#',
  '#.....T....G..#',
  '#..W........L.#',
  '#....,.....B..#',
  '#......S......#',
  '#.............#',
  '#.............#',
  '#.............#',
  '###############',
]

const world = {
  rooms: {
    meadow: {
      id: 'meadow',
      area: 'overworld',
      name: 'THE MEADOW',
      rows: ROWS,
      enemies: [{ id: 'meadow.chaser1', kind: 'chaser', x: 5, y: 5 }],
      chests: [{ id: 'meadow.chest1', x: 2, y: 2, reward: { kind: 'sword' } }],
      pickups: [{ id: 'meadow.sword', x: 7, y: 5, reward: { kind: 'sword' } }],
      portals: [],
      entries: { start: { x: 7, y: 8, facing: 'up' } },
    },
  },
  startRoom: 'meadow',
  startEntry: 'start',
}

function makeState() {
  return {
    phase: 'play',
    room: {
      id: 'meadow',
      width: 15,
      height: 11,
      tiles: ROWS.map((r) => [...r]),
      enemies: [
        { id: 'meadow.chaser1', kind: 'chaser', x: 5, y: 5, hp: 2, facing: 'down', r: 0.4, invuln: 0, knockback: null, brain: { t: 0, phase: 'chase', tell: 0.5 } },
        { id: 'meadow.boss1', kind: 'slimeKnight', x: 10, y: 6, hp: 9, facing: 'left', r: 0.8, invuln: 0.2, knockback: null, brain: { t: 0, phase: 'slam', tell: 0.4 } },
      ],
      projectiles: [{ id: 1, x: 6, y: 5, vx: 2, vy: 0, r: 0.12, owner: 'enemy' }],
      drops: [{ id: 2, kind: 'heart', x: 4, y: 4, t: 7 }],
      chestsClosed: ['meadow.chest1'],
      pickupsLeft: ['meadow.sword'],
      insidePortal: null,
    },
    player: {
      x: 7, y: 8, facing: 'up', hp: 3, maxHp: 3, hasSword: true,
      smallKeys: 1, hasBossKey: true, invuln: 0.5,
      swing: { t: 0.05, facing: 'up', hit: new Set() },
      cooldown: 0, knockback: null, vx: 1, vy: 0,
    },
    progress: { flags: [], containers: [] },
    safe: { room: 'meadow', entry: 'start' },
    slide: null,
    dying: null,
    elapsed: 10,
    rng: 1,
    nextId: 3,
    shake: 0.2,
    demo: false,
  }
}

function makeUi() {
  return {
    banner: { text: 'THE MEADOW', t: 1 },
    paused: false,
    reducedMotion: false,
    alpha: 1,
    stick: { originX: 100, originY: 500, dx: 10, dy: -5 },
    hint: 'TAP TO START',
  }
}

describe('zelda renderer smoke', () => {
  it('portrait: HUD above, 34% below reserved', () => {
    const r = createRenderer(stubCanvas(), world)
    r.resize(375, 667, 2)
    const st = makeState()
    r.onEvents([{ type: 'swordHit', x: 5, y: 5, enemyId: 'meadow.chaser1', killed: false }])
    r.draw(st, makeUi(), 1 / 60)
    const rc = r.roomRect()
    assert.ok(rc.w > 0 && rc.h > 0, 'room has size')
    assert.ok(rc.x >= 0 && rc.x + rc.w <= 375 + 1e-6, 'fits horizontally')
    assert.ok(rc.y >= 34, `HUD strip above (>=34px), got y=${rc.y}`)
    assert.ok(rc.y + rc.h <= 667 * (1 - 0.34) + 1e-6, `34% below reserved, got bottom=${rc.y + rc.h}`)
  })

  it('landscape: HUD above, 22% each side reserved', () => {
    const r = createRenderer(stubCanvas(), world)
    r.resize(667, 375, 2)
    r.draw(makeState(), makeUi(), 1 / 60)
    const rc = r.roomRect()
    assert.ok(rc.y >= 34, `HUD strip above (>=34px), got y=${rc.y}`)
    assert.ok(rc.x >= 667 * 0.22 - 1e-6, `22% left reserved, got x=${rc.x}`)
    assert.ok(rc.x + rc.w <= 667 * (1 - 0.22) + 1e-6, `22% right reserved, got right=${rc.x + rc.w}`)
    assert.ok(rc.y + rc.h <= 375 + 1e-6, 'fits vertically')
  })

  it('slide, dying, paused, reducedMotion draw without throwing', () => {
    const r = createRenderer(stubCanvas(), world)
    r.resize(375, 667, 2)
    const st = makeState()
    r.draw(st, makeUi(), 1 / 60)
    r.onEvents([{ type: 'slideStart', dir: 'right' }])
    const sliding = makeState()
    sliding.phase = 'slide'
    sliding.slide = { from: 'meadow', to: 'meadow', dir: 'right', t: 0.1, toX: 7, toY: 8, entry: 'start' }
    r.draw(sliding, makeUi(), 1 / 60)
    const dying = makeState()
    dying.phase = 'dying'
    dying.dying = { t: 0.3 }
    r.draw(dying, makeUi(), 1 / 60)
    const ui = makeUi()
    ui.reducedMotion = true
    ui.paused = true
    ui.stick = null
    ui.hint = ''
    r.draw(makeState(), ui, 1 / 60)
    r.onEvents([
      { type: 'chestOpened', id: 'meadow.chest1', reward: { kind: 'sword' } },
      { type: 'bossDefeated', kind: 'slimeKnight' },
      { type: 'won', elapsed: 60 },
      { type: 'playerHit', x: 7, y: 8 },
      { type: 'potSmash', x: 3, y: 3 },
    ])
    r.draw(makeState(), ui, 1 / 60)
  })
})
