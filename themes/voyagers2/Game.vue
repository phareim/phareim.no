<template>
  <div class="vg2-stage">
    <canvas
      ref="canvas"
      class="vg2-canvas"
      @touchstart.prevent="onTouchStart"
      @touchmove.prevent="onTouchMove"
      @touchend.prevent="onTouchEnd"
      @touchcancel.prevent="onTouchEnd"
    />
    <EscHold :is-active="escActive" :paused="paused" :show-paused="false" @tap="togglePause" @hold="quit" />
  </div>
</template>

<script setup lang="ts">
/**
 * Rex & Nova: Space Voyagers II, the page side of a sortie: the canvas, the
 * 60 Hz clock, keys and thumbs, the comms, the sounds and the debug hook.
 * The simulation is `engine/` (pure, one `step` a tick), the words are
 * `story/`, the picture `render/`. `Landing.vue` loads this file as its own
 * chunk and owns the title and the debrief.
 *
 * The clock: real time is spent in whole ticks of 1/60 s; a long frame
 * spends at most five and drops the rest. Pause is not stepping.
 *
 * Touch (DESIGN.md, "Controls"): a finger that lands on the left of the
 * view is the stick (its centre where it landed, it springs back); FIRE, MSL
 * and BURN are on the right; the left screen is the comms, the right screen
 * the next target, the AUTO lamp the autopilot, the seats panel the change
 * of seats. A finger is tracked by its identifier and nothing else: "no
 * finger" is null, never a sign (Safari hands out negative identifiers).
 */
import { safeBottom } from '~/themes/base/safeBottom'
import EscHold from '../base/EscHold.vue'
import { createVoyagerAudio } from './audio'
import type { Sfx, VoyagerAudio } from './audio'
import { GUN, SHIPS } from './engine/balance'
import { createBot, botInput, keyRamp } from './engine/bot'
import type { Bot, BotProfile } from './engine/bot'
import { MISSIONS } from './engine/missions'
import { rand } from './engine/rng'
import { live, shipAt } from './engine/ships'
import type { Input, PilotId, WingOrder } from './engine/types'
import { autoGoal, calzone, createWorld, makeInput, onTarget, step } from './engine/world'
import type { Voyage } from './engine/world'
import { createDirector } from './story/director'
import type { Director, Monitor } from './story/director'
import { createGlue, cuesFor } from './story/glue'
import type { Glue } from './story/glue'
import { createRenderer } from './render/index'
import type { SkyPiece } from './render/scene'
import type { Renderer } from './render/index'
import { menuRect } from './render/dash'
import { project } from './render/hud'
import type { HudState } from './render/hud'
import { inside } from './render/layout'

export interface SortieReport {
  id: string
  result: 'won' | 'lost'
  why: string
  score: number
  kills: number
  mission: string
  secs: number
  pilot: PilotId
}

const props = defineProps<{ pilot: PilotId; mission?: string; morale?: number }>()
const emit = defineEmits<{ started: []; over: [report: SortieReport] }>()

const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)
const radio = useRadio()

const MAX_STEPS = 5

