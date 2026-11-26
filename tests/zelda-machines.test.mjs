// Neon Shrine's machines drawn by hand for the isometric view (part 25: render/iso/machines.ts, its art machineArt.ts a
// chunk of its own, packed beside a realm's kit by things.ts): the arcade cabinets, Petter's terminals and the LOGIN console. Which placed machines have a drawing, that a style
// with none keeps the classic box, that every cabinet style is an edit on the master's silhouette, that each live screen
// stands inside its drawing's glass, and that each cabinet was drawn from the style the classic painter still paints.
// Part 26 (stallArt.ts, a second chunk): the square's newsstand, NEW LOOK stall and KODING KATA stand, each standing from
// several drawings; their lit signs, screens and mirror stand in their key areas in front of every px of their own drawings,
// their people behind the counter, and a map packs only the drawings its looks bring.
// Bundled with esbuild like the other zelda tests; no canvas is made here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../themes/zelda')

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { withThings, thingKey } from './render/iso/things'; export { buildProps } from './render/iso/props'; export { screenFit, hasMachines, machineLooks, machineKit, machineArt, withMachines, loadMachineArt, MACHINE_SCREENS, MACHINE_FROM } from './render/iso/machines'; export { queueExits, CAB_STYLES } from './render/exits'; export { worldExits, WORLD } from './world'`,
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}

let M
before(async () => {
  const mod = await load()
  // (The art is fetched as the view does; its entries stand in for THING_ART below.)
  const art = await mod.loadMachineArt()
  // (Part 25's machines, and part 26's newsstand and stalls, a chunk of their own.)
  const part25 = id => id.startsWith('cab_') || id === 'home_terminal' || id === 'login_console'
  const pick = f => Object.fromEntries(Object.entries(art).filter(([id]) => f(id)))
  M = { ...mod, MACHINE_ART: pick(part25), STALL_ART: pick(id => !part25(id)), THING_ART: art, hasThing: id => Object.prototype.hasOwnProperty.call(art, id) }
})

/** Every cabinet placed in the world (the arcade, the VIP hall, Petter's house), by its art. */
const PLACED = ['newgame', 'anotherworld', 'voyagers2', 'breakout', 'rtype', 'invaders', 'invasive', 'starfox', 'outrun', 'russian',
  'battery', 'pizzarescue', 'nova', 'adventure', 'horizon', 'miniworld', 'figur', 'eventyrland', 'maileg']
const MACHINE_LOOKS = new Set(['cabinet', 'terminal', 'console'])

/** The item the classic painter queues for an exit of this look (what a turned view reads). */
function itemOf(look, art) {
  const items = []
  M.queueExits({}, [{ id: 't', x: 5.5, y: 5.5, to: { url: '' }, look, art, walk: false }], 0, 0, 400, 400, 0, true, items, [], [])
  assert.equal(items.length, 1)
  return items[0]
}

/** The FNV-1a hash of a cabinet style's identity, as emit.py wrote MACHINE_FROM. */
function styleHash(st) {
  const s = [st.body, st.bodyL, st.bodyD, st.trim, st.marquee.join(','), st.bg.join(',')].join('|')
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0 }
  return h.toString(16).padStart(8, '0')
}

describe('zelda machines drawn by hand (part 25)', () => {
  it('every machine placed in the world has a drawing, and its item names it with its live screens', () => {
    const placed = M.worldExits().filter(e => MACHINE_LOOKS.has(e.look))
    const cabs = placed.filter(e => e.look === 'cabinet').map(e => e.art).sort()
    assert.deepEqual(cabs, [...PLACED].sort(), 'the placed cabinets')
    assert.equal(placed.filter(e => e.look === 'terminal').length, 3)
    assert.equal(placed.filter(e => e.look === 'console').length, 1)
    for (const e of placed) {
      const it = itemOf(e.look, e.art)
      assert.ok(it.box, `${e.look} ${e.art ?? ''} keeps its box for the classic turn`)
      assert.equal(it.things?.length, 1)
      const id = it.things[0].id
      assert.ok(M.hasThing(id), `${id} is drawn`)
      assert.ok(it.screens?.length >= 1, `${id} names its live screen`)
      assert.equal(it.screens.length, M.MACHINE_SCREENS[id].length, `${id}: a glass for each screen`)
    }
    assert.deepEqual(Object.keys(M.MACHINE_ART).sort(), [...PLACED.map(a => `cab_${a}`), 'home_terminal', 'login_console'].sort())
  })

  it('a style with no drawing falls back to the classic box', () => {
    for (const art of ['galaga', 'default', undefined]) {
      const it = itemOf('cabinet', art)
      assert.ok(it.box)
      assert.equal(M.hasThing(it.things[0].id), false, `${art} has no drawing: the view keeps the box`)
    }
    // (galaga and default are styles the painter has that no cabinet in the world wears)
    assert.ok(M.CAB_STYLES.galaga && M.CAB_STYLES.default)
  })

  it('every cabinet style is an edit of the master on its silhouette, sharing its normals and depth', () => {
    const master = M.THING_ART.cab_newgame
    assert.ok(master.nrows && master.deep && !master.like)
    const shape = t => t.rows.map(r => r.replace(/[^.]/g, '#')).join('\n')
    for (const art of PLACED.slice(1)) {
      const t = M.THING_ART[`cab_${art}`]
      assert.equal(t.like, 'cab_newgame', art)
      assert.equal(t.w, master.w); assert.equal(t.h, master.h); assert.equal(t.ax, master.ax); assert.equal(t.ay, master.ay)
      assert.equal(shape(t), shape(master), `${art}: the master's silhouette`)
      assert.deepEqual(M.MACHINE_SCREENS[`cab_${art}`], M.MACHINE_SCREENS.cab_newgame, `${art}: the master's glass`)
    }
  })

  it('each live screen stands inside its drawing\'s glass', () => {
    const cases = [
      ['cab_newgame', itemOf('cabinet', 'newgame')],
      ['home_terminal', itemOf('terminal')],
      ['login_console', itemOf('console')],
    ]
    for (const art of PLACED) cases.push([`cab_${art}`, itemOf('cabinet', art)])
    for (const [id, it] of cases) {
      const t = M.THING_ART[id]
      // (The glass is one colour; a near-black of the drawing's own may have come out the same.)
      const glassCh = new Set(Object.entries(t.pal).filter(([, c]) => c === '#0c0818').map(([ch]) => ch))
      assert.ok(glassCh.size >= 1, `${id}: the glass colour`)
      for (const ch of glassCh) assert.equal(t.glow[ch] ?? 0, 0, `${id}: the glass itself does not glow (the screen over it does)`)
      it.screens.forEach((sc, i) => {
        const f = M.screenFit(M.MACHINE_SCREENS[id][i], sc.w, sc.h)
        assert.ok(f.S >= 1 && f.sw >= sc.w && f.sh >= sc.h - 1, `${id} screen ${i}: at least the classic's size`)
        assert.ok(f.du <= 0.5 && f.dv <= 0.5, `${id} screen ${i}: no more than a px of each edge goes`)
        for (let j = 0; j < f.sw; j++) {
          const top = Math.ceil(f.r + j / 2 - 1e-9)
          for (let k = 0; k < f.sh; k++) {
            assert.ok(glassCh.has(t.rows[top + k]?.[f.c + j]), `${id} screen ${i}: px (${f.c + j}, ${top + k}) is glass`)
          }
        }
      })
    }
    // The cabinets' screens stand at the classic's doubled px, as the terminals' do.
    assert.equal(M.screenFit(M.MACHINE_SCREENS.cab_newgame[0], 10, 8).S, 2)
    assert.equal(M.screenFit(M.MACHINE_SCREENS.home_terminal[0], 6, 6).S, 2)
  })

  it('each cabinet was drawn from the style the classic painter paints (redraw when a style changes)', () => {
    for (const art of PLACED) {
      assert.equal(M.MACHINE_FROM[`cab_${art}`], styleHash(M.CAB_STYLES[art]), `${art}: its body colours, trim and marquee as drawn`)
    }
  })

  it('packs beside a realm\'s kit, each style painted from the master\'s normals and depth, in the rooms that have machines', () => {
    const props = M.buildProps()
    const atlas = M.withThings(props, M.withMachines(undefined, M.MACHINE_ART))
    for (const [id, t] of Object.entries(M.MACHINE_ART)) {
      const box = atlas.sprites[M.thingKey(id)]
      assert.ok(box && box.w === t.w && box.h === t.h, id)
      // (A painted px carries its depth in the albedo's alpha: none is left at 0 where the drawing has a px.)
      for (let y = 0; y < t.h; y += 7) for (let x = 0; x < t.w; x++) {
        if (t.rows[y][x] === '.') continue
        assert.ok(atlas.albedo[((box.y + y) * atlas.w + box.x + x) * 4 + 3] > 0, `${id} (${x}, ${y})`)
      }
      // The anchor is the ground under the body's middle.
      assert.ok(t.ax > t.w / 3 && t.ax < (t.w * 2) / 3, `${id} ax ${t.ax}`)
    }
    const kit = { other: M.MACHINE_ART.cab_newgame }
    assert.equal(M.withMachines(kit, M.MACHINE_ART), M.withMachines(kit, M.MACHINE_ART), 'the same merged kit, so the atlas is packed once')
    for (const id of ['arcade', 'vip', 'home', 'overworld']) assert.equal(M.hasMachines(M.WORLD.maps[id]), true, id)
    assert.equal(M.hasMachines(M.WORLD.maps.hut), false, 'hut')
  })

  it('the marquee and the coin slots glow; every px has a normal and a depth', () => {
    for (const id of Object.keys(M.MACHINE_ART)) {
      const t = M.THING_ART[id]
      assert.ok(Object.keys(t.glow).length > 0, `${id} glows somewhere`)
      const geo = t.like ? M.THING_ART[t.like] : t
      const deep = Buffer.from(geo.deep, 'base64')
      assert.equal(deep.length, t.w * t.h)
      for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
        if (t.rows[y][x] === '.') continue
        assert.ok(deep[y * t.w + x] > 0, `${id} (${x}, ${y}) has a depth`)
        assert.ok(geo.npal[geo.nrows[y].charCodeAt(x) - 48], `${id} (${x}, ${y}) has a normal`)
      }
    }
  })

  // -------------------------------------------------------------------------------------------- part 26: the square's stalls
  const STALLS = [['kiosk', undefined], ['stall', undefined], ['stall', 'kata']]
  /** The key areas' colour per drawing (build.py's KEY_RGB): the classic painter's live picture stands over them. */
  const KEY = { kiosk: '#12081e', look_roof: '#12081e', look_wall: '#1a2f78', kata_board: '#12081e', kata_pc: '#0b1a10', kata_junkl_0: '#1a1206', kata_junkl_1: '#1a1206' }
  const geoOf = t => (t.like ? M.THING_ART[t.like] : t)
  const qOf = (t, x, y) => { const a = Buffer.from(geoOf(t).deep, 'base64')[y * t.w + x]; return a ? (a - 128) / 4 : 4.8 }

  it('the newsstand and the two stalls name their drawings, their live regions and their people', () => {
    const placed = M.worldExits().filter(e => e.look === 'kiosk' || e.look === 'stall').map(e => `${e.look}:${e.art ?? ''}`).sort()
    assert.deepEqual(placed, ['kiosk:', 'stall:', 'stall:kata'], 'one of each on the square')
    const counts = { kiosk: [1, 1, 0], stall: [5, 2, 2], kata: [9, 3, 2] }
    for (const [look, art] of STALLS) {
      const it = itemOf(look, art)
      const [parts, regions, people] = counts[art ?? look]
      assert.ok(it.box, `${look} keeps its box for the classic turn and with the value off`)
      assert.equal(it.things.length, parts, `${art ?? look}: its drawings`)
      for (const p of it.things) assert.ok(M.hasThing(p.id), `${p.id} is drawn`)
      assert.equal(it.screens.filter(sc => !sc.stand).length, regions, `${art ?? look}: its live regions`)
      assert.equal(it.screens.filter(sc => sc.stand).length, people, `${art ?? look}: its people`)
      assert.equal(!!it.bare, people > 0, `${art ?? look}: a cell of only what lives when it has people`)
      // Every piece stands on a whole scene px: (dx + dy) in scene px is even, so its rows land on the scene's.
      for (const p of it.things) assert.ok(Math.abs(Math.round(((p.dx ?? 0) + (p.dy ?? 0)) * 32) % 2) === 0, `${p.id} stands on a whole px`)
    }
    // The disk light: a lit and an unlit drawing, one px apart, the lit one sharing the other's normals and depth.
    const [d0, d1] = [M.THING_ART.kata_junkl_0, M.THING_ART.kata_junkl_1]
    assert.equal(d1.like, 'kata_junkl_0')
    let diff = 0
    for (let y = 0; y < d0.h; y++) for (let x = 0; x < d0.w; x++) if (d0.pal[d0.rows[y][x]] !== d1.pal[d1.rows[y][x]]) diff++
    assert.equal(diff, 1, 'the disk light is one px of the drawing')
  })

  it('each lit sign, screen and the mirror stands in its key area at the classic\'s doubled px', () => {
    for (const [look, art] of STALLS) {
      const it = itemOf(look, art)
      it.screens.forEach((sc, i) => {
        if (sc.stand) return
        const id = it.things[sc.part ?? 0].id
        const t = M.THING_ART[id]
        const f = M.screenFit(M.MACHINE_SCREENS[id][sc.box ?? i], sc.w, sc.h)
        assert.equal(f.S, 2, `${id} region ${i}: at the classic's doubled px`)
        assert.ok(f.du <= 0.5 && f.dv <= 0.5, `${id} region ${i}: no more than a px of each edge goes`)
        const key = new Set(Object.entries(t.pal).filter(([, c]) => c === KEY[id]).map(([ch]) => ch))
        assert.ok(key.size >= 1, `${id}: its key colour`)
        for (let j = 0; j < f.sw; j++) {
          const top = Math.ceil(f.r + j / 2 - 1e-9)
          for (let k = 0; k < f.sh; k++) assert.ok(key.has(t.rows[top + k]?.[f.c + j]), `${id} region ${i}: px (${f.c + j}, ${top + k}) is the key`)
        }
      })
    }
  })

  it('no px of a stall\'s own drawings stands in front of its live regions (fully visible)', () => {
    for (const [look, art] of STALLS) {
      const it = itemOf(look, art)
      // Each drawing's px on the screen (scene px from the item's point) and how near it is (q, scene px along the sight).
      const drawn = []
      for (const p of it.things) {
        const t = M.THING_ART[p.id]
        const ox = Math.round(((p.dx ?? 0) - (p.dy ?? 0)) * 32) - t.ax
        const oy = Math.round(((p.dx ?? 0) + (p.dy ?? 0)) * 16) - t.ay
        const oq = ((p.dx ?? 0) + (p.dy ?? 0)) * 16
        for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) if (t.rows[y][x] !== '.') drawn.push([x + ox, y + oy, qOf(t, x, y) + oq, p.id])
      }
      it.screens.forEach((sc, i) => {
        if (sc.stand) return
        const p = it.things[sc.part ?? 0]
        const t = M.THING_ART[p.id]
        const f = M.screenFit(M.MACHINE_SCREENS[p.id][sc.box ?? i], sc.w, sc.h)
        const ox = Math.round(((p.dx ?? 0) - (p.dy ?? 0)) * 32) - t.ax
        const oy = Math.round(((p.dx ?? 0) + (p.dy ?? 0)) * 16) - t.ay
        const oq = ((p.dx ?? 0) + (p.dy ?? 0)) * 16
        // (As view.ts: a px nearer than the key at its left and right column, in between along the line.)
        const qL = qOf(t, f.c, Math.round(f.r + f.sh / 2)) + 1
        const qR = qOf(t, f.c + f.sw - 1, Math.round(f.r + (f.sw - 1) / 2 + f.sh / 2)) + 1
        const card = new Map()
        for (let j = 0; j < f.sw; j++) {
          const top = Math.ceil(f.r + j / 2 - 1e-9)
          const q = qL + (f.sw > 1 ? (qR - qL) * j / (f.sw - 1) : 0) + oq
          for (let k = 0; k < f.sh; k++) card.set(`${f.c + j + ox},${top + k + oy}`, q)
        }
        const hiding = drawn.filter(([x, y, q]) => card.has(`${x},${y}`) && q > card.get(`${x},${y}`) + 1e-6)
        assert.equal(hiding.length, 0, `${art ?? look} region ${i} (${p.id}): hidden by ${hiding.slice(0, 5).map(h => h[3] + '@' + h[0] + ',' + h[1]).join(' ')}`)
      })
    }
  })

  it('the people stand behind the counter, in front of the back wall, waist up over its top', () => {
    for (const [look, art] of STALLS.slice(1)) {
      const it = itemOf(look, art)
      const front = it.things[3]
      const back = it.things[0]
      for (const sc of it.screens.filter(sc => sc.stand)) {
        // (scene px: the counter's px run from its anchor forward; the wall's back.)
        const y = -sc.stand.y * 32
        assert.ok(y < (front.dy ?? 0) * 32 - 4, `${art ?? look}: behind the counter`)
        assert.ok(y > (back.dy ?? 0) * 32 + 2, `${art ?? look}: in front of the back wall`)
        assert.ok(Math.abs(sc.stand.z * 32 - 20) < 1e-9, 'the foot just under the counter\'s top (22 px), so no gap shows')
      }
    }
  })

  it('a map packs only the drawings its looks bring', () => {
    assert.equal(M.machineLooks(M.WORLD.maps.overworld), 'kiosk+stall')
    assert.ok(!M.machineLooks(M.WORLD.maps.arcade).includes('stall'))
    const square = M.machineKit('kiosk+stall')
    assert.deepEqual(Object.keys(square).sort(), Object.keys(M.STALL_ART).sort(), 'the town: its stalls, no cabinet')
    assert.ok(Object.keys(M.machineKit('cabinet')).every(id => id.startsWith('cab_')))
    assert.equal(M.machineKit('kiosk+stall'), square, 'the same object, so the atlas is packed once')
    const atlas = M.withThings(M.buildProps(), M.withMachines(undefined, square))
    for (const [id, t] of Object.entries(square)) {
      const box = atlas.sprites[M.thingKey(id)]
      assert.ok(box && box.w === t.w && box.h === t.h, id)
      for (let y = 0; y < t.h; y += 5) for (let x = 0; x < t.w; x++) {
        if (t.rows[y][x] === '.') continue
        assert.ok(atlas.albedo[((box.y + y) * atlas.w + box.x + x) * 4 + 3] > 0, `${id} (${x}, ${y}) has a depth`)
        assert.ok(geoOf(t).npal[geoOf(t).nrows[y].charCodeAt(x) - 48], `${id} (${x}, ${y}) has a normal`)
      }
    }
    assert.ok(atlas.h <= 2048 && atlas.w <= 2048, 'the atlas fits the smallest texture a WebGL2 device promises')
  })
})
