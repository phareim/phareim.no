// THE LIGHTHOUSE: the play from its door to its Weight, on a game it did not make. `tests/zelda-lighthouse.test.mjs` plays it on
// the game it makes; `tests/zelda-whole-game.test.mjs` plays it with the one hero who goes through everything.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { walker } from '../zelda-walk.mjs'

let Z
let P
/** The engine the helpers here play on. */
export function use(engine) { Z = engine; P = walker(Z) }

/** The painter's own clock for the dark hound's eyes (`render/lighthouse.ts`). */
const { eyesShut } = await (async () => {
  const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: "export { eyesShut } from './themes/zelda/render/lighthouse'", resolveDir: repo, loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})()

export const FPS = 60
export const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, rollPress: false, cycle: false, autoFace: false, ...o })
const V = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** A fresh game standing at an entry of a map, with the blade and ten hearts, in play. */
export function at(map, entry, { seed = 7, inv = {}, flags = [] } = {}) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map, entry } })
  Object.assign(s.inv, { sword: true }, inv)
  for (const f of flags) s.flags[f] = true
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  s.hero.maxHp = s.hero.hp = 20
  return s
}

// ---- the scripted hero -----------------------------------------------------------------------------------------

/**
 * Plays ORCA's fight or the dark hound's on what a player can see: the strips on the floor, the gold bar and where the
 * foe (or its eyes) is. A strip with him in it, he steps out of it sideways after a quarter of a second; open, he runs
 * in and cuts; else he keeps three to four tiles off. With `lamp`, he also sets it: ORCA's as it announces a drag, to
 * shine across the lane; the hound's, in line with it, to shine at it. Every blow taken is counted.
 */
export function duel(s, e, seconds, { lamp = false, until = () => false } = {}) {
  const mem = { seen: 0, laid: -999 }
  const policy = f => {
    const h = s.hero
    const d = gap(h, e)
    const toward = (k = 1) => unit(e.x - h.x, e.y - h.y, k)
    const away = (k = 1) => unit(h.x - e.x, h.y - e.y, k)
    const open = e.kind === 'orca' ? Z.bossOpen(e) : Z.toughOpen(e)
    const strip = Z.stencilsOf(e)[0]
    mem.seen = strip ? mem.seen + 1 : 0
    const out = mem.seen > 12 ? outOf(s, strip) : null
    if (out) return inp({ move: out, rollPress: !h.roll && mem.seen > 26 })
    if (lamp && e.kind === 'orca' && !s.lamp && strip && e.ai.mode === 'dragTell' && mem.seen > 12) {
      const along = (h.x - strip.x0) * strip.ux + (h.y - strip.y0) * strip.uy
      const across = (h.y - strip.y0) * strip.ux - (h.x - strip.x0) * strip.uy
      if (along > 1.2 && along < strip.len + 0.5 && Math.abs(across) < 3.5) {
        const x = strip.uy * Math.sign(across)
        const y = -strip.ux * Math.sign(across)
        h.dir = Math.abs(x) > 0.5 ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up'
        return inp({ bPress: true })
      }
    }
    if (strip) return inp()
    if (open) return d < Z.SWORD_REACH + e.r - 0.15 ? inp({ move: toward(0.05), aPress: f % 4 === 0, a: true }) : inp({ move: toward() })
    // (The lamp left out a while and of no use now: back to it, and take it up.)
    if (s.lamp && f - mem.laid > 1.5 * FPS) {
      const l = { x: (s.lamp.idx % s.map.w) + 0.5, y: Math.floor(s.lamp.idx / s.map.w) + 0.5 }
      if (gap(h, l) > 1.5) return inp({ move: unit(l.x - h.x, l.y - h.y) })
      mem.laid = f
      return inp({ bPress: true })
    }
    if (lamp && e.kind === 'hound' && !s.lamp && d > 1.6 && d < 7) {
      const flat = Math.abs(e.x - h.x) > Math.abs(e.y - h.y)
      if (Math.abs(flat ? e.y - h.y : e.x - h.x) >= e.r - 0.15) return inp({ move: flat ? unit(0, e.y - h.y) : unit(e.x - h.x, 0) })
      h.dir = flat ? (e.x < h.x ? 'left' : 'right') : e.y < h.y ? 'up' : 'down'
      mem.laid = f
      return inp({ bPress: true })
    }
    if (d < 3.1) return inp({ move: away() })
    if (d > 4.2) return inp({ move: toward() })
    return inp({ move: toward(0.05) })
  }
  let hurts = 0
  let hp = s.hero.hp
  let f = 0
  s.inv.selected = 'lamp'
  for (; f < seconds * FPS && !e.dead && !until() && s.mode === 'play'; f++) {
    const standing = !!s.lamp
    Z.stepGame(Z.WORLD, s, 1 / FPS, policy(f))
    if (s.lamp && !standing) mem.laid = f
    if (s.hero.hp < hp) hurts++
    hp = s.hero.hp
  }
  return { seconds: f / FPS, hurts }
}

