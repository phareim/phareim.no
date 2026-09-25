/**
 * Power-up capsules and rings (2026-09-25). Each capsule is its own shape
 * in its own colour, spinning, with its letter in Neon Shrine's 5×7 font:
 * a nearest-filtered sprite drawn over the shape (readable from ~25 units
 * in), and `drawCapsuleLabel` for the stage's HUD layer, crisp at any
 * distance (draw it at the projected centre when the sprite would be
 * under ~11 px tall).
 */
import * as THREE from 'three'
import { glyphRows } from '../../zelda/render/font'
import { P, geo, hullMat, glowMat, mesh, flashTree, light, letterTexture, ringZ, ringY, mat, type Model, type Hex } from './core'

export type CapsuleId = 'laser' | 'bomb' | 'shield' | 'wing' | 'overdrive'
export const CAPSULE_IDS: CapsuleId[] = ['laser', 'bomb', 'shield', 'wing', 'overdrive']

export const CAPSULE_INFO: Record<CapsuleId, { letter: string; name: string; color: Hex; dark: Hex }> = {
  laser: { letter: 'L', name: 'LASER', color: P.cyan, dark: P.cyanDark },
  bomb: { letter: 'B', name: 'NOVA BOMB', color: P.hot, dark: P.pinkDark },
  shield: { letter: 'S', name: 'SHIELD', color: P.jade, dark: P.jadeDark },
  wing: { letter: 'W', name: 'WING', color: P.gold, dark: P.amber },
  overdrive: { letter: 'O', name: 'OVERDRIVE', color: P.purple, dark: P.purpleDark },
}

export interface CapsuleModel extends Model {
  type: CapsuleId
  /** The letter sprite (hide it when the HUD overlay draws the letter instead). */
  label: THREE.Sprite
  /** The spinning shape (the label stays upright). */
  spinner: THREE.Group
}

/** Capsule collision radius (Flight's pickup test used 2.4 round the ship). */
export const CAPSULE_RADIUS = 1.2

function shape(type: CapsuleId, parent: THREE.Object3D) {
  const { color, dark } = CAPSULE_INFO[type]
  const H = (build: Parameters<typeof geo>[1], c: Hex, glow = false, key = '') =>
    mesh(geo(`capsule/${type}/${c}${key}`, build), glow ? glowMat(c) : hullMat(c), parent)
  switch (type) {
    case 'laser': // a long crystal
      H(g => { g.loft([[[0, 1.35, 0]], ringY(6, 0.55, 0.55, 0.45), ringY(6, 0.55, 0.55, -0.45), [[0, -1.35, 0]]]) }, dark)
      H(g => { g.loft([ringY(6, 0.6, 0.6, 0.12), ringY(6, 0.6, 0.6, -0.12)], false, false) }, color, true)
      break
    case 'bomb': // a round bomb with fins and a fuse
      H(g => { g.add(new THREE.IcosahedronGeometry(0.85, 1)) }, dark)
      H(g => {
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2
          g.add(new THREE.BoxGeometry(0.08, 0.6, 0.55), mat(Math.cos(a) * 0.55, -0.85, Math.sin(a) * 0.55, 0, -a, 0))
        }
        g.add(new THREE.CylinderGeometry(0.22, 0.28, 0.3, 6), mat(0, 0.92, 0))
      }, P.greyDark)
      H(g => { g.loft([ringY(8, 0.9, 0.9, 0.1), ringY(8, 0.9, 0.9, -0.1)], false, false); g.box(0, 1.15, 0, 0.18, 0.2, 0.18) }, color, true)
      break
    case 'shield': // a faceted gem in an orbit ring
      H(g => { g.add(new THREE.DodecahedronGeometry(0.75)) }, dark)
      H(g => { g.add(new THREE.TorusGeometry(1.15, 0.09, 3, 10), mat(0, 0, 0, Math.PI / 2 + 0.35)) }, color, true)
      H(g => { g.add(new THREE.TorusGeometry(1.15, 0.09, 3, 10), mat(0, 0, 0, Math.PI / 2 - 0.35, Math.PI / 2)) }, P.mint, true)
      break
    case 'wing': // a small gold delta, like Claude's ship
      H(g => {
        g.loft([[[0, 0, 1.2]], ringZ(4, 0.28, 0.24, 0.3), ringZ(4, 0.34, 0.28, -0.7)])
        g.plate([[0.2, 0, 0.4], [1.4, -0.1, -0.5], [1.3, -0.1, -0.85], [0.2, 0, -0.6]], 0.1)
        g.plate([[-0.2, 0, 0.4], [-1.4, -0.1, -0.5], [-1.3, -0.1, -0.85], [-0.2, 0, -0.6]], 0.1)
      }, dark)
      H(g => {
        g.box(1.35, -0.1, -0.65, 0.2, 0.18, 0.5).box(-1.35, -0.1, -0.65, 0.2, 0.18, 0.5)
        g.box(0, 0, -0.75, 0.4, 0.3, 0.1)
      }, color, true)
      break
    case 'overdrive': // a ring round a white core
      H(g => { g.add(new THREE.TorusGeometry(0.95, 0.24, 4, 8)) }, dark)
      H(g => { g.add(new THREE.OctahedronGeometry(0.45)) }, P.white, true)
      H(g => { g.add(new THREE.TorusGeometry(0.95, 0.27, 4, 8, Math.PI / 4), mat(0, 0, 0, 0, 0, 0.2)) }, color, true)
      break
  }
}

