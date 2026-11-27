// Neon Shrine's machines and stalls drawn by hand for the isometric view (render/iso/machines.ts; their art the
// `machines` and `stalls` packs, packed beside a realm's kit by things.ts): every cabinet, terminal, console,
// newsstand and stall placed in the world has a drawing, its live screens stand on the drawing's glass or key colour,
// each cabinet was drawn from the style the classic painter still paints, and the maps that have them pack one atlas.
// Bundled with esbuild like the other zelda tests; no canvas is made here. The packs come from the .art-cache
// (tests/helpers/art.mjs, `npm run art:pull`).
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { installArtFetch, kitTable } from './helpers/art.mjs'

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
  installArtFetch()
  const mod = await load()
  // (The art is fetched as the view does: `kit` is the game's, its pieces rects of the decoded packs. The same packs
  // unpacked to rows and palettes stand in for THING_ART below.)
  const kit = await mod.loadMachineArt()
  const table = { ...(await kitTable('machines')), ...(await kitTable('stalls')) }
  assert.deepEqual(Object.keys(kit).sort(), Object.keys(table).sort())
  // (Part 25's machines, and part 26's newsstand and stalls, a pack of their own.)
  const part25 = id => id.startsWith('cab_') || id === 'home_terminal' || id === 'login_console'
  const pick = (from, f) => Object.fromEntries(Object.entries(from).filter(([id]) => f(id)))
  M = { ...mod, KIT: kit, MACHINE_KIT: pick(kit, part25), MACHINE_ART: pick(table, part25), STALL_ART: pick(table, id => !part25(id)), THING_ART: table, hasThing: id => Object.prototype.hasOwnProperty.call(kit, id) }
})

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

/** Every machine and stall the world places. */
const placed = () => M.worldExits().filter(e => ['cabinet', 'terminal', 'console', 'kiosk', 'stall'].includes(e.look))
/** The key areas' colour per stall drawing (build.py's KEY_RGB): the classic painter's live picture stands over them. */
const KEY = { kiosk: '#12081e', look_roof: '#12081e', look_wall: '#1a2f78', kata_board: '#12081e', kata_pc: '#0b1a10', kata_junkl_0: '#1a1206', kata_junkl_1: '#1a1206' }
/** A machine's glass is one colour. */
const GLASS = '#0c0818'

describe('zelda machines drawn by hand', () => {
  it('every machine and stall placed in the world has its drawings and a live region, and keeps its classic box', () => {
    const looks = new Set(placed().map(e => e.look))
    assert.equal(looks.size, 5, [...looks].join(' '))
    for (const e of placed()) {
      const it = itemOf(e.look, e.art)
      assert.ok(it.box, `${e.look} ${e.art ?? ''} keeps its box for the classic turn`)
      assert.ok(it.things?.length >= 1)
      for (const p of it.things) assert.ok(M.hasThing(p.id), `${p.id} is drawn`)
      assert.ok(it.screens?.some(sc => !sc.stand), `${e.look} ${e.art ?? ''} names its live screen`)
    }
  })

  it('every live screen stands on its drawing\'s glass, or its stall\'s key colour, at the classic\'s doubled px', () => {
    for (const e of placed()) {
      const it = itemOf(e.look, e.art)
      it.screens.forEach((sc, i) => {
        if (sc.stand) return
        const id = it.things[sc.part ?? 0].id
        const t = M.THING_ART[id]
        const f = M.screenFit(M.MACHINE_SCREENS[id][sc.box ?? i], sc.w, sc.h)
        const where = `${id} screen ${i}`
        assert.ok(f.S >= 1 && f.sw >= sc.w && f.sh >= sc.h - 1, `${where}: at least the classic's size`)
        assert.ok(f.du <= 0.5 && f.dv <= 0.5, `${where}: no more than a px of each edge goes`)
        const colour = KEY[id] ?? GLASS
        const glass = new Set(Object.entries(t.pal).filter(([, c]) => c === colour).map(([ch]) => ch))
        assert.ok(glass.size >= 1, `${where}: the glass colour`)
        for (let j = 0; j < f.sw; j++) {
          const top = Math.ceil(f.r + j / 2 - 1e-9)
          for (let k = 0; k < f.sh; k++) if (!glass.has(t.rows[top + k]?.[f.c + j])) assert.fail(`${where}: px (${f.c + j}, ${top + k}) is not glass`)
        }
      })
    }
  })

  it('each cabinet was drawn from the style the classic painter paints (redraw when a style changes)', () => {
    const cabs = placed().filter(e => e.look === 'cabinet').map(e => e.art)
    assert.ok(cabs.length > 10)
    for (const art of cabs) assert.equal(M.MACHINE_FROM[`cab_${art}`], styleHash(M.CAB_STYLES[art]), `${art}: its body colours, trim and marquee as drawn`)
  })

  it('packs only the drawings a map\'s looks bring, beside its kit, in one atlas that fits the smallest texture', () => {
    assert.equal(M.hasMachines(M.WORLD.maps.hut), false, 'hut')
    assert.ok(!M.machineLooks(M.WORLD.maps.arcade).includes('stall'))
    for (const id of ['overworld', 'arcade', 'vip', 'home']) {
      assert.equal(M.hasMachines(M.WORLD.maps[id]), true, id)
      const kit = M.machineKit(M.machineLooks(M.WORLD.maps[id]))
      assert.equal(M.machineKit(M.machineLooks(M.WORLD.maps[id])), kit, `${id}: the same object, so the atlas is packed once`)
      const atlas = M.withThings(M.buildProps(), M.withMachines(undefined, kit))
      assert.ok(atlas.h <= 2048 && atlas.w <= 2048, `${id}: ${atlas.w}×${atlas.h}`)
      for (const name of Object.keys(kit)) {
        const t = M.THING_ART[name]
        const box = atlas.sprites[M.thingKey(name)]
        assert.ok(box && box.w === t.w && box.h === t.h, `${id}: ${name}`)
        // (A painted px carries its depth in the albedo's alpha: none is left at 0 where the drawing has a px.)
        for (let y = 0; y < t.h; y += 7) for (let x = 0; x < t.w; x++) {
          if (t.rows[y][x] !== '.' && !(atlas.albedo[((box.y + y) * atlas.w + box.x + x) * 4 + 3] > 0)) assert.fail(`${id}: ${name} (${x}, ${y}) has no depth`)
        }
      }
    }
    assert.deepEqual(Object.keys(M.machineKit('kiosk+stall')).sort(), Object.keys(M.STALL_ART).sort(), 'the town: its stalls, no cabinet')
  })
})
