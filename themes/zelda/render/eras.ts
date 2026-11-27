/**
 * The years of a film's reels (`MapDef.era`): the colours a side map's world wears. A year dresses the world only,
 * its tiles, backdrop, props and ordinary foes; the hero, the hearts, the HUD, the deck, a card's words, every pink
 * warning and every gold marker keep their own colours, and no year uses pink, gold or the hero's cyan.
 *
 * 1958 is five greys from near black to bone; 1986 slate blue, olive and bone; 2086 violet and acid green under a
 * white-lilac light (a violet far from the pink of danger); `screen` is the blank screen with the projector off, dark
 * slate and pale-grey pencil, so that pink and gold read on it. A map without a year wears its own look.
 *
 * Every year dresses the whole height of a room: its upper half is the film's set, not empty sky (the studio's rig in
 * 1958, the video store's ceiling and shelves, the night road's poles and boards, the grown-over drive-in).
 */
import type { Era, MapDef, Rect } from '../types'
import { TILE } from '../types'
import { drawText, textWidth } from '../../base/pixel/font'
import { hash2 } from './tiles'
import { makeCanvas } from './sheet'
import type { Ink, SideKit } from './side'

type G = CanvasRenderingContext2D
type Canvas = HTMLCanvasElement
const T = TILE

/** 1958's five steps. */
export const GREY = ['#0e0e10', '#232327', '#47474c', '#8b8987', '#dcd5c2'] as const
const [BLACK, DARK, MID, LIGHT, BONE] = GREY

interface Year {
  ink: Ink
  /** The side view's light over the picture, and the colour of the hero's own lamp: neither tints the year. */
  ambient: string
  lamp: string
  /** A card's plate (the year's darkest tone), its double rule, its title and its lines. */
  card: { plate: string; rule: string; title: string; text: string }
  /** The year's own sky behind the map `id`; absent: the side view's. */
  backdrop?: (k: SideKit, z: Rect, id: string) => void
  /** Its ordinary foes are dressed in these five tones, dark to light: against this year's stone their own do not read. */
  foes?: readonly [string, string, string, string, string]
}

const YEARS: Partial<Record<Era, Year>> = {
  1958: {
    ink: { sky: BLACK, sky2: '#17171a', far: DARK, face: MID, shade: DARK, mortar: '#343438', top: LIGHT, lip: BONE, wood: '#6c6a68', woodL: '#b9b4a6', coil: LIGHT },
    ambient: '#d6d6d6',
    lamp: '#8c8c8c',
    card: { plate: BLACK, rule: LIGHT, title: BONE, text: BONE },
    backdrop: town,
    foes: [BLACK, '#6c6a68', LIGHT, '#b9b4a6', BONE],
  },
  1986: {
    ink: { sky: '#141b2c', sky2: '#1a2236', far: '#263149', face: '#48587a', shade: '#2f3b57', mortar: '#3d4b6a', top: '#8a8a52', lip: '#e4dabc', wood: '#6a6a3e', woodL: '#c6bf96', coil: '#9a9ea8' },
    ambient: '#d6d6d6',
    lamp: '#8c8c8c',
    card: { plate: '#141b2c', rule: '#8a8a52', title: '#e4dabc', text: '#e4dabc' },
    backdrop: (k, z, id) => (id === 'chase1986' ? road : store)(k, z),
  },
  2086: {
    ink: { sky: '#120a22', sky2: '#190f2e', far: '#291b4a', face: '#473274', shade: '#2d1f4e', mortar: '#3b2a62', top: '#5c8c28', lip: '#b6f23c', wood: '#4c6a22', woodL: '#c4ea66', coil: '#a58cff' },
    ambient: '#d6d6d6',
    lamp: '#8c8c8c',
    card: { plate: '#120a22', rule: '#a58cff', title: '#e8e0ff', text: '#e8e0ff' },
    backdrop: overgrown,
    // Violet foes on violet stone read poorly: acid green here.
    foes: ['#0b0616', '#3d5a1c', '#6c9a2a', '#a6d83c', '#e8e0ff'],
  },
  screen: {
    ink: { sky: '#252a32', sky2: '#2a3039', far: '#363e49', face: '#4a525f', shade: '#343b46', mortar: '#414954', top: '#8d949e', lip: '#cdd1d6', wood: '#68707b', woodL: '#cdd1d6', coil: '#cdd1d6' },
    ambient: '#d6d6d6',
    lamp: '#8c8c8c',
    card: { plate: '#252a32', rule: '#8d949e', title: '#e8eaec', text: '#cdd1d6' },
    backdrop: blank,
  },
}

