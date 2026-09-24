<template>
  <canvas ref="canvas" class="zelda-canvas" />
  <!-- Measures the notch and status-bar insets for the HUD (installed web app, landscape). -->
  <div ref="safeProbe" class="zelda-safe" aria-hidden="true" />
  <EscHold :is-active="() => phase === 'play'" :paused="paused" :show-paused="false" label="HOLD ESC FOR TOWN" @tap="togglePause" @hold="toTown" />
  <!-- Touch deck. The buttons float bottom-right over the world, which fills
    the whole screen, and step aside while a dialog box takes the bottom of
    the screen (any tap moves it on). The floating stick starts anywhere on
    the left 60 % that isn't a button. -->
  <div
    v-if="touchUI && phase === 'play' && (paused || !talking)"
    class="zelda-deck"
    :class="{ 'zelda-deck--paused': paused }"
  >
    <template v-if="!paused">
      <div class="zelda-deck-small">
        <button v-if="hasItem" class="zelda-chip" @pointerdown.prevent.stop="cycle" @contextmenu.prevent>
          <span class="zelda-chip-label">SWAP</span>
        </button>
        <button class="zelda-chip" aria-label="Pause" @pointerdown.prevent.stop="togglePause" @contextmenu.prevent>II</button>
      </div>
      <div class="zelda-deck-btns" :class="{ 'zelda-deck-btns--solo': !hasItem }">
        <button v-if="hasItem" class="zelda-pad zelda-pad-b" @pointerdown.prevent.stop="pressB" @contextmenu.prevent>
          <img v-if="itemIcon" :src="itemIcon" alt="" class="zelda-pad-icon">
          <span class="zelda-pad-letter">B</span>
        </button>
        <button
          class="zelda-pad zelda-pad-a"
          aria-label="A: talk, read, use"
          @pointerdown.prevent.stop="pressA"
          @pointerup.prevent.stop="releaseA"
          @pointercancel="releaseA"
          @pointerleave="releaseA"
          @contextmenu.prevent
        ><span class="zelda-pad-letter">A</span></button>
      </div>
    </template>
    <div v-else-if="confirmReset" class="zelda-deck-paused">
      <button class="zelda-pad zelda-pad-wide zelda-pad-quit" @pointerdown.prevent.stop="resetRun" @contextmenu.prevent>YES, START OVER</button>
      <button class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="cancelReset" @contextmenu.prevent>NO</button>
    </div>
    <div v-else class="zelda-deck-paused">
      <button class="zelda-pad zelda-pad-wide" @pointerdown.prevent.stop="togglePause" @contextmenu.prevent>RESUME</button>
      <button class="zelda-pad zelda-pad-wide zelda-pad-reset" @pointerdown.prevent.stop="askReset" @contextmenu.prevent>START OVER</button>
      <button class="zelda-pad zelda-pad-wide zelda-pad-quit" @pointerdown.prevent.stop="toTown" @contextmenu.prevent>TO TOWN</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * THE WORLD SHELL — phareim.no's front page and Neon Shrine in one: the
 * town, the coast, the shrine. Clock, input, touch deck, audio, saves and
 * the ways out. The game is `engine/` (pure), `world/` (data) and `render/`
 * (Canvas). Always in play: no title. Phases: play → won (the ending panel
 * is the page's, `portal/Landing.vue`).
 *
 * Start: in front of the exit last used (sessionStorage `portal.return`,
 * { map, entry }), else the plaza start; the save brings items, hearts and
 * flags. It is written (here and on the profile) only once the hero has the
 * blade, so a visitor who walks into a house never becomes a player.
 *
 * Keys: arrows / WASD move; Space / J / Z / Enter = A (sword, talk, lift,
 * throw; hold then release for a spin); K / X / Shift = B (item); Q swaps
 * item, Tab too when there is one (else Tab reaches the page's link index);
 * P or an Escape tap pause; holding Escape saves and goes back to town.
 * Touch: floating stick on the left, A (and B with an item) on the right,
 * SWAP and pause chips. The input itself is `input.ts`.
 *
 * Leaving: an engine `exit` saves, writes `portal.return` and launches the
 * theme or opens the URL.
 */
import EscHold from '../base/EscHold.vue'
import { createGame, stepGame, toSave } from './engine/index'
import { WORLD, worldStartingAt } from './world/index'
import { createRenderer, type FrameUI, type Renderer } from './render/renderer'
import { sprite } from './render/sheet'
import { createZeldaAudio, type SfxName, type ZeldaAudio } from './audio'
import { readLocalSave, writeLocalSave, clearLocalSave, readLocalBest, writeLocalBest } from './localSave'
import { syncWithProfile } from './profileSync'
import { createInput, type GameInput } from './input'
import { loadHighScoreSign } from './hiscore'
import type { ExitTarget, GameState, GameEvent, SaveData, TrackId, UseItem, World } from './types'

type Phase = 'play' | 'won'
type Spot = World['start']

const emit = defineEmits<{
  /** The visitor walked for the first time (the page hint can go). */
  moved: []
  phase: [phase: Phase]
  result: [result: { elapsed: number; best: number | null }]
}>()

const RETURN_KEY = 'portal.return'
/** A theme exit that has not navigated after this long (bad id) comes back to the world. */
const STUCK_S = 2.5
/** A URL exit waits longer (the next site may be slow), but not forever: Esc or Stop can cancel the navigation. */
const STUCK_URL_S = 8
/** The ending panel ignores keys and taps this long, so the press that took the prism does not skip it. */
const WON_GRACE_MS = 1200
const NEW_QUEST_KEYS = new Set(['Enter', 'Space', 'KeyJ', 'KeyZ'])

const canvas = ref<HTMLCanvasElement | null>(null)
const safeProbe = ref<HTMLDivElement | null>(null)
const paused = ref(false)
/** The pause screen is asking whether to throw the run away. */
const confirmReset = ref(false)
const phase = ref<Phase>('play')
const touchUI = ref(false)
const selected = ref<UseItem | null>(null)
/** The hero owns bombs or the disc: B, SWAP and Tab have a job. */
const hasItem = ref(false)
/** A dialog is open (the floating buttons hide so they don't sit on the text). */
const talking = ref(false)
const { navigationLocked, launch } = useTheme()
const sound = useSound()
const profileSave = useGameSave('zelda')

let renderer: Renderer | null = null
let audio: ZeldaAudio | null = null
let state: GameState = createGame(WORLD, { at: WORLD.start })
let raf = 0
let lastT = 0
let hitStopMs = 0
let reducedMotion = false
let lowHpT = 0
let track: TrackId | null = null
/** Audio is awake (browsers keep it asleep until a key or tap). */
let unlocked = false
let moved = false
let alive = false
/** The save this run began from, to tell whether a profile pull changes anything. */
let loadedSave: SaveData | null = null
/** This session has written the save (or dropped it): a late profile pull no longer replaces the run. */
let ownsSave = false
/** A newer save from the profile, applied at the next calm frame. */
let pendingPull: { save: SaveData | null } | null = null
/** Seconds spent in mode 'exit' without leaving. */
let stuckT = 0
let leavingUrl = false
let wonAt = 0

const ui: FrameUI = {
  paused: false, confirmReset: false, reducedMotion: false, touch: false, stick: null, attract: false, cam: null, banner: null,
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

const input: GameInput = createInput({
  canvas: () => canvas.value,
  touch: () => touchUI.value,
  onTouch: () => { touchUI.value = true; resize() },
  idle: () => phase.value !== 'play',
  paused: () => paused.value,
  dialog: () => state.mode === 'dialog',
  onIdleTap: () => { if (phase.value === 'won') newQuest() },
  onKey: shellKey,
})

/** Ending, pause-screen and pause keys; the game keys are input.ts's. */
function shellKey(e: KeyboardEvent): boolean {
  if (phase.value === 'won') {
    if (NEW_QUEST_KEYS.has(e.code) && !e.repeat) { e.preventDefault(); newQuest() }
    return true
  }
  if (paused.value && !e.repeat) {
    if (confirmReset.value) {
      if (e.code === 'Enter' || e.code === 'KeyY') { e.preventDefault(); resetRun(); return true }
      if (e.code === 'KeyN' || e.code === 'Backspace') { e.preventDefault(); cancelReset(); return true }
    } else if (e.code === 'KeyR') { e.preventDefault(); askReset(); return true }
    else if (e.code === 'KeyT') { e.preventDefault(); toTown(); return true }
  }
  if (e.code === 'KeyP') { e.preventDefault(); if (!e.repeat) togglePause(); return true }
  // Nothing to swap: Tab keeps its job and reaches the page's link index.
  if (e.code === 'Tab' && !hasItem.value) return true
  return false
}

function pressA() { input.pressA() }
function releaseA() { input.releaseA() }
function pressB() { input.pressB() }
function cycle() { input.cycle() }

// ---- where to start -------------------------------------------------------------

function readReturn(): Spot | null {
  try {
    const raw = sessionStorage.getItem(RETURN_KEY)
    if (!raw) return null
    const r = JSON.parse(raw) as { map?: unknown; entry?: unknown } | null
    return r && typeof r === 'object' ? worldStartingAt(r.map, r.entry)?.start ?? null : null
  } catch { return null }
}

function writeReturn(map: string, entry: string) {
  try { sessionStorage.setItem(RETURN_KEY, JSON.stringify({ map, entry })) } catch { /* private mode: start at the plaza next time */ }
}

/** Back on the plaza on purpose (to town, start over, a new quest): a reload stays there too. */
function clearReturn() {
  try { sessionStorage.removeItem(RETURN_KEY) } catch { /* ignore */ }
}

/** A new state at `at` from `save` (items, hearts, flags, play time); the shell's per-run bits reset. */
function begin(save: SaveData | null, at: Spot, banner = false) {
  loadedSave = save
  pendingPull = null
  state = createGame(WORLD, { save, at, seed: Date.now() >>> 0 })
  input.clear()
  paused.value = false
  confirmReset.value = false
  hitStopMs = 0
  lowHpT = 0
  stuckT = 0
  leavingUrl = false
  ui.banner = banner ? { text: state.area, t: 0 } : null
  if (unlocked) audio?.pause(false)
  syncDeck()
  playTrack(trackFor(state))
  setPhase('play')
  lastT = 0
}

/** The profile had a newer save than this browser: rebuild on it, keeping the hero where they stand. */
function applyPull(save: SaveData | null) {
  const old = state
  begin(save, old.entry)
  if (state.map.id === old.map.id && state.zoneIndex === old.zoneIndex) {
    const h = state.hero
    h.x = old.hero.x
    h.y = old.hero.y
    h.dir = old.hero.dir
    h.safe = { ...old.hero.safe }
    h.auto = null
  }
}

function sameSave(a: SaveData | null, b: SaveData | null): boolean {
  const key = (s: SaveData | null) => (s ? JSON.stringify({ ...s, savedAt: 0 }) : 'null')
  return key(a) === key(b)
}

async function syncProfile() {
  const pulled = await syncWithProfile(profileSave, () => ownsSave || !alive)
  if (pulled && alive && !ownsSave && !sameSave(pulled.save, loadedSave)) pendingPull = pulled
}

// ---- phases, saves --------------------------------------------------------------

function setPhase(p: Phase) {
  if (phase.value !== p) {
    phase.value = p
    emit('phase', p)
  }
  resize()
}

/** Saves here and on the player's profile (the first save creates the player) — once the hero has the blade. */
function persist() {
  if (!state.inv.sword) return
  const save = toSave(state)
  if (!save) return
  save.savedAt = Date.now()
  writeLocalSave(save)
  profileSave.push({ data: save, savedAt: save.savedAt })
  ownsSave = true
  pendingPull = null
}

/** Drops the save here and, if this browser has a player, on the profile. */
function dropSave(extra: { best?: number, won?: boolean } = {}) {
  const had = readLocalSave() !== null
  const at = Date.now()
  clearLocalSave(at)
  if (extra.won || (had && profileSave.hasPlayer())) profileSave.push({ data: null, savedAt: at, ...extra })
  ownsSave = true
  pendingPull = null
}

function syncDeck() {
  if (state.inv.selected !== selected.value) selected.value = state.inv.selected
  const item = state.inv.bombBag || state.inv.disc
  if (item !== hasItem.value) hasItem.value = item
  if (talking.value !== (state.mode === 'dialog')) {
    talking.value = state.mode === 'dialog'
    // The floating A unmounts under the finger; its pointerup never comes.
    if (talking.value) releaseA()
  }
}

/** Where the engine's `exit` leads. The save is written first; the component unmounts on the way out. */
function leave(id: string, to: ExitTarget) {
  persist()
  input.clear()
  // Nothing in the world leads `home` any more; if something does, it is the plaza.
  if ('home' in to) { begin(toSave(state), WORLD.start, true); return }
  writeReturn(state.map.id, id)
  if ('theme' in to) launch(to.theme)
  else { leavingUrl = true; window.location.assign(to.url) }
}

/** An exit that did not navigate: step back out in front of it, carrying everything. */
function comeBack() {
  begin(toSave(state), readReturn() ?? WORLD.start)
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

// ---- pause menu -------------------------------------------------------------------

function togglePause() {
  if (phase.value !== 'play') return
  // P or an Escape tap while asking "start over?" means no, not resume.
  if (confirmReset.value) { cancelReset(); return }
  paused.value = !paused.value
  input.clear()
  audio?.sfx('menu')
  audio?.pause(paused.value)
}

function askReset() {
  if (phase.value !== 'play' || !paused.value) return
  confirmReset.value = true
  audio?.sfx('menu')
}

function cancelReset() {
  confirmReset.value = false
  audio?.sfx('menu')
}

/** Throws the run away — here and on the profile — and begins again on the plaza. Best time stays. */
function resetRun() {
  if (phase.value !== 'play' || !confirmReset.value) return
  dropSave()
  clearReturn()
  begin(null, WORLD.start, true)
}

/** Save and quit, LTTP style: back on the plaza with everything the hero carries, hearts full. */
function toTown() {
  if (phase.value !== 'play') return
  persist()
  clearReturn()
  begin(toSave(state), WORLD.start, true)
}

function finishWon() {
  dropSave({ best: state.elapsed, won: true })
  input.clear()
  playTrack('ending')
  const prev = readLocalBest()
  const best = prev === null || state.elapsed < prev ? state.elapsed : prev
  if (best !== prev) writeLocalBest(best)
  wonAt = performance.now()
  setPhase('won')
  emit('result', { elapsed: state.elapsed, best })
}

/** From the ending: a fresh quest on the plaza. */
function newQuest() {
  if (phase.value !== 'won' || performance.now() - wonAt < WON_GRACE_MS) return
  clearReturn()
  begin(null, WORLD.start, true)
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
      case 'exit': leave(e.id, e.to); return
    }
  }
  if (save) persist()
}

// ---- loop -------------------------------------------------------------------------

function frame(nowMs: number) {
  raf = requestAnimationFrame(frame)
  if (!renderer) return
  const dt = lastT ? Math.min((nowMs - lastT) / 1000, 0.1) : 0
  lastT = nowMs
  ui.paused = paused.value
  ui.confirmReset = confirmReset.value
  ui.reducedMotion = reducedMotion
  ui.touch = touchUI.value
  ui.keys = touchUI.value ? { a: 'A', b: 'B', cycle: 'SWAP' } : { a: 'SPACE', b: 'K', cycle: 'Q' }
  ui.stick = input.stick

  // The ending: the world stays put behind the page's panel.
  if (phase.value === 'won') { renderer.draw(state, ui, reducedMotion ? 0 : dt); return }
  if (paused.value) { renderer.draw(state, ui, 0); return }
  if (hitStopMs > 0) { hitStopMs -= dt * 1000; renderer.draw(state, ui, 0); return }
  if (pendingPull && state.mode === 'play') applyPull(pendingPull.save)

  const inp = input.read()
  if (!moved && (inp.move.x !== 0 || inp.move.y !== 0)) { moved = true; emit('moved') }
  const events = stepGame(WORLD, state, dt, inp)
  renderer.onEvents(events)
  handleEvents(events)
  if (ui.banner) { ui.banner.t += dt; if (ui.banner.t > 2.2) ui.banner = null }
  syncDeck()
  if (state.hero.hp > 0 && state.hero.hp <= 2 && state.mode === 'play') {
    lowHpT -= dt
    if (lowHpT <= 0) { audio?.sfx('lowHp'); lowHpT = 1.2 }
  }
  if (state.mode === 'exit') {
    stuckT += dt
    if (stuckT > (leavingUrl ? STUCK_URL_S : STUCK_S)) comeBack()
  }
  renderer.draw(state, ui, dt)
  if (state.mode === 'won') finishWon()
}

function onVisibility() {
  if (document.hidden) {
    input.clear()
    if (phase.value === 'play') {
      // Phones kill background tabs: keep the play time up to now.
      persist()
      // With the blade there is danger about, so the run waits; before it the town just goes quiet.
      if (state.inv.sword && !paused.value) togglePause()
    }
  }
  if (unlocked) audio?.pause(document.hidden || paused.value)
  lastT = 0
}

/** Back from a URL exit through the browser's page cache: the world is still dark, so step back out. */
function onPageShow(e: PageTransitionEvent) {
  if (e.persisted && state.mode === 'exit') comeBack()
  lastT = 0
}

function resize() {
  if (!canvas.value || !renderer) return
  const w = canvas.value.clientWidth
  const h = canvas.value.clientHeight
  renderer.resize(w, h, Math.min(devicePixelRatio || 1, 3), safeInsets())
}

/** The screen's safe-area insets in CSS px (all 0 in an ordinary browser tab). */
function safeInsets() {
  const cs = safeProbe.value ? getComputedStyle(safeProbe.value) : null
  const px = (v?: string) => parseFloat(v ?? '') || 0
  return { top: px(cs?.paddingTop), right: px(cs?.paddingRight), bottom: px(cs?.paddingBottom), left: px(cs?.paddingLeft) }
}

let observer: ResizeObserver | null = null
let muteStop: (() => void) | null = null

onMounted(() => {
  if (!canvas.value) return
  alive = true
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  try {
    touchUI.value = window.matchMedia('(hover: none) and (pointer: coarse)').matches
  } catch { touchUI.value = false }
  // The home page owns every key: arrows walk the hero, Escape pauses.
  navigationLocked.value = true
  renderer = createRenderer(canvas.value, WORLD)
  void loadHighScoreSign()
  audio = createZeldaAudio()
  // The world plays its own music; the radio (and its hidden widget) stays quiet here.
  audio.holdRadio()
  muteStop = watch(sound.muted, (m: boolean) => audio?.setMuted(m), { immediate: true })
  // Start at once on this browser's save; the profile's copy may replace it in a moment.
  begin(readLocalSave(), readReturn() ?? WORLD.start)
  void syncProfile()
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
  // Dev-only handle for the headless checks in scripts/zelda-lab (either name).
  if (import.meta.dev) {
    const handle = { get state() { return state }, get world() { return WORLD }, get phase() { return phase.value } }
    const w = window as unknown as { __zelda: unknown; __portal: unknown }
    w.__zelda = handle
    w.__portal = handle
  }
})

onBeforeUnmount(() => {
  alive = false
  cancelAnimationFrame(raf)
  observer?.disconnect()
  muteStop?.()
  window.removeEventListener('resize', resize)
  input.detach()
  window.removeEventListener('keydown', onFirstGesture, true)
  window.removeEventListener('pointerdown', onFirstGesture, true)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('pageshow', onPageShow)
  if (phase.value === 'play') persist()
  audio?.dispose()
  audio = null
  renderer = null
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

.zelda-safe {
  position: fixed;
  inset: 0;
  visibility: hidden;
  pointer-events: none;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) var(--app-safe-bottom, 0px) env(safe-area-inset-left, 0px);
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
  padding: 0 calc(14px + env(safe-area-inset-right, 0px)) calc(14px + var(--app-safe-bottom, 0px));
  font-family: var(--font-machine);
}

/* The pause buttons sit centred across the bottom. */
.zelda-deck--paused {
  left: 0;
  justify-content: center;
}

.zelda-deck-small {
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: auto;
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
  -webkit-tap-highlight-color: transparent;
}

.zelda-deck-btns {
  position: relative;
  width: 168px;
  height: 142px;
  pointer-events: auto;
}

/* A alone, before the hero has an item. */
.zelda-deck-btns--solo {
  width: 88px;
  height: 88px;
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
  -webkit-tap-highlight-color: transparent;
  background: rgba(11, 6, 22, 0.35);
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

.zelda-pad-reset {
  border-color: #ffd23f;
  color: #ffd23f;
}

/* Three buttons across a 375 px phone. */
@media (max-width: 440px) {
  .zelda-deck-paused { gap: 8px; }
  .zelda-pad-wide { min-width: 0; padding: 0 12px; font-size: 12px; letter-spacing: 0.08em; }
}
</style>
