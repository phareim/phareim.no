<template>
  <!-- Another Shore: own the page. The canvas is the whole scene; the title,
    the chapter line, the hints and the result are unboxed text over the sky.
    The radio sits top right, so the run's own chrome lives top left. -->
  <div
    ref="shellRef"
    class="as-shell"
    :class="{ 'as-istouch': isTouch, 'as-light': lightInk }"
  >
    <canvas ref="canvasRef" class="as-canvas" aria-hidden="true" @pointerdown="onCanvasPointer" />

    <!-- Title, over the attract loop. -->
    <div v-if="phase === 'idle'" class="as-title">
      <p class="as-over">A crossing in five chapters</p>
      <h1 class="as-name">another shore</h1>
      <p class="as-lede">Your ship went down on the far side of the sun.</p>
      <button type="button" class="as-start" @click="continueOrBegin">
        {{ saved ? `Continue · ${chapterLabel(saved.chapter)}` : 'Begin' }}{{ hint(' — Enter', '') }}
      </button>
      <button v-if="saved" type="button" class="as-text as-new" @click="beginNew">
        {{ hint('New crossing — N', 'New crossing') }}
      </button>
      <p class="as-keys">{{ hint('← → move · ↑ jump · ↓ crouch · Space kick / fire · Esc pause', '◀ ▶ move · ▲ jump · ▼ crouch · ◆ kick / fire') }}</p>
      <p v-if="metaLine" class="as-meta">{{ metaLine }}</p>
    </div>

    <!-- Playing: one line, top left. -->
    <p v-if="(phase === 'playing' && !inCut) || phase === 'paused'" class="as-top">
      <span class="as-chapter">{{ chapterText }}</span>
      <button v-if="phase === 'playing'" type="button" class="as-text" @click="pauseGame">pause</button>
      <button v-else type="button" class="as-text" @click="resumeGame">resume</button>
      <span class="as-sep">·</span>
      <button type="button" class="as-text" @click="quitToTitle">leave</button>
    </p>

    <p v-if="phase === 'playing' && inCut" class="as-skip">{{ hint('Enter — skip', 'tap — skip') }}</p>

    <p v-if="phase === 'playing' && hintText && !inCut" class="as-hint" role="status">{{ hintText }}</p>

    <!-- Touch zones: pointer-captured outlines along the bottom. -->
    <div v-if="(phase === 'playing' && !inCut) || phase === 'paused'" class="as-touch">
      <div class="as-pad">
        <button
          v-for="z in padLeft"
          :key="z.kind"
          type="button"
          class="as-zone"
          :aria-label="z.label"
          @pointerdown="onTouchButton($event, z.kind)"
          @pointerup="onTouchRelease($event, z.kind)"
          @pointercancel="onTouchRelease($event, z.kind)"
          @lostpointercapture="onTouchRelease($event, z.kind)"
          @contextmenu.prevent
        >
          {{ z.glyph }}
        </button>
      </div>
      <div class="as-pad as-pad-right">
        <button
          v-for="z in padRight"
          :key="z.kind"
          type="button"
          class="as-zone"
          :class="{ 'as-zone-action': z.kind === 'action' }"
          :aria-label="z.label"
          @pointerdown="onTouchButton($event, z.kind)"
          @pointerup="onTouchRelease($event, z.kind)"
          @pointercancel="onTouchRelease($event, z.kind)"
          @lostpointercapture="onTouchRelease($event, z.kind)"
          @contextmenu.prevent
        >
          {{ z.glyph }}
        </button>
      </div>
    </div>

    <p v-if="phase === 'paused'" class="as-line" role="status">
      paused — {{ hint('P or Esc to resume · hold Esc to leave', 'resume above') }}
    </p>

    <!-- The end: the lamp is lit and the ship is home. -->
    <div v-if="phase === 'done'" class="as-result" role="dialog" aria-label="The crossing is over">
      <p class="as-over">The lamp is lit</p>
      <p class="as-name as-name-small">welcome back, {{ pilotName.toLowerCase() }}</p>
      <p class="as-stats">
        Crossing {{ formatTime(result.elapsed) }} · falls {{ result.deaths }}<template v-if="result.best"> · best {{ formatTime(result.best) }}</template>
      </p>
      <p class="as-result-line">
        <button type="button" class="as-start" @click="beginNew">{{ hint('Walk again — Enter', 'Walk again') }}</button>
        <button type="button" class="as-text" @click="toTitle">{{ hint('Leave — Esc', 'Leave') }}</button>
      </p>
    </div>

    <EscHold :is-active="escActive" :paused="phase === 'paused'" :show-paused="false" @tap="escTap" @hold="quitToTitle" />
    <SoundToggle />
  </div>
