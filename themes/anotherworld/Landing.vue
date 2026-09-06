<template>
  <!-- Another Shore: own the page. Full-viewport flat-polygon coast canvas
    with the profile unboxed upper left while idle. The engine (world sim)
    and renderer (camera + drawing) arrive from sibling workers; this shell
    owns the loop, input, HUD and overlays only. -->
  <div ref="shellRef" class="aw-shell" :class="{ 'aw-istouch': isTouch }">
    <canvas ref="canvasRef" class="aw-canvas" aria-hidden="true" />

    <!-- Idle profile: unboxed personal text, upper left. -->
    <div v-if="phase === 'idle'" class="aw-profile">
      <p class="aw-chapter">Another shore</p>
      <h1 class="aw-name">{{ profile.name }}</h1>
      <p v-for="line in profile.blurbs" :key="line" class="aw-blurb">{{ line }}</p>
      <div class="aw-socials">
        <SocialLink
          v-for="s in profile.socials"
          :key="s.type"
          :href="s.href"
          :type="s.type"
          :css-class="s.cssClass ?? ''"
          width="24"
          height="24"
        />
      </div>
      <button type="button" class="aw-start" @click="startGame">
        {{ hint('Start the crossing — Enter', 'Start the crossing') }}
      </button>
      <p class="aw-controls-hint">{{ hint('← → / A D move · Space jump · P pause', '◀ ▶ move · Jump · pause above') }}</p>
    </div>

    <!-- Sparse HUD once the profile is gone. No score. -->
    <div v-if="phase === 'playing' || phase === 'paused'" class="aw-hud">
      <p class="aw-beacons" aria-live="polite">Beacon {{ beaconLit }} / {{ beaconTotal }}</p>
      <div class="aw-hud-buttons">
        <button
          v-if="phase === 'playing'"
          type="button"
          class="aw-hud-button"
          aria-label="Pause"
          @click="pauseGame"
        >
          Pause
        </button>
        <button
          v-else
          type="button"
          class="aw-hud-button"
          aria-label="Resume"
          @click="resumeGame"
        >
          Resume
        </button>
        <button type="button" class="aw-hud-button" aria-label="Exit to profile" @click="exitToIdle">
          Exit
        </button>
      </div>
    </div>

    <!-- Pointer-captured touch buttons. No global tap-to-start: idle swipes
      stay theme navigation. Rendered while a run is up; CSS shows them on
      touch input mode or coarse pointers only. -->
    <div v-if="phase === 'playing' || phase === 'paused'" class="aw-touch" aria-hidden="false">
      <div class="aw-touch-left">
        <button
          type="button"
          class="aw-touch-button"
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
          class="aw-touch-button"
          aria-label="Move right"
          @pointerdown="onTouchButton($event, 'right')"
          @pointerup="onTouchRelease($event, 'right')"
          @pointercancel="onTouchRelease($event, 'right')"
          @lostpointercapture="onTouchRelease($event, 'right')"
          @contextmenu.prevent
        >
          ▶
        </button>
      </div>
      <button
        type="button"
        class="aw-touch-button aw-touch-jump"
        aria-label="Jump"
        @pointerdown="onTouchButton($event, 'jump')"
        @pointerup="onTouchRelease($event, 'jump')"
        @pointercancel="onTouchRelease($event, 'jump')"
        @lostpointercapture="onTouchRelease($event, 'jump')"
        @contextmenu.prevent
      >
        Jump
      </button>
    </div>

    <!-- Pause overlay: explicit visible controls. -->
    <div v-if="phase === 'paused'" class="aw-overlay" role="dialog" aria-label="Paused">
      <p class="aw-overlay-kicker">Paused</p>
      <p class="aw-overlay-hint">{{ hint('P or Esc to resume', 'Resume below') }}</p>
      <div class="aw-overlay-buttons">
        <button type="button" class="aw-button" @click="resumeGame">Resume</button>
        <button type="button" class="aw-button" @click="exitToIdle">Exit</button>
      </div>
    </div>

    <!-- Win overlay: replay + exit, navigation released. -->
    <div v-if="phase === 'won'" class="aw-overlay" role="dialog" aria-label="Signal reached">
      <p class="aw-overlay-kicker">Signal reached</p>
      <p class="aw-overlay-hint">{{ hint('Enter to walk it again · Esc to leave', 'Walk it again, or leave') }}</p>
      <div class="aw-overlay-buttons">
        <button type="button" class="aw-button" @click="replay">Walk again</button>
        <button type="button" class="aw-button" @click="exitToIdle">Exit</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import SocialLink from '~/themes/base/SocialLink.vue'
import { profile } from '~/themes/content'
import { createWorld, stepWorld, demoInput } from './engine'
import { drawWorld } from './renderer'
import type { World, Input } from './types'

type Phase = 'idle' | 'playing' | 'paused' | 'won'
type TouchKind = 'left' | 'right' | 'jump'

const STEP = 1 / 60
const MAX_STEPS = 4

const { navigationLocked } = useTheme()
const { isTouch, hint } = useInputMode()

const shellRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const phase = ref<Phase>('idle')
const beaconLit = ref(0)
const beaconTotal = ref(3)

