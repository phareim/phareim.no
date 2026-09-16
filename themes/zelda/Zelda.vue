<template>
  <canvas ref="canvas" class="zelda-canvas" />
  <EscHold :is-active="() => phase === 'play'" :paused="paused" @tap="togglePause" @hold="quit" />
</template>

<script setup lang="ts">
/**
 * NEON SHRINE — loop, input, phases and audio for the top-down adventure.
 * The simulation is `engine.ts` (pure), the world `world.ts` (data), the
 * picture `renderer.ts` (Canvas 2D). This file owns the clock, the
 * pointers, the save file and the navigation lock, following OutRun.vue.
 *
 * Phases: `attract` (autopilot demo, silent, never saved) → `play` → `over`
 * (Escape hold: progress kept, no automatic respawn) or `won`.
 *
 * Keys: arrows / WASD move, Space / J sword, E / K interact, P or an Escape
 * tap pause, Enter start, N new game. Touch: the first finger on the left
 * 60 % of the canvas becomes a floating stick (direction = offset from where
 * it landed); any tap on the right 40 % swings, a hold there interacts.
 */

import EscHold from '../base/EscHold.vue'
import { createGame, stepGame, autopilot, toSave, parseSave } from './engine'
import { WORLD } from './world'
import { createRenderer } from './renderer'
import { SAVE_KEY, BEST_KEY, type GameState, type GameEvent, type Input, type Renderer, type FrameUI } from './types'

type Phase = 'attract' | 'play' | 'over' | 'won'
type Style = 'zelda' | 'zeldaDungeon' | 'zeldaBoss'

const emit = defineEmits<{
  phase: [phase: Phase]
  result: [result: { reason: 'quit' | 'won'; elapsed: number; best: number | null }]
}>()

const STICK_PX = 40 // finger offset that means full speed
const STICK_ZONE = 0.6 // left share of the canvas that owns the stick
const HOLD_MS = 350 // a right-side hold this long interacts instead of swinging
const TAP_PX = 10 // idle taps that move less than this start the game

const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)
const phase = ref<Phase>('attract')
const { navigationLocked } = useTheme()
const sound = useSound()

let renderer: Renderer | null = null
let state: GameState = createGame(WORLD, { demo: true })
let raf = 0
let lastT = 0
let hitStopMs = 0
let reducedMotion = false
let attractDrawn = false
let music: Style | null = null

const ui: FrameUI = { banner: null, paused: false, reducedMotion: false, alpha: 1, stick: null, hint: '' }

// ---- input ------------------------------------------------------------------

const keys = new Set<string>()
let attackPending = false
let interactPending = false
let stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null
let hold: { id: number; t: number; done: boolean } | null = null
let idleTap: { id: number; x: number; y: number } | null = null

function readInput(): Input {
  let x = 0
  let y = 0
  if (keys.has('ArrowLeft') || keys.has('KeyA')) x -= 1
  if (keys.has('ArrowRight') || keys.has('KeyD')) x += 1
  if (keys.has('ArrowUp') || keys.has('KeyW')) y -= 1
  if (keys.has('ArrowDown') || keys.has('KeyS')) y += 1
  if (stick) { x = stick.dx / STICK_PX; y = stick.dy / STICK_PX }
  const len = Math.hypot(x, y)
  if (len > 1) { x /= len; y /= len }
  // A long right-side hold turns into one interact instead of a second swing.
  if (hold && !hold.done && performance.now() - hold.t > HOLD_MS) {
    hold.done = true
    interactPending = true
  }
  const input: Input = { move: { x, y }, attack: attackPending, interact: interactPending, autoFace: stick !== null || hold !== null }
  attackPending = false
  interactPending = false
  return input
}

function clearInput() {
  keys.clear()
  attackPending = false
  interactPending = false
  stick = null
  hold = null
  idleTap = null
  ui.stick = null
}

function canvasPoint(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }
}

function onPointerDown(e: PointerEvent) {
  if (isInteractive(e.target)) return
  const p = canvasPoint(e)
  if (phase.value !== 'play') {
    idleTap = { id: e.pointerId, x: p.x, y: p.y }
    return
  }
  if (paused.value) return
  if (e.pointerType !== 'mouse' && p.x < p.w * STICK_ZONE) {
    if (!stick) stick = { id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 }
    return
  }
  attackPending = true
  if (e.pointerType !== 'mouse' && !hold) hold = { id: e.pointerId, t: performance.now(), done: false }
}

