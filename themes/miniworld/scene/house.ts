/**
 * Mini World's house (avatar/house agent): one room of HOUSE_W × HOUSE_D
 * cells of CELL units, origin at the floor's min corner, the back wall at
 * z 0 and the door in the front wall. Walls are dollhouse walls: the ones
 * between the camera and the room hide themselves (with what hangs on
 * them), so the room is always open to the viewer.
 *
 * Fixtures (not in the save): the door (front wall, slot 1, the cell in
 * front kept free), a built-in wardrobe (right wall, slots 1–2, the cells
 * in front kept free) and two windows with daylight (left wall slots 3–4,
 * right wall slots 5–6). Placement rules are core/save.ts's `canPlace`
 * plus these fixtures, so every layout this file emits passes
 * `setLayout` in the save.
 *
 * Wall slots: `x` runs along +x on the back (0) and front (2) walls and
 * along +z on the right (1) and left (3) walls.
 *
 * Edit mode ("Pynt"): a cell grid, a chunky selection box, drag to move
 * (snapped, rotation-aware, red and refused where it cannot stand), small
 * things snap onto tables and shelves, wall things slide along the walls.
 * Pointer contract with the runtime: `pointer('down')` returns `{}` when a
 * drag starts on the selected item (do not orbit the camera), null
 * otherwise; `up` returns `{ select }` for a tap and `{ layout }` after a
 * move.
 */
import * as THREE from 'three'
import type { CreateHouse, HouseHandle } from './contracts'
import { CELL } from './contracts'
import type { HouseLayout, OwnedFurniture, PlacedItem, FurnitureDef } from '../types'
import { HOUSE_W, HOUSE_D } from '../types'
import { furniture as furnitureDef, floorDef, wallDef, FLOORS, WALLS, STARTER_FLOOR, STARTER_WALL } from '../catalog'
import { canPlace, placeItem, storeItem, footprint, wallLength, type HouseState } from '../core/save'
import { buildFurniture, type FurnitureModelHandle } from './furniture'
import { Kit, basicMaterial, textureMaterial, disposeTree, darken } from './meshkit'
import { floorTexture, wallTexture } from './textures'

export const WALL_H = 3.6
const RW = HOUSE_W * CELL
const RD = HOUSE_D * CELL

/** Fixture slots on each wall (wall rot → blocked slot indices). */
const WALL_BLOCK: Record<number, number[]> = { 0: [], 1: [1, 2, 5, 6], 2: [1], 3: [3, 4] }
/** Floor cells kept free in front of the door and the wardrobe. */
const FLOOR_BLOCK = [[1, HOUSE_D - 1], [HOUSE_W - 1, 1], [HOUSE_W - 1, 2]] as const

export const DOOR_SLOT = 1
export const WARDROBE_SLOTS = [1, 2] as const

/** True when a placement touches a fixture (the save's rules do not know them). */
export function fixtureBlocked(def: FurnitureDef, p: PlacedItem): boolean {
  const fp = footprint(def, p)
  if (def.kind === 'wall') {
    for (const s of WALL_BLOCK[p.rot] ?? []) if (s >= fp.x && s < fp.x + fp.w) return true
    return false
  }
  if (def.kind === 'rug' || p.on) return false
  for (const [x, z] of FLOOR_BLOCK) if (x >= fp.x && x < fp.x + fp.w && z >= fp.z && z < fp.z + fp.d) return true
  return false
}

interface Item {
  uid: string
  def: FurnitureDef
  level: 1 | 2 | 3
  handle: FurnitureModelHandle
  pivot: THREE.Group
  placed: PlacedItem
}

/** World transform of a placement: pivot position and y rotation. */
function placementTransform(def: FurnitureDef, p: PlacedItem, surfaceY: number): { pos: THREE.Vector3; rotY: number; offset: THREE.Vector3 } {
  const [sx, sz] = def.size
  if (def.kind === 'wall') {
    const w = sx * CELL
    const x0 = p.x * CELL
    switch (p.rot) {
      case 0: return { pos: new THREE.Vector3(x0, 0, 0), rotY: 0, offset: new THREE.Vector3() }
      case 2: return { pos: new THREE.Vector3(x0 + w, 0, RD), rotY: Math.PI, offset: new THREE.Vector3() }
      case 3: return { pos: new THREE.Vector3(0, 0, x0 + w), rotY: Math.PI / 2, offset: new THREE.Vector3() }
      default: return { pos: new THREE.Vector3(RW, 0, x0), rotY: -Math.PI / 2, offset: new THREE.Vector3() }
    }
  }
  const fp = footprint(def, p)
  return {
    pos: new THREE.Vector3((fp.x + fp.w / 2) * CELL, surfaceY, (fp.z + fp.d / 2) * CELL),
    rotY: -p.rot * Math.PI / 2,
    offset: new THREE.Vector3(-sx * CELL / 2, 0, -sz * CELL / 2),
  }
}

// ---------------------------------------------------------------- room pieces

const PX_HANGER = ['..#..', '.#.#.', '#...#', '#####']
const PX_SHIRT = ['##.##', '#####', '.###.', '.###.']

