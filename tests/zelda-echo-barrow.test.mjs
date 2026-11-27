// Neon Shrine, THE ECHO BARROW (docs/worlds/atlas.md "The Echo Barrow"): the dungeon end to end. Scripted players walk
// and fight it with the pad's inputs, reading what a player sees (where things are, what a foe is doing, what is painted
// on the floor). Nobody plays it by hand before it ships, so the first test is the whole way through.
//   ECHO_LOG=1 prints how long each fight took and what it cost.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

let Z
let P
before(async () => { Z = await load(); P = walker(Z) })

const FPS = 60
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const gap = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

/** The barrow's rooms by name: the top-left tile of each (16 × 12 each). */
const ROOM = {
  answering: [0, 0], parrot: [16, 0], shield: [32, 0],
  mixtral: [0, 12], hall: [16, 12], crossing: [32, 12],
  porch: [16, 24], stones: [32, 24],
}
/** A tile of a room, by the room's own coordinates. */
const T = (room, x, y) => [ROOM[room][0] + x, ROOM[room][1] + y]
const tile = (s, [x, y]) => s.map.tiles[y * s.map.w + x]
const roomOf = s => Object.keys(ROOM).find(k => ROOM[k][0] === s.zone.x && ROOM[k][1] === s.zone.y)
/** How far a hero's middle may go in a room. */
const floor = room => ({ x0: ROOM[room][0] + 1.4, x1: ROOM[room][0] + 14.6, y0: ROOM[room][1] + 1.4, y1: ROOM[room][1] + 10.6 })

/** A game at an entry of a map with the blade, past any walk out of a door. */
function start(map, entry, seed, halfHearts) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map, entry } })
  Object.assign(s, { mode: 'play', dialog: null })
  s.inv.sword = true
  s.hero.auto = null
  s.hero.maxHp = s.hero.hp = halfHearts
  return s
}

/** A hand on the pad, for the game in `game.s` (a reload swaps it). */
function hands(game) {
  const step = (i = inp()) => Z.stepGame(Z.WORLD, game.s, 1 / FPS, i)
  /** `frames` frames of `i`; a press in it counts once. Nothing hurts: the way between fights. */
  const run = (frames, i = inp()) => {
    for (let k = 0; k < frames; k++) { game.s.hero.invuln = 1; step(k ? { ...i, aPress: false, bPress: false, rollPress: false } : i) }
  }
  const go = (room, x, y) => P.walkTo(game.s, ...T(room, x, y))
  const push = (x, y, frames = 40) => run(frames, inp({ move: { x, y } }))
  /** A swing facing `dir`, played out. */
  const swing = dir => { Object.assign(game.s.hero, { dir, aim: undefined, cooldown: 0 }); run(1, inp({ aPress: true, a: true })); run(30) }
  /** B with the echo in hand: leave one, facing `dir`. */
  const leave = dir => { game.s.inv.selected = 'echo'; game.s.hero.dir = dir; run(1, inp({ bPress: true })); run(15); assert.ok(game.s.echo, 'an echo is left') }
  /** The lines now up, read to the end. */
  const read = () => {
    const lines = []
    for (let k = 0; k < 900 && game.s.mode !== 'play'; k++) {
      if (game.s.mode !== 'dialog') { step(); continue }
      for (const l of game.s.dialog.lines) if (!lines.includes(l)) lines.push(l)
      step(inp({ aPress: true, a: true }))
    }
    run(30)
    return lines
  }
  /** Face `dir` and press A: what was said. */
  const press = dir => { game.s.hero.dir = dir; run(1, inp({ aPress: true, a: true })); return read() }
  /** On through a doorway into the next room: what is said there on arriving, if anything. */
  const into = (room, x, y) => {
    for (let k = 0; k < 600 && !(roomOf(game.s) === room && game.s.mode !== 'scroll'); k++) { game.s.hero.invuln = 1; step(inp({ move: { x, y } })) }
    assert.equal(roomOf(game.s), room)
    run(2)
    return read()
  }
  const turn = view => assert.ok(Z.setViewRule(game.s, view), `STAND CLEAR turning to ${view} at ${game.s.hero.x.toFixed(2)},${game.s.hero.y.toFixed(2)}`)
  return { step, run, go, push, swing, leave, read, press, into, turn }
}

