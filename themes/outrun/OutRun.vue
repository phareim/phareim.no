<template>
  <canvas ref="canvas" class="outrun-canvas" />
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quit" />
</template>

<script setup lang="ts">
/**
 * OUTRUN — the loop, input and sound around engine.ts (rules) and
 * renderer.ts (pictures). Phases: `attract` (autopilot behind the title),
 * `radio` (SELECT MUSIC, the road keeps rolling behind it), `play`
 * (countdown, the run, TIME UP or GOAL) and `over` (the landing shows the
 * result; the car cruises on).
 *
 * Keys: ← → / A D steer, ↑ / W / Space gas, ↓ / S brake, M radio, P or an
 * Esc tap pause, a 3 s Esc hold quits. Touch: the car accelerates by
 * itself, drag anywhere to steer (analog, relative to where the finger went
 * down), a second finger brakes, tap the radio readout to change track.
 */
import EscHold from '../base/EscHold.vue'
import {
  createGame, stepGame, autopilot, totalScore, stageDef, MAX_SPEED,
  type OutrunState, type OutrunEvent, type OutrunInput, type OutrunResult,
} from './engine'
import { createRenderer, type Message, type OutrunRenderer, type FrameUI } from './renderer'
import { createAudio, TRACK_NAMES, type OutrunAudio } from './audio'

const emit = defineEmits<{
  phase: [phase: 'attract' | 'radio' | 'play' | 'over']
  over: [result: OutrunResult]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)

const CYAN = '#2ff3ff'
const PINK = '#ff2fa0'
const GOLD = '#ffd23f'
const RADIO_TIME = 10

let renderer: OutrunRenderer | null = null
let audio: OutrunAudio | null = null
let state: OutrunState = attractGame()
let phase: 'attract' | 'radio' | 'play' | 'over' = 'attract'
let raf = 0
let last = 0
let messages: Message[] = []
let shake = 0
let flash = 0
let radioIndex = 0
let radioTimer = RADIO_TIME
let endT = 0
let ended = false
/** Seconds since GO, to nudge a keyboard player who has not found the gas. */
let sinceGo = -1
let reduced = false
let touchMode = false

const keys: Record<string, boolean> = {}
let steerId: number | null = null
let steerStartX = 0
let steerStartY = 0
let steerStartT = 0
let steerValue = 0
let brakeId: number | null = null

function seed() {
  return (Math.random() * 1e9) | 0
}

/** The attract loop starts past the start gantry, already at speed. */
function attractGame(): OutrunState {
  const g = createGame(seed(), { countdown: false })
  for (let t = 0; t < 4; t += 1 / 30) stepGame(g, 1 / 30, autopilot(g), true)
  return g
}

function setPhase(p: typeof phase) {
  phase = p
  emit('phase', p)
}

function say(text: string, color: string, life = 1.6, sub?: string, big = false) {
  // A big call (3, 2, 1, GO, TIME UP) replaces the last one; a repeat restarts.
  messages = messages.filter(m => m.text !== text && !(big && m.big))
  messages.push({ text, sub, color, t: 0, life, big })
  if (messages.length > 3) messages.shift()
}

// ------------------------------------------------------------- the loop

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer) return
  const now = nowMs / 1000
  const dt = Math.min(0.05, last ? now - last : 1 / 60)
  last = now
  if (paused.value) return

  if (phase === 'attract' || phase === 'radio') {
    stepGame(state, dt, autopilot(state), true)
    if (phase === 'radio') {
      radioTimer -= dt
      if (radioTimer <= 0) beginRun()
    }
  } else if (phase === 'play' || phase === 'over') {
    handleEvents(stepGame(state, dt, readInput(), false))
    tickRun(dt)
    audio?.updateEngine({
      rpm: state.rpm,
      throttle: state.throttle,
      speed: state.speed / MAX_SPEED,
      gear: state.gear,
      skid: state.skid,
      offroad: state.offroad,
      running: phase === 'play' || state.status === 'goal',
    })
  }

  for (const m of messages) m.t += dt
  messages = messages.filter(m => m.t < m.life)
  shake = Math.max(0, shake - dt * 2.6)
  flash = Math.max(0, flash - dt * 4)

  const ui: FrameUI = {
    now,
    dt,
    phase,
    reduced,
    touch: touchMode,
    braking: phase === 'play' && readInput().brake,
    messages,
    radioIndex,
    radioNames: TRACK_NAMES,
    radioTimer,
    shake,
    flash,
    paused: paused.value,
  }
  const t0 = performance.now()
  renderer.draw(state, ui)
  drawMs = drawMs * 0.9 + (performance.now() - t0) * 0.1
}

