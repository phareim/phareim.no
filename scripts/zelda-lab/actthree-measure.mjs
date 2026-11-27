#!/usr/bin/env node
// Measures ACT THREE's rooms against the jump as built, by playing them: every step and gap on the way and to its
// prizes, with the width of the take-off ground each is cleared from (a standing start, B held or let go at once);
// the jumps that must not be there; that no lock can be jumped; and how long standing still takes to show a thing.
// The script sets the hero down where each try starts and puts the foes away.
//   node scripts/zelda-lab/actthree-measure.mjs
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const out = esbuild.buildSync({
  stdin: { contents: `export * from './engine/index'; export * from './types'; export { WORLD } from './world/index'; export { TILE_INFO } from './world/tiles'`, resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const R = Z.HERO_R
const W = Z.WORLD
const DT = 1 / 120
const f2 = v => v.toFixed(2)

/** A game on `map`, the hero standing with feet on `row` at x; null where there is nothing to stand on there. */
function at(map, x, row) {
  const entry = Object.keys(Z.mapInfo(W, map).entries)[0]
  const s = Z.createGame(W, { seed: 3, at: { map, entry } })
  s.inv.sword = true
  Z.enterMap(W, s, map, entry, [], { x, y: row - R - 1e-4 })
  delete s.card
  for (const e of s.map.enemies) e.dead = true
  const step = (o = {}) => Z.stepGame(W, s, DT, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o })
  if (Z.circleBlocked(W, s.map, x, s.hero.y, R)) return null
  for (let i = 0; i < 4; i++) step()
  const P = { s, step, feet: () => s.hero.y + R, down: () => !!s.hero.side?.ground && s.hero.act !== 'fall' }
  return P.down() && Math.abs(P.feet() - row) < 0.01 && Math.abs(s.hero.x - x) < 0.01 ? P : null
}

/** A jump from `P` steered to come down at x. True when it lands on `row` between x0 and x1 (or goes through a door there). */
function lands(P, aim, row, [x0, x1], held) {
  const h = P.s.hero
  const toward = () => {
    const v = h.side.vx
    const d = aim - (h.x + (v * Math.abs(v)) / (2 * Z.SIDE.airAccel))
    return Math.abs(d) < 0.08 ? 0 : Math.sign(d)
  }
  let left = false
  for (let i = 0; i < 300; i++) {
    P.step({ move: { x: toward(), y: 0 }, ...(i === 0 ? { bPress: true, jumpPress: true } : {}), ...(held || i === 0 ? { jumpHeld: true } : {}) })
    if (P.s.mode === 'warp') return h.x >= x0 - 0.35 && h.x <= x1 + 0.35 && h.y + R <= row + 0.6
    if (!P.down()) left = true
    else if (left) break
  }
  return left && P.down() && Math.abs(P.feet() - row) < 0.01 && h.x >= x0 - R && h.x <= x1 + R
}

/** Of the take-off ground [a, b] on row `from`: the tiles of it a jump lands from, held and tapped. */
function ground(map, from, [a, b], to, span) {
  const got = { held: 0, tapped: 0, tried: 0 }
  for (let x = a; x <= b + 1e-9; x += 0.05) {
    if (!at(map, x, from)) continue
    got.tried += 0.05
    for (const held of [true, false]) {
      let ok = false
      for (let aim = span[0] + 0.25; !ok && aim <= span[1] - 0.2; aim += 0.3) ok = lands(at(map, x, from), aim, to, span, held)
      if (ok) got[held ? 'held' : 'tapped'] += 0.05
    }
  }
  return got
}

const J = (() => { const P = at('actloft', 6.5, 22); let top = 22; P.step({ bPress: true, jumpPress: true, jumpHeld: true }); for (let i = 0; i < 200 && !P.down(); i++) { P.step({ jumpHeld: true }); top = Math.min(top, P.feet()) } return 22 - top })()
const T = (() => { const P = at('actloft', 6.5, 22); let top = 22; P.step({ bPress: true, jumpPress: true, jumpHeld: true }); for (let i = 0; i < 200 && !P.down(); i++) { P.step(); top = Math.min(top, P.feet()) } return 22 - top })()
console.log(`J (held apex) ${f2(J)}   T (B let go at once) ${f2(T)}\n`)

// [map, what, from row, take-off ground, to row, landing span (tiles), up, gap, kind]
const MOVES = [
  ['actunder', 'the curb', 22, [2.4, 4.65], 21, [5, 7], 1, 0, 'way'],
  ['actunder', 'ladder top → second platform (west)', 18, [8.0, 10.65], 16, [3, 7], 2, 1, 'way'],
  ['actunder', 'second → top platform (east)', 16, [4.35, 6.95], 14, [8, 12], 2, 1, 'way'],
  ['actunder', 'floor → first platform', 22, [9.35, 12.0], 20, [12, 15], 2, 0, 'or'],
  ['actunder', 'first platform → ladder platform', 20, [12.0, 14.6], 18, [8, 11], 2, 1, 'or'],
  ['actunder', 'prop floor → crate (from the ladder side)', 11, [9.4, 11.5], 10, [7, 9], 1, 0, 'way'],
  ['actunder', 'crate → first shelf', 10, [6.7, 9.3], 8, [3, 6], 2, 1, 'way'],
  ['actunder', 'first → second shelf', 8, [3.35, 6.3], 6, [7, 10], 2, 1, 'way'],
  ['actunder', 'second → third shelf', 6, [6.7, 9.6], 4, [3, 6], 2, 1, 'way'],
  ['actunder', 'third → stair shelf', 4, [3.35, 6.3], 2, [7, 13], 2, 1, 'way'],
  ['actdoors', 'over the sign (one tile high)', 10, [2.4, 4.65], 10, [6, 9.6], 1, 1, 'way'],
  ['actdoors', 'floor → middle pad', 10, [6.4, 9.6], 8, [7, 10], 2, 0, 'or'],
  ['actdoors', 'floor → first pad', 10, [2.4, 4.65], 8, [2, 5], 2, 0, 'or'],
  ['actdoors', 'first → middle pad', 8, [2.35, 5.3], 8, [7, 10], 0, 2, 'way'],
  ['actdoors', 'middle → the real door\'s pad', 8, [7.35, 10.3], 8, [12, 13], 0, 2, 'way'],
  ['actbard', 'floor → ledge, from before it', 12, [4.0, 8.65], 10, [9, 15], 2, 0, 'or'],
  ['actbard', 'floor → ledge, from under it', 12, [9.4, 14.6], 10, [10, 15], 2, 0, 'or'],
  ['actflats', 'floor → the real step', 10, [5.4, 10.6], 8, [7, 9], 2, 0, 'way'],
  ['actflats', 'real step → chest tier', 8, [7.0, 9.0], 6, [7, 9], 2, 0, 'way'],
  ['actflats', 'chest tier → door tier', 6, [4.4, 11.6], 4, [1, 15], 2, 0, 'way'],
  ['actwings', 'floor → first hidden ledge', 10, [2.4, 7.6], 8, [4, 6], 2, 0, 'prize'],
  ['actwings', 'first → second hidden ledge', 8, [4.0, 6.0], 6, [1, 3], 2, 1, 'prize'],
  ['actwings', 'second → third hidden ledge (chest on it)', 6, [1.35, 3.3], 4, [4, 6], 2, 1, 'prize'],
]
console.log('| Room | Jump | Needs | Held margin | Tapped margin | Ground held / tapped, of tried |')
console.log('|---|---|---|---|---|---|')
let bad = 0
for (const [map, what, from, a, to, span, up, gap, kind] of MOVES) {
  const g = ground(map, from, a, to, span)
  if (g.held < 0.2) bad++
  const needs = [up ? `${up} up` : 'level', gap ? `gap ${gap}` : ''].filter(Boolean).join(', ')
  console.log(`| ${map} | ${what}${kind === 'way' ? '' : kind === 'or' ? ' (another way)' : ' (prize)'} | ${needs} | ${f2(J - up)} | ${f2(T - up)} | ${f2(g.held)} / ${g.tapped < 0.001 ? 'never' : f2(g.tapped)} of ${f2(g.tried)} |`)
}

console.log('\nJumps that must not be there (ground a held jump lands from; want 0):')
for (const [map, what, from, a, to, span] of [
  ['actunder', 'floor → ladder platform without the ladder', 22, [6.9, 11.6], 18, [9, 11]],
  ['actunder', 'first shelf → third shelf (4 up)', 8, [3.35, 6.3], 4, [3, 6]],
  ['actflats', 'floor → chest tier past the step', 10, [1.35, 14.6], 6, [2, 12]],
  ['actflats', 'floor → door tier', 10, [1.35, 14.6], 4, [1, 15]],
  ['actwings', 'floor → second hidden ledge', 10, [1.35, 6.0], 6, [1, 3]],
  ['actwings', 'first → third hidden ledge', 8, [4.0, 6.0], 4, [4, 6]],
  ['actbard', 'ledge → the catwalk over the doorway', 10, [10.0, 12.6], 2, [13, 14]],
]) {
  const g = ground(map, from, a, to, span)
  if (g.held > 0.001) bad++
  console.log(`  ${map}: ${what}: ${f2(g.held)}`)
}

console.log('\nLocks (every tile above a lock run, to the top of its room, is wall):')
for (const id of Object.keys(W.maps).filter(id => W.maps[id].keyring === 'actthree')) {
  const info = Z.mapInfo(W, id)
  info.base.forEach((t, i) => {
    if ((t !== 'L' && t !== 'K' && t !== 'X') || info.base[i - info.w] === t) return
    const x = i % info.w
    const top = Math.floor(i / info.w)
    let height = 0
    while (info.base[i + height * info.w] === t) height++
    const walled = Array.from({ length: top }, (_, y) => info.base[y * info.w + x]).every(u => Z.TILE_INFO[u].wall)
    if (!walled) bad++
    console.log(`  ${id}: ${t} at ${x},${top}, ${height} tall: ${walled ? 'walled to the top' : 'OPEN ABOVE'}`)
  })
}

console.log('\nThe glass: seconds of stillness to the ring, the glass and the whole change:')
{
  const P = at('actdoors', 7.5, 10)
  Z.grant(P.s, 'lens')
  let t = 0
  const till = done => { while (!done() && t < 3) { P.step(); t += DT } return f2(t) }
  console.log(`  ring ${till(() => P.s.lens && P.s.lens.still >= Z.LENS.ring)}, up ${till(() => Z.lensUp(P.s))}, changed ${till(() => P.s.lens.k >= 1)}`)
  // A hop at the real door from the middle pad, the glass dropped at take-off: how much outline is left on landing.
  const Q = at('actdoors', 9.0, 8)
  Z.grant(Q.s, 'lens')
  for (let i = 0; i < 120; i++) Q.step()
  Q.step({ move: { x: 1, y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
  let air = DT
  while (!Q.down() && air < 2) { Q.step({ move: { x: Q.s.hero.x < 12.2 ? 1 : 0, y: 0 }, jumpHeld: true }); air += DT }
  console.log(`  a jump of ${f2(air)} s after a look leaves the outlines at ${f2(Q.s.lens.k)} of full; gone after ${Z.LENS.back} s`)
}
if (bad) { console.error(`\n${bad} things are not as meant`); process.exit(1) }
