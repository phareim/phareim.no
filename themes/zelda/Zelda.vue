<template>
  <canvas ref="canvas" class="zelda-canvas" />
  <EscHold :is-active="() => phase === 'play'" :paused="paused" :show-paused="false" @tap="togglePause" @hold="quit" />
  <!-- Touch deck. Portrait: a console band under the view (the renderer
    leaves it free). Landscape: buttons float bottom-right over the world.
    The floating stick starts anywhere on the left 60 % that isn't a button. -->
  <div v-if="touchUI && phase === 'play'" class="zelda-deck" :class="{ 'zelda-deck--band': band > 0 }" :style="band ? { height: band + 'px' } : undefined">
    <template v-if="!paused">
      <div v-if="band" class="zelda-stick-hint">DRAG<br>TO MOVE</div>
      <div class="zelda-deck-small">
        <button v-if="itemIcon" class="zelda-chip" @pointerdown.prevent.stop="cycle" @contextmenu.prevent>
          <span class="zelda-chip-label">SWAP</span>
        </button>
        <button class="zelda-chip" aria-label="Pause" @pointerdown.prevent.stop="togglePause" @contextmenu.prevent>II</button>
      </div>
      <div class="zelda-deck-btns">
        <button
          class="zelda-pad zelda-pad-b"
          :class="{ 'zelda-pad--off': !itemIcon }"
          @pointerdown.prevent.stop="pressB"
          @contextmenu.prevent
        >
          <img v-if="itemIcon" :src="itemIcon" alt="" class="zelda-pad-icon">
          <span class="zelda-pad-letter">B</span>
        </button>
        <button
          class="zelda-pad zelda-pad-a"
          @pointerdown.prevent.stop="pressA"
          @pointerup.prevent.stop="releaseA"
          @pointercancel="releaseA"
          @pointerleave="releaseA"
          @contextmenu.prevent
        ><span class="zelda-pad-letter">A</span></button>
      </div>
    </template>
    <div v-else class="zelda-deck-paused">
      <button class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="togglePause" @contextmenu.prevent>RESUME</button>
      <button class="zelda-pad zelda-pad-wide zelda-pad-quit" @pointerdown.prevent.stop="quit" @contextmenu.prevent>QUIT</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * NEON SHRINE — the shell: clock, input, touch deck, audio, saves and the
 * navigation lock. The game is `engine/` (pure), `world/` (data) and
 * `render/` (Canvas). Phases: attract (camera drifts over the overworld,
 * silent, never saved) → play → over (Escape hold: progress kept) or won.
 *
 * Keys: arrows / WASD move; Space / J / Z = A (sword, talk, lift, throw;
 * hold then release for a spin); K / X / Shift = B (item); Q / Tab swap
 * item; Enter = A in play; P or an Escape tap pause. Touch: floating stick
 * on the left, A / B buttons on the right, SWAP and pause chips.
 */
import EscHold from '../base/EscHold.vue'
import { createGame, stepGame, toSave } from './engine/index'
import { WORLD } from './world/index'
import { createRenderer, type FrameUI, type Renderer } from './render/renderer'
import { sprite } from './render/sheet'
import { createZeldaAudio, type SfxName, type ZeldaAudio } from './audio'
import { readLocalSave, writeLocalSave, clearLocalSave, readLocalBest, writeLocalBest } from './localSave'
import { NO_INPUT, type GameState, type GameEvent, type Input, type TrackId, type UseItem } from './types'

type Phase = 'attract' | 'play' | 'over' | 'won'

const emit = defineEmits<{
  phase: [phase: Phase]
  result: [result: { reason: 'quit' | 'won'; elapsed: number; best: number | null }]
}>()

const STICK_PX = 38
const TAP_PX = 10

const canvas = ref<HTMLCanvasElement | null>(null)
const paused = ref(false)
const phase = ref<Phase>('attract')
const touchUI = ref(false)
const band = ref(0)
const selected = ref<UseItem | null>(null)
const { navigationLocked } = useTheme()
const sound = useSound()
const profileSave = useGameSave('zelda')

let renderer: Renderer | null = null
let audio: ZeldaAudio | null = null
let state: GameState = createGame(WORLD, { demo: true })
let raf = 0
let lastT = 0
let hitStopMs = 0
let reducedMotion = false
let attractT = 0
let lowHpT = 0
let track: TrackId | null = null

