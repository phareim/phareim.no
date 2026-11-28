/**
 * Keyboard, pointer and floating-stick input for the Neon Shrine engine,
 * used by the world shell (`Zelda.vue`).
 * Framework-free: the shell passes hooks for what depends on its own state
 * (phase, pause, touch deck) and calls `read()` once per frame.
 *
 * Which key walks, swings, throws, rolls and swaps is `bindings.ts`'s table, read
 * as each key comes (the player changes it on the menu's KEYS page). Touch: a floating stick starts under a finger on the
 * left 60 % of the screen; a tap on the right 40 % presses A; any tap moves a
 * dialog on, and on a YES / NO line the half it lands on is the answer (a
 * question that picks no side, `TalkAsk.noTapSide`, takes a touch on one of its
 * answers only). A finger that lands on the stick's side during a dialog and stays down is the
 * stick once the lines close. The mouse only moves dialogs on (the deck
 * buttons call pressA, pressRoll …).
 */
import type { Input } from './types'
import { actionOf, bindings, stepOf } from './bindings'

/** Stick drawn by the renderer, in CSS px relative to the canvas. */
export interface StickView { ox: number; oy: number; dx: number; dy: number }

export interface InputHooks {
  canvas(): HTMLCanvasElement | null
  /** The touch deck is showing (touch swings auto-face the nearest enemy). */
  touch(): boolean
  /** A touch arrived while `touch()` was false. */
  onTouch(): void
  /** Not playing: pointer taps are reported through `onIdleTap`, game keys are ignored. */
  idle(): boolean
  paused(): boolean
  /** A dialog is open: any tap in the world presses A. */
  dialog(): boolean
  /** A question up that only a touch on an answer answers: its answers' boxes, CSS px on the canvas (none while it types). Else null. */
  answers?(): ReadonlyArray<{ x: number; y: number; w: number; h: number }> | null
  /** A pointer press and release that stayed within a few px, while idle. */
  onIdleTap?(): void
  /** Shell keys first (start, pause, menus). Return true when the key is handled. */
  onKey?(e: KeyboardEvent): boolean
}

export interface GameInput {
  /** This frame's input; clears the one-shot presses. */
  read(): Input
  clear(): void
  readonly stick: StickView | null
  pressA(): void
  releaseA(): void
  pressB(): void
  /** The B pad let go: on a side map it is the jump, and how long it is held says how high. */
  releaseB(): void
  /** The touch deck's roll pad. */
  pressRoll(): void
  cycle(): void
  attach(): void
  detach(): void
}

const STICK_PX = 38
const TAP_PX = 10

const PLAY_ACTIONS = new Set(['a', 'b', 'cycle', 'roll'])
export function isGameKey(code: string) {
  return !!stepOf(code) || PLAY_ACTIONS.has(actionOf(code) ?? '')
}

/** Links, buttons and site chrome keep their own clicks and keys. */
/** The keys a focused control with `data-game-keys` keeps for itself. */
const OWN_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'Tab', 'ShiftLeft', 'ShiftRight'])

export function isInteractive(el: EventTarget | null) {
  return !!(el as HTMLElement | null)?.closest?.('a, button, .radio-widget')
}

