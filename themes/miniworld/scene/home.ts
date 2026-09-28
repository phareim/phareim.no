/**
 * A house as a place (2026-09-26): your own (editable, "Pynt") or a
 * friend's (read-only visit). Wraps house.ts's HouseHandle: colliders into
 * a physics world (rebuilt when the layout changes), the door as the exit
 * zone, the built-in wardrobe as the 'wardrobe' zone (own house only), and
 * the room's sofas, beds and trampolines as `use:<uid>` spots.
 *
 * Storeys (2026-09-28): one handle per storey, stacked STOREY_H apart. The
 * storey you are on and the ones below show; the ones above hide, so the
 * room is open from above like a dollhouse. Physics, zones and usables are
 * the current storey's. Walking up the stairs to the top step, or into the
 * opening from above, or the action button at the foot or the landing,
 * moves you (`move`, `stairMove`).
 *
 * A visit also puts the owner's person in the room, waving, unless the
 * owner is home live (the shared world draws them then: `setHostHidden`).
 */
import * as THREE from 'three'
import type { AvatarHandle } from './contracts'
import { CELL } from './contracts'
import type { FurnitureDef, HouseLayout, OwnedFurniture, PersonLook } from '../types'
import { HOUSE_W, HOUSE_D } from '../types'
import { rooms, roomAt, withRoom } from '../core/save'
import { createHouse, STOREY_H, stairStand, stepBox, holeArea } from './house'
import type { StoreyHandle } from './house'
import { buildAvatar } from './avatar'
import { SKIES } from './look'
import { createWorld, addStatic, box } from './physics'
import type { Body } from './physics'
import type { PlaceScene, Zone, Spot } from './place'

export type UseKind = NonNullable<FurnitureDef['use']>

export const USE_LABEL: Record<UseKind, string> = {
  sit: 'Sitt', sleep: 'Sov', bounce: 'Hopp', music: 'Spill', slide: 'Skli', light: 'Skru på', swim: 'Plask',
}

export interface Usable { uid: string; use: UseKind; at: THREE.Vector3; yaw: number }

export interface HomeScene extends PlaceScene {
  /** The storey shown now: edits and the pointer go to it. */
  readonly house: StoreyHandle
  /** 0 = the ground. */
  readonly storey: number
  readonly storeys: number
  readonly editable: boolean
  setLayout(layout: HouseLayout, owned: OwnedFurniture[]): void
  /** Rebuild colliders after an edit (the house changed its own layout). */
  refresh(): void
  usables(): Usable[]
  setEdit(on: boolean): void
  /** The fixed camera over the current storey for edit mode, far enough back to show the whole room at this fov/aspect. */
  editView(fov: number, aspect: number): { pos: THREE.Vector3; look: THREE.Vector3 }
  /** A visit: hide the owner's waving figure while they are here in person. */
  setHostHidden(hidden: boolean): void
  /** The whole house after an edit of the current storey's room (null stays null). */
  full(room: HouseLayout | null): HouseLayout | null
  /** One storey up (1) or down (−1) by the stairs: where to stand there, or null when there is no way. */
  move(dir: 1 | -1): Spot | null
  /** Show storey `k` (decorating); where to stand there. */
  showStorey(k: number): Spot
  /** Per frame: the top step or the opening walked into; the move is made, and this is where to stand. */
  stairMove(body: Body): Spot | null
}

const RW = HOUSE_W * CELL
const RD = HOUSE_D * CELL

const stairsKey = (l: HouseLayout) => JSON.stringify(rooms(l).map(r => r.stair ?? null))