const ui: FrameUI = {
  paused: false, reducedMotion: false, touch: false, stick: null, attract: true, cam: null, banner: null,
  keys: { a: 'SPACE', b: 'K', cycle: 'Q' },
}

const iconCache = new Map<string, string>()
const itemIcon = computed(() => {
  const s = selected.value
  if (!s) return ''
  const name = s === 'disc' ? 'item_disc' : 'item_bombbag'
  if (!import.meta.client) return ''
  let url = iconCache.get(name)
  if (!url) { url = sprite(name).toDataURL(); iconCache.set(name, url) }
  return url
})

// ---- input -------------------------------------------------------------------

const keys = new Set<string>()
let aHeldKey = false
let aHeldTouch = false
let aPress = false
let bPress = false
let cyclePress = false
let stick: { id: number; ox: number; oy: number; dx: number; dy: number } | null = null
let idleTap: { id: number; x: number; y: number } | null = null

const A_KEYS = new Set(['Space', 'KeyJ', 'KeyZ', 'Enter'])
const B_KEYS = new Set(['KeyK', 'KeyX', 'ShiftLeft', 'ShiftRight'])
const CYCLE_KEYS = new Set(['KeyQ', 'Tab', 'KeyC'])
const MOVE_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD', 'KeyW', 'KeyS'])

function readInput(): Input {
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
    autoFace: touchUI.value,
  }
  aPress = false
  bPress = false
  cyclePress = false
  return input
}

function clearInput() {
  keys.clear()
  aHeldKey = false
  aHeldTouch = false
  aPress = false
  bPress = false
  cyclePress = false
  stick = null
  idleTap = null
  ui.stick = null
}

function isInteractive(el: EventTarget | null) {
  return !!(el as HTMLElement | null)?.closest?.('a, button, .theme-pager, .radio-widget')
}

function canvasPoint(e: PointerEvent) {
  const r = canvas.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }
}

