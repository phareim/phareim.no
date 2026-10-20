/** Sprite canvases built once from the pixel maps in sprites.ts (and mirrored on demand). */
import { PAL, SPRITES } from './sprites'
import { heroColorsKey, heroPalette } from './heroColors'
import { heroFrames } from './heroFrames'
import { heroLookKey, lookPalette, type HeroLook } from './heroLook'
import type { HeroColors } from '../../miniworld/types'

type Canvas = HTMLCanvasElement

const cache = new Map<string, Canvas>()
const tinted = new Map<string, Canvas>()
/** What the hero wears: the booth's look, else a made figure's colours, else nothing (as drawn). */
let heroLook: HeroLook | null = null
let heroColors: HeroColors | null = null
/** The hero's palette and frames for that, or null for the drawn ones. */
let heroPal: Record<string, string> | null = null
let heroRows: Record<string, string[]> | null = null
let heroKey = ''
/** Rows the studio (studio.phareim.no) drew instead of the registry's, by sprite name (render/live.ts). */
let overrides: Record<string, readonly string[]> = {}

/** Only `hero_*` canvases are rebuilt; everything else keeps its cache. */
function dressHero(): void {
  const key = heroLook ? 'look:' + heroLookKey(heroLook) : 'colors:' + heroColorsKey(heroColors)
  if (key === heroKey) return
  heroKey = key
  heroPal = heroLook ? { ...PAL, ...lookPalette(heroLook) } : heroColors ? { ...PAL, ...heroPalette(heroColors) } : null
  heroRows = heroLook ? heroFrames(heroLook) : null
  for (const m of [cache, tinted]) for (const k of [...m.keys()]) if (k.startsWith('hero_')) m.delete(k)
}

/** Dress the hero in a made figure's colours (null: as drawn). The booth's look, when set, is worn instead. */
export function setHeroColors(colors: HeroColors | null): void {
  heroColors = colors
  dressHero()
}

/** The hero's look from the NEW LOOK booth: shape and colours (null: none chosen). */
export function setHeroLook(look: HeroLook | null): void {
  heroLook = look
  dressHero()
}

function makeCanvas(w: number, h: number): Canvas {
  const c = document.createElement('canvas')
  c.width = Math.max(1, w)
  c.height = Math.max(1, h)
  return c
}

/** Rows of palette letters as a canvas, one pixel per letter. */
export function paintRows(rows: readonly string[], pal: Record<string, string>): Canvas {
  const h = rows.length
  const w = rows[0]?.length ?? 1
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  for (let y = 0; y < h; y++) {
    const row = rows[y]!
    for (let x = 0; x < w; x++) {
      const col = pal[row[x]!]
      if (!col) continue
      g.fillStyle = col
      g.fillRect(x, y, 1, 1)
    }
  }
  return c
}

/** The hero's frames in a look, as canvases by frame name, without touching what the hero wears (the booth's mirror). */
export function lookCanvases(look: HeroLook): Record<string, Canvas> {
  const pal = { ...PAL, ...lookPalette(look) }
  return Object.fromEntries(Object.entries(heroFrames(look)).map(([name, rows]) => [name, paintRows(rows, pal)]))
}

function build(name: string): Canvas {
  const hero = name.startsWith('hero_')
  const rows = (hero && heroRows?.[name]) || overrides[name] || SPRITES[name]?.rows
  if (!rows) return makeCanvas(1, 1)
  return paintRows(rows, hero && heroPal ? heroPal : PAL)
}

/** The sprite canvas; `flip` mirrors it horizontally. */
export function sprite(name: string, flip = false): Canvas {
  const key = flip ? name + '|f' : name
  let c = cache.get(key)
  if (c) return c
  if (!flip) c = build(name)
  else {
    const src = sprite(name)
    c = makeCanvas(src.width, src.height)
    const g = c.getContext('2d')!
    g.translate(src.width, 0)
    g.scale(-1, 1)
    g.drawImage(src, 0, 0)
  }
  cache.set(key, c)
  return c
}

/** Mirrored horizontally (fh) and/or vertically (fv). */
export function spriteT(name: string, fh: boolean, fv: boolean): Canvas {
  if (!fv) return sprite(name, fh)
  const key = `${name}|${fh ? 'f' : ''}v`
  let c = cache.get(key)
  if (c) return c
  const src = sprite(name, fh)
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.translate(0, src.height)
  g.scale(1, -1)
  g.drawImage(src, 0, 0)
  cache.set(key, c)
  return c
}

