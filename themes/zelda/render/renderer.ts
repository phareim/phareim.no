/**
 * Neon Shrine renderer. The world is drawn at logical resolution (1 px =
 * 1/16 tile) into an offscreen buffer, lit with a multiply light map, then
 * scaled by a whole number onto the screen canvas. Neon bloom is added at
 * screen resolution on top, then the HUD layer (also logical pixels).
 *
 * The view size follows the screen: at least 13×11 tiles, more on big or
 * tall screens, so portrait phones see a tall slice of the world instead of
 * a letterboxed box. Read-only on the game state.
 */
import type { Dir, Enemy, GameEvent, GameState, World } from '../types'
import { BOMB_FUSE, SPIN_TIME, SWING_TIME, TILE, WARP_TIME } from '../types'
import { cameraFor, cellDef, cellIndex, mapInfo, shardPos, swingAngle } from '../engine/index'
import { drawText, textWidth } from './font'
import { drawBanner, drawDialog, drawHud, drawPause, type HudKeys } from './hud'
import { makeCanvas, silhouette, sprite, spriteT } from './sheet'
import { createTileLayer, drawBlock, drawLiveTiles, hash2, updateTileLayer, type Light, type TileLayer } from './tiles'

type G = CanvasRenderingContext2D
const T = TILE

export interface FrameUI {
  paused: boolean
  reducedMotion: boolean
  touch: boolean
  /** Touch stick in CSS px relative to the canvas. */
  stick: { ox: number; oy: number; dx: number; dy: number } | null
  /** Attract mode: no hero, no HUD, camera from `cam` (tiles, top-left). */
  attract: boolean
  cam: { x: number; y: number } | null
  banner: { text: string; t: number } | null
  keys: HudKeys
}

interface Fx { kind: 'sprite' | 'spark' | 'leaf' | 'ring' | 'bit' | 'text'; x: number; y: number; vx: number; vy: number; t: number; life: number; name?: string; frames?: number; color: string; size: number; text?: string }

const AMBIENT = { overworld: '#8e82c4', dungeon: '#7d6fb4', interior: '#c8b4dc', dark: '#1d1433', caveDark: '#2a1e44' }

export interface Renderer {
  resize(cssW: number, cssH: number, dpr: number, bottomCss: number): void
  draw(s: GameState, ui: FrameUI, dt: number): void
  onEvents(ev: GameEvent[]): void
  /** View size in tiles (for the attract camera). */
  viewTiles(): { w: number; h: number }
}

