/**
 * Exits as the renderer sees them (the portal's cabinets, the Hall of Fame
 * board, the kiosk, the terminals, the login console, neon signs, the DJ
 * booths on the beach) and the floating label that names an exit while the hero stands next
 * to it.
 *
 * Static parts are painted once per look/art into cached canvases; screens
 * and neon are drawn live over them. Positions come from `s.map.exits` (tile
 * centres). A solid exit's sprite stands on its tile with its bottom on the
 * tile's bottom edge and may reach up over the tile above, like trees and
 * buildings do. The tile painter leaves those tiles bare (`exitTiles`).
 */
import type { Dir, ExitLook, ExitSpot, GameState, World } from '../types'
import { TILE } from '../types'
import { mapInfo } from '../engine/index'
import { drawText, textWidth, GLYPH_H } from './font'
import { makeCanvas, sprite } from './sheet'
import { PAL } from './sprites'
import type { Light } from './tiles'

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement
const T = TILE

/** A rectangle (view px) that glows by itself: the light map leaves it at full brightness. */
export interface Emit { x: number; y: number; w: number; h: number }

function r(g: G, c: string, x: number, y: number, w = 1, h = 1) {
  g.fillStyle = c
  g.fillRect(x, y, w, h)
}

// ---------------------------------------------------------------------------
// Which tiles carry a drawn exit (the tile painter leaves them bare)
// ---------------------------------------------------------------------------

/** Looks that bring their own sprite and replace the tile's painted object. */
const OWN_SPRITE: ReadonlySet<ExitLook> = new Set<ExitLook>(['cabinet', 'board', 'kiosk', 'terminal', 'console'])
const tileCache = new WeakMap<object, Map<number, ExitLook>>()

/** Tile index → look, for exits whose sprite replaces the tile's object. */
export function exitTiles(world: World, mapId: string): Map<number, ExitLook> {
  const info = mapInfo(world, mapId)
  let m = tileCache.get(info.def)
  if (m) return m
  m = new Map()
  for (const mk of info.marks) {
    const e = mk.ent
    if (e.t === 'exit' && e.look && OWN_SPRITE.has(e.look)) m.set(mk.y * info.w + mk.x, e.look)
  }
  tileCache.set(info.def, m)
  return m
}

// ---------------------------------------------------------------------------
// Cabinets
// ---------------------------------------------------------------------------

const CAB_W = 16
const CAB_H = 28
/** Screen glass, relative to the cabinet's top-left. */
const SCR = { x: 3, y: 10, w: 10, h: 8 }

interface CabStyle {
  body: string; bodyL: string; bodyD: string; trim: string
  /** Marquee: 12×7 pixel map ('.' = background) over per-row background colours. */
  marquee: string[]; bg: string[]
  /** Screen glow colour (light pool). */
  glow: string
}

const M = (...rows: string[]) => rows
const bg7 = (c: string) => [c, c, c, c, c, c, c]

const CABS: Record<string, CabStyle> = {
  figur: {
    // Lag Din Figur, Ulrikke's second: lilac and pink, a figure beside a paint palette.
    body: '#a04ad0', bodyL: '#d08aff', bodyD: '#5e2a86', trim: '#ffd23f', glow: '#ff9ae0',
    bg: ['#c8a8ff', '#cfa8f8', '#d8a8f0', '#e0a8e8', '#e8a8e0', '#f0a8d8', '#f8a8d0'],
    marquee: M(
      '.hhhhh......',
      '.hkskh...y..',
      '.sssss..yyy.',
      'smmmmms..y..',
      '.mmmmm.r.c.l',
      '.bb.bb......',
      '.ww.ww......',
    ),
  },
  miniworld: {
    // Ulrikke's game: the only daylight cabinet in the hall.
    body: '#2f8fe0', bodyL: '#6ac4ff', bodyD: '#1a5aa8', trim: '#ff7ac0', glow: '#7fe0ff',
    bg: ['#4ab8ff', '#5ac0ff', '#6ac8ff', '#7ad0ff', '#8ad8ff', '#9ae0ff', '#5acc8a'],
    // A blocky kid with yellow hair waving beside a little house with a pink roof.
    marquee: M(
      '..yyy...pp..',
      's.yss..pppp.',
      '.msss.pppppp',
      '..mmms.wwww.',
      '..mmm..wcwy.',
      '..b.b..wwwy.',
      '..w.w.......',
    ),
  },
  battery: {
    body: '#3a1a3a', bodyL: '#5e2e5a', bodyD: '#1e0c20', trim: '#ffd23f', glow: '#ffd23f',
    bg: ['#0b0616', '#120a24', '#1a0e30', '#1a0e30', '#1a0e30', '#120a24', '#0b0616'],
    // A lightning bolt striking a car battery.
    marquee: M(
      '..y.........',
      '.y....r...w.',
      '.yy.kgggggg.',
      '..y.kgRRggg.',
      '.y..kgRRggg.',
      'y...kgggggg.',
      '............',
    ),
  },
  anotherworld: {
    body: '#2a1f4a', bodyL: '#43346e', bodyD: '#171030', trim: '#ff8a3d', glow: '#ff8a3d',
    bg: ['#1a0c3a', '#2a1450', '#56206a', '#9a3070', '#e0585a', '#ff9a4a', '#ffc070'],
    marquee: M(
      '..w.........',
      '........ww..',
      '.......wwww.',
      '........ww..',
      '.k..........',
      'kkk......k..',
      'kkkkk..kkkkk',
    ),
  },
  galaga: {
    body: '#1a2f78', bodyL: '#2f4fb0', bodyD: '#0e1a48', trim: '#ffd23f', glow: '#2ff3ff',
    bg: bg7('#07051a'),
    marquee: M(
      '.......w....',
      'b.y.b.....w.',
      'bbybb.......',
      '.ryr....w...',
      '..y....rwr..',
      '.w....wwwww.',
      '......w.b.w.',
    ),
  },
  breakout: {
    body: '#4a1440', bodyL: '#7a2a68', bodyD: '#2a0a24', trim: '#ff3b5c', glow: '#ff5f7a',
    bg: bg7('#0b0616'),
    marquee: M(
      'pp.ppp.ppp.p',
      'rrr.rrr.rrr.',
      '.ooo.ooo.ooo',
      'yyy.yyy.yyy.',
      '........w...',
      '............',
      '....cccc....',
    ),
  },
  rtype: {
    body: '#1c2a44', bodyL: '#34507a', bodyD: '#0e1628', trim: '#2ff3ff', glow: '#2f8fff',
    bg: bg7('#050818'),
    marquee: M(
      '.........w..',
      '.gg.........',
      'gggb........',
      'gWbggcpcccc.',
      'GgggwWwwwwww',
      'GG...cpcccc.',
      '...w......w.',
    ),
  },
  invaders: {
    body: '#10281c', bodyL: '#1f4a32', bodyD: '#06140c', trim: '#b6ff4a', glow: '#b6ff4a',
    bg: bg7('#030a06'),
    marquee: M(
      '...l.....l..',
      '....l...l...',
      '...lllllll..',
      '..ll.lll.ll.',
      '.lllllllllll',
      '.l.lllllll.l',
      '.l.l.....l.l',
    ),
  },
  starfox: {
    body: '#1a2f78', bodyL: '#2f4fb0', bodyD: '#0e1a48', trim: '#fff4ff', glow: '#2f8fff',
    bg: ['#060c30', '#0a1440', '#10205a', '#183078', '#204090', '#1a3070', '#10204a'],
    marquee: M(
      '..w......w..',
      '.....ww.....',
      '.....ww.....',
      '....wbbw....',
      'b..wwwwww..b',
      'bwwwwWWwwwwb',
      '.b...rr...b.',
    ),
  },
  outrun: {
    body: '#3a0f34', bodyL: '#6a1a5a', bodyD: '#1e0619', trim: '#ff2fa0', glow: '#ff2fa0',
    bg: ['#2a0a3a', '#5a1a5a', '#9a2a6a', '#c43a6a', '#0b0616', '#0b0616', '#0b0616'],
    marquee: M(
      '....eyye....',
      '...yyyyyy...',
      '...oooooo...',
      '....pppp....',
      'cccccccccccc',
      '....gwgg....',
      '..ggggwggg..',
    ),
  },
  tetris: {
    body: '#2b1c40', bodyL: '#4a3470', bodyD: '#170e24', trim: '#9a4ff0', glow: '#9a4ff0',
    bg: bg7('#0b0616'),
    marquee: M(
      '....cccc....',
      '............',
      '............',
      'vvvvvv..yyyy',
      '..vv..ooyyyy',
      'llllrrrryyoo',
      'llll..rroooo',
    ),
  },
  newgame: {
    // Petter's house: the machine that wipes the quest. Red, with a restart arrow.
    body: '#4a0f1e', bodyL: '#7a1a30', bodyD: '#2a0610', trim: '#ff3b5c', glow: '#ff3b5c',
    bg: ['#1e0610', '#2a0816', '#3a0a1e', '#3a0a1e', '#3a0a1e', '#2a0816', '#1e0610'],
    marquee: M(
      '...wwwww....',
      '..w.....w...',
      '.w.......w..',
      '.w.......w..',
      '.w.....rrrrr',
      '..w.....rrr.',
      '...www...r..',
    ),
  },
  default: {
    body: '#3b2b62', bodyL: '#5a468e', bodyD: '#221640', trim: '#ff2fa0', glow: '#2ff3ff',
    bg: bg7('#12081e'),
    marquee: M(
      '............',
      '.w...pp...w.',
      '.....pp.....',
      '......g.....',
      '..w...g...w.',
      '...cccccc...',
      '..cCCCCCCc..',
    ),
  },
}

