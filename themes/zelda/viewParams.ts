/**
 * What can be turned on each way of drawing the world. Pure data: no canvas,
 * no DOM. The renderer reads the values, the studio (studio.phareim.no) shows
 * them as sliders and swatches, and `scripts/export-sprites.mjs` writes them
 * into the base the studio reads, so the two never disagree about a bound.
 *
 * An engine is the code that draws (`classic`, `iso`, `blyant`); a view
 * (`views.ts`) is an engine with a name and its own values. Three views are
 * built in, one per engine with the values below; the studio may publish more.
 */
export type EngineId = 'classic' | 'iso' | 'blyant'

/** `group`: the heading the studio files a value under, where an engine has many. */
export type ParamSpec =
  | { t: 'number'; label: string; value: number; min: number; max: number; step?: number; note?: string; group?: string }
  | { t: 'color'; label: string; value: string; note?: string; group?: string }
  | { t: 'choice'; label: string; value: string; options: readonly string[]; note?: string; group?: string }
  | { t: 'toggle'; label: string; value: boolean; note?: string; group?: string }

export type ParamValue = number | string | boolean
export type ParamValues = Record<string, ParamValue>

export interface EngineInfo {
  /** Shown in the studio. */
  title: string
  blurb: string
  params: Record<string, ParamSpec>
}

const num = (label: string, value: number, min: number, max: number, step = 0.05, note?: string): ParamSpec => ({ t: 'number', label, value, min, max, step, ...(note ? { note } : {}) })
const color = (label: string, value: string, note?: string): ParamSpec => ({ t: 'color', label, value, ...(note ? { note } : {}) })
const toggle = (label: string, value: boolean, note?: string): ParamSpec => ({ t: 'toggle', label, value, ...(note ? { note } : {}) })
const choice = (label: string, value: string, options: readonly string[], note?: string): ParamSpec => ({ t: 'choice', label, value, options, ...(note ? { note } : {}) })

/** File some values under a heading. */
const group = (title: string, specs: Record<string, ParamSpec>): Record<string, ParamSpec> =>
  Object.fromEntries(Object.entries(specs).map(([name, spec]) => [name, { ...spec, group: title }]))

/** The finish every engine shares: what happens to the picture on its way to the glass. */
const FINISH = (scan: number, bloom: number, vignette: number): Record<string, ParamSpec> => ({
  scanlines: num('Scanlines', scan, 0, 2, 0.05, 'The dark line across every pixel row.'),
  bloom: num('Neon bloom', bloom, 0, 2, 0.05, 'How far lights spill over the picture.'),
  vignette: num('Vignette', vignette, 0, 2, 0.05, 'Darkness in the corners.'),
})

