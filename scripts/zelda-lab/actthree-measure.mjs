#!/usr/bin/env node
// Measures ACT THREE's rooms against the jump as built, by playing them: every step and gap on the way and to its
// prizes, with the width of the take-off ground each is cleared from (a standing start, B held or let go at once);
// the jumps that must not be there; the cable's pairs and safe ledges; that no lock or gate can be got past; the door
// a jump may not go through; how long standing still takes to show a thing; BARD's cycle and how long it and the
// understudy last against the scripted controllers (`tests/zelda-act-three-bots.mjs`).
// The geometry's tries set the hero down where each starts, with the foes away and every hidden thing shown.
//   node scripts/zelda-lab/actthree-measure.mjs
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { reelPlayer } from '../../tests/zelda-reel.mjs'
import { fightBard, fightHallucinator, fightUnderstudy } from '../../tests/zelda-act-three-bots.mjs'

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
  // (A room's lines are taken as heard.)
  for (const c of Object.values(W.maps[map].cells ?? {})) for (const ev of c.events ?? []) s.flags[ev.set] = true
  // (The jumps are measured with every hidden thing shown: until then it is not there.)
  s.map.lensSeen = Z.glassThings(Z.mapInfo(W, map)).map(t => t.i)
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
  ['actloft', 'floor → first catwalk (A), in the gap of its bags', 22, [7.35, 8.65], 20, [7, 9], 2, 0, 'way'],
  ['actloft', 'A → west step', 20, [4.0, 7.6], 18, [1, 4], 2, 0, 'way'],
  ['actloft', 'west step → second catwalk', 18, [1.35, 4.0], 16, [4, 7], 2, 0, 'way'],
  ['actloft', 'second catwalk → east step', 16, [9.0, 11.3], 14, [12, 15], 2, 1, 'way'],
  ['actloft', 'east step → third catwalk', 14, [11.7, 14.6], 12, [8, 11], 2, 1, 'way'],
  ['actloft', 'over the Leg\'s sign, east', 8, [7.4, 9.6], 8, [11, 13], 1, 1, 'way'],
  ['actloft', 'over the Leg\'s sign, back', 8, [11.35, 12.6], 8, [8, 10], 1, 1, 'way'],
  ['actstudy', 'floor → west shelf', 10, [4.0, 7.9], 8, [4, 8], 2, 0, 'or'],
  ['actstudy', 'floor → east shelf', 10, [9.2, 13.0], 8, [9, 13], 2, 0, 'or'],
  ['actcable', 'foot → clamp 1', 22, [5.4, 9.6], 20, [8, 11], 2, 0, 'way'],
  ['actcable', 'clamp 1 → 2', 20, [8.0, 10.6], 18, [4, 7], 2, 1, 'way'],
  ['actcable', 'clamp 2 → 3 (real, right)', 18, [4.35, 7.0], 16, [8, 11], 2, 1, 'way'],
  ['actcable', 'clamp 3 → 4', 16, [8.0, 10.6], 14, [4, 7], 2, 1, 'way'],
  ['actcable', 'clamp 4 → 5', 14, [4.35, 7.0], 12, [8, 11], 2, 1, 'way'],
  ['actcable', 'clamp 5 → 6 (real, left)', 12, [8.0, 10.6], 10, [4, 7], 2, 1, 'way'],
  ['actcable', 'clamp 6 → 7', 10, [4.35, 7.0], 8, [8, 11], 2, 1, 'way'],
  ['actcable', 'clamp 7 → 8 (real, left)', 8, [8.0, 10.6], 6, [4, 7], 2, 1, 'way'],
  ['actcable', 'clamp 8 → the top', 6, [4.35, 7.0], 4, [3, 7], 2, 0, 'way'],
  ['actcable', 'over the top\'s sign', 4, [4.4, 6.6], 4, [8, 11], 1, 1, 'way'],
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
  ['actloft', 'floor → west step past the first catwalk', 22, [1.4, 6.0], 18, [1, 3]],
  ['actloft', 'first → second catwalk without the step (4 up)', 20, [4.35, 11.6], 16, [4, 11]],
  ['actloft', 'second → third catwalk without the step (4 up)', 16, [4.35, 10.6], 12, [4, 11]],
  ['actloft', 'third catwalk → the Leg without the ladder (4 up)', 12, [4.35, 10.6], 8, [3, 13]],
  ['actcable', 'foot → clamp 2', 22, [5.4, 9.6], 18, [4, 7]],
  ['actcable', 'clamp 2 → 4 (4 up)', 18, [4.35, 6.6], 14, [3, 6]],
  ['actcable', 'clamp 4 → 6 (4 up)', 14, [4.35, 7.0], 10, [4, 7]],
  ['actcable', 'clamp 5 → 7 (4 up)', 12, [8.0, 10.6], 8, [8, 11]],
  ['actcable', 'clamp 7 → the top (4 up)', 8, [8.0, 10.6], 4, [3, 13]],
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
    let solid = 0
    while (solid < top && Z.TILE_INFO[info.base[(top - 1 - solid) * info.w + x]].wall) solid++
    // (BARD's shaft is open again at its own top, five rows over the gate: no jump is that high.)
    if (solid < top && solid < 5) bad++
    console.log(`  ${id}: ${t} at ${x},${top}, ${height} tall: ${solid === top ? 'walled to the top' : `${solid} rows of wall over it, then open`}`)
  })
}

