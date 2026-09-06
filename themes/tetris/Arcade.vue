<template>
  <section class="tetris-arcade" aria-label="Tetris arcade">
    <header class="arcade-header">
      <div><span class="eyebrow">NEON DREAMS</span><h2>TETRIS</h2></div>
      <button v-if="inRun" class="arcade-button pause-button" @click="gameRef?.togglePause()">{{ paused ? 'RESUME' : 'PAUSE' }}</button>
      <span v-else class="eyebrow">{{ tetrisState.phase === 'over' ? 'TRY AGAIN' : 'ENDLESS PLAY' }}</span>
    </header>
    <div class="score-strip">
      <div><span>SCORE</span><strong>{{ String(tetrisState.score).padStart(6, '0') }}</strong></div>
      <div><span>LINES</span><strong>{{ String(tetrisState.lines).padStart(2, '0') }}</strong></div>
      <div><span>LEVEL</span><strong>{{ String(tetrisState.level).padStart(2, '0') }}</strong></div>
    </div>
    <div ref="playArea" class="play-area">
      <div class="game-wrapper"><TetrisGame ref="gameRef" :cell-size="cellSize" @state="onGameState" @beat="emit('beat', $event)" /></div>
      <aside class="side-rail">
        <div class="preview-panel">
          <span class="eyebrow">NEXT</span>
          <div class="preview-grid" :aria-label="`Next piece: ${tetrisState.next ?? 'none'}`"><span v-for="i in 16" :key="i" :style="previewStyle(tetrisState.next, i - 1)" /></div>
        </div>
        <button class="preview-panel hold-button arcade-button" :disabled="!playing || !tetrisState.canHold" aria-label="Hold piece" @click="gameRef?.hold()">
          <span class="eyebrow">HOLD</span>
          <div class="preview-grid" aria-hidden="true"><span v-for="i in 16" :key="i" :style="previewStyle(tetrisState.hold, i - 1)" /></div>
          <span class="rail-hint">{{ tetrisState.canHold ? hint('C · SHIFT', 'TAP') : 'USED' }}</span>
        </button>
        <div class="best-panel"><span class="eyebrow">BEST</span><strong>{{ tetrisState.best }}</strong></div>
        <button v-if="inRun" class="arcade-button exit-button" @click="gameRef?.exit()">EXIT</button>
      </aside>
    </div>
    <div class="action-row">
      <button class="arcade-button" :disabled="!playing" aria-label="Rotate piece" @click="gameRef?.rotate(1)"><b>↻</b> ROTATE</button>
      <button class="arcade-button drop-button" :disabled="!playing" aria-label="Hard drop" @click="gameRef?.hardDrop()"><b>↓</b> DROP</button>
    </div>
    <p class="control-hint">{{ hint('← → MOVE · ↑ ROTATE · ↓ SOFT DROP', 'DRAG ↔ MOVE · TAP ROTATE') }}<br><span>{{ hint('SPACE DROP · C HOLD · P PAUSE · ESC EXIT', 'FLICK ↓ DROP · DRAG ↓ LOWER · SWIPE ↑ HOLD') }}</span></p>
  </section>
</template>

