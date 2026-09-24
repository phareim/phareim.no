/**
 * The Wildwood's pieces of the renderer: set dressing (MapDef.props — tents,
 * the campfire, the radio mast, the van, Luna's fort, the wall of Christmas
 * lights that spells a word, the Gate, the lift), Luna following the hero,
 * the grappling hook's chain, the Other Side's mood (a red-violet cast and
 * drifting ash) and the Wildwood's fireflies. Read-only on the game state.
 */
import type { Dir, GameState, Prop, World } from '../types'
import { TILE } from '../types'
import { condMet, mapInfo } from '../engine/index'
import { drawText } from './font'
import { sprite, spriteT } from './sheet'
import { hash2, type Light } from './tiles'

type G = CanvasRenderingContext2D
const T = TILE

export interface Item { y: number; draw: () => void }

function put(g: G, name: string, x: number, y: number, flip = false) {
  const c = sprite(name, flip)
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height))
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

const BULBS = ['#ff3b5c', '#ffd23f', '#b6ff4a', '#2ff3ff', '#ff2fa0']

/**
 * Queue the map's props for the depth sort (or draw the flat ones now).
 * Anchors are in tiles: a prop stands with its bottom centre at (x, y).
 */
export function queueProps(
  g: G, world: World, s: GameState, cx: number, cy: number, vw: number, vh: number,
  time: number, reduced: boolean, items: Item[], lights: Light[],
): void {
  const def = mapInfo(world, s.map.id).def
  const props = def.props
  if (!props) return
  const tm = reduced ? 0 : time
  for (const p of props) {
    if (p.when && !condMet(s, world, p.when, -1)) continue
    const x = p.x * T - cx
    const y = p.y * T - cy
    if (x < -80 || x > vw + 80 || y < -80 || y > vh + 120) continue
    switch (p.kind) {
      case 'tent': items.push({ y: p.y, draw: () => put(g, 'prop_tent', x, y + 2) }); break
      case 'bike': items.push({ y: p.y, draw: () => put(g, 'prop_bike', x, y) }); break
      case 'van': items.push({ y: p.y, draw: () => put(g, 'prop_van', x, y) }); break
      case 'fort':
        items.push({ y: p.y, draw: () => put(g, 'prop_fort', x, y) })
        lights.push({ x: p.x, y: p.y - 1, r: 2.4, color: '#ffd23f', a: 0.45 + 0.1 * Math.sin(tm * 2) })
        break
      case 'campfire': {
        const f = Math.floor(tm * 8) % 3
        items.push({ y: p.y, draw: () => put(g, `prop_campfire_${f}`, x, y) })
        lights.push({ x: p.x, y: p.y - 0.4, r: 5.5, color: '#ff8a3d', a: 0.85 + 0.15 * Math.sin(tm * 13) })
        break
      }
      case 'mast': {
        const on = Math.floor(tm * 1.5) % 2 === 0
        items.push({ y: p.y, draw: () => put(g, on ? 'prop_mast_on' : 'prop_mast', x, y) })
        if (on) lights.push({ x: p.x, y: p.y - 3.4, r: 1.6, color: '#ff3b5c', a: 1 })
        break
      }
      case 'tank': {
        const f = Math.floor(tm * 3 + p.x) % 2
        items.push({ y: p.y, draw: () => put(g, `prop_tank_${f}`, x, y) })
        lights.push({ x: p.x, y: p.y - 0.8, r: 2, color: '#3fd8b0', a: 0.6 })
        break
      }
      case 'lights': drawLightsWall(g, p, x, y, tm, lights); break
      case 'rift': drawRift(g, p, x, y, tm, lights); break
      case 'lift': {
        g.fillStyle = '#0b0616'
        g.fillRect(Math.round(x - 8), Math.round(y - 8), 16, 16)
        g.fillStyle = '#2ff3ff'
        for (let i = 0; i < 3; i++) g.fillRect(Math.round(x - 6), Math.round(y - 6 + i * 5 - (Math.floor(tm * 6) % 5)), 12, 1)
        lights.push({ x: p.x, y: p.y, r: 2.2, color: '#2ff3ff', a: 0.8 })
        break
      }
    }
  }
}

