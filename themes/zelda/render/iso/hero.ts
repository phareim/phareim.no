/**
 * The hero in the isometric view's own pixel art (part 21), the way the townsfolk are (`folk.ts`), but composed and
 * recoloured as the classic hero is (`heroFrames.ts`, `heroLook.ts`).
 *
 * - *Roles, not colours.* Every px of `heroArt.ts` says which of the look's eight colours it is (skin, hair, what is on
 *   the head, shirt, stripe, belt, below the belt, shoes) and at which slot: the role's outline, then its shades. The
 *   slot `HERO_BASE` is the look's colour itself; the others are mixed from it toward the dark or toward white
 *   (`HERO_MIX`, fitted to the drawing), the way `lookPalette` mixes the classic hero's shades. A colour left at the
 *   drawn one keeps the drawing's own shades (`HERO_DRAWN`), so `DRAWN_LOOK` is the hero as drawn. A dress is the skirt
 *   in the shirt's colours. The eyes and the open mouth are fixed.
 * - *Composed.* A frame is a body (torso and legs, per pose, facing and what is worn below: trousers, shorts, or the
 *   skirt over bare legs), with the head (hair and what is on it) set on its neck point, the hair that falls past the
 *   chin laid over the torso, and arms raised above the head (carry, get) laid over that. The parts are drawn once
 *   each: the walk's steps are pixel edits of the standing body, shorts and the skirt recipes over the trousers.
 * - *Frames.* Three-quarter front and back, mirrored for the other two facings, mapped from the classic sprite's name
 *   as `facingOf` maps the folk: stand, the walk's two steps, the swing, carrying (two), pushing. Facing the viewer
 *   only: holding up a find (`get`: the arms up, the mouth open), hurt (the eyes squeezed), the three falling frames
 *   (the standing front shrunk, as the classic does) and lying (it turned on its side, as the classic does).
 * - *Covered or not at all.* `heroArtCovers(shape)` says whether every part of a shape is drawn; a shape that is not
 *   is the classic hero, whole. So is a hero the studio has redrawn (`heroStudioEdited`).
 */
import { BLADE_ART, BLADE_PAL, HERO_ARMS, HERO_BASE, HERO_BODIES, HERO_DRAWN, HERO_FIXED, HERO_HEADS, HERO_LETTERS, HERO_MIX, HERO_OVERS, type HeroPart, type HeroRole } from './heroArt'
import { mix } from '../heroColors'
import { DRAWN_LOOK, heroLookKey, type HeroLook } from '../heroLook'
import type { HeroShape } from '../heroFrames'
import { heroStudioEdited, heroStyle, makeCanvas, type SpriteTag } from '../sheet'

export type ArtFacing = 'front' | 'back'
/** The poses drawn front and back. */
export const ART_POSES = ['0', '1', '2', 'atk', 'carry_0', 'carry_1', 'push'] as const
/** The poses drawn facing the viewer only (`fall_*` and `dead` are made from the standing front). */
export const ART_FRONT_POSES = ['get', 'hurt'] as const

const ROLES: HeroRole[] = ['hair', 'skin', 'head', 'top', 'stripe', 'belt', 'bottom', 'shoes']
const ROLE_KEY: Record<HeroRole, 'hairColor' | 'skin' | 'headColor' | 'top' | 'stripe' | 'belt' | 'bottomColor' | 'shoes'> = {
  hair: 'hairColor', skin: 'skin', head: 'headColor', top: 'top', stripe: 'stripe', belt: 'belt', bottom: 'bottomColor', shoes: 'shoes',
}
const ROLE_OF: Record<string, HeroRole> = {}
for (const r of ROLES) for (const ch of HERO_LETTERS[r]) ROLE_OF[ch] = r

/** A role's slots in a colour: the drawing's own when it is the drawn colour, else mixed from it. */
function slots(role: HeroRole, color: string, drawn: string): string[] {
  if (color.toLowerCase() === drawn.toLowerCase()) return [...HERO_DRAWN[role]]
  return HERO_MIX[role].map((m, i) => (i === HERO_BASE[role] || !m ? color : mix(color, m[0], m[1])))
}

