/**
 * The tall (phone) layout's header above the scene: a dollhouse
 * cross-section of Villa Voltvik in the storm. Three floors (cellar,
 * ground, attic under the roof) and the roof itself, the dumbwaiter shaft
 * down the left, a tiny head for each hero in his room (the current one
 * bobbing, with a marker), the house's people as little dots, state that
 * shows (the furnace, the rod, the stairs), Brunhilde blinking at the gate,
 * and the room on screen named underneath.
 *
 * Drawn on the HUD layer in art pixels of k stage pixels (k = 2 on a
 * phone). A short box gets k = 1, a very short one only the name. The
 * phone layout zooms in on the scene since 2026-09-26 and asks for the
 * name alone (house = false); the house waits here for a place to go.
 */
import { drawText, textWidth } from '../../base/pixel/sprites'
import type { Game } from '../engine/game'
import type { Box } from '../engine/layout'
import type { HeroId, RoomId } from '../types'
import { HERO_IDS } from '../types'
import { F } from '../content/flags'
import type { G } from './api'
import { hash } from './fx'
import { drawLogoCompact } from './title'

const K = '#0b0616'

interface Cell { x: number; y: number; w: number; h: number; floor: 'cellar' | 'ground' | 'attic' | 'roof' | 'outside' }

// Art-pixel layout of the house (x from the left wall, y from the roof peak).
const FH = 26
const HOUSE_W = 142
const Y_ATTIC = 30
const Y_GROUND = Y_ATTIC + FH + 2
const Y_CELLAR = Y_GROUND + FH + 4
/** From Brunhilde (x = -26) to the conservatory's far wall (x = 160). */
const ART_L = 26
const ART_W = 186
const ART_H = Y_CELLAR + FH + 12

const CELLS: Record<RoomId, Cell> = {
  roof: { x: 30, y: 0, w: 80, h: Y_ATTIC - 2, floor: 'roof' },
  storeroom: { x: 16, y: Y_ATTIC, w: 56, h: FH, floor: 'attic' },
  study: { x: 74, y: Y_ATTIC, w: 52, h: FH, floor: 'attic' },
  kitchen: { x: 4, y: Y_GROUND, w: 40, h: FH, floor: 'ground' },
  foyer: { x: 46, y: Y_GROUND, w: 52, h: FH, floor: 'ground' },
  parlour: { x: 100, y: Y_GROUND, w: 38, h: FH, floor: 'ground' },
  conservatory: { x: 141, y: Y_GROUND + 6, w: 17, h: FH - 6, floor: 'ground' },
  pantry: { x: 4, y: Y_CELLAR, w: 40, h: FH, floor: 'cellar' },
  boiler: { x: 46, y: Y_CELLAR, w: 42, h: FH, floor: 'cellar' },
  lab: { x: 90, y: Y_CELLAR, w: 48, h: FH, floor: 'cellar' },
  driveway: { x: -26, y: Y_GROUND, w: 22, h: FH, floor: 'outside' },
}

const WALL: Record<Cell['floor'], [string, string]> = {
  attic: ['#2a4a5a', '#3f7080'],
  ground: ['#3d2a66', '#6a4aa0'],
  cellar: ['#3a2a28', '#6a4a3a'],
  roof: ['#1a1638', '#1a1638'],
  outside: ['#1a1638', '#1a1638'],
}

const HEADS: Record<HeroId, string[]> = {
  kjell: ['.w.....', '.w...ww', '.w..w..', 'wwwwwww', 'wcscscw', 'wsssssw', 'wssksw.', '.wwwww.', '..www..'],
  dag: ['.......', '.......', '.nnnnn.', 'nsssssn', 'sksssks', 'sssssss', 'bbbbbbb', '.bbbbb.', '..bbb..'],
  espen: ['.w...w.', '.w...w.', '.w...w.', 'whhhhhw', 'wsssssw', 'wsksksw', 'wsssssw', '.wwwww.', '..www..'],
}
const HEAD_FLOP = ['.......', '.......', 'w.....w', 'whhhhhw', 'wsssssw', 'wsksksw', 'wsssssw', '.wwwww.', '..www..']
const HEAD_PAL: Record<string, string> = { w: '#f4f0ff', s: '#f5c3a8', k: K, c: '#8fe8ff', n: '#6a4432', b: '#8a5a30', h: '#3a2418' }

