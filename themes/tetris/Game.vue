<template>
  <div
    ref="surfaceRef"
    class="tetris-game"
    role="group"
    aria-label="Tetris board"
    :style="{ width: boardW + 'px', height: boardH + 'px' }"
    @click="onTap"
  >
    <canvas ref="canvasRef" class="tetris-board" />
    <div v-if="phase === 'idle'" class="tetris-overlay tetris-overlay-idle">
      <div class="tetris-box">
        <span class="tetris-gameover">READY?</span>
        <button class="play-button" @click.stop="start">▶ {{ hint('PRESS ENTER', 'TAP TO PLAY') }} ◀</button>
        <span class="overlay-hint">{{ hint('ARROWS MOVE · ↑ ROTATE', 'DRAG TO MOVE · TAP TO ROTATE') }}</span>
      </div>
    </div>
    <div v-else-if="phase === 'over'" class="tetris-overlay tetris-overlay-over">
      <div class="tetris-box">
        <span class="tetris-gameover">GAME OVER</span>
        <span>SCORE {{ scoreText }}</span>
        <span v-if="newBest" class="tetris-newbest">NEW BEST</span>
        <span v-else>BEST {{ bestText }}</span>
        <span v-if="rank" class="tetris-rank">WORLD RANK #{{ rank.rank }} · {{ rank.name.toUpperCase() }}</span>
        <button class="play-button" @click.stop="start">▶ {{ hint('ENTER TO RETRY', 'TAP TO RETRY') }} ◀</button>
      </div>
    </div>
    <div v-else-if="phase === 'paused'" class="tetris-overlay tetris-overlay-paused">
      <div class="tetris-box">
        <span class="tetris-gameover">PAUSED</span>
        <button class="play-button" @click.stop="togglePause">▶ {{ hint('P TO RESUME', 'RESUME') }} ◀</button>
      </div>
    </div>
    <!-- EscHold owns Escape: tap pauses/resumes, a 3 s hold quits into game over. -->
    <EscHold :is-active="escActive" :paused="false" :show-paused="false" @tap="escTap" @hold="quitToGameOver" />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import EscHold from '../base/EscHold.vue'
import { useSound } from '~/composables/useSound'
import { TetrisGesture } from './gestures'
import { PIECE_SHAPES, TetrisEngine, type EngineEvent, type PieceType } from './engine'
import { createPixelStage, type PixelStage } from '../base/pixel/stage'
import { FRAME, drawSparks, ghostTile, paintWell, rowSparks, stepSparks, tile, tones, type Spark } from './pixel'

const { navigationLocked } = useTheme()
const { submitScore, lastSubmission } = useLeaderboard()
const { hint } = useInputMode()
const sound = useSound()
// Drags can move several cells per touch event — throttle the step tick.
let lastMoveSfx = 0
function moveSfx(): void {
  const now = performance.now()
  if (now - lastMoveSfx < 60) return
  lastMoveSfx = now
  sound.sfx.move()
}

export interface TetrisState {
  phase: 'idle' | 'playing' | 'paused' | 'over'
  score: number
  lines: number
  level: number
  best: number
  next: PieceType | null
  hold: PieceType | null
  canHold: boolean
  newBest: boolean
  levelUpUntil: number
}

const props = withDefaults(defineProps<{ cellSize?: number }>(), { cellSize: 26 })

const emit = defineEmits<{
  state: [value: TetrisState]
  started: []
  over: []
  exit: []
  beat: [clear: boolean]
  view: [position: { x: number, y: number }]
}>()

const COLS = 10
const ROWS = 20
const DAS_MS = 150
const ARR_MS = 40
const SOFT_MS = 40
const CLEAR_FLASH_MS = 150
const IDLE_STEP_MS = 900
const BEST_KEY = 'tetrisHighScore'

const surfaceRef = ref<HTMLElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const phase = ref<TetrisState['phase']>('idle')
const score = ref(0)
const lines = ref(0)
const level = ref(1)
const best = ref(0)
/** This run's world rank, once the Hall of Fame has answered. */
const rank = computed(() => lastSubmission.value?.game === 'tetris' && lastSubmission.value.score === score.value ? lastSubmission.value : null)
const newBest = ref(false)
const levelUpUntil = ref(0)
const nextPiece = ref<PieceType | null>(null)
const holdPieceRef = ref<PieceType | null>(null)
const canHoldRef = ref(true)

