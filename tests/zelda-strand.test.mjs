// Can the hero always get back? `zelda-reach.test.mjs` asks whether everything can be reached; this asks the other
// way: of every tile he can stand on, can he walk, hook, fall or warp back to the town he started in? The hook is what
// strands him: it lands him beside a post or a chest across water or a counter, and a tile with nothing to hook back to
// is a pocket (five were found and mended on 2026-11-27: a pond island, an estate island, a lake island, a gully ledge
// and a shop counter). A map change that makes a new pocket fails here and names it.
//
// Modelled: a directed graph over (map, tile, view) of everything the hero does by himself, with everything the world
// gives in hand (bombs, the hook, the Arc Blade, the Magnet, Luna) and both view rules (flat and iso: the `□` and `◇`
// tiles are wall in one view and floor in the other; he can turn the view wherever he stands). Edges: a step (over a
// terrain ledge only down or level, ramps given), an ice slide, a fall through a hole to the map below, a warp, the
// walk over a map's edge into the next land of the atlas, the Magnet (to a bolt within 7.5 tiles in sight, to the near
// side of it), the bath attendant's lift to the Steamhouse, and the hook (straight to the first thing that bites, up to
// HOOK_RANGE tiles off, landing on the last open tile before it). The hook's range is the engine's own, 8: the chain is
// 8.35 tiles long, so a target that is the eighth tile counts as reached (at 7 the model calls the Deep Lab's platform
// a pocket, and the real hook does reach its pillar).
// Not modelled: puzzles (a push block, a crystal block, iron that moves, a sluice are taken as given way), gates and
// locks (open: the hero has his keys, and what holds him in a room only holds him once), people standing in a way,
// diagonal hook aims, a block jammed behind him, a room he cannot clear, the side maps (`kind: 'side'`) and the
// moving things. A pocket the model cannot see (one a puzzle or a lock makes) is not guarded.
// Things the hero pushes (a block, a mirror) are not modelled either: every one is taken as floor, so a push that shuts a stair in is not seen here.
// Everything comes through the loader's exports: `WORLD`, `mapInfo`, `cellIndex`, `TILE_INFO` and `HOOK_RANGE`.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

const STEPS = [[1, 0], [-1, 0], [0, 1], [0, -1]]
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }
/** Tiles that look solid and give way to something the hero has, or to a push: floor for the model. */
const GIVES_WAY = new Set([...'LKR%lBPC¤bμνω▣▤▥▦ψor*D>'])
const RAMP = { ж: [0, -1], з: [0, 1], и: [1, 0], й: [-1, 0] }
const IRON = new Set([...'▣▤▥▦'])