export function drawHouseHeader(g: G, game: Game, b: Box, house = true) {
  const room = game.roomDef()
  const hero = game.content.heroes[game.hero]
  const label = room.name.toUpperCase()
  const who = hero.name.toUpperCase()
  const t = game.clock
  if (b.h < (house ? 34 : 11)) return
  // The name line sits just above the scene.
  const ly = b.y + b.h - (house ? 12 : Math.min(12, Math.floor((b.h + 7) / 2)))
  const k = house ? Math.max(0, Math.min(3, Math.floor(Math.min(b.w / ART_W, (b.h - 30) / ART_H)))) : 0
  if (k >= 1) {
    const ox = Math.round(b.x + (b.w - ART_W * k) / 2) + ART_L * k
    const oy = Math.round(ly - 10 - ART_H * k)
    drawSky(g, b, oy + (Y_GROUND + FH) * k, game.flash)
    drawHouse(g, game, ox, oy, k, b)
    // The logo in the sky above, when there's room below the phone's status bar.
    const big = b.w >= 300 ? 3 : 2
    const logoH = big * 9 + Math.round(big * 0.55) * 7 + big * 3
    const free = oy - 16 * k - 40
    if (free >= logoH + 16) drawLogoCompact(g, Math.round(b.x + b.w / 2), Math.round(40 + (free - logoH) / 2), big, game.clock)
  }
  const line = `${label}`
  const lw = textWidth(line)
  const x = Math.round(b.x + (b.w - lw) / 2)
  drawText(g, line, x, ly, hero.color)
  const wx = x - textWidth(who) - 10
  if (wx > 4) drawText(g, who, wx, ly, '#5a4a80')
  void t
}

/** Storm sky: indigo overhead, bruised violet down at the horizon, lumpy clouds. */
function drawSky(g: G, b: Box, horizon: number, flash: number) {
  const stops = ['#07061a', '#0d0b26', '#141236', '#1c1846', '#262058']
  const h = Math.max(1, horizon - b.y)
  for (let y = b.y; y < Math.min(b.y + b.h, horizon); y++) {
    const u = ((y - b.y) / h) * (stops.length - 1)
    const i = Math.min(stops.length - 2, Math.floor(u))
    g.fillStyle = (u - i) > 0.5 && ((y & 1) === 0) ? stops[i + 1]! : stops[i]!
    g.fillRect(b.x, y, b.w, 1)
  }
  // The ground beyond the house, to both edges
  if (horizon < b.y + b.h) {
    g.fillStyle = '#1c1430'
    g.fillRect(b.x, horizon, b.w, b.y + b.h - horizon)
    g.fillStyle = '#1f5a50'
    g.fillRect(b.x, horizon, b.w, 2)
  }
  for (let x = 0; x < b.w; x++) {
    const n = Math.sin(x * 0.045) * 6 + Math.sin(x * 0.13 + 1) * 3
    const bottom = Math.round(b.y + h * 0.3 + n)
    g.fillStyle = '#0c0a22'
    g.fillRect(b.x + x, b.y, 1, Math.max(0, bottom - b.y))
    g.fillStyle = flash > 0.4 ? '#8a86d0' : '#221d4a'
    g.fillRect(b.x + x, bottom, 1, 1)
    const n2 = Math.sin(x * 0.07 + 2) * 5 + Math.sin(x * 0.2) * 2
    const b2 = Math.round(b.y + h * 0.55 + n2)
    g.fillStyle = '#15123a'
    g.fillRect(b.x + x, bottom + 1, 1, Math.max(0, b2 - bottom - 1))
    g.fillStyle = flash > 0.4 ? '#a8a4e8' : '#2c2660'
    g.fillRect(b.x + x, b2, 1, 1)
  }
}

