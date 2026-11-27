/**
 * A room played on its chart (`CellDef.chart`; the Dark Shift, docs/games/neon-shrine-heap.md): while the hero is in
 * it and any foe of it lives, both views show the room as the Delvers drew it, flat and north up, in place of the
 * world. One ink a tile in the land's own (`worldMap.ts`), the rim a page's edge, and on the page what the fight
 * needs: the hero as drawn with a cyan ring, each foe's own picture, the pink lanes, a gold ring round whatever is
 * open, the Magnet's bracket and line, and five pips along the top edge that count the foes down. The last one's fall
 * (or the hero's leaving) fades it out over `FADE` s.
 *
 * Painted on the screen's canvas over either view's picture and under the HUD (`renderer.ts` `hudLayer`), at the
 * largest whole-number scale at which the whole room fits between the hearts at the top and as much at the foot.
 */
import type { Enemy, GameState, MapState, World } from '../types'
import { TILE } from '../types'
import { bossOpen } from '../engine/combat'
import { cellDef, cellRect, mapInfo } from '../engine/map'
import { drawFloorMarks } from './floorMarks'
import { drawHeapFloor, drawLatchLines } from './heapMarks'
import { makeCanvas } from './sheet'
import { chartInks, chartPixels } from './worldMap'

type G = CanvasRenderingContext2D
const T = TILE
const FADE = 0.4
/** The share of the screen's height the page may take: the rest is the HUD's rows and the corner's. */
const TALL = 0.76

const INK = '#0b0616'
const CYAN = '#2ff3ff'
const GOLD = '#ffd23f'
const PAPER = '#cfc6ff'
/** A gold ring's width, tiles. */
const RING = 1.4

/** What the renderer draws on the page with its own hands, in classic px for a camera at (cx, cy). */
export interface ChartKit {
  /** A foe's own picture, its feet at (x, y): fallen a moment ago, its last white burst. */
  foe(g: G, s: GameState, e: Enemy, cx: number, cy: number): void
  /** Loot, bombs, the echo and the hero. */
  figures(g: G, s: GameState, cx: number, cy: number): void
  /** The hook's chain, shots, the disc, the blade's smear and the sparks. */
  effects(g: G, s: GameState, cx: number, cy: number): void
}

export interface ChartScreen {
  w: number
  h: number
  /** Device px to keep clear of at the screen's edges. */
  top: number
  bottom: number
  left: number
  right: number
}

/** Is the hero in a chart room with the fight still on? */
export function charting(world: World, s: GameState): boolean {
  if (s.scroll) return false
  const info = mapInfo(world, s.map.id)
  return !!cellDef(info, s.zoneIndex)?.chart && s.map.enemies.some(e => e.cell === s.zoneIndex && !e.dead)
}