function cabStyle(art?: string): CabStyle {
  return (art && CABS[art]) || CABS.default!
}

const cabCache = new Map<string, Canvas>()

function cabinetCanvas(art?: string): Canvas {
  const key = art && CABS[art] ? art : 'default'
  let c = cabCache.get(key)
  if (c) return c
  const st = cabStyle(art)
  c = makeCanvas(CAB_W, CAB_H)
  const g = c.getContext('2d')!
  const k = PAL.k!
  // Silhouette
  r(g, k, 1, 0, 14, 1); r(g, k, 0, 1, 1, 26); r(g, k, 15, 1, 1, 26); r(g, k, 1, 27, 14, 1)
  // Marquee box: lit panel with the game's logo.
  r(g, st.bodyL, 1, 1, 1, 7); r(g, st.bodyD, 14, 1, 1, 7)
  st.marquee.forEach((row, y) => {
    for (let x = 0; x < 12; x++) {
      const ch = row[x]!
      r(g, ch === '.' ? st.bg[y]! : PAL[ch] ?? st.bg[y]!, 2 + x, 1 + y)
    }
  })
  r(g, st.trim, 1, 8, 14, 1)
  // Screen section: side panels, dark bezel (the glass is drawn live).
  r(g, st.bodyL, 1, 9, 1, 14); r(g, st.body, 14, 9, 1, 14)
  r(g, '#07040f', 2, 9, 12, 10)
  r(g, '#1c1030', 2, 18, 12, 1)
  // Control panel: highlight edge, face, joystick, two buttons.
  r(g, st.bodyL, 1, 19, 14, 1)
  r(g, st.body, 1, 20, 14, 2)
  r(g, st.bodyD, 1, 22, 14, 1)
  r(g, k, 4, 19, 1, 2)
  r(g, '#ff3b5c', 3, 17, 3, 2); r(g, '#ffb0c8', 3, 17, 1, 1); r(g, '#9e1638', 5, 18, 1, 1)
  r(g, st.trim, 8, 20, 2, 1); r(g, '#fff4ff', 11, 20, 2, 1)
  // Lower body and coin door with two lit slots.
  r(g, st.body, 1, 23, 14, 4)
  r(g, st.bodyL, 1, 23, 1, 4)
  r(g, st.bodyD, 14, 23, 1, 4)
  r(g, '#12081e', 5, 23, 6, 4)
  r(g, '#ff8a3d', 6, 24, 1, 2); r(g, '#ff8a3d', 9, 24, 1, 2)
  r(g, st.bodyD, 1, 26, 14, 1)
  // Side-art stripe down the lit side.
  r(g, st.trim, 1, 10, 1, 3)
  cabCache.set(key, c)
  return c
}