/** Each act's sky: pictures far away in fixed directions (a missing one leaves the sky bare there). */
const SKIES: Record<number, SkyPiece[]> = {
  // The Parking Belt: the Earth below, a ringed planet of parked junk, the Franchise's billboard.
  1: [
    { src: '/galaga/bg-1-a.png', dir: [0.2, -0.45, -1] },
    { src: '/voyagers2/sky-planet.png', dir: [1, 0.35, -0.4] },
    { src: '/voyagers2/sky-moon.png', dir: [-0.8, 0.6, -0.5] },
    { src: '/voyagers2/sky-billboard.png', dir: [-1, 0.05, 0.4] },
    { src: '/voyagers2/sky-nebula.png', dir: [0.1, 0.25, 1] },
    { src: '/voyagers2/sky-galaxy.png', dir: [0.4, 0.9, 0.3] },
  ],
  // The Long Haul: the freight lane's buoys and mile markers, a truck stop, the dust of the road.
  2: [
    { src: '/voyagers2/sky-truckstop.png', dir: [0.9, 0.2, -0.6] },
    { src: '/voyagers2/sky-markers.png', dir: [-0.3, -0.1, -1] },
    { src: '/voyagers2/sky-buoy.png', dir: [-1, 0.3, 0.2] },
    { src: '/voyagers2/sky-billboard.png', dir: [0.5, 0.1, 1] },
    { src: '/voyagers2/sky-nebula.png', dir: [-0.4, 0.6, 0.8] },
    { src: '/voyagers2/sky-moon.png', dir: [0.3, -0.7, 0.6] },
  ],
  // The Delivery: the Hut's moon far off, the galaxy, the dark at the end of the Dial.
  3: [
    { src: '/voyagers2/sky-hut.png', dir: [-0.5, 0.15, -1] },
    { src: '/voyagers2/sky-galaxy.png', dir: [0.8, 0.5, -0.3] },
    { src: '/voyagers2/sky-nebula.png', dir: [0.2, -0.3, 1] },
    { src: '/voyagers2/sky-moon.png', dir: [-1, 0.6, 0.4] },
  ],
}
const STICK_R = 22

let renderer: Renderer | null = null
let world: Voyage | null = null
let director: Director | null = null
let monitor: Monitor | null = null
let glue: Glue = createGlue()
let audio: VoyagerAudio | null = null
const input: Input = makeInput()
const keys = new Set<string>()
/** Keys pressed since the last tick (a press is seen once even when it was let go before the tick). */
const pressed = new Set<string>()
const ui: HudState = { menu: false, stick: null, fire: false, burn: false, paused: false, reduced: false }
/** Touch: which finger does what. */
let stickId: number | null = null
let stickX = 0
let stickY = 0
let fireId: number | null = null
let burnId: number | null = null
let missileTap = false
let swapTap = false
let autoTap = false
let nextTap = false
let pickTap: number | null = null
let orderTap: WingOrder | null = null
let usingTouch = false
let raf = 0
let last = 0
let acc = 0
let frame = 0
let running = false
let after = 0
let startedAt = 0
let wasSpeaking = false
let lastLine = 0
let wasBurning = false
let lockSounded = 0
let nextSeed = 0
let invert = false
/** The debug hook: a bot flies, or the clock is held and stepped by hand. */
let bot: Bot | null = null
let held = false

const escActive = (): boolean => running

function measure(): void {
  const c = canvas.value
  if (!c || !renderer) return
  const widget = document.querySelector('.radio-widget')?.getBoundingClientRect()
  renderer.resize({
    cssW: window.innerWidth,
    cssH: window.innerHeight,
    dpr: Math.min(4, window.devicePixelRatio || 1),
    safeBottom: safeBottom(),
    widget: widget ? { x: widget.left, y: widget.top, w: widget.width, h: widget.height } : null,
    touch: usingTouch,
  })
}

function wake(): void {
  try {
    if (!audio) audio = createVoyagerAudio()
    audio.start()
  } catch {
    audio = null
  }
}

function sound(s: Sfx, gain = 1): void {
  try { audio?.play(s, gain) } catch { /* the sortie goes on without it */ }
}

/** Begin a sortie. */
function start(pilot: PilotId = props.pilot, missionId: string = props.mission ?? 'firstshift'): void {
  if (!renderer) return
  const def = MISSIONS[missionId] ?? MISSIONS.firstshift!
  const seed = nextSeed || ((Date.now() ^ (Math.random() * 0x7FFFFFFF)) >>> 0)
  nextSeed = 0
  world = createWorld({ seed, mission: def, pilot, morale: props.morale })
  const w = world
  glue = createGlue()
  director = createDirector({
    random: () => rand(w.talkRng),
    seats: () => ({ front: w.front, back: w.back, player: w.seat === 'front' ? w.front : w.back }),
  })
  director.resetRun()
  monitor = director.monitor
  renderer.setSky(SKIES[def.act] ?? SKIES[1]!, def.act - 1)
  keys.clear()
  pressed.clear()
  stickId = fireId = burnId = null
  ui.stick = null
  ui.menu = false
  after = 0
  frame = 0
  acc = 0
  paused.value = false
  ui.paused = false
  startedAt = performance.now()
  running = true
  wake()
  radio.ensurePlaying()
  radio.setIntensity(0, false)
  emit('started')
}

