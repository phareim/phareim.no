<template>
  <div
    class="radio-station app"
    :class="{ 'app--narrow': narrow, 'app--calm': calm, 'app--idle': calm && idle }"
    @pointermove="wake"
    @pointerdown="wake"
  >
    <SceneWindow class="app__win" :quiet="calm" @start="toggle">
      <template #corner>
        <div class="corner" :class="{ gone: calm && idle }">
          <button
            v-if="calm"
            type="button"
            class="px-btn px-btn--pink corner__btn"
            :aria-label="playing ? 'Pause' : 'Play'"
            title="PLAY / PAUSE [SPACE]"
            @click="toggle"
          >{{ playing ? '❚❚' : '▶' }}</button>
          <button
            type="button"
            class="px-btn px-btn--gold corner__btn"
            :class="{ on: auto }"
            :aria-pressed="auto"
            :title="auto ? 'AUTO IS ON: A NEW PLACE EVERY FEW MINUTES. PRESS TO STAY HERE [A]' : 'AUTO: DRIFT SLOWLY FROM PLACE TO PLACE [A]'"
            @click="toggleAuto"
          >AUTO</button>
          <button type="button" class="px-btn corner__btn" title="GLIDE ON TO ANOTHER PLACE [G]" aria-label="Glide on to another place" @click="glideOn">▶▶</button>
          <button
            type="button"
            class="px-btn px-btn--dim corner__btn"
            :title="calm ? 'SHOW THE CONTROLS [D]' : 'JUST THE PICTURE [D]'"
            @click="setCalm(!calm)"
          >{{ calm ? 'SHOW' : 'DIM' }}</button>
        </div>
      </template>
    </SceneWindow>
    <LayerStrip v-show="!calm" class="app__strip" />

    <div v-show="!calm" class="app__deck">
      <div class="deck__transport">
        <button
          type="button"
          class="px-btn px-btn--pink deck__play"
          :class="{ on: playing }"
          :aria-label="playing ? 'Pause' : 'Play'"
          title="PLAY / PAUSE [SPACE]"
          @click="toggle"
        >{{ playing ? '❚❚ PAUSE' : '▶ PLAY' }}</button>
        <button
          type="button"
          class="px-btn px-btn--gold deck__hold"
          :class="{ on: controls.hold }"
          :aria-pressed="controls.hold"
          title="KEEP THIS PROGRESSION AND MOTIF LOOPING [H]"
          @click="set({ hold: !controls.hold })"
        >HOLD</button>
      </div>

      <div class="deck__side">
        <Dial class="deck__dial" @channels="channelsOpen = true" />
        <a class="deck__more" href="https://radio.phareim.no" rel="noopener"><span class="deck__more-wide">RATE AND COMPOSE AT </span><span class="deck__more-narrow">MORE AT </span>RADIO.PHAREIM.NO ↗</a>
      </div>

      <div class="deck__knobs">
        <IntensityBar />
        <PxSlider :model-value="controls.mood" label="MOOD" left="BRIGHT" right="DARK" :compact="narrow" color="#cfc6ff" @update:model-value="set({ mood: $event })" />
        <PxSlider :model-value="controls.space" label="SPACE" left="DRY" right="VAST" :compact="narrow" @update:model-value="set({ space: $event })" />
        <PxSlider :model-value="controls.grit" label="GRIT" left="CLEAN" right="TAPE" :compact="narrow" color="#ff8a3d" @update:model-value="set({ grit: $event })" />
        <PxSlider :model-value="controls.density" label="DENSITY" left="SPARSE" right="BUSY" :compact="narrow" color="#3fe0a0" @update:model-value="set({ density: $event })" />
        <PxSlider
          :model-value="controls.tempo"
          label="TEMPO"
          :min="-20"
          :max="20"
          :step="2"
          :segments="20"
          bipolar
          :left="narrow ? '' : '-20'"
          :right="narrow ? '' : '+20'"
          :compact="narrow"
          color="#ffd23f"
          :format="(v: number) => (v > 0 ? `+${v}` : `${v}`)"
          @update:model-value="set({ tempo: $event })"
        />
        <div class="deck__vol">
          <PxSlider
            :model-value="muted ? 0 : volume"
            label="VOLUME"
            :step="0.05"
            :segments="10"
            color="#ff2fa0"
            compact
            @update:model-value="setVolume($event)"
          />
          <button
            type="button"
            class="deck__mute"
            :class="{ on: muted }"
            :aria-label="muted ? 'Unmute' : 'Mute'"
            title="MUTE [M]"
            @click="toggleMute"
          >{{ muted ? '×' : '♪' }}</button>
        </div>
      </div>
    </div>

    <Channels v-if="channelsOpen" @close="channelsOpen = false" />
    <p v-if="toast" :key="toast.n" class="app__toast px-box" role="status">{{ toast.text }}</p>
    <!-- The master output, so iOS keeps playing with the screen locked. -->
    <audio ref="audioEl" class="app__audio" playsinline aria-hidden="true" />
  </div>