function onPointerDown(e: PointerEvent) {
  if (e.pointerType === 'touch' && !touchUI.value) { touchUI.value = true; resize() }
  if (isInteractive(e.target)) return
  const p = canvasPoint(e)
  if (phase.value !== 'play') { idleTap = { id: e.pointerId, x: p.x, y: p.y }; return }
  if (paused.value) return
  // Any tap moves a dialog on.
  if (state.mode === 'dialog') { aPress = true; return }
  if (e.pointerType === 'mouse') return
  if (!stick && p.x < p.w * 0.6) {
    stick = { id: e.pointerId, ox: p.x, oy: p.y, dx: 0, dy: 0 }
    ui.stick = { ox: p.x, oy: p.y, dx: 0, dy: 0 }
  } else if (p.x >= p.w * 0.6) {
    // A tap on the right half of the world is a sword press too.
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
  ui.stick = { ox: stick.ox, oy: stick.oy, dx, dy }
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
  if (stick?.id === e.pointerId) { stick = null; ui.stick = null }
}

function onPointerCancel(e: PointerEvent) {
  if (idleTap?.id === e.pointerId) idleTap = null
  if (stick?.id === e.pointerId) { stick = null; ui.stick = null }
}

function pressA() { if (phase.value === 'play' && !paused.value) { aPress = true; aHeldTouch = true } }
function releaseA() { aHeldTouch = false }
function pressB() { if (phase.value === 'play' && !paused.value) bPress = true }
function cycle() { if (phase.value === 'play' && !paused.value) cyclePress = true }

function onKeyDown(e: KeyboardEvent) {
  if (isInteractive(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
  if (phase.value !== 'play') {
    if (e.code === 'Enter' && !e.repeat) { e.preventDefault(); startRun(phase.value === 'won') }
    else if (e.code === 'KeyN' && !e.repeat) { e.preventDefault(); startRun(true) }
    return
  }
  if (e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) togglePause(); return }
  const game = MOVE_KEYS.has(e.code) || A_KEYS.has(e.code) || B_KEYS.has(e.code) || CYCLE_KEYS.has(e.code)
  if (!game) return
  e.preventDefault()
  if (paused.value) return
  if (MOVE_KEYS.has(e.code)) { keys.add(e.code); return }
  if (e.repeat) return
  if (A_KEYS.has(e.code)) { aPress = true; aHeldKey = true }
  else if (B_KEYS.has(e.code)) bPress = true
  else if (CYCLE_KEYS.has(e.code)) cyclePress = true
}

function onKeyUp(e: KeyboardEvent) {
  keys.delete(e.code)
  if (A_KEYS.has(e.code)) aHeldKey = false
}

// ---- phases --------------------------------------------------------------------

function setPhase(p: Phase) {
  phase.value = p
  navigationLocked.value = p === 'play'
  ui.attract = p !== 'play'
  emit('phase', p)
  resize()
}

/** Saves here and on the player's profile (the first save creates the player). */
function persist() {
  const save = toSave(state)
  if (!save) return
  save.savedAt = Date.now()
  writeLocalSave(save)
  profileSave.push({ data: save, savedAt: save.savedAt })
}

/** Drops the save here and, if this browser has a player, on the profile. */
function dropSave(extra: { best?: number, won?: boolean } = {}) {
  const had = readLocalSave() !== null
  const at = Date.now()
  clearLocalSave(at)
  if (extra.won || (had && profileSave.hasPlayer())) profileSave.push({ data: null, savedAt: at, ...extra })
}

function startRun(fresh: boolean) {
  if (fresh) dropSave()
  audio?.unlock()
  sound.unlock()
  const save = fresh ? null : readLocalSave()
  state = createGame(WORLD, { save, seed: Date.now() >>> 0 })
  clearInput()
  paused.value = false
  hitStopMs = 0
  track = null
  ui.banner = null
  selected.value = state.inv.selected
  setPhase('play')
  const area = state.area
  playTrack(trackFor(state))
  ui.banner = { text: area, t: 0 }
  lastT = 0
}

function trackFor(s: GameState): TrackId {
  const def = WORLD.maps[s.map.id]!
  if (def.areas) {
    const h = s.hero
    const a = def.areas.find(r => h.x >= r.x && h.x < r.x + r.w && h.y >= r.y && h.y < r.y + r.h)
    return a?.track ?? def.track
  }
  if (def.cell) {
    const cols = Math.ceil(def.rows[0]!.length / def.cell.w)
    const key = `${s.zoneIndex % cols},${Math.floor(s.zoneIndex / cols)}`
    return def.cells?.[key]?.track ?? def.track
  }
  return def.track
}

function playTrack(t: TrackId | null) {
  if (t === track) return
  track = t
  audio?.music(t)
}

function togglePause() {
  if (phase.value !== 'play') return
  paused.value = !paused.value
  clearInput()
  audio?.sfx('menu')
  audio?.pause(paused.value)
}

function quit() {
  if (phase.value !== 'play') return
  persist()
  paused.value = false
  audio?.pause(false)
  clearInput()
  playTrack(null)
  setPhase('over')
  emit('result', { reason: 'quit', elapsed: state.elapsed, best: readLocalBest() })
  backToAttract()
}

function finishWon() {
  dropSave({ best: state.elapsed, won: true })
  clearInput()
  playTrack('ending')
  const prev = readLocalBest()
  const best = prev === null || state.elapsed < prev ? state.elapsed : prev
  if (best !== prev) writeLocalBest(best)
  setPhase('won')
  emit('result', { reason: 'won', elapsed: state.elapsed, best })
}

function backToAttract() {
  state = createGame(WORLD, { demo: true })
  attractT = 0
}

// ---- events → sound, save, banner ----------------------------------------------

const SFX: Partial<Record<GameEvent['type'], SfxName>> = {
  swing: 'sword', spin: 'spin', charged: 'charge', clank: 'clank', hurt: 'hurt', shock: 'shock',
  cut: 'cut', shatter: 'shatter', lift: 'lift', throw: 'throw', unlock: 'unlock', gate: 'gate',
  plate: 'plate', crystal: 'crystal', push: 'push', bombPlace: 'bombPlace', boom: 'boom', disc: 'disc',
  discHit: 'discHit', fall: 'fall', reflect: 'reflect', warp: 'stairs', text: 'text', talk: 'select',
  error: 'error', cycle: 'select', died: 'die', bossPhase: 'bossRoar',
}

function handleEvents(events: GameEvent[]) {
  const a = audio
  let save = false
  for (const e of events) {
    const name = SFX[e.type]
    if (name) a?.sfx(name)
    switch (e.type) {
      case 'hit': a?.sfx(e.kind === 'king' || e.kind === 'knight' ? 'bossHit' : e.killed ? 'kill' : 'hit'); break
      case 'collect': a?.sfx(e.kind === 'heart' ? 'heart' : e.kind === 'key' ? 'key' : 'coin'); break
      case 'chest': a?.sfx('chest'); break
      case 'itemGet':
        a?.jingle(e.item === 'prism' ? 'fanfare' : e.item === 'heartPiece' || e.item === 'heartContainer' ? 'heartPiece' : 'item')
        save = true
        break
      case 'secret': a?.jingle('secret'); save = true; break
      case 'shoot': a?.sfx(e.kind === 'laser' ? 'laser' : 'pellet'); break
      case 'buy': if (!e.ok) a?.sfx('error'); break
      case 'bossDown': a?.sfx('bossDie'); a?.jingle('fanfare'); save = true; break
      case 'unlock': case 'gate': save = true; break
      case 'enter':
        save = true
        ui.banner = { text: e.area, t: 0 }
        playTrack(e.track)
        break
      case 'area':
        ui.banner = { text: e.name, t: 0 }
        playTrack(e.track)
        break
      case 'scroll': break
      case 'respawn': save = true; break
      case 'died': a?.jingle('gameOver'); break
      case 'hitStop': if (!reducedMotion) hitStopMs = Math.max(hitStopMs, e.ms); break
    }
  }
  if (save) persist()
}

// ---- loop -------------------------------------------------------------------------

const ATTRACT_PATH = [
  { x: 40, y: 11 }, { x: 50, y: 34 }, { x: 14, y: 30 }, { x: 57, y: 12 }, { x: 12, y: 8 },
]

function attractCam(dt: number) {
  if (!reducedMotion) attractT += dt
  const seg = 9
  const n = ATTRACT_PATH.length
  const i = Math.floor(attractT / seg) % n
  const f = (attractT % seg) / seg
  const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2
  const a = ATTRACT_PATH[i]!
  const b = ATTRACT_PATH[(i + 1) % n]!
  const v = renderer!.viewTiles()
  const map = WORLD.maps.overworld!
  const mw = map.rows[0]!.length
  const mh = map.rows.length
  const cx = a.x + (b.x - a.x) * e - v.w / 2
  const cy = a.y + (b.y - a.y) * e - v.h / 2
  ui.cam = { x: Math.max(0, Math.min(mw - v.w, cx)), y: Math.max(0, Math.min(mh - v.h, cy)) }
  state.zone = { x: ui.cam.x, y: ui.cam.y, w: v.w, h: v.h }
}

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer) return
  const dt = lastT ? Math.min((nowMs - lastT) / 1000, 0.1) : 0
  lastT = nowMs
  ui.paused = paused.value
  ui.reducedMotion = reducedMotion
  ui.touch = touchUI.value
  ui.keys = touchUI.value ? { a: 'A', b: 'B', cycle: 'SWAP' } : { a: 'SPACE', b: 'K', cycle: 'Q' }

  if (phase.value === 'play') {
    ui.cam = null
    if (paused.value) { renderer.draw(state, ui, 0); return }
    if (hitStopMs > 0) { hitStopMs -= dt * 1000; renderer.draw(state, ui, 0); return }
    const events = stepGame(WORLD, state, dt, readInput())
    renderer.onEvents(events)
    handleEvents(events)
    if (ui.banner) { ui.banner.t += dt; if (ui.banner.t > 2.2) ui.banner = null }
    if (state.inv.selected !== selected.value) selected.value = state.inv.selected
    if (state.hero.hp > 0 && state.hero.hp <= 2 && state.mode === 'play') {
      lowHpT -= dt
      if (lowHpT <= 0) { audio?.sfx('lowHp'); lowHpT = 1.2 }
    }
    renderer.draw(state, ui, dt)
    if (state.mode === 'won') finishWon()
    return
  }

  // Attract / over / won: the overworld drifts by behind the title.
  attractCam(dt)
  if (!reducedMotion) stepGame(WORLD, state, dt, NO_INPUT)
  renderer.draw(state, ui, reducedMotion ? 0 : dt)
}

