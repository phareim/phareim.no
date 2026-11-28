// The world (docs/worlds/atlas.md): seven hand-made lands around the coast and the Wildwood, on one grid. The one
// check of the real world by the validator; every seam between two lands walked both ways; each of the six gates
// walked into its land and back, calm at both ends, locked the way it says, a save made at it continuing there;
// nobody out there without a blade; every land reached from the start; and the data gates (foes off the ways in,
// chest ids, the words in the font and the box, the size on `/` and of the dungeons' chunk). Old saves are `zelda-old-saves.test.mjs`, the
// landmarks' art `zelda-things.test.mjs`, what can be opened `zelda-reach.test.mjs`.
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
/** The font, the touch deck's key names, the name plate, and the gates and the grid as data. */
let X
before(async () => {
  Z = await load()
  P = walker(Z)
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { wrapText } from '../base/pixel/font'; export { subst, TOUCH_KEYS } from './keys'; export { speakerOf } from './render/hud';
        export { GATES } from './world/gates'; export { ATLAS } from './world/atlas'`,
      resolveDir: zelda, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  X = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const inp = (o = {}) => ({ move: { x: 0, y: 0 }, a: false, aPress: false, bPress: false, cycle: false, autoFace: false, ...o })
const step = (s, i = inp()) => Z.stepGame(Z.WORLD, s, 1 / 60, i)
const round = v => Math.round(v * 100) / 100
const lands = () => Object.keys(Z.WORLD.maps).filter(id => Z.WORLD.maps[id].away)
/** The lands and every map reached from them by a warp that is not on the coast or in the Wildwood (caves, rooms, the Underglow's floors). */
function outThere() {
  const home = new Set(Object.keys(Z.WORLD.maps).filter(id => !Z.WORLD.maps[id].away && Z.WORLD.atlas[id]))
  const out = new Set(lands())
  for (let grew = true; grew;) {
    grew = false
    for (const id of [...out]) for (const m of Object.values(Z.WORLD.maps[id].marks)) {
      if (m.ent.t === 'warp' && !home.has(m.ent.to) && !out.has(m.ent.to) && Z.WORLD.maps[m.ent.to]) { out.add(m.ent.to); grew = true }
    }
  }
  return [...out]
}

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
 * (boulders, cracks, thickets) but for the tiles in `shut`, wardens away (unless `blocked` says a tile is stood on);
 * the hook only with `hook`.
 */
function walkDistances(map, entry, { hook = false, max = 400, blocked = null, shut = '' } = {}) {
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
  const open = t => !shut.includes(t) && ((!Z.TILE_INFO[t].solid && !Z.TILE_INFO[t].pit) || t === 'R' || t === '%' || t === '*')
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

describe('the world', () => {
  it('is whole by the validator, with every land on the grid', () => {
    assert.deepEqual(Z.validateWorld(Z.WORLD), [])
    for (const id of lands()) assert.ok(Z.WORLD.atlas[id], `${id} is on the grid`)
    assert.deepEqual(Object.keys(Z.WORLD.atlas).sort(), Object.keys(X.ATLAS).sort())
  })
})

describe('the grid', () => {
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

/** What keeps a hero from each gate: a tile that bombs open, or a warden who stands aside for the blade. */
const LOCKS = { fell: 'R', spore: 'warden', sand: '%', lawns: 'warden', quarry: 'warden', fog: 'warden' }

describe('the gates', () => {
  it('lead into their lands and back, one walk each: locked the way it says, calm at both ends, a save at the gate continuing there', () => {
    assert.deepEqual(X.GATES.map(g => g.id).sort(), Object.keys(LOCKS).sort())
    const guards = bladeGuards()
    for (const g of X.GATES) {
      const { id } = g
      const out = warpTo(g.home, g.land, `gate-${id}`)
      const back = warpTo(g.land, g.home, `gate-${id}`)
      assert.ok(out && back, `${g.home} and ${g.land} lead into each other by the ${id} gate`)
      // The gate's two ends lie side by side on the grid.
      const o = Z.WORLD.atlas[g.home]
      const t = Z.WORLD.atlas[g.land]
      assert.equal(Math.abs(o.x + out.x - (t.x + back.x)) + Math.abs(o.y + out.y - (t.y + back.y)), 1, `${id}: the two ends are neighbours on the grid`)
      // Locked as it says: reached from the start only once the lock gives way.
      const reached = lock => walkDistances('overworld', 'start', { hook: true, max: 5000, blocked: (m, i) => !!Z.WORLD.maps[m].away || (lock === 'warden' && guards.has(`${m}|${i}`)), shut: lock === 'warden' ? '' : lock })
        .tileDist.has(`${g.home}|${out.y * Z.mapInfo(Z.WORLD, g.home).w + out.x}`)
      assert.ok(!reached(LOCKS[id]), `${id}: open without its lock giving way (${LOCKS[id]})`)
      assert.ok(reached(''), `${id}: reached from the start`)
      // The walk in.
      const s = armed(g.home, `gate-${id}`, out)
      s.map.enemies = []
      P.walkTo(s, out.x, out.y, { keepDialog: true })
      for (let i = 0; i < 120 && s.mode === 'warp'; i++) step(s)
      assert.equal(s.map.id, g.land, id)
      const at = Z.mapInfo(Z.WORLD, g.land).entries[`gate-${id}`]
      assert.deepEqual([round(s.hero.x), round(s.hero.y)], [at.x, at.y], `${id}: at the gate`)
      assert.deepEqual(s.entry, { map: g.land, entry: `gate-${id}` })
      P.settle(s)
      const near = s.map.enemies.filter(e => !e.dead && Math.abs(e.x - at.x) + Math.abs(e.y - at.y) < 10)
      assert.deepEqual(near.map(e => `${e.kind} ${e.x},${e.y}`), [], `${id}: no foe within ten tiles of the gate`)
      for (let k = 0; k < 180; k++) { s.hero.invuln = 1; step(s) }
      assert.equal(s.mode, 'play', `${id}: no fight at the gate`)
      // The save made here: a reload stays out there, a new visit starts on the plaza, and a land has a camp for a
      // save that lost its spot.
      const save = Z.parseSave(JSON.parse(JSON.stringify(Z.toSave(s))))
      const start = reload => Z.createGame(Z.WORLD, { save, at: Z.loadSpot(Z.WORLD, save, null, reload) })
      const u = start(true)
      assert.deepEqual([u.map.id, round(u.hero.x), round(u.hero.y)], [g.land, at.x, at.y], `${id}: continues at the gate`)
      assert.deepEqual(start(false).entry, Z.WORLD.start, `${id}: a new visit starts on the plaza`)
      assert.ok(Z.mapInfo(Z.WORLD, g.land).entries.camp, `${g.land} has a camp`)
      // And the walk home.
      Z.enterMap(Z.WORLD, s, g.land, `gate-${id}`, [])
      s.map.enemies = []
      P.walkTo(s, back.x, back.y)
      for (let i = 0; i < 120 && s.mode !== 'play'; i++) step(s)
      assert.equal(s.map.id, g.home, id)
      const home = Z.mapInfo(Z.WORLD, g.home).entries[`gate-${id}`]
      assert.deepEqual([round(s.hero.x), round(s.hero.y)], [home.x, home.y], `${id}: home again`)
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

  it('keeps foes off the ways in: none near a gate, a seam, the ferry or a stair, and never a crowd', () => {
    for (const id of outThere()) {
      const info = Z.mapInfo(Z.WORLD, id)
      const def = info.def
      let foes = 0
      const doors = Object.values(info.entries)
      def.rows.forEach((r, y) => [...r].forEach((ch, x) => {
        const e = def.marks[ch]?.ent
        if (e?.t !== 'enemy') return
        foes++
        // (A side room is one screen, entered at its edge: two tiles there, not a land's eight.)
        for (const d of doors) assert.ok(Math.abs(x + 0.5 - d.x) + Math.abs(y + 0.5 - d.y) >= (def.kind === 'side' ? 2 : 8), `${id}: ${e.kind} at ${x},${y} by an entry`)
      }))
      assert.ok(foes <= 24, `${id}: ${foes} field foes`)
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
    const talkOf = e => (e.t === 'npc' ? e.talk.flatMap(b => [...b.lines, ...(b.ask ? [...b.ask.options, ...b.ask.replies.flat()] : [])]) : e.t === 'sign' ? [...e.lines, ...(e.alt?.lines ?? [])] : [])
    const OWN = new Set(['KEEPER', 'MOSSA', 'MAX', 'TOBY', 'OWL', 'DUSTY', 'TROLL', 'LUNA', 'PETTER', 'BARTENDER'])
    const maps = outThere().map(id => Z.WORLD.maps[id])
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
    // Every room's card and events say their lines on a page too, in every map.
    for (const d of Object.values(Z.WORLD.maps)) for (const c of Object.values(d.cells ?? {})) lines.push(...(c.card ? [c.card.title, ...c.card.lines] : []), ...(c.events ?? []).flatMap(e => e.lines ?? []))
    // Luna's talk, too: every branch and every page of it.
    for (const b of Z.WORLD.luna) lines.push(...b.lines, ...(b.ask ? [...b.ask.options, ...b.ask.replies.flat()] : []))
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

  it('keeps the world a visitor to `/` downloads small, the dungeons not included, and their chunk too', () => {
    const opts = { bundle: true, minify: true, write: false, format: 'esm', platform: 'neutral', logLevel: 'error', metafile: true, absWorkingDir: zelda }
    /** `contents` as the site splits it: what arrives at once (the entry and every chunk it imports statically), and what behind an `import()`. */
    const split = contents => {
      const r = esbuild.buildSync({ ...opts, splitting: true, outdir: 'out', stdin: { contents, resolveDir: zelda, loader: 'ts' } })
      const outputs = r.metafile.outputs
      const files = new Map(r.outputFiles.map(f => [f.path, f.contents]))
      const home = new Set()
      const walk = k => {
        if (home.has(k)) return
        home.add(k)
        for (const imp of outputs[k].imports) if (imp.kind === 'import-statement') walk(imp.path)
      }
      walk(Object.keys(outputs).find(k => outputs[k].entryPoint === '<stdin>'))
      const later = Object.keys(outputs).filter(k => !home.has(k))
      return {
        home: [...home], later,
        gz: keys => keys.reduce((n, k) => n + gzipSync(files.get(join(zelda, k))).length, 0),
        held: keys => new Set(keys.flatMap(k => Object.keys(outputs[k].inputs))),
        /** The modules on `/` that import `m`. */
        importers: m => [...home].flatMap(o => Object.keys(outputs[o].inputs)).filter(k => r.metafile.inputs[k]?.imports.some(i => i.path === m && i.kind === 'import-statement')),
      }
    }
    // The sizes: the home page's world; and the dungeons' chunk (maps and pictures) behind an `import()`, the sprite
    // table it adds to being on `/` already.
    const world = split(`export * from './world/core'; export const dungeons = () => import('./world/dungeons')`)
    const table = split(`export * from './world/core'; export * from './render/sprites'; export const dungeons = () => import('./dungeonChunk')`)
    const [now, chunk] = [world.gz(world.home), table.gz(table.later)]
    if (process.env.WORLD_SIZE) console.log(`world on /: ${now} B gz; the dungeons' chunk: ${chunk} B gz`)
    // No dungeon module on `/`, to the byte: each one `dungeons.ts` imports, and each file of rows `spritesDungeons.ts`
    // spreads, comes later and never at once, seen from the world, the shell's own loader and the painters of both views.
    const imports = file => esbuild.buildSync({ ...opts, entryPoints: [file] }).metafile.inputs[file].imports.map(i => i.path)
    const modules = imports('world/dungeons.ts')
    const rows = ['render/spritesDungeons.ts', ...imports('render/spritesDungeons.ts')]
    assert.ok(modules.length && rows.length > 1, 'world/dungeons.ts imports no dungeon, or render/spritesDungeons.ts no rows')
    const site = split(`export * from './world/core'; export * from './dungeonLoad'; export * from './render/renderer'; export { default as isoView } from './render/iso/view'`)
    for (const build of [table, site]) {
      const [onHome, onLater] = [build.held(build.home), build.held(build.later)]
      for (const m of [...modules, ...rows]) {
        assert.ok(!onHome.has(m), `${m} is on /: ${build.importers(m).join(', ') || 'something the home page imports'} imports it statically; a dungeon is registered in world/dungeons.ts only, its sprite rows in render/spritesDungeons.ts only`)
        assert.ok(onLater.has(m), `${m} is not in the dungeons' chunk`)
      }
    }
    // (2026-11-28: about 60,900 B on `/`; 52,462 B in the chunk with all seven dungeons, the Balance and the Maximizer
    // in it, the maps about 12,600 of it and their pictures the rest. The chunk's ceiling was raised from 50,000 that
    // day, on purpose: it is fetched at a dungeon's door, never on `/`. docs/site.md, "What `/` costs".)
    assert.ok(now <= 62_000, `the world on / is ${now} B gzipped`)
    assert.ok(table.later.length > 0 && chunk <= 58_000, `the dungeons' chunk is ${chunk} B gzipped, in ${table.later.length} files`)
  })
})
