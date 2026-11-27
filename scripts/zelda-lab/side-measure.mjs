// Measures the side view's jump as built, by playing it in small rooms made here: heights held and tapped, the time
// to the top, the fall, how far it carries, which gaps and ledges it clears, and the coyote and buffer windows with
// keys and with a thumb. Nothing is read from the engine's constants but the fall cap, for comparison.
//   node scripts/zelda-lab/side-measure.mjs
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = esbuild.buildSync({
  stdin: { contents: `export * from './engine/index'; export * from './types'`, resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))

const W = 40
const H = 16
const FLOOR = 12
const R = Z.HERO_R
const DT = Z.STEP
const ms = steps => Math.round(steps * DT * 1000)
const two = v => v.toFixed(2)

/** A room whose floor's top is row FLOOR, changed by `edit(grid)`; the hero stands at (x, row). */
function room(x, row = FLOOR, edit = () => {}) {
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, cx) => (cx === 0 || cx === W - 1 || y === 0 || y >= FLOOR ? '#' : '.')))
  edit(g)
  const def = { id: 'm', name: 'M', kind: 'side', track: 'dungeon', cell: { w: W, h: H }, rows: g.map(r => r.join('')), marks: {}, entries: { a: { x, y: row - R, dir: 'right' } } }
  const world = { maps: { m: def }, start: { map: 'm', entry: 'a' } }
  const s = Z.createGame(world, { seed: 1 })
  const P = {
    s,
    step(o = {}) { return Z.stepGame(world, s, DT, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o }) },
    idle(n = 60) { for (let i = 0; i < n; i++) P.step() },
    get feet() { return s.hero.y + R },
    get ground() { return !!s.hero.side?.ground },
  }
  P.idle()
  s.hero.x = x
  P.idle(2)
  return P
}
const press = (move, autoFace = false) => ({ move: { x: move, y: 0 }, bPress: true, jumpPress: true, jumpHeld: true, autoFace })

/**
 * Jump once: the button held `hold` steps (Infinity: to the end), the stick at `move`. What it rose, when it was at
 * its top, when it landed, how far it went and how fast it fell.
 */
function jump(P, { hold = Infinity, move = 0, touch = false, max = 600 } = {}) {
  const x0 = P.s.hero.x
  const y0 = P.feet
  let top = y0, topAt = 0, fastest = 0, i = 0
  P.step(press(move, touch))
  for (i = 1; i < max; i++) {
    if (P.feet < top) { top = P.feet; topAt = i }
    fastest = Math.max(fastest, P.s.hero.side.vy)
    if (P.ground || P.s.hero.act === 'fall') break
    P.step({ move: { x: move, y: 0 }, jumpHeld: i < hold, autoFace: touch })
  }
  return { rise: y0 - top, topAt: ms(topAt), air: ms(i), dist: P.s.hero.x - x0, fastest, feet: P.feet, x: P.s.hero.x, fell: P.s.hero.act === 'fall' }
}

console.log('--- the jump (sim step 1/120 s)')
for (const [name, hold] of [['held to the top', Infinity], ['let go after 1 step (8 ms)', 1], ['after 50 ms', 6], ['after 67 ms', 8], ['after 83 ms', 10], ['after 100 ms', 12], ['after 133 ms', 16], ['after 167 ms', 20], ['after 200 ms', 24], ['after 250 ms', 30]]) {
  const j = jump(room(10), { hold })
  console.log(`${name.padEnd(28)} rise ${two(j.rise)} tiles, top at ${j.topAt} ms, in the air ${j.air} ms`)
}
const held = jump(room(10))
console.log(`up ${held.topAt} ms, down ${held.air - held.topAt} ms; fastest fall seen ${two(held.fastest)} tiles/s`)
/** Off a ledge ten rows up. */
const deep = (() => { const P = room(3.5, 2, g => { for (let x = 1; x < 6; x++) g[2][x] = '#' }); let v = 0; for (let i = 0; i < 400; i++) { P.step({ move: { x: 1, y: 0 } }); v = Math.max(v, P.s.hero.side.vy) } return v })()
console.log(`a ten tile drop tops out at ${two(deep)} tiles/s (cap ${Z.SIDE.fallCap})`)

console.log('\n--- distance on the flat, held')
console.log(`from standing, stick and button together: ${two(jump(room(10), { move: 1 }).dist)} tiles`)
{
  const P = room(6)
  for (let i = 0; i < 60; i++) P.step({ move: { x: 1, y: 0 } })
  console.log(`at a full run: ${two(jump(P, { move: 1 }).dist)} tiles`)
  console.log(`tapped (8 ms) at a full run: ${two((() => { const Q = room(6); for (let i = 0; i < 60; i++) Q.step({ move: { x: 1, y: 0 } }); return jump(Q, { move: 1, hold: 1 }).dist })())} tiles`)
}