const scoreText = computed(() => String(score.value).padStart(6, '0'))
const bestText = computed(() => String(best.value).padStart(6, '0'))
// The board is a pixel stage (themes/base/pixel): each cell is a T×T
// carved tile scaled by a whole number s, so T·s device px is as close to
// the layout's cell size as it gets. The stone rim adds FRAME px each side.
const dprRef = ref(1)
const grid = computed(() => {
  const target = props.cellSize * dprRef.value
  let best = { T: Math.max(3, Math.floor(target)), s: 1 }
  let bestP = 0
  for (let T = 10; T >= 6; T--) {
    const s = Math.floor(target / T)
    if (s >= 1 && T * s > bestP) { bestP = T * s; best = { T, s } }
  }
  return best
})
/** CSS px per cell, what the gestures measure drags in. */
const cellPx = computed(() => grid.value.T * grid.value.s / dprRef.value)
const boardW = computed(() => (COLS * grid.value.T + FRAME * 2) * grid.value.s / dprRef.value)
const boardH = computed(() => (ROWS * grid.value.T + FRAME * 2) * grid.value.s / dprRef.value)

let engine: TetrisEngine | null = null
let stage: PixelStage | null = null
let well: HTMLCanvasElement | null = null
const sparks: Spark[] = []
let rafId = 0
let lastT = 0
let running = false
let mounted = false
let dirty = true
let lastEmitKey = ''
let lastViewX = NaN
let lastViewY = NaN
let reducedMotion = false
let softActive = false
let softAcc = 0
let heldDir = 0
let dasAcc = 0
let arrAcc = 0
let dasDone = false
let idleAcc = 0
let clearTimer: ReturnType<typeof setTimeout> | null = null
let idleBoard: (PieceType | null)[][] = []
let idlePiece: { type: PieceType, x: number, y: number } | null = null

function emptyBoard(): (PieceType | null)[][] {
  const b: (PieceType | null)[][] = []
  for (let r = 0; r < ROWS; r++) {
    const row: (PieceType | null)[] = []
    for (let c = 0; c < COLS; c++) row.push(null)
    b.push(row)
  }
  return b
}

function syncHud(): void {
  if (!engine) return
  score.value = engine.score
  lines.value = engine.lines
  level.value = engine.level
  if (phase.value === 'idle') {
    nextPiece.value = null
    holdPieceRef.value = null
    canHoldRef.value = true
  } else {
    nextPiece.value = engine.next
    holdPieceRef.value = engine.hold
    canHoldRef.value = engine.canHold
  }
  if (engine.score > best.value) {
    best.value = engine.score
    newBest.value = true
  }
  dirty = true
}

function getState(): TetrisState {
  return {
    phase: phase.value,
    score: score.value,
    lines: lines.value,
    level: level.value,
    best: best.value,
    next: nextPiece.value,
    hold: holdPieceRef.value,
    canHold: canHoldRef.value,
    newBest: newBest.value,
    levelUpUntil: levelUpUntil.value
  }
}

function emitView(): void {
  // Follow the occupied cells' centre; only send a new target when it moves.
  const cells = phase.value === 'idle' ? [] : engine?.cells() ?? []
  const x = cells.length ? cells.reduce((sum, cell) => sum + cell.x + .5, 0) / cells.length / COLS * 2 - 1 : 0
  const y = cells.length ? cells.reduce((sum, cell) => sum + cell.y + .5, 0) / cells.length / ROWS * 2 - 1 : 0
  if (x === lastViewX && y === lastViewY) return
  lastViewX = x
  lastViewY = y
  emit('view', { x, y })
}

function maybeEmit(): void {
  const s = getState()
  const key = JSON.stringify(s)
  if (key !== lastEmitKey) {
    lastEmitKey = key
    emit('state', s)
  }
}

function persistBest(): void {
  try {
    localStorage.setItem(BEST_KEY, String(best.value))
  } catch {
    // storage unavailable — ignore
  }
}

