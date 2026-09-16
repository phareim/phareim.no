/**
 * Neon Shrine (theme id `zelda`) — Canvas 2D renderer.
 *
 * Read-only: reads GameState, never mutates it (only reads `state.shake`).
 * Owns its own bounded pools (<= 200 particles, <= 8 rings, objects reused).
 * Imports ./types and MACHINE_FONT from ../base/fonts.ts only.
 *
 * NOTE TO INTEGRATOR (Zelda.vue): createRenderer takes an extra `world`
 * argument — createRenderer(canvas, world) — so chests/pickups/room names
 * can be resolved from room.chestsClosed / room.pickupsLeft via an internal
 * `chestLookup`. This deviation from the Renderer interface in types.ts is
 * intentional. `world` is optional at runtime (missing world = ids as names,
 * no chests/pickups drawn), but always pass it.
 */

import type {
  ChestPlacement,
  Enemy,
  Facing,
  FrameUI,
  GameEvent,
  GameState,
  PickupPlacement,
  Renderer,
  TileChar,
  World,
} from './types'
import { MACHINE_FONT } from '../base/fonts'
import { SLIDE_TIME, SWING_TIME, SWORD_ARC, SWORD_REACH } from './types'

// ---------------------------------------------------------------------------
// Palette (Neon Dreams)
// ---------------------------------------------------------------------------

const BG = '#0b0616'
const FLOOR_ALT = '#120a26'
const WALL_FILL = '#160b2e'
const CYAN = '#2ff3ff'
const PINK = '#ff2fa0'
const GOLD = '#ffd23f'
const VIOLET = '#7b3fe4'
const WATER_BASE = '#062a33'
const GRASS_STROKE = '#35f2c8'
const WHITE = '#ffffff'

const HUD_MIN = 34 // px strip above the room
const PORTRAIT_RESERVE = 0.34 // fraction of height kept below in portrait
const LANDSCAPE_RESERVE = 0.22 // fraction of width kept on EACH side
const MAX_PARTICLES = 200
const MAX_RINGS = 8
const DROP_LIFE = 8 // drops blink after t > 6 (last 2 s)

type Ctx = CanvasRenderingContext2D

interface Particle {
  alive: boolean
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  size: number
  color: string
  tri: boolean
}

interface Ring {
  alive: boolean
  x: number
  y: number
  r0: number
  r1: number
  t: number
  dur: number
  color: string
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v
}