/** The world as a graph of (map, tile, view); returns the nodes, their out-edges and the node he starts on. */
function graph(W) {
  const T = Z.TILE_INFO
  const maps = {}
  for (const [id, def] of Object.entries(W.maps)) {
    const info = Z.mapInfo(W, id)
    const { w, h } = info
    // Terrain: a height per tile; he climbs down or level, never up (a ramp counts one lower).
    let heights = null
    const ground = Math.max(1, Math.min(4, def.terrain?.ground ?? 1))
    if (def.terrain) {
      heights = Array.from({ length: w * h }, (_, i) => {
        const ch = def.terrain.heights?.[Math.floor(i / w)]?.[i % w]
        return ch !== undefined && ch >= '0' && ch <= '9' ? Math.min(4, Number(ch)) : ground
      })
    }
    const gateTiles = new Set(info.gates.flatMap(g => g.tiles))
    const warpAt = new Map()
    for (const v of info.warps) for (let dy = 0; dy < v.h; dy++) for (let dx = 0; dx < v.w; dx++) warpAt.set((v.y + dy) * w + v.x + dx, v)
    const bolts = info.base.flatMap((t, i) => (t === '▧' ? [i] : []))
    maps[id] = {
      id, def, info, w, h, heights, ground, gateTiles, warpAt, bolts,
      hasView: info.base.some(t => t === '□' || t === '◇'),
      cellOf: (x, y) => Z.cellIndex(info, x + 0.5, y + 0.5),
    }
  }
  /** Can he stand on tile `i` in view `v` (0 flat, 1 iso, -1 a map with one view)? */
  const passable = (m, i, v) => {
    const t = m.info.base[i]
    if (m.gateTiles.has(i)) return true
    if (m.info.scenery.has(i)) return false
    if (t === '□') return v !== 0
    if (t === '◇') return v !== 1
    if (GIVES_WAY.has(t)) return true
    return t !== 'O' && !T[t].solid
  }
  // A step up a ledge is not a step: `z` is the height he stands at, a ramp tile counts one lower.
  const above = (m, ti, z) => {
    if (!m.heights) return false
    const reach = z < m.ground ? z + 1 : z
    return RAMP[m.info.base[ti]] ? m.heights[ti] - 1 > reach : m.heights[ti] > reach
  }

  const nodes = new Map()
  const keyOf = []
  const adj = []
  const kind = []
  const nid = (id, i, v) => {
    const k = `${id}|${i}|${maps[id].hasView ? v : -1}`
    let n = nodes.get(k)
    if (n === undefined) { n = keyOf.length; nodes.set(k, n); keyOf.push([id, i, maps[id].hasView ? v : -1]); adj.push([]); kind.push([]) }
    return n
  }
  /** The tile a warp or an entry puts him on (one step out of a door, if the entry is a door). */
  const arrival = (to, entry) => {
    const t = maps[to]
    const e = t.info.entries[entry] ?? t.info.entries[Object.keys(t.info.entries)[0]]
    const d = e.out ? DIRS[e.dir] : [0, 0]
    return Math.floor(e.y + d[1]) * t.w + Math.floor(e.x + d[0])
  }
  /** Arriving on a map with two views, he may be in either where the tile lets him. */
  const arriveAt = (to, i) => (maps[to].hasView ? [0, 1].filter(v => passable(maps[to], i, v)) : [-1]).map(v => nid(to, i, v))
  const attendants = Object.values(maps).flatMap(m => m.info.marks.filter(k => k.ent.t === 'npc' && k.ent.attend?.mode === 'ask').map(k => ({ m, x: k.x + 0.5, y: k.y + 0.5, ring: k.ent.attend.ring ?? 2.5 })))

  const queue = []
  const seen = new Set()
  const go = (a, b, k) => {
    if (a !== b) { adj[a].push(b); kind[a].push(k) }
    if (!seen.has(b)) { seen.add(b); queue.push(b) }
  }
  const start = nid(W.start.map, arrival(W.start.map, W.start.entry), 1)
  seen.add(start)
  queue.push(start)

  for (let q = 0; q < queue.length; q++) {
    const a = queue[q]
    const [id, i, v] = keyOf[a]
    const m = maps[id]
    const { w, h, info } = m
    const x = i % w
    const y = (i - x) / w
    const dungeon = m.def.kind === 'dungeon'
    const sameRoom = (px, py) => !dungeon || m.cellOf(px, py) === m.cellOf(x, y)
    const warp = m.warpAt.get(i)
    if (warp) { for (const b of arriveAt(warp.to, arrival(warp.to, warp.entry))) go(a, b, 'warp'); continue }
    if (m.hasView && info.base[i] !== '□' && info.base[i] !== '◇') go(a, nid(id, i, 1 - v), 'view')
    const z = m.heights ? m.heights[i] : 0

    for (const [dx, dy] of STEPS) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
      const j = ny * w + nx
      if (info.base[j] === 'O') {
        // A hole: down to the same tile of the floor below, or the nearest open one within three.
        const lo = maps[m.def.below]
        if (!lo) continue
        let land = -1
        if (passable(lo, j, v)) land = j
        else {
          search: for (let r = 1; r <= 3; r++) for (const [ox, oy] of [[0, 1], [1, 0], [-1, 0], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
            const lx = nx + ox * r
            const ly = ny + oy * r
            if (lx < 0 || ly < 0 || lx >= lo.w || ly >= lo.h) continue
            if (passable(lo, ly * lo.w + lx, v) && lo.info.base[ly * lo.w + lx] !== 'O') { land = ly * lo.w + lx; break search }
          }
        }
        if (land >= 0) go(a, nid(lo.id, land, v), 'fall')
        continue
      }
      if (passable(m, j, v) && !above(m, j, z)) go(a, nid(id, j, v), 'step')
    }

    // Ice: a push on an ice tile slides him on until the first tile that is not ice, or the last one before a wall.
    if (info.base[i] === 'α') {
      for (const [dx, dy] of STEPS) {
        let cx = x
        let cy = y
        for (let n = 0; n < 64; n++) {
          const nx = cx + dx
          const ny = cy + dy
          if (nx < 0 || ny < 0 || nx >= w || ny >= h || info.base[ny * w + nx] === 'O' || !passable(m, ny * w + nx, v)) break
          cx = nx
          cy = ny
          if (info.base[ny * w + nx] !== 'α') break
        }
        if (cx !== x || cy !== y) go(a, nid(id, cy * w + cx, v), 'ice')
      }
    }

    // Over a map's edge onto the next land of the atlas: one step in from the rim, if the rim and that are open.
    const ao = W.atlas[id]
    if (ao && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
      for (const [dx, dy] of STEPS) {
        if (x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h) continue
        for (const [oid, p] of Object.entries(W.atlas)) {
          const n = maps[oid]
          const nx = ao.x + x + dx - p.x
          const ny = ao.y + y + dy - p.y
          if (oid === id || nx < 0 || ny < 0 || nx >= n.w || ny >= n.h) continue
          const inI = (dy > 0 ? 1 : dy < 0 ? n.h - 2 : ny) * n.w + (dx > 0 ? 1 : dx < 0 ? n.w - 2 : nx)
          if (T[n.info.base[ny * n.w + nx]].solid || T[n.info.base[inI]].solid) continue
          go(a, nid(oid, inI, 1), 'edge')
        }
      }
    }

    // The hook: straight on to the first thing that bites, over anything low; he lands on the last open tile before it.
    for (const [dx, dy] of STEPS) {
      for (let k = 1; k <= Z.HOOK_RANGE; k++) {
        const ax = x + dx * k
        const ay = y + dy * k
        if (ax < 0 || ay < 0 || ax >= w || ay >= h || !sameRoom(ax, ay)) break
        const t = info.base[ay * w + ax]
        if (T[t].hook) {
          for (let n = k - 1; k > 1 && n >= 1; n--) {
            const li = (y + dy * n) * w + x + dx * n
            if (info.base[li] === '~' || !passable(m, li, v)) continue
            go(a, nid(id, li, v), 'hook')
            break
          }
          break
        }
        if ((t === '□' && v === 0) || (t === '◇' && v === 1)) break
        if (T[t].wall && t !== '□' && t !== '◇') break
      }
    }

    // The Magnet: to a bolt 1.6 to 7.5 tiles off in clear sight (walls and iron block it), over anything low, to the open
    // tile up to 2.5 tiles short of it.
    for (const bi of m.bolts) {
      const bx = (bi % w) + 0.5
      const by = Math.floor(bi / w) + 0.5
      const d = Math.hypot(bx - x - 0.5, by - y - 0.5)
      if (d < 1.6 || d > 7.5 || !sameRoom(bi % w, Math.floor(bi / w))) continue
      let clear = true
      const n = Math.ceil(d / 0.05)
      for (let kk = 0; kk <= n && clear; kk++) {
        const ti = Math.floor(y + 0.5 + ((by - y - 0.5) * kk) / n) * w + Math.floor(x + 0.5 + ((bx - x - 0.5) * kk) / n)
        const t = info.base[ti]
        if (ti !== bi && ((T[t].wall && t !== '□' && t !== '◇') || IRON.has(t))) clear = false
      }
      if (!clear) continue
      for (let back = 1; back <= 2.5 + 1e-9 && back < d - 0.3; back += 0.25) {
        const ti = Math.floor(by - ((by - y - 0.5) / d) * back) * w + Math.floor(bx - ((bx - x - 0.5) / d) * back)
        if (info.base[ti] === 'D' || info.base[ti] === '>' || info.base[ti] === 'O' || !passable(m, ti, v)) continue
        go(a, nid(id, ti, v), 'magnet')
        break
      }
    }

    // The bath: asked in range of its attendant, the hero is carried to the Steamhouse.
    for (const at of attendants) {
      if (at.m !== m || Math.hypot(x + 0.5 - at.x, y + 0.5 - at.y) > at.ring || !sameRoom(Math.floor(at.x), Math.floor(at.y))) continue
      for (const b of arriveAt('steamhouse', arrival('steamhouse', 'baths'))) go(a, b, 'bath')
    }
  }
  return { keyOf, adj, kind, start, maps }
}

