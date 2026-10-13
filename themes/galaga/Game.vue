<template>
  <canvas ref="canvas" class="voyagers-canvas" />
  <EscHold :is-active="escActive" :paused="paused" @tap="togglePause" @hold="quitToGameOver" />
</template>

<script setup lang="ts">
/**
 * Rex & Nova: Space Voyagers I, the page side of a run: the canvas, the
 * clock, the input, the sounds and the debug hook. The simulation is
 * `engine/` (pure, one `step` a tick), the words are `story/`, the picture
 * is `render/`. `Landing.vue` loads this file as its own chunk and owns the
 * title and the game-over screen; this component owns everything between.
 *
 * The clock: real time is collected and spent in whole ticks of 1/60 s, so a
 * 120 Hz screen runs the same game and a long frame costs at most five ticks
 * (the rest is dropped, not caught up). Pause is simply not stepping.
 */
import { safeBottom } from '~/themes/base/safeBottom'
import EscHold from '../base/EscHold.vue'
import { createGalagaAudio, soundFor } from './audio'
import type { GalagaAudio } from './audio'
import { SECTORS } from './engine/balance'
import { createWorld, makeInput, step } from './engine/index'
import type { Input, World } from './engine/index'
import { rand } from './engine/rng'
import type { PickupId, PilotId } from './story/cues'
import { createDirector, listen } from './story/director'
import type { Director, Monitor } from './story/director'
import { createRenderer } from './render/index'
import type { Renderer } from './render/index'

/** How far the run got, for the game-over screen. */
export interface RunReport {
  score: number
  voyage: number
  sector: number
  sectorName: string
  wave: number
  stage: string
  friends: number
  /** CSS pixels per pixel of the frame the run was drawn in, for the panel that goes over it. */
  px: number
}

const props = defineProps<{ pilot: PilotId }>()
const emit = defineEmits<{
  started: []
  score: [score: number]
  over: [report: RunReport]
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)
const radio = useRadio()

const STEP_MS = 1000 / 60
/** A long frame spends at most this many ticks; what is left of it is dropped. */
const MAX_STEPS = 5
/** The ship flies this many field pixels above the finger. */
const TOUCH_ABOVE = 42

let renderer: Renderer | null = null
let world: World | null = null
let director: Director | null = null
let monitor: Monitor | null = null
let audio: GalagaAudio | null = null
const input: Input = makeInput()
const keys = new Set<string>()
let duetPressed = false
let touchId = -1
let touchX = 0
let touchY = 0
let raf = 0
let last = 0
let acc = 0
let running = false
let reduced = false
let motionQuery: MediaQueryList | null = null
/** Ticks since GAME OVER: the radio and the effects run on after the world has stopped. */
let after = 0
let lastScore = 0
let bestBefore = 0
let bestSaid = false
let lastLine = 0
let wasSpeaking = false
let lastKill = -99
let lastBossHit = -99
let nextSeed = 0
/** The debug hook: the autopilot flies, or the clock is held and stepped by hand. */
let pilotFn: ((w: World) => Input) | null = null
let held = false
/** The lab's switch: the engine's boxes drawn over the field. */
let boxes = false

function readBest(): number {
  try {
    return parseInt(localStorage.getItem('galagaHighScore') ?? localStorage.getItem('hackerHighScore') ?? '0', 10) || 0
  } catch {
    return 0
  }
}

/**
 * Lay the frame out for the screen as it is now. `keep`: a run is under way and its field keeps
 * its height, so the frame is laid out round that field (a smaller scale if need be).
 */
function measure(keep = false): void {
  const c = canvas.value
  if (!c || !renderer) return
  const widget = document.querySelector('.radio-widget')?.getBoundingClientRect()
  renderer.resize(c.clientWidth, c.clientHeight, Math.min(4, window.devicePixelRatio || 1), {
    safeBottom: safeBottom(),
    widgetLeft: widget ? widget.left : 0,
    widgetBottom: widget ? widget.bottom : 0,
  }, keep && world ? world.h : 0)
}

/** The window changed. A phone turned mid-run (wide became tall or the other way) also pauses: the hands have moved. */
let wasWide = false
function onResize(): void {
  const wide = window.innerWidth > window.innerHeight
  const turned = wide !== wasWide
  wasWide = wide
  measure(world !== null)
  if (turned && running && !paused.value) togglePause()
}

