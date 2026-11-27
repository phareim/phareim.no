// The top right corner (`themes/zelda/render/corner.ts`, painted by the shell's `stepCorner`): what its chart marks
// as the player earns it, the hero kept whole in it, and the data gates (the ways between lands, the names on its
// plate, the ink tables of the chart in `render/worldMap.ts`). Where it lies on a screen, off the hearts and big
// enough to tap, is the layout matrix (`zelda-layout.test.mjs`). No canvas: the painter's picture is colours
// (`renderCorner`).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')

let Z
before(async () => {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { WORLD } from './world/index'; export { createGame } from './engine/index'; export { enterMap } from './engine/game'; export { mapInfo } from './engine/map'; export { charted, reveal, seenTile } from './engine/explore'; export { TILE_INFO } from './world/tiles'; export { REALM_LOOKS } from './render/looks'; export * from './render/corner'; export { CHART_INKS, chartLook } from './render/worldMap'; export { textWidth } from '../base/pixel/font'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  Z = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

// ---- helpers ------------------------------------------------------------------------------------------------

function game(map, entry) {
  const s = Z.createGame(Z.WORLD, { seed: 7, at: { map: 'overworld', entry: 'start' } })
  s.explored = {}
  s.flags = {}
  s.exploreAt = undefined
  Z.enterMap(Z.WORLD, s, map, entry ?? Object.keys(Z.mapInfo(Z.WORLD, map).entries)[0], [])
  s.explored = {}
  s.dialog = null
  s.mode = 'play'
  return s
}
const seeAll = s => { const i = Z.mapInfo(Z.WORLD, s.map.id); Z.reveal(s, s.map.id, i.w, i.h, { x: 0, y: 0, w: i.w, h: i.h }) }
const seeTile = (s, x, y) => { const i = Z.mapInfo(Z.WORLD, s.map.id); Z.reveal(s, s.map.id, i.w, i.h, { x, y, w: 1, h: 1 }) }
const chartedMaps = () => Object.entries(Z.WORLD.maps).filter(([, d]) => Z.charted(d)).map(([id]) => id)

// ---- the marks ----------------------------------------------------------------------------------------------

describe('the corner\'s chart', () => {
  const find = (marks, kind, x, y) => marks.find(m => m.kind === kind && m.x === x && m.y === y)

  it('marks what the player has seen: chests, a heart piece, a pass, Lumenby\'s letters', () => {
    // Just arrived, no land marks anything but the hero (with their facing) and the sign's sockets.
    for (const id of chartedMaps()) {
      const s = game(id)
      s.hero.dir = 'left'
      const marks = Z.chartMarks(Z.WORLD, s)
      assert.deepEqual(marks[0], { kind: 'hero', x: Math.floor(s.hero.x), y: Math.floor(s.hero.y), state: 'left' })
      assert.deepEqual(marks.filter(m => m.kind !== 'hero' && m.kind !== 'pip'), [], id)
      assert.equal(marks.some(m => m.kind === 'pip'), id === 'lumenby', id)
    }
    // Squares seen here and there: only what lies in one of them.
    let some = 0
    for (const id of chartedMaps()) {
      const s = game(id)
      const info = Z.mapInfo(Z.WORLD, id)
      for (let y = 0; y < info.h; y += 16) for (let x = 0; x < info.w; x += 16) seeTile(s, x, y)
      for (const m of Z.chartMarks(Z.WORLD, s)) {
        if (m.kind === 'hero' || m.kind === 'pip') continue
        some++
        assert.ok(Z.seenTile(s, id, info.w, m.x, m.y), `${id}: ${m.kind} at ${m.x},${m.y}`)
      }
    }
    assert.ok(some > 10)
    // A chest is gold until opened; a heart piece lies until taken.
    const s = game('overworld', 'start')
    const info = Z.mapInfo(Z.WORLD, 'overworld')
    const chest = info.chestList.find(v => !v.appear)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', chest.x, chest.y), undefined)
    seeTile(s, chest.x, chest.y)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', chest.x, chest.y).state, 'closed')
    s.flags[`chest:${chest.id}`] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'chest', chest.x, chest.y).state, 'opened')
    const heart = info.marks.find(v => v.ent.t === 'item' && v.ent.item === 'heartPiece')
    seeTile(s, heart.x, heart.y)
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'heart', heart.x, heart.y).state, 'lying')
    s.flags[`took:${heart.ent.id}`] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, s), 'heart', heart.x, heart.y).state, 'taken')
    // A chest whose appearing is still to come is not marked.
    const shrine = game('shrine', 'start')
    const later = Z.mapInfo(Z.WORLD, 'shrine').chestList.find(v => v.appear)
    assert.ok(later)
    seeAll(shrine)
    assert.equal(find(Z.chartMarks(Z.WORLD, shrine), 'chest', later.x, later.y), undefined)
    shrine.flags[`appear:${later.id}`] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, shrine), 'chest', later.x, later.y).state, 'closed')
    // A pass's tab is hollow until the land beyond has been seen.
    const fell = game('seterfell', 'camp')
    const pass = Z.landPasses(Z.WORLD, 'seterfell').find(v => v.to === 'yulefjord')
    assert.equal(find(Z.chartMarks(Z.WORLD, fell), 'pass', pass.x, pass.y), undefined)
    seeTile(fell, pass.x, pass.y)
    fell.hero.x = 36.5
    fell.hero.y = 30.5
    const tab = Z.CHART_INKS.snow.tab
    assert.equal(find(Z.chartMarks(Z.WORLD, fell), 'pass', pass.x, pass.y).state, 'unseen')
    assert.ok(!Z.renderCorner(Z.WORLD, fell, { e: 0 }).px.includes(tab), 'hollow')
    fell.flags['seen:yulefjord'] = true
    assert.equal(find(Z.chartMarks(Z.WORLD, fell), 'pass', pass.x, pass.y).state, 'seen')
    for (const e of [0, 1]) assert.ok(Z.renderCorner(Z.WORLD, fell, { e }).px.includes(tab), `filled, e ${e}`)
    // The seven letters on Lumenby's rim light as the signs are set.
    const lum = game('lumenby', 'gate-quarry')
    const pips = () => Z.chartMarks(Z.WORLD, lum).filter(m => m.kind === 'pip')
    assert.deepEqual(pips().map(m => m.n), [1, 2, 3, 4, 5, 6, 7])
    const gold = e => Z.renderCorner(Z.WORLD, lum, { e }).px.filter(c => c === Z.CORNER_SKIN.prize).length
    const dark = [0, 1].map(gold)
    for (const n of [1, 3, 6]) lum.flags[`q.lumenby.sign${n}`] = true
    assert.deepEqual(pips().map(m => m.state), ['lit', 'dark', 'lit', 'dark', 'dark', 'lit', 'dark'])
    for (const e of [0, 1]) assert.ok(gold(e) > dark[e], `e ${e}`)
  })

  it('shows the hero whole in every corner of every land, in both shapes, and nothing else in pink', () => {
    const pink = (s, e) => Z.renderCorner(Z.WORLD, s, { e }).px.filter(c => c === Z.CORNER_SKIN.hot).length
    for (const id of chartedMaps()) {
      const s = game(id)
      seeAll(s)
      const info = Z.mapInfo(Z.WORLD, id)
      const open = []
      for (let y = 0; y < info.h; y++) for (let x = 0; x < info.w; x++) if (!Z.TILE_INFO[info.base[y * info.w + x]].solid) open.push([x, y])
      const far = score => open.reduce((a, b) => (score(b) > score(a) ? b : a))
      const spots = [far(([x, y]) => x + y), far(([x, y]) => -x - y), far(([x, y]) => x - y), far(([x, y]) => y - x), far(([x]) => x), far(([x]) => -x), far(([, y]) => y), far(([, y]) => -y)]
      // The corners of the map's own rectangle too: a pass can take the hero to the very rim.
      spots.push([0, 0], [info.w - 1, 0], [0, info.h - 1], [info.w - 1, info.h - 1])
      for (const [x, y] of spots) {
        s.hero.x = x + 0.5
        s.hero.y = y + 0.5
        // Nine px of pink on the square, eight once it is a diamond.
        for (const [e, n] of [[0, 9], [1, 8]]) assert.equal(pink(s, e), n, `${id} at ${x},${y}, e ${e}`)
      }
    }
    // The case found in review: Stillsand's east edge a step into the turn, on a land pinned to one view.
    const s = game('stillsand', 'camp')
    seeAll(s)
    s.hero.x = 87.5
    s.hero.y = 29.5
    assert.equal(pink(s, 0.2), 9)
  })
})

