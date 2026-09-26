// Mini World's models (avatar/house agent): every catalog clothing shape,
// hair style, furniture model and weapon part has a builder; furniture
// stays inside its footprint; a dressed person stays within the draw-call
// budget; the house editor only emits layouts the save accepts.
// Bundles the scene modules with esbuild; a tiny canvas stub stands in for
// the DOM (textures are painted into nothing).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const esbuild = require('esbuild')
const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'themes', 'miniworld')

// ---- a canvas that accepts every call
const noop = () => {}
const ctx = new Proxy({}, { get: (_t, k) => (k === 'canvas' ? undefined : noop), set: () => true })
globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx, style: {} }) }

async function load() {
  const out = esbuild.buildSync({
    stdin: {
      contents: [
        `export * as catalog from './catalog'`,
        `export { SHAPE_BUILDERS, HAT_BUILDERS, FACE_BUILDERS } from './scene/clothes'`,
        `export { HAIR, buildAvatar, buildClothingModel } from './scene/avatar'`,
        `export { FURNITURE_MODELS, buildFurniture } from './scene/furniture'`,
        `export { WEAPON_BUILDERS, buildWeaponModel } from './scene/weapons'`,
        `export { createHouse, fixtureBlocked } from './scene/house'`,
        `export { newSave, setLayout } from './core/save'`,
        `export * as THREE from 'three'`,
      ].join('; '),
      resolveDir: root,
      loader: 'ts',
    },
    bundle: true, format: 'esm', write: false, platform: 'neutral', logLevel: 'error',
    mainFields: ['module', 'main'],
  })
  return import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].text).toString('base64'))
}
const M = await load()
const { catalog, THREE } = M
const CELL = 1.5

test('every clothing shape in the catalog has a builder for its slot', () => {
  for (const c of catalog.CLOTHES) assert.ok(M.SHAPE_BUILDERS[c.slot].includes(c.shape), `${c.id}: ${c.slot}/${c.shape}`)
})

test('every hair style has pieces (except none), every furniture model a builder, every weapon base a builder', () => {
  for (const h of catalog.HAIR_STYLES) assert.ok(M.HAIR[h.id], h.id)
  for (const f of catalog.FURNITURE) assert.ok(M.FURNITURE_MODELS.includes(f.model), `${f.id}: ${f.model}`)
  for (const b of catalog.WEAPON_BASES) assert.ok(M.WEAPON_BUILDERS[b.id], b.id)
})

function meshBox(group, filter = () => true) {
  const box = new THREE.Box3()
  group.updateMatrixWorld(true)
  group.traverse((o) => {
    if (!o.isMesh || o.userData.noFrame || !filter(o)) return
    const m = o.material
    if (m.isMeshBasicMaterial && m.transparent) return // light pools and spots may spill over
    o.geometry.computeBoundingBox()
    box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld))
  })
  return box
}

test('furniture builds at every level and stays inside its footprint', () => {
  for (const f of catalog.FURNITURE) {
    for (const level of [1, 2, 3]) {
      const h = M.buildFurniture(f.id, level)
      h.update(0.016, 2)
      const b = meshBox(h.group)
      const W = f.size[0] * CELL, D = f.kind === 'wall' ? 0.6 : f.size[1] * CELL
      const tol = 0.14
      assert.ok(b.min.x >= -tol && b.max.x <= W + tol, `${f.id} L${level} x ${b.min.x.toFixed(2)}..${b.max.x.toFixed(2)} of ${W}`)
      assert.ok(b.min.z >= -tol && b.max.z <= D + tol, `${f.id} L${level} z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)} of ${D}`)
      assert.ok(b.min.y >= -0.05, `${f.id} below the floor`)
      if (f.kind === 'wall') assert.ok(b.min.y > 1 && b.max.y < 3.6, `${f.id} hangs at ${b.min.y.toFixed(2)}..${b.max.y.toFixed(2)}`)
      if (f.surface !== undefined && level === 1) assert.ok(Math.abs(b.max.y - f.surface * CELL) < 0.35 || b.max.y > f.surface * CELL, `${f.id} top ${b.max.y} vs surface ${f.surface * CELL}`)
      assert.ok(h.height > 0)
      if (f.use) assert.ok(h.useAt, `${f.id} has a use point`)
      h.dispose()
    }
  }
})