/**
 * The tiles he can reach and cannot come back from, grouped into pockets (nodes joined by edges, both views of a tile
 * together), each with the edges that lead in from outside: `{ map, tiles: [[x, y]…], entries: [{ kind, from }] }`.
 */
function findPockets(W) {
  const { keyOf, adj, kind, start, maps } = graph(W)
  // Every node is reached from the start, so "can come back" is: the start is reachable from it.
  const radj = Array.from(adj, () => [])
  adj.forEach((out, a) => out.forEach(b => radj[b].push(a)))
  const back = new Uint8Array(adj.length)
  back[start] = 1
  for (const todo = [start]; todo.length;) for (const p of radj[todo.pop()]) if (!back[p]) { back[p] = 1; todo.push(p) }
  const group = new Map()
  const pockets = []
  for (let a = 0; a < adj.length; a++) {
    if (back[a] || group.has(a)) continue
    const nodes = []
    group.set(a, nodes)
    for (const todo = [a]; todo.length;) {
      const n = todo.pop()
      nodes.push(n)
      for (const b of [...adj[n], ...radj[n]]) if (!back[b] && !group.has(b)) { group.set(b, nodes); todo.push(b) }
    }
    const spot = n => { const [id, i] = keyOf[n]; return { map: id, x: i % maps[id].w, y: Math.floor(i / maps[id].w) } }
    for (const id of new Set(nodes.map(n => keyOf[n][0]))) {
      const here = nodes.filter(n => keyOf[n][0] === id)
      const tiles = [...new Set(here.map(n => keyOf[n][1]))].sort((p, q) => p - q).map(i => [i % maps[id].w, Math.floor(i / maps[id].w)])
      const entries = []
      for (const n of here) for (const p of radj[n]) {
        if (group.get(p) === nodes) continue
        const f = spot(p)
        entries.push({ kind: kind[p][adj[p].indexOf(n)], from: `${f.map === id ? '' : f.map}(${f.x},${f.y})` })
      }
      pockets.push({ map: id, tiles, entries })
    }
  }
  return pockets
}

