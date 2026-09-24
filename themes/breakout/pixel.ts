/**
 * Breakout in Neon Shrine's pixel look (2026-09-24): a shrine chamber seen
 * from above. Dungeon floor tiles with a faint neon sigil, thin walls with
 * a pink neon strip, braziers on the side walls that light the room, and a
 * dark pit under the paddle. Bricks are shrine stone (armoured, gold or
 * pink neon strip, cracking as they take hits) and crystals (pink, violet,
 * teal by row). The ball is a glowing orb, the paddle the hero's cyan
 * shield bar. Everything here is in logical pixels; `Breakout.vue` keeps
 * the rules in CSS pixels and converts.
 */
import { makeCanvas, type PixelStage } from '../base/pixel/stage'
import { drawText, sprite } from '../base/pixel/sprites'
import { hash2, rect } from '../base/pixel/scenery'

type G = CanvasRenderingContext2D

/** Neon Shrine's dungeon colours (`themes/zelda/render/tiles.ts` DG). */
export const DG = {
  floor: '#2b2553', floorL: '#332c61', grout: '#201a40', crack: '#1a1535',
  top: '#1f1a3c', topL: '#2c2552', face: '#3a2f70', faceL: '#4a3d88', faceD: '#271f50',
  neon: '#ff3fae', neonC: '#3ff0ff', moss: '#3fd8b0',
}

// ---------------------------------------------------------------- bricks

export interface CrystalLook { body: string; hi: string; lo: string; glint: string; glow: string }

/** Crystal colours by row band: pink, violet, teal. */
export const CRYSTALS: CrystalLook[] = [
  { body: '#ff2fa0', hi: '#ff8ae0', lo: '#b01874', glint: '#fff4ff', glow: '#ff2fa0' },
  { body: '#9a4ff0', hi: '#c8a0ff', lo: '#54259e', glint: '#fff4ff', glow: '#9a4ff0' },
  { body: '#3fd8b0', hi: '#9ff5dc', lo: '#1f7a6e', glint: '#fff4ff', glow: '#3fd8b0' },
]

/** Particle colour for a crystal row (the rules' `b.color`). */
export function crystalColor(row: number): string {
  return CRYSTALS[Math.floor(row / 3) % CRYSTALS.length]!.body
}

const brickCache = new Map<string, HTMLCanvasElement>()

/**
 * A brick w×h logical pixels. `kind` 'crystal' uses `row` for its colour;
 * 'stone' is armoured, `strip` its neon colour; `dmg` hits taken so far
 * add cracks.
 */
export function brickCanvas(w: number, h: number, kind: 'crystal' | 'stone', row: number, strip: string, dmg: number): HTMLCanvasElement {
  w = Math.max(4, w); h = Math.max(3, h)
  const key = `${w}x${h}:${kind}:${row % 9}:${strip}:${dmg}`
  let c = brickCache.get(key)
  if (c) return c
  c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  if (kind === 'crystal') {
    const L = CRYSTALS[Math.floor(row / 3) % CRYSTALS.length]!
    rect(g, '#0b0616', 0, 0, w, h)
    rect(g, L.body, 1, 1, w - 2, h - 2)
    rect(g, L.hi, 1, 1, w - 2, 1)
    rect(g, L.hi, 1, 1, 1, h - 2)
    rect(g, L.lo, 1, h - 2, w - 2, 1)
    rect(g, L.lo, w - 2, 1, 1, h - 2)
    // A short facet highlight at the left and a glint; the right half darker.
    rect(g, L.lo, Math.round(w * 0.6), 2, w - 3 - Math.round(w * 0.6), h - 4)
    rect(g, L.body, Math.round(w * 0.6), 2, 1, h - 4)
    for (let i = 0; i < Math.min(3, h - 3); i++) rect(g, L.hi, 3 + i, 2 + i, 2, 1)
    rect(g, L.glint, 2, 2, 1, 1)
  } else {
    rect(g, '#0b0616', 0, 0, w, h)
    rect(g, '#5a4c9c', 1, 1, w - 2, h - 2)
    rect(g, '#7a6cc0', 1, 1, w - 2, 1)
    rect(g, '#7a6cc0', 1, 1, 1, h - 2)
    rect(g, DG.faceD, 1, h - 2, w - 2, 1)
    rect(g, DG.faceD, w - 2, 1, 1, h - 2)
    // Mortar: a vertical joint off-centre.
    const j = Math.round(w * (0.35 + (row % 2) * 0.3))
    rect(g, DG.faceD, j, 2, 1, h - 4)
    rect(g, '#7a6cc0', j + 1, 2, 1, h - 4)
    // Neon strip across the face.
    const sy = Math.max(2, Math.floor(h / 2))
    rect(g, strip, 2, sy, w - 4, 1)
    // Rivets.
    rect(g, '#b8a8e8', 2, h - 3, 1, 1)
    rect(g, '#b8a8e8', w - 3, h - 3, 1, 1)
  }
  if (dmg > 0) {
    // Cracks: a jagged dark line per hit, from a hashed start.
    g.fillStyle = '#0b0616'
    for (let d = 0; d < dmg; d++) {
      let x = 2 + Math.floor(hash2(w, d, row) * (w - 4))
      for (let y = 1; y < h - 1; y++) {
        g.fillRect(x, y, 1, 1)
        x += hash2(x, y, d + 3) > 0.5 ? 1 : -1
        x = Math.max(1, Math.min(w - 2, x))
        if (hash2(x, y, d + 9) > 0.7) g.fillRect(x + 1, y, 1, 1)
      }
    }
  }
  brickCache.set(key, c)
  if (brickCache.size > 600) brickCache.clear()
  return c
}

