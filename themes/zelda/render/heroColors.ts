/**
 * Mini World's clothes on Neon Shrine's hero. Mini World writes the active
 * person's colours to localStorage `miniworld.heroColors` (`HeroColors`);
 * the shell reads them and hands them to `setHeroColors`, which swaps the
 * palette of the `hero_*` sprites only (other sprites share the letters).
 * Without colours the hero is exactly as drawn.
 *
 * The hero's palette letters, band by band (render/sprites.ts):
 *   h hair, H its highlight · p headband (the hat, or hair when bare)
 *   s skin, S its shade · c shirt, C its shade, w the shirt's stripe
 *   y belt · B trousers · E shoes · M the open mouth (kept pink) · k outline (kept)
 */
import type { HeroColors } from '../../miniworld/types'

const HEX = /^#[0-9a-f]{6}$/i
const FIELDS: Array<keyof HeroColors> = ['skin', 'skinShade', 'hair', 'hairShade', 'band', 'top', 'topShade', 'topAccent', 'bottom', 'shoes']

/** HeroColors from storage, or null for anything short of all ten #rrggbb strings. */
export function parseHeroColors(raw: unknown): HeroColors | null {
  let v = raw
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch { return null } }
  if (!v || typeof v !== 'object') return null
  const r = v as Record<string, unknown>
  for (const f of FIELDS) if (typeof r[f] !== 'string' || !HEX.test(r[f] as string)) return null
  const out = {} as HeroColors
  for (const f of FIELDS) out[f] = (r[f] as string).toLowerCase()
  return out
}

/** Mix `hex` toward `to` by `t` (0..1). */
export function mix(hex: string, to: string, t: number): string {
  const a = parseInt(hex.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const ch = (sh: number) => Math.round(((a >> sh) & 255) * (1 - t) + ((b >> sh) & 255) * t)
  return '#' + ((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')
}

/** The hero's palette letters in these colours. */
export function heroPalette(c: HeroColors): Record<string, string> {
  return {
    h: c.hair,
    H: mix(c.hair, '#ffffff', 0.3),
    p: c.band,
    s: c.skin,
    S: c.skinShade,
    c: c.top,
    C: c.topShade,
    w: c.topAccent,
    y: mix(c.bottom, '#0b0616', 0.35),
    B: c.bottom,
    E: c.shoes,
  }
}

/** A stable key for a colour set (null: the drawn hero). */
export function heroColorsKey(c: HeroColors | null): string {
  return c ? FIELDS.map(f => c[f]).join(',') : ''
}
