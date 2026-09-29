/**
 * Slottet inside (2026-09-29): the throne hall you walk into from the
 * castle gate on the hill. Chequered floor, a carpet from the gate up a
 * two-step dais to the big throne, two small thrones beside it, pillars,
 * stained-glass windows, banners and lanterns. No ceiling and a low
 * front wall, like the houses, so the camera needs no collisions.
 *
 * Things to do: sit on the thrones (the big one gives a fanfare), play the
 * piano, sit at the banquet table with its cake, and open Slottsboka on its
 * lectern by the gate: the friends and neighbourhood panel that used to
 * open straight from the door. The gate leads back out to the hill.
 *
 * Everyone who is in the castle sees each other (place key 'castle').
 */
import * as THREE from 'three'
import { Blocks, blocksMesh } from './blocks'
import { SKIES, blockMaterial, glowMaterial } from './look'
import { buildFurniture } from './furniture'
import type { FurnitureModelHandle } from './furniture'
import { createWorld, addStatic, box } from './physics'
import { zone } from './place'
import type { PlaceScene, Usable } from './place'

/** Inside of the walls. */
const X0 = -9, X1 = 9, Z0 = -15, Z1 = 5
const WALL_H = 6
const FRONT_H = 2.4
const GATE = 2
/** Dais: two steps under the thrones. */
const DAIS1 = 0.4, DAIS2 = 0.8

const STONE = '#f4ecff', STONE_TOP = '#e4d8f8', STONE_DARK = '#d8c8f0'
const GOLD = '#ffd84f', GOLD_DARK = '#e0a82f'
const PURPLE = '#7a4fd0', PINK = '#ff6fb0'

/** The big throne's seat, for the special sit (fanfare and sparkles). */
export const THRONE_UID = 'castle-throne'

