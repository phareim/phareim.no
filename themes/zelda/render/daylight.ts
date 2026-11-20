/**
 * The light of the hour (`engine/day.ts` keeps the clock). Pure: no canvas.
 *
 * A view's own values are the dusk the world was stuck in, and they stay
 * what the studio turns: at the hour 0 (and before the prism) `dayLook`
 * gives them back unchanged. The other hours are keyframes laid over them:
 * the sun's direction as a turn from the view's own, its shadows as a
 * multiple of the view's own length and strength, and the light and the sky
 * as blends of the view's dusk with its night, dawn and noon colours.
 *
 * The sun rises in the east (0°), stands in the south at noon (90°) and sets
 * in the west at the view's own angle; at night the moon throws faint
 * shadows along the same path. Each hands over to the other in the blue hour,
 * when nothing throws a shadow, so they never swing round in sight.
 */
import { DAY_LENGTH } from '../engine/day'

/** What `dayLook` needs: the view's own values (dusk) and its colours for the other hours. */
export interface DayBase {
  ambient: string
  sunAngle: number
  shadowLength: number
  shadow: number
  skyTop: string
  skyHorizon: string
  haze: string
  nightLight: string
  dawnLight: string
  noonLight: string
  nightSky: string
  nightHorizon: string
  dawnSky: string
  dawnHorizon: string
  noonSky: string
  noonHorizon: string
  /** How much brighter than the art the world is at noon (0: the art as painted). */
  noonBright: number
}

export interface DayLook {
  /** The light map's base colour outdoors. */
  ambient: string
  sunAngle: number
  shadowLength: number
  shadow: number
  skyTop: string
  skyHorizon: string
  haze: string
  /** The sun's height: −1 deep under the horizon, about 0.1 the stuck dusk, 1 noon. */
  sun: number
  /** How much of the low sun's warmth there is (rim, shafts): 1 at dusk and dawn, little at noon, none at night. */
  low: number
  /** Stars, 0–1. */
  stars: number
  /** Fireflies in the Wildwood, as a multiple of the dusk's. */
  fireflies: number
  /** The sun's glitter on Mirror Lake, 0–1. */
  glare: number
  /** Light beyond the art's own: the lit picture is brightened by this much (0 at dusk and night). */
  exposure: number
}

type Hour = 'dusk' | 'night' | 'dawn' | 'noon'
/** A colour of the hour, or a blend of two: [from, to, how far]. */
type Blend = Hour | readonly [Hour, Hour, number]

interface Key {
  at: number
  light: Blend
  sky: Blend
  /** The shadow-thrower's direction, degrees turned from the view's own sun (unwrapped). */
  turn: number
  len: number
  str: number
  sun: number
  stars: number
  flies: number
  glare: number
}

const k = (at: number, light: Blend, sky: Blend, turn: number, len: number, str: number, sun: number, stars: number, flies: number, glare: number): Key =>
  ({ at, light, sky, turn, len, str, sun, stars, flies, glare })

/**
 * The day, keyframe by keyframe. Two keys at the same second are a hand-over
 * (sun to moon at 135, moon to sun at 330), made while shadows are at their
 * faintest. The view's own sun stands at turn 0 (and 360): with its default
 * 205° the sun rises at 335° (turn 130) and stands in the south (90°) at 245.
 */
const KEYS: readonly Key[] = [
  k(0, 'dusk', 'dusk', 0, 1, 1, 0.12, 1, 1, 1),
  k(100, ['dusk', 'night', 0.45], ['dusk', 'night', 0.5], 12, 1.5, 0.4, -0.2, 1, 1.2, 0.35),
  k(135, ['dusk', 'night', 0.75], ['dusk', 'night', 0.8], 18, 1.7, 0.08, -0.45, 1, 1.4, 0),
  k(135, ['dusk', 'night', 0.75], ['dusk', 'night', 0.8], 150, 1.5, 0.08, -0.45, 1, 1.4, 0),
  k(170, 'night', 'night', 175, 1.2, 0.35, -0.8, 1, 1.6, 0),
  k(230, 'night', 'night', 245, 0.9, 0.45, -1, 1, 1.6, 0),
  k(290, 'night', 'night', 315, 1.2, 0.35, -0.8, 1, 1.5, 0),
  k(330, ['night', 'dawn', 0.2], ['night', 'dawn', 0.25], 350, 1.6, 0.08, -0.5, 0.9, 1.2, 0),
  k(330, ['night', 'dawn', 0.2], ['night', 'dawn', 0.25], 118, 2, 0.08, -0.5, 0.9, 1.2, 0),
  k(360, ['night', 'dawn', 0.45], ['night', 'dawn', 0.5], 124, 2, 0.3, -0.25, 0.7, 1, 0.25),
  k(420, 'dawn', 'dawn', 130, 1.7, 0.95, 0.05, 0.3, 0.6, 1),
  k(480, ['dawn', 'noon', 0.45], ['dawn', 'noon', 0.45], 178, 1, 1, 0.45, 0.05, 0.2, 0.6),
  k(520, 'noon', 'noon', 215, 0.45, 0.9, 0.85, 0, 0, 0.25),
  k(580, 'noon', 'noon', 245, 0.3, 0.85, 1, 0, 0, 0.2),
  k(640, 'noon', 'noon', 285, 0.5, 0.9, 0.85, 0, 0, 0.25),
  k(690, ['noon', 'dusk', 0.5], ['noon', 'dusk', 0.5], 330, 0.8, 1, 0.4, 0.3, 0.5, 0.6),
  k(DAY_LENGTH, 'dusk', 'dusk', 360, 1, 1, 0.12, 1, 1, 1),
]

