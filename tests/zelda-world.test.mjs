// The world beyond the coast (docs/worlds/atlas.md): seven hand-made lands around the coast and the Wildwood, on
// one grid. Every map on the grid fits it; every seam between two lands is walked both ways; every gate is walked
// through and back, calm at both ends and locked the way it says; nobody gets out there without a blade; every map
// of the world is reached from the start; a save out there continues there, and a save made in the generated
// frontier that the lands replaced continues in the land that took its place; every line fits the font and the box;
// chest ids are the world's own; and every landmark's art is in the kits its map loads.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const zelda = join(here, '..', 'themes', 'zelda')
const esbuild = createRequire(import.meta.url)('esbuild')
let Z
let P
/** The font, the touch deck's key names, the name plate, the pickups' words, and the gates and lands as data. */
let X
/** Every art kit, loaded from its own chunk as the view does. */
let KITS
before(async () => {
  Z = await load()
  P = walker(Z)
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { wrapText } from '../base/pixel/font'; export { subst, TOUCH_KEYS } from './keys'; export { speakerOf } from './render/hud';
        export { itemText } from './engine/combat'; export { GATES } from './world/gates'; export { ATLAS, rescueFrontier } from './world/atlas';
        export { DEMOS } from './world/demos'; export { LANDS } from './world/lands';
        export { REALM_ART_LOADERS, loadRealmArt, kitsFor } from './render/iso/frontierArt'; export { THING_ART } from './render/iso/thingArt'`,
      resolveDir: zelda, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  X = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
  KITS = Object.fromEntries(await Promise.all(Object.keys(X.REALM_ART_LOADERS).map(async k => [k, await X.loadRealmArt(k)])))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp()) => Z.stepGame(Z.WORLD, s, 1 / 60, i)
const round = v => Math.round(v * 100) / 100
const lands = () => Object.keys(Z.WORLD.maps).filter(id => Z.WORLD.maps[id].away)

/** A hero with the blade, bombs and the hook, and every boulder and crack within three tiles of `warp` already blown. */
function armed(map, entry, warp) {
  const s = Z.createGame(Z.WORLD, { seed: 2, at: { map, entry } })
  Object.assign(s.inv, { sword: true, bombBag: true, bombs: 10, hook: true })
  for (const f of ['item:sword', 'item:bombBag', 'item:hook']) s.flags[f] = true
  const info = Z.mapInfo(Z.WORLD, map)
  if (warp) for (let y = warp.y - 3; y <= warp.y + 3; y++) for (let x = warp.x - 3; x <= warp.x + 3; x++) {
    const t = info.base[y * info.w + x]
    if (t === 'R' || t === '%') s.flags[`bomb:${map}:${y * info.w + x}`] = true
  }
  Z.enterMap(Z.WORLD, s, map, entry, [])
  return s
}

/** Where the folk who stand aside only for a blade stand (the wardens, the ferryman), as `map|tile`. */
function bladeGuards() {
  const out = new Set()
  for (const [id, def] of Object.entries(Z.WORLD.maps)) {
    const w = [...def.rows[0]].length
    def.rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const e = def.marks?.[ch]?.ent
      if (e?.t === 'npc' && e.hide && 'item' in e.hide && e.hide.item === 'sword') out.add(`${id}|${y * w + x}`)
    }))
  }
  return out
}

const warpTo = (map, to, entry) => Z.mapInfo(Z.WORLD, map).warps.find(w => w.to === to && w.entry === entry)

/** The map on the grid that holds (gx, gy), and the tile there in its own coordinates. */
function gridAt(gx, gy, not) {
  for (const [map, o] of Object.entries(Z.WORLD.atlas)) {
    if (map === not) continue
    const info = Z.mapInfo(Z.WORLD, map)
    const x = gx - o.x
    const y = gy - o.y
    if (x >= 0 && y >= 0 && x < info.w && y < info.h) return { map, x, y }
  }
  return null
}

/**
 * Shortest walks (tiles) from a map's entry over every map the feet reach: warps, seams on the grid; locks open
 * (boulders, cracks, thickets), wardens away (unless `blocked` says a tile is stood on); the hook only with `hook`.
 */
function walkDistances(map, entry, { hook = false, max = 400, blocked = null } = {}) {
  const tileDist = new Map()
  const mapDist = {}
  const key = (m, i) => `${m}|${i}`
  const queue = []
  const push = (m, x, y, d) => {
    const info = Z.mapInfo(Z.WORLD, m)
    const i = Math.floor(y) * info.w + Math.floor(x)
    if (blocked?.(m, i)) return
    const k = key(m, i)
    if (tileDist.has(k) && tileDist.get(k) <= d) return
    tileDist.set(k, d)
    queue.push([m, i, d])
  }
  const e = Z.mapInfo(Z.WORLD, map).entries[entry]
  push(map, e.x, e.y, 0)
  const open = t => (!Z.TILE_INFO[t].solid && !Z.TILE_INFO[t].pit) || t === 'R' || t === '%' || t === '*'
  for (let q = 0; q < queue.length; q++) {
    const [m, i, d] = queue[q]
    if (tileDist.get(key(m, i)) < d || d > max) continue
    if (!(m in mapDist)) mapDist[m] = d
    const info = Z.mapInfo(Z.WORLD, m)
    const x = i % info.w
    const y = (i - x) / info.w
    const w = info.warps.find(v => x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h)
    if (w && Z.WORLD.maps[w.to]) {
      const to = Z.mapInfo(Z.WORLD, w.to).entries[w.entry]
      if (to) push(w.to, to.x, to.y, d + 1)
      continue
    }
    const o = Z.WORLD.atlas[m]
    if (o) for (const [ex, ey] of [[x === 0 ? -1 : null, y], [x === info.w - 1 ? info.w : null, y], [x, y === 0 ? -1 : null], [x, y === info.h - 1 ? info.h : null]]) {
      if (ex === null || ey === null) continue
      const n = gridAt(o.x + ex, o.y + ey, m)
      if (n && open(Z.mapInfo(Z.WORLD, n.map).base[n.y * Z.mapInfo(Z.WORLD, n.map).w + n.x])) push(n.map, n.x, n.y, d + 1)
    }
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx
      const ny = y + dy
      if (nx < 0 || ny < 0 || nx >= info.w || ny >= info.h) continue
      if (open(info.base[ny * info.w + nx])) push(m, nx, ny, d + 1)
    }
    // The hook: over anything low to a post up to seven tiles off, landing in front of it.
    if (hook) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      for (let k = 2; k <= 7; k++) {
        const ax = x + dx * k
        const ay = y + dy * k
        if (ax < 0 || ay < 0 || ax >= info.w || ay >= info.h) break
        const t = info.base[ay * info.w + ax]
        if (Z.TILE_INFO[t].hook) { if (open(info.base[(ay - dy) * info.w + ax - dx])) push(m, ax - dx, ay - dy, d + k); break }
        if (Z.TILE_INFO[t].wall) break
      }
    }
  }
  return { tileDist, mapDist }
}

/**
 * The passes between maps on the grid: runs of rim tiles a walker can stand on, with open ground on the map
 * beyond. Each is { from, to, side, tiles: [[x, y], …] } in `from`'s coordinates.
 */
function passes() {
  const out = []
  for (const [m, o] of Object.entries(Z.WORLD.atlas)) {
    const info = Z.mapInfo(Z.WORLD, m)
    const open = (inf, x, y) => !Z.TILE_INFO[inf.base[y * inf.w + x]].solid
    const sides = [
      ['n', [...Array(info.w).keys()].map(x => [x, 0, x, -1])],
      ['s', [...Array(info.w).keys()].map(x => [x, info.h - 1, x, info.h])],
      ['w', [...Array(info.h).keys()].map(y => [0, y, -1, y])],
      ['e', [...Array(info.h).keys()].map(y => [info.w - 1, y, info.w, y])],
    ]
    for (const [side, tiles] of sides) {
      let run = null
      for (const [x, y, bx, by] of tiles) {
        const n = gridAt(o.x + bx, o.y + by, m)
        // (A warp on the rim is a gate, walked by its own test.)
        const warp = info.warps.some(v => x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h)
        const ok = n && !warp && open(info, x, y) && open(Z.mapInfo(Z.WORLD, n.map), n.x, n.y)
        if (ok && run && run.to === n.map) run.tiles.push([x, y])
        else if (ok) { run = { from: m, to: n.map, side, tiles: [[x, y]] }; out.push(run) }
        else run = null
      }
    }
  }
  return out
}

describe('the grid', () => {
  it('puts every land on the grid, none over another, and leaves the hand-made maps their sizes', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    for (const id of lands()) assert.ok(Z.WORLD.atlas[id], `${id} is on the grid`)
    assert.deepEqual(Object.keys(Z.WORLD.atlas).sort(), Object.keys(X.ATLAS).sort())
    assert.deepEqual([Z.WORLD.maps.overworld.rows.length, Z.WORLD.maps.overworld.rows[0].length], [48, 104])
    assert.deepEqual([Z.WORLD.maps.wildwood.rows.length, Z.WORLD.maps.wildwood.rows[0].length], [52, 84])
    assert.deepEqual(Z.WORLD.atlas.overworld, { x: 0, y: 0 })
    assert.deepEqual(Z.WORLD.atlas.wildwood, { x: -84, y: -12 })
  })

  it('opens every seam between two lands on both sides, and only between lands', () => {
    const ps = passes()
    for (const p of ps) {
      assert.ok(Z.WORLD.maps[p.from].away && Z.WORLD.maps[p.to].away, `${p.from} → ${p.to} at ${p.tiles[0]}: a seam joins two lands (the coast and the Wildwood are left by their gates)`)
      assert.ok(ps.some(q => q.from === p.to && q.to === p.from), `${p.from} → ${p.to}: the pass is open from ${p.to} too`)
    }
  })

  it('walks every seam both ways and lands at the same place on the grid', () => {
    for (const p of passes()) {
      const [x, y] = p.tiles[Math.floor(p.tiles.length / 2)]
      const s = armed(p.from, Object.keys(Z.mapInfo(Z.WORLD, p.from).entries)[0])
      s.map.enemies = []
      s.hero.x = x + 0.5
      s.hero.y = y + 0.5
      const move = { n: { x: 0, y: -1 }, s: { x: 0, y: 1 }, w: { x: -1, y: 0 }, e: { x: 1, y: 0 } }[p.side]
      for (let i = 0; i < 120 && s.mode !== 'warp'; i++) { if (s.mode === 'dialog') P.settle(s); step(s, inp({ move })) }
      assert.equal(s.mode, 'warp', `${p.from} → ${p.to} at ${x},${y}: the edge leads on`)
      for (let i = 0; i < 180 && s.mode !== 'play'; i++) { step(s); if (s.mode === 'dialog') P.settle(s) }
      assert.equal(s.map.id, p.to)
      const o = Z.WORLD.atlas[p.from]
      const t = Z.WORLD.atlas[p.to]
      const gx = Math.floor(s.hero.x) + t.x - o.x
      const gy = Math.floor(s.hero.y) + t.y - o.y
      assert.ok(Math.abs(gx - x) + Math.abs(gy - y) <= 2, `${p.from} → ${p.to}: arrives at ${gx},${gy} (in ${p.from}'s tiles), left from ${x},${y}`)
      // The continue point is the land walked into.
      assert.equal(s.entry.map, p.to)
    }
  })
})