</template>

<script setup lang="ts">
import EscHold from '../base/EscHold.vue'
import SoundToggle from '../base/SoundToggle.vue'
import { useSound } from '~/composables/useSound'
import { useGameSave } from '~/composables/useGameSave'
import { readStoredPlayer } from '~/composables/useLeaderboard'
import { readShipDef } from '~/composables/useShip'
import {
  CHAPTERS, buildChapter, createGame, demoInput, drainEvents, gameFromSave, parseSave, saveOf,
  skipCut, stepGame, stepWorld,
} from './engine/index'
import { createRenderer, type CutLook } from './render/index'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { createShoreAudio, type Ambience } from './audio'
import {
  chapterLabel, clearLocalSave, formatTime, localSavedAt, readLocalBest, readLocalRaw, reconcile,
  writeLocalBest, writeLocalSave, type RemoteSave,
} from './progress'
import type { Game, GameEvent, Input, PaletteName, ShoreSave, World } from './types'

type Phase = 'idle' | 'playing' | 'paused' | 'done'
type TouchKind = 'left' | 'right' | 'down' | 'up' | 'action'

const STEP = 1 / 60
const MAX_STEPS = 5
const GAME_ID = 'anotherworld'

const { navigationLocked } = useTheme()
const { isTouch, hint } = useInputMode()
const sound = useSound()
const profileSave = useGameSave(GAME_ID)

const shellRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const phase = ref<Phase>('idle')
const saved = ref<ShoreSave | null>(null)
const best = ref<number | null>(null)
const pilotName = ref('PLAYER ONE')
const chapterText = ref('')
const hintKey = ref<string | null>(null)
const hasGun = ref(false)
const inCut = ref(false)
const lightInk = ref(false)
const result = reactive({ elapsed: 0, deaths: 0, best: null as number | null })

let game: Game | null = null
let attract: World | null = null
let renderer = createRenderer()
let audio: ReturnType<typeof createShoreAudio> | null = null
let raf = 0
let last = 0
let acc = 0
let cssW = 0
let cssH = 0
/** Neon Shrine's pixel stage (themes/base/pixel/stage.ts) the renderer draws on. */
let stage: PixelStage | null = null
let reducedMotion = false
let resizeObserver: ResizeObserver | null = null
let needsDraw = true
let look: CutLook = { accent: '#2ff3ff', trim: '#2ff3ff', pilot: 'PLAYER ONE', ship: 'DART' }
let cutClock = { id: '', t: 0 }

const keyState: Record<TouchKind, boolean> = { left: false, right: false, down: false, up: false, action: false }
const touchPoints: Record<TouchKind, Set<number>> = {
  left: new Set(), right: new Set(), down: new Set(), up: new Set(), action: new Set(),
}

const padLeft = [
  { kind: 'left' as const, glyph: '◀', label: 'Move left' },
  { kind: 'right' as const, glyph: '▶', label: 'Move right' },
  { kind: 'down' as const, glyph: '▼', label: 'Crouch' },
]
const padRight = computed(() => [
  { kind: 'up' as const, glyph: '▲', label: 'Jump' },
  { kind: 'action' as const, glyph: hasGun.value ? '◆ fire' : '◆ kick', label: hasGun.value ? 'Fire' : 'Kick' },
])