const year = (era: Era | 'stage' | undefined) => (era && era !== 'stage' ? YEARS[era] : undefined)

export const eraInk = (def: Pick<MapDef, 'era'>): Ink | null => year(def.era)?.ink ?? null
export const eraLight = (def: Pick<MapDef, 'era'>) => year(def.era) ?? null
export const eraBackdrop = (def: Pick<MapDef, 'era'>) => year(def.era)?.backdrop ?? null
export const eraFoes = (def: Pick<MapDef, 'era'>) => year(def.era)?.foes ?? null

/** A stage's card (Act Three): the fog's own dusk, with no pink and no gold. */
const STAGE_CARD = { plate: '#101c26', rule: '#7fa0a8', title: '#f4f0fa', text: '#c4d4dc' }
/** A card's plate and letters, by its year or the stage's; the booth's own for a year not dressed here. */
export const eraCard = (era: Era | 'stage') => era === 'stage' ? STAGE_CARD : year(era)?.card ?? { plate: '#0b0616', rule: '#9690c4', title: '#fff4ff', text: '#cfc6ff' }

// ---------------------------------------------------------------------------
// The film's look, over the set and under everything else
// ---------------------------------------------------------------------------

/**
 * What the film itself does to a year's room, laid over its sky and its tiles and under every warning, every gold
 * mark and everyone in it: 1958 has grain at twelve pictures a second, a scratch now and then and a dark rim; 1986
 * has a tracking band rolling down. A few rects and one slice of the picture drawn aslant, nothing by the pixel.
 * Reduced motion keeps only the rim.
 */
export function eraFilm(k: SideKit, def: Pick<MapDef, 'era'>, z: Rect) {
  const { g, cx, cy, vw, vh, time, reduced } = k
  if (def.era !== '1958' && def.era !== '1986') return
  // The room, as much of it as is on the screen.
  const x = Math.max(0, z.x * T - cx)
  const y = Math.max(0, z.y * T - cy)
  const w = Math.min(vw, (z.x + z.w) * T - cx) - x
  const h = Math.min(vh, (z.y + z.h) * T - cy) - y
  if (w <= 0 || h <= 0) return
  if (def.era === '1986') {
    if (reduced) return
    // Down the picture in some seven seconds, then a rest.
    const at = Math.floor((time * 62) % (h + 170)) - 10
    if (at < 0 || at + 9 > h) return
    g.drawImage(g.canvas, x, y + at, w - 4, 8, x + 4, y + at, w - 4, 8)
    g.globalAlpha = 0.28
    r(g, '#e4dabc', x, y + at - 1, w, 1)
    r(g, '#e4dabc', x, y + at + 8, w, 1)
    g.globalAlpha = 0.5
    const beat = Math.floor(time * 12)
    for (let i = 0; i < 5; i++) r(g, '#e4dabc', x + Math.floor(hash2(i, beat, 71) * (w - 14)), y + at + 1 + ((i * 3) % 6), 4 + Math.floor(hash2(i, beat, 72) * 10), 1)
    g.globalAlpha = 1
    return
  }
  // The rim, in three steps on each side.
  g.globalAlpha = 0.22
  for (const d of [18, 10, 4]) {
    r(g, '#000000', x, y, w, d)
    r(g, '#000000', x, y + h - d, w, d)
    r(g, '#000000', x, y + d, d, h - 2 * d)
    r(g, '#000000', x + w - d, y + d, d, h - 2 * d)
  }
  g.globalAlpha = 1
  if (reduced) return
  const beat = Math.floor(time * 12)
  g.globalAlpha = 0.5
  for (let i = 0; i < 44; i++) {
    r(g, i % 3 ? BONE : BLACK, x + Math.floor(hash2(i, beat, 73) * (w - 2)), y + Math.floor(hash2(i, beat, 74) * (h - 2)), i % 11 === 0 ? 2 : 1, i % 7 === 0 ? 2 : 1)
  }
  // A scratch down the print, one picture in five.
  if (hash2(beat, 1, 75) > 0.8) {
    g.globalAlpha = 0.22
    r(g, BONE, x + Math.floor(hash2(beat, 2, 76) * (w - 1)), y, 1, h)
  }
  g.globalAlpha = 1
}