console.log('\n--- gaps (floor level on both sides; E is the near edge, the far edge is E + width)')
const E = 12
const gap = w => g => { for (let x = E; x < E + w; x++) for (let y = FLOOR; y < H; y++) g[y][x] = '.' }
/** Cleared: landed on the far floor. `back`: how far the hero's middle starts short of the edge (negative: over it). */
function clears(w, back, run, hold = Infinity) {
  const P = room(run ? E - 5 : E - back, FLOOR, gap(w))
  if (run) for (let i = 0; i < 400 && P.s.hero.x < E - back - 1e-6; i++) P.step({ move: { x: 1, y: 0 } })
  const j = jump(P, { move: 1, hold })
  return !j.fell && j.x > E + w - R - 0.01 && Math.abs(j.feet - FLOOR) < 0.01
}
const widest = f => { let w = 0; while (w < 12 && f(w + 1)) w++; return w }
for (const [name, back, run] of [['standing, a tile short of the edge', 1, false], ['standing, both feet on, toes at the edge', R, false], ['standing, at the very lip (middle over the edge by 0.2)', -0.2, false], ['running, jumped with the toes at the edge', R, true], ['running, jumped at the lip', -0.25, true]]) {
  console.log(`${name.padEnd(56)} widest gap held ${widest(w => clears(w, back, run))}, tapped ${widest(w => clears(w, back, run, 1))}`)
}
/** The farthest short of the edge a standing jump still clears 3 tiles from. */
{ let b = -0.3; while (b < 3 && clears(3, b + 0.01, false)) b += 0.01; console.log(`a 3 tile gap is cleared from standing with the middle up to ${two(b)} tiles short of the edge`) }

console.log('\n--- ledges (a wall of that height; stick toward it with the button)')
const ledge = h => g => { for (let x = E; x < W - 1; x++) for (let y = FLOOR - h; y < FLOOR; y++) g[y][x] = '#' }
function mounts(h, back, hold = Infinity) {
  const P = room(E - back, FLOOR, ledge(h))
  const j = jump(P, { move: 1, hold })
  return Math.abs(j.feet - (FLOOR - h)) < 0.01
}
for (const [name, back] of [['flush against it', R + 0.001], ['half a tile off', 0.5], ['a tile off', 1], ['two tiles off', 2], ['three tiles off', 3]]) {
  console.log(`from standing, ${name.padEnd(18)} highest ledge held ${widest(h => mounts(h, back))}, tapped ${widest(h => mounts(h, back, 1))}`)
}
{
  // How early or late the stick may arrive: the hold needed for a 3 tile ledge from flush against it.
  let hold = 1
  while (hold < 80 && !mounts(3, R + 0.001, hold)) hold++
  console.log(`a 3 tile ledge needs the button held ${ms(hold)} ms or more (from flush against it)`)
}

console.log('\n--- windows')
for (const touch of [false, true]) {
  const name = touch ? 'thumb' : 'keys'
  // Coyote: walk off an edge, press n steps after the ground went.
  let last = -1
  for (let n = 0; n < 60; n++) {
    const P = room(E - 1.5, FLOOR, gap(8))
    for (let i = 0; i < 400 && P.ground; i++) P.step({ move: { x: 1, y: 0 }, autoFace: touch })
    for (let i = 0; i < n; i++) P.step({ move: { x: 1, y: 0 }, autoFace: touch })
    P.step(press(1, touch))
    if (P.s.hero.side.vy < 0) last = n
  }
  // The press comes in the (last + 2)th step after the one that left the ground.
  console.log(`${name.padEnd(6)} coyote: a press still jumps up to ${ms(last + 1)} ms after the ground is left`)
  // Buffer: press n steps before the landing.
  const probe = room(10)
  probe.s.hero.y -= 3
  probe.s.hero.side.ground = false
  let fallSteps = 0
  while (!probe.ground) { probe.step({ autoFace: touch }); fallSteps++ }
  let early = 0
  for (let n = 1; n < fallSteps; n++) {
    const P = room(10)
    P.s.hero.y -= 3
    P.s.hero.side.ground = false
    for (let i = 0; i < fallSteps - n; i++) P.step({ autoFace: touch })
    P.step(press(0, touch))
    let jumped = false
    for (let i = 0; i < n + 3; i++) { P.step({ jumpHeld: true, autoFace: touch }); if (P.s.hero.side.vy < -5) jumped = true }
    if (jumped) early = n
  }
  console.log(`${name.padEnd(6)} buffer: a press up to ${ms(early)} ms before landing jumps on landing`)
}
