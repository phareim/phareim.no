<template>
  <div class="tetris-arcade">
    <!-- HUD strip (mobile only, under 900px): SCORE · LINES · LEVEL -->
    <div class="hud-strip">
      <div class="hud-strip-item">
        <span class="hud-strip-label">SCORE</span>
        <span class="hud-strip-value">{{ formatScore(tetrisState.score) }}</span>
      </div>
      <div class="hud-strip-item">
        <span class="hud-strip-label">LINES</span>
        <span class="hud-strip-value">{{ formatLines(tetrisState.lines) }}</span>
      </div>
      <div class="hud-strip-item">
        <span class="hud-strip-label">LEVEL</span>
        <span class="hud-strip-value" :class="{ 'level-up': isLevelingUp }">{{ formatLevel(tetrisState.level) }}</span>
      </div>
    </div>

    <div class="arcade-cluster">
      <!-- HOLD tile -->
      <div class="preview-panel hold-panel">
        <div class="preview-label">HOLD</div>
        <div class="preview-grid">
          <template v-for="row in 4" :key="`hold-row-${row}`">
            <span
              v-for="col in 4"
              :key="`hold-${row}-${col}`"
              class="preview-cell"
              :style="getHoldCellStyle(row - 1, col - 1)"
            />
          </template>
        </div>
      </div>

      <!-- Game board -->
      <div class="game-wrapper">
        <TetrisGame
          ref="gameRef"
          :cell-size="cellSize"
          @state="onGameState"
        />
      </div>

      <!-- NEXT tile -->
      <div class="preview-panel next-panel">
        <div class="preview-label">NEXT</div>
        <div class="preview-grid">
          <template v-for="row in 4" :key="`next-row-${row}`">
            <span
              v-for="col in 4"
              :key="`next-${row}-${col}`"
              class="preview-cell"
              :style="getNextCellStyle(row - 1, col - 1)"
            />
          </template>
        </div>
      </div>

      <!-- HUD column -->
      <div class="hud-column">
        <div class="hud-row">
          <div class="hud-label">SCORE</div>
          <div class="hud-value">{{ formatScore(tetrisState.score) }}</div>
        </div>
        <div class="hud-row">
          <div class="hud-label">LINES</div>
          <div class="hud-value">{{ formatLines(tetrisState.lines) }}</div>
        </div>
        <div class="hud-row">
          <div class="hud-label">LEVEL</div>
          <div class="hud-value" :class="{ 'level-up': isLevelingUp }">{{ formatLevel(tetrisState.level) }}</div>
        </div>
        <div class="hud-row">
          <div class="hud-label">BEST</div>
          <div class="hud-value">{{ formatScore(tetrisState.best) }}</div>
        </div>
      </div>
    </div>

    <!-- Touch controls: HOLD/NEXT mini tiles beside the buttons (mobile only) -->
    <div class="control-row">
      <div class="mobile-previews">
        <div class="preview-panel mobile-hold hud-strip-preview-item">
          <div class="preview-label">HOLD</div>
          <div class="preview-grid mobile-grid">
            <template v-for="row in 4" :key="`hold-row-${row}`">
              <span
                v-for="col in 4"
                :key="`hold-${row}-${col}`"
                class="preview-cell"
                :style="getHoldCellStyle(row - 1, col - 1)"
              />
            </template>
          </div>
        </div>
        <div class="preview-panel mobile-next hud-strip-preview-item">
          <div class="preview-label">NEXT</div>
          <div class="preview-grid mobile-grid">
            <template v-for="row in 4" :key="`next-row-${row}`">
              <span
                v-for="col in 4"
                :key="`next-${row}-${col}`"
                class="preview-cell"
                :style="getNextCellStyle(row - 1, col - 1)"
              />
            </template>
          </div>
        </div>
      </div>
      <div class="touch-buttons">
        <button
          class="touch-btn left-btn"
          @touchstart="onTouchButtonStart('left')"
          @touchend="onTouchButtonEnd"
          @touchcancel="onTouchButtonEnd"
          aria-label="Move left"
        >
          ◀
        </button>
        <button
          class="touch-btn right-btn"
          @touchstart="onTouchButtonStart('right')"
          @touchend="onTouchButtonEnd"
          @touchcancel="onTouchButtonEnd"
          aria-label="Move right"
        >
          ▶
        </button>
        <button
          class="touch-btn down-btn"
          @touchstart="onTouchButtonStart('down')"
          @touchend="onTouchButtonEnd"
          @touchcancel="onTouchButtonEnd"
          aria-label="Soft drop"
        >
          ▼
        </button>
        <button
          class="touch-btn rotate-btn"
          @click="onRotateClick"
          aria-label="Rotate"
        >
          ⟳
        </button>
        <button
          class="touch-btn hard-drop-btn"
          @click="onHardDropClick"
          aria-label="Hard drop"
        >
          ⤓
        </button>
        <button
          class="touch-btn hold-btn"
          @click="onHoldClick"
          aria-label="Hold piece"
        >
          HOLD
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import TetrisGame from './Game.vue'
import type { TetrisState } from './Game.vue'
import { PIECE_COLORS, PIECE_SHAPES, type PieceType } from './engine'

