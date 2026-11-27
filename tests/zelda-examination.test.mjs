// Neon Shrine, THE EXAMINATION (docs/games/neon-shrine-examination.md): the test behind the Puzzle Lab, played by a
// scripted hero with the blade and what the dungeon gives, and the shape its maps must keep. At most four tests live
// here. `EXAM_LOG=1`: what each round cost.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const FPS = 60
const LOG = (...what) => { if (process.env.EXAM_LOG) console.log(...what) }
const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const unit = (x, y, k = 1) => { const d = Math.hypot(x, y) || 1; return { x: (x / d) * k, y: (y / d) * k } }
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }

/** The rooms by name: the top-left tile of each (cells of 16 × 12). */
const ROOM = { marking: [0, 0], r4: [16, 0], perch: [32, 0], r3: [48, 0], desk: [0, 12], r1: [16, 12], r2: [32, 12], staff: [48, 12] }
/** A tile of a room, by the room's own coordinates. */
const T = (room, x, y) => [ROOM[room][0] + x, ROOM[room][1] + y]
const roomOf = s => (s.map.id === 'examination' ? Object.keys(ROOM).find(k => ROOM[k][0] === s.zone.x && ROOM[k][1] === s.zone.y) : s.map.id)
const tile = (s, x, y) => s.map.tiles[y * s.map.w + x]

/**
 * A hero who plays: it walks by path, presses A, and takes every blow that comes (it has `hearts` so they can be
 * counted). Nothing is written into the game but the hero's own hearts at the start.
 */
function player(s) {
  const seen = []
  const p = { s, seen, frames: 0, hurts: 0 }
  p.step = (i = inp()) => {
    const ev = Z.stepGame(Z.WORLD, s, 1 / FPS, i)
    p.frames++
    for (const e of ev) { seen.push(e); if (e.type === 'hurt' || e.type === 'shock') p.hurts++ }
    assert.notEqual(s.mode, 'dying', `died in ${roomOf(s)}`)
    return ev
  }
  p.wait = secs => { for (let k = 0; k < secs * FPS; k++) p.step() }
  /** Read whatever is being said, to its end. */
  p.settle = () => {
    for (let k = 0; k < 900 && s.mode !== 'play'; k++) p.step(inp({ aPress: s.mode === 'dialog' && k % 20 === 19 }))
    for (let k = 0; k < 90 && s.hero.talkRest > 0; k++) p.step()
  }
  const open = (x, y) => x >= 0 && y >= 0 && x < s.map.w && y < s.map.h && !Z.solidTile(Z.WORLD, s.map, x, y, 'hero') && tile(s, x, y) !== 'O'
  /** The tiles from the hero to (tx, ty), or null. `shut(x, y)`: tiles to keep off. */
  p.path = (tx, ty, shut = () => false) => {
    const start = [Math.floor(s.hero.x), Math.floor(s.hero.y)]
    const key = (x, y) => y * s.map.w + x
    const prev = new Map([[key(...start), null]])
    const q = [start]
    while (q.length) {
      const [x, y] = q.shift()
      if (x === tx && y === ty) {
        const out = []
        for (let c = [x, y]; c; c = prev.get(key(...c))) out.unshift(c)
        return out
      }
      for (const [dx, dy] of Object.values(DIRS)) {
        const nx = x + dx
        const ny = y + dy
        if (prev.has(key(nx, ny)) || !open(nx, ny) || ((nx !== tx || ny !== ty) && shut(nx, ny))) continue
        prev.set(key(nx, ny), [x, y])
        q.push([nx, ny])
      }
    }
    return null
  }
  /** One frame's push toward the point (x, y), along a path; false when no path leads there. */
  p.toward = (x, y, shut) => {
    const path = p.path(Math.floor(x), Math.floor(y), shut)
    if (!path) return false
    const h = s.hero
    let [gx, gy] = [x, y]
    if (path.length > 1) {
      // The middle of this tile first when the next one lies round a corner from here.
      const [cx, cy] = path[0]
      const [nx, ny] = path[1]
      const off = nx !== cx ? Math.abs(h.y - cy - 0.5) : Math.abs(h.x - cx - 0.5)
      ;[gx, gy] = off > 0.2 ? [cx + 0.5, cy + 0.5] : [nx + 0.5, ny + 0.5]
    }
    const d = Math.hypot(gx - h.x, gy - h.y)
    p.step(inp({ move: unit(gx - h.x, gy - h.y, Math.min(1, Math.max(0.12, d * 6))) }))
    return true
  }
  /** Walk to the middle of a tile of a room and stop there; ends early if the map or the room changes. */
  p.walk = (room, x, y, shut) => {
    const [tx, ty] = T(room, x, y)
    const map = s.map.id
    for (let k = 0; k < 1200; k++) {
      if (s.map.id !== map) return
      if (s.mode !== 'play') { p.step(); continue }
      if (Math.hypot(s.hero.x - tx - 0.5, s.hero.y - ty - 0.5) < 0.1) { p.step(); return }
      assert.ok(p.toward(tx + 0.5, ty + 0.5, shut), `no way to ${room} ${x},${y} from ${roomOf(s)} ${s.hero.x.toFixed(1)},${s.hero.y.toFixed(1)}`)
    }
    assert.fail(`walking to ${room} ${x},${y} took too long, at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}`)
  }
  /** Walk out of a doorway: hold the stick `dir` until the room or the map is another and play goes on. */
  p.leave = dir => {
    const was = roomOf(s)
    const [x, y] = DIRS[dir]
    for (let k = 0; k < 400; k++) {
      p.step(inp({ move: s.mode === 'play' && roomOf(s) === was ? { x, y } : { x: 0, y: 0 } }))
      if (roomOf(s) !== was && s.mode === 'play') return
    }
    assert.fail(`no way ${dir} out of ${was}, at ${s.hero.x.toFixed(2)},${s.hero.y.toFixed(2)}`)
  }
  /** Face `dir` and press A once. */
  p.press = dir => {
    if (dir) { s.hero.dir = dir; s.hero.aim = undefined }
    p.step(inp({ a: true, aPress: true }))
  }
  return p
}

