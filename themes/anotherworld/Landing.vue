<template>
  <!-- Another Shore: own the page. A full-viewport flat-polygon coast with
    the chapter title unboxed upper left while idle. No HUD boxes: beacon progress
    is three small dots, pause/exit are one line of text, touch controls are
    thin outlined zones in the black band at the bottom. -->
  <div ref="shellRef" class="aw-shell" :class="{ 'aw-istouch': isTouch, 'aw-dawn': dawn }">
    <canvas ref="canvasRef" class="aw-canvas" aria-hidden="true" />

    <!-- Idle title: the prologue, over the sky. -->
    <div v-if="phase === 'idle'" class="aw-profile">
      <p class="aw-chapter">Another shore</p>
      <button type="button" class="aw-start" @click="startGame">
        {{ hint('Start the crossing — Enter', 'Start the crossing') }}
      </button>
      <p class="aw-controls-hint">{{ hint('← → / A D move · Space jump · Esc pause · hold Esc to leave', '◀ ▶ move · jump · pause above') }}</p>
    </div>

    <!-- One line of text, top right. No border, no background. -->
    <p v-if="phase === 'playing' || phase === 'paused'" class="aw-top">
      <button v-if="phase === 'playing'" type="button" class="aw-text" @click="pauseGame">pause</button>
      <button v-else type="button" class="aw-text" @click="resumeGame">resume</button>
      <span class="aw-sep">·</span>
      <button type="button" class="aw-text" @click="exitToIdle">exit</button>
    </p>

    <!-- Beacon progress: three dots, low right. -->
    <p v-if="phase !== 'idle'" class="aw-dots" :aria-label="`Beacon ${beaconLit} of ${beaconTotal}`">
      <span v-for="i in beaconTotal" :key="i" class="aw-dot" :class="{ 'aw-dot-lit': i <= beaconLit }" />
    </p>

    <!-- Touch zones: pointer-captured, outlines only, in the black band. -->
    <div v-if="phase === 'playing' || phase === 'paused'" class="aw-touch">
      <button
        type="button"
        class="aw-zone"
        aria-label="Move left"
        @pointerdown="onTouchButton($event, 'left')"
        @pointerup="onTouchRelease($event, 'left')"
        @pointercancel="onTouchRelease($event, 'left')"
        @lostpointercapture="onTouchRelease($event, 'left')"
        @contextmenu.prevent
      >
        ◀
      </button>
      <button
        type="button"
        class="aw-zone"
        aria-label="Move right"
        @pointerdown="onTouchButton($event, 'right')"
        @pointerup="onTouchRelease($event, 'right')"
        @pointercancel="onTouchRelease($event, 'right')"
        @lostpointercapture="onTouchRelease($event, 'right')"
        @contextmenu.prevent
      >
        ▶
      </button>
      <button
        type="button"
        class="aw-zone aw-zone-jump"
        aria-label="Jump"
        @pointerdown="onTouchButton($event, 'jump')"
        @pointerup="onTouchRelease($event, 'jump')"
        @pointercancel="onTouchRelease($event, 'jump')"
        @lostpointercapture="onTouchRelease($event, 'jump')"
        @contextmenu.prevent
      >
        jump
      </button>
    </div>

    <!-- Paused: the palette dims (renderer) and one line says so. -->
    <p v-if="phase === 'paused'" class="aw-line" role="status">
      paused — {{ hint('P to resume', 'resume above') }}
    </p>

    <!-- Won: the lamp is lit and the world is at dawn. -->
    <div v-if="phase === 'won'" class="aw-won" role="dialog" aria-label="The lamp is lit">
      <p class="aw-won-name">the lamp is lit</p>
      <p class="aw-won-line">
        <button type="button" class="aw-text" @click="replay">{{ hint('walk again — Enter', 'walk again') }}</button>
        <span class="aw-sep">·</span>
        <button type="button" class="aw-text" @click="exitToIdle">{{ hint('leave — Esc', 'leave') }}</button>
      </p>
    </div>

    <!-- EscHold owns Escape while crossing: tap pauses/resumes, a 3 s hold leaves. -->
    <EscHold :is-active="escActive" :paused="false" :show-paused="false" @tap="escTap" @hold="exitToIdle" />
  </div>