/** Begin a run. The field takes the height the screen gives it now and keeps it. */
function start(pilot: PilotId = props.pilot): void {
  if (!renderer) return
  wasWide = window.innerWidth > window.innerHeight
  measure()
  const seed = nextSeed || ((Date.now() ^ (Math.random() * 0x7FFFFFFF)) >>> 0)
  nextSeed = 0
  world = createWorld({ seed, height: renderer.layout.field.h, pilot })
  const w = world
  if (!director) director = createDirector({ random: () => rand(world!.talkRng) })
  director.resetRun()
  monitor = director.monitor
  if (!director.cue('briefing', w.tick)) director.cue('retry', w.tick)
  renderer.reset(w)
  keys.clear()
  duetPressed = false
  touchId = -1
  after = 0
  lastScore = 0
  bestBefore = readBest()
  bestSaid = false
  wasSpeaking = false
  lastKill = lastBossHit = -99
  paused.value = false
  acc = 0
  running = true
  // Sound starts on the gesture that begins the run; the site's radio is the music.
  try {
    if (!audio) audio = createGalagaAudio()
    audio.start()
  } catch {
    audio = null
  }
  radio.ensurePlaying()
  radio.setIntensity(0, false)
  emit('started')
  emit('score', 0)
}

function report(w: World): RunReport {
  return {
    score: w.score, voyage: w.voyage, sector: w.sector, sectorName: SECTORS[w.sector - 1]?.name ?? '',
    wave: w.wave, stage: w.stage, friends: w.friends.length,
    px: renderer ? renderer.layout.scale / renderer.ratio : 1,
  }
}

function onGameOver(w: World): void {
  running = false
  director?.cue('gameover', w.tick)
  emit('score', w.score)
  emit('over', report(w))
}

function readInput(w: World): Input {
  if (pilotFn) {
    const auto = pilotFn(w)
    if (duetPressed) { auto.duet = true; duetPressed = false }
    return auto
  }
  input.dx = (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) - (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0)
  input.dy = (keys.has('ArrowDown') || keys.has('KeyS') ? 1 : 0) - (keys.has('ArrowUp') || keys.has('KeyW') ? 1 : 0)
  input.hasTarget = touchId >= 0
  if (input.hasTarget && renderer) {
    const p = renderer.toField(touchX, touchY)
    input.tx = p.x
    input.ty = p.y - TOUCH_ABOVE
  }
  input.fire = keys.has('Space') || touchId >= 0
  input.duet = duetPressed
  duetPressed = false
  return input
}

/** The music follows the run: quiet on a card, the full band from wave 3, the boss lift. */
function setMusic(w: World): void {
  if (w.stage === 'boss') radio.setIntensity(3, true)
  else if (w.stage === 'wave') radio.setIntensity(w.wave >= 3 ? 2 : 1, false)
  else if (w.stage === 'bonus') radio.setIntensity(2, false)
  else radio.setIntensity(0, false)
}

function tick(): void {
  const w = world
  if (!w || !director || !renderer) return
  if (w.over) {
    // The world has stopped; the last line and the last pop play out.
    step(w, input)
    after++
    monitor = director.step(w.tick + after)
    renderer.tick(w, monitor)
    return
  }
  step(w, readInput(w))
  monitor = listen(director, w.events, w.tick)
  for (let i = 0; i < w.events.length; i++) {
    const e = w.events[i]!
    const s = soundFor(e.type, e.kind, e.n)
    if (s === 'kill') { if (w.tick - lastKill < 3) continue; lastKill = w.tick } else if (s === 'bossHit') { if (w.tick - lastBossHit < 6) continue; lastBossHit = w.tick }
    if (s) audio?.play(s)
    if (e.type === 'card' || e.type === 'wave' || e.type === 'bossIn' || e.type === 'bossDown') setMusic(w)
    if (e.type === 'ending') director.cue('ending', w.tick)
  }
  // The radio keys up with each new line and lets go after the last.
  if (monitor.speaking && monitor.line !== lastLine) {
    lastLine = monitor.line
    audio?.play(monitor.cutsIn ? 'cutIn' : 'radioOpen')
  } else if (!monitor.speaking && wasSpeaking) audio?.play('radioClose')
  wasSpeaking = monitor.speaking
  if (w.score !== lastScore) {
    lastScore = w.score
    emit('score', w.score)
    if (!bestSaid && bestBefore > 0 && w.score > bestBefore) { bestSaid = true; director.cue('best', w.tick) }
  }
  renderer.tick(w, monitor)
  if (w.over) onGameOver(w)
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame)
  const dt = Math.min(250, now - last)
  last = now
  if (world && !paused.value && !held) {
    acc += dt
    let n = 0
    while (acc >= STEP_MS && n < MAX_STEPS) { tick(); acc -= STEP_MS; n++ }
    if (n === MAX_STEPS) acc = 0
  }
  draw()
}

