<template>
  <section class="tetris-arcade" aria-label="Tetris arcade">
    <header class="arcade-header">
      <div><span class="eyebrow">NEON DREAMS</span><h2>TETRIS</h2></div>
      <button v-if="inRun" class="arcade-button pause-button" @click="gameRef?.togglePause()">{{ paused ? 'RESUME' : 'PAUSE' }}</button>
      <span v-else class="eyebrow">{{ tetrisState.phase === 'over' ? 'TRY AGAIN' : 'ENDLESS PLAY' }}</span>
    </header>
    <div class="score-strip px-panel">
      <div><span>SCORE</span><strong>{{ String(tetrisState.score).padStart(6, '0') }}</strong></div>
      <div><span>LINES</span><strong>{{ String(tetrisState.lines).padStart(2, '0') }}</strong></div>
      <div><span>LEVEL</span><strong>{{ String(tetrisState.level).padStart(2, '0') }}</strong></div>
    </div>
    <div ref="playArea" class="play-area">
      <div class="game-wrapper"><TetrisGame ref="gameRef" :cell-size="cellSize" @state="onGameState" @beat="emit('beat', $event)" @view="emit('view', $event)" /></div>
      <aside class="side-rail">
        <div class="preview-panel px-panel">
          <span class="eyebrow">NEXT</span>
          <div class="preview-grid" :aria-label="`Next piece: ${tetrisState.next ?? 'none'}`"><span v-for="i in 16" :key="i" :style="previewStyle(tetrisState.next, i - 1)" /></div>
        </div>
        <button class="preview-panel px-panel hold-button arcade-button" :disabled="!playing || !tetrisState.canHold" aria-label="Hold piece" @click="gameRef?.hold()">
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
    <p class="control-hint">{{ hint('← → MOVE · ↑ ROTATE · ↓ SOFT DROP', 'DRAG ←→ MOVE · TAP ROTATE') }}<br><span>{{ hint('SPACE DROP · C HOLD · P/ESC PAUSE · HOLD ESC QUIT', 'FLICK ↓ DROP · DRAG ↓ LOWER · SWIPE ↑ HOLD') }}</span></p>
  </section>
</template>

<script setup lang="ts">
import TetrisGame, { type TetrisState } from './Game.vue'
import { PIECE_SHAPES, type PieceType } from './engine'
import { previewCss } from './pixel'
const { hint } = useInputMode()
const emit = defineEmits<{ state: [value: TetrisState], beat: [clear: boolean], view: [position: { x: number, y: number }] }>()
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
  return previewCss(piece)
}
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(([entry]) => {
    if (!entry) return
    // The layout owns the available space, including safe areas. The well's
    // stone rim (Game.vue) takes about 0.9 of a cell across and down.
    cellSize.value = Math.max(4, Math.min(28, Math.floor(Math.min((entry.contentRect.width - 90) / 10.9, entry.contentRect.height / 20.9))))
  })
  if (playArea.value) observer.observe(playArea.value)
})
onBeforeUnmount(() => observer?.disconnect())
</script>

<style scoped>
/* Neon Shrine's pixel look (2026-09-24): the 5×7 font (--font-pixel) at 8/16/32 px
   and dialog-box panels (dark fill, pink edge with cut corners, a cyan
   inner line), one box pixel = 2 CSS px. */