/** `<map>: (x,y)…  in by <hook|magnet|fall|step> from (x,y)`: what a failure says, so the fix is a post or a tile away. */
const say = p => {
  const shown = p.tiles.slice(0, 8).map(([x, y]) => `(${x},${y})`).join('') + (p.tiles.length > 8 ? `…+${p.tiles.length - 8}` : '')
  const ins = [...new Set(p.entries.map(e => `${e.kind} from ${e.from}`))].slice(0, 4).join(', ')
  return `${p.map}: ${shown}  in by ${ins || 'the start'}`
}

describe('the hero can always get back', () => {
  it('leaves no tile he can stand on that he cannot walk, hook, fall or warp back from to the town, in either view', () => {
    const pockets = findPockets(Z.WORLD)
    assert.deepEqual(pockets.map(say), [], 'a pocket: add a post to hook back to, or open the tile')
  })

  it('can say no: the Sporelight pond island is a pocket again without its second post', () => {
    // A copy of the world with (51,24) the floor it was, not the post the hook bites on (the shared world is not touched).
    const map = Z.WORLD.maps.sporelight
    assert.equal(map.rows[24][51], '|')
    const rows = map.rows.map((r, y) => (y === 24 ? r.slice(0, 51) + ';' + r.slice(52) : r))
    const world = { ...Z.WORLD, maps: { ...Z.WORLD.maps, sporelight: { ...map, rows } } }
    const found = findPockets(world).filter(p => p.map === 'sporelight')
    assert.ok(found.some(p => p.tiles.some(([x, y]) => x === 47 && y === 24)), found.map(say).join('\n') || 'no pocket found')
  })
})
