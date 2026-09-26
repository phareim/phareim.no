/**
 * A house as a place (2026-09-26): your own (editable, "Pynt") or a
 * friend's (read-only visit). Wraps house.ts's HouseHandle: colliders into
 * a physics world (rebuilt when the layout changes), the door as the exit
 * zone, the built-in wardrobe as the 'wardrobe' zone (own house only), and
 * the room's sofas, beds and trampolines as `use:<uid>` spots.
 *
 * A visit also puts the owner's person in the room, waving, unless the
 * owner is home live (the shared world draws them then: `setHostHidden`).
 */
import * as THREE from 'three'
import type { AvatarHandle, HouseHandle } from './contracts'
import { CELL } from './contracts'
import type { FurnitureDef, HouseLayout, OwnedFurniture, PersonLook } from '../types'
import { HOUSE_W, HOUSE_D } from '../types'
import { createHouse } from './house'
import { buildAvatar } from './avatar'
import { SKIES } from './look'
import { createWorld, addStatic, box } from './physics'
import type { Body } from './physics'
import type { PlaceScene, Zone } from './place'

export type UseKind = NonNullable<FurnitureDef['use']>

export const USE_LABEL: Record<UseKind, string> = {
  sit: 'Sitt', sleep: 'Sov', bounce: 'Hopp', music: 'Spill', slide: 'Skli', light: 'Skru på', swim: 'Plask',
}

export interface Usable { uid: string; use: UseKind; at: THREE.Vector3; yaw: number }

export interface HomeScene extends PlaceScene {
  readonly house: HouseHandle
  readonly editable: boolean
  setLayout(layout: HouseLayout, owned: OwnedFurniture[]): void
  /** Rebuild colliders after an edit (the house changed its own layout). */
  refresh(): void
  usables(): Usable[]
  setEdit(on: boolean): void
  /** The fixed camera over the room for edit mode, far enough back to show the whole room at this fov/aspect. */
  editView(fov: number, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 }
  /** A visit: hide the owner's waving figure while they are here in person. */
  setHostHidden(hidden: boolean): void
}

const RW = HOUSE_W * CELL
const RD = HOUSE_D * CELL

export function buildHome(opts: { editable: boolean; layout: HouseLayout; owned: OwnedFurniture[]; host?: { look: PersonLook | null; name: string } }): HomeScene {
  const house = createHouse({ editable: opts.editable }) as HouseHandle & { wardrobe?: THREE.Box3; setView?(p: THREE.Vector3): void }
  const group = new THREE.Group()
  group.name = opts.editable ? 'home' : 'visit'
  group.add(house.group)
  house.setLayout(opts.layout, opts.owned)

  // A garden round the room, so it does not float in nothing.
  const lawnGeo = new THREE.BoxGeometry(RW + 40, 1, RD + 40)
  const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshToonMaterial({ color: '#7fe0a0' }))
  lawn.position.set(RW / 2, -0.52, RD / 2)
  lawn.receiveShadow = true
  group.add(lawn)

  let host: AvatarHandle | null = null
  if (!opts.editable && opts.host?.look) {
    host = buildAvatar(opts.host.look)
    host.setTag(opts.host.name, null)
    host.group.position.set(RW / 2, 0, RD / 2 - 1)
    group.add(host.group)
  }

  const zones: Zone[] = []
  const d = house.door
  zones.push({ id: 'exit', label: 'Gå ut', minX: d.min.x - 0.3, maxX: d.max.x + 0.3, minZ: d.min.z - 0.8, maxZ: d.max.z + 0.5, minY: -1, maxY: 3 })
  if (opts.editable && house.wardrobe) {
    const w = house.wardrobe
    zones.push({ id: 'wardrobe', label: 'Kle deg', minX: w.min.x - 1.6, maxX: w.max.x, minZ: w.min.z - 0.2, maxZ: w.max.z + 0.2, minY: -1, maxY: 3 })
  }

  const self: HomeScene = {
    group,
    world: createWorld({ killY: -20 }),
    zones,
    spawn: { x: house.spawn.x, y: 0, z: house.spawn.z, yaw: Math.PI },
    sky: SKIES.room,
    cam: { min: 5, max: 14, dist: 10, pitch: 0.75 },
    camCollide: false,
    house,
    editable: opts.editable,
    editView(fov, aspect) {
      const half = Math.tan((fov * Math.PI) / 360)
      const hHalf = half * aspect
      // Fit the room's width and depth (seen at about 58° down), with a margin.
      const d = Math.max((RW / 2 + 1.2) / hHalf, (RD * 0.55 + 1.2) / half, 14)
      const dir = new THREE.Vector3(0, 1.6, 1).normalize()
      const look = new THREE.Vector3(RW / 2, 0, RD / 2 + 0.4)
      return { pos: look.clone().addScaledVector(dir, d), look }
    },
    setLayout(layout, owned) {
      house.setLayout(layout, owned)
      self.refresh()
    },
    refresh() {
      const w = createWorld({ killY: -20 })
      addStatic(w, box(-30, -1, -30, RW + 30, 0, RD + 30))
      for (const c of house.colliders()) addStatic(w, box(c.min.x, c.min.y, c.min.z, c.max.x, c.max.y, c.max.z))
      self.world = w
    },
    usables() {
      return house.usables() as Usable[]
    },
    setEdit(on) {
      house.setEdit(on)
    },
    setHostHidden(hidden) {
      if (host) host.group.visible = !hidden
    },
    update(dt, t, _body: Body) {
      house.update(dt, t)
      if (host?.group.visible) host.animate('wave', dt, 0)
    },
    dispose() {
      if (host) { group.remove(host.group); host.dispose() }
      house.dispose()
      lawnGeo.dispose()
      ;(lawn.material as THREE.Material).dispose()
    },
  }
  self.refresh()
  return self
}