function draw(): void {
  if (world && monitor && renderer) renderer.draw(world, monitor, { reduced, idle: !running, boxes })
}

// ── Escape: a tap pauses, a 3 s hold quits (themes/base/EscHold.vue) ─────

function escActive(): boolean {
  return running
}

function togglePause(): void {
  if (!running) return
  paused.value = !paused.value
  keys.clear()
  touchId = -1
  last = performance.now()
  acc = 0
  audio?.suspend(paused.value)
  radio.suspend(paused.value)
}

/** A 3 s Escape hold ends the run where it stands: the same GAME OVER as losing. */
function quitToGameOver(): void {
  const w = world
  if (!running || !w) return
  paused.value = false
  keys.clear()
  audio?.suspend(false)
  radio.suspend(false)
  director?.hush(w.tick)
  w.over = true
  w.stage = 'over'
  audio?.play('death')
  onGameOver(w)
}

// ── Input ────────────────────────────────────────────────────────────────

const FLY = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space'])

function onKeyDown(e: KeyboardEvent): void {
  // Escape belongs to EscHold; M to the site's radio.
  if (e.code === 'Escape' || !running) return
  audio?.start()
  if (e.code === 'KeyP') {
    if (!e.repeat) { e.preventDefault(); togglePause() }
    return
  }
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    if (!e.repeat) duetPressed = true
    return
  }
  if (FLY.has(e.code)) {
    keys.add(e.code)
    e.preventDefault()
  }
}

function onKeyUp(e: KeyboardEvent): void {
  keys.delete(e.code)
}

function isInteractive(el: EventTarget | null): boolean {
  return !!(el as HTMLElement | null)?.closest?.('a, button, input, .radio-widget')
}

function onTouchStart(e: TouchEvent): void {
  if (!running || paused.value || isInteractive(e.target)) return
  audio?.start()
  e.preventDefault()
  for (const t of Array.from(e.changedTouches)) {
    if (touchId < 0) {
      touchId = t.identifier
      touchX = t.clientX
      touchY = t.clientY
    } else if (t.identifier !== touchId) duetPressed = true // A second finger is DUET.
  }
}

function onTouchMove(e: TouchEvent): void {
  if (touchId < 0) return
  e.preventDefault()
  for (const t of Array.from(e.changedTouches)) {
    if (t.identifier === touchId) { touchX = t.clientX; touchY = t.clientY }
  }
}

function onTouchEnd(e: TouchEvent): void {
  for (const t of Array.from(e.changedTouches)) if (t.identifier === touchId) touchId = -1
}

function onVisibility(): void {
  if (document.hidden) {
    if (running && !paused.value) togglePause()
    else { audio?.suspend(true); radio.suspend(true) }
  } else if (!paused.value) {
    audio?.suspend(false)
    radio.suspend(false)
  }
}

function onMotion(): void {
  reduced = motionQuery?.matches === true
}

// ── `?theme=galaga&debug=galaga`: window.__voyagers, for pictures and checks ─