/** A solid-colour silhouette of a sprite (hit flashes, shadows). */
export function silhouette(name: string, color: string, flip = false): Canvas {
  const key = `${name}|${flip ? 'f' : ''}|${color}`
  let c = tinted.get(key)
  if (c) return c
  const src = sprite(name, flip)
  c = makeCanvas(src.width, src.height)
  const g = c.getContext('2d')!
  g.drawImage(src, 0, 0)
  g.globalCompositeOperation = 'source-in'
  g.fillStyle = color
  g.fillRect(0, 0, c.width, c.height)
  tinted.set(key, c)
  return c
}

/** Draw a sprite with its bottom-centre at (x, y) in logical pixels. */
export function drawSprite(g: CanvasRenderingContext2D, name: string, x: number, y: number, flip = false, alpha = 1) {
  const c = sprite(name, flip)
  if (alpha !== 1) g.globalAlpha = alpha
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height))
  if (alpha !== 1) g.globalAlpha = 1
}

/** Draw a sprite centred on (x, y). */
export function drawCentered(g: CanvasRenderingContext2D, name: string, x: number, y: number, flip = false) {
  const c = sprite(name, flip)
  g.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2))
}

/** How many frames the studio may add to an animation it lets grow (studio-web packs/neonShrine.ts `grow`). */
const GROW_MAX = 8
const FRAME = /^(.*)_(\d+)$/

/**
 * A frame the studio added after the drawn ones (`blob_2` after `blob_0`, `blob_1`): the rows of
 * the animation's first frame, whose size it must have; null when the name is no such frame or
 * the run is broken (the frame before it is neither drawn nor added).
 */
function addedFrame(name: string, accepted: Record<string, readonly string[]>): readonly string[] | null {
  const m = FRAME.exec(name)
  if (!m || SPRITES[name]) return null
  const first = SPRITES[`${m[1]}_0`]?.rows
  const i = Number(m[2])
  const prev = `${m[1]}_${i - 1}`
  if (!first || i >= GROW_MAX || !(SPRITES[prev] || accepted[prev])) return null
  return first
}

const counts = new Map<string, number>()

/**
 * How many frames `<prefix>_0 … _n` there are: `own` as drawn, or more when the studio added
 * frames. Animations step through `frameCount(prefix, own)` instead of a fixed number, so an
 * added frame plays like the drawn ones (the studio decides which animations may grow).
 */
export function frameCount(prefix: string, own: number): number {
  const key = `${prefix}|${own}`
  let n = counts.get(key)
  if (n === undefined) {
    n = own
    while (n < GROW_MAX && overrides[`${prefix}_${n}`] && !SPRITES[`${prefix}_${n}`]) n++
    counts.set(key, n)
  }
  return n
}

/** Same width and height, every row as wide as the first. */
function sameSize(a: readonly string[], b: readonly string[]): boolean {
  const w = a[0]?.length ?? 0
  return a.length === b.length && b.every(r => typeof r === 'string' && r.length === w)
}

/**
 * Draw these rows instead of the registry's (the studio's live art, render/live.ts). Replaces
 * the whole set: a name left out goes back to the drawn rows. Frames of another size are
 * skipped, because the renderer places sprites by their size; so are names not in the
 * registry, except frames added after an animation's drawn ones (see addedFrame), which then
 * count in frameCount. Only the canvases of names that changed are rebuilt. Returns the names
 * applied.
 */
export function setSpriteOverrides(next: Record<string, readonly string[]>): string[] {
  const applied: Record<string, readonly string[]> = {}
  const index = (n: string) => Number(FRAME.exec(n)?.[2] ?? 0)
  for (const [name, rows] of Object.entries(next).sort(([a], [b]) => index(a) - index(b))) {
    const drawn = SPRITES[name]?.rows ?? addedFrame(name, applied)
    if (drawn && Array.isArray(rows) && sameSize(drawn, rows)) applied[name] = rows
  }
  counts.clear()
  const touched = new Set<string>()
  for (const name of new Set([...Object.keys(overrides), ...Object.keys(applied)])) {
    if (overrides[name]?.join('\n') !== applied[name]?.join('\n')) touched.add(name)
  }
  overrides = applied
  for (const m of [cache, tinted]) for (const k of [...m.keys()]) if (touched.has(k.split('|')[0]!)) m.delete(k)
  return Object.keys(applied)
}

export function hasSprite(name: string) {
  return !!SPRITES[name] || !!overrides[name]
}

export { makeCanvas }
