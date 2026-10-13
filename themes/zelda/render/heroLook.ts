/**
 * The hero's look, as the NEW LOOK booth in town sets it: a shape (hair, what
 * is on the head, what is worn below the belt; render/heroFrames.ts) and eight
 * colours. Kept in localStorage `zelda.heroLook`, with the made figure's
 * colours (render/heroColors.ts) it was chosen over. The newest choice is
 * worn: the look, until the figure is changed after it (`wornLook`); then the
 * figure's colours again. With neither the hero is as drawn.
 *
 * `DRAWN_LOOK` is the hero as first drawn, and its palette is the sprite
 * sheet's own: a colour left at the drawn one keeps the drawn shade beside
 * it, any other gets a shade mixed from it.
 */
import type { HeroColors } from '../../miniworld/types'
import { BOTTOMS, DRAWN_SHAPE, HAIR_STYLES, HEADWEAR, type Bottoms, type HairStyle, type Headwear, type HeroShape } from './heroFrames'
import { heroColorsKey, mix } from './heroColors'

export const HERO_LOOK_KEY = 'zelda.heroLook'

export interface HeroLook extends HeroShape {
  skin: string
  hairColor: string
  /** The headband or the bow. */
  headColor: string
  top: string
  /** The stripe down the shirt's front. */
  stripe: string
  belt: string
  /** Trousers, shorts or skirt (a dress takes the shirt's colour). */
  bottomColor: string
  shoes: string
}

export type LookColorKey = 'skin' | 'hairColor' | 'headColor' | 'top' | 'stripe' | 'belt' | 'bottomColor' | 'shoes'
export type LookStyleKey = 'hair' | 'head' | 'bottom'
export type LookKey = LookStyleKey | LookColorKey

export const DRAWN_LOOK: HeroLook = {
  ...DRAWN_SHAPE,
  skin: '#f5c3a8',
  hairColor: '#3a1a4a',
  headColor: '#ff2fa0',
  top: '#2ff3ff',
  stripe: '#fff4ff',
  belt: '#ffd23f',
  bottomColor: '#1a2f78',
  shoes: '#fff4ff',
}

/** The same hero as a girl: long hair, a bow, a skirt. Every part can still be changed on its own. */
export const GIRL_LOOK: HeroLook = {
  ...DRAWN_LOOK,
  hair: 'long',
  head: 'bow',
  bottom: 'skirt',
  bottomColor: '#9a4ff0',
}

/** The shades the drawn hero has beside its own colours (the sheet's palette). */
const DRAWN_SHADES = { hair: '#7a3a8a', skin: '#c98576', top: '#1a9fc4' }

export interface Choice { v: string; name: string }

const SKIN: Choice[] = [
  { v: '#ffe3d2', name: 'PORCELAIN' },
  { v: '#f5c3a8', name: 'PEACH' },
  { v: '#e6a57e', name: 'HONEY' },
  { v: '#cf8a5c', name: 'TAN' },
  { v: '#a9683f', name: 'BRONZE' },
  { v: '#80492b', name: 'CHESTNUT' },
  { v: '#58301f', name: 'COCOA' },
  { v: '#8fe6b0', name: 'MINT' },
  { v: '#b9a8ff', name: 'LILAC' },
  { v: '#7fd4ff', name: 'SKY' },
]

const HAIR: Choice[] = [
  { v: '#3a1a4a', name: 'PLUM' },
  { v: '#1c1030', name: 'BLACK' },
  { v: '#6a4432', name: 'BROWN' },
  { v: '#b0543a', name: 'AUBURN' },
  { v: '#ff8a3d', name: 'GINGER' },
  { v: '#ffd23f', name: 'BLONDE' },
  { v: '#fff1b0', name: 'PLATINUM' },
  { v: '#cfc6ff', name: 'SILVER' },
  { v: '#ff2fa0', name: 'PINK' },
  { v: '#9a4ff0', name: 'VIOLET' },
  { v: '#2f5fd0', name: 'BLUE' },
  { v: '#2ff3ff', name: 'CYAN' },
  { v: '#b6ff4a', name: 'LIME' },
  { v: '#ff3b5c', name: 'RED' },
]