.tetris-arcade { width: min(100%, 430px); min-height: 0; flex: 1; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto auto; gap: 10px; color: var(--tetris-text); font: 16px/1.25 var(--font-pixel); -webkit-font-smoothing: none; text-shadow: 2px 2px 0 #0b0616; }
.px-panel { background: rgba(11, 6, 22, .88); border: 2px solid var(--tetris-pink); box-shadow: inset 0 0 0 2px rgba(11, 6, 22, .88), inset 0 4px 0 0 rgba(47, 243, 255, .35), 4px 4px 0 #0b0616aa; clip-path: polygon(2px 0, calc(100% - 2px) 0, 100% 2px, 100% calc(100% - 2px), calc(100% - 2px) 100%, 2px 100%, 0 calc(100% - 2px), 0 2px); }
.arcade-header { display: flex; justify-content: space-between; align-items: center; min-height: 44px; }
h2 { margin: 4px 0 0; font: 32px/1 var(--font-pixel); color: var(--tetris-pink); text-shadow: 4px 4px 0 #0b0616, 0 0 18px #ff2fa066; }
.eyebrow { font-size: 8px; color: var(--tetris-text-muted); text-shadow: 1px 1px 0 #0b0616; }
.score-strip { display: flex; justify-content: space-between; padding: 10px 12px 8px; }
.score-strip div { display: grid; gap: 4px; }
.score-strip span { font-size: 8px; color: var(--tetris-text-muted); text-shadow: 1px 1px 0 #0b0616; }
strong { font-size: 16px; font-weight: normal; color: var(--tetris-accent); font-variant-numeric: tabular-nums; text-shadow: 2px 2px 0 #0b0616, 0 0 8px #2ff3ff55; }
.play-area { min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 76px; gap: 12px; }
.game-wrapper { min-height: 0; display: flex; justify-content: center; align-items: center; }
.side-rail { display: flex; flex-direction: column; gap: 12px; }
.preview-panel { display: grid; justify-items: center; gap: 8px; padding: 10px 4px; }
.preview-panel .eyebrow { font-size: 16px; color: var(--tetris-text); text-shadow: 2px 2px 0 #0b0616; }
.preview-grid { display: grid; grid-template-columns: repeat(4, 12px); grid-template-rows: repeat(4, 12px); gap: 0; }
.preview-grid span { display: block; }
.rail-hint { font-size: 8px; text-shadow: 1px 1px 0 #0b0616; }
.best-panel { display: grid; gap: 6px; text-align: center; }
.best-panel strong { color: var(--tetris-gold); font-size: 16px; text-shadow: 2px 2px 0 #0b0616; }
.arcade-button { min-height: 44px; padding: 8px 12px; border: 2px solid #2ff3ff88; border-radius: 0; background: rgba(11, 6, 22, .9); color: var(--tetris-accent); font: 16px var(--font-pixel); text-shadow: 2px 2px 0 #0b0616; box-shadow: inset 0 -4px 0 #1c1030, 4px 4px 0 #0b0616aa; cursor: pointer; touch-action: manipulation; transition: background-color 120ms, border-color 120ms; }
.arcade-button:focus-visible { outline: 2px solid var(--tetris-accent); outline-offset: 2px; }
@media (hover: hover) { .arcade-button:hover:not(:disabled) { background: #2ff3ff1f; border-color: var(--tetris-accent); } }
.arcade-button:active:not(:disabled) { background: #2ff3ff30; box-shadow: inset 0 4px 0 #1c1030; transform: translateY(2px); }
.arcade-button:disabled { opacity: .38; cursor: default; }
.hold-button { padding: 10px 4px; color: var(--tetris-text); }
.hold-button.px-panel { border: 2px solid var(--tetris-pink); }
.exit-button { margin-top: auto; font-size: 8px; color: var(--tetris-text-muted); }
.action-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
/* ↻ has no clear 5×7 form; the arrows keep Space Mono. */
.action-row b { font: 20px var(--font-machine); vertical-align: -2px; margin-right: 8px; text-shadow: none; }
.drop-button { color: var(--tetris-pink); border-color: #ff2fa088; }
.control-hint { background: rgba(11, 6, 22, .8); margin: 0; padding: 6px 4px; text-align: center; font-size: 8px; line-height: 2; color: var(--tetris-text-muted); text-shadow: 1px 1px 0 #0b0616; }
.control-hint span { font-size: 8px; }
@media (min-width: 900px) { .tetris-arcade { height: min(780px, 100%); flex: 0 1 430px; } }
@media (max-height: 480px) { .tetris-arcade { gap: 4px; } .side-rail { gap: 4px; } .preview-panel { padding: 4px; } .preview-grid { grid-template-columns: repeat(4, 8px); grid-template-rows: repeat(4, 8px); } .best-panel { display: none; } .score-strip { padding: 4px 10px; } .control-hint { font-size: 8px; } h2 { font-size: 24px; } }
@media (max-height: 480px) and (min-width: 540px) {
  .tetris-arcade { width: min(100%, 720px); display: grid; grid-template-columns: minmax(0, 1fr) minmax(240px, .85fr); grid-template-rows: auto auto 1fr auto; gap: 10px 20px; }
  .play-area { grid-column: 1; grid-row: 1 / 5; }
  .arcade-header, .score-strip, .action-row, .control-hint { grid-column: 2; }
  .action-row { align-self: end; }
}
</style>

