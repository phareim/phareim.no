// Can the whole world be opened? From the first step, with only what the world itself hands out, every chest, every
// key, every locked door and every gate must be reached in some order. `validateWorld` does not prove this
// (`world/validate.ts` walks the maps "once every lock, gate, crack and block has given way"), so this test plays the
// order: it walks the real maps, takes what it can reach (a chest, a thing on the floor, what a person gives, a
// felled boss's key), and lets that open the next way: the blade, bombs, the hook, the Arc Blade, Luna, small keys
// door by door, big keys, and gates by their own conditions (`condMet`).
// Not played: how a puzzle is solved. A push block, a crystal block, a lever, a beam, a pressure plate or a word on
// the floor gives way to whoever stands in its room; the walks of the other tests solve them.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

/** Solid tiles a hand alone gets past (pots, rocks) or that are puzzles, solved by their own tests. */
const PUZZLES = new Set([...'orbPC¤ωμνκ□◇▣▤▥▦'])
/** Solid tiles that give way to something held. */
const NEEDS = { '*': 'item:sword', R: 'item:bombBag', '%': 'item:bombBag', l: 'item:arc', B: 'luna' }
/** The bosses that cannot be felled with the blade alone (`zelda-gauntlet.test.mjs` fights them all). */
const BOSS_TOOL = { mistral: 'item:hook' }
const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]]

/** The world's maps as the walk wants them: base tiles, which gate and which door stands on a tile, pits a stone fills. */
function survey(W) {
  const maps = {}
  const doors = []
  for (const [id, def] of Object.entries(W.maps)) {
    const info = Z.mapInfo(W, id)
    const at = (x, y) => y * info.w + x
    const gates = new Map(info.gates.flatMap(g => g.tiles.map(i => [i, g])))
    // A locked door is its run of tiles: one key opens it.
    const door = new Map()
    info.base.forEach((t, i) => {
      if ((t !== 'L' && t !== 'K') || door.has(i)) return
      const d = { name: `${id} ${t === 'L' ? 'locked' : 'big'} door at ${i % info.w},${Math.floor(i / info.w)}`, map: id, big: t === 'K', ring: def.keyring ?? 'shrine', tiles: [] }
      doors.push(d)
      for (const todo = [i]; todo.length;) {
        const j = todo.pop()
        if (door.has(j) || info.base[j] !== t) continue
        door.set(j, d)
        d.tiles.push(j)
        for (const [dx, dy] of STEPS) {
          const x = (j % info.w) + dx
          const y = Math.floor(j / info.w) + dy
          if (x >= 0 && y >= 0 && x < info.w && y < info.h) todo.push(at(x, y))
        }
      }
    })
    // A pit on a stone's road is filled once it rolls.
    const filled = new Set()
    for (const m of info.marks) {
      if (m.ent.t !== 'boulder') continue
      const [dx, dy] = { right: [1, 0], left: [-1, 0], down: [0, 1], up: [0, -1] }[m.ent.dir]
      for (let k = 1, x = m.x + dx, y = m.y + dy; k < 64 && x >= 0 && y >= 0 && x < info.w && y < info.h; k++, x += dx, y += dy) {
        const t = info.base[at(x, y)]
        if (Z.TILE_INFO[t].pit) { filled.add(at(x, y)); break }
        if (t !== '%' && t !== 'R' && Z.TILE_INFO[t].solid) break
      }
    }
    const cells = Int16Array.from(info.base, (_, i) => Z.cellIndex(info, (i % info.w) + 0.5, Math.floor(i / info.w) + 0.5))
    maps[id] = { id, def, info, at, gates, door, filled, cell: (x, y) => cells[at(x, y)], warps: new Map(info.warps.flatMap(v => Array.from({ length: v.w * v.h }, (_, k) => [at(v.x + (k % v.w), v.y + Math.floor(k / v.w)), v]))) }
  }
  return { maps, doors }
}

/**
 * Walks and takes until nothing more comes, with `opened` the locked doors the keys have gone into. Returns what was
 * got, which doors the walk stands at, and what is still out of reach.
 */
