/**
 * Which view is on screen, and how far the turn between views has come.
 * Pure: the renderer feeds it the frame's dt and asks what to draw.
 *
 * The classic view is the hub: every other view turns in from it and out to
 * it (k: 0 classic … 1 the view), so going from one added view to another
 * passes through the classic picture.
 *
 * A view may not be able to draw yet (its shaders are compiling, its
 * pictures are being painted). The turn waits for it at k = 0, on the
 * classic picture, and comes in when it can: turned in, or at once if that
 * was what was asked for. So nothing is ever cut to that was not ready.
 */
export interface Turn {
  /** Head for a view ('classic' or an added one; an unknown id means classic). `instant` skips the turn. */
  set(id: string, instant?: boolean): void
  /**
   * Advance by dt seconds. Returns the added view to draw and how far in it is; `shown` is '' when the classic view draws.
   * `ready`: can the view on its way in (or on screen) draw itself now? While it cannot, the classic view draws and k stays 0.
   */
  step(dt: number, ready?: boolean): { shown: string; k: number }
  /** The view we are in or heading for. */
  readonly id: string
  /** The added view on screen or on its way in or out ('': none). */
  readonly shown: string
  readonly k: number
  /** A turn is in flight (or waits for its view to be ready). */
  readonly turning: boolean
  /** The view asked for is not ready: the classic picture stands in for it. */
  readonly waiting: boolean
}

export function createTurn(has: (id: string) => boolean, seconds = 0.6): Turn {
  let shown = ''
  let wanted = ''
  let k = 0
  /** The last call asked for no turn: a view that was waited for arrives at once too. */
  let snap = false
  let waiting = false
  return {
    set(id, instant = false) {
      wanted = has(id) ? id : ''
      snap = instant
      if (instant) { shown = wanted; k = wanted ? 1 : 0 } else if (!shown) shown = wanted
    },
    step(dt, ready = true) {
      if (!ready && shown) {
        // The view cannot draw. Heading for it (or in it): wait on the classic picture. Leaving it: it is gone.
        k = 0
        if (shown !== wanted) shown = wanted
        waiting = shown !== ''
        return { shown: '', k: 0 }
      }
      if (waiting) {
        waiting = false
        if (snap && shown && shown === wanted) k = 1
      }
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
    get waiting() { return waiting },
  }
}