const HINTS: Record<string, [string, string]> = {
  swim: ['Swim up — ↑ · then → onto the bank', 'Swim up — ▲ · then ▶ onto the bank'],
  kick: ['Kick — Space', 'Kick — ◆'],
  swing: ['Swing the cage — ← → with the swing', 'Swing the cage — ◀ ▶ with the swing'],
  gun: ['Tap Space: fire · hold: shield · hold longer: beam', 'Tap ◆ fire · hold shield · hold longer beam'],
}
const hintText = computed(() => {
  const h = hintKey.value ? HINTS[hintKey.value] : null
  return h ? hint(h[0], h[1]) : ''
})

const metaLine = computed(() => {
  const parts: string[] = []
  if (best.value) parts.push(`Best ${formatTime(best.value)}`)
  if (saved.value) parts.push(`${formatTime(saved.value.elapsed)} in`)
  if (profileSave.hasPlayer()) parts.push(`saved to ${pilotName.value}`)
  return parts.join(' · ')
})

// ---- look: the pilot and the ship from the profile ----

function readLook() {
  const ship = readShipDef()
  const player = readStoredPlayer()
  pilotName.value = player?.name ?? 'PLAYER ONE'
  look = { accent: ship.colors.hull, trim: ship.colors.trim, pilot: pilotName.value.toUpperCase(), ship: ship.name.toUpperCase() }
}

// ---- input ----

function resetInput() {
  for (const k of Object.keys(keyState) as TouchKind[]) {
    keyState[k] = false
    touchPoints[k].clear()
  }
}

function currentInput(): Input {
  return {
    left: keyState.left || touchPoints.left.size > 0,
    right: keyState.right || touchPoints.right.size > 0,
    up: keyState.up || touchPoints.up.size > 0,
    down: keyState.down || touchPoints.down.size > 0,
    action: keyState.action || touchPoints.action.size > 0,
  }
}

// ---- audio ----

const AMBIENCE: Record<PaletteName, Ambience> = { dusk: 'sea', night: 'night', hall: 'hall', storm: 'storm', dawn: 'dawn' }

function syncAmbience() {
  if (!audio || !game) return
  const w = game.world
  if (game.mode === 'cut' && game.cut?.id === 'prologue') {
    audio.ambience(null)
    return
  }
  audio.ambience(AMBIENCE[w.dawn ? 'dawn' : w.palette])
}

/** Beats of the cuts that the engine does not know about: fired when the cut clock passes them. */
const CUT_BEATS: Record<string, Array<[number, () => void]>> = {
  prologue: [
    [0.3, () => { audio?.cue('prologue'); audio?.beat('engine') }],
    [12.5, () => audio?.beat('lightning')],
    [13.2, () => audio?.beat('fall')],
    [19.2, () => audio?.beat('splash')],
    [19.8, () => audio?.beat('bubbles')],
  ],
  capture: [
    [0, () => audio?.cue('capture')],
    [4.5, () => audio?.beat('flash')],
  ],
  ending: [
    [0, () => { audio?.cue('ending'); audio?.ambience('dawn') }],
    [3.1, () => audio?.beat('flash')],
    [6.5, () => audio?.beat('wings')],
    [10.6, () => audio?.beat('wings')],
  ],
}

function tickCutBeats() {
  if (!game || game.mode !== 'cut' || !game.cut) {
    cutClock = { id: '', t: 0 }
    return
  }
  const { id, t } = game.cut
  const prev = cutClock.id === id ? cutClock.t : -1
  for (const [at, fire] of CUT_BEATS[id] ?? []) if (prev < at && t >= at) fire()
  cutClock = { id, t }
}