function report(w: Voyage): SortieReport {
  return {
    result: w.mission.result === 'won' ? 'won' : 'lost',
    why: w.mission.why,
    score: w.score,
    kills: w.mission.kills,
    id: w.def.id,
    mission: w.def.title,
    secs: Math.round(w.tick / 60),
    pilot: props.pilot,
  }
}

/** The input the person gives this tick, from keys and fingers. */
function readInput(w: Voyage): Input {
  if (bot) return botInput(bot, w)
  const k = (a: string, b?: string): boolean => keys.has(a) || (b !== undefined && keys.has(b))
  const p = (a: string, b?: string): boolean => pressed.has(a) || (b !== undefined && pressed.has(b))
  // Keys lean in like a stick (engine/bot.ts keyRamp): short taps aim finely.
  const ky = (k('ArrowUp', 'KeyW') ? 1 : 0) - (k('ArrowDown', 'KeyS') ? 1 : 0)
  const kx = (k('ArrowLeft', 'KeyA') ? 1 : 0) - (k('ArrowRight', 'KeyD') ? 1 : 0)
  const kr = (k('KeyQ') ? 1 : 0) - (k('KeyE') ? 1 : 0)
  if (stickId !== null && ui.stick) {
    const dx = ui.stick.kx / STICK_R, dy = ui.stick.ky / STICK_R
    // A little dead zone, then a curve: small moves aim finely.
    const curve = (v: number): number => { const a = Math.abs(v); return a < 0.08 ? 0 : Math.sign(v) * Math.min(1, ((a - 0.08) / 0.92) ** 1.5) }
    input.pitch = curve(-dy) * (invert ? -1 : 1)
    input.yaw = curve(-dx)
    input.roll = 0
  } else {
    input.pitch = keyRamp(input.pitch, ky * (invert ? -1 : 1))
    input.yaw = keyRamp(input.yaw, kx)
    input.roll = keyRamp(input.roll, kr)
  }
  input.burn = k('Tab', 'ShiftLeft') || k('ShiftRight') || burnId !== null
  input.brake = k('KeyZ')
  input.touch = usingTouch
  // Fire: Space held, the FIRE button, or (touch) the guns on the diamond.
  const auto = usingTouch && onTarget(w, GUN.assistTouch)
  input.fire = k('Space') || fireId !== null || auto
  input.missile = p('Enter', 'KeyF') || missileTap
  input.nextTarget = p('KeyT') || nextTap
  input.attacker = p('KeyR')
  input.swap = p('KeyX') || swapTap
  input.auto = p('KeyN') || autoTap
  input.pick = pickTap
  input.order = orderTap
  if (ui.menu || orderTap === null) {
    const digit = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'].findIndex(d => pressed.has(d))
    if (digit >= 0) {
      if (digit === 4) input.auto = autoGoal(w) === 'land'
      else input.order = (['attack', 'form', 'help', 'taunt'] as WingOrder[])[digit]!
      ui.menu = false
    }
  }
  missileTap = swapTap = autoTap = nextTap = false
  pickTap = null
  orderTap = null
  pressed.clear()
  return input
}

