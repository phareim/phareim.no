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
      <span class="tetris-gameover">READY?</span>
      <button class="play-button" @click.stop="start">▶ {{ hint('PRESS ENTER', 'TAP TO PLAY') }} ◀</button>
      <span class="overlay-hint">{{ hint('ARROWS MOVE · ↑ ROTATE', 'DRAG TO MOVE · TAP TO ROTATE') }}</span>
    </div>
    <div v-else-if="phase === 'over'" class="tetris-overlay tetris-overlay-over">
      <span class="tetris-gameover">GAME OVER</span>
      <span>SCORE {{ scoreText }}</span>
      <span v-if="newBest" class="tetris-newbest">NEW BEST</span>
      <span v-else>BEST {{ bestText }}</span>
      <button class="play-button" @click.stop="start">▶ {{ hint('ENTER TO RETRY', 'TAP TO RETRY') }} ◀</button>
    </div>
    <div v-else-if="phase === 'paused'" class="tetris-overlay tetris-overlay-paused">
      <span>PAUSED</span>
      <button class="play-button" @click.stop="togglePause">▶ {{ hint('P TO RESUME', 'RESUME') }} ◀</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { TetrisGesture } from './gestures'
import { PIECE_SHAPES, TetrisEngine, type EngineEvent, type PieceType } from './engine'

const { navigationLocked } = useTheme()
const { hint } = useInputMode()

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
}>()

const COLS = 10
const ROWS = 20
const WELL_BG = '#090512'
const GRID_LINE = 'rgba(47, 243, 255, 0.055)'
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
const newBest = ref(false)
const levelUpUntil = ref(0)
const nextPiece = ref<PieceType | null>(null)
const holdPieceRef = ref<PieceType | null>(null)
const canHoldRef = ref(true)

const scoreText = computed(() => String(score.value).padStart(6, '0'))
const bestText = computed(() => String(best.value).padStart(6, '0'))
const boardW = computed(() => COLS * props.cellSize)
const boardH = computed(() => ROWS * props.cellSize)