/** A new hero with the blade at the stair in the Puzzle Lab's last room. */
function atTheLab(seed) {
  const s = Z.createGame(Z.WORLD, { seed, at: { map: 'puzzlelab', entry: 'from-exam' } })
  s.inv.sword = true
  s.hero.maxHp = s.hero.hp = 30
  s.mode = 'play'
  s.dialog = null
  s.hero.auto = null
  return s
}

// ---------------------------------------------------------------------------
// Round one: pots and stones, no blade
// ---------------------------------------------------------------------------

/**
 * Throws what the room lends until `want` foes are down, one of them dropped in a pit. It fetches the nearest pot or
 * stone, walks to a line with a foe (best: with a pit just past it) and throws along it.
 */
function throwAtFoes(p, want) {
  const { s } = p
  const foes = () => s.map.enemies.filter(e => e.cell === s.zoneIndex)
  const downed = () => foes().filter(e => e.dead).length
  const fell = () => p.seen.filter(e => e.type === 'fall').length
  const falls = fell()
  const at = (x, y) => tile(s, Math.floor(x), Math.floor(y))
  let thrown = 0
  /** Where each foe was a step ago: a throw is aimed at where it will be. */
  const was = new Map()
  for (let k = 0; k < 150 * FPS; k++) {
    if (s.map.exam?.over || (downed() >= want && fell() > falls)) return { thrown, down: downed(), falls: fell() - falls }
    const h = s.hero
    if (s.mode !== 'play' || h.act === 'lift' || h.act === 'hurt' || h.act === 'throw' || h.act === 'fall') { p.step(); continue }
    if (!h.carry) {
      // The nearest pot with open floor beside it.
      const spots = []
      for (let y = s.zone.y + 1; y < s.zone.y + s.zone.h - 1; y++) for (let x = s.zone.x + 1; x < s.zone.x + s.zone.w - 1; x++) {
        if (tile(s, x, y) !== 'o' && tile(s, x, y) !== 'r') continue
        for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
          const path = p.path(x - dx, y - dy)
          if (path) spots.push({ x: x - dx + 0.5, y: y - dy + 0.5, dir, far: path.length })
        }
      }
      spots.sort((a, b) => a.far - b.far)
      const go = spots[0]
      if (!go) { p.step(); continue }
      if (Math.hypot(h.x - go.x, h.y - go.y) < 0.15) { p.press(go.dir); continue }
      p.toward(go.x, go.y)
      continue
    }
    // Carrying: the best line to a living foe. A foe with a pit past it is worth waiting a way for.
    let best = null
    for (const foe of foes()) {
      if (foe.dead) continue
      const old = was.get(foe.id) ?? foe
      was.set(foe.id, { x: foe.x, y: foe.y })
      // (A pot takes about a fifth of a second to get there.)
      const lead = Math.max(-0.6, Math.min(0.6, (foe.x - old.x) * 12))
      const leadY = Math.max(-0.6, Math.min(0.6, (foe.y - old.y) * 12))
      const e = { x: foe.x + lead, y: foe.y + leadY, hp: foe.hp }
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
        const along = (e.x - h.x) * dx + (e.y - h.y) * dy
        const off = Math.abs((e.x - h.x) * dy) + Math.abs((e.y - h.y) * dx)
        const pit = [0.7, 1.3].some(d => at(e.x + dx * d, e.y + dy * d) === 'O')
        // Until one has been dropped in, a foe a pot would not finish is thrown at only with a pit behind it.
        // (A foe right on top of the hero is thrown at whatever lies behind it.)
        if (!pit && e.hp > 2 && fell() === falls && k < 30 * FPS && Math.hypot(e.x - h.x, e.y - h.y) > 1.3) continue
        if (along > 0.7 && along < 3.2 && off < 0.3 && Z.lineClear(Z.WORLD, s.map, h.x, h.y, e.x, e.y)) {
          p.press(dir)
          thrown++
          best = 'threw'
          break
        }
        const x = e.x - dx * 2.2
        const y = e.y - dy * 2.2
        const path = p.path(Math.floor(x), Math.floor(y))
        if (!path) continue
        const cost = path.length - (pit && e.hp > 2 && fell() === falls ? 14 : 0)
        if (!best || cost < best.cost) best = { x, y, cost }
      }
      if (best === 'threw') break
    }
    if (best === 'threw') continue
    if (best) p.toward(best.x, best.y)
    else p.step()
  }
  return { thrown, down: downed(), falls: fell() - falls }
}