<script setup lang="ts">
import TetrisGame, { type TetrisState } from './Game.vue'
import { PIECE_SHAPES, type PieceType } from './engine'
const { hint } = useInputMode()
const emit = defineEmits<{ state: [value: TetrisState], beat: [clear: boolean] }>()
const gameRef = ref<InstanceType<typeof TetrisGame> | null>(null)
const playArea = ref<HTMLElement | null>(null)
const cellSize = ref(18)
const tetrisState = ref<TetrisState>({ phase: 'idle', score: 0, lines: 0, level: 1, best: 0, next: null, hold: null, canHold: true, newBest: false, levelUpUntil: 0 })
const playing = computed(() => tetrisState.value.phase === 'playing')
const paused = computed(() => tetrisState.value.phase === 'paused')
const inRun = computed(() => playing.value || paused.value)
function onGameState(state: TetrisState) { tetrisState.value = state; emit('state', state) }
function previewStyle(piece: PieceType | null, index: number) {
  if (!piece) return {}
  const shape = PIECE_SHAPES[piece][0]
  const offset = Math.floor((4 - shape.length) / 2)
  if (shape[Math.floor(index / 4) - offset]?.[index % 4 - offset] !== 1) return {}
  return { background: '#2ff3ff33', borderColor: '#2ff3ff', boxShadow: '0 0 6px #2ff3ff55' }
}
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    // The layout owns the available space, including safe areas and the profile.
    cellSize.value = Math.max(4, Math.min(28, Math.floor(Math.min((entry.contentRect.width - 90) / 10, (entry.contentRect.height - 2) / 20))))
  })
  if (playArea.value) observer.observe(playArea.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
.tetris-arcade { width: min(100%, 430px); min-height: 0; flex: 1; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto auto; gap: 10px; color: var(--tetris-text); font: 12px 'Courier New', monospace; letter-spacing: .15em; }
.arcade-header { display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
h2 { margin: 2px 0 0; font-size: 26px; line-height: 1; letter-spacing: .16em; color: var(--tetris-pink); text-shadow: 0 0 12px #ff2fa080, 0 0 32px #ff2fa040; }
.eyebrow { font-size: 10px; color: var(--tetris-text-muted); }
.score-strip { display: flex; justify-content: space-between; padding: 9px 12px; border-block: 1px solid #ff2fa040; background: #0b0616bd; }
.score-strip div { display: grid; gap: 3px; }
.score-strip span { font-size: 9px; color: var(--tetris-text-muted); }
strong { font-size: 19px; font-weight: normal; color: var(--tetris-accent); font-variant-numeric: tabular-nums; letter-spacing: .06em; text-shadow: 0 0 8px #2ff3ff65; }
.play-area { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 76px; gap: 12px; }
.game-wrapper { min-height: 0; display: flex; justify-content: center; align-items: center; }
.side-rail { display: flex; flex-direction: column; gap: 12px; }
.preview-panel { display: grid; justify-items: center; gap: 6px; padding: 10px 4px; background: #0b0616bd; border: 1px solid #2ff3ff30; border-radius: 4px; }
.preview-grid { display: grid; grid-template-columns: repeat(4, 11px); grid-template-rows: repeat(4, 11px); gap: 2px; }
.preview-grid span { border: 1px solid transparent; border-radius: 1px; }
.rail-hint { font-size: 8px; letter-spacing: .06em; }
.best-panel { display: grid; gap: 6px; text-align: center; }
.best-panel strong { color: var(--tetris-gold); font-size: 14px; text-shadow: none; }
.arcade-button { min-height: 44px; padding: 8px 12px; border: 1px solid #2ff3ff55; border-radius: 4px; background: #0b0616df; color: var(--tetris-accent); font: inherit; letter-spacing: .12em; cursor: pointer; touch-action: manipulation; transition: background-color 120ms, border-color 120ms; }
.arcade-button:focus-visible { outline: 2px solid var(--tetris-accent); outline-offset: 2px; }
@media (hover: hover) { .arcade-button:hover:not(:disabled) { background: #2ff3ff1f; border-color: var(--tetris-accent); } }
.arcade-button:active:not(:disabled) { background: #2ff3ff30; }
.arcade-button:disabled { opacity: .38; cursor: default; }
.hold-button { padding: 10px 4px; }
.exit-button { margin-top: auto; font-size: 10px; color: var(--tetris-text-muted); }
.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.action-row b { font: 22px 'Courier New', monospace; vertical-align: -2px; margin-right: 6px; }
.drop-button { color: var(--tetris-pink); border-color: #ff2fa066; }
.control-hint { background: #0b0616bd; border-radius: 4px; margin: 0; text-align: center; font-size: 10px; line-height: 1.8; letter-spacing: .06em; color: var(--tetris-text-muted); }
.control-hint span { font-size: 9px; }
@media (min-width: 900px) { .tetris-arcade { height: min(780px, 100%); flex: 0 1 430px; } }
@media (max-height: 480px) { .tetris-arcade { gap: 4px; } .side-rail { gap: 4px; } .preview-panel { padding: 4px; } .preview-grid { grid-template-columns: repeat(4, 7px); grid-template-rows: repeat(4, 7px); } .best-panel { display: none; } .score-strip { padding: 4px 10px; } .control-hint { font-size: 9px; } }
@media (max-height: 480px) and (min-width: 540px) {
  .tetris-arcade { width: min(100%, 720px); display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, .85fr); grid-template-rows: auto auto 1fr auto; gap: 10px 20px; }
  .play-area { grid-column: 1; grid-row: 1 / 5; }
  .arcade-header, .score-strip, .action-row, .control-hint { grid-column: 2; }
  .action-row { align-self: end; }
}
</style>
