/**
 * Long-press Escape to quit, shared by every game theme.
 *
 * Contract (decided 2026-09-08): a quick Escape tap pauses (or resumes) the
 * run; holding Escape for ESC_HOLD_MS quits the run into game over. The
 * tracker is a framework-free state machine so it can live in plain-JS
 * canvas games as well as TS shells, and so plain `node --test` can cover
 * it (see tests/esc-hold.test.mjs). The visible progress pill lives in
 * EscHold.vue, which drives `poll()` on each animation frame while held.
 */

export const ESC_HOLD_MS = 3000

export interface EscHoldHooks {
  /** True while a run is active (playing or paused). Idle attract mode ignores Escape. */
  isActive: () => boolean
  /** Quick tap: pause or resume. */
  onTap: () => void
  /** Full hold: quit the run into game over. */
  onHold: () => void
}

/** Modifier keys or an editable target: Escape belongs to the browser/control. */
function targetOk(e: KeyboardEvent): boolean {
  if (e.metaKey || e.ctrlKey || e.altKey) return false
  const t = e.target
  // `typeof` guard: the tracker is also exercised in plain node (no DOM).
  if (typeof HTMLElement !== 'undefined' && t instanceof HTMLElement) {
    const tag = t.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return false
  }
  return true
}

export class EscHoldTracker {
  /** True between keydown and keyup while a hold is in progress. */
  holding = false
  /** 0..1 progress toward the hold threshold. */
  progress = 0
  /** True once onHold has fired for the current hold (keyup must reset it). */
  fired = false

  private startT = 0
  private hooks: EscHoldHooks
  private holdMs: number
  private now: () => number

  constructor(
    hooks: EscHoldHooks,
    holdMs: number = ESC_HOLD_MS,
    now: () => number = () => performance.now(),
  ) {
    this.hooks = hooks
    this.holdMs = holdMs
    this.now = now
  }

  /**
   * Feed a keydown event. Returns true when this Escape press starts a hold
   * (the caller should preventDefault and start polling); false otherwise.
   */
  onKeyDown(e: KeyboardEvent): boolean {
    if (e.code !== 'Escape' || e.repeat) return false
    if (this.holding || !this.hooks.isActive() || !targetOk(e)) return false
    e.preventDefault()
    this.holding = true
    this.fired = false
    this.startT = this.now()
    this.progress = 0
    return true
  }

  /** Feed a keyup event. A release before the threshold counts as a tap. */
  onKeyUp(e: KeyboardEvent): void {
    if (e.code !== 'Escape' || !this.holding) return
    const wasHold = this.fired
    this.reset()
    if (!wasHold) this.hooks.onTap()
  }

  /**
   * Advance the hold. Call once per animation frame while holding; fires
   * onHold exactly once when the threshold is reached. The hold stays open
   * (full bar) until keyup so the release after a hold never taps.
   */
  poll(): void {
    if (!this.holding || this.fired) return
    this.progress = Math.min(1, (this.now() - this.startT) / this.holdMs)
    if (this.progress >= 1) {
      this.fired = true
      this.hooks.onHold()
    }
  }

  /** Silently abandon a hold (blur, tab hidden, unmount). No tap, no hold. */
  cancel(): void {
    this.reset()
  }

  private reset(): void {
    this.holding = false
    this.fired = false
    this.progress = 0
  }
}
