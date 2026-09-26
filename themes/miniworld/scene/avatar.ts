/**
 * Mini World's people (avatar/house agent): Roblox R6 blocks — legs 1.0,
 * torso 1.0 × 1.0 × 0.5, arms 0.5 wide, a 0.64 × 0.6 head with a drawn
 * face — dressed from the catalog. Feet at y 0, facing +z; the person's
 * right hand is on −x.
 *
 * Draw calls: the six body blocks share one atlas material (clothes.ts
 * paints skin, shirt, trousers and shoes into it), the face is one decal,
 * and hair, hats, face items and extra garment pieces merge per material
 * per moving part — about 12–18 meshes per person.
 */
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { AvatarHandle, AvatarPose, BuildAvatar, WeaponModelHandle } from './contracts'
import type { PersonLook, Weapon, RoyalTitle, HairStyleId, ClothingDef, HatShape, FaceShape } from '../types'
import { HAIR_COLORS, clothing, coversLegs } from '../catalog'
import { textureMaterial, disposeTree, own } from './meshkit'
import { faceTexture, tagCanvas, pixelTexture } from './textures'
import {
  atlasBox, bodyAtlas, PartSet, torsoPieces, armPieces, legPieces, bodyLift, hatHides,
  HAT_BUILDERS, FACE_BUILDERS, buildBack, HEAD, shoeTopRow, type BackRig,
} from './clothes'
import { buildWeaponModel } from './weapons'

// ---------------------------------------------------------------- hair

type Tag = 'cap' | 'vol' | 'back' | 'side' | 'fringe' | 'tail'
type Piece = [x: number, y: number, z: number, w: number, h: number, d: number, tag: Tag, shade?: boolean, rot?: { x?: number; y?: number; z?: number }]

const T = 0.07 // hair thickness
const HX = HEAD.w / 2 + T / 2 - 0.005
const HZ = HEAD.d / 2 + T / 2 - 0.005
const CAP: Piece = [0, 0.645, -0.01, HEAD.w + 0.08, 0.11, HEAD.d + 0.07, 'cap']
const back = (y0: number, y1 = 0.69): Piece => [0, (y0 + y1) / 2, -HZ, HEAD.w + 0.08, y1 - y0, T, 'back']
const sides = (y0: number, y1 = 0.69, d = HEAD.d, z = -0.01): Piece[] => [-1, 1].map(s => [s * HX, (y0 + y1) / 2, z, T, y1 - y0, d + 0.02, 'side'] as Piece)
const fringe = (w: number, h: number, x = 0): Piece => [x, 0.6 - h / 2 + 0.02, HZ, w, h, T, 'fringe']