/** Every letter's colour for a look. */
export function heroArtPalette(look: HeroLook): Record<string, string> {
  const pal: Record<string, string> = { ...HERO_FIXED }
  for (const r of ROLES) {
    // A dress is the skirt in the shirt's colours, slot for slot.
    const src: HeroRole = r === 'bottom' && look.bottom === 'dress' ? 'top' : r
    const cs = slots(src, look[ROLE_KEY[src]], DRAWN_LOOK[ROLE_KEY[src]])
    const letters = HERO_LETTERS[r]
    for (let i = 0; i < letters.length; i++) {
      const c = cs[Math.min(i, cs.length - 1)]
      if (c && i < HERO_DRAWN[r].length) pal[letters[i]!] = c
    }
  }
  return pal
}

/** The art's parts (`heroArt.ts`); a test may hand in fewer. */
export interface HeroParts {
  heads: Record<string, HeroPart>
  overs: Record<string, HeroPart>
  bodies: Record<string, HeroPart>
  arms: Record<string, HeroPart>
}
export const HERO_PARTS: HeroParts = { heads: HERO_HEADS, overs: HERO_OVERS, bodies: HERO_BODIES, arms: HERO_ARMS }

type Kind = 'trousers' | 'shorts' | 'skirt'
const kindOf = (s: HeroShape): Kind => (s.bottom === 'dress' ? 'skirt' : s.bottom)

/** Is every part of a shape drawn? (Otherwise the hero is the classic one, whole.) */
export function heroArtCovers(s: HeroShape, P: HeroParts = HERO_PARTS): boolean {
  const k = kindOf(s)
  for (const f of ['front', 'back'] as const) {
    if (!P.heads[`${s.hair}/${s.head}/${f}`]) return false
    for (const p of ART_POSES) if (!P.bodies[`${p}/${f}/${k}`]) return false
  }
  for (const p of ART_FRONT_POSES) if (!P.bodies[`${p}/front/${k}`]) return false
  return true
}

/** A frame as rows of letters, with its foot point (where the classic sprite's bottom centre lands, in its px). */
export interface ArtFrame { rows: string[]; ax: number; ay: number }

type Grid = { x0: number; y0: number; w: number; h: number; g: string[][] }
function grid(parts: Array<[HeroPart, number, number]>): Grid {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const [p, ox, oy] of parts) {
    x0 = Math.min(x0, ox + p.x); y0 = Math.min(y0, oy + p.y)
    x1 = Math.max(x1, ox + p.x + (p.rows[0]?.length ?? 0)); y1 = Math.max(y1, oy + p.y + p.rows.length)
  }
  const w = x1 - x0
  const h = y1 - y0
  return { x0, y0, w, h, g: Array.from({ length: h }, () => Array<string>(w).fill('.')) }
}
function lay(G: Grid, p: HeroPart, ox: number, oy: number, rows = p.rows) {
  for (let y = 0; y < rows.length; y++) {
    const r = rows[y]!
    for (let x = 0; x < r.length; x++) {
      const ch = r[x]!
      if (ch !== '.') G.g[oy + p.y + y - G.y0]![ox + p.x + x - G.x0] = ch
    }
  }
}

/** The face as the pose has it: `hurt` squeezes the eyes shut and opens the mouth, `get` opens it in a shout. */
function face(rows: readonly string[], pose: string): readonly string[] {
  if (pose !== 'hurt' && pose !== 'get') return rows
  const g = rows.map(r => r.split(''))
  const eyes: Array<[number, number]> = []
  g.forEach((r, y) => r.forEach((ch, x) => { if (ch === 'z') eyes.push([x, y]) }))
  if (!eyes.length) return rows
  const shade = HERO_LETTERS.skin[2]!
  const low = Math.max(...eyes.map(e => e[1]))
  const xs = [...new Set(eyes.map(e => e[0]))].sort((a, b) => a - b)
  const mid = Math.round((xs[0]! + xs[xs.length - 1]!) / 2)
  if (pose === 'hurt') {
    // Shut: each eye a short dark line on its lowest row, the rest of it skin in shade.
    for (const [x, y] of eyes) g[y]![x] = shade
    for (const x of xs) { g[low]![x] = 'z'; if (g[low]![x + 1] && 'fghij'.includes(g[low]![x + 1]!)) g[low]![x + 1] = 'z' }
  }
  // The open mouth, two rows under the eyes, between them.
  const my = low + 2
  for (const x of [mid, mid + 1]) {
    if (g[my]?.[x] && 'fghij'.includes(g[my]![x]!)) g[my]![x] = pose === 'hurt' ? 'z' : 'Z'
  }
  if (pose === 'get') for (const x of [mid, mid + 1]) if (g[my + 1]?.[x] && 'fghij'.includes(g[my + 1]![x]!)) g[my + 1]![x] = 'Z'
  return g.map(r => r.join(''))
}

