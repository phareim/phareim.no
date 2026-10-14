// The tree on the beach (themes/zelda/render/tree.ts, server/utils/treeVisits.ts,
// its mark on the coast road): deploys set the crown's stage, visitors set the
// fruit (one per visitor, up to what the crown holds, never on the edge),
// the Oslo day is what the counts use, only the live host and a real visitor
// id write a visit, and the tree stands where it blocks no walk.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { load } from './portal-load.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const esbuild = createRequire(import.meta.url)('esbuild')

async function bundle(entry) {
  const out = esbuild.buildSync({
    entryPoints: [join(here, '..', entry)], bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let T
let V
let PAL
let P
let W
before(async () => {
  T = await bundle('themes/zelda/render/tree.ts')
  V = await bundle('server/utils/treeVisits.ts')
  PAL = (await bundle('themes/base/pixel/palette.ts')).PAL
  P = await load()
  W = P.WORLD
})

const LEAVES = new Set(['L', 'l'])
const filled = rows => rows.join('').replace(/\./g, '').length

describe('stage from deploys', () => {
  it('goes bare, then fuller at each step, and draws a small tree when Sleeper cannot say', () => {
    assert.equal(T.stageFor(null), 1)
    assert.equal(T.stageFor(0), 0)
    assert.equal(T.stageFor(1), 1)
    assert.equal(T.stageFor(2), 1)
    assert.equal(T.stageFor(3), 2)
    assert.equal(T.stageFor(5), 2)
    assert.equal(T.stageFor(6), 3)
    assert.equal(T.stageFor(9), 3)
    assert.equal(T.stageFor(10), 4)
    assert.equal(T.stageFor(500), 4)
  })
})

describe('sprites', () => {
  it('are 16 by 32 and use only palette letters', () => {
    for (let s = 0; s < T.TREE_STAGES; s++) {
      const rows = T.treeRows(s)
      assert.equal(rows.length, 32, `stage ${s} height`)
      for (const r of rows) assert.equal(r.length, 16, `stage ${s} width`)
      for (const ch of rows.join('')) assert.ok(ch === '.' || PAL[ch], `stage ${s}: no colour for "${ch}"`)
    }
  })

  it('grow with the stage, and the bare one has no crown', () => {
    const sizes = [0, 1, 2, 3, 4].map(s => filled(T.treeRows(s)))
    for (let s = 1; s < sizes.length; s++) assert.ok(sizes[s] > sizes[s - 1], `stage ${s} is not bigger than ${s - 1}`)
    const bare = T.treeRows(0).join('')
    assert.ok(!bare.includes('l'), 'the bare tree has a lit crown')
    assert.ok(!bare.includes('T'), 'the bare tree has a crown edge')
  })

  it('are all registered for the renderer as tree_0 … tree_4', () => {
    assert.deepEqual(Object.keys(T.TREE_RAW).sort(), ['tree_0', 'tree_1', 'tree_2', 'tree_3', 'tree_4'])
  })
})

describe('fruit', () => {
  it('is one per visitor, capped, on leaves only, and never touching', () => {
    for (let s = 0; s < T.TREE_STAGES; s++) {
      const rows = T.treeRows(s)
      const spots = T.fruitSpots(s, 40)
      assert.ok(spots.length <= T.FRUIT_MAX, `stage ${s}: ${spots.length} fruit`)
      for (const [x, y] of spots) assert.ok(LEAVES.has(rows[y][x]), `stage ${s}: fruit at (${x},${y}) is not on a leaf`)
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < spots.length; j++) {
          const d = Math.max(Math.abs(spots[i][0] - spots[j][0]), Math.abs(spots[i][1] - spots[j][1]))
          assert.ok(d >= 3, `stage ${s}: fruit ${i} and ${j} touch`)
        }
      }
    }
  })

  it('comes to the count, no more, and is the same every time', () => {
    assert.deepEqual(T.fruitSpots(4, 0), [])
    assert.equal(T.fruitSpots(4, 5).length, 5)
    assert.deepEqual(T.fruitSpots(4, 5), T.fruitSpots(4, 5))
    assert.deepEqual(T.fruitSpots(0, 9), [], 'the bare tree has nothing to hang fruit on')
  })

  it('reads the counts the portal set, and treats unknown visitors as none', () => {
    T.setTreeCounts({ deploys: 12, visitors: 4 })
    const full = T.treeNow()
    assert.equal(full.stage, 4)
    assert.equal(full.fruit.length, 4)
    T.setTreeCounts({ deploys: 12, visitors: null })
    assert.equal(T.treeNow().fruit.length, 0)
    T.setTreeCounts({ deploys: null, visitors: null })
    assert.equal(T.treeNow().stage, 1)
    T.setTreeCounts({ deploys: 0, visitors: 3 })
    assert.equal(T.treeNow().fruit.length, 0, 'a bare tree shows no fruit, whoever came')
  })
})

describe('the day and the visitors', () => {
  it('counts by the Oslo day, which is ahead of UTC in autumn', () => {
    assert.equal(V.osloDay(new Date('2026-10-13T21:30:00Z')), '2026-10-13')
    assert.equal(V.osloDay(new Date('2026-10-13T22:30:00Z')), '2026-10-14')
  })

  it('takes only random v4 ids, and only from the live host', () => {
    assert.ok(V.VISITOR_ID.test('3f1c2a9e-8b7d-4e6f-9a0b-1c2d3e4f5a6b'))
    assert.ok(!V.VISITOR_ID.test(''))
    assert.ok(!V.VISITOR_ID.test('not-a-visitor'))
    assert.ok(!V.VISITOR_ID.test('3f1c2a9e-8b7d-1e6f-9a0b-1c2d3e4f5a6b'), 'v1 ids are refused')
    assert.ok(V.COUNTED_HOSTS.has('phareim.no') && V.COUNTED_HOSTS.has('www.phareim.no'))
    assert.ok(!V.COUNTED_HOSTS.has('beta.phareim.no'))
  })

  it('writes one row per visitor and day, and counts them', async () => {
    const rows = new Map()
    const db = {
      prepare(sql) {
        let args = []
        const stmt = {
          bind(...v) { args = v; return stmt },
          async run() {
            if (sql.startsWith('INSERT')) { const k = args.join('|'); rows.set(k, [args[0], args[1]]) }
            if (sql.startsWith('DELETE')) { for (const [k, [day]] of rows) if (day < args[0]) rows.delete(k) }
            return { meta: {} }
          },
          async first() {
            return { n: [...rows.values()].filter(([day]) => day === args[0]).length }
          },
        }
        return stmt
      },
    }
    await V.recordVisit(db, '2026-10-13', 'a')
    await V.recordVisit(db, '2026-10-13', 'a')
    await V.recordVisit(db, '2026-10-13', 'b')
    await V.recordVisit(db, '2026-10-10', 'c')
    assert.equal(await V.visitorsOn(db, '2026-10-13'), 2)
    assert.equal(await V.visitorsOn(db, '2026-10-17'), 0)
  })
})

describe('where the tree stands', () => {
  it('is an NPC on the coast road, above the sand, and blocks no walk', () => {
    const s = P.createGame(W, { seed: 1 })
    const m = s.map
    const tree = m.npcs.find(n => n.id === 'coast.tree')
    assert.ok(tree, 'no tree in the overworld')
    assert.equal(tree.look, 'tree')
    const x = Math.floor(tree.x)
    const y = Math.floor(tree.y)
    assert.equal(y, 25, 'the tree is on the row above the road')
    assert.equal(x, 24)
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1]]) {
      assert.ok(!P.solidTile(W, m, x + dx, y + dy, 'hero'), `the tile ${dx},${dy} from the tree is solid`)
    }
  })

  it('keeps the world valid', () => assert.deepEqual(P.validateWorld(W), []))
})
