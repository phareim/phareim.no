/**
 * What can be turned on each way of drawing the world. Pure data: no canvas,
 * no DOM. The renderer reads the values, the studio (studio.phareim.no) shows
 * them as sliders and swatches, and `scripts/export-sprites.mjs` writes them
 * into the base the studio reads, so the two never disagree about a bound.
 *
 * An engine is the code that draws (`classic`, `iso`); a view
 * (`views.ts`) is an engine with a name and its own values. Two views are
 * built in, one per engine with the values below; the studio may publish more.
 */
export type EngineId = 'classic' | 'iso'

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

/**
 * Day and night (`render/daylight.ts`): once the Sun Prism is home, a
 * 12-minute day runs from the dusk these values draw, through night, dawn and
 * noon. The sun, shadows and sky values above are the dusk's; these are the
 * other hours' colours. `daytime` holds the light at one hour, to try a look.
 */
const DAY_PARAMS = (sky: boolean): Record<string, ParamSpec> => ({
  daytime: choice('Time of day', 'cycle', ['cycle', 'dusk', 'night', 'dawn', 'noon'], 'Cycle: the stuck dusk until the Sun Prism is home, then a 12-minute day (mostly dusk and dawn, two minutes of night, two of noon). The others hold the light outdoors at that hour, whatever the game has got to.'),
  nightLight: color('Night light', '#3a3878', 'The light outdoors at midnight; dusk is the view’s own.'),
  dawnLight: color('Dawn light', '#f0a4b0', 'The light outdoors as the sun comes up.'),
  noonLight: color('Noon light', '#f4efe8', 'The light outdoors at noon.'),
  noonBright: num('Noon brightness', 0.55, 0, 1.5, 0.05, 'How much brighter than the art itself the world is at noon: the art is painted for the dusk, and full light alone only shows it as painted.'),
  ...(sky ? {
    nightSky: color('Night sky, top', '#070722'),
    nightHorizon: color('Night sky, horizon', '#2c2466'),
    dawnSky: color('Dawn sky, top', '#2a2c78'),
    dawnHorizon: color('Dawn sky, horizon', '#ffa26b'),
    noonSky: color('Noon sky, top', '#2a7fd4'),
    noonHorizon: color('Noon sky, horizon', '#a8e4ff'),
  } : {}),
})

export const ENGINES: Record<EngineId, EngineInfo> = {
  classic: {
    title: 'Classic',
    blurb: 'The top-down picture: an 8-bit cabinet with the lights off. Hard scanlines, neon that bleeds, and a low sun that lays hard-edged shadows along the ground.',
    params: {
      ...FINISH(1, 1, 1),
      sunAngle: num('Sun direction', 205, 0, 360, 5, 'Where the low sun stands, in degrees on the ground (0 east, 90 south, 180 west). Shadows fall the other way.'),
      shadowLength: num('Shadow length', 1.5, 0, 4, 0.1, 'How far a thing one tile tall throws its shadow, in tiles.'),
      shadow: num('Shadow strength', 0.7, 0, 0.9, 0.05, 'How dark the shadows of houses, walls, woods and of everyone who walks are. 0 turns them off.'),
      shadowColor: color('Shadow colour', '#140a3c'),
      ...DAY_PARAMS(false),
    },
  },
  iso: {
    title: 'Isometric',
    blurb: 'The same world turned 45° at twice the pixels, the way a 16-bit machine dreamt: real depth, the ground, the walls and the roofs in materials of its own, a low sun with a warm light and long shadows, every lamp lighting what it can see from the side it is on, water that mirrors, neon that blooms, a dusk sky in bands behind it all.',
    params: {
      ...group('The glass', {
        ...FINISH(0, 0.9, 0.5),
        colors: choice('Colours', '15-bit', ['15-bit', 'full'], 'The machine’s 32 768 colours with a dither between them, or every colour the screen has.'),
      }),
      ...group('The art', {
        smoothing: num('Art smoothing', 1, 0, 1, 0.05, 'How far the classic art is smoothed on its way up to two pixels a texel: stairs get their half-steps, shades of one material run together, black outlines take a colour. 0 leaves the pixels square.'),
        materials: num('Ground materials', 1, 0, 1, 0.05, 'The ground in materials of this view’s own, painted at its own density: a lawn in three greens with blades in it, cobbles with a lit shoulder, combed sand, flagstones with a bevel, floorboards with a grain. 0 is the classic ground, smoothed.'),
        roofPitch: num('Roof pitch', 0.3, 0, 0.6, 0.05, 'How steeply a house’s roof rises from its eaves toward the back, in tiles up for every tile in. 0 is the flat lid the classic art implies.'),
        relief: num('Relief', 0.9, 0, 3, 0.05, 'How much the art’s own light and dark stands up for the lamps to catch.'),
        roundness: num('Roundness', 0.7, 0, 2, 0.05, 'How round people and things are to the light.'),
        figure: choice('The hero', 'classic', ['classic', 'modelled'], 'Classic: the four-way sprite of the classic view, smoothed. Modelled: the hero is a small figure built in the round and drawn pixel by pixel each frame, so it turns smoothly, walks with its whole body and swings a blade that sweeps a true arc.'),
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
        sunLight: color('Sunlight', '#ffba6a', 'The low sun’s own colour, laid on what faces it and stands in no shade. The classic view has one light for everything; here the sun is warm and the shade is the sky’s.'),
        sunStrength: num('Sunlight strength', 0.9, 0, 1.5, 0.05, 'How much of the light outdoors is the sun’s own. 0 is one even light, as in the classic view.'),
        occlusion: num('Corner shade', 0.5, 0, 1, 0.05, 'Soft darkness where a wall meets the ground.'),
        shading: num('Side shading', 0.6, 0, 1, 0.05, 'How much the sides away from the sun darken, in dithered steps.'),
        rim: num('Sun rim', 0.5, 0, 1, 0.05, 'A warm edge on what the low sun catches, and a line of light down the side of everyone who stands with the sun or a lamp behind them.'),
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
        beyond: toggle('Land beyond the edge', true, 'Outdoors the world goes on past the map’s edge: the woods, the open sea, rock rising behind the map and a cliff over the sea in front of it, sinking into the dusk further out. Off, the map is a board and the dusk sky stands round it.'),
        sky: toggle('Dusk sky', true, 'A dusk in sliding layers where the land ends or fades: banded sky, the stuck sun, ridges, clouds, the sea.'),
        skyTop: color('Sky, top', '#1a0f4a'),
        skyHorizon: color('Sky, horizon', '#ff5f9e'),
        wet: num('Wet ground', 0.6, 0, 1, 0.05, 'Pavement after rain and polished floors: how much neon shows in them.'),
        reflections: num('Water mirror', 0.6, 0, 1, 0.05, 'How clearly what stands by water shows in it.'),
      }),
      ...group('The machine', {
        sound: choice('Sound', '16-bit', ['16-bit', '8-bit'], 'The music through the 16-bit machine’s sampled instruments and echo, or the classic chip.'),
        windows: choice('Windows', '16-bit', ['16-bit', 'neon'], 'The dialog box and panels: gradient windows in the 16-bit font, or the neon boxes of the classic view.'),
      }),
      ...group('Day and night', DAY_PARAMS(true)),
    },
  },
}

export function isEngineId(v: unknown): v is EngineId {
  return v === 'classic' || v === 'iso'
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
