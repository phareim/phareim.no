<template>
  <!-- Night of the Dead Battery: own the page. The canvas is the game (the
    scene, the verb panel and the inventory are drawn on it); the title
    menu, the pause menu and the ending are pixel-font boxes over it. -->
  <div ref="shellRef" class="nb-shell" :class="{ 'nb-touch': isTouch, 'nb-playing': phase === 'playing' }">
    <canvas
      ref="canvasRef"
      class="nb-canvas"
      aria-label="Night of the Dead Battery"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="onPointerCancel"
      @pointerleave="onPointerLeave"
      @contextmenu.prevent
    />

    <div v-if="phase === 'title'" class="nb-menu nb-menu--title">
      <h1 class="nb-sr">Night of the Dead Battery</h1>
      <p class="nb-lede">Three friends. One dead battery. A house that doesn't want them to leave.</p>
      <div class="nb-buttons">
        <button v-if="saved" type="button" class="px-btn nb-btn nb-btn--main" @click="continueGame">
          CONTINUE · {{ savedLine }}
        </button>
        <button type="button" class="px-btn nb-btn" :class="{ 'nb-btn--main': !saved }" @click="newGame">
          {{ saved ? 'NEW GAME' : 'NEW GAME' }}{{ hint(' — ENTER', '') }}
        </button>
      </div>
      <p v-if="best" class="nb-dim">BEST ESCAPE {{ formatTime(best) }}</p>
    </div>

    <button v-if="phase === 'playing'" type="button" class="px-btn nb-menu-btn" aria-label="Menu" @click="pauseGame">❚❚</button>

    <div v-if="phase === 'paused'" class="nb-menu" role="dialog" aria-label="Paused">
      <div class="px-box nb-box">
        <p class="nb-head">PAUSED</p>
        <p class="nb-dim">{{ formatTime(playTime) }} · {{ solved }}/{{ SOLVE_COUNT }} PUZZLES</p>
        <button type="button" class="px-btn nb-btn nb-btn--main" @click="resumeGame">RESUME{{ hint(' — SPACE', '') }}</button>
        <button type="button" class="px-btn nb-btn" @click="toggleMute">{{ muted ? '♪ SOUND OFF' : '♪ SOUND ON' }}</button>
        <button type="button" class="px-btn nb-btn" @click="quitToTitle">SAVE AND QUIT</button>
        <p class="nb-keys">{{ hint('CLICK TO WALK · RIGHT-CLICK: DEFAULT VERB · G P U O L S C T Y: VERBS · 1 2 3: SWITCH · . SKIPS A LINE', 'TAP A VERB, THEN A THING · HOLD A THING: DEFAULT VERB · TAP A FACE TO SWITCH') }}</p>
      </div>
    </div>

    <div v-if="phase === 'end'" class="nb-menu" role="dialog" aria-label="The end">
      <div class="px-box nb-box">
        <p class="nb-head">THE END</p>
        <p class="nb-dim">BRUNHILDE STARTED. EVERYONE WENT HOME. MOSTLY.</p>
        <p class="nb-dim">{{ formatTime(endTime) }}<template v-if="newBest"> · NEW BEST!</template></p>
        <button type="button" class="px-btn nb-btn nb-btn--main" @click="toTitle">TO THE TITLE</button>
      </div>
    </div>

    <EscHold :is-active="escActive" :paused="phase === 'paused'" :show-paused="false" label="HOLD ESC: SAVE AND QUIT" @tap="escTap" @hold="quitToTitle" />
  </div>
</template>

<script setup lang="ts">
import EscHold from '../base/EscHold.vue'
import { useSound } from '~/composables/useSound'
import { useGameSave } from '~/composables/useGameSave'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { Game, parseState } from './engine/index'
import { CONTENT } from './content/index'
import { createRenderer } from './render/index'
import { drawTitle } from './render/title'
import { createBatteryAudio, type BatteryAudio } from './audio'
import {
  GAME_ID, SOLVE_COUNT, clearLocal, formatTime, readBest, readLocal, solvedCount, writeBest, writeLocal,
  type BatterySave,
} from './progress'
import type { GameEvent } from './types'