export const HAIR: Record<HairStyleId, Piece[]> = {
  short: [CAP, back(0.3), ...sides(0.42, 0.69, 0.44, -0.08), fringe(0.44, 0.1, -0.1), [0.14, 0.56, HZ, 0.2, 0.06, T, 'fringe']],
  bob: [CAP, back(0.1), ...sides(0.1, 0.69, HEAD.d, -0.01), fringe(HEAD.w + 0.08, 0.13)],
  long: [CAP, back(-0.62), ...sides(0.02, 0.69, 0.5, -0.07), fringe(0.4, 0.12, -0.14), [0.2, 0.55, HZ, 0.3, 0.08, T, 'fringe'],
    [-0.2, -0.3, -HZ - 0.01, 0.2, 0.3, T, 'back'], [0.2, -0.3, -HZ - 0.01, 0.2, 0.3, T, 'back'],
    // Locks over the shoulders, in front of the chest.
    [-0.37, 0.06, 0.1, 0.12, 0.34, 0.3, 'tail'], [0.37, 0.06, 0.1, 0.12, 0.34, 0.3, 'tail'],
    [-0.37, -0.25, 0.3, 0.12, 0.42, 0.1, 'tail'], [0.37, -0.25, 0.3, 0.12, 0.42, 0.1, 'tail']],
  ponytail: [CAP, back(0.34), ...sides(0.4, 0.69, 0.4, -0.1), fringe(HEAD.w + 0.08, 0.09),
    [0, 0.66, -HZ - 0.04, 0.2, 0.16, 0.12, 'tail', true], [0, 0.72, -HZ - 0.2, 0.26, 0.24, 0.26, 'tail'],
    [0, 0.42, -HZ - 0.3, 0.24, 0.42, 0.2, 'tail', false, { x: 0.25 }], [0, 0.14, -HZ - 0.34, 0.16, 0.2, 0.14, 'tail', false, { x: 0.25 }]],
  pigtails: [CAP, back(0.26), ...sides(0.3, 0.69, 0.5, -0.06), fringe(HEAD.w + 0.08, 0.12),
    [-0.4, 0.46, -0.08, 0.1, 0.12, 0.12, 'tail', true], [0.4, 0.46, -0.08, 0.1, 0.12, 0.12, 'tail', true],
    [-0.52, 0.3, -0.08, 0.16, 0.34, 0.16, 'tail', false, { z: -0.45 }], [0.52, 0.3, -0.08, 0.16, 0.34, 0.16, 'tail', false, { z: 0.45 }]],
  bun: [[0, 0.64, -0.01, HEAD.w + 0.06, 0.09, HEAD.d + 0.06, 'cap'], back(0.34), ...sides(0.4, 0.69, 0.4, -0.1), fringe(0.5, 0.07),
    [0, 0.74, -0.14, 0.1, 0.08, 0.1, 'vol', true], [0, 0.86, -0.16, 0.3, 0.22, 0.3, 'vol']],
  curly: [[0, 0.66, -0.01, HEAD.w + 0.1, 0.14, HEAD.d + 0.1, 'cap'], back(0.06), ...sides(0.1, 0.69, HEAD.d, -0.02),
    [-0.22, 0.58, HZ + 0.02, 0.18, 0.14, 0.1, 'fringe'], [0.02, 0.6, HZ + 0.03, 0.2, 0.12, 0.1, 'fringe', true], [0.24, 0.57, HZ + 0.02, 0.16, 0.14, 0.1, 'fringe'],
    [-0.22, 0.78, 0.14, 0.22, 0.18, 0.22, 'vol'], [0.02, 0.82, 0.2, 0.22, 0.18, 0.22, 'vol', true], [0.24, 0.77, 0.1, 0.22, 0.18, 0.22, 'vol'],
    [-0.14, 0.8, -0.16, 0.24, 0.18, 0.24, 'vol', true], [0.18, 0.8, -0.2, 0.22, 0.18, 0.22, 'vol'],
    ...[-1, 1].flatMap(s => [[s * 0.42, 0.52, 0.08, 0.14, 0.18, 0.2, 'side'], [s * 0.44, 0.3, -0.06, 0.16, 0.2, 0.22, 'side', true], [s * 0.42, 0.1, -0.12, 0.14, 0.18, 0.2, 'side']] as Piece[]),
    [0, 0.0, -0.4, 0.34, 0.18, 0.14, 'back', true], [-0.22, 0.2, -0.42, 0.18, 0.18, 0.12, 'back']],
  spiky: [CAP, back(0.3), ...sides(0.44, 0.69, 0.4, -0.1), fringe(0.6, 0.08),
    [-0.22, 0.82, 0.12, 0.13, 0.28, 0.13, 'vol', false, { z: 0.35, x: 0.2 }], [0, 0.85, 0.14, 0.13, 0.32, 0.13, 'vol', false, { x: 0.3 }],
    [0.22, 0.82, 0.12, 0.13, 0.28, 0.13, 'vol', false, { z: -0.35, x: 0.2 }], [-0.14, 0.82, -0.14, 0.13, 0.28, 0.13, 'vol', false, { z: 0.3, x: -0.3 }],
    [0.14, 0.82, -0.14, 0.13, 0.28, 0.13, 'vol', false, { z: -0.3, x: -0.3 }]],
  braids: [CAP, back(0.26), ...sides(0.3, 0.69, 0.5, -0.06), fringe(0.3, 0.1, -0.17), fringe(0.3, 0.1, 0.17),
    // Two braids from behind the ears, forward over the shoulders and down the chest.
    ...[-1, 1].flatMap(s => [
      [s * 0.38, 0.3, -0.02, 0.14, 0.18, 0.16, 'tail'], [s * 0.38, 0.12, 0.12, 0.15, 0.16, 0.16, 'tail'],
      [s * 0.38, -0.02, 0.29, 0.14, 0.14, 0.12, 'tail'], [s * 0.38, -0.15, 0.31, 0.11, 0.13, 0.1, 'tail'],
      [s * 0.38, -0.28, 0.31, 0.14, 0.14, 0.12, 'tail'], [s * 0.38, -0.41, 0.31, 0.11, 0.13, 0.1, 'tail'],
      [s * 0.38, -0.52, 0.31, 0.09, 0.08, 0.09, 'tail', true],
    ] as Piece[])],
  afro: [[0, 0.66, -0.13, 0.98, 0.64, 0.8, 'vol'], [0, 0.72, -0.1, 0.88, 0.62, 0.96, 'vol'], [0, 0.8, 0.26, 0.82, 0.34, 0.14, 'vol'],
    [0, 0.4, -0.4, 0.86, 0.5, 0.2, 'back'], ...sides(0.26, 0.6, 0.4, -0.12)],
  none: [],
}

