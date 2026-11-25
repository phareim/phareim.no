// Space Voyagers under a weaker autopilot: a soak (ten game minutes at each
// height, no NaN, counts bounded, the field's edges kept). The whole voyage
// through the ending into VOYAGE II is flown in galaga-script.test.mjs, on the
// radio. How hard the voyage is for the three autopilot profiles, seed by seed,
// is the lab's tuning table (scripts/galaga-lab/tune.mjs), not a test.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createWorld, step, POOL, playerTop } from '../themes/galaga/engine/index.ts'
import { createAutopilot, autopilot, CASUAL } from '../themes/galaga/engine/autopilot.ts'
import { FIELD, PLAYER, difficulty, bossHp, boltSpeed } from '../themes/galaga/engine/balance.ts'

const SOAK = 10 * 60 * 60

for (const height of [320, 432]) {
  test(`soak at ${height}: ten game minutes, no NaN, bounded counts, edges kept`, () => {
    let ticks = 0
    let seed = 100 + height
    let most = 0
    while (ticks < SOAK) {
      const w = createWorld({ seed: seed++, height })
      const ap = createAutopilot(CASUAL)
      while (!w.over && ticks < SOAK) {
        step(w, autopilot(ap, w))
        ticks++
        const p = w.player
        const q = w.partner
        assert.ok(p.x >= PLAYER.marginX && p.x <= FIELD.w - PLAYER.marginX, `player x ${p.x}`)
        assert.ok(p.y >= playerTop(w) && p.y <= height - PLAYER.marginBottom, `player y ${p.y}`)
        assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y) && q.x >= 0 && q.x <= FIELD.w, `partner ${q.x},${q.y}`)
        assert.ok(Number.isFinite(w.score) && w.score >= 0)
        assert.ok(p.hull >= 0 && p.hull <= PLAYER.hull && p.level >= 1 && p.level <= 5)
        assert.ok(w.events.length < 160, `${w.events.length} events in a tick`)
        most = Math.max(most, w.events.length)
        if (ticks % 7 !== 0) continue
        let n = 0
        for (const pool of [w.enemies, w.shots, w.bolts, w.zones, w.pickups, w.rigs]) {
          for (const e of pool) {
            if (!e.active) continue
            n++
            assert.ok(Number.isFinite(e.x) && Number.isFinite(e.y), `a ${e.kind} at ${e.x},${e.y}`)
            // A convoy's rigs queue below the field before they come up: three of them are 500 px long.
            const below = pool === w.rigs ? 600 : 200
            assert.ok(e.x > -80 && e.x < FIELD.w + 80 && e.y > -200 && e.y < height + below, `a ${e.kind} far outside at ${e.x},${e.y}`)
          }
        }
        for (const k of w.pickups) if (k.active) assert.ok(k.x >= 8 && k.x <= FIELD.w - 8, 'a pick-up can be reached')
        assert.ok(n <= POOL.enemies + POOL.shots + POOL.bolts + POOL.zones + POOL.pickups + POOL.rigs)
        if (w.boss.active) assert.ok(Number.isFinite(w.boss.hp) && Number.isFinite(w.boss.x) && Number.isFinite(w.boss.y))
      }
    }
    assert.equal(ticks, SOAK)
    assert.ok(most > 0)
  })
}

test('VOYAGE II is harder: quicker to shoot, faster bolts, more boss hull', () => {
  assert.ok(difficulty(1, 2) > difficulty(1, 1))
  assert.ok(boltSpeed(difficulty(1, 2)) > boltSpeed(difficulty(1, 1)))
  assert.ok(bossHp('knight', 2) > bossHp('knight', 1))
})
