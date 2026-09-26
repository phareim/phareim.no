<template>
  <!-- Lag Din Figur's studio: the figure on its game's backdrop, the four
    games as tabs above it, the tools beside or below it. Nothing on the
    page scrolls; long lists scroll inside their panel. -->
  <div
    ref="rootRef"
    class="fg-root"
    lang="nb"
    :style="{ '--fg-kb': `${keyboardInset}px` }"
  >
    <template v-if="game.ready.value">
      <header class="fg-head">
        <h1 class="fg-title fg-t">LAG DIN FIGUR</h1>
        <div class="fg-head-btns">
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-headbtn" aria-label="Mine figurer" @click="openSheet('figures')">
            <FgIcon id="figures" :scale="2" /><span class="fg-wide-word">MINE FIGURER</span>
          </button>
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-headbtn" aria-label="Lagre bilde" @click="openSheet('share')">
            <FgIcon id="download" :scale="2" /><span class="fg-wide-word">LAGRE</span>
          </button>
          <button type="button" class="px-btn fg-btn fg-btn--plain fg-headbtn" :aria-label="muted ? 'Lyd på' : 'Lyd av'" :aria-pressed="!muted" @click="toggleMute">
            <FgIcon :id="muted ? 'mute' : 'sound'" :scale="3" />
          </button>
        </div>
      </header>

      <div class="fg-studio" :class="{ 'fg-studio--talk': tab === 'pip' }">
        <section class="fg-left">
          <nav class="fg-styles" role="tablist" aria-label="Spill">
            <button
              v-for="(s, i) in STYLES"
              :key="s.id"
              type="button"
              role="tab"
              class="px-btn fg-btn fg-btn--plain fg-style"
              :class="{ 'fg-btn--on': figure.style === s.id }"
              :aria-selected="figure.style === s.id"
              :aria-keyshortcuts="String(i + 1)"
              @click="setStyle(s.id)"
            >
              <FgIcon :id="s.id" :scale="2" />
              <span class="fg-style-long">{{ s.label }}</span>
              <span class="fg-style-short">{{ s.short }}</span>
            </button>
          </nav>

          <div class="fg-stagebox">
            <Stage :figure="figure" :closet="game.closet.value" :style-id="figure.style" :changes="game.changes.value" @hop="onHop" />
            <button type="button" class="fg-plate px-btn fg-btn fg-btn--plain" aria-label="Endre navn" @click="openSheet('rename')">
              <span class="fg-plate-name">{{ figure.name }}</span><FgIcon id="pencil" :scale="2" />
            </button>
            <button type="button" class="fg-pipbtn" aria-label="Pip hjelper deg" @click="callPip">
              <FgIcon id="pip" :scale="3" />
            </button>
          </div>
        </section>

        <section class="fg-right">
          <div class="px-box fg-box fg-panel">
            <BodyPanel v-if="tab === 'body'" />
            <HairPanel v-else-if="tab === 'hair'" />
            <ClothesPanel v-else-if="tab === 'clothes'" />
            <DrawPanel v-else-if="tab === 'draw'" />
            <Helper v-else />
          </div>
          <nav class="fg-tools" role="tablist" aria-label="Verktøy">
            <button
              v-for="t in TABS"
              :key="t.id"
              type="button"
              role="tab"
              class="px-btn fg-btn fg-btn--plain fg-tooltab"
              :class="{ 'fg-btn--on': tab === t.id }"
              :aria-selected="tab === t.id"
              @click="setTab(t.id)"
            >
              <FgIcon :id="t.icon" :scale="2" />
              <span>{{ t.name }}</span>
            </button>
          </nav>
        </section>
      </div>

      <FiguresSheet v-if="sheet === 'figures'" @close="sheet = null" />
      <RenameSheet v-else-if="sheet === 'rename'" @close="sheet = null" />
      <ShareSheet v-else-if="sheet === 'share'" @close="sheet = null" />

      <DrawBoard v-if="board" :key="boardKey" ref="boardRef" :start="board" @close="closeBoard" />

      <Ask v-if="asking" :text="asking.text" @yes="answer(true)" @no="answer(false)" />

      <p v-if="toast" :key="toast.id" class="fg-toast px-box fg-box fg-t" role="status">{{ toast.text }}</p>
    </template>
    <p v-else class="fg-loading fg-t">LAG DIN FIGUR</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, provide, onMounted, onBeforeUnmount } from 'vue'