</template>

<script setup lang="ts">
import EscHold from '../base/EscHold.vue'
import { createWorld, stepWorld, demoInput } from './engine'
import { drawWorld, paletteNameFor } from './renderer'
import type { World, Input } from './types'

type Phase = 'idle' | 'playing' | 'paused' | 'won'
type TouchKind = 'left' | 'right' | 'jump'

const STEP = 1 / 60
const MAX_STEPS = 4
const IDLE_WIN_HOLD = 2.5 // seconds of dawn before the attract loop restarts

const { navigationLocked } = useTheme()
const { isTouch, hint } = useInputMode()

const shellRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const phase = ref<Phase>('idle')
const beaconLit = ref(0)
const beaconTotal = ref(3)
const dawn = ref(false)

let world: World | null = null
let raf = 0
let last = 0
let acc = 0
let idleHold = 0
let needsDraw = true
let cssW = 0
let cssH = 0
let dpr = 1
let ctx: CanvasRenderingContext2D | null = null
let reducedMotion = false
let resizeObserver: ResizeObserver | null = null

// Keyboard state + per-button touch pointer sets (multi-touch safe).
const keyState = { left: false, right: false, jump: false }
const touchPoints: Record<TouchKind, Set<number>> = {
  left: new Set(),
  right: new Set(),
  jump: new Set(),
}

function updateBeacons() {
  if (!world) return
  beaconTotal.value = world.beacons.length
  beaconLit.value = world.beacons.filter(b => b.lit).length
  dawn.value = paletteNameFor(world) === 'dawn'
}

function resetInput() {
  keyState.left = false
  keyState.right = false
  keyState.jump = false
  touchPoints.left.clear()
  touchPoints.right.clear()
  touchPoints.jump.clear()
}

function currentInput(): Input {
  return {
    left: keyState.left || touchPoints.left.size > 0,
    right: keyState.right || touchPoints.right.size > 0,
    jump: keyState.jump || touchPoints.jump.size > 0,
  }
}

function draw() {
  if (!ctx || !world || cssW <= 0 || cssH <= 0) return
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawWorld(ctx, world, cssW, cssH, { reducedMotion, paused: phase.value === 'paused' })
  needsDraw = false
}

function stepPlaying(dt: number) {
  if (!world) return
  acc += Math.min(dt, 0.1)
  const input = currentInput()
  let n = 0
  while (acc >= STEP && n < MAX_STEPS) {
    stepWorld(world, input, STEP)
    acc -= STEP
    n += 1
    if (world.won) break
  }
  if (n === MAX_STEPS) acc = 0
  updateBeacons()
  if (world.won) {
    phase.value = 'won'
    navigationLocked.value = false
    resetInput()
  }
}

function stepIdle(dt: number) {
  if (!world) return
  acc += Math.min(dt, 0.1)
  let n = 0
  while (acc >= STEP && n < MAX_STEPS) {
    if (world.won) {
      // Attract mode holds the dawn for a beat, then restarts on the same physics.
      idleHold += STEP
      if (idleHold >= IDLE_WIN_HOLD) {
        world = createWorld()
        idleHold = 0
      }
    } else {
      stepWorld(world, demoInput(world), STEP)
    }
    acc -= STEP
    n += 1
  }
  if (n === MAX_STEPS) acc = 0
  updateBeacons()
}

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  const dt = last === 0 ? STEP : Math.min((t - last) / 1000, 0.1)
  last = t
  if (phase.value === 'playing') {
    stepPlaying(dt)
    draw()
  } else if (phase.value === 'idle') {
    if (reducedMotion) {
      if (needsDraw) draw()
    } else {
      stepIdle(dt)
      draw()
    }
  } else if (phase.value === 'won') {
    // The lamp stays lit; the figure breathes. Reduced motion holds the frame.
    if (!reducedMotion && world) {
      world.time += dt
      draw()
    } else if (needsDraw) draw()
  } else if (needsDraw) {
    draw()
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  cssW = Math.max(1, Math.round(rect.width))
  cssH = Math.max(1, Math.round(rect.height))
  dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  ctx = canvas.getContext('2d')
  needsDraw = true
}