const CLOTH: Choice[] = [
  { v: '#fff4ff', name: 'WHITE' },
  { v: '#cfc6ff', name: 'LAVENDER' },
  { v: '#2ff3ff', name: 'CYAN' },
  { v: '#3fd8b0', name: 'TEAL' },
  { v: '#2f5fd0', name: 'BLUE' },
  { v: '#1a2f78', name: 'NAVY' },
  { v: '#9a4ff0', name: 'VIOLET' },
  { v: '#ff2fa0', name: 'PINK' },
  { v: '#ff8ae0', name: 'ROSE' },
  { v: '#ff3b5c', name: 'RED' },
  { v: '#ff8a3d', name: 'ORANGE' },
  { v: '#ffd23f', name: 'GOLD' },
  { v: '#b6ff4a', name: 'LIME' },
  { v: '#4f9a2a', name: 'GREEN' },
  { v: '#6a4432', name: 'BROWN' },
  { v: '#5a5285', name: 'GREY' },
  { v: '#1c1030', name: 'BLACK' },
]

const names = <T extends string>(vs: readonly T[], n: Record<T, string>): Choice[] => vs.map(v => ({ v, name: n[v] }))

export interface LookOption {
  key: LookKey
  label: string
  kind: 'style' | 'color'
  choices: Choice[]
}

/** Every part of the hero the booth can change, in the order the booth lists them. */
export const LOOK_OPTIONS: LookOption[] = [
  { key: 'hair', label: 'HAIR', kind: 'style', choices: names<HairStyle>(HAIR_STYLES, { short: 'SHORT', long: 'LONG', tail: 'PONYTAIL', pigtails: 'PIGTAILS' }) },
  { key: 'hairColor', label: 'HAIR COLOUR', kind: 'color', choices: HAIR },
  { key: 'head', label: 'ON THE HEAD', kind: 'style', choices: names<Headwear>(HEADWEAR, { band: 'HEADBAND', bow: 'BOW', none: 'NOTHING' }) },
  { key: 'headColor', label: 'ITS COLOUR', kind: 'color', choices: CLOTH },
  { key: 'skin', label: 'SKIN', kind: 'color', choices: SKIN },
  { key: 'top', label: 'SHIRT', kind: 'color', choices: CLOTH },
  { key: 'stripe', label: 'STRIPE', kind: 'color', choices: CLOTH },
  { key: 'belt', label: 'BELT', kind: 'color', choices: CLOTH },
  { key: 'bottom', label: 'BELOW', kind: 'style', choices: names<Bottoms>(BOTTOMS, { trousers: 'TROUSERS', shorts: 'SHORTS', skirt: 'SKIRT', dress: 'DRESS' }) },
  { key: 'bottomColor', label: 'ITS COLOUR', kind: 'color', choices: CLOTH },
  { key: 'shoes', label: 'SHOES', kind: 'color', choices: CLOTH },
]

const HEX = /^#[0-9a-f]{6}$/i
const COLOR_KEYS: LookColorKey[] = ['skin', 'hairColor', 'headColor', 'top', 'stripe', 'belt', 'bottomColor', 'shoes']
const isOneOf = <T extends string>(vs: readonly T[], v: unknown): v is T => typeof v === 'string' && (vs as readonly string[]).includes(v)

/** A look from storage, or null for anything short of a whole, valid one. */
export function parseHeroLook(raw: unknown): HeroLook | null {
  let v = raw
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch { return null } }
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  if (!isOneOf(HAIR_STYLES, r.hair) || !isOneOf(HEADWEAR, r.head) || !isOneOf(BOTTOMS, r.bottom)) return null
  const out = { hair: r.hair, head: r.head, bottom: r.bottom } as HeroLook
  for (const k of COLOR_KEYS) {
    const c = r[k]
    if (typeof c !== 'string' || !HEX.test(c)) return null
    out[k] = c.toLowerCase()
  }
  return out
}

/** The look's own fields as JSON, nothing else. */
export function serializeHeroLook(l: HeroLook): string {
  const out: Record<string, string> = { hair: l.hair, head: l.head, bottom: l.bottom }
  for (const k of COLOR_KEYS) out[k] = l[k]
  return JSON.stringify(out)
}

