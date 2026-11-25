// The frontier (themes/zelda/world/gen/): every region is made, the same every
// time; neighbours cut their passes at the same places; everything placed can
// be walked to; the world's checks pass on the generated maps; the hero can
// take the ferry over and walk from one region into the next; every realm is
// on the macro map, every quest site in its region, every line fits the font;
// and one questline (the clean seed) is talked through from start to end.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

const LANDING = 'fr:6,8'
let Z
let P
/** The generator's own data (sites, realms), bundled on its own. */
let GEN
before(async () => {
  Z = await load()
  P = walker(Z)
  const esbuild = createRequire(import.meta.url)('esbuild')
  const out = esbuild.buildSync({
    stdin: { contents: `export { SITES, SITE_REALMS, DEEP_FOLK } from './quests'; export { REALMS } from './realms'`, resolveDir: join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda', 'world', 'gen'), loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  GEN = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp(), dt = 1 / 60) => Z.stepGame(Z.WORLD, s, dt, i)
const ids = () => {
  const out = []
  for (let ry = 0; ry < 12; ry++) for (let rx = 0; rx < 12; rx++) if (Z.WORLD.generate(`fr:${rx},${ry}`)) out.push(`fr:${rx},${ry}`)
  return out
}
const WALK = new Set(['.', ',', ':', ';', '-', '=', '_', 'D', '>'])
const tileOf = (def, x, y) => {
  const ch = def.rows[y][x]
  const m = def.marks[ch]
  return m ? (m.tile ?? (m.ent.t === 'chest' ? '$' : m.ent.t === 'sign' ? 'S' : '.')) : ch
}

describe('the frontier', () => {
  it('makes every region of the macro map, the same each time', () => {
    const all = ids()
    assert.ok(all.length >= 30, `${all.length} regions`)
    assert.equal(Z.WORLD.generate('fr:99,99'), null)
    assert.equal(Z.WORLD.generate('fr:nope'), null)
    for (const id of all) {
      const d = Z.WORLD.generate(id)
      assert.equal(d.id, id)
      assert.equal(Z.WORLD.generate(id), d, 'kept once made')
      assert.ok(d.rows.every(r => r.length === d.rows[0].length), `${id} rows`)
      assert.ok(d.entries.camp, `${id} has a camp`)
    }
  })

  it('cuts the same passes from both sides of an edge', () => {
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      const W = d.rows[0].length
      const H = d.rows.length
      for (const [side, nid] of Object.entries(d.edges ?? {})) {
        const n = Z.WORLD.generate(nid)
        assert.ok(n, `${id} → ${nid}`)
        let open = 0
        if (side === 'e' || side === 'w') {
          const x = side === 'e' ? W - 1 : 0
          const nx = side === 'e' ? 0 : W - 1
          for (let y = 0; y < H; y++) {
            const a = WALK.has(tileOf(d, x, y))
            assert.equal(a, WALK.has(tileOf(n, nx, y)), `${id} ${side} row ${y}`)
            if (a) open++
          }
        } else {
          const y = side === 's' ? H - 1 : 0
          const ny = side === 's' ? 0 : H - 1
          for (let x = 0; x < W; x++) {
            const a = WALK.has(tileOf(d, x, y))
            assert.equal(a, WALK.has(tileOf(n, x, ny)), `${id} ${side} col ${x}`)
            if (a) open++
          }
        }
        assert.ok(open >= 3, `${id} ${side} has a pass`)
      }
    }
  })

  it('passes the world checks with every region and cave in it', () => {
    const maps = { ...Z.WORLD.maps }
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      maps[id] = d
      for (const k of Object.keys(d.entries)) {
        const m = /^cave(\d+)$/.exec(k)
        if (m) { const c = Z.WORLD.generate(`${id}:cave${m[1]}`); assert.ok(c, `${id} cave ${m[1]}`); maps[c.id] = c }
        // The Underglow's layers under the deep drift.
        if (k === 'deep') for (let n = 1; n <= 6; n++) { const c = Z.WORLD.generate(`${id}:deep${n}`); assert.ok(c, `${id} deep ${n}`); maps[c.id] = c }
      }
    }
    const problems = Z.validateWorld({ ...Z.WORLD, maps })
    assert.deepEqual(problems, [])
  })

  it('takes the ferry over and back once the hero has a blade', () => {
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'ferry' } })
    // No blade: the ferryman stands on the pier.
    assert.ok(s.map.npcs.some(n => n.id === 'ferryman'))
    s.inv.sword = true
    s.flags['item:sword'] = true
    const t = Z.createGame(Z.WORLD, { seed: 2, at: { map: 'overworld', entry: 'ferry' }, save: { ...Z.toSave(s), flags: Object.keys(s.flags) } })
    assert.ok(!t.map.npcs.some(n => n.id === 'ferryman'))
    for (let i = 0; i < 400 && t.map.id === 'overworld'; i++) step(t, inp({ move: { x: 0, y: 1 } }))
    for (let i = 0; i < 60; i++) step(t)
    assert.equal(t.map.id, LANDING)
    assert.equal(t.mode, 'play')
    // A save made over there continues over there.
    const save = Z.toSave(t)
    assert.equal(save.map, LANDING)
    const u = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(save))) })
    assert.equal(u.map.id, LANDING)
  })

  it('walks off the edge through a pass into the next region', () => {
    const L = Z.WORLD.generate(LANDING)
    const W = L.rows[0].length
    const x = [...Array(W).keys()].find(x => WALK.has(tileOf(L, x, 0)) && WALK.has(tileOf(L, x + 1, 0)) && WALK.has(tileOf(L, x + 2, 0)))
    assert.ok(x !== undefined, 'a pass north')
    const s = Z.createGame(Z.WORLD, { seed: 4, at: { map: LANDING, entry: 'camp' } })
    s.hero.x = x + 1.5
    s.hero.y = 1.5
    for (let i = 0; i < 200 && s.map.id === LANDING; i++) step(s, inp({ move: { x: 0, y: -1 } }))
    for (let i = 0; i < 60; i++) step(s)
    assert.equal(s.map.id, L.edges.n)
    assert.ok(Math.abs(s.hero.x - (x + 1.5)) < 0.01, 'same place along the edge')
    assert.ok(s.hero.y > L.rows.length - 2, 'at the far edge of the next region')
    assert.equal(s.mode, 'play')
  })

  it('has every realm on the macro map, the Underglow under the quarry', () => {
    const seen = new Set(ids().map(id => Z.WORLD.generate(id).realm))
    const want = Object.keys(GEN.REALMS).filter(r => r !== 'underglow')
    assert.deepEqual([...seen].sort(), want.sort())
    const drift = ids().find(id => Z.WORLD.generate(id).entries.deep)
    assert.ok(drift, 'a region with the deep drift')
    assert.equal(Z.WORLD.generate(drift).realm, 'lumenby')
    // Down six layers and back up; the bottom's Geyser goes home.
    for (let n = 1; n <= 6; n++) {
      const d = Z.WORLD.generate(`${drift}:deep${n}`)
      assert.equal(d.realm, 'underglow')
      const warps = Object.values(d.marks).filter(m => m.ent.t === 'warp').map(m => `${m.ent.to}:${m.ent.entry}`)
      assert.ok(warps.includes(n === 1 ? `${drift}:deep` : `${drift}:deep${n - 1}:down`), `layer ${n} leads up`)
      assert.ok(warps.includes(n < 6 ? `${drift}:deep${n + 1}:up` : `${drift}:deep`), `layer ${n} leads on`)
    }
    assert.equal(Z.WORLD.generate(`${drift}:deep7`), null)
  })

  it('sets every quest site down in its region, in the realm it was written for', () => {
    for (const site of GEN.SITES) {
      const d = Z.WORLD.generate(site.region)
      assert.ok(d, site.region)
      assert.equal(d.realm, GEN.SITE_REALMS[site.id], `${site.id} in ${site.region}`)
      const ents = Object.values(d.marks).map(m => m.ent)
      for (const mk of Object.values(site.marks ?? {})) {
        const e = mk.ent
        const placed = e.t === 'entry' ? !!d.entries[e.id] : ents.some(x => JSON.stringify(x) === JSON.stringify(e))
        assert.ok(placed, `${site.id}: its ${e.t} ${e.id ?? e.to ?? e.lines?.[0]} is placed`)
      }
    }
  })

  it('speaks in the pixel font: upper case, 30 letters a line at most', () => {
    const lines = []
    for (const r of Object.values(GEN.REALMS)) lines.push(...r.lore, ...r.folk.flatMap(f => f.says.flat()), r.name)
    const talk = e => (e.t === 'npc' ? e.talk.flatMap(b => b.lines) : e.t === 'sign' ? e.lines : [])
    for (const site of GEN.SITES) for (const mk of Object.values(site.marks ?? {})) lines.push(...talk(mk.ent))
    for (const folk of Object.values(GEN.DEEP_FOLK)) for (const e of folk) lines.push(...talk(e))
    for (const l of lines) {
      assert.ok(l.length <= 30, `too long: ${l}`)
      assert.match(l, /^[A-Z0-9 .,!?'":;\-()/#%&+=*]*$/, `not in the font: ${l}`)
    }
  })

  it('talks the clean seed through, from the crossroads to the desert and back', () => {
    const s = Z.createGame(Z.WORLD, { seed: 5, at: { map: LANDING, entry: 'camp' } })
    s.inv.sword = true
    const talk = (map, id) => {
      if (s.map.id !== map) Z.enterMap(Z.WORLD, s, map, 'camp', [])
      for (let i = 0; i < 30; i++) P.step(s)
      const n = s.map.npcs.find(x => x.id === id)
      assert.ok(n, `${id} in ${map}`)
      const nx = Math.floor(n.x)
      const ny = Math.floor(n.y)
      const spots = [[0, 1, 'up'], [0, -1, 'down'], [1, 0, 'left'], [-1, 0, 'right']]
      const spot = spots.find(([dx, dy]) => P.path(s, nx + dx, ny + dy))
      assert.ok(spot, `a way to ${id}`)
      P.walkTo(s, nx + spot[0], ny + spot[1])
      P.face(s, spot[2])
      P.pressA(s)
    }
    const F = 'q.seed.'
    talk('fr:10,3', 'q.seed.bed')
    assert.ok(!s.flags[F + 'planted'], 'no seed, nothing to plant')
    talk('fr:6,7', 'q.seed.tender')
    assert.ok(s.flags[F + 'heard'])
    talk('fr:8,2', 'q.seed.keeper')
    assert.ok(s.flags[F + 'well'])
    talk('fr:9,1', 'q.seed.spirit')
    assert.ok(s.flags[F + 'got'])
    talk('fr:10,3', 'q.seed.bed')
    assert.ok(s.flags[F + 'planted'])
    assert.ok(s.flags['got:q.seed.bed:heartPiece'], 'a heart piece for the planting')
    talk('fr:6,7', 'q.seed.tender')
    assert.ok(s.flags['got:q.seed.tender:bits50'], 'and the walk home')
  })

  it('switches each realm’s system on: dig in the dig realms, battles in the battle realms, puzzles in the puzzle realms', () => {
    const seen = { dig: 0, battle: 0, puzzles: 0 }
    for (let ry = 0; ry < 12; ry++) for (let rx = 0; rx < 14; rx++) {
      const d = Z.WORLD.generate(`fr:${rx},${ry}`)
      if (!d) continue
      const special = { lumenby: 'dig', seterfell: 'dig', sporelight: 'battle', fogstage: 'battle', rerun: 'battle', yulefjord: 'puzzles', stillsand: 'puzzles' }[d.realm]
      if (special === 'dig') { assert.ok(d.dig?.heights?.length === d.rows.length, `${d.id} dig`); seen.dig++ }
      else assert.equal(d.dig, undefined, `${d.id} has no dig`)
      if (special === 'battle') { assert.ok(d.battle?.groups.length, `${d.id} battle groups`); assert.ok(!Object.values(d.marks).some(m => m.ent.t === 'enemy'), `${d.id} has field foes`); seen.battle++ }
      else assert.equal(d.battle, undefined, `${d.id} has no battles`)
      if (special === 'puzzles') { assert.ok(Object.values(d.marks).some(m => m.ent.t === 'chest' && m.ent.appear), `${d.id} puzzle chest`); seen.puzzles++ }
    }
    assert.ok(seen.dig && seen.battle && seen.puzzles)
  })

  it('sets every puzzle site down solvable, on the floor its kit was made on (not the realm’s sand)', () => {
    let sites = 0
    const bad = []
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      const rows = d.rows.map(r => [...r])
      for (const [ch, mk] of Object.entries(d.marks)) {
        if (mk.ent.t !== 'chest' || !/\.pz\d\.prize$/.test(mk.ent.id)) continue
        const cy = rows.findIndex(r => r.includes(ch))
        const cx = rows[cy].indexOf(ch)
        // The chest stands two tiles beside the way in, in the row under the site's wall (`puzzleSite`).
        let found = null
        for (const k of Z.puzzleKits) for (const door of [cx - 2, cx + 2]) {
          const sx = door - (k.entry.x + 1)
          const sy = cy - (k.h + 2)
          if (found || sx < 0 || sy < 0 || sx + k.w + 2 > rows[0].length) continue
          const walled = rows[sy].slice(sx, sx + k.w + 2).every(t => t === '#') && rows.slice(sy, sy + k.h + 2).every(r => r[sx] === '#' && r[sx + k.w + 1] === '#')
          const crop = rows.slice(sy + 1, sy + 1 + k.h).map(r => r.slice(sx + 1, sx + 1 + k.w).join(''))
          // Its own tiles where the kit has plain ones (its plain floor may have come out as the realm's ground).
          const same = k.rows.every((kr, ky) => [...kr].every((t, kx) => {
            const got = [...crop[ky]][kx]
            return k.marks[t] ? d.marks[got]?.ent.t === k.marks[t].ent.t : got === t || (t === '.' && got === '-')
          }))
          if (walled && same) found = { k, crop }
        }
        assert.ok(found, `${mk.ent.id}: no kit fits around its chest`)
        sites++
        const r = Z.solveGrid({ rows: found.crop, marks: d.marks }, found.k.entry, mk.ent.appear, 200000)
        if (!r.ok) bad.push(`${mk.ent.id} (${found.k.id}) cannot be solved (${r.states} states)`)
        else if (r.moves.length < 2) bad.push(`${mk.ent.id} (${found.k.id}) is solved in ${r.moves.length} moves`)
        if (found.crop.join('').includes('-')) bad.push(`${mk.ent.id}: sand inside the puzzle`)
      }
    }
    assert.deepEqual(bad, [])
    assert.ok(sites >= 10, `${sites} puzzle sites`)
  })

  it('leads down into the three first maps and back up', () => {
    for (const [map, region] of [['quarry', 'fr:2,2'], ['arena', 'fr:7,2'], ['puzzlelab', 'fr:9,4']]) {
      const r = Z.WORLD.generate(region)
      assert.ok(Object.values(r.marks).some(m => m.ent.t === 'warp' && m.ent.to === map), `${region} → ${map}`)
      assert.ok(r.entries[`from-${map}`], `${region} has from-${map}`)
      assert.ok(Object.values(Z.WORLD.maps[map].marks).some(m => m.ent.t === 'warp' && m.ent.to === region), `${map} → ${region}`)
    }
  })
})