// ---------------------------------------------------------------------------
// Round two: the board
// ---------------------------------------------------------------------------

/** The board's panes by the top-left tile of each, in the room's own coordinates. */
const CACTI = [[5, 2], [11, 2], [2, 5], [2, 8], [8, 8]]

/** Walk to the middle of a pane and stand there until it has latched. */
function standOn(p, [x, y]) {
  const [tx, ty] = T('r2', x + 1, y + 1)
  const got = () => p.s.map.exam?.got.some(id => id.endsWith(`.${tx - 1},${ty - 1}`))
  for (let k = 0; k < 900 && !got(); k++) {
    const h = p.s.hero
    if (p.s.mode !== 'play' || Math.hypot(h.x - tx, h.y - ty) < 0.35) p.step()
    else assert.ok(p.toward(tx - 0.05, ty - 0.05) || p.toward(tx + 0.05, ty + 0.05))
  }
  assert.ok(got(), `the pane at ${x},${y} never latched`)
}

const handIn = p => {
  for (let k = 0; k < 900 && !p.s.map.exam?.over; k++) {
    const [x, y] = [p.s.zone.x + 14.5, p.s.zone.y + 3.5]
    if (p.s.mode !== 'play' || Math.hypot(p.s.hero.x - x, p.s.hero.y - y) < 0.15) p.step()
    else assert.ok(p.toward(x, y))
  }
  assert.ok(p.s.map.exam?.over, 'the hand-in pad never answered')
}

// ================================================================================================================

