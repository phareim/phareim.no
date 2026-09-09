import * as THREE from 'three'
import type { ShipDef } from './ships'

/**
 * Shared low-poly player ships. The Hangar viewer and Star Fox build the
 * exact same model from the same def — so the ship a player picks in the
 * profile is visibly the ship they fly. Only ever imported from async
 * components (Star Fox Flight, Hangar ShipViewer), never from the theme
 * registry path, so three.js stays out of the initial bundle.
 */

export interface PlayerShipModel {
  root: THREE.Group
  bank: THREE.Group
  engine: THREE.Sprite
}

function hex(css: string): number {
  return Number.parseInt(css.slice(1), 16)
}

function edgeLines(mesh: THREE.Mesh, color: number, opacity: number): THREE.LineSegments {
  const edges = new THREE.EdgesGeometry(mesh.geometry, 20)
  const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity })
  const lines = new THREE.LineSegments(edges, mat)
  lines.position.copy(mesh.position)
  lines.rotation.copy(mesh.rotation)
  lines.scale.copy(mesh.scale)
  return lines
}

/** Soft round sprite texture for engine glows (no asset files). */
export function makeGlowTexture(size = 64): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/**
 * Builds the player's ship for `def`. `dart` is the classic swept-wing
 * Arwing; `vandal` is a heavier striker: straight wide wings, twin tail
 * fins and a chin gun. Hull bodies stay dark metal so both read against
 * the violet-black sky; the def's colours carry edges, tips and engine.
 */
export function buildPlayerShip(def: ShipDef, glowTex: THREE.Texture): PlayerShipModel {
  const root = new THREE.Group()
  const bank = new THREE.Group()
  root.add(bank)

  const edge = hex(def.colors.trim)
  const tipA = hex(def.colors.hull)
  const tipB = hex(def.colors.glow)
  const engineCol = hex(def.colors.glow)
  const vandal = def.variant === 'vandal'

  const chrome = new THREE.MeshStandardMaterial({
    color: vandal ? 0x3a2c14 : 0x232c44,
    metalness: 0.85,
    roughness: 0.35,
    flatShading: true,
  })
  const dark = new THREE.MeshStandardMaterial({
    color: 0x11162a,
    metalness: 0.6,
    roughness: 0.5,
    flatShading: true,
  })
  const glowA = new THREE.MeshBasicMaterial({ color: tipA })
  const glowB = new THREE.MeshBasicMaterial({ color: tipB })

  // Fuselage: nose spike forward (-Z).
  const noseLen = vandal ? 2.8 : 3.4
  const nose = new THREE.Mesh(new THREE.ConeGeometry(vandal ? 0.68 : 0.55, noseLen, 6), chrome)
  nose.rotation.x = -Math.PI / 2
  nose.position.z = -0.6
  bank.add(nose, edgeLines(nose, edge, 0.9))

  // Cockpit hump.
  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(vandal ? 0.5 : 0.42, 8, 6), chrome)
  cockpit.position.set(0, vandal ? 0.5 : 0.42, 0.4)
  cockpit.scale.set(1, 0.7, 1.6)
  bank.add(cockpit, edgeLines(cockpit, edge, 0.9))

  // Main wings: swept dart vs straight wide striker.
  const span = vandal ? 2.3 : 1.7
  const wingGeo = new THREE.BoxGeometry(vandal ? 4.6 : 3.4, vandal ? 0.16 : 0.12, vandal ? 1.4 : 1.1)
  for (const s of [-1, 1]) {
    const wing = new THREE.Mesh(wingGeo, dark)
    wing.position.set(s * span, -0.05, 0.7)
    if (!vandal) {
      wing.rotation.y = s * -0.35
      wing.rotation.z = s * -0.12
    }
    bank.add(wing, edgeLines(wing, edge, 0.75))
    // Wingtip gun.
    const gunX = s * (vandal ? 4.1 : 3.1)
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, vandal ? 2.4 : 2.0, 6), chrome)
    gun.rotation.x = Math.PI / 2
    gun.position.set(gunX, 0.05, -0.1)
    bank.add(gun)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.14, 6, 6), s < 0 ? glowA : glowB)
    tip.position.set(gunX, 0.05, -1.1)
    bank.add(tip)
  }

  // Tail fins: one pair swept (dart) vs twin upright pairs (vandal).
  const finGeo = new THREE.BoxGeometry(0.1, vandal ? 1.2 : 1.0, 0.9)
  const finOffsets = vandal ? [-0.7, -0.25, 0.25, 0.7] : [-0.5, 0.5]
  for (const fx of finOffsets) {
    const fin = new THREE.Mesh(finGeo, chrome)
    fin.position.set(fx, 0.5, 1.4)
    if (!vandal) fin.rotation.z = Math.sign(fx) * -0.25
    bank.add(fin, edgeLines(fin, edge, 0.7))
  }

  // Chin gun, vandal only.
  if (vandal) {
    const chin = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 6), chrome)
    chin.rotation.x = Math.PI / 2
    chin.position.set(0, -0.35, -0.6)
    bank.add(chin)
    const chinTip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), glowB)
    chinTip.position.set(0, -0.35, -1.4)
    bank.add(chinTip)
  }

  // Engine glow sprite.
  const engMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: engineCol,
    transparent: true,
    opacity: 0.6,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  })
  const engine = new THREE.Sprite(engMat)
  engine.position.set(0, -0.05, 1.7)
  engine.scale.set(vandal ? 0.9 : 0.7, vandal ? 0.9 : 0.7, 1)
  bank.add(engine)

  return { root, bank, engine }
}