describe('the gates', () => {
  for (const id of ['fell', 'spore', 'sand', 'lawns', 'quarry', 'fog']) {
    it(`walks through the ${id} gate and back; calm at both ends, and a save made at it continues there`, () => {
      const g = X.GATES.find(x => x.id === id)
      const out = warpTo(g.home, g.land, `gate-${g.id}`)
      assert.ok(out, `${g.home} leads to ${g.land}`)
      // The gate's two ends lie side by side on the grid.
      const o = Z.WORLD.atlas[g.home]
      const t = Z.WORLD.atlas[g.land]
      const back = warpTo(g.land, g.home, `gate-${g.id}`)
      assert.ok(back, `${g.land} leads home to ${g.home}`)
      assert.equal(Math.abs(o.x + out.x - (t.x + back.x)) + Math.abs(o.y + out.y - (t.y + back.y)), 1, `${id}: the two ends are neighbours on the grid`)
      const s = armed(g.home, `gate-${g.id}`, out)
      s.map.enemies = []
      P.walkTo(s, out.x, out.y, { keepDialog: true })
      for (let i = 0; i < 120 && s.mode === 'warp'; i++) step(s)
      assert.equal(s.map.id, g.land)
      const at = Z.mapInfo(Z.WORLD, g.land).entries[`gate-${g.id}`]
      assert.deepEqual([round(s.hero.x), round(s.hero.y)], [at.x, at.y], 'at the gate')
      assert.deepEqual(s.entry, { map: g.land, entry: `gate-${g.id}` })
      P.settle(s)
      const near = s.map.enemies.filter(e => !e.dead && Math.abs(e.x - at.x) + Math.abs(e.y - at.y) < 10)
      assert.deepEqual(near.map(e => `${e.kind} ${e.x},${e.y}`), [], 'no foe within ten tiles of the gate')
      for (let k = 0; k < 180; k++) { s.hero.invuln = 1; step(s) }
      assert.equal(s.mode, 'play', 'no fight at the gate')
      const u = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))) })
      assert.equal(u.map.id, g.land)
      assert.deepEqual([round(u.hero.x), round(u.hero.y)], [at.x, at.y])
      Z.enterMap(Z.WORLD, s, g.land, `gate-${g.id}`, [])
      s.map.enemies = []
      P.walkTo(s, back.x, back.y)
      for (let i = 0; i < 120 && s.mode !== 'play'; i++) step(s)
      assert.equal(s.map.id, g.home)
      const home = Z.mapInfo(Z.WORLD, g.home).entries[`gate-${g.id}`]
      assert.deepEqual([round(s.hero.x), round(s.hero.y)], [home.x, home.y])
    })
  }

  it('keeps each gate locked the way it says: a boulder, a crack, a warden without a blade', () => {
    const ow = Z.mapInfo(Z.WORLD, 'overworld')
    const tile = (x, y) => ow.base[y * ow.w + x]
    const fell = warpTo('overworld', 'seterfell', 'gate-fell')
    assert.equal(tile(fell.x, fell.y + 1), 'R', 'a boulder in the woods gate')
    const sand = warpTo('overworld', 'stillsand', 'gate-sand')
    assert.equal(tile(sand.x - 1, sand.y), '%', 'a crack in the graves gate')
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'gate-spore' } })
    for (const w of ['warden.market', 'warden.lake', 'warden.woods', 'warden.graves']) assert.ok(s.map.npcs.some(n => n.id === w), w)
    const ww = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'wildwood', entry: 'gate-quarry' } })
    assert.ok(ww.map.npcs.some(n => n.id === 'warden.grove') && ww.map.npcs.some(n => n.id === 'warden.deep'))
    const t = armed('overworld', 'gate-spore')
    assert.ok(!t.map.npcs.some(n => n.id.startsWith('warden.')), 'with a blade they stand aside')
  })

  it('reaches every gate on foot from the start, and the deep woods gate with the hook', () => {
    const away = id => !!Z.WORLD.maps[id]?.away
    const { tileDist } = walkDistances('overworld', 'start', { blocked: m => away(m) })
    const reached = (map, w) => tileDist.has(`${map}|${w.y * Z.mapInfo(Z.WORLD, map).w + w.x}`)
    for (const g of X.GATES) {
      const w = warpTo(g.home, g.land, `gate-${g.id}`)
      if (g.id === 'fog') {
        assert.ok(!reached(g.home, w), 'the deep woods gate is past the ravine')
        const deep = walkDistances('wildwood', 'deep', { hook: true, max: 200, blocked: m => away(m) })
        assert.ok(deep.tileDist.has(`wildwood|${w.y * Z.mapInfo(Z.WORLD, 'wildwood').w + w.x}`), 'past the ravine, with the hook')
      } else assert.ok(reached(g.home, w), `the ${g.id} gate is reached from the start`)
    }
  })

  it('lets nobody into the lands without a blade: bombs, the hook and every lock open, the wardens and the ferryman stand', () => {
    const guards = bladeGuards()
    const { tileDist } = walkDistances('overworld', 'start', { hook: true, max: 5000, blocked: (m, i) => guards.has(`${m}|${i}`) })
    const out = [...tileDist.keys()].filter(k => Z.WORLD.maps[k.split('|')[0]].away)
    assert.deepEqual(out.slice(0, 3), [], 'no tile out there is reached')
    assert.ok([...tileDist.keys()].some(k => k.startsWith('wildwood|')), 'the walk is not simply stuck')
  })
})

