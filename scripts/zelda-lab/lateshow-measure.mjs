// Measures THE LATE SHOW's side rooms against the jump as built, by playing them: the held and tapped apex; the
// stomp's answers in a small room made here (a spring pad, a cracked floor, a foe), with B let go at once and A at
// every moment after it; and every step, gap, ledge, pad and hollow of the built reels, with the width of the
// take-off ground each is cleared from, and for each pad the take-off spots and moments from which a thumb's stomp
// lands on the ledge it serves. The script sets the hero down where each try starts.
//   node scripts/zelda-lab/lateshow-measure.mjs
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = esbuild.buildSync({
  stdin: { contents: `export * from './engine/index'; export * from './types'; export { WORLD } from './world/index'`, resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const R = Z.HERO_R
const f2 = v => v.toFixed(2)

/** A game on `map` of `W`, the hero standing with feet on `row` at x. */
function at(W, map, x, row, { stomp = true, flags = [] } = {}) {
  const entry = Object.keys(Z.mapInfo(W, map).entries)[0]
  const s = Z.createGame(W, { seed: 3, at: { map, entry } })
  s.inv.sword = true
  s.inv.stomp = stomp
  for (const f of flags) s.flags[f] = true
  Z.enterMap(W, s, map, entry, [], { x, y: row - R - 1e-4 })
  delete s.card
  // (The words said on entering are said; the Road's screen is held at rest, its pits and wagons where they lie.)
  for (const cd of Object.values(Z.WORLD.maps[map]?.cells ?? {})) for (const e of cd.events ?? []) s.flags[e.set] = true
  if (s.map.chase) { s.map.chase.wait = 1e9; s.map.chase.left = Math.max(0, Math.min(48, x - 6)) }
  const events = []
  const step = (o = {}) => events.push(...Z.stepGame(W, s, 1 / 120, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o }))
  for (let i = 0; i < 6; i++) step()
  return { s, step, events, feet: () => s.hero.y + R, down: () => !!s.hero.side?.ground && s.hero.act !== 'fall' }
}

/** One jump: B held `hold` s (Infinity: all the way; 0: let go at once), the stick `move`, A `press` s after take-off. */
function jump(P, { hold = Infinity, move = 0, press = null, until = null, max = 480 } = {}) {
  let top = P.feet()
  let left = false
  for (let i = 0; i < max; i++) {
    const t = i / 120
    const a = press !== null && Math.abs(t - press) < 1 / 240
    P.step({ move: { x: move, y: 0 }, ...(i === 0 ? { bPress: true, jumpPress: true } : {}), ...(t < Math.max(hold, 1 / 240) ? { jumpHeld: true } : {}), ...(a ? { aPress: true, a: true, autoFace: true } : { autoFace: true }) })
    top = Math.min(top, P.feet())
    if (!P.down()) left = true
    else if (left && (!until || until(P))) break
    if (P.s.hero.act === 'fall') break
  }
  return top
}

// -- the numbers ------------------------------------------------------------------------------------------------

/** A 16 x 24 room: floor top on row 21; `put` lays tiles by 'x,y'. */
function room(put = {}, marks = {}) {
  const rows = Array.from({ length: 24 }, (_, y) => Array.from({ length: 16 }, (_, x) => put[`${x},${y}`] ?? (y >= 21 || x === 0 || x === 15 ? '#' : x === 14 && y === 20 ? '@' : '.')).join(''))
  return { start: { map: 'r', entry: 'a' }, maps: { r: { id: 'r', name: 'R', kind: 'side', track: 'dungeon', cell: { w: 16, h: 24 }, rows, marks: { '@': { ent: { t: 'entry', id: 'a' } }, ...marks } } } }
}

const flat = room()
const J = 21 - jump(at(flat, 'r', 6.5, 21))
const T = 21 - jump(at(flat, 'r', 6.5, 21), { hold: 0 })
console.log(`J (held apex) ${f2(J)}   T (B let go at once) ${f2(T)}`)

/** The delays (s after take-off) at which an A pressed after a tapped jump gets `on`. */
function window_(make, on, opts) {
  const ok = []
  for (let d = 1 / 120; d <= 0.5; d += 1 / 120) {
    const P = make()
    jump(P, { hold: 0, press: d, ...opts })
    for (let i = 0; i < 60; i++) P.step()
    if (P.events.some(e => e.type === 'stomp' && e.on === on)) ok.push(d)
  }
  return ok.length ? `A ${Math.round(ok[0] * 1000)}-${Math.round(ok.at(-1) * 1000)} ms after take-off (every step between: ${ok.length === Math.round((ok.at(-1) - ok[0]) * 120) + 1 ? 'yes' : 'NO'})` : 'never'
}
const airtime = (() => { const P = at(flat, 'r', 6.5, 21); let i = 0; P.step({ bPress: true, jumpPress: true }); for (; !P.down() && i < 400; i++) P.step(); return Math.round((i + 1) / 0.12) })()
console.log(`a tapped jump is in the air ${airtime} ms`)

// A spring pad at x 4 in the floor, a block 4 up beside it.
const spring = room({ '4,21': '▲', ...Object.fromEntries([17, 18, 19, 20].flatMap(y => [5, 6, 7, 8, 9].map(x => [`${x},${y}`, '#']))) })
{
  console.log('\nSPRING')
  for (const from of [3.5, 3.8, 4.5]) {
    const Q = at(spring, 'r', from, 21)
    // Tap, A on the way up, nothing on the stick until the bounce, then toward the ledge.
    let apex = 99
    let bounced = false
    for (let i = 0; i < 480; i++) {
      Q.step({ move: { x: bounced && Q.feet() < 17 ? 1 : 0, y: 0 }, autoFace: true, ...(i === 0 ? { bPress: true, jumpPress: true } : {}), ...(i === 12 ? { aPress: true, a: true } : {}) })
      if (Q.events.some(e => e.type === 'stomp' && e.on === 'spring')) bounced = true
      if (bounced) apex = Math.min(apex, Q.feet())
      if (bounced && Q.down()) break
    }
    console.log(`  from x ${from}: ${bounced ? `apex ${f2(21 - apex)} above the pad; the ledge is 4.00 up, cleared by ${f2(21 - apex - 4)}; landed at x ${f2(Q.s.hero.x)}, feet ${f2(Q.feet())}` : 'no bounce'}`)
  }
  const plain = at(spring, 'r', 4.5, 21)
  const p = 21 - jump(plain)
  console.log(`  a plain held jump from the pad: ${f2(p)} up, short of 4 by ${f2(4 - p)}; a landing on the pad does nothing: ${!plain.events.some(e => e.type === 'stomp')}`)
  console.log(`  tapped, from x 3.8: ${window_(() => at(spring, 'r', 3.8, 21), 'spring')}`)
}
// A cracked floor at x 5 and 6 over a hollow.
const crack = room({ '5,21': '%', '6,21': '%', '4,22': '.', '5,22': '.', '6,22': '.', '7,22': '.' })
console.log('\nCRACKED FLOOR')
console.log(`  tapped, over it: ${window_(() => at(crack, 'r', 5.5, 21), 'crack')}`)
console.log(`  tapped, from a tile aside (x 4.4): ${window_(() => at(crack, 'r', 4.4, 21), 'crack')}`)
{
  const P = at(crack, 'r', 5.5, 21)
  jump(P, { hold: 0, press: 0.05 })
  for (let i = 0; i < 120; i++) P.step()
  console.log(`  after it: feet ${f2(P.feet())} (the nook's floor 23), out by a held jump needs 2.00 of ${f2(J)}: margin ${f2(J - 2)}`)
}
// A foe on the floor, held still.
const foe = room({ '8,20': 'f' }, { f: { ent: { t: 'enemy', kind: 'sentry' } } })
console.log('\nFOE (a sentry held still)')
// (Standing where the sentry stands, the hero is struck while the room settles: he is set there again, whole.)
const still = (x) => {
  const P = at(foe, 'r', x, 21)
  const e = P.s.map.enemies[0]
  Object.assign(e, { x: 8.5, calm: true })
  e.ai = { mode: 'idle', t: 999, tell: 0 }
  Object.assign(P.s.hero, { x, y: 21 - R - 1e-4, knock: null, invuln: 0, hp: P.s.hero.maxHp, act: 'idle', swing: null })
  delete P.s.hero.side
  for (let i = 0; i < 6; i++) P.step()
  return P
}
for (const x of [8.5, 7.7, 7.0]) console.log(`  tapped from x ${x} (${f2(8.5 - x)} across), stick toward it: ${window_(() => still(x), 'foe', { move: x < 8.4 ? 0.6 : 0 })}`)
{
  const P = still(8.5)
  const e = P.s.map.enemies[0]
  let bounced = false
  let apex = 99
  let from = 0
  for (let i = 0; i < 480; i++) {
    P.step({ autoFace: true, ...(i === 0 ? { bPress: true, jumpPress: true } : {}), ...(i === 24 ? { aPress: true, a: true } : {}) })
    if (!bounced && P.events.some(v => v.type === 'stomp')) { bounced = true; from = P.feet() }
    if (bounced) apex = Math.min(apex, P.feet())
    if (bounced && P.down()) break
  }
  console.log(`  the bounce rises ${f2(from - apex)} from where it struck; the sentry lost ${e.maxHp - e.hp}, stunned ${f2(e.stun)} s left on landing`)
}

// -- the reels ----------------------------------------------------------------------------------------------------

/** Of the take-off spots in [a, b] (every 0.05), the width from which a jump toward `to` lands on `row` past `done`. */
function clears(map, [a, b], from, row, dir, done, hold, flags = []) {
  let n = 0
  let all = 0
  for (let x = a; x <= b + 1e-9; x += 0.05, all++) {
    const P = at(Z.WORLD, map, x, from, { stomp: false, flags })
    for (const e of P.s.map.enemies) e.dead = true
    jump(P, { hold, move: dir })
    if (Math.abs(P.feet() - row) < 0.02 && done(P.s.hero.x)) n++
  }
  return n ? `${f2(n * 0.05)} of ${f2(all * 0.05)}` : 'never'
}
console.log('\nTHE REELS (take-off ground that clears it, standing start, in tiles)')
const table = [
  // name, map, take-off span, from row, to row, way, landed
  ['the porch from the street, 1 up', 'reel1958', [2.35, 3.65], 21, 20, -1, x => x < 2.1],
  ['the curb, 1 up', 'reel1958', [2.35, 3.65], 21, 20, 1, x => x > 3.9],
  ['the stoop from the gutter, 1 up', 'reel1958', [6.35, 7.65], 21, 20, 1, x => x > 7.9],
  ['the manhole from the floor (gap 2)', 'reel1958', [9.05, 9.95], 21, 21, 1, x => x > 11.7],
  ['the manhole from the stoop (gap 2 and 1 down)', 'reel1958', [8.35, 8.9], 20, 21, 1, x => x > 11.7],
  ['the manhole going back (gap 2)', 'reel1958', [12.05, 12.9], 21, 21, -1, x => x < 10.3],
  ['onto the chest on the roof, from the west (1 up)', 'reel1958', [12.2, 12.65], 16, 15, 1, () => true],
  ['over the chest on the roof, from the west', 'reel1958', [12.2, 12.65], 16, 16, 1, x => x > 13.9],
  ['over the chest on the roof, from the east', 'reel1958', [14.35, 15.5], 16, 16, -1, x => x < 13.1],
  ['P1 from the floor, 2 up', 'reel1958', [22.4, 23.65], 21, 19, 1, x => x > 23.9],
  ['the alcove ledge from P1 (gap 1, 2 up)', 'reel1958', [24.4, 26.95], 19, 17, 1, x => x > 27.9],
  ['the crate from the seam side, 1 up', 'reel1958', [25.4, 26.65], 21, 20, 1, x => x > 26.9],
  ['the broken floor going back (gap 1)', 'reel1958', [23.05, 24.4], 21, 21, -1, x => x < 21.3],
  // The Video Store.
  ['onto the sign from the door (1 up)', 'reel1986', [1.35, 1.65], 21, 20, 1, x => x > 1.9],
  ['onto the sign going back (1 up)', 'reel1986', [3.35, 4.2], 21, 20, -1, x => x < 3.2],
  // The Road.
  ['onto a wagon from the road (1 up)', 'chase1986', [7.3, 8.65], 21, 20, 1, x => x > 8.9],
  ['pit 1 (gap 2)', 'chase1986', [12.7, 13.95], 21, 21, 1, x => x > 15.7],
  ['pit 2 (gap 2)', 'chase1986', [24.7, 25.95], 21, 21, 1, x => x > 27.7],
  ['pit 3 (gap 2)', 'chase1986', [36.7, 37.95], 21, 21, 1, x => x > 39.7],
  ['the key chest from the west, onto it (1 up)', 'chase1986', [56.9, 57.65], 21, 20, 1, x => x > 57.9],
  // The Overgrown Lot.
  ['onto the third key chest on the slab, from the west', 'reel2086', [10.4, 11.65], 13, 12, 1, x => x > 11.9],
  ['over the third key chest, from the west (the way on)', 'reel2086', [10.4, 11.65], 13, 13, 1, x => x > 12.9],
  ['over the third key chest, from the east (the way back)', 'reel2086', [13.35, 15.5], 13, 13, -1, x => x < 12.1],
]
for (const [name, map, span, from, to, dir, done] of table) {
  const broken = name.includes('broken')
  // (A chest on a Road or a slab stands only once it has appeared, or from the start: opened or not, it is a block.)
  const flags = name.includes('key chest') && map === 'chase1986' ? ['appear:lateshow.key2'] : []
  const W = broken ? { ...Z.WORLD, maps: { ...Z.WORLD.maps, [map]: { ...Z.WORLD.maps[map], rows: Z.WORLD.maps[map].rows.map((r, y) => (y === 21 ? r.slice(0, 22) + '.' + r.slice(23) : r)) } } } : Z.WORLD
  const keep = Z.WORLD.maps
  if (broken) Z.WORLD.maps = W.maps
  console.log(`  ${name.padEnd(52)} held ${clears(map, span, from, to, dir, done, Infinity, flags).padEnd(14)} tapped ${clears(map, span, from, to, dir, done, 0, flags)}`)
  Z.WORLD.maps = keep
}
console.log(`  out of reach by a jump: the shop roof, 5 up, short by ${f2(5 - J)} (its ladders); the alcove ledge from the floor, 4 up, short by ${f2(4 - J)} (P1)`)
{
  const P = at(Z.WORLD, 'reel1958', 22.5, 21)
  jump(P, { hold: 0, press: 0.05 })
  for (let i = 0; i < 120; i++) P.step()
  let top = 99
  let out = false
  for (let i = 0; i < 480 && !out; i++) {
    P.step({ move: { x: P.feet() < 20.98 ? 1 : 0, y: 0 }, jumpHeld: true, ...(i === 0 ? { bPress: true, jumpPress: true } : {}) })
    top = Math.min(top, P.feet())
    out = P.down() && Math.abs(P.feet() - 21) < 0.02 && P.s.hero.x > 23
  }
  console.log(`  ${'out of the built nook (2 up)'.padEnd(46)} ${out ? 'out' : 'NOT OUT'}; feet rose to ${f2(23 - top)} above its floor, margin ${f2(23 - top - 2)}`)
}

// -- the pads, as a thumb meets them ----------------------------------------------------------------------------

console.log(`\nTHE PADS (B tapped and let go, A after it, d ms from take-off; the stick toward the pad until it throws, then toward the ledge at once, or only once the feet are over its row)`)
/**
 * One try from x on `row`: did the pad throw, how high did the feet go over it, and did he come to stand on `top`?
 * `late`: after the throw the stick waits until the feet are over the ledge's row; else it is held toward the ledge
 * from the throw on.
 */
function pad(map, x, row, padX, to, top, d, late = false) {
  const P = at(Z.WORLD, map, x, row)
  for (const e of P.s.map.enemies) e.dead = true
  let thrown = false
  let apex = row
  for (let i = 0; i < 480; i++) {
    const t = i / 120
    const aim = !thrown ? padX - P.s.hero.x : to - P.s.hero.x
    const move = Math.abs(aim) < 0.25 || (thrown && late && P.feet() > top - 0.05) ? 0 : Math.sign(aim)
    P.step({ move: { x: move, y: 0 }, autoFace: true, ...(i === 0 ? { bPress: true, jumpPress: true, jumpHeld: true } : {}), ...(Math.abs(t - d) < 1 / 240 ? { aPress: true, a: true } : {}) })
    if (!thrown && P.events.some(e => e.type === 'stomp' && e.on === 'spring')) thrown = true
    if (thrown) apex = Math.min(apex, P.feet())
    if (thrown && P.down()) break
  }
  return { thrown, apex: row - apex, there: thrown && P.down() && Math.abs(P.feet() - top) < 0.02 }
}
const pads = [
  // name, map, the pad's middle, the row it lies in, take-off spots tried, where on the ledge, the ledge's top
  ['Video Store S1, floor to shelves', 'reel1986', 4.5, 21, [3.4, 3.6, 3.8, 4.2, 4.5], 7.5, 17],
  ['Video Store S2, shelves to balcony (1.5 across)', 'reel1986', 9.5, 17, [8.5, 8.8, 9.2, 9.5], 12.2, 13],
  ['Lot S1, floor to shelf', 'reel2086', 4.5, 21, [3.4, 3.6, 3.8, 4.2, 4.5], 6.6, 17],
  ['Lot S2, shelf to slab (1.5 across)', 'reel2086', 8.5, 17, [7.5, 7.8, 8.2, 8.5, 9.0], 11, 13],
  ['Last Reel pad, floor to block', 'reel2086', 22.5, 21, [21.4, 21.8, 22.2, 22.5], 24, 17],
  ['Last Reel far pad, back onto the block', 'reel2086', 25.5, 21, [26.4, 26.0, 25.7, 25.5], 23.8, 17],
]
for (const [name, map, padX, row, spots, to, top] of pads) {
  const rows = spots.map(x => {
    let apex = 0
    const style = late => {
      const ok = []
      let all = 0
      for (let d = 1 / 120; d <= 0.4001; d += 1 / 120, all++) { const r = pad(map, x, row, padX, to, top, d, late); if (r.there) ok.push(d); apex = Math.max(apex, r.apex) }
      return ok.length ? `${Math.round(ok[0] * 1000)}-${Math.round(ok.at(-1) * 1000)} ms (${ok.length}/${all})` : 'never'
    }
    return `x ${x}: stick from the throw ${style(false).padEnd(20)} stick once over the row ${style(true).padEnd(20)} apex ${f2(apex)}`
  })
  const plain = at(Z.WORLD, map, padX, row, { stomp: false })
  const p = row - jump(plain)
  console.log(`  ${name}: ledge ${row - top} up`)
  for (const r of rows) console.log(`      ${r}`)
  console.log(`      a plain held jump off the pad: ${f2(p)} up, short of ${row - top} by ${f2(row - top - p)}`)
}
{
  const P = at(Z.WORLD, 'reel1986', 6.5, 17)
  jump(P, { hold: 0, press: 0.05 })
  for (let i = 0; i < 120; i++) P.step()
  const down = P.feet()
  let top = 99
  let out = false
  for (let i = 0; i < 480 && !out; i++) {
    P.step({ move: { x: P.feet() < 16.98 ? 1 : 0, y: 0 }, jumpHeld: true, ...(i === 0 ? { bPress: true, jumpPress: true } : {}) })
    top = Math.min(top, P.feet())
    out = P.down() && Math.abs(P.feet() - 17) < 0.02
  }
  console.log(`\nTHE VIDEO STORE'S NOOK: stomped through to feet ${f2(down)} (its floor 19); out by a held jump: ${out ? 'out' : 'NOT OUT'}, feet ${f2(19 - top)} over its floor, margin ${f2(19 - top - 2)}; a tapped jump short by ${f2(2 - T)}`)
}
console.log(`out of reach by a plain jump: shelves and block 4 up, short by ${f2(4 - J)}; balcony from the ladder's top 4 up, short by ${f2(4 - J)}; the Last Reel's high slab 8 up (a way in only)`)
console.log(`ladders up the far side of the Video Store's shelves and the Lot's shelf: 4 up, no jump asked`)
{
  // Off the Last Reel's slab, 8 down: a fall from a ledge costs nothing.
  const P = at(Z.WORLD, 'reel2086', 20.3, 13)
  for (const e of P.s.map.enemies) e.dead = true
  const hp = P.s.hero.hp
  for (let i = 0; i < 360; i++) P.step({ move: { x: P.s.hero.x < 21.6 ? 1 : 0, y: 0 } })
  console.log(`off the high slab: down at x ${f2(P.s.hero.x)}, feet ${f2(P.feet())}, hearts lost ${hp - P.s.hero.hp}`)
}