type Phase = 'title' | 'playing' | 'paused' | 'end'

const STEP = 1 / 60
const MAX_STEPS = 6
const LONG_PRESS_MS = 450
const PROFILE_EVERY_MS = 20_000

const { navigationLocked } = useTheme()
const { isTouch, hint } = useInputMode()
const sound = useSound()
const muted = computed(() => sound.muted.value)
const profileSave = useGameSave(GAME_ID)

const shellRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const phase = ref<Phase>('title')
const saved = ref<BatterySave | null>(null)
const best = ref<number | null>(null)
const playTime = ref(0)
const solved = ref(0)
const endTime = ref(0)
const newBest = ref(false)

const savedLine = computed(() => {
  const s = saved.value
  if (!s) return ''
  return `${solvedCount(s.state)}/${SOLVE_COUNT} · ${formatTime(s.state.time)}`
})

let game: Game | null = null
let stage: PixelStage | null = null
let renderer = createRenderer()
let audio: BatteryAudio | null = null
let raf = 0
let last = 0
let acc = 0
let titleT = 0
let resizeObserver: ResizeObserver | null = null
let lastProfilePush = 0
let pendingProfile = false
let press: { id: number; x: number; y: number; timer: ReturnType<typeof setTimeout> | null; long: boolean } | null = null

// ---- canvas coordinates ----

function toLogical(e: PointerEvent): [number, number] | null {
  const canvas = canvasRef.value
  if (!canvas || !stage) return null
  const r = canvas.getBoundingClientRect()
  const dpr = canvas.width / Math.max(1, r.width)
  const W = canvas.width
  const H = canvas.height
  const ox = Math.floor((W - stage.hw * stage.scale) / 2)
  const oy = Math.floor((H - stage.hh * stage.scale) / 2)
  return [((e.clientX - r.left) * dpr - ox) / stage.scale, ((e.clientY - r.top) * dpr - oy) / stage.scale]
}

function onPointerMove(e: PointerEvent) {
  if (phase.value !== 'playing' || !game) return
  if (e.pointerType !== 'mouse') return
  const p = toLogical(e)
  if (p) game.pointerMove(p[0], p[1])
}

function onPointerDown(e: PointerEvent) {
  if (phase.value === 'title') return
  if (phase.value !== 'playing' || !game) return
  ensureAudio()
  const p = toLogical(e)
  if (!p) return
  if (e.pointerType === 'mouse') {
    game.pointerDown(p[0], p[1], e.button === 2 ? 2 : 0)
    return
  }
  // Touch: a tap is a click; holding a thing does its default verb.
  if (press?.timer) clearTimeout(press.timer)
  const cur = { id: e.pointerId, x: p[0], y: p[1], timer: null as ReturnType<typeof setTimeout> | null, long: false }
  cur.timer = setTimeout(() => {
    cur.long = true
    cur.timer = null
    game?.pointerDown(cur.x, cur.y, 2)
  }, LONG_PRESS_MS)
  press = cur
  game.pointerMove(p[0], p[1])
}

function onPointerUp(e: PointerEvent) {
  if (!press || press.id !== e.pointerId) return
  const p = press
  press = null
  if (p.timer) clearTimeout(p.timer)
  if (!p.long && game && phase.value === 'playing') game.pointerDown(p.x, p.y, 0)
}

function onPointerCancel() {
  if (press?.timer) clearTimeout(press.timer)
  press = null
}

function onPointerLeave(e: PointerEvent) {
  if (e.pointerType === 'mouse') game?.pointerLeave()
}

// ---- keys ----

function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  const target = e.target as HTMLElement | null
  if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
  if (phase.value === 'title') {
    if (e.key === 'Enter') { e.preventDefault(); if (saved.value) continueGame(); else newGame() }
    return
  }
  if (phase.value === 'paused') {
    if (e.key === ' ' || e.key === 'p' || e.key === 'P') { e.preventDefault(); resumeGame() }
    return
  }
  if (phase.value !== 'playing' || !game) return
  if (e.key === ' ' || e.key === 'p' || e.key === 'P' || e.key === 'F5') { e.preventDefault(); pauseGame(); return }
  if (e.key === 'Escape') return
  if (e.key.length === 1 || e.key === 'Enter') {
    e.preventDefault()
    game.key(e.key)
  }
}

