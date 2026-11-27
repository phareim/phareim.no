<template>
  <!-- Every key stops here (the world, the menu and the Escape pill hear none), and a press beside the box leaves the
    focus inside it. A press beside the box does not close it: typed words are not lost to a stray thumb. -->
  <div class="fbk" :style="{ '--fb-kb': `${keyboard}px` }" @pointerdown.self.prevent @keydown.stop="onKey" @keyup.stop>
    <section ref="box" class="fbk-box px-box" role="dialog" aria-modal="true" aria-labelledby="fbk-title" tabindex="-1">
      <h2 id="fbk-title" class="fbk-title">FEEDBACK</h2>
      <p class="fbk-where">{{ where }}</p>
      <div class="fbk-shot">
        <img v-if="picture" class="fbk-img" :src="picture" alt="The picture of the screen that goes along">
        <span v-else class="fbk-dim">{{ making ? 'PICTURE...' : 'NO PICTURE' }}</span>
      </div>
      <textarea
        ref="field"
        class="fbk-text"
        rows="3"
        :maxlength="TEXT_MAX"
        enterkeyhint="enter"
        placeholder="WHAT IS WRONG?"
        aria-label="What is wrong?"
        :value="text"
        :readonly="busy"
        @input="typed"
        @keydown.stop="onKey"
        @keyup.stop
      />
      <div class="fbk-row">
        <button type="button" class="px-btn px-btn--pink fbk-btn fbk-send" :disabled="busy" @pointerdown.prevent="own = 'send'" @click="press('send')">{{ report?.state === 'failed' ? 'RETRY' : 'SEND' }}</button>
        <button type="button" class="px-btn fbk-btn fbk-cancel" @pointerdown.prevent="own = 'cancel'" @click="press('cancel')">CANCEL</button>
      </div>
      <p class="fbk-status" :class="{ 'fbk-status--warn': report?.state === 'failed' }" role="status">{{ status }}</p>
    </section>
  </div>
</template>

<script setup lang="ts">
/**
 * The feedback window over the still world (`openPanel('', 'feedback')`): where the hero stands, the picture, what is
 * wrong, SEND. A report that was not sent stays (words, picture, place) until it is: CANCEL keeps it for the next FB.
 * The words are kept in `localStorage['zelda.feedbackDraft']` too, so a reload or a tab the phone let go of loses
 * nothing; only the service's 201 clears them. The box hangs from the top, above an iPhone's keyboard.
 */
import { useKeyboardInset } from '../../../composables/useKeyboardInset'
import { TEXT_MAX, postFeedback } from './send'
import { FEEDBACK_BASE } from './url'
import type { Shot } from './capture'
import type { Feedback } from './useFeedback'

const props = defineProps<{
  fb: Feedback
  /** On touch the field waits for a finger: a keyboard that jumps up covers half the screen. */
  touch: boolean
}>()

const emit = defineEmits<{ close: [] }>()

const DRAFT_KEY = 'zelda.feedbackDraft'
/** Presses this soon after opening are the ones that opened it. */
const GRACE_MS = 350
/** How long SENT. stands. */
const SENT_MS = 1000

/** The report this window was opened for (kept here: the handle lets go of it once it is sent). */
const report = props.fb.report.value
const keyboard = useKeyboardInset()
const box = ref<HTMLElement | null>(null)
const field = ref<HTMLTextAreaElement | null>(null)

function stored(): string {
  try { return localStorage.getItem(DRAFT_KEY) ?? '' } catch { return '' }
}
const text = ref(props.fb.draft ?? stored())

function typed(e: Event) {
  text.value = (e.target as HTMLTextAreaElement).value
  props.fb.draft = text.value
  try { localStorage.setItem(DRAFT_KEY, text.value) } catch { /* private mode or full: kept for this visit */ }
}

const where = computed(() => {
  const w = report?.meta.where
  return w ? `${w.map.name ?? w.map.id} · ${w.area} · TILE ${w.tile.x},${w.tile.y}` : ''
})

const picture = ref('')
const making = ref(true)
const busy = computed(() => report?.state === 'sending' || report?.state === 'sent')
const status = computed(() => {
  switch (report?.state) {
    case 'sending': return 'SENDING...'
    case 'sent': return 'SENT.'
    case 'failed': return `NOT SENT: ${report.reason}`
    default: return ''
  }
})

/** The picture, or the word that there is none (its code did not arrive). */
const shotOf = (p: Promise<Shot>) => p.catch((): Shot => ({ blob: null, w: 0, h: 0, q: 0, note: 'error' }))

async function send() {
  const r = report
  if (!r || r.state === 'sending' || r.state === 'sent') return
  const fb = props.fb
  const words = text.value
  r.state = 'sending'
  const shot = await shotOf(r.shot)
  const sent = await postFeedback({
    fetch: (...a) => fetch(...a),
    url: FEEDBACK_BASE,
    meta: { ...r.meta, shot: shot.blob ? { w: shot.w, h: shot.h, bytes: shot.blob.size, q: shot.q } : null, shotNote: shot.note },
    save: r.save,
    text: words,
    shot: shot.blob,
  })
  if (!sent.ok) {
    r.reason = sent.reason
    r.state = 'failed'
    return
  }
  // The service has it (whether or not this window is still open): everything of this report goes.
  fb.draft = null
  try { localStorage.removeItem(DRAFT_KEY) } catch { /* nothing was kept */ }
  if (fb.report.value === r) fb.report.value = null
  r.state = 'sent'
}