// ---------------------------------------------------------------------------
// A foe in the year's tones
// ---------------------------------------------------------------------------

const toned = new WeakMap<readonly string[], WeakMap<Canvas, Canvas>>()

/** The sprite in five tones: its outline stays near black, everything else is lifted clear of the set's. */
export function toneSprite(src: Canvas, tones: readonly string[]): Canvas {
  let made = toned.get(tones)
  if (!made) toned.set(tones, made = new WeakMap())
  let c = made.get(src)
  if (c) return c
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  const steps = tones.map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)))
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    const lum = (0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!) / 255
    const s = steps[lum < 0.12 ? 0 : lum < 0.3 ? 1 : lum < 0.48 ? 2 : lum < 0.68 ? 3 : 4]!
    d[i] = s[0]!
    d[i + 1] = s[1]!
    d[i + 2] = s[2]!
  }
  g.putImageData(img, 0, 0)
  made.set(src, c)
  return c
}

// ---------------------------------------------------------------------------
// 1958's sky: a stand-in for the backdrop to be drawn
// ---------------------------------------------------------------------------

const r = (g: G, c: string, x: number, y: number, w = 1, h = 1) => { g.fillStyle = c; g.fillRect(x, y, w, h) }

/** A quiet town at night: stars and a moon, a water tower, and a street of gabled roofs sliding at half pace. */
function town(k: SideKit, z: Rect) {
  const { g, cx, cy, vw, vh } = k
  const x = z.x * T - cx
  const y = z.y * T - cy
  const w = z.w * T
  const h = z.h * T
  // The floor's top, three tiles up from the room's bottom.
  const ground = y + h - 3 * T
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  r(g, BLACK, x, y, w, h)
  for (let i = 0; i < 5; i++) r(g, i % 2 ? '#19191c' : '#141417', x, ground - 130 + i * 30, w, 140 - i * 28)
  for (let i = 0; i < 70; i++) r(g, i % 4 ? MID : LIGHT, x + Math.floor(hash2(i, z.x, 61) * w), y + Math.floor(hash2(i, z.x, 62) * (h - 130)), 1, 1)
  const dx = Math.round((cx - (z.x * T + (w - vw) / 2)) / 2)
  const dy = Math.round((cy - (z.y * T + (h - vh) / 2)) / 2)
  // The moon, high up and still.
  const mx = x + (z.x % 32 ? 52 : 184)
  const my = y + 74
  for (let j = -11; j <= 11; j++) {
    const half = Math.round(Math.sqrt(121 - j * j))
    r(g, LIGHT, mx - half, my + j, half * 2, 1)
  }
  r(g, MID, mx - 4, my - 5, 5, 3)
  r(g, MID, mx + 2, my + 3, 3, 3)
  // The water tower.
  const tx = x + dx + (z.x % 32 ? 150 : 74)
  const ty = ground + dy - 150
  for (const leg of [2, 22]) r(g, DARK, tx + leg, ty + 22, 2, 140)
  r(g, DARK, tx + 4, ty + 60, 18, 1)
  r(g, DARK, tx, ty, 26, 22)
  r(g, MID, tx, ty, 26, 1)
  r(g, DARK, tx + 5, ty - 4, 16, 4)
  // Wires between two poles.
  r(g, DARK, x, ground + dy - 96, w, 1)
  for (let i = 12; i < w; i += 118) r(g, DARK, x + dx + i, ground + dy - 100, 2, 100)
  // Roofs.
  for (let i = -2; i < w / 46 + 2; i++) {
    const wide = 30 + Math.floor(hash2(i, z.x, 63) * 14)
    const tall = 20 + Math.floor(hash2(i, z.x, 64) * 34)
    const bx = x + dx + i * 46
    const by = ground + dy - tall
    for (let j = 0; j < wide / 2; j += 2) r(g, DARK, bx + j, by - j / 2 - 2, wide - 2 * j, 2)
    r(g, DARK, bx + 2, by, wide - 4, tall + 40)
    if (hash2(i, z.x, 65) > 0.45) {
      r(g, MID, bx + 8, by + 6, 5, 6)
      r(g, DARK, bx + 10, by + 6, 1, 6)
    }
  }
  rig(g, x, y, w, z.x)
  g.restore()
}

