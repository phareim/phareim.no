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
    stdin: {
      contents: `export { SITES, SITE_REALMS, DEEP_FOLK } from './quests'; export { REALMS } from './realms'; export { DEMOS } from './demos';
        export { wrapText } from '../../../base/pixel/font'; export { subst, TOUCH_KEYS } from '../../keys'; export { speakerOf } from '../../render/hud';
        export { itemText } from '../../engine/combat'; export { QUARRY } from '../quarry'; export { ARENA } from '../arena'; export { PUZZLELAB } from '../puzzlelab'`,
      resolveDir: join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda', 'world', 'gen'), loader: 'ts',
    },
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

/** Walk up to `id` in region `map` (from its camp) and press A. */
function talkTo(s, map, id) {
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
    // Off the boat, the realm introduces itself (once).
    assert.equal(t.mode, 'dialog')
    assert.ok(t.flags['realm:landing'])
    P.settle(t)
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
    // The realm's intro on arrival (tests/zelda-gates.test.mjs follows the continue point and the intro further).
    assert.equal(s.mode, 'dialog')
    P.settle(s)
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

  const talkOf = e => (e.t === 'npc' ? e.talk.flatMap(b => b.lines) : e.t === 'sign' ? e.lines : [])
  /** Every generated map of the frontier: regions, their caves, the layers of the deep. */
  const generated = () => {
    const out = []
    for (const id of ids()) {
      out.push(Z.WORLD.generate(id))
      for (let n = 0; ; n++) { const c = Z.WORLD.generate(`${id}:cave${n}`); if (!c) break; out.push(c) }
      for (let n = 1; n <= 6; n++) { const d = Z.WORLD.generate(`${id}:deep${n}`); if (d) out.push(d) }
    }
    return out
  }

  it('speaks in the pixel font, a page at most three rows of the narrowest box, with the touch deck’s key names', () => {
    const lines = []
    for (const r of Object.values(GEN.REALMS)) {
      lines.push(r.name, ...r.lore, ...(r.intro ?? []), ...r.folk.flatMap(f => f.says.flat()), ...Object.values(r.signs ?? {}).flat(2))
      if (r.cave) lines.push(r.cave.name)
    }
    for (const site of GEN.SITES) for (const mk of Object.values(site.marks ?? {})) lines.push(...talkOf(mk.ent))
    for (const folk of Object.values(GEN.DEEP_FOLK)) for (const e of folk) lines.push(...talkOf(e))
    for (const d of GEN.DEMOS) lines.push(d.name, ...d.lines)
    for (const m of [GEN.QUARRY, GEN.ARENA, GEN.PUZZLELAB]) {
      lines.push(m.name, ...Object.values(m.cells ?? {}).map(c => c.name).filter(Boolean))
      for (const mk of Object.values(m.marks)) lines.push(...talkOf(mk.ent))
    }
    // What the generator puts together: map and room names, first-visit words, signs (a camp's roads out), the deep.
    for (const d of generated()) {
      lines.push(d.name, ...Object.values(d.cells ?? {}).map(c => c.name).filter(Boolean), ...(d.areas ?? []).flatMap(a => a.intro?.lines ?? []))
      for (const mk of Object.values(d.marks)) lines.push(...talkOf(mk.ent))
    }
    // The frontier's own pickups: the dig tools and the tonics.
    for (const item of ['pickaxe', 'shovel', 'axe', 'hammer', 'tonic3']) lines.push(...GEN.itemText({ inv: { pieces: 1, shrooms: 0 } }, item))
    // The narrowest view is 13 tiles across: a box of 180 px inside, 6 px a letter.
    for (const l of new Set(lines)) {
      const shown = GEN.subst(l, GEN.TOUCH_KEYS)
      assert.match(shown, /^[A-Z0-9ÆØÅ .,!?'":;\-()/#%&+=*·\n]*$/, `not in the font: ${l}`)
      assert.ok(GEN.wrapText(shown, 180).length <= 3, `more than three rows: ${l}`)
    }
  })

  it('names who speaks: everyone of the frontier opens with a name the plate takes, and no stranger takes a hand-made character’s', () => {
    const people = []
    for (const site of GEN.SITES) for (const mk of Object.values(site.marks ?? {})) if (mk.ent.t === 'npc') people.push(mk.ent)
    for (const folk of Object.values(GEN.DEEP_FOLK)) people.push(...folk)
    for (const r of Object.values(GEN.REALMS)) for (const f of r.folk) for (const says of f.says) people.push({ id: `${r.id}:${f.look}`, look: f.look, talk: [{ lines: says }] })
    // The hand-made game's own: their look's name upper-cased would be the plate.
    const OWN = new Set(['KEEPER', 'MOSSA', 'MAX', 'TOBY', 'OWL', 'DUSTY', 'TROLL', 'LUNA', 'PETTER', 'BARTENDER'])
    for (const p of people) {
      for (const b of p.talk) {
        const first = b.lines[0]
        // Animals and the silent are told in brackets; anyone who talks says who they are first.
        if (/^\(|^(MEOW|MRRP|MAA)\b/.test(first)) continue
        const named = GEN.speakerOf(first, p.look)
        assert.ok(named, `${p.id} opens without a name: ${first}`)
        assert.ok(!OWN.has(named.name), `${p.id} speaks as ${named.name}`)
        for (const l of b.lines.slice(1)) if (!l.startsWith('(')) assert.ok(GEN.speakerOf(l, p.look, first)?.name === named.name, `${p.id} changes voice: ${l}`)
      }
    }
  })

  it('points each camp’s sign down the roads that really lead out to other realms', () => {
    const name = (rx, ry) => GEN.REALMS[Z.WORLD.generate(`fr:${rx},${ry}`)?.realm]?.name
    let checked = 0
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      const [rx, ry] = id.slice(3).split(',').map(Number)
      const want = new Set()
      for (const [side, dx, dy] of [['NORTH', 0, -1], ['EAST', 1, 0], ['SOUTH', 0, 1], ['WEST', -1, 0]]) {
        const there = d.edges[{ NORTH: 'n', EAST: 'e', SOUTH: 's', WEST: 'w' }[side]] && name(rx + dx, ry + dy)
        if (there && there !== name(rx, ry)) want.add(`${side}:${there}`)
      }
      const roads = new Set()
      for (const mk of Object.values(d.marks)) {
        if (mk.ent.t !== 'sign') continue
        for (const row of mk.ent.lines.join('\n').split('\n')) {
          const m = /^((?:NORTH|EAST|SOUTH|WEST)(?:(?:, | AND )(?:NORTH|EAST|SOUTH|WEST))*): ([A-Z ]+)$/.exec(row)
          if (m) for (const side of m[1].split(/, | AND /)) roads.add(`${side}:${m[2]}`)
        }
      }
      // The Landing has a dock, no camp; the crossroads camp's own sign gives the far bearings too.
      if (id === LANDING || id === 'fr:6,7') continue
      assert.deepEqual([...roads].sort(), [...want].sort(), `${id}'s roads`)
      checked += want.size
    }
    assert.ok(checked > 20)
  })

  it('talks the clean seed through, from the crossroads to the desert and back', () => {
    const s = Z.createGame(Z.WORLD, { seed: 5, at: { map: LANDING, entry: 'camp' } })
    s.inv.sword = true
    const talk = (map, id) => talkTo(s, map, id)
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

  it('pays Gunn’s chrome for the bell in something a hero without a bomb bag can keep', () => {
    const s = Z.createGame(Z.WORLD, { seed: 5, at: { map: LANDING, entry: 'camp' } })
    s.inv.sword = true
    s.flags['q.bell.ore'] = true
    const before = s.inv.bits + s.inv.bombs
    talkTo(s, 'fr:2,3', 'q.gunn')
    assert.ok(s.flags['q.bell.chrome'], 'the chrome is given')
    assert.equal(s.inv.bombBag, false)
    assert.ok(s.inv.bits + s.inv.bombs > before, 'and the reward is not lost')
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

  it('sets one heart piece down in every realm but the Landing’s', () => {
    const hearts = {}
    const realms = new Set()
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      realms.add(d.realm)
      for (const m of Object.values(d.marks)) if (m.ent.t === 'chest' && m.ent.item === 'heartPiece' && m.ent.id.endsWith('.heart')) (hearts[d.realm] ??= []).push(m.ent.id)
    }
    // (The Underglow, under the map, keeps its pieces on its layers.)
    assert.equal(realms.size, Object.keys(GEN.REALMS).length - 1)
    for (const r of realms) {
      if (r === 'landing') { assert.equal(hearts[r], undefined); continue }
      assert.equal(hearts[r]?.length, 1, `${r}: ${hearts[r] ?? 'no heart piece'}`)
    }
  })

  it('keeps every heart the world holds through a save and a reload', () => {
    // Every map, the generated ones with their caves and the Underglow's layers; talk gives and prizes count too.
    const maps = { ...Z.WORLD.maps }
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      maps[id] = d
      for (const k of Object.keys(d.entries)) {
        const m = /^cave(\d+)$/.exec(k)
        if (m) maps[`${id}:cave${m[1]}`] = Z.WORLD.generate(`${id}:cave${m[1]}`)
        if (k === 'deep') for (let n = 1; n <= 6; n++) maps[`${id}:deep${n}`] = Z.WORLD.generate(`${id}:deep${n}`)
      }
    }
    const json = JSON.stringify(maps)
    const pieces = json.match(/"heartPiece"/g).length
    const containers = json.match(/"heartContainer"/g).length
    const most = Z.START_HP + 2 * containers + 2 * Math.floor(pieces / 4)
    assert.ok(most <= Z.MAX_HP, `${pieces} pieces and ${containers} containers make ${most} half-hearts, the save keeps ${Z.MAX_HP}`)
    const s = Z.createGame(Z.WORLD, { seed: 2, at: { map: LANDING, entry: 'camp' } })
    s.hero.maxHp = most
    assert.equal(Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s)))).maxHp, most)
  })

  it('keeps every battle group out of sight of the entries the hero arrives at', () => {
    // A group sees `sight` tiles; its foes stand up to ~1.2 off its spot and mill ~0.9 further.
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      if (!d.battle) continue
      for (const g of d.battle.groups) for (const [k, e] of Object.entries(d.entries)) {
        const dist = Math.hypot(g.x - e.x, g.y - e.y)
        assert.ok(dist > (g.sight ?? 0) + 3, `${g.id} stands ${dist.toFixed(1)} from ${id}:${k}`)
      }
    }
    // Up the stairs from the Battle Glade, out of a Sporelight cave: no fight before the hero moves.
    for (const [map, entry] of [['fr:7,2', 'from-arena'], ['fr:8,2', 'cave0']]) {
      const s = Z.createGame(Z.WORLD, { seed: 3, at: { map, entry } })
      s.inv.sword = true
      for (let k = 0; k < 180 && s.mode === 'play'; k++) step(s)
      assert.equal(s.mode, 'play', `${map}:${entry} starts a fight`)
    }
  })

  it('leads down into the three first maps and back up', () => {
    for (const [map, region] of [['quarry', 'fr:2,2'], ['arena', 'fr:7,2'], ['puzzlelab', 'fr:9,4']]) {
      const r = Z.WORLD.generate(region)
      assert.ok(Object.values(r.marks).some(m => m.ent.t === 'warp' && m.ent.to === map), `${region} → ${map}`)
      assert.ok(r.entries[`from-${map}`], `${region} has from-${map}`)
      assert.ok(Object.values(Z.WORLD.maps[map].marks).some(m => m.ent.t === 'warp' && m.ent.to === region), `${map} → ${region}`)
    }
  })

  it('stands the isometric scenery in the hero\'s way, and never in the way of anything placed', () => {
    // The props with a body: solid where they stand (unless kept open beside an entry, a warp or a road's run).
    const BODIES = /^(quarry_(cart_empty|cart_full|crate|headframe)|seter_churns|sporelight_mushroom_(medium|large)_|fogstage_(sandbags|spotlight)|rerun_(station_wagon|mailbox|flamingo|lawnmower|sprinkler)|stillsand_island_)/
    const found = new Map()
    let solidTiles = 0
    for (const id of ids()) {
      const d = Z.WORLD.generate(id)
      const info = Z.mapInfo(Z.WORLD, id)
      const { w, h, base } = info
      const blocked = (i, scenery) => Z.TILE_INFO[base[i]].solid || (scenery && info.scenery.has(i))
      const m = Z.createGame(Z.WORLD, { seed: 1, at: { map: id, entry: 'camp' } }).map
      /** On a dig map, rock standing above the ground. */
      const raised = i => !!m.dig && Z.heightAt(m, i % w, Math.floor(i / w)) > m.dig.g
      for (const i of info.scenery) assert.ok(!Z.TILE_INFO[base[i]].solid, `${id}: ${i % w},${Math.floor(i / w)} was solid already`)
      solidTiles += info.scenery.size
      // Whatever the hero could reach from the camp without the scenery, they still reach with it: walked tile to
      // tile with the engine's own collision (`solidTile`) and, on a dig map, its heights (`digAbove`).
      /** The tiles reached from the camp, with these tiles of scenery standing. */
      const reach = scenery => {
        const on = { ...m, scenery }
        const seen = new Uint8Array(w * h)
        const c = info.entries.camp
        const q = [Math.floor(c.y) * w + Math.floor(c.x)]
        seen[q[0]] = 1
        while (q.length) {
          const i = q.pop()
          const x = i % w, y = (i - x) / w
          const z = Z.heightAt(m, x, y)
          for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const j = ny * w + nx
            if (seen[j] || Z.solidTile(Z.WORLD, on, nx, ny) || (m.dig && Z.digAbove(m, nx, ny, z))) continue
            seen[j] = 1
            q.push(j)
          }
        }
        return seen
      }
      const before = reach(new Set())
      const after = reach(info.scenery)
      for (const lm of d.isoLandmarks ?? []) {
        if (!BODIES.test(lm.art)) continue
        assert.ok(lm.solid, `${id}: ${lm.art} has no footprint`)
        const name = lm.art.replace(/_\d$/, '')
        const f = found.get(name) ?? { n: 0, solid: 0 }
        f.n++
        const tiles = []
        for (let y = lm.solid.y; y < lm.solid.y + lm.solid.h; y++) for (let x = lm.solid.x; x < lm.solid.x + lm.solid.w; x++) tiles.push(y * w + x)
        // The footprint lies under the picture: the anchor within a tile of it.
        assert.ok(lm.x >= lm.solid.x - 0.5 && lm.x <= lm.solid.x + lm.solid.w + 0.5 && lm.y >= lm.solid.y && lm.y <= lm.solid.y + lm.solid.h + 1, `${id}: ${lm.art} footprint`)
        // Open where it must be: the stairs, anyone placed, the ground a battle group's foes stand on, and a tile
        // that would shut off ground the camp reaches (a path's dead end).
        const seals = i => {
          const more = reach(new Set([...info.scenery, i]))
          return before.some((v, j) => v && !more[j] && j !== i && !info.scenery.has(j))
        }
        const open = i => base[i] === '>' || info.marks.some(m => m.y * w + m.x === i)
          || (d.battle?.groups ?? []).some(g => Math.abs(g.x - (i % w + 0.5)) < 2.5 && Math.abs(g.y - (Math.floor(i / w) + 0.5)) < 2.5)
          || seals(i)
        if (tiles.every(i => blocked(i, true) || raised(i) || open(i))) f.solid++
        if (tiles.some(i => info.scenery.has(i))) f.scenery = (f.scenery ?? 0) + 1
        found.set(name, f)
      }
      // No open ground is cut off: only the scenery's own tiles are lost.
      for (let i = 0; i < w * h; i++) if (before[i] && !after[i]) assert.ok(info.scenery.has(i), `${id}: ${i % w},${Math.floor(i / w)} is shut off by scenery`)
      /** A spot is reached when its tile is, or (a chest, a sign, a solid exit) a tile beside it. */
      const reached = (seen, x, y) => [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => seen[(y + dy) * w + x + dx])
      const spots = [
        ...Object.entries(info.entries).map(([k, e]) => [`entry ${k}`, Math.floor(e.x), Math.floor(e.y)]),
        ...info.marks.map(m => [`${m.ent.t} ${m.ent.id ?? ''}`, m.x, m.y]),
        ...info.warps.map(wp => [`warp to ${wp.to}`, wp.x, wp.y]),
        ...(d.battle?.groups ?? []).map(g => [`group ${g.id}`, Math.floor(g.x), Math.floor(g.y)]),
      ]
      for (const [what, x, y] of spots) if (reached(before, x, y)) assert.ok(reached(after, x, y), `${id}: ${what} at ${x},${y} is shut off by scenery`)
      // And every pass off the map's edges.
      for (let x = 0; x < w; x++) for (const y of [0, h - 1]) if (before[y * w + x]) assert.ok(after[y * w + x], `${id}: the pass at ${x},${y}`)
      for (let y = 0; y < h; y++) for (const x of [0, w - 1]) if (before[y * w + x]) assert.ok(after[y * w + x], `${id}: the pass at ${x},${y}`)
    }
    assert.ok(solidTiles > 100, `${solidTiles} tiles of scenery`)
    for (const name of ['quarry_cart_full', 'quarry_crate', 'seter_churns', 'sporelight_mushroom_large_violet', 'fogstage_sandbags', 'rerun_station_wagon', 'rerun_mailbox', 'rerun_flamingo', 'rerun_lawnmower', 'rerun_sprinkler', 'quarry_headframe', 'stillsand_island_large']) {
      const f = found.get(name)
      assert.ok(f && f.n > 0, `${name} is placed somewhere`)
      assert.equal(f.solid, f.n, `${name}: solid in ${f.solid} of ${f.n} places`)
      // On open ground made solid for them (the headframe's legs too, though the drift's rock stands there now).
      assert.ok((f.scenery ?? 0) >= f.n * 0.75, `${name}: on scenery tiles in ${f.scenery} of ${f.n} places`)
    }
    // A solid thing stops the hero: they walk up to the mailbox and no further.
    const id = ids().find(i => Z.mapInfo(Z.WORLD, i).scenery.size)
    const info = Z.mapInfo(Z.WORLD, id)
    const s = Z.createGame(Z.WORLD, { seed: 4, at: { map: id, entry: 'camp' } })
    const i = [...info.scenery][0]
    assert.equal(Z.solidTile(Z.WORLD, s.map, i % info.w, Math.floor(i / info.w)), true)
    assert.equal(Z.solidTile(Z.WORLD, s.map, i % info.w, Math.floor(i / info.w), 'fly'), false)
  })

  it('makes the neighbouring regions in idle time, one at a time, never while the game is busy or in a short slice', async () => {
    const esbuild = createRequire(import.meta.url)('esbuild')
    const out = esbuild.buildSync({
      stdin: { contents: `export { neighbourPrefetch, ROOM_MS } from './prefetch'; export { WORLD } from './world/index'`, resolveDir: join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda'), loader: 'ts' },
      bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
    })
    const P = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
    const made = []
    const world = { ...P.WORLD, generate: id => { made.push(id); return P.WORLD.generate(id) } }
    const slices = []
    const g = globalThis
    const had = g.requestIdleCallback
    g.requestIdleCallback = cb => slices.push(cb)
    try {
      let busy = true
      let calm = false
      const pre = P.neighbourPrefetch(world, { busy: () => busy, calm: () => calm })
      pre.near('fr:6,6')
      made.length = 0
      const roomy = P.ROOM_MS + 5
      const slice = (ms = roomy) => slices.shift()?.({ timeRemaining: () => ms, didTimeout: false })
      slice()
      assert.deepEqual(made, [], 'nothing while busy')
      calm = true
      slice()
      assert.deepEqual(made, [], 'nothing while busy, calm or not')
      busy = false
      calm = false
      // A frame's spare time while the game plays: never enough, however many such slices come.
      for (let k = 0; k < 200; k++) slice(12)
      assert.deepEqual(made, [], 'nothing in short slices')
      slice()
      assert.equal(made.length, 1, 'one region a long slice')
      calm = true
      slice(1)
      assert.equal(made.length, 2, 'a calm game (paused, a panel, a dialog) makes one in any slice')
      calm = false
      for (let k = 0; k < 10 && slices.length; k++) slice()
      const want = Object.values(P.WORLD.generate('fr:6,6').edges).sort()
      assert.deepEqual([...made].sort(), want)
      // Moving on drops what was queued for the old region; a region made once is not made again.
      pre.near('fr:6,5')
      made.length = 0
      for (let k = 0; k < 10 && slices.length; k++) slice()
      assert.ok(made.length > 0 && made.every(id => !want.includes(id)), made.join(' '))
      pre.stop()
      assert.equal(slices.length, 0)
    } finally {
      if (had) g.requestIdleCallback = had
      else delete g.requestIdleCallback
    }
  })

  it('keeps a completionist save well under the save API\'s limit', () => {
    // Every map there is: the authored ones, every region, its caves and the Underglow's layers.
    const maps = [...Object.keys(Z.WORLD.maps)]
    for (const id of ids()) {
      maps.push(id)
      const d = Z.WORLD.generate(id)
      for (const e of Object.keys(d.entries)) if (/^cave\d+$/.test(e)) maps.push(`${id}:${e}`)
      if (d.entries.deep) for (let n = 1; Z.WORLD.generate(`${id}:deep${n}`); n++) maps.push(`${id}:deep${n}`)
    }
    const s = Z.createGame(Z.WORLD, { seed: 9 })
    // Every flag a map can set: chests, caches, gifts, levers, quests, intros, foes killed for good, regions seen.
    const flags = new Set()
    const walk = (v, key) => {
      if (typeof v === 'string') { if (['flag', 'set', 'once'].includes(key)) flags.add(v); return }
      if (Array.isArray(v)) { for (const x of v) walk(x, key === 'set' ? 'set' : undefined); return }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'rows') walk(x, k)
    }
    for (const id of maps) {
      const d = Z.WORLD.maps[id] ?? Z.WORLD.generate(id)
      assert.ok(d, id)
      walk(d)
      const info = Z.mapInfo(Z.WORLD, id)
      for (const c of info.chestList) flags.add(`chest:${c.id}`)
      // (A gift is kept as `got:<npc>:<item>`, engine/hero.ts.)
      for (const m of Object.values(d.marks)) if (m.ent.t === 'npc') JSON.stringify(m.ent, (k, v) => { if (k === 'give' && typeof v === 'string') flags.add(`got:${m.ent.id}:${v}`); return v })
      for (const c of d.dig?.caches ?? []) flags.add(`took:${c.id}`)
      if (d.edges) flags.add(`seen:${id}`)
      // Every square of every map charted.
      if (Z.charted(d)) Z.reveal(s, id, info.w, info.h, { x: 0, y: 0, w: info.w, h: info.h })
    }
    for (const f of flags) s.flags[f] = true
    Object.assign(s.inv, { bits: 999, bombs: 99, arrows: 99 })
    s.hero.maxHp = 20
    /** `total` edits spread over `maps` maps, on the longest ids and indices a 64×44 region has. */
    const dig = (maps, total) => {
      const out = {}
      for (let k = 0; k < maps; k++) {
        const ed = (out[`fr:${10 + (k % 6)},${10 + Math.floor(k / 6)}`] = {})
        for (let i = 0; i < Math.floor(total / maps) + (k < total % maps ? 1 : 0); i++) ed[2815 - i] = 'а4'
      }
      return out
    }
    const limit = 16_384 // themes/leaderboard/games.ts: SAVE_GAMES zelda.maxBytes
    /** The save's size as the API counts it (the JSON string's length), and in UTF-8 (a dig edit's letter is two bytes). */
    const sizeWith = edits => {
      s.digEdits = edits
      const json = JSON.stringify(Z.toSave(s))
      return { chars: json.length, bytes: Buffer.byteLength(json) }
    }
    assert.ok(flags.size > 300, `${flags.size} flags`)
    assert.ok(Object.keys(Z.toSave(s).explored).length > 100, 'charted maps')
    // A player who has done everything and dug a good deal (a quarter of what the land holds, on six maps).
    const done = sizeWith(dig(6, Z.DIG_TOTAL / 4))
    assert.ok(done.bytes < limit * 0.75, `a completionist save is ${done.bytes} bytes of ${limit}`)
    // And the land dug to its last edit (DIG_TOTAL on DIG_MAPS maps): still taken, though with little to spare.
    const full = sizeWith(dig(Z.DIG_MAPS, Z.DIG_TOTAL))
    assert.ok(full.chars < limit && full.bytes < limit, `with every dig edit: ${full.chars} chars, ${full.bytes} bytes of ${limit}`)
  })
})