function buildHair(ps: PartSet, look: PersonLook, hides: ReturnType<typeof hatHides>): number {
  if (hides === 'all') return HEAD.h
  const hc = HAIR_COLORS.find(h => h.id === look.hairColor) ?? HAIR_COLORS[0]!
  const rainbow = look.hairColor === 'rainbow'
  let top = HEAD.h
  for (const [x, y, z, w, h, d, tag, shade, rot] of HAIR[look.hair]) {
    if (hides === 'top' && (tag === 'cap' || tag === 'vol')) continue
    if (hides === 'volume' && tag === 'vol') continue
    const kit = rainbow && !shade ? ps.pat('rainbow', { main: hc.color }) : ps.vc
    kit.box(x, y, z, w, h, d, shade ? (rainbow ? '#b04fd0' : hc.shade) : hc.color, rot)
    top = Math.max(top, y + h / 2)
  }
  return top
}

// ---------------------------------------------------------------- body geometry

function limbGeo(kind: 'arm' | 'leg', toe: boolean): THREE.BufferGeometry {
  if (kind === 'arm') {
    const g = atlasBox(0.5, 1, 0.5, ['arm', 'arm', 'armTop', 'hand', 'arm', 'arm'])
    g.translate(0, -0.35, 0)
    return g
  }
  const leg = atlasBox(0.5, 1, 0.5, ['leg', 'leg', 'legTop', 'sole', 'legFront', 'leg'])
  leg.translate(0, -0.5, 0)
  if (!toe) return leg
  const t = atlasBox(0.5, 0.2, 0.16, ['shoe', 'shoe', 'shoeTop', 'sole', 'shoe', 'shoe'])
  t.translate(0, -0.9, 0.33)
  const m = mergeGeometries([leg, t], false)
  leg.dispose(); t.dispose()
  return m
}

// ---------------------------------------------------------------- the rig

interface Rig {
  body: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  armL: THREE.Group
  armR: THREE.Group
  legL: THREE.Group
  legR: THREE.Group
  hand: THREE.Group
  faceMat: THREE.MeshLambertMaterial
  back: BackRig | null
  lift: number
  skirt: boolean
  headTop: number
}