function onEvents(events: GameEvent[]) {
  if (!game) return
  let persist = false
  for (const e of events) {
    audio?.event(e)
    switch (e.type) {
      case 'beastRoar': audio?.cue('chase'); break
      case 'death':
        if (game.world.chapter === 2) audio?.cue(null)
        break
      case 'chapter':
        audio?.cue(null)
        persist = true
        break
      case 'lamp':
      case 'gun':
        persist = true
        break
      case 'cut':
        if (e.id === 'capture') persist = true
        break
    }
  }
  if (persist) writeSave()
}

// ---- saves ----

function writeSave() {
  if (!game || game.mode === 'done') return
  const s = saveOf(game, Date.now())
  writeLocalSave(s)
  saved.value = s
  profileSave.push({ data: s, savedAt: s.savedAt })
}

function finishRun() {
  if (!game) return
  const now = Date.now()
  const elapsed = Math.round(game.elapsed)
  const prevBest = readLocalBest()
  const newBest = prevBest === null ? elapsed : Math.min(prevBest, elapsed)
  writeLocalBest(newBest)
  best.value = newBest
  clearLocalSave(now)
  saved.value = null
  profileSave.push({ data: null, savedAt: now, best: elapsed, won: true })
  result.elapsed = elapsed
  result.deaths = game.deaths
  result.best = newBest
}

async function syncWithProfile() {
  const local = parseSave(readLocalRaw())
  saved.value = local
  best.value = readLocalBest()
  if (!profileSave.hasPlayer()) return
  const remote = await profileSave.pull()
  if (remote === 'offline') return
  const r = remote as RemoteSave | null
  const action = reconcile(local, localSavedAt(local), r, r?.data ? parseSave(r.data) : null)
  if (action.kind === 'pull') {
    if (action.save) writeLocalSave(action.save)
    else clearLocalSave(r?.savedAt ?? Date.now())
    if (phase.value === 'idle') saved.value = action.save
  } else if (action.kind === 'push') {
    profileSave.push({ data: action.save, savedAt: action.savedAt || Date.now() })
  }
  if (r?.best && (!best.value || r.best < best.value)) {
    best.value = r.best
    writeLocalBest(r.best)
  }
}

// ---- loop ----

function draw() {
  if (!stage || cssW <= 0 || cssH <= 0) return
  if (phase.value === 'idle' || !game) {
    if (attract) renderer.drawWorld(stage, attract, { reducedMotion, look })
  } else {
    renderer.draw(stage, game, { reducedMotion, paused: phase.value === 'paused', look })
  }
  needsDraw = false
}

function syncUi() {
  if (!game) return
  const w = game.world
  const c = CHAPTERS[w.chapter]
  chapterText.value = `${c.roman} · ${c.title}`
  hintKey.value = w.hint
  hasGun.value = w.player.hasGun
  inCut.value = game.mode === 'cut'
  lightInk.value = w.dawn || (game.mode === 'cut' && game.cut?.id === 'ending')
}

function stepPlaying(dt: number) {
  if (!game) return
  acc += Math.min(dt, 0.1)
  let n = 0
  const input = currentInput()
  let prevWorld = game.world
  while (acc >= STEP && n < MAX_STEPS) {
    stepGame(game, input, STEP)
    acc -= STEP
    n += 1
    if (game.world !== prevWorld) {
      prevWorld = game.world
      syncAmbience()
    }
    if (game.mode === 'done') break
  }
  if (n === MAX_STEPS) acc = 0
  tickCutBeats()
  onEvents(drainEvents(game))
  syncUi()
  if (game.mode === 'done') {
    phase.value = 'done'
    navigationLocked.value = false
    resetInput()
    finishRun()
  }
}

function stepAttract(dt: number) {
  if (!attract) return
  acc += Math.min(dt, 0.1)
  let n = 0
  while (acc >= STEP && n < MAX_STEPS) {
    if (attract.exit || attract.dying) attract = buildChapter(1)
    stepWorld(attract, demoInput(attract), STEP)
    attract.events.length = 0
    acc -= STEP
    n += 1
  }
  if (n === MAX_STEPS) acc = 0
}