// ---------------------------------------------------------------- paddle, orb, capsule

const paddleCache = new Map<string, HTMLCanvasElement>()

/** The shield bar, w×h logical: outline, cyan body, lit top edge, a gold gem. */
export function paddleCanvas(w: number, h: number, flash: boolean): HTMLCanvasElement {
  w = Math.max(6, w); h = Math.max(3, h)
  const key = `${w}x${h}:${flash ? 1 : 0}`
  let c = paddleCache.get(key)
  if (c) return c
  c = makeCanvas(w, h + 1)
  const g = c.getContext('2d')!
  const body = flash ? '#c8fbff' : '#2ff3ff'
  rect(g, '#0b0616', 1, 0, w - 2, h)
  rect(g, '#0b0616', 0, 1, w, h - 2)
  rect(g, body, 1, 1, w - 2, h - 2)
  rect(g, '#1a9fc4', 1, h - 2, w - 2, 1)
  rect(g, '#fff4ff', 2, 1, w - 4, 1)
  // End caps a shade darker, like a shield's rim.
  rect(g, '#1a9fc4', 1, 2, 1, h - 4)
  rect(g, '#1a9fc4', w - 2, 2, 1, h - 4)
  // Gem in the middle.
  const m = Math.floor(w / 2)
  rect(g, '#ffd23f', m - 1, Math.max(1, Math.floor(h / 2) - 1), 3, Math.min(2, h - 2))
  rect(g, '#fff1b0', m - 1, Math.max(1, Math.floor(h / 2) - 1), 1, 1)
  // Contact shadow row.
  rect(g, 'rgba(5,3,12,0.5)', 2, h, w - 4, 1)
  paddleCache.set(key, c)
  if (paddleCache.size > 200) paddleCache.clear()
  return c
}

/** The orb: a lit ball with a white core (5×5, 7×7 on big pixels' behalf). */
export const ORB = [
  '.ccc.',
  'cwwcc',
  'cwccc',
  'ccccC',
  '.cCC.',
]
export const ORB_BIG = [
  '..ccc..',
  '.cwwcc.',
  'cwwcccc',
  'cwccccc',
  'cccccCC',
  '.ccccC.',
  '..cCC..',
]
export function orbCanvas(big: boolean): HTMLCanvasElement {
  return sprite(big ? ORB_BIG : ORB, { c: '#9ff9ff', C: '#2ff3ff', w: '#ffffff' })
}

const capsuleCache = new Map<string, HTMLCanvasElement>()
/** A gold capsule with its letter in the 5×7 font. */
export function capsuleCanvas(label: string): HTMLCanvasElement {
  let c = capsuleCache.get(label)
  if (c) return c
  c = makeCanvas(13, 11)
  const g = c.getContext('2d')!
  rect(g, '#0b0616', 1, 0, 11, 11)
  rect(g, '#0b0616', 0, 1, 13, 9)
  rect(g, '#ffd23f', 1, 1, 11, 9)
  rect(g, '#fff1b0', 2, 1, 9, 1)
  rect(g, '#c4861c', 1, 9, 11, 1)
  rect(g, '#c4861c', 11, 2, 1, 7)
  drawText(g, label, 4, 2, '#1c1030')
  capsuleCache.set(label, c)
  return c
}