/** Tiny attract-mode loop on a cabinet screen. (x, y) is the glass's top-left in view px. */
function drawScreen(g: G, art: string | undefined, x: number, y: number, t: number, seed: number) {
  const W = SCR.w
  const H = SCR.h
  const f = (c: string, px: number, py: number, w = 1, h = 1) => {
    if (px >= W || py >= H || px + w <= 0 || py + h <= 0) return
    const x0 = Math.max(0, px)
    const y0 = Math.max(0, py)
    r(g, c, x + x0, y + y0, Math.min(W, px + w) - x0, Math.min(H, py + h) - y0)
  }
  const tri = (v: number, n: number) => { const p = ((v % (2 * n)) + 2 * n) % (2 * n); return p < n ? p : 2 * n - p }
  switch (art) {
    case 'galaga': {
      f('#05030c', 0, 0, W, H)
      for (let i = 0; i < 5; i++) f(i % 2 ? '#cfc6ff' : '#5a5285', (i * 7 + 2) % W, Math.floor(t * 9 + i * 3.3) % H)
      const bx = 4 + Math.round(Math.sin(t * 2.4 + seed) * 3)
      f('#ffd23f', bx, 1, 2, 1); f('#2f5fd0', bx - 1, 1); f('#2f5fd0', bx + 2, 1); f('#ff3b5c', bx, 2, 2, 1)
      if (Math.floor(t * 4) % 3 === 0) f('#fff4ff', 4, 4)
      f('#fff4ff', 4, 6, 2, 1); f('#fff4ff', 3, 7, 4, 1); f('#ff3b5c', 3, 6); f('#ff3b5c', 6, 6)
      return
    }
    case 'breakout': {
      f('#0b0616', 0, 0, W, H)
      const cols = ['#ff3b5c', '#ff8a3d', '#ffd23f']
      for (let row = 0; row < 3; row++) for (let i = 0; i < 3; i++) if ((i + row + Math.floor(t / 3)) % 5 !== 0) f(cols[row]!, i * 3 + (row % 2), row, 2, 1)
      const ballX = Math.round(tri(t * 7 + seed * 3, 9))
      const ballY = 3 + Math.round(tri(t * 5, 3))
      f('#fff4ff', ballX, ballY)
      f('#2ff3ff', Math.max(0, Math.min(W - 3, ballX - 1)), 7, 3, 1)
      return
    }
    case 'rtype': {
      f('#050818', 0, 0, W, H)
      for (let i = 0; i < 4; i++) f('#5a5285', W - 1 - (Math.floor(t * 10 + i * 4.7) % W), (i * 5 + 1) % H)
      const sy = 3 + Math.round(Math.sin(t * 1.7 + seed))
      f('#8f86b8', 1, sy, 3, 2); f('#2ff3ff', 4, sy, 1, 1); f('#cfc6ff', 2, sy - 1, 1, 1)
      if (Math.floor(t * 3) % 2 === 0) f('#2ff3ff', 5, sy, 5, 1)
      f('#ff2fa0', 7 + (Math.floor(t * 2) % 2), 1, 2, 2)
      return
    }
    case 'invaders': {
      f('#030a06', 0, 0, W, H)
      const off = Math.floor(t * 2 + seed) % 2
      const legs = Math.floor(t * 2 + seed) % 2
      for (let row = 0; row < 2; row++) for (let i = 0; i < 2; i++) {
        const ix = 1 + i * 4 + off
        const iy = row * 3
        const col = row ? '#b6ff4a' : '#fff4ff'
        f(col, ix, iy, 3, 1)
        if (legs) { f(col, ix, iy + 1); f(col, ix + 2, iy + 1) } else f(col, ix + 1, iy + 1)
      }
      const cx = Math.round(tri(t * 3 + seed, 7))
      f('#b6ff4a', cx + 1, 6); f('#b6ff4a', cx, 7, 3, 1)
      if (Math.floor(t * 5) % 3 === 0) f('#fff4ff', cx + 1, 4)
      return
    }
    case 'starfox': {
      f('#1a3a9a', 0, 0, W, 4)
      f('#3f68d0', 0, 3, W, 1)
      f('#123a2a', 0, 4, W, 4)
      for (let i = 0; i < 2; i++) f('#3fd8b0', 0, 4 + Math.floor((t * 6 + i * 2) % 4), W, 1)
      const ax = 3 + Math.round(Math.sin(t * 1.5 + seed) * 2)
      f('#fff4ff', ax + 1, 4, 2, 1); f('#fff4ff', ax, 5, 4, 1); f('#2f5fd0', ax - 1, 5); f('#2f5fd0', ax + 4, 5)
      return
    }
    case 'outrun': {
      f('#5a1a5a', 0, 0, W, 1); f('#9a2a6a', 0, 1, W, 1); f('#e0487a', 0, 2, W, 1); f('#ff8a3d', 0, 3, W, 1)
      f('#ffd23f', 3, 1, 4, 2); f('#ff8a3d', 3, 2, 4, 1)
      f('#0b0616', 0, 4, W, 4)
      f('#3a2a5a', 4, 4, 2, 1); f('#3a2a5a', 3, 5, 4, 1); f('#3a2a5a', 2, 6, 6, 1); f('#3a2a5a', 1, 7, 8, 1)
      const d = Math.floor(t * 8) % 2
      f('#fff4ff', 4 + d, 5 + d, 1, 1); f('#fff4ff', 5 - d, 7 - d, 1, 1)
      f('#ff2fa0', 0, 4, W, 1)
      f('#ff3b5c', 4, 6 + (Math.floor(t * 2) % 2), 2, 1)
      return
    }
    case 'tetris': {
      f('#0b0616', 0, 0, W, H)
      f('#4a3470', 0, 0, 1, H); f('#4a3470', W - 1, 0, 1, H)
      const fall = Math.floor(t * 3 + seed) % 6
      f('#2ff3ff', 3, fall, 3, 1); f('#2ff3ff', 4, fall - 1)
      f('#9a4ff0', 1, 7, 3, 1); f('#ffd23f', 4, 6, 2, 2); f('#b6ff4a', 6, 7, 3, 1); f('#ff3b5c', 7, 6, 2, 1)
      return
    }
    case 'battery': {
      // Villa Voltvik in the storm: a crooked house, one lit window, lightning.
      const strike = (t + seed) % 3.2 < 0.12
      f(strike ? '#8f86b8' : '#0b0616', 0, 0, W, H)
      f('#2a1f4a', 2, 4, 5, 4); f('#2a1f4a', 3, 3, 3, 1); f('#2a1f4a', 4, 2, 1, 1); f('#2a1f4a', 6, 1, 1, 3)
      if (Math.floor(t * 3 + seed) % 5 !== 0) f('#ffd23f', 3, 5)
      f('#ff8a3d', 5, 6)
      if (strike) { f('#fff4ff', 8, 0); f('#fff4ff', 7, 1); f('#fff4ff', 8, 2); f('#fff4ff', 7, 3) }
      if (Math.floor(t * 2) % 2 === 0) f('#ff8a3d', 9, 7)
      return
    }
    case 'figur': {
      // One figure, drawn one way then another: the head goes square, round, square;
      // the top changes colour with each look, and a sparkle marks the switch.
      const look = Math.floor((t + seed) / 1.4) % 4
      const tops = ['#ff7ac0', '#2f8fe0', '#b6ff4a', '#9a4ff0']
      f('#ffe6f6', 0, 0, W, H)
      f('#f4c6ec', 0, 7, W, 1)
      const hx = 3
      if (look % 2 === 0) {
        f('#6a4432', hx, 0, 4, 1); f('#f5c3a8', hx, 1, 4, 2); f('#0b0616', hx + 1, 1); f('#0b0616', hx + 2, 1)
      } else {
        f('#ffd23f', hx, 0, 4, 1); f('#ffd23f', hx - 1, 1, 1, 2); f('#ffd23f', hx + 4, 1, 1, 2)
        f('#f5c3a8', hx, 1, 4, 2); f('#0b0616', hx + 1, 1); f('#0b0616', hx + 2, 1); f('#ff8ae0', hx, 2); f('#ff8ae0', hx + 3, 2)
      }
      f(tops[look]!, hx, 3, 4, 2); f('#f5c3a8', hx - 1, 3, 1, 2); f('#f5c3a8', hx + 4, 3, 1, 2)
      f('#2f5fd0', hx, 5, 1, 2); f('#2f5fd0', hx + 3, 5, 1, 2)
      const since = ((t + seed) % 1.4)
      if (since < 0.35) { f('#fff4ff', 8, 1); f('#ffd23f', 1, 4); f('#fff4ff', 8, 5) }
      return
    }
    case 'miniworld': {
      // Blue sky, a sun, mint grass; a little blocky kid hops onto a pink block and down again.
      f('#5ac8ff', 0, 0, W, 6); f('#5acc8a', 0, 6, W, 2); f('#3fa86e', 0, 7, W, 1)
      f('#ffd84a', 8, 0, 2, 2)
      f('#ff7ac0', 6, 4, 3, 1)
      const kx = Math.round(tri(t * 2 + seed, 6))
      const hop = Math.round(Math.abs(Math.sin(t * 5 + seed)) * 2)
      const feet = kx >= 5 ? 3 : 5
      f('#ffd23f', kx, feet - 2 - hop); f('#ff2fa0', kx, feet - 1 - hop); f('#2f5fd0', kx, feet - hop)
      return
    }
    case 'anotherworld': {
      f('#2a1450', 0, 0, W, 2); f('#6a2070', 0, 2, W, 2); f('#c0405a', 0, 4, W, 1); f('#ff8a3d', 0, 5, W, 1)
      f('#0b0616', 0, 6, W, 2); f('#0b0616', 0, 5, 3, 1); f('#0b0616', 7, 4, 3, 2)
      f('#fff1b0', 7, 1, 2, 1)
      const wx = 2 + (Math.floor(t * 2 + seed) % 4)
      f('#0b0616', wx, 3, 1, 3)
      if (Math.floor(t * 7 + seed) % 23 === 0) f('#fff4ff', 5, 0, 1, 4)
      return
    }
    case 'newgame': {
      // Three hearts go out one by one, a flash, and they are full again.
      const n = Math.floor((t + seed) * 1.5) % 5
      f(n === 4 ? '#ff8ae0' : '#1e0610', 0, 0, W, H)
      for (let i = 0; i < 3; i++) {
        const c = i < 3 - n ? '#ff3b5c' : '#4a1a2a'
        const hx = i * 3 + 1
        f(c, hx, 2); f(c, hx + 2, 2); f(c, hx, 3, 3, 1); f(c, hx + 1, 4)
      }
      if (Math.floor(t * 2) % 2 === 0) f('#fff4ff', 3, 6, 4, 1)
      return
    }
    default: {
      f('#12081e', 0, 0, W, H)
      const cols = ['#ff2fa0', '#ffd23f', '#2ff3ff', '#b6ff4a']
      for (let i = 0; i < 4; i++) f(cols[(i + Math.floor(t * 2)) % 4]!, 1, 1 + i, 8, 1)
      if (Math.floor(t * 2) % 2 === 0) f('#fff4ff', 1, 6, 2, 1)
    }
  }
}

