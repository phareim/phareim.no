<template>
  <!-- Another Shore II: seven fixed frames. The canvas owns the picture; this
    shell owns the loop, input and the few lines of DOM text (title, pause
    line, win line). No HUD: progress is the lamps on the tower. -->
  <div ref="shellRef" class="sh-shell" :class="{ 'sh-istouch': isTouch }">
    <canvas ref="canvasRef" class="sh-canvas" aria-hidden="true" />

    <!-- Idle: the title over the tide pool's sky. Shot 1 loops behind it. -->
    <div v-if="phase === 'idle'" class="sh-profile">
      <p class="sh-chapter">another shore</p>
      <button type="button" class="sh-line sh-start" @click="startGame">
        {{ hint('walk — enter', 'walk') }}
      </button>
      <p class="sh-hint">{{ hint('← → run · space jump · ↓ crouch · p pause', '◀ ▶ run · ▲ jump · ▼ crouch') }}</p>
    </div>

    <!-- Pause: the palette is one step darker; one line of machine text. -->
    <div v-if="phase === 'paused'" class="sh-pauseline" role="dialog" aria-label="Paused">
      <span>paused</span>
      <button type="button" class="sh-line" @click="resumeGame">{{ hint('resume — p', 'resume') }}</button>
      <button type="button" class="sh-line" @click="exitToIdle">leave</button>
    </div>

    <!-- Win: dawn. The name returns in the sky, then two plain buttons. -->
    <div v-if="phase === 'won'" class="sh-win" role="dialog" aria-label="The lamp is lit">
      <p class="sh-win-name">the lamp is lit</p>
      <div class="sh-win-buttons">
        <button type="button" class="sh-line" @click="replay">{{ hint('walk again — enter', 'walk again') }}</button>
        <button type="button" class="sh-line" @click="exitToIdle">{{ hint('leave — esc', 'leave') }}</button>
      </div>
    </div>

    <!-- Touch: thin outlined zones along the bottom edge, pointer-captured. -->
    <div v-if="phase === 'playing' || phase === 'paused'" class="sh-touch">
      <button
        v-for="z in touchZones"
        :key="z.kind"
        type="button"
        class="sh-zone"
        :class="`sh-zone-${z.kind}`"
        :aria-label="z.label"
        @pointerdown="onZoneDown($event, z.kind)"
        @pointerup="onZoneUp($event, z.kind)"
        @pointercancel="onZoneUp($event, z.kind)"
        @lostpointercapture="onZoneUp($event, z.kind)"
        @contextmenu.prevent
      >
        {{ z.glyph }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createWorld, stepWorld, demoInput, STEP } from './engine'
import { createRenderer } from './renderer'
import type { World, Input } from './types'

type Phase = 'idle' | 'playing' | 'paused' | 'won'
type Zone = 'left' | 'right' | 'crouch' | 'jump'

const MAX_STEPS = 4

const { navigationLocked } = useTheme()
const { isTouch, hint } = useInputMode()

const shellRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const phase = ref<Phase>('idle')

const touchZones: { kind: Zone; glyph: string; label: string }[] = [
  { kind: 'left', glyph: '◀', label: 'Run left' },
  { kind: 'right', glyph: '▶', label: 'Run right' },
  { kind: 'crouch', glyph: '▼', label: 'Crouch' },
  { kind: 'jump', glyph: '▲', label: 'Jump' },
]

let world: World = createWorld({ attract: true })
let renderer: ReturnType<typeof createRenderer> | null = null
let raf = 0
let last = 0
let acc = 0
let needsDraw = true
let cssW = 0
let cssH = 0
let dpr = 1
let ctx: CanvasRenderingContext2D | null = null
let reducedMotion = false
let coarsePointer = false
let resizeObserver: ResizeObserver | null = null

const keys = { left: false, right: false, jump: false, crouch: false }
const touches: Record<Zone, Set<number>> = { left: new Set(), right: new Set(), crouch: new Set(), jump: new Set() }

function resetInput() {
  keys.left = keys.right = keys.jump = keys.crouch = false
  for (const k of Object.keys(touches) as Zone[]) touches[k].clear()
}

function currentInput(): Input {
  return {
    left: keys.left || touches.left.size > 0,
    right: keys.right || touches.right.size > 0,
    jump: keys.jump || touches.jump.size > 0,
    crouch: keys.crouch || touches.crouch.size > 0,
  }
}

