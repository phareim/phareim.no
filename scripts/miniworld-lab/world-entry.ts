// Mini World lab page: the real runtime (scene/runtime.ts) on a full-window
// canvas, with a player, neighbours, a house and a weapon, and a hook the
// shot script drives (window.__world). Bundled by world-shot.mjs.
import { createRuntime } from '../../themes/miniworld/scene/runtime'
import type { MiniWorldRuntime, Place, RuntimeEvent } from '../../themes/miniworld/scene/contracts'
import type { PersonLook } from '../../themes/miniworld/types'

const canvas = document.createElement('canvas')
canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;display:block'
document.body.style.margin = '0'
document.body.appendChild(canvas)

const look = (over: Partial<Omit<PersonLook, 'outfit'>> & { outfit?: Partial<PersonLook['outfit']> } = {}): PersonLook => ({
  skin: 's2', hair: 'ponytail', hairColor: 'blond', eyes: 'happy', mouth: 'smile', cheeks: true,
  ...over,
  outfit: { top: 'hoodie-pink', bottom: 'jeans', shoes: 'sneakers-white', hat: null, face: null, back: null, ...(over.outfit ?? {}) },
})

const events: RuntimeEvent[] = []
const rt: MiniWorldRuntime = createRuntime(canvas, { reducedMotion: false, lowPower: new URLSearchParams(location.search).has('low') })
rt.on(e => { if (e.type !== 'sfx') events.push(e) })
const resize = () => rt.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
resize()
window.addEventListener('resize', resize)
rt.setPlayer(look(), 'Ulrikke', 'princess')
rt.setWeapon({ uid: 'w1', base: 'wand', magic: 'stars', color: '#ff8ae0', level: 2, name: 'Stjernestav' })
rt.setHouse({ floor: 'floor-wood', wall: 'wall-cream', items: [] }, [])
rt.setNeighbors([
  { playerId: 'p1', label: 'Maja', title: 'queen', look: look({ skin: 's4', hair: 'afro', hairColor: 'black', outfit: { top: 'dress-party', hat: 'tiara' } }) },
  { playerId: 'p2', label: 'Øyvind', title: null, look: look({ skin: 's1', hair: 'spiky', hairColor: 'ginger', outfit: { top: 'football-shirt' } }) },
  { playerId: 'p3', label: 'Åse', title: null, look: look({ skin: 's3', hair: 'bob', hairColor: 'pink', outfit: { top: 'rainbow-sweater' } }) },
  { playerId: 'p4', label: 'Ærlige Emil', title: 'prince', look: look({ skin: 's5', hair: 'short', hairColor: 'brown' }) },
])
rt.start()

const dbg = (rt as unknown as { __debug: { teleport(x: number, y: number, z: number, yaw: number): void; camera: { yaw: number; pitch: number; dist: number; fix(v: unknown): void }; frame(dt: number): void } }).__debug

;(window as unknown as { __world: unknown }).__world = {
  rt,
  events,
  go(p: Place) { rt.go(p) },
  at(x: number, y: number, z: number, yaw: number, cam?: { yaw?: number; pitch?: number; dist?: number }) {
    dbg.teleport(x, y, z, yaw)
    if (cam?.yaw !== undefined) dbg.camera.yaw = cam.yaw
    if (cam?.pitch !== undefined) dbg.camera.pitch = cam.pitch
    if (cam?.dist !== undefined) dbg.camera.dist = cam.dist
  },
  /** Run n frames by hand (headless rAF is slow and irregular). */
  step(n: number, dt = 1 / 30) { for (let i = 0; i < n; i++) dbg.frame(dt) },
  input: rt.input,
}