console.log('\nPast a shut lock or gate by any play (random stick and B, 1500 runs of 30 s each; want never):')
{
  let seed = 1
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  for (const [map, entry, past] of [['actbard', 'trapdoor', 'actflats'], ['actwings', 'wings', 'actloft'], ['actloft', 'rope', 'actstudy'], ['actloft', 'rope', 'actcable'], ['actgondola', 'stair', 'fogstage']]) {
    let found = 0
    for (let run = 0; run < 1500 && !found; run++) {
      const s = Z.createGame(W, { seed: run + 1, at: { map, entry } })
      s.inv.sword = true
      delete s.card
      for (const e of s.map.enemies) e.dead = true
      let k = {}
      for (let i = 0, hold = 0; i < 1800 && s.mode !== 'warp'; i++) {
        if (hold-- <= 0) { hold = 4 + Math.floor(rnd() * 28); const r = rnd(); k = { x: r < 0.4 ? -1 : r < 0.8 ? 1 : 0, y: rnd() < 0.35 ? -1 : rnd() < 0.1 ? 1 : 0, jump: rnd() < 0.55, fresh: true } }
        Z.stepGame(W, s, 1 / 60, { ...Z.NO_INPUT, move: { x: k.x, y: k.y }, jumpHeld: k.jump, jumpPress: k.jump && k.fresh, bPress: k.jump && k.fresh })
        k.fresh = false
        if (s.mode === 'dialog') { s.dialog = null; s.mode = 'play' }
      }
      if (s.mode === 'warp' && s.warp.to === past) found = run + 1
    }
    if (found) bad++
    console.log(`  ${map} → ${past}: ${found ? `REACHED in run ${found}` : 'never'}`)
  }
}

console.log('\nA jump straight up from the floor under the real door\'s pad (must not leave the room in the air):')
for (const x of [11.9, 12.5, 13.1, 13.5]) {
  const P = at('actdoors', x, 10)
  let air = false
  let went = ''
  P.step({ bPress: true, jumpPress: true, jumpHeld: true })
  for (let i = 0; i < 200 && !went; i++) {
    P.step({ jumpHeld: true })
    if (P.s.mode === 'warp') went = P.s.hero.side.ground ? 'standing on the pad' : 'IN THE AIR'
    else if (P.down() && i > 20) break
  }
  if (went === 'IN THE AIR') { bad++; air = true }
  console.log(`  from x ${x}: ${went ? `through the door, ${went}` : `no door; stands at feet ${f2(P.feet())}`}`)
}