function buildRig(look: PersonLook): Rig {
  const atlas = bodyAtlas(look)
  const mat = textureMaterial(atlas)
  const body = new THREE.Group()
  const lift = bodyLift(look)
  body.position.y = lift

  const torso = new THREE.Group()
  torso.position.y = 1
  const tGeo = atlasBox(1, 1, 0.5, ['torsoSide', 'torsoSide', 'torsoTop', 'torsoBottom', 'torsoFront', 'torsoBack'])
  tGeo.translate(0, 0.5, 0)
  torso.add(new THREE.Mesh(tGeo, mat))
  const tp = new PartSet()
  torsoPieces(tp, look)
  tp.flush(torso)
  body.add(torso)

  // Head
  const head = new THREE.Group()
  head.position.y = 1
  const hGeo = atlasBox(HEAD.w, HEAD.h, HEAD.d, ['skin', 'skin', 'skin', 'skin', 'skin', 'skin'])
  hGeo.translate(0, HEAD.h / 2, 0)
  head.add(new THREE.Mesh(hGeo, mat))
  const faceMat = own(new THREE.MeshLambertMaterial({ map: faceTexture(look.eyes, look.mouth, look.cheeks), transparent: true, depthWrite: false }))
  const face = new THREE.Mesh(new THREE.PlaneGeometry(HEAD.w, HEAD.h), faceMat)
  face.position.set(0, HEAD.h / 2, HEAD.d / 2 + 0.003)
  face.renderOrder = 1
  head.add(face)
  const hat = clothing(look.outfit.hat)
  const hp = new PartSet()
  const hairTop = buildHair(hp, look, hatHides(hat?.shape as HatShape | undefined))
  if (hat) HAT_BUILDERS[hat.shape as HatShape]?.(hp, hat, hairTop)
  const fItem = clothing(look.outfit.face)
  if (fItem) FACE_BUILDERS[fItem.shape as FaceShape]?.(hp, fItem)
  const headMeshes = hp.flush(head)
  let headTop = HEAD.h
  for (const m of headMeshes) { m.geometry.computeBoundingBox(); headTop = Math.max(headTop, m.geometry.boundingBox!.max.y) }
  torso.add(head)

  // Arms (pivot at the shoulder)
  const mkArm = (side: 1 | -1) => {
    const g = new THREE.Group()
    g.position.set(side * 0.75, 0.85, 0)
    g.add(new THREE.Mesh(limbGeo('arm', false), mat))
    const ap = new PartSet()
    armPieces(ap, look, side)
    ap.flush(g)
    torso.add(g)
    return g
  }
  const armL = mkArm(1), armR = mkArm(-1)
  const hand = new THREE.Group()
  hand.position.set(0, -0.8, 0.02)
  hand.rotation.x = 0.5
  armR.add(hand)

  // Legs (pivot at the hip)
  const mkLeg = (side: 1 | -1) => {
    const g = new THREE.Group()
    g.position.set(side * 0.25, 1, 0)
    const lp = new PartSet()
    const { toe } = legPieces(lp, look)
    g.add(new THREE.Mesh(limbGeo('leg', toe), mat))
    lp.flush(g)
    body.add(g)
    return g
  }
  const legL = mkLeg(1), legR = mkLeg(-1)

  const backDef = clothing(look.outfit.back)
  const back = backDef ? buildBack(backDef) : null
  if (back) torso.add(back.group)

  const top = clothing(look.outfit.top)
  const skirt = !!top && coversLegs(top.id) || ['skirt', 'tutu'].includes(clothing(look.outfit.bottom)?.shape ?? '')
  return { body, torso, head, armL, armR, legL, legR, hand, faceMat, back, lift, skirt, headTop: 2 + headTop + lift }
}

// ---------------------------------------------------------------- poses

interface Joints {
  bodyY: number; bodyZ: number; bodyRX: number; bodyRY: number
  torsoRX: number; torsoRY: number; torsoRZ: number
  headRX: number; headRY: number; headRZ: number
  armLX: number; armLZ: number; armRX: number; armRZ: number
  legLX: number; legLZ: number; legRX: number; legRZ: number
}
const ZERO: Joints = { bodyY: 0, bodyZ: 0, bodyRX: 0, bodyRY: 0, torsoRX: 0, torsoRY: 0, torsoRZ: 0, headRX: 0, headRY: 0, headRZ: 0, armLX: 0, armLZ: 0, armRX: 0, armRZ: 0, legLX: 0, legLZ: 0, legRX: 0, legRZ: 0 }