function onPointerMove(e: PointerEvent) {
  if (!stick || stick.id !== e.pointerId) return
  const p = canvasPoint(e)
  stick.dx = p.x - stick.ox
  stick.dy = p.y - stick.oy
  const len = Math.hypot(stick.dx, stick.dy)
  if (len > STICK_PX) { stick.dx *= STICK_PX / len; stick.dy *= STICK_PX / len }
  ui.stick = { originX: stick.ox, originY: stick.oy, dx: stick.dx, dy: stick.dy }
}

function onPointerUp(e: PointerEvent) {
  if (idleTap && idleTap.id === e.pointerId) {
    const p = canvasPoint(e)
    const moved = Math.hypot(p.x - idleTap.x, p.y - idleTap.y)
    idleTap = null
    if (moved < TAP_PX && !isInteractive(e.target)) {
      if (phase.value === 'attract' || phase.value === 'over') startRun(false)
      else if (phase.value === 'won') startRun(true)
    }
    return
  }
  releasePointer(e.pointerId)
}

function onPointerCancel(e: PointerEvent) {
  if (idleTap?.id === e.pointerId) idleTap = null
  releasePointer(e.pointerId)
}

function releasePointer(id: number) {
  if (stick?.id === id) { stick = null; ui.stick = null }
  if (hold?.id === id) hold = null
}

function isInteractive(el: EventTarget | null) {
  return !!(el as HTMLElement | null)?.closest?.('a, button, .theme-pager')
}

const GAME_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'KeyE', 'KeyJ', 'KeyK'])

function onKeyDown(e: KeyboardEvent) {
  if (isInteractive(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
  if (e.code === 'Enter' && !e.repeat) {
    if (phase.value === 'attract' || phase.value === 'over') { e.preventDefault(); startRun(false) }
    else if (phase.value === 'won') { e.preventDefault(); startRun(true) }
    return
  }
  if (e.code === 'KeyN' && !e.repeat && phase.value !== 'play') { e.preventDefault(); startRun(true); return }
  if (phase.value !== 'play') return
  if (e.code === 'KeyP') { if (!e.repeat) togglePause(); e.preventDefault(); return }
  if (!GAME_KEYS.has(e.code)) return
  e.preventDefault()
  if (e.repeat || paused.value) return
  if (e.code === 'Space' || e.code === 'KeyJ') attackPending = true
  else if (e.code === 'KeyE' || e.code === 'KeyK') interactPending = true
  else keys.add(e.code)
}

function onKeyUp(e: KeyboardEvent) { keys.delete(e.code) }

// ---- phases -----------------------------------------------------------------

function setPhase(p: Phase) {
  phase.value = p
  navigationLocked.value = p === 'play'
  emit('phase', p)
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    return raw ? parseSave(JSON.parse(raw)) : null
  } catch { return null }
}

function persist() {
  const save = toSave(state)
  if (!save) return
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)) } catch { /* private mode */ }
}

/** Enter or continue a run. `fresh` discards the save first (NEW GAME / after a win). */
function startRun(fresh: boolean) {
  if (fresh) { try { localStorage.removeItem(SAVE_KEY) } catch { /* ignore */ } }
  const save = fresh ? null : loadSave()
  state = createGame(WORLD, { save, seed: (Date.now() >>> 0) })
  clearInput()
  paused.value = false
  hitStopMs = 0
  setPhase('play')
  sound.unlock()
  music = null
  enterRoom(state.room.id)
  lastT = 0
}

function enterRoom(id: string) {
  const room = WORLD.rooms[id]
  if (!room) return
  ui.banner = { text: room.name, t: 1.6 }
  const style: Style = room.area === 'boss' ? 'zeldaBoss' : room.area === 'dungeon' ? 'zeldaDungeon' : 'zelda'
  if (style !== music) { music = style; sound.music.start(style) }
}

function togglePause() {
  if (phase.value !== 'play') return
  paused.value = !paused.value
  clearInput()
  if (paused.value) sound.music.stop(false)
  else if (music) sound.music.start(music)
}

function quit() {
  if (phase.value !== 'play') return
  persist()
  paused.value = false
  clearInput()
  sound.music.stop()
  music = null
  setPhase('over')
  emit('result', { reason: 'quit', elapsed: state.elapsed, best: readBest() })
}

