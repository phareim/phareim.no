/**
 * A figure: a new one, a random one whose colours go together, dressing
 * and undressing, body changes, and the strict parser a save goes
 * through. Pure; randomness comes from an `Rng` (makeRng for a seeded
 * one), with Math.random only as a default argument.
 */
import {
  KIND_SLOT, SLOTS,
  type Figure, type FigureBody, type GarmentKind, type Hex, type Outfit, type Slot, type StyleId, type Worn,
  type SkinId, type HairStyle, type EyeStyle, type MouthStyle,
} from '../types'
import { SKINS, HAIR_COLORS, HAIR_STYLES, EYES, MOUTHS, EYE_COLORS, GARMENTS, garment } from '../catalog'
import { cleanHex } from './color'

// ---------------------------------------------------------------- randomness

export type Rng = () => number

/** A seeded random source (mulberry32): the same seed gives the same figures. */
export function makeRng(seed: number): Rng {
  let a = (seed >>> 0) || 0x9e3779b9
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const pick = <T>(rng: Rng, list: readonly T[]): T => list[Math.floor(rng() * list.length) % list.length]!

const ID_CHARS = '0123456789abcdefghijklmnopqrstuvwxyz'

/** 'f-' or 'd-' and eight random [a-z0-9], not in `taken`. */
export function newId(prefix: 'f-' | 'd-', rng: Rng = Math.random, taken: Iterable<string> = []): string {
  const used = new Set(taken)
  for (;;) {
    let id = prefix
    for (let i = 0; i < 8; i++) id += ID_CHARS[Math.floor(rng() * 36) % 36]
    if (!used.has(id)) return id
  }
}

export const FIGURE_ID_RE = /^f-[a-z0-9]{8}$/
export const STYLE_IDS: readonly StyleId[] = ['minecraft', 'roblox', 'toca', 'avatar']

// ---------------------------------------------------------------- names

/** Letters a name may hold: Norwegian letters, the accents the pixel font draws, digits, space and hyphen. */
const NAME_CHARS = /^[A-Za-zÆØÅæøåÄÖÜäöüÉÈéè0-9\- ]+$/

/**
 * A name as it will be stored: trimmed, inner spaces collapsed, 1–`max`
 * characters of letters, digits, space and hyphen. Anything else → null.
 */
export function cleanName(raw: unknown, max = 16): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.normalize('NFC').replace(/\s+/g, ' ').trim()
  if (!s || [...s].length > max || !NAME_CHARS.test(s) || !/[^\- ]/.test(s)) return null
  return s
}

// ---------------------------------------------------------------- new figures

const worn = (id: string, color?: Hex, color2?: Hex): Worn =>
  ({ id, ...(color ? { color } : {}), ...(color2 ? { color2 } : {}) })

export const emptyOutfit = (): Outfit => ({ top: null, bottom: null, shoes: null, hat: null, face: null, back: null })

/** A friendly default: T-skjorte, jeans and joggesko, a ponytail. */
export function newFigure(name = 'Figur 1', rng: Rng = Math.random): Figure {
  return {
    id: newId('f-', rng),
    name: cleanName(name) ?? 'Figur 1',
    body: {
      skin: 'lys', hair: 'ponytail', hairColor: '#5e3a24', eyes: 'round', eyeColor: '#6b3f24',
      mouth: 'smile', cheeks: true, freckles: false,
    },
    outfit: { ...emptyOutfit(), top: worn('tskjorte'), bottom: worn('jeans'), shoes: worn('joggesko') },
    style: 'minecraft',
  }
}