let drawMs = 0
/** Dev-only handle for headless checks: read the state, fast-forward on autopilot. */
function exposeDevHook() {
  if (!import.meta.dev) return
  ;(window as unknown as Record<string, unknown>).__outrun = {
    get state() { return state },
    get phase() { return phase },
    get drawMs() { return drawMs },
    jump(col: number, node: number) {
      state = createGame(seed(), { countdown: false, col, node })
      renderer?.resetCamera()
    },
    ff(seconds: number, drive = true) {
      for (let t = 0; t < seconds; t += 1 / 60) {
        handleEvents(stepGame(state, 1 / 60, drive ? autopilot(state) : readInput(), phase !== 'play'))
        tickRun(1 / 60)
        for (const m of messages) m.t += 1 / 60
        messages = messages.filter(m => m.t < m.life)
      }
      renderer?.resetCamera()
    },
  }
}

/** Run-level timers: the gas nudge after GO, and the hand-over after TIME UP or the goal. */
function tickRun(dt: number) {
  if (sinceGo >= 0 && phase === 'play') {
    sinceGo += dt
    if (sinceGo > 1.4) {
      if (!touchMode && state.speed < MAX_SPEED * 0.03) say('HOLD ↑ FOR GAS', PINK, 2.2)
      sinceGo = -1
    }
  }
  if (phase === 'play' && ended) {
    endT += dt
    const done = state.status === 'goal' ? endT > 5 : (endT > 1.2 && state.speed < MAX_SPEED * 0.02) || endT > 4
    if (done) finish(state.status === 'goal' ? 'goal' : 'timeup')
  }
}

function readInput(): OutrunInput {
  let steer = 0
  if (keys.ArrowLeft || keys.KeyA) steer -= 1
  if (keys.ArrowRight || keys.KeyD) steer += 1
  if (steerId !== null) steer += steerValue
  const brake = !!(keys.ArrowDown || keys.KeyS) || brakeId !== null
  // Touch drives with the throttle open; keys need ↑.
  const gas = touchMode ? !brake : !!(keys.ArrowUp || keys.KeyW || keys.Space)
  return { steer: Math.max(-1, Math.min(1, steer)), gas, brake }
}

function handleEvents(events: OutrunEvent[]) {
  for (const e of events) {
    switch (e.type) {
      case 'countdown':
        say(String(e.n), CYAN, 0.9, undefined, true)
        audio?.play('count')
        break
      case 'go':
        say('GO!', GOLD, 1.1, stageDef(state.col, state.node).name, true)
        audio?.play('go')
        sinceGo = 0
        break
      case 'crash':
        shake = e.kind === 'bump' ? 0.45 : 1
        if (e.kind !== 'bump') flash = 0.35
        audio?.play(e.kind)
        renderer?.sparksAtCar(e.kind === 'bump' ? 12 : 30)
        if (e.kind === 'tumble') say('WIPEOUT', PINK, 1.8)
        break
      case 'close':
        say('CLOSE +1000', GOLD, 1.1)
        audio?.play('close')
        break
      case 'fork':
        say(`${e.side < 0 ? '◀' : ''} ${stageDef(e.col, e.node).name} ${e.side > 0 ? '▶' : ''}`.trim(), CYAN, 1.8)
        break
      case 'checkpoint':
        say('CHECKPOINT', GOLD, 2.6, `EXTENDED PLAY +${e.extend}S · STAGE ${e.col + 1}`)
        audio?.play('checkpoint')
        flash = 0.25
        break
      case 'warn':
        audio?.play('warn')
        break
      case 'timeup':
        say('TIME UP', PINK, 3.5, undefined, true)
        audio?.play('timeup')
        audio?.fadeMusic(2.5)
        ended = true
        endT = 0
        break
      case 'goal':
        say('GOAL!', GOLD, 4.5, `TIME BONUS ${e.timeBonus}`, true)
        audio?.play('goal')
        flash = 0.4
        ended = true
        endT = 0
        break
      case 'shift':
        break
      case 'offroad':
        break
    }
  }
}

