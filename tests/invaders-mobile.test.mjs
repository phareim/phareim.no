import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

// Exercise the actual game loop and event handlers, without mounting a renderer.
// The Hangar ship is stubbed (imports are stripped above); calls are counted
// to prove startGame re-reads the pick.
const shipCalls = { n: 0 }
const dartDef = () => ({
  id: 'dart', variant: 'dart',
  colors: { hull: '#2ff3ff', trim: '#2ff3ff', glow: '#2ff3ff', cockpit: '#ffffff' },
})
const source = readFileSync(new URL('../themes/invaders/Invaders.vue', import.meta.url), 'utf8')
  .split('<script setup>')[1].split('</script>')[0].replace(/^import .*$/gm, '')
// The game plays sounds through the shared useSound() composable (a Nuxt
// auto-import, stripped above with the other imports). Stub it as silent.
const noop = () => {}
const stubSound = () => ({
  unlock: noop,
  sfx: new Proxy({}, { get: () => noop }),
  music: { start: noop, stop: noop, playing: false },
})
function game(width = 375, height = 667) {
  const context = vm.createContext({
    ref: () => ({ value: null }), defineEmits: () => () => {},
    onMounted: () => {}, onBeforeUnmount: () => {}, performance: { now: () => 100 },
    readShipDef: () => { shipCalls.n++; return dartDef() },
    useSound: stubSound,
  })
  vm.runInContext(source, context)
  const run = code => vm.runInContext(code, context)
  run(`buildFxCache = () => {}; SW = ${width}; SH = ${height}; layout(); startGame(); bombAcc = 999; ufoTimer = 999;`)
  return run
}
const touch = (id, x, y = 620) => `({identifier:${id},clientX:${x},clientY:${y}})`
const event = t => `({target:null,changedTouches:[${t}],preventDefault(){}})`

test('phone sprites are larger and leave room for the formation, bunkers and finger', () => {
  for (const width of [320, 375, 390, 430]) {
    const run = game(width)
    assert.equal(run('cols'), 5)
    assert.ok(run('px * 8') >= 24)
    assert.ok(run('formW + margin * 2 < SW'))
    assert.ok(run('fy + formH + cellH < bunkerTop()'))
    assert.ok(run('cannonY + px * 4 < SH - 70'))
  }
  const desktop = game(1440, 900)
  assert.equal(desktop('cols'), 11)
  assert.equal(desktop('px'), 5)
  const landscape = game(667, 375)
  assert.ok(landscape('fy + formH < bunkerTop()'))
  assert.ok(landscape('bunkerTop() + bunkers[0].h < cannonY - px * 4'))
  assert.ok(landscape('cannonY + px * 4 < SH - 40'))
})

test('holding a still finger keeps firing, with only one bolt at a time', () => {
  const run = game()
  run('bunkers = []')
  run(`handleTouchStart(${event(touch(1, 290))}); updateGame(.016, 1)`)
  assert.equal(run('cannonX'), 290)
  assert.equal(run('shot.x'), 290)
  run('const firstShot = shot; updateGame(.016, 1.016)')
  assert.equal(run('shot === firstShot'), true)
  run('shot = null; updateGame(.016, 1.032)')
  assert.equal(run('shot !== null && shot !== firstShot'), true)
  run(`handleTouchEnd(${event(touch(1, 290))}); shot = null; updateGame(.016, 1.048)`)
  assert.equal(run('shot'), null)
})

test('finger movement is direct and a second finger cannot steal or release control', () => {
  const run = game()
  run(`handleTouchStart(${event(touch(1, 80))}); handleTouchStart(${event(touch(2, 310))}); handleTouchEnd(${event(touch(2, 310))})`)
  assert.equal(run('touchActive'), true)
  run(`handleTouchMove(${event(touch(1, 290))}); updateGame(.016, 1)`)
  assert.equal(run('cannonX'), 290)
  run(`handleTouchCancel(${event(touch(1, 290))}); shot = null; updateGame(.016, 1.016)`)
  assert.equal(run('touchActive'), false)
  assert.equal(run('shot'), null)
})

test('idle swipe does not start a game, tap does, and blur clears held input', () => {
  const run = game()
  run(`startDemo(); handleTouchStart(${event(touch(1, 60))}); handleTouchEnd(${event(touch(1, 290))})`)
  assert.equal(run('gameStarted'), false)
  run(`handleTouchStart(${event(touch(2, 160))}); handleTouchEnd(${event(touch(2, 160))})`)
  assert.equal(run('gameStarted'), true)
  run(`handleTouchStart(${event(touch(3, 160))}); keys.ArrowRight = true; clearInput()`)
  assert.equal(run('touchActive || !!keys.ArrowRight'), false)
})

