/**
 * The years of a film's reels (`MapDef.era`): the colours a side map's world wears. A year dresses the world only,
 * its tiles, backdrop, props and ordinary foes; the hero, the hearts, the HUD, the deck, a card's words, every pink
 * warning and every gold marker keep their own colours, and no year uses pink, gold or the hero's cyan.
 *
 * 1958 is five greys from near black to bone. A year not dressed here wears the map's own look.
 */
import type { Era, MapDef, Rect } from '../types'
import { TILE } from '../types'
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
  /** The year's own sky; absent: the side view's. */
  backdrop?: (k: SideKit, z: Rect) => void
  /** Its ordinary foes are dressed in greys. */
  greys?: boolean
}

const YEARS: Partial<Record<Era, Year>> = {
  1958: {
    ink: { sky: BLACK, sky2: '#17171a', far: DARK, face: MID, shade: DARK, mortar: '#343438', top: LIGHT, lip: BONE, wood: '#6c6a68', woodL: '#b9b4a6', coil: LIGHT },
    ambient: '#d6d6d6',
    lamp: '#8c8c8c',
    card: { plate: BLACK, rule: LIGHT, title: BONE, text: BONE },
    backdrop: town,
    greys: true,
  },
}

const year = (era: Era | 'stage' | undefined) => (era && era !== 'stage' ? YEARS[era] : undefined)

export const eraInk = (def: Pick<MapDef, 'era'>): Ink | null => year(def.era)?.ink ?? null
export const eraLight = (def: Pick<MapDef, 'era'>) => year(def.era) ?? null
export const eraBackdrop = (def: Pick<MapDef, 'era'>) => year(def.era)?.backdrop ?? null
export const eraGreys = (def: Pick<MapDef, 'era'>) => !!year(def.era)?.greys

/** A stage's card (Act Three): the fog's own dusk, with no pink and no gold. */
const STAGE_CARD = { plate: '#101c26', rule: '#7fa0a8', title: '#f4f0fa', text: '#c4d4dc' }
/** A card's plate and letters, by its year or the stage's; the booth's own for a year not dressed here. */
export const eraCard = (era: Era | 'stage') => era === 'stage' ? STAGE_CARD : year(era)?.card ?? { plate: '#0b0616', rule: '#9690c4', title: '#fff4ff', text: '#cfc6ff' }

// ---------------------------------------------------------------------------
// A foe in greys
// ---------------------------------------------------------------------------

const greyed = new WeakMap<Canvas, Canvas>()

/** The sprite in the year's greys: its outline stays near black, everything else is lifted clear of the set's tones. */
export function greySprite(src: Canvas): Canvas {
  let c = greyed.get(src)
  if (c) return c
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  const img = g.getImageData(0, 0, c.width, c.height)
  const d = img.data
  const steps = [BLACK, '#6c6a68', LIGHT, '#b9b4a6', BONE].map(h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)))
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue
    const lum = (0.3 * d[i]! + 0.59 * d[i + 1]! + 0.11 * d[i + 2]!) / 255
    const s = steps[lum < 0.12 ? 0 : lum < 0.3 ? 1 : lum < 0.48 ? 2 : lum < 0.68 ? 3 : 4]!
    d[i] = s[0]!
    d[i + 1] = s[1]!
    d[i + 2] = s[2]!
  }
  g.putImageData(img, 0, 0)
  greyed.set(src, c)
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
  g.restore()
}