// ------------------------------------------------------------ game flow

function toRadio() {
  if (!audio) audio = createAudio()
  audio.start()
  radioTimer = RADIO_TIME
  if (phase !== 'attract' && phase !== 'over') return
  if (phase === 'over') {
    state = attractGame()
    renderer?.resetCamera()
  }
  messages = []
  setPhase('radio')
  audio.playTrack(radioIndex)
}

function beginRun() {
  if (phase !== 'radio') return
  try { localStorage.setItem('outrunRadio', String(radioIndex)) } catch { /* private mode */ }
  state = createGame(seed())
  renderer?.resetCamera()
  messages = []
  ended = false
  endT = 0
  sinceGo = -1
  paused.value = false
  setPhase('play')
}

function cycleRadio() {
  // Tracks, then silence, then round again.
  radioIndex = radioIndex >= TRACK_NAMES.length - 1 ? -1 : radioIndex + 1
  try { localStorage.setItem('outrunRadio', String(radioIndex)) } catch { /* private mode */ }
  if (radioIndex < 0) audio?.stopTrack()
  else audio?.playTrack(radioIndex)
  audio?.play('select')
}

function chooseRadio(i: number) {
  radioIndex = (i + TRACK_NAMES.length) % TRACK_NAMES.length
  audio?.playTrack(radioIndex)
  audio?.play('select')
}

function finish(reason: OutrunResult['reason']) {
  if (phase !== 'play') return
  setPhase('over')
  clearInput()
  if (reason !== 'goal') audio?.silenceEngine()
  audio?.fadeMusic(3)
  const route = state.route.map((n, c) => stageDef(c, n).name)
  emit('over', { score: totalScore(state), reason, route, stage: state.col + 1 })
}

function quit() {
  if (phase !== 'play') return
  paused.value = false
  audio?.suspend(false)
  finish('quit')
}

function escActive() {
  return phase === 'play'
}

function togglePause() {
  if (phase !== 'play') return
  paused.value = !paused.value
  audio?.suspend(paused.value)
  clearInput()
}

function clearInput() {
  for (const k of Object.keys(keys)) keys[k] = false
  steerId = null
  brakeId = null
  steerValue = 0
}

// ---------------------------------------------------------------- input

function isInteractive(el: EventTarget | null) {
  const e = el as HTMLElement | null
  return !!e?.closest?.('a, button, .theme-pager')
}

const GAME_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space', 'KeyA', 'KeyD', 'KeyW', 'KeyS'])

function onKeyDown(e: KeyboardEvent) {
  if (isInteractive(e.target)) return
  if (e.code === 'Escape') return
  if (e.key !== 'Unidentified') touchMode = false
  if (e.code === 'KeyP' && !e.repeat) {
    if (phase === 'play') {
      e.preventDefault()
      togglePause()
    }
    return
  }
  if (e.code === 'KeyM' && !e.repeat && (phase === 'play' || phase === 'radio')) {
    if (phase === 'radio') chooseRadio(radioIndex + 1)
    else cycleRadio()
    return
  }
  if (phase === 'radio') {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') chooseRadio(radioIndex - 1)
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') chooseRadio(radioIndex + 1)
    else if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) beginRun()
    if (GAME_KEYS.has(e.code) || e.code === 'Enter') e.preventDefault()
    return
  }
  if (e.code === 'Enter' && !e.repeat && (phase === 'attract' || phase === 'over')) {
    if (radioIndex < 0) radioIndex = 0
    toRadio()
    return
  }
  if (phase !== 'play') return
  keys[e.code] = true
  if (GAME_KEYS.has(e.code)) e.preventDefault()
}