// ---------------------------------------------------------------------------
// Hall of Fame board
// ---------------------------------------------------------------------------

const BOARD_W = 80
const BOARD_H = 32
/** A 3×5 font for the board's rows. */
const MINI: Record<string, string> = {
  '0': '111101101101111', '1': '010110010010111', '2': '111001111100111', '3': '111001011001111',
  '4': '101101111001001', '5': '111100111001111', '6': '111100111101111', '7': '111001010010010',
  '8': '111101111101111', '9': '111101111001111',
  A: '010101111101101', C: '011100100100011', E: '111100110100111', G: '011100101101011',
  H: '101101111101101', K: '101101110101101', N: '110101101101101', P: '110101110100100',
  R: '110101110101101', T: '111010010010010', Z: '111001010100111', S: '011100010001110',
  I: '111010010010111', O: '010101101101010',
  J: '001001001101010', M: '101111111101101', D: '110101101101110',
}

function mini(g: G, text: string, x: number, y: number, color: string) {
  let cx = x
  for (const ch of text) {
    const bits = MINI[ch]
    if (bits) for (let i = 0; i < 15; i++) if (bits[i] === '1') r(g, color, cx + (i % 3), y + Math.floor(i / 3))
    cx += 4
  }
}

let boardC: Canvas | null = null

function boardCanvas(): Canvas {
  if (boardC) return boardC
  const c = makeCanvas(BOARD_W, BOARD_H)
  const g = c.getContext('2d')!
  const k = PAL.k!
  // Frame: dark outline, violet side posts, gold neon edge around a black face.
  r(g, k, 1, 0, BOARD_W - 2, BOARD_H); r(g, k, 0, 1, BOARD_W, BOARD_H - 2)
  r(g, '#3b2b62', 1, 1, 3, BOARD_H - 2); r(g, '#3b2b62', BOARD_W - 4, 1, 3, BOARD_H - 2)
  r(g, '#5a468e', 1, 1, 1, BOARD_H - 2); r(g, '#221640', BOARD_W - 2, 1, 1, BOARD_H - 2)
  r(g, '#0b0616', 5, 1, BOARD_W - 10, BOARD_H - 2)
  r(g, '#ffd23f', 5, 1, BOARD_W - 10, 1)
  r(g, '#c4861c', 5, BOARD_H - 2, BOARD_W - 10, 1)
  r(g, '#c4861c', 4, 1, 1, BOARD_H - 2); r(g, '#c4861c', BOARD_W - 5, 1, 1, BOARD_H - 2)
  // Title
  const title = 'HALL OF FAME'
  const tx = Math.round((BOARD_W - textWidth(title)) / 2)
  drawText(g, title, tx, 3, '#ffd23f', '#b01874')
  r(g, '#ff2fa0', 7, 11, BOARD_W - 14, 1)
  // Three rows: rank, initials, score, in gold / silver / bronze.
  const rows: Array<[string, string, string, string]> = [
    ['1', 'PHA', '98770', '#ffd23f'],
    ['2', 'ACE', '84125', '#cfc6ff'],
    ['3', 'KNG', '61300', '#ff8a3d'],
  ]
  rows.forEach(([rank, name, score, col], i) => {
    const y = 13 + i * 6
    mini(g, rank, 9, y, col)
    mini(g, name, 17, y, '#fff4ff')
    r(g, '#4a3d68', 31, y + 4, 19, 1)
    mini(g, score, 51, y, i === 0 ? '#b6ff4a' : '#2ff3ff')
  })
  boardC = c
  return c
}

// ---------------------------------------------------------------------------
// Kiosk (newsstand)
// ---------------------------------------------------------------------------

const KIOSK_W = 30
const KIOSK_H = 34
let kioskC: Canvas | null = null

function kioskCanvas(): Canvas {
  if (kioskC) return kioskC
  const c = makeCanvas(KIOSK_W, KIOSK_H)
  const g = c.getContext('2d')!
  const k = PAL.k!
  // Header board on the roof with a neon NEWS (the letters are lit live).
  r(g, k, 1, 0, 28, 11); r(g, '#12081e', 2, 1, 26, 9)
  r(g, '#3b2b62', 2, 9, 26, 1)
  // Striped awning, scalloped edge.
  r(g, k, 0, 11, 30, 8)
  for (let x = 1; x < 29; x++) {
    const pink = Math.floor((x - 1) / 4) % 2 === 0
    r(g, pink ? '#ff2fa0' : '#fff4ff', x, 12, 1, 5)
    r(g, pink ? '#b01874' : '#cfc6ff', x, 12, 1, 1)
  }
  for (let x = 1; x < 29; x += 4) {
    const pink = Math.floor((x - 1) / 4) % 2 === 0
    r(g, pink ? '#ff2fa0' : '#fff4ff', x + 1, 17, 2, 1)
    r(g, k, x, 17, 1, 1); r(g, k, x + 3, 17, 1, 1)
  }
  r(g, k, 1, 18, 28, 1)
  // Booth: dark window with warm light, vendor's shelf of papers.
  r(g, k, 1, 18, 28, 16)
  r(g, '#8f86b8', 2, 19, 1, 6); r(g, '#8f86b8', 27, 19, 1, 6)
  r(g, '#3b2b62', 2, 19, 26, 14)
  r(g, '#1c1030', 4, 19, 22, 6)
  r(g, '#ffb13f', 12, 19, 6, 1)
  r(g, '#6a3a1a', 13, 20, 4, 1)
  // Magazines clipped in the window: covers in the site's colours.
  const covers = ['#ff2fa0', '#2ff3ff', '#ffd23f', '#b6ff4a', '#9a4ff0']
  covers.forEach((col, i) => {
    const x = 5 + i * 4
    r(g, col, x, 21, 3, 4)
    r(g, '#fff4ff', x, 22, 3, 1)
    r(g, '#0b0616', x + 1, 23, 1, 1)
  })
  // Counter with stacks of newspapers.
  r(g, '#8e5566', 1, 25, 28, 2)
  r(g, '#b8768a', 1, 25, 28, 1)
  for (let i = 0; i < 3; i++) {
    const x = 3 + i * 9
    r(g, '#8f86b8', x, 28, 7, 4)
    r(g, '#cfc6ff', x, 27, 7, 4)
    r(g, '#fff4ff', x, 27, 7, 1)
    r(g, '#0b0616', x + 1, 28, 3, 1)
    r(g, '#8f86b8', x + 1, 29, 5, 1)
    r(g, '#8f86b8', x + 1, 30, 4, 1)
    r(g, '#ff2fa0', x + 5, 28, 1, 1)
  }
  r(g, '#271c46', 2, 32, 26, 1)
  kioskC = c
  return c
}