console.log('\nThe cable\'s pairs (clamps are 3 wide; x is a clamp\'s middle). A painted one must have no real clamp, nor the foot, within 3 in x under it:')
{
  const info = Z.mapInfo(W, 'actcable')
  const runs = (test) => {
    const out = []
    for (let y = 0; y < info.h; y++) for (let x = 0; x < info.w; x++) if (test(x, y) && !(x > 0 && test(x - 1, y))) { let n = 1; while (x + n < info.w && test(x + n, y)) n++; out.push({ x0: x, w: n, mid: x + n / 2, y }) }
    return out
  }
  const real = runs((x, y) => info.base[y * info.w + x] === '¯')
  const lies = new Set(Z.glassThings(info).map(t => t.i))
  const painted = runs((x, y) => lies.has(y * info.w + x))
  const floor = Array.from({ length: info.w }, (_, x) => x).filter(x => info.base[22 * info.w + x] === '#')
  console.log('| Rung row | Clamp below (x) | Real (x, side, from below) | Painted (x, side, from below) | Nearest real clamp under the painted one, in x | Nearest foot tile under it | Trusted, a hero |')
  console.log('|---|---|---|---|---|---|---|')
  for (const p of [...painted].sort((a, b) => b.y - a.y)) {
    const twin = real.find(c => c.y === p.y)
    const below = real.find(c => c.y === p.y + 2)
    const under = Math.min(...real.filter(c => c.y > p.y).map(c => Math.abs(c.mid - p.mid)))
    const foot = Math.min(...floor.map(x => Math.abs(x + 0.5 - p.mid)))
    // Played: from the clamp below, jump for the painted one.
    const side = p.mid < below.mid ? -1 : 1
    const P = at('actcable', below.mid + side * 1.1, below.y)
    let fell = false
    const before = P.s.hero.hp
    P.step({ move: { x: side, y: 0 }, bPress: true, jumpPress: true, jumpHeld: true })
    for (let i = 0; i < 400 && !fell; i++) { P.step({ move: { x: (p.mid - P.s.hero.x) * side > 0.1 ? side : 0, y: 0 }, jumpHeld: true }); fell = P.s.hero.act === 'fall'; if (P.down() && i > 30) break }
    for (let i = 0; i < 200; i++) P.step()
    if (under <= 3 || foot <= 3 || !fell) bad++
    const word = v => (v < below.mid ? 'left' : 'right')
    console.log(`| ${p.y} | ${below.mid} | ${twin.mid}, ${word(twin.mid)}, ${Math.abs(twin.mid - below.mid)} | ${p.mid}, ${word(p.mid)}, ${Math.abs(p.mid - below.mid)} | ${under} | ${foot} | ${fell ? `falls to the fog, ${before - P.s.hero.hp} half heart, back on feet ${f2(P.feet())}` : `STANDS at ${f2(P.feet())}`} |`)
  }
  console.log(`  safe ledges (rows stood on): foot 22, ${[...new Set(info.marks.filter(m => m.ent.t === 'ledge').map(m => m.y + 1))].sort((a, b) => b - a).join(', ')}`)
  console.log(`  real rungs, middle x from the bottom: ${real.filter(c => c.y < 22 && c.y > 4).sort((a, b) => b.y - a.y).map(c => c.mid).join(', ')}`)
}

/** A game at a map's door with the blade, hearts enough to count blows with, and (if asked) THE LENS. */
function fight(map, entry, seed, lens, hp = 40) {
  const s = Z.createGame(W, { seed, at: { map, entry } })
  Z.grant(s, 'sword')
  if (lens) Z.grant(s, 'lens')
  s.hero.maxHp = s.hero.hp = hp
  const P = reelPlayer(Z, s)
  P.card()
  P.idle(2)
  if (s.mode === 'dialog') P.settle()
  return { s, P }
}
const spread = a => { const v = [...a].sort((x, y) => x - y); return `${f2(v[0])} / ${f2(v[v.length >> 1])} / ${f2(v[v.length - 1])}` }

