/**
 * Which view is on screen, and how far the turn between views has come.
 * Pure: the renderer feeds it the frame's dt and asks what to draw.
 *
 * The classic view is the hub: every other view turns in from it and out to
 * it (k: 0 classic … 1 the view), so going from one added view to another
 * passes through the classic picture. A pair named direct (`direct`: the 16-bit
 * and the 32-bit look, part 14) turns straight from one to the other instead,
 * with no classic picture between them: `via` says how far (`j`, 0 the view it
 * comes from … 1 the view it goes to), and the renderer draws both.
 *
 * A view may not be able to draw yet (its shaders are compiling, its
 * pictures are being painted). The turn waits for it at k = 0, on the
 * classic picture, and comes in when it can: turned in, or at once if that
 * was what was asked for. So nothing is ever cut to that was not ready.
 */
/** A turn straight from one added view to another (`createTurn`'s `direct`): `j` 0 … 1, from `from` to `to`. */
export interface Via { from: string; to: string; j: number }

export interface Turn {
  /** Head for a view ('classic' or an added one; an unknown id means classic). `instant` skips the turn. */
  set(id: string, instant?: boolean): void
  /**
   * Advance by dt seconds. Returns the added view to draw and how far in it is; `shown` is '' when the classic view draws.
   * `ready`: can the view on its way in (or on screen) draw itself now? While it cannot, the classic view draws and k stays 0.
   */
  step(dt: number, ready?: boolean): { shown: string; k: number; via?: Via }
  /** The view we are in or heading for. */
  readonly id: string
  /** The added view on screen or on its way in or out ('': none). */
  readonly shown: string
  readonly k: number
  /** A turn is in flight (or waits for its view to be ready). */
  readonly turning: boolean
  /** The view asked for is not ready: the classic picture stands in for it. */
  readonly waiting: boolean
  /** A direct turn under way (none: none). */
  readonly via: Via | null
}

export function createTurn(has: (id: string) => boolean, seconds = 0.6, direct: (from: string, to: string) => boolean = () => false): Turn {
  let shown = ''
  let wanted = ''
  let k = 0
  let via: Via | null = null
  /** The last call asked for no turn: a view that was waited for arrives at once too. */
  let snap = false
  let waiting = false
  return {
    set(id, instant = false) {
      const next = has(id) ? id : ''
      snap = instant
      if (!instant && next) {
        // Back the way a direct turn came: it turns round where it is.
        if (via && next === via.from) { via = { from: via.to, to: via.from, j: 1 - via.j }; wanted = next; return }
        if (via && next === via.to) return
        // From an added view that is fully in, to its pair: straight across, not through the classic picture.
        if (!via && shown && k >= 1 && shown === wanted && next !== shown && direct(shown, next)) { via = { from: shown, to: next, j: 0 }; wanted = next; return }
      }
      // (Anything else ends a direct turn where it is: on the view it was going to, and turns on from there.)
      if (via) { shown = via.to; k = 1; via = null }
      wanted = next
      if (instant) { shown = wanted; k = wanted ? 1 : 0 } else if (!shown) shown = wanted
    },
    step(dt, ready = true) {
      if (via) {
        // (The view it goes to cannot draw yet: the turn waits where it is, on the view it comes from.)
        if (ready) via.j = Math.min(1, via.j + dt / seconds)
        if (via.j >= 1) { shown = via.to; k = 1; via = null; return { shown, k } }
        return { shown: via.to, k: 1, via: { ...via } }
      }
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
    get turning() { return !!via || shown !== wanted || k !== (shown ? 1 : 0) },
    get waiting() { return waiting },
    get via() { return via ? { ...via } : null },
  }
}

/**
 * How much of a frame's time a turn takes, by where the turn is (`k`, raw). In the hand-off (the first `handoff`
 * of the turn) a frame is worth no more than a steady one (1/60 s); on the way out, in the stretch a long frame
 * would cross to reach it, no more than two (1/30 s). A picture's first frame is a long one (its tiles are painted, its shadows cast, its shaders
 * warm), and the first frames of a turn are such frames; counted whole, one of them would carry the turn clean
 * over the hand-off, which would then be a cut. So the hand-off is four frames or more at any frame rate, and a
 * turn below 60 frames a second is that much longer than its `seconds`. `held`: the last frame was made long on
 * purpose (a picture painted ahead), and is not time the turn has had. `out`: the turn is heading for the
 * hand-off, not coming from it. (0.1 s is the longest frame the shell hands over.)
 */
export function turnTime(dt: number, k: number, handoff: number, seconds: number, held = false, out = true): number {
  if (held || k <= handoff) return Math.min(dt, 1 / 60)
  // (And no step lands deeper in the hand-off than a steady frame would have.)
  if (out && k < handoff + 0.1 / seconds) return Math.min(dt, 1 / 30, (k - handoff) * seconds + 1 / 60)
  return dt
}

/**
 * The turn's share of each frame's time, frame by frame (`turnTime`). A turn's first two frames are steady ones
 * whatever the clock says: the press that began it may have done long work of its own (the first key of a visit
 * starts the sound), and that time arrives in the second frame's dt. A press in the middle of a turn, or in the
 * frame after one ended, begins a turn too: the count starts again whenever the turn's aim changes. `held`: as
 * `turnTime`'s.
 */
export function createTurnClock(handoff: number, seconds: number) {
  let age = 0
  let aim = ''
  return (dt: number, t: Pick<Turn, 'turning' | 'k' | 'id' | 'shown'>, held = false): number => {
    if (!t.turning) { age = 0; aim = ''; return dt }
    if (t.id !== aim) { age = 0; aim = t.id }
    age++
    return turnTime(dt, t.k, handoff, seconds, held || age <= 2, t.id !== t.shown)
  }
}