import type { StyleId } from './types'
import { STYLES } from './render/styles'
import { useFigur } from '~/composables/useFigur'
import './ui/figur.css'
import FgIcon from './ui/FgIcon.vue'
import Stage from './ui/Stage.vue'
import BodyPanel from './ui/BodyPanel.vue'
import HairPanel from './ui/HairPanel.vue'
import ClothesPanel from './ui/ClothesPanel.vue'
import DrawPanel from './ui/DrawPanel.vue'
import Helper from './ui/Helper.vue'
import FiguresSheet from './ui/FiguresSheet.vue'
import RenameSheet from './ui/RenameSheet.vue'
import ShareSheet from './ui/ShareSheet.vue'
import DrawBoard from './ui/DrawBoard.vue'
import Ask from './ui/Ask.vue'
import type { IconId } from './ui/icons'
import { createSfx, type Sfx } from './ui/sfx'
import { FG_CTX, type BoardStart, type FigurContext, type ToolTab } from './ui/context'

const TABS: Array<{ id: ToolTab; name: string; icon: IconId }> = [
  { id: 'body', name: 'KROPP', icon: 'body' },
  { id: 'hair', name: 'HÅR', icon: 'hair' },
  { id: 'clothes', name: 'KLÆR', icon: 'clothes' },
  { id: 'draw', name: 'TEGN', icon: 'draw' },
  { id: 'pip', name: 'PIP', icon: 'pip' },
]

const game = useFigur()
const figure = computed(() => game.active.value)

const rootRef = ref<HTMLDivElement | null>(null)
const tab = ref<ToolTab>('clothes')
const sheet = ref<'figures' | 'rename' | 'share' | null>(null)
const board = ref<BoardStart | null>(null)
const boardKey = ref(0)
const boardRef = ref<{ escape(): void; undo(): void } | null>(null)
const asking = ref<{ text: string; yes: () => void } | null>(null)
const toast = ref<{ id: number; text: string } | null>(null)

// ---------------------------------------------------------------- sound

const sound = createSfx()
const muted = ref(sound.muted)
let unlocked = false
function unlock() {
  if (unlocked) return
  unlocked = true
  sound.unlock()
}
const sfx = (name: Sfx) => sound.play(name)

function toggleMute() {
  unlock()
  sound.setMuted(!muted.value)
  muted.value = sound.muted
  sfx('pop')
}

// ---------------------------------------------------------------- actions

function setStyle(id: StyleId) {
  game.setStyle(id)
  sfx('pop')
}

function setTab(t: ToolTab) {
  if (tab.value !== t) sfx('pop')
  tab.value = t
}

function callPip() {
  tab.value = 'pip'
  sfx('chirp')
}

function onHop() {
  sfx('pop')
}

function openSheet(s: 'figures' | 'rename' | 'share') {
  sheet.value = s
  sfx('pop')
}

function closeBoard() {
  board.value = null
}

let toastTimer: ReturnType<typeof setTimeout> | undefined
let toastId = 0
function say(text: string) {
  toast.value = { id: ++toastId, text }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2600)
}

function answer(yes: boolean) {
  const a = asking.value
  asking.value = null
  if (yes) a?.yes()
  else sfx('pop')
}

const ctx: FigurContext = {
  sfx,
  openBoard(start) {
    sheet.value = null
    boardKey.value++
    board.value = start
  },
  ask(text, yes) {
    asking.value = { text, yes }
    sfx('pop')
  },
  say,
  setTab,
}
provide(FG_CTX, ctx)

// ---------------------------------------------------------------- keyboard

const STYLE_KEYS: Record<string, number> = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Numpad1: 0, Numpad2: 1, Numpad3: 2, Numpad4: 3 }