function blurActiveElement() {
  const el = document.activeElement as HTMLElement | null
  if (el && typeof el.blur === 'function') el.blur()
}

function startGame() {
  world = createWorld()
  updateBeacons()
  acc = 0
  last = 0
  idleHold = 0
  resetInput()
  phase.value = 'playing'
  navigationLocked.value = true
  blurActiveElement()
  needsDraw = true
}

function replay() {
  startGame()
}

function pauseGame() {
  if (phase.value !== 'playing') return
  phase.value = 'paused'
  // Navigation stays locked while paused so arrows never switch theme.
  navigationLocked.value = true
  resetInput()
  needsDraw = true
  blurActiveElement()
}

function resumeGame() {
  if (phase.value !== 'paused') return
  acc = 0
  last = 0
  resetInput()
  phase.value = 'playing'
  navigationLocked.value = true
  blurActiveElement()
  needsDraw = true
}

function exitToIdle() {
  world = createWorld()
  updateBeacons()
  acc = 0
  idleHold = 0
  resetInput()
  phase.value = 'idle'
  navigationLocked.value = false
  blurActiveElement()
  needsDraw = true
}

function escActive() {
  return phase.value === 'playing' || phase.value === 'paused'
}

function escTap() {
  if (phase.value === 'playing') pauseGame()
  else if (phase.value === 'paused') resumeGame()
}

function isInteractiveTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  return t.closest('a,button,input,textarea,select') !== null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return
  // Space/Enter on a focused link or button belongs to that control
  // (native activation); the start/resume/exit buttons cover it.
  if ((e.code === 'Space' || e.code === 'Enter') && isInteractiveTarget(e.target)) return
  // No repeat toggling: holding Enter must not start/stop repeatedly.
  const repeatGuard = e.repeat && (e.code === 'Enter' || e.code === 'Space')

  if (phase.value === 'idle') {
    if (e.code === 'Enter' && !e.repeat) {
      e.preventDefault()
      startGame()
    }
    return
  }

  if (phase.value === 'won') {
    if (e.code === 'Enter' && !e.repeat) {
      e.preventDefault()
      replay()
    } else if (e.code === 'Escape') {
      e.preventDefault()
      exitToIdle()
    }
    return
  }

  // Playing or paused: the run owns gameplay keys.
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      keyState.left = true
      e.preventDefault()
      break
    case 'ArrowRight':
    case 'KeyD':
      keyState.right = true
      e.preventDefault()
      break
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      keyState.jump = true
      e.preventDefault()
      break
    case 'KeyP':
      if (!e.repeat) {
        e.preventDefault()
        if (phase.value === 'playing') pauseGame()
        else resumeGame()
      }
      break
    // Escape while crossing belongs to EscHold (tap = pause, 3 s hold = leave).
    case 'Enter':
      if (!repeatGuard && phase.value === 'paused') {
        e.preventDefault()
        resumeGame()
      }
      break
  }
}

function onKeyUp(e: KeyboardEvent) {
  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      keyState.left = false
      break
    case 'ArrowRight':
    case 'KeyD':
      keyState.right = false
      break
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      keyState.jump = false
      break
  }
}

function onTouchButton(e: PointerEvent, kind: TouchKind) {
  e.preventDefault()
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // Older browsers may not support capture; per-button sets still work.
  }
  touchPoints[kind].add(e.pointerId)
}

function onTouchRelease(e: PointerEvent, kind: TouchKind) {
  touchPoints[kind].delete(e.pointerId)
}