console.log('\nBARD\'s cycle, one of each piece (mode: seconds; the stencil in tiles):')
{
  const seen = new Set()
  const { s, P } = fight('actbard', 'trapdoor', 3, false, 400)
  P.walk(6)
  const e = s.map.enemies[0]
  let was = e.ai.mode
  let t = 0
  let line = []
  for (let i = 0; i < 60 * 120 && seen.size < 3; i++) {
    P.step(s.mode === 'dialog' && i % 12 === 0 ? { aPress: true } : {})
    if (s.mode !== 'play') continue
    t += 1 / 60
    if (e.ai.mode === was) continue
    const piece = Z.bardPiece(e)
    line.push(`${was} ${f2(t)}`)
    if (e.ai.mode === 'tell') line.push(`[${piece}: ${Z.bardBoxes(s.map, e).map(b => `x ${f2(b.x0)}–${f2(b.x1)}, y ${f2(b.y0)}–${f2(b.y1)}`).join('; ')}; hero at ${f2(s.hero.x)}]`)
    if (e.ai.mode === 'wings') { if (!seen.has(piece)) console.log(`  ${line.join(' → ')}`); seen.add(piece); line = [] }
    was = e.ai.mode
    t = 0
  }
}

console.log('\nBARD, 40 seeds each (a controller that reads the state; seconds from the first hide, fewest / middle / most):')
for (const react of [0, 0.5]) for (const glass of [false, true]) {
  const out = []
  for (let seed = 1; seed <= 40; seed++) {
    const { s, P } = fight('actbard', 'trapdoor', seed, glass)
    out.push(fightBard(Z, s, P, { glass, react, max: 300 }))
  }
  console.log(`  ${glass ? 'with the glass' : 'blade only    '}, ${react} s to react: ${spread(out.map(o => o.seconds))} s; openings ${spread(out.map(o => o.openings))}; half hearts lost per fight ${f2(out.reduce((n, o) => n + o.hits * 2, 0) / out.length)}; from open to the first blow that bites ${spread(out.flatMap(o => o.waits))} s; hp taken an opening ${f2(10 * out.length / out.reduce((n, o) => n + o.openings, 0))}`)
}
{
  // Standing still where he came in: what the stencils do to a hero who ignores them.
  const t = []
  for (let seed = 1; seed <= 10; seed++) {
    const { s, P } = fight('actbard', 'trapdoor', seed, false, 6)
    P.walk(6)
    let i = 0
    while (s.mode !== 'dying' && i++ < 60 * 300) P.step(s.mode === 'dialog' && i % 12 === 0 ? { aPress: true } : {})
    t.push(i / 60)
  }
  console.log(`  a hero with three hearts who only stands on the floor (x 6) falls after ${spread(t)} s`)
}

console.log('\nTHE UNDERSTUDY, 20 seeds (blade only; from the floor, hopping each charge):')
{
  const out = []
  for (let seed = 1; seed <= 20; seed++) {
    const { s, P } = fight('actstudy', 'studyin', seed, false)
    P.idle(seed * 3)
    out.push(fightUnderstudy(Z, s, P))
  }
  const ends = out.flatMap(o => o.ends)
  if (ends.some(p => Math.abs(p.feet - 10) > 0.01)) bad++
  console.log(`  ${spread(out.map(o => o.seconds))} s; openings ${spread(out.map(o => o.openings))}; hits taken ${out.reduce((n, o) => n + o.hits, 0)}`)
  console.log(`  ${ends.length} charges ended: feet ${spread(ends.map(p => p.feet))} (the floor is 10), x ${spread(ends.map(p => p.x))} (the walls are 1 and 15)`)
}