let engine: TetrisEngine | null = null
let ctx: CanvasRenderingContext2D | null = null
let rafId = 0
let lastT = 0
let running = false
let mounted = false
let dirty = true
let lastEmitKey = ''
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
const sprites = new Map<PieceType, HTMLCanvasElement>()
const activeSprites = new Map<PieceType, HTMLCanvasElement>()
const PIECE_KEYS: PieceType[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L']

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
  if (e.type === 'lock') emit('beat', false)
  if (e.type === 'lock' || e.type === 'score') {
    syncHud()
    return
  }
  if (e.type === 'clear') {
    emit('beat', true)
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
    syncHud()
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
  emit('started')
}

function move(dx: -1 | 1): void {
  if (phase.value !== 'playing' || !engine) return
  engine.move(dx)
  syncHud()
}

function pressDir(dir: -1 | 1): void {
  if (phase.value !== 'playing' || !engine) return
  engine.move(dir)
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
  engine.softDrop()
  syncHud()
}

function softDropStop(): void {
  softActive = false
  softAcc = 0
}

function hardDrop(): void {
  if (phase.value !== 'playing' || !engine) return
  engine.hardDrop()
  syncHud()
}

function rotate(dir: 1 | -1): void {
  if (phase.value !== 'playing' || !engine) return
  engine.rotate(dir)
  syncHud()
}

function hold(): void {
  if (phase.value !== 'playing' || !engine) return
  engine.holdPiece()
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
  } else if (phase.value === 'paused') {
    phase.value = 'playing'
    lastT = 0
    dirty = true
    maybeEmit()
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
  emit('exit')
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
    if (phase.value === 'playing' || phase.value === 'paused' || phase.value === 'over') exit()
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
  gesture = new TetrisGesture(t.clientX, t.clientY, performance.now(), props.cellSize)
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
  for (let i = 0; i < Math.abs(action.horizontal); i++) engine.move(action.horizontal > 0 ? 1 : -1)
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

function dpr(): number {
  return Math.min(2, window.devicePixelRatio || 1)
}

function setupCanvas(): void {
  const canvas = canvasRef.value
  if (!canvas) return
  const d = dpr()
  canvas.width = Math.round(boardW.value * d)
  canvas.height = Math.round(boardH.value * d)
  canvas.style.width = boardW.value + 'px'
  canvas.style.height = boardH.value + 'px'
  const c = canvas.getContext('2d')
  ctx = c
}

function drawBlockSprite(type: PieceType, active: boolean): HTMLCanvasElement {
  const cs = props.cellSize
  const d = dpr()
  const px = Math.max(2, Math.round(cs * d))
  const el = document.createElement('canvas')
  el.width = px
  el.height = px
  const g = el.getContext('2d') as CanvasRenderingContext2D
  const tints: Record<PieceType, string> = { I: '#ff2fa0', O: '#ff91ce', T: '#ff52b0', S: '#ce2682', Z: '#ff70be', J: '#e62b91', L: '#ed82bf' }
  const color = active ? '#2ff3ff' : tints[type]
  const inset = Math.max(2, px * .1)
  g.fillStyle = active ? '#2ff3ff25' : color + '44'
  g.fillRect(inset, inset, px - inset * 2, px - inset * 2)
  g.strokeStyle = color
  g.lineWidth = Math.max(1, d)
  g.shadowColor = color
  g.shadowBlur = px * .2
  g.strokeRect(inset, inset, px - inset * 2, px - inset * 2)
  g.shadowBlur = 0
  g.strokeRect(inset, inset, px - inset * 2, px - inset * 2)
  return el
}

function buildSprites(): void {
  sprites.clear()
  activeSprites.clear()
  for (const t of PIECE_KEYS) { sprites.set(t, drawBlockSprite(t, false)); activeSprites.set(t, drawBlockSprite(t, true)) }
}

function blit(type: PieceType, col: number, row: number, active = false): void {
  if (!ctx) return
  const s = (active ? activeSprites : sprites).get(type)
  if (!s) return
  ctx.drawImage(s, col * props.cellSize, row * props.cellSize, props.cellSize, props.cellSize)
}

function blitGhost(type: PieceType, col: number, row: number): void {
  if (!ctx) return
  const cs = props.cellSize
  ctx.globalAlpha = 0.4
  ctx.strokeStyle = '#2ff3ff'
  ctx.lineWidth = 2
  ctx.strokeRect(col * cs + 1.5, row * cs + 1.5, cs - 3, cs - 3)
  ctx.globalAlpha = 1
}

function draw(): void {
  if (!ctx || !engine) return
  const cs = props.cellSize
  const d = dpr()
  ctx.setTransform(d, 0, 0, d, 0, 0)
  ctx.fillStyle = WELL_BG
  ctx.fillRect(0, 0, boardW.value, boardH.value)
  ctx.strokeStyle = GRID_LINE
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let c = 1; c < COLS; c++) {
    ctx.moveTo(c * cs + 0.5, 0)
    ctx.lineTo(c * cs + 0.5, boardH.value)
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.moveTo(0, r * cs + 0.5)
    ctx.lineTo(boardW.value, r * cs + 0.5)
  }
  ctx.stroke()
  if (phase.value === 'idle') {
    for (let r = 0; r < ROWS; r++) {
      const row = idleBoard[r]
      if (!row) continue
      for (let c = 0; c < COLS; c++) {
        const v = row[c]
        if (v !== null && v !== undefined) blit(v as PieceType, c, r)
      }
    }
    if (idlePiece && !reducedMotion) {
      ctx.globalAlpha = 0.4
      PIECE_SHAPES[idlePiece.type][0].forEach((row, y) => row.forEach((v, x) => {
        if (v) blit(idlePiece!.type, idlePiece!.x + x, idlePiece!.y + y, true)
      }))
      ctx.globalAlpha = 1
    }
    return
  }
  for (let r = 0; r < ROWS; r++) {
    const row = engine.board[r] as (PieceType | null)[]
    if (!row) continue
    for (let c = 0; c < COLS; c++) {
      const v = row[c]
      if (v !== null && v !== undefined) blit(v as PieceType, c, r)
    }
  }
  if (engine.pendingClear.length > 0) {
    ctx.fillStyle = 'rgba(255, 210, 63, 0.85)'
    for (const r of engine.pendingClear) ctx.fillRect(0, r * cs, boardW.value, cs)
  }
  const a = engine.active
  if (a && phase.value !== 'over') {
    const gy = engine.ghostY()
    if (gy !== a.y) {
      for (const cell of engine.cells()) {
        const gr = cell.y + (gy - a.y)
        if (gr >= 0) blitGhost(cell.type, cell.x, gr)
      }
    }
    for (const cell of engine.cells()) {
      if (cell.y >= 0) blit(cell.type, cell.x, cell.y, true)
    }
  }
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
  if (phase.value === 'playing' || dirty) {
    draw()
    dirty = false
    syncHudLight()
    maybeEmit()
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
  buildSprites()
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
  buildSprites()
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
.tetris-game { position: relative; flex: 0 0 auto; border: 1px solid #2ff3ff70; border-radius: 4px; overflow: hidden; background: #090512; box-shadow: 0 0 20px #2ff3ff12, 0 0 40px #ff2fa010; touch-action: none; user-select: none; -webkit-user-select: none; }
.tetris-board { display: block; }
.tetris-overlay { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; padding: 8px; text-align: center; font: 12px/1.6 'Courier New', monospace; letter-spacing: .12em; color: var(--tetris-text); background: #0b0616d9; }
.tetris-gameover { font-size: clamp(18px, 3vw, 30px); color: var(--tetris-pink); text-shadow: 0 0 12px #ff2fa080; }
.tetris-newbest { color: var(--tetris-gold); }
.play-button { min-height: 44px; padding: 10px 6px; background: #ff2fa018; border: 1px solid #ff2fa060; border-radius: 4px; color: var(--tetris-pink); font: inherit; font-size: 11px; letter-spacing: .08em; cursor: pointer; }
.play-button:focus-visible { outline: 2px solid var(--tetris-accent); outline-offset: 2px; }
.overlay-hint { font-size: 9px; letter-spacing: .04em; color: var(--tetris-text-muted); }
@media (max-height: 480px) { .tetris-overlay { gap: 4px; font-size: 10px; } .overlay-hint { display: none; } }
</style>
