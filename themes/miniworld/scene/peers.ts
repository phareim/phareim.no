/**
 * Other players in your world (2026-09-26): the shared world's peers,
 * drawn as ordinary avatars. The runtime feeds this layer what the link
 * receives (`runtime.peers`) and calls `update` once a frame.
 *
 * - Motion: buffered and drawn about 120 ms behind (peerMotion.ts), then
 *   lightly smoothed so a late state does not jerk; a snap (teleport,
 *   respawn, new place) jumps straight there.
 * - Only peers in your place are shown; the rest keep their avatar hidden.
 *   An avatar is built the first time its peer is in your place, at most
 *   two a frame, so a crowded welcome does not stall a phone.
 * - Cost: beyond 40 units a peer animates every fourth frame, beyond 110 it
 *   is hidden; the nearest 12 show name tags and the nearest 6 cast shadows;
 *   the blob shadows are one instanced mesh. Nothing here allocates per frame.
 * - Peers are not solid: you walk through them, they never block a door.
 * - Their magic plays the same effect as yours from their hand and may pop
 *   balloons, which pays you nothing (HIT_PEER). Emotes pose for two
 *   seconds; a heart floats up over their head.
 */
import * as THREE from 'three'
import type { AvatarHandle, AvatarPose, RuntimeEvent } from './contracts'
import type { PeerInfo, PeerState, PeerFx } from '../net/protocol'
import type { PersonLook, RoyalTitle, Weapon, WeaponBaseId, WeaponMagicId } from '../types'
import { POSES } from '../net/protocol'
import { weaponBase, weaponMagic } from '../catalog'
import { parseLook, defaultLook } from '../core/save'
import { buildAvatar } from './avatar'
import { Motion, emptySample, lerpAngle } from './peerMotion'
import type { MotionSample } from './peerMotion'
import { fireMagic, HIT_PEER, SPR, Beh } from './play'
import type { Particles, BalloonPark } from './play'
import { groundBelow } from './physics'
import type { PhysWorld } from './physics'

const HIDE_DIST = 110
const SLOW_DIST = 40
const TAG_MAX = 12
const SHADOW_MAX = 6
const BUILDS_PER_FRAME = 2
const MAX_PEERS = 40
const EMOTE_S = 2
const TITLES = new Set(['king', 'queen', 'prince', 'princess'])
const POSE_SET = new Set<string>(POSES)
const HEX_RE = /^#[0-9a-fA-F]{6}$/

interface Peer {
  id: string
  info: PeerInfo | null
  pub: string
  look: PersonLook
  lookKey: string
  weapon: Weapon | null
  heldKey: string
  name: string
  title: RoyalTitle | null
  avatar: AvatarHandle | null
  tag: THREE.Object3D | null
  /** Info changed since the avatar last took it. */
  stale: boolean
  motion: Motion
  sample: MotionSample
  placed: boolean
  epoch: number
  x: number; y: number; z: number; r: number
  inPlace: boolean
  shown: boolean
  d2: number
  skip: number
  animDt: number
  emote: AvatarPose | null
  emoteT: number
  swingT: number
  tagOn: boolean
  shadow: boolean
}

/** A pixel heart floating up from a point (your emote or a peer's). */
export function floatHeart(p: Particles, x: number, y: number, z: number) {
  p.spawn(x, y, z, 0, 1.4, 0, '#ff4f8a', 0.95, 1.9, SPR.heart, Beh.Float, 0, false)
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.random()
    p.spawn(x + Math.cos(a) * 0.4, y - 0.2, z + Math.sin(a) * 0.4, Math.cos(a) * 0.6, 1 + Math.random(), Math.sin(a) * 0.6, k % 2 ? '#ffb3d0' : '#ff7fb0', 0.4, 1.2 + Math.random() * 0.4, SPR.heart, Beh.Float, 0, false)
  }
}

/** A weapon from the wire, or null when any part of it is not in the catalog. */
export function parseHeld(h: unknown): Weapon | null {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return null
  const o = h as Record<string, unknown>
  if (typeof o.base !== 'string' || !weaponBase(o.base)) return null
  if (typeof o.magic !== 'string' || !weaponMagic(o.magic)) return null
  const level = o.level === 2 || o.level === 3 ? o.level : 1
  const color = typeof o.color === 'string' && HEX_RE.test(o.color) ? o.color.toLowerCase() : '#ff8ae0'
  return { uid: 'peer', base: o.base as WeaponBaseId, magic: o.magic as WeaponMagicId, color, level, name: '' }
}