describe('the Examination', () => {
  it('is sat from the stair in the Puzzle Lab to the Staff Room with the blade and what the dungeon gives', () => {
    const lab = atTheLab(9)
    let p = player(lab)
    // Up the stair in the Lab's last room, and in at the Front Desk.
    p.leave('right')
    let s = p.s
    assert.equal(roomOf(s), 'desk')
    assert.deepEqual(s.entry, { map: 'examination', entry: 'desk' })
    // The stair beside the desk goes back, and the Lab's stair comes up again.
    p.leave('left')
    assert.equal(s.map.id, 'puzzlelab')
    p.leave('right')
    assert.equal(roomOf(s), 'desk')
    // The Invigilator says the one thing.
    p.walk('desk', 11, 4)
    p.press('up')
    assert.match(s.dialog.lines[0], /^INVIGILATOR: RULES ARE ON THE DOORS/)
    p.settle()
    assert.ok(s.flags['exam.met'])
    assert.equal(s.map.exam, undefined, 'no round at the desk')

    // ---- round one: NO BLADE ------------------------------------------------------------------------------------
    p.walk('desk', 14, 5)
    p.leave('right')
    p.step()
    assert.equal(s.map.exam.id, 'r1')
    assert.deepEqual(s.entry, { map: 'examination', entry: 'r1' })
    // The card at the door, and no move of the blade: not the swing, not the spin, not out of a roll.
    p.walk('r1', 1, 4)
    p.press('left')
    assert.equal(s.dialog.lines[0], 'ROUND ONE. NO BLADE. CLEAR THE ROOM.')
    p.settle()
    p.walk('r1', 2, 5)
    const mark = p.seen.length
    p.press('right')
    for (let k = 0; k < 60; k++) p.step(inp({ a: true }))
    p.wait(0.2)
    p.step(inp({ move: { x: 0, y: 1 }, rollPress: true }))
    p.step(inp({ a: true, aPress: true }))
    p.wait(0.5)
    assert.deepEqual(p.seen.slice(mark).filter(e => ['swing', 'spin', 'air'].includes(e.type)), [])
    assert.ok(p.seen.slice(mark).some(e => e.type === 'roll'), 'the roll works')
    const t1 = p.frames
    const one = throwAtFoes(p, 3)
    assert.ok(one.down >= 3 && one.falls >= 1, `round one: ${JSON.stringify(one)}`)
    if (!s.map.exam.over) handIn(p)
    LOG(`round one: ${((p.frames - t1) / FPS).toFixed(1)} s, ${one.thrown} throws, ${one.down} down (${one.falls} fell), marks ${s.map.exam.card.marks}, ${p.hurts} blows taken`)
    assert.ok(s.flags['exam.r1'])
    assert.equal(s.map.exam.card.passed, true)
    assert.ok(s.map.enemies.filter(e => e.cell === s.zoneIndex).every(e => e.dead), 'a passed round is quiet at once')
    p.wait(2.5)
    assert.equal(s.map.exam, undefined, 'the card has played')
    assert.equal(s.mode, 'play')
    assert.ok(s.flags['gate:examination.31,17'], 'the east gate stays open')
    // The room lends again: five seconds on, every stand has its pot or its stone.
    p.walk('r1', 2, 5)
    p.wait(5.5)
    const lends = Z.mapInfo(Z.WORLD, 'examination').lends
    assert.equal(lends.length, 9)
    assert.deepEqual(lends.filter(l => s.map.tiles[l.idx] !== l.tile), [])

    // ---- round two: PROVE YOU ARE NOT A MACHINE, halfway through which the tab is reloaded ----------------------
    p.walk('r1', 14, 5)
    p.leave('right')
    p.step()
    assert.equal(s.map.exam.id, 'r2')
    const save = Z.toSave(s)
    assert.deepEqual([save.map, save.entry], ['examination', 'r2'])
    const spot = Z.loadSpot(Z.WORLD, Z.parseSave(JSON.parse(JSON.stringify(save))), Z.WORLD.start, true)
    assert.equal(spot, null, 'a reload inside the dungeon continues there')
    s = Z.createGame(Z.WORLD, { save: Z.parseSave(save), at: spot, seed: 7 })
    s.hero.maxHp = s.hero.hp = 30
    p = player(s)
    p.step()
    assert.equal(roomOf(s), 'r2')
    assert.deepEqual([Math.floor(s.hero.x), Math.floor(s.hero.y)], T('r2', 1, 6))
    assert.equal(s.map.exam.id, 'r2')
    assert.ok(s.flags['exam.r1'] && s.map.enemies.filter(e => e.kind !== 'spitter').every(e => e.dead), 'round one stays passed')
    assert.equal(tile(s, ...T('r1', 15, 5)), '.', 'and its gate open')

    // Sat badly on purpose: one cactus, one palm, hand in.
    standOn(p, CACTI[2])
    assert.equal(s.map.exam.marks, 2)
    standOn(p, [2, 2])
    assert.equal(s.map.exam.marks, 0)
    handIn(p)
    assert.equal(s.map.exam.card.passed, false)
    const before = { hp: s.hero.hp, inv: JSON.stringify(s.inv), map: s.map }
    assert.equal(s.mode, 'play', 'play goes on under the card')
    for (let k = 0; k < 400 && s.map === before.map; k++) p.step()
    for (let k = 0; k < 90 && s.mode !== 'play'; k++) p.step()
    p.step()
    assert.deepEqual([Math.floor(s.hero.x), Math.floor(s.hero.y)], T('r2', 1, 6), 'back at the round\'s door')
    assert.equal(s.hero.hp, before.hp, 'no heart lost to a resit')
    assert.equal(JSON.stringify(s.inv), before.inv)
    assert.deepEqual([s.map.exam.id, s.map.exam.got, s.map.exam.marks], ['r2', [], 0], 'fresh panes')
    assert.ok(!s.flags['exam.r2'] && !s.flags.won)

    // Sat properly: the five cacti (the walking one may be left alone).
    const t2 = p.frames
    const hurt2 = p.hurts
    for (const c of [CACTI[2], CACTI[0], CACTI[1], CACTI[4], CACTI[3]]) standOn(p, c)
    assert.ok(s.map.exam.marks >= 10)
    handIn(p)
    LOG(`round two: ${((p.frames - t2) / FPS).toFixed(1)} s, marks ${s.map.exam.card.marks}, ${p.hurts - hurt2} blows taken`)
    assert.ok(s.flags['exam.r2'] && !s.flags['exam.r2.full'])

    // ---- the Staff Room -----------------------------------------------------------------------------------------
    p.walk('r2', 14, 5)
    p.leave('right')
    p.wait(2)
    assert.equal(roomOf(s), 'staff')
    assert.equal(s.map.exam, undefined, 'the card has played out, and no round here')
    const bits = s.inv.bits
    p.walk('staff', 3, 3)
    p.press('up')
    p.settle()
    assert.ok(s.flags['chest:examination.duck'])
    assert.equal(s.inv.bits, bits + 50)
    // The pond keeps the hero out, and the north gate stays shut (the Duck opens it).
    p.walk('staff', 6, 6)
    for (let k = 0; k < 40; k++) p.step(inp({ move: { x: 1, y: 0 } }))
    assert.ok(s.hero.x < T('staff', 7, 6)[0])
    assert.equal(tile(s, ...T('staff', 7, 0)), 'X')
    // And the way back stays open: to round two (quiet), and on a death to its door.
    p.walk('staff', 1, 5)
    p.leave('left')
    assert.equal(roomOf(s), 'r2')
    assert.equal(s.map.exam, undefined)
    assert.ok(s.map.enemies.filter(e => e.cell === s.zoneIndex).every(e => e.dead))
    Z.respawn(Z.WORLD, s)
    assert.deepEqual([roomOf(s), Math.floor(s.hero.x), Math.floor(s.hero.y)], ['r2', ...T('r2', 1, 6)])
  })

  it('keeps its shape: no key anywhere, every room reached in order, the stair in the Lab\'s last room', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD).filter(q => /examination|examtop|puzzlelab|stillsand/.test(q)), [])
    for (const id of ['examination', 'examtop']) {
      const def = Z.WORLD.maps[id]
      const info = Z.mapInfo(Z.WORLD, id)
      assert.deepEqual([def.kind, def.keyring, def.resume, def.away, def.realm], ['dungeon', 'examination', true, undefined, 'stillsand'])
      assert.ok(!info.base.includes('L') && !info.base.includes('K'), `${id} has a locked door`)
      assert.deepEqual(info.chestList.filter(c => c.item === 'smallKey' || c.item === 'bigKey'), [])
      assert.ok(Z.awayMap(Z.WORLD, id))
    }
    assert.deepEqual(Object.values(Z.WORLD.maps.examination.cells).map(c => c.name).sort(),
      ['ROUND FOUR', 'ROUND ONE', 'ROUND THREE', 'ROUND TWO', 'THE FRONT DESK', 'THE MARKING ROOM', 'THE PERCH', 'THE STAFF ROOM'])
    assert.deepEqual([Z.WORLD.maps.examtop.rows[0].length, Z.WORLD.maps.examtop.rows.length], [16, 12])

    /** What the hero reaches from `from` with the gates in `opened` out of the way (water, walls and pits stay). */
    const reach = (id, from, opened = []) => {
      const info = Z.mapInfo(Z.WORLD, id)
      const gone = new Set(info.gates.filter(g => g.trap || opened.includes(g.open.flag ?? g.open.plates?.[0] ?? 'stair')).flatMap(g => g.tiles))
      const seen = new Set()
      const q = [Math.floor(from.y) * info.w + Math.floor(from.x)]
      while (q.length) {
        const i = q.pop()
        if (seen.has(i)) continue
        seen.add(i)
        const x = i % info.w
        for (const j of [x ? i - 1 : -1, x < info.w - 1 ? i + 1 : -1, i - info.w, i + info.w]) {
          if (j < 0 || j >= info.base.length) continue
          const t = info.base[j]
          // (A pot or a stone is lifted out of the way.)
          if (gone.has(j) || t === 'o' || t === 'r' || (!Z.TILE_INFO[t].solid && t !== 'O')) q.push(j)
        }
      }
      return { seen, rooms: [...new Set([...seen].map(i => Object.keys(ROOM).find(k => (i % info.w) - ROOM[k][0] >= 0 && (i % info.w) - ROOM[k][0] < 16 && Math.floor(i / info.w) - ROOM[k][1] >= 0 && Math.floor(i / info.w) - ROOM[k][1] < 12)))].sort() }
    }
    const desk = Z.mapInfo(Z.WORLD, 'examination').entries.desk
    const order = [['exam.r1', 'r2'], ['exam.r2', 'staff'], ['exam.pond', 'r3'], ['exam.r3', 'perch', 'r4'], ['exam.r4', 'marking']]
    const opened = []
    const rooms = ['desk', 'r1']
    assert.deepEqual(reach('examination', desk).rooms, [...rooms].sort())
    for (const [open, ...more] of order) {
      opened.push(open)
      rooms.push(...more)
      assert.deepEqual(reach('examination', desk, opened).rooms, [...rooms].sort(), `past ${open}`)
    }
    // The stair to the hall is behind all four passes; the lever's gate is the short way down.
    const info = Z.mapInfo(Z.WORLD, 'examination')
    const stair = info.warps.find(w => w.to === 'examtop')
    const at = stair.y * info.w + stair.x
    assert.ok(!reach('examination', desk, opened).seen.has(at))
    assert.ok(reach('examination', desk, [...opened, 'stair']).seen.has(at))
    assert.ok(reach('examination', desk, ['examination.back']).rooms.includes('marking'))
    const hall = Z.mapInfo(Z.WORLD, 'examtop')
    const door = hall.warps.find(w => w.to === 'examination')
    assert.ok(reach('examtop', hall.entries.stair).seen.has(door.y * hall.w + door.x))
    // The door in the land: a stair in the Lab's last room, reached from the way into that room; no size changed.
    const lab = Z.mapInfo(Z.WORLD, 'puzzlelab')
    assert.deepEqual([lab.w, lab.h], [48, 24])
    const up = lab.warps.find(w => w.to === 'examination')
    assert.ok(up.x < 16 && up.y < 12, 'in the last room')
    assert.ok(reach('puzzlelab', { x: 15, y: 4 }).seen.has(up.y * lab.w + up.x))
  })
})