function handleEngineEvent(e: EngineEvent): void {
  if (!mounted) return
  if (e.type === 'lock') {
    emit('beat', false)
    sound.sfx.lock()
  }
  if (e.type === 'lock' || e.type === 'score') {
    syncHud()
    return
  }
  if (e.type === 'clear') {
    emit('beat', true)
    if (engine && !reducedMotion) {
      const T = grid.value.T
      for (const r of engine.pendingClear) {
        const colors = ['#ffffff']
        for (const v of engine.board[r] ?? []) if (v) colors.push(tones(v as PieceType).spark)
        rowSparks(sparks, FRAME + r * T + T / 2, FRAME, COLS * T, colors)
      }
    }
    sound.sfx.clear(e.count)
    syncHud()
    if (!engine) return
    if (reducedMotion) {
      engine.finishClear()
      syncHud()
    } else if (clearTimer === null) {
      clearTimer = setTimeout(() => {
        clearTimer = null
        if (!mounted || !engine) return
        engine.finishClear()
        syncHud()
      }, CLEAR_FLASH_MS)
    }
    return
  }
  if (e.type === 'levelup') {
    levelUpUntil.value = Date.now() + 1200
    sound.sfx.levelup()
    syncHud()
    return
  }
  if (e.type === 'over') {
    cancelGesture()
    phase.value = 'over'
    softActive = false
    heldDir = 0
    navigationLocked.value = false
    persistBest()
    submitScore('tetris', score.value)
    syncHud()
    sound.sfx.hardDrop()
    sound.sfx.gameOver()
    sound.music.stop()
    emit('over')
  }
}

function buildIdle(): void {
  const b = emptyBoard()
  const gap = 4
  const palette: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']
  for (let r = ROWS - 5; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (c === gap) continue
      if (r === ROWS - 5 && c % 3 === 0) continue
      b[r]![c] = palette[Math.floor(Math.random() * palette.length)] as PieceType
    }
  }
  idleBoard = b
  spawnIdlePiece()
}

function spawnIdlePiece(): void {
  const palette: PieceType[] = ['T', 'S', 'Z', 'J', 'L', 'I', 'O']
  const type = (palette[Math.floor(Math.random() * palette.length)] as PieceType) || 'T'
  idlePiece = { type, x: 1 + Math.floor(Math.random() * (COLS - 5)), y: 0 }
}

function idleCollides(): boolean {
  if (!idlePiece) return true
  const p = idlePiece
  const cells = PIECE_SHAPES[p.type][0].flatMap((row, y) => row.flatMap((v, x) => v ? [[x, y]] : []))
  for (const [dx, dy] of cells) {
    const bx = p.x + (dx as number)
    const by = p.y + (dy as number)
    if (by >= ROWS) return true
    if (by < 0) continue
    const row = idleBoard[by]
    if (row && row[bx] !== null) return true
  }
  return false
}

function stepIdle(): void {
  if (!idlePiece) {
    spawnIdlePiece()
    return
  }
  idlePiece.y += 1
  if (idleCollides()) spawnIdlePiece()
}

function start(): void {
  if (!engine) return
  if (clearTimer !== null) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  cancelGesture()
  engine.reset()
  phase.value = 'playing'
  newBest.value = false
  levelUpUntil.value = 0
  navigationLocked.value = true
  softActive = false
  softAcc = 0
  heldDir = 0
  dasAcc = 0
  arrAcc = 0
  dasDone = false
  lastT = 0
  syncHud()
  maybeEmit()
  sound.unlock()
  sound.sfx.uiStart()
  sound.music.start('tetris')
  emit('started')
}

function move(dx: -1 | 1): void {
  if (phase.value !== 'playing' || !engine) return
  if (engine.move(dx)) moveSfx()
  syncHud()
}

function pressDir(dir: -1 | 1): void {
  if (phase.value !== 'playing' || !engine) return
  if (engine.move(dir)) moveSfx()
  heldDir = dir
  dasAcc = 0
  arrAcc = 0
  dasDone = false
  syncHud()
}

function releaseDir(dir: -1 | 1): void {
  if (heldDir === dir) {
    heldDir = 0
    dasAcc = 0
    arrAcc = 0
    dasDone = false
  }
}

function softDropStart(): void {
  if (phase.value !== 'playing' || !engine) return
  softActive = true
  softAcc = 0
  if (engine.softDrop()) moveSfx()
  syncHud()
}

function softDropStop(): void {
  softActive = false
  softAcc = 0
}

