<template>
  <canvas ref="canvas" class="portal-canvas" />
  <!-- Touch: the floating stick starts anywhere on the left 60 %; A sits bottom right. -->
  <div v-if="touchUI" class="portal-deck">
    <button
      class="portal-pad"
      tabindex="-1"
      aria-label="A: talk, read, use"
      @pointerdown.prevent.stop="pressA"
      @pointerup.prevent.stop="releaseA"
      @pointercancel="releaseA"
      @pointerleave="releaseA"
      @contextmenu.prevent
    ><span class="portal-pad-letter">A</span></button>
  </div>
</template>

<script setup lang="ts">
/**
 * THE PORTAL — the shell around Neon Shrine's engine, renderer and audio for
 * phareim.no's front door. Always in play: no title, no pause, no saves, no
 * sword. The world is `world/` (peaceful). Input is `../zelda/input.ts`.
 *
 * Leaving: an engine `exit` event writes sessionStorage `portal.return`
 * ({ map, entry: exit id }) and then launches the theme or opens the URL.
 * Coming back (back button, home chip, reload) starts at that exit's entry:
 * in front of the cabinet, outside the door.
 */
import { createGame, stepGame } from '../zelda/engine/index'
import { createRenderer, type FrameUI, type Renderer } from '../zelda/render/renderer'
import { createZeldaAudio, type SfxName, type ZeldaAudio } from '../zelda/audio'
import { createInput } from '../zelda/input'
import type { ExitTarget, GameEvent, GameState, TrackId, World } from '../zelda/types'
import { PORTAL_WORLD, worldStartingAt } from './world/index'

const emit = defineEmits<{
  /** The visitor walked for the first time (the page hint can go). */
  moved: []
}>()

const RETURN_KEY = 'portal.return'
/** A theme exit that has not navigated after this long (bad id) comes back to the world. */
const STUCK_S = 2.5

const canvas = ref<HTMLCanvasElement | null>(null)
const touchUI = ref(false)
const { navigationLocked, launch } = useTheme()
const sound = useSound()

let renderer: Renderer | null = null
let audio: ZeldaAudio | null = null
let world: World = PORTAL_WORLD
let state: GameState | null = null
let raf = 0
let lastT = 0
let reducedMotion = false
let moved = false
let unlocked = false
let track: TrackId | null = null
/** Seconds spent in mode 'exit' without leaving (only for theme exits; a URL exit waits for the browser). */
let stuckT = 0
let leavingUrl = false

const ui: FrameUI = {
  paused: false, confirmReset: false, reducedMotion: false, touch: false, stick: null, attract: false, cam: null, banner: null,
  keys: { a: 'SPACE', b: 'K', cycle: 'Q' },
}

const input = createInput({
  canvas: () => canvas.value,
  touch: () => touchUI.value,
  onTouch: () => { touchUI.value = true },
  idle: () => state === null,
  paused: () => false,
  dialog: () => state?.mode === 'dialog',
  // No items to swap here: Tab keeps its job and reaches the page's link index.
  onKey: e => e.code === 'Tab',
})

function pressA() { input.pressA() }
function releaseA() { input.releaseA() }

// ---- where to start -------------------------------------------------------------

function readReturn(): World | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as { map?: unknown; entry?: unknown } | null
    return r && typeof r === 'object' ? worldStartingAt(r.map, r.entry) : null
  } catch { return null }
}

function writeReturn(map: string, entry: string) {
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ map, entry })) } catch { /* private mode: start at the plaza next time */ }
}

/** A fresh game at the last exit used, or at the plaza's start. */
function begin() {
  world = readReturn() ?? PORTAL_WORLD
  state = createGame(world, { seed: Date.now() >>> 0 })
  input.clear()
  stuckT = 0
  leavingUrl = false
  ui.banner = null
  playTrack(world.maps[state.map.id]!.track)
}

// ---- audio ---------------------------------------------------------------------------

function playTrack(t: TrackId | null) {
  if (t === track) return
  track = t
  if (unlocked) audio?.music(t)
}

/** Browsers keep audio asleep until a key or tap; the first one wakes it and starts the music. */
function onFirstGesture() {
  if (unlocked) return
  unlocked = true
  audio?.unlock()
  sound.unlock()
  audio?.music(track)
  window.removeEventListener('keydown', onFirstGesture, true)
  window.removeEventListener('pointerdown', onFirstGesture, true)
}

// ---- events -----------------------------------------------------------------------------

