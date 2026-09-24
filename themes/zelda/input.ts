/**
 * Keyboard, pointer and floating-stick input for the Neon Shrine engine,
 * shared by Neon Shrine (`Zelda.vue`) and the portal (`portal/Portal.vue`).
 * Framework-free: the shell passes hooks for what depends on its own state
 * (phase, pause, touch deck) and calls `read()` once per frame.
 *
 * Keys: arrows / WASD move; Space / J / Z / Enter = A; K / X / Shift = B;
 * Q / Tab / C cycle. Touch: a floating stick starts under a finger on the
 * left 60 % of the screen; a tap on the right 40 % presses A; any tap moves a
 * dialog on. The mouse only moves dialogs on (the deck buttons call pressA …).
 */
import type { Input } from './types'

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
  cycle(): void
  attach(): void
  detach(): void
}

const STICK_PX = 38
const TAP_PX = 10

const A_KEYS = new Set(['Space', 'KeyJ', 'KeyZ', 'Enter'])
const B_KEYS = new Set(['KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight'])
const CYCLE_KEYS = new Set(['KeyQ', 'Tab', 'KeyC'])
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW', 'KeyS'])

export function isGameKey(code: string) {
  return MOVE_KEYS.has(code) || A_KEYS.has(code) || B_KEYS.has(code) || CYCLE_KEYS.has(code)
}

/** Links, buttons and site chrome keep their own clicks and keys. */
export function isInteractive(el: EventTarget | null) {
  return !!(el as HTMLElement | null)?.closest?.('a, button, .theme-pager, .radio-widget')
}

export function createInput(hooks: InputHooks): GameInput {
  const keys = new Set<string>()
  let aHeldKey = false
  let aHeldTouch = false
  let aPress = false
  let bPress = false
  let cyclePress = false
  let stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null
  let idleTap: { id: number; x: number; y: number } | null = null

  const live = () => !hooks.idle() && !hooks.paused()

  function read(): Input {
    let x = 0
    let y = 0
    if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1
    if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1
    if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1
    if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1
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
      autoFace: hooks.touch(),
    }
    aPress = false
    bPress = false
    cyclePress = false
    return input
  }

  function clear() {
    keys.clear()
    aHeldKey = false
    aHeldTouch = false
    aPress = false
    bPress = false
    cyclePress = false
    stick = null
    idleTap = null
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
    // Any tap moves a dialog on.
    if (hooks.dialog()) { aPress = true; return }
    if (e.pointerType === 'mouse') return
    if (!stick && p.x < p.w * 0.6) {
      stick = { id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 }
    } else if (p.x >= p.w * 0.6) {
      // A tap on the right of the world is an A press too.
      aPress = true
    }
  }

  function onPointerMove(e: PointerEvent) {
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
  }

  function onPointerCancel(e: PointerEvent) {
    if (idleTap?.id === e.pointerId) idleTap = null
    if (stick?.id === e.pointerId) stick = null
  }

  function onKeyDown(e: KeyboardEvent) {
    if (isInteractive(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
    if (hooks.onKey?.(e)) return
    if (hooks.idle()) return
    if (!isGameKey(e.code)) return
    e.preventDefault()
    if (hooks.paused()) return
    // A repeat of a key this input never saw go down was held across a page
    // change (walking into the portal's hut door): it doesn't walk here.
    if (MOVE_KEYS.has(e.code)) { if (!e.repeat || keys.has(e.code)) keys.add(e.code); return }
    if (e.repeat) return
    if (A_KEYS.has(e.code)) { aPress = true; aHeldKey = true }
    else if (B_KEYS.has(e.code)) bPress = true
    else if (CYCLE_KEYS.has(e.code)) cyclePress = true
  }

  function onKeyUp(e: KeyboardEvent) {
    keys.delete(e.code)
    if (A_KEYS.has(e.code)) aHeldKey = false
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
    pressB() { if (live()) bPress = true },
    cycle() { if (live()) cyclePress = true },
    attach,
    detach,
  }
}
