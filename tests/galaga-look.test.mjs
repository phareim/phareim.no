// Space Voyagers: what the look remembers between ticks (render/fx.ts). The
// engine's events last one tick; banners, pops and shakes are copied out of
// them into fixed pools and counted down on the game clock.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createFx, resetFx, stepFx, takeEvents, roman, PICK_NAMES } from '../themes/galaga/render/fx.ts'
import { createWorld, step, makeInput } from '../themes/galaga/engine/index.ts'
import { jumpTo } from '../themes/galaga/engine/debug.ts'
import { createAutopilot, autopilot } from '../themes/galaga/engine/autopilot.ts'
import { PICKUP_IDS } from '../themes/galaga/engine/balance.ts'

const ev = (type, kind = '', n = 0, x = 100, y = 100) => ({ type, kind, n, x, y, alt: '' })
const world = (events, sector = 1) => ({ events, sector, score: 0 })
const active = pool => pool.filter(p => p.active).length

test('every card has its banner', () => {
  const fx = createFx()
  const title = (kind, n, sector = 1) => { takeEvents(fx, world([ev('card', kind, n)], sector)); return [fx.banner.title, fx.banner.sub, fx.banner.life > 0] }
  assert.deepEqual(title('sector', 1), ['SECTOR 1', 'LOW ORBIT', true])
  assert.deepEqual(title('sector', 3, 3), ['SECTOR 3', 'THE SHAG NEBULA', true])
  assert.deepEqual(title('bonus', 1).slice(0, 1), ['BONUS RUN'])
  assert.deepEqual(title('perfect', 5000), ['PERFECT', '+5000', true])
  assert.deepEqual(title('boss', 4, 4), ['WARNING', 'CAL 9000', true])
  assert.deepEqual(title('clear', 2, 2), ['SECTOR CLEAR', 'THE LONG HAUL', true])
  assert.equal(title('voyage', 2)[0], 'VOYAGE II')
  takeEvents(fx, world([ev('card', 'ending', 1)], 5))
  assert.equal(fx.banner.title, 'DELIVERED')
  assert.equal(fx.banner.card, true, 'the ending is the picture')
  takeEvents(fx, world([ev('bossIn', 'deafstar')], 5))
  assert.equal(fx.banner.sub, 'THE DEAF STAR', 'the second boss of sector 5 is announced too')
})

test('a banner, a pop and a shake run out on the game clock', () => {
  const fx = createFx()
  takeEvents(fx, world([ev('card', 'bonus', 1), ev('pop', 'enemy-hogs-tank', 300), ev('valve', '', 4)]))
  assert.equal(fx.banner.life, 110)
  assert.ok(active(fx.puffs) >= 3, 'the pop, the pilot in a bubble, the valve')
  assert.ok(fx.shake > 0)
  assert.equal(fx.valveT, 0)
  assert.ok(fx.words.some(w => w.active && w.text === '300'), 'a big score is written where it was made')
  const tone = fx.puffs.find(p => p.active && p.kind === 'pop').tone
  assert.equal(tone, 'hogs', 'a pop takes its gang\'s colours')
  for (let i = 0; i < 110; i++) stepFx(fx)
  assert.equal(fx.banner.life, 0)
  assert.equal(active(fx.puffs), 0)
  assert.equal(fx.shake, 0)
  assert.equal(active(fx.words), 0)
})

test('a pop that is not the player\'s leaves no pilot and no score', () => {
  const fx = createFx()
  takeEvents(fx, world([ev('pop', 'enemy-noise-grunt', 0)]))
  assert.equal(active(fx.puffs), 1)
  assert.equal(active(fx.words), 0)
})

test('every pick-up has a name to float', () => {
  const fx = createFx()
  for (const id of PICKUP_IDS) {
    assert.ok(PICK_NAMES[id], id)
    resetFx(fx)
    takeEvents(fx, world([ev('pick', id)]))
    assert.ok(fx.words.some(w => w.active && w.text === PICK_NAMES[id]), id)
  }
  assert.equal(PICK_NAMES.hairspray, 'EXTRA HOLD')
})

test('two words made in the same place do not lie on each other', () => {
  const fx = createFx()
  takeEvents(fx, world([ev('pick', 'magnet'), ev('pick', 'quarter'), ev('pick', 'tube')]))
  const ys = fx.words.filter(w => w.active).map(w => w.y).sort((a, b) => a - b)
  assert.equal(ys.length, 3)
  assert.ok(ys[1] - ys[0] >= 9 && ys[2] - ys[1] >= 9, `rows at ${ys}`)
})

test('the pools never grow: a whole sector of real events', () => {
  const w = createWorld({ seed: 3, height: 400 })
  const ap = createAutopilot()
  const fx = createFx()
  const sizes = [fx.puffs.length, fx.words.length]
  let banners = 0
  let last = ''
  for (let i = 0; i < 60 * 150 && !w.over; i++) {
    step(w, autopilot(ap, w))
    takeEvents(fx, w)
    stepFx(fx)
    if (fx.banner.life > 0 && fx.banner.title !== last) { last = fx.banner.title; banners++ }
  }
  assert.deepEqual([fx.puffs.length, fx.words.length], sizes)
  assert.ok(banners >= 3, `${banners} banners in two and a half minutes`)
  jumpTo(w, { sector: 5, stage: 'ending' })
  step(w, makeInput())
  takeEvents(fx, w)
  assert.equal(fx.banner.card, true)
})

test('reset clears a run\'s leftovers; voyages are numbered in Roman', () => {
  const fx = createFx()
  takeEvents(fx, world([ev('tow', '', 1), ev('bossDown', 'knight', 1)]))
  assert.equal(fx.banner.title, 'TOW')
  resetFx(fx)
  assert.equal(fx.banner.life, 0)
  assert.equal(active(fx.puffs), 0)
  assert.equal(fx.shake, 0)
  assert.deepEqual([1, 2, 3, 4].map(roman), ['I', 'II', 'III', 'IV'])
})