type RGB = [number, number, number]

function rgbOf(hex: string): RGB {
  const v = parseInt(hex.slice(1, 7), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function hexOf(c: RGB): string {
  return '#' + c.map(q => Math.max(0, Math.min(255, Math.round(q))).toString(16).padStart(2, '0')).join('')
}
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

function blendOf(b: Blend, of: (h: Hour) => RGB): RGB {
  return typeof b === 'string' ? of(b) : mix(of(b[0]), of(b[1]), b[2])
}

/** The light at `t` seconds into the day; null (no day: before the prism, or under a roof) is the view's own values. */
export function dayLook(t: number | null, b: DayBase): DayLook {
  if (t === null) {
    return { ambient: b.ambient, sunAngle: b.sunAngle, shadowLength: b.shadowLength, shadow: b.shadow, skyTop: b.skyTop, skyHorizon: b.skyHorizon, haze: b.haze, sun: 0.12, low: 1, stars: 1, fireflies: 1, glare: 1, exposure: 0 }
  }
  const x = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH
  let i = 1
  while (i < KEYS.length - 1 && x > KEYS[i]!.at) i++
  // On a hand-over second, the second of the two keys holds.
  while (i < KEYS.length - 1 && KEYS[i + 1]!.at === KEYS[i]!.at && x >= KEYS[i]!.at) i++
  const A = KEYS[i - 1]!
  const B = KEYS[i]!
  const f = B.at === A.at ? 1 : Math.max(0, Math.min(1, (x - A.at) / (B.at - A.at)))
  // Smooth in and out of each key, so the light never turns a corner.
  const e = f * f * (3 - 2 * f)
  const light = (h: Hour): RGB => rgbOf(h === 'dusk' ? b.ambient : h === 'night' ? b.nightLight : h === 'dawn' ? b.dawnLight : b.noonLight)
  const top = (h: Hour): RGB => rgbOf(h === 'dusk' ? b.skyTop : h === 'night' ? b.nightSky : h === 'dawn' ? b.dawnSky : b.noonSky)
  const low = (h: Hour): RGB => rgbOf(h === 'dusk' ? b.skyHorizon : h === 'night' ? b.nightHorizon : h === 'dawn' ? b.dawnHorizon : b.noonHorizon)
  const horizon = mix(blendOf(A.sky, low), blendOf(B.sky, low), e)
  // The haze is the dusk's own haze, moved as far as the horizon has moved.
  const baseH = rgbOf(b.skyHorizon)
  const haze = rgbOf(b.haze).map((q, j) => q + horizon[j]! - baseH[j]!) as RGB
  const sun = lerp(A.sun, B.sun, e)
  return {
    ambient: hexOf(mix(blendOf(A.light, light), blendOf(B.light, light), e)),
    sunAngle: (((b.sunAngle + lerp(A.turn, B.turn, e)) % 360) + 360) % 360,
    shadowLength: b.shadowLength * lerp(A.len, B.len, e),
    shadow: Math.min(0.9, b.shadow * lerp(A.str, B.str, e)),
    skyTop: hexOf(mix(blendOf(A.sky, top), blendOf(B.sky, top), e)),
    skyHorizon: hexOf(horizon),
    haze: hexOf(haze),
    sun,
    low: sun < -0.3 ? 0 : sun < 0.12 ? (sun + 0.3) / 0.42 : Math.max(0.25, 1 - (sun - 0.12) / 0.7),
    stars: lerp(A.stars, B.stars, e),
    fireflies: lerp(A.flies, B.flies, e),
    glare: lerp(A.glare, B.glare, e),
    exposure: sun > 0.12 ? ((sun - 0.12) / 0.88) * b.noonBright : 0,
  }
}

/**
 * A grade that takes the dusk sky to this hour's: per channel, `c · mul + add`
 * takes the view's own top colour to the hour's top and its horizon to the
 * hour's horizon. The backdrop is painted once in the dusk colours and the
 * grade is laid on in the shader, so the hour never repaints it.
 */
export function skyGrade(fromTop: string, fromHorizon: string, toTop: string, toHorizon: string): { mul: RGB; add: RGB } {
  const a = rgbOf(fromTop)
  const b = rgbOf(fromHorizon)
  const c = rgbOf(toTop)
  const d = rgbOf(toHorizon)
  const mul: RGB = [1, 1, 1]
  const add: RGB = [0, 0, 0]
  for (let j = 0; j < 3; j++) {
    const span = b[j]! - a[j]!
    const m = Math.abs(span) > 20 ? Math.max(0.2, Math.min(3, (d[j]! - c[j]!) / span)) : 1
    mul[j] = m
    add[j] = ((c[j]! + d[j]!) / 2 - m * (a[j]! + b[j]!) / 2) / 255
  }
  return { mul, add }
}
