// Old saves: the shapes earlier builds wrote (`zelda-old-saves.json`, one entry a shape, with `variants` laid over it),
// each read by the game of today, played for a second and saved again. A player's save must load after any update, and
// keep what the player had. A change that drops or renames something a save holds adds its old shape here.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { load } from './zelda-load.mjs'
import { walker } from './zelda-walk.mjs'

const OLD = JSON.parse(readFileSync(new URL('./zelda-old-saves.json', import.meta.url), 'utf8'))

let Z
/** The shell's bridge to the site wallet, which took the saves' bits in (`themes/zelda/wallet.ts`). */
let W
before(async () => {
  Z = await load()
  const out = createRequire(import.meta.url)('esbuild').buildSync({
    stdin: { contents: `export { migrateSaveBits } from './wallet'`, resolveDir: fileURLToPath(new URL('../themes/zelda', import.meta.url)), loader: 'ts' },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  W = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const copy = o => JSON.parse(JSON.stringify(o))

/** An entry's save, and each of its variants laid over it (`inv` merged, a null there left out; `drop` takes fields away). */
function shapes({ id, save, variants = [] }) {
  return [{ id, name: id, save, want: undefined }, ...variants.map(({ name, inv, drop = [], want, ...top }, n) => {
    const s = { ...copy(save), ...top, inv: { ...save.inv, ...inv } }
    for (const [k, v] of Object.entries(inv ?? {})) if (v === null && k !== 'selected') delete s.inv[k]
    for (const k of drop) delete s.inv[k]
    return { id, name: `${id}: ${name ?? JSON.stringify(inv ?? top)}`, save: s, want }
  })]
}

/** What each shape's player must still have. `read`: as `parseSave` gave it; `s`: the game after its second; `again`: its next save. */
const KEPT = {
  'before-the-wildwood': ({ read, s }) => {
    assert.deepEqual([read.inv.hook, read.inv.arc, read.inv.bigBag, read.inv.shrooms, read.inv.keyrings], [false, false, false, 0, {}], 'the new things at their defaults')
    assert.deepEqual([s.entry.entry, s.inv.sword, s.flags['chest:ow.sword']], ['hut', true, true])
  },
  arena: ({ read, s, again }) => {
    assert.ok(!('tonics' in read.inv) && !('tonics' in again.inv), 'the tonics are gone')
    assert.deepEqual([s.map.id, s.entry.entry, s.inv.sword, s.inv.bombs], ['sporelight', 'from-arena', true, 4])
    assert.ok(Z.awayMap(Z.WORLD, 'arena', 'start'), 'a reload knows it is out there')
  },
  'four-arts': ({ read, s, name }) => {
    if (name.includes('never')) {
      assert.deepEqual([read.inv.selected, read.inv.arts], [null, undefined], 'nothing in hand')
      return
    }
    assert.deepEqual([read.inv.arts, read.inv.selected, read.inv.moves], [['hop'], 'hop', { flip: 3 }], 'the HOP, in hand where an art was; the counts kept')
    assert.ok(read.flags.includes('item:artHop'), 'the Keeper would teach it again')
    assert.deepEqual(Z.useItems(s), ['hop'])
  },
  hop: ({ read, again }) => {
    assert.deepEqual([read.inv.selected, read.inv.arts], ['hop', ['hop']])
    assert.equal(again.flags.filter(f => f === 'item:artHop').length, 1)
  },
  frontier: ({ s, save, want }) => {
    const [map, entry] = want ?? ['seterfell', 'gate-fell']
    assert.deepEqual([s.entry.map, s.entry.entry], [map, entry], 'in the land that took its place')
    assert.deepEqual([s.inv.sword, s.flags['chest:fr:7,2.c0'], s.flags['q.seed.heard']], [true, true, true], 'items and flags kept')
    if (save.map.startsWith('fr:')) assert.equal(Z.awayMap(Z.WORLD, save.map, save.entry), !!Z.WORLD.maps[map].away, 'a reload knows where it is')
  },
  'dig-and-build': ({ read, s, save }) => {
    assert.equal(read.inv.selected, null, 'the tools put away')
    assert.ok(!('mats' in read.inv) && !('build' in read.inv) && !('dig' in read), 'edits and materials dropped')
    assert.deepEqual([read.inv.hook, s.flags['item:shovel']], [true, true], 'the rest kept, the old flags harmless')
    assert.deepEqual([s.map.id, s.entry.entry], ['lumenby', 'pit'])
    assert.equal(s.map.terrain.h[37 * s.map.w + 2], 4, 'the map as authored')
    assert.deepEqual(Z.useItems(s), ['hook'])
  },
  'heart-piece-key': ({ s }) => {
    // Gunn still owes the sign's piece.
    walker(Z).talkTo(s, 'q.gunn')
    assert.equal(s.inv.pieces, 1)
    assert.ok(s.flags['got:q.gunn:heartPiece:q.lumenby.sign.done'])
  },
  'bits-in-the-save': ({ read }) => {
    const store = () => { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)) } }
    let bits = 50
    const wallet = { read: () => bits, add: d => (bits += d) }
    const mine = store()
    assert.equal(W.migrateSaveBits(read, mine, wallet), 123)
    assert.equal(W.migrateSaveBits(read, mine, wallet), 0, 'once')
    assert.equal(bits, 173)
    // A browser that had no save when the wallet came: a save that turns up later is past the move.
    const later = store()
    assert.equal(W.migrateSaveBits(null, later, wallet) + W.migrateSaveBits(read, later, wallet), 0)
    assert.equal(bits, 173)
  },
  'unknown-item': ({ read, s, save }) => {
    assert.equal(read.inv.selected, null, 'nothing in hand')
    assert.deepEqual([read.inv.hook, read.inv.disc, read.flags], [true, true, save.flags], 'the rest kept')
    assert.ok(Z.stepGame(Z.WORLD, s, 1 / 60, { ...Z.NO_INPUT, bPress: true }).some(e => e.type === 'error'), 'B with nothing in hand buzzes')
  },
  'chart-and-clock': ({ read, s, again, save }) => {
    assert.deepEqual([read.inv.pieces, read.day, read.explored, read.savedAt], [2, save.day, save.explored, save.savedAt])
    assert.ok(s.daytime >= save.day && s.daytime < save.day + 2, `the hour goes on: ${s.daytime}`)
    assert.ok(again.explored.wildwood.length >= save.explored.wildwood.length, 'the chart is saved on')
  },
  'duck-chest-paid-bits': ({ s }) => {
    assert.ok(!s.inv.duck, 'not before the room')
    // Into the Staff Room, by its west door: the Duck is handed over, with its words.
    const w = walker(Z)
    for (let k = 0; k < 900 && s.mode !== 'get'; k++) {
      const room = s.zone.x === 48
      Z.stepGame(Z.WORLD, s, 1 / 60, { ...Z.NO_INPUT, move: { x: room ? 0 : 1, y: !room && s.hero.x < 46 ? Math.sign(17.5 - s.hero.y) : 0 } })
    }
    assert.equal(s.get?.text[0], 'YOU GOT THE DUCK!')
    w.settle(s)
    assert.deepEqual([s.inv.duck, s.inv.selected], [true, 'duck'])
    // Once: walking out and in again gives nothing more.
    w.walkTo(s, 44, 17)
    w.walkTo(s, 51, 17)
    assert.deepEqual([s.mode, Z.parseSave(copy(Z.toSave(s))).inv.duck], ['play', true])
  },
  'winner-without-an-hour': ({ s, save }) => {
    // The day starts at dusk, and stands still for whoever has no Prism.
    if (save.inv.prism) assert.ok(s.daytime >= 0 && s.daytime < 2, `${s.daytime}`)
    else assert.equal(s.daytime, null)
  },
}

describe('old saves', () => {
  it('every old shape loads, plays a second and saves again, keeping what the player had', () => {
    assert.deepEqual(OLD.map(c => c.id).sort(), Object.keys(KEPT).sort(), 'every shape has its check')
    for (const entry of OLD) {
      for (const { id, name, save, want } of shapes(entry)) {
        const read = Z.parseSave(copy(save))
        assert.ok(read, `${name}: refused`)
        assert.deepEqual([read.maxHp, read.elapsed], [save.maxHp, save.elapsed], `${name}: heart containers and time played`)
        const s = Z.createGame(Z.WORLD, { save: read })
        for (let f = 0; f < 60; f++) Z.stepGame(Z.WORLD, s, 1 / 60, { ...Z.NO_INPUT })
        const again = Z.parseSave(copy(Z.toSave(s)))
        assert.ok(again, `${name}: its next save is refused`)
        assert.deepEqual([again.map, again.flags.length >= read.flags.length], [s.entry.map, true], `${name}: saved again`)
        try { KEPT[id]({ read, s, again, save, want, name }) } catch (e) { e.message = `${name}: ${e.message}`; throw e }
      }
    }
  })
})
