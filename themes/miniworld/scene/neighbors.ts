/**
 * Nabogata's people (2026-09-26): a house for each friend or neighbour on
 * the plots in town.ts, with a name sign (a crown on it for a title) and
 * their active person waving by the gate. Their door is a zone
 * `neighbor:<playerId>` ("Se på"). Empty plots get a "LEDIG TOMT" sign.
 * The sign by your own house says whose it is.
 *
 * Houses merge into one mesh, signs into one atlas; the people are real
 * avatars (buildAvatar), animated only when you are near.
 */
import * as THREE from 'three'
import type { AvatarHandle, NeighborInfo } from './contracts'
import type { RoyalTitle } from '../types'
import { buildAvatar } from './avatar'
import { Blocks, SignAtlas, blocksMesh, hash2, paintCrown } from './blocks'
import type { Box } from './physics'
import { box } from './physics'
import { blockMaterial, glowMaterial } from './look'
import { zone } from './place'
import type { Zone } from './place'
import { NEIGHBOR_SLOTS, NEIGHBOR_HOUSE, HOME, paintHouse, shade } from './town'
import type { HouseStyle } from './town'

const WALLS = ['#ffd0e4', '#c4f0ff', '#fff1b0', '#d8c8ff', '#c8f5d8', '#ffe0c0', '#ffffff']
const ROOFS = ['#4fb8ff', '#ff6f6f', '#7a5ff0', '#2fb88a', '#ff9f3f', '#ff5fa8']
const DOORS = ['#ff5fa8', '#ffd84f', '#4fb8ff', '#7fe07f', '#b89aff']

function styleFor(id: string): HouseStyle {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const pick = <T>(a: T[], k: number) => a[Math.floor(hash2(h, k, 3) * a.length)]!
  return { wall: pick(WALLS, 1), roof: pick(ROOFS, 2), door: pick(DOORS, 3), trim: '#ffffff', h: 3.8 }
}

/** "Ulrikke" → "ULRIKKES HUS", "Mons" → "MONS' HUS". */
export function houseName(name: string): string {
  const n = name.trim().toUpperCase()
  if (!n) return 'DITT HUS'
  return /[SXZ]$/.test(n) ? `${n}' HUS` : `${n}S HUS`
}

export interface Neighbors {
  readonly group: THREE.Group
  readonly boxes: Box[]
  readonly zones: Zone[]
  /** Your own house's sign. */
  setHome(name: string, title: RoyalTitle | null): void
  update(dt: number, px: number, pz: number): void
  dispose(): void
}