export interface FrameCtx {
  /** Your place key: only peers with the same one show. */
  key: string
  camera: THREE.Camera
  /** You (distance culling and sound). */
  px: number; py: number; pz: number
  world: PhysWorld
  /** In town: balloons their lightning aims at. */
  balloons: BalloonPark | null
}

export interface PeerLayer {
  upsert(id: string, info: PeerInfo): void
  state(id: string, s: PeerState, at: number): void
  fx(id: string, fx: PeerFx): void
  remove(id: string): void
  clear(): void
  readonly here: number
  /** Bumped whenever a peer's place or public id may have changed (neighbour figures listen). */
  readonly version: number
  /** Public ids of peers whose place key is `key`, into `out` (cleared first). */
  pubsIn(key: string, out: Set<string>): void
  update(dt: number, now: number, ctx: FrameCtx): void
  /** The shown peer a ray hits (a generous box round each), nearest first. */
  pick(ray: THREE.Ray): string | null
  /** Where a shown peer is drawn (the lab's tap test), or null. */
  position(id: string): { x: number; y: number; z: number } | null
  dispose(): void
}

export function createPeerLayer(parent: THREE.Object3D, particles: Particles, opts: { lowPower: boolean; emit(e: RuntimeEvent): void }): PeerLayer {
  const peers = new Map<string, Peer>()
  const list: Peer[] = []
  const order: Peer[] = []
  let here = 0
  let version = 0
  let rankT = 0
  let lastKey = ''
  let ctxBalloons: BalloonPark | null = null
  let lastPx = 0, lastPy = 0, lastPz = 0

  // Blob shadows: one instanced mesh for everyone.
  const blobGeo = new THREE.CircleGeometry(0.55, 10)
  blobGeo.rotateX(-Math.PI / 2)
  const blobMat = new THREE.MeshBasicMaterial({ color: '#2a1a4c', transparent: true, opacity: 0.32, depthWrite: false })
  const blobs = new THREE.InstancedMesh(blobGeo, blobMat, MAX_PEERS)
  blobs.count = 0
  blobs.renderOrder = 2
  blobs.frustumCulled = false
  parent.add(blobs)
  const m4 = new THREE.Matrix4()
  const q0 = new THREE.Quaternion()
  const v3 = new THREE.Vector3()
  const s3 = new THREE.Vector3()
  const box = new THREE.Box3()
  const hitPt = new THREE.Vector3()
  const muzzle = new THREE.Vector3()

  const byDist = (a: Peer, b: Peer) => a.d2 - b.d2
  const tagKey = (p: Peer) => `${p.name}|${p.title ?? ''}`

  function fresh(id: string): Peer {
    return {
      id, info: null, pub: '', look: defaultLook(), lookKey: '', weapon: null, heldKey: 'null', name: '', title: null,
      avatar: null, tag: null, stale: true, motion: new Motion(), sample: emptySample(), placed: false, epoch: -1,
      x: 0, y: 0, z: 0, r: 0, inPlace: false, shown: false, d2: 0, skip: 0, animDt: 0,
      emote: null, emoteT: 0, swingT: 0, tagOn: true, shadow: false,
    }
  }

  function get(id: string): Peer | null {
    let p = peers.get(id)
    if (!p) {
      if (peers.size >= MAX_PEERS * 2) return null
      p = fresh(id)
      peers.set(id, p)
      list.push(p)
    }
    return p
  }

  function hide(p: Peer) {
    if (p.shown && p.avatar) p.avatar.group.visible = false
    p.shown = false
  }

  function findTag(a: AvatarHandle): THREE.Object3D | null {
    for (const c of a.group.children) if ((c as THREE.Sprite).isSprite) return c
    return null
  }

  function setShadow(p: Peer, on: boolean) {
    if (p.shadow === on || !p.avatar) return
    p.shadow = on
    p.avatar.group.traverse(o => { o.castShadow = on })
  }

  /** Builds the avatar, or brings it up to date with the latest info. */
  function apply(p: Peer) {
    if (!p.avatar) {
      try { p.avatar = buildAvatar(p.look) } catch { p.avatar = buildAvatar(defaultLook()) }
      p.avatar.group.visible = false
      p.avatar.group.traverse(o => { o.castShadow = false })
      parent.add(p.avatar.group)
      p.avatar.setHeld(p.weapon)
      p.avatar.setTag(p.name || null, p.title)
      p.tag = findTag(p.avatar)
      p.tagOn = true
      p.shadow = false
      p.stale = false
      const u = p.avatar.group.userData
      u.lookKey = p.lookKey; u.heldKey = p.heldKey; u.tagKey = tagKey(p)
      return
    }
    const a = p.avatar
    const u = a.group.userData
    if (p.lookKey !== u.lookKey) {
      try { a.setLook(p.look) } catch { a.setLook(defaultLook()) }
      u.lookKey = p.lookKey
      if (p.shadow) a.group.traverse(o => { o.castShadow = true })
    }
    if (p.heldKey !== u.heldKey) { a.setHeld(p.weapon); u.heldKey = p.heldKey }
    const tk = tagKey(p)
    if (tk !== u.tagKey) {
      a.setTag(p.name || null, p.title)
      u.tagKey = tk
      p.tag = findTag(a)
      if (p.tag) p.tag.visible = p.tagOn
    }
    p.stale = false
  }

  function drop(p: Peer) {
    if (p.avatar) { parent.remove(p.avatar.group); p.avatar.dispose(); p.avatar = null }
    peers.delete(p.id)
    const i = list.indexOf(p)
    if (i >= 0) list.splice(i, 1)
    version++
  }

  const self: PeerLayer = {
    upsert(id, info) {
      if (!info || typeof info !== 'object') return
      const p = get(id)
      if (!p) return
      const pub = typeof info.pub === 'string' ? info.pub : ''
      if (pub !== p.pub) { p.pub = pub; version++ }
      p.info = info
      p.name = typeof info.name === 'string' ? info.name.slice(0, 12) : ''
      p.title = typeof info.title === 'string' && TITLES.has(info.title) ? info.title as RoyalTitle : null
      let look: PersonLook | null = null
      try { look = parseLook(info.look) } catch { look = null }
      p.look = look ?? defaultLook()
      p.lookKey = JSON.stringify(p.look)
      p.weapon = parseHeld(info.held)
      p.heldKey = JSON.stringify(p.weapon)
      const u = p.avatar?.group.userData
      p.stale = !u || u.lookKey !== p.lookKey || u.heldKey !== p.heldKey || u.tagKey !== tagKey(p)
    },
    state(id, s, at) {
      if (!s || typeof s !== 'object' || typeof s.pl !== 'string') return
      if (![s.x, s.y, s.z, s.r, s.s].every(n => typeof n === 'number' && Number.isFinite(n))) return
      const p = get(id)
      if (!p) return
      const before = p.motion.last?.pl
      const st = POSE_SET.has(s.a) ? s : { ...s, a: 'idle' as const }
      p.motion.push(st, at)
      if (before !== s.pl) version++
    },
    fx(id, fx) {
      const p = peers.get(id)
      if (!p || !fx || typeof fx !== 'object') return
      if (fx.k === 'emote') {
        if (fx.e === 'heart') {
          if (p.shown) floatHeart(particles, p.x, p.y + 3.4, p.z)
        } else if (fx.e === 'wave' || fx.e === 'dance' || fx.e === 'cheer') {
          p.emote = fx.e
          p.emoteT = EMOTE_S
        }
        return
      }
      if (fx.k !== 'magic' || !p.shown) return
      const magic = weaponMagic(String(fx.magic))
      if (!magic) return
      const level = (Math.max(1, Math.min(3, Math.round(Number(fx.level) || 1)))) as 1 | 2 | 3
      let dx = Number(fx.dx) || 0, dz = Number(fx.dz) || 0
      const l = Math.hypot(dx, dz)
      if (l < 0.05) { dx = Math.sin(p.r); dz = Math.cos(p.r) } else { dx /= l; dz /= l }
      muzzle.set(p.x + dx * 0.9 - dz * 0.35, p.y + 1.5, p.z + dz * 0.9 + dx * 0.35)
      const target = ctxBalloons ? ctxBalloons.nearestAhead(muzzle.x, muzzle.y, muzzle.z, dx, dz, 16) : null
      fireMagic(particles, magic.id, level, muzzle, dx, dz, target, HIT_PEER)
      p.swingT = 0.35
      const ddx = p.x - lastPx, ddy = p.y - lastPy, ddz = p.z - lastPz
      if (ddx * ddx + ddy * ddy + ddz * ddz < 14 * 14) opts.emit({ type: 'sfx', name: 'magic', magic: magic.id })
    },
    remove(id) {
      const p = peers.get(id)
      if (p) drop(p)
    },
    clear() {
      for (const p of [...list]) drop(p)
      here = 0
      blobs.count = 0
    },
    get here() { return here },
    get version() { return version },
    pubsIn(key, out) {
      out.clear()
      for (const p of list) if (p.pub && p.info && p.motion.last?.pl === key) out.add(p.pub)
    },
    update(dt, now, ctx) {
      ctxBalloons = ctx.balloons
      lastPx = ctx.px; lastPy = ctx.py; lastPz = ctx.pz
      if (ctx.key !== lastKey) { lastKey = ctx.key; rankT = 0 }
      const cam = ctx.camera.position
      const k = 1 - Math.exp(-dt * 22)
      let builds = 0
      let count = 0
      let nb = 0
      order.length = 0
      for (const p of list) {
        p.emoteT -= dt
        p.swingT -= dt
        const has = p.motion.sample(now, p.sample)
        p.inPlace = has && !!p.info && p.sample.pl === ctx.key
        if (!p.inPlace) { hide(p); p.placed = false; continue }
        count++
        const s = p.sample
        if (!p.placed || s.epoch !== p.epoch) {
          p.x = s.x; p.y = s.y; p.z = s.z; p.r = s.r
          p.placed = true
          p.epoch = s.epoch
        } else {
          p.x += (s.x - p.x) * k; p.y += (s.y - p.y) * k; p.z += (s.z - p.z) * k
          p.r = lerpAngle(p.r, s.r, k)
        }
        const dx = p.x - ctx.px, dz = p.z - ctx.pz
        p.d2 = dx * dx + dz * dz
        if (p.d2 > HIDE_DIST * HIDE_DIST) { hide(p); continue }
        if (!p.avatar || p.stale) {
          if (builds >= BUILDS_PER_FRAME) { hide(p); continue }
          builds++
          apply(p)
        }
        const a = p.avatar!
        // The camera pushed into someone: let them vanish rather than fill the view with a head.
        const cx = cam.x - p.x, cy = cam.y - (p.y + 1.3), cz = cam.z - p.z
        const close = cx * cx + cy * cy + cz * cz < 1.4 * 1.4
        a.group.visible = !close
        p.shown = true
        a.group.position.set(p.x, p.y, p.z)
        a.group.rotation.y = p.r

        // Pose: theirs, with an emote or a swing when they are standing.
        let pose = (s.a as AvatarPose)
        const moving = pose === 'walk' || pose === 'run' || pose === 'jump' || pose === 'fall'
        if (moving) p.emoteT = 0
        if (p.swingT > 0 && (pose === 'idle' || pose === 'walk' || pose === 'run')) pose = 'swing'
        else if (p.emoteT > 0 && p.emote && pose === 'idle') pose = p.emote
        const far = p.d2 > SLOW_DIST * SLOW_DIST
        p.animDt += dt
        if (!far || ++p.skip >= 4) {
          a.animate(pose, Math.min(0.25, p.animDt), s.s)
          p.animDt = 0
          p.skip = 0
        }

        // Blob shadow (near peers only).
        if (!far && nb < MAX_PEERS) {
          const gy = pose === 'jump' || pose === 'fall' ? groundBelow(ctx.world, p.x, p.y + 0.05, p.z, 0.3) : p.y
          if (gy > -1e9) {
            const sc = Math.max(0.4, 1 - Math.max(0, p.y - gy) * 0.08)
            m4.compose(v3.set(p.x, gy + 0.03, p.z), q0, s3.set(sc, 1, sc))
            blobs.setMatrixAt(nb++, m4)
          }
        }
        order.push(p)
      }
      here = count
      blobs.count = nb
      if (nb) blobs.instanceMatrix.needsUpdate = true

      // Tags and shadows for the nearest few, re-ranked four times a second.
      rankT -= dt
      if (rankT <= 0) {
        rankT = 0.25
        order.sort(byDist)
        for (let i = 0; i < order.length; i++) {
          const p = order[i]!
          const tagOn = i < TAG_MAX
          if (tagOn !== p.tagOn) { p.tagOn = tagOn; if (p.tag) p.tag.visible = tagOn }
          setShadow(p, !opts.lowPower && i < SHADOW_MAX && p.d2 < 30 * 30)
        }
      }
    },
    pick(ray) {
      let best: string | null = null
      let bd = Infinity
      for (const p of list) {
        if (!p.shown || !p.avatar?.group.visible) continue
        const sitting = p.sample.a === 'sleep'
        box.min.set(p.x - (sitting ? 1.4 : 0.9), p.y - 0.2, p.z - (sitting ? 1.4 : 0.9))
        box.max.set(p.x + (sitting ? 1.4 : 0.9), p.y + 3.3, p.z + (sitting ? 1.4 : 0.9))
        if (!ray.intersectBox(box, hitPt)) continue
        const d = hitPt.distanceToSquared(ray.origin)
        if (d < bd) { bd = d; best = p.id }
      }
      return best
    },
    position(id) {
      const p = peers.get(id)
      return p && p.shown ? { x: p.x, y: p.y, z: p.z } : null
    },
    dispose() {
      self.clear()
      parent.remove(blobs)
      blobs.dispose()
      blobGeo.dispose(); blobMat.dispose()
    },
  }
  return self
}
