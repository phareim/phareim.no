/**
 * Keyboard and pointer input for Mini World (2026-09-26).
 *
 * Keyboard writes `InputState` on key changes only, so between key events
 * the UI's touch stick owns moveX/moveY. The canvas takes pointer drags:
 * a mouse drag anywhere, or a touch that starts on the right half (the
 * left half belongs to the UI's floating stick), turns the camera; two
 * touches pinch-zoom; the wheel zooms. In house edit mode every pointer on
 * the canvas goes to the room editor instead.
 *
 * Another player under a press (`peerAt`) makes it a tap candidate: the
 * camera holds still until the pointer moves past a few pixels, and a
 * release inside that slop taps the player (`tapPeer`) instead of turning.
 */
import type { InputState } from './contracts'

export interface InputHooks {
  /** House edit mode: pointers go to the editor, not the camera. */
  isEdit(): boolean
  /** CSS px relative to the canvas. */
  editPointer(kind: 'down' | 'move' | 'up', x: number, y: number): void
  /** The shared world: the other player under this point (CSS px), or null. */
  peerAt?(x: number, y: number): string | null
  tapPeer?(id: string): void
}

export interface InputHandle {
  dispose(): void
}

const MOVE_KEYS: Record<string, [number, number]> = {
  KeyW: [0, 1], ArrowUp: [0, 1],
  KeyS: [0, -1], ArrowDown: [0, -1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
}

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  if (!el || !el.tagName) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

export function attachInput(canvas: HTMLCanvasElement, input: InputState, hooks: InputHooks): InputHandle {
  const held = new Set<string>()
  let keyMoving = false

  const applyMove = () => {
    let x = 0, y = 0
    for (const k of held) { const d = MOVE_KEYS[k]; if (d) { x += d[0]; y += d[1] } }
    const l = Math.hypot(x, y)
    if (l > 0) {
      input.moveX = x / l; input.moveY = y / l
      keyMoving = true
    } else if (keyMoving) {
      input.moveX = 0; input.moveY = 0
      keyMoving = false
    }
  }

  const onKeyDown = (e: KeyboardEvent) => {
    if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
    const c = e.code
    if (MOVE_KEYS[c]) {
      held.add(c)
      applyMove()
      e.preventDefault()
    } else if (c === 'Space') {
      if (!e.repeat) input.jumpPressed = true
      input.jump = true
      e.preventDefault()
    } else if (c === 'KeyE' || c === 'Enter' || c === 'NumpadEnter') {
      if (!e.repeat) input.actionPressed = true
    } else if (c === 'KeyF') {
      if (!e.repeat) input.usePressed = true
    }
  }
  const onKeyUp = (e: KeyboardEvent) => {
    const c = e.code
    if (MOVE_KEYS[c]) { held.delete(c); applyMove() }
    else if (c === 'Space') input.jump = false
  }
  const onBlur = () => {
    held.clear(); applyMove(); input.jump = false
  }

  // ---------------------------------------------------------------- pointers

  /** sx/sy: where the press began; peer: a tap candidate until it moves past the slop. */
  interface P { x: number; y: number; cam: boolean; sx: number; sy: number; peer: string | null; slop: number }
  const pointers = new Map<number, P>()
  let pinchDist = 0

  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }
  }

  const camPointers = () => {
    const list: P[] = []
    for (const p of pointers.values()) if (p.cam) list.push(p)
    return list
  }

  const onDown = (e: PointerEvent) => {
    const l = local(e)
    if (hooks.isEdit()) {
      pointers.set(e.pointerId, { x: l.x, y: l.y, cam: false, sx: l.x, sy: l.y, peer: null, slop: 0 })
      try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
      hooks.editPointer('down', l.x, l.y)
      e.preventDefault()
      return
    }
    const touch = e.pointerType === 'touch'
    // The left half is the UI's stick; a second finger may pinch anywhere.
    const cam = !touch || l.x > l.w * 0.4 || camPointers().length > 0
    if (!cam) return
    if (!touch && e.button !== 0 && e.button !== 2) return
    const first = camPointers().length === 0
    // A second finger turns every press into a pinch.
    if (!first) for (const q of pointers.values()) q.peer = null
    const peer = first && (touch || e.button === 0) ? hooks.peerAt?.(l.x, l.y) ?? null : null
    pointers.set(e.pointerId, { x: l.x, y: l.y, cam: true, sx: l.x, sy: l.y, peer, slop: touch ? 12 : 6 })
    try { canvas.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    const cp = camPointers()
    if (cp.length === 2) pinchDist = Math.hypot(cp[0]!.x - cp[1]!.x, cp[0]!.y - cp[1]!.y)
    e.preventDefault()
  }

  const onMove = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    const l = local(e)
    if (!p.cam) {
      p.x = l.x; p.y = l.y
      hooks.editPointer('move', l.x, l.y)
      return
    }
    if (p.peer) {
      if (Math.hypot(l.x - p.sx, l.y - p.sy) < p.slop) return
      p.peer = null // a drag after all: the view catches up from the press
    }
    const dx = l.x - p.x, dy = l.y - p.y
    p.x = l.x; p.y = l.y
    const cp = camPointers()
    if (cp.length >= 2) {
      const d = Math.hypot(cp[0]!.x - cp[1]!.x, cp[0]!.y - cp[1]!.y)
      if (pinchDist > 0 && d > 0) input.zoom *= pinchDist / d
      pinchDist = d
      return
    }
    const k = e.pointerType === 'touch' ? 0.011 : 0.007
    input.camYaw -= dx * k
    input.camPitch += dy * k * 0.8
  }

  const onUp = (e: PointerEvent) => {
    const p = pointers.get(e.pointerId)
    if (!p) return
    pointers.delete(e.pointerId)
    if (!p.cam) {
      const l = local(e)
      hooks.editPointer('up', l.x, l.y)
    } else if (p.peer && e.type === 'pointerup') {
      const l = local(e)
      hooks.tapPeer?.(hooks.peerAt?.(l.x, l.y) ?? p.peer)
    }
    const cp = camPointers()
    if (cp.length < 2) pinchDist = 0
  }

  const onWheel = (e: WheelEvent) => {
    if (hooks.isEdit()) return
    input.zoom *= Math.exp(Math.max(-200, Math.min(200, e.deltaY)) * 0.0015)
    e.preventDefault()
  }
  const onContext = (e: Event) => e.preventDefault()

  canvas.style.touchAction = 'none'
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('contextmenu', onContext)

  return {
    dispose() {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', onContext)
    },
  }
}