console.log('\nBARD\'s door, jumped on the floor by a hero who stands still: when B may be pressed, from the start of the tell (the tell is 0.9 s):')
for (const held of [true, false]) {
  for (const x of [2.5, 4.5, 6]) {
    const good = []
    for (let press = 0; press < 100; press++) {
      const { s, P } = fight('actbard', 'trapdoor', 1, false, 40)
      P.walk(x)
      const e = s.map.enemies[0]
      Object.assign(e.ai, { mode: 'hide', t: 0.001, piece: 'door' })
      for (let i = 0; i < 5 && e.ai.mode !== 'tell'; i++) P.step()
      const hp = s.hero.hp
      for (let f = 0; f < 150; f++) P.step(f === press ? { bPress: true, jumpPress: true, jumpHeld: true } : held && f > press ? { jumpHeld: true } : {})
      if (s.hero.hp === hp) good.push(press / 60)
    }
    console.log(`  hero at x ${x}, B ${held ? 'held  ' : 'tapped'}: clears when pressed ${good.length ? `${f2(good[0])} to ${f2(good[good.length - 1])} s (a window of ${f2(good.length / 60)} s)` : 'never'}`)
  }
}

console.log('\nThe hidden chest and the A button, in the Wings, the hero set on the third ledge\'s row facing it:')
{
  const P = at('actwings', 5.5, 4)
  const s = P.s
  // Before the glass has shown anything.
  delete s.map.lensSeen
  P.step()
  const before = { tile: Z.tileAt(s.map, 6, 3), ledge: Z.tileAt(s.map, 5, 4) }
  Object.assign(s.hero, { x: 5.5, y: 4 - R - 1e-4, dir: 'right' })
  before.a = Z.aWould(W, s)
  Z.grant(s, 'lens')
  s.map.lensSeen = Z.glassThings(Z.mapInfo(W, 'actwings')).map(t => t.i)
  P.step()
  Object.assign(s.hero, { x: 5.5, y: 4 - R - 1e-4, dir: 'right' })
  delete s.hero.side
  const after = { tile: Z.tileAt(s.map, 6, 3), ledge: Z.tileAt(s.map, 5, 4), a: Z.aWould(W, s) }
  if (before.a !== 'blade' || before.tile !== '.' || after.a !== 'open') bad++
  console.log(`  unshown: chest tile '${before.tile}', ledge tile '${before.ledge}', A is ${before.a}; shown: '${after.tile}', '${after.ledge}', A is ${after.a}`)
}

console.log(`\nSandbags: ${Object.entries(Z.BAG).map(([k, v]) => `${k} ${v}`).join(', ')}`)
for (const b of Z.bagsOf(Z.mapInfo(W, 'actloft'))) console.log(`  column x ${b.x}–${b.x + 2} under row ${b.y}, down to row ${Math.min(...Z.column(Z.createGame(W, { seed: 1, at: { map: 'actloft', entry: 'rope' } }).map, b.x, b.x + 2, b.y).map(o => o.y1))}, phase ${b.phase} s`)

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
// -- THE HALLUCINATOR -------------------------------------------------------------------------------------------

const deg = a => a * 180 / Math.PI
console.log(`\nThe standing cut at each slot (one A from a stand on the floor, the real body set there, open): how far from the body's middle, in x, it bites. The body's middle at y ${Z.HALLU.y} (and, for the record, at the brief's 10.5); its picture is 2.5 wide, so a hero touching it stands ${f2(1.25 + R)} off.`)
for (const y of [10.5, Z.HALLU.y]) {
  console.log(`| middle at y | Slot x | from the west: bites between | from the east: between | margin past touching, west / east | straight-line margin |`)
  console.log('|---|---|---|---|---|---|')
  for (const slot of Z.HALLU.slots) {
    const side = way => {
      const hits = []
      for (let off = 0; off <= 2.6; off += 0.02) {
        const x = slot - way * off
        // (West of 2 is the stair: a hero there is out of the room.)
        if (x < 2.0 || x > 13 - R) continue
        const s = Z.createGame(W, { seed: 1, at: { map: 'actgondola', entry: 'stair' } })
        s.inv.sword = true
        const step = (o = {}) => Z.stepGame(W, s, 1 / 60, { ...Z.NO_INPUT, move: { x: 0, y: 0 }, ...o })
        step(); s.mode = 'play'; s.dialog = null
        Object.assign(s.hero, { x, y: Z.HALLU.floor - R - 1e-4 })
        for (let i = 0; i < 3; i++) step()
        const [lead, ...others] = s.map.enemies
        for (const o of others) { o.x = -30 }
        Object.assign(lead, { x: slot, y, invuln: 0 })
        Object.assign(lead.ai, { mode: 'open', t: 5, took: 0 })
        s.hero.x = x
        step({ move: { x: 0.4 * way, y: 0 }, aPress: true, a: true })
        for (let i = 0; i < 20; i++) step()
        if (lead.hp < lead.maxHp) hits.push(off)
      }
      return hits.length ? [Math.min(...hits), Math.max(...hits)] : null
    }
    const w = side(1)
    const e = side(-1)
    const touch = 1.25 + R
    const say = v => (v ? `${f2(v[0])}–${f2(v[1])}` : 'never')
    const margin = v => (v ? f2(v[1] - touch) : '–')
    const straight = 1.2 + 1.0 - Math.hypot(touch, Z.HALLU.floor - R - y)
    console.log(`| ${y} | ${slot} | ${say(w)} | ${say(e)} | ${margin(w)} / ${margin(e)} | ${f2(straight)} |`)
  }
}