function hardDrop(): void {
  if (phase.value !== 'playing' || !engine) return
  engine.hardDrop()
  sound.sfx.hardDrop()
  syncHud()
}

function rotate(dir: 1 | -1): void {
  if (phase.value !== 'playing' || !engine) return
  if (engine.rotate(dir)) sound.sfx.rotate()
  syncHud()
}

function hold(): void {
  if (phase.value !== 'playing' || !engine) return
  if (engine.holdPiece()) sound.sfx.hold()
  syncHud()
}

function togglePause(): void {
  cancelGesture()
  if (phase.value === 'playing') {
    phase.value = 'paused'
    softActive = false
    heldDir = 0
    dirty = true
    maybeEmit()
    sound.music.stop(false)
  } else if (phase.value === 'paused') {
    phase.value = 'playing'
    lastT = 0
    dirty = true
    maybeEmit()
    emitView()
    sound.music.start('tetris')
  }
}

function exit(): void {
  cancelGesture()
  if (clearTimer !== null) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  persistBest()
  if (engine) engine.reset()
  buildIdle()
  phase.value = 'idle'
  navigationLocked.value = false
  softActive = false
  heldDir = 0
  syncHud()
  maybeEmit()
  sound.music.stop()
  emit('exit')
}

function escActive(): boolean {
  return phase.value === 'playing' || phase.value === 'paused'
}

function escTap(): void {
  if (escActive()) togglePause()
}

// A 3 s Escape hold cancels the run into the GAME OVER screen with the
// run's score — the same state as topping out.
function quitToGameOver(): void {
  if (!escActive()) return
  cancelGesture()
  if (clearTimer !== null) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
  phase.value = 'over'
  softActive = false
  heldDir = 0
  navigationLocked.value = false
  persistBest()
  submitScore('tetris', score.value)
  syncHud()
  maybeEmit()
  sound.sfx.gameOver()
  sound.music.stop()
  emit('over')
}

function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false
  const tag = t.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return t.isContentEditable
}