function onKeyUp(e: KeyboardEvent) {
  keys[e.code] = false
}

function onPointerDown(e: PointerEvent) {
  if (isInteractive(e.target)) return
  if (e.pointerType !== 'mouse') touchMode = true
  if (phase === 'radio') {
    const i = renderer?.radioCardAt(e.clientX, e.clientY, TRACK_NAMES.length) ?? -1
    if (i >= 0) {
      if (i === radioIndex || e.pointerType !== 'mouse') {
        radioIndex = i
        beginRun()
      } else chooseRadio(i)
    }
    return
  }
  if (phase === 'play') {
    if (e.pointerType === 'mouse') return
    if (renderer?.radioHudHit(e.clientX, e.clientY)) {
      cycleRadio()
      return
    }
    if (steerId === null) {
      steerId = e.pointerId
      steerStartX = e.clientX
      steerValue = 0
    } else if (brakeId === null && e.pointerId !== steerId) {
      brakeId = e.pointerId
    }
    return
  }
  // Attract / over: remember the press so a tap starts; a swipe changes theme.
  steerId = e.pointerId
  steerStartX = e.clientX
  steerStartY = e.clientY
  steerStartT = performance.now()
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerId !== steerId || phase !== 'play') return
  const w = renderer?.width ?? window.innerWidth
  steerValue = Math.max(-1, Math.min(1, (e.clientX - steerStartX) / (w * 0.16)))
}

function onPointerUp(e: PointerEvent) {
  if (e.pointerId === brakeId) {
    brakeId = null
    return
  }
  if (e.pointerId !== steerId) return
  steerId = null
  steerValue = 0
  if (phase === 'attract' || phase === 'over') {
    const moved = Math.hypot(e.clientX - steerStartX, e.clientY - steerStartY)
    const quick = performance.now() - steerStartT < 450
    if (moved < 15 && quick) {
      if (radioIndex < 0) radioIndex = 0
      toRadio()
    }
  }
}

function onPointerCancel(e: PointerEvent) {
  if (e.pointerId === brakeId) brakeId = null
  if (e.pointerId === steerId) {
    steerId = null
    steerValue = 0
  }
}

function onVisibility() {
  if (document.hidden) {
    clearInput()
    if (phase === 'play' && !paused.value) togglePause()
    else audio?.suspend(true)
  } else if (!paused.value) {
    audio?.suspend(false)
  }
}

let resizeT: ReturnType<typeof setTimeout> | null = null
function resize() {
  const c = canvas.value
  if (!c || !renderer) return
  renderer.resize(c.clientWidth || window.innerWidth, c.clientHeight || window.innerHeight, window.devicePixelRatio || 1)
}
function onResize() {
  if (resizeT) clearTimeout(resizeT)
  resizeT = setTimeout(resize, 120)
}

onMounted(() => {
  reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
  touchMode = matchMedia('(hover: none) and (pointer: coarse)').matches
  try {
    const r = parseInt(localStorage.getItem('outrunRadio') ?? '0', 10)
    radioIndex = Number.isFinite(r) && r >= -1 && r < TRACK_NAMES.length ? r : 0
  } catch { /* private mode */ }
  if (canvas.value) {
    renderer = createRenderer(canvas.value)
    resize()
  }
  emit('phase', phase)
  exposeDevHook()
  raf = requestAnimationFrame(frame)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onResize)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', onVisibility)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  if (resizeT) clearTimeout(resizeT)
  audio?.dispose()
  audio = null
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('pointerdown', onPointerDown)
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
  window.removeEventListener('blur', clearInput)
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style>
.outrun-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