</template>

<script setup lang="ts">
/**
 * The radio theme's page, client-only: the radio app's layout
 * (phareim/radio components/RadioApp.client.vue) without thumbs, notes,
 * composing or login, which stay on radio.phareim.no. Owns the keyboard,
 * the media session and the hidden <audio> element; the vendored parts in
 * station/ own their own drawing. The generative player stops when the
 * page goes (the ⌂ chip, Escape, the back button).
 *
 * Keys as in the radio app: Space play/pause, 1–9 and 0 places, ← →
 * previous/next place, ↑ ↓ intensity, H hold, A auto, G glide on, D dim,
 * C channels, M mute. Escape closes CHANNELS or leaves DIM first; otherwise
 * the shell takes it home.
 */
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Controls } from './station/engine/types.ts'
import { load, save } from './station/composables/storage'
import { useRadio } from './station/composables/useRadio'
import { useAuto } from './station/composables/useAuto'
import { useChannels } from './station/composables/useChannels'
import SceneWindow from './station/components/SceneWindow.vue'
import LayerStrip from './station/components/LayerStrip.vue'
import IntensityBar from './station/components/IntensityBar.vue'
import PxSlider from './station/components/PxSlider.vue'
import Dial from './Dial.vue'
import Channels from './Channels.vue'

const radio = useRadio()
const { controls, playing, volume, muted, set, setVolume, toggleMute, landscapeOf, hud } = radio
const { auto, toggleAuto, glideOn } = useAuto()
/** Which channels show on the dial, in this browser only (never synced here). */
const { visible } = useChannels()
const channelsOpen = ref(false)

// ---- a short note when audio will not start

const toast = ref<{ text: string; n: number } | null>(null)
let toastTimer: ReturnType<typeof setTimeout> | null = null
function say(text: string): void {
  toast.value = { text, n: (toast.value?.n ?? 0) + 1 }
  if (toastTimer) clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { toast.value = null }, 2400)
}

// ---- the quiet view: just the picture, and AUTO / ▶▶ / SHOW in a corner that fades when left alone

const CALM_KEY = 'radio.calm'
const calm = ref(false)
const idle = ref(false)
let idleTimer: ReturnType<typeof setTimeout> | null = null

function wake(): void {
  idle.value = false
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(() => { idle.value = true }, 3500)
}

function setCalm(on: boolean): void {
  calm.value = on
  save(CALM_KEY, on)
  wake()
}

const narrow = ref(false)
const audioEl = ref<HTMLAudioElement | null>(null)

// ---- play / pause ------------------------------------------------------------

let pauseTimer: ReturnType<typeof setTimeout> | null = null

function toggle(): void {
  if (playing.value) {
    radio.pause()
    // The player fades out over a second; the element carries that fade when it is the output.
    if (pauseTimer) clearTimeout(pauseTimer)
    pauseTimer = setTimeout(() => { if (!playing.value) audioEl.value?.pause() }, 1200)
    setSessionState()
    return
  }
  if (!radio.hasPlayer) {
    say('NO AUDIO ENGINE')
    return
  }
  if (pauseTimer) { clearTimeout(pauseTimer); pauseTimer = null }
  const started = radio.play()
  // The player builds its context and stream synchronously, so the element
  // starts inside this same gesture.
  routeToElement()
  setSessionState()
  started.catch(() => say('AUDIO WOULD NOT START'))
}

/**
 * Play the master stream through the hidden <audio> element, so the OS
 * treats the page as a media player (lock screen, media keys, background
 * playback on iOS). Once the element plays, the player stops feeding the
 * speakers directly so the music is not doubled; if the element will not
 * play, the player keeps its own speaker output.
 */
let routed = false
function routeToElement(): void {
  const el = audioEl.value
  const stream = radio.stream()
  if (!el || !stream) { radio.setOutput('speakers'); return }
  if (routed) { el.play().catch(() => {}); return }
  if (el.srcObject !== stream) el.srcObject = stream
  el.play()
    .then(() => { radio.setOutput('stream'); routed = true })
    .catch(() => { el.pause(); el.srcObject = null; radio.setOutput('speakers') })
}