/**
 * The wall of Christmas lights: the alphabet painted on the wall, a bulb over
 * each letter on a sagging wire, and the letters of `text` lighting up one
 * at a time, over and over.
 */
function drawLightsWall(g: G, p: Prop, x0: number, y0: number, tm: number, lights: Light[]) {
  const word = p.text ?? ''
  const left = p.x * T
  const per = ((p.w ?? 13) * T) / 26
  // One letter every 0.8 s, then a pause as long as two letters.
  const cycle = word.length + 2
  const step = Math.floor(tm / 0.8) % cycle
  const lit = step < word.length ? word[step]! : ''
  const glowOn = (tm % 0.8) < 0.6
  const baseX = x0 - (p.x * T - left)
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i)
    const lx = Math.round(baseX + i * per + (per - 5) / 2)
    const sag = Math.round(Math.sin((i / 25) * Math.PI) * 2 + Math.sin(i * 1.7) * 0.6)
    const by = Math.round(y0 + 2 + sag)
    // Wire
    g.fillStyle = '#12081e'
    g.fillRect(Math.round(baseX + i * per), by - 1, Math.ceil(per), 1)
    const on = ch === lit && glowOn
    const col = BULBS[i % BULBS.length]!
    g.fillStyle = on ? '#ffffff' : col
    g.globalAlpha = on ? 1 : 0.55
    g.fillRect(lx + 1, by, 3, 3)
    g.globalAlpha = 1
    drawText(g, ch, lx, Math.round(y0 + 6), on ? '#ffffff' : '#8a7cb8', '#0b0616')
    const wx = (lx + 2) / T + (p.x - x0 / T)
    const wy = (by + 1) / T + (p.y - y0 / T)
    lights.push(on ? { x: wx, y: wy + 0.2, r: 3.2, color: col, a: 1 } : { x: wx, y: wy, r: 0.8, color: col, a: 0.4 })
  }
}

/** The Gate: a tear in the wall, flesh-red at the edges, static inside, breathing. */
function drawRift(g: G, p: Prop, x0: number, y0: number, tm: number, lights: Light[]) {
  const w = (p.w ?? 6) * T
  const h = (p.h ?? 2.5) * T
  const cx = x0 + w / 2
  const cy = y0 + h / 2
  const breathe = 1 + Math.sin(tm * 1.7) * 0.06
  for (let yy = -h / 2; yy < h / 2; yy++) {
    const f = 1 - (2 * yy / h) ** 2
    if (f <= 0) continue
    const half = Math.sqrt(f) * (w / 2) * breathe
    const y = Math.round(cy + yy)
    g.fillStyle = '#3a0820'
    g.fillRect(Math.round(cx - half - 2), y, Math.round(half * 2 + 4), 1)
    g.fillStyle = '#8a1440'
    g.fillRect(Math.round(cx - half), y, Math.round(half * 2), 1)
    const inner = half * 0.72
    for (let xx = -inner; xx < inner; xx += 2) {
      const n = hash2(Math.round(xx + cx), y, Math.floor(tm * 12))
      g.fillStyle = n < 0.33 ? '#cfc6ff' : n < 0.66 ? '#5a5285' : '#0b0616'
      g.fillRect(Math.round(cx + xx), y, 2, 1)
    }
  }
  lights.push({ x: p.x + (p.w ?? 6) / 2, y: p.y + (p.h ?? 2.5) / 2, r: 6, color: '#ff3b5c', a: 0.8 + 0.2 * Math.sin(tm * 1.7) })
}

// ---------------------------------------------------------------------------
// Luna
// ---------------------------------------------------------------------------

function dirKey(d: Dir): { key: string; flip: boolean } {
  if (d === 'left') return { key: 'side', flip: true }
  if (d === 'right') return { key: 'side', flip: false }
  return { key: d, flip: false }
}

