import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import * as balance from '../themes/galaga/balance.ts'
import { TRACK_NAMES } from '../themes/galaga/audio.ts'

// The Hangar ship, stubbed: imports are stripped above, so the game reads
// the pick through this. Counts calls to prove resetGame re-reads it.
const shipCalls = { n: 0 }
const dartDef = () => ({
  id: 'dart', variant: 'dart',
  colors: { hull: '#2ff3ff', trim: '#2ff3ff', glow: '#2ff3ff', cockpit: '#ffffff' },
})
const audioStub = () => ({
  start: () => true,
  playTrack() {}, stopTrack() {}, fadeMusic() {},
  setIntensity() {}, suspend() {}, dispose() {}, play() {},
  trackIndex: 0,
})
const source = readFileSync(new URL('../themes/galaga/Galaga.vue', import.meta.url), 'utf8')
  .split('<script setup>')[1].split('</script>')[0]
  .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]*['"]/g, '')
  .replace(/^import .*$/gm, '')
function game(w = 375, h = 667) {
  const context = vm.createContext({ ref: value => ({ value }), defineEmits: () => () => {},
    onMounted() {}, onBeforeUnmount() {}, performance: { now: () => 100 },
    readShipDef: () => { shipCalls.n++; return dartDef() },
    createGalagaAudio: audioStub, TRACK_NAMES,
    ...balance })
  vm.runInContext(source, context)
  const run = code => vm.runInContext(code, context)
  run(`canvas.value = {width:${w},height:${h}}; resetGame(); waveTimer = bossTimer = powerupTimer = 1e9`)
  return run
}

test('side squadrons enter from both edges, preserve spacing and leave the field', () => {
  for (const pattern of [1, 2]) {
    const run = game()
    run(`waveNumber = ${pattern}; spawnWave()`)
    assert.ok(run(pattern === 1 ? 'enemies.every(e => e.x < 0)' : 'enemies.every(e => e.x > 375)'))
    run('for (let i = 0; i < 100; i++) update(100)')
    assert.ok(run('enemies.some(e => e.x > 0 && e.x < 375)'))
    assert.equal(run('Math.round(Math.abs(enemies[0].x - enemies[1].x))'), 44)
    run('for (let i = 0; i < 500; i++) update(100)')
    assert.equal(run('enemies.length'), 0)
  }
})

test('armoured ships take three hits and award their score only on destruction', () => {
  const run = game()
  run('waveNumber = 3; spawnWave(); enemies = [enemies[0]]; enemies[0].x = 180; enemies[0].y = 180')
  assert.equal(run('enemies[0].size'), 52)
  for (let hit = 1; hit <= 3; hit++) {
    run('bullets.push({x:enemies[0].x,y:enemies[0].y,vy:0}); update(100)')
    assert.equal(run('bullets.length'), 0)
    assert.equal(run('score'), hit === 3 ? 250 : 0)
    assert.equal(run('enemies.length'), hit === 3 ? 0 : 1)
  }
})

test('larger bosses fit phone and desktop bounds and fire from both gun ports', () => {
  for (const [w, h] of [[320,568],[375,667],[667,375],[1440,900]]) {
    const run = game(w,h)
    run('spawnBoss(); bosses[0].arrived = true; bosses[0].y = bosses[0].targetY; bosses[0].lastShot = -10000; update(100)')
    assert.ok(run('bosses[0].size > 140 && bosses[0].hp === 24'))
    assert.ok(run(`bosses[0].x - bosses[0].size * .56 > 0 && bosses[0].x + bosses[0].size * .56 < ${w}`))
    assert.ok(run(`bosses[0].y - bosses[0].size * .5 - 10 > 0 && bosses[0].y + bosses[0].size * .4 < ${h} * .65`))
    assert.equal(run('enemyBullets.length'), 2)
    assert.ok(run('enemyBullets[0].x < bosses[0].x && enemyBullets[1].x > bosses[0].x'))
  }
})

test('picks up the Hangar ship on every reset', () => {
  const before = shipCalls.n
  const run = game()
  assert.ok(run('shipDef.variant') === 'dart')
  assert.ok(run('shipDef.colors.hull') === '#2ff3ff')
  assert.equal(shipCalls.n, before + 2) // once at setup, once in resetGame
  run('resetGame()')
  assert.equal(shipCalls.n, before + 3)
})

test('mesh passes beneath idle screen, recycles, and stops under reduced motion', () => {
  const run = game()
  run('initStars(); initBgShapes(); gameStarted=false; const y = bgShapes[0].y; updateBackdrop()')
  assert.ok(run('bgShapes[0].y > y'))
  assert.ok(run('bgShapes.every(s => s.faces.length === 27 && s.vertices.length === 19)'))
  run('bgShapes.forEach(s => s.y = 2000); updateBackdrop()')
  assert.equal(run('bgShapes.length'), 6)
  run('reducedMotion = true; const still = JSON.stringify([stars,bgShapes]); updateBackdrop()')
  assert.ok(run('JSON.stringify([stars,bgShapes]) === still'))
})

test('hull absorbs five hits with downgrade and invulnerability', () => {
  const run = game()
  assert.equal(run('hull'), 5)
  run('bulletLevel = 3; hitPlayer(100, "bolt")')
  assert.equal(run('hull'), 4)
  assert.equal(run('bulletLevel'), 2)
  // Inside the invulnerability window the hit is ignored.
  run('hitPlayer(200, "bolt")')
  assert.equal(run('hull'), 4)
  run('hitPlayer(2000, "bolt")')
  assert.equal(run('hull'), 3)
  // The fifth segment ends the run through the normal death path.
  run('hull = 1; invulnUntil = 0; hitPlayer(5000, "ram")')
  assert.equal(run('hull'), 0)
  assert.equal(run('gameOver'), true)
})

test('escort is sacrificed before the hull, even against a ram', () => {
  const run = game()
  run('dualTimer = 10; hitPlayer(100, "ram")')
  assert.equal(run('dualTimer'), 0)
  assert.equal(run('hull'), 5)
  assert.equal(run('gameOver'), false)
})

test('shield heals first, then guards, then feeds the fan', () => {
  const run = game()
  run('hull = 3; applyPowerup("shield", 100)')
  assert.equal(run('hull'), 4)
  assert.equal(run('shield'), false)
  run('hull = 5; shield = false; aegis = 0; bulletLevel = 1; applyPowerup("shield", 100)')
  assert.equal(run('shield'), true)
  run('applyPowerup("aegis", 100)')
  assert.equal(run('aegis'), 2)
  assert.equal(run('shield'), false)
})

test('divers/weavers and snipers spawn on their patterns', () => {
  const run = game()
  run('waveNumber = 4; spawnWave()')
  assert.ok(run('enemies.some(e => e.kind === "diver")'))
  assert.ok(run('enemies.some(e => e.kind === "weaver")'))
  const run2 = game()
  run2('waveNumber = 5; spawnWave()')
  assert.ok(run2('enemies.length >= 1 && enemies.every(e => e.kind === "sniper")'))
})

test('splitters pop into two mites on destruction', () => {
  const run = game()
  run(`enemies = [makeEnemy({kind:'splitter',x:180,y:180,vx:0,vy:0,size:40,color:'#ff70bc',shapeIdx:5,movementType:'straight',hp:1,maxHp:2,shootCooldown:1e9,lastShot:100,shootChance:0})]; killEnemy(0, 100)`)
  assert.equal(run('enemies.length'), 2)
  assert.ok(run('enemies.every(e => e.kind === "mite")'))
  assert.equal(run('score'), 200)
})

test('soak: three minutes of autopilot play stay coherent', () => {
  const run = game()
  run('waveTimer = 0; bossTimer = 0; powerupTimer = 0; keys["Space"] = true')
  run(`for (let i = 0; i < 5000; i++) { update(100 + i * 36); if (gameOver) { for (let j = 0; j < 60; j++) update(100 + i * 36 + j); break } }`)
  assert.ok(run('waveNumber') > 10)
  assert.ok(run('bossNum') >= 1)
  assert.ok(run('score') >= 0)
  assert.ok(run('hull') >= 0 && run('hull') <= 5)
  assert.ok(run('particles.length') <= 300)
  assert.ok(run('powerups.length') <= 3)
  assert.ok(run('bullets.length') < 200)
})

test('powerup letters cover every capsule type', () => {
  const run = game()
  assert.equal(run('JSON.stringify(["shield","weapon","dual","rear","aegis","tempo","nova","magnet","combo"].map(t => POWERUP_LETTERS[t]))'),
    JSON.stringify(['S', 'P', 'D', 'R', 'A', 'T', 'N', 'M', 'C']))
})

test('combo rings do not kill', () => {
  const run = game()
  run(`enemies = [
    makeEnemy({kind:'bulwark', x:180, y:300, vx:0, vy:0, size:56, color:'#ff70bc', shapeIdx:2, movementType:'straight', hp:5, maxHp:5, shootCooldown:1e9, lastShot:100, shootChance:0}),
    makeEnemy({kind:'bulwark', x:180, y:300, vx:0, vy:0, size:56, color:'#ff70bc', shapeIdx:2, movementType:'straight', hp:5, maxHp:5, shootCooldown:1e9, lastShot:100, shootChance:0})
  ]`)
  run('registerKill(100); registerKill(100); registerKill(100)')
  assert.equal(run('shockwaves.length'), 1)
  assert.equal(run('shockwaves[0].lethal'), false)
  run('for (let i = 0; i < 20; i++) update(100)')
  assert.equal(run('enemies.length'), 2)
  assert.equal(run('hull'), 5)
})

test('nova kills a boss with bounty and heal', () => {
  const run = game()
  run('spawnBoss(); bosses[0].hp = 4; hull = 3; applyPowerup("nova", 100); update(200)')
  assert.equal(run('bosses.length'), 0)
  assert.ok(run('score') > 0)
  assert.equal(run('hull'), balance.heal(3, balance.HEAL_BOSS))
})

test('rams during invulnerability are not free kills', () => {
  const run = game()
  run(`invulnUntil = 1e9; enemies = [makeEnemy({kind:'heavy', x:player.x, y:player.y, vx:0, vy:0, size:52, color:'#ff70bc', shapeIdx:3, movementType:'straight', hp:3, maxHp:3, shootCooldown:1e9, lastShot:100, shootChance:0})]`)
  run('update(100)')
  assert.equal(run('enemies.length'), 1)
  assert.equal(run('score'), 0)
})

test('rammed splitter splits', () => {
  const run = game()
  run(`invulnUntil = 0; dualTimer = 0; hull = 5; enemies = [makeEnemy({kind:'splitter', x:player.x, y:player.y, vx:0, vy:0, size:40, color:'#ff70bc', shapeIdx:5, movementType:'straight', hp:2, maxHp:2, shootCooldown:1e9, lastShot:100, shootChance:0})]`)
  run('update(100)')
  assert.equal(run("enemies.filter(e => e.kind === 'mite').length"), 2)
  assert.ok(run('score') > 0)
  assert.equal(run('hull'), 4)
})

test('formation enemies do not jump when tempo changes', () => {
  const run = game()
  run('waveNumber = 1; spawnWave()')
  run('for (let i = 0; i < 100; i++) update(100)')
  const before = run('enemies[0].x')
  run('tempoTimer = 10')
  run('update(100)')
  const after = run('enemies[0].x')
  assert.ok(Math.abs(after - before) < 10)
})

test('shooting roll is gated per cooldown', () => {
  const run = game()
  run('Math.random = () => 0.99')
  run(`enemies = Array.from({length:5}, (_, i) => makeEnemy({
    kind:'scout', x: 60 + i * 60, y:300, vx:0, vy:0, size:30, color:'#ff2fa0', shapeIdx:0,
    movementType:'straight', hp:1, maxHp:1,
    shootChance:0.5, lastShot:-1e9, shootCooldown:500
  }))`)
  run('update(100); update(100); update(100)')
  assert.equal(run('enemyBullets.length'), 0)
})