function isInteractiveElement(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  if (tag === 'A' || tag === 'BUTTON' || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return el.closest('a, button, .social-links, .profile-card') !== null
}

function onTap(e: Event): void {
  if (performance.now() < suppressClickUntil) return
  if (isInteractiveElement(e.target)) return
  if (phase.value === 'idle' || phase.value === 'over') start()
  else if (phase.value === 'paused') togglePause()
}

function handleKeyDown(e: KeyboardEvent): void {
  if (isEditableTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
  if ((e.code === 'Space' || e.code === 'Enter') && isInteractiveElement(e.target)) return
  const code = e.code
  if (code === 'Enter') {
    if (isInteractiveElement(e.target)) return
    if (phase.value === 'idle' || phase.value === 'over') {
      start()
    } else if (phase.value === 'paused') {
      togglePause()
    }
    return
  }
  if (code === 'Escape') {
    // Playing/paused belong to EscHold (tap = pause, hold = game over);
    // on the GAME OVER screen a tap dismisses back to idle (claimed, so the
    // shell does not also take it as "back to the portal").
    if (phase.value === 'over') {
      e.preventDefault()
      exit()
    }
    return
  }
  if (code === 'KeyP') {
    if (phase.value === 'playing' || phase.value === 'paused') togglePause()
    return
  }
  if (phase.value !== 'playing') return
  switch (code) {
    case 'ArrowLeft':
    case 'KeyA':
      e.preventDefault()
      if (!e.repeat) pressDir(-1)
      break
    case 'ArrowRight':
    case 'KeyD':
      e.preventDefault()
      if (!e.repeat) pressDir(1)
      break
    case 'ArrowDown':
    case 'KeyS':
      e.preventDefault()
      if (!e.repeat) softDropStart()
      break
    case 'ArrowUp':
    case 'KeyX':
      e.preventDefault()
      if (!e.repeat) rotate(1)
      break
    case 'KeyZ':
      if (!e.repeat) rotate(-1)
      break
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      if (!e.repeat) hold()
      break
    case 'Space':
      e.preventDefault()
      if (!e.repeat) hardDrop()
      break
    default:
      break
  }
}

function handleKeyUp(e: KeyboardEvent): void {
  const code = e.code
  if (code === 'ArrowLeft' || code === 'KeyA') releaseDir(-1)
  else if (code === 'ArrowRight' || code === 'KeyD') releaseDir(1)
  else if (code === 'ArrowDown' || code === 'KeyS') softDropStop()
}

// Touch starts on the surface (including overlays), never on touchstart alone.
let touchId: number | null = null
let gesture: TetrisGesture | null = null
let gesturePiece: TetrisEngine['active'] = null
let touchStartX = 0, touchStartY = 0, touchTravel = 0
let suppressClickUntil = 0
let gesturePhase: TetrisState['phase'] = 'idle'
function cancelGesture(): void {
  touchId = null
  gesture = null
  gesturePiece = null
}
function findTouch(e: TouchEvent): Touch | undefined {
  return Array.from(e.changedTouches).find(t => t.identifier === touchId)
}
function onTouchStart(e: TouchEvent): void {
  if (e.touches.length !== 1 || touchId !== null) { cancelGesture(); suppressClickUntil = performance.now() + 700; return }
  const t = e.changedTouches[0]
  if (!t) return
  touchId = t.identifier
  touchStartX = t.clientX
  touchStartY = t.clientY
  touchTravel = 0
  gesturePhase = phase.value
  gesturePiece = engine?.active ?? null
  gesture = new TetrisGesture(t.clientX, t.clientY, performance.now(), cellPx.value)
  if (phase.value === 'playing') e.preventDefault()
}
function onTouchMove(e: TouchEvent): void {
  const t = findTouch(e)
  if (!t || !gesture) return
  touchTravel = Math.max(touchTravel, Math.hypot(t.clientX - touchStartX, t.clientY - touchStartY))
  if (gesturePhase !== 'playing' || phase.value !== 'playing' || !engine) return
  e.preventDefault()
  if (engine.active !== gesturePiece) return
  const action = gesture.move(t.clientX, t.clientY, performance.now())
  for (let i = 0; i < Math.abs(action.horizontal); i++) {
    if (engine.move(action.horizontal > 0 ? 1 : -1)) moveSfx()
  }
  for (let i = 0; i < action.down && engine.active === gesturePiece; i++) engine.softDrop()
  syncHud()
}
function onTouchEnd(e: TouchEvent): void {
  const t = findTouch(e)
  if (!t || !gesture) return
  // Suppress the compatibility click, including after a swipe over an overlay.
  e.preventDefault()
  suppressClickUntil = performance.now() + 700
  const action = gesture.end(t.clientX, t.clientY, performance.now())
  if (gesturePhase === phase.value) {
    if (phase.value === 'playing' && engine?.active === gesturePiece) {
      if (action === 'rotate') rotate(1)
      if (action === 'drop') hardDrop()
      if (action === 'hold') hold()
    } else if (touchTravel < 10 && action === 'rotate') {
      if (phase.value === 'paused') togglePause()
      else if (phase.value === 'idle' || phase.value === 'over') start()
    }
  }
  cancelGesture()
}
function onTouchCancel(): void {
  suppressClickUntil = performance.now() + 700
  cancelGesture()
}

function onVisibility(): void {
  if (document.hidden && phase.value === 'playing') togglePause()
}

function onBlur(): void {
  if (phase.value === 'playing') togglePause()
}

function setupCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  dprRef.value = Math.min(3, window.devicePixelRatio || 1)
  const { T, s: scale } = grid.value
  const lw = COLS * T + FRAME * 2
  const lh = ROWS * T + FRAME * 2
  const d = dprRef.value
  if (!stage) stage = createPixelStage(canvas)
  canvas.style.width = (lw * scale) / d + 'px'
  canvas.style.height = (lh * scale) / d + 'px'
  stage.resize((lw * scale) / d, (lh * scale) / d, d, lw, lh)
  well = paintWell(COLS, ROWS, T)
  sparks.length = 0
}

function draw(): void {
  if (!stage || !engine || !well) return
  const T = grid.value.T
  const F = FRAME
  const g = stage.begin()
  g.drawImage(well, 0, 0)
  const lw = COLS * T + F * 2
  const lh = ROWS * T + F * 2
  const time = performance.now() / 1000
  // Two torches above the shaft, and a cool glow from the floor.
  const flick = reducedMotion ? 0 : Math.sin(time * 9) * 0.05 + Math.sin(time * 23.7) * 0.04
  stage.light(F + 1, F + 1, lw * 0.95, '#ff8a3d', 0.6 + flick)
  stage.light(lw - F - 1, F + 1, lw * 0.95, '#ff8a3d', 0.6 - flick)
  stage.light(lw / 2, lh - F, lw * 0.8, '#3ff0ff', 0.3)
  const put = (img: HTMLCanvasElement, c: number, r: number) => g.drawImage(img, F + c * T, F + r * T)
  const board = phase.value === 'idle' ? idleBoard : engine.board as (PieceType | null)[][]
  for (let r = 0; r < ROWS; r++) {
    const row = board[r]
    if (!row) continue
    for (let c = 0; c < COLS; c++) {
      const v = row[c]
      if (v !== null && v !== undefined) put(tile(v, T), c, r)
    }
  }
  if (phase.value === 'idle') {
    if (idlePiece && !reducedMotion) {
      const p = idlePiece
      g.globalAlpha = 0.5
      PIECE_SHAPES[p.type][0].forEach((row, y) => row.forEach((v, x) => { if (v) put(tile(p.type, T), p.x + x, p.y + y) }))
      g.globalAlpha = 1
    }
  } else {
    if (engine.pendingClear.length > 0) {
      g.fillStyle = '#fff4ff'
      for (const r of engine.pendingClear) {
        g.fillRect(F, F + r * T, COLS * T, T)
        stage.emit(F, F + r * T, COLS * T, T)
        stage.light(lw / 2, F + r * T + T / 2, lw * 0.8, '#fff1b0', 0.8)
      }
    }
    const a = engine.active
    if (a && phase.value !== 'over') {
      const gy = engine.ghostY()
      if (gy !== a.y) {
        for (const cell of engine.cells()) {
          const gr = cell.y + (gy - a.y)
          if (gr >= 0) put(ghostTile(cell.type, T), cell.x, gr)
        }
      }
      // The falling piece glows: full brightness and a pool of its own colour.
      let lx = 0, ly = 0, n = 0
      for (const cell of engine.cells()) {
        if (cell.y < 0) continue
        put(tile(cell.type, T), cell.x, cell.y)
        stage.emit(F + cell.x * T, F + cell.y * T, T, T)
        lx += cell.x; ly += cell.y; n++
      }
      if (n) stage.light(F + (lx / n + 0.5) * T, F + (ly / n + 0.5) * T, T * 4, tones(a.type).body, 0.7)
    }
  }
  stage.present({ ambient: '#b2a6dc', afterLight: g2 => drawSparks(g2, sparks) })
}

function step(dt: number): void {
  if (!engine) return
  if (phase.value === 'playing') {
    if (heldDir !== 0) {
      dasAcc += dt
      if (!dasDone && dasAcc >= DAS_MS) {
        dasDone = true
        arrAcc = 0
      }
      if (dasDone) {
        arrAcc += dt
        while (arrAcc >= ARR_MS) {
          arrAcc -= ARR_MS
          engine.move(heldDir as -1 | 1)
        }
        dirty = true
      }
    }
    if (softActive) {
      softAcc += dt
      while (softAcc >= SOFT_MS) {
        softAcc -= SOFT_MS
        if (!engine.softDrop()) {
          softAcc = 0
          break
        }
        dirty = true
      }
    }
    engine.tick(dt)
    dirty = true
  } else if (phase.value === 'idle' && !reducedMotion) {
    idleAcc += dt
    while (idleAcc >= IDLE_STEP_MS) {
      idleAcc -= IDLE_STEP_MS
      stepIdle()
      dirty = true
    }
  }
}

function frame(t: number): void {
  if (!running) return
  rafId = requestAnimationFrame(frame)
  const dt = Math.min(100, Math.max(0, t - (lastT || t)))
  lastT = t
  step(dt)
  stepSparks(sparks, dt / 1000)
  // The torches flicker and sparks fly, so the well redraws every frame.
  draw()
  if (phase.value === 'playing' || dirty) {
    dirty = false
    syncHudLight()
    maybeEmit()
    emitView()
  }
}

function syncHudLight(): void {
  if (!engine) return
  score.value = engine.score
  lines.value = engine.lines
  level.value = engine.level
  if (phase.value !== 'idle') {
    nextPiece.value = engine.next
    holdPieceRef.value = engine.hold
    canHoldRef.value = engine.canHold
  }
  if (engine.score > best.value) {
    best.value = engine.score
    newBest.value = true
  }
}

watch(() => props.cellSize, () => {
  setupCanvas()
  draw()
})

onMounted(() => {
  mounted = true
  running = true
  try {
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    reducedMotion = false
  }
  try {
    const saved = localStorage.getItem(BEST_KEY)
    if (saved) best.value = parseInt(saved, 10) || 0
  } catch {
    best.value = 0
  }
  if (!engine) engine = new TetrisEngine({ onEvent: handleEngineEvent })
  buildIdle()
  setupCanvas()
  syncHud()
  const canvas = surfaceRef.value
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  if (canvas) {
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd, { passive: false })
    canvas.addEventListener('touchcancel', onTouchCancel)
  }
  rafId = requestAnimationFrame(frame)
})

