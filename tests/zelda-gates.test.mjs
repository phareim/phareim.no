// The gates (themes/zelda/world/gen/gates.ts): ways on foot from the hand-made
// world into the frontier. Each gate is walked through both ways, a save made
// at it continues there, it arrives calm (no foe at the door, no fight in the
// first seconds); every realm but Fogstage is within ~200 tiles of the start;
// the gates moved nothing a save points at (the fingerprint taken before them);
// and the continue point, the realm intros and old saves behave out there.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { readFileSync } from 'node:fs'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'
import { fingerprint } from './zelda-fingerprint.mjs'

const here = dirname(fileURLToPath(import.meta.url))
let Z
let P
let GEN
before(async () => {
  Z = await load()
  P = walker(Z)
  const esbuild = createRequire(import.meta.url)('esbuild')
  const out = esbuild.buildSync({
    stdin: { contents: `export { GATES } from './gates'; export { REALMS } from './realms'`, resolveDir: join(here, '..', 'themes', 'zelda', 'world', 'gen'), loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  GEN = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp()) => Z.stepGame(Z.WORLD, s, 1 / 60, i)
const round = v => Math.round(v * 100) / 100

/** A hero with the blade and bombs, and every boulder and crack within three tiles of `warp` on `map` already blown. */
function armed(map, entry, warp) {
  const s = Z.createGame(Z.WORLD, { seed: 2, at: { map, entry } })
  Object.assign(s.inv, { sword: true, bombBag: true, bombs: 10 })
  s.flags['item:sword'] = true
  s.flags['item:bombBag'] = true
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
    def.rows.forEach((r, y) => [...r].forEach((ch, x) => {
      const e = def.marks?.[ch]?.ent
      if (e?.t === 'npc' && e.hide && 'item' in e.hide && e.hide.item === 'sword') out.add(`${id}|${y * [...def.rows[0]].length + x}`)
    }))
  }
  return out
}

const warpTo = (map, to, entry) => Z.mapInfo(Z.WORLD, map).warps.find(w => w.to === to && w.entry === entry)

/**
 * Shortest walks (tiles) from a map's entry over every map the feet reach: warps, region edges; locks open
 * (boulders, cracks, thickets), wardens away (unless `blocked` says a tile is stood on); the hook only with `hook`;
 * only the hand-made maps with `hand`.
 */
function walkDistances(map, entry, { hook = false, max = 260, hand = false, blocked = null } = {}) {
  const realmDist = {}
  const tileDist = new Map()
  const key = (m, i) => `${m}|${i}`
  const queue = []
  const push = (m, x, y, d) => {
    if (hand && m.startsWith('fr:')) return
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
    const info = Z.mapInfo(Z.WORLD, m)
    const realm = info.def.realm
    if (realm && !(realm in realmDist)) realmDist[realm] = d
    const x = i % info.w
    const y = (i - x) / info.w
    const w = info.warps.find(v => x >= v.x && x < v.x + v.w && y >= v.y && y < v.y + v.h)
    if (w && (Z.WORLD.maps[w.to] || Z.WORLD.generate(w.to))) {
      const to = Z.mapInfo(Z.WORLD, w.to).entries[w.entry]
      if (to) push(w.to, to.x, to.y, d + 1)
      continue
    }
    const ed = info.def.edges
    if (ed) {
      if (x === 0 && ed.w) push(ed.w, Z.mapInfo(Z.WORLD, ed.w).w - 1, y, d + 1)
      if (x === info.w - 1 && ed.e) push(ed.e, 0, y, d + 1)
      if (y === 0 && ed.n) push(ed.n, x, Z.mapInfo(Z.WORLD, ed.n).h - 1, d + 1)
      if (y === info.h - 1 && ed.s) push(ed.s, x, 0, d + 1)
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
    // (A queue, not a heap: every step costs about one, warps and hooks a little more, so this is near enough.)
  }
  return { realmDist, tileDist }
}

describe('the gates', () => {
  it('cuts every gate into its region, and both ends name the same entry', () => {
    assert.ok(GEN.GATES.length >= 6)
    assert.equal(new Set(GEN.GATES.map(g => g.id)).size, GEN.GATES.length, 'gate ids are unique')
    for (const g of GEN.GATES) {
      const d = Z.WORLD.generate(g.region)
      assert.ok(d, g.region)
      assert.ok(d.entries[`gate-${g.id}`], `${g.region} has gate-${g.id}`)
      assert.ok(warpTo(g.region, g.home.map, g.home.entry), `${g.region} leads home to ${g.home.map}:${g.home.entry}`)
      assert.ok(Z.mapInfo(Z.WORLD, g.home.map).entries[g.home.entry], `${g.home.map} has ${g.home.entry}`)
      assert.ok(warpTo(g.home.map, g.region, `gate-${g.id}`), `${g.home.map} leads to ${g.region}`)
      // The hand-made maps keep their sizes (explored tiles and blown boulders are saved by tile index).
    }
    assert.deepEqual([Z.WORLD.maps.overworld.rows.length, Z.WORLD.maps.overworld.rows[0].length], [48, 104])
    assert.deepEqual([Z.WORLD.maps.wildwood.rows.length, Z.WORLD.maps.wildwood.rows[0].length], [52, 84])
  })

  for (const id of ['fell', 'spore', 'sand', 'lawns', 'quarry', 'fog']) {
    it(`walks through the ${id} gate and back, and a save made at it continues there`, () => {
      const g = GEN.GATES.find(x => x.id === id)
      const out = warpTo(g.home.map, g.region, `gate-${g.id}`)
      const s = armed(g.home.map, g.home.entry, out)
      s.map.enemies = []
      P.walkTo(s, out.x, out.y, { keepDialog: true })
      for (let i = 0; i < 120 && s.mode === 'warp'; i++) step(s)
      assert.equal(s.map.id, g.region)
      const at = Z.mapInfo(Z.WORLD, g.region).entries[`gate-${g.id}`]
      assert.deepEqual([round(s.hero.x), round(s.hero.y)], [at.x, at.y], 'at the gate')
      assert.deepEqual(s.entry, { map: g.region, entry: `gate-${g.id}` })
      // The realm's intro, once, on arrival.
      const realm = Z.WORLD.generate(g.region).realm
      assert.equal(s.mode, 'dialog', 'the realm introduces itself')
      assert.ok(s.flags[`realm:${realm}`])
      P.settle(s)
      // A calm arrival: no field foe at the door, and no fight while the hero stands there.
      const near = s.map.enemies.filter(e => !e.dead && Math.abs(e.x - at.x) + Math.abs(e.y - at.y) < 10)
      assert.deepEqual(near.map(e => `${e.kind} ${e.x},${e.y}`), [], 'no foe within ten tiles of the gate')
      for (let k = 0; k < 180; k++) { s.hero.invuln = 1; step(s) }
      assert.equal(s.mode, 'play', 'no fight at the gate')
      // Saved there, it continues there.
      const t = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))) })
      assert.equal(t.map.id, g.region)
      assert.deepEqual([round(t.hero.x), round(t.hero.y)], [at.x, at.y])
      // And home again.
      const back = warpTo(g.region, g.home.map, g.home.entry)
      Z.enterMap(Z.WORLD, s, g.region, `gate-${g.id}`, [])
      s.map.enemies = []
      P.walkTo(s, back.x, back.y)
      for (let i = 0; i < 120 && s.mode !== 'play'; i++) step(s)
      assert.equal(s.map.id, g.home.map)
      const home = Z.mapInfo(Z.WORLD, g.home.map).entries[g.home.entry]
      assert.deepEqual([round(s.hero.x), round(s.hero.y)], [home.x, home.y])
      assert.equal(s.mode, 'play')
      // Calm on this side too: no field foe set down within ten tiles of the way back in.
      const def = Z.WORLD.maps[g.home.map]
      const foes = []
      def.rows.forEach((r, y) => [...r].forEach((ch, x) => {
        if (def.marks[ch]?.ent.t === 'enemy' && Math.abs(x + 0.5 - home.x) + Math.abs(y + 0.5 - home.y) < 10) foes.push(`${def.marks[ch].ent.kind} ${x},${y}`)
      }))
      assert.deepEqual(foes, [], `no foe within ten tiles of ${g.home.entry}`)
    })
  }

  it('keeps each gate locked the way it says: a boulder, a crack, a warden without a blade', () => {
    const ow = Z.mapInfo(Z.WORLD, 'overworld')
    const tile = (x, y) => ow.base[y * ow.w + x]
    const fell = warpTo('overworld', 'fr:4,1', 'gate-fell')
    assert.equal(tile(fell.x, fell.y + 1), 'R', 'a boulder in the woods gate')
    const sand = warpTo('overworld', 'fr:9,4', 'gate-sand')
    assert.equal(tile(sand.x - 1, sand.y), '%', 'a crack in the graves gate')
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'gate-spore' } })
    assert.ok(s.map.npcs.some(n => n.id === 'warden.market'), 'the market warden stands in the gate')
    assert.ok(s.map.npcs.some(n => n.id === 'warden.lake'), 'and the lake warden in hers')
    assert.ok(s.map.npcs.some(n => n.id === 'warden.woods'), 'the woods gate has a warden by its boulder')
    assert.ok(s.map.npcs.some(n => n.id === 'warden.graves'), 'and the graves gate by its crack')
    const ww = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'wildwood', entry: 'gate-quarry' } })
    assert.ok(ww.map.npcs.some(n => n.id === 'warden.grove') && ww.map.npcs.some(n => n.id === 'warden.deep'), 'the Wildwood\'s gates have theirs')
    const t = armed('overworld', 'gate-spore')
    assert.ok(!t.map.npcs.some(n => n.id.startsWith('warden.')), 'with a blade they stand aside')
    // A bomb takes the woods gate's boulder.
    const b = armed('overworld', 'gate-fell')
    P.useB(b, 'bombs', 'up', 200)
    assert.equal(b.map.tiles[(fell.y + 1) * b.map.w + fell.x], '.', 'the boulder is blown')
    assert.ok(b.flags[`bomb:overworld:${(fell.y + 1) * ow.w + fell.x}`])
  })

  it('reaches every gate on foot from the start, and the deep woods gate with the hook', () => {
    const { tileDist } = walkDistances('overworld', 'start', { max: 400, hand: true })
    const reached = (map, w) => tileDist.has(`${map}|${w.y * Z.mapInfo(Z.WORLD, map).w + w.x}`)
    for (const g of GEN.GATES) {
      const w = warpTo(g.home.map, g.region, `gate-${g.id}`)
      if (g.id === 'fog') {
        assert.ok(!reached(g.home.map, w), 'the deep woods gate is past the ravine')
        const deep = walkDistances('wildwood', 'deep', { hook: true, max: 200, hand: true })
        assert.ok(deep.tileDist.has(`wildwood|${w.y * Z.mapInfo(Z.WORLD, 'wildwood').w + w.x}`), 'past the ravine, with the hook')
      } else assert.ok(reached(g.home.map, w), `the ${g.id} gate is reached from the start`)
    }
  })

  it('lets nobody into the frontier without a blade: bombs, the hook and every lock open, the wardens stand', () => {
    // (The bomb bag lies in Whisper Woods, reachable before the blade, and a bomb cuts the town's thicket too.)
    const guards = bladeGuards()
    const { tileDist } = walkDistances('overworld', 'start', { hook: true, max: 5000, blocked: (m, i) => guards.has(`${m}|${i}`) })
    const out = [...tileDist.keys()].filter(k => k.startsWith('fr:'))
    assert.deepEqual(out.slice(0, 3), [], 'no frontier tile is reached')
    // And the woods are reached at all (the walk is not simply stuck).
    assert.ok([...tileDist.keys()].some(k => k.startsWith('wildwood|')))
    const fell = warpTo('overworld', 'fr:4,1', 'gate-fell')
    assert.ok(tileDist.has(`overworld|${(fell.y + 3) * Z.mapInfo(Z.WORLD, 'overworld').w + fell.x}`), 'the road by the bomb bag, beside the woods gate, is')
  })

  it('brings every realm but Fogstage within about two hundred tiles of the start', () => {
    const { realmDist } = walkDistances('overworld', 'start', { max: 400 })
    const want = Object.keys(GEN.REALMS).filter(r => r !== 'fogstage' && r !== 'underglow')
    const far = want.filter(r => !(realmDist[r] <= 200)).map(r => `${r}: ${realmDist[r] ?? 'unreached'}`)
    assert.deepEqual(far, [], JSON.stringify(realmDist))
    if (process.env.GATE_DIST) console.log(realmDist)
  })

  it('speaks in the pixel font: the region signs 30 letters a line, the hand-made side in its own font', () => {
    for (const l of GEN.GATES.flatMap(g => g.lines)) {
      assert.ok(l.length <= 30, `too long: ${l}`)
      assert.match(l, /^[A-Z0-9 .,!?'":;\-()/#%&+=*]*$/, `not in the font: ${l}`)
    }
    for (const map of ['overworld', 'wildwood']) {
      const def = Z.WORLD.maps[map]
      const gateChars = new Set()
      for (const g of GEN.GATES) if (g.home.map === map) {
        const w = warpTo(map, g.region, `gate-${g.id}`)
        for (let y = w.y - 6; y <= w.y + 6; y++) for (let x = w.x - 6; x <= w.x + 6; x++) if (def.rows[y]?.[x]) gateChars.add(def.rows[y][x])
      }
      for (const ch of gateChars) {
        const e = def.marks[ch]?.ent
        const lines = e?.t === 'sign' ? e.lines : e?.t === 'npc' ? e.talk.flatMap(b => b.lines) : []
        for (const l of lines) assert.match(l, /^[A-Z0-9 .,!?'":;\-()/#%&+=*↑↓←→]*$/, `not in the font: ${l}`)
      }
    }
  })

  it('moves nothing a save points at: chests, folk, entries, caves and caches as before the gates', () => {
    const was = JSON.parse(readFileSync(join(here, 'zelda-frontier-fingerprint.json'), 'utf8'))
    const now = fingerprint(Z)
    const gates = new Map(GEN.GATES.map(g => [g.region, `gate-${g.id}`]))
    assert.deepEqual(Object.keys(now).sort(), Object.keys(was).sort(), 'the same maps')
    for (const [id, v] of Object.entries(was)) {
      const n = now[id]
      assert.deepEqual(n.chests, v.chests, `${id} chests`)
      assert.deepEqual(n.folk, v.folk, `${id} folk`)
      assert.deepEqual(n.caches ?? null, v.caches ?? null, `${id} dig caches`)
      const entries = { ...n.entries }
      if (gates.has(id)) {
        assert.ok(entries[gates.get(id)], `${id} has its gate`)
        delete entries[gates.get(id)]
      }
      assert.deepEqual(entries, v.entries, `${id} entries`)
    }
  })

  it('thins the foes: never a crowd, never empty, the Green Miles calm, smaller groups by a gate', () => {
    for (let ry = 0; ry < 12; ry++) for (let rx = 0; rx < 12; rx++) {
      const d = Z.WORLD.generate(`fr:${rx},${ry}`)
      if (!d) continue
      let foes = 0
      for (const r of d.rows) for (const c of r) if (d.marks[c]?.ent.t === 'enemy') foes++
      assert.ok(foes <= (d.realm === 'meadow' ? 8 : 18), `${d.id}: ${foes} field foes`)
      assert.ok((d.battle?.groups.length ?? 0) <= 8, `${d.id}: ${d.battle?.groups.length} battle groups`)
      // And never emptied by its places: a region out there keeps a few foes to meet.
      if (d.realm !== 'landing') assert.ok(foes >= 4 || (d.battle?.groups.length ?? 0) >= 2, `${d.id}: only ${foes} field foes, ${d.battle?.groups.length ?? 0} groups`)
      // Every foe mark is placed (a thinned-out kind leaves no mark behind).
      for (const [ch, m] of Object.entries(d.marks)) if (m.ent.t === 'enemy') assert.ok(d.rows.some(r => r.includes(ch)), `${d.id}: ${m.ent.kind} unplaced`)
    }
    for (const g of GEN.GATES) {
      const d = Z.WORLD.generate(g.region)
      for (const grp of d.battle?.groups ?? []) assert.ok(grp.foes.length <= 3, `${grp.id}: ${grp.foes.length} foes by a gate`)
    }
  })
})

describe('out in the frontier', () => {
  it('makes the region walked into the continue point, and its realm introduces itself once', () => {
    const L = Z.WORLD.generate('fr:6,8')
    const W = L.rows[0].length
    const WALK = new Set(['.', ',', ':', ';', '-', '=', '_', 'D', '>'])
    const open = (x, y) => WALK.has(L.marks[L.rows[y][x]]?.tile ?? L.rows[y][x])
    const x = [...Array(W).keys()].find(x => open(x, 0) && open(x + 1, 0) && open(x + 2, 0))
    const s = Z.createGame(Z.WORLD, { seed: 4, at: { map: 'fr:6,8', entry: 'camp' } })
    s.inv.sword = true
    const north = () => {
      s.hero.x = x + 1.5
      s.hero.y = 1.5
      for (let i = 0; i < 200 && s.mode !== 'warp'; i++) step(s, inp({ move: { x: 0, y: -1 } }))
      for (let i = 0; i < 120 && s.mode === 'warp'; i++) step(s)
    }
    north()
    const next = L.edges.n
    assert.equal(s.map.id, next)
    const realm = Z.WORLD.generate(next).realm
    assert.equal(s.mode, 'dialog', 'the realm introduces itself')
    assert.ok(s.flags[`realm:${realm}`])
    P.settle(s)
    // Death and a reload come back here, at the region's camp.
    assert.deepEqual(s.entry, { map: next, entry: 'camp' })
    assert.equal(Z.toSave(s).map, next)
    Z.respawn(Z.WORLD, s)
    assert.equal(s.map.id, next)
    // Walked in again: no second introduction.
    Z.enterMap(Z.WORLD, s, 'fr:6,8', 'camp', [])
    north()
    assert.equal(s.map.id, next)
    assert.equal(s.mode, 'play')
  })

  it('reloads a tab that was out there at its camp, the way the shell starts a page; a new visit starts in town', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'fr:7,2', entry: 'camp' } })
    s.inv.sword = true
    const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    const back = { map: 'overworld', entry: 'arcade' }
    // What Zelda.vue does on mount: begin(local, loadSpot(WORLD, local, readReturn(), readOut())).
    const load = (sv, b, out) => Z.createGame(Z.WORLD, { save: sv, at: Z.loadSpot(Z.WORLD, sv, b, out) })
    for (const b of [null, back]) {
      const t = load(save, b, true)
      assert.deepEqual([t.map.id, t.entry.entry], ['fr:7,2', 'camp'], 'a reload out there stays out there')
      const at = Z.mapInfo(Z.WORLD, 'fr:7,2').entries.camp
      assert.deepEqual([round(t.hero.x), round(t.hero.y)], [at.x, at.y])
    }
    assert.deepEqual(load(save, null, false).entry, Z.WORLD.start, 'a new visit starts on the plaza')
    assert.deepEqual(load(save, back, false).entry, back, 'or in front of the exit last used')
    // A continue point that has gone is rescued on the way in, a save back on the coast ignores the flag.
    assert.deepEqual(load({ ...save, entry: 'gate-gone' }, null, true).entry, { map: 'fr:7,2', entry: 'camp' })
    assert.deepEqual(load({ ...save, map: 'overworld', entry: 'lake' }, null, true).entry, Z.WORLD.start)
    assert.deepEqual(load(null, null, true).entry, Z.WORLD.start)
  })

  it('continues an old save whose spot has gone at the nearest camp, never as a new game', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'fr:7,2', entry: 'camp' } })
    s.inv.sword = true
    s.flags['chest:fr:7,2.c0'] = true
    const base = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
    for (const [map, entry, want] of [
      ['fr:7,2', 'gate-gone', ['fr:7,2', 'camp']],
      ['fr:7,2:cave9', 'in', ['fr:7,2', 'camp']],
      ['fr:99,99', 'camp', ['overworld', 'ferry']],
      ['nowhere', 'door', [Z.WORLD.start.map, Z.WORLD.start.entry]],
    ]) {
      const t = Z.createGame(Z.WORLD, { save: { ...base, map, entry } })
      assert.deepEqual([t.entry.map, t.entry.entry], want, `${map}:${entry}`)
      assert.equal(t.inv.sword, true, 'the items are kept')
      assert.ok(t.flags['chest:fr:7,2.c0'], 'and the flags')
    }
  })

  it('points a hero with a blade at the gates and the ferry until the frontier is walked into, in what the box holds', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'start' } })
    assert.ok(!Z.objective(s).includes(Z.FRONTIER_HINT), 'not before the blade')
    s.inv.sword = true
    assert.ok(Z.objective(s).includes(Z.FRONTIER_HINT), 'the gates once the blade is in hand')
    s.flags['seen:fr:7,2'] = true
    assert.ok(!Z.objective(s).includes(Z.FRONTIER_HINT), 'and not once the frontier is found')
    assert.ok(Z.questHint(Z.QUEST_STEPS).includes('FERRY'), 'the end points out there too')
    // The pause box: four lines of about 37 letters.
    const lines = t => t.split(' ').reduce((acc, w) => { const l = acc[acc.length - 1]; if (l !== undefined && (l + ' ' + w).length <= 37) acc[acc.length - 1] = l + ' ' + w; else acc.push(w); return acc }, [])
    for (const t of [Z.questHint(Z.QUEST_STEPS), Z.questHint(1) + ' ' + Z.FRONTIER_HINT]) assert.ok(lines(t).length <= 4, `too long for the box: ${t}`)
  })

  it('spells every generated map one way only', () => {
    assert.ok(Z.WORLD.generate('fr:6,8'))
    assert.equal(Z.WORLD.generate('fr:06,8'), null)
    assert.equal(Z.WORLD.generate('fr:6,08'), null)
    const cave = Object.keys(Z.WORLD.generate('fr:8,2').entries).find(k => /^cave\d+$/.test(k))
    assert.ok(Z.WORLD.generate(`fr:8,2:${cave}`))
    assert.equal(Z.WORLD.generate(`fr:8,2:cave0${cave.slice(4)}`), null)
    assert.equal(Z.WORLD.generate('fr:0,3:deep01'), null)
  })
})
