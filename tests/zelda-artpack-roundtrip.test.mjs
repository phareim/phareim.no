// Neon Shrine's iso art packs (scripts/zelda-lab/lib/artpack.mjs, decoded by themes/zelda/render/iso/artPng.ts): a
// table packed, decoded, unpacked and packed again keeps every px; the PNG writer keeps the colour of a px however low
// its alpha (the alpha is depth and glow here), writes no ancillary chunk and the same bytes twice; the decoder reads
// all five row filters and refuses what the packer never writes. No network.
import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { deflateSync } from 'node:zlib'
import { decodePng, encodePng, packFiles, packTable, readPack, samePixels, unpackTable } from '../scripts/zelda-lab/lib/artpack.mjs'
import { GROUPS, legacyTable } from '../scripts/zelda-lab/lib/artgroups.mjs'
import { readPins } from './helpers/art.mjs'
import { cachedBytes } from '../scripts/zelda-lab/lib/artcache.mjs'

/** A small table: two pieces, one a `like` frame of the other, with glow, depth 0 at a drawn px and a clear px. */
function sample() {
  const deep = Buffer.from([0, 130, 140, 150, 160, 170]).toString('base64')
  return {
    b_lamp: { w: 3, h: 2, ax: 1, ay: 1, pal: { a: '#ff0000', b: '#00ff7f', c: '#0a0b0c' }, glow: { b: 0.5 }, rows: ['ab.', 'cca'], nrows: ['01.', '220'], npal: ['#8080ff', '#80ff80', '#ff8080'], deep },
    a_lamp_on: { w: 3, h: 2, ax: 1, ay: 1, src: { lamp: 'abcd1234' }, pal: { x: '#ffffff', y: '#00ff7f', z: '#0a0b0c' }, glow: { x: 1, y: 0.25 }, rows: ['xy.', 'zzx'], like: 'b_lamp' },
    c_wide: { w: 5, h: 1, ax: 2, ay: 0, pal: { q: '#123456' }, glow: {}, rows: ['q.q.q'], nrows: ['0.0.0'], npal: ['#7f7fff'], deep: Buffer.from([200, 0, 201, 0, 202]).toString('base64'), drawn: 'sheet x try 1' },
  }
}

const decoded = (group, table) => {
  const pack = packTable(table)
  const files = packFiles(group, pack)
  return { pack, files, back: readPack(files.albedo.bytes, files.normal.bytes, JSON.parse(files.index.bytes)) }
}

