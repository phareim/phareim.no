// Mini World lab page: the real runtime (scene/runtime.ts) on a full-window
// canvas, with a player, neighbours, a house and a weapon, and a hook the
// shot script drives (window.__world). Bundled by world-shot.mjs.
import { createRuntime } from '../../themes/miniworld/scene/runtime'
import type { MiniWorldRuntime, Place, RuntimeEvent } from '../../themes/miniworld/scene/contracts'
import type { PersonLook } from '../../themes/miniworld/types'
import type { PeerInfo, PeerFx, NetPose } from '../../themes/miniworld/net/protocol'

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

const dbg = (rt as unknown as { __debug: { teleport(x: number, y: number, z: number, yaw: number): void; camera: { yaw: number; pitch: number; dist: number; fix(v: unknown): void; camera: { position: { x: number; y: number; z: number }; updateMatrixWorld(): void } }; body: { x: number; y: number; z: number }; frame(dt: number): void; setPeerClock(fn: () => number): void; peerPos(id: string): { x: number; y: number; z: number } | null } }).__debug

// ------------------------------------------------ fake peers (peers-shot.mjs)
// A virtual clock the peers are sampled on, advanced by step(), so headless
// frames (slow, irregular) still see states arrive ten times a second.
let vclock = 0
dbg.setPeerClock(() => vclock)
type Path = (t: number) => { x: number; z: number; a: NetPose; s: number; r?: number }
interface Fake { id: string; pl: string; path: Path; sent: number; fx?: { every: number; last: number; fx: PeerFx } }
const fakes: Fake[] = []
const circle = (cx: number, cz: number, rad: number, speed: number, ph = 0): Path => t => {
  const a = ph + (t * speed) / rad
  return { x: cx + Math.cos(a) * rad, z: cz + Math.sin(a) * rad, a: speed > 5 ? 'run' : 'walk', s: Math.min(1, speed / 6), r: Math.atan2(-Math.sin(a), Math.cos(a)) * (speed > 0 ? 1 : -1) }
}
const line = (x0: number, z0: number, x1: number, z1: number, speed: number): Path => t => {
  const L = Math.hypot(x1 - x0, z1 - z0)
  const k = ((t * speed) / L) % 2
  const f = k < 1 ? k : 2 - k
  const dir = k < 1 ? 1 : -1
  return { x: x0 + (x1 - x0) * f, z: z0 + (z1 - z0) * f, a: 'walk', s: speed / 6, r: Math.atan2((x1 - x0) * dir, (z1 - z0) * dir) }
}
const still = (x: number, z: number, r: number, a: NetPose = 'idle'): Path => () => ({ x, z, a, s: 0, r })
const tickFakes = () => {
  for (const f of fakes) {
    if (vclock - f.sent < 100) continue
    f.sent = vclock
    const p = f.path(vclock / 1000)
    rt.peers.state(f.id, { pl: f.pl, x: p.x, y: 0, z: p.z, r: p.r ?? 0, a: p.a, s: p.s }, vclock)
    if (f.fx && vclock - f.fx.last > f.fx.every) { f.fx.last = vclock; rt.peers.fx(f.id, f.fx.fx) }
  }
}
function addFake(id: string, info: PeerInfo, pl: string, path: Path, fx?: Fake['fx']) {
  rt.peers.upsert(id, info)
  fakes.push({ id, pl, path, sent: -1e9, fx })
}
function crowd(where: 'torget' | 'nabogata' | 'park' = 'torget') {
  const L = (o: Parameters<typeof look>[0]) => look(o)
  const mk = (pub: string, name: string, lk: unknown, title: PeerInfo['title'] = null, held: unknown = null): PeerInfo => ({ pub, name, title, look: lk, held })
  if (where === 'nabogata') {
    // A neighbour live in town: their waving figure by the gate steps aside (Maja's, next door, stays).
    addFake('n2', mk('p2', 'Øyvind', L({ skin: 's1', hair: 'spiky', hairColor: 'ginger', outfit: { top: 'football-shirt' } })), 'town', line(-25, 3, -18, 3, 2))
    addFake('s1', mk('q1', 'Sara', L({ skin: 's3', hair: 'pigtails', hairColor: 'pink', outfit: { top: 'dress-flower', bottom: 'leggings-dots', hat: 'bow-pink' } })), 'town', still(-27, 2, 2.4, 'wave'))
    return
  }
  const cx = where === 'park' ? 36 : 0
  const cz = where === 'park' ? 36 : 8.5
  addFake('s1', mk('q1', 'Sara', L({ skin: 's3', hair: 'pigtails', hairColor: 'pink', outfit: { top: 'dress-flower', bottom: 'leggings-dots', hat: 'bow-pink' } })), 'town', circle(cx, cz - 2, 5, 3))
  addFake('s2', mk('q2', 'Jonas', L({ skin: 's5', hair: 'curly', hairColor: 'black', outfit: { top: 'football-shirt', bottom: 'shorts-sport', hat: 'cap-red' } })), 'town', circle(cx + 1, cz - 3, 7, 6, 2))
  addFake('s3', mk('q3', 'Ida', L({ skin: 's1', hair: 'long', hairColor: 'blond', outfit: { top: 'princess-gown', hat: 'tiara-princess', back: 'fairy-wings' } }), 'princess'), 'town', still(cx - 3, cz - 4, 0.4, 'idle'), { every: 2200, last: -1e9, fx: { k: 'emote', e: 'dance' } })
  addFake('s4', mk('q4', 'Theo', L({ skin: 's4', hair: 'spiky', hairColor: 'blue', outfit: { top: 'knight-top', bottom: 'pants-cargo', back: 'cape-red' } }), null, { base: 'wand', magic: 'hearts', color: '#ff5fa8', level: 3 }), 'town', still(cx + 4, cz - 3, -0.6), { every: 700, last: -1e9, fx: { k: 'magic', magic: 'hearts', level: 3, dx: -0.56, dy: 0, dz: 0.83 } })
  addFake('s5', mk('q5', 'Nora', L({ skin: 's2', hair: 'bun', hairColor: 'ginger', outfit: { top: 'star-top', bottom: 'skirt-star', face: 'heart-glasses' } }), 'queen'), 'town', still(cx - 5, cz - 1, 1.2), { every: 1500, last: -1e9, fx: { k: 'emote', e: 'heart' } })
  addFake('s6', mk('q6', 'Ali', L({ skin: 's6', hair: 'short', hairColor: 'black', outfit: { top: 'space-suit', bottom: 'pants-space', back: 'jetpack', hat: 'space-helmet' } })), 'town', line(cx - 8, cz - 8, cx + 8, cz - 8, 4))
  addFake('s7', mk('q7', 'Maja', L({ skin: 's3', hair: 'braids', hairColor: 'purple', outfit: { top: 'tiger-top', hat: 'cat-ears', back: 'cat-tail' } })), 'town', still(cx + 2, cz - 6, 3.1, 'wave'))
  addFake('s8', mk('q8', 'Emil', L({ skin: 's2', hair: 'afro', hairColor: 'mint', outfit: { top: 'rainbow-sweater', bottom: 'pants-rainbow', hat: 'wizard-hat' } }), 'prince'), 'town', still(cx - 1, cz - 7, 0, 'cheer'))
  addFake('s9', mk('q9', 'Liv', L({ skin: 's1', hair: 'ponytail', hairColor: 'white', outfit: { top: 'sweater-winter', bottom: 'pants-snow', shoes: 'boots-winter', hat: 'beanie' } })), 'town', line(cx - 10, cz - 12, cx + 6, cz - 12, 2.5))
  addFake('s10', mk('q10', 'Odin', L({ skin: 's4', hair: 'none', hairColor: 'black', outfit: { top: 'royal-robe', hat: 'crown-king', back: 'royal-cape' } }), 'king'), 'town', circle(cx, cz - 10, 3, 2, 1))
  // Garbage in the look and the weapon: must fall back, not crash.
  addFake('s11', mk('q11', 'Rart', { skin: 'green', hair: 42, outfit: 'x' }, null, { base: 'bazooka', magic: 'fire' }), 'town', still(cx + 6, cz - 7, -1))
  addFake('s12', mk('q12', 'Vilde', L({ skin: 's5', hair: 'bob', hairColor: 'rainbow', outfit: { top: 'obby-hoodie', bottom: 'skirt-tutu', shoes: 'skates', hat: 'unicorn-horn' } })), 'town', circle(cx + 3, cz - 1, 2.5, 3.5, 4))
  // Elsewhere: never drawn here.
  addFake('x1', mk('z1', 'Borte', L({})), 'obby:hard', still(cx, cz - 2, 0))
  addFake('x2', mk('z2', 'Hjemme', L({})), 'house:z2', still(cx + 1, cz - 2, 0))
}

/** Taps (pointerdown + up at one spot) on where a peer's chest is on screen. */
function tapPeer(id: string, pointerType = 'touch') {
  const cam = dbg.camera.camera as unknown as import('three').PerspectiveCamera
  const g = dbg.peerPos(id)
  if (!g) return 'no-peer'
  cam.updateMatrixWorld()
  const v = new (cam.position.constructor as typeof import('three').Vector3)(g.x, g.y + 1.4, g.z).project(cam)
  const r = canvas.getBoundingClientRect()
  const x = r.left + (v.x + 1) / 2 * r.width, y = r.top + (1 - v.y) / 2 * r.height
  const opts = { clientX: x, clientY: y, pointerId: 7, pointerType, button: 0, bubbles: true, isPrimary: true }
  canvas.dispatchEvent(new PointerEvent('pointerdown', opts))
  canvas.dispatchEvent(new PointerEvent('pointerup', opts))
  return `${Math.round(x)},${Math.round(y)}`
}

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
  step(n: number, dt = 1 / 30) { for (let i = 0; i < n; i++) { vclock += dt * 1000; tickFakes(); dbg.frame(dt) } },
  input: rt.input,
  crowd,
  tapPeer,
}