// ---- loop ----

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  const dt = last === 0 ? STEP : Math.min((t - last) / 1000, 0.1)
  last = t
  if (!stage) return
  if (phase.value === 'title') {
    titleT += dt
    drawTitle(stage, titleT)
    return
  }
  if (!game) return
  if (phase.value === 'playing') {
    acc += dt
    let n = 0
    while (acc >= STEP && n < MAX_STEPS) {
      game.update(STEP)
      acc -= STEP
      n++
    }
    if (n === MAX_STEPS) acc = 0
    onEvents(game.drain())
  }
  renderer.draw(stage, game, { cursor: !isTouch.value && phase.value === 'playing' })
}

function onEvents(events: GameEvent[]) {
  for (const e of events) {
    audio?.event(e)
    if (e.t === 'save') saveNow(false)
    if (e.t === 'end') finish()
  }
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) return
  const r = canvas.getBoundingClientRect()
  const w = Math.max(1, Math.round(r.width))
  const h = Math.max(1, Math.round(r.height))
  if (!stage) stage = createPixelStage(canvas, { bg: '#07040d' })
  const tall = h > w * 1.3
  stage.resize(w, h, window.devicePixelRatio || 1, 320, tall ? 400 : 200)
  const safe = parseFloat(getComputedStyle(shellRef.value ?? canvas).getPropertyValue('--nb-safe')) || 0
  game?.resize(stage.vw, stage.vh, Math.round(safe / stage.k))
}

// ---- saves ----

function saveNow(profileNow: boolean) {
  if (!game || game.ended || game.running) return
  const s = writeLocal(game.s)
  saved.value = s
  pendingProfile = true
  if (profileNow || Date.now() - lastProfilePush > PROFILE_EVERY_MS) pushProfile(s)
}

function pushProfile(s: BatterySave | null = saved.value) {
  if (!s || !pendingProfile) return
  pendingProfile = false
  lastProfilePush = Date.now()
  profileSave.push({ data: s, savedAt: s.savedAt })
}

async function pullProfile() {
  const r = await profileSave.pull()
  if (!r || r === 'offline') return
  if (r.best && (!best.value || r.best < best.value)) { best.value = r.best; writeBest(r.best) }
  const local = readLocal()
  if (r.data && r.savedAt > (local?.savedAt ?? 0)) {
    const raw = r.data as Partial<BatterySave>
    const st = parseState(raw.state, CONTENT)
    if (st && phase.value === 'title') {
      saved.value = writeLocal(st, r.savedAt)
    }
  }
}

// ---- phases ----

function ensureAudio() {
  if (!audio) audio = createBatteryAudio()
  audio.setMuted(sound.muted.value)
  audio.unlock()
}

function startGame(g: Game, fresh: boolean) {
  game = g
  // The dev server exposes the running game for the lab's play-throughs.
  if (import.meta.dev) (window as unknown as { __battery?: Game }).__battery = g
  renderer = createRenderer()
  acc = 0
  last = 0
  phase.value = 'playing'
  navigationLocked.value = true
  ensureAudio()
  audio?.title(false)
  resize()
  if (fresh) g.begin()
  else g.resume()
  ;(document.activeElement as HTMLElement | null)?.blur?.()
}

function newGame() {
  clearLocal()
  if (saved.value) profileSave.push({ data: null, savedAt: Date.now() })
  saved.value = null
  startGame(new Game(CONTENT), true)
}

function continueGame() {
  const s = saved.value
  const st = s ? parseState(s.state, CONTENT) : null
  if (!st) { newGame(); return }
  startGame(new Game(CONTENT, st), false)
}

function pauseGame() {
  if (phase.value !== 'playing' || !game) return
  playTime.value = game.s.time
  solved.value = solvedCount(game.s)
  phase.value = 'paused'
  audio?.suspend(true)
  saveNow(true)
}

function resumeGame() {
  if (phase.value !== 'paused') return
  phase.value = 'playing'
  last = 0
  acc = 0
  audio?.suspend(false)
}