/** A drawn pose, facing front or back, in a shape (null: not drawn). */
function composed(pose: string, f: ArtFacing, s: HeroShape, P: HeroParts): ArtFrame | null {
  const body = P.bodies[`${pose}/${f}/${kindOf(s)}`]
  const head = P.heads[`${s.hair}/${s.head}/${f}`]
  if (!body || !head) return null
  const over = P.overs[`${s.hair}/${s.head}/${f}`]
  const arms = P.arms[`${pose}/${f}`]
  const nx = body.nx ?? 0
  const ny = body.ny ?? 0
  const parts: Array<[HeroPart, number, number]> = [[body, 0, 0], [head, nx, ny]]
  if (over) parts.push([over, nx, ny])
  if (arms) parts.push([arms, 0, 0])
  const G = grid(parts)
  lay(G, body, 0, 0)
  lay(G, head, nx, ny, face(head.rows, pose))
  if (over) lay(G, over, nx, ny)
  if (arms) lay(G, arms, 0, 0)
  return { rows: G.g.map(r => r.join('')), ax: -G.x0, ay: -G.y0 }
}

/** Nearest-neighbour shrink, as the classic falling frames: the figure scaled, centred on a row of a 2×-size frame. */
function shrunk(fr: ArtFrame, scale: number, cy: number): ArtFrame {
  const sw = fr.rows[0]!.length
  const sh = fr.rows.length
  const dw = Math.max(1, Math.round(sw * scale))
  const dh = Math.max(1, Math.round(sh * scale))
  const rows: string[] = []
  for (let y = 0; y < dh; y++) {
    let r = ''
    for (let x = 0; x < dw; x++) r += fr.rows[Math.floor((y + 0.5) / scale)]?.[Math.floor((x + 0.5) / scale)] ?? '.'
    rows.push(r)
  }
  // (The classic frame is 16 high with its foot point under the last row: a row cy of it is 2·cy here, from 32 up.)
  const top = Math.round(2 * cy - dh / 2)
  return { rows, ax: Math.round(fr.ax * scale), ay: 32 - top }
}

/** Turned on its side, the head to the right, lying on the ground (as the classic `hero_dead`). */
function lying(fr: ArtFrame): ArtFrame {
  const h = fr.rows.length
  const w = fr.rows[0]!.length
  const rows: string[] = []
  for (let x = 0; x < w; x++) {
    let r = ''
    for (let y = h - 1; y >= 0; y--) r += fr.rows[y]![x]!
    rows.push(r)
  }
  // Rotated clockwise: the feet are on the left. The classic frame's middle is 8 of its px (16 here) from them.
  let bottom = rows.length - 1
  while (bottom > 0 && !/[^.]/.test(rows[bottom]!)) bottom--
  const feet = h - fr.ay
  return { rows: rows.slice(0, bottom + 1), ax: feet + 16, ay: bottom + 1 }
}

/**
 * The frame for a classic hero sprite's name, mirrored or not, in a shape (null: no art for it). A frame of a pose
 * drawn both ways is the front or the back, mirrored, as `facingOf` maps the folk's four-way frames.
 */
export function heroArtFrame(name: string, flip: boolean, s: HeroShape, P: HeroParts = HERO_PARTS): { frame: ArtFrame; flip: boolean } | null {
  const m = /^hero_(down|up|side)_(.+)$/.exec(name)
  if (m) {
    const pose = m[2]!
    const four = m[1] === 'down' ? { f: 'front' as const, flip: false } : m[1] === 'up' ? { f: 'back' as const, flip: true } : flip ? { f: 'back' as const, flip: false } : { f: 'front' as const, flip: true }
    const fr = composed(pose, four.f, s, P)
    return fr ? { frame: fr, flip: four.flip } : null
  }
  if (name === 'hero_get' || name === 'hero_hurt') {
    const fr = composed(name.slice(5), 'front', s, P)
    return fr ? { frame: fr, flip } : null
  }
  const stand = () => composed('0', 'front', s, P)
  const fall = /^hero_fall_(\d)$/.exec(name)
  if (fall) {
    const st = stand()
    const i = Number(fall[1])
    return st ? { frame: shrunk(st, [0.75, 0.5, 0.25][i] ?? 0.25, [10, 11, 12][i] ?? 12), flip } : null
  }
  if (name === 'hero_dead') {
    const st = stand()
    return st ? { frame: lying(st), flip } : null
  }
  return null
}