/** Height of the touch zones while they are on screen, so the frame fits above them. */
function bottomInset(): number {
  if (phase.value !== 'playing' && phase.value !== 'paused') return 0
  if (!coarsePointer && !isTouch.value) return 0
  return cssH <= 480 ? 52 : 64
}

function draw() {
  if (!ctx || !renderer || cssW <= 0 || cssH <= 0) return
  renderer.draw(ctx, world, cssW, cssH, dpr, { dim: phase.value === 'paused', allowFlash: !reducedMotion, bottomInset: bottomInset() })
  needsDraw = false
}

function simulate(dt: number, input: (w: World) => Input) {
  acc += Math.min(dt, 0.1)
  let n = 0
  while (acc >= STEP && n < MAX_STEPS) {
    stepWorld(world, input(world), STEP)
    acc -= STEP
    n += 1
  }
  if (n === MAX_STEPS) acc = 0
}

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  const dt = last === 0 ? STEP : Math.min(Math.max(0, (t - last) / 1000), 0.1)
  last = t
  if (phase.value === 'playing') {
    simulate(dt, currentInput)
    if (world.won) {
      phase.value = 'won'
      navigationLocked.value = false
      resetInput()
    }
    draw()
  } else if (phase.value === 'idle') {
    if (reducedMotion) {
      if (needsDraw) draw()
    } else {
      simulate(dt, demoInput)
      draw()
    }
  } else if (phase.value === 'won') {
    // Dawn holds; the figure breathes.
    simulate(dt, () => ({ left: false, right: false, jump: false, crouch: false }))
    draw()
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
  renderer?.invalidate()
  needsDraw = true
  if (phase.value !== 'idle' || reducedMotion) draw()
}

function blurActiveElement() {
  const el = document.activeElement as HTMLElement | null
  if (el && typeof el.blur === 'function') el.blur()
}

function startGame() {
  world = createWorld()
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
  world = createWorld({ attract: true })
  if (reducedMotion) world.intro = 0
  acc = 0
  resetInput()
  phase.value = 'idle'
  navigationLocked.value = false
  blurActiveElement()
  needsDraw = true
}

function isInteractiveTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('a,button,input,textarea,select') !== null
}

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return
  if ((e.code === 'Space' || e.code === 'Enter') && isInteractiveTarget(e.target)) return

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

  switch (e.code) {
    case 'ArrowLeft':
    case 'KeyA':
      keys.left = true
      e.preventDefault()
      break
    case 'ArrowRight':
    case 'KeyD':
      keys.right = true
      e.preventDefault()
      break
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      keys.jump = true
      e.preventDefault()
      break
    case 'ArrowDown':
    case 'KeyS':
      keys.crouch = true
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
      if (!e.repeat && phase.value === 'paused') {
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
      keys.left = false
      break
    case 'ArrowRight':
    case 'KeyD':
      keys.right = false
      break
    case 'ArrowUp':
    case 'KeyW':
    case 'Space':
      keys.jump = false
      break
    case 'ArrowDown':
    case 'KeyS':
      keys.crouch = false
      break
  }
}

function onZoneDown(e: PointerEvent, kind: Zone) {
  e.preventDefault()
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // no capture: the per-zone sets still release on pointerup
  }
  touches[kind].add(e.pointerId)
}

function onZoneUp(e: PointerEvent, kind: Zone) {
  touches[kind].delete(e.pointerId)
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
  coarsePointer = window.matchMedia('(pointer: coarse)').matches
  renderer = createRenderer()
  world = createWorld({ attract: true })
  if (reducedMotion) world.intro = 0
  resize()
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
.sh-shell {
  position: relative;
  height: 100dvh;
  overflow: hidden;
  background: var(--shore-ground);
  color: var(--shore-ink);
  font-family: var(--font-person);
}

.sh-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: pan-x pan-y;
}

/* Idle profile: unboxed, upper left, over the sky. */
.sh-profile {
  position: absolute;
  top: max(8vh, env(safe-area-inset-top));
  left: max(6vw, env(safe-area-inset-left));
  max-width: min(420px, calc(100vw - 48px));
}

