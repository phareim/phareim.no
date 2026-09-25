/**
 * The model lab's pages. Each page places its models, moves them every
 * frame and reports glow anchors, labels and (bosses) hit spheres.
 */
import * as THREE from 'three'
import type { BiomeId } from '../pixel'
import { eachLight } from '../models/core'
import { BOSS_IDS, createBoss, type AnyBoss, type BossId } from '../models/bosses'
import type { Backdrop } from './backdrop'
import { enemiesPage, capsulesPage, propsPage, fxPage, biomesPage, squadPage } from './gridPages'

export interface LabParams {
  page: string
  biome: BiomeId | 'all' | ''
  boss: string
  t: number
  freeze: boolean
  spin: boolean
  yaw: number
  hits: boolean
  near: boolean
  far: boolean
  flash: boolean
  /** Grid pages: show only the items whose label contains this (big, close up). */
  only: string
}

export interface LabLabel { x: number; y: number; z: number; text: string; color?: string }
export interface LabCircle { x: number; y: number; z: number; r: number; color: string }
export type LightFn = (x: number, y: number, z: number, r: number, color: string, a: number) => void

export interface LabPage {
  title: string
  /** Ground scroll (world units). */
  offset?: number
  update(t: number, dt: number): void
  lights(add: LightFn): void
  labels(): LabLabel[]
  circles?(): LabCircle[]
  /** Draw on the HUD layer; `proj` maps a world point to HUD pixels. */
  draw?(hud: CanvasRenderingContext2D, proj: (x: number, y: number, z: number) => { x: number; y: number } | null): void
  dispose?(): void
}

export function createPage(p: LabParams, scene: THREE.Scene, camera: THREE.PerspectiveCamera, backdrop: Backdrop): LabPage {
  switch (p.page) {
    case 'bosses': return bossesPage(p, scene, camera, backdrop)
    case 'capsules': return capsulesPage(p, scene, camera, backdrop)
    case 'props': return propsPage(p, scene, camera, backdrop)
    case 'fx': return fxPage(p, scene, camera, backdrop)
    case 'biomes': return biomesPage(p, scene, camera, backdrop)
    case 'squad': return squadPage(p, scene, camera, backdrop)
    default: return enemiesPage(p, scene, camera, backdrop)
  }
}

const BOSS_BIOME: Record<BossId, BiomeId> = { pincer: 'coast', moth: 'woods', furnace: 'ember', twins: 'lake', crown: 'space' }

function bossesPage(p: LabParams, scene: THREE.Scene, camera: THREE.PerspectiveCamera, backdrop: Backdrop): LabPage {
  const id = (BOSS_IDS as string[]).includes(p.boss) ? (p.boss as BossId) : 'pincer'
  backdrop.setBiome(p.biome && p.biome !== 'all' ? p.biome : BOSS_BIOME[id])
  const boss: AnyBoss = createBoss(id)
  const z = p.near ? -34 : -60
  boss.root.position.set(0, id === 'furnace' ? 0 : 2, z)
  scene.add(boss.root)
  camera.position.set(0, 3.8, 11.5)
  camera.lookAt(0, 1, -40)
  const v = new THREE.Vector3()
  let offset = 0
  return {
    title: `BOSS · ${id.toUpperCase()}`,
    get offset() { return offset },
    update(t, dt) {
      offset += dt * 16
      boss.demo(t)
      boss.animate(t, dt)
      if (p.flash) boss.flash(Math.floor(t * 4) % 8 === 0)
    },
    lights(add) { eachLight(boss.lights, add) },
    labels() { return [] },
    circles() {
      if (!p.hits) return []
      boss.root.updateMatrixWorld(true)
      const out: LabCircle[] = []
      for (const part of [...boss.cores, ...boss.parts]) {
        if (!part.alive) continue
        boss.partWorld(part, v)
        out.push({ x: v.x, y: v.y, z: v.z, r: part.r, color: part.kind === 'core' ? (part.open ? '#ffd23f' : '#8f86b8') : '#b6ff4a' })
      }
      return out
    },
  }
}