/** Colour schemes a random figure picks from: four colours that go together. */
export const SCHEMES: Array<{ name: string; colors: [Hex, Hex, Hex, Hex] }> = [
  { name: 'godteri', colors: ['#ff7eb6', '#9fd4ff', '#ffffff', '#d6b3ff'] },
  { name: 'hav', colors: ['#3a8dff', '#3fd6cf', '#ffffff', '#1f3f9f'] },
  { name: 'skog', colors: ['#3fbf5f', '#ffd93b', '#7a4a2c', '#1f7a4a'] },
  { name: 'solnedgang', colors: ['#ff8a2a', '#ff3d9a', '#ffd93b', '#9b5cff'] },
  { name: 'natt', colors: ['#1f3f9f', '#ffd93b', '#9b5cff', '#22222b'] },
  { name: 'jordbær', colors: ['#e8333d', '#ffc2dd', '#ffffff', '#3fbf5f'] },
  { name: 'sitron', colors: ['#ffd93b', '#3a8dff', '#ffffff', '#a4e86b'] },
  { name: 'lavendel', colors: ['#d6b3ff', '#9b5cff', '#ffc2dd', '#ffffff'] },
  { name: 'klassisk', colors: ['#3a8dff', '#ffffff', '#e8333d', '#22222b'] },
  { name: 'høst', colors: ['#ff8a2a', '#7a4a2c', '#ffd93b', '#c68a5c'] },
]

const NATURAL_SKINS: SkinId[] = ['porselen', 'lys', 'honning', 'oliven', 'brun', 'mork']
const FANTASY_SKINS: SkinId[] = ['bla', 'gronn', 'lilla']
const NATURAL_HAIR = ['blond', 'lysebrun', 'brun', 'svart', 'rod']
const FUN_HAIR = ['rosa', 'bla', 'lilla', 'gronn', 'turkis', 'hvit', 'regnbue']

const byKind = (...kinds: GarmentKind[]) => GARMENTS.filter(d => kinds.includes(d.kind))

/**
 * A whole figure whose colours go together: one scheme from SCHEMES
 * dresses it (top in the first colour with the second as trim, bottom in
 * the third or plain denim, shoes and hat in the scheme too), mostly
 * natural skin and hair, sometimes a fantasy touch.
 */
export function randomFigure(rng: Rng = Math.random, name = 'Figur 1'): Figure {
  const [c0, c1, c2, c3] = pick(rng, SCHEMES).colors
  const fig = newFigure(name, rng)
  const hairId = rng() < 0.75 ? pick(rng, NATURAL_HAIR) : pick(rng, FUN_HAIR)
  const body: FigureBody = {
    skin: rng() < 0.88 ? pick(rng, NATURAL_SKINS) : pick(rng, FANTASY_SKINS),
    hair: rng() < 0.04 ? 'none' : pick(rng, HAIR_STYLES.filter(h => h.id !== 'none')).id,
    hairColor: HAIR_COLORS.find(h => h.id === hairId)!.color,
    eyes: pick(rng, EYES).id,
    eyeColor: pick(rng, EYE_COLORS),
    mouth: pick(rng, MOUTHS).id,
    cheeks: rng() < 0.6,
    freckles: rng() < 0.2,
  }
  const outfit = emptyOutfit()
  if (rng() < 0.35) {
    outfit.top = worn(pick(rng, byKind('dress')).id, c0, c1)
  } else {
    outfit.top = worn(pick(rng, byKind('tee', 'long', 'tank', 'hoodie', 'shirt')).id, c0, c1)
    const bottom = pick(rng, byKind('pants', 'shorts', 'skirt', 'leggings'))
    outfit.bottom = bottom.id === 'jeans' && rng() < 0.6 ? worn('jeans') : worn(bottom.id, c2 === '#ffffff' ? c3 : c2, c1)
  }
  outfit.shoes = worn(pick(rng, byKind('sneaker', 'boot', 'flat')).id, rng() < 0.5 ? c1 : c3, '#ffffff')
  if (rng() < 0.5) outfit.hat = worn(pick(rng, byKind('hat')).id, c1, c0)
  if (rng() < 0.2) outfit.face = worn(pick(rng, byKind('glasses')).id)
  if (rng() < 0.2) outfit.back = worn(pick(rng, byKind('cape', 'wings')).id, c1, c3)
  return { ...fig, body, outfit }
}

// ---------------------------------------------------------------- changes

/**
 * Put `w` on in `slot` (null takes the slot off). A catalog piece that
 * belongs in another slot is refused (the figure comes back unchanged);
 * drawn ids are not checked here (see parseFigure).
 */