test('a slow frame hits the first invader crossed instead of skipping or killing through it', () => {
  const run = game()
  run(`bunkers = []; const target = invaderRect(4, 2);
    shot = {x: target.x + target.w / 2, y: target.y + target.h + 1};
    updateShot(.2, 1)`)
  assert.equal(run('alive[4][2]'), false)
  assert.equal(run('alive[3][2]'), true)
  assert.equal(run('aliveCount'), 24)
})

test('shots cannot skip a thin bunker remnant between frames', () => {
  const run = game()
  run(`bunkers = [{x:100,y:400,w:2,h:2,cell:2,gw:1,gh:1,grid:new Uint8Array([1])}];
    shot = {x:101,y:410}; updateShot(.05,1)`)
  assert.equal(run('shot'), null)
  assert.equal(run('bunkers[0].grid[0]'), 0)
})

test('a bomb crossing the cannon on a slow frame still costs a life', () => {
  const run = game()
  run(`bunkers = []; bombs = [{x:cannonX,y:cannonY-30,v:1200,t:0,style:'plunger'}]; updateBombs(.05, 1)`)
  assert.equal(run('lives'), run('LIVES') - 1)
  assert.equal(run('bombs.length'), 0)
})

test('direct steering keeps the entire enlarged cannon inside the viewport', () => {
  const run = game()
  run(`handleTouchStart(${event(touch(1, 0))}); updateGame(.016,1)`)
  assert.ok(run('cannonRect().x >= 0'))
  run(`handleTouchMove(${event(touch(1, 375))}); updateGame(.016,1.016)`)
  assert.ok(run('cannonRect().x + cannonRect().w <= SW'))
})

test('gold pickups alternate, collect on swept contact, expire and reset on death', () => {
  const run = game()
  run('dropPickup(cannonX, cannonY - 50); dropPickup(30, 100)')
  assert.equal(run('pickups[0].kind'), 'pierce')
  assert.equal(run('pickups[1].kind'), 'blast')
  run('updateWeapons(.5)')
  assert.equal(run('weapon'), 'pierce')
  run('updateWeapons(12)')
  assert.equal(run('weapon'), null)
  run("weapon = 'blast'; weaponTime = 12; onCannonHit(2)")
  assert.equal(run('weapon'), null)
  assert.equal(run('pickups.length'), 0)
})

test('piercing bolt crosses multiple rows; blast kills neighbors and clears nearby bombs', () => {
  const run = game()
  run(`bunkers = []; const target = invaderRect(4, 2);
    shot = {x:target.x + target.w / 2, y:target.y + target.h + 1, weapon:'pierce'};
    updateShot(.12, 1)`)
  assert.equal(run('alive[4][2]'), false)
  assert.equal(run('alive[3][2]'), false)
  run(`startGame(); bunkers = []; const target2 = invaderRect(4, 2);
    bombs = [{x:target2.x,y:target2.y}];
    shot = {x:target2.x + target2.w / 2,y:target2.y + target2.h + 1,weapon:'blast'};
    updateShot(.02, 2)`)
  assert.equal(run('alive[4][1] || alive[4][2] || alive[4][3]'), false)
  assert.equal(run('bombs.length'), 0)
  assert.ok(run('shockwaves.length > 3'))
})

test('held keyboard fires and pause or wave transition blocks new bolts', () => {
  const run = game()
  run('keys.Space = true; updateGame(.016, 1)')
  assert.ok(run('shot'))
  run('shot = null; paused.value = true; fire()')
  assert.equal(run('shot'), null)
  run('paused.value = false; wavePause = 1; fire()')
  assert.equal(run('shot'), null)
})

test('cannon flies the Hangar ship, re-read on every start', () => {
  const before = shipCalls.n
  const run = game()
  assert.equal(run('shipDef.colors.hull'), '#2ff3ff')
  assert.equal(shipCalls.n, before + 2) // once at setup, once in startGame
  run('startGame()')
  assert.equal(shipCalls.n, before + 3)
  // A full update loop runs clean on the stubbed ship.
  run('update(100)')
  assert.equal(run('shipDef.variant'), 'dart')
})

test('blast wave clear happens once and restarts without a stale bolt', () => {
  const run = game()
  run(`for(let r=0;r<ROWS;r++) for(let c=0;c<cols;c++) alive[r][c] = r===4 && c===2;
    aliveCount=1; bunkers=[]; const finalTarget=invaderRect(4,2);
    shot={x:finalTarget.x+finalTarget.w/2,y:finalTarget.y+finalTarget.h+1,weapon:'blast'};
    updateShot(.02,1)`)
  assert.equal(run('aliveCount'), 0)
  assert.equal(run('shot'), null)
  assert.equal(run('wavePause'), 1.3)
  run('updateGame(1.4,2.4)')
  assert.equal(run('wave'), 2)
  assert.equal(run('aliveCount'), 25)
})