export const ENGINES: Record<EngineId, EngineInfo> = {
  classic: {
    title: 'Classic',
    blurb: 'The top-down picture: an 8-bit cabinet with the lights off. Hard scanlines, neon that bleeds.',
    params: { ...FINISH(1, 1, 1) },
  },
  iso: {
    title: 'Isometric',
    blurb: 'The same world turned 45° at twice the pixels, the way a 16-bit machine dreamt: real depth, the art smoothed on its way up, every lamp lighting what it can see from the side it is on, long shadows from a low sun, water that mirrors, neon that blooms, a dusk sky in bands behind it all.',
    params: {
      ...group('The glass', {
        ...FINISH(0, 0.9, 0.5),
        colors: choice('Colours', '15-bit', ['15-bit', 'full'], 'The machine’s 32 768 colours with a dither between them, or every colour the screen has.'),
      }),
      ...group('The art', {
        smoothing: num('Art smoothing', 1, 0, 1, 0.05, 'How far the classic art is smoothed on its way up to two pixels a texel: stairs get their half-steps, shades of one material run together, black outlines take a colour. 0 leaves the pixels square.'),
        relief: num('Relief', 0.9, 0, 3, 0.05, 'How much the art’s own light and dark stands up for the lamps to catch.'),
        roundness: num('Roundness', 0.7, 0, 2, 0.05, 'How round people and things are to the light.'),
        plants: toggle('Standing plants', true, 'Trees with crowns, bushes, tall grass and flowers that stand and sway, in place of the classic tiles.'),
      }),
      ...group('Lamps', {
        sideLight: num('Side light', 0.85, 0, 1, 0.05, 'How much a lamp lights only what faces it. 0 is the flat glow of the classic view.'),
        lightShadows: num('Lamp shadows', 0.85, 0, 1, 0.05, 'How much walls and roofs stop a lamp’s light.'),
        glow: num('Light in the air', 1, 0, 2, 0.05, 'How much of a lamp’s light hangs over the ground it falls on.'),
      }),
      ...group('The sun', {
        sunAngle: num('Sun direction', 205, 0, 360, 5, 'Where the low sun stands, in degrees on the ground (0 east, 90 south, 180 west). Shadows fall the other way.'),
        shadowLength: num('Shadow length', 1.5, 0, 4, 0.1, 'How far a thing one tile tall throws its shadow, in tiles.'),
        shadow: num('Shadow strength', 0.55, 0, 0.9),
        shadowColor: color('Shadow colour', '#140a3c'),
        occlusion: num('Corner shade', 0.5, 0, 1, 0.05, 'Soft darkness where a wall meets the ground.'),
        shading: num('Side shading', 0.6, 0, 1, 0.05, 'How much the sides away from the sun darken, in dithered steps.'),
        rim: num('Sun rim', 0.5, 0, 1, 0.05, 'A warm edge on what the low sun catches.'),
        rays: num('Sun shafts', 0.6, 0, 1, 0.05, 'The low sun coming through in slanting shafts.'),
        clouds: num('Cloud shadows', 0.3, 0, 1),
        cloudSpeed: num('Cloud speed', 1, 0, 4, 0.1),
      }),
      ...group('The air', {
        haze: num('Distance haze', 0.35, 0, 1),
        hazeColor: color('Haze colour', '#ff6fb0'),
        mist: num('Mist', 0.6, 0, 1, 0.05, 'Low mist drifting over the ground: thick in the Wildwood, a breath on the coast.'),
        wind: num('Wind', 1, 0, 3, 0.1, 'How much the plants sway, and how fast the leaves go by.'),
        air: toggle('Things in the air', true, 'Dust at the hero’s heels, sparks rising in the lamplight, leaves on the wind.'),
      }),
      ...group('Sky and water', {
        sky: toggle('Dusk sky', true, 'A dusk in sliding layers beyond the edge of the map: banded sky, the stuck sun, ridges, clouds, the sea.'),
        skyTop: color('Sky, top', '#1a0f4a'),
        skyHorizon: color('Sky, horizon', '#ff5f9e'),
        wet: num('Wet ground', 0.6, 0, 1, 0.05, 'Pavement after rain and polished floors: how much neon shows in them.'),
        reflections: num('Water mirror', 0.6, 0, 1, 0.05, 'How clearly what stands by water shows in it.'),
      }),
      ...group('The machine', {
        sound: choice('Sound', '16-bit', ['16-bit', '8-bit'], 'The music through the 16-bit machine’s sampled instruments and echo, or the classic chip.'),
        windows: choice('Windows', '16-bit', ['16-bit', 'neon'], 'The dialog box and panels: gradient windows in the 16-bit font, or the neon boxes of the classic view.'),
      }),
    },
  },
  blyant: {
    title: 'Pencil',
    blurb: 'The world as it was sketched before the pixels: Blyant’s pencil on squared paper. Contours drawn twice, light as hatching, colour as coloured pencil.',
    params: {
      paper: choice('Sheet', 'auto', ['auto', 'papir', 'kull'], 'Papir is pencil on a light sheet, Kull chalk on a dark one. Auto follows the visitor’s light or dark mode.'),
      wobble: num('Wobble', 1.2, 0, 3, 0.1, 'How much the hand shakes. 0 draws with a ruler.'),
      lineWidth: num('Line weight', 1.15, 0.5, 3, 0.05),
      detail: num('Detail', 0.5, 0, 1, 0.05, 'How small a difference between two colours still gets a line.'),
      hatch: toggle('Hatching', true),
      hatchGap: num('Hatch spacing', 5.5, 3, 12, 0.5),
      exposure: num('Lift', 2, 0.5, 4, 0.1, 'How far the night art is lifted before the pencil reads it: higher leaves more bare paper.'),
      shade: num('Shade', 1, 0, 2, 0.05, 'How hard the pencil presses on dark things.'),
      colour: num('Coloured pencil', 0.9, 0, 1),
      grain: toggle('Paper grain', true),
      grid: toggle('Squared paper', true, 'A faint square per tile.'),
      boil: toggle('Boiling lines', false, 'Redraw the lines six times a second, like hand-drawn film.'),
      paperColor: color('Sheet colour', '', 'Empty: Blyant’s own paper.'),
      inkColor: color('Pencil colour', '', 'Empty: Blyant’s own graphite.'),
      windows: choice('Windows', 'paper', ['paper', 'neon'], 'The dialog box and panels: notes on paper, or the neon boxes of the classic view.'),
    },
  },
}

export function isEngineId(v: unknown): v is EngineId {
  return v === 'classic' || v === 'iso' || v === 'blyant'
}

const HEX = /^#[0-9a-f]{6}$/i

/** One value made safe for its spec: clamped, of the right type, or the spec's own. */
export function cleanParam(spec: ParamSpec, v: unknown): ParamValue {
  switch (spec.t) {
    case 'number': return typeof v === 'number' && Number.isFinite(v) ? Math.max(spec.min, Math.min(spec.max, v)) : spec.value
    case 'color': return typeof v === 'string' && (HEX.test(v) || (v === '' && spec.value === '')) ? v.toLowerCase() : spec.value
    case 'choice': return typeof v === 'string' && spec.options.includes(v) ? v : spec.value
    case 'toggle': return typeof v === 'boolean' ? v : spec.value
  }
}

/** An engine's values: its own, with `over` laid on top. Unknown names and bad values fall away. */
export function resolveParams(engine: EngineId, over?: unknown): ParamValues {
  const out: ParamValues = {}
  const o = over && typeof over === 'object' ? over as Record<string, unknown> : {}
  for (const [name, spec] of Object.entries(ENGINES[engine].params)) out[name] = name in o ? cleanParam(spec, o[name]) : spec.value
  return out
}

/** Only what differs from the engine's own values (what a view keeps, and what the studio publishes). */
export function paramDiff(engine: EngineId, values: unknown): ParamValues {
  const full = resolveParams(engine, values)
  const out: ParamValues = {}
  for (const [name, spec] of Object.entries(ENGINES[engine].params)) if (full[name] !== spec.value) out[name] = full[name]!
  return out
}