export function queueLuna(g: G, s: GameState, cx: number, cy: number, items: Item[], lights: Light[]) {
  const L = s.luna
  if (!L || s.hero.x < -10) return
  items.push({
    y: L.y - 0.01,
    draw: () => {
      const x = L.x * T - cx
      const feet = L.y * T - cy + 6
      g.fillStyle = 'rgba(8,4,20,0.42)'
      g.fillRect(Math.round(x - 4), Math.round(feet - 1), 8, 2)
      if (L.psi > 0) { put(g, 'luna_psi', x, feet); return }
      const { key, flip } = dirKey(L.dir)
      const walking = L.walkT > 0
      const f = walking ? [1, 0, 2, 0][Math.floor(L.walkT * 7) % 4]! : 0
      put(g, `luna_${key}_${f}`, x, feet, flip)
    },
  })
  if (L.psi > 0) lights.push({ x: L.x, y: L.y - 0.6, r: 2.2, color: '#ff8ae0', a: 0.9 })
}

// ---------------------------------------------------------------------------
// The hook's chain
// ---------------------------------------------------------------------------

export function drawHookChain(g: G, s: GameState, cx: number, cy: number, lights: Light[]) {
  const k = s.hook
  if (!k) return
  const h = s.hero
  const hx = h.x * T - cx + k.dx * 4
  const hy = h.y * T - cy - 4 + k.dy * 4
  const tx = k.x * T - cx
  const ty = k.y * T - cy - 4
  const len = Math.hypot(tx - hx, ty - hy)
  const n = Math.floor(len / 4)
  const link = sprite('hook_link')
  for (let i = 1; i < n; i++) {
    const t = i / n
    g.drawImage(link, Math.round(hx + (tx - hx) * t - 1), Math.round(hy + (ty - hy) * t - 1))
  }
  const vert = k.dy !== 0
  const head = spriteT(vert ? 'hook_head_v' : 'hook_head_h', !vert && k.dx < 0, vert && k.dy > 0)
  g.drawImage(head, Math.round(tx - head.width / 2), Math.round(ty - head.height / 2))
  lights.push({ x: k.x, y: k.y, r: 1.2, color: '#cfc6ff', a: 0.7 })
}

// ---------------------------------------------------------------------------
// Moods
// ---------------------------------------------------------------------------

/** The Other Side leaking in: a red-violet cast and ash drifting up. Drawn after the light. */
export function drawStaticMood(g: G, vw: number, vh: number, cx: number, cy: number, time: number, reduced: boolean) {
  g.globalCompositeOperation = 'multiply'
  g.fillStyle = '#d88ab8'
  g.fillRect(0, 0, vw, vh)
  g.globalCompositeOperation = 'source-over'
  if (reduced) return
  g.fillStyle = 'rgba(207,198,255,0.55)'
  for (let i = 0; i < 40; i++) {
    const sx = hash2(i, 1, 9) * 400
    const sy = hash2(i, 2, 9) * 400
    const x = ((sx - cx * 0.4 + Math.sin(time * 0.6 + i) * 8) % vw + vw) % vw
    const y = ((sy - cy * 0.4 - time * (6 + (i % 5) * 2)) % vh + vh) % vh
    g.fillRect(Math.round(x), Math.round(y), i % 3 ? 1 : 2, 1)
  }
}

/** Fireflies over the Wildwood at night: small lights that wander. */
export function fireflies(cx: number, cy: number, vw: number, vh: number, time: number, lights: Light[], g: G) {
  const n = 18
  for (let i = 0; i < n; i++) {
    const bx = (hash2(i, 3, 17) * (vw + 64)) + cx - 32
    const by = (hash2(i, 4, 17) * (vh + 64)) + cy - 32
    const x = bx + Math.sin(time * 0.7 + i * 1.3) * 14
    const y = by + Math.cos(time * 0.5 + i * 2.1) * 10
    const a = 0.5 + 0.5 * Math.sin(time * 2.3 + i * 4.1)
    if (a < 0.15) continue
    g.globalAlpha = a
    g.fillStyle = '#e8ff8a'
    g.fillRect(Math.round(x - cx), Math.round(y - cy), 1, 1)
    g.globalAlpha = 1
    lights.push({ x: x / T, y: y / T, r: 0.6, color: '#b6ff4a', a: a * 0.7 })
  }
}