// ---- the players ----------------------------------------------------------------------------------------------

/** Plays a fight, hearts and all, until the foes are down, the hero is, or `seconds` are up. */
function fight(s, foes, policy, seconds) {
  let hurts = 0
  let hp = s.hero.hp
  let f = 0
  const mem = {}
  for (; f < seconds * FPS && s.mode === 'play' && foes.some(e => !e.dead); f++) {
    Z.stepGame(Z.WORLD, s, 1 / FPS, policy(s, foes[0], f, mem))
    if (s.hero.hp < hp) hurts++
    hp = s.hero.hp
  }
  return { won: foes.every(e => e.dead), hurts, seconds: f / FPS, left: foes.map(e => e.hp) }
}
const log = (who, r) => { if (process.env.ECHO_LOG) console.log(`${who}: ${r.won ? 'won' : 'lost'} in ${r.seconds.toFixed(1)} s, ${r.hurts} blows taken`) }

/** Mixtral: stands off in line to be charged, steps out of the painted lane, cuts it while it is dazed. */
function dancer(s, e, f) {
  const h = s.hero
  const b = floor('mixtral')
  const d = gap(h, e)
  const mode = e.ai.mode
  if (mode === 'tell' || mode === 'charge') {
    const flat = e.dir === 'left' || e.dir === 'right'
    const off = flat ? h.y - e.y : h.x - e.x
    if (Math.abs(off) > 1.45) return inp()
    const [lo, hi, mid] = flat ? [b.y0, b.y1, e.y] : [b.x0, b.x1, e.x]
    let way = off >= 0 ? 1 : -1
    // No room that side to get clear: across the lane to the other.
    if (way > 0 ? hi - mid < 1.5 : mid - lo < 1.5) way = -way
    return inp({ move: flat ? { x: 0, y: way } : { x: way, y: 0 } })
  }
  if (mode === 'dazed') {
    if (d > e.r + 0.95) return inp({ move: unit(e.x - h.x, e.y - h.y) })
    return inp({ move: unit(e.x - h.x, e.y - h.y, 0.05), aPress: f % 5 === 0 })
  }
  if (mode === 'rouse') return inp({ move: unit(h.x - e.x, h.y - e.y) })
  const east = e.x + 5 <= b.x1 ? 1 : -1
  const goal = { x: Math.max(b.x0, Math.min(b.x1, e.x + east * 5.5)), y: Math.max(b.y0, Math.min(b.y1, e.y)) }
  if (d < 2.6) return inp({ move: unit(h.x - e.x + (goal.x - h.x) * 0.5, h.y - e.y + (h.y < (b.y0 + b.y1) / 2 ? 2 : -2)) })
  if (gap(h, goal) < 0.3) return inp()
  return inp({ move: unit(goal.x - h.x, goal.y - h.y) })
}

