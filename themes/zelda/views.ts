/**
 * The ways Neon Shrine can be shown. One game state, one engine; a view is
 * only how the frame is drawn, so the player can change it in the middle of
 * a room. Pure: the loaders are the only thing that touches the bundle.
 *
 * A view is a drawing engine (`viewParams.ts`: classic, iso, blyant) with a
 * name and its own values. Three are built in, one per engine. The studio
 * (studio.phareim.no) may change a built-in view's values and publish more
 * views of its own; they arrive with the live file (`render/live.ts`) and
 * join the round on the V key, the view strip and `?view=<id>`.
 *
 * To add an engine: write a module whose default export is a `ViewFactory`
 * (`render/renderer.ts`), give it a loader in `ENGINE_LOADERS` and its values
 * in `viewParams.ts`, and add its built-in view below. `turn` is how far the
 * picture is rotated from the classic one (radians); the controls turn with it.
 */
import { ENGINES, isEngineId, paramDiff, type EngineId, type ParamValues } from './viewParams'

/** A view's id: a built-in one, or one the studio published. */
export type ViewId = string

export interface ViewDef {
  id: ViewId
  /** Shown on the pause screen and the view strip, in the pixel font. */
  name: string
  /** A word under the name on the view strip: what kind of picture it is. */
  tag: string
  engine: EngineId
  /** What differs from the engine's own values. */
  params?: ParamValues
}

/** Kept for the registry's old shape: a built-in view and the module that draws it (none for the classic one). */
export interface ViewInfo extends ViewDef {
  load?: () => Promise<{ default: unknown }>
}

/** The module that draws each engine; the classic one is always there. */
export const ENGINE_LOADERS: Record<EngineId, (() => Promise<{ default: unknown }>) | undefined> = {
  classic: undefined,
  iso: () => import('./render/iso/view'),
  blyant: () => import('./render/blyant/view'),
}

export const VIEWS: readonly ViewInfo[] = [
  { id: 'classic', name: 'CLASSIC', tag: '8-BIT', engine: 'classic' },
  { id: 'iso', name: 'ISOMETRIC', tag: '16-BIT', engine: 'iso', load: ENGINE_LOADERS.iso },
  { id: 'blyant', name: 'PENCIL', tag: 'SKETCH', engine: 'blyant', load: ENGINE_LOADERS.blyant },
]

export const VIEW_KEY = 'zelda.view'
/** The most views the round holds: the strip must fit a phone, and V must come back round. */
export const MAX_VIEWS = 8

const ID = /^[a-z][a-z0-9-]{0,23}$/
const NAME = /^[A-Z0-9][A-Z0-9 ]{0,13}$/

/** What the studio published: values for built-in views, and views of its own. */
export interface LiveView {
  engine?: EngineId
  name?: string
  tag?: string
  params?: ParamValues
  /** Where it goes in the round (lowest first; built-in views are 0, 10 and 20). */
  order?: number
  /** A built-in view taken out of the round (never the classic one). */
  hidden?: boolean
}
export type LiveViews = Record<string, LiveView>

/** The studio's `views`, with everything the game cannot use dropped. Never throws. */
export function parseViews(raw: unknown): LiveViews {
  const out: LiveViews = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    if (!ID.test(id) || !v || typeof v !== 'object' || Array.isArray(v)) continue
    const r = v as Record<string, unknown>
    const builtin = VIEWS.find(b => b.id === id)
    const engine = builtin ? builtin.engine : isEngineId(r.engine) ? r.engine : null
    if (!engine) continue
    const name = typeof r.name === 'string' && NAME.test(r.name.trim()) ? r.name.trim() : undefined
    if (!builtin && !name) continue
    const view: LiveView = { params: paramDiff(engine, r.params) }
    if (!builtin) view.engine = engine
    if (name) view.name = name
    if (typeof r.tag === 'string' && NAME.test(r.tag.trim())) view.tag = r.tag.trim()
    if (typeof r.order === 'number' && Number.isFinite(r.order)) view.order = r.order
    if (r.hidden === true && id !== 'classic') view.hidden = true
    out[id] = view
  }
  return out
}

/** The round: the built-in views with the studio's values, then the studio's own, in order. */
export function mergeViews(live: LiveViews | null | undefined): ViewDef[] {
  const rows: Array<{ def: ViewDef; order: number; i: number }> = []
  VIEWS.forEach((b, i) => {
    const l = live?.[b.id]
    if (l?.hidden) return
    rows.push({ def: { id: b.id, name: l?.name ?? b.name, tag: l?.tag ?? b.tag, engine: b.engine, params: l?.params ?? {} }, order: l?.order ?? i * 10, i })
  })
  let i = VIEWS.length
  for (const [id, l] of Object.entries(live ?? {})) {
    if (VIEWS.some(b => b.id === id) || !l.engine || !l.name || l.hidden) continue
    rows.push({ def: { id, name: l.name, tag: l.tag ?? ENGINES[l.engine].title.toUpperCase(), engine: l.engine, params: l.params ?? {} }, order: l.order ?? 100 + i, i: i++ })
  }
  rows.sort((a, b) => a.order - b.order || a.i - b.i)
  return rows.slice(0, MAX_VIEWS).map(r => r.def)
}

let round: ViewDef[] = mergeViews(null)

/** The views in the round right now. */
export function viewList(): readonly ViewDef[] { return round }

/** Take the studio's views into the round (null: the built-in ones as they are). */
export function setLiveViews(live: LiveViews | null): readonly ViewDef[] {
  round = mergeViews(live)
  return round
}

export function viewDef(id: unknown): ViewDef | undefined {
  return typeof id === 'string' ? round.find(v => v.id === id) : undefined
}

export function isViewId(v: unknown): v is ViewId {
  return !!viewDef(v)
}

/** The view after `id`, round and round. */
export function nextView(id: ViewId): ViewId {
  const i = round.findIndex(v => v.id === id)
  return round[(i + 1) % round.length]!.id
}

export function viewName(id: ViewId): string {
  return viewDef(id)?.name ?? id.toUpperCase()
}

/** The view to start in: the address (`?view=iso`) wins over what this browser used last. */
export function startView(query: unknown, stored: unknown): ViewId {
  if (isViewId(query)) return query
  if (isViewId(stored)) return stored
  return 'classic'
}