/** Target joint angles for a pose at time t (s), walk phase and speed. */
function poseTargets(pose: AvatarPose, t: number, phase: number, speed: number, holding: boolean, skirt: boolean): Joints {
  const j: Joints = { ...ZERO }
  const breathe = Math.sin(t * 1.8)
  switch (pose) {
    case 'idle':
      j.armLZ = 0.07 + breathe * 0.025; j.armRZ = -0.07 - breathe * 0.025
      j.bodyY = breathe * 0.012
      j.headRY = Math.sin(t * 0.43) * 0.18; j.headRX = Math.sin(t * 0.31) * 0.05
      break
    case 'walk':
    case 'run': {
      const run = pose === 'run'
      const a = (run ? 0.95 : 0.45 + 0.35 * speed) * (skirt ? 0.6 : 1)
      const s = Math.sin(phase)
      j.legLX = s * a; j.legRX = -s * a
      j.armLX = -s * a * 0.85; j.armRX = s * a * 0.85
      j.armLZ = 0.06; j.armRZ = -0.06
      j.bodyY = Math.abs(Math.cos(phase)) * (run ? 0.09 : 0.05)
      j.torsoRX = run ? 0.14 : 0.04
      j.torsoRY = s * (run ? 0.12 : 0.06)
      j.headRX = run ? -0.1 : 0
      break
    }
    case 'jump':
      j.armLX = -2.5; j.armRX = -2.5; j.armLZ = 0.25; j.armRZ = -0.25
      j.legLX = -0.5; j.legRX = 0.25
      j.headRX = -0.15
      break
    case 'fall': {
      const f = Math.sin(t * 14) * 0.2
      j.armLX = -2.2 + f; j.armRX = -2.2 - f; j.armLZ = 0.7; j.armRZ = -0.7
      j.legLZ = 0.18; j.legRZ = -0.18; j.legLX = f; j.legRX = -f
      break
    }
    case 'sit':
      j.bodyY = -0.45
      j.legLX = -Math.PI / 2; j.legRX = -Math.PI / 2
      j.legLZ = 0.05; j.legRZ = -0.05
      j.armLX = -0.45; j.armRX = -0.45
      j.headRY = Math.sin(t * 0.4) * 0.15
      break
    case 'sleep':
      j.bodyRX = -Math.PI / 2; j.bodyY = 0.26; j.bodyZ = 1.3
      j.armLZ = 0.05; j.armRZ = -0.05
      j.headRZ = 0.25
      j.torsoRX = breathe * 0.015
      break
    case 'wave':
      j.armRX = -2.9; j.armRZ = -0.35 + Math.sin(t * 9) * 0.35
      j.armLZ = 0.08
      j.headRZ = 0.12; j.headRY = -0.1
      j.bodyY = breathe * 0.01
      break
    case 'swing': {
      const k = (t % 0.5) / 0.5
      const e = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65
      j.armRX = -2.7 + e * 2.3; j.armRZ = -0.15
      j.torsoRY = -0.3 + e * 0.5
      j.armLX = -0.4; j.armLZ = 0.2
      j.legLX = -0.25; j.legRX = 0.2
      break
    }
    case 'dance': {
      const b = Math.sin(t * 6)
      j.armLX = -1.6 - 1.1 * b; j.armRX = -1.6 + 1.1 * b; j.armLZ = 0.35; j.armRZ = -0.35
      j.bodyY = Math.abs(Math.sin(t * 6)) * 0.1
      j.torsoRY = Math.sin(t * 3) * 0.35
      j.legLX = b * 0.25; j.legRX = -b * 0.25
      j.headRZ = Math.sin(t * 3) * 0.18
      break
    }
    case 'cheer': {
      const w = Math.sin(t * 12) * 0.2
      j.armLX = -2.9; j.armRX = -2.9; j.armLZ = 0.45 + w; j.armRZ = -0.45 - w
      j.bodyY = Math.abs(Math.sin(t * 7)) * 0.3
      j.legLX = -0.15; j.legRX = -0.15
      j.headRX = -0.2
      break
    }
  }
  if (holding && (pose === 'idle' || pose === 'walk' || pose === 'run')) {
    j.armRX = -1.05 + (pose === 'idle' ? breathe * 0.03 : Math.sin(phase) * 0.12)
    j.armRZ = 0
  }
  return j
}