function pauseOnHidden() {
  if (phase.value === 'playing') pauseGame()
  else resetInput()
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') pauseOnHidden()
}

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  world = createWorld()
  updateBeacons()
  resize()
  if (reducedMotion) draw()

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', resize)
  window.addEventListener('blur', pauseOnHidden)
  document.addEventListener('visibilitychange', onVisibilityChange)
  if (shellRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(shellRef.value)
  }
  last = 0
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', resize)
  window.removeEventListener('blur', pauseOnHidden)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  resizeObserver?.disconnect()
  resizeObserver = null
  navigationLocked.value = false
})
</script>

<style scoped>
.aw-shell {
  --aw-ink: #ece4d4;
  --aw-ink-dim: #a9b8ac;
  --aw-amber: #e7bb80;
  --aw-edge: #4b8194;
  position: relative;
  height: 100dvh;
  overflow: hidden;
  background: #101f2a;
  color: var(--aw-ink);
  font-family: var(--font-person);
  box-sizing: border-box;
}

/* At dawn the sky is pale: the ink goes dark. A hard cut like the palette. */
.aw-dawn {
  --aw-ink: #1a2228;
  --aw-ink-dim: #4a5a62;
  --aw-amber: #6a4534;
  --aw-edge: #566a73;
}

.aw-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: pan-x pan-y;
}

/* Idle profile: unboxed, over the sky. */
.aw-profile {
  position: absolute;
  top: max(9vh, env(safe-area-inset-top));
  left: max(7vw, env(safe-area-inset-left));
  max-width: min(440px, calc(100vw - 48px));
  padding: 0;
}

.aw-chapter {
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--aw-amber);
  margin: 0 0 8px;
}

.aw-name {
  font-weight: 300;
  font-size: clamp(34px, 4.2vw, 60px);
  line-height: 1.05;
  letter-spacing: -0.01em;
  text-transform: lowercase;
  color: var(--aw-ink);
  margin: 0 0 10px;
}

.aw-blurb {
  font-weight: 300;
  font-size: 15px;
  line-height: 1.5;
  color: var(--aw-ink);
  margin: 2px 0;
}

.aw-socials {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 10px -10px 0;
}

.aw-socials :deep(svg),
.aw-socials :deep(img) {
  width: 24px;
  height: 24px;
  transition: none;
}
.aw-socials :deep(a) { min-width: 44px; min-height: 44px; margin: 0; }
.aw-socials :deep(svg:hover), .aw-socials :deep(img:hover) { transform: none; }

.aw-start {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin-top: 12px;
  padding: 10px 0;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--aw-amber);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--aw-amber);
  cursor: pointer;
}

.aw-start:focus-visible,
.aw-text:focus-visible,
.aw-zone:focus-visible {
  outline: 2px solid var(--aw-amber);
  outline-offset: 3px;
}

.aw-controls-hint {
  font-family: var(--font-machine);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--aw-ink-dim);
  margin: 10px 0 0;
}

/* Text buttons: the only chrome while playing. */
.aw-text {
  min-height: 44px;
  padding: 10px 4px;
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aw-ink);
  background: transparent;
  border: none;
  cursor: pointer;
}

.aw-sep {
  font-family: var(--font-machine);
  font-size: 11px;
  color: var(--aw-ink-dim);
  padding: 0 4px;
}

.aw-top {
  position: absolute;
  top: max(4px, env(safe-area-inset-top));
  right: max(12px, env(safe-area-inset-right));
  margin: 0;
  display: flex;
  align-items: center;
}

.aw-dots {
  position: absolute;
  right: max(20px, env(safe-area-inset-right));
  bottom: max(18px, env(safe-area-inset-bottom));
  margin: 0;
  display: flex;
  gap: 8px;
  pointer-events: none;
}

.aw-dot {
  width: 5px;
  height: 5px;
  background: var(--aw-ink-dim);
  opacity: 0.55;
}

.aw-dot-lit {
  background: var(--aw-amber);
  opacity: 1;
}