/** What the sounds and the music make of a tick. */
function listen(w: Voyage): void {
  const me = calzone(w)
  for (const e of w.events) {
    switch (e.type) {
      case 'shot':
        if (me && e.a === me.id) sound(e.kind === 'turret' ? 'turret' : 'gun', 0.8)
        else if (me) {
          const s = shipAt(w, e.a ?? -1)
          if (s && s.side === 'them' && Math.hypot(s.pos.x - me.pos.x, s.pos.y - me.pos.y, s.pos.z - me.pos.z) < 900) sound('enemyGun', 0.6)
        }
        break
      case 'shieldHit': if (me && e.a === me.id) sound('hitUs', 0.7); else sound('shieldHit', 0.5); break
      case 'armourHit': if (me && e.a === me.id) sound('hitUs'); else sound('armourHit', 0.6); break
      case 'kill': {
        const big = SHIPS[(e.kind ?? 'rat') as keyof typeof SHIPS]?.capital
        sound(big ? 'bigBoom' : 'boom')
        break
      }
      case 'lockOn': if (me && e.a === me.id) lockSounded = 1; break
      case 'locked': if (me && e.a === me.id) sound('locked'); break
      case 'missile': if (me && e.a === me.id) sound('missile'); break
      case 'missileIn': if (me && e.a === me.id) sound('klaxon'); break
      case 'decoy': if (me && e.a === me.id) sound('decoy'); break
      case 'auto': sound('auto'); break
      case 'swap': sound('swap'); break
    }
  }
  // The lock's rising tone, while it builds.
  if (me && me.lock > 0 && me.lock < 1 && lockSounded && frame % Math.max(4, Math.round(16 - me.lock * 12)) === 0) sound('lockOn')
  if (me && me.lock === 0) lockSounded = 0
  if (me) {
    if (me.burning !== wasBurning) { audio?.burn(me.burning); wasBurning = me.burning }
    audio?.engine(w.mission.stage === 'done' ? 0 : Math.min(1, me.speed / SHIPS.calzone.max))
  }
  // The music follows the fight.
  if (frame % 30 === 0) {
    const enemies = w.ships.filter(s => live(s) && s.side === 'them')
    const big = enemies.some(s => SHIPS[s.kind].capital || s.role === 'ace')
    if (w.mission.stage === 'auto' || w.mission.stage === 'launch' || w.mission.stage === 'land') radio.setIntensity(0, false)
    else if (big) radio.setIntensity(3, true)
    else if (enemies.length > 3) radio.setIntensity(2, false)
    else if (enemies.length > 0) radio.setIntensity(1, false)
    else radio.setIntensity(0, false)
  }
}

function tick(): void {
  const w = world
  if (!w || !director) return
  if (running) {
    const inp = readInput(w)
    step(w, inp)
    renderer?.events(w)
    for (const c of cuesFor(glue, w)) director.cue(c, w.tick)
    listen(w)
    if (w.mission.stage === 'done' && w.mission.t > 150) {
      running = false
      audio?.burn(false)
      audio?.engine(0)
      emit('over', report(w))
    }
  } else {
    after++
  }
  monitor = director.step(w.tick + after)
  if (monitor.speaking && (monitor.line !== lastLine || !wasSpeaking)) sound('cb', 0.8)
  wasSpeaking = monitor.speaking
  lastLine = monitor.line
}

function frameLoop(now: number): void {
  raf = requestAnimationFrame(frameLoop)
  const dt = Math.min(250, now - last)
  last = now
  if (!world || !renderer || !monitor) return
  if (!paused.value && !held) {
    acc += dt
    let n = 0
    while (acc >= 1000 / 60 && n < MAX_STEPS) {
      tick()
      acc -= 1000 / 60
      n++
      frame++
    }
    if (n === MAX_STEPS) acc = 0
  }
  ui.paused = paused.value
  renderer.draw(world, monitor, ui, frame)
}

// ---------------------------------------------------------------- keys

const GAME_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'])

function onKeyDown(e: KeyboardEvent): void {
  if (!running) return
  if (GAME_KEYS.has(e.code)) e.preventDefault()
  if (usingTouch) { usingTouch = false; measure() }
  wake()
  if (e.code === 'KeyP' && !e.repeat) { togglePause(); return }
  if (paused.value) return
  if (!e.repeat) pressed.add(e.code)
  keys.add(e.code)
  if (e.code === 'KeyC' && !e.repeat) ui.menu = !ui.menu
}