// ---- media session -------------------------------------------------------------

const SESSION_ACTIONS: MediaSessionAction[] = ['play', 'pause', 'stop', 'nexttrack', 'previoustrack']

function setSessionState(): void {
  if (!('mediaSession' in navigator)) return
  navigator.mediaSession.playbackState = playing.value ? 'playing' : 'paused'
}

function setMetadata(): void {
  if (!('mediaSession' in navigator) || typeof MediaMetadata === 'undefined') return
  const L = landscapeOf(hud.landscape)
  navigator.mediaSession.metadata = new MediaMetadata({
    title: L.name,
    artist: 'Radio · phareim.no',
    album: radio.intensityNames[controls.intensity],
    artwork: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  })
}

function stepPlace(d: number): void {
  const list = visible.value
  const i = list.findIndex(l => l.id === controls.landscape)
  set({ landscape: list[(i + d + list.length) % list.length]!.id })
}

function wireMediaSession(): void {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  const on = (a: MediaSessionAction, h: MediaSessionActionHandler) => { try { ms.setActionHandler(a, h) } catch { /* unsupported */ } }
  on('play', () => { if (!playing.value) toggle() })
  on('pause', () => { if (playing.value) toggle() })
  on('stop', () => { if (playing.value) toggle() })
  on('nexttrack', () => (auto.value ? glideOn() : stepPlace(1)))
  on('previoustrack', () => stepPlace(-1))
  setMetadata()
}

function unwireMediaSession(): void {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession
  for (const a of SESSION_ACTIONS) { try { ms.setActionHandler(a, null) } catch { /* unsupported */ } }
  ms.metadata = null
  ms.playbackState = 'none'
}

watch(() => [hud.landscape, controls.intensity], setMetadata)

// ---- keyboard ------------------------------------------------------------------

function typing(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null
  return !!el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))
}