// ---------------------------------------------------------------- the handle

const tagTmp = new THREE.Vector2()

export const buildAvatar: BuildAvatar = (initial: PersonLook) => {
  const group = new THREE.Group()
  group.name = 'miniworld-avatar'
  let look = initial
  let rig = buildRig(look)
  group.add(rig.body)
  let held: WeaponModelHandle | null = null
  let heldWeapon: Weapon | null = null
  let tag: THREE.Sprite | null = null
  const cur: Joints = { ...ZERO }
  let t = Math.random() * 10
  let phase = 0
  let nextBlink = t + 2 + Math.random() * 2
  let blinkUntil = 0
  let lastPose: AvatarPose = 'idle'

  const faceTex = () => faceTexture(look.eyes, look.mouth, look.cheeks)
  const blinkTex = () => faceTexture(look.eyes, look.mouth, look.cheeks, true)

  const placeTag = () => { if (tag) tag.position.set(0, rig.headTop + 0.32, 0) }

  const apply = (j: Joints) => {
    const r = rig
    r.body.position.set(0, r.lift + j.bodyY, j.bodyZ)
    r.body.rotation.set(j.bodyRX, j.bodyRY, 0)
    r.torso.rotation.set(j.torsoRX, j.torsoRY, j.torsoRZ)
    r.head.rotation.set(j.headRX, j.headRY, j.headRZ)
    r.armL.rotation.set(j.armLX, 0, j.armLZ)
    r.armR.rotation.set(j.armRX, 0, j.armRZ)
    r.legL.rotation.set(j.legLX, 0, j.legLZ)
    r.legR.rotation.set(j.legRX, 0, j.legRZ)
  }

  const handle: AvatarHandle & {
    readonly held: WeaponModelHandle | null
    muzzleWorld(target: THREE.Vector3): THREE.Vector3 | null
    readonly height: number
  } = {
    group,
    get held() { return held },
    get height() { return rig.headTop },
    muzzleWorld(target) {
      if (!held) return null
      group.updateWorldMatrix(true, true)
      return held.group.localToWorld(target.copy(held.muzzle))
    },
    setLook(next) {
      look = next
      if (held) rig.hand.remove(held.group)
      group.remove(rig.body)
      disposeTree(rig.body)
      rig = buildRig(look)
      group.add(rig.body)
      if (held) rig.hand.add(held.group)
      placeTag()
      apply(cur)
    },
    setHeld(weapon) {
      if (held) { rig.hand.remove(held.group); held.dispose(); held = null }
      heldWeapon = weapon
      if (!weapon) return
      held = buildWeaponModel(weapon)
      rig.hand.add(held.group)
    },
    setTag(name, title) {
      if (tag) {
        group.remove(tag)
        const m = tag.material as THREE.SpriteMaterial
        m.map?.dispose(); m.dispose()
        tag = null
      }
      if (!name) return
      const c = tagCanvas(name, title)
      const tex = pixelTexture(c)
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, sizeAttenuation: false })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.set(c.width * 0.004, c.height * 0.004, 1)
      sprite.renderOrder = 5
      // One texel = a whole number of screen pixels, whatever the camera distance.
      sprite.onBeforeRender = (r, _s, cam) => {
        const target = r.getRenderTarget()
        const H = target ? target.height : r.getDrawingBufferSize(tagTmp).y
        if (!H) return
        const k = H <= 480 ? 1 : Math.max(1, Math.round(H / 360))
        const p11 = cam.projectionMatrix.elements[5]!
        const sy = (c.height * k * 2) / (p11 * H)
        sprite.scale.set(sy * c.width / c.height, sy, 1)
        sprite.updateMatrixWorld()
      }
      tag = sprite
      group.add(tag)
      placeTag()
    },
    animate(pose, dt, speed = 0) {
      t += dt
      if (pose === 'walk' || pose === 'run') phase += dt * (pose === 'run' ? 11 : 5 + 5 * speed)
      else phase = 0
      const target = poseTargets(pose, t, phase, speed, !!heldWeapon, rig.skirt)
      // Snap when the body flips between lying and standing, ease otherwise.
      const snap = (pose === 'sleep') !== (lastPose === 'sleep') || dt === 0
      const k = snap ? 1 : 1 - Math.exp(-dt * (pose === 'walk' || pose === 'run' || pose === 'dance' || pose === 'swing' ? 18 : 10))
      for (const key of Object.keys(cur) as (keyof Joints)[]) cur[key] += (target[key] - cur[key]) * k
      lastPose = pose
      apply(cur)

      // Blink now and then (not while asleep: eyes shut).
      if (pose === 'sleep') rig.faceMat.map = blinkTex()
      else {
        if (t > nextBlink) { blinkUntil = t + 0.13; nextBlink = t + 2.2 + Math.random() * 2.8 }
        rig.faceMat.map = t < blinkUntil ? blinkTex() : faceTex()
      }

      // Back items move with the body.
      const b = rig.back
      if (b) {
        const moving = pose === 'walk' || pose === 'run' ? Math.max(0.3, speed) : 0
        for (const p of b.pivots) {
          if (b.kind === 'cape') {
            const air = pose === 'jump' || pose === 'fall' ? 0.7 : 0
            p.rotation.x = pose === 'sit' || pose === 'sleep' ? 0 : 0.06 + moving * 0.75 + air + Math.sin(t * 7) * 0.05 * (moving + 0.4)
          } else if (b.kind === 'fairy') {
            const s = p.userData.side as number
            const rate = pose === 'jump' || pose === 'fall' ? 26 : 9
            p.rotation.y = s * (0.3 + Math.sin(t * rate) * 0.28)
          } else if (b.kind === 'tail') {
            p.rotation.y = Math.sin(t * (moving ? 9 : 3.5)) * 0.45
            p.rotation.x = -0.1 + Math.sin(t * 1.7) * 0.06
          }
        }
        const on = pose === 'jump' || pose === 'fall'
        for (const f of b.flames) {
          f.visible = on
          if (on) f.scale.set(1, 0.75 + Math.random() * 0.5, 1)
        }
      }
    },
    dispose() {
      handle.setHeld(null)
      handle.setTag(null, null)
      disposeTree(rig.body)
      group.remove(rig.body)
    },
  }
  apply(cur)
  return handle
}