function drawHouse(g: G, game: Game, ox: number, oy: number, k: number, box: Box) {
  const s = game.s
  const t = game.clock
  const P = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c
    g.fillRect(ox + Math.round(x) * k, oy + Math.round(y) * k, w * k, h * k)
  }
  const flash = game.flash
  const current = game.room

  // Rain over the whole header box, behind the house.
  g.fillStyle = flash > 0.3 ? '#c8d0ff' : '#2e3466'
  const n = Math.round((box.w * box.h) / 260)
  for (let i = 0; i < n; i++) {
    const speed = 120 + hash(i * 13 + 5) * 60
    const fy = ((hash(i * 11 + 3) * box.h + t * speed) % (box.h + 6)) - 6
    const fx = ((hash(i * 7 + 1) * box.w - fy * 0.25) % box.w + box.w) % box.w
    for (let q = 0; q < 4; q++) g.fillRect(Math.round(box.x + fx - q * 0.25), Math.round(box.y + fy + q) , 1, 1)
  }
  if (flash > 0.5) {
    // A bolt somewhere over the house.
    const seed = Math.floor(t * 0.37)
    let x = ox + Math.round((20 + hash(seed) * 140) * k)
    g.fillStyle = '#ffffff'
    for (let y = box.y; y < oy + 6 * k; y++) { if (hash(seed * 131 + y) < 0.3) x += hash(seed * 17 + y) < 0.5 ? -1 : 1; g.fillRect(x, y, 1, 1) }
  }

  // Earth round the cellar, grass on top, the hill down to the gate.
  P(-ART_L - 4, Y_GROUND + FH, ART_W + 8, 2, '#1f5a50')
  P(-ART_L - 4, Y_GROUND + FH + 2, ART_W + 8, ART_H - (Y_GROUND + FH + 2), '#1c1430')
  for (let x = -ART_L - 4; x < ART_W - ART_L + 4; x += 3) if (hash(x * 7) < 0.5) P(x, Y_GROUND + FH - 1, 1, 1, '#2a8579')

  const roofTop = Y_ATTIC - 6
  // The attic's back wall under the roof (the slopes go on after the rooms)
  for (let y = roofTop; y < Y_ATTIC + FH; y++) {
    const i = y - roofTop
    const inset = Math.max(0, 18 - Math.round(i * 0.56))
    P(8 + inset, y, HOUSE_W - 4 - inset * 2, 1, '#143c4a')
  }
  // Chimney, rod, vane on the roof
  P(50, roofTop - 7, 6, 7, '#8a3a4a')
  P(49, roofTop - 8, 8, 1, '#3a1a2a')
  if (s.flags[F.rodUp]) { P(92, roofTop - 14, 1, 14, '#d8d8f0'); P(91, roofTop - 16, 3, 2, '#ffd23f') } else P(84, roofTop - 2, 14, 1, '#9a9ab8')
  P(112, roofTop - 9, 1, 9, K)
  P(110, roofTop - 11, 4, 2, '#ffd23f')
  // Walls and floors of the house body
  P(2, Y_GROUND - 1, HOUSE_W - 2, FH + 2, '#241a40')
  P(2, Y_CELLAR - 1, HOUSE_W - 2, FH + 2, '#1a1224')

  // Rooms
  for (const [id, c] of Object.entries(CELLS) as [RoomId, Cell][]) {
    if (c.floor === 'roof' || c.floor === 'outside') continue
    const on = id === current
    const [dark, lit] = WALL[c.floor]
    P(c.x - 1, c.y - 1, c.w + 2, c.h + 2, on ? game.content.heroes[game.hero].color : K)
    P(c.x, c.y, c.w, c.h, on ? lit : dark)
    // A floor line and a little something per room
    P(c.x, c.y + c.h - 2, c.w, 2, on ? '#8a6a50' : '#2a1e1a')
    furnish(P, id, c, s.flags, t, on)
  }
  // The roof slopes over the attic, the walk along the top
  for (let y = roofTop; y < Y_ATTIC + FH + 1; y++) {
    const i = y - roofTop
    const inset = Math.max(0, 18 - Math.round(i * 0.56))
    const xl = 8 + inset
    const xr = 8 + HOUSE_W - 4 - inset
    P(xl - 1, y, 4, 1, K)
    P(xl, y, 3, 1, '#2f8490')
    P(xr - 3, y, 4, 1, K)
    P(xr - 3, y, 3, 1, '#1f5a6a')
    if (y === roofTop) { P(xl, y - 1, xr - xl, 1, K); P(xl, y, xr - xl, 2, '#2f8490') }
  }
  // The conservatory's glass
  const cv = CELLS.conservatory
  for (let x = 0; x < cv.w; x += 5) P(cv.x + x, cv.y, 1, cv.h, '#cfc6ff')
  // The dumbwaiter shaft down the left, a little car on it
  P(8, Y_ATTIC + 6, 3, Y_CELLAR + FH - Y_ATTIC - 8, '#120c20')
  const dw = game.arrived && Object.values(game.arrived).some(v => v !== undefined && game.clock - v < 1.6)
  const carY = Y_GROUND + 8 + Math.round(Math.sin(t * 0.6) * (dw ? 34 : 2))
  P(8, carY, 3, 3, '#ffd23f')

  // Brunhilde at the gate, left of the house, hazards blinking
  const gy = Y_GROUND + FH
  P(-26, gy - 6, 15, 4, '#b0402c')
  P(-25, gy - 9, 10, 3, '#b0402c')
  P(-24, gy - 8, 4, 2, '#26345a')
  P(-19, gy - 8, 3, 2, '#26345a')
  P(-24, gy - 10, 7, 1, '#2e2844')
  P(-24, gy - 2, 3, 2, K)
  P(-15, gy - 2, 3, 2, K)
  const running = s.flags['driveway.car'] === 'running'
  if (running || Math.floor(t * 1.6) % 2 === 0) {
    P(-26, gy - 5, 1, 1, running ? '#ff3040' : '#ffb13f')
    P(-12, gy - 5, 1, 1, running ? '#fff4c0' : '#ffb13f')
  }
  for (let x = -9; x < -1; x += 2) P(x, gy - 10, 1, 10, '#3a3070')
  P(-9, gy - 10, 8, 1, '#3a3070')

  // The house's people as little marks where they are.
  const people: [string, string][] = [['cat', '#ffd23f'], ['bones', '#e8e4d0'], ['hedvig', '#7dffb8'], ['gustav', '#b6ff4a'], ['bat', '#ff5c7a'], ['professor', '#ffffff']]
  for (const [id, col] of people) {
    const a = s.actors[id]
    if (!a || !a.room || !a.visible) continue
    const c = CELLS[a.room]
    if (!c) continue
    const x = spotX(game, a.room, a.x, c)
    const y = c.y + c.h - 5 - (id === 'bat' || id === 'cat' && a.y < 90 ? 12 : 0)
    P(x, y, 2, 2, col)
    if (id === 'hedvig' && Math.floor(t * 2) % 2 === 0) P(x, y - 1, 2, 1, '#baffda')
  }

  // The heroes
  for (const h of HERO_IDS) {
    const a = s.actors[h]
    if (!a || !a.room || !a.visible) continue
    const c = CELLS[a.room]
    if (!c) continue
    const on = h === game.hero
    const hx = spotX(game, a.room, a.x, c) - 3
    const bob = on ? Math.round(Math.sin(t * 5) * 0.8 + 0.2) : 0
    const hy = (c.floor === 'roof' ? c.y + c.h - 11 : c.y + c.h - 11) - bob
    const rows = h === 'espen' && s.flags[F.earsFlop] ? HEAD_FLOP : HEADS[h]
    g.globalAlpha = on ? 1 : 0.8
    if (on) {
      // Outline in his colour
      for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < 7; xx++) {
        if (rows[yy]![xx] === '.') continue
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
          const nx = xx + dx
          const ny = yy + dy
          if (ny < 0 || ny >= rows.length || nx < 0 || nx >= 7 || rows[ny]![nx] === '.') P(hx + nx, hy + ny, 1, 1, game.content.heroes[h].color)
        }
      }
    }
    for (let yy = 0; yy < rows.length; yy++) for (let xx = 0; xx < 7; xx++) {
      const p = rows[yy]![xx]!
      if (p !== '.') P(hx + xx, hy + yy, 1, 1, HEAD_PAL[p]!)
    }
    g.globalAlpha = 1
    if (on) {
      // A little marker above his ears
      const my = hy - 5 + (Math.floor(t * 3) % 2)
      const col = game.content.heroes[h].color
      P(hx + 2, my, 3, 1, col)
      P(hx + 3, my + 1, 1, 1, col)
    }
  }
}