onBeforeUnmount(() => {
  persistBest()
  navigationLocked.value = false
  mounted = false
  running = false
  sound.music.stop()
  cancelAnimationFrame(rafId)
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('blur', onBlur)
  cancelGesture()
  const canvas = surfaceRef.value
  if (canvas) {
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
    canvas.removeEventListener('touchcancel', onTouchCancel)
  }
  if (clearTimer !== null) {
    clearTimeout(clearTimer)
    clearTimer = null
  }
})

engine = new TetrisEngine({ onEvent: handleEngineEvent })

defineExpose({
  start,
  move,
  softDropStart,
  softDropStop,
  hardDrop,
  rotate,
  hold,
  togglePause,
  exit,
  getState
})
</script>

<style scoped>
/* The well and its stone rim are drawn on the canvas (./pixel.ts); the
   overlays are Neon Shrine dialog boxes in the 5×7 font (--font-pixel).
   One box pixel is 2 CSS px, like 16 px text. */
.tetris-game { position: relative; flex: 0 0 auto; overflow: hidden; background: #0b0616; box-shadow: 6px 6px 0 #0b0616aa; touch-action: none; user-select: none; -webkit-user-select: none; }
.tetris-board { display: block; image-rendering: pixelated; }
.tetris-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; padding: 4px; text-align: center; background: #0b061666; }
.tetris-overlay > .tetris-box { display: flex; flex-direction: column; align-items: center; gap: 12px; }
.tetris-box { max-width: 100%; box-sizing: border-box; padding: 12px 8px; background: rgba(11, 6, 22, .9); border: 2px solid var(--tetris-pink); box-shadow: inset 0 0 0 2px rgba(11, 6, 22, .9), inset 0 4px 0 0 rgba(47, 243, 255, .35), 4px 4px 0 #0b0616; clip-path: polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px); font: 16px/1.25 var(--font-pixel); -webkit-font-smoothing: none; color: #fff4ff; text-shadow: 2px 2px 0 #3a1a4a; }
.tetris-gameover { font-size: 24px; color: var(--tetris-pink); text-shadow: 3px 3px 0 #0b0616, 0 0 16px #ff2fa080; }
.tetris-newbest { color: var(--tetris-gold); animation: tetris-blink 1.1s steps(1) infinite; }
.tetris-rank { font-size: 8px; color: var(--tetris-pink, #ff2fa0); text-shadow: 1px 1px 0 #0b0616; }
.play-button { max-width: 100%; min-height: 44px; padding: 8px 4px; white-space: normal; line-height: 1.4; background: #ff2fa022; border: 2px solid var(--tetris-pink); border-radius: 0; color: var(--tetris-pink); font: 16px var(--font-pixel); text-shadow: 2px 2px 0 #0b0616; cursor: pointer; animation: tetris-blink 1.1s steps(1) infinite; }
.play-button:focus-visible { outline: 2px solid var(--tetris-accent); outline-offset: 2px; }
.overlay-hint { font-size: 8px; color: var(--tetris-text-muted); text-shadow: 1px 1px 0 #0b0616; }
@keyframes tetris-blink { 50% { opacity: .45; } }
@media (prefers-reduced-motion: reduce) { .play-button, .tetris-newbest { animation: none; } }
@media (max-height: 480px) { .tetris-overlay > .tetris-box { gap: 4px; padding: 8px; } .overlay-hint { display: none; } }
</style>