// ---------------------------------------------------------------------------
// Terminal (desk + CRT)
// ---------------------------------------------------------------------------

const TERM_W = 16
const TERM_H = 24
let termC: Canvas | null = null

function terminalCanvas(): Canvas {
  if (termC) return termC
  const c = makeCanvas(TERM_W, TERM_H)
  const g = c.getContext('2d')!
  const k = PAL.k!
  // Desk
  r(g, k, 0, 13, 16, 11)
  r(g, '#8e5566', 1, 14, 14, 2)
  r(g, '#b8768a', 1, 14, 14, 1)
  r(g, '#472536', 1, 16, 14, 1)
  r(g, '#6e3d4e', 1, 17, 14, 6)
  r(g, '#472536', 1, 17, 2, 6); r(g, '#472536', 13, 17, 2, 6)
  r(g, '#12081e', 3, 17, 10, 6)
  r(g, '#ffd23f', 7, 19, 2, 1) // drawer handle
  // CRT casing
  r(g, k, 2, 0, 12, 14)
  r(g, '#cfc6ff', 3, 1, 10, 12)
  r(g, '#fff4ff', 3, 1, 10, 1)
  r(g, '#8f86b8', 3, 11, 10, 2)
  r(g, '#5a5285', 12, 2, 1, 9)
  r(g, '#0b0616', 4, 2, 8, 8)
  r(g, '#b6ff4a', 10, 11, 1, 1) // power LED
  // Keyboard on the desk top
  r(g, '#5a5285', 3, 14, 10, 2)
  r(g, '#8f86b8', 4, 14, 8, 1)
  termC = c
  return c
}

/** A terminal's screen art by `art`: the link it opens. (x, y) = glass top-left, 6×6. */
function drawTerminalScreen(g: G, art: string | undefined, x: number, y: number, t: number) {
  switch (art) {
    case 'linkedin':
      r(g, '#2f6fd8', x, y, 6, 6)
      r(g, '#fff4ff', x + 1, y + 1); r(g, '#fff4ff', x + 1, y + 3, 1, 2)
      r(g, '#fff4ff', x + 3, y + 3, 1, 2); r(g, '#fff4ff', x + 4, y + 3); r(g, '#fff4ff', x + 5, y + 4)
      return
    case 'github':
      r(g, '#161022', x, y, 6, 6)
      r(g, '#fff4ff', x, y, 1, 2); r(g, '#fff4ff', x + 5, y, 1, 2)
      r(g, '#fff4ff', x, y + 2, 6, 3); r(g, '#fff4ff', x + 1, y + 1, 4, 1); r(g, '#fff4ff', x + 1, y + 5, 4, 1)
      r(g, '#161022', x + 1, y + 3); r(g, '#161022', x + 4, y + 3)
      return
    case 'bluesky':
      r(g, '#3fa8ff', x, y, 6, 6)
      r(g, '#fff4ff', x, y + 1, 2, 2); r(g, '#fff4ff', x + 4, y + 1, 2, 2)
      r(g, '#fff4ff', x + 1, y + 3, 1, 1); r(g, '#fff4ff', x + 4, y + 3, 1, 1)
      r(g, '#fff4ff', x + 2, y + 2, 2, 2)
      return
    default: {
      r(g, '#0a2a2a', x, y, 6, 6)
      for (let i = 0; i < 3; i++) r(g, '#2ff3ff', x + 1, y + 1 + i * 2, 1 + ((i * 3 + Math.floor(t * 2)) % 4), 1)
      if (Math.floor(t * 2) % 2 === 0) r(g, '#fff4ff', x + 4, y + 5)
    }
  }
}

const TERM_GLOW: Record<string, string> = { linkedin: '#2f8fff', github: '#cfc6ff', bluesky: '#3fa8ff' }

// ---------------------------------------------------------------------------
// Login console (Sleeper, Petter's server, standing in his house)
// ---------------------------------------------------------------------------

const CON_W = 16
const CON_H = 28
/** The console's glass, relative to its top-left. */
const CON_SCR = { x: 3, y: 4, w: 10, h: 8 }
let conC: Canvas | null = null

/** A tall violet tower: a screen in a deep bezel, a keyboard ledge, a vented rack with status lights, a pink neon cap. */
function consoleCanvas(): Canvas {
  if (conC) return conC
  const c = makeCanvas(CON_W, CON_H)
  const g = c.getContext('2d')!
  const k = PAL.k!
  // Tower
  r(g, k, 1, 0, 14, 28)
  r(g, '#4f3c7e', 2, 1, 12, 26)
  r(g, '#5f4c92', 2, 1, 12, 1)
  r(g, '#6f5ca6', 2, 2, 1, 24)
  r(g, '#271c46', 13, 2, 1, 25)
  // Neon cap
  r(g, '#ff2fa0', 3, 1, 10, 1)
  // Bezel around the glass
  r(g, k, 2, 3, 12, 10)
  r(g, '#1a1030', 3, 4, 10, 8)
  // Keyboard ledge, sticking out a pixel each side
  r(g, k, 0, 13, 16, 4)
  r(g, '#8f86b8', 1, 14, 14, 1)
  r(g, '#5a5285', 1, 15, 14, 1)
  for (let i = 0; i < 6; i++) r(g, '#cfc6ff', 2 + i * 2, 14, 1, 1)
  // Rack: vents and a drive slot
  r(g, '#271c46', 3, 18, 7, 1)
  r(g, '#0b0616', 3, 25, 7, 1)
  r(g, '#271c46', 10, 18, 3, 8)
  // A sleeper's Z on the front
  r(g, '#b9a8d9', 4, 20, 4, 1); r(g, '#b9a8d9', 6, 21); r(g, '#b9a8d9', 5, 22); r(g, '#b9a8d9', 4, 23, 4, 1)
  // Feet
  r(g, k, 2, 27, 3, 1); r(g, k, 11, 27, 3, 1)
  conC = c
  return c
}