let openedAt = 0
/** The button that took a pointer's press of its own in this window. */
let own = null as 'send' | 'cancel' | null
let early: ReturnType<typeof setTimeout> | undefined
let closing: ReturnType<typeof setTimeout> | undefined
let focusing: ReturnType<typeof setTimeout> | undefined
let alive = true

/**
 * A press in the window's first moments does nothing then. One that began on SEND itself is meant, though: it is sent
 * when the moments are over. Anything else that early is the press that opened the window.
 */
function press(which: 'send' | 'cancel') {
  const wait = openedAt + GRACE_MS - performance.now()
  if (wait > 0) {
    if (which === 'send' && own === 'send') early ??= setTimeout(() => void send(), wait)
    return
  }
  if (which === 'send') void send()
  else emit('close')
}

function onKey(e: KeyboardEvent) {
  if (e.code !== 'Escape' || e.isComposing) return
  e.preventDefault()
  if (!e.repeat) press('cancel')
}

watch(() => report?.state, (state) => {
  if (state === 'sent') {
    text.value = ''
    closing = setTimeout(() => emit('close'), SENT_MS)
  }
})

onMounted(() => {
  openedAt = performance.now()
  box.value?.focus({ preventScroll: true })
  if (!props.touch) focusing = setTimeout(() => field.value?.focus({ preventScroll: true }), GRACE_MS)
  if (!report) { making.value = false; return }
  void shotOf(report.shot).then((shot) => {
    if (!alive) return
    if (shot.blob) picture.value = URL.createObjectURL(shot.blob)
    making.value = false
  })
})

onBeforeUnmount(() => {
  alive = false
  clearTimeout(early)
  clearTimeout(closing)
  clearTimeout(focusing)
  if (picture.value) URL.revokeObjectURL(picture.value)
  // The keyboard goes with the field, and the page an iPhone scrolled up to show it comes back down.
  field.value?.blur()
  window.scrollTo(0, 0)
})
</script>

<style>
.fbk {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-sizing: border-box;
  padding: max(16px, env(safe-area-inset-top)) 16px calc(16px + var(--app-safe-bottom, 0px) + var(--fb-kb, 0px));
  background: rgba(11, 6, 22, 0.55);
  font-family: var(--font-pixel);
  -webkit-font-smoothing: none;
  touch-action: manipulation;
}

.fbk-box {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: min(360px, 100%);
  min-height: 0;
  max-height: 100%;
  overflow: hidden auto;
  padding: 10px 12px 8px;
  color: #fff4ff;
  font-size: 16px;
  line-height: 20px;
  text-transform: uppercase;
  background: #0b0616;
}
.fbk-box:focus { outline: none; }

.fbk-title {
  flex: none;
  margin: 0;
  font: inherit;
  color: #ff2fa0;
  text-shadow: 2px 2px 0 #3a1a4a;
}

.fbk-where {
  flex: none;
  margin: 0;
  color: #2ff3ff;
  overflow-wrap: anywhere;
}

/* The one part that gives way when the keyboard leaves little room. */
.fbk-shot {
  flex: 0 1 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 20px;
  overflow: hidden;
}
.fbk-img {
  width: 100%;
  height: 100%;
  min-height: 0;
  object-fit: contain;
}
.fbk-dim { color: #6f5ca6; }

.fbk-text {
  flex: none;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: 2px solid #2ff3ff;
  border-radius: 0;
  background: #140b24;
  color: #fff4ff;
  /* 16 px: iOS zooms into a smaller field. */
  font: 400 16px/22px var(--font-machine, monospace);
  -webkit-font-smoothing: antialiased;
  text-transform: none;
  resize: none;
  /* (The page lets nothing be selected; a field that is typed in does.) */
  user-select: text;
  -webkit-user-select: text;
}
.fbk-text:focus { outline: none; border-color: #ff2fa0; }
.fbk-text::placeholder { color: #6f5ca6; }
.fbk-text:read-only { color: #a497c9; }

.fbk-row {
  flex: none;
  display: flex;
  gap: 12px;
  padding: 2px;
}
.fbk-btn {
  box-sizing: border-box;
  flex: 1 1 0;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 44px;
  padding: 0 8px;
  font-size: 16px;
  line-height: 16px;
  touch-action: manipulation;
}
.fbk-btn:disabled { opacity: 0.5; cursor: default; }

.fbk-status {
  flex: none;
  min-height: 20px;
  margin: 0;
  color: #2ff3ff;
}
.fbk-status--warn { color: #ffd23f; }

/* The 16-bit dress (`px16` on the root, from the shell): base/pixel/pixel16.css dresses the box and the buttons. */
.px16.fbk { background: rgba(8, 10, 44, 0.55); }
.px16 .fbk-title { color: var(--px16-prize); text-shadow: var(--px16-drop); }
.px16 .fbk-where,
.px16 .fbk-status { color: var(--px16-cool); text-shadow: var(--px16-drop); }
.px16 .fbk-status--warn { color: var(--px16-prize); }
.px16 .fbk-dim { color: var(--px16-dim); }
.px16 .fbk-text { border-color: var(--px16-line); background: #06082c; }
</style>