export function wear(fig: Figure, slot: Slot, w: Worn | null): Figure {
  if (w) {
    const def = garment(w.id)
    if (def && KIND_SLOT[def.kind] !== slot) return fig
    const clean: Worn = { id: w.id }
    const c1 = cleanHex(w.color)
    const c2 = cleanHex(w.color2)
    if (c1) clean.color = c1
    if (c2) clean.color2 = c2
    w = clean
  }
  return { ...fig, outfit: { ...fig.outfit, [slot]: w } }
}

/** Change body parts; fields that are not valid are ignored. */
export function setBody(fig: Figure, patch: Partial<FigureBody>): Figure {
  const b = parseBody({ ...fig.body, ...patch })
  if (b) return { ...fig, body: b }
  // Some field was bad: apply the good ones one by one.
  let body = fig.body
  for (const [k, v] of Object.entries(patch)) {
    const next = parseBody({ ...body, [k]: v })
    if (next) body = next
  }
  return body === fig.body ? fig : { ...fig, body }
}

// ---------------------------------------------------------------- parsing

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const inList = <T extends string>(list: ReadonlyArray<{ id: T }>, v: unknown): v is T =>
  typeof v === 'string' && list.some(x => x.id === v)

/** A body with every field valid, or null. */
export function parseBody(x: unknown): FigureBody | null {
  if (!isObj(x)) return null
  if (!inList<SkinId>(SKINS, x.skin) || !inList<HairStyle>(HAIR_STYLES, x.hair)
    || !inList<EyeStyle>(EYES, x.eyes) || !inList<MouthStyle>(MOUTHS, x.mouth)) return null
  const hairColor = x.hairColor === 'rainbow' ? 'rainbow' : cleanHex(x.hairColor)
  const eyeColor = cleanHex(x.eyeColor)
  if (!hairColor || !eyeColor) return null
  if (typeof x.cheeks !== 'boolean' || typeof x.freckles !== 'boolean') return null
  return { skin: x.skin, hair: x.hair, hairColor, eyes: x.eyes, eyeColor, mouth: x.mouth, cheeks: x.cheeks, freckles: x.freckles }
}

/** What parseFigure may find in the closet: ids, or drawn pieces (then their slot is checked too). */
export type ClosetRef = string | { id: string; kind: GarmentKind }

/**
 * A figure from a save, or null when its id, name, body or style is not
 * valid. Worn pieces that are neither in the catalog nor in `closet`, or
 * sit in the wrong slot, or carry a bad colour, are taken off (the
 * figure survives).
 */
export function parseFigure(raw: unknown, closet: Iterable<ClosetRef> = []): Figure | null {
  if (!isObj(raw)) return null
  if (typeof raw.id !== 'string' || !FIGURE_ID_RE.test(raw.id)) return null
  const name = cleanName(raw.name)
  if (!name) return null
  const body = parseBody(raw.body)
  if (!body) return null
  if (typeof raw.style !== 'string' || !(STYLE_IDS as readonly string[]).includes(raw.style)) return null
  const drawn = new Map<string, GarmentKind | null>()
  for (const c of closet) {
    if (typeof c === 'string') drawn.set(c, null)
    else drawn.set(c.id, c.kind)
  }
  const outfit = emptyOutfit()
  const rawOutfit = isObj(raw.outfit) ? raw.outfit : {}
  for (const slot of SLOTS) {
    const w = rawOutfit[slot]
    if (!isObj(w) || typeof w.id !== 'string') continue
    const def = garment(w.id)
    if (def) {
      if (KIND_SLOT[def.kind] !== slot) continue
    } else if (drawn.has(w.id)) {
      const kind = drawn.get(w.id)
      if (kind && KIND_SLOT[kind] !== slot) continue
    } else continue
    if (w.color !== undefined && !cleanHex(w.color)) continue
    if (w.color2 !== undefined && !cleanHex(w.color2)) continue
    outfit[slot] = worn(w.id, cleanHex(w.color) ?? undefined, cleanHex(w.color2) ?? undefined)
  }
  return { id: raw.id, name, body, outfit, style: raw.style as StyleId }
}