const gameRef = ref()
const cellSize = ref(26)
const tetrisState = ref<TetrisState>({
  phase: 'idle',
  score: 0,
  lines: 0,
  level: 1,
  best: 0,
  next: null,
  hold: null,
  canHold: true,
  newBest: false,
  levelUpUntil: 0
})

const isLevelingUp = ref(false)
let levelUpTimeout: ReturnType<typeof setTimeout> | null = null

const touchButtonHeldKey = ref<string | null>(null)
let touchButtonInterval: ReturnType<typeof setInterval> | null = null
let touchButtonTimeout: ReturnType<typeof setTimeout> | null = null

const emit = defineEmits<{
  state: [value: TetrisState]
}>()

const calculateCellSize = () => {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  if (vw >= 900) {
    // Desktop: fixed 26px
    cellSize.value = 26
  } else {
    // Mobile formula: floor(min((innerWidth - 32) / 10, (innerHeight - 300) / 20))
    const fromWidth = Math.floor((vw - 32) / 10)
    const fromHeight = Math.floor((vh - 300) / 20)
    const size = Math.min(fromWidth, fromHeight)
    cellSize.value = Math.max(14, Math.min(26, size))
  }
}

const onGameState = (state: TetrisState) => {
  tetrisState.value = state
  emit('state', state)
}

const formatScore = (score: number) => {
  return String(score).padStart(6, '0')
}

const formatLines = (lines: number) => {
  return String(lines).padStart(2, '0')
}

const formatLevel = (level: number) => {
  return String(level).padStart(2, '0')
}

const getHoldPieceShape = (): number[][] | null => {
  if (!tetrisState.value.hold) return null
  const piece = tetrisState.value.hold
  const shape = PIECE_SHAPES[piece][0]
  return shape
}

const getNextPieceShape = (): number[][] | null => {
  if (!tetrisState.value.next) return null
  const piece = tetrisState.value.next
  const shape = PIECE_SHAPES[piece][0]
  return shape
}

const getHoldCellStyle = (row: number, col: number) => {
  const shape = getHoldPieceShape()
  if (!shape || !tetrisState.value.hold) return {}

  // Offset to center the piece in the 4x4 grid
  const offset = Math.floor((4 - shape.length) / 2)
  const adjustedRow = row - offset
  const adjustedCol = col - offset

  const isActive = shape[adjustedRow]?.[adjustedCol] === 1
  const piece = tetrisState.value.hold
  const color = PIECE_COLORS[piece]
  const opacity = 0.4

  if (!isActive) return {}

  return {
    backgroundColor: color,
    opacity: String(opacity),
    boxShadow: `
      inset 2px 2px 0 rgba(255,255,255,0.35),
      inset -2px -2px 0 rgba(0,0,0,0.3),
      0 0 0 1px rgba(0,0,0,0.55)
    `
  }
}

const getNextCellStyle = (row: number, col: number) => {
  const shape = getNextPieceShape()
  if (!shape || !tetrisState.value.next) return {}

  // Offset to center the piece in the 4x4 grid
  const offset = Math.floor((4 - shape.length) / 2)
  const adjustedRow = row - offset
  const adjustedCol = col - offset

  const isActive = shape[adjustedRow]?.[adjustedCol] === 1
  const piece = tetrisState.value.next
  const color = PIECE_COLORS[piece]

  if (!isActive) return {}

  return {
    backgroundColor: color,
    boxShadow: `
      inset 2px 2px 0 rgba(255,255,255,0.35),
      inset -2px -2px 0 rgba(0,0,0,0.3),
      0 0 0 1px rgba(0,0,0,0.55)
    `
  }
}

const onTouchButtonStart = (button: string) => {
  if (touchButtonHeldKey.value !== null) return

  touchButtonHeldKey.value = button

  if (button === 'down') {
    // Soft drop
    gameRef.value?.softDropStart?.()
  } else if (button === 'left' || button === 'right') {
    // Move left/right
    const dx = button === 'left' ? -1 : 1
    gameRef.value?.move?.(dx)

    // DAS 150ms, ARR 40ms repeat
    touchButtonTimeout = setTimeout(() => {
      if (touchButtonHeldKey.value === button) {
        touchButtonInterval = setInterval(() => {
          if (touchButtonHeldKey.value === button) {
            gameRef.value?.move?.(dx)
          }
        }, 40)
      }
    }, 150)
  }
}

const onTouchButtonEnd = () => {
  if (touchButtonHeldKey.value === 'down') {
    gameRef.value?.softDropStop?.()
  }
  
  if (touchButtonTimeout) {
    clearTimeout(touchButtonTimeout)
    touchButtonTimeout = null
  }
  if (touchButtonInterval) {
    clearInterval(touchButtonInterval)
    touchButtonInterval = null
  }
  touchButtonHeldKey.value = null
}

const onRotateClick = () => {
  gameRef.value?.rotate?.(1)
}

const onHardDropClick = () => {
  gameRef.value?.hardDrop?.()
}

const onHoldClick = () => {
  gameRef.value?.hold?.()
}