/** A pixel ring (midpoint circle). */
export function ring(g: G, cx: number, cy: number, r: number, color: string) {
  cx = Math.round(cx); cy = Math.round(cy); r = Math.round(r)
  if (r <= 0) return
  g.fillStyle = color
  let x = r
  let y = 0
  let err = 1 - r
  while (x >= y) {
    g.fillRect(cx + x, cy + y, 1, 1); g.fillRect(cx - x, cy + y, 1, 1)
    g.fillRect(cx + x, cy - y, 1, 1); g.fillRect(cx - x, cy - y, 1, 1)
    g.fillRect(cx + y, cy + x, 1, 1); g.fillRect(cx - y, cy + x, 1, 1)
    g.fillRect(cx + y, cy - x, 1, 1); g.fillRect(cx - y, cy - x, 1, 1)
    y++
    if (err < 0) err += 2 * y + 1
    else { x--; err += 2 * (y - x) + 1 }
  }
}

// ---------------------------------------------------------------- the chamber

export interface Chamber {
  /** Repaint for a logical size; the floor ends (the pit begins) at `pitY`. */
  layout(w: number, h: number, pitY: number, sigilY: number): void
  /** Floor, walls and braziers (lit), plus their lights. `flare` 0–1 brightens the fire. */
  drawBack(g: G, stage: PixelStage, time: number, flare: number, reduced: boolean): void
  /** Flames and the neon strip, after the light map. */
  drawGlow(g: G, time: number, flare: number, reduced: boolean): void
}

