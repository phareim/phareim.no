#!/usr/bin/env node
// The realm-kit checks of tests/zelda-things.test.mjs, standing on their own (no generated world needed), for a kit
// just baked: every id the kit had keeps its box, every record is whole (rows, nrows, deep for each px), each kit's
// atlas stays <= 2048 px tall, night/day and off/on pairs keep one box, lit variants glow and unlit arches do not,
// and a drawn piece glows only where the bake marked light.
//   node scripts/zelda-lab/codex/kit-check.mjs [<before-data-dir>]   (before: the kits' *Data.ts as they were, for the boxes)
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { buildSync } from 'esbuild'

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const out = buildSync({
  stdin: { contents: `export * from './render/iso/things'; export { THING_ART } from './render/iso/thingArt'; export { buildProps } from './render/iso/props'; export { REALM_ART_LOADERS, loadRealmArt } from './render/iso/frontierArt'`, resolveDir: resolve(repo, 'themes/zelda'), loader: 'ts' },
  bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
})
const M = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
const bytes = b64 => Buffer.from(b64, 'base64')
const before = process.argv[2]
const unpack = f => JSON.parse(gunzipSync(Buffer.from(readFileSync(f, 'utf8').match(/unpackArt<[^>]*>>\("([^"]+)"\)/)[1], 'base64')))
const props = M.buildProps()
const base = M.withThings(props)
let n = 0, drawn = 0
for (const realm of Object.keys(M.REALM_ART_LOADERS)) {
  const art = await M.loadRealmArt(realm)
  const atlas = M.withThings(props, art)
  assert.ok(atlas.h <= 2048, `${realm} atlas: ${atlas.h}px tall`)
  for (const [id, t] of Object.entries(art)) {
    const box = atlas.sprites[M.thingKey(id)]
    assert.ok(box && box.y >= base.h, id)
    assert.equal(t.rows.length, t.h, id); assert.equal(t.nrows.length, t.h, id)
    assert.equal(bytes(t.deep).length, t.w * t.h, id)
    const deep = bytes(t.deep)
    for (let y = 0; y < t.h; y++) for (let x = 0; x < t.w; x++) {
      const ch = t.rows[y][x]; if (ch === '.') continue
      assert.ok(t.pal[ch], `${id}: ${ch}`)
      assert.ok(t.npal[t.nrows[y].charCodeAt(x) - 48], `${id}: normal at ${x},${y}`)
      assert.ok(deep[y * t.w + x] > 0, `${id}: depth at ${x},${y}`)
    }
    for (const v of Object.values(t.glow)) assert.ok(v > 0 && v <= 1, id)
    if (t.drawn) drawn++
    n++
  }
  console.log(`${realm}: ${Object.keys(art).length} pieces, atlas ${atlas.w}x${atlas.h}`)
}
// Boxes against the kits as they were.
// (Pieces added since: the gold pyramid, round 3.)
const ADDED = new Set(['stillsand_pyramid'])
if (before) for (const f of ['seter', 'meadow', 'gates', 'fjord', 'sporelight', 'quarry', 'stillsand', 'roadside', 'rerun', 'fogstage', 'underglow', 'coast', 'landing']) {
  const was = resolve(before, `${f}Data.ts`); if (!existsSync(was)) continue
  const a = unpack(was), b = unpack(resolve(repo, `themes/zelda/render/iso/frontierArt/${f}Data.ts`))
  assert.deepEqual(Object.keys(b).filter(id => !ADDED.has(id) || id in a), Object.keys(a), `${f}: ids`)
  for (const id of Object.keys(a)) assert.deepEqual([b[id].w, b[id].h, b[id].ax, b[id].ay], [a[id].w, a[id].h, a[id].ax, a[id].ay], `${f}: ${id} box`)
  console.log(`${f}: all ${Object.keys(a).length} ids kept with their w, h, ax, ay`)
}
// Pairs (as the things test pairs them).
const kit = async r => M.loadRealmArt(r)
const glow = t => t.rows.reduce((s, row) => s + [...row].reduce((q, p) => q + (t.glow[p] ?? 0), 0), 0)
const seter = await kit('seterfell')
for (const [d, nn] of [['seter_hut_0', 'seter_hut_night_0'], ['seter_hut_1', 'seter_hut_night_1']]) {
  const a = seter[d], b = seter[nn]
  assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], nn); assert.notDeepEqual(a.pal, b.pal, nn); assert.ok(glow(b) > 0, nn)
}
for (const realm of ['seterfell', 'sporelight', 'stillsand', 'rerun', 'lumenby', 'fogstage']) {
  const k = await kit(realm)
  for (const road of ['ns', 'ew']) {
    const off = k[`gate_${realm}_${road}_off`], on = k[`gate_${realm}_${road}_on`]
    assert.deepEqual([off.w, off.h, off.ax, off.ay], [on.w, on.h, on.ax, on.ay], realm)
    assert.deepEqual(off.glow, {}, `${realm} ${road} off glows`); assert.ok(Object.keys(on.glow).length > 0, `${realm} ${road} on`)
  }
}
const fjord = await kit('yulefjord')
{ const a = fjord.fjord_cottage, b = fjord.fjord_cottage_night
  assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], 'cottage night'); assert.notDeepEqual(a.pal, b.pal); assert.ok(glow(b) > 0) }