watch(() => tetrisState.value.levelUpUntil, (newVal) => {
  if (levelUpTimeout) {
    clearTimeout(levelUpTimeout)
    levelUpTimeout = null
  }
  
  if (newVal > Date.now()) {
    isLevelingUp.value = true
    const delay = newVal - Date.now()
    levelUpTimeout = setTimeout(() => {
      isLevelingUp.value = false
    }, delay)
  }
})

onMounted(() => {
  calculateCellSize()
  window.addEventListener('resize', calculateCellSize)
  window.addEventListener('orientationchange', calculateCellSize)
})

onUnmounted(() => {
  window.removeEventListener('resize', calculateCellSize)
  window.removeEventListener('orientationchange', calculateCellSize)
  if (levelUpTimeout) {
    clearTimeout(levelUpTimeout)
  }
  if (touchButtonTimeout) {
    clearTimeout(touchButtonTimeout)
  }
  if (touchButtonInterval) {
    clearInterval(touchButtonInterval)
  }
})
</script>

<style scoped>
.tetris-arcade {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

@media (min-width: 900px) {
  .tetris-arcade {
    flex-direction: row;
    justify-content: center;
    gap: 48px;
    width: auto;
    flex: 0 0 auto;
  }
}

.arcade-cluster {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  align-items: start;
  width: 100%;
}

@media (min-width: 900px) {
  .arcade-cluster {
    grid-template-columns: auto auto auto auto;
    gap: 24px;
  }
}

.game-wrapper {
  display: flex;
  justify-content: center;
}

.preview-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

.preview-label {
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 10px;
  color: var(--theme-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.preview-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 2px;
  padding: 6px;
  background: var(--tetris-well-bg, #0d0b26);
  border: 2px solid var(--theme-card-border);
  border-radius: 4px;
}

.preview-cell {
  display: block;
  width: 16px;
  height: 16px;
  aspect-ratio: 1;
  background: rgba(0, 0, 0, 0.2);
  border: none;
  border-radius: 1px;
}

.hold-panel {
  display: none;
}

@media (min-width: 900px) {
  .hold-panel {
    display: flex;
  }
}

.next-panel {
  display: none;
}

@media (min-width: 900px) {
  .next-panel {
    display: flex;
  }
}

.hud-column {
  display: none;
  flex-direction: column;
  gap: 8px;
  font-family: 'Press Start 2P', 'Courier New', monospace;
}

@media (min-width: 900px) {
  .hud-column {
    display: flex;
  }
}

.hud-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: flex-start;
}

.hud-label {
  font-size: 10px;
  color: var(--theme-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.hud-value {
  font-size: 14px;
  color: var(--theme-text);
  font-variant-numeric: tabular-nums;
}

.level-up {
  color: var(--tetris-accent-secondary, #29d3e0);
}

.hud-strip {
  display: flex;
  gap: 16px;
  justify-content: center;
  align-items: center;
  flex-wrap: wrap;
  width: 100%;
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 10px;
}

@media (min-width: 900px) {
  .hud-strip {
    display: none;
  }
}

.hud-strip-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.hud-strip-label {
  color: var(--theme-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-size: 10px;
}

.hud-strip-value {
  color: var(--theme-text);
  font-variant-numeric: tabular-nums;
  font-size: 14px;
}

.control-row {
  display: flex;
  flex-direction: row;
  gap: 8px;
  width: 100%;
  align-items: center;
  justify-content: center;
}

@media (min-width: 900px) {
  .control-row {
    display: none;
  }
}

.mobile-previews {
  display: flex;
  gap: 8px;
  justify-content: center;
  align-items: center;
  width: auto;
  flex: 0 0 auto;
}

.hud-strip-preview-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
}

.mobile-previews .preview-label {
  font-size: 8px;
}

.mobile-hold,
.mobile-next {
  display: flex;
}

.mobile-grid {
  padding: 4px;
  gap: 1px;
}

.mobile-grid .preview-cell {
  width: 6px;
  height: 6px;
}

.touch-buttons {
  display: none;
  gap: 4px;
  justify-content: center;
  width: auto;
  flex: 1 1 auto;
  min-width: 0;
  padding: 0 0 calc(4px + env(safe-area-inset-bottom, 0px));
  flex-wrap: nowrap;
}

@media (pointer: coarse) {
  .touch-buttons {
    display: flex;
  }
}

.touch-btn {
  flex: 1 1 0;
  min-width: 0;
  max-width: 48px;
  width: 46px;
  height: 48px;
  padding: 0;
  background: var(--theme-card-bg);
  border: 2px solid var(--theme-card-border);
  border-radius: 4px;
  color: var(--theme-text);
  font-family: 'Press Start 2P', 'Courier New', monospace;
  font-size: 16px;
  cursor: pointer;
  user-select: none;
  transition: all 80ms linear;
}

.touch-btn:active {
  border-color: var(--theme-accent);
  background: var(--theme-accent);
  color: var(--theme-bg);
  transform: translateY(2px);
}

.hold-btn {
  font-size: 8px;
  padding: 0;
}
</style>