/** The studio over the set: a truss with its lamps, two painted clouds hung on wires, a microphone on its boom. */
function rig(g: G, x: number, y: number, w: number, seed: number) {
  // The truss.
  r(g, MID, x, y + 26, w, 2)
  r(g, MID, x, y + 38, w, 2)
  for (let i = 0; i < w; i += 12) for (let j = 0; j < 12; j += 2) { r(g, DARK, x + i + j, y + 28 + (j * 10) / 12, 2, 2); r(g, DARK, x + i + 12 - j, y + 28 + (j * 10) / 12, 2, 2) }
  for (let i = 20; i < w; i += 76) {
    r(g, DARK, x + i, y, 2, 26)
    // A lamp under it, and the little it throws.
    r(g, MID, x + i + 24, y + 40, 2, 6)
    for (let k = 0; k < 8; k++) r(g, k < 2 ? LIGHT : MID, x + i + 21 - k, y + 46 + k, 8 + 2 * k, 1)
    r(g, BONE, x + i + 16, y + 54, 18, 2)
    g.globalAlpha = 0.07
    for (let k = 0; k < 40; k += 2) r(g, BONE, x + i + 16 - k / 2, y + 56 + k, 18 + k, 2)
    g.globalAlpha = 1
  }
  // Clouds: flats on two wires each.
  for (const [cx, cyy, cw] of [[30, 112, 54], [150, 140, 66]] as const) {
    const px = x + cx + (seed % 32 ? 24 : 0)
    const py = y + cyy
    for (const at of [10, cw - 12]) r(g, DARK, px + at, y + 40, 1, py - y - 38)
    r(g, MID, px + 4, py + 4, cw - 8, 10)
    r(g, MID, px + 12, py - 2, 16, 8)
    r(g, MID, px + cw - 26, py + 1, 14, 6)
    r(g, MID, px, py + 8, cw, 5)
    r(g, LIGHT, px + 13, py - 3, 14, 1)
    r(g, LIGHT, px + cw - 25, py, 12, 1)
    r(g, DARK, px + 2, py + 13, cw - 4, 2)
  }
  // The boom, from the wings.
  for (let k = 0; k < 70; k++) r(g, MID, x + w - k, y + 176 + (k >> 3), 1, 2)
  r(g, LIGHT, x + w - 82, y + 182, 13, 8)
  r(g, DARK, x + w - 80, y + 184, 9, 1)
  r(g, DARK, x + w - 80, y + 187, 9, 1)
}

// ---------------------------------------------------------------------------
// 1986's skies: stand-ins for the backdrops to be drawn
// ---------------------------------------------------------------------------

/** The room's box on the picture, clipped to: `paint` gets its corner and size, and how far the camera has slid it. */
function boxed(k: SideKit, z: Rect, paint: (g: G, x: number, y: number, w: number, h: number, dx: number, dy: number) => void) {
  const { g, cx, cy, vw, vh } = k
  const x = Math.round(z.x * T) - cx
  const y = z.y * T - cy
  const w = z.w * T
  const h = z.h * T
  g.save()
  g.beginPath()
  g.rect(x, y, w, h)
  g.clip()
  paint(g, x, y, w, h, Math.round((cx - (z.x * T + (w - vw) / 2)) / 2), Math.round((cy - (z.y * T + (h - vh) / 2)) / 2))
  g.restore()
}