function buildWardrobe(): THREE.Group {
  const g = new THREE.Group()
  const k = new Kit()
  const z0 = WARDROBE_SLOTS[0] * CELL, w = WARDROBE_SLOTS.length * CELL
  const body = '#c8a0ff', frame = '#9a6fe0'
  // Built into the right wall: local x = into the room (−x world), so build in world space.
  k.boxMin(RW - 0.22, 0, z0 + 0.05, 0.22, 2.9, w - 0.1, frame)
  k.boxMin(RW - 0.26, 0.12, z0 + 0.14, 0.06, 2.55, w / 2 - 0.16, body)
  k.boxMin(RW - 0.26, 0.12, z0 + w / 2 + 0.02, 0.06, 2.55, w / 2 - 0.16, body)
  k.boxMin(RW - 0.3, 1.25, z0 + w / 2 - 0.2, 0.06, 0.3, 0.1, '#ffd23f')
  k.boxMin(RW - 0.3, 1.25, z0 + w / 2 + 0.1, 0.06, 0.3, 0.1, '#ffd23f')
  k.boxMin(RW - 0.3, 2.9, z0, 0.3, 0.12, w, darken(frame, 0.15))
  k.boxMin(RW - 0.3, 0, z0, 0.3, 0.1, w, darken(frame, 0.25))
  k.voxels(PX_HANGER, { '#': '#ffffff' }, RW - 0.27, 2.2, z0 + w * 0.25, 0.07, 0.02, -Math.PI / 2)
  k.voxels(PX_SHIRT, { '#': '#ff8ae0' }, RW - 0.27, 1.85, z0 + w * 0.25, 0.07, 0.02, -Math.PI / 2)
  k.voxels(PX_HANGER, { '#': '#ffffff' }, RW - 0.27, 2.2, z0 + w * 0.75, 0.07, 0.02, -Math.PI / 2)
  k.voxels(PX_SHIRT, { '#': '#4fb8ff' }, RW - 0.27, 1.85, z0 + w * 0.75, 0.07, 0.02, -Math.PI / 2)
  g.add(k.mesh()!)
  return g
}

function buildWindow(wall: 1 | 3, slot0: number): THREE.Group {
  const g = new THREE.Group()
  const w = 2 * CELL, h = 1.35, y0 = 1.3
  const k = new Kit(), sky = new Kit()
  // Local: x along the wall, z into the room (placed like a wall item).
  sky.boxMin(0.2, y0, 0.0, w - 0.4, h, 0.02, '#aee6ff')
  sky.boxMin(0.2, y0, 0.01, w - 0.4, 0.3, 0.02, '#8fe0a0')
  sky.voxels(['..##...', '.####.#', '#######'], { '#': '#ffffff' }, w * 0.35, y0 + h - 0.35, 0.03, 0.07, 0.01)
  sky.voxels(['.#.', '###', '.#.'], { '#': '#fff1b0' }, w * 0.75, y0 + h - 0.3, 0.03, 0.09, 0.01)
  const fr = '#ffffff'
  k.boxMin(0.12, y0 - 0.08, 0, 0.1, h + 0.16, 0.12, fr)
  k.boxMin(w - 0.22, y0 - 0.08, 0, 0.1, h + 0.16, 0.12, fr)
  k.boxMin(0.12, y0 + h, 0, w - 0.24, 0.1, 0.12, fr)
  k.boxMin(0.05, y0 - 0.14, 0, w - 0.1, 0.1, 0.26, fr)
  k.boxMin(w / 2 - 0.04, y0, 0.01, 0.08, h, 0.06, fr)
  k.boxMin(0.2, y0 + h / 2 - 0.03, 0.01, w - 0.4, 0.06, 0.06, fr)
  // Curtains
  k.boxMin(-0.05, y0 - 0.2, 0.1, 0.28, h + 0.5, 0.06, '#ffb0d8')
  k.boxMin(w - 0.23, y0 - 0.2, 0.1, 0.28, h + 0.5, 0.06, '#ffb0d8')
  k.boxMin(-0.1, y0 + h + 0.28, 0.08, w + 0.2, 0.06, 0.06, '#e07a4e')
  g.add(k.mesh()!)
  g.add(sky.mesh(basicMaterial('#ffffff', { vc: true }))!)
  // Daylight: a slanted beam and a patch on the floor.
  const beam = new THREE.BufferGeometry()
  const reach = 2.6
  const v = new Float32Array([
    0.3, y0 + h, 0.05, w - 0.3, y0 + h, 0.05, w - 0.3 + 0.3, 0.02, reach + 1.2, 0.3 + 0.3, 0.02, reach + 1.2,
  ])
  beam.setAttribute('position', new THREE.BufferAttribute(v, 3))
  beam.setIndex([0, 1, 2, 0, 2, 3])
  beam.computeVertexNormals()
  g.add(new THREE.Mesh(beam, basicMaterial('#fff8e0', { opacity: 0.12, side: THREE.DoubleSide })))
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.6, 1.4), basicMaterial('#fff4c8', { opacity: 0.3 }))
  patch.rotation.x = -Math.PI / 2
  patch.position.set(w / 2 + 0.2, 0.021, reach + 0.3)
  g.add(patch)
  if (wall === 3) { g.position.set(0, 0, (slot0 + 2) * CELL); g.rotation.y = Math.PI / 2 } else { g.position.set(RW, 0, slot0 * CELL); g.rotation.y = -Math.PI / 2 }
  return g
}