function onKeyUp(e: KeyboardEvent): void {
  keys.delete(e.code)
}

// ---------------------------------------------------------------- fingers

function logical(t: Touch): { x: number; y: number } {
  const c = canvas.value!
  const r = c.getBoundingClientRect()
  const l = renderer!.layout
  return { x: (t.clientX - r.left) / l.css, y: (t.clientY - r.top) / l.css }
}

function onTouchStart(e: TouchEvent): void {
  if (!renderer || !world) return
  if (!usingTouch) { usingTouch = true; measure() }
  wake()
  if (!running) return
  if (paused.value) { togglePause(); return }
  const l = renderer.layout
  for (const t of Array.from(e.changedTouches)) {
    const p = logical(t)
    // The pause chip in the view's top-left corner.
    if (p.x < 22 && p.y < 22) { togglePause(); continue }
    const b = l.buttons
    if (b && inside(b.fire, p.x, p.y)) { fireId = t.identifier; ui.fire = true; continue }
    if (b && inside(b.msl, p.x, p.y)) { missileTap = true; continue }
    if (b && inside(b.burn, p.x, p.y)) { burnId = t.identifier; ui.burn = true; continue }
    if (ui.menu && inside(l.left, p.x, p.y)) {
      for (let i = 0; i < 5; i++) {
        if (inside(menuRect(l, i), p.x, p.y + 0)) {
          if (i === 4) autoTap = autoGoal(world) === 'land'
          else orderTap = (['attack', 'form', 'help', 'taunt'] as WingOrder[])[i]!
        }
      }
      ui.menu = false
      continue
    }
    if (inside(l.left, p.x, p.y)) { ui.menu = true; continue }
    if (inside(l.right, p.x, p.y)) { nextTap = true; continue }
    if (inside(l.gauges.auto, p.x, p.y)) { autoTap = true; continue }
    if (inside(l.gauges.seats, p.x, p.y)) { swapTap = true; continue }
    if (ui.menu) { ui.menu = false; continue }
    // The stick: a finger that lands on the left of the screen (or anywhere, when no stick is held yet and it is not a tap on a ship).
    if (stickId === null && p.x < l.W * 0.62) {
      stickId = t.identifier
      stickX = p.x
      stickY = p.y
      ui.stick = { x: p.x, y: p.y, kx: 0, ky: 0 }
      continue
    }
    // Anything else on the view: pick the ship nearest the finger.
    if (p.y < l.view.h) pickTap = nearestShip(p.x, p.y)
  }
}

function nearestShip(x: number, y: number): number | null {
  const w = world, r = renderer
  if (!w || !r) return null
  let best: number | null = null, bestD = 18
  const pr = { x: 0, y: 0, ahead: false, dist: 0 }
  for (const s of w.ships) {
    if (!live(s) || s.side === 'us') continue
    project(r.layout, r.scene.camera, s.pos, pr)
    if (!pr.ahead) continue
    const d = Math.hypot(pr.x - x, pr.y - y)
    if (d < bestD) { bestD = d; best = s.id }
  }
  return best
}

function onTouchMove(e: TouchEvent): void {
  if (!renderer) return
  for (const t of Array.from(e.changedTouches)) {
    if (stickId !== null && t.identifier === stickId && ui.stick) {
      const p = logical(t)
      let dx = p.x - stickX, dy = p.y - stickY
      const d = Math.hypot(dx, dy)
      if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d }
      ui.stick.kx = Math.round(dx)
      ui.stick.ky = Math.round(dy)
    }
  }
}

function onTouchEnd(e: TouchEvent): void {
  for (const t of Array.from(e.changedTouches)) {
    if (stickId !== null && t.identifier === stickId) { stickId = null; ui.stick = null }
    if (fireId !== null && t.identifier === fireId) { fireId = null; ui.fire = false }
    if (burnId !== null && t.identifier === burnId) { burnId = null; ui.burn = false }
  }
}

// ---------------------------------------------------------------- pause, quit, the page