export function buildCastle(): PlaceScene {
  const group = new THREE.Group()
  group.name = 'castle'
  const world = createWorld({ killY: -20 })
  const b = new Blocks()
  const glow = new Blocks()
  const solid = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => addStatic(world, box(x0, y0, z0, x1, y1, z1))

  // ------------------------------------------------ floor, grass outside the gate

  b.box(-14, -1, Z1 + 1, 14, -0.02, Z1 + 9, '#7fe0a0', { top: '#8fe8ac' })
  solid(-14, -1, Z0 - 2, 14, 0, Z1 + 9)
  for (let x = X0; x < X1; x += 2) for (let z = Z0; z < Z1 + 1; z += 2) {
    const k = ((x - X0) / 2 + (z - Z0) / 2) & 1
    b.box(x, -0.3, z, x + 2, 0, Math.min(z + 2, Z1 + 1), k ? '#e8dcff' : '#fbf8ff', { bottom: false })
  }

  // ------------------------------------------------ walls

  // Back and sides: tall, with a darker foot and battlements on top.
  b.box(X0 - 1, 0, Z0 - 1, X1 + 1, WALL_H + 1, Z0, STONE, { top: STONE_TOP, bottom: false })
  b.box(X0 - 1, 0, Z0, X0, WALL_H, Z1 + 1, STONE, { top: STONE_TOP, bottom: false })
  b.box(X1, 0, Z0, X1 + 1, WALL_H, Z1 + 1, STONE, { top: STONE_TOP, bottom: false })
  solid(X0 - 1, -1, Z0 - 1, X1 + 1, WALL_H + 1, Z0)
  solid(X0 - 1, -1, Z0, X0, WALL_H, Z1 + 1)
  solid(X1, -1, Z0, X1 + 1, WALL_H, Z1 + 1)
  b.box(X0, 0, Z0, X1, 0.5, Z0 + 0.08, STONE_DARK, { bottom: false })
  b.box(X0, 0, Z0, X0 + 0.08, 0.5, Z1, STONE_DARK, { bottom: false })
  b.box(X1 - 0.08, 0, Z0, X1, 0.5, Z1, STONE_DARK, { bottom: false })
  for (let x = X0 - 0.6; x <= X1 + 0.6; x += 1.6) b.block(x, WALL_H + 1, Z0 - 0.5, 0.8, 0.7, 1, STONE_TOP)
  for (let z = Z0 + 0.6; z <= Z1 + 0.6; z += 1.6) {
    b.block(X0 - 0.5, WALL_H, z, 1, 0.7, 0.8, STONE_TOP)
    b.block(X1 + 0.5, WALL_H, z, 1, 0.7, 0.8, STONE_TOP)
  }
  // Front: low walls either side of the gate, gate posts and a lintel with the castle's colours.
  b.box(X0 - 1, 0, Z1, -GATE, FRONT_H, Z1 + 1, STONE, { top: STONE_TOP, bottom: false })
  b.box(GATE, 0, Z1, X1 + 1, FRONT_H, Z1 + 1, STONE, { top: STONE_TOP, bottom: false })
  solid(X0 - 1, -1, Z1, -GATE, FRONT_H, Z1 + 1)
  solid(GATE, -1, Z1, X1 + 1, FRONT_H, Z1 + 1)
  for (const s of [-1, 1]) {
    const cx = s * (GATE + 0.4)
    b.box(cx - 0.5, 0, Z1 - 0.1, cx + 0.5, 4.4, Z1 + 1.1, STONE_TOP, { bottom: false })
    solid(cx - 0.5, -1, Z1 - 0.1, cx + 0.5, 4.4, Z1 + 1.1)
    b.cone(cx, 4.4, Z1 + 0.5, 0.8, 1.2, 4, PINK, Math.PI / 4)
  }
  b.box(-GATE - 0.9, 4.0, Z1 - 0.05, GATE + 0.9, 4.6, Z1 + 1.05, PURPLE, { top: GOLD })
  for (let x = -GATE; x <= GATE; x += 1) glow.box(x - 0.12, 4.15, Z1 + 1.06, x + 0.12, 4.45, Z1 + 1.1, GOLD)

  // ------------------------------------------------ carpet and dais

  const carpet = (z0: number, z1: number, y: number) => {
    b.box(-1.6, y, z0, 1.6, y + 0.04, z1, GOLD, { bottom: false })
    b.box(-1.35, y, z0, 1.35, y + 0.05, z1, '#d0306a', { top: '#e8407a', bottom: false })
  }
  carpet(-10, Z1 + 1, 0)
  b.box(-6, 0, Z0, 6, DAIS1, -10, STONE_TOP, { top: '#f8f0ff', bottom: false })
  b.box(-4.5, DAIS1, Z0, 4.5, DAIS2, -11.5, STONE_TOP, { top: '#f8f0ff', bottom: false })
  solid(-6, -1, Z0, 6, DAIS1, -10)
  solid(-4.5, -1, Z0, 4.5, DAIS2, -11.5)
  carpet(-11.5, -10, DAIS1)
  carpet(-12.6, -11.5, DAIS2)
  for (const x of [-5.6, 5.6]) glow.block(x, DAIS1, -10.3, 0.3, 0.2, 0.3, GOLD)

  // ------------------------------------------------ the big throne

  const ty = DAIS2, tz0 = -14.8, seatZ0 = -14.2, seatZ1 = -12.4, seatTop = ty + 0.7
  b.box(-1.2, ty, tz0, 1.2, ty + 3.8, seatZ0, GOLD, { top: GOLD_DARK, bottom: false })
  b.box(-0.9, ty + 1, seatZ0, 0.9, ty + 3.4, seatZ0 + 0.1, '#b01874', { bottom: false })
  b.box(-1.1, ty, seatZ0, 1.1, seatTop - 0.15, seatZ1, GOLD, { top: GOLD_DARK, bottom: false })
  b.box(-1.0, seatTop - 0.15, seatZ0, 1.0, seatTop, seatZ1 - 0.1, '#b01874', { top: '#d0308c', bottom: false })
  for (const s of [-1, 1]) {
    b.box(s > 0 ? 1.1 : -1.5, ty, seatZ0, s > 0 ? 1.5 : -1.1, ty + 1.4, seatZ1, GOLD, { top: GOLD_DARK, bottom: false })
    glow.block(s * 1.3, ty + 1.4, seatZ1 - 0.3, 0.3, 0.3, 0.3, '#2ff3ff')
  }
  // A crown on the back.
  const cy = ty + 3.8
  b.box(-1.2, cy, tz0 + 0.1, 1.2, cy + 0.4, seatZ0 - 0.1, GOLD, { bottom: false })
  for (const x of [-1.0, 0, 1.0]) b.block(x, cy + 0.4, (tz0 + seatZ0) / 2, 0.4, x === 0 ? 0.9 : 0.6, 0.4, GOLD)
  glow.block(0, cy + 0.12, seatZ0 - 0.05, 0.3, 0.2, 0.1, PINK)
  solid(-1.5, ty, tz0, 1.5, seatTop, seatZ1)
  solid(-1.2, ty, tz0, 1.2, cy + 1.3, seatZ0)

  // The banner behind the thrones: purple with a gold crown.
  b.box(-2.6, 2.2, Z0, 2.6, 6.6, Z0 + 0.12, PURPLE, { bottom: false })
  b.box(-2.6, 6.4, Z0, 2.6, 6.8, Z0 + 0.2, GOLD, { bottom: false })
  for (let x = -2.4; x <= 2.4; x += 0.8) b.tri([x - 0.4, 2.2, Z0 + 0.13], [x + 0.4, 2.2, Z0 + 0.13], [x, 1.7, Z0 + 0.13], PURPLE)
  glow.box(-1.2, 4.9, Z0 + 0.13, 1.2, 5.3, Z0 + 0.16, GOLD)
  for (const x of [-1.1, 0, 1.1]) glow.box(x - 0.2, 5.3, Z0 + 0.13, x + 0.2, x === 0 ? 6.0 : 5.8, Z0 + 0.16, GOLD)

  // ------------------------------------------------ pillars, windows, banners, lanterns

  for (const x of [-3.6, 3.6]) for (const z of [-8, -3.5, 1]) {
    b.box(x - 0.7, 0, z - 0.7, x + 0.7, 0.4, z + 0.7, STONE_DARK, { bottom: false })
    b.prism(x, 0.4, z, 0.5, WALL_H - 0.9, 8, STONE, STONE_TOP, Math.PI / 8)
    b.box(x - 0.65, WALL_H - 0.5, z - 0.65, x + 0.65, WALL_H, z + 0.65, GOLD, { top: GOLD_DARK })
    solid(x - 0.55, -1, z - 0.55, x + 0.55, WALL_H, z + 0.55)
  }
  const glass = ['#ff8ac8', '#8fd8ff', '#ffd84f', '#b89aff', '#7fe0a0', '#ff9f6f']
  for (const [i, z] of [-11, -5.75, -0.5].entries()) {
    for (const s of [-1, 1]) {
      const wx = s < 0 ? X0 + 0.02 : X1 - 0.02
      const d = s < 0 ? 0.1 : -0.1
      b.box(Math.min(wx, wx + d * 1.5), 2.0, z - 1.0, Math.max(wx, wx + d * 1.5), 5.0, z + 1.0, STONE_DARK, { bottom: false })
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
        const col = glass[(r * 2 + c + i + (s > 0 ? 3 : 0)) % glass.length]!
        const zz = z - 0.8 + c * 0.82, yy = 2.2 + r * 0.9
        glow.box(Math.min(wx + d * 1.5, wx + d * 1.8), yy, zz, Math.max(wx + d * 1.5, wx + d * 1.8), yy + 0.8, zz + 0.76, col)
      }
    }
  }
  for (const z of [-8.4, -3.1]) for (const s of [-1, 1]) {
    const wx = s < 0 ? X0 : X1 - 0.12
    b.box(wx, 1.8, z - 0.6, wx + 0.12, 5.4, z + 0.6, s < 0 ? PINK : PURPLE, { bottom: false })
    b.box(wx - 0.02, 4.2, z - 0.6, wx + 0.14, 4.5, z + 0.6, GOLD, { bottom: false })
  }
  // Lanterns on the pillars, facing the carpet (no beams overhead: they would hide the throne from the camera).
  for (const x of [-3.6, 3.6]) for (const z of [-8, -3.5, 1]) {
    const fx = x < 0 ? x + 0.5 : x - 0.5, d = x < 0 ? 1 : -1
    b.box(Math.min(fx, fx + d * 0.35), 3.0, z - 0.2, Math.max(fx, fx + d * 0.35), 3.12, z + 0.2, GOLD_DARK)
    glow.box(Math.min(fx + d * 0.1, fx + d * 0.34), 3.12, z - 0.14, Math.max(fx + d * 0.1, fx + d * 0.34), 3.5, z + 0.14, '#fff1b0')
    b.box(Math.min(fx + d * 0.05, fx + d * 0.39), 3.5, z - 0.19, Math.max(fx + d * 0.05, fx + d * 0.39), 3.6, z + 0.19, GOLD)
  }

  // ------------------------------------------------ Slottsboka on its lectern

  const bx = -6.8, bz = 2.6
  b.block(bx, 0, bz, 0.5, 1.0, 0.5, '#8a5a3a')
  b.block(bx, 0, bz, 1.0, 0.15, 1.0, '#6a4a2a')
  b.at(bx, 1.0, bz, 0, () => {
    b.box(-0.7, 0, -0.5, 0.7, 0.18, 0.5, '#8a5a3a', { top: '#a06a44' })
    b.box(-0.65, 0.18, -0.42, 0.65, 0.26, 0.42, PURPLE)
    b.box(-0.6, 0.26, -0.38, -0.02, 0.32, 0.38, '#fffaf0')
    b.box(0.02, 0.26, -0.38, 0.6, 0.32, 0.38, '#fffaf0')
    for (let k = 0; k < 4; k++) {
      b.box(-0.5, 0.321, -0.25 + k * 0.15, -0.1, 0.33, -0.2 + k * 0.15, '#9a8ab0')
      b.box(0.1, 0.321, -0.25 + k * 0.15, 0.5, 0.33, -0.2 + k * 0.15, '#9a8ab0')
    }
  })
  solid(bx - 0.7, -1, bz - 0.5, bx + 0.7, 1.35, bz + 0.5)
  // A star over the book that bobs and turns: it says "here".
  const star = new Blocks()
  star.block(0, -0.2, 0, 0.4, 0.4, 0.14, GOLD)
  star.block(0, -0.08, 0, 0.7, 0.16, 0.14, GOLD)
  star.block(0, -0.34, 0, 0.14, 0.7, 0.14, GOLD)
  const starMesh = blocksMesh(star, glowMaterial())!
  starMesh.matrixAutoUpdate = true
  starMesh.position.set(bx, 2.4, bz)
  group.add(starMesh)

  // ------------------------------------------------ furniture: small thrones, piano, banquet

  const usables: Usable[] = []
  const models: FurnitureModelHandle[] = []
  const tmp = new THREE.Matrix4()
  /** A catalog model centred at (cx, y, cz), turned by rot (0 faces +z); solid unless it stands on something. */
  const put = (uid: string, id: string, level: 1 | 2 | 3, cx: number, y: number, cz: number, rot: number, opts: { solid?: boolean } = {}) => {
    const h = buildFurniture(id, level) as FurnitureModelHandle
    const W = h.def.size[0] * 1.5, D = h.def.size[1] * 1.5
    const pivot = new THREE.Group()
    pivot.position.set(cx, y, cz)
    pivot.rotation.y = rot
    h.group.position.set(-W / 2, 0, -D / 2)
    pivot.add(h.group)
    group.add(pivot)
    models.push(h)
    pivot.updateMatrix(); h.group.updateMatrix()
    if (h.def.use && h.useAt) {
      const at = h.useAt.clone().applyMatrix4(tmp.multiplyMatrices(pivot.matrix, h.group.matrix))
      usables.push({ uid, use: h.def.use, at, yaw: rot + h.useYaw })
    }
    if (opts.solid !== false) {
      const turned = Math.abs(Math.sin(rot)) > 0.5
      const hw = (turned ? D : W) / 2 - 0.06, hd = (turned ? W : D) / 2 - 0.06
      solid(cx - hw, y, cz - hd, cx + hw, y + Math.max(0.2, h.height), cz + hd)
    }
    return h
  }
  put('castle-throne-l', 'throne', 2, -3.2, DAIS2, -13.9, 0)
  put('castle-throne-r', 'throne', 2, 3.2, DAIS2, -13.9, 0)
  put('castle-piano', 'piano', 3, -8.0, 0, -5.75, Math.PI / 2)
  const table = put('castle-table', 'table-long', 2, 7.9, 0, -5.75, Math.PI / 2)
  put('castle-cake', 'cake', 3, 7.9, table.height, -5.75, 0, { solid: false })
  for (const [k, z] of [-6.5, -5].entries()) put(`castle-chair-${k}`, 'chair', 2, 6.4, 0, z, Math.PI / 2)
  put('castle-plant-l', 'plant-big', 1, -7.9, 0, 4.1, 0)
  put('castle-plant-r', 'plant-big', 1, 7.9, 0, 4.1, 0)
  usables.push({ uid: THRONE_UID, use: 'sit', at: new THREE.Vector3(0, seatTop - 0.55, -13.1), yaw: 0, what: 'throne' })

  const mesh = blocksMesh(b, blockMaterial(), { cast: true, receive: true })!
  const glowMesh = blocksMesh(glow, glowMaterial())!
  group.add(mesh, glowMesh)

  return {
    group,
    world,
    zones: [
      zone('exit', 'Gå ut', 0, Z1 + 0.6, GATE * 2, 2.4, -1, 4),
      zone('castle-book', 'Venner og nabolag', bx + 0.4, bz, 2.8, 2.8, -1, 4),
    ],
    spawn: { x: 0, y: 0, z: Z1 - 1.2, yaw: Math.PI },
    sky: SKIES.room,
    cam: { min: 5, max: 16, dist: 11, pitch: 0.6 },
    camCollide: false,
    usables: () => usables,
    update(dt, t) {
      starMesh.position.y = 2.4 + Math.sin(t * 2.2) * 0.15
      starMesh.rotation.y = t * 1.6
      for (const m of models) m.update(dt, t)
    },
    dispose() {
      for (const m of [mesh, glowMesh, starMesh]) { m.geometry.dispose(); (m.material as THREE.Material).dispose() }
      for (const m of models) m.dispose()
    },
  }
}
