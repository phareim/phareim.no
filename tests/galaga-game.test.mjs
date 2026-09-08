import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const source = readFileSync(new URL('../themes/galaga/Galaga.vue', import.meta.url), 'utf8')
  .split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
function game(w = 375, h = 667) {
  const context = vm.createContext({ ref: value => ({ value }), defineEmits: () => () => {},
    onMounted() {}, onBeforeUnmount() {}, performance: { now: () => 100 } })
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
    assert.ok(run('bosses[0].size > 140 && bosses[0].hp === 18'))
    assert.ok(run(`bosses[0].x - bosses[0].size * .56 > 0 && bosses[0].x + bosses[0].size * .56 < ${w}`))
    assert.ok(run(`bosses[0].y - bosses[0].size * .5 - 10 > 0 && bosses[0].y + bosses[0].size * .4 < ${h} * .65`))
    assert.equal(run('enemyBullets.length'), 2)
    assert.ok(run('enemyBullets[0].x < bosses[0].x && enemyBullets[1].x > bosses[0].x'))
  }
})

test('mesh passes beneath idle screen, recycles, and stops under reduced motion', () => {
  const run = game()
  run('initStars(); initBgShapes(); gameStarted = false; const y = bgShapes[0].y; updateBackdrop()')
  assert.ok(run('bgShapes[0].y > y'))
  assert.ok(run('bgShapes.every(s => s.faces.length === 27 && s.vertices.length === 19)'))
  run('bgShapes.forEach(s => s.y = 2000); updateBackdrop()')
  assert.equal(run('bgShapes.length'), 6)
  run('reducedMotion = true; const still = JSON.stringify([stars,bgShapes]); updateBackdrop()')
  assert.ok(run('JSON.stringify([stars,bgShapes]) === still'))
})