function round(W, world, opened) {
  const { maps, doors } = world
  const g = Z.createGame(W, { seed: 1 })
  g.flags = {}
  g.inv.sword = false
  const flags = g.flags
  const keys = {}
  const taken = new Set()
  const key = ring => { keys[ring] = (keys[ring] ?? 0) + 1 }
  const bigKey = ring => (ring === 'shrine' ? flags['item:bigKey'] : flags[`bigkey:${ring}`])
  let seen
  let cells = new Set()
  /** Does a condition hold for a thing in `m`'s cell? A room's own conditions (its foes down, its plates held) are met by standing in it. */
  const holds = (c, m, cell) => {
    if (!c) return true
    if ('clear' in c) return !!flags['item:sword'] && cells.has(`${m.id}|${cell}`)
    if ('plates' in c) {
      // (A psi block onto its plate is Luna's work.)
      const psi = m.info.base.some((t, i) => t === 'B' && m.cell(i % m.info.w, Math.floor(i / m.info.w)) === cell)
      return cells.has(`${m.id}|${cell}`) && (!psi || !!flags.luna)
    }
    if ('view' in c) return true
    return Z.condMet(g, W, c, cell)
  }
  /** Where the folk who stand in a way (the wardens, the ferryman) still stand, as `map|tile`. */
  const hiders = Object.values(maps).flatMap(m => m.info.marks.filter(v => v.ent.t === 'npc' && v.ent.hide).map(v => ({ m, v })))
  const guardsNow = () => hiders.filter(({ m, v }) => !holds(v.ent.hide, m, m.cell(v.x, v.y))).map(({ m, v }) => `${m.id}|${m.at(v.x, v.y)}`)
  let walkedWay = null
  function walk() {
    seen = Object.fromEntries(Object.values(maps).map(m => [m.id, new Uint8Array(m.info.base.length)]))
    cells = new Set()
    const queue = []
    const stoodOn = new Map()
    for (const { m, v } of hiders) if (!holds(v.ent.hide, m, m.cell(v.x, v.y))) stoodOn.set(m, (stoodOn.get(m) ?? new Set()).add(m.at(v.x, v.y)))
    const open = (m, i) => {
      if (stoodOn.get(m)?.has(i)) return false
      const t = m.info.base[i]
      const gate = m.gates.get(i)
      if (gate) return !!gate.trap || !!flags[`gate:${gate.id}`]
      const d = m.door.get(i)
      if (d) return opened.has(d)
      if (NEEDS[t]) return !!flags[NEEDS[t]]
      if (Z.TILE_INFO[t].pit) return m.filled.has(i)
      return !Z.TILE_INFO[t].solid || PUZZLES.has(t)
    }
    const walked = new Map()
    const push = (id, x, y) => {
      const m = maps[id]
      const i = m.at(x, y)
      if (seen[id][i]) return
      seen[id][i] = 1
      const cell = m.cell(x, y)
      if (walked.get(id) !== cell) { walked.set(id, cell); cells.add(`${id}|${cell}`) }
      queue.push([m, x, y])
    }
    const enter = (id, entry) => { const e = maps[id].info.entries[entry]; push(id, Math.floor(e.x), Math.floor(e.y)) }
    enter(W.start.map, W.start.entry)
    for (let q = 0; q < queue.length; q++) {
      const [m, x, y] = queue[q]
      const { info } = m
      const warp = m.warps.get(m.at(x, y))
      if (warp) enter(warp.to, warp.entry)
      // Over the edge onto the next land of the grid.
      const o = (x === 0 || y === 0 || x === info.w - 1 || y === info.h - 1) && W.atlas[m.id]
      if (o) for (const [dx, dy] of STEPS) {
        if (x + dx >= 0 && y + dy >= 0 && x + dx < info.w && y + dy < info.h) continue
        for (const [id, p] of Object.entries(W.atlas)) {
          const nx = o.x + x + dx - p.x
          const ny = o.y + y + dy - p.y
          const n = maps[id]
          if (id !== m.id && nx >= 0 && ny >= 0 && nx < n.info.w && ny < n.info.h && open(n, n.at(nx, ny))) push(id, nx, ny)
        }
      }
      for (const [dx, dy] of STEPS) {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || ny < 0 || nx >= info.w || ny >= info.h) continue
        const i = m.at(nx, ny)
        // Down a hole, to the same tile of the floor below.
        if (m.def.below && Z.TILE_INFO[info.base[i]].pit) push(m.def.below, nx, ny)
        if (open(m, i)) push(m.id, nx, ny)
      }
      // The hook: over anything low to something that bites, up to seven tiles off in the same room.
      if (flags['item:hook']) for (const [dx, dy] of STEPS) {
        for (let k = 1; k <= 7; k++) {
          const ax = x + dx * k
          const ay = y + dy * k
          if (ax < 0 || ay < 0 || ax >= info.w || ay >= info.h || m.cell(ax, ay) !== m.cell(x, y)) break
          const t = info.base[m.at(ax, ay)]
          if (Z.TILE_INFO[t].hook) { if (k > 1 && open(m, m.at(ax - dx, ay - dy))) push(m.id, ax - dx, ay - dy); break }
          if (Z.TILE_INFO[t].wall && !PUZZLES.has(t)) break
        }
      }
      // The Magnet: to a bolt, over anything low, up to seven tiles off in the same room (the Heap's iron that moves,
      // crates and carts, is a puzzle: `PUZZLES`).
      if (flags['item:magnet']) for (const [dx, dy] of STEPS) {
        for (let k = 1; k <= 7; k++) {
          const ax = x + dx * k
          const ay = y + dy * k
          if (ax < 0 || ay < 0 || ax >= info.w || ay >= info.h || m.cell(ax, ay) !== m.cell(x, y)) break
          const t = info.base[m.at(ax, ay)]
          if (t === '▧') { if (k > 1 && open(m, m.at(ax - dx, ay - dy))) push(m.id, ax - dx, ay - dy); break }
          if (Z.TILE_INFO[t].wall && !PUZZLES.has(t)) break
        }
      }
    }
  }
  /** Is a thing at (x, y) within a hand's reach: on a walked tile or beside one, or across a shop counter? */
  const near = (m, x, y) => [[0, 0], ...STEPS].some(([dx, dy]) => {
    const on = (px, py) => px >= 0 && py >= 0 && px < m.info.w && py < m.info.h && !!seen[m.id][m.at(px, py)]
    return on(x + dx, y + dy) || (m.info.base[(y + dy) * m.info.w + x + dx] === 'n' && on(x + 2 * dx, y + 2 * dy))
  })
  let changed = true
  const set = f => { if (!flags[f]) { flags[f] = true; changed = true } }
  const get = (item, ring) => {
    if (item === 'smallKey') key(ring)
    else if (item === 'bigKey' && ring !== 'shrine') flags[`bigkey:${ring}`] = true
    else { set(`item:${item}`); if (item === 'sword') g.inv.sword = true }
    changed = true
  }
  /** Once a walk: take a thing named `id`, if it is not taken yet. */
  const once = (id, f) => { if (!taken.has(id)) { taken.add(id); changed = true; f() } }
  for (let turns = 0; changed; turns++) {
    assert.ok(turns < 200, 'the walk settles')
    changed = false
    // (A new walk only when something has changed what can be walked on.)
    const way = [...Object.values(NEEDS), 'item:hook', 'item:magnet'].filter(f => flags[f]).join() + guardsNow().join() + Object.keys(flags).filter(f => f.startsWith('gate:')).length
    if (way !== walkedWay) { walkedWay = way; walk(); changed = true }
    for (const m of Object.values(maps)) {
      const ring = m.def.keyring ?? 'shrine'
      for (const gate of m.info.gates) {
        if (gate.trap || flags[`gate:${gate.id}`]) continue
        if (holds(gate.open, m, gate.cell) && gate.tiles.some(i => near(m, i % m.info.w, Math.floor(i / m.info.w)))) set(`gate:${gate.id}`)
      }
      for (const { ent: e, x, y } of m.info.marks) {
        const cell = m.cell(x, y)
        if (e.t === 'enemy') {
          if ((e.once || e.carries) && flags['item:sword'] && (!BOSS_TOOL[e.kind] || flags[BOSS_TOOL[e.kind]]) && cells.has(`${m.id}|${cell}`)) {
            once(`foe ${m.id} ${x},${y}`, () => { if (e.once) set(e.once); if (e.carries) get(e.carries, ring) })
          }
          continue
        }
        // (A beam lights a receiver from across its room: nobody need stand beside it.)
        if (e.t === 'receiver' && cells.has(`${m.id}|${cell}`)) set(e.flag)
        // (A thrower's gifts are refused from anywhere in its room, by a hero who holds THE NO.)
        if (e.t === 'npc' && e.attend?.stock && flags['item:no'] && cells.has(`${m.id}|${cell}`)) set(e.attend.stock.set)
        if (!near(m, x, y)) continue
        if (e.t === 'chest' && holds(e.appear, m, cell)) once(`chest ${e.id}`, () => { set(`chest:${e.id}`); get(e.item, ring) })
        if (e.t === 'item' && holds(e.appear, m, cell)) once(`item ${e.id}`, () => { set(`took:${e.id}`); get(e.item, ring) })
        if (e.t === 'lever') set(e.flag)
        if (e.t === 'glyph') for (const code of m.def.codes ?? []) set(code.flag)
        if (e.t === 'npc' && !(e.hide && holds(e.hide, m, cell))) {
          const talk = e.talk.find(b => holds(b.when, m, cell))
          if (!talk) continue
          if (talk.give) once(`gift ${e.id} ${talk.give} ${talk.set ?? ''}`, () => { set(`got:${e.id}:${talk.give}`); get(talk.give, ring) })
          if (talk.set) set(talk.set)
          if (e.join && flags[talk.set ?? '']) set('luna')
        }
      }
      // What a room says on being walked into, and what Luna says once she follows.
      for (const [c, def] of Object.entries(m.def.kind === 'dungeon' ? m.def.cells ?? {} : {})) {
        const [cx, cy] = c.split(',').map(Number)
        const cell = m.cell(cx * m.def.cell.w, cy * m.def.cell.h)
        if (!cells.has(`${m.id}|${cell}`)) continue
        for (const ev of def.events ?? []) if (holds(ev.when, m, cell)) set(ev.set)
      }
    }
    if (flags.luna) { const b = W.luna?.find(v => Z.condMet(g, W, v.when, -1)); if (b?.set) set(b.set) }
  }
  const at = doors.filter(d => !opened.has(d) && d.tiles.some(i => near(maps[d.map], i % maps[d.map].info.w, Math.floor(i / maps[d.map].info.w))))
  const free = ring => (keys[ring] ?? 0) - [...opened].filter(d => !d.big && d.ring === ring).length
  const out = []
  for (const m of Object.values(maps)) {
    for (const { ent: e, x, y } of m.info.marks) {
      if ((e.t === 'chest' && !taken.has(`chest ${e.id}`)) || (e.t === 'item' && !taken.has(`item ${e.id}`))) out.push(`${m.id}: ${e.item} at ${x},${y}`)
      if (e.t === 'enemy' && e.carries && !taken.has(`foe ${m.id} ${x},${y}`)) out.push(`${m.id}: the ${e.carries} the ${e.kind} carries at ${x},${y}`)
    }
    for (const gate of m.info.gates) if (!gate.trap && !flags[`gate:${gate.id}`]) out.push(`${m.id}: gate ${gate.id}`)
    if (!seen[m.id].includes(1)) out.push(`${m.id}: never walked into`)
  }
  for (const d of doors) if (!opened.has(d)) out.push(d.name)
  return { at, free, bigKey, out }
}