const SFX: Partial<Record<GameEvent['type'], SfxName>> = {
  warp: 'stairs', text: 'text', talk: 'select', error: 'error',
}

function handleEvents(events: GameEvent[]) {
  for (const e of events) {
    const name = SFX[e.type]
    if (name) audio?.sfx(name)
    switch (e.type) {
      case 'enter':
        ui.banner = { text: e.area, t: 0 }
        playTrack(e.track)
        break
      case 'area':
        ui.banner = { text: e.name, t: 0 }
        playTrack(e.track)
        break
      case 'exit':
        leave(e.id, e.to)
        return
    }
  }
}

/** The engine has faded out through an exit: remember where, then go. */
function leave(id: string, to: ExitTarget) {
  if (!state) return
  writeReturn(state.map.id, id)
  input.clear()
  if ('home' in to) begin() // already home: step back out in front of it
  else if ('theme' in to) launch(to.theme)
  else { leavingUrl = true; window.location.assign(to.url) }
}

// ---- loop -------------------------------------------------------------------------------

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer || !state) return
  const dt = lastT ? Math.min((nowMs - lastT) / 1000, 0.1) : 0
  lastT = nowMs
  ui.reducedMotion = reducedMotion
  ui.touch = touchUI.value
  ui.keys = touchUI.value ? { a: 'A', b: 'B', cycle: 'SWAP' } : { a: 'SPACE', b: 'K', cycle: 'Q' }
  ui.stick = input.stick

  const inp = input.read()
  if (!moved && (inp.move.x !== 0 || inp.move.y !== 0)) { moved = true; emit('moved') }
  const events = stepGame(world, state, dt, inp)
  renderer.onEvents(events)
  handleEvents(events)
  if (ui.banner) { ui.banner.t += dt; if (ui.banner.t > 2.2) ui.banner = null }
  if (state.mode === 'exit' && !leavingUrl) {
    stuckT += dt
    if (stuckT > STUCK_S) begin()
  }
  renderer.draw(state, ui, dt)
}

function onVisibility() {
  if (document.hidden) input.clear()
  if (unlocked) audio?.pause(document.hidden)
  lastT = 0
}

/** Back from a URL exit through the browser's page cache: the world is still dark, so step back out. */
function onPageShow(e: PageTransitionEvent) {
  if (e.persisted && state?.mode === 'exit') begin()
  lastT = 0
}

function resize() {
  if (!canvas.value || !renderer) return
  renderer.resize(canvas.value.clientWidth, canvas.value.clientHeight, Math.min(devicePixelRatio || 1, 3), 0)
}

let observer: ResizeObserver | null = null
let muteStop: (() => void) | null = null

onMounted(() => {
  if (!canvas.value) return
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    touchUI.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch { touchUI.value = false }
  // The portal owns the arrows and swipes: they walk the hero.
  navigationLocked.value = true
  renderer = createRenderer(canvas.value, PORTAL_WORLD)
  audio = createZeldaAudio()
  muteStop = watch(sound.muted, (m: boolean) => audio?.setMuted(m), { immediate: true })
  begin()
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(canvas.value)
  window.addEventListener('resize', resize)
  input.attach()
  window.addEventListener('keydown', onFirstGesture, true)
  window.addEventListener('pointerdown', onFirstGesture, true)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pageshow', onPageShow)
  raf = requestAnimationFrame(frame)
  // Dev-only handle for headless checks, like Neon Shrine's __zelda.
  if (import.meta.dev) (window as unknown as { __portal: unknown }).__portal = { get state() { return state }, get world() { return world } }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  muteStop?.()
  window.removeEventListener('resize', resize)
  input.detach()
  window.removeEventListener('keydown', onFirstGesture, true)
  window.removeEventListener('pointerdown', onFirstGesture, true)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pageshow', onPageShow)
  audio?.dispose()
  audio = null
  renderer = null
  navigationLocked.value = false
})
</script>

<style>
.portal-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: #0b0616;
  touch-action: none;
  image-rendering: pixelated;
}

.portal-deck {
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 5;
  padding: 0 18px calc(22px + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}

.portal-pad {
  pointer-events: auto;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  background: rgba(11, 6, 22, 0.4);
  border: 2px solid #ff2fa0;
  color: #ff2fa0;
  box-shadow: 0 0 18px rgba(255, 47, 160, 0.45), inset 0 0 12px rgba(255, 47, 160, 0.25);
  font-family: var(--font-machine);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.portal-pad:active {
  filter: brightness(1.6);
  transform: scale(0.96);
}

.portal-pad-letter {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
</style>
