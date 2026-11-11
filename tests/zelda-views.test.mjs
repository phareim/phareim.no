// Neon Shrine's views: the registry, the isometric geometry and how tiles
// stand. Pure modules, bundled with esbuild like the other zelda tests.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')
const site = resolve(root, '../..')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * from './render/iso/project'`,
        `export * from './render/iso/shape'`,
        `export { VIEWS, VIEW_KEY, MAX_VIEWS, ENGINE_LOADERS, isViewId, nextView, viewName, startView, parseViews, mergeViews, setLiveViews, viewList, viewDef } from './views'`,
        `export { ENGINES, resolveParams, paramDiff, cleanParam, isEngineId } from './viewParams'`,
        `export { WORLD } from './world/index'`,
        `export { TILE_INFO } from './world/tiles'`,
        `export { createTurn } from './render/turn'`,
        `export { createGame } from './engine/index'`,
        `export { enterMap } from './engine/game'`,
        `export { STAGE_SCENES, stageScene } from '../stage/scenes'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    // The view modules themselves draw on a canvas: leave them out of the bundle.
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error', external: ['./render/iso/view', './render/blyant/view'],
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => { M = await load() })
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} is not ${b}`)

describe('the view registry', () => {
  it('starts with the classic view, which needs no code of its own', () => {
    assert.equal(M.VIEWS[0].id, 'classic')
    assert.equal(M.VIEWS[0].load, undefined)
    for (const v of M.VIEWS.slice(1)) assert.equal(typeof v.load, 'function', `${v.id} has no loader`)
  })
  it('goes round every view and back', () => {
    let id = 'classic'
    const seen = []
    for (let i = 0; i < M.VIEWS.length; i++) { seen.push(id); id = M.nextView(id) }
    assert.equal(id, 'classic')
    assert.deepEqual(seen.sort(), M.VIEWS.map(v => v.id).sort())
  })
  it('takes the address before the stored choice, and nonsense from neither', () => {
    assert.equal(M.startView('iso', 'classic'), 'iso')
    assert.equal(M.startView(null, 'iso'), 'iso')
    assert.equal(M.startView('3d', 'iso'), 'iso')
    assert.equal(M.startView('3d', 'hologram'), 'classic')
    assert.equal(M.startView(null, null), 'classic')
  })
  it('names every view for the pause screen in the pixel font', () => {
    for (const v of M.VIEWS) {
      assert.match(M.viewName(v.id), /^[A-Z0-9 ]+$/)
      assert.match(v.tag, /^[A-Z0-9 -]+$/)
    }
  })
  it('has one built-in view per engine, drawn with the engine\'s own values', () => {
    assert.deepEqual(M.VIEWS.map(v => v.engine).sort(), Object.keys(M.ENGINES).sort())
    for (const v of M.VIEWS) {
      assert.equal(v.load, M.ENGINE_LOADERS[v.engine])
      assert.equal(v.params, undefined)
    }
  })
  it('keeps every view\'s code out of the page that loads first', () => {
    // Anything but a dynamic import() of a view, anywhere on the site, would put it in the entry:
    // a static import, a side-effect import or a re-export, in either kind of quote.
    const skip = new Set(['node_modules', '.nuxt', '.output', 'dist', 'iso', 'blyant'])
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (skip.has(e.name) ? [] : walk(resolve(dir, e.name))) : [resolve(dir, e.name)])
    const files = ['themes', 'components', 'composables', 'pages', 'plugins', 'server'].flatMap(d => walk(resolve(site, d))).concat(resolve(site, 'app.vue'))
    const dynamic = { iso: 0, blyant: 0 }
    for (const f of files) {
      if (!/\.(ts|vue|mjs|js)$/.test(f)) continue
      const src = readFileSync(f, 'utf8')
      for (const line of src.split('\n')) {
        const m = /(iso|blyant)\/view['"]/.exec(line)
        if (!m || /^\s*(\/\/|\*)/.test(line)) continue
        assert.match(line, /import\(\s*['"][^'"]*(iso|blyant)\/view['"]\s*\)/, `${f} brings the ${m[1]} view in statically: ${line.trim()}`)
        dynamic[m[1]]++
      }
    }
    assert.deepEqual(dynamic, { iso: 1, blyant: 1 }, 'the registry should hold the one dynamic import of each view')
  })
  it('keeps Blyant itself out of the entry: only the pencil view brings it', () => {
    const skip = new Set(['node_modules', '.nuxt', '.output', 'dist'])
    const walk = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (skip.has(e.name) ? [] : walk(resolve(dir, e.name))) : [resolve(dir, e.name)])
    const files = ['themes', 'components', 'composables', 'pages', 'plugins', 'server'].flatMap(d => walk(resolve(site, d))).concat(resolve(site, 'app.vue'))
    const users = files.filter(f => /\.(ts|vue|mjs|js)$/.test(f) && /from ['"]blyant|import ['"]blyant/.test(readFileSync(f, 'utf8')))
    assert.deepEqual(users.map(f => f.slice(site.length + 1)), ['themes/zelda/render/blyant/view.ts'])
  })
})

describe('an engine\'s values', () => {
  it('gives every engine the finish it needs, inside its own bounds', () => {
    for (const [id, e] of Object.entries(M.ENGINES)) {
      assert.ok(e.title && e.blurb, `${id} has no words for the studio`)
      for (const [name, spec] of Object.entries(e.params)) {
        assert.ok(spec.label, `${id}.${name} has no label`)
        if (spec.t === 'number') assert.ok(spec.min <= spec.value && spec.value <= spec.max, `${id}.${name} starts outside its bounds`)
        if (spec.t === 'choice') assert.ok(spec.options.includes(spec.value), `${id}.${name} starts on a choice it does not offer`)
      }
    }
    for (const name of ['scanlines', 'bloom', 'vignette']) {
      assert.ok(M.ENGINES.classic.params[name], `the classic view has no ${name}`)
      assert.ok(M.ENGINES.iso.params[name], `the isometric view has no ${name}`)
    }
  })
  it('clamps a number, refuses a colour that is not one, and keeps to the choices', () => {
    const p = M.resolveParams('blyant', { wobble: 99, paper: 'vellum', paperColor: 'red', inkColor: '#ABCDEF', hatch: 'yes', nonsense: 1 })
    assert.equal(p.wobble, M.ENGINES.blyant.params.wobble.max)
    assert.equal(p.paper, 'auto')
    assert.equal(p.paperColor, '')
    assert.equal(p.inkColor, '#abcdef')
    assert.equal(p.hatch, true)
    assert.equal('nonsense' in p, false)
  })
  it('keeps only what differs from the engine\'s own', () => {
    assert.deepEqual(M.paramDiff('classic', { scanlines: 1, bloom: 0.5 }), { bloom: 0.5 })
    assert.deepEqual(M.paramDiff('classic', null), {})
  })
})

describe('the studio\'s views', () => {
  it('lays the studio\'s values on a built-in view and adds its own after them', () => {
    const live = M.parseViews({
      classic: { params: { scanlines: 0 } },
      noir: { engine: 'blyant', name: 'NOIR', params: { paper: 'kull', colour: 0 } },
    })
    const round = M.mergeViews(live)
    assert.deepEqual(round.map(v => v.id), ['classic', 'iso', 'blyant', 'noir'])
    assert.deepEqual(round[0].params, { scanlines: 0 })
    assert.deepEqual(round[3], { id: 'noir', name: 'NOIR', tag: 'PENCIL', engine: 'blyant', params: { paper: 'kull', colour: 0 } })
  })
  it('drops what the game cannot draw or spell', () => {
    const live = M.parseViews({
      'Bad Id': { engine: 'iso', name: 'X' },
      hologram: { engine: '3d', name: 'HOLO' },
      quiet: { engine: 'iso', name: 'lower case' },
      nameless: { engine: 'iso' },
      ok: { engine: 'blyant', name: 'DAWN', tag: 'no', params: { paper: 'vellum', shade: 9 } },
      list: [],
    })
    assert.deepEqual(Object.keys(live), ['ok'])
    assert.deepEqual(live.ok, { engine: 'blyant', name: 'DAWN', params: { shade: M.ENGINES.blyant.params.shade.max } })
    assert.deepEqual(M.parseViews('nope'), {})
    assert.deepEqual(M.parseViews(null), {})
  })
  it('orders the round, hides a built-in view on request, and never the classic one', () => {
    const live = M.parseViews({
      classic: { hidden: true },
      iso: { hidden: true },
      first: { engine: 'blyant', name: 'FIRST', order: -1 },
    })
    assert.deepEqual(M.mergeViews(live).map(v => v.id), ['first', 'classic', 'blyant'])
  })
  it('never lets the round grow past what V can go round', () => {
    const many = {}
    for (let i = 0; i < 20; i++) many['v' + i] = { engine: 'classic', name: 'V' + i }
    assert.equal(M.mergeViews(M.parseViews(many)).length, M.MAX_VIEWS)
  })
  it('takes a published view into the round, and falls back to classic when it is gone', () => {
    M.setLiveViews(M.parseViews({ noir: { engine: 'blyant', name: 'NOIR' } }))
    assert.equal(M.startView('noir', null), 'noir')
    assert.equal(M.nextView('blyant'), 'noir')
    assert.equal(M.nextView('noir'), 'classic')
    assert.equal(M.viewName('noir'), 'NOIR')
    M.setLiveViews(null)
    assert.equal(M.startView(null, 'noir'), 'classic')
    assert.equal(M.viewList().length, M.VIEWS.length)
  })
})

describe('the projection', () => {
  it('is the classic view at 0 and a 2:1 diamond at 1', () => {
    assert.deepEqual(M.projection(0), { ex: { x: 16, y: 0 }, ey: { x: 0, y: 16 }, k: 0 })
    assert.deepEqual(M.projection(1), { ex: { x: 16, y: 8 }, ey: { x: -16, y: 8 }, k: 1 })
  })
  it('turns without a jump at either end', () => {
    const a = M.projection(0.0001)
    near(a.ex.x, 16, 0.01); near(a.ex.y, 0, 0.01); near(a.ey.x, 0, 0.01); near(a.ey.y, 16, 0.01)
    const b = M.projection(0.9999)
    near(b.ex.x, 16, 0.01); near(b.ex.y, 8, 0.01); near(b.ey.x, -16, 0.01); near(b.ey.y, 8, 0.01)
  })
  it('never folds the ground over on the way', () => {
    for (let k = 0; k <= 1; k += 0.05) {
      const p = M.projection(k)
      assert.ok(p.ex.x * p.ey.y - p.ey.x * p.ex.y > 100, `the ground is flat or mirrored at k=${k}`)
    }
  })
  it('unprojects what it projects', () => {
    for (const k of [0, 0.3, 0.77, 1]) {
      const p = M.projection(k)
      const s = M.project(p, 12.25, 40.5)
      const w = M.unproject(p, s.x, s.y)
      near(w.x, 12.25, 1e-6); near(w.y, 40.5, 1e-6)
    }
  })
  it('covers the whole screen with ground tiles, and stays on the map', () => {
    const p = M.projection(1)
    const c = M.project(p, 30, 20)
    const r = M.groundRect(p, c, 320, 200, 56, 2, 104, 48)
    for (const [sx, sy] of [[-160, -100], [160, -100], [-160, 156], [160, 156]]) {
      const w = M.unproject(p, c.x + sx, c.y + sy)
      const x = Math.max(0, Math.min(104, w.x))
      const y = Math.max(0, Math.min(48, w.y))
      assert.ok(x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h, 'a corner of the screen has no tile under it')
    }
    assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= 104 && r.y + r.h <= 48)
  })
  it('keeps the camera inside a big zone and centres a small one', () => {
    const p = M.projection(1)
    const big = { x: 0, y: 0, w: 104, h: 48 }
    const far = M.centreIn(p, { x: 0, y: 0 }, big, 320, 200, 56)
    const box = M.projectedBox(p, big, 56)
    assert.ok(far.x - 160 >= box.x0 - 1e-6 && far.y - 100 >= box.y0 - 1e-6)
    const small = { x: 10, y: 10, w: 4, h: 4 }
    const mid = M.centreIn(p, { x: 10, y: 10 }, small, 320, 200, 0)
    const sb = M.projectedBox(p, small, 0)
    near(mid.x, (sb.x0 + sb.x1) / 2); near(mid.y, (sb.y0 + sb.y1) / 2)
  })
})

describe('controls in a turned view', () => {
  const T8 = Math.PI / 4
  it('leaves the classic view alone', () => {
    const m = { x: 0.3, y: -0.8 }
    assert.equal(M.turnMove(m, 0), m)
  })
  it('makes up on the stick up on the screen', () => {
    // Up on an isometric screen is north-west in the world: the same ground step along both axes.
    const w = M.turnMove({ x: 0, y: -1 }, T8)
    near(w.x, -Math.SQRT1_2); near(w.y, -Math.SQRT1_2)
    const s = M.project(M.projection(1), w.x, w.y)
    near(s.x, 0); assert.ok(s.y < 0)
  })
  it('lands the eight keyboard directions on the eight world directions', () => {
    const n = M.turnMove({ x: Math.SQRT1_2, y: -Math.SQRT1_2 }, T8)
    near(n.x, 0); near(n.y, -1)
    const e = M.turnMove({ x: Math.SQRT1_2, y: Math.SQRT1_2 }, T8)
    near(e.x, 1); near(e.y, 0)
    const r = M.turnMove({ x: 1, y: 0 }, T8)
    near(r.x, Math.SQRT1_2); near(r.y, -Math.SQRT1_2)
  })
  it('keeps the length of the push', () => {
    const w = M.turnMove({ x: 0.3, y: 0.4 }, T8 * 0.6)
    near(Math.hypot(w.x, w.y), 0.5)
  })
})

describe('how tiles stand', () => {
  const grid = (rows, kind) => (x, y) => {
    const at = (dx, dy) => rows[y + dy]?.[x + dx] ?? (kind === 'overworld' ? 'T' : '#')
    return M.shapeOf(rows[y][x], kind, at)
  }
  it('reads a dungeon wall as a top with a face on its southern row', () => {
    const s = grid(['####', '####', '....'], 'dungeon')
    assert.equal(s(1, 0), M.WALL_TOP)
    assert.equal(s(1, 1), M.FACE0)
    assert.equal(s(1, 2), M.FLAT)
  })
  it('leaves a wall down when floor lies to its west, so it hides nothing', () => {
    const s = grid(['#..#', '#..#', '#..#', '####'], 'interior')
    assert.equal(s(0, 0), M.WALL_TOP)
    assert.equal(s(3, 0), M.FLAT)
    assert.equal(s(3, 1), M.FLAT)
  })
  it('gives a house a roof, a window row and a foot, with the door in the foot', () => {
    const s = grid(['.....', '.HHH.', '.HHH.', '.HHH.', '.HDH.', '.....'], 'overworld')
    assert.equal(s(1, 1), M.ROOF)
    assert.equal(s(1, 2), M.ROOF)
    assert.equal(s(1, 3), M.FACE1)
    assert.equal(s(1, 4), M.FACE0)
    assert.equal(s(2, 4), M.FACE0)
    assert.equal(s(2, 3), M.FACE1)
  })
  it('stands a lone tree up and makes a canopy of trees with trees below', () => {
    const s = grid(['.....', '.T.T.', '...T.', '.....'], 'overworld')
    assert.equal(s(1, 1), M.CARD)
    assert.equal(s(3, 1), M.CANOPY)
    assert.equal(s(3, 2), M.CARD)
  })
  it('stands a fence along x up as a strip and lays one along y down', () => {
    const s = grid(['.....', '.FFF.', '.....', '..F..', '..F..', '.....', '.F...'], 'overworld')
    assert.equal(s(2, 1), M.FACE0)
    assert.equal(s(2, 3), M.FLAT)
    assert.equal(s(1, 6), M.CARD)
  })
  it('keeps a crystal block down until it is raised, and an exit\'s tile bare', () => {
    const at = () => '.'
    assert.equal(M.shapeOf('P', 'dungeon', at, false, false), M.FLAT)
    assert.equal(M.shapeOf('P', 'dungeon', at, false, true), M.CARD)
    assert.equal(M.shapeOf('M', 'interior', at, true), M.FLAT)
  })
  it('never raises anything the hero can walk on above the ground', () => {
    // On the maps as the engine builds them (markers resolved to their tiles, doors included):
    // a walkable tile that stood up as a wall top would hide the hero standing on it.
    const g = M.createGame(M.WORLD, { seed: 1, at: M.WORLD.start })
    let seen = 0
    for (const id of Object.keys(M.WORLD.maps)) {
      M.enterMap(M.WORLD, g, id, '', [], { x: 1.5, y: 1.5 })
      const m = g.map
      const kind = M.WORLD.maps[id].kind
      for (let y = 0; y < m.h; y++) for (let x = 0; x < m.w; x++) {
        const ch = m.tiles[y * m.w + x]
        if (M.TILE_INFO[ch].solid) continue
        const at = (dx, dy) => (x + dx < 0 || y + dy < 0 || x + dx >= m.w || y + dy >= m.h) ? (kind === 'overworld' ? 'T' : '#') : m.tiles[(y + dy) * m.w + x + dx]
        assert.notEqual(M.shapeOf(ch, kind, at).k, 'top', `${id} (${x},${y}) '${ch}' is walkable and raised`)
        seen++
      }
    }
    assert.ok(seen > 5000, `only ${seen} walkable tiles were looked at`)
  })
  it('leaves a wall down over a door that lies flat in a side wall', () => {
    // Two door tiles one above the other in a west wall: nothing may stand on the upper one.
    const s = grid(['##...', '##...', 'L....', 'L....', '##...', '##...'], 'dungeon')
    assert.equal(s(0, 1), M.FLAT)
    assert.equal(s(0, 2), M.FLAT)
    assert.equal(s(0, 3), M.FLAT)
    // A door in a north wall stands, and so does the wall above it.
    const n = grid(['###', '###', '#L#', '...'], 'dungeon')
    assert.equal(n(1, 2), M.FACE0)
    assert.equal(n(1, 1), M.WALL_TOP)
  })
})

describe('the turn between views', () => {
  const two = () => M.createTurn(id => id === 'iso' || id === 'other', 0.6)
  const run = (t, seconds, dt = 1 / 60) => { let r; for (let i = 0; i < Math.round(seconds / dt); i++) r = t.step(dt); return r }
  it('starts on the classic view and stays there', () => {
    const t = two()
    assert.deepEqual(t.step(1 / 60), { shown: '', k: 0 })
    assert.equal(t.id, 'classic')
    assert.equal(t.turning, false)
  })
  it('turns in over the given time, and never draws the view at k = 0', () => {
    const t = two()
    t.set('iso')
    assert.equal(t.id, 'iso')
    assert.equal(t.turning, true)
    const first = t.step(1 / 60)
    assert.equal(first.shown, 'iso')
    assert.ok(first.k > 0 && first.k < 0.05)
    assert.ok(run(t, 0.3).k < 1)
    assert.deepEqual(run(t, 0.4), { shown: 'iso', k: 1 })
    assert.equal(t.turning, false)
  })
  it('turns back out, and the classic view takes over at the end', () => {
    const t = two()
    t.set('iso', true)
    assert.deepEqual(t.step(0), { shown: 'iso', k: 1 })
    t.set('classic')
    assert.equal(t.id, 'classic')
    assert.equal(run(t, 0.3).shown, 'iso')
    assert.deepEqual(run(t, 0.4), { shown: '', k: 0 })
    assert.equal(t.turning, false)
  })
  it('reverses in the middle without a jump', () => {
    const t = two()
    t.set('iso')
    const up = run(t, 0.3).k
    t.set('classic')
    const down = t.step(1 / 60).k
    assert.ok(down < up && up - down < 0.05)
  })
  it('goes from one added view to another through the classic one', () => {
    const t = two()
    t.set('iso', true)
    t.set('other')
    assert.equal(t.id, 'other')
    assert.equal(run(t, 0.3).shown, 'iso')
    const seen = new Set()
    for (let i = 0; i < 120; i++) seen.add(t.step(1 / 60).shown)
    assert.deepEqual([...seen], ['iso', '', 'other'])
    assert.equal(t.k, 1)
  })
  it('stands still while no time passes, and says a turn is in flight', () => {
    const t = two()
    t.set('iso')
    run(t, 0.2)
    const k = t.k
    assert.equal(t.step(0).k, k)
    assert.equal(t.turning, true)
    t.set('iso', true)
    assert.equal(t.turning, false)
    assert.equal(t.k, 1)
  })
  it('treats a view it does not have as the classic one', () => {
    const t = two()
    t.set('hologram')
    assert.equal(t.id, 'classic')
    assert.deepEqual(t.step(1), { shown: '', k: 0 })
  })
})

describe('the studio\'s stage', () => {
  it('puts the hero on open ground in every scene, and names each for the studio\'s list', () => {
    const ids = new Set()
    for (const sc of M.STAGE_SCENES) {
      assert.match(sc.id, /^[a-z][a-z0-9-]*$/)
      assert.ok(sc.label && sc.group, `${sc.id} has no label or group`)
      assert.ok(!ids.has(sc.id), `two scenes are called ${sc.id}`)
      ids.add(sc.id)
      const s = M.createGame(M.WORLD, { seed: 7 })
      sc.set(M.WORLD, s)
      const m = s.map
      const tx = Math.floor(s.hero.x)
      const ty = Math.floor(s.hero.y)
      assert.ok(tx >= 0 && ty >= 0 && tx < m.w && ty < m.h, `${sc.id} is off the map`)
      const t = m.tiles[ty * m.w + tx]
      assert.ok(!M.TILE_INFO[t].solid, `${sc.id} stands the hero in a wall (${t} at ${tx},${ty} of ${m.id})`)
    }
  })
  it('falls back to the first scene for a place it does not know', () => {
    assert.equal(M.stageScene('nowhere').id, M.STAGE_SCENES[0].id)
    assert.equal(M.stageScene('beach').id, 'beach')
  })
  it('is a theme with no way in from the portal, and keeps its world out of the entry', () => {
    const reg = readFileSync(resolve(site, 'themes/index.ts'), 'utf8')
    assert.match(reg, /id: 'stage',\s+disabled: true/)
    const landing = readFileSync(resolve(site, 'themes/stage/Landing.vue'), 'utf8')
    assert.match(landing, /defineAsyncComponent\(\(\) => import\('\.\/ViewStage\.vue'\)\)/)
    const stage = readFileSync(resolve(site, 'themes/stage/ViewStage.vue'), 'utf8')
    for (const word of ['localStorage', 'sessionStorage', 'submitScore', 'createZeldaAudio', 'fetch(']) assert.ok(!stage.includes(word), `the stage must keep nothing and call nobody (${word})`)
  })
})
