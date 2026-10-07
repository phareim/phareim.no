/**
 * The ways Neon Shrine can be shown. One game state, one engine; a view is
 * only how the frame is drawn, so the player can change it in the middle of
 * a room. Pure: the loaders are the only thing that touches the bundle.
 *
 * To add a view: write a module whose default export is a `ViewFactory`
 * (`render/renderer.ts`), list it here, and it appears on the V key, the
 * pause screen and `?view=<id>`. `turn` is how far the picture is rotated
 * from the classic one (radians); the controls turn with it.
 */
export type ViewId = 'classic' | 'iso'

export interface ViewInfo {
  id: ViewId
  /** Shown on the pause screen and the switch button. */
  name: string
  /** The module that draws it; none for the classic view, which is always there. */
  load?: () => Promise<{ default: unknown }>
}

export const VIEWS: readonly ViewInfo[] = [
  { id: 'classic', name: 'CLASSIC' },
  { id: 'iso', name: 'ISOMETRIC', load: () => import('./render/iso/view') },
]

export const VIEW_KEY = 'zelda.view'

export function isViewId(v: unknown): v is ViewId {
  return typeof v === 'string' && VIEWS.some(w => w.id === v)
}

/** The view after `id`, round and round. */
export function nextView(id: ViewId): ViewId {
  const i = VIEWS.findIndex(v => v.id === id)
  return VIEWS[(i + 1) % VIEWS.length]!.id
}

export function viewName(id: ViewId): string {
  return VIEWS.find(v => v.id === id)?.name ?? id.toUpperCase()
}

/** The view to start in: the address (`?view=iso`) wins over what this browser used last. */
export function startView(query: unknown, stored: unknown): ViewId {
  if (isViewId(query)) return query
  if (isViewId(stored)) return stored
  return 'classic'
}