const SLATE = ['#141b2c', '#1a2236', '#232d45', '#303c58'] as const
const OLIVE = ['#3c3d2a', '#58593a', '#8a8a52'] as const
const IVORY = '#cfc6a8'

/** The video store: strip lights, a lit sign, posters, and bays of tapes from the floor up. */
function store(k: SideKit, z: Rect) {
  boxed(k, z, (g, x, y, w, h, dx, dy) => {
    const floor = y + h - 3 * T
    r(g, SLATE[0], x, y, w, h)
    // The ceiling's tiles, and two strip lights hung under it.
    for (let i = 0; i < w; i += 24) r(g, SLATE[1], x + i, y, 1, 22)
    r(g, SLATE[2], x, y + 22, w, 3)
    for (const at of [30, 162]) {
      r(g, SLATE[3], x + at + 8, y + 25, 1, 9)
      r(g, SLATE[3], x + at + 54, y + 25, 1, 9)
      r(g, IVORY, x + at, y + 34, 64, 3)
      g.globalAlpha = 0.05
      for (let j = 0; j < 30; j += 3) r(g, IVORY, x + at - j, y + 37 + j, 64 + 2 * j, 3)
      g.globalAlpha = 1
    }
    // The sign.
    const sx = x + Math.round(w / 2) - 44 + (dx >> 2)
    r(g, SLATE[3], sx + 12, y + 25, 1, 27)
    r(g, SLATE[3], sx + 76, y + 25, 1, 27)
    r(g, OLIVE[0], sx, y + 52, 88, 30)
    r(g, OLIVE[2], sx + 2, y + 54, 84, 1)
    r(g, OLIVE[2], sx + 2, y + 79, 84, 1)
    g.save()
    g.translate(sx + 44 - textWidth('VIDEO'), y + 60)
    g.scale(2, 2)
    drawText(g, 'VIDEO', 0, 0, IVORY)
    g.restore()
    // Posters in a row.
    for (let i = 0; i < 5; i++) {
      const px = x + 14 + i * 50 + (dx >> 1)
      const py = y + 100 + (dy >> 2) + (i % 2) * 6
      r(g, SLATE[3], px, py, 30, 42)
      r(g, i % 2 ? OLIVE[1] : SLATE[2], px + 2, py + 2, 26, 30)
      // A moon, a road, a figure: three films nobody returned.
      if (i % 3 === 0) { r(g, IVORY, px + 17, py + 7, 6, 6); r(g, SLATE[0], px + 2, py + 24, 26, 8) }
      else if (i % 3 === 1) { for (let k2 = 0; k2 < 14; k2++) r(g, IVORY, px + 15 - (k2 >> 1), py + 18 + k2, 1 + k2, 1) }
      else { r(g, IVORY, px + 12, py + 10, 6, 6); r(g, IVORY, px + 10, py + 17, 10, 15) }
      r(g, IVORY, px + 4, py + 35, 22, 2)
      r(g, SLATE[0], px + 8, py + 39, 14, 1)
    }
    // Bays of tapes.
    for (let bay = -1; bay < 5; bay++) {
      const bx = x + bay * 66 + (dx >> 1)
      const top = y + 160 + (dy >> 2)
      r(g, SLATE[1], bx, top, 58, floor - top + 16)
      r(g, SLATE[3], bx, top, 58, 2)
      for (let row = 0; top + 8 + row * 20 < floor + 8; row++) {
        const sy = top + 6 + row * 20
        for (let t = 0; t < 17; t++) {
          const n = hash2(bay * 31 + t, row, 71)
          if (n > 0.86) continue
          const tall = 11 + Math.floor(n * 4)
          r(g, [SLATE[3], OLIVE[0], OLIVE[1], SLATE[2]][Math.floor(hash2(t, bay + row * 7, 72) * 4)]!, bx + 3 + t * 3, sy + 14 - tall, 2, tall)
          if (n < 0.25) r(g, '#8c876f', bx + 3 + t * 3, sy + 17 - tall, 2, 2)
        }
        r(g, SLATE[3], bx + 1, sy + 14, 56, 2)
      }
    }
  })
}