export function createCapsule(type: CapsuleId): CapsuleModel {
  const root = new THREE.Group()
  const spinner = new THREE.Group()
  root.add(spinner)
  shape(type, spinner)
  const info = CAPSULE_INFO[type]
  const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: letterTexture(info.letter, P.white, info.dark, info.color), depthTest: false, depthWrite: false, fog: false }))
  label.scale.set(0.9, 1.1, 1)
  label.renderOrder = 10
  root.add(label)
  const lights = [light(root, 0, 0, 0, 1.6, info.color, 0.7)]
  const phase = Math.random() * 6.28
  return {
    type, root, spinner, label, lights, radius: CAPSULE_RADIUS,
    flash: on => flashTree(root, on),
    animate(t) {
      spinner.rotation.y = t * 2.2 + phase
      if (type === 'overdrive' || type === 'wing') spinner.rotation.x = Math.sin(t * 1.3 + phase) * 0.4
      spinner.position.y = Math.sin(t * 2.6 + phase) * 0.15
      lights[0]!.a = 0.55 + 0.25 * Math.sin(t * 5 + phase)
    },
  }
}

/** The letter badge for the stage HUD layer, centred on (x, y) in HUD pixels. */
export function drawCapsuleLabel(g: CanvasRenderingContext2D, x: number, y: number, type: CapsuleId) {
  const info = CAPSULE_INFO[type]
  const cx = Math.round(x) - 4
  const cy = Math.round(y) - 5
  g.fillStyle = info.color
  g.fillRect(cx, cy, 9, 11)
  g.fillStyle = info.dark
  g.fillRect(cx + 1, cy + 1, 7, 9)
  g.fillStyle = P.white
  drawGlyphInto(g, info.letter, cx + 2, cy + 2)
}

function drawGlyphInto(g: CanvasRenderingContext2D, ch: string, x: number, y: number) {
  const rows = glyphRows(ch)
  for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r]!.length; k++) if (rows[r]![k] === '#') g.fillRect(x + k, y + r, 1, 1)
}

// ---------------------------------------------------------------- rings

export type RingId = 'silver' | 'gold'

export interface RingModel extends Model {
  type: RingId
}

/** Fly-through rings: radius 2.2 like Flight's (pickup when within 2.2 of the centre). */
export function createRing(type: RingId): RingModel {
  const root = new THREE.Group()
  const spinner = new THREE.Group()
  root.add(spinner)
  const gold = type === 'gold'
  mesh(geo(`ring/${type}/body`, g => { g.add(new THREE.TorusGeometry(2.2, 0.26, 4, 12)) }), hullMat(gold ? P.amber : P.grey), spinner)
  mesh(geo(`ring/${type}/glow`, g => { g.add(new THREE.TorusGeometry(1.92, 0.07, 3, 12)) }), glowMat(gold ? P.gold : P.lavender), spinner)
  if (gold) {
    mesh(geo('ring/gold/gems', g => {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + Math.PI / 4
        g.add(new THREE.OctahedronGeometry(0.34), mat(Math.cos(a) * 2.2, Math.sin(a) * 2.2, 0, 0, 0, 0, 1, 1, 0.7))
      }
    }), glowMat(P.sunPale), spinner)
  }
  const lights = [light(root, 0, 2.2, 0, 1.2, gold ? P.gold : P.lavender, 0.5), light(root, 0, -2.2, 0, 1.2, gold ? P.gold : P.lavender, 0.5)]
  return {
    type, root, lights, radius: 2.2,
    flash: on => flashTree(root, on),
    animate(t) { spinner.rotation.z = t * (gold ? 1.2 : 0.5) },
  }
}