// ---------------------------------------------------------------- garments on their own (previews)

/**
 * One clothing item without a person, for the shop and wardrobe pictures:
 * a top on a hanger, trousers, a pair of shoes, a hat, glasses, a back
 * item seen from behind. `userData.frame` is the box worth looking at.
 */
export function buildClothingModel(def: ClothingDef): THREE.Group {
  const root = new THREE.Group()
  const base: PersonLook = {
    skin: 's2', hair: 'none', hairColor: 'black', eyes: 'dots', mouth: 'smile', cheeks: false,
    outfit: { top: '', bottom: '', shoes: '', hat: null, face: null, back: null },
  }
  const frame = new THREE.Box3()
  switch (def.slot) {
    case 'top': {
      const look = { ...base, outfit: { ...base.outfit, top: def.id } }
      const mat = textureMaterial(bodyAtlas(look, { ghost: true, slots: ['top'] }), { alphaTest: 0.5 })
      const torso = new THREE.Group()
      const tGeo = atlasBox(1, 1, 0.5, ['torsoSide', 'torsoSide', 'torsoTop', 'torsoBottom', 'torsoFront', 'torsoBack'])
      tGeo.translate(0, 0.5, 0)
      torso.add(new THREE.Mesh(tGeo, mat))
      const tp = new PartSet()
      torsoPieces(tp, look)
      for (const side of [1, -1] as const) {
        const arm = new THREE.Group()
        arm.position.set(side * 0.75, 0.85, 0)
        arm.rotation.z = side * 0.28
        arm.add(new THREE.Mesh(limbGeo('arm', false), mat))
        const ap = new PartSet()
        armPieces(ap, look, side)
        ap.flush(arm)
        torso.add(arm)
      }
      // The hanger.
      tp.vc.box(0, 1.1, 0, 0.05, 0.2, 0.05, '#8a80a8')
      tp.vc.box(0, 1.22, 0.0, 0.2, 0.05, 0.05, '#8a80a8')
      tp.vc.box(0.1, 1.18, 0, 0.05, 0.1, 0.05, '#8a80a8')
      tp.flush(torso)
      root.add(torso)
      const long = def.shape === 'gown' ? -0.95 : def.shape === 'dress' ? -0.55 : 0
      frame.set(new THREE.Vector3(-1.1, long, -0.5), new THREE.Vector3(1.1, 1.3, 0.5))
      break
    }
    case 'bottom': {
      const look = { ...base, outfit: { ...base.outfit, bottom: def.id } }
      const mat = textureMaterial(bodyAtlas(look, { ghost: true, slots: ['bottom'] }), { alphaTest: 0.5 })
      const torso = new THREE.Group()
      torso.position.y = 1
      const tGeo = atlasBox(1, 1, 0.5, ['torsoSide', 'torsoSide', 'torsoTop', 'torsoBottom', 'torsoFront', 'torsoBack'])
      tGeo.translate(0, 0.5, 0)
      torso.add(new THREE.Mesh(tGeo, mat))
      const tp = new PartSet()
      torsoPieces(tp, look)
      tp.flush(torso)
      root.add(torso)
      for (const side of [1, -1] as const) {
        const leg = new THREE.Group()
        leg.position.set(side * 0.25, 1, 0)
        leg.add(new THREE.Mesh(limbGeo('leg', false), mat))
        root.add(leg)
      }
      const skirtish = def.shape === 'skirt' || def.shape === 'tutu'
      const shorts = def.shape === 'shorts'
      frame.set(new THREE.Vector3(-0.9, skirtish ? 0.35 : shorts ? 0.45 : -0.05, -0.6), new THREE.Vector3(0.9, 1.4, 0.6))
      break
    }
    case 'shoes': {
      const look = { ...base, outfit: { ...base.outfit, shoes: def.id } }
      const mat = textureMaterial(bodyAtlas(look, { ghost: true, slots: ['shoes'] }), { alphaTest: 0.5 })
      for (const side of [1, -1] as const) {
        const leg = new THREE.Group()
        leg.position.set(side * 0.34, 1 + bodyLift(look), side * 0.12)
        const lp = new PartSet()
        const { toe } = legPieces(lp, look)
        leg.add(new THREE.Mesh(limbGeo('leg', toe), mat))
        lp.flush(leg)
        leg.rotation.y = side * 0.12
        root.add(leg)
      }
      const lift = bodyLift({ ...base, outfit: { ...base.outfit, shoes: def.id } })
      const h = (24 - shoeTopRow(def.shape)) / 24 + lift + 0.04
      frame.set(new THREE.Vector3(-0.66, 0, -0.4), new THREE.Vector3(0.66, Math.max(0.3, h), 0.65))
      break
    }
    case 'hat':
    case 'face': {
      const ps = new PartSet()
      if (def.slot === 'hat') HAT_BUILDERS[def.shape as HatShape]?.(ps, def, HEAD.h)
      else FACE_BUILDERS[def.shape as FaceShape]?.(ps, def)
      const g = new THREE.Group()
      ps.flush(g)
      root.add(g)
      frame.setFromObject(g, true)
      break
    }
    case 'back': {
      const rig = buildBack(def)
      rig.group.rotation.y = Math.PI
      root.add(rig.group)
      frame.setFromObject(rig.group, true)
      break
    }
  }
  root.userData.frame = frame
  return root
}