function typing(t: EventTarget | null): boolean {
  return t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || (t instanceof HTMLElement && t.isContentEditable)
}

function onKeyDown(e: KeyboardEvent) {
  unlock()
  if (e.key === 'Escape') {
    if (e.repeat) return
    // Something open: Escape closes it, and the shell must not leave the game.
    if (asking.value) { e.preventDefault(); answer(false); return }
    if (board.value) { e.preventDefault(); boardRef.value?.escape(); return }
    if (sheet.value) { e.preventDefault(); sheet.value = null; return }
    // Nothing open: Escape is the shell's (back to the portal).
    return
  }
  if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) {
    if (board.value && !asking.value && (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z' && !typing(e.target)) {
      e.preventDefault()
      boardRef.value?.undo()
    }
    return
  }
  const i = STYLE_KEYS[e.code]
  if (i !== undefined && !e.repeat && !asking.value) {
    const s = STYLES[i]
    if (s) setStyle(s.id)
  }
}

// ---------------------------------------------------------------- the view

/** The phone keyboard's height over the page, so a sheet can sit above it. */
const keyboardInset = ref(0)
function onViewport() {
  const vv = window.visualViewport
  if (!vv) return
  keyboardInset.value = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop))
  // iOS scrolls the locked page to show a focused field; put it back when the keyboard goes.
  if (keyboardInset.value === 0 && (window.scrollY || document.documentElement.scrollTop)) window.scrollTo(0, 0)
}

function onVisibility() {
  if (document.visibilityState === 'hidden') game.flush()
}

onMounted(() => {
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('pointerdown', unlock, { capture: true, passive: true })
  window.visualViewport?.addEventListener('resize', onViewport)
  window.visualViewport?.addEventListener('scroll', onViewport)
  document.addEventListener('visibilitychange', onVisibility)
  if (import.meta.dev) (window as unknown as { __figur?: unknown }).__figur = { game, ctx }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeyDown)
  window.removeEventListener('pointerdown', unlock, { capture: true })
  window.visualViewport?.removeEventListener('resize', onViewport)
  window.visualViewport?.removeEventListener('scroll', onViewport)
  document.removeEventListener('visibilitychange', onVisibility)
  if (toastTimer) clearTimeout(toastTimer)
  game.flush()
  sound.dispose()
})
</script>

<style scoped>
.fg-root {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding:
    max(8px, env(safe-area-inset-top, 0px))
    max(8px, env(safe-area-inset-right, 0px))
    calc(8px + var(--app-safe-bottom, 0px))
    max(8px, env(safe-area-inset-left, 0px));
  background: var(--fg-lilac);
  overflow: hidden;
  /* clip: not even scrollIntoView or a focused field may scroll the studio. */
  overflow: clip;
  user-select: none;
  -webkit-user-select: none;
}

/* ---------------------------------------------------------------- header */