let world: World | null = null
let raf = 0
let last = 0
let acc = 0
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
  drawWorld(ctx, world, cssW, cssH)
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
    stepWorld(world, demoInput(world), STEP)
    acc -= STEP
    n += 1
    if (world.won) break
  }
  if (n === MAX_STEPS) acc = 0
  if (world.won) {
    // Attract mode restarts on the same physics; no overlay, no nav change.
    world = createWorld()
    acc = 0
  }
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
  resetInput()
  phase.value = 'idle'
  navigationLocked.value = false
  blurActiveElement()
  needsDraw = true
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
    case 'Escape':
      if (!e.repeat) {
        e.preventDefault()
        if (phase.value === 'playing') pauseGame()
        else resumeGame()
      }
      break
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
  position: relative;
  height: 100dvh;
  overflow: hidden;
  background: #101f2a;
  color: #ece4d4;
  font-family: var(--font-person);
  box-sizing: border-box;
}

.aw-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: pan-x pan-y;
}

/* Idle profile: flat backing only, no card, no border, no shadow. */
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
  color: #e7bb80;
  margin: 0 0 8px;
}

.aw-name {
  font-weight: 300;
  font-size: clamp(34px, 4.2vw, 60px);
  line-height: 1.05;
  letter-spacing: -0.01em;
  text-transform: lowercase;
  color: #ece4d4;
  margin: 0 0 10px;
}

.aw-blurb {
  font-weight: 300;
  font-size: 15px;
  line-height: 1.5;
  color: #ece4d4;
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
  color: #e7bb80;
  background: transparent;
  border: none;
  border-bottom: 1px solid #e7bb80;
  cursor: pointer;
}

.aw-start:focus-visible,
.aw-button:focus-visible,
.aw-hud-button:focus-visible,
.aw-touch-button:focus-visible {
  outline: 2px solid #e7bb80;
  outline-offset: 3px;
}

.aw-controls-hint {
  font-family: var(--font-machine);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a9b8ac;
  margin: 10px 0 0;
}

/* HUD: sparse beacon progress + visible pause/exit. */
.aw-hud {
  position: absolute;
  top: max(12px, env(safe-area-inset-top));
  left: max(12px, env(safe-area-inset-left));
  right: max(12px, env(safe-area-inset-right));
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  pointer-events: none;
}

.aw-beacons {
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #e7bb80;
  background: rgba(9, 23, 32, 0.55);
  padding: 8px 10px;
  margin: 0;
}

.aw-hud-buttons {
  display: flex;
  gap: 8px;
  pointer-events: auto;
}

.aw-hud-button {
  min-height: 44px;
  min-width: 44px;
  padding: 10px 14px;
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #ece4d4;
  background: rgba(9, 23, 32, 0.55);
  border: 1px solid #356372;
  cursor: pointer;
}

/* Touch buttons: hidden on fine pointers unless touch input mode is live. */
.aw-touch {
  position: absolute;
  left: max(12px, env(safe-area-inset-left));
  right: max(12px, env(safe-area-inset-right));
  bottom: max(72px, calc(60px + env(safe-area-inset-bottom)));
  display: none;
  align-items: flex-end;
  justify-content: space-between;
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

.aw-touch-left {
  display: flex;
  gap: 12px;
  pointer-events: auto;
}

.aw-touch-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 56px;
  min-height: 56px;
  padding: 12px 16px;
  font-family: var(--font-machine);
  font-size: 13px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: #ece4d4;
  background: rgba(9, 23, 32, 0.6);
  border: 1px solid #356372;
  cursor: pointer;
  touch-action: none;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

/* Overlays: flat panel, no animation. */
.aw-overlay {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  max-width: min(340px, calc(100vw - 48px));
  width: max-content;
  background: #0b1820;
  border: 1px solid #356372;
  padding: 20px 22px;
  text-align: center;
}

.aw-overlay-kicker {
  font-family: var(--font-machine);
  font-size: 14px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: #e7bb80;
  margin: 0 0 8px;
}

.aw-overlay-hint {
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #a9b8ac;
  margin: 0 0 14px;
}

.aw-overlay-buttons {
  display: flex;
  gap: 10px;
  justify-content: center;
  flex-wrap: wrap;
}

.aw-button {
  min-height: 44px;
  padding: 10px 18px;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #101f2a;
  background: #e7bb80;
  border: none;
  cursor: pointer;
}

/* Small phones: compact unboxed profile, still upper left. */
@media (max-width: 600px) {
  .aw-profile {
    top: max(40px, env(safe-area-inset-top));
    left: max(24px, env(safe-area-inset-left));
    max-width: calc(100vw - 48px);
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
}

/* Short landscape phones: keep the profile narrow so the coast keeps
  most of the viewport; the renderer owns the horizontal camera. */
@media (max-height: 480px) {
  .aw-controls-hint { display: none; }
  .aw-profile {
    top: max(20px, env(safe-area-inset-top));
    max-width: 220px;
    padding: 8px 10px 10px;
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
    margin-top: 6px;
  }

  .aw-socials :deep(svg),
  .aw-socials :deep(img) {
    width: 20px;
    height: 20px;
  }

  .aw-start {
    margin-top: 8px;
    padding: 8px 12px;
  }

  .aw-touch {
    bottom: max(56px, calc(48px + env(safe-area-inset-bottom)));
  }
}

.aw-start:active, .aw-button:active, .aw-hud-button:active, .aw-touch-button:active { transform: scale(0.96); }

@media (prefers-reduced-motion: reduce) {
  .aw-shell,
  .aw-overlay,
  .aw-profile {
    animation: none;
  }
}
</style>