export function createChamber(): Chamber {
  let back: HTMLCanvasElement | null = null
  let neonLayer: HTMLCanvasElement | null = null
  let W = 0
  let H = 0
  let pit = 0
  let braziers: { x: number; y: number; color: string }[] = []

  function floorTile(g: G, px: number, py: number, tx: number, ty: number, size: number) {
    rect(g, DG.floor, px, py, size, size)
    rect(g, DG.grout, px, py, size, 1)
    rect(g, DG.grout, px, py, 1, size)
    rect(g, DG.floorL, px + 1, py + 1, size - 2, 1)
    // Worn spots and the odd crack in world-stable places.
    for (let i = 0; i < 2; i++) {
      const x = px + 2 + Math.floor(hash2(tx, ty, 10 + i) * (size - 4))
      const y = py + 2 + Math.floor(hash2(tx, ty, 20 + i) * (size - 4))
      rect(g, hash2(tx, ty, 30 + i) > 0.5 ? DG.floorL : DG.crack, x, y, 2, 1)
    }
    if (hash2(tx, ty, 41) > 0.94) {
      let x = px + 3 + Math.floor(hash2(tx, ty, 42) * (size - 6))
      for (let y = py + 3; y < py + size - 3; y++) {
        rect(g, DG.crack, x, y)
        if (hash2(x, y, 43) > 0.6) x++
      }
    }
    if (hash2(tx, ty, 50) > 0.9) {
      rect(g, DG.moss, px + 2, py + size - 3, 2, 1)
      rect(g, '#1f7a6e', px + 3, py + size - 2, 2, 1)
    }
  }

  // A stone bowl on a short pedestal, Neon Shrine's dungeon brazier.
  function brazier(g: G, x: number, y: number) {
    rect(g, 'rgba(5,3,12,0.45)', x - 5, y + 6, 11, 2)
    rect(g, '#0b0616', x - 6, y - 3, 13, 6)
    rect(g, '#0b0616', x - 3, y + 2, 7, 5)
    rect(g, DG.faceD, x - 5, y - 2, 11, 4)
    rect(g, DG.faceL, x - 5, y - 2, 11, 1)
    rect(g, '#1a1030', x - 4, y - 2, 9, 1)
    rect(g, DG.face, x - 2, y + 2, 5, 4)
    rect(g, DG.faceL, x - 2, y + 2, 1, 4)
  }

  function layout(w: number, h: number, pitY: number, sigilY: number) {
    W = w; H = h; pit = Math.round(pitY)
    back = makeCanvas(w, h)
    const g = back.getContext('2d')!
    rect(g, '#05030c', 0, 0, w, h)
    const size = 16
    for (let ty = 0; ty * size < pit; ty++) for (let tx = 0; tx * size < w; tx++) floorTile(g, tx * size, ty * size, tx, ty, size)
    // The sigil: a faint inlaid ring with four spokes, the shrine's mark.
    const cx = Math.round(w / 2)
    const cy = Math.round(sigilY)
    const r = Math.max(10, Math.min(Math.round(w * 0.22), Math.round((pit - cy) * 0.8)))
    for (const [rr, col] of [[r, '#3b2f6e'], [r - 1, '#241d48'], [Math.round(r * 0.55), '#3b2f6e']] as [number, string][]) ring(g, cx, cy, rr, col)
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + Math.PI / 4
      for (let d = Math.round(r * 0.55); d < r; d++) rect(g, '#352a66', Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d))
    }
    // The pit: the floor's edge, then dark falling away.
    rect(g, DG.faceL, 0, pit, w, 1)
    rect(g, DG.face, 0, pit + 1, w, 2)
    rect(g, DG.faceD, 0, pit + 3, w, 1)
    for (let y = pit + 4; y < h; y++) {
      const t = (y - pit - 4) / Math.max(1, h - pit - 4)
      g.fillStyle = t < 0.3 ? '#120c24' : '#07040f'
      g.fillRect(0, y, w, 1)
      if (t < 0.3) for (let x = (y & 1) * 2; x < w; x += 4) rect(g, '#07040f', x, y)
    }
    // Walls: a cap and a pink neon strip along the top and both sides.
    rect(g, DG.top, 0, 0, w, 3)
    rect(g, DG.topL, 0, 0, w, 1)
    rect(g, DG.top, 0, 0, 3, pit)
    rect(g, DG.top, w - 3, 0, 3, pit)
    rect(g, DG.topL, 0, 0, 1, pit)
    rect(g, DG.topL, w - 1, 0, 1, pit)
    // Shadow the walls cast on the floor.
    rect(g, DG.grout, 3, 3, w - 6, 1)
    rect(g, DG.grout, 3, 3, 1, pit - 3)
    neonLayer = makeCanvas(w, h)
    const ng = neonLayer.getContext('2d')!
    rect(ng, DG.neon, 0, 3, w, 1)
    rect(ng, DG.neon, 3, 3, 1, pit - 3)
    rect(ng, DG.neon, w - 4, 3, 1, pit - 3)
    g.drawImage(neonLayer, 0, 0)
    // Braziers along the side walls, from the bricks' height down.
    braziers = []
    const n = Math.max(2, Math.round(pit / 90))
    for (let i = 0; i < n; i++) {
      const y = Math.round(pit * (0.5 + (0.42 * i) / Math.max(1, n - 1)))
      const color = i % 2 ? '#3ff0ff' : '#ff8a3d'
      braziers.push({ x: 10, y, color }, { x: w - 11, y, color })
    }
    for (const b of braziers) brazier(g, b.x, b.y)
  }

  function drawBack(g: G, stage: PixelStage, time: number, flare: number, reduced: boolean) {
    if (back) g.drawImage(back, 0, 0)
    if (neonLayer) stage.emitImage(neonLayer)
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i]!
      const flick = reduced ? 1 : 0.9 + 0.1 * Math.sin(time * 11 + i * 1.7) + 0.05 * Math.sin(time * 23 + i)
      stage.light(b.x, b.y - 3, (26 + flare * 10) * flick, b.color, Math.min(1, 0.75 + flare * 0.25))
    }
    stage.light(W / 2, 3, W * 0.5, '#ff3fae', 0.25)
  }

  function drawGlow(g: G, time: number, flare: number, reduced: boolean) {
    for (let i = 0; i < braziers.length; i++) {
      const b = braziers[i]!
      const f = reduced ? 0 : Math.floor(time * 10 + i * 3) % 3
      const hot = b.color === '#3ff0ff' ? ['#3ff0ff', '#b8fbff', '#ffffff'] : ['#ff2fa0', '#ff8a3d', '#ffd23f']
      const tall = 5 + (f === 1 ? 1 : 0) + (flare > 0.3 ? 2 : 0)
      const top = b.y - 2 - tall
      rect(g, hot[0]!, b.x - 3, b.y - 4, 7, 2)
      rect(g, hot[0]!, b.x - 2, top + 2, 5, tall - 2)
      rect(g, hot[1]!, b.x - 1, top + (f === 2 ? 2 : 1), 3, tall - 1)
      rect(g, hot[2]!, b.x, b.y - 2 - Math.max(2, tall - 3), 1, Math.max(2, tall - 3))
      if (f === 0) rect(g, hot[1]!, b.x + 1, top - 1, 1, 1)
      else rect(g, hot[1]!, b.x - 1, top, 1, 1)
    }
  }

  return { layout, drawBack, drawGlow }
}