/**
 * The art for a classic hero sprite in a shape, or null for the classic sprite: for every frame of a shape that is not
 * wholly drawn (never a drawn head on classic legs, nor a drawn walk with a classic swing).
 */
export function heroArtFor(name: string, flip: boolean, s: HeroShape, P: HeroParts = HERO_PARTS): { frame: ArtFrame; flip: boolean } | null {
  return heroArtCovers(s, P) ? heroArtFrame(name, flip, s, P) : null
}

/** Every frame name the art draws, for the lab and the tests. */
export const HERO_ART_NAMES: readonly string[] = [
  ...['down', 'up', 'side'].flatMap(d => ART_POSES.map(p => `hero_${d}_${p}`)),
  'hero_get', 'hero_hurt', 'hero_fall_0', 'hero_fall_1', 'hero_fall_2', 'hero_dead',
]

type Canvas = HTMLCanvasElement
/** A frame as a canvas, with its foot point (as `folk.ts`'s `FolkPic`). */
export interface HeroPic { c: Canvas; ax: number; ay: number }

function paint(fr: ArtFrame, pal: Record<string, string>, flip: boolean, color?: string): HeroPic {
  const h = fr.rows.length
  const w = fr.rows[0]?.length ?? 0
  const c = makeCanvas(w, h)
  const g = c.getContext('2d')!
  const img = g.createImageData(w, h)
  for (let y = 0; y < h; y++) {
    const row = fr.rows[y]!
    for (let x = 0; x < w; x++) {
      const col = color ?? pal[row[x]!]
      if (row[x] === '.' || !col) continue
      const o = (y * w + (flip ? w - 1 - x : x)) * 4
      img.data[o] = parseInt(col.slice(1, 3), 16)
      img.data[o + 1] = parseInt(col.slice(3, 5), 16)
      img.data[o + 2] = parseInt(col.slice(5, 7), 16)
      img.data[o + 3] = 255
    }
  }
  g.putImageData(img, 0, 0)
  return { c, ax: flip ? w - fr.ax : fr.ax, ay: fr.ay }
}

const pics = new Map<string, HeroPic | null>()
let picsLook = ''
let pal: Record<string, string> = {}

/**
 * The isometric picture for a classic hero sprite the painter is drawing (or its silhouette in a colour), in what the
 * hero wears now; null when the art has none for it: a shape not drawn, or a hero the studio has redrawn.
 */
export function heroPic(tag: SpriteTag): HeroPic | null {
  if (tag.flipV || heroStudioEdited()) return null
  const look = heroStyle()
  const lk = heroLookKey(look)
  if (lk !== picsLook) { picsLook = lk; pics.clear(); pal = heroArtPalette(look) }
  const key = `${tag.name}|${tag.flip ? 'f' : ''}|${tag.color ?? ''}`
  let p = pics.get(key)
  if (p === undefined) {
    const a = heroArtFor(tag.name, tag.flip, look)
    p = a ? paint(a.frame, pal, a.flip, tag.color) : null
    pics.set(key, p)
  }
  return p
}

const blades = new Map<string, HeroPic | null>()
/**
 * The blade the painter is drawing (`sword_*`, `sword2_*`, mirrored either way), at the art's density: twice the
 * classic sprite's size, so it lands exactly where the classic one does, its middle on the same point.
 */
export function bladePic(tag: SpriteTag): HeroPic | null {
  const key = `${tag.name}|${tag.flip ? 'f' : ''}|${tag.flipV ? 'v' : ''}|${tag.color ?? ''}`
  let p = blades.get(key)
  if (p === undefined) {
    const rows = BLADE_ART[tag.name]
    if (!rows) p = null
    else {
      const r = tag.flipV ? [...rows].reverse() : rows
      p = paint({ rows: [...r], ax: 0, ay: r.length }, BLADE_PAL, !!tag.flip, tag.color)
      p.ax = p.c.width / 2
    }
    blades.set(key, p)
  }
  return p
}
