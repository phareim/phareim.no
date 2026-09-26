/**
 * Mini World's 3D runtime (2026-09-26): the loop, the player, the places.
 *
 * One three.js scene rendered through look.ts (low-res target, outline,
 * whole-number upscale). The town is built once and hidden while you are
 * elsewhere; a house, a visit, an obby, the meadow or the catwalk is built
 * on `go` and disposed on leaving. The player is a physics body
 * (physics.ts, fixed 120 Hz steps) under an avatar from avatar.ts; the
 * camera orbits behind (camera.ts); keyboard and mouse come from input.ts,
 * touch from the UI through `input`.
 *
 * The runtime never navigates by itself: walking up to a door shows its
 * action ('near'), pressing it sends 'zone', and the UI calls `go`.
 * Furniture in a house is the exception: sitting, sleeping and bouncing
 * happen here (`use:<uid>` zones, 'using' events).
 *
 * The shared world (2026-09-26): other players come in through `peers`
 * and are drawn by peers.ts in whatever place has your place key
 * (peerMotion.ts `placeKey`); `selfState` is what the shell sends of you,
 * and your magic and emotes go out as 'fx-out'. A tap on another player
 * sends 'peer'.
 */
import * as THREE from 'three'
import type {
  CreateRuntime, MiniWorldRuntime, RuntimeEvent, Place, ZoneId, AvatarHandle, AvatarPose, NeighborInfo, TownSpot,
} from './contracts'
import { emptyInput } from './contracts'
import type { PersonLook, RoyalTitle, Weapon, HouseLayout, OwnedFurniture } from '../types'
import { buildAvatar } from './avatar'
import { buildWeaponModel } from './weapons'
import { createLook, createSky, setSky, createLights, SKIES } from './look'
import { createOrbitCamera } from './camera'
import { attachInput } from './input'
import { createBody, createEvents, placeBody, pressJump, updateMovers, stepBody, groundBelow, PHYS } from './physics'
import type { Body } from './physics'
import { buildTown, BALLOON_AREA } from './town'
import type { TownScene } from './town'
import { buildNeighbors } from './neighbors'
import type { Neighbors } from './neighbors'
import { buildHome, USE_LABEL } from './home'
import type { HomeScene, Usable } from './home'
import { buildObby } from './obby'
import type { ObbyScene } from './obby'
import { buildStars } from './stars'
import type { StarsScene } from './stars'
import { buildCatwalk } from './catwalk'
import { createParticles, createBalloons, fireMagic } from './play'
import { createPeerLayer, floatHeart } from './peers'
import { placeKey, localToken } from './peerMotion'
import { packState } from '../net/protocol'
import type { NetPose } from '../net/protocol'
import { inZone } from './place'
import type { PlaceScene, Spot, Zone } from './place'

/** Bits from popping balloons, at most this many per session. */
export const POP_CAP = 30

const TOWN_SPOTS: Record<TownSpot, Spot> = {
  torget: { x: 0, y: 0, z: 8.5, yaw: Math.PI },
  butikkgata: { x: 30, y: 0, z: 1.5, yaw: Math.PI / 2 },
  tivoliet: { x: 0, y: 0, z: 24, yaw: 0 },
  slottet: { x: 0, y: 3, z: -38.6, yaw: Math.PI },
  nabogata: { x: -16, y: 0, z: 1, yaw: -Math.PI / 2 },
}

type Using = { kind: Usable['use']; uid: string; at: THREE.Vector3; yaw: number; pose: AvatarPose; t: number }