/* Touch zones: hidden on fine pointers unless touch input mode is live. */
.aw-touch {
  position: absolute;
  left: max(10px, env(safe-area-inset-left));
  right: max(10px, env(safe-area-inset-right));
  bottom: max(40px, calc(30px + env(safe-area-inset-bottom)));
  display: none;
  gap: 8px;
  pointer-events: none;
}

.aw-istouch .aw-touch {
  display: flex;
}

@media (pointer: coarse) {
  .aw-touch {
    display: flex;
  }
}

.aw-istouch .aw-dots,
.aw-istouch .aw-line {
  bottom: max(96px, calc(86px + env(safe-area-inset-bottom)));
}

@media (pointer: coarse) {
  .aw-shell .aw-dots,
  .aw-shell .aw-line {
    bottom: max(96px, calc(86px + env(safe-area-inset-bottom)));
  }
}

.aw-zone {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 46px;
  padding: 0;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aw-ink-dim);
  background: transparent;
  border: 1px solid var(--aw-edge);
  cursor: pointer;
  touch-action: none;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.aw-zone-jump {
  flex: 2 1 0;
}

/* Paused: one line at the bottom centre. */
.aw-line {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(48px, calc(36px + env(safe-area-inset-bottom)));
  margin: 0;
  text-align: center;
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--aw-ink-dim);
  pointer-events: none;
}

/* Won: the name back in the sky, small; two plain buttons under it. */
.aw-won {
  position: absolute;
  top: max(9vh, env(safe-area-inset-top));
  left: max(7vw, env(safe-area-inset-left));
}

.aw-won-name {
  font-weight: 300;
  font-size: 20px;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  color: var(--aw-ink);
  margin: 0 0 4px;
}

.aw-won-line {
  margin: 0 0 0 -4px;
  display: flex;
  align-items: center;
}

/* Small phones: compact unboxed profile, still upper left; the moon sits
  top right beside it, so the copy stays under 262px wide. */
@media (max-width: 600px) {
  .aw-profile {
    top: max(36px, env(safe-area-inset-top));
    left: max(24px, env(safe-area-inset-left));
    max-width: 262px;
    padding: 0;
  }

  .aw-name {
    font-size: 27px;
    margin-bottom: 6px;
  }

  .aw-blurb {
    font-size: 13px;
  }

  .aw-controls-hint {
    display: none;
  }

  .aw-won {
    top: max(36px, env(safe-area-inset-top));
    left: max(24px, env(safe-area-inset-left));
  }
}

/* Short landscape phones: a narrow profile column; the start line never wraps. */
@media (max-height: 480px) {
  .aw-controls-hint { display: none; }
  .aw-profile {
    top: max(14px, env(safe-area-inset-top));
    left: max(24px, env(safe-area-inset-left));
    max-width: 200px;
    padding: 0;
  }

  .aw-chapter {
    margin-bottom: 4px;
  }

  .aw-name {
    font-size: 22px;
    margin-bottom: 4px;
  }

  .aw-blurb {
    font-size: 12px;
    line-height: 1.4;
  }

  .aw-socials {
    margin-top: 4px;
  }

  .aw-socials :deep(a) { min-width: 36px; min-height: 36px; }
  .aw-socials :deep(svg),
  .aw-socials :deep(img) {
    width: 20px;
    height: 20px;
  }

  .aw-start {
    min-height: 36px;
    margin-top: 4px;
    padding: 6px 0;
    font-size: 11px;
    letter-spacing: 0.1em;
  }

  .aw-touch {
    bottom: max(34px, calc(26px + env(safe-area-inset-bottom)));
  }

  .aw-zone {
    min-height: 30px;
    font-size: 11px;
  }

  .aw-istouch .aw-dots,
  .aw-istouch .aw-line {
    bottom: 72px;
  }

  .aw-won {
    top: max(14px, env(safe-area-inset-top));
    left: max(24px, env(safe-area-inset-left));
  }
}

@media (prefers-reduced-motion: reduce) {
  .aw-shell,
  .aw-profile {
    animation: none;
  }
}
</style>