function facingAngle(f: Facing): number {
  switch (f) {
    case 'up': return -Math.PI / 2
    case 'right': return 0
    case 'down': return Math.PI / 2
    case 'left': return Math.PI
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createRenderer(canvas: HTMLCanvasElement, world?: World): Renderer {
  // The smoke-test stub returns a Proxy here; cast through unknown.
  const ctx = canvas.getContext('2d') as unknown as Ctx

  // Lookups built from the authored world (chest/pickup id -> placement).
  const chestLookup = new Map<string, ChestPlacement>()
  const pickupLookup = new Map<string, PickupPlacement>()
  const roomName = new Map<string, string>()
  if (world) {
    for (const id of Object.keys(world.rooms)) {
      const room = world.rooms[id]
      if (!room) continue
      roomName.set(room.id, room.name)
      for (const c of room.chests) chestLookup.set(c.id, c)
      for (const p of room.pickups) pickupLookup.set(p.id, p)
    }
  }

  let cssW = 0
  let cssH = 0
  let dprEff = 1
  let rect: Rect = { x: 0, y: 0, w: 0, h: 0 }
  let tile = 16
  let lastRoomW = 15
  let lastRoomH = 11

  // Static tile-layer cache (offscreen; null when document is unavailable,
  // e.g. the node smoke test — then tiles are painted directly each frame).
  let tileCache: HTMLCanvasElement | null = null
  let tileHash = ''
  // Previous room's tile layer, snapshotted on slideStart for the scroll.
  let slideFrom: HTMLCanvasElement | null = null

  // Presentation clock (particles, bob, water, walk cycle only).
  let presentT = 0
  // Last seen player/room centre in tile units, for position-less events
  // ('bossDefeated' and 'won' carry no coordinates).
  let lastFx = 7.5
  let lastFy = 5.5
  let walkPhase = 0
  let flashT = 0 // pink playerHit overlay, seconds left

  const particles: Particle[] = []
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particles.push({ alive: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2, color: CYAN, tri: false })
  }
  const rings: Ring[] = []
  for (let i = 0; i < MAX_RINGS; i++) {
    rings.push({ alive: false, x: 0, y: 0, r0: 0, r1: 0, t: 0, dur: 1, color: GOLD })
  }

  function makeOffscreen(w: number, h: number): HTMLCanvasElement | null {
    try {
      if (typeof document === 'undefined') return null
      const c = document.createElement('canvas')
      c.width = Math.max(1, Math.round(w))
      c.height = Math.max(1, Math.round(h))
      return c
    } catch {
      return null
    }
  }

  // -- layout ---------------------------------------------------------------

  function computeLayout(roomW: number, roomH: number): void {
    lastRoomW = roomW
    lastRoomH = roomH
    if (cssW <= 0 || cssH <= 0) {
      rect = { x: 0, y: 0, w: 0, h: 0 }
      tile = 1
      return
    }
    const hud = Math.max(HUD_MIN, Math.min(44, Math.floor(cssH * 0.06)))
    const portrait = cssH > cssW
    let ax: number
    let aw: number
    let ay: number
    let ah: number
    if (portrait) {
      const reserveBottom = Math.ceil(cssH * PORTRAIT_RESERVE)
      ax = 0
      aw = cssW
      ay = hud
      ah = cssH - hud - reserveBottom
    } else {
      const side = cssW * LANDSCAPE_RESERVE
      ax = side
      aw = cssW - side * 2
      ay = hud
      ah = cssH - hud
    }
    aw = Math.max(1, aw)
    ah = Math.max(1, ah)
    tile = Math.max(1, Math.floor(Math.min(aw / roomW, ah / roomH)))
    const rw = tile * roomW
    const rh = tile * roomH
    rect = {
      x: ax + (aw - rw) / 2,
      y: ay + (ah - rh) / 2,
      w: rw,
      h: rh,
    }
  }

  function resize(width: number, height: number, dpr: number): void {
    cssW = Math.max(0, width)
    cssH = Math.max(0, height)
    dprEff = clamp(dpr || 1, 1, 2)
    try {
      canvas.width = Math.max(1, Math.round(cssW * dprEff))
      canvas.height = Math.max(1, Math.round(cssH * dprEff))
    } catch {
      // stub canvas in tests — width/height fields still assign fine
    }
    tileHash = '' // tile size may have changed; repaint
    computeLayout(lastRoomW, lastRoomH)
  }

  function roomRect(): Rect {
    return { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
  }

  // -- tile hash: repaint only when the grid or size changes -----------------
  // Covers room.id, dimensions, tile size, '.' count and the counts of the
  // mutable tiles ('o' pots, '~' grass, 'L'/'B'/'S' doors).

  function hashRoom(state: GameState): string {
    const r = state.room
    let dots = 0
    let pots = 0
    let grass = 0
    let ldoors = 0
    let bdoors = 0
    let sdoors = 0
    for (let y = 0; y < r.height; y++) {
      const row = r.tiles[y]
      if (!row) continue
      for (let x = 0; x < r.width; x++) {
        const t = row[x] as TileChar
        if (t === '.') dots++
        else if (t === 'o') pots++
        else if (t === '~') grass++
        else if (t === 'L') ldoors++
        else if (t === 'B') bdoors++
        else if (t === 'S') sdoors++
      }
    }
    return `${r.id}|${r.width}x${r.height}|ts=${tile}|.=${dots}|o=${pots}|~=${grass}|L=${ldoors}|B=${bdoors}|S=${sdoors}`
  }

  // -- tile painting ----------------------------------------------------------

  function paintFloor(g: Ctx, px: number, py: number, alt: boolean): void {
    g.fillStyle = alt ? FLOOR_ALT : BG
    g.fillRect(px, py, tile + 0.5, tile + 0.5)
    g.strokeStyle = 'rgba(123,63,228,0.12)'
    g.lineWidth = 1
    g.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1)
  }

  function paintTile(g: Ctx, t: TileChar, px: number, py: number): void {
    const cx = px + tile / 2
    const cy = py + tile / 2
    switch (t) {
      case ',':
        paintFloor(g, px, py, true)
        break
      case '#': {
        paintFloor(g, px, py, false)
        g.fillStyle = WALL_FILL
        g.fillRect(px + 1, py + 1, tile - 2, tile - 2)
        g.strokeStyle = VIOLET
        g.lineWidth = 1
        g.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3)
        g.strokeStyle = 'rgba(47,243,255,0.55)'
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(px + 1, py + 1.5)
        g.lineTo(px + tile - 1, py + 1.5)
        g.stroke()
        break
      }
      case 'T': {
        paintFloor(g, px, py, false)
        const s = tile / 16
        for (let i = 0; i < 3; i++) {
          const ty = py + tile - (3 - i) * 4.6 * s - 1.5 * s
          const half = (2.2 + i * 1.5) * s
          g.beginPath()
          g.moveTo(cx, ty - 5 * s)
          g.lineTo(cx - half, ty)
          g.lineTo(cx + half, ty)
          g.closePath()
          g.fillStyle = '#101c2c'
          g.fill()
          g.strokeStyle = i === 2 ? PINK : VIOLET
          g.lineWidth = 1
          g.stroke()
        }
        g.fillStyle = '#241a10'
        g.fillRect(cx - 1 * s, py + tile - 3.4 * s, 2 * s, 3 * s)
        break
      }
      case 'G': {
        paintFloor(g, px, py, false)
        const w = tile * 0.52
        const h = tile * 0.62
        const rx = cx - w / 2
        const ry = py + tile - h - tile * 0.12
        g.beginPath()
        if (typeof (g as unknown as { roundRect?: unknown }).roundRect === 'function') {
          ;(g as unknown as { roundRect(x: number, y: number, w: number, h: number, r: number): void }).roundRect(rx, ry, w, h, tile * 0.12)
        } else {
          g.rect(rx, ry, w, h)
        }
        g.fillStyle = '#1a1430'
        g.fill()
        g.strokeStyle = GOLD
        g.lineWidth = 1.5
        g.stroke()
        g.strokeStyle = 'rgba(255,210,63,0.5)'
        g.lineWidth = 1
        g.beginPath()
        g.moveTo(cx, ry + h * 0.25)
        g.lineTo(cx, ry + h * 0.7)
        g.stroke()
        break
      }
      case 'W': {
        g.fillStyle = WATER_BASE
        g.fillRect(px, py, tile + 0.5, tile + 0.5)
        g.strokeStyle = 'rgba(47,243,255,0.25)'
        g.lineWidth = 1
        g.strokeRect(px + 0.5, py + 0.5, tile - 1, tile - 1)
        break
      }
      case '~': {
        paintFloor(g, px, py, false)
        g.strokeStyle = GRASS_STROKE
        g.lineWidth = Math.max(1, tile / 16)
        g.beginPath()
        const s = tile / 16
        g.moveTo(cx - 4 * s, py + 11 * s)
        g.lineTo(cx - 3 * s, py + 6 * s)
        g.moveTo(cx, py + 12 * s)
        g.lineTo(cx + 0.6 * s, py + 5 * s)
        g.moveTo(cx + 4 * s, py + 11 * s)
        g.lineTo(cx + 3.4 * s, py + 7 * s)
        g.stroke()
        break
      }
      case 'o': {
        paintFloor(g, px, py, false)
        const r = tile * 0.3
        g.beginPath()
        g.arc(cx, cy + tile * 0.06, r, 0, Math.PI * 2)
        g.fillStyle = '#241a08'
        g.fill()
        g.strokeStyle = GOLD
        g.lineWidth = 1.5
        g.stroke()
        g.beginPath()
        g.arc(cx, cy - tile * 0.16, r * 0.55, Math.PI, 0)
        g.stroke()
        break
      }
      case 'L':
      case 'B': {
        paintFloor(g, px, py, false)
        g.fillStyle = '#2a2008'
        g.fillRect(px + 1, py + 1, tile - 2, tile - 2)
        g.strokeStyle = GOLD
        g.lineWidth = t === 'B' ? 2.5 : 1.5
        g.strokeRect(px + 1.5, py + 1.5, tile - 3, tile - 3)
        if (t === 'L') {
          g.fillStyle = '#0b0616'
          g.beginPath()
          g.arc(cx, cy - tile * 0.06, tile * 0.07, 0, Math.PI * 2)
          g.fill()
          g.fillRect(cx - tile * 0.03, cy - tile * 0.02, tile * 0.06, tile * 0.16)
        } else {
          g.strokeStyle = GOLD
          g.lineWidth = 1.5
          g.beginPath()
          g.moveTo(cx, py + tile * 0.18)
          g.lineTo(cx + tile * 0.2, cy)
          g.lineTo(cx, py + tile * 0.82)
          g.lineTo(cx - tile * 0.2, cy)
          g.closePath()
          g.stroke()
          g.fillStyle = GOLD
          g.beginPath()
          g.arc(cx, cy, tile * 0.05, 0, Math.PI * 2)
          g.fill()
        }
        break
      }
      case 'S': {
        paintFloor(g, px, py, false)
        g.fillStyle = '#1c0a18'
        g.fillRect(px + 1, py + 1, tile - 2, tile - 2)
        g.fillStyle = PINK
        const bars = 4
        for (let i = 0; i < bars; i++) {
          const bx = px + ((i + 0.7) * tile) / (bars + 0.4)
          g.fillRect(bx - tile * 0.045, py + 2, tile * 0.09, tile - 4)
        }
        break
      }
      case '.':
      default:
        paintFloor(g, px, py, false)
        break
    }
  }

  function paintStaticLayer(g: Ctx, state: GameState): void {
    const r = state.room
    for (let y = 0; y < r.height; y++) {
      const row = r.tiles[y]
      if (!row) continue
      for (let x = 0; x < r.width; x++) {
        paintTile(g, (row[x] as TileChar) ?? '.', x * tile, y * tile)
      }
    }
  }

  function ensureTileCache(state: GameState): void {
    const hash = hashRoom(state)
    if (hash === tileHash && tileCache) return
    tileHash = hash
    const w = Math.max(1, Math.round(rect.w * dprEff))
    const h = Math.max(1, Math.round(rect.h * dprEff))
    const off = makeOffscreen(w, h)
    if (!off) {
      tileCache = null
      return
    }
    const g = off.getContext('2d') as unknown as Ctx | null
    if (!g) {
      tileCache = null
      return
    }
    g.setTransform(dprEff, 0, 0, dprEff, 0, 0)
    g.clearRect(0, 0, rect.w, rect.h)
    paintStaticLayer(g, state)
    tileCache = off
  }

  // -- particles / rings -------------------------------------------------------

  function spawn(x: number, y: number, vx: number, vy: number, life: number, size: number, color: string, tri: boolean): void {
    for (const p of particles) {
      if (!p.alive) {
        p.alive = true
        p.x = x
        p.y = y
        p.vx = vx
        p.vy = vy
        p.life = life
        p.maxLife = life
        p.size = size
        p.color = color
        p.tri = tri
        return
      }
    }
  }

  function burst(tx: number, ty: number, n: number, speed: number, color: string, tri: boolean, size: number, life: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const s = speed * (0.4 + Math.random() * 0.8)
      spawn(tx, ty, Math.cos(a) * s, Math.sin(a) * s, life * (0.7 + Math.random() * 0.6), size, color, tri)
    }
  }

  function addRing(tx: number, ty: number, r1: number, dur: number, color: string): void {
    for (const r of rings) {
      if (!r.alive) {
        r.alive = true
        r.x = tx
        r.y = ty
        r.r0 = 0.1
        r.r1 = r1
        r.t = 0
        r.dur = dur
        r.color = color
        return
      }
    }
  }

  function onEvents(events: GameEvent[]): void {
    for (const e of events) {
      switch (e.type) {
        case 'swing':
          break
        case 'swordHit':
          burst(e.x, e.y, 6, 3, CYAN, false, 2.5, 0.35)
          break
        case 'swordClank':
          burst(e.x, e.y, 4, 2, CYAN, false, 2, 0.25)
          break
        case 'enemyDied':
          burst(e.x, e.y, 10 + Math.floor(Math.random() * 5), 4, PINK, true, 3, 0.5)
          break
        case 'potSmash':
          burst(e.x, e.y, 8, 3.5, GOLD, true, 2.5, 0.45)
          break
        case 'grassCut':
          burst(e.x, e.y, 6, 2.5, GRASS_STROKE, false, 2, 0.4)
          break
        case 'playerHit':
          flashT = 0.08
          break
        case 'chestOpened': {
          const c = chestLookup.get(e.id)
          const chx = c ? c.x + 0.5 : lastFx
          const chy = c ? c.y + 0.5 : lastFy
          burst(chx, chy, 12, 3, GOLD, false, 2.5, 0.6)
          addRing(chx, chy, 1.2, 0.5, GOLD)
          break
        }
        case 'respawn':
          break
        case 'bossDefeated':
          burst(lastFx, lastFy, 24, 5, PINK, true, 3.5, 0.8)
          burst(lastFx, lastFy, 12, 3, GOLD, false, 3, 0.8)
          addRing(lastFx, lastFy, 2.5, 0.7, PINK)
          break
        case 'won':
          addRing(lastFx, lastFy, 3, 1.0, GOLD)
          break
        case 'shoot':
          burst(e.x, e.y, 2, 1.5, PINK, false, 2, 0.2)
          break
        case 'doorUnlocked':
        case 'doorOpened':
          burst(e.x, e.y, 8, 2.5, GOLD, false, 2.5, 0.5)
          break
        case 'slideStart':
          // Snapshot the current tile layer for the scroll-out side.
          if (tileCache) {
            const copy = makeOffscreen(tileCache.width, tileCache.height)
            if (copy) {
              const g = copy.getContext('2d') as unknown as Ctx | null
              if (g) {
                g.setTransform(1, 0, 0, 1, 0, 0)
                try {
                  g.drawImage(tileCache, 0, 0)
                } catch {
                  slideFrom = null
                  break
                }
                slideFrom = copy
              }
            }
          }
          break
        default:
          break
      }
    }
  }

  function updateFx(dt: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      for (const p of particles) p.alive = false
      for (const r of rings) r.alive = false
      flashT = 0
      return
    }
    if (flashT > 0) flashT = Math.max(0, flashT - dt)
    for (const p of particles) {
      if (!p.alive) continue
      p.life -= dt
      if (p.life <= 0) {
        p.alive = false
        continue
      }
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vx *= 1 - 2.5 * dt
      p.vy *= 1 - 2.5 * dt
    }
    for (const r of rings) {
      if (!r.alive) continue
      r.t += dt
      if (r.t >= r.dur) r.alive = false
    }
  }

  // -- coordinate helpers -------------------------------------------------------

  function toPx(tx: number, ty: number, ox: number, oy: number): { x: number; y: number } {
    return { x: rect.x + ox + tx * tile, y: rect.y + oy + ty * tile }
  }

  // -- dynamic drawing ----------------------------------------------------------

  function drawHeart(g: Ctx, x: number, y: number, s: number, fill: string | null): void {
    g.beginPath()
    g.moveTo(x, y + s * 0.32)
    g.bezierCurveTo(x - s * 0.55, y - s * 0.08, x - s * 0.32, y - s * 0.5, x, y - s * 0.18)
    g.bezierCurveTo(x + s * 0.32, y - s * 0.5, x + s * 0.55, y - s * 0.08, x, y + s * 0.32)
    g.closePath()
    if (fill) {
      g.fillStyle = fill
      g.fill()
    } else {
      g.strokeStyle = PINK
      g.lineWidth = 1.2
      g.stroke()
    }
  }

  function drawKeyGlyph(g: Ctx, x: number, y: number, s: number): void {
    g.strokeStyle = GOLD
    g.fillStyle = GOLD
    g.lineWidth = Math.max(1.2, s * 0.12)
    g.beginPath()
    g.arc(x, y, s * 0.28, 0, Math.PI * 2)
    g.stroke()
    g.beginPath()
    g.moveTo(x + s * 0.2, y + s * 0.2)
    g.lineTo(x + s * 0.5, y + s * 0.5)
    g.moveTo(x + s * 0.36, y + s * 0.36)
    g.lineTo(x + s * 0.36, y + s * 0.52)
    g.moveTo(x + s * 0.46, y + s * 0.46)
    g.lineTo(x + s * 0.46, y + s * 0.6)
    g.stroke()
  }

  function drawChests(g: Ctx, state: GameState, ox: number, oy: number): void {
    for (const id of state.room.chestsClosed) {
      const c = chestLookup.get(id)
      if (!c) continue
      const p = toPx(c.x, c.y, ox, oy)
      const w = tile * 0.72
      const h = tile * 0.56
      const x0 = p.x + (tile - w) / 2
      const y0 = p.y + (tile - h) / 2 + tile * 0.08
      g.fillStyle = '#2a2008'
      g.fillRect(x0, y0, w, h)
      g.strokeStyle = GOLD
      g.lineWidth = 1.5
      g.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1)
      g.strokeStyle = CYAN
      g.lineWidth = 1.5
      g.beginPath()
      g.moveTo(x0 + 2, y0 + h * 0.3)
      g.lineTo(x0 + w - 2, y0 + h * 0.3)
      g.stroke()
      g.fillStyle = CYAN
      g.fillRect(x0 + w / 2 - 1.5, y0 + h * 0.18, 3, h * 0.3)
    }
  }

  function drawPickups(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    const bob = reducedMotion ? 0 : Math.sin(presentT * 3) * tile * 0.05
    for (const id of state.room.pickupsLeft) {
      const p = pickupLookup.get(id)
      if (!p) continue
      const c = toPx(p.x, p.y, ox, oy)
      const cx = c.x + tile / 2
      const cy = c.y + tile / 2 + bob
      const len = tile * 0.6
      g.strokeStyle = CYAN
      g.lineWidth = 3
      g.beginPath()
      g.moveTo(cx - len / 2, cy + len / 3)
      g.lineTo(cx + len / 2, cy - len / 3)
      g.stroke()
      g.strokeStyle = 'rgba(47,243,255,0.35)'
      g.lineWidth = 6
      g.beginPath()
      g.moveTo(cx - len / 2, cy + len / 3)
      g.lineTo(cx + len / 2, cy - len / 3)
      g.stroke()
      g.fillStyle = GOLD
      g.fillRect(cx - len / 2 - 4, cy + len / 3 - 1.5, 5, 3)
    }
  }

  function drawDrops(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    for (const d of state.room.drops) {
      // Blink in the last 2 s of the 8 s life.
      if (d.t > DROP_LIFE - 2 && !reducedMotion && Math.floor(presentT * 8) % 2 === 1) continue
      const c = toPx(d.x, d.y, ox, oy)
      const cx = c.x + tile / 2
      const cy = c.y + tile / 2
      if (d.kind === 'heart') {
        drawHeart(g, cx, cy, tile * 0.55, PINK)
      } else {
        drawKeyGlyph(g, cx, cy, tile * 0.8)
      }
    }
  }

  function drawWaterSheen(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    const t = reducedMotion ? 0 : presentT
    g.strokeStyle = 'rgba(47,243,255,0.30)'
    g.lineWidth = 1.5
    for (let y = 0; y < state.room.height; y++) {
      const row = state.room.tiles[y]
      if (!row) continue
      for (let x = 0; x < state.room.width; x++) {
        if ((row[x] as TileChar) !== 'W') continue
        const px = rect.x + ox + x * tile
        const py = rect.y + oy + y * tile
        const off = Math.sin(t * 1.6 + (x + y) * 0.9) * tile * 0.12
        g.beginPath()
        g.moveTo(px + tile * 0.15, py + tile * 0.5 + off)
        g.quadraticCurveTo(px + tile * 0.5, py + tile * 0.32 + off, px + tile * 0.85, py + tile * 0.5 + off)
        g.stroke()
      }
    }
  }

  function drawPlayer(g: Ctx, state: GameState, ox: number, oy: number, reducedMotion: boolean): void {
    const pl = state.player
    // Blink at 12 Hz while invulnerable: skip every other 1/12 s.
    if (pl.invuln > 0 && !reducedMotion && Math.floor(presentT * 12) % 2 === 1) return
    const c = toPx(pl.x, pl.y, ox, oy)
    const cx = c.x + tile / 2
    const feetY = c.y + tile * 0.92
    const h = tile * 0.8
    const topY = feetY - h
    let scale = 1
    if (state.phase === 'dying' && state.dying) {
      scale = Math.max(0.2, 1 - state.dying.t * 0.9)
    }
    g.save()
    g.translate(cx, feetY)
    g.scale(scale, scale)
    g.translate(-cx, -feetY)

    const moving = Math.abs(pl.vx) + Math.abs(pl.vy) > 0.15
    const frame = reducedMotion || !moving ? 0 : Math.floor(walkPhase * 8) % 4
    const legSwing = frame === 1 ? 1 : frame === 3 ? -1 : 0
    const s = tile / 16

    // Legs (4-frame walk cycle).
    g.strokeStyle = CYAN
    g.lineWidth = Math.max(1.5, 2 * s)
    g.beginPath()
    g.moveTo(cx - 2.4 * s, feetY - 5 * s)
    g.lineTo(cx - 2.4 * s + legSwing * 2.2 * s, feetY)
    g.moveTo(cx + 2.4 * s, feetY - 5 * s)
    g.lineTo(cx + 2.4 * s - legSwing * 2.2 * s, feetY)
    g.stroke()

    // Torso: low-poly diamond.
    const hipY = feetY - 5 * s
    const shY = topY + 4.5 * s
    g.beginPath()
    g.moveTo(cx, shY)
    g.lineTo(cx + 3.6 * s, (shY + hipY) / 2)
    g.lineTo(cx, hipY)
    g.lineTo(cx - 3.6 * s, (shY + hipY) / 2)
    g.closePath()
    g.fillStyle = pl.facing === 'up' ? '#0e5a63' : '#123a44'
    g.fill()
    g.strokeStyle = CYAN
    g.lineWidth = 1.5
    g.stroke()

    // Head with facing-dependent silhouette.
    const hy = topY + 2.4 * s
    g.beginPath()
    g.arc(cx, hy, 2.8 * s, 0, Math.PI * 2)
    g.fillStyle = '#0e5a63'
    g.fill()
    g.strokeStyle = CYAN
    g.lineWidth = 1.2
    g.stroke()
    g.fillStyle = CYAN
    if (pl.facing === 'down') {
      g.fillRect(cx - 1.8 * s, hy - 0.6 * s, 1.2 * s, 1.6 * s)
      g.fillRect(cx + 0.6 * s, hy - 0.6 * s, 1.2 * s, 1.6 * s)
    } else if (pl.facing === 'left') {
      g.fillRect(cx - 2.4 * s, hy - 0.6 * s, 1.4 * s, 1.6 * s)
    } else if (pl.facing === 'right') {
      g.fillRect(cx + 1.0 * s, hy - 0.6 * s, 1.4 * s, 1.6 * s)
    }
    g.restore()

    // Sword arc sweep.
    if (pl.swing) {
      const p = clamp(pl.swing.t / SWING_TIME, 0, 1)
      const base = facingAngle(pl.swing.facing)
      const a0 = base - SWORD_ARC / 2
      const a1 = a0 + SWORD_ARC * p
      const R = SWORD_REACH * tile
      g.strokeStyle = 'rgba(47,243,255,0.30)'
      g.lineWidth = 8
      g.beginPath()
      g.arc(cx, feetY - h / 2, R, a0, Math.max(a1, a0 + 0.05))
      g.stroke()
      g.strokeStyle = CYAN
      g.lineWidth = 3
      g.beginPath()
      g.arc(cx, feetY - h / 2, R, a0, Math.max(a1, a0 + 0.05))
      g.stroke()
      // Blade at the leading edge.
      const bx = cx + Math.cos(a1) * R
      const by = feetY - h / 2 + Math.sin(a1) * R
      g.strokeStyle = WHITE
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(cx + Math.cos(a1) * R * 0.55, feetY - h / 2 + Math.sin(a1) * R * 0.55)
      g.lineTo(bx, by)
      g.stroke()
    }
  }

  function drawEnemy(g: Ctx, e: Enemy, ox: number, oy: number, reducedMotion: boolean): void {
    const c = toPx(e.x, e.y, ox, oy)
    const cx = c.x + tile / 2
    const cy = c.y + tile / 2
    const r = Math.max(3, e.r * tile)
    const tell = e.brain.tell > 0
    const pulse = reducedMotion ? 0 : Math.sin(presentT * 10) * r * 0.08

    if (tell && (e.kind === 'chaser' || e.kind === 'knight')) {
      // Pulsing pink outline ring = the telegraph.
      g.strokeStyle = PINK
      g.lineWidth = 2
      g.beginPath()
      g.arc(cx, cy, r + tile * 0.16 + pulse, 0, Math.PI * 2)
      g.stroke()
    }
    if (e.kind === 'slimeKnight' && tell) {
      // Unmistakable slam disc: radius 1.6 tiles, pink at 35 % alpha, pulsing.
      const a = reducedMotion ? 0.35 : 0.28 + 0.12 * Math.sin(presentT * 8)
      g.fillStyle = `rgba(255,47,160,${a.toFixed(3)})`
      g.beginPath()
      g.arc(cx, cy, tile * 1.6, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = PINK
      g.lineWidth = 2
      g.stroke()
    }

    switch (e.kind) {
      case 'chaser': {
        g.beginPath()
        g.moveTo(cx, cy - r)
        g.lineTo(cx + r * 0.9, cy + r * 0.7)
        g.lineTo(cx - r * 0.9, cy + r * 0.7)
        g.closePath()
        g.fillStyle = '#3d0a26'
        g.fill()
        g.strokeStyle = PINK
        g.lineWidth = 1.5
        g.stroke()
        g.fillStyle = WHITE
        g.fillRect(cx - r * 0.4, cy - r * 0.15, r * 0.28, r * 0.28)
        g.fillRect(cx + r * 0.12, cy - r * 0.15, r * 0.28, r * 0.28)
        break
      }
      case 'wanderer': {
        g.beginPath()
        g.arc(cx, cy, r * 0.9, 0, Math.PI * 2)
        g.fillStyle = '#3d0a26'
        g.fill()
        g.strokeStyle = PINK
        g.lineWidth = 1.5
        g.stroke()
        g.fillStyle = PINK
        g.beginPath()
        g.arc(cx - r * 0.25, cy - r * 0.1, r * 0.14, 0, Math.PI * 2)
        g.arc(cx + r * 0.25, cy - r * 0.1, r * 0.14, 0, Math.PI * 2)
        g.fill()
        break
      }
      case 'turret': {
        const s2 = r * 1.1
        g.fillStyle = '#3d0a26'
        g.fillRect(cx - s2 / 2, cy - s2 / 2, s2, s2)
        g.strokeStyle = PINK
        g.lineWidth = 1.5
        g.strokeRect(cx - s2 / 2, cy - s2 / 2, s2, s2)
        const a = facingAngle(e.facing)
        const bx = cx + Math.cos(a) * s2 * 0.5
        const by = cy + Math.sin(a) * s2 * 0.5
        g.strokeStyle = tell ? WHITE : PINK
        g.lineWidth = tell ? 4 : 3
        g.beginPath()
        g.moveTo(cx, cy)
        g.lineTo(bx + Math.cos(a) * s2 * 0.4, by + Math.sin(a) * s2 * 0.4)
        g.stroke()
        if (tell) {
          // Barrel glow.
          g.fillStyle = 'rgba(255,47,160,0.5)'
          g.beginPath()
          g.arc(bx, by, s2 * 0.3 + pulse, 0, Math.PI * 2)
          g.fill()
        }
        break
      }
      case 'bat': {
        const flap = reducedMotion ? 0.4 : Math.sin(presentT * 10) * 0.5 + 0.5
        const wingY = cy - r * (0.2 + flap * 0.6)
        g.beginPath()
        g.moveTo(cx - r * 1.2, wingY)
        g.lineTo(cx - r * 0.3, cy)
        g.lineTo(cx, cy - r * 0.3)
        g.lineTo(cx + r * 0.3, cy)
        g.lineTo(cx + r * 1.2, wingY)
        g.closePath()
        g.fillStyle = '#3d0a26'
        g.fill()
        g.strokeStyle = PINK
        g.lineWidth = 1.5
        g.stroke()
        g.fillStyle = PINK
        g.beginPath()
        g.arc(cx, cy, r * 0.3, 0, Math.PI * 2)
        g.fill()
        break
      }
      case 'knight': {
        g.beginPath()
        g.moveTo(cx, cy - r)
        g.lineTo(cx + r * 0.75, cy)
        g.lineTo(cx + r * 0.5, cy + r)
        g.lineTo(cx - r * 0.5, cy + r)
        g.lineTo(cx - r * 0.75, cy)
        g.closePath()
        g.fillStyle = '#3d0a26'
        g.fill()
        g.strokeStyle = PINK
        g.lineWidth = 2
        g.stroke()
        // GOLD frontal shield plate on the facing side.
        const a = facingAngle(e.facing)
        const sx = cx + Math.cos(a) * r * 0.85
        const sy = cy + Math.sin(a) * r * 0.85
        g.save()
        g.translate(sx, sy)
        g.rotate(a)
        g.fillStyle = GOLD
        g.fillRect(-r * 0.12, -r * 0.55, r * 0.3, r * 1.1)
        g.strokeStyle = '#7a5c00'
        g.lineWidth = 1
        g.strokeRect(-r * 0.12, -r * 0.55, r * 0.3, r * 1.1)
        g.restore()
        g.fillStyle = WHITE
        g.fillRect(cx - r * 0.3, cy - r * 0.5, r * 0.2, r * 0.2)
        g.fillRect(cx + r * 0.1, cy - r * 0.5, r * 0.2, r * 0.2)
        break
      }
      case 'slimeKnight': {
        // Big gold body, pink hostile face, pink crown spikes.
        g.beginPath()
        g.arc(cx, cy, r, 0, Math.PI * 2)
        g.fillStyle = '#3a2c05'
        g.fill()
        g.strokeStyle = GOLD
        g.lineWidth = 2.5
        g.stroke()
        const spikes = 7
        g.fillStyle = PINK
        for (let i = 0; i < spikes; i++) {
          const a = (i / spikes) * Math.PI * 2 - Math.PI / 2
          const sx = cx + Math.cos(a) * r
          const sy = cy + Math.sin(a) * r
          g.beginPath()
          g.moveTo(sx + Math.cos(a) * r * 0.35, sy + Math.sin(a) * r * 0.35)
          g.lineTo(sx + Math.cos(a + 0.22) * r * 0.18, sy + Math.sin(a + 0.22) * r * 0.18)
          g.lineTo(sx + Math.cos(a - 0.22) * r * 0.18, sy + Math.sin(a - 0.22) * r * 0.18)
          g.closePath()
          g.fill()
        }
        // Hostile face: angled eyes + jagged mouth.
        g.strokeStyle = PINK
        g.lineWidth = 2
        g.beginPath()
        g.moveTo(cx - r * 0.5, cy - r * 0.25)
        g.lineTo(cx - r * 0.1, cy - r * 0.05)
        g.moveTo(cx + r * 0.5, cy - r * 0.25)
        g.lineTo(cx + r * 0.1, cy - r * 0.05)
        g.moveTo(cx - r * 0.4, cy + r * 0.4)
        g.lineTo(cx - r * 0.2, cy + r * 0.25)
        g.lineTo(cx, cy + r * 0.4)
        g.lineTo(cx + r * 0.2, cy + r * 0.25)
        g.lineTo(cx + r * 0.4, cy + r * 0.4)
        g.stroke()
        break
      }
    }

    // Hit flash: white overlay while invulnerable.
    if (e.invuln > 0) {
      g.fillStyle = 'rgba(255,255,255,0.7)'
      g.beginPath()
      g.arc(cx, cy, r, 0, Math.PI * 2)
      g.fill()
    }
  }

  function drawProjectiles(g: Ctx, state: GameState, ox: number, oy: number): void {
    for (const pr of state.room.projectiles) {
      const c = toPx(pr.x, pr.y, ox, oy)
      const cx = c.x + tile / 2
      const cy = c.y + tile / 2
      // Short trail.
      g.strokeStyle = 'rgba(255,47,160,0.5)'
      g.lineWidth = 2
      g.beginPath()
      g.moveTo(cx - pr.vx * tile * 0.05, cy - pr.vy * tile * 0.05)
      g.lineTo(cx, cy)
      g.stroke()
      g.fillStyle = PINK
      g.beginPath()
      g.arc(cx, cy, Math.max(2, pr.r * tile), 0, Math.PI * 2)
      g.fill()
    }
  }

  function drawFx(g: Ctx, ox: number, oy: number): void {
    for (const p of particles) {
      if (!p.alive) continue
      const a = clamp(p.life / p.maxLife, 0, 1)
      g.globalAlpha = a
      g.fillStyle = p.color
      const px = rect.x + ox + p.x * tile
      const py = rect.y + oy + p.y * tile
      if (p.tri) {
        g.beginPath()
        g.moveTo(px, py - p.size)
        g.lineTo(px + p.size, py + p.size)
        g.lineTo(px - p.size, py + p.size)
        g.closePath()
        g.fill()
      } else {
        g.fillRect(px - p.size / 2, py - p.size / 2, p.size, p.size)
      }
    }
    g.globalAlpha = 1
    for (const r of rings) {
      if (!r.alive) continue
      const p = clamp(r.t / r.dur, 0, 1)
      const rad = (r.r0 + (r.r1 - r.r0) * p) * tile
      g.globalAlpha = 1 - p
      g.strokeStyle = r.color
      g.lineWidth = 2.5
      g.beginPath()
      g.arc(rect.x + ox + r.x * tile, rect.y + oy + r.y * tile, rad, 0, Math.PI * 2)
      g.stroke()
    }
    g.globalAlpha = 1
  }

  // -- HUD / overlays -----------------------------------------------------------

  function drawHud(g: Ctx, state: GameState): void {
    const hudH = Math.max(HUD_MIN, Math.min(44, Math.floor(cssH * 0.06)))
    const midY = hudH / 2
    // Hearts: 5 slots, filled pink up to hp, outline up to maxHp, hidden beyond.
    const maxShow = Math.min(5, state.player.maxHp)
    const s = 13
    for (let i = 0; i < maxShow; i++) {
      drawHeart(g, 16 + i * (s + 5), midY, s, i < state.player.hp ? PINK : null)
    }
    // Keys: gold glyph × count (always shown, stable layout) + BOSS KEY sigil.
    let kx = 16 + maxShow * (s + 5) + 8
    drawKeyGlyph(g, kx + 6, midY, 14)
    g.fillStyle = GOLD
    g.font = `12px ${MACHINE_FONT}`
    g.textAlign = 'left'
    g.textBaseline = 'middle'
    g.fillText(`×${state.player.smallKeys}`, kx + 15, midY + 0.5)
    kx += 15 + 26
    if (state.player.hasBossKey) {
      g.save()
      g.translate(kx + 6, midY)
      g.rotate(Math.PI / 4)
      g.fillStyle = GOLD
      g.fillRect(-5, -5, 10, 10)
      g.restore()
      if (cssW > 360) {
        g.fillStyle = GOLD
        g.font = `10px ${MACHINE_FONT}`
        g.textAlign = 'left'
        g.textBaseline = 'middle'
        g.fillText('BOSS KEY', kx + 15, midY + 0.5)
      }
    }
    // Room name, right-aligned, cyan at 70 %.
    const name = roomName.get(state.room.id) ?? state.room.id
    g.fillStyle = 'rgba(47,243,255,0.7)'
    g.font = `${cssW < 400 ? 12 : 13}px ${MACHINE_FONT}`
    g.textAlign = 'right'
    g.textBaseline = 'middle'
    g.fillText(name, cssW - 10, midY)
    g.textAlign = 'left'
  }

  function drawBanner(g: Ctx, ui: FrameUI): void {
    if (!ui.banner || ui.banner.t <= 0) return
    const a = clamp(ui.banner.t, 0, 1)
    g.globalAlpha = a
    g.fillStyle = CYAN
    const size = clamp(Math.round(cssW * 0.055), 18, 28)
    g.font = `${size}px ${MACHINE_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(ui.banner.text, cssW / 2, rect.y + rect.h * 0.32)
    g.globalAlpha = 1
    g.textAlign = 'left'
  }

  function drawHint(g: Ctx, ui: FrameUI): void {
    if (!ui.hint) return
    const y = rect.y + rect.h + 20
    if (y > cssH - 6) return
    g.fillStyle = 'rgba(47,243,255,0.7)'
    g.font = `11px ${MACHINE_FONT}`
    g.textAlign = 'center'
    g.textBaseline = 'middle'
    g.fillText(ui.hint, cssW / 2, y)
    g.textAlign = 'left'
  }

  function drawStick(g: Ctx, ui: FrameUI): void {
    if (!ui.stick) return
    const { originX, originY, dx, dy } = ui.stick
    g.strokeStyle = 'rgba(47,243,255,0.35)'
    g.lineWidth = 1.5
    g.beginPath()
    g.arc(originX, originY, 40, 0, Math.PI * 2)
    g.stroke()
    const len = Math.hypot(dx, dy)
    const cl = len > 40 && len > 0 ? 40 / len : 1
    g.fillStyle = 'rgba(47,243,255,0.8)'
    g.beginPath()
    g.arc(originX + dx * cl, originY + dy * cl, 9, 0, Math.PI * 2)
    g.fill()
  }

  // -- main draw ------------------------------------------------------------------

  function draw(state: GameState, ui: FrameUI, dt: number): void {
    const step = clamp(dt, 0, 0.1)
    presentT += step
    const speed = Math.abs(state.player.vx) + Math.abs(state.player.vy)
    if (!ui.reducedMotion && speed > 0.15) {
      walkPhase += step * (3 + speed * 1.6)
    }
    updateFx(step, ui.reducedMotion)

    computeLayout(state.room.width, state.room.height)
    lastFx = state.player.x
    lastFy = state.player.y

    gSaveReset()
    // Background.
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, cssW, cssH)

    // Screen shake (±4 px decaying), skipped under reduced motion.
    let shx = 0
    let shy = 0
    if (!ui.reducedMotion && state.shake > 0) {
      const m = Math.min(1, state.shake) * 4
      shx = (Math.random() * 2 - 1) * m
      shy = (Math.random() * 2 - 1) * m
    }

    const sliding = state.phase === 'slide' && state.slide && !ui.reducedMotion && slideFrom && tileCache
    if (sliding && state.slide) {
      drawSlide(state, ui, shx, shy)
    } else {
      ensureTileCache(state)
      ctx.save()
      ctx.beginPath()
      ctx.rect(rect.x, rect.y, rect.w + 0.5, rect.h + 0.5)
      ctx.clip()
      if (tileCache) {
        try {
          ctx.drawImage(tileCache, rect.x + shx, rect.y + shy, rect.w, rect.h)
        } catch {
          paintStaticLayerAt(ctx, state, rect.x + shx, rect.y + shy)
        }
      } else {
        paintStaticLayerAt(ctx, state, rect.x + shx, rect.y + shy)
      }
      drawRoomDynamics(state, ui, shx, shy)
      ctx.restore()
    }

    // Dying: darken the room to 70 %.
    if (state.phase === 'dying') {
      ctx.fillStyle = 'rgba(11,6,22,0.3)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }
    // Paused: the shell's EscHold pill draws 'PAUSED'; only dim to 60 %.
    if (ui.paused) {
      ctx.fillStyle = 'rgba(11,6,22,0.4)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }
    // playerHit flash overlay (80 ms).
    if (flashT > 0 && !ui.reducedMotion) {
      ctx.fillStyle = 'rgba(255,47,160,0.25)'
      ctx.fillRect(rect.x, rect.y, rect.w, rect.h)
    }

    drawHud(ctx, state)
    drawBanner(ctx, ui)
    drawHint(ctx, ui)
    drawStick(ctx, ui)
  }

  function gSaveReset(): void {
    try {
      ctx.setTransform(dprEff, 0, 0, dprEff, 0, 0)
    } catch {
      // stub absorbs
    }
  }

  function paintStaticLayerAt(g: Ctx, state: GameState, ox: number, oy: number): void {
    const r = state.room
    for (let y = 0; y < r.height; y++) {
      const row = r.tiles[y]
      if (!row) continue
      for (let x = 0; x < r.width; x++) {
        // paintTile draws at tile-grid origin; offset via save/translate.
        paintTileAt(g, (row[x] as TileChar) ?? '.', ox + x * tile, oy + y * tile)
      }
    }
  }

  // paintTile draws relative to an absolute origin (no extra translate).
  function paintTileAt(g: Ctx, t: TileChar, px: number, py: number): void {
    paintTile(g, t, px, py)
  }

  function drawRoomDynamics(state: GameState, ui: FrameUI, shx: number, shy: number): void {
    drawWaterSheen(ctx, state, shx, shy, ui.reducedMotion)
    drawChests(ctx, state, shx, shy)
    drawPickups(ctx, state, shx, shy, ui.reducedMotion)
    drawDrops(ctx, state, shx, shy, ui.reducedMotion)
    for (const e of state.room.enemies) {
      drawEnemy(ctx, e, shx, shy, ui.reducedMotion)
    }
    drawProjectiles(ctx, state, shx, shy)
    drawPlayer(ctx, state, shx, shy, ui.reducedMotion)
    if (!ui.reducedMotion) drawFx(ctx, shx, shy)
  }

  function drawSlide(state: GameState, _ui: FrameUI, shx: number, shy: number): void {
    const slide = state.slide
    if (!slide || !slideFrom || !tileCache) return
    const p = clamp(slide.t / SLIDE_TIME, 0, 1)
    let fx = 0
    let fy = 0
    let tx = 0
    let ty = 0
    if (slide.dir === 'right') {
      fx = -p * rect.w
      tx = (1 - p) * rect.w
    } else if (slide.dir === 'left') {
      fx = p * rect.w
      tx = -(1 - p) * rect.w
    } else if (slide.dir === 'down') {
      fy = -p * rect.h
      ty = (1 - p) * rect.h
    } else {
      fy = p * rect.h
      ty = -(1 - p) * rect.h
    }
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w + 0.5, rect.h + 0.5)
    ctx.clip()
    // From-room: the cached previous frame.
    try {
      ctx.drawImage(slideFrom, rect.x + shx + fx, rect.y + shy + fy, rect.w, rect.h)
    } catch {
      // stub: ignore
    }
    // To-room: the current tile layer.
    try {
      ctx.drawImage(tileCache, rect.x + shx + tx, rect.y + shy + ty, rect.w, rect.h)
    } catch {
      paintStaticLayerAt(ctx, state, rect.x + shx + tx, rect.y + shy + ty)
    }
    // Entities ride with the new room.
    drawWaterSheen(ctx, state, shx + tx, shy + ty, true)
    drawChests(ctx, state, shx + tx, shy + ty)
    drawPickups(ctx, state, shx + tx, shy + ty, true)
    drawDrops(ctx, state, shx + tx, shy + ty, true)
    for (const e of state.room.enemies) {
      drawEnemy(ctx, e, shx + tx, shy + ty, true)
    }
    drawProjectiles(ctx, state, shx + tx, shy + ty)
    drawPlayer(ctx, state, shx + tx, shy + ty, true)
    ctx.restore()
  }

  return { resize, draw, onEvents, roomRect }
}