.sh-chapter {
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--shore-lamp);
  margin: 0 0 8px;
}

.sh-name {
  font-weight: 300;
  font-size: clamp(32px, 4vw, 56px);
  line-height: 1.05;
  letter-spacing: -0.01em;
  text-transform: lowercase;
  margin: 0 0 10px;
}

.sh-blurb {
  font-weight: 300;
  font-size: 15px;
  line-height: 1.5;
  margin: 2px 0;
}

.sh-socials {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 8px -10px 0;
}

.sh-socials :deep(svg),
.sh-socials :deep(img) {
  width: 22px;
  height: 22px;
  transition: none;
}
.sh-socials :deep(a) { min-width: 44px; min-height: 44px; margin: 0; }
.sh-socials :deep(svg:hover), .sh-socials :deep(img:hover) { transform: none; }

/* Machine text as a line: no box, an underline. */
.sh-line {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--shore-lamp);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--shore-lamp);
  line-height: 1;
  cursor: pointer;
}

.sh-start {
  margin-top: 10px;
}

.sh-line:focus-visible,
.sh-zone:focus-visible {
  outline: 2px solid var(--shore-lamp);
  outline-offset: 3px;
}

.sh-hint {
  font-family: var(--font-machine);
  font-size: 10px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--shore-moon);
  margin: 10px 0 0;
}

/* Pause: one line at the bottom. */
.sh-pauseline {
  position: absolute;
  left: 0;
  right: 0;
  bottom: max(56px, calc(40px + env(safe-area-inset-bottom)));
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 28px;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--shore-ink);
}

.sh-istouch .sh-pauseline {
  bottom: 84px;
}

/* Win: the name small in the sky, two lines beneath. */
.sh-win {
  position: absolute;
  top: max(10vh, env(safe-area-inset-top));
  left: max(6vw, env(safe-area-inset-left));
}

.sh-win-name {
  font-weight: 300;
  font-size: 18px;
  letter-spacing: 0.02em;
  text-transform: lowercase;
  color: var(--shore-ground);
  margin: 0 0 14px;
}

.sh-win .sh-line {
  color: var(--shore-ground);
  border-color: var(--shore-ground);
}

.sh-win-buttons {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
}

/* Touch zones: thin outlined strips along the bottom, coarse pointers only. */
.sh-touch {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: calc(64px + env(safe-area-inset-bottom));
  padding: 0 0 env(safe-area-inset-bottom);
  display: none;
  gap: 6px;
  padding-left: 6px;
  padding-right: 6px;
  box-sizing: border-box;
}

.sh-istouch .sh-touch {
  display: flex;
}

@media (pointer: coarse) {
  .sh-touch {
    display: flex;
  }
}

.sh-zone {
  flex: 1 1 0;
  margin: 6px 0;
  font-family: var(--font-machine);
  font-size: 14px;
  color: var(--shore-ink);
  background: transparent;
  border: 1px solid var(--shore-moon);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
}

.sh-zone-crouch {
  flex: 0.6 1 0;
}

.sh-zone-jump {
  flex: 1.4 1 0;
}

@media (max-width: 600px) {
  .sh-profile {
    top: max(36px, env(safe-area-inset-top));
    left: max(22px, env(safe-area-inset-left));
    max-width: calc(100vw - 44px);
  }
  .sh-name { font-size: 26px; margin-bottom: 6px; }
  .sh-blurb { font-size: 13px; }
  .sh-hint { display: none; }
}

@media (max-height: 480px) {
  .sh-hint { display: none; }
  .sh-profile { top: max(14px, env(safe-area-inset-top)); max-width: 200px; }
  .sh-chapter { margin-bottom: 3px; }
  .sh-name { font-size: 20px; margin-bottom: 3px; }
  .sh-blurb { font-size: 11px; line-height: 1.35; margin: 0; }
  .sh-socials { margin-top: 2px; }
  .sh-socials :deep(a) { min-width: 34px; min-height: 34px; }
  .sh-socials :deep(svg), .sh-socials :deep(img) { width: 18px; height: 18px; }
  .sh-start { margin-top: 2px; min-height: 32px; white-space: nowrap; }
  .sh-touch { height: 52px; }
  .sh-zone { margin: 4px 0; }
  .sh-istouch .sh-pauseline { bottom: 62px; }
}
</style>