function frame(t: number) {
  raf = requestAnimationFrame(frame)
  const dt = last === 0 ? STEP : Math.min((t - last) / 1000, 0.1)
  last = t
  if (phase.value === 'playing') {
    stepPlaying(dt)
    draw()
  } else if (phase.value === 'idle') {
    if (!reducedMotion) {
      stepAttract(dt)
      draw()
    } else if (needsDraw) draw()
  } else if (phase.value === 'done') {
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
  // Close to the original's 320×200 on a monitor; a tall slice on a phone.
  if (!stage) stage = createPixelStage(canvas)
  const portrait = cssH > cssW
  stage.resize(cssW, cssH, window.devicePixelRatio || 1, portrait ? 200 : 320, portrait ? 320 : 200)
  needsDraw = true
}

function blurActiveElement() {
  const el = document.activeElement as HTMLElement | null
  if (el && typeof el.blur === 'function') el.blur()
}

// ---- phases ----

function ensureAudio() {
  if (!audio) audio = createShoreAudio()
  audio.setMuted(sound.muted.value)
  audio.unlock()
}

function startRun(g: Game) {
  readLook()
  game = g
  renderer = createRenderer()
  acc = 0
  last = 0
  cutClock = { id: '', t: 0 }
  resetInput()
  phase.value = 'playing'
  navigationLocked.value = true
  blurActiveElement()
  ensureAudio()
  syncAmbience()
  syncUi()
  needsDraw = true
}

function continueOrBegin() {
  if (saved.value) startRun(gameFromSave(saved.value))
  else startRun(createGame())
}

function beginNew() {
  const now = Date.now()
  if (saved.value || phase.value === 'done') {
    clearLocalSave(now)
    if (saved.value) profileSave.push({ data: null, savedAt: now })
    saved.value = null
  }
  startRun(createGame())
}

function pauseGame() {
  if (phase.value !== 'playing') return
  phase.value = 'paused'
  resetInput()
  needsDraw = true
  blurActiveElement()
  audio?.suspend(true)
  writeSave()
}

function resumeGame() {
  if (phase.value !== 'paused') return
  acc = 0
  last = 0
  resetInput()
  phase.value = 'playing'
  blurActiveElement()
  audio?.suspend(false)
  needsDraw = true
}

function toTitle() {
  phase.value = 'idle'
  navigationLocked.value = false
  game = null
  attract = buildChapter(1)
  acc = 0
  resetInput()
  audio?.cue(null)
  audio?.ambience(null)
  audio?.suspend(false)
  blurActiveElement()
  needsDraw = true
}

/** Leaving mid-run keeps the progress: the title offers to continue. */
function quitToTitle() {
  if (phase.value === 'playing' || phase.value === 'paused') writeSave()
  toTitle()
}

function escActive() {
  return phase.value === 'playing' || phase.value === 'paused'
}

function escTap() {
  if (phase.value === 'playing' && inCut.value && game) {
    skipCut(game)
    return
  }
  if (phase.value === 'playing') pauseGame()
  else if (phase.value === 'paused') resumeGame()
}

function isInteractiveTarget(t: EventTarget | null): boolean {
  return t instanceof HTMLElement && t.closest('a,button,input,textarea,select') !== null
}

const KEYMAP: Record<string, TouchKind> = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', KeyZ: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'action', KeyX: 'action', KeyJ: 'action', ShiftLeft: 'action', ShiftRight: 'action',
}

