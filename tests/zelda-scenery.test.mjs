// The frontier's solid scenery (IsoLandmark.solid, MapInfo.scenery) is in the
// way in every view, so every view shows something there: the classic painters
// stand a stand-in on each solid tile (render/standIns.ts), the views that tilt
// the classic picture stand it up as a card, and the isometric view puts it
// away only where the realm's own art is drawn.
import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'zelda')
let R

/** A canvas whose 2D context only remembers the rectangles filled on it. */
function fakeCanvas() {
  const rects = []
  const ctx = new Proxy({ rects }, {
    get(t, k) {
      if (k in t) return t[k]
      if (k === 'fillRect') return (x, y, w, h) => rects.push([x, y, w, h])
      if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray((w?.width ?? w) * (h ?? w?.height ?? 1) * 4) })
      if (k === 'measureText') return () => ({ width: 0 })
      return () => {}
    },
    set(t, k, v) { t[k] = v; return true },
  })
  return { width: 1, height: 1, style: {}, getContext: () => ctx }
}

before(async () => {
  globalThis.document ??= { createElement: () => fakeCanvas() }
  const esbuild = createRequire(import.meta.url)('esbuild')
  const out = esbuild.buildSync({
    stdin: {
      contents: `export { createTileLayer } from './render/tiles'; export { standIns, standsIn, standInOf } from './render/standIns'; export { WORLD } from './world/index'; export { createGame, mapInfo } from './engine/index'`,
      resolveDir: root, loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
  })
  R = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
})

const regions = () => {
  const out = []
  for (let ry = 0; ry < 12; ry++) for (let rx = 0; rx < 12; rx++) if (R.WORLD.generate(`fr:${rx},${ry}`)) out.push(`fr:${rx},${ry}`)
  return out
}

/** Pixels filled inside each tile of a painted layer. */
function filled(layer, w) {
  const per = new Map()
  for (const [x, y, rw, rh] of layer.canvas.getContext('2d').rects) {
    for (let ty = Math.floor(y / 16); ty <= Math.floor((y + rh - 1) / 16); ty++) {
      for (let tx = Math.floor(x / 16); tx <= Math.floor((x + rw - 1) / 16); tx++) {
        const i = ty * w + tx
        per.set(i, (per.get(i) ?? 0) + 1)
      }
    }
  }
  return per
}

describe('the frontier\'s solid scenery', () => {
  it('is drawn by the classic painters on every tile it stands on', () => {
    let tiles = 0
    for (const id of regions()) {
      const info = R.mapInfo(R.WORLD, id)
      if (!info.scenery.size) continue
      const m = R.createGame(R.WORLD, { seed: 1, at: { map: id, entry: 'camp' } }).map
      const props = R.standIns(R.WORLD, id)
      assert.deepEqual([...props.keys()].sort(), [...info.scenery].sort(), `${id}: a stand-in for every solid tile`)
      const withProps = filled(R.createTileLayer(R.WORLD, m, 'objects'), m.w)
      const without = filled(R.createTileLayer(R.WORLD, { ...m, scenery: undefined }, 'objects'), m.w)
      for (const i of info.scenery) {
        if (!R.standsIn(m, i)) continue
        tiles++
        assert.ok((withProps.get(i) ?? 0) > (without.get(i) ?? 0), `${id}: nothing drawn at ${i % m.w},${Math.floor(i / m.w)} (${props.get(i)})`)
      }
    }
    assert.ok(tiles > 100, `${tiles} tiles`)
  })

  it('stands in as what it is', () => {
    assert.equal(R.standInOf('quarry_cart_full'), 'crate')
    assert.equal(R.standInOf('rerun_station_wagon'), 'crate')
    assert.equal(R.standInOf('rerun_mailbox'), 'post')
    assert.equal(R.standInOf('quarry_headframe'), 'post')
    assert.equal(R.standInOf('sporelight_mushroom_large_violet'), 'cap')
    assert.equal(R.standInOf('stillsand_island_large'), 'stone')
  })
})
