<template>
  <!-- Touch play: a floating stick where the left thumb lands, drag on the
    right half to turn the camera, pinch to zoom; Hopp, the context action,
    Magi and the four emotes (Vink, Dans, Heia, Hjerte) bottom-right, clear of the home chip's corner and above the
    bottom band. Each finger is tracked by its pointer id, so the stick and
    Hopp work at the same time. -->
  <div
    ref="surfaceRef"
    class="mw-touch"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @lostpointercapture="onUp"
    @contextmenu.prevent
  >
    <div
      v-if="stick"
      class="mw-stick"
      :style="{ left: `${stick.ox}px`, top: `${stick.oy}px` }"
      aria-hidden="true"
    >
      <div class="mw-stick-knob" :style="{ transform: `translate(${stick.kx}px, ${stick.ky}px)` }" />
    </div>
    <p v-else-if="showHint" class="mw-touch-hint mw-t" aria-hidden="true">DRA HER FOR Å GÅ</p>

    <div class="mw-pads" @pointerdown.stop @contextmenu.prevent>
      <div class="mw-emotes" role="group" aria-label="Vis de andre">
        <button
          v-for="e in EMOTES"
          :key="e.id"
          type="button"
          class="px-btn mw-btn mw-btn--plain mw-emote"
          :aria-label="e.label"
          @pointerdown.prevent="pressEmote(e.id)"
        >
          <PxIcon :id="e.icon" :scale="3" />
        </button>
      </div>
      <button
        v-if="magic"
        type="button"
        class="px-btn mw-btn mw-btn--sky mw-pad mw-pad--magic"
        :class="{ 'mw-pad--down': magicDown }"
        @pointerdown.prevent="pressMagic"
        @pointerup="magicDown = false"
        @pointercancel="magicDown = false"
      >
        <PxIcon id="sparkle" :scale="3" />MAGI
      </button>
      <div class="mw-pads-row">
        <button
          v-if="actionLabel"
          type="button"
          class="px-btn mw-btn mw-btn--pink mw-pad mw-pad--action"
          :class="{ 'mw-pad--down': actionDown }"
          @pointerdown.prevent="pressAction"
          @pointerup="actionDown = false"
          @pointercancel="actionDown = false"
        >
          {{ actionLabel }}
        </button>
        <button
          type="button"
          class="px-btn mw-btn mw-pad mw-pad--jump"
          :class="{ 'mw-pad--down': jumpDown }"
          @pointerdown.prevent="pressJump"
          @pointerup="releaseJump"
          @pointercancel="releaseJump"
          @lostpointercapture="releaseJump"
        >
          ▲<span>HOPP</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount } from 'vue'
import PxIcon from './PxIcon.vue'
import type { InputState } from '../scene/contracts'
import type { Emote } from './context'
import type { IconId } from './icons'

const props = defineProps<{
  input: InputState
  /** The word from the latest 'near' event, or null (no action button). */
  actionLabel: string | null
  /** A weapon is in hand. */
  magic: boolean
}>()

const emit = defineEmits<{ action: []; firstTouch: []; emote: [Emote] }>()

/** The shared world's four hellos (keys 1–4 on a keyboard). */
const EMOTES: { id: Emote; icon: IconId; label: string }[] = [
  { id: 'wave', icon: 'wave', label: 'Vink' },
  { id: 'dance', icon: 'dance', label: 'Dans' },
  { id: 'cheer', icon: 'cheer', label: 'Heia' },
  { id: 'heart', icon: 'heart', label: 'Hjerte' },
]

/** Stick radius in CSS px: full speed at this distance. */
const STICK_R = 52
/** Radians of camera turn per CSS px of drag: the runtime's own touch rate and signs (scene/input.ts). */
const YAW_PER_PX = -0.011
const PITCH_PER_PX = 0.0088

const surfaceRef = ref<HTMLElement | null>(null)
const stick = ref<{ id: number; ox: number; oy: number; kx: number; ky: number } | null>(null)
const jumpDown = ref(false)
const actionDown = ref(false)
const magicDown = ref(false)
const showHint = ref(true)

/** Camera fingers: last position per pointer id. */
const look = new Map<number, { x: number; y: number }>()
let pinchDist = 0

function local(e: PointerEvent) {
  const r = surfaceRef.value!.getBoundingClientRect()
  return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width }
}

function onDown(e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  emit('firstTouch')
  const p = local(e)
  surfaceRef.value?.setPointerCapture?.(e.pointerId)
  if (!stick.value && p.x < p.w / 2) {
    stick.value = { id: e.pointerId, ox: p.x, oy: p.y, kx: 0, ky: 0 }
    showHint.value = false
    return
  }
  look.set(e.pointerId, { x: e.clientX, y: e.clientY })
  if (look.size === 2) pinchDist = distance()
}