function buildDoor(): THREE.Group {
  const g = new THREE.Group()
  const k = new Kit()
  const x0 = DOOR_SLOT * CELL, w = CELL, h = 2.75
  // Door in the front wall, facing into the room (−z).
  k.boxMin(x0 + 0.12, 0, RD - 0.08, w - 0.24, h - 0.1, 0.08, '#ff8ae0')
  k.boxMin(x0 + 0.05, 0, RD - 0.12, 0.1, h, 0.14, '#ffffff')
  k.boxMin(x0 + w - 0.15, 0, RD - 0.12, 0.1, h, 0.14, '#ffffff')
  k.boxMin(x0 + 0.05, h - 0.1, RD - 0.12, w - 0.1, 0.14, 0.14, '#ffffff')
  k.boxMin(x0 + 0.25, 0.3, RD - 0.1, w - 0.5, 0.7, 0.03, darken('#ff8ae0', 0.1))
  k.boxMin(x0 + 0.25, 1.25, RD - 0.1, w - 0.5, 0.7, 0.03, darken('#ff8ae0', 0.1))
  k.voxels(['.###.', '#####', '#####', '.###.'], { '#': '#aee6ff' }, x0 + w / 2, 2.25, RD - 0.1, 0.09, 0.02)
  k.box(x0 + w - 0.35, 1.2, RD - 0.13, 0.1, 0.1, 0.08, '#ffd23f')
  g.add(k.mesh()!)
  return g
}

function buildDoorMat(): THREE.Mesh {
  const k = new Kit()
  const x0 = DOOR_SLOT * CELL
  k.boxMin(x0 + 0.15, 0, RD - 0.95, CELL - 0.3, 0.03, 0.75, '#6fe07f')
  k.boxMin(x0 + 0.25, 0.005, RD - 0.85, CELL - 0.5, 0.03, 0.55, '#3fb870')
  k.voxels(['#.#', '.#.', '#.#'].map(() => '.#.'), { '#': '#ffffff' }, 0, 0, 0, 0.001, 0.001)
  const arrow = new Kit().voxels(['..#..', '.###.', '#####', '.###.', '.###.'], { '#': '#fff1b0' }, 0, 0, 0, 0.08, 0.01).build()!
  arrow.rotateX(Math.PI / 2)
  arrow.translate(x0 + CELL / 2, 0.04, RD - 0.57)
  const mat = k.build()!
  const m = new THREE.Mesh(mat, basicMaterial('#ffffff', { vc: true }))
  m.add(new THREE.Mesh(arrow, basicMaterial('#ffffff', { vc: true })))
  return m
}

/** A wall: an inward-facing papered plane with a baseboard and a top rail; the front wall leaves the door open. */
function buildWall(rot: 0 | 1 | 2 | 3, paper: THREE.Material): THREE.Group {
  const g = new THREE.Group()
  const len = (rot % 2 === 0 ? HOUSE_W : HOUSE_D) * CELL
  const pieces: [number, number, number, number][] = rot === 2
    ? [[0, 0, DOOR_SLOT * CELL, WALL_H], [(DOOR_SLOT + 1) * CELL, 0, len - (DOOR_SLOT + 1) * CELL, WALL_H], [DOOR_SLOT * CELL, 2.75, CELL, WALL_H - 2.75]]
    : [[0, 0, len, WALL_H]]
  for (const [x, y, w, h] of pieces) {
    const geo = new THREE.PlaneGeometry(w, h)
    const uv = geo.getAttribute('uv') as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (x + uv.getX(i) * w) / CELL, (y + uv.getY(i) * h) / CELL)
    geo.translate(x + w / 2, y + h / 2, 0)
    g.add(new THREE.Mesh(geo, paper))
  }
  const k = new Kit()
  for (const [x, , w] of pieces.filter(p => p[1] === 0)) k.boxMin(x, 0, 0, w, 0.22, 0.06, '#ffffff')
  k.boxMin(0, WALL_H - 0.12, 0, len, 0.12, 0.08, '#ffffff')
  g.add(k.mesh()!)
  // Place: local x along the wall's slot direction, local +z into the room.
  switch (rot) {
    case 0: break
    case 2: g.position.set(RW, 0, RD); g.rotation.y = Math.PI; g.scale.x = 1; mirrorX(g, len); break
    case 3: g.position.set(0, 0, RD); g.rotation.y = Math.PI / 2; mirrorX(g, len); break
    case 1: g.position.set(RW, 0, 0); g.rotation.y = -Math.PI / 2; break
  }
  return g
}

/** Front and left walls run their slots the other way from their local x; flip their children so slot x matches. */
function mirrorX(g: THREE.Group, len: number) {
  for (const c of g.children) {
    const m = c as THREE.Mesh
    m.geometry.applyMatrix4(new THREE.Matrix4().makeScale(-1, 1, 1).setPosition(len, 0, 0))
    // Flipping x turns the faces inside out; flip the index order back.
    const idx = m.geometry.index
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) { const a = idx.getX(i + 1); idx.setX(i + 1, idx.getX(i + 2)); idx.setX(i + 2, a) }
      idx.needsUpdate = true
    }
    m.geometry.computeVertexNormals()
  }
}