async function installDebug(): Promise<void> {
  // The engine's lab files are their own chunks: the game itself calls neither.
  const [dbg, ap, wld, cmb, enc, wav] = await Promise.all([
    import('./engine/debug'), import('./engine/autopilot'), import('./engine/world'), import('./engine/combat'),
    import('./engine/encounters'), import('./engine/waves'),
  ])
  const need = (): World => {
    if (!world) throw new Error('no run: start one first')
    return world
  }
  const hook = {
    /** What a check needs to know, as plain data. */
    state() {
      const w = world
      const L = renderer?.layout
      if (!w) return { running: false, layout: L }
      return {
        running, paused: paused.value, tick: w.tick, seed: w.seed, stage: w.stage, sector: w.sector, wave: w.wave,
        voyage: w.voyage, score: w.score, over: w.over, hull: w.player.hull, tows: w.player.tows, weapon: w.player.weapon,
        level: w.player.level, duetMeter: w.duetMeter, duet: w.duet, slow: w.slow,
        player: { x: w.player.x, y: w.player.y }, partner: w.partner.state, wing: w.wing.state,
        convoy: w.convoy.active ? w.convoy.cargo : null, friends: [...w.friends],
        boss: w.boss.active ? { id: w.boss.id, hp: w.boss.hp, phase: w.boss.phase, state: w.boss.state } : null,
        enemies: wld.countActive(w.enemies), bolts: wld.countActive(w.bolts), height: w.h,
        monitor: monitor ? { speaking: monitor.speaking, who: monitor.who, mood: monitor.mood, text: monitor.text, chars: monitor.chars } : null,
        layout: L, sprites: renderer?.sprites.report(),
      }
    },
    /** Jump to a sector's card. */
    sector(n: number) { dbg.jumpTo(need(), { sector: n, stage: 'card' }) },
    /** Jump to the sector's boss, or to the one named. */
    boss(id?: string) { dbg.jumpTo(need(), { stage: 'boss', boss: id as never }) },
    /** Jump to a wave of the sector (1 to 4), or the bonus run. */
    wave(n: number | 'bonus') { dbg.jumpTo(need(), n === 'bonus' ? { stage: 'bonus' } : { stage: 'wave', wave: n }) },
    /** Take a power-up, or set a weapon and level with `give('disc', 4)`. */
    give(id: string, level?: number) {
      const w = need()
      if (level && (id === 'blaster' || id === 'disc' || id === 'boombox')) dbg.arm(w, id, level)
      else wld.spawnPickup(w, id as PickupId, w.player.x, w.player.y)
    },
    /** Fill the needle and play it. */
    duet() { need().duetMeter = 1; duetPressed = true },
    /** Send a captor for the partner. */
    capture() {
      const w = need()
      const c = dbg.place(w, 'captor', 4, 0)
      wav.launchDive(w, c, w.enemies.indexOf(c))
    },
    /** The partner comes off the captor (or out of nowhere) and docks. */
    dock() {
      const w = need()
      if (w.partner.state !== 'hanging') { w.partner.state = 'hanging'; w.partner.y = w.player.y - 90 }
      for (const e of w.enemies) e.carrying = false
      cmb.freePartner(w, true)
    },
    /** Start the sector's event (the convoy or the rescue) now. */
    event() { const w = need(); if (!w.eventStarted) enc.startEvent(w) },
    /** The engine's autopilot flies; `autopilot(false)` hands the ship back. */
    autopilot(on = true) {
      if (!on) { pilotFn = null; return }
      const a = ap.createAutopilot()
      pilotFn = w => ap.autopilot(a, w)
    },
    /** Start again with this seed. */
    seed(n: number) { nextSeed = n >>> 0; start() },
    /** Hold the clock and step it by hand: a seed and a tick count name a frame exactly. */
    step(ticks = 1) {
      held = true
      for (let i = 0; i < ticks; i++) tick()
      draw()
    },
    /** Let the clock run again. */
    run() { held = false; last = performance.now(); acc = 0 },
    /** End the run as a 3 s Escape hold does; the ending card; hull and reduced motion for pictures. */
    quit() { quitToGameOver() },
    ending() { dbg.jumpTo(need(), { sector: 5, stage: 'ending' }) },
    hull(n: number) { need().player.hull = n },
    reduced(on = true) { reduced = on },
    /** Draw the engine's boxes (bodies, weak spots, where shots leave from) over the field. */
    boxes(on = true) { boxes = on },
    world: () => world,
  }
  ;(window as unknown as { __voyagers: typeof hook }).__voyagers = hook
}

onMounted(() => {
  const c = canvas.value
  if (!c) return
  renderer = createRenderer(c)
  motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  reduced = motionQuery.matches
  motionQuery.addEventListener('change', onMotion)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onResize)
  window.addEventListener('touchstart', onTouchStart, { passive: false })
  window.addEventListener('touchmove', onTouchMove, { passive: false })
  window.addEventListener('touchend', onTouchEnd)
  window.addEventListener('touchcancel', onTouchEnd)
  document.addEventListener('visibilitychange', onVisibility)
  if (location.search.includes('debug=galaga')) void installDebug()
  // Loaded by the gesture that asked for a run: begin it.
  start()
  last = performance.now()
  raf = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  if (raf) cancelAnimationFrame(raf)
  running = false
  // The one-shots' context only; the site's radio plays on across themes.
  audio?.dispose()
  audio = null
  radio.suspend(false)
  motionQuery?.removeEventListener('change', onMotion)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onResize)
  window.removeEventListener('touchstart', onTouchStart)
  window.removeEventListener('touchmove', onTouchMove)
  window.removeEventListener('touchend', onTouchEnd)
  window.removeEventListener('touchcancel', onTouchEnd)
  document.removeEventListener('visibilitychange', onVisibility)
  if (typeof window !== 'undefined') delete (window as unknown as { __voyagers?: unknown }).__voyagers
})

defineExpose({ start })
</script>

<style scoped>
/* The whole viewport: the frame puts the field and its console in it. */
.voyagers-canvas {
  position: absolute;
  inset: 0;
  width: 100vw;
  height: 100vh;
  height: var(--app-height, 100dvh);
  display: block;
  z-index: 1;
  image-rendering: pixelated;
  touch-action: none;
}
</style>