export function createInput(hooks: InputHooks): GameInput {
  const keys = new Set<string>()
  let aHeldKey = false
  let aHeldTouch = false
  let aPress = false
  let bPress = false
  let cyclePress = false
  let rollPress = false
  // The side map's jump is B: pressed this frame, and held (a key or the pad).
  const bKeys = new Set<string>()
  let bHeldTouch = false
  let tapSide: -1 | 1 | undefined
  let pick: 0 | 1 | undefined
  let stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null
  let idleTap: { id: number; x: number; y: number } | null = null
  /** A finger that came down on the stick's side while a dialog was open: the stick, if it is still down when the lines close. */
  let waiting: { id: number; x: number; y: number } | null = null

  const live = () => !hooks.idle() && !hooks.paused()

  function read(): Input {
    let x = 0
    let y = 0
    const k = bindings()
    if (keys.has('ArrowLeft') || keys.has(k.walkLeft)) x -= 1
    if (keys.has('ArrowRight') || keys.has(k.walkRight)) x += 1
    if (keys.has('ArrowUp') || keys.has(k.walkUp)) y -= 1
    if (keys.has('ArrowDown') || keys.has(k.walkDown)) y += 1
    if (stick) {
      const len = Math.hypot(stick.dx, stick.dy)
      if (len < 7) { x = 0; y = 0 } else { x = stick.dx / STICK_PX; y = stick.dy / STICK_PX }
    }
    const len = Math.hypot(x, y)
    if (len > 1) { x /= len; y /= len }
    const input: Input = {
      move: { x, y },
      a: aHeldKey || aHeldTouch,
      aPress,
      bPress,
      cycle: cyclePress,
      ...(rollPress ? { rollPress } : {}),
      ...(bPress ? { jumpPress: true } : {}),
      ...(bKeys.size || bHeldTouch ? { jumpHeld: true } : {}),
      autoFace: hooks.touch(),
      tapSide,
      ...(pick !== undefined ? { pick } : {}),
    }
    tapSide = undefined
    pick = undefined
    aPress = false
    bPress = false
    cyclePress = false
    rollPress = false
    return input
  }

  function clear() {
    keys.clear()
    aHeldKey = false
    aHeldTouch = false
    aPress = false
    bPress = false
    cyclePress = false
    rollPress = false
    bKeys.clear()
    bHeldTouch = false
    tapSide = undefined
    pick = undefined
    stick = null
    idleTap = null
    waiting = null
  }

  function canvasPoint(e: PointerEvent) {
    const c = hooks.canvas()
    const r = c ? c.getBoundingClientRect() : { left: 0, top: 0, width: window.innerWidth }
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }
  }

  function onPointerDown(e: PointerEvent) {
    if (e.pointerType === 'touch' && !hooks.touch()) hooks.onTouch()
    if (isInteractive(e.target)) return
    const p = canvasPoint(e)
    if (hooks.idle()) { idleTap = { id: e.pointerId, x: p.x, y: p.y }; return }
    if (hooks.paused()) return
    // Any tap moves a dialog on; its side answers a YES / NO line.
    if (hooks.dialog()) {
      const answers = e.pointerType === 'mouse' ? null : hooks.answers?.()
      if (answers) {
        const on = answers.findIndex(b => p.x >= b.x && p.x < b.x + b.w && p.y >= b.y && p.y < b.y + b.h)
        if (on === 0 || on === 1) { aPress = true; pick = on }
      } else {
        aPress = true
        tapSide = p.x < p.w / 2 ? -1 : 1
      }
      if (e.pointerType !== 'mouse' && p.x < p.w * 0.6) waiting = { id: e.pointerId, x: p.x, y: p.y }
      return
    }
    if (e.pointerType === 'mouse') return
    if (!stick && p.x < p.w * 0.6) {
      stick = { id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 }
    } else if (p.x >= p.w * 0.6) {
      // A tap on the right of the world is an A press too.
      aPress = true
    }
  }

  function onPointerMove(e: PointerEvent) {
    if (waiting?.id === e.pointerId) {
      // The stick starts where the finger is when the lines close, not where it landed.
      if (hooks.dialog()) { const p = canvasPoint(e); waiting.x = p.x; waiting.y = p.y; return }
      if (!stick && live()) stick = { id: e.pointerId, ox: waiting.x, oy: waiting.y, dx: 0, dy: 0 }
      waiting = null
    }
    if (!stick || stick.id !== e.pointerId) return
    const p = canvasPoint(e)
    let dx = p.x - stick.ox
    let dy = p.y - stick.oy
    const len = Math.hypot(dx, dy)
    if (len > STICK_PX) {
      // The stick follows a finger that drifts too far, so it never goes dead.
      const over = len - STICK_PX
      stick.ox += (dx / len) * over
      stick.oy += (dy / len) * over
      dx = p.x - stick.ox
      dy = p.y - stick.oy
    }
    stick.dx = dx
    stick.dy = dy
  }

  function onPointerUp(e: PointerEvent) {
    if (idleTap && idleTap.id === e.pointerId) {
      const p = canvasPoint(e)
      const moved = Math.hypot(p.x - idleTap.x, p.y - idleTap.y)
      idleTap = null
      if (moved < TAP_PX && !isInteractive(e.target) && hooks.idle()) hooks.onIdleTap?.()
      return
    }
    if (stick?.id === e.pointerId) stick = null
    if (waiting?.id === e.pointerId) waiting = null
  }

  function onPointerCancel(e: PointerEvent) {
    if (idleTap?.id === e.pointerId) idleTap = null
    if (stick?.id === e.pointerId) stick = null
    if (waiting?.id === e.pointerId) waiting = null
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.metaKey || e.ctrlKey || e.altKey) return
    // A control beside the world that was reached by Tab (`data-game-keys`: the corner's buttons) owns the keys
    // that work it and no others: anything else lets go of it and is the game's, so nobody is left standing
    // with a button under their fingers.
    const own = (e.target as HTMLElement | null)?.closest?.('[data-game-keys]') as HTMLElement | null | undefined
    if (own) {
      if (OWN_KEYS.has(e.code)) return
      own.blur()
    } else if (isInteractive(e.target)) return
    if (hooks.onKey?.(e)) return
    if (hooks.idle()) return
    if (!isGameKey(e.code)) return
    e.preventDefault()
    if (hooks.paused()) return
    // A repeat of a key this input never saw go down was held across a page
    // change (back from a cabinet): it doesn't walk here.
    if (stepOf(e.code)) {
      if (!e.repeat || keys.has(e.code)) keys.add(e.code)
      return
    }
    if (e.repeat) return
    const action = actionOf(e.code)
    if (action === 'a') { aPress = true; aHeldKey = true }
    else if (action === 'b') { bPress = true; bKeys.add(e.code) }
    else if (action === 'cycle') cyclePress = true
    else if (action === 'roll') rollPress = true
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code)
    bKeys.delete(e.code)
    if (actionOf(e.code) === 'a') aHeldKey = false
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clear)
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerCancel)
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown)
    window.removeEventListener('keyup', onKeyUp)
    window.removeEventListener('blur', clear)
    window.removeEventListener('pointerdown', onPointerDown)
    window.removeEventListener('pointermove', onPointerMove)
    window.removeEventListener('pointerup', onPointerUp)
    window.removeEventListener('pointercancel', onPointerCancel)
  }

  return {
    read,
    clear,
    get stick() { return stick ? { ox: stick.ox, oy: stick.oy, dx: stick.dx, dy: stick.dy } : null },
    pressA() { if (live()) { aPress = true; aHeldTouch = true } },
    releaseA() { aHeldTouch = false },
    pressB() { if (live()) { bPress = true; bHeldTouch = true } },
    releaseB() { bHeldTouch = false },
    pressRoll() { if (live()) rollPress = true },
    cycle() { if (live()) cyclePress = true },
    attach,
    detach,
  }
}
