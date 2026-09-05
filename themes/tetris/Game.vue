<template>
  <div
    class="tetris-game"
    :style="{ width: boardW + 'px', height: boardH + 'px' }"
    @click="onTap"
  >
    <canvas ref="canvasRef" class="tetris-board" />
    <div v-if="phase === 'idle'" class="tetris-overlay tetris-overlay-idle">
      <span>PRESS ENTER</span>
      <span>TAP TO PLAY</span>
    </div>
    <div v-else-if="phase === 'over'" class="tetris-overlay tetris-overlay-over">
      <span class="tetris-gameover">GAME OVER</span>
      <span>SCORE {{ scoreText }}</span>
      <span v-if="newBest" class="tetris-newbest">NEW BEST</span>
      <span v-else>BEST {{ bestText }}</span>
      <span>PRESS ENTER OR TAP TO RETRY</span>
    </div>
    <div v-else-if="phase === 'paused'" class="tetris-overlay tetris-overlay-paused">
      <span>PAUSED</span>
      <span>PRESS P OR TAP TO RESUME</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PIECE_COLORS, TetrisEngine, type EngineEvent, type PieceType } from './engine'

const { navigationLocked } = useTheme()

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
}>()

const COLS = 10
const ROWS = 20
const WELL_BG = '#0D0B26'
const GRID_LINE = 'rgba(255, 255, 255, 0.05)'
const DAS_MS = 150
const ARR_MS = 40
const SOFT_MS = 40
const CLEAR_FLASH_MS = 150
const IDLE_STEP_MS = 900
const BEST_KEY = 'tetrisHighScore'

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
  if (e.type === 'lock' || e.type === 'score') {
    syncHud()
    return
  }
  if (e.type === 'clear') {
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
  // 2x2 block approximation for the demo piece
  const cells = [[0, 0], [1, 0], [0, 1], [1, 1]]
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
  if (isInteractiveElement(e.target)) return
  if (phase.value === 'idle' || phase.value === 'over') start()
  else if (phase.value === 'paused') togglePause()
}

