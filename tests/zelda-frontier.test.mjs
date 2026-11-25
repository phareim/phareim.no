// The frontier (themes/zelda/world/gen/): every region is made, the same every
// time; neighbours cut their passes at the same places; everything placed can
// be walked to; the world's checks pass on the generated maps; and the hero
// can take the ferry over and walk from one region into the next.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { load } from './zelda-load.mjs'

let Z
before(async () => { Z = await load() })

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
    assert.equal(t.map.id, 'fr:4,6')
    assert.equal(t.mode, 'play')
    // A save made over there continues over there.
    const save = Z.toSave(t)
    assert.equal(save.map, 'fr:4,6')
    const u = Z.createGame(Z.WORLD, { save: Z.parseSave(JSON.parse(JSON.stringify(save))) })
    assert.equal(u.map.id, 'fr:4,6')
  })

  it('walks off the edge through a pass into the next region', () => {
    const L = Z.WORLD.generate('fr:4,6')
    const W = L.rows[0].length
    const x = [...Array(W).keys()].find(x => WALK.has(tileOf(L, x, 0)) && WALK.has(tileOf(L, x + 1, 0)) && WALK.has(tileOf(L, x + 2, 0)))
    assert.ok(x !== undefined, 'a pass north')
    const s = Z.createGame(Z.WORLD, { seed: 4, at: { map: 'fr:4,6', entry: 'camp' } })
    s.hero.x = x + 1.5
    s.hero.y = 1.5
    for (let i = 0; i < 200 && s.map.id === 'fr:4,6'; i++) step(s, inp({ move: { x: 0, y: -1 } }))
    for (let i = 0; i < 60; i++) step(s)
    assert.equal(s.map.id, L.edges.n)
    assert.ok(Math.abs(s.hero.x - (x + 1.5)) < 0.01, 'same place along the edge')
    assert.ok(s.hero.y > L.rows.length - 2, 'at the far edge of the next region')
    assert.equal(s.mode, 'play')
  })
})