/** In the Shield Hall: the way to step that keeps clear of the knights, their charges and the walls. */
function clear(s, knights, want = null) {
  const h = s.hero
  const b = floor('shield')
  let best = { x: 0, y: 0 }
  let score = -Infinity
  for (let k = 0; k <= 16; k++) {
    const m = k === 16 ? { x: 0, y: 0 } : { x: Math.cos((k * Math.PI) / 8), y: Math.sin((k * Math.PI) / 8) }
    const x = h.x + m.x * 0.8
    const y = h.y + m.y * 0.8
    if (k < 16 && (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1 || Z.circleBlocked(Z.WORLD, s.map, x, y, 0.34))) continue
    let v = 0
    for (const e of knights) {
      if (e.dead) continue
      const d = Math.hypot(x - e.x, y - e.y)
      v -= d < 1.5 ? (1.5 - d) * 40 : 0
      v -= Math.max(0, 3.5 - d) * 2
      if (e.ai.mode === 'tell' || e.ai.mode === 'charge') {
        const flat = e.dir === 'left' || e.dir === 'right'
        const ahead = (flat ? x - e.x : y - e.y) * (e.dir === 'left' || e.dir === 'up' ? -1 : 1)
        const off = Math.abs(flat ? y - e.y : x - e.x)
        if (ahead > -1 && off < 1.5) v -= (1.5 - off) * 30 + 10
      }
    }
    v -= Math.max(0, 2 - Math.min(x - b.x0, b.x1 - x)) + Math.max(0, 2 - Math.min(y - b.y0, b.y1 - y))
    if (want) v += (m.x * want.x + m.y * want.y) * 3
    if (v > score) { score = v; best = m }
  }
  return best
}

/**
 * The knights, with the echo: it leaves the echo in a knight's way; once one has walked past, so that the echo stands
 * at its back or side, the hero cuts from wherever they are and the echo's blade lands. A dazed one it cuts itself.
 */
function echoer(knights, tally) {
  return (s, e, f, mem) => {
    const h = s.hero
    const live = knights.filter(k => !k.dead)
    const behind = k => {
      const o = s.echo
      if (!o || Math.hypot(o.x - k.x, o.y - k.y) > 1.15 + k.r) return false
      const fx = k.dir === 'left' ? -1 : k.dir === 'right' ? 1 : 0
      const fy = k.dir === 'up' ? -1 : k.dir === 'down' ? 1 : 0
      return (o.x - k.x) * fx + (o.y - k.y) * fy <= 0.2 * Math.hypot(o.x - k.x, o.y - k.y)
    }
    const back = live.find(k => k.ai.mode !== 'dazed' && behind(k))
    if (back && !h.swing && h.cooldown <= 0 && live.every(k => gap(h, k) > 1.7)) {
      tally.cuts++
      return inp({ move: unit(h.x - back.x, h.y - back.y, 0.05), aPress: true })
    }
    const open = live.filter(k => k.ai.mode === 'dazed' && gap(h, k) < 6).sort((a, b) => gap(h, a) - gap(h, b))[0]
    if (open) {
      const others = live.filter(k => k !== open)
      const danger = others.some(k => gap(h, k) < 1.8)
      if (!danger && gap(h, open) > open.r + 1) return inp({ move: clear(s, others, unit(open.x - h.x, open.y - h.y, 2)) })
      if (!danger) return inp({ move: unit(open.x - h.x, open.y - h.y, 0.05), aPress: f % 5 === 0 })
    }
    const near = live.filter(k => k.ai.mode === 'walk').sort((a, b) => gap(h, a) - gap(h, b))[0]
    const useless = !s.echo || live.every(k => gap(s.echo, k) > 3.2)
    if (near && useless && (mem.laid ?? -99) < f - 40) {
      const d = gap(h, near)
      if (d > 1.9 && d < 2.9) { mem.laid = f; return inp({ bPress: true }) }
      if (d >= 2.9) return inp({ move: clear(s, knights, unit(near.x - h.x, near.y - h.y)) })
    }
    if (s.echo && near && gap(s.echo, near) <= 3.2) return inp({ move: clear(s, knights, unit(s.echo.x - near.x, s.echo.y - near.y, 1.5)) })
    return inp({ move: clear(s, knights) })
  }
}

/**
 * The Parrot, with the blade alone: while it listens it is given something to say (a cut, a spin charged out of it,
 * a roll); the hero never stands in the paint, keeps its body at arm's length, and cuts it only while it thinks. `seen` collects the
 * shapes it was shown.
 */