/**
 * The road at night: a moon, far mesas and near hills sliding slowly under the screen, boards on stilts, and poles
 * with their wires standing in the world, so that the scroll is seen. `z` is the screen: its left edge is the camera's.
 */
function road(k: SideKit, z: Rect) {
  boxed(k, z, (g, x, y, w, h) => {
    const floor = y + h - 3 * T
    const left = z.x * T
    /** Where a thing `far` times as fast as the world, `every` px apart, first stands left of the screen. */
    const slide = (far: number, every: number, each: (px: number, i: number) => void) => {
      const off = left * far
      for (let i = Math.floor(off / every) - 1; i * every - off < w + every; i++) each(x + Math.round(i * every - off), i)
    }
    r(g, SLATE[0], x, y, w, h)
    for (let i = 0; i < 6; i++) r(g, i % 2 ? SLATE[1] : '#172033', x, floor - 168 + i * 28, w, 170 - i * 28)
    for (let i = 0; i < 90; i++) r(g, i % 5 ? SLATE[3] : IVORY, x + Math.floor(hash2(i, 3, 81) * w), y + Math.floor(hash2(i, 3, 82) * (h - 150)), 1, 1)
    for (let j = -13; j <= 13; j++) {
      const half = Math.round(Math.sqrt(169 - j * j))
      r(g, IVORY, x + 196 - half, y + 46 + j, half * 2, 1)
    }
    r(g, '#a9a48c', x + 190, y + 40, 6, 4)
    r(g, '#a9a48c', x + 200, y + 50, 4, 3)
    // Long thin clouds high up.
    slide(0.06, 150, (px, i) => { const cy = y + 70 + Math.floor(hash2(i, 1, 83) * 60); r(g, SLATE[2], px, cy, 70, 3); r(g, SLATE[2], px + 16, cy - 3, 34, 3); r(g, SLATE[1], px + 30, cy + 3, 60, 2) })
    // Mesas.
    slide(0.14, 110, (px, i) => {
      const tall = 40 + Math.floor(hash2(i, 2, 84) * 46)
      const wide = 46 + Math.floor(hash2(i, 2, 85) * 40)
      r(g, SLATE[2], px, floor - tall, wide, tall)
      for (let k2 = 0; k2 < 12; k2++) { r(g, SLATE[2], px - 12 + k2, floor - k2 * 3, 1, k2 * 3); r(g, SLATE[2], px + wide + 11 - k2, floor - k2 * 3, 1, k2 * 3) }
      r(g, SLATE[3], px, floor - tall, wide, 1)
    })
    slide(0.34, 84, (px, i) => { const tall = 14 + Math.floor(hash2(i, 4, 86) * 26); for (let k2 = 0; k2 < tall; k2 += 2) r(g, '#202941', px - (k2 << 1), floor - tall + k2, 24 + (k2 << 2), 2) })
    // Boards on stilts.
    slide(0.6, 300, (px, i) => {
      const bx = px + 90
      const by = y + 138 + (i & 1) * 26
      for (const leg of [10, 72]) r(g, SLATE[2], bx + leg, by + 40, 3, floor - by - 40)
      r(g, SLATE[3], bx - 2, by - 2, 90, 44)
      r(g, OLIVE[0], bx, by, 86, 40)
      const word = i & 1 ? 'DRIVE ON' : 'NEXT REEL'
      drawText(g, word, bx + 43 - Math.round(textWidth(word) / 2), by + 9, IVORY)
      r(g, OLIVE[2], bx + 8, by + 25, 70, 2)
      r(g, OLIVE[2], bx + 18, by + 31, 50, 2)
    })
    // Poles and wires, as fast as the road itself.
    slide(1, 116, px => {
      const top = y + 96
      r(g, '#0c111e', px, top, 3, floor - top)
      r(g, SLATE[3], px + 3, top, 1, floor - top)
      for (const [at, half] of [[6, 14], [16, 10]] as const) { r(g, '#0c111e', px - half + 1, top + at, half * 2 + 1, 2); r(g, IVORY, px - half + 1, top + at - 2, 2, 2); r(g, IVORY, px + half, top + at - 2, 2, 2) }
      for (let k2 = 0; k2 < 116; k2 += 4) r(g, SLATE[3], px + k2, top + 4 + Math.round(Math.sin((k2 / 116) * Math.PI) * 11), 4, 1)
    })
  })
}