function spotX(game: Game, room: RoomId, x: number, c: Cell): number {
  const w = game.content.rooms[room]?.w ?? 400
  return Math.round(c.x + 4 + Math.max(0, Math.min(1, x / w)) * (c.w - 10))
}

type Paint = (x: number, y: number, w: number, h: number, c: string) => void

/** One or two tell-tale things per room, so the rooms read at a glance. */
function furnish(P: Paint, id: RoomId, c: Cell, flags: Record<string, unknown>, t: number, on: boolean) {
  const x = c.x
  const y = c.y
  const fl = y + c.h - 2
  const win = (wx: number) => { P(wx, y + 5, 5, 7, K); P(wx + 1, y + 6, 3, 5, '#2a3a78'); P(wx + 1, y + 6, 3, 1, '#4a5a98') }
  switch (id) {
    case 'foyer':
      // The grandfather clock, the portrait, the front door, the stairs
      P(x + 6, fl - 18, 5, 18, '#6a4432'); P(x + 7, fl - 16, 3, 3, '#e8e4d0')
      P(x + 14, y + 4, 7, 8, '#ffd23f'); P(x + 15, y + 5, 5, 6, '#7a5aae')
      P(x + 24, fl - 13, 8, 13, '#8c2e72')
      if (flags[F.stairsDown]) for (let i = 0; i < 6; i++) P(x + 38 + i * 2, fl - 2 - i * 3, 4, 2, '#8a6a50')
      else P(x + 40, y, 12, 3, '#8a6a50')
      break
    case 'kitchen':
      P(x + 30, fl - 14, 9, 14, '#dfe8f0'); P(x + 31, fl - 13, 7, 1, '#b0c0d0')
      P(x + 16, fl - 7, 10, 7, '#3a3452')
      win(x + 4)
      break
    case 'parlour':
      P(x + 16, fl - 6, 10, 2, '#6a4432'); P(x + 20, fl - 8, 2, 2, '#7dffb8')
      P(x + 32, fl - 10, 8, 10, '#5a2a2a'); P(x + 34, fl - 5, 4, 3, Math.floor(t * 8) % 2 ? '#ff8a3d' : '#ffd23f')
      break
    case 'conservatory':
      P(x + 8, fl - 5, 6, 5, '#7a3a2a')
      break
    case 'pantry':
      for (let i = 0; i < 3; i++) { P(x + 4, y + 6 + i * 6, 22, 1, '#8a6a50'); for (let j = 0; j < 5; j++) P(x + 5 + j * 4, y + 3 + i * 6, 2, 3, '#c02040') }
      P(x + 30, fl - 8, 7, 8, '#6a4432')
      break
    case 'boiler': {
      const lit = !!flags[F.furnaceLit]
      P(x + 16, fl - 14, 14, 14, '#2a2230'); P(x + 19, fl - 8, 8, 5, lit ? (Math.floor(t * 9) % 2 ? '#ff8a3d' : '#ffd23f') : '#120c18')
      P(x + 22, y, 2, fl - 14 - y, '#5a4a4a')
      break
    }
    case 'lab': {
      P(x + 6, fl - 14, 14, 14, '#8a6a30'); P(x + 8, fl - 12, 10, 4, flags[F.struck] ? '#ffd23f' : '#3fd8b0')
      P(x + 34, fl - 16, 10, 16, '#7ab0c0'); P(x + 35, fl - 15, 8, 14, '#2a4a5a')
      P(x + 25, fl - 9, 1, 9, '#cfc6ff'); P(x + 24, fl - 10 + (flags[F.leverArmed] ? 6 : 0), 3, 2, '#ff3b5c')
      break
    }
    case 'storeroom':
      P(x + 20, fl - 7, 12, 7, '#6a4432'); P(x + 20, fl - 7, 12, 1, '#8a5a40')
      P(x + 40, fl - 12, 5, 12, '#c7a6ff')
      break
    case 'study':
      P(x + 8, fl - 7, 16, 3, '#6a4432'); P(x + 10, fl - 4, 2, 4, '#6a4432'); P(x + 20, fl - 4, 2, 4, '#6a4432')
      win(x + 40)
      if (!flags[F.batFed]) P(x + 42, y + 12, 2, 2, K)
      break
  }
  void on
}