export function buildHome(opts: { editable: boolean; layout: HouseLayout; owned: OwnedFurniture[]; host?: { look: PersonLook | null; name: string } }): HomeScene {
  const group = new THREE.Group()
  group.name = opts.editable ? 'home' : 'visit'

  let layout = opts.layout
  let owned = opts.owned
  let handles: StoreyHandle[] = []
  let key = ''
  let current = 0
  let editing = false
  let cool = 0

  const build = () => {
    for (const h of handles) { group.remove(h.group); h.dispose() }
    const rs = rooms(layout)
    handles = rs.map((_, k) => {
      const h = createHouse({ editable: opts.editable, storey: { index: k, stair: k < rs.length - 1 ? rs[k]!.stair ?? null : null, hole: k > 0 ? rs[k - 1]!.stair ?? null : null } }) as StoreyHandle
      h.group.position.y = k * STOREY_H
      h.setLayout(roomAt(layout, k) as HouseLayout, owned)
      group.add(h.group)
      return h
    })
    key = stairsKey(layout)
    current = Math.min(current, handles.length - 1)
    if (editing) handles[current]!.setEdit(true)
  }
  build()

  // A garden round the room, so it does not float in nothing.
  const lawnGeo = new THREE.BoxGeometry(RW + 40, 1, RD + 40)
  const lawn = new THREE.Mesh(lawnGeo, new THREE.MeshToonMaterial({ color: '#7fe0a0' }))
  lawn.position.set(RW / 2, -0.52, RD / 2)
  lawn.receiveShadow = true
  group.add(lawn)

  let host: AvatarHandle | null = null
  let hostHidden = false
  if (!opts.editable && opts.host?.look) {
    host = buildAvatar(opts.host.look)
    host.setTag(opts.host.name, null)
    host.group.position.set(RW / 2, 0, RD / 2 - 1)
    group.add(host.group)
  }

  const base = () => current * STOREY_H
  const cur = () => handles[current]!

  const zonesFor = (): Zone[] => {
    const h = cur()
    const y = base()
    const zs: Zone[] = []
    if (current === 0) {
      const d = h.door
      zs.push({ id: 'exit', label: 'Gå ut', minX: d.min.x - 0.3, maxX: d.max.x + 0.3, minZ: d.min.z - 0.8, maxZ: d.max.z + 0.5, minY: -1, maxY: 3 })
      if (opts.editable && h.wardrobe) {
        const w = h.wardrobe
        zs.push({ id: 'wardrobe', label: 'Kle deg', minX: w.min.x - 1.6, maxX: w.max.x, minZ: w.min.z - 0.2, maxZ: w.max.z + 0.2, minY: -1, maxY: 3 })
      }
    }
    const cellZone = (id: 'stair-up' | 'stair-down', label: string, x: number, z: number): Zone =>
      ({ id, label, minX: x - CELL * 0.6, maxX: x + CELL * 0.6, minZ: z - CELL * 0.6, maxZ: z + CELL * 0.6, minY: y - 1, maxY: y + 1.2 })
    if (h.storey.stair) { const f = stairStand(h.storey.stair); zs.push(cellZone('stair-up', 'Gå opp', f.x, f.z)) }
    if (h.storey.hole) { const f = stairStand(h.storey.hole); zs.push(cellZone('stair-down', 'Gå ned', f.x, f.z)) }
    return zs
  }

  const show = () => {
    handles.forEach((h, k) => { h.group.visible = k <= current })
    handles.forEach((h, k) => { if (k !== current) h.setEdit(false) })
    cur().setEdit(editing)
    self.zones = zonesFor()
    self.refresh()
  }

  const standAt = (k: number, dir: 1 | -1 | 0): Spot => {
    const h = handles[k]!
    const y = k * STOREY_H
    // Coming up: the landing by the opening. Coming down: the foot of the stairs. Otherwise the storey's own spawn.
    if (dir > 0 && h.storey.hole) { const f = stairStand(h.storey.hole); return { x: f.x, y, z: f.z, yaw: f.yaw } }
    if (dir < 0 && h.storey.stair) { const f = stairStand(h.storey.stair); return { x: f.x, y, z: f.z, yaw: f.yaw } }
    return { x: h.spawn.x, y, z: h.spawn.z, yaw: Math.PI }
  }

  const self: HomeScene = {
    group,
    world: createWorld({ killY: -20 }),
    zones: [],
    spawn: { x: handles[0]!.spawn.x, y: 0, z: handles[0]!.spawn.z, yaw: Math.PI },
    sky: SKIES.room,
    cam: { min: 5, max: 14, dist: 10, pitch: 0.75 },
    camCollide: false,
    get house() { return cur() },
    get storey() { return current },
    get storeys() { return handles.length },
    editable: opts.editable,
    editView(fov, aspect) {
      const half = Math.tan((fov * Math.PI) / 360)
      const hHalf = half * aspect
      // Fit the room's width and depth (seen at about 58° down), with a margin.
      const d = Math.max((RW / 2 + 1.2) / hHalf, (RD * 0.55 + 1.2) / half, 14)
      const dir = new THREE.Vector3(0, 1.6, 1).normalize()
      const look = new THREE.Vector3(RW / 2, base(), RD / 2 + 0.4)
      return { pos: look.clone().addScaledVector(dir, d), look }
    },
    setLayout(next, nextOwned) {
      layout = next
      owned = nextOwned
      if (stairsKey(next) !== key) build()
      else handles.forEach((h, k) => h.setLayout(roomAt(next, k) as HouseLayout, nextOwned))
      show()
    },
    refresh() {
      const w = createWorld({ killY: -20 })
      const y = base()
      addStatic(w, box(-30, y - 1, -30, RW + 30, y, RD + 30))
      for (const c of cur().colliders()) addStatic(w, box(c.min.x, c.min.y + y, c.min.z, c.max.x, c.max.y + y, c.max.z))
      self.world = w
    },
    usables() {
      const y = base()
      return (cur().usables() as Usable[]).map(u => ({ ...u, at: u.at.clone().setY(u.at.y + y) }))
    },
    setEdit(on) {
      editing = on
      cur().setEdit(on)
    },
    setHostHidden(hidden) {
      hostHidden = hidden
      if (host) host.group.visible = !hidden && current === 0
    },
    full(room) {
      if (!room) return null
      layout = withRoom(layout, current, room)
      return layout
    },
    move(dir) {
      const k = current + dir
      if (k < 0 || k >= handles.length) return null
      const h = cur()
      if (dir > 0 ? !h.storey.stair : !h.storey.hole) return null
      current = k
      cool = 0.8
      show()
      return standAt(k, dir)
    },
    showStorey(k) {
      const to = Math.max(0, Math.min(handles.length - 1, k))
      const dir = to > current ? 1 : to < current ? -1 : 0
      current = to
      show()
      return standAt(to, dir)
    },
    stairMove(body) {
      if (cool > 0 || editing) return null
      const h = cur()
      const ly = body.y - base()
      if (h.storey.stair && body.onGround && ly > STOREY_H - 1.3) {
        const top = stepBox(h.storey.stair, 7, 0).union(stepBox(h.storey.stair, 6, 0))
        if (body.x >= top.min.x && body.x <= top.max.x && body.z >= top.min.z && body.z <= top.max.z) return self.move(1)
      }
      if (h.storey.hole && ly < 0.6) {
        const a = holeArea(h.storey.hole)
        if (body.x >= a.min.x && body.x <= a.max.x && body.z >= a.min.z && body.z <= a.max.z) return self.move(-1)
      }
      return null
    },
    update(dt, t, _body: Body) {
      cool = Math.max(0, cool - dt)
      for (const [k, h] of handles.entries()) if (k <= current) h.update(dt, t)
      if (host) host.group.visible = !hostHidden && current === 0
      if (host?.group.visible) host.animate('wave', dt, 0)
    },
    dispose() {
      if (host) { group.remove(host.group); host.dispose() }
      for (const h of handles) h.dispose()
      lawnGeo.dispose()
      ;(lawn.material as THREE.Material).dispose()
    },
  }
  show()
  return self
}