// ---------------------------------------------------------------------------
// 2086: the drive-in, grown over (a stand-in)
// ---------------------------------------------------------------------------

const VIOLET = ['#120a22', '#190f2e', '#241842', '#33245c'] as const
const ACID = ['#27391a', '#3d5a1c', '#6c9a2a'] as const
const LILAC = '#d9d0ff'

function overgrown(k: SideKit, z: Rect) {
  const { time, reduced } = k
  boxed(k, z, (g, x, y, w, h, dx, dy) => {
    const floor = y + h - 3 * T
    const seed = z.x
    r(g, VIOLET[0], x, y, w, h)
    for (let i = 0; i < 5; i++) r(g, i % 2 ? VIOLET[1] : '#160d28', x, floor - 150 + i * 30, w, 160 - i * 30)
    for (let i = 0; i < 80; i++) r(g, i % 4 ? VIOLET[3] : LILAC, x + Math.floor(hash2(i, seed, 91) * w), y + Math.floor(hash2(i, seed, 92) * (h - 120)), 1, 1)
    // A ringed world, high up.
    const mx = x + (seed % 32 ? 70 : 178)
    const my = y + 62
    for (let j = -17; j <= 17; j++) {
      const half = Math.round(Math.sqrt(289 - j * j))
      r(g, j > 6 ? '#8f80c8' : LILAC, mx - half, my + j, half * 2, 1)
    }
    // Its ring, tipped: the far side hidden by the world, the near side across it.
    for (let k = 0; k < 220; k++) {
      const a = (k / 220) * Math.PI * 2
      const u = Math.cos(a) * 29
      const v = Math.sin(a) * 7
      const px = mx + Math.round(u * 0.94 - v * 0.34)
      const py = my + Math.round(u * 0.34 + v * 0.94)
      if (v < 0 && Math.hypot(px - mx, py - my) < 17.5) continue
      r(g, v > 0 ? '#6f5fb0' : '#a99ae0', px, py, 1, v > 0 ? 2 : 1)
    }
    // The old screen on its frame, torn.
    const sx = x + (seed % 32 ? 118 : 22) + (dx >> 1)
    const sy = y + 118 + (dy >> 2)
    for (const leg of [6, 52, 96]) r(g, VIOLET[3], sx + leg, sy + 74, 4, floor - sy - 74)
    for (let k2 = 0; k2 < 44; k2++) { r(g, VIOLET[2], sx + 8 + k2, sy + 78 + k2, 2, 2); r(g, VIOLET[2], sx + 54 + k2, sy + 122 - k2, 2, 2) }
    r(g, VIOLET[2], sx, sy, 106, 76)
    r(g, VIOLET[3], sx + 3, sy + 3, 100, 70)
    for (let i = 0; i < 100; i += 4) r(g, VIOLET[0], sx + 3 + i, sy + 3, 4, Math.floor(hash2(i, seed, 93) * (i > 56 && i < 84 ? 52 : 14)))
    for (let i = 14; i < 100; i += 30) r(g, VIOLET[2], sx + i, sy + 3, 1, 70)
    // Growth along the ground, behind everything: clumps of fronds, each bending its own way (nothing like a rung).
    for (let i = -2; i < w / 11 + 2; i++) {
      const px = x + i * 11 + (dx >> 1) + Math.floor(hash2(i, seed, 100) * 6)
      for (let f = 0; f < 3; f++) {
        const n = hash2(i, seed + f, 94)
        const tall = 7 + Math.floor(n * n * 34)
        const lean = (hash2(i, f, 101) - 0.5) * 18
        for (let j = 0; j < tall + 6; j += 2) {
          const q = Math.max(0, j - 6) / tall
          r(g, f === 2 ? ACID[1] : ACID[0], px + Math.round(lean * q * q), floor + 6 - j, q > 0.7 ? 1 : 3 - f, 2)
        }
      }
      if (hash2(i, seed, 102) > 0.8) r(g, '#8f80c8', px + 1, floor - 8 - Math.floor(hash2(i, seed, 103) * 18), 2, 2)
    }
    // Vines hung from the dark above.
    for (let i = 0; i < w / 17; i++) {
      const len = 30 + Math.floor(hash2(i, seed, 95) * 150)
      const px = x + i * 17 + 4 + Math.floor(hash2(i, seed, 96) * 9) + (dx >> 2)
      const near = hash2(i, seed, 97) > 0.6
      for (let j = 0; j < len; j += 3) {
        const sway = Math.round(Math.sin(j / 19 + i) * 2)
        r(g, near ? ACID[1] : ACID[0], px + sway, y + j, near ? 2 : 1, 3)
        if (j % 12 === 6) r(g, near ? ACID[1] : ACID[0], px + sway + (j % 24 > 12 ? -3 : 2), y + j, 3, 2)
      }
      if (near) { r(g, ACID[2], px + Math.round(Math.sin(len / 19 + i) * 2) - 1, y + len, 3, 3) }
    }
    // Spores adrift.
    for (let i = 0; i < 18; i++) {
      const t = reduced ? 0 : time
      const px = x + Math.floor((hash2(i, seed, 98) * w + t * (3 + (i % 3))) % w)
      const py = floor - 12 - Math.floor((hash2(i, seed, 99) * 240 + t * (4 + (i % 4))) % 240)
      r(g, i % 3 ? '#8f80c8' : LILAC, px, py, 1, 1)
    }
  })
}