test('a person in every clothing item builds, within ~20 meshes and 2.6–3.6 units tall', () => {
  const base = { skin: 's2', hair: 'long', hairColor: 'rainbow', eyes: 'big', mouth: 'grin', cheeks: true, outfit: { ...catalog.STARTER_OUTFIT } }
  let most = 0
  for (const c of catalog.CLOTHES) {
    const outfit = { ...base.outfit, [c.slot]: c.id }
    const full = { ...outfit, hat: outfit.hat ?? 'wizard-hat', face: outfit.face ?? 'heart-glasses', back: outfit.back ?? 'fairy-wings' }
    const a = M.buildAvatar({ ...base, outfit: full })
    for (const p of ['idle', 'walk', 'run', 'jump', 'fall', 'sit', 'sleep', 'wave', 'swing', 'dance', 'cheer']) a.animate(p, 1 / 30, 0.5)
    a.setHeld({ uid: 'w', base: 'bow', magic: 'dragon', color: '#ff8ae0', level: 3, name: '' })
    a.animate('idle', 0)
    let meshes = 0
    a.group.traverse((o) => { if (o.isMesh || o.isPoints) meshes++ })
    most = Math.max(most, meshes)
    assert.ok(meshes <= 24, `${c.id}: ${meshes} meshes`)
    assert.ok(a.height >= 2.6 && a.height <= 3.9, `${c.id}: height ${a.height}`)
    const m = a.muzzleWorld(new THREE.Vector3())
    assert.ok(m && Number.isFinite(m.x))
    a.setTag('Åse Ø', 'queen')
    a.dispose()
    const g = M.buildClothingModel(c)
    assert.ok(!g.userData.frame.isEmpty(), `${c.id} preview frame`)
  }
  assert.ok(most >= 10)
})

test('every weapon base × magic × level builds with a muzzle ahead of the grip', () => {
  for (const b of catalog.WEAPON_BASES) for (const m of catalog.WEAPON_MAGIC) for (const level of [1, 2, 3]) {
    const w = M.buildWeaponModel({ uid: 'x', base: b.id, magic: m.id, color: '#4fb8ff', level, name: '' })
    assert.ok(w.muzzle.z > 0.5, `${b.id}/${m.id}`)
    w.dispose()
  }
})

test('the house editor emits only layouts the save accepts, and keeps fixtures clear', () => {
  let save = M.newSave()
  const owned = [...save.furniture]
  catalog.FURNITURE.forEach((f, i) => owned.push({ uid: `t${i}`, id: f.id, level: 1 + (i % 3) }))
  save = { ...save, furniture: owned }
  const house = M.createHouse({ editable: true })
  house.setLayout(save.house, owned)
  house.setEdit(true)
  let placed = 0
  for (const o of owned) {
    const l = house.add(o.uid)
    if (!l) continue
    placed++
    const r = M.setLayout(save, l)
    assert.equal(typeof r, 'object', `add ${o.id} gave a layout the save refused: ${r}`)
    save = r
    for (const it of l.items) {
      const def = catalog.furniture(owned.find(x => x.uid === it.uid).id)
      if (it.uid.startsWith('t')) assert.ok(!M.fixtureBlocked(def, it), `${def.id} on a fixture`)
    }
    const rot = house.rotate()
    if (rot) { const r2 = M.setLayout(save, rot); assert.equal(typeof r2, 'object', `rotate ${o.id}: ${r2}`); save = r2 }
  }
  assert.ok(placed > 20, `placed ${placed}`)
  assert.ok(house.colliders().length > 5)
  for (const u of house.usables()) assert.ok(Number.isFinite(u.at.x) && Number.isFinite(u.yaw))
  house.select(save.house.items[0].uid)
  const after = house.store()
  assert.ok(after && after.items.length < save.house.items.length)
  assert.ok(house.wardrobe.min.x > 0 && house.door.max.z > house.spawn.z)
  house.dispose()
})
