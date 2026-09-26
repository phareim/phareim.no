/**
 * The bridge to Neon Shrine: the active figure's colours for its pixel
 * hero (HeroColors, the same ten fields Mini World writes; see
 * themes/zelda/render/heroColors.ts). Neon Shrine reads `figur.heroColors`
 * first and Mini World's only when there is no figure.
 *
 * Colours come from what the figure actually wears, drawn clothes too:
 * the top's torso gives the shirt (its most used colour) and the stripe
 * (its second), the bottom or a dress's skirt the trousers, the shoes
 * the shoes, the hat the headband.
 */
import {
  DRESS_SKIRT_ROW, FIGUR_HERO_KEY, TOP_COLS,
  type DrawnGarment, type Figure, type HeroColors, type Hex,
} from '../types'
import { SKINS } from '../catalog'
import { mix, shade } from './color'
import { resolveOutfit, topColors } from './textures'

/** Rainbow hair cannot stripe on a few pixels: pink over violet reads as it. */
const RAINBOW_HAIR = { color: '#ff6fb0', shade: '#a86fff' }
/** A figure with no top: the hero's shirt stays light. */
const NO_TOP = '#f4f0ff'

const TORSO = { x: TOP_COLS.torso[0], y: 0, w: TOP_COLS.torso[1] - TOP_COLS.torso[0] + 1, h: DRESS_SKIRT_ROW }

export function heroColorsFor(figure: Figure, closet: readonly DrawnGarment[]): HeroColors {
  const skinDef = SKINS.find(s => s.id === figure.body.skin) ?? SKINS[1]!
  const bald = figure.body.hair === 'none'
  const rainbow = figure.body.hairColor === 'rainbow'
  const hair: Hex = bald ? skinDef.color : rainbow ? RAINBOW_HAIR.color : figure.body.hairColor
  const hairShade: Hex = bald ? skinDef.shade : rainbow ? RAINBOW_HAIR.shade : shade(figure.body.hairColor, 0.3)

  const { tex, kind } = resolveOutfit(figure, closet)
  const torso = tex.top ? topColors(tex.top, TORSO) : { main: null, second: null }
  const top = torso.main ?? NO_TOP
  const topAccent = torso.second ?? shade(top, 0.45)

  let bottom: Hex | null = null
  if (kind.top === 'dress' && tex.top) {
    bottom = topColors(tex.top, { x: 0, y: DRESS_SKIRT_ROW, w: tex.top.w, h: tex.top.h - DRESS_SKIRT_ROW }).main
  } else if (tex.bottom) {
    bottom = topColors(tex.bottom).main
  }
  const shoes = tex.shoes ? topColors(tex.shoes).main : null
  const band = tex.hat ? topColors(tex.hat).main : null

  return {
    skin: skinDef.color,
    skinShade: skinDef.shade,
    hair,
    hairShade,
    band: band ?? hair,
    top,
    topShade: shade(top),
    topAccent,
    bottom: bottom ?? shade(top, 0.15),
    // Barefoot: pale feet, a little skin in the white.
    shoes: shoes ?? mix(skinDef.color, '#ffffff', 0.5),
  }
}

/** Store the colours for Neon Shrine (null removes them); silent without storage. */
export function writeHeroColors(figure: Figure | null, closet: readonly DrawnGarment[]): void {
  try {
    if (!figure) localStorage.removeItem(FIGUR_HERO_KEY)
    else localStorage.setItem(FIGUR_HERO_KEY, JSON.stringify(heroColorsFor(figure, closet)))
  } catch {
    // private mode or no window: Neon Shrine keeps the hero it has
  }
}