function readBest(): number | null {
  try {
    const v = parseFloat(localStorage.getItem(BEST_KEY) || '')
    return Number.isFinite(v) && v > 0 ? v : null
  } catch { return null }
}

function finishWon() {
  persist()
  clearInput()
  sound.music.stop()
  music = null
  const prev = readBest()
  const best = prev === null || state.elapsed < prev ? state.elapsed : prev
  if (best !== prev) { try { localStorage.setItem(BEST_KEY, String(best)) } catch { /* ignore */ } }
  setPhase('won')
  emit('result', { reason: 'won', elapsed: state.elapsed, best })
}

// ---- events → sound + save -------------------------------------------------

function handleEvents(events: GameEvent[]) {
  const s = sound.sfx
  for (const e of events) {
    switch (e.type) {
      case 'swing': s.laser(); break
      case 'swordHit': s.hit(); break
      case 'swordClank': s.wall(); break
      case 'playerHit': s.lifeLost(); break
      case 'playerDied': s.death(); break
      case 'respawn': s.shield(); persist(); break
      case 'enemyDied': s.explosion(); break
      case 'potSmash': s.brickBreak(); break
      case 'grassCut': s.brick(); break
      case 'pickup': s.powerup(); break
      case 'chestOpened': s.extraLife(); persist(); break
      case 'reward': if (e.reward.kind !== 'relic') s.extraLife(); persist(); break
      case 'doorUnlocked': case 'doorOpened': s.checkpoint(); persist(); break
      case 'roomEnter': enterRoom(e.room); persist(); break
      case 'bossPhase': s.levelup(); break
      case 'bossDefeated': s.levelClear(); persist(); break
      case 'won': s.win(); break
      case 'shoot': s.enemyShoot(); break
      case 'hitStop': if (!reducedMotion) hitStopMs = Math.max(hitStopMs, e.ms); break
    }
  }
}

// ---- loop -------------------------------------------------------------------

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer) return
  const dt = lastT ? Math.min((nowMs - lastT) / 1000, 0.1) : 0
  lastT = nowMs
  ui.paused = paused.value
  ui.reducedMotion = reducedMotion

  if (phase.value === 'play') {
    ui.hint = ''
    if (paused.value) { renderer.draw(state, ui, 0); return }
    if (hitStopMs > 0) { hitStopMs -= dt * 1000; renderer.draw(state, ui, dt); return }
    const events = stepGame(WORLD, state, dt, readInput())
    renderer.onEvents(events)
    handleEvents(events)
    tickBanner(dt)
    renderer.draw(state, ui, dt)
    if (state.phase === 'won') finishWon()
    return
  }

  // Attract, over and won all show the demo world behind the panel.
  ui.hint = ''
  ui.banner = null
  if (reducedMotion) {
    if (attractDrawn) return
    attractDrawn = true
    renderer.draw(state, ui, 0)
    return
  }
  if (phase.value === 'attract') {
    const events = stepGame(WORLD, state, dt, autopilot(WORLD, state))
    renderer.onEvents(events)
  }
  renderer.draw(state, ui, dt)
}

function tickBanner(dt: number) {
  if (!ui.banner) return
  ui.banner.t -= dt
  if (ui.banner.t <= 0) ui.banner = null
}

function onVisibility() {
  if (document.hidden) {
    clearInput()
    if (phase.value === 'play' && !paused.value) togglePause()
  }
  lastT = 0
}

function resize() {
  if (!canvas.value || !renderer) return
  renderer.resize(canvas.value.clientWidth, canvas.value.clientHeight, Math.min(devicePixelRatio || 1, 2))
  attractDrawn = false
}

let observer: ResizeObserver | null = null

onMounted(() => {
  if (!canvas.value) return
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  renderer = createRenderer(canvas.value, WORLD)
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(canvas.value)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', onVisibility)
  // On window, like OutRun: the title/result panels sit above the canvas.
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  window.removeEventListener('resize', resize)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('blur', clearInput)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  if (phase.value === 'play') persist()
  sound.music.stop()
  navigationLocked.value = false
})
</script>

<style>
.zelda-canvas {
  display: block;
  width: 100%;
  height: 100%;
  background: #0b0616;
  touch-action: none;
}
</style>