export function createChartRoom(world: World) {
  let page: HTMLCanvasElement | null = null
  /** How much of the page shows (0: none), the map and room it was painted for, and the hero's height on it. */
  let alpha = 0
  let of: MapState | null = null
  let cell = -1
  let heroY = 0
  let inks: { key: string; px: ReadonlyArray<string | null> } | null = null

  function paint(g: G, kit: ChartKit, s: GameState, time: number, reduced: boolean) {
    const info = mapInfo(world, s.map.id)
    const m = s.map
    const z = cellRect(info, cell)
    const cx = z.x * T
    const cy = z.y * T
    const c = chartInks(info.def)
    const key = `${m.id}|${m.version}|${s.view}`
    // (Every tile of the room counts as seen.)
    if (inks?.key !== key) inks = { key, px: chartPixels(info, m.tiles, m.terrain, () => true, { fog: false, view: s.view }) }
    g.globalAlpha = 1
    for (let y = 0; y < z.h; y++) {
      for (let x = 0; x < z.w; x++) {
        const i = (z.y + y) * m.w + z.x + x
        const rim = x === 0 || y === 0 || x === z.w - 1 || y === z.h - 1
        const wall = m.tiles[i] === '#'
        g.fillStyle = rim && wall ? c.top : inks.px[i] ?? c.ground
        g.fillRect(x * T, y * T, T, T)
        if (!rim) {
          // The squared paper under the ink.
          g.fillStyle = 'rgba(207,198,255,0.16)'
          g.fillRect(x * T, y * T, 1, 1)
          continue
        }
        // The page's edge: a double rule along the wall's inner side, broken at the doorways; a shut gate is barred.
        if (m.tiles[i] === 'X') {
          g.fillStyle = PAPER
          for (const u of [3, 8, 13]) g.fillRect(x * T + u - 1, y * T, 2, T)
          continue
        }
        if (!wall) continue
        for (const [off, ink] of [[1, PAPER], [4, c.wall]] as const) {
          g.fillStyle = ink
          // (The corners' rules meet; no rule runs out into them.)
          const across = x > 0 && x < z.w - 1
          const down = y > 0 && y < z.h - 1
          if (y === 0 && across) g.fillRect(x * T - (x === 1 ? off : 0), T - off - 1, T + (x === 1 ? off : 0) + (x === z.w - 2 ? off : 0), 1)
          if (y === z.h - 1 && across) g.fillRect(x * T - (x === 1 ? off : 0), y * T + off, T + (x === 1 ? off : 0) + (x === z.w - 2 ? off : 0), 1)
          if (x === 0 && down) g.fillRect(T - off - 1, y * T - (y === 1 ? off : 0), 1, T + (y === 1 ? off : 0) + (y === z.h - 2 ? off : 0))
          if (x === z.w - 1 && down) g.fillRect(x * T + off, y * T - (y === 1 ? off : 0), 1, T + (y === 1 ? off : 0) + (y === z.h - 2 ? off : 0))
        }
      }
    }

    // On the floor: the pink lanes, the hero's ring and the gold ones, and the Magnet's bracket over them.
    drawFloorMarks(g, world, s, cx, cy, time, reduced)
    const h = s.hero
    heroY = h.y * T - cy
    ring(g, h.x * T - cx, heroY + 4, 11, 6, CYAN)
    const foes = m.enemies.filter(e => e.cell === cell)
    const breathe = reduced ? 0 : Math.sin(time * 8) * 0.6
    for (const e of foes) {
      if (!e.dead && bossOpen(e)) ring(g, e.x * T - cx, e.y * T - cy, (RING / 2) * T + breathe, (RING / 2) * T + breathe, GOLD)
    }
    drawHeapFloor(g, world, s, cx, cy, time, reduced)

    // What stands on the page, the nearer over the farther.
    const behind = foes.filter(e => e.y <= h.y).sort((a, b) => a.y - b.y)
    const before = foes.filter(e => e.y > h.y).sort((a, b) => a.y - b.y)
    for (const e of behind) kit.foe(g, s, e, cx, cy)
    kit.figures(g, s, cx, cy)
    for (const e of before) kit.foe(g, s, e, cx, cy)
    drawLatchLines(g, s, cx, cy, time, reduced, [])
    kit.effects(g, s, cx, cy)

    // The tally on the top edge: one pip a foe of the room, filled while it lives.
    const all = info.marks.filter(v => v.ent.t === 'enemy' && v.x >= z.x && v.x < z.x + z.w && v.y >= z.y && v.y < z.y + z.h).length
    const left = foes.filter(e => !e.dead).length
    const step = 12
    const x0 = Math.round((z.w * T - all * step) / 2)
    g.fillStyle = INK
    g.fillRect(x0 - 3, 2, all * step + 6, 12)
    g.fillStyle = PAPER
    g.fillRect(x0 - 3, 2, all * step + 6, 1)
    g.fillRect(x0 - 3, 13, all * step + 6, 1)
    for (let i = 0; i < all; i++) pip(g, x0 + i * step + step / 2, 8, i < left)
  }

  return {
    /** Does the chart cover the world now (more of it than not)? The controls are not turned while it does. */
    covering: () => alpha >= 0.5,
    /**
     * Over the picture on the screen's canvas: the chart while the fight is on, and its fading after. Returns where the
     * hero is on the screen (device px) while it covers, or null.
     */
    draw(screen: G, at: ChartScreen, kit: ChartKit, s: GameState, time: number, reduced: boolean, dt: number): { heroY: number } | null {
      // (Another map, a new game, the way back after a fall: nothing of the old page is left to fade.)
      if (of !== s.map) { of = s.map; alpha = 0 }
      const on = charting(world, s)
      if (on) { alpha = 1; cell = s.zoneIndex }
      else if (alpha > 0) alpha = Math.max(0, alpha - dt / FADE)
      if (alpha <= 0) return null
      const info = mapInfo(world, s.map.id)
      const w = info.cw * T
      const h = info.ch * T
      if (!page || page.width !== w || page.height !== h) page = makeCanvas(w, h)
      // Still in the room: the page goes on being drawn (the last one's burst fades with it). Gone: it stays as it was.
      if (on || (s.zoneIndex === cell && !s.scroll)) {
        const g = page.getContext('2d')!
        g.imageSmoothingEnabled = false
        paint(g, kit, s, time, reduced)
      }
      const scale = Math.max(1, Math.floor(Math.min((at.w - at.left - at.right) / w, ((at.h - at.top - at.bottom) * TALL) / h)))
      const shake = s.shake > 0 && !reduced && dt > 0 ? Math.min(1, s.shake * 4) * scale * 2 : 0
      const x = Math.floor(at.left + (at.w - at.left - at.right - w * scale) / 2 + (Math.random() - 0.5) * shake)
      const y = Math.floor(at.top + (at.h - at.top - at.bottom - h * scale) / 2 + (Math.random() - 0.5) * shake)
      const c = chartInks(info.def)
      screen.save()
      screen.setTransform(1, 0, 0, 1, 0, 0)
      screen.globalCompositeOperation = 'source-over'
      screen.imageSmoothingEnabled = false
      screen.globalAlpha = alpha
      // Round the page, the desk it lies on: the land's fog, and the page's shadow and edge.
      screen.fillStyle = c.fog[0]
      screen.fillRect(0, 0, at.w, at.h)
      screen.fillStyle = c.fog[1]
      for (let gy = 0, row = 0; gy < at.h; gy += 8 * scale, row++) {
        for (let gx = (row % 2) * 4 * scale; gx < at.w; gx += 8 * scale) screen.fillRect(gx, gy, scale, scale)
      }
      screen.fillStyle = INK
      screen.fillRect(x - scale * 2, y - scale * 2, w * scale + scale * 6, h * scale + scale * 6)
      screen.fillStyle = PAPER
      screen.fillRect(x - scale, y - scale, w * scale + scale * 2, h * scale + scale * 2)
      screen.drawImage(page, x, y, w * scale, h * scale)
      screen.restore()
      return alpha >= 0.5 ? { heroY: y + heroY * scale } : null
    },
  }
}

/** A ring of hard pixels, two wide, with a dark one round it. */
function ring(g: G, x: number, y: number, rx: number, ry: number, color: string) {
  for (let py = Math.floor(y - ry - 3); py <= y + ry + 3; py++) {
    for (let px = Math.floor(x - rx - 3); px <= x + rx + 3; px++) {
      // The distance outward from the ellipse, in px along the radius.
      const u = (px + 0.5 - x) / rx
      const v = (py + 0.5 - y) / ry
      const d = (Math.hypot(u, v) - 1) * Math.min(rx, ry)
      if (d > 1.2 || d < -2) continue
      g.fillStyle = d > 0.2 || d < -1.4 ? INK : color
      g.fillRect(px, py, 1, 1)
    }
  }
}

function pip(g: G, x: number, y: number, live: boolean) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const d = Math.abs(dx) + Math.abs(dy)
      if (d > 4 || (!live && d < 3)) continue
      g.fillStyle = live ? (d === 4 ? PAPER : '#fff4ff') : '#6a5a98'
      g.fillRect(x + dx, y + dy, 1, 1)
    }
  }
}