/** The console's live screen: a login prompt with a blinking block cursor. (x, y) = glass top-left. */
function drawConsoleScreen(g: G, x: number, y: number, t: number, reduced: boolean) {
  const { w, h } = CON_SCR
  r(g, '#0a2a2a', x, y, w, h)
  // Three lines of boot text, then the prompt.
  r(g, '#2ff3ff', x + 1, y + 1, 6, 1)
  r(g, '#1f9aa8', x + 1, y + 3, 4, 1); r(g, '#1f9aa8', x + 6, y + 3, 2, 1)
  r(g, '#b6ff4a', x + 1, y + 5, 1, 1)
  r(g, '#2ff3ff', x + 3, y + 5, 3, 1)
  if (reduced || Math.floor(t * 1.8) % 2 === 0) r(g, '#fff4ff', x + 7, y + 5, 1, 2)
  // Corners of the glass, a highlight.
  r(g, '#1a1030', x, y); r(g, '#1a1030', x + w - 1, y); r(g, '#1a1030', x, y + h - 1); r(g, '#1a1030', x + w - 1, y + h - 1)
  g.fillStyle = 'rgba(255,255,255,0.22)'
  g.fillRect(x + 1, y, 3, 1)
}

/** Status lights on the rack, each on its own beat. (x, y) = the rack's light column top. */
function drawConsoleLeds(g: G, x: number, y: number, t: number, reduced: boolean) {
  const on = (rate: number, phase: number) => reduced || Math.sin(t * rate + phase) > -0.3
  r(g, on(2.1, 0) ? '#b6ff4a' : '#2a4a1a', x, y)
  r(g, on(5.3, 1) ? '#2ff3ff' : '#123a44', x, y + 2)
  r(g, on(0.9, 2) ? '#ff2fa0' : '#4a1036', x, y + 4)
}

// ---------------------------------------------------------------------------
// DJ booths on the beach (the mixer leads to Jam, the records to the radio)
// ---------------------------------------------------------------------------

/**
 * Three tiles wide: a speaker stack on each side tile, the table on the exit
 * tile with the DJ behind it, waist up. Everything moves on one beat, the
 * same 2 Hz the crowd dances to.
 */
const BOOTH_W = 48
const SPK_H = 26
const TABLE_TOP = 14
const BEAT = 2

interface BoothStyle { glow: string; alt: string; word: string; dj: string }
const BOOTHS: Record<string, BoothStyle> = {
  mixer: { glow: '#2ff3ff', alt: '#ff2fa0', word: 'JAM', dj: 'dj_mixer' },
  records: { glow: '#ffd23f', alt: '#ff2fa0', word: 'RADIO', dj: 'dj_records' },
}
const boothStyle = (art?: string) => BOOTHS[art ?? ''] ?? BOOTHS.records!

let speakerC: Canvas | null = null

/** One speaker stack: a big cabinet with the woofer, a small one on top with the tweeter. */
function speakerCanvas(): Canvas {
  if (speakerC) return speakerC
  const c = makeCanvas(12, SPK_H)
  const g = c.getContext('2d')!
  const k = PAL.k!
  r(g, k, 0, 0, 12, SPK_H)
  r(g, '#2a1f4a', 1, 1, 10, 9)
  r(g, '#2a1f4a', 1, 11, 10, 14)
  r(g, '#3b2b62', 1, 1, 10, 1); r(g, '#3b2b62', 1, 11, 10, 1)
  // Tweeter, woofer rims (the cones are live).
  r(g, '#140a22', 4, 3, 4, 4)
  r(g, '#140a22', 2, 14, 8, 8); r(g, '#140a22', 3, 13, 6, 10); r(g, '#140a22', 1, 15, 10, 6)
  r(g, '#5a5285', 2, 23, 8, 1)
  return (speakerC = c)
}

function drawSpeaker(g: G, x: number, bottom: number, pump: number, glow: string) {
  const top = bottom - SPK_H
  g.drawImage(speakerCanvas(), x, top)
  // The woofer punches out on the beat.
  const rad = 2 + pump
  r(g, '#3a2c66', x + 6 - rad, top + 18 - rad, rad * 2, rad * 2)
  r(g, '#5b4b8e', x + 5, top + 17, 2, 2)
  r(g, '#0b0616', x + 5, top + 18, 1, 1)
  r(g, glow, x + 5, top + 4, 2, 2)
}

/** The table: a lit front panel with the booth's word, the kit on top. (left, bottom) = the table's corner. */
function drawTable(g: G, st: BoothStyle, art: string | undefined, left: number, bottom: number, t: number, beat: number, reduced: boolean) {
  const k = PAL.k!
  const w = 24
  const top = bottom - TABLE_TOP
  // Top surface and front.
  r(g, k, left, top, w, TABLE_TOP)
  r(g, '#4f3c7e', left + 1, top + 1, w - 2, 3)
  r(g, '#271c46', left + 1, top + 4, w - 2, TABLE_TOP - 5)
  r(g, st.glow, left + 1, top + 4, w - 2, 1)
  const word = st.word
  const tw = word.length * 4 - 1
  mini(g, word, left + Math.round((w - tw) / 2), top + 6, beat ? st.glow : st.alt)
  if (art === 'mixer') {
    // Two CD decks with a spinning mark, a mixer between them with bouncing levels.
    for (const dx of [2, 16]) {
      r(g, '#140a22', left + dx, top + 1, 6, 3)
      const a = reduced ? 0 : Math.floor(t * 8 + dx) % 4
      r(g, '#cfc6ff', left + dx + 1 + (a % 2) * 3, top + 1 + (a >> 1), 1, 1)
    }
    r(g, '#140a22', left + 9, top + 1, 6, 3)
    for (let i = 0; i < 4; i++) {
      const lv = reduced ? 1 : Math.floor((Math.sin(t * 9 + i * 1.7) + 1) * 1.5)
      r(g, i % 2 ? st.alt : '#b6ff4a', left + 10 + i, top + 3 - Math.min(2, lv), 1, 1 + Math.min(2, lv))
    }
  } else {
    // Two turntables: a black disc with a turning shine, a tonearm.
    for (const dx of [2, 13]) {
      r(g, '#8f86b8', left + dx, top + 1, 9, 3)
      r(g, '#0b0616', left + dx + 1, top + 1, 6, 3)
      const a = reduced ? 0 : Math.floor(t * 6 + dx) % 4
      r(g, '#5a5285', left + dx + 2 + a, top + 2, 1, 1)
      r(g, '#ff2fa0', left + dx + 3, top + 2, 2, 1)
      r(g, '#cfc6ff', left + dx + 7, top + 1, 1, 2)
    }
  }
}

// ---------------------------------------------------------------------------
// Per-look geometry: sprite size and where its top edge sits (for the label).
// ---------------------------------------------------------------------------

/** Height (px) the look rises above its tile's bottom edge. */
function lookTop(look: ExitLook): number {
  switch (look) {
    case 'cabinet': return CAB_H
    case 'board': return BOARD_H
    case 'kiosk': return KIOSK_H
    case 'terminal': return TERM_H
    case 'console': return CON_H
    case 'sign': return 14
    case 'booth': return SPK_H
    default: return T + 2
  }
}

// ---------------------------------------------------------------------------
// Drawing
// ---------------------------------------------------------------------------