describe('the lands', () => {
  it('reaches every land, and every map a land leads into, from the start with the blade, bombs and the hook', () => {
    const { mapDist } = walkDistances('overworld', 'start', { hook: true, max: 100000 })
    const want = new Set(Object.keys(Z.WORLD.atlas))
    for (const id of lands()) for (const w of Z.mapInfo(Z.WORLD, id).warps) want.add(w.to)
    const missing = [...want].filter(id => !(id in mapDist))
    assert.deepEqual(missing, [])
    if (process.env.LAND_DIST) console.log(mapDist)
  })

  it('reloads a tab that was out in a land where it was, and starts a new visit in town', () => {
    for (const id of lands()) {
      const entry = Object.keys(Z.mapInfo(Z.WORLD, id).entries).find(e => e.startsWith('gate-')) ?? 'camp'
      const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: id, entry } })
      s.inv.sword = true
      const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
      const start = (sv, b, out) => Z.createGame(Z.WORLD, { save: sv, at: Z.loadSpot(Z.WORLD, sv, b, out) })
      assert.deepEqual([start(save, null, true).map.id, start(save, null, true).entry.entry], [id, entry], `${id}: a reload stays out there`)
      assert.deepEqual(start(save, null, false).entry, Z.WORLD.start, `${id}: a new visit starts on the plaza`)
      assert.ok(Z.mapInfo(Z.WORLD, id).entries.camp, `${id} has a camp, where a save out there that lost its spot goes`)
    }
  })

  it('continues a save made in the old generated frontier in the land that took its place, items and flags kept', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'start' } })
    s.inv.sword = true
    s.flags['chest:fr:7,2.c0'] = true
    s.flags['q.seed.heard'] = true
    const base = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    for (const [map, entry, want] of [
      ['fr:4,1', 'gate-fell', ['seterfell', 'gate-fell']],
      ['fr:4,1', 'camp', ['seterfell', 'camp']],
      ['fr:2,2', 'from-quarry', ['lumenby', 'camp']],
      ['fr:8,2:cave0', 'in', ['sporelight', 'camp']],
      ['fr:0,3:deep4', 'up', ['lumenby', 'deep']],
      ['fr:6,7', 'camp', ['overworld', 'crossroads']],
      ['fr:6,8', 'camp', ['overworld', 'ferry']],
      ['fr:99,99', 'camp', [Z.WORLD.start.map, Z.WORLD.start.entry]],
      ['nowhere', 'door', [Z.WORLD.start.map, Z.WORLD.start.entry]],
    ]) {
      const save = { ...base, map, entry, dig: { [map]: 'x', overworld: base.dig?.overworld ?? '' }, explored: { [map]: '1', overworld: '1' } }
      const t = Z.createGame(Z.WORLD, { save })
      assert.deepEqual([t.entry.map, t.entry.entry], want, `${map}:${entry}`)
      assert.equal(t.inv.sword, true, 'the items are kept')
      assert.ok(t.flags['chest:fr:7,2.c0'] && t.flags['q.seed.heard'], 'and the flags')
      if (map.startsWith('fr:')) assert.ok(Z.awayMap(Z.WORLD, map, entry) === !!Z.WORLD.maps[want[0]].away, `${map}: a reload knows where it is`)
    }
  })

  it('points a hero with a blade past the coast until a land is walked into, in what the QUEST box holds', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'start' } })
    assert.ok(!Z.objective(s).includes(Z.LANDS_HINT), 'not before the blade')
    s.inv.sword = true
    assert.ok(Z.objective(s).includes(Z.LANDS_HINT), 'the gates once the blade is in hand')
    s.flags['seen:seterfell'] = true
    assert.ok(!Z.objective(s).includes(Z.LANDS_HINT), 'and not once a land is found')
    const lines = t => t.split(' ').reduce((acc, w) => { const l = acc[acc.length - 1]; if (l !== undefined && (l + ' ' + w).length <= 37) acc[acc.length - 1] = l + ' ' + w; else acc.push(w); return acc }, [])
    for (const t of [Z.questHint(Z.QUEST_STEPS), Z.questHint(1) + ' ' + Z.LANDS_HINT]) assert.ok(lines(t).length <= 4, `too long for the box: ${t}`)
  })

  it('keeps foes off the ways in: none near a gate, a seam, the ferry or a stair, and never a crowd', () => {
    for (const id of lands()) {
      const info = Z.mapInfo(Z.WORLD, id)
      const def = info.def
      let foes = 0
      const doors = Object.values(info.entries)
      def.rows.forEach((r, y) => [...r].forEach((ch, x) => {
        const e = def.marks[ch]?.ent
        if (e?.t !== 'enemy') return
        foes++
        for (const d of doors) assert.ok(Math.abs(x + 0.5 - d.x) + Math.abs(y + 0.5 - d.y) >= 8, `${id}: ${e.kind} at ${x},${y} by an entry`)
      }))
      assert.ok(foes <= 24, `${id}: ${foes} field foes`)
      assert.ok((def.battle?.groups.length ?? 0) <= 10, `${id}: ${def.battle?.groups.length} battle groups`)
      for (const g of def.battle?.groups ?? []) {
        assert.ok(g.id.startsWith(`${id}.`), `${g.id}: a group's id starts with its map's`)
        for (const d of doors) assert.ok(Math.hypot(g.x - d.x, g.y - d.y) > (g.sight ?? 0) + 4, `${g.id} too near an entry`)
      }
    }
  })

  it('gives every chest in the world an id of its own', () => {
    const seen = new Map()
    for (const [map, def] of Object.entries(Z.WORLD.maps)) {
      for (const m of Object.values(def.marks)) {
        if (m.ent.t !== 'chest' && m.ent.t !== 'item') continue
        const k = `${m.ent.t === 'chest' ? 'chest' : 'took'}:${m.ent.id}`
        assert.ok(!seen.has(k) || seen.get(k) === map, `${k} in ${map} and ${seen.get(k)}`)
        seen.set(k, map)
      }
    }
  })

  it('speaks in the pixel font out there, a page at most three rows of the narrowest box, each speaker named first', () => {
    const talkOf = e => (e.t === 'npc' ? e.talk.flatMap(b => [...b.lines, ...(b.ask ? [...b.ask.options, ...b.ask.replies.flat()] : [])]) : e.t === 'sign' ? e.lines : [])
    const OWN = new Set(['KEEPER', 'MOSSA', 'MAX', 'TOBY', 'OWL', 'DUSTY', 'TROLL', 'LUNA', 'PETTER', 'BARTENDER'])
    const maps = Object.values(Z.WORLD.maps).filter(d => d.away || X.DEMOS.some(x => x.map === d.id))
    const lines = []
    const people = []
    for (const d of maps) {
      lines.push(d.name, ...Object.values(d.cells ?? {}).map(c => c.name).filter(Boolean), ...(d.areas ?? []).flatMap(a => [a.name, ...(a.intro?.lines ?? [])]))
      for (const m of Object.values(d.marks)) { lines.push(...talkOf(m.ent)); if (m.ent.t === 'npc') people.push(m.ent) }
    }
    // The questlines' first steps stand on the hand-made coast and in the Wildwood (`q.` ids).
    for (const d of Object.values(Z.WORLD.maps)) for (const m of Object.values(d.marks)) {
      if (m.ent.t === 'npc' && m.ent.id.startsWith('q.') && !d.away) { lines.push(...talkOf(m.ent)); people.push(m.ent) }
    }
    for (const item of ['pickaxe', 'shovel', 'axe', 'hammer', 'tonic3']) lines.push(...X.itemText({ inv: { pieces: 1, shrooms: 0 } }, item))
    for (const l of new Set(lines)) {
      const shown = X.subst(l, X.TOUCH_KEYS)
      assert.match(shown, /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·↑↓←→\n]*$/, `not in the font: ${l}`)
      assert.ok(X.wrapText(shown, 180).length <= 3, `more than three rows: ${l}`)
    }
    for (const p of people) for (const b of p.talk) {
      const first = b.lines[0]
      if (/^\(|^(MEOW|MRRP|MAA)\b/.test(first)) continue
      const named = X.speakerOf(first, p.look)
      assert.ok(named, `${p.id} opens without a name: ${first}`)
      assert.ok(!OWN.has(named.name), `${p.id} speaks as ${named.name}`)
      for (const l of b.lines.slice(1)) if (!l.startsWith('(')) assert.ok(X.speakerOf(l, p.look, first)?.name === named.name, `${p.id} changes voice: ${l}`)
    }
  })

  it('draws every landmark from art its map loads (the always-there things, its realm\'s kit and the kits it names)', () => {
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      const kits = X.kitsFor(def).map(k => KITS[k])
      const has = name => !!X.THING_ART[name] || kits.some(k => k?.[name])
      for (const lm of def.isoLandmarks ?? []) {
        for (const variant of [lm.art, lm.night, lm.lit?.art].filter(Boolean)) {
          const names = lm.motion && !lm.motion.bob ? Array.from({ length: lm.motion.frames }, (_, i) => `${variant}_${i}`) : [variant]
          for (const name of names) assert.ok(has(name), `${id}: ${name}`)
        }
      }
    }
  })

  it('keeps the world small on /: every map\'s data, the lands with it, in a few tens of KB gzipped', () => {
    const r = esbuild.buildSync({ entryPoints: [join(zelda, 'world', 'index.ts')], bundle: true, minify: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'error' })
    const code = r.outputFiles[0].contents
    const gz = gzipSync(code).length
    if (process.env.WORLD_SIZE) console.log(`world: ${code.length} B min, ${gz} B gz`)
    // (2026-11-25: the generated frontier made this 156 KB min / 54 KB gz; the hand-made world must stay near it.)
    assert.ok(gz <= 72_000, `world data ${gz} B gzipped`)
  })
})