for (const [stem, count] of [['fjord_lighthouse_lens', 4]]) {
  const frames = Array.from({ length: count }, (_, i) => fjord[`${stem}_${i}`])
  assert.ok(frames.every(t => glow(t) > 0), stem)
  assert.equal(new Set(frames.map(t => JSON.stringify([t.rows, t.pal, t.glow]))).size, count, stem)
}
for (const [stem, count] of [['fjord_lighthouse', 4]]) {   // the beam turns: four frames, each its own
  const frames = Array.from({ length: count }, (_, i) => fjord[`${stem}_${i}`])
  assert.ok(frames.every(t => glow(t) > 0), stem)
  assert.equal(new Set(frames.map(t => JSON.stringify([t.rows, t.pal, t.glow]))).size, count, stem)
}
const spore = await kit('sporelight')
{ const a = spore.sporelight_bathhouse, b = spore.sporelight_bathhouse_night
  assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], 'bathhouse night'); assert.ok(glow(b) > glow(a), 'the bathhouse is brighter at night') }
for (const f of [0, 1]) {
  const a = spore[`sporelight_grazer_calm_${f}`], b = spore[`sporelight_grazer_angry_${f}`]
  assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], `grazer ${f}`); assert.notDeepEqual(a.pal, b.pal, `grazer ${f}: angry differs`)
}
const lumenby = await kit('lumenby')
for (const l of 'lumenby') {
  const off = lumenby[`quarry_letter_${l}_off`], on = lumenby[`quarry_letter_${l}_on`]
  assert.deepEqual([off.w, off.h, off.ax, off.ay], [on.w, on.h, on.ax, on.ay], `letter ${l}`)
  assert.ok(glow(on) > glow(off), `letter ${l}: on is lit`)
  if (on.drawn) assert.deepEqual(off.glow, {}, `letter ${l}: off glows`)
}
// Round 3: the road lanterns (always loaded, in THING_ART), Rerun's houses by night, the waymarks' blink frames.
const things = M.THING_ART ?? {}
for (const tone of ['pink', 'cyan', 'violet', 'gold', 'rose']) {
  const off = things[`road_lantern_${tone}_off`], on = things[`road_lantern_${tone}_on`]
  if (!off || !on) continue
  assert.deepEqual([off.w, off.h, off.ax, off.ay], [on.w, on.h, on.ax, on.ay], `lantern ${tone}`)
  assert.ok(glow(on) > glow(off), `lantern ${tone}: on is lit`)
  if (off.drawn) assert.deepEqual(off.glow, {}, `lantern ${tone}: off glows`)
}
const rerun = await kit('rerun')
for (const h of ['0', '1', '1958', '1986', '2086']) {
  const a = rerun[`rerun_house_${h}`], b = rerun[`rerun_house_${h}_night`]
  assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], `house ${h} night`); if (b.drawn) assert.ok(glow(b) > glow(a), `house ${h}: brighter at night`)
}
const coast = await kit('coast')
for (const w of ['lumenby_n', 'seterfell_n', 'sporelight_n', 'stillsand_e', 'fogstage_w', 'rerun_e']) {
  const a = coast[`waymark_${w}_0`], b = coast[`waymark_${w}_1`]
  assert.deepEqual([a.w, a.h, a.ax, a.ay], [b.w, b.h, b.ax, b.ay], `waymark ${w}`)
  assert.notDeepEqual(JSON.stringify([a.rows, a.pal, a.glow]), JSON.stringify([b.rows, b.pal, b.glow]), `waymark ${w}: the two frames differ`)
}
const meadow = await kit('meadow')
const mills = [0, 1, 2, 3].map(i => meadow[`meadow_mill_${i}`])
assert.equal(new Set(mills.map(t => JSON.stringify(t.rows))).size, 4, 'the mill\'s four frames differ')
console.log(`ok: ${n} kit pieces whole, ${drawn} drawn by Codex; night/day, off/on pairs and the mill's frames as they must be`)
