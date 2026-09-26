/**
 * Mini World's pictures for the UI panels (avatar/house agent): one shared
 * offscreen WebGLRenderer renders the real models small (64–96 px, the
 * pixel look) on a transparent background, once per key; the result is a
 * cached PNG data URL. Show them with `image-rendering: pixelated`.
 *
 * Orthographic cameras fitted to each model's box keep the pictures flat
 * and icon-like at any size.
 */
import * as THREE from 'three'
import type { CreatePreviews, Previews, AvatarPose } from './contracts'
import type { PersonLook, ClothingDef, Weapon } from '../types'
import { buildAvatar } from './avatar'
import { buildClothingModel } from './avatar'
import { buildFurniture } from './furniture'
import { buildWeaponModel } from './weapons'
import { disposeTree } from './meshkit'

interface Shot {
  obj: THREE.Object3D
  frame: THREE.Box3
  /** Direction from the target toward the camera. */
  view: THREE.Vector3
  dispose(): void
  margin?: number
}

export const createPreviews: CreatePreviews = (): Previews => {
  let renderer: THREE.WebGLRenderer | null = null
  let failed = false
  const cache = new Map<string, string>()
  const scene = new THREE.Scene()
  const hemi = new THREE.HemisphereLight('#ffffff', '#c8b8e0', 2.1)
  const sun = new THREE.DirectionalLight('#fff4e4', 2.2)
  sun.position.set(-2, 4, 5)
  scene.add(hemi, sun, sun.target)
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100)

  const getRenderer = (): THREE.WebGLRenderer | null => {
    if (renderer || failed) return renderer
    if (typeof document === 'undefined') return null
    try {
      const canvas = document.createElement('canvas')
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' })
      renderer.setPixelRatio(1)
      renderer.setClearColor(0x000000, 0)
    } catch {
      failed = true
      renderer = null
    }
    return renderer
  }

  const corners = (b: THREE.Box3): THREE.Vector3[] => {
    const out: THREE.Vector3[] = []
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) out.push(new THREE.Vector3(x, y, z))
    return out
  }

  const render = (key: string, size: number, make: () => Shot): string => {
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const r = getRenderer()
    if (!r) return ''
    const shot = make()
    try {
      scene.add(shot.obj)
      shot.obj.updateMatrixWorld(true)
      // Points are sized in pixels under an orthographic camera: make sparkles a few pixels.
      shot.obj.traverse((o) => {
        const p = o as THREE.Points
        if (!p.isPoints) return
        const m = p.material as THREE.PointsMaterial
        m.size = Math.max(3, Math.round(size / 18))
        // Additive light turns dark on a transparent background: draw them plain and at full brightness.
        m.blending = THREE.NormalBlending
        m.alphaTest = 0.5
        const c = p.geometry.getAttribute('color') as THREE.BufferAttribute | undefined
        if (c) for (let i = 0; i < c.count; i++) {
          const mx = Math.max(c.getX(i), c.getY(i), c.getZ(i))
          if (mx < 0.05) c.setXYZ(i, 1, 1, 1)
          else c.setXYZ(i, c.getX(i) / mx, c.getY(i) / mx, c.getZ(i) / mx)
        }
        if (c) c.needsUpdate = true
      })
      const center = shot.frame.getCenter(new THREE.Vector3())
      const dir = shot.view.clone().normalize()
      cam.position.copy(center).addScaledVector(dir, 30)
      cam.up.set(0, 1, 0)
      cam.lookAt(center)
      cam.updateMatrixWorld(true)
      // Fit the frame's corners in view space, square, with a margin.
      const inv = cam.matrixWorldInverse
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
      for (const p of corners(shot.frame)) {
        p.applyMatrix4(inv)
        minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y)
      }
      const half = Math.max(maxX - minX, maxY - minY) / 2 * (shot.margin ?? 1.08)
      const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
      cam.left = cx - half; cam.right = cx + half; cam.top = cy + half; cam.bottom = cy - half
      cam.near = 0.1; cam.far = 80
      cam.updateProjectionMatrix()
      r.setSize(size, size, false)
      r.render(scene, cam)
      const url = r.domElement.toDataURL('image/png')
      cache.set(key, url)
      return url
    } catch {
      return ''
    } finally {
      scene.remove(shot.obj)
      shot.dispose()
    }
  }

  return {
    person(look: PersonLook, opts: { full?: boolean; size?: number; pose?: AvatarPose } = {}) {
      const size = opts.size ?? (opts.full ? 96 : 64)
      const pose = opts.pose ?? 'idle'
      const key = `p|${JSON.stringify(look)}|${opts.full ? 1 : 0}|${size}|${pose}`
      return render(key, size, () => {
        const a = buildAvatar(look)
        a.animate(pose, 0)
        for (let i = 0; i < 9; i++) a.animate(pose, 1 / 30, 0.6)
        a.group.rotation.y = 0.35
        const top = (a as unknown as { height: number }).height ?? 2.7
        const frame = opts.full
          ? new THREE.Box3(new THREE.Vector3(-0.95, 0, -0.6), new THREE.Vector3(0.95, Math.max(2.7, top + 0.05), 0.6))
          : new THREE.Box3(new THREE.Vector3(-0.56, 1.78, -0.4), new THREE.Vector3(0.56, Math.max(2.72, Math.min(top + 0.02, 3.3)), 0.4))
        return { obj: a.group, frame, view: new THREE.Vector3(0.12, opts.full ? 0.22 : 0.12, 1), dispose: () => a.dispose(), margin: opts.full ? 1.04 : 1.02 }
      })
    },
    clothing(def: ClothingDef, size = 64) {
      return render(`c|${def.id}|${size}`, size, () => {
        const g = buildClothingModel(def)
        const frame = (g.userData.frame as THREE.Box3).clone()
        if (frame.isEmpty()) frame.setFromObject(g)
        const view = def.slot === 'shoes' ? new THREE.Vector3(0.7, 0.35, 1) : def.slot === 'hat' ? new THREE.Vector3(0.4, 0.55, 1) : def.slot === 'back' ? new THREE.Vector3(0.5, 0.25, 1) : new THREE.Vector3(0.3, 0.2, 1)
        return { obj: g, frame, view, dispose: () => disposeTree(g) }
      })
    },
    furniture(id: string, level: 1 | 2 | 3, size = 80) {
      return render(`f|${id}|${level}|${size}`, size, () => {
        const f = buildFurniture(id, level)
        f.update(0.016, 1.2)
        const wall = f.def.kind === 'wall'
        const frame = new THREE.Box3()
        f.group.updateMatrixWorld(true)
        f.group.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.isMesh || o.userData.noFrame) return
          m.geometry.computeBoundingBox()
          frame.union(m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld))
        })
        if (f.def.kind === 'rug') frame.max.y = Math.max(frame.max.y, 0.4)
        const view = wall ? new THREE.Vector3(0.45, 0.2, 1) : f.def.kind === 'rug' ? new THREE.Vector3(0.7, 1.6, 1) : new THREE.Vector3(0.85, 0.75, 1)
        return { obj: f.group, frame, view, dispose: () => f.dispose() }
      })
    },
    weapon(w: Weapon, size = 64) {
      return render(`w|${w.base}|${w.magic}|${w.color}|${w.level}|${size}`, size, () => {
        const m = buildWeaponModel(w)
        const holder = new THREE.Group()
        holder.add(m.group)
        m.group.rotation.x = -Math.PI / 4
        holder.updateMatrixWorld(true)
        const frame = new THREE.Box3()
        holder.traverse((o) => {
          const mm = o as THREE.Mesh
          if (!mm.isMesh) return
          mm.geometry.computeBoundingBox()
          frame.union(mm.geometry.boundingBox!.clone().applyMatrix4(mm.matrixWorld))
        })
        return { obj: holder, frame, view: new THREE.Vector3(-1, 0.25, 0.35), dispose: () => m.dispose() }
      })
    },
    dispose() {
      cache.clear()
      renderer?.dispose()
      renderer?.forceContextLoss()
      renderer = null
    },
  }
}