.fg-head {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 3px 0;
}
.fg-title {
  flex: 1;
  min-width: 0;
  margin: 0;
  font-size: 16px;
  font-weight: 400;
  color: var(--fg-ink);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.fg-head-btns { display: flex; gap: 10px; flex: none; }
.fg-root .px-btn.fg-btn.fg-headbtn { padding: 0 10px; }
.fg-wide-word { display: none; }

/* ---------------------------------------------------------------- the two halves */

.fg-studio {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fg-left {
  flex: 1 1 50%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.fg-right {
  flex: 1 1 50%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Pip's buttons all show on a phone: the panel takes more of the height. */
.fg-studio--talk .fg-left { flex-basis: 38%; }
.fg-studio--talk .fg-right { flex-basis: 62%; }

.fg-styles {
  flex: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  padding: 3px;
}
.fg-root .px-btn.fg-btn.fg-style { min-width: 0; min-height: 52px; padding: 2px 2px; gap: 2px; flex-direction: column; }
.fg-style-long { display: none; }
.fg-style-short { white-space: nowrap; overflow: hidden; }

.fg-stagebox {
  position: relative;
  flex: 1 1 auto;
  min-height: 0;
  box-shadow:
    0 -3px 0 0 var(--fg-ink),
    0 3px 0 0 var(--fg-ink),
    -3px 0 0 0 var(--fg-ink),
    3px 0 0 0 var(--fg-ink);
  margin: 3px;
}

/* The name plate, top-left over the sky. */
.fg-root .px-btn.fg-btn.fg-plate {
  position: absolute;
  left: 8px;
  top: 8px;
  max-width: calc(50% - 16px);
  min-height: 40px;
  padding: 0 10px;
  gap: 8px;
  background: rgba(255, 255, 255, 0.92);
}
.fg-plate-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* Pip, bottom-left of the stage: clear of the ⌂ chip and above the bottom band. */
.fg-pipbtn {
  position: absolute;
  left: 6px;
  bottom: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: var(--fg-sun-soft);
  box-shadow: 0 0 0 3px var(--fg-ink);
  cursor: pointer;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
  transition: transform 80ms ease-out;
}
.fg-pipbtn:active { transform: translateY(2px); }
.fg-pipbtn:focus-visible { outline: 3px solid var(--fg-sky); outline-offset: 4px; }

.fg-toast {
  position: absolute;
  z-index: 80;
  top: 76px;
  left: 50%;
  transform: translateX(-50%);
  width: max-content;
  max-width: min(calc(100% - 32px), 480px);
  margin: 0;
  padding: 10px 14px;
  font-size: 16px;
  text-align: center;
  pointer-events: none;
  animation: fg-fade-in 150ms ease-out;
}

/* ---------------------------------------------------------------- tools */

.fg-panel {
  flex: 1 1 auto;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  margin: 3px;
  padding: 8px 6px 6px;
  background: var(--fg-paper);
}
.fg-panel > :deep(*) { flex: 1 1 auto; min-height: 0; }
.fg-panel :deep(.fg-panel-body) {
  overflow-y: auto;
  overflow-x: hidden;
  overscroll-behavior: contain;
  touch-action: pan-y;
  padding: 2px 6px 8px;
  min-height: 0;
}

/* The tool tabs at the bottom; the right end stays free for the site's ⌂ chip. */
.fg-tools {
  flex: none;
  display: flex;
  gap: 6px;
  padding: 3px 56px 3px 3px;
}
.fg-root .px-btn.fg-btn.fg-tooltab {
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  min-height: 56px;
  padding: 2px 4px;
}

.fg-loading {
  margin: auto;
  font-size: 32px;
  color: #fff;
  text-shadow: 4px 4px 0 var(--fg-ink);
}

/* ---------------------------------------------------------------- wide screens and landscape */

@media (min-width: 600px) {
  .fg-root .px-btn.fg-btn.fg-style { flex-direction: row; gap: 8px; min-height: 48px; padding: 0 6px; }
  .fg-style-long { display: inline; white-space: nowrap; }
  .fg-style-short { display: none; }
}
@media (min-width: 800px), (orientation: landscape) and (max-height: 500px) and (min-width: 560px) {
  .fg-studio { flex-direction: row; gap: 16px; }
  .fg-left { flex: 1 1 auto; min-width: 0; }
  .fg-right,
  .fg-studio--talk .fg-right { flex: 0 0 min(46%, 520px); }
  .fg-studio--talk .fg-left { flex-basis: auto; }
  .fg-wide-word { display: inline; }
}
@media (min-width: 800px) {
  .fg-root { padding: 14px 18px calc(12px + var(--app-safe-bottom, 0px)); gap: 12px; }
  .fg-title { font-size: 24px; }
  .fg-pipbtn { width: 72px; height: 72px; left: 10px; bottom: 10px; }
}
@media (orientation: landscape) and (max-height: 500px) {
  .fg-root .px-btn.fg-btn.fg-tooltab { flex-direction: row; min-height: 48px; gap: 6px; }
  .fg-tooltab span { display: none; }
  .fg-pipbtn { width: 52px; height: 52px; }
}
</style>