// ---------------------------------------------------------------------------
// The blank screen
// ---------------------------------------------------------------------------

/** A hand as a pencil would leave it: its outline, open, fingers up. */
const HAND = [
  '.......oo.........',
  '....oo.o.o.oo.....',
  '...o..oo.oo..o....',
  '...o..oo.oo..o....',
  '...o..oo.oo..o.oo.',
  '...o..oo.oo..oo..o',
  '.o.o..oo.oo..oo..o',
  'o.oo.........oo..o',
  'o..o..........o..o',
  '.o..o............o',
  '..o..o..........o.',
  '...o............o.',
  '....o..........o..',
  '.....o........o...',
  '......o......o....',
  '......o......o....',
]

export function pencilHand(g: G, c: string, x: number, y: number, size = 1, flip = false) {
  HAND.forEach((row, j) => { for (let i = 0; i < row.length; i++) if (row[i] === 'o') r(g, c, x + (flip ? row.length - 1 - i : i) * size, y + j * size, size, size) })
}

function blank(k: SideKit, z: Rect) {
  boxed(k, z, (g, x, y, w, h) => {
    r(g, '#252a32', x, y, w, h)
    // The weave of the cloth, and the seams of its panels.
    for (let j = 8; j < h; j += 8) r(g, '#272d36', x, y + j, w, 1)
    for (let i = 64; i < w; i += 64) r(g, '#2d333d', x + i, y + 16, 1, h - 16)
    // Where the picture would end, ruled in pencil, with its sprocket holes.
    r(g, '#4b535f', x + 24, y + 24, w - 48, 1)
    for (const at of [24, w - 25]) r(g, '#4b535f', x + at, y + 24, 1, h - 72)
    for (let j = 32; j < h - 60; j += 18) for (const at of [18, w - 22]) r(g, '#3d444f', x + at, y + j, 4, 7)
    // A thousand hands, or the first few of them, each tried again.
    const tries = [[40, 40, 3, 0], [150, 56, 2, 1], [100, 100, 2, 0], [186, 112, 1, 0], [38, 132, 2, 1], [146, 158, 3, 1], [76, 176, 1, 0], [196, 196, 2, 0], [48, 212, 1, 1], [108, 224, 2, 0]] as const
    tries.forEach(([hx, hy, s, f], i) => {
      pencilHand(g, i % 3 ? '#39414c' : '#444c58', x + hx, y + hy, s, !!f)
      // A guide line struck through some of them.
      if (i % 3 === 0) for (let n = 0; n < 18 * s; n += 2) r(g, '#444c58', x + hx - 4 + n, y + hy + 17 * s - n, 1, 1)
    })
  })
}