export function createRenderer(canvas: HTMLCanvasElement, world: World): Renderer {
  const screen = canvas.getContext('2d')!
  let scene = makeCanvas(1, 1)
  let sg = scene.getContext('2d')!
  let light = makeCanvas(1, 1)
  let lg = light.getContext('2d')!
  let hud = makeCanvas(1, 1)
  let hg = hud.getContext('2d')!
  let bloom = makeCanvas(1, 1)
  let bg = bloom.getContext('2d')!
  let W = 1
  let H = 1
  let gameH = 1
  let scale = 1
  let vw = 1
  let vh = 1
  let dpr = 1
  let layer: TileLayer | null = null
  let time = 0
  let fx: Fx[] = []
  let flashT = 0
  let flashColor = '#ffffff'
  const glowCache = new Map<string, HTMLCanvasElement>()
  let scan: CanvasPattern | null = null

  function glow(color: string): HTMLCanvasElement {
    let c = glowCache.get(color)
    if (c) return c
    c = makeCanvas(64, 64)
    const g = c.getContext('2d')!
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, color)
    grad.addColorStop(0.35, color + 'aa')
    grad.addColorStop(1, color + '00')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
    glowCache.set(color, c)
    return c
  }

  function resize(cssW: number, cssH: number, ratio: number, bottomCss: number) {
    dpr = Math.max(1, Math.min(3, ratio || 1))
    W = Math.max(1, Math.round(cssW * dpr))
    H = Math.max(1, Math.round(cssH * dpr))
    gameH = Math.max(1, Math.round((cssH - bottomCss) * dpr))
    canvas.width = W
    canvas.height = H
    // Whole-number scale showing at least 13×11 tiles (and at most ~28 wide).
    scale = Math.max(1, Math.floor(Math.min(W / (13 * T), gameH / (11 * T))))
    while (W / scale > 30 * T) scale++
    vw = Math.ceil(W / scale)
    vh = Math.ceil(gameH / scale)
    scene = makeCanvas(vw, vh)
    sg = scene.getContext('2d')!
    light = makeCanvas(vw, vh)
    lg = light.getContext('2d')!
    hud = makeCanvas(vw, vh)
    hg = hud.getContext('2d')!
    bloom = makeCanvas(vw, vh)
    bg = bloom.getContext('2d')!
    for (const g of [sg, lg, hg, screen]) g.imageSmoothingEnabled = false
    // Scanline pattern at screen resolution.
    const p = makeCanvas(1, Math.max(2, scale))
    const pg = p.getContext('2d')!
    pg.fillStyle = 'rgba(0,0,0,0.13)'
    pg.fillRect(0, 0, 1, Math.max(1, Math.floor(scale / 3)))
    scan = screen.createPattern(p, 'repeat')
  }

  function viewTiles() {
    return { w: vw / T, h: vh / T }
  }

  // ---------------------------------------------------------------------------
  // Events → effects
  // ---------------------------------------------------------------------------

  function spark(x: number, y: number, n: number, color: string, speed = 5, life = 0.35) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2
      const v = speed * (0.4 + Math.random() * 0.8)
      fx.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: life * (0.6 + Math.random() * 0.6), color, size: 1 })
    }
  }

  function onEvents(ev: GameEvent[]) {
    for (const e of ev) {
      switch (e.type) {
        case 'hit':
          spark(e.x, e.y, e.killed ? 10 : 6, e.kind === 'king' ? '#ff2fa0' : '#fff4ff', 6)
          break
        case 'kill':
          fx.push({ kind: 'sprite', name: 'poof', frames: 4, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.36, color: '', size: 1 })
          spark(e.x, e.y, 8, '#ff2fa0', 4, 0.5)
          if (e.kind === 'king' || e.kind === 'knight') {
            for (let i = 0; i < 6; i++) fx.push({ kind: 'sprite', name: 'boom', frames: 4, x: e.x + (Math.random() - 0.5) * 2.5, y: e.y + (Math.random() - 0.5) * 2, vx: 0, vy: 0, t: -i * 0.18, life: 0.5, color: '', size: 1 })
            flashT = 0.5
            flashColor = '#ffffff'
          }
          break
        case 'clank': spark(e.x, e.y, 5, '#ffd23f', 5, 0.25); break
        case 'cut':
          for (let i = 0; i < 6; i++) fx.push({ kind: 'leaf', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 5, vy: -Math.random() * 4, t: 0, life: 0.5 + Math.random() * 0.3, color: e.tile === '*' ? '#46b595' : '#56c9b8', size: 1 })
          break
        case 'shatter':
          for (let i = 0; i < 7; i++) fx.push({ kind: 'leaf', x: e.x, y: e.y, vx: (Math.random() - 0.5) * 6, vy: -Math.random() * 4, t: 0, life: 0.45, color: e.kind === 'pot' ? '#e07a4e' : '#8f86b8', size: 2 })
          break
        case 'boom':
          fx.push({ kind: 'sprite', name: 'boom', frames: 4, x: e.x, y: e.y, vx: 0, vy: 0, t: 0, life: 0.5, color: '', size: 1 })
          spark(e.x, e.y, 12, '#ff8a3d', 7, 0.45)
          break
        case 'hurt': flashT = 0.12; flashColor = '#ff3b5c'; break
        case 'shock': flashT = 0.16; flashColor = '#b6ff4a'; spark(e.x, e.y, 10, '#b6ff4a', 7); break
        case 'chest': spark(e.x, e.y - 0.3, 14, '#ffd23f', 4, 0.6); break
        case 'itemGet': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.6, color: '#ffd23f', size: 1, name: 'hero' }); break
        case 'collect': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.25, color: e.kind === 'heart' ? '#ff2fa0' : e.kind === 'key' ? '#ffd23f' : '#b6ff4a', size: 0.5, name: 'hero' }); break
        case 'unlock': case 'gate': spark(e.x, e.y, 12, '#ffd23f', 3, 0.6); break
        case 'crystal': flashT = 0.08; flashColor = e.state === 'pink' ? '#ff2fa0' : '#2ff3ff'; break
        case 'reflect': spark(e.x, e.y, 6, '#2ff3ff', 5); break
        case 'discHit': spark(e.x, e.y, 6, '#2ff3ff', 4); break
        case 'charged': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 0.3, color: '#2ff3ff', size: 0.6, name: 'hero' }); break
        case 'spin': fx.push({ kind: 'ring', x: 0, y: 0, vx: 0, vy: 0, t: 0, life: SPIN_TIME, color: '#2ff3ff', size: 1.6, name: 'hero' }); break
        case 'bossPhase': flashT = 0.3; flashColor = '#ff2fa0'; break
        case 'won': flashT = 1; flashColor = '#ffd23f'; break
      }
    }
    if (fx.length > 260) fx = fx.slice(fx.length - 260)
  }

  // ---------------------------------------------------------------------------
  // Drawing helpers
  // ---------------------------------------------------------------------------

  function dirKey(d: Dir): { key: string; flip: boolean } {
    if (d === 'left') return { key: 'side', flip: true }
    if (d === 'right') return { key: 'side', flip: false }
    return { key: d, flip: false }
  }

  function shadow(g: G, x: number, y: number, w: number) {
    g.fillStyle = 'rgba(8,4,20,0.42)'
    g.fillRect(Math.round(x - w / 2) + 1, Math.round(y) - 1, w - 2, 1)
    g.fillRect(Math.round(x - w / 2), Math.round(y), w, 2)
    g.fillRect(Math.round(x - w / 2) + 1, Math.round(y) + 2, w - 2, 1)
  }

  function put(g: G, name: string, x: number, y: number, flip = false, flash = false) {
    const c = flash ? silhouette(name, '#ffffff', flip) : sprite(name, flip)
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height))
  }

  function drawHero(g: G, s: GameState, cx: number, cy: number, lights: Light[]) {
    const h = s.hero
    const x = h.x * T - cx
    const feet = h.y * T - cy + 6
    const { key, flip } = dirKey(h.dir)
    if (h.act === 'dead') {
      const d = s.dying ? s.dying.t : 0
      if (d < 0.8) {
        const spin: Dir[] = ['down', 'left', 'up', 'right']
        const sd = dirKey(spin[Math.floor(d * 10) % 4]!)
        put(g, `hero_${sd.key}_0`, x, feet, sd.flip)
      } else put(g, 'hero_dead', x, feet)
      return
    }
    if (h.act === 'fall') {
      const f = Math.min(2, Math.floor(h.actT / 0.18))
      put(g, `hero_fall_${f}`, x, feet - 2)
      return
    }
    if (h.invuln > 0 && h.act !== 'get' && Math.floor(time * 20) % 2 === 0) return
    shadow(g, x, feet - 1, 10)
    let name = `hero_${key}_0`
    const step = Math.floor(h.walkT * 7) % 4
    const walkFrame = [1, 0, 2, 0][step]!
    switch (h.act) {
      case 'walk': name = `hero_${key}_${walkFrame}`; break
      case 'swing': case 'throw': case 'use': name = `hero_${key}_atk`; break
      case 'spin': {
        const order: Dir[] = [h.dir, h.dir === 'down' ? 'left' : h.dir === 'left' ? 'up' : h.dir === 'up' ? 'right' : 'down']
        const p = h.spin ? h.spin.t / SPIN_TIME : 0
        const seq: Dir[] = ['down', 'left', 'up', 'right']
        const start = seq.indexOf(order[0]!)
        const dd = dirKey(seq[(start + Math.floor(p * 4)) % 4]!)
        name = `hero_${dd.key}_atk`
        put(g, name, x, feet, dd.flip)
        drawSpinBlade(g, s, x, feet - 7, lights)
        return
      }
      case 'lift': name = `hero_${key}_carry_0`; break
      case 'carry': name = `hero_${key}_carry_${h.vx || h.vy ? walkFrame % 2 : 0}`; break
      case 'push': name = `hero_${key}_push`; break
      case 'hurt': name = 'hero_hurt'; break
      case 'get': name = 'hero_get'; break
    }
    const blade = h.swing || (h.charge > 0.12 && s.inv.sword && !h.carry)
    // Blade behind the body when facing up.
    if (blade && h.dir === 'up') drawBlade(g, s, x, feet - 7, lights)
    put(g, name, x, feet, flip && h.act !== 'hurt' && h.act !== 'get')
    if (blade && h.dir !== 'up') drawBlade(g, s, x, feet - 7, lights)
    if (h.carry || h.act === 'lift') {
      const lift = h.act === 'lift' ? Math.min(1, h.actT / 0.18) : 1
      const spr = sprite(h.carry === 'rock' ? 'rock' : 'pot')
      g.drawImage(spr, Math.round(x - 8), Math.round(feet - 16 - 10 * lift - 2))
    }
    if (h.act === 'get' && s.get) {
      const icon = itemIcon(s.get.item)
      const spr = sprite(icon)
      g.drawImage(spr, Math.round(x - spr.width / 2), Math.round(feet - 18 - spr.height))
      lights.push({ x: h.x, y: h.y - 1.4, r: 3.5, color: '#ffd23f', a: 0.9 })
    }
  }

  function bladeSprite(a: number): { name: string; fh: boolean; fv: boolean } {
    // Quantise to 8 directions.
    const o = ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8
    switch (o) {
      case 0: return { name: 'sword_h', fh: false, fv: false }
      case 1: return { name: 'sword_d', fh: false, fv: true }
      case 2: return { name: 'sword_v', fh: false, fv: true }
      case 3: return { name: 'sword_d', fh: true, fv: true }
      case 4: return { name: 'sword_h', fh: true, fv: false }
      case 5: return { name: 'sword_d', fh: true, fv: false }
      case 6: return { name: 'sword_v', fh: false, fv: false }
      default: return { name: 'sword_d', fh: false, fv: false }
    }
  }

  function blit(g: G, name: string, fh: boolean, fv: boolean, x: number, y: number) {
    const c = spriteT(name, fh, fv)
    g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2))
  }

  function drawBlade(g: G, s: GameState, x: number, y: number, lights: Light[]) {
    const h = s.hero
    let a: number
    let reach = 11
    if (h.swing) a = swingAngle(h.swing.dir, h.swing.t / SWING_TIME)
    else {
      a = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.dir]
      reach = 9
    }
    const bs = bladeSprite(a)
    const bx = x + Math.cos(a) * reach
    const by = y + Math.sin(a) * reach
    // Smear behind the swing.
    if (h.swing) {
      g.fillStyle = 'rgba(47,243,255,0.35)'
      for (let k = 1; k <= 3; k++) {
        const pa = swingAngle(h.swing.dir, Math.max(0, h.swing.t / SWING_TIME - k * 0.12))
        g.fillRect(Math.round(x + Math.cos(pa) * 13) - 1, Math.round(y + Math.sin(pa) * 13) - 1, 3, 3)
      }
    }
    blit(g, bs.name, bs.fh, bs.fv, bx, by)
    const charged = !h.swing && h.charge >= 0.55
    lights.push({ x: (x + Math.cos(a) * 16) / T + camX / T, y: (y + Math.sin(a) * 16) / T + camY / T, r: charged ? 2.6 : 1.8, color: '#2ff3ff', a: charged ? (Math.floor(time * 12) % 2 ? 1 : 0.5) : 0.7 })
    if (charged && Math.floor(time * 12) % 2 === 0) {
      g.fillStyle = '#ffffff'
      const tx = Math.round(x + Math.cos(a) * 17)
      const ty = Math.round(y + Math.sin(a) * 17)
      g.fillRect(tx - 1, ty, 3, 1)
      g.fillRect(tx, ty - 1, 1, 3)
    }
  }

  function drawSpinBlade(g: G, s: GameState, x: number, y: number, lights: Light[]) {
    const h = s.hero
    const p = h.spin ? h.spin.t / SPIN_TIME : 0
    const base = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 }[h.dir]
    const a = base + p * Math.PI * 2
    g.fillStyle = 'rgba(47,243,255,0.45)'
    for (let k = 0; k < 10; k++) {
      const pa = a - k * 0.22
      g.fillRect(Math.round(x + Math.cos(pa) * 18) - 1, Math.round(y + Math.sin(pa) * 16) - 1, 3, 3)
    }
    const bs = bladeSprite(a)
    blit(g, bs.name, bs.fh, bs.fv, x + Math.cos(a) * 12, y + Math.sin(a) * 11)
    lights.push({ x: h.x, y: h.y, r: 3.2, color: '#2ff3ff', a: 0.8 })
  }

  function itemIcon(item: string): string {
    switch (item) {
      case 'sword': return 'item_sword'
      case 'bombBag': case 'bombs5': return 'item_bombbag'
      case 'disc': return 'item_disc'
      case 'smallKey': return 'item_key'
      case 'bigKey': return 'item_bigkey'
      case 'heartPiece': return 'item_heartpiece'
      case 'heartContainer': return 'item_container'
      case 'heart': return 'drop_heart'
      case 'prism': return 'item_prism'
      default: return 'item_bits'
    }
  }

  function enemySprite(e: Enemy): { name: string; flip: boolean } {
    const f = Math.floor(time * (e.kind === 'bat' ? 8 : 4) + hash2(e.home.x, e.home.y) * 4) % 2
    const { key, flip } = dirKey(e.dir)
    switch (e.kind) {
      case 'blob': return { name: `blob_${e.ai.mode === 'hop' ? 1 : f}`, flip: false }
      case 'spitter': return { name: `spitter_${key}_${e.ai.tell > 0 ? 1 : f}`, flip }
      case 'sentry': return { name: `sentry_${key}_${f}`, flip }
      case 'bat': return { name: `bat_${e.ai.mode === 'rest' ? 1 : f}`, flip: false }
      case 'dasher': return { name: `dasher_${key}_${f}`, flip }
      case 'zapper': return { name: `zapper_${e.stun > 0 ? 0 : f}`, flip: false }
      case 'skull': return { name: e.ai.mode === 'hop' || e.ai.mode === 'dodge' ? 'skull_jump' : `skull_${f}`, flip: false }
      case 'eye': return { name: 'eye', flip: false }
      case 'blade': return { name: 'blade', flip: false }
      case 'knight': return { name: `knight_${key}_${e.ai.mode === 'charge' ? Math.floor(time * 10) % 2 : f}`, flip }
      case 'king': return { name: e.flash > 0 || e.ai.mode === 'down' ? 'king_hurt' : `king_${f}`, flip: false }
    }
  }

  function drawEnemy(g: G, s: GameState, e: Enemy, cx: number, cy: number, lights: Light[]) {
    const x = e.x * T - cx
    let feet = e.y * T - cy + e.r * T + 1
    const { name, flip } = enemySprite(e)
    const flying = e.kind === 'bat' || e.kind === 'king'
    if (e.kind === 'king') {
      const down = e.ai.mode === 'down'
      const hover = down ? 0 : 6 + Math.sin(time * 2) * 2
      shadow(g, x, feet - 2, 30)
      feet -= hover
      const shake = e.ai.mode === 'dying' ? (Math.random() - 0.5) * 3 : 0
      put(g, name, x + shake, feet + 8, flip, e.flash > 0 && Math.floor(time * 30) % 2 === 0)
      lights.push({ x: e.x, y: e.y, r: 5, color: '#ff2fa0', a: down ? 1 : 0.7 })
      if (e.ai.tell > 0 && Math.floor(time * 16) % 2 === 0) {
        g.fillStyle = '#ff2fa0'
        g.fillRect(Math.round(x) - 14, Math.round(feet - 40), 28, 1)
      }
      if (!down) {
        const bits = e.ai.shards as number
        for (let i = 0; i < 4; i++) {
          if (!(bits & (1 << i))) continue
          const p = shardPos(e, i)
          const sx = p.x * T - cx
          const sy = p.y * T - cy
          shadow(g, sx, sy + 8, 6)
          put(g, 'shard', sx, sy + 4)
          lights.push({ x: p.x, y: p.y, r: 1.6, color: '#ff2fa0', a: 0.8 })
        }
      }
      return
    }
    if (e.kind !== 'eye' && e.kind !== 'blade') shadow(g, x, feet - 1, Math.round(e.r * T * 1.6))
    if (flying) feet -= 6 + Math.round(Math.sin(time * 6 + e.home.x) * 1.5)
    if (e.kind === 'skull' && (e.ai.mode === 'hop' || e.ai.mode === 'dodge')) feet -= Math.round(Math.sin(Math.max(0, 1 - e.ai.t / 0.34) * Math.PI) * 5)
    if (e.kind === 'blob' && e.ai.mode === 'hop') feet -= Math.round(Math.sin(Math.max(0, 1 - e.ai.t / 0.38) * Math.PI) * 3)
    const flash = e.flash > 0 && Math.floor(time * 30) % 2 === 0
    put(g, name, x, feet, flip, flash)
    if (e.kind === 'eye') {
      const a = e.ai.ang as number ?? 0
      const hot = e.ai.tell > 0 || e.ai.mode === 'aim'
      g.fillStyle = hot ? '#ffffff' : '#ff3b5c'
      g.fillRect(Math.round(x + Math.cos(a) * 3) - 1, Math.round(feet - 10 + Math.sin(a) * 2) - 1, 3, 3)
      lights.push({ x: e.x, y: e.y - 0.3, r: hot ? 2.4 : 1.2, color: '#ff3b5c', a: hot ? 1 : 0.6 })
    }
    if (e.kind === 'zapper' && e.stun <= 0) lights.push({ x: e.x, y: e.y - 0.4, r: 2, color: '#b6ff4a', a: 0.5 + 0.3 * Math.sin(time * 15) })
    if (e.kind === 'knight' && e.ai.mode === 'dazed') drawStars(g, x, feet - 25)
    if (e.stun > 0) drawStars(g, x, feet - (e.kind === 'knight' ? 25 : 16))
    if (e.ai.tell > 0 && e.kind !== 'eye' && e.kind !== 'spitter') {
      g.fillStyle = '#ff2fa0'
      const top = feet - (e.kind === 'knight' ? 28 : 19)
      g.fillRect(Math.round(x), Math.round(top), 1, 4)
      g.fillRect(Math.round(x), Math.round(top) + 5, 1, 1)
    }
  }

  function drawStars(g: G, x: number, y: number) {
    for (let i = 0; i < 3; i++) {
      const a = time * 6 + (i * Math.PI * 2) / 3
      g.fillStyle = i % 2 ? '#ffd23f' : '#fff4ff'
      g.fillRect(Math.round(x + Math.cos(a) * 5), Math.round(y + Math.sin(a) * 2), 1, 1)
    }
  }

  let camX = 0
  let camY = 0

  // ---------------------------------------------------------------------------
  // Frame
  // ---------------------------------------------------------------------------

  function draw(s: GameState, ui: FrameUI, dt: number) {
    time += ui.paused ? 0 : dt
    const info = mapInfo(world, s.map.id)
    const kind = info.def.kind
    if (!layer || layer.mapId !== s.map.id) layer = createTileLayer(world, s.map)
    else updateTileLayer(layer, world, s.map)

    // Camera
    const cam = ui.cam ?? cameraFor(s, vw / T, vh / T)
    let cx = Math.round(cam.x * T)
    let cy = Math.round(cam.y * T)
    if (s.shake > 0 && !ui.reducedMotion) {
      cx += Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4))
      cy += Math.round((Math.random() - 0.5) * 4 * Math.min(1, s.shake * 4))
    }
    camX = cx
    camY = cy
    const lights: Light[] = []

    // --- world -----------------------------------------------------------------
    const g = sg
    g.fillStyle = kind === 'overworld' ? '#0e2a3c' : '#07040f'
    g.fillRect(0, 0, vw, vh)
    g.drawImage(layer.canvas, -cx, -cy)
    drawLiveTiles(g, world, s, cx, cy, vw, vh, time, lights, ui.reducedMotion)

    // Sort things by feet.
    type Item = { y: number; draw: () => void }
    const items: Item[] = []
    const m = s.map
    for (const b of m.moving) {
      const p = Math.min(1, b.t / 0.28)
      const bx = (b.fx + (b.tx - b.fx) * p) * T - cx
      const by = (b.fy + (b.ty - b.fy) * p) * T - cy
      items.push({ y: b.fy + 1, draw: () => drawBlock(g, Math.round(bx), Math.round(by)) })
    }
    for (const d of m.drops) {
      const left = d.life - d.t
      if (left < 2 && Math.floor(time * 12) % 2 === 0) continue
      const name = d.kind === 'heart' ? 'drop_heart' : d.kind === 'bit' ? 'bit_1' : d.kind === 'bit5' ? 'bit_5' : d.kind === 'bomb' ? 'drop_bomb' : 'drop_key'
      items.push({ y: d.y, draw: () => { shadow(g, d.x * T - cx, d.y * T - cy + 3, 5); put(g, name, d.x * T - cx, d.y * T - cy + 4 - d.z * T) } })
      if (d.kind === 'bit5' || d.kind === 'key') lights.push({ x: d.x, y: d.y, r: 0.9, color: d.kind === 'key' ? '#ffd23f' : '#2f5fd0', a: 0.5 })
    }
    for (const p of m.pickups) {
      if (p.hidden) continue
      const icon = itemIcon(p.item)
      const bob = p.shop || ui.reducedMotion ? 0 : Math.round(Math.sin(time * 3 + p.x) * 1.5)
      items.push({
        y: p.y,
        draw: () => {
          const px = p.x * T - cx
          const py = p.y * T - cy
          if (!p.shop) shadow(g, px, py + 5, 8)
          put(g, icon, px, py + 5 - (p.shop ? 3 : 2) + bob)
          if (p.shop) {
            const t = String(p.shop.price)
            drawText(g, t, Math.round(px - textWidth(t) / 2), Math.round(py + 9), '#b6ff4a', '#0b0616')
          }
        },
      })
      lights.push({ x: p.x, y: p.y - 0.3, r: p.item === 'prism' ? 4 : 1.8, color: p.item === 'prism' ? '#ffd23f' : p.item === 'heartContainer' || p.item === 'heartPiece' ? '#ff2fa0' : '#ffd23f', a: 0.8 })
    }
    for (const n of m.npcs) {
      const f = Math.floor(time * 2 + n.home.x) % 2
      items.push({ y: n.y, draw: () => { const x = n.x * T - cx; const y = n.y * T - cy + 6; shadow(g, x, y - 1, 10); put(g, `${n.look}_${f}`, x, y, n.dir === 'left') } })
      if (n.look === 'robot') lights.push({ x: n.x, y: n.y - 0.8, r: 1.2, color: '#ff2fa0', a: 0.7 })
      if (n.look === 'keeper') lights.push({ x: n.x + 0.3, y: n.y - 0.9, r: 1.6, color: '#2ff3ff', a: 0.7 })
      if (n.look === 'ghost') lights.push({ x: n.x, y: n.y, r: 2, color: '#cfc6ff', a: 0.4 })
    }
    for (const e of m.enemies) {
      if (e.dead) continue
      if (kind === 'dungeon' && e.cell !== s.zoneIndex && !(s.scroll && e.cell === s.scroll.index)) continue
      items.push({ y: e.kind === 'eye' ? e.y + 0.4 : e.y, draw: () => drawEnemy(g, s, e, cx, cy, lights) })
    }
    for (const b of m.bombs) {
      const fast = b.t > BOMB_FUSE - 0.6
      const f = Math.floor(time * (fast ? 16 : 5)) % 2
      items.push({ y: b.y, draw: () => { shadow(g, b.x * T - cx, b.y * T - cy + 4, 8); put(g, `bomb_${f}`, b.x * T - cx, b.y * T - cy + 5) } })
      lights.push({ x: b.x, y: b.y - 0.5, r: 1, color: '#ff8a3d', a: 0.7 })
    }
    for (const o of m.thrown) {
      items.push({ y: o.y, draw: () => { shadow(g, o.x * T - cx, o.y * T - cy + 4, 8); put(g, o.kind === 'rock' ? 'rock' : 'pot', o.x * T - cx, o.y * T - cy + 8 - o.z * T * 1.4) } })
    }
    if (!ui.attract && s.hero.x > -10) items.push({ y: s.hero.y, draw: () => drawHero(g, s, cx, cy, lights) })
    items.sort((a, b) => a.y - b.y)
    for (const it of items) it.draw()

    // --- light --------------------------------------------------------------------
    const dark = kind !== 'overworld' && !!cellDef(info, s.zoneIndex)?.dark
    const amb = dark ? (kind === 'interior' ? AMBIENT.caveDark : AMBIENT.dark) : AMBIENT[kind]
    lg.globalCompositeOperation = 'source-over'
    lg.fillStyle = amb
    lg.fillRect(0, 0, vw, vh)
    lg.globalCompositeOperation = 'lighter'
    const h = s.hero
    if (!ui.attract && h.x > -10) lights.push({ x: h.x, y: h.y - 0.2, r: dark ? 5.2 : 2.6, color: dark ? '#b8a8e8' : '#8a7ab8', a: dark ? 1 : 0.35 })
    if (s.disc) lights.push({ x: s.disc.x, y: s.disc.y, r: 2.2, color: '#2ff3ff', a: 0.9 })
    for (const p of m.projectiles) lights.push({ x: p.x, y: p.y, r: p.kind === 'laser' ? 1.6 : 1.4, color: p.friendly ? '#2ff3ff' : p.kind === 'laser' ? '#ff3b5c' : '#ff2fa0', a: 0.9 })
    for (const b of m.blasts) lights.push({ x: b.x, y: b.y, r: 5 * (1 - b.t), color: '#ff8a3d', a: 1 })
    for (const L of lights) {
      const rad = L.r * T
      const px = L.x * T - cx
      const py = L.y * T - cy
      if (px < -rad || py < -rad || px > vw + rad || py > vh + rad) continue
      lg.globalAlpha = Math.max(0, Math.min(1, L.a))
      lg.drawImage(glow(L.color), px - rad, py - rad, rad * 2, rad * 2)
    }
    lg.globalAlpha = 1
    g.globalCompositeOperation = 'multiply'
    g.drawImage(light, 0, 0)
    g.globalCompositeOperation = 'source-over'

    // --- emissive things after light ----------------------------------------------
    if (kind === 'overworld') drawLakeSun(g, s, cx, cy, ui.reducedMotion)
    for (const p of m.projectiles) {
      const px = p.x * T - cx
      const py = p.y * T - cy
      if (p.kind === 'pellet') put(g, 'pellet', px, py + 3)
      else if (p.kind === 'laser') {
        const len = 7
        const n = Math.hypot(p.vx, p.vy) || 1
        g.strokeStyle = '#ff3b5c'
        g.lineWidth = 3
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - (p.vx / n) * len, py - (p.vy / n) * len); g.stroke()
        g.strokeStyle = '#ffffff'
        g.lineWidth = 1
        g.beginPath(); g.moveTo(px, py); g.lineTo(px - (p.vx / n) * len, py - (p.vy / n) * len); g.stroke()
      } else {
        g.fillStyle = p.friendly ? '#2ff3ff' : '#ff2fa0'
        g.fillRect(Math.round(px) - 2, Math.round(py) - 1, 5, 3)
        g.fillRect(Math.round(px) - 1, Math.round(py) - 2, 3, 5)
        g.fillStyle = '#ffffff'
        g.fillRect(Math.round(px) - 1, Math.round(py) - 1, 2, 2)
      }
    }
    if (s.disc) {
      const f = Math.floor(time * 20) % 2
      put(g, `disc_${f}`, s.disc.x * T - cx, s.disc.y * T - cy + 6)
    }
    drawFx(g, s, dt, cx, cy, ui.paused)

    // Dim the world outside the current dungeon room.
    if (kind === 'dungeon' && !s.scroll) {
      const z = s.zone
      g.fillStyle = '#05030c'
      const zx = z.x * T - cx
      const zy = z.y * T - cy
      g.fillRect(0, 0, vw, Math.max(0, zy))
      g.fillRect(0, zy + z.h * T, vw, vh)
      g.fillRect(0, 0, Math.max(0, zx), vh)
      g.fillRect(zx + z.w * T, 0, vw, vh)
    }
    // Screen flash
    if (flashT > 0) {
      g.globalAlpha = Math.min(0.55, flashT * 2.2)
      g.fillStyle = flashColor
      g.fillRect(0, 0, vw, vh)
      g.globalAlpha = 1
      if (!ui.paused) flashT -= dt
    }
    // Warp / death fades
    let fade = 0
    if (s.warp) fade = s.warp.t < WARP_TIME ? s.warp.t / WARP_TIME : 2 - s.warp.t / WARP_TIME
    if (s.dying) fade = Math.max(0, (s.dying.t - 1) / 0.8)
    if (fade > 0) {
      g.globalAlpha = Math.min(1, fade)
      g.fillStyle = '#0b0616'
      g.fillRect(0, 0, vw, vh)
      g.globalAlpha = 1
    }

    // --- to the screen -------------------------------------------------------------
    screen.setTransform(1, 0, 0, 1, 0, 0)
    screen.globalCompositeOperation = 'source-over'
    screen.fillStyle = '#0b0616'
    screen.fillRect(0, 0, W, H)
    const ox = Math.floor((W - vw * scale) / 2)
    const oy = Math.floor((gameH - vh * scale) / 2)
    screen.imageSmoothingEnabled = false
    screen.drawImage(scene, 0, 0, vw, vh, ox, oy, vw * scale, vh * scale)
    // Neon bloom: glows gathered at logical resolution, then one smooth
    // upscale added onto the screen (cheap on phones, soft on big screens).
    if (fade < 1) {
      bg.globalCompositeOperation = 'source-over'
      bg.clearRect(0, 0, vw, vh)
      bg.globalCompositeOperation = 'lighter'
      for (const L of lights) {
        if (L.a < 0.3) continue
        const rad = L.r * T * 0.9
        const px = L.x * T - cx
        const py = L.y * T - cy
        if (px < -rad || py < -rad || px > vw + rad || py > vh + rad) continue
        bg.globalAlpha = Math.min(1, L.a) * 0.32
        bg.drawImage(glow(L.color), px - rad, py - rad, rad * 2, rad * 2)
      }
      bg.globalAlpha = 1
      screen.globalCompositeOperation = 'lighter'
      screen.globalAlpha = 1 - fade
      screen.imageSmoothingEnabled = true
      screen.drawImage(bloom, 0, 0, vw, vh, ox, oy, vw * scale, vh * scale)
      screen.imageSmoothingEnabled = false
      screen.globalAlpha = 1
      screen.globalCompositeOperation = 'source-over'
    }
    if (scan && scale >= 3) {
      screen.fillStyle = scan
      screen.fillRect(0, 0, W, gameH)
    }
    vignette(screen)

    // --- HUD ----------------------------------------------------------------------
    hg.clearRect(0, 0, vw, vh)
    if (!ui.attract) {
      drawHud(hg, s, vw, time, ui.touch)
      if (ui.banner && s.mode !== 'dialog') drawBanner(hg, ui.banner.text, ui.banner.t, vw, vh)
      if (s.dialog) drawDialog(hg, s, vw, vh, s.hero.y * T - cy, ui.keys, time)
      if (ui.paused) drawPause(hg, s, vw, vh, ui.keys)
    }
    screen.drawImage(hud, 0, 0, vw, vh, ox, oy, vw * scale, vh * scale)

    // Touch stick
    if (ui.stick) {
      const sx = ui.stick.ox * dpr
      const sy = ui.stick.oy * dpr
      screen.strokeStyle = 'rgba(47,243,255,0.45)'
      screen.lineWidth = 2 * dpr
      screen.beginPath(); screen.arc(sx, sy, 40 * dpr, 0, Math.PI * 2); screen.stroke()
      screen.fillStyle = 'rgba(47,243,255,0.35)'
      screen.beginPath(); screen.arc(sx + ui.stick.dx * dpr, sy + ui.stick.dy * dpr, 16 * dpr, 0, Math.PI * 2); screen.fill()
    }
  }

  let vig: HTMLCanvasElement | null = null
  function vignette(g: G) {
    if (!vig || vig.width !== W || vig.height !== gameH) {
      vig = makeCanvas(W, gameH)
      const vg = vig.getContext('2d')!
      const grad = vg.createRadialGradient(W / 2, gameH / 2, Math.min(W, gameH) * 0.35, W / 2, gameH / 2, Math.max(W, gameH) * 0.75)
      grad.addColorStop(0, 'rgba(11,6,22,0)')
      grad.addColorStop(1, 'rgba(11,6,22,0.55)')
      vg.fillStyle = grad
      vg.fillRect(0, 0, W, gameH)
    }
    g.drawImage(vig, 0, 0)
  }

  /** The striped synthwave sun, reflected in Mirror Lake. */
  function drawLakeSun(g: G, s: GameState, cx: number, cy: number, reduced: boolean) {
    const sx = 55 * T - cx
    const sy = 33 * T - cy
    if (sx < -120 || sx > vw + 120 || sy < -80 || sy > vh + 80) return
    const m = s.map
    const cols = ['#ffd23f', '#ffb13f', '#ff8a3d', '#ff5f7a', '#ff2fa0', '#c42a9a']
    for (let i = 0; i < 14; i++) {
      const y = sy + i * 3
      const half = Math.round(Math.sqrt(Math.max(0, 1 - (i / 14) ** 2)) * 48)
      const wob = reduced ? 0 : Math.round(Math.sin(time * 2 + i * 0.9) * 2)
      g.fillStyle = cols[Math.min(cols.length - 1, Math.floor(i / 2))]!
      for (let x = -half; x < half; x += 2) {
        const tx = Math.floor((sx + x + cx) / T)
        const ty = Math.floor((y + cy) / T)
        if (m.tiles[ty * m.w + tx] !== '~') continue
        g.globalAlpha = 0.8 - i * 0.04
        g.fillRect(Math.round(sx + x + wob), Math.round(y), 2, 1)
      }
    }
    g.globalAlpha = 1
  }

  function drawFx(g: G, s: GameState, dt: number, cx: number, cy: number, paused: boolean) {
    const keep: Fx[] = []
    for (const f of fx) {
      if (!paused) f.t += dt
      if (f.t > f.life) continue
      keep.push(f)
      if (f.t < 0) continue
      const p = f.t / f.life
      if (f.kind === 'sprite') {
        const fr = Math.min(f.frames! - 1, Math.floor(p * f.frames!))
        const spr = sprite(`${f.name}_${fr}`)
        g.drawImage(spr, Math.round(f.x * T - cx - spr.width / 2), Math.round(f.y * T - cy - spr.height / 2))
        continue
      }
      if (f.kind === 'ring') {
        const x = (f.name === 'hero' ? s.hero.x : f.x) * T - cx
        const y = (f.name === 'hero' ? s.hero.y : f.y) * T - cy
        const rad = 4 + p * 16 * f.size
        g.globalAlpha = 1 - p
        g.strokeStyle = f.color
        g.lineWidth = 1
        g.beginPath(); g.arc(Math.round(x), Math.round(y), rad, 0, Math.PI * 2); g.stroke()
        g.globalAlpha = 1
        continue
      }
      if (!paused) {
        f.x += f.vx * dt
        f.y += f.vy * dt
        if (f.kind === 'leaf') f.vy += 12 * dt
        f.vx *= 0.92
        f.vy *= f.kind === 'leaf' ? 1 : 0.92
      }
      g.globalAlpha = 1 - p * 0.7
      g.fillStyle = f.color
      g.fillRect(Math.round(f.x * T - cx), Math.round(f.y * T - cy), f.size, f.size)
      g.globalAlpha = 1
    }
    fx = keep
  }

  void cellIndex
  return { resize, draw, onEvents, viewTiles }
}