function quitToTitle() {
  if (game && !game.ended) {
    // A script mid-way can't be saved; the last idle save stands.
    saveNow(true)
    pushProfile()
  }
  toTitle()
}

function toTitle() {
  game = null
  phase.value = 'title'
  navigationLocked.value = false
  audio?.suspend(false)
  audio?.title(true)
  saved.value = readLocal()
  best.value = readBest()
}

function finish() {
  if (!game) return
  const t = game.s.time
  endTime.value = t
  const prev = readBest()
  newBest.value = !prev || t < prev
  writeBest(t)
  best.value = readBest()
  clearLocal()
  saved.value = null
  profileSave.push({ data: null, savedAt: Date.now(), best: Math.round(t), won: true })
  // The credits keep playing behind the box.
  setTimeout(() => {
    if (phase.value === 'playing') { phase.value = 'end'; navigationLocked.value = false }
  }, 400)
}

function escActive() {
  return phase.value === 'playing' || phase.value === 'paused'
}

function escTap() {
  if (phase.value === 'playing') pauseGame()
  else if (phase.value === 'paused') resumeGame()
}

function toggleMute() {
  sound.toggleMute()
  audio?.setMuted(sound.muted.value)
}

function onVisibility() {
  if (document.hidden) {
    if (phase.value === 'playing') pauseGame()
    pushProfile()
  }
}

function onPageHide() {
  if (game && phase.value !== 'title') saveNow(true)
  pushProfile()
}

onMounted(() => {
  saved.value = readLocal()
  best.value = readBest()
  resize()
  resizeObserver = new ResizeObserver(() => resize())
  if (canvasRef.value) resizeObserver.observe(canvasRef.value)
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('pagehide', onPageHide)
  audio = createBatteryAudio()
  audio.holdRadio()
  raf = requestAnimationFrame(frame)
  void pullProfile()
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  resizeObserver?.disconnect()
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pagehide', onPageHide)
  if (game && phase.value !== 'title') saveNow(true)
  pushProfile()
  audio?.dispose()
  audio = null
  navigationLocked.value = false
})
</script>

<style scoped>
.nb-shell {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: #07040d;
  --nb-safe: var(--app-safe-bottom, 0px);
}
.nb-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: none;
  image-rendering: pixelated;
}
.nb-playing:not(.nb-touch) .nb-canvas { cursor: none; }
.nb-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
}
.nb-menu {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  font-family: var(--font-pixel);
  color: var(--battery-text);
  z-index: 20;
}
.nb-menu--title {
  justify-content: flex-end;
  padding-bottom: calc(40px + var(--app-safe-bottom, 0px));
  background: linear-gradient(to bottom, transparent 55%, rgba(7, 4, 13, 0.75));
}
.nb-lede {
  margin: 0;
  max-width: 34em;
  text-align: center;
  font-size: 16px;
  line-height: 24px;
  color: var(--battery-text-muted);
  text-shadow: 2px 2px 0 #07040d;
}
.nb-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
.nb-box {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
  padding: 20px 24px;
  max-width: min(92vw, 520px);
  --px-edge: #c7a6ff;
}
.nb-head {
  margin: 0;
  font-size: 24px;
  line-height: 32px;
  text-align: center;
  color: var(--battery-accent);
}
.nb-dim {
  margin: 0;
  font-size: 16px;
  line-height: 24px;
  text-align: center;
  color: var(--battery-text-muted);
  text-shadow: 2px 2px 0 #07040d;
}
.nb-keys {
  margin: 4px 0 0;
  font-size: 8px;
  line-height: 16px;
  text-align: center;
  color: var(--battery-text-subtle);
}
.nb-btn {
  font-size: 16px;
  line-height: 24px;
  padding: 8px 16px;
  --px-edge: #c7a6ff;
}
.nb-btn--main { --px-edge: #ffd23f; color: #ffd23f; }
.nb-menu-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
  font-size: 8px;
  line-height: 16px;
  padding: 2px 8px;
  opacity: 0.55;
  --px-edge: #7d6fa6;
}
.nb-menu-btn:hover,
.nb-menu-btn:focus-visible { opacity: 1; }
</style>