function onKeyDown(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select,[contenteditable="true"]')) return
  if ((e.code === 'Space' || e.code === 'Enter') && isInteractiveTarget(e.target)) return

  if (phase.value === 'idle') {
    if (e.code === 'Enter' && !e.repeat) {
      e.preventDefault()
      continueOrBegin()
    } else if (e.code === 'KeyN' && !e.repeat && saved.value) {
      e.preventDefault()
      beginNew()
    }
    return
  }
  if (phase.value === 'done') {
    if (e.code === 'Enter' && !e.repeat) {
      e.preventDefault()
      beginNew()
    } else if (e.code === 'Escape') {
      e.preventDefault()
      toTitle()
    }
    return
  }
  // A cut: Enter or Space moves on.
  if (phase.value === 'playing' && inCut.value && game) {
    if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat) {
      e.preventDefault()
      skipCut(game)
    }
    return
  }
  const kind = KEYMAP[e.code]
  if (kind) {
    keyState[kind] = true
    e.preventDefault()
    return
  }
  if (e.code === 'KeyP' && !e.repeat) {
    e.preventDefault()
    if (phase.value === 'playing') pauseGame()
    else resumeGame()
  } else if (e.code === 'Enter' && !e.repeat && phase.value === 'paused') {
    e.preventDefault()
    resumeGame()
  }
}

function onKeyUp(e: KeyboardEvent) {
  const kind = KEYMAP[e.code]
  if (kind) keyState[kind] = false
}

function onTouchButton(e: PointerEvent, kind: TouchKind) {
  e.preventDefault()
  try {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    // no capture: the per-button sets still work
  }
  touchPoints[kind].add(e.pointerId)
}

function onTouchRelease(e: PointerEvent, kind: TouchKind) {
  touchPoints[kind].delete(e.pointerId)
}

function onCanvasPointer(e: PointerEvent) {
  // A tap on the picture moves a cut on; on the title it starts (tap, not swipe: click fires on the button).
  if (phase.value === 'playing' && inCut.value && game) {
    e.preventDefault()
    skipCut(game)
  }
}

function pauseOnHidden() {
  if (phase.value === 'playing' && !inCut.value) pauseGame()
  else if (phase.value === 'playing') writeSave()
  resetInput()
}

function onVisibilityChange() {
  if (document.visibilityState === 'hidden') pauseOnHidden()
}

watch(() => sound.muted.value, (m: boolean) => audio?.setMuted(m))

onMounted(() => {
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  readLook()
  attract = buildChapter(1)
  resize()
  if (reducedMotion) {
    // A still frame: the figure already out of the pool, on the shore.
    for (let i = 0; i < 60 * 6; i++) stepWorld(attract, demoInput(attract), STEP)
    draw()
  }
  void syncWithProfile()
  if (import.meta.dev) {
    // Dev only: jump into a chapter or a cut for headless checks (scripts/shore-lab).
    (window as unknown as Record<string, unknown>).__shore = {
      start: (chapter: 1 | 2 | 3 | 4 | 5, checkpoint = -1, gun = false) =>
        startRun(createGame({ chapter, checkpoint, hasGun: gun, skipPrologue: true })),
      prologue: () => startRun(createGame()),
      game: () => game,
      skip: () => { if (game) skipCut(game) },
      seek: (t: number) => { if (game?.cut) game.cut.t = t },
    }
  }
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
  if (phase.value === 'playing' || phase.value === 'paused') writeSave()
  audio?.dispose()
  audio = null
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
.as-shell {
  --as-ink: #ece4f4;
  --as-dim: #a99bc8;
  --as-cyan: #2ff3ff;
  --as-pink: #ff2fa0;
  --as-gold: #ffd23f;
  --as-edge: rgba(47, 243, 255, 0.45);
  position: relative;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: #0b0616;
  color: var(--as-ink);
  font-family: var(--font-person);
  box-sizing: border-box;
}

/* At dawn the sky is warm and bright: the ink goes dark, a hard cut like the palette. */
.as-light {
  --as-ink: #1a0f24;
  --as-dim: #4a2a52;
  --as-cyan: #12304a;
  --as-edge: rgba(26, 15, 36, 0.5);
}

.as-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  touch-action: pan-x pan-y;
}

.as-title,
.as-result {
  position: absolute;
  top: max(9vh, env(safe-area-inset-top));
  left: max(7vw, env(safe-area-inset-left));
  max-width: min(460px, calc(100vw - 48px));
}

.as-over {
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  color: var(--as-cyan);
  margin: 0 0 6px;
}

.as-name {
  font-weight: 300;
  font-size: clamp(38px, 5vw, 68px);
  line-height: 1.02;
  letter-spacing: -0.01em;
  margin: 0 0 10px;
  color: var(--as-ink);
}

.as-name-small {
  font-size: clamp(24px, 3vw, 36px);
}

.as-lede {
  font-weight: 300;
  font-size: 15px;
  line-height: 1.5;
  margin: 0 0 6px;
  color: var(--as-ink);
}

.as-start {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  margin: 10px 18px 0 0;
  padding: 10px 0;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  white-space: nowrap;
  color: var(--as-pink);
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--as-pink);
  cursor: pointer;
  text-shadow: 0 0 10px rgba(255, 47, 160, 0.6);
}