function togglePause(): void {
  if (!running) return
  paused.value = !paused.value
  radio.suspend(paused.value)
  if (paused.value) { audio?.burn(false); audio?.engine(0) }
  keys.clear()
}

function quit(): void {
  const w = world
  if (!w || !running) return
  paused.value = false
  w.mission.result = 'lost'
  w.mission.why = 'quit'
  w.mission.stage = 'done'
  running = false
  audio?.burn(false)
  audio?.engine(0)
  director?.hush(w.tick)
  emit('over', report(w))
}

function onVisibility(): void {
  if (document.hidden && running && !paused.value) togglePause()
}

let wasWide = false
function onResize(): void {
  const wide = window.innerWidth > window.innerHeight
  const turned = wide !== wasWide
  wasWide = wide
  measure()
  if (turned && running && !paused.value) togglePause()
}

/** The lab's hook: `?debug=voyagers2` gives `window.__voyagers2`. */
function installDebug(): void {
  if (typeof window === 'undefined') return
  const q = new URLSearchParams(window.location.search)
  if (q.get('debug') !== 'voyagers2') return
  ;(window as unknown as Record<string, unknown>).__voyagers2 = {
    world: () => world,
    state: () => {
      const w = world
      if (!w) return null
      const me = calzone(w)
      return {
        tick: w.tick, stage: w.mission.stage, nav: w.mission.nav, seat: w.seat, front: w.front, back: w.back,
        score: w.score, result: w.mission.result, ships: w.ships.length, enemies: w.ships.filter(s => s.side === 'them' && live(s)).length,
        me: me ? { core: me.core, shieldF: me.shieldF, shieldB: me.shieldB, speed: me.speed, target: me.target, lock: me.lock } : null,
        layout: renderer?.layout, monitor: monitor ? { speaking: monitor.speaking, who: monitor.who, text: monitor.text } : null,
        input: { pitch: input.pitch, yaw: input.yaw, fire: input.fire },
        stick: ui.stick,
      }
    },
    seed: (n: number) => { nextSeed = n; start() },
    bot: (p: BotProfile | null) => { bot = p && world ? createBot(p, world.tick + 1) : null },
    hold: () => { held = true },
    run: () => { held = false },
    step: (n = 1) => {
      for (let i = 0; i < n; i++) { tick(); frame++ }
      if (world && renderer && monitor) renderer.draw(world, monitor, ui, frame)
    },
    auto: () => { autoTap = true },
    swap: () => { swapTap = true },
    menu: (on: boolean) => { ui.menu = on },
    touch: (on: boolean) => { usingTouch = on; measure() },
    invert: (on: boolean) => { invert = on },
    /** End the sortie now, won or lost (the lab's way to the debrief; it posts nothing). */
    end: (won: boolean) => {
      const w = world
      if (!w || !running) return
      w.mission.result = won ? 'won' : 'lost'
      w.mission.why = won ? 'landed' : 'eject'
      w.mission.stage = 'done'
      running = false
      emit('over', report(w))
    },
  }
}

defineExpose({ start })

onMounted(() => {
  const c = canvas.value
  if (!c) return
  usingTouch = window.matchMedia?.('(hover: none) and (pointer: coarse)').matches ?? false
  renderer = createRenderer(c)
  wasWide = window.innerWidth > window.innerHeight
  measure()
  installDebug()
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('resize', onResize)
  document.addEventListener('visibilitychange', onVisibility)
  last = performance.now()
  raf = requestAnimationFrame(frameLoop)
  start()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('keyup', onKeyUp)
  window.removeEventListener('resize', onResize)
  document.removeEventListener('visibilitychange', onVisibility)
  audio?.dispose()
  renderer?.dispose()
  renderer = null
  if (typeof window !== 'undefined') delete (window as unknown as Record<string, unknown>).__voyagers2
})
</script>

<style scoped>
.vg2-stage {
  position: absolute;
  inset: 0;
  overflow: hidden;
  touch-action: none;
}

.vg2-canvas {
  position: absolute;
  left: 0;
  top: 0;
  display: block;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
}
</style>
