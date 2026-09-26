/**
 * The bridge to Neon Shrine: the active person's colours for its pixel
 * hero (see HeroColors in types.ts). Neon Shrine reads them from
 * localStorage on load; Mini World writes them whenever the look changes.
 */
import { HERO_COLORS_KEY, type HeroColors, type PersonLook } from '../types'
import { SKINS, HAIR_COLORS, clothing, coversLegs } from '../catalog'

/** A hex colour darkened by `f` (0..1), for the two-tone shades. */
export function shade(hex: string, f = 0.28): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return hex
  const n = parseInt(m[1]!, 16)
  const ch = (s: number) => Math.round(((n >> s) & 255) * (1 - f))
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')
}

export function heroColorsFor(look: PersonLook): HeroColors {
  const skin = SKINS.find(s => s.id === look.skin) ?? SKINS[1]!
  const hair = HAIR_COLORS.find(h => h.id === look.hairColor) ?? HAIR_COLORS[1]!
  // Rainbow hair cannot stripe on a few pixels: a pink over violet pair reads as it.
  const hairPair = look.hairColor === 'rainbow' ? { color: '#ff6fb0', shade: '#a86fff' } : { color: hair.color, shade: hair.shade }
  // No hair: the head is skin.
  const bald = look.hair === 'none'
  const hairColor = bald ? skin.color : hairPair.color
  const hairShade = bald ? skin.shade : hairPair.shade

  const top = clothing(look.outfit.top)
  const topMain = top?.colors.main ?? '#f4f0ff'
  const topAccent = top?.colors.second ?? top?.colors.accent ?? shade(topMain, 0.45)
  // A dress or gown is the trousers too: its lower half in its own darker tone.
  const bottomDef = coversLegs(look.outfit.top) ? null : clothing(look.outfit.bottom)
  const bottom = bottomDef ? bottomDef.colors.main : shade(topMain, 0.15)
  const shoes = clothing(look.outfit.shoes)?.colors.main ?? '#f4f0ff'
  const hat = clothing(look.outfit.hat)

  return {
    skin: skin.color,
    skinShade: skin.shade,
    hair: hairColor,
    hairShade,
    band: hat?.colors.main ?? hairColor,
    top: topMain,
    topShade: shade(topMain),
    topAccent,
    bottom,
    shoes,
  }
}

/** Stores the colours for Neon Shrine; silent when storage is unavailable. */
export function writeHeroColors(look: PersonLook): void {
  try {
    localStorage.setItem(HERO_COLORS_KEY, JSON.stringify(heroColorsFor(look)))
  } catch {
    // private mode or no window: Neon Shrine keeps its own hero
  }
}