function distance() {
  const [a, b] = [...look.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}

function onMove(e: PointerEvent) {
  const s = stick.value
  if (s && e.pointerId === s.id) {
    const p = local(e)
    let dx = p.x - s.ox
    let dy = p.y - s.oy
    const d = Math.hypot(dx, dy)
    if (d > STICK_R) { dx *= STICK_R / d; dy *= STICK_R / d }
    s.kx = dx
    s.ky = dy
    // A small dead zone, then a straight line to full speed.
    const mag = Math.min(1, d / STICK_R)
    const k = mag < 0.12 ? 0 : 1
    props.input.moveX = k * (dx / STICK_R)
    props.input.moveY = k * (-dy / STICK_R)
    return
  }
  const last = look.get(e.pointerId)
  if (!last) return
  if (look.size >= 2) {
    look.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const d = distance()
    if (pinchDist > 0 && d > 0) props.input.zoom *= pinchDist / d
    pinchDist = d
    return
  }
  props.input.camYaw += (e.clientX - last.x) * YAW_PER_PX
  props.input.camPitch += (e.clientY - last.y) * PITCH_PER_PX
  look.set(e.pointerId, { x: e.clientX, y: e.clientY })
}

function onUp(e: PointerEvent) {
  if (stick.value && e.pointerId === stick.value.id) {
    stick.value = null
    props.input.moveX = 0
    props.input.moveY = 0
    return
  }
  look.delete(e.pointerId)
  pinchDist = look.size === 2 ? distance() : 0
}

function pressJump(e: PointerEvent) {
  emit('firstTouch')
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  jumpDown.value = true
  props.input.jump = true
  props.input.jumpPressed = true
}
function releaseJump() {
  jumpDown.value = false
  props.input.jump = false
}
function pressAction() {
  emit('firstTouch')
  actionDown.value = true
  props.input.actionPressed = true
  emit('action')
}
function pressEmote(e: Emote) {
  emit('firstTouch')
  emit('emote', e)
}
function pressMagic() {
  emit('firstTouch')
  magicDown.value = true
  props.input.usePressed = true
}

function reset() {
  stick.value = null
  look.clear()
  pinchDist = 0
  props.input.moveX = 0
  props.input.moveY = 0
  props.input.jump = false
}

onBeforeUnmount(reset)
defineExpose({ reset })
</script>

<style scoped>
.mw-touch {
  position: absolute;
  inset: 0;
  z-index: 10;
  touch-action: none;
  user-select: none;
  -webkit-user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.mw-stick {
  position: absolute;
  width: 112px;
  height: 112px;
  margin: -56px 0 0 -56px;
  pointer-events: none;
  background: rgba(255, 255, 255, 0.28);
  box-shadow:
    0 -3px 0 0 rgba(42, 31, 74, 0.55),
    0 3px 0 0 rgba(42, 31, 74, 0.55),
    -3px 0 0 0 rgba(42, 31, 74, 0.55),
    3px 0 0 0 rgba(42, 31, 74, 0.55);
}
.mw-stick-knob {
  position: absolute;
  left: 32px;
  top: 32px;
  width: 48px;
  height: 48px;
  background: var(--mw-yellow);
  box-shadow:
    0 -3px 0 0 var(--mw-ink),
    0 3px 0 0 var(--mw-ink),
    -3px 0 0 0 var(--mw-ink),
    3px 0 0 0 var(--mw-ink);
}
.mw-touch-hint {
  position: absolute;
  left: max(20px, env(safe-area-inset-left, 0px));
  bottom: calc(24px + var(--app-safe-bottom, 0px));
  margin: 0;
  font-size: 16px;
  color: #fff;
  text-shadow: 2px 2px 0 var(--mw-ink);
  pointer-events: none;
}
.mw-pads {
  position: absolute;
  right: max(16px, env(safe-area-inset-right, 0px));
  bottom: calc(60px + var(--app-safe-bottom, 0px));
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 16px;
}
.mw-emotes {
  display: grid;
  grid-template-columns: repeat(2, 48px);
  gap: 8px;
}
.mw-root .px-btn.mw-btn.mw-emote { width: 48px; height: 48px; padding: 0; }
.mw-pads-row {
  display: flex;
  align-items: flex-end;
  gap: 16px;
}
.mw-root .px-btn.mw-btn.mw-pad {
  touch-action: none;
  font-size: 16px;
}
.mw-root .px-btn.mw-btn.mw-pad--jump {
  flex-direction: column;
  gap: 4px;
  width: 88px;
  height: 88px;
  padding: 0;
  font-size: 24px;
}
.mw-pad--jump span { font-size: 16px; }
.mw-root .px-btn.mw-btn.mw-pad--action {
  min-height: 64px;
  max-width: 150px;
  padding: 6px 12px;
  text-align: center;
  white-space: normal;
}
.mw-root .px-btn.mw-btn.mw-pad--magic { min-height: 56px; }
.mw-root .px-btn.mw-btn.mw-pad--down { transform: translateY(3px); filter: brightness(0.92); }
@media (max-height: 420px) {
  .mw-pads { bottom: calc(52px + var(--app-safe-bottom, 0px)); gap: 10px; }
  .mw-pads-row { gap: 12px; }
  .mw-emotes { grid-template-columns: repeat(4, 48px); }
  .mw-root .px-btn.mw-btn.mw-pad--jump { width: 76px; height: 76px; }
}
</style>