.as-text {
  min-height: 44px;
  padding: 10px 4px;
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--as-ink);
  background: transparent;
  border: none;
  cursor: pointer;
}

.as-new {
  color: var(--as-dim);
}

.as-start:focus-visible,
.as-text:focus-visible,
.as-zone:focus-visible {
  outline: 2px solid var(--as-cyan);
  outline-offset: 3px;
}

.as-keys,
.as-meta {
  font-family: var(--font-machine);
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--as-dim);
  margin: 12px 0 0;
  line-height: 1.7;
}

.as-meta {
  color: var(--as-gold);
  margin-top: 6px;
}

.as-stats {
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--as-ink);
  margin: 0;
}

.as-result-line {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 6px 0 0;
}

.as-top {
  position: absolute;
  top: max(4px, env(safe-area-inset-top));
  left: max(14px, env(safe-area-inset-left));
  margin: 0;
  display: flex;
  align-items: center;
  gap: 2px;
}

.as-chapter {
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--as-cyan);
  margin-right: 12px;
}

.as-sep {
  font-family: var(--font-machine);
  font-size: 11px;
  color: var(--as-dim);
  padding: 0 2px;
}

.as-skip {
  position: absolute;
  right: max(18px, env(safe-area-inset-right));
  bottom: max(18px, var(--app-safe-bottom, 0px));
  margin: 0;
  font-family: var(--font-machine);
  font-size: 10px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--as-dim);
  pointer-events: none;
}

.as-hint,
.as-line {
  position: absolute;
  left: 16px;
  right: 16px;
  bottom: max(52px, calc(40px + var(--app-safe-bottom, 0px)));
  margin: 0;
  text-align: center;
  font-family: var(--font-machine);
  font-size: 11px;
  letter-spacing: 0.15em;
  text-transform: uppercase;
  color: var(--as-cyan);
  pointer-events: none;
}

.as-line {
  color: var(--as-dim);
}

/* Touch zones: hidden on fine pointers unless touch input mode is live. */
.as-touch {
  position: absolute;
  left: max(10px, env(safe-area-inset-left));
  right: max(10px, env(safe-area-inset-right));
  bottom: max(40px, calc(30px + var(--app-safe-bottom, 0px)));
  display: none;
  justify-content: space-between;
  gap: 16px;
  pointer-events: none;
}

.as-istouch .as-touch {
  display: flex;
}

@media (pointer: coarse) {
  .as-touch {
    display: flex;
  }
}

.as-pad {
  display: flex;
  gap: 6px;
  flex: 1 1 0;
  max-width: 260px;
}

.as-pad-right {
  justify-content: flex-end;
}

.as-zone {
  flex: 1 1 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 50px;
  padding: 0;
  font-family: var(--font-machine);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--as-dim);
  background: transparent;
  border: 1px solid var(--as-edge);
  cursor: pointer;
  touch-action: none;
  pointer-events: auto;
  user-select: none;
  -webkit-user-select: none;
}