/** The way out of a strip: sideways from its middle line to whichever side has floor, else along it. Null when clear. */
function outOf(s, st) {
  const h = s.hero
  const along = (h.x - st.x0) * st.ux + (h.y - st.y0) * st.uy
  const across = (h.y - st.y0) * st.ux - (h.x - st.x0) * st.uy
  if (along < -0.35 || along > st.len + 0.35 || Math.abs(across) > st.w / 2 + 0.35) return null
  const side = across >= 0 ? 1 : -1
  for (const k of [side, -side]) {
    const way = { x: -st.uy * k, y: st.ux * k }
    const need = st.w / 2 + 0.35 - across * k
    if (!Z.circleBlocked(Z.WORLD, s.map, h.x + way.x * need, h.y + way.y * need, 0.34)) return way
  }
  return along > st.len / 2 ? { x: st.ux, y: st.uy } : { x: -st.ux, y: -st.uy }
}

/** From the door in Yule Fjord to the Weight, with the lamp found on the way and a reload. Returns the game as it ends (a reload on the way makes a new one). */
export function play(engine, g, opts = {}) {
  use(engine)
  const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]
  const step = (s, i = inp()) => Z.stepGame(Z.WORLD, s, 1 / FPS, i)
  const run = (s, n, i = inp()) => { for (let k = 0; k < n; k++) { s.hero.invuln = Math.max(s.hero.invuln, 0.2); step(s, i) } }
  /** Hold the stick until the hero stops moving (a slide over ice ends), or `max` frames. */
  const hold = (s, dir, max = 600) => {
    let still = 0
    for (let k = 0; k < max; k++) {
      s.hero.invuln = 1
      const x0 = s.hero.x
      const y0 = s.hero.y
      step(s, inp({ move: V[dir] }))
      if (Math.hypot(s.hero.x - x0, s.hero.y - y0) < 0.002) { if (++still > 30) break } else still = 0
    }
  }
  const press = (s, dir, frames) => { for (let k = 0; k < frames; k++) { s.hero.invuln = 1; step(s, inp({ move: V[dir] })) } }
  /** B with the lamp, facing `dir`; the lamp's room plays on for a moment. */
  const lamp = (s, dir, wait = 20) => {
    s.inv.selected = 'lamp'
    s.hero.dir = dir
    const ev = step(s, inp({ bPress: true }))
    run(s, wait)
    return ev
  }
  /** Stand at (x, y), face `dir` and press A: a chest, a lock, a mirror. */
  const open = (s, x, y, dir) => { P.walkTo(s, x, y); s.hero.dir = dir; P.pressA(s) }
  /** Through a doorway or onto stairs: walk on until the map or the room is what it should be. */
  const through = (s, pred, dir) => { P.until(s, () => pred() && s.mode === 'play', inp({ move: V[dir] }), 900); P.settle(s) }
  const wait = (s, secs) => run(s, Math.round(secs * FPS))
  // Before the Black Box nothing shields him: it walks and waits as a player does.
  const until = (s, pred, secs) => {
    for (let k = 0; k < secs * FPS && !pred() && s.mode === 'play'; k++) step(s)
    assert.ok(pred(), `not within ${secs} s (the Box ${s.map.enemies.find(e => e.kind === 'blackbox')?.ai.mode})`)
  }
  const walk = (s, tx, ty) => {
    let p = P.path(s, tx, ty)
    assert.ok(p, `a way to ${tx},${ty}`)
    for (let k = 0, i = 0; k < 600; k++) {
      const h = s.hero
      if (Math.floor(h.x) === tx && Math.floor(h.y) === ty && Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.12) return
      while (i < p.length - 1 && Math.hypot(h.x - p[i][0] - 0.5, h.y - p[i][1] - 0.5) < 0.25) i++
      step(s, inp({ move: unit(p[i][0] + 0.5 - h.x, p[i][1] + 0.5 - h.y) }))
    }
    assert.fail(`walked to ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}, wanted ${tx},${ty}`)
  }

  let s = g
  const hearts = s.hero.maxHp
  const pieces0 = s.inv.pieces

  // The door in the land, and the Foot: nothing in it but a cat, a sign and the way on.
  P.walkTo(s, 4, 32)
  through(s, () => s.map.id === 'lighthouse1', 'up')
  assert.equal(s.zoneIndex, 0)
  assert.equal(s.map.enemies.length === 0 || s.map.enemies.every(e => e.cell !== 0), true, 'no foe in the Foot')

  // The Parlour: the lamp, taught in the light. A beam along the one open row lights the receiver, and the key shows.
  P.walkTo(s, 15, 5)
  through(s, () => s.zoneIndex === 1, 'right')
  P.walkTo(s, 17, 5)
  s.hero.dir = 'up'
  P.walkTo(s, 23, 3)
  s.hero.dir = 'up'
  P.pressA(s)
  assert.equal(s.inv.lamp, true)
  assert.equal(s.inv.selected, 'lamp')
  P.walkTo(s, 23, 5)
  let ev = lamp(s, 'right', 5)
  assert.ok(ev.some(e => e.type === 'error') && !s.lamp, 'the lamp is refused on a pillar of the wall, and stays in the hand')
  P.walkTo(s, 17, 5)
  lamp(s, 'right', 40)
  assert.ok(s.lamp && !s.flags['lighthouse.parlour'], 'row 5 ends at a pillar of the wall: the receiver stays dark')
  step(s, inp({ bPress: true }))
  assert.equal(s.lamp, null)
  P.walkTo(s, 17, 6)
  lamp(s, 'right', 40)
  assert.deepEqual(s.lamp && [s.lamp.idx % s.map.w, Math.floor(s.lamp.idx / s.map.w), s.lamp.dir], [18, 6, 'right'])
  assert.equal(tile(s, 18, 6), 'Φ')
  assert.ok(s.flags['lighthouse.parlour'], 'the beam through the gap lights the receiver')
  wait(s, 1)
  assert.equal(tile(s, 30, 6), '$', 'the key shows behind it')
  // B again within 1.6 tiles takes it up; the tile gets its floor back.
  step(s, inp({ bPress: true }))
  assert.equal(s.lamp, null)
  assert.equal(tile(s, 18, 6), '.')
  open(s, 30, 5, 'down')
  assert.equal(s.inv.keyrings.lighthouse, 1, 'small key A')

  // Nothing pushed comes to rest on the tile the hero arrives on: the rim mirror pushed west and south stops above it (the
  // stair stays reachable), and slid along row 10 over the ice it stops a tile short.
  {
    const t = at('lighthouse0', 'stair')
    const to = (u, x, y) => Object.assign(u.hero, { x: x + 0.5, y: y + 0.5 })
    to(t, 4, 8); hold(t, 'left')
    to(t, 1, 7); hold(t, 'down')
    to(t, 1, 8); hold(t, 'down')
    assert.equal(tile(t, 1, 9), 'ν', 'the mirror stops above the arrival tile')
    assert.ok(tile(t, 1, 10) !== 'ν' && P.path(t, 1, 11), 'the stair is reached')
    const u = at('lighthouse0', 'stair')
    to(u, 3, 7); hold(u, 'down')
    to(u, 4, 10); hold(u, 'left')
    assert.ok(tile(u, 1, 10) !== 'ν' && P.path(u, 1, 11), 'a mirror slid along row 10 stops short of it')
  }

  // The way down: the Ice Store. The lamp, tested on salt ice, two mirrors, six things done.
  P.walkTo(s, 2, 5)
  through(s, () => s.map.id === 'lighthouse0', 'left')
  P.settle(s)
  assert.equal(s.zoneIndex, 0)
  assert.equal(tile(s, 14, 5), 'ω', 'the sluice holds the water back')
  P.walkTo(s, 2, 8)
  hold(s, 'right')
  P.walkTo(s, 2, 9)
  hold(s, 'right')
  hold(s, 'up')
  assert.equal(tile(s, 13, 3), 'ν', 'the first mirror rests at the top of column 13')
  s.hero.dir = 'up'
  P.swing(s, 'up')
  assert.equal(tile(s, 13, 3), 'μ')
  hold(s, 'down')
  hold(s, 'left')
  P.walkTo(s, 2, 6)
  hold(s, 'right')
  assert.equal(tile(s, 13, 6), 'ν', 'the second mirror rests in row 6, short of the water')
  s.hero.dir = 'right'
  P.swing(s, 'right')
  assert.equal(tile(s, 13, 6), 'μ')
  hold(s, 'left')
  P.walkTo(s, 2, 6)
  lamp(s, 'right', 40)
  assert.ok(s.flags['lighthouse.drained'], 'the beam goes east, up and east again into the sluice\'s eye')
  wait(s, 0.5)
  assert.equal(tile(s, 14, 5), 'ψ', 'the doorway is drained floor now')
  // The lamp does not slide, and does not hold a plate: it is simply taken up.
  P.walkTo(s, 3, 7)
  s.hero.dir = 'up'
  P.step(s, inp({ bPress: true }))
  assert.equal(s.lamp, null, 'B beside the lamp takes it up')

  // The Flooded Cellar: ORCA. Its card is read, the gate shuts behind the hero; the lamp across its drag stops it in
  // the light, and the blade does the rest while its oar is planted.
  P.walkTo(s, 3, 5)
  press(s, 'right', 100)
  through(s, () => s.zoneIndex === 1, 'right')
  wait(s, 0.1)
  assert.ok(s.flags['lighthouse.orca.met'] && s.mode === 'dialog', 'its card on the way in')
  P.settle(s)
  P.walkTo(s, 18, 5)
  wait(s, 0.3)
  assert.equal(tile(s, 16, 5), 'X', 'shut in')
  const orca = s.map.enemies.find(e => e.kind === 'orca' && e.cell === 1)
  assert.ok(orca && orca.once === 'lighthouse.orca')
  const lit = duel(s, orca, 60, { lamp: true, until: () => orca.stun > 0 })
  assert.ok(orca.stun > 0 && Z.bossOpen(orca) && orca.hp < 10, `the beam across the lane stops the drag and opens it (${lit.seconds.toFixed(1)} s)`)
  assert.equal(Z.stencilsOf(orca).length, 0, 'and its strike is off the floor')
  const fought = duel(s, orca, 60)
  assert.ok(orca.dead, `ORCA: ${orca.hp} left after ${fought.seconds.toFixed(1)} s, ${fought.hurts} blows taken`)
  assert.ok(s.flags['lighthouse.orca'])
  wait(s, 0.2)
  P.settle(s)
  assert.ok(s.flags['lighthouse.orca.fell'], 'the line as it falls')
  wait(s, 0.5)
  assert.equal(tile(s, 29, 9), '$', 'the chest of key B shows')
  open(s, 29, 8, 'down')
  assert.equal(s.inv.keyrings.lighthouse, 2, 'small key B')

  // Back up the stair, across the ice by row 5.
  P.walkTo(s, 17, 5)
  P.walkTo(s, 15, 5)
  hold(s, 'left')
  P.walkTo(s, 1, 10)
  through(s, () => s.map.id === 'lighthouse1', 'down')
  assert.equal(s.zoneIndex, 0)

  // The Foot's north alcove: the lock takes a key and the whole run opens.
  open(s, 7, 3, 'up')
  assert.equal(s.inv.keyrings.lighthouse, 1)
  assert.equal(tile(s, 7, 2), '.')
  assert.equal(tile(s, 8, 2), '.')
  P.walkTo(s, 7, 2)
  through(s, () => s.map.id === 'lighthouse2', 'up')

  // A reload here: the tab continues at the stair it came up, with the doors as opened, and the lamp in the hand.
  {
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    assert.equal(save.map, 'lighthouse2')
    assert.equal(save.entry, 'arrive')
    assert.ok(!save.flags.some(f => f.startsWith('seen:lighthouse')), 'no seen: flag for the tower')
    const spot = Z.loadSpot(Z.WORLD, save, { map: 'overworld', entry: 'start' }, true)
    assert.equal(spot, null, 'a tab that was in the tower continues where it saved')
    s = Z.createGame(Z.WORLD, { save, at: spot })
    s.mode = 'play'
    s.dialog = null
    s.hero.auto = null
    s.hero.maxHp = s.hero.hp = hearts
    assert.equal(s.map.id, 'lighthouse2')
    assert.equal(s.lamp, null)
    assert.equal(s.inv.lamp, true)
    assert.equal(s.inv.selected, 'lamp')
    assert.equal(s.inv.keyrings.lighthouse, 1)
    assert.ok(Z.has(s, 'lighthouse.drained') && Z.has(s, 'lighthouse.orca') && Z.has(s, 'lighthouse.parlour'))
  }

  // The Quarters: dark, three bats. The receiver across the boards lights the room for good.
  P.settle(s)
  assert.equal(s.zoneIndex, 0)
  const info = Z.mapInfo(Z.WORLD, 'lighthouse2')
  assert.equal(Z.cellIsDark(s, info, 0), true)
  assert.equal(s.map.enemies.filter(e => e.cell === 0 && e.kind === 'bat').length, 3)
  P.killCell(s)
  P.walkTo(s, 9, 3)
  lamp(s, 'left', 40)
  assert.ok(s.lamp && s.flags['lighthouse.quarters'], 'the beam crosses the boards')
  assert.equal(Z.cellIsDark(s, info, 0), false, 'the room is lit for good')
  step(s, inp({ bPress: true }))
  assert.equal(s.lamp, null)
  assert.equal(Z.cellIsDark(s, info, 0), false)
  // The heart: the mirror pushed into the nook, turned, and the lamp set on its row.
  P.walkTo(s, 11, 8)
  press(s, 'right', 50)
  assert.equal(tile(s, 13, 8), 'μ')
  s.hero.dir = 'right'
  P.swing(s, 'right')
  assert.equal(tile(s, 13, 8), 'ν')
  press(s, 'right', 50)
  assert.equal(tile(s, 14, 8), 'ν', 'the mirror stands in the nook')
  P.walkTo(s, 12, 8)
  lamp(s, 'right', 60)
  assert.ok(s.flags['lighthouse.heart'], 'the beam goes down over the board to the corner')
  wait(s, 1)
  assert.equal(tile(s, 14, 2), '.', 'the heart\'s gate is open')
  open(s, 14, 2, 'up')
  assert.equal(s.inv.pieces, (pieces0 + 1) % 4)
  step(s, inp({ bPress: true }))
  P.walkTo(s, 14, 5)
  s.hero.dir = 'right'
  press(s, 'right', 30)
  assert.equal(s.inv.keyrings.lighthouse, 0, 'the Quarters\' lock takes the second key')
  assert.equal(tile(s, 15, 5), '.')

  // The Oil Store: the dark hound, two eyes until the beam finds it. The gate shuts behind the hero.
  P.walkTo(s, 17, 6)
  through(s, () => s.zoneIndex === 1, 'right')
  wait(s, 0.1)
  assert.ok(s.flags['lighthouse.hound.met'], 'the room\'s line, read on the way in')
  P.walkTo(s, 17, 6)
  const hound = s.map.enemies.find(e => e.kind === 'hound' && e.cell === 1)
  assert.ok(hound && hound.tough && hound.dark && hound.once === 'lighthouse.hound')
  wait(s, 0.2)
  assert.equal(tile(s, 16, 5), 'X', 'shut in')
  const dark = Z.mapInfo(Z.WORLD, 'lighthouse2')
  assert.ok(Z.unseen(s, dark, hound), 'in the dark there is nothing of it but its eyes')
  // Its eyes blink on a clock of their own: a hound on the move shuts them as long and as seldom as one at rest.
  const blinks = x => Array.from({ length: 680 }, (_, k) => eyesShut({ ...hound, x: x(k), ai: { mode: 'prowl' } }, k / 100, false))
  const moving = blinks(k => hound.x - k / 40)
  assert.deepEqual(moving, blinks(() => hound.x))
  assert.equal(moving.filter(Boolean).length, 32, '0.16 s of every 3.4 s')
  assert.ok(!eyesShut(hound, 0, true), 'never under reduced motion')
  const found = duel(s, hound, 60, { lamp: true, until: () => hound.stun > 0 })
  assert.ok(Z.toughOpen(hound) && hound.hp < 10 && !Z.unseen(s, dark, hound), `the beam shows it, stuns it and burns it (${found.seconds.toFixed(1)} s)`)
  const fought2 = duel(s, hound, 60)
  assert.ok(hound.dead, `the dark hound: ${hound.hp} left after ${fought2.seconds.toFixed(1)} s, ${fought2.hurts} blows taken`)
  wait(s, 0.5)
  assert.equal(tile(s, 26, 9), '$', 'the Big Key shows')
  assert.equal(tile(s, 23, 2), '.', 'the gate over the stair is open')
  open(s, 26, 8, 'down')
  assert.ok(s.flags['bigkey:lighthouse'])
  P.walkTo(s, 23, 3)
  through(s, () => s.map.id === 'lighthouse3', 'up')

  // The Gallery: dark, two draugs on the ring. Three mirrors turned, the lamp up the east side, the beam goes round the
  // tower into the receiver in the west wall.
  assert.equal(s.zoneIndex, 0)
  assert.equal(s.map.enemies.filter(e => e.cell === 0 && e.kind === 'skull').length, 2)
  P.killCell(s)
  P.walkTo(s, 1, 6)
  lamp(s, 'down', 40)
  assert.ok(s.lamp && !s.flags['lighthouse.gallery'], 'the lamp near the receiver is not enough by itself')
  step(s, inp({ bPress: true }))
  open(s, 1, 3, 'up')
  assert.equal(tile(s, 1, 2), 'μ')
  open(s, 13, 3, 'up')
  assert.equal(tile(s, 13, 2), 'ν')
  open(s, 1, 8, 'down')
  assert.equal(tile(s, 1, 9), 'μ')
  P.walkTo(s, 13, 10)
  lamp(s, 'up', 80)
  assert.ok(s.flags['lighthouse.gallery'], 'the beam goes up, west, down and west to the receiver')
  wait(s, 1)
  assert.equal(tile(s, 14, 5), '.', 'the gate before the Big-Key door is open')
  // The Gallery is solved, and a mirror sent along row 2 and down column 2 stops above the arrival tile: the stairs stay
  // open. Leaving puts it home all the same (the gate stays open).
  walk(s, 14, 2)
  hold(s, 'left')
  walk(s, 2, 1)
  hold(s, 'down')
  assert.equal(tile(s, 2, 9), 'ν', 'the mirror stops above the arrival tile')
  assert.ok(tile(s, 2, 10) !== 'ν' && P.path(s, 1, 11) && P.path(s, 2, 11), 'both stair tiles are reached')
  P.walkTo(s, 14, 5)
  s.hero.dir = 'right'
  press(s, 'right', 30)
  assert.equal(tile(s, 15, 5), '.', 'the Big Key opens the great door')

  // The Lamp Room: the Black Box. Its card on the way in.
  through(s, () => s.zoneIndex === 1, 'right')
  assert.equal(s.zone.x, 16)
  wait(s, 0.1)
  assert.ok(s.flags['lighthouse.box.met'] && s.mode === 'dialog', 'its card')
  P.settle(s)
  const box = s.map.enemies.find(e => e.kind === 'blackbox' && e.cell === 1)
  assert.ok(box && box.once === 'lighthouse.box' && box.hp === 14)
  assert.equal(Z.cellIsDark(s, Z.mapInfo(Z.WORLD, 'lighthouse3'), 1), true)

  // A lamp shining straight at a receiver lights nothing: only the Box's own beam does.
  walk(s, 19, 5)
  walk(s, 24, 4)
  lamp(s, 'up', 40)
  assert.ok(s.lamp && s.map.phys.beams.some(b => b.src === 'lamp' && b.y1 === 2.5), 'the beam ends in the north receiver')
  assert.ok(!s.flags['lighthouse.box.n'], 'and does not light it')
  step(s, inp({ bPress: true }))

  // Three rounds, as the wirings are printed: for each face the answer is to leave, the face to shine into.
  const ROUNDS = [
    // TURN: N→E, E→S, S→W, W→N
    [['W', 'N'], ['N', 'E'], ['S', 'W']],
    // FUNNEL: N→W, E→W, S→N, W→E
    [['S', 'N'], ['W', 'E'], ['N', 'W']],
    // TWO FACES: the turn again, with pink out of the far side
    [['W', 'N'], ['N', 'E'], ['S', 'W']],
  ]
  const NUMBER = { N: 1, E: 2, S: 3, W: 4 }
  /** Where the hero stands and which way he sets the lamp, to shine into a face from its own lane. */
  // (The south one sets it on the pad against the pedestal, where the Weight will come to lie.)
  const SPOT = { N: [23, 2, 'down'], E: [29, 7, 'left'], S: [24, 9, 'up'], W: [19, 5, 'right'] }
  const hp = s.hero.hp
  let placed = 0
  const began = s.elapsed
  for (const [round, entries] of ROUNDS.entries()) {
    assert.ok(!['n', 'e', 'w'].some(f => s.flags[`lighthouse.box.${f}`]), 'the receivers are dark as a round begins')
    for (const [k, [into, out]] of entries.entries()) {
      const [x, y, dir] = SPOT[into]
      walk(s, x, y)
      lamp(s, dir, 0)
      placed++
      until(s, () => box.ai.mode === 'think', 2)
      // Before it fires, the face it will fire from is lit, by its number, and a dashed way lies from it.
      const marks = Z.stencilsOf(box)
      assert.deepEqual(marks.filter(m => m.t === 'face' && m.glow === 'cyan').map(m => m.n), [NUMBER[out]], `round ${round + 1}: into ${into}, out of ${out}`)
      assert.ok(marks.some(m => m.t === 'dash' && m.hue === 'cyan'))
      assert.equal(marks.some(m => m.t === 'dash' && m.hue === 'pink'), round === 2, 'pink beside it in the third round only')
      until(s, () => box.ai.mode === 'answer', 2)
      until(s, () => box.ai.mode !== 'answer', 3)
      assert.ok(s.flags[`lighthouse.box.${out.toLowerCase()}`], `round ${round + 1}: the ${out} receiver is lit`)
      assert.equal(box.ai.mode, k === 2 ? 'open' : 'idle')
      // A lamp taken up and set down again at once is heard afresh, though the face was just answered through.
      if (round === 0 && k === 0) {
        assert.ok(Z.stencilsOf(box).some(m => m.t === 'face' && m.dim && m.n === NUMBER[into]), 'the face its lamp stands at is dim')
        step(s, inp({ bPress: true }))
        assert.equal(s.lamp, null)
        lamp(s, dir, 0)
        until(s, () => box.ai.mode === 'think', 2)
        until(s, () => box.ai.mode === 'idle', 6)
      }
      // The lamp back in the hand: its beam does nothing to the Box.
      if (k === 2) assert.ok(Z.bossOpen(box))
    }
    const before = box.hp
    // Open: to the west pad, and cut until it shuts. (The lamp may still stand where it was: it is walked round.)
    walk(s, 22, 6)
    for (let f = 0; box.ai.mode === 'open' && !box.dead; f++) step(s, inp({ move: unit(24.5 - s.hero.x, 6.5 - s.hero.y, 0.05), a: true, aPress: f % 4 === 0 }))
    const took = before - Math.max(0, box.hp)
    assert.equal(took, Math.min(6, before), `round ${round + 1}: an opening gives six at most`)
    if (!box.dead) {
      until(s, () => box.ai.mode === 'idle', 4)
      assert.ok(!Z.bossOpen(box))
      // The lamp left standing asks the new wiring nothing. It is taken up from beside it.
      if (s.lamp) {
        run(s, 60)
        assert.equal(box.ai.mode, 'idle', 'a lamp left shining does not loop it')
        assert.ok(Z.stencilsOf(box).some(m => m.t === 'face' && m.dim), 'and the face it stands at says so')
        assert.ok(!['n', 'e', 'w'].some(f => s.flags[`lighthouse.box.${f}`]))
        const [lx, ly] = [s.lamp.idx % s.map.w, Math.floor(s.lamp.idx / s.map.w)]
        walk(s, lx + (lx < 24 ? -1 : 1), ly)
        step(s, inp({ bPress: true }))
        assert.equal(s.lamp, null)
        wait(s, 0.5)
      }
      // Out through the great door and back, wounded: the Box is at the round its hit points say, and keeps them.
      if (round === 0) {
        walk(s, 17, 5)
        through(s, () => s.zoneIndex === 0, 'left')
        through(s, () => s.zoneIndex === 1, 'right')
        run(s, 20)
        assert.deepEqual([box.hp, box.ai.round], [8, 1], 'a wounded Box comes back at round two, not at round one')
      }
    }
  }
  assert.equal(placed, 9, 'three placements a round')
  assert.ok(box.dead && s.flags['lighthouse.box'], `the Box falls in the third round (${box.hp} left)`)
  assert.equal(s.hero.hp, hp, `a hero who stays behind his lamp is never touched (${((s.elapsed - began)).toFixed(0)} s)`)
  assert.equal(s.lamp, null, 'the lamp is back in the hand')

  // It falls: its line, the room lit for good, and the Weight on the south pad.
  run(s, 5)
  assert.ok(s.flags['lighthouse.box.fell'] && s.mode === 'dialog')
  P.settle(s)
  assert.equal(Z.cellIsDark(s, Z.mapInfo(Z.WORLD, 'lighthouse3'), 1), false)
  P.walkTo(s, 24, 9)
  P.walkTo(s, 24, 8)
  P.settle(s)
  assert.ok(Z.hasWeight(s, 'weightReasons'), 'REASONS in hand')
  // Back in the Gallery the mirrors are home, solved or not, and the gate has stayed open.
  walk(s, 17, 5)
  through(s, () => s.zoneIndex === 0, 'left')
  assert.deepEqual([tile(s, 2, 9), tile(s, 13, 2), tile(s, 14, 5)], ['.', 'μ', '.'], 'the pushed mirror is home, the gate open')
  return s
}
