// COPILOT by script (THE ROAD, `world/lateshow.ts`): the whole chase won by the blade alone and by the stomp, played
// from the Road's start by the test's own scripted player (nothing healed, nothing placed); the moments from which a
// jump clears a pass; and what is left of a stall for a hero who stood five tiles into the screen at the honk. The
// last two set the hero and the wagon where each try starts.
//   node scripts/zelda-lab/lateshow-copilot.mjs
import { load } from '../../tests/zelda-load.mjs'
import { reelPlayer } from '../../tests/zelda-reel.mjs'

const Z = await load()
const R = Z.HERO_R
const f2 = v => v.toFixed(2)

console.log('THE ROAD, from its start (blade given; 3 hearts)')
for (const stomp of [false, true]) {
  for (const seed of [11, 1, 2]) {
    const s = Z.createGame(Z.WORLD, { seed, at: { map: 'chase1986', entry: 'start' } })
    Z.grant(s, 'sword')
    if (stomp) Z.grant(s, 'stomp')
    const P = reelPlayer(Z, s)
    P.card()
    P.idle(2)
    P.settle()
    const log = []
    // (From the screen's first move: control, less the still moment.)
    const t = P.theRoad({ stomp, log: x => log.push(x) })
    const first = log.find(l => l.mode === 'stall')
    const wounds = log.filter((l, i) => i && l.car < log[i - 1].car).map(l => `${f2(l.t)} s → ${Math.max(0, l.car)}`)
    console.log(`  ${stomp ? 'with the stomp' : 'blade only    '} seed ${String(seed).padEnd(2)}: down ${f2(t - 1.5)} s after the screen starts to move (${f2(t)} s after the words close), ${6 - s.hero.hp} half hearts lost; first stall at ${f2(first.t)} s; wounds ${wounds.join(', ')}`)
  }
}

/** A game on the Road, the screen held at its end, the hero standing `r` tiles into it, the wagon at its honk. */
function scene(r) {
  const s = Z.createGame(Z.WORLD, { seed: 3, at: { map: 'chase1986', entry: 'start' } })
  s.inv.sword = true
  s.inv.stomp = true
  s.flags['lateshow.copilot.card'] = true
  Z.enterMap(Z.WORLD, s, 'chase1986', 'start', [], { x: 48 + r, y: 21 - R - 1e-4 })
  delete s.card
  Object.assign(s.map.chase, { left: 48, wait: 0 })
  const car = s.map.enemies[0]
  Object.assign(car.ai, { mode: 'honk', t: Z.COPILOT.honk, r: Z.COPILOT.off })
  const step = (o = {}) => Z.stepGame(Z.WORLD, s, 1 / 120, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o })
  for (let i = 0; i < 2; i++) step()
  return { s, car, step, feet: () => s.hero.y + R }
}

console.log('\nA JUMP OVER THE PASS (screen held, hero standing; B pressed d ms after the pass begins, - before it)')
for (const r of [3, 5, 8]) {
  for (const [name, held] of [['tapped', false], ['held  ', true]]) {
    const ok = []
    for (let d = -60; d <= 120; d++) {
      const P = scene(r)
      let since = null
      let pressed = false
      // d is in steps of 1/120 s from the pass's first step.
      const start = Math.round(Z.COPILOT.honk * 120) - 2
      for (let i = 0; i < start + 360; i++) {
        since = i - start
        const press = !pressed && since >= d
        if (press) pressed = true
        P.step({ ...(press ? { bPress: true, jumpPress: true, jumpHeld: true } : {}), ...(pressed && held ? { jumpHeld: true } : {}) })
      }
      if (P.s.hero.hp === 6) ok.push(d)
    }
    const runs = []
    for (const d of ok) { if (runs.length && d === runs.at(-1)[1] + 1) runs.at(-1)[1] = d; else runs.push([d, d]) }
    console.log(`  ${name} at r ${r}: clear for ${runs.map(([a, b]) => `${Math.round(a / 0.12)}..${Math.round(b / 0.12)} ms (${Math.round((b - a + 1) / 0.12)} ms wide)`).join(', ') || 'never'}`)
  }
}
{
  const P = scene(5)
  for (let i = 0; i < 360; i++) P.step()
  console.log(`  a hero who only stands: ${6 - P.s.hero.hp} half hearts for one pass`)
}

console.log(`\nTHE STALL (${Z.COPILOT.stall} s): a hero standing at r 5 at the honk jumps the pass, runs up and cuts`)
for (const [name, held] of [['a tapped jump', false], ['a held jump  ', true]]) {
  const P = scene(5)
  const { s, car, step } = P
  let stall = null
  let last = null
  let t = 0
  let jumped = false
  const wounds = []
  for (let i = 0; i < 1200 && car.hp > 4; i++, t = i / 120) {
    const mode = car.ai.mode
    if (mode === 'stall') stall ??= t
    const h = s.hero
    const dx = car.x - h.x
    const meets = mode === 'pass' && !jumped && dx < 0 && (-dx - 0.95) / 11 < (held ? 0.2 : 0.12)
    if (meets) jumped = true
    const a = mode === 'stall' && Math.abs(dx) < 2.1 && car.invuln <= 0.04 && i % 4 === 0
    const want = mode === 'stall' ? car.x - 1.1 : h.x
    const move = mode !== 'stall' ? 0 : a ? Math.sign(dx) : Math.abs(want - h.x) < 0.2 ? 0 : Math.sign(want - h.x)
    const hp = car.hp
    step({ move: { x: move, y: 0 }, ...(meets ? { bPress: true, jumpPress: true, jumpHeld: true } : {}), ...(jumped && held && !h.side?.ground ? { jumpHeld: true } : {}), ...(a ? { aPress: true, a: true } : {}) })
    if (car.hp < hp) { wounds.push(`${hp - car.hp} at ${f2(t - stall)} s`); last = t - stall }
  }
  console.log(`  ${name}: ${8 - car.hp} taken (${wounds.join(', ')}); the last ${f2(Z.COPILOT.stall - last)} s before the stall ends; hearts lost ${6 - s.hero.hp}`)
}