function handleKeyDown(e: KeyboardEvent): void {
  if (isEditableTarget(e.target)) return
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

// --- canvas touch gestures (board only) ---
let touchId: number | null = null
let touchSX = 0
let touchSY = 0
let touchST = 0
let touchAppliedX = 0
let touchLastY = 0
let touchLastT = 0
let touchVelY = 0
let touchSoft = false

function findTouch(e: TouchEvent): Touch | null {
  for (let i = 0; i < e.changedTouches.length; i++) {
    const t = e.changedTouches[i] as Touch
    if (t.identifier === touchId) return t
  }
  return null
}

function onTouchStart(e: TouchEvent): void {
  if (phase.value !== 'playing') return
  e.preventDefault()
  const t = e.changedTouches[0] as Touch
  touchId = t.identifier
  touchSX = t.clientX
  touchSY = t.clientY
  touchST = performance.now()
  touchAppliedX = 0
  touchLastY = t.clientY
  touchLastT = touchST
  touchVelY = 0
  touchSoft = false
}

function onTouchMove(e: TouchEvent): void {
  if (touchId === null || phase.value !== 'playing' || !engine) return
  const t = findTouch(e)
  if (!t) return
  e.preventDefault()
  const need = Math.trunc((t.clientX - touchSX) / 24)
  const d = need - touchAppliedX
  if (d !== 0) {
    const step = d > 0 ? 1 : -1
    for (let i = 0; i < Math.abs(d); i++) engine.move(step as -1 | 1)
    touchAppliedX = need
    dirty = true
  }
  const now = performance.now()
  const dt = Math.max(1, now - touchLastT)
  const vy = ((t.clientY - touchLastY) / dt) * 1000
  touchVelY = touchVelY * 0.8 + vy * 0.2
  touchLastY = t.clientY
  touchLastT = now
  if (t.clientY - touchSY > 24 && !touchSoft) {
    touchSoft = true
    softDropStart()
  }
}

function onTouchEnd(e: TouchEvent): void {
  if (touchId === null) return
  const t = findTouch(e)
  if (touchSoft) {
    softDropStop()
    touchSoft = false
  }
  if (t && phase.value === 'playing') {
    const dur = performance.now() - touchST
    const dx = t.clientX - touchSX
    const dy = t.clientY - touchSY
    if (touchVelY > 600 && dy > 40) hardDrop()
    else if (Math.hypot(dx, dy) < 10 && dur < 250) rotate(1)
  }
  touchId = null
}

function onTouchCancel(e: TouchEvent): void {
  if (findTouch(e) === null && touchId !== null) return
  if (touchSoft) {
    softDropStop()
    touchSoft = false
  }
  touchId = null
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

function drawBlockSprite(type: PieceType, ghost: boolean): HTMLCanvasElement {
  const cs = props.cellSize
  const d = dpr()
  const px = Math.max(2, Math.round(cs * d))
  const el = document.createElement('canvas')
  el.width = px
  el.height = px
  const g = el.getContext('2d') as CanvasRenderingContext2D
  const color = PIECE_COLORS[type]
  if (ghost) {
    g.globalAlpha = 0.4
    g.strokeStyle = color
    g.lineWidth = Math.max(1, Math.round(px / 13))
    const inset = g.lineWidth
    g.strokeRect(inset / 2 + 0.5, inset / 2 + 0.5, px - inset - 1, px - inset - 1)
    g.globalAlpha = 1
    return el
  }
  g.fillStyle = color
  g.fillRect(0, 0, px, px)
  g.strokeStyle = 'rgba(0, 0, 0, 0.55)'
  g.lineWidth = 1
  g.strokeRect(0.5, 0.5, px - 1, px - 1)
  const edge = Math.max(1, Math.round(px * 0.09))
  g.fillStyle = 'rgba(255, 255, 255, 0.35)'
  g.fillRect(edge, edge, px - edge * 2, edge)
  g.fillRect(edge, edge, edge, px - edge * 2)
  g.fillStyle = 'rgba(0, 0, 0, 0.3)'
  g.fillRect(edge, px - edge * 2, px - edge * 2, edge)
  g.fillRect(px - edge * 2, edge, edge, px - edge * 2)
  return el
}

function buildSprites(): void {
  sprites.clear()
  for (const t of PIECE_KEYS) sprites.set(t, drawBlockSprite(t, false))
}

function blit(type: PieceType, col: number, row: number): void {
  if (!ctx) return
  const s = sprites.get(type)
  if (!s) return
  ctx.drawImage(s, col * props.cellSize, row * props.cellSize, props.cellSize, props.cellSize)
}

function blitGhost(type: PieceType, col: number, row: number): void {
  if (!ctx) return
  const cs = props.cellSize
  ctx.globalAlpha = 0.4
  ctx.strokeStyle = PIECE_COLORS[type]
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
      blit(idlePiece.type, idlePiece.x, idlePiece.y)
      blit(idlePiece.type, idlePiece.x + 1, idlePiece.y)
      blit(idlePiece.type, idlePiece.x, idlePiece.y + 1)
      blit(idlePiece.type, idlePiece.x + 1, idlePiece.y + 1)
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
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
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
      if (cell.y >= 0) blit(cell.type, cell.x, cell.y)
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
  const canvas = canvasRef.value
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('blur', onBlur)
  if (canvas) {
    canvas.addEventListener('touchstart', onTouchStart, { passive: false })
    canvas.addEventListener('touchmove', onTouchMove, { passive: false })
    canvas.addEventListener('touchend', onTouchEnd)
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
  const canvas = canvasRef.value
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
.tetris-game {
  position: relative;
  display: inline-block;
  border: 2px solid #3B3470;
  border-radius: 6px;
  overflow: hidden;
  background: #0D0B26;
}
.tetris-board {
  display: block;
  touch-action: none;
}
.tetris-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 16px;
  text-align: center;
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 10px;
  line-height: 1.6;
  color: #F4F1FF;
  background: rgba(13, 11, 38, 0.72);
}
.tetris-overlay-idle {
  color: #F4F1FF;
  opacity: 1;
}
.tetris-gameover {
  font-size: 16px;
  color: #FF3B5C;
}
.tetris-newbest {
  color: #29D3E0;
}
.tetris-overlay-paused {
  color: #FFD500;
}
</style>