function onVisibility() {
  if (document.hidden) {
    clearInput()
    // Phones kill background tabs: keep the play time up to now.
    if (phase.value === 'play') persist()
    if (phase.value === 'play' && !paused.value) togglePause()
  }
  lastT = 0
}

function resize() {
  if (!canvas.value || !renderer) return
  const w = canvas.value.clientWidth
  const h = canvas.value.clientHeight
  const portraitTouch = touchUI.value && phase.value === 'play' && h > w
  band.value = portraitTouch ? Math.round(Math.max(190, Math.min(290, h * 0.32))) : 0
  renderer.resize(w, h, Math.min(devicePixelRatio || 1, 3), band.value)
}

let observer: ResizeObserver | null = null
let muteStop: (() => void) | null = null

onMounted(() => {
  if (!canvas.value) return
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    touchUI.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch { touchUI.value = false }
  renderer = createRenderer(canvas.value, WORLD)
  audio = createZeldaAudio()
  muteStop = watch(sound.muted, (m: boolean) => audio?.setMuted(m), { immediate: true })
  resize()
  observer = new ResizeObserver(resize)
  observer.observe(canvas.value)
  window.addEventListener('resize', resize)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', clearInput)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pointerdown', onPointerDown)
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
  raf = requestAnimationFrame(frame)
  // Dev-only handle for the headless play-throughs in scripts/zelda-lab.
  if (import.meta.dev) (window as unknown as { __zelda: unknown }).__zelda = { get state() { return state }, get phase() { return phase.value } }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  muteStop?.()
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
  audio?.dispose()
  audio = null
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
  image-rendering: pixelated;
}