console.log('\nTHE HALLUCINATOR\'s round, by script (seed 4; a hero who walks out of every stencil, no blade used until half is forced):')
{
  const { s, P } = fight('actgondola', 'stair', 4, false, 400)
  const bodies = () => Z.halluBodies(s.map)
  const lead = bodies()[0]
  let was = ''
  let t = 0
  let wave = 0
  let rounds = 0
  for (let i = 0; i < 60 * 80 && rounds < 3; i++) {
    const mode = lead.ai.mode
    if (mode !== was) {
      if (mode === 'shuffle') { rounds++; if (rounds < 3) console.log(`  round ${rounds}${rounds === 2 ? ' (from half: hit points set to 6 in the opening before it)' : ''}`); else break }
      // (Half is set before the second round begins, as the first opening's cuts would.)
      if (mode === 'open' && rounds === 1) lead.hp = 6
      console.log(`    ${f2(t)} s  ${mode}${mode === 'claim' ? '' : ''}  bodies x ${bodies().map(b => b.x.toFixed(1)).join(' ')}, bar ${(Z.halluShown(lead) * 12).toFixed(0)}/12${mode === 'blows' ? `, claimed body ${lead.ai.claimed} (the real one is 0), ${lead.ai.waves} waves` : ''}`)
      was = mode
      wave = 0
    }
    if (mode === 'blows' && lead.ai.wave !== wave) {
      wave = lead.ai.wave
      console.log(`    ${f2(t)} s    wave ${wave}: stencils ${Z.halluAims(lead).map(x => `${f2(x - 1)}–${f2(x + 1)}`).join(', ')}${Z.halluPaint(lead).length ? `; painted crates (no stencil) at ${Z.halluPaint(lead).map(f2).join(', ')}` : ''}; hero at ${f2(s.hero.x)}`)
    }
    const boxes = Z.halluBoxes(lead)
    const inside = x => boxes.some(b => x >= b.x0 - 0.25 && x <= b.x1 + 0.25)
    let to = s.hero.x
    if (inside(to)) for (let d = 0.2; d < 9; d += 0.2) { const c = [s.hero.x + d, s.hero.x - d].find(x => x > 2.35 && x < 12.6 && !inside(x)); if (c) { to = c; break } }
    P.step(s.mode === 'dialog' && i % 12 === 0 ? { aPress: true } : { move: { x: Math.abs(to - s.hero.x) < 0.1 || s.mode !== 'play' ? 0 : Math.sign(to - s.hero.x), y: 0 } })
    if (s.mode === 'play') t += 1 / 60
  }
  console.log(`  half hearts lost walking out of the stencils: ${400 - s.hero.hp}`)
}