describe('zelda art packs: round trip', () => {
  it('table -> pack -> table -> pack keeps every px, the anchors, src and drawn', () => {
    const { pack, back } = decoded('sample', sample())
    const again = packTable(unpackTable(back))
    assert.deepEqual(Object.keys(again.pieces), Object.keys(pack.pieces), 'the table\'s order')
    for (const [id, p] of Object.entries(pack.pieces)) {
      assert.ok(samePixels(pack, p, again, again.pieces[id]), id)
      assert.deepEqual(again.pieces[id], p, `${id}: rect, anchor, src, drawn`)
    }
    // (A drawn px at depth 0 is stored at 1, so it is never clear; a clear px is 0 in all eight bytes.)
    const t = unpackTable(back)
    assert.equal(Buffer.from(t.b_lamp.deep, 'base64')[0], 1)
    assert.equal(t.b_lamp.rows[0][2], '.')
    assert.equal(t.a_lamp_on.like, undefined, 'a like frame comes back with its own normals and depth')
    assert.deepEqual(t.a_lamp_on.npal.length, 3)
    assert.equal(t.a_lamp_on.glow[t.a_lamp_on.rows[0][0]], 1)
  })

  it('packs in sorted-id order and keeps the table\'s order in the index', () => {
    const { pack } = decoded('sample', sample())
    assert.deepEqual(Object.keys(pack.pieces), ['b_lamp', 'a_lamp_on', 'c_wide'])
    const ids = Object.keys(pack.pieces).sort()
    const pos = ids.map(id => pack.pieces[id].y * 10000 + pack.pieces[id].x)
    assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'the shelves follow the sorted ids')
  })

  it('round-trips a real pack of today (every group whose table this tree or git can show)', () => {
    let n = 0
    for (const group of GROUPS) {
      const table = legacyTable(group)
      if (!table) continue
      const { pack, back } = decoded(group, table)
      const again = packTable(unpackTable(back))
      for (const [id, p] of Object.entries(pack.pieces)) assert.ok(samePixels(pack, p, again, again.pieces[id]), `${group}: ${id}`)
      n++
      if (n >= 3) break
    }
    if (!n) {
      // (With the TS gone and no git, the pinned packs stand in, once the cache has them.)
      const pins = readPins()
      for (const [group, pin] of Object.entries(pins.PACKS)) {
        const a = cachedBytes(pin.albedo), b = cachedBytes(pin.normal), i = pin.index && cachedBytes(pin.index)
        if (!a || !b || !i) continue
        const pack = readPack(a, b, JSON.parse(i))
        const again = packTable(unpackTable(pack))
        for (const [id, p] of Object.entries(pack.pieces)) assert.ok(samePixels(pack, p, again, again.pieces[id]), `${group}: ${id}`)
        n++
      }
    }
    assert.ok(n > 0, 'some real table to round-trip')
  })

  it('writes the same bytes twice, and only IHDR, IDAT and IEND', () => {
    const a = packFiles('sample', packTable(sample()))
    const b = packFiles('sample', packTable(sample()))
    for (const k of ['albedo', 'normal', 'index']) assert.equal(a[k].sha256, b[k].sha256, k)
    const png = a.albedo.bytes
    const types = []
    for (let o = 8; o < png.length;) { const len = png.readUInt32BE(o); types.push(png.toString('latin1', o + 4, o + 8)); o += 12 + len }
    assert.deepEqual(types, ['IHDR', 'IDAT', 'IEND'])
    assert.deepEqual([png[24], png[25], png[26], png[27], png[28]], [8, 6, 0, 0, 0], '8-bit RGBA, not interlaced')
  })

  it('keeps the rgb of a px at alpha 1 to 8 (no premultiplying, no zeroing), with every filter', () => {
    const w = 16, h = 9
    const px = new Uint8Array(w * h * 4)
    for (let i = 0; i < w * h; i++) { px[i * 4] = (i * 37) & 255; px[i * 4 + 1] = (i * 91 + 7) & 255; px[i * 4 + 2] = 255 - (i & 255); px[i * 4 + 3] = 1 + (i % 8) }
    for (const filter of [undefined, 0, 1, 2, 3, 4]) {
      const back = decodePng(encodePng(w, h, px, { filter }))
      assert.equal(back.w, w); assert.equal(back.h, h)
      assert.deepEqual(Buffer.from(back.data), Buffer.from(px), `filter ${filter ?? 'best'}`)
    }
  })

  it('refuses a PNG that is not 8-bit RGBA, an interlaced one, and a broken one', () => {
    const good = encodePng(2, 2, new Uint8Array(16).fill(9))
    const withIhdr = (patch) => {
      const b = Buffer.from(good)
      patch(b)
      // (The decoder does not check CRCs; zlib's own check covers the image data.)
      return b
    }
    assert.throws(() => decodePng(withIhdr(b => { b[25] = 2 })), /RGBA/)
    assert.throws(() => decodePng(withIhdr(b => { b[24] = 16 })), /RGBA/)
    assert.throws(() => decodePng(withIhdr(b => { b[28] = 1 })), /interlaced/)
    assert.throws(() => decodePng(Buffer.from('not a png')), /not a PNG/)
    assert.throws(() => decodePng(good.subarray(0, good.length - 12)), /IEND/)
    // A bad row filter byte.
    const raw = Buffer.alloc(2 * 9); raw[0] = 7
    const z = deflateSync(raw)
    const ihdr = good.subarray(8, 33)
    const len = Buffer.alloc(4); len.writeUInt32BE(z.length)
    const bad = Buffer.concat([good.subarray(0, 8), ihdr, len, Buffer.from('IDAT'), z, Buffer.alloc(4), good.subarray(good.length - 12)])
    assert.throws(() => decodePng(bad), /row filter 7/)
  })
})