function onKey(e: KeyboardEvent): void {
  if (e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return
  // The channel list handles its own Escape and C and takes no other keys.
  if (channelsOpen.value) return
  if (e.key === 'Escape') {
    // DIM is left first; the shell's Escape home waits for a later tap.
    if (calm.value) { setCalm(false); e.preventDefault() }
    return
  }
  wake()
  const k = e.key
  let handled = true
  if (k === ' ' || e.code === 'Space') { if (!e.repeat) toggle() }
  else if (/^[0-9]$/.test(k)) {
    const L = visible.value[k === '0' ? 9 : Number(k) - 1]
    if (L) set({ landscape: L.id })
  }
  else if (k === 'ArrowLeft') stepPlace(-1)
  else if (k === 'ArrowRight') stepPlace(1)
  else if (k === 'ArrowUp') set({ intensity: Math.min(4, controls.intensity + 1) as Controls['intensity'] })
  else if (k === 'ArrowDown') set({ intensity: Math.max(0, controls.intensity - 1) as Controls['intensity'] })
  else if (k === 'h' || k === 'H') set({ hold: !controls.hold })
  else if (k === 'a' || k === 'A') { if (!e.repeat) toggleAuto() }
  else if (k === 'g' || k === 'G') { if (!e.repeat) glideOn() }
  else if (k === 'd' || k === 'D') { if (!e.repeat) setCalm(!calm.value) }
  else if (k === 'c' || k === 'C') { if (!e.repeat) channelsOpen.value = true }
  else if (k === 'm' || k === 'M') { if (!e.repeat) toggleMute() }
  else handled = false
  if (handled) e.preventDefault()
}

// ---- layout --------------------------------------------------------------------

let mq: MediaQueryList | null = null
const onMq = () => { narrow.value = !!mq?.matches }

onMounted(() => {
  mq = window.matchMedia('(max-width: 700px)')
  onMq()
  mq.addEventListener('change', onMq)
  window.addEventListener('keydown', onKey)
  wireMediaSession()
  calm.value = load<boolean>(CALM_KEY, false) === true
  if (calm.value) wake()
})

onBeforeUnmount(() => {
  mq?.removeEventListener('change', onMq)
  window.removeEventListener('keydown', onKey)
  if (idleTimer) clearTimeout(idleTimer)
  if (toastTimer) clearTimeout(toastTimer)
  if (pauseTimer) clearTimeout(pauseTimer)
  // Off the air when the page goes: the player fades out and suspends; the
  // next visit picks up where this one left.
  if (playing.value) radio.pause()
  radio.setOutput('speakers')
  audioEl.value?.pause()
  unwireMediaSession()
})
</script>

<style scoped>
.app {
  position: relative;
  height: var(--app-height, 100dvh);
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto auto;
  overflow: hidden;
  background: var(--bg);
  font-size: 16px;
  line-height: 20px;
  text-transform: uppercase;
  --pxs-label-w: 96px;
}

.app__win { min-height: 0; }

.app--calm { grid-template-rows: minmax(0, 1fr) 0 0; }
.app--idle { cursor: none; }

.corner { display: flex; gap: 10px; align-items: center; transition: opacity 0.6s ease; }
.corner.gone { opacity: 0; pointer-events: none; }
.corner__btn { height: 32px; padding: 0 10px; }
.corner__btn.on, .corner__btn.on:hover { color: var(--bg); background: var(--gold); }

/* In DIM the corner sits bottom-right of the picture: clear of the ⌂ chip and the bottom band. */
.app :deep(.win__corner.win__corner--quiet) { right: 72px; bottom: calc(16px + var(--app-safe-bottom, 0px)); }

.app__deck {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  grid-template-areas:
    "transport knobs"
    "side knobs";
  grid-template-rows: auto 1fr;
  gap: 16px 40px;
  /* The right edge keeps clear of the ⌂ chip (bottom-right, 44 px). */
  padding: 16px 64px calc(16px + var(--app-safe-bottom, 0px)) 24px;
  background: var(--bg);
}

.deck__transport { grid-area: transport; display: flex; gap: 12px; align-items: center; padding: 2px; }
.deck__side { grid-area: side; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
.deck__knobs { grid-area: knobs; display: flex; flex-direction: column; gap: 8px; justify-content: center; }

.deck__more {
  font-size: 16px;
  line-height: 16px;
  color: var(--subtle);
  text-decoration: none;
  text-shadow: 2px 2px 0 var(--bg);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  -webkit-tap-highlight-color: transparent;
}
.deck__more:hover, .deck__more:focus-visible { color: var(--cyan); outline: none; }
.deck__more-narrow { display: none; }

.deck__play { min-width: 128px; height: 36px; padding: 0 14px; }
.deck__play.on, .deck__play.on:hover { color: var(--bg); background: var(--pink); box-shadow: 0 -2px 0 0 var(--pink), 0 2px 0 0 var(--pink), -2px 0 0 0 var(--pink), 2px 0 0 0 var(--pink), 0 0 14px color-mix(in srgb, var(--pink) 55%, transparent); }
.deck__hold { height: 36px; margin-left: auto; }
.deck__hold.on, .deck__hold.on:hover { color: var(--bg); background: var(--gold); }

.deck__vol { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 12px; }
.deck__mute {
  width: 28px;
  height: 24px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--pink);
  font-size: 16px;
  cursor: pointer;
}
.deck__mute.on { color: var(--subtle); }

.app__toast {
  --px-edge: var(--gold);
  position: absolute;
  z-index: 25;
  left: 50%;
  top: 20%;
  transform: translate(-50%, -50%);
  margin: 0;
  padding: 10px 16px;
  white-space: nowrap;
  background: var(--bg);
  color: var(--gold);
  text-shadow: 2px 2px 0 var(--bg);
  pointer-events: none;
}

.app__audio { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }

/* Short desktop windows: tighter deck. */
@media (min-width: 701px) and (max-height: 760px) {
  .app__deck { padding-top: 12px; gap: 12px 32px; }
  .deck__knobs { gap: 4px; }
}

/* Phones: the window on top, the deck stacked under it. */
@media (max-width: 700px) {
  .app { --pxs-label-w: 88px; }
  .app__deck {
    grid-template-columns: 1fr;
    grid-template-areas: "transport" "side" "knobs";
    grid-template-rows: auto auto auto;
    gap: 12px;
    padding: 12px 16px calc(12px + var(--app-safe-bottom, 0px));
  }
  .deck__transport { gap: 10px; }
  .deck__play { min-width: 0; flex: 1; padding: 0 8px; }
  .deck__hold { flex: none; padding: 0 8px; margin: 0; }
  .deck__side { gap: 8px; }
  .deck__knobs { gap: 4px; }
  /* The volume row ends short of the ⌂ chip. */
  .deck__vol { margin-right: 44px; }
  .deck__more { text-align: center; }
  .deck__more-wide { display: none; }
  .deck__more-narrow { display: inline; }
}
</style>