console.log('\nA hero who only stands in the gondola, with THE LENS (the glass comes up) and without; seconds from the stair to the fall:')
for (const hearts of [3, 6, 10]) {
  for (const lens of [false, true]) {
    const t = []
    let glass = 0
    for (let seed = 1; seed <= 10; seed++) {
      const { s, P } = fight('actgondola', 'stair', seed, lens, hearts * 2)
      let i = 0
      while (s.mode !== 'dying' && i++ < 60 * 200) { P.step(); if (Z.lensUp(s)) glass++ }
      t.push(i / 60)
    }
    console.log(`  ${hearts} hearts, ${lens ? 'with the lens' : 'without      '}: ${spread(t)} s${lens ? ` (the glass up ${f2(glass / 600)} s of a fight)` : ''}`)
  }
}

console.log('\nTHE HALLUCINATOR, 60 seeds each, by the controller (blade only; it steps out of every stencil), fewest / middle / most:')
console.log('| How it finds the body | Reaction | Fight, s | Openings | Openings that bit | False bodies popped | Half hearts lost |')
console.log('|---|---|---|---|---|---|---|')
for (const react of [0, 0.4, 0.7]) {
  for (const way of ['blade', 'glass', 'plate']) {
    const out = []
    for (let seed = 1; seed <= 60; seed++) {
      const { s, P } = fight('actgondola', 'stair', seed, way === 'glass')
      let n = seed * 7919
      out.push(fightHallucinator(Z, s, P, { way, react, max: 600, guess: way === 'blade' ? () => { n = (n * 48271) % 2147483647; return (n >> 8) % 2 } : null }))
    }
    const all = k => spread(out.map(o => o[k]))
    const mean = k => f2(out.reduce((a, o) => a + o[k], 0) / out.length)
    console.log(`| ${way === 'blade' ? 'guessing (no lens, no plate)' : way === 'glass' ? 'the lens, standing still' : 'the plate, no lens'} | ${react} s | ${all('seconds')} | ${all('openings')} (mean ${mean('openings')}) | ${all('bit')} | ${all('pops')} | ${mean('lost')} |`)
  }
}

console.log('\nA retry: a fall, then the stair again:')
{
  const { s, P } = fight('actgondola', 'stair', 2, false, 6)
  let i = 0
  while (s.mode !== 'dying' && i++ < 60 * 200) P.step()
  Z.halluBodies(s.map)[0].hp = 6
  for (let k = 0; k < 600 && s.mode !== 'play'; k++) Z.stepGame(W, s, 1 / 60, Z.NO_INPUT)
  console.log(`  back in ${s.map.id} at entry ${s.entry.entry}, ${s.hero.hp} half hearts of ${s.hero.maxHp}, bodies ${Z.halluBodies(s.map).length}, hit points ${Z.halluBodies(s.map)[0].hp}, gate ${Z.tileAt(s.map, 13, 10)}`)
}

console.log('\nVega\'s and Birger\'s lines in each state (the flags a save can hold; the first line of what is said):')
{
  const say = (mark, flags) => {
    const e = W.maps.fogstage.marks[mark].ent
    const s = { flags: Object.fromEntries(flags.map(f => [f, true])), session: false, view: 'iso', map: { plates: [], enemies: [] } }
    const line = e.talk.find(l => Z.condMet(s, W, l.when, -1))
    return `${line.lines.join(' / ')}${line.give ? ` [gives ${line.give}]` : ''}${line.set ? ` [sets ${line.set}]` : ''}`
  }
  const states = [['nobody met', []], ['the tape only', ['q.act.tape']], ['the Weight only', ['item:weightSources']], ['both, before done', ['q.act.tape', 'item:weightSources']], ['done only', ['q.act.done', 'q.act.tape']], ['done and the Weight', ['q.act.done', 'q.act.tape', 'item:weightSources']]]
  for (const [what, flags] of states) console.log(`  Vega, ${what}: ${say('b', flags)}`)
  for (const [what, flags] of [['nobody met', []], ['the Weight only', ['item:weightSources']], ['met', ['q.act.trap']], ['met and the Weight', ['q.act.trap', 'item:weightSources']]]) console.log(`  Birger, ${what}: ${say('a', flags)}`)
}

if (bad) { console.error(`\n${bad} things are not as meant`); process.exit(1) }