interface SortItem { y: number; draw: () => void }

/**
 * Queue every visible exit's sprite into the y-sorted list and collect its
 * lights and emissive rects. (cx, cy) camera px; `t` is the animation clock
 * (frozen with reduced motion).
 */
export function queueExits(
  g: G, exits: readonly ExitSpot[], cx: number, cy: number, vw: number, vh: number,
  t: number, reduced: boolean, items: SortItem[], lights: Light[], emit: Emit[],
) {
  for (const e of exits) {
    const px = Math.round(e.x * T - cx)
    const bottom = Math.round((e.y + 0.5) * T - cy)
    if (px < -48 || px > vw + 48 || bottom < -8 || bottom > vh + 48) continue
    const seed = (e.x * 7 + e.y * 13) % 5
    switch (e.look) {
      case 'cabinet': {
        const st = cabStyle(e.art)
        const left = px - CAB_W / 2
        const top = bottom - CAB_H
        // Soft CRT flicker: mostly steady, with a rare dip.
        const flick = reduced ? 1 : 0.9 + 0.06 * Math.sin(t * 13 + seed) + (Math.sin(t * 0.7 + seed * 2) > 0.985 ? -0.25 : 0.04)
        items.push({
          y: e.y + 0.5,
          draw: () => {
            g.fillStyle = 'rgba(8,4,20,0.45)'
            g.fillRect(left + 1, bottom - 1, CAB_W - 2, 2)
            g.drawImage(cabinetCanvas(e.art), left, top)
            const sx = left + SCR.x
            const sy = top + SCR.y
            drawScreen(g, e.art, sx, sy, t, seed)
            // Glass: rounded corners, a highlight, a slow rolling scan band, flicker.
            g.fillStyle = '#07040f'
            g.fillRect(sx, sy, 1, 1); g.fillRect(sx + SCR.w - 1, sy, 1, 1)
            g.fillRect(sx, sy + SCR.h - 1, 1, 1); g.fillRect(sx + SCR.w - 1, sy + SCR.h - 1, 1, 1)
            g.fillStyle = 'rgba(255,255,255,0.22)'
            g.fillRect(sx + 1, sy, 3, 1)
            if (!reduced) {
              g.fillStyle = 'rgba(255,255,255,0.10)'
              g.fillRect(sx, sy + (Math.floor(t * 5 + seed) % (SCR.h + 4)) - 2, SCR.w, 1)
            }
            if (flick < 1) {
              g.globalAlpha = Math.min(0.6, (1 - flick) * 1.2)
              g.fillStyle = '#07040f'
              g.fillRect(sx, sy, SCR.w, SCR.h)
              g.globalAlpha = 1
            }
          },
        })
        emit.push({ x: left + 2, y: top + 1, w: 12, h: 7 }, { x: left + SCR.x, y: top + SCR.y, w: SCR.w, h: SCR.h })
        lights.push(
          { x: e.x, y: e.y + 0.95, r: 1.9, color: st.glow, a: 0.5 * flick },
          { x: e.x, y: e.y - 0.35, r: 1.2, color: st.glow, a: 0.55 * flick },
          { x: e.x, y: e.y - 0.95, r: 1, color: st.trim, a: 0.4 },
        )
        break
      }
      case 'board': {
        const left = px - BOARD_W / 2
        const top = bottom - BOARD_H
        // Wall-mounted: anything standing on its row passes in front of it.
        items.push({
          y: e.y - 0.5,
          draw: () => {
            g.drawImage(boardCanvas(), left, top)
            // A slow shimmer down the rows, like a live board refreshing.
            if (!reduced) {
              const row = Math.floor(t * 1.5) % 3
              g.globalAlpha = 0.35
              g.fillStyle = '#fff4ff'
              g.fillRect(left + 7, top + 13 + row * 6, BOARD_W - 14, 5)
              g.globalAlpha = 1
            }
          },
        })
        emit.push({ x: left + 4, y: top + 1, w: BOARD_W - 8, h: BOARD_H - 2 })
        lights.push(
          { x: e.x, y: e.y - 1.3, r: 3.2, color: '#ffd23f', a: 0.55 },
          { x: e.x - 1.6, y: e.y - 1.1, r: 1.8, color: '#ff2fa0', a: 0.35 },
          { x: e.x + 1.6, y: e.y - 1.1, r: 1.8, color: '#2ff3ff', a: 0.35 },
          { x: e.x, y: e.y + 0.9, r: 2.6, color: '#ffd23f', a: 0.35 },
        )
        break
      }
      case 'kiosk': {
        const left = px - KIOSK_W / 2
        const top = bottom - KIOSK_H
        const on = reduced || Math.sin(t * 1.1 + seed) > -0.96
        items.push({
          y: e.y + 0.5,
          draw: () => {
            g.fillStyle = 'rgba(8,4,20,0.45)'
            g.fillRect(left + 1, bottom - 1, KIOSK_W - 2, 2)
            g.drawImage(kioskCanvas(), left, top)
            drawText(g, 'NEWS', left + Math.round((KIOSK_W - textWidth('NEWS')) / 2), top + 2, on ? '#2ff3ff' : '#1a4a5a')
          },
        })
        emit.push({ x: left + 4, y: top + 1, w: KIOSK_W - 8, h: 9 }, { x: left + 4, y: top + 19, w: KIOSK_W - 8, h: 6 })
        lights.push(
          { x: e.x, y: e.y - 1.6, r: 2, color: '#2ff3ff', a: on ? 0.6 : 0.2 },
          { x: e.x, y: e.y - 0.4, r: 2.4, color: '#ffb13f', a: 0.55 },
          { x: e.x, y: e.y + 1, r: 2, color: '#ff2fa0', a: 0.35 },
        )
        break
      }
      case 'terminal': {
        const left = px - TERM_W / 2
        const top = bottom - TERM_H
        const glow = (e.art && TERM_GLOW[e.art]) || '#2ff3ff'
        items.push({
          y: e.y + 0.5,
          draw: () => {
            g.fillStyle = 'rgba(8,4,20,0.4)'
            g.fillRect(left + 1, bottom - 1, TERM_W - 2, 2)
            g.drawImage(terminalCanvas(), left, top)
            drawTerminalScreen(g, e.art, left + 5, top + 3, t)
            g.fillStyle = 'rgba(255,255,255,0.25)'
            g.fillRect(left + 5, top + 3, 2, 1)
          },
        })
        emit.push({ x: left + 5, y: top + 3, w: 6, h: 6 })
        lights.push(
          { x: e.x, y: e.y - 0.6, r: 1.4, color: glow, a: 0.6 },
          { x: e.x, y: e.y + 0.8, r: 1.8, color: glow, a: 0.35 },
        )
        break
      }
      case 'console': {
        const left = px - CON_W / 2
        const top = bottom - CON_H
        items.push({
          y: e.y + 0.5,
          draw: () => {
            g.fillStyle = 'rgba(8,4,20,0.45)'
            g.fillRect(left + 1, bottom - 1, CON_W - 2, 2)
            g.drawImage(consoleCanvas(), left, top)
            drawConsoleScreen(g, left + CON_SCR.x, top + CON_SCR.y, t, reduced)
            drawConsoleLeds(g, left + 11, top + 19, t, reduced)
          },
        })
        emit.push({ x: left + CON_SCR.x, y: top + CON_SCR.y, w: CON_SCR.w, h: CON_SCR.h }, { x: left + 3, y: top + 1, w: 10, h: 1 }, { x: left + 11, y: top + 19, w: 1, h: 5 })
        lights.push(
          { x: e.x, y: e.y - 0.7, r: 1.6, color: '#2ff3ff', a: 0.6 },
          { x: e.x, y: e.y + 0.8, r: 1.9, color: '#2ff3ff', a: 0.35 },
          { x: e.x, y: e.y - 1.3, r: 0.9, color: '#ff2fa0', a: 0.35 },
        )
        break
      }
      case 'sign': {
        // The painted sign, edged in neon.
        const a = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 3 + seed)
        const sx = px - 6
        const sy = bottom - 13
        items.push({
          y: e.y - 0.49,
          draw: () => {
            g.globalAlpha = a
            g.fillStyle = '#ff2fa0'
            g.fillRect(sx, sy, 12, 1); g.fillRect(sx, sy + 7, 12, 1)
            g.fillStyle = '#2ff3ff'
            g.fillRect(sx - 1, sy + 1, 1, 6); g.fillRect(sx + 12, sy + 1, 1, 6)
            g.globalAlpha = 1
          },
        })
        emit.push({ x: sx - 1, y: sy, w: 14, h: 8 })
        lights.push({ x: e.x, y: e.y - 0.4, r: 2.2, color: '#ff2fa0', a: 0.5 * a })
        break
      }
      case 'booth': {
        const st = boothStyle(e.art)
        const left = px - BOOTH_W / 2
        const beat = reduced ? 0 : Math.floor(t * BEAT) % 2
        const pump = reduced ? 1 : Math.max(0, 2 - Math.floor((t * BEAT % 1) * 6))
        items.push({
          y: e.y + 0.5,
          draw: () => {
            g.fillStyle = 'rgba(8,4,20,0.45)'
            g.fillRect(left + 2, bottom - 1, BOOTH_W - 4, 2)
            // The DJ stands behind the table, feet hidden by it.
            const dj = sprite(`${st.dj}_${beat}`)
            g.drawImage(dj, px - dj.width / 2, bottom - 8 - dj.height)
            drawTable(g, st, e.art, px - 12, bottom, t, beat, reduced)
            drawSpeaker(g, left + 1, bottom, pump, st.glow)
            drawSpeaker(g, left + BOOTH_W - 13, bottom, pump, st.alt)
          },
        })
        emit.push({ x: px - 11, y: bottom - TABLE_TOP + 4, w: 22, h: 8 }, { x: left + 6, y: bottom - SPK_H + 4, w: 2, h: 2 }, { x: left + BOOTH_W - 7, y: bottom - SPK_H + 4, w: 2, h: 2 })
        // Party lights: two pools on the sand that swap colour on the beat, a glow over the DJ.
        lights.push(
          { x: e.x - 1.2, y: e.y + 1.3, r: 2.4, color: beat ? st.glow : st.alt, a: 0.55 },
          { x: e.x + 1.2, y: e.y + 1.3, r: 2.4, color: beat ? st.alt : st.glow, a: 0.55 },
          { x: e.x, y: e.y - 0.9, r: 2, color: st.glow, a: 0.5 },
        )
        break
      }
      default:
        break
    }
  }
}

