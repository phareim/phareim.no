// Neon Shrine, THE EXAMINATION (docs/games/neon-shrine-examination.md): the test behind the Puzzle Lab, played from
// its stair to the Weight by a scripted hero with the blade and what the dungeon gives; a hero who only stands in the
// Titan's hall; the Duck in a save; and the shape its maps must keep. At most four tests live here. `EXAM_LOG=1`:
// what each round and fight cost. `EXAM_SEED=n`: the play-through on another seed.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const FPS = 60
const SEED = Number(process.env.EXAM_SEED ?? 9)
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
 * Throws what the room lends until `want` foes are down. It fetches the nearest pot or stone, walks to a line with a
 * foe and throws along it. (A pot's knock may drop a foe in a pit, and that counts the same: nothing here needs it.)
 */
function throwAtFoes(p, want) {
  const { s } = p
  const foes = () => s.map.enemies.filter(e => e.cell === s.zoneIndex)
  const downed = () => foes().filter(e => e.dead).length
  const fell = () => p.seen.filter(e => e.type === 'fall').length
  const falls = fell()
  let thrown = 0
  /** Where each foe was a step ago: a throw is aimed at where it will be. */
  const was = new Map()
  for (let k = 0; k < 150 * FPS; k++) {
    if (s.map.exam?.over || downed() >= want) return { thrown, down: downed(), falls: fell() - falls }
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
    // Carrying: the best line to a living foe.
    let best = null
    for (const foe of foes()) {
      if (foe.dead) continue
      const old = was.get(foe.id) ?? foe
      was.set(foe.id, { x: foe.x, y: foe.y })
      // (A pot takes about a fifth of a second to get there.)
      const lead = Math.max(-0.6, Math.min(0.6, (foe.x - old.x) * 12))
      const leadY = Math.max(-0.6, Math.min(0.6, (foe.y - old.y) * 12))
      const e = { x: foe.x + lead, y: foe.y + leadY }
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
        const along = (e.x - h.x) * dx + (e.y - h.y) * dy
        const off = Math.abs((e.x - h.x) * dy) + Math.abs((e.y - h.y) * dx)
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
        if (!best || path.length < best.cost) best = { x, y, cost: path.length }
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

// ---------------------------------------------------------------------------
// Round three: the room that waits
// ---------------------------------------------------------------------------

/**
 * Walk to the middle of a tile as a careful hero does: cut at a guard before it is on top of the hero, step out of
 * the way of a shot that is coming. `done`: stop as it holds.
 */
function walkGuarded(p, [tx, ty], done) {
  const { s } = p
  for (let k = 0; k < 2400 && !done(); k++) {
    const h = s.hero
    if (s.mode !== 'play' || h.act === 'hurt' || h.act === 'swing') { p.step(); continue }
    const guard = s.map.enemies.filter(e => !e.dead && e.cell === s.zoneIndex && e.kind === 'sentry' && Math.hypot(e.x - h.x, e.y - h.y) < 2.1 && Z.lineClear(Z.WORLD, s.map, h.x, h.y, e.x, e.y))[0]
    if (guard) {
      const dx = guard.x - h.x
      const dy = guard.y - h.y
      p.press(Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? 'left' : 'right') : dy < 0 ? 'up' : 'down')
      continue
    }
    // A shot that will pass close within half a second: out of its line.
    const shot = s.map.projectiles.find(q => {
      const t = -((q.x - h.x) * q.vx + (q.y - h.y) * q.vy) / (q.vx * q.vx + q.vy * q.vy)
      return t > 0 && t < 0.5 && Math.hypot(q.x + q.vx * t - h.x, q.y + q.vy * t - h.y) < 0.75
    })
    if (shot) {
      const side = (h.x - shot.x) * -shot.vy + (h.y - shot.y) * shot.vx >= 0 ? 1 : -1
      p.step(inp({ move: unit(-shot.vy * side, shot.vx * side) }))
      continue
    }
    if (Math.hypot(h.x - tx - 0.5, h.y - ty - 0.5) < 0.15) p.step()
    else assert.ok(p.toward(tx + 0.5, ty + 0.5), `no way to ${tx},${ty}`)
  }
}

// ---------------------------------------------------------------------------
// FALCON, with the blade alone
// ---------------------------------------------------------------------------

/** The nearest open spot to the hero that is clear of the dive's ring and lane (their paint, and a hair more). */
function clearOfDive(p, f) {
  const { s } = p
  const h = s.hero
  const { tx, ty, sx, sy } = f.ai
  const lane = (x, y) => {
    const len = Math.hypot(tx - sx, ty - sy) || 1
    const u = Math.max(0, Math.min(len, ((x - sx) * (tx - sx) + (y - sy) * (ty - sy)) / len))
    return Math.hypot(x - sx - ((tx - sx) * u) / len, y - sy - ((ty - sy) * u) / len)
  }
  let best = null
  for (let y = s.zone.y + 1.5; y < s.zone.y + s.zone.h - 1; y += 0.5) for (let x = s.zone.x + 1.5; x < s.zone.x + s.zone.w - 1; x += 0.5) {
    if (Math.hypot(x - tx, y - ty) < 1.45 || lane(x, y) < 0.7 || !p.path(Math.floor(x), Math.floor(y))) continue
    const d = Math.hypot(x - h.x, y - h.y)
    if (!best || d < best.d) best = { x, y, d }
  }
  return best
}

/** Stands in the middle while it circles, steps out of each dive's paint, and cuts it while it is stuck in the sand. */
function fightFalcon(p) {
  const { s } = p
  const f = s.map.enemies.find(e => e.kind === 'falcon')
  const seen = new Set()
  let to = null
  let openings = 0
  let was = ''
  for (let k = 0; k < 120 * FPS && !f.dead; k++) {
    const h = s.hero
    const mode = f.ai.mode
    seen.add(mode)
    if (mode === 'stuck' && was !== 'stuck') openings++
    // Its bar is gold exactly while it can be hurt, and its aim is on the floor while it is told and while it comes.
    assert.equal(Z.bossOpen(f), mode === 'stuck' && (f.ai.took ?? 0) < Z.FALCON.take)
    assert.equal(Z.stencilsOf(f).length > 0, mode === 'tell' || mode === 'dive')
    was = mode
    if (s.mode !== 'play' || h.act === 'hurt') { p.step(); continue }
    if (mode === 'tell' || mode === 'dive') {
      if (!to) to = clearOfDive(p, f)
      if (Math.hypot(h.x - to.x, h.y - to.y) < 0.12) p.step()
      else p.toward(to.x, to.y)
      continue
    }
    to = null
    // Between its two dives it is on the ground and still stone: wait where the first one left the hero.
    if (mode === 'again') { p.step(); continue }
    if (mode === 'stuck') {
      // From the side of it the hero is on, a blade's length off.
      const spots = Object.entries(DIRS).map(([dir, [dx, dy]]) => ({ dir, x: f.x - dx * 1.5, y: f.y - dy * 1.5 })).filter(q => p.path(Math.floor(q.x), Math.floor(q.y)))
      spots.sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))
      const q = spots[0]
      if (Math.hypot(h.x - q.x, h.y - q.y) < 0.3) { if (k % 8 === 0) p.press(q.dir); else p.step() }
      else p.toward(q.x, q.y)
      continue
    }
    const [mx, my] = [s.zone.x + 8, s.zone.y + 6.5]
    if (Math.hypot(h.x - mx, h.y - my) < 0.3) p.step()
    else p.toward(mx, my)
  }
  return { f, openings, seen }
}

// ---------------------------------------------------------------------------
// THE BENCHMARK TITAN, with the blade and the room's pots
// ---------------------------------------------------------------------------

/** The nearest open spot to the hero that is out of every square on the floor (and a hair more), clear of the Titan. */
function clearOfStamp(p, t) {
  const { s } = p
  const h = s.hero
  const squares = Z.stencilsOf(t)
  let best = null
  for (let y = 1.5; y < 11; y += 0.5) for (let x = 1.5; x < 15; x += 0.5) {
    if (squares.some(q => Math.abs(x - q.x) <= q.w / 2 + 0.2 && Math.abs(y - q.y) <= q.h / 2 + 0.2) || Math.hypot(x - t.x, y - t.y) < 1.7) continue
    const path = p.path(Math.floor(x), Math.floor(y))
    if (!path) continue
    const d = Math.hypot(x - h.x, y - h.y) + path.length * 0.05
    if (!best || d < best.d) best = { x, y, d }
  }
  return best
}

/**
 * Reads the two cards and strikes with a kind that is on neither: the cut, else the charged spin, else a pot from a
 * stand (fetched while it walks). Out of the squares as they show; the blow while it leans.
 */
function fightTitan(p) {
  const { s } = p
  const t = s.map.enemies.find(e => e.kind === 'titan')
  const blows = []
  let aside = 0
  let to = null
  let charge = 0
  let chain = false
  const kind = () => ['BLADE', 'SPIN', 'POT'].find(k => k !== t.ai.picA && k !== t.ai.picB)
  /** The spots a blade's length from it, by the way the hero would face. */
  const beside = reach => Object.entries(DIRS).map(([dir, [dx, dy]]) => ({ dir, x: t.x - dx * reach, y: t.y - dy * reach }))
    .filter(q => q.x > 1.3 && q.x < 14.7 && q.y > 1.3 && q.y < 10.7 && p.path(Math.floor(q.x), Math.floor(q.y)))
    .sort((a, b) => Math.hypot(a.x - s.hero.x, a.y - s.hero.y) - Math.hypot(b.x - s.hero.x, b.y - s.hero.y))[0]
  const near = q => Math.hypot(s.hero.x - q.x, s.hero.y - q.y) < 0.3
  let hp = t.hp
  const count = () => {
    if (t.hp >= hp) return
    blows.push(t.ai.picB)
    assert.equal(hp - t.hp, Z.TITAN.blow, 'every kind takes the same')
    hp = t.hp
  }
  for (let k = 0; k < 150 * FPS && !t.dead; k++) {
    const h = s.hero
    const mode = t.ai.mode
    const open = mode === 'rest' || mode === 'look'
    assert.equal(Z.bossOpen(t), open)
    assert.equal(Z.stencilsOf(t).length > 0, mode === 'tell' || (mode === 'slam' && !!t.ai.pending))
    count()
    if (s.mode !== 'play' || h.act === 'hurt' || h.act === 'lift' || h.act === 'throw') { charge = 0; p.step(); continue }
    if (mode === 'tell' || mode === 'slam') {
      charge = 0
      if (Z.stencilsOf(t).length && !to) to = clearOfStamp(p, t)
      if (to && !near(to)) p.toward(to.x, to.y)
      else p.step()
      continue
    }
    to = null
    const want = kind()
    // A pot is fetched while it is shut: from the nearer stand, from its inner side.
    if (want === 'POT' && !h.carry && !charge) {
      const stands = [[2, 6, 'left', 3.5], [13, 6, 'right', 12.5]].filter(([x, y]) => tile(s, x, y) === 'o')
      stands.sort((a, b) => Math.abs(a[0] - h.x) - Math.abs(b[0] - h.x))
      const [, y, dir, from] = stands[0] ?? []
      if (!stands.length) p.step()
      else if (near({ x: from, y: y + 0.5 })) p.press(dir)
      else p.toward(from, y + 0.5)
      continue
    }
    if (!open) {
      // Out of its way as it walks.
      const dx = h.x - t.x
      const dy = h.y - t.y
      if (Math.hypot(dx, dy) < 2.6) p.step(inp({ move: unit(dx || 1, dy) }))
      else p.step()
      continue
    }
    if (h.carry) {
      // In line with it, a few tiles off at most: throw.
      const line = Object.entries(DIRS).find(([, [dx, dy]]) => {
        const along = (t.x - h.x) * dx + (t.y - h.y) * dy
        return along > 1.2 && along < 4 && Math.abs((t.x - h.x) * dy) + Math.abs((t.y - h.y) * dx) < 0.9
      })
      if (line && want === 'POT') { p.press(line[0]); p.wait(0.5); continue }
      const q = beside(2.8)
      p.toward(q.x, q.y)
      continue
    }
    const q = beside(1.8)
    if (!charge && !near(q)) { p.toward(q.x, q.y); continue }
    if (want === 'BLADE') {
      p.press(q.dir)
      p.wait(0.16)
      // Once: a second cut of the same chain, which is the blade again and is turned aside.
      if (!chain && t.ai.picB === 'BLADE') {
        chain = true
        const was = t.hp
        const mark = p.seen.length
        p.press(q.dir)
        for (let n = 0; n < 20; n++) p.step()
        assert.ok(p.seen.slice(mark).some(e => e.type === 'clank'), 'the second cut rings off')
        assert.deepEqual([t.hp, t.ai.turned], [was, 'BLADE'], 'the second cut of a chain is turned aside')
        assert.ok(t.ai.turnT > 0, 'and its card flashes')
        aside++
      }
      p.wait(0.2)
      continue
    }
    if (want === 'SPIN') {
      // A held, the charge fills; let go beside it.
      if (!charge) s.hero.dir = q.dir
      p.step(inp({ a: true, aPress: !charge }))
      charge++
      if (h.charge >= Z.CHARGE_TIME && !h.swing) { p.step(); charge = 0; p.wait(0.35) }
      continue
    }
    p.step()
  }
  count()
  return { t, blows, aside }
}

// ================================================================================================================

describe('the Examination', () => {
  it('is sat from the stair in the Puzzle Lab to the Weight in hand with the blade and what the dungeon gives', () => {
    const lab = atTheLab(SEED)
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
    assert.ok(one.down >= 3, `round one: ${JSON.stringify(one)}`)
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
    assert.equal(lends.length, 12, 'nine here, three in round four')
    assert.deepEqual(lends.filter(l => s.map.tiles[l.idx] !== l.tile), [])

    // ---- round two: PROVE YOU ARE NOT A MACHINE ----------------------------------------------------------------
    p.walk('r1', 14, 5)
    p.leave('right')
    p.step()
    assert.equal(s.map.exam.id, 'r2')

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

    // ---- the Staff Room: the Duck, and the pond ----------------------------------------------------------------
    p.walk('r2', 14, 5)
    p.leave('right')
    p.wait(2)
    assert.equal(roomOf(s), 'staff')
    assert.equal(s.map.exam, undefined, 'the card has played out, and no round here')
    p.walk('staff', 3, 3)
    p.press('up')
    assert.deepEqual(s.get.text, ['YOU GOT THE DUCK!', '{B} SETS IT DOWN. FOES LOOK AT IT. IT FLOATS.'])
    p.settle()
    assert.ok(s.flags['chest:examination.duck'] && s.inv.duck)
    assert.equal(s.inv.selected, 'duck', 'in the hand at once')
    // The pond keeps the hero out, and the north gate is shut. From its west edge the Duck goes two tiles ahead, on
    // the middle of the water, floats, weighs one, and the gate opens for good.
    p.walk('staff', 6, 6)
    for (let k = 0; k < 40; k++) p.step(inp({ move: { x: 1, y: 0 } }))
    assert.ok(s.hero.x < T('staff', 7, 6)[0])
    assert.equal(tile(s, ...T('staff', 7, 0)), 'X')
    p.step(inp({ bPress: true }))
    p.wait(0.4)
    const [wx, wy] = T('staff', 8, 6)
    assert.deepEqual(s.duck, { x: wx + 0.5, y: wy + 0.5 })
    assert.equal(tile(s, wx, wy), 'ω')
    assert.ok(s.map.plates.includes('exam.pond'))
    assert.equal(tile(s, ...T('staff', 7, 0)), '.')
    assert.ok(s.flags[`gate:examination.${T('staff', 7, 0)}`])
    // Too far off to take up, B moves it: here to the floor two tiles behind. Beside it, B takes it up.
    p.step(inp({ move: { x: -0.3, y: 0 } }))
    p.wait(0.2)
    p.step(inp({ bPress: true }))
    p.wait(0.4)
    assert.ok(s.duck.x < s.hero.x - 1.2, `moved behind: ${JSON.stringify(s.duck)}`)
    assert.ok(!s.map.plates.includes('exam.pond'))
    assert.equal(tile(s, ...T('staff', 7, 0)), '.', 'and the gate stays open')
    p.walk('staff', Math.floor(s.duck.x) - ROOM.staff[0] + 1, 6)
    p.step(inp({ bPress: true }))
    p.step()
    assert.equal(s.duck, undefined, 'taken up')

    // ---- round three: TIME MOVES WHEN YOU DO --------------------------------------------------------------------
    p.walk('staff', 7, 1)
    p.leave('up')
    assert.equal(roomOf(s), 'r3')
    p.step()
    assert.equal(s.map.exam.id, 'r3')
    assert.deepEqual(s.entry, { map: 'examination', entry: 'r3' })
    // The Duck set down draws a guard: it comes to look.
    p.walk('r3', 7, 9)
    s.hero.dir = 'up'
    p.step(inp({ bPress: true }))
    for (let k = 0; k < 400 && !s.map.enemies.some(e => e.cell === s.zoneIndex && e.ai.lure !== undefined); k++) p.step(inp({ move: { x: k % 60 < 30 ? 0.4 : -0.4, y: 0 } }))
    assert.ok(s.map.enemies.some(e => !e.dead && e.ai.lure !== undefined), 'a guard looks at the Duck')
    assert.ok(s.duck)
    // The tab is reloaded: it continues at the round's door, with the Duck back in the hand and the rounds passed.
    const save = Z.toSave(s)
    assert.deepEqual([save.map, save.entry], ['examination', 'r3'])
    assert.equal(Z.loadSpot(Z.WORLD, Z.parseSave(JSON.parse(JSON.stringify(save))), Z.WORLD.start, true), null, 'a reload inside the dungeon continues there')
    s = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(save))), seed: SEED + 7 })
    s.hero.maxHp = s.hero.hp = 30
    p = player(s)
    p.step()
    assert.deepEqual([roomOf(s), Math.floor(s.hero.x), Math.floor(s.hero.y)], ['r3', ...T('r3', 7, 10)])
    assert.deepEqual([s.duck, s.inv.duck, s.inv.selected, s.map.exam.id], [undefined, true, 'duck', 'r3'])
    assert.ok(s.flags['exam.r1'] && s.flags['exam.r2'] && !s.flags['exam.r3'])
    assert.equal(tile(s, ...T('staff', 7, 0)), '.', 'the pond\'s gate stays open')
    p.walk('r3', 8, 10)
    p.press('right')
    assert.equal(s.dialog.lines[0], 'ROUND THREE. TIME MOVES WHEN YOU DO.')
    p.settle()
    // Walk until a shot is in the air, then let go of everything: the world stands. Nothing of it moves in three seconds.
    // (A drone fires at whoever comes into its row or its column: walk under one, and keep stirring, or time stands.)
    // (A blow on the way leaves the hero reeling, which is doing: then wait for the next shot.)
    const held0 = () => s.map.exam.k === 0 && s.map.projectiles.length > 0
    for (let k = 0; k < 60 * FPS && !held0(); k++) {
      const h = s.hero
      const d = s.map.enemies.filter(e => !e.dead && e.kind === 'drone').sort((a, b) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(b.x - h.x, b.y - h.y))[0]
      const under = [4.5, 3.5, 2.5, 1.5].map(n => [d.x, d.y + n]).find(([x, y]) => p.path(Math.floor(x), Math.floor(y)))
      if (s.mode !== 'play' || h.act === 'hurt') p.step()
      else if (s.map.projectiles.length) p.wait(0.3)
      else if (!under || Math.hypot(h.x - under[0], h.y - under[1]) < 0.3) p.step(inp({ move: { x: Math.floor(k / 12) % 2 ? 0.3 : -0.3, y: 0 } }))
      else p.toward(...under)
    }
    assert.ok(held0(), 'a shot hangs in the air, the world at a stand')
    const world = () => JSON.stringify([s.map.projectiles.map(q => [q.x, q.y, q.t]), s.map.enemies.filter(e => !e.dead && e.cell === s.zoneIndex).map(e => [e.x, e.y, e.ai.t, e.ai.mode])])
    const held = world()
    const mark3 = p.seen.length
    p.wait(3)
    assert.equal(world(), held, 'the world is held while the hero is still')
    assert.equal(Z.stillK(s), 0)
    // (A thumb at the edge of the dead zone does not flicker it: past 0.2 it runs, and goes on running down to 0.1.)
    p.step(inp({ move: { x: 0.15, y: 0 } }))
    assert.equal(world(), held)
    for (let k = 0; k < 12; k++) p.step(inp({ move: { x: k < 6 ? 0.3 : 0.15, y: 0 } }))
    assert.equal(s.map.exam.k, 1)
    assert.notEqual(world(), held, 'and runs when the hero does')
    p.wait(0.5)
    assert.equal(p.seen.slice(mark3).filter(e => e.type === 'still').length, 1, 'the sound of its coming to a stand, once each time')
    // Passed by moving: the mark pads, the blade for whatever comes close, and the HAND IN pad by the west door. A
    // sitting that goes badly is a resit, as for anyone: back at the door with fresh guards.
    let sittings = 0
    while (!s.flags['exam.r3']) {
      assert.ok(++sittings <= 4, `round three, four sittings: ${JSON.stringify(s.map.exam)}`)
      for (let k = 0; k < 600 && (s.map.exam?.over !== false || s.mode !== 'play'); k++) p.step()
      const t3 = p.frames
      const hurt3 = p.hurts
      for (const [x, y] of [[12, 8], [13, 1], [7, 5], [2, 8], [2, 1]]) {
        const [tx, ty] = T('r3', x, y)
        walkGuarded(p, [tx, ty], () => s.map.exam.got.includes(`examination.${tx},${ty}`))
      }
      walkGuarded(p, T('r3', 1, 3), () => !s.map.exam || s.map.exam.over)
      LOG(`round three, sitting ${sittings}: ${((p.frames - t3) / FPS).toFixed(1)} s, marks ${s.map.exam.card.marks}, ${p.hurts - hurt3} blows taken`)
    }
    assert.equal(Z.stillK(s), 1, 'passed, the clock is the hero\'s own again')
    p.wait(2.5)

    // ---- the Perch: FALCON --------------------------------------------------------------------------------------
    p.walk('r3', 1, 5)
    for (let k = 0; k < 200 && s.mode !== 'dialog'; k++) p.step(inp({ move: s.mode === 'play' ? { x: -1, y: 0 } : { x: 0, y: 0 } }))
    assert.equal(roomOf(s), 'perch')
    assert.equal(s.dialog.lines[0], 'FALCON. SLIGHTLY DEAF. NEVER WRONG.')
    p.settle()
    assert.deepEqual(s.entry, { map: 'examination', entry: 'r3' }, 'a death here is a walk from round three')
    assert.equal(tile(s, ...T('perch', 0, 5)), 'X', 'shut in')
    const t4 = p.frames
    const hurt4 = p.hurts
    const fight = fightFalcon(p)
    LOG(`Falcon, the blade alone: ${((p.frames - t4) / FPS).toFixed(1)} s, ${fight.openings} openings, ${p.hurts - hurt4} blows taken`)
    assert.ok(fight.f.dead, `Falcon stands at ${fight.f.hp} hp`)
    for (const mode of ['fly', 'tell', 'dive', 'again', 'stuck']) assert.ok(fight.seen.has(mode), mode)
    assert.equal(p.hurts, hurt4, 'out of the paint is out of harm')
    assert.ok(s.flags['examination.falcon'])
    p.wait(0.2)
    assert.equal(s.dialog.lines[0], '(THE FALCON SITS IN THE SAND. IT STILL THINKS IT WAS RIGHT.)')
    p.settle()
    assert.equal(tile(s, ...T('perch', 0, 5)), '.', 'the west door is open')
    p.walk('perch', 1, 5)
    p.leave('left')
    assert.equal(roomOf(s), 'r4')
    // The way back stays open all the way: to round three (quiet), and on a death to round four's own door.
    p.walk('r4', 14, 5)
    p.leave('right')
    assert.equal(roomOf(s), 'perch')
    p.walk('perch', 14, 5)
    p.leave('right')
    p.step()
    assert.equal(roomOf(s), 'r3')
    assert.equal(s.map.exam, undefined)
    assert.ok(s.map.enemies.filter(e => e.cell === s.zoneIndex).every(e => e.dead))
    Z.respawn(Z.WORLD, s)
    assert.deepEqual([roomOf(s), Math.floor(s.hero.x), Math.floor(s.hero.y)], ['r3', ...T('r3', 7, 10)])

    // ---- round four: THE WEIGH HOUSE, AS PRACTISED --------------------------------------------------------------
    p.settle()
    p.walk('r3', 1, 5)
    p.leave('left')
    p.walk('perch', 1, 5)
    p.leave('left')
    p.step()
    assert.equal(s.map.exam.id, 'r4')
    assert.deepEqual(s.entry, { map: 'examination', entry: 'r4' })
    p.walk('r4', 14, 4)
    p.press('right')
    assert.equal(s.dialog.lines[0], 'ROUND FOUR. THE WEIGH HOUSE. AS PRACTISED.')
    p.settle()
    const t5 = p.frames
    // The nearest pot is the hollow one: no slower to carry, and it breaks on the first weighed tile, for two marks.
    assert.equal(tile(s, ...T('r4', 6, 4)), 'ô')
    p.walk('r4', 7, 4)
    p.press('left')
    p.wait(0.4)
    assert.ok(s.hero.carry === 'pot' && s.hero.carryHollow)
    const x0 = s.hero.x
    for (let k = 0; k < 30; k++) p.step(inp({ move: { x: 1, y: 0 } }))
    assert.ok(s.hero.x - x0 > 0.5 * Z.CARRY_SPEED + 0.3, 'at full pace')
    // (Onto the heavy plate, the one weighed tile on this way.)
    for (let k = 0; k < 600 && s.hero.carry; k++) { const [hx, hy] = T('r4', 10, 1); p.toward(hx + 0.5, hy + 0.5) }
    assert.deepEqual([s.hero.carry, s.map.exam.marks, s.map.plates], [null, -2, []])
    // The block, twice south, onto the left pan.
    p.walk('r4', 9, 5)
    for (let k = 0; k < 180 && tile(s, ...T('r4', 9, 8)) !== 'b'; k++) p.step(inp({ move: { x: 0, y: 1 } }))
    assert.equal(tile(s, ...T('r4', 9, 8)), 'b')
    // A sound pot weighs the hero down to two: level with the block on the other pan, and enough for the heavy plate.
    p.walk('r4', 3, 4)
    p.press('right')
    p.wait(0.4)
    assert.ok(s.hero.carry === 'pot' && !s.hero.carryHollow)
    p.walk('r4', 11, 8)
    p.wait(0.2)
    assert.ok(s.map.plates.includes('exam.r4.scale'))
    assert.equal(s.map.exam.marks, 3)
    p.walk('r4', 10, 1)
    p.wait(0.2)
    assert.equal(s.map.exam.marks, 8)
    for (let k = 0; k < 900 && !s.map.exam.over; k++) { const [hx, hy] = T('r4', 1, 3); p.toward(hx + 0.5, hy + 0.5) }
    LOG(`round four: ${((p.frames - t5) / FPS).toFixed(1)} s, marks ${s.map.exam.card.marks} (one hollow pot broken)`)
    assert.ok(s.flags['exam.r4'] && !s.flags['exam.r4.full'])
    p.wait(2.5)

    // ---- the Marking Room, and the stair --------------------------------------------------------------------------
    p.walk('r4', 1, 5)
    p.leave('left')
    assert.equal(roomOf(s), 'marking')
    p.walk('marking', 10, 4)
    p.press('up')
    assert.equal(s.dialog.lines[0], 'MARKING ROOM. FULL MARKS GET A SMALL THING.')
    p.settle()
    assert.equal(tile(s, ...T('marking', 3, 3)), '.', 'no chest short of full marks')
    p.walk('marking', 5, 10)
    p.press('up')
    p.wait(0.2)
    assert.ok(s.flags['examination.back'] && tile(s, ...T('marking', 7, 11)) === '.', 'the short way down')
    assert.equal(tile(s, ...T('marking', 7, 2)), '.', 'all four passed: the stair\'s gate is open')
    p.walk('marking', 7, 3)
    // (The Titan's card is up as soon as the hall is there.)
    for (let k = 0; k < 400 && s.mode !== 'dialog'; k++) p.step(inp({ move: s.mode === 'play' ? { x: 0, y: -1 } : { x: 0, y: 0 } }))
    assert.equal(s.map.id, 'examtop')
    assert.equal(s.dialog.lines[0], 'THE BENCHMARK TITAN. TOP OF EVERY TABLE. IT HAS SEEN THE QUESTIONS.')
    p.settle()

    // ---- the Titan's hall: THE BENCHMARK TITAN -------------------------------------------------------------------
    assert.deepEqual(s.entry, { map: 'examtop', entry: 'stair' })
    assert.ok(s.flags['examination.titan.card'])
    // The tab is reloaded here: back at the stair, the fight fresh, the gate shutting again.
    s = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))), seed: SEED + 11 })
    s.hero.maxHp = s.hero.hp = 30
    p = player(s)
    p.step()
    assert.deepEqual([s.map.id, Math.floor(s.hero.x), Math.floor(s.hero.y)], ['examtop', 8, 9])
    p.step()
    assert.equal(tile(s, 8, 10), 'X', 'shut in')
    p.settle()
    const t6 = p.frames
    const hurt6 = p.hurts
    const titan = fightTitan(p)
    LOG(`the Titan, the blade and its pots: ${((p.frames - t6) / FPS).toFixed(1)} s, ${titan.blows.join(' ')}, ${p.hurts - hurt6} blows taken`)
    assert.ok(titan.t.dead, `the Titan stands at ${titan.t.hp} hp`)
    assert.deepEqual(titan.blows, ['BLADE', 'SPIN', 'POT', 'BLADE', 'SPIN'])
    assert.equal(titan.blows.length, 5, 'fifteen hit points are five hurting blows')
    assert.equal(titan.aside, 1)
    p.wait(0.3)
    assert.equal(s.dialog.lines[0], '(ITS CLIPBOARD IS BLANK. IT LOOKS AT THE BRASS WEIGHT.)')
    p.settle()
    assert.equal(tile(s, 8, 10), '.', 'the way back is open')
    const weight = s.map.pickups.find(q => q.id === 'examination.weight')
    assert.ok(weight && !weight.hidden)
    for (let k = 0; k < 900 && !s.flags['item:weightSurprise']; k++) { if (s.mode === 'play') p.toward(weight.x, weight.y); else p.step() }
    assert.ok(s.flags['item:weightSurprise'], 'the Weight SURPRISE in hand')
    p.settle()
    assert.ok(!s.flags.won)
    // And out: down to the Marking Room, and by the lever's gate straight to the desk.
    for (let k = 0; k < 900 && s.map.id === 'examtop'; k++) {
      if (s.mode !== 'play') p.step()
      else if (s.hero.y > 9.6 && Math.abs(s.hero.x - 8.5) < 0.2) p.step(inp({ move: { x: 0, y: 1 } }))
      else p.toward(8.5, 9.8)
    }
    for (let k = 0; k < 200 && s.mode !== 'play'; k++) p.step()
    assert.equal(roomOf(s), 'marking')
    p.walk('marking', 7, 10)
    p.leave('down')
    assert.equal(roomOf(s), 'desk')
  })

  it('beats a hero who only stands in the Titan\'s hall, by its stamps', () => {
    const s = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examtop', entry: 'stair' } })
    s.inv.sword = true
    let stamps = 0
    let struck = 0
    for (let k = 0; k < 90 * FPS && s.mode !== 'dying'; k++) {
      const ev = Z.stepGame(Z.WORLD, s, 1 / FPS, inp({ aPress: s.mode === 'dialog' && k % 20 === 19 }))
      const boom = ev.some(e => e.type === 'boom')
      if (boom) stamps++
      if (boom && ev.some(e => e.type === 'hurt')) struck++
    }
    assert.equal(s.mode, 'dying', `stood through ${stamps} stamps at ${s.hero.hp} hp`)
    assert.equal(struck, s.hero.maxHp / 2, 'every half heart gone to a stamp')
    // The retry: back at the stair with the Titan whole and its first two cards.
    Z.respawn(Z.WORLD, s)
    const t = s.map.enemies.find(e => e.kind === 'titan')
    assert.deepEqual([s.map.id, t.hp, t.ai.picA, t.dead], ['examtop', 15, undefined, false])
  })

  it('never saves the Duck set down, and loads a save with the Duck in the hand', () => {
    const s = Z.createGame(Z.WORLD, { seed: SEED, at: { map: 'examination', entry: 'desk' } })
    s.inv.sword = true
    Z.grant(s, 'duck')
    const p = player(s)
    p.step()
    p.step(inp({ bPress: true }))
    p.step()
    assert.ok(s.duck)
    const saved = JSON.parse(JSON.stringify(Z.toSave(s)))
    assert.ok(!('duck' in saved))
    const read = Z.parseSave(saved)
    assert.deepEqual([read.inv.duck, read.inv.selected], [true, 'duck'])
    const back = Z.createGame(Z.WORLD, { save: read, seed: SEED })
    assert.deepEqual([back.duck, back.inv.duck, back.inv.selected], [undefined, true, 'duck'])
    // A save from before the Duck loads without it.
    const old = JSON.parse(JSON.stringify(saved))
    delete old.inv.duck
    old.inv.selected = null
    assert.equal(Z.parseSave(old).inv.duck, false)
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
    // (The Perch's trap gate is open to the walk: it is shut only while Falcon lives, and the play-through fells it.)
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