// ---- the data gates -----------------------------------------------------------------------------------------

describe('the chart\'s data', () => {
  it('has a way back from every land for every way in, from the grid and the warps', () => {
    let ways = 0
    for (const id of Object.keys(Z.WORLD.atlas)) {
      const passes = Z.landPasses(Z.WORLD, id)
      // One a way: the gate and the open rim it stands in are one pass.
      assert.equal(new Set(passes.map(p => p.to)).size, passes.length, `${id}: ${JSON.stringify(passes)}`)
      for (const p of passes) assert.ok(Z.landPasses(Z.WORLD, p.to).some(q => q.to === id), `${p.to} has no way back to ${id}`)
      ways += passes.length
    }
    assert.ok(ways >= Object.keys(Z.WORLD.atlas).length)
  })

  it('has every map\'s and area\'s name fit on the corner\'s plate, without its THE', () => {
    assert.equal(Z.areaTag('The Big Seter'), 'BIG SETER')
    for (const d of Object.values(Z.WORLD.maps)) {
      for (const n of [d.name, ...(d.areas ?? []).map(a => a.name)]) assert.ok(Z.textWidth(Z.areaTag(n)) + 6 <= Z.CORNER_W - 2, n)
    }
  })

  it('pins the gem exactly where a map allows one view of the round, and shows none in a round of one', () => {
    let pinned = 0
    for (const [id, def] of Object.entries(Z.WORLD.maps)) {
      // (A side map is the 8-bit engine's whatever it says.)
      const only = def.kind === 'side' ? 'classic' : def.views?.length === 1 ? def.views[0] : null
      const want = only === null ? null : only === 'iso' ? 'ISO' : '8-BIT'
      const s = game(id)
      assert.equal(Z.cornerShape(Z.WORLD, s, { e: 1 }).pinned, want, id)
      assert.equal(Z.oneViewWords(def)?.tag ?? null, want && `${want} ONLY HERE`, id)
      const alone = Z.cornerShape(Z.WORLD, s, { e: 0, round: [{ engine: 'classic' }] })
      assert.deepEqual([alone.gem, alone.pinned], [false, null], id)
      if (want) pinned++
    }
    assert.ok(pinned > 0)
  })

  it('has a table of chart inks for every map\'s look: no map falls back to the old violet set', () => {
    const fell = Object.entries(Z.WORLD.maps)
      .filter(([, d]) => Z.charted(d) || d.look || d.realm)
      .filter(([, d]) => Z.chartLook(d) === 'old')
      .map(([id, d]) => `${id} (look ${d.look}, realm ${d.realm})`)
    assert.deepEqual(fell, [])
    for (const look of ['lab', 'wild', ...Z.REALM_LOOKS]) assert.ok(Z.CHART_INKS[look], look)
  })
})