function listener(seen) {
  return (s, e, f, mem) => {
    const h = s.hero
    const b = floor('parrot')
    const stencils = Z.stencilsOf(e)
    for (const p of stencils) seen.add(`${p.dim ? 'copy ' : ''}${p.t}`)
    const bad = (x, y) => stencils.some(p => [[0, 0], [0.2, 0], [-0.2, 0], [0, 0.2], [0, -0.2]].some(([a, c]) => Z.inStencil(p, x + a, y + c)))
    const mode = e.ai.mode
    if (mode === 'think' && !bad(h.x, h.y) && e.ai.t > 0.15) {
      if (gap(h, e) > e.r + 0.85) return inp({ move: unit(e.x - h.x, e.y - h.y) })
      return inp({ move: unit(e.x - h.x, e.y - h.y, 0.05), aPress: f % 6 === 0 })
    }
    const body = mode === 'listen' || mode === 'recite'
    let best = { x: 0, y: 0 }
    let score = -Infinity
    for (let k = 0; k <= 24; k++) {
      const m = k === 24 ? { x: 0, y: 0 } : { x: Math.cos((k * Math.PI) / 12), y: Math.sin((k * Math.PI) / 12) }
      let v = k === 24 ? 0.5 : 0
      for (const [reach, w] of [[0.3, 1], [0.9, 1], [1.8, 0.6]]) {
        const x = h.x + m.x * reach
        const y = h.y + m.y * reach
        if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1 || Z.circleBlocked(Z.WORLD, s.map, x, y, 0.34)) { v -= 30 * w; continue }
        if (bad(x, y)) v -= 20 * w
        if (body) v -= Math.max(0, 2.2 - Math.hypot(x - e.x, y - e.y)) * 15 * w
        v -= (Math.max(0, 2 - Math.min(x - b.x0, b.x1 - x)) + Math.max(0, 2 - Math.min(y - b.y0, b.y1 - y))) * w
      }
      v -= Math.abs(Math.hypot(h.x + m.x - e.x, h.y + m.y - e.y) - 3.5)
      if (v > score) { score = v; best = m }
    }
    // Something to say: a cut early in its listening, a roll in the middle, a spin charged toward its end.
    const at = t => mode === 'listen' && Math.abs(e.ai.t - t) < 0.5 / FPS
    if (at(2.2)) mem.hold = 56
    if (mem.hold > 0) { mem.hold--; return inp({ move: unit(best.x, best.y, 0.5), a: mem.hold > 2, aPress: mem.hold === 55 }) }
    return inp({ move: best, rollPress: at(0.7) })
  }
}

// ================================================================================================================