export function buildNeighbors(list: NeighborInfo[]): Neighbors {
  const group = new THREE.Group()
  group.name = 'neighbors'
  const props = new Blocks()
  const glow = new Blocks()
  const boxes: Box[] = []
  const zones: Zone[] = []
  const people: { a: AvatarHandle; x: number; z: number; ph: number }[] = []

  // Signs: neighbours on one atlas, your home on its own (it changes with the player).
  const atlas = new SignAtlas(512, 256)
  const signs = new Blocks(true)
  const homeAtlas = new SignAtlas(256, 32)
  const homeSigns = new Blocks(true)

  const post = (x: number, z: number) => {
    props.block(x, 0, z, 0.2, 1.9, 0.2, '#8a5a3a')
    boxes.push(box(x - 0.15, 0, z - 0.15, x + 0.15, 1.9, z + 0.15))
  }
  const board = (b: Blocks, uv: [number, number, number, number], aspect: number, x: number, z: number, face: 1 | -1) => {
    const h = 0.62, w = h * aspect
    b.at(x, 0, z, face > 0 ? 0 : Math.PI, () => b.panel(0, 2.15, 0.12, w, h, '#ffffff', uv))
    b.at(x, 0, z, face > 0 ? Math.PI : 0, () => b.panel(0, 2.15, 0.12, w, h, '#ffffff', uv))
    props.box(x - w / 2 - 0.06, 1.8, z - 0.1, x + w / 2 + 0.06, 2.5, z + 0.1, '#8a5a3a')
  }

  NEIGHBOR_SLOTS.forEach((slot, i) => {
    const n = list[i]
    const { w, d } = NEIGHBOR_HOUSE
    const frontZ = slot.face > 0 ? slot.z + d / 2 : slot.z - d / 2
    const signX = slot.x - w / 2 + 0.6
    const signZ = frontZ + slot.face * 1.6
    if (!n) {
      // An empty plot: a tuft of flowers and a sign.
      post(signX, signZ)
      const s = atlas.add(['LEDIG TOMT'], { bg: '#fff8fc', fg: '#8a8a9a', border: '#8a5a3a', scale: 1, pad: 2 })
      board(signs, s.uv, s.aspect, signX, signZ, slot.face)
      for (let k = 0; k < 6; k++) props.block(slot.x + (hash2(i, k, 1) - 0.5) * 5, 0, slot.z + (hash2(i, k, 2) - 0.5) * 5, 0.3, 0.35, 0.3, ['#ff6fb0', '#ffd84f', '#ffffff'][k % 3]!)
      return
    }
    const st = styleFor(n.playerId)
    paintHouse(props, glow, boxes, slot.x, slot.z, w, d, slot.face, st)
    post(signX, signZ)
    const label = n.label.toUpperCase().slice(0, 14)
    const s = atlas.add([label], { bg: '#fff8fc', fg: shade(st.roof, 0.7), border: '#8a5a3a', scale: 1, pad: 2 }, n.title ? { w: 5, h: 5, paint: paintCrown } : undefined)
    board(signs, s.uv, s.aspect, signX, signZ, slot.face)
    const doorZ = frontZ + slot.face * 1.3
    zones.push(zone(`neighbor:${n.playerId}`, 'Se på', slot.x, doorZ, 2.6, 2.6, -1, 4))
    if (n.look) {
      const a = buildAvatar(n.look)
      const px = slot.x + w / 2 - 1.2, pz = frontZ + slot.face * 1.8
      a.group.position.set(px, 0, pz)
      a.group.rotation.y = slot.face > 0 ? 0 : Math.PI
      a.group.traverse(o => { o.castShadow = false })
      a.setTag(null, null)
      group.add(a.group)
      people.push({ a, x: px, z: pz, ph: i * 0.7 })
      boxes.push(box(px - 0.5, 0, pz - 0.35, px + 0.5, 2.6, pz + 0.35))
    }
  })

  // Your own house's sign by the gate.
  const homeSignX = HOME.x - HOME.w / 2 - 0.2, homeSignZ = HOME.doorZ + 2.9
  post(homeSignX, homeSignZ)
  let homeMesh: THREE.Mesh | null = null
  const homeMat = new THREE.MeshBasicMaterial({ map: homeAtlas.texture, alphaTest: 0.5 })
  const boardMat = blockMaterial()

  const propsMesh = blocksMesh(props, blockMaterial(), { cast: true, receive: true })
  const glowMesh = blocksMesh(glow, glowMaterial())
  const signMat = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.5 })
  const signMesh = blocksMesh(signs, signMat)
  for (const m of [propsMesh, glowMesh, signMesh]) if (m) group.add(m)

  return {
    group,
    boxes,
    zones,
    setHome(name, title) {
      homeAtlas.clear()
      const s = homeAtlas.add([houseName(name)], { bg: '#fff8fc', fg: '#ff5fa8', border: '#8a5a3a', scale: 1, pad: 2 }, title ? { w: 5, h: 5, paint: paintCrown } : undefined)
      if (homeMesh) { group.remove(homeMesh); homeMesh.geometry.dispose() }
      const b = new Blocks(true)
      const h = 0.62, w = h * s.aspect
      b.at(homeSignX, 0, homeSignZ, 0, () => b.panel(0, 2.15, 0.12, w, h, '#ffffff', s.uv))
      b.at(homeSignX, 0, homeSignZ, Math.PI, () => b.panel(0, 2.15, 0.12, w, h, '#ffffff', s.uv))
      b.box(homeSignX - w / 2 - 0.06, 1.8, homeSignZ - 0.1, homeSignX + w / 2 + 0.06, 2.5, homeSignZ + 0.1, '#8a5a3a')
      // The text panels use the atlas, the board behind them vertex colours: one mesh, two groups.
      const g = b.build()
      g.addGroup(0, 12, 0)
      g.addGroup(12, Infinity, 1)
      homeMesh = new THREE.Mesh(g, [homeMat, boardMat])
      group.add(homeMesh)
    },
    update(dt, px, pz) {
      for (const p of people) {
        const dx = p.x - px, dz = p.z - pz
        const near = dx * dx + dz * dz < 45 * 45
        p.a.group.visible = near
        if (near) p.a.animate('wave', dt, 0)
      }
    },
    dispose() {
      for (const p of people) { group.remove(p.a.group); p.a.dispose() }
      for (const m of [propsMesh, glowMesh, signMesh, homeMesh]) if (m) m.geometry.dispose()
      propsMesh && (propsMesh.material as THREE.Material).dispose()
      glowMesh && (glowMesh.material as THREE.Material).dispose()
      signMat.dispose(); homeMat.dispose(); boardMat.dispose()
      atlas.dispose(); homeAtlas.dispose()
    },
  }
}