// ---------------------------------------------------------------- the handle

export const createHouse: CreateHouse = ({ editable }) => {
  const group = new THREE.Group()
  group.name = 'miniworld-house'
  const room = new THREE.Group()
  const furnitureRoot = new THREE.Group()
  group.add(room, furnitureRoot)

  let layout: HouseLayout = { floor: STARTER_FLOOR, wall: STARTER_WALL, items: [] }
  let owned: OwnedFurniture[] = []
  const items = new Map<string, Item>()
  let editing = false
  let selected: string | null = null

  // Floor
  const floorGeo = new THREE.PlaneGeometry(RW, RD)
  const fuv = floorGeo.getAttribute('uv') as THREE.BufferAttribute
  for (let i = 0; i < fuv.count; i++) fuv.setXY(i, fuv.getX(i) * HOUSE_W, fuv.getY(i) * HOUSE_D)
  floorGeo.rotateX(-Math.PI / 2)
  floorGeo.translate(RW / 2, 0, RD / 2)
  const floorMesh = new THREE.Mesh(floorGeo, textureMaterial(floorTexture(floorDef(STARTER_FLOOR) ?? FLOORS[0]!)))
  room.add(floorMesh)
  // A plinth under the floor so the room reads as a box from a low angle.
  const base = new Kit().boxMin(-0.15, -0.52, -0.15, RW + 0.3, 0.5, RD + 0.3, '#c8b0e0').mesh()!
  room.add(base)

  // Walls
  const paperMat = new THREE.MeshLambertMaterial({ map: wallTexture(wallDef(STARTER_WALL) ?? WALLS[0]!) })
  const walls = ([0, 1, 2, 3] as const).map(r => buildWall(r, paperMat))
  const fixtures: THREE.Object3D[][] = [[], [], [], []]
  const wardrobeObj = buildWardrobe()
  fixtures[1]!.push(wardrobeObj, buildWindow(1, 5))
  fixtures[3]!.push(buildWindow(3, 3))
  fixtures[2]!.push(buildDoor())
  for (const w of walls) room.add(w)
  for (const list of fixtures) for (const f of list) room.add(f)
  room.add(buildDoorMat())

  const spawn = new THREE.Vector3((DOOR_SLOT + 0.5) * CELL, 0, RD - 1.25)
  const door = new THREE.Box3(new THREE.Vector3(DOOR_SLOT * CELL + 0.1, 0, RD - 0.55), new THREE.Vector3((DOOR_SLOT + 1) * CELL - 0.1, 2.6, RD + 0.3))
  const wardrobe = new THREE.Box3(new THREE.Vector3(RW - 1.3, 0, WARDROBE_SLOTS[0] * CELL), new THREE.Vector3(RW, 2.6, (WARDROBE_SLOTS[1] + 1) * CELL))

  // Which walls face the camera (hidden). Fed by the floor's onBeforeRender and by setView.
  const wallVisible = [true, true, false, true]
  const camLocal = new THREE.Vector3()
  const applyWallVis = () => {
    walls.forEach((w, i) => { w.visible = wallVisible[i]! })
    fixtures.forEach((list, i) => list.forEach(f => { f.visible = wallVisible[i]! }))
    for (const it of items.values()) if (it.def.kind === 'wall') it.pivot.visible = wallVisible[it.placed.rot]!
  }
  const setView = (camWorld: THREE.Vector3) => {
    camLocal.copy(camWorld)
    group.worldToLocal(camLocal)
    const v = [camLocal.z > 0.2, camLocal.x < RW - 0.2, camLocal.z < RD - 0.2, camLocal.x > 0.2]
    let changed = false
    for (let i = 0; i < 4; i++) if (wallVisible[i] !== v[i]) { wallVisible[i] = v[i]!; changed = true }
    if (changed) applyWallVis()
  }
  const camTmp = new THREE.Vector3()
  floorMesh.onBeforeRender = (_r, _s, cam) => { setView(camTmp.setFromMatrixPosition(cam.matrixWorld)) }
  applyWallVis()

  // ---------------- edit overlays
  const grid = (() => {
    const pts: number[] = []
    for (let i = 0; i <= HOUSE_W; i++) pts.push(i * CELL, 0.03, 0, i * CELL, 0.03, RD)
    for (let j = 0; j <= HOUSE_D; j++) pts.push(0, 0.03, j * CELL, RW, 0.03, j * CELL)
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
    const lines = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, depthWrite: false }))
    const blocked = new Kit()
    for (const [x, z] of FLOOR_BLOCK) blocked.boxMin(x * CELL + 0.1, 0.025, z * CELL + 0.1, CELL - 0.2, 0.01, CELL - 0.2, '#ffffff')
    const bm = blocked.mesh(basicMaterial('#5a4a7a', { opacity: 0.35 }))!
    const gg = new THREE.Group()
    gg.add(lines, bm)
    gg.visible = false
    return gg
  })()
  room.add(grid)

  const selBox = new THREE.Group()
  selBox.visible = false
  group.add(selBox)
  let selMesh: THREE.Mesh | null = null
  let fpMesh: THREE.Mesh | null = null
  const showSelection = (box: THREE.Box3 | null, ok: boolean) => {
    if (selMesh) { selBox.remove(selMesh); selMesh.geometry.dispose(); selMesh = null }
    if (fpMesh) { selBox.remove(fpMesh); fpMesh.geometry.dispose(); fpMesh = null }
    if (!box) { selBox.visible = false; return }
    const k = new Kit()
    const t = 0.07
    const { min, max } = box
    const sx = max.x - min.x, sy = max.y - min.y, sz = max.z - min.z
    for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) k.box(min.x + sx / 2, y, z, sx + t, t, t, '#ffffff')
    for (const x of [min.x, max.x]) for (const z of [min.z, max.z]) k.box(x, min.y + sy / 2, z, t, sy, t, '#ffffff')
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) k.box(x, y, min.z + sz / 2, t, t, sz, '#ffffff')
    selMesh = k.mesh(basicMaterial(ok ? '#ffe14f' : '#ff3b5c'))!
    selMesh.renderOrder = 10
    selBox.add(selMesh)
    const f = new Kit().box(min.x + sx / 2, min.y + 0.035, min.z + sz / 2, sx, 0.02, sz, '#ffffff')
    fpMesh = f.mesh(basicMaterial(ok ? '#6fe07f' : '#ff3b5c', { opacity: 0.45 }))!
    selBox.add(fpMesh)
    selBox.visible = true
  }

  // ---------------- items

  const state = (): HouseState => ({ house: layout, furniture: owned })
  const ownedOf = (uid: string) => owned.find(o => o.uid === uid)

  const surfaceY = (p: PlacedItem): number => {
    if (!p.on) return 0
    const base = layout.items.find(i => i.uid === p.on)
    const bd = base && furnitureDef(ownedOf(base.uid)?.id)
    return (bd?.surface ?? 0) * CELL
  }

  const position = (it: Item, p: PlacedItem, lift = 0) => {
    const tr = placementTransform(it.def, p, surfaceY(p))
    it.pivot.position.copy(tr.pos)
    it.pivot.position.y += lift
    it.pivot.rotation.y = tr.rotY
    it.handle.group.position.copy(tr.offset)
    if (it.def.kind === 'wall') it.pivot.visible = wallVisible[p.rot]!
    else it.pivot.visible = true
  }

  const itemBox = (it: Item, p: PlacedItem): THREE.Box3 => {
    const fp = footprint(it.def, p)
    if (it.def.kind === 'wall') {
      const a = fp.x * CELL, b = (fp.x + fp.w) * CELL
      const y0 = 1.2, y1 = 3.1, d = 0.5
      switch (p.rot) {
        case 0: return new THREE.Box3(new THREE.Vector3(a, y0, 0), new THREE.Vector3(b, y1, d))
        case 2: return new THREE.Box3(new THREE.Vector3(a, y0, RD - d), new THREE.Vector3(b, y1, RD))
        case 3: return new THREE.Box3(new THREE.Vector3(0, y0, a), new THREE.Vector3(d, y1, b))
        default: return new THREE.Box3(new THREE.Vector3(RW - d, y0, a), new THREE.Vector3(RW, y1, b))
      }
    }
    const y0 = surfaceY(p)
    const h = it.def.kind === 'rug' ? 0.12 : Math.max(0.5, it.handle.height)
    return new THREE.Box3(new THREE.Vector3(fp.x * CELL, y0, fp.z * CELL), new THREE.Vector3((fp.x + fp.w) * CELL, y0 + h, (fp.z + fp.d) * CELL))
  }

  const sync = () => {
    const want = new Map(layout.items.map(p => [p.uid, p]))
    for (const [uid, it] of items) {
      const o = ownedOf(uid)
      if (!want.has(uid) || !o || o.id !== it.def.id || o.level !== it.level) {
        furnitureRoot.remove(it.pivot)
        it.handle.dispose()
        items.delete(uid)
      }
    }
    for (const p of layout.items) {
      const o = ownedOf(p.uid)
      const def = furnitureDef(o?.id)
      if (!o || !def) continue
      let it = items.get(p.uid)
      if (!it) {
        const handle = buildFurniture(def.id, o.level) as FurnitureModelHandle
        const pivot = new THREE.Group()
        pivot.add(handle.group)
        furnitureRoot.add(pivot)
        it = { uid: p.uid, def, level: o.level, handle, pivot, placed: p }
        items.set(p.uid, it)
      }
      it.placed = p
      position(it, p)
    }
    if (selected && !items.has(selected)) selected = null
    refreshSelection()
  }

  const refreshSelection = () => {
    const it = selected ? items.get(selected) : null
    showSelection(editing && it ? itemBox(it, it.placed).expandByScalar(0.04) : null, true)
  }

  const valid = (uid: string, p: PlacedItem): boolean => {
    const def = furnitureDef(ownedOf(uid)?.id)
    return !!def && canPlace(state(), uid, p) && !fixtureBlocked(def, p)
  }

  const commit = (uid: string, p: PlacedItem): HouseLayout | null => {
    const next = placeItem(state(), uid, p)
    if (typeof next === 'string') return null
    layout = cloneLayout(next.house)
    sync()
    return cloneLayout(layout)
  }

  /** A free spot near `near` (cell), honouring fixtures; small things try tables after the floor. */
  const freeSpot = (uid: string, near: { x: number; z: number }, rots?: (0 | 1 | 2 | 3)[]): PlacedItem | null => {
    const def = furnitureDef(ownedOf(uid)?.id)
    if (!def) return null
    const without: HouseState = { house: { ...layout, items: layout.items.filter(i => i.uid !== uid && i.on !== uid) }, furniture: owned }
    const ok = (c: PlacedItem) => canPlace(without, uid, c) && !fixtureBlocked(def, c)
    if (def.kind === 'wall') {
      const order = rots ?? [0, 3, 1, 2]
      for (const rot of order) {
        const len = wallLength(rot)
        const cands: PlacedItem[] = []
        for (let x = 0; x + def.size[0] <= len; x++) cands.push({ uid, x, z: 0, rot })
        const mid = rot === (rots?.[0] ?? -1) ? near.x : (len - def.size[0]) / 2
        cands.sort((a, b) => Math.abs(a.x - mid) - Math.abs(b.x - mid))
        const hit = cands.find(ok)
        if (hit) return hit
      }
      return null
    }
    const cands: PlacedItem[] = []
    for (const rot of rots ?? [0, 1] as const) for (let z = 0; z < HOUSE_D; z++) for (let x = 0; x < HOUSE_W; x++) cands.push({ uid, x, z, rot })
    const d = (c: PlacedItem) => Math.abs(c.x - near.x) + Math.abs(c.z - near.z) + (rots ? rots.indexOf(c.rot) : c.rot) * 0.5
    cands.sort((a, b) => d(a) - d(b))
    const floor = cands.find(ok)
    if (floor) return floor
    if (def.kind === 'small') {
      for (const b of without.house.items) {
        const bd = furnitureDef(ownedOf(b.uid)?.id)
        if (!bd || bd.surface === undefined || b.on) continue
        const fp = footprint(bd, b)
        for (let z = fp.z; z < fp.z + fp.d; z++) for (let x = fp.x; x < fp.x + fp.w; x++) {
          const c: PlacedItem = { uid, x, z, rot: 0, on: b.uid }
          if (ok(c)) return c
        }
      }
    }
    return null
  }

  // ---------------- pointer

  const toLocal = (ray: THREE.Ray): THREE.Ray => {
    group.updateWorldMatrix(true, false)
    const inv = new THREE.Matrix4().copy(group.matrixWorld).invert()
    return ray.clone().applyMatrix4(inv)
  }

  const pick = (ray: THREE.Ray): { uid: string; point: THREE.Vector3 } | null => {
    let best: { uid: string; point: THREE.Vector3; d: number } | null = null
    const hit = new THREE.Vector3()
    for (const it of items.values()) {
      if (it.def.kind === 'wall' && !wallVisible[it.placed.rot]) continue
      const box = itemBox(it, it.placed)
      box.expandByVector(new THREE.Vector3(0.15, 0.1, 0.15))
      if (!ray.intersectBox(box, hit)) continue
      let d = hit.distanceTo(ray.origin)
      if (it.def.kind === 'rug') d += 3
      if (it.uid === selected) d -= 0.5
      if (!best || d < best.d) best = { uid: it.uid, point: hit.clone(), d }
    }
    return best ? { uid: best.uid, point: best.point } : null
  }

  interface Drag {
    uid: string
    start: PlacedItem
    cand: PlacedItem
    ok: boolean
    planeY: number
    grab: THREE.Vector3 // grab point minus the item's min corner (floor) or along-wall offset
  }
  let drag: Drag | null = null
  let down: { ray: THREE.Ray; uid: string | null } | null = null

  const wallHit = (ray: THREE.Ray): { rot: 0 | 1 | 2 | 3; along: number } | null => {
    let best: { rot: 0 | 1 | 2 | 3; along: number; t: number } | null = null
    const planes: [0 | 1 | 2 | 3, THREE.Plane][] = [
      [0, new THREE.Plane(new THREE.Vector3(0, 0, 1), 0)],
      [2, new THREE.Plane(new THREE.Vector3(0, 0, -1), RD)],
      [3, new THREE.Plane(new THREE.Vector3(1, 0, 0), 0)],
      [1, new THREE.Plane(new THREE.Vector3(-1, 0, 0), RW)],
    ]
    const p = new THREE.Vector3()
    for (const [rot, plane] of planes) {
      if (!wallVisible[rot]) continue
      if (!ray.intersectPlane(plane, p)) continue
      if (p.y < 0 || p.y > WALL_H + 1) continue
      const along = rot % 2 === 0 ? p.x : p.z
      if (along < -0.5 || along > (rot % 2 === 0 ? RW : RD) + 0.5) continue
      const t = p.distanceTo(ray.origin)
      if (!best || t < best.t) best = { rot, along, t }
    }
    return best
  }

  const candidateFor = (d: Drag, ray: THREE.Ray): PlacedItem => {
    const it = items.get(d.uid)!
    const def = it.def
    if (def.kind === 'wall') {
      const w = wallHit(ray)
      if (!w) return d.cand
      const len = wallLength(w.rot)
      const x = Math.max(0, Math.min(len - def.size[0], Math.round(w.along / CELL - d.grab.x)))
      return { uid: d.uid, x, z: 0, rot: w.rot }
    }
    const p = new THREE.Vector3()
    if (!ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -d.planeY), p)) return d.cand
    const fp = footprint(def, d.start)
    const x = Math.max(0, Math.min(HOUSE_W - fp.w, Math.round(p.x / CELL - d.grab.x)))
    const z = Math.max(0, Math.min(HOUSE_D - fp.d, Math.round(p.z / CELL - d.grab.z)))
    const base: PlacedItem = { uid: d.uid, x, z, rot: d.start.rot }
    if (def.kind === 'small') {
      // Onto a table or shelf when the cell is under one.
      for (const other of layout.items) {
        if (other.uid === d.uid || other.on) continue
        const od = furnitureDef(ownedOf(other.uid)?.id)
        if (!od || od.surface === undefined) continue
        const ofp = footprint(od, other)
        if (x >= ofp.x && z >= ofp.z && x + fp.w <= ofp.x + ofp.w && z + fp.d <= ofp.z + ofp.d) return { ...base, on: other.uid }
      }
    }
    return base
  }

  const showDrag = (d: Drag) => {
    const it = items.get(d.uid)!
    position(it, d.cand, 0.12)
    // Riders ride along while dragging.
    for (const r of layout.items) {
      if (r.on !== d.uid) continue
      const ri = items.get(r.uid)
      if (!ri) continue
      const moved = { ...r, x: r.x + d.cand.x - d.start.x, z: r.z + d.cand.z - d.start.z }
      position(ri, moved, 0.12)
    }
    showSelection(itemBox(it, d.cand).expandByScalar(0.04), d.ok)
  }

  const endDrag = (): { layout?: HouseLayout } => {
    const d = drag!
    drag = null
    if (d.ok && (d.cand.x !== d.start.x || d.cand.z !== d.start.z || d.cand.rot !== d.start.rot || d.cand.on !== d.start.on)) {
      const l = commit(d.uid, d.cand)
      if (l) return { layout: l }
    }
    sync()
    return {}
  }

  // ---------------- handle

  const handle: HouseHandle & { readonly wardrobe: THREE.Box3; setView(cameraWorld: THREE.Vector3): void } = {
    group,
    spawn,
    door,
    wardrobe,
    setView,
    colliders() {
      const out: THREE.Box3[] = [
        new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(RW + 1, WALL_H + 2, 0)),
        new THREE.Box3(new THREE.Vector3(-1, -1, RD), new THREE.Vector3(RW + 1, WALL_H + 2, RD + 1)),
        new THREE.Box3(new THREE.Vector3(-1, -1, -1), new THREE.Vector3(0, WALL_H + 2, RD + 1)),
        new THREE.Box3(new THREE.Vector3(RW, -1, -1), new THREE.Vector3(RW + 1, WALL_H + 2, RD + 1)),
        new THREE.Box3(new THREE.Vector3(RW - 0.3, 0, WARDROBE_SLOTS[0] * CELL), new THREE.Vector3(RW, 3, (WARDROBE_SLOTS[1] + 1) * CELL)),
      ]
      for (const it of items.values()) {
        const k = it.def.kind
        if (k === 'wall' || k === 'rug' || it.placed.on) continue
        const fp = footprint(it.def, it.placed)
        const inset = 0.06
        out.push(new THREE.Box3(
          new THREE.Vector3(fp.x * CELL + inset, 0, fp.z * CELL + inset),
          new THREE.Vector3((fp.x + fp.w) * CELL - inset, Math.max(0.2, it.handle.height), (fp.z + fp.d) * CELL - inset),
        ))
      }
      return out
    },
    usables() {
      const out: { uid: string; use: NonNullable<FurnitureDef['use']>; at: THREE.Vector3; yaw: number }[] = []
      for (const it of items.values()) {
        if (!it.def.use || !it.handle.useAt) continue
        it.pivot.updateMatrix()
        it.handle.group.updateMatrix()
        const at = it.handle.useAt.clone().applyMatrix4(it.handle.group.matrix).applyMatrix4(it.pivot.matrix)
        out.push({ uid: it.uid, use: it.def.use, at, yaw: it.pivot.rotation.y + it.handle.useYaw })
      }
      return out
    },
    setLayout(next, nextOwned) {
      owned = nextOwned.map(o => ({ ...o }))
      layout = cloneLayout(next)
      const fd = floorDef(layout.floor) ?? floorDef(STARTER_FLOOR)!
      floorMesh.material = textureMaterial(floorTexture(fd))
      const wd = wallDef(layout.wall) ?? wallDef(STARTER_WALL)!
      paperMat.map = wallTexture(wd)
      paperMat.needsUpdate = true
      drag = null
      sync()
    },
    setEdit(on) {
      editing = editable && on
      grid.visible = editing
      if (!editing) { selected = null; drag = null; sync() }
      refreshSelection()
    },
    select(uid) {
      selected = uid && items.has(uid) ? uid : null
      refreshSelection()
    },
    pointer(kind, worldRay) {
      if (!editing) return null
      const ray = toLocal(worldRay)
      if (kind === 'down') {
        const hit = pick(ray)
        if (hit && hit.uid === selected) {
          const it = items.get(hit.uid)!
          const fp = footprint(it.def, it.placed)
          let grab: THREE.Vector3
          let planeY = 0
          if (it.def.kind === 'wall') {
            const w = wallHit(ray)
            grab = new THREE.Vector3((w ? w.along / CELL : fp.x) - fp.x, 0, 0)
          } else {
            planeY = Math.min(2, Math.max(0, hit.point.y))
            grab = new THREE.Vector3(hit.point.x / CELL - fp.x, 0, hit.point.z / CELL - fp.z)
          }
          drag = { uid: hit.uid, start: { ...it.placed }, cand: { ...it.placed }, ok: true, planeY, grab }
          down = null
          showDrag(drag)
          return {}
        }
        down = { ray: ray.clone(), uid: hit?.uid ?? null }
        return null
      }
      if (kind === 'move') {
        if (drag) {
          const cand = candidateFor(drag, ray)
          const same = cand.x === drag.cand.x && cand.z === drag.cand.z && cand.rot === drag.cand.rot && cand.on === drag.cand.on
          if (!same) {
            drag.cand = cand
            drag.ok = valid(drag.uid, cand)
            showDrag(drag)
          }
          return null
        }
        if (down && (down.ray.origin.distanceTo(ray.origin) > 0.25 || down.ray.direction.angleTo(ray.direction) > 0.05)) down = null
        return null
      }
      // up
      if (drag) return endDrag()
      if (down) {
        const d = down
        down = null
        if (d.ray.origin.distanceTo(ray.origin) > 0.25 || d.ray.direction.angleTo(ray.direction) > 0.05) return null
        const uid = d.uid && d.uid !== selected ? d.uid : null
        selected = uid
        refreshSelection()
        return { select: uid }
      }
      return null
    },
    add(uid) {
      if (!editable) return null
      const o = ownedOf(uid)
      const def = furnitureDef(o?.id)
      if (!o || !def) return null
      const [sx, sz] = def.size
      const spot = freeSpot(uid, { x: Math.floor((HOUSE_W - sx) / 2), z: Math.floor((HOUSE_D - sz) / 2) })
      if (!spot) return null
      const l = commit(uid, spot)
      if (l) { selected = uid; refreshSelection() }
      return l
    },
    rotate() {
      if (!selected) return null
      const it = items.get(selected)
      if (!it) return null
      const p = it.placed
      if (it.def.kind === 'wall') {
        const order = [1, 2, 3].map(i => ((p.rot + i) % 4) as 0 | 1 | 2 | 3)
        const spot = freeSpot(it.uid, { x: p.x, z: 0 }, order)
        return spot ? commit(it.uid, spot) : null
      }
      const rot = ((p.rot + 1) % 4) as 0 | 1 | 2 | 3
      const [sx, sz] = it.def.size
      // Turn about the footprint's centre, then search nearby if that spot is taken.
      const fp = footprint(it.def, p)
      const odd = rot % 2 === 1
      const w = odd ? sz : sx, d = odd ? sx : sz
      const near = { x: Math.round(fp.x + (fp.w - w) / 2), z: Math.round(fp.z + (fp.d - d) / 2) }
      const direct: PlacedItem = { ...p, rot, x: Math.max(0, Math.min(HOUSE_W - w, near.x)), z: Math.max(0, Math.min(HOUSE_D - d, near.z)) }
      if (p.on) {
        const spot: PlacedItem = { ...direct, on: p.on }
        if (valid(it.uid, spot)) return commit(it.uid, spot)
      }
      const cand = valid(it.uid, { ...direct, on: undefined }) ? { ...direct, on: undefined } : freeSpot(it.uid, near, [rot])
      if (!cand) return null
      const clean: PlacedItem = { uid: cand.uid, x: cand.x, z: cand.z, rot: cand.rot }
      if (cand.on) clean.on = cand.on
      return commit(it.uid, clean)
    },
    store() {
      if (!selected) return null
      const uid = selected
      layout = cloneLayout(storeItem(state(), uid).house)
      selected = null
      sync()
      return cloneLayout(layout)
    },
    update(dt, t) {
      for (const it of items.values()) {
        it.handle.update(dt, t)
      }
      // Riders on a floating (level 3) table float with it.
      for (const it of items.values()) {
        if (!it.placed.on || drag?.uid === it.placed.on) continue
        const base = items.get(it.placed.on)
        if (!base || base.level !== 3) continue
        const inner = base.handle.group.children[0]
        if (inner) it.pivot.position.y = surfaceY(it.placed) + inner.position.y
      }
      if (selBox.visible && selMesh) {
        const m = selMesh.material as THREE.MeshBasicMaterial
        m.opacity = 1
        selMesh.visible = Math.sin(t * 8) > -0.6
      }
    },
    dispose() {
      for (const it of items.values()) it.handle.dispose()
      items.clear()
      showSelection(null, true)
      disposeTree(group)
      paperMat.dispose()
    },
  }
  return handle
}

function cloneLayout(l: HouseLayout): HouseLayout {
  return { floor: l.floor, wall: l.wall, items: l.items.map(i => ({ ...i })) }
}

