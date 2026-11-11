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

export type ParamSpec =
  | { t: 'number'; label: string; value: number; min: number; max: number; step?: number; note?: string }
  | { t: 'color'; label: string; value: string; note?: string }
  | { t: 'choice'; label: string; value: string; options: readonly string[]; note?: string }
  | { t: 'toggle'; label: string; value: boolean; note?: string }

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
    blurb: 'The same world turned 45° and tipped back, rebuilt with depth from the classic art.',
    params: { ...FINISH(1, 1, 1) },
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