/** What goes into storage at WEAR IT: the look, and the made figure's colours it was chosen over (none: ''). */
export function storeHeroLook(l: HeroLook, figure: HeroColors | null): string {
  return JSON.stringify({ ...JSON.parse(serializeHeroLook(l)), over: heroColorsKey(figure) })
}

/**
 * The stored look, if it is still the newest choice: a made figure that has
 * changed since the look was chosen (or been made since) is worn instead.
 * With no figure the look stays.
 */
export function wornLook(raw: unknown, figure: HeroColors | null): HeroLook | null {
  const look = parseHeroLook(raw)
  if (!look) return null
  if (!figure) return look
  let over: unknown = ''
  try { over = (typeof raw === 'string' ? JSON.parse(raw) : raw as Record<string, unknown>)?.over ?? '' } catch { /* not JSON: parseHeroLook said no already */ }
  return over === heroColorsKey(figure) ? look : null
}

/** A stable key for a look (null: none set). */
export function heroLookKey(l: HeroLook | null): string {
  return l ? serializeHeroLook(l) : ''
}

export function sameLook(a: HeroLook, b: HeroLook): boolean {
  return heroLookKey(a) === heroLookKey(b)
}

/** The hero's palette letters for a look (the letters: heroColors.ts). */
export function lookPalette(l: HeroLook): Record<string, string> {
  const dress = l.bottom === 'dress'
  return {
    h: l.hairColor,
    H: l.hairColor === DRAWN_LOOK.hairColor ? DRAWN_SHADES.hair : mix(l.hairColor, '#ffffff', 0.3),
    p: l.headColor,
    s: l.skin,
    S: l.skin === DRAWN_LOOK.skin ? DRAWN_SHADES.skin : mix(l.skin, '#5a1a3a', 0.3),
    c: l.top,
    C: l.top === DRAWN_LOOK.top ? DRAWN_SHADES.top : mix(l.top, '#0b0616', 0.35),
    w: l.stripe,
    y: l.belt,
    B: dress ? l.top : l.bottomColor,
    E: l.shoes,
  }
}

/** A made figure's colours as a look the booth can go on from: the drawn shape in those clothes. */
export function lookFromColors(c: HeroColors): HeroLook {
  return {
    ...DRAWN_SHAPE,
    skin: c.skin,
    hairColor: c.hair,
    headColor: c.band,
    top: c.top,
    stripe: c.topAccent,
    belt: mix(c.bottom, '#0b0616', 0.35),
    bottomColor: c.bottom,
    shoes: c.shoes,
  }
}

/** Where the look's value for an option is in its choices (-1: a colour from elsewhere, like a figure's). */
export function choiceIndex(l: HeroLook, o: LookOption): number {
  return o.choices.findIndex(c => c.v === l[o.key])
}

/** The name of the look's value for an option. */
export function choiceName(l: HeroLook, o: LookOption): string {
  return o.choices[choiceIndex(l, o)]?.name ?? 'YOUR OWN'
}

/** The look with one option stepped to its next (d = 1) or previous (d = -1) choice, round and round. */
export function stepLook(l: HeroLook, key: LookKey, d: 1 | -1): HeroLook {
  const o = LOOK_OPTIONS.find(x => x.key === key)
  if (!o) return l
  const n = o.choices.length
  const i = choiceIndex(l, o)
  const next = i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n
  return { ...l, [key]: o.choices[next]!.v }
}

/** Whether an option does anything for this look (a colour for something not worn is left out). */
export function optionApplies(l: HeroLook, key: LookKey): boolean {
  if (key === 'headColor') return l.head !== 'none'
  if (key === 'bottomColor') return l.bottom !== 'dress'
  return true
}

/** A look picked at random from the booth's choices; `rnd` returns 0..1. */
export function randomLook(rnd: () => number = Math.random): HeroLook {
  const out: Record<string, string> = {}
  for (const o of LOOK_OPTIONS) out[o.key] = o.choices[Math.min(o.choices.length - 1, Math.floor(rnd() * o.choices.length))]!.v
  return out as unknown as HeroLook
}
