import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
// The Hangar ship, stubbed: imports are stripped above, so the game reads
// the pick through this. Counts calls to prove resetGame re-reads it.
const shipCalls = { n: 0 }
const dartDef = () => ({
  id: 'dart', variant: 'dart',
  colors: { hull: '#2ff3ff', trim: '#2ff3ff', glow: '#2ff3ff', cockpit: '#ffffff' },
})
const vandalDef = () => ({
  id: 'vandal', variant: 'vandal',
  colors: { hull: '#ffd23f', trim: '#ff2fa0', glow: '#ffd23f', cockpit: '#ffffff' },
})
/** A canvas 2D context that absorbs every call — enough to run draw fns. */
function absorbCtx() {
  const fn = new Proxy(function () {}, {
    get: (t, p) => (p === Symbol.toPrimitive ? () => 0 : absorbCtx()),
    set: () => true,
    apply: () => absorbCtx(),
  })
  return fn
}
const source = readFileSync(new URL('../themes/rtype/Shooter.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
// The game plays sounds through the shared useSound() composable (a Nuxt
// auto-import, stripped above with the other imports). Stub it as silent.
const noop = () => {}
const stubSound = () => ({
  unlock: noop,
  sfx: new Proxy({}, { get: () => noop }),
  music: { start: noop, stop: noop, playing: false },
})
function game() {
  const context = vm.createContext({ ref: value => ({ value }), defineEmits: () => () => {}, onMounted() {}, onBeforeUnmount() {}, performance: { now: () => 1000 },
    readShipDef: () => { shipCalls.n++; return dartDef() }, __absorbCtx: absorbCtx, useSound: stubSound })
  vm.runInContext(source, context)
  const run = code => vm.runInContext(code, context)
  run('canvas.value = {}; W = 900; H = 375; resetGame(); spawnT = nextBossAt = 1e9; invulnUntil = 1e9')
  return run
}
test('six drops cycle through all weapons; collecting stacks slots, replaces variants, and expires', () => {
  const run = game()
  for (let i = 0; i < 6; i++) {
    run('dropPickup(500, 180); pickups[0].x = ship.x; pickups[0].y = ship.y; updatePowerups(.01, 0)')
    assert.ok(run(`upgrades[POWERUPS[${i}].slot].mode === POWERUPS[${i}].mode`))
  }
  assert.ok(run('Object.values(upgrades).every(Boolean)'))
  run('pickupTimer = 100; updatePowerups(21, 0)')
  assert.ok(run('Object.values(upgrades).every(u => u === null)'))
})
test('spread, twin pod and seeker produce distinct shots; beam variants affect charge and width', () => {
  const run = game()
  run("upgrades.gun = {mode:'spread'}; upgrades.force = {mode:'twin'}; force.attached = false; shootVolley()")
  assert.equal(run('bullets.length'), 5)
  assert.equal(run('bullets.filter(b => Math.abs(b.vy) === 180).length'), 2)
  run("bullets = []; upgrades.force = {mode:'seeker'}; shootVolley()")
  assert.equal(run('bullets.filter(b => b.seeker).length'), 1)
  run("upgrades.beam = {mode:'wide'}; fireBeam()")
  assert.equal(run('beams[0].width'), 95)
  assert.equal(run('beams[0].damage'), 6)
  run("upgrades.beam = {mode:'quick'}")
  assert.equal(run('chargeTime()'), .4)
})
test('rapid fire increases rate; seeking shots steer; wide beam damages distant lanes', () => {
  const run = game()
  run("upgrades.gun = {mode:'rapid',time:20}; keyFire = true; force.attached = false; lastTime = 1000; update(1050); update(1100)")
  assert.equal(run('bullets.length'), 1)
  run("keyFire = false; bullets = [{x:200,y:150,vx:780,vy:0,seeker:true}]; enemies = [{kind:'hex',x:500,y:220,size:19,hp:20,t:0,vx:0,score:100}]; update(1150)")
  assert.ok(run('bullets[0].vy > 0'))
  run("bullets = []; beams = [{x:450,y:145,vx:0,life:1,t:0,width:95,damage:6}]; update(1200)")
  assert.equal(run('enemies[0].hp'), 14)
})
test('death and restart reset upgrades; paused input cannot fire or launch pod', () => {
  const run = game()
  run("upgrades.gun = {mode:'rapid',time:20}; invulnUntil = 0; onShipHit(10)")
  assert.equal(run('upgrades.gun'), null)
  run("resetGame(); paused.value = true; fireOnce(); toggleForce()")
  assert.equal(run('bullets.length'), 0)
  assert.equal(run('force.attached'), true)
})
test('picks up the Hangar ship on every reset and draws both variants', () => {
  const before = shipCalls.n
  const run = game()
  assert.equal(run('shipDef.variant'), 'dart')
  assert.equal(shipCalls.n, before + 2) // once at setup, once in resetGame
  // Both silhouettes draw without a canvas behind them.
  run('ctx = __absorbCtx(); ship.x = 200; ship.y = 180; invulnUntil = 0; drawShip(2000); drawForce()')
  run(`shipDef = (${vandalDef.toString()})(); drawShip(2000); drawForce()`)
  assert.equal(run('shipDef.variant'), 'vandal')
  run('resetGame()')
  assert.equal(run('shipDef.variant'), 'dart')
  assert.equal(shipCalls.n, before + 3)
})

test('angular wall collision matches interpolated edges across viewport sizes and scrolling', () => {
  const run = game()
  for (const h of [320,375,900]) {
    run(`H = ${h}; elapsed = 160; scrollX = 1273`)
    for (let x = 0; x <= 900; x += 13) {
      assert.ok(run(`ceilYAt(${x}) < floorYAt(${x}) - H * .25`))
      assert.ok(run(`insideTerrain(${x}, ceilYAt(${x}) - 1, 0)`))
      assert.ok(run(`!insideTerrain(${x}, (ceilYAt(${x}) + floorYAt(${x})) / 2, 9)`))
    }
  }
})