.as-zone-action {
  flex: 1.6 1 0;
  color: var(--as-pink);
  border-color: rgba(255, 47, 160, 0.6);
}

.as-istouch .as-hint,
.as-istouch .as-line {
  bottom: max(104px, calc(94px + var(--app-safe-bottom, 0px)));
}

@media (pointer: coarse) {
  .as-shell .as-hint,
  .as-shell .as-line {
    bottom: max(104px, calc(94px + var(--app-safe-bottom, 0px)));
  }
}

@media (max-width: 600px) {
  /* The radio owns the top right; the chapter name gives way to it. */
  .as-chapter {
    display: none;
  }

  .as-title,
  .as-result {
    top: max(72px, calc(env(safe-area-inset-top) + 56px));
    left: max(22px, env(safe-area-inset-left));
    max-width: 290px;
  }

  .as-name {
    font-size: 34px;
  }

  .as-lede {
    font-size: 13px;
  }

  .as-keys {
    display: none;
  }
}

@media (max-height: 480px) {
  .as-title,
  .as-result {
    top: max(12px, env(safe-area-inset-top));
    left: max(22px, env(safe-area-inset-left));
    max-width: 320px;
  }

  .as-over {
    margin-bottom: 2px;
  }

  .as-name {
    font-size: 26px;
    margin-bottom: 2px;
  }

  .as-lede {
    font-size: 12px;
    margin: 0;
  }

  .as-keys {
    display: none;
  }

  .as-start {
    min-height: 36px;
    margin-top: 4px;
    padding: 6px 0;
  }

  .as-touch {
    bottom: max(30px, calc(22px + var(--app-safe-bottom, 0px)));
  }

  .as-zone {
    min-height: 36px;
  }

  .as-istouch .as-hint,
  .as-istouch .as-line {
    bottom: calc(76px + var(--app-safe-bottom, 0px));
  }
}

/* Neon Shrine's pixel letters (2026-09-24, docs/games/pixel-look.md):
   --font-pixel at multiples of 8 px, the hard one-pixel drop shadow the
   canvas font uses. At dawn the ink goes dark and the shadow goes pale. */
.as-shell {
  --as-shadow: #0b0616;
}
.as-light {
  --as-shadow: rgba(255, 244, 255, 0.55);
}
.as-over, .as-name, .as-lede, .as-start, .as-text, .as-keys, .as-meta, .as-stats,
.as-chapter, .as-sep, .as-skip, .as-hint, .as-line, .as-zone {
  font-family: var(--font-pixel);
  font-weight: 400;
  letter-spacing: 0;
  -webkit-font-smoothing: none;
  text-shadow: 2px 2px 0 var(--as-shadow);
}
.as-over, .as-lede, .as-start, .as-text, .as-keys, .as-meta, .as-stats,
.as-chapter, .as-sep, .as-skip, .as-hint, .as-line, .as-zone {
  font-size: 16px;
  line-height: 1.5;
}
.as-name {
  font-size: 48px;
  line-height: 1.1;
  text-shadow: 6px 6px 0 var(--as-shadow);
}
.as-name-small {
  font-size: 32px;
  text-shadow: 4px 4px 0 var(--as-shadow);
}
.as-start {
  text-shadow: 2px 2px 0 var(--as-shadow), 0 0 10px rgba(255, 47, 160, 0.5);
}
@media (min-width: 800px) {
  .as-name { font-size: 64px; text-shadow: 8px 8px 0 var(--as-shadow); }
  .as-name-small { font-size: 40px; text-shadow: 5px 5px 0 var(--as-shadow); }
}
@media (max-width: 600px) {
  .as-name { font-size: 40px; text-shadow: 5px 5px 0 var(--as-shadow); }
}
@media (max-height: 480px) {
  .as-name { font-size: 32px; text-shadow: 4px 4px 0 var(--as-shadow); }
  .as-over, .as-lede, .as-start, .as-text { font-size: 16px; }
}
</style>