// ---------------------------------------------------------------------------
// The label prompt
// ---------------------------------------------------------------------------

const DIRV: Record<Dir, { x: number; y: number }> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }

export interface LabelState { alpha: Map<string, number> }
export function createLabels(): LabelState { return { alpha: new Map() } }

/** The exit the hero is at, if any: next to a door, or facing a solid exit. */
function nearExit(s: GameState): ExitSpot | null {
  const h = s.hero
  let best: ExitSpot | null = null
  let bestD = Infinity
  for (const e of s.map.exits ?? []) {
    if (!e.label) continue
    const dx = e.x - h.x
    const dy = e.y - h.y
    const d = Math.hypot(dx, dy)
    if (e.walk) {
      if (d > 1.6) continue
    } else {
      if (d > 1.3) continue
      const v = DIRV[h.dir]
      if (d > 0.01 && (v.x * dx + v.y * dy) / d < 0.5) continue
    }
    if (d < bestD) { bestD = d; best = e }
  }
  return best
}

/**
 * Fade labels in and out and draw them on the HUD layer (logical px): the
 * exit's name and the A key, on a small plate above the exit.
 */
export function drawExitLabels(
  g: G, s: GameState, st: LabelState, cx: number, cy: number, vw: number, vh: number,
  dt: number, keyA: string, reduced: boolean, show: boolean, minY = 2,
) {
  const near = show && s.mode === 'play' ? nearExit(s) : null
  const exits = s.map.exits ?? []
  for (const e of exits) {
    if (!e.label) continue
    const cur = st.alpha.get(e.id) ?? 0
    const target = near === e ? 1 : 0
    const next = target > cur ? Math.min(1, cur + dt * 7) : Math.max(0, cur - dt * 5)
    if (next === 0 && cur === 0) continue
    st.alpha.set(e.id, next)
    if (next <= 0) continue
    const text = e.label.toUpperCase()
    const key = keyA.toUpperCase()
    const tw = textWidth(text)
    const kw = textWidth(key)
    const w = 4 + tw + 3 + 2 + 3 + kw + 4
    const h = GLYPH_H + 6
    const ax = Math.round(e.x * T - cx)
    const topPx = e.walk ? (e.y - 0.5) * T - 2 : (e.y + 0.5) * T - lookTop(e.look)
    const lift = reduced ? 0 : Math.round((1 - next) * 3)
    let y = Math.round(topPx - cy) - h - 5 + lift
    // No room above (a tall look at the top of the view, or the HUD there): show it under the hero instead.
    const below = y < minY
    if (below) y = Math.round((s.hero.y + 0.5) * T - cy) + 4 - lift
    let x = ax - Math.round(w / 2)
    x = Math.max(2, Math.min(vw - w - 2, x))
    y = Math.max(2, Math.min(vh - h - 2, y))
    g.globalAlpha = next
    // Plate with a pink underline and a pointer notch.
    g.fillStyle = 'rgba(11,6,22,0.86)'
    g.fillRect(x, y, w, h)
    g.fillStyle = '#ff2fa0'
    g.fillRect(x, y + h, w, 1)
    const nx = Math.max(x + 3, Math.min(x + w - 4, ax))
    if (!below) {
      g.fillStyle = 'rgba(11,6,22,0.86)'
      g.fillRect(nx - 2, y + h + 1, 5, 1)
      g.fillRect(nx - 1, y + h + 2, 3, 1)
      g.fillStyle = '#ff2fa0'
      g.fillRect(nx, y + h + 3, 1, 1)
    }
    g.fillStyle = 'rgba(47,243,255,0.4)'
    g.fillRect(x, y, w, 1)
    let tx = x + 4
    drawText(g, text, tx, y + 3, '#fff4ff', '#3a1a4a')
    tx += tw + 3
    drawText(g, '·', tx, y + 3, '#ff2fa0')
    tx += 2 + 3
    drawText(g, key, tx, y + 3, '#2ff3ff', '#0b3a4a')
    g.globalAlpha = 1
  }
}