describe('the Echo Barrow', () => {
  it('is played from the door in Seter Fell to the Weight in hand, with a reload of the tab halfway', () => {
    const game = { s: start('seterfell', 'mounds', 11, 20) }
    const { run, go, push, swing, leave, read, press, into, turn } = hands(game)
    let s = game.s
    const elder = () => { P.walkTo(s, 12, 21); return press('left') }
    assert.deepEqual(elder(), ['MOUND ELDER: THE HALL UNDER US ANSWERS BACK. IT USED TO WAIT TO BE ASKED.'])

    // The stairs south of the small mound, and their sign.
    P.walkTo(s, 20, 27)
    assert.deepEqual(press('right'), ['THE ECHO BARROW.\nKNOCK, AND IT KNOCKS FIRST.'])
    P.until(s, () => s.map.id === 'echobarrow' && s.mode === 'play', inp({ move: { x: 0, y: -1 } }))
    assert.equal(roomOf(s), 'porch')
    go('porch', 4, 8)
    assert.match(press('right')[0], /SHOUTED HELLO/)

    // East, the Turning Stones: square blocks are floor in the isometric view, diamond ones in the flat one.
    turn('iso')
    go('porch', 14, 5)
    into('stones', 1, 0)
    go('stones', 2, 5)
    assert.match(press('up')[0], /ONE SIDE/)
    go('stones', 6, 5)
    turn('flat')
    go('stones', 11, 3)
    press('up')
    assert.equal(s.inv.keyrings.echobarrow, 1, 'small key A')
    // The heart piece, behind three rows in turn: each wants the other view.
    go('stones', 11, 4)
    turn('iso')
    push(0, 1)
    turn('flat')
    push(0, 1)
    turn('iso')
    go('stones', 11, 10)
    read()
    assert.equal(s.inv.pieces, 1, 'the heart piece')
    go('stones', 11, 8)
    turn('flat')
    go('stones', 11, 6)
    turn('iso')
    go('stones', 10, 4)
    turn('flat')
    go('stones', 6, 5)
    turn('iso')
    go('stones', 1, 5)
    into('porch', -1, 0)

    // The hall: the great lock holds, and so does the shutter on the east way, key in hand.
    go('porch', 7, 1)
    into('hall', 0, -1)
    go('hall', 7, 1)
    push(0, -1)
    assert.match(press('up')[0], /GREAT LOCK/)
    go('hall', 13, 8)
    push(1, 0)
    assert.equal(tile(s, T('hall', 14, 8)), 'X')
    assert.equal(s.inv.keyrings.echobarrow, 1)

    // West, with key A. Mixtral: the ways shut, its card, the fight, THE ECHO.
    go('hall', 1, 5)
    push(-1, 0, 20)
    assert.equal(s.inv.keyrings.echobarrow, 0)
    assert.deepEqual(into('mixtral', -1, 0), ['MIXTRAL. EIGHT OPINIONS AND ONE HEADACHE.'])
    push(-1, 0, 20)
    assert.equal(tile(s, T('mixtral', 15, 5)), 'X', 'shut in')
    const mixtral = s.map.enemies.find(e => e.kind === 'mixtral')
    const m = fight(s, [mixtral], dancer, 90)
    log('Mixtral', m)
    assert.ok(m.won, `Mixtral: ${m.left} left, ${m.hurts} blows`)
    assert.equal(m.hurts, 0, 'a hero who steps out of the lane and cuts it dazed is not touched')
    run(90)
    go('mixtral', 7, 7)
    assert.deepEqual(press('up'), ['YOU GOT THE ECHO!', '{B} LEAVES ONE WHERE YOU STAND. WHEN YOU CUT, IT CUTS.'])
    assert.equal(s.inv.selected, 'echo')

    // North, the Answering Room: the gate is open only while the plate is stood on. The echo can stand there.
    go('mixtral', 7, 1)
    into('answering', 0, -1)
    go('answering', 3, 8)
    run(2)
    assert.equal(tile(s, T('answering', 10, 5)), '.', 'the plate opens it')
    go('answering', 7, 5)
    assert.equal(tile(s, T('answering', 10, 5)), 'X', 'shut as soon as the plate is left')
    go('answering', 3, 8)
    assert.match(press('left')[0], /WHOEVER STANDS HERE/)
    leave('right')
    go('answering', 13, 4)
    press('up')
    assert.equal(s.inv.keyrings.echobarrow, 1, 'small key B')

    // ---- the tab is reloaded here: what the shell saves, and where it starts again -----------------------------
    const stored = JSON.stringify(Z.toSave(s))
    // (The shell notes with every save whether a reload should stay out, and passes the way last used in town.)
    const out = Z.awayMap(Z.WORLD, s.entry.map, s.entry.entry)
    const save = Z.parseSave(JSON.parse(stored))
    const at = Z.loadSpot(Z.WORLD, save, { map: 'overworld', entry: 'hut' }, out)
    game.s = s = Z.createGame(Z.WORLD, { save, at })
    assert.equal(s.map.id, 'echobarrow', 'a tab reloaded in the barrow comes back in it')
    run(60)
    assert.equal(roomOf(s), 'porch')
    assert.equal(s.flags['seen:echobarrow'], undefined, 'and it is no land on any chart')
    assert.deepEqual([s.inv.selected, s.inv.keyrings.echobarrow, s.inv.pieces, s.echo], ['echo', 1, 1, null])
    for (const door of [T('hall', 0, 5), T('answering', 10, 5)]) assert.equal(tile(s, door), '.', `still open: ${door}`)
    s.view = 'iso'

    // East, with key B. The Crossing: the blade at the switch only raises the row just crossed; the echo cuts it from afar.
    go('porch', 7, 1)
    into('hall', 0, -1)
    go('hall', 13, 8)
    push(1, 0)
    assert.equal(s.inv.keyrings.echobarrow, 0)
    into('crossing', 1, 0)
    go('crossing', 6, 9)
    swing('down')
    push(0, -1, 90)
    assert.ok(s.hero.y > ROOM.crossing[1] + 7, 'the first row is up')
    go('crossing', 6, 9)
    swing('down')
    go('crossing', 6, 4)
    swing('down')
    push(0, -1, 90)
    assert.ok(s.hero.y > ROOM.crossing[1] + 4, 'the second row is up, and the switch out of reach from here')
    go('crossing', 6, 9)
    leave('down')
    go('crossing', 6, 4)
    swing('up')
    go('crossing', 5, 1)

    // North, the Shield Hall: shut in with two knights; the echo gets behind them. The Big Key, and the lever.
    into('shield', 0, -1)
    run(20)
    assert.equal(tile(s, T('shield', 5, 11)), 'X', 'shut in')
    const knights = s.map.enemies.filter(e => e.kind === 'knight')
    assert.equal(knights.length, 2)
    const tally = { cuts: 0 }
    const k = fight(s, knights, echoer(knights, tally), 150)
    log(`the knights (${tally.cuts} cuts from behind)`, k)
    assert.ok(k.won, `the knights: ${k.left} left, ${k.hurts} blows`)
    assert.ok(tally.cuts > 0, 'the echo was cut with')
    run(30)
    s.echo = null
    go('shield', 7, 3)
    press('up')
    assert.ok(Z.hasBigKey(s, 'echobarrow'), 'the Big Key')
    go('shield', 11, 9)
    swing('down')
    run(20)

    // The short way down, the great lock, the Parrot.
    go('shield', 13, 10)
    into('crossing', 0, 1)
    go('crossing', 1, 8)
    into('hall', -1, 0)
    go('hall', 7, 1)
    push(0, -1, 20)
    assert.deepEqual(into('parrot', 0, -1), ['THE STOCHASTIC PARROT. IT HAS HEARD EVERYTHING. IT HAS UNDERSTOOD NONE OF IT.'])
    const parrot = s.map.enemies.find(e => e.kind === 'parrot')
    s.hero.hp = s.hero.maxHp
    const seen = new Set()
    const p = fight(s, [parrot], listener(seen), 90)
    log('the Parrot', p)
    assert.ok(p.won, `the Parrot: ${p.left} left after ${p.seconds} s, ${p.hurts} blows`)
    assert.equal(p.hurts, 0, 'a hero who stays out of the paint and cuts it only while it thinks is not touched')
    for (const shape of ['arc', 'ring', 'lane', 'copy arc', 'copy ring', 'copy lane']) assert.ok(seen.has(shape), `never shown a ${shape}: ${[...seen]}`)

    // The room's line; the Weight, where it fell.
    const lies = { x: parrot.x, y: parrot.y }
    run(2)
    assert.deepEqual(read(), ['(THE HALL IS QUIET. YOUR OWN HELLO COMES BACK, ONCE, AND STOPS.)'])
    if (!s.flags['item:weightMeaning']) {
      const w = s.map.pickups.find(o => o.item === 'weightMeaning')
      assert.ok(w && !w.hidden && gap(w, lies) < 0.01, 'the Weight lies where the Parrot fell')
      P.walkTo(s, Math.floor(w.x), Math.floor(w.y), { keepDialog: true })
    }
    read()
    assert.ok(Z.hasWeight(s, 'weightMeaning'), 'THE WEIGHT OF MEANING, in hand')
    run(60)
    assert.equal(s.mode, 'play', 'the room\'s line is said once')

    // Home, up the stairs, to the elder.
    go('parrot', 7, 10)
    into('hall', 0, 1)
    go('hall', 7, 10)
    into('porch', 0, 1)
    go('porch', 7, 10)
    P.until(s, () => s.map.id === 'seterfell' && s.mode === 'play', inp({ move: { x: 0, y: 1 } }))
    assert.deepEqual(elder(), ['MOUND ELDER: QUIET DOWN THERE NOW. I ASKED IT THE TIME. IT SAID NOTHING. LOVELY.'])
  })

  it('beats a hero who stands still before the Parrot, and puts them back in the porch', () => {
    for (const seed of [1, 2, 3, 4]) {
      const game = { s: start('echobarrow', 'start', seed, 12) }
      const { go, push, into, step } = hands(game)
      const s = game.s
      s.flags['bigkey:echobarrow'] = true
      go('porch', 7, 1)
      into('hall', 0, -1)
      go('hall', 7, 1)
      push(0, -1, 20)
      into('parrot', 0, -1)
      go('parrot', 3 + seed * 2, 6 + (seed % 3))
      let f = 0
      for (; f < 90 * FPS && s.mode !== 'dying'; f++) step()
      assert.equal(s.mode, 'dying', `seed ${seed}: stood 90 s and lived, ${s.hero.hp} half hearts left`)
      if (process.env.ECHO_LOG) console.log(`standing still, seed ${seed}: fell after ${(f / FPS).toFixed(1)} s`)
      for (let n = 0; n < 3 * FPS; n++) step()
      assert.equal(s.mode, 'play')
      assert.equal(roomOf(s), 'porch')
      assert.equal(tile(s, T('hall', 7, 0)), '.', 'the great lock stays open')
      assert.ok(!Z.hasWeight(s, 'weightMeaning'))
    }
  })

  it('never saves the echo, and loads a save with it on B', () => {
    const game = { s: start('echobarrow', 'start', 3, 6) }
    const { run, leave } = hands(game)
    Z.grant(game.s, 'echo')
    run(20, inp({ move: { x: 0, y: -1 } }))
    leave('up')
    const withEcho = Z.toSave(game.s)
    const echo = game.s.echo
    game.s.echo = null
    assert.deepEqual(withEcho, Z.toSave(game.s), 'a save is the same with an echo left as without one')
    game.s.echo = echo
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(game.s))))
    assert.deepEqual([save.inv.echo, save.inv.selected], [true, 'echo'])
    game.s = Z.createGame(Z.WORLD, { save, at: { map: save.map, entry: save.entry } })
    assert.equal(game.s.echo, null)
    run(30)
    run(1, inp({ bPress: true }))
    assert.ok(game.s.echo, 'and B leaves one')
  })

  it('is a valid map with as many small keys as locked doors, and one big key for its great lock', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    const info = Z.mapInfo(Z.WORLD, 'echobarrow')
    /** Doors of `ch`: runs of touching lock tiles (one key opens a run). */
    const doors = ch => {
      const seen = new Set()
      let n = 0
      info.base.forEach((t, i) => {
        if (t !== ch || seen.has(i)) return
        n++
        for (const q = [i]; q.length;) { const j = q.pop(); if (seen.has(j) || info.base[j] !== ch) continue; seen.add(j); q.push(j + 1, j - 1, j + info.w, j - info.w) }
      })
      return n
    }
    const ring = Object.values(Z.WORLD.maps).filter(d => d.keyring === info.def.keyring)
    assert.deepEqual(ring.map(d => d.id), ['echobarrow'], 'a keyring of its own')
    const chests = info.chestList.map(c => c.item)
    assert.deepEqual([doors('L'), chests.filter(i => i === 'smallKey').length], [2, 2])
    assert.deepEqual([doors('K'), chests.filter(i => i === 'bigKey').length], [1, 1])
  })
})