/** The best any order of keys into doors comes to: what stays out of reach (nothing, if some order opens all). */
function solve(W) {
  const world = survey(W)
  const tried = new Set()
  let best = null
  function from(opened) {
    const name = [...opened].map(d => d.name).sort().join()
    if (tried.has(name) || best?.length === 0) return
    tried.add(name)
    assert.ok(tried.size < 2000, 'the orders to try are few')
    const r = round(W, world, opened)
    if (!best || r.out.length < best.length) best = r.out
    const big = r.at.filter(d => d.big && r.bigKey(d.ring))
    if (big.length) return from(new Set([...opened, ...big]))
    const small = r.at.filter(d => !d.big && r.free(d.ring) > 0)
    // Keys for every door the walk stands at: all open. Else each choice in turn.
    const all = small.filter(d => r.free(d.ring) >= small.filter(o => o.ring === d.ring).length)
    if (all.length) return from(new Set([...opened, ...all]))
    for (const d of small) from(new Set([...opened, d]))
  }
  from(new Set())
  return best
}

/**
 * What a dungeon that is landing part by part cannot open yet. The list is exact: the part that opens a thing takes
 * its line out, and a finished world has none.
 */
const OWED = []

describe('the whole world can be opened', () => {
  it('reaches every chest, key, locked door and gate in some order, with only what the world gives', () => {
    assert.deepEqual([...solve(Z.WORLD)].sort(), [...OWED].sort())
    // The walk can say no: without the hook's chest the lands past it stay shut.
    const lab = Z.WORLD.maps.lab1
    const [ch, mark] = Object.entries(lab.marks).find(([, m]) => m.ent.item === 'hook')
    const without = { ...Z.WORLD, maps: { ...Z.WORLD.maps, lab1: { ...lab, marks: { ...lab.marks, [ch]: { ...mark, ent: { ...mark.ent, item: 'bits5' } } } } } }
    const shut = round(without, survey(without), new Set()).out
    assert.ok(shut.includes('deep2: never walked into'), shut.join('\n'))
  })
})
