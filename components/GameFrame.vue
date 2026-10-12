<template>
  <div class="game-frame">
    <!-- Mounted on the client only, after the listener is up: the game's first message is never missed. -->
    <iframe
      v-if="src"
      ref="view"
      class="game-frame__view"
      :src="src"
      :title="game.name"
      allow="autoplay; fullscreen; gamepad; screen-wake-lock"
      @load="focusGame"
    />
    <!-- Measures the screen's safe edges for the game (it cannot be trusted to see them itself). -->
    <div ref="probe" class="game-frame__probe" aria-hidden="true" />
    <!-- Until the game says it has a way home of its own (a page that failed to load never does). -->
    <button
      v-if="!ready"
      class="game-frame__home"
      title="Back to the town (Esc)"
      aria-label="Back to the town"
      @click="leave"
    >
      <svg class="game-frame__glyph" viewBox="0 0 9 8" shape-rendering="crispEdges" aria-hidden="true">
        <path d="M4 0h1v1h1v1h1v1h1v1h1v1H8v3H5V5H4v3H1V5H0V4h1V3h1V2h1V1h1z" />
      </svg>
    </button>
  </div>
</template>

<script setup lang="ts">
/**
 * A game from another address, filling the screen inside this page
 * (docs/games/frame.md): the installed app never leaves phareim.no, so the
 * browser's bar never comes up. The game says `phareim:hello` when it listens,
 * `phareim:ready` when its own way home is on screen and `phareim:home` to go
 * back; this side answers with the screen's safe edges, and again whenever
 * they change (themes/frames.ts has the messages).
 */
import { FRAME_HOME, FRAME_READY, FRAME_SCREEN, frameMessage, type FramedGame, type FrameInsets } from '~/themes/frames'

const props = defineProps<{ game: FramedGame }>()
const { leave } = useFrame()
const route = useRoute()

const view = ref<HTMLIFrameElement | null>(null)
const probe = ref<HTMLElement | null>(null)
const src = ref('')
/** The game's own way home is on screen. */
const ready = ref(false)
/** The game has said anything at all: it takes the screen's edges. */
let listening = false

useHead({ title: computed(() => `${props.game.name} — phareim.no`) })

/** A dev server may frame another dev server: `/?frame=<id>&src=http://localhost:3040/`. Never in a build. */
function address(): string {
  const dev = import.meta.dev ? route.query.src : null
  return typeof dev === 'string' && /^https?:\/\//.test(dev) ? dev : props.game.url
}

function insets(): FrameInsets {
  const s = probe.value ? getComputedStyle(probe.value) : null
  const px = (v: string | undefined) => Math.max(0, Math.round(parseFloat(v ?? '') || 0))
  return { top: px(s?.paddingTop), right: px(s?.paddingRight), bottom: px(s?.paddingBottom), left: px(s?.paddingLeft) }
}

function sendScreen() {
  if (!listening || !src.value) return
  view.value?.contentWindow?.postMessage({ type: FRAME_SCREEN, insets: insets(), installed: isInstalledApp() }, new URL(src.value).origin)
}

function onMessage(e: MessageEvent) {
  if (!src.value || e.source !== view.value?.contentWindow || e.origin !== new URL(src.value).origin) return
  const type = frameMessage(e.data)
  if (type === FRAME_HOME) { leave(); return }
  if (type === FRAME_READY) ready.value = true
  if (type) { listening = true; sendScreen() }
}

/** Keys go to the game without a tap first. */
function focusGame() { view.value?.focus() }

/** Escape reaches this page only while the game does not hold the keys (a page that failed to load, a click outside). */
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && !e.repeat) leave()
}

let turnTimer: ReturnType<typeof setTimeout> | undefined
/** The insets follow the screen a moment after it turns. */
function onTurn() {
  clearTimeout(turnTimer)
  turnTimer = setTimeout(sendScreen, 300)
}

onMounted(() => {
  window.addEventListener('message', onMessage)
  window.addEventListener('keydown', onKey)
  window.addEventListener('resize', sendScreen)
  window.addEventListener('orientationchange', onTurn)
  src.value = address()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', onMessage)
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('resize', sendScreen)
  window.removeEventListener('orientationchange', onTurn)
  clearTimeout(turnTimer)
})
</script>

<style scoped>
/* The whole screen, under every inset, laid out as a landing is: in the page's flow at --app-height (app.vue).
   A fixed box stops a status bar short of the screen's foot in the iOS Home Screen app. */
.game-frame {
  position: relative;
  width: 100%;
  height: var(--app-height, 100dvh);
  overflow: hidden;
  background: #0b0616;
}

.game-frame__view {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
}

.game-frame__probe {
  position: fixed;
  visibility: hidden;
  pointer-events: none;
  padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px) env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
}

/* HomeChip's house in HomeChip's corner. It waits a moment, so a game that answers at once never shows it. */
.game-frame__home {
  position: fixed;
  z-index: 50;
  right: max(0.5rem, env(safe-area-inset-right));
  bottom: calc(max(0.9rem, var(--app-safe-bottom, 0px)) - 0.45rem);
  width: 2.75rem;
  height: 2.75rem;
  display: grid;
  place-items: center;
  color: #f2e9ff;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
  animation: game-frame-home 0.2s 2.5s both;
}

.game-frame__glyph {
  width: 27px;
  height: 24px;
  fill: currentColor;
  filter: drop-shadow(3px 3px 0 #0b0616);
}

.game-frame__home:focus-visible { outline: none; }

@keyframes game-frame-home {
  from { opacity: 0; visibility: hidden; }
  to { opacity: 0.85; visibility: visible; }
}
</style>