.zelda-deck {
  box-sizing: border-box;
  position: absolute;
  right: 0;
  bottom: 0;
  z-index: 5;
  pointer-events: none;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 0 14px calc(14px + env(safe-area-inset-bottom, 0px));
  font-family: var(--font-machine);
}

/* Portrait: a console band across the bottom. */
.zelda-deck--band {
  left: 0;
  justify-content: space-between;
  align-items: center;
  padding: 10px 18px calc(40px + env(safe-area-inset-bottom, 0px));
  background:
    linear-gradient(180deg, rgba(255, 47, 160, 0.55) 0, rgba(255, 47, 160, 0) 2px),
    repeating-linear-gradient(0deg, rgba(47, 243, 255, 0.04) 0 1px, transparent 1px 6px),
    #0e0720;
}

.zelda-stick-hint {
  align-self: center;
  width: 118px;
  height: 118px;
  border-radius: 50%;
  border: 1px dashed rgba(47, 243, 255, 0.28);
  display: grid;
  place-items: center;
  text-align: center;
  font-size: 10px;
  letter-spacing: 0.14em;
  line-height: 1.6;
  color: rgba(47, 243, 255, 0.4);
}

.zelda-deck-small {
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
}

.zelda-deck--band .zelda-deck-small {
  margin-left: auto;
  margin-right: 4px;
}

.zelda-chip {
  min-width: 48px;
  min-height: 40px;
  border-radius: 20px;
  background: rgba(11, 6, 22, 0.75);
  border: 1px solid rgba(185, 168, 217, 0.45);
  color: #b9a8d9;
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.1em;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
}

.zelda-deck-btns {
  position: relative;
  width: 168px;
  height: 142px;
  pointer-events: auto;
}

.zelda-pad {
  position: absolute;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-family: var(--font-machine);
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  background: rgba(11, 6, 22, 0.72);
}

.zelda-pad:active {
  filter: brightness(1.6);
  transform: scale(0.96);
}

.zelda-pad-a {
  right: 0;
  top: 0;
  width: 88px;
  height: 88px;
  border: 2px solid #ff2fa0;
  color: #ff2fa0;
  box-shadow: 0 0 18px rgba(255, 47, 160, 0.45), inset 0 0 12px rgba(255, 47, 160, 0.25);
}

.zelda-pad-b {
  left: 0;
  bottom: 0;
  width: 72px;
  height: 72px;
  border: 2px solid #2ff3ff;
  color: #2ff3ff;
  box-shadow: 0 0 14px rgba(47, 243, 255, 0.4), inset 0 0 10px rgba(47, 243, 255, 0.2);
}

.zelda-pad--off {
  opacity: 0.35;
}

.zelda-pad-letter {
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}

.zelda-pad-icon {
  position: absolute;
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  opacity: 0.9;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.zelda-pad-b .zelda-pad-letter {
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: 13px;
}

.zelda-deck-paused {
  display: flex;
  gap: 14px;
  margin: 0 auto;
  pointer-events: auto;
}

.zelda-pad-wide {
  position: static;
  border-radius: 10px;
  min-width: 118px;
  min-height: 54px;
  border: 1px solid #2ff3ff;
  color: #2ff3ff;
  font-size: 14px;
  letter-spacing: 0.12em;
}

.zelda-pad-quit {
  border-color: #ff2fa0;
  color: #ff2fa0;
}

/* Landscape touch: buttons over the world, bottom right, half see-through. */
.zelda-deck:not(.zelda-deck--band) .zelda-pad {
  background: rgba(11, 6, 22, 0.35);
}
</style>