export const createRuntime: CreateRuntime = (canvas, opts) => {
  const look = createLook(canvas, { lowPower: opts.lowPower })
  const scene = new THREE.Scene()
  const sky = createSky()
  scene.add(sky)
  setSky(sky, scene, SKIES.day)
  const lights = createLights(scene, !opts.lowPower)
  const cam = createOrbitCamera()
  const particles = createParticles(opts.lowPower ? 400 : 700)
  scene.add(particles.points)
  const input = emptyInput()
  const handlers = new Set<(e: RuntimeEvent) => void>()
  const emit = (e: RuntimeEvent) => { for (const h of handlers) h(e) }
  const sfx = (name: Extract<RuntimeEvent, { type: 'sfx' }>['name']) => emit({ type: 'sfx', name })

  // ------------------------------------------------ other players

  const peerLayer = createPeerLayer(scene, particles, { lowPower: opts.lowPower, emit })
  const livePubs = new Set<string>()
  let peerVersion = -1
  const myKey = () => placeKey(place, selfPub, token)
  /** Neighbours and a visited host who are here live step aside for their live selves. */
  const syncLive = () => {
    peerVersion = peerLayer.version
    peerLayer.pubsIn('town', livePubs)
    neighbors.setHidden(livePubs)
    if (place.kind === 'visit' && current !== town) {
      const host = place.playerId
      peerLayer.pubsIn(`house:${host}`, livePubs)
      ;(current as HomeScene).setHostHidden(livePubs.has(host))
    }
  }

  // ------------------------------------------------ town

  const town: TownScene = buildTown(particles)
  scene.add(town.group)
  let popBits = 0
  const balloons = createBalloons(BALLOON_AREA, opts.lowPower ? 12 : 18, particles, (x, _y, z, gold, own) => {
    if (!own) {
      // Another player's magic: the balloon pops for you too, but pays nothing.
      const dx = x - body.x, dz = z - body.z
      if (dx * dx + dz * dz < 20 * 20) sfx('pop')
      return
    }
    const want = gold ? 3 : 1
    const bits = Math.max(0, Math.min(want, POP_CAP - popBits))
    popBits += bits
    emit({ type: 'pop', bits })
    sfx('pop')
    if (bits > 0) sfx('coin')
  })
  town.group.add(balloons.group)
  // A wand in Verkstedet's window.
  const shopWeapon = (() => {
    try {
      const w = buildWeaponModel({ uid: 'shop', base: 'wand', magic: 'stars', color: '#ff8ae0', level: 3, name: '' })
      w.group.position.copy(town.weaponSpot)
      w.group.rotation.set(-0.5, 0.6, 0)
      town.group.add(w.group)
      return w
    } catch { return null }
  })()

  let neighbors: Neighbors = buildNeighbors([])
  town.group.add(neighbors.group)
  town.setExtraBoxes(neighbors.boxes)
  town.setExtraZones(neighbors.zones)

  // ------------------------------------------------ player

  const body: Body = createBody(town.spawn.x, town.spawn.y, town.spawn.z)
  let facing = town.spawn.yaw
  let avatar: AvatarHandle | null = null
  let lookKey = ''
  let playerName = ''
  let playerTitle: RoyalTitle | null = null
  let weapon: Weapon | null = null
  let lastLook: PersonLook | null = null
  const ev = createEvents()
  const intent = { mx: 0, mz: 0, jump: false }
  let acc = 0

  // Blob shadow under the feet (the sun's shadow falls off to the side; this one says where you land).
  const blobGeo = new THREE.CircleGeometry(0.55, 10)
  blobGeo.rotateX(-Math.PI / 2)
  const blobMat = new THREE.MeshBasicMaterial({ color: '#2a1a4c', transparent: true, opacity: 0.32, depthWrite: false })
  const blob = new THREE.Mesh(blobGeo, blobMat)
  blob.renderOrder = 2
  scene.add(blob)

  // ------------------------------------------------ places

  let place: Place = { kind: 'town' }
  let current: PlaceScene = town
  let home: HomeScene | null = null
  let houseLayout: HouseLayout | null = null
  let houseOwned: OwnedFurniture[] = []
  let lastTownZone: ZoneId | null = null
  let near: { id: ZoneId; label: string } | null = null
  let using: Using | null = null
  let cheer = 0
  let swing = 0
  let magicCool = 0
  let emoteT = 0
  let emotePose: AvatarPose = 'wave'
  let selfPose: AvatarPose = 'idle'
  let selfSpeed = 0
  let selfPub = ''
  const token = localToken()
  let clock = 0
  let peerClock: () => number = () => performance.now()
  let lastSafe: Spot = { ...town.spawn }

  const setNear = (z: { id: ZoneId; label: string } | null) => {
    if ((z?.id ?? null) === (near?.id ?? null) && (z?.label ?? null) === (near?.label ?? null)) return
    near = z
    emit({ type: 'near', zone: z?.id ?? null, label: z?.label ?? null })
  }

  const put = (s: Spot) => {
    placeBody(body, s.x, s.y, s.z)
    facing = s.yaw
    acc = 0
    cam.snap(s.x, s.y + 2, s.z, s.yaw)
  }

  const stopUsing = () => {
    if (!using) return
    using = null
    emit({ type: 'using', what: null })
  }

  const leave = () => {
    stopUsing()
    if (current === town) {
      town.group.visible = false
      return
    }
    const kind = place.kind
    if (kind === 'obby' && !(current as ObbyScene).finished) emit({ type: 'obby-end', result: null })
    scene.remove(current.group)
    if (current === home) home = null
    current.dispose()
  }

  const enter = (next: PlaceScene) => {
    current = next
    if (next !== town) scene.add(next.group)
    else town.group.visible = true
    setSky(sky, scene, next.sky)
    const c = next.cam ?? { min: 4, max: 24, dist: 12 }
    cam.setRange(c.min, c.max, c.dist)
    if (c.pitch !== undefined) cam.pitch = c.pitch
    cam.fix(next.view ?? null)
    particles.clear()
    setNear(null)
  }

  const samePlace = (a: Place, b: Place) => {
    if (a.kind !== b.kind) return false
    if (a.kind === 'obby' && b.kind === 'obby') return a.level === b.level
    if (a.kind === 'visit' && b.kind === 'visit') return a.playerId === b.playerId
    return a.kind !== 'town' && a.kind !== 'catwalk' && a.kind !== 'stars'
  }

  function go(p: Place, visit?: { layout: HouseLayout; owned: OwnedFurniture[]; look: PersonLook | null; name: string }) {
    // Own house: toggling Pynt keeps the room.
    if (p.kind === 'house' && place.kind === 'house' && home) {
      if (p.edit !== place.edit) {
        home.setEdit(p.edit)
        cam.fix(p.edit ? home.editView(cam.camera.fov, cam.camera.aspect) : null)
        stopUsing()
        place = p
        emit({ type: 'place', place: p })
      }
      return
    }
    if (samePlace(place, p) && p.kind !== 'house') return
    const from = place
    if (from.kind === 'town' && near) lastTownZone = near.id
    leave()
    place = p
    switch (p.kind) {
      case 'town': {
        enter(town)
        const back: ZoneId | null = from.kind === 'house' ? 'home'
          : from.kind === 'obby' ? 'booth-obby'
            : from.kind === 'stars' ? 'booth-stars'
              : from.kind === 'catwalk' ? 'booth-fashion'
                : from.kind === 'visit' ? (`neighbor:${from.playerId}` as ZoneId)
                  : null
        const spot = p.at ? TOWN_SPOTS[p.at] : from.kind === 'town' ? { x: body.x, y: body.y, z: body.z, yaw: facing } : town.arrival(back ?? lastTownZone ?? 'home')
        put(spot)
        break
      }
      case 'house': {
        home = buildHome({ editable: true, layout: houseLayout ?? { floor: 'floor-wood', wall: 'wall-cream', items: [] }, owned: houseOwned })
        enter(home)
        if (p.edit) { home.setEdit(true); cam.fix(home.editView(cam.camera.fov, cam.camera.aspect)) }
        put(home.spawn)
        break
      }
      case 'visit': {
        const h = buildHome({ editable: false, layout: visit?.layout ?? { floor: 'floor-wood', wall: 'wall-cream', items: [] }, owned: visit?.owned ?? [], host: visit ? { look: visit.look, name: visit.name } : undefined })
        enter(h)
        put(h.spawn)
        break
      }
      case 'obby': {
        const o = buildObby(p.level, particles, emit)
        enter(o)
        put(o.spawn)
        break
      }
      case 'stars': {
        const s = buildStars(particles, emit)
        enter(s)
        put(s.spawn)
        break
      }
      case 'catwalk': {
        const c = buildCatwalk(particles)
        enter(c)
        put(c.spawn)
        break
      }
    }
    lastSafe = { x: body.x, y: body.y, z: body.z, yaw: facing }
    emoteT = 0
    peerVersion = -1
    sfx('door')
    emit({ type: 'place', place: p })
  }

  // ------------------------------------------------ input

  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  const inputHandle = attachInput(canvas, input, {
    isEdit: () => place.kind === 'house' && place.edit,
    editPointer(kind, x, y) {
      if (!home) return
      const r = canvas.getBoundingClientRect()
      ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, cam.camera)
      const out = home.house.pointer(kind, raycaster.ray)
      if (!out) return
      if (out.select !== undefined) emit({ type: 'select', uid: out.select })
      if (out.layout) layoutChanged(out.layout)
    },
    peerAt(x, y) {
      if (!peerLayer.here) return null
      const r = canvas.getBoundingClientRect()
      if (!r.width || !r.height) return null
      ndc.set((x / r.width) * 2 - 1, -(y / r.height) * 2 + 1)
      raycaster.setFromCamera(ndc, cam.camera)
      return peerLayer.pick(raycaster.ray)
    },
    tapPeer(id) { emit({ type: 'peer', id }) },
  })

  const layoutChanged = (l: HouseLayout | null) => {
    if (!l) return
    houseLayout = l
    home?.refresh()
    emit({ type: 'layout', layout: l })
  }

  // ------------------------------------------------ per frame

  const fwd = { x: 0, z: 0 }, rgt = { x: 0, z: 0 }
  const muzzle = new THREE.Vector3()

  function nearest(): { id: ZoneId; label: string } | null {
    const zs: Zone[] = current.zones
    const px = body.x, py = body.y, pz = body.z
    for (const z of zs) if (inZone(z, px, py, pz)) return { id: z.id, label: z.label }
    if (home && current === home && !(place.kind === 'house' && place.edit)) {
      let best: Usable | null = null
      let bd = 1.7 * 1.7
      for (const u of home.usables()) {
        const dx = u.at.x - px, dz = u.at.z - pz
        const d = dx * dx + dz * dz
        if (d < bd && Math.abs(u.at.y - py) < 2.5) { bd = d; best = u }
      }
      if (best) return { id: `use:${best.uid}` as ZoneId, label: using?.uid === best.uid ? 'Reis deg' : USE_LABEL[best.use] }
    }
    return null
  }

  function startUsing(uid: string) {
    if (!home) return
    if (using?.uid === uid) { stopUsing(); return }
    const u = home.usables().find(x => x.uid === uid)
    if (!u) return
    const pose: AvatarPose = u.use === 'sit' ? 'sit' : u.use === 'sleep' ? 'sleep' : u.use === 'music' ? 'sit' : u.use === 'bounce' ? 'jump' : 'cheer'
    using = { kind: u.use, uid, at: u.at.clone(), yaw: u.yaw, pose, t: 0 }
    if (u.use === 'sit' || u.use === 'sleep' || u.use === 'music' || u.use === 'bounce') {
      placeBody(body, u.at.x, u.at.y + (u.use === 'bounce' ? 0.3 : 0), u.at.z)
      facing = u.yaw
    }
    if (u.use === 'sit' || u.use === 'sleep' || u.use === 'music') sfx('sit')
    emit({ type: 'using', what: u.use })
  }

  function frame(dt: number) {
    clock += dt
    const t = clock
    const editing = place.kind === 'house' && place.edit

    // Camera orbit from drags, pinch and wheel.
    cam.turn(input.camYaw, input.camPitch, input.zoom)
    input.camYaw = 0; input.camPitch = 0; input.zoom = 1

    // What the player wants: camera-relative, or the place's autopilot.
    const drive = current.autopilot?.(dt, t, body) ?? null
    let mx = 0, mz = 0
    if (drive) {
      mx = drive.mx; mz = drive.mz
    } else if (!editing) {
      cam.forward(fwd); cam.right(rgt)
      const ix = input.moveX, iy = input.moveY
      mx = fwd.x * iy + rgt.x * ix
      mz = fwd.z * iy + rgt.z * ix
      const l = Math.hypot(mx, mz)
      if (l > 1) { mx /= l; mz /= l }
      if (input.jumpPressed) {
        if (using && using.kind !== 'bounce') stopUsing()
        pressJump(body)
      }
    }
    const moving = Math.hypot(mx, mz) > 0.12
    if (using && moving && !drive) stopUsing()
    if (using) {
      using.t += dt
      if (using.kind === 'sit' || using.kind === 'sleep' || using.kind === 'music') {
        mx = 0; mz = 0
        body.x = using.at.x; body.z = using.at.z; body.y = using.at.y
        body.vx = body.vz = body.vy = 0
      } else if (using.kind === 'bounce' && body.onGround) {
        pressJump(body)
      }
    }
    intent.mx = mx; intent.mz = mz; intent.jump = input.jump

    // Physics at a fixed step.
    let landed = 0, jumped = false, bounced = false
    let hazard: 'fell' | 'killed' | 'water' | null = null
    acc = Math.min(acc + dt, PHYS.dt * PHYS.maxSteps)
    const sitting = using && (using.kind === 'sit' || using.kind === 'sleep' || using.kind === 'music')
    while (acc >= PHYS.dt) {
      acc -= PHYS.dt
      updateMovers(current.world, PHYS.dt)
      if (sitting || editing) continue
      stepBody(current.world, body, intent, ev)
      if (ev.jumped) jumped = true
      if (ev.landed) landed = Math.max(landed, ev.landed)
      if (ev.bounced) bounced = true
      if (ev.killed) hazard = 'killed'
      else if (ev.water) hazard = 'water'
      else if (ev.fell) hazard = 'fell'
      if (hazard) break
    }
    if (jumped) sfx('jump')
    if (bounced) sfx('bounce')
    if (landed > 7) {
      sfx('land')
      if (landed > 22 && !opts.reducedMotion) cam.bump(0.25)
    }
    if (hazard) {
      if (hazard === 'water') {
        sfx('splash')
        particles.burst(body.x, -0.4, body.z, 20, ['#ffffff', '#bff0ff', '#7fd4ff'], { speed: 5, size: 0.3, life: 0.8, up: 5 })
      } else if (hazard === 'killed') {
        particles.burst(body.x, body.y + 1.2, body.z, 16, ['#ff3b3b', '#ffd84f', '#ffffff'], { speed: 6, size: 0.3, life: 0.6 })
      }
      const spot = current.respawn?.(hazard, body) ?? (current === town && hazard === 'water' ? town.shoreFrom(body.x, body.z) : current === town ? lastSafe : current.spawn)
      if (current === town || !current.respawn) sfx('respawn')
      put(spot)
      stopUsing()
    } else if (current === town && body.onGround && body.ground && body.ground.maxY <= 0.01) {
      lastSafe.x = body.x; lastSafe.y = 0; lastSafe.z = body.z; lastSafe.yaw = facing
    }

    // Facing: snap toward the way you move.
    const hs = Math.hypot(body.vx, body.vz)
    const wantFacing = drive?.facing ?? (moving ? Math.atan2(mx, mz) : sitting ? using!.yaw : null)
    if (wantFacing !== null && wantFacing !== undefined) {
      let d = wantFacing - facing
      d = Math.atan2(Math.sin(d), Math.cos(d))
      facing += d * Math.min(1, dt * 16)
    }

    // Zones and actions.
    const n = editing ? null : nearest()
    setNear(n)
    if (input.actionPressed && n && !drive) {
      if (n.id.startsWith('use:')) startUsing(n.id.slice(4))
      else emit({ type: 'zone', zone: n.id })
    }

    // Magic.
    magicCool -= dt
    if (input.usePressed && weapon && magicCool <= 0 && !editing && !drive) {
      magicCool = weapon.level === 3 ? 0.25 : 0.35
      stopUsing()
      const fx = Math.sin(facing), fz = Math.cos(facing)
      muzzle.set(body.x + fx * 0.9 - fz * 0.35, body.y + 1.5, body.z + fz * 0.9 + fx * 0.35)
      const target = current === town ? balloons.nearestAhead(muzzle.x, muzzle.y, muzzle.z, fx, fz, 16) : null
      fireMagic(particles, weapon.magic, weapon.level, muzzle, fx, fz, target)
      emit({ type: 'sfx', name: 'magic', magic: weapon.magic })
      emit({ type: 'fx-out', fx: { k: 'magic', magic: weapon.magic, level: weapon.level, dx: Math.round(fx * 1000) / 1000, dy: 0, dz: Math.round(fz * 1000) / 1000 } })
      swing = 0.35
      emoteT = 0
    }
    swing -= dt
    cheer -= dt
    emoteT -= dt
    if (moving || jumped || editing) emoteT = 0

    // The place's own life (timers, checkpoints, stars).
    current.update(dt, t, body)
    if (home && current === home) (home.house as { setView?(p: THREE.Vector3): void }).setView?.(cam.camera.position)
    if (current === town) {
      balloons.update(dt, t)
      particles.forHits((x, y, z, own) => balloons.tryPop(x, y, z, own))
      neighbors.update(dt, body.x, body.z)
      if (shopWeapon) shopWeapon.group.rotation.y = t * 1.2
    }
    if (place.kind === 'obby' && (current as ObbyScene).finished && cheer < -5) cheer = 2.5
    if (place.kind === 'stars' && (current as StarsScene).ended && cheer < -5) cheer = 2.5

    // Avatar.
    if (avatar) {
      const g = avatar.group
      g.position.set(body.x, body.y, body.z)
      g.rotation.y = facing
      let pose: AvatarPose = 'idle'
      let speed = 0
      if (drive?.pose) pose = drive.pose
      else if (using) pose = using.kind === 'bounce' ? (body.vy > 0 ? 'jump' : 'fall') : using.pose
      else if (swing > 0) pose = 'swing'
      else if (!body.onGround && body.air > 0.12) pose = body.vy > 0 ? 'jump' : 'fall'
      else if (hs > 0.6) { speed = Math.min(1, hs / PHYS.walk); pose = speed > 0.75 ? 'run' : 'walk' }
      else if (cheer > 0) pose = 'cheer'
      else if (emoteT > 0) pose = emotePose
      if (drive && !drive.pose) { speed = Math.min(1, hs / PHYS.walk); pose = hs > 0.6 ? 'walk' : 'idle' }
      avatar.animate(pose, dt, speed)
      selfPose = pose
      selfSpeed = speed
    }

    // Blob shadow.
    const gy = groundBelow(current.world, body.x, body.y + 0.05, body.z, 0.3)
    if (gy > -1e9 && !editing) {
      const h = Math.max(0, body.y - gy)
      blob.visible = true
      blob.position.set(body.x, gy + 0.03, body.z)
      const s = Math.max(0.4, 1 - h * 0.08)
      blob.scale.set(s, 1, s)
    } else blob.visible = false

    particles.update(dt, (x, y, z) => { const g2 = groundBelow(current.world, x, y, z, 0.1); return g2 > -1e9 ? g2 : -1e9 }, cam.camera, look.size.h)

    // Camera and light.
    cam.update(dt, body.x, body.y + 2.1, body.z, current.camCollide === false ? null : current.world, { moving: moving && !drive, facing, reducedMotion: opts.reducedMotion })
    lights.follow(body.x, body.y, body.z)
    sky.position.copy(cam.camera.position)

    // Other players, drawn after the camera so the one it pushes into can step aside.
    peerLayer.update(dt, peerClock(), { key: myKey(), camera: cam.camera, px: body.x, py: body.y, pz: body.z, world: current.world, balloons: current === town ? balloons : null })
    if (peerLayer.version !== peerVersion) syncLive()

    input.jumpPressed = false
    input.actionPressed = false
    input.usePressed = false
  }

  // ------------------------------------------------ loop

  let raf = 0
  let running = false
  let paused = false
  let last = 0
  let disposed = false

  const draw = () => look.render(scene, cam.camera)

  const tick = (now: number) => {
    raf = 0
    if (!running || paused || disposed || document.hidden) return
    const dt = last ? Math.min(0.1, Math.max(0, (now - last) / 1000)) : 1 / 60
    last = now
    frame(dt)
    draw()
    raf = requestAnimationFrame(tick)
  }
  const kick = () => {
    if (raf || !running || paused || disposed || document.hidden) return
    last = 0
    raf = requestAnimationFrame(tick)
  }
  const onVisibility = () => { if (!document.hidden) kick() }
  document.addEventListener('visibilitychange', onVisibility)

  // ------------------------------------------------ the handle

  const rt: MiniWorldRuntime = {
    input,
    resize(w, h, dpr) {
      look.resize(w, h, dpr)
      // Portrait phones: a taller view, so the town is not a keyhole.
      const a = look.size.w / look.size.h
      cam.camera.fov = a < 1 ? Math.min(72, 55 + (1 - a) * 35) : 55
      cam.setAspect(a)
      if (home && place.kind === 'house' && place.edit) cam.fix(home.editView(cam.camera.fov, a))
      if (!running || paused) {
        cam.update(0, body.x, body.y + 2.1, body.z, null, { moving: false, facing, reducedMotion: true })
        sky.position.copy(cam.camera.position)
        draw()
      }
    },
    start() {
      running = true
      cam.snap(body.x, body.y + 2.1, body.z, facing)
      kick()
    },
    setPaused(p) {
      paused = p
      if (!p) kick()
      else if (raf) { cancelAnimationFrame(raf); raf = 0 }
    },
    setPlayer(lk, name, title) {
      const key = JSON.stringify(lk)
      if (!avatar) {
        avatar = buildAvatar(lk)
        avatar.group.traverse(o => { o.castShadow = true })
        scene.add(avatar.group)
        avatar.setHeld(weapon)
      } else if (key !== lookKey) {
        avatar.setLook(lk)
        avatar.group.traverse(o => { o.castShadow = true })
      }
      lookKey = key
      lastLook = lk
      playerName = name
      playerTitle = title
      avatar.setTag(name, title)
      neighbors.setHome(name, title)
    },
    setWeapon(w) {
      weapon = w
      avatar?.setHeld(w)
    },
    setHouse(layout, owned) {
      houseLayout = layout
      houseOwned = owned
      if (home) home.setLayout(layout, owned)
    },
    setNeighbors(list: NeighborInfo[]) {
      town.group.remove(neighbors.group)
      neighbors.dispose()
      neighbors = buildNeighbors(list.slice(0, 12))
      town.group.add(neighbors.group)
      if (playerName) neighbors.setHome(playerName, playerTitle)
      peerLayer.pubsIn('town', livePubs)
      neighbors.setHidden(livePubs)
      town.setExtraBoxes(neighbors.boxes)
      town.setExtraZones(neighbors.zones)
      if (current === town) setNear(null)
    },
    go,
    get place() { return place },
    edit: {
      add(uid) {
        if (!home || !(place.kind === 'house' && place.edit)) return
        const l = home.house.add(uid)
        if (l) {
          layoutChanged(l)
          emit({ type: 'select', uid })
          sfx('place')
        }
      },
      select(uid) {
        home?.house.select(uid)
        emit({ type: 'select', uid })
      },
      rotate() {
        const l = home?.house.rotate() ?? null
        if (l) { layoutChanged(l); sfx('rotate') }
      },
      store() {
        const l = home?.house.store() ?? null
        if (l) {
          layoutChanged(l)
          emit({ type: 'select', uid: null })
          sfx('store')
        }
      },
    },
    on(h) {
      handlers.add(h)
      return () => handlers.delete(h)
    },
    peers: {
      upsert(id, info) { peerLayer.upsert(id, info) },
      state(id, st, at) { peerLayer.state(id, st, at) },
      fx(id, f) { peerLayer.fx(id, f) },
      remove(id) { peerLayer.remove(id) },
      clear() { peerLayer.clear() },
      get here() { return peerLayer.here },
    },
    setSelfPub(pub) {
      selfPub = typeof pub === 'string' ? pub : ''
    },
    selfState() {
      if (!avatar || disposed) return null
      return packState({ pl: myKey(), x: body.x, y: body.y, z: body.z, r: Math.atan2(Math.sin(facing), Math.cos(facing)), a: selfPose as NetPose, s: Math.max(0, Math.min(1, selfSpeed)) })
    },
    emote(e) {
      if (e === 'heart') {
        floatHeart(particles, body.x, body.y + 3.4, body.z)
      } else if (e === 'wave' || e === 'dance' || e === 'cheer') {
        if (place.kind === 'house' && place.edit) return
        stopUsing()
        emotePose = e
        emoteT = 2
      } else return
      emit({ type: 'fx-out', fx: { k: 'emote', e } })
    },
    dispose() {
      disposed = true
      running = false
      if (raf) cancelAnimationFrame(raf)
      document.removeEventListener('visibilitychange', onVisibility)
      inputHandle.dispose()
      if (current !== town) { scene.remove(current.group); current.dispose() }
      town.dispose()
      balloons.dispose()
      neighbors.dispose()
      shopWeapon?.dispose()
      if (avatar) { scene.remove(avatar.group); avatar.dispose() }
      peerLayer.dispose()
      particles.dispose()
      blobGeo.dispose(); blobMat.dispose()
      sky.geometry.dispose(); sky.material.dispose()
      lights.dispose()
      look.dispose()
      handlers.clear()
    },
  }
  void lastLook
  put(town.spawn)
  // Lab hook (scripts/miniworld-lab/world-shot.mjs): not part of the contract.
  Object.defineProperty(rt, '__debug', {
    value: {
      teleport(x: number, y: number, z: number, yaw: number) { put({ x, y, z, yaw }) },
      camera: cam,
      body,
      frame: (dt: number) => { frame(dt); draw() },
      /** The clock peers are sampled on (ms); the lab steps a virtual one. */
      setPeerClock(fn: () => number) { peerClock = fn },
      peerPos: (id: string) => peerLayer.position(id),
    },
  })
  return rt
}
