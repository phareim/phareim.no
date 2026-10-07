/**
 * Which view is on screen, and how far the turn between views has come.
 * Pure: the renderer feeds it the frame's dt and asks what to draw.
 *
 * The classic view is the hub: every other view turns in from it and out to
 * it (k: 0 classic … 1 the view), so going from one added view to another
 * passes through the classic picture.
 */
export interface Turn {
  /** Head for a view ('classic' or an added one; an unknown id means classic). `instant` skips the turn. */
  set(id: string, instant?: boolean): void
  /** Advance by dt seconds. Returns the added view to draw and how far in it is; `shown` is '' when the classic view draws. */
  step(dt: number): { shown: string; k: number }
  /** The view we are in or heading for. */
  readonly id: string
  /** The added view on screen or on its way in or out ('': none). */
  readonly shown: string
  readonly k: number
  /** A turn is in flight. */
  readonly turning: boolean
}

export function createTurn(has: (id: string) => boolean, seconds = 0.6): Turn {
  let shown = ''
  let wanted = ''
  let k = 0
  return {
    set(id, instant = false) {
      wanted = has(id) ? id : ''
      if (instant) { shown = wanted; k = wanted ? 1 : 0 } else if (!shown) shown = wanted
    },
    step(dt) {
      const target = shown && shown === wanted ? 1 : 0
      if (k !== target) k = target > k ? Math.min(1, k + dt / seconds) : Math.max(0, k - dt / seconds)
      // Back on the classic view: the next one, if another was asked for, comes in from here.
      if (k === 0) shown = wanted
      return { shown: k > 0 ? shown : '', k }
    },
    get id() { return wanted || 'classic' },
    get shown() { return shown },
    get k() { return k },
    get turning() { return shown !== wanted || k !== (shown ? 1 : 0) },
  }
}
